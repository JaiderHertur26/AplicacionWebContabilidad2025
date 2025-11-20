// Hook que intercepta localStorage.setItem y sincroniza automáticamente con la nube

export function enableCloudSync() {
  const originalSetItem = localStorage.setItem;

  localStorage.setItem = async function (key, value) {
    // Guardar localmente como siempre
    originalSetItem.call(localStorage, key, value);

    // Enviar el snapshot completo al backend
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

      console.log(`☁ Sincronizado en la nube por cambio en: ${key}`);
    } catch (e) {
      console.error("❌ Error sincronizando en la nube:", e);
    }
  };
}
