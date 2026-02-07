const electron = require('electron');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { pathToFileURL } = require('url');

const { app, BrowserWindow, ipcMain, globalShortcut, protocol, powerSaveBlocker, net } = electron;

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
        try {
            console.log('[IPC] mpv-play-video:', filePath);
            // Minimizar/esconder janela Electron durante playback mpv
            // (mpv abre em fullscreen por cima)
            mpvPlayer.play(filePath).then(() => {
                console.log('[IPC] mpv video ended naturally');
                // Notificar renderer que o vídeo terminou
                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.webContents.send('mpv-video-ended', { success: true });
                    // Garantir que a janela Electron volta ao foco
                    mainWindow.focus();
                }
            }).catch((err) => {
                console.error('[IPC] mpv video error:', err.message);
                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.webContents.send('mpv-video-ended', { success: false, error: err.message });
                    mainWindow.focus();
                }
            });
            return { success: true };
        } catch (err) {
            console.error('[IPC] mpv play error:', err.message);
            return { success: false, error: err.message };
        }
    });

    ipcMain.handle('mpv-stop-video', () => {
        if (mpvPlayer) mpvPlayer.stop();
        return { success: true };
    });

    ipcMain.handle('mpv-is-available', () => {
        return mpvPlayer ? mpvPlayer.isAvailable() : false;
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

