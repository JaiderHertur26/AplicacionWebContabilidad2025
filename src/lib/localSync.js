// src/lib/localSync.js
// Cliente de sincronización local <-> nube (Upstash a través de /api/sync/*)
// Comportamiento: siempre bootstrap desde nube al inicio de sesión desde otro PC,
// luego trabaja solo localStorage y sincroniza incrementalmente.

import { v4 as uuidv4 } from "uuid";

const SNAPSHOT_KEY = "APP_DATA_2025";
const DEVICE_KEY = "device_id_2025";
const LOCAL_INDEX_KEY = "local_last_change_index_v1";
const BOOTSTRAP_FLAG = "bootstrapped_v1";

const CHANGE_PUSH_ENDPOINT = "/api/sync/appendChange";
const GET_STATE_ENDPOINT = "/api/sync/getState";
const GET_CHANGES_ENDPOINT = "/api/sync/getChanges";

let _watcher = null;
let _writing = false;
let _applying = false;
let lastWriteTs = 0;
const WRITE_THROTTLE_MS = 50;

// utils
function uuid() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2,9)}`;
}

function safeParse(raw, fallback = null) {
  if (raw === null || raw === undefined) return fallback;
  if (typeof raw !== "string") return raw;
  try { return JSON.parse(raw); } catch { return fallback; }
}

export function readLocalSnapshot() {
  try {
    const raw = localStorage.getItem(SNAPSHOT_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) { return {}; }
}

export function writeLocalSnapshot(obj) {
  try {
    window.__localSync__?.suspendAutoPush(true);
    localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(obj));
  } catch (e) {
    console.error("writeLocalSnapshot error", e);
  } finally {
    window.__localSync__?.suspendAutoPush(false);
  }
}

function ensureDeviceId() {
  let id = localStorage.getItem(DEVICE_KEY);
  if (!id) {
    id = uuid();
    localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}

function getLocalIndex() {
  const v = localStorage.getItem(LOCAL_INDEX_KEY);
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
function setLocalIndex(n) {
  localStorage.setItem(LOCAL_INDEX_KEY, String(n));
}

// API helpers
async function apiGet(endpoint, qs = "") {
  const url = endpoint + (qs ? "?" + qs : "");
  const r = await fetch(url, { cache: "no-cache" });
  return r.json();
}
async function apiPost(endpoint, body) {
  const r = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  return r.json();
}

// PUSH incremental (client)
export async function pushChangeLocalAndCloud(changeObj) {
  if (!changeObj || typeof changeObj !== "object") return false;
  const now = Date.now();
  if (now - lastWriteTs < WRITE_THROTTLE_MS) return false;
  lastWriteTs = now;
  if (_applying) return false; // don't write while applying incoming changes
  _writing = true;
  try {
    // compute incremental vs snapshot
    const snapshot = readLocalSnapshot();
    const incremental = {};
    Object.entries(changeObj).forEach(([k, v]) => {
      if (JSON.stringify(snapshot[k]) !== JSON.stringify(v)) incremental[k] = v;
    });
    if (!Object.keys(incremental).length) return false;

    // update snapshot locally
    writeLocalSnapshot({ ...snapshot, ...incremental });

    // send to server
    const resp = await apiPost(CHANGE_PUSH_ENDPOINT, { change: incremental });
    if (!resp || !resp.ok) {
      console.warn("[localSync] push failed", resp);
      return false;
    }
    // update local index
    if (typeof resp.index === "number") setLocalIndex(resp.index);
    return true;
  } catch (err) {
    console.error("[localSync] pushChangeLocalAndCloud error", err);
    return false;
  } finally {
    _writing = false;
  }
}

// FETCH incremental changes from server and apply
export async function fetchAndApplyNewCloudChanges() {
  if (_writing) return;
  if (_applying) return;
  _applying = true;
  try {
    const localIdx = getLocalIndex();
    const resp = await apiGet(GET_CHANGES_ENDPOINT, `from=${localIdx}`);
    if (!resp || !resp.ok) return;
    // if server returned changes (legacy array mode)
    if (Array.isArray(resp.changes) && resp.changes.length) {
      for (const item of resp.changes) {
        if (!item || !item.change) continue;
        const snapshot = readLocalSnapshot();
        writeLocalSnapshot({ ...snapshot, ...item.change });
      }
      if (typeof resp.newIndex === "number") setLocalIndex(resp.newIndex);
    } else {
      // server signals snapshotNeeded or numeric mode change
      if (resp.snapshotNeeded || (typeof resp.newIndex === "number" && resp.newIndex > localIdx)) {
        // get full state and overwrite local snapshot (this follows your requirement: always read from cloud on new PC)
        const sresp = await apiGet(GET_STATE_ENDPOINT);
        if (sresp && sresp.ok) {
          if (sresp.snapshot) {
            writeLocalSnapshot(sresp.snapshot);
            setLocalIndex(typeof sresp.indexNumber === "number" ? sresp.indexNumber : getLocalIndex());
          }
        }
      }
    }
  } catch (err) {
    console.error("[localSync] fetchAndApplyNewCloudChanges error", err);
  } finally {
    _applying = false;
  }
}

// BOOTSTRAP: always read from cloud (per your requirement)
export async function bootstrapIfNeeded() {
  try {
    ensureDeviceId();
    // Always fetch remote snapshot (you specified "ignore localStorage and get from cloud")
    const resp = await apiGet(GET_STATE_ENDPOINT);
    if (resp && resp.ok) {
      if (resp.snapshot) {
        // overwrite local snapshot with remote copy
        window.__localSync__?.suspendAutoPush(true);
        localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(resp.snapshot));
        window.__localSync__?.suspendAutoPush(false);
      } else {
        // nothing remote: ensure local snapshot exists
        if (!localStorage.getItem(SNAPSHOT_KEY)) localStorage.setItem(SNAPSHOT_KEY, JSON.stringify({}));
      }
      // set local index pointer
      if (typeof resp.indexNumber === "number") setLocalIndex(resp.indexNumber);
      else setLocalIndex(0);
      localStorage.setItem(BOOTSTRAP_FLAG, "yes");
      console.log("[localSync] Bootstrap completed. index:", getLocalIndex());
      return true;
    } else {
      console.warn("[localSync] bootstrap: server did not return snapshot", resp);
      return false;
    }
  } catch (err) {
    console.error("[localSync] bootstrapIfNeeded error", err);
    return false;
  }
}

// WATCHER
export function startCloudWatcher(intervalMs = 2000) {
  stopCloudWatcher();
  // initial
  fetchAndApplyNewCloudChanges().catch(() => {});
  _watcher = setInterval(() => fetchAndApplyNewCloudChanges().catch(() => {}), intervalMs);
  console.log("[localSync] Cloud watcher started, interval:", intervalMs);
}
export function stopCloudWatcher() {
  if (_watcher) { clearInterval(_watcher); _watcher = null; console.log("[localSync] Cloud watcher stopped"); }
}

// intercept localStorage.setItem for autopush
(function () {
  const original = localStorage.setItem;
  const suspended = new Set();
  localStorage.setItem = function (key, value) {
    original.apply(this, arguments);
    if (key === LOCAL_INDEX_KEY || key === DEVICE_KEY || key === BOOTSTRAP_FLAG) return;
    if (window.__localSync__?.autoPush && !window.__localSync__._suspended) {
      // throttle handling via pushChangeLocalAndCloud internal throttle
      if (!suspended.has(key)) {
        suspended.add(key);
        window.__localSync__.autoPush(key, value)
          .finally(() => suspended.delete(key))
          .catch(e => console.warn("[localSync] autoPush error:", e));
      }
    }
  };
})();

window.__localSync__ = {
  _suspended: false,
  suspendAutoPush(flag = true) { this._suspended = !!flag; },
  async autoPush(key, rawValue) {
    try {
      let value;
      try { value = JSON.parse(rawValue); } catch { value = rawValue; }
      // push minimal change
      await pushChangeLocalAndCloud({ [key]: value });
      console.log("[localSync] autoPush sent", key);
    } catch (err) {
      console.warn("[localSync] autoPush error", err);
    }
  }
};

// auto-init on import
(async () => {
  try {
    await bootstrapIfNeeded();
    startCloudWatcher(2000);
  } catch (e) {
    console.error("[localSync] init error", e);
  }
})();

export default {
  bootstrapIfNeeded,
  pushChangeLocalAndCloud,
  fetchAndApplyNewCloudChanges,
  startCloudWatcher,
  stopCloudWatcher,
  readLocalSnapshot,
  writeLocalSnapshot
};
