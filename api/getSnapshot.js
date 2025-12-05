// /api/getSnapshot.js
import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

const SNAPSHOT_KEY = "accounting_app_data";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ ok: false, error: "Method not allowed" });
  try {
    const raw = await redis.get(SNAPSHOT_KEY);
    const data = raw ? JSON.parse(raw) : null;
    return res.status(200).json({ ok: true, data });
  } catch (err) {
    console.error("getSnapshot error", err);
    return res.status(500).json({ ok: false, error: String(err) });
  }
}
