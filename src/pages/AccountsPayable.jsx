
import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { Plus, Download, Edit2, Trash2, Search, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useCompanyData } from '@/hooks/useCompanyData';
import { exportToExcel } from '@/lib/excel';
import { format } from 'date-fns';
import { Combobox } from '@/components/ui/combobox';


const AccountsPayable = () => {
    const [payables, savePayables] = useCompanyData('accountsPayable');
    const [transactions, saveTransactions] = useCompanyData('transactions');
    const [accounts] = useCompanyData('accounts');
    const [bankAccounts] = useCompanyData('bankAccounts');
    const [dialogOpen, setDialogOpen] = useState(false);
    const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
    const [payableToPay, setPayableToPay] = useState(null);
    const [editingPayable, setEditingPayable] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const { toast } = useToast();

    const handleSavePayable = (payableData) => {
        const { isNew, ...data } = payableData;
        let updatedPayables;
        let updatedTransactions = [...(transactions || [])];

        if (isNew) {
            const newPayableId = Date.now().toString();
            updatedPayables = [...(payables || []), { ...data, id: newPayableId, status: 'Pendiente' }];

            const newExpenseTransaction = {
                id: `txn-exp-${newPayableId}`,
                type: 'expense',
                date: data.issueDate,
                description: `Gasto por compra a crédito: ${data.description}`,
                amount: data.amount,
                category: data.linkedAccount,
                destination: 'accounts_payable', 
                isReceivablePayable: true,
            };
            updatedTransactions.push(newExpenseTransaction);

            toast({ title: "Cuenta por pagar creada", description: "Se ha generado un gasto asociado (no afecta caja)." });
        } else {
            updatedPayables = payables.map(p => p.id === editingPayable.id ? { ...p, ...data } : p);
            const transactionIndex = updatedTransactions.findIndex(t => t.id === `txn-exp-${editingPayable.id}`);
            if (transactionIndex > -1) {
                updatedTransactions[transactionIndex] = {
                    ...updatedTransactions[transactionIndex],
                    date: data.issueDate,
                    description: `Gasto por compra a crédito: ${data.description}`,
                    amount: data.amount,
                    category: data.linkedAccount,
                };
            }
            toast({ title: "Cuenta por pagar actualizada" });
        }
        
        saveTransactions(updatedTransactions);
        savePayables(updatedPayables);
        setDialogOpen(false);
    };

    const handleDeletePayable = (id) => {
        saveTransactions(transactions.filter(t => t.id !== `txn-exp-${id}` && t.id !== `txn-pay-${id}`));
        savePayables(payables.filter(p => p.id !== id));
        toast({ title: "Cuenta por pagar eliminada", description: "La transacción de gasto asociada también fue eliminada." });
    };

    const handleMarkAsPaid = (paymentData) => {
        const { payable, origin } = paymentData;
        const newPaymentTransaction = {
            id: `txn-pay-${payable.id}`,
            type: 'expense',
            date: format(new Date(), 'yyyy-MM-dd'),
            description: `Pago de Cta. por Pagar: ${payable.description}`,
            amount: payable.amount,
            category: 'Cuentas por Pagar',
            destination: origin,
        };
        saveTransactions([...(transactions || []), newPaymentTransaction]);

        const updatedPayables = payables.map(p => p.id === payable.id ? { ...p, status: 'Pagado' } : p);
        savePayables(updatedPayables);

        toast({ title: "¡Cuenta Pagada!", description: `Se ha registrado el pago desde ${origin.split('|')[1]}.` });
        setPaymentDialogOpen(false);
    };

    const handleExport = () => {
        if(filteredPayables.length === 0) {
            toast({ variant: 'destructive', title: "No hay datos para exportar"});
            return;
        }
        exportToExcel(filteredPayables.map(p => ({
            'Proveedor': p.supplier, 'Descripción': p.description, 'Fecha Emisión': p.issueDate, 'Fecha Vencimiento': p.dueDate, 'Monto': p.amount, 'Estado': p.status
        })), `Cuentas_Por_Pagar`);
    };

    const filteredPayables = (payables || []).filter(p => 
        p.supplier.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.description.toLowerCase().includes(searchTerm.toLowerCase())
    ).sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));

    return (
        <>
        <Helmet><title>Cuentas por Pagar - JaiderHerTur26</title></Helmet>
        <div className="space-y-6">
            <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex justify-between items-center">
                <div><h1 className="text-4xl font-bold text-slate-900">Cuentas por Pagar</h1><p className="text-slate-600">Gestiona tus deudas y obligaciones con proveedores.</p></div>
                <Button onClick={() => { setEditingPayable(null); setDialogOpen(true); }} className="bg-red-600 hover:bg-red-700"><Plus className="w-4 h-4 mr-2" /> Nueva Cuenta</Button>
            </motion.div>
            
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-xl shadow-lg p-6 border flex flex-wrap gap-4 items-end">
                <div className="flex-1 min-w-[200px] relative"><Label>Buscar:</Label><Search className="absolute left-3 top-10 transform -translate-y-1/2 text-slate-400 w-5 h-5" /><input type="text" placeholder="Proveedor o descripción..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full mt-1 pl-10 pr-4 py-2 border rounded-lg" /></div>
                <div className="flex gap-2 flex-wrap"><Button onClick={handleExport} variant="outline"><Download className="w-4 h-4 mr-2" /> Exportar</Button></div>
            </motion.div>

            {filteredPayables.length === 0 ? (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-16 bg-white rounded-xl shadow-lg border">
                    <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
                    <p className="text-slate-500">¡Felicidades! No tienes cuentas por pagar pendientes.</p>
                </motion.div>
            ) : (
                <div className="bg-white rounded-xl shadow-lg border overflow-x-auto"><table className="w-full text-sm">
                    <thead className="bg-slate-50"><tr>{['Proveedor', 'Descripción', 'Vencimiento', 'Monto', 'Estado', 'Acciones'].map(h => <th key={h} className="p-3 text-left font-semibold">{h}</th>)}</tr></thead>
                    <tbody className="divide-y">{filteredPayables.map(p => (<tr key={p.id} className={`hover:bg-slate-50 ${p.status === 'Pagado' ? 'text-slate-400' : ''}`}>
                        <td className="p-3 font-medium">{p.supplier}</td><td className="p-3">{p.description}</td><td className="p-3">{format(new Date(p.dueDate), 'dd/MM/yyyy')}</td><td className="p-3 font-mono">${parseFloat(p.amount).toLocaleString('es-ES')}</td>
                        <td className="p-3"><span className={`px-2 py-1 text-xs font-semibold rounded-full ${p.status === 'Pagado' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>{p.status}</span></td>
                        <td className="p-3"><div className="flex gap-1">
                            {p.status === 'Pendiente' && <Button size="icon" variant="ghost" className="hover:text-green-600" onClick={() => { setPayableToPay(p); setPaymentDialogOpen(true); }} title="Marcar como Pagado"><CheckCircle className="w-4 h-4" /></Button>}
                            <Button size="icon" variant="ghost" onClick={() => { setEditingPayable(p); setDialogOpen(true); }}><Edit2 className="w-4 h-4" /></Button>
                            <Button size="icon" variant="ghost" className="hover:text-red-600" onClick={() => handleDeletePayable(p.id)}><Trash2 className="w-4 h-4" /></Button>
                        </div></td>
                    </tr>))}</tbody>
                </table></div>
            )}
        </div>
        <PayableDialog open={dialogOpen} onOpenChange={setDialogOpen} onSave={handleSavePayable} payable={editingPayable} accounts={accounts} />
        <PaymentDialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen} onSave={handleMarkAsPaid} payable={payableToPay} bankAccounts={bankAccounts} />
        </>
    );
}

const PayableDialog = ({ open, onOpenChange, onSave, payable, accounts }) => {
    const defaultData = { supplier: '', description: '', issueDate: format(new Date(), 'yyyy-MM-dd'), dueDate: '', amount: '', linkedAccount: '' };
    const [data, setData] = useState(defaultData);
    const { toast } = useToast();

    useEffect(() => { 
        if(open) { 
            if(payable) setData(payable); 
            else setData(defaultData); 
        } 
    }, [payable, open]);
    
    const handleSubmit = e => { 
        e.preventDefault(); 
        if (!data.linkedAccount) {
            toast({ variant: 'destructive', title: 'Campo Requerido', description: 'Debes seleccionar la cuenta de gasto contrapartida.'});
            return;
        }
        onSave({ ...data, isNew: !payable }); 
    };

    const expenseAccounts = (accounts || [])
        .filter(a => a.number.startsWith('5') || a.number.startsWith('6'))
        .sort((a,b) => a.number.localeCompare(b.number))
        .map(a => ({ value: a.name, label: `${a.number} - ${a.name}` }));

    return(<Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>{payable ? 'Editar' : 'Nueva'} Cuenta por Pagar</DialogTitle></DialogHeader><form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
        <div className="md:col-span-2 space-y-1"><Label>Proveedor</Label><input required value={data.supplier} onChange={e => setData({...data, supplier: e.target.value})} className="w-full p-2 border rounded-lg" /></div>
        <div className="md:col-span-2 space-y-1"><Label>Descripción</Label><input required value={data.description} onChange={e => setData({...data, description: e.target.value})} className="w-full p-2 border rounded-lg" /></div>
        <div className="space-y-1"><Label>Fecha de Emisión</Label><input type="date" required value={data.issueDate} onChange={e => setData({...data, issueDate: e.target.value})} className="w-full p-2 border rounded-lg" /></div>
        <div className="space-y-1"><Label>Fecha de Vencimiento</Label><input type="date" required value={data.dueDate} onChange={e => setData({...data, dueDate: e.target.value})} className="w-full p-2 border rounded-lg" /></div>
        <div className="space-y-1"><Label>Monto</Label><input type="number" step="0.01" required value={data.amount} onChange={e => setData({...data, amount: e.target.value})} className="w-full p-2 border rounded-lg" /></div>
        <div className="space-y-1">
            <Label>Contrapartida (Cuenta de Gasto)</Label>
            <Combobox options={expenseAccounts} value={data.linkedAccount} onSelect={value => setData({...data, linkedAccount: value})} placeholder="Seleccionar Gasto" />
        </div>
        <div className="md:col-span-2 flex justify-end gap-2 pt-4"><DialogClose asChild><Button type="button" variant="outline">Cancelar</Button></DialogClose><Button type="submit" className="bg-red-600 hover:bg-red-700">Guardar</Button></div>
    </form></DialogContent></Dialog>);
};

const PaymentDialog = ({ open, onOpenChange, onSave, payable, bankAccounts }) => {
    const [origin, setOrigin] = useState('caja_principal|CAJA PRINCIPAL');
    useEffect(() => {
        if (open) {
            setOrigin('caja_principal|CAJA PRINCIPAL');
        }
    }, [open]);
    
    const handleSave = () => {
        onSave({ payable, origin });
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader><DialogTitle>Registrar Pago</DialogTitle></DialogHeader>
                <div className="py-4 space-y-4">
                    <p>Vas a marcar la cuenta de <strong>{payable?.supplier}</strong> por un monto de <strong>${parseFloat(payable?.amount || 0).toLocaleString('es-ES')}</strong> como pagada.</p>
                    <div className="space-y-2">
                        <Label htmlFor="origin">¿Desde dónde se realizó el pago?</Label>
                        <select id="origin" value={origin} onChange={e => setOrigin(e.target.value)} className="w-full p-2 border rounded-lg">
                            <option value="caja_principal|CAJA PRINCIPAL">Caja Principal (Efectivo)</option>
                            {(bankAccounts || []).map(b_acc => (
                                <option key={b_acc.id} value={`${b_acc.id}|${b_acc.bankName}`}>{b_acc.bankName}</option>
                            ))}
                        </select>
                    </div>
                </div>
                <DialogFooter>
                    <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
                    <Button onClick={handleSave} className="bg-red-600 hover:bg-red-700">Confirmar Pago</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default AccountsPayable;
