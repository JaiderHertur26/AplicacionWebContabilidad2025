// main.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from '@/App';
import '@/index.css';

import {
  loadLocalStorageFromServer,
  startAutoSync
} from './syncLocalStorage.js';

// ==============================
// 1️⃣ Cargar snapshot de Upstash
// ==============================
(async () => {
  await loadLocalStorageFromServer();  // Recupera datos remotos

  // ==============================
  // 2️⃣ Iniciar sincronización automática
  //     (por defecto cada 3 segundos)
  // ==============================
  startAutoSync();  // Puedes poner startAutoSync(2000) si quieres 2 segundos
})();

// ==============================
// 3️⃣ Montar la aplicación React
// ==============================
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
