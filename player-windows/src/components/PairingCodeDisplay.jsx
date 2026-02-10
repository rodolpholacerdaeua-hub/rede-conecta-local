import React, { useState, useEffect } from 'react';
import { registerPairingCode, checkPairingStatus } from '../supabase';
import { remoteLog } from '../utils/telemetry';

const PairingCodeDisplay = ({ authReady, hardwareId, terminalId }) => {
    const [code, setCode] = useState(null);

    useEffect(() => {
        if (!authReady) return;
        remoteLog(terminalId, "INFO", "PairingCodeDisplay Mounted");

        let cur = sessionStorage.getItem('pairing_code');
        if (!cur) {
            cur = Math.random().toString(36).substring(2, 8).toUpperCase();
            sessionStorage.setItem('pairing_code', cur);
        }
        setCode(cur);

        const doRegister = async () => {
            try {
                const { error } = await registerPairingCode(cur, hardwareId || 'unknown');
                if (error) throw error;
                remoteLog(terminalId, "INFO", "Pairing Code Registered", { code: cur });
            } catch (e) {
                remoteLog(terminalId, "ERROR", "Fail to register pairing code", { err: e.message });
            }
        };
        doRegister();

        const checkPairing = async () => {
            const { paired, terminalId: newTerminalId } = await checkPairingStatus(cur);
            if (paired && newTerminalId) {
                remoteLog(terminalId, "INFO", "Terminal Linked Successfully", { newId: newTerminalId });
                localStorage.setItem('terminal_id', newTerminalId);
                sessionStorage.removeItem('pairing_code');
                window.location.reload();
            }
        };

        const interval = setInterval(checkPairing, 3000);
        return () => clearInterval(interval);
    }, [authReady, hardwareId, terminalId]);

    if (!authReady) {
        return <div className="subtitle animate-pulse">Estabelecendo Conexão Segura...</div>;
    }

    return (
        <div className="panel">
            <span className="subtitle">CÓDIGO DE ATIVAÇÃO</span>
            <div className="pairing-box">
                <code className="pairing-code">{code || '---'}</code>
            </div>
            <p style={{ marginTop: '2rem', color: '#475569', fontSize: '0.8rem' }}>
                Acesse o Painel Admin para parear este terminal
            </p>
        </div>
    );
};

export default PairingCodeDisplay;
