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

/* ====== SIZE LIMITS ====== */
const MAX_CHANGE_SIZE = 200_000; // 200 KB aprox por cambio

/* ====== UTILS ====== */
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
    const payload = JSON.stringify(value);
    if (payload.length > MAX_CHANGE_SIZE) {
      console.warn(`[localSync] Key ${key} skipped, payload too large (${payload.length} bytes)`);
      return false;
    }

    const url = `${UPSTASH_URL}/SET/${encodeURIComponent(key)}`;
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${UPSTASH_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: payload
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
  if (raw === undefined || raw === null) return defaultValue;
  if (typeof raw === "string") {
    try { return JSON.parse(raw); } catch { return defaultValue; }
  }
  return raw;
}

/* ====== LOCAL SNAPSHOT ====== */
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
    // Suspender autoPush para evitar recursión
    window.__localSync__?.suspendAutoPush(true);
    localStorage.setItem("APP_DATA_2025", JSON.stringify(obj));
  } catch (err) {
    console.error("writeLocalSnapshot error", err);
  } finally {
    window.__localSync__?.suspendAutoPush(false);
  }
}

/* ====== PUSH CAMBIO INCREMENTAL ====== */
export async function pushChangeLocalAndCloud(changeObj) {
  if (!changeObj || typeof changeObj !== "object") return false;

  try {
    window.__localSync__?.suspendAutoPush(true);

    // Eliminar cambios idénticos o demasiado grandes
    const currentSnapshot = readLocalSnapshot();
    const safeChange = {};
    for (const key in changeObj) {
      const str = JSON.stringify(changeObj[key]);
      if (str.length > MAX_CHANGE_SIZE) {
        console.warn(`[localSync] Skipping key ${key}, too large (${str.length} bytes)`);
        continue;
      }
      if (JSON.stringify(currentSnapshot[key]) !== str) {
        safeChange[key] = changeObj[key];
      }
    }

    if (!Object.keys(safeChange).length) return false;

    // Actualizar snapshot local
    const updated = { ...currentSnapshot, ...safeChange };
    writeLocalSnapshot(updated);

    // Subir cambio a Upstash
    const id = `${Date.now()}-${uuidv4()}`;
    const ok1 = await writeCloudKey(CHANGE_PREFIX + id, safeChange);
    if (!ok1) return false;

    // Actualizar índice de cambios
    const idxRaw = await readCloudKey(CHANGES_INDEX_KEY);
    const idxArr = safeParse(idxRaw, []);
    idxArr.push(id);
    await writeCloudKey(CHANGES_INDEX_KEY, idxArr);

    localStorage.setItem(LOCAL_LAST_CHANGE_INDEX, String(idxArr.length));
    return true;
  } catch (err) {
    console.error("pushChangeLocalAndCloud error", err);
    return false;
  } finally {
    window.__localSync__?.suspendAutoPush(false);
  }
}

/* ====== FETCH Y APLICAR CAMBIOS ====== */
export async function fetchAndApplyNewCloudChanges() {
  try {
    const idxRaw = await readCloudKey(CHANGES_INDEX_KEY);
    const idxArr = safeParse(idxRaw, []);
    if (!Array.isArray(idxArr) || !idxArr.length) return;

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

/* ====== BOOTSTRAP ====== */
export async function bootstrapIfNeeded() {
  try {
    if (localStorage.getItem(LOCAL_STORAGE_BOOTSTRAP_FLAG) === "yes") {
      const idx = await readCloudKey(CHANGES_INDEX_KEY);
      const arr = safeParse(idx, []);
      localStorage.setItem(LOCAL_LAST_CHANGE_INDEX, String(arr.length || 0));
      console.log("Bootstrap ya realizado.");
      return;
    }

    // Cargar snapshot completo
    const snapRaw = await readCloudKey(SNAPSHOT_KEY);
    const snapObj = safeParse(snapRaw, {});
    Object.keys(snapObj).forEach(k => {
      try { localStorage.setItem(k, JSON.stringify(snapObj[k])); } catch {}
    });

    // Aplicar cambios incrementales
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

/* ====== WATCHER ====== */
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

/* ====== AUTO SYNC (sin recursión) ====== */
(function () {
  const originalSetItem = localStorage.setItem;
  const suspendedKeys = new Set();

  localStorage.setItem = function (key, value) {
    originalSetItem.apply(this, arguments);
    if (window.__localSync__?.autoPush && !suspendedKeys.has(key) && !window.__localSync__._suspended) {
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
  suspendAutoPush(flag) { this._suspended = flag; },
  _suspended: false
};

/* ====== EXPORTS ====== */
export default {
  bootstrapIfNeeded,
  pushChangeLocalAndCloud,
  fetchAndApplyNewCloudChanges,
  startCloudWatcher,
  stopCloudWatcher,
  readLocalSnapshot,
  writeLocalSnapshot
};
