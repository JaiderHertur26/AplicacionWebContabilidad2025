// api/load.js — Cargar desde Upstash

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      return res.status(405).json({ error: "Método no permitido" });
    }

    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;

    const response = await fetch(`${url}/get/localStorage`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const result = await response.json();

    return res.status(200).json({
      success: true,
      value: result.result ? JSON.parse(result.result) : {},
    });

  } catch (error) {
    return res.status(500).json({
      error: "Error interno",
      details: error.message,
    });
  }
}
