// /src/lib/localSync.js
// Sincronización incremental local <-> Upstash (cliente)
// Requisitos: tener VITE_UPSTASH_URL y VITE_UPSTASH_TOKEN en .env o usar los valores directos

import { v4 as uuidv4 } from "uuid";

/* ====== CONFIG ====== */
const UPSTASH_URL = import.meta.env.VITE_UPSTASH_URL || "https://together-grouper-32531.upstash.io";
const UPSTASH_TOKEN = import.meta.env.VITE_UPSTASH_TOKEN || "AX8TAAIncDJhNWY4MjZjYzg0ZTI0OTBlYTFjNDUxZmQwZDE0MGE2ZHAyMzI1MzE";

/* ====== KEYS ====== */
const SNAPSHOT_KEY = "localstorage_snapshot_v1";
const CHANGES_INDEX_KEY = "changes_index_v1";
const CHANGE_PREFIX = "change_v1:";

/* ====== Local keys ====== */
const LOCAL_STORAGE_BOOTSTRAP_FLAG = "bootstrapped_v1";
const LOCAL_LAST_CHANGE_INDEX = "local_last_change_index_v1";

/* ====== Fetch helpers ====== */
async function fetchJSON(url, options = {}) {
  const headers = { ...options.headers, Authorization: `Bearer ${UPSTASH_TOKEN}` };
  const resp = await fetch(url, { ...options, headers });
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`HTTP ${resp.status} - ${text}`);
  }
  return resp.json();
}

/* ====== Upstash GET/SET adaptado ====== */
async function readCloudKey(key) {
  const url = `${UPSTASH_URL}/GET/${encodeURIComponent(key)}`;
  try {
    const json = await fetchJSON(url, { method: "GET" });
    return json.result ?? null;
  } catch (err) {
    console.error("readCloudKey error", key, err);
    return null;
  }
}

async function writeCloudKey(key, value) {
  // Upstash expects {"key": "...", "value": "..."} for POST /SET
  const url = `${UPSTASH_URL}/SET`;
  try {
    const body = JSON.stringify({ key, value });
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${UPSTASH_TOKEN}`,
        "Content-Type": "application/json",
      },
      body,
    });
    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      throw new Error(`writeCloudKey HTTP ${resp.status} - ${text}`);
    }
    return true;
  } catch (err) {
    console.error("writeCloudKey error", key, err);
    return false;
  }
}

/* ====== Local read/write ====== */
export function readLocalSnapshot() {
  try {
    const raw = localStorage.getItem("APP_DATA_2025");
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function writeLocalSnapshot(obj) {
  try {
    localStorage.setItem("APP_DATA_2025", JSON.stringify(obj));
  } catch (err) {
    console.error("writeLocalSnapshot error", err);
  }
}

/* ====== Bootstrap ====== */
export async function bootstrapIfNeeded() {
  try {
    const snapRaw = await readCloudKey(SNAPSHOT_KEY);
    let snapshotData = {};

    if (snapRaw) {
      snapshotData = typeof snapRaw === "string" ? JSON.parse(snapRaw) : snapRaw;
    } else {
      const idxRaw = await readCloudKey(CHANGES_INDEX_KEY);
      if (idxRaw) {
        let idxArr = typeof idxRaw === "string" ? JSON.parse(idxRaw) : idxRaw;
        for (let id of idxArr) {
          const changeRaw = await readCloudKey(CHANGE_PREFIX + id);
          if (!changeRaw) continue;
          let changeObj = typeof changeRaw === "string" ? JSON.parse(changeRaw) : changeRaw;
          snapshotData = { ...snapshotData, ...changeObj };
        }
      }
    }

    // Escribir snapshot completo en key central
    writeLocalSnapshot(snapshotData);
    localStorage.setItem(LOCAL_STORAGE_BOOTSTRAP_FLAG, "yes");
    localStorage.setItem(LOCAL_LAST_CHANGE_INDEX, "0");

    // Aplicar cambios recientes inmediatamente
    await fetchAndApplyNewCloudChanges();

    console.log("Bootstrap completado y cambios aplicados");
  } catch (err) {
    console.error("bootstrapIfNeeded error", err);
  }
}

/* ====== Upload full snapshot ====== */
export async function uploadLocalSnapshot() {
  try {
    const snapshot = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      try {
        snapshot[key] = JSON.parse(localStorage.getItem(key));
      } catch {
        snapshot[key] = localStorage.getItem(key);
      }
    }
    await writeCloudKey(SNAPSHOT_KEY, snapshot);
    return true;
  } catch (err) {
    console.error("uploadLocalSnapshot error", err);
    return false;
  }
}

/* ====== Push incremental ====== */
export async function pushChangeLocalAndCloud(changeObj) {
  try {
    const currentSnapshot = readLocalSnapshot();
    const updated = { ...currentSnapshot, ...changeObj };
    writeLocalSnapshot(updated);

    const id = `${Date.now()}-${uuidv4()}`;
    const ok1 = await writeCloudKey(CHANGE_PREFIX + id, changeObj);
    if (!ok1) {
      console.warn("pushChange: failed to write change to cloud");
      return false;
    }

    let idxRaw = await readCloudKey(CHANGES_INDEX_KEY);
    let idxArr = [];
    try {
      idxArr = idxRaw ? (typeof idxRaw === "string" ? JSON.parse(idxRaw) : idxRaw) : [];
      if (!Array.isArray(idxArr)) idxArr = [];
    } catch {
      idxArr = [];
    }

    idxArr.push(id);
    const ok2 = await writeCloudKey(CHANGES_INDEX_KEY, idxArr);
    if (!ok2) {
      console.warn("pushChange: failed to update changes index");
      return false;
    }

    const lastIdx = Number(localStorage.getItem(LOCAL_LAST_CHANGE_INDEX) || "0");
    localStorage.setItem(LOCAL_LAST_CHANGE_INDEX, String(lastIdx + 1));

    return true;
  } catch (err) {
    console.error("pushChangeLocalAndCloud error", err);
    return false;
  }
}

/* ====== Fetch new changes ====== */
export async function fetchAndApplyNewCloudChanges() {
  try {
    const idxRaw = await readCloudKey(CHANGES_INDEX_KEY);
    if (!idxRaw) return;
    let idxArr = typeof idxRaw === "string" ? JSON.parse(idxRaw) : idxRaw;
    if (!Array.isArray(idxArr) || idxArr.length === 0) return;

    const lastLocal = Number(localStorage.getItem(LOCAL_LAST_CHANGE_INDEX) || "0");
    if (lastLocal >= idxArr.length) return;

    for (let i = lastLocal; i < idxArr.length; i++) {
      const id = idxArr[i];
      const changeRaw = await readCloudKey(CHANGE_PREFIX + id);
      if (!changeRaw) continue;
      let changeObj = typeof changeRaw === "string" ? JSON.parse(changeRaw) : changeRaw;
      if (!changeObj) continue;

      const currentSnapshot = readLocalSnapshot();
      const merged = { ...currentSnapshot, ...changeObj };
      writeLocalSnapshot(merged);
    }

    localStorage.setItem(LOCAL_LAST_CHANGE_INDEX, String(idxArr.length));
  } catch (err) {
    console.error("fetchAndApplyNewCloudChanges error", err);
  }
}

/* ====== Cloud watcher ====== */
let _watcher = null;

export function startCloudWatcher(intervalMs = 2000) {
  stopCloudWatcher();
  _watcher = setInterval(() => {
    fetchAndApplyNewCloudChanges().catch(() => {});
  }, intervalMs);
  fetchAndApplyNewCloudChanges().catch(() => {});
  console.log("Cloud watcher started, interval:", intervalMs);
}

export function stopCloudWatcher() {
  if (_watcher) {
    clearInterval(_watcher);
    _watcher = null;
    console.log("Cloud watcher stopped");
  }
}

/* ====== Exports ====== */
const exported = {
  bootstrapIfNeeded,
  uploadLocalSnapshot,
  pushChangeLocalAndCloud,
  fetchAndApplyNewCloudChanges,
  startCloudWatcher,
  stopCloudWatcher,
  readLocalSnapshot,
  writeLocalSnapshot
};
export default exported;

/* ====== AUTOMATIC SYNC LAYER ====== */
(function () {
  const originalSetItem = localStorage.setItem;
  localStorage.setItem = function (key, value) {
    originalSetItem.apply(this, arguments);
    if (window.__localSync__?.autoPush) {
      try {
        window.__localSync__.autoPush(key, value);
      } catch (err) {
        console.warn("[localSync] Error en autoPush:", err);
      }
    }
  };
})();

window.__localSync__ = {
  autoPush: async (key, rawValue) => {
    try {
      let value = rawValue;
      try { value = JSON.parse(rawValue); } catch {}
      const change = { [key]: value };
      await pushChangeLocalAndCloud(change);
      console.log("[localSync] Cambio detectado y subido:", key);
    } catch (e) {
      console.warn("[localSync] Error enviando cambio incremental:", e);
    }
  }
};
