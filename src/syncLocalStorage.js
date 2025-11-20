// Intercepta localStorage.setItem y sincroniza automáticamente con la nube
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

      // Construir snapshot completo
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
