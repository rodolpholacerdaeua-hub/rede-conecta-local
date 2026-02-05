import React, { useState, useEffect } from 'react';
import {
    Play, Plus, Clock, Trash2, Save, Check, FileVideo, Monitor,
    Image as ImageIcon, Globe, Sparkles, Zap, Building2, Megaphone,
    Newspaper, GripVertical, X
} from 'lucide-react';
import { supabase, createPlaylist, updatePlaylist, deletePlaylist, listPlaylists, listMedia } from '../supabase';
import { useAuth } from '../contexts/AuthContext';

// Definição da estrutura do ciclo de slots (13 slots: 1 global + 1 parceiro + 1 dinâmico + 10 locais)
// Durações: Global=10s, Parceiro=16s, Local=16s, Dinâmico=15s
const SLOT_CYCLE = [
    { type: 'global', label: 'GLOBAL', color: 'from-indigo-500 to-purple-600', icon: Globe, description: 'Institucional da Rede', duration: 10 },
    { type: 'partner', label: 'PARCEIRO', color: 'from-amber-400 to-orange-500', icon: Building2, description: 'Estabelecimento Anfitrião', duration: 16 },
    { type: 'local', label: 'LOCAL', color: 'from-blue-400 to-blue-600', icon: Megaphone, description: 'Anunciante 1', duration: 16 },
    { type: 'local', label: 'LOCAL', color: 'from-blue-400 to-blue-600', icon: Megaphone, description: 'Anunciante 2', duration: 16 },
    { type: 'local', label: 'LOCAL', color: 'from-blue-400 to-blue-600', icon: Megaphone, description: 'Anunciante 3', duration: 16 },
    { type: 'local', label: 'LOCAL', color: 'from-blue-400 to-blue-600', icon: Megaphone, description: 'Anunciante 4', duration: 16 },
    { type: 'local', label: 'LOCAL', color: 'from-blue-400 to-blue-600', icon: Megaphone, description: 'Anunciante 5', duration: 16 },
    { type: 'dynamic', label: 'DINÂMICO', color: 'from-teal-400 to-emerald-500', icon: Newspaper, description: 'Notícias / Tempo', duration: 10 },
    { type: 'local', label: 'LOCAL', color: 'from-blue-400 to-blue-600', icon: Megaphone, description: 'Anunciante 6', duration: 16 },
    { type: 'local', label: 'LOCAL', color: 'from-blue-400 to-blue-600', icon: Megaphone, description: 'Anunciante 7', duration: 16 },
    { type: 'local', label: 'LOCAL', color: 'from-blue-400 to-blue-600', icon: Megaphone, description: 'Anunciante 8', duration: 16 },
    { type: 'local', label: 'LOCAL', color: 'from-blue-400 to-blue-600', icon: Megaphone, description: 'Anunciante 9', duration: 16 },
    { type: 'local', label: 'LOCAL', color: 'from-blue-400 to-blue-600', icon: Megaphone, description: 'Anunciante 10', duration: 16 },
];

// Componente de Slot Visual
const SlotCard = ({ slotIndex, slotDef, content, onAssign, onClear, isSelected, onClick }) => {
    const Icon = slotDef.icon;
    const isEmpty = !content;

    return (
        <div
            onClick={onClick}
            className={`relative w-28 h-36 rounded-xl cursor-pointer transition-all duration-200 flex flex-col overflow-hidden
        ${isEmpty
                    ? 'border-2 border-dashed border-slate-300 bg-slate-50 hover:border-slate-400 hover:bg-slate-100'
                    : `bg-gradient-to-br ${slotDef.color} shadow-lg hover:shadow-xl hover:scale-[1.02]`
                }
        ${isSelected ? 'ring-4 ring-blue-400 ring-offset-2' : ''}
      `}
        >
            {/* Número do Slot */}
            <div className={`absolute top-1 left-2 text-[10px] font-black ${isEmpty ? 'text-slate-400' : 'text-white/70'}`}>
                {slotIndex + 1}
            </div>

            {/* Conteúdo Vazio */}
            {isEmpty ? (
                <div className="flex-1 flex flex-col items-center justify-center p-2">
                    <Icon className="w-8 h-8 text-slate-300 mb-2" />
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{slotDef.label}</span>
                    <Plus className="w-4 h-4 text-slate-300 mt-2" />
                </div>
            ) : (
                <>
                    {/* Conteúdo Preenchido */}
                    <div className="flex-1 flex flex-col items-center justify-center p-2 text-white">
                        <Icon className="w-6 h-6 mb-1 opacity-80" />
                        <span className="text-[8px] font-black uppercase tracking-wider opacity-70">{slotDef.label}</span>
                        <div className="mt-2 text-center">
                            {content.thumbnail ? (
                                <img src={content.thumbnail} alt="" className="w-12 h-12 rounded object-cover mx-auto border-2 border-white/30" />
                            ) : (
                                <div className="w-12 h-12 rounded bg-white/20 flex items-center justify-center mx-auto">
                                    <FileVideo className="w-5 h-5" />
                                </div>
                            )}
                            <p className="text-[8px] mt-1 truncate max-w-[80px] font-medium">{content.name}</p>
                        </div>
                    </div>

                    {/* Botão Remover */}
                    <button
                        onClick={(e) => { e.stopPropagation(); onClear(); }}
                        className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 hover:opacity-100 transition-opacity"
                    >
                        <X className="w-3 h-3" />
                    </button>
                </>
            )}

            {/* Duração */}
            {content && (
                <div className="absolute bottom-1 right-1 bg-black/30 px-1.5 py-0.5 rounded text-[8px] text-white font-bold">
                    {content.duration || 10}s
                </div>
            )}
        </div>
    );
};

// Seletor lateral de mídia (Migrado para Supabase)
const MediaSelector = ({ slotType, onSelect, onClose }) => {
    const { currentUser, userData } = useAuth();
    const [mediaFiles, setMediaFiles] = useState([]);
    const [campaigns, setCampaigns] = useState([]);

    useEffect(() => {
        if (!currentUser) return;

        let ignore = false;

        // Carregar mídias do Supabase
        const fetchMedia = async () => {
            try {
                const { data, error } = await listMedia(currentUser.id);
                if (!ignore && !error) {
                    setMediaFiles(data || []);
                }
            } catch (err) {
                console.error('[MediaSelector] Error loading media:', err);
            }
        };

        // Carregar campanhas aprovadas (placeholder - implementar quando necessário)
        const fetchCampaigns = async () => {
            try {
                // TODO: Implementar listCampaigns com filtro de status
                setCampaigns([]);
            } catch (err) {
                console.error('[MediaSelector] Error loading campaigns:', err);
            }
        };

        fetchMedia();
        fetchCampaigns();

        return () => { ignore = true; };
    }, [currentUser?.id, userData?.role]);

    // Filtrar itens baseado no tipo do slot
    const getFilteredItems = () => {
        switch (slotType) {
            case 'global':
                return mediaFiles.filter(m => m.category === 'institutional' || !m.category);
            case 'partner':
                return mediaFiles.filter(m => m.category === 'partner');
            case 'local':
                return campaigns;
            case 'dynamic':
                return [
                    { id: 'news_widget', name: 'Notícias do Dia', type: 'widget', icon: 'news' },
                    { id: 'weather_widget', name: 'Previsão do Tempo', type: 'widget', icon: 'weather' },
                    { id: 'trivia_widget', name: 'Curiosidades', type: 'widget', icon: 'trivia' }
                ];
            default:
                return mediaFiles;
        }
    };

    const items = getFilteredItems();

    const getSlotInfo = () => {
        switch (slotType) {
            case 'global': return { title: 'Institucional', subtitle: 'Mídias da rede', color: 'indigo' };
            case 'partner': return { title: 'Parceiro', subtitle: 'Mídia do estabelecimento', color: 'amber' };
            case 'local': return { title: 'Anunciante', subtitle: 'Campanhas aprovadas', color: 'blue' };
            case 'dynamic': return { title: 'Dinâmico', subtitle: 'Widgets interativos', color: 'teal' };
            default: return { title: 'Selecionar', subtitle: '', color: 'slate' };
        }
    };

    const info = getSlotInfo();

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
            <div
                className="bg-white rounded-2xl w-[400px] max-h-[70vh] overflow-hidden shadow-2xl"
                onClick={(e) => e.stopPropagation()}
            >
                <div className={`bg-${info.color}-500 px-6 py-4 text-white`}>
                    <div className="flex justify-between items-center">
                        <div>
                            <h3 className="font-bold text-lg">{info.title}</h3>
                            <p className="text-sm opacity-80">{info.subtitle}</p>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-lg">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                <div className="p-4 max-h-[50vh] overflow-y-auto">
                    {items.length === 0 ? (
                        <p className="text-center text-slate-400 py-8">Nenhum item disponível</p>
                    ) : (
                        <div className="space-y-2">
                            {items.map(item => (
                                <div
                                    key={item.id}
                                    onClick={() => onSelect(item)}
                                    className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 hover:border-blue-300 hover:bg-blue-50 cursor-pointer transition-all"
                                >
                                    <div className="w-14 h-14 bg-slate-100 rounded-lg overflow-hidden flex items-center justify-center">
                                        {item.url ? (
                                            item.type === 'image' ? (
                                                <img src={item.url} alt="" className="w-full h-full object-cover" />
                                            ) : (
                                                <FileVideo className="w-6 h-6 text-slate-400" />
                                            )
                                        ) : (
                                            <Monitor className="w-6 h-6 text-slate-400" />
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-bold text-sm text-slate-800 truncate">{item.name}</p>
                                        <p className="text-xs text-slate-400">
                                            {item.type === 'widget' ? 'Widget Dinâmico' : item.type || 'Campanha'}
                                        </p>
                                    </div>
                                    <Plus className="w-5 h-5 text-slate-400" />
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// Componente principal
const Playlists = () => {
    const { currentUser, userData } = useAuth();
    const [playlists, setPlaylists] = useState([]);
    const [selectedPlaylistId, setSelectedPlaylistId] = useState(null);
    const [slots, setSlots] = useState(Array(13).fill(null)); // 13 slots por ciclo
    const [isSaving, setIsSaving] = useState(false);
    const [selectedSlotIndex, setSelectedSlotIndex] = useState(null);
    const [showSelector, setShowSelector] = useState(false);

    // Carregar playlists do Supabase (com prevenção de race conditions - Context7)
    useEffect(() => {
        let ignore = false; // Previne race conditions

        const fetchPlaylists = async () => {
            const { data, error } = await listPlaylists();
            if (ignore) return; // Ignora se componente desmontou

            if (!error && data) {
                setPlaylists(data);
            }
        };

        fetchPlaylists();

        // Realtime subscription com filtro por owner (otimização Context7)
        const channel = supabase
            .channel(`playlists-${currentUser?.id || 'all'}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'playlists',
                filter: currentUser?.id ? `owner_id=eq.${currentUser.id}` : undefined
            }, (payload) => {
                if (!ignore) {
                    console.log('[Realtime] Playlist change:', payload.eventType);
                    fetchPlaylists();
                }
            })
            .subscribe();

        return () => {
            ignore = true; // Cleanup
            supabase.removeChannel(channel);
        };
    }, [currentUser?.id]);

    // Carregar slots quando playlist selecionada (da tabela playlist_slots)
    useEffect(() => {
        if (!selectedPlaylistId) return;

        const fetchSlots = async () => {
            const { data, error } = await supabase
                .from('playlist_slots')
                .select(`
                    *,
                    media (*)
                `)
                .eq('playlist_id', selectedPlaylistId)
                .order('slot_index', { ascending: true });

            if (error) {
                console.error('[Playlists] Erro ao carregar slots:', error);
                setSlots(Array(13).fill(null));
                return;
            }

            // Converter para o formato de array de 13 posições
            const slotsArray = Array(13).fill(null);
            data?.forEach(slot => {
                if (slot.slot_index >= 0 && slot.slot_index < 13 && slot.media) {
                    slotsArray[slot.slot_index] = {
                        id: slot.media.id,
                        name: slot.media.name,
                        url: slot.media.url,
                        type: slot.media.type,
                        thumbnail: slot.media.type === 'image' ? slot.media.url : null,
                        duration: slot.duration || slot.media.duration || 10
                    };
                }
            });
            setSlots(slotsArray);
        };

        fetchSlots();
    }, [selectedPlaylistId]);

    const handleCreatePlaylist = async () => {
        const name = prompt("Nome da nova playlist:");
        if (!name) return;

        try {
            const { data, error } = await createPlaylist({
                name,
                slots: Array(13).fill(null),
                status: 'active',
                owner_id: currentUser?.id
            });
            if (error) throw error;
            if (data) setSelectedPlaylistId(data.id);
        } catch (error) {
            console.error("Erro ao criar:", error);
        }
    };

    const handleDeletePlaylist = async (e, id) => {
        e.stopPropagation();
        if (!window.confirm("Excluir esta playlist?")) return;
        try {
            const { error } = await deletePlaylist(id);
            if (error) throw error;
            if (selectedPlaylistId === id) setSelectedPlaylistId(null);
        } catch (error) {
            console.error(error);
        }
    };

    const handleSlotClick = (index) => {
        setSelectedSlotIndex(index);
        setShowSelector(true);
    };

    const handleAssignToSlot = (item) => {
        if (selectedSlotIndex === null) return;

        const slotDef = SLOT_CYCLE[selectedSlotIndex % SLOT_CYCLE.length];
        const newSlots = [...slots];
        newSlots[selectedSlotIndex] = {
            id: item.id,
            name: item.name,
            url: item.url,
            type: item.type,
            thumbnail: item.url && item.type === 'image' ? item.url : null,
            duration: item.type === 'video' ? 0 : slotDef.duration // Usar duração do slot
        };
        setSlots(newSlots);
        setShowSelector(false);
        setSelectedSlotIndex(null);
    };

    const handleClearSlot = (index) => {
        const newSlots = [...slots];
        newSlots[index] = null;
        setSlots(newSlots);
    };

    const handleSave = async () => {
        if (!selectedPlaylistId) return;
        setIsSaving(true);
        try {
            // 1. Deletar slots antigos desta playlist
            const { error: deleteError } = await supabase
                .from('playlist_slots')
                .delete()
                .eq('playlist_id', selectedPlaylistId);

            if (deleteError) throw deleteError;

            // 2. Inserir novos slots (apenas os preenchidos com UUIDs válidos)
            const isValidUUID = (str) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

            const slotsToInsert = slots
                .map((slot, index) => {
                    if (!slot) return null;
                    // Pular widgets dinâmicos (IDs não são UUIDs válidos)
                    if (!isValidUUID(slot.id)) {
                        console.warn(`[Playlists] Skipping slot ${index}: invalid UUID "${slot.id}"`);
                        return null;
                    }
                    return {
                        playlist_id: selectedPlaylistId,
                        slot_index: index,
                        media_id: slot.id,
                        slot_type: SLOT_CYCLE[index % SLOT_CYCLE.length].type,
                        duration: slot.duration || 10
                    };
                })
                .filter(Boolean);

            if (slotsToInsert.length > 0) {
                const { error: insertError } = await supabase
                    .from('playlist_slots')
                    .insert(slotsToInsert);

                if (insertError) throw insertError;
            }

            // 3. Atualizar updated_at da playlist
            await updatePlaylist(selectedPlaylistId, {
                updated_at: new Date().toISOString()
            });

            console.log(`[Playlists] Salvou ${slotsToInsert.length} slots`);
            setTimeout(() => setIsSaving(false), 1000);
        } catch (error) {
            console.error("Erro ao salvar:", error);
            setIsSaving(false);
        }
    };

    const getSlotDef = (index) => {
        return SLOT_CYCLE[index % SLOT_CYCLE.length];
    };

    const filledCount = slots.filter(s => s !== null).length;

    return (
        <div className="h-[calc(100vh-8rem)] flex flex-col md:flex-row gap-6">
            {/* Lista de Playlists */}
            <div className="w-full md:w-56 flex flex-col space-y-4">
                <div className="flex justify-between items-center">
                    <h2 className="text-xl font-bold text-slate-800">Playlists</h2>
                    <button
                        onClick={handleCreatePlaylist}
                        className="bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-lg"
                    >
                        <Plus className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 overflow-y-auto">
                    {playlists.length === 0 ? (
                        <p className="p-4 text-sm text-slate-400 text-center">Nenhuma playlist</p>
                    ) : (
                        playlists.map(playlist => (
                            <div
                                key={playlist.id}
                                onClick={() => setSelectedPlaylistId(playlist.id)}
                                className={`p-3 border-b border-slate-50 cursor-pointer flex justify-between items-center group transition-colors
                  ${selectedPlaylistId === playlist.id ? 'bg-blue-50 border-l-4 border-l-blue-500' : 'hover:bg-slate-50'}`}
                            >
                                <div>
                                    <p className={`font-medium text-sm truncate ${selectedPlaylistId === playlist.id ? 'text-blue-800' : 'text-slate-700'}`}>
                                        {playlist.name}
                                    </p>
                                    <p className="text-xs text-slate-400">
                                        {playlist.slots?.filter(s => s).length || 0}/13 slots
                                    </p>
                                </div>
                                <button
                                    onClick={(e) => handleDeletePlaylist(e, playlist.id)}
                                    className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-400 hover:text-red-500 rounded"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Editor de Slots */}
            <div className="flex-1 flex flex-col bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                {selectedPlaylistId ? (
                    <>
                        {/* Header */}
                        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <div>
                                <h3 className="font-bold text-slate-800">
                                    {playlists.find(p => p.id === selectedPlaylistId)?.name}
                                </h3>
                                <p className="text-xs text-slate-500">
                                    {filledCount}/13 slots preenchidos
                                </p>
                            </div>
                            <button
                                onClick={handleSave}
                                disabled={isSaving}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all shadow-sm
                  ${isSaving ? 'bg-green-100 text-green-700' : 'bg-green-600 hover:bg-green-700 text-white'}`}
                            >
                                {isSaving ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                                <span>{isSaving ? 'Salvo!' : 'Salvar'}</span>
                            </button>
                        </div>

                        {/* Legenda */}
                        <div className="px-4 py-3 border-b border-slate-100 flex flex-wrap gap-4">
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded bg-gradient-to-r from-indigo-500 to-purple-600"></div>
                                <span className="text-xs text-slate-600">Global (1)</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded bg-gradient-to-r from-amber-400 to-orange-500"></div>
                                <span className="text-xs text-slate-600">Parceiro (1)</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded bg-gradient-to-r from-blue-400 to-blue-600"></div>
                                <span className="text-xs text-slate-600">Local (10)</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded bg-gradient-to-r from-teal-400 to-emerald-500"></div>
                                <span className="text-xs text-slate-600">Dinâmico (1)</span>
                            </div>
                        </div>

                        {/* Grade Visual de Slots */}
                        <div className="flex-1 overflow-auto p-6 bg-slate-50">
                            <div className="flex flex-wrap gap-3 justify-center">
                                {slots.map((slot, index) => (
                                    <SlotCard
                                        key={index}
                                        slotIndex={index}
                                        slotDef={getSlotDef(index)}
                                        content={slot}
                                        isSelected={selectedSlotIndex === index}
                                        onClick={() => handleSlotClick(index)}
                                        onClear={() => handleClearSlot(index)}
                                        onAssign={handleAssignToSlot}
                                    />
                                ))}
                            </div>

                            {/* Legenda de Formato */}
                            <div className="mt-8 text-center">
                                <p className="text-xs text-slate-400 mb-2">Ciclo de Exibição:</p>
                                <div className="flex flex-wrap justify-center gap-1">
                                    {SLOT_CYCLE.map((s, i) => (
                                        <span
                                            key={i}
                                            className={`text-[8px] px-2 py-1 rounded font-bold uppercase bg-gradient-to-r ${s.color} text-white`}
                                        >
                                            {s.label}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-400 bg-slate-50">
                        <Monitor className="w-16 h-16 opacity-20 mb-4" />
                        <p className="font-medium text-slate-600">Selecione uma playlist</p>
                        <p className="text-sm">ou crie uma nova para começar</p>
                    </div>
                )}
            </div>

            {/* Modal Seletor */}
            {showSelector && selectedSlotIndex !== null && (
                <MediaSelector
                    slotType={getSlotDef(selectedSlotIndex).type}
                    onSelect={handleAssignToSlot}
                    onClose={() => { setShowSelector(false); setSelectedSlotIndex(null); }}
                />
            )}
        </div>
    );
};

export default Playlists;
