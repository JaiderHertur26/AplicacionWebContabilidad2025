// ===============================
// MAIN.JSX
// ===============================
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from '@/App';
import '@/index.css';
import { loadLocalStorageFromJSON, startAutoSync } from './syncLocalStorage.js';

(async () => {
  try {
    console.log('⏬ Cargando datos desde localStorage...');
    await loadLocalStorageFromJSON();
    console.log('✔ Datos cargados en localStorage.');

    console.log('🔄 Iniciando AutoSync...');
    startAutoSync();

    ReactDOM.createRoot(document.getElementById('root')).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
  } catch (err) {
    console.error('❌ Error iniciando app:', err);
  }
})();
