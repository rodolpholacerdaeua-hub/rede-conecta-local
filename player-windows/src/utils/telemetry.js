/**
 * Telemetria Remota — Rede Conecta Player
 * Módulo de logging remoto e buffer local (PoP batching)
 */
import { logTerminalEvent, logPlaybackBatch } from '../supabase';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const LOG_BUFFER_KEY = 'popLogBuffer';
const BATCH_INTERVAL_MS = 5 * 60 * 1000;
const MAX_BUFFER_SIZE = 1000;

export { BATCH_INTERVAL_MS };

export const remoteLog = async (terminalId, level, message, details = {}) => {
    try {
        console.log(`[${level}] ${message}`, details);
        if (terminalId && UUID_RE.test(terminalId)) {
            await logTerminalEvent(terminalId, level.toLowerCase(), message, details);
        }
    } catch (e) {
        console.error("Fail to remote log", e);
    }
};

export const addToLogBuffer = (logData) => {
    try {
        const buffer = JSON.parse(localStorage.getItem(LOG_BUFFER_KEY) || '[]');
        buffer.push(logData);
        if (buffer.length > MAX_BUFFER_SIZE) {
            buffer.splice(0, buffer.length - MAX_BUFFER_SIZE);
        }
        localStorage.setItem(LOG_BUFFER_KEY, JSON.stringify(buffer));
        console.log(`[PoP] Buffered (${buffer.length} pending)`);
    } catch (e) {
        console.error('[PoP] Failed to buffer log:', e);
    }
};

export const flushLogBuffer = async () => {
    try {
        const buffer = JSON.parse(localStorage.getItem(LOG_BUFFER_KEY) || '[]');
        if (buffer.length === 0) return;

        console.log(`[PoP] Flushing ${buffer.length} logs...`);

        const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        const validBuffer = buffer.filter(entry => {
            if (entry.mediaId && !UUID_REGEX.test(entry.mediaId)) {
                console.warn(`[PoP] Skipping invalid mediaId: ${entry.mediaId}`);
                return false;
            }
            return true;
        });

        if (validBuffer.length === 0) {
            localStorage.removeItem(LOG_BUFFER_KEY);
            return;
        }

        const { error } = await logPlaybackBatch(validBuffer);
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
    remoteLog(terminalId, "NATIVE", "[NATIVE] " + message, details);
};
