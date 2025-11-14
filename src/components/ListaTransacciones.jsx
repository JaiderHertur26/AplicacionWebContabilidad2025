// src/components/ListaTransacciones.jsx
import React from 'react';
import { useCompany } from '../App';

export default function ListaTransacciones() {
  const { activeCompany, transactions } = useCompany();

  if (!activeCompany) return <p>Seleccione una empresa para ver las transacciones.</p>;

  if (transactions.length === 0) return <p>No hay transacciones registradas aún.</p>;

  return (
    <div>
      <h3 className="mb-2 font-semibold">Transacciones de {activeCompany.name}</h3>
      <ul className="list-disc pl-5">
        {transactions.map(t => (
          <li key={t.id}>
            {t.date.split('T')[0]} - {t.description} - ${t.amount.toFixed(2)}
          </li>
        ))}
      </ul>
    </div>
  );
}
