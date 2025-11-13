export default async function handler(req, res) {
  const { GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO } = process.env;

  const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/data.json`;

  try {
    const response = await fetch(url, {
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: 'No se pudo leer el archivo' });
    }

    const data = await response.json();
    const content = Buffer.from(data.content, 'base64').toString('utf8');

    res.status(200).json(JSON.parse(content));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
