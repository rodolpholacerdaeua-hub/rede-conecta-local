import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    Check, Zap, Rocket, Crown, Star, X, Loader2, Calendar,
    Copy, CheckCircle, Clock, QrCode, AlertTriangle, RefreshCw
} from 'lucide-react';
import { PLANS, comparePlans } from '../utils/planHelpers';
import { supabase } from '../supabase';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

// Step 1: Plan selection  |  Step 2: PIX QR code  |  Step 3: Success
const CheckoutModal = ({ isOpen, onClose, userData, initialPlanId }) => {
    const [step, setStep] = useState('select'); // select | pix | success | error
    const [loading, setLoading] = useState(null);
    const [pixData, setPixData] = useState(null);
    const [copied, setCopied] = useState(false);
    const [timeLeft, setTimeLeft] = useState(1800); // 30 min in seconds
    const [error, setError] = useState(null);
    const pollingRef = useRef(null);
    const timerRef = useRef(null);

    useEffect(() => {
        if (!isOpen) {
            setStep('select');
            setLoading(null);
            setPixData(null);
            setCopied(false);
            setTimeLeft(1800);
            setError(null);
            if (pollingRef.current) clearInterval(pollingRef.current);
            if (timerRef.current) clearInterval(timerRef.current);
        }
    }, [isOpen]);

    // If initialPlanId is provided, go straight to PIX
    useEffect(() => {
        if (isOpen && initialPlanId && step === 'select') {
            handleSelectPlan(initialPlanId);
        }
    }, [isOpen, initialPlanId]);

    const handleSelectPlan = async (planId) => {
        setLoading(planId);
        setError(null);

        try {
            // Refresh session first to ensure valid JWT
            await supabase.auth.refreshSession();

            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error('Sessão expirada. Faça login novamente.');

            const response = await fetch(`${SUPABASE_URL}/functions/v1/create-pix`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`,
                    'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
                },
                body: JSON.stringify({ plan_id: planId }),
            });

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.details || data.error || 'Erro ao criar pagamento');
            }

            setPixData({
                ...data,
                plan_id: planId,
            });
            setStep('pix');
            startPolling(data.payment_id);
            startTimer();
        } catch (err) {
            console.error('Checkout error:', err);
            setError(err.message);
            setStep('error');
        } finally {
            setLoading(null);
        }
    };

    const startPolling = useCallback((paymentId) => {
        if (pollingRef.current) clearInterval(pollingRef.current);

        pollingRef.current = setInterval(async () => {
            try {
                const { data, error } = await supabase
                    .from('payments')
                    .select('status')
                    .eq('id', paymentId)
                    .single();

                if (error) return;

                if (data.status === 'approved') {
                    clearInterval(pollingRef.current);
                    clearInterval(timerRef.current);
                    setStep('success');
                } else if (data.status === 'rejected' || data.status === 'cancelled') {
                    clearInterval(pollingRef.current);
                    clearInterval(timerRef.current);
                    setError('Pagamento não aprovado. Tente novamente.');
                    setStep('error');
                }
            } catch (e) {
                // Silently retry
            }
        }, 5000); // Poll every 5 seconds
    }, []);

    const startTimer = useCallback(() => {
        if (timerRef.current) clearInterval(timerRef.current);
        setTimeLeft(1800);

        timerRef.current = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) {
                    clearInterval(timerRef.current);
                    clearInterval(pollingRef.current);
                    setError('PIX expirou. Gere um novo código.');
                    setStep('error');
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    }, []);

    const formatTime = (seconds) => {
        const m = Math.floor(seconds / 60).toString().padStart(2, '0');
        const s = (seconds % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    };

    const handleCopy = async () => {
        if (!pixData?.pix_qr_code_text) return;
        try {
            await navigator.clipboard.writeText(pixData.pix_qr_code_text);
            setCopied(true);
            setTimeout(() => setCopied(false), 3000);
        } catch {
            // Fallback
            const ta = document.createElement('textarea');
            ta.value = pixData.pix_qr_code_text;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            setCopied(true);
            setTimeout(() => setCopied(false), 3000);
        }
    };

    const handleClose = () => {
        if (pollingRef.current) clearInterval(pollingRef.current);
        if (timerRef.current) clearInterval(timerRef.current);
        onClose(step === 'success');
    };

    if (!isOpen) return null;

    const currentPlan = userData?.plan || 'start';

    const planList = [
        { ...PLANS.weekly, icon: Calendar, period: '/semana', isComingSoon: false },
        { ...PLANS.start, icon: Star, period: '/mês', isComingSoon: false },
        { ...PLANS.business, icon: Zap, period: '/mês', isComingSoon: true },
        { ...PLANS.premium, icon: Rocket, period: '/mês', isComingSoon: true },
        { ...PLANS.enterprise, icon: Crown, period: '/mês', isComingSoon: true },
    ];

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white w-full max-w-5xl rounded-3xl shadow-2xl overflow-hidden flex flex-col md:flex-row max-h-[90vh] animate-in zoom-in-95 duration-300">

                {/* Lateral Branding */}
                <div className="bg-slate-900 text-white p-8 md:w-1/3 flex flex-col justify-between">
                    <div>
                        <div className="flex items-center gap-2 mb-8">
                            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                                <Zap className="w-5 h-5 text-white fill-current" />
                            </div>
                            <span className="font-black tracking-tighter text-xl uppercase">Rede Conecta</span>
                        </div>

                        {step === 'pix' ? (
                            <>
                                <h2 className="text-2xl font-bold mb-4 leading-tight">Pagamento via PIX</h2>
                                <p className="text-slate-400 text-sm leading-relaxed">
                                    Escaneie o QR Code ou copie o código para pagar instantaneamente pelo app do seu banco.
                                </p>

                                <div className="mt-6 bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Clock className="w-4 h-4 text-amber-400" />
                                        <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">Expira em</span>
                                    </div>
                                    <span className={`text-3xl font-black font-mono ${timeLeft < 300 ? 'text-red-400' : 'text-white'}`}>
                                        {formatTime(timeLeft)}
                                    </span>
                                </div>
                            </>
                        ) : step === 'success' ? (
                            <>
                                <h2 className="text-2xl font-bold mb-4 leading-tight">Pagamento Confirmado!</h2>
                                <p className="text-slate-400 text-sm leading-relaxed">
                                    Seu plano foi ativado com sucesso. Aproveite todos os recursos!
                                </p>
                            </>
                        ) : (
                            <>
                                <h2 className="text-3xl font-bold mb-4 leading-tight">Atualize seu Plano</h2>
                                <p className="text-slate-400 text-sm leading-relaxed">
                                    Escolha o plano ideal e pague instantaneamente via PIX.
                                </p>
                            </>
                        )}
                    </div>

                    <div className="hidden md:block">
                        <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                            <p className="text-xs text-slate-400 uppercase font-bold tracking-widest mb-2">Pagamento Seguro</p>
                            <p className="text-xs text-slate-300">Processado via MercadoPago com proteção total ao comprador.</p>
                        </div>
                    </div>
                </div>

                {/* Main Content Area */}
                <div className="flex-1 p-8 overflow-y-auto relative">
                    <button
                        onClick={handleClose}
                        className="absolute top-6 right-6 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-all z-10"
                    >
                        <X className="w-6 h-6" />
                    </button>

                    {/* STEP: PIX QR Code */}
                    {step === 'pix' && pixData && (
                        <div className="flex flex-col items-center justify-center h-full py-4">
                            <div className="text-center mb-6">
                                <h3 className="text-xl font-bold text-slate-800 mb-1">
                                    {pixData.plan_name}
                                </h3>
                                <p className="text-3xl font-black text-slate-900">
                                    R$ {Number(pixData.amount).toFixed(2)}
                                </p>
                            </div>

                            {/* QR Code */}
                            <div className="bg-white border-2 border-slate-200 rounded-2xl p-6 mb-6 shadow-lg">
                                {pixData.pix_qr_code ? (
                                    <img
                                        src={`data:image/png;base64,${pixData.pix_qr_code}`}
                                        alt="QR Code PIX"
                                        className="w-56 h-56 mx-auto"
                                    />
                                ) : (
                                    <div className="w-56 h-56 flex items-center justify-center bg-slate-100 rounded-xl">
                                        <QrCode className="w-16 h-16 text-slate-300" />
                                    </div>
                                )}
                            </div>

                            {/* Copy Code Button */}
                            {pixData.pix_qr_code_text && (
                                <button
                                    onClick={handleCopy}
                                    className={`w-full max-w-sm py-3.5 px-6 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${copied
                                        ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30'
                                        : 'bg-slate-900 text-white hover:bg-black shadow-lg hover:shadow-xl'
                                        }`}
                                >
                                    {copied ? (
                                        <>
                                            <CheckCircle className="w-4 h-4" />
                                            Código Copiado!
                                        </>
                                    ) : (
                                        <>
                                            <Copy className="w-4 h-4" />
                                            Copiar Código PIX
                                        </>
                                    )}
                                </button>
                            )}

                            {/* Polling indicator */}
                            <div className="mt-6 flex items-center gap-2 text-slate-400">
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span className="text-xs font-medium">Aguardando confirmação do pagamento...</span>
                            </div>
                        </div>
                    )}

                    {/* STEP: Success */}
                    {step === 'success' && (
                        <div className="h-full flex flex-col items-center justify-center text-center animate-in fade-in zoom-in-90 duration-500">
                            <div className="w-24 h-24 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-6 shadow-xl shadow-emerald-100">
                                <Check className="w-14 h-14" strokeWidth={3} />
                            </div>
                            <h3 className="text-2xl font-bold text-slate-900 mb-2">Pagamento Aprovado!</h3>
                            <p className="text-slate-500 mb-6">
                                Seu plano <strong>{pixData?.plan_name}</strong> foi ativado com sucesso.
                            </p>
                            <button
                                onClick={handleClose}
                                className="bg-emerald-600 text-white px-8 py-3 rounded-xl font-bold text-sm hover:bg-emerald-700 transition-all shadow-lg"
                            >
                                Continuar
                            </button>
                        </div>
                    )}

                    {/* STEP: Error */}
                    {step === 'error' && (
                        <div className="h-full flex flex-col items-center justify-center text-center animate-in fade-in duration-300">
                            <div className="w-20 h-20 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-6">
                                <AlertTriangle className="w-10 h-10" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 mb-2">Ops! Algo deu errado</h3>
                            <p className="text-slate-500 mb-6 max-w-sm">{error}</p>
                            <button
                                onClick={() => { setStep('select'); setError(null); }}
                                className="bg-slate-900 text-white px-8 py-3 rounded-xl font-bold text-sm hover:bg-black transition-all flex items-center gap-2"
                            >
                                <RefreshCw className="w-4 h-4" />
                                Tentar Novamente
                            </button>
                        </div>
                    )}

                    {/* STEP: Plan Selection */}
                    {step === 'select' && (
                        <>
                            <div className="mb-8">
                                <h3 className="text-lg font-bold text-slate-800">Assinaturas Disponíveis</h3>
                                <p className="text-sm text-slate-500">Selecione o plano e pague via PIX</p>
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
                                                <div className="p-2 rounded-lg bg-slate-100 text-slate-600">
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
                                                <span className="text-slate-400 text-xs">{plan.period}</span>
                                            </div>

                                            <div className="space-y-2 mb-8 flex-1">
                                                {plan.features.map((feature, idx) => {
                                                    const isSwapFeature = feature.startsWith('🔄');
                                                    return (
                                                        <div key={idx} className={`flex items-start gap-2 ${isSwapFeature ? 'bg-cyan-50 -mx-2 px-2 py-1 rounded-lg border border-cyan-100' : ''}`}>
                                                            <Check className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 ${isComingSoon ? 'text-slate-300' : isSwapFeature ? 'text-cyan-500' : 'text-emerald-500'}`} />
                                                            <span className={`text-xs leading-tight ${isSwapFeature ? 'text-cyan-700 font-bold' : 'text-slate-600'}`}>{feature}</span>
                                                            {isSwapFeature && (
                                                                <span className="text-[8px] font-black uppercase bg-cyan-500 text-white px-1.5 py-0.5 rounded ml-auto flex-shrink-0">NOVO</span>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>

                                            <button
                                                disabled={isCurrent || !!loading || isComingSoon}
                                                onClick={() => handleSelectPlan(plan.id)}
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
                                                ) : (
                                                    <>
                                                        <QrCode className="w-4 h-4" />
                                                        Pagar com PIX
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>

                            <p className="mt-8 text-[10px] text-center text-slate-400">
                                Pagamento instantâneo via PIX. Processado com segurança pelo MercadoPago.
                            </p>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CheckoutModal;
