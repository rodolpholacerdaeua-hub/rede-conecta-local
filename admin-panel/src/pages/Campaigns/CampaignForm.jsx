/**
 * CampaignForm — Create and Edit campaigns (manual and AI)
 */
import React, { useState } from 'react';
import {
    Plus, Save, Sparkles, Wand2, Send, Coins,
    Image as ImageLucide, Globe, Layers, Tag, CheckCircle, XCircle, Loader2
} from 'lucide-react';
import { supabase } from '../../supabase';
import { useAuth } from '../../contexts/AuthContext';
import { canCreateCampaign } from '../../utils/planHelpers';
import { createDocument, updateDocument } from '../../db';
import {
    AI_CREATION_COST, SLOT_PRICES, EDIT_FEE,
    calculateCampaignCost
} from './campaignUtils';
import MediaPicker from './MediaPicker';
import TerminalPicker from './TerminalPicker';

const CampaignForm = ({
    // Data
    mediaFiles,
    terminals,
    campaigns,

    // Form fields
    newName, setNewName,
    vMediaId, setVMediaId,
    screensQuota, setScreensQuota,
    targetTerminals, setTargetTerminals,
    isGlobal, setIsGlobal,
    slotsCount, setSlotsCount,
    editingCamp, setEditingCamp,

    // AI fields
    aiText, setAiText,
    previewPhotos,
    isSubmittingAI, setIsSubmittingAI,
    isAIGenerating,

    // Actions
    handleToggleTerminal,
    handlePhotoSelect,
    resetForm,
}) => {
    const { currentUser, userData } = useAuth();

    // ── Estado do Cupom de Indicação ────────────────────
    const [couponCode, setCouponCode] = useState('');
    const [couponValidating, setCouponValidating] = useState(false);
    const [validatedCoupon, setValidatedCoupon] = useState(null); // { id, code, discount_pct, partner_id }
    const [couponError, setCouponError] = useState('');

    const handleValidateCoupon = async () => {
        if (!couponCode.trim()) return;
        setCouponValidating(true);
        setCouponError('');
        setValidatedCoupon(null);

        try {
            const { data, error } = await supabase
                .from('partner_codes')
                .select('id, code, discount_pct, partner_id, referral_pct, revenue_share_pct')
                .eq('code', couponCode.trim().toUpperCase())
                .eq('is_active', true)
                .single();

            if (error || !data) {
                setCouponError('Código inválido ou expirado');
            } else if (data.partner_id === currentUser?.id) {
                setCouponError('Você não pode usar seu próprio código');
            } else {
                setValidatedCoupon(data);
            }
        } catch {
            setCouponError('Erro ao validar código');
        } finally {
            setCouponValidating(false);
        }
    };

    const handleClearCoupon = () => {
        setCouponCode('');
        setValidatedCoupon(null);
        setCouponError('');
    };

    // Custo com desconto
    const getEffectiveCost = (slots) => {
        const base = calculateCampaignCost(slots);
        if (!validatedCoupon) return base;
        const discount = Number(validatedCoupon.discount_pct) / 100;
        return Math.round(base * (1 - discount));
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        console.log("📋 [CAMPAIGN] Iniciando criação...", { newName, vMediaId, targetTerminals, isGlobal, slotsCount });

        if (!newName || !vMediaId) return alert("Preencha o nome e selecione uma mídia!");
        if (!isGlobal && targetTerminals.length === 0) return alert("Selecione ao menos uma tela ou marque como Global!");

        const originalCost = calculateCampaignCost(slotsCount);
        const campaignCost = getEffectiveCost(slotsCount);
        const discountApplied = originalCost - campaignCost;
        const userCredits = userData?.tokens || 0;

        if (!editingCamp) {
            if (userCredits < campaignCost) {
                return alert(`❌ Créditos insuficientes!\n\nVocê tem: ${userCredits} créditos\nCusto da campanha: ${campaignCost} créditos (${slotsCount} slot${slotsCount > 1 ? 's' : ''})\n\nAcesse Créditos & Finanças para recarregar.`);
            }

            const validation = canCreateCampaign(userData, campaigns, screensQuota);
            if (!validation.can) return alert(validation.reason);
        }

        try {
            const data = {
                name: newName,
                h_media_id: null,
                v_media_id: vMediaId || null,
                screens_quota: isGlobal ? -1 : screensQuota,
                target_terminals: isGlobal ? [] : targetTerminals,
                is_global: isGlobal,
                moderation_status: 'pending',
                slots_count: slotsCount,
                credits_cost: campaignCost,
                credits_held: true,
                updated_at: new Date().toISOString(),
                is_active: false,
                // Cupom de indicação
                partner_code_id: validatedCoupon?.id || null,
                discount_applied: discountApplied,
                original_cost: originalCost
            };

            console.log("📋 [CAMPAIGN] Dados preparados:", data);

            if (editingCamp) {
                const isApproved = editingCamp.moderation_status === 'approved';

                if (isApproved) {
                    if (userCredits < EDIT_FEE) {
                        return alert(`❌ Créditos insuficientes para alteração!\n\nVocê tem: ${userCredits} créditos\nTaxa de alteração: ${EDIT_FEE} créditos\n\nAcesse Créditos & Finanças para recarregar.`);
                    }

                    const confirma = window.confirm(`⚠️ Esta campanha já está aprovada e ativa.\n\nAlterar campanha dentro da vigência cobrará uma taxa de serviço de R$ ${EDIT_FEE},00.\n\nDeseja continuar?`);
                    if (!confirma) return;

                    const newBalance = userCredits - EDIT_FEE;
                    const { error: editFeeError } = await supabase
                        .from('users')
                        .update({ tokens: newBalance })
                        .eq('id', currentUser.id);

                    if (editFeeError) throw editFeeError;

                    await supabase
                        .from('credit_transactions')
                        .insert({
                            user_id: currentUser.id,
                            campaign_id: editingCamp.id,
                            type: 'consume',
                            amount: -EDIT_FEE,
                            balance_after: newBalance,
                            description: `Taxa de alteração: ${newName}`,
                            metadata: { edit_fee: EDIT_FEE, original_campaign: editingCamp.name }
                        });
                }

                await updateDocument('campaigns', editingCamp.id, {
                    ...data,
                    credits_held: editingCamp.credits_held
                });

                if (editingCamp.is_global || isGlobal) {
                    const mediaId = vMediaId || data.v_media_id;
                    if (mediaId) {
                        console.log('🌐 [EDIT] Campanha global editada — atualizando TODOS os slots globais...');
                        const { data: updatedSlots, error: slotsError } = await supabase
                            .from('playlist_slots')
                            .update({ media_id: mediaId })
                            .eq('slot_type', 'global')
                            .eq('slot_index', 0)
                            .select('id');

                        if (slotsError) {
                            console.error('🌐 [EDIT] ⚠️ Erro ao atualizar slots globais:', slotsError);
                        } else {
                            console.log(`🌐 [EDIT] ✅ ${updatedSlots?.length || 0} slots globais atualizados com mídia ${mediaId}`);
                        }
                    }
                }

                setEditingCamp(null);

                if (isApproved) {
                    alert(`✅ Campanha atualizada!\n\n💰 Taxa de R$ ${EDIT_FEE} cobrada.\n📋 Enviada para nova análise.`);
                } else {
                    alert("Campanha atualizada e enviada para nova análise!");
                }
            } else {
                const { data: newCampaign, error: campError } = await supabase
                    .from('campaigns')
                    .insert({
                        ...data,
                        owner_id: currentUser.id,
                        status_financeiro: false,
                        created_at: new Date().toISOString()
                    })
                    .select()
                    .single();

                if (campError) throw campError;

                const newBalance = userCredits - campaignCost;
                const { error: debitError } = await supabase
                    .from('users')
                    .update({ tokens: newBalance })
                    .eq('id', currentUser.id);

                if (debitError) throw debitError;

                await supabase
                    .from('credit_transactions')
                    .insert({
                        user_id: currentUser.id,
                        campaign_id: newCampaign.id,
                        type: 'hold',
                        amount: -campaignCost,
                        balance_after: newBalance,
                        description: `Reserva para campanha: ${newName} (${slotsCount} slot${slotsCount > 1 ? 's' : ''})`,
                        metadata: { slots_count: slotsCount, pricing: SLOT_PRICES[slotsCount] }
                    });

                // Incrementar uses_count do partner_code se usado
                if (validatedCoupon) {
                    await supabase
                        .from('partner_codes')
                        .update({ uses_count: (validatedCoupon.uses_count || 0) + 1, updated_at: new Date().toISOString() })
                        .eq('id', validatedCoupon.id);
                }

                console.log("✅ [CAMPAIGN] Campanha criada e créditos reservados!");
                const discountMsg = discountApplied > 0 ? `\n🎁 Desconto de cupom: R$ ${discountApplied},00` : '';
                alert(`✅ Campanha criada!\n\n💰 ${campaignCost} créditos reservados.${discountMsg}\n📋 Aguardando moderação.\n\nSe aprovada: créditos consumidos.\nSe reprovada: créditos devolvidos.`);
            }

            resetForm();
        } catch (error) {
            console.error("❌ [CAMPAIGN] Erro ao criar:", error);
            alert(`Erro ao salvar campanha: ${error.message || 'Verifique o console'}`);
        }
    };

    const handleAISubmit = async (e) => {
        e.preventDefault();
        if (!aiText || !newName) return alert("Nome e texto são obrigatórios!");
        if (targetTerminals.length === 0) return alert("Selecione os totens alvo!");

        const validation = canCreateCampaign(userData, campaigns, screensQuota);
        if (!validation.can) return alert(validation.reason);

        if (userData?.tokens < AI_CREATION_COST) return alert(`Saldo Insuficiente! Você precisa de ${AI_CREATION_COST} tokens.`);

        setIsSubmittingAI(true);
        try {
            const { data: currentUserData } = await supabase
                .from('users')
                .select('tokens')
                .eq('id', currentUser.id)
                .single();

            await supabase
                .from('users')
                .update({ tokens: (currentUserData?.tokens || 0) - AI_CREATION_COST })
                .eq('id', currentUser.id);

            const campaignResult = await createDocument('campaigns', {
                name: `${newName} (Gerando IA...)`,
                status_financeiro: true,
                is_active: false,
                moderation_status: 'pending',
                created_at: new Date().toISOString(),
                is_ai_generating: true,
                owner_id: currentUser.id,
                screens_quota: screensQuota,
                target_terminals: targetTerminals
            });

            await createDocument('generation_requests', {
                campaign_id: campaignResult.id,
                campaign_name: newName,
                prompt: aiText,
                status: 'pending',
                created_at: new Date().toISOString(),
                type: 'maas_creative',
                owner_id: currentUser.id
            });

            alert(`Débito de ${AI_CREATION_COST} tokens realizado. Aguarde a IA gerar os conteúdos!`);
            setNewName(''); setAiText(''); setTargetTerminals([]);
        } catch (error) { alert("Erro na geração IA."); console.error(error); } finally { setIsSubmittingAI(false); }
    };

    return (
        <div className="bg-white rounded-[2.5rem] p-8 md:p-12 border border-slate-100 premium-shadow relative overflow-hidden animate-in slide-in-from-top-4 duration-500">
            <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none">
                {isAIGenerating ? <Wand2 className="w-48 h-48" /> : <Layers className="w-48 h-48" />}
            </div>

            <div className="flex items-center space-x-4 mb-10">
                <div className={`p-4 rounded-3xl text-white shadow-lg ${isAIGenerating ? 'bg-indigo-600' : 'bg-slate-800'}`}>
                    {isAIGenerating ? <Sparkles className="w-7 h-7" /> : <Plus className="w-7 h-7" />}
                </div>
                <div>
                    <h3 className="text-2xl font-black text-slate-800 Outfit">
                        {isAIGenerating ? 'Configurar Inteligência de Criação' : editingCamp ? `Editando Campanha: ${editingCamp.name}` : 'Vincular Mídias Existentes'}
                    </h3>
                    <p className="text-sm font-bold text-slate-400 italic">
                        {isAIGenerating ? 'Defina o conceito e a IA cuidará de todos os formatos.' : 'Selecione mídias V/H já enviadas à biblioteca.'}
                    </p>
                </div>
            </div>

            <form onSubmit={isAIGenerating ? handleAISubmit : handleCreate} className="space-y-10 relative z-10">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                    {/* Left Col */}
                    <div className="space-y-8">
                        <div className="space-y-3">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] Outfit pl-1">Identificação da Campanha</label>
                            <input
                                type="text"
                                value={newName}
                                onChange={(e) => setNewName(e.target.value)}
                                placeholder="Ex: Promoção de Verão BK 2026"
                                className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm font-bold text-slate-800 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/50 outline-none transition-all"
                            />
                        </div>

                        {/* Seletor de Slots */}
                        <div className="space-y-3">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] Outfit pl-1">
                                Quantidade de Slots (15s cada)
                            </label>
                            <div className="grid grid-cols-3 gap-3">
                                {[1, 2, 3].map(slots => {
                                    const pricing = SLOT_PRICES[slots];
                                    const isSelected = slotsCount === slots;
                                    return (
                                        <button
                                            key={slots}
                                            type="button"
                                            onClick={() => setSlotsCount(slots)}
                                            className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-1 ${isSelected
                                                ? 'border-indigo-500 bg-indigo-50 ring-4 ring-indigo-500/10'
                                                : 'border-slate-200 bg-white hover:border-slate-300'}`}
                                        >
                                            <span className={`text-2xl font-black Outfit ${isSelected ? 'text-indigo-600' : 'text-slate-700'}`}>
                                                {slots}
                                            </span>
                                            <span className={`text-[10px] font-bold uppercase ${isSelected ? 'text-indigo-500' : 'text-slate-400'}`}>
                                                {slots === 1 ? 'slot' : 'slots'}
                                            </span>
                                            <div className="flex flex-col items-center mt-1">
                                                <span className={`text-sm font-black ${isSelected ? 'text-emerald-600' : 'text-slate-600'}`}>
                                                    R$ {pricing.final}
                                                </span>
                                                {pricing.discount > 0 && (
                                                    <span className="text-[9px] font-black text-emerald-500 bg-emerald-50 px-2 py-0.5 rounded-full mt-1">
                                                        {Math.round(pricing.discount * 100)}% OFF
                                                    </span>
                                                )}
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                            <p className="text-[10px] text-slate-400 italic pl-1">
                                Total: <span className="font-black text-indigo-600">{getEffectiveCost(slotsCount)} créditos</span> = R$ {getEffectiveCost(slotsCount)},00
                                {validatedCoupon && (
                                    <span className="ml-2 text-emerald-600">
                                        (desconto {Number(validatedCoupon.discount_pct)}% aplicado — era R$ {calculateCampaignCost(slotsCount)},00)
                                    </span>
                                )}
                            </p>
                        </div>

                        {/* ── Cupom de Indicação ──────────────── */}
                        {!editingCamp && !isAIGenerating && (
                            <div className="space-y-3">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] Outfit pl-1 flex items-center gap-1.5">
                                    <Tag className="w-3.5 h-3.5" />
                                    Possui código de indicação?
                                </label>

                                {validatedCoupon ? (
                                    <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
                                        <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                                        <div className="flex-1">
                                            <p className="text-sm font-black text-emerald-700">
                                                Cupom {validatedCoupon.code} aplicado!
                                            </p>
                                            <p className="text-[10px] text-emerald-500 font-bold">
                                                Desconto de {Number(validatedCoupon.discount_pct)}% no valor total
                                            </p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={handleClearCoupon}
                                            className="p-1.5 hover:bg-emerald-100 rounded-lg transition-colors"
                                        >
                                            <XCircle className="w-4 h-4 text-emerald-400" />
                                        </button>
                                    </div>
                                ) : (
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            value={couponCode}
                                            onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                                            placeholder="Ex: PADARIA10"
                                            className="flex-1 bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm font-bold text-slate-800 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/50 outline-none transition-all uppercase tracking-wider"
                                        />
                                        <button
                                            type="button"
                                            onClick={handleValidateCoupon}
                                            disabled={couponValidating || !couponCode.trim()}
                                            className="px-6 py-4 bg-slate-800 text-white rounded-2xl font-bold text-sm hover:bg-slate-700 transition-all disabled:opacity-40 flex items-center gap-2"
                                        >
                                            {couponValidating
                                                ? <Loader2 className="w-4 h-4 animate-spin" />
                                                : <Tag className="w-4 h-4" />
                                            }
                                            Validar
                                        </button>
                                    </div>
                                )}

                                {couponError && (
                                    <p className="text-xs font-bold text-red-500 pl-1 flex items-center gap-1">
                                        <XCircle className="w-3.5 h-3.5" /> {couponError}
                                    </p>
                                )}
                            </div>
                        )}

                        {isAIGenerating ? (
                            <div className="space-y-3">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] Outfit pl-1 text-indigo-500">Direcionamento Criativo (Prompt)</label>
                                <textarea
                                    value={aiText}
                                    onChange={(e) => setAiText(e.target.value)}
                                    rows="5"
                                    placeholder="Descreva aqui os textos, produtos, ofertas e o tom de voz do vídeo..."
                                    className="w-full bg-white border-2 border-indigo-100 rounded-2xl p-4 text-sm font-bold text-slate-800 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/50 outline-none transition-all resize-none shadow-inner"
                                />
                                <div
                                    onClick={() => document.getElementById('ai-photo-input').click()}
                                    className="group flex items-center justify-between p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100 border-dashed hover:bg-indigo-50 transition-all cursor-pointer"
                                >
                                    <input id="ai-photo-input" type="file" multiple className="hidden" onChange={handlePhotoSelect} />
                                    <div className="flex items-center space-x-3">
                                        <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-indigo-400 group-hover:scale-110 transition-transform shadow-sm">
                                            <ImageLucide className="w-5 h-5" />
                                        </div>
                                        <span className="text-xs font-black text-indigo-700 Outfit">Anexar Fotos de Referência</span>
                                    </div>
                                    <div className="flex -space-x-2">
                                        {previewPhotos.slice(0, 3).map((src, i) => (
                                            <img key={i} src={src} className="w-7 h-7 rounded-full border-2 border-white object-cover shadow-sm" alt="" />
                                        ))}
                                        {previewPhotos.length > 3 && (
                                            <div className="w-7 h-7 rounded-full border-2 border-white bg-slate-100 flex items-center justify-center text-[8px] font-black text-slate-500">
                                                +{previewPhotos.length - 3}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                <div className="p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100 flex items-center gap-3">
                                    <div className="w-10 h-16 bg-indigo-200 rounded-lg flex items-center justify-center text-[8px] font-black text-indigo-600">
                                        9:16
                                    </div>
                                    <div>
                                        <span className="text-xs font-black text-indigo-900 Outfit block">Formato Vertical</span>
                                        <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-tighter">Todas as mídias são 9:16</span>
                                    </div>
                                </div>

                                <MediaPicker
                                    label="Mídia Vertical 9:16"
                                    selectedId={vMediaId}
                                    onSelect={setVMediaId}
                                    mediaFiles={mediaFiles}
                                />
                            </div>
                        )}
                    </div>

                    {/* Right Col */}
                    <div className="space-y-8">
                        <div className="space-y-3">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] Outfit pl-1 text-slate-500">Inteligência de Rede (Quota)</label>
                            <select
                                value={screensQuota}
                                onChange={(e) => {
                                    const val = e.target.value === '-1' ? -1 : parseInt(e.target.value);
                                    setScreensQuota(val);
                                    setTargetTerminals([]);
                                }}
                                className="w-full bg-slate-100 border border-slate-200 rounded-2xl p-4 text-sm font-black text-slate-900 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/50 outline-none transition-all cursor-pointer"
                            >
                                <option value={1}>Plano Start (Até 1 Tela)</option>
                                <option value={3}>Plano Business (Até 3 Telas)</option>
                                <option value={5}>Plano Premium (Até 5 Telas)</option>
                                <option value={10}>Plano Enterprise (Até 10 Telas)</option>
                                <option value={-1}>Rede Ilimitada (Unlimited)</option>
                            </select>
                        </div>

                        {userData?.role === 'admin' && (
                            <div className="p-6 bg-indigo-50/30 rounded-3xl border border-indigo-100/50 space-y-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center space-x-3">
                                        <div className="p-2 bg-indigo-600 rounded-xl text-white">
                                            <Globe className="w-4 h-4" />
                                        </div>
                                        <div>
                                            <span className="text-xs font-black text-indigo-900 Outfit block">Campanha Global</span>
                                            <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-tighter italic">Visível em todos os totens da rede</span>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setIsGlobal(!isGlobal);
                                            if (!isGlobal) setTargetTerminals([]);
                                        }}
                                        className={`w-12 h-6 rounded-full transition-all relative ${isGlobal ? 'bg-indigo-600' : 'bg-slate-200'}`}
                                    >
                                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${isGlobal ? 'left-7' : 'left-1'}`} />
                                    </button>
                                </div>
                            </div>
                        )}

                        {!isGlobal && (
                            <TerminalPicker
                                quota={screensQuota}
                                selectedTerminals={targetTerminals}
                                onToggle={handleToggleTerminal}
                                terminals={terminals}
                            />
                        )}
                    </div>
                </div>

                {/* Submit Row */}
                <div className="flex flex-col md:flex-row items-center justify-between gap-6 pt-10 border-t border-slate-100">
                    {isAIGenerating && (
                        <div className="flex items-center space-x-3 bg-amber-50 px-5 py-3 rounded-2xl border border-amber-100">
                            <div className="bg-amber-500 p-2 rounded-xl">
                                <Coins className="w-4 h-4 text-white" />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[10px] font-black text-amber-700 uppercase tracking-widest leading-none">Custo de Produção</span>
                                <span className="text-sm font-black text-amber-900 Outfit mt-1">{AI_CREATION_COST} Tokens AI</span>
                            </div>
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={isSubmittingAI}
                        className={`
                            w-full md:w-auto px-10 py-5 rounded-[2rem] font-black text-lg shadow-2xl transition-all duration-300 transform active:scale-95 disabled:opacity-50 flex items-center justify-center space-x-3 Outfit
                            ${isAIGenerating
                                ? 'bg-gradient-to-r from-indigo-600 to-indigo-800 text-white shadow-indigo-600/30 hover:translate-y-[-4px]'
                                : 'bg-slate-900 text-white shadow-slate-900/30 hover:bg-black hover:translate-y-[-4px]'}
                        `}
                    >
                        {isSubmittingAI ? (
                            <>
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                <span>Processando...</span>
                            </>
                        ) : (
                            <>
                                {isAIGenerating ? <Sparkles className="w-6 h-6" /> : editingCamp ? <Send className="w-6 h-6" /> : <Save className="w-6 h-6" />}
                                <span>{isAIGenerating ? 'Pagar e Gerar Campanha' : editingCamp ? 'Atualizar e Reenviar' : 'Gravar e Vincular'}</span>
                            </>
                        )}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default CampaignForm;
