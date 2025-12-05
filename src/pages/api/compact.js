// /pages/api/compact.js
import { redis } from "../../lib/redis";

const STREAM_KEY = "changes_stream_v1";
const SNAP_KEY = "snapshot_v1";

export default async function handler(req, res) {
  try {
    const all = await redis.xrange(STREAM_KEY, "-", "+");
    let acc = {};

    all.forEach(entry => {
      try {
        const c = JSON.parse(entry[1].change);
        acc = { ...acc, ...c };
      } catch {}
    });

    await redis.set(SNAP_KEY, acc);

    await redis.del(STREAM_KEY);

    await redis.xadd(STREAM_KEY, "*", {
      change: JSON.stringify({ _compact_marker: true }),
      ts: Date.now() + ""
    });

    res.status(200).json({ ok: true, size: all.length });
  } catch {
    res.status(500).json({ error: "compact_error" });
  }
}
