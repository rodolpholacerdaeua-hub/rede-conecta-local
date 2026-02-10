import React, { useState, useRef, useEffect } from 'react';
import { supabase } from '../supabase';
import { ShieldAlert, X, Loader2 } from 'lucide-react';

/**
 * Modal de confirmação com senha para ações destrutivas.
 * Reautentica o usuário antes de permitir a ação.
 */
const PasswordConfirmModal = ({ isOpen, onClose, onConfirm, title, message }) => {
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const inputRef = useRef(null);

    useEffect(() => {
        if (isOpen) {
            setPassword('');
            setError('');
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!password.trim()) {
            setError('Digite sua senha.');
            return;
        }

        setLoading(true);
        setError('');

        try {
            // Pegar email do usuário logado
            const { data: { user } } = await supabase.auth.getUser();
            if (!user?.email) throw new Error('Sessão expirada.');

            // Re-autenticar com a senha fornecida
            const { error: authError } = await supabase.auth.signInWithPassword({
                email: user.email,
                password: password
            });

            if (authError) {
                setError('Senha incorreta.');
                setLoading(false);
                return;
            }

            // Senha correta — executar a ação
            await onConfirm();
        } catch (err) {
            console.error('[PasswordConfirmModal] Error:', err.message);
        } finally {
            setLoading(false);
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="bg-red-50 border-b border-red-100 p-5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="bg-red-100 p-2.5 rounded-xl">
                            <ShieldAlert className="w-5 h-5 text-red-600" />
                        </div>
                        <h3 className="text-lg font-black text-red-900">{title || 'Confirmação de Segurança'}</h3>
                    </div>
                    <button onClick={onClose} className="text-red-300 hover:text-red-500 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <form onSubmit={handleSubmit} className="p-6 space-y-5">
                    <p className="text-sm text-slate-600 leading-relaxed">{message}</p>

                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            Confirme sua senha
                        </label>
                        <input
                            ref={inputRef}
                            type="password"
                            value={password}
                            onChange={(e) => { setPassword(e.target.value); setError(''); }}
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm outline-none focus:ring-2 focus:ring-red-400 focus:border-red-400 transition-all"
                            placeholder="••••••••"
                            autoComplete="current-password"
                        />
                    </div>

                    {error && (
                        <div className="bg-red-50 border border-red-200 text-red-700 text-xs font-bold p-3 rounded-lg animate-in fade-in slide-in-from-top-1">
                            {error}
                        </div>
                    )}

                    <div className="flex gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-sm rounded-xl transition-all"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={loading || !password.trim()}
                            className="flex-1 py-3 bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white font-black text-sm rounded-xl transition-all flex items-center justify-center gap-2 uppercase tracking-wider"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Verificando...
                                </>
                            ) : (
                                'Excluir Definitivamente'
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default PasswordConfirmModal;
