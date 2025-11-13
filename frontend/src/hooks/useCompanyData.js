// src/hooks/useCompanyData.js
import { useState, useEffect } from "react";
import { useRemoteData } from "./useRemoteData";

export function useCompanyData(key) {
  const [data, setData] = useState([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const { getData, saveData } = useRemoteData("empresa_datos.json");

  // 🔹 Cargar desde localStorage y GitHub al iniciar
  useEffect(() => {
    const local = JSON.parse(localStorage.getItem(key) || "[]");
    setData(local);

    // Sincronizar con GitHub
    getData().then((remote) => {
      if (remote[key]) {
        setData(remote[key]);
        localStorage.setItem(key, JSON.stringify(remote[key]));
      }
      setIsLoaded(true);
    });
  }, [key]);

  // 🔹 Guardar local y remoto
  const save = async (newData) => {
    setData(newData);
    localStorage.setItem(key, JSON.stringify(newData));

    // Actualizar GitHub remoto
    const remote = await getData();
    remote[key] = newData;
    await saveData(remote);
  };

  return [data, save, isLoaded];
}
