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
autoUpdater.autoDownload = false; // Mudar para manual para permitir Smoke Test pré-download
autoUpdater.autoInstallOnAppQuit = true;

// Estado do updater
let updateDownloaded = false;
let mainWindow = null;
let lastLoggedError = null;
let lastErrorTime = 0;
const ERROR_LOG_DEBOUNCE = 60 * 60 * 1000; // 1 hora

/**
 * Smoke Test — Verifica pré-condições antes de instalar update
 * @returns {{ pass: boolean, checks: Array<{name: string, pass: boolean, detail: string}> }}
 */
function runEnvironmentSmokeTest() {
    const checks = [];

    // Lógica unificada de busca (igual ao mpvPlayer.js)
    const findMpvBinary = () => {
        const bundledPaths = [
            path.join(process.resourcesPath || '', 'mpv', 'mpv.exe'),
            path.join(path.dirname(app.getPath('exe')), 'mpv', 'mpv.exe'),
            path.join(process.cwd(), 'mpv', 'mpv.exe'),
        ];
        for (const p of bundledPaths) {
            if (fs.existsSync(p)) return p;
        }
        return 'mpv'; // fallback
    };

    const mpvPath = findMpvBinary();
    const mpvExists = mpvPath !== 'mpv' && fs.existsSync(mpvPath);

    checks.push({
        name: 'mpv.exe',
        pass: mpvExists,
        detail: mpvExists ? `Encontrado em ${mpvPath}` : `NÃO encontrado nos caminhos de produção/dev`
    });

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
        const exePath = app.getPath('exe');
        const driveLetter = exePath.charAt(0);
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

        // ── Smoke Test PRÉ-DOWNLOAD ────────────────────────────
        console.log('[AutoUpdater] Executando environment smoke test...');
        const smokeResult = runEnvironmentSmokeTest();

        if (!smokeResult.pass) {
            const reasons = smokeResult.checks.filter(c => !c.pass).map(c => c.name).join(', ');
            console.error(`[AutoUpdater] ❌ Smoke test FALHOU (${reasons}) — Download cancelado para poupar banda.`);

            // Log de ERRO (apenas se for novo ou passou o debounce)
            logException('ERROR', `Update V${info.version} abortado: Ambiente íntegro (${reasons})`);

            sendToRenderer('update-status', {
                status: 'smoke-test-failed',
                version: info.version,
                reason: reasons
            });
            return;
        }

        // Ambiente OK: Notificar download iminente
        console.log('[AutoUpdater] ✅ Ambiente OK — Iniciando download...');
        logException('WARN', `Nova versão detectada: V${info.version}. Iniciando download silencioso.`);

        autoUpdater.downloadUpdate();

        sendToRenderer('update-status', {
            status: 'available',
            version: info.version
        });
    });

    autoUpdater.on('update-not-available', () => {
        // Silêncio total: Sem logs no Supabase se estiver atualizado
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

        logException('INFO', `Update V${info.version} baixado e pronto para instalação.`);

        sendToRenderer('update-status', {
            status: 'downloaded',
            version: info.version
        });

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
        const errorMsg = err.message || 'Erro desconhecido';
        console.error('[AutoUpdater] Erro:', errorMsg);

        // Log de erro curto no Supabase (com debounce)
        const errorCode = errorMsg.includes('404') ? 'GITHUB_404' :
            errorMsg.includes('network') ? 'NET_ERR' : 'UPD_ERR';

        logException('ERROR', `Auto-updater falhou: ${errorCode}`, { detail: errorMsg.substring(0, 100) });

        sendToRenderer('update-status', {
            status: 'error',
            message: errorMsg
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

/**
 * Envia log por exceção para o Supabase (via bridge no main.js)
 */
function logException(level, message, metadata = {}) {
    const now = Date.now();
    const isDebounced = level === 'ERROR' &&
        lastLoggedError === message &&
        (now - lastErrorTime < ERROR_LOG_DEBOUNCE);

    if (isDebounced) return;

    if (level === 'ERROR') {
        lastLoggedError = message;
        lastErrorTime = now;
    }

    // Emitir evento que o main.js captura e manda pro renderer
    // (Ponte: updater.js -> main.js -> renderer -> Supabase)
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('remote-log', {
            level,
            message: `[AutoUpdater] ${message}`,
            metadata: { ...metadata, updaterVersion: 'v2' }
        });
    }
}

module.exports = {
    initAutoUpdater,
    checkForUpdates,
    installUpdate,
    isUpdateReady
};
