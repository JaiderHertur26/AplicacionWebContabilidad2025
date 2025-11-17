// =======================
// LIB/SNAPSHOTS.JS
// =======================

// Guarda y carga snapshots directamente en localStorage
// Simula un almacenamiento global y por empresa

export async function loadSnapshotGlobal() {
  const str = localStorage.getItem('JSON_GLOBAL');
  if (!str) return { empresas: [] };
  try {
    return JSON.parse(str);
  } catch (e) {
    console.error('❌ Error parseando JSON_GLOBAL:', e);
    return { empresas: [] };
  }
}

export async function saveSnapshotGlobal(globalData) {
  try {
    localStorage.setItem('JSON_GLOBAL', JSON.stringify(globalData || { empresas: [] }));
  } catch (e) {
    console.error('❌ Error guardando JSON_GLOBAL:', e);
  }
}

export async function loadSnapshotEmpresa(empresaId) {
  const str = localStorage.getItem(`empresa_${empresaId}`);
  if (!str) return {};
  try {
    return JSON.parse(str);
  } catch (e) {
    console.error(`❌ Error parseando empresa_${empresaId}:`, e);
    return {};
  }
}

export async function saveSnapshotEmpresa(empresaId, data) {
  try {
    localStorage.setItem(`empresa_${empresaId}`, JSON.stringify(data || {}));
  } catch (e) {
    console.error(`❌ Error guardando empresa_${empresaId}:`, e);
  }
}

export async function deleteSnapshotEmpresa(empresaId) {
  try {
    localStorage.removeItem(`empresa_${empresaId}`);
  } catch (e) {
    console.error(`❌ Error eliminando empresa_${empresaId}:`, e);
  }
}
