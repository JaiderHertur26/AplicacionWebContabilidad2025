
import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { exportToExcel } from '@/lib/excel';
import { useCompanyData } from '@/hooks/useCompanyData';

const Reports = () => {
  const [transactions] = useCompanyData('transactions');
  const [accounts] = useCompanyData('accounts');
  const [bankAccounts] = useCompanyData('bankAccounts');
  const [initialBalance] = useCompanyData('initialBalance');
  const [fixedAssets] = useCompanyData('fixedAssets');
  const [realEstates] = useCompanyData('realEstates');
  const [accountsReceivable] = useCompanyData('accountsReceivable');
  const [accountsPayable] = useCompanyData('accountsPayable');
  
  const [reportData, setReportData] = useState({
    incomeStatement: [],
    balanceSheet: { assets: [], liabilities: [], equity: [], totals: {} },
    summary: { totalIncome: 0, totalExpenses: 0, netProfit: 0, profitMargin: 0 }
  });
  const { toast } = useToast();

  useEffect(() => {
    generateReportData();
  }, [transactions, accounts, bankAccounts, initialBalance, fixedAssets, realEstates, accountsReceivable, accountsPayable]);

  const generateReportData = () => {
    const safeParseFloat = (value) => {
        const parsed = parseFloat(value);
        return isNaN(parsed) ? 0 : parsed;
    };
    
    const allTransactions = transactions || [];
    const allAccounts = accounts || [];
    const currentYear = new Date().getFullYear().toString();

    const isLiabilityAccount = (categoryName) => {
        const account = allAccounts.find(a => a.name === categoryName);
        return account && account.number.startsWith('2');
    };

    // --- Income Statement Calculations (P&L) ---
    const totalIncome = allTransactions
        .filter(t => t.type === 'income' && !t.isInternalTransfer && t.category !== 'Cuentas por Cobrar' && !isLiabilityAccount(t.category))
        .reduce((sum, t) => sum + safeParseFloat(t.amount), 0);
    
    const totalExpenses = allTransactions
        .filter(t => t.type === 'expense' && !t.isInternalTransfer && !t.isFixedAsset && t.category !== 'Cuentas por Pagar' && !isLiabilityAccount(t.category))
        .reduce((sum, t) => sum + safeParseFloat(t.amount), 0);

    const netProfit = totalIncome - totalExpenses;
    const profitMargin = totalIncome > 0 ? ((netProfit / totalIncome) * 100).toFixed(2) : 0;
    
    const summaryData = { totalIncome, totalExpenses, netProfit, profitMargin };
    
    const calculateTotalForCategory = (categoryName) => allTransactions
        .filter(t => t.category === categoryName && !t.isFixedAsset && !t.isInternalTransfer && !isLiabilityAccount(t.category))
        .reduce((sum, t) => sum + safeParseFloat(t.amount), 0);

    const incomeAccounts = allAccounts.filter(a => a.number.startsWith('4'));
    const expenseAccounts = allAccounts.filter(a => a.number.startsWith('5'));
    const costAccounts = allAccounts.filter(a => a.number.startsWith('6'));
    
    const totalCosts = costAccounts.reduce((sum, acc) => sum + calculateTotalForCategory(acc.name), 0);
    const grossProfit = totalIncome - totalCosts;
    
    const incomeStatement = [
        { item: 'Ingresos Operacionales', amount: totalIncome },
        ...incomeAccounts.map(acc => ({ item: `  ${acc.name}`, amount: calculateTotalForCategory(acc.name) })).filter(i => i.amount),
        { item: 'Costos de Venta', amount: -totalCosts },
        ...costAccounts.map(acc => ({ item: `  ${acc.name}`, amount: -calculateTotalForCategory(acc.name) })).filter(i => i.amount),
        { item: 'Utilidad Bruta', amount: grossProfit, isBold: true, isTopBorder: true },
        { item: 'Gastos Operacionales', amount: -totalExpenses },
        ...expenseAccounts.map(acc => ({ item: `  ${acc.name}`, amount: -calculateTotalForCategory(acc.name) })).filter(i => i.amount),
        { item: 'Utilidad Neta (Estado de Resultados)', amount: netProfit, isBold: true, isTotal: true },
    ];
    
    // --- Balance Sheet Calculations ---
    const initialCash = safeParseFloat(initialBalance?.[0]?.balance);
    const initialBankTotal = (bankAccounts || []).reduce((sum, acc) => sum + safeParseFloat(acc.initialBalance), 0);
    const initialInvestmentTotal = (bankAccounts || []).reduce((sum, acc) => sum + safeParseFloat(acc.initialInvestmentBalance), 0);

    const cashIncomes = allTransactions
        .filter(t => t.type === 'income' && t.destination && t.destination.startsWith('caja_principal'))
        .reduce((sum, t) => sum + safeParseFloat(t.amount), 0);

    const cashExpenses = allTransactions
        .filter(t => t.type === 'expense' && t.destination && t.destination.startsWith('caja_principal'))
        .reduce((sum, t) => sum + safeParseFloat(t.amount), 0);
        
    const cajaPrincipalBalance = initialCash + cashIncomes - cashExpenses;

    let totalBankBalances = 0;
    let totalInvestmentBalances = 0;

    (bankAccounts || []).forEach(acc => {
        let currentBankBalance = safeParseFloat(acc.initialBalance);
        let currentInvestmentBalance = safeParseFloat(acc.initialInvestmentBalance);

        allTransactions.forEach(t => {
            const amount = safeParseFloat(t.amount);
            if(t.destination && t.destination.startsWith(acc.id)) {
                 if (t.type === 'income') {
                     if (t.description && t.description.includes('Aporte Ordinario')) {
                        currentInvestmentBalance += amount;
                     } else {
                        currentBankBalance += amount;
                     }
                 } else {
                     currentBankBalance -= amount;
                 }
            }
        });
        totalBankBalances += currentBankBalance;
        totalInvestmentBalances += currentInvestmentBalance;
    });

    const cajaGeneralTotal = cajaPrincipalBalance + totalBankBalances + totalInvestmentBalances;
    
    const inventoryAssetsValue = (fixedAssets || [])
      .filter(asset => asset.year === currentYear)
      .reduce((sum, asset) => sum + (safeParseFloat(asset.value) * (safeParseFloat(asset.quantity) || 1)), 0);

    const realEstatesValue = (realEstates || [])
      .reduce((sum, estate) => sum + safeParseFloat(estate.value), 0);

    const totalFixedAssetsValue = inventoryAssetsValue + realEstatesValue;

    const manuallyAddedAssetsValue = (fixedAssets || [])
      .filter(asset => !asset.transactionId && asset.year === currentYear)
      .reduce((sum, asset) => sum + (safeParseFloat(asset.value) * (safeParseFloat(asset.quantity) || 1)), 0);
    
    const accountsReceivableValue = (accountsReceivable || []).filter(r => r.status === 'Pendiente').reduce((sum, r) => sum + safeParseFloat(r.amount), 0);
    const accountsPayableValue = (accountsPayable || []).filter(p => p.status === 'Pendiente').reduce((sum, p) => sum + safeParseFloat(p.amount), 0);
    
    const otherLiabilitiesTransactions = allTransactions.filter(t => {
        const account = allAccounts.find(a => a.name === t.category);
        return account && account.number.startsWith('2') && t.category !== 'Cuentas por Pagar';
    });
    const otherLiabilitiesValue = otherLiabilitiesTransactions.reduce((sum, t) => {
        return sum + (t.type === 'income' ? safeParseFloat(t.amount) : -safeParseFloat(t.amount));
    }, 0);

    const assets = [
        { item: 'Activo Corriente', isBold: true },
        { item: '  Efectivo y Equivalentes', isSubtotal: true },
        { item: '    Caja General', amount: cajaGeneralTotal, isBold: true },
        { item: '    Caja Principal', amount: cajaPrincipalBalance },
        { item: '    Cuentas Bancarias', amount: totalBankBalances },
        { item: '    Aportes Ordinarios', amount: totalInvestmentBalances },
        { item: '  Cuentas por Cobrar', amount: accountsReceivableValue },
        { item: 'Activo No Corriente', isBold: true },
        { item: '  Activos Fijos', amount: totalFixedAssetsValue },
    ];

    const liabilities = [
        { item: 'Pasivo', isBold: true },
        { item: '  Cuentas por Pagar', amount: accountsPayableValue },
        { item: '  Otros Pasivos (Fondos de Terceros)', amount: otherLiabilitiesValue },
    ];
    
    // --- Capital Social Calculation ---
    const initialCapitalBase = initialCash + initialBankTotal + initialInvestmentTotal;

    const revaluationOfPurchasedAssets = (fixedAssets || [])
        .filter(asset => asset.transactionId && asset.year === currentYear)
        .reduce((sum, asset) => {
            const purchaseTransaction = allTransactions.find(t => t.id === asset.transactionId);
            const purchaseCost = purchaseTransaction ? safeParseFloat(purchaseTransaction.amount) : 0;
            const currentValue = safeParseFloat(asset.value) * (safeParseFloat(asset.quantity) || 1);
            return sum + (currentValue - purchaseCost);
        }, 0);

    const capitalSocial = initialCapitalBase + manuallyAddedAssetsValue + revaluationOfPurchasedAssets + realEstatesValue;

    const equity = [
        { item: 'Patrimonio', isBold: true },
        { item: '  Capital Social', amount: capitalSocial },
        { item: '  Utilidad del Ejercicio', amount: netProfit },
    ];
    
    const totalAssets = cajaGeneralTotal + accountsReceivableValue + totalFixedAssetsValue;
    const totalLiabilities = accountsPayableValue + otherLiabilitiesValue;
    const totalEquity = capitalSocial + netProfit;

    const balanceSheet = {
        assets: assets.filter(a => a.amount != null || a.isBold || a.isSubtotal),
        liabilities: liabilities.filter(l => l.amount != null || l.isBold),
        equity: equity.filter(e => e.amount != null || e.isBold),
        totals: {
            assets: totalAssets,
            liabilities: totalLiabilities,
            equity: totalEquity,
            liabilitiesAndEquity: totalLiabilities + totalEquity
        }
    };
    
    setReportData({ summary: summaryData, incomeStatement, balanceSheet });
  };
  
  const handleExportReport = (data, name) => {
    const formattedData = data.map(({ item, amount }) => ({ 'Concepto': item, 'Monto': amount, }));
    exportToExcel(formattedData, name);
    toast({ title: 'Exportado a Excel', description: `El reporte ${name} ha sido guardado.` });
  };
  
  const handleExportBalanceSheet = () => {
    const { assets, liabilities, equity, totals } = reportData.balanceSheet;
    const dataToExport = [
        ...assets.map(a => ({ Categoria: a.item, Monto: a.amount != null ? a.amount : '' })),
        { Categoria: 'TOTAL ACTIVOS', Monto: totals.assets }, {},
        ...liabilities.map(l => ({ Categoria: l.item, Monto: l.amount != null ? l.amount : '' })),
        { Categoria: 'TOTAL PASIVOS', Monto: totals.liabilities }, {},
        ...equity.map(e => ({ Categoria: e.item, Monto: e.amount != null ? e.amount : '' })),
        { Categoria: 'TOTAL PATRIMONIO', Monto: totals.equity }, {},
        { Categoria: 'TOTAL PASIVO + PATRIMONIO', Monto: totals.liabilitiesAndEquity }
    ];
    exportToExcel(dataToExport, 'Balance_General');
  }

  const renderSheetTable = (items) => (
    items.map((item, index) => (
        <tr key={index} className="border-b last:border-none">
            <td className={`py-2 ${item.isBold ? 'font-bold' : ''} ${item.isSubtotal ? 'font-semibold' : ''}`}>{item.item}</td>
            <td className={`py-2 text-right font-mono ${item.isBold ? 'font-bold' : ''} ${item.isSubtotal ? 'font-semibold' : ''}`}>{item.amount != null ? `$${item.amount.toLocaleString('es-ES', { minimumFractionDigits: 2 })}` : ''}</td>
        </tr>
    ))
  );

  return (
    <>
      <Helmet><title>Reportes - JaiderHerTur26</title></Helmet>
      <div className="space-y-8">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}><h1 className="text-4xl font-bold text-slate-900 mb-2">Reportes Financieros</h1></motion.div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-green-100 p-6 rounded-lg border border-green-200"><p className="text-sm text-green-800">Ingresos (P&L)</p><p className="text-2xl font-bold text-green-900">${reportData.summary.totalIncome.toLocaleString('es-ES', { minimumFractionDigits: 2 })}</p></div>
            <div className="bg-red-100 p-6 rounded-lg border border-red-200"><p className="text-sm text-red-800">Gastos (P&L)</p><p className="text-2xl font-bold text-red-900">${reportData.summary.totalExpenses.toLocaleString('es-ES', { minimumFractionDigits: 2 })}</p></div>
            <div className="bg-blue-100 p-6 rounded-lg border border-blue-200"><p className="text-sm text-blue-800">Utilidad del Ejercicio</p><p className="text-2xl font-bold text-blue-900">${reportData.summary.netProfit.toLocaleString('es-ES', { minimumFractionDigits: 2 })}</p></div>
            <div className="bg-purple-100 p-6 rounded-lg border border-purple-200"><p className="text-sm text-purple-800">Margen</p><p className="text-2xl font-bold text-purple-900">{reportData.summary.profitMargin}%</p></div>
        </div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <div className="bg-white rounded-xl shadow-lg border">
                <div className="flex justify-between items-center p-6 border-b"><h2 className="text-xl font-bold text-slate-900">Balance General</h2><Button onClick={handleExportBalanceSheet} variant="outline"><Download className="w-4 h-4 mr-2" /> Exportar</Button></div>
                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div>
                        <h3 className="text-lg font-semibold mb-2 text-blue-700">Activos</h3>
                        <table className="w-full"><tbody>{renderSheetTable(reportData.balanceSheet.assets)}</tbody></table>
                        <table className="w-full mt-2"><tbody><tr className="border-t-2 border-slate-900"><td className="py-2 font-bold">Total Activos</td><td className="py-2 text-right font-mono font-bold">${reportData.balanceSheet.totals.assets?.toLocaleString('es-ES', { minimumFractionDigits: 2 })}</td></tr></tbody></table>
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold mb-2 text-blue-700">Pasivos y Patrimonio</h3>
                        <table className="w-full"><tbody>{renderSheetTable(reportData.balanceSheet.liabilities)}</tbody></table>
                        <table className="w-full mt-2"><tbody>{renderSheetTable(reportData.balanceSheet.equity)}</tbody></table>
                        <table className="w-full mt-2"><tbody><tr className="border-t-2 border-slate-900"><td className="py-2 font-bold">Total Pasivo + Patrimonio</td><td className="py-2 text-right font-mono font-bold">${reportData.balanceSheet.totals.liabilitiesAndEquity?.toLocaleString('es-ES', { minimumFractionDigits: 2 })}</td></tr></tbody></table>
                    </div>
                </div>
                 <div className={`p-4 text-center border-t text-sm font-semibold ${Math.abs(reportData.balanceSheet.totals.assets - reportData.balanceSheet.totals.liabilitiesAndEquity) < 0.01 ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
                    {Math.abs(reportData.balanceSheet.totals.assets - reportData.balanceSheet.totals.liabilitiesAndEquity) < 0.01 ? '¡El balance está cuadrado!' : 'El balance no está cuadrado'}
                </div>
            </div>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <div className="bg-white rounded-xl shadow-lg border">
                <div className="flex justify-between items-center p-6 border-b"><h2 className="text-xl font-bold text-slate-900">Estado de Resultados</h2><Button onClick={() => handleExportReport(reportData.incomeStatement, 'Estado_de_Resultados')} variant="outline"><Download className="w-4 h-4 mr-2" /> Exportar</Button></div>
                <div className="p-6"><table className="w-full"><tbody>{reportData.incomeStatement.map((item, index) => (<tr key={index} className={`border-b last:border-none ${item.isTotal ? 'bg-blue-50' : ''} ${item.isTopBorder ? 'border-t-2 border-slate-900' : ''}`}><td className={`py-3 ${item.isBold ? 'font-bold' : ''}`}>{item.item}</td><td className={`py-3 text-right font-mono ${item.isBold ? 'font-bold' : ''} ${item.amount < 0 ? 'text-red-600' : 'text-slate-800'}`}>${item.amount.toLocaleString('es-ES', { minimumFractionDigits: 2 })}</td></tr>))}</tbody></table></div>
            </div>
        </motion.div>
      </div>
    </>
  );
};

export default Reports;
