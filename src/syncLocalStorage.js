import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// ===============================
//  BUCKET DONDE SE GUARDAN
// ===============================
const BUCKET = "snapshots";

// ===============================
//  NOMBRE ARCHIVO GLOBAL
// ===============================
const GLOBAL_FILE = "JSON_GLOBAL.json";

// ============================================
//  FUNCION: DESCARGAR ARCHIVO DESDE SUPABASE
// ============================================
async function downloadFile(filename) {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .download(filename);

  if (error) {
    console.warn("No existe aún:", filename);
    return null;
  }

  const text = await data.text();
  return JSON.parse(text);
}

// ============================================
//  FUNCION: SUBIR ARCHIVO A SUPABASE
// ============================================
async function uploadFile(filename, jsonData) {
  const blob = new Blob([JSON.stringify(jsonData)], {
    type: "application/json",
  });

  await supabase.storage
    .from(BUCKET)
    .upload(filename, blob, {
      upsert: true, // sobrescribe siempre
    });

  console.log("Archivo actualizado en Supabase:", filename);
}

// ======================================================
//  CARGAR LOCALSTORAGE DESDE SUPABASE AL INICIAR APP
// ======================================================
export async function loadLocalStorageFromSupabase() {
  console.log("Cargando datos desde Supabase…");

  // ========== CARGA JSON GLOBAL ==========
  const globalJson = await downloadFile(GLOBAL_FILE);

  if (globalJson) {
    localStorage.setItem("GLOBAL_JSON", JSON.stringify(globalJson));
    console.log("GLOBAL_JSON cargado desde Supabase");
  }

  // ========== CARGA EMPRESAS GUARDADAS ==========
  // lista de archivos en el bucket
  const { data: files } = await supabase.storage.from(BUCKET).list("");

  if (files) {
    for (const file of files) {
      if (file.name.startsWith("empresa_")) {
        const empresaData = await downloadFile(file.name);
        if (empresaData) {
          localStorage.setItem(file.name, JSON.stringify(empresaData));
        }
      }
    }
  }

  console.log("Sincronización inicial completa.");
}

// ======================================================
//  GUARDAR DATOS GLOBAL EN SUPABASE
// ======================================================
export async function saveGlobalJsonToSupabase() {
  const data = localStorage.getItem("GLOBAL_JSON");
  if (data) {
    await uploadFile(GLOBAL_FILE, JSON.parse(data));
  }
}

// ======================================================
//  GUARDAR UNA EMPRESA ESPECÍFICA
// ======================================================
export async function saveCompanyToSupabase(companyId) {
  const key = "empresa_" + companyId;
  const data = localStorage.getItem(key);

  if (data) {
    await uploadFile(key, JSON.parse(data));
  }
}

// ======================================================
//  AUTO-SYNC CADA VEZ QUE EL USUARIO CAMBIE LOCALSTORAGE
// ======================================================
export function startAutoSync() {
  console.log("AutoSync activado…");

  window.addEventListener("storage", async (event) => {
    if (!event.key) return;

    // Guardar GLOBAL_JSON
    if (event.key === "GLOBAL_JSON") {
      await saveGlobalJsonToSupabase();
    }

    // Guardar empresa específica
    if (event.key.startsWith("empresa_")) {
      const id = event.key.replace("empresa_", "");
      await saveCompanyToSupabase(id);
    }
  });
}
