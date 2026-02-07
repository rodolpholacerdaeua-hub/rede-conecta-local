import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../supabase';
import { getDocument, updateDocument } from '../db';

/**
 * Player Standalone - O "Coração" do sistema nos totens.
 * Focado em performance, estabilidade e modo offline (CacheStorage).
 */
const Player = () => {
    const { terminalId } = useParams();
    const [terminal, setTerminal] = useState(null);
    const [campaigns, setCampaigns] = useState([]);
    const [currentMedia, setCurrentMedia] = useState(null);
    const [index, setIndex] = useState(0);
    const [error, setError] = useState(null);
    const [status, setStatus] = useState('Iniciando...');
    const [isPoweredOn, setIsPoweredOn] = useState(true);

    const playlistRef = useRef([]);
    const timerRef = useRef(null);
    const terminalRef = useRef(null);
    const currentMediaRef = useRef(null);

    // Função para verificar se a tela deve estar ligada baseado em horário e comandos
    const checkPowerStatus = (termData) => {
        if (!termData) return true;

        const mode = termData.powerMode || 'auto';

        const ensureLeadingZero = (time) => {
            if (!time) return "00:00";
            return time.includes(':') && time.split(':')[0].length === 1 ? `0${time}` : time;
        };

        // 1. Force ON
        if (mode === 'on') return true;

        // 2. Force OFF
        if (mode === 'off') return false;

        // 3. Modo AUTO (Respeita Agenda)
        const now = new Date();
        const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

        const open = ensureLeadingZero(termData.openingTime || "08:00");
        const close = ensureLeadingZero(termData.closingTime || "22:00");

        if (open <= close) {
            return currentTime >= open && currentTime <= close;
        } else {
            return currentTime >= open || currentTime <= close;
        }
    };

    // 1. Sincronização do Terminal e Heartbeat
    useEffect(() => {
        if (!terminalId) {
            setError('ID do Terminal não fornecido.');
            return;
        }

        setStatus('Conectando ao Terminal...');

        // Função de Heartbeat Centralizada ("Turbo")
        const sendHeartbeat = async (extraData = {}) => {
            try {
                const now = Date.now();
                await updateDocument('terminals', terminalId, {
                    last_seen: new Date().toISOString(),
                    status: 'online',
                    heartbeat_counter: (terminalRef.current?.heartbeat_counter || 0) + 1,
                    ...extraData
                });
                console.log("💓 [ECO-EARS] Batimento enviado:", now);
            } catch (e) {
                console.warn("Heartbeat failed", e);
            }
        };

        // Fetch inicial
        const fetchTerminal = async () => {
            try {
                const { data, error } = await supabase
                    .from('terminals')
                    .select('*')
                    .eq('id', terminalId)
                    .single();

                if (error) throw error;
                if (data) {
                    const power = checkPowerStatus(data);
                    setTerminal({ id: data.id, ...data });
                    terminalRef.current = { id: data.id, ...data, isPoweredOn: power };
                    setIsPoweredOn(power);
                    setStatus(power ? 'Terminal Ativo' : 'Standby (Fora de Horário)');
                } else {
                    setError('Terminal não encontrado no banco de dados.');
                }
            } catch (err) {
                console.error("Player Error:", err);
                setError(`Erro de conexão: ${err.message}`);
            }
        };

        // Heartbeat Inicial (Imediato na montagem)
        sendHeartbeat();
        fetchTerminal();

        // Realtime subscription
        const channel = supabase
            .channel(`terminal-player-${terminalId}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'terminals',
                filter: `id=eq.${terminalId}`
            }, (payload) => {
                if (payload.new) {
                    const data = payload.new;
                    const power = checkPowerStatus(data);

                    const oldPower = terminalRef.current?.isPoweredOn;
                    const oldPlaylist = terminalRef.current?.active_playlist_id;

                    setTerminal({ id: data.id, ...data });
                    terminalRef.current = { id: data.id, ...data, isPoweredOn: power };
                    setIsPoweredOn(power);
                    setStatus(power ? 'Terminal Ativo' : 'Standby (Fora de Horário)');

                    // [ECO-EARS] Escuta ativa
                    const hasCommandChanged = oldPower !== undefined && (
                        oldPower !== power ||
                        oldPlaylist !== data.active_playlist_id ||
                        terminalRef.current?.is_monitoring !== data.is_monitoring
                    );

                    if (hasCommandChanged) {
                        console.log("⚡ [REACTIVE-EARS] Comando recebido da central! Respondendo AGORA...");
                        if (!terminalRef.current?.is_monitoring && data.is_monitoring && currentMediaRef.current) {
                            const media = currentMediaRef.current;
                            sendHeartbeat({
                                current_media_name: media.itemType === 'campaign' ? (media.campaignName || 'Campanha') : 'Mídia Direta',
                                current_media_url: media.url,
                                current_media_type: media.type,
                                last_monitor_update: new Date().toISOString()
                            });
                        } else {
                            sendHeartbeat();
                        }
                    }

                    if (power && !timerRef.current && playlistRef.current.length > 0) {
                        console.log("🎬 [REPLAY] Retomando reprodução após comando de ativação.");
                        playNext();
                    }

                    if (!power && timerRef.current) {
                        console.log("🛑 [STANDBY] Parando reprodução por comando ou agenda.");
                        clearTimeout(timerRef.current);
                        timerRef.current = null;
                    }
                }
            })
            .subscribe();

        // Loop de Heartbeat e Auto-reparo de Status (A cada 30s)
        const heartbeat = setInterval(() => {
            sendHeartbeat();

            if (terminalRef.current) {
                const power = checkPowerStatus(terminalRef.current);
                const currentPower = terminalRef.current.isPoweredOn;

                if (power !== currentPower) {
                    console.log(`⏱️ [TURBO] Horário de operação mudou. Novo estado: ${power ? 'ON' : 'OFF'}`);
                    setIsPoweredOn(power);
                    terminalRef.current.isPoweredOn = power;
                    setStatus(power ? 'Terminal Ativo' : 'Standby (Fora de Horário)');

                    if (power && !timerRef.current && playlistRef.current.length > 0) {
                        playNext();
                    }
                }
            }
        }, 30000);

        return () => {
            supabase.removeChannel(channel);
            clearInterval(heartbeat);
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, [terminalId]);

    // 2. Busca de Playlist ou Campanhas Diretas
    useEffect(() => {
        if (!terminal) return;

        let unsubscribePlaylist = () => { };
        let unsubscribeFallback = () => { };

        if (terminal.assignedPlaylistId) {
            setStatus(isPoweredOn ? 'Carregando Playlist...' : 'Standby');
            const playlistDocRef = doc(db, "playlists", terminal.assignedPlaylistId);
            unsubscribePlaylist = onSnapshot(playlistDocRef, async (snap) => {
                if (snap.exists()) {
                    const data = snap.data();

                    const local = data.localItems || [];
                    const global = data.globalItems || [];
                    const combined = [...local, ...global];
                    const validItems = [];
                    for (const item of combined) {
                        try {
                            if (item.type === 'campaign') {
                                const campRef = doc(db, "campaigns", item.id);
                                const campSnap = await getDoc(campRef);
                                if (campSnap.exists() && campSnap.data().moderation_status === 'approved') {
                                    validItems.push(item);
                                } else {
                                    console.log(`Player: Campanha ${item.id} ignorada por falta de aprovação.`);
                                }
                            } else {
                                validItems.push(item);
                            }
                        } catch (err) { console.error("Erro ao validar item da playlist:", err); }
                    }

                    const newPlaylist = validItems.map(item => ({
                        campaignId: item.type === 'campaign' ? item.id : null,
                        mediaId: item.type === 'media' ? item.id : null,
                        url: item.url || null,
                        type: item.mediaType || 'image',
                        duration: item.duration || (item.mediaType === 'video' ? 0 : 10),
                        itemType: item.type,
                        sortId: item.sortId
                    }));

                    playlistRef.current = newPlaylist;

                    // Inicia apenas se estiver ligado e não tiver timer ativo
                    if (isPoweredOn && !timerRef.current && newPlaylist.length > 0) {
                        playNext();
                    }
                } else {
                    setupFallback();
                }
            });
        } else {
            setupFallback();
        }

        function setupFallback() {
            if (!isPoweredOn) return;
            setStatus('Buscando campanhas (Fallback)...');
            const q = query(
                collection(db, "campaigns"),
                or(
                    where("targetTerminals", "array-contains", terminalId),
                    where("isGlobal", "==", true)
                ),
                where("is_active", "==", true),
                where("moderation_status", "==", "approved")
            );

            unsubscribeFallback = onSnapshot(q, (snap) => {
                const activeCampaigns = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                const newPlaylist = [];
                activeCampaigns.forEach(camp => {
                    const mediaId = camp.vMediaId || camp.hMediaId;
                    if (mediaId) {
                        newPlaylist.push({
                            campaignId: camp.id,
                            mediaId: mediaId,
                            duration: 10,
                            itemType: 'campaign'
                        });
                    }
                });

                playlistRef.current = newPlaylist;
                if (newPlaylist.length > 0 && !currentMedia) {
                    playNext();
                }
            });
        }

        return () => {
            unsubscribePlaylist();
            unsubscribeFallback();
        };
    }, [terminal?.assignedPlaylistId, terminal?.id]);

    // 3. Lógica de Rotação de Mídia e Busca de URL
    const playNext = async () => {
        if (playlistRef.current.length === 0) {
            console.log("Player: Playlist ainda vazia, tentando novamente em 5s...");
            timerRef.current = setTimeout(playNext, 5000);
            return;
        }

        const nextIndex = (index + 1) % playlistRef.current.length;
        setIndex(nextIndex);

        const nextItem = playlistRef.current[nextIndex];
        console.log("Player: Próximo item na rampa de exibição:", nextItem);

        try {
            let finalMediaId = nextItem.mediaId;
            let finalUrl = nextItem.url;
            let finalType = nextItem.type;

            // CASO A: É uma campanha (buscar mídia vertical)
            if (nextItem.itemType === 'campaign') {
                const campDoc = await getDoc(doc(db, "campaigns", nextItem.campaignId));
                if (campDoc.exists()) {
                    const campData = campDoc.data();
                    finalMediaId = campData.vMediaId || campData.hMediaId;
                    console.log(`Player: Item é Campanha "${campData.name}". MediaId selecionado:`, finalMediaId);
                }
            }

            // CASO B: Temos o MediaId mas não a URL (Comum em campanhas ou mídias adicionadas via seletor)
            if (finalMediaId && !finalUrl) {
                const mediaDoc = await getDoc(doc(db, "media", finalMediaId));
                if (mediaDoc.exists()) {
                    const mediaData = mediaDoc.data();
                    finalUrl = mediaData.url;
                    finalType = mediaData.type;
                }
            }

            if (finalUrl) {
                const mediaState = {
                    ...nextItem,
                    url: finalUrl,
                    type: finalType
                };
                setCurrentMedia(mediaState);
                currentMediaRef.current = mediaState;

                // Reportar ao banco apenas se houver solicitação de monitoramento
                const mediaName = nextItem.itemType === 'campaign' ? (nextItem.campaignName || 'Campanha') : 'Mídia Direta';

                // Sempre atualiza o texto de status para o painel não ficar "Aguardando"
                const updatePayload = {
                    currentMedia: mediaName // Texto simples para a barra de status
                };

                // Reportar dados pesados de monitoramento apenas se houver solicitação
                if (terminalRef.current?.isMonitoring) {
                    console.log("📡 [ECO-LIVE] Reportando status de reprodução sob demanda...");
                    updatePayload.currentMediaName = mediaName;
                    updatePayload.currentMediaUrl = finalUrl;
                    updatePayload.currentMediaType = finalType;
                    updatePayload.lastMonitorUpdate = serverTimestamp();
                }

                await updateDoc(doc(db, "terminals", terminalId), updatePayload);

            } else {
                console.warn("Player: Falha grave - não conseguimos resolver URL para este item. Pulando...", nextItem);
                playNext(); // Pula para o próximo imediatamente
                return;
            }
        } catch (e) {
            console.error("Player: Erro catastrófico ao processar rotação:", e);
            timerRef.current = setTimeout(playNext, 3000); // Tenta de novo em 3s
            return;
        }

        // Agendar próxima troca baseada na duração
        const duration = (nextItem.duration || 10) * 1000;
        timerRef.current = setTimeout(playNext, duration);
    };

    if (error) {
        return (
            <div className="h-screen w-screen bg-black text-white flex flex-col items-center justify-center p-10 text-center font-['Outfit']">
                <div className="bg-red-600/20 p-6 rounded-[2rem] border border-red-600 mb-6">
                    <span className="text-6xl mb-4 block">⚠️</span>
                    <h1 className="text-2xl font-black uppercase mb-2">Erro Crítico do Player</h1>
                    <p className="text-red-400 font-bold">{error}</p>
                </div>
                <p className="text-slate-500 text-xs uppercase tracking-widest">Aguardando reinicialização ou intervenção do suporte</p>
            </div>
        );
    }

    return (
        <div className="h-screen w-screen bg-black overflow-hidden flex items-center justify-center transition-all duration-700">
            {!isPoweredOn ? (
                <div className="flex flex-col items-center space-y-4 animate-pulse">
                    <div className="w-2 h-2 bg-red-900 rounded-full" />
                    <p className="text-slate-900 font-bold tracking-[0.5em] text-[8px] uppercase Outfit">Standby Mode</p>
                </div>
            ) : !currentMedia ? (
                <div className="flex flex-col items-center space-y-4">
                    <div className="w-12 h-12 border-4 border-indigo-900 border-t-indigo-500 rounded-full animate-spin" />
                    <p className="text-indigo-500 font-bold tracking-widest text-[10px] uppercase Outfit">{status}</p>
                </div>
            ) : (
                <div className="relative w-full h-full flex items-center justify-center animate-fade-in">
                    {currentMedia.type === 'video' ? (
                        <video
                            key={currentMedia.url}
                            src={currentMedia.url}
                            autoPlay
                            muted
                            playsInline
                            className="w-full h-full object-cover"
                            onEnded={() => {/* Opcional: callback de término */ }}
                            onError={(e) => {
                                console.error("Erro ao reproduzir vídeo:", e);
                                // Força pular se der erro (fallback de segurança)
                                if (timerRef.current) clearTimeout(timerRef.current);
                                playNext();
                            }}
                        />
                    ) : (
                        <img
                            key={currentMedia.url}
                            src={currentMedia.url}
                            alt=""
                            className="w-full h-full object-cover"
                        />
                    )}

                    {/* Barra de progresso discreta no fundo */}
                    <div
                        key={`progress-${index}`}
                        className="absolute bottom-0 left-0 h-1 bg-indigo-600 transition-all duration-1000 linear"
                        style={{ width: '0%', animation: `progress ${(currentMedia.duration || 10)}s linear forwards` }}
                    ></div>
                </div>
            )}

            <style>{`
                @keyframes progress {
                    from { width: 0%; }
                    to { width: 100%; }
                }
                .animate-fade-in {
                    animation: fadeIn 0.8s ease-out forwards;
                }
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
            `}</style>
        </div>
    );
};

export default Player;
