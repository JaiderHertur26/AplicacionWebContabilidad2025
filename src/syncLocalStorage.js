// syncLocalStorage.js
// -------------------------------------------------------------
// Sincroniza automáticamente todos los datos de localStorage,
// maneja restauraciones, backups y notifica a los componentes
// que usan useCompanyData.
// -------------------------------------------------------------

export const STORAGE_EVENT = "storage-updated-global";

// Registrar un evento global cuando se restaure localStorage
export function broadcastFullSync() {
    window.dispatchEvent(new CustomEvent(STORAGE_EVENT));
}

// -------------------------------------------------------------
// Obtener todas las claves pertenecientes a una empresa
// Formato:   companyId-storageKey
// Ejemplo:   12345-transactions
// -------------------------------------------------------------
export function getCompanyKeys(companyId) {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.startsWith(companyId + "-")) {
            keys.push(key);
        }
    }
    return keys;
}

// -------------------------------------------------------------
// Exportar toda la información de una empresa
// Devuelve un objeto JSON listo para guardar como backup
// -------------------------------------------------------------
export function exportCompanyData(companyId) {
    const keys = getCompanyKeys(companyId);
    const data = {};

    keys.forEach(key => {
        try {
            data[key] = JSON.parse(localStorage.getItem(key));
        } catch {
            data[key] = localStorage.getItem(key);
        }
    });

    return data;
}

// -------------------------------------------------------------
// Importar datos restaurados para una empresa
// Sobrescribe todo para esa empresa
// -------------------------------------------------------------
export function importCompanyData(companyId, jsonData) {
    // Eliminar datos viejos
    const oldKeys = getCompanyKeys(companyId);
    oldKeys.forEach(k => localStorage.removeItem(k));

    // Cargar datos nuevos
    Object.entries(jsonData).forEach(([key, value]) => {
        localStorage.setItem(key, JSON.stringify(value));
    });

    // Avisar a todos los componentes
    broadcastFullSync();
}

// -------------------------------------------------------------
// Sincronización automática entre pestañas (Cross-tab sync)
// -------------------------------------------------------------
function initCrossTabListener() {
    window.addEventListener("storage", (event) => {
        if (!event.key) return;

        // Avisar a todos los hooks useCompanyData
        window.dispatchEvent(
            new CustomEvent("storage-updated", {
                detail: { key: event.key }
            })
        );
    });
}

initCrossTabListener();

// -------------------------------------------------------------
// Forzar una recarga de todos los componentes reactivos
// (cuando algo externo modifica localStorage)
// -------------------------------------------------------------
export function forceRefreshAll() {
    broadcastFullSync();
}
