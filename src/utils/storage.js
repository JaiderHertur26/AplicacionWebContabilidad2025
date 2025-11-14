// src/utils/storage.js
export const setActiveCompany = (company) => {
  localStorage.setItem('activeCompany', JSON.stringify(company));
};

export const getActiveCompany = () => {
  const company = localStorage.getItem('activeCompany');
  return company ? JSON.parse(company) : null;
};

export const saveAccounts = (accounts) => {
  const activeCompany = getActiveCompany();
  if (!activeCompany) return;
  localStorage.setItem(`${activeCompany.id}-accounts`, JSON.stringify(accounts));
};

export const getAccounts = () => {
  const activeCompany = getActiveCompany();
  if (!activeCompany) return [];
  const accounts = localStorage.getItem(`${activeCompany.id}-accounts`);
  return accounts ? JSON.parse(accounts) : [];
};

// 🔹 Transacciones por empresa
export const saveTransactions = (transactions) => {
  const activeCompany = getActiveCompany();
  if (!activeCompany) return;
  localStorage.setItem(`${activeCompany.id}-transactions`, JSON.stringify(transactions));
};

export const getTransactions = () => {
  const activeCompany = getActiveCompany();
  if (!activeCompany) return [];
  const transactions = localStorage.getItem(`${activeCompany.id}-transactions`);
  return transactions ? JSON.parse(transactions) : [];
};
