// src/syncLocalStorage.js
const API_GET = "/api/getSnapshot";
const API_SAVE = "/api/saveSnapshot";
const SESSION_FLAG = "app_boot_completed";

// lee todo localStorage y devuelve objeto { key: value }
function readAllLocalStorage() {
  const out = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    try {
      out[k] = JSON.parse(localStorage.getItem(k));
    } catch {
      out[k] = localStorage.getItem(k);
    }
  }
  return out;
}

// reemplaza localStorage con objeto dado (borra primero)
function writeAllLocalStorage(obj) {
  localStorage.clear();
  if (!obj) return;
  for (const k of Object.keys(obj)) {
    try {
      localStorage.setItem(k, JSON.stringify(obj[k]));
    } catch {
      localStorage.setItem(k, String(obj[k]));
    }
  }
}

// 1) Restaurar desde la nube SOLO la primera vez al abrir (sessionStorage distingue reload)
export async function restoreFromCloud() {
  const booted = sessionStorage.getItem(SESSION_FLAG);
  if (booted) return;

  try {
    const res = await fetch(API_GET, { cache: "no-store" });
    if (!res.ok) {
      sessionStorage.setItem(SESSION_FLAG, "true");
      return;
    }

    const json = await res.json();
    if (!json.ok) {
      sessionStorage.setItem(SESSION_FLAG, "true");
      return;
    }

    if (json.data && typeof json.data === "object") {
      writeAllLocalStorage(json.data);
    }

    sessionStorage.setItem(SESSION_FLAG, "true");
  } catch (err) {
    console.warn("restoreFromCloud failed", err);
    sessionStorage.setItem(SESSION_FLAG, "true");
  }
}

// push a la nube: usa sendBeacon si es posible para seguridad en unload; fallback fetch keepalive
async function pushSnapshot(snapshot) {
  try {
    const body = JSON.stringify(snapshot);

    // prefer sendBeacon for reliability on unload
    if (navigator.sendBeacon) {
      const ok = navigator.sendBeacon(API_SAVE, body);
      if (ok) return;
      // if sendBeacon failed fall through to fetch
    }

    // fetch with keepalive
    await fetch(API_SAVE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    });
  } catch (err) {
    console.warn("pushSnapshot failed", err);
  }
}

let debounceTimer = null;
function schedulePush(snapshot) {
  if (debounceTimer) clearTimeout(debounceTimer);
  // ultra-rapid debounce to batch extremely fast consecutive writes (50 ms)
  debounceTimer = setTimeout(() => {
    pushSnapshot(snapshot);
    debounceTimer = null;
  }, 50);
}

// 2) Interceptar setItem para detectar cambios locales y subirlos
export function startAutoSync() {
  // inicial lastState
  let lastState = JSON.stringify(readAllLocalStorage());

  // override setItem to trigger push
  const originalSet = Storage.prototype.setItem;
  Storage.prototype.setItem = function (key, value) {
    originalSet.apply(this, [key, value]);
    const current = JSON.stringify(readAllLocalStorage());
    if (current !== lastState) {
      lastState = current;
      try {
        schedulePush(JSON.parse(current));
      } catch {
        schedulePush({ raw: current });
      }
    }
  };

  // listen to storage events from other tabs (keeps lastState consistent)
  window.addEventListener("storage", () => {
    lastState = JSON.stringify(readAllLocalStorage());
  });
}
