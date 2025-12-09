import localSync from "./localSync";
const { pushChangeLocalAndCloud } = localSync;
import { pushChangeLocalAndCloud } from "./localSync";

// Referencias originales
const originalSetItem = localStorage.setItem;
const originalRemoveItem = localStorage.removeItem;
const originalClear = localStorage.clear;

let syncing = false;

async function notifyChange() {
    if (syncing) return;
    syncing = true;

    try {
        await pushChangeLocalAndCloud();
    } catch (err) {
        console.error("Error sincronizando local/cloud:", err);
    }

    syncing = false;
}

localStorage.setItem = function (key, value) {
    originalSetItem.call(this, key, value);
    notifyChange();
};

localStorage.removeItem = function (key) {
    originalRemoveItem.call(this, key);
    notifyChange();
};

localStorage.clear = function () {
    originalClear.call(this);
    notifyChange();
};

console.log("LocalStorage Sync Hook activo ✔️");
