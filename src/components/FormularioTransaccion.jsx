import React, { useState } from 'react';
import { getAccounts, saveAccounts } from '../utils/storage';

export default function FormularioTransaccion() {
  const [transaction, setTransaction] = useState({});

  const handleSubmit = (e) => {
    e.preventDefault();
    const accounts = getAccounts(); // cuentas de la empresa activa
    accounts.push(transaction);     // agregamos movimiento
    saveAccounts(accounts);         // guardamos en la empresa correcta
    setTransaction({});             // limpiar formulario
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* campos del formulario */}
      <input
        type="text"
        placeholder="Nombre transacción"
        value={transaction.name || ''}
        onChange={(e) => setTransaction({...transaction, name: e.target.value})}
      />
      <button type="submit">Agregar</button>
    </form>
  );
}
