import React from 'react';
import { Monitor, Loader2 } from 'lucide-react';

const CURRENT_VERSION = `V${typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0'}`;

const SplashScreen = () => (
    <div className="splash-overlay" style={{ background: '#2563eb' }}>
        <div className="logo-container">
            <div className="logo-box" style={{ background: 'white' }}>
                <Monitor size={60} color="#2563eb" />
            </div>
            <h1 className="title">REDE <span style={{ color: '#93c5fd' }}>CONECTA</span></h1>
            <p className="subtitle" style={{ marginTop: '1rem', color: 'white', fontSize: '1.5rem' }}>{CURRENT_VERSION}</p>
        </div>
        <div style={{ position: 'absolute', bottom: '80px' }}>
            <Loader2 className="animate-spin" color="white" size={40} />
        </div>
    </div>
);

export default SplashScreen;
