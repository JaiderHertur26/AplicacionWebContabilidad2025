export default async function handler(req, res) {
  const { key, value } = req.body;

  try {
    const url = `${process.env.UPSTASH_REST_URL}/set/${key}`;
    
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.UPSTASH_REST_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ value })
    });

    const data = await response.json();
    res.status(200).json(data);
  } catch (e) {
    console.error("SET Error", e);
    res.status(500).json({ error: "kv-set-failed" });
  }
}
