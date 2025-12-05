// src/main.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from '@/App';
import '@/index.css';

import { restoreFromCloud, startAutoSync } from "./syncLocalStorage";

(async function () {
  await restoreFromCloud();
  startAutoSync();
})();

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
);
