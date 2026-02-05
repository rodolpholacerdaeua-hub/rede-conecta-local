import React, { useState, useEffect } from 'react';
import { db, getDocument, updateDocument, createDocument, deleteDocument, fetchCollection } from '../db';
import { supabase } from '../supabase';
import {
    Plus, Trash2, CheckCircle, XCircle, FileVideo, Image as ImageIcon,
    ChevronRight, Save, Sparkles, Wand2, Type, Image as ImageLucide,
    Send, AlertTriangle, Coins, Monitor, Play, Layers, Calendar, ArrowUpRight,
    Clock, Globe, Eye, X, ShieldAlert, Users, Edit2
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { canCreateCampaign, formatExpirationDate, calculateUsedScreens, getPlanQuota, getPlanValidityDays } from '../utils/planHelpers';

const AI_CREATION_COST = 50;

// Sistema de Créditos - Plano Start
// 1 crédito = R$ 1,00
const SLOT_PRICES = {
    1: { base: 150, discount: 0, final: 150 },     // Sem desconto
    2: { base: 300, discount: 0.10, final: 270 },  // 10% desconto
    3: { base: 450, discount: 0.15, final: 382 },  // 15% desconto
};

// Calcula o custo final baseado na quantidade de slots
const calculateCampaignCost = (slotsCount) => {
    const pricing = SLOT_PRICES[slotsCount] || SLOT_PRICES[1];
    return pricing.final;
};

// Taxa de alteração de campanha dentro da vigência
const EDIT_FEE = 35;

const MediaPicker = ({ label, orientation, selectedId, onSelect, mediaFiles }) => {
    const filteredMedia = mediaFiles.filter(m => m.orientation === orientation);
    const selected = mediaFiles.find(m => m.id === selectedId);

    return (
        <div className="space-y-3">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] Outfit pl-1">{label}</label>
            <div className="relative group">
                <select
                    value={selectedId || ''}
                    onChange={(e) => onSelect(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm font-bold text-slate-700 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/50 outline-none appearance-none transition-all cursor-pointer"
                >
                    <option value="">Selecione uma mídia {orientation}...</option>
                    {filteredMedia.map(m => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 group-hover:text-indigo-500 transition-colors">
                    <ChevronRight className="w-4 h-4 rotate-90" />
                </div>
            </div>

            {selected && (
                <div className="p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100 flex items-center space-x-4 animate-in fade-in slide-in-from-top-2">
                    <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center border border-indigo-200/50">
                        {selected.type === 'video' ? <FileVideo className="w-6 h-6 text-indigo-500" /> : <ImageIcon className="w-6 h-6 text-indigo-500" />}
                    </div>
                    <div className="flex flex-col min-w-0">
                        <span className="text-sm font-black text-indigo-900 truncate Outfit">{selected.name}</span>
                        <span className="text-[10px] font-black text-indigo-400 uppercase tracking-tighter">Mídia Confirmada • {selected.orientation}</span>
                    </div>
                </div>
            )}
        </div>
    );
};

const TerminalPicker = ({ quota, selectedTerminals, onToggle, terminals }) => {
    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center pl-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] Outfit">
                    Selecionar Telas ({selectedTerminals.length}/{quota === 'unlimited' ? '∞' : quota})
                </label>
                {selectedTerminals.length >= quota && quota !== 'unlimited' && (
                    <span className="text-[9px] text-amber-600 font-black bg-amber-50 px-2 py-1 rounded-full border border-amber-200 uppercase tracking-tighter">
                        LIMITE ATINGIDO
                    </span>
                )}
            </div>
            <div className="space-y-6 max-h-96 overflow-y-auto p-4 bg-slate-50/50 rounded-[2rem] border border-slate-200">
                {[...new Set(terminals.map(t => t.group || 'Default'))].sort().map(groupName => (
                    <div key={groupName} className="space-y-3">
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 pl-2">
                            <Users className="w-3 h-3" /> {groupName}
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {terminals.filter(t => (t.group || 'Default') === groupName).map(t => {
                                const isSelected = selectedTerminals.includes(t.id);
                                const isDisabled = !isSelected && quota !== 'unlimited' && selectedTerminals.length >= quota;

                                return (
                                    <button
                                        key={t.id}
                                        type="button"
                                        onClick={() => onToggle(t.id)}
                                        disabled={isDisabled}
                                        className={`flex flex-col p-4 rounded-2xl border-2 text-left transition-all duration-300 relative group overflow-hidden ${isSelected
                                            ? 'bg-white border-indigo-600 shadow-lg shadow-indigo-600/10'
                                            : isDisabled
                                                ? 'bg-slate-50 border-slate-100 opacity-40 cursor-not-allowed'
                                                : 'bg-white border-slate-100 hover:border-indigo-200 hover:shadow-md'
                                            }`}
                                    >
                                        {isSelected && (
                                            <div className="absolute top-2 right-2">
                                                <CheckCircle className="w-4 h-4 text-indigo-600 animate-in zoom-in" />
                                            </div>
                                        )}
                                        <span className={`text-xs font-black Outfit mb-1 truncate ${isSelected ? 'text-indigo-900' : 'text-slate-700'}`}>
                                            {t.name}
                                        </span>
                                        <div className="flex items-center space-x-2">
                                            <span className={`text-[9px] font-black uppercase tracking-widest ${isSelected ? 'text-indigo-400' : 'text-slate-400'}`}>
                                                {t.orientation}
                                            </span>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const Campaigns = () => {
    const { currentUser, userData } = useAuth();
    const [campaigns, setCampaigns] = useState([]);
    const [mediaFiles, setMediaFiles] = useState([]);
    const [terminals, setTerminals] = useState([]);
    const [isAdding, setIsAdding] = useState(false);
    const [isAIGenerating, setIsAIGenerating] = useState(false);
    const [previewPhotos, setPreviewPhotos] = useState([]);
    const [uploadingFiles, setUploadingFiles] = useState([]);
    const [refiningCamp, setRefiningCamp] = useState(null);
    const [refinementText, setRefinementText] = useState('');
    const [previewCamp, setPreviewCamp] = useState(null);

    const [newName, setNewName] = useState('');
    const [hMediaId, setHMediaId] = useState('');
    const [vMediaId, setVMediaId] = useState('');
    const [screensQuota, setScreensQuota] = useState(1);
    const [targetTerminals, setTargetTerminals] = useState([]);
    const [selectedOrientation, setSelectedOrientation] = useState(''); // 'landscape' ou 'portrait'

    const [aiText, setAiText] = useState('');
    const [aiPhotos, setAiPhotos] = useState([]);
    const [isSubmittingAI, setIsSubmittingAI] = useState(false);
    const [isGlobal, setIsGlobal] = useState(false);
    const [rejectionModalCamp, setRejectionModalCamp] = useState(null);
    const [rejectionReason, setRejectionReason] = useState('');
    const [editingCamp, setEditingCamp] = useState(null);
    const [slotsCount, setSlotsCount] = useState(1); // Quantidade de slots (1, 2 ou 3)

    // Estados para modal de aprovação com categoria
    const [approvalModalCamp, setApprovalModalCamp] = useState(null);
    const [businessCategories, setBusinessCategories] = useState([]);
    const [selectedCategory, setSelectedCategory] = useState('');
    const [categoryConflicts, setCategoryConflicts] = useState([]);

    useEffect(() => {
        if (!currentUser) return;
        let isMounted = true;

        const loadData = async () => {
            try {
                // Query de Campanhas
                let campaignsQuery = supabase.from('campaigns').select('*').order('created_at', { ascending: false });
                if (userData?.role !== 'admin') {
                    campaignsQuery = campaignsQuery.eq('owner_id', currentUser.id);
                }
                const { data: campaignsData } = await campaignsQuery;
                if (isMounted) setCampaigns(campaignsData || []);

                // Query de Mídias (apenas ativas, não excluídas)
                let mediaQuery = supabase.from('media').select('*')
                    .neq('status', 'deleted')
                    .order('created_at', { ascending: false });
                if (userData?.role !== 'admin') {
                    mediaQuery = mediaQuery.eq('owner_id', currentUser.id);
                }
                const { data: mediaData } = await mediaQuery;
                if (isMounted) setMediaFiles(mediaData || []);

                // Query de Terminais
                const { data: terminalsData } = await supabase.from('terminals').select('*').order('name');
                if (isMounted) setTerminals(terminalsData || []);

                // Query de Categorias de Negócio
                const { data: categoriesData } = await supabase.from('business_categories').select('*').order('name');
                if (isMounted) setBusinessCategories(categoriesData || []);
            } catch (e) {
                console.error('Campaigns load error:', e);
            }
        };

        loadData();

        // Realtime subscription para campanhas (com debounce para evitar reload durante interação)
        let debounceTimeout = null;
        const channel = supabase
            .channel('campaigns-realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'campaigns' }, () => {
                // Debounce de 500ms para evitar múltiplos reloads
                if (debounceTimeout) clearTimeout(debounceTimeout);
                debounceTimeout = setTimeout(() => {
                    loadData();
                }, 500);
            })
            .subscribe();

        return () => {
            isMounted = false;
            supabase.removeChannel(channel);
        };
    }, [currentUser?.id, userData?.role]);

    const handlePhotoSelect = (e) => {
        const files = Array.from(e.target.files);
        setUploadingFiles(prev => [...prev, ...files]);
        const newPreviews = files.map(file => URL.createObjectURL(file));
        setPreviewPhotos(prev => [...prev, ...newPreviews]);
    };

    const handleToggleTerminal = (id) => {
        setTargetTerminals(prev =>
            prev.includes(id)
                ? prev.filter(tid => tid !== id)
                : [...prev, id]
        );
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        console.log("📋 [CAMPAIGN] Iniciando criação...", { newName, hMediaId, vMediaId, selectedOrientation, targetTerminals, isGlobal, slotsCount });

        if (!newName || (!hMediaId && !vMediaId)) return alert("Preencha o nome e selecione uma mídia!");
        if (!isGlobal && targetTerminals.length === 0) return alert("Selecione ao menos uma tela ou marque como Global!");

        // Calcular custo da campanha
        const campaignCost = calculateCampaignCost(slotsCount);
        const userCredits = userData?.tokens || 0;

        // Validar créditos (apenas para nova campanha, não para edição)
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
                h_media_id: hMediaId || null,
                v_media_id: vMediaId || null,
                screens_quota: isGlobal ? 'unlimited' : screensQuota,
                target_terminals: isGlobal ? [] : targetTerminals,
                is_global: isGlobal,
                moderation_status: 'pending',
                slots_count: slotsCount,
                credits_cost: campaignCost,
                credits_held: true, // Créditos reservados até aprovação/rejeição
                updated_at: new Date().toISOString(),
                is_active: false
            };

            console.log("📋 [CAMPAIGN] Dados preparados:", data);

            if (editingCamp) {
                // Verifica se campanha já foi aprovada (cobrar taxa de edição)
                const isApproved = editingCamp.moderation_status === 'approved';

                if (isApproved) {
                    // Cobrar taxa de edição de R$ 35
                    if (userCredits < EDIT_FEE) {
                        return alert(`❌ Créditos insuficientes para alteração!\n\nVocê tem: ${userCredits} créditos\nTaxa de alteração: ${EDIT_FEE} créditos\n\nAcesse Créditos & Finanças para recarregar.`);
                    }

                    const confirma = window.confirm(`⚠️ Esta campanha já está aprovada e ativa.\n\nAlterar campanha dentro da vigência cobrará uma taxa de serviço de R$ ${EDIT_FEE},00.\n\nDeseja continuar?`);
                    if (!confirma) return;

                    // Debitar taxa de edição
                    const newBalance = userCredits - EDIT_FEE;
                    const { error: editFeeError } = await supabase
                        .from('users')
                        .update({ tokens: newBalance })
                        .eq('id', currentUser.id);

                    if (editFeeError) throw editFeeError;

                    // Registrar transação da taxa
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

                // Edição: atualizar campanha
                await updateDocument('campaigns', editingCamp.id, {
                    ...data,
                    credits_held: editingCamp.credits_held // Manter status anterior de reserva
                });
                setEditingCamp(null);

                if (isApproved) {
                    alert(`✅ Campanha atualizada!\n\n💰 Taxa de R$ ${EDIT_FEE} cobrada.\n📋 Enviada para nova análise.`);
                } else {
                    alert("Campanha atualizada e enviada para nova análise!");
                }
            } else {
                // Nova campanha: reservar créditos
                // 1. Criar campanha
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

                // 2. Debitar créditos do usuário
                const newBalance = userCredits - campaignCost;
                const { error: debitError } = await supabase
                    .from('users')
                    .update({ tokens: newBalance })
                    .eq('id', currentUser.id);

                if (debitError) throw debitError;

                // 3. Registrar transação de reserva (HOLD)
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

                console.log("✅ [CAMPAIGN] Campanha criada e créditos reservados!");
                alert(`✅ Campanha criada!\n\n💰 ${campaignCost} créditos reservados.\n📋 Aguardando moderação.\n\nSe aprovada: créditos consumidos.\nSe reprovada: créditos devolvidos.`);
            }

            // Resetar todos os campos do formulário
            setNewName('');
            setHMediaId('');
            setVMediaId('');
            setSelectedOrientation('');
            setTargetTerminals([]);
            setIsGlobal(false);
            setSlotsCount(1);
            setIsAdding(false);
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
            // Debitar tokens via RPC ou update direto
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
            setNewName(''); setAiText(''); setPreviewPhotos([]); setTargetTerminals([]); setIsAIGenerating(false);
        } catch (error) { alert("Erro na geração IA."); console.error(error); } finally { setIsSubmittingAI(false); }
    };

    const toggleActivation = async (id, currentStatus) => {
        try {
            await updateDocument('campaigns', id, { is_active: !currentStatus });
        } catch (error) { console.error(error); }
    };

    // Função para abrir modal de aprovação com seleção de categoria
    const openApprovalModal = async (campaign) => {
        setApprovalModalCamp(campaign);
        setSelectedCategory(campaign.business_category_id || '');
        setCategoryConflicts([]);
    };

    // Verificar conflitos de categoria nos terminais da campanha
    const checkCategoryConflicts = async (categoryId, campaignId, targetTerminalIds) => {
        if (!categoryId || !targetTerminalIds?.length) {
            setCategoryConflicts([]);
            return [];
        }

        // Buscar campanhas ativas da mesma categoria nos mesmos terminais
        const conflicts = campaigns.filter(c =>
            c.id !== campaignId &&
            c.business_category_id === categoryId &&
            c.is_active &&
            c.moderation_status === 'approved' &&
            c.target_terminals?.some(t => targetTerminalIds.includes(t))
        );

        // Adicionar info do terminal e categoria ao conflito
        const conflictsWithDetails = conflicts.map(c => {
            const category = businessCategories.find(cat => cat.id === categoryId);
            const conflictingTerminals = terminals.filter(t =>
                c.target_terminals?.includes(t.id) &&
                targetTerminalIds.includes(t.id)
            );
            return {
                ...c,
                categoryName: category?.name || 'N/A',
                conflictingTerminals
            };
        });

        setCategoryConflicts(conflictsWithDetails);
        return conflictsWithDetails;
    };

    // Aprovar campanha com categoria selecionada
    const handleApproveWithCategory = async () => {
        if (!approvalModalCamp) return;

        // Fechar modal e aprovar com a categoria selecionada
        const campId = approvalModalCamp.id;
        setApprovalModalCamp(null);

        // Chamar handleModerate com status approved e incluir a categoria
        await handleModerate(campId, 'approved', '', selectedCategory);
        setSelectedCategory('');
        setCategoryConflicts([]);
    };

    const handleModerate = async (id, status, reason = '', categoryId = null) => {
        console.log("🔄 [MODERATE] Iniciando moderação:", { id, status, reason });
        try {
            const campData = await getDocument('campaigns', id);
            console.log("🔄 [MODERATE] Campanha encontrada:", campData);
            if (!campData) {
                console.error("❌ [MODERATE] Campanha não encontrada!");
                return;
            }

            // Buscar dados do dono da campanha
            const ownerData = await getDocument('users', campData.owner_id);

            // Se for aprovação, verificar se o cliente ainda tem quota
            if (status === 'approved') {
                if (ownerData) {
                    // Buscar todas as campanhas do dono para calcular uso atual
                    const ownerCamps = await fetchCollection('campaigns', {
                        where: [['owner_id', '==', campData.owner_id]]
                    });

                    const usedScreens = calculateUsedScreens(ownerCamps);
                    const planQuota = getPlanQuota(ownerData.plan);
                    const willUse = Number(campData.screens_quota) || 0;

                    if (usedScreens + willUse > planQuota && ownerData.role !== 'admin') {
                        return alert(`Não é possível aprovar! O cliente já atingiu o limite de ${planQuota} telas do seu plano.`);
                    }
                }
            }

            // Calcular período de veiculação baseado no plano
            const validityDays = ownerData ? getPlanValidityDays(ownerData.plan) : 30;
            const now = new Date();
            const expiresAt = new Date(now);
            expiresAt.setDate(expiresAt.getDate() + validityDays);

            // Preparar dados de atualização
            const updateData = {
                moderation_status: status,
                is_active: status === 'approved',
                rejection_reason: reason || null,
                credits_held: false, // Créditos já foram processados
                updated_at: now.toISOString()
            };

            // Se aprovando, definir datas de validade e categoria
            if (status === 'approved') {
                updateData.approved_at = now.toISOString();
                updateData.expires_at = expiresAt.toISOString();
                updateData.validity_days = validityDays;
                if (categoryId) {
                    updateData.business_category_id = categoryId;
                }
                console.log("🔄 [MODERATE] Período de veiculação:", validityDays, "dias. Expira em:", expiresAt.toLocaleDateString('pt-BR'));

                // === CONSUMIR CRÉDITOS (já foram reservados na criação) ===
                if (campData.credits_held && campData.credits_cost > 0) {
                    // Registrar transação de consumo definitivo (não bloqueia aprovação se falhar)
                    try {
                        const currentBalance = ownerData?.tokens || 0;
                        await supabase
                            .from('credit_transactions')
                            .insert({
                                user_id: campData.owner_id,
                                campaign_id: id,
                                type: 'consume',
                                amount: 0, // Saldo já foi debitado na reserva
                                balance_after: currentBalance,
                                description: `Campanha aprovada: ${campData.name} (${campData.slots_count || 1} slot${(campData.slots_count || 1) > 1 ? 's' : ''})`,
                                metadata: { credits_cost: campData.credits_cost, approved_by: currentUser?.id }
                            });
                        console.log("✅ [MODERATE] Créditos consumidos definitivamente:", campData.credits_cost);
                    } catch (txError) {
                        console.warn("⚠️ [MODERATE] Erro ao registrar transação (não crítico):", txError);
                    }
                }
            } else if (status === 'rejected') {
                // === DEVOLVER CRÉDITOS ===
                if (campData.credits_held && campData.credits_cost > 0 && ownerData) {
                    const newBalance = (ownerData.tokens || 0) + campData.credits_cost;

                    // Devolver créditos ao usuário
                    const { error: refundError } = await supabase
                        .from('users')
                        .update({ tokens: newBalance })
                        .eq('id', campData.owner_id);

                    if (refundError) throw refundError;

                    // Registrar transação de reembolso (não bloqueia rejeição se falhar)
                    try {
                        await supabase
                            .from('credit_transactions')
                            .insert({
                                user_id: campData.owner_id,
                                campaign_id: id,
                                type: 'refund',
                                amount: campData.credits_cost,
                                balance_after: newBalance,
                                description: `Campanha reprovada: ${campData.name} - ${reason || 'Sem motivo especificado'}`,
                                metadata: { credits_refunded: campData.credits_cost, rejected_by: currentUser?.id }
                            });
                        console.log("💰 [MODERATE] Créditos devolvidos:", campData.credits_cost);
                    } catch (txError) {
                        console.warn("⚠️ [MODERATE] Erro ao registrar transação (não crítico):", txError);
                    }
                }
            }

            console.log("🔄 [MODERATE] Atualizando campanha no banco...");
            const result = await updateDocument('campaigns', id, updateData);
            console.log("✅ [MODERATE] Campanha atualizada:", result);

            const successMsg = status === 'approved'
                ? `Campanha aprovada! Veiculação por ${validityDays} dias até ${expiresAt.toLocaleDateString('pt-BR')}.`
                : `Campanha rejeitada. ${campData.credits_cost > 0 ? `💰 ${campData.credits_cost} créditos devolvidos ao cliente.` : ''}`;
            alert(successMsg);
            setRejectionModalCamp(null);
            setRejectionReason('');
        } catch (error) {
            console.error("❌ [MODERATE] Erro ao moderar:", error);
            alert(`Erro ao moderar campanha: ${error.message || 'Verifique o console'}`);
        }
    };

    const handleDelete = async (id) => {
        console.log("🗑️ [DELETE] Iniciando exclusão da campanha:", id);

        try {
            console.log("🗑️ [DELETE] Enviando delete para o banco...");

            // Primeiro, tentar deletar transações de crédito associadas (para evitar FK constraint)
            try {
                await supabase
                    .from('credit_transactions')
                    .delete()
                    .eq('campaign_id', id);
                console.log("🗑️ [DELETE] Transações de crédito removidas");
            } catch (txError) {
                console.warn("⚠️ [DELETE] Erro ao remover transações (não crítico):", txError);
            }

            // Agora deletar a campanha
            await deleteDocument('campaigns', id);

            // Atualizar lista local imediatamente
            setCampaigns(prev => prev.filter(c => c.id !== id));

            console.log("✅ [DELETE] Campanha excluída com sucesso!");
            alert("Campanha excluída com sucesso!");
        } catch (error) {
            console.error("❌ [DELETE] Erro ao excluir:", error);
            alert(`Erro ao excluir campanha: ${error.message || 'Verifique o console'}`);
        }
    };

    const handleEditCampaign = (camp) => {
        setEditingCamp(camp);
        setIsAdding(true);
        setIsAIGenerating(false);
        setNewName(camp.name);
        setHMediaId(camp.hMediaId || '');
        setVMediaId(camp.vMediaId || '');
        setScreensQuota(camp.screensQuota || 1);
        setTargetTerminals(camp.targetTerminals || []);
        setIsGlobal(camp.isGlobal || false);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleRefinementRequest = (camp) => {
        setRefiningCamp(camp);
        setRefinementText('');
    };

    const submitRefinement = async () => {
        if (!refinementText || !refiningCamp) return;
        try {
            await updateDocument('campaigns', refiningCamp.id, {
                is_ai_generating: true,
                last_refinement_reason: refinementText
            });
            await createDocument('generation_requests', {
                campaign_id: refiningCamp.id,
                campaign_name: refiningCamp.name,
                prompt: refinementText,
                status: 'pending',
                type: 'refinement',
                created_at: new Date().toISOString()
            });
            setRefiningCamp(null);
        } catch (error) { console.error(error); }
    };

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
                    {/* Botões só aparecem se o cliente pode criar mais campanhas */}
                    {canCreateCampaign(userData, campaigns, screensQuota).can ? (
                        <>
                            <button
                                onClick={() => { setIsAIGenerating(!isAIGenerating); setIsAdding(false); }}
                                className={`group relative flex items-center space-x-2 px-6 py-4 rounded-2xl transition-all duration-300 font-black text-sm Outfit shadow-xl shadow-indigo-500/10 ${isAIGenerating ? 'bg-indigo-50 text-indigo-600 border border-indigo-200' : 'bg-indigo-600 hover:bg-indigo-700 text-white border border-transparent'}`}
                            >
                                <Sparkles className={`w-5 h-5 transition-transform group-hover:scale-110 ${!isAIGenerating && 'animate-pulse text-indigo-300'}`} />
                                <span>{isAIGenerating ? 'Cancelar Criação IA' : 'Nova Campanha com IA'}</span>
                            </button>

                            <button
                                onClick={() => { setIsAdding(!isAdding); setIsAIGenerating(false); }}
                                className={`flex items-center space-x-2 px-6 py-4 rounded-2xl transition-all font-black text-sm Outfit shadow-xl shadow-slate-200 ${isAdding ? 'bg-slate-100 text-slate-600 border border-slate-200' : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200'}`}
                            >
                                <Plus className="w-5 h-5" />
                                <span>{isAdding ? 'Cancelar' : 'Fazer Vínculo Manual'}</span>
                            </button>
                        </>
                    ) : (
                        <div className="px-6 py-4 bg-amber-50 text-amber-700 rounded-2xl border border-amber-200 text-sm font-bold">
                            <span>Limite do plano atingido</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Forms section (AI or Manual) */}
            {(isAIGenerating || isAdding) && (
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
                                        Total: <span className="font-black text-indigo-600">{calculateCampaignCost(slotsCount)} créditos</span> = R$ {calculateCampaignCost(slotsCount)},00
                                    </p>
                                </div>

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
                                        {/* Seletor de Orientação */}
                                        <div className="space-y-3">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] Outfit pl-1">
                                                Formato da Mídia
                                            </label>
                                            <div className="grid grid-cols-2 gap-3">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setSelectedOrientation('landscape');
                                                        setHMediaId('');
                                                        setVMediaId('');
                                                        setTargetTerminals([]);
                                                    }}
                                                    className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${selectedOrientation === 'landscape'
                                                        ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                                                        : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
                                                        }`}
                                                >
                                                    <div className="w-16 h-10 bg-slate-200 rounded-lg flex items-center justify-center text-[8px] font-black">
                                                        16:9
                                                    </div>
                                                    <span className="text-xs font-black uppercase tracking-wider">Horizontal</span>
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setSelectedOrientation('portrait');
                                                        setHMediaId('');
                                                        setVMediaId('');
                                                        setTargetTerminals([]);
                                                    }}
                                                    className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${selectedOrientation === 'portrait'
                                                        ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                                                        : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
                                                        }`}
                                                >
                                                    <div className="w-10 h-16 bg-slate-200 rounded-lg flex items-center justify-center text-[8px] font-black">
                                                        9:16
                                                    </div>
                                                    <span className="text-xs font-black uppercase tracking-wider">Vertical</span>
                                                </button>
                                            </div>
                                        </div>

                                        {/* MediaPicker baseado na orientação */}
                                        {selectedOrientation && (
                                            <MediaPicker
                                                label={selectedOrientation === 'landscape' ? 'Mídia Horizontal 16:9' : 'Mídia Vertical 9:16'}
                                                orientation={selectedOrientation}
                                                selectedId={selectedOrientation === 'landscape' ? hMediaId : vMediaId}
                                                onSelect={selectedOrientation === 'landscape' ? setHMediaId : setVMediaId}
                                                mediaFiles={mediaFiles}
                                            />
                                        )}
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
                                            const val = e.target.value === 'unlimited' ? 'unlimited' : parseInt(e.target.value);
                                            setScreensQuota(val);
                                            setTargetTerminals([]);
                                        }}
                                        className="w-full bg-slate-100 border border-slate-200 rounded-2xl p-4 text-sm font-black text-slate-900 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/50 outline-none transition-all cursor-pointer"
                                    >
                                        <option value={1}>Plano Start (Até 1 Tela)</option>
                                        <option value={3}>Plano Business (Até 3 Telas)</option>
                                        <option value={5}>Plano Premium (Até 5 Telas)</option>
                                        <option value={10}>Plano Enterprise (Até 10 Telas)</option>
                                        <option value="unlimited">Rede Ilimitada (Unlimited)</option>
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

                                {!isGlobal && selectedOrientation && (
                                    <TerminalPicker
                                        quota={screensQuota}
                                        selectedTerminals={targetTerminals}
                                        onToggle={handleToggleTerminal}
                                        terminals={terminals.filter(t => t.orientation === selectedOrientation)}
                                    />
                                )}
                                {!isGlobal && !selectedOrientation && (
                                    <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200 text-center">
                                        <p className="text-sm text-slate-500">
                                            Selecione o formato da mídia para ver as telas compatíveis
                                        </p>
                                    </div>
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
            )}

            {/* Campaign Table Grid */}
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
                            {campaigns.map(c => (
                                <tr key={c.id} className="group hover:bg-slate-50/50 transition-all duration-300">
                                    <td className="px-8 py-6">
                                        <div className="flex flex-col">
                                            <div className="flex items-center space-x-2">
                                                <span className="text-base font-black text-slate-800 Outfit group-hover:text-indigo-600 transition-colors uppercase tracking-tight">{c.name}</span>
                                                {c.isGlobal && (
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black bg-emerald-100 text-emerald-600 border border-emerald-200">
                                                        <Globe className="w-3 h-3 mr-1" /> GLOBAL
                                                    </span>
                                                )}
                                                {c.isAIGenerating && (
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

                                    <td className="px-8 py-6">
                                        <div className="flex flex-col items-center justify-center space-y-3">
                                            <div className="flex -space-x-1.5 overflow-hidden">
                                                {c.h_media_id && (
                                                    <div className="w-7 h-7 bg-indigo-500 rounded-lg flex items-center justify-center ring-2 ring-white" title="Mídia Horizontal">
                                                        <span className="text-[10px] font-black text-white">H</span>
                                                    </div>
                                                )}
                                                {c.v_media_id && (
                                                    <div className="w-7 h-7 bg-blue-500 rounded-lg flex items-center justify-center ring-2 ring-white" title="Mídia Vertical">
                                                        <span className="text-[10px] font-black text-white">V</span>
                                                    </div>
                                                )}
                                                {!c.h_media_id && !c.v_media_id && <span className="text-xs font-bold text-slate-300 italic">No Content</span>}
                                            </div>
                                            <div className="flex items-center space-x-2 bg-slate-100/50 px-3 py-1 rounded-full border border-slate-200/50">
                                                <Monitor className="w-3 h-3 text-slate-400" />
                                                <span className="text-[10px] font-black text-slate-600 tracking-tighter">
                                                    {c.target_terminals?.length || 0} / {c.screens_quota === 'unlimited' ? '∞' : c.screens_quota} Telas
                                                </span>
                                            </div>
                                        </div>
                                    </td>

                                    <td className="px-8 py-6">
                                        <div className="flex justify-center gap-2">
                                            {userData?.role === 'admin' && (c.moderation_status !== 'approved' && c.moderation_status !== 'rejected') ? (
                                                <div className="flex items-center space-x-2">
                                                    <button
                                                        onClick={() => {
                                                            console.log("👁️ Preview Camp:", c);
                                                            setPreviewCamp(c);
                                                        }}
                                                        className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-all"
                                                        title="Visualizar Conteúdo"
                                                    >
                                                        <Eye className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => openApprovalModal(c)}
                                                        className="px-3 py-1.5 bg-emerald-500 text-white text-[10px] font-black rounded-lg hover:bg-emerald-600 transition-all uppercase shadow-sm shadow-emerald-500/20 active:scale-95"
                                                    >
                                                        Aprovar
                                                    </button>
                                                    <button
                                                        onClick={() => setRejectionModalCamp(c)}
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

                                    <td className="px-8 py-6 text-right">
                                        <div className="flex items-center justify-end space-x-2">
                                            {userData?.role === 'cliente' && c.moderation_status === 'rejected' && (
                                                <button
                                                    onClick={() => handleEditCampaign(c)}
                                                    className="p-2.5 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-xl hover:bg-indigo-100 transition-all active:scale-90"
                                                    title="Corrigir e Reenviar"
                                                >
                                                    <Edit2 className="w-5 h-5" />
                                                </button>
                                            )}
                                            {!c.isAIGenerating && c.hMediaId && c.vMediaId && (
                                                <button
                                                    onClick={() => handleRefinementRequest(c)}
                                                    className="p-2.5 bg-white text-slate-400 border border-slate-100 rounded-xl hover:text-indigo-600 hover:border-indigo-200 hover:shadow-md transition-all active:scale-90"
                                                    title="Solicitar Ajuste IA"
                                                >
                                                    <Sparkles className="w-5 h-5" />
                                                </button>
                                            )}
                                            <button
                                                onClick={() => handleDelete(c.id)}
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
                            ))}
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

            {/* Refinement Modal */}
            {refiningCamp && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="bg-indigo-700 p-8 text-white relative">
                            <div className="absolute top-0 right-0 p-8 opacity-10 rotate-12">
                                <Sparkles className="w-24 h-24" />
                            </div>
                            <div className="flex items-center space-x-3 mb-2">
                                <Wand2 className="w-6 h-6 text-indigo-300" />
                                <span className="text-[10px] font-black uppercase tracking-[0.2em] Outfit text-indigo-200">AI Design Refinement</span>
                            </div>
                            <h3 className="text-2xl font-black Outfit">Solicitar Ajuste</h3>
                            <p className="text-indigo-100/70 text-sm mt-1 font-medium italic">O que deseja mudar em "{refiningCamp.name}"?</p>
                        </div>

                        <div className="p-10 space-y-8">
                            <div className="space-y-3">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] Outfit pl-1">Feedback de Revisão</label>
                                <textarea
                                    value={refinementText}
                                    onChange={(e) => setRefinementText(e.target.value)}
                                    placeholder="Ex: Mude a cor da fonte para dourado e adicione um brilho no produto..."
                                    className="w-full bg-slate-50 border border-slate-200 rounded-3xl p-6 text-sm font-bold text-slate-800 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/50 outline-none transition-all resize-none h-40 shadow-inner"
                                    autoFocus
                                />
                            </div>

                            <div className="bg-amber-50 p-5 rounded-2xl border border-amber-100 flex items-start space-x-3">
                                <AlertTriangle className="w-5 h-5 text-amber-500 mt-1 flex-shrink-0" />
                                <p className="text-[11px] text-amber-700 font-bold leading-relaxed italic">
                                    Nota: Este pedido gerará novas mídias Vertical e Horizontal automaticamente baseadas na versão anterior e no seu feedback atual.
                                </p>
                            </div>

                            <div className="flex gap-4 pt-4">
                                <button
                                    onClick={() => setRefiningCamp(null)}
                                    className="flex-1 px-4 py-4 rounded-2xl text-sm font-black text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-all Outfit uppercase tracking-widest"
                                >
                                    Desistir
                                </button>
                                <button
                                    onClick={submitRefinement}
                                    className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-4 rounded-2xl text-sm font-black shadow-xl shadow-indigo-600/20 transition-all transform hover:translate-y-[-2px] active:scale-95 Outfit uppercase tracking-[0.1em]"
                                >
                                    Enviar para IA
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {/* Preview Modal */}
            {previewCamp && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[60] flex items-center justify-center p-4">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-4xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="bg-slate-900 p-6 text-white flex justify-between items-center">
                            <div className="flex items-center space-x-3">
                                <Eye className="w-5 h-5 text-indigo-400" />
                                <h3 className="text-xl font-black Outfit uppercase tracking-tight">Revisar Campanha: {previewCamp.name}</h3>
                            </div>
                            <button onClick={() => setPreviewCamp(null)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8 bg-slate-50">
                            {/* Horizontal Preview */}
                            <div className="space-y-3">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Formato Horizontal (16:9)</label>
                                <div className="aspect-video bg-black rounded-2xl overflow-hidden border-4 border-white shadow-xl flex items-center justify-center">
                                    {mediaFiles.find(m => m.id === previewCamp.h_media_id) ? (
                                        mediaFiles.find(m => m.id === previewCamp.h_media_id).type === 'video' ? (
                                            <video src={mediaFiles.find(m => m.id === previewCamp.h_media_id).url} className="w-full h-full object-contain" controls />
                                        ) : (
                                            <img src={mediaFiles.find(m => m.id === previewCamp.h_media_id).url} className="w-full h-full object-contain" alt="H" />
                                        )
                                    ) : (
                                        <div className="text-slate-600 italic text-xs">Mídia horizontal não definida</div>
                                    )}
                                </div>
                            </div>

                            {/* Vertical Preview */}
                            <div className="space-y-3">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Formato Vertical (9:16)</label>
                                <div className="aspect-[9/16] bg-black rounded-2xl overflow-hidden border-4 border-white shadow-xl flex items-center justify-center mx-auto max-h-[400px]">
                                    {mediaFiles.find(m => m.id === previewCamp.v_media_id) ? (
                                        mediaFiles.find(m => m.id === previewCamp.v_media_id).type === 'video' ? (
                                            <video src={mediaFiles.find(m => m.id === previewCamp.v_media_id).url} className="w-full h-full object-contain" controls />
                                        ) : (
                                            <img src={mediaFiles.find(m => m.id === previewCamp.v_media_id).url} className="w-full h-full object-contain" alt="V" />
                                        )
                                    ) : (
                                        <div className="text-slate-600 italic text-xs">Mídia vertical não definida</div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="p-6 bg-white border-t border-slate-100 flex justify-center space-x-4">
                            <button
                                onClick={() => { setRejectionModalCamp(previewCamp); setPreviewCamp(null); }}
                                className="flex-1 max-w-[200px] px-6 py-3 bg-red-50 text-red-600 rounded-xl font-black uppercase text-xs hover:bg-red-100 transition-all"
                            >
                                Rejeitar Conteúdo
                            </button>
                            <button
                                onClick={() => {
                                    console.log("🟢 [APROVAR] Abrindo modal de aprovação");
                                    setPreviewCamp(null);
                                    openApprovalModal(previewCamp);
                                }}
                                className="flex-1 max-w-[200px] px-6 py-3 bg-emerald-600 text-white rounded-xl font-black uppercase text-xs hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/20"
                            >
                                Aprovar e Publicar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Aprovação com Categoria */}
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
        </div>
    );
};

export default Campaigns;
