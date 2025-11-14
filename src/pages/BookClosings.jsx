import React, { useState } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { Calendar, Download, TrendingUp, TrendingDown, DollarSign, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { exportToExcel } from '@/lib/excel';
import { useCompanyData } from '@/hooks/useCompanyData';
import { format, parseISO } from 'date-fns';
import { Label } from '@/components/ui/label';

const BookClosings = () => {
    const today = format(new Date(), 'yyyy-MM-dd');
    const [startDate, setStartDate] = useState(today);
    const [endDate, setEndDate] = useState(today);
    const [report, setReport] = useState(null);
    const [allTransactions] = useCompanyData('transactions');
    const { toast } = useToast();

    const generateReport = () => {
        if (!startDate || !endDate) {
            toast({ variant: 'destructive', title: "Fechas requeridas", description: "Por favor selecciona un rango de fechas." });
            return;
        }

        const start = parseISO(startDate);
        const end = parseISO(endDate);
        end.setHours(23, 59, 59, 999); // Include the whole end day

        const transactionsInPeriod = allTransactions.filter(t => {
            const tDate = new Date(t.date);
            return tDate >= start && tDate <= end;
        });

        const income = transactionsInPeriod.filter(t => t.type === 'income').reduce((sum, t) => sum + parseFloat(t.amount), 0);
        const expenses = transactionsInPeriod.filter(t => t.type === 'expense').reduce((sum, t) => sum + parseFloat(t.amount), 0);

        setReport({
            income,
            expenses,
            balance: income - expenses,
            transactions: transactionsInPeriod
        });
        
        toast({ title: "Reporte generado", description: `Cierre del ${format(start, 'dd/MM/yyyy')} al ${format(end, 'dd/MM/yyyy')}.` });
    };

    const handleExport = () => {
        if (!report || report.transactions.length === 0) {
            toast({ variant: 'destructive', title: "Error", description: "No hay datos para exportar. Genera un reporte primero." });
            return;
        }
        
        const dataToExport = report.transactions.map(t => ({
            'Fecha': format(new Date(t.date), 'dd/MM/yyyy'),
            'Descripcion': t.description,
            'Categoria': t.category,
            'Tipo': t.type === 'income' ? 'Ingreso' : 'Egreso',
            'Monto': t.type === 'income' ? parseFloat(t.amount) : -parseFloat(t.amount)
        }));
        
        const fileName = `Cierre_${format(parseISO(startDate), 'yyyy-MM-dd')}_a_${format(parseISO(endDate), 'yyyy-MM-dd')}`;
        exportToExcel(dataToExport, fileName);
    };
    
    return (
        <>
        <Helmet>
            <title>Cierres de Libros - JaiderHerTur26</title>
        </Helmet>
        <div className="space-y-6">
            <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
                <h1 className="text-4xl font-bold text-slate-900">Cierres de Libros</h1>
                <p className="text-slate-600">Genera cierres por rangos de fecha personalizados.</p>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-white rounded-xl shadow-lg p-6 border">
                <div className="flex flex-col sm:flex-row gap-4 items-end">
                    <div className="flex-1 w-full space-y-2">
                        <Label htmlFor="start-date">Fecha de Inicio</Label>
                        <input id="start-date" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full p-2 border rounded-lg" />
                    </div>
                    <div className="flex-1 w-full space-y-2">
                        <Label htmlFor="end-date">Fecha de Fin</Label>
                        <input id="end-date" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full p-2 border rounded-lg" />
                    </div>
                    <div className="flex gap-2">
                         <Button onClick={handleExport} variant="outline" className="bg-white"><Download className="w-4 h-4 mr-2" /> Exportar</Button>
                         <Button onClick={generateReport} className="bg-green-600 hover:bg-green-700">Generar Cierre</Button>
                    </div>
                </div>
            </motion.div>
            
            {report ? (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-green-100 p-6 rounded-lg border border-green-200"><TrendingUp className="text-green-600 mb-2" /> <p className="text-sm text-green-800">Ingresos</p> <p className="text-2xl font-bold text-green-900">${report.income.toLocaleString('es-ES', { minimumFractionDigits: 2 })}</p></div>
                        <div className="bg-red-100 p-6 rounded-lg border border-red-200"><TrendingDown className="text-red-600 mb-2" /> <p className="text-sm text-red-800">Gastos</p> <p className="text-2xl font-bold text-red-900">${report.expenses.toLocaleString('es-ES', { minimumFractionDigits: 2 })}</p></div>
                        <div className="bg-blue-100 p-6 rounded-lg border border-blue-200"><DollarSign className="text-blue-600 mb-2" /> <p className="text-sm text-blue-800">Balance</p> <p className="text-2xl font-bold text-blue-900">${report.balance.toLocaleString('es-ES', { minimumFractionDigits: 2 })}</p></div>
                    </div>
                    
                    <div className="bg-white rounded-xl shadow-lg border p-6">
                        <h2 className="text-xl font-bold mb-4">Transacciones del Período</h2>
                        {report.transactions.length > 0 ? (
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead><tr className="border-b"><th className="text-left p-2">Fecha</th><th className="text-left p-2">Descripción</th><th className="text-right p-2">Monto</th></tr></thead>
                                    <tbody>
                                        {report.transactions.map(t => (
                                            <tr key={t.id} className="border-b"><td className="p-2">{format(new Date(t.date), 'dd/MM/yyyy')}</td><td className="p-2">{t.description}</td><td className={`p-2 text-right font-semibold ${t.type === 'income' ? 'text-green-600':'text-red-600'}`}>{t.type === 'income' ? '+' : '-'}${parseFloat(t.amount).toLocaleString('es-ES', { minimumFractionDigits: 2 })}</td></tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <p className="text-slate-500 text-center py-8">No se encontraron transacciones en este período.</p>
                        )}
                    </div>
                </motion.div>
            ) : (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-16 bg-white rounded-xl shadow-lg border">
                    <BookOpen className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                    <p className="text-slate-500">Selecciona un período y genera un reporte.</p>
                </motion.div>
            )}
        </div>
        </>
    );
}

export default BookClosings;