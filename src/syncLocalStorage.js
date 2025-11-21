// ======================================================
// 🔐 SYNC LOCALSTORAGE ↔ CLOUD (BLINDADO ANTI-BORRADO)
// ======================================================

const SNAPSHOT_KEY = "companies";              // clave exacta donde guardas las empresas
const SNAPSHOT_URL = "/api/sync";              // endpoint vercel
const SYNC_INTERVAL = 10000;                   // 10 segundos

// ======================================================
// 🧩 Leer snapshot local de forma segura
// ======================================================
function loadLocalSnapshot() {
  try {
    const raw = localStorage.getItem(SNAPSHOT_KEY);
    if (!raw) return [];

    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

// ======================================================
// 🌩 Obtener snapshot desde el servidor
// ======================================================
async function fetchRemoteSnapshot() {
  try {
    const response = await fetch(SNAPSHOT_URL);
    const data = await response.json();

    return Array.isArray(data.companies) ? data.companies : [];
  } catch {
    return [];
  }
}

// ======================================================
// 🧠 Blindaje mayor: reglas de seguridad
// ======================================================
// ❌ Si local está vacío → No subir
// ❌ Si local tiene MENOS empresas que remoto → No subir
// ❌ Si remoto está vacío → No sobrescribir local
// ❌ Si remoto tiene MENOS empresas → No restaurar
// ======================================================

async function safeSyncToServer() {
  const local = loadLocalSnapshot();
  const remote = await fetchRemoteSnapshot();

  // 1) Local vacío → NO subir
  if (local.length === 0) {
    console.warn("⛔ No sync — companies local está vacío");
    return;
  }

  // 2) Remoto tiene MÁS empresas que local → NO subir
  if (remote.length > local.length) {
    console.warn(`⛔ No sync — remoto (${remote.length}) > local (${local.length}). Blindaje activo.`);
    return;
  }

  // ======================================================
  // 🟢 AUTORIZADO PARA SINCRONIZAR
  // ======================================================
  const body = { companies: local };

  await fetch(SNAPSHOT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => {});

  console.log("☁ Snapshot sincronizado (seguro)");
}

// ======================================================
// ☁ Restaurar localStorage desde la nube AL INICIAR
// ======================================================
export async function restoreFromCloud() {
  const remote = await fetchRemoteSnapshot();
  const local = loadLocalSnapshot();

  // 1) Remoto vacío → NO borrar local
  if (!remote || remote.length === 0) {
    console.warn("⚠ Snapshot remoto vacío — NO se sobrescribe local (blindado)");
    return;
  }

  // 2) Remoto tiene menos empresas → NO restaurar
  if (remote.length < local.length) {
    console.warn(`⛔ No restaurado — remoto (${remote.length}) < local (${local.length}). Blindaje activo.`);
    return;
  }

  // 🟢 Restauración válida
  localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(remote));
  console.log("☁ LocalStorage restaurado desde la nube (blindado)");
}

// ======================================================
// 🔄 AutoSync cada X segundos
// ======================================================
export function startAutoSync() {
  console.log("🔄 AutoSync iniciado (cada 10s, blindado)");

  setInterval(async () => {
    await safeSyncToServer();
  }, SYNC_INTERVAL);
}
