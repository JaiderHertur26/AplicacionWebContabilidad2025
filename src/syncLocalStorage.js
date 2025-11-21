// syncLocalStorage.js — COMPLETO Y FUNCIONAL

// =============================
// 1. ENVIAR localStorage → Upstash
// =============================
export async function saveLocalStorageToServer() {
  try {
    const data = { ...localStorage }; // Convertir todo localStorage en JSON

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
    const response = await fetch("/api/load"); // Este endpoint lo creo abajo
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
// 3. AUTO SYNC cada 10 segundos
// =============================
export function startAutoSync() {
  // Guarda cada 10 segundos
  setInterval(() => {
    saveLocalStorageToServer();
  }, 10000);

  console.log("🔄 AutoSync iniciado cada 10 segundos");
}
