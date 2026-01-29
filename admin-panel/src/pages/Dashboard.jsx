import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, query, orderBy, where } from 'firebase/firestore';
import {
    Monitor, CheckCircle, AlertTriangle, Play, Clock, Package,
    Sparkles, Zap, Coins, ArrowRight, Calendar
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import {
    getPlanName, getPlanQuota,
    getDaysUntilExpiration, calculateUsedScreens
} from '../utils/planHelpers';
import { useNavigate } from 'react-router-dom';

const StatCard = ({ icon: Icon, label, value, color, subtext }) => (
    <div className="bg-white rounded-3xl p-6 border border-slate-100 premium-shadow group hover:border-indigo-200 transition-all duration-300">
        <div className="flex justify-between items-start mb-4">
            <div className={`p-3 rounded-2xl ${color} text-white shadow-lg`}>
                <Icon className="w-6 h-6" />
            </div>
        </div>
        <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">{label}</p>
        <h3 className="text-3xl font-black text-slate-800 tracking-tight Outfit mb-2">{value}</h3>
        <p className="text-[11px] font-bold text-slate-500 italic">{subtext}</p>
    </div>
);

const Dashboard = () => {
    const { userData, currentUser } = useAuth();
    const navigate = useNavigate();
    const [terminals, setTerminals] = useState([]);
    const [campaigns, setCampaigns] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const isCliente = userData?.role === 'cliente';

    useEffect(() => {
        if (!currentUser || !userData) return;

        console.log("Dashboard: Ativando listeners para", userData.role);

        let unsubscribeT = () => { };
        let unsubscribeC = () => { };

        // Timeout preventivo de 8 segundos
        const timeout = setTimeout(() => {
            setLoading(false);
        }, 8000);

        try {
            // Query de Terminais (Lido por todos os papéis)
            const qT = query(collection(db, "terminals"), orderBy("lastSeen", "desc"));
            unsubscribeT = onSnapshot(qT, (snap) => {
                setTerminals(snap.docs.map(d => ({ id: d.id, ...d.data() })));
            }, (err) => {
                console.error("Dashboard Terminal Error:", err);
                // Não bloqueamos a UI por erro nos terminais para clientes
            });

            // Query de Campanhas (Diferenciada por papel)
            const qC = isCliente
                ? query(collection(db, "campaigns"), where("ownerId", "==", currentUser.uid), orderBy("createdAt", "desc"))
                : query(collection(db, "campaigns"), orderBy("createdAt", "desc"));

            unsubscribeC = onSnapshot(qC, (snap) => {
                setCampaigns(snap.docs.map(d => ({ id: d.id, ...d.data() })));
                setLoading(false);
                clearTimeout(timeout);
            }, (err) => {
                console.error("Dashboard Campaign Error:", err);
                setError(`Erro ao carregar campanhas: ${err.message}`);
                setLoading(false);
                clearTimeout(timeout);
            });
        } catch (e) {
            console.error("Dashboard Effect Error:", e);
            setLoading(false);
        }

        return () => {
            unsubscribeT();
            unsubscribeC();
            clearTimeout(timeout);
        };
    }, [currentUser?.uid, userData?.role]);

    const stats = useMemo(() => {
        if (isCliente) {
            return [
                { icon: Play, label: 'Suas Campanhas', value: campaigns.length, color: 'bg-indigo-600', subtext: 'Criadas por você' },
                { icon: Monitor, label: 'Telas Ativas', value: calculateUsedScreens(campaigns), color: 'bg-blue-600', subtext: 'Ocupação de quota' },
                { icon: Clock, label: 'Em Análise', value: campaigns.filter(c => !c.is_active).length, color: 'bg-amber-500', subtext: 'Aguardando publicação' },
                { icon: Coins, label: 'Saldo Atual', value: userData?.tokens || 0, color: 'bg-emerald-500', subtext: 'Tokens para IA' },
            ];
        } else {
            return [
                { icon: Monitor, label: 'Parque Total', value: terminals.length, color: 'bg-indigo-600', subtext: 'Terminais registrados' },
                {
                    icon: CheckCircle, label: 'Online Agora', value: terminals.filter(t => {
                        const lastSeen = t.lastSeen;
                        const lastSeenMs = lastSeen?.seconds ? lastSeen.seconds * 1000 : new Date(lastSeen).getTime();
                        return Date.now() - lastSeenMs < 60000;
                    }).length, color: 'bg-emerald-500', subtext: 'Ativos no sistema'
                },
                { icon: Play, label: 'Campanhas', value: campaigns.length, color: 'bg-blue-600', subtext: 'Total no MaaS' },
                { icon: AlertTriangle, label: 'Pendentes', value: campaigns.filter(c => !c.is_active).length, color: 'bg-rose-500', subtext: 'Requerem validação' },
            ];
        }
    }, [campaigns, terminals, isCliente, userData]);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px]">
                <div className="w-12 h-12 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin mb-4" />
                <p className="text-slate-400 font-bold italic animate-pulse">Sincronizando dados...</p>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-fade-in">
            {error && (
                <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl text-amber-800 text-sm font-bold flex items-center space-x-3">
                    <AlertTriangle className="w-5 h-5" />
                    <span>{error}</span>
                </div>
            )}

            {/* Welcome Hero */}
            <div className="bg-gradient-premium rounded-[2.5rem] p-10 md:p-12 text-white shadow-2xl relative overflow-hidden">
                <Sparkles className="absolute top-0 right-0 w-64 h-64 opacity-5 translate-x-1/4 -translate-y-1/4" />
                <div className="relative z-10">
                    <h2 className="text-4xl font-black Outfit tracking-tight mb-2">
                        Olá, {userData?.displayName?.split(' ')[0] || 'Bem-vindo'}!
                    </h2>
                    <p className="text-indigo-200 font-medium max-w-md">
                        {isCliente ? 'Aqui está o resumo da sua rede de publicidade digital.' : 'Consolidação de métricas operacionais do sistema.'}
                    </p>

                    {isCliente && (
                        <div className="mt-6 flex flex-wrap gap-4">
                            <div className="bg-white/10 backdrop-blur-md px-4 py-2 rounded-xl border border-white/10 text-xs">
                                <span className="text-indigo-300 uppercase tracking-widest font-black block text-[8px] mb-1">Plano</span>
                                <span className="font-bold">{getPlanName(userData?.plan)}</span>
                            </div>
                            <div className="bg-white/10 backdrop-blur-md px-4 py-2 rounded-xl border border-white/10 text-xs">
                                <span className="text-indigo-300 uppercase tracking-widest font-black block text-[8px] mb-1">Validade</span>
                                <span className="font-bold">{getDaysUntilExpiration(userData?.planExpiresAt)} dias</span>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {stats.map((s, i) => <StatCard key={i} {...s} />)}
            </div>

            {/* Quick Actions / Activity */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 bg-white rounded-[2rem] p-8 border border-slate-100 premium-shadow">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-xl font-black text-slate-800 Outfit">Atividade Recente</h3>
                        <button onClick={() => navigate('/campaigns')} className="text-xs font-black text-indigo-600 flex items-center space-x-1 hover:underline">
                            <span>Ver tudo</span>
                            <ArrowRight className="w-3 h-3" />
                        </button>
                    </div>
                    <div className="space-y-4">
                        {campaigns.slice(0, 3).map(c => (
                            <div key={c.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                <div className="flex items-center space-x-4">
                                    <div className={`p-3 rounded-xl ${c.is_active ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-200 text-slate-400'}`}>
                                        <Play className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <p className="font-bold text-slate-800 text-sm leading-none">{c.name}</p>
                                        <p className="text-[10px] text-slate-400 mt-1 uppercase font-black tracking-widest">
                                            {c.targetTerminals?.length || 0} Telas • {c.createdAt?.seconds ? new Date(c.createdAt.seconds * 1000).toLocaleDateString() : 'Aguardando'}
                                        </p>
                                    </div>
                                </div>
                                <span className={`text-[9px] font-black px-3 py-1 rounded-full uppercase ${c.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                    {c.is_active ? 'Ativa' : 'Pendente'}
                                </span>
                            </div>
                        ))}
                        {campaigns.length === 0 && <p className="text-center py-6 text-slate-300 italic">Nenhuma atividade registrada.</p>}
                    </div>
                </div>

                <div className="bg-white rounded-[2rem] p-8 border border-slate-100 premium-shadow h-full">
                    <h3 className="text-xl font-black text-slate-800 Outfit mb-4">Eficiência de Rede</h3>
                    {(() => {
                        const used = calculateUsedScreens(campaigns);
                        const quota = getPlanQuota(userData?.plan);
                        const perc = quota === Infinity ? (used > 0 ? 50 : 0) : (used / quota) * 100;
                        return (
                            <div className="space-y-4">
                                <div className="flex justify-between items-end">
                                    <span className="text-4xl font-black text-indigo-600 Outfit">{used}</span>
                                    <span className="text-xs font-black text-slate-400 uppercase tracking-widest">{Math.round(perc)}% do Uso</span>
                                </div>
                                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                                    <div className="bg-indigo-600 h-full transition-all duration-1000" style={{ width: `${Math.min(perc, 100)}%` }} />
                                </div>
                                <p className="text-[10px] text-slate-400 font-bold italic">
                                    {used >= quota ? 'Limite atingido! Considere um upgrade.' : 'Sua quota está dentro dos limites do plano.'}
                                </p>
                            </div>
                        );
                    })()}
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
