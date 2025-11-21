// main.jsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "@/App";
import "@/index.css";

import {
  loadLocalStorageFromServer,
  startAutoSync
} from "./syncLocalStorage.js";

(async () => {
  // Restaurar datos desde Upstash antes de renderizar
  await loadLocalStorageFromServer();

  // Iniciar sincronización automática (10 segundos)
  startAutoSync(10000);
})();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
