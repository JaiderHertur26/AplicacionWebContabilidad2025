export default async function handler(req, res) {
  try {
    const key = req.query.key;
    const url = `${process.env.VITE_UPSTASH_URL}/GET/${encodeURIComponent(key)}`;

    const r = await fetch(url, {
      headers: { Authorization: `Bearer ${process.env.VITE_UPSTASH_TOKEN}` }
    });
    const json = await r.json();
    res.status(200).json(json);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: String(err) });
  }
}
