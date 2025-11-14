
import React, { useState, useRef } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { Save, Download, Server, Key, Landmark, Upload, AlertTriangle } from 'lucide-react';
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


const Settings = () => {
    const { activeCompany, companies, setCompanies, isGeneralAdmin } = useCompany();
    const [initialBalance, saveInitialBalance, isBalanceLoaded] = useCompanyData('initialBalance');
    const [balance, setBalance] = useState('0');
    const { toast } = useToast();
    const fileInputRef = useRef(null);
    const [backupToRestore, setBackupToRestore] = useState(null);
    const [isRestoreAlertOpen, setIsRestoreAlertOpen] = useState(false);

    React.useEffect(() => {
      if(isBalanceLoaded && initialBalance && initialBalance.length > 0) {
        setBalance(initialBalance[0].balance);
      }
    }, [isBalanceLoaded, initialBalance]);


    const dataKeys = ['transactions', 'contacts', 'accounts', 'bankAccounts', 'fixedAssets', 'realEstates', 'accountsReceivable', 'accountsPayable', 'initialBalance'];

    const handleSaveSettings = () => {
        saveInitialBalance([{ balance: parseFloat(balance || 0) }]);
        toast({ title: '¡Guardado!', description: 'Tus ajustes se han guardado correctamente.' });
    };

    const handleBackup = () => {
        if (!activeCompany) {
            toast({ variant: 'destructive', title: 'Error', description: 'No hay una empresa activa para respaldar.' });
            return;
        }

        const dataToBackup = {};
        const companyId = activeCompany.id;
        
        dataKeys.forEach(key => {
            const item = localStorage.getItem(`${companyId}-${key}`);
            if (item) {
                try {
                    dataToBackup[key] = JSON.parse(item);
                } catch (e) {
                    console.error(`Error parsing ${key} for backup:`, e);
                }
            }
        });

        if (Object.keys(dataToBackup).length === 0) {
            toast({ variant: 'destructive', title: 'Sin datos', description: 'No hay datos para respaldar para esta empresa.' });
            return;
        }
        
        const backupBlob = new Blob([JSON.stringify(dataToBackup, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(backupBlob);
        const link = document.createElement('a');
        const timestamp = format(new Date(), 'yyyy-MM-dd_HH-mm-ss');
        link.href = url;
        link.download = `backup_${activeCompany.name.replace(/\s+/g, '_')}_${timestamp}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        toast({ title: 'Copia de Seguridad Generada', description: 'El archivo de respaldo se ha descargado.' });
    };

    const handleGlobalBackup = () => {
        const globalBackup = {
            companies: companies,
        };
        
        const backupBlob = new Blob([JSON.stringify(globalBackup, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(backupBlob);
        const link = document.createElement('a');
        const timestamp = format(new Date(), 'yyyy-MM-dd_HH-mm-ss');
        link.href = url;
        link.download = `backup_GLOBAL_empresas_${timestamp}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        toast({ title: 'Copia de Seguridad Global Generada', description: 'Se ha descargado el archivo con la lista de empresas.' });
    };

    const handleFileSelect = (event) => {
        const file = event.target.files[0];
        if (file && file.type === 'application/json') {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const content = JSON.parse(e.target.result);
                    setBackupToRestore(content);
                    setIsRestoreAlertOpen(true);
                } catch (error) {
                    toast({ variant: 'destructive', title: 'Error de Archivo', description: 'El archivo de respaldo está corrupto o no es válido.' });
                }
            };
            reader.readAsText(file);
        } else {
            toast({ variant: 'destructive', title: 'Archivo no válido', description: 'Por favor, selecciona un archivo de respaldo .json válido.' });
        }
        event.target.value = null; // Reset file input
    };

    const proceedWithRestore = () => {
        if (!backupToRestore) return;
    
        if (isGeneralAdmin) { // Global restore
            if (backupToRestore.companies) {
                localStorage.setItem('companies', JSON.stringify(backupToRestore.companies));
                setCompanies(backupToRestore.companies);
                
                toast({ title: 'Restauración Global Completa', description: 'La lista de empresas ha sido restaurada. La página se recargará.' });
                setTimeout(() => window.location.reload(), 1500);
            } else {
                toast({ variant: 'destructive', title: 'Error', description: 'El archivo de respaldo global no tiene el formato correcto.' });
            }
        } else { // Individual company restore
            if (activeCompany) {
                dataKeys.forEach(key => {
                    const companyKey = `${activeCompany.id}-${key}`;
                    if (backupToRestore[key]) {
                        localStorage.setItem(companyKey, JSON.stringify(backupToRestore[key]));
                    } else {
                        localStorage.removeItem(companyKey);
                    }
                    // Dispatch event to notify hooks to update
                    window.dispatchEvent(new CustomEvent('storage-updated', { detail: { key: companyKey } }));
                });
                toast({ title: 'Restauración Completa', description: 'Los datos de tu empresa han sido restaurados.' });
            }
        }
        setIsRestoreAlertOpen(false);
        setBackupToRestore(null);
    };
    
    const onRestoreClick = () => {
        fileInputRef.current.click();
    };

    return (
        <>
            <Helmet>
                <title>Ajustes - JaiderHerTur26</title>
                <meta name="description" content="Configura los ajustes de tu empresa." />
            </Helmet>
            <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="max-w-3xl mx-auto space-y-8">
                <div>
                    <h1 className="text-4xl font-bold text-slate-900">Ajustes</h1>
                    <p className="text-slate-600">Configura los parámetros iniciales y gestiona tus datos.</p>
                </div>

                {!isGeneralAdmin && (
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-white rounded-xl shadow-lg p-6 border">
                        <div className="flex items-center mb-4"><Landmark className="w-6 h-6 text-blue-600 mr-3" /><h2 className="text-xl font-bold text-slate-900">Capital Inicial</h2></div>
                        <p className="text-slate-600 mb-4">Define el saldo inicial de tu Caja Principal.</p>
                        <div className="space-y-2"><Label htmlFor="initial-balance">Saldo Inicial</Label><input id="initial-balance" type="number" step="0.01" value={balance} onChange={(e) => setBalance(e.target.value)} className="w-full px-3 py-2 border rounded-lg" placeholder="0.00" /></div>
                        <div className="mt-6 flex justify-end"><Button onClick={handleSaveSettings} className="bg-blue-600 hover:bg-blue-700"><Save className="w-4 h-4 mr-2" />Guardar Ajustes</Button></div>
                    </motion.div>
                )}
                
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-white rounded-xl shadow-lg p-6 border space-y-4">
                    <div className="flex items-center"><Server className="w-6 h-6 text-green-600 mr-3" /><h2 className="text-xl font-bold text-slate-900">Gestión de Datos</h2></div>
                    <p className="text-slate-600">Genera un archivo de respaldo con tu información o restaura desde una copia anterior. ¡Úsalo con cuidado!</p>
                    <div className="flex flex-col sm:flex-row justify-end gap-4 pt-2">
                        <Button onClick={isGeneralAdmin ? handleGlobalBackup : handleBackup} variant="outline" className="border-green-600 text-green-600 hover:bg-green-50 hover:text-green-700"><Download className="w-4 h-4 mr-2" />Descargar Copia de Seguridad</Button>
                        <Button onClick={onRestoreClick} variant="outline" className="border-orange-600 text-orange-600 hover:bg-orange-50 hover:text-orange-700"><Upload className="w-4 h-4 mr-2" />Restaurar desde Copia</Button>
                        <input type="file" ref={fileInputRef} onChange={handleFileSelect} accept=".json" className="hidden" />
                    </div>
                </motion.div>

                {isGeneralAdmin && (
                     <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="bg-white rounded-xl shadow-lg p-6 border">
                        <div className="flex items-center mb-4"><Key className="w-6 h-6 text-purple-600 mr-3" /><h2 className="text-xl font-bold text-slate-900">Administrador General</h2></div>
                        <p className="text-slate-600">Tienes permisos para gestionar empresas y realizar copias de seguridad globales.</p>
                    </motion.div>
                )}
            </motion.div>
            
            <AlertDialog open={isRestoreAlertOpen} onOpenChange={setIsRestoreAlertOpen}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle className="flex items-center"><AlertTriangle className="w-6 h-6 text-red-500 mr-2"/>¡Acción Permanente!</AlertDialogTitle>
                  <AlertDialogDescription>
                    Estás a punto de reemplazar {isGeneralAdmin ? 'la lista de empresas' : 'todos los datos de tu empresa'} con el contenido de este archivo. Esta acción no se puede deshacer. ¿Estás seguro de que quieres continuar?
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel onClick={() => setBackupToRestore(null)}>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={proceedWithRestore} className="bg-red-600 hover:bg-red-700">Sí, Restaurar Ahora</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
        </>
    );
};

export default Settings;
