// /api/sync.js
import { redis } from "../src/lib/redis.js";

const STREAM_KEY = "changes_stream_v1";

// API Handler compatible con Vite Node API o Hostinger Serverless
export default async function handler(req, res) {
  const limit = Number(req.query.limit || 200);

  try {
    // Leer los últimos eventos de Upstash Redis Stream
    const items = await redis.xrevrange(STREAM_KEY, "+", "-", { count: limit });

    res.status(200).json({ items });
  } catch (err) {
    console.error("sync error:", err);
    res.status(500).json({ error: "sync_error" });
  }
}
