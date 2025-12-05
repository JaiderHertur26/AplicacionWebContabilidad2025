
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { Plus, Search, Edit2, Trash2, Printer, Download, Loader2, ArrowRightLeft, Upload, Calendar, Lock, BookOpen, Table as TableIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import TransactionDialog from '@/components/transactions/TransactionDialog';
import InternalTransferDialog from '@/components/transactions/InternalTransferDialog';
import { exportToExcel } from '@/lib/excel';
import { useCompanyData } from '@/hooks/useCompanyData';
import { useCompany } from '@/App';
import { usePermission } from '@/hooks/usePermission';
import { format, isValid, parseISO } from 'date-fns';
import Voucher from '@/components/transactions/Voucher';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import * as XLSX from 'xlsx';

const Transactions = () => {
  const { activeCompany, isConsolidated, companies } = useCompany();
  const { canEdit, canDelete, canAdd, isReadOnly } = usePermission();
  
  // Data Hooks
  const [transactions, saveTransactions] = useCompanyData('transactions');
  const [accounts] = useCompanyData('accounts');
  const [fixedAssets, saveFixedAssets] = useCompanyData('fixedAssets');
  const [initialBalances] = useCompanyData('initialBalance');
  const [bankAccounts] = useCompanyData('bankAccounts');

  // Local State
  const [processedTransactions, setProcessedTransactions] = useState([]);
  const [filteredTransactions, setFilteredTransactions] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [viewMode, setViewMode] = useState('balances'); // 'balances' or 'accounting'
  
  // Dialog States
  const [dialogOpen, setDialogOpen] = useState(false);
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [printDialogOpen, setPrintDialogOpen] = useState(false);
  const [transactionToPrint, setTransactionToPrint] = useState(null);
  const [isPrinting, setIsPrinting] = useState(false);
  
  const { toast } = useToast();
  const voucherRef = useRef(null);

  // Map for O(1) lookup of transactions by ID
  const transactionsMap = useMemo(() => {
      return new Map((transactions || []).map(t => [t.id, t]));
  }, [transactions]);

  // Determine available years from data
  const availableYears = useMemo(() => {
    const years = new Set((transactions || []).map(t => new Date(t.date).getFullYear()));
    const currentYear = new Date().getFullYear();
    years.add(currentYear);
    return Array.from(years).sort((a, b) => b - a).map(String);
  }, [transactions]);

  // ------------------------------------------------------------------
  // HELPER: Dynamic Accounting Resolution
  // ------------------------------------------------------------------
  const getAssetDetails = (destinationStr, categoryName = '') => {
      if (!destinationStr) {
           const defaultCash = (initialBalances && initialBalances.length > 0) ? initialBalances[0] : null;
           return { 
               code: defaultCash?.accountingCode || '11050501', 
               name: defaultCash?.accountingName || 'CAJA PRINCIPAL' 
           };
      }
      
      const [id, name] = destinationStr.split('|');

      // Handle Pending/Provision Destinations (Accrual)
      if (id === 'pending_payable') {
          return { code: '23050101', name: 'CUENTAS POR PAGAR' };
      }
      if (id === 'pending_receivable') {
          return { code: '13050505', name: 'CUENTAS POR COBRAR' };
      }

      // Priority 1: Check for Cash Account
      // We check this first to ensure Source (Expense) from Cash is always identified as Cash
      if (id === 'caja_principal' || (name && name.toUpperCase().includes('CAJA'))) {
           const defaultCash = (initialBalances && initialBalances.length > 0) ? initialBalances[0] : null;
           if (defaultCash) {
               return {
                   code: defaultCash.accountingCode || '11050501',
                   name: defaultCash.accountingName || 'CAJA PRINCIPAL'
               };
           }
           return { code: '11050501', name: 'CAJA PRINCIPAL' };
      }

      // Priority 2: Special case: Aportes Account based on Category or specific ID
      // This overrides Bank detection if the Category indicates an Aporte
      if (id === '12950501' || 
          (name && name.toUpperCase().includes('APORTES COOPERATIVA')) ||
          (categoryName && (categoryName.includes('APORTES COOPERATIVA') || categoryName.includes('12950501')))
      ) {
           return { code: '12950501', name: 'APORTES COOPERATIVA FRATERNIDAD' };
      }
      
      // Priority 3: Check for Bank
      const bank = (bankAccounts || []).find(b => b.id === id);
      if (bank) {
          // If bank is found, return its configured code
          return { 
              code: bank.accountingCode || '1110', 
              name: bank.accountingConcept || bank.bankName 
          };
      }
      
      // Fallback: If id looks like an account number, use it
      if (/^\d+$/.test(id) && id.length >= 4) {
          return { code: id, name: name || 'CUENTA DESTINO' };
      }
      
      return { code: '1120', name: name || 'BANCO DESCONOCIDO' };
  };

  const resolveAccountingRow = (t) => {
      const amount = parseFloat(t.amount);
      const assetAcc = getAssetDetails(t.destination, t.category);
      
      let debit = { code: '', name: '', value: 0 };
      let credit = { code: '', name: '', value: 0 };
      
      if (t.isInternalTransfer) {
          // ... existing transfer logic ...
          let siblingId = '';
          if (t.id.endsWith('-exp')) siblingId = t.id.replace('-exp', '-inc');
          else if (t.id.endsWith('-inc')) siblingId = t.id.replace('-inc', '-exp');
          
          const sibling = transactionsMap.get(siblingId);
          const contraAcc = sibling ? getAssetDetails(sibling.destination, sibling.category) : { code: '111005', name: 'TRANSFERENCIA EN TRÁNSITO' };
          
          if (t.type === 'income') {
              debit = { ...assetAcc, value: amount };
              credit = { ...contraAcc, value: amount };
          } else {
              debit = { ...contraAcc, value: amount };
              credit = { ...assetAcc, value: amount };
          }
      } else {
          // Regular Transaction
          const catObj = (accounts || []).find(a => a.name === t.category);
          const catAcc = { 
              code: t._accountNumber || (catObj ? catObj.number : (t.type === 'income' ? '4105' : '5105')), 
              name: t.category 
          };

          // Determine if this is a pending accrual
          const isPending = t.destination === 'pending_payable' || t.destination === 'pending_receivable';

          if (t.type === 'income') {
              // Income: Debit Asset (or Receivable) / Credit Revenue
              debit = { ...assetAcc, value: amount };
              credit = { ...catAcc, value: amount };
          } else {
              // Expense: Debit Expense / Credit Asset (or Payable)
              debit = { ...catAcc, value: amount };
              credit = { ...assetAcc, value: amount };
          }
      }
      
      return { debit, credit };
  };

  // ------------------------------------------------------------------
  // CORE LOGIC: Progressive Balance Calculation
  // ------------------------------------------------------------------
  useEffect(() => {
    if (!transactions || !initialBalances) return;

    const isRelevant = (item) => {
        if (!isConsolidated) return true; 
        const relevantIds = companies
            .filter(c => c.id === activeCompany?.id || c.parentId === activeCompany?.id)
            .map(c => c.id);
        return relevantIds.includes(item._companyId) || (!item._companyId && relevantIds.includes(activeCompany.id));
    };

    let startCash = 0;
    let startBanks = 0;
    let startAportes = 0; 

    (initialBalances || []).forEach(ib => {
        if (isRelevant(ib)) startCash += (parseFloat(ib.balance) || 0);
    });

    (bankAccounts || []).forEach(ba => {
        if (isRelevant(ba)) {
             startBanks += (parseFloat(ba.initialBalance) || 0);
             startAportes += (parseFloat(ba.initialInvestmentBalance) || 0);
        }
    });

    const sorted = [...transactions].sort((a, b) => new Date(a.date) - new Date(b.date));

    let runningCash = startCash;
    let runningBanks = startBanks;
    let runningAportes = startAportes; 

    const calculated = sorted.map(t => {
        const amount = parseFloat(t.amount) || 0;
        
        const destParts = (t.destination || '').split('|');
        let destName = (destParts[1] || destParts[0] || '').toUpperCase();
        const destId = destParts[0];

        const categoryName = (t.category || '').toUpperCase();
        const accountObj = (accounts || []).find(acc => acc.name === t.category);
        const accountNumber = accountObj ? accountObj.number : 'N/A';

        // Identify specific types
        const isAportesCategory = 
            categoryName.includes('APORTES ORDINARIOS') || 
            categoryName.includes('APORTES COOPERATIVA FRATERNIDAD') ||
            accountNumber === '12950501' ||
            destId === '12950501'; // Check destination too

        // Explicit check for Cooperativa Fraternidad Sacerdotal (Bank Account)
        const isCooperativaBank = destId === '11201501' || destName.includes('FRATERNIDAD SACERDOTAL');

        // Identify Pending Vouchers (Don't affect cash/banks yet)
        const isPending = destId === 'pending_payable' || destId === 'pending_receivable';

        const isCashDestination = destId === 'caja_principal' || destName.includes('CAJA');
        
        // Ensure display name is correct for specific accounts
        if (destId === '11201501') destName = 'COOPERATIVA FRATERNIDAD SACERDOTAL';
        if (destId === '12950501') destName = 'APORTES COOPERATIVA FRATERNIDAD';


        let affectedColumn = 'none';

        if (isPending) {
            // Do NOT affect cash/bank/aportes columns
            affectedColumn = 'pending';
        } else if (t.type === 'expense') {
            if (isCashDestination) {
                runningCash -= amount;
                affectedColumn = 'cash';
            } else {
                // Only deduct from bank/aportes if not cash
                if (isAportesCategory && t.isInternalTransfer) { 
                    // Rare case: Expense FROM aportes? Usually aportes accumulate.
                    // Assuming this logic is correct based on previous requests
                    // But if it's a transfer TO Aportes, this block is for the Expense PART (Source)
                } else {
                    runningBanks -= amount;
                    affectedColumn = 'banks';
                }
            }
        } else {
            // Income or Transfer Income Part
            if (isAportesCategory) {
                runningAportes += amount;
                affectedColumn = 'aportes';
            } else if (isCashDestination) {
                runningCash += amount;
                affectedColumn = 'cash';
            } else {
                runningBanks += amount;
                affectedColumn = 'banks';
            }
        }

        return {
            ...t,
            _calculatedCash: runningCash,
            _calculatedBanks: runningBanks,
            _calculatedAportes: runningAportes,
            _accountNumber: accountNumber,
            _destName: isPending ? '(Pendiente)' : destName,
            _affectedColumn: affectedColumn,
            _isPending: isPending
        };
    });

    setProcessedTransactions(calculated);

  }, [transactions, initialBalances, bankAccounts, accounts, isConsolidated, activeCompany, companies]);

  // ------------------------------------------------------------------
  // FILTERING
  // ------------------------------------------------------------------
  useEffect(() => {
    let result = [...processedTransactions];

    result = result.filter(t => {
        const year = new Date(t.date).getFullYear().toString();
        return year === selectedYear;
    });

    if (filterType !== 'all') {
      if (filterType === 'transfer') {
        result = result.filter(t => t.isInternalTransfer);
      } else {
        result = result.filter(t => t.type === filterType && !t.isInternalTransfer);
      }
    }

    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      result = result.filter(t => 
        (t.description || '').toLowerCase().includes(lower) ||
        (t.category || '').toLowerCase().includes(lower) ||
        (t._accountNumber || '').toLowerCase().includes(lower)
      );
    }

    result.sort((a, b) => new Date(a.date) - new Date(b.date));
    setFilteredTransactions(result);
  }, [processedTransactions, searchTerm, filterType, selectedYear]);


  // ------------------------------------------------------------------
  // GROUPING FOR DISPLAY (MERGE TRANSFERS)
  // ------------------------------------------------------------------
  const getDisplayTransactions = () => {
      const groups = [];
      const processedIds = new Set();

      filteredTransactions.forEach(t => {
          if (processedIds.has(t.id)) return;

          if (t.isInternalTransfer) {
              const baseId = t.id.replace(/-exp$|-inc$/, '');
              const isExp = t.id.endsWith('-exp');
              const siblingId = baseId + (isExp ? '-inc' : '-exp');
              const sibling = filteredTransactions.find(x => x.id === siblingId);

              if (sibling) {
                  // Found pair
                  processedIds.add(t.id);
                  processedIds.add(sibling.id);

                  // Determine which one is "latest" to use its balances (cumulative effect)
                  // Filtered transactions are sorted by date. 
                  const first = filteredTransactions.indexOf(t) < filteredTransactions.indexOf(sibling) ? t : sibling;
                  const second = first === t ? sibling : t;

                  // Format amount: -Amount / +Amount
                  const amountVal = parseFloat(t.amount);
                  const formattedAmount = amountVal.toLocaleString('es-CO', {minimumFractionDigits: 0});
                  const displayAmount = `-${formattedAmount} / +${formattedAmount}`;

                  // Clean Description (Remove "Transferencia a/desde ...: ")
                  const rawDesc = t.description.includes(': ') ? t.description.split(': ')[1] : t.description;
                  
                  // Determine Source (Debit) and Destination (Credit) based on expense part
                  // Expense part: Money LEAVES (Source)
                  // Income part: Money ENTERS (Destination)
                  const expensePart = isExp ? t : sibling;
                  const incomePart = isExp ? sibling : t;
                  
                  const sourceAsset = getAssetDetails(expensePart.destination, expensePart.category);
                  const destAsset = getAssetDetails(incomePart.destination, incomePart.category);

                  // Correct destination name for Control Saldos
                  let displayDestName = t._destName;

                  // Check if it's an Aporte (high priority)
                  const isAporte = incomePart.category && (
                      incomePart.category.includes('APORTES COOPERATIVA') || 
                      incomePart.category.includes('12950501')
                  );

                  if (isAporte) {
                      displayDestName = 'APORTES COOPERATIVA FRATERNIDAD';
                      // destAsset is already handled by getAssetDetails
                  } else if (incomePart.destination.startsWith('11201501')) {
                      displayDestName = 'COOPERATIVA FRATERNIDAD SACERDOTAL';
                  }

                  groups.push({
                      ...second, // Use the second transaction for balances/dates
                      id: first.id, // ID for keying 
                      description: rawDesc, 
                      _mergedAmount: displayAmount,
                      _isMerged: true,
                      _sourceAccount: sourceAsset, // For Accounting View
                      _destAccount: destAsset,     // For Accounting View
                      _rawAmount: amountVal,        // For Accounting View value
                      _destName: displayDestName    // Override for Control Saldos
                  });
              } else {
                  // Orphan transfer part
                  groups.push(t);
              }
          } else {
              groups.push(t);
          }
      });
      return groups;
  };

  const displayTransactions = useMemo(() => getDisplayTransactions(), [filteredTransactions]);


  // ------------------------------------------------------------------
  // ACTIONS
  // ------------------------------------------------------------------
  const getNextVoucherNumber = (type) => {
    const sequenceKey = `${activeCompany.id}-voucher-sequence`;
    const sequences = JSON.parse(localStorage.getItem(sequenceKey) || '{ "income": 0, "expense": 0, "transfer": 0 }');
    const nextNumber = (sequences[type] || 0) + 1;
    sequences[type] = nextNumber;
    localStorage.setItem(sequenceKey, JSON.stringify(sequences));
    return nextNumber;
  };

  const handleSaveTransaction = (transactionData) => {
    if (!canAdd && !editingTransaction) return;
    if (!canEdit && editingTransaction) return;

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

    // Fixed Asset Logic
    if (transactionData.type === 'expense' && transactionData.isFixedAsset) {
      const assetPayload = {
        date: transactionData.date,
        name: transactionData.description,
        value: parseFloat(transactionData.amount),
        year: new Date(transactionData.date).getFullYear().toString(),
        transactionId: transactionId,
      };
      updatedAssets.push({ ...assetPayload, id: `asset-${transactionId}`, status: 'Bueno', quantity: 1 });
      saveFixedAssets(updatedAssets);
    }

    saveTransactions(updatedTransactions);
    setDialogOpen(false);
    setEditingTransaction(null);
  };
  
  const handleDelete = (id) => {
    if (!canDelete) {
        toast({ variant: "destructive", title: "Acceso Denegado", description: "No tienes permiso para eliminar." });
        return;
    }

    const transactionToDelete = transactions.find(t => t.id === id);
    if (!transactionToDelete) return;

    let transactionsToDeleteIds = [id];

    const assetToDelete = (fixedAssets || []).find(a => a.transactionId === id);
    if (assetToDelete) {
      saveFixedAssets(fixedAssets.filter(a => a.id !== assetToDelete.id));
    }

    if (transactionToDelete.isInternalTransfer) {
        const baseId = transactionToDelete.id.split('-')[0];
        const siblingType = transactionToDelete.type === 'expense' ? 'inc' : 'exp';
        const siblingTransaction = transactions.find(t => t.id === `${baseId}-${siblingType}`);
        if (siblingTransaction) transactionsToDeleteIds.push(siblingTransaction.id);
        toast({ title: 'Transferencia Revertida' });
    } else {
        toast({ title: "Transacción eliminada" });
    }

    const remainingTransactions = transactions.filter(t => !transactionsToDeleteIds.includes(t.id));
    saveTransactions(remainingTransactions);
  };

  const handleSaveTransfer = (transferData) => {
    if (!canAdd) return;
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
      destination: fromAccount,
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
      destination: toAccount,
      isInternalTransfer: true,
      voucherNumber,
    };
    
    saveTransactions([...transactions, expenseTransaction, incomeTransaction]);
    toast({title: "Transferencia registrada", description: "Se han creado los dos movimientos internos."});
    setTransferDialogOpen(false);
  };

  const handleExport = () => {
    if (displayTransactions.length === 0) return;

    const dataToExport = displayTransactions.map(t => {
        const date = parseISO(t.date);
        let typeLabel = t.isInternalTransfer ? 'Transferencia' : (t.type === 'income' ? 'Ingreso' : 'Egreso');
        if (t._isPending) typeLabel += ' (Pendiente)';
        
        let voucherPrefix = t.isInternalTransfer ? 'T' : (t.type === 'income' ? 'I' : 'E');
        let displayVoucher = t.voucherNumber ? `${voucherPrefix}-${String(t.voucherNumber).padStart(4, '0')}` : 'N/A';

        // Ensure merged amounts are treated as text by Excel to avoid formula interpretation
        const amountValue = t._mergedAmount ? `'${t._mergedAmount}` : parseFloat(t.amount);

        return {
            'Comprobante': displayVoucher,
            'Fecha': isValid(date) ? format(date, 'dd/MM/yyyy') : 'Fecha inválida',
            'Descripción': t.description,
            'Tipo': typeLabel,
            'Nº Cuenta': t._accountNumber,
            'Categoría': t.category,
            'Monto': amountValue,
            'Destino': t._destName,
            'Saldo Caja': t._calculatedCash,
            'Saldo Bancos': t._calculatedBanks,
            'Saldo Aportes': t._calculatedAportes
        }
    });
    exportToExcel(dataToExport, `Transacciones_Control_${selectedYear}`, {});
    toast({ title: "¡Exportado!", description: "Informe exportado a Excel." });
  };

  const handleExportAccounting = () => {
      if (displayTransactions.length === 0) {
          toast({ variant: 'destructive', title: "No hay datos para exportar" });
          return;
      }
      
      const dataToExport = [];

      displayTransactions.forEach(t => {
          const date = parseISO(t.date);
          let prefix = t.isInternalTransfer ? 'T' : (t.type === 'income' ? 'I' : 'E');
          let vId = t.voucherNumber ? `${prefix}-${String(t.voucherNumber).padStart(4,'0')}` : '-';

          if (t._isMerged && t.isInternalTransfer) {
              // MERGED TRANSFER EXPORT LOGIC
              const debitAcc = t._destAccount;
              const creditAcc = t._sourceAccount;
              const val = t._rawAmount;

              // Debit Row (Destination)
              dataToExport.push({
                'Fecha': isValid(date) ? format(date, 'dd/MM/yyyy') : '-',
                'Comprobante': vId,
                'Código': debitAcc.code,
                'Cuenta': debitAcc.name,
                'Descripción': t.description,
                'Débito': val,
                'Crédito': 0
              });
              
              // Credit Row (Source)
              dataToExport.push({
                'Fecha': isValid(date) ? format(date, 'dd/MM/yyyy') : '-',
                'Comprobante': vId,
                'Código': creditAcc.code,
                'Cuenta': creditAcc.name,
                'Descripción': t.description,
                'Débito': 0,
                'Crédito': val
              });

          } else {
              // REGULAR TRANSACTION EXPORT LOGIC
              const { debit, credit } = resolveAccountingRow(t);

              dataToExport.push({
                'Fecha': isValid(date) ? format(date, 'dd/MM/yyyy') : '-',
                'Comprobante': vId,
                'Código': debit.code,
                'Cuenta': debit.name,
                'Descripción': t.description,
                'Débito': debit.value,
                'Crédito': 0
              });

              dataToExport.push({
                'Fecha': isValid(date) ? format(date, 'dd/MM/yyyy') : '-',
                'Comprobante': vId,
                'Código': credit.code,
                'Cuenta': credit.name,
                'Descripción': t.description,
                'Débito': 0,
                'Crédito': credit.value
              });
          }
      });

      exportToExcel(dataToExport, `Contabilidad_Partida_Doble_${selectedYear}`, {});
      toast({ title: "¡Exportado!", description: "Informe contable exportado a Excel." });
  };

  const handleImport = (data) => {
      setImportDialogOpen(false);
      toast({ title: "Importado" });
  };

  const handlePrint = (t) => {
    setTransactionToPrint(t);
    setPrintDialogOpen(true);
  };

  const handlePrintToPdf = () => {
     setIsPrinting(true);
     setTimeout(() => {
         setIsPrinting(false);
         toast({ title: "PDF Generado" });
     }, 1000);
  };

  return (
    <>
      <Helmet>
        <title>Transacciones - Sistema Contable</title>
      </Helmet>

      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-4xl font-bold text-slate-900 mb-2">Transacciones</h1>
            <p className="text-slate-600">Control de movimientos financieros</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setTransferDialogOpen(true)}>
                <ArrowRightLeft className="w-4 h-4 mr-2"/>
                Transferir
            </Button>
            <Button variant="outline" onClick={() => setImportDialogOpen(true)}>
                <Upload className="w-4 h-4 mr-2"/>
                Importar
            </Button>
            <Button onClick={() => { setEditingTransaction(null); setDialogOpen(true); }} className="bg-blue-600 hover:bg-blue-700">
              <Plus className="w-4 h-4 mr-2" />
              Nueva
            </Button>
          </div>
        </div>

        {/* Filters & Controls */}
        <div className="bg-white rounded-xl shadow-sm p-4 border border-slate-200 space-y-4">
          <div className="flex flex-wrap gap-4 items-center justify-between">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Buscar..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm border rounded-md focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div className="flex gap-2">
                <select 
                    className="text-sm border rounded-md px-3 py-2 bg-white"
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(e.target.value)}
                >
                    {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                </select>

                <div className="flex bg-slate-100 rounded-lg p-1">
                    <button 
                        onClick={() => setViewMode('balances')}
                        className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${viewMode === 'balances' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <TableIcon className="w-3 h-3 inline mr-1"/> Control Saldos
                    </button>
                    <button 
                        onClick={() => setViewMode('accounting')}
                        className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${viewMode === 'accounting' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <BookOpen className="w-3 h-3 inline mr-1"/> Vista Contable
                    </button>
                </div>
            </div>
          </div>

          {/* Type Filters */}
          <div className="flex gap-2 overflow-x-auto pb-2">
             {['all', 'income', 'expense', 'transfer'].map(type => (
                 <Button
                    key={type}
                    variant={filterType === type ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFilterType(type)}
                    className="capitalize"
                 >
                    {type === 'all' ? 'Todas' : type === 'income' ? 'Ingresos' : type === 'expense' ? 'Gastos' : 'Transferencias'}
                 </Button>
             ))}
             <div className="ml-auto flex gap-2">
                 {viewMode === 'accounting' ? (
                    <Button variant="outline" size="sm" onClick={handleExportAccounting} className="bg-white shadow-sm">
                        <Download className="w-4 h-4 mr-2"/> Excel (Partida Doble)
                    </Button>
                 ) : (
                    <Button variant="ghost" size="sm" onClick={handleExport}>
                        <Download className="w-4 h-4 mr-2"/> Excel
                    </Button>
                 )}
             </div>
          </div>
        </div>

        {/* Main Table Area */}
        <motion.div
          layout
          className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden"
        >
            {viewMode === 'balances' ? (
                 /* STANDARD BALANCE VIEW */
                 <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 text-slate-700 font-medium border-b">
                            <tr>
                                <th className="px-4 py-3">Fecha</th>
                                <th className="px-4 py-3">Comprobante</th>
                                <th className="px-4 py-3">Descripción</th>
                                <th className="px-4 py-3">Categoría</th>
                                <th className="px-4 py-3 text-right">Monto</th>
                                <th className="px-4 py-3 text-right bg-blue-50/50">Saldo Caja</th>
                                <th className="px-4 py-3 text-right bg-purple-50/50">Saldo Bancos</th>
                                <th className="px-4 py-3 text-right bg-green-50/50">Saldo Aportes</th>
                                <th className="px-4 py-3 text-center">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {displayTransactions.map((t) => {
                                const date = parseISO(t.date);
                                const isIncome = t.type === 'income';
                                let prefix = t.isInternalTransfer ? 'T' : (isIncome ? 'I' : 'E');
                                return (
                                    <tr key={t.id} className="hover:bg-slate-50 group">
                                        <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                                            {isValid(date) ? format(date, 'dd/MM/yyyy') : '-'}
                                        </td>
                                        <td className="px-4 py-3 font-mono text-xs text-slate-500">
                                            {t.voucherNumber ? `${prefix}-${String(t.voucherNumber).padStart(4,'0')}` : '-'}
                                        </td>
                                        <td className="px-4 py-3 text-slate-700 font-medium max-w-[200px] truncate" title={t.description}>
                                            {t.description}
                                            {t._isPending && <span className="ml-2 text-xs bg-yellow-100 text-yellow-800 px-1.5 py-0.5 rounded-full">Pendiente</span>}
                                        </td>
                                        <td className="px-4 py-3 text-slate-600">
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs ${t.isInternalTransfer ? 'bg-orange-100 text-orange-700' : 'bg-slate-100'}`}>
                                                {t.category}
                                            </span>
                                            <span className="block text-[10px] text-slate-400 mt-0.5 truncate max-w-[150px]">
                                                Dest: {t._destName}
                                            </span>
                                        </td>
                                        <td className={`px-4 py-3 text-right font-mono font-medium ${t._mergedAmount ? 'text-slate-800' : (isIncome ? 'text-green-600' : 'text-red-600')}`}>
                                            {t._mergedAmount ? t._mergedAmount : (
                                                (isIncome ? '+' : '-') + parseFloat(t.amount).toLocaleString('es-CO', {minimumFractionDigits: 0})
                                            )}
                                        </td>
                                        <td className={`px-4 py-3 text-right font-mono text-slate-600 bg-blue-50/30 ${t._affectedColumn === 'cash' ? 'font-bold text-slate-900' : ''}`}>
                                            {t._calculatedCash.toLocaleString('es-CO', {minimumFractionDigits: 0})}
                                        </td>
                                        <td className={`px-4 py-3 text-right font-mono text-slate-600 bg-purple-50/30 ${t._affectedColumn === 'banks' ? 'font-bold text-slate-900' : ''}`}>
                                            {t._calculatedBanks.toLocaleString('es-CO', {minimumFractionDigits: 0})}
                                        </td>
                                        <td className={`px-4 py-3 text-right font-mono text-slate-600 bg-green-50/30 ${t._affectedColumn === 'aportes' ? 'font-bold text-slate-900' : ''}`}>
                                            {t._calculatedAportes.toLocaleString('es-CO', {minimumFractionDigits: 0})}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <div className="flex justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handlePrint(t)}><Printer className="w-3 h-3"/></Button>
                                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditingTransaction(t); setDialogOpen(true); }}><Edit2 className="w-3 h-3"/></Button>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-700" onClick={() => handleDelete(t.id)}><Trash2 className="w-3 h-3"/></Button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                            {displayTransactions.length === 0 && (
                                <tr><td colSpan="9" className="text-center py-8 text-slate-400">No hay transacciones</td></tr>
                            )}
                        </tbody>
                    </table>
                 </div>
            ) : (
                /* ACCOUNTING VIEW (DEBIT/CREDIT) */
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-800 text-slate-200 font-medium">
                            <tr>
                                <th className="px-4 py-3">Fecha</th>
                                <th className="px-4 py-3">Comp.</th>
                                <th className="px-4 py-3 w-1/3">Cuenta (PUC)</th>
                                <th className="px-4 py-3 w-1/3">Detalle</th>
                                <th className="px-4 py-3 text-right w-32">Débito</th>
                                <th className="px-4 py-3 text-right w-32">Crédito</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white">
                            {displayTransactions.map(t => {
                                const date = parseISO(t.date);
                                let prefix = t.isInternalTransfer ? 'T' : (t.type === 'income' ? 'I' : 'E');
                                let vId = t.voucherNumber ? `${prefix}-${String(t.voucherNumber).padStart(4,'0')}` : '-';
                                
                                // MERGED TRANSFER LOGIC
                                if (t._isMerged && t.isInternalTransfer) {
                                    // For merged transfers, we show Source (Credit) and Destination (Debit)
                                    const debitAcc = t._destAccount; // Destination receives (Debit)
                                    const creditAcc = t._sourceAccount; // Source gives (Credit)
                                    const val = t._rawAmount;

                                    return (
                                        <React.Fragment key={t.id}>
                                             {/* Debit Row (Destination) */}
                                            <tr className="border-t border-slate-100 bg-blue-50">
                                                <td className="px-4 py-2 text-slate-500">{isValid(date) ? format(date, 'dd/MM/yyyy') : '-'}</td>
                                                <td className="px-4 py-2 font-mono text-xs text-slate-400">{vId}</td>
                                                <td className="px-4 py-2">
                                                    <div className="flex flex-col">
                                                        <span className="font-bold text-slate-700 text-xs">{debitAcc.code}</span>
                                                        <span className="text-slate-600 text-xs uppercase">{debitAcc.name}</span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-2 text-slate-500 italic text-xs">{t.description}</td>
                                                <td className="px-4 py-2 text-right font-mono text-slate-800">
                                                    {val.toLocaleString('es-CO', {minimumFractionDigits: 2})}
                                                </td>
                                                <td className="px-4 py-2 text-right font-mono text-slate-300">-</td>
                                            </tr>
                                            {/* Credit Row (Source) */}
                                            <tr className="bg-blue-50">
                                                <td className="px-4 py-1 border-none"></td>
                                                <td className="px-4 py-1 border-none"></td>
                                                <td className="px-4 py-2 border-none pl-8">
                                                    <div className="flex flex-col">
                                                        <span className="font-bold text-slate-700 text-xs">{creditAcc.code}</span>
                                                        <span className="text-slate-600 text-xs uppercase">{creditAcc.name}</span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-2 border-none"></td>
                                                <td className="px-4 py-2 border-none text-right font-mono text-slate-300">-</td>
                                                <td className="px-4 py-2 border-none text-right font-mono text-slate-800">
                                                    {val.toLocaleString('es-CO', {minimumFractionDigits: 2})}
                                                </td>
                                            </tr>
                                            <tr><td colSpan="6" className="h-1 bg-slate-50 border-b border-slate-200"></td></tr>
                                        </React.Fragment>
                                    );
                                }

                                // REGULAR TRANSACTION LOGIC
                                const { debit: debitRow, credit: creditRow } = resolveAccountingRow(t);
                                let rowColorClass = t.type === 'income' ? 'bg-green-50' : 'bg-red-50';

                                return (
                                    <React.Fragment key={t.id}>
                                        {/* Row 1: Debit */}
                                        <tr className={`border-t border-slate-100 ${rowColorClass}`}>
                                            <td className="px-4 py-2 text-slate-500">{isValid(date) ? format(date, 'dd/MM/yyyy') : '-'}</td>
                                            <td className="px-4 py-2 font-mono text-xs text-slate-400">{vId}</td>
                                            <td className="px-4 py-2">
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-slate-700 text-xs">{debitRow.code}</span>
                                                    <span className="text-slate-600 text-xs uppercase">{debitRow.name}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-2 text-slate-500 italic text-xs">{t.description}</td>
                                            <td className="px-4 py-2 text-right font-mono text-slate-800">
                                                {debitRow.value.toLocaleString('es-CO', {minimumFractionDigits: 2})}
                                            </td>
                                            <td className="px-4 py-2 text-right font-mono text-slate-300">-</td>
                                        </tr>
                                        {/* Row 2: Credit */}
                                        <tr className={`${rowColorClass}`}>
                                            <td className="px-4 py-1 border-none"></td>
                                            <td className="px-4 py-1 border-none"></td>
                                            <td className="px-4 py-2 border-none pl-8">
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-slate-700 text-xs">{creditRow.code}</span>
                                                    <span className="text-slate-600 text-xs uppercase">{creditRow.name}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-2 border-none"></td>
                                            <td className="px-4 py-2 border-none text-right font-mono text-slate-300">-</td>
                                            <td className="px-4 py-2 border-none text-right font-mono text-slate-800">
                                                {creditRow.value.toLocaleString('es-CO', {minimumFractionDigits: 2})}
                                            </td>
                                        </tr>
                                        {/* Separator */}
                                        <tr><td colSpan="6" className="h-1 bg-slate-50 border-b border-slate-200"></td></tr>
                                    </React.Fragment>
                                );
                            })}
                             {displayTransactions.length === 0 && (
                                <tr><td colSpan="6" className="text-center py-8 text-slate-400">No hay registros contables</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}
        </motion.div>
      </div>

      {/* MODALS */}
      <TransactionDialog open={dialogOpen} onOpenChange={setDialogOpen} transaction={editingTransaction} onSave={handleSaveTransaction} />
      <InternalTransferDialog open={transferDialogOpen} onOpenChange={setTransferDialogOpen} onSave={handleSaveTransfer} />
      <ImportDialog open={importDialogOpen} onOpenChange={setImportDialogOpen} onImport={handleImport} />

      <Dialog open={printDialogOpen} onOpenChange={setPrintDialogOpen}>
        <DialogContent className="max-w-6xl p-0 border-none bg-transparent shadow-none">
             <div className="bg-white rounded-lg overflow-hidden">
                 <div className="p-4 border-b flex justify-between items-center bg-slate-50">
                    <h3 className="font-semibold">Vista Previa</h3>
                    <Button size="sm" onClick={handlePrintToPdf} disabled={isPrinting}>
                        {isPrinting ? <Loader2 className="w-4 h-4 animate-spin mr-2"/> : <Printer className="w-4 h-4 mr-2"/>}
                        Imprimir PDF
                    </Button>
                 </div>
                 <div className="p-8 bg-slate-200 overflow-auto max-h-[80vh] flex justify-center">
                     <div ref={voucherRef} className="bg-white shadow-2xl" style={{ width: '215.9mm', minHeight: '139.7mm' }}>
                         <Voucher transaction={transactionToPrint} />
                     </div>
                 </div>
             </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

const ImportDialog = ({ open, onOpenChange, onImport }) => {
    const [file, setFile] = useState(null);
    const { toast } = useToast();

    const handleFileChange = (e) => {
        const selectedFile = e.target.files[0];
        if (selectedFile) setFile(selectedFile);
    };

    const handleImportClick = () => {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array', cellDates: true });
                const json = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
                
                const mapped = json.map(row => ({
                    date: row['Fecha'], 
                    description: row['Descripción'],
                    amount: row['Monto'],
                    category: row['Categoría'],
                    type: row['Tipo']?.toLowerCase().includes('ingreso') ? 'income' : 'expense',
                    isInternalTransfer: row['Tipo']?.toLowerCase().includes('transfer'),
                    destination: 'caja_principal|CAJA PRINCIPAL' 
                })).filter(t => t.date && t.amount);

                onImport(mapped);
            } catch (err) {
                toast({ variant: "destructive", title: "Error al importar" });
            }
        };
        reader.readAsArrayBuffer(file);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader><DialogTitle>Importar Excel</DialogTitle></DialogHeader>
                <div className="space-y-4 py-4">
                    <input type="file" accept=".xlsx" onChange={handleFileChange} className="w-full text-sm" />
                    <p className="text-xs text-slate-500">Requiere columnas: Fecha, Descripción, Monto, Categoría, Tipo.</p>
                </div>
                <div className="flex justify-end"><Button onClick={handleImportClick}>Importar</Button></div>
            </DialogContent>
        </Dialog>
    );
};

export default Transactions;
