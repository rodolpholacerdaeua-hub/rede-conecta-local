import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { updateDocument } from '../db';
import {
    Users, Phone, Mail, Calendar, MessageSquare, Filter,
    CheckCircle, XCircle, Clock, UserCheck, UserX, Search,
    ChevronDown, Edit2, Save, X
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const STATUS_CONFIG = {
    new: { label: 'Novo', color: 'bg-blue-100 text-blue-700 border-blue-200', icon: Clock },
    contacted: { label: 'Contatado', color: 'bg-amber-100 text-amber-700 border-amber-200', icon: MessageSquare },
    converted: { label: 'Convertido', color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: UserCheck },
    lost: { label: 'Perdido', color: 'bg-red-100 text-red-700 border-red-200', icon: UserX },
    inactive: { label: 'Inativo', color: 'bg-slate-100 text-slate-500 border-slate-200', icon: XCircle }
};

const Leads = () => {
    const { userData } = useAuth();
    const [leads, setLeads] = useState([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [editingLead, setEditingLead] = useState(null);
    const [editNotes, setEditNotes] = useState('');
    const [editStatus, setEditStatus] = useState('');

    useEffect(() => {
        if (!userData || userData.role !== 'admin') return;

        const loadLeads = async () => {
            try {
                const { data, error } = await supabase
                    .from('leads')
                    .select('*, users(name, plan)')
                    .order('created_at', { ascending: false });

                if (error) throw error;
                setLeads(data || []);
            } catch (error) {
                console.error("Leads: Erro ao carregar:", error);
            } finally {
                setLoading(false);
            }
        };

        loadLeads();

        // Realtime subscription
        const channel = supabase
            .channel('leads-realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, () => {
                loadLeads();
            })
            .subscribe();

        return () => supabase.removeChannel(channel);
    }, [userData]);

    const handleEditClick = (lead) => {
        setEditingLead(lead);
        setEditNotes(lead.notes || '');
        setEditStatus(lead.status);
    };

    const handleSave = async () => {
        if (!editingLead) return;

        try {
            await supabase
                .from('leads')
                .update({
                    notes: editNotes,
                    status: editStatus,
                    last_contact_at: editStatus !== editingLead.status ? new Date().toISOString() : editingLead.last_contact_at,
                    updated_at: new Date().toISOString()
                })
                .eq('id', editingLead.id);

            setLeads(prev => prev.map(l =>
                l.id === editingLead.id
                    ? { ...l, notes: editNotes, status: editStatus, last_contact_at: editStatus !== editingLead.status ? new Date().toISOString() : l.last_contact_at }
                    : l
            ));
            setEditingLead(null);
        } catch (e) {
            console.error(e);
            alert('Erro ao atualizar lead');
        }
    };

    const filteredLeads = leads.filter(lead => {
        const matchesStatus = statusFilter === 'all' || lead.status === statusFilter;
        const matchesSearch = !searchQuery ||
            lead.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            lead.phone?.includes(searchQuery) ||
            lead.company_name?.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesStatus && matchesSearch;
    });

    const stats = {
        total: leads.length,
        new: leads.filter(l => l.status === 'new').length,
        contacted: leads.filter(l => l.status === 'contacted').length,
        converted: leads.filter(l => l.status === 'converted').length,
        lost: leads.filter(l => l.status === 'lost').length
    };

    if (userData?.role !== 'admin') {
        return <div className="p-10 text-center text-slate-500 font-bold">Acesso restrito ao Administrador.</div>;
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h2 className="text-2xl font-black text-slate-800 uppercase italic">Gestão de Leads</h2>
                <p className="text-slate-500 font-medium">Acompanhe e converta seus potenciais clientes</p>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                    <div className="text-3xl font-black text-slate-800">{stats.total}</div>
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total de Leads</div>
                </div>
                <div className="bg-blue-50 rounded-xl border border-blue-100 p-4">
                    <div className="text-3xl font-black text-blue-600">{stats.new}</div>
                    <div className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Novos</div>
                </div>
                <div className="bg-amber-50 rounded-xl border border-amber-100 p-4">
                    <div className="text-3xl font-black text-amber-600">{stats.contacted}</div>
                    <div className="text-[10px] font-black text-amber-400 uppercase tracking-widest">Contatados</div>
                </div>
                <div className="bg-emerald-50 rounded-xl border border-emerald-100 p-4">
                    <div className="text-3xl font-black text-emerald-600">{stats.converted}</div>
                    <div className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Convertidos</div>
                </div>
                <div className="bg-red-50 rounded-xl border border-red-100 p-4">
                    <div className="text-3xl font-black text-red-600">{stats.lost}</div>
                    <div className="text-[10px] font-black text-red-400 uppercase tracking-widest">Perdidos</div>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-4 items-center">
                <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Buscar por email, telefone ou empresa..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                </div>
                <div className="flex gap-2 flex-wrap">
                    <button
                        onClick={() => setStatusFilter('all')}
                        className={`px-3 py-2 rounded-lg text-xs font-black uppercase transition-all ${statusFilter === 'all' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                    >
                        Todos
                    </button>
                    {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                        <button
                            key={key}
                            onClick={() => setStatusFilter(key)}
                            className={`px-3 py-2 rounded-lg text-xs font-black uppercase transition-all ${statusFilter === key ? config.color.replace('100', '600').replace('text-', 'text-white bg-') : config.color}`}
                        >
                            {config.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                {loading ? (
                    <div className="p-8 text-center text-slate-400">Carregando...</div>
                ) : filteredLeads.length === 0 ? (
                    <div className="p-8 text-center text-slate-400">Nenhum lead encontrado</div>
                ) : (
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-slate-50 text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-100">
                                <th className="px-6 py-4">Lead</th>
                                <th className="px-6 py-4">Contato</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4">Último Contato</th>
                                <th className="px-6 py-4">Notas</th>
                                <th className="px-6 py-4 text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-bold text-sm">
                            {filteredLeads.map(lead => {
                                const StatusIcon = STATUS_CONFIG[lead.status]?.icon || Clock;
                                return (
                                    <tr key={lead.id} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-full flex items-center justify-center text-white font-black">
                                                    {lead.email?.[0]?.toUpperCase() || '?'}
                                                </div>
                                                <div>
                                                    <div className="text-slate-800">{lead.users?.name || lead.email?.split('@')[0]}</div>
                                                    <div className="text-[10px] text-slate-400">{lead.source || 'signup'}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="space-y-1">
                                                <a href={`mailto:${lead.email}`} className="flex items-center gap-1.5 text-slate-600 hover:text-blue-600 transition-colors text-xs">
                                                    <Mail className="w-3.5 h-3.5" />
                                                    {lead.email}
                                                </a>
                                                {lead.phone && (
                                                    <a
                                                        href={`https://wa.me/55${lead.phone.replace(/\D/g, '')}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="flex items-center gap-1.5 text-green-600 hover:text-green-700 transition-colors text-xs"
                                                    >
                                                        <Phone className="w-3.5 h-3.5" />
                                                        {lead.phone}
                                                    </a>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black uppercase border ${STATUS_CONFIG[lead.status]?.color || 'bg-slate-100 text-slate-500'}`}>
                                                <StatusIcon className="w-3.5 h-3.5" />
                                                {STATUS_CONFIG[lead.status]?.label || lead.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-slate-500 text-xs">
                                            {lead.last_contact_at ? (
                                                <div className="flex items-center gap-1.5">
                                                    <Calendar className="w-3.5 h-3.5" />
                                                    {new Date(lead.last_contact_at).toLocaleDateString('pt-BR')}
                                                </div>
                                            ) : (
                                                <span className="text-slate-300 italic">Nunca</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            {lead.notes ? (
                                                <span className="text-xs text-slate-600 line-clamp-2 max-w-[200px]">{lead.notes}</span>
                                            ) : (
                                                <span className="text-slate-300 text-xs italic">Sem notas</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button
                                                onClick={() => handleEditClick(lead)}
                                                className="text-slate-300 hover:text-blue-600 transition-colors p-2 hover:bg-blue-50 rounded-lg"
                                            >
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Edit Modal */}
            {editingLead && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in duration-200">
                        <div className="p-6 bg-indigo-600 text-white flex justify-between items-center">
                            <h3 className="font-black uppercase italic tracking-wider flex items-center gap-2">
                                <Edit2 className="w-4 h-4" />
                                Editar Lead
                            </h3>
                            <button onClick={() => setEditingLead(null)} className="hover:bg-white/20 p-1 rounded">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="bg-slate-50 rounded-xl p-4">
                                <div className="text-slate-800 font-bold">{editingLead.email}</div>
                                {editingLead.phone && <div className="text-slate-500 text-sm">{editingLead.phone}</div>}
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase">Status</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {Object.entries(STATUS_CONFIG).map(([key, config]) => {
                                        const Icon = config.icon;
                                        return (
                                            <button
                                                key={key}
                                                onClick={() => setEditStatus(key)}
                                                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-black uppercase border-2 transition-all ${editStatus === key
                                                        ? config.color.replace('border-', 'border-2 border-') + ' ring-2 ring-offset-1'
                                                        : 'border-transparent ' + config.color
                                                    }`}
                                            >
                                                <Icon className="w-4 h-4" />
                                                {config.label}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase">Notas/Observações</label>
                                <textarea
                                    value={editNotes}
                                    onChange={(e) => setEditNotes(e.target.value)}
                                    placeholder="Adicione notas sobre este lead..."
                                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none resize-none h-24"
                                />
                            </div>
                        </div>
                        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3">
                            <button
                                onClick={() => setEditingLead(null)}
                                className="px-4 py-2 text-sm font-bold text-slate-500 hover:text-slate-700 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSave}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg font-black text-sm shadow-md transition-all active:scale-95 flex items-center gap-2"
                            >
                                <Save className="w-4 h-4" />
                                Salvar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Leads;
