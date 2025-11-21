// api/sync.js — FUNCIONANDO

export default async function handler(req, res) {
  try {
    // Método permitido
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Método no permitido" });
    }

    // Variables de entorno (Vercel)
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;

    if (!url || !token) {
      return res.status(500).json({
        error: "Faltan variables de entorno",
      });
    }

    // El body viene en JSON desde tu app
    const data = req.body;

    // Guardar en Redis usando REST API nativa
    const response = await fetch(`${url}/set/localStorage`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });

    const result = await response.json();

    return res.status(200).json({
      success: true,
      redis_result: result,
      saved_data: data,
    });

  } catch (error) {
    return res.status(500).json({
      error: "Error interno",
      details: error.message,
    });
  }
}
