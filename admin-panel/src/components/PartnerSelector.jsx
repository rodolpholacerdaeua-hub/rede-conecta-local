import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { Search, User, Check, X, Loader2, ShieldAlert, AlertTriangle } from 'lucide-react';

const PartnerSelector = ({ onSelect, onCancel, currentPartnerId, currentPartnerName }) => {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedUser, setSelectedUser] = useState(null);

    // Etapa: 'select' (escolher parceiro) ou 'confirm' (confirmar com senha)
    const [step, setStep] = useState('select');
    const [adminPassword, setAdminPassword] = useState('');
    const [confirmError, setConfirmError] = useState('');
    const [confirming, setConfirming] = useState(false);

    const isSwap = !!currentPartnerId;

    useEffect(() => {
        const fetchPartners = async () => {
            setLoading(true);
            try {
                // Buscar APENAS parceiros
                const { data, error } = await supabase
                    .from('users')
                    .select('id, email, name, display_name, role')
                    .eq('role', 'parceiro')
                    .order('display_name');

                if (error) throw error;
                setUsers(data || []);

                if (currentPartnerId) {
                    const current = data.find(u => u.id === currentPartnerId);
                    if (current) setSelectedUser(current);
                }
            } catch (error) {
                console.error('Erro ao buscar parceiros:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchPartners();
    }, [currentPartnerId]);

    const filteredUsers = users.filter(user => {
        const name = user.display_name || user.name || '';
        return (
            name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            user.email?.toLowerCase().includes(searchTerm.toLowerCase())
        );
    });

    const handleSelect = (user) => {
        setSelectedUser(user);
    };

    const handleProceedToConfirm = () => {
        if (!selectedUser) return;
        setStep('confirm');
        setAdminPassword('');
        setConfirmError('');
    };

    const handleConfirmWithPassword = async () => {
        if (!adminPassword) {
            setConfirmError('Digite sua senha de administrador.');
            return;
        }

        setConfirming(true);
        setConfirmError('');

        try {
            // Verificar senha do admin logado
            const { data: { user: currentUser } } = await supabase.auth.getUser();
            if (!currentUser?.email) throw new Error('Sessão inválida');

            const { error: signInError } = await supabase.auth.signInWithPassword({
                email: currentUser.email,
                password: adminPassword
            });

            if (signInError) {
                setConfirmError('Senha incorreta. Tente novamente.');
                setConfirming(false);
                return;
            }

            // Senha correta — executar a vinculação
            onSelect(selectedUser);
        } catch (e) {
            console.error('Erro na confirmação:', e);
            setConfirmError('Erro ao verificar senha: ' + e.message);
        } finally {
            setConfirming(false);
        }
    };

    const displayName = (user) => user.display_name || user.name || 'Sem Nome';

    // ═══ ETAPA 1: SELECIONAR PARCEIRO ═══
    if (step === 'select') {
        return (
            <div className="bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden w-full max-w-md animate-in fade-in zoom-in duration-200">
                <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                    <h3 className="font-bold text-slate-700">
                        {isSwap ? '🔄 Trocar Parceiro' : '🤝 Vincular Parceiro'}
                    </h3>
                    <button onClick={onCancel} className="text-slate-400 hover:text-slate-600">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {isSwap && (
                    <div className="mx-4 mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                        <p className="text-xs text-amber-700">
                            <strong>Atenção:</strong> Este terminal já possui o parceiro <strong>{currentPartnerName || 'vinculado'}</strong>.
                            Ao continuar, o vínculo será substituído.
                        </p>
                    </div>
                )}

                <div className="p-4">
                    <div className="relative mb-4">
                        <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Buscar parceiro por nome ou email..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            autoFocus
                        />
                    </div>

                    {users.length === 0 && !loading && (
                        <div className="text-center py-6 text-slate-400 text-sm">
                            <p className="font-bold">Nenhum parceiro cadastrado.</p>
                            <p className="text-xs mt-1">Cadastre um parceiro em Gestão de Usuários primeiro.</p>
                        </div>
                    )}

                    <div className="max-h-60 overflow-y-auto space-y-2 custom-scrollbar">
                        {loading ? (
                            <div className="flex justify-center py-8">
                                <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
                            </div>
                        ) : filteredUsers.length === 0 && users.length > 0 ? (
                            <div className="text-center py-8 text-slate-400 text-sm">
                                Nenhum parceiro encontrado com "{searchTerm}".
                            </div>
                        ) : (
                            filteredUsers.map(user => (
                                <button
                                    key={user.id}
                                    onClick={() => handleSelect(user)}
                                    className={`w-full flex items-center p-3 rounded-lg border transition-all ${selectedUser?.id === user.id
                                        ? 'bg-indigo-50 border-indigo-500 ring-1 ring-indigo-500'
                                        : user.id === currentPartnerId
                                            ? 'bg-amber-50 border-amber-200 hover:border-amber-400'
                                            : 'bg-white border-slate-100 hover:border-indigo-300 hover:bg-slate-50'
                                        }`}
                                >
                                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold mr-3 bg-emerald-100 text-emerald-600">
                                        {displayName(user).charAt(0).toUpperCase()}
                                    </div>
                                    <div className="text-left flex-1 min-w-0">
                                        <p className="font-bold text-slate-700 truncate text-sm">
                                            {displayName(user)}
                                            {user.id === currentPartnerId && (
                                                <span className="ml-2 text-[9px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-bold">ATUAL</span>
                                            )}
                                        </p>
                                        <p className="text-xs text-slate-400 truncate">{user.email}</p>
                                    </div>
                                    {selectedUser?.id === user.id && (
                                        <Check className="w-5 h-5 text-indigo-600 ml-2" />
                                    )}
                                </button>
                            ))
                        )}
                    </div>
                </div>

                <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                    <button
                        onClick={onCancel}
                        className="px-4 py-2 text-sm font-bold text-slate-500 hover:text-slate-700"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleProceedToConfirm}
                        disabled={!selectedUser || selectedUser.id === currentPartnerId}
                        className="px-6 py-2 bg-indigo-600 text-white text-sm font-bold rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                    >
                        {isSwap ? 'Trocar Parceiro' : 'Vincular Parceiro'}
                    </button>
                </div>
            </div>
        );
    }

    // ═══ ETAPA 2: CONFIRMAR COM SENHA ═══
    return (
        <div className="bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden w-full max-w-md animate-in fade-in zoom-in duration-200">
            <div className="p-4 border-b border-slate-100 bg-amber-50 flex justify-between items-center">
                <h3 className="font-bold text-amber-800 flex items-center gap-2">
                    <ShieldAlert className="w-5 h-5" />
                    Confirmação de Segurança
                </h3>
                <button onClick={() => setStep('select')} className="text-slate-400 hover:text-slate-600">
                    <X className="w-5 h-5" />
                </button>
            </div>

            <div className="p-6 space-y-4">
                <div className={`p-4 rounded-lg border ${isSwap ? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-200'}`}>
                    <p className={`text-sm font-bold ${isSwap ? 'text-amber-800' : 'text-green-800'}`}>
                        {isSwap
                            ? `⚠️ Você deseja TROCAR o parceiro atual "${currentPartnerName || 'vinculado'}" por:`
                            : '✅ Você deseja INCLUIR o parceiro:'}
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-bold">
                            {displayName(selectedUser).charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <p className="font-bold text-slate-800 text-sm">{displayName(selectedUser)}</p>
                            <p className="text-xs text-slate-500">{selectedUser?.email}</p>
                        </div>
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase flex items-center gap-1">
                        <ShieldAlert className="w-3 h-3" />
                        Senha do Administrador
                    </label>
                    <input
                        type="password"
                        value={adminPassword}
                        onChange={(e) => { setAdminPassword(e.target.value); setConfirmError(''); }}
                        placeholder="Digite sua senha para confirmar"
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm font-bold focus:ring-2 focus:ring-amber-500 outline-none"
                        autoFocus
                        onKeyDown={(e) => e.key === 'Enter' && handleConfirmWithPassword()}
                    />
                    {confirmError && (
                        <p className="text-xs text-red-600 font-bold flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" /> {confirmError}
                        </p>
                    )}
                </div>
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-between">
                <button
                    onClick={() => setStep('select')}
                    className="px-4 py-2 text-sm font-bold text-slate-500 hover:text-slate-700"
                    disabled={confirming}
                >
                    ← Voltar
                </button>
                <button
                    onClick={handleConfirmWithPassword}
                    disabled={confirming || !adminPassword}
                    className={`px-6 py-2 text-white text-sm font-bold rounded-lg shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed ${isSwap
                        ? 'bg-amber-600 hover:bg-amber-700'
                        : 'bg-green-600 hover:bg-green-700'
                        }`}
                >
                    {confirming ? (
                        <span className="flex items-center gap-2">
                            <Loader2 className="w-4 h-4 animate-spin" /> Verificando...
                        </span>
                    ) : isSwap ? 'Confirmar Troca' : 'Confirmar Vínculo'}
                </button>
            </div>
        </div>
    );
};

export default PartnerSelector;
