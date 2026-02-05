/**
 * Auto-Updater Module - Rede Conecta Player
 * Gerencia atualizações automáticas via GitHub Releases
 */

const { autoUpdater } = require('electron-updater');
const { app, BrowserWindow } = require('electron');

// Configuração do auto-updater
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;

// Estado do updater
let updateDownloaded = false;
let mainWindow = null;

/**
 * Inicializa o auto-updater
 * @param {BrowserWindow} win - Janela principal do app
 */
function initAutoUpdater(win) {
    mainWindow = win;

    // Não verificar em modo dev
    if (!app.isPackaged) {
        console.log('[AutoUpdater] Modo dev - atualizações desabilitadas');
        return;
    }

    console.log('[AutoUpdater] Inicializando...');
    console.log('[AutoUpdater] Versão atual:', app.getVersion());

    // Configurar logs
    autoUpdater.logger = {
        info: (msg) => console.log('[AutoUpdater]', msg),
        warn: (msg) => console.warn('[AutoUpdater]', msg),
        error: (msg) => console.error('[AutoUpdater]', msg)
    };

    // Event handlers
    autoUpdater.on('checking-for-update', () => {
        console.log('[AutoUpdater] Verificando atualizações...');
        sendToRenderer('update-status', { status: 'checking' });
    });

    autoUpdater.on('update-available', (info) => {
        console.log('[AutoUpdater] Atualização disponível:', info.version);
        sendToRenderer('update-status', {
            status: 'available',
            version: info.version
        });
    });

    autoUpdater.on('update-not-available', () => {
        console.log('[AutoUpdater] App está atualizado');
        sendToRenderer('update-status', { status: 'up-to-date' });
    });

    autoUpdater.on('download-progress', (progress) => {
        const percent = Math.round(progress.percent);
        console.log(`[AutoUpdater] Baixando: ${percent}%`);
        sendToRenderer('update-status', {
            status: 'downloading',
            percent
        });
    });

    autoUpdater.on('update-downloaded', (info) => {
        console.log('[AutoUpdater] Download completo:', info.version);
        updateDownloaded = true;
        sendToRenderer('update-status', {
            status: 'downloaded',
            version: info.version
        });
    });

    autoUpdater.on('error', (err) => {
        console.error('[AutoUpdater] Erro:', err.message);
        sendToRenderer('update-status', {
            status: 'error',
            message: err.message
        });
    });

    // Verificar atualizações na inicialização (após 10 segundos)
    setTimeout(() => {
        checkForUpdates();
    }, 10000);

    // Verificar periodicamente (a cada 1 hora)
    setInterval(() => {
        checkForUpdates();
    }, 60 * 60 * 1000);
}

/**
 * Verifica se há atualizações disponíveis
 */
function checkForUpdates() {
    if (!app.isPackaged) return;

    try {
        autoUpdater.checkForUpdatesAndNotify();
    } catch (err) {
        console.error('[AutoUpdater] Erro ao verificar:', err.message);
    }
}

/**
 * Instala a atualização baixada e reinicia o app
 */
function installUpdate() {
    if (updateDownloaded) {
        console.log('[AutoUpdater] Instalando atualização e reiniciando...');
        autoUpdater.quitAndInstall(false, true);
    }
}

/**
 * Envia mensagem para o renderer process
 */
function sendToRenderer(channel, data) {
    if (mainWindow && mainWindow.webContents) {
        mainWindow.webContents.send(channel, data);
    }
}

/**
 * Retorna se há atualização pronta para instalar
 */
function isUpdateReady() {
    return updateDownloaded;
}

module.exports = {
    initAutoUpdater,
    checkForUpdates,
    installUpdate,
    isUpdateReady
};
