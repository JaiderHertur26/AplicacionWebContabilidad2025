// ===========================
// CONFIGURACIÓN SUPABASE
// ===========================
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://ejmufayqwosvuydmftih.supabase.co"; 
const SUPABASE_ANON_KEY = "TU_ANON_KEY_AQUÍ"; // Reemplázalo
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ===========================
// ARCHIVOS EN STORAGE
// ===========================
const GLOBAL_FILE = "JSON_GLOBAL.json";
const COMPANY_PREFIX = "empresa_";

// ===========================
// Cargar datos iniciales
// ===========================
export async function loadLocalStorageFromSupabase() {
  console.log("Cargando datos almacenados en Supabase…");

  // ---- Cargar archivo global ----
  const { data: globalFile } = await supabase.storage
    .from("snapshots")
    .download(GLOBAL_FILE);

  if (globalFile) {
    const text = await globalFile.text();
    try {
      const json = JSON.parse(text);
      localStorage.setItem("JSON_GLOBAL", JSON.stringify(json));
      console.log("JSON_GLOBAL cargado");
    } catch (e) {
      console.warn("Error leyendo GLOBAL:", e);
    }
  }

  // ---- Cargar lista de empresas existentes ----
  const { data: files } = await supabase.storage
    .from("snapshots")
    .list();

  if (files) {
    files
      .filter(f => f.name.startsWith(COMPANY_PREFIX))
      .forEach(async (file) => {
        const { data: cFile } = await supabase.storage
          .from("snapshots")
          .download(file.name);

        if (cFile) {
          const text = await cFile.text();
          try {
            const json = JSON.parse(text);
            localStorage.setItem(file.name, JSON.stringify(json));
          } catch (e) {}
        }
      });

    console.log("Empresas cargadas en localStorage");
  }
}

// ===========================
// Guardar JSON_GLOBAL
// ===========================
export async function saveGlobalJsonToSupabase() {
  const json = localStorage.getItem("JSON_GLOBAL") || "{}";

  const { error } = await supabase.storage
    .from("snapshots")
    .upload(GLOBAL_FILE, json, {
      upsert: true,
      contentType: "application/json"
    });

  if (error) {
    console.error("ERROR al subir GLOBAL:", error);
  } else {
    console.log("GLOBAL guardado en Supabase");
  }
}

// ===========================
// Guardar EMPRESA
// ===========================
export async function saveCompanyToSupabase(companyId) {
  const key = `${COMPANY_PREFIX}${companyId}`;

  const json = localStorage.getItem(key);
  if (!json) return;

  const { error } = await supabase.storage
    .from("snapshots")
    .upload(`${key}.json`, json, {
      upsert: true,
      contentType: "application/json"
    });

  if (error) {
    console.error("ERROR al subir empresa:", error);
  } else {
    console.log(`Empresa ${companyId} guardada en Supabase`);
  }
}

// ===========================
// Eliminar empresa de Supabase
// ===========================
export async function deleteCompanyFromSupabase(companyId) {
  const file = `${COMPANY_PREFIX}${companyId}.json`;

  await supabase.storage
    .from("snapshots")
    .remove([file]);

  console.log(`Empresa ${companyId} eliminada en Supabase`);
}

// ===========================
// AUTO-SYNC CADA 5 SEGUNDOS
// ===========================
export function startAutoSync() {
  console.log("Auto-sync activado…");

  setInterval(async () => {
    // Sync GLOBAL
    await saveGlobalJsonToSupabase();

    // Sync todas las empresas
    Object.keys(localStorage)
      .filter(k => k.startsWith(COMPANY_PREFIX))
      .forEach(async (key) => {
        const companyId = key.replace(COMPANY_PREFIX, "");
        await saveCompanyToSupabase(companyId);
      });

  }, 5000);
}
