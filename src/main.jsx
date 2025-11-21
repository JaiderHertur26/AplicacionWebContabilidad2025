import React from "react";
import ReactDOM from "react-dom/client";
import App from "@/App";
import "@/index.css";

import { loadLocalStorageFromServer, startAutoSync } from "./syncLocalStorage";

(async () => {
  await loadLocalStorageFromServer();
  startAutoSync(10000);
})();

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
