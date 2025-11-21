// main.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from '@/App';
import '@/index.css';

import { loadLocalStorageFromServer, startAutoSync } from './syncLocalStorage.js';

(async () => {
  // 1️⃣ Restaurar lo que está en Upstash
  await loadLocalStorageFromServer();

  // 2️⃣ Iniciar auto sincronización
  startAutoSync(10000); // 10 segundos
})();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
