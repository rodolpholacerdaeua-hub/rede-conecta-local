import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, query, orderBy, limit, where } from 'firebase/firestore';
import { Monitor, Play, AlertCircle, Clock, TrendingUp, DollarSign, CheckCircle, AlertTriangle, Activity } from 'lucide-react';

const StatCard = ({ icon: Icon, label, value, color, subtext }) => (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-start space-x-4">
        <div className={`p-3 rounded-lg ${color}`}>
            <Icon className="w-6 h-6 text-white" />
        </div>
        <div>
            <p className="text-sm font-medium text-slate-500">{label}</p>
            <h3 className="text-2xl font-bold text-slate-800 mt-1">{value}</h3>
            {subtext && <p className="text-xs text-slate-400 mt-1">{subtext}</p>}
        </div>
    </div>
);

const Dashboard = () => {
    const [terminals, setTerminals] = useState([]);
    const [campaigns, setCampaigns] = useState([]);
    const [billing, setBilling] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Terminais
        const qT = query(collection(db, "terminals"));
        const unsubscribeT = onSnapshot(qT, (snapshot) => {
            setTerminals(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });

        // Campanhas (para status financeiro)
        const qC = query(collection(db, "campaigns"));
        const unsubscribeC = onSnapshot(qC, (snapshot) => {
            setCampaigns(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });

        // Faturamento
        const qB = query(collection(db, "billing"));
        const unsubscribeB = onSnapshot(qB, (snapshot) => {
            setBilling(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            setLoading(false);
        });

        return () => {
            unsubscribeT();
            unsubscribeC();
            unsubscribeB();
        };
    }, []);

    const statsData = [
        { icon: Monitor, label: 'Total de Telas', value: terminals.length, color: 'bg-blue-600', subtext: 'Dispositivos registrados' },
        { icon: CheckCircle, label: 'Online Agora', value: terminals.filter(t => t.lastSeen && (Date.now() - t.lastSeen.seconds * 1000 < 60000)).length, color: 'bg-emerald-500', subtext: 'Ativos no último minuto' },
        { icon: AlertTriangle, label: 'Alertas', value: terminals.filter(t => t.lastSeen && (Date.now() - t.lastSeen.seconds * 1000 > 300000)).length, color: 'bg-amber-500', subtext: 'Offline por mais de 5 min' },
        { icon: DollarSign, label: 'Receita MaaS', value: `R$ ${billing.reduce((acc, curr) => acc + (curr.amount || 0), 0).toFixed(0)}`, color: 'bg-indigo-600', subtext: 'Taxas de criação IA' },
        { icon: Clock, label: 'Faturas Pendentes', value: campaigns.filter(c => !c.status_financeiro).length, color: 'bg-red-600', subtext: 'Aguardando pagamento' },
    ];

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800">Visão Geral</h2>
                    <p className="text-slate-500">Inteligência de Rede e Mídia-as-a-Service.</p>
                </div>
                <div className="bg-white px-4 py-2 rounded-lg border border-slate-200 text-xs font-bold text-slate-500 flex items-center gap-2">
                    <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                    SISTEMA OPERACIONAL
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
                {loading ? (
                    <div className="col-span-full py-12 text-center text-slate-400">Carregando métricas...</div>
                ) : (
                    statsData.map((stat, index) => (
                        <StatCard key={index} {...stat} />
                    ))
                )}
            </div>

            {/* Main Content Area */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Recent Activity */}
                <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-100 p-6">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="font-bold text-slate-800 flex items-center gap-2">
                            <Activity className="w-5 h-5 text-blue-600" />
                            Status da Rede (Tempo Real)
                        </h3>
                    </div>
                    <div className="h-64 flex items-center justify-center bg-slate-50 rounded-lg border border-slate-200 border-dashed">
                        <div className="text-center">
                            <TrendingUp className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                            <p className="text-slate-400 font-medium">Gráfico de desempenho será exibido aqui</p>
                            <p className="text-xs text-slate-400 mt-1">Conecte mais players para visualizar métricas de tráfego.</p>
                        </div>
                    </div>
                </div>

                {/* Status Financeiro Rápido */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
                    <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                        <DollarSign className="w-5 h-5 text-emerald-600" />
                        Saúde Financeira
                    </h3>
                    <div className="space-y-4">
                        <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-100">
                            <div className="flex justify-between items-center mb-1">
                                <span className="text-xs font-bold text-emerald-700 uppercase">Em Dia</span>
                                <span className="text-sm font-bold text-emerald-800">{campaigns.filter(c => c.status_financeiro).length}</span>
                            </div>
                            <div className="w-full bg-emerald-200 h-1 rounded-full overflow-hidden">
                                <div className="bg-emerald-600 h-full" style={{ width: `${(campaigns.filter(c => c.status_financeiro).length / (campaigns.length || 1)) * 100}%` }} />
                            </div>
                        </div>
                        <div className="p-3 rounded-lg bg-red-50 border border-red-100">
                            <div className="flex justify-between items-center mb-1">
                                <span className="text-xs font-bold text-red-700 uppercase">Inadimplentes</span>
                                <span className="text-sm font-bold text-red-800">{campaigns.filter(c => !c.status_financeiro).length}</span>
                            </div>
                            <div className="w-full bg-red-200 h-1 rounded-full overflow-hidden">
                                <div className="bg-red-600 h-full" style={{ width: `${(campaigns.filter(c => !c.status_financeiro).length / (campaigns.length || 1)) * 100}%` }} />
                            </div>
                        </div>
                        <p className="text-[10px] text-slate-400 italic mt-4">
                            * Campanhas inadimplentes são automaticamente substituídas por conteúdo de filler nos players.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
