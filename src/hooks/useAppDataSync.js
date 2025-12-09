import { useEffect, useRef } from "react";

export function useAppDataSync(appState) {
  const skip = useRef(false);

  // Guardar al cambiar el estado
  useEffect(() => {
    if (skip.current) {
      skip.current = false;
      return;
    }

    try {
      const obj = {};
      for (const key in appState) {
        obj[key] = appState[key].value;
      }
      localStorage.setItem("APP_DATA_2025", JSON.stringify(obj));
    } catch (e) {
      console.error("Error guardando APP_DATA_2025", e);
    }
  }, Object.values(appState).map(v => v.value));


  // Cargar al inicio
  useEffect(() => {
    try {
      const raw = localStorage.getItem("APP_DATA_2025");
      if (!raw) return;

      const parsed = JSON.parse(raw);
      skip.current = true;

      for (const key in parsed) {
        if (appState[key]?.set) {
          appState[key].set(parsed[key]);
        }
      }
    } catch (err) {
      console.error("Error leyendo APP_DATA_2025", err);
    }
  }, []);
}
