import React, { useState, useEffect, useRef, useCallback } from 'react';
import './index.css';
import { Monitor, Database, Bug } from 'lucide-react';
import UpdateNotification from './components/UpdateNotification';
import SplashScreen from './components/SplashScreen';
import PairingCodeDisplay from './components/PairingCodeDisplay';
import WebMediaPlayer from './components/WebMediaPlayer';

// Supabase Client
import {
  supabase,
  signInAnonymously,
  onAuthStateChange,
  getTerminalByHardwareId,
  updateTerminalHeartbeat,
  subscribeToTerminal,
  getPlaylistWithSlots,
  subscribeToPlaylist,
} from './supabase';

// Telemetria
import { remoteLog, flushLogBuffer, LOG_BUFFER_KEY, BATCH_INTERVAL_MS } from './utils/telemetry';

// Versão dinâmica - busca do package.json via Electron API
const CURRENT_VERSION = `V${__APP_VERSION__}`;
const CURRENT_VERSION_CODE = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0';

function App() {
  const [loading, setLoading] = useState(true);
  const [effectiveItems, setEffectiveItems] = useState([]);
  const [terminalId, setTerminalId] = useState(localStorage.getItem('terminal_id'));
  const [hardwareId, setHardwareId] = useState(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [terminalData, setTerminalData] = useState(null);
  const [isStandby, setIsStandby] = useState(false);
  const [diag, setDiag] = useState({ t: 'Waiting...', p: 'Waiting...', c: 'Waiting...', auth: 'Initializing...' });
  const [authReady, setAuthReady] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const [playlist, setPlaylist] = useState(null);
  const [cacheMap, setCacheMap] = useState({});
  const [cacheProgress, setCacheProgress] = useState(null);
  const lastSentSettingsRef = useRef(null);

  // 1. Telemetria de Inicialização + Fast-Start
  useEffect(() => {
    remoteLog(terminalId, "INFO", "App.jsx Component Mounted", { version: CURRENT_VERSION });

    const lastVersion = localStorage.getItem('last_app_version');
    if (lastVersion && lastVersion !== CURRENT_VERSION) {
      remoteLog(terminalId, "INFO", `Sistema Atualizado com Sucesso: ${lastVersion} -> ${CURRENT_VERSION}`);
    }
    localStorage.setItem('last_app_version', CURRENT_VERSION);

    let splashDuration = 10000;
    let timerId = null;

    (async () => {
      try {
        if (window.electronAPI?.getBootInfo) {
          const bootInfo = await window.electronAPI.getBootInfo();
          if (bootInfo?.shouldFastStart) {
            splashDuration = 1000;
            console.log('[FAST-START] ⚡ Boot atrasado detectado — splash reduzido para 1s');
          }
        }
      } catch (e) { /* ignore */ }

      timerId = setTimeout(() => setShowSplash(false), splashDuration);
    })();

    return () => { if (timerId) clearTimeout(timerId); };
  }, [terminalId]);

  // 2. Hardware ID
  useEffect(() => {
    (async () => {
      try {
        let id = 'web_device';
        if (window.electronAPI?.isElectron) {
          id = await window.electronAPI.getHardwareId();
          console.log('[Electron] Hardware ID:', id);
        } else if (window.Android?.getHardwareId) {
          id = window.Android.getHardwareId();
        }

        if (id) {
          setHardwareId(id);
          remoteLog(terminalId, "INFO", "Hardware ID Identified", { hwid: id, platform: window.electronAPI?.isElectron ? 'windows' : 'web' });
          if (!terminalId) {
            const { data } = await getTerminalByHardwareId(id);
            if (data && data.owner_id) {
              localStorage.setItem("terminal_id", data.id);
              setTerminalId(data.id);
              remoteLog(data.id, "INFO", "Terminal Auto-Recovered via HWID");
            }
          }
        }
      } catch (e) {
        remoteLog(terminalId, "ERROR", "Hardware Init Fail", { err: e.message });
      }
    })();
  }, [terminalId]);

  // 3. Supabase Auth & Network
  useEffect(() => {
    const { data: { subscription } } = onAuthStateChange((event, session) => {
      if (session?.user) {
        setAuthReady(true);
        setDiag(prev => ({ ...prev, auth: `Ready (${session.user.id.substring(0, 5)})` }));
        remoteLog(terminalId, "INFO", "Auth State Changed: Logged In");
      }
    });

    signInAnonymously().catch(e => {
      remoteLog(terminalId, "CRITICAL", "Auth Sign-in Failure", { message: e.message });
      setDiag(prev => ({ ...prev, auth: `Error: ${e.message}` }));
    });

    const goOnline = () => { setIsOnline(true); remoteLog(terminalId, "INFO", "Network Online"); };
    const goOffline = () => { setIsOnline(false); remoteLog(terminalId, "WARN", "Network Offline"); };
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);

    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
      subscription?.unsubscribe();
    };
  }, [terminalId]);

  // 4. Terminal Sync (Supabase Realtime)
  useEffect(() => {
    if (!terminalId || !authReady) return;

    remoteLog(terminalId, "INFO", "Starting Supabase Listeners");

    if (window.electronAPI?.onRemoteLog) {
      window.electronAPI.onRemoteLog((data) => {
        remoteLog(terminalId, data.level, data.message, data.metadata);
      });
    }

    const fetchTerminal = async () => {
      const { data, error } = await supabase
        .from('terminals')
        .select('*')
        .eq('id', terminalId)
        .single();

      if (data) {
        setTerminalData(data);
        setDiag(prev => ({ ...prev, t: `OK: ${data.name || 'Terminal'}` }));
        setLoading(false);
      } else if (error) {
        console.warn('[Recovery] Terminal deleted, resetting to pairing screen');
        localStorage.removeItem('terminal_id');
        localStorage.removeItem(LOG_BUFFER_KEY);
        sessionStorage.removeItem('pairing_code');
        setTerminalId(null);
        setTerminalData(null);
        setLoading(false);
      }
    };
    fetchTerminal();

    let lastRealtimeUpdate = 0;
    const DEBOUNCE_MS = 2000;

    const channel = subscribeToTerminal(terminalId, (payload) => {
      if (payload.eventType === 'DELETE') {
        console.warn('[Recovery] Terminal deleted in realtime, resetting to pairing');
        localStorage.removeItem('terminal_id');
        localStorage.removeItem(LOG_BUFFER_KEY);
        sessionStorage.removeItem('pairing_code');
        setTerminalId(null);
        setTerminalData(null);
        return;
      }

      if (payload.new) {
        const now = Date.now();
        if (now - lastRealtimeUpdate < DEBOUNCE_MS) {
          console.log('[Realtime] Debounced - ignoring rapid update');
          return;
        }
        lastRealtimeUpdate = now;
        console.log('[Realtime] Terminal update applied');
        setTerminalData(payload.new);
        setDiag(d => ({ ...d, t: `OK: ${payload.new.name || 'Terminal'}` }));
      }
    });

    return () => { supabase.removeChannel(channel); };
  }, [terminalId, authReady]);

  // 5. Playlist Sync
  useEffect(() => {
    if (!terminalData || !authReady) return;

    const playlistId = terminalData.assigned_playlist_id;
    setPlaylist(null);

    if (!playlistId) {
      remoteLog(terminalId, "INFO", "No Playlist Assigned");
      setDiag(prev => ({ ...prev, p: 'No playlist' }));
      return;
    }

    remoteLog(terminalId, "INFO", "Syncing Playlist", { playlistId });

    const fetchPlaylist = async () => {
      const { data, error } = await getPlaylistWithSlots(playlistId);
      if (data) {
        remoteLog(terminalId, "INFO", "Playlist Data Received", {
          name: data.name,
          slotCount: data.playlist_slots?.length || 0
        });
        setPlaylist(data);
        setDiag(prev => ({ ...prev, p: `P: ${data.name} OK` }));
      } else if (error) {
        remoteLog(terminalId, "WARN", "Playlist Not Found", { playlistId });
      }
    };
    fetchPlaylist();

    const slotsChannel = subscribeToPlaylist(playlistId, () => {
      console.log('[REALTIME] playlist_slots changed, refetching...');
      fetchPlaylist();
    });

    const playlistChannel = supabase
      .channel(`playlist-parent:${playlistId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'playlists', filter: `id=eq.${playlistId}` },
        (payload) => {
          console.log('[REALTIME] playlist parent updated, refetching...', payload);
          fetchPlaylist();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(slotsChannel);
      supabase.removeChannel(playlistChannel);
    };
  }, [terminalData?.assigned_playlist_id, authReady, terminalId]);

  // 6. Compile Effective Items
  useEffect(() => {
    if (!terminalData) return;
    let items = [];

    if (playlist?.playlist_slots) {
      items = playlist.playlist_slots
        .filter(slot => slot.media || (slot.slot_type === 'dynamic' && slot.dynamic_config?.url))
        .sort((a, b) => a.slot_index - b.slot_index)
        .map(slot => {
          if (slot.slot_type === 'dynamic' && slot.dynamic_config?.url) {
            return {
              id: `dynamic-${slot.slot_index}`, name: 'Notícias', url: slot.dynamic_config.url,
              type: 'rss', duration: slot.duration || 15, slotType: 'dynamic', orientation: 'portrait',
              refreshMinutes: slot.dynamic_config.refreshMinutes || 10, startDate: null, endDate: null
            };
          }
          return {
            id: slot.media.id, name: slot.media.name, url: slot.media.url, type: slot.media.type,
            duration: slot.duration || slot.media.duration || 10, slotType: slot.slot_type, orientation: 'portrait',
            startDate: slot.media.start_date || slot.start_date || null,
            endDate: slot.media.end_date || slot.end_date || null
          };
        });
      console.log("[PLAYLIST] Loaded", items.length, "items from slots");
    }

    // Validação (4 filtros)
    const AUDIO_EXTENSIONS = ['.mp3', '.wav', '.aac', '.ogg', '.m4a', '.flac'];
    const validateMedia = (item) => {
      const now = new Date();
      if (item.startDate && now < new Date(item.startDate)) return false;
      if (item.endDate && now > new Date(item.endDate)) return false;
      if (item.type === 'rss') return !!item.url;
      if (!item.url || item.url.length < 10 || (!item.url.startsWith('http://') && !item.url.startsWith('https://'))) return false;
      if (AUDIO_EXTENSIONS.some(ext => item.url.toLowerCase().includes(ext))) return false;
      return true;
    };

    const validatedItems = items.filter(validateMedia);
    if (items.length - validatedItems.length > 0) {
      remoteLog(terminalId, "INFO", "Content Filtered", {
        blocked: items.length - validatedItems.length,
        itemsProcessed: items.map(i => ({ name: i.name }))
      });
    }

    const FALLBACK = { id: 'fallback', name: 'Institucional', url: 'https://images.unsplash.com/photo-1557672172-298e090bd0f1?w=1920&h=1080&fit=crop', type: 'image', duration: 15, orientation: 'portrait', slotType: 'fallback' };
    const finalItems = validatedItems.length > 0 ? validatedItems : [FALLBACK];
    if (validatedItems.length === 0 && items.length > 0) {
      remoteLog(terminalId, "WARN", "Fail-Safe Activated");
    }

    const currentSettings = {
      orientation: 'portrait',
      powerMode: terminalData.power_mode || 'auto',
      openingTime: terminalData.operating_start || '08:00',
      closingTime: terminalData.operating_end || '22:00',
      activeDays: terminalData.operating_days || [0, 1, 2, 3, 4, 5, 6]
    };

    const playlistChanged = JSON.stringify(finalItems) !== JSON.stringify(effectiveItems);
    const settingsChanged = JSON.stringify(currentSettings) !== JSON.stringify(lastSentSettingsRef.current);

    if (playlistChanged) {
      console.log(`[PLAYLIST] Items changed: ${effectiveItems.length} -> ${finalItems.length} items`);
      setEffectiveItems(finalItems);
      setDiag(prev => ({ ...prev, c: `M: ${finalItems.length} ${validatedItems.length === 0 ? '(FB)' : 'OK'}` }));

      if (window.electronAPI?.syncPlaylistToCache) {
        console.log("[Cache] Syncing playlist to local cache...");
        remoteLog(terminalId, "INFO", "Cache Sync Started", { items: finalItems.length });
        window.electronAPI.syncPlaylistToCache(finalItems)
          .then((results) => {
            setCacheMap(results || {});
            remoteLog(terminalId, "INFO", "Cache Sync Complete", {
              cached: Object.values(results || {}).filter(Boolean).length,
              total: finalItems.length
            });
          })
          .catch((err) => {
            remoteLog(terminalId, "ERROR", "Cache Sync Failed", { error: err.message });
          });
      }
    }

    if ((playlistChanged || settingsChanged) && finalItems.length > 0) {
      try {
        if (window.Android) {
          window.Android.updateConfig(JSON.stringify({ playlist: finalItems, settings: currentSettings }));
        }
      } catch (err) {
        remoteLog(terminalId, "ERROR", "Config Push Fail", { err: err.message });
      }
      lastSentSettingsRef.current = currentSettings;
    }
  }, [playlist, terminalData, terminalId]);

  // 7. Heartbeat & Standby
  useEffect(() => {
    if (!terminalData || !terminalId || !authReady) return;

    const pulse = async () => {
      const now = new Date();
      const mode = terminalData.power_mode || 'auto';
      let sb = false;

      if (mode === 'off') sb = true;
      else if (mode === 'auto') {
        const days = terminalData.operating_days || [0, 1, 2, 3, 4, 5, 6];
        const currentHour = now.getHours().toString().padStart(2, '0');
        const currentMin = now.getMinutes().toString().padStart(2, '0');
        const time = `${currentHour}:${currentMin}`;
        const op = (terminalData.operating_start || "08:00").substring(0, 5);
        const cl = (terminalData.operating_end || "22:00").substring(0, 5);
        const dayOfWeek = now.getDay();
        const isDayAllowed = days.includes(dayOfWeek);
        const isOutsideHours = op <= cl
          ? (time < op || time > cl)
          : (time < op && time > cl);
        sb = !isDayAllowed || isOutsideHours;
      }
      setIsStandby(sb);

      if (window.Android?.setStandbyMode) {
        try { window.Android.setStandbyMode(sb); } catch (e) { console.error('[STANDBY] Failed:', e); }
      }

      await updateTerminalHeartbeat(terminalId, sb ? 'standby' : 'online', CURRENT_VERSION);
    };

    pulse();
    const inv = setInterval(pulse, 60000);
    return () => clearInterval(inv);
  }, [terminalData, terminalId, authReady]);

  // 8. Flush de Logs em Lote
  useEffect(() => {
    if (!terminalId || !authReady) return;

    const flushInterval = setInterval(() => {
      if (navigator.onLine) flushLogBuffer();
    }, BATCH_INTERVAL_MS);

    const initialFlush = setTimeout(() => {
      if (navigator.onLine) flushLogBuffer();
    }, 30000);

    return () => { clearInterval(flushInterval); clearTimeout(initialFlush); };
  }, [terminalId, authReady]);

  // 9. Cache Progress Listener
  useEffect(() => {
    if (!window.electronAPI?.onCacheProgress) return;
    window.electronAPI.onCacheProgress((data) => {
      setCacheProgress(data);
      if (data.type === 'progress' && data.percent === 100) {
        setTimeout(() => setCacheProgress(null), 3000);
      }
    });
  }, []);

  return (
    <div className="app-container">
      <UpdateNotification />
      {showSplash && <SplashScreen />}

      {!terminalId ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <h1 className="title" style={{ marginBottom: '2rem' }}>REDE <span style={{ color: '#6366f1' }}>CONECTA</span></h1>
          <PairingCodeDisplay authReady={authReady} hardwareId={hardwareId} terminalId={terminalId} />
        </div>
      ) : !showSplash && !isStandby && effectiveItems.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div className="logo-box" style={{ animation: 'none' }}>
            <Database size={40} color="white" />
          </div>
          <h2 className="title" style={{ fontSize: '2rem', marginBottom: '1rem' }}>IRON <span style={{ color: '#6366f1' }}>ENGINE</span></h2>
          <div className="diag-grid">
            <div style={{ color: '#0ea5e9', fontWeight: 'bold', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Bug size={12} /> TELEMETRIA {CURRENT_VERSION}</div>
            <div>AUTENTICAÇÃO: {diag.auth}</div>
            <div>TERMINAL: {diag.t}</div>
            <div>PLAYLIST: {diag.p}</div>
            <div>MÍDIA: {diag.c}</div>
            <div style={{ marginTop: '1rem', color: '#475569', fontSize: '0.5rem' }}>ID: {terminalId}</div>
          </div>
        </div>
      ) : null}

      {isStandby && !showSplash && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div className="logo-box" style={{ opacity: 0.5 }}>
            <Monitor size={40} color="white" />
          </div>
          <div className="subtitle" style={{ marginTop: '2rem' }}>MODO STANDBY</div>
        </div>
      )}

      {!showSplash && !isStandby && effectiveItems.length > 0 && !window.Android && (
        <WebMediaPlayer items={effectiveItems} terminalId={terminalId} cacheMap={cacheMap} />
      )}
    </div>
  );
}

export default App;
