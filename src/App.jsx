// ===============================
//  APP.JS con AUTOGUARDADO AUTOMÁTICO
// ===============================

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

// 🔥 Importar snapshots
import {
  saveSnapshotGlobal,
  saveSnapshotEmpresa,
  loadSnapshotGlobal,
  loadSnapshotEmpresa
} from "./lib/snapshots";

const CompanyContext = createContext();
export const useCompany = () => useContext(CompanyContext);

// ======================================
// Inicialización automática de cuentas
// ======================================
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

// =============================================================
// ========================= APP ===============================
// =============================================================
function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activeCompany, setActiveCompany] = useState(null);
  const [companies, setCompanies] = useState([]);
  const [isGeneralAdmin, setIsGeneralAdmin] = useState(false);

  // Estados para snapshots
  const [globalData, setGlobalData] = useState(null);
  const [empresaData, setEmpresaData] = useState(null);
  const empresaId = activeCompany ? activeCompany.id : null;

  // ===============================
  // Cargar sesión
  // ===============================
  useEffect(() => {
    const session = localStorage.getItem('auth_session');
    if (session) {
      if (session === 'general_admin') {
        setIsAuthenticated(true);
        setIsGeneralAdmin(true);
        setCompanies(JSON.parse(localStorage.getItem('companies') || '[]'));
      } else {
        const storedCompanies = JSON.parse(localStorage.getItem('companies') || '[]');
        const loggedInCompany = storedCompanies.find(c => c.id === session);
        if (loggedInCompany) {
          setCompanies(storedCompanies);
          setActiveCompany(loggedInCompany);
          setIsAuthenticated(true);
        } else {
          localStorage.removeItem('auth_session');
        }
      }
    }
  }, []);

  // =============================================================
  // CARGA snapshots automáticos al iniciar
  // =============================================================
  useEffect(() => {
    async function load() {
      try {
        const global = await loadSnapshotGlobal();
        setGlobalData(global);

        if (empresaId) {
          const empresa = await loadSnapshotEmpresa(empresaId);
          setEmpresaData(empresa);
        }
      } catch (err) {
        console.log("No hay snapshots aún");
      }
    }

    if (isAuthenticated) load();
  }, [isAuthenticated, empresaId]);

  // =============================================================
  // 🔥 AUTOGUARDADO AUTOMÁTICO CADA 8 SEGUNDOS
  // =============================================================
  useEffect(() => {
    if (!isAuthenticated) return;

    const interval = setInterval(() => {
      if (globalData) saveSnapshotGlobal(globalData);
      if (empresaId && empresaData) saveSnapshotEmpresa(empresaId, empresaData);
    }, 8000); // 8 segundos

    return () => clearInterval(interval);
  }, [globalData, empresaData, empresaId, isAuthenticated]);

  // =============================================================
  // LOGIN
  // =============================================================
  const handleLogin = (loginData) => {
    setIsAuthenticated(true);

    if (loginData.isGeneralAdmin) {
      setIsGeneralAdmin(true);
      localStorage.setItem('auth_session', 'general_admin');
      setActiveCompany(null);
    } else {
      setIsGeneralAdmin(false);
      setActiveCompany(loginData.company);
      localStorage.setItem('auth_session', loginData.company.id);
    }

    setCompanies(JSON.parse(localStorage.getItem('companies') || '[]'));
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setIsGeneralAdmin(false);
    setActiveCompany(null);
    localStorage.removeItem('auth_session');
  };

  const selectCompany = (company) => {
    if (!isGeneralAdmin && company.id !== activeCompany?.id) handleLogout();
  };

  // CONTEXTO
  const companyContextValue = {
    activeCompany,
    selectCompany,
    companies,
    setCompanies,
    isGeneralAdmin,
  };

  // =============================================================
  // MAIN APP
  // =============================================================
  const MainApp = () => (
    <Layout onLogout={handleLogout}>
      <InitialAccountsSetup>
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

  // =============================================================
  // RENDER PRINCIPAL
  // =============================================================
  return (
    <>
      <Helmet>
        <title>JaiderHerTur26 - Sistema de Contabilidad</title>
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
