import React, { useState, useEffect } from 'react';
import { Play, Plus, Clock, GripVertical, Trash2, Save, Check, FileVideo } from 'lucide-react';
import { db } from '../firebase';
import { collection, addDoc, onSnapshot, query, orderBy, doc, updateDoc, deleteDoc } from 'firebase/firestore';

const MediaSelector = ({ onSelect }) => {
    const [mediaFiles, setMediaFiles] = useState([]);

    useEffect(() => {
        const q = query(collection(db, "media"), orderBy("createdAt", "desc"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setMediaFiles(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });
        return () => unsubscribe();
    }, []);

    return (
        <div className="bg-white p-4 rounded-xl border border-slate-200 h-full overflow-y-auto max-h-[calc(100vh-10rem)]">
            <h3 className="font-bold text-slate-700 mb-4">Mídias Disponíveis</h3>
            <div className="space-y-2">
                {mediaFiles.map(file => (
                    <div
                        key={file.id}
                        onClick={() => onSelect(file)}
                        className="flex items-center space-x-3 p-2 hover:bg-slate-50 rounded-lg cursor-pointer border border-transparent hover:border-slate-200 transition-all select-none"
                    >
                        <div className="w-10 h-10 bg-slate-100 rounded flex items-center justify-center flex-shrink-0 overflow-hidden">
                            {file.type === 'image' ? (
                                <img src={file.url} alt="" className="w-full h-full object-cover" />
                            ) : (
                                <FileVideo className="w-5 h-5 text-slate-400" />
                            )}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-800 truncate">{file.name}</p>
                            <p className="text-xs text-slate-400 capitalize">{file.type === 'image' ? 'Imagem' : 'Vídeo'}</p>
                        </div>
                        <Plus className="w-4 h-4 text-blue-500" />
                    </div>
                ))}
                {mediaFiles.length === 0 && (
                    <p className="text-sm text-slate-400 text-center py-4">Nenhuma mídia encontrada. Faça upload na Biblioteca.</p>
                )}
            </div>
        </div>
    );
};

const Playlists = () => {
    const [playlists, setPlaylists] = useState([]);
    const [selectedPlaylistId, setSelectedPlaylistId] = useState(null);
    const [currentItems, setCurrentItems] = useState([]);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        const q = query(collection(db, "playlists"), orderBy("createdAt", "desc"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setPlaylists(docs);
            if (!selectedPlaylistId && docs.length > 0) {
                // Não selecionar automaticamente para evitar troca inesperada
            }
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        if (selectedPlaylistId) {
            const playlist = playlists.find(p => p.id === selectedPlaylistId);
            if (playlist) setCurrentItems(playlist.items || []);
        } else {
            setCurrentItems([]);
        }
    }, [selectedPlaylistId, playlists]);

    const handleCreatePlaylist = async () => {
        const name = prompt("Nome da nova playlist:");
        if (!name) return;

        try {
            const docRef = await addDoc(collection(db, "playlists"), {
                name,
                items: [],
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

    const handleAddItem = (media) => {
        if (!selectedPlaylistId) {
            alert("Selecione uma playlist primeiro!");
            return;
        }
        const newItem = {
            mediaId: media.id,
            name: media.name,
            type: media.type,
            duration: media.type === 'video' ? 0 : 10,
            url: media.url
        };
        // Adiciona ao final da lista local
        const newItems = [...currentItems, newItem];
        setCurrentItems(newItems);

        // Auto-save opcional ou manual? Vamos deixar manual por segurança
    };

    const handleRemoveItem = (index) => {
        const newItems = [...currentItems];
        newItems.splice(index, 1);
        setCurrentItems(newItems);
    };

    const handleDurationChange = (index, val) => {
        const newItems = [...currentItems];
        newItems[index].duration = parseInt(val) || 5;
        setCurrentItems(newItems);
    };

    const handleSave = async () => {
        if (!selectedPlaylistId) return;
        setIsSaving(true);
        try {
            const playlistRef = doc(db, "playlists", selectedPlaylistId);
            await updateDoc(playlistRef, {
                items: currentItems,
                updatedAt: new Date()
            });
            setTimeout(() => setIsSaving(false), 1000);
        } catch (error) {
            console.error("Erro ao salvar:", error);
            setIsSaving(false);
            alert("Erro ao salvar playlist");
        }
    };

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
                            <div>
                                <h3 className="font-bold text-slate-800 truncate max-w-[200px] md:max-w-md">
                                    {playlists.find(p => p.id === selectedPlaylistId)?.name}
                                </h3>
                                <p className="text-xs text-slate-500">
                                    {currentItems.length} itens • {currentItems.reduce((acc, item) => acc + (parseInt(item.duration) || 0), 0)}s total
                                </p>
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
                                currentItems.map((item, index) => (
                                    <div key={index} className="flex items-center space-x-3 bg-white p-3 rounded-lg border border-slate-200 shadow-sm group hover:border-blue-200 transition-colors">
                                        <div className="text-slate-300 cursor-move">
                                            <GripVertical className="w-5 h-5" />
                                        </div>

                                        <div className="w-12 h-12 bg-slate-100 rounded overflow-hidden flex items-center justify-center flex-shrink-0">
                                            {item.type === 'image' ? (
                                                <img src={item.url} alt="" className="w-full h-full object-cover" />
                                            ) : (
                                                <FileVideo className="w-6 h-6 text-slate-400" />
                                            )}
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium text-slate-800 text-sm truncate">{item.name}</p>
                                            <div className="flex items-center space-x-2 mt-1">
                                                <Clock className="w-3 h-3 text-slate-400" />
                                                {item.type === 'image' ? (
                                                    <div className="flex items-center">
                                                        <input
                                                            type="number"
                                                            className="w-12 text-xs border border-slate-300 rounded px-1 py-0.5 focus:border-blue-500 outline-none text-center"
                                                            value={item.duration}
                                                            onChange={(e) => handleDurationChange(index, e.target.value)}
                                                            min="1"
                                                        />
                                                        <span className="text-xs text-slate-500 ml-1">seg</span>
                                                    </div>
                                                ) : (
                                                    <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded">Vídeo (Auto)</span>
                                                )}
                                            </div>
                                        </div>

                                        <button
                                            onClick={() => handleRemoveItem(index)}
                                            className="text-slate-400 hover:text-red-500 p-2 hover:bg-red-50 rounded transition-colors"
                                            title="Remover item"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-400 bg-slate-50">
                        <div className="w-16 h-16 bg-slate-200 rounded-full flex items-center justify-center mb-4">
                            <Plus className="w-8 h-8 text-slate-400" />
                        </div>
                        <p className="font-medium text-slate-600">Nenhuma playlist selecionada</p>
                        <p className="text-sm mt-1">Crie uma nova ou selecione ao lado.</p>
                    </div>
                )}
            </div>

            {/* Seletor de Mídia (Direita) */}
            <div className="w-full md:w-80 border-l border-slate-200 md:pl-4 hidden md:block">
                <MediaSelector onSelect={handleAddItem} />
            </div>
        </div>
    );
};

export default Playlists;
