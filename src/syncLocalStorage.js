// syncLocalStorage.js
let syncTimeout = null;

export async function restoreFromCloud() {
  try {
    const res = await fetch("/api/sync"); // Llamada relativa
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    // Limpiar y restaurar localStorage
    localStorage.clear();
    for (const key in data) {
      localStorage.setItem(key, data[key]);
    }

    console.log("☁ LocalStorage restaurado desde la nube");
  } catch (e) {
    console.error("❌ No se pudo restaurar snapshot desde la nube:", e);
  }
}

export function enableCloudSync() {
  const originalSetItem = localStorage.setItem;

  localStorage.setItem = function (key, value) {
    originalSetItem.call(localStorage, key, value);

    if (syncTimeout) clearTimeout(syncTimeout);
    syncTimeout = setTimeout(async () => {
      const snapshot = {};
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        snapshot[k] = localStorage.getItem(k);
      }

      try {
        await fetch("/api/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(snapshot),
        });
        console.log(`☁ Datos sincronizados en la nube (último cambio: ${key})`);
      } catch (e) {
        console.error("❌ Error sincronizando en la nube:", e);
      }
    }, 500);
  };
}
