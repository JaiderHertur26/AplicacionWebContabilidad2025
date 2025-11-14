// src/components/FormularioTransaccion.jsx
import React, { useState } from 'react';
import { useCompany } from '../App';

export default function FormularioTransaccion() {
  const { activeCompany, addTransaction } = useCompany();
  const [desc, setDesc] = useState('');
  const [amount, setAmount] = useState('');

  if (!activeCompany) return <p>Seleccione una empresa para agregar transacciones.</p>;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!desc || !amount) return;

    const newTransaction = {
      id: `${Date.now()}`,
      description: desc,
      amount: parseFloat(amount),
      date: new Date().toISOString()
    };

    addTransaction(newTransaction);

    setDesc('');
    setAmount('');
  };

  return (
    <form onSubmit={handleSubmit} className="mb-6 flex gap-2">
      <input
        type="text"
        placeholder="Descripción"
        value={desc}
        onChange={e => setDesc(e.target.value)}
        className="border p-2 rounded flex-1"
      />
      <input
        type="number"
        placeholder="Monto"
        value={amount}
        onChange={e => setAmount(e.target.value)}
        className="border p-2 rounded w-24"
      />
      <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded">
        Agregar
      </button>
    </form>
  );
}
