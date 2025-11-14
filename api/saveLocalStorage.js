// api/saveLocalStorage.js

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido" });
  }

  const token = process.env.GITHUB_TOKEN;
  const owner = "JaiderHertur26";  
  const repo = "AplicacionWebContabilidad";
  const path = "compania.json";   // archivo donde guardamos TODO el localStorage

  const { data } = req.body;

  const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;

  // obtener el SHA del archivo actual (obligatorio para actualizar)
  const existingFile = await fetch(apiUrl, {
    headers: {
      Authorization: `token ${token}`,
      "Content-Type": "application/json",
    },
  }).then((r) => r.json());

  const sha = existingFile.sha;

  // Codificar el nuevo contenido
  const content = Buffer.from(JSON.stringify(data, null, 2)).toString("base64");

  const result = await fetch(apiUrl, {
    method: "PUT",
    headers: {
      Authorization: `token ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message: "Sync localStorage → GitHub",
      content,
      sha,
    }),
  }).then((r) => r.json());

  return res.status(200).json(result);
}
