import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { updateDocument } from '../db';
import { Users as UsersIcon, Shield, User, Coins, Edit2, Check, Plus, Phone, Trash2, X, AlertTriangle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const Users = () => {
    const { userData } = useAuth();
    const [users, setUsers] = useState([]);
    const [editingUser, setEditingUser] = useState(null);
    const [editName, setEditName] = useState('');
    const [editTokens, setEditTokens] = useState(0);

    // Estados para adicionar cliente
    const [showAddModal, setShowAddModal] = useState(false);
    const [newEmail, setNewEmail] = useState('');
    const [newName, setNewName] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [adding, setAdding] = useState(false);

    // Estado para modal de exclusão
    const [deleteModalUser, setDeleteModalUser] = useState(null);
    const [deleting, setDeleting] = useState(false);

    useEffect(() => {
        if (!userData || userData.role !== 'admin') return;
        let isMounted = true;

        const loadUsers = async () => {
            try {
                const { data, error } = await supabase
                    .from('users')
                    .select('*')
                    .order('created_at', { ascending: false });

                if (error) throw error;
                if (isMounted) setUsers(data || []);
            } catch (error) {
                console.error("Users: Erro ao carregar usuários:", error);
            }
        };

        loadUsers();
        return () => { isMounted = false; };
    }, [userData]);

    const toggleRole = async (uid, currentRole) => {
        const newRole = currentRole === 'admin' ? 'cliente' : 'admin';
        try {
            await updateDocument('users', uid, { role: newRole });
            setUsers(prev => prev.map(u => u.id === uid ? { ...u, role: newRole } : u));
        } catch (e) {
            console.error(e);
        }
    };

    const handleEditClick = (user) => {
        setEditingUser(user);
        setEditName(user.display_name || user.displayName || '');
        setEditTokens(user.tokens || 0);
    };

    const handleUpdateUser = async () => {
        try {
            await updateDocument('users', editingUser.id, {
                display_name: editName,
                tokens: Number(editTokens)
            });
            setUsers(prev => prev.map(u => u.id === editingUser.id ? { ...u, display_name: editName, tokens: Number(editTokens) } : u));
            setEditingUser(null);
            alert("Usuário atualizado com sucesso!");
        } catch (e) {
            console.error(e);
            alert("Erro ao atualizar usuário");
        }
    };

    const handleAddTokens = async (uid, currentTokens) => {
        try {
            await updateDocument('users', uid, { tokens: (currentTokens || 0) + 50 });
            setUsers(prev => prev.map(u => u.id === uid ? { ...u, tokens: (u.tokens || 0) + 50 } : u));
        } catch (e) {
            console.error(e);
        }
    };

    // Excluir usuário - abre modal de confirmação
    const handleDeleteUser = (user) => {
        console.log('🗑️ [DELETE] Abrindo modal para:', user.email);

        // Não permitir excluir a si mesmo
        if (user.id === userData?.id) {
            console.log('🗑️ [DELETE] Bloqueado: tentativa de excluir a si mesmo');
            alert('Você não pode excluir sua própria conta!');
            return;
        }

        setDeleteModalUser(user);
    };

    // Confirmar exclusão do usuário
    const confirmDeleteUser = async () => {
        if (!deleteModalUser) return;

        console.log('🗑️ [DELETE] Confirmado! Executando delete para:', deleteModalUser.email);
        setDeleting(true);

        try {
            const { data, error } = await supabase
                .from('users')
                .delete()
                .eq('id', deleteModalUser.id)
                .select();

            console.log('🗑️ [DELETE] Resultado:', { data, error });

            if (error) throw error;

            setUsers(prev => prev.filter(u => u.id !== deleteModalUser.id));
            setDeleteModalUser(null);
            alert('Usuário excluído com sucesso!');
        } catch (e) {
            console.error('🗑️ [DELETE] Erro:', e);
            alert('Erro ao excluir usuário: ' + e.message);
        } finally {
            setDeleting(false);
        }
    };

    // Criar cliente via Edge Function (não afeta sessão do admin)
    const handleAddClient = async () => {
        if (!newEmail || !newName) {
            alert('Email e nome são obrigatórios');
            return;
        }

        setAdding(true);
        try {
            // Obter token do admin logado
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.access_token) {
                throw new Error('Sessão expirada. Faça login novamente.');
            }

            // Chamar Edge Function (cria usuário sem trocar sessão)
            const response = await fetch(
                `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-user`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${session.access_token}`,
                        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY
                    },
                    body: JSON.stringify({
                        email: newEmail,
                        name: newName,
                        password: newPassword || undefined
                    })
                }
            );

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Erro ao criar usuário');
            }

            // Recarregar lista de usuários
            const { data } = await supabase
                .from('users')
                .select('*')
                .order('created_at', { ascending: false });
            setUsers(data || []);

            alert(`Cliente criado com sucesso!\n\nEmail: ${newEmail}\nSenha: ${result.password}\n\nGuarde essas informações!`);
            setShowAddModal(false);
            setNewEmail('');
            setNewName('');
            setNewPassword('');
        } catch (e) {
            console.error('Erro ao criar cliente:', e);
            alert('Erro ao criar cliente: ' + e.message);
        } finally {
            setAdding(false);
        }
    };

    if (userData?.role !== 'admin') {
        return <div className="p-10 text-center text-slate-500 font-bold">Acesso restrito ao Administrador Master.</div>;
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-black text-slate-800 uppercase italic">Gestão de Usuários & Roles</h2>
                    <p className="text-slate-500 font-medium">Controle quem é Admin e quanto saldo cada cliente possui.</p>
                </div>
                <button
                    onClick={() => setShowAddModal(true)}
                    className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 shadow-md transition-all active:scale-95"
                >
                    <Plus className="w-4 h-4" />
                    Adicionar Cliente
                </button>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                <table className="w-full text-left">
                    <thead>
                        <tr className="bg-slate-50 text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-100">
                            <th className="px-6 py-4">Usuário</th>
                            <th className="px-6 py-4">Telefone</th>
                            <th className="px-6 py-4">Papel (Role)</th>
                            <th className="px-6 py-4">Saldo de Créditos</th>
                            <th className="px-6 py-4 text-right">Ações de Admin</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-bold text-sm">
                        {users.map(u => (
                            <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-slate-500">
                                            <User className="w-4 h-4" />
                                        </div>
                                        <div>
                                            <div className="text-slate-800">{u.displayName}</div>
                                            <div className="text-[10px] text-slate-400 lowercase font-medium">{u.email}</div>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    {u.phone ? (
                                        <a
                                            href={`https://wa.me/55${u.phone.replace(/\D/g, '')}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1.5 text-green-600 hover:text-green-700 transition-colors"
                                        >
                                            <Phone className="w-3.5 h-3.5" />
                                            <span className="text-xs font-bold">{u.phone}</span>
                                        </a>
                                    ) : (
                                        <span className="text-slate-300 text-xs italic">Não informado</span>
                                    )}
                                </td>
                                <td className="px-6 py-4">
                                    <button
                                        onClick={() => toggleRole(u.id, u.role)}
                                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter transition-all ${u.role === 'admin' ? 'bg-blue-100 text-blue-700 hover:bg-blue-200' : 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'}`}
                                    >
                                        <Shield className="w-3 h-3 mr-1" />
                                        {u.role === 'admin' ? 'ADMIN MASTER' : 'CLIENTE PORTAL'}
                                    </button>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-2">
                                        <span className="text-amber-600">{u.tokens || 0}🪙</span>
                                        <button onClick={() => handleAddTokens(u.id, u.tokens)} className="p-1 hover:bg-amber-50 rounded text-amber-400 transition-colors">
                                            <Plus className="w-3 h-3" />
                                        </button>
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <div className="flex items-center justify-end gap-1">
                                        <button
                                            onClick={() => handleEditClick(u)}
                                            className="text-slate-300 hover:text-blue-600 transition-colors p-2 hover:bg-blue-50 rounded-lg"
                                            title="Editar"
                                        >
                                            <Edit2 className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => handleDeleteUser(u)}
                                            className="text-slate-300 hover:text-red-600 transition-colors p-2 hover:bg-red-50 rounded-lg"
                                            title="Excluir"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Modal de Edição */}
            {editingUser && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in duration-200">
                        <div className="p-6 bg-slate-900 text-white flex justify-between items-center">
                            <h3 className="font-black uppercase italic tracking-wider flex items-center gap-2">
                                <Edit2 className="w-4 h-4 text-blue-400" />
                                Editar Perfil
                            </h3>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase">Nome de Exibição</label>
                                <input
                                    type="text"
                                    value={editName}
                                    onChange={(e) => setEditName(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase">Ajustar Créditos</label>
                                <div className="relative">
                                    <Coins className="absolute left-3 top-3 w-4 h-4 text-amber-500" />
                                    <input
                                        type="number"
                                        value={editTokens}
                                        onChange={(e) => setEditTokens(e.target.value)}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 pl-10 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3">
                            <button
                                onClick={() => setEditingUser(null)}
                                className="px-4 py-2 text-sm font-bold text-slate-500 hover:text-slate-700 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleUpdateUser}
                                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-black text-sm shadow-md transition-all active:scale-95"
                            >
                                Salvar Alterações
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Adicionar Cliente */}
            {showAddModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in duration-200">
                        <div className="p-6 bg-green-600 text-white flex justify-between items-center">
                            <h3 className="font-black uppercase italic tracking-wider flex items-center gap-2">
                                <Plus className="w-4 h-4" />
                                Adicionar Cliente
                            </h3>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase">Email *</label>
                                <input
                                    type="email"
                                    value={newEmail}
                                    onChange={(e) => setNewEmail(e.target.value)}
                                    placeholder="cliente@email.com"
                                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm font-bold focus:ring-2 focus:ring-green-500 outline-none"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase">Nome *</label>
                                <input
                                    type="text"
                                    value={newName}
                                    onChange={(e) => setNewName(e.target.value)}
                                    placeholder="Nome do cliente"
                                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm font-bold focus:ring-2 focus:ring-green-500 outline-none"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase">Senha (opcional)</label>
                                <input
                                    type="text"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    placeholder="Deixe vazio para gerar automaticamente"
                                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm font-bold focus:ring-2 focus:ring-green-500 outline-none"
                                />
                                <p className="text-[10px] text-slate-400">Se não informada, uma senha aleatória será gerada.</p>
                            </div>
                        </div>
                        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3">
                            <button
                                onClick={() => { setShowAddModal(false); setNewEmail(''); setNewName(''); setNewPassword(''); }}
                                className="px-4 py-2 text-sm font-bold text-slate-500 hover:text-slate-700 transition-colors"
                                disabled={adding}
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleAddClient}
                                disabled={adding}
                                className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-black text-sm shadow-md transition-all active:scale-95 disabled:opacity-50"
                            >
                                {adding ? 'Criando...' : 'Criar Cliente'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Confirmação de Exclusão */}
            {deleteModalUser && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in duration-200">
                        <div className="p-6 bg-red-600 text-white flex justify-between items-center">
                            <h3 className="font-black uppercase italic tracking-wider flex items-center gap-2">
                                <AlertTriangle className="w-5 h-5" />
                                Confirmar Exclusão
                            </h3>
                            <button
                                onClick={() => setDeleteModalUser(null)}
                                className="hover:bg-white/20 p-1 rounded"
                                disabled={deleting}
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
                                <p className="text-sm text-red-800 font-bold mb-2">Você está prestes a excluir:</p>
                                <p className="text-lg font-black text-red-900">{deleteModalUser.email}</p>
                            </div>
                            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
                                <p className="font-bold mb-1">⚠️ Esta ação irá:</p>
                                <ul className="list-disc list-inside space-y-0.5">
                                    <li>Remover o usuário do sistema</li>
                                    <li>Excluir campanhas, mídias e dados associados</li>
                                </ul>
                                <p className="font-black mt-2 text-red-600">Esta ação NÃO pode ser desfeita!</p>
                            </div>
                        </div>
                        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3">
                            <button
                                onClick={() => setDeleteModalUser(null)}
                                className="px-4 py-2 text-sm font-bold text-slate-500 hover:text-slate-700 transition-colors"
                                disabled={deleting}
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={confirmDeleteUser}
                                disabled={deleting}
                                className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg font-black text-sm shadow-md transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2"
                            >
                                <Trash2 className="w-4 h-4" />
                                {deleting ? 'Excluindo...' : 'Excluir Usuário'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Users;
