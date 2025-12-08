// src/main.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from '@/App';
import '@/index.css';

// 🚀 ACTIVAR EL HOOK UNIVERSAL antes de cargar la app
import "@/lib/localStorageSyncHook";

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
);
