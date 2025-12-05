import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { Helmet } from "react-helmet";

import Layout from "@/components/Layout";
import Dashboard from "@/pages/Dashboard";
import Transactions from "@/pages/Transactions";
import Reports from "@/pages/Reports";
import Contacts from "@/pages/Contacts";
import Accounts from "@/pages/Accounts";
import BankAccounts from "@/pages/BankAccounts";
import BookClosings from "@/pages/BookClosings";
import Settings from "@/pages/Settings";
import Login from "@/pages/Login";
import Companies from "@/pages/Companies";
import FixedAssets from "@/pages/FixedAssets";
import RealEstates from "@/pages/RealEstates";
import TaxReports from "@/pages/TaxReports";
import AccountsReceivable from "@/pages/AccountsReceivable";
import AccountsPayable from "@/pages/AccountsPayable";
import Organization from "@/pages/Organization";

import { Toaster } from "@/components/ui/toaster";

import { useCompanyData } from "@/hooks/useCompanyData";
import { CompanyContext, useCompany } from "@/contexts/CompanyContext";

// Sincronización nube/local
import { bootstrapIfNeeded, syncFromServer } from "@/lib/localSync";

export { useCompany };


// --------------------------------------------------------------
// 🔄 CONFIGURADOR DE CUENTAS INICIALES
// --------------------------------------------------------------
const InitialAccountsSetup = ({ children }) => {
  const { activeCompany } = useCompany();
  const [accounts, saveAccounts, isAccountsLoaded] = useCompanyData("accounts");

  useEffect(() => {
    if (!activeCompany || !isAccountsLoaded) return;

    const requiredAccounts = [
      { number: "110505", name: "CAJA GENERAL" },
      { number: "11050501", name: "CAJA PRINCIPAL" },
      { number: "1120", name: "CUENTAS DE AHORRO" },
      { number: "13050505", name: "CUENTAS POR COBRAR" },
      { number: "23", name: "CUENTAS POR PAGAR" },
    ];

    if (accounts.length === 0) {
      const newAccounts = requiredAccounts.map((acc) => ({
        id: `${Date.now()}-${acc.number}`,
        number: acc.number,
        name: acc.name,
      }));

      saveAccounts(newAccounts.sort((a, b) => a.number.localeCompare(b.number)));
    }
  }, [activeCompany, accounts, saveAccounts, isAccountsLoaded]);

  return isAccountsLoaded || !activeCompany ? children : null;
};


// --------------------------------------------------------------
// 🔥 APP PRINCIPAL
// --------------------------------------------------------------
function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activeCompany, setActiveCompany] = useState(null);
  const [companies, setCompanies] = useState([]);
  const [isGeneralAdmin, setIsGeneralAdmin] = useState(false);
  const [accessLevel, setAccessLevel] = useState("full");
  const [isConsolidated, setIsConsolidated] = useState(false);

  // --------------------------
  // 🔥 PRIMERA CARGA DESDE NUBE
  // --------------------------
  useEffect(() => {
    bootstrapIfNeeded();

    // Sincronización automática cada 3 segundos
    const interval = setInterval(() => {
      syncFromServer();
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  // --------------------------
  // 🔥 AUTENTICACIÓN
  // --------------------------
  useEffect(() => {
    const session = localStorage.getItem("auth_session");
    const storedAccessLevel = localStorage.getItem("auth_access_level") || "full";

    if (!session) return;

    if (session === "general_admin") {
      setIsAuthenticated(true);
      setIsGeneralAdmin(true);
      setAccessLevel("full");

      const storedCompanies = JSON.parse(localStorage.getItem("companies") || "[]");
      setCompanies(storedCompanies);
      return;
    }

    // Usuario normal
    const storedCompanies = JSON.parse(localStorage.getItem("companies") || "[]");
    const loggedCompany = storedCompanies.find((c) => c.id === session);

    if (!loggedCompany) {
      localStorage.removeItem("auth_session");
      localStorage.removeItem("auth_access_level");
      return;
    }

    setCompanies(storedCompanies);
    setActiveCompany(loggedCompany);
    setIsAuthenticated(true);
    setIsGeneralAdmin(false);
    setAccessLevel(storedAccessLevel);

    const isCons = localStorage.getItem(`${loggedCompany.id}-consolidate`) === "true";
    setIsConsolidated(isCons);
  }, []);

  // --------------------------
  // 🔥 LOGIN
  // --------------------------
  const handleLogin = (loginData) => {
    setIsAuthenticated(true);

    const level = loginData.accessLevel || "full";
    setAccessLevel(level);
    localStorage.setItem("auth_access_level", level);

    if (loginData.isGeneralAdmin) {
      setIsGeneralAdmin(true);
      setActiveCompany(null);
      localStorage.setItem("auth_session", "general_admin");
    } else {
      setIsGeneralAdmin(false);
      setActiveCompany(loginData.company);
      localStorage.setItem("auth_session", loginData.company.id);

      setIsConsolidated(false);
      localStorage.removeItem(`${loginData.company.id}-consolidate`);
    }

    const storedCompanies = JSON.parse(localStorage.getItem("companies") || "[]");
    setCompanies(storedCompanies);
  };

  // --------------------------
  // 🔥 LOGOUT
  // --------------------------
  const handleLogout = () => {
    setIsAuthenticated(false);
    setIsGeneralAdmin(false);
    setActiveCompany(null);
    setAccessLevel("full");
    setIsConsolidated(false);

    localStorage.removeItem("auth_session");
    localStorage.removeItem("auth_access_level");
  };

  // --------------------------
  // 🔄 CONSOLIDACIONES
  // --------------------------
  const toggleConsolidation = (value) => {
    if (!activeCompany) return;

    setIsConsolidated(value);
    localStorage.setItem(`${activeCompany.id}-consolidate`, String(value));
  };

  // --------------------------
  // 🌐 CONTEXTO GLOBAL
  // --------------------------
  const companyContextValue = {
    activeCompany,
    companies,
    setCompanies,
    isGeneralAdmin,
    accessLevel,
    isConsolidated,
    toggleConsolidation,
  };

  // --------------------------
  // 🧭 RUTAS INTERNAS
  // --------------------------
  const MainApp = () => (
    <Layout onLogout={handleLogout}>
      <InitialAccountsSetup>
        <Routes>
          <Route path="/" element={isGeneralAdmin ? <Navigate to="/companies" /> : <Dashboard />} />

          <Route path="/companies" element={<Companies />} />
          <Route path="/settings" element={<Settings />} />

          <Route path="/organization" element={!isGeneralAdmin ? <Organization /> : <Navigate to="/companies" />} />
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

  // --------------------------
  // 🔚 RENDER PRINCIPAL
  // --------------------------
  return (
    <>
      <Helmet>
        <title>JaiderHerTur26 - Sistema Contable 2025</title>
        <meta name="description" content="Sistema contable profesional con sincronización nube/local." />
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
