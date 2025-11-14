// api/saveToGithub.js
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { content, message } = req.body;

  if (!content || !message) {
    return res.status(400).json({ error: "content and message are required" });
  }

  const token = process.env.GITHUB_TOKEN; // tu token con permisos de repo

  const owner = "JaiderHertur26";
  const repo = "AplicacionWebContabilidad";
  const path = "data.json";
  const branch = "main";

  try {
    // 1️⃣ Obtener SHA del archivo existente
    const getRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`,
      {
        headers: {
          Authorization: `token ${token}`,
          Accept: "application/vnd.github.v3+json",
        },
      }
    );

    if (!getRes.ok) {
      return res.status(500).json({ error: "Could not get SHA of data.json" });
    }

    const fileData = await getRes.json();
    const sha = fileData.sha;

    // 2️⃣ Leer y decodificar data.json existente
    let current = {};
    try {
      current = JSON.parse(Buffer.from(fileData.content, "base64").toString("utf8"));
    } catch (e) {
      console.error("Error parsing existing file", e);
    }

    // 3️⃣ Mezclar contenido nuevo con existente
    const newJson = { ...current, ...content };

    // 4️⃣ Subir archivo actualizado a GitHub
    const updateRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
      {
        method: "PUT",
        headers: {
          Authorization: `token ${token}`,
          "Content-Type": "application/json",
          Accept: "application/vnd.github.v3+json",
        },
        body: JSON.stringify({
          message,
          content: Buffer.from(JSON.stringify(newJson, null, 2)).toString("base64"),
          sha,
          branch,
        }),
      }
    );

    if (!updateRes.ok) {
      const errorData = await updateRes.json();
      return res.status(updateRes.status).json({ error: errorData });
    }

    const result = await updateRes.json();
    return res.status(200).json({ ok: true, result });
  } catch (err) {
    console.error("Error en saveToGithub:", err);
    return res.status(500).json({ error: err.message });
  }
}
