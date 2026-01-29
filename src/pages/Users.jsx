import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, query, orderBy, doc, updateDoc, increment } from 'firebase/firestore';
import { Users as UsersIcon, Shield, User, Coins, Edit2, Check, Plus } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const Users = () => {
    const { userData } = useAuth();
    const [users, setUsers] = useState([]);
    const [editingUser, setEditingUser] = useState(null);
    const [editName, setEditName] = useState('');
    const [editTokens, setEditTokens] = useState(0);

    useEffect(() => {
        if (!userData || userData.role !== 'admin') return;

        const q = query(collection(db, "users"), orderBy("createdAt", "desc"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        }, (error) => {
            console.error("Users: Erro ao carregar usuários:", error);
        });
        return () => unsubscribe();
    }, [userData]);

    const toggleRole = async (uid, currentRole) => {
        const newRole = currentRole === 'admin' ? 'cliente' : 'admin';
        try {
            await updateDoc(doc(db, "users", uid), { role: newRole });
        } catch (e) {
            console.error(e);
        }
    };

    const handleEditClick = (user) => {
        setEditingUser(user);
        setEditName(user.displayName || '');
        setEditTokens(user.tokens || 0);
    };

    const handleUpdateUser = async () => {
        try {
            await updateDoc(doc(db, "users", editingUser.id), {
                displayName: editName,
                tokens: Number(editTokens)
            });
            setEditingUser(null);
            alert("Usuário atualizado com sucesso!");
        } catch (e) {
            console.error(e);
            alert("Erro ao atualizar usuário");
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
            </div>

            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                <table className="w-full text-left">
                    <thead>
                        <tr className="bg-slate-50 text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-100">
                            <th className="px-6 py-4">Usuário</th>
                            <th className="px-6 py-4">Papel (Role)</th>
                            <th className="px-6 py-4">Saldo de Tokens</th>
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
                                        <button onClick={() => updateDoc(doc(db, "users", u.id), { tokens: increment(50) })} className="p-1 hover:bg-amber-50 rounded text-amber-400 transition-colors">
                                            <Plus className="w-3 h-3" />
                                        </button>
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <button
                                        onClick={() => handleEditClick(u)}
                                        className="text-slate-300 hover:text-blue-600 transition-colors p-2 hover:bg-blue-50 rounded-lg"
                                    >
                                        <Edit2 className="w-4 h-4" />
                                    </button>
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
                                <label className="text-[10px] font-black text-slate-400 uppercase">Ajustar Tokens (Puro)</label>
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
        </div>
    );
};

export default Users;
