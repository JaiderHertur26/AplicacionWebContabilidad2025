// /pages/api/bootstrap.js
import { redis } from "../../lib/redis";

const SNAP_KEY = "snapshot_v1";

export default async function handler(req, res) {
  try {
    const snap = await redis.get(SNAP_KEY);
    res.status(200).json({ data: snap || {} });
  } catch (e) {
    res.status(500).json({ error: "bootstrap_error" });
  }
}
