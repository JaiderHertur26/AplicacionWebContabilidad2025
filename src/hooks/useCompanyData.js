
import { useEffect, useState, useRef, useCallback } from 'react';
import { useCompany } from '@/App';

export function useCompanyData(storageKey) {
    const { activeCompany } = useCompany();
    const [data, setData] = useState([]);
    const [isLoaded, setIsLoaded] = useState(false); // New loading state
    const isMounted = useRef(false);
    
    const companyStorageKey = activeCompany ? `${activeCompany.id}-${storageKey}` : null;

    useEffect(() => {
        isMounted.current = true;
        setIsLoaded(false); // Reset on key change

        if (companyStorageKey) {
            try {
                const stored = localStorage.getItem(companyStorageKey);
                if (isMounted.current) {
                    setData(stored ? JSON.parse(stored) : []);
                }
            } catch (error) {
                console.error(`Error parsing ${companyStorageKey} from localStorage`, error);
                if (isMounted.current) {
                    setData([]);
                }
            } finally {
                if(isMounted.current) {
                    setIsLoaded(true); // Mark as loaded
                }
            }
        } else {
            if (isMounted.current) {
                setData([]);
                setIsLoaded(true); // Also loaded if no key
            }
        }
        return () => {
            isMounted.current = false;
        };
    }, [companyStorageKey]);

    const saveData = useCallback((newData, options = {}) => {
        if (companyStorageKey) {
            localStorage.setItem(companyStorageKey, JSON.stringify(newData));
            if (isMounted.current && !options.silent) {
                setData(newData);
            }
            // Dispatch event for other components to listen to storage changes
            window.dispatchEvent(new CustomEvent('storage-updated', { detail: { key: companyStorageKey }}));
        }
    }, [companyStorageKey]);

    // Listener for external storage changes (like restore)
    useEffect(() => {
        const handleStorageUpdate = (event) => {
            if (event.detail.key === companyStorageKey) {
                try {
                    const stored = localStorage.getItem(companyStorageKey);
                    if (isMounted.current) {
                        setData(stored ? JSON.parse(stored) : []);
                    }
                } catch (error) {
                    console.error(`Error reloading ${companyStorageKey} from localStorage`, error);
                }
            }
        };

        window.addEventListener('storage-updated', handleStorageUpdate);
        return () => {
            window.removeEventListener('storage-updated', handleStorageUpdate);
        };
    }, [companyStorageKey]);


    return [data, saveData, isLoaded]; // Return loading state
}
