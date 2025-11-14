
import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { Plus, Search, Edit2, Trash2, User, Building, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useCompanyData } from '@/hooks/useCompanyData';
import { exportToExcel } from '@/lib/excel';

const Contacts = () => {
  const [contacts, saveContacts] = useCompanyData('contacts');
  const [searchTerm, setSearchTerm] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingContact, setEditingContact] = useState(null);
  const { toast } = useToast();

  const handleSaveContact = (contact) => {
    let updatedContacts;
    if (editingContact) {
      updatedContacts = contacts.map(c => c.id === editingContact.id ? contact : c);
      toast({ title: "¡Contacto actualizado!", description: "Los cambios se guardaron correctamente." });
    } else {
      updatedContacts = [...contacts, { ...contact, id: Date.now().toString() }];
      toast({ title: "¡Contacto creado!", description: "El nuevo contacto se ha guardado." });
    }
    saveContacts(updatedContacts);
    setDialogOpen(false);
    setEditingContact(null);
  };

  const handleDeleteContact = (id) => {
    const updatedContacts = contacts.filter(c => c.id !== id);
    saveContacts(updatedContacts);
    toast({ title: "Contacto eliminado", description: "El contacto fue eliminado." });
  };

  const openDialogForEdit = (contact) => {
    setEditingContact(contact);
    setDialogOpen(true);
  };

  const openDialogForNew = () => {
    setEditingContact(null);
    setDialogOpen(true);
  };

  const handleExport = () => {
    if (contacts.length === 0) {
      toast({ variant: 'destructive', title: "No hay contactos para exportar" });
      return;
    }
    const dataToExport = contacts.map(c => ({
      'Nombre': c.name,
      'Email': c.email,
      'Teléfono': c.phone,
      'Dirección': c.address,
      'Tipo': c.type === 'person' ? 'Persona' : 'Empresa',
      'Tipo Documento': c.docType,
      'Número Documento': c.docNumber
    }));
    exportToExcel(dataToExport, 'Contactos');
    toast({ title: "¡Exportado!", description: "Tus contactos han sido exportados a Excel." });
  };

  const filteredContacts = contacts.filter(c =>
    (c.name && c.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (c.email && c.email.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <>
      <Helmet>
        <title>Contactos - JaiderHerTur26</title>
        <meta name="description" content="Gestiona tus clientes y proveedores" />
      </Helmet>

      <div className="space-y-6">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-4xl font-bold text-slate-900">Contactos</h1>
            <p className="text-slate-600">Gestiona los datos de personas y empresas</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleExport} variant="outline" className="bg-white"><Download className="w-4 h-4 mr-2" />Exportar</Button>
            <Button onClick={openDialogForNew} className="bg-blue-600 hover:bg-blue-700">
              <Plus className="w-4 h-4 mr-2" />
              Nuevo Contacto
            </Button>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-white rounded-xl shadow-lg p-6 border border-slate-200">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Buscar por nombre o email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </motion.div>

        {filteredContacts.length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-16 bg-white rounded-xl shadow-lg border">
            <p className="text-slate-500">No hay contactos guardados.</p>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredContacts.map((contact, index) => (
              <motion.div
                key={contact.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="bg-white rounded-xl shadow-lg p-6 border border-slate-200 hover:shadow-xl transition-shadow flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center mb-4">
                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mr-4">
                      {contact.type === 'person' ? <User className="w-6 h-6 text-blue-600" /> : <Building className="w-6 h-6 text-blue-600" />}
                    </div>
                    <div>
                      <h3 className="font-bold text-lg text-slate-900">{contact.name}</h3>
                      <p className="text-sm text-slate-500">{contact.email}</p>
                    </div>
                  </div>
                  <div className="space-y-1 text-sm text-slate-600 mt-2">
                    <p><strong>Tel:</strong> {contact.phone}</p>
                    <p><strong>Dir:</strong> {contact.address}</p>
                    <p><strong>Doc:</strong> {contact.docType} {contact.docNumber}</p>
                  </div>
                </div>
                <div className="flex gap-2 mt-4">
                  <Button variant="outline" size="sm" onClick={() => openDialogForEdit(contact)} className="flex-1">
                    <Edit2 className="w-4 h-4 mr-2" /> Editar
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleDeleteContact(contact.id)} className="flex-1 hover:bg-red-50 hover:text-red-600">
                    <Trash2 className="w-4 h-4 mr-2" /> Eliminar
                  </Button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      <ContactDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        contact={editingContact}
        onSave={handleSaveContact}
      />
    </>
  );
};

const ContactDialog = ({ open, onOpenChange, contact, onSave }) => {
  const [formData, setFormData] = useState({
    type: 'person', name: '', email: '', phone: '', address: '', docType: 'CC', docNumber: ''
  });

  useEffect(() => {
    if (contact) {
      setFormData({
        type: contact.type || 'person',
        name: contact.name || '',
        email: contact.email || '',
        phone: contact.phone || '',
        address: contact.address || '',
        docType: contact.docType || 'CC',
        docNumber: contact.docNumber || '',
        id: contact.id
      });
    } else {
      setFormData({ type: 'person', name: '', email: '', phone: '', address: '', docType: 'CC', docNumber: '', id: null });
    }
  }, [contact, open]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">{contact ? 'Editar Contacto' : 'Nuevo Contacto'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label>Tipo</Label>
            <select value={formData.type} onChange={(e) => setFormData({ ...formData, type: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg">
              <option value="person">Persona</option>
              <option value="company">Empresa</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="name">Nombre</Label>
            <input id="name" required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="docType">Tipo Documento</Label>
              <select id="docType" value={formData.docType} onChange={(e) => setFormData({ ...formData, docType: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg">
                <option value="CC">C.C.</option>
                <option value="NIT">NIT</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="docNumber">Número Documento</Label>
              <input id="docNumber" value={formData.docNumber} onChange={(e) => setFormData({ ...formData, docNumber: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <input id="email" type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Teléfono</Label>
            <input id="phone" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="address">Dirección</Label>
            <input id="address" value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
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

export default Contacts;
