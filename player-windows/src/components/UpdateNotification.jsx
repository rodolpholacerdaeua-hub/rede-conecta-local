import React, { useState, useEffect } from 'react';
import { Download, CheckCircle, RefreshCw, AlertCircle } from 'lucide-react';

/**
 * Componente de notificação de atualização
 * Exibe status discreto no canto da tela durante atualizações
 */
const UpdateNotification = () => {
    const [updateStatus, setUpdateStatus] = useState(null);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        // Verificar se estamos no Electron
        if (!window.electronAPI?.onUpdateStatus) return;

        // Listener para eventos de atualização
        window.electronAPI.onUpdateStatus((data) => {
            console.log('[Update] Status:', data);
            setUpdateStatus(data);

            // Mostrar notificação apenas para status relevantes
            if (['available', 'downloading', 'downloaded'].includes(data.status)) {
                setIsVisible(true);
            }

            // Esconder após alguns segundos se não for downloading
            if (data.status === 'up-to-date' || data.status === 'error') {
                setTimeout(() => setIsVisible(false), 3000);
            }
        });
    }, []);

    // Não renderizar se não estiver visível
    if (!isVisible || !updateStatus) return null;

    const getContent = () => {
        switch (updateStatus.status) {
            case 'available':
                return (
                    <>
                        <Download className="w-4 h-4 text-blue-400 animate-bounce" />
                        <span>Nova versão {updateStatus.version} disponível</span>
                    </>
                );
            case 'downloading':
                return (
                    <>
                        <RefreshCw className="w-4 h-4 text-blue-400 animate-spin" />
                        <span>Baixando atualização... {updateStatus.percent}%</span>
                        <div className="absolute bottom-0 left-0 h-1 bg-blue-500 transition-all"
                            style={{ width: `${updateStatus.percent}%` }} />
                    </>
                );
            case 'downloaded':
                return (
                    <>
                        <CheckCircle className="w-4 h-4 text-emerald-400" />
                        <span>Atualização pronta! Reiniciando em breve...</span>
                    </>
                );
            case 'error':
                return (
                    <>
                        <AlertCircle className="w-4 h-4 text-red-400" />
                        <span>Erro na atualização</span>
                    </>
                );
            default:
                return null;
        }
    };

    return (
        <div className="fixed bottom-4 right-4 z-50">
            <div className="relative bg-slate-900/90 backdrop-blur-lg border border-slate-700 rounded-lg px-4 py-2 shadow-lg overflow-hidden">
                <div className="flex items-center gap-2 text-sm text-white">
                    {getContent()}
                </div>
            </div>
        </div>
    );
};

export default UpdateNotification;
