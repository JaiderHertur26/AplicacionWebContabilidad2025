import React, { useState } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { Building, Plus, Network, Trash2, ShieldCheck, MapPin, Phone, User, Lock, Info, Edit2, Key, CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCompany } from '@/App';
import { useToast } from '@/components/ui/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

const Organization = () => {
    const { activeCompany, companies, setCompanies } = useCompany();
    const { toast } = useToast();
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingId, setEditingId] = useState(null);
    
    // Form State
    const [formData, setFormData] = useState({
        name: '',
        address: '',
        phone: '',
        username: '',
        password: '',
        partialPassword: ''
    });

    const subCompanies = companies.filter(c => c.parentId === activeCompany?.id);

    const handleDelete = (id) => {
        if (window.confirm('¿Estás seguro de eliminar esta sub-empresa? Se perderán sus datos permanentemente.')) {
            const updated = companies.filter(c => c.id !== id);
            setCompanies(updated);
            localStorage.setItem('companies', JSON.stringify(updated));
            toast({ title: "Sub-empresa eliminada" });
        }
    };

    const handleOpenCreate = () => {
        setEditingId(null);
        setFormData({
            name: '',
            address: '',
            phone: '',
            username: '',
            password: '',
            partialPassword: ''
        });
        setIsDialogOpen(true);
    };

    const handleOpenEdit = (subCompany) => {
        setEditingId(subCompany.id);
        setFormData({
            name: subCompany.name || '',
            address: subCompany.address || '',
            phone: subCompany.phone || '',
            username: subCompany.username || '',
            password: subCompany.password || '',
            partialPassword: subCompany.partialPassword || ''
        });
        setIsDialogOpen(true);
    };

    const handleSave = async (e) => {
        e.preventDefault();
        
        // Validations
        if (!formData.name.trim() || !formData.username.trim() || !formData.password.trim()) {
             toast({ variant: "destructive", title: "Datos incompletos", description: "Nombre, Usuario y Contraseña Global son obligatorios." });
             return;
        }

        // Check if username is already taken (exclude current company if editing)
        const isDuplicateUser = companies.some(c => c.username === formData.username && c.id !== editingId);
        if (isDuplicateUser) {
             toast({ variant: "destructive", title: "Usuario no disponible", description: "Este nombre de usuario ya está en uso." });
             return;
        }

        let updatedCompanies;

        if (editingId) {
            // Edit Existing
            updatedCompanies = companies.map(c => c.id === editingId ? {
                ...c,
                ...formData,
                // Ensure inherited fields stay consistent with parent just in case
                doc: activeCompany.doc,
                authSerial: activeCompany.authSerial
            } : c);
            toast({ title: "Sub-empresa actualizada", description: "Los cambios han sido guardados." });
        } else {
            // Create New
            const newCompany = {
                id: Date.now().toString(),
                parentId: activeCompany.id,
                isRoot: false,
                doc: activeCompany.doc,           // Inherits Document from Parent
                authSerial: activeCompany.authSerial, // Inherits Serial from Parent
                ...formData
            };
            updatedCompanies = [...companies, newCompany];
            toast({ title: "Sub-empresa creada", description: `${formData.name} se ha vinculado exitosamente.` });
        }

        setCompanies(updatedCompanies);
        localStorage.setItem('companies', JSON.stringify(updatedCompanies));
        setIsDialogOpen(false);
    };

    return (
        <>
            <Helmet><title>Mi Organización - JaiderHerTur26</title></Helmet>
            <div className="max-w-6xl mx-auto space-y-8">
                <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div>
                            <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-2">
                                <Network className="w-8 h-8 text-blue-600" /> Mi Organización
                            </h1>
                            <p className="text-slate-600 mt-1">Gestión de sucursales y sub-empresas vinculadas.</p>
                        </div>
                        
                        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                            <DialogTrigger asChild>
                                <Button onClick={handleOpenCreate} className="bg-blue-600 hover:bg-blue-700 shadow-lg">
                                    <Plus className="w-4 h-4 mr-2" /> Nueva Sub-empresa
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
                                <DialogHeader>
                                    <DialogTitle>{editingId ? 'Editar Sub-empresa' : 'Crear Nueva Sub-empresa'}</DialogTitle>
                                    <DialogDescription>
                                        Configure los detalles y credenciales de la sucursal.
                                    </DialogDescription>
                                </DialogHeader>
                                <form onSubmit={handleSave} className="space-y-6 py-4">
                                    
                                    {/* Inherited Info Section */}
                                    <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                                        <div className="flex items-center gap-2 mb-3 text-slate-800 font-semibold text-sm">
                                            <Info className="w-4 h-4 text-blue-500" />
                                            Información Heredada (Principal)
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-1.5">
                                                <Label className="text-xs text-slate-500 font-medium uppercase">NIT / Documento</Label>
                                                <div className="flex items-center gap-2 px-3 py-2 bg-slate-100 border border-slate-200 rounded-md text-slate-600 font-mono text-sm">
                                                    <CreditCard className="w-4 h-4 text-slate-400" />
                                                    {activeCompany?.doc}
                                                </div>
                                            </div>
                                            <div className="space-y-1.5">
                                                <Label className="text-xs text-slate-500 font-medium uppercase">Serial de Autenticación</Label>
                                                <div className="flex items-center gap-2 px-3 py-2 bg-slate-100 border border-slate-200 rounded-md text-slate-600 font-mono text-sm truncate">
                                                    <Key className="w-4 h-4 text-slate-400" />
                                                    <span className="truncate">{activeCompany?.authSerial}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Basic Info Section */}
                                    <div className="space-y-4">
                                        <div className="space-y-2">
                                            <Label>Nombre de la Sucursal / Sub-empresa</Label>
                                            <div className="relative">
                                                <Building className="absolute left-3 top-3 text-slate-400 w-4 h-4" />
                                                <input required className="w-full pl-9 p-2 border rounded-md text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Ej: Sucursal Norte, Bodega Principal..." value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label>Dirección</Label>
                                                <div className="relative">
                                                    <MapPin className="absolute left-3 top-3 text-slate-400 w-4 h-4" />
                                                    <input className="w-full pl-9 p-2 border rounded-md text-sm focus:ring-2 focus:ring-blue-500 outline-none" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} />
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Teléfono</Label>
                                                <div className="relative">
                                                    <Phone className="absolute left-3 top-3 text-slate-400 w-4 h-4" />
                                                    <input className="w-full pl-9 p-2 border rounded-md text-sm focus:ring-2 focus:ring-blue-500 outline-none" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Credentials Section */}
                                    <div className="bg-slate-50 p-4 rounded-lg border space-y-4">
                                        <h4 className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                                            <ShieldCheck className="w-3 h-3" /> Credenciales de Acceso
                                        </h4>
                                        <div className="space-y-4">
                                            <div className="space-y-2">
                                                <Label>Usuario Administrador</Label>
                                                <div className="relative">
                                                    <User className="absolute left-3 top-3 text-slate-400 w-4 h-4" />
                                                    <input required className="w-full pl-9 p-2 border rounded-md text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none" value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} placeholder="Usuario único" />
                                                </div>
                                            </div>
                                            
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <Label className="text-green-700 font-medium flex items-center gap-1.5">
                                                        <Lock className="w-3 h-3" /> Contraseña Global
                                                    </Label>
                                                    <input required type="password" className="w-full p-2 border border-green-200 rounded-md text-sm bg-white focus:ring-2 focus:ring-green-500 outline-none" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} placeholder="Acceso Total" />
                                                    <p className="text-[10px] text-slate-500">Permite gestión completa.</p>
                                                </div>
                                                <div className="space-y-2">
                                                    <Label className="text-orange-700 font-medium flex items-center gap-1.5">
                                                        <Lock className="w-3 h-3" /> Contraseña Parcial
                                                    </Label>
                                                    <input type="password" className="w-full p-2 border border-orange-200 rounded-md text-sm bg-white focus:ring-2 focus:ring-orange-500 outline-none" value={formData.partialPassword} onChange={e => setFormData({...formData, partialPassword: e.target.value})} placeholder="Acceso Restringido" />
                                                    <p className="text-[10px] text-slate-500">Permite agregar registros pero no editar/borrar.</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="pt-2 flex justify-end gap-2">
                                        <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
                                        <Button type="submit" className="bg-green-600 hover:bg-green-700">
                                            {editingId ? 'Guardar Cambios' : 'Crear Sub-empresa'}
                                        </Button>
                                    </div>
                                </form>
                            </DialogContent>
                        </Dialog>
                    </div>
                </motion.div>

                {/* Tree View or List View */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Parent Card */}
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 shadow-sm relative">
                        <div className="absolute -top-3 -left-3 bg-blue-600 text-white p-2 rounded-lg shadow-md">
                            <Building className="w-6 h-6" />
                        </div>
                        <div className="ml-8">
                            <h3 className="text-lg font-bold text-blue-900">{activeCompany?.name}</h3>
                            <p className="text-sm text-blue-700">Empresa Principal (Matriz)</p>
                            <div className="mt-4 space-y-2 text-sm text-blue-800">
                                <div className="flex items-center gap-2"><MapPin className="w-4 h-4"/> {activeCompany?.address || 'Sin dirección'}</div>
                                <div className="flex items-center gap-2"><Phone className="w-4 h-4"/> {activeCompany?.phone || 'Sin teléfono'}</div>
                                <div className="flex items-center gap-2 pt-2 border-t border-blue-200 mt-2 text-xs font-mono opacity-75">NIT: {activeCompany?.doc}</div>
                            </div>
                        </div>
                    </div>

                    {/* Sub Companies List */}
                    <div className="space-y-4">
                        <h4 className="font-semibold text-slate-500 text-sm uppercase tracking-wider">Sub-empresas Vinculadas</h4>
                        {subCompanies.length === 0 ? (
                            <div className="text-center p-8 bg-slate-50 rounded-xl border border-dashed border-slate-300">
                                <Network className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                                <p className="text-slate-500">No hay sub-empresas registradas.</p>
                            </div>
                        ) : (
                            subCompanies.map(sub => (
                                <motion.div 
                                    key={sub.id}
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    className="bg-white border border-slate-200 rounded-xl p-4 hover:shadow-md transition-all group"
                                >
                                    <div className="flex justify-between items-start">
                                        <div className="flex gap-3">
                                            <div className="bg-indigo-100 text-indigo-600 p-2 rounded-lg h-fit">
                                                <Building className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-slate-900">{sub.name}</h3>
                                                <p className="text-xs text-slate-500">Sucursal de: <span className="font-semibold">{activeCompany?.name}</span></p>
                                                <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1 text-sm text-slate-600">
                                                    <span className="flex items-center gap-1"><User className="w-3 h-3 text-slate-400"/> {sub.username}</span>
                                                    <span className="flex items-center gap-1"><Lock className="w-3 h-3 text-slate-400"/> ••••••</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex gap-1">
                                            <Button 
                                                variant="ghost" 
                                                size="icon" 
                                                className="text-slate-400 hover:text-blue-600 hover:bg-blue-50"
                                                onClick={() => handleOpenEdit(sub)}
                                                title="Editar información"
                                            >
                                                <Edit2 className="w-4 h-4" />
                                            </Button>
                                            <Button 
                                                variant="ghost" 
                                                size="icon" 
                                                className="text-slate-400 hover:text-red-600 hover:bg-red-50"
                                                onClick={() => handleDelete(sub.id)}
                                                title="Eliminar sub-empresa"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </div>
                                </motion.div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </>
    );
};

export default Organization;