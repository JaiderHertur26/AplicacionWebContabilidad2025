
import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, DollarSign, PiggyBank } from 'lucide-react';
import { LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import StatCard from '@/components/dashboard/StatCard';
import RecentTransactions from '@/components/dashboard/RecentTransactions';
import { Label } from '@/components/ui/label';
import { useCompanyData } from '@/hooks/useCompanyData';
import { useCompany } from '@/App';
import { format, startOfMonth, subMonths, eachMonthOfInterval, startOfDay, endOfDay } from 'date-fns';

const Dashboard = () => {
  const { activeCompany } = useCompany();
  const [transactionsData, , isTransactionsLoaded] = useCompanyData('transactions');
  const [initialBalanceData, , isInitialBalanceLoaded] = useCompanyData('initialBalance');
  const [bankAccountsData, , isBankAccountsLoaded] = useCompanyData('bankAccounts');
  const [fixedAssetsData, , isFixedAssetsLoaded] = useCompanyData('fixedAssets');
  const [realEstatesData, , isRealEstatesLoaded] = useCompanyData('realEstates');
  const [accountsReceivableData, , isARLoaded] = useCompanyData('accountsReceivable');

  const [stats, setStats] = useState({
    generalBalance: 0,
    totalIncome: 0,
    totalExpenses: 0,
    cashBalance: 0,
  });

  const [chartData, setChartData] = useState([]);
  const [categoryData, setCategoryData] = useState([]);
  
  const [dateRange, setDateRange] = useState({
    from: startOfMonth(subMonths(new Date(), 5)),
    to: new Date(),
  });
  
  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#64748b'];

  const areAllDataLoaded = () => {
    return isTransactionsLoaded && isInitialBalanceLoaded && isBankAccountsLoaded && isFixedAssetsLoaded && isRealEstatesLoaded && isARLoaded;
  };

  const handleDateRangeChange = (e, field) => {
    const newDate = new Date(e.target.value);
    const adjustedDate = new Date(newDate.getTime() + newDate.getTimezoneOffset() * 60000);
    setDateRange(prev => ({ ...prev, [field]: adjustedDate }));
  };

  useEffect(() => {
    if (!areAllDataLoaded()) return;

    const safeParseFloat = (value) => {
        const parsed = parseFloat(value);
        return isNaN(parsed) ? 0 : parsed;
    };
      
    const allTransactions = transactionsData || [];
    
    // --- Balance General (Activos Totales) - LOGIC COPIED FROM Reports.jsx ---
    const initialCash = safeParseFloat(initialBalanceData?.[0]?.balance);
    const cashIncomes = allTransactions
        .filter(t => t.type === 'income' && t.destination?.startsWith('caja_principal'))
        .reduce((sum, t) => sum + safeParseFloat(t.amount), 0);
    const cashExpenses = allTransactions
        .filter(t => t.type === 'expense' && t.destination?.startsWith('caja_principal'))
        .reduce((sum, t) => sum + safeParseFloat(t.amount), 0);
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
                 } else { // Expense
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
      .filter(asset => asset.year === currentYear)
      .reduce((sum, asset) => sum + (safeParseFloat(asset.value) * (safeParseFloat(asset.quantity) || 1)), 0);
    const realEstatesValue = (realEstatesData || []).reduce((sum, estate) => sum + safeParseFloat(estate.value), 0);
    const totalFixedAssetsValue = inventoryAssetsValue + realEstatesValue;

    const totalAssets = cajaGeneralTotal + accountsReceivableValue + totalFixedAssetsValue;
    
    // --- Ingresos y Gastos del P&L ---
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
  }, [transactionsData, initialBalanceData, bankAccountsData, fixedAssetsData, realEstatesData, accountsReceivableData, dateRange]);

  const generateMonthlyData = (transactions, startDate, endDate) => {
    if (!startDate || !endDate) return [];
    const start = startOfDay(startDate);
    const end = endOfDay(endDate);
    const monthsInInterval = eachMonthOfInterval({ start, end });
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

    return Object.entries(categoryTotals).map(([name, value], index) => ({
      name, value, color: COLORS[index % COLORS.length]
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
                <h1 className="text-4xl font-bold text-slate-900 mb-2">Dashboard</h1>
                <p className="text-slate-600">Resumen general de tu contabilidad</p>
            </div>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard title="Balance General (Activos)" value={`$${stats.generalBalance.toLocaleString('es-ES', { minimumFractionDigits: 2 })}`} icon={DollarSign} trend={stats.generalBalance >= 0 ? 'up' : 'down'} color="blue" />
          <StatCard title="Ingresos (P&L)" value={`$${stats.totalIncome.toLocaleString('es-ES', { minimumFractionDigits: 2 })}`} icon={TrendingUp} trend="up" color="green" />
          <StatCard title="Gastos (P&L)" value={`$${stats.totalExpenses.toLocaleString('es-ES', { minimumFractionDigits: 2 })}`} icon={TrendingDown} trend="down" color="red" />
          <StatCard title="Saldo Caja Principal" value={`$${stats.cashBalance.toLocaleString('es-ES', { minimumFractionDigits: 2 })}`} icon={PiggyBank} trend="static" color="purple" />
        </div>

        <div className="grid grid-cols-1 gap-6">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="bg-white rounded-xl shadow-lg p-6 border border-slate-200"
          >
            <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-4">
              <h3 className="text-xl font-semibold text-slate-900 whitespace-nowrap">Ingresos vs Gastos (P&L)</h3>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-2">
                  <Label htmlFor="startDate" className="text-sm">Desde</Label>
                  <input type="date" id="startDate" value={format(dateRange.from, 'yyyy-MM-dd')} onChange={(e) => handleDateRangeChange(e, 'from')} className="text-sm border border-slate-300 rounded-md px-2 py-1 focus:ring-2 focus:ring-blue-500"/>
                </div>
                <div className="flex items-center gap-2">
                  <Label htmlFor="endDate" className="text-sm">Hasta</Label>
                  <input type="date" id="endDate" value={format(dateRange.to, 'yyyy-MM-dd')} onChange={(e) => handleDateRangeChange(e, 'to')} className="text-sm border border-slate-300 rounded-md px-2 py-1 focus:ring-2 focus:ring-blue-500"/>
                </div>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" stroke="#64748b" />
                <YAxis stroke="#64748b" tickFormatter={(value) => `$${(value/1000).toFixed(0)}k`} />
                <Tooltip formatter={(value) => `$${value.toLocaleString('es-ES')}`} contentStyle={{ backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '8px' }} />
                <Legend />
                <Line type="monotone" dataKey="ingresos" stroke="#10b981" strokeWidth={3} dot={{ fill: '#10b981', r: 5 }} />
                <Line type="monotone" dataKey="gastos" stroke="#ef4444" strokeWidth={3} dot={{ fill: '#ef4444', r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="bg-white rounded-xl shadow-lg p-6 border border-slate-200"
          >
            <h3 className="text-xl font-semibold text-slate-900 mb-4">Gastos por Categoría</h3>
            {categoryData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                    <Pie data={categoryData} cx="50%" cy="50%" labelLine={false} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} outerRadius={100} fill="#8884d8" dataKey="value">
                      {categoryData.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.color} />))}
                    </Pie>
                    <Tooltip formatter={(value) => `$${value.toLocaleString('es-ES')}`} />
                </PieChart>
                </ResponsiveContainer>
            ) : (
                <div className="flex items-center justify-center h-full text-slate-500">No hay gastos para mostrar.</div>
            )}
          </motion.div>
        </div>

        <RecentTransactions />
      </div>
    </>
  );
};

export default Dashboard;
