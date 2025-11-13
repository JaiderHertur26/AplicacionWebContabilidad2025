import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useCompanyData } from '@/hooks/useCompanyData';
import { useToast } from '@/components/ui/use-toast';
import { format } from 'date-fns';

const InternalTransferDialog = ({ open, onOpenChange, onSave }) => {
  const [formData, setFormData] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    description: '',
    amount: '',
    fromAccount: '',
    toAccount: '',
  });

  const [bankAccounts] = useCompanyData('bankAccounts');
  const { toast } = useToast();

  const accountOptions = [
    { value: 'caja_principal|CAJA PRINCIPAL', label: 'CAJA PRINCIPAL' },
    ...(bankAccounts || []).map(acc => ({
      value: `${acc.id}|${acc.bankName}`,
      label: acc.bankName,
    })),
  ];

  useEffect(() => {
    if (open) {
      setFormData({
        date: format(new Date(), 'yyyy-MM-dd'),
        description: '',
        amount: '',
        fromAccount: '',
        toAccount: '',
      });
    }
  }, [open]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.fromAccount || !formData.toAccount) {
      toast({ variant: 'destructive', title: 'Error', description: 'Debe seleccionar una cuenta de origen y destino.' });
      return;
    }
    if (formData.fromAccount === formData.toAccount) {
      toast({ variant: 'destructive', title: 'Error', description: 'La cuenta de origen y destino no pueden ser la misma.' });
      return;
    }
    onSave(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">Nueva Transferencia Interna</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-slate-600">
            Registra movimientos de dinero entre tu Caja Principal y tus cuentas bancarias. Esto no afectará tu balance general.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label htmlFor="description">Descripción</Label>
            <input id="description" required value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="fromAccount">Desde (Origen)</Label>
              <select id="fromAccount" required value={formData.fromAccount} onChange={(e) => setFormData({ ...formData, fromAccount: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg">
                <option value="" disabled>Seleccionar origen</option>
                {accountOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="toAccount">Hacia (Destino)</Label>
              <select id="toAccount" required value={formData.toAccount} onChange={(e) => setFormData({ ...formData, toAccount: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg">
                <option value="" disabled>Seleccionar destino</option>
                {accountOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
             <div className="space-y-2">
                <Label htmlFor="amount">Monto</Label>
                <input id="amount" type="number" step="0.01" required value={formData.amount} onChange={(e) => setFormData({ ...formData, amount: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
             </div>
             <div className="space-y-2">
                <Label htmlFor="date">Fecha</Label>
                <input id="date" type="date" required value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
             </div>
          </div>
          <DialogFooter className="pt-4">
            <DialogClose asChild><Button type="button" variant="outline">Cancelar</Button></DialogClose>
            <Button type="submit" className="bg-blue-600 hover:bg-blue-700">Registrar Transferencia</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default InternalTransferDialog;