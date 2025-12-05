// /utils/localSync.js
import { v4 as uuidv4 } from "uuid";

const STORAGE_KEY = "APP_DATA_2025";
const STREAM_KEY = "changes_stream_v1";

function readLocal() {
  try {
    const d = localStorage.getItem(STORAGE_KEY);
    return d ? JSON.parse(d) : {};
  } catch {
    return {};
  }
}

function writeLocal(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function bootstrapIfNeeded() {
  const local = readLocal();
  if (local && Object.keys(local).length > 0) return;

  fetch("/api/bootstrap")
    .then(r => r.json())
    .then(remote => {
      if (!remote || !remote.data) return;
      writeLocal(remote.data);
    });
}

export function pushChangeLocalAndRemote(change) {
  const id = uuidv4();
  const local = readLocal();
  const updated = { ...local, ...change };
  writeLocal(updated);

  fetch("/api/push-change", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, change })
  });
}

export async function syncFromServer() {
  const r = await fetch("/api/sync?limit=200");
  const json = await r.json();
  if (!json || !json.items) return;

  let local = readLocal();

  json.items.forEach(i => {
    try {
      const c = JSON.parse(i[1].change);
      local = { ...local, ...c };
    } catch {}
  });

  writeLocal(local);
}
