// =======================================
// CONFIGURACIÓN
// =======================================
const GITHUB_TOKEN = "TU_GITHUB_TOKEN"; // ⚠️ solo pruebas locales
const API_URL_DATA = "https://api.github.com/repos/TU_USUARIO/TU_REPO/contents/backups/data.json";
const API_URL_COMPANIES = "https://api.github.com/repos/TU_USUARIO/TU_REPO/contents/backups/companies.json";

// =======================================
// FUNCIONES AUXILIARES
// =======================================

// Codificar JSON a Base64
const encodeBase64 = (obj) => btoa(unescape(encodeURIComponent(JSON.stringify(obj, null, 2))));

// Obtener SHA del archivo en GitHub
const getFileSHA = async (url) => {
  const res = await fetch(url, { headers: { Authorization: `token ${GITHUB_TOKEN}` } });
  if (!res.ok) return null;
  const data = await res.json();
  return data.sha || null;
};

// Subir JSON a GitHub
const pushJsonToGitHub = async (url, jsonData) => {
  const sha = await getFileSHA(url);
  const res = await fetch(url, {
    method: "PUT",
    headers: { 
      Authorization: `token ${GITHUB_TOKEN}`, 
      "Content-Type": "application/json" 
    },
    body: JSON.stringify({
      message: "Actualización automática desde la app",
      content: encodeBase64(jsonData),
      sha: sha || undefined
    })
  });
  if (!res.ok) console.error("❌ Error subiendo a GitHub:", await res.text());
  else console.log("✅ Archivo actualizado en GitHub:", url);
};

// =======================================
// SINCRONIZACIÓN
// =======================================

// Subir todo el localStorage a GitHub
export const syncLocalStorageToGitHub = async () => {
  const allLocalStorage = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    try { allLocalStorage[key] = JSON.parse(localStorage.getItem(key)); }
    catch { allLocalStorage[key] = localStorage.getItem(key); }
  }

  const companiesJson = { companies: allLocalStorage.companies || [] };
  const dataJson = allLocalStorage.data || {};

  await pushJsonToGitHub(API_URL_COMPANIES, companiesJson);
  await pushJsonToGitHub(API_URL_DATA, dataJson);
};

// Cargar localStorage desde GitHub
export const loadLocalStorageFromGitHub = async () => {
  const urls = [API_URL_COMPANIES, API_URL_DATA];

  for (const url of urls) {
    const res = await fetch(url, { headers: { Authorization: `token ${GITHUB_TOKEN}` } });
    if (!res.ok) continue;
    const file = await res.json();
    const content = JSON.parse(atob(file.content));

    if (url.includes("companies.json")) localStorage.setItem("companies", JSON.stringify(content.companies));
    if (url.includes("data.json")) localStorage.setItem("data", JSON.stringify(content));
  }

  console.log("✅ localStorage actualizado desde GitHub");
};

// =======================================
// DETECCIÓN AUTOMÁTICA DE CAMBIOS
// =======================================

export const startAutoSync = (intervalMs = 5000) => {
  let lastSnapshot = JSON.stringify(localStorage);

  setInterval(async () => {
    const currentSnapshot = JSON.stringify(localStorage);
    if (currentSnapshot !== lastSnapshot) {
      lastSnapshot = currentSnapshot;
      await syncLocalStorageToGitHub();
    }
  }, intervalMs);
};
