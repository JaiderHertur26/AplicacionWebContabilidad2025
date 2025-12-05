// /src/pages/api/bootstrap.js
import { redis } from "@/lib/redis";

export default async function handler(req, res) {
  try {
    let state = await redis.get("APP_STATE");
    if (!state) state = {};

    res.status(200).json({
      ok: true,
      data: state
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
}
