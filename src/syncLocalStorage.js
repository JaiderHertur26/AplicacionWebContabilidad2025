let syncTimeout = null;

export function enableCloudSync() {
  const originalSetItem = localStorage.setItem;

  localStorage.setItem = function (key, value) {
    // Guardar localmente como siempre
    originalSetItem.call(localStorage, key, value);

    // Agrupar eventos y sincronizar solo una vez cada 500ms
    if (syncTimeout) clearTimeout(syncTimeout);

    syncTimeout = setTimeout(async () => {
      const snapshot = {};

      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        snapshot[k] = localStorage.getItem(k);
      }

      try {
        const res = await fetch("/api/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(snapshot),
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        console.log(`☁ Datos sincronizados en la nube (último cambio: ${key})`);
      } catch (e) {
        console.error("❌ Error sincronizando en la nube:", e);
      }
    }, 500);
  };
}
