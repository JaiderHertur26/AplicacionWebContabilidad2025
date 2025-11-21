// syncLocalStorage.js

let lastSnapshot = null;

// --------------------------
// 1️⃣ Cargar snapshot del servidor
// --------------------------
export async function loadLocalStorageFromServer() {
  try {
    const res = await fetch("/api/sync");
    const data = await res.json();

    // Evitar restaurar snapshots vacíos
    if (!data || Object.keys(data).length === 0) {
      console.log("⚠ Snapshot vacío — NO restaurado");
      return;
    }

    Object.keys(data).forEach((k) => {
      localStorage.setItem(k, data[k]);
    });

    lastSnapshot = JSON.stringify(data);

    console.log("☁ LocalStorage restaurado desde la nube");
  } catch (e) {
    console.warn("⚠ No se pudo cargar snapshot desde la nube:", e);
  }
}

// --------------------------
// 2️⃣ Empezar sincronización automática
// --------------------------
export function startAutoSync(interval = 10000) {
  console.log("🔄 AutoSync iniciado cada", interval / 1000, "segundos");

  setInterval(async () => {
    const snapshot = {};

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      snapshot[key] = localStorage.getItem(key);
    }

    // No subir snapshot vacío
    if (!snapshot || Object.keys(snapshot).length === 0) {
      console.log("⚠ Snapshot vacío — NO enviado al servidor");
      return;
    }

    const newString = JSON.stringify(snapshot);

    // No subir si es igual al último snapshot
    if (newString === lastSnapshot) {
      return;
    }

    try {
      const res = await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: newString,
      });

      const json = await res.json();

      if (res.ok) {
        lastSnapshot = newString;
        console.log("☁ Snapshot sincronizado");
      } else {
        console.warn("⚠ No se guardó en Upstash:", json);
      }
    } catch (e) {
      console.error("❌ Error sincronizando snapshot:", e);
    }
  }, interval);
}
