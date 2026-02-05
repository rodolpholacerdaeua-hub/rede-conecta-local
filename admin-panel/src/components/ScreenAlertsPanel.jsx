import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabase';
import { updateDocument } from '../db';
import { AlertTriangle, Clock, FileWarning, Wifi, X, CheckCircle, Monitor, WifiOff, AlertCircle } from 'lucide-react';

const ANOMALY_ICONS = {
    'TIMEOUT': Clock,
    'CORRUPTED_MEDIA': FileWarning,
    'PLAYBACK_ERROR': AlertTriangle,
    'NETWORK_ERROR': Wifi,
    'TERMINAL_DOWN': WifiOff
};

const ANOMALY_COLORS = {
    'TIMEOUT': '#f59e0b', // amber
    'CORRUPTED_MEDIA': '#ef4444', // red
    'PLAYBACK_ERROR': '#ef4444', // red
    'NETWORK_ERROR': '#f97316', // orange
    'TERMINAL_DOWN': '#dc2626' // red-600
};

// Verifica se o terminal deveria estar online agora
const shouldBeOnline = (terminal) => {
    if (!terminal) return false;

    // Se está forçado desligado, não deveria estar online
    if (terminal.power_mode === 'off') return false;

    // Se está forçado ligado, deveria estar online
    if (terminal.power_mode === 'on') return true;

    // Modo automático: verificar horário de operação
    const now = new Date();
    const currentDay = now.getDay(); // 0 = domingo
    const currentTime = now.getHours() * 60 + now.getMinutes();

    // Verificar dias de operação
    const operatingDays = terminal.operating_days || [1, 2, 3, 4, 5]; // Default: seg-sex
    if (!operatingDays.includes(currentDay)) return false;

    // Verificar horário de operação
    const startTime = terminal.operating_start || '08:00';
    const endTime = terminal.operating_end || '22:00';

    const [startH, startM] = startTime.split(':').map(Number);
    const [endH, endM] = endTime.split(':').map(Number);

    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;

    return currentTime >= startMinutes && currentTime <= endMinutes;
};

// Verifica se o terminal está em pane (deveria estar online mas não está respondendo)
const isTerminalDown = (terminal) => {
    if (!shouldBeOnline(terminal)) return false;

    const lastSeen = terminal.last_seen ? new Date(terminal.last_seen) : null;
    if (!lastSeen) return true; // Nunca visto = em pane

    const now = new Date();
    const diffMinutes = (now - lastSeen) / (1000 * 60);

    // Se não responde há mais de 2 minutos, está em pane
    return diffMinutes > 2;
};

const ScreenAlertsPanel = ({ terminals }) => {
    const [alerts, setAlerts] = useState([]);
    const [isExpanded, setIsExpanded] = useState(false);
    const [showDownTerminals, setShowDownTerminals] = useState(true);

    // Detectar terminais em pane
    const downTerminals = useMemo(() => {
        if (!terminals) return [];
        return terminals.filter(isTerminalDown);
    }, [terminals]);

    useEffect(() => {
        // Buscar alertas não resolvidos das últimas 24 horas
        const loadAlerts = async () => {
            try {
                const { data, error } = await supabase
                    .from('screen_alerts')
                    .select('*')
                    .eq('resolved', false)
                    .order('timestamp', { ascending: false })
                    .limit(50);

                if (error) throw error;
                setAlerts(data || []);
            } catch (error) {
                console.error("Erro ao carregar alertas:", error);
            }
        };

        loadAlerts();

        // Realtime subscription
        const channel = supabase
            .channel('screen-alerts-realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'screen_alerts' }, () => {
                loadAlerts();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    const markAsResolved = async (alertId) => {
        try {
            await updateDocument('screen_alerts', alertId, {
                resolved: true,
                resolved_at: new Date().toISOString()
            });
        } catch (error) {
            console.error("Erro ao marcar como resolvido:", error);
        }
    };

    const getTerminalName = (terminalId) => {
        const terminal = terminals?.find(t => t.id === terminalId);
        return terminal?.name || terminalId?.substring(0, 8) || 'Desconhecido';
    };

    const formatTime = (timestamp) => {
        if (!timestamp) return '--:--';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return date.toLocaleString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const formatLastSeen = (lastSeen) => {
        if (!lastSeen) return 'Nunca';
        const date = new Date(lastSeen);
        const diffMinutes = Math.floor((new Date() - date) / (1000 * 60));
        if (diffMinutes < 60) return `${diffMinutes} min atrás`;
        const diffHours = Math.floor(diffMinutes / 60);
        if (diffHours < 24) return `${diffHours}h atrás`;
        return `${Math.floor(diffHours / 24)} dias`;
    };

    const totalProblems = alerts.length + downTerminals.length;

    if (totalProblems === 0) {
        return null; // Não mostrar se não houver problemas
    }

    return (
        <div className="space-y-4 mb-6">
            {/* Terminais em Pane - Prioridade Alta */}
            {downTerminals.length > 0 && (
                <div className="bg-gradient-to-r from-red-50 to-red-100 border border-red-200 rounded-xl p-4 shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-red-500 rounded-full flex items-center justify-center animate-pulse">
                                <WifiOff size={20} color="white" />
                            </div>
                            <div>
                                <h3 className="font-bold text-red-800 flex items-center gap-2">
                                    🚨 Terminais em Pane ({downTerminals.length})
                                </h3>
                                <p className="text-xs text-red-600">
                                    Deveriam estar online mas não estão respondendo
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={() => setShowDownTerminals(!showDownTerminals)}
                            className="text-red-700 text-sm font-medium hover:underline"
                        >
                            {showDownTerminals ? 'Ocultar ▲' : 'Mostrar ▼'}
                        </button>
                    </div>

                    {showDownTerminals && (
                        <div className="grid gap-2">
                            {downTerminals.map(terminal => (
                                <div
                                    key={terminal.id}
                                    className="bg-white rounded-lg p-3 flex items-center gap-3 border-l-4 border-red-500"
                                >
                                    <Monitor size={18} className="text-red-500" />
                                    <div className="flex-1">
                                        <div className="font-semibold text-slate-800">{terminal.name}</div>
                                        <div className="text-xs text-slate-500">{terminal.location}</div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-xs font-bold text-red-600">OFFLINE</div>
                                        <div className="text-[10px] text-slate-400">
                                            Visto: {formatLastSeen(terminal.last_seen)}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Alertas de Anomalias */}
            {alerts.length > 0 && (
                <div style={{
                    background: 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)',
                    border: '1px solid #fecaca',
                    borderRadius: '12px',
                    padding: '16px',
                    boxShadow: '0 4px 6px -1px rgba(239, 68, 68, 0.1)'
                }}>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: isExpanded ? '16px' : '0'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{
                                background: '#ef4444',
                                borderRadius: '50%',
                                padding: '8px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}>
                                <AlertTriangle size={20} color="white" />
                            </div>
                            <div>
                                <h3 style={{ margin: 0, color: '#991b1b', fontWeight: '600' }}>
                                    Alertas de Tela ({alerts.length})
                                </h3>
                                <p style={{ margin: 0, fontSize: '12px', color: '#b91c1c' }}>
                                    Anomalias detectadas nas últimas 24h
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={() => setIsExpanded(!isExpanded)}
                            style={{
                                background: 'transparent',
                                border: 'none',
                                color: '#991b1b',
                                cursor: 'pointer',
                                padding: '8px 16px',
                                borderRadius: '8px',
                                fontWeight: '500'
                            }}
                        >
                            {isExpanded ? 'Recolher ▲' : 'Ver Detalhes ▼'}
                        </button>
                    </div>

                    {isExpanded && (
                        <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '8px',
                            maxHeight: '300px',
                            overflowY: 'auto'
                        }}>
                            {alerts.map(alert => {
                                const Icon = ANOMALY_ICONS[alert.type] || AlertTriangle;
                                const color = ANOMALY_COLORS[alert.type] || '#ef4444';

                                return (
                                    <div
                                        key={alert.id}
                                        style={{
                                            background: 'white',
                                            borderRadius: '8px',
                                            padding: '12px 16px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '12px',
                                            borderLeft: `4px solid ${color}`
                                        }}
                                    >
                                        <Icon size={20} color={color} />
                                        <div style={{ flex: 1 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <Monitor size={14} color="#6b7280" />
                                                <span style={{ fontWeight: '600', color: '#374151' }}>
                                                    {getTerminalName(alert.terminalId)}
                                                </span>
                                                <span style={{
                                                    background: color,
                                                    color: 'white',
                                                    padding: '2px 8px',
                                                    borderRadius: '4px',
                                                    fontSize: '10px',
                                                    fontWeight: '600'
                                                }}>
                                                    {alert.type}
                                                </span>
                                            </div>
                                            <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#6b7280' }}>
                                                {alert.description}
                                            </p>
                                            <span style={{ fontSize: '11px', color: '#9ca3af' }}>
                                                {formatTime(alert.timestamp)}
                                            </span>
                                        </div>
                                        <button
                                            onClick={() => markAsResolved(alert.id)}
                                            title="Marcar como resolvido"
                                            style={{
                                                background: '#dcfce7',
                                                border: 'none',
                                                borderRadius: '8px',
                                                padding: '8px',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center'
                                            }}
                                        >
                                            <CheckCircle size={16} color="#16a34a" />
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default ScreenAlertsPanel;

