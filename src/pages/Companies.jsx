import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { Plus, Edit2, Trash2, Building, Key, Calculator, Check, Copy, ShieldAlert, Eye, EyeOff, Lock, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useCompany } from '@/App';
import { generateCompanySerial } from '@/lib/auth-utils';

const Companies = () => {
    const { companies, setCompanies } = useCompany();
    const [dialogOpen, setDialogOpen] = useState(false);
    const [serialDialogOpen, setSerialDialogOpen] = useState(false);
    const [credentialsDialogOpen, setCredentialsDialogOpen] = useState(false);
    const [editingCompany, setEditingCompany] = useState(null);
    const [selectedCompanyForSerial, setSelectedCompanyForSerial] = useState(null);
    const [selectedCompanyForCredentials, setSelectedCompanyForCredentials] = useState(null);
    const { toast } = useToast();

    const persistCompanies = (updatedCompanies) => {
        localStorage.setItem('companies', JSON.stringify(updatedCompanies));
        setCompanies(updatedCompanies);
    };

    const handleSaveCompany = async (companyData) => {
        let updated;
        let finalCompanyData = { ...companyData };
        
        // Generate serial based on document
        const serial = await generateCompanySerial(companyData.doc);
        finalCompanyData.authSerial = serial;

        if (!editingCompany) {
            // New Stub (Pre-registration)
            finalCompanyData.id = Date.now().toString();
            // Ensure no user credentials are set here
            finalCompanyData.username = null;
            finalCompanyData.password = null;
            
            updated = [...companies, finalCompanyData];
            toast({ title: "Empresa pre-registrada", description: "Serial generado exitosamente." });
        } else {
            // Edit existing
            updated = companies.map(c => c.id === editingCompany.id ? { 
                ...c, 
                name: finalCompanyData.name,
                doc: finalCompanyData.doc,
                authSerial: serial // Update serial if doc changed
            } : c);
            
            toast({ title: "Datos actualizados" });
        }
        persistCompanies(updated);
        setDialogOpen(false);
    };

    const handleDeleteCompany = (id) => {
        if (window.confirm('¿Estás seguro de eliminar esta empresa? Se perderán todos los datos asociados.')) {
             persistCompanies(companies.filter(c => c.id !== id));
             toast({ title: "Empresa eliminada" });
        }
    };
    
    const handleOpenSerial = (company) => {
        setSelectedCompanyForSerial(company);
        setSerialDialogOpen(true);
    };

    const handleOpenCredentials = (company) => {
        setSelectedCompanyForCredentials(company);
        setCredentialsDialogOpen(true);
    }

    return (
        <>
        <Helmet><title>Gestión de Empresas - JaiderHerTur26</title></Helmet>
        <div className="max-w-5xl mx-auto space-y-8 p-6">
            <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900">Gestión de Empresas</h1>
                    <p className="text-slate-600 mt-1">Generación de seriales, pre-registro y gestión de credenciales.</p>
                </div>
                <Button onClick={() => { setEditingCompany(null); setDialogOpen(true); }} className="bg-slate-900 hover:bg-slate-800 text-white shadow-lg">
                    <Plus className="w-4 h-4 mr-2" /> Pre-registrar Empresa
                </Button>
            </motion.div>

            <div className="bg-blue-50 border border-blue-100 p-4 rounded-lg flex items-start gap-3">
                <ShieldAlert className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-blue-800">
                    <strong>Nota de Seguridad:</strong> Desde este panel puedes pre-registrar empresas y ver sus seriales de activación. También tienes acceso a las credenciales generadas por los clientes.
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                {companies.length === 0 ? (
                     <div className="text-center py-16 px-4">
                        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Calculator className="w-8 h-8 text-slate-400" />
                        </div>
                        <h3 className="text-lg font-medium text-slate-900">No hay empresas registradas</h3>
                        <p className="text-slate-500 mt-1 max-w-sm mx-auto">Registra una empresa con su NIT para generar el serial de entrega al cliente.</p>
                    </div>
                ) : (
                    <ul className="divide-y divide-slate-100">
                        {companies.map((company, index) => (
                            <motion.li 
                                key={company.id} 
                                initial={{ opacity: 0, x: -20 }} 
                                animate={{ opacity: 1, x: 0 }} 
                                transition={{ delay: index * 0.05 }} 
                                className="p-5 flex flex-col sm:flex-row sm:items-center justify-between hover:bg-slate-50 transition-colors gap-4"
                            >
                                <div className="flex items-start gap-4">
                                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${company.username ? 'bg-green-100 text-green-600' : 'bg-amber-100 text-amber-600'}`}>
                                        <Building className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-slate-900">{company.name}</h3>
                                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500 mt-1">
                                            <span className="flex items-center gap-1"><span className="font-medium">NIT:</span> {company.doc}</span>
                                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${company.username ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                                                {company.username ? 'Activo' : 'Pendiente'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="flex items-center gap-2 self-end sm:self-center flex-wrap justify-end">
                                     {company.username && (
                                        <Button variant="outline" size="sm" onClick={() => handleOpenCredentials(company)} className="text-slate-600 border-slate-200 hover:bg-slate-100">
                                            <Lock className="w-4 h-4 mr-2" /> Credenciales
                                        </Button>
                                    )}
                                    <Button variant="outline" size="sm" onClick={() => handleOpenSerial(company)} className="text-indigo-600 border-indigo-200 hover:bg-indigo-50">
                                        <Key className="w-4 h-4 mr-2" /> Serial
                                    </Button>
                                    <div className="flex gap-1 border-l pl-2 ml-1 border-slate-200">
                                        <Button variant="ghost" size="icon" onClick={() => {setEditingCompany(company); setDialogOpen(true)}} className="text-slate-500 hover:text-blue-600 hover:bg-blue-50">
                                            <Edit2 className="w-4 h-4" />
                                        </Button>
                                        <Button variant="ghost" size="icon" onClick={() => handleDeleteCompany(company.id)} className="text-slate-500 hover:text-red-600 hover:bg-red-50">
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </div>
                            </motion.li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
        
        <CompanyDialog 
            open={dialogOpen} 
            onOpenChange={setDialogOpen} 
            onSave={handleSaveCompany} 
            company={editingCompany} 
        />
        
        {selectedCompanyForSerial && (
            <SerialDialog 
                open={serialDialogOpen} 
                onOpenChange={setSerialDialogOpen} 
                company={selectedCompanyForSerial}
            />
        )}

        {selectedCompanyForCredentials && (
            <CredentialsDialog
                open={credentialsDialogOpen}
                onOpenChange={setCredentialsDialogOpen}
                company={selectedCompanyForCredentials}
            />
        )}
        </>
    );
};

const CompanyDialog = ({ open, onOpenChange, onSave, company }) => {
    const [formData, setFormData] = useState({ name: '', doc: '' });
    
    useEffect(() => {
        if (company) {
            setFormData({ 
                name: company.name || '', 
                doc: company.doc || '',
            });
        } else {
            setFormData({ name: '', doc: '' });
        }
    }, [company, open]);

    const handleSubmit = (e) => { 
        e.preventDefault(); 
        onSave(formData); 
    };

    return(
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>{company ? 'Editar Datos Básicos' : 'Pre-registrar Empresa'}</DialogTitle>
                    <DialogDescription>
                        Ingresa el Nombre y NIT. El serial se generará automáticamente. <br/>
                        <span className="text-amber-600 font-medium text-xs">Nota: No se crean usuarios aquí.</span>
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 py-2">
                    <div className="space-y-2">
                        <Label htmlFor="doc">NIT / Documento (Sin dígito de verificación)</Label>
                        <input id="doc" required value={formData.doc} onChange={e => setFormData({...formData, doc: e.target.value})} className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-500" placeholder="Ej: 900123456" />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="name">Nombre de la Empresa</Label>
                        <input id="name" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-500" placeholder="Ej: Empresa S.A.S" />
                    </div>
                    
                    <div className="flex justify-end gap-2 pt-4">
                        <DialogClose asChild><Button type="button" variant="outline">Cancelar</Button></DialogClose>
                        <Button type="submit" className="bg-slate-900 hover:bg-slate-800">
                            {company ? 'Guardar Cambios' : 'Generar Serial'}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
};

const SerialDialog = ({ open, onOpenChange, company }) => {
    const [serial, setSerial] = useState('');
    const [copied, setCopied] = useState(false);
    
    useEffect(() => {
        const loadSerial = async () => {
            if (!company) return;
            
            if (company.authSerial) {
                setSerial(company.authSerial);
            } else if (company.doc) {
                try {
                    const generated = await generateCompanySerial(company.doc);
                    setSerial(generated);
                } catch (error) {
                    setSerial('Error generando serial');
                }
            }
        };
        
        if (open) {
            loadSerial();
        }
    }, [company, open]);
    
    const copyToClipboard = () => {
        if (serial) {
            navigator.clipboard.writeText(serial);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Key className="w-5 h-5 text-indigo-600" /> Serial de Autenticación
                    </DialogTitle>
                    <DialogDescription>
                        Entrega este serial al cliente para que pueda completar su registro.
                    </DialogDescription>
                </DialogHeader>
                
                <div className="py-6 space-y-6">
                    <div className="space-y-1 text-center">
                         <h4 className="font-semibold text-slate-900">{company?.name}</h4>
                         <p className="text-sm text-slate-500">NIT: {company?.doc}</p>
                    </div>

                    <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 break-all relative group">
                         <p className="font-mono text-lg text-slate-800 text-center font-bold tracking-wide">
                            {serial || "Calculando..."}
                         </p>
                         {serial && (
                             <Button 
                                size="icon" 
                                variant="ghost" 
                                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={copyToClipboard}
                            >
                                {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                             </Button>
                         )}
                    </div>

                    <div className="text-xs text-slate-500 bg-blue-50 p-3 rounded text-center border border-blue-100">
                        Este serial es único e intransferible. Se calcula matemáticamente basado en el NIT de la empresa.
                    </div>
                </div>

                <div className="flex justify-end items-center">
                    <DialogClose asChild>
                        <Button>Cerrar</Button>
                    </DialogClose>
                </div>
            </DialogContent>
        </Dialog>
    );
};

const CredentialsDialog = ({ open, onOpenChange, company }) => {
    const [showPassword, setShowPassword] = useState(false);
    const [showPartial, setShowPartial] = useState(false);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Lock className="w-5 h-5 text-orange-600" /> Credenciales de Acceso
                    </DialogTitle>
                    <DialogDescription>
                        Información de acceso registrada por el cliente.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="bg-slate-50 p-4 rounded-md border border-slate-200 space-y-4">
                        <div className="space-y-1">
                            <Label className="text-xs text-slate-500 uppercase font-semibold tracking-wider">Usuario</Label>
                            <div className="flex items-center gap-2 text-slate-900 font-medium">
                                <User className="w-4 h-4 text-slate-400" />
                                {company?.username || 'No registrado'}
                            </div>
                        </div>
                        
                        <div className="space-y-1">
                            <Label className="text-xs text-green-600 uppercase font-semibold tracking-wider flex items-center gap-1">
                                Contraseña Global (Acceso Total)
                            </Label>
                            <div className="flex items-center gap-2 bg-white p-2 rounded border border-slate-200">
                                <input 
                                    type={showPassword ? "text" : "password"} 
                                    value={company?.password || ''} 
                                    readOnly 
                                    className="bg-transparent border-none w-full text-sm focus:outline-none"
                                />
                                <button onClick={() => setShowPassword(!showPassword)} className="text-slate-400 hover:text-slate-600">
                                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>

                        <div className="space-y-1">
                            <Label className="text-xs text-orange-600 uppercase font-semibold tracking-wider flex items-center gap-1">
                                Contraseña Parcial (Solo lectura)
                            </Label>
                             <div className="flex items-center gap-2 bg-white p-2 rounded border border-slate-200">
                                <input 
                                    type={showPartial ? "text" : "password"} 
                                    value={company?.partialPassword || ''} 
                                    readOnly 
                                    className="bg-transparent border-none w-full text-sm focus:outline-none"
                                />
                                <button onClick={() => setShowPartial(!showPartial)} className="text-slate-400 hover:text-slate-600">
                                    {showPartial ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex justify-end">
                    <DialogClose asChild>
                        <Button variant="secondary">Cerrar</Button>
                    </DialogClose>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default Companies;