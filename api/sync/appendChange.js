// api/sync/appendChange.js
import { v4 as uuidv4 } from "uuid";

const UPSTASH_URL = process.env.UPSTASH_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_TOKEN;

const SNAPSHOT_KEY = "app:snapshot:APP_DATA_2025";
const CHANGES_INDEX_KEY = "app:changes_index_v1";
const CHANGE_PREFIX = "app:change_v1:";

async function upstashGet(key) {
  const url = `${UPSTASH_URL}/GET/${encodeURIComponent(key)}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` } });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`UPSTASH GET ${res.status} -> ${text}`);
  }
  return res.json();
}

async function upstashSet(key, value) {
  const url = `${UPSTASH_URL}/SET/${encodeURIComponent(key)}`;
  const body = typeof value === "string" ? value : JSON.stringify(value);
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${UPSTASH_TOKEN}`, "Content-Type": "application/json" },
    body
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`UPSTASH SET ${res.status} -> ${text}`);
  }
  return res.json();
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });

  try {
    const { change } = req.body;
    if (!change || typeof change !== "object") return res.status(400).json({ ok: false, error: "invalid change" });

    // create id
    const id = `${Date.now()}-${uuidv4()}`;
    const changeKey = CHANGE_PREFIX + id;
    const changePayload = JSON.stringify(change);

    // write change
    await upstashSet(changeKey, changePayload);

    // now read index
    const idxResp = await upstashGet(CHANGES_INDEX_KEY).catch(() => ({ result: null }));
    let idxVal = idxResp?.result ?? null;
    let idxArr = null;
    try { idxArr = JSON.parse(idxVal); } catch { idxArr = null; }

    if (Array.isArray(idxArr)) {
      // legacy: push id into array and write back
      idxArr.push(id);
      await upstashSet(CHANGES_INDEX_KEY, JSON.stringify(idxArr));
      // also merge into snapshot for convenience: read snapshot, merge, write
      const snapResp = await upstashGet(SNAPSHOT_KEY).catch(() => ({ result: null }));
      const snap = snapResp?.result ? (typeof snapResp.result === "string" ? JSON.parse(snapResp.result) : snapResp.result) : {};
      const merged = { ...snap, ...change };
      await upstashSet(SNAPSHOT_KEY, JSON.stringify(merged));
      return res.status(200).json({ ok: true, id, index: idxArr.length });
    } else {
      // numeric mode — idxVal treated as number
      let idxNum = Number(idxVal);
      if (!Number.isFinite(idxNum)) idxNum = 0;
      const newIdx = idxNum + 1;
      // write change under numeric prefix (for simplicity we'll keep changeKey as above, but we'll store numeric index as newIdx in CHANGES_INDEX_KEY)
      // Persist change under changeKey (already done).
      // Update CHANGES_INDEX_KEY to the new numeric value:
      await upstashSet(CHANGES_INDEX_KEY, String(newIdx));
      // merge snapshot
      const snapResp = await upstashGet(SNAPSHOT_KEY).catch(() => ({ result: null }));
      const snap = snapResp?.result ? (typeof snapResp.result === "string" ? JSON.parse(snapResp.result) : snapResp.result) : {};
      const merged = { ...snap, ...change };
      await upstashSet(SNAPSHOT_KEY, JSON.stringify(merged));
      return res.status(200).json({ ok: true, id, index: newIdx });
    }
  } catch (err) {
    console.error("appendChange error", err);
    res.status(500).json({ ok: false, error: String(err) });
  }
}
