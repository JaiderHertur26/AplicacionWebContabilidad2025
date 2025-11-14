import fetch from "node-fetch";

export default async function handler(req, res) {
  const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
  const API_URL_COMPANIES = "https://api.github.com/repos/JaiderHertur26/AplicacionWebContabilidad/contents/backups/companies.json";

  const r = await fetch(API_URL_COMPANIES, {
    headers: { Authorization: `token ${GITHUB_TOKEN}` }
  });

  if (!r.ok) return res.status(500).send({ error: "No se pudo obtener companies.json" });

  const data = await r.json();
  const jsonContent = JSON.parse(Buffer.from(data.content, "base64").toString("utf-8"));

  res.status(200).json(jsonContent);
}
