// =======================
// SYNC LOCALSTORAGE <-> POSTGRES
// =======================
import {
  loadSnapshotGlobal,
  saveSnapshotGlobal,
  loadSnapshotEmpresa,
  saveSnapshotEmpresa,
  deleteSnapshotEmpresa
} from './lib/snapshots';

// =======================
// CARGA INICIAL DESDE POSTGRES
// =======================
export async function loadLocalStorageFromSupabase() {
  console.log('⏬ Cargando datos desde Supabase...');

  try {
    // GLOBAL
    const globalData = await loadSnapshotGlobal();
    localStorage.setItem('JSON_GLOBAL', JSON.stringify(globalData || {}));

    // EMPRESAS
    if (globalData?.empresas && Array.isArray(globalData.empresas)) {
      for (const empresa of globalData.empresas) {
        const data = await loadSnapshotEmpresa(empresa.id);
        localStorage.setItem(`empresa_${empresa.id}`, JSON.stringify(data || {}));
      }
    }

    console.log('✔ LocalStorage sincronizado desde PostgreSQL');
  } catch (e) {
    console.error('❌ Error cargando snapshots desde Supabase:', e);
  }
}

// =======================
// AUTO-SYNC CADA 3 SEGUNDOS
// =======================
export function startAutoSync() {
  console.log('🔄 AutoSync ACTIVADO');

  const SYNC_INTERVAL = 3000;

  setInterval(async () => {
    try {
      // GLOBAL
      const globalStr = localStorage.getItem('JSON_GLOBAL');
      if (globalStr) {
        await saveSnapshotGlobal(JSON.parse(globalStr));
      }

      // EMPRESAS
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
  }, SYNC_INTERVAL);
}
