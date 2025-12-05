// /api/saveSnapshot.js
import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

const SNAPSHOT_KEY = "accounting_app_data";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });

  try {
    const payload = req.body;
    if (typeof payload === "undefined") return res.status(400).json({ ok: false, error: "Missing body" });

    await redis.set(SNAPSHOT_KEY, JSON.stringify(payload));
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("saveSnapshot error", err);
    return res.status(500).json({ ok: false, error: String(err) });
  }
}
