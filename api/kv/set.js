export default async function handler(req, res) {
  try {
    const { key, value } = req.body;
    const url = `${process.env.VITE_UPSTASH_URL}/SET/${encodeURIComponent(key)}`;

    const r = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.VITE_UPSTASH_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(value)
    });

    const json = await r.json();
    res.status(200).json(json);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: String(err) });
  }
}
