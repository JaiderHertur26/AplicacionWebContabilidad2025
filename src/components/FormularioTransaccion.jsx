import { syncLocalStorage } from "../lib/syncLocalStorage";

const handleSave = (nuevoDato) => {
  // Guardar en localStorage
  localStorage.setItem("datoImportante", JSON.stringify(nuevoDato));

  // Sincronizar con GitHub
  syncLocalStorage();
};
