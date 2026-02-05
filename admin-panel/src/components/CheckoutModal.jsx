import React, { useState } from 'react';
import { Check, Zap, Rocket, Crown, Star, X, Loader2 } from 'lucide-react';
import { PLANS, comparePlans, getPlanQuota, getDefaultExpirationDate } from '../utils/planHelpers';
import { updateDocument } from '../db';

const CheckoutModal = ({ isOpen, onClose, userData }) => {
    const [loading, setLoading] = useState(null); // ID do plano sendo "comprado"
    const [success, setSuccess] = useState(false);

    if (!isOpen) return null;

    const currentPlan = userData?.plan || 'start';

    const handleUpgrade = async (planId) => {
        setLoading(planId);

        // Simulação de delay de pagamento
        await new Promise(resolve => setTimeout(resolve, 2000));

        try {
            await updateDocument('users', userData.id, {
                plan: planId,
                plan_expires_at: getDefaultExpirationDate().toISOString(),
                updated_at: new Date().toISOString()
            });

            setSuccess(true);
            setTimeout(() => {
                setSuccess(false);
                setLoading(null);
                onClose();
            }, 3000);
        } catch (error) {
            console.error("Erro ao atualizar plano:", error);
            alert("Erro ao processar upgrade. Tente novamente.");
            setLoading(null);
        }
    };

    const planList = [
        { ...PLANS.start, icon: Star, color: 'slate', isComingSoon: false },
        { ...PLANS.business, icon: Zap, color: 'blue', isComingSoon: true },
        { ...PLANS.premium, icon: Rocket, color: 'indigo', isComingSoon: true },
        { ...PLANS.enterprise, icon: Crown, color: 'amber', isComingSoon: true }
    ];

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white w-full max-w-5xl rounded-3xl shadow-2xl overflow-hidden flex flex-col md:flex-row max-h-[90vh] animate-in zoom-in-95 duration-300">

                {/* Lateral Esquerda - Branding/Info */}
                <div className="bg-slate-900 text-white p-8 md:w-1/3 flex flex-col justify-between">
                    <div>
                        <div className="flex items-center gap-2 mb-8">
                            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                                <Zap className="w-5 h-5 text-white fill-current" />
                            </div>
                            <span className="font-black tracking-tighter text-xl uppercase">Rede Conecta</span>
                        </div>

                        <h2 className="text-3xl font-bold mb-4 leading-tight">Valide sua rede com o Plano Piloto</h2>
                        <p className="text-slate-400 text-sm leading-relaxed">
                            Foco total em performance para sua primeira tela. Ideal para estabelecimentos únicos e foodtrucks.
                        </p>
                    </div>

                    <div className="hidden md:block">
                        <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                            <p className="text-xs text-slate-400 uppercase font-bold tracking-widest mb-2">MVP - Food Truck</p>
                            <p className="text-xs text-slate-300">Este plano foi desenhado para validação comercial rápida com baixo investimento.</p>
                        </div>
                    </div>
                </div>

                {/* Área Principal - Planos */}
                <div className="flex-1 p-8 overflow-y-auto relative">
                    <button
                        onClick={onClose}
                        className="absolute top-6 right-6 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-all"
                    >
                        <X className="w-6 h-6" />
                    </button>

                    {success ? (
                        <div className="h-full flex flex-col items-center justify-center text-center animate-in fade-in zoom-in-90 duration-500">
                            <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-6">
                                <Check className="w-12 h-12" strokeWidth={3} />
                            </div>
                            <h3 className="text-2xl font-bold text-slate-900 mb-2">Assinatura Atualizada!</h3>
                            <p className="text-slate-500">Seu plano foi alterado com sucesso. Boas transmissões!</p>
                        </div>
                    ) : (
                        <>
                            <div className="mb-8">
                                <h3 className="text-lg font-bold text-slate-800">Assinaturas Disponíveis</h3>
                                <p className="text-sm text-slate-500">Selecione o plano ideal para sua fase atual.</p>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {planList.map((plan) => {
                                    const isCurrent = currentPlan === plan.id;
                                    const Icon = plan.icon;
                                    const isPerforming = loading === plan.id;
                                    const isComingSoon = plan.isComingSoon;

                                    return (
                                        <div
                                            key={plan.id}
                                            className={`p-6 rounded-2xl border-2 transition-all flex flex-col ${isCurrent
                                                ? 'border-blue-600 bg-blue-50/50 ring-4 ring-blue-100'
                                                : isComingSoon
                                                    ? 'border-slate-50 bg-slate-50/30 opacity-60 grayscale-[0.5]'
                                                    : 'border-slate-100 hover:border-slate-300 bg-white shadow-sm'
                                                }`}
                                        >
                                            <div className="flex justify-between items-start mb-4">
                                                <div className={`p-2 rounded-lg ${isComingSoon ? 'bg-slate-200 text-slate-400' : `bg-${plan.color}-100 text-${plan.color}-600`}`}>
                                                    <Icon className="w-5 h-5" />
                                                </div>
                                                {isCurrent ? (
                                                    <span className="text-[10px] font-black uppercase tracking-widest bg-blue-600 text-white px-2 py-0.5 rounded">Plano Atual</span>
                                                ) : isComingSoon ? (
                                                    <span className="text-[10px] font-black uppercase tracking-widest bg-slate-200 text-slate-500 px-2 py-0.5 rounded">Em breve</span>
                                                ) : null}
                                            </div>

                                            <h4 className="font-bold text-slate-900 text-lg">{plan.name}</h4>
                                            <div className="flex items-baseline gap-1 mt-1 mb-4">
                                                <span className="text-2xl font-black text-slate-900">R$ {plan.price.toFixed(2)}</span>
                                                <span className="text-slate-400 text-xs">/mês</span>
                                            </div>

                                            <div className="space-y-2 mb-8 flex-1">
                                                {plan.features.map((feature, idx) => (
                                                    <div key={idx} className="flex items-start gap-2">
                                                        <Check className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 ${isComingSoon ? 'text-slate-300' : 'text-emerald-500'}`} />
                                                        <span className="text-xs text-slate-600 leading-tight">{feature}</span>
                                                    </div>
                                                ))}
                                            </div>

                                            <button
                                                disabled={isCurrent || loading || isComingSoon}
                                                onClick={() => handleUpgrade(plan.id)}
                                                className={`w-full py-2.5 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${isCurrent
                                                    ? 'bg-slate-100 text-slate-400 cursor-default'
                                                    : isComingSoon
                                                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed border-dashed border-2 border-slate-200'
                                                        : isPerforming
                                                            ? 'bg-blue-600 text-white cursor-wait'
                                                            : comparePlans(currentPlan, plan.id) === 'upgrade'
                                                                ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-md hover:shadow-lg'
                                                                : 'bg-slate-800 text-white hover:bg-slate-900'
                                                    }`}
                                            >
                                                {isPerforming ? (
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                ) : isCurrent ? (
                                                    'Ativo'
                                                ) : isComingSoon ? (
                                                    'Expansão Futura'
                                                ) : comparePlans(currentPlan, plan.id) === 'upgrade' ? (
                                                    'Fazer Upgrade'
                                                ) : (
                                                    'Trocar Plano'
                                                )}
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>

                            <p className="mt-8 text-[10px] text-center text-slate-400">
                                Pagamento processado de forma segura. Ao assinar, você concorda com nossos termos de serviço.
                            </p>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CheckoutModal;
