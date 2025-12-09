// /src/lib/localSync.js
// Sincronización incremental local <-> Upstash (versión robusta, maneja 405/HTML y objetos no-serializables)

import { v4 as uuidv4 } from "uuid";

/* ===== CONFIG ===== */
const UPSTASH_URL = import.meta.env.VITE_UPSTASH_URL || "https://together-grouper-32531.upstash.io";
const UPSTASH_TOKEN = import.meta.env.VITE_UPSTASH_TOKEN || ""; // pon tu token en .env

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

/* ===== HELPERS ===== */
function safeParse(raw, fallback = {}) {
  if (!raw) return fallback;
  try { return typeof raw === "string" ? JSON.parse(raw) : raw; } catch { return fallback; }
}

/**
 * Intento rápido de JSON.stringify; si falla, sanea el objeto (filtra funciones/DOM, corta profundidad)
 * Devuelve string JSON o throws si no pudo serializar.
 */
function safeSerialize(obj, maxDepth = 6) {
  try {
    return JSON.stringify(obj, getCircularReplacer());
  } catch (e) {
    // fallback: deep-copy permitiendo solo tipos serializables y limitando profundidad
    const seen = new WeakSet();
    function sanitize(value, depth) {
      if (depth > maxDepth) return "[MaxDepth]";
      if (value === null) return null;
      const t = typeof value;
      if (t === "string" || t === "number" || t === "boolean") return value;
      if (t === "undefined" || t === "function" || t === "symbol") return undefined;
      if (value instanceof Date) return value.toISOString();
      if (value instanceof RegExp) return value.toString();
      if (Array.isArray(value)) return value.map(v => sanitize(v, depth + 1)).filter(v => typeof v !== "undefined");
      if (t === "object") {
        if (seen.has(value)) return "[Circular]";
        seen.add(value);
        const out = {};
        for (const [k, v] of Object.entries(value)) {
          try {
            const s = sanitize(v, depth + 1);
            if (typeof s !== "undefined") out[k] = s;
          } catch { /* skip */ }
        }
        return out;
      }
      return undefined;
    }
    const cleaned = sanitize(obj, 0);
    return JSON.stringify(cleaned);
  }
}

function getCircularReplacer() {
  const seen = new WeakSet();
  return (key, value) => {
    if (typeof value === "object" && value !== null) {
      if (seen.has(value)) return "[Circular]";
      seen.add(value);
    }
    // strip window/document and functions explicitly
    if (value === window || value === document) return "[WindowOrDocument]";
    if (typeof value === "function") return undefined;
    return value;
  };
}

/* ===== HTTP helpers (manejando respuestas HTML/405) ===== */
async function fetchWithAuth(url, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (UPSTASH_TOKEN) headers.Authorization = `Bearer ${UPSTASH_TOKEN}`;
  const resp = await fetch(url, { ...options, headers });

  // Si devuelve HTML (p.ej. página de error), leer como texto y lanzar
  const contentType = resp.headers.get("content-type") || "";
  const bodyText = await resp.text();
  if (!resp.ok) {
    const snippet = bodyText.slice(0, 300);
    const err = new Error(`HTTP ${resp.status}: ${snippet}`);
    err.status = resp.status;
    throw err;
  }

  // Intentar parsear JSON; si no es JSON, devolver texto
  if (contentType.includes("application/json") || bodyText.trim().startsWith("{") || bodyText.trim().startsWith("[")) {
    try { return JSON.parse(bodyText); } catch (e) {
      // respuesta malformada
      throw new Error("Invalid JSON from server");
    }
  } else {
    // HTML or plain text
    throw new Error("Unexpected non-JSON response from server: " + (bodyText.slice(0, 200)));
  }
}

async function readCloudKey(key) {
  try {
    // Upstash REST expects lowercase paths: /get/<key>
    const url = `${UPSTASH_URL.replace(/\/$/, "")}/get/${encodeURIComponent(key)}`;
    const json = await fetchWithAuth(url, { method: "GET" });
    // Upstash returns { result: ... }
    return json?.result ?? null;
  } catch (err) {
    console.error("readCloudKey", key, err.message || err);
    return null;
  }
}

async function writeCloudKey(key, value) {
  try {
    const payload = safeSerialize(value);
    if (payload.length > MAX_PAYLOAD_SIZE) {
      return await writeLargePayload(key, value);
    }

    // Upstash REST: POST to /set/<key> with body = JSON string
    const url = `${UPSTASH_URL.replace(/\/$/, "")}/set/${encodeURIComponent(key)}`;
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: UPSTASH_TOKEN ? `Bearer ${UPSTASH_TOKEN}` : undefined,
        "Content-Type": "application/json",
      },
      body: payload,
    });

    // handle non-OK or non-json (405 will be non-ok; may return HTML)
    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      throw new Error(`writeCloudKey HTTP ${resp.status} - ${text.slice(0, 300)}`);
    }

    // try parse json result or ignore
    try {
      const j = await resp.json().catch(() => null);
      return !!j;
    } catch {
      return true;
    }
  } catch (err) {
    console.error("writeCloudKey", key, err.message || err);
    return false;
  }
}

async function writeLargePayload(keyPrefix, obj) {
  // Fraccionar por entradas (no por bytes perfectos, pero evita payload > MAX)
  const entries = Object.entries(obj);
  let batch = {};
  let batchSize = 0;
  let batchIndex = 0;

  for (const [k, v] of entries) {
    const str = safeSerialize({ [k]: v });
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
    window.__localSync__ && window.__localSync__.suspendAutoPush(true);
    localStorage.setItem("APP_DATA_2025", safeSerialize(obj));
    // Notificar a listeners (tu hook React debe escuchar este evento)
    try { window.dispatchEvent(new Event("local-sync-changed")); } catch {}
  } catch (err) {
    console.error("writeLocalSnapshot", err && err.message ? err.message : err);
  } finally {
    window.__localSync__ && window.__localSync__.suspendAutoPush(false);
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

    const snapObj = safeParse(await readCloudKey(SNAPSHOT_KEY), {});
    for (const [k, v] of Object.entries(snapObj)) {
      try { localStorage.setItem(k, safeSerialize(v)); } catch {}
    }

    const idxArr = safeParse(await readCloudKey(CHANGES_INDEX_KEY), []);
    for (const id of idxArr) {
      const changeObj = safeParse(await readCloudKey(CHANGE_PREFIX + id), {});
      for (const [k, v] of Object.entries(changeObj)) {
        try { localStorage.setItem(k, safeSerialize(v)); } catch {}
      }
    }

    localStorage.setItem(LOCAL_STORAGE_BOOTSTRAP_FLAG, "yes");
    localStorage.setItem(LOCAL_LAST_CHANGE_INDEX, String(idxArr.length || 0));
    console.log("Bootstrap completado y watcher iniciado.");
    // notificar
    try { window.dispatchEvent(new Event("local-sync-changed")); } catch {}
  } catch (err) {
    console.error("bootstrapIfNeeded error", err && err.message ? err.message : err);
  } finally {
    isBootstrapping = false;
  }
}

/* ===== LIMPIEZA ===== */
async function cleanupOldChanges(idxArr) {
  if (!Array.isArray(idxArr)) return [];
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
    window.__localSync__ && window.__localSync__.suspendAutoPush(true);

    const snapshot = readLocalSnapshot();
    const incremental = {};
    for (const [k, v] of Object.entries(changeObj)) {
      if (JSON.stringify(snapshot[k]) !== JSON.stringify(v)) incremental[k] = v;
    }
    if (!Object.keys(incremental).length) return false;

    writeLocalSnapshot({ ...snapshot, ...incremental });

    const id = `${Date.now()}-${uuidv4()}`;
    const ok = await writeCloudKey(CHANGE_PREFIX + id, incremental);
    if (!ok) {
      console.warn("pushChange: writeCloudKey failed, aborting index update");
      return false;
    }

    let idxArr = safeParse(await readCloudKey(CHANGES_INDEX_KEY), []);
    idxArr.push(id);
    idxArr = await cleanupOldChanges(idxArr);
    const idxOk = await writeCloudKey(CHANGES_INDEX_KEY, idxArr);
    if (!idxOk) {
      console.warn("pushChange: failed updating CHANGES_INDEX_KEY");
      return false;
    }

    localStorage.setItem(LOCAL_LAST_CHANGE_INDEX, String(idxArr.length));
    return true;
  } catch (err) {
    console.error("pushChangeLocalAndCloud error", err && err.message ? err.message : err);
    return false;
  } finally {
    window.__localSync__ && window.__localSync__.suspendAutoPush(false);
  }
}

/* ===== FETCH Y APLICAR CAMBIOS ===== */
export async function fetchAndApplyNewCloudChanges() {
  try {
    if (isBootstrapping) return;
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
    // notificar
    try { window.dispatchEvent(new Event("local-sync-changed")); } catch {}
  } catch (err) {
    console.error("fetchAndApplyNewCloudChanges", err && err.message ? err.message : err);
  }
}

/* ===== WATCHER ===== */
let _watcher = null;
export function startCloudWatcher(intervalMs = 2000) {
  stopCloudWatcher();
  _watcher = setInterval(() => fetchAndApplyNewCloudChanges().catch(err => {
    console.warn("watcher fetch error", err && err.message ? err.message : err);
  }), intervalMs);
  fetchAndApplyNewCloudChanges().catch(() => {});
  console.log("Cloud watcher started", intervalMs);
}
export function stopCloudWatcher() {
  if (_watcher) { clearInterval(_watcher); _watcher = null; console.log("Cloud watcher stopped"); }
}

/* ===== INTERCEPTOR localStorage.setItem ===== */
(function () {
  const originalSetItem = localStorage.setItem;
  const suspendedKeys = new Set();

  localStorage.setItem = function (key, value) {
    originalSetItem.apply(this, arguments);

    try {
      if (
        window.__localSync__ &&
        window.__localSync__.autoPush &&
        !window.__localSync__._suspended &&
        !suspendedKeys.has(key) &&
        !isBootstrapping
      ) {
        suspendedKeys.add(key);
        window.__localSync__.autoPush(key, value)
          .finally(() => suspendedKeys.delete(key))
          .catch(e => console.warn("[localSync] autoPush error:", e && e.message ? e.message : e));
      }
    } catch (e) {
      console.warn("setItem interceptor error", e && e.message ? e.message : e);
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
      console.warn("autoPush error:", e && e.message ? e.message : e);
    }
  },
  suspendAutoPush(flag) { this._suspended = flag; },
  _suspended: false,
};

/* ===== EXPORT ===== */
export default {
  bootstrapIfNeeded,
  pushChangeLocalAndCloud,
  fetchAndApplyNewCloudChanges,
  startCloudWatcher,
  stopCloudWatcher,
  readLocalSnapshot,
  writeLocalSnapshot,
};
