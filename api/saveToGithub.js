// api/saveToGithub.js

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { fullLocalStorage, message } = req.body;

  if (!fullLocalStorage) {
    return res.status(400).json({ error: "fullLocalStorage is required" });
  }

  const token = process.env.GITHUB_TOKEN;
  const owner = "JaiderHertur26";
  const repo = "AplicacionWebContabilidad";
  const path = "data.json";
  const branch = "main";

  // 1. Obtener SHA actual
  const getRes = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`,
    {
      headers: {
        Authorization: `token ${token}`,
        Accept: "application/vnd.github.v3+json"
      }
    }
  );

  if (!getRes.ok) {
    return res.status(500).json({ error: "Could not get file SHA" });
  }

  const fileData = await getRes.json();
  const sha = fileData.sha;

  // 2. Convertir el localStorage completo a Base64
  const base64Content = Buffer
    .from(JSON.stringify(fullLocalStorage, null, 2))
    .toString("base64");

  // 3. Subir archivo completo (sobrescribe todo = copia exacta)
  const updateRes = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
    {
      method: "PUT",
      headers: {
        Authorization: `token ${token}`,
        "Content-Type": "application/json",
        Accept: "application/vnd.github.v3+json"
      },
      body: JSON.stringify({
        message: message || "Sync localStorage",
        content: base64Content,
        sha,
        branch
      })
    }
  );

  const result = await updateRes.json();
  return res.status(200).json({ ok: true, result });
}
