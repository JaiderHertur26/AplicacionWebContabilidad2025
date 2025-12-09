// /api/sync/appendChange.js
import { json } from "@vercel/node";

const UPSTASH_URL = process.env.UPSTASH_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_TOKEN;

export default async function handler(req, res) {
  try {
    if (!UPSTASH_URL || !UPSTASH_TOKEN) {
      return res.status(500).json({ ok: false, error: "UPSTASH_URL or UPSTASH_TOKEN not defined" });
    }

    const { change } = req.body;
    if (!change) return res.status(400).json({ ok: false, error: "No change provided" });

    const key = `app:change_v1:${Date.now()}-${Math.random().toString(36).slice(2,6)}`;
    
    const r = await fetch(`${UPSTASH_URL}/SET/${encodeURIComponent(key)}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${UPSTASH_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(change)
    });

    if (!r.ok) {
      const text = await r.text();
      return res.status(500).json({ ok: false, error: text });
    }

    res.status(200).json({ ok: true, index: Date.now() });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}
