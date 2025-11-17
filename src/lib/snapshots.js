// =======================
// LIB/SNAPSHOTS.JS
// =======================
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// =======================
// GLOBAL SNAPSHOT
// =======================
export async function loadSnapshotGlobal() {
  const { data, error } = await supabase
    .from('snapshots_global')
    .select('data')
    .single();

  if (error) {
    console.warn('⚠ No se pudo cargar snapshot global:', error.message);
    return null;
  }
  return data?.data || {};
}

export async function saveSnapshotGlobal(globalData) {
  const { error } = await supabase
    .from('snapshots_global')
    .upsert({ id: 1, data: globalData }, { onConflict: 'id' });

  if (error) console.error('❌ Error guardando snapshot global:', error.message);
  else console.log('✔ Snapshot global guardado');
}

// =======================
// EMPRESAS SNAPSHOT
// =======================
export async function loadSnapshotEmpresa(empresaId) {
  const { data, error } = await supabase
    .from('snapshots_empresas')
    .select('data')
    .eq('empresa_id', empresaId)
    .single();

  if (error) {
    console.warn(`⚠ No se pudo cargar empresa ${empresaId}:`, error.message);
    return null;
  }
  return data?.data || {};
}

export async function saveSnapshotEmpresa(empresaId, empresaData) {
  const { error } = await supabase
    .from('snapshots_empresas')
    .upsert({ empresa_id: empresaId, data: empresaData }, { onConflict: 'empresa_id' });

  if (error) console.error(`❌ Error guardando empresa ${empresaId}:`, error.message);
  else console.log(`✔ Empresa ${empresaId} guardada`);
}

export async function deleteSnapshotEmpresa(empresaId) {
  const { error } = await supabase
    .from('snapshots_empresas')
    .delete()
    .eq('empresa_id', empresaId);

  if (error) console.error(`❌ Error eliminando empresa ${empresaId}:`, error.message);
  else console.log(`✔ Empresa ${empresaId} eliminada`);
}
