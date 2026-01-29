import React, { useState, useEffect } from 'react';
import { Play, Plus, Clock, GripVertical, Trash2, Save, Check, FileVideo, Monitor, Image as ImageIcon } from 'lucide-react';
import { db } from '../firebase';
import { collection, addDoc, onSnapshot, query, orderBy, doc, updateDoc, deleteDoc, where } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const ItemSelector = ({ onSelect }) => {
    const { currentUser, userData } = useAuth();
    const [mediaFiles, setMediaFiles] = useState([]);
    const [campaigns, setCampaigns] = useState([]);
    const [tab, setTab] = useState('campaigns'); // Default to campaigns

    useEffect(() => {
        if (!currentUser) return;

        // Mídias: Admin vê tudo, Cliente vê as suas
        const qM = userData?.role === 'admin'
            ? query(collection(db, "media"), orderBy("createdAt", "desc"))
            : query(collection(db, "media"), where("ownerId", "==", currentUser.uid), orderBy("createdAt", "desc"));

        const unsubscribeM = onSnapshot(qM, (snapshot) => {
            setMediaFiles(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        }, (error) => {
            console.error("Playlists MediaSelector: Erro ao carregar mídias:", error);
        });

        // Campanhas: Admin vê tudo, Cliente vê as suas
        const qC = userData?.role === 'admin'
            ? query(collection(db, "campaigns"), orderBy("createdAt", "desc"))
            : query(collection(db, "campaigns"), where("ownerId", "==", currentUser.uid), orderBy("createdAt", "desc"));

        const unsubscribeC = onSnapshot(qC, (snapshot) => {
            setCampaigns(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        }, (error) => {
            console.error("Playlists CampaignSelector: Erro ao carregar campanhas:", error);
        });

        return () => {
            unsubscribeM();
            unsubscribeC();
        };
    }, [currentUser?.uid, userData?.role]);

    return (
        <div className="bg-white p-4 rounded-xl border border-slate-200 h-full overflow-y-auto max-h-[calc(100vh-10rem)]">
            <h3 className="font-bold text-slate-700 mb-4">Adicionar Itens</h3>

            <div className="flex bg-slate-100 p-1 rounded-lg mb-4">
                <button
                    onClick={() => setTab('campaigns')}
                    className={`flex-1 text-[10px] font-bold py-1.5 rounded transition-all ${tab === 'campaigns' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    CAMPANHAS
                </button>
                <button
                    onClick={() => setTab('media')}
                    className={`flex-1 text-[10px] font-bold py-1.5 rounded transition-all ${tab === 'media' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    MÍDIA GLOBAL
                </button>
            </div>

            <div className="space-y-2">
                {tab === 'media' ? (
                    <>
                        {/* Mídias Globais */}
                        {mediaFiles.map(file => (
                            <div
                                key={file.id}
                                onClick={() => onSelect({ ...file, itemType: 'media' })}
                                className="flex items-center space-x-3 p-2 hover:bg-slate-50 rounded-lg cursor-pointer border border-transparent hover:border-slate-200 transition-all select-none"
                            >
                                <div className="w-10 h-10 bg-slate-100 rounded flex items-center justify-center flex-shrink-0 overflow-hidden relative">
                                    {file.type === 'image' ? (
                                        <img src={file.url} alt="" className="w-full h-full object-cover" />
                                    ) : (
                                        <FileVideo className="w-5 h-5 text-slate-400" />
                                    )}
                                    <div className="absolute bottom-0 right-0 bg-blue-600 text-white text-[8px] px-1 rounded-tl font-bold uppercase">
                                        {file.orientation === 'vertical' ? 'V' : 'H'}
                                    </div>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-slate-800 truncate">{file.name}</p>
                                    <p className="text-[10px] text-slate-400 uppercase tracking-tighter">Arquivo • {file.type === 'image' ? 'Imagem' : 'Vídeo'}</p>
                                </div>
                                <Plus className="w-4 h-4 text-blue-500" />
                            </div>
                        ))}
                        {/* Campanhas Globais (Aparecem aqui também) */}
                        {campaigns.filter(c => c.isGlobal).map(camp => (
                            <div
                                key={camp.id}
                                onClick={() => onSelect({ ...camp, itemType: 'campaign' })}
                                className="flex items-center space-x-3 p-2 hover:bg-emerald-50 rounded-lg cursor-pointer border border-transparent hover:border-emerald-200 transition-all select-none"
                            >
                                <div className="w-10 h-10 bg-emerald-100 rounded flex items-center justify-center flex-shrink-0 relative overflow-hidden">
                                    <Globe className="w-5 h-5 text-emerald-600" />
                                    <div className="absolute bottom-0 right-0 bg-emerald-600 text-white text-[8px] px-1 rounded-tl font-bold uppercase">
                                        GLOBAL
                                    </div>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-black text-slate-800 truncate">{camp.name}</p>
                                    <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-tighter">Campanha de Rede</p>
                                </div>
                                <Plus className="w-4 h-4 text-emerald-500" />
                            </div>
                        ))}
                    </>
                ) : (
                    /* Campanhas Locais (Apenas as NÃO globais) */
                    campaigns.filter(c => !c.isGlobal).map(camp => (
                        <div
                            key={camp.id}
                            onClick={() => onSelect({ ...camp, itemType: 'campaign' })}
                            className="flex items-center space-x-3 p-2 hover:bg-slate-50 rounded-lg cursor-pointer border border-transparent hover:border-slate-200 transition-all select-none"
                        >
                            <div className="w-10 h-10 bg-indigo-100 rounded flex items-center justify-center flex-shrink-0 relative overflow-hidden">
                                <Monitor className="w-5 h-5 text-indigo-500" />
                                <div className="absolute bottom-0 right-0 bg-indigo-600 text-white text-[8px] px-1 rounded-tl font-bold uppercase">
                                    LOCAL
                                </div>
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-slate-800 truncate">{camp.name}</p>
                                <p className="text-[10px] text-slate-400 uppercase tracking-tighter">Anúncio Específico</p>
                            </div>
                            <Plus className="w-4 h-4 text-indigo-500" />
                        </div>
                    ))
                )}
                {tab === 'media' && mediaFiles.length === 0 && campaigns.filter(c => c.isGlobal).length === 0 && (
                    <p className="text-sm text-slate-400 text-center py-4">Nenhum conteúdo global.</p>
                )}
                {tab === 'campaigns' && campaigns.filter(c => !c.isGlobal).length === 0 && (
                    <p className="text-sm text-slate-400 text-center py-4">Nenhuma campanha local encontrada.</p>
                )}
            </div>
        </div>
    );
};

const SortableItem = ({ id, item, index, activeTab, onRemove, onDurationChange }) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 50 : 'auto',
        opacity: isDragging ? 0.5 : 1,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className="flex items-center space-x-3 bg-white p-3 rounded-lg border border-slate-200 shadow-sm group hover:border-blue-200 transition-colors"
        >
            <div {...attributes} {...listeners} className="text-slate-300 cursor-grab active:cursor-grabbing p-1 hover:text-slate-500">
                <GripVertical className="w-5 h-5" />
            </div>

            <div className="w-12 h-12 bg-slate-100 rounded overflow-hidden flex items-center justify-center flex-shrink-0 border border-slate-200">
                {item.type === 'media' ? (
                    item.mediaType === 'image' ? (
                        <img src={item.url} alt="" className="w-full h-full object-cover" />
                    ) : (
                        <FileVideo className="w-6 h-6 text-slate-400" />
                    )
                ) : (
                    <Monitor className="w-6 h-6 text-indigo-500" />
                )}
            </div>

            <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-2">
                    <p className="font-bold text-slate-800 text-sm truncate">{item.name}</p>
                    {item.type === 'campaign' ? (
                        <span className="bg-indigo-100 text-indigo-700 text-[8px] font-black px-1.5 py-0.5 rounded uppercase">Campanha</span>
                    ) : (
                        <span className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase ${item.orientation === 'vertical' ? 'bg-indigo-600 text-white' : 'bg-blue-600 text-white'}`}>
                            {item.orientation}
                        </span>
                    )}
                </div>
                <div className="flex items-center space-x-2 mt-1">
                    <Clock className="w-3 h-3 text-slate-400" />
                    {(item.type === 'media' && item.mediaType === 'video') ? (
                        <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded">Vídeo (Auto)</span>
                    ) : (
                        <div className="flex items-center">
                            <input
                                type="number"
                                className="w-12 text-xs border border-slate-300 rounded px-1 py-0.5 focus:border-blue-500 outline-none text-center"
                                value={item.duration}
                                onChange={(e) => onDurationChange(index, e.target.value)}
                                min="1"
                            />
                            <span className="text-xs text-slate-500 ml-1">seg</span>
                        </div>
                    )}
                </div>
            </div>

            <button
                onClick={() => onRemove(index)}
                className="text-slate-400 hover:text-red-500 p-2 hover:bg-red-50 rounded transition-colors"
                title="Remover item"
            >
                <Trash2 className="w-4 h-4" />
            </button>
        </div>
    );
};

const Playlists = () => {
    const { currentUser, userData } = useAuth();
    const [playlists, setPlaylists] = useState([]);
    const [selectedPlaylistId, setSelectedPlaylistId] = useState(null);
    const [localItems, setLocalItems] = useState([]);
    const [globalItems, setGlobalItems] = useState([]);
    const [interleaveRatio, setInterleaveRatio] = useState(3);
    const [activeTab, setActiveTab] = useState('local'); // 'local' or 'global'
    const [isSaving, setIsSaving] = useState(false);

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    useEffect(() => {
        const q = query(collection(db, "playlists"), orderBy("createdAt", "desc"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setPlaylists(docs);
        }, (error) => {
            console.error("Playlists: Erro ao carregar playlists:", error);
        });
        return () => unsubscribe();
    }, [currentUser?.uid, userData?.role]);

    useEffect(() => {
        if (selectedPlaylistId) {
            const playlist = playlists.find(p => p.id === selectedPlaylistId);
            if (playlist) {
                // Garantir que itens legados tenham sortId para DND
                const fixItems = (items) => (items || []).map(i => ({
                    ...i,
                    sortId: i.sortId || `${i.id}-${Math.random().toString(36).substr(2, 9)}`
                }));
                setLocalItems(fixItems(playlist.localItems));
                setGlobalItems(fixItems(playlist.globalItems));
                setInterleaveRatio(playlist.interleaveRatio || 3);
            }
        } else {
            setLocalItems([]);
            setGlobalItems([]);
        }
    }, [selectedPlaylistId, playlists]);

    const handleCreatePlaylist = async () => {
        const name = prompt("Nome da nova playlist:");
        if (!name) return;

        try {
            const docRef = await addDoc(collection(db, "playlists"), {
                name,
                localItems: [],
                globalItems: [],
                interleaveRatio: 3,
                createdAt: new Date(),
                active: true
            });
            setSelectedPlaylistId(docRef.id);
        } catch (error) {
            console.error("Erro ao criar:", error);
            alert("Erro ao criar playlist. Verifique o console.");
        }
    };

    const handleDeletePlaylist = async (e, id) => {
        e.stopPropagation();
        if (!window.confirm("Excluir realmente esta playlist?")) return;
        try {
            await deleteDoc(doc(db, "playlists", id));
            if (selectedPlaylistId === id) setSelectedPlaylistId(null);
        } catch (error) {
            console.error(error);
        }
    };

    const handleAddItem = (item) => {
        if (!selectedPlaylistId) {
            alert("Selecione uma playlist primeiro!");
            return;
        }

        const newItem = {
            id: item.id,
            sortId: `${item.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            name: item.name,
            type: item.itemType, // 'media' or 'campaign'
            duration: item.type === 'video' ? 0 : 10,
        };

        if (item.itemType === 'media') {
            newItem.url = item.url;
            newItem.mediaType = item.type; // image or video
            newItem.orientation = item.orientation;
        }

        if (activeTab === 'local') {
            setLocalItems([...localItems, newItem]);
        } else {
            setGlobalItems([...globalItems, newItem]);
        }
    };

    const handleRemoveItem = (index) => {
        if (activeTab === 'local') {
            const newItems = [...localItems];
            newItems.splice(index, 1);
            setLocalItems(newItems);
        } else {
            const newItems = [...globalItems];
            newItems.splice(index, 1);
            setGlobalItems(newItems);
        }
    };

    const handleDurationChange = (index, val) => {
        const duration = parseInt(val) || 5;
        if (activeTab === 'local') {
            const newItems = [...localItems];
            newItems[index].duration = duration;
            setLocalItems(newItems);
        } else {
            const newItems = [...globalItems];
            newItems[index].duration = duration;
            setGlobalItems(newItems);
        }
    };

    const handleDragEnd = (event) => {
        const { active, over } = event;

        if (active.id !== over.id) {
            if (activeTab === 'local') {
                const oldIndex = localItems.findIndex(i => i.sortId === active.id);
                const newIndex = localItems.findIndex(i => i.sortId === over.id);
                setLocalItems(arrayMove(localItems, oldIndex, newIndex));
            } else {
                const oldIndex = globalItems.findIndex(i => i.sortId === active.id);
                const newIndex = globalItems.findIndex(i => i.sortId === over.id);
                setGlobalItems(arrayMove(globalItems, oldIndex, newIndex));
            }
        }
    };

    const handleSave = async () => {
        if (!selectedPlaylistId) return;
        setIsSaving(true);
        try {
            const playlistRef = doc(db, "playlists", selectedPlaylistId);
            await updateDoc(playlistRef, {
                localItems,
                globalItems,
                interleaveRatio,
                updatedAt: new Date()
            });
            setTimeout(() => setIsSaving(false), 1000);
        } catch (error) {
            console.error("Erro ao salvar:", error);
            setIsSaving(false);
            alert("Erro ao salvar playlist");
        }
    };

    const currentItems = activeTab === 'local' ? localItems : globalItems;

    return (
        <div className="h-[calc(100vh-8rem)] flex flex-col md:flex-row gap-6">
            {/* Lista de Playlists (Esquerda) */}
            <div className="w-full md:w-64 flex flex-col space-y-4">
                <div className="flex justify-between items-center">
                    <h2 className="text-xl font-bold text-slate-800">Playlists</h2>
                    <button onClick={handleCreatePlaylist} className="bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-lg transition-colors" title="Nova Playlist">
                        <Plus className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 overflow-y-auto">
                    {playlists.length === 0 ? (
                        <p className="p-4 text-sm text-slate-400 text-center">Nenhuma playlist criada.</p>
                    ) : (
                        playlists.map(playlist => (
                            <div
                                key={playlist.id}
                                onClick={() => setSelectedPlaylistId(playlist.id)}
                                className={`p-3 border-b border-slate-50 cursor-pointer flex justify-between items-center group transition-colors ${selectedPlaylistId === playlist.id ? 'bg-blue-50 border-l-4 border-l-blue-500' : 'hover:bg-slate-50'
                                    }`}
                            >
                                <div className="overflow-hidden">
                                    <p className={`font-medium text-sm truncate ${selectedPlaylistId === playlist.id ? 'text-blue-800' : 'text-slate-700'}`}>
                                        {playlist.name}
                                    </p>
                                    <p className="text-xs text-slate-400">{playlist.items?.length || 0} itens</p>
                                </div>
                                <button
                                    onClick={(e) => handleDeletePlaylist(e, playlist.id)}
                                    className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Editor Central */}
            <div className="flex-1 flex flex-col bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                {selectedPlaylistId ? (
                    <>
                        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <div className="flex items-center space-x-4">
                                <div>
                                    <h3 className="font-bold text-slate-800 truncate max-w-[200px] md:max-w-md">
                                        {playlists.find(p => p.id === selectedPlaylistId)?.name}
                                    </h3>
                                    <p className="text-xs text-slate-500">
                                        {localItems.length} locais • {globalItems.length} globais
                                    </p>
                                </div>
                                <div className="flex items-center space-x-2 bg-slate-100 p-1 rounded-lg">
                                    <button
                                        onClick={() => setActiveTab('local')}
                                        className={`px-3 py-1 text-xs font-bold rounded ${activeTab === 'local' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}
                                    >
                                        LOCAL
                                    </button>
                                    <button
                                        onClick={() => setActiveTab('global')}
                                        className={`px-3 py-1 text-xs font-bold rounded ${activeTab === 'global' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}
                                    >
                                        GLOBAL
                                    </button>
                                </div>
                                <div className="hidden md:flex items-center space-x-2 border-l pl-4 border-slate-200">
                                    <span className="text-[10px] font-bold text-slate-400">RATIO:</span>
                                    <input
                                        type="number"
                                        value={interleaveRatio}
                                        onChange={(e) => setInterleaveRatio(parseInt(e.target.value) || 1)}
                                        className="w-12 text-center text-xs border border-slate-200 rounded p-1"
                                        min="1"
                                    />
                                    <span className="text-[10px] text-slate-400">1G : {interleaveRatio}L</span>
                                </div>
                            </div>
                            <button
                                onClick={handleSave}
                                disabled={isSaving}
                                className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-all shadow-sm ${isSaving ? 'bg-green-100 text-green-700' : 'bg-green-600 hover:bg-green-700 text-white'
                                    }`}
                            >
                                {isSaving ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                                <span>{isSaving ? 'Salvo!' : 'Salvar'}</span>
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-slate-50">
                            {currentItems.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-200 rounded-lg m-4">
                                    <Play className="w-12 h-12 mb-2 opacity-20" />
                                    <p>Grade vazia</p>
                                    <p className="text-sm">Adicione mídias da direita 👉</p>
                                </div>
                            ) : (
                                <DndContext
                                    sensors={sensors}
                                    collisionDetection={closestCenter}
                                    onDragEnd={handleDragEnd}
                                >
                                    <SortableContext
                                        items={currentItems.map(i => i.sortId)}
                                        strategy={verticalListSortingStrategy}
                                    >
                                        <div className="space-y-2">
                                            {currentItems.map((item, index) => (
                                                <SortableItem
                                                    key={item.sortId}
                                                    id={item.sortId}
                                                    item={item}
                                                    index={index}
                                                    activeTab={activeTab}
                                                    onRemove={handleRemoveItem}
                                                    onDurationChange={handleDurationChange}
                                                />
                                            ))}
                                        </div>
                                    </SortableContext>
                                </DndContext>
                            )}
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-400 bg-slate-50">
                        <div className="w-16 h-16 bg-slate-200 rounded-full flex items-center justify-center mb-4">
                            <Monitor className="w-8 h-8 text-slate-400" />
                        </div>
                        <p className="font-medium text-slate-600">Nenhuma playlist selecionada</p>
                        <p className="text-sm mt-1">Crie uma nova ou selecione ao lado.</p>
                    </div>
                )}
            </div>

            {/* Seletor de Itens (Direita) */}
            <div className="w-full md:w-80 border-l border-slate-200 md:pl-4 hidden md:block">
                <ItemSelector onSelect={handleAddItem} />
            </div>
        </div>
    );
};

export default Playlists;
