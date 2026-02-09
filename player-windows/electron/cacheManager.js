/**
 * CacheManager - Gerenciador de Cache Offline para Mídias
 * Rede Conecta DOOH - V17 Offline-First
 * 
 * Responsabilidades:
 * 1. Download preventivo de mídias da playlist para disco local
 * 2. Mapeamento de media_id → caminho local via SQLite
 * 3. Garbage Collection baseado em LRU (5GB máximo)
 * 4. Servir caminho local para o renderer
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const crypto = require('crypto');

// SQLite para persistência do índice de cache
const Database = require('better-sqlite3');

// Transcodificação automática de vídeos incompatíveis
const videoTranscoder = require('./videoTranscoder');

class CacheManager {
    constructor(cacheDir, maxSizeBytes = 5 * 1024 * 1024 * 1024) { // 5GB default
        this.cacheDir = cacheDir;
        this.maxSizeBytes = maxSizeBytes;
        this.dbPath = path.join(cacheDir, 'cache.db');
        this.mediaDir = path.join(cacheDir, 'media');
        this.db = null;
        this.downloadQueue = new Map(); // mediaId -> Promise (para evitar downloads duplicados)

        this._ensureDirectories();
        this._initDatabase();

        console.log(`[CacheManager] Initialized at ${cacheDir}`);
        console.log(`[CacheManager] Max size: ${(maxSizeBytes / (1024 * 1024 * 1024)).toFixed(1)}GB`);
    }

    /**
     * Garantir que diretórios existem
     */
    _ensureDirectories() {
        if (!fs.existsSync(this.cacheDir)) {
            fs.mkdirSync(this.cacheDir, { recursive: true });
        }
        if (!fs.existsSync(this.mediaDir)) {
            fs.mkdirSync(this.mediaDir, { recursive: true });
        }
    }

    /**
     * Inicializar banco SQLite com schema
     */
    _initDatabase() {
        this.db = new Database(this.dbPath);

        // Criar tabela de cache se não existir
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS media_cache (
                media_id TEXT PRIMARY KEY,
                url TEXT NOT NULL,
                local_path TEXT NOT NULL,
                file_size INTEGER DEFAULT 0,
                downloaded_at TEXT NOT NULL,
                last_accessed TEXT NOT NULL,
                checksum TEXT
            );
            
            CREATE INDEX IF NOT EXISTS idx_last_accessed ON media_cache(last_accessed);
            CREATE INDEX IF NOT EXISTS idx_file_size ON media_cache(file_size);
        `);

        console.log('[CacheManager] Database initialized');
    }

    /**
     * Gerar nome de arquivo único baseado no ID e URL
     */
    _generateFileName(mediaId, url) {
        const ext = path.extname(new URL(url).pathname) || '.bin';
        const hash = crypto.createHash('md5').update(mediaId + url).digest('hex').substring(0, 8);
        return `${mediaId}_${hash}${ext}`;
    }

    /**
     * Obter tamanho total do cache em bytes
     */
    getTotalSize() {
        const result = this.db.prepare('SELECT SUM(file_size) as total FROM media_cache').get();
        return result?.total || 0;
    }

    /**
     * Obter estatísticas do cache
     */
    getStats() {
        const totalSize = this.getTotalSize();
        const itemCount = this.db.prepare('SELECT COUNT(*) as count FROM media_cache').get()?.count || 0;

        return {
            totalSizeBytes: totalSize,
            totalSizeMB: Math.round(totalSize / (1024 * 1024)),
            totalSizeGB: (totalSize / (1024 * 1024 * 1024)).toFixed(2),
            itemCount,
            maxSizeBytes: this.maxSizeBytes,
            usagePercent: ((totalSize / this.maxSizeBytes) * 100).toFixed(1)
        };
    }

    /**
     * Verificar se mídia está no cache
     */
    isCached(mediaId) {
        const entry = this.db.prepare('SELECT local_path FROM media_cache WHERE media_id = ?').get(mediaId);
        if (!entry) return false;

        // Verificar se arquivo existe no disco
        if (!fs.existsSync(entry.local_path)) {
            // Entrada órfã - remover do DB
            this.db.prepare('DELETE FROM media_cache WHERE media_id = ?').run(mediaId);
            return false;
        }

        return true;
    }

    /**
     * Obter caminho local de mídia (e atualizar last_accessed)
     */
    getLocalPath(mediaId) {
        const entry = this.db.prepare('SELECT local_path FROM media_cache WHERE media_id = ?').get(mediaId);

        if (!entry || !fs.existsSync(entry.local_path)) {
            return null;
        }

        // Atualizar last_accessed para LRU
        this.db.prepare('UPDATE media_cache SET last_accessed = ? WHERE media_id = ?')
            .run(new Date().toISOString(), mediaId);

        return entry.local_path;
    }

    /**
     * Liberar espaço removendo mídias menos usadas (LRU)
     */
    _freeSpace(requiredBytes) {
        const currentSize = this.getTotalSize();
        const targetSize = this.maxSizeBytes - requiredBytes;

        if (currentSize <= targetSize) {
            return; // Já tem espaço suficiente
        }

        console.log(`[CacheManager] Freeing space: need ${Math.round(requiredBytes / (1024 * 1024))}MB`);

        // Obter mídias ordenadas por last_accessed (mais antigas primeiro)
        const items = this.db.prepare(`
            SELECT media_id, local_path, file_size 
            FROM media_cache 
            ORDER BY last_accessed ASC
        `).all();

        let freedBytes = 0;
        const neededToFree = currentSize - targetSize;

        for (const item of items) {
            if (freedBytes >= neededToFree) break;

            try {
                if (fs.existsSync(item.local_path)) {
                    fs.unlinkSync(item.local_path);
                    console.log(`[CacheManager] Removed LRU: ${path.basename(item.local_path)}`);
                }
                this.db.prepare('DELETE FROM media_cache WHERE media_id = ?').run(item.media_id);
                freedBytes += item.file_size;
            } catch (err) {
                console.error(`[CacheManager] Error removing ${item.local_path}:`, err.message);
            }
        }

        console.log(`[CacheManager] Freed ${Math.round(freedBytes / (1024 * 1024))}MB`);
    }

    /**
     * Download de arquivo via HTTP/HTTPS com verificação de integridade
     */
    _downloadFile(url, destPath, onProgress) {
        return new Promise((resolve, reject) => {
            const protocol = url.startsWith('https') ? https : http;

            const cleanup = (filePath) => {
                try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch (e) { /* ignore */ }
            };

            const request = protocol.get(url, (response) => {
                // Handle redirects
                if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
                    response.resume(); // Drain response
                    return this._downloadFile(response.headers.location, destPath, onProgress)
                        .then(resolve)
                        .catch(reject);
                }

                if (response.statusCode !== 200) {
                    response.resume();
                    return reject(new Error(`HTTP ${response.statusCode}`));
                }

                const totalBytes = parseInt(response.headers['content-length'], 10) || 0;
                let downloadedBytes = 0;
                const file = fs.createWriteStream(destPath);

                response.on('data', (chunk) => {
                    downloadedBytes += chunk.length;
                    file.write(chunk);
                    if (onProgress && totalBytes > 0) {
                        onProgress(downloadedBytes, totalBytes);
                    }
                });

                response.on('end', () => {
                    file.end(() => {
                        // Verificar integridade: bytes baixados vs content-length
                        if (totalBytes > 0 && downloadedBytes < totalBytes) {
                            console.error(`[CacheManager] Incomplete download: ${downloadedBytes}/${totalBytes} bytes`);
                            cleanup(destPath);
                            return reject(new Error(`Incomplete download: ${downloadedBytes}/${totalBytes}`));
                        }

                        try {
                            const stats = fs.statSync(destPath);
                            // Verificar se o arquivo tem tamanho razoável (> 1KB para vídeos)
                            if (stats.size < 1024) {
                                console.error(`[CacheManager] Downloaded file too small: ${stats.size} bytes`);
                                cleanup(destPath);
                                return reject(new Error(`File too small: ${stats.size} bytes`));
                            }
                            console.log(`[CacheManager] Download verified: ${stats.size} bytes (expected: ${totalBytes || 'unknown'})`);
                            resolve({ size: stats.size });
                        } catch (e) {
                            cleanup(destPath);
                            reject(e);
                        }
                    });
                });

                response.on('error', (err) => {
                    file.destroy();
                    cleanup(destPath);
                    reject(err);
                });

                file.on('error', (err) => {
                    file.destroy();
                    cleanup(destPath);
                    reject(err);
                });
            });

            request.on('error', (err) => {
                cleanup(destPath);
                reject(err);
            });

            // Timeout proporcional: 60s base + 30s por MB esperado (mínimo 120s)
            const totalBytes = 0; // Não sabemos ainda, usar timeout generoso
            const timeoutMs = Math.max(120000, 300000); // 2-5 minutos
            request.setTimeout(timeoutMs, () => {
                request.destroy();
                cleanup(destPath);
                reject(new Error('Download timeout'));
            });
        });
    }

    /**
     * Garantir que uma mídia está em cache
     * Retorna o caminho local
     */
    async ensureCached(mediaItem, onProgress) {
        const { id: mediaId, url, name } = mediaItem;

        // Já está em cache?
        const existing = this.getLocalPath(mediaId);
        if (existing) {
            console.log(`[CacheManager] Cache hit: "${name}"`);
            return existing;
        }

        // Já está baixando?
        if (this.downloadQueue.has(mediaId)) {
            console.log(`[CacheManager] Already downloading: "${name}"`);
            return this.downloadQueue.get(mediaId);
        }

        // Iniciar download
        const downloadPromise = this._downloadMedia(mediaItem, onProgress);
        this.downloadQueue.set(mediaId, downloadPromise);

        try {
            const localPath = await downloadPromise;
            return localPath;
        } finally {
            this.downloadQueue.delete(mediaId);
        }
    }

    /**
     * Download interno de mídia
     */
    async _downloadMedia(mediaItem, onProgress) {
        const { id: mediaId, url, name } = mediaItem;
        const fileName = this._generateFileName(mediaId, url);
        let destPath = path.join(this.mediaDir, fileName);

        console.log(`[CacheManager] Downloading: "${name}"`);

        try {
            // Estimar tamanho (assumir 50MB se desconhecido para liberar espaço)
            const estimatedSize = 50 * 1024 * 1024;
            this._freeSpace(estimatedSize);

            let { size } = await this._downloadFile(url, destPath, onProgress);

            // Transcodificar se necessário (H.265 → H.264, etc.)
            const isVideo = /\.(mp4|mkv|webm|avi|mov|m4v|wmv|flv)$/i.test(destPath);
            if (isVideo) {
                try {
                    const transcodedPath = await videoTranscoder.ensureH264(destPath, name);
                    if (transcodedPath !== destPath) {
                        destPath = transcodedPath; // Transcodificado → novo arquivo
                    }
                    const newStats = fs.statSync(destPath);
                    size = newStats.size;
                } catch (transcodeErr) {
                    console.warn(`[CacheManager] Transcode warning for "${name}": ${transcodeErr.message}`);
                }
            }

            // Registrar no banco
            const now = new Date().toISOString();
            this.db.prepare(`
                INSERT OR REPLACE INTO media_cache 
                (media_id, url, local_path, file_size, downloaded_at, last_accessed)
                VALUES (?, ?, ?, ?, ?, ?)
            `).run(mediaId, url, destPath, size, now, now);

            console.log(`[CacheManager] Ready: "${name}" (${Math.round(size / (1024 * 1024))}MB)`);

            return destPath;
        } catch (err) {
            console.error(`[CacheManager] Failed to download "${name}":`, err.message);
            throw err;
        }
    }

    /**
     * Sincronizar playlist inteira para cache
     * Retorna mapa de mediaId -> localPath
     */
    async syncPlaylist(playlistItems, onProgress) {
        const results = new Map();
        const total = playlistItems.length;
        let completed = 0;

        console.log(`[CacheManager] Syncing ${total} items...`);

        for (const item of playlistItems) {
            try {
                const localPath = await this.ensureCached(item, (downloaded, total) => {
                    if (onProgress) {
                        onProgress({
                            type: 'downloading',
                            mediaId: item.id,
                            mediaName: item.name,
                            downloaded,
                            total,
                            itemProgress: completed / total
                        });
                    }
                });
                results.set(item.id, localPath);
            } catch (err) {
                console.error(`[CacheManager] Sync failed for "${item.name}":`, err.message);
                results.set(item.id, null); // Fallback será URL remota
            }

            completed++;
            if (onProgress) {
                onProgress({
                    type: 'progress',
                    completed,
                    total,
                    percent: Math.round((completed / total) * 100)
                });
            }
        }

        console.log(`[CacheManager] Sync complete: ${results.size} items`);
        return results;
    }

    /**
     * Remover item específico do cache (ex: arquivo corrompido)
     */
    removeCached(mediaId) {
        const entry = this.db.prepare('SELECT local_path FROM media_cache WHERE media_id = ?').get(mediaId);
        if (entry) {
            try {
                if (fs.existsSync(entry.local_path)) {
                    fs.unlinkSync(entry.local_path);
                }
            } catch (err) {
                console.error(`[CacheManager] Error deleting ${entry.local_path}:`, err.message);
            }
            this.db.prepare('DELETE FROM media_cache WHERE media_id = ?').run(mediaId);
            console.log(`[CacheManager] Removed corrupted cache: ${mediaId}`);
            return true;
        }
        return false;
    }

    /**
     * Limpar todo o cache
     */
    clearAll() {
        console.log('[CacheManager] Clearing all cache...');

        // Apagar arquivos
        const items = this.db.prepare('SELECT local_path FROM media_cache').all();
        for (const item of items) {
            try {
                if (fs.existsSync(item.local_path)) {
                    fs.unlinkSync(item.local_path);
                }
            } catch (err) {
                console.error(`[CacheManager] Error deleting ${item.local_path}:`, err.message);
            }
        }

        // Limpar banco
        this.db.prepare('DELETE FROM media_cache').run();

        console.log('[CacheManager] Cache cleared');
    }

    /**
     * Fechar conexão com banco
     */
    close() {
        if (this.db) {
            this.db.close();
            this.db = null;
        }
    }
}

module.exports = CacheManager;
