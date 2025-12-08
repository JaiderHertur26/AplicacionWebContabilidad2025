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
const MAX_PAYLOAD_SIZE = 5_000_000; // 5MB aprox

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
    // Evitar referencias circulares
    const payload = JSON.stringify({ value }, getCircularReplacer());
    if (payload.length > MAX_PAYLOAD_SIZE) throw new Error("Payload too large for Upstash");

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

// Evita JSON.stringify infinito en referencias circulares
function getCircularReplacer() {
  const seen = new WeakSet();
  return (key, value) => {
    if (typeof value === "object" && value !== null) {
      if (seen.has(value)) return "[Circular]";
      seen.add(value);
    }
    return value;
  };
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
    localStorage.setItem("APP_DATA_2025", JSON.stringify(obj, getCircularReplacer()));
  } catch (err) {
    console.error("writeLocalSnapshot error", err);
  }
}

/* ====== Bootstrap ====== */
export async function bootstrapIfNeeded() {
  try {
    if (localStorage.getItem(LOCAL_STORAGE_BOOTSTRAP_FLAG) === "yes") {
      const idx = await readCloudKey(CHANGES_INDEX_KEY);
      const arr = safeParse(idx, []);
      localStorage.setItem(LOCAL_LAST_CHANGE_INDEX, String(arr.length || 0));
      console.log("Bootstrap ya realizado.");
      return;
    }

    const snapRaw = await readCloudKey(SNAPSHOT_KEY);
    const snapObj = safeParse(snapRaw, {});
    Object.keys(snapObj).forEach(k => {
      try { localStorage.setItem(k, JSON.stringify(snapObj[k])); } catch {}
    });

    const idxRaw = await readCloudKey(CHANGES_INDEX_KEY);
    const idxArr = safeParse(idxRaw, []);
    for (let i = 0; i < idxArr.length; i++) {
      const id = idxArr[i];
      const changeRaw = await readCloudKey(CHANGE_PREFIX + id);
      const changeObj = safeParse(changeRaw, {});
      Object.keys(changeObj).forEach(k => {
        try { localStorage.setItem(k, JSON.stringify(changeObj[k])); } catch {}
      });
    }

    localStorage.setItem(LOCAL_STORAGE_BOOTSTRAP_FLAG, "yes");
    localStorage.setItem(LOCAL_LAST_CHANGE_INDEX, String(idxArr.length || 0));
    console.log("Bootstrap completado.");
  } catch (err) {
    console.error("bootstrapIfNeeded error", err);
  }
}

/* ====== Upload snapshot completo ====== */
export async function uploadLocalSnapshot() {
  try {
    const snapshot = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      try { snapshot[key] = JSON.parse(localStorage.getItem(key)); } catch { snapshot[key] = localStorage.getItem(key); }
    }
    return writeCloudKey(SNAPSHOT_KEY, snapshot);
  } catch (err) {
    console.error("uploadLocalSnapshot error", err);
    return false;
  }
}

/* ====== Push incremental seguro ====== */
export async function pushChangeLocalAndCloud(changeObj) {
  try {
    // Suspender autoPush para evitar recursión
    window.__localSync__?.suspendAutoPush(true);

    const currentSnapshot = readLocalSnapshot();

    // Evita enviar cambios idénticos
    const hasChanges = Object.keys(changeObj).some(
      k => JSON.stringify(currentSnapshot[k]) !== JSON.stringify(changeObj[k])
    );
    if (!hasChanges) return false;

    const updated = { ...currentSnapshot, ...changeObj };
    writeLocalSnapshot(updated);

    const id = `${Date.now()}-${uuidv4()}`;
    const ok1 = await writeCloudKey(CHANGE_PREFIX + id, changeObj);
    if (!ok1) return false;

    const idxRaw = await readCloudKey(CHANGES_INDEX_KEY);
    const idxArr = safeParse(idxRaw, []);
    idxArr.push(id);
    const ok2 = await writeCloudKey(CHANGES_INDEX_KEY, idxArr);
    if (!ok2) return false;

    const lastIdx = Number(localStorage.getItem(LOCAL_LAST_CHANGE_INDEX) || "0");
    localStorage.setItem(LOCAL_LAST_CHANGE_INDEX, String(lastIdx + 1));

    return true;
  } catch (err) {
    console.error("pushChangeLocalAndCloud error", err);
    return false;
  } finally {
    window.__localSync__?.suspendAutoPush(false);
  }
}

/* ====== Fetch nuevos cambios ====== */
export async function fetchAndApplyNewCloudChanges() {
  try {
    const idxRaw = await readCloudKey(CHANGES_INDEX_KEY);
    const idxArr = safeParse(idxRaw, []);
    if (!Array.isArray(idxArr) || idxArr.length === 0) return;

    const lastLocal = Number(localStorage.getItem(LOCAL_LAST_CHANGE_INDEX) || "0");
    if (lastLocal >= idxArr.length) return;

    for (let i = lastLocal; i < idxArr.length; i++) {
      const id = idxArr[i];
      const changeRaw = await readCloudKey(CHANGE_PREFIX + id);
      const changeObj = safeParse(changeRaw, {});
      const currentSnapshot = readLocalSnapshot();
      writeLocalSnapshot({ ...currentSnapshot, ...changeObj });
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

/* ====== Auto sync layer (sin recursión) ====== */
(function () {
  const originalSetItem = localStorage.setItem;
  const suspendedKeys = new Set();

  localStorage.setItem = function (key, value) {
    originalSetItem.apply(this, arguments);
    if (window.__localSync__?.autoPush && !suspendedKeys.has(key)) {
      suspendedKeys.add(key);
      window.__localSync__.autoPush(key, value)
        .finally(() => suspendedKeys.delete(key))
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
  },
  suspendAutoPush(flag) {
    this._suspended = flag;
  },
  _suspended: false
};

/* ====== Exports ====== */
export default {
  bootstrapIfNeeded,
  uploadLocalSnapshot,
  pushChangeLocalAndCloud,
  fetchAndApplyNewCloudChanges,
  startCloudWatcher,
  stopCloudWatcher,
  readLocalSnapshot,
  writeLocalSnapshot
};
