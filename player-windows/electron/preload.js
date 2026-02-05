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
    }
});

console.log('[Preload] Electron APIs exposed');

