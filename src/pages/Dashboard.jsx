import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, DollarSign, PiggyBank, Building, Building2, Info, Calendar } from 'lucide-react';
import { LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import StatCard from '@/components/dashboard/StatCard';
import RecentTransactions from '@/components/dashboard/RecentTransactions';
import { Label } from '@/components/ui/label';
import { useCompanyData } from '@/hooks/useCompanyData';
import { useCompany } from '@/App';
import { format, startOfMonth, subMonths, eachMonthOfInterval, startOfDay, endOfDay, startOfYear } from 'date-fns';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

const Dashboard = () => {
  const { activeCompany, companies, isConsolidated, toggleConsolidation } = useCompany();
  const [transactionsData, , isTransactionsLoaded] = useCompanyData('transactions');
  const [initialBalanceData, , isInitialBalanceLoaded] = useCompanyData('initialBalance');
  const [bankAccountsData, , isBankAccountsLoaded] = useCompanyData('bankAccounts');
  const [fixedAssetsData, , isFixedAssetsLoaded] = useCompanyData('fixedAssets');
  const [realEstatesData, , isRealEstatesLoaded] = useCompanyData('realEstates');
  const [accountsReceivableData, , isARLoaded] = useCompanyData('accountsReceivable');
  const [accountsData, , isAccountsLoaded] = useCompanyData('accounts');

  const [stats, setStats] = useState({
    generalBalance: 0,
    totalIncome: 0,
    totalExpenses: 0,
    cashBalance: 0,
  });

  const [chartData, setChartData] = useState([]);
  const [categoryData, setCategoryData] = useState([]);
  
  // Configuración inicial de fechas: Primer día del año actual hasta hoy
  const [dateRange, setDateRange] = useState({
    from: startOfYear(new Date()),
    to: new Date(),
  });
  
  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#64748b', '#ec4899', '#14b8a6'];

  const areAllDataLoaded = () => {
    return isTransactionsLoaded && isInitialBalanceLoaded && isBankAccountsLoaded && isFixedAssetsLoaded && isRealEstatesLoaded && isARLoaded && isAccountsLoaded;
  };

  const handleDateRangeChange = (e, field) => {
    const newDate = new Date(e.target.value);
    const adjustedDate = new Date(newDate.getTime() + newDate.getTimezoneOffset() * 60000);
    setDateRange(prev => ({ ...prev, [field]: adjustedDate }));
  };
  
  const hasSubCompanies = companies.some(c => c.parentId === activeCompany?.id);

  useEffect(() => {
    if (!areAllDataLoaded()) return;

    const safeParseFloat = (value) => {
        const parsed = parseFloat(value);
        return isNaN(parsed) ? 0 : parsed;
    };
      
    const allTransactions = transactionsData || [];
    
    const cashAccountIds = new Set();
    cashAccountIds.add('caja_principal');
    
    if (accountsData) {
        accountsData.forEach(acc => {
            if (acc.number === '11050501' || acc.name.toUpperCase() === 'CAJA PRINCIPAL') {
                cashAccountIds.add(acc.id);
            }
        });
    }

    const initialCash = (initialBalanceData || []).reduce((sum, item) => {
        return sum + safeParseFloat(item.balance);
    }, 0);

    let cashIncomes = 0;
    let cashExpenses = 0;

    allTransactions.forEach(t => {
        const amount = safeParseFloat(t.amount);
        const isCashTransaction = t.destination && (cashAccountIds.has(t.destination) || t.destination.startsWith('caja_principal'));
        
        if (isCashTransaction) {
             if (t.type === 'income') {
                 cashIncomes += amount;
             } else if (t.type === 'expense') {
                 cashExpenses += amount;
             }
        }
    });
    
    const cashBalance = initialCash + cashIncomes - cashExpenses;

    let totalBankBalances = 0;
    let totalInvestmentBalances = 0;
    (bankAccountsData || []).forEach(acc => {
        let currentBankBalance = safeParseFloat(acc.initialBalance);
        let currentInvestmentBalance = safeParseFloat(acc.initialInvestmentBalance);

        allTransactions.forEach(t => {
            const amount = safeParseFloat(t.amount);
            if(t.destination?.startsWith(acc.id)) {
                 if (t.type === 'income') {
                     if (t.description?.includes('Aporte Ordinario')) {
                        currentInvestmentBalance += amount;
                     } else {
                        currentBankBalance += amount;
                     }
                 } else { 
                     currentBankBalance -= amount;
                 }
            }
        });
        totalBankBalances += currentBankBalance;
        totalInvestmentBalances += currentInvestmentBalance;
    });
    
    const cajaGeneralTotal = cashBalance + totalBankBalances + totalInvestmentBalances;
    const accountsReceivableValue = (accountsReceivableData || []).filter(r => r.status === 'Pendiente').reduce((sum, r) => sum + safeParseFloat(r.amount), 0);
    
    const currentYear = new Date().getFullYear().toString();
    const inventoryAssetsValue = (fixedAssetsData || [])
      .filter(asset => asset.year === currentYear || (asset.date && new Date(asset.date).getFullYear().toString() === currentYear))
      .reduce((sum, asset) => sum + (safeParseFloat(asset.value) * (safeParseFloat(asset.quantity) || 1)), 0);
    const realEstatesValue = (realEstatesData || []).reduce((sum, estate) => sum + safeParseFloat(estate.value), 0);
    const totalFixedAssetsValue = inventoryAssetsValue + realEstatesValue;

    const totalAssets = cajaGeneralTotal + accountsReceivableValue + totalFixedAssetsValue;
    
    const income = allTransactions.filter(t => t.type === 'income' && !t.isInternalTransfer && t.category !== 'Cuentas por Cobrar').reduce((sum, t) => sum + safeParseFloat(t.amount), 0);
    const expenses = allTransactions.filter(t => t.type === 'expense' && !t.isInternalTransfer && t.category !== 'Cuentas por Pagar').reduce((sum, t) => sum + safeParseFloat(t.amount), 0);

    setStats({
      generalBalance: totalAssets,
      totalIncome: income,
      totalExpenses: expenses,
      cashBalance: cashBalance,
    });

    const monthlyData = generateMonthlyData(allTransactions.filter(t => !t.isInternalTransfer), dateRange.from, dateRange.to);
    setChartData(monthlyData);

    const categories = generateCategoryData(allTransactions);
    setCategoryData(categories);
  }, [transactionsData, initialBalanceData, bankAccountsData, fixedAssetsData, realEstatesData, accountsReceivableData, accountsData, dateRange, isConsolidated]);

  const generateMonthlyData = (transactions, startDate, endDate) => {
    if (!startDate || !endDate) return [];
    const start = startOfDay(startDate);
    const end = endOfDay(endDate);
    
    let monthsInInterval = [];
    try {
        monthsInInterval = eachMonthOfInterval({ start, end });
    } catch (e) {
        return []; 
    }
    
    const months = monthsInInterval.map(monthStart => ({ name: format(monthStart, 'MMM yyyy'), ingresos: 0, gastos: 0 }));

    transactions.forEach(t => {
      const transactionDate = new Date(t.date);
      if (transactionDate >= start && transactionDate <= end) {
        const monthName = format(startOfMonth(transactionDate), 'MMM yyyy');
        const monthData = months.find(m => m.name === monthName);
        if (monthData) {
            const amount = parseFloat(t.amount);
            if (!isNaN(amount)) {
                if (t.type === 'income' && t.category !== 'Cuentas por Cobrar') monthData.ingresos += amount;
                else if (t.type === 'expense' && t.category !== 'Cuentas por Pagar') monthData.gastos += amount;
            }
        }
      }
    });
    return months;
  };

  const generateCategoryData = (transactions) => {
    const expenseTransactions = transactions.filter(t => t.type === 'expense' && !t.isInternalTransfer && t.category !== 'Cuentas por Pagar');
    const categoryTotals = expenseTransactions.reduce((acc, t) => {
      const category = t.category || 'Sin Categoría';
      const amount = parseFloat(t.amount);
      if (!isNaN(amount)) {
        if (!acc[category]) acc[category] = 0;
        acc[category] += amount;
      }
      return acc;
    }, {});

    const totalExpenses = Object.values(categoryTotals).reduce((a, b) => a + b, 0);

    return Object.entries(categoryTotals).map(([name, value], index) => ({
      name, 
      value, 
      percentage: totalExpenses > 0 ? (value / totalExpenses) * 100 : 0,
      color: COLORS[index % COLORS.length]
    })).sort((a,b) => b.value - a.value);
  };

  return (
    <>
      <Helmet>
        <title>Dashboard - JaiderHerTur26</title>
        <meta name="description" content="Panel de control con resumen financiero y estadísticas de tu negocio" />
      </Helmet>

      <div className="space-y-8">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
                <div className="flex items-center gap-2">
                    <h1 className="text-4xl font-bold text-slate-900 mb-2">Dashboard</h1>
                    {isConsolidated && <span className="bg-purple-100 text-purple-800 text-xs font-bold px-2 py-1 rounded-full border border-purple-200 animate-pulse">CONSOLIDADO</span>}
                </div>
                <p className="text-slate-600">Resumen general de tu contabilidad</p>
            </div>
            
            {hasSubCompanies && (
                <div className="flex items-center space-x-3 bg-white p-2.5 rounded-xl border shadow-sm hover:shadow-md transition-shadow">
                    <Switch 
                        id="consolidation-mode"
                        checked={isConsolidated}
                        onCheckedChange={toggleConsolidation}
                        className="data-[state=checked]:bg-purple-600"
                    />
                    <Label htmlFor="consolidation-mode" className="cursor-pointer flex items-center gap-2">
                        {isConsolidated ? <Building2 className="w-5 h-5 text-purple-600" /> : <Building className="w-5 h-5 text-slate-400" />}
                        <div className="flex flex-col leading-tight">
                            <span className={isConsolidated ? "font-bold text-purple-700" : "font-medium text-slate-600"}>
                                {isConsolidated ? "Vista Consolidada" : "Vista Individual"}
                            </span>
                            {isConsolidated && <span className="text-[10px] text-purple-600 font-medium">Incluye sub-empresas</span>}
                        </div>
                    </Label>
                </div>
            )}
          </div>
        </motion.div>
        
        {isConsolidated && (
            <div className="bg-purple-50 border border-purple-200 p-3 rounded-lg flex gap-3 text-purple-800 text-sm items-center">
                <Info className="w-5 h-5 flex-shrink-0" />
                Estás viendo la información combinada de tu empresa y todas sus sub-empresas vinculadas. Para editar datos, se recomienda cambiar a Vista Individual.
            </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard title="Balance General (Activos)" value={`$${stats.generalBalance.toLocaleString('es-ES', { minimumFractionDigits: 2 })}`} icon={DollarSign} trend={stats.generalBalance >= 0 ? 'up' : 'down'} color="blue" />
          <StatCard title="Ingresos (P&L)" value={`$${stats.totalIncome.toLocaleString('es-ES', { minimumFractionDigits: 2 })}`} icon={TrendingUp} trend="up" color="green" />
          <StatCard title="Gastos (P&L)" value={`$${stats.totalExpenses.toLocaleString('es-ES', { minimumFractionDigits: 2 })}`} icon={TrendingDown} trend="down" color="red" />
          <StatCard title="Saldo Caja Principal" value={`$${stats.cashBalance.toLocaleString('es-ES', { minimumFractionDigits: 2 })}`} icon={PiggyBank} trend="static" color="purple" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* LINE CHART SECTION */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="bg-white rounded-xl shadow-lg p-6 border border-slate-200 lg:col-span-2"
          >
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-6">
              <h3 className="text-xl font-semibold text-slate-900 flex items-center gap-2">
                  Ingresos vs Gastos <span className="text-xs font-normal text-slate-400 bg-slate-100 px-2 py-1 rounded-full">P&L</span>
              </h3>
              
              {/* Date Filters aligned on the same line/block */}
              <div className="flex flex-wrap items-center gap-3 bg-slate-50 p-2 rounded-lg border border-slate-100 w-full lg:w-auto">
                <div className="flex items-center gap-2">
                  <Label htmlFor="startDate" className="text-xs font-medium text-slate-500 uppercase">Desde</Label>
                  <div className="relative">
                      <input 
                        type="date" 
                        id="startDate" 
                        value={format(dateRange.from, 'yyyy-MM-dd')} 
                        onChange={(e) => handleDateRangeChange(e, 'from')} 
                        className="text-sm border border-slate-300 rounded-md pl-2 pr-2 py-1 focus:ring-2 focus:ring-blue-500 w-32 bg-white"
                      />
                  </div>
                </div>
                <div className="hidden sm:block w-px h-4 bg-slate-300"></div>
                <div className="flex items-center gap-2">
                  <Label htmlFor="endDate" className="text-xs font-medium text-slate-500 uppercase">Hasta</Label>
                  <div className="relative">
                      <input 
                        type="date" 
                        id="endDate" 
                        value={format(dateRange.to, 'yyyy-MM-dd')} 
                        onChange={(e) => handleDateRangeChange(e, 'to')} 
                        className="text-sm border border-slate-300 rounded-md pl-2 pr-2 py-1 focus:ring-2 focus:ring-blue-500 w-32 bg-white"
                      />
                  </div>
                </div>
              </div>
            </div>
            
            <div className="h-[350px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis 
                        dataKey="name" 
                        stroke="#94a3b8" 
                        tick={{fontSize: 12}} 
                        tickLine={false}
                        axisLine={false}
                        dy={10}
                    />
                    <YAxis 
                        stroke="#94a3b8" 
                        tickFormatter={(value) => `$${(value/1000).toFixed(0)}k`} 
                        tick={{fontSize: 12}}
                        tickLine={false}
                        axisLine={false}
                    />
                    <Tooltip 
                        formatter={(value) => `$${value.toLocaleString('es-ES')}`} 
                        contentStyle={{ backgroundColor: 'white', border: 'none', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} 
                        cursor={{ stroke: '#e2e8f0', strokeWidth: 2 }}
                    />
                    <Legend wrapperStyle={{ paddingTop: '20px' }}/>
                    <Line 
                        type="monotone" 
                        dataKey="ingresos" 
                        name="Ingresos"
                        stroke="#10b981" 
                        strokeWidth={3} 
                        dot={{ fill: '#10b981', r: 4, strokeWidth: 2, stroke: '#fff' }} 
                        activeDot={{ r: 6, strokeWidth: 0 }}
                    />
                    <Line 
                        type="monotone" 
                        dataKey="gastos" 
                        name="Gastos"
                        stroke="#ef4444" 
                        strokeWidth={3} 
                        dot={{ fill: '#ef4444', r: 4, strokeWidth: 2, stroke: '#fff' }} 
                        activeDot={{ r: 6, strokeWidth: 0 }}
                    />
                </LineChart>
                </ResponsiveContainer>
            </div>
          </motion.div>

          {/* CATEGORY PIE CHART SECTION */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="bg-white rounded-xl shadow-lg p-6 border border-slate-200 h-full lg:col-span-1 flex flex-col"
          >
            <h3 className="text-xl font-semibold text-slate-900 mb-4">Gastos por Categoría</h3>
            
            {categoryData.length > 0 ? (
                <div className="flex flex-col flex-1 min-h-[350px]">
                    {/* Pie Chart Area */}
                    <div className="flex-1 w-full relative min-h-[200px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie 
                                    data={categoryData} 
                                    cx="50%" 
                                    cy="50%" 
                                    innerRadius={60} 
                                    outerRadius={80} 
                                    paddingAngle={2}
                                    dataKey="value"
                                >
                                    {categoryData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} strokeWidth={0} />
                                    ))}
                                </Pie>
                                <Tooltip 
                                    formatter={(value) => `$${value.toLocaleString('es-ES')}`}
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                        
                        {/* Center Text (Total) */}
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                            <span className="text-xs text-slate-400 font-medium uppercase">Total</span>
                            <span className="text-lg font-bold text-slate-700">
                                ${stats.totalExpenses.toLocaleString('es-ES', { maximumFractionDigits: 0 })}
                            </span>
                        </div>
                    </div>

                    {/* Scrollable Legend List - Solves overlapping issues */}
                    <div className="mt-4 flex-1 overflow-y-auto max-h-[200px] pr-2 space-y-3 custom-scrollbar border-t border-slate-100 pt-4">
                        {categoryData.map((item, index) => (
                            <div key={index} className="flex items-center justify-between text-sm group hover:bg-slate-50 p-1.5 rounded-md transition-colors">
                                <div className="flex items-center gap-3 overflow-hidden">
                                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }}></div>
                                    <span className="text-slate-600 truncate font-medium" title={item.name}>{item.name}</span>
                                </div>
                                <div className="flex flex-col items-end ml-2">
                                    <span className="font-semibold text-slate-800">${item.value.toLocaleString('es-ES', { maximumFractionDigits: 0 })}</span>
                                    <span className="text-[10px] text-slate-400">{item.percentage.toFixed(1)}%</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center h-[300px] text-slate-400 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                    <PiggyBank className="w-12 h-12 mb-2 opacity-20"/>
                    <p>No hay gastos registrados</p>
                </div>
            )}
          </motion.div>
        </div>

        <RecentTransactions />
      </div>
    </>
  );
};

export default Dashboard;