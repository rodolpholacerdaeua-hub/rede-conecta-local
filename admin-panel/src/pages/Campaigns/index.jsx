/**
 * Campaigns/index.jsx — Orchestrator
 *
 * Composes all campaign sub-components: form, list, details, moderation.
 * Replaces the original monolithic Campaigns.jsx (1544 lines → ~170 lines).
 */
import React from 'react';
import { Layers, Sparkles, Plus } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../supabase';
import { updateDocument, createDocument, deleteDocument } from '../../db';
import { canCreateCampaign } from '../../utils/planHelpers';

import { useCampaignData } from './useCampaignData';
import CampaignForm from './CampaignForm';
import CampaignList from './CampaignList';
import CampaignDetails from './CampaignDetails';
import CampaignModeration from './CampaignModeration';
import MediaSwapModal from './MediaSwapModal';

const Campaigns = () => {
    const { currentUser, userData } = useAuth();

    const data = useCampaignData(currentUser, userData);

    // ── Swap state ──────────────────────────────────────────────────
    const [swapCamp, setSwapCamp] = React.useState(null);

    // ── Handlers (thin wrappers living in orchestrator) ──────────────
    const handleDelete = async (id) => {
        console.log("🗑️ [DELETE] Iniciando exclusão da campanha:", id);
        try {
            try {
                await supabase.from('credit_transactions').delete().eq('campaign_id', id);
                console.log("🗑️ [DELETE] Transações de crédito removidas");
            } catch (txError) {
                console.warn("⚠️ [DELETE] Erro ao remover transações (não crítico):", txError);
            }

            await deleteDocument('campaigns', id);
            data.setCampaigns(prev => prev.filter(c => c.id !== id));

            console.log("✅ [DELETE] Campanha excluída com sucesso!");
            alert("Campanha excluída com sucesso!");
        } catch (error) {
            console.error("❌ [DELETE] Erro ao excluir:", error);
            alert(`Erro ao excluir campanha: ${error.message || 'Verifique o console'}`);
        }
    };

    const handleEditCampaign = (camp) => {
        data.setEditingCamp(camp);
        data.setIsAdding(true);
        data.setIsAIGenerating(false);
        data.setNewName(camp.name);
        data.setHMediaId('');
        data.setVMediaId(camp.v_media_id || '');
        data.setScreensQuota(camp.screens_quota || 1);
        data.setTargetTerminals(camp.target_terminals || []);
        data.setIsGlobal(camp.is_global || false);
        data.setSlotsCount(camp.slots_count || 1);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleRefinementRequest = (camp) => {
        data.setRefiningCamp(camp);
        data.setRefinementText('');
    };

    const submitRefinement = async () => {
        if (!data.refinementText || !data.refiningCamp) return;
        try {
            await updateDocument('campaigns', data.refiningCamp.id, {
                is_ai_generating: true,
                last_refinement_reason: data.refinementText
            });
            await createDocument('generation_requests', {
                campaign_id: data.refiningCamp.id,
                campaign_name: data.refiningCamp.name,
                prompt: data.refinementText,
                status: 'pending',
                type: 'refinement',
                created_at: new Date().toISOString()
            });
            data.setRefiningCamp(null);
        } catch (error) { console.error(error); }
    };

    const openApprovalModal = (camp) => {
        console.log("📋 [APROVAÇÃO] Abrindo modal para:", camp.name);
        data.setApprovalModalCamp(camp);
        data.setSelectedCategory('');
        data.setCategoryConflicts([]);
    };

    // ── Render ──────────────────────────────────────────────────────
    return (
        <div className="space-y-10 animate-fade-in">
            {/* Page Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-2 border-b border-slate-200/60">
                <div>
                    <div className="flex items-center space-x-2 mb-2">
                        <Layers className="w-5 h-5 text-indigo-600" />
                        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-500 Outfit">Content Engine</span>
                    </div>
                    <h2 className="text-4xl font-black text-slate-800 Outfit tracking-tight leading-none">Minhas Campanhas</h2>
                    <p className="text-sm font-bold text-slate-400 mt-2 italic flex items-center gap-2">
                        Gerencie sua rede de mídia descentralizada e criativos de IA
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    {canCreateCampaign(userData, data.campaigns, data.screensQuota).can ? (
                        <>
                            <button
                                onClick={() => { data.setIsAIGenerating(!data.isAIGenerating); data.setIsAdding(false); }}
                                className={`group relative flex items-center space-x-2 px-6 py-4 rounded-2xl transition-all duration-300 font-black text-sm Outfit shadow-xl shadow-indigo-500/10 ${data.isAIGenerating ? 'bg-indigo-50 text-indigo-600 border border-indigo-200' : 'bg-indigo-600 hover:bg-indigo-700 text-white border border-transparent'}`}
                            >
                                <Sparkles className={`w-5 h-5 transition-transform group-hover:scale-110 ${!data.isAIGenerating && 'animate-pulse text-indigo-300'}`} />
                                <span>{data.isAIGenerating ? 'Cancelar Criação IA' : 'Nova Campanha com IA'}</span>
                            </button>

                            <button
                                onClick={() => { data.setIsAdding(!data.isAdding); data.setIsAIGenerating(false); }}
                                className={`flex items-center space-x-2 px-6 py-4 rounded-2xl transition-all font-black text-sm Outfit shadow-xl shadow-slate-200 ${data.isAdding ? 'bg-slate-100 text-slate-600 border border-slate-200' : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200'}`}
                            >
                                <Plus className="w-5 h-5" />
                                <span>{data.isAdding ? 'Cancelar' : 'Fazer Vínculo Manual'}</span>
                            </button>
                        </>
                    ) : (
                        <div className="px-6 py-4 bg-amber-50 text-amber-700 rounded-2xl border border-amber-200 text-sm font-bold">
                            <span>Limite do plano atingido</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Form (AI or Manual) */}
            {(data.isAIGenerating || data.isAdding) && (
                <CampaignForm
                    mediaFiles={data.mediaFiles}
                    terminals={data.terminals}
                    campaigns={data.campaigns}
                    newName={data.newName}
                    setNewName={data.setNewName}
                    vMediaId={data.vMediaId}
                    setVMediaId={data.setVMediaId}
                    screensQuota={data.screensQuota}
                    setScreensQuota={data.setScreensQuota}
                    targetTerminals={data.targetTerminals}
                    setTargetTerminals={data.setTargetTerminals}
                    isGlobal={data.isGlobal}
                    setIsGlobal={data.setIsGlobal}
                    slotsCount={data.slotsCount}
                    setSlotsCount={data.setSlotsCount}
                    editingCamp={data.editingCamp}
                    setEditingCamp={data.setEditingCamp}
                    aiText={data.aiText}
                    setAiText={data.setAiText}
                    previewPhotos={data.previewPhotos}
                    isSubmittingAI={data.isSubmittingAI}
                    setIsSubmittingAI={data.setIsSubmittingAI}
                    isAIGenerating={data.isAIGenerating}
                    handleToggleTerminal={data.handleToggleTerminal}
                    handlePhotoSelect={data.handlePhotoSelect}
                    resetForm={data.resetForm}
                />
            )}

            {/* Campaign List */}
            <CampaignList
                campaigns={data.campaigns}
                mediaFiles={data.mediaFiles}
                userData={userData}
                currentUser={currentUser}
                onPreview={(c) => { console.log("👁️ Preview Camp:", c); data.setPreviewCamp(c); }}
                onApprove={openApprovalModal}
                onReject={(c) => data.setRejectionModalCamp(c)}
                onEdit={handleEditCampaign}
                onDelete={handleDelete}
                onRefinement={handleRefinementRequest}
                onSwap={(c) => setSwapCamp(c)}
            />

            {/* Modals: Preview + Refinement */}
            <CampaignDetails
                previewCamp={data.previewCamp}
                setPreviewCamp={data.setPreviewCamp}
                mediaFiles={data.mediaFiles}
                onApprove={openApprovalModal}
                onReject={(c) => { data.setRejectionModalCamp(c); }}
                refiningCamp={data.refiningCamp}
                setRefiningCamp={data.setRefiningCamp}
                refinementText={data.refinementText}
                setRefinementText={data.setRefinementText}
                submitRefinement={submitRefinement}
            />

            {/* Modals: Approval + Rejection */}
            <CampaignModeration
                approvalModalCamp={data.approvalModalCamp}
                setApprovalModalCamp={data.setApprovalModalCamp}
                selectedCategory={data.selectedCategory}
                setSelectedCategory={data.setSelectedCategory}
                categoryConflicts={data.categoryConflicts}
                setCategoryConflicts={data.setCategoryConflicts}
                businessCategories={data.businessCategories}
                campaigns={data.campaigns}
                terminals={data.terminals}
                setCampaigns={data.setCampaigns}
                rejectionModalCamp={data.rejectionModalCamp}
                setRejectionModalCamp={data.setRejectionModalCamp}
                rejectionReason={data.rejectionReason}
                setRejectionReason={data.setRejectionReason}
                userData={userData}
            />

            {/* Swap Modal */}
            {swapCamp && (
                <MediaSwapModal
                    campaign={swapCamp}
                    mediaFiles={data.mediaFiles}
                    onClose={() => setSwapCamp(null)}
                    onSwapSubmitted={() => setSwapCamp(null)}
                />
            )}
        </div>
    );
};

export default Campaigns;
