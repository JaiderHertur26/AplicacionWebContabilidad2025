// AplicaciónWebContabilidad2025/api/syncLocalStorage.js
import fetch from "node-fetch";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end("Method Not Allowed");

  const { localStorageData } = req.body;
  if (!localStorageData) return res.status(400).end("No data provided");

  const owner = "JaiderHertur26";
  const repo = "AplicacionWebContabilidad2025";
  const path = "CopiaLocalStorage.json";
  const branch = "main";
  const token = process.env.GITHUB_TOKEN; // Token cargado en Vercel

  try {
    // 1️⃣ Obtener SHA del archivo existente
    const getFileRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`, {
      headers: {
        Authorization: `token ${token}`,
        Accept: "application/vnd.github.v3+json",
      },
    });

    const fileData = await getFileRes.json();
    const sha = fileData.sha;

    // 2️⃣ Actualizar el archivo
    const updateRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, {
      method: "PUT",
      headers: {
        Authorization: `token ${token}`,
        Accept: "application/vnd.github.v3+json",
      },
      body: JSON.stringify({
        message: "Actualización automática de localStorage",
        content: Buffer.from(JSON.stringify(localStorageData, null, 2)).toString("base64"),
        sha: sha,
        branch: branch,
      }),
    });

    const updateData = await updateRes.json();
    res.status(200).json({ message: "Archivo actualizado", updateData });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error actualizando el archivo" });
  }
}
