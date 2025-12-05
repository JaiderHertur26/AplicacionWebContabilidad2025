import React, { createContext, useContext } from 'react';

export const CompanyContext = createContext();

export const useCompany = () => {
  return useContext(CompanyContext);
};