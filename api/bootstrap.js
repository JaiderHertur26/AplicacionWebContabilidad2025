// api/bootstrap.js
import { Redis } from "@upstash/redis";

/**
 * GET /api/bootstrap
 * Devuelve { ok: true, snapshot: { timestamp, data } } o snapshot: null
 *
 * Requiere las env vars:
 * UPSTASH_REDIS_REST_URL
 * UPSTASH_REDIS_REST_TOKEN
 */

const redis = Redis.fromEnv();

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") return res.status(405).json({ ok: false, error: "Method not allowed" });

    const raw = await redis.get("APP_LOCALSTORAGE_2025");

    if (!raw) {
      return res.status(200).json({ ok: true, snapshot: null });
    }

    const snapshot = typeof raw === "string" ? JSON.parse(raw) : raw;

    return res.status(200).json({ ok: true, snapshot });
  } catch (err) {
    console.error("bootstrap error:", err);
    return res.status(500).json({ ok: false, error: String(err?.message || err) });
  }
}
