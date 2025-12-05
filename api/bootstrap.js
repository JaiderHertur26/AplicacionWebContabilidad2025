// /src/pages/api/bootstrap.js
import { redis } from "@/lib/redis";

export default async function handler(req, res) {
  try {
    const allData = await redis.hgetall("APP_DATA_2025") || {};
    return res.status(200).json({ ok: true, data: allData });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
}
