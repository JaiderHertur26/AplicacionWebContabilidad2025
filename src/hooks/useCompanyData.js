// src/hooks/useCompanyData.js
import { useState, useEffect } from 'react';
import { getAccounts, saveAccounts } from '../utils/storage';

/**
 * Hook para manejar datos de la empresa activa.
 * type: 'accounts' por ahora, pero puedes ampliar a otros tipos.
 */
export const useCompanyData = (type) => {
  const [data, setData] = useState([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    let storedData = [];
    if (type === 'accounts') {
      storedData = getAccounts();
    }
    setData(storedData);
    setIsLoaded(true);
  }, [type]);

  const saveData = (newData) => {
    setData(newData);
    if (type === 'accounts') {
      saveAccounts(newData);
    }
  };

  return [data, saveData, isLoaded];
};
