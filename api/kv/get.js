export default async function handler(req, res) {
  const { key } = req.query;

  try {
    const url = `${process.env.UPSTASH_REST_URL}/get/${key}`;
    
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${process.env.UPSTASH_REST_TOKEN}` }
    });

    const data = await response.json();
    res.status(200).json(data);
  } catch (e) {
    console.error("GET Error", e);
    res.status(500).json({ error: "kv-get-failed" });
  }
}
