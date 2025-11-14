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
