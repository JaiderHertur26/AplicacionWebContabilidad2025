// main.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from '@/App';
import '@/index.css';

import { loadLocalStorageFromServer, startAutoSync } from './syncLocalStorage.js';

(async () => {
  // Restaurar snapshot desde la nube de forma segura
  await loadLocalStorageFromServer();

  // Iniciar sincronización automática (protegida)
  startAutoSync(10000); // puedes cambiar el intervalo aquí
})();

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
);
