import React from 'react';

/**
 * ConnectaMascot — SVG mascote do Conecta Local
 * Tela vertical sorridente com bracinhos e perninhas
 */
const ConnectaMascot = ({ className = '', size = 200, animate = true }) => {
    const w = size;
    const h = size * 1.4;

    return (
        <svg
            viewBox="0 0 200 280"
            width={w}
            height={h}
            className={className}
            xmlns="http://www.w3.org/2000/svg"
            role="img"
            aria-label="Mascote Conecta Local"
        >
            {/* Sombra no chão */}
            <ellipse cx="100" cy="268" rx="50" ry="8" fill="#0f172a" opacity="0.1">
                {animate && (
                    <animate attributeName="rx" values="50;45;50" dur="2s" repeatCount="indefinite" />
                )}
            </ellipse>

            {/* Perna esquerda */}
            <g>
                {animate && (
                    <animateTransform attributeName="transform" type="rotate" values="0 80 230;5 80 230;0 80 230;-5 80 230;0 80 230" dur="2s" repeatCount="indefinite" />
                )}
                <rect x="72" y="220" width="16" height="35" rx="8" fill="#1e40af" />
                <ellipse cx="80" cy="258" rx="12" ry="7" fill="#0f172a" />
            </g>

            {/* Perna direita */}
            <g>
                {animate && (
                    <animateTransform attributeName="transform" type="rotate" values="0 120 230;-5 120 230;0 120 230;5 120 230;0 120 230" dur="2s" repeatCount="indefinite" />
                )}
                <rect x="112" y="220" width="16" height="35" rx="8" fill="#1e40af" />
                <ellipse cx="120" cy="258" rx="12" ry="7" fill="#0f172a" />
            </g>

            {/* Corpo — Tela vertical */}
            <g>
                {animate && (
                    <animateTransform attributeName="transform" type="translate" values="0 0;0 -4;0 0" dur="2s" repeatCount="indefinite" />
                )}

                {/* Sombra do corpo */}
                <rect x="38" y="48" width="124" height="180" rx="16" fill="#0f172a" opacity="0.15" />

                {/* Corpo externo (carcaça) */}
                <rect x="35" y="45" width="130" height="180" rx="16" fill="#1e40af" />

                {/* Borda interna brilho */}
                <rect x="38" y="48" width="124" height="174" rx="14" fill="#2563eb" />

                {/* Tela (display area) */}
                <rect x="45" y="55" width="110" height="158" rx="10" fill="#0f172a" />

                {/* Reflexo na tela */}
                <rect x="48" y="58" width="40" height="60" rx="8" fill="white" opacity="0.06" />

                {/* Rosto — Olhos */}
                <ellipse cx="78" cy="110" rx="11" ry="13" fill="white" />
                <ellipse cx="122" cy="110" rx="11" ry="13" fill="white" />

                {/* Pupilas */}
                <ellipse cx="80" cy="112" rx="6" ry="7" fill="#06b6d4">
                    {animate && (
                        <animate attributeName="cx" values="80;82;80;78;80" dur="3s" repeatCount="indefinite" />
                    )}
                </ellipse>
                <ellipse cx="124" cy="112" rx="6" ry="7" fill="#06b6d4">
                    {animate && (
                        <animate attributeName="cx" values="124;126;124;122;124" dur="3s" repeatCount="indefinite" />
                    )}
                </ellipse>

                {/* Brilho nos olhos */}
                <circle cx="75" cy="107" r="3" fill="white" opacity="0.9" />
                <circle cx="119" cy="107" r="3" fill="white" opacity="0.9" />

                {/* Sorriso */}
                <path d="M78 140 Q100 160 122 140" fill="none" stroke="#06b6d4" strokeWidth="4" strokeLinecap="round">
                    {animate && (
                        <animate attributeName="d" values="M78 140 Q100 160 122 140;M78 138 Q100 162 122 138;M78 140 Q100 160 122 140" dur="2s" repeatCount="indefinite" />
                    )}
                </path>

                {/* Bochechas */}
                <circle cx="68" cy="135" r="8" fill="#06b6d4" opacity="0.2" />
                <circle cx="132" cy="135" r="8" fill="#06b6d4" opacity="0.2" />

                {/* Antenas / sinal WiFi no topo */}
                <circle cx="100" cy="38" r="6" fill="#06b6d4" />
                <rect x="97" y="30" width="6" height="18" rx="3" fill="#06b6d4" />

                {/* Ondas de sinal */}
                <path d="M85 28 Q100 15 115 28" fill="none" stroke="#06b6d4" strokeWidth="2.5" opacity="0.6" strokeLinecap="round">
                    {animate && (
                        <animate attributeName="opacity" values="0.6;0.2;0.6" dur="1.5s" repeatCount="indefinite" />
                    )}
                </path>
                <path d="M78 20 Q100 5 122 20" fill="none" stroke="#06b6d4" strokeWidth="2" opacity="0.3" strokeLinecap="round">
                    {animate && (
                        <animate attributeName="opacity" values="0.3;0.1;0.3" dur="1.5s" repeatCount="indefinite" begin="0.3s" />
                    )}
                </path>

                {/* Braço esquerdo (acenando) */}
                <g>
                    {animate && (
                        <animateTransform attributeName="transform" type="rotate" values="0 35 130;-20 35 130;0 35 130;10 35 130;0 35 130" dur="1.5s" repeatCount="indefinite" />
                    )}
                    <rect x="8" y="115" width="30" height="14" rx="7" fill="#2563eb" />
                    {/* Mãozinha */}
                    <circle cx="10" cy="122" r="9" fill="#1e40af" />
                    <circle cx="6" cy="117" r="4" fill="#2563eb" />
                </g>

                {/* Braço direito */}
                <g>
                    {animate && (
                        <animateTransform attributeName="transform" type="rotate" values="0 165 130;8 165 130;0 165 130" dur="2s" repeatCount="indefinite" />
                    )}
                    <rect x="162" y="120" width="30" height="14" rx="7" fill="#2563eb" />
                    {/* Mãozinha */}
                    <circle cx="190" cy="127" r="9" fill="#1e40af" />
                </g>

                {/* LED indicador (ligado) */}
                <circle cx="100" cy="200" r="4" fill="#22c55e">
                    {animate && (
                        <animate attributeName="opacity" values="1;0.4;1" dur="2s" repeatCount="indefinite" />
                    )}
                </circle>
            </g>
        </svg>
    );
};

export default ConnectaMascot;
