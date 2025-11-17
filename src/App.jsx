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

// -----------------------------
// 🔥 SNAPSHOT IMPORTS (SUPABASE)
// -----------------------------
import {
  saveSnapshotGlobal,
  saveSnapshotEmpresa,
  loadSnapshotGlobal,
  loadSnapshotEmpresa
} from "./lib/snapshots";

const CompanyContext = createContext();
export const useCompany = () => useContext(CompanyContext);

// =====================================================================
// 📌 Inicialización de cuentas por defecto (solo la primera vez por empresa)
// =====================================================================
const InitialAccountsSetup = ({ children }) => {
  const { activeCompany } = useCompany();
  const [accounts, saveAccounts, isLoaded] = useCompanyData('accounts');

  useEffect(() => {
    if (!activeCompany || !isLoaded) return;

    const required = [
      { number: '110505', name: 'CAJA GENERAL' },
      { number: '11050501', name: 'CAJA PRINCIPAL' },
      { number: '1120', name: 'CUENTAS DE AHORRO' },
      { number: '13050505', name: 'CUENTAS POR COBRAR' },
      { number: '23', name: 'CUENTAS POR PAGAR' }
    ];

    if (accounts.length === 0) {
      const newAcc = required.map(r => ({
        id: `${Date.now()}-${r.number}`,
        number: r.number,
        name: r.name,
      }));
      saveAccounts(newAcc.sort((a, b) => a.number.localeCompare(b.number)));
    }
  }, [activeCompany, accounts, isLoaded, saveAccounts]);

  return isLoaded || !activeCompany ? children : null;
};

// =====================================================================
//                                 APP
// =====================================================================
function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activeCompany, setActiveCompany] = useState(null);
  const [companies, setCompanies] = useState([]);
  const [isGeneralAdmin, setIsGeneralAdmin] = useState(false);

  // -----------------------------
  // Snapshot States
  // -----------------------------
  const [globalData, setGlobalData] = useState({});
  const [empresaData, setEmpresaData] = useState({});
  const empresaId = activeCompany?.id || null;

  // -----------------------------
  // LOGIN SESSION AUTO RESTORE
  // -----------------------------
  useEffect(() => {
    const session = localStorage.getItem('auth_session');

    if (!session) return;

    const storedCompanies = JSON.parse(localStorage.getItem('companies') || '[]');
    setCompanies(storedCompanies);

    if (session === 'general_admin') {
      setIsGeneralAdmin(true);
      setIsAuthenticated(true);
      return;
    }

    const com = storedCompanies.find(c => c.id === session);
    if (com) {
      setActiveCompany(com);
      setIsAuthenticated(true);
      setIsGeneralAdmin(false);
    }
  }, []);

  // -----------------------------
  // CARGA AUTOMÁTICA DE SNAPSHOTS
  // -----------------------------
  useEffect(() => {
    if (!isAuthenticated) return;

    async function load() {
      try {
        const global = await loadSnapshotGlobal();
        if (global) setGlobalData(global);

        if (empresaId) {
          const empresa = await loadSnapshotEmpresa(empresaId);
          if (empresa) setEmpresaData(empresa);
        }
      } catch (e) {
        console.log("No hay snapshots iniciales todavía.");
      }
    }

    load();
  }, [isAuthenticated, empresaId]);

  // -----------------------------
  // GUARDAR SNAPSHOTS
  // -----------------------------
  async function guardarGlobal() {
    await saveSnapshotGlobal(globalData);
    alert("✔ Snapshot global guardado");
  }

  async function guardarEmpresa() {
    if (!empresaId) return;
    await saveSnapshotEmpresa(empresaId, empresaData);
    alert("✔ Snapshot empresa guardado");
  }

  // -----------------------------
  // LOGIN HANDLER
  // -----------------------------
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

    const storedCompanies = JSON.parse(localStorage.getItem('companies') || '[]');
    setCompanies(storedCompanies);
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setIsGeneralAdmin(false);
    setActiveCompany(null);
    localStorage.removeItem('auth_session');
  };

  const companyContextValue = {
    activeCompany,
    selectCompany: () => {},
    companies,
    setCompanies,
    isGeneralAdmin,
    globalData,
    setGlobalData,
    empresaData,
    setEmpresaData
  };

  // -----------------------------
  // MAIN APP (AUTENTICADO)
  // -----------------------------
  const MainApp = () => (
    <Layout onLogout={handleLogout}>
      <InitialAccountsSetup>
        <Routes>
          <Route path="/" element={isGeneralAdmin ? <Navigate to="/companies" /> : <Dashboard />} />

          <Route path="/companies" element={<Companies />} />
          <Route path="/settings" element={<Settings />} />

          {/* Rutas protegidas solo para empresas */}
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

      {/* Botones para guardar snapshots */}
      <div className="p-4 flex gap-2">
        <button onClick={guardarGlobal} className="px-4 py-2 bg-blue-600 text-white rounded">
          Guardar Snapshot Global
        </button>

        <button onClick={guardarEmpresa} className="px-4 py-2 bg-green-600 text-white rounded">
          Guardar Snapshot Empresa
        </button>
      </div>
    </Layout>
  );

  // -----------------------------
  // RENDER PRINCIPAL
  // -----------------------------
  return (
    <>
      <Helmet>
        <title>JaiderHerTur26 - Sistema de Contabilidad</title>
        <meta
          name="description"
          content="Gestiona tu contabilidad de forma profesional con JaiderHerTur26."
        />
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
