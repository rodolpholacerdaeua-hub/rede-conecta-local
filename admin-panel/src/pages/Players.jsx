import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { canCreateTerminal, getPlanQuota, getEffectivePlanQuota, isAdmin } from '../utils/planHelpers';
import { db, getDocument, updateDocument, createDocument, deleteDocument, subscribeToCollection } from '../db';
import { supabase } from '../supabase';
import { Monitor, Cpu, Thermometer, HardDrive, Zap, Power, Play, Plus, Search, Filter, Layers, Users, Settings, CreditCard, Info, QrCode, Trash2, AlertTriangle, RotateCw } from 'lucide-react';

import GroupManagerModal from '../components/GroupManagerModal';
import CheckoutModal from '../components/CheckoutModal';
import ScreenAlertsPanel from '../components/ScreenAlertsPanel';

// Componente isolado para o Mini-Player
const MiniPlayerPreview = ({ terminal, activePlaylist, onClose }) => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [currentUrl, setCurrentUrl] = useState(null);
    const [mediaType, setMediaType] = useState('image');
    const [loading, setLoading] = useState(true);

    // Preparar itens da playlist, FILTRANDO incompatíveis
    const items = React.useMemo(() => {
        if (!activePlaylist) return [];
        const rawItems = [...(activePlaylist.localItems || []), ...(activePlaylist.globalItems || [])];

        return rawItems.filter(item => {
            // Se for Mídia Direta (Base), a orientação DEVE bater (se definida)
            if (item.type === 'media' && item.orientation && terminal.orientation) {
                return item.orientation === terminal.orientation;
            }
            // Campanhas são consideradas compatíveis a princípio (filter late)
            return true;
        }).sort((a, b) => (a.sortId || 0) - (b.sortId || 0));
    }, [activePlaylist, terminal.orientation]);

    // Efeito de Rotação e Busca de URL
    useEffect(() => {
        if (items.length === 0) {
            setLoading(false);
            return;
        }

        let isMounted = true;
        const currentItem = items[currentIndex];

        const fetchMedia = async () => {
            setLoading(true);
            try {
                let url = currentItem.url;
                let type = currentItem.mediaType || 'image';

                // Se não tem URL direta (ex: campanha), busca no banco via Supabase
                if (!url) {
                    if (currentItem.type === 'campaign') {
                        const campData = await getDocument('campaigns', currentItem.id);
                        if (campData) {
                            const mediaId = terminal.orientation === 'vertical' ? campData.vMediaId : campData.hMediaId;
                            if (mediaId) {
                                const mediaData = await getDocument('media', mediaId);
                                if (mediaData) {
                                    url = mediaData.url;
                                    type = mediaData.type;
                                }
                            }
                        }
                    } else if (currentItem.type === 'media') {
                        // Fallback para mídia direta se necessário
                        const mediaData = await getDocument('media', currentItem.id);
                        if (mediaData) {
                            url = mediaData.url;
                            type = mediaData.type;
                        }
                    }
                }

                if (isMounted) {
                    if (!url) {
                        console.warn(`[SIMULADOR] Pular item: Mídia não encontrada para ${currentItem.name} (${terminal.orientation})`);
                        // Se não achou url, força pular para o próximo imediatamente
                        setCurrentIndex((prev) => (prev + 1) % items.length);
                        setLoading(false);
                        return;
                    }

                    setCurrentUrl(url);
                    setMediaType(type);
                    setLoading(false);
                }
            } catch (err) {
                console.error("Erro no simulador:", err);
                if (isMounted) {
                    // Em caso de erro, tenta pular
                    setCurrentIndex((prev) => (prev + 1) % items.length);
                    setLoading(false);
                }
            }
        };

        fetchMedia();

        const duration = (currentItem.duration || 10) * 1000;
        const timer = setTimeout(() => {
            if (isMounted) {
                setCurrentIndex((prev) => (prev + 1) % items.length);
            }
        }, duration);

        return () => {
            isMounted = false;
            clearTimeout(timer);
        };
    }, [currentIndex, items, terminal.orientation]);

    if (!activePlaylist || items.length === 0) {
        return (
            <div className="mb-4 bg-slate-900 rounded-xl overflow-hidden border-2 border-indigo-500 shadow-lg p-3 aspect-video flex flex-col items-center justify-center text-slate-500 gap-2 relative">
                <Layers className="w-8 h-8 opacity-20" />
                <p className="text-[10px] font-bold">Playlist Vazia</p>
                <button
                    onClick={onClose}
                    className="absolute top-2 right-2 text-slate-500 hover:text-white"
                >
                    <Power className="w-4 h-4" />
                </button>
            </div>
        );
    }

    const currentItem = items[currentIndex];

    const isVertical = terminal.orientation === 'vertical';
    const aspectRatioClass = isVertical ? 'aspect-[9/16]' : 'aspect-video';

    return (
        <div className={`mb-4 bg-slate-900 rounded-xl overflow-hidden border-2 border-indigo-500 shadow-2xl shadow-indigo-500/20 ${aspectRatioClass} relative group flex flex-col transition-all duration-500`}>
            <div className="relative w-full h-full bg-black flex-1 flex flex-col overflow-hidden">
                {loading ? (
                    <div className="flex-1 flex flex-col items-center justify-center gap-2">
                        <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                        <p className="text-[9px] text-indigo-400 font-bold uppercase tracking-widest animate-pulse">Carregando...</p>
                    </div>
                ) : currentUrl ? (
                    <>
                        {mediaType === 'video' ? (
                            <video src={currentUrl} className="w-full h-full object-cover" autoPlay muted playsInline />
                        ) : (
                            <img src={currentUrl} className="w-full h-full object-cover animate-in fade-in duration-500" alt="Preview" />
                        )}

                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3 pt-6 pointer-events-none">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                    <span className="text-[10px] items-center font-bold text-white uppercase tracking-wider truncate max-w-[150px]">
                                        {currentItem.name || (currentItem.type === 'campaign' ? 'Campanha' : 'Conteúdo')}
                                    </span>
                                </div>
                                <span className="text-[9px] font-mono text-slate-400 bg-black/50 px-1.5 py-0.5 rounded">
                                    {currentIndex + 1} / {items.length}
                                </span>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex items-center justify-center">
                        <p className="text-[10px] text-red-400 font-bold">Erro ao carregar mídia</p>
                    </div>
                )}
            </div>

            {/* Botão Fechar Flutuante */}
            <button
                onClick={onClose}
                className="absolute top-2 right-2 bg-black/60 hover:bg-red-600 text-white p-1.5 rounded-lg transition-all opacity-0 group-hover:opacity-100 z-10 backdrop-blur-sm"
                title="Fechar Player"
            >
                <Power className="w-3 h-3" />
            </button>

            <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-indigo-600/90 text-white px-2 py-0.5 rounded-full shadow-lg z-10 backdrop-blur-sm pointer-events-none">
                <Monitor className="w-3 h-3" />
                <span className="text-[8px] font-black uppercase tracking-widest">SIMULADOR</span>
            </div>
        </div>
    );
};

const TerminalCard = ({ terminal, playlists, availableGroups, onAssignPlaylist, onUpdateField, onDelete }) => {
    const [now, setNow] = useState(new Date());
    const [localLastSync, setLocalLastSync] = useState(terminal.last_seen ? Date.now() : 0);
    const prevLastSeen = React.useRef(terminal.last_seen);

    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 5000);
        return () => clearInterval(timer);
    }, []);

    // Sync Reativo: Quando o heartbeat chega do servidor, marcamos o momento exato LOCAL da recepção
    useEffect(() => {
        const currentMs = terminal.last_seen?.toMillis ? terminal.last_seen.toMillis() : (terminal.last_seen?.seconds ? terminal.last_seen.seconds * 1000 : (terminal.last_seen ? new Date(terminal.last_seen).getTime() : 0));
        const previousMs = prevLastSeen.current?.toMillis ? prevLastSeen.current.toMillis() : (prevLastSeen.current?.seconds ? prevLastSeen.current.seconds * 1000 : (prevLastSeen.current ? new Date(prevLastSeen.current).getTime() : 0));

        // Se o timestamp mudou OU o contador de batimentos subiu, então está 100% online
        if (currentMs !== previousMs || terminal.heartbeat_counter !== prevLastSeen.current?.heartbeat_counter) {
            console.log(`📶 [PULSO] Sinal de "${terminal.name}" detectado.`);
            setLocalLastSync(Date.now());
            prevLastSeen.current = terminal;
        }
    }, [terminal.last_seen, terminal.heartbeat_counter, terminal.name]);

    const isOnline = localLastSync > 0 && (Date.now() - localLastSync < 65000);

    const getOperationalStatus = () => {
        const mode = terminal.power_mode || 'auto';

        const ensureLeadingZero = (time) => {
            if (!time) return "00:00";
            return time.includes(':') && time.split(':')[0].length === 1 ? `0${time}` : time;
        };

        const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
        const open = ensureLeadingZero(terminal.operating_start || "08:00");
        const close = ensureLeadingZero(terminal.operating_end || "22:00");
        const isWithinTime = open <= close
            ? (currentTime >= open && currentTime <= close)
            : (currentTime >= open || currentTime <= close);

        const activeDays = terminal.operating_days || [0, 1, 2, 3, 4, 5, 6];
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
                            <button
                                onClick={() => {
                                    const isVertical = terminal.orientation === 'vertical' || terminal.orientation === 'portrait';
                                    const newOrientation = isVertical ? 'landscape' : 'portrait';
                                    onUpdateField(terminal.id, 'orientation', newOrientation);
                                }}
                                className={`text-[10px] px-2 py-0.5 rounded font-black uppercase flex-shrink-0 cursor-pointer transition-all hover:scale-105 active:scale-95 ${terminal.orientation === 'vertical' || terminal.orientation === 'portrait'
                                        ? 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'
                                        : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                                    }`}
                                title="Clique para alternar orientação"
                            >
                                {terminal.orientation === 'vertical' || terminal.orientation === 'portrait' ? 'Vertical' : 'Horizontal'}
                            </button>
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

                {/* Simulador de Reprodução (Mini-Player) */}
                {terminal.isMonitoring && (() => {
                    const activePlaylist = playlists.find(p => p.id === terminal.assigned_playlist_id);
                    return (
                        <MiniPlayerPreview
                            terminal={terminal}
                            activePlaylist={activePlaylist}
                            onClose={() => onUpdateField(terminal.id, 'isMonitoring', false)}
                        />
                    );
                })()}
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
                                value={terminal.operating_start?.substring(0, 5) || terminal.openingTime || '08:00'}
                                onChange={(e) => onUpdateField(terminal.id, 'openingTime', e.target.value)}
                                className="text-[10px] bg-white border border-slate-200 rounded px-1 font-bold text-slate-600"
                            />
                            <span className="text-[10px] text-slate-300">até</span>
                            <input
                                type="time"
                                value={terminal.operating_end?.substring(0, 5) || terminal.closingTime || '22:00'}
                                onChange={(e) => onUpdateField(terminal.id, 'closingTime', e.target.value)}
                                className="text-[10px] bg-white border border-slate-200 rounded px-1 font-bold text-slate-600"
                            />
                        </div>
                    </div>

                    <div className="flex justify-between items-center gap-1">
                        {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((day, idx) => {
                            const activeDays = terminal.operating_days || terminal.activeDays || [0, 1, 2, 3, 4, 5, 6];
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
                            value={terminal.assigned_playlist_id || ''}
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
                                className={`p-1.5 rounded-lg transition-all flex-1 flex items-center justify-center ${terminal.power_mode === 'on' ? 'bg-emerald-500 text-white shadow-sm' : 'text-slate-400 hover:text-emerald-600'}`}
                                title="Forçar Ligado (Manual ON)"
                            >
                                <Zap className="w-3.5 h-3.5" />
                            </button>
                            <button
                                onClick={() => onUpdateField(terminal.id, 'powerMode', 'auto')}
                                className={`p-1.5 rounded-lg transition-all flex-1 flex items-center justify-center ${(!terminal.power_mode || terminal.power_mode === 'auto') ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-indigo-600'}`}
                                title="Modo Automático (Segue Agenda)"
                            >
                                <span className="text-[9px] font-black italic">AUTO</span>
                            </button>
                            <button
                                onClick={() => onUpdateField(terminal.id, 'powerMode', 'off')}
                                className={`p-1.5 rounded-lg transition-all flex-1 flex items-center justify-center ${terminal.power_mode === 'off' ? 'bg-red-500 text-white shadow-sm' : 'text-slate-400 hover:text-red-600'}`}
                                title="Forçar Standby (Manual OFF)"
                            >
                                <Power className="w-3.5 h-3.5" />
                            </button>
                        </div>
                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => {
                                    const newState = !terminal.isMonitoring;
                                    onUpdateField(terminal.id, 'isMonitoring', newState);
                                }}
                                className={`p-2 rounded-lg transition-all shadow-sm ${terminal.isMonitoring ? 'bg-indigo-600 text-white' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'}`}
                                title={terminal.isMonitoring ? "Ocultar Grade" : "Ver Grade de Reprodução Ativa"}
                            >
                                <Monitor className="w-4 h-4" />
                            </button>
                            <button
                                onClick={() => onDelete(terminal.id, terminal.name)}
                                className="p-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-all shadow-sm"
                                title="Excluir Terminal"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            <style>{`
                .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; border-radius: 10px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #475569; }
            `}</style>
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
    const [pairingCode, setPairingCode] = useState(''); // Estado para o código de pareamento
    const [orientation, setOrientation] = useState('horizontal');
    const [filterGroup, setFilterGroup] = useState('Todos');
    const [isBulkAssign, setIsBulkAssign] = useState(false);
    const [bulkPlaylistId, setBulkPlaylistId] = useState('');
    const [bulkGroup, setBulkGroup] = useState('');
    const [isGroupManagerOpen, setIsGroupManagerOpen] = useState(false);
    const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
    const [availableGroups, setAvailableGroups] = useState([]);

    const terminalValidation = canCreateTerminal(userData, terminals.length);

    // Derivar grupos totais (da coleção + ad-hoc dos terminais)
    const allGroups = React.useMemo(() => {
        const fromTerminals = terminals.map(t => t.group).filter(Boolean);
        return [...new Set(['Default', ...availableGroups, ...fromTerminals])].sort();
    }, [availableGroups, terminals]);

    const [error, setError] = useState(null);

    useEffect(() => {
        let isMounted = true;
        console.log("Players: Iniciando listeners Supabase...");

        // Carregar dados iniciais
        const loadData = async () => {
            try {
                // Carregar terminais
                const { data: terminalsData, error: tError } = await supabase
                    .from('terminals')
                    .select('*')
                    .order('name');

                if (tError) throw tError;
                if (isMounted) {
                    console.log(`Players: ${terminalsData?.length || 0} terminais carregados.`);
                    setTerminals(terminalsData || []);
                    setError(null);
                }

                // Carregar playlists
                const { data: playlistsData, error: pError } = await supabase
                    .from('playlists')
                    .select('*')
                    .order('created_at', { ascending: false });

                if (pError) console.error("Players: Erro ao carregar playlists:", pError);
                if (isMounted) setPlaylists(playlistsData || []);

                // Carregar grupos (se tabela existir)
                try {
                    const { data: groupsData } = await supabase
                        .from('terminal_groups')
                        .select('name')
                        .order('name');

                    if (isMounted && groupsData) {
                        const structuredGroups = groupsData.map(g => g.name);
                        console.log(`Players: ${structuredGroups.length} grupos carregados.`);
                        setAvailableGroups([...new Set(structuredGroups)]);
                    }
                } catch (gErr) {
                    console.log("Players: Tabela de grupos não disponível (ok)");
                }
            } catch (err) {
                console.error("Players: Erro ao carregar dados:", err);
                if (isMounted) setError(`Erro ao carregar dados: ${err.message}`);
            }
        };

        loadData();

        // Configurar realtime para terminais com status callbacks
        const terminalsChannel = supabase
            .channel('terminals-realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'terminals' }, (payload) => {
                console.log('[REALTIME] Terminal change:', payload.eventType, payload);
                if (isMounted) {
                    loadData(); // Recarregar dados
                }
            })
            .subscribe((status, err) => {
                if (status === 'SUBSCRIBED') {
                    console.log('[REALTIME] ✅ Conectado ao canal terminals-realtime');
                } else if (status === 'CHANNEL_ERROR') {
                    console.error('[REALTIME] ❌ Erro no canal:', err);
                } else if (status === 'TIMED_OUT') {
                    console.warn('[REALTIME] ⚠️ Timeout na conexão');
                } else {
                    console.log('[REALTIME] Status:', status);
                }
            });

        // Também escutar mudanças em playlists para atualizar a lista
        const playlistsChannel = supabase
            .channel('playlists-realtime-players')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'playlists' }, (payload) => {
                console.log('[REALTIME] Playlist change:', payload.eventType);
                if (isMounted) {
                    loadData();
                }
            })
            .subscribe();

        return () => {
            isMounted = false;
            supabase.removeChannel(terminalsChannel);
            supabase.removeChannel(playlistsChannel);
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
            await updateDocument('terminals', terminalId, { assigned_playlist_id: playlistId || null });
            // Optimistic UI: atualizar estado local imediatamente
            setTerminals(prev => prev.map(t =>
                t.id === terminalId ? { ...t, assigned_playlist_id: playlistId || null } : t
            ));
        } catch (e) {
            console.error(e);
            alert('Erro ao atribuir playlist: ' + e.message);
        }
    };

    const handleUpdateField = async (terminalId, field, value) => {
        try {
            // Mapear campos camelCase para snake_case do banco
            const fieldMap = {
                'openingTime': 'operating_start',
                'closingTime': 'operating_end',
                'activeDays': 'operating_days',
                'powerMode': 'power_mode',
                'currentMedia': 'current_media'
            };
            const dbField = fieldMap[field] || field;

            console.log(`[UPDATE] Terminal ${terminalId} | Field: ${field} -> ${dbField} | Value:`, value);
            await updateDocument('terminals', terminalId, { [dbField]: value });
            console.log(`[UPDATE] Success for ${dbField}`);

            // Optimistic UI: atualizar estado local
            setTerminals(prev => prev.map(t =>
                t.id === terminalId ? { ...t, [dbField]: value } : t
            ));
        } catch (e) {
            console.error(`[UPDATE] FAILED for ${field}:`, e);
            alert(`Erro ao atualizar ${field}: ${e.message || 'Erro desconhecido'}\n\nVerifique as permissões ou tente novamente.`);
        }
    };

    const handleBulkAssign = async () => {
        if (!bulkGroup || !bulkPlaylistId) return;

        // --- VALIDAÇÃO DE INTEGRIDADE (Orientação) ---
        const selectedPlaylist = playlists.find(p => p.id === bulkPlaylistId);
        const targets = terminals.filter(t => t.group === bulkGroup);

        if (selectedPlaylist && targets.length > 0) {
            // Verificar conteúdo da Playlist
            const allItems = [...(selectedPlaylist.localItems || []), ...(selectedPlaylist.globalItems || [])];
            const hasVerticalUniqueContent = allItems.some(i => i.type === 'media' && i.orientation === 'vertical');
            const hasHorizontalUniqueContent = allItems.some(i => i.type === 'media' && i.orientation === 'horizontal');

            // Verificar terminais alvo
            const hasVerticalTargets = targets.some(t => t.orientation === 'vertical');
            const hasHorizontalTargets = targets.some(t => t.orientation === 'horizontal');

            // Lógica de Bloqueio
            if (hasVerticalUniqueContent && hasHorizontalTargets) {
                if (!window.confirm(`⚠️ AVISO DE INCOMPATIBILIDADE\n\nA playlist "${selectedPlaylist.name}" contém mídia VERTICAL, mas o grupo "${bulkGroup}" possui terminais HORIZONTAIS.\n\nEsses conteúdos serão pulados ou distorcidos nessas telas.\nDeseja aplicar mesmo assim?`)) {
                    return;
                }
            }
            if (hasHorizontalUniqueContent && hasVerticalTargets) {
                if (!window.confirm(`⚠️ AVISO DE INCOMPATIBILIDADE\n\nA playlist "${selectedPlaylist.name}" contém mídia HORIZONTAL, mas o grupo "${bulkGroup}" possui terminais VERTICAIS.\n\nEsses conteúdos serão pulados ou distorcidos nessas telas.\nDeseja aplicar mesmo assim?`)) {
                    return;
                }
            }
        }
        // ---------------------------------------------

        try {
            const promises = targets.map(t =>
                updateDocument('terminals', t.id, { assigned_playlist_id: bulkPlaylistId })
            );
            await Promise.all(promises);
            setIsBulkAssign(false);
            setBulkPlaylistId('');
            setBulkGroup('');
            alert(`Playlist aplicada com sucesso a ${targets.length} terminais do grupo ${bulkGroup}.`);
        } catch (e) {
            console.error(e);
            alert("Erro ao aplicar em massa.");
        }
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        if (!newName) return;

        // Validar Quota
        const validation = canCreateTerminal(userData, terminals.length);
        if (!validation.can) {
            setIsCheckoutOpen(true);
            return;
        }

        try {
            // Verificar Pareamento (se informado)
            let hwId = null;
            let pairingRecord = null;
            if (pairingCode) {
                const cleanCode = pairingCode.trim().toUpperCase();

                // Buscar pelo campo 'code' (não por id)
                const { data: codeData, error: codeError } = await supabase
                    .from('pairing_codes')
                    .select('*')
                    .eq('code', cleanCode)
                    .single();

                if (codeError || !codeData || codeData.status !== 'pending') {
                    alert("Código de pareamento inválido ou expirado. Verifique o código na tela da TV.");
                    return;
                }
                hwId = codeData.hardware_id || null;
                pairingRecord = codeData;
            }

            // Mapear orientação UI -> DB
            const dbOrientation = orientation === 'vertical' ? 'portrait' : 'landscape';

            const newTerminal = await createDocument('terminals', {
                name: newName,
                group: newGroup || 'Default',
                orientation: dbOrientation,
                last_seen: new Date().toISOString(),
                metrics: { temp: "---", cpu: "---", disk: "---", freeSpace: "---" },
                status: 'online',
                current_media: 'Aguardando sincronia...',
                created_at: new Date().toISOString(),
                power_mode: 'auto',
                assigned_playlist_id: null,
                hardware_id: hwId,
                owner_id: currentUser.id
            });

            // Se houve pareamento, confirmar o vínculo usando o id do registro
            if (pairingRecord && newTerminal?.id) {
                await updateDocument('pairing_codes', pairingRecord.id, {
                    terminal_id: newTerminal.id,
                    status: 'paired',
                    paired_at: new Date().toISOString()
                });
            }

            // Optimistic UI: Adicionar terminal à lista local imediatamente
            if (newTerminal) {
                setTerminals(prev => [...prev, newTerminal]);
            }

            setNewName('');
            setNewGroup('');
            setPairingCode('');
            setIsAdding(false);
            alert("Terminal criado e PAREADO com sucesso! O player deve iniciar em instantes.");
        } catch (error) {
            console.error("Erro detalhado:", error);
            alert(`Erro ao criar terminal: ${error.message}`);
        }
    };

    const handleDeleteTerminal = async (id, name) => {
        if (!window.confirm(`Tem certeza que deseja excluir o terminal "${name}"? Esta ação não pode ser desfeita.`)) return;
        try {
            await deleteDocument('terminals', id);
        } catch (e) {
            console.error(e);
            alert("Erro ao excluir terminal.");
        }
    };

    return (
        <div className="space-y-6">
            {error && (
                <div className="bg-red-50 border border-red-200 p-4 rounded-xl text-red-800 text-sm font-bold flex items-center space-x-3 animate-in fade-in slide-in-from-top-2">
                    <AlertTriangle className="w-5 h-5" />
                    <span>{error}</span>
                </div>
            )}

            {/* V14.3.1: Painel de Alertas de Anomalias */}
            <ScreenAlertsPanel terminals={terminals} />

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
                                setIsCheckoutOpen(true);
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

            {/* Dashboard Stats & Plan Info */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-gradient-to-br from-indigo-600 to-blue-700 rounded-2xl p-6 text-white shadow-lg overflow-hidden relative">
                    <div className="relative z-10">
                        <div className="flex justify-between items-start mb-6">
                            <div>
                                <h3 className="text-indigo-100 text-xs font-black uppercase tracking-widest mb-1">Status da Rede</h3>
                                <div className="text-3xl font-black">{terminals.length} <span className="text-sm font-normal opacity-80 uppercase tracking-tighter">Terminais ativos</span></div>
                            </div>
                            <div className="p-3 bg-white/10 rounded-xl backdrop-blur-md">
                                <Monitor className="w-6 h-6 text-white" />
                            </div>
                        </div>

                        <div className="space-y-4">
                            {/* Só mostra barra de quota para não-admins */}
                            {!isAdmin(userData) && (
                                <div>
                                    <div className="flex justify-between items-end mb-2">
                                        <span className="text-xs font-bold text-indigo-100 flex items-center gap-1">
                                            Quota de Telas: {terminals.length} de {userData?.plan === 'unlimited' ? '∞' : getPlanQuota(userData?.plan)}
                                        </span>
                                        <span className="text-xs font-black">{Math.min(100, (terminals.length / (getPlanQuota(userData?.plan) || 1)) * 100).toFixed(0)}%</span>
                                    </div>
                                    <div className="h-2 w-full bg-white/20 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full transition-all duration-1000 ${terminals.length >= getPlanQuota(userData?.plan) ? 'bg-amber-400' : 'bg-emerald-400'}`}
                                            style={{ width: `${Math.min(100, (terminals.length / (getPlanQuota(userData?.plan) || 1)) * 100)}%` }}
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Admin vê apenas total de terminais */}
                            {isAdmin(userData) && (
                                <div className="flex items-center gap-2 text-xs font-bold text-indigo-100">
                                    <Monitor className="w-4 h-4" />
                                    <span>Total de Telas: {terminals.length} (Acesso Ilimitado)</span>
                                </div>
                            )}

                            {/* Alerta de upgrade só para não-admins */}
                            {!isAdmin(userData) && terminals.length >= getPlanQuota(userData?.plan) && userData?.plan !== 'unlimited' && (
                                <div className="bg-white/10 backdrop-blur-sm p-3 rounded-lg border border-white/10 flex items-center justify-between gap-3 animate-pulse">
                                    <div className="flex items-center gap-2">
                                        <Info className="w-4 h-4 text-amber-300" />
                                        <p className="text-[11px] font-medium text-white">Você atingiu o limite do seu plano. Adquira mais telas.</p>
                                    </div>
                                    <button
                                        onClick={() => setIsCheckoutOpen(true)}
                                        className="px-3 py-1.5 bg-white text-blue-700 text-[10px] font-black rounded-lg uppercase whitespace-nowrap"
                                    >
                                        Upgrade
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                    {/* Elementos decorativos de fundo */}
                    <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-3xl" />
                    <div className="absolute -top-10 -left-10 w-24 h-24 bg-blue-400/20 rounded-full blur-2xl" />
                </div>

                <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col justify-between">
                    <div>
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Plano Atual</h3>
                            <div className="p-2 bg-slate-50 rounded-lg">
                                <CreditCard className="w-4 h-4 text-slate-400" />
                            </div>
                        </div>
                        <div className="text-2xl font-black text-slate-800 uppercase tracking-tighter">{userData?.plan || 'START'}</div>
                        <p className="text-xs text-slate-500 mt-1">Faturamento mensal em {new Date().toLocaleDateString('pt-BR', { month: 'long' })}</p>
                    </div>

                    <button
                        onClick={() => setIsCheckoutOpen(true)}
                        className="mt-6 w-full py-3 bg-slate-50 hover:bg-slate-100 text-slate-600 font-bold text-xs rounded-xl border border-slate-200 transition-all flex items-center justify-center gap-2"
                    >
                        Gerenciar Assinatura
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
                    {['Todos', ...allGroups].map(g => (
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
                                {allGroups.map(g => (
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
                                {allGroups.filter(g => g !== 'Default').map(g => (
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

                        <div className="flex-1 space-y-2 min-w-[140px]">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                                Cód. Pareamento
                            </label>
                            <div className="relative">
                                <input
                                    type="text"
                                    value={pairingCode}
                                    onChange={(e) => setPairingCode(e.target.value.toUpperCase())}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 pl-8 text-sm outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-indigo-600 font-bold uppercase"
                                    placeholder="APP..."
                                    maxLength={8}
                                />
                                <QrCode className="w-4 h-4 text-indigo-400 absolute left-2.5 top-2.5" />
                            </div>
                        </div>
                        <button type="submit" className="bg-blue-600 text-white px-6 py-2.5 rounded-lg font-black hover:bg-blue-700 shadow-sm transition-all uppercase text-xs tracking-widest"> Cadastrar </button>
                    </form>
                </div>
            )}

            <CheckoutModal
                isOpen={isCheckoutOpen}
                onClose={() => setIsCheckoutOpen(false)}
                userData={userData}
            />

            <GroupManagerModal
                isOpen={isGroupManagerOpen}
                onClose={() => setIsGroupManagerOpen(false)}
                currentTerminalGroups={[...new Set(terminals.map(t => t.group))]}
            />

            <div className="space-y-12">
                {allGroups
                    .filter(g => filterGroup === 'Todos' || g === filterGroup)
                    .map(groupName => {
                        const groupTerminals = terminals.filter(t => t.group === groupName || (!t.group && groupName === 'Default'));
                        if (groupTerminals.length === 0) return null;

                        return (
                            <div key={groupName} className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
                                <div className="flex items-center gap-3 px-2">
                                    <div className="bg-slate-800 text-white p-2 rounded-xl shadow-lg shadow-slate-200">
                                        <Users className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-black text-slate-800 Outfit uppercase tracking-tight leading-none">{groupName}</h3>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1 italic">{groupTerminals.length} {groupTerminals.length === 1 ? 'Terminal ativo' : 'Terminais ativos'}</p>
                                    </div>
                                    <div className="h-px bg-slate-100 flex-1 ml-4" />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
                                    {groupTerminals.map(t => (
                                        <TerminalCard
                                            key={t.id}
                                            terminal={t}
                                            playlists={playlists}
                                            availableGroups={allGroups}
                                            onAssignPlaylist={handleAssignPlaylist}
                                            onUpdateField={handleUpdateField}
                                            onDelete={handleDeleteTerminal}
                                        />
                                    ))}
                                </div>
                            </div>
                        );
                    })
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
