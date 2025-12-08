// /api/sync.js
import { redis } from "../src/lib/redis.js";

const STREAM_KEY = "changes_stream_v1";

export default async function handler(req, res) {
  const limit = Number(req.query.limit || 200);

  try {
    const items = await redis.xrevrange(STREAM_KEY, "+", "-", { count: limit });

    res.status(200).json({ ok: true, items });
  } catch (err) {
    console.error("sync error:", err);
    res.status(500).json({ ok: false, error: "sync_error" });
  }
}
