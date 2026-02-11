const { contextBridge, ipcRenderer } = require('electron');

// Expor APIs seguras para o renderer (React)
contextBridge.exposeInMainWorld('electronAPI', {
    // Hardware ID único do dispositivo
    getHardwareId: () => ipcRenderer.invoke('get-hardware-id'),

    // Plataforma atual
    getPlatform: () => ipcRenderer.invoke('get-platform'),

    // Versão do app
    getVersion: () => ipcRenderer.invoke('get-version'),

    // Indicador de que estamos no Electron
    isElectron: true,

    // Info de boot (blindagem de disponibilidade)
    getBootInfo: () => ipcRenderer.invoke('get-boot-info'),

    // ============================================
    // AUTO-UPDATER APIs
    // ============================================

    // Verificar atualizações manualmente
    checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),

    // Instalar atualização baixada
    installUpdate: () => ipcRenderer.invoke('install-update'),

    // Verificar se há update pronto
    isUpdateReady: () => ipcRenderer.invoke('is-update-ready'),

    // Listener para eventos de atualização
    onUpdateStatus: (callback) => {
        ipcRenderer.on('update-status', (event, data) => callback(data));
    },

    // ============================================
    // CACHE MANAGER APIs (Offline-First v17)
    // ============================================

    // Obter caminho local de mídia (retorna null se não cacheada)
    getCachedMediaPath: (mediaId) => ipcRenderer.invoke('cache-get-local-path', mediaId),

    // Garantir que uma mídia está em cache (baixa se necessário)
    ensureCached: (mediaItem) => ipcRenderer.invoke('cache-ensure-cached', mediaItem),

    // Sincronizar playlist inteira para cache
    // Retorna objeto { mediaId: localPath }
    syncPlaylistToCache: (playlistItems) => ipcRenderer.invoke('cache-sync-playlist', playlistItems),

    // Obter estatísticas do cache
    getCacheStats: () => ipcRenderer.invoke('cache-get-stats'),

    // Verificar se mídia está em cache
    isCached: (mediaId) => ipcRenderer.invoke('cache-is-cached', mediaId),

    // Remover item específico do cache (ex: arquivo corrompido)
    removeCachedItem: (mediaId) => ipcRenderer.invoke('cache-remove-item', mediaId),

    // Limpar todo o cache
    clearCache: () => ipcRenderer.invoke('cache-clear-all'),

    // Listener para progresso de download de cache
    onCacheProgress: (callback) => {
        ipcRenderer.on('cache-progress', (event, data) => callback(data));
    },

    // PowerManager desabilitado — PC fica em idle 24/7
    // enterPowerSave e wakeDisplay removidos

    // ============================================
    // RSS FEED API (CORS-free via main process)
    // ============================================
    fetchRss: (feedUrl) => ipcRenderer.invoke('fetch-rss', feedUrl),

    // Listener para logs do main process
    onRemoteLog: (callback) => {
        ipcRenderer.on('remote-log', (event, data) => callback(data));
    }
});

console.log('[Preload] Electron APIs exposed (v17 Offline-First)');
