import { Octokit } from "octokit";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Solo se permite POST" });
  }

  const { path, data } = req.body;
  if (!path || !data) {
    return res.status(400).json({ error: "Faltan parámetros 'path' o 'data'" });
  }

  const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;

  try {
    // Obtener el archivo actual (para obtener el sha)
    let sha;
    try {
      const { data: file } = await octokit.rest.repos.getContent({
        owner,
        repo,
        path,
      });
      sha = file.sha;
    } catch {
      sha = undefined; // si no existe el archivo aún
    }

    // 🔹 Guardar solo el contenido de "data"
    const content = JSON.stringify(data, null, 2);

    // Subir el archivo
    await octokit.rest.repos.createOrUpdateFileContents({
      owner,
      repo,
      path,
      message: "Actualización desde la app web",
      content: Buffer.from(content).toString("base64"),
      sha,
    });

    return res.status(200).json({ success: true, saved: data });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}
