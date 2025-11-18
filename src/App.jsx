// App.jsx
import React, { useState, useEffect, createContext, useContext } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';

import Layout from '@/components/Layout';
import { Toaster } from '@/components/ui/toaster';

// Pages
import Dashboard from '@/pages/Dashboard';
import Transactions from '@/pages/Transactions';
import Reports from '@/pages/Reports';
import Contacts from '@/pages/Contacts';
import Accounts from '@/pages/Accounts';
import BankAccounts from '@/pages/BankAccounts';
import BookClosings from '@/pages/BookClosings';
import Settings from '@/pages/Settings';
import Login from '@/pages/Login';
import Companies from '@/pages/Companies';
import FixedAssets from '@/pages/FixedAssets';
import RealEstates from '@/pages/RealEstates';
import TaxReports from '@/pages/TaxReports';
import AccountsReceivable from '@/pages/AccountsReceivable';
import AccountsPayable from '@/pages/AccountsPayable';

// Hooks
import { useCompanyData } from '@/hooks/useCompanyData';

// -----------------------------------------------------
// CONTEXTO GLOBAL DE LA EMPRESA ACTIVA
// -----------------------------------------------------
const CompanyContext = createContext();
export const useCompany = () => useContext(CompanyContext);

// -----------------------------------------------------
// CONFIGURACIÓN AUTOMÁTICA DE CUENTAS
// -----------------------------------------------------
const InitialAccountsSetup = ({ children }) => {
  const { activeCompany } = useCompany();
  const [accounts, saveAccounts, isLoaded] = useCompanyData('accounts');

  useEffect(() => {
    if (!activeCompany || !isLoaded) return;

    const requiredAccounts = [
      { number: '110505', name: 'CAJA GENERAL' },
      { number: '11050501', name: 'CAJA PRINCIPAL' },
      { number: '1120', name: 'CUENTAS DE AHORRO' },
      { number: '13050505', name: 'CUENTAS POR COBRAR' },
      { number: '23', name: 'CUENTAS POR PAGAR' }
    ];

    if (accounts.length === 0) {
      const newAccounts = requiredAccounts.map(acc => ({
        id: `${Date.now()}-${acc.number}`,
        number: acc.number,
        name: acc.name,
      }));

      saveAccounts(newAccounts.sort((a, b) => a.number.localeCompare(b.number)));
    }
  }, [activeCompany, accounts, saveAccounts, isLoaded]);

  return isLoaded || !activeCompany ? children : null;
};

// -----------------------------------------------------
// APLICACIÓN PRINCIPAL
// -----------------------------------------------------
function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activeCompany, setActiveCompany] = useState(null);
  const [companies, setCompanies] = useState([]);
  const [isGeneralAdmin, setIsGeneralAdmin] = useState(false);

  // -------------------------------------------------
  //  Cargar sesión al iniciar
  // -------------------------------------------------
  useEffect(() => {
    const session = localStorage.getItem('auth_session');
    if (!session) return;

    const storedCompanies = JSON.parse(localStorage.getItem('companies') || '[]');
    setCompanies(storedCompanies);

    if (session === 'general_admin') {
      setIsAuthenticated(true);
      setIsGeneralAdmin(true);
      return;
    }

    const found = storedCompanies.find(c => c.id === session);
    if (found) {
      setActiveCompany(found);
      setIsAuthenticated(true);
      setIsGeneralAdmin(false);
    } else {
      localStorage.removeItem('auth_session');
    }
  }, []);

  // -------------------------------------------------
  //  LOGIN
  // -------------------------------------------------
  const handleLogin = (loginData) => {
    setIsAuthenticated(true);

    if (loginData.isGeneralAdmin) {
      setIsGeneralAdmin(true);
      setActiveCompany(null);
      localStorage.setItem('auth_session', 'general_admin');
    } else {
      setIsGeneralAdmin(false);
      setActiveCompany(loginData.company);
      localStorage.setItem('auth_session', loginData.company.id);
    }

    const stored = JSON.parse(localStorage.getItem('companies') || '[]');
    setCompanies(stored);
  };

  // -------------------------------------------------
  // LOGOUT
  // -------------------------------------------------
  const handleLogout = () => {
    setIsAuthenticated(false);
    setIsGeneralAdmin(false);
    setActiveCompany(null);
    localStorage.removeItem('auth_session');
  };

  // -------------------------------------------------
  // Seleccionar empresa (desde Companies.jsx)
  // -------------------------------------------------
  const selectCompany = (company) => {
    if (isGeneralAdmin) return;

    if (company.id !== activeCompany?.id) {
       handleLogout();
    }
  };

  const companyContextValue = {
    activeCompany,
    selectCompany,
    companies,
    setCompanies,
    isGeneralAdmin,
  };

  // -------------------------------------------------
  // Rutas internas (modo autenticado)
  // -------------------------------------------------
  const MainApp = () => (
    <Layout onLogout={handleLogout}>
      <InitialAccountsSetup>
        <Routes>
          <Route path="/" element={isGeneralAdmin ? <Navigate to="/companies" /> : <Dashboard />} />

          <Route path="/companies" element={<Companies />} />
          <Route path="/settings" element={<Settings />} />

          {/* Rutas solo para usuario normal */}
          <Route path="/transactions" element={!isGeneralAdmin ? <Transactions /> : <Navigate to="/companies" />} />
          <Route path="/bank-accounts" element={!isGeneralAdmin ? <BankAccounts /> : <Navigate to="/companies" />} />
          <Route path="/fixed-assets" element={!isGeneralAdmin ? <FixedAssets /> : <Navigate to="/companies" />} />
          <Route path="/real-estates" element={!isGeneralAdmin ? <RealEstates /> : <Navigate to="/companies" />} />
          <Route path="/reports" element={!isGeneralAdmin ? <Reports /> : <Navigate to="/companies" />} />
          <Route path="/tax-reports" element={!isGeneralAdmin ? <TaxReports /> : <Navigate to="/companies" />} />
          <Route path="/contacts" element={!isGeneralAdmin ? <Contacts /> : <Navigate to="/companies" />} />
          <Route path="/accounts" element={!isGeneralAdmin ? <Accounts /> : <Navigate to="/companies" />} />
          <Route path="/book-closings" element={!isGeneralAdmin ? <BookClosings /> : <Navigate to="/companies" />} />
          <Route path="/accounts-receivable" element={!isGeneralAdmin ? <AccountsReceivable /> : <Navigate to="/companies" />} />
          <Route path="/accounts-payable" element={!isGeneralAdmin ? <AccountsPayable /> : <Navigate to="/companies" />} />

          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </InitialAccountsSetup>
    </Layout>
  );

  // -------------------------------------------------
  // Render final
  // -------------------------------------------------
  return (
    <>
      <Helmet>
        <title>JaiderHerTur26 - Sistema de Contabilidad</title>
        <meta name="description" content="Gestiona tu contabilidad de forma profesional con JaiderHerTur26." />
      </Helmet>

      <CompanyContext.Provider value={companyContextValue}>
        <Router>
          <Toaster />
          {!isAuthenticated ? (
            <Routes>
              <Route path="/login" element={<Login onLogin={handleLogin} />} />
              <Route path="*" element={<Navigate to="/login" />} />
            </Routes>
          ) : (
            <MainApp />
          )}
        </Router>
      </CompanyContext.Provider>
    </>
  );
}

export default App;
