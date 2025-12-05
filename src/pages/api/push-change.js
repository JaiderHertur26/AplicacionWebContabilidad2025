// /src/pages/api/push-change.js
import { redis } from "@/lib/redis";

export default async function handler(req, res) {
  try {
    const { id, change } = req.body;

    // Registro incremental del cambio
    await redis.xadd(
      "CHANGES_STREAM",
      "*",
      "id", id,
      "change", JSON.stringify(change)
    );

    // Consolidación REAL del estado total
    let current = await redis.get("APP_STATE");
    if (!current) current = {};

    const updated = { ...current, ...change };
    await redis.set("APP_STATE", updated);

    res.status(200).json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
}
