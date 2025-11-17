import React from 'react';
import ReactDOM from 'react-dom/client';
import App from '@/App';
import '@/index.css';

import { loadLocalStorageFromSupabase, startAutoSync } from './syncLocalStorage.js';

(async () => {
  await loadLocalStorageFromSupabase();
  startAutoSync();
})();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
