// /src/lib/localSync.js
// Reescritura simplificada y compatible (OPCIÓN B)
// Sincronización local <-> Upstash (vía endpoints internos /api/kv/* en Vercel)

// NOTA: Este archivo asume que tienes dos endpoints en /api/kv:
//  - GET:  /api/kv/get?key=<key>       -> devuelve { result: ... }
//  - POST: /api/kv/set  (body: { key, value }) -> devuelve OK
// Mantiene compatibilidad con tus claves: SNAPSHOT_KEY, CHANGES_INDEX_KEY, CHANGE_PREFIX

import { v4 as uuidv4 } from "uuid";

/* ===== CONFIG / KEYS ===== */
const SNAPSHOT_KEY = "localstorage_snapshot_v1";
const CHANGES_INDEX_KEY = "changes_index_v1";
const CHANGE_PREFIX = "change_v1:";

// local storage primary key (tu snapshot global)
const LOCAL_SNAPSHOT_KEY = "APP_DATA_2025";
const LOCAL_LAST_CHANGE_INDEX = "local_last_change_index_v1";

const MAX_PAYLOAD_SIZE = 250_000;
const MAX_CHANGES_HISTORY = 200;

/* ===== CONTROL FLAGS ===== */
let isApplyingRemote = false; // evita recursión al aplicar cambios desde la nube

/* ===== HELPERS ===== */

function safeParse(raw, fallback = {}) {
  if (!raw) return fallback;
  try { return typeof raw === "string" ? JSON.parse(raw) : raw; } catch { return fallback; }
}

function getCircularReplacer() {
  const seen = new WeakSet();
  return (k, v) => {
    if (typeof v === "object" && v !== null) {
      if (seen.has(v)) return "[Circular]";
      seen.add(v);
    }
    if (typeof v === "function") return undefined;
    return v;
  };
}

function safeSerialize(obj) {
  try {
    return JSON.stringify(obj, getCircularReplacer());
  } catch (e) {
    // último recurso: intenta un JSON simple
    try { return JSON.stringify(JSON.parse(JSON.stringify(obj))); } catch { return null; }
  }
}

/* ===== API (endpoints Vercel) ===== */

async function readCloudKey(key) {
  try {
    const res = await fetch(`/api/kv/get?key=${encodeURIComponent(key)}`, { method: "GET" });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`GET ${key} -> ${res.status} ${txt.slice(0,200)}`);
    }
    const json = await res.json().catch(() => ({}));
    return json?.result ?? null;
  } catch (err) {
    console.error("readCloudKey error", key, err && err.message ? err.message : err);
    return null;
  }
}

async function writeCloudKey(key, value) {
  try {
    const payload = typeof value === "string" ? value : safeSerialize(value);
    if (payload === null) throw new Error("Payload not serializable");

    if (payload.length > MAX_PAYLOAD_SIZE) {
      console.warn("writeCloudKey: payload exceeds MAX_PAYLOAD_SIZE, skipping", key);
      return false;
    }

    const res = await fetch(`/api/kv/set`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, value: payload })
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`SET ${key} -> ${res.status} ${txt.slice(0,200)}`);
    }
    return true;
  } catch (err) {
    console.error("writeCloudKey error", key, err && err.message ? err.message : err);
    return false;
  }
}

/* ===== LOCAL SNAPSHOT ===== */

export function readLocalSnapshot() {
  try {
    const raw = localStorage.getItem(LOCAL_SNAPSHOT_KEY);
    return raw ? safeParse(raw, {}) : {};
  } catch {
    return {};
  }
}

export function writeLocalSnapshot(obj) {
  try {
    // evitar autoPush durante escritura del snapshot
    window.__localSync__?.suspendAutoPush(true);
    const s = safeSerialize(obj);
    if (s === null) throw new Error("writeLocalSnapshot: not serializable");
    localStorage.setItem(LOCAL_SNAPSHOT_KEY, s);

    // notificar a listeners (hooks React usan este evento para evitar loops)
    try { window.dispatchEvent(new Event("local-sync-changed")); } catch (e) {}
  } catch (err) {
    console.error("writeLocalSnapshot error", err && err.message ? err.message : err);
  } finally {
    window.__localSync__?.suspendAutoPush(false);
  }
}

/* ===== BOOTSTRAP =====
   - Intenta restaurar SNAPSHOT_KEY desde la nube
   - Luego aplica los cambios listados en CHANGES_INDEX_KEY (si existen)
   - Mantiene backward compat: si no hay snapshot, crea uno vacío
*/
export async function bootstrapIfNeeded() {
  try {
    // si local ya tiene snapshot, no sobrescribimos (evita pérdida de datos locales)
    const local = localStorage.getItem(LOCAL_SNAPSHOT_KEY);
    if (local) {
      // sincroniza índice local con cloud index length si existe
      const idxArr = safeParse(await readCloudKey(CHANGES_INDEX_KEY), []);
      localStorage.setItem(LOCAL_LAST_CHANGE_INDEX, String(idxArr.length || 0));
      console.log("Bootstrap ya realizado (tenías snapshot local).");
      return;
    }

    // 1) Attempt to read server snapshot (SNAPSHOT_KEY)
    const remoteSnapshot = safeParse(await readCloudKey(SNAPSHOT_KEY), null);
    if (remoteSnapshot && Object.keys(remoteSnapshot).length) {
      isApplyingRemote = true;
      writeLocalSnapshot(remoteSnapshot);
      isApplyingRemote = false;
      console.log("Bootstrap: snapshot remota aplicada.");
    } else {
      // 2) If no snapshot, attempt to rebuild from changes index
      const idxArr = safeParse(await readCloudKey(CHANGES_INDEX_KEY), []);
      if (Array.isArray(idxArr) && idxArr.length) {
        let aggregated = {};
        for (const id of idxArr) {
          const ch = safeParse(await readCloudKey(CHANGE_PREFIX + id), {});
          aggregated = { ...aggregated, ...ch };
        }
        isApplyingRemote = true;
        writeLocalSnapshot(aggregated);
        isApplyingRemote = false;
        console.log("Bootstrap: reconstruido desde changes_index.");
        localStorage.setItem(LOCAL_LAST_CHANGE_INDEX, String(idxArr.length));
      } else {
        // nothing remote -> start empty snapshot
        writeLocalSnapshot({});
        localStorage.setItem(LOCAL_LAST_CHANGE_INDEX, "0");
        console.log("Bootstrap: no había datos remotos, snapshot local vacío creado.");
      }
    }
  } catch (err) {
    console.error("bootstrapIfNeeded error", err && err.message ? err.message : err);
  }
}

/* ===== CLEANUP (mantener el índice acotado) ===== */
async function cleanupOldChanges(idxArr) {
  if (!Array.isArray(idxArr)) return [];
  if (idxArr.length <= MAX_CHANGES_HISTORY) return idxArr;
  const removeCount = idxArr.length - MAX_CHANGES_HISTORY;
  for (let i = 0; i < removeCount; i++) {
    const oldId = idxArr[i];
    await writeCloudKey(CHANGE_PREFIX + oldId, "{}");
  }
  return idxArr.slice(removeCount);
}

/* ===== PUSH INCREMENTAL (simple y compatible) =====
   - Detecta diferencias entre snapshot y incoming changeObj
   - Guarda incremental en CHANGE_PREFIX + id
   - Actualiza CHANGES_INDEX_KEY (array)
   - También actualiza SNAPSHOT_KEY con snapshot completa (compatibilidad)
*/
export async function pushChangeLocalAndCloud(changeObj) {
  try {
    if (!changeObj || typeof changeObj !== "object") return false;

    // bloquea autoPush desde interceptor
    window.__localSync__?.suspendAutoPush(true);

    const snapshot = readLocalSnapshot();
    const incremental = {};
    Object.entries(changeObj).forEach(([k, v]) => {
      if (JSON.stringify(snapshot[k]) !== JSON.stringify(v)) incremental[k] = v;
    });

    if (!Object.keys(incremental).length) return false;

    // 1) actualizar snapshot local
    const newSnapshot = { ...snapshot, ...incremental };
    writeLocalSnapshot(newSnapshot);

    // 2) guardar incremental en cloud
    const id = `${Date.now()}-${uuidv4()}`;
    const okChange = await writeCloudKey(CHANGE_PREFIX + id, incremental);
    if (!okChange) {
      console.warn("pushChangeLocalAndCloud: fallo al escribir cambio incremental en cloud");
      return false;
    }

    // 3) actualizar índice
    let idxArr = safeParse(await readCloudKey(CHANGES_INDEX_KEY), []);
    if (!Array.isArray(idxArr)) idxArr = [];
    idxArr.push(id);
    idxArr = await cleanupOldChanges(idxArr);
    const okIdx = await writeCloudKey(CHANGES_INDEX_KEY, idxArr);
    if (!okIdx) {
      console.warn("pushChangeLocalAndCloud: fallo al actualizar CHANGES_INDEX_KEY");
      return false;
    }

    // 4) guardar snapshot completo en SNAPSHOT_KEY (compatibilidad)
    await writeCloudKey(SNAPSHOT_KEY, newSnapshot);

    // 5) actualizar local last index
    localStorage.setItem(LOCAL_LAST_CHANGE_INDEX, String(idxArr.length));

    console.log("[localSync] pushChangeLocalAndCloud: cambio subido, id=", id);
    return true;
  } catch (err) {
    console.error("pushChangeLocalAndCloud error", err && err.message ? err.message : err);
    return false;
  } finally {
    window.__localSync__?.suspendAutoPush(false);
  }
}

/* ===== FETCH + APLICAR NUEVOS CAMBIOS =====
   - Lee CHANGES_INDEX_KEY desde cloud
   - Aplica solo los cambios nuevos (según local_last_change_index_v1)
*/
export async function fetchAndApplyNewCloudChanges() {
  try {
    const idxArr = safeParse(await readCloudKey(CHANGES_INDEX_KEY), []);
    if (!Array.isArray(idxArr) || !idxArr.length) return;

    const lastLocal = Number(localStorage.getItem(LOCAL_LAST_CHANGE_INDEX) || "0");
    if (lastLocal >= idxArr.length) return;

    let snapshot = readLocalSnapshot();
    for (let i = lastLocal; i < idxArr.length; i++) {
      const id = idxArr[i];
      const changeObj = safeParse(await readCloudKey(CHANGE_PREFIX + id), {});
      if (!changeObj || typeof changeObj !== "object") continue;
      snapshot = { ...snapshot, ...changeObj };
      // aplicar progresivamente para evitar objetos gigantes en memoria
      isApplyingRemote = true;
      writeLocalSnapshot(snapshot);
      isApplyingRemote = false;
    }

    localStorage.setItem(LOCAL_LAST_CHANGE_INDEX, String(idxArr.length));
    console.log("[localSync] fetchAndApplyNewCloudChanges: aplicados cambios remotos hasta index", idxArr.length);
  } catch (err) {
    console.error("fetchAndApplyNewCloudChanges error", err && err.message ? err.message : err);
  }
}

/* ===== WATCHER ===== */
let _watcher = null;
export function startCloudWatcher(intervalMs = 2000) {
  stopCloudWatcher();
  _watcher = setInterval(() => fetchAndApplyNewCloudChanges().catch(() => {}), intervalMs);
  // y lanzar uno ahora mismo
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

/* ===== INTERCEPTOR LOCALSTORAGE (SEGURIZADO) =====
   - Override setItem pero con protecciones:
     · suspendAutoPush flag
     · isApplyingRemote global
     · suspendedKeys por key para evitar reentradas
*/
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
        !isApplyingRemote &&
        !suspendedKeys.has(key)
      ) {
        suspendedKeys.add(key);

        // llamar autoPush (no bloqueante)
        window.__localSync__.autoPush(key, value)
          .finally(() => suspendedKeys.delete(key))
          .catch(err => console.warn("[localSync] autoPush error:", err));
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
      // Solo nos interesan cambios en APP_DATA_2025 (evitar ruido)
      if (key !== LOCAL_SNAPSHOT_KEY) return;

      // parsear valor (puede ser string con JSON)
      let parsed;
      try { parsed = typeof rawValue === "string" ? JSON.parse(rawValue) : rawValue; } catch { parsed = rawValue; }

      await pushChangeLocalAndCloud({ [LOCAL_SNAPSHOT_KEY]: parsed });
      console.log("[localSync] Cambio detectado y subido:", key);
    } catch (e) {
      console.warn("[localSync] Error enviando cambio incremental:", e && e.message ? e.message : e);
    }
  },

  suspendAutoPush(flag) {
    this._suspended = !!flag;
  },

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
  writeLocalSnapshot
};
