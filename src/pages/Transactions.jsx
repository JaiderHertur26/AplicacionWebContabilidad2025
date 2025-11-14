
import React, { useState, useEffect, useRef } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { Plus, Search, Edit2, Trash2, Printer, Download, Loader2, ArrowRightLeft, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import TransactionDialog from '@/components/transactions/TransactionDialog';
import InternalTransferDialog from '@/components/transactions/InternalTransferDialog';
import { exportToExcel } from '@/lib/excel';
import { useCompanyData } from '@/hooks/useCompanyData';
import { useCompany } from '@/App';
import { format, isValid } from 'date-fns';
import Voucher from '@/components/transactions/Voucher';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import * as XLSX from 'xlsx';

const Transactions = () => {
  const { activeCompany } = useCompany();
  const [transactions, saveTransactions] = useCompanyData('transactions');
  const [accounts] = useCompanyData('accounts');
  const [fixedAssets, saveFixedAssets] = useCompanyData('fixedAssets');

  const [filteredTransactions, setFilteredTransactions] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [printDialogOpen, setPrintDialogOpen] = useState(false);
  const [transactionToPrint, setTransactionToPrint] = useState(null);
  const [isPrinting, setIsPrinting] = useState(false);
  const { toast } = useToast();
  const voucherRef = useRef(null);

  useEffect(() => {
    let currentTransactions = transactions || [];
    let filtered = [...currentTransactions];
    if (filterType !== 'all') {
      if (filterType === 'transfer') {
        filtered = filtered.filter(t => t.isInternalTransfer);
      } else {
        filtered = filtered.filter(t => t.type === filterType && !t.isInternalTransfer);
      }
    }
    if (searchTerm) {
      filtered = filtered.filter(t => 
        (t.description && t.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (t.category && t.category.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }
    filtered.sort((a, b) => {
        const dateA = new Date(a.date);
        const dateB = new Date(b.date);
        if (!isValid(dateA)) return 1;
        if (!isValid(dateB)) return -1;
        return dateB - dateA;
    });
    setFilteredTransactions(filtered);
  }, [transactions, searchTerm, filterType]);

  const handlePrintToPdf = async () => {
    if (!voucherRef.current || isPrinting) return;

    setIsPrinting(true);
    toast({ title: "Generando PDF...", description: "Por favor espera un momento." });

    try {
      const canvas = await html2canvas(voucherRef.current, {
        scale: 3,
        useCORS: true,
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdfWidth = 218.5;
      const pdfHeight = 149.7;
      
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: [pdfWidth, pdfHeight]
      });

      const margin = 5;
      const contentWidth = pdfWidth - (margin * 2);
      const contentHeight = pdfHeight - (margin * 2);

      pdf.addImage(imgData, 'PNG', margin, margin, contentWidth, contentHeight);
      
      const pdfBlob = pdf.output('blob');
      const pdfUrl = URL.createObjectURL(pdfBlob);
      
      window.open(pdfUrl, '_blank');
      
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast({
        variant: "destructive",
        title: "Error al generar PDF",
        description: "Ocurrió un problema al crear el archivo PDF.",
      });
    } finally {
      setIsPrinting(false);
      setPrintDialogOpen(false);
    }
  };

  const getNextVoucherNumber = (type) => {
    const sequenceKey = `${activeCompany.id}-voucher-sequence`;
    const sequences = JSON.parse(localStorage.getItem(sequenceKey) || '{ "income": 0, "expense": 0, "transfer": 0 }');
    const nextNumber = (sequences[type] || 0) + 1;
    sequences[type] = nextNumber;
    localStorage.setItem(sequenceKey, JSON.stringify(sequences));
    return nextNumber;
  };

  const handleSaveTransaction = (transactionData) => {
    let updatedTransactions;
    let updatedAssets = [...(fixedAssets || [])];
    let transactionId;

    if (editingTransaction) {
      transactionId = editingTransaction.id;
      updatedTransactions = transactions.map(t => t.id === transactionId ? { ...t, ...transactionData } : t);
      toast({ title: "¡Transacción actualizada!" });
    } else {
      transactionId = Date.now().toString();
      const voucherNumber = getNextVoucherNumber(transactionData.type);
      const newTransaction = { ...transactionData, id: transactionId, voucherNumber };
      updatedTransactions = [...transactions, newTransaction];
      toast({ title: "¡Transacción creada!" });
    }

    const existingAssetIndex = updatedAssets.findIndex(a => a.transactionId === transactionId);

    if (transactionData.type === 'expense' && transactionData.isFixedAsset) {
      const assetPayload = {
        date: transactionData.date,
        name: transactionData.description,
        value: parseFloat(transactionData.amount),
        year: new Date(transactionData.date).getFullYear().toString(),
        transactionId: transactionId,
      };

      if (existingAssetIndex > -1) {
        updatedAssets[existingAssetIndex] = { ...updatedAssets[existingAssetIndex], ...assetPayload };
        toast({ title: "Activo Fijo Actualizado", description: "El activo en inventario fue actualizado." });
      } else {
        const newAsset = { ...assetPayload, id: `asset-${transactionId}`, status: 'Bueno', quantity: 1 };
        updatedAssets.push(newAsset);
        toast({ title: "Activo Fijo Creado", description: "El activo fue añadido al inventario." });
      }
    } else if (existingAssetIndex > -1) {
      updatedAssets.splice(existingAssetIndex, 1);
      toast({ title: "Activo Fijo Eliminado", description: "El activo fue removido del inventario." });
    }

    saveFixedAssets(updatedAssets);
    saveTransactions(updatedTransactions);
    setDialogOpen(false);
    setEditingTransaction(null);
  };
  
  const handleDelete = (id) => {
    const transactionToDelete = transactions.find(t => t.id === id);
    if (!transactionToDelete) return;

    let transactionsToDeleteIds = [id];

    // Revert Asset
    const assetToDelete = (fixedAssets || []).find(a => a.transactionId === id);
    if (assetToDelete) {
      saveFixedAssets(fixedAssets.filter(a => a.id !== assetToDelete.id));
      toast({ title: "Activo Fijo Eliminado", description: "El activo vinculado fue eliminado del inventario." });
    }

    // Revert "Internal Transfer", which now includes "Aporte Ordinario"
    if (transactionToDelete.isInternalTransfer) {
        const baseId = transactionToDelete.id.split('-')[0];
        const siblingType = transactionToDelete.type === 'expense' ? 'inc' : 'exp';
        const siblingId = `${baseId}-${siblingType}`;
        
        // Find sibling transaction to also delete
        const siblingTransaction = transactions.find(t => t.id === siblingId);
        if (siblingTransaction) {
            transactionsToDeleteIds.push(siblingId);
        }

        let toastMessage = 'Transferencia Interna Revertida';
        if (transactionToDelete.description.includes('Aporte Ordinario')) {
            toastMessage = 'Aporte Ordinario Revertido';
        }
        toast({ title: toastMessage });
    }

    // Finally, delete all related transactions
    const remainingTransactions = transactions.filter(t => !transactionsToDeleteIds.includes(t.id));
    saveTransactions(remainingTransactions);

    if (!transactionToDelete.isInternalTransfer) {
        toast({ title: "Transacción eliminada" });
    }
  };


  const handleEdit = (transaction) => {
    setEditingTransaction(transaction);
    setDialogOpen(true);
  };

  const handleNewTransaction = () => {
    setEditingTransaction(null);
    setDialogOpen(true);
  };
  
  const handleNewTransfer = () => {
    setTransferDialogOpen(true);
  };
  
  const handleSaveTransfer = (transferData) => {
    const { fromAccount, toAccount, amount, date, description } = transferData;
    const now = Date.now();
    const [fromId, fromName] = fromAccount.split('|');
    const [toId, toName] = toAccount.split('|');
    const voucherNumber = getNextVoucherNumber('transfer');

    const expenseTransaction = {
      id: `${now}-exp`,
      type: 'expense',
      description: `Transferencia a ${toName}: ${description}`,
      amount: parseFloat(amount),
      category: 'Transferencia Interna',
      date,
      destination: fromAccount, // The origin of the money
      isInternalTransfer: true,
      voucherNumber,
    };

    const incomeTransaction = {
      id: `${now}-inc`,
      type: 'income',
      description: `Transferencia desde ${fromName}: ${description}`,
      amount: parseFloat(amount),
      category: 'Transferencia Interna',
      date,
      destination: toAccount, // The destination of the money
      isInternalTransfer: true,
      voucherNumber,
    };
    
    saveTransactions([...transactions, expenseTransaction, incomeTransaction]);
    
    toast({title: "Transferencia registrada", description: "Se han creado los dos movimientos internos."});
    setTransferDialogOpen(false);
  };

  const openPrintPreview = (transaction) => {
    setTransactionToPrint(transaction);
    setPrintDialogOpen(true);
  };

  const handleExport = () => {
    if (filteredTransactions.length === 0) {
        toast({ variant: 'destructive', title: "No hay datos para exportar" });
        return;
    }
    const accountsMap = new Map((accounts || []).map(acc => [acc.name, acc.number]));
    const dataToExport = filteredTransactions.map(t => {
        const date = new Date(t.date);
        const typeLabel = t.isInternalTransfer ? 'Transferencia' : (t.type === 'income' ? 'Ingreso' : 'Egreso');
        let voucherPrefix = '';
        if (typeLabel === 'Ingreso') voucherPrefix = 'I';
        if (typeLabel === 'Egreso') voucherPrefix = 'E';
        if (typeLabel === 'Transferencia') voucherPrefix = 'T';

        return {
            'Comprobante': t.voucherNumber ? `${voucherPrefix}-${String(t.voucherNumber).padStart(4, '0')}` : 'N/A',
            'Fecha': isValid(date) ? format(date, 'dd/MM/yyyy') : 'Fecha inválida',
            'Descripción': t.description,
            'Tipo': typeLabel,
            'Número de Cuenta': accountsMap.get(t.category) || 'N/A',
            'Categoría': t.category,
            'Monto': t.type === 'income' ? parseFloat(t.amount) : -parseFloat(t.amount),
            'Origen/Destino': t.destination ? t.destination.split('|')[1] : 'N/A',
        }
    });
    const total = dataToExport.reduce((sum, t) => sum + t.Monto, 0);
    const footer = { 'Monto': total };
    exportToExcel(dataToExport, `Transacciones_${filterType}`, footer);
    toast({ title: "¡Exportado!", description: "Tus transacciones han sido exportadas a Excel." });
  };

  const handleImport = (importedTransactions) => {
    if (importedTransactions.length === 0) {
        toast({ variant: 'destructive', title: 'No hay transacciones para importar', description: 'El archivo no contenía transacciones del tipo seleccionado.' });
        return;
    }

    const newTransactions = [];
    const newTransfers = [];

    importedTransactions.forEach(t => {
        if (t.isInternalTransfer) {
            newTransfers.push(t);
        } else {
            newTransactions.push({
                ...t,
                id: Date.now().toString() + Math.random(),
                voucherNumber: getNextVoucherNumber(t.type),
            });
        }
    });

    // Process transfers in pairs
    const transferGroups = newTransfers.reduce((acc, t) => {
        const voucher = t.voucherNumber;
        if (!acc[voucher]) acc[voucher] = [];
        acc[voucher].push(t);
        return acc;
    }, {});

    Object.values(transferGroups).forEach(group => {
        if (group.length === 2) {
            const now = Date.now() + Math.random();
            const newVoucher = getNextVoucherNumber('transfer');
            const exp = group.find(t => t.type === 'expense');
            const inc = group.find(t => t.type === 'income');

            if (exp && inc) {
                newTransactions.push({ ...exp, id: `${now}-exp`, voucherNumber: newVoucher });
                newTransactions.push({ ...inc, id: `${now}-inc`, voucherNumber: newVoucher });
            }
        }
    });

    saveTransactions([...transactions, ...newTransactions]);
    toast({ title: "¡Importación exitosa!", description: `${newTransactions.length} movimientos han sido añadidos.` });
    setImportDialogOpen(false);
  };

  return (
    <>
      <Helmet>
        <title>Transacciones - JaiderHerTur26</title>
        <meta name="description" content="Gestiona todas tus transacciones de ingresos y gastos" />
      </Helmet>

      <div className="space-y-6">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div><h1 className="text-4xl font-bold text-slate-900 mb-2">Transacciones</h1></div>
          <div className="flex gap-2 flex-wrap">
            <Button onClick={handleNewTransfer} variant="outline" className="bg-white"><ArrowRightLeft className="w-4 h-4 mr-2" />Transferencia</Button>
            <Button onClick={() => setImportDialogOpen(true)} variant="outline" className="bg-white"><Upload className="w-4 h-4 mr-2" />Importar</Button>
            <Button onClick={handleExport} variant="outline" className="bg-white"><Download className="w-4 h-4 mr-2" />Exportar</Button>
            <Button onClick={handleNewTransaction} className="bg-blue-600 hover:bg-blue-700"><Plus className="w-4 h-4 mr-2" />Nueva Transacción</Button>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-white rounded-xl shadow-lg p-6 border border-slate-200">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
              <input type="text" placeholder="Buscar transacciones..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button variant={filterType === 'all' ? 'default' : 'outline'} onClick={() => setFilterType('all')} className={filterType === 'all' ? 'bg-blue-600 text-white' : ''}>Todas</Button>
              <Button variant={filterType === 'income' ? 'default' : 'outline'} onClick={() => setFilterType('income')} className={filterType === 'income' ? 'bg-green-600 text-white hover:bg-green-700' : ''}>Ingresos</Button>
              <Button variant={filterType === 'expense' ? 'default' : 'outline'} onClick={() => setFilterType('expense')} className={filterType === 'expense' ? 'bg-red-600 text-white hover:bg-red-700' : ''}>Gastos</Button>
              <Button variant={filterType === 'transfer' ? 'default' : 'outline'} onClick={() => setFilterType('transfer')} className={filterType === 'transfer' ? 'bg-purple-600 text-white hover:bg-purple-700' : ''}>Transferencias</Button>
            </div>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
          {filteredTransactions.length === 0 ? (
            <div className="p-12 text-center"><p className="text-slate-500 text-lg">No hay transacciones registradas</p><Button onClick={handleNewTransaction} className="mt-4 bg-blue-600 hover:bg-blue-700"><Plus className="w-4 h-4 mr-2" />Crear primera transacción</Button></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-slate-900">Comp.</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-slate-900">Fecha</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-slate-900">Descripción</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-slate-900">Categoría</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-slate-900">Origen/Destino</th>
                    <th className="px-6 py-4 text-right text-sm font-semibold text-slate-900">Monto</th>
                    <th className="px-6 py-4 text-center text-sm font-semibold text-slate-900">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredTransactions.map((transaction, index) => {
                    const date = new Date(transaction.date);
                    let voucherPrefix = '';
                    if (transaction.isInternalTransfer) voucherPrefix = 'T';
                    else if (transaction.type === 'income') voucherPrefix = 'I';
                    else if (transaction.type === 'expense') voucherPrefix = 'E';

                    return (
                    <motion.tr key={transaction.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.05 }} className={`hover:bg-slate-50 transition-colors ${transaction.isInternalTransfer ? 'bg-purple-50' : ''}`}>
                      <td className="px-6 py-4 text-sm text-slate-500 font-mono">{transaction.voucherNumber ? `${voucherPrefix}-${String(transaction.voucherNumber).padStart(4, '0')}`: 'N/A'}</td>
                      <td className="px-6 py-4 text-sm text-slate-600">{isValid(date) ? format(date, 'dd/MM/yyyy') : 'Fecha inválida'}</td>
                      <td className="px-6 py-4 text-sm font-medium text-slate-900">{transaction.description}</td>
                      <td className="px-6 py-4 text-sm text-slate-600"><span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${transaction.isInternalTransfer ? 'bg-purple-100 text-purple-800' : (transaction.type === 'income' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800')}`}>{transaction.category}</span></td>
                      <td className="px-6 py-4 text-sm text-slate-600">{transaction.destination ? transaction.destination.split('|')[1] : 'N/A'}</td>
                      <td className={`px-6 py-4 text-sm font-semibold text-right ${transaction.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>{transaction.type === 'income' ? '+' : '-'}${parseFloat(transaction.amount).toLocaleString('es-ES', { minimumFractionDigits: 2 })}</td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex justify-center gap-1">
                           <Button variant="ghost" size="icon" onClick={() => openPrintPreview(transaction)} className="hover:bg-green-50 hover:text-green-600" disabled={isPrinting}>
                            {isPrinting && transactionToPrint?.id === transaction.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
                           </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(transaction)} className="hover:bg-blue-50 hover:text-blue-600" disabled={transaction.isInternalTransfer}><Edit2 className="w-4 h-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(transaction.id)} className="hover:bg-red-50 hover:text-red-600"><Trash2 className="w-4 h-4" /></Button>
                        </div>
                      </td>
                    </motion.tr>
                  )})}
                </tbody>
              </table>
            </div>
          )}
        </motion.div>
      </div>
      <TransactionDialog open={dialogOpen} onOpenChange={setDialogOpen} transaction={editingTransaction} onSave={handleSaveTransaction} />
      <InternalTransferDialog open={transferDialogOpen} onOpenChange={setTransferDialogOpen} onSave={handleSaveTransfer} />
      <ImportDialog open={importDialogOpen} onOpenChange={setImportDialogOpen} onImport={handleImport} />

      <Dialog open={printDialogOpen} onOpenChange={setPrintDialogOpen}>
        <DialogContent className="max-w-6xl p-0">
          <div className="p-4 bg-slate-50 border-b flex justify-between items-center">
            <DialogHeader>
                <DialogTitle>Vista Previa del Comprobante</DialogTitle>
                <DialogDescription>Revisa el comprobante antes de generar el PDF.</DialogDescription>
            </DialogHeader>
            <Button onClick={handlePrintToPdf} disabled={isPrinting}>
              {isPrinting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generando...</> : <><Printer className="mr-2 h-4 w-4" /> Generar PDF</>}
            </Button>
          </div>
           <div className="p-6 bg-gray-400 overflow-auto" style={{maxHeight: '70vh'}}>
             <div ref={voucherRef} className="bg-white shadow-lg mx-auto" style={{width: '218.5mm', height: '149.7mm', transformOrigin: 'top left'}}>
                <Voucher transaction={transactionToPrint} />
             </div>
           </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

const ImportDialog = ({ open, onOpenChange, onImport }) => {
    const [file, setFile] = useState(null);
    const [importType, setImportType] = useState('all');
    const { toast } = useToast();
    const fileInputRef = useRef(null);

    const handleFileChange = (e) => {
        const selectedFile = e.target.files[0];
        if (selectedFile && (selectedFile.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || selectedFile.type === 'application/vnd.ms-excel')) {
            setFile(selectedFile);
        } else {
            toast({ variant: 'destructive', title: 'Archivo no válido', description: 'Por favor, selecciona un archivo Excel (.xlsx).' });
        }
    };

    const handleImportClick = () => {
        if (!file) {
            toast({ variant: 'destructive', title: 'No hay archivo', description: 'Por favor, selecciona un archivo para importar.' });
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array', cellDates: true });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

                if (json.length < 2) {
                    toast({ variant: 'destructive', title: 'Archivo vacío', description: 'El archivo no contiene datos para importar.' });
                    return;
                }

                const headers = json[0];
                const requiredHeaders = ['Comprobante', 'Fecha', 'Descripción', 'Tipo', 'Categoría', 'Monto', 'Origen/Destino'];
                
                if (!requiredHeaders.every(h => headers.includes(h))) {
                    toast({ variant: 'destructive', title: 'Formato incorrecto', description: `El archivo debe contener las columnas: ${requiredHeaders.join(', ')}.` });
                    return;
                }

                const dataRows = json.slice(1);

                let transactions = dataRows.map(rowArray => {
                    const row = {};
                    headers.forEach((header, index) => {
                        row[header] = rowArray[index];
                    });

                    const typeStr = (row['Tipo'] || '').toLowerCase();
                    let type, isInternalTransfer = false;

                    if (typeStr.includes('transferencia')) {
                        isInternalTransfer = true;
                        // For transfers, we need to know if it's the income or expense part
                        type = parseFloat(String(row['Monto'] || '0').replace(/[^0-9.-]+/g,"")) >= 0 ? 'income' : 'expense';
                    } else {
                        type = typeStr.includes('ingreso') ? 'income' : 'expense';
                    }
                    
                    return {
                        date: row['Fecha'],
                        description: row['Descripción'],
                        type: type,
                        category: row['Categoría'],
                        amount: Math.abs(parseFloat(String(row['Monto'] || '0').replace(/[^0-9.-]+/g,""))),
                        destination: row['Origen/Destino'],
                        isInternalTransfer,
                        voucherNumber: row['Comprobante'] ? String(row['Comprobante']).split('-')[1] : null,
                    };
                }).filter(t => t.date && t.description);

                if (importType !== 'all') {
                    if (importType === 'transfer') {
                        transactions = transactions.filter(t => t.isInternalTransfer);
                    } else {
                        transactions = transactions.filter(t => t.type === importType && !t.isInternalTransfer);
                    }
                }

                onImport(transactions);
                setFile(null);
                if(fileInputRef.current) fileInputRef.current.value = '';

            } catch (error) {
                console.error("Import error:", error);
                toast({ variant: 'destructive', title: 'Error al procesar', description: 'No se pudo leer el archivo Excel. Asegúrate de que el formato sea correcto.' });
            }
        };
        reader.readAsArrayBuffer(file);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Importar Transacciones desde Excel</DialogTitle>
                    <DialogDescription>
                        Selecciona un archivo .xlsx y elige el tipo de transacciones a importar.
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4 space-y-4">
                    <div>
                        <Label>1. Elige el tipo de transacción a importar</Label>
                        <div className="flex gap-2 flex-wrap mt-2">
                            <Button variant={importType === 'all' ? 'default' : 'outline'} onClick={() => setImportType('all')} className={importType === 'all' ? 'bg-blue-600 text-white' : ''}>Todas</Button>
                            <Button variant={importType === 'income' ? 'default' : 'outline'} onClick={() => setImportType('income')} className={importType === 'income' ? 'bg-green-600 text-white hover:bg-green-700' : ''}>Ingresos</Button>
                            <Button variant={importType === 'expense' ? 'default' : 'outline'} onClick={() => setImportType('expense')} className={importType === 'expense' ? 'bg-red-600 text-white hover:bg-red-700' : ''}>Gastos</Button>
                            <Button variant={importType === 'transfer' ? 'default' : 'outline'} onClick={() => setImportType('transfer')} className={importType === 'transfer' ? 'bg-purple-600 text-white hover:bg-purple-700' : ''}>Transferencias</Button>
                        </div>
                    </div>
                    <div>
                        <Label htmlFor="file-upload">2. Selecciona el archivo Excel</Label>
                        <input id="file-upload" ref={fileInputRef} type="file" accept=".xlsx, .xls" onChange={handleFileChange} className="mt-2 block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"/>
                    </div>
                </div>
                <div className="flex justify-end gap-2">
                    <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
                    <Button onClick={handleImportClick} disabled={!file}><Upload className="w-4 h-4 mr-2" /> Importar</Button>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default Transactions;
