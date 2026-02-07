import React, { useState, useEffect, useRef, useCallback } from 'react';
import './index.css';
import { Monitor, Loader2, Database, Bug } from 'lucide-react';
import UpdateNotification from './components/UpdateNotification';

// Supabase Client
import {
  supabase,
  signInAnonymously,
  onAuthStateChange,
  getTerminalByHardwareId,
  upsertTerminal,
  updateTerminalHeartbeat,
  subscribeToTerminal,
  getPlaylistWithSlots,
  subscribeToPlaylist,
  logPlayback,
  logPlaybackBatch,
  logTerminalEvent,
  registerPairingCode,
  checkPairingStatus
} from './supabase';

// Versão dinâmica - busca do package.json via Electron API
const CURRENT_VERSION = `V${__APP_VERSION__}`;
const CURRENT_VERSION_CODE = 17.0;

// ========================================
// TELEMETRIA REMOTA
// ========================================
const remoteLog = async (terminalId, level, message, details = {}) => {
  try {
    console.log(`[${level}] ${message}`, details);
    if (terminalId) {
      await logTerminalEvent(terminalId, level.toLowerCase(), message, details);
    }
  } catch (e) {
    console.error("Fail to remote log", e);
  }
};

// ========================================
// BUFFER DE LOGS (BATCHING A CADA 5 MINUTOS)
// ========================================
const LOG_BUFFER_KEY = 'popLogBuffer';
const BATCH_INTERVAL_MS = 5 * 60 * 1000; // 5 minutos
const MAX_BUFFER_SIZE = 1000;

// Adicionar log ao buffer local
const addToLogBuffer = (logData) => {
  try {
    const buffer = JSON.parse(localStorage.getItem(LOG_BUFFER_KEY) || '[]');
    buffer.push(logData);

    // Limitar tamanho do buffer
    if (buffer.length > MAX_BUFFER_SIZE) {
      buffer.splice(0, buffer.length - MAX_BUFFER_SIZE);
    }

    localStorage.setItem(LOG_BUFFER_KEY, JSON.stringify(buffer));
    console.log(`[PoP] Buffered (${buffer.length} pending)`);
  } catch (e) {
    console.error('[PoP] Failed to buffer log:', e);
  }
};

// Flush buffer de logs para o servidor
const flushLogBuffer = async () => {
  try {
    const buffer = JSON.parse(localStorage.getItem(LOG_BUFFER_KEY) || '[]');
    if (buffer.length === 0) return;

    console.log(`[PoP] Flushing ${buffer.length} logs...`);

    const { error } = await logPlaybackBatch(buffer);

    if (!error) {
      localStorage.removeItem(LOG_BUFFER_KEY);
      console.log(`[PoP] Successfully flushed ${buffer.length} logs`);
    } else {
      console.warn('[PoP] Flush failed:', error.message);
    }
  } catch (e) {
    console.error('[PoP] Error flushing logs:', e);
  }
};

// Native Remote Log Receiver
window.nativeRemoteLog = (terminalId, level, message, details) => {
  remoteLog(terminalId, level, "[NATIVE] " + message, details);
};

// ========================================
// COMPONENTES
// ========================================
const SplashScreen = () => (
  <div className="splash-overlay" style={{ background: '#2563eb' }}>
    <div className="logo-container">
      <div className="logo-box" style={{ background: 'white' }}>
        <Monitor size={60} color="#2563eb" />
      </div>
      <h1 className="title">REDE <span style={{ color: '#93c5fd' }}>CONECTA</span></h1>
      <p className="subtitle" style={{ marginTop: '1rem', color: 'white', fontSize: '1.5rem' }}>{CURRENT_VERSION}</p>
    </div>
    <div style={{ position: 'absolute', bottom: '80px' }}>
      <Loader2 className="animate-spin" color="white" size={40} />
    </div>
  </div>
);

const PairingCodeDisplay = ({ authReady, hardwareId, terminalId }) => {
  const [code, setCode] = useState(null);

  useEffect(() => {
    if (!authReady) return;
    remoteLog(terminalId, "INFO", "PairingCodeDisplay Mounted");

    let cur = sessionStorage.getItem('pairing_code');
    if (!cur) {
      cur = Math.random().toString(36).substring(2, 8).toUpperCase();
      sessionStorage.setItem('pairing_code', cur);
    }
    setCode(cur);

    // Registrar código de pareamento na tabela pairing_codes
    const doRegister = async () => {
      try {
        const { data, error } = await registerPairingCode(cur, hardwareId || 'unknown');
        if (error) throw error;
        remoteLog(terminalId, "INFO", "Pairing Code Registered", { code: cur });
      } catch (e) {
        remoteLog(terminalId, "ERROR", "Fail to register pairing code", { err: e.message });
      }
    };
    doRegister();

    // Polling para verificar pareamento via pairing_codes table
    const checkPairing = async () => {
      const { paired, terminalId: newTerminalId } = await checkPairingStatus(cur);
      if (paired && newTerminalId) {
        remoteLog(terminalId, "INFO", "Terminal Linked Successfully", { newId: newTerminalId });
        localStorage.setItem('terminal_id', newTerminalId);
        sessionStorage.removeItem('pairing_code');
        window.location.reload();
      }
    };

    const interval = setInterval(checkPairing, 3000);
    return () => clearInterval(interval);
  }, [authReady, hardwareId, terminalId]);

  if (!authReady) {
    return <div className="subtitle animate-pulse">Estabelecendo Conexão Segura...</div>;
  }

  return (
    <div className="panel">
      <span className="subtitle">CÓDIGO DE ATIVAÇÃO</span>
      <div className="pairing-box">
        <code className="pairing-code">{code || '---'}</code>
      </div>
      <p style={{ marginTop: '2rem', color: '#475569', fontSize: '0.8rem' }}>Acesse o Painel Admin para parear este terminal</p>
    </div>
  );
};

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
  const [cacheMap, setCacheMap] = useState({}); // mediaId -> localPath
  const [cacheProgress, setCacheProgress] = useState(null);
  // Sistema vertical-only: orientação fixa portrait (não precisa de state)
  const lastSentSettingsRef = useRef(null);

  // Telemetria de Inicialização + Fast-Start (Blindagem de Disponibilidade)
  useEffect(() => {
    remoteLog(terminalId, "INFO", "App.jsx Component Mounted", { version: CURRENT_VERSION });

    // Verificar se houve boot atrasado — splash rápido de 1s
    let splashDuration = 10000; // padrão 10s
    (async () => {
      try {
        if (window.electronAPI?.getBootInfo) {
          const bootInfo = await window.electronAPI.getBootInfo();
          if (bootInfo?.shouldFastStart) {
            splashDuration = 1000; // 1s — vai direto pro conteúdo em cache
            console.log('[FAST-START] ⚡ Boot atrasado detectado — splash reduzido para 1s');
          }
        }
      } catch (e) { /* ignore */ }

      // Log de sucesso pós-update (comparação de versão)
      const lastVersion = localStorage.getItem('last_app_version');
      if (lastVersion && lastVersion !== CURRENT_VERSION) {
        remoteLog(terminalId, "INFO", `Sistema Atualizado com Sucesso: ${lastVersion} -> ${CURRENT_VERSION}`);
      }
      localStorage.setItem('last_app_version', CURRENT_VERSION);

      // Splash timer
      const timer = setTimeout(() => {
        setShowSplash(false);
      }, splashDuration);

      // Cleanup
      return () => clearTimeout(timer);
    })();
  }, [terminalId]);

  // 1. Electron/Native Communication & Hardware ID
  useEffect(() => {
    (async () => {
      try {
        let id = 'web_device';

        // Electron environment
        if (window.electronAPI?.isElectron) {
          id = await window.electronAPI.getHardwareId();
          console.log('[Electron] Hardware ID:', id);
        }
        // Android environment
        else if (window.Android?.getHardwareId) {
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

  // 2. Supabase Auth & Network
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

  // 3. Terminal Sync (Supabase Realtime)
  useEffect(() => {
    if (!terminalId || !authReady) return;

    remoteLog(terminalId, "INFO", "Starting Supabase Listeners");

    // Listener para logs do Main Process (IPC)
    if (window.electronAPI?.onRemoteLog) {
      window.electronAPI.onRemoteLog((data) => {
        remoteLog(terminalId, data.level, data.message, data.metadata);
      });
    }

    // Fetch inicial
    const fetchTerminal = async () => {
      const { data, error } = await supabase
        .from('terminals')
        .select('*')
        .eq('id', terminalId)
        .single();

      if (data) {
        setTerminalData(data);
        // Sistema vertical-only: não precisa ler orientação do banco
        setDiag(prev => ({ ...prev, t: `OK: ${data.name || 'Terminal'}` }));
        setLoading(false);
      } else if (error) {
        setDiag(prev => ({ ...prev, t: '404 - Deleted?' }));
        remoteLog(terminalId, "WARN", "Terminal Doc Missing");
      }
    };
    fetchTerminal();

    // Realtime subscription com debounce para evitar loop infinito
    let lastRealtimeUpdate = 0;
    const DEBOUNCE_MS = 2000; // Ignorar updates dentro de 2 segundos

    const channel = subscribeToTerminal(terminalId, (payload) => {
      if (payload.new) {
        const now = Date.now();
        if (now - lastRealtimeUpdate < DEBOUNCE_MS) {
          console.log('[Realtime] Debounced - ignoring rapid update');
          return; // Ignorar updates muito rápidos
        }
        lastRealtimeUpdate = now;

        console.log('[Realtime] Terminal update applied');
        setTerminalData(payload.new);
        // Sistema vertical-only: não precisa ler orientação
        setDiag(d => ({ ...d, t: `OK: ${payload.new.name || 'Terminal'}` }));
      }
    });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [terminalId, authReady]);

  // 4. Playlist Sync
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

    // Realtime subscription - playlist_slots (mudanças diretas nos slots)
    const slotsChannel = subscribeToPlaylist(playlistId, () => {
      console.log('[REALTIME] playlist_slots changed, refetching...');
      fetchPlaylist();
    });

    // Realtime subscription - playlists (backup: quando Playlists.jsx atualiza updated_at)
    const playlistChannel = supabase
      .channel(`playlist-parent:${playlistId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'playlists',
          filter: `id=eq.${playlistId}`
        },
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

  // 5. Compile Effective Items
  useEffect(() => {
    if (!terminalData) return;
    // Sistema vertical-only: orientação fixa portrait
    const orientation = 'portrait';
    let items = [];

    // Processar slots da playlist
    if (playlist?.playlist_slots) {
      items = playlist.playlist_slots
        .filter(slot => slot.media)
        .sort((a, b) => a.slot_index - b.slot_index)
        .map(slot => ({
          id: slot.media.id,
          name: slot.media.name,
          url: slot.media.url,
          type: slot.media.type,
          duration: slot.duration || slot.media.duration || 10,
          slotType: slot.slot_type,
          orientation: 'portrait',
          startDate: slot.media.start_date || slot.start_date || null,
          endDate: slot.media.end_date || slot.end_date || null
        }));
      console.log("[PLAYLIST] Loaded", items.length, "items from slots");
    }

    // ============================================
    // SISTEMA DE VALIDAÇÃO (4 FILTROS)  
    // ============================================
    const AUDIO_EXTENSIONS = ['.mp3', '.wav', '.aac', '.ogg', '.m4a', '.flac'];

    const validateMedia = (item) => {
      const now = new Date();

      // 1. Validade Temporal (Início)
      if (item.startDate) {
        if (now < new Date(item.startDate)) {
          console.warn(`[FILTER] "${item.name}" não iniciou (${item.startDate})`);
          return false;
        }
      }
      // 2. Validade Temporal (Fim)
      if (item.endDate) {
        if (now > new Date(item.endDate)) {
          console.warn(`[FILTER] "${item.name}" expirou (${item.endDate})`);
          return false;
        }
      }
      // 3. Integridade URL
      if (!item.url || item.url.length < 10 || (!item.url.startsWith('http://') && !item.url.startsWith('https://'))) {
        console.warn(`[FILTER] "${item.name}" URL inválida`);
        return false;
      }
      // 4. Bloqueio Áudio
      if (AUDIO_EXTENSIONS.some(ext => item.url.toLowerCase().includes(ext))) {
        console.warn(`[FILTER] Bloqueando áudio: "${item.name}"`);
        return false;
      }
      // (Filtro de orientação removido — sistema vertical-only)
      return true;
    };

    const validatedItems = items.filter(validateMedia);
    if (items.length - validatedItems.length > 0) {
      // Log detalhado para diagnóstico
      console.log(`[FILTER] ${items.length - validatedItems.length} items blocked`);
      items.forEach(item => {
        console.log(`[FILTER] Item "${item.name}" - url: ${item.url?.substring(0, 50)}...`);
      });
      remoteLog(terminalId, "INFO", "Content Filtered", {
        blocked: items.length - validatedItems.length,
        terminalOrientation: 'portrait',
        itemsProcessed: items.map(i => ({ name: i.name }))
      });
    }

    // FAIL-SAFE: Tela Nunca Vazia
    const FALLBACK = { id: 'fallback', name: 'Institucional', url: 'https://images.unsplash.com/photo-1557672172-298e090bd0f1?w=1920&h=1080&fit=crop', type: 'image', duration: 15, orientation: 'portrait', slotType: 'fallback' };
    const finalItems = validatedItems.length > 0 ? validatedItems : [FALLBACK];
    if (validatedItems.length === 0 && items.length > 0) {
      console.warn("[FAIL-SAFE] Usando fallback");
      remoteLog(terminalId, "WARN", "Fail-Safe Activated");
    }

    // Build settings
    const currentSettings = {
      orientation: 'portrait',
      powerMode: terminalData.power_mode || 'auto',
      openingTime: terminalData.operating_start || '08:00',
      closingTime: terminalData.operating_end || '22:00',
      activeDays: terminalData.operating_days || [0, 1, 2, 3, 4, 5, 6]
    };

    const playlistChanged = JSON.stringify(finalItems) !== JSON.stringify(effectiveItems);
    const settingsChanged = JSON.stringify(currentSettings) !== JSON.stringify(lastSentSettingsRef.current);

    // Sempre atualizar items — se nada mudou, JSON.stringify garante que não há re-render desnecessário
    if (playlistChanged) {
      console.log(`[PLAYLIST] Items changed: ${effectiveItems.length} -> ${finalItems.length} items`);
      setEffectiveItems(finalItems);
      setDiag(prev => ({ ...prev, c: `M: ${finalItems.length} ${validatedItems.length === 0 ? '(FB)' : 'OK'}` }));

      // ============================================
      // SINCRONIZAR PLAYLIST PARA CACHE LOCAL (Offline-First v17)
      // ============================================
      if (window.electronAPI?.syncPlaylistToCache) {
        console.log("[Cache] Syncing playlist to local cache...");
        remoteLog(terminalId, "INFO", "Cache Sync Started", { items: finalItems.length });

        window.electronAPI.syncPlaylistToCache(finalItems)
          .then((results) => {
            console.log("[Cache] Sync complete:", results);
            setCacheMap(results || {});
            remoteLog(terminalId, "INFO", "Cache Sync Complete", {
              cached: Object.values(results || {}).filter(Boolean).length,
              total: finalItems.length
            });
          })
          .catch((err) => {
            console.error("[Cache] Sync failed:", err);
            remoteLog(terminalId, "ERROR", "Cache Sync Failed", { error: err.message });
          });
      }
    }

    // Send to native (Android)
    if ((playlistChanged || settingsChanged) && finalItems.length > 0) {
      const configPayload = {
        playlist: finalItems,
        settings: currentSettings
      };

      console.log("Pushing Config V17 to Native", configPayload.playlist.length);
      remoteLog(terminalId, "INFO", "Pushing V17 Config to Native", { items: configPayload.playlist.length });

      try {
        if (window.Android) {
          window.Android.updateConfig(JSON.stringify(configPayload));
        }
      } catch (err) {
        console.error("Config Push Failed", err);
        remoteLog(terminalId, "ERROR", "Config Push Fail", { err: err.message });
      }

      lastSentSettingsRef.current = currentSettings;
    }
  }, [playlist, terminalData, terminalId]);

  // 6. Heartbeat & Standby
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

        // Lógica: standby se NÃO está no dia OU fora do horário
        const isOutsideHours = op <= cl
          ? (time < op || time > cl)   // Horário normal (ex: 06:00 - 22:00)
          : (time < op && time > cl);  // Horário overnight (ex: 22:00 - 06:00)

        sb = !isDayAllowed || isOutsideHours;

        // DEBUG LOGS
        console.log('[STANDBY DEBUG] ==================');
        console.log('[STANDBY DEBUG] Current Time:', time);
        console.log('[STANDBY DEBUG] Day of Week:', dayOfWeek);
        console.log('[STANDBY DEBUG] Allowed Days:', days);
        console.log('[STANDBY DEBUG] Is Day Allowed:', isDayAllowed);
        console.log('[STANDBY DEBUG] Operating Start:', op);
        console.log('[STANDBY DEBUG] Operating End:', cl);
        console.log('[STANDBY DEBUG] Is Outside Hours:', isOutsideHours);
        console.log('[STANDBY DEBUG] Power Mode:', mode);
        console.log('[STANDBY DEBUG] FINAL STANDBY:', sb);
        console.log('[STANDBY DEBUG] ==================');
      }
      setIsStandby(sb);

      // Native standby
      if (window.Android?.setStandbyMode) {
        try {
          window.Android.setStandbyMode(sb);
        } catch (e) {
          console.error('[STANDBY] Failed:', e);
        }
      }

      // Update heartbeat
      await updateTerminalHeartbeat(terminalId, sb ? 'standby' : 'online', CURRENT_VERSION);
    };

    pulse();
    const inv = setInterval(pulse, 60000); // Heartbeat: 60 segundos (economia de rede)
    return () => clearInterval(inv);
  }, [terminalData, terminalId, authReady]);

  // 7. Flush de Logs em Lote (a cada 5 minutos)
  useEffect(() => {
    if (!terminalId || !authReady) return;

    // Flush a cada 5 minutos para economia de rede/DB
    const flushInterval = setInterval(() => {
      if (navigator.onLine) {
        flushLogBuffer();
      }
    }, BATCH_INTERVAL_MS);

    // Flush inicial após 30 segundos
    const initialFlush = setTimeout(() => {
      if (navigator.onLine) {
        flushLogBuffer();
      }
    }, 30000);

    return () => {
      clearInterval(flushInterval);
      clearTimeout(initialFlush);
    };
  }, [terminalId, authReady]);

  // 8. Listener de Progresso de Cache (Electron)
  useEffect(() => {
    if (!window.electronAPI?.onCacheProgress) return;

    window.electronAPI.onCacheProgress((data) => {
      setCacheProgress(data);
      if (data.type === 'progress' && data.percent === 100) {
        // Limpar progresso após completar
        setTimeout(() => setCacheProgress(null), 3000);
      }
    });
  }, []);

  return (
    <div className="app-container">
      {/* Notificação de Atualização */}
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

      {/* Web/Electron Player - quando não há window.Android */}
      {!showSplash && !isStandby && effectiveItems.length > 0 && !window.Android && (
        <WebMediaPlayer
          items={effectiveItems}
          terminalId={terminalId}
          cacheMap={cacheMap}
        />
      )}
    </div>
  );
}

// Componente WebMediaPlayer para rodar mídias (Offline-First v17 + mpv)
function WebMediaPlayer({ items, terminalId, cacheMap = {} }) {
  const [currentIndex, setCurrentIndex] = React.useState(0);
  const [mpvPlaying, setMpvPlaying] = React.useState(false);
  const [visible, setVisible] = React.useState(false); // Controle de fade-in
  const currentItem = items[currentIndex];

  // Obter URL para exibição (cache local ou remoto)
  const getMediaUrl = (item) => {
    // Verificar se temos caminho local em cache
    const localPath = cacheMap[item.id];
    if (localPath && window.electronAPI?.isElectron) {
      const fileName = localPath.replace(/\\/g, '/').split('/').pop();
      const cacheUrl = `media-cache://local/${fileName}`;
      console.log(`[Player] Using cached: ${item.name} -> ${cacheUrl}`);
      return cacheUrl;
    }
    console.log(`[Player] Using remote: ${item.name}`);
    return item.url;
  };

  // Obter caminho para mpv (cache local direto ou URL remota)
  const getMpvPath = (item) => {
    const localPath = cacheMap[item.id];
    if (localPath) {
      console.log(`[Player] mpv using local file: ${localPath}`);
      return localPath; // mpv pode ler arquivos locais diretamente!
    }
    console.log(`[Player] mpv using remote URL: ${item.url}`);
    return item.url; // mpv pode ler URLs HTTPS também!
  };

  // Função para pular para próximo item com fade
  const [playCount, setPlayCount] = React.useState(0);
  const skipToNext = React.useCallback(() => {
    console.log('[Player] Transitioning to next...');
    setVisible(false); // Inicia fade-out

    // Pequeno delay para o fade-out visual
    setTimeout(() => {
      setMpvPlaying(false);
      setCurrentIndex(prev => (prev + 1) % items.length);
      setPlayCount(c => c + 1);
    }, 400);
  }, [items.length]);

  // Registrar log de exibição quando a mídia muda
  React.useEffect(() => {
    if (!currentItem || !terminalId) return;

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
      cachedLocally: !!cacheMap[currentItem.id]
    };

    addToLogBuffer(logData);
    console.log(`[PoP] Buffered: "${currentItem.name}" (cached: ${!!cacheMap[currentItem.id]})`);
  }, [currentItem?.id, terminalId, cacheMap]);

  // Detectar se é vídeo
  const isCurrentVideo = currentItem && (
    currentItem.type === 'video' ||
    currentItem.url?.includes('.mp4') ||
    currentItem.url?.includes('.webm') ||
    currentItem.url?.includes('.mkv') ||
    currentItem.url?.includes('.avi')
  );

  // Listener para quando mpv termina o vídeo
  React.useEffect(() => {
    if (!window.electronAPI?.onMpvVideoEnded) return;

    const handleMpvEnded = (data) => {
      console.log('[Player] mpv video ended:', data);
      if (data.success) {
        skipToNext();
      } else {
        console.warn('[Player] mpv error, skipping:', data.error);
        remoteLog(terminalId, 'ERROR', 'mpv Playback Error', {
          name: currentItem?.name,
          error: data.error
        });
        skipToNext();
      }
    };

    window.electronAPI.onMpvVideoEnded(handleMpvEnded);

    // Cleanup: remover listener ao desmontar
    return () => {
      if (window.electronAPI?.removeMpvVideoEndedListener) {
        window.electronAPI.removeMpvVideoEndedListener();
      }
    };
  }, [skipToNext, terminalId, currentItem?.name]);

  // Efeito principal de playback e transições
  React.useEffect(() => {
    if (!currentItem || items.length === 0) return;

    // Iniciar animação de fade-in
    const fadeTimer = setTimeout(() => setVisible(true), 100);

    if (isCurrentVideo && window.electronAPI?.playVideo) {
      // === VÍDEO: Usar mpv nativo ===
      const videoPath = getMpvPath(currentItem);
      console.log(`[Player] Triggering mpv for: ${currentItem.name}`);

      // NÃO setar mpvPlaying(true) imediatamente para evitar flash preto
      window.electronAPI.playVideo(videoPath).then(result => {
        if (!result.success) {
          console.error('[Player] mpv failed to start:', result.error);
          remoteLog(terminalId, 'ERROR', 'mpv Start Error', {
            name: currentItem.name,
            error: result.error
          });
          setTimeout(skipToNext, 2000);
        }
      });

      // Aguardar 400ms para mostrar a máscara preta (Electron escondendo embaixo do mpv)
      const mpvMaskTimer = setTimeout(() => setMpvPlaying(true), 400);

      // Safety timeout
      const safetyTimer = setTimeout(() => {
        console.warn(`[Player] mpv safety timeout for "${currentItem.name}" - stopping`);
        window.electronAPI.stopVideo();
        skipToNext();
      }, 60 * 1000);

      return () => {
        clearTimeout(fadeTimer);
        clearTimeout(mpvMaskTimer);
        clearTimeout(safetyTimer);
      };
    } else {
      // === IMAGEM: Timer normal ===
      setMpvPlaying(false);
      const duration = (currentItem.duration || 10) * 1000;
      const timer = setTimeout(() => {
        skipToNext();
      }, duration);
      return () => {
        clearTimeout(fadeTimer);
        clearTimeout(timer);
      };
    }
  }, [currentIndex, currentItem, items, isCurrentVideo, playCount, skipToNext]);

  if (!currentItem) {
    return <div style={{ color: 'white' }}>Carregando mídia...</div>;
  }

  const mediaUrl = getMediaUrl(currentItem);

  // Tela configurada como portrait no Windows — fullscreen direto
  const containerStyle = {
    width: '100vw',
    height: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#000',
    overflow: 'hidden'
  };

  const mediaStyle = {
    width: '100%',
    height: '100%',
    objectFit: 'cover'
  };

  return (
    <div style={containerStyle}>
      {mpvPlaying ? (
        <div className="mpv-placeholder" />
      ) : (
        <div className={`media-wrapper ${visible ? 'visible' : ''}`}>
          {isCurrentVideo ? (
            <video
              key={`${currentItem.id}-${playCount}`}
              src={mediaUrl}
              autoPlay
              muted
              playsInline
              className="media-item"
              onEnded={skipToNext}
              onError={() => skipToNext()}
            />
          ) : (
            <img
              key={currentItem.id}
              src={mediaUrl}
              alt={currentItem.name}
              className="media-item"
              onError={(e) => {
                if (mediaUrl.startsWith('media-cache://')) {
                  e.target.src = currentItem.url;
                } else {
                  skipToNext();
                }
              }}
            />
          )}
        </div>
      )}

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

export default App;
