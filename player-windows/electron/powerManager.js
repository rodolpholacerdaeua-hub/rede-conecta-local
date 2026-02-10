/**
 * Power Manager - Gerenciamento de energia do terminal
 * 
 * Controla:
 * - Desligar/ligar monitor (TV detecta "sem sinal" → standby)
 * - Hibernar PC (0W de consumo)
 * - Agendar wake via Windows Task Scheduler
 */

const { execSync, exec } = require('child_process');
const path = require('path');

const TASK_NAME = 'RedeConectaWake';

/**
 * Garante que hibernação está habilitada no Windows
 */
function ensureHibernateEnabled() {
    try {
        // Habilitar hibernação
        execSync('powercfg /h on', { stdio: 'ignore' });
        console.log('[PowerManager] Hibernação habilitada');

        // Habilitar wake timers (necessário para Task Scheduler acordar o PC)
        execSync('powercfg /SETACVALUEINDEX SCHEME_CURRENT SUB_SLEEP RTCWAKE 1', { stdio: 'ignore' });
        execSync('powercfg /SETDCVALUEINDEX SCHEME_CURRENT SUB_SLEEP RTCWAKE 1', { stdio: 'ignore' });
        execSync('powercfg /SETACTIVE SCHEME_CURRENT', { stdio: 'ignore' });
        console.log('[PowerManager] Wake timers habilitados');
    } catch (err) {
        console.warn('[PowerManager] Não foi possível configurar power settings:', err.message);
    }
}

/**
 * Desliga o monitor (TV entra em standby ao perder sinal HDMI)
 */
function turnOffDisplay() {
    try {
        const ps = `Add-Type -TypeDefinition 'using System;using System.Runtime.InteropServices;public class Monitor{[DllImport("user32.dll")]public static extern int SendMessage(int hWnd,int Msg,int wParam,int lParam);public static void Off(){SendMessage(-1,0x0112,0xF170,2);}}';[Monitor]::Off()`;
        execSync(`powershell -NoProfile -Command "${ps}"`, { stdio: 'ignore' });
        console.log('[PowerManager] Monitor desligado');
    } catch (err) {
        console.error('[PowerManager] Erro ao desligar monitor:', err.message);
    }
}

/**
 * Liga o monitor (normalmente automático no wake, mas forçar por segurança)
 */
function turnOnDisplay() {
    try {
        const ps = `Add-Type -TypeDefinition 'using System;using System.Runtime.InteropServices;public class Monitor{[DllImport("user32.dll")]public static extern int SendMessage(int hWnd,int Msg,int wParam,int lParam);public static void On(){SendMessage(-1,0x0112,0xF170,-1);}}';[Monitor]::On()`;
        execSync(`powershell -NoProfile -Command "${ps}"`, { stdio: 'ignore' });
        console.log('[PowerManager] Monitor ligado');
    } catch (err) {
        console.error('[PowerManager] Erro ao ligar monitor:', err.message);
    }
}

/**
 * Agenda wake do PC via Task Scheduler
 * @param {Date} wakeTime - Horário para acordar
 */
function scheduleWake(wakeTime) {
    try {
        const hours = wakeTime.getHours().toString().padStart(2, '0');
        const minutes = wakeTime.getMinutes().toString().padStart(2, '0');
        const timeStr = `${hours}:${minutes}`;

        // Formatar data para schtasks (MM/DD/YYYY)
        const month = (wakeTime.getMonth() + 1).toString().padStart(2, '0');
        const day = wakeTime.getDate().toString().padStart(2, '0');
        const year = wakeTime.getFullYear();
        const dateStr = `${month}/${day}/${year}`;

        // Deletar task anterior se existir
        cancelScheduledWake();

        // Criar task com wake timer habilitado
        // A task executa um comando dummy — o importante é que ela acorda o PC
        const createCmd = `schtasks /Create /F /TN "${TASK_NAME}" /SC ONCE /SD ${dateStr} /ST ${timeStr} /TR "cmd /c echo RedeConecta Wake" /RL HIGHEST`;
        execSync(createCmd, { stdio: 'ignore' });

        // Habilitar wake timers na task via XML update
        const xmlPatch = `
$task = Get-ScheduledTask -TaskName '${TASK_NAME}' -ErrorAction SilentlyContinue
if ($task) {
    $settings = $task.Settings
    $settings.WakeToRun = $true
    $settings.AllowHardTerminate = $true
    $settings.StopIfGoingOnBatteries = $false
    $settings.DisallowStartIfOnBatteries = $false
    Set-ScheduledTask -TaskName '${TASK_NAME}' -Settings $settings
}`;
        execSync(`powershell -NoProfile -Command "${xmlPatch.replace(/\n/g, '; ')}"`, { stdio: 'ignore' });

        console.log(`[PowerManager] Wake agendado para ${dateStr} ${timeStr}`);
        return true;
    } catch (err) {
        console.error('[PowerManager] Erro ao agendar wake:', err.message);
        return false;
    }
}

/**
 * Remove task de wake agendada
 */
function cancelScheduledWake() {
    try {
        execSync(`schtasks /Delete /F /TN "${TASK_NAME}"`, { stdio: 'ignore' });
        console.log('[PowerManager] Task de wake removida');
    } catch {
        // Task pode não existir, ignorar erro
    }
}

/**
 * Hiberna o PC
 */
function hibernate() {
    try {
        console.log('[PowerManager] Hibernando PC...');
        // Usar shutdown /h para hibernar
        exec('shutdown /h', (err) => {
            if (err) console.error('[PowerManager] Erro ao hibernar:', err.message);
        });
    } catch (err) {
        console.error('[PowerManager] Erro ao iniciar hibernação:', err.message);
    }
}

/**
 * Calcula o próximo horário de funcionamento
 * @param {Object} terminalData - Dados do terminal com operating_start, operating_end, operating_days
 * @returns {Date|null} - Próximo horário ou null se não encontrar
 */
function calculateNextWakeTime(terminalData) {
    const start = (terminalData.operating_start || '08:00').substring(0, 5);
    const days = terminalData.operating_days || [0, 1, 2, 3, 4, 5, 6];

    const [startH, startM] = start.split(':').map(Number);
    const now = new Date();

    // Tentar os próximos 7 dias
    for (let offset = 0; offset <= 7; offset++) {
        const candidate = new Date(now);
        candidate.setDate(candidate.getDate() + offset);
        candidate.setHours(startH, startM, 0, 0);

        const dayOfWeek = candidate.getDay();

        // Deve ser um dia permitido E no futuro
        if (days.includes(dayOfWeek) && candidate > now) {
            // Subtrair 1 minuto para dar tempo do PC bootar
            candidate.setMinutes(candidate.getMinutes() - 1);
            return candidate;
        }
    }

    return null;
}

/**
 * Fluxo completo de power save:
 * 1. Desligar display
 * 2. Agendar wake
 * 3. Hibernar após grace period
 * 
 * @param {Object} terminalData - Dados do terminal
 * @param {number} gracePeriodMs - Tempo de espera antes de hibernar (default: 2 min)
 * @returns {Object} - { success, nextWake, error }
 */
async function enterPowerSave(terminalData, gracePeriodMs = 120000) {
    try {
        console.log('[PowerManager] Iniciando power save...');

        // 1. Calcular próximo wake
        const nextWake = calculateNextWakeTime(terminalData);
        if (!nextWake) {
            console.warn('[PowerManager] Não conseguiu calcular próximo wake — abortando');
            return { success: false, error: 'No wake time calculated' };
        }

        console.log(`[PowerManager] Próximo wake: ${nextWake.toLocaleString()}`);

        // 2. Desligar display
        turnOffDisplay();

        // 3. Agendar wake
        const scheduled = scheduleWake(nextWake);
        if (!scheduled) {
            console.warn('[PowerManager] Falha ao agendar wake — abortando hibernação');
            return { success: false, error: 'Failed to schedule wake' };
        }

        // 4. Grace period então hibernate
        console.log(`[PowerManager] Hibernando em ${gracePeriodMs / 1000}s...`);
        setTimeout(() => {
            hibernate();
        }, gracePeriodMs);

        return {
            success: true,
            nextWake: nextWake.toISOString(),
            gracePeriodMs
        };
    } catch (err) {
        console.error('[PowerManager] Erro no power save:', err);
        return { success: false, error: err.message };
    }
}

module.exports = {
    ensureHibernateEnabled,
    turnOffDisplay,
    turnOnDisplay,
    scheduleWake,
    cancelScheduledWake,
    hibernate,
    calculateNextWakeTime,
    enterPowerSave,
};
