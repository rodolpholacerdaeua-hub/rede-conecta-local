import React, { useRef, useEffect, useState, useCallback } from 'react';

/**
 * NewsWidget — Slot Dinâmico de Notícias via Electron <webview>
 * 
 * Features:
 * - Partition persistente (persist:news) para evitar prompts de cookies repetidos
 * - User-Agent de Chrome limpo para compatibilidade
 * - CSS Injection para esconder cabeçalhos, menus, rodapés e CTAs
 * - Zoom configurável para legibilidade a 3 metros
 * - Opacity loading: esconde a "montagem" da página
 * - Lifecycle kill: webview.stop() + remoção do DOM ao desmontar
 */

const CHROME_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

// CSS injetado para limpar a interface e focar no conteúdo
const CLEANUP_CSS = `
  /* ===== LIMPA-TELA: Esconder elementos irrelevantes ===== */

  /* Cabeçalhos e Navegação */
  header, nav, [role="navigation"], [role="banner"],
  .header, .navbar, .nav-bar, .top-bar, .site-header,
  .main-nav, .primary-nav, .secondary-nav,
  #header, #navbar, #navigation, #top-bar {
    display: none !important;
  }

  /* Rodapés */
  footer, [role="contentinfo"],
  .footer, .site-footer, #footer {
    display: none !important;
  }

  /* Botões de Login / Auth */
  .login, .signin, .sign-in, .signup, .sign-up,
  [class*="login"], [class*="signin"], [class*="auth"],
  [id*="login"], [id*="signin"],
  .user-menu, .account-menu {
    display: none !important;
  }

  /* Banners de Cookies / LGPD / GDPR */
  .cookie-banner, .cookie-consent, .cookie-notice,
  .consent-banner, .privacy-notice, .gdpr-banner,
  [class*="cookie"], [class*="consent"], [class*="gdpr"],
  [id*="cookie"], [id*="consent"], [id*="lgpd"],
  .onetrust-consent-sdk, #onetrust-consent-sdk,
  .cc-window, .cc-banner {
    display: none !important;
  }

  /* Sidebars e Ads */
  aside, .sidebar, .ad-container, .ad-wrapper,
  [class*="sidebar"], [class*="advertisement"],
  [id*="sidebar"], [id*="ad-container"],
  .social-share, .share-buttons, .social-buttons {
    display: none !important;
  }

  /* Popups e Modais genéricos */
  .modal-overlay, .popup-overlay, .overlay,
  [class*="paywall"], [class*="subscribe-wall"],
  .newsletter-popup, .subscribe-popup {
    display: none !important;
  }

  /* Scrollbar invisível */
  ::-webkit-scrollbar { display: none !important; }
  body { -ms-overflow-style: none; scrollbar-width: none; }

  /* Garantir que o conteúdo principal ocupe tudo */
  body {
    margin: 0 !important;
    padding: 0 !important;
    overflow: hidden !important;
  }
`;

const NewsWidget = ({ url, zoomLevel = 2.0, onError }) => {
    const webviewRef = useRef(null);
    const containerRef = useRef(null);
    const [loaded, setLoaded] = useState(false);
    const [hasError, setHasError] = useState(false);

    // Callback para quando a webview termina de carregar
    const handleDidStopLoading = useCallback(() => {
        const wv = webviewRef.current;
        if (!wv) return;

        try {
            // 1. Injetar CSS de limpeza
            wv.insertCSS(CLEANUP_CSS);

            // 2. Aplicar zoom via CSS transform no conteúdo
            wv.insertCSS(`
        html {
          transform: scale(${zoomLevel});
          transform-origin: top left;
          width: ${100 / zoomLevel}% !important;
          height: ${100 / zoomLevel}% !important;
        }
      `);

            console.log(`[NewsWidget] ✅ Loaded + CSS injected (zoom: ${zoomLevel}x)`);
        } catch (err) {
            console.error('[NewsWidget] CSS injection error:', err);
        }

        // 3. Revelar com fade-in
        setLoaded(true);
    }, [zoomLevel]);

    // Callback de erro
    const handleDidFailLoad = useCallback((e) => {
        console.error('[NewsWidget] ❌ Failed to load:', e.errorDescription || e);
        setHasError(true);
        if (onError) onError(e);
    }, [onError]);

    // Setup e cleanup da webview
    useEffect(() => {
        const wv = webviewRef.current;
        if (!wv) return;

        // Registrar event listeners
        wv.addEventListener('did-stop-loading', handleDidStopLoading);
        wv.addEventListener('did-fail-load', handleDidFailLoad);

        // Bloquear popups e navegação fora do domínio
        const handleNewWindow = (e) => {
            e.preventDefault();
            console.log('[NewsWidget] Blocked popup:', e.url);
        };
        wv.addEventListener('new-window', handleNewWindow);

        // LIFECYCLE KILL: Destruir webview ao desmontar o componente
        return () => {
            console.log('[NewsWidget] 🔴 Destroying webview (lifecycle kill)');
            try {
                wv.removeEventListener('did-stop-loading', handleDidStopLoading);
                wv.removeEventListener('did-fail-load', handleDidFailLoad);
                wv.removeEventListener('new-window', handleNewWindow);

                // Parar carregamento
                wv.stop();

                // Limpar a URL para forçar o Chromium a liberar o processo
                wv.src = 'about:blank';

                // Remover do DOM após breve delay (garante que o GC do Chromium atue)
                setTimeout(() => {
                    if (containerRef.current && wv.parentNode === containerRef.current) {
                        containerRef.current.removeChild(wv);
                        console.log('[NewsWidget] ✅ Webview removed from DOM — RAM freed');
                    }
                }, 100);
            } catch (err) {
                console.warn('[NewsWidget] Cleanup error (safe to ignore):', err.message);
            }
        };
    }, [url, handleDidStopLoading, handleDidFailLoad]);

    if (hasError) {
        return (
            <div style={{
                width: '100%', height: '100%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: '#0a0a0a', color: '#475569', fontSize: '1.5rem'
            }}>
                📡 Conteúdo indisponível
            </div>
        );
    }

    return (
        <div
            ref={containerRef}
            style={{
                width: '100%',
                height: '100%',
                background: '#0a0a0a',
                position: 'relative',
                overflow: 'hidden'
            }}
        >
            <webview
                ref={webviewRef}
                src={url}
                partition="persist:news"
                useragent={CHROME_USER_AGENT}
                allowpopups="false"
                disablewebsecurity="false"
                style={{
                    width: '100%',
                    height: '100%',
                    border: 'none',
                    opacity: loaded ? 1 : 0,
                    transition: 'opacity 0.6s ease-in-out'
                }}
            />

            {/* Loading spinner enquanto a webview monta */}
            {!loaded && (
                <div style={{
                    position: 'absolute', inset: 0,
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center',
                    background: '#0a0a0a', color: '#6366f1'
                }}>
                    <div style={{
                        width: 40, height: 40,
                        border: '3px solid rgba(99,102,241,0.2)',
                        borderTop: '3px solid #6366f1',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite'
                    }} />
                    <span style={{ marginTop: 12, fontSize: '0.9rem', color: '#64748b' }}>
                        Carregando notícias...
                    </span>
                </div>
            )}
        </div>
    );
};

export default NewsWidget;
