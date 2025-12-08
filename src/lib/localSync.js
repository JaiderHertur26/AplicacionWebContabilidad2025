// src/lib/localSync.js

const STORAGE_KEY = "APP_DATA_2025";
const BOOTSTRAP_FLAG = "BOOTSTRAP_DONE";
const LAST_SYNC_TS = "APP_LAST_SYNC_TS";
const LAST_BOOTSTRAP_TS = "APP_LAST_BOOTSTRAP_TS";

/* ===========================================================
   LECTURA Y ESCRITURA LOCAL
   =========================================================== */

export function readLocal() {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

export function writeLocal(data) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

/* ===========================================================
   PASO 1 — BOOTSTRAP INICIAL (solo una vez)
   =========================================================== */

export async function bootstrapIfNeeded() {
  if (typeof window === "undefined") return;

  try {
    if (localStorage.getItem(BOOTSTRAP_FLAG) === "YES") return;

    const resp = await fetch("/api/bootstrap", { method: "GET", cache: "no-store" });
    if (!resp.ok) {
      console.warn("bootstrap: server returned", resp.status);
      return;
    }

    const json = await resp.json();
    if (!json?.ok) {
      console.warn("bootstrap: invalid response", json);
      return;
    }

    const snapshot = json.snapshot;

    // Si servidor está vacío → crear local vacío
    if (!snapshot) {
      writeLocal({});
      localStorage.setItem(BOOTSTRAP_FLAG, "YES");
      return;
    }

    writeLocal(snapshot.data || {});

    localStorage.setItem(BOOTSTRAP_FLAG, "YES");
    localStorage.setItem(LAST_BOOTSTRAP_TS, String(snapshot.timestamp || Date.now()));
    localStorage.setItem(LAST_SYNC_TS, String(snapshot.timestamp || Date.now()));

  } catch (err) {
    console.error("bootstrapIfNeeded error:", err);
  }
}

/* ===========================================================
   PASO 4 — SUBIR CAMBIOS NUEVOS A LA NUBE
   =========================================================== */

export async function syncToServer() {
  if (typeof window === "undefined") return;

  const localData = readLocal();
  const lastSync = Number(localStorage.getItem(LAST_SYNC_TS) || 0);

  const resp = await fetch("/api/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({
      since: lastSync,
      data: localData
    })
  });

  if (resp.ok) {
    const json = await resp.json();
    if (json?.serverTimestamp) {
      localStorage.setItem(LAST_SYNC_TS, String(json.serverTimestamp));
    }
  }
}

/* ===========================================================
   PASO 8 — TRAER CAMBIOS NUEVOS DESDE LA NUBE
   =========================================================== */

export async function syncFromServer() {
  if (typeof window === "undefined") return;

  const lastSync = Number(localStorage.getItem(LAST_SYNC_TS) || 0);

  const resp = await fetch(`/api/sync?since=${lastSync}`, {
    method: "GET",
    cache: "no-store"
  });

  if (!resp.ok) return;

  const json = await resp.json();

  if (json?.changes) {
    const localData = readLocal();
    const merged = { ...localData, ...json.changes };
    writeLocal(merged);
  }

  if (json?.serverTimestamp) {
    localStorage.setItem(LAST_SYNC_TS, String(json.serverTimestamp));
  }
}

/* ===========================================================
   initLocalSync() — PARA USARLO DESDE App.jsx
   =========================================================== */

export async function initLocalSync() {
  await bootstrapIfNeeded();  // solo la primera vez
  await syncFromServer();     // aseguramos actualización inicial
}
