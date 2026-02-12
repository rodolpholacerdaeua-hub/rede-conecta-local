import React, { useState, useMemo } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
    LayoutDashboard, Monitor, Image, ListVideo, Users, Settings, LogOut,
    Menu, Bell, Coins, CreditCard, Package, ChevronRight, X, BarChart3, UserCheck, HelpCircle, Megaphone
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import ConnectaMascot from './ConnectaMascot';
import OnboardingTour from './OnboardingTour';

const SidebarItem = ({ icon: Icon, label, active, onClick, dataTour }) => (
    <button
        onClick={onClick}
        data-tour={dataTour}
        className={`w-full group flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-300 ${active
            ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
            : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'
            }`}
    >
        <div className="flex items-center space-x-3">
            <Icon className={`w-5 h-5 transition-transform duration-300 group-hover:scale-110 ${active ? 'text-white' : 'text-slate-400 group-hover:text-white'}`} />
            <span className="font-semibold tracking-tight">{label}</span>
        </div>
        {active && <ChevronRight className="w-4 h-4 text-blue-200" />}
    </button>
);

const Layout = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { logout, userData } = useAuth();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    const isAdmin = userData?.role === 'admin';
    const isCliente = userData?.role === 'cliente';
    const isParceiro = userData?.role === 'parceiro';
    const userSlug = userData?.slug || userData?.id;

    // Prefixo de rota baseado no papel
    const routePrefix = useMemo(() => {
        if (isAdmin) return '/admin';
        if (isParceiro) return `/parceiro/${userSlug}`;
        if (isCliente) return `/anunciante/${userSlug}`;
        return '';
    }, [isAdmin, isParceiro, isCliente, userSlug]);

    const handleLogout = async () => {
        await logout();
        navigate('/');
    };

    // Menu dinâmico por papel
    const menuItems = useMemo(() => {
        if (isAdmin) {
            return [
                { icon: LayoutDashboard, label: 'Dashboard', path: `${routePrefix}/dashboard`, tour: 'menu-dashboard' },
                { icon: Monitor, label: 'Telas (Players)', path: `${routePrefix}/players` },
                { icon: Image, label: 'Biblioteca', path: `${routePrefix}/media`, tour: 'menu-biblioteca' },
                { icon: ListVideo, label: 'Campanhas', path: `${routePrefix}/campaigns`, tour: 'menu-campanhas' },
                { icon: ListVideo, label: 'Playlists Globais', path: `${routePrefix}/playlists` },
                { icon: CreditCard, label: 'Créditos & Finanças', path: `${routePrefix}/finance`, tour: 'menu-financeiro' },
                { icon: BarChart3, label: 'Relatórios PoP', path: `${routePrefix}/reports`, tour: 'menu-relatorios' },
                { icon: Users, label: 'Gestão de Usuários', path: `${routePrefix}/users` },
                { icon: UserCheck, label: 'Gestão de Leads', path: `${routePrefix}/leads` },
                { icon: HelpCircle, label: 'Central de Ajuda', path: `${routePrefix}/ajuda` },
                { icon: Settings, label: 'Configurações', path: `${routePrefix}/settings` },
            ];
        }

        if (isParceiro) {
            return [
                { icon: LayoutDashboard, label: 'Dashboard', path: `${routePrefix}/dashboard`, tour: 'menu-dashboard' },
                { icon: Megaphone, label: 'Meu Anúncio', path: `${routePrefix}/meu-anuncio` },
                { icon: Image, label: 'Minha Biblioteca', path: `${routePrefix}/biblioteca`, tour: 'menu-biblioteca' },
                { icon: ListVideo, label: 'Minhas Campanhas', path: `${routePrefix}/campanhas`, tour: 'menu-campanhas' },
                { icon: CreditCard, label: 'Financeiro', path: `${routePrefix}/financeiro`, tour: 'menu-financeiro' },
                { icon: HelpCircle, label: 'Central de Ajuda', path: `${routePrefix}/ajuda` },
            ];
        }

        // Cliente / Anunciante
        return [
            { icon: LayoutDashboard, label: 'Dashboard', path: `${routePrefix}/dashboard`, tour: 'menu-dashboard' },
            { icon: Image, label: 'Minha Biblioteca', path: `${routePrefix}/biblioteca`, tour: 'menu-biblioteca' },
            { icon: ListVideo, label: 'Minhas Campanhas', path: `${routePrefix}/campanhas`, tour: 'menu-campanhas' },
            { icon: Package, label: 'Meu Plano', path: `${routePrefix}/plano` },
            { icon: CreditCard, label: 'Financeiro', path: `${routePrefix}/financeiro`, tour: 'menu-financeiro' },
            { icon: BarChart3, label: 'Relatórios', path: `${routePrefix}/relatorios`, tour: 'menu-relatorios' },
            { icon: HelpCircle, label: 'Central de Ajuda', path: `${routePrefix}/ajuda` },
        ];
    }, [isAdmin, isParceiro, routePrefix]);

    // Label do papel
    const roleLabel = useMemo(() => {
        if (isAdmin) return 'Administrador';
        if (isParceiro) return 'Parceiro';
        return 'Anunciante';
    }, [isAdmin, isParceiro]);

    return (
        <div className="flex h-screen bg-mesh overflow-hidden font-['Inter'] font-medium">
            {/* Mobile Sidebar Overlay */}
            {isMobileMenuOpen && (
                <div
                    className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 md:hidden"
                    onClick={() => setIsMobileMenuOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside className={`
                fixed md:static inset-y-0 left-0 w-72 bg-gradient-premium text-white z-50 transform transition-transform duration-300 ease-in-out
                ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
                flex flex-col border-r border-slate-800/50
            `}>
                <div className="p-6 pb-4">
                    <div className="flex items-center space-x-3 cursor-pointer group" onClick={() => navigate('/')}>
                        <div className="transform group-hover:scale-110 transition-transform">
                            <ConnectaMascot size={36} animate={true} />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-xl font-black italic tracking-tighter leading-none Outfit">CONECTA</span>
                            <span className="text-[10px] uppercase font-black tracking-[0.3em] text-blue-400 leading-none mt-1">Local AdManager</span>
                        </div>
                    </div>
                </div>

                <nav className="flex-1 px-4 py-2 space-y-2 overflow-y-auto">
                    {menuItems.map((item) => (
                        <SidebarItem
                            key={item.path}
                            icon={item.icon}
                            label={item.label}
                            dataTour={item.tour}
                            active={location.pathname === item.path}
                            onClick={() => {
                                navigate(item.path);
                                setIsMobileMenuOpen(false);
                            }}
                        />
                    ))}
                </nav>

                <div className="p-6 border-t border-slate-800/50">
                    <div className="bg-slate-800/30 rounded-2xl p-4 mb-4 border border-white/5">
                        <div className="flex items-center gap-3 mb-2">
                            <ConnectaMascot size={28} animate={false} />
                            <p className="text-[10px] uppercase font-black text-slate-500 tracking-widest">Estado da Conta</p>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-bold text-slate-200 truncate">{userData?.displayName || userData?.name}</span>
                            <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 text-[10px] font-black uppercase">
                                {roleLabel}
                            </span>
                        </div>
                    </div>
                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center justify-center space-x-3 px-4 py-3 rounded-xl text-slate-400 hover:bg-red-500/10 hover:text-red-400 transition-all font-bold text-sm border border-transparent hover:border-red-500/20"
                    >
                        <LogOut className="w-4 h-4" />
                        <span>Sair do Painel</span>
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
                {/* Top Header */}
                <header className="h-20 glass border-b border-slate-200/60 flex items-center justify-between px-8 z-30">
                    <button
                        onClick={() => setIsMobileMenuOpen(true)}
                        className="md:hidden p-2.5 bg-white rounded-xl shadow-sm border border-slate-200 text-slate-600 active:scale-90 transition-transform"
                    >
                        <Menu className="w-5 h-5" />
                    </button>

                    <div className="flex items-center ml-auto space-x-4 md:space-x-6">
                        {/* Credit Balance */}
                        <div
                            data-tour="credits-display"
                            onClick={() => navigate(`${routePrefix}/finance${isParceiro || isCliente ? 'iro' : ''}`)}
                            className="bg-white premium-shadow border border-slate-100 px-4 py-2 rounded-2xl flex items-center space-x-3 cursor-pointer hover:border-blue-300 hover:translate-y-[-2px] transition-all group"
                        >
                            <div className="w-8 h-8 bg-amber-50 rounded-xl flex items-center justify-center group-hover:bg-amber-100 transition-colors">
                                <Coins className="w-4 h-4 text-amber-500" />
                            </div>
                            <div className="flex flex-col -space-y-0.5">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Créditos</span>
                                <span className="text-sm font-black text-slate-800 tracking-tight">{userData?.tokens?.toLocaleString() || 0}</span>
                            </div>
                        </div>

                        {/* Notifications */}
                        <button className="p-2.5 bg-white premium-shadow border border-slate-100 rounded-xl text-slate-400 hover:text-blue-600 hover:border-blue-100 transition-all relative">
                            <Bell className="w-5 h-5" />
                            <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white"></span>
                        </button>

                        {/* Profile */}
                        <div className="flex items-center space-x-3 pl-4 border-l border-slate-200/60">
                            <div className="text-right hidden sm:block">
                                <p className="text-sm font-black text-slate-800 tracking-tight Outfit leading-none">
                                    {userData?.displayName?.split(' ')[0] || userData?.name?.split(' ')[0] || 'Usuário'}
                                </p>
                                <p className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em] mt-1 opacity-70">
                                    {roleLabel}
                                </p>
                            </div>
                            <div className="w-11 h-11 bg-gradient-to-br from-blue-500 to-blue-700 rounded-2xl flex items-center justify-center text-white font-black text-sm shadow-lg shadow-blue-600/20 border-2 border-white transform hover:rotate-6 transition-transform cursor-pointer">
                                {(userData?.displayName || userData?.name || '??').substring(0, 2).toUpperCase()}
                            </div>
                        </div>
                    </div>
                </header>

                {/* Page Content */}
                <main className="flex-1 overflow-x-hidden overflow-y-auto p-4 md:p-8">
                    <OnboardingTour />
                    <div className="max-w-7xl mx-auto animate-fade-in pb-12">
                        <Outlet />
                    </div>
                </main>
            </div>
        </div>
    );
};

export default Layout;
