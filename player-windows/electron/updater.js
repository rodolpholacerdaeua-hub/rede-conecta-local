/**
 * Auto-Updater Module - Rede Conecta Player
 * Gerencia atualizações automáticas via GitHub Releases
 */

const { autoUpdater } = require('electron-updater');
const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

// Configuração do auto-updater
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;

// Estado do updater
let updateDownloaded = false;
let mainWindow = null;

/**
 * Smoke Test — Verifica pré-condições antes de instalar update
 * @returns {{ pass: boolean, checks: Array<{name: string, pass: boolean, detail: string}> }}
 */
function runPreInstallSmokeTest() {
    const checks = [];
    const appDir = app.isPackaged ? path.dirname(app.getPath('exe')) : process.cwd();

    // 1. Verificar que mpv.exe existe e é acessível
    try {
        const mpvPath = path.join(appDir, 'mpv', 'mpv.exe');
        const mpvExists = fs.existsSync(mpvPath);
        checks.push({
            name: 'mpv.exe',
            pass: mpvExists,
            detail: mpvExists ? `Encontrado em ${mpvPath}` : `Não encontrado em ${mpvPath}`
        });
    } catch (err) {
        checks.push({ name: 'mpv.exe', pass: false, detail: `Erro: ${err.message}` });
    }

    // 2. Verificar que o SQLite DB pode ser acessado
    try {
        const userDataPath = app.getPath('userData');
        const dbPath = path.join(userDataPath, 'player.db');
        const dbExists = fs.existsSync(dbPath);

        if (dbExists) {
            // Verificar se pode ler o arquivo
            const stats = fs.statSync(dbPath);
            const isReadable = stats.size > 0;
            checks.push({
                name: 'SQLite DB',
                pass: isReadable,
                detail: isReadable ? `OK (${(stats.size / 1024).toFixed(1)}KB)` : 'Arquivo vazio/corrompido'
            });
        } else {
            // DB não existe ainda = app novo, não é erro crítico
            checks.push({ name: 'SQLite DB', pass: true, detail: 'Não existe (será criado no primeiro boot)' });
        }
    } catch (err) {
        checks.push({ name: 'SQLite DB', pass: false, detail: `Erro: ${err.message}` });
    }

    // 3. Verificar espaço em disco mínimo (500MB)
    try {
        const driveLetter = appDir.charAt(0);
        let freeBytes = null;

        try {
            // Windows: usar wmic para obter espaço livre
            const output = execSync(
                `wmic logicaldisk where "DeviceID='${driveLetter}:'" get FreeSpace /value`,
                { encoding: 'utf8', timeout: 5000 }
            );
            const match = output.match(/FreeSpace=(\d+)/);
            if (match) freeBytes = parseInt(match[1], 10);
        } catch {
            // Fallback: tentar via fsPromises (não bloqueia se wmic falhar)
            console.warn('[SmokeTest] wmic indisponível, pulando check de disco');
        }

        if (freeBytes !== null) {
            const freeMB = freeBytes / (1024 * 1024);
            const hasSpace = freeMB >= 500;
            checks.push({
                name: 'Espaço em disco',
                pass: hasSpace,
                detail: `${Math.round(freeMB)}MB livres em ${driveLetter}: (mínimo: 500MB)`
            });
        } else {
            checks.push({ name: 'Espaço em disco', pass: true, detail: 'Check não disponível (pulado)' });
        }
    } catch (err) {
        checks.push({ name: 'Espaço em disco', pass: true, detail: `Check falhou: ${err.message} (pulado)` });
    }

    const allPass = checks.every(c => c.pass);

    console.log('[SmokeTest] Resultado:', allPass ? '✅ PASSED' : '❌ FAILED');
    checks.forEach(c => {
        console.log(`  ${c.pass ? '✅' : '❌'} ${c.name}: ${c.detail}`);
    });

    return { pass: allPass, checks };
}

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

        // ── Smoke Test antes de instalar ────────────────────────────
        console.log('[AutoUpdater] Executando smoke test pré-instalação...');
        const smokeResult = runPreInstallSmokeTest();

        if (!smokeResult.pass) {
            const failedChecks = smokeResult.checks.filter(c => !c.pass);
            const reasons = failedChecks.map(c => `${c.name}: ${c.detail}`).join('; ');

            console.error(`[AutoUpdater] ❌ Smoke test FALHOU — update ABORTADO. Motivos: ${reasons}`);
            sendToRenderer('update-status', {
                status: 'smoke-test-failed',
                version: info.version,
                reason: reasons,
                checks: smokeResult.checks
            });

            // NÃO instalar — app continua rodando na versão atual
            return;
        }

        console.log('[AutoUpdater] ✅ Smoke test PASSED — prosseguindo com instalação');

        // Em modo kiosk, instalar automaticamente após 5 segundos
        // (o app nunca fecha em modo kiosk, então autoInstallOnAppQuit não funciona)
        console.log('[AutoUpdater] Instalando automaticamente em 5 segundos...');
        setTimeout(() => {
            console.log('[AutoUpdater] Instalando e reiniciando agora!');
            // Permitir que a janela feche para o instalador
            if (mainWindow) {
                mainWindow.allowClose = true;
            }
            autoUpdater.quitAndInstall(true, true);
        }, 5000);
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

    // Verificar periodicamente (a cada 10 minutos)
    setInterval(() => {
        checkForUpdates();
    }, 10 * 60 * 1000);
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
        autoUpdater.quitAndInstall(true, true);
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
