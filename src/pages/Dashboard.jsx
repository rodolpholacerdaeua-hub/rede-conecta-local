import React from 'react';
import { Monitor, AlertTriangle, CheckCircle, Activity } from 'lucide-react';

const StatCard = ({ icon: Icon, label, value, color, subtext }) => (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-start space-x-4">
        <div className={`p-3 rounded-lg ${color}`}>
            <Icon className="w-6 h-6 text-white" />
        </div>
        <div>
            <p className="text-sm font-medium text-slate-500">{label}</p>
            <h3 className="text-2xl font-bold text-slate-800 mt-1">{value}</h3>
            {subtext && <p className="text-xs text-slate-400 mt-1">{subtext}</p>}
        </div>
    </div>
);

const Dashboard = () => {
    // Dados fictícios para visualização
    const stats = [
        { icon: Monitor, label: 'Total de Telas', value: '124', color: 'bg-blue-600', subtext: '12 novas este mês' },
        { icon: CheckCircle, label: 'Online Agora', value: '118', color: 'bg-emerald-500', subtext: '95% da rede ativa' },
        { icon: AlertTriangle, label: 'Alertas', value: '6', color: 'bg-amber-500', subtext: 'Necessitam atenção' },
        { icon: Activity, label: 'Exibições Hoje', value: '45.2k', color: 'bg-purple-600', subtext: '+12% vs. ontem' },
    ];

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold text-slate-800">Visão Geral</h2>
                <p className="text-slate-500">Bem-vindo de volta, Admin.</p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {stats.map((stat, index) => (
                    <StatCard key={index} {...stat} />
                ))}
            </div>

            {/* Main Content Area */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Recent Activity */}
                <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-100 p-6">
                    <h3 className="font-bold text-slate-800 mb-4">Status da Rede (Tempo Real)</h3>
                    <div className="h-64 flex items-center justify-center bg-slate-50 rounded-lg border border-slate-200 border-dashed">
                        <p className="text-slate-400">Gráfico de desempenho da rede será exibido aqui</p>
                    </div>
                </div>

                {/* Quick Actions / Alerts */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
                    <h3 className="font-bold text-slate-800 mb-4">Ação Necessária</h3>
                    <div className="space-y-4">
                        <div className="bg-amber-50 p-3 rounded-lg border border-amber-100 flex items-start space-x-3">
                            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                            <div>
                                <p className="text-sm font-medium text-amber-800">Padaria Central - Offline</p>
                                <p className="text-xs text-amber-600 mt-1">Sem sinal há 2 horas. Verifique a conexão.</p>
                            </div>
                        </div>
                        <div className="bg-amber-50 p-3 rounded-lg border border-amber-100 flex items-start space-x-3">
                            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                            <div>
                                <p className="text-sm font-medium text-amber-800">Loja Calçados - Erro de Sync</p>
                                <p className="text-xs text-amber-600 mt-1">Falha ao baixar playlist "Promoção Verão".</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
