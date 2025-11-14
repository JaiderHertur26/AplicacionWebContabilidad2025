import React from 'react';
import ReactDOM from 'react-dom/client';
import App from '@/App';
import '@/index.css';
import { loadLocalStorageFromGitHub, startAutoSync } from './syncLocalStorage.js'; // <- IMPORTA AQUÍ

// Carga inicial y auto-sync
(async () => {
  await loadLocalStorageFromGitHub(); // carga inicial
  startAutoSync(5000);                 // sincronización automática cada 5s
})();

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
);
