import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Combobox } from '@/components/ui/combobox';
import { useCompanyData } from '@/hooks/useCompanyData';
import { useToast } from '@/components/ui/use-toast';

const TransactionDialog = ({ open, onOpenChange, transaction, onSave }) => {
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    description: '',
    amount: '',
    type: 'income',
    category: '',
    contactId: '',
    destination: 'caja_principal|CAJA PRINCIPAL', // New field
    isFixedAsset: false,
  });

  const [accounts] = useCompanyData('accounts');
  const [contacts] = useCompanyData('contacts');
  const [bankAccounts] = useCompanyData('bankAccounts');
  const { toast } = useToast();

  useEffect(() => {
    if (transaction) {
      setFormData({
        ...transaction,
        date: new Date(transaction.date).toISOString().split('T')[0],
        destination: transaction.destination || 'caja_principal|CAJA PRINCIPAL',
      });
    } else {
      setFormData({
        date: new Date().toISOString().split('T')[0],
        description: '',
        amount: '',
        type: 'income',
        category: '',
        contactId: '',
        destination: 'caja_principal|CAJA PRINCIPAL',
        isFixedAsset: false,
      });
    }
  }, [transaction, open]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.category) {
      toast({
        variant: "destructive",
        title: "Campo Requerido",
        description: "Por favor, selecciona una categoría contable.",
      });
      return;
    }
    if (!formData.destination) {
      toast({
        variant: "destructive",
        title: "Campo Requerido",
        description: "Por favor, selecciona un Origen/Destino.",
      });
      return;
    }
    onSave(formData);
  };
  
  const accountOptions = (accounts || [])
    .sort((a, b) => a.number.localeCompare(b.number))
    .map(account => ({
      value: account.name,
      label: `${account.number} - ${account.name}`,
    }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">{transaction ? 'Editar' : 'Nueva'} Transacción</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="type">Tipo</Label>
              <select id="type" value={formData.type} onChange={(e) => setFormData({ ...formData, type: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg">
                <option value="income">Ingreso</option>
                <option value="expense">Gasto</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="date">Fecha</Label>
              <input id="date" type="date" required value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Descripción</Label>
            <input id="description" required value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
                <Label>Categoría (Cuenta Contable)</Label>
                <Combobox
                    options={accountOptions}
                    value={formData.category}
                    onSelect={(value) => setFormData({ ...formData, category: value })}
                    placeholder="Selecciona una cuenta"
                    searchPlaceholder="Buscar cuenta..."
                    notFoundMessage="No se encontró la cuenta."
                />
            </div>
             <div className="space-y-2">
                <Label htmlFor="destination">Origen/Destino</Label>
                <select id="destination" required value={formData.destination} onChange={(e) => setFormData({ ...formData, destination: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg">
                    <option value="caja_principal|CAJA PRINCIPAL">CAJA PRINCIPAL</option>
                    {(bankAccounts || []).map(b_acc => (
                        <option key={b_acc.id} value={`${b_acc.id}|${b_acc.bankName}`}>{b_acc.bankName}</option>
                    ))}
                </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="amount">Monto</Label>
              <input id="amount" type="number" step="0.01" required value={formData.amount} onChange={(e) => setFormData({ ...formData, amount: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contactId">Contacto (Opcional)</Label>
              <select id="contactId" value={formData.contactId} onChange={(e) => setFormData({ ...formData, contactId: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg">
                <option value="">Ninguno</option>
                {(contacts || []).map(contact => (
                  <option key={contact.id} value={contact.id}>{contact.name}</option>
                ))}
              </select>
            </div>
          </div>
          {formData.type === 'expense' && (
            <div className="flex items-center space-x-2">
              <input type="checkbox" id="isFixedAsset" checked={formData.isFixedAsset} onChange={(e) => setFormData({ ...formData, isFixedAsset: e.target.checked })} className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"/>
              <Label htmlFor="isFixedAsset" className="text-sm font-medium text-gray-700">¿Es un Activo Fijo? (Creará un item en el inventario)</Label>
            </div>
          )}
          <DialogFooter className="pt-4">
            <DialogClose asChild><Button type="button" variant="outline">Cancelar</Button></DialogClose>
            <Button type="submit" className="bg-blue-600 hover:bg-blue-700">Guardar</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default TransactionDialog;