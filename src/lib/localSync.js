// /src/lib/localSync.js
// Sincronización incremental local <-> Upstash

import { v4 as uuidv4 } from "uuid";

/* ===== CONFIG ===== */
const UPSTASH_URL = import.meta.env.VITE_UPSTASH_URL || "https://together-grouper-32531.upstash.io";
const UPSTASH_TOKEN = import.meta.env.VITE_UPSTASH_TOKEN || "AX8TAAIncDIxMTQzMmQ2ZDdlMzE0OWIwOTllNDA4ODhmNzZlNzRhMXAyMzI1MzE";

/* ===== KEYS ===== */
const SNAPSHOT_KEY = "localstorage_snapshot_v1";
const CHANGES_INDEX_KEY = "changes_index_v1";
const CHANGE_PREFIX = "change_v1:";

/* ===== LOCAL ===== */
const LOCAL_STORAGE_BOOTSTRAP_FLAG = "bootstrapped_v1";
const LOCAL_LAST_CHANGE_INDEX = "local_last_change_index_v1";
const MAX_PAYLOAD_SIZE = 250_000;
const MAX_CHANGES_HISTORY = 200;

/* ===== UTILS ===== */
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
    const res = await fetch(`/api/kv/get?key=${encodeURIComponent(key)}`);
    const json = await res.json();
    return json.result ?? null;
  } catch (err) {
    console.error("readCloudKey error", key, err);
    return null;
  }
}


async function writeCloudKey(key, value) {
  try {
    const res = await fetch(`/api/kv/set`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, value })
    });
    return res.ok;
  } catch (err) {
    console.error("writeCloudKey error", key, err);
    return false;
  }
}


// Divide objetos grandes en partes
async function writeLargePayload(keyPrefix, obj) {
  const entries = Object.entries(obj);
  let batch = {};
  let batchSize = 0;
  let batchIndex = 0;

  for (const [k, v] of entries) {
    const str = JSON.stringify({ [k]: v });
    if (str.length + batchSize > MAX_PAYLOAD_SIZE) {
      await writeCloudKey(`${keyPrefix}_${batchIndex}`, batch);
      batch = {};
      batchSize = 0;
      batchIndex++;
    }
    batch[k] = v;
    batchSize += str.length;
  }

  if (Object.keys(batch).length) {
    await writeCloudKey(`${keyPrefix}_${batchIndex}`, batch);
  }

  return true;
}

function safeParse(raw, defaultValue = {}) {
  if (!raw) return defaultValue;
  if (typeof raw === "string") {
    try { return JSON.parse(raw); } catch { return defaultValue; }
  }
  return raw;
}

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

/* ===== LOCAL SNAPSHOT ===== */
export function readLocalSnapshot() {
  try {
    const raw = localStorage.getItem("APP_DATA_2025");
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

export function writeLocalSnapshot(obj) {
  try {
    window.__localSync__.suspendAutoPush(true); // ← bloqueo recursión
    localStorage.setItem("APP_DATA_2025", JSON.stringify(obj, getCircularReplacer()));
  } catch (err) {
    console.error("writeLocalSnapshot error", err);
  } finally {
    window.__localSync__.suspendAutoPush(false);
  }
}

/* ===== BOOTSTRAP ===== */
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
  } catch (err) { console.error("bootstrapIfNeeded error", err); }
}

/* ===== LIMPIEZA ===== */
async function cleanupOldChanges(idxArr) {
  if (idxArr.length <= MAX_CHANGES_HISTORY) return idxArr;
  const removeCount = idxArr.length - MAX_CHANGES_HISTORY;

  for (let i = 0; i < removeCount; i++) {
    const oldId = idxArr[i];
    await writeCloudKey(CHANGE_PREFIX + oldId, {});
  }

  return idxArr.slice(removeCount);
}

/* ===== PUSH INCREMENTAL ===== */
export async function pushChangeLocalAndCloud(changeObj) {
  try {
    if (!changeObj || typeof changeObj !== "object") return false;

    window.__localSync__.suspendAutoPush(true);

    const snapshot = readLocalSnapshot();
    const incremental = {};

    Object.entries(changeObj).forEach(([k, v]) => {
      if (JSON.stringify(snapshot[k]) !== JSON.stringify(v)) {
        incremental[k] = v;
      }
    });

    if (!Object.keys(incremental).length) return false;

    writeLocalSnapshot({ ...snapshot, ...incremental });

    const id = `${Date.now()}-${uuidv4()}`;
    await writeCloudKey(CHANGE_PREFIX + id, incremental);

    let idxArr = safeParse(await readCloudKey(CHANGES_INDEX_KEY), []);
    idxArr.push(id);
    idxArr = await cleanupOldChanges(idxArr);
    await writeCloudKey(CHANGES_INDEX_KEY, idxArr);

    localStorage.setItem(LOCAL_LAST_CHANGE_INDEX, String(idxArr.length));

    return true;

  } catch (err) {
    console.error("pushChangeLocalAndCloud error", err);
    return false;

  } finally {
    window.__localSync__.suspendAutoPush(false);
  }
}

/* ===== DESCARGA DE CAMBIOS ===== */
export async function fetchAndApplyNewCloudChanges() {
  try {
    const idxArr = safeParse(await readCloudKey(CHANGES_INDEX_KEY), []);
    if (!Array.isArray(idxArr) || !idxArr.length) return;

    const lastLocal = Number(localStorage.getItem(LOCAL_LAST_CHANGE_INDEX) || "0");
    if (lastLocal >= idxArr.length) return;

    for (let i = lastLocal; i < idxArr.length; i++) {
      const id = idxArr[i];
      const changeObj = safeParse(await readCloudKey(CHANGE_PREFIX + id), {});
      if (!changeObj || typeof changeObj !== "object") continue;

      const snapshot = readLocalSnapshot();
      writeLocalSnapshot({ ...snapshot, ...changeObj });
    }

    localStorage.setItem(LOCAL_LAST_CHANGE_INDEX, String(idxArr.length));
  } catch (err) {
    console.error("fetchAndApplyNewCloudChanges error", err);
  }
}

/* ===== WATCHER ===== */
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

/* ===== INTERCEPTOR DE localStorage.setItem ===== */
(function () {
  const originalSetItem = localStorage.setItem;
  const suspendedKeys = new Set();

  localStorage.setItem = function (key, value) {
    originalSetItem.apply(this, arguments);

    if (
      window.__localSync__?.autoPush &&
      !window.__localSync__._suspended &&    // ← *EVITA RECURSIÓN*
      !suspendedKeys.has(key)
    ) {
      suspendedKeys.add(key);

      window.__localSync__.autoPush(key, value)
        .finally(() => suspendedKeys.delete(key))
        .catch(err => console.warn("[localSync] autoPush error:", err));
    }
  };
})();

/* ===== AUTOPUSH ===== */
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

  _suspended: false,
};

/* ===== EXPORT DEFAULT ===== */
export default {
  bootstrapIfNeeded,
  pushChangeLocalAndCloud,
  fetchAndApplyNewCloudChanges,
  startCloudWatcher,
  stopCloudWatcher,
  readLocalSnapshot,
  writeLocalSnapshot,
};
