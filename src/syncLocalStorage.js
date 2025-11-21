// syncLocalStorage.js

let lastSnapshot = null;

function isValidSnapshot(data) {
  if (!data) return false;
  if (Object.keys(data).length === 0) return false;

  // ❗ Si tienes claves obligatorias como "empresas", verifica aquí
  if (!data["empresas"]) return false;

  return true;
}

// Cargar snapshot
export async function loadLocalStorageFromServer() {
  try {
    const res = await fetch("/api/sync");
    const data = await res.json();

    // ❗ NO restaurar datos vacíos o dañados
    if (!isValidSnapshot(data)) {
      console.log("⚠ Snapshot remoto vacío — LOCAL NO se toca");
      return;
    }

    Object.keys(data).forEach((k) => {
      localStorage.setItem(k, data[k]);
    });

    lastSnapshot = JSON.stringify(data);

    console.log("☁ LocalStorage restaurado desde la nube");

  } catch (e) {
    console.warn("⚠ No se pudo restaurar snapshot:", e);
  }
}

// AutoSync seguro
export function startAutoSync(interval = 10000) {
  console.log("🔄 AutoSync seguro cada", interval / 1000, "seg");

  setInterval(async () => {
    const snapshot = {};

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      snapshot[key] = localStorage.getItem(key);
    }

    // ❗ NO enviar si está vacío o sin empresas
    if (!isValidSnapshot(snapshot)) {
      console.log("⚠ Snapshot local incompleto — NO enviado");
      return;
    }

    const newString = JSON.stringify(snapshot);

    if (newString === lastSnapshot) return;

    try {
      const res = await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: newString,
      });

      if (res.ok) {
        lastSnapshot = newString;
        console.log("☁ Snapshot sincronizado");
      }

    } catch (e) {
      console.error("❌ Error sincronizando:", e);
    }
  }, interval);
}
