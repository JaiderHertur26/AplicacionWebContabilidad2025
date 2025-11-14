import React, { useState, useRef, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { Plus, Search, Edit2, Trash2, BookOpen, Download, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useCompanyData } from '@/hooks/useCompanyData';
import { exportToExcel } from '@/lib/excel';
import * as XLSX from 'xlsx';

const accountTypes = [
    { id: '1', name: 'Activo' },
    { id: '2', name: 'Pasivo' },
    { id: '3', name: 'Patrimonio' },
    { id: '4', name: 'Ingresos' },
    { id: '5', name: 'Gastos' },
    { id: '6', name: 'Costos de Venta' },
];

const Accounts = () => {
  const [accounts, saveAccounts] = useCompanyData('accounts');
  const [searchTerm, setSearchTerm] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState(null);
  const { toast } = useToast();
  const fileInputRef = useRef(null);

  const handleSaveAccount = (account) => {
    let updatedAccounts;
    if (editingAccount) {
      updatedAccounts = accounts.map(a => a.id === editingAccount.id ? account : a);
      toast({ title: "¡Cuenta actualizada!" });
    } else {
      updatedAccounts = [...accounts, { ...account, id: Date.now().toString() }];
      toast({ title: "¡Cuenta creada!" });
    }
    saveAccounts(updatedAccounts.sort((a, b) => a.number.localeCompare(b.number)));
    setDialogOpen(false);
    setEditingAccount(null);
  };

  const handleDeleteAccount = (id) => {
    saveAccounts(accounts.filter(a => a.id !== id));
    toast({ title: "Cuenta eliminada" });
  };
  
  const handleExport = () => {
    if (accounts.length === 0) {
      toast({ variant: 'destructive', title: "No hay cuentas para exportar" });
      return;
    }
    const dataToExport = accounts.map(c => ({
      'Numero': c.number,
      'Nombre': c.name,
    }));
    exportToExcel(dataToExport, 'Plan_de_Cuentas');
    toast({ title: "¡Exportado!", description: "Tu plan de cuentas ha sido exportado a Excel." });
  };
  
  const handleImport = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const json = XLSX.utils.sheet_to_json(worksheet, { header: ["number", "name"], range: 1 });
          
          const newAccounts = json.map(acc => ({
            id: Date.now().toString() + Math.random(),
            number: acc.number.toString(),
            name: acc.name.toString(),
          }));
          
          const updatedAccounts = [...accounts, ...newAccounts];
          saveAccounts(updatedAccounts.sort((a,b) => a.number.localeCompare(b.number)));
          
          toast({ title: "¡Importación exitosa!", description: `${newAccounts.length} cuentas agregadas.` });
        } catch (error) {
          toast({ variant: 'destructive', title: "Error de importación", description: "El archivo no es válido o tiene un formato incorrecto." });
        }
      };
      reader.readAsArrayBuffer(file);
      fileInputRef.current.value = ""; // Reset file input
    }
  };


  const openDialogForEdit = (account) => {
    setEditingAccount(account);
    setDialogOpen(true);
  };

  const openDialogForNew = () => {
    setEditingAccount(null);
    setDialogOpen(true);
  };

  const filteredAccounts = accounts.filter(a =>
    a.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.number.toLowerCase().includes(searchTerm.toLowerCase())
  ).sort((a, b) => a.number.localeCompare(b.number));
  
  const groupedAccounts = accountTypes.map(type => ({
      ...type,
      accounts: filteredAccounts.filter(acc => acc.number.startsWith(type.id))
  })).filter(group => group.accounts.length > 0);

  return (
    <>
      <Helmet>
        <title>Plan de Cuentas - JaiderHerTur26</title>
        <meta name="description" content="Gestiona tu plan de cuentas contables" />
      </Helmet>

      <div className="space-y-6">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-4xl font-bold text-slate-900">Plan de Cuentas</h1>
            <p className="text-slate-600">Define y gestiona tus cuentas contables</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleExport} variant="outline"><Download className="w-4 h-4 mr-2" />Exportar</Button>
            <Button asChild variant="outline">
                <label className="cursor-pointer"><Upload className="w-4 h-4 mr-2" />Importar
                <input type="file" ref={fileInputRef} accept=".xlsx, .xls" onChange={handleImport} className="hidden" />
                </label>
            </Button>
            <Button onClick={openDialogForNew} className="bg-blue-600 hover:bg-blue-700">
                <Plus className="w-4 h-4 mr-2" />
                Nueva Cuenta
            </Button>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-white rounded-xl shadow-lg p-6 border border-slate-200">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Buscar por número o concepto..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
          {groupedAccounts.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-xl shadow-lg border">
              <BookOpen className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500 text-lg">No hay cuentas contables definidas.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {groupedAccounts.map(group => (
                <div key={group.id} className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
                    <h2 className="px-6 py-3 bg-slate-50 text-lg font-bold text-blue-800 border-b">{group.name}</h2>
                    <table className="w-full">
                        <thead className="bg-slate-50 border-b">
                            <tr>
                                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-900 w-1/3">Número de Cuenta</th>
                                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-900">Concepto</th>
                                <th className="px-6 py-4 text-right text-sm font-semibold text-slate-900">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                            {group.accounts.map((account, index) => (
                            <motion.tr key={account.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: index * 0.05 }} className="hover:bg-slate-50">
                                <td className="px-6 py-4 font-mono text-sm text-slate-600">{account.number}</td>
                                <td className="px-6 py-4 font-medium text-slate-900">{account.name}</td>
                                <td className="px-6 py-4 text-right">
                                <div className="flex justify-end gap-2">
                                    <Button variant="ghost" size="icon" onClick={() => openDialogForEdit(account)} className="hover:bg-blue-50 hover:text-blue-600"><Edit2 className="w-4 h-4" /></Button>
                                    <Button variant="ghost" size="icon" onClick={() => handleDeleteAccount(account.id)} className="hover:bg-red-50 hover:text-red-600"><Trash2 className="w-4 h-4" /></Button>
                                </div>
                                </td>
                            </motion.tr>
                            ))}
                        </tbody>
                    </table>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </div>

      <AccountDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        account={editingAccount}
        onSave={handleSaveAccount}
      />
    </>
  );
};

const AccountDialog = ({ open, onOpenChange, account, onSave }) => {
  const [formData, setFormData] = useState({ number: '', name: '', typeId: '1' });

  useEffect(() => {
    if (account) {
      const typeId = account.number.charAt(0);
      setFormData({ ...account, typeId });
    } else {
      setFormData({ number: '', name: '', id: null, typeId: '1' });
    }
  }, [account, open]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">{account ? 'Editar Cuenta' : 'Nueva Cuenta'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label htmlFor="typeId">Tipo de Cuenta</Label>
            <select id="typeId" required value={formData.typeId} onChange={(e) => setFormData({ ...formData, typeId: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg">
                {accountTypes.map(type => (
                    <option key={type.id} value={type.id}>{type.name}</option>
                ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="number">Número de Cuenta</Label>
            <input id="number" required value={formData.number} onChange={(e) => setFormData({ ...formData, number: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg" placeholder="Ej: 110505" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="name">Concepto de la Cuenta</Label>
            <input id="name" required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg" placeholder="Ej: Caja General" />
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" className="bg-blue-600 hover:bg-blue-700">Guardar</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default Accounts;