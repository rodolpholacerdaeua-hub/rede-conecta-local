import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, addDoc, onSnapshot, query, orderBy, doc, updateDoc, deleteDoc, where, increment } from 'firebase/firestore';
import {
    Plus, Trash2, CheckCircle, XCircle, FileVideo, Image as ImageIcon,
    ChevronRight, Save, Sparkles, Wand2, Type, Image as ImageLucide,
    Send, AlertTriangle, Coins, Monitor, Play, Layers, Calendar, ArrowUpRight,
    Clock, Globe
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { canCreateCampaign, formatExpirationDate } from '../utils/planHelpers';

const AI_CREATION_COST = 50;

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
            <div className="grid grid-cols-2 gap-3 max-h-64 overflow-y-auto p-4 bg-slate-50/50 rounded-[2rem] border border-slate-200">
                {terminals.map(t => {
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
                                    {t.group || 'Geral'}
                                </span>
                                <span className="w-1 h-1 bg-slate-200 rounded-full" />
                                <span className={`text-[9px] font-black uppercase tracking-widest ${isSelected ? 'text-indigo-400' : 'text-slate-400'}`}>
                                    {t.orientation}
                                </span>
                            </div>
                        </button>
                    );
                })}
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

    const [newName, setNewName] = useState('');
    const [hMediaId, setHMediaId] = useState('');
    const [vMediaId, setVMediaId] = useState('');
    const [screensQuota, setScreensQuota] = useState(1);
    const [targetTerminals, setTargetTerminals] = useState([]);

    const [aiText, setAiText] = useState('');
    const [aiPhotos, setAiPhotos] = useState([]);
    const [isSubmittingAI, setIsSubmittingAI] = useState(false);
    const [isGlobal, setIsGlobal] = useState(false);

    useEffect(() => {
        if (!currentUser) return;

        const qC = userData?.role === 'admin'
            ? query(collection(db, "campaigns"), orderBy("createdAt", "desc"))
            : query(collection(db, "campaigns"), where("ownerId", "==", currentUser.uid), orderBy("createdAt", "desc"));

        const unsubscribeC = onSnapshot(qC, (snapshot) => {
            setCampaigns(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });

        const qM = userData?.role === 'admin'
            ? query(collection(db, "media"), orderBy("createdAt", "desc"))
            : query(collection(db, "media"), where("ownerId", "==", currentUser.uid), orderBy("createdAt", "desc"));

        const unsubscribeM = onSnapshot(qM, (snapshot) => {
            setMediaFiles(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });

        const qT = query(collection(db, "terminals"), orderBy("name", "asc"));
        const unsubscribeT = onSnapshot(qT, (snapshot) => {
            setTerminals(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });

        return () => {
            unsubscribeC();
            unsubscribeM();
            unsubscribeT();
        };
    }, [currentUser?.uid, userData?.role]);

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
        if (!newName || (!hMediaId && !vMediaId)) return alert("Preencha o nome e ao menos uma mídia!");
        if (!isGlobal && targetTerminals.length === 0) return alert("Selecione ao menos um totem ou marque como Global!");

        const validation = canCreateCampaign(userData, campaigns, screensQuota);
        if (!validation.can) return alert(validation.reason);

        try {
            await addDoc(collection(db, "campaigns"), {
                name: newName,
                hMediaId,
                vMediaId,
                screensQuota: isGlobal ? 'unlimited' : screensQuota,
                targetTerminals: isGlobal ? [] : targetTerminals,
                isGlobal,
                ownerId: currentUser.uid,
                status_financeiro: false,
                createdAt: new Date(),
                is_active: false
            });
            setNewName(''); setHMediaId(''); setVMediaId(''); setTargetTerminals([]); setIsGlobal(false); setIsAdding(false);
            alert("Campanha criada! Aguardando ativação.");
        } catch (error) { console.error(error); }
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
            const userDocRef = doc(db, "users", currentUser.uid);
            await updateDoc(userDocRef, { tokens: increment(-AI_CREATION_COST) });

            const campaignRef = await addDoc(collection(db, "campaigns"), {
                name: `${newName} (Gerando IA...)`,
                status_financeiro: true, is_active: true, createdAt: new Date(),
                isAIGenerating: true, ownerId: currentUser.uid,
                screensQuota, targetTerminals
            });

            await addDoc(collection(db, "generation_requests"), {
                campaignId: campaignRef.id, campaignName: newName, prompt: aiText,
                status: 'pending', createdAt: new Date(), type: 'maas_creative', ownerId: currentUser.uid
            });

            alert(`Débito de ${AI_CREATION_COST} tokens realizado. Aguarde a IA gerar os conteúdos!`);
            setNewName(''); setAiText(''); setPreviewPhotos([]); setTargetTerminals([]); setIsAIGenerating(false);
        } catch (error) { alert("Erro na geração IA."); } finally { setIsSubmittingAI(false); }
    };

    const toggleActivation = async (id, currentState) => {
        try {
            await updateDoc(doc(db, "campaigns", id), {
                status_financeiro: !currentState,
                is_active: !currentState
            });
        } catch (error) { console.error(error); }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Deseja realmente excluir esta campanha?")) return;
        try { await deleteDoc(doc(db, "campaigns", id)); } catch (error) { console.error(error); }
    };

    const handleRefinementRequest = (camp) => {
        setRefiningCamp(camp);
        setRefinementText('');
    };

    const submitRefinement = async () => {
        if (!refinementText || !refiningCamp) return;
        try {
            await updateDoc(doc(db, "campaigns", refiningCamp.id), {
                isAIGenerating: true,
                lastRefinementReason: refinementText
            });
            await addDoc(collection(db, "generation_requests"), {
                campaignId: refiningCamp.id, campaignName: refiningCamp.name,
                prompt: refinementText, status: 'pending', type: 'refinement', createdAt: new Date()
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
                                {isAIGenerating ? 'Configurar Inteligência de Criação' : 'Vincular Mídias Existentes'}
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
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <MediaPicker
                                            label="Mídia Horizontal 16:9"
                                            orientation="horizontal"
                                            selectedId={hMediaId}
                                            onSelect={setHMediaId}
                                            mediaFiles={mediaFiles}
                                        />
                                        <MediaPicker
                                            label="Mídia Vertical 9:16"
                                            orientation="vertical"
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
                                        {isAIGenerating ? <Sparkles className="w-6 h-6" /> : <Save className="w-6 h-6" />}
                                        <span>{isAIGenerating ? 'Pagar e Gerar Campanha' : 'Gravar e Vincular'}</span>
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
                                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] Outfit text-center">Status Operacional</th>
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
                                            <div className="flex items-center space-x-2 mt-2">
                                                <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">{formatExpirationDate(c.createdAt)}</span>
                                                <span className="w-1 h-1 bg-slate-200 rounded-full" />
                                                <span className="text-[10px] font-black text-slate-400 truncate max-w-[120px]">ID: {c.id}</span>
                                            </div>
                                        </div>
                                    </td>

                                    <td className="px-8 py-6">
                                        <div className="flex flex-col items-center justify-center space-y-3">
                                            <div className="flex -space-x-1.5 overflow-hidden">
                                                {c.hMediaId && (
                                                    <div className="w-7 h-7 bg-indigo-500 rounded-lg flex items-center justify-center ring-2 ring-white" title="Mídia Horizontal">
                                                        <span className="text-[10px] font-black text-white">H</span>
                                                    </div>
                                                )}
                                                {c.vMediaId && (
                                                    <div className="w-7 h-7 bg-blue-500 rounded-lg flex items-center justify-center ring-2 ring-white" title="Mídia Vertical">
                                                        <span className="text-[10px] font-black text-white">V</span>
                                                    </div>
                                                )}
                                                {!c.hMediaId && !c.vMediaId && <span className="text-xs font-bold text-slate-300 italic">No Content</span>}
                                            </div>
                                            <div className="flex items-center space-x-2 bg-slate-100/50 px-3 py-1 rounded-full border border-slate-200/50">
                                                <Monitor className="w-3 h-3 text-slate-400" />
                                                <span className="text-[10px] font-black text-slate-600 tracking-tighter">
                                                    {c.targetTerminals?.length || 0} / {c.screensQuota === 'unlimited' ? '∞' : c.screensQuota} Telas
                                                </span>
                                            </div>
                                        </div>
                                    </td>

                                    <td className="px-8 py-6">
                                        <div className="flex justify-center">
                                            <button
                                                onClick={() => toggleActivation(c.id, c.status_financeiro)}
                                                className={`
                                                    group relative inline-flex items-center space-x-2 px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all duration-300 border-2
                                                    ${c.status_financeiro
                                                        ? 'bg-emerald-50 text-emerald-600 border-emerald-100 hover:bg-emerald-600 hover:text-white hover:border-emerald-600'
                                                        : 'bg-amber-50 text-amber-600 border-amber-100 hover:bg-amber-600 hover:text-white hover:border-amber-600'}
                                                `}
                                            >
                                                {c.status_financeiro ? <CheckCircle className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                                                <span>{c.status_financeiro ? 'Publicada' : 'Aguardando'}</span>
                                            </button>
                                        </div>
                                    </td>

                                    <td className="px-8 py-6 text-right">
                                        <div className="flex items-center justify-end space-x-2">
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
        </div>
    );
};

export default Campaigns;
