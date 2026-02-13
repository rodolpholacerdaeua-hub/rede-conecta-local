import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Monitor, Zap, Shield, Wifi, TrendingUp, Users, ArrowRight,
    CheckCircle, Star, Play, BarChart3, Clock, ChevronDown,
    DollarSign, Eye, Sparkles, Target, MapPin, CalendarDays
} from 'lucide-react';
import ConnectaMascot from '../components/ConnectaMascot';

/**
 * LandingPage — Página pública de conversão (Dark Theme)
 *
 * Foco: ANUNCIANTES
 * Gatilhos: Prova Social, Escassez, Autoridade, Urgência, Ancoragem
 * Equipamento: Totem DOOH (tela vertical + componentes)
 */

// ── Intersection Observer ───────────────────────────────
function useInView(options = {}) {
    const ref = useRef(null);
    const [isInView, setIsInView] = useState(false);
    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const observer = new IntersectionObserver(
            ([entry]) => { if (entry.isIntersecting) setIsInView(true); },
            { threshold: 0.15, ...options }
        );
        observer.observe(el);
        return () => observer.disconnect();
    }, []);
    return [ref, isInView];
}

// ── Animated Counter ────────────────────────────────────
function Counter({ end, suffix = '', duration = 2000 }) {
    const [count, setCount] = useState(0);
    const [ref, isInView] = useInView();
    useEffect(() => {
        if (!isInView) return;
        let start = 0;
        const step = end / (duration / 16);
        const timer = setInterval(() => {
            start += step;
            if (start >= end) { setCount(end); clearInterval(timer); }
            else setCount(Math.floor(start));
        }, 16);
        return () => clearInterval(timer);
    }, [isInView, end, duration]);
    return <span ref={ref}>{count}{suffix}</span>;
}

// ── Section Wrapper ─────────────────────────────────────
function Section({ children, className = '', delay = 0, id }) {
    const [ref, isInView] = useInView();
    return (
        <section
            ref={ref}
            id={id}
            className={`transition-all duration-700 ${isInView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'} ${className}`}
            style={{ transitionDelay: `${delay}ms` }}
        >
            {children}
        </section>
    );
}

// ── SVG Totem DOOH ──────────────────────────────────────
function TotemSVG({ className = '', variant = 1 }) {
    return (
        <svg viewBox="0 0 120 320" className={className} xmlns="http://www.w3.org/2000/svg">
            {/* Base do totem */}
            <rect x="35" y="280" width="50" height="12" rx="3" fill="#1e293b" />
            <rect x="30" y="288" width="60" height="8" rx="2" fill="#0f172a" />

            {/* Coluna */}
            <rect x="52" y="260" width="16" height="28" rx="2" fill="#1e293b" />

            {/* Corpo da tela */}
            <rect x="10" y="20" width="100" height="245" rx="8" fill="#1e293b" stroke="#334155" strokeWidth="1" />

            {/* Tela */}
            <rect x="15" y="25" width="90" height="235" rx="5"
                fill={variant === 1 ? 'url(#screenGrad1)' : variant === 2 ? 'url(#screenGrad2)' : 'url(#screenGrad3)'} />

            {/* Reflexo */}
            <rect x="15" y="25" width="40" height="100" rx="5" fill="white" opacity="0.03" />

            {/* LED */}
            <circle cx="60" cy="14" r="3" fill="#06b6d4" opacity="0.6">
                <animate attributeName="opacity" values="0.6;0.2;0.6" dur="2s" repeatCount="indefinite" />
            </circle>

            <defs>
                <linearGradient id="screenGrad1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#1d4ed8" stopOpacity="0.4" />
                    <stop offset="50%" stopColor="#0891b2" stopOpacity="0.2" />
                    <stop offset="100%" stopColor="#1e40af" stopOpacity="0.3" />
                </linearGradient>
                <linearGradient id="screenGrad2" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#0891b2" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="#2563eb" stopOpacity="0.4" />
                </linearGradient>
                <linearGradient id="screenGrad3" x1="1" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#1e40af" stopOpacity="0.35" />
                    <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.25" />
                </linearGradient>
            </defs>
        </svg>
    );
}

// ══════════════════════════════════════════════════════════
// LANDING PAGE — DARK THEME
// ══════════════════════════════════════════════════════════
const WHATSAPP_NUMBER = '5521990469735';
const WHATSAPP_PARTNER_URL = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent('Olá! Quero me tornar parceiro da Rede Conecta!')}`;
const WHATSAPP_GENERIC_URL = `https://wa.me/${WHATSAPP_NUMBER}`;

export default function LandingPage() {
    const navigate = useNavigate();
    const [activeFaq, setActiveFaq] = useState(null);

    const diferenciais = [
        {
            icon: Eye,
            title: 'Visibilidade Garantida',
            description: 'Seu anúncio aparece em telas estrategicamente posicionadas em estabelecimentos com alto fluxo de pessoas.',
            color: 'from-blue-500 to-blue-600'
        },
        {
            icon: BarChart3,
            title: 'Proof of Play',
            description: 'Relatórios de cada exibição. Você sabe exatamente quando e quantas vezes seu anúncio apareceu.',
            color: 'from-cyan-500 to-cyan-600'
        },
        {
            icon: Target,
            title: 'Público Local Real',
            description: 'Alcance clientes reais, no bairro certo, na hora certa. Sem desperdício com público fora do seu alcance.',
            color: 'from-blue-600 to-blue-700'
        },
        {
            icon: Zap,
            title: 'Troque a Qualquer Hora',
            description: 'Mude seu anúncio quando quiser durante o período contratado. Novo vídeo no ar em minutos.',
            color: 'from-cyan-600 to-cyan-700'
        },
        {
            icon: Shield,
            title: 'Exibição 24/7',
            description: 'Nossos totens operam com player blindado: auto-restart, crash guard e funcionamento ininterrupto.',
            color: 'from-blue-500 to-cyan-500'
        },
        {
            icon: MapPin,
            title: 'Escolha o Local',
            description: 'Selecione qual estabelecimento exibirá seu anúncio. Padaria, barbearia, academia — você decide.',
            color: 'from-blue-700 to-blue-800'
        }
    ];

    const depoimentos = [
        {
            name: 'Moisés M.',
            role: 'Carne de Sol do Guelito — Duque de Caxias, RJ',
            text: 'Coloquei a tela no meu restaurante e já recebo comissão todo mês. Percebo que os clientes prestam atenção nos anúncios enquanto esperam. Renda extra sem fazer nada.',
            stars: 5
        },
        {
            name: 'Dra. Meire L.',
            role: 'Clínica Odontológica — Duque de Caxias, RJ',
            text: 'Investi R$69 numa semana teste. Recebi 3 agendamentos de pacientes novos do bairro. Vale cada centavo.',
            stars: 5
        },
        {
            name: 'Bruno C.',
            role: 'Personal Trainer — RJ',
            text: 'Antes eu gastava com panfleto. Agora tenho meu vídeo na tela da academia o dia inteiro. Profissional demais.',
            stars: 5
        }
    ];

    const planos = [
        {
            name: 'Semanal',
            desc: '7 dias de exibição',
            price: 'R$ 69',
            period: '/semana',
            features: [
                '1 vaga em totem à sua escolha',
                'Exibição contínua (7 dias)',
                'Vídeo de até 15 segundos',
                'Relatório de exibições',
                'Aprovação em até 24h'
            ],
            cta: 'Começar Agora',
            highlight: false,
            badge: 'Mais acessível'
        },
        {
            name: 'Mensal',
            desc: '30 dias de exibição',
            price: 'R$ 150',
            period: '/mês',
            features: [
                '1 vaga em totem à sua escolha',
                'Exibição contínua (30 dias)',
                'Vídeo de até 15 segundos',
                'Troca de mídia por apenas R$19',
                'Relatório completo + insights',
                'Prioridade na aprovação',
                'Economia de 46% vs semanal'
            ],
            cta: 'Melhor Custo-Benefício',
            highlight: true,
            badge: 'Mais popular'
        }
    ];
    const faqs = [
        { q: 'O que é um totem Conecta Local?', a: 'É um equipamento próprio com tela vertical e player inteligente, instalado em estabelecimentos parceiros com alto fluxo de pessoas. Ele exibe os anúncios de forma contínua e profissional.' },
        { q: 'Que tipo de mídia posso enviar?', a: 'Vídeos de até 15 segundos ou imagens estáticas. Aceitamos MP4, JPG e PNG. Todo conteúdo passa por uma aprovação rápida antes de ir ao ar.' },
        { q: 'Posso escolher em qual totem anunciar?', a: 'Sim! Você seleciona o estabelecimento que faz sentido para o seu público. Padaria, barbearia, academia, clínica — onde seu cliente está.' },
        { q: 'Como sei que meu anúncio foi exibido?', a: 'Nosso sistema gera relatórios de Proof of Play com data, horário e quantidade de exibições. Transparência total.' },
        { q: 'Posso trocar o anúncio durante o período?', a: 'No plano semanal a mídia é fixa durante os 7 dias. No plano mensal, você pode trocar por apenas R$19 a cada substituição. O novo conteúdo entra no ar após aprovação.' },
        { q: 'Qual a diferença do plano semanal e mensal?', a: 'No semanal (R$69) seu vídeo roda por 7 dias sem troca. No mensal (R$150) você tem 30 dias com possibilidade de trocar a mídia por R$19, além de relatórios mais detalhados e prioridade na aprovação.' }
    ];

    return (
        <div className="min-h-screen bg-slate-950 font-['Inter'] text-white overflow-x-hidden">

            {/* ═══ NAVBAR ═══ */}
            <nav className="fixed top-0 left-0 right-0 z-50 bg-slate-950/80 backdrop-blur-xl border-b border-white/5">
                <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                        <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center font-black text-white text-sm shadow-lg shadow-blue-600/30">
                            C
                        </div>
                        <div className="flex flex-col leading-none">
                            <span className="text-lg font-black tracking-tighter text-white font-['Outfit']">CONECTA</span>
                            <span className="text-[8px] font-black tracking-[0.25em] text-blue-400 uppercase">Local</span>
                        </div>
                    </div>
                    <div className="hidden md:flex items-center space-x-8 text-sm font-semibold text-slate-400">
                        <a href="#diferenciais" className="hover:text-white transition-colors">Diferenciais</a>
                        <a href="#como-funciona" className="hover:text-white transition-colors">Como Funciona</a>
                        <a href="#planos" className="hover:text-white transition-colors">Planos</a>
                        <a href="#faq" className="hover:text-white transition-colors">FAQ</a>
                    </div>
                    <button
                        onClick={() => navigate('/login')}
                        className="bg-blue-600 text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-blue-500 active:scale-95 transition-all shadow-lg shadow-blue-600/20"
                    >
                        Entrar
                    </button>
                </div>
            </nav>

            {/* ═══ HERO ═══ */}
            <header className="pt-28 pb-16 md:pt-36 md:pb-24 px-4 relative overflow-hidden">
                {/* Background decorativo */}
                <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[600px] h-[600px] md:w-[900px] md:h-[900px] bg-blue-600/10 rounded-full blur-3xl" />
                    <div className="absolute top-40 right-0 w-[300px] h-[300px] bg-cyan-500/8 rounded-full blur-3xl" />
                </div>

                {/* Totems decorativos (fundo com transparência) */}
                <div className="absolute inset-0 pointer-events-none overflow-hidden">
                    <div className="absolute -left-8 top-32 opacity-[0.04]">
                        <TotemSVG variant={1} className="w-28 h-auto" />
                    </div>
                    <div className="absolute right-4 top-24 opacity-[0.05]">
                        <TotemSVG variant={2} className="w-24 h-auto" />
                    </div>
                    <div className="absolute left-1/4 bottom-0 opacity-[0.03] hidden md:block">
                        <TotemSVG variant={3} className="w-20 h-auto" />
                    </div>
                    <div className="absolute right-1/4 bottom-8 opacity-[0.04] hidden md:block">
                        <TotemSVG variant={1} className="w-22 h-auto" />
                    </div>
                </div>

                <div className="max-w-6xl mx-auto relative z-10">
                    <div className="flex flex-col items-center text-center">
                        {/* Mascote */}
                        <div className="mb-6 md:mb-8">
                            <ConnectaMascot size={140} animate={true} />
                        </div>

                        {/* Badge */}
                        <div className="inline-flex items-center space-x-2 bg-blue-500/10 border border-blue-500/20 px-4 py-2 rounded-full mb-6">
                            <Sparkles className="w-4 h-4 text-cyan-400" />
                            <span className="text-sm font-bold text-blue-300">
                                Anuncie a partir de R$69/semana
                            </span>
                        </div>

                        {/* Headline */}
                        <h1 className="text-4xl md:text-6xl lg:text-7xl font-black tracking-tighter text-white leading-[0.95] mb-4 font-['Outfit']">
                            Seu anúncio na tela<br />
                            <span className="bg-gradient-to-r from-blue-400 via-cyan-400 to-blue-500 bg-clip-text text-transparent">
                                do bairro inteiro.
                            </span>
                        </h1>

                        <p className="text-lg md:text-xl text-slate-400 max-w-xl mx-auto mb-8 font-medium leading-relaxed">
                            Divulgue seu negócio em <strong className="text-white">totens digitais</strong> posicionados
                            em estabelecimentos com alto fluxo. Público local, resultado real.
                        </p>

                        {/* CTAs */}
                        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                            <button
                                onClick={() => navigate('/login?modo=cadastro&tipo=anunciante')}
                                className="group bg-blue-600 text-white px-8 py-4 rounded-2xl font-bold text-base hover:bg-blue-500 active:scale-[0.97] transition-all shadow-xl shadow-blue-600/25 flex items-center justify-center space-x-2"
                            >
                                <span>Quero Anunciar</span>
                                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                            </button>
                            <a
                                href="#como-funciona"
                                className="group bg-white/5 text-slate-300 px-8 py-4 rounded-2xl font-bold text-base border border-white/10 hover:border-blue-500/30 hover:text-white active:scale-[0.97] transition-all flex items-center justify-center space-x-2"
                            >
                                <Play className="w-4 h-4" />
                                <span>Como funciona</span>
                            </a>
                        </div>

                        {/* Trust signals */}
                        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6 mt-8 text-sm text-slate-500">
                            <span className="flex items-center space-x-1.5">
                                <CheckCircle className="w-4 h-4 text-cyan-500" />
                                <span>Aprovação em até 24h</span>
                            </span>
                            <span className="flex items-center space-x-1.5">
                                <BarChart3 className="w-4 h-4 text-blue-500" />
                                <span>Proof of Play incluso</span>
                            </span>
                            <span className="flex items-center space-x-1.5">
                                <Monitor className="w-4 h-4 text-cyan-500" />
                                <span>Totens em pontos estratégicos</span>
                            </span>
                        </div>
                    </div>
                </div>
            </header>

            {/* ═══ NÚMEROS ═══ */}
            <Section className="py-12 border-y border-white/5 bg-slate-900/50">
                <div className="max-w-6xl mx-auto px-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
                        {[
                            { value: 500, suffix: '+', label: 'Exibições por dia', icon: Eye },
                            { value: 24, suffix: '/7', label: 'Operação contínua', icon: Clock },
                            { value: 13, suffix: '', label: 'Slots por totem', icon: Monitor },
                            { value: 99, suffix: '%', label: 'Uptime garantido', icon: Shield }
                        ].map((stat, i) => (
                            <div key={i} className="flex flex-col items-center">
                                <stat.icon className="w-5 h-5 text-cyan-400 mb-2 opacity-60" />
                                <span className="text-3xl md:text-4xl font-black font-['Outfit'] tracking-tighter text-white">
                                    <Counter end={stat.value} suffix={stat.suffix} />
                                </span>
                                <span className="text-xs text-slate-500 mt-1 font-semibold uppercase tracking-wider">{stat.label}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </Section>

            {/* ═══ DIFERENCIAIS ═══ */}
            <Section id="diferenciais" className="py-16 md:py-24 px-4 relative">
                {/* Totem decorativo */}
                <div className="absolute right-0 top-1/2 -translate-y-1/2 opacity-[0.03] pointer-events-none hidden lg:block">
                    <TotemSVG variant={2} className="w-40 h-auto" />
                </div>

                <div className="max-w-6xl mx-auto relative z-10">
                    <div className="text-center mb-12">
                        <span className="text-sm font-black text-cyan-400 uppercase tracking-[0.2em]">Diferenciais</span>
                        <h2 className="text-3xl md:text-5xl font-black tracking-tighter text-white mt-2 font-['Outfit']">
                            Por que anunciar no Conecta?
                        </h2>
                        <p className="text-slate-400 mt-3 max-w-2xl mx-auto">
                            Seu anúncio onde seu cliente realmente está: <strong className="text-slate-200">no comércio do bairro</strong>.
                        </p>
                    </div>

                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
                        {diferenciais.map((d, i) => (
                            <Section key={i} delay={i * 100}>
                                <div className="group relative bg-slate-900/50 rounded-2xl p-6 border border-white/5 hover:border-blue-500/20 hover:bg-slate-800/50 transition-all duration-300 cursor-default">
                                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${d.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-lg`}>
                                        <d.icon className="w-6 h-6 text-white" />
                                    </div>
                                    <h3 className="text-lg font-bold text-white mb-2">{d.title}</h3>
                                    <p className="text-sm text-slate-400 leading-relaxed">{d.description}</p>
                                </div>
                            </Section>
                        ))}
                    </div>
                </div>
            </Section>

            {/* ═══ COMO FUNCIONA ═══ */}
            <Section id="como-funciona" className="py-16 md:py-24 px-4 bg-slate-900/30 border-y border-white/5 relative">
                {/* Totems decorativos */}
                <div className="absolute left-8 top-20 opacity-[0.03] pointer-events-none hidden md:block">
                    <TotemSVG variant={3} className="w-16 h-auto" />
                </div>
                <div className="absolute right-12 bottom-20 opacity-[0.04] pointer-events-none hidden md:block">
                    <TotemSVG variant={1} className="w-20 h-auto" />
                </div>

                <div className="max-w-4xl mx-auto relative z-10">
                    <div className="text-center mb-12">
                        <span className="text-sm font-black text-cyan-400 uppercase tracking-[0.2em]">Simples assim</span>
                        <h2 className="text-3xl md:text-5xl font-black tracking-tighter text-white mt-2 font-['Outfit']">
                            3 passos para anunciar
                        </h2>
                    </div>

                    <div className="space-y-6 md:space-y-0 md:grid md:grid-cols-3 md:gap-8">
                        {[
                            { num: '01', title: 'Escolha o local', desc: 'Selecione o totem ideal: padaria, barbearia, academia, clínica...' },
                            { num: '02', title: 'Envie sua mídia', desc: 'Vídeo ou imagem. Aprovação rápida pela nossa equipe.' },
                            { num: '03', title: 'Apareça na tela', desc: 'Seu anúncio roda no totem para centenas de pessoas por dia.' }
                        ].map((p, i) => (
                            <Section key={i} delay={i * 150}>
                                <div className="relative text-center">
                                    <span className="text-6xl font-black text-blue-500/10 font-['Outfit'] leading-none">{p.num}</span>
                                    <h3 className="text-xl font-bold text-white -mt-3 mb-2">{p.title}</h3>
                                    <p className="text-sm text-slate-400">{p.desc}</p>
                                    {i < 2 && (
                                        <div className="hidden md:block absolute top-8 -right-4 text-blue-600/30">
                                            <ArrowRight className="w-6 h-6" />
                                        </div>
                                    )}
                                </div>
                            </Section>
                        ))}
                    </div>

                    {/* CTA após os 3 passos */}
                    <div className="text-center mt-12">
                        <button
                            onClick={() => navigate('/login?modo=cadastro&tipo=anunciante')}
                            className="group bg-blue-600 text-white px-8 py-4 rounded-2xl font-bold text-base hover:bg-blue-500 active:scale-[0.97] transition-all shadow-xl shadow-blue-600/25 inline-flex items-center space-x-2"
                        >
                            <span>Quero Anunciar</span>
                            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                        </button>
                    </div>
                </div>
            </Section>

            {/* ═══ DEPOIMENTOS ═══ */}
            <Section className="py-16 md:py-24 px-4">
                <div className="max-w-6xl mx-auto">
                    <div className="text-center mb-12">
                        <span className="text-sm font-black text-cyan-400 uppercase tracking-[0.2em]">Depoimentos</span>
                        <h2 className="text-3xl md:text-5xl font-black tracking-tighter text-white mt-2 font-['Outfit']">
                            Quem anuncia, recomenda
                        </h2>
                    </div>

                    <div className="grid md:grid-cols-3 gap-6">
                        {depoimentos.map((d, i) => (
                            <Section key={i} delay={i * 100}>
                                <div className="bg-slate-900/50 rounded-2xl p-6 border border-white/5 h-full flex flex-col">
                                    <div className="flex space-x-1 mb-3">
                                        {Array.from({ length: d.stars }).map((_, j) => (
                                            <Star key={j} className="w-4 h-4 text-amber-400 fill-amber-400" />
                                        ))}
                                    </div>
                                    <p className="text-slate-300 text-sm leading-relaxed mb-4 flex-1">"{d.text}"</p>
                                    <div className="flex items-center space-x-3">
                                        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                                            {d.name.charAt(0)}
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-white">{d.name}</p>
                                            <p className="text-xs text-slate-500">{d.role}</p>
                                        </div>
                                    </div>
                                </div>
                            </Section>
                        ))}
                    </div>
                </div>
            </Section>

            {/* ═══ PLANOS (Ancoragem + Urgência) ═══ */}
            <Section id="planos" className="py-16 md:py-24 px-4 bg-slate-900/30 border-y border-white/5 relative">
                {/* Totem decorativo */}
                <div className="absolute left-0 top-1/3 opacity-[0.03] pointer-events-none hidden lg:block">
                    <TotemSVG variant={1} className="w-32 h-auto" />
                </div>

                <div className="max-w-4xl mx-auto relative z-10">
                    <div className="text-center mb-12">
                        <span className="text-sm font-black text-cyan-400 uppercase tracking-[0.2em]">Planos</span>
                        <h2 className="text-3xl md:text-5xl font-black tracking-tighter text-white mt-2 font-['Outfit']">
                            Invista na visibilidade<br />do seu negócio
                        </h2>
                        <p className="text-slate-400 mt-3 max-w-xl mx-auto">
                            Escolha o período que melhor combina com sua estratégia. <strong className="text-slate-200">Sem surpresas, sem letras miúdas.</strong>
                        </p>
                    </div>

                    <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
                        {planos.map((p, i) => (
                            <Section key={i} delay={i * 150}>
                                <div className={`relative rounded-2xl p-8 border transition-all ${p.highlight
                                    ? 'bg-gradient-to-b from-blue-600/20 to-blue-700/10 border-blue-500/30 shadow-2xl shadow-blue-600/10'
                                    : 'bg-slate-800/30 border-white/5 hover:border-white/10'
                                    }`}>
                                    {p.badge && (
                                        <div className={`absolute -top-3 left-1/2 -translate-x-1/2 text-xs font-black px-4 py-1 rounded-full uppercase tracking-wider ${p.highlight
                                            ? 'bg-cyan-400 text-slate-900'
                                            : 'bg-slate-700 text-slate-300'
                                            }`}>
                                            {p.badge}
                                        </div>
                                    )}
                                    <div className="flex items-center space-x-2 mb-1 mt-2">
                                        <CalendarDays className="w-5 h-5 text-blue-400" />
                                        <h3 className="text-xl font-bold text-white">{p.name}</h3>
                                    </div>
                                    <p className="text-sm text-slate-400 mb-4">{p.desc}</p>
                                    <div className="mb-6">
                                        <span className="text-4xl font-black font-['Outfit'] tracking-tighter text-white">{p.price}</span>
                                        <span className="text-sm text-slate-400 ml-1">{p.period}</span>
                                    </div>
                                    <ul className="space-y-3 mb-8">
                                        {p.features.map((f, j) => (
                                            <li key={j} className="flex items-start space-x-2 text-sm">
                                                <CheckCircle className="w-4 h-4 text-cyan-400 mt-0.5 shrink-0" />
                                                <span className="text-slate-300">{f}</span>
                                            </li>
                                        ))}
                                    </ul>
                                    <button
                                        onClick={() => navigate('/login?modo=cadastro&tipo=anunciante')}
                                        className={`w-full py-3.5 rounded-xl font-bold text-sm transition-all active:scale-[0.97] ${p.highlight
                                            ? 'bg-blue-600 text-white hover:bg-blue-500 shadow-lg shadow-blue-600/20'
                                            : 'bg-white/5 text-white border border-white/10 hover:bg-white/10'
                                            }`}
                                    >
                                        {p.cta}
                                    </button>
                                </div>
                            </Section>
                        ))}
                    </div>
                </div>
            </Section>

            {/* ═══ FAQ ═══ */}
            <Section id="faq" className="py-16 md:py-24 px-4">
                <div className="max-w-3xl mx-auto">
                    <div className="text-center mb-12">
                        <span className="text-sm font-black text-cyan-400 uppercase tracking-[0.2em]">Dúvidas</span>
                        <h2 className="text-3xl md:text-5xl font-black tracking-tighter text-white mt-2 font-['Outfit']">
                            Perguntas frequentes
                        </h2>
                    </div>

                    <div className="space-y-3">
                        {faqs.map((faq, i) => (
                            <div key={i} className="border border-white/5 rounded-xl overflow-hidden bg-slate-900/30">
                                <button
                                    onClick={() => setActiveFaq(activeFaq === i ? null : i)}
                                    className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-white/5 transition-colors"
                                >
                                    <span className="font-bold text-sm text-slate-200">{faq.q}</span>
                                    <ChevronDown className={`w-5 h-5 text-slate-500 transition-transform duration-300 shrink-0 ml-4 ${activeFaq === i ? 'rotate-180' : ''}`} />
                                </button>
                                <div className={`transition-all duration-300 overflow-hidden ${activeFaq === i ? 'max-h-40 opacity-100' : 'max-h-0 opacity-0'}`}>
                                    <p className="px-6 pb-4 text-sm text-slate-400 leading-relaxed">{faq.a}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </Section>

            {/* ═══ CTA FINAL ═══ */}
            <Section className="py-16 md:py-24 px-4 relative overflow-hidden">
                {/* Glow decorativo */}
                <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-blue-600/8 rounded-full blur-3xl" />
                </div>

                <div className="max-w-3xl mx-auto text-center relative z-10">
                    <div className="mb-6">
                        <ConnectaMascot size={100} animate={true} />
                    </div>
                    <h2 className="text-3xl md:text-5xl font-black tracking-tighter font-['Outfit'] mb-4 text-white">
                        Seu próximo cliente está<br />
                        <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">passando pelo totem agora</span>
                    </h2>
                    <p className="text-slate-400 text-lg mb-8 max-w-xl mx-auto">
                        Não perca vendas por falta de visibilidade.
                        Comece com <strong className="text-white">R$69 por semana</strong> e veja o resultado.
                    </p>
                    <button
                        onClick={() => navigate('/login?modo=cadastro&tipo=anunciante')}
                        className="bg-blue-600 text-white px-10 py-4 rounded-2xl font-bold text-base hover:bg-blue-500 active:scale-[0.97] transition-all shadow-xl shadow-blue-600/25 inline-flex items-center space-x-2 group"
                    >
                        <span>Começar a Anunciar</span>
                        <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </button>
                </div>
            </Section>

            {/* ═══ PARCEIRO (Seção secundária) ═══ */}
            <section className="py-12 px-4 border-t border-white/5">
                <div className="max-w-3xl mx-auto text-center">
                    <p className="text-slate-500 text-sm mb-3">Tem um estabelecimento com alto fluxo?</p>
                    <h3 className="text-xl font-bold text-slate-300 mb-2">Torne-se um Parceiro Conecta</h3>
                    <p className="text-slate-500 text-sm max-w-lg mx-auto mb-4">
                        Instalamos um totem no seu espaço sem custo. Você ganha comissão por cada anunciante.
                        Sujeito à disponibilidade de equipamento e análise do local.
                    </p>
                    <a
                        href={WHATSAPP_PARTNER_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:text-blue-300 font-bold text-sm transition-colors inline-flex items-center space-x-1"
                    >
                        <span>Solicitar análise do meu estabelecimento</span>
                        <ArrowRight className="w-4 h-4" />
                    </a>
                </div>
            </section>

            {/* ═══ FOOTER ═══ */}
            <footer className="border-t border-white/5 py-10 px-4">
                <div className="max-w-6xl mx-auto">
                    <div className="flex flex-col md:flex-row items-center justify-between space-y-4 md:space-y-0">
                        <div className="flex items-center space-x-2">
                            <div className="w-8 h-8 bg-blue-600 rounded-xl flex items-center justify-center font-black text-white text-sm shadow-lg shadow-blue-600/20">C</div>
                            <span className="text-lg font-black tracking-tighter font-['Outfit'] text-white">CONECTA LOCAL</span>
                        </div>
                        <div className="flex flex-wrap justify-center gap-6 text-sm text-slate-500">
                            <a href="#diferenciais" className="hover:text-white transition-colors">Diferenciais</a>
                            <a href="#como-funciona" className="hover:text-white transition-colors">Como Funciona</a>
                            <a href="#planos" className="hover:text-white transition-colors">Planos</a>
                            <a href="#faq" className="hover:text-white transition-colors">FAQ</a>
                        </div>
                        <p className="text-sm text-slate-600">
                            © 2026 Rede Conecta Local
                        </p>
                    </div>
                </div>
            </footer>

            {/* ═══ FLOATING WHATSAPP BUTTON ═══ */}
            <a
                href={WHATSAPP_GENERIC_URL}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Fale conosco pelo WhatsApp"
                className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-[#25D366] rounded-full flex items-center justify-center shadow-lg shadow-[#25D366]/30 hover:scale-110 active:scale-95 transition-all group"
            >
                {/* WhatsApp SVG Icon */}
                <svg viewBox="0 0 32 32" className="w-7 h-7 fill-white">
                    <path d="M16.004 3.2C9.002 3.2 3.306 8.896 3.306 15.898c0 2.236.584 4.42 1.694 6.346L3.2 28.8l6.748-1.77a12.614 12.614 0 006.056 1.542h.005c7 0 12.697-5.696 12.697-12.698 0-3.394-1.32-6.584-3.72-8.984A12.624 12.624 0 0016.004 3.2zm0 23.182a10.4 10.4 0 01-5.314-1.454l-.38-.228-3.946 1.034 1.054-3.848-.248-.396A10.476 10.476 0 015.52 15.898c0-5.782 4.704-10.486 10.488-10.486 2.8 0 5.432 1.092 7.412 3.072a10.414 10.414 0 013.07 7.416c-.002 5.784-4.706 10.482-10.486 10.482zm5.75-7.852c-.314-.158-1.862-.92-2.15-1.024-.29-.106-.5-.158-.712.158-.21.316-.816 1.024-1.002 1.234-.184.212-.368.238-.682.08-.316-.158-1.332-.49-2.538-1.566-.938-.836-1.572-1.87-1.756-2.184-.184-.316-.02-.486.138-.644.142-.142.316-.368.474-.554.158-.184.21-.316.316-.528.106-.21.052-.396-.028-.554-.08-.158-.712-1.714-.976-2.348-.256-.616-.518-.532-.712-.542-.184-.008-.396-.01-.608-.01s-.554.08-.844.396c-.29.316-1.108 1.082-1.108 2.64 0 1.556 1.134 3.06 1.292 3.27.158.212 2.234 3.412 5.412 4.788.756.326 1.346.52 1.806.666.76.242 1.45.208 1.996.126.61-.092 1.862-.762 2.124-1.498.264-.736.264-1.366.184-1.498-.078-.132-.29-.21-.606-.368z" />
                </svg>
                {/* Pulse ring */}
                <span className="absolute inset-0 rounded-full bg-[#25D366] animate-ping opacity-20" />
            </a>
        </div>
    );
}
