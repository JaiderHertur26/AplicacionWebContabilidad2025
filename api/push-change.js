// /src/pages/api/push-change.js
import { redis } from "@/lib/redis";

export default async function handler(req, res) {
  try {
    const { id, change } = req.body;

    await redis.hset("APP_DATA_2025", {
      [id]: { id, change: JSON.stringify(change) }
    });

    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
}
