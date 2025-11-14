// src/components/SelectorEmpresa.jsx
import React from 'react';
import { useCompany } from '../App';
import { setActiveCompany } from '../utils/storage';
import { syncLocalStorage } from '../lib/syncLocalStorage';

export default function SelectorEmpresa({ companies, onCompanyChange }) {
  const { activeCompany, selectCompany } = useCompany();

  const handleChange = (e) => {
    const selectedId = e.target.value;
    const company = companies.find(c => c.id === selectedId);
    if (company) {
      selectCompany(company);           // Actualiza contexto
      setActiveCompany(company);        // Actualiza localStorage
      syncLocalStorage();               // Sincroniza con GitHub
      if (onCompanyChange) {
        onCompanyChange(company);       // Reinicia transacciones u otras cosas
      }
    }
  };

  return (
    <div className="mb-4">
      <label htmlFor="company-select" className="block text-sm font-medium text-gray-700">
        Seleccione empresa:
      </label>
      <select
        id="company-select"
        value={activeCompany?.id || ''}
        onChange={handleChange}
        className="mt-1 block w-full p-2 border border-gray-300 rounded-md"
      >
        <option value="" disabled>
          -- Seleccione --
        </option>
        {companies.map(company => (
          <option key={company.id} value={company.id}>
            {company.name}
          </option>
        ))}
      </select>
    </div>
  );
}
