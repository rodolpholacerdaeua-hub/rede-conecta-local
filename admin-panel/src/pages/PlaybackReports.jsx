import React, { useState, useEffect } from 'react';
import { BarChart3, Calendar, Monitor, Play, Download, Filter, RefreshCw, TrendingUp, Clock, Eye, ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase } from '../supabase';
import { useAuth } from '../contexts/AuthContext';

const PlaybackReports = () => {
    const { currentUser, userData } = useAuth();
    const [logs, setLogs] = useState([]);
    const [terminals, setTerminals] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedTerminal, setSelectedTerminal] = useState('all');
    const [dateRange, setDateRange] = useState('today');
    const [stats, setStats] = useState({ total: 0, uniqueMedia: 0, avgPerHour: 0 });

    // Paginação
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 25;

    // Calcular range de datas
    const getDateRange = () => {
        const now = new Date();
        let start, end = now;

        switch (dateRange) {
            case 'today':
                start = new Date(now.setHours(0, 0, 0, 0));
                end = new Date();
                break;
            case 'yesterday':
                start = new Date(now);
                start.setDate(start.getDate() - 1);
                start.setHours(0, 0, 0, 0);
                end = new Date(start);
                end.setHours(23, 59, 59, 999);
                break;
            case 'week':
                start = new Date(now);
                start.setDate(start.getDate() - 7);
                break;
            case 'month':
                start = new Date(now);
                start.setMonth(start.getMonth() - 1);
                break;
            default:
                start = new Date(now.setHours(0, 0, 0, 0));
        }

        return { start, end };
    };

    // Buscar terminais do usuário
    useEffect(() => {
        if (!currentUser) return;

        const fetchTerminals = async () => {
            const query = supabase.from('terminals').select('id, name, location');

            if (userData?.role !== 'admin') {
                query.eq('owner_id', currentUser.id);
            }

            const { data } = await query;
            setTerminals(data || []);
        };

        fetchTerminals();
    }, [currentUser, userData]);

    // Buscar logs de playback
    useEffect(() => {
        if (!currentUser) return;

        const fetchLogs = async () => {
            setLoading(true);
            const { start, end } = getDateRange();

            let query = supabase
                .from('playback_logs')
                .select(`
                    id,
                    media_name,
                    slot_type,
                    played_at,
                    status,
                    terminal_id,
                    terminals (name, location)
                `)
                .gte('played_at', start.toISOString())
                .lte('played_at', end.toISOString())
                .order('played_at', { ascending: false })
                .limit(500);

            if (selectedTerminal !== 'all') {
                query = query.eq('terminal_id', selectedTerminal);
            } else if (userData?.role !== 'admin') {
                // Filtrar por terminais do usuário
                const terminalIds = terminals.map(t => t.id);
                if (terminalIds.length > 0) {
                    query = query.in('terminal_id', terminalIds);
                }
            }

            const { data, error } = await query;

            if (error) {
                console.error('Erro ao buscar logs:', error);
                setLogs([]);
            } else {
                setLogs(data || []);

                // Calcular estatísticas
                const uniqueMedia = new Set(data?.map(l => l.media_name) || []).size;
                const hours = Math.max(1, (end - start) / (1000 * 60 * 60));
                setStats({
                    total: data?.length || 0,
                    uniqueMedia,
                    avgPerHour: Math.round((data?.length || 0) / hours)
                });
            }
            setLoading(false);
        };

        fetchLogs();
    }, [currentUser, userData, terminals, selectedTerminal, dateRange]);

    // Exportar CSV
    const exportCSV = () => {
        if (logs.length === 0) return;

        const headers = ['Data/Hora', 'Terminal', 'Local', 'Mídia', 'Tipo Slot', 'Status'];
        const rows = logs.map(log => [
            new Date(log.played_at).toLocaleString('pt-BR'),
            log.terminals?.name || 'N/A',
            log.terminals?.location || 'N/A',
            log.media_name,
            log.slot_type,
            log.status
        ]);

        const csv = [headers, ...rows].map(row => row.join(';')).join('\n');
        const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `pop_report_${dateRange}_${new Date().toISOString().slice(0, 10)}.csv`;
        link.click();
    };

    // Agrupar por mídia para resumo
    const mediaStats = logs.reduce((acc, log) => {
        const name = log.media_name || 'Desconhecido';
        if (!acc[name]) {
            acc[name] = { count: 0, slotType: log.slot_type };
        }
        acc[name].count++;
        return acc;
    }, {});

    const sortedMediaStats = Object.entries(mediaStats)
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 10);

    // Cálculos de paginação
    const totalPages = Math.ceil(logs.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedLogs = logs.slice(startIndex, endIndex);

    // Reset página quando filtros mudam
    useEffect(() => {
        setCurrentPage(1);
    }, [selectedTerminal, dateRange]);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <BarChart3 className="w-6 h-6 text-blue-500" />
                        Relatórios de Exibição
                    </h2>
                    <p className="text-slate-500">Proof of Play - Histórico de mídias exibidas</p>
                </div>

                <button
                    onClick={exportCSV}
                    disabled={logs.length === 0}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 disabled:opacity-50"
                >
                    <Download className="w-4 h-4" />
                    Exportar CSV
                </button>
            </div>

            {/* Filtros */}
            <div className="flex flex-wrap gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-slate-400" />
                    <select
                        value={dateRange}
                        onChange={(e) => setDateRange(e.target.value)}
                        className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium"
                    >
                        <option value="today">Hoje</option>
                        <option value="yesterday">Ontem</option>
                        <option value="week">Últimos 7 dias</option>
                        <option value="month">Últimos 30 dias</option>
                    </select>
                </div>

                <div className="flex items-center gap-2">
                    <Monitor className="w-4 h-4 text-slate-400" />
                    <select
                        value={selectedTerminal}
                        onChange={(e) => setSelectedTerminal(e.target.value)}
                        className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium"
                    >
                        <option value="all">Todos os Terminais</option>
                        {terminals.map(t => (
                            <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                    </select>
                </div>

                {loading && (
                    <div className="flex items-center gap-2 text-slate-500 text-sm">
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Carregando...
                    </div>
                )}
            </div>

            {/* Cards de Estatísticas */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white p-5 rounded-xl shadow-lg">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-blue-100 text-xs font-bold uppercase tracking-wider">Total Exibições</p>
                            <p className="text-3xl font-bold mt-1">{stats.total.toLocaleString()}</p>
                        </div>
                        <Eye className="w-10 h-10 text-blue-300" />
                    </div>
                </div>

                <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white p-5 rounded-xl shadow-lg">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-emerald-100 text-xs font-bold uppercase tracking-wider">Mídias Únicas</p>
                            <p className="text-3xl font-bold mt-1">{stats.uniqueMedia}</p>
                        </div>
                        <Play className="w-10 h-10 text-emerald-300" />
                    </div>
                </div>

                <div className="bg-gradient-to-br from-purple-500 to-purple-600 text-white p-5 rounded-xl shadow-lg">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-purple-100 text-xs font-bold uppercase tracking-wider">Média por Hora</p>
                            <p className="text-3xl font-bold mt-1">{stats.avgPerHour}</p>
                        </div>
                        <TrendingUp className="w-10 h-10 text-purple-300" />
                    </div>
                </div>
            </div>

            {/* Top 10 Mídias */}
            {sortedMediaStats.length > 0 && (
                <div className="bg-white border border-slate-200 rounded-xl p-5">
                    <h3 className="text-sm font-bold text-slate-600 uppercase tracking-wider mb-4 flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-blue-500" />
                        Top 10 Mídias Mais Exibidas
                    </h3>
                    <div className="space-y-2">
                        {sortedMediaStats.map(([name, data], idx) => (
                            <div key={name} className="flex items-center gap-3">
                                <span className="w-6 h-6 bg-slate-100 rounded-full flex items-center justify-center text-xs font-bold text-slate-600">
                                    {idx + 1}
                                </span>
                                <div className="flex-1">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm font-medium text-slate-700 truncate max-w-xs">{name}</span>
                                        <span className="text-sm font-bold text-blue-600">{data.count}x</span>
                                    </div>
                                    <div className="w-full bg-slate-100 rounded-full h-1.5 mt-1">
                                        <div
                                            className="bg-blue-500 h-1.5 rounded-full"
                                            style={{ width: `${(data.count / sortedMediaStats[0][1].count) * 100}%` }}
                                        />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Tabela de Logs */}
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-600 uppercase tracking-wider flex items-center gap-2">
                        <Clock className="w-4 h-4 text-blue-500" />
                        Histórico Detalhado ({logs.length} registros)
                    </h3>
                    {totalPages > 1 && (
                        <div className="flex items-center gap-2 text-sm">
                            <button
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </button>
                            <span className="text-slate-600 font-medium px-2">
                                Página {currentPage} de {totalPages}
                            </span>
                            <button
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages}
                                className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    )}
                </div>

                {logs.length === 0 ? (
                    <div className="p-12 text-center text-slate-500">
                        <Eye className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                        <p>Nenhuma exibição registrada no período selecionado.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase">Data/Hora</th>
                                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase">Terminal</th>
                                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase">Mídia</th>
                                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase">Tipo</th>
                                    <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {paginatedLogs.map(log => (
                                    <tr key={log.id} className="hover:bg-slate-50">
                                        <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                                            {new Date(log.played_at).toLocaleString('pt-BR')}
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="font-medium text-slate-700">{log.terminals?.name || 'N/A'}</div>
                                            <div className="text-xs text-slate-400">{log.terminals?.location}</div>
                                        </td>
                                        <td className="px-4 py-3 text-slate-700 max-w-xs truncate">
                                            {log.media_name}
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${log.slot_type === 'global' ? 'bg-blue-100 text-blue-700' :
                                                log.slot_type === 'partner' ? 'bg-purple-100 text-purple-700' :
                                                    'bg-slate-100 text-slate-600'
                                                }`}>
                                                {log.slot_type || 'N/A'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${log.status === 'played' ? 'bg-emerald-100 text-emerald-700' :
                                                log.status === 'skipped' ? 'bg-amber-100 text-amber-700' :
                                                    'bg-red-100 text-red-700'
                                                }`}>
                                                <span className="w-1.5 h-1.5 rounded-full bg-current" />
                                                {log.status || 'played'}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Paginação inferior */}
                {totalPages > 1 && (
                    <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-sm">
                        <span className="text-slate-500">
                            Exibindo {startIndex + 1}-{Math.min(endIndex, logs.length)} de {logs.length}
                        </span>
                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => setCurrentPage(1)}
                                disabled={currentPage === 1}
                                className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 disabled:opacity-40 text-xs font-medium"
                            >
                                Primeira
                            </button>
                            <button
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 disabled:opacity-40 text-xs font-medium"
                            >
                                Anterior
                            </button>
                            <button
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages}
                                className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 disabled:opacity-40 text-xs font-medium"
                            >
                                Próxima
                            </button>
                            <button
                                onClick={() => setCurrentPage(totalPages)}
                                disabled={currentPage === totalPages}
                                className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 disabled:opacity-40 text-xs font-medium"
                            >
                                Última
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PlaybackReports;
