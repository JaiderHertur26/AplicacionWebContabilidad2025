import React, { useState, useRef, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { Navigate } from 'react-router-dom';
import { Save, Download, Server, Key, Landmark, Upload, AlertTriangle, Hash, Lock, Building, User, MapPin, Phone, Shield, CreditCard, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { useCompanyData } from '@/hooks/useCompanyData';
import { Label } from '@/components/ui/label';
import { useCompany } from '@/App';
import { format } from 'date-fns';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { usePermission } from '@/hooks/usePermission';

const Settings = () => {
    const { activeCompany, companies, setCompanies, isGeneralAdmin, isConsolidated } = useCompany();
    const { canModify, isReadOnly, accessLevel } = usePermission();
    const [initialBalance, saveInitialBalance, isBalanceLoaded] = useCompanyData('initialBalance');
    const [chartOfAccounts, saveChartOfAccounts] = useCompanyData('accounts');
    const [balance, setBalance] = useState('0');
    const { toast } = useToast();
    const fileInputRef = useRef(null);
    const [backupToRestore, setBackupToRestore] = useState(null);
    const [isRestoreAlertOpen, setIsRestoreAlertOpen] = useState(false);
    
    // Company Profile State
    const [profileData, setProfileData] = useState({
        name: '', doc: '', authSerial: '', address: '', phone: '', 
        username: '', password: '', partialPassword: ''
    });
    
    // Cash Account Info (Accounting link)
    const [cashAccountInfo, setCashAccountInfo] = useState({
        code: '110505',
        name: 'CAJA GENERAL'
    });

    // Voucher sequence states
    const [voucherSequences, setVoucherSequences] = useState({
      income: '1',
      expense: '1',
      transfer: '1'
    });

    React.useEffect(() => {
      if(isBalanceLoaded) {
        // Calculate total balance summing all entries (Main + Sub-companies if consolidated)
        const total = (initialBalance || []).reduce((sum, item) => {
            return sum + (parseFloat(item.balance) || 0);
        }, 0);
        
        setBalance(total);
        
        // Load current cash accounting info if saved previously in initialBalance metadata or try to find default
        if (initialBalance && initialBalance.length > 0 && initialBalance[0].accountingCode) {
             setCashAccountInfo({
                 code: initialBalance[0].accountingCode,
                 name: initialBalance[0].accountingName
             });
        }
      }
    }, [isBalanceLoaded, initialBalance]);

    useEffect(() => {
      if (activeCompany) {
        const sequenceKey = `${activeCompany.id}-voucher-sequence`;
        const sequences = JSON.parse(localStorage.getItem(sequenceKey) || '{ "income": 0, "expense": 0, "transfer": 0 }');
        setVoucherSequences({
          income: String(sequences.income || 0),
          expense: String(sequences.expense || 0),
          transfer: String(sequences.transfer || 0)
        });

        // Load Profile Data
        setProfileData({
            name: activeCompany.name || '',
            doc: activeCompany.doc || '',
            authSerial: activeCompany.authSerial || '',
            address: activeCompany.address || '',
            phone: activeCompany.phone || '',
            username: activeCompany.username || '',
            password: activeCompany.password || '',
            partialPassword: activeCompany.partialPassword || ''
        });
      }
    }, [activeCompany]);

    const handleSaveSettings = async () => {
        if (!canModify) return;
        
        // 1. Save Balance & Cash Account Link
        if (!isConsolidated) {
             saveInitialBalance([{ 
                 balance: parseFloat(balance || 0),
                 accountingCode: cashAccountInfo.code,
                 accountingName: cashAccountInfo.name
             }]);
             
             // Auto-update/Create in Chart of Accounts
             if (cashAccountInfo.code && cashAccountInfo.name) {
                 const existingIdx = chartOfAccounts.findIndex(c => c.number === cashAccountInfo.code);
                 let updatedChart = [...chartOfAccounts];
                 
                 if (existingIdx >= 0) {
                     updatedChart[existingIdx] = { ...updatedChart[existingIdx], name: cashAccountInfo.name };
                 } else {
                     updatedChart.push({
                         id: crypto.randomUUID(),
                         number: cashAccountInfo.code,
                         name: cashAccountInfo.name
                     });
                     updatedChart.sort((a,b) => a.number.localeCompare(b.number));
                 }
                 saveChartOfAccounts(updatedChart);
             }
        }
        
        // 2. Save Sequences
        if (activeCompany) {
          const sequenceKey = `${activeCompany.id}-voucher-sequence`;
          const sequences = {
            income: parseInt(voucherSequences.income) || 0,
            expense: parseInt(voucherSequences.expense) || 0,
            transfer: parseInt(voucherSequences.transfer) || 0
          };
          localStorage.setItem(sequenceKey, JSON.stringify(sequences));

          // 3. Save Company Profile
          const updatedCompany = {
              ...activeCompany,
              name: profileData.name,
              address: profileData.address,
              phone: profileData.phone,
              username: profileData.username,
              password: profileData.password,
              partialPassword: profileData.partialPassword,
              doc: activeCompany.doc,
              authSerial: activeCompany.authSerial
          };

          const updatedCompanies = companies.map(c => c.id === activeCompany.id ? updatedCompany : c);
          setCompanies(updatedCompanies);
          localStorage.setItem('companies', JSON.stringify(updatedCompanies));
          
          toast({ title: '¡Guardado!', description: 'Perfil, ajustes y plan de cuentas actualizados.' });
        }
    };

    const handleFullBackup = () => {
        const backupData = {
            version: '2.1',
            timestamp: new Date().toISOString(),
            type: isGeneralAdmin ? 'ADMIN_STRUCTURE_ONLY' : 'COMPANY_DATA_ONLY',
            companies: [],
            data: {}
        };

        // Helper function to remove passwords from backup
        const sanitizeCompany = (company) => {
            if (!company) return company;
            const { password, partialPassword, ...rest } = company;
            return rest;
        };

        if (isGeneralAdmin) {
            // ADMIN BACKUP: Only saves company registry/structure, NO movements/transactions
            // Exclude passwords
            backupData.companies = companies.map(sanitizeCompany);
            // We specifically do NOT iterate over transaction data here
        } else {
            // INDIVIDUAL COMPANY BACKUP: Only saves data for this company and its sub-companies
            if (!activeCompany) return;
            const myId = activeCompany.id;
            const subCompanies = companies.filter(c => c.parentId === myId);
            const relevantIds = [myId, ...subCompanies.map(s => s.id)];
            
            // Save company metadata for these specific IDs only, WITHOUT passwords
            backupData.companies = companies
                .filter(c => relevantIds.includes(c.id))
                .map(sanitizeCompany);
            
            const dataSuffixes = [
                'transactions', 'contacts', 'accounts', 'bankAccounts', 
                'fixedAssets', 'realEstates', 'accountsReceivable', 
                'accountsPayable', 'initialBalance', 'voucher-sequence'
            ];

            relevantIds.forEach(id => {
                dataSuffixes.forEach(suffix => {
                    const key = `${id}-${suffix}`;
                    const item = localStorage.getItem(key);
                    if (item) {
                        backupData.data[key] = JSON.parse(item);
                    }
                });
            });
        }

        const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        const name = isGeneralAdmin ? 'RESPALDO_ADMIN_ESTRUCTURA' : `RESPALDO_${activeCompany.name.replace(/\s+/g, '_').toUpperCase()}`;
        const time = format(new Date(), 'yyyy-MM-dd_HHmm');
        link.href = url;
        link.download = `${name}_${time}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        const desc = isGeneralAdmin 
            ? 'Se ha guardado la estructura de empresas (sin movimientos, sin contraseñas).' 
            : 'Se han guardado los movimientos de tu empresa (sin contraseñas).';
        toast({ title: 'Copia de Seguridad Generada', description: desc });
    };

    const handleFileSelect = (event) => {
        if (!canModify) return;
        const file = event.target.files[0];
        if (file && file.type === 'application/json') {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const content = JSON.parse(e.target.result);
                    setBackupToRestore(content);
                    setIsRestoreAlertOpen(true);
                } catch (error) {
                    toast({ variant: 'destructive', title: 'Error de Archivo', description: 'El archivo de respaldo está corrupto.' });
                }
            };
            reader.readAsText(file);
        } else {
            toast({ variant: 'destructive', title: 'Archivo no válido', description: 'Selecciona un archivo .json válido.' });
        }
        event.target.value = null;
    };

    const proceedWithRestore = () => {
        if (!backupToRestore) return;
        if (!canModify) return;

        if (backupToRestore.companies && Array.isArray(backupToRestore.companies)) {
            if (isGeneralAdmin) {
                // Admin restores structure
                localStorage.setItem('companies', JSON.stringify(backupToRestore.companies));
                setCompanies(backupToRestore.companies);
            } else {
                // Individual restores their data + structure
                const backupIds = backupToRestore.companies.map(c => c.id);
                const otherCompanies = companies.filter(c => !backupIds.includes(c.id));
                const mergedCompanies = [...otherCompanies, ...backupToRestore.companies];
                localStorage.setItem('companies', JSON.stringify(mergedCompanies));
                setCompanies(mergedCompanies);
            }
        }

        if (backupToRestore.data) {
            Object.keys(backupToRestore.data).forEach(key => {
                // Security check: If not admin, ensure we are only restoring data for our own IDs
                if (!isGeneralAdmin && activeCompany) {
                     const myId = activeCompany.id;
                     const subIds = companies.filter(c => c.parentId === myId).map(s => s.id);
                     const allowedIds = [myId, ...subIds];
                     
                     const keyPrefix = key.split('-')[0];
                     if (!allowedIds.includes(keyPrefix)) {
                         return; // Skip data that doesn't belong to this company hierarchy
                     }
                }
                
                localStorage.setItem(key, JSON.stringify(backupToRestore.data[key]));
                window.dispatchEvent(new CustomEvent('storage-updated', { detail: { key: key } }));
            });
        }

        toast({ title: 'Restauración Exitosa', description: 'Se han recuperado los datos.' });
        setIsRestoreAlertOpen(false);
        setBackupToRestore(null);
        setTimeout(() => window.location.reload(), 1000);
    };
    
    const onRestoreClick = () => {
        if (!canModify) return;
        fileInputRef.current.click();
    };

    // Helper to mask passwords for partial access
    const getPasswordValue = (val) => {
        if (accessLevel === 'partial') return '••••••••';
        return val;
    };

    return (
        <>
            <Helmet>
                <title>Ajustes - JaiderHerTur26</title>
                <meta name="description" content="Configura los ajustes de tu empresa." />
            </Helmet>
            <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="max-w-4xl mx-auto space-y-8">
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-4xl font-bold text-slate-900">Ajustes</h1>
                        <p className="text-slate-600">Configura los parámetros iniciales y gestiona tus datos.</p>
                    </div>
                     {isReadOnly && <div className="flex items-center text-slate-400 text-sm font-semibold bg-slate-100 px-3 py-1 rounded-full border"><Lock className="w-4 h-4 mr-1"/> Modo Lectura</div>}
                </div>

                {!isGeneralAdmin && (
                    <>
                        {/* COMPANY PROFILE EDITOR */}
                        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                            <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                                <div className="flex items-center gap-2">
                                    <Building className="w-5 h-5 text-blue-600" />
                                    <div>
                                        <h2 className="font-bold text-slate-800 leading-tight">Perfil de la Empresa</h2>
                                        {activeCompany?.doc && (
                                            <p className="text-xs text-slate-500 font-mono">NIT: {activeCompany.doc}</p>
                                        )}
                                    </div>
                                </div>
                                <span className="text-xs text-slate-400 bg-white px-2 py-1 rounded border">ID: {activeCompany?.id}</span>
                            </div>
                            
                            <div className="p-6 space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-4">
                                        <div className="space-y-2">
                                            <Label>Nombre / Razón Social</Label>
                                            <div className="relative">
                                                <Building className="absolute left-3 top-3 text-slate-400 w-4 h-4" />
                                                <input disabled={isReadOnly} value={profileData.name} onChange={e => setProfileData({...profileData, name: e.target.value})} className="w-full pl-9 p-2 border rounded-md text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                                            </div>
                                        </div>
                                        
                                        <div className="space-y-2">
                                            <Label>Dirección</Label>
                                            <div className="relative">
                                                <MapPin className="absolute left-3 top-3 text-slate-400 w-4 h-4" />
                                                <input disabled={isReadOnly} value={profileData.address} onChange={e => setProfileData({...profileData, address: e.target.value})} className="w-full pl-9 p-2 border rounded-md text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Teléfono</Label>
                                            <div className="relative">
                                                <Phone className="absolute left-3 top-3 text-slate-400 w-4 h-4" />
                                                <input disabled={isReadOnly} value={profileData.phone} onChange={e => setProfileData({...profileData, phone: e.target.value})} className="w-full pl-9 p-2 border rounded-md text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-0">
                                        <div className="bg-yellow-50/50 border border-yellow-100 rounded-lg p-4 space-y-4 h-full">
                                            <div className="flex items-center gap-2 text-yellow-800 font-semibold text-sm">
                                                <Shield className="w-4 h-4" /> Credenciales de Acceso
                                            </div>
                                            <div className="space-y-4">
                                                <div className="space-y-2">
                                                    <Label className="text-xs">Usuario</Label>
                                                    <div className="relative">
                                                        <User className="absolute left-3 top-2.5 text-slate-400 w-3.5 h-3.5" />
                                                        <input disabled={isReadOnly} value={profileData.username} onChange={e => setProfileData({...profileData, username: e.target.value})} className="w-full pl-8 p-2 border rounded-md text-sm bg-white" />
                                                    </div>
                                                </div>
                                                <div className="space-y-2">
                                                    <Label className="text-xs">Contraseña Global</Label>
                                                    <div className="relative">
                                                        <Lock className="absolute left-3 top-2.5 text-green-600 w-3.5 h-3.5" />
                                                        <input 
                                                            disabled={isReadOnly} 
                                                            type={accessLevel === 'partial' ? "password" : "text"}
                                                            value={getPasswordValue(profileData.password)} 
                                                            onChange={e => setProfileData({...profileData, password: e.target.value})} 
                                                            className="w-full pl-8 p-2 border border-green-200 rounded-md text-sm bg-white" 
                                                        />
                                                    </div>
                                                </div>
                                                <div className="space-y-2">
                                                    <Label className="text-xs">Contraseña Parcial</Label>
                                                    <div className="relative">
                                                        <Lock className="absolute left-3 top-2.5 text-orange-600 w-3.5 h-3.5" />
                                                        <input 
                                                            disabled={isReadOnly} 
                                                            type={accessLevel === 'partial' ? "password" : "text"}
                                                            value={getPasswordValue(profileData.partialPassword)} 
                                                            onChange={e => setProfileData({...profileData, partialPassword: e.target.value})} 
                                                            className="w-full pl-8 p-2 border border-orange-200 rounded-md text-sm bg-white" 
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </motion.div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-white rounded-xl shadow-sm border p-6">
                                <div className="flex items-center mb-4"><Landmark className="w-6 h-6 text-blue-600 mr-3" /><h2 className="text-lg font-bold text-slate-900">Capital Inicial</h2></div>
                                <p className="text-sm text-slate-600 mb-4">Define el saldo inicial de tu Caja Principal.</p>
                                <div className="space-y-2">
                                    <Label htmlFor="initial-balance">Saldo Inicial {isConsolidated && <span className="text-purple-600 text-xs font-bold ml-1">(Consolidado)</span>}</Label>
                                    <input 
                                        id="initial-balance" 
                                        type="number" 
                                        step="0.01" 
                                        value={balance} 
                                        onChange={(e) => setBalance(e.target.value)} 
                                        className="w-full px-3 py-2 border rounded-lg disabled:bg-slate-50 disabled:text-slate-500" 
                                        placeholder="0.00" 
                                        disabled={isReadOnly || isConsolidated} 
                                    />
                                    {isConsolidated && <p className="text-xs text-purple-600 mt-1">Para editar el saldo inicial, cambia a la Vista Individual.</p>}
                                </div>
                                
                                {!isConsolidated && (
                                    <div className="mt-4 p-3 bg-slate-50 rounded border border-slate-100 space-y-3">
                                         <div className="flex items-center gap-2 text-xs font-semibold text-blue-800 border-b border-slate-200 pb-1 mb-2">
                                            <Landmark className="w-3 h-3" /> Vinculación Contable
                                         </div>
                                         <div className="grid grid-cols-2 gap-2">
                                            <div className="space-y-1">
                                                <Label className="text-[10px]">Código PUC</Label>
                                                <input disabled={isReadOnly} value={cashAccountInfo.code} onChange={e => setCashAccountInfo({...cashAccountInfo, code: e.target.value})} className="w-full px-2 py-1 border rounded text-xs"/>
                                            </div>
                                            <div className="space-y-1">
                                                <Label className="text-[10px]">Nombre Cuenta</Label>
                                                <input disabled={isReadOnly} value={cashAccountInfo.name} onChange={e => setCashAccountInfo({...cashAccountInfo, name: e.target.value})} className="w-full px-2 py-1 border rounded text-xs"/>
                                            </div>
                                         </div>
                                         <p className="text-[9px] text-slate-400">Al guardar, se actualizará el Plan de Cuentas.</p>
                                    </div>
                                )}
                            </motion.div>

                            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="bg-white rounded-xl shadow-sm border p-6">
                                <div className="flex items-center mb-4"><Hash className="w-6 h-6 text-purple-600 mr-3" /><h2 className="text-lg font-bold text-slate-900">Secuencias de Comprobantes</h2></div>
                                
                                <div className="grid grid-cols-3 gap-3">
                                    <div className="space-y-1">
                                        <Label className="text-xs">Ingresos</Label>
                                        <input type="number" min="0" value={voucherSequences.income} onChange={(e) => setVoucherSequences({...voucherSequences, income: e.target.value})} className="w-full px-2 py-1.5 border rounded text-sm" disabled={isReadOnly} />
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-xs">Gastos</Label>
                                        <input type="number" min="0" value={voucherSequences.expense} onChange={(e) => setVoucherSequences({...voucherSequences, expense: e.target.value})} className="w-full px-2 py-1.5 border rounded text-sm" disabled={isReadOnly} />
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-xs">Transf.</Label>
                                        <input type="number" min="0" value={voucherSequences.transfer} onChange={(e) => setVoucherSequences({...voucherSequences, transfer: e.target.value})} className="w-full px-2 py-1.5 border rounded text-sm" disabled={isReadOnly} />
                                    </div>
                                </div>
                            </motion.div>
                        </div>

                        {canModify && <div className="flex justify-end">
                            <Button onClick={handleSaveSettings} className="bg-blue-600 hover:bg-blue-700 shadow-md"><Save className="w-4 h-4 mr-2" />Guardar Todo</Button>
                        </div>}
                    </>
                )}
                
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-white rounded-xl shadow-sm border p-6 space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center"><Server className="w-6 h-6 text-green-600 mr-3" /><h2 className="text-xl font-bold text-slate-900">Copia de Seguridad</h2></div>
                        <span className="text-xs font-medium px-2 py-1 bg-green-100 text-green-800 rounded-full">V2.1</span>
                    </div>
                    
                    {isGeneralAdmin ? (
                        <p className="text-slate-600 text-sm">
                            <strong className="text-slate-800">Modo Admin General:</strong> Genera un archivo únicamente con la estructura de empresas y credenciales. 
                            <span className="text-red-600 ml-1 font-medium">NO incluye movimientos ni contabilidad.</span>
                        </p>
                    ) : (
                         <p className="text-slate-600 text-sm">
                            <strong className="text-slate-800">Modo Empresa:</strong> Genera un archivo con todos tus movimientos, cuentas y configuraciones (incluyendo sub-empresas).
                            <span className="text-blue-600 ml-1 font-medium">NO incluye datos de otras empresas.</span>
                        </p>
                    )}
                    
                    <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-4">
                         <div className="flex items-center gap-3">
                             <Download className="w-8 h-8 text-slate-300" />
                             <div className="text-sm">
                                 <p className="font-semibold text-slate-700">Descargar Respaldo</p>
                                 <p className="text-slate-500">Formato .JSON encriptado (estándar)</p>
                             </div>
                         </div>
                         <Button onClick={handleFullBackup} variant="default" className="bg-slate-900 hover:bg-slate-800 w-full sm:w-auto">
                             <Download className="w-4 h-4 mr-2" /> Generar Copia
                         </Button>
                    </div>

                    {canModify && (
                        <div className="bg-orange-50 p-4 rounded-lg border border-orange-100 flex flex-col sm:flex-row justify-between items-center gap-4 mt-4">
                             <div className="flex items-center gap-3">
                                 <Upload className="w-8 h-8 text-orange-300" />
                                 <div className="text-sm">
                                     <p className="font-semibold text-orange-800">Restaurar Información</p>
                                     <p className="text-orange-600/80">Reemplaza los datos actuales con un archivo</p>
                                 </div>
                             </div>
                             <div className="flex gap-2 w-full sm:w-auto">
                                 <input type="file" ref={fileInputRef} onChange={handleFileSelect} accept=".json" className="hidden" />
                                 <Button onClick={onRestoreClick} variant="outline" className="border-orange-300 text-orange-700 hover:bg-orange-100 w-full">
                                     <Upload className="w-4 h-4 mr-2" /> Cargar Archivo
                                 </Button>
                             </div>
                        </div>
                    )}
                </motion.div>
            </motion.div>
            
            <AlertDialog open={isRestoreAlertOpen} onOpenChange={setIsRestoreAlertOpen}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle className="flex items-center"><AlertTriangle className="w-6 h-6 text-red-500 mr-2"/>¡Restauración Completa!</AlertDialogTitle>
                  <AlertDialogDescription>
                    Estás a punto de restaurar una copia de seguridad. <br/><br/>
                    Esto <strong>sobrescribirá</strong> la información actual.
                    <br/><br/>
                    ¿Estás seguro de continuar?
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel onClick={() => setBackupToRestore(null)}>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={proceedWithRestore} className="bg-red-600 hover:bg-red-700">Sí, Restaurar Todo</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
        </>
    );
};

export default Settings;