// =======================
// CONFIGURAR SUPABASE
// =======================
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Nombre del bucket donde guardas los JSON
const BUCKET = 'snapshots';

// =======================
// DESCARGAR JSON DESDE SUPABASE A LOCALSTORAGE
// =======================
export async function loadLocalStorageFromSupabase() {
  console.log("⏬ Cargando datos desde Supabase...");

  // ----- GLOBAL -----
  await loadFileToLocalStorage('JSON_GLOBAL.json', 'JSON_GLOBAL');

  // ----- EMPRESAS -----
  const { data: files } = await supabase.storage.from(BUCKET).list();

  for (const f of files) {
    if (f.name.startsWith("empresa_")) {
      const companyId = f.name.replace(".json", "");
      await loadFileToLocalStorage(f.name, companyId);
    }
  }

  console.log("✔ Datos cargados en localStorage.");
}

// -----------------------
async function loadFileToLocalStorage(fileName, localKey) {
// -----------------------
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .download(fileName);

  if (error) {
    console.warn(`⚠ No se pudo descargar ${fileName}`, error.message);
    return;
  }

  const text = await data.text();

  try {
    const json = JSON.parse(text);
    localStorage.setItem(localKey, JSON.stringify(json));
  } catch (e) {
    console.warn(`⚠ El archivo ${fileName} no contiene JSON válido`, text);
  }
}

// =======================
// GUARDAR JSON EN SUPABASE
// =======================
export async function saveFileToSupabase(localKey, fileName) {
  const item = localStorage.getItem(localKey);
  if (!item) return;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(fileName, item, { upsert: true });

  if (error) {
    console.error(`❌ Error guardando ${fileName}:`, error.message);
  } else {
    console.log(`✔ Guardado en Supabase → ${fileName}`);
  }
}

// =======================
// SINCRONIZACIÓN AUTOMÁTICA CADA 3 SEG
// =======================
export function startAutoSync() {
  console.log("🔄 AutoSync ACTIVADO");

  setInterval(() => {
    // Global
    saveFileToSupabase("JSON_GLOBAL", "JSON_GLOBAL.json");

    // Todas las empresas
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k.startsWith("empresa_")) {
        saveFileToSupabase(k, `${k}.json`);
      }
    }
  }, 3000);
}

