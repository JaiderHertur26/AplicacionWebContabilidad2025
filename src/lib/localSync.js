// ============================================================================
//  localSync.js — Motor estable de sincronización LocalStorage ↔ Upstash
// ============================================================================

// --- Configuración ---
const INDEX_KEY = "changes_index_v1";
const DEVICE_ID_KEY = "device_id_2025";
const LOCAL_INDEX_KEY = "local_last_change_index_v1";
const BOOTSTRAP_KEY = "bootstrapped_v1";

// PC evitará escribir más de 1 cambio por 700ms
const WRITE_THROTTLE = 700;

// Polling de la nube
const CLOUD_INTERVAL = 2000;

// Semáforos globales
let writingCloud = false;
let applyingCloud = false;
let watcher = null;

// ---------------------------------------------------------------------------
//  Utilidades
// ---------------------------------------------------------------------------
function uuid() {
  return crypto.randomUUID();
}

function timestampId() {
  return `${Date.now()}-${uuid()}`;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ---------------------------------------------------------------------------
//  Manejo de Device ID seguro
// ---------------------------------------------------------------------------
function ensureDeviceId() {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = uuid();
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

// ---------------------------------------------------------------------------
//  API segura hacia /api/kv
// ---------------------------------------------------------------------------
async function kvGet(key) {
  const r = await fetch(`/api/kv/get?key=${key}`);
  const json = await r.json();
  return json?.result ?? null;
}

async function kvSet(key, value) {
  await fetch(`/api/kv/set`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key, value }),
  });
}

// ---------------------------------------------------------------------------
//  Enviar cambio local → nube
// ---------------------------------------------------------------------------
const sendLocalChange = (() => {
  let lastWrite = 0;

  return async function (keyChanged) {
    const now = Date.now();
    if (now - lastWrite < WRITE_THROTTLE) return;
    lastWrite = now;

    if (applyingCloud) return; // No escribir cuando estamos aplicando cambios

    writingCloud = true;

    const newId = timestampId();
    const raw = (await kvGet(INDEX_KEY)) || "[]";
    const arr = JSON.parse(raw);

    arr.push(newId);
    await kvSet(INDEX_KEY, JSON.stringify(arr));
    localStorage.setItem(LOCAL_INDEX_KEY, arr.length.toString());

    console.log("[localSync] Cambio detectado y subido:", keyChanged);

    writingCloud = false;
  };
})();

// ---------------------------------------------------------------------------
//  Aplicar cambios nube → local
// ---------------------------------------------------------------------------
async function applyCloudChanges() {
  if (writingCloud) return;

  applyingCloud = true;

  const raw = (await kvGet(INDEX_KEY)) || "[]";
  const arr = JSON.parse(raw);

  const localIndex = parseInt(localStorage.getItem(LOCAL_INDEX_KEY) || "0", 10);

  // Nada nuevo
  if (arr.length <= localIndex) {
    applyingCloud = false;
    return;
  }

  // Actualizamos el index local
  localStorage.setItem(LOCAL_INDEX_KEY, arr.length.toString());

  // <<<<< CLAVE: NO APLICAMOS NINGÚN DATO AQUÍ >>>>>
  // Sincronizamos solo cambios reales: las páginas mismas se encargan
  // de escribir y leer APP_DATA_2025 o companies.

  applyingCloud = false;
}

// ---------------------------------------------------------------------------
//  Bootstrap inicial cuando un PC está vacío
// ---------------------------------------------------------------------------
async function bootstrapIfNeeded() {
  ensureDeviceId();

  const already = localStorage.getItem(BOOTSTRAP_KEY);
  if (already) return;

  const raw = (await kvGet(INDEX_KEY)) || "[]";
  const arr = JSON.parse(raw);

  // Dejamos el índice al final para evitar que el PC intente aplicar cambios viejos
  localStorage.setItem(LOCAL_INDEX_KEY, arr.length.toString());

  localStorage.setItem(BOOTSTRAP_KEY, "1");

  console.log("Bootstrap completado.");
}

// ---------------------------------------------------------------------------
//  Watcher nube
// ---------------------------------------------------------------------------
function startCloudWatcher() {
  if (watcher) return;

  watcher = setInterval(async () => {
    try {
      await applyCloudChanges();
    } catch (err) {
      console.error("Cloud watcher error:", err);
    }
  }, CLOUD_INTERVAL);

  console.log("Cloud watcher started, interval:", CLOUD_INTERVAL);
}

function stopCloudWatcher() {
  if (watcher) {
    clearInterval(watcher);
    watcher = null;
  }
}

// ---------------------------------------------------------------------------
//  Watcher LOCAL (escucha cambios y dispara uploads)
// ---------------------------------------------------------------------------
function startLocalHooks() {
  window.addEventListener("storage", async (ev) => {
    if (!ev.key) return;
    if (ev.key === LOCAL_INDEX_KEY) return;
    if (ev.key === DEVICE_ID_KEY) return;

    if (applyingCloud) return;

    await sendLocalChange(ev.key);
  });

  console.log("LocalStorage Sync Hook activo ✔️");
}

// ---------------------------------------------------------------------------
//  Init principal
// ---------------------------------------------------------------------------
export async function initLocalSync() {
  ensureDeviceId();
  startLocalHooks();
  await bootstrapIfNeeded();
  startCloudWatcher();
}

export { bootstrapIfNeeded, startCloudWatcher, stopCloudWatcher };
