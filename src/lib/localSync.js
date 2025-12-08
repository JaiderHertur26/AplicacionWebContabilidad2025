// src/lib/localSync.js
const STORAGE_KEY = "APP_DATA_2025";
const BOOTSTRAP_FLAG = "BOOTSTRAP_DONE";

/** lee localStorage (objeto) */
export function readLocal() {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

/** escribe localStorage con objeto (sobrescribe) */
export function writeLocal(data) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

/**
 * bootstrapIfNeeded()
 * - Si BOOTSTRAP_DONE === "YES" => no hace nada.
 * - Si no, pide GET /api/bootstrap, reemplaza localStorage con snapshot.data y marca BOOTSTRAP_DONE.
 */
export async function bootstrapIfNeeded() {
  if (typeof window === "undefined") return;
  try {
    if (localStorage.getItem(BOOTSTRAP_FLAG) === "YES") return;

    const resp = await fetch("/api/bootstrap", { method: "GET", cache: "no-store" });
    if (!resp.ok) {
      console.warn("bootstrap: server returned", resp.status);
      return;
    }

    const json = await resp.json();
    if (!json || !json.ok) {
      console.warn("bootstrap: invalid response", json);
      return;
    }

    if (!json.snapshot) {
      writeLocal({});
      localStorage.setItem(BOOTSTRAP_FLAG, "YES");
      return;
    }

    const { snapshot } = json;

    writeLocal(snapshot.data || {});
    localStorage.setItem(BOOTSTRAP_FLAG, "YES");
    localStorage.setItem("APP_LAST_BOOTSTRAP_TS", String(snapshot.timestamp || Date.now()));
  } catch (err) {
    console.error("bootstrapIfNeeded error:", err);
  }
}
