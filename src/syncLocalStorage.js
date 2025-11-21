let syncTimeout = null;

// Claves que NO deben subirse a la nube (lista segura)
const BLOCKLIST = [
  "__VERCEL_INSIGHTS__", 
  "vercel", 
  "chrome-extension", 
  "undefined", 
  null
];

// Sanitizar los valores antes de enviarlos a la nube
function safeValue(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value);
  if (typeof value === "number" && isNaN(value)) return "";
  return String(value);
}

export function enableCloudSync() {
  const originalSetItem = localStorage.setItem;

  localStorage.setItem = function (key, value) {
    // Guardar localmente como siempre
    originalSetItem.call(localStorage, key, value);

    // Evitar claves peligrosas
    if (!key || BLOCKLIST.some(b => key.includes(b))) return;

    // Agrupar eventos y sincronizar solo una vez cada 500ms
    if (syncTimeout) clearTimeout(syncTimeout);

    syncTimeout = setTimeout(async () => {
      const snapshot = {};

      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);

        // Saltar claves peligrosas o inválidas
        if (!k || BLOCKLIST.some(b => k.includes(b))) continue;

        const v = localStorage.getItem(k);

        // Sanear valores antes de subirlos
        snapshot[k] = safeValue(v);
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
