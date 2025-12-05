// /pages/api/sync.js
import { redis } from "../../lib/redis";

const STREAM_KEY = "changes_stream_v1";

export default async function handler(req, res) {
  const limit = Number(req.query.limit || 200);

  try {
    const items = await redis.xrevrange(STREAM_KEY, "+", "-", { count: limit });
    res.status(200).json({ items });
  } catch {
    res.status(500).json({ error: "sync_error" });
  }
}
