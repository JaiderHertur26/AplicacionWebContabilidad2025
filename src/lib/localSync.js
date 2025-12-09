// /src/lib/localSync.js
// Sincronización incremental local <-> Upstash (versión optimizada y estable)

import { v4 as uuidv4 } from "uuid";

/* ===== CONFIG ===== */
const UPSTASH_URL = import.meta.env.VITE_UPSTASH_URL;
const UPSTASH_TOKEN = import.meta.env.VITE_UPSTASH_TOKEN;

/* ===== KEYS ===== */
const SNAPSHOT_KEY = "localstorage_snapshot_v1";
const CHANGES_INDEX_KEY = "changes_index_v1";
const CHANGE_PREFIX = "change_v1:";

/* ===== LOCAL KEYS ===== */
const LOCAL_STORAGE_BOOTSTRAP_FLAG = "bootstrapped_v1";
const LOCAL_LAST_CHANGE_INDEX = "local_last_change_index_v1";

const MAX_PAYLOAD_SIZE = 250_000;
const MAX_CHANGES_HISTORY = 200;

/* ===== FLAGS DE CONTROL ===== */
let isBootstrapping = false;

/* ===== UTILS ===== */
function safeParse(raw, fallback = {}) {
  if (!raw) return fallback;
  try {
    return typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch {
    return fallback;
  }
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

async function fetchJSON(url, options = {}) {
  const headers = { ...(options.headers || {}), Authorization: `Bearer ${UPSTASH_TOKEN}` };
  const resp = await fetch(url, { ...options, headers });

  if (!resp.ok) throw new Error(`HTTP ${resp.status} - ${await resp.text()}`);
  return resp.json();
}

async function readCloudKey(key) {
  try {
    const url = `${UPSTASH_URL}/GET/${encodeURIComponent(key)}`;
    const json = await fetchJSON(url, { method: "GET" });
    return json.result ?? null;
  } catch (err) {
    console.error("readCloudKey", key, err);
    return null;
  }
}

async function writeCloudKey(key, value) {
  try {
    const payload = JSON.stringify(value, getCircularReplacer());

    if (payload.length > MAX_PAYLOAD_SIZE)
      return await writeLargePayload(key, value);

    const url = `${UPSTASH_URL}/SET/${encodeURIComponent(key)}`;
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${UPSTASH_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: payload,
    });

    if (!resp.ok) throw new Error(await resp.text());
    return true;
  } catch (err) {
    console.error("writeCloudKey", key, err);
    return false;
  }
}

async function writeLargePayload(prefix, obj) {
  const entries = Object.entries(obj);
  let batch = {};
  let size = 0;
  let idx = 0;

  for (const [k, v] of entries) {
    const chunk = JSON.stringify({ [k]: v });
    if (size + chunk.length > MAX_PAYLOAD_SIZE) {
      await writeCloudKey(`${prefix}_${idx}`, batch);
      batch = {};
      size = 0;
      idx++;
    }
    batch[k] = v;
    size += chunk.length;
  }

  if (Object.keys(batch).length)
    await writeCloudKey(`${prefix}_${idx}`, batch);

  return true;
}

/* ===== LOCAL SNAPSHOT ===== */
export function readLocalSnapshot() {
  try {
    return safeParse(localStorage.getItem("APP_DATA_2025"), {});
  } catch {
    return {};
  }
}

export function writeLocalSnapshot(obj) {
  try {
    window.__localSync__.suspendAutoPush(true);
    localStorage.setItem(
      "APP_DATA_2025",
      JSON.stringify(obj, getCircularReplacer())
    );
  } catch (err) {
    console.error("writeLocalSnapshot", err);
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

    isBootstrapping = true;

    // 1. Snapshot base
    const snapObj = safeParse(await readCloudKey(SNAPSHOT_KEY), {});
    for (const [k, v] of Object.entries(snapObj)) {
      try {
        localStorage.setItem(k, JSON.stringify(v));
      } catch {}
    }

    // 2. Cambios acumulados
    const idxArr = safeParse(await readCloudKey(CHANGES_INDEX_KEY), []);
    for (const id of idxArr) {
      const ch = safeParse(await readCloudKey(CHANGE_PREFIX + id), {});
      for (const [k, v] of Object.entries(ch)) {
        try {
          localStorage.setItem(k, JSON.stringify(v));
        } catch {}
      }
    }

    localStorage.setItem(LOCAL_STORAGE_BOOTSTRAP_FLAG, "yes");
    localStorage.setItem(LOCAL_LAST_CHANGE_INDEX, String(idxArr.length));

    console.log("Bootstrap completado.");
  } catch (e) {
    console.error("bootstrapIfNeeded error", e);
  } finally {
    isBootstrapping = false;
  }
}

/* ===== LIMPIEZA ===== */
async function cleanupOldChanges(idxArr) {
  if (idxArr.length <= MAX_CHANGES_HISTORY) return idxArr;

  const extra = idxArr.length - MAX_CHANGES_HISTORY;
  for (let i = 0; i < extra; i++)
    await writeCloudKey(CHANGE_PREFIX + idxArr[i], {});

  return idxArr.slice(extra);
}

/* ===== PUSH INCREMENTAL ===== */
export async function pushChangeLocalAndCloud(changeObj) {
  if (!changeObj || typeof changeObj !== "object") return false;

  try {
    window.__localSync__.suspendAutoPush(true);

    const prev = readLocalSnapshot();
    const incremental = {};

    // Detectar diferencias reales
    for (const [k, v] of Object.entries(changeObj)) {
      const a = JSON.stringify(prev[k]);
      const b = JSON.stringify(v);
      if (a !== b) incremental[k] = v;
    }

    if (!Object.keys(incremental).length)
      return false;

    // 1. Escribir local
    writeLocalSnapshot({ ...prev, ...incremental });

    // 2. Escribir cambio incremental en cloud
    const id = `${Date.now()}-${uuidv4()}`;
    await writeCloudKey(CHANGE_PREFIX + id, incremental);

    // 3. Actualizar índice
    let idxArr = safeParse(await readCloudKey(CHANGES_INDEX_KEY), []);
    idxArr.push(id);
    idxArr = await cleanupOldChanges(idxArr);
    await writeCloudKey(CHANGES_INDEX_KEY, idxArr);

    localStorage.setItem(LOCAL_LAST_CHANGE_INDEX, String(idxArr.length));

    return true;
  } catch (e) {
    console.error("pushChangeLocalAndCloud", e);
    return false;
  } finally {
    window.__localSync__.suspendAutoPush(false);
  }
}

/* ===== FETCH DE CAMBIOS ===== */
export async function fetchAndApplyNewCloudChanges() {
  try {
    if (isBootstrapping) return;

    const idxArr = safeParse(await readCloudKey(CHANGES_INDEX_KEY), []);
    const last = Number(localStorage.getItem(LOCAL_LAST_CHANGE_INDEX) || "0");

    if (last >= idxArr.length) return;

    for (let i = last; i < idxArr.length; i++) {
      const id = idxArr[i];
      const changeObj = safeParse(await readCloudKey(CHANGE_PREFIX + id), {});
      if (!changeObj || typeof changeObj !== "object") continue;

      const prev = readLocalSnapshot();
      writeLocalSnapshot({ ...prev, ...changeObj });
    }

    localStorage.setItem(LOCAL_LAST_CHANGE_INDEX, String(idxArr.length));
  } catch (err) {
    console.error("fetchAndApplyNewCloudChanges", err);
  }
}

/* ===== WATCHER ===== */
let _watcher = null;

export function startCloudWatcher(intervalMs = 2000) {
  stopCloudWatcher();
  _watcher = setInterval(() => fetchAndApplyNewCloudChanges(), intervalMs);
  fetchAndApplyNewCloudChanges();
  console.log("Cloud watcher started", intervalMs);
}

export function stopCloudWatcher() {
  if (_watcher) {
    clearInterval(_watcher);
    _watcher = null;
    console.log("Cloud watcher stopped");
  }
}

/* ===== INTERCEPTOR localStorage.setItem ===== */
(function () {
  const originalSetItem = localStorage.setItem;
  const suspendedKeys = new Set();

  localStorage.setItem = function (key, value) {
    originalSetItem.apply(this, arguments);

    if (
      window.__localSync__.autoPush &&
      !window.__localSync__._suspended &&
      !suspendedKeys.has(key) &&
      !isBootstrapping
    ) {
      suspendedKeys.add(key);

      window.__localSync__.autoPush(key, value)
        .finally(() => suspendedKeys.delete(key));
    }
  };
})();

/* ===== AUTOPUSH ===== */
window.__localSync__ = {
  autoPush: async (key, rawValue) => {
    try {
      const value = safeParse(rawValue, rawValue);
      await pushChangeLocalAndCloud({ [key]: value });
      console.log("[localSync] cambio subido:", key);
    } catch (e) {
      console.warn("autoPush error:", e);
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
