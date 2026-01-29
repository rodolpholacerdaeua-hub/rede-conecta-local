import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { db } from '../firebase';
import { doc, onSnapshot, collection, query, where, updateDoc, serverTimestamp, getDoc, or } from 'firebase/firestore';

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
        const docRef = doc(db, "terminals", terminalId);

        const unsubscribe = onSnapshot(docRef, (snap) => {
            if (snap.exists()) {
                const data = snap.data();
                const power = checkPowerStatus(data);

                setTerminal({ id: snap.id, ...data });
                setIsPoweredOn(power);
                setStatus(power ? 'Terminal Ativo' : 'Standby (Fora de Horário)');

                // Se desligar agora, mata o timer de rotação
                if (!power && timerRef.current) {
                    clearTimeout(timerRef.current);
                    timerRef.current = null;
                }
            } else {
                setError('Terminal não encontrado no banco de dados.');
            }
        }, (err) => {
            console.error("Player Error:", err);
            setError(`Erro de conexão: ${err.message}`);
        });

        // Loop de Heartbeat e Verificação de Horário (A cada 30s)
        const heartbeat = setInterval(async () => {
            try {
                // Notifica que está online no Firestore
                await updateDoc(docRef, {
                    lastSeen: serverTimestamp(),
                    status: 'online'
                });

                // Re-checa o status de energia baseado no tempo atual
                const checkNow = async () => {
                    const snap = await getDoc(docRef);
                    if (snap.exists()) {
                        const data = snap.data();
                        const power = checkPowerStatus(data);

                        setIsPoweredOn(power);
                        setStatus(power ? 'Terminal Ativo' : 'Standby (Fora de Horário)');

                        if (!power && timerRef.current) {
                            clearTimeout(timerRef.current);
                            timerRef.current = null;
                        }

                        if (power && !timerRef.current && playlistRef.current.length > 0) {
                            playNext();
                        }
                    }
                };

                checkNow();

            } catch (e) {
                console.warn("Heartbeat failed", e);
            }
        }, 30000);

        return () => {
            unsubscribe();
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

                    const newPlaylist = combined.map(item => ({
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
                where("is_active", "==", true)
            );

            unsubscribeFallback = onSnapshot(q, (snap) => {
                const activeCampaigns = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                const newPlaylist = [];
                activeCampaigns.forEach(camp => {
                    const mediaId = terminal.orientation === 'vertical' ? camp.vMediaId : camp.hMediaId;
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

            // CASO A: É uma campanha (precisamos descobrir a mídia H ou V)
            if (nextItem.itemType === 'campaign') {
                const campDoc = await getDoc(doc(db, "campaigns", nextItem.campaignId));
                if (campDoc.exists()) {
                    const campData = campDoc.data();
                    finalMediaId = terminal.orientation === 'vertical' ? campData.vMediaId : campData.hMediaId;
                    console.log(`Player: Item é Campanha "${campData.name}". MediaId selecionado (${terminal.orientation}):`, finalMediaId);
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
                setCurrentMedia({
                    ...nextItem,
                    url: finalUrl,
                    type: finalType
                });
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
                            className="w-full h-full object-cover"
                            onEnded={() => {/* Opcional: callback de término */ }}
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
