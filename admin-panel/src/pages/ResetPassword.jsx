import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, KeyRound, CheckCircle, ArrowRight, Eye, EyeOff, Monitor, AlertCircle } from 'lucide-react';
import { supabase, updatePassword } from '../supabase';

const ResetPassword = () => {
    const navigate = useNavigate();
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const [isValidSession, setIsValidSession] = useState(null);

    // Verificar se há uma sessão de recuperação válida
    useEffect(() => {
        const checkSession = async () => {
            const { data: { session } } = await supabase.auth.getSession();

            // Verificar se o usuário veio de um link de recuperação
            if (session) {
                setIsValidSession(true);
            } else {
                setIsValidSession(false);
            }
        };

        // Listener para evento PASSWORD_RECOVERY
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'PASSWORD_RECOVERY') {
                setIsValidSession(true);
            }
        });

        checkSession();

        return () => {
            subscription?.unsubscribe();
        };
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        // Validações
        if (password.length < 6) {
            setError('A senha deve ter pelo menos 6 caracteres.');
            return;
        }

        if (password !== confirmPassword) {
            setError('As senhas não coincidem.');
            return;
        }

        setLoading(true);

        try {
            const { error } = await updatePassword(password);
            if (error) throw error;
            setSuccess(true);
        } catch (err) {
            console.error(err);
            setError('Não foi possível atualizar a senha. Tente solicitar um novo link.');
        } finally {
            setLoading(false);
        }
    };

    // Loading state
    if (isValidSession === null) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    // Sessão inválida
    if (isValidSession === false) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 flex items-center justify-center p-8">
                <div className="w-full max-w-md">
                    <div className="bg-white/5 backdrop-blur-xl rounded-3xl border border-white/10 shadow-2xl p-8">
                        <div className="text-center mb-6">
                            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                                <AlertCircle className="w-8 h-8 text-red-400" />
                            </div>
                            <h2 className="text-2xl font-bold text-white mb-2">Link Inválido</h2>
                            <p className="text-slate-400">
                                Este link de recuperação expirou ou é inválido. Solicite um novo link de recuperação.
                            </p>
                        </div>
                        <button
                            onClick={() => navigate('/')}
                            className="w-full py-4 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-bold rounded-xl transition-all shadow-lg shadow-blue-500/30 flex items-center justify-center gap-2"
                        >
                            Ir para Login
                            <ArrowRight className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 flex items-center justify-center p-8">
            <div className="w-full max-w-md">
                {/* Logo */}
                <div className="text-center mb-8">
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
                        {/* Header */}
                        <div className="text-center mb-8">
                            <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                                {success ? (
                                    <CheckCircle className="w-8 h-8 text-emerald-400" />
                                ) : (
                                    <KeyRound className="w-8 h-8 text-blue-400" />
                                )}
                            </div>
                            <h2 className="text-2xl font-bold text-white mb-2">
                                {success ? 'Senha Atualizada! 🎉' : 'Nova Senha'}
                            </h2>
                            <p className="text-slate-400">
                                {success
                                    ? 'Sua senha foi alterada com sucesso'
                                    : 'Digite sua nova senha abaixo'}
                            </p>
                        </div>

                        {success ? (
                            <div className="space-y-6">
                                <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-5">
                                    <p className="text-emerald-400 font-semibold mb-2 flex items-center gap-2">
                                        <CheckCircle className="w-5 h-5" />
                                        Tudo certo!
                                    </p>
                                    <p className="text-slate-300 text-sm">
                                        Agora você pode fazer login com sua nova senha.
                                    </p>
                                </div>

                                <button
                                    onClick={() => navigate('/')}
                                    className="w-full py-4 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-bold rounded-xl transition-all shadow-lg shadow-blue-500/30 flex items-center justify-center gap-2"
                                >
                                    Ir para Login
                                    <ArrowRight className="w-5 h-5" />
                                </button>
                            </div>
                        ) : (
                            <form onSubmit={handleSubmit} className="space-y-4">
                                {/* Error Message */}
                                {error && (
                                    <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
                                        <p className="text-red-400 text-sm font-medium">{error}</p>
                                    </div>
                                )}

                                <div>
                                    <label className="text-xs font-semibold text-slate-400 mb-2 block">
                                        Nova Senha
                                    </label>
                                    <div className="relative">
                                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" />
                                        <input
                                            type={showPassword ? 'text' : 'password'}
                                            required
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            className="w-full pl-12 pr-12 py-4 bg-slate-800/50 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                            placeholder="Mínimo 6 caracteres"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                                        >
                                            {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                        </button>
                                    </div>
                                </div>

                                <div>
                                    <label className="text-xs font-semibold text-slate-400 mb-2 block">
                                        Confirmar Nova Senha
                                    </label>
                                    <div className="relative">
                                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" />
                                        <input
                                            type={showPassword ? 'text' : 'password'}
                                            required
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                            className="w-full pl-12 pr-4 py-4 bg-slate-800/50 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                            placeholder="Repita a senha"
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
                                            <span>Salvando...</span>
                                        </span>
                                    ) : (
                                        <>
                                            <span>Salvar Nova Senha</span>
                                            <ArrowRight className="w-5 h-5" />
                                        </>
                                    )}
                                </button>
                            </form>
                        )}
                    </div>
                </div>

                {/* Copyright */}
                <p className="text-center text-slate-600 text-xs mt-6">
                    © 2026 Conecta Local. Todos os direitos reservados.
                </p>
            </div>
        </div>
    );
};

export default ResetPassword;
