// =======================
// SYNC LOCALSTORAGE
// =======================
import { loadSnapshotGlobal, saveSnapshotGlobal, loadSnapshotEmpresa, saveSnapshotEmpresa } from './lib/snapshots';

// =======================
// CARGA INICIAL
// =======================
export async function loadLocalStorageFromJSON() {
  console.log('⏬ Cargando datos desde localStorage...');

  try {
    const globalData = await loadSnapshotGlobal();
    localStorage.setItem('JSON_GLOBAL', JSON.stringify(globalData || { empresas: [] }));

    if (globalData?.empresas && Array.isArray(globalData.empresas)) {
      for (const empresa of globalData.empresas) {
        const data = await loadSnapshotEmpresa(empresa.id);
        localStorage.setItem(`empresa_${empresa.id}`, JSON.stringify(data || {}));
      }
    }

    console.log('✔ LocalStorage cargado y sincronizado.');
  } catch (e) {
    console.error('❌ Error cargando snapshots:', e);
  }
}

// =======================
// AUTO-SYNC cada 3 segundos
// =======================
export function startAutoSync() {
  console.log('🔄 AutoSync ACTIVADO (cada 3s)');
  setInterval(async () => {
    try {
      // Global
      const globalStr = localStorage.getItem('JSON_GLOBAL');
      if (globalStr) await saveSnapshotGlobal(JSON.parse(globalStr));

      // Empresas
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.startsWith('empresa_')) {
          const empresaId = key.replace('empresa_', '');
          const dataStr = localStorage.getItem(key);
          if (dataStr) await saveSnapshotEmpresa(empresaId, JSON.parse(dataStr));
        }
      }
    } catch (e) {
      console.error('❌ Error en AutoSync:', e);
    }
  }, 3000);
}
