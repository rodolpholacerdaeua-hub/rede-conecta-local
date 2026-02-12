/**
 * PartnerDashboard — Dashboard exclusivo para o papel "parceiro"
 * 
 * Seções: Barra de Ocupação, Card Afiliado, Extrato de Ganhos, Status Terminal
 */
import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
    Gift, Share2, Wifi, WifiOff, TrendingUp, DollarSign,
    Clock, CheckCircle, AlertTriangle, Copy, ExternalLink,
    BarChart3, Zap, Activity
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { usePartnerData } from '../hooks/usePartnerData';

// ── Tempo relativo ──
const timeAgo = (dateStr) => {
    const now = new Date();
    const date = new Date(dateStr);
    const diffMs = now - date;
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'Agora mesmo';
    if (diffMin < 60) return `há ${diffMin}min`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `há ${diffH}h`;
    const diffD = Math.floor(diffH / 24);
    if (diffD === 1) return 'Ontem';
    return `há ${diffD} dias`;
};

const PartnerDashboard = () => {
    const { userData } = useAuth();
    const navigate = useNavigate();
    const { slug } = useParams();
    const routePrefix = `/parceiro/${slug}`;
    const {
        partnerCodes,
        commissions,
        terminal,
        occupiedSlots,
        totalLocalSlots,
        monthlyEarnings,
        pendingPayout,
        loading,
        error
    } = usePartnerData(userData?.id);

    const primaryCode = partnerCodes?.[0];
    const emptySlots = totalLocalSlots - occupiedSlots;
    const potentialEarningPerSlot = 30; // R$ 30/mês por slot

    // ── Compartilhar no WhatsApp ────────────────────────────
    const handleShareWhatsApp = () => {
        if (!primaryCode) return;
        const msg = encodeURIComponent(
            `🎁 Oi! Tenho um presente pra você!\n\n` +
            `Consegui um desconto exclusivo de 5% pra você anunciar na minha tela digital.\n\n` +
            `Use o código *${primaryCode.code}* na hora de criar sua campanha e aproveite!\n\n` +
            `É rápido, fácil, e sua marca aparece em tela grande no meu estabelecimento. 🚀`
        );
        window.open(`https://wa.me/?text=${msg}`, '_blank');
    };

    // ── Copiar código ───────────────────────────────────────
    const handleCopyCode = () => {
        if (!primaryCode) return;
        navigator.clipboard.writeText(primaryCode.code);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-red-700">
                <AlertTriangle className="w-5 h-5 inline mr-2" />
                Erro ao carregar dados: {error}
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-fade-in">
            {/* ── Header ──────────────────────────────────────── */}
            <div>
                <h1 className="text-3xl font-black text-slate-800 tracking-tight">
                    Painel do Parceiro
                </h1>
                <p className="text-slate-500 mt-1">
                    Acompanhe seus ganhos, indicações e ocupação da sua tela.
                </p>
            </div>

            {/* ── Cards de Métricas ───────────────────────────── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                {/* Ganhos do Mês */}
                <div
                    onClick={() => navigate(`${routePrefix}/financeiro`)}
                    className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm hover:shadow-lg transition-all group cursor-pointer active:scale-95"
                >
                    <div className="flex items-center justify-between mb-4">
                        <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center group-hover:bg-emerald-100 transition-colors">
                            <DollarSign className="w-6 h-6 text-emerald-500" />
                        </div>
                        <span className="text-[10px] font-black text-emerald-500 bg-emerald-50 px-3 py-1 rounded-full uppercase tracking-wider">
                            Mês Atual
                        </span>
                    </div>
                    <p className="text-3xl font-black text-slate-800 tracking-tight">
                        R$ {monthlyEarnings.toFixed(2).replace('.', ',')}
                    </p>
                    <p className="text-xs text-slate-400 mt-1 font-semibold">Ganhos aprovados</p>
                </div>

                {/* Pendente de Repasse */}
                <div
                    onClick={() => navigate(`${routePrefix}/financeiro`)}
                    className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm hover:shadow-lg transition-all group cursor-pointer active:scale-95"
                >
                    <div className="flex items-center justify-between mb-4">
                        <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center group-hover:bg-amber-100 transition-colors">
                            <Clock className="w-6 h-6 text-amber-500" />
                        </div>
                        <span className="text-[10px] font-black text-amber-500 bg-amber-50 px-3 py-1 rounded-full uppercase tracking-wider">
                            Pendente
                        </span>
                    </div>
                    <p className="text-3xl font-black text-slate-800 tracking-tight">
                        R$ {pendingPayout.toFixed(2).replace('.', ',')}
                    </p>
                    <p className="text-xs text-slate-400 mt-1 font-semibold">Próximo repasse</p>
                </div>

                {/* Indicações */}
                <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm hover:shadow-lg transition-all group">
                    <div className="flex items-center justify-between mb-4">
                        <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center group-hover:bg-indigo-100 transition-colors">
                            <TrendingUp className="w-6 h-6 text-indigo-500" />
                        </div>
                    </div>
                    <p className="text-3xl font-black text-slate-800 tracking-tight">
                        {primaryCode?.uses_count || 0}
                    </p>
                    <p className="text-xs text-slate-400 mt-1 font-semibold">Indicações com cupom</p>
                </div>

                {/* Status Terminal */}
                <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm hover:shadow-lg transition-all group">
                    <div className="flex items-center justify-between mb-4">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors ${terminal?.status === 'online'
                            ? 'bg-emerald-50 group-hover:bg-emerald-100'
                            : 'bg-slate-100 group-hover:bg-slate-200'
                            }`}>
                            {terminal?.status === 'online'
                                ? <Wifi className="w-6 h-6 text-emerald-500" />
                                : <WifiOff className="w-6 h-6 text-slate-400" />
                            }
                        </div>
                        <span className={`text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider ${terminal?.status === 'online'
                            ? 'text-emerald-500 bg-emerald-50'
                            : 'text-slate-400 bg-slate-100'
                            }`}>
                            {terminal?.status === 'online' ? 'Online' : 'Offline'}
                        </span>
                    </div>
                    <p className="text-sm font-bold text-slate-800 truncate">
                        {terminal?.name || 'Nenhum terminal'}
                    </p>
                    <p className="text-xs text-slate-400 mt-1 font-semibold truncate">
                        {terminal?.location || terminal?.city || '—'}
                    </p>
                </div>
            </div>

            {/* ── Atividade Recente ────────────────────────────── */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-100">
                    <h2 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-2">
                        <Activity className="w-5 h-5 text-blue-500" />
                        Atividade Recente
                    </h2>
                </div>
                <div className="divide-y divide-slate-50">
                    {/* Terminal Status */}
                    {terminal && (
                        <div className="flex items-center gap-4 px-6 py-4">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${terminal.status === 'online' ? 'bg-emerald-50' : 'bg-slate-100'
                                }`}>
                                {terminal.status === 'online'
                                    ? <Wifi className="w-5 h-5 text-emerald-500" />
                                    : <WifiOff className="w-5 h-5 text-slate-400" />
                                }
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold text-slate-800 truncate">
                                    Terminal {terminal.name} está {terminal.status === 'online' ? 'online' : 'offline'}
                                </p>
                                <p className="text-xs text-slate-400">
                                    {terminal.last_seen ? `Último sinal: ${timeAgo(terminal.last_seen)}` : 'Sem dados'}
                                </p>
                            </div>
                            <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${terminal.status === 'online' ? 'bg-emerald-400 animate-pulse' : 'bg-slate-300'
                                }`} />
                        </div>
                    )}
                    {/* Recent Commissions */}
                    {commissions.slice(0, 4).map(c => (
                        <div key={c.id} className="flex items-center gap-4 px-6 py-4">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${c.status === 'paid' ? 'bg-emerald-50'
                                    : c.status === 'approved' ? 'bg-blue-50'
                                        : 'bg-amber-50'
                                }`}>
                                {c.status === 'paid'
                                    ? <CheckCircle className="w-5 h-5 text-emerald-500" />
                                    : c.status === 'approved'
                                        ? <DollarSign className="w-5 h-5 text-blue-500" />
                                        : <Clock className="w-5 h-5 text-amber-500" />
                                }
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold text-slate-800">
                                    {c.type === 'referral_bonus' ? 'Bônus de indicação' : 'Revenue Share'}
                                    {' — '}
                                    <span className="text-emerald-600">R$ {Number(c.commission).toFixed(2).replace('.', ',')}</span>
                                </p>
                                <p className="text-xs text-slate-400">
                                    {c.status === 'paid' ? 'Pago' : c.status === 'approved' ? 'Aprovado' : 'Pendente'}{' • '}
                                    {timeAgo(c.created_at)}
                                </p>
                            </div>
                        </div>
                    ))}
                    {commissions.length === 0 && !terminal && (
                        <div className="p-8 text-center text-slate-400">
                            <Activity className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                            <p className="font-semibold">Nenhuma atividade ainda</p>
                            <p className="text-sm mt-1">As atividades aparecerão aqui quando você começar a ganhar comissões.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* ── Barra de Ocupação da Grade ──────────────────── */}
            <div className="bg-white rounded-2xl p-8 border border-slate-100 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h2 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-2">
                            <BarChart3 className="w-5 h-5 text-indigo-500" />
                            Grade de Exibição
                        </h2>
                        <p className="text-sm text-slate-400 mt-1">
                            {occupiedSlots} de {totalLocalSlots} slots locais preenchidos
                        </p>
                    </div>
                    <div className="text-right">
                        <p className="text-2xl font-black text-indigo-600">
                            {Math.round((occupiedSlots / totalLocalSlots) * 100)}%
                        </p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Ocupação</p>
                    </div>
                </div>

                {/* Grid Visual dos Slots */}
                <div className="grid grid-cols-5 sm:grid-cols-10 gap-3 mb-6">
                    {Array.from({ length: totalLocalSlots }).map((_, i) => {
                        const isOccupied = i < occupiedSlots;
                        return (
                            <div
                                key={i}
                                className={`aspect-square rounded-xl border-2 flex items-center justify-center text-xs font-black transition-all ${isOccupied
                                    ? 'bg-emerald-100 border-emerald-300 text-emerald-600 shadow-sm shadow-emerald-200/50'
                                    : 'bg-slate-50 border-slate-200 text-slate-300 border-dashed'
                                    }`}
                            >
                                {isOccupied ? <CheckCircle className="w-5 h-5" /> : (i + 1)}
                            </div>
                        );
                    })}
                </div>

                {/* Gatilho Mental */}
                {emptySlots > 0 && (
                    <div className="bg-gradient-to-r from-indigo-50 to-violet-50 rounded-xl p-5 border border-indigo-100">
                        <div className="flex items-start gap-3">
                            <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5">
                                <Zap className="w-5 h-5 text-indigo-600" />
                            </div>
                            <div>
                                <p className="text-sm font-bold text-indigo-800">
                                    Você tem <span className="text-indigo-600">{emptySlots} slots vazios</span>
                                </p>
                                <p className="text-sm text-indigo-600/70 mt-1">
                                    Cada slot preenchido aumenta seu ganho mensal em{' '}
                                    <span className="font-black text-indigo-700">
                                        R$ {potentialEarningPerSlot},00
                                    </span>.
                                    Potencial não aproveitado:{' '}
                                    <span className="font-black text-indigo-700">
                                        R$ {(emptySlots * potentialEarningPerSlot)},00/mês
                                    </span>
                                </p>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* ── Card de Afiliado ────────────────────────────── */}
            <div className="bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-700 rounded-2xl p-8 text-white relative overflow-hidden">
                {/* Background decorativo */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
                <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />

                <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center backdrop-blur-sm border border-white/10">
                            <Gift className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h2 className="text-xl font-black tracking-tight">Seu Código de Afiliado</h2>
                            <p className="text-indigo-200 text-sm">Compartilhe e ganhe comissões</p>
                        </div>
                    </div>

                    {primaryCode ? (
                        <>
                            {/* Código em destaque */}
                            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/10 mb-6 text-center">
                                <p className="text-4xl font-black tracking-widest letter-spacing-4">
                                    {primaryCode.code}
                                </p>
                                <p className="text-indigo-200 text-sm mt-2">
                                    Desconto de {Number(primaryCode.discount_pct)}% para quem usar
                                </p>
                            </div>

                            {/* Botões */}
                            <div className="flex flex-col sm:flex-row gap-3">
                                <button
                                    onClick={handleShareWhatsApp}
                                    className="flex-1 flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-white font-bold py-3.5 px-6 rounded-xl transition-all hover:scale-[1.02] active:scale-95 shadow-lg shadow-emerald-600/30"
                                >
                                    <Share2 className="w-5 h-5" />
                                    Compartilhar Desconto de 5%
                                </button>
                                <button
                                    onClick={handleCopyCode}
                                    className="flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white font-bold py-3.5 px-6 rounded-xl transition-all border border-white/10 hover:border-white/20"
                                >
                                    <Copy className="w-4 h-4" />
                                    Copiar
                                </button>
                            </div>
                        </>
                    ) : (
                        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/10 text-center">
                            <p className="text-indigo-200">
                                Nenhum código cadastrado. Entre em contato com o administrador.
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* ── Extrato de Comissões ────────────────────────── */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-100">
                    <h2 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-2">
                        <DollarSign className="w-5 h-5 text-emerald-500" />
                        Extrato de Comissões
                    </h2>
                </div>

                {commissions.length === 0 ? (
                    <div className="p-12 text-center">
                        <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                            <DollarSign className="w-8 h-8 text-slate-300" />
                        </div>
                        <p className="text-slate-400 font-semibold">Nenhuma comissão registrada ainda</p>
                        <p className="text-slate-300 text-sm mt-1">Compartilhe seu código para começar a ganhar!</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="bg-slate-50/50">
                                    <th className="text-left text-[10px] font-black uppercase tracking-wider text-slate-400 px-6 py-3">Data</th>
                                    <th className="text-left text-[10px] font-black uppercase tracking-wider text-slate-400 px-6 py-3">Tipo</th>
                                    <th className="text-right text-[10px] font-black uppercase tracking-wider text-slate-400 px-6 py-3">Valor Base</th>
                                    <th className="text-right text-[10px] font-black uppercase tracking-wider text-slate-400 px-6 py-3">Comissão</th>
                                    <th className="text-center text-[10px] font-black uppercase tracking-wider text-slate-400 px-6 py-3">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {commissions.map(c => (
                                    <tr key={c.id} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="px-6 py-4 text-sm text-slate-600">
                                            {new Date(c.created_at).toLocaleDateString('pt-BR')}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${c.type === 'referral_bonus'
                                                ? 'bg-violet-50 text-violet-600'
                                                : 'bg-blue-50 text-blue-600'
                                                }`}>
                                                {c.type === 'referral_bonus' ? 'Bônus Indicação' : 'Revenue Share'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-slate-600 text-right font-mono">
                                            R$ {Number(c.net_amount).toFixed(2).replace('.', ',')}
                                        </td>
                                        <td className="px-6 py-4 text-sm font-bold text-emerald-600 text-right font-mono">
                                            R$ {Number(c.commission).toFixed(2).replace('.', ',')}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className={`text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider ${c.status === 'paid'
                                                ? 'bg-emerald-50 text-emerald-600'
                                                : c.status === 'approved'
                                                    ? 'bg-blue-50 text-blue-600'
                                                    : 'bg-amber-50 text-amber-600'
                                                }`}>
                                                {c.status === 'paid' ? 'Pago' : c.status === 'approved' ? 'Aprovado' : 'Pendente'}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PartnerDashboard;
