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

export async function loadSnapshot(filename) {
  const res = await fetch(`/api/getSnapshot?filename=${filename}`);
  return await res.json();
}

export async function loadSnapshotGlobal() {
  return loadSnapshot("JSON_GLOBAL.json");
}

export async function loadSnapshotEmpresa(empresaId) {
  return loadSnapshot(`empresa_${empresaId}.json`);
}
