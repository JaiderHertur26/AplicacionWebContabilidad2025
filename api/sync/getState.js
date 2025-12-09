// api/sync/getState.js
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

export default async function handler(req, res) {
  try {
    // read snapshot
    const snapResp = await upstashGet(SNAPSHOT_KEY).catch(() => ({ result: null }));
    const snapVal = snapResp?.result ?? null;

    // read index
    const idxResp = await upstashGet(CHANGES_INDEX_KEY).catch(() => ({ result: null }));
    let idxVal = idxResp?.result ?? null;

    // normalize index: could be stringified array or string number
    let idxArr = null;
    try {
      const parsed = JSON.parse(idxVal);
      if (Array.isArray(parsed)) idxArr = parsed;
    } catch (e) { /* not JSON array */ }

    // if idxArr is null, idxVal may be a number string
    if (!Array.isArray(idxArr)) {
      // treat idxVal as numeric mode length (0 if missing)
      const n = Number(idxVal);
      if (Number.isFinite(n)) {
        // numeric mode — we won't return the full list (caller can request changes by index)
        idxArr = null;
      } else {
        idxVal = null;
      }
    }

    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({
      ok: true,
      snapshot: snapVal ? (typeof snapVal === "string" ? JSON.parse(snapVal) : snapVal) : null,
      indexArray: idxArr, // if non-null: the array of ids (legacy); otherwise null
      indexNumber: Array.isArray(idxArr) ? idxArr.length : (idxVal ? Number(idxVal) : 0)
    });
  } catch (err) {
    console.error("getState error", err);
    res.status(500).json({ ok: false, error: String(err) });
  }
}
