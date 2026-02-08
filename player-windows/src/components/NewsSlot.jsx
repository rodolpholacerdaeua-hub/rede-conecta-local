import React, { useState, useEffect, useRef, useCallback } from 'react';

/**
 * NewsSlot — Componente Nativo de Notícias RSS
 * 
 * - Busca feed RSS via IPC (CORS-free, pelo main process)
 * - Cache em memória com refresh configurável (default 10 min)
 * - Renderiza manchetes nativamente com React/CSS
 * - Fallback institucional se o feed falhar
 * - Zero webview, zero dependências externas
 */

// Cache global (persiste entre re-renders e re-mounts)
let rssCache = {
    url: null,
    items: [],
    fetchedAt: 0
};

const FALLBACK_ITEMS = [
    { title: 'Rede Conecta Local', description: 'Conectando comunidades através da comunicação visual', pubDate: '', image: '' },
    { title: 'Notícias em Tempo Real', description: 'Conteúdo dinâmico para sua tela digital', pubDate: '', image: '' },
    { title: 'Informação que Conecta', description: 'Mantenha-se informado com o feed de notícias local', pubDate: '', image: '' }
];

/**
 * Formatar data de publicação RSS para exibição
 */
const formatDate = (dateStr) => {
    if (!dateStr) return '';
    try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return '';
        const now = new Date();
        const diffMs = now - d;
        const diffMin = Math.floor(diffMs / 60000);
        const diffHrs = Math.floor(diffMs / 3600000);

        if (diffMin < 60) return `há ${diffMin} min`;
        if (diffHrs < 24) return `há ${diffHrs}h`;
        return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
    } catch {
        return '';
    }
};

const NewsSlot = ({ url, refreshMinutes = 10, onError }) => {
    const [items, setItems] = useState(rssCache.url === url && rssCache.items.length > 0 ? rssCache.items : []);
    const [loading, setLoading] = useState(items.length === 0);
    const [isFallback, setIsFallback] = useState(false);
    const [activeIndex, setActiveIndex] = useState(0);
    const mountedRef = useRef(true);

    // Fetch RSS via IPC (main process, sem CORS)
    const fetchFeed = useCallback(async () => {
        // Verificar cache
        const cacheAge = Date.now() - rssCache.fetchedAt;
        const cacheValid = rssCache.url === url && cacheAge < refreshMinutes * 60 * 1000;

        if (cacheValid && rssCache.items.length > 0) {
            console.log(`[NewsSlot] ✅ Cache hit (${Math.round(cacheAge / 1000)}s old, ${rssCache.items.length} items)`);
            if (mountedRef.current) {
                setItems(rssCache.items);
                setLoading(false);
                setIsFallback(false);
            }
            return;
        }

        console.log(`[NewsSlot] 📡 Fetching RSS: ${url}`);

        try {
            // Tentar via IPC (Electron, sem CORS)
            if (window.electronAPI?.fetchRss) {
                const result = await window.electronAPI.fetchRss(url);
                if (result.success && result.items.length > 0) {
                    rssCache = { url, items: result.items, fetchedAt: Date.now() };
                    if (mountedRef.current) {
                        setItems(result.items);
                        setLoading(false);
                        setIsFallback(false);
                    }
                    return;
                }
                throw new Error(result.error || 'Nenhum item no feed');
            }

            // Fallback: fetch direto (navegador/dev)
            const response = await fetch(url);
            const xml = await response.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(xml, 'text/xml');
            const xmlItems = Array.from(doc.querySelectorAll('item')).slice(0, 15).map(item => ({
                title: item.querySelector('title')?.textContent || '',
                description: (item.querySelector('description')?.textContent || '').replace(/<[^>]+>/g, '').substring(0, 200),
                pubDate: item.querySelector('pubDate')?.textContent || '',
                image: ''
            }));

            if (xmlItems.length > 0) {
                rssCache = { url, items: xmlItems, fetchedAt: Date.now() };
                if (mountedRef.current) {
                    setItems(xmlItems);
                    setLoading(false);
                    setIsFallback(false);
                }
                return;
            }
            throw new Error('Feed vazio');
        } catch (err) {
            console.warn(`[NewsSlot] ⚠️ Feed error: ${err.message} — usando fallback`);
            if (mountedRef.current) {
                setItems(FALLBACK_ITEMS);
                setLoading(false);
                setIsFallback(true);
            }
        }
    }, [url, refreshMinutes]);

    // Fetch inicial + refresh periódico
    useEffect(() => {
        mountedRef.current = true;
        fetchFeed();

        const interval = setInterval(fetchFeed, refreshMinutes * 60 * 1000);
        return () => {
            mountedRef.current = false;
            clearInterval(interval);
        };
    }, [fetchFeed, refreshMinutes]);

    // Auto-scroll pelas manchetes (troca a cada 3 segundos)
    useEffect(() => {
        if (items.length <= 1) return;
        const timer = setInterval(() => {
            setActiveIndex(prev => (prev + 1) % items.length);
        }, 3000);
        return () => clearInterval(timer);
    }, [items.length]);

    // === LOADING STATE ===
    if (loading) {
        return (
            <div style={styles.container}>
                <div style={styles.loadingWrapper}>
                    <div style={styles.spinner} />
                    <span style={styles.loadingText}>Carregando notícias...</span>
                </div>
            </div>
        );
    }

    // === RENDER MANCHETES ===
    const currentItem = items[activeIndex] || items[0];
    const nextItem = items[(activeIndex + 1) % items.length];

    return (
        <div style={styles.container}>
            {/* Header bar */}
            <div style={styles.header}>
                <div style={styles.headerLeft}>
                    <span style={styles.headerIcon}>📰</span>
                    <span style={styles.headerTitle}>
                        {isFallback ? 'REDE CONECTA' : 'NOTÍCIAS'}
                    </span>
                </div>
                <div style={styles.headerRight}>
                    <div style={styles.liveDot} />
                    <span style={styles.liveText}>AO VIVO</span>
                </div>
            </div>

            {/* Manchete principal */}
            <div style={styles.mainHeadline} key={activeIndex}>
                <div style={styles.headlineText}>
                    {currentItem.title}
                </div>
                {currentItem.description && (
                    <div style={styles.headlineDescription}>
                        {currentItem.description}
                    </div>
                )}
                {currentItem.pubDate && (
                    <div style={styles.headlineDate}>
                        {formatDate(currentItem.pubDate)}
                    </div>
                )}
            </div>

            {/* Ticker inferior com próxima notícia */}
            {items.length > 1 && nextItem && (
                <div style={styles.ticker}>
                    <span style={styles.tickerLabel}>PRÓXIMA</span>
                    <span style={styles.tickerText}>{nextItem.title}</span>
                </div>
            )}

            {/* Indicadores */}
            <div style={styles.indicators}>
                {items.slice(0, 8).map((_, i) => (
                    <div
                        key={i}
                        style={{
                            ...styles.dot,
                            background: i === activeIndex % 8 ? '#10b981' : 'rgba(255,255,255,0.2)'
                        }}
                    />
                ))}
            </div>
        </div>
    );
};

// === ESTILOS ===
const styles = {
    container: {
        width: '100%',
        height: '100%',
        background: 'linear-gradient(180deg, #0f172a 0%, #1e293b 100%)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '3vh 4vw',
        fontFamily: "'Segoe UI', 'Helvetica Neue', Arial, sans-serif",
        color: '#f8fafc',
        overflow: 'hidden',
        position: 'relative'
    },

    // Header
    header: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingBottom: '2vh',
        borderBottom: '2px solid rgba(16,185,129,0.3)'
    },
    headerLeft: {
        display: 'flex',
        alignItems: 'center',
        gap: '1.5vw'
    },
    headerIcon: {
        fontSize: '4vh'
    },
    headerTitle: {
        fontSize: '3vh',
        fontWeight: 800,
        letterSpacing: '0.15em',
        color: '#10b981'
    },
    headerRight: {
        display: 'flex',
        alignItems: 'center',
        gap: '0.8vw'
    },
    liveDot: {
        width: '1.2vh',
        height: '1.2vh',
        borderRadius: '50%',
        background: '#ef4444',
        animation: 'pulse 2s ease-in-out infinite'
    },
    liveText: {
        fontSize: '1.8vh',
        fontWeight: 700,
        color: '#ef4444',
        letterSpacing: '0.1em'
    },

    // Manchete principal
    mainHeadline: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '3vh 0',
        animation: 'fadeSlideIn 0.6s ease-out'
    },
    headlineText: {
        fontSize: '5.5vh',
        fontWeight: 800,
        lineHeight: 1.2,
        color: '#f8fafc',
        textShadow: '0 2px 8px rgba(0,0,0,0.3)',
        marginBottom: '2vh'
    },
    headlineDescription: {
        fontSize: '2.8vh',
        fontWeight: 400,
        lineHeight: 1.4,
        color: '#94a3b8',
        maxHeight: '12vh',
        overflow: 'hidden'
    },
    headlineDate: {
        marginTop: '1.5vh',
        fontSize: '2vh',
        color: '#10b981',
        fontWeight: 600
    },

    // Ticker
    ticker: {
        display: 'flex',
        alignItems: 'center',
        gap: '1.5vw',
        padding: '1.5vh 0',
        borderTop: '1px solid rgba(255,255,255,0.1)'
    },
    tickerLabel: {
        fontSize: '1.5vh',
        fontWeight: 700,
        color: '#0ea5e9',
        letterSpacing: '0.1em',
        whiteSpace: 'nowrap'
    },
    tickerText: {
        fontSize: '2vh',
        color: '#64748b',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap'
    },

    // Indicadores
    indicators: {
        display: 'flex',
        justifyContent: 'center',
        gap: '0.8vw',
        paddingTop: '1vh'
    },
    dot: {
        width: '1vh',
        height: '1vh',
        borderRadius: '50%',
        transition: 'background 0.3s ease'
    },

    // Loading
    loadingWrapper: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        gap: '2vh'
    },
    spinner: {
        width: '5vh',
        height: '5vh',
        border: '3px solid rgba(16,185,129,0.2)',
        borderTop: '3px solid #10b981',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite'
    },
    loadingText: {
        fontSize: '2.2vh',
        color: '#64748b'
    }
};

export default NewsSlot;
