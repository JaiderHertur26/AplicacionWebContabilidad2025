export async function syncLocalStorageToGitHub() {
  const data = {};

  // Copiar TODO el localStorage
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);

    try {
      data[key] = JSON.parse(localStorage.getItem(key));
    } catch {
      data[key] = localStorage.getItem(key);
    }
  }

  // Enviar al backend serverless en Vercel
  await fetch("/api/saveLocalStorage", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data }),
  });
}
