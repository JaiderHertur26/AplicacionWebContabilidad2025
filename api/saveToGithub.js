export default async function handler(req, res) {
  const { fileContent, repo, owner } = req.body;

  const token = process.env.GITHUB_TOKEN;
  const filePath = "data.json";

  try {
    const getRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    const fileData = await getRes.json();
    const sha = fileData.sha;

    const updateRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        message: "update data.json",
        content: Buffer.from(JSON.stringify(fileContent, null, 2)).toString("base64"),
        sha
      })
    });

    const result = await updateRes.json();
    res.status(200).json({ success: true, result });
  } catch (err) {
    res.status(500).json({ error: err.toString() });
  }
}
