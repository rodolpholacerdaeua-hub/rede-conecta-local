import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, query, orderBy, doc, updateDoc, addDoc, getDocs } from 'firebase/firestore';
import { Monitor, Cpu, Thermometer, HardDrive, Zap, Power, Play, Plus, Search, Filter, Layers, Users } from 'lucide-react';

const TerminalCard = ({ terminal, playlists, onAssignPlaylist, onToggleSleep, onUpdateField }) => {
    const isOnline = terminal.lastSeen && (Date.now() - terminal.lastSeen.seconds * 1000 < 60000);

    return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow flex flex-col">
            <div className={`h-1.5 w-full ${isOnline ? 'bg-emerald-500' : 'bg-red-500'}`} />
            <div className="p-5 flex-1 flex flex-col">
                <div className="flex justify-between items-start mb-4">
                    <div className="flex-1 min-w-0 mr-2">
                        <h4 className="font-bold text-slate-800 flex items-center flex-wrap gap-2">
                            <span className="truncate">{terminal.name || 'Terminal Sem Nome'}</span>
                            {terminal.orientation === 'vertical' ?
                                <span className="text-[10px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded font-black uppercase flex-shrink-0">Vertical</span> :
                                <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-black uppercase flex-shrink-0">Horizontal</span>
                            }
                        </h4>
                        <div className="flex items-center space-x-1 mt-1">
                            <Users className="w-3 h-3 text-slate-400" />
                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider italic">
                                {terminal.group || 'Sem Grupo'}
                            </span>
                        </div>
                    </div>
                    <div className={`px-2 py-1 rounded text-[10px] font-bold flex-shrink-0 ${isOnline ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                        {terminal.sleepMode ? 'DORMINDO 🌙' : (isOnline ? 'ONLINE' : 'OFFLINE')}
                    </div>
                </div>

                {/* Métricas e Status */}
                <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="flex items-center space-x-2 text-slate-600">
                        <Thermometer className="w-4 h-4 text-slate-400" />
                        <span className="text-sm font-medium">{terminal.metrics?.temp || '--'}°C</span>
                    </div>
                    <div className="flex items-center space-x-2 text-slate-600">
                        <Cpu className="w-4 h-4 text-slate-400" />
                        <span className="text-sm font-medium">{terminal.metrics?.cpu || '--'}%</span>
                    </div>
                </div>

                {/* Gestão de Energia & Horários */}
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 space-y-3 mb-4">
                    <div className="flex items-center justify-between">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                            <Zap className="w-3 h-3" /> Operação (Horário)
                        </label>
                        <div className="flex items-center gap-2">
                            <input
                                type="time"
                                value={terminal.openingTime || '08:00'}
                                onChange={(e) => onUpdateField(terminal.id, 'openingTime', e.target.value)}
                                className="text-[10px] bg-white border border-slate-200 rounded px-1 font-bold text-slate-600"
                            />
                            <span className="text-[10px] text-slate-300">até</span>
                            <input
                                type="time"
                                value={terminal.closingTime || '22:00'}
                                onChange={(e) => onUpdateField(terminal.id, 'closingTime', e.target.value)}
                                className="text-[10px] bg-white border border-slate-200 rounded px-1 font-bold text-slate-600"
                            />
                        </div>
                    </div>
                </div>

                <div className="mt-auto space-y-3">
                    <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 block flex items-center gap-1">
                            <Layers className="w-3 h-3" /> Playlist Atribuída
                        </label>
                        <select
                            value={terminal.assignedPlaylistId || ''}
                            onChange={(e) => onAssignPlaylist(terminal.id, e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded text-xs p-1.5 outline-none focus:ring-1 focus:ring-blue-500 font-bold text-slate-700"
                        >
                            <option value="">Nenhuma (Standby)</option>
                            {playlists.map(p => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="border-t border-slate-100 pt-3 flex justify-between items-center">
                        <div className="flex items-center space-x-2 min-w-0 flex-1 mr-2">
                            <Play className="w-4 h-4 text-blue-500 flex-shrink-0" />
                            <span className="text-[11px] text-slate-500 font-bold truncate">
                                {terminal.currentMedia || 'Aguardando...'}
                            </span>
                        </div>
                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => onToggleSleep(terminal.id, terminal.sleepMode)}
                                className={`p-2 rounded-lg transition-colors flex-shrink-0 ${terminal.sleepMode ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'hover:bg-slate-100 text-slate-400 hover:text-slate-600'}`}
                                title={terminal.sleepMode ? "Despertar Player" : "Forçar Deep Sleep Manual"}
                            >
                                <Power className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const Players = () => {
    const [terminals, setTerminals] = useState([]);
    const [playlists, setPlaylists] = useState([]);
    const [isAdding, setIsAdding] = useState(false);
    const [newName, setNewName] = useState('');
    const [newGroup, setNewGroup] = useState('');
    const [orientation, setOrientation] = useState('horizontal');
    const [filterGroup, setFilterGroup] = useState('Todos');
    const [isBulkAssign, setIsBulkAssign] = useState(false);
    const [bulkPlaylistId, setBulkPlaylistId] = useState('');
    const [bulkGroup, setBulkGroup] = useState('');

    useEffect(() => {
        const qT = query(collection(db, "terminals"), orderBy("lastSeen", "desc"));
        const unsubscribeT = onSnapshot(qT, (snapshot) => {
            setTerminals(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });

        const qP = query(collection(db, "playlists"), orderBy("createdAt", "desc"));
        const unsubscribeP = onSnapshot(qP, (snapshot) => {
            setPlaylists(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });

        return () => {
            unsubscribeT();
            unsubscribeP();
        };
    }, []);

    const toggleSleepMode = async (id, current) => {
        try {
            await updateDoc(doc(db, "terminals", id), { sleepMode: !current });
        } catch (e) {
            console.error(e);
        }
    };

    const handleAssignPlaylist = async (terminalId, playlistId) => {
        try {
            await updateDoc(doc(db, "terminals", terminalId), {
                assignedPlaylistId: playlistId
            });
        } catch (e) {
            console.error(e);
        }
    };

    const handleUpdateField = async (terminalId, field, value) => {
        try {
            await updateDoc(doc(db, "terminals", terminalId), { [field]: value });
        } catch (e) {
            console.error(e);
        }
    };

    const handleBulkAssign = async () => {
        if (!bulkGroup || !bulkPlaylistId) return;
        try {
            const targets = terminals.filter(t => t.group === bulkGroup);
            const promises = targets.map(t =>
                updateDoc(doc(db, "terminals", t.id), { assignedPlaylistId: bulkPlaylistId })
            );
            await Promise.all(promises);
            setIsBulkAssign(false);
            setBulkPlaylistId('');
            setBulkGroup('');
        } catch (e) {
            console.error(e);
        }
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        if (!newName) return;
        try {
            await addDoc(collection(db, "terminals"), {
                name: newName,
                group: newGroup || 'Default',
                orientation,
                lastSeen: new Date(),
                metrics: { temp: "---", cpu: "---", disk: "---", freeSpace: "---" },
                status: 'online',
                currentMedia: 'Aguardando sincronia...',
                createdAt: new Date(),
                sleepMode: false,
                assignedPlaylistId: ''
            });
            setNewName('');
            setNewGroup('');
            setIsAdding(false);
        } catch (error) {
            console.error(error);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800">Telas e Terminais</h2>
                    <p className="text-slate-500">Monitore o status e saúde dos seus players em tempo real.</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setIsBulkAssign(!isBulkAssign)}
                        className="flex items-center space-x-2 bg-slate-800 hover:bg-slate-900 text-white px-4 py-2.5 rounded-lg transition-colors font-medium shadow-md text-sm"
                    >
                        <Layers className="w-4 h-4" />
                        <span>Atribuição em Massa</span>
                    </button>
                    <button
                        onClick={() => setIsAdding(!isAdding)}
                        className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg transition-colors font-medium shadow-md text-sm"
                    >
                        <Plus className="w-4 h-4" />
                        <span>{isAdding ? 'Cancelar' : 'Novo Terminal'}</span>
                    </button>
                </div>
            </div>

            {/* Filtros e Controles Rápidos */}
            <div className="flex flex-wrap items-center gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-slate-400" />
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Filtrar por Grupo:</span>
                </div>
                <div className="flex gap-2">
                    {['Todos', ...new Set(terminals.map(t => t.group || 'Default'))].map(g => (
                        <button
                            key={g}
                            onClick={() => setFilterGroup(g)}
                            className={`px-3 py-1 rounded-full text-xs font-bold transition-all border ${filterGroup === g ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'}`}
                        >
                            {g}
                        </button>
                    ))}
                </div>
            </div>

            {isBulkAssign && (
                <div className="bg-slate-900 p-6 rounded-xl border border-slate-700 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                    <h3 className="text-white font-bold mb-4 flex items-center gap-2">
                        <Layers className="w-5 h-5 text-blue-400" /> Atribuição em Massa por Grupo
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase">1. Selecione o Grupo</label>
                            <select
                                value={bulkGroup}
                                onChange={(e) => setBulkGroup(e.target.value)}
                                className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-sm text-white outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="">Escolha um grupo...</option>
                                {[...new Set(terminals.map(t => t.group || 'Default'))].map(g => (
                                    <option key={g} value={g}>{g}</option>
                                ))}
                            </select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase">2. Selecione a Playlist</label>
                            <select
                                value={bulkPlaylistId}
                                onChange={(e) => setBulkPlaylistId(e.target.value)}
                                className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-sm text-white outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="">Escolha a playlist...</option>
                                {playlists.map(p => (
                                    <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="flex items-end gap-2">
                            <button
                                onClick={handleBulkAssign}
                                disabled={!bulkGroup || !bulkPlaylistId}
                                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 text-white font-bold h-10 rounded-lg transition-all"
                            >
                                Aplicar a Todos
                            </button>
                            <button
                                onClick={() => setIsBulkAssign(false)}
                                className="bg-slate-800 text-slate-400 px-4 h-10 rounded-lg border border-slate-700 hover:text-white"
                            >
                                Sair
                            </button>
                        </div>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-4 italic">
                        * Esta ação atualizará instantaneamente a grade de todos os players pertencentes ao grupo selecionado.
                    </p>
                </div>
            )}

            {isAdding && (
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm animate-in fade-in slide-in-from-top-4 duration-300">
                    <form onSubmit={handleCreate} className="flex flex-col md:flex-row gap-4 items-end">
                        <div className="flex-1 space-y-2">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Nome do Ponto / Comércio</label>
                            <input
                                type="text"
                                value={newName}
                                onChange={(e) => setNewName(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="Ex: Padaria do João - Balcão"
                            />
                        </div>
                        <div className="flex-1 space-y-2">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Grupo de Telas</label>
                            <input
                                type="text"
                                value={newGroup}
                                onChange={(e) => setNewGroup(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="Ex: Zona Norte"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Orientação</label>
                            <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
                                <button type="button" onClick={() => setOrientation('horizontal')} className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${orientation === 'horizontal' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}>H</button>
                                <button type="button" onClick={() => setOrientation('vertical')} className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${orientation === 'vertical' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}>V</button>
                            </div>
                        </div>
                        <button type="submit" className="bg-blue-600 text-white px-6 py-2.5 rounded-lg font-black hover:bg-blue-700 shadow-sm transition-all uppercase text-xs tracking-widest"> Cadastrar </button>
                    </form>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
                {terminals
                    .filter(t => filterGroup === 'Todos' || t.group === filterGroup)
                    .map(t => (
                        <TerminalCard
                            key={t.id}
                            terminal={t}
                            playlists={playlists}
                            onAssignPlaylist={handleAssignPlaylist}
                            onToggleSleep={toggleSleepMode}
                            onUpdateField={handleUpdateField}
                        />
                    ))
                }
            </div>

            {terminals.length === 0 && !isAdding && (
                <div className="p-12 text-center text-slate-400 bg-white rounded-xl border border-dashed border-slate-300">
                    Nenhum player cadastrado. Conecte sua primeira TV Box para começar o monitoramento.
                </div>
            )}
        </div>
    );
};

export default Players;
