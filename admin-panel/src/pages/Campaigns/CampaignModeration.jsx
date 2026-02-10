/**
 * CampaignModeration — Approval & Rejection modals
 */
import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { supabase } from '../../supabase';
import { getPlanValidityDays } from '../../utils/planHelpers';
import { propagateGlobalCampaign, allocateCampaignToSlots, SWAP_FEE } from './campaignUtils';

const CampaignModeration = ({
    // Approval
    approvalModalCamp, setApprovalModalCamp,
    selectedCategory, setSelectedCategory,
    categoryConflicts, setCategoryConflicts,
    businessCategories,
    campaigns,
    terminals,
    setCampaigns,

    // Rejection
    rejectionModalCamp, setRejectionModalCamp,
    rejectionReason, setRejectionReason,

    // Data
    userData,
}) => {
    /**
     * Check if the selected category conflicts with other existing campaigns
     * on the same terminals.
     */
    const checkCategoryConflicts = (categoryId, campaignId, targetTerminals) => {
        if (!categoryId || !targetTerminals?.length) {
            setCategoryConflicts([]);
            return;
        }

        const approved = campaigns.filter(c =>
            c.id !== campaignId &&
            c.moderation_status === 'approved' &&
            c.business_category_id === categoryId
        );

        const conflicts = approved.filter(c => {
            if (c.is_global) return true;
            const overlap = (c.target_terminals || []).filter(t => targetTerminals.includes(t));
            return overlap.length > 0;
        }).map(c => ({
            ...c,
            conflictingTerminals: c.is_global
                ? terminals
                : terminals.filter(t => (c.target_terminals || []).includes(t.id) && targetTerminals.includes(t.id))
        }));

        setCategoryConflicts(conflicts);
    };

    /**
     * Approve a campaign with a business category
     */
    const handleApproveWithCategory = async () => {
        if (!selectedCategory) return alert('Selecione a categoria do negócio!');

        const camp = approvalModalCamp;
        try {
            const validityDays = getPlanValidityDays(userData);
            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + validityDays);

            const { error } = await supabase
                .from('campaigns')
                .update({
                    moderation_status: 'approved',
                    business_category_id: selectedCategory,
                    approved_at: new Date().toISOString(),
                    expires_at: expiresAt.toISOString(),
                    is_active: true,
                    updated_at: new Date().toISOString()
                })
                .eq('id', camp.id);

            if (error) throw error;

            console.log(`✅ [MODERAÇÃO] Campanha ${camp.name} aprovada com categoria ${selectedCategory}`);

            // Propagar se for global
            let allocationMsg = '';
            if (camp.is_global) {
                console.log("🌐 [MODERAÇÃO] Iniciando propagação global...");
                const result = await propagateGlobalCampaign({
                    ...camp,
                    business_category_id: selectedCategory
                });
                if (result.success) {
                    console.log(`🌐 [MODERAÇÃO] Propagação concluída: ${result.updatedCount} playlists`);
                    allocationMsg = `\nPropagação global: ${result.updatedCount} playlists atualizadas.`;
                }
            } else {
                // ── Alocação Inteligente nos Slots Locais ──
                const mediaId = camp.v_media_id || camp.h_media_id;
                const targetTerminals = camp.target_terminals || [];
                if (mediaId && targetTerminals.length > 0) {
                    console.log(`📍 [MODERAÇÃO] Alocando campanha em ${targetTerminals.length} terminais...`);
                    const allocResult = await allocateCampaignToSlots(camp.id, mediaId, targetTerminals);
                    if (allocResult.success) {
                        const allocCount = allocResult.allocations.length;
                        const fullCount = allocResult.fullTerminals.length;
                        const slotDetails = allocResult.allocations.map(a => `${a.terminalName} → slot ${a.slotIndex}`).join(', ');
                        console.log(`📍 [MODERAÇÃO] Alocação: ${allocCount} terminais OK, ${fullCount} lotados`);
                        allocationMsg = `\nAlocação: ${slotDetails || 'nenhuma'}.`;
                        if (fullCount > 0) {
                            const fullNames = allocResult.fullTerminals.map(f => f.terminalName).join(', ');
                            allocationMsg += `\n⚠️ Terminais lotados: ${fullNames}`;
                        }
                    }
                }
            }

            // ── Gerar Comissões se houver partner_code ────────
            if (camp.partner_code_id) {
                try {
                    const { data: partnerCode } = await supabase
                        .from('partner_codes')
                        .select('id, partner_id, referral_pct, revenue_share_pct')
                        .eq('id', camp.partner_code_id)
                        .single();

                    if (partnerCode) {
                        const netAmount = Number(camp.credits_cost || 0);
                        const grossAmount = Number(camp.original_cost || netAmount);

                        // Bônus de Indicação (uma vez)
                        const referralCommission = netAmount * (Number(partnerCode.referral_pct) / 100);
                        await supabase.from('partner_commissions').insert({
                            partner_id: partnerCode.partner_id,
                            campaign_id: camp.id,
                            partner_code_id: partnerCode.id,
                            type: 'referral_bonus',
                            gross_amount: grossAmount,
                            net_amount: netAmount,
                            commission: referralCommission,
                            status: 'pending'
                        });

                        // Revenue Share mensal
                        const revenueCommission = netAmount * (Number(partnerCode.revenue_share_pct) / 100);
                        const now = new Date();
                        const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
                        const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                        await supabase.from('partner_commissions').insert({
                            partner_id: partnerCode.partner_id,
                            campaign_id: camp.id,
                            partner_code_id: partnerCode.id,
                            type: 'revenue_share',
                            gross_amount: grossAmount,
                            net_amount: netAmount,
                            commission: revenueCommission,
                            status: 'pending',
                            period_start: periodStart.toISOString().split('T')[0],
                            period_end: periodEnd.toISOString().split('T')[0]
                        });

                        console.log(`💰 [COMISSÃO] Geradas comissões para parceiro ${partnerCode.partner_id}: referral R$${referralCommission.toFixed(2)} + revenue R$${revenueCommission.toFixed(2)}`);
                    }
                } catch (commErr) {
                    console.error('[COMISSÃO] Erro ao gerar comissões:', commErr);
                    // Não bloquear a aprovação por erro de comissão
                }
            }

            // Atualizar local
            setCampaigns(prev => prev.map(c =>
                c.id === camp.id ? {
                    ...c,
                    moderation_status: 'approved',
                    business_category_id: selectedCategory,
                    approved_at: new Date().toISOString(),
                    expires_at: expiresAt.toISOString(),
                    is_active: true
                } : c
            ));

            setApprovalModalCamp(null);
            setSelectedCategory('');
            setCategoryConflicts([]);
            alert(`✅ Campanha aprovada e publicada com sucesso!${allocationMsg}`);
        } catch (err) {
            console.error('[MODERAÇÃO] Erro na aprovação:', err);
            alert(`Erro ao aprovar: ${err.message}`);
        }
    };

    /**
     * Moderate a campaign (reject with reason, or handle refunds)
     */
    const handleModerate = async (campId, status, reason = '') => {
        try {
            const updateData = {
                moderation_status: status,
                updated_at: new Date().toISOString()
            };

            if (status === 'rejected') {
                updateData.rejection_reason = reason;
                updateData.is_active = false;

                // Refund credits
                const campaign = campaigns.find(c => c.id === campId);
                if (campaign?.credits_held && campaign?.credits_cost) {
                    const { data: ownerData } = await supabase
                        .from('users')
                        .select('tokens')
                        .eq('id', campaign.owner_id)
                        .single();

                    if (ownerData) {
                        const newBalance = (ownerData.tokens || 0) + campaign.credits_cost;
                        await supabase.from('users').update({ tokens: newBalance }).eq('id', campaign.owner_id);

                        await supabase.from('credit_transactions').insert({
                            user_id: campaign.owner_id,
                            campaign_id: campId,
                            type: 'refund',
                            amount: campaign.credits_cost,
                            balance_after: newBalance,
                            description: `Reembolso por rejeição: ${campaign.name}`,
                            metadata: { reason }
                        });

                        updateData.credits_held = false;
                        console.log(`💰 [REFUND] Devolvidos ${campaign.credits_cost} créditos para ${campaign.owner_id}`);
                    }
                }
            }

            const { error } = await supabase
                .from('campaigns')
                .update(updateData)
                .eq('id', campId);

            if (error) throw error;

            setCampaigns(prev => prev.map(c =>
                c.id === campId ? { ...c, ...updateData } : c
            ));

            setRejectionModalCamp(null);
            setRejectionReason('');

            alert(`Campanha ${status === 'rejected' ? 'rejeitada' : 'moderada'} com sucesso!`);
        } catch (err) {
            console.error('[MODERAÇÃO] Erro:', err);
            alert(`Erro na moderação: ${err.message}`);
        }
    };

    // ── Swap Approval ──────────────────────────────────────────
    const handleApproveSwap = async (camp) => {
        try {
            const newMediaId = camp.pending_swap_media_id;
            if (!newMediaId) return;

            console.log(`🔄 [SWAP] Aprovando troca de mídia para campanha "${camp.name}"`);

            // 1. Update campaign: set new media, clear pending, increment swap_count
            const { error: campError } = await supabase
                .from('campaigns')
                .update({
                    v_media_id: newMediaId,
                    pending_swap_media_id: null,
                    swap_count: (camp.swap_count || 0) + 1,
                    updated_at: new Date().toISOString()
                })
                .eq('id', camp.id);
            if (campError) throw campError;

            // 2. Update existing playlist_slots for this campaign (swap media in-place)
            const { data: updatedSlots, error: slotsError } = await supabase
                .from('playlist_slots')
                .update({ media_id: newMediaId })
                .eq('campaign_id', camp.id)
                .select('id');

            if (slotsError) {
                console.error('[SWAP] Erro ao atualizar slots:', slotsError);
            } else {
                console.log(`🔄 [SWAP] ✅ ${updatedSlots?.length || 0} slots atualizados com nova mídia`);
            }

            // 3. Also update global slots if campaign is global
            if (camp.is_global) {
                const { data: globalUpdated } = await supabase
                    .from('playlist_slots')
                    .update({ media_id: newMediaId })
                    .eq('slot_type', 'global')
                    .eq('slot_index', 0)
                    .select('id');
                console.log(`🌐 [SWAP] ${globalUpdated?.length || 0} slots globais atualizados`);
            }

            // Update local state
            setCampaigns(prev => prev.map(c =>
                c.id === camp.id ? {
                    ...c,
                    v_media_id: newMediaId,
                    pending_swap_media_id: null,
                    swap_count: (c.swap_count || 0) + 1
                } : c
            ));

            alert(`✅ Troca de mídia aprovada!\n\n${updatedSlots?.length || 0} slot(s) atualizado(s).\nA nova mídia já está no ar.`);
        } catch (err) {
            console.error('[SWAP] Erro:', err);
            alert(`Erro ao aprovar troca: ${err.message}`);
        }
    };

    const handleRejectSwap = async (camp) => {
        try {
            console.log(`🔄 [SWAP] Rejeitando troca de mídia para campanha "${camp.name}"`);

            // 1. Clear pending swap from campaign
            const { error: campError } = await supabase
                .from('campaigns')
                .update({
                    pending_swap_media_id: null,
                    updated_at: new Date().toISOString()
                })
                .eq('id', camp.id);
            if (campError) throw campError;

            // 2. Refund the swap fee
            const { data: ownerData } = await supabase
                .from('users')
                .select('tokens')
                .eq('id', camp.owner_id)
                .single();

            if (ownerData) {
                const newBalance = (ownerData.tokens || 0) + SWAP_FEE;
                await supabase.from('users').update({ tokens: newBalance }).eq('id', camp.owner_id);

                await supabase.from('credit_transactions').insert({
                    user_id: camp.owner_id,
                    campaign_id: camp.id,
                    type: 'refund',
                    amount: SWAP_FEE,
                    balance_after: newBalance,
                    description: `Reembolso troca rejeitada: ${camp.name}`,
                    metadata: { swap_fee: SWAP_FEE }
                });

                console.log(`💰 [SWAP] Devolvidos R$${SWAP_FEE} para owner ${camp.owner_id}`);
            }

            // Update local state
            setCampaigns(prev => prev.map(c =>
                c.id === camp.id ? { ...c, pending_swap_media_id: null } : c
            ));

            alert(`Troca rejeitada.\nR$${SWAP_FEE} devolvidos ao anunciante.`);
        } catch (err) {
            console.error('[SWAP] Erro:', err);
            alert(`Erro ao rejeitar troca: ${err.message}`);
        }
    };

    // Find campaigns with pending swaps (admin only)
    const pendingSwaps = userData?.role === 'admin'
        ? campaigns.filter(c => c.pending_swap_media_id)
        : [];

    return (
        <>
            {/* Approval Modal */}
            {approvalModalCamp && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[70] flex items-center justify-center p-4">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="bg-emerald-600 p-6 text-white">
                            <h3 className="text-xl font-black Outfit uppercase tracking-tight">Aprovar Campanha</h3>
                            <p className="text-emerald-100 text-xs mt-1 font-bold italic">Campanha: {approvalModalCamp.name}</p>
                        </div>
                        <div className="p-8 space-y-6">
                            {/* Categoria de Negócio */}
                            <div className="space-y-3">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">
                                    Categoria do Negócio (para exclusividade)
                                </label>
                                <select
                                    value={selectedCategory}
                                    onChange={(e) => {
                                        setSelectedCategory(e.target.value);
                                        checkCategoryConflicts(e.target.value, approvalModalCamp.id, approvalModalCamp.target_terminals);
                                    }}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm font-bold text-slate-800 focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500/50 outline-none transition-all"
                                >
                                    <option value="">Selecione uma categoria...</option>
                                    {businessCategories.map(cat => (
                                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Alertas de Conflito */}
                            {categoryConflicts.length > 0 && (
                                <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-4 space-y-3">
                                    <div className="flex items-center gap-2 text-amber-700">
                                        <AlertTriangle className="w-5 h-5" />
                                        <span className="text-xs font-black uppercase tracking-wide">
                                            {categoryConflicts.length} conflito(s) de exclusividade
                                        </span>
                                    </div>
                                    <div className="space-y-2">
                                        {categoryConflicts.map(conflict => (
                                            <div key={conflict.id} className="bg-white rounded-xl p-3 border border-amber-100">
                                                <div className="text-sm font-bold text-slate-700">{conflict.name}</div>
                                                <div className="text-[10px] text-slate-500">
                                                    Terminais em comum: {conflict.conflictingTerminals.map(t => t.name).join(', ')}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <p className="text-[10px] text-amber-600 italic">
                                        Você pode aprovar mesmo assim, mas as campanhas concorrentes exibirão no mesmo terminal.
                                    </p>
                                </div>
                            )}

                            {/* Botões */}
                            <div className="flex gap-4">
                                <button
                                    onClick={() => { setApprovalModalCamp(null); setSelectedCategory(''); setCategoryConflicts([]); }}
                                    className="flex-1 px-4 py-3 rounded-xl text-xs font-black text-slate-400 hover:bg-slate-50 transition-all Outfit uppercase tracking-widest"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleApproveWithCategory}
                                    className={`flex-1 text-white px-6 py-3 rounded-xl text-xs font-black shadow-lg transition-all transform active:scale-95 Outfit uppercase tracking-widest ${categoryConflicts.length > 0
                                        ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-500/20'
                                        : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20'
                                        }`}
                                >
                                    {categoryConflicts.length > 0 ? 'Aprovar Mesmo Assim' : 'Aprovar Campanha'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Rejection Modal */}
            {rejectionModalCamp && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[70] flex items-center justify-center p-4">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="bg-red-600 p-6 text-white">
                            <h3 className="text-xl font-black Outfit uppercase tracking-tight">Motivo da Rejeição</h3>
                            <p className="text-red-100 text-xs mt-1 font-bold italic">Campanha: {rejectionModalCamp.name}</p>
                        </div>
                        <div className="p-8 space-y-6">
                            <div className="space-y-3">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Feedback para o Cliente</label>
                                <textarea
                                    value={rejectionReason}
                                    onChange={(e) => setRejectionReason(e.target.value)}
                                    placeholder="Explique o que precisa ser corrigido (ex: Conteúdo impróprio, erro de português, etc)..."
                                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm font-bold text-slate-800 focus:ring-4 focus:ring-red-500/10 focus:border-red-500/50 outline-none transition-all resize-none h-32 shadow-inner"
                                    autoFocus
                                />
                            </div>
                            <div className="flex gap-4">
                                <button
                                    onClick={() => setRejectionModalCamp(null)}
                                    className="flex-1 px-4 py-3 rounded-xl text-xs font-black text-slate-400 hover:bg-slate-50 transition-all Outfit uppercase tracking-widest"
                                >
                                    Voltar
                                </button>
                                <button
                                    disabled={!rejectionReason}
                                    onClick={() => handleModerate(rejectionModalCamp.id, 'rejected', rejectionReason)}
                                    className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white px-6 py-3 rounded-xl text-xs font-black shadow-lg shadow-red-600/20 transition-all transform active:scale-95 Outfit uppercase tracking-widest"
                                >
                                    Confirmar Rejeição
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Swap Approval Cards (inline, not modal) */}
            {pendingSwaps.length > 0 && (
                <div className="fixed bottom-6 right-6 z-50 space-y-3 max-w-sm">
                    {pendingSwaps.map(camp => {
                        const newMedia = camp.pending_swap_media_id;
                        return (
                            <div key={camp.id} className="bg-white rounded-2xl shadow-2xl border border-cyan-200 overflow-hidden animate-in slide-in-from-right">
                                <div className="bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-3 text-white flex items-center gap-2">
                                    <RefreshCw className="w-4 h-4" />
                                    <span className="text-xs font-black uppercase tracking-wide">Troca de Mídia Pendente</span>
                                </div>
                                <div className="p-4 space-y-3">
                                    <p className="text-sm font-black text-slate-800">{camp.name}</p>
                                    <p className="text-[10px] text-slate-400 font-bold">Swap #{(camp.swap_count || 0) + 1} • Taxa R${SWAP_FEE} já cobrada</p>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => handleApproveSwap(camp)}
                                            className="flex-1 px-3 py-2 bg-emerald-500 text-white text-[10px] font-black rounded-xl hover:bg-emerald-600 transition-all uppercase active:scale-95"
                                        >
                                            Aprovar Troca
                                        </button>
                                        <button
                                            onClick={() => handleRejectSwap(camp)}
                                            className="flex-1 px-3 py-2 bg-red-500 text-white text-[10px] font-black rounded-xl hover:bg-red-600 transition-all uppercase active:scale-95"
                                        >
                                            Rejeitar
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </>
    );
};

export default CampaignModeration;
