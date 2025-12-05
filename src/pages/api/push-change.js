// /pages/api/push-change.js
import { redis } from "../../lib/redis";

const STREAM_KEY = "changes_stream_v1";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  try {
    const { id, change } = req.body;

    const already = await redis.set(`processed:${id}`, "1", { nx: true });
    if (already === null) {
      return res.status(200).json({ duplicated: true });
    }

    await redis.xadd(
      STREAM_KEY,
      "*",
      {
        change: JSON.stringify(change),
        ts: Date.now() + ""
      }
    );

    res.status(200).json({ ok: true });
  } catch {
    res.status(500).json({ error: "push_change_error" });
  }
}
