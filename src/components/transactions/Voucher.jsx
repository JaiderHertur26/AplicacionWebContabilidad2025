
import React from 'react';
import { useCompany } from '@/App';
import { numberToWords } from '@/lib/numberToWords';

const VoucherContent = ({ transaction }) => {
  const { activeCompany } = useCompany();

  if (!transaction || !activeCompany) return <div className="p-8 text-center text-slate-500">Cargando datos...</div>;

  const contacts = JSON.parse(localStorage.getItem(`${activeCompany.id}-contacts`) || '[]');
  const contact = contacts.find(c => c.id === transaction.contactId);
  const accounts = JSON.parse(localStorage.getItem(`${activeCompany.id}-accounts`) || '[]');
  const account = accounts.find(acc => acc.name === transaction.category);

  const dateObj = new Date(transaction.date);
  const userTimezoneOffset = dateObj.getTimezoneOffset() * 60000;
  const date = new Date(dateObj.getTime() + userTimezoneOffset);
  const day = date.getDate();
  const month = date.toLocaleString('es-ES', { month: 'long' }).toUpperCase();
  const year = date.getFullYear();

  const amount = transaction.amount ? parseFloat(transaction.amount) : 0;
  const amountInWords = numberToWords(amount);
  
  let voucherType = '';
  let voucherPrefix = '';
  if(transaction.isInternalTransfer) {
      voucherType = 'Transferencia';
      voucherPrefix = 'T';
  } else if (transaction.type === 'income') {
      voucherType = 'Ingreso';
      voucherPrefix = 'I';
  } else {
      voucherType = 'Egreso';
      voucherPrefix = 'E';
  }

  const voucherNumber = transaction.voucherNumber ? `${voucherPrefix}-${String(transaction.voucherNumber).padStart(4, '0')}` : 'N/A';

  return (
    <div className="p-4 bg-white font-sans text-xs flex flex-col justify-between" style={{ width: '100%', height: '100%', border: '1px solid #000' }}>
      <div>
        <header className="flex justify-between items-start pb-2 mb-2 border-b-2 border-black">
          <div className="w-2/3 text-center">
            <h1 className="font-bold text-base uppercase">{activeCompany.name || 'NOMBRE EMPRESA'}</h1>
            <p>{activeCompany.name || 'NOMBRE EMPRESA'}</p>
            <p>NIT: {activeCompany.doc || 'NIT EMPRESA'}</p>
            <p>{activeCompany.address || 'DIRECCIÓN EMPRESA'} - Tel: {activeCompany.phone || 'TELÉFONO'}</p>
          </div>
          <div className="w-1/3">
            <table className="text-xs border-collapse w-full" style={{border: '1px solid black'}}>
              <tbody>
                <tr><td className="font-bold p-1 bg-gray-200" style={{border: '1px solid black'}}>FECHA REGISTRO:</td><td className="p-1 text-center" style={{border: '1px solid black'}}>{date.toLocaleDateString('es-ES')}</td></tr>
                <tr><td className="font-bold p-1 bg-gray-200" style={{border: '1px solid black'}}>N° COMPROBANTE:</td><td className="font-bold text-red-600 text-center p-1" style={{border: '1px solid black'}}>{voucherNumber}</td></tr>
              </tbody>
            </table>
          </div>
        </header>

        <section className="flex justify-between items-center my-2">
            <div className="w-2/3">
                <p className="font-bold text-base text-center bg-gray-200 p-1" style={{border: '1px solid black'}}>COMPROBANTE DE {voucherType.toUpperCase()}</p>
            </div>
            <div className="w-1/3 pl-2">
                <table className="text-xs border-collapse w-full" style={{border: '1px solid black'}}>
                    <thead><tr><th className="font-bold bg-gray-200 p-1" style={{border: '1px solid black'}}>DÍA</th><th className="font-bold bg-gray-200 p-1" style={{border: '1px solid black'}}>MES</th><th className="font-bold bg-gray-200 p-1" style={{border: '1px solid black'}}>AÑO</th></tr></thead>
                    <tbody><tr><td className="text-center p-1" style={{border: '1px solid black'}}>{String(day).padStart(2,'0')}</td><td className="text-center p-1" style={{border: '1px solid black'}}>{month}</td><td className="text-center p-1" style={{border: '1px solid black'}}>{year}</td></tr></tbody>
                </table>
            </div>
        </section>

        <section className="flex">
          <div className="w-3/4 pr-2">
            <table className="w-full text-xs border-collapse" style={{border: '1px solid black'}}>
              <tbody>
                <tr><td className="font-bold p-1 w-1/4" style={{border: '1px solid black'}}>{transaction.type === 'income' ? 'RECIBO DE:' : 'PAGADO A:'}</td><td className="p-1" style={{border: '1px solid black'}}>{contact?.name || 'Varios'}</td></tr>
                <tr><td className="font-bold p-1" style={{border: '1px solid black'}}>CONCEPTO:</td><td className="p-1" style={{border: '1px solid black'}}>{transaction.description}</td></tr>
                <tr><td className="font-bold p-1" style={{border: '1px solid black'}}>SUMA:</td><td className="uppercase p-1" style={{border: '1px solid black'}}>{amountInWords} PESOS</td></tr>
              </tbody>
            </table>
          </div>
          <div className="w-1/4">
            <table className="w-full h-full text-xs border-collapse" style={{border: '1px solid black'}}>
                <tbody>
                    <tr><td className="font-bold text-center bg-gray-200 p-1" style={{border: '1px solid black'}}>VALOR:</td></tr>
                    <tr><td className="font-bold text-lg text-center align-middle p-1">$ {amount.toLocaleString('es-CO', { minimumFractionDigits: 0 })}</td></tr>
                </tbody>
            </table>
          </div>
        </section>

        <section className="mt-2">
            <table className="w-full text-xs border-collapse" style={{border: '1px solid black'}}>
                <thead><tr><th className="font-bold bg-gray-200 p-1" style={{border: '1px solid black'}}>CÓDIGO</th><th className="font-bold bg-gray-200 p-1" style={{border: '1px solid black'}}>CUENTA</th><th className="font-bold bg-gray-200 p-1" style={{border: '1px solid black'}}>DEBE</th><th className="font-bold bg-gray-200 p-1" style={{border: '1px solid black'}}>HABER</th></tr></thead>
                <tbody>
                    <tr>
                        <td className="p-1 text-center" style={{border: '1px solid black'}}>{account?.number || ''}</td>
                        <td className="p-1" style={{border: '1px solid black'}}>{account?.name || ''}</td>
                        <td className="p-1 text-right" style={{border: '1px solid black'}}>{transaction.type === 'income' ? amount.toLocaleString('es-CO', { minimumFractionDigits: 2 }) : '0.00'}</td>
                        <td className="p-1 text-right" style={{border: '1px solid black'}}>{transaction.type === 'expense' ? amount.toLocaleString('es-CO', { minimumFractionDigits: 2 }) : '0.00'}</td>
                    </tr>
                     {transaction.isInternalTransfer && (
                         <tr>
                            <td colSpan="2" className="p-1 font-bold text-right">Contrapartida:</td>
                            <td className="p-1 text-right" style={{border: '1px solid black'}}>{transaction.type === 'expense' ? amount.toLocaleString('es-CO', { minimumFractionDigits: 2 }) : '0.00'}</td>
                            <td className="p-1 text-right" style={{border: '1px solid black'}}>{transaction.type === 'income' ? amount.toLocaleString('es-CO', { minimumFractionDigits: 2 }) : '0.00'}</td>
                        </tr>
                    )}
                </tbody>
            </table>
        </section>
      </div>

      <footer className="mt-4 flex justify-around items-end text-center">
        <div className="w-1/4"><div className="border-t-2 border-black pt-1 mx-2"><p className="font-bold">ELABORADO</p></div></div>
        <div className="w-1/4"><div className="border-t-2 border-black pt-1 mx-2"><p className="font-bold">APROBADO</p></div></div>
        <div className="w-1/4"><div className="border-t-2 border-black pt-1 mx-2"><p className="font-bold">CONTABILIZADO</p></div></div>
        <div className="w-1/4"><div className="border-t-2 border-black pt-1 mx-2"><p className="font-bold">FIRMA Y SELLO</p></div></div>
      </footer>
    </div>
  );
};

const Voucher = React.forwardRef(({ transaction }, ref) => {
    return (
      <div ref={ref}>
        <VoucherContent transaction={transaction} />
      </div>
    );
});

export default Voucher;
