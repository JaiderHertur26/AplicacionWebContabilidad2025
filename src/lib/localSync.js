// /src/lib/localSync.js
import { v4 as uuid } from "uuid";

const STORAGE_KEY = "APP_DATA_2025";
const BOOTSTRAP_FLAG = "BOOTSTRAP_DONE";

// =======================
// Utilidades LocalStorage
// =======================
function readLocal() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

function writeLocal(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

// =====================================================
// 1. LECTURA INICIAL DESDE LA NUBE (SOLO UNA VEZ)
// =====================================================
export async function bootstrapIfNeeded() {
  // Si ya se hizo una vez, NO consulta la nube otra vez
  if (localStorage.getItem(BOOTSTRAP_FLAG) === "YES") return;

  const r = await fetch("/api/bootstrap");
  const j = await r.json();

  if (j && j.data) {
    writeLocal(j.data);               // Actualiza localStorage
    localStorage.setItem(BOOTSTRAP_FLAG, "YES"); // Marca bootstrap
  }
}

// =====================================================
// 2. SUBIR CAMBIO A LOCAL Y A LA NUBE
// =====================================================
export function pushChange(change) {
  const id = uuid();

  // Actualiza local
  const local = readLocal();
  const updated = { ...local, ...change };
  writeLocal(updated);

  // Envía solo el cambio nuevo a la nube (incremental)
  fetch("/api/push-change", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, change })
  });
}

// =====================================================
// 3. SINCRONIZACIÓN MANUAL DESDE EL STREAM (opcional)
// =====================================================
export async function syncFromStream() {
  const r = await fetch("/api/sync");
  const j = await r.json();
  if (!j.items) return;

  let local = readLocal();

  j.items.forEach(i => {
    try {
      const c = JSON.parse(i[1].change);
      local = { ...local, ...c };
    } catch {}
  });

  writeLocal(local);
}
