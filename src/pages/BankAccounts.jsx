import React, { useState, useEffect, useMemo } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { Plus, Landmark, Edit2, Trash2, ArrowRightLeft, Banknote, Briefcase, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useCompanyData } from '@/hooks/useCompanyData';
import { useCompany } from '@/App';
import { format } from 'date-fns';
import { usePermission } from '@/hooks/usePermission';

const BankAccounts = () => {
    const { activeCompany } = useCompany();
    const { canEdit, canDelete, canAdd, isReadOnly } = usePermission();
    const [accounts, saveAccounts] = useCompanyData('bankAccounts');
    const [chartOfAccounts, saveChartOfAccounts] = useCompanyData('accounts');
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingAccount, setEditingAccount] = useState(null);
    const [movementDialogOpen, setMovementDialogOpen] = useState(false);
    const [selectedAccount, setSelectedAccount] = useState(null);
    const [transactions, saveTransactions] = useCompanyData('transactions');
    const { toast } = useToast();

    const accountsWithCalculatedBalances = useMemo(() => {
        if (!accounts || !transactions) return [];
        
        return accounts.map(acc => {
            const initialBalance = parseFloat(acc.initialBalance || 0);
            const initialInvestmentBalance = parseFloat(acc.initialInvestmentBalance || 0);

            const movements = transactions.reduce((accBalances, t) => {
                const amount = parseFloat(t.amount);
                if (t.destination && t.destination.startsWith(acc.id)) {
                    if (t.type === 'income') {
                        if (t.description && t.description.includes('Aporte Ordinario')) {
                            accBalances.investmentBalance += amount;
                        } else {
                            accBalances.balance += amount;
                        }
                    } else if (t.type === 'expense') {
                        accBalances.balance -= amount;
                    }
                }
                return accBalances;
            }, { balance: 0, investmentBalance: 0 });

            return {
                ...acc,
                balance: initialBalance + movements.balance,
                investmentBalance: initialInvestmentBalance + movements.investmentBalance,
            };
        });
    }, [accounts, transactions]);


    const handleSaveAccount = (accountData) => {
        if (!canAdd && !editingAccount) return;
        if (!canEdit && editingAccount) return;

        let updated;
        if (editingAccount) {
            updated = accounts.map(acc => acc.id === editingAccount.id ? { 
                ...acc, ...accountData, 
                initialBalance: parseFloat(accountData.initialBalance || 0), 
                initialInvestmentBalance: parseFloat(accountData.initialInvestmentBalance || 0) 
            } : acc);
            toast({ title: "Cuenta actualizada" });

            // Update Chart of Accounts if info changed
            if (accountData.accountingCode && accountData.accountingConcept) {
                const existingIdx = chartOfAccounts.findIndex(c => c.number === accountData.accountingCode);
                if (existingIdx >= 0) {
                    // Optional: Update existing concept? Usually better to ask, but here we auto-update for consistency
                    const updatedChart = [...chartOfAccounts];
                    updatedChart[existingIdx] = { ...updatedChart[existingIdx], name: accountData.accountingConcept };
                    saveChartOfAccounts(updatedChart);
                } else {
                     // If it didn't exist before (maybe added later), create it
                     const newChartAccount = {
                        id: crypto.randomUUID(),
                        number: accountData.accountingCode,
                        name: accountData.accountingConcept
                    };
                    saveChartOfAccounts([...chartOfAccounts, newChartAccount].sort((a,b) => a.number.localeCompare(b.number)));
                }
            }

        } else {
            const newAccountId = Date.now().toString();
            updated = [...accounts, { 
                ...accountData, 
                id: newAccountId, 
                initialBalance: parseFloat(accountData.initialBalance || 0),
                initialInvestmentBalance: parseFloat(accountData.initialInvestmentBalance || 0),
            }];
            
            // Auto-create in Chart of Accounts
            if (accountData.accountingCode && accountData.accountingConcept) {
                // Check if exists to prevent duplicates
                const exists = chartOfAccounts.some(c => c.number === accountData.accountingCode);
                if (!exists) {
                    const newChartAccount = {
                        id: crypto.randomUUID(),
                        number: accountData.accountingCode,
                        name: accountData.accountingConcept
                    };
                    saveChartOfAccounts([...chartOfAccounts, newChartAccount].sort((a,b) => a.number.localeCompare(b.number)));
                    toast({ title: "Cuenta creada", description: "También se agregó al Plan de Cuentas." });
                } else {
                    toast({ title: "Cuenta creada", description: "El código contable ya existía en el Plan de Cuentas." });
                }
            } else {
                toast({ title: "Cuenta creada" });
            }
        }
        saveAccounts(updated);
        setDialogOpen(false);
    };

    const handleDeleteAccount = (id) => {
        if (!canDelete) return;
        const accountToDelete = accounts.find(acc => acc.id === id);
        // Note: We usually don't delete from Chart of Accounts automatically to preserve history, 
        // but if the user wants to remove it, they can do it manually in Accounts page.
        
        saveAccounts(accounts.filter(acc => acc.id !== id));
        toast({ title: "Cuenta eliminada" });
    };
    
    const getNextVoucherNumber = (type) => {
        if (!activeCompany) return 0;
        const sequenceKey = `${activeCompany.id}-voucher-sequence`;
        const sequences = JSON.parse(localStorage.getItem(sequenceKey) || '{ "income": 0, "expense": 0, "transfer": 0 }');
        const nextNumber = (sequences[type] || 0) + 1;
        sequences[type] = nextNumber;
        localStorage.setItem(sequenceKey, JSON.stringify(sequences));
        return nextNumber;
    };

    const handleSaveMovement = (movementData) => {
        if (!canAdd) return;

        const amount = parseFloat(movementData.amount);
        const [year, month, day] = movementData.date.split('-').map(Number);
        const movementDate = new Date(year, month - 1, day);
        const now = Date.now();
        const voucherNumber = getNextVoucherNumber('transfer');

        // Extract source info
        const { sourceAccount } = movementData;
        const [sourceId, sourceName] = sourceAccount.split('|');

        const expenseTransaction = {
            id: `${now}-exp`,
            type: 'expense',
            description: `Aporte Ordinario a cuenta ${selectedAccount.bankName}`,
            amount: amount,
            category: movementData.linkedAccount,
            date: movementDate,
            destination: sourceAccount, // Use selected source
            isInternalTransfer: true,
            voucherNumber,
        };

        const incomeTransaction = {
            id: `${now}-inc`,
            type: 'income',
            description: `Aporte Ordinario desde ${sourceName}`,
            amount: amount,
            category: movementData.linkedAccount,
            date: movementDate,
            destination: `${selectedAccount.id}|${selectedAccount.bankName}`,
            isInternalTransfer: true,
            voucherNumber,
        };
        
        saveTransactions([...transactions, expenseTransaction, incomeTransaction]);
        
        setMovementDialogOpen(false);
        toast({title: "Aporte Ordinario registrado", description: `Se creó una transferencia interna desde ${sourceName}.`});
    };

    return (
        <>
        <Helmet>
            <title>Cuentas Bancarias - JaiderHerTur26</title>
        </Helmet>
        <div className="space-y-6">
            <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex justify-between items-center">
                <div><h1 className="text-4xl font-bold text-slate-900">Cuentas Bancarias</h1><p className="text-slate-600">Gestiona tus cuentas y aportes ordinarios.</p></div>
                <div className="flex items-center gap-2">
                    {isReadOnly && <span className="flex items-center text-slate-400 text-sm"><Lock className="w-4 h-4 mr-1"/>Acceso Parcial</span>}
                    {canAdd && <Button onClick={() => { setEditingAccount(null); setDialogOpen(true); }} className="bg-blue-600 hover:bg-blue-700"><Plus className="w-4 h-4 mr-2" /> Nueva Cuenta</Button>}
                </div>
            </motion.div>

            {(accountsWithCalculatedBalances || []).length === 0 ? (
                 <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-16 bg-white rounded-xl shadow-lg border">
                    <Landmark className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                    <p className="text-slate-500">No hay cuentas bancarias guardadas.</p>
                </motion.div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {accountsWithCalculatedBalances.map((account, index) => (
                        <motion.div key={account.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.1 }} className="bg-white rounded-xl shadow-lg p-6 border flex flex-col justify-between">
                            <div>
                                <div className="flex items-center mb-4"><div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mr-4"><Banknote className="w-6 h-6 text-blue-600" /></div><div><h3 className="font-bold text-lg">{account.bankName}</h3><p className="text-sm text-slate-500">Cta No. {account.accountNumber}</p></div></div>
                                <div className="mb-2">
                                    {account.accountingCode && (
                                        <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-slate-100 text-slate-600">
                                            PUC: {account.accountingCode} - {account.accountingConcept}
                                        </span>
                                    )}
                                </div>
                                <p className="text-sm text-slate-500">Balance Cta. Principal</p>
                                <p className="text-3xl font-bold text-blue-800">${(account.balance || 0).toLocaleString('es-ES', {minimumFractionDigits: 2})}</p>
                                <div className="mt-2 flex items-center gap-2 text-sm text-purple-700 bg-purple-100 p-2 rounded-lg">
                                    <Briefcase className="w-4 h-4"/>
                                    <span>Aporte Ordinario: ${(account.investmentBalance || 0).toLocaleString('es-ES', {minimumFractionDigits: 2})}</span>
                                </div>
                            </div>
                            <div className="flex gap-2 mt-4">
                                {canAdd && <Button variant="outline" size="sm" onClick={() => {setSelectedAccount(account); setMovementDialogOpen(true);}} className="flex-1"><ArrowRightLeft className="w-4 h-4 mr-2" /> Registrar Aporte</Button>}
                                {canEdit && <Button variant="ghost" size="icon" onClick={() => {setEditingAccount(account); setDialogOpen(true)}}><Edit2 className="w-4 h-4" /></Button>}
                                {canDelete && <Button variant="ghost" size="icon" onClick={() => handleDeleteAccount(account.id)} className="hover:bg-red-50 hover:text-red-600"><Trash2 className="w-4 h-4" /></Button>}
                            </div>
                        </motion.div>
                    ))}
                </div>
            )}
        </div>

        <AccountDialog open={dialogOpen} onOpenChange={setDialogOpen} onSave={handleSaveAccount} account={editingAccount} />
        {selectedAccount && <MovementDialog open={movementDialogOpen} onOpenChange={setMovementDialogOpen} onSave={handleSaveMovement} account={selectedAccount} availableAccounts={accounts} />}
        </>
    );
};

const AccountDialog = ({ open, onOpenChange, onSave, account }) => {
    const [data, setData] = useState({ 
        bankName: '', 
        accountNumber: '', 
        initialBalance: '', 
        initialInvestmentBalance: '',
        accountingCode: '',
        accountingConcept: ''
    });

    useEffect(() => {
        if (account) {
            setData({ 
                bankName: account.bankName || '', 
                accountNumber: account.accountNumber || '',
                initialBalance: account.initialBalance || '', 
                initialInvestmentBalance: account.initialInvestmentBalance || '',
                accountingCode: account.accountingCode || '',
                accountingConcept: account.accountingConcept || ''
            });
        } else {
            setData({ bankName: '', accountNumber: '', initialBalance: '', initialInvestmentBalance: '', accountingCode: '', accountingConcept: '' });
        }
    }, [account, open]);

    const handleSubmit = (e) => { e.preventDefault(); onSave(data); };
    return(
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader><DialogTitle>{account ? 'Editar' : 'Nueva'} Cuenta Bancaria</DialogTitle></DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 pt-4">
                    <div className="space-y-2"><Label htmlFor="bankName">Nombre del Banco/Entidad</Label><input id="bankName" required value={data.bankName} onChange={e => setData({...data, bankName: e.target.value})} className="w-full px-3 py-2 border rounded-lg" placeholder="Ej: Bancolombia" /></div>
                    <div className="space-y-2"><Label htmlFor="accountNumber">Número de Cuenta Bancaria</Label><input id="accountNumber" required value={data.accountNumber} onChange={e => setData({...data, accountNumber: e.target.value})} className="w-full px-3 py-2 border rounded-lg" placeholder="Ej: 987654321" /></div>
                    
                    <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
                        <div className="col-span-2 flex items-center gap-2 text-sm font-semibold text-blue-800 pb-2 border-b border-slate-200 mb-2">
                            <Landmark className="w-4 h-4" /> Vinculación Contable (Automática)
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="accountingCode" className="text-xs">Código PUC</Label>
                            <input id="accountingCode" value={data.accountingCode} onChange={e => setData({...data, accountingCode: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Ej: 111005" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="accountingConcept" className="text-xs">Nombre Cuenta PUC</Label>
                            <input id="accountingConcept" value={data.accountingConcept} onChange={e => setData({...data, accountingConcept: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Ej: Bancolombia Ahorros" />
                        </div>
                        <p className="col-span-2 text-[10px] text-slate-500 italic">
                            * Si ingresas estos datos, se creará automáticamente la cuenta en el Plan de Cuentas.
                        </p>
                    </div>

                    <div className="space-y-2"><Label htmlFor="initialBalance">Saldo Inicial Cta. Principal</Label><input id="initialBalance" type="number" step="0.01" value={data.initialBalance} onChange={e => setData({...data, initialBalance: e.target.value})} className="w-full px-3 py-2 border rounded-lg" /></div>
                    <div className="space-y-2"><Label htmlFor="initialInvestmentBalance">Saldo Inicial Aporte Ordinario</Label><input id="initialInvestmentBalance" type="number" step="0.01" value={data.initialInvestmentBalance} onChange={e => setData({...data, initialInvestmentBalance: e.target.value})} className="w-full px-3 py-2 border rounded-lg" placeholder="Opcional"/></div>
                    <div className="flex justify-end gap-2 pt-4"><DialogClose asChild><Button type="button" variant="outline">Cancelar</Button></DialogClose><Button type="submit" className="bg-blue-600 hover:bg-blue-700">Guardar</Button></div>
                </form>
            </DialogContent>
        </Dialog>
    );
};

const MovementDialog = ({ open, onOpenChange, onSave, account, availableAccounts = [] }) => {
    const [amount, setAmount] = useState('');
    const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [linkedAccount, setLinkedAccount] = useState('');
    const [sourceAccount, setSourceAccount] = useState('caja_principal|CAJA PRINCIPAL');
    const [chartOfAccounts] = useCompanyData('accounts');
    const { toast } = useToast();

    useEffect(() => { 
        if (open) {
            setAmount('');
            setDate(format(new Date(), 'yyyy-MM-dd'));
            setSourceAccount('caja_principal|CAJA PRINCIPAL');
            const defaultInvestmentAccount = (chartOfAccounts || []).find(acc => acc.number === '321501');
            setLinkedAccount(defaultInvestmentAccount ? defaultInvestmentAccount.name : '');
        }
    }, [open, chartOfAccounts]);

    const handleSubmit = (e) => { 
        e.preventDefault(); 
        if (!linkedAccount) {
            toast({ variant: 'destructive', title: 'Error', description: 'Debes seleccionar una cuenta contable vinculada.' });
            return;
        }
        onSave({ amount, date, linkedAccount, sourceAccount }); 
    };
    
    const sortedAccounts = [...(chartOfAccounts || [])].sort((a, b) => a.number.localeCompare(b.number));

    return (
         <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader><DialogTitle>Registrar Aporte Ordinario</DialogTitle></DialogHeader>
                <p className="text-sm text-slate-600">
                    Estás a punto de registrar un aporte a la cuenta de <strong>{account.bankName}</strong>.
                    Selecciona el origen de los fondos y la cuenta contable.
                </p>
                <form onSubmit={handleSubmit} className="space-y-4 pt-4">
                    <div className="space-y-2">
                        <Label htmlFor="sourceAccount">Origen de Fondos</Label>
                        <select id="sourceAccount" required value={sourceAccount} onChange={e => setSourceAccount(e.target.value)} className="w-full px-3 py-2 border rounded-lg">
                            <option value="caja_principal|CAJA PRINCIPAL">CAJA PRINCIPAL</option>
                            {availableAccounts.map(acc => (
                                <option key={acc.id} value={`${acc.id}|${acc.bankName}`}>{acc.bankName}</option>
                            ))}
                        </select>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="amount">Monto del Aporte</Label>
                        <input id="amount" type="number" step="0.01" required value={amount} onChange={e => setAmount(e.target.value)} className="w-full px-3 py-2 border rounded-lg" />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="date">Fecha del Aporte</Label>
                        <input id="date" type="date" required value={date} onChange={e => setDate(e.target.value)} className="w-full px-3 py-2 border rounded-lg" />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="linkedAccount">Cuenta Contable Vinculada</Label>
                        <select id="linkedAccount" required value={linkedAccount} onChange={e => setLinkedAccount(e.target.value)} className="w-full px-3 py-2 border rounded-lg">
                           <option value="" disabled>Selecciona una cuenta</option>
                           {sortedAccounts.map(acc => (
                               <option key={acc.id} value={acc.name}>{acc.number} - {acc.name}</option>
                           ))}
                        </select>
                    </div>
                    <div className="flex justify-end gap-2 pt-4"><DialogClose asChild><Button type="button" variant="outline">Cancelar</Button></DialogClose><Button type="submit" className="bg-blue-600 hover:bg-blue-700">Registrar Aporte</Button></div>
                </form>
            </DialogContent>
        </Dialog>
    );
};

export default BankAccounts;