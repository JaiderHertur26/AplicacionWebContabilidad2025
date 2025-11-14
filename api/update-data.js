import fetch from 'node-fetch';

export default async function handler(req, res) {
  if (req.method === 'POST') {
    const { updatedData } = req.body;

    const GITHUB_API = 'https://api.github.com/repos/usuario/repositorio/contents/data.json';
    const TOKEN = process.env.GITHUB_TOKEN;

    // Primero, obtener el SHA actual del archivo
    const getRes = await fetch(GITHUB_API, {
      headers: {
        Authorization: `token ${TOKEN}`,
        Accept: 'application/vnd.github+json'
      }
    });
    const fileData = await getRes.json();
    const sha = fileData.sha;

    // Commit con los nuevos datos
    const commitRes = await fetch(GITHUB_API, {
      method: 'PUT',
      headers: {
        Authorization: `token ${TOKEN}`,
        Accept: 'application/vnd.github+json'
      },
      body: JSON.stringify({
        message: 'Actualización de movimientos desde la app',
        content: Buffer.from(JSON.stringify(updatedData, null, 2)).toString('base64'),
        sha
      })
    });

    const commitResult = await commitRes.json();
    res.status(200).json(commitResult);
  } else {
    res.status(405).send('Method Not Allowed');
  }
}
