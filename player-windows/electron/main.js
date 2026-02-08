const electron = require('electron');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { pathToFileURL } = require('url');
const { execSync } = require('child_process');

const { app, BrowserWindow, ipcMain, globalShortcut, protocol, powerSaveBlocker, net } = electron;

// Flag de boot rápido: se o app demorou >5min após boot do Windows
let isDelayedBoot = false;
let bootDelaySeconds = 0;

// Auto-Updater
const { initAutoUpdater, checkForUpdates, installUpdate, isUpdateReady } = require('./updater');

// Cache Manager para Offline-First
const CacheManager = require('./cacheManager');

// mpv Player para vídeos (suporta TODOS os codecs)
const MpvPlayer = require('./mpvPlayer');

// Migração e Proteção contra Crash Loops
const Migrator = require('./migrator');
const CrashGuard = require('./crashGuard');

let mainWindow = null;
let cacheManager = null;
let mpvPlayer = null;
let powerSaveId = null;
let isMpvPlaying = false;
let currentPlayId = 0;
let crashGuard = null;

// ============================================
// REGISTRAR ESQUEMA PRIVILEGIADO (ANTES do app.ready!)
// standard: true - resolve URLs corretamente (RFC 3986)
// secure: true - trata como origem segura
// bypassCSP: true - evita bloqueio por Content Security Policy
// supportFetchAPI: true - permite fetch() no renderer
// stream: true - OBRIGATÓRIO para <video> e <audio>
// ============================================
protocol.registerSchemesAsPrivileged([
    {
        scheme: 'media-cache',
        privileges: {
            standard: true,
            secure: true,
            bypassCSP: true,
            supportFetchAPI: true,
            stream: true
        }
    }
]);

// Gerar Hardware ID único baseado no MAC Address
function getHardwareId() {
    const networkInterfaces = os.networkInterfaces();
    let mac = null;

    for (const name of Object.keys(networkInterfaces)) {
        for (const net of networkInterfaces[name]) {
            if (!net.internal && net.mac && net.mac !== '00:00:00:00:00:00') {
                mac = net.mac;
                break;
            }
        }
        if (mac) break;
    }

    if (mac) {
        return crypto.createHash('sha256').update(mac).digest('hex').substring(0, 32);
    }

    const fallback = os.hostname() + '-' + crypto.randomBytes(8).toString('hex');
    return crypto.createHash('sha256').update(fallback).digest('hex').substring(0, 32);
}

// ============================================
// AUTO-START: Configurar inicialização automática
// ============================================
function setupAutoStart() {
    const isDev = !app.isPackaged;
    if (isDev) return; // Não configurar em dev

    app.setLoginItemSettings({
        openAtLogin: true,
        openAsHidden: false,
        path: app.getPath('exe'),
        args: []
    });
    console.log('[Electron] Auto-start configurado');
}

function createWindow() {
    const isDev = !app.isPackaged;

    // ============================================
    // MODO DEBUG: Desativa kiosk para testes
    // Criar arquivo ".debug" em %APPDATA%/Rede Conecta Player/
    // ou passar --debug na linha de comando
    // CrashGuard modo seguro também desativa kiosk
    // ============================================
    const fs = require('fs');
    const debugFilePath = path.join(app.getPath('userData'), '.debug');
    const isSafeMode = crashGuard?.isSafeMode || false;
    const isDebugMode = isDev || isSafeMode || fs.existsSync(debugFilePath) || process.argv.includes('--debug');

    if (isSafeMode) {
        console.error('[Electron] ⚠️ MODO SEGURO (CrashGuard) - Kiosk desabilitado, DevTools aberto');
    }

    if (isDebugMode && !isDev) {
        console.log('[Electron] ⚠️ MODO DEBUG ATIVO - Kiosk desabilitado');
    }

    // ============================================
    // MODO KIOSK: Configuração de tela cheia
    // ============================================
    mainWindow = new BrowserWindow({
        width: 1920,
        height: 1080,
        fullscreen: !isDebugMode,         // Fullscreen desativado em debug
        kiosk: !isDebugMode,              // Modo kiosk desativado em debug
        autoHideMenuBar: true,
        frame: isDebugMode,               // Frame visível em debug
        alwaysOnTop: !isDebugMode,        // Sempre no topo desativado em debug
        skipTaskbar: !isDebugMode,        // Taskbar visível em debug
        backgroundColor: '#0a0a0a',
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        }
    });

    // Abrir DevTools em modo debug (inclui dev e produção com .debug)
    if (isDebugMode) {
        mainWindow.webContents.openDevTools();
    }

    if (isDev) {
        mainWindow.loadURL('http://localhost:5180');
    } else {
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    }

    mainWindow.on('closed', () => {
        mainWindow = null;
    });

    // ============================================
    // BLOQUEIO DE TECLAS PERIGOSAS (apenas produção)
    // ============================================
    if (!isDev) {
        // Prevenir fechamento via Alt+F4
        mainWindow.on('close', (e) => {
            // Permite fechar apenas via atalho secreto ou código
            if (!mainWindow.allowClose) {
                e.preventDefault();
            }
        });

        // Bloquear teclas no input
        mainWindow.webContents.on('before-input-event', (event, input) => {
            // Bloquear Alt+F4
            if (input.alt && input.key === 'F4') {
                event.preventDefault();
            }
            // Bloquear Alt+Tab (não funciona em Windows, mas tentamos)
            if (input.alt && input.key === 'Tab') {
                event.preventDefault();
            }
            // Bloquear F11 (toggle fullscreen)
            if (input.key === 'F11') {
                event.preventDefault();
            }
            // ATALHO SECRETO: Ctrl+Shift+Q para sair
            if (input.control && input.shift && input.key.toLowerCase() === 'q') {
                mainWindow.allowClose = true;
                app.quit();
            }
        });
    } else {
        // Em dev, permitir Ctrl+Shift+Q normalmente
        mainWindow.webContents.on('before-input-event', (event, input) => {
            if (input.control && input.shift && input.key.toLowerCase() === 'q') {
                app.quit();
            }
        });
    }

    // ============================================
    // ATALHO GLOBAL: Ctrl+Shift+Q (funciona em modo kiosk)
    // ============================================
    globalShortcut.register('CommandOrControl+Shift+Q', () => {
        console.log('[Electron] Atalho secreto acionado - saindo...');
        mainWindow.allowClose = true;
        app.quit();
    });
    console.log('[Electron] Atalho secreto Ctrl+Shift+Q registrado');
}

// Setup IPC handlers
function setupIpcHandlers() {
    ipcMain.handle('get-hardware-id', () => getHardwareId());
    ipcMain.handle('get-platform', () => 'windows');
    ipcMain.handle('get-version', () => app.getVersion());
    ipcMain.handle('is-kiosk-mode', () => !app.isPackaged ? false : true);

    // BLINDAGEM: Info de boot para skip de loading
    ipcMain.handle('get-boot-info', () => ({
        isDelayedBoot,
        bootDelaySeconds: Math.round(bootDelaySeconds),
        shouldFastStart: isDelayedBoot, // renderer usa pra pular animações
    }));

    // Auto-updater handlers
    ipcMain.handle('check-for-updates', () => checkForUpdates());
    ipcMain.handle('install-update', () => installUpdate());
    ipcMain.handle('is-update-ready', () => isUpdateReady());

    // ============================================
    // CACHE MANAGER HANDLERS (Offline-First)
    // ============================================
    ipcMain.handle('cache-get-local-path', async (_, mediaId) => {
        if (!cacheManager) return null;
        return cacheManager.getLocalPath(mediaId);
    });

    ipcMain.handle('cache-ensure-cached', async (_, mediaItem) => {
        if (!cacheManager) return null;
        try {
            return await cacheManager.ensureCached(mediaItem);
        } catch (err) {
            console.error('[IPC] Cache ensure failed:', err.message);
            return null;
        }
    });

    ipcMain.handle('cache-sync-playlist', async (_, playlistItems) => {
        if (!cacheManager) return {};
        try {
            const results = await cacheManager.syncPlaylist(playlistItems, (progress) => {
                // Enviar progresso para renderer
                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.webContents.send('cache-progress', progress);
                }
            });
            // Converter Map para Object para serialização IPC
            return Object.fromEntries(results);
        } catch (err) {
            console.error('[IPC] Cache sync failed:', err.message);
            return {};
        }
    });

    ipcMain.handle('cache-get-stats', () => {
        if (!cacheManager) return null;
        return cacheManager.getStats();
    });

    ipcMain.handle('cache-is-cached', (_, mediaId) => {
        if (!cacheManager) return false;
        return cacheManager.isCached(mediaId);
    });

    ipcMain.handle('cache-clear-all', () => {
        if (!cacheManager) return;
        cacheManager.clearAll();
    });

    // ============================================
    // MPV PLAYER HANDLERS (Native Video Playback)
    // ============================================

    ipcMain.handle('mpv-play-video', async (_, filePath) => {
        if (!mpvPlayer) return { success: false, error: 'mpv not initialized' };

        const myPlayId = ++currentPlayId;
        isMpvPlaying = true;

        try {
            console.log(`[IPC] mpv-play-video [ID:${myPlayId}]:`, filePath);

            // Telemetria detalhada para o Supabase (via renderer)
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('remote-log', {
                    level: 'INFO',
                    message: `Iniciando mpv [ID:${myPlayId}]`,
                    metadata: { filePath: filePath.substring(0, 50) + '...' }
                });
            }

            mpvPlayer.play(filePath).then(() => {
                // Só enviar o evento se este ainda for o play atual
                if (myPlayId === currentPlayId) {
                    console.log(`[IPC] mpv video [ID:${myPlayId}] ended naturally`);
                    isMpvPlaying = false;
                    if (mainWindow && !mainWindow.isDestroyed()) {
                        mainWindow.webContents.send('mpv-video-ended', { success: true });
                        mainWindow.focus();
                    }
                }
            }).catch((err) => {
                if (myPlayId === currentPlayId) {
                    console.error(`[IPC] mpv video [ID:${myPlayId}] error:`, err.message);
                    isMpvPlaying = false;
                    if (mainWindow && !mainWindow.isDestroyed()) {
                        mainWindow.webContents.send('mpv-video-ended', { success: false, error: err.message });
                        mainWindow.focus();
                    }
                }
            });
            return { success: true };
        } catch (err) {
            isMpvPlaying = false;
            console.error('[IPC] mpv play error:', err.message);
            return { success: false, error: err.message };
        }
    });

    ipcMain.handle('mpv-stop-video', () => {
        isMpvPlaying = false;
        if (mpvPlayer) mpvPlayer.stop();
        return { success: true };
    });

    ipcMain.handle('mpv-is-available', () => {
        return mpvPlayer ? mpvPlayer.isAvailable() : false;
    });

    // Ponte de logs para o renderer (para telemetria remota)
    ipcMain.on('remote-log-send', (event, { level, message, metadata }) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('remote-log', { level, message, metadata });
        }
    });

}

// ============================================
// REGISTER FILE PROTOCOL para mídias locais
// ============================================
function setupMediaProtocol() {
    protocol.handle('media-cache', (request) => {
        try {
            // Parsear URL de forma segura (standard scheme usa host + pathname)
            // URL agora vem como: media-cache://local/filename.mp4
            // (não mais com caminho absoluto Windows para evitar URL safety check do Chromium)
            const url = new URL(request.url);

            // pathname vem como /filename.mp4 - remover a / inicial
            let fileName = decodeURIComponent(url.pathname);
            if (fileName.startsWith('/')) {
                fileName = fileName.substring(1);
            }

            // Resolver o caminho completo usando o diretório de cache
            const userDataPath = app.getPath('userData');
            const filePath = path.join(userDataPath, 'media-cache', 'media', fileName);

            console.log(`[MediaProtocol] Serving: ${filePath}`);

            // Verificar se o arquivo existe antes de servir
            const fs = require('fs');
            if (!fs.existsSync(filePath)) {
                console.error(`[MediaProtocol] File not found: ${filePath}`);
                return new Response('File not found', { status: 404 });
            }

            // Usar net.fetch com pathToFileURL - suporta range requests nativamente
            const fileUrl = pathToFileURL(filePath).toString();
            return net.fetch(fileUrl);
        } catch (err) {
            console.error(`[MediaProtocol] Error:`, err.message);
            return new Response('File not found', { status: 404 });
        }
    });
    console.log('[Electron] media-cache:// protocol registered (standard + stream + range)');
}

// App ready
app.whenReady().then(async () => {
    console.log('[Electron] Main process started');
    console.log('[Electron] Hardware ID:', getHardwareId());
    console.log('[Electron] Versão:', app.getVersion());
    console.log('[Electron] Modo:', app.isPackaged ? 'PRODUÇÃO (Kiosk)' : 'DESENVOLVIMENTO');

    // ============================================
    // BLINDAGEM 1: Detecção de Boot Atrasado
    // Se o app demorou >5min após boot do Windows,
    // possivelmente ficou preso em Windows Update.
    // ============================================
    const BOOT_DELAY_THRESHOLD = 5 * 60; // 5 minutos em segundos
    const systemUptime = os.uptime();
    bootDelaySeconds = systemUptime;
    isDelayedBoot = systemUptime > BOOT_DELAY_THRESHOLD;

    console.log(`[BOOT] Uptime do sistema: ${Math.round(systemUptime)}s (${(systemUptime / 60).toFixed(1)} min)`);
    if (isDelayedBoot) {
        console.warn(`[BOOT] ⚠️ ATRASO DETECTADO: App iniciou ${Math.round(systemUptime / 60)} min após boot do Windows`);
    } else {
        console.log('[BOOT] ✅ Inicialização rápida — app iniciou dentro do tempo esperado');
    }

    // ============================================
    // BLINDAGEM 2: Prioridade Alta do Processo
    // ============================================
    if (!app.isPackaged) {
        console.log('[PRIORITY] Modo dev — prioridade não alterada');
    } else {
        const { setHighPriority } = require('./platformUtils');
        setHighPriority();
    }

    // ============================================
    // CRASH GUARD - Verificar crash loops
    // ============================================
    crashGuard = new CrashGuard(app.getPath('userData'));
    const isSafeMode = await crashGuard.check(app.getVersion());
    if (!isSafeMode) {
        crashGuard.startStabilityTimer();
    }

    // ============================================
    // MIGRAÇÃO DE VERSÃO (V16 → V17, etc.)
    // ============================================
    const migrator = new Migrator(app.getPath('userData'), app.getVersion());
    await migrator.runMigration();

    // ============================================
    // PREVENIR SUSPENSÃO DO WINDOWS
    // ============================================
    powerSaveId = powerSaveBlocker.start('prevent-display-sleep');
    console.log('[Electron] PowerSaveBlocker ativo:', powerSaveBlocker.isStarted(powerSaveId));

    // ============================================
    // INICIALIZAR CACHE MANAGER (Offline-First)
    // ============================================
    const cacheDir = path.join(app.getPath('userData'), 'media-cache');
    cacheManager = new CacheManager(cacheDir, 5 * 1024 * 1024 * 1024); // 5GB
    console.log('[Electron] CacheManager initialized at:', cacheDir);

    // Registrar protocolo para mídias locais
    setupMediaProtocol();

    // Inicializar mpv player
    mpvPlayer = new MpvPlayer();
    console.log('[Electron] MpvPlayer initialized, available:', mpvPlayer.isAvailable());

    setupIpcHandlers();
    setupAutoStart();
    createWindow();

    // Inicializar auto-updater após criar janela
    initAutoUpdater(mainWindow);

    // ============================================
    // BLINDAGEM 3: Alerta de Boot Atrasado (Supabase Log)
    // Envia WARN para terminal_logs se houve atraso
    // ============================================
    if (isDelayedBoot) {
        mainWindow.webContents.once('did-finish-load', () => {
            mainWindow.webContents.executeJavaScript(`
                (async () => {
                    try {
                        if (window.__electronAPI?.sendLog) {
                            await window.__electronAPI.sendLog('WARN', 'Atraso na inicialização detectado - Possível Windows Update', {
                                systemUptime: ${Math.round(bootDelaySeconds)},
                                delayMinutes: ${(bootDelaySeconds / 60).toFixed(1)},
                                threshold: '5 min'
                            });
                        }
                    } catch(e) { console.error('[BOOT-LOG]', e); }
                })()
            `);
        });
    }

    // ============================================
    // BLINDAGEM 4: Monitoramento de Foco (Watchdog)
    // A cada 60s, garante que o player está em
    // Always-on-Top e com foco total.
    // ============================================
    if (!app.isPackaged) {
        console.log('[WATCHDOG] Modo dev — monitoramento de foco desativado');
    } else {
        setInterval(() => {
            if (!mainWindow || mainWindow.isDestroyed()) return;

            // BLINDAGEM: Não roubar o foco se o mpv estiver rodando!
            // Se o Electron ganhar foco, ele cobre o mpv (mesmo que ambos sejam ontop)
            if (isMpvPlaying) {
                console.log('[WATCHDOG] mpv em execução — pulando reforço de foco do Electron');
                return;
            }

            // Forçar Always on Top
            if (!mainWindow.isAlwaysOnTop()) {
                console.warn('[WATCHDOG] ⚠️ Janela perdeu Always-on-Top — restaurando');
                mainWindow.setAlwaysOnTop(true, 'screen-saver');
            }

            // Forçar Foco
            if (!mainWindow.isFocused()) {
                console.warn('[WATCHDOG] ⚠️ Janela perdeu foco — trazendo para frente');
                mainWindow.show();
                mainWindow.focus();
                mainWindow.moveTop();
            }

            // Garantir fullscreen
            if (!mainWindow.isFullScreen() && !mainWindow.isKiosk) {
                mainWindow.setFullScreen(true);
            }
        }, 60 * 1000); // A cada 1 minuto

        console.log('[WATCHDOG] ✅ Monitoramento de foco ativo (intervalo: 60s)');
    }
});

app.on('window-all-closed', () => {
    globalShortcut.unregisterAll();
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (mainWindow === null) {
        createWindow();
    }
});

// Single instance lock
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
    app.quit();
} else {
    app.on('second-instance', () => {
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.focus();
        }
    });
}

