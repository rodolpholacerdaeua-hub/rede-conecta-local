/**
 * mpvPlayer.js - Controla o mpv como player de vídeo externo
 * Substitui o <video> tag do Chromium por mpv nativo (suporta TODOS os codecs)
 * 
 * Arquitetura:
 * - Electron gerencia imagens via <img> tag normalmente
 * - Quando é hora de um vídeo, spawna mpv em fullscreen
 * - mpv toca o vídeo com hardware acceleration
 * - Quando termina, notifica Electron via IPC para ir ao próximo item
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { app } = require('electron');

class MpvPlayer {
    constructor() {
        this.process = null;
        this.isPlaying = false;
        this.onEndedCallback = null;
        this.onErrorCallback = null;
        this.mpvPath = this._findMpvBinary();
        console.log('[MpvPlayer] Binary path:', this.mpvPath);
    }

    /**
     * Encontrar o binário mpv (bundled ou instalado no sistema)
     */
    _findMpvBinary() {
        // 1. Bundled com o app (produção)
        const bundledPaths = [
            // Dentro do diretório resources do app empacotado
            path.join(process.resourcesPath || '', 'mpv', 'mpv.exe'),
            // Ao lado do executável principal
            path.join(path.dirname(app.getPath('exe')), 'mpv', 'mpv.exe'),
            // Na pasta do projeto (desenvolvimento)
            path.join(__dirname, '..', 'mpv', 'mpv.exe'),
        ];

        for (const p of bundledPaths) {
            if (fs.existsSync(p)) {
                return p;
            }
        }

        // 2. Instalado no PATH do sistema
        const systemPath = 'mpv';
        return systemPath;
    }

    /**
     * Tocar um vídeo
     * @param {string} filePath - Caminho local do arquivo OU URL remota
     * @param {object} options - Opções de playback
     * @returns {Promise<void>} - Resolve quando o vídeo termina
     */
    play(filePath, options = {}) {
        return new Promise((resolve, reject) => {
            if (this.process) {
                this.stop();
            }

            const args = [
                filePath,
                '--no-terminal',           // Sem output de terminal
                '--no-input-default-bindings', // Desabilitar controles de teclado
                '--no-osc',                // Sem on-screen controller
                '--no-osd-bar',            // Sem barra de progresso
                '--fullscreen',            // Tela cheia
                '--no-border',             // Sem borda de janela
                '--ontop',                 // Sempre no topo
                '--no-keepaspect-window',   // Preencher a tela toda
                '--hwdec=auto',            // Hardware acceleration automático
                '--vo=gpu',                // Video output via GPU
                '--gpu-api=d3d11',         // Direct3D 11 (Windows nativo)
                '--loop=no',               // Não fazer loop
                '--volume=0',              // Mudo (signage não precisa de áudio)
                '--cursor-autohide=always', // Esconder cursor
                '--no-input-cursor',       // Sem interação de mouse
                '--really-quiet',          // Mínimo de logs
                '--keep-open=no',          // Fechar quando terminar
            ];

            // Se for URL remota, adicionar cache config
            if (filePath.startsWith('http')) {
                args.push('--cache=yes');
                args.push('--cache-secs=30');
            }

            console.log(`[MpvPlayer] Playing: ${filePath}`);
            this.isPlaying = true;

            try {
                this.process = spawn(this.mpvPath, args, {
                    stdio: 'pipe',
                    windowsHide: false  // Mostrar a janela do mpv
                });

                this.process.on('close', (code) => {
                    console.log(`[MpvPlayer] Process exited with code ${code}`);
                    this.isPlaying = false;
                    this.process = null;

                    if (code === 0 || code === null) {
                        // Vídeo terminou normalmente
                        resolve();
                    } else {
                        // Erro
                        const err = new Error(`mpv exited with code ${code}`);
                        reject(err);
                    }
                });

                this.process.on('error', (err) => {
                    console.error(`[MpvPlayer] Process error:`, err.message);
                    this.isPlaying = false;
                    this.process = null;
                    reject(err);
                });

                // Log stderr para debug
                if (this.process.stderr) {
                    this.process.stderr.on('data', (data) => {
                        const msg = data.toString().trim();
                        if (msg) console.log(`[MpvPlayer] stderr: ${msg}`);
                    });
                }

            } catch (err) {
                console.error(`[MpvPlayer] Spawn error:`, err.message);
                this.isPlaying = false;
                reject(err);
            }
        });
    }

    /**
     * Parar o vídeo atual
     */
    stop() {
        if (this.process) {
            console.log('[MpvPlayer] Stopping...');
            try {
                this.process.kill('SIGTERM');
            } catch (e) {
                try { this.process.kill('SIGKILL'); } catch (e2) { /* ignore */ }
            }
            this.process = null;
            this.isPlaying = false;
        }
    }

    /**
     * Verificar se o mpv está disponível
     */
    isAvailable() {
        if (this.mpvPath === 'mpv') {
            // Verificar se mpv está no PATH
            try {
                const { execSync } = require('child_process');
                execSync('mpv --version', { stdio: 'pipe' });
                return true;
            } catch {
                return false;
            }
        }
        return fs.existsSync(this.mpvPath);
    }
}

module.exports = MpvPlayer;
