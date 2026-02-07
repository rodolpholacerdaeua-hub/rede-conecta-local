/**
 * Migrator - Gerenciador de Migração entre Versões
 * Rede Conecta Player V17
 * 
 * Responsabilidades:
 * 1. Detectar versão anterior instalada
 * 2. Criar estrutura de diretórios da V17
 * 3. Limpar dados obsoletos da V16
 * 4. Registrar versão atual para futuras migrações
 */

const fs = require('fs');
const path = require('path');

class Migrator {
    constructor(userDataPath, currentVersion) {
        this.userDataPath = userDataPath;
        this.currentVersion = currentVersion;
        this.versionFile = path.join(userDataPath, 'last-version.txt');
        this.previousVersion = this._readPreviousVersion();
    }

    /**
     * Ler versão anterior do disco
     */
    _readPreviousVersion() {
        try {
            if (fs.existsSync(this.versionFile)) {
                return fs.readFileSync(this.versionFile, 'utf-8').trim();
            }
        } catch (err) {
            console.error('[Migrator] Erro ao ler versão anterior:', err.message);
        }
        return null; // Primeira instalação ou V16 (sem arquivo)
    }

    /**
     * Salvar versão atual no disco
     */
    _saveCurrentVersion() {
        try {
            fs.writeFileSync(this.versionFile, this.currentVersion);
            console.log(`[Migrator] Versão ${this.currentVersion} registrada`);
        } catch (err) {
            console.error('[Migrator] Erro ao salvar versão:', err.message);
        }
    }

    /**
     * Verificar se é a primeira execução após update
     */
    isFirstRunAfterUpdate() {
        return this.previousVersion !== null && this.previousVersion !== this.currentVersion;
    }

    /**
     * Verificar se é uma instalação completamente nova (sem versão anterior)
     */
    isFreshInstall() {
        return this.previousVersion === null;
    }

    /**
     * Verificar se está migrando de V16 para V17
     */
    _isMigratingFromV16() {
        if (!this.previousVersion) return true; // Sem arquivo = V16 ou nova
        const majorVersion = parseInt(this.previousVersion.split('.')[0]);
        return majorVersion < 17;
    }

    /**
     * Executar migrações necessárias
     */
    async runMigration() {
        console.log(`[Migrator] Versão anterior: ${this.previousVersion || 'nenhuma (V16 ou nova)'}`);
        console.log(`[Migrator] Versão atual: ${this.currentVersion}`);

        // Se já está na mesma versão, nada a fazer
        if (this.previousVersion === this.currentVersion) {
            console.log('[Migrator] Mesma versão, nenhuma migração necessária');
            return;
        }

        try {
            // ============================================
            // MIGRAÇÃO V16 → V17
            // ============================================
            if (this._isMigratingFromV16()) {
                console.log('[Migrator] 🔄 Migrando de V16 → V17...');
                await this._migrateV16toV17();
            }

            // ============================================
            // MIGRAÇÕES FUTURAS (V17.x → V18.x, etc.)
            // Adicionar aqui conforme necessário
            // ============================================

        } catch (err) {
            // NUNCA travar a inicialização por causa de migração
            console.error('[Migrator] ⚠️ Erro na migração (continuando):', err.message);
        }

        // Sempre salvar versão atual ao final
        this._saveCurrentVersion();
    }

    /**
     * Migração específica V16 → V17
     */
    async _migrateV16toV17() {
        // 1. Garantir diretórios da V17
        const cacheDir = path.join(this.userDataPath, 'media-cache');
        const mediaDir = path.join(cacheDir, 'media');

        if (!fs.existsSync(cacheDir)) {
            fs.mkdirSync(cacheDir, { recursive: true });
            console.log('[Migrator] Diretório media-cache criado');
        }

        if (!fs.existsSync(mediaDir)) {
            fs.mkdirSync(mediaDir, { recursive: true });
            console.log('[Migrator] Diretório media/ criado');
        }

        // 2. Limpar logs antigos da V16 (se existirem)
        const oldLogFiles = ['player.log', 'error.log', 'debug.log'];
        for (const logFile of oldLogFiles) {
            const logPath = path.join(this.userDataPath, logFile);
            if (fs.existsSync(logPath)) {
                try {
                    fs.unlinkSync(logPath);
                    console.log(`[Migrator] Log antigo removido: ${logFile}`);
                } catch (err) {
                    console.warn(`[Migrator] Não foi possível remover ${logFile}:`, err.message);
                }
            }
        }

        // 3. Limpar pasta temp se existir
        const tempDir = path.join(this.userDataPath, 'temp');
        if (fs.existsSync(tempDir)) {
            try {
                fs.rmSync(tempDir, { recursive: true, force: true });
                console.log('[Migrator] Pasta temp removida');
            } catch (err) {
                console.warn('[Migrator] Não foi possível remover pasta temp:', err.message);
            }
        }

        console.log('[Migrator] ✅ Migração V16 → V17 concluída');
    }
}

module.exports = Migrator;
