import { useEffect, useState, useRef, useCallback } from 'react';
import { useCompany } from '@/App';

const GITHUB_RAW_URL = "https://raw.githubusercontent.com/JaiderHertur26/AplicacionWebContabilidad/main/data.json";

export function useCompanyData(storageKey) {
    const { activeCompany } = useCompany();
    const [data, setData] = useState([]);
    const [isLoaded, setIsLoaded] = useState(false);
    const isMounted = useRef(false);

    const companyStorageKey = activeCompany ? `${activeCompany.id}-${storageKey}` : null;

    // 🔹 1. Leer desde GitHub
    const fetchFromGithub = async () => {
        try {
            const res = await fetch(GITHUB_RAW_URL);
            const json = await res.json();

            // Cada empresa tendrá su propia data
            if (!activeCompany) return [];

            const companyId = activeCompany.id;

            // Estructura: json[empresaId][tipo]
            if (!json[companyId]) return [];

            return json[companyId][storageKey] || [];

        } catch (err) {
            console.error("Error cargando desde GitHub:", err);
            return [];
        }
    };

    useEffect(() => {
        isMounted.current = true;
        setIsLoaded(false);

        if (!companyStorageKey) {
            setData([]);
            setIsLoaded(true);
            return;
        }

        const loadData = async () => {
            // 🔹 Primero intentamos cargar desde GitHub
            const githubData = await fetchFromGithub();

            if (isMounted.current && githubData.length > 0) {
                setData(githubData);
                setIsLoaded(true);

                // Guardamos copia local (caché)
                localStorage.setItem(companyStorageKey, JSON.stringify(githubData));
                return;
            }

            // 🔹 Si GitHub no trae nada, usar localStorage
            try {
                const stored = localStorage.getItem(companyStorageKey);
                if (isMounted.current) {
                    setData(stored ? JSON.parse(stored) : []);
                }
            } catch (error) {
                console.error(`Error parsing ${companyStorageKey}`, error);
                setData([]);
            } finally {
                if (isMounted.current) {
                    setIsLoaded(true);
                }
            }
        };

        loadData();

        return () => {
            isMounted.current = false;
        };

    }, [companyStorageKey, activeCompany]);


    // 🔹 SaveData (esto aún guarda solo en localStorage)
    const saveData = useCallback((newData, options = {}) => {

        if (companyStorageKey) {
            localStorage.setItem(companyStorageKey, JSON.stringify(newData));

            if (isMounted.current && !options.silent) {
                setData(newData);
            }

            window.dispatchEvent(new CustomEvent('storage-updated', {
                detail: { key: companyStorageKey }
            }));
        }
    }, [companyStorageKey]);



    // 🔹 Listener para cambios externos
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

        window.addEventListener('storage-updated', handleStorageUpdate);

        return () => {
            window.removeEventListener('storage-updated', handleStorageUpdate);
        };
    }, [companyStorageKey]);

    return [data, saveData, isLoaded];
}
