import React from 'react';
import ReactDOM from 'react-dom/client';
import App from '@/App';
import '@/index.css';

import { restoreFromCloud, startAutoSync } from "./syncLocalStorage";

(async function () {
  // 1. Restaurar desde la nube con blindaje
  await restoreFromCloud();

  // 2. Iniciar sincronización automática
  startAutoSync();
})();

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
);
