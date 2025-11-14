// Subir JSON a GitHub vía Vercel Functions
const pushJson = async (endpoint, jsonData) => {
  const res = await fetch(`/api/${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(jsonData)
  });
  if (!res.ok) console.error("Error sincronizando:", await res.text());
};

// Función principal para subir todo el localStorage
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
