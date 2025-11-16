// ===============================
//  SNAPSHOTS JSON (GLOBAL/EMPRESAS)
// ===============================

// Guarda el JSON GLOBAL
export async function saveSnapshotGlobal(globalData) {
  return await fetch("/api/saveSnapshot", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      filename: "JSON_GLOBAL.json",
      data: globalData
    })
  });
}

// Guarda el JSON por EMPRESA
export async function saveSnapshotEmpresa(empresaId, empresaData) {
  return await fetch("/api/saveSnapshot", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      filename: `empresa_${empresaId}.json`,
      data: empresaData
    })
  });
}

// Cargar cualquier JSON
export async function loadSnapshot(filename) {
  const res = await fetch(`/api/getSnapshot?filename=${filename}`);
  return await res.json();
}

// Cargar global
export async function loadSnapshotGlobal() {
  return loadSnapshot("JSON_GLOBAL.json");
}

// Cargar por empresa
export async function loadSnapshotEmpresa(empresaId) {
  return loadSnapshot(`empresa_${empresaId}.json`);
}

// Listar todos los snapshots que existen
export async function listSnapshots() {
  const res = await fetch(`/api/listSnapshots`);
  return await res.json();
}
