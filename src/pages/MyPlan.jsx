import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { collection, onSnapshot, query, where, orderBy } from 'firebase/firestore';
import {
    Package, Calendar, TrendingUp, CheckCircle, XCircle,
    ArrowRight, Zap, Shield, Crown, Rocket, Star, Info, Layers
} from 'lucide-react';
import {
    PLANS,
    getPlanName,
    getPlanQuota,
    getPlanPrice,
    getPlanFeatures,
    getPlanStatus,
    formatExpirationDate,
    getDaysUntilExpiration,
    calculateUsedScreens
} from '../utils/planHelpers';

const PlanCard = ({ plan, currentPlan, onSelect }) => {
    const isCurrent = currentPlan === plan.id;
    const planIcons = {
        start: Zap,
        business: TrendingUp,
        premium: Shield,
        enterprise: Crown,
        unlimited: Rocket
    };
    const Icon = planIcons[plan.id] || Package;

    return (
        <div className={`relative bg-white rounded-[2.5rem] p-8 transition-all duration-500 border-2 flex flex-col group ${isCurrent
            ? 'border-indigo-600 shadow-2xl shadow-indigo-600/10 scale-[1.02]'
            : 'border-slate-100 hover:border-indigo-200 hover:shadow-xl'
            }`}>

            {isCurrent && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 bg-indigo-600 text-white text-[10px] font-black px-4 py-1.5 rounded-full uppercase tracking-[0.2em] Outfit shadow-lg">
                    Seu Plano Ativo
                </div>
            )}

            <div className="flex flex-col items-center mb-8 text-center pt-4">
                <div className={`w-16 h-16 mb-4 rounded-3xl flex items-center justify-center transition-transform group-hover:rotate-6 duration-500 ${isCurrent ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-600/30' : 'bg-slate-50 text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-400'}`}>
                    <Icon className="w-8 h-8" />
                </div>
                <h3 className="text-2xl font-black text-slate-800 Outfit tracking-tight">{plan.displayName}</h3>
                <div className="mt-4 flex items-baseline justify-center">
                    <span className="text-4xl font-black text-slate-900 Outfit transition-colors group-hover:text-indigo-600">
                        {plan.price === 0 ? 'Grátis' : `R$ ${plan.price.toFixed(0)}`}
                    </span>
                    <span className="text-xs font-bold text-slate-400 ml-1">/mês</span>
                </div>
                <div className="mt-2 inline-flex items-center px-3 py-1 bg-slate-100 rounded-full text-[10px] font-black text-slate-500 uppercase tracking-widest">
                    {plan.quota === Infinity ? 'Rede Ilimitada' : `${plan.quota} Conexões Ativas`}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto mb-8 space-y-4 pr-2">
                {plan.features.map((feature, idx) => (
                    <div key={idx} className="flex items-start text-xs font-bold text-slate-600 group-hover:text-slate-900 transition-colors">
                        <CheckCircle className={`w-4 h-4 mr-3 mt-0.5 flex-shrink-0 ${isCurrent ? 'text-indigo-500' : 'text-emerald-500'}`} />
                        <span className="leading-relaxed italic">{feature}</span>
                    </div>
                ))}
            </div>

            <button
                onClick={() => onSelect(plan.id)}
                disabled={isCurrent}
                className={`w-full py-4 rounded-2xl font-black text-xs Outfit uppercase tracking-[0.2em] transition-all duration-300 flex items-center justify-center gap-2 ${isCurrent
                    ? 'bg-slate-100 text-slate-400 cursor-default'
                    : 'bg-slate-900 text-white hover:bg-black hover:translate-y-[-2px] shadow-xl shadow-slate-900/10'
                    }`}
            >
                {isCurrent ? 'Configurado' : 'Fazer Upgrade'}
                {!isCurrent && <ArrowRight className="w-4 h-4" />}
            </button>
        </div>
    );
};

const MyPlan = () => {
    const { userData, currentUser } = useAuth();
    const [campaigns, setCampaigns] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!currentUser) return;

        const q = query(
            collection(db, "campaigns"),
            where("ownerId", "==", currentUser.uid),
            orderBy("createdAt", "desc")
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            setCampaigns(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            setLoading(false);
        }, (error) => {
            console.error(error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [currentUser?.uid]);

    if (loading || !userData || !userData.plan) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="relative w-16 h-16">
                    <div className="absolute inset-0 border-4 border-indigo-100 rounded-full"></div>
                    <div className="absolute inset-0 border-4 border-indigo-600 rounded-full border-t-transparent animate-spin"></div>
                </div>
            </div>
        );
    }

    const currentPlanId = userData.plan || 'start';
    const planStatus = getPlanStatus(userData.planExpiresAt);
    const usedScreens = calculateUsedScreens(campaigns);
    const totalScreens = getPlanQuota(currentPlanId);
    const usagePercentage = totalScreens === Infinity ? 0 : (usedScreens / totalScreens) * 100;

    const handleSelectPlan = (planId) => {
        alert(`Iniciando Checkout seguro para o plano ${PLANS[planId].displayName}...`);
    };

    return (
        <div className="space-y-10 animate-fade-in pb-10">
            {/* Page Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-2 border-b border-slate-200/60">
                <div>
                    <div className="flex items-center space-x-2 mb-2">
                        <Shield className="w-5 h-5 text-indigo-600" />
                        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-500 Outfit">Subscription & Quota</span>
                    </div>
                    <h2 className="text-4xl font-black text-slate-800 Outfit tracking-tight leading-none">Meu Plano</h2>
                    <p className="text-sm font-bold text-slate-400 mt-2 italic flex items-center gap-2">
                        Gerencie seu nível de acesso e monitoramento de recursos
                    </p>
                </div>
            </div>

            {/* Subscription Summary Banner */}
            <div className="relative overflow-hidden bg-gradient-to-r from-slate-900 to-indigo-950 rounded-[2.5rem] p-10 md:p-14 text-white shadow-2xl shadow-indigo-900/40">
                <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none transform translate-x-1/4 -translate-y-1/4 rotate-45">
                    <Crown className="w-80 h-80" />
                </div>

                <div className="relative z-10 grid grid-cols-1 lg:grid-cols-3 gap-12 items-center">
                    {/* Active Plan Info */}
                    <div className="flex items-center space-x-8">
                        <div className="w-24 h-24 rounded-[2rem] bg-indigo-600 flex items-center justify-center shadow-2xl shadow-indigo-600/30 ring-8 ring-white/5">
                            <Zap className="w-10 h-10" />
                        </div>
                        <div>
                            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-400 mb-2 block">Assinatura Ativa</span>
                            <h3 className="text-4xl font-black Outfit tracking-tighter mb-1">{getPlanName(currentPlanId)}</h3>
                            <div className="flex items-center space-x-2 text-indigo-200/60 font-black text-[10px] uppercase italic tracking-widest">
                                <Star className="w-3 h-3 fill-current" />
                                <span>Privilégios Premium</span>
                            </div>
                        </div>
                    </div>

                    {/* Expiration Stat */}
                    <div className="bg-white/5 backdrop-blur-md rounded-[2rem] p-8 border border-white/10 relative group">
                        <div className="flex justify-between items-center mb-4">
                            <span className="text-[10px] font-black uppercase tracking-widest text-indigo-300 italic">Validade da Licença</span>
                            <Calendar className="w-4 h-4 text-indigo-400" />
                        </div>
                        <div className="text-3xl font-black Outfit mb-1 tracking-tight">{formatExpirationDate(userData.planExpiresAt)}</div>
                        <div className="text-xs font-bold text-indigo-100/40 italic flex items-center gap-2">
                            Faltam <span className="text-white">{getDaysUntilExpiration(userData.planExpiresAt)} dias</span> para renovação
                        </div>
                        {getDaysUntilExpiration(userData.planExpiresAt) < 7 && (
                            <div className="mt-4 flex items-center space-x-2 text-amber-400 bg-amber-400/10 px-3 py-1.5 rounded-xl border border-amber-400/20">
                                <AlertTriangle className="w-3 h-3" />
                                <span className="text-[9px] font-black uppercase tracking-tighter">Renove em breve</span>
                            </div>
                        )}
                    </div>

                    {/* Usage ProgressStat */}
                    <div className="bg-white/5 backdrop-blur-md rounded-[2rem] p-8 border border-white/10">
                        <div className="flex justify-between items-center mb-4">
                            <span className="text-[10px] font-black uppercase tracking-widest text-indigo-300 italic">Ocupação de Rede</span>
                            <TrendingUp className="w-4 h-4 text-indigo-400" />
                        </div>
                        <div className="flex items-baseline space-x-2 mb-4">
                            <span className="text-4xl font-black Outfit">{usedScreens}</span>
                            <span className="text-indigo-300 font-bold">/ {totalScreens === Infinity ? '∞' : totalScreens}</span>
                            <span className="text-[10px] font-black text-indigo-400/60 uppercase ml-2 tracking-widest">Telas</span>
                        </div>
                        <div className="w-full bg-white/10 h-3 rounded-full overflow-hidden">
                            <div
                                className={`h-full transition-all duration-1000 ease-out rounded-full ${usagePercentage >= 90 ? 'bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.5)]' : 'bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]'}`}
                                style={{ width: `${Math.min(usagePercentage, 100)}%` }}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Plan Comparison Grid */}
            <div className="space-y-8">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pl-4 border-l-4 border-indigo-600">
                    <div>
                        <h3 className="text-2xl font-black text-slate-800 Outfit tracking-tight">Expanda seu Alcance</h3>
                        <p className="text-sm font-bold text-slate-400 italic">Compare planos e escolha a escala ideal para seu negócio</p>
                    </div>
                    <div className="flex items-center space-x-2 bg-indigo-50 px-4 py-2 rounded-full border border-indigo-100">
                        <Shield className="w-4 h-4 text-indigo-600" />
                        <span className="text-[10px] font-black uppercase text-indigo-700 tracking-widest">Seguro de Conectividade Incluso</span>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                    {Object.values(PLANS).filter(p => p.id !== 'unlimited').map(plan => (
                        <PlanCard
                            key={plan.id}
                            plan={plan}
                            currentPlan={currentPlanId}
                            onSelect={handleSelectPlan}
                        />
                    ))}
                </div>
            </div>

            {/* FAQ / Info Section */}
            <div className="bg-slate-50 rounded-[2.5rem] p-10 border border-slate-100 flex flex-col md:flex-row items-center gap-10">
                <div className="flex-shrink-0 w-20 h-20 bg-white rounded-3xl shadow-sm border border-slate-200 flex items-center justify-center text-indigo-600">
                    <Info className="w-10 h-10" />
                </div>
                <div className="flex-1 space-y-4">
                    <h4 className="text-lg font-black text-slate-800 Outfit italic uppercase tracking-widest leading-none">Configurações de Licenciamento</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-4">
                        <div className="flex items-start space-x-3 group">
                            <div className="w-1.5 h-1.5 rounded-full bg-indigo-600 mt-2 flex-shrink-0 transition-transform group-hover:scale-150 duration-300" />
                            <p className="text-xs font-bold text-slate-600 leading-relaxed italic">Upload de bibliotecas MaaS ilimitado em todos os níveis de conta.</p>
                        </div>
                        <div className="flex items-start space-x-3 group">
                            <div className="w-1.5 h-1.5 rounded-full bg-indigo-600 mt-2 flex-shrink-0 transition-transform group-hover:scale-150 duration-300" />
                            <p className="text-xs font-bold text-slate-600 leading-relaxed italic">Upgrade de quota processado em tempo real via Cloud Engine.</p>
                        </div>
                        <div className="flex items-start space-x-3 group">
                            <div className="w-1.5 h-1.5 rounded-full bg-indigo-600 mt-2 flex-shrink-0 transition-transform group-hover:scale-150 duration-300" />
                            <p className="text-xs font-bold text-slate-600 leading-relaxed italic">Renovação automática vinculada ao token wallet (se habilitado).</p>
                        </div>
                        <div className="flex items-start space-x-3 group">
                            <div className="w-1.5 h-1.5 rounded-full bg-indigo-600 mt-2 flex-shrink-0 transition-transform group-hover:scale-150 duration-300" />
                            <p className="text-xs font-bold text-slate-600 leading-relaxed italic">Suporte VIP MaaS disponível 24/7 para planos Business e superiores.</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MyPlan;
