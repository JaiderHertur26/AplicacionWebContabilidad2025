// Función para subir JSON vía serverless
const pushJson = async (endpoint, jsonData) => {
  const res = await fetch(`/api/${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(jsonData)
  });
  if (!res.ok) console.error("Error sincronizando:", await res.text());
};

// Subir todo el localStorage
export const syncLocalStorage = async () => {
  const allLocalStorage = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    try { allLocalStorage[key] = JSON.parse(localStorage.getItem(key)); }
    catch { allLocalStorage[key] = localStorage.getItem(key); }
  }

  await pushJson("syncCompanies", { companies: allLocalStorage.companies || [] });
  await pushJson("syncData", allLocalStorage.data || {});
};

// Cargar desde GitHub al iniciar
export const loadLocalStorageFromGitHub = async () => {
  try {
    const dataRes = await fetch("/api/getData");
    const data = await dataRes.json();
    localStorage.setItem("data", JSON.stringify(data));

    const companiesRes = await fetch("/api/getCompanies");
    const companies = await companiesRes.json();
    localStorage.setItem("companies", JSON.stringify(companies.companies));
  } catch (e) {
    console.error("Error cargando desde GitHub:", e);
  }
};

// Auto-sync cada X segundos si hay cambios
export const startAutoSync = (intervalMs = 5000) => {
  let lastSnapshot = JSON.stringify(localStorage);

  setInterval(async () => {
    const currentSnapshot = JSON.stringify(localStorage);
    if (currentSnapshot !== lastSnapshot) {
      lastSnapshot = currentSnapshot;
      await syncLocalStorage();
    }
  }, intervalMs);
};
