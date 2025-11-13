
import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { Plus, Download, Edit2, Trash2, Search, CheckCircle, DollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useCompanyData } from '@/hooks/useCompanyData';
import { exportToExcel } from '@/lib/excel';
import { format } from 'date-fns';
import { Combobox } from '@/components/ui/combobox';

const AccountsReceivable = () => {
    const [receivables, saveReceivables] = useCompanyData('accountsReceivable');
    const [transactions, saveTransactions] = useCompanyData('transactions');
    const [accounts] = useCompanyData('accounts');
    const [bankAccounts] = useCompanyData('bankAccounts');
    const [dialogOpen, setDialogOpen] = useState(false);
    const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
    const [receivableToPay, setReceivableToPay] = useState(null);
    const [editingReceivable, setEditingReceivable] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const { toast } = useToast();

    const handleSaveReceivable = (receivableData) => {
        const { isNew, ...data } = receivableData;
        let updatedReceivables;
        let updatedTransactions = [...(transactions || [])];

        if (isNew) {
            const newReceivableId = Date.now().toString();
            updatedReceivables = [...(receivables || []), { ...data, id: newReceivableId, status: 'Pendiente' }];

            const newIncomeTransaction = {
                id: `txn-inc-${newReceivableId}`,
                type: 'income',
                date: data.issueDate,
                description: `Ingreso por venta a crédito: ${data.description}`,
                amount: data.amount,
                category: data.linkedAccount,
                destination: 'accounts_receivable', 
                isReceivablePayable: true,
            };
            updatedTransactions.push(newIncomeTransaction);

            toast({ title: "Cuenta por cobrar creada", description: "Se ha generado un ingreso asociado (no afecta caja)." });
        } else {
            updatedReceivables = receivables.map(r => r.id === editingReceivable.id ? { ...r, ...data } : r);
            const transactionIndex = updatedTransactions.findIndex(t => t.id === `txn-inc-${editingReceivable.id}`);
            if (transactionIndex > -1) {
                updatedTransactions[transactionIndex] = {
                    ...updatedTransactions[transactionIndex],
                    date: data.issueDate,
                    description: `Ingreso por venta a crédito: ${data.description}`,
                    amount: data.amount,
                    category: data.linkedAccount,
                };
            }
            toast({ title: "Cuenta por cobrar actualizada" });
        }
        
        saveTransactions(updatedTransactions);
        saveReceivables(updatedReceivables);
        setDialogOpen(false);
    };

    const handleDeleteReceivable = (id) => {
        saveTransactions(transactions.filter(t => t.id !== `txn-inc-${id}` && t.id !== `txn-pay-${id}`));
        saveReceivables(receivables.filter(r => r.id !== id));
        toast({ title: "Cuenta por cobrar eliminada", description: "La transacción de ingreso asociada también fue eliminada." });
    };

    const handleMarkAsCollected = (paymentData) => {
        const { receivable, destination } = paymentData;
        const newPaymentTransaction = {
            id: `txn-pay-${receivable.id}`,
            type: 'income',
            date: format(new Date(), 'yyyy-MM-dd'),
            description: `Cobro de Cta. por Cobrar: ${receivable.description}`,
            amount: receivable.amount,
            category: 'Cuentas por Cobrar',
            destination: destination, 
        };
        saveTransactions([...(transactions || []), newPaymentTransaction]);

        const updatedReceivables = receivables.map(r => r.id === receivable.id ? { ...r, status: 'Cobrado' } : r);
        saveReceivables(updatedReceivables);

        toast({ title: "¡Cuenta Cobrada!", description: `Se ha registrado el cobro en ${destination.split('|')[1]}.` });
        setPaymentDialogOpen(false);
    };

    const handleExport = () => {
        if(filteredReceivables.length === 0) {
            toast({ variant: 'destructive', title: "No hay datos para exportar"});
            return;
        }
        exportToExcel(filteredReceivables.map(r => ({
            'Cliente': r.customer, 'Descripción': r.description, 'Fecha Emisión': r.issueDate, 'Fecha Vencimiento': r.dueDate, 'Monto': r.amount, 'Estado': r.status
        })), `Cuentas_Por_Cobrar`);
    };

    const filteredReceivables = (receivables || []).filter(r => 
        r.customer.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.description.toLowerCase().includes(searchTerm.toLowerCase())
    ).sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));

    return (
        <>
        <Helmet><title>Cuentas por Cobrar - JaiderHerTur26</title></Helmet>
        <div className="space-y-6">
            <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex justify-between items-center">
                <div><h1 className="text-4xl font-bold text-slate-900">Cuentas por Cobrar</h1><p className="text-slate-600">Lleva un control de lo que tus clientes te deben.</p></div>
                <Button onClick={() => { setEditingReceivable(null); setDialogOpen(true); }} className="bg-green-600 hover:bg-green-700"><Plus className="w-4 h-4 mr-2" /> Nueva Cuenta</Button>
            </motion.div>
            
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-xl shadow-lg p-6 border flex flex-wrap gap-4 items-end">
                <div className="flex-1 min-w-[200px] relative"><Label>Buscar:</Label><Search className="absolute left-3 top-10 transform -translate-y-1/2 text-slate-400 w-5 h-5" /><input type="text" placeholder="Cliente o descripción..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full mt-1 pl-10 pr-4 py-2 border rounded-lg" /></div>
                <div className="flex gap-2 flex-wrap"><Button onClick={handleExport} variant="outline"><Download className="w-4 h-4 mr-2" /> Exportar</Button></div>
            </motion.div>

            {filteredReceivables.length === 0 ? (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-16 bg-white rounded-xl shadow-lg border">
                    <DollarSign className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                    <p className="text-slate-500">No tienes cuentas por cobrar pendientes.</p>
                </motion.div>
            ) : (
                <div className="bg-white rounded-xl shadow-lg border overflow-x-auto"><table className="w-full text-sm">
                    <thead className="bg-slate-50"><tr>{['Cliente', 'Descripción', 'Vencimiento', 'Monto', 'Estado', 'Acciones'].map(h => <th key={h} className="p-3 text-left font-semibold">{h}</th>)}</tr></thead>
                    <tbody className="divide-y">{filteredReceivables.map(r => (<tr key={r.id} className={`hover:bg-slate-50 ${r.status === 'Cobrado' ? 'text-slate-400' : ''}`}>
                        <td className="p-3 font-medium">{r.customer}</td><td className="p-3">{r.description}</td><td className="p-3">{format(new Date(r.dueDate), 'dd/MM/yyyy')}</td><td className="p-3 font-mono">${parseFloat(r.amount).toLocaleString('es-ES')}</td>
                        <td className="p-3"><span className={`px-2 py-1 text-xs font-semibold rounded-full ${r.status === 'Cobrado' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>{r.status}</span></td>
                        <td className="p-3"><div className="flex gap-1">
                            {r.status === 'Pendiente' && <Button size="icon" variant="ghost" className="hover:text-green-600" onClick={() => { setReceivableToPay(r); setPaymentDialogOpen(true); }} title="Marcar como Cobrado"><CheckCircle className="w-4 h-4" /></Button>}
                            <Button size="icon" variant="ghost" onClick={() => { setEditingReceivable(r); setDialogOpen(true); }}><Edit2 className="w-4 h-4" /></Button>
                            <Button size="icon" variant="ghost" className="hover:text-red-600" onClick={() => handleDeleteReceivable(r.id)}><Trash2 className="w-4 h-4" /></Button>
                        </div></td>
                    </tr>))}</tbody>
                </table></div>
            )}
        </div>
        <ReceivableDialog open={dialogOpen} onOpenChange={setDialogOpen} onSave={handleSaveReceivable} receivable={editingReceivable} accounts={accounts} />
        <PaymentDialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen} onSave={handleMarkAsCollected} receivable={receivableToPay} bankAccounts={bankAccounts} />
        </>
    );
};

const ReceivableDialog = ({ open, onOpenChange, onSave, receivable, accounts }) => {
    const defaultData = { customer: '', description: '', issueDate: format(new Date(), 'yyyy-MM-dd'), dueDate: '', amount: '', linkedAccount: '' };
    const [data, setData] = useState(defaultData);
    const { toast } = useToast();

    useEffect(() => { 
        if(open) { 
            if(receivable) setData(receivable); 
            else setData(defaultData); 
        } 
    }, [receivable, open]);
    
    const handleSubmit = e => { 
        e.preventDefault(); 
        if (!data.linkedAccount) {
            toast({ variant: 'destructive', title: 'Campo Requerido', description: 'Debes seleccionar la cuenta de ingreso contrapartida.'});
            return;
        }
        onSave({ ...data, isNew: !receivable }); 
    };

    const incomeAccounts = (accounts || [])
        .filter(a => a.number.startsWith('4'))
        .sort((a,b) => a.number.localeCompare(b.number))
        .map(a => ({ value: a.name, label: `${a.number} - ${a.name}` }));

    return(<Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>{receivable ? 'Editar' : 'Nueva'} Cuenta por Cobrar</DialogTitle></DialogHeader><form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
        <div className="md:col-span-2 space-y-1"><Label>Cliente</Label><input required value={data.customer} onChange={e => setData({...data, customer: e.target.value})} className="w-full p-2 border rounded-lg" /></div>
        <div className="md:col-span-2 space-y-1"><Label>Descripción</Label><input required value={data.description} onChange={e => setData({...data, description: e.target.value})} className="w-full p-2 border rounded-lg" /></div>
        <div className="space-y-1"><Label>Fecha de Emisión</Label><input type="date" required value={data.issueDate} onChange={e => setData({...data, issueDate: e.target.value})} className="w-full p-2 border rounded-lg" /></div>
        <div className="space-y-1"><Label>Fecha de Vencimiento</Label><input type="date" required value={data.dueDate} onChange={e => setData({...data, dueDate: e.target.value})} className="w-full p-2 border rounded-lg" /></div>
        <div className="space-y-1"><Label>Monto</Label><input type="number" step="0.01" required value={data.amount} onChange={e => setData({...data, amount: e.target.value})} className="w-full p-2 border rounded-lg" /></div>
        <div className="space-y-1">
            <Label>Contrapartida (Cuenta de Ingreso)</Label>
            <Combobox options={incomeAccounts} value={data.linkedAccount} onSelect={value => setData({...data, linkedAccount: value})} placeholder="Seleccionar Ingreso" />
        </div>
        <div className="md:col-span-2 flex justify-end gap-2 pt-4"><DialogClose asChild><Button type="button" variant="outline">Cancelar</Button></DialogClose><Button type="submit" className="bg-green-600 hover:bg-green-700">Guardar</Button></div>
    </form></DialogContent></Dialog>);
};

const PaymentDialog = ({ open, onOpenChange, onSave, receivable, bankAccounts }) => {
    const [destination, setDestination] = useState('caja_principal|CAJA PRINCIPAL');
    useEffect(() => {
        if (open) {
            setDestination('caja_principal|CAJA PRINCIPAL');
        }
    }, [open]);
    
    const handleSave = () => {
        onSave({ receivable, destination });
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader><DialogTitle>Registrar Cobro</DialogTitle></DialogHeader>
                <div className="py-4 space-y-4">
                    <p>Vas a marcar la cuenta de <strong>{receivable?.customer}</strong> por un monto de <strong>${parseFloat(receivable?.amount || 0).toLocaleString('es-ES')}</strong> como cobrada.</p>
                    <div className="space-y-2">
                        <Label htmlFor="destination">¿Dónde se recibió el dinero?</Label>
                        <select id="destination" value={destination} onChange={e => setDestination(e.target.value)} className="w-full p-2 border rounded-lg">
                            <option value="caja_principal|CAJA PRINCIPAL">Caja Principal (Efectivo)</option>
                            {(bankAccounts || []).map(b_acc => (
                                <option key={b_acc.id} value={`${b_acc.id}|${b_acc.bankName}`}>{b_acc.bankName}</option>
                            ))}
                        </select>
                    </div>
                </div>
                <DialogFooter>
                    <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
                    <Button onClick={handleSave} className="bg-green-600 hover:bg-green-700">Confirmar Cobro</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default AccountsReceivable;
