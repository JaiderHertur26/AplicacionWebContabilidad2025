import React from 'react';
import ReactDOM from 'react-dom/client';
import App from '@/App';
import '@/index.css';

import { loadLocalStorageFromServer, startAutoSync } from './syncLocalStorage.js';

(async () => {
  await loadLocalStorageFromServer(); // 1️⃣ carga lo que está en Upstash
  startAutoSync();                    // 2️⃣ empieza a sincronizar
})();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
