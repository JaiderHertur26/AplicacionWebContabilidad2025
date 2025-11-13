
import React, { useState, useMemo } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { Download, FileText, Search, BookMarked, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { exportToExcel } from '@/lib/excel';
import { useCompanyData } from '@/hooks/useCompanyData';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

const TaxReports = () => {
    const [transactions, , isTransactionsLoaded] = useCompanyData('transactions');
    const [contacts, , isContactsLoaded] = useCompanyData('contacts');
    const [accounts, , isAccountsLoaded] = useCompanyData('accounts');
    const [fixedAssets, , isFixedAssetsLoaded] = useCompanyData('fixedAssets');
    const [realEstates, , isRealEstatesLoaded] = useCompanyData('realEstates');
    const [accountsReceivable, , isARLoaded] = useCompanyData('accountsReceivable');
    const [accountsPayable, , isAPLoaded] = useCompanyData('accountsPayable');
    const [bankAccounts, , isBankAccountsLoaded] = useCompanyData('bankAccounts');
    const [initialBalance, , isInitialBalanceLoaded] = useCompanyData('initialBalance');

    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());

    const { toast } = useToast();

    const areAllDataLoaded = useMemo(() => {
        return isTransactionsLoaded && isContactsLoaded && isAccountsLoaded && isFixedAssetsLoaded && 
               isRealEstatesLoaded && isARLoaded && isAPLoaded && isBankAccountsLoaded && isInitialBalanceLoaded;
    }, [isTransactionsLoaded, isContactsLoaded, isAccountsLoaded, isFixedAssetsLoaded, isRealEstatesLoaded, isARLoaded, isAPLoaded, isBankAccountsLoaded, isInitialBalanceLoaded]);


    const availableYears = useMemo(() => {
        const years = new Set((transactions || []).map(t => new Date(t.date).getFullYear()));
        const currentYear = new Date().getFullYear();
        years.add(currentYear);
        return Array.from(years).sort((a, b) => b - a).map(String);
    }, [transactions]);
    
    const safeParseFloat = (value) => {
        const parsed = parseFloat(value);
        return isNaN(parsed) ? 0 : parsed;
    };
    
    const isLiabilityAccount = (categoryName) => {
        if (!accounts) return false;
        const account = accounts.find(a => a.name === categoryName);
        return account && account.number.startsWith('2');
    };

    const generateExogenaData = useMemo(() => {
        if (!areAllDataLoaded) return [];
        const paymentsByContact = {};
        
        const yearTransactions = (transactions || []).filter(t => new Date(t.date).getFullYear().toString() === selectedYear);

        yearTransactions.forEach(t => {
            if (t.type === 'expense' && t.contactId) {
                const contactId = t.contactId;
                if (!paymentsByContact[contactId]) {
                    const contactInfo = (contacts || []).find(c => c.id === contactId);
                    if (contactInfo) {
                        paymentsByContact[contactId] = {
                            ...contactInfo,
                            total: 0,
                        };
                    }
                }
                if (paymentsByContact[contactId]) {
                    paymentsByContact[contactId].total += safeParseFloat(t.amount);
                }
            }
        });

        return Object.values(paymentsByContact).map(contact => ({
            'Tipo Doc.': contact.docType,
            'Número Doc.': contact.docNumber,
            'Nombre o Razón Social': contact.name,
            'NIT': contact.nit,
            'Teléfono': contact.phone,
            'Email': contact.email,
            'Tipo Contacto': contact.type,
            'Pago o Abono en Cuenta': contact.total
        }));
    }, [transactions, contacts, selectedYear, areAllDataLoaded]);

    const handleExportExogena = () => {
        const data = generateExogenaData;
        if (data.length === 0) {
            toast({ variant: 'destructive', title: "No hay datos para exportar", description: `No se encontraron pagos a terceros para el año ${selectedYear}.` });
            return;
        }
        
        const total = data.reduce((sum, item) => sum + item['Pago o Abono en Cuenta'], 0);
        const footer = { 'Pago o Abono en Cuenta': total };
        
        exportToExcel(data, `Reporte_Exogena_${selectedYear}`, footer);
        toast({ title: "¡Exportado!", description: `El Reporte de Exógena para ${selectedYear} ha sido generado.` });
    };

    const generateRentaData = useMemo(() => {
        if (!areAllDataLoaded) return [];

        const yearTransactions = (transactions || []).filter(t => new Date(t.date).getFullYear().toString() === selectedYear);
        const allTransactions = (transactions || []);

        const totalIncomes = yearTransactions
            .filter(t => t.type === 'income' && !t.isInternalTransfer && t.category !== 'Cuentas por Cobrar' && !isLiabilityAccount(t.category))
            .reduce((sum, t) => sum + safeParseFloat(t.amount), 0);
        
        const totalCostsAndExpenses = yearTransactions
            .filter(t => t.type === 'expense' && !t.isInternalTransfer && !t.isFixedAsset && t.category !== 'Cuentas por Pagar' && !isLiabilityAccount(t.category))
            .reduce((sum, t) => sum + safeParseFloat(t.amount), 0);
        
        const netProfit = totalIncomes - totalCostsAndExpenses;
        
        // --- Caja General Calculation (Mirrors Reports.jsx) ---
        const initialCash = safeParseFloat(initialBalance?.[0]?.balance);
        
        const cashIncomes = allTransactions
            .filter(t => new Date(t.date).getFullYear() <= parseInt(selectedYear) && t.type === 'income' && t.destination && t.destination.startsWith('caja_principal'))
            .reduce((sum, t) => sum + safeParseFloat(t.amount), 0);

        const cashExpenses = allTransactions
            .filter(t => new Date(t.date).getFullYear() <= parseInt(selectedYear) && t.type === 'expense' && t.destination && t.destination.startsWith('caja_principal'))
            .reduce((sum, t) => sum + safeParseFloat(t.amount), 0);
            
        const cajaPrincipalBalance = initialCash + cashIncomes - cashExpenses;

        let totalBankBalances = 0;
        let totalInvestmentBalances = 0;

        (bankAccounts || []).forEach(acc => {
            let currentBankBalance = safeParseFloat(acc.initialBalance);
            let currentInvestmentBalance = safeParseFloat(acc.initialInvestmentBalance);

            allTransactions.filter(t => new Date(t.date).getFullYear() <= parseInt(selectedYear)).forEach(t => {
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

        const cajaGeneral = cajaPrincipalBalance + totalBankBalances + totalInvestmentBalances;
        
        const accountsReceivableValue = (accountsReceivable || []).filter(r => r.status === 'Pendiente' && new Date(r.date).getFullYear() <= parseInt(selectedYear)).reduce((sum, r) => sum + safeParseFloat(r.amount), 0);
        
        const yearFixedAssets = (fixedAssets || []).filter(asset => {
            const assetYear = asset.date ? new Date(asset.date).getFullYear().toString() : asset.year;
            return assetYear === selectedYear;
        });

        const inventoryAssetsValue = yearFixedAssets.reduce((sum, asset) => sum + (safeParseFloat(asset.value) * (asset.quantity || 1)), 0);

        const realEstatesValue = (realEstates || [])
            .filter(estate => new Date(estate.date).getFullYear() <= parseInt(selectedYear))
            .reduce((sum, estate) => sum + safeParseFloat(estate.value), 0);
        
        const totalNonCurrentAssets = inventoryAssetsValue + realEstatesValue;
        const totalAssets = cajaGeneral + accountsReceivableValue + totalNonCurrentAssets;

        const accountsPayableValue = (accountsPayable || []).filter(p => p.status === 'Pendiente' && new Date(p.date).getFullYear() <= parseInt(selectedYear)).reduce((sum, p) => sum + safeParseFloat(p.amount), 0);

        const otherLiabilitiesValue = allTransactions.filter(t => {
                const account = (accounts || []).find(a => a.name === t.category);
                return new Date(t.date).getFullYear() <= parseInt(selectedYear) && account && account.number.startsWith('2') && t.category !== 'Cuentas por Pagar';
            })
            .reduce((sum, t) => sum + (t.type === 'income' ? safeParseFloat(t.amount) : -safeParseFloat(t.amount)), 0);
        
        const totalDebts = accountsPayableValue + otherLiabilitiesValue;
        const netWorth = totalAssets - totalDebts;

        return [
            { Concepto: 'PATRIMONIO BRUTO (Total Activos)', Valor: totalAssets },
            { Concepto: '  Efectivo y Equivalentes (Caja General)', Valor: cajaGeneral },
            { Concepto: '  Cuentas por Cobrar', Valor: accountsReceivableValue },
            { Concepto: '  Activos Fijos (Inventario y Propiedades)', Valor: totalNonCurrentAssets },
            { Concepto: 'DEUDAS (Total Pasivos)', Valor: totalDebts },
            { Concepto: '  Cuentas por Pagar', Valor: accountsPayableValue },
            { Concepto: '  Otros Pasivos (Fondos de terceros)', Valor: otherLiabilitiesValue },
            { Concepto: 'PATRIMONIO LÍQUIDO (Activos - Pasivos)', Valor: netWorth },
            {}, // separator
            { Concepto: 'INGRESOS TOTALES (P&L del año)', Valor: totalIncomes },
            { Concepto: 'COSTOS Y GASTOS TOTALES (P&L del año)', Valor: totalCostsAndExpenses },
            { Concepto: 'RENTA LÍQUIDA (Ingresos - Gastos)', Valor: netProfit },
        ];
    }, [transactions, bankAccounts, fixedAssets, realEstates, accountsReceivable, accountsPayable, accounts, initialBalance, selectedYear, areAllDataLoaded]);


    const handleExportRenta = () => {
        const data = generateRentaData;
        if (data.length === 0 || !areAllDataLoaded) {
            toast({ variant: 'destructive', title: "No hay datos para exportar." });
            return;
        }
        exportToExcel(data, `Reporte_Declaracion_Renta_${selectedYear}`);
        toast({ title: "¡Exportado!", description: `El Reporte para Declaración de Renta de ${selectedYear} ha sido generado.` });
    };
    
    const YearSelector = () => (
        <div className="flex items-center space-x-2">
            <Calendar className="w-5 h-5 text-slate-500" />
            <Label htmlFor="year-select">Año Fiscal:</Label>
            <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger id="year-select" className="w-[120px]">
                    <SelectValue placeholder="Año" />
                </SelectTrigger>
                <SelectContent>
                    {availableYears.map(year => (
                        <SelectItem key={year} value={year}>{year}</SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );

    return (
        <>
            <Helmet>
                <title>Reportes Tributarios - JaiderHerTur26</title>
                <meta name="description" content="Genera reportes tributarios como el de información exógena." />
            </Helmet>
            <div className="space-y-8">
                <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex justify-between items-center">
                    <div>
                        <h1 className="text-4xl font-bold text-slate-900">Reportes Tributarios</h1>
                        <p className="text-slate-600">Genera tus reportes fiscales y de información a terceros.</p>
                    </div>
                    <YearSelector />
                </motion.div>

                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-white rounded-xl shadow-lg border">
                    <div className="p-6 border-b flex justify-between items-center">
                        <div className="flex items-center"><FileText className="w-6 h-6 mr-3 text-blue-600" /><h2 className="text-xl font-bold text-slate-900">Pagos a Terceros (Exógena)</h2></div>
                        <Button onClick={handleExportExogena}><Download className="w-4 h-4 mr-2"/> Exportar Reporte</Button>
                    </div>
                    <div className="p-6">
                        <p className="text-slate-600 mb-4">Este reporte consolida todos los pagos (gastos) realizados a cada contacto (tercero) durante el año seleccionado.</p>
                        {!areAllDataLoaded ? <p>Cargando datos...</p> : generateExogenaData.length === 0 ? (
                            <div className="text-center py-10"><Search className="w-12 h-12 text-slate-300 mx-auto mb-4" /><p className="text-slate-500">No se encontraron pagos a terceros para reportar en {selectedYear}.</p></div>
                        ) : (
                            <div className="overflow-x-auto rounded-lg border max-h-72"><table className="w-full">
                                <thead className="bg-slate-50 sticky top-0"><tr>
                                    <th className="px-6 py-3 text-left text-sm font-semibold text-slate-800">Nombre o Razón Social</th>
                                    <th className="px-6 py-3 text-left text-sm font-semibold text-slate-800">Número Doc.</th>
                                    <th className="px-6 py-3 text-right text-sm font-semibold text-slate-800">Pago o Abono en Cuenta</th>
                                </tr></thead>
                                <tbody className="divide-y divide-slate-200">{generateExogenaData.map((row, index) => (
                                    <tr key={index} className="hover:bg-slate-50">
                                        <td className="px-6 py-4 text-sm font-medium text-slate-900">{row['Nombre o Razón Social']}</td>
                                        <td className="px-6 py-4 text-sm font-mono text-left">{row['Número Doc.']}</td>
                                        <td className="px-6 py-4 text-sm font-mono text-right text-red-600">${row['Pago o Abono en Cuenta'].toLocaleString('es-ES', {minimumFractionDigits: 2})}</td>
                                    </tr>))}
                                </tbody>
                            </table></div>
                        )}
                    </div>
                </motion.div>

                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-white rounded-xl shadow-lg border">
                    <div className="p-6 border-b flex justify-between items-center">
                        <div className="flex items-center"><BookMarked className="w-6 h-6 mr-3 text-emerald-600" /><h2 className="text-xl font-bold text-slate-900">Declaración de Renta</h2></div>
                        <Button onClick={handleExportRenta} variant="outline" className="text-emerald-700 border-emerald-300 hover:bg-emerald-50"><Download className="w-4 h-4 mr-2"/> Exportar Reporte</Button>
                    </div>
                    <div className="p-6"><p className="text-slate-600 mb-4">Resumen del estado financiero para el año {selectedYear}, estructurado para facilitar tu declaración de renta.</p>
                        <div className="overflow-x-auto rounded-lg border">
                           {!areAllDataLoaded ? <p className="p-4">Cargando datos del reporte...</p> : <table className="w-full">
                                <thead className="bg-slate-50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-sm font-semibold text-slate-800">Concepto</th>
                                        <th className="px-6 py-3 text-right text-sm font-semibold text-slate-800">Valor</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200">
                                    {generateRentaData.map((row, index) => (
                                        <tr key={index} className={`${row.Concepto?.startsWith('PATRIMONIO BRUTO') || row.Concepto?.startsWith('DEUDAS') || row.Concepto?.startsWith('PATRIMONIO LÍQUIDO') || row.Concepto?.startsWith('RENTA LÍQUIDA') ? 'bg-slate-100 font-bold' : ''}`}>
                                            <td className={`px-6 py-3 text-sm font-medium ${row.Concepto?.startsWith('  ') ? 'pl-10' : ''}`}>{row.Concepto}</td>
                                            <td className="px-6 py-3 text-sm font-mono text-right">{row.Valor != null ? `$${row.Valor.toLocaleString('es-ES', {minimumFractionDigits: 2})}` : ''}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>}
                        </div>
                    </div>
                </motion.div>
            </div>
        </>
    );
};

export default TaxReports;
