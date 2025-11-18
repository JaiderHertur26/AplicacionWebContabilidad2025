// ===============================
// MAIN.JSX - CARGA Y AUTOSYNC
// ===============================
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from '@/App';
import '@/index.css';

import { loadLocalStorageFromSupabase, startAutoSync } from './syncLocalStorage.js';

(async () => {
  try {
    console.log('⏬ Cargando datos desde Supabase...');
    await loadLocalStorageFromSupabase();
    console.log('✔ Datos cargados en LocalStorage.');

    console.log('🔄 Iniciando AutoSync...');
    startAutoSync();

    ReactDOM.createRoot(document.getElementById('root')).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
  } catch (error) {
    console.error('❌ Error al iniciar la app:', error);
  }
})();
