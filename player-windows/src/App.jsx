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

// V16.0: Windows Electron Edition
const CURRENT_VERSION = "V16.0 WINDOWS";
const CURRENT_VERSION_CODE = 16.0;

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
// CACHE OFFLINE PARA LOGS DE PROOF OF PLAY
// ========================================
const PENDING_LOGS_KEY = 'pendingPopLogs';

// Salvar log no cache offline (localStorage)
const savePendingLog = (logData) => {
  try {
    const pending = JSON.parse(localStorage.getItem(PENDING_LOGS_KEY) || '[]');
    pending.push(logData);
    // Limitar a 500 logs pendentes para não estourar storage
    if (pending.length > 500) {
      pending.splice(0, pending.length - 500);
    }
    localStorage.setItem(PENDING_LOGS_KEY, JSON.stringify(pending));
    console.log(`[PoP] Saved offline (${pending.length} pending)`);
  } catch (e) {
    console.error('[PoP] Failed to save offline:', e);
  }
};

// Sincronizar logs pendentes quando conexão volta
const syncPendingLogs = async () => {
  try {
    const pending = JSON.parse(localStorage.getItem(PENDING_LOGS_KEY) || '[]');
    if (pending.length === 0) return;

    console.log(`[PoP] Syncing ${pending.length} pending logs...`);

    const { error } = await logPlaybackBatch(pending);

    if (!error) {
      localStorage.removeItem(PENDING_LOGS_KEY);
      console.log(`[PoP] Successfully synced ${pending.length} logs`);
    } else {
      console.warn('[PoP] Failed to sync pending logs:', error.message);
    }
  } catch (e) {
    console.error('[PoP] Error syncing pending logs:', e);
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
      <p className="subtitle" style={{ marginTop: '1rem', color: 'white', fontSize: '1.5rem' }}>V15.0 SUPABASE</p>
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
  const lastSentSettingsRef = useRef(null);

  // Telemetria de Inicialização
  useEffect(() => {
    remoteLog(terminalId, "INFO", "App.jsx Component Mounted", { version: CURRENT_VERSION });
    const splashTimer = setTimeout(() => {
      setShowSplash(false);
      remoteLog(terminalId, "INFO", "Splash Screen Auto-Dismissed");
    }, 10000);
    return () => clearTimeout(splashTimer);
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

    // Fetch inicial
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

    // Realtime subscription
    const channel = subscribeToPlaylist(playlistId, () => {
      fetchPlaylist(); // Refetch on change
    });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [terminalData?.assigned_playlist_id, authReady, terminalId]);

  // 5. Compile Effective Items
  useEffect(() => {
    if (!terminalData) return;
    const orientation = terminalData.orientation || 'landscape';
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
          orientation: slot.media.orientation || 'landscape',
          startDate: slot.media.start_date || slot.start_date || null,
          endDate: slot.media.end_date || slot.end_date || null
        }));
      console.log("[PLAYLIST] Loaded", items.length, "items from slots");
    }

    // ============================================
    // SISTEMA DE VALIDAÇÃO AVANÇADO (5 FILTROS)  
    // ============================================
    const AUDIO_EXTENSIONS = ['.mp3', '.wav', '.aac', '.ogg', '.m4a', '.flac'];
    const isTerminalVertical = orientation === 'vertical' || orientation === 'portrait';

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
      // 5. Orientação
      const isMediaVertical = item.orientation === 'vertical' || item.orientation === 'portrait';
      if (isTerminalVertical !== isMediaVertical) {
        console.warn(`[FILTER] Orientação incompatível: "${item.name}"`);
        return false;
      }
      return true;
    };

    const validatedItems = items.filter(validateMedia);
    if (items.length - validatedItems.length > 0) {
      remoteLog(terminalId, "INFO", "Content Filtered", { blocked: items.length - validatedItems.length });
    }

    // FAIL-SAFE: Tela Nunca Vazia
    const FALLBACK = { id: 'fallback', name: 'Institucional', url: 'https://images.unsplash.com/photo-1557672172-298e090bd0f1?w=1920&h=1080&fit=crop', type: 'image', duration: 15, orientation, slotType: 'fallback' };
    const finalItems = validatedItems.length > 0 ? validatedItems : [FALLBACK];
    if (validatedItems.length === 0 && items.length > 0) {
      console.warn("[FAIL-SAFE] Usando fallback");
      remoteLog(terminalId, "WARN", "Fail-Safe Activated");
    }

    // Build settings
    const currentSettings = {
      orientation,
      powerMode: terminalData.power_mode || 'auto',
      openingTime: terminalData.operating_start || '08:00',
      closingTime: terminalData.operating_end || '22:00',
      activeDays: terminalData.operating_days || [0, 1, 2, 3, 4, 5, 6]
    };

    const playlistChanged = JSON.stringify(finalItems) !== JSON.stringify(effectiveItems);
    const settingsChanged = JSON.stringify(currentSettings) !== JSON.stringify(lastSentSettingsRef.current);

    if (playlistChanged) {
      setEffectiveItems(finalItems);
      setDiag(prev => ({ ...prev, c: `M: ${finalItems.length} ${validatedItems.length === 0 ? '(FB)' : 'OK'}` }));
    }

    // Send to native
    if ((playlistChanged || settingsChanged) && finalItems.length > 0) {
      const configPayload = {
        playlist: finalItems,
        settings: currentSettings
      };

      console.log("Pushing Config V15 to Native", configPayload.playlist.length);
      remoteLog(terminalId, "INFO", "Pushing V15 Config to Native", { items: configPayload.playlist.length });

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
  }, [playlist, terminalData, terminalId, effectiveItems]);

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
        const time = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
        const op = (terminalData.operating_start || "08:00").substring(0, 5);
        const cl = (terminalData.operating_end || "22:00").substring(0, 5);
        sb = !days.includes(now.getDay()) || (op <= cl ? (time < op || time > cl) : (time < op && time > cl));
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

  // 7. Sync Periódico de Logs Pendentes (offline cache)
  useEffect(() => {
    if (!terminalId || !authReady) return;

    // Sync a cada 2 minutos para garantir qualidade do serviço
    const syncInterval = setInterval(() => {
      if (navigator.onLine) {
        syncPendingLogs();
      }
    }, 2 * 60 * 1000); // 2 minutos

    // Sync inicial após 10 segundos
    const initialSync = setTimeout(() => {
      if (navigator.onLine) {
        syncPendingLogs();
      }
    }, 10000);

    return () => {
      clearInterval(syncInterval);
      clearTimeout(initialSync);
    };
  }, [terminalId, authReady]);

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
        />
      )}
    </div>
  );
}

// Componente WebMediaPlayer para rodar mídias no browser
function WebMediaPlayer({ items, terminalId }) {
  const [currentIndex, setCurrentIndex] = React.useState(0);
  const currentItem = items[currentIndex];

  // Registrar log de exibição quando a mídia muda (com cache offline)
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
      appVersion: window.APP_VERSION || '1.0.0',
      playedAt: new Date().toISOString()
    };

    // Tentar enviar log de Proof of Play
    logPlayback(logData).then(() => {
      console.log(`[PoP] Logged: "${currentItem.name}"`);
      // Tentar sincronizar logs pendentes quando online
      syncPendingLogs();
    }).catch(err => {
      console.warn('[PoP] Failed to log, saving offline:', err.message);
      // Salvar no cache offline
      savePendingLog(logData);
    });
  }, [currentItem?.id, terminalId]); // Dispara quando a mídia muda

  // Timer para trocar de mídia
  React.useEffect(() => {
    if (!currentItem || items.length === 0) return;

    const duration = (currentItem.duration || 10) * 1000;
    const timer = setTimeout(() => {
      setCurrentIndex(prev => (prev + 1) % items.length);
    }, duration);

    return () => clearTimeout(timer);
  }, [currentIndex, currentItem, items]);

  if (!currentItem) {
    return <div style={{ color: 'white' }}>Carregando mídia...</div>;
  }

  const isVideo = currentItem.type === 'video' ||
    currentItem.url?.includes('.mp4') ||
    currentItem.url?.includes('.webm');

  // Estilos: objectFit cover para preencher tela sem barras pretas
  // Mídias incompatíveis já foram filtradas, então a mídia sempre
  // terá proporção adequada para o terminal
  const containerStyle = {
    width: '100vw',
    height: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#000',
    overflow: 'hidden'
  };

  // Estilo da mídia: preencher tela completamente
  const mediaStyle = {
    width: '100%',
    height: '100%',
    objectFit: 'cover'
  };

  return (
    <div style={containerStyle}>
      {isVideo ? (
        <video
          key={currentItem.id}
          src={currentItem.url}
          autoPlay
          muted
          style={mediaStyle}
          onEnded={() => setCurrentIndex(prev => (prev + 1) % items.length)}
        />
      ) : (
        <img
          key={currentItem.id}
          src={currentItem.url}
          alt={currentItem.name}
          style={mediaStyle}
        />
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
        {items.map((_, idx) => (
          <div
            key={idx}
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: idx === currentIndex ? '#6366f1' : 'rgba(255,255,255,0.3)'
            }}
          />
        ))}
      </div>
    </div>
  );
}

export default App;
