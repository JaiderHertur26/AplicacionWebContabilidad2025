export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Solo se permite POST' });
  }

  const { GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO } = process.env;
  const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/data.json`;

  try {
    const getRes = await fetch(url, {
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });

    const existingFile = await getRes.json();
    const sha = existingFile.sha;

    const newContent = Buffer.from(JSON.stringify(req.body, null, 2)).toString('base64');

    const updateRes = await fetch(url, {
      method: 'PUT',
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: 'Actualización automática desde la app web',
        content: newContent,
        sha,
      }),
    });

    if (!updateRes.ok) {
      const errText = await updateRes.text();
      return res.status(400).json({ error: 'Error al actualizar', details: errText });
    }

    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
