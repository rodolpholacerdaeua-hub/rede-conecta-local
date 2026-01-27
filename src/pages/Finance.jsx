import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, query, orderBy, doc, updateDoc, where } from 'firebase/firestore';
import { DollarSign, CreditCard, TrendingUp, AlertTriangle, CheckCircle, XCircle, Clock, Sparkles } from 'lucide-react';

const FinanceCard = ({ title, value, icon: Icon, color, subtitle }) => (
    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex justify-between items-start">
            <div>
                <p className="text-sm font-medium text-slate-500">{title}</p>
                <h3 className="text-2xl font-bold text-slate-800 mt-1">{value}</h3>
                {subtitle && <p className="text-xs text-slate-400 mt-1">{subtitle}</p>}
            </div>
            <div className={`p-3 rounded-lg ${color}`}>
                <Icon className="w-6 h-6 text-white" />
            </div>
        </div>
    </div>
);

const Finance = () => {
    const [campaigns, setCampaigns] = useState([]);
    const [billingLogs, setBillingLogs] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Campanhas para controle de status financeiro
        const qC = query(collection(db, "campaigns"), orderBy("createdAt", "desc"));
        const unsubscribeC = onSnapshot(qC, (snapshot) => {
            setCampaigns(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });

        // Logs de tarifação (IA fees)
        const qB = query(collection(db, "billing"), orderBy("createdAt", "desc"));
        const unsubscribeB = onSnapshot(qB, (snapshot) => {
            setBillingLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            setLoading(false);
        });

        return () => {
            unsubscribeC();
            unsubscribeB();
        };
    }, []);

    const toggleFinanceStatus = async (id, current) => {
        try {
            await updateDoc(doc(db, "campaigns", id), {
                status_financeiro: !current
            });
        } catch (error) {
            console.error(error);
        }
    };

    const totalRevenue = billingLogs.reduce((acc, log) => acc + (log.amount || 0), 0);
    const pendingCampaigns = campaigns.filter(c => !c.status_financeiro).length;

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold text-slate-800">Financeiro & Faturamento</h2>
                <p className="text-slate-500">Gestão de receitas MaaS e taxas de criação de IA.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <FinanceCard
                    title="Receita de Criação (IA)"
                    value={`R$ ${totalRevenue.toFixed(2)}`}
                    icon={Sparkles}
                    color="bg-indigo-600"
                    subtitle="Acumulado de taxas MaaS"
                />
                <FinanceCard
                    title="Campanhas Suspensas"
                    value={pendingCampaigns}
                    icon={AlertTriangle}
                    color="bg-red-500"
                    subtitle="Inadimplência detectada"
                />
                <FinanceCard
                    title="Previsão Mensal (MRR)"
                    value={`R$ ${(campaigns.length * 150).toFixed(2)}`}
                    icon={TrendingUp}
                    color="bg-emerald-500"
                    subtitle="Baseado em ativos na rede"
                />
            </div>

            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                <div className="p-5 border-b border-slate-100 flex justify-between items-center">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2">
                        <CreditCard className="w-5 h-5 text-blue-600" />
                        Status de Faturamento por Campanha
                    </h3>
                </div>
                <table className="w-full text-left">
                    <thead>
                        <tr className="bg-slate-50 text-xs font-bold text-slate-500 uppercase tracking-wider">
                            <th className="px-6 py-4">Campanha</th>
                            <th className="px-6 py-4">Data Início</th>
                            <th className="px-6 py-4">Status Pagamento</th>
                            <th className="px-6 py-4 text-right">Ação Comercial</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 italic">
                        {campaigns.map(c => (
                            <tr key={c.id} className="hover:bg-slate-50/50 transition-colors">
                                <td className="px-6 py-4 font-medium text-slate-700">{c.name}</td>
                                <td className="px-6 py-4 text-sm text-slate-500">
                                    {c.createdAt?.seconds ? new Date(c.createdAt.seconds * 1000).toLocaleDateString() : '---'}
                                </td>
                                <td className="px-6 py-4">
                                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${c.status_financeiro ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                                        {c.status_financeiro ? <CheckCircle className="w-3 h-3 mr-1" /> : <XCircle className="w-3 h-3 mr-1" />}
                                        {c.status_financeiro ? 'EM DIA' : 'INADIMPLENTE'}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <button
                                        onClick={() => toggleFinanceStatus(c.id, c.status_financeiro)}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${c.status_financeiro ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'}`}
                                    >
                                        {c.status_financeiro ? 'Suspender Exibição' : 'Liberar Anúncio'}
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                <div className="p-5 border-b border-slate-100">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2">
                        <Clock className="w-5 h-5 text-indigo-600" />
                        Histórico de Taxas de Criação (IA)
                    </h3>
                </div>
                <div className="p-0">
                    {billingLogs.length > 0 ? (
                        <table className="w-full text-left">
                            <thead className="bg-slate-50 text-[10px] font-bold text-slate-400 uppercase">
                                <tr>
                                    <th className="px-6 py-3">Transação</th>
                                    <th className="px-6 py-3">Campanha</th>
                                    <th className="px-6 py-3">Valor</th>
                                    <th className="px-6 py-3 text-right">Data</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {billingLogs.map(log => (
                                    <tr key={log.id} className="text-sm">
                                        <td className="px-6 py-4 font-mono text-xs text-slate-400">#IA-{log.id.slice(0, 6)}</td>
                                        <td className="px-6 py-4 text-slate-600">{log.campaignName}</td>
                                        <td className="px-6 py-4 font-bold text-slate-800">R$ {log.amount?.toFixed(2)}</td>
                                        <td className="px-6 py-4 text-right text-slate-400">
                                            {log.createdAt?.seconds ? new Date(log.createdAt.seconds * 1000).toLocaleString() : '---'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <div className="p-8 text-center text-slate-400 italic">
                            Nenhuma transação por IA registrada ainda.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Finance;
