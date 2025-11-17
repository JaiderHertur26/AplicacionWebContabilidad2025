import React from 'react';
import ReactDOM from 'react-dom/client';
import App from '@/App';
import '@/index.css';

// ⬇️ Importa la sincronización ANTES de renderizar React
import { loadLocalStorageFromSupabase, startAutoSync } from './syncLocalStorage.js';

(async () => {
  // 1️⃣ Cargar datos desde Supabase → LocalStorage
  await loadLocalStorageFromSupabase();

  // 2️⃣ Iniciar sincronización automática cada vez que localStorage cambie
  startAutoSync();

  // 3️⃣ Renderizar la App SOLO cuando ya se cargó todo
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
})();
