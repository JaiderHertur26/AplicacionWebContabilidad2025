// api/sync/getChanges.js
const UPSTASH_URL = process.env.UPSTASH_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_TOKEN;

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
    const from = Number(req.query.from || "0");
    const idxResp = await upstashGet(CHANGES_INDEX_KEY).catch(() => ({ result: null }));
    const idxVal = idxResp?.result ?? null;

    // try parse as array
    let idxArr = null;
    try { idxArr = JSON.parse(idxVal); } catch { idxArr = null; }

    if (Array.isArray(idxArr)) {
      // legacy: return change objects from from..end
      const slice = idxArr.slice(from);
      const changes = [];
      for (const id of slice) {
        const cResp = await upstashGet(CHANGE_PREFIX + id).catch(() => ({ result: null }));
        const raw = cResp?.result ?? null;
        let parsed = null;
        try { parsed = JSON.parse(raw); } catch { parsed = raw; }
        changes.push({ id, change: parsed });
      }
      return res.status(200).json({ ok: true, changes, newIndex: idxArr.length });
    } else {
      // numeric-mode: remote index is a number N
      const remoteIndex = Number(idxVal || 0);
      if (!Number.isFinite(remoteIndex)) return res.status(200).json({ ok: true, changes: [], newIndex: 0 });
      // try fetch change keys by scanning CHANGES_INDEX_KEY style names is not possible here but we saved changes under change_v1:<id>, so numeric mode not returning actual list
      // To keep compatibility, respond instructing the client to fetch snapshot.
      return res.status(200).json({ ok: true, changes: [], newIndex: remoteIndex, snapshotNeeded: true });
    }
  } catch (err) {
    console.error("getChanges error", err);
    res.status(500).json({ ok: false, error: String(err) });
  }
}
