// main.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from '@/App';
import '@/index.css';

import { enableCloudSync } from './syncLocalStorage';

// -------------------------------------------------
// 1. Activar sincronización automática con la nube
// -------------------------------------------------
enableCloudSync();

// -------------------------------------------------
// 2. Restaurar LocalStorage desde Upstash antes de cargar la app
// -------------------------------------------------
async function restoreSnapshot() {
  try {
    const res = await fetch('/api/sync');
    const data = await res.json();

    if (data) {
      Object.keys(data).forEach((k) => {
        localStorage.setItem(k, data[k]);
      });

      console.log('☁ LocalStorage restaurado desde la nube');
    }
  } catch (e) {
    console.warn('⚠ No se pudo restaurar snapshot desde la nube:', e);
  }
}

// Restaurar datos y luego montar la app
restoreSnapshot().then(() => {
  ReactDOM.createRoot(document.getElementById('root')).render(
    <App />
  );
});
