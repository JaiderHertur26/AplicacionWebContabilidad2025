// src/App.jsx
import React, { useState, useEffect, createContext, useContext } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import Layout from '@/components/Layout';
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
import { Toaster } from '@/components/ui/toaster';
import { useCompanyData } from '@/hooks/useCompanyData';
import { loadLocalStorageFromGitHub } from './lib/loadLocalStorageFromGitHub';
import { syncLocalStorage } from './lib/syncLocalStorage';
import SelectorEmpresa from './components/SelectorEmpresa';
import FormularioTransaccion from './components/FormularioTransaccion';
import ListaTransacciones from './components/ListaTransacciones';
import { getActiveCompany } from './utils/storage';
import { getTransactions, saveTransactions } from './utils/storage';

const CompanyContext = createContext();
export const useCompany = () => useContext(CompanyContext);

// Inicialización de cuentas obligatorias
const InitialAccountsSetup = ({ children }) => {
  const { activeCompany } = useCompany();
  const [accounts, saveAccounts, isAccountsLoaded] = useCompanyData('accounts');

  useEffect(() => {
    if (activeCompany && isAccountsLoaded) {
      const requiredAccounts = [
        { number: '110505', name: 'CAJA GENERAL' },
        { number: '11050501', name: 'CAJA PRINCIPAL' },
        { number: '1120', name: 'CUENTAS DE AHORRO' },
        { number: '13050505', name: 'CUENTAS POR COBRAR' },
        { number: '23', name: 'CUENTAS POR PAGAR' }
      ];

      if (accounts.length === 0) {
        const newAccounts = requiredAccounts.map(reqAcc => ({
          id: `${Date.now()}-${reqAcc.number}`,
          number: reqAcc.number,
          name: reqAcc.name,
        }));
        saveAccounts(newAccounts.sort((a, b) => a.number.localeCompare(b.number)));
      }
    }
  }, [activeCompany, accounts, saveAccounts, isAccountsLoaded]);

  return isAccountsLoaded || !activeCompany ? children : null;
};

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activeCompany, setActiveCompany] = useState(getActiveCompany());
  const [companies, setCompanies] = useState(JSON.parse(localStorage.getItem('companies') || '[]'));
  const [isGeneralAdmin, setIsGeneralAdmin] = useState(false);
  const [isStorageLoaded, setIsStorageLoaded] = useState(false);
  const [transactions, setTransactions] = useState(getTransactions());

  // 🔹 Cargar localStorage desde GitHub al inicio
  useEffect(() => {
    const loadStorage = async () => {
      await loadLocalStorageFromGitHub();
      setIsStorageLoaded(true);
    };
    loadStorage();
  }, []);

  // 🔹 Leer sesión después de cargar localStorage
  useEffect(() => {
    if (!isStorageLoaded) return;

    const session = localStorage.getItem('auth_session');
    if (session) {
      if (session === 'general_admin') {
        setIsAuthenticated(true);
        setIsGeneralAdmin(true);
      } else {
        const loggedInCompany = companies.find(c => c.id === session);
        if (loggedInCompany) {
          setActiveCompany(loggedInCompany);
          setTransactions(getTransactions());
          setIsAuthenticated(true);
        } else {
          localStorage.removeItem('auth_session');
        }
      }
    }
  }, [isStorageLoaded, companies]);

  // 🔹 Manejo de login
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
      setTransactions(getTransactions());
    }
    syncLocalStorage();
  };

  // 🔹 Manejo de logout
  const handleLogout = () => {
    setIsAuthenticated(false);
    setIsGeneralAdmin(false);
    setActiveCompany(null);
    setTransactions([]);
    localStorage.removeItem('auth_session');
  };

  // 🔹 Selección de empresa
  const selectCompany = (company) => {
    if (isGeneralAdmin) return;
    if (company.id !== activeCompany?.id) {
      setActiveCompany(company);
      localStorage.setItem('auth_session', company.id);
      setTransactions(getTransactions());
      syncLocalStorage();
    }
  };

  // 🔹 Guardar transacciones y sincronizar
  const addTransaction = (transaction) => {
    const newTransactions = [...transactions, transaction];
    setTransactions(newTransactions);
    saveTransactions(newTransactions);
    syncLocalStorage();
  };

  const companyContextValue = {
    activeCompany,
    selectCompany,
    companies,
    setCompanies,
    isGeneralAdmin,
    transactions,
    addTransaction
  };

  const MainApp = () => (
    <Layout onLogout={handleLogout}>
      <InitialAccountsSetup>
        <div className="max-w-xl mx-auto mt-6">
          <SelectorEmpresa companies={companies} />
          <h2 className="mb-4 text-lg font-semibold">
            Empresa activa: {activeCompany?.name || 'Ninguna'}
          </h2>
          <FormularioTransaccion />
          <ListaTransacciones />
        </div>
        <Routes>
          <Route path="/" element={isGeneralAdmin ? <Navigate to="/companies" /> : <Dashboard />} />
          <Route path="/companies" element={<Companies />} />
          <Route path="/settings" element={<Settings />} />
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
