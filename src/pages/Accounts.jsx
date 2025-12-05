import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Helmet } from 'react-helmet';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Search, Edit2, Trash2, BookOpen, Download, Upload, Lock, ChevronRight, ChevronDown, Folder, FileText, FolderOpen, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useCompanyData } from '@/hooks/useCompanyData';
import { exportToExcel } from '@/lib/excel';
import * as XLSX from 'xlsx';
import { usePermission } from '@/hooks/usePermission';
import { cn } from '@/lib/utils';

// Standard accounting classes definition
const ACCOUNT_CLASSES = {
  1: { name: 'Activo', color: 'text-blue-600', bg: 'bg-blue-50' },
  2: { name: 'Pasivo', color: 'text-red-600', bg: 'bg-red-50' },
  3: { name: 'Patrimonio', color: 'text-purple-600', bg: 'bg-purple-50' },
  4: { name: 'Ingresos', color: 'text-green-600', bg: 'bg-green-50' },
  5: { name: 'Gastos', color: 'text-orange-600', bg: 'bg-orange-50' },
  6: { name: 'Costos de Venta', color: 'text-amber-600', bg: 'bg-amber-50' },
  7: { name: 'Costos de Producción', color: 'text-indigo-600', bg: 'bg-indigo-50' },
  8: { name: 'Cuentas de Orden Deudoras', color: 'text-slate-600', bg: 'bg-slate-50' },
  9: { name: 'Cuentas de Orden Acreedoras', color: 'text-slate-600', bg: 'bg-slate-50' },
};

// Standard hierarchy levels for checking parentage
const HIERARCHY_LEVELS = [1, 2, 4, 6, 8, 10, 12, 14];

// Helper to determine hierarchy level and indentation based on code length
const getLevelInfo = (code) => {
  const len = code.toString().length;
  if (len === 1) return { level: 0, label: 'Clase', indent: 0 };
  if (len === 2) return { level: 1, label: 'Grupo', indent: 1 };
  if (len === 4) return { level: 2, label: 'Cuenta', indent: 2 };
  
  if (len >= 6) {
    // Calculate extra depth for sub-accounts and auxiliaries
    // Len 6 -> indent 3
    // Len 8 -> indent 4
    // Len 10 -> indent 5
    const extraSteps = Math.floor((len - 6) / 2);
    return { 
        level: 3 + extraSteps, 
        label: len === 6 ? 'Subcuenta' : 'Auxiliar', 
        indent: 3 + extraSteps 
    };
  }
  
  return { level: 0, label: 'Desconocido', indent: 0 };
};

const Accounts = () => {
  const { canEdit, canDelete, canAdd, canImport, isReadOnly } = usePermission();
  const [accounts, saveAccounts] = useCompanyData('accounts');
  const [searchTerm, setSearchTerm] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState(null);
  const [expandedGroups, setExpandedGroups] = useState({}); // Map of code -> boolean
  
  const { toast } = useToast();
  const fileInputRef = useRef(null);

  // Initialize expanded state for top-level classes and groups
  useEffect(() => {
    if (Object.keys(expandedGroups).length === 0 && accounts && accounts.length > 0) {
      const initialExpanded = {};
      // Expand classes (1 digit) and groups (2 digits) by default for better UX
      accounts.forEach(acc => {
        if (acc.number.length <= 2) {
          initialExpanded[acc.number] = true;
        }
      });
      setExpandedGroups(initialExpanded);
    }
  }, [accounts]);

  const toggleExpand = (code) => {
    setExpandedGroups(prev => ({
      ...prev,
      [code]: !prev[code]
    }));
  };

  // ------------------------------------------------------------------
  // DATA PROCESSING
  // ------------------------------------------------------------------
  
  // Filter and Sort
  const processedAccounts = useMemo(() => {
    let result = [...(accounts || [])];
    
    // CRITICAL FIX: Sort by string comparison to ensure strict hierarchy
    // (e.g., "1" -> "11" -> "1105" -> "2" -> "21")
    // Removing { numeric: true } ensures "11" comes after "1" but before "2"
    result.sort((a, b) => a.number.localeCompare(b.number));

    // Filter
    if (searchTerm) {
      const lowerTerm = searchTerm.toLowerCase();
      result = result.filter(a => 
        a.name.toLowerCase().includes(lowerTerm) || 
        a.number.includes(lowerTerm)
      );
    }
    
    return result;
  }, [accounts, searchTerm]);

  // Build Hierarchy Tree for Rendering
  const getVisibleRows = () => {
    if (searchTerm) return processedAccounts; // Show all matches when searching

    const visible = [];
    const codesWithChildren = new Set();

    // Pre-calculate which accounts have children
    // Optimization: Doing this once per render allows O(1) lookups
    processedAccounts.forEach(acc => {
        const hasChild = processedAccounts.some(child => child.number.startsWith(acc.number) && child.number !== acc.number);
        if (hasChild) codesWithChildren.add(acc.number);
    });

    processedAccounts.forEach(acc => {
        let isVisible = true;
        
        // Check all potential hierarchy levels to see if any parent is collapsed
        // We iterate through [1, 2, 4, 6, 8...]
        for (let len of HIERARCHY_LEVELS) {
            // If the current account is deeper than this level, check the parent at this level
            if (acc.number.length > len) {
                const parentCode = acc.number.substring(0, len);
                
                // We only care about the collapse state if this parent actually exists in our tree
                // (i.e., it's not a missing link in the chain)
                if (codesWithChildren.has(parentCode)) {
                    // If this parent is NOT expanded, then the child is hidden
                    if (!expandedGroups[parentCode]) {
                        isVisible = false;
                        break; 
                    }
                }
            } else {
                // If we've reached the length of the current account, no deeper parents exist
                break;
            }
        }
        
        if (isVisible) {
            visible.push({
                ...acc,
                hasChildren: codesWithChildren.has(acc.number),
                isExpanded: !!expandedGroups[acc.number]
            });
        }
    });

    return visible;
  };

  const displayRows = getVisibleRows();

  // ------------------------------------------------------------------
  // ACTIONS
  // ------------------------------------------------------------------

  const handleSaveAccount = (accountData) => {
    if (!canAdd && !editingAccount) return;
    if (!canEdit && editingAccount) return;

    // Validate Code Structure
    const len = accountData.number.length;
    const isValidLength = HIERARCHY_LEVELS.includes(len);
    
    if (!isValidLength) {
       toast({ variant: "destructive", title: "Código inválido", description: `La longitud del código (${len}) no es válida para la estructura jerárquica (1, 2, 4, 6, 8...).` });
       return;
    }
    
    // Check Duplicate
    const isDuplicate = accounts.some(a => a.number === accountData.number && a.id !== accountData.id);
    if (isDuplicate) {
        toast({ variant: "destructive", title: "Código duplicado", description: "Ya existe una cuenta con este código." });
        return;
    }

    let updatedAccounts;
    if (editingAccount) {
      updatedAccounts = accounts.map(a => a.id === editingAccount.id ? accountData : a);
      toast({ title: "¡Cuenta actualizada!" });
    } else {
      updatedAccounts = [...accounts, { ...accountData, id: crypto.randomUUID() }];
      toast({ title: "¡Cuenta creada!" });
    }
    
    // Auto-expand the parent chain for the new account
    const newExpansions = {};
    for (let levelLen of HIERARCHY_LEVELS) {
        if (len > levelLen) {
            const parentCode = accountData.number.substring(0, levelLen);
            newExpansions[parentCode] = true;
        }
    }
    
    if (Object.keys(newExpansions).length > 0) {
        setExpandedGroups(prev => ({ ...prev, ...newExpansions }));
    }

    saveAccounts(updatedAccounts);
    setDialogOpen(false);
    setEditingAccount(null);
  };

  const handleDeleteAccount = (id) => {
    if (!canDelete) return;
    const accToDelete = accounts.find(a => a.id === id);
    
    // Check if it has children
    const hasChildren = accounts.some(a => a.number.startsWith(accToDelete.number) && a.id !== id);
    if (hasChildren) {
        toast({ variant: "destructive", title: "No se puede eliminar", description: "Esta cuenta tiene subcuentas asociadas. Elimine las subcuentas primero." });
        return;
    }

    saveAccounts(accounts.filter(a => a.id !== id));
    toast({ title: "Cuenta eliminada" });
  };
  
  const handleExport = () => {
    if (accounts.length === 0) return;
    const dataToExport = accounts.map(c => ({
      'Código': c.number,
      'Nombre': c.name,
      'Nivel': getLevelInfo(c.number).label
    }));
    exportToExcel(dataToExport, 'Plan_de_Cuentas_Jerarquico');
    toast({ title: "¡Exportado!", description: "Plan de cuentas exportado." });
  };
  
  const handleImport = (event) => {
    if (!canImport) return;
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
          
          const newAccounts = [];
          const existingNumbers = new Set(accounts.map(a => a.number));

          json.forEach(acc => {
              if (acc.number && acc.name) {
                  const numStr = acc.number.toString();
                  if (!existingNumbers.has(numStr)) {
                      newAccounts.push({
                          id: crypto.randomUUID(),
                          number: numStr,
                          name: acc.name.toString(),
                      });
                      existingNumbers.add(numStr);
                  }
              }
          });

          if (newAccounts.length === 0) {
              toast({ title: "Sin cambios", description: "No se encontraron cuentas nuevas para importar." });
          } else {
              const updatedAccounts = [...accounts, ...newAccounts];
              saveAccounts(updatedAccounts);
              toast({ title: "Importación exitosa", description: `${newAccounts.length} cuentas agregadas.` });
          }
        } catch (error) {
          toast({ variant: 'destructive', title: "Error de importación", description: "Verifique el formato del archivo." });
        }
      };
      reader.readAsArrayBuffer(file);
      fileInputRef.current.value = "";
    }
  };

  return (
    <>
      <Helmet>
        <title>Plan de Cuentas - JaiderHerTur26</title>
        <meta name="description" content="Gestión jerárquica del plan de cuentas contable" />
      </Helmet>

      <div className="space-y-6">
        {/* HEADER */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-4xl font-bold text-slate-900">Plan de Cuentas</h1>
            <p className="text-slate-600">Estructura contable jerárquica (Clase &gt; Grupo &gt; Cuenta &gt; Subcuenta)</p>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <Button onClick={handleExport} variant="outline" size="sm"><Download className="w-4 h-4 mr-2" />Exportar</Button>
            
            {canImport && <Button asChild variant="outline" size="sm">
                <label className="cursor-pointer"><Upload className="w-4 h-4 mr-2" />Importar
                <input type="file" ref={fileInputRef} accept=".xlsx, .xls" onChange={handleImport} className="hidden" />
                </label>
            </Button>}
            
            {canAdd && <Button onClick={() => { setEditingAccount(null); setDialogOpen(true); }} className="bg-blue-600 hover:bg-blue-700" size="sm">
                <Plus className="w-4 h-4 mr-2" />
                Nueva Cuenta
            </Button>}
            
            {isReadOnly && <div className="flex items-center text-slate-400 text-xs ml-2 bg-slate-100 px-2 py-1 rounded"><Lock className="w-3 h-3 mr-1"/> Lectura</div>}
          </div>
        </div>

        {/* SEARCH */}
        <div className="bg-white rounded-xl shadow-sm p-4 border border-slate-200">
          <div className="relative max-w-xl">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Buscar cuenta por código o nombre..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* TREE TABLE */}
        <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
            <div className="grid grid-cols-12 gap-4 px-6 py-3 bg-slate-50 border-b text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <div className="col-span-6 sm:col-span-4">Código / Cuenta</div>
                <div className="col-span-3 sm:col-span-6">Nombre</div>
                <div className="col-span-3 sm:col-span-2 text-right">Nivel</div>
            </div>
            
            <div className="divide-y divide-slate-100 overflow-y-auto max-h-[70vh] custom-scrollbar">
               {displayRows.length === 0 ? (
                   <div className="p-12 text-center text-slate-400">
                       <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-20"/>
                       <p>No se encontraron cuentas</p>
                   </div>
               ) : (
                   displayRows.map((row) => {
                       const { level, label, indent } = getLevelInfo(row.number);
                       const isClass = level === 0;
                       const isGroup = level === 1;
                       
                       // Dynamic styles based on level
                       let rowBg = 'bg-white';
                       let textClass = 'text-slate-600';
                       let icon = <FileText className="w-4 h-4 text-slate-300" />;

                       if (isClass) {
                           rowBg = 'bg-slate-50/80';
                           textClass = 'font-bold text-slate-800';
                           icon = <FolderOpen className="w-4 h-4 text-slate-400" />;
                           const classDef = ACCOUNT_CLASSES[row.number[0]];
                           if (classDef) {
                               textClass = cn('font-bold', classDef.color);
                           }
                       } else if (isGroup) {
                           textClass = 'font-semibold text-slate-700';
                           icon = <Folder className="w-4 h-4 text-blue-300" />;
                       }

                       return (
                           <motion.div 
                                layout="position"
                                key={row.id} 
                                className={cn(
                                    "grid grid-cols-12 gap-4 px-6 py-2.5 items-center hover:bg-slate-50 transition-colors group text-sm",
                                    rowBg
                                )}
                           >
                               {/* CODE + EXPAND TOGGLE */}
                               <div className="col-span-6 sm:col-span-4 flex items-center gap-2" style={{ paddingLeft: `${indent * 1.5}rem` }}>
                                   {row.hasChildren ? (
                                       <button 
                                           onClick={() => toggleExpand(row.number)}
                                           className="p-0.5 rounded hover:bg-slate-200 text-slate-400 transition-colors"
                                       >
                                           {row.isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                       </button>
                                   ) : (
                                       <span className="w-5" /> // spacer
                                   )}
                                   <span className={cn("font-mono", textClass)}>
                                       {row.number}
                                   </span>
                               </div>

                               {/* NAME */}
                               <div className="col-span-3 sm:col-span-6 flex items-center gap-2 overflow-hidden">
                                   {icon}
                                   <span className={cn("truncate", textClass)} title={row.name}>{row.name}</span>
                               </div>

                               {/* LEVEL & ACTIONS */}
                               <div className="col-span-3 sm:col-span-2 flex items-center justify-end gap-3">
                                   <span className="hidden sm:inline-block px-2 py-0.5 rounded-full text-[10px] bg-slate-100 text-slate-500 font-medium uppercase border border-slate-200">
                                       {label}
                                   </span>
                                   
                                   <div className="flex opacity-0 group-hover:opacity-100 transition-opacity">
                                        {canEdit && (
                                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setEditingAccount(row); setDialogOpen(true); }}>
                                                <Edit2 className="w-3 h-3 text-blue-500" />
                                            </Button>
                                        )}
                                        {canDelete && (
                                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleDeleteAccount(row.id)}>
                                                <Trash2 className="w-3 h-3 text-red-500" />
                                            </Button>
                                        )}
                                   </div>
                               </div>
                           </motion.div>
                       );
                   })
               )}
            </div>
        </div>
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

// ------------------------------------------------------------------
// DIALOG COMPONENT
// ------------------------------------------------------------------
const AccountDialog = ({ open, onOpenChange, account, onSave }) => {
  const [formData, setFormData] = useState({ number: '', name: '' });
  const [levelPreview, setLevelPreview] = useState(null);

  useEffect(() => {
    if (account) {
      setFormData({ ...account });
    } else {
      setFormData({ number: '', name: '', id: null });
    }
  }, [account, open]);

  // Update level preview on number change
  useEffect(() => {
    if (formData.number) {
        setLevelPreview(getLevelInfo(formData.number));
    } else {
        setLevelPreview(null);
    }
  }, [formData.number]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  const handleNumberChange = (e) => {
      // Only allow numbers
      const val = e.target.value.replace(/[^0-9]/g, '');
      setFormData({ ...formData, number: val });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{account ? 'Editar Cuenta' : 'Nueva Cuenta'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          
          <div className="space-y-2">
            <Label htmlFor="number">Código (PUC)</Label>
            <div className="relative">
                <input 
                    id="number" 
                    required 
                    value={formData.number} 
                    onChange={handleNumberChange} 
                    className={cn(
                        "w-full pl-3 pr-24 py-2 border rounded-lg font-mono text-lg tracking-wider focus:ring-2 focus:ring-blue-500 outline-none transition-all",
                        !levelPreview ? "border-slate-300" : "border-blue-300 bg-blue-50/30"
                    )}
                    placeholder="Ej: 110505" 
                    autoFocus={!account}
                />
                {levelPreview && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-blue-600 bg-blue-100 px-2 py-1 rounded-md uppercase">
                        {levelPreview.label}
                    </span>
                )}
            </div>
            <p className="text-xs text-slate-500 flex items-center gap-1">
                <AlertCircle className="w-3 h-3"/> Estructura: 1, 2, 4, 6, 8, 10... (Pares después de 6)
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Nombre de la Cuenta</Label>
            <input 
                id="name" 
                required 
                value={formData.name} 
                onChange={(e) => setFormData({ ...formData, name: e.target.value })} 
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" 
                placeholder="Ej: CAJA GENERAL" 
            />
          </div>

          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" className="bg-blue-600 hover:bg-blue-700">Guardar</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default Accounts;