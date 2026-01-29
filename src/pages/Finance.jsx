import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, query, orderBy, doc, updateDoc, where, increment, addDoc } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import {
    DollarSign, CreditCard, TrendingUp, AlertTriangle, CheckCircle,
    XCircle, Clock, Sparkles, Coins, ShoppingCart, History, ArrowUpRight, ArrowDownLeft, Monitor
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const FinanceCard = ({ title, value, icon: Icon, color, subtitle, onClick }) => (
    <div
        className={`bg-white rounded-3xl p-8 border border-slate-100 premium-shadow transition-all duration-300 group ${onClick ? 'cursor-pointer hover:border-indigo-300 hover:translate-y-[-4px]' : ''}`}
        onClick={onClick}
    >
        <div className="flex justify-between items-start mb-4">
            <div className={`p-4 rounded-2xl ${color} text-white shadow-lg group-hover:scale-110 transition-transform duration-500`}>
                <Icon className="w-7 h-7" />
            </div>
            {onClick && (
                <div className="p-2 bg-indigo-50 rounded-lg text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity">
                    <ArrowUpRight className="w-4 h-4" />
                </div>
            )}
        </div>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] Outfit mb-1">{title}</p>
        <h3 className="text-3xl font-black text-slate-800 tracking-tight Outfit">{value}</h3>
        {subtitle && <p className="text-[11px] font-bold text-slate-400 mt-2 italic">{subtitle}</p>}
    </div>
);

const Finance = () => {
    const { currentUser, userData } = useAuth();
    const [campaigns, setCampaigns] = useState([]);
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);

    const isCliente = userData?.role === 'cliente';
    const queryParams = new URLSearchParams(window.location.search);
    const paymentStatus = queryParams.get('status');

    useEffect(() => {
        if (paymentStatus === 'success') {
            alert("🎯 Pagamento recebido! Seus tokens serão creditados em instantes.");
            // Limpar URL
            window.history.replaceState({}, document.title, window.location.pathname);
        } else if (paymentStatus === 'failure') {
            alert("❌ O pagamento não foi concluído. Tente novamente.");
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    }, [paymentStatus]);

    useEffect(() => {
        if (!currentUser || !userData) return;

        const qC = isCliente
            ? query(collection(db, "campaigns"), where("ownerId", "==", currentUser.uid), orderBy("createdAt", "desc"))
            : query(collection(db, "campaigns"), orderBy("createdAt", "desc"));

        const unsubscribeC = onSnapshot(qC, (snapshot) => {
            setCampaigns(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });

        const qT = isCliente
            ? query(collection(db, "transactions"), where("uid", "==", currentUser.uid), orderBy("createdAt", "desc"))
            : query(collection(db, "transactions"), orderBy("createdAt", "desc"));

        const unsubscribeT = onSnapshot(qT, (snapshot) => {
            setTransactions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            setLoading(false);
        });

        return () => {
            unsubscribeC();
            unsubscribeT();
        };
    }, [currentUser?.uid, userData?.role, isCliente]);

    const handleBuyTokens = async (amount) => {
        try {
            const functions = getFunctions();
            const createPreference = httpsCallable(functions, 'createPreference');

            setLoading(true);
            const result = await createPreference({
                amount: amount,
                description: `Recarga de ${amount} tokens - Conecta Local`
            });

            if (result.data?.init_point) {
                // Redireciona para o Checkout do Mercado Pago
                window.location.href = result.data.init_point;
            } else {
                throw new Error("Erro ao gerar link de pagamento.");
            }
        } catch (e) {
            console.error("Payment Error:", e);
            alert(`Falha ao iniciar pagamento: ${e.message}`);
        } finally {
            setLoading(false);
        }
    };

    const totalRevenue = transactions.filter(t => t.type === 'debit').reduce((acc, t) => acc + (t.amount || 0), 0);
    const activeScreens = campaigns.filter(c => c.is_active).reduce((acc, c) => acc + (c.targetTerminals?.length || 0), 0);
    const totalTokensSold = transactions.filter(t => t.type === 'credit').reduce((acc, t) => acc + (t.amount || 0), 0);
    const totalInvestment = transactions.filter(t => t.type === 'credit').reduce((acc, t) => acc + (t.amount || 0), 0);

    return (
        <div className="space-y-10 animate-fade-in">
            {/* Header Hero */}
            <div className="bg-slate-900 rounded-[2.5rem] p-10 md:p-14 text-white relative overflow-hidden shadow-2xl shadow-slate-900/40">
                <div className="absolute top-0 right-0 p-12 opacity-10 pointer-events-none transform translate-x-1/4 -translate-y-1/4 rotate-12">
                    <History className="w-80 h-80" />
                </div>

                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
                    <div className="space-y-4">
                        <div className="flex items-center space-x-2">
                            <DollarSign className="w-5 h-5 text-indigo-400" />
                            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-400 Outfit">Billing & Ledger</span>
                        </div>
                        <h2 className="text-4xl md:text-5xl font-black tracking-tighter Outfit">
                            {isCliente ? 'Minha Carteira' : 'Financeiro MaaS'}
                        </h2>
                        <p className="text-slate-400 text-lg font-medium opacity-80 leading-relaxed max-w-md">
                            {isCliente
                                ? "Gerencie seus créditos de IA e acompanhe seu histórico de investimentos em marketing digital."
                                : "Visão consolidada da economia de tokens e faturamento bruto da rede Conecta."}
                        </p>
                    </div>

                    {isCliente && (
                        <div className="bg-white/5 backdrop-blur-xl rounded-[2rem] p-8 border border-white/10 flex flex-col items-center justify-center min-w-[280px]">
                            <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400 mb-2">Seu Saldo Agora</span>
                            <div className="text-5xl font-black Outfit mb-6 flex items-center space-x-4">
                                <span>{userData?.tokens || 0}</span>
                                <Coins className="w-10 h-10 text-amber-500 drop-shadow-[0_0_15px_rgba(245,158,11,0.5)]" />
                            </div>
                            <button
                                onClick={() => handleBuyTokens(100)}
                                className="w-full bg-white text-slate-900 px-8 py-4 rounded-2xl font-black text-sm Outfit uppercase tracking-widest hover:bg-slate-100 transition-all transform active:scale-95 flex items-center justify-center space-x-2 shadow-xl shadow-white/5"
                            >
                                <ShoppingCart className="w-4 h-4" />
                                <span>Comprar Tokens</span>
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Metrics Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <FinanceCard
                    title={isCliente ? "Saldo em Grão" : "Tokens no Sistema"}
                    value={isCliente ? `${userData?.tokens || 0}🪙` : `${totalTokensSold}🪙`}
                    icon={Coins}
                    color="bg-gradient-to-br from-amber-400 to-amber-600"
                    subtitle={isCliente ? "Pronto para gerar novos criativos" : "Massa de tokens vendida (Recargas)"}
                />
                <FinanceCard
                    title={isCliente ? "Fluxos de Mídia" : "Ocupação Operacional"}
                    value={isCliente ? campaigns.filter(c => c.is_active).length : activeScreens}
                    icon={isCliente ? CheckCircle : TrendingUp}
                    color="bg-gradient-to-br from-indigo-500 to-indigo-700"
                    subtitle={isCliente ? "Campanhas rodando agora" : "Slots de telas ocupados na rede"}
                />
                <FinanceCard
                    title={isCliente ? "Investido (Total)" : "Faturamento Real"}
                    value={isCliente ? `R$ ${totalInvestment.toFixed(2)}` : `R$ ${totalRevenue.toFixed(2)}`}
                    icon={DollarSign}
                    color="bg-gradient-to-br from-emerald-500 to-emerald-700"
                    subtitle={isCliente ? "Somatória das últimas recargas" : "Conversão de débitos industriais"}
                />
            </div>

            {/* Tables Area */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Transaction Ledger */}
                <div className="bg-white rounded-[2.5rem] border border-slate-100 premium-shadow overflow-hidden">
                    <div className="px-8 py-6 border-b border-slate-50 bg-slate-50/30 flex justify-between items-center text-center">
                        <div className="flex items-center space-x-3 mx-auto">
                            <History className="w-5 h-5 text-indigo-600" />
                            <h3 className="text-sm font-black text-slate-800 uppercase tracking-[0.2em] Outfit">Extrato de Movimentação</h3>
                        </div>
                    </div>

                    <div className="overflow-x-auto max-h-[500px]">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-white sticky top-0 z-10 border-b border-slate-100">
                                <tr>
                                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest Outfit">Histórico</th>
                                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest Outfit">Impacto</th>
                                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest Outfit text-right">Período</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {transactions.map(t => (
                                    <tr key={t.id} className="group hover:bg-slate-50/50 transition-colors">
                                        <td className="px-8 py-6">
                                            <div className="flex items-center space-x-4">
                                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${t.type === 'credit' ? 'bg-emerald-50 text-emerald-500' : 'bg-amber-50 text-amber-500'}`}>
                                                    {t.type === 'credit' ? <ArrowDownLeft className="w-5 h-5" /> : <ArrowUpRight className="w-5 h-5" />}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-black text-slate-800 Outfit tracking-tight leading-none mb-1.5">{t.description}</p>
                                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{t.userName || 'Master Account'}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className={`px-8 py-6 text-sm font-black Outfit ${t.type === 'credit' ? 'text-emerald-600' : 'text-amber-600'}`}>
                                            {t.type === 'credit' ? '+' : '-'}{t.amount} 🪙
                                        </td>
                                        <td className="px-8 py-6 text-right text-[11px] font-black text-slate-400 Outfit uppercase">
                                            {t.createdAt?.seconds ? new Date(t.createdAt.seconds * 1000).toLocaleDateString() : '-- / -- / --'}
                                        </td>
                                    </tr>
                                ))}
                                {transactions.length === 0 && (
                                    <tr>
                                        <td colSpan={3} className="px-8 py-20 text-center animate-pulse">
                                            <History className="w-12 h-12 text-slate-100 mx-auto mb-3" />
                                            <p className="text-slate-300 font-bold italic">Sem movimentações financeiras registradas.</p>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Billing Status for Campaigns */}
                <div className="bg-white rounded-[2.5rem] border border-slate-100 premium-shadow overflow-hidden">
                    <div className="px-8 py-6 border-b border-slate-50 bg-slate-50/30 flex justify-between items-center text-center">
                        <div className="flex items-center space-x-3 mx-auto">
                            <CreditCard className="w-5 h-5 text-indigo-600" />
                            <h3 className="text-sm font-black text-slate-800 uppercase tracking-[0.2em] Outfit">Controle de Ativações MaaS</h3>
                        </div>
                    </div>

                    <div className="overflow-x-auto max-h-[500px]">
                        <table className="w-full text-left border-collapse">
                            <tbody className="divide-y divide-slate-50">
                                {campaigns.map(c => (
                                    <tr key={c.id} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="px-8 py-6">
                                            <div className="flex items-center space-x-4">
                                                <div className={`p-2 rounded-lg ${c.is_active ? 'bg-emerald-50 text-emerald-500' : 'bg-slate-100 text-slate-400'}`}>
                                                    <Monitor className="w-5 h-5" />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-black text-slate-800 Outfit tracking-tight leading-none mb-1">{c.name}</p>
                                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">ID: {c.id}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-8 py-6">
                                            <span className={`inline-flex items-center px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${c.is_active ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-amber-50 text-amber-700 border-amber-100'}`}>
                                                {c.is_active ? 'Consumindo' : 'Pendente'}
                                            </span>
                                        </td>
                                        <td className="px-8 py-6 text-right">
                                            <div className="flex flex-col items-end">
                                                <span className="text-sm font-black text-slate-800 Outfit leading-none mb-1">{c.targetTerminals?.length || 0}</span>
                                                <span className="text-[9px] font-black text-slate-300 uppercase tracking-tighter">Endpoints</span>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Finance;
