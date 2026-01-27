import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, addDoc, onSnapshot, query, orderBy, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { Plus, Trash2, CheckCircle, XCircle, FileVideo, Image as ImageIcon, ChevronRight, Save, Sparkles, Wand2, Type, Image as ImageLucide, Send } from 'lucide-react';

const MediaPicker = ({ label, orientation, selectedId, onSelect, mediaFiles }) => {
    const filteredMedia = mediaFiles.filter(m => m.orientation === orientation);

    return (
        <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">{label}</label>
            <select
                value={selectedId || ''}
                onChange={(e) => onSelect(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            >
                <option value="">Selecione uma mídia {orientation}...</option>
                {filteredMedia.map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                ))}
            </select>
            {selectedId && (
                <div className="mt-2 p-2 bg-blue-50 rounded-lg border border-blue-100 flex items-center space-x-2">
                    <div className="w-8 h-8 bg-white rounded flex items-center justify-center">
                        {mediaFiles.find(m => m.id === selectedId)?.type === 'video' ? <FileVideo className="w-4 h-4 text-blue-500" /> : <ImageIcon className="w-4 h-4 text-blue-500" />}
                    </div>
                    <span className="text-xs text-blue-700 font-medium truncate">
                        {mediaFiles.find(m => m.id === selectedId)?.name}
                    </span>
                </div>
            )}
        </div>
    );
};

const Campaigns = () => {
    const [campaigns, setCampaigns] = useState([]);
    const [mediaFiles, setMediaFiles] = useState([]);
    const [isAdding, setIsAdding] = useState(false);
    const [isAIGenerating, setIsAIGenerating] = useState(false);
    const [previewPhotos, setPreviewPhotos] = useState([]);
    const [uploadingFiles, setUploadingFiles] = useState([]);
    const [refiningCamp, setRefiningCamp] = useState(null);
    const [refinementText, setRefinementText] = useState('');

    // New Campaign Form State
    const [newName, setNewName] = useState('');
    const [hMediaId, setHMediaId] = useState('');
    const [vMediaId, setVMediaId] = useState('');

    // AI Onboarding State
    const [aiText, setAiText] = useState('');
    const [aiPhotos, setAiPhotos] = useState([]);
    const [isSubmittingAI, setIsSubmittingAI] = useState(false);

    useEffect(() => {
        const qC = query(collection(db, "campaigns"), orderBy("createdAt", "desc"));
        const unsubscribeC = onSnapshot(qC, (snapshot) => {
            setCampaigns(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });

        const qM = query(collection(db, "media"), orderBy("createdAt", "desc"));
        const unsubscribeM = onSnapshot(qM, (snapshot) => {
            setMediaFiles(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });

        return () => {
            unsubscribeC();
            unsubscribeM();
        };
    }, []);

    const handleRefinementRequest = (camp) => {
        setRefiningCamp(camp);
        setRefinementText('');
    };

    const submitRefinement = async () => {
        if (!refinementText || !refiningCamp) return;

        try {
            // Volta a campanha para o estado de processamento
            await updateDoc(doc(db, "campaigns", refiningCamp.id), {
                isAIGenerating: true,
                lastRefinementReason: refinementText
            });

            // Cria um novo pedido de geração marcado como REFINAMENTO
            await addDoc(collection(db, "generation_requests"), {
                campaignId: refiningCamp.id,
                campaignName: refiningCamp.name,
                prompt: refinementText,
                status: 'pending',
                type: 'refinement',
                createdAt: new Date()
            });

            setRefiningCamp(null);
            setRefinementText('');
        } catch (error) {
            console.error(error);
        }
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        if (!newName || (!hMediaId && !vMediaId)) {
            alert("Preencha o nome e ao menos uma mídia!");
            return;
        }

        try {
            await addDoc(collection(db, "campaigns"), {
                name: newName,
                hMediaId,
                vMediaId,
                status_financeiro: true, // Default active
                createdAt: new Date(),
                is_active: true
            });
            setNewName('');
            setHMediaId('');
            setVMediaId('');
            setIsAdding(false);
        } catch (error) {
            console.error(error);
            alert("Erro ao criar campanha");
        }
    };

    const toggleFinanceStatus = async (id, current) => {
        try {
            await updateDoc(doc(db, "campaigns", id), {
                status_financeiro: !current
            });
        } catch (error) {
            console.error(error);
        }
    };

    const handlePhotoSelect = (e) => {
        const files = Array.from(e.target.files);
        setUploadingFiles(prev => [...prev, ...files]);

        const newPreviews = files.map(file => URL.createObjectURL(file));
        setPreviewPhotos(prev => [...prev, ...newPreviews]);
    };

    const handleAISubmit = async (e) => {
        e.preventDefault();
        if (!aiText || !newName) {
            alert("Nome da campanha e texto para a IA são obrigatórios!");
            return;
        }

        setIsSubmittingAI(true);
        try {
            // Simular upload para o storage (opcional por agora, vamos mandar os nomes)
            const photoData = uploadingFiles.map(f => ({ name: f.name, size: f.size }));

            // 1. Criar campanha placeholder
            const campaignRef = await addDoc(collection(db, "campaigns"), {
                name: `${newName} (Gerando pela IA...)`,
                status_financeiro: true,
                is_active: true,
                createdAt: new Date(),
                isAIGenerating: true
            });

            // 2. Criar pedido de geração vinculado à campanha
            await addDoc(collection(db, "generation_requests"), {
                campaignId: campaignRef.id,
                campaignName: newName,
                prompt: aiText,
                referencePhotos: photoData,
                status: 'pending',
                createdAt: new Date(),
                type: 'maas_creative'
            });

            alert("Pedido de criação enviado para o Agente de IA! Os vídeos aparecerão automaticamente quando prontos.");
            setNewName('');
            setAiText('');
            setPreviewPhotos([]);
            setUploadingFiles([]);
            setIsAIGenerating(false);
        } catch (error) {
            console.error(error);
        } finally {
            setIsSubmittingAI(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800">Gestão de Campanhas</h2>
                    <p className="text-slate-500">Agrupe mídias V/H ou crie novos anúncios com IA.</p>
                </div>
                <div className="flex space-x-3">
                    <button
                        onClick={() => { setIsAIGenerating(!isAIGenerating); setIsAdding(false); }}
                        className={`flex items-center space-x-2 px-4 py-2.5 rounded-lg transition-all font-medium shadow-md ${isAIGenerating ? 'bg-indigo-100 text-indigo-700' : 'bg-indigo-600 hover:bg-indigo-700 text-white'}`}
                    >
                        <Sparkles className="w-5 h-5" />
                        <span>{isAIGenerating ? 'Cancelar IA' : 'Criar com IA (MaaS)'}</span>
                    </button>
                    <button
                        onClick={() => { setIsAdding(!isAdding); setIsAIGenerating(false); }}
                        className={`flex items-center space-x-2 px-4 py-2.5 rounded-lg transition-all font-medium shadow-md ${isAdding ? 'bg-blue-100 text-blue-700' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}
                    >
                        <Plus className="w-5 h-5" />
                        <span>{isAdding ? 'Cancelar' : 'Vincular Arquivos'}</span>
                    </button>
                </div>
            </div>

            {isAIGenerating && (
                <div className="bg-gradient-to-br from-indigo-50 to-white p-6 rounded-xl border border-indigo-100 shadow-sm animate-in fade-in zoom-in duration-300">
                    <div className="flex items-center space-x-3 mb-6">
                        <div className="p-2 bg-indigo-600 rounded-lg text-white">
                            <Wand2 className="w-6 h-6" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-slate-800">Onboarding Criativo IA</h3>
                            <p className="text-sm text-slate-500">Descreva o anúncio e a IA cuidará dos formatos V e H.</p>
                        </div>
                    </div>

                    <form onSubmit={handleAISubmit} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Nome da Campanha</label>
                                    <input
                                        type="text"
                                        value={newName}
                                        onChange={(e) => setNewName(e.target.value)}
                                        placeholder="Ex: Oferta de Carnaval - Burger King"
                                        className="w-full bg-white border border-slate-200 rounded-lg p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">O que deseja anunciar? (Texto/Prompt)</label>
                                    <textarea
                                        value={aiText}
                                        onChange={(e) => setAiText(e.target.value)}
                                        rows="4"
                                        placeholder="Digite aqui os textos do vídeo, o CTA e a ideia central..."
                                        className="w-full bg-white border border-slate-200 rounded-lg p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                                    />
                                </div>
                            </div>
                            <div className="space-y-4">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Anexar Referências Visuais</label>
                                <div
                                    onClick={() => document.getElementById('ai-photo-input').click()}
                                    className="border-2 border-dashed border-indigo-200 rounded-xl p-8 text-center bg-white/50 hover:bg-white transition-colors cursor-pointer group relative"
                                >
                                    <input
                                        id="ai-photo-input"
                                        type="file"
                                        multiple
                                        accept="image/*"
                                        className="hidden"
                                        onChange={handlePhotoSelect}
                                    />
                                    <ImageLucide className="w-10 h-10 text-indigo-300 mx-auto mb-2 group-hover:text-indigo-500 transition-colors" />
                                    <p className="text-xs text-slate-400">Clique para anexar fotos de produtos ou logos</p>

                                    {previewPhotos.length > 0 && (
                                        <div className="mt-4 flex flex-wrap gap-2 justify-center">
                                            {previewPhotos.map((src, i) => (
                                                <img key={i} src={src} className="w-12 h-12 object-cover rounded border border-indigo-100 shadow-sm" alt="" />
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <div className="bg-indigo-50 p-4 rounded-lg flex items-start space-x-3 border border-indigo-100">
                                    <Type className="w-5 h-5 text-indigo-400 mt-0.5" />
                                    <p className="text-[11px] text-indigo-700 leading-relaxed font-medium">
                                        Nossa IA gera automaticamente as versões **Vertical (9:16)** e **Horizontal (16:9)** para garantir cobertura total da sua rede.
                                    </p>
                                </div>
                            </div>
                        </div>
                        <div className="flex justify-end border-t border-indigo-100 pt-6">
                            <button
                                type="submit"
                                disabled={isSubmittingAI}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-lg font-bold shadow-lg flex items-center space-x-2 transition-all transform hover:scale-105 active:scale-95 disabled:opacity-50"
                            >
                                {isSubmittingAI ? <Send className="w-5 h-5 animate-bounce" /> : <Sparkles className="w-5 h-5" />}
                                <span>{isSubmittingAI ? 'Enviando para o Agente...' : 'Gerar Campanha MaaS'}</span>
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {isAdding && (
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm animate-in fade-in slide-in-from-top-4 duration-300">
                    <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Nome do Anúncio / Cliente</label>
                            <input
                                type="text"
                                value={newName}
                                onChange={(e) => setNewName(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                placeholder="Ex: Promoção de Verão - Loja X"
                            />
                        </div>
                        <MediaPicker
                            label="Mídia Horizontal (Master)"
                            orientation="horizontal"
                            selectedId={hMediaId}
                            onSelect={setHMediaId}
                            mediaFiles={mediaFiles}
                        />
                        <MediaPicker
                            label="Mídia Vertical (Mobile/Totem)"
                            orientation="vertical"
                            selectedId={vMediaId}
                            onSelect={setVMediaId}
                            mediaFiles={mediaFiles}
                        />
                        <div className="md:col-span-3 flex justify-end pt-2">
                            <button type="submit" className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-bold shadow-sm flex items-center space-x-2">
                                <Save className="w-5 h-5" />
                                <span>Salvar Campanha</span>
                            </button>
                        </div>
                    </form>
                </div>
            )}

            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-50 border-b border-slate-200">
                            <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Campanha</th>
                            <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Status Financeiro</th>
                            <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Mídias Vinculadas</th>
                            <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {campaigns.map(c => (
                            <tr key={c.id} className="hover:bg-slate-50/50 transition-colors">
                                <td className="px-6 py-4">
                                    <div className="font-bold text-slate-800 flex items-center">
                                        {c.name}
                                        {c.isAIGenerating ? (
                                            <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-700 animate-pulse">
                                                <Sparkles className="w-3 h-3 mr-1" /> IA PROCESSANDO...
                                            </span>
                                        ) : (
                                            c.ai_creation_fee && (
                                                <button
                                                    onClick={() => handleRefinementRequest(c)}
                                                    className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-[9px] font-black bg-slate-100 text-slate-500 hover:bg-indigo-100 hover:text-indigo-600 transition-all uppercase border border-slate-200"
                                                >
                                                    <Sparkles className="w-2.5 h-2.5 mr-1" /> Pedir Ajuste
                                                </button>
                                            )
                                        )}
                                    </div>
                                    <div className="text-[10px] text-slate-400 font-mono mt-0.5">{c.id}</div>
                                </td>
                                <td className="px-6 py-4">
                                    <button
                                        onClick={() => toggleFinanceStatus(c.id, c.status_financeiro)}
                                        className={`flex items-center space-x-2 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${c.status_financeiro
                                            ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                            : 'bg-red-100 text-red-700 hover:bg-red-200'
                                            }`}
                                    >
                                        {c.status_financeiro ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                                        <span>{c.status_financeiro ? 'PAGO / ATIVO' : 'PENDENTE / SUSPENSO'}</span>
                                    </button>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex space-x-2">
                                        {c.hMediaId && <span className="px-2 py-0.5 bg-blue-50 text-blue-600 text-[10px] font-bold rounded uppercase">Horizontal</span>}
                                        {c.vMediaId && <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 text-[10px] font-bold rounded uppercase">Vertical</span>}
                                        {!c.hMediaId && !c.vMediaId && <span className="text-slate-300 italic text-xs">Nenhuma</span>}
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <button
                                        onClick={() => handleDelete(c.id)}
                                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                    >
                                        <Trash2 className="w-5 h-5" />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {campaigns.length === 0 && (
                    <div className="p-12 text-center text-slate-400">
                        Nenhuma campanha cadastrada. Clique em "Nova Campanha" para começar.
                    </div>
                )}
            </div>

            {/* Modal de Refinamento */}
            {refiningCamp && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="bg-indigo-600 p-6 text-white">
                            <div className="flex items-center space-x-2">
                                <Sparkles className="w-6 h-6" />
                                <h3 className="text-lg font-bold">Refinar com IA</h3>
                            </div>
                            <p className="text-indigo-100 text-xs mt-1">O que você deseja mudar em "{refiningCamp.name}"?</p>
                        </div>
                        <div className="p-6 space-y-4">
                            <textarea
                                value={refinementText}
                                onChange={(e) => setRefinementText(e.target.value)}
                                placeholder="Ex: Mude a cor do fundo para azul marinho e aumente o tamanho da oferta de preço..."
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none h-32"
                                autoFocus
                            />
                            <div className="bg-amber-50 p-3 rounded-lg border border-amber-100 flex items-start space-x-2">
                                <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5" />
                                <p className="text-[10px] text-amber-700 font-medium leading-tight">
                                    Nota: O refinamento processará novas versões Vertical e Horizontal baseadas no feedback atual.
                                </p>
                            </div>
                            <div className="flex space-x-3 pt-2">
                                <button
                                    onClick={() => setRefiningCamp(null)}
                                    className="flex-1 px-4 py-2.5 rounded-lg text-sm font-bold text-slate-500 hover:bg-slate-100 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={submitRefinement}
                                    className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-lg text-sm font-bold shadow-md transition-all active:scale-95"
                                >
                                    Gerar Novo Ajuste
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
