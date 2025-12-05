import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { 
    Calendar as CalendarIcon, 
    Download, 
    TrendingUp, 
    TrendingDown, 
    DollarSign, 
    PieChart, 
    Wallet, 
    Landmark,
    Filter,
    FileSpreadsheet
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { exportToExcel } from '@/lib/excel';
import { useCompanyData } from '@/hooks/useCompanyData';
import { 
    format, 
    parseISO, 
    startOfWeek, 
    endOfWeek, 
    startOfMonth, 
    endOfMonth, 
    startOfYear, 
    endOfYear, 
    isWithinInterval,
    isValid
} from 'date-fns';
import { es } from 'date-fns/locale';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const BookClosings = () => {
    const [activeTab, setActiveTab] = useState('day'); // day, week, month, year, custom
    const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [selectedMonth, setSelectedMonth] = useState(String(new Date().getMonth()));
    const [selectedYear, setSelectedYear] = useState(String(new Date().getFullYear()));
    
    // Custom range
    const [customStart, setCustomStart] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [customEnd, setCustomEnd] = useState(format(new Date(), 'yyyy-MM-dd'));

    const [report, setReport] = useState(null);
    const [transactions] = useCompanyData('transactions');
    const { toast } = useToast();

    // Helper to extract years from data
    const availableYears = React.useMemo(() => {
        const years = new Set((transactions || []).map(t => new Date(t.date).getFullYear()));
        const current = new Date().getFullYear();
        years.add(current);
        return Array.from(years).sort((a, b) => b - a).map(String);
    }, [transactions]);

    const calculateRange = () => {
        let start, end;
        const current = parseISO(date); 

        switch (activeTab) {
            case 'day':
                start = current;
                end = current;
                break;
            case 'week':
                start = startOfWeek(current, { weekStartsOn: 1 });
                end = endOfWeek(current, { weekStartsOn: 1 });
                break;
            case 'month':
                const monthDate = new Date(parseInt(selectedYear), parseInt(selectedMonth), 1);
                start = startOfMonth(monthDate);
                end = endOfMonth(monthDate);
                break;
            case 'year':
                const yearDate = new Date(parseInt(selectedYear), 0, 1);
                start = startOfYear(yearDate);
                end = endOfYear(yearDate);
                break;
            case 'custom':
                start = parseISO(customStart);
                end = parseISO(customEnd);
                break;
            default:
                start = new Date();
                end = new Date();
        }
        
        const finalStart = new Date(start);
        finalStart.setHours(0, 0, 0, 0);
        
        const finalEnd = new Date(end);
        finalEnd.setHours(23, 59, 59, 999);
        
        return { start: finalStart, end: finalEnd };
    };

    const generateReport = () => {
        if (!transactions) return;

        const { start, end } = calculateRange();
        
        if (!isValid(start) || !isValid(end)) {
             toast({ variant: 'destructive', title: "Error de fechas", description: "Las fechas seleccionadas no son válidas." });
             return;
        }

        let filtered = transactions.filter(t => {
            const dateObj = new Date(t.date);
            const userTimezoneOffset = dateObj.getTimezoneOffset() * 60000;
            const adjustedDate = new Date(dateObj.getTime() + userTimezoneOffset);
            
            return isWithinInterval(adjustedDate, { start, end }) && !t.isInternalTransfer; 
        });

        // SORTING LOGIC: Ascending (Oldest first)
        // We sort by date, and use ID/created_at as tiebreaker for stability
        filtered.sort((a, b) => {
            const dateA = new Date(a.date);
            const dateB = new Date(b.date);
            // If dates are different, sort by date
            if (dateA.getTime() !== dateB.getTime()) {
                return dateA - dateB;
            }
            // If dates are same, sort by creation time (if available) or ID
            return (a.created_at || '').localeCompare(b.created_at || '');
        });

        const incomes = filtered.filter(t => t.type === 'income');
        const expenses = filtered.filter(t => t.type === 'expense');

        const groupByAccount = (list) => {
            const groups = {};
            list.forEach(t => {
                let accountName = 'Sin especificar';
                if (t.destination) {
                    const parts = t.destination.split('|');
                    accountName = parts.length > 1 ? parts[1] : parts[0];
                }
                
                if (t.description.toLowerCase().includes('aporte ordinario')) {
                   accountName = `${accountName} (Aporte)`;
                }

                if (!groups[accountName]) groups[accountName] = 0;
                groups[accountName] += parseFloat(t.amount);
            });
            return Object.entries(groups).map(([name, total]) => ({ name, total }));
        };

        const incomeByOrigin = groupByAccount(incomes);
        const expenseByOrigin = groupByAccount(expenses);

        const totalIncome = incomes.reduce((sum, t) => sum + parseFloat(t.amount), 0);
        const totalExpense = expenses.reduce((sum, t) => sum + parseFloat(t.amount), 0);

        setReport({
            period: { start, end },
            totalIncome,
            totalExpense,
            balance: totalIncome - totalExpense,
            incomeByOrigin,
            expenseByOrigin,
            transactions: filtered
        });

        toast({ title: "Cierre Generado", description: "Los datos han sido actualizados con las fechas seleccionadas." });
    };

    const handleExport = () => {
        if (!report) return;

        const detailData = report.transactions.map(t => {
             const dateObj = new Date(t.date);
             const userTimezoneOffset = dateObj.getTimezoneOffset() * 60000;
             const adjustedDate = new Date(dateObj.getTime() + userTimezoneOffset);
             
             let companyPrefix = '';
             if (t._isConsolidated && t._companyName) {
                 companyPrefix = `[${t._companyName}] `;
             }

             return {
                'Comprobante': `${companyPrefix}${t.voucherNumber || 'N/A'}`,
                'Fecha': format(adjustedDate, 'dd/MM/yyyy'),
                'Empresa': t._companyName || 'Principal',
                'Tipo': t.type === 'income' ? 'Ingreso' : 'Egreso',
                'Descripción': t.description,
                'Categoría': t.category,
                'Cuenta': t.destination ? t.destination.split('|')[1] : 'N/A',
                'Ingreso': t.type === 'income' ? parseFloat(t.amount) : 0,
                'Egreso': t.type === 'expense' ? parseFloat(t.amount) : 0,
            };
        });

        const fileName = `Cierre_Contable_${format(report.period.start, 'dd-MM-yyyy')}_${format(report.period.end, 'dd-MM-yyyy')}`;
        
        exportToExcel(detailData, fileName, { 'Ingreso': report.totalIncome, 'Egreso': report.totalExpense });
        toast({ title: "Exportado", description: "El archivo Excel ha sido descargado." });
    };

    const months = [
        'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];

    return (
        <>
            <Helmet>
                <title>Cierres Contables - JaiderHerTur26</title>
            </Helmet>

            <div className="space-y-6">
                <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
                    <h1 className="text-4xl font-bold text-slate-900">Cierres Contables</h1>
                    <p className="text-slate-600">Genera reportes detallados de flujo de caja y balance por periodos.</p>
                </motion.div>

                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-white rounded-xl shadow-lg border overflow-hidden">
                    <div className="flex border-b bg-slate-50 overflow-x-auto">
                        {[
                            { id: 'day', label: 'Diario', icon: CalendarIcon },
                            { id: 'week', label: 'Semanal', icon: CalendarIcon },
                            { id: 'month', label: 'Mensual', icon: CalendarIcon },
                            { id: 'year', label: 'Anual', icon: CalendarIcon },
                            { id: 'custom', label: 'Personalizado', icon: Filter },
                        ].map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center px-6 py-4 text-sm font-medium transition-colors border-b-2 whitespace-nowrap ${
                                    activeTab === tab.id 
                                        ? 'border-blue-600 text-blue-600 bg-white' 
                                        : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-100'
                                }`}
                            >
                                <tab.icon className="w-4 h-4 mr-2" />
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    <div className="p-6 flex flex-wrap items-end gap-4">
                        {activeTab === 'day' && (
                            <div className="space-y-2 flex-1 min-w-[200px]">
                                <Label>Seleccionar Día</Label>
                                <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full px-3 py-2 border rounded-lg" />
                            </div>
                        )}

                        {activeTab === 'week' && (
                            <div className="space-y-2 flex-1 min-w-[200px]">
                                <Label>Seleccionar un día de la semana</Label>
                                <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full px-3 py-2 border rounded-lg" />
                                <p className="text-xs text-slate-500">Se calculará de Lunes a Domingo.</p>
                            </div>
                        )}

                        {activeTab === 'month' && (
                            <>
                                <div className="space-y-2 flex-1 min-w-[150px]">
                                    <Label>Mes</Label>
                                    <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            {months.map((m, i) => <SelectItem key={i} value={String(i)}>{m}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2 flex-1 min-w-[120px]">
                                    <Label>Año</Label>
                                    <Select value={selectedYear} onValueChange={setSelectedYear}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            {availableYears.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </>
                        )}

                        {activeTab === 'year' && (
                            <div className="space-y-2 flex-1 min-w-[200px]">
                                <Label>Año Fiscal</Label>
                                <Select value={selectedYear} onValueChange={setSelectedYear}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {availableYears.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}

                        {activeTab === 'custom' && (
                            <>
                                <div className="space-y-2 flex-1 min-w-[200px]">
                                    <Label>Desde</Label>
                                    <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="w-full px-3 py-2 border rounded-lg" />
                                </div>
                                <div className="space-y-2 flex-1 min-w-[200px]">
                                    <Label>Hasta</Label>
                                    <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="w-full px-3 py-2 border rounded-lg" />
                                </div>
                            </>
                        )}

                        <Button onClick={generateReport} className="bg-blue-600 hover:bg-blue-700 min-w-[140px]">
                            <PieChart className="w-4 h-4 mr-2" /> Generar Cierre
                        </Button>
                    </div>
                </motion.div>

                {report && (
                    <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.3 }} className="space-y-6">
                        
                        <div className="flex flex-col sm:flex-row justify-between items-end sm:items-center gap-4 bg-white p-4 rounded-xl border shadow-sm">
                            <div>
                                <h2 className="text-lg font-semibold text-slate-900">
                                    Reporte del {format(report.period.start, "d 'de' MMMM, yyyy", { locale: es })} al {format(report.period.end, "d 'de' MMMM, yyyy", { locale: es })}
                                </h2>
                                <p className="text-slate-500 text-sm">{report.transactions.length} movimientos encontrados</p>
                            </div>
                            <Button variant="outline" onClick={handleExport} className="text-green-700 border-green-200 bg-green-50 hover:bg-green-100">
                                <FileSpreadsheet className="w-4 h-4 mr-2" /> Exportar Excel
                            </Button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-6 rounded-xl border border-green-100 shadow-sm">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="bg-green-100 p-2 rounded-lg"><TrendingUp className="w-6 h-6 text-green-600" /></div>
                                    <span className="text-xs font-semibold text-green-600 bg-green-100 px-2 py-1 rounded-full">Ingresos</span>
                                </div>
                                <p className="text-slate-600 text-sm font-medium">Total Ingresos</p>
                                <p className="text-3xl font-bold text-slate-900 mt-1">${report.totalIncome.toLocaleString('es-ES', { minimumFractionDigits: 2 })}</p>
                            </div>

                            <div className="bg-gradient-to-br from-red-50 to-pink-50 p-6 rounded-xl border border-red-100 shadow-sm">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="bg-red-100 p-2 rounded-lg"><TrendingDown className="w-6 h-6 text-red-600" /></div>
                                    <span className="text-xs font-semibold text-red-600 bg-red-100 px-2 py-1 rounded-full">Egresos</span>
                                </div>
                                <p className="text-slate-600 text-sm font-medium">Total Egresos</p>
                                <p className="text-3xl font-bold text-slate-900 mt-1">${report.totalExpense.toLocaleString('es-ES', { minimumFractionDigits: 2 })}</p>
                            </div>

                            <div className={`bg-gradient-to-br p-6 rounded-xl border shadow-sm ${report.balance >= 0 ? 'from-blue-50 to-indigo-50 border-blue-100' : 'from-orange-50 to-red-50 border-orange-100'}`}>
                                <div className="flex items-center justify-between mb-4">
                                    <div className={`${report.balance >= 0 ? 'bg-blue-100' : 'bg-orange-100'} p-2 rounded-lg`}>
                                        <DollarSign className={`w-6 h-6 ${report.balance >= 0 ? 'text-blue-600' : 'text-orange-600'}`} />
                                    </div>
                                    <span className={`text-xs font-semibold px-2 py-1 rounded-full ${report.balance >= 0 ? 'text-blue-600 bg-blue-100' : 'text-orange-600 bg-orange-100'}`}>Balance</span>
                                </div>
                                <p className="text-slate-600 text-sm font-medium">Resultado Neto</p>
                                <p className={`text-3xl font-bold mt-1 ${report.balance >= 0 ? 'text-blue-900' : 'text-orange-900'}`}>
                                    ${report.balance.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                                </p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <div className="bg-white rounded-xl shadow-lg border overflow-hidden">
                                <div className="p-4 border-b bg-slate-50 flex justify-between items-center">
                                    <h3 className="font-bold text-slate-800 flex items-center"><Wallet className="w-4 h-4 mr-2 text-green-600"/> Origen de Ingresos</h3>
                                    <span className="text-xs font-mono text-slate-400">Detalle</span>
                                </div>
                                <div className="divide-y">
                                    {report.incomeByOrigin.length > 0 ? report.incomeByOrigin.map((item, i) => (
                                        <div key={i} className="p-4 flex justify-between items-center hover:bg-slate-50 transition-colors">
                                            <div className="flex items-center">
                                                <div className="w-2 h-2 rounded-full bg-green-400 mr-3"></div>
                                                <span className="text-sm font-medium text-slate-700">{item.name}</span>
                                            </div>
                                            <span className="font-bold text-slate-900">${item.total.toLocaleString('es-ES', { minimumFractionDigits: 2 })}</span>
                                        </div>
                                    )) : <div className="p-6 text-center text-slate-400 text-sm">No hubo ingresos en este periodo.</div>}
                                </div>
                                <div className="p-4 bg-green-50 border-t flex justify-between items-center">
                                    <span className="font-bold text-green-800 text-sm">Total Ingresos</span>
                                    <span className="font-bold text-green-800 text-lg">${report.totalIncome.toLocaleString('es-ES', { minimumFractionDigits: 2 })}</span>
                                </div>
                            </div>

                            <div className="bg-white rounded-xl shadow-lg border overflow-hidden">
                                <div className="p-4 border-b bg-slate-50 flex justify-between items-center">
                                    <h3 className="font-bold text-slate-800 flex items-center"><Landmark className="w-4 h-4 mr-2 text-red-600"/> Origen de Egresos</h3>
                                    <span className="text-xs font-mono text-slate-400">Detalle</span>
                                </div>
                                <div className="divide-y">
                                    {report.expenseByOrigin.length > 0 ? report.expenseByOrigin.map((item, i) => (
                                        <div key={i} className="p-4 flex justify-between items-center hover:bg-slate-50 transition-colors">
                                            <div className="flex items-center">
                                                <div className="w-2 h-2 rounded-full bg-red-400 mr-3"></div>
                                                <span className="text-sm font-medium text-slate-700">{item.name}</span>
                                            </div>
                                            <span className="font-bold text-slate-900">${item.total.toLocaleString('es-ES', { minimumFractionDigits: 2 })}</span>
                                        </div>
                                    )) : <div className="p-6 text-center text-slate-400 text-sm">No hubo egresos en este periodo.</div>}
                                </div>
                                <div className="p-4 bg-red-50 border-t flex justify-between items-center">
                                    <span className="font-bold text-red-800 text-sm">Total Egresos</span>
                                    <span className="font-bold text-red-800 text-lg">${report.totalExpense.toLocaleString('es-ES', { minimumFractionDigits: 2 })}</span>
                                </div>
                            </div>
                        </div>

                    </motion.div>
                )}
            </div>
        </>
    );
}

export default BookClosings;