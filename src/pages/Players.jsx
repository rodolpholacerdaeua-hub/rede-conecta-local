import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { canCreateTerminal, getPlanQuota } from '../utils/planHelpers';
import { db } from '../firebase';
import { collection, onSnapshot, query, orderBy, doc, updateDoc, addDoc, getDocs } from 'firebase/firestore';
import { Monitor, Cpu, Thermometer, HardDrive, Zap, Power, Play, Plus, Search, Filter, Layers, Users, Settings } from 'lucide-react';
import GroupManagerModal from '../components/GroupManagerModal';

const TerminalCard = ({ terminal, playlists, availableGroups, onAssignPlaylist, onUpdateField }) => {
    const [now, setNow] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 30000);
        return () => clearInterval(timer);
    }, []);

    const lastSeenMs = terminal.lastSeen?.seconds ? terminal.lastSeen.seconds * 1000 : (terminal.lastSeen ? new Date(terminal.lastSeen).getTime() : 0);
    const isOnline = lastSeenMs > 0 && !isNaN(lastSeenMs) && (now.getTime() - lastSeenMs < 60000);

    const getOperationalStatus = () => {
        const mode = terminal.powerMode || 'auto';

        const ensureLeadingZero = (time) => {
            if (!time) return "00:00";
            return time.includes(':') && time.split(':')[0].length === 1 ? `0${time}` : time;
        };

        const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
        const open = ensureLeadingZero(terminal.openingTime || "08:00");
        const close = ensureLeadingZero(terminal.closingTime || "22:00");
        const isWithinTime = open <= close
            ? (currentTime >= open && currentTime <= close)
            : (currentTime >= open || currentTime <= close);

        const activeDays = terminal.activeDays || [0, 1, 2, 3, 4, 5, 6];
        const currentDay = now.getDay(); // 0 = Domingo
        const isDayActive = activeDays.includes(currentDay);

        const shouldBeOff = mode === 'off' || (mode === 'auto' && (!isWithinTime || !isDayActive));

        // Se a intenção é estar DESLIGADO
        if (shouldBeOff) {
            return mode === 'off'
                ? { label: 'FORÇADO OFF', class: 'bg-slate-800 text-white border-slate-900' }
                : { label: 'AUTO: STANDBY', class: 'bg-amber-50 text-amber-700 border border-amber-200' };
        }

        // Se a intenção é estar LIGADO, mas o hardware ainda não cantou presença
        if (!isOnline) {
            return { label: 'LIGANDO...', class: 'bg-amber-500 text-white border-amber-600 animate-pulse font-black' };
        }

        // Intenção LIGADO + Hardware ON
        return {
            label: mode === 'on' ? 'EM OPERAÇÃO (ON)' : 'EM OPERAÇÃO (AUTO)',
            class: 'bg-emerald-500 text-white border-emerald-600 font-bold'
        };
    };

    const opStatus = getOperationalStatus();

    return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow flex flex-col">
            <div className={`h-1.5 w-full ${isOnline ? 'bg-emerald-500' : 'bg-red-500'} transition-colors duration-1000`} />
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
                            <select
                                value={terminal.group || 'Default'}
                                onChange={(e) => onUpdateField(terminal.id, 'group', e.target.value)}
                                className="text-[10px] text-slate-400 font-bold uppercase tracking-wider italic bg-transparent border-none p-0 outline-none cursor-pointer hover:text-blue-600 focus:ring-0 w-auto max-w-[120px] truncate appearance-none"
                                title="Clique para alterar o grupo"
                            >
                                <option value="Default">Default</option>
                                {availableGroups?.filter(g => g !== 'Default').map(g => (
                                    <option key={g} value={g}>{g}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                        <div className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider border shadow-sm transition-all ${opStatus.class}`}>
                            {opStatus.label}
                        </div>
                        <div className="flex items-center gap-1">
                            <div className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
                            <span className={`text-[8px] font-black uppercase tracking-widest ${isOnline ? 'text-emerald-600' : 'text-red-600'}`}>
                                {isOnline ? 'CONECTADO' : 'OFFLINE'}
                            </span>
                        </div>
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

                    <div className="flex justify-between items-center gap-1">
                        {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((day, idx) => {
                            const activeDays = terminal.activeDays || [0, 1, 2, 3, 4, 5, 6];
                            const isActive = activeDays.includes(idx);

                            const toggleDay = () => {
                                const newDays = isActive
                                    ? activeDays.filter(d => d !== idx)
                                    : [...activeDays, idx].sort();
                                onUpdateField(terminal.id, 'activeDays', newDays);
                            };

                            return (
                                <button
                                    key={idx}
                                    onClick={toggleDay}
                                    className={`flex-1 aspect-square rounded text-[9px] font-black flex items-center justify-center transition-all ${isActive
                                            ? 'bg-indigo-600 text-white shadow-sm'
                                            : 'bg-white text-slate-300 border border-slate-100'
                                        }`}
                                    title={`Alternar ${day}`}
                                >
                                    {day}
                                </button>
                            )
                        })}
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
                        <div className="flex items-center bg-slate-100 p-1 rounded-xl">
                            <button
                                onClick={() => onUpdateField(terminal.id, 'powerMode', 'on')}
                                className={`p-1.5 rounded-lg transition-all flex-1 flex items-center justify-center ${terminal.powerMode === 'on' ? 'bg-emerald-500 text-white shadow-sm' : 'text-slate-400 hover:text-emerald-600'}`}
                                title="Forçar Ligado (Manual ON)"
                            >
                                <Zap className="w-3.5 h-3.5" />
                            </button>
                            <button
                                onClick={() => onUpdateField(terminal.id, 'powerMode', 'auto')}
                                className={`p-1.5 rounded-lg transition-all flex-1 flex items-center justify-center ${(!terminal.powerMode || terminal.powerMode === 'auto') ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-indigo-600'}`}
                                title="Modo Automático (Segue Agenda)"
                            >
                                <span className="text-[9px] font-black italic">AUTO</span>
                            </button>
                            <button
                                onClick={() => onUpdateField(terminal.id, 'powerMode', 'off')}
                                className={`p-1.5 rounded-lg transition-all flex-1 flex items-center justify-center ${terminal.powerMode === 'off' ? 'bg-red-500 text-white shadow-sm' : 'text-slate-400 hover:text-red-600'}`}
                                title="Forçar Standby (Manual OFF)"
                            >
                                <Power className="w-3.5 h-3.5" />
                            </button>
                        </div>
                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => window.open(`/player/${terminal.id}`, '_blank')}
                                className="p-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-600 hover:text-white transition-all shadow-sm"
                                title="Visualizar Reprodução em Tempo Real"
                            >
                                <Monitor className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const Players = () => {
    const { currentUser, userData } = useAuth();
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
    const [isGroupManagerOpen, setIsGroupManagerOpen] = useState(false);
    const [availableGroups, setAvailableGroups] = useState([]);

    const terminalValidation = canCreateTerminal(userData, terminals.length);

    useEffect(() => {
        let unsubscribeT = () => { };
        let unsubscribeP = () => { };
        let unsubscribeG = () => { };

        try {
            const qT = query(collection(db, "terminals"), orderBy("lastSeen", "desc"));
            unsubscribeT = onSnapshot(qT, (snapshot) => {
                setTerminals(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            }, (error) => {
                console.error("Players: Erro ao carregar terminais:", error);
            });

            const qP = query(collection(db, "playlists"), orderBy("createdAt", "desc"));
            unsubscribeP = onSnapshot(qP, (snapshot) => {
                setPlaylists(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            }, (error) => {
                console.error("Players: Erro ao carregar playlists:", error);
            });

            const qG = query(collection(db, "terminal_groups"), orderBy("name"));
            unsubscribeG = onSnapshot(qG, (snapshot) => {
                const structuredGroups = snapshot.docs.map(doc => doc.data().name);
                // Mescla com grupos ad-hoc que por acaso existam nos terminais mas não na coleção (para legado)
                // Mas a prioridade é o que está no banco estruturado. Vamos usar apenas os estruturados + 'Default' para simplificar?
                // O usuário pediu para "incluir novas telas em grupos já existentes". Então melhor usar a fonte da verdade.
                // Mas para não quebrar UI com grupos deletados, se um terminal tem grupo X e X não existe na collection,
                // ele ainda aparece no filtro? Sim, pois o filtro usa 'terminals.map'
                setAvailableGroups([...new Set(structuredGroups)]);
            });

        } catch (err) {
            console.error("Players: Erro na inicialização:", err);
        }

        return () => {
            unsubscribeT();
            unsubscribeP();
            unsubscribeG();
        };
    }, []);

    // Função auxiliar para verificar se o player está online com segurança
    const isPlayerOnline = (lastSeen) => {
        if (!lastSeen) return false;
        try {
            const lastSeenMs = lastSeen.seconds ? lastSeen.seconds * 1000 : new Date(lastSeen).getTime();
            return !isNaN(lastSeenMs) && (Date.now() - lastSeenMs < 60000);
        } catch (e) {
            return false;
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

        // Validar Quota
        const validation = canCreateTerminal(userData, terminals.length);
        if (!validation.can) {
            alert(validation.reason);
            // Opcional: Redirecionar para planos ou abrir modal de upgrade
            return;
        }

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
                powerMode: 'auto',
                assignedPlaylistId: '',
                ownerId: currentUser.uid // Importante para multi-tenant futuro
            });
            setNewName('');
            setNewGroup('');
            setIsAdding(false);
        } catch (error) {
            console.error(error);
            alert("Erro ao criar terminal.");
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
                        onClick={() => {
                            if (!isAdding && !terminalValidation.can) {
                                alert(terminalValidation.reason);
                                return;
                            }
                            setIsAdding(!isAdding);
                        }}
                        className={`flex items-center space-x-2 px-4 py-2.5 rounded-lg transition-colors font-medium shadow-md text-sm ${isAdding
                            ? 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            : (!terminalValidation.can
                                ? 'bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300'
                                : 'bg-blue-600 hover:bg-blue-700 text-white')
                            }`}
                        title={!isAdding && !terminalValidation.can ? terminalValidation.reason : ''}
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
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex justify-between items-center">
                                Grupo
                                <button
                                    type="button"
                                    onClick={() => setIsGroupManagerOpen(true)}
                                    className="text-[10px] text-blue-600 hover:text-blue-800 flex items-center gap-1"
                                >
                                    <Settings className="w-3 h-3" /> Gerenciar
                                </button>
                            </label>
                            <select
                                value={newGroup}
                                onChange={(e) => setNewGroup(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 text-slate-700"
                            >
                                <option value="">Selecione um grupo...</option>
                                <option value="Default">Default</option>
                                {availableGroups.filter(g => g !== 'Default').map(g => (
                                    <option key={g} value={g}>{g}</option>
                                ))}
                            </select>
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

            <GroupManagerModal
                isOpen={isGroupManagerOpen}
                onClose={() => setIsGroupManagerOpen(false)}
                currentTerminalGroups={[...new Set(terminals.map(t => t.group))]}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
                {terminals
                    .filter(t => filterGroup === 'Todos' || t.group === filterGroup)
                    .map(t => (
                        <TerminalCard
                            key={t.id}
                            terminal={t}
                            playlists={playlists}
                            availableGroups={availableGroups}
                            onAssignPlaylist={handleAssignPlaylist}
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
