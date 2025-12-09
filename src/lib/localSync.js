// ==============================
//  Local Sync (Producción)
// ==============================

const STORAGE_KEY = "appData_v1";
const INDEX_KEY = "changes_index_v1"; // siempre número entero

let isBootstrapped = false;
let lastAppliedIndex = 0;

// ==============================
// Helpers
// ==============================
async function kvGet(key) {
  const r = await fetch(`/api/kv/get?key=${key}`);
  return r.json();
}

async function kvSet(key, value) {
  return fetch(`/api/kv/set`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ key, value })
  });
}

function loadLocal() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

function saveLocal(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

// ==============================
// Bootstrap inicial
// ==============================
async function bootstrap() {
  if (isBootstrapped) return;

  console.log("🔄 Bootstrap: leyendo índice remoto…");

  const remote = await kvGet(INDEX_KEY);

  let remoteIndex = parseInt(remote.result ?? "0", 10);
  if (isNaN(remoteIndex)) remoteIndex = 0;

  console.log("🔢 Índice remoto =", remoteIndex);

  for (let i = 1; i <= remoteIndex; i++) {
    const change = await kvGet(`change_${i}`);
    if (change?.result) {
      const data = JSON.parse(change.result);
      saveLocal(data);
    }
  }

  lastAppliedIndex = remoteIndex;
  isBootstrapped = true;

  console.log("✔️ Bootstrap completado");
}

// ==============================
//  Enviar cambios (PC1)
// ==============================
export async function pushLocalChanges(newData) {
  const localBefore = loadLocal();
  const localAfter = newData;

  if (JSON.stringify(localBefore) === JSON.stringify(localAfter)) {
    return; // no hay cambios
  }

  saveLocal(localAfter);

  // leer índice real siempre desde KV (evita desfasado)
  const remote = await kvGet(INDEX_KEY);
  let idx = parseInt(remote.result ?? "0", 10);
  if (isNaN(idx)) idx = 0;

  const newIndex = idx + 1;

  await kvSet(`change_${newIndex}`, JSON.stringify(localAfter));
  await kvSet(INDEX_KEY, String(newIndex));

  lastAppliedIndex = newIndex;

  console.log(`⬆️ Cambio enviado al KV. Nuevo índice: ${newIndex}`);
}

// ==============================
// Watcher remoto (PC2)
// ==============================
async function startWatcher() {
  console.log("⏳ Watcher iniciado (cada 2s)…");

  setInterval(async () => {
    const remote = await kvGet(INDEX_KEY);
    let remoteIndex = parseInt(remote.result ?? "0", 10);

    if (isNaN(remoteIndex)) return;

    if (remoteIndex > lastAppliedIndex) {
      console.log(`🌐 Nuevo cambio detectado: ${remoteIndex}`);

      for (let i = lastAppliedIndex + 1; i <= remoteIndex; i++) {
        const change = await kvGet(`change_${i}`);
        if (!change?.result) continue;
        const data = JSON.parse(change.result);
        saveLocal(data);
        console.log("⬇️ Cambio aplicado local:", i);
      }

      lastAppliedIndex = remoteIndex;
    }
  }, 2000);
}

// ==============================
// Inicialización global
// ==============================
(async () => {
  await bootstrap();
  startWatcher();
})();
