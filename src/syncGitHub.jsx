const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const REPO = "JaiderHertur26/AplicacionWebContabilidad";
const API_URL_DATA = `https://api.github.com/repos/${REPO}/contents/backups/data.json`;
const API_URL_COMPANIES = `https://api.github.com/repos/${REPO}/contents/backups/companies.json`;

// Convertir JSON a Base64
const encodeBase64 = (obj) => btoa(JSON.stringify(obj, null, 2));

// Obtener SHA del archivo en GitHub
const getFileSHA = async (apiUrl) => {
  const res = await fetch(apiUrl, { headers: { Authorization: `token ${GITHUB_TOKEN}` } });
  if (!res.ok) return null;
  const data = await res.json();
  return data.sha;
};

// Subir JSON a GitHub
const pushJsonToGitHub = async (apiUrl, jsonData) => {
  const sha = await getFileSHA(apiUrl);
  const res = await fetch(apiUrl, {
    method: "PUT",
    headers: { Authorization: `token ${GITHUB_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      message: "Actualización automática desde la app",
      content: encodeBase64(jsonData),
      sha: sha
    })
  });
  if (!res.ok) console.error("Error subiendo a GitHub:", await res.text());
  else console.log("✅ Archivo actualizado en GitHub");
};

// Copiar todo el localStorage a GitHub
export const syncLocalStorageToGitHub = async () => {
  const allLocalStorage = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    allLocalStorage[key] = JSON.parse(localStorage.getItem(key));
  }

  const companiesJson = { companies: allLocalStorage.companies || [] };
  const dataJson = allLocalStorage.data || {};

  await pushJsonToGitHub(API_URL_COMPANIES, companiesJson);
  await pushJsonToGitHub(API_URL_DATA, dataJson);
};

// Descargar desde GitHub y actualizar localStorage
export const fetchFromGithub = async () => {
  try {
    const resCompanies = await fetch(API_URL_COMPANIES, {
      headers: { Authorization: `token ${GITHUB_TOKEN}` }
    });
    const companiesData = await resCompanies.json();
    localStorage.setItem("companies", atob(companiesData.content));

    const resData = await fetch(API_URL_DATA, {
      headers: { Authorization: `token ${GITHUB_TOKEN}` }
    });
    const data = await resData.json();
    localStorage.setItem("data", atob(data.content));

    console.log("✅ LocalStorage sincronizado desde GitHub");
  } catch (err) {
    console.error("❌ Error al cargar desde GitHub:", err);
  }
};
