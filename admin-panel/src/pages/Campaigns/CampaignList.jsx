/**
 * CampaignList — Table/grid display of campaigns 
 */
import React from 'react';
import {
    Layers, Globe, Sparkles, Monitor, Eye,
    CheckCircle, XCircle, Clock, Edit2, Trash2,
    ArrowUpRight, RefreshCw
} from 'lucide-react';
import { getPlanValidityDays } from '../../utils/planHelpers';

// Calcula a data de expiração baseada na data de aprovação
function formatExpirationDate(createdAt) {
    if (!createdAt) return '—';
    const d = new Date(createdAt);
    return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
}

const CampaignList = ({
    campaigns,
    mediaFiles,
    userData,
    currentUser,
    onPreview,
    onApprove,
    onReject,
    onEdit,
    onDelete,
    onRefinement,
    onSwap,
}) => {
    return (
        <div className="bg-white rounded-[2.5rem] border border-slate-100 premium-shadow overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[800px]">
                    <thead>
                        <tr className="bg-slate-50/80 border-b border-slate-200/60">
                            <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] Outfit">Identificação</th>
                            <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] Outfit text-center">Distribuição</th>
                            <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] Outfit text-center">Moderação</th>
                            <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] Outfit text-right">Controle</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {campaigns.map(c => {
                            const isAdminCampaign = userData?.role === 'admin' && c.owner_id === currentUser?.id;

                            return (
                                <tr
                                    key={c.id}
                                    className={`group transition-all duration-300 ${isAdminCampaign
                                        ? 'bg-violet-50/30 hover:bg-violet-50/60 border-l-4 border-l-violet-400'
                                        : 'hover:bg-slate-50/50'
                                        }`}
                                >
                                    {/* Identificação */}
                                    <td className="px-8 py-6">
                                        <div className="flex flex-col">
                                            <div className="flex items-center space-x-2">
                                                <span className="text-base font-black text-slate-800 Outfit group-hover:text-indigo-600 transition-colors uppercase tracking-tight">{c.name}</span>
                                                {c.is_global && (
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black bg-emerald-100 text-emerald-600 border border-emerald-200">
                                                        <Globe className="w-3 h-3 mr-1" /> GLOBAL
                                                    </span>
                                                )}
                                                {c.is_ai_generating && (
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black bg-indigo-100 text-indigo-600 animate-pulse border border-indigo-200">
                                                        <Sparkles className="w-3 h-3 mr-1" /> IA ATIVA
                                                    </span>
                                                )}
                                                {c.type === 'refinement' && (
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black bg-amber-100 text-amber-600 border border-amber-200">
                                                        REFINAMENTO
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center space-y-1 flex-col items-start mt-2">
                                                <div className="flex items-center space-x-2">
                                                    <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">{formatExpirationDate(c.created_at)}</span>
                                                    <span className="w-1 h-1 bg-slate-200 rounded-full" />
                                                    <span className="text-[10px] font-black text-slate-400 truncate max-w-[120px]">ID: {c.id}</span>
                                                </div>
                                                {c.moderation_status === 'rejected' && c.rejection_reason && (
                                                    <div className="bg-red-50 text-red-600 p-2 rounded-lg border border-red-100 mt-2 max-w-xs">
                                                        <p className="text-[9px] font-black uppercase tracking-tighter mb-1 select-none">Motivo da Rejeição:</p>
                                                        <p className="text-[10px] font-bold italic">"{c.rejection_reason}"</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </td>

                                    {/* Distribuição */}
                                    <td className="px-8 py-6">
                                        <div className="flex flex-col items-center justify-center space-y-3">
                                            <div className="flex -space-x-1.5 overflow-hidden">
                                                {c.v_media_id && (
                                                    <div className="w-7 h-7 bg-indigo-500 rounded-lg flex items-center justify-center ring-2 ring-white" title="Mídia Vertical">
                                                        <span className="text-[10px] font-black text-white">V</span>
                                                    </div>
                                                )}
                                                {!c.v_media_id && <span className="text-xs font-bold text-slate-300 italic">Sem Mídia</span>}
                                            </div>
                                            <div className="flex items-center space-x-2 bg-slate-100/50 px-3 py-1 rounded-full border border-slate-200/50">
                                                <Monitor className="w-3 h-3 text-slate-400" />
                                                <span className="text-[10px] font-black text-slate-600 tracking-tighter">
                                                    {c.target_terminals?.length || 0} / {c.screens_quota === -1 ? '∞' : c.screens_quota} Telas
                                                </span>
                                            </div>
                                        </div>
                                    </td>

                                    {/* Moderação */}
                                    <td className="px-8 py-6">
                                        <div className="flex justify-center gap-2">
                                            {userData?.role === 'admin' && (c.moderation_status !== 'approved' && c.moderation_status !== 'rejected') ? (
                                                <div className="flex items-center space-x-2">
                                                    <button
                                                        onClick={() => onPreview(c)}
                                                        className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-all"
                                                        title="Visualizar Conteúdo"
                                                    >
                                                        <Eye className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => onApprove(c)}
                                                        className="px-3 py-1.5 bg-emerald-500 text-white text-[10px] font-black rounded-lg hover:bg-emerald-600 transition-all uppercase shadow-sm shadow-emerald-500/20 active:scale-95"
                                                    >
                                                        Aprovar
                                                    </button>
                                                    <button
                                                        onClick={() => onReject(c)}
                                                        className="px-3 py-1.5 bg-red-500 text-white text-[10px] font-black rounded-lg hover:bg-red-600 transition-all uppercase shadow-sm shadow-red-500/20 active:scale-95"
                                                    >
                                                        Rejeitar
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="flex flex-col items-center gap-1">
                                                    <div className={`
                                                        group relative inline-flex items-center space-x-2 px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all duration-300 border-2
                                                        ${c.moderation_status === 'approved'
                                                            ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                                                            : c.moderation_status === 'rejected'
                                                                ? 'bg-red-50 text-red-600 border-red-100'
                                                                : c.moderation_status === 'expired'
                                                                    ? 'bg-slate-100 text-slate-500 border-slate-200'
                                                                    : 'bg-amber-50 text-amber-600 border-amber-100'}
                                                    `}>
                                                        {c.moderation_status === 'approved' ? <CheckCircle className="w-4 h-4" />
                                                            : c.moderation_status === 'rejected' ? <XCircle className="w-4 h-4" />
                                                                : c.moderation_status === 'expired' ? <Clock className="w-4 h-4" />
                                                                    : <Clock className="w-4 h-4" />}
                                                        <span>
                                                            {c.moderation_status === 'approved' ? 'Aprovada'
                                                                : c.moderation_status === 'rejected' ? 'Rejeitada'
                                                                    : c.moderation_status === 'expired' ? 'Expirada'
                                                                        : 'Em Análise'}
                                                        </span>
                                                    </div>
                                                    {/* Dias restantes para campanhas aprovadas */}
                                                    {c.moderation_status === 'approved' && c.expires_at && (() => {
                                                        const now = new Date();
                                                        const expires = new Date(c.expires_at);
                                                        const daysLeft = Math.ceil((expires - now) / (1000 * 60 * 60 * 24));
                                                        const isExpiringSoon = daysLeft <= 7;
                                                        const isExpired = daysLeft < 0;

                                                        if (isExpired) {
                                                            return (
                                                                <span className="text-[9px] font-bold text-red-500">
                                                                    Expirou há {Math.abs(daysLeft)} dia(s)
                                                                </span>
                                                            );
                                                        }

                                                        return (
                                                            <span className={`text-[9px] font-bold ${isExpiringSoon ? 'text-amber-500' : 'text-slate-400'}`}>
                                                                {daysLeft} dia(s) restante(s)
                                                            </span>
                                                        );
                                                    })()}
                                                </div>
                                            )}
                                        </div>
                                    </td>

                                    {/* Controle */}
                                    <td className="px-8 py-6 text-right">
                                        <div className="flex items-center justify-end space-x-2">
                                            {/* Swap button: only for approved monthly campaigns owned by cliente */}
                                            {userData?.role === 'cliente' && c.moderation_status === 'approved' && !c.pending_swap_media_id && (
                                                <button
                                                    onClick={() => onSwap && onSwap(c)}
                                                    className="p-2.5 bg-cyan-50 text-cyan-600 border border-cyan-100 rounded-xl hover:bg-cyan-100 transition-all active:scale-90"
                                                    title="Trocar Mídia (R$19)"
                                                >
                                                    <RefreshCw className="w-5 h-5" />
                                                </button>
                                            )}
                                            {/* Pending swap badge */}
                                            {c.pending_swap_media_id && (
                                                <span className="inline-flex items-center px-2 py-1 rounded-lg text-[9px] font-black bg-amber-50 text-amber-600 border border-amber-200">
                                                    <RefreshCw className="w-3 h-3 mr-1 animate-spin" style={{ animationDuration: '3s' }} />
                                                    Troca Pendente
                                                </span>
                                            )}
                                            {userData?.role === 'cliente' && c.moderation_status === 'rejected' && (
                                                <button
                                                    onClick={() => onEdit(c)}
                                                    className="p-2.5 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-xl hover:bg-indigo-100 transition-all active:scale-90"
                                                    title="Corrigir e Reenviar"
                                                >
                                                    <Edit2 className="w-5 h-5" />
                                                </button>
                                            )}
                                            {!c.is_ai_generating && c.v_media_id && (
                                                <button
                                                    onClick={() => onRefinement(c)}
                                                    className="p-2.5 bg-white text-slate-400 border border-slate-100 rounded-xl hover:text-indigo-600 hover:border-indigo-200 hover:shadow-md transition-all active:scale-90"
                                                    title="Solicitar Ajuste IA"
                                                >
                                                    <Sparkles className="w-5 h-5" />
                                                </button>
                                            )}
                                            <button
                                                onClick={() => onDelete(c.id)}
                                                className="p-2.5 bg-white text-slate-300 border border-slate-100 rounded-xl hover:text-red-500 hover:border-red-100 hover:shadow-md transition-all active:scale-95"
                                                title="Excluir Campanha"
                                            >
                                                <Trash2 className="w-5 h-5" />
                                            </button>
                                            <button className="md:hidden p-2.5 bg-white text-slate-400 border border-slate-100 rounded-xl">
                                                <ArrowUpRight className="w-5 h-5" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
                {campaigns.length === 0 && (
                    <div className="p-20 text-center animate-pulse">
                        <Layers className="w-16 h-16 text-slate-200 mx-auto mb-4" />
                        <p className="text-slate-400 font-bold italic">Nenhuma rede operacional detectada.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default CampaignList;
