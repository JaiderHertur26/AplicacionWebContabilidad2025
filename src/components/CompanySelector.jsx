import React from 'react';
import { setActiveCompany } from '../utils/storage';

export default function CompanySelector({ companies }) {
  const handleCompanyChange = (e) => {
    const selectedId = e.target.value;
    const selectedCompany = companies.find(c => c.id === selectedId);
    if (selectedCompany) {
      setActiveCompany(selectedCompany);
      window.location.reload(); // recarga para reflejar cambios
    }
  };

  return (
    <select onChange={handleCompanyChange}>
      {companies.map(company => (
        <option key={company.id} value={company.id}>
          {company.name}
        </option>
      ))}
    </select>
  );
}
