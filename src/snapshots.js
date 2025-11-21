// snapshots.js — utilidades de respaldo local y restauración segura

// Generar backup local (en sessionStorage) antes de cualquier sobrescritura
export function createLocalBackup() {
  try {
    const backup = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      backup[key] = localStorage.getItem(key);
    }
    sessionStorage.setItem('local_backup_' + Date.now(), JSON.stringify(backup));
    console.log('🔐 Backup local creado');
  } catch (e) {
    console.error('Error creando backup local:', e);
  }
}

// Restaurar desde el backup más reciente
export function restoreFromLatestBackup() {
  try {
    // Buscar claves de backup en sessionStorage
    const keys = Object.keys(sessionStorage).filter(k => k.startsWith('local_backup_'));
    if (keys.length === 0) {
      console.warn('No hay backups locales disponibles');
      return false;
    }

    // Ordenar por timestamp y tomar la más reciente
    keys.sort();
    const latest = keys[keys.length - 1];
    const data = JSON.parse(sessionStorage.getItem(latest));

    Object.keys(data).forEach(k => localStorage.setItem(k, data[k]));
    console.log('🔄 Restaurado desde backup local:', latest);
    return true;
  } catch (e) {
    console.error('Error restaurando backup local:', e);
    return false;
  }
}
