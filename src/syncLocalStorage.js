// syncLocalStorage.js — COMPLETO CON INTERVALO CONFIGURABLE

let SYNC_INTERVAL = 3000; // ⏱️ 3 segundos (puedes cambiarlo aquí)

// =============================
// 1. ENVIAR localStorage → Upstash
// =============================
export async function saveLocalStorageToServer() {
  try {
    const data = { ...localStorage };

    const response = await fetch("/api/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    return await response.json();
  } catch (err) {
    console.error("❌ Error enviando localStorage al servidor:", err);
  }
}



// =============================
// 2. CARGAR datos desde Upstash → localStorage
// =============================
export async function loadLocalStorageFromServer() {
  try {
    const response = await fetch("/api/load");
    const data = await response.json();

    if (data && data.value) {
      Object.keys(data.value).forEach((key) => {
        localStorage.setItem(key, data.value[key]);
      });
    }

    return true;
  } catch (err) {
    console.error("❌ Error cargando datos del servidor:", err);
    return false;
  }
}



// =============================
// 3. AUTO SYNC cada X segundos
// =============================
export function startAutoSync(intervalMs = null) {
  // Si el usuario especifica otro intervalo → reemplazar
  if (intervalMs) SYNC_INTERVAL = intervalMs;

  setInterval(() => {
    saveLocalStorageToServer();
  }, SYNC_INTERVAL);

  console.log(`🔄 AutoSync iniciado cada ${SYNC_INTERVAL / 1000} segundos`);
}
