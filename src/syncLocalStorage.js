// =======================
// SYNC LOCALSTORAGE <-> SUPABASE
// =======================

import {
  saveSnapshotGlobal,
  saveSnapshotEmpresa,
  loadSnapshotGlobal,
  loadSnapshotEmpresa
} from './lib/snapshots';

// =======================
// CARGA INICIAL DESDE SUPABASE
// =======================
export async function loadLocalStorageFromSupabase() {
  console.log("⏬ Cargando datos desde Supabase...");

  try {
    // ----- GLOBAL -----
    const globalData = await loadSnapshotGlobal();
    if (globalData) {
      localStorage.setItem('JSON_GLOBAL', JSON.stringify(globalData));
    } else {
      console.warn('⚠ No se encontró JSON_GLOBAL, se crea vacío');
      localStorage.setItem('JSON_GLOBAL', JSON.stringify({}));
    }

    // ----- EMPRESAS -----
    if (globalData?.empresas && Array.isArray(globalData.empresas)) {
      for (const empresa of globalData.empresas) {
        const empresaData = await loadSnapshotEmpresa(empresa.id);
        if (empresaData) {
          localStorage.setItem(`empresa_${empresa.id}`, JSON.stringify(empresaData));
        } else {
          console.warn(`⚠ No se encontró empresa_${empresa.id}, se crea vacío`);
          localStorage.setItem(`empresa_${empresa.id}`, JSON.stringify({}));
        }
      }
    }

    console.log('✔ LocalStorage sincronizado desde Supabase');
  } catch (e) {
    console.error('❌ Error cargando snapshots desde Supabase:', e);
  }
}

// =======================
// DETECTAR CAMBIOS EN LOCALSTORAGE
// =======================
function getLocalStorageSnapshot() {
  const snapshot = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key === 'JSON_GLOBAL' || key.startsWith('empresa_')) {
      snapshot[key] = localStorage.getItem(key);
    }
  }
  return snapshot;
}

// =======================
// AUTO-SYNC COMPLETO
// =======================
export function startAutoSync() {
  console.log("🔄 AutoSync ACTIVADO (cada 3s)");

  let lastSnapshot = getLocalStorageSnapshot();
  const SYNC_INTERVAL = 3000; // 3 segundos

  setInterval(async () => {
    try {
      const currentSnapshot = getLocalStorageSnapshot();

      // 🔹 GLOBAL
      const globalPrev = lastSnapshot['JSON_GLOBAL'];
      const globalCurr = currentSnapshot['JSON_GLOBAL'];
      if (globalCurr && globalCurr !== globalPrev) {
        await saveSnapshotGlobal(JSON.parse(globalCurr));
        console.log('✔ Global sincronizado automáticamente');
      }

      // 🔹 EMPRESAS
      for (const key in currentSnapshot) {
        if (key.startsWith('empresa_')) {
          const prev = lastSnapshot[key];
          const curr = currentSnapshot[key];
          const empresaId = key.replace('empresa_', '');

          if (!prev && curr) {
            // Nueva empresa
            await saveSnapshotEmpresa(empresaId, JSON.parse(curr));
            console.log(`✔ Nueva empresa ${empresaId} creada en Supabase`);
          } else if (prev !== curr) {
            // Empresa existente modificada
            await saveSnapshotEmpresa(empresaId, JSON.parse(curr));
            console.log(`✔ Empresa ${empresaId} sincronizada automáticamente`);
          }
        }
      }

      // 🔹 ELIMINACIONES
      for (const key in lastSnapshot) {
        if (key.startsWith('empresa_') && !currentSnapshot[key]) {
          const empresaId = key.replace('empresa_', '');
          try {
            await saveSnapshotEmpresa(empresaId, null); // pasar null para eliminar
            console.log(`✔ Empresa ${empresaId} eliminada en Supabase`);
          } catch (e) {
            console.warn(`⚠ Error eliminando empresa ${empresaId}:`, e);
          }
        }
      }

      // Actualizar snapshot de referencia
      lastSnapshot = currentSnapshot;
    } catch (e) {
      console.error('❌ Error en auto-sync:', e);
    }
  }, SYNC_INTERVAL);
}
