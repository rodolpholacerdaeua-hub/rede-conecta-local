const electron = require('electron');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const { app, BrowserWindow, ipcMain, globalShortcut } = electron;

// Auto-Updater
const { initAutoUpdater, checkForUpdates, installUpdate, isUpdateReady } = require('./updater');

let mainWindow = null;

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
    // MODO KIOSK: Configuração de tela cheia
    // ============================================
    mainWindow = new BrowserWindow({
        width: 1920,
        height: 1080,
        fullscreen: !isDev,           // Fullscreen em produção
        kiosk: !isDev,                // Modo kiosk em produção
        autoHideMenuBar: true,
        frame: isDev,                 // Frame apenas em dev
        alwaysOnTop: !isDev,          // Sempre no topo em produção
        skipTaskbar: !isDev,          // Esconder da taskbar em produção
        backgroundColor: '#0a0a0a',
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        }
    });

    if (isDev) {
        mainWindow.loadURL('http://localhost:5180');
        mainWindow.webContents.openDevTools();
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
}

// App ready
app.whenReady().then(() => {
    console.log('[Electron] Main process started');
    console.log('[Electron] Hardware ID:', getHardwareId());
    console.log('[Electron] Modo:', app.isPackaged ? 'PRODUÇÃO (Kiosk)' : 'DESENVOLVIMENTO');

    setupIpcHandlers();
    setupAutoStart();
    createWindow();

    // Inicializar auto-updater após criar janela
    initAutoUpdater(mainWindow);
});

app.on('window-all-closed', () => {
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

