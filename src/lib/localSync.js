// /src/lib/localSync.js
// Sincronización incremental local <-> Upstash (cliente)
// Requisitos: tener VITE_UPSTASH_URL y VITE_UPSTASH_TOKEN en .env o usar valores directos

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

/* ====== Limits ====== */
const MAX_PUSH_SIZE = 1_000_000; // 1 MB máximo por push

/* ====== Utils ====== */
async function fetchJSON(url, options = {}) {
  const headers = { ...(options.headers || {}) };
  headers.Authorization = `Bearer ${UPSTASH_TOKEN}`;
  const resp = await fetch(url, { ...options, headers });
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`HTTP ${resp.status} - ${text}`);
  }
  return resp.json();
}

async function readCloudKey(key) {
  try {
    const url = `${UPSTASH_URL}/GET/${encodeURIComponent(key)}`;
    const json = await fetchJSON(url, { method: "GET" });
    return json.result ?? null;
  } catch (err) {
    console.error("readCloudKey error", key, err);
    return null;
  }
}

async function writeCloudKey(key, value) {
  try {
    const payload = JSON.stringify({ value });
    if (payload.length > MAX_PUSH_SIZE) {
      console.warn(`[localSync] Payload demasiado grande para ${key} (${payload.length} bytes). Cambio ignorado.`);
      return false;
    }

    const url = `${UPSTASH_URL}/SET/${encodeURIComponent(key)}`;
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${UPSTASH_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: payload,
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

function safeParse(raw, defaultValue = {}) {
  if (!raw) return defaultValue;
  if (typeof raw === "string") {
    try { return JSON.parse(raw); } catch { return defaultValue; }
  }
  return raw;
}

/* ====== Snapshot local ====== */
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

/* ====== Bootstrap inicial ====== */
export async function bootstrapIfNeeded() {
  try {
    if (localStorage.getItem(LOCAL_STORAGE_BOOTSTRAP_FLAG) === "yes") {
      const idxArr = safeParse(await readCloudKey(CHANGES_INDEX_KEY), []);
      localStorage.setItem(LOCAL_LAST_CHANGE_INDEX, String(idxArr.length || 0));
      console.log("Bootstrap ya realizado.");
      return;
    }

    const snapObj = safeParse(await readCloudKey(SNAPSHOT_KEY), {});
    Object.entries(snapObj).forEach(([k, v]) => {
      try { localStorage.setItem(k, JSON.stringify(v)); } catch {}
    });

    const idxArr = safeParse(await readCloudKey(CHANGES_INDEX_KEY), []);
    for (const id of idxArr) {
      const changeObj = safeParse(await readCloudKey(CHANGE_PREFIX + id), {});
      Object.entries(changeObj).forEach(([k, v]) => {
        try { localStorage.setItem(k, JSON.stringify(v)); } catch {}
      });
    }

    localStorage.setItem(LOCAL_STORAGE_BOOTSTRAP_FLAG, "yes");
    localStorage.setItem(LOCAL_LAST_CHANGE_INDEX, String(idxArr.length || 0));
    console.log("Bootstrap completado.");
  } catch (err) {
    console.error("bootstrapIfNeeded error", err);
  }
}

/* ====== Push incremental seguro ====== */
export async function pushChangeLocalAndCloud(changeObj) {
  try {
    const snapshot = readLocalSnapshot();

    // Filtrar cambios reales
    const incremental = {};
    Object.entries(changeObj).forEach(([k, v]) => {
      if (JSON.stringify(snapshot[k]) !== JSON.stringify(v)) {
        incremental[k] = v;
      }
    });
    if (!Object.keys(incremental).length) return false;

    // Actualizar snapshot local
    writeLocalSnapshot({ ...snapshot, ...incremental });

    const id = `${Date.now()}-${uuidv4()}`;
    const ok1 = await writeCloudKey(CHANGE_PREFIX + id, incremental);
    if (!ok1) return false;

    const idxArr = safeParse(await readCloudKey(CHANGES_INDEX_KEY), []);
    idxArr.push(id);
    const ok2 = await writeCloudKey(CHANGES_INDEX_KEY, idxArr);
    if (!ok2) return false;

    const lastIdx = Number(localStorage.getItem(LOCAL_LAST_CHANGE_INDEX) || "0");
    localStorage.setItem(LOCAL_LAST_CHANGE_INDEX, String(lastIdx + 1));

    return true;
  } catch (err) {
    console.error("pushChangeLocalAndCloud error", err);
    return false;
  }
}

/* ====== Fetch nuevos cambios ====== */
export async function fetchAndApplyNewCloudChanges() {
  try {
    const idxArr = safeParse(await readCloudKey(CHANGES_INDEX_KEY), []);
    if (!Array.isArray(idxArr) || idxArr.length === 0) return;

    const lastLocal = Number(localStorage.getItem(LOCAL_LAST_CHANGE_INDEX) || "0");
    if (lastLocal >= idxArr.length) return;

    for (let i = lastLocal; i < idxArr.length; i++) {
      const changeObj = safeParse(await readCloudKey(CHANGE_PREFIX + idxArr[i]), {});
      const snapshot = readLocalSnapshot();
      writeLocalSnapshot({ ...snapshot, ...changeObj });
    }

    localStorage.setItem(LOCAL_LAST_CHANGE_INDEX, String(idxArr.length));
  } catch (err) {
    console.error("fetchAndApplyNewCloudChanges error", err);
  }
}

/* ====== Watcher automático ====== */
let _watcher = null;
export function startCloudWatcher(intervalMs = 2000) {
  stopCloudWatcher();
  _watcher = setInterval(() => fetchAndApplyNewCloudChanges().catch(() => {}), intervalMs);
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

/* ====== Auto sync layer sin recursión infinita ====== */
(function () {
  const originalSetItem = localStorage.setItem;
  const updatingKeys = new Set();

  localStorage.setItem = function (key, value) {
    originalSetItem.apply(this, arguments);
    if (window.__localSync__?.autoPush && !updatingKeys.has(key)) {
      updatingKeys.add(key);
      window.__localSync__.autoPush(key, value)
        .finally(() => updatingKeys.delete(key))
        .catch(err => console.warn("[localSync] autoPush error:", err));
    }
  };
})();

window.__localSync__ = {
  autoPush: async (key, rawValue) => {
    try {
      let value;
      try { value = JSON.parse(rawValue); } catch { value = rawValue; }
      await pushChangeLocalAndCloud({ [key]: value });
      console.log("[localSync] Cambio detectado y subido:", key);
    } catch (e) {
      console.warn("[localSync] Error enviando cambio incremental:", e);
    }
  }
};

/* ====== Exports ====== */
export default {
  bootstrapIfNeeded,
  pushChangeLocalAndCloud,
  fetchAndApplyNewCloudChanges,
  startCloudWatcher,
  stopCloudWatcher,
  readLocalSnapshot,
  writeLocalSnapshot
};
