// AplicaciónWebContabilidad2025/src/lib/syncLocalStorage.js
export const syncLocalStorage = async () => {
  try {
    // Tomar todo el localStorage
    const localStorageData = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      localStorageData[key] = localStorage.getItem(key);
    }

    // Enviar al endpoint serverless de Vercel
    const res = await fetch('/api/syncLocalStorage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ localStorageData })
    });

    if (!res.ok) throw new Error('Error al sincronizar con GitHub');

    console.log('LocalStorage sincronizado en GitHub ✅');
  } catch (error) {
    console.error('Error sincronizando LocalStorage:', error);
  }
};
