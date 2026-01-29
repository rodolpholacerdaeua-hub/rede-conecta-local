import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, addDoc, updateDoc, deleteDoc, doc, query, orderBy, onSnapshot, writeBatch, where, getDocs } from 'firebase/firestore';
import { X, Plus, Edit2, Trash2, Save, LayoutGrid, AlertTriangle } from 'lucide-react';

const GroupManagerModal = ({ isOpen, onClose, currentTerminalGroups = [] }) => {
    const [groups, setGroups] = useState([]);
    const [newGroupName, setNewGroupName] = useState('');
    const [editingId, setEditingId] = useState(null);
    const [editName, setEditName] = useState('');
    const [loading, setLoading] = useState(false);

    // 1. Carregar Grupos do Firestore
    useEffect(() => {
        if (!isOpen) return;

        const q = query(collection(db, "terminal_groups"), orderBy("name"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const loadedGroups = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setGroups(loadedGroups);
        }, (err) => console.error("Erro ao carregar grupos:", err));

        return () => unsubscribe();
    }, [isOpen]);

    // Identificar Grupos Órfãos (Existem nos terminais mas não na coleção)
    const orphanGroups = currentTerminalGroups
        .filter(g => g !== 'Default' && !groups.some(dbG => dbG.name === g));

    // 2. Adicionar Grupo (ou Adotar Órfão)
    const handleAddGroup = async (e, nameOverride = null) => {
        if (e) e.preventDefault();
        const nameToUse = nameOverride || newGroupName;
        if (!nameToUse.trim()) return;
        setLoading(true);

        try {
            // Verifica se já existe
            if (groups.some(g => g.name.toLowerCase() === nameToUse.trim().toLowerCase())) {
                alert("Já existe um grupo gerenciado com este nome.");
                return;
            }

            await addDoc(collection(db, "terminal_groups"), {
                name: nameToUse.trim(),
                createdAt: new Date()
            });
            if (!nameOverride) setNewGroupName('');
        } catch (error) {
            console.error("Erro ao criar grupo:", error);
            alert("Erro ao criar grupo: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    // 3. Renomear Grupo (Batch Update em Terminais)
    const handleUpdateGroup = async (groupId, oldName) => {
        if (!editName.trim() || editName === oldName) {
            setEditingId(null);
            return;
        }
        setLoading(true);

        try {
            const batch = writeBatch(db);

            // Atualiza o doc do grupo
            const groupRef = doc(db, "terminal_groups", groupId);
            batch.update(groupRef, { name: editName.trim() });

            // Busca terminais com o nome antigo
            const terminalsRef = collection(db, "terminals");
            const q = query(terminalsRef, where("group", "==", oldName));
            const snapshot = await getDocs(q);

            snapshot.docs.forEach(termDoc => {
                batch.update(termDoc.ref, { group: editName.trim() });
            });

            await batch.commit();
            setEditingId(null);
        } catch (error) {
            console.error("Erro ao renomear grupo:", error);
            alert("Erro ao atualizar grupo e terminais vinculados.");
        } finally {
            setLoading(false);
        }
    };

    // 4. Excluir Grupo (Move terminais para 'Default')
    const handleDeleteGroup = async (groupId, groupName, isOrphan = false) => {
        const msg = isOrphan
            ? `Deseja dissolver o grupo legado "${groupName}"? Os terminais afetados serão movidos para 'Default'.`
            : `Tem certeza que deseja excluir o grupo "${groupName}"? Os terminais serão movidos para 'Default'.`;

        if (!window.confirm(msg)) return;
        setLoading(true);

        try {
            const batch = writeBatch(db);

            // Se não for órfão, remove o doc do banco
            if (!isOrphan && groupId) {
                const groupRef = doc(db, "terminal_groups", groupId);
                batch.delete(groupRef);
            }

            // Move terminais vinculados para 'Default'
            const terminalsRef = collection(db, "terminals");
            const q = query(terminalsRef, where("group", "==", groupName));
            const snapshot = await getDocs(q);

            snapshot.docs.forEach(termDoc => {
                batch.update(termDoc.ref, { group: 'Default' });
            });

            await batch.commit();
        } catch (error) {
            console.error("Erro ao excluir grupo:", error);
            alert("Erro ao excluir grupo.");
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[80vh]">

                {/* Header */}
                <div className="bg-slate-900 p-4 flex justify-between items-center">
                    <h3 className="text-white font-bold flex items-center gap-2">
                        <LayoutGrid className="w-5 h-5 text-blue-400" />
                        Gerenciar Grupos
                    </h3>
                    <button onClick={onClose} className="text-white/60 hover:text-white transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-4 flex-1 overflow-y-auto custom-scrollbar">

                    {/* Criar Novo */}
                    <form onSubmit={(e) => handleAddGroup(e)} className="flex gap-2 mb-6">
                        <input
                            type="text"
                            value={newGroupName}
                            onChange={(e) => setNewGroupName(e.target.value)}
                            placeholder="Criar novo grupo..."
                            className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                            disabled={loading}
                        />
                        <button
                            type="submit"
                            disabled={loading || !newGroupName.trim()}
                            className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white p-2 rounded-lg transition-colors shadow-sm"
                        >
                            <Plus className="w-5 h-5" />
                        </button>
                    </form>

                    <div className="space-y-4">
                        {/* Grupos Órfãos (Legado) */}
                        {orphanGroups.length > 0 && (
                            <div className="space-y-2">
                                <h4 className="text-xs font-black text-amber-500 uppercase tracking-widest flex items-center gap-1 mb-2">
                                    <AlertTriangle className="w-3 h-3" /> Grupos Legados detectados
                                </h4>
                                {orphanGroups.map(orphan => (
                                    <div key={`orphan-${orphan}`} className="flex items-center justify-between p-3 bg-amber-50 border border-amber-200 rounded-lg">
                                        <span className="text-amber-900 font-bold text-sm">{orphan}</span>
                                        <div className="flex items-center gap-1">
                                            <button
                                                onClick={() => handleAddGroup(null, orphan)}
                                                className="px-2 py-1 text-[10px] bg-white border border-amber-300 text-amber-700 font-bold rounded hover:bg-amber-100 uppercase"
                                                title="Adicionar aos grupos gerenciados"
                                            >
                                                Oficializar
                                            </button>
                                            <button
                                                onClick={() => handleDeleteGroup(null, orphan, true)}
                                                className="p-1.5 text-amber-600 hover:text-red-600 hover:bg-red-50 rounded-md"
                                                title="Dissolver (Mover terminais para Default)"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                                <div className="h-px bg-slate-100 my-2" />
                            </div>
                        )}

                        {/* Lista de Grupos Gerenciados */}
                        <div className="space-y-2">
                            {groups.length === 0 && orphanGroups.length === 0 && (
                                <div className="text-center py-8 text-slate-400 text-sm italic">
                                    Nenhum grupo criado.
                                </div>
                            )}

                            {groups.map(group => (
                                <div key={group.id} className="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-lg hover:border-blue-100 hover:shadow-sm group transition-all">

                                    {editingId === group.id ? (
                                        <div className="flex items-center gap-2 flex-1 mr-2 animate-in fade-in">
                                            <input
                                                type="text"
                                                value={editName}
                                                onChange={(e) => setEditName(e.target.value)}
                                                className="flex-1 bg-white border border-blue-400 rounded px-2 py-1 text-sm outline-none"
                                                autoFocus
                                            />
                                            <button
                                                onClick={() => handleUpdateGroup(group.id, group.name)}
                                                className="text-emerald-600 hover:bg-emerald-50 p-1 rounded"
                                            >
                                                <Save className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => setEditingId(null)}
                                                className="text-slate-400 hover:bg-slate-100 p-1 rounded"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ) : (
                                        <>
                                            <span className="text-slate-700 font-medium text-sm flex items-center gap-2">
                                                {group.name}
                                                {group.name === 'Default' && <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 rounded font-black uppercase">Padrão</span>}
                                            </span>
                                            {group.name !== 'Default' && (
                                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button
                                                        onClick={() => {
                                                            setEditingId(group.id);
                                                            setEditName(group.name);
                                                        }}
                                                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md"
                                                        title="Renomear"
                                                    >
                                                        <Edit2 className="w-3.5 h-3.5" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteGroup(group.id, group.name)}
                                                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md"
                                                        title="Excluir"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Footer Fixo */}
                <div className="bg-slate-50 p-3 text-center border-t border-slate-100">
                    <p className="text-[10px] text-slate-400 flex items-center justify-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        Renomear um grupo atualiza todos os seus terminais automaticamente.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default GroupManagerModal;
