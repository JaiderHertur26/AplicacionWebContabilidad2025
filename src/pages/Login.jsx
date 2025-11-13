import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { LogIn, User, Lock, Building, Shield } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from '@/components/ui/label';

const Login = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [companies, setCompanies] = useState([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    const storedCompanies = JSON.parse(localStorage.getItem('companies') || '[]');
    setCompanies(storedCompanies);
    if (storedCompanies.length > 0) {
      setSelectedCompanyId(storedCompanies[0].id);
    } else {
      setSelectedCompanyId('general_admin');
    }
  }, []);

  const handleLogin = (e) => {
    e.preventDefault();
    
    if (!selectedCompanyId) {
      toast({ variant: "destructive", title: "Error", description: "Por favor, selecciona una opción." });
      return;
    }

    if (selectedCompanyId === 'general_admin') {
      if (username === 'hertur26' && password === '1052042443-Ht') {
        toast({ title: "¡Hola, Administrador!", description: "Has iniciado sesión correctamente." });
        onLogin({ isGeneralAdmin: true });
      } else {
        toast({ variant: "destructive", title: "Acceso Denegado", description: "Credenciales de administrador incorrectas." });
      }
      return;
    }

    const companyToLogin = companies.find(c => c.id === selectedCompanyId);
    if (companyToLogin && companyToLogin.username === username && companyToLogin.password === password) {
      toast({ title: `¡Bienvenido a ${companyToLogin.name}!`, description: "Has iniciado sesión correctamente." });
      onLogin({ isGeneralAdmin: false, company: companyToLogin });
    } else {
      toast({ variant: "destructive", title: "Error de inicio de sesión", description: "Usuario o contraseña incorrectos para la empresa seleccionada." });
    }
  };

  return (
    <>
      <Helmet><title>Iniciar Sesión - JaiderHerTur26</title></Helmet>
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 via-blue-100 to-slate-200 p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-8 space-y-8 border border-slate-200"
        >
          <div className="text-center">
            <div className="mx-auto w-16 h-16 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg flex items-center justify-center shadow-lg mb-4">
              <span className="text-white font-bold text-3xl">J</span>
            </div>
            <h1 className="text-3xl font-bold text-slate-900">Bienvenido a JaiderHerTur26</h1>
            <p className="text-slate-600 mt-2">Ingresa tus credenciales para continuar</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
               <Label>Acceder como</Label>
               <Select onValueChange={setSelectedCompanyId} value={selectedCompanyId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecciona una opción" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="general_admin">
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4 text-blue-600"/> Administrador General
                    </div>
                  </SelectItem>
                  {companies.map(company => (
                    <SelectItem key={company.id} value={company.id}>
                      <div className="flex items-center gap-2">
                        <Building className="w-4 h-4 text-slate-500"/> {company.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
               </Select>
            </div>

            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
              <input type="text" placeholder="Usuario" value={username} onChange={(e) => setUsername(e.target.value)} required className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition" />
            </div>

            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
              <input type="password" placeholder="Contraseña" value={password} onChange={(e) => setPassword(e.target.value)} required className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition" />
            </div>
            
            <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-lg py-3">
              <LogIn className="w-5 h-5 mr-2" />
              Iniciar Sesión
            </Button>
          </form>
        </motion.div>
      </div>
    </>
  );
};

export default Login;