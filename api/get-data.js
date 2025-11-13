// api/get-data.js

export default async function handler(req, res) {
  try {
    const owner = process.env.GITHUB_OWNER;
    const repo = process.env.GITHUB_REPO;
    const token = process.env.GITHUB_TOKEN;
    const filePath = req.query.path || "frontend/empresa_datos.json";
    const branch = "main";

    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}?ref=${branch}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github.v3+json",
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Error al leer ${filePath}: ${response.statusText}`);
    }

    const file = await response.json();
    const content = Buffer.from(file.content, "base64").toString("utf8");

    res.status(200).json({ success: true, content });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
}
