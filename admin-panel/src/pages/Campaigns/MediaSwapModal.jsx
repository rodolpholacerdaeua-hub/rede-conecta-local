/**
 * MediaSwapModal — Modal for advertisers to request a media swap
 * 
 * Shows current media, lets user pick new media, confirms R$19 charge,
 * and submits the swap request for admin moderation.
 */
import React, { useState } from 'react';
import { RefreshCw, X, AlertTriangle, CheckCircle, Coins } from 'lucide-react';
import { supabase } from '../../supabase';
import { useAuth } from '../../contexts/AuthContext';
import { SWAP_FEE } from './campaignUtils';
import MediaPicker from './MediaPicker';

const MediaSwapModal = ({ campaign, mediaFiles, onClose, onSwapSubmitted }) => {
    const { currentUser, userData } = useAuth();
    const [newMediaId, setNewMediaId] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    if (!campaign) return null;

    const currentMedia = mediaFiles.find(m => m.id === campaign.v_media_id);
    const userCredits = userData?.tokens || 0;
    const canAfford = userCredits >= SWAP_FEE;

    const handleSubmitSwap = async () => {
        if (!newMediaId) return alert('Selecione a nova mídia!');
        if (newMediaId === campaign.v_media_id) return alert('Selecione uma mídia diferente da atual!');
        if (!canAfford) return alert(`Créditos insuficientes! Você tem ${userCredits}, precisa de ${SWAP_FEE}.`);

        setIsSubmitting(true);
        try {
            // 1. Deduct credits
            const newBalance = userCredits - SWAP_FEE;
            const { error: balanceError } = await supabase
                .from('users')
                .update({ tokens: newBalance })
                .eq('id', currentUser.id);
            if (balanceError) throw balanceError;

            // 2. Log the transaction
            await supabase.from('credit_transactions').insert({
                user_id: currentUser.id,
                campaign_id: campaign.id,
                type: 'consume',
                amount: -SWAP_FEE,
                balance_after: newBalance,
                description: `Troca de mídia: ${campaign.name}`,
                metadata: { swap_fee: SWAP_FEE, old_media_id: campaign.v_media_id, new_media_id: newMediaId }
            });

            // 3. Set pending swap on campaign (status stays approved, media keeps playing)
            const { error: campError } = await supabase
                .from('campaigns')
                .update({
                    pending_swap_media_id: newMediaId,
                    updated_at: new Date().toISOString()
                })
                .eq('id', campaign.id);
            if (campError) throw campError;

            alert(`✅ Troca solicitada!\n\n💰 R$${SWAP_FEE} debitados.\n📋 Sua mídia atual continua rodando até o admin aprovar a nova.`);
            onSwapSubmitted && onSwapSubmitted();
            onClose();
        } catch (error) {
            console.error('[SWAP] Erro:', error);
            alert(`Erro ao solicitar troca: ${error.message}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white rounded-3xl max-w-lg w-full mx-4 shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-r from-cyan-500 to-blue-600 p-6 text-white relative">
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 p-2 bg-white/20 rounded-xl hover:bg-white/30 transition-all"
                    >
                        <X className="w-5 h-5" />
                    </button>
                    <div className="flex items-center space-x-3">
                        <RefreshCw className="w-8 h-8" />
                        <div>
                            <h3 className="text-xl font-black Outfit">Trocar Mídia</h3>
                            <p className="text-sm text-white/80 font-bold">{campaign.name}</p>
                        </div>
                    </div>
                </div>

                <div className="p-6 space-y-6">
                    {/* Current media */}
                    <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Mídia Atual (em exibição)</p>
                        <div className="flex items-center space-x-3">
                            {currentMedia?.thumbnail ? (
                                <img src={currentMedia.thumbnail} alt="" className="w-12 h-12 rounded-xl object-cover" />
                            ) : (
                                <div className="w-12 h-12 bg-slate-200 rounded-xl flex items-center justify-center">
                                    <span className="text-xs text-slate-400">V</span>
                                </div>
                            )}
                            <div>
                                <p className="text-sm font-black text-slate-700">{currentMedia?.name || 'Mídia atual'}</p>
                                <p className="text-[10px] text-slate-400 font-bold">Continuará rodando até aprovação da nova</p>
                            </div>
                        </div>
                    </div>

                    {/* New media picker */}
                    <MediaPicker
                        label="Nova Mídia"
                        selectedId={newMediaId}
                        onSelect={setNewMediaId}
                        mediaFiles={mediaFiles.filter(m => m.id !== campaign.v_media_id)}
                    />

                    {/* Cost info */}
                    <div className={`rounded-2xl p-4 border ${canAfford ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                                <Coins className={`w-5 h-5 ${canAfford ? 'text-emerald-500' : 'text-red-500'}`} />
                                <span className="text-sm font-black text-slate-700">Custo da Troca</span>
                            </div>
                            <span className={`text-xl font-black ${canAfford ? 'text-emerald-600' : 'text-red-600'}`}>
                                R$ {SWAP_FEE}
                            </span>
                        </div>
                        <div className="mt-2 flex items-center justify-between text-[10px] font-bold">
                            <span className="text-slate-400">Seu saldo: {userCredits} créditos</span>
                            {canAfford ? (
                                <span className="text-emerald-500 flex items-center gap-1">
                                    <CheckCircle className="w-3 h-3" /> Saldo suficiente
                                </span>
                            ) : (
                                <span className="text-red-500 flex items-center gap-1">
                                    <AlertTriangle className="w-3 h-3" /> Créditos insuficientes
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Info box */}
                    <div className="bg-blue-50 rounded-2xl p-4 border border-blue-200">
                        <div className="flex items-start space-x-3">
                            <AlertTriangle className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                            <div className="text-[11px] text-blue-700 font-bold space-y-1">
                                <p>A mídia atual <strong>continua rodando</strong> até o admin aprovar a nova.</p>
                                <p>Você pode enviar trocas ilimitadas (R${SWAP_FEE} cada).</p>
                            </div>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            className="flex-1 px-6 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black text-sm hover:bg-slate-200 transition-all"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleSubmitSwap}
                            disabled={!newMediaId || !canAfford || isSubmitting}
                            className={`flex-1 px-6 py-4 rounded-2xl font-black text-sm transition-all flex items-center justify-center gap-2 ${!newMediaId || !canAfford || isSubmitting
                                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                    : 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white hover:shadow-lg hover:shadow-cyan-500/30 active:scale-95'
                                }`}
                        >
                            {isSubmitting ? (
                                <RefreshCw className="w-5 h-5 animate-spin" />
                            ) : (
                                <>
                                    <RefreshCw className="w-5 h-5" />
                                    Solicitar Troca
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MediaSwapModal;
