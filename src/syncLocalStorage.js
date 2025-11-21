// syncLocalStorage.js — sincronización segura con Upstash

let lastSnapshot = null;
let autoSyncTimer = null;

function safeParse(json, fallback = null) {
  try {
    return JSON.parse(json);
  } catch {
    return fallback;
  }
}

function isValidSnapshot(data) {
  if (!data) return false;
  if (typeof data !== 'object') return false;
  if (Object.keys(data).length === 0) return false;
  if (!data['companies']) return false; // clave obligatoria
  return true;
}

// Cargar snapshot desde el servidor (GET /api/sync)
export async function loadLocalStorageFromServer() {
  try {
    const res = await fetch('/api/sync');
    if (!res.ok) {
      console.warn('No fue posible contactar /api/sync:', res.status);
      return;
    }

    const data = await res.json();

    if (!isValidSnapshot(data)) {
      console.log('⚠ Snapshot remoto inválido o vacío — no se restaura');
      return;
    }

    Object.keys(data).forEach(k => {
      localStorage.setItem(k, data[k]);
    });

    lastSnapshot = JSON.stringify(data);
    console.log('☁ LocalStorage restaurado desde la nube');
  } catch (e) {
    console.error('Error al cargar snapshot desde servidor:', e);
  }
}

// Construir snapshot real desde localStorage
function buildSnapshot() {
  const snapshot = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    snapshot[key] = localStorage.getItem(key);
  }
  return snapshot;
}

// Enviar snapshot al servidor (POST /api/sync)
async function postSnapshot(snapshot) {
  try {
    const res = await fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(snapshot),
    });

    const json = await res.json();
    return { ok: res.ok, json };
  } catch (e) {
    console.error('Error al enviar snapshot:', e);
    return { ok: false, json: null };
  }
}

// Iniciar auto sync con protecciones
export function startAutoSync(interval = 10000) {
  if (autoSyncTimer) clearInterval(autoSyncTimer);

  console.log('🔄 AutoSync iniciado cada', interval / 1000, 'segundos');

  autoSyncTimer = setInterval(async () => {
    const snapshot = buildSnapshot();

    // No enviar si snapshot vacío o inválido (evitar borrados)
    if (!isValidSnapshot(snapshot)) {
      console.log('⚠ Snapshot local inválido o vacío — NO enviado');
      return;
    }

    const snapshotStr = JSON.stringify(snapshot);

    // Evitar envíos idénticos
    if (snapshotStr === lastSnapshot) return;

    const { ok, json } = await postSnapshot(snapshot);

    if (ok) {
      lastSnapshot = snapshotStr;
      console.log('☁ Snapshot sincronizado');
    } else {
      console.warn('⚠ Falló guardar snapshot en servidor:', json);
    }
  }, interval);
}
