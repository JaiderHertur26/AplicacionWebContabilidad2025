// syncLocalStorage.js

// =============================
// Cargar snapshot desde servidor
// =============================
export async function loadLocalStorageFromServer() {
  try {
    const res = await fetch("/api/sync");
    const data = await res.json();

    if (data && typeof data === "object") {
      Object.keys(data).forEach((k) => {
        localStorage.setItem(k, data[k]);
      });
      console.log("☁ LocalStorage restaurado desde la nube");
    }
  } catch (err) {
    console.warn("⚠ No se pudo restaurar snapshot:", err);
  }
}

// =============================
// Guardar localStorage en servidor
// =============================
export async function saveLocalStorageToServer() {
  try {
    const snapshot = {};

    // Construir snapshot REAL del localStorage
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      snapshot[key] = localStorage.getItem(key);
    }

    await fetch("/api/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(snapshot),
    });

    console.log("☁ Snapshot sincronizado");
  } catch (err) {
    console.error("❌ Error enviando snapshot:", err);
  }
}

// =============================
// AutoSync (cada X ms)
// =============================
let autoSyncTimer = null;

export function startAutoSync(interval = 10000) {
  if (autoSyncTimer) clearInterval(autoSyncTimer);

  console.log(`🔄 AutoSync iniciado cada ${interval / 1000} segundos`);

  autoSyncTimer = setInterval(() => {
    saveLocalStorageToServer();
  }, interval);
}
