import fetch from "node-fetch";

export default async function handler(req, res) {
  const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
  const API_URL_COMPANIES = "https://api.github.com/repos/JaiderHertur26/AplicacionWebContabilidad/contents/backups/companies.json";

  if (req.method !== "POST") return res.status(405).send({ error: "Method not allowed" });

  const jsonData = req.body;

  // Obtener SHA
  const getSHA = async () => {
    const r = await fetch(API_URL_COMPANIES, {
      headers: { Authorization: `token ${GITHUB_TOKEN}` }
    });
    if (!r.ok) return null;
    const data = await r.json();
    return data.sha || null;
  };

  const sha = await getSHA();

  // Subir archivo
  const r = await fetch(API_URL_COMPANIES, {
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

  res.status(200).send({ message: "Archivo companies.json actualizado ✅" });
}
