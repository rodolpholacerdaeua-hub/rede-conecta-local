/**
 * Platform Utilities - Rede Conecta Player
 * Centraliza toda lógica platform-specific (Windows vs Linux)
 */

const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
const { app } = require('electron');

const isWindows = process.platform === 'win32';
const isLinux = process.platform === 'linux';

/**
 * Retorna o nome do binário mpv para a plataforma atual
 */
function getMpvBinaryName() {
    return isWindows ? 'mpv.exe' : 'mpv';
}

/**
 * Encontra o binário mpv (bundled → sistema → PATH)
 * @returns {string} Caminho absoluto ou 'mpv' como fallback
 */
function findMpvBinary() {
    const binaryName = getMpvBinaryName();

    // 1. Bundled com o app (produção)
    const bundledPaths = [
        path.join(process.resourcesPath || '', 'mpv', binaryName),
        path.join(path.dirname(app.getPath('exe')), 'mpv', binaryName),
    ];

    // Dev paths
    if (!app.isPackaged) {
        bundledPaths.push(path.join(process.cwd(), 'mpv', binaryName));
    }

    for (const p of bundledPaths) {
        if (fs.existsSync(p)) return p;
    }

    // 2. Binário do sistema (Linux)
    if (isLinux) {
        const systemPaths = [
            '/usr/bin/mpv',
            '/usr/local/bin/mpv',
            '/snap/bin/mpv',
        ];
        for (const p of systemPaths) {
            if (fs.existsSync(p)) return p;
        }
    }

    // 3. Fallback: confiar no PATH do sistema
    return isWindows ? 'mpv' : 'mpv';
}

/**
 * Verifica se o mpv está disponível no sistema
 * @returns {{ found: boolean, path: string }}
 */
function checkMpvAvailability() {
    const mpvPath = findMpvBinary();
    const isAbsolute = path.isAbsolute(mpvPath);
    const found = isAbsolute ? fs.existsSync(mpvPath) : (() => {
        try {
            execSync(`${isWindows ? 'where' : 'which'} mpv`, { stdio: 'ignore' });
            return true;
        } catch {
            return false;
        }
    })();

    return { found, path: mpvPath };
}

/**
 * Obtém espaço livre em disco (em bytes)
 * @returns {number|null} Bytes livres ou null se indisponível
 */
function getFreeDiskSpace() {
    try {
        if (isWindows) {
            const exePath = app.getPath('exe');
            const driveLetter = exePath.charAt(0);
            const output = execSync(
                `wmic logicaldisk where "DeviceID='${driveLetter}:'" get FreeSpace /value`,
                { encoding: 'utf8', timeout: 5000 }
            );
            const match = output.match(/FreeSpace=(\d+)/);
            return match ? parseInt(match[1], 10) : null;
        } else {
            // Linux: df retorna espaço livre da partição raiz
            const output = execSync(
                `df -B1 / | awk 'NR==2{print $4}'`,
                { encoding: 'utf8', timeout: 5000 }
            );
            const bytes = parseInt(output.trim(), 10);
            return isNaN(bytes) ? null : bytes;
        }
    } catch {
        return null;
    }
}

/**
 * Eleva a prioridade do processo atual
 */
function setHighPriority() {
    try {
        const pid = process.pid;
        if (isWindows) {
            execSync(`wmic process where processid=${pid} CALL setpriority 128`, { stdio: 'ignore' });
        } else {
            // Linux: renice -10 (precisa de permissão ou nice cap)
            execSync(`renice -n -10 -p ${pid}`, { stdio: 'ignore' });
        }
        console.log(`[PRIORITY] ✅ Processo elevado para Alta Prioridade (PID: ${pid})`);
        return true;
    } catch (e) {
        console.warn('[PRIORITY] ⚠️ Não foi possível elevar prioridade:', e.message);
        return false;
    }
}

module.exports = {
    isWindows,
    isLinux,
    getMpvBinaryName,
    findMpvBinary,
    checkMpvAvailability,
    getFreeDiskSpace,
    setHighPriority,
};
