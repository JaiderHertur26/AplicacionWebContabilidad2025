// /api/bootstrap.js
import { redis } from "../src/lib/redis.js";

export default async function handler(req, res) {
  try {
    const snapshot = await redis.get("APP_DATA_2025");

    res.status(200).json({
      ok: true,
      snapshot: snapshot || null
    });
  } catch (err) {
    console.error("bootstrap error:", err);
    res.status(500).json({
      ok: false,
      error: "bootstrap_error",
    });
  }
}
