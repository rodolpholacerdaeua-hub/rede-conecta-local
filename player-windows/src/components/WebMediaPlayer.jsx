import React from 'react';
import { addToLogBuffer } from '../utils/telemetry';

const CURRENT_VERSION = `V${typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0'}`;

/**
 * WebMediaPlayer — Componente de playback de mídias
 * Offline-First v17 + HTML5 Video Nativo
 */
function WebMediaPlayer({ items, terminalId, cacheMap = {} }) {
    const [currentIndex, setCurrentIndex] = React.useState(0);
    const [visible, setVisible] = React.useState(false);
    const failedItemsRef = React.useRef(new Set()); // Rastrear vídeos incompatíveis na sessão

    // Pular itens que já falharam
    const currentItem = React.useMemo(() => {
        const item = items[currentIndex];
        return item;
    }, [items, currentIndex]);

    // Estabilizar cacheMap via ref para evitar re-renders infinitos
    const cacheMapRef = React.useRef(cacheMap);
    React.useEffect(() => { cacheMapRef.current = cacheMap; }, [cacheMap]);

    const getMediaUrl = React.useCallback((item) => {
        const localPath = cacheMapRef.current[item.id];
        if (localPath && window.electronAPI?.isElectron) {
            const fileName = localPath.replace(/\\/g, '/').split('/').pop();
            return `media-cache://local/${fileName}`;
        }
        return item.url;
    }, []);

    const [playCount, setPlayCount] = React.useState(0);
    const skipToNext = React.useCallback(() => {
        console.log('[Player] Transitioning to next...');
        setVisible(false);
        setTimeout(() => {
            setCurrentIndex(prev => {
                // Pular itens que já falharam
                let next = (prev + 1) % items.length;
                let attempts = 0;
                while (failedItemsRef.current.has(items[next]?.id) && attempts < items.length) {
                    next = (next + 1) % items.length;
                    attempts++;
                }
                return next;
            });
            setPlayCount(c => c + 1);
        }, 300);
    }, [items]);

    // Registrar log de exibição
    React.useEffect(() => {
        if (!currentItem || !terminalId) return;
        if (currentItem.id === 'fallback' || currentItem.slotType === 'fallback') return;
        if (failedItemsRef.current.has(currentItem.id)) {
            // Item incompatível — pular silenciosamente
            skipToNext();
            return;
        }

        const logData = {
            terminalId,
            mediaId: currentItem.id,
            mediaName: currentItem.name,
            mediaUrl: currentItem.url,
            slotIndex: currentIndex,
            slotType: currentItem.slotType || 'unknown',
            status: 'played',
            appVersion: CURRENT_VERSION,
            playedAt: new Date().toISOString(),
            cachedLocally: !!cacheMapRef.current[currentItem.id]
        };

        addToLogBuffer(logData);
        console.log(`[PoP] Buffered: "${currentItem.name}" (cached: ${!!cacheMapRef.current[currentItem.id]})`);
    }, [currentItem?.id, terminalId]);

    const isCurrentVideo = currentItem && (
        currentItem.type === 'video' ||
        currentItem.url?.includes('.mp4') ||
        currentItem.url?.includes('.webm') ||
        currentItem.url?.includes('.mkv') ||
        currentItem.url?.includes('.avi')
    );

    // Efeito principal de playback e transições
    React.useEffect(() => {
        if (!currentItem || items.length === 0) return;
        if (failedItemsRef.current.has(currentItem.id)) return; // Não tentar itens que já falharam

        const fadeTimer = setTimeout(() => setVisible(true), 100);

        if (isCurrentVideo) {
            console.log(`[Player] 🎬 HTML5 video: ${currentItem.name}`);
            const safetyTimer = setTimeout(() => {
                console.warn(`[Player] Video safety timeout for "${currentItem.name}"`);
                skipToNext();
            }, 5 * 60 * 1000);
            return () => { clearTimeout(fadeTimer); clearTimeout(safetyTimer); };
        } else {
            const duration = (currentItem.duration || 10) * 1000;
            const timer = setTimeout(() => skipToNext(), duration);
            return () => { clearTimeout(fadeTimer); clearTimeout(timer); };
        }
    }, [currentIndex, currentItem, items, isCurrentVideo, playCount, skipToNext]);

    if (!currentItem) {
        return <div style={{ color: 'white' }}>Carregando mídia...</div>;
    }

    const mediaUrl = getMediaUrl(currentItem);

    const containerStyle = {
        width: '100vw',
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#000',
        overflow: 'hidden'
    };

    return (
        <div style={containerStyle}>
            <div className={`media-wrapper ${visible ? 'visible' : ''}`}>
                {isCurrentVideo ? (
                    <video
                        key={`${currentItem.id}-${playCount}`}
                        src={mediaUrl}
                        autoPlay
                        muted
                        playsInline
                        className="media-item"
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        onEnded={skipToNext}
                        onError={(e) => {
                            const mediaErr = e.target.error;
                            const errCode = mediaErr?.code || 'unknown';
                            const errMsg = mediaErr?.message || 'no message';
                            const codeMap = { 1: 'ABORTED', 2: 'NETWORK', 3: 'DECODE', 4: 'SRC_NOT_SUPPORTED' };
                            console.error(`[Player] Video error for "${currentItem.name}": code=${errCode} (${codeMap[errCode] || '?'}), msg="${errMsg}"`);

                            // Se veio do cache, tentar fallback remoto primeiro
                            if (mediaUrl.startsWith('media-cache://') && currentItem.url && !e.target.dataset.fallback) {
                                console.warn(`[Player] Cache failed, trying remote: ${currentItem.name}`);
                                e.target.dataset.fallback = 'true';
                                e.target.src = currentItem.url;
                                e.target.play().catch(() => { });
                            } else {
                                // Ambos falharam (cache E remoto) = codec incompatível
                                // Marcar como incompatível para não tentar de novo nesta sessão
                                console.warn(`[Player] Marking "${currentItem.name}" as incompatible (both cache and remote failed)`);
                                failedItemsRef.current.add(currentItem.id);
                                skipToNext();
                            }
                        }}
                    />
                ) : (
                    <img
                        key={currentItem.id}
                        src={mediaUrl}
                        alt={currentItem.name}
                        className="media-item"
                        onError={(e) => {
                            if (mediaUrl.startsWith('media-cache://') && !e.target.dataset.fallback) {
                                e.target.dataset.fallback = 'true';
                                e.target.src = currentItem.url;
                            } else {
                                skipToNext();
                            }
                        }}
                    />
                )}
            </div>

            {/* Mini indicador de progresso */}
            <div style={{
                position: 'absolute',
                bottom: 20,
                left: '50%',
                transform: 'translateX(-50%)',
                display: 'flex',
                gap: 8
            }}>
                {items.map((item, idx) => (
                    <div
                        key={idx}
                        title={cacheMap[item.id] ? 'Cached' : 'Remote'}
                        style={{
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            background: idx === currentIndex
                                ? '#6366f1'
                                : (cacheMap[item.id] ? 'rgba(34, 197, 94, 0.5)' : 'rgba(255,255,255,0.3)')
                        }}
                    />
                ))}
            </div>
        </div>
    );
}

export default WebMediaPlayer;
