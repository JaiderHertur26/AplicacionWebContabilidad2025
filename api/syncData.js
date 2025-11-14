import fetch from "node-fetch";

export default async function handler(req, res) {
  const GITHUB_TOKEN = process.env.GITHUB_TOKEN; // Token seguro en Vercel
  const API_URL_DATA = "https://api.github.com/repos/JaiderHertur26/AplicacionWebContabilidad/contents/backups/data.json";

  // Recibir JSON desde frontend
  const jsonData = req.body;

  // Obtener SHA del archivo
  const getSHA = async () => {
    const r = await fetch(API_URL_DATA, {
      headers: { Authorization: `token ${GITHUB_TOKEN}` }
    });
    if (!r.ok) return null;
    const data = await r.json();
    return data.sha || null;
  };

  const sha = await getSHA();

  // Subir archivo a GitHub
  const r = await fetch(API_URL_DATA, {
    method: "PUT",
    headers: { 
      Authorization: `token ${GITHUB_TOKEN}`, 
      "Content-Type": "application/json" 
    },
    body: JSON.stringify({
      message: "Actualización automática desde la app",
      content: Buffer.from(JSON.stringify(jsonData, null, 2)).toString('base64'),
      sha: sha || undefined
    })
  });

  if (!r.ok) {
    const text = await r.text();
    return res.status(500).send({ error: text });
  }

  res.status(200).send({ message: "Archivo actualizado en GitHub ✅" });
}
