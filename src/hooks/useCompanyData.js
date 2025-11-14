import { useEffect, useState, useRef, useCallback } from 'react';
import { useCompany } from '@/App';

const GITHUB_RAW_URL =
  "https://raw.githubusercontent.com/JaiderHertur26/AplicacionWebContabilidad/main/data.json";

export function useCompanyData(storageKey) {
  const { activeCompany } = useCompany();
  const [data, setData] = useState([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const isMounted = useRef(false);

  const companyStorageKey = activeCompany
    ? `${activeCompany.id}-${storageKey}`
    : null;

  // ============================================================
  // 🔹 1. LEER DATOS DESDE GITHUB (VERSIÓN CORREGIDA)
  // ============================================================
  const fetchFromGithub = async () => {
    try {
      const res = await fetch(GITHUB_RAW_URL, { cache: "no-cache" });
      if (!res.ok) return [];

      const json = await res.json();
      if (!activeCompany) return [];

      const companyKey = `${activeCompany.id}-${storageKey}`;

      // Retorna el bloque exacto por key
      return json[companyKey] || [];

    } catch (err) {
      console.error("❌ Error cargando desde GitHub:", err);
      return [];
    }
  };

  // ============================================================
  // 🔹 2. CARGAR DATA INICIAL (GitHub → LocalStorage → App)
  // ============================================================
  useEffect(() => {
    isMounted.current = true;
    setIsLoaded(false);

    if (!companyStorageKey) {
      setData([]);
      setIsLoaded(true);
      return;
    }

    const loadData = async () => {
      // 1. Intentar cargar desde GitHub
      const githubData = await fetchFromGithub();

      if (isMounted.current) {
        if (githubData && githubData.length > 0) {
          setData(githubData);
          localStorage.setItem(companyStorageKey, JSON.stringify(githubData));
          setIsLoaded(true);
          return;
        }

        // 2. Si GitHub no tiene nada, usar localStorage
        const stored = localStorage.getItem(companyStorageKey);
        setData(stored ? JSON.parse(stored) : []);
        setIsLoaded(true);
      }
    };

    loadData();

    return () => {
      isMounted.current = false;
    };
  }, [companyStorageKey, activeCompany]);

  // ============================================================
  // 🔹 3. GUARDAR DATA Y SINCRONIZAR TODO EL LOCALSTORAGE A GITHUB
  // ============================================================
  const saveData = useCallback(
    (newData, options = {}) => {
      if (!companyStorageKey) return;

      // 1. Guardar normalmente en localStorage
      localStorage.setItem(companyStorageKey, JSON.stringify(newData));

      if (isMounted.current && !options.silent) {
        setData(newData);
      }

      // Notificar cambios internos
      window.dispatchEvent(
        new CustomEvent("storage-updated", {
          detail: { key: companyStorageKey },
        })
      );

      // 2. COPIA COMPLETA DEL LOCALSTORAGE
      const full = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        try {
          full[key] = JSON.parse(localStorage.getItem(key));
        } catch {
          full[key] = localStorage.getItem(key);
        }
      }

      // 3. ENVIAR TOTAL A GITHUB
      fetch("/api/saveToGithub", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: `Sync localStorage → GitHub (${companyStorageKey})`,
          content: full
        }),
      });
    },
    [companyStorageKey]
  );

  // ============================================================
  // 🔹 4. ESCUCHAR CAMBIOS DE OTRAS PARTES DE LA APP
  // ============================================================
  useEffect(() => {
    const handleStorageUpdate = (event) => {
      if (event.detail.key === companyStorageKey) {
        try {
          const stored = localStorage.getItem(companyStorageKey);
          if (isMounted.current) {
            setData(stored ? JSON.parse(stored) : []);
          }
        } catch (error) {
          console.error(`Error reload ${companyStorageKey}`, error);
        }
      }
    };

    window.addEventListener("storage-updated", handleStorageUpdate);

    return () => {
      window.removeEventListener("storage-updated", handleStorageUpdate);
    };
  }, [companyStorageKey]);

  // ============================================================
  // 🔹 RETURN FINAL
  // ============================================================
  return [data, saveData, isLoaded];
}
