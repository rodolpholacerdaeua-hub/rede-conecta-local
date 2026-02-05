import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Mail, Tv, Phone, MailCheck, User, Sparkles, ArrowRight, Monitor, Zap, ArrowLeft, KeyRound } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { resetPassword } from '../supabase';

const Login = () => {
    const navigate = useNavigate();
    const { login, signup } = useAuth();
    const [isLogin, setIsLogin] = useState(true);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [displayName, setDisplayName] = useState('');
    const [phone, setPhone] = useState('');
    const [registrationSuccess, setRegistrationSuccess] = useState(false);

    // Estados para recuperação de senha
    const [showForgotPassword, setShowForgotPassword] = useState(false);
    const [resetEmailSent, setResetEmailSent] = useState(false);
    const [resetEmail, setResetEmail] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            if (isLogin) {
                await login(email, password);
                navigate('/dashboard');
            } else {
                if (!displayName) throw new Error("Nome é obrigatório");
                await signup(email, password, displayName, phone);
                setRegistrationSuccess(true);
            }
        } catch (err) {
            console.error(err);
            setError(isLogin ? 'Credenciais inválidas. Verifique seu email e senha.' : 'Não foi possível criar a conta. Tente outro email.');
        } finally {
            setLoading(false);
        }
    };

    // Handler para recuperação de senha
    const handleForgotPassword = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            if (!resetEmail) throw new Error('Digite seu email');
            const { error } = await resetPassword(resetEmail);
            if (error) throw error;
            setResetEmailSent(true);
        } catch (err) {
            console.error(err);
            setError('Não foi possível enviar o email. Verifique o endereço.');
        } finally {
            setLoading(false);
        }
    };

    // Voltar ao login
    const backToLogin = () => {
        setShowForgotPassword(false);
        setResetEmailSent(false);
        setResetEmail('');
        setError('');
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 flex">
            {/* Painel Esquerdo - Branding */}
            <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
                {/* Background Pattern */}
                <div className="absolute inset-0 opacity-10">
                    <div className="absolute top-20 left-20 w-72 h-72 bg-blue-500 rounded-full blur-3xl"></div>
                    <div className="absolute bottom-20 right-20 w-96 h-96 bg-purple-500 rounded-full blur-3xl"></div>
                    <div className="absolute top-1/2 left-1/2 w-64 h-64 bg-cyan-500 rounded-full blur-3xl"></div>
                </div>

                {/* Grid Pattern */}
                <div className="absolute inset-0" style={{
                    backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.05) 1px, transparent 0)',
                    backgroundSize: '40px 40px'
                }}></div>

                {/* Content */}
                <div className="relative z-10 flex flex-col justify-center px-16 text-white">
                    <div className="mb-8">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-cyan-400 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/30">
                                <Monitor className="w-7 h-7 text-white" />
                            </div>
                            <div>
                                <h1 className="text-3xl font-black tracking-tight">Conecta Local</h1>
                                <p className="text-blue-400 text-sm font-medium">Digital Signage Platform</p>
                            </div>
                        </div>
                    </div>

                    <h2 className="text-4xl font-bold leading-tight mb-6">
                        Transforme suas telas em<br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-cyan-400 to-emerald-400">
                            canais de receita
                        </span>
                    </h2>

                    <p className="text-slate-400 text-lg mb-10 max-w-md">
                        Gerencie toda sua rede de mídia digital em um só lugar. Campanhas inteligentes, relatórios em tempo real e controle total.
                    </p>

                    {/* Features */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                                <Zap className="w-5 h-5 text-blue-400" />
                            </div>
                            <div>
                                <p className="font-semibold text-white">Controle em Tempo Real</p>
                                <p className="text-slate-500 text-sm">Atualize suas telas instantaneamente de qualquer lugar</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                                <Sparkles className="w-5 h-5 text-emerald-400" />
                            </div>
                            <div>
                                <p className="font-semibold text-white">Inteligência Artificial</p>
                                <p className="text-slate-500 text-sm">Campanhas otimizadas com insights automáticos</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                                <Monitor className="w-5 h-5 text-purple-400" />
                            </div>
                            <div>
                                <p className="font-semibold text-white">Proof of Play</p>
                                <p className="text-slate-500 text-sm">Relatórios completos de exibição para anunciantes</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Painel Direito - Formulário */}
            <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
                <div className="w-full max-w-md">
                    {/* Logo Mobile */}
                    <div className="lg:hidden text-center mb-8">
                        <div className="flex items-center justify-center gap-3 mb-4">
                            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-cyan-400 rounded-xl flex items-center justify-center">
                                <Monitor className="w-6 h-6 text-white" />
                            </div>
                            <h1 className="text-2xl font-black text-white">Conecta Local</h1>
                        </div>
                    </div>

                    {/* Card Principal */}
                    <div className="bg-white/5 backdrop-blur-xl rounded-3xl border border-white/10 shadow-2xl overflow-hidden">
                        <div className="p-8">

                            {/* ====== TELA DE RECUPERAÇÃO DE SENHA ====== */}
                            {showForgotPassword ? (
                                <>
                                    {/* Header */}
                                    <div className="text-center mb-8">
                                        <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                                            <KeyRound className="w-8 h-8 text-blue-400" />
                                        </div>
                                        <h2 className="text-2xl font-bold text-white mb-2">
                                            {resetEmailSent ? 'Email Enviado! 📧' : 'Recuperar Senha'}
                                        </h2>
                                        <p className="text-slate-400">
                                            {resetEmailSent
                                                ? 'Verifique sua caixa de entrada'
                                                : 'Digite seu email para receber o link de recuperação'}
                                        </p>
                                    </div>

                                    {resetEmailSent ? (
                                        <div className="space-y-6">
                                            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-5">
                                                <p className="text-emerald-400 font-semibold mb-2 flex items-center gap-2">
                                                    <MailCheck className="w-5 h-5" />
                                                    Pronto!
                                                </p>
                                                <p className="text-slate-300 text-sm">
                                                    Enviamos um link de recuperação para <strong className="text-white">{resetEmail}</strong>
                                                </p>
                                                <p className="text-slate-400 text-sm mt-2">
                                                    Clique no link do email para criar uma nova senha. Verifique também a pasta de spam.
                                                </p>
                                            </div>

                                            <button
                                                onClick={backToLogin}
                                                className="w-full py-4 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-bold rounded-xl transition-all shadow-lg shadow-blue-500/30 flex items-center justify-center gap-2"
                                            >
                                                <ArrowLeft className="w-4 h-4" />
                                                Voltar ao Login
                                            </button>
                                        </div>
                                    ) : (
                                        <form onSubmit={handleForgotPassword} className="space-y-4">
                                            {/* Error Message */}
                                            {error && (
                                                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
                                                    <p className="text-red-400 text-sm font-medium">{error}</p>
                                                </div>
                                            )}

                                            <div>
                                                <label className="text-xs font-semibold text-slate-400 mb-2 block">
                                                    Seu E-mail
                                                </label>
                                                <div className="relative">
                                                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" />
                                                    <input
                                                        type="email"
                                                        required
                                                        value={resetEmail}
                                                        onChange={(e) => setResetEmail(e.target.value)}
                                                        className="w-full pl-12 pr-4 py-4 bg-slate-800/50 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                                        placeholder="Digite o email da sua conta"
                                                    />
                                                </div>
                                            </div>

                                            <button
                                                type="submit"
                                                disabled={loading}
                                                className="w-full py-4 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-bold rounded-xl shadow-lg shadow-blue-500/30 flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                {loading ? (
                                                    <span className="flex items-center gap-2">
                                                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                                        <span>Enviando...</span>
                                                    </span>
                                                ) : (
                                                    <>
                                                        <span>Enviar Link de Recuperação</span>
                                                        <ArrowRight className="w-5 h-5" />
                                                    </>
                                                )}
                                            </button>

                                            <button
                                                type="button"
                                                onClick={backToLogin}
                                                className="w-full py-3 text-slate-400 hover:text-white font-medium transition-colors flex items-center justify-center gap-2"
                                            >
                                                <ArrowLeft className="w-4 h-4" />
                                                Voltar ao Login
                                            </button>
                                        </form>
                                    )}
                                </>
                            ) : (
                                <>
                                    {/* Header */}
                                    <div className="text-center mb-8">
                                        <h2 className="text-2xl font-bold text-white mb-2">
                                            {registrationSuccess ? '🎉 Quase lá!' : isLogin ? 'Bem-vindo de volta!' : 'Crie sua conta'}
                                        </h2>
                                        <p className="text-slate-400">
                                            {registrationSuccess
                                                ? 'Sua conta foi criada com sucesso'
                                                : isLogin
                                                    ? 'Entre para gerenciar sua rede de mídia'
                                                    : 'Comece a transformar suas telas hoje'}
                                        </p>
                                    </div>

                                    {/* Tela de Sucesso após Registro */}
                                    {registrationSuccess ? (
                                        <div className="space-y-6">
                                            <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto">
                                                <MailCheck className="w-10 h-10 text-emerald-400" />
                                            </div>

                                            <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-5">
                                                <p className="text-amber-400 font-semibold mb-2 flex items-center gap-2">
                                                    <Mail className="w-4 h-4" />
                                                    Confirme seu email
                                                </p>
                                                <p className="text-slate-300 text-sm">
                                                    Enviamos um link de confirmação para <strong className="text-white">{email}</strong>
                                                </p>
                                                <p className="text-slate-400 text-sm mt-2">
                                                    Verifique sua caixa de entrada e spam.
                                                </p>
                                            </div>

                                            <button
                                                onClick={() => {
                                                    setRegistrationSuccess(false);
                                                    setIsLogin(true);
                                                    setEmail('');
                                                    setPassword('');
                                                    setDisplayName('');
                                                    setPhone('');
                                                }}
                                                className="w-full py-4 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-bold rounded-xl transition-all shadow-lg shadow-blue-500/30 flex items-center justify-center gap-2"
                                            >
                                                Ir para Login
                                                <ArrowRight className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ) : (
                                        <>
                                            {/* Tabs */}
                                            <div className="flex bg-slate-800/50 p-1.5 rounded-xl mb-6">
                                                <button
                                                    onClick={() => setIsLogin(true)}
                                                    className={`flex-1 py-3 text-sm font-bold rounded-lg transition-all ${isLogin
                                                            ? 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-lg'
                                                            : 'text-slate-400 hover:text-white'
                                                        }`}
                                                >
                                                    Entrar
                                                </button>
                                                <button
                                                    onClick={() => setIsLogin(false)}
                                                    className={`flex-1 py-3 text-sm font-bold rounded-lg transition-all ${!isLogin
                                                            ? 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-lg'
                                                            : 'text-slate-400 hover:text-white'
                                                        }`}
                                                >
                                                    Criar Conta
                                                </button>
                                            </div>

                                            {/* Error Message */}
                                            {error && (
                                                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-6">
                                                    <p className="text-red-400 text-sm font-medium">{error}</p>
                                                </div>
                                            )}

                                            {/* Form */}
                                            <form onSubmit={handleSubmit} className="space-y-4">
                                                {!isLogin && (
                                                    <>
                                                        <div>
                                                            <label className="text-xs font-semibold text-slate-400 mb-2 block">
                                                                Seu Nome
                                                            </label>
                                                            <div className="relative">
                                                                <User className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" />
                                                                <input
                                                                    type="text"
                                                                    required
                                                                    value={displayName}
                                                                    onChange={(e) => setDisplayName(e.target.value)}
                                                                    className="w-full pl-12 pr-4 py-4 bg-slate-800/50 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                                                    placeholder="Como podemos te chamar?"
                                                                />
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <label className="text-xs font-semibold text-slate-400 mb-2 block">
                                                                WhatsApp
                                                            </label>
                                                            <div className="relative">
                                                                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" />
                                                                <input
                                                                    type="tel"
                                                                    value={phone}
                                                                    onChange={(e) => setPhone(e.target.value)}
                                                                    className="w-full pl-12 pr-4 py-4 bg-slate-800/50 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                                                    placeholder="(11) 99999-9999"
                                                                />
                                                            </div>
                                                        </div>
                                                    </>
                                                )}

                                                <div>
                                                    <label className="text-xs font-semibold text-slate-400 mb-2 block">
                                                        E-mail
                                                    </label>
                                                    <div className="relative">
                                                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" />
                                                        <input
                                                            type="email"
                                                            required
                                                            value={email}
                                                            onChange={(e) => setEmail(e.target.value)}
                                                            className="w-full pl-12 pr-4 py-4 bg-slate-800/50 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                                            placeholder="seu@email.com"
                                                        />
                                                    </div>
                                                </div>

                                                <div>
                                                    <label className="text-xs font-semibold text-slate-400 mb-2 block">
                                                        Senha
                                                    </label>
                                                    <div className="relative">
                                                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" />
                                                        <input
                                                            type="password"
                                                            required
                                                            value={password}
                                                            onChange={(e) => setPassword(e.target.value)}
                                                            className="w-full pl-12 pr-4 py-4 bg-slate-800/50 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                                            placeholder="••••••••"
                                                        />
                                                    </div>
                                                </div>

                                                {isLogin && (
                                                    <div className="text-right">
                                                        <button
                                                            type="button"
                                                            onClick={() => setShowForgotPassword(true)}
                                                            className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
                                                        >
                                                            Esqueceu a senha?
                                                        </button>
                                                    </div>
                                                )}

                                                <button
                                                    type="submit"
                                                    disabled={loading}
                                                    className="w-full py-4 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-bold rounded-xl shadow-lg shadow-blue-500/30 flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    {loading ? (
                                                        <span className="flex items-center gap-2">
                                                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                                            <span>{isLogin ? 'Entrando...' : 'Criando conta...'}</span>
                                                        </span>
                                                    ) : (
                                                        <>
                                                            <span>{isLogin ? 'Entrar no Painel' : 'Criar Minha Conta'}</span>
                                                            <ArrowRight className="w-5 h-5" />
                                                        </>
                                                    )}
                                                </button>
                                            </form>
                                        </>
                                    )}
                                </>
                            )}
                        </div>

                        {/* Footer */}
                        {!registrationSuccess && !showForgotPassword && (
                            <div className="px-8 py-4 bg-slate-800/30 border-t border-white/5">
                                <p className="text-center text-slate-500 text-sm">
                                    {isLogin ? (
                                        <>Ainda não tem conta? <button onClick={() => setIsLogin(false)} className="text-blue-400 hover:text-blue-300 font-medium">Cadastre-se grátis</button></>
                                    ) : (
                                        <>Já tem uma conta? <button onClick={() => setIsLogin(true)} className="text-blue-400 hover:text-blue-300 font-medium">Faça login</button></>
                                    )}
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Copyright */}
                    <p className="text-center text-slate-600 text-xs mt-6">
                        © 2026 Conecta Local. Todos os direitos reservados.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Login;
