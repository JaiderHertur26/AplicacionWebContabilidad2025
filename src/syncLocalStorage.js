// src/syncLocalStorage.js
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_KEY);
const BUCKET = import.meta.env.VITE_SUPABASE_BUCKET || 'snapshots';

async function downloadToLocalStorage(filename) {
  try {
    const { data, error } = await supabase.storage.from(BUCKET).download(filename);
    if (error) {
      console.warn(`No se pudo descargar ${filename}:`, error.message || error);
      return;
    }
    const text = await data.text();
    const json = JSON.parse(text);

    // si es JSON_GLOBAL.json
    if (filename === 'JSON_GLOBAL.json') {
      localStorage.setItem('JSON_GLOBAL', JSON.stringify(json));
      // si contiene listado de empresas, opcionalmente descargar cada empresa (ver abajo)
      if (json && Array.isArray(json.empresas)) {
        for (const emp of json.empresas) {
          if (emp && emp.id) {
            // intenta cargar cada empresa si no está ya cargada
            await downloadToLocalStorage(`empresa_${emp.id}.json`);
          }
        }
      }
      return;
    }

    // si filename empieza con empresa_
    if (filename.startsWith('empresa_')) {
      localStorage.setItem(filename.replace('.json',''), JSON.stringify(json));
      return;
    }

    // Default store
    localStorage.setItem(filename.replace('.json',''), JSON.stringify(json));
  } catch (err) {
    console.error('downloadToLocalStorage error:', err);
  }
}

// carga inicial: intenta cargar JSON_GLOBAL y lista de snapshots
export async function loadLocalStorageFromSupabase() {
  try {
    // 1) intentar descargar JSON_GLOBAL
    await downloadToLocalStorage('JSON_GLOBAL.json');

    // 2) listar manifest y descargar cada archivo (por si hay archivos adicionales)
    const { data: manifest, error } = await supabase.from('snapshots_manifest').select('id, filename, updated_at');
    if (error) {
      console.warn('No se pudo leer snapshots_manifest:', error.message || error);
      return;
    }
    for (const row of manifest || []) {
      await downloadToLocalStorage(row.filename);
    }
  } catch (err) {
    console.error('Error loadLocalStorageFromSupabase:', err);
  }
}

// iniciar AutoSync (suscripción Realtime)
export function startAutoSync() {
  // escuchamos INSERT/UPDATE/DELETE sobre snapshots_manifest
  const channel = supabase.channel('public:snapshots_manifest')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'snapshots_manifest' },
      async (payload) => {
        try {
          // payload.eventType: INSERT | UPDATE | DELETE
          const filename = payload.record ? payload.record.filename : (payload.old ? payload.old.filename : null);
          if (!filename) return;
          if (payload.eventType === 'DELETE') {
            // eliminar del localStorage si fue borrado
            localStorage.removeItem(filename.replace('.json',''));
            localStorage.removeItem('JSON_GLOBAL'); // para forzar recarga si corresponde
            return;
          }
          // INSERT o UPDATE -> descargar archivo actualizado
          await downloadToLocalStorage(filename);
        } catch (err) {
          console.error('Error in realtime handler:', err);
        }
      }
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log('🔔 Suscripción realtime a snapshots_manifest activa.');
      }
    });

  return channel;
}
