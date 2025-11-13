import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { Plus, Edit2, Trash2, Building, ArrowBigRightDash, User, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useCompany } from '@/App';

const Companies = () => {
    const { companies, setCompanies, isGeneralAdmin, activeCompany } = useCompany();
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingCompany, setEditingCompany] = useState(null);
    const [parentCompany, setParentCompany] = useState(null);
    const { toast } = useToast();

    const persistCompanies = (updatedCompanies) => {
        localStorage.setItem('companies', JSON.stringify(updatedCompanies));
        setCompanies(updatedCompanies);
    };

    const handleSaveCompany = (companyData) => {
        let updated;
        if (editingCompany) {
            updated = companies.map(c => c.id === editingCompany.id ? { ...c, ...companyData } : c);
            toast({ title: "Empresa actualizada" });
        } else {
            if (!isGeneralAdmin) {
                toast({ variant: 'destructive', title: "Error", description: "No tienes permiso para crear empresas." });
                return;
            }
            const newCompany = { 
                ...companyData, 
                id: Date.now().toString(),
                parentId: parentCompany ? parentCompany.id : null,
                doc: parentCompany ? parentCompany.doc : companyData.doc // Inherit doc for sub-companies
            };
            updated = [...companies, newCompany];
            toast({ title: parentCompany ? "Sub-empresa creada" : "Empresa creada" });
        }
        persistCompanies(updated);
        setDialogOpen(false);
        setParentCompany(null);
        setEditingCompany(null);
    };

    const handleDeleteCompany = (id) => {
        if (!isGeneralAdmin) {
            toast({ variant: 'destructive', title: "Error", description: "No tienes permiso para eliminar empresas." });
            return;
        }
        const companyToDelete = companies.find(c => c.id === id);
        const isParent = companies.some(c => c.parentId === id);
        if (isParent) {
            toast({ variant: 'destructive', title: "Error", description: "No se puede eliminar una empresa con sub-empresas." });
            return;
        }

        const companyCount = companies.filter(c => !c.parentId).length;
        if (companyCount <= 1 && !companyToDelete.parentId) {
            toast({ variant: 'destructive', title: "Acción no permitida", description: "Debe haber al menos una empresa principal." });
            return;
        }
        persistCompanies(companies.filter(c => c.id !== id));
        toast({ title: "Empresa eliminada" });
    };

    const openNewDialog = (parent = null) => {
        setEditingCompany(null);
        setParentCompany(parent);
        setDialogOpen(true);
    };

    const openEditDialog = (company) => {
        setEditingCompany(company);
        const parent = company.parentId ? companies.find(c => c.id === company.parentId) : null;
        setParentCompany(parent);
        setDialogOpen(true);
    };
    
    // Admin sees all parent companies. Regular user sees only their active company.
    const displayCompanies = isGeneralAdmin ? companies.filter(c => !c.parentId) : (activeCompany ? [companies.find(c => c.id === activeCompany.id)].filter(Boolean) : []);

    return (
        <>
        <Helmet><title>Gestionar Empresas - JaiderHerTur26</title></Helmet>
        <div className="max-w-4xl mx-auto space-y-6">
            <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex justify-between items-center">
                <div><h1 className="text-4xl font-bold text-slate-900">{isGeneralAdmin ? "Gestionar Empresas" : "Mi Empresa"}</h1><p className="text-slate-600">{isGeneralAdmin ? "Añade, edita y gestiona las empresas y sub-empresas." : "Revisa y edita la información de tu empresa."}</p></div>
                {isGeneralAdmin && <Button onClick={() => openNewDialog()} className="bg-blue-600 hover:bg-blue-700"><Plus className="w-4 h-4 mr-2" /> Nueva Empresa</Button>}
            </motion.div>

            {displayCompanies.length === 0 ? (
                 <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-16 bg-white rounded-xl shadow-lg border">
                    <Building className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                    <p className="text-slate-500 text-lg">{isGeneralAdmin ? "Aún no has creado ninguna empresa." : "No se encontró información de la empresa."}</p>
                </motion.div>
            ) : (
                <div className="bg-white rounded-xl shadow-lg border overflow-hidden">
                    <ul className="divide-y divide-slate-200">
                        {displayCompanies.map((pCompany, index) => {
                            const subCompanies = companies.filter(c => c.parentId === pCompany.id);
                            return (
                                <li key={pCompany.id} className="p-4">
                                    <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.1 }} className="flex justify-between items-center">
                                        <div className="flex items-center">
                                            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mr-4"><Building className="w-5 h-5 text-blue-600" /></div>
                                            <span className="font-semibold text-slate-800">{pCompany.name} <span className="text-xs text-slate-500">({pCompany.doc})</span></span>
                                        </div>
                                        <div className="flex gap-2">
                                            {isGeneralAdmin && <Button variant="outline" size="sm" onClick={() => openNewDialog(pCompany)}><Plus className="w-4 h-4 mr-2" /> Sub-empresa</Button>}
                                            <Button variant="ghost" size="icon" onClick={() => openEditDialog(pCompany)}><Edit2 className="w-4 h-4" /></Button>
                                            {isGeneralAdmin && <Button variant="ghost" size="icon" onClick={() => handleDeleteCompany(pCompany.id)} className="hover:bg-red-50 hover:text-red-600"><Trash2 className="w-4 h-4" /></Button>}
                                        </div>
                                    </motion.div>
                                    {isGeneralAdmin && subCompanies.length > 0 && (
                                        <ul className="mt-4 pl-10 space-y-2">
                                            {subCompanies.map(sCompany => (
                                                <li key={sCompany.id} className="flex justify-between items-center p-2 rounded-lg bg-slate-50">
                                                    <div className="flex items-center">
                                                        <ArrowBigRightDash className="w-4 h-4 mr-3 text-slate-400" />
                                                        <span className="font-medium text-slate-700">{sCompany.name}</span>
                                                    </div>
                                                    <div className="flex gap-1">
                                                        <Button variant="ghost" size="icon" onClick={() => openEditDialog(sCompany)}><Edit2 className="w-4 h-4" /></Button>
                                                        {isGeneralAdmin && <Button variant="ghost" size="icon" onClick={() => handleDeleteCompany(sCompany.id)} className="hover:bg-red-50 hover:text-red-600"><Trash2 className="w-4 h-4" /></Button>}
                                                    </div>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                </div>
            )}
        </div>
        <CompanyDialog open={dialogOpen} onOpenChange={(isOpen) => { if (!isOpen) { setParentCompany(null); setEditingCompany(null); } setDialogOpen(isOpen); }} onSave={handleSaveCompany} company={editingCompany} parentCompany={parentCompany} isGeneralAdmin={isGeneralAdmin} />
        </>
    );
};

const CompanyDialog = ({ open, onOpenChange, onSave, company, parentCompany, isGeneralAdmin }) => {
    const [formData, setFormData] = useState({ name: '', doc: '', address: '', phone: '', username: '', password: '' });

    useEffect(() => {
        if(open) {
            if (company) {
                setFormData({ ...company });
            } else if (parentCompany) {
                 setFormData({ name: '', doc: parentCompany.doc || '', address: '', phone: '', username: '', password: '' });
            } else {
                 setFormData({ name: '', doc: '', address: '', phone: '', username: '', password: '' });
            }
        }
    }, [company, parentCompany, open]);

    const handleSubmit = (e) => { e.preventDefault(); onSave(formData); };
    
    // Only General Admin can edit credentials.
    // Regular users can only edit non-credential fields.
    const canEditCredentials = isGeneralAdmin;

    return(
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader><DialogTitle>{company ? 'Editar' : (parentCompany ? 'Nueva Sub-Empresa' : 'Nueva Empresa')}</DialogTitle></DialogHeader>
                <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-4 pt-4">
                    <div className="md:col-span-2 space-y-2"><Label htmlFor="name">Nombre de la Empresa</Label><input id="name" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full px-3 py-2 border rounded-lg" /></div>
                    <div className="space-y-2"><Label htmlFor="doc">NIT o Documento</Label><input id="doc" required value={formData.doc} onChange={e => setFormData({...formData, doc: e.target.value})} className="w-full px-3 py-2 border rounded-lg" disabled={!!parentCompany} /></div>
                    <div className="space-y-2"><Label htmlFor="address">Dirección</Label><input id="address" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} className="w-full px-3 py-2 border rounded-lg" /></div>
                    <div className="md:col-span-2 space-y-2"><Label htmlFor="phone">Teléfono</Label><input id="phone" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full px-3 py-2 border rounded-lg" /></div>
                    
                    <div className="md:col-span-2 border-t pt-4 mt-2 grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="username">Usuario</Label>
                        <div className="relative"><User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" /><input id="username" placeholder="ej: admin" required value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} className="w-full pl-9 px-3 py-2 border rounded-lg disabled:bg-slate-100" disabled={!canEditCredentials} /></div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="password">Contraseña</Label>
                        <div className="relative"><Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" /><input id="password" type="password" placeholder="••••••••" required value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} className="w-full pl-9 px-3 py-2 border rounded-lg disabled:bg-slate-100" disabled={!canEditCredentials} /></div>
                      </div>
                    </div>

                    <div className="md:col-span-2 flex justify-end gap-2 pt-4"><DialogClose asChild><Button type="button" variant="outline">Cancelar</Button></DialogClose><Button type="submit" className="bg-blue-600 hover:bg-blue-700">Guardar</Button></div>
                </form>
            </DialogContent>
        </Dialog>
    );
};

export default Companies;