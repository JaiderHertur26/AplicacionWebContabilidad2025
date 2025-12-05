import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X, Home, ArrowRightLeft, Building, Landmark, BookOpen, Settings, LogOut, Briefcase, FileBarChart2, ArrowDownCircle, ArrowUpCircle, Users, ShieldCheck, ShieldAlert, Network } from 'lucide-react';
import { useCompany } from '@/App';

const navLinks = [
    { icon: Home, text: 'Dashboard', path: '/' },
    { icon: Network, text: 'Mi Organización', path: '/organization' },
    { icon: ArrowRightLeft, text: 'Transacciones', path: '/transactions' },
    { icon: Landmark, text: 'Cuentas Bancarias', path: '/bank-accounts' },
    { icon: Briefcase, text: 'Activos Fijos', path: '/fixed-assets' },
    { icon: Building, text: 'Propiedades y Oficinas', path: '/real-estates' },
    { icon: Users, text: 'Contactos', path: '/contacts' },
    { icon: ArrowUpCircle, text: 'Cuentas por Cobrar', path: '/accounts-receivable' },
    { icon: ArrowDownCircle, text: 'Cuentas por Pagar', path: '/accounts-payable' },
    { icon: FileBarChart2, text: 'Reportes Financieros', path: '/reports' },
    { icon: FileBarChart2, text: 'Reportes Tributarios', path: '/tax-reports' },
    { icon: BookOpen, text: 'Plan de Cuentas', path: '/accounts' },
    { icon: BookOpen, text: 'Cierres Contables', path: '/book-closings' },
    { icon: Settings, text: 'Ajustes', path: '/settings' },
];

const adminNavLinks = [
    { icon: Building, text: 'Empresas', path: '/companies' },
    { icon: Settings, text: 'Ajustes', path: '/settings' },
];

const AccessBadge = ({ level }) => {
    if (level === 'full') {
        return (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-green-900/30 rounded-lg border border-green-800 mt-2 mx-4">
                <ShieldCheck className="w-4 h-4 text-green-400" />
                <span className="text-xs font-bold text-green-400 uppercase tracking-wide">Acceso Total</span>
            </div>
        );
    }
    return (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-orange-900/30 rounded-lg border border-orange-800 mt-2 mx-4">
            <ShieldAlert className="w-4 h-4 text-orange-400" />
            <span className="text-xs font-bold text-orange-400 uppercase tracking-wide">Acceso Parcial</span>
        </div>
    );
};

const Sidebar = ({ onLogout }) => {
    const location = useLocation();
    const { activeCompany, isGeneralAdmin, accessLevel } = useCompany();
    
    let links = isGeneralAdmin ? adminNavLinks : navLinks;
    
    // Filter out Settings for partial access users
    if (!isGeneralAdmin && accessLevel === 'partial') {
        links = links.filter(link => link.path !== '/settings');
    }

    return (
        <aside className="bg-slate-900 text-white w-64 space-y-6 py-7 px-2 absolute inset-y-0 left-0 transform -translate-x-full md:relative md:translate-x-0 transition-transform duration-200 ease-in-out flex flex-col">
            <div className="px-4 space-y-1">
                <h2 className="text-2xl font-extrabold text-white tracking-wider">JaiderHerTur26</h2>
                {activeCompany && <p className="text-sm text-slate-400 font-medium truncate">{activeCompany.name}</p>}
                {isGeneralAdmin && <p className="text-sm text-slate-400 font-medium">Admin General</p>}
            </div>
            
            {!isGeneralAdmin && <AccessBadge level={accessLevel} />}

            <nav className="flex-grow mt-4 overflow-y-auto custom-scrollbar">
                {links.map(link => (
                    <NavLink
                        key={link.text}
                        to={link.path}
                        className={({ isActive }) =>
                            `flex items-center space-x-3 px-4 py-2.5 rounded-lg transition-colors duration-200 ${
                                isActive || (link.path === '/reports' && location.pathname.startsWith('/reports'))
                                    ? 'bg-blue-600 text-white shadow-lg'
                                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                            }`
                        }
                    >
                        <link.icon className="w-5 h-5" />
                        <span>{link.text}</span>
                    </NavLink>
                ))}
            </nav>
            <div>
                <button onClick={onLogout} className="flex items-center space-x-3 px-4 py-2.5 rounded-lg text-slate-300 hover:bg-red-600 hover:text-white w-full transition-colors duration-200">
                    <LogOut className="w-5 h-5" />
                    <span>Cerrar Sesión</span>
                </button>
            </div>
        </aside>
    );
};

const MobileSidebar = ({ isOpen, setIsOpen, onLogout }) => {
    const location = useLocation();
    const { activeCompany, isGeneralAdmin, accessLevel } = useCompany();
    
    let links = isGeneralAdmin ? adminNavLinks : navLinks;

    // Filter out Settings for partial access users
    if (!isGeneralAdmin && accessLevel === 'partial') {
        links = links.filter(link => link.path !== '/settings');
    }

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/60 z-40"
                        onClick={() => setIsOpen(false)}
                    />
                    <motion.aside
                        initial={{ x: '-100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '-100%' }}
                        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                        className="bg-slate-900 text-white w-64 space-y-6 py-7 px-2 absolute inset-y-0 left-0 z-50 flex flex-col"
                    >
                        <div className="px-4 space-y-1">
                            <h2 className="text-2xl font-extrabold text-white tracking-wider">JaiderHerTur26</h2>
                            {activeCompany && <p className="text-sm text-slate-400 font-medium truncate">{activeCompany.name}</p>}
                            {isGeneralAdmin && <p className="text-sm text-slate-400 font-medium">Admin General</p>}
                        </div>

                        {!isGeneralAdmin && <AccessBadge level={accessLevel} />}

                        <nav className="flex-grow mt-4 overflow-y-auto custom-scrollbar">
                            {links.map(link => (
                                <NavLink
                                    key={link.text}
                                    to={link.path}
                                    onClick={() => setIsOpen(false)}
                                    className={({ isActive }) =>
                                        `flex items-center space-x-3 px-4 py-2.5 rounded-lg transition-colors duration-200 ${
                                            isActive || (link.path === '/reports' && location.pathname.startsWith('/reports'))
                                                ? 'bg-blue-600 text-white shadow-lg'
                                                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                                        }`
                                    }
                                >
                                    <link.icon className="w-5 h-5" />
                                    <span>{link.text}</span>
                                </NavLink>
                            ))}
                        </nav>
                        <div>
                            <button onClick={() => { onLogout(); setIsOpen(false); }} className="flex items-center space-x-3 px-4 py-2.5 rounded-lg text-slate-300 hover:bg-red-600 hover:text-white w-full transition-colors duration-200">
                                <LogOut className="w-5 h-5" />
                                <span>Cerrar Sesión</span>
                            </button>
                        </div>
                    </motion.aside>
                </>
            )}
        </AnimatePresence>
    );
};

const Layout = ({ children, onLogout }) => {
    const [sidebarOpen, setSidebarOpen] = useState(false);

    return (
        <div className="relative min-h-screen md:flex bg-slate-100">
            {/* Desktop Sidebar */}
            <div className="hidden md:block h-screen sticky top-0 overflow-hidden">
                <Sidebar onLogout={onLogout} />
            </div>

            {/* Mobile Sidebar */}
            <MobileSidebar isOpen={sidebarOpen} setIsOpen={setSidebarOpen} onLogout={onLogout} />

            <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto h-screen">
                <button onClick={() => setSidebarOpen(true)} className="md:hidden p-2 mb-4 rounded-md text-slate-600 bg-white shadow">
                    <Menu className="w-6 h-6" />
                </button>
                {children}
            </main>
        </div>
    );
};

export default Layout;