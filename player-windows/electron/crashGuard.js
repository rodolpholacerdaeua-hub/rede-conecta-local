/**
 * CrashGuard - Proteção contra crash loops após update
 * Rede Conecta Player V17
 * 
 * Lógica:
 * 1. Incrementa contador a cada inicialização
 * 2. Se app sobreviver 30s, reseta contador
 * 3. Se crashar 3x seguidas, entra em modo seguro
 * 4. Reporta erro crítico no Supabase (terminal_logs)
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const os = require('os');
const crypto = require('crypto');

const MAX_CRASHES = 3;
const STABILITY_TIMEOUT_MS = 30000; // 30 segundos

class CrashGuard {
    constructor(userDataPath, config = {}) {
        this.counterFile = path.join(userDataPath, 'crash-counter.json');
        this.supabaseUrl = config.supabaseUrl || '';
        this.supabaseKey = config.supabaseKey || '';
        this.crashData = this._readCounter();
        this.isSafeMode = false;
    }

    /**
     * Ler contador de crashes do disco
     */
    _readCounter() {
        try {
            if (fs.existsSync(this.counterFile)) {
                const data = JSON.parse(fs.readFileSync(this.counterFile, 'utf-8'));
                return {
                    count: data.count || 0,
                    lastVersion: data.lastVersion || '0.0.0',
                    lastCrash: data.lastCrash || null
                };
            }
        } catch (err) {
            console.error('[CrashGuard] Erro ao ler counter:', err.message);
        }
        return { count: 0, lastVersion: '0.0.0', lastCrash: null };
    }

    /**
     * Salvar contador no disco
     */
    _saveCounter() {
        try {
            fs.writeFileSync(this.counterFile, JSON.stringify(this.crashData, null, 2));
        } catch (err) {
            console.error('[CrashGuard] Erro ao salvar counter:', err.message);
        }
    }

    /**
     * Gerar hardware ID (mesmo algoritmo do main.js)
     */
    _getHardwareId() {
        const networkInterfaces = os.networkInterfaces();
        let mac = null;
        for (const name of Object.keys(networkInterfaces)) {
            for (const iface of networkInterfaces[name]) {
                if (!iface.internal && iface.mac && iface.mac !== '00:00:00:00:00:00') {
                    mac = iface.mac;
                    break;
                }
            }
            if (mac) break;
        }
        if (mac) {
            return crypto.createHash('sha256').update(mac).digest('hex').substring(0, 32);
        }
        return 'unknown-' + os.hostname();
    }

    /**
     * Enviar log crítico para o Supabase via REST API
     */
    _sendCriticalLog(appVersion) {
        return new Promise((resolve) => {
            if (!this.supabaseUrl || !this.supabaseKey) {
                console.warn('[CrashGuard] Supabase config ausente, skip log remoto');
                return resolve(false);
            }
            const hardwareId = this._getHardwareId();
            const payload = JSON.stringify({
                terminal_id: null, // Será linkado pelo hardware_id no metadata
                level: 'critical',
                message: `[CrashGuard] Player crashou ${this.crashData.count}x seguidas! Entrando em MODO SEGURO. Hardware: ${hardwareId}`,
                metadata: {
                    crashCount: this.crashData.count,
                    version: appVersion,
                    hardwareId: hardwareId,
                    hostname: os.hostname(),
                    platform: process.platform,
                    lastCrash: this.crashData.lastCrash,
                    safeMode: true
                }
            });

            const url = new URL(`${this.supabaseUrl}/rest/v1/terminal_logs`);
            const options = {
                hostname: url.hostname,
                port: 443,
                path: url.pathname,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': this.supabaseKey,
                    'Authorization': `Bearer ${this.supabaseKey}`,
                    'Prefer': 'return=minimal',
                    'Content-Length': Buffer.byteLength(payload)
                }
            };

            const req = https.request(options, (res) => {
                console.log(`[CrashGuard] Log enviado ao Supabase: status ${res.statusCode}`);
                resolve(res.statusCode < 400);
            });

            req.on('error', (err) => {
                console.error('[CrashGuard] Falha ao enviar log:', err.message);
                resolve(false);
            });

            req.setTimeout(5000, () => {
                console.error('[CrashGuard] Timeout ao enviar log');
                req.destroy();
                resolve(false);
            });

            req.write(payload);
            req.end();
        });
    }

    /**
     * Verificar estado na inicialização
     * Retorna true se está em modo seguro (crash loop detectado)
     */
    async check(appVersion) {
        console.log(`[CrashGuard] Verificando... (crashes: ${this.crashData.count}, versão anterior: ${this.crashData.lastVersion})`);

        // Se mudou de versão, resetar contador
        if (this.crashData.lastVersion !== appVersion) {
            console.log(`[CrashGuard] Nova versão detectada (${this.crashData.lastVersion} → ${appVersion}). Resetando contador.`);
            this.crashData.count = 0;
            this.crashData.lastVersion = appVersion;
            this._saveCounter();
        }

        // Incrementar contador
        this.crashData.count++;
        this.crashData.lastCrash = new Date().toISOString();
        this._saveCounter();

        // Verificar se atingiu limite
        if (this.crashData.count >= MAX_CRASHES) {
            console.error(`[CrashGuard] ⚠️ CRASH LOOP DETECTADO! (${this.crashData.count} crashes)`);
            console.error('[CrashGuard] Entrando em MODO SEGURO...');
            this.isSafeMode = true;

            // Enviar log crítico ao Supabase
            await this._sendCriticalLog(appVersion);

            return true; // Modo seguro ativado
        }

        console.log(`[CrashGuard] Crash counter: ${this.crashData.count}/${MAX_CRASHES}`);
        return false; // Modo normal
    }

    /**
     * Marcar app como estável (após 30s rodando sem crash)
     */
    markStable() {
        console.log('[CrashGuard] ✅ App estável! Resetando crash counter.');
        this.crashData.count = 0;
        this._saveCounter();
    }

    /**
     * Iniciar timer de estabilidade
     * Se o app rodar por 30s sem crash, reseta o counter
     */
    startStabilityTimer() {
        setTimeout(() => {
            this.markStable();
        }, STABILITY_TIMEOUT_MS);
        console.log(`[CrashGuard] Timer de estabilidade iniciado (${STABILITY_TIMEOUT_MS / 1000}s)`);
    }
}

module.exports = CrashGuard;
