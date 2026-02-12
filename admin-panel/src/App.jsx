import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import ErrorBoundary from './components/ErrorBoundary';

// Páginas Públicas
import LandingPage from './pages/LandingPage';
import Login from './pages/Login';
import ResetPassword from './pages/ResetPassword';

// Páginas Protegidas
import Dashboard from './pages/Dashboard';
import Players from './pages/Players';
import MediaLibrary from './pages/MediaLibrary';
import Playlists from './pages/Playlists';
import Campaigns from './pages/Campaigns';
import Finance from './pages/Finance';
import Users from './pages/Users';
import Leads from './pages/Leads';
import MyPlan from './pages/MyPlan';
import Player from './pages/Player';
import PlaybackReports from './pages/PlaybackReports';
import PartnerDashboard from './pages/PartnerDashboard';
import PartnerAdPage from './pages/PartnerAdPage';
import AIAgentSimulator from './components/AIAgentSimulator';
import Layout from './components/Layout';
import HelpCenter from './pages/HelpCenter';

// Proteção de rota padrão
const PrivateRoute = ({ children }) => {
  const { currentUser } = useAuth();
  if (!currentUser) return <Navigate to="/login" replace />;
  return children;
};

// Redirect por role após login
const RoleRedirect = () => {
  const { userData, currentUser } = useAuth();

  // Se não tem nem currentUser, redirecionar para login
  if (!currentUser) return <Navigate to="/login" replace />;

  // Se tem currentUser mas userData ainda está carregando, mostrar loading
  if (!userData) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-900 text-white font-['Outfit']">
        <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-2xl animate-spin mb-6" />
        <h1 className="text-lg font-black uppercase tracking-[0.3em] animate-pulse">Carregando perfil...</h1>
      </div>
    );
  }

  switch (userData.role) {
    case 'admin':
      return <Navigate to="/admin/dashboard" replace />;
    case 'parceiro':
      return <Navigate to={`/parceiro/${userData.slug || userData.id}/dashboard`} replace />;
    case 'cliente':
      return <Navigate to={`/anunciante/${userData.slug || userData.id}/dashboard`} replace />;
    default:
      return <Navigate to="/login" replace />;
  }
};

// Error wrapper
const SafePage = ({ children }) => (
  <ErrorBoundary>{children}</ErrorBoundary>
);

function App() {
  return (
    <Router>
      <AuthProvider>
        <AIAgentSimulator />
        <Routes>
          {/* ═══ ROTAS PÚBLICAS ═══ */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/player/:terminalId" element={<SafePage><Player /></SafePage>} />

          {/* Redirect inteligente pós-login */}
          <Route path="/redirect" element={
            <PrivateRoute><RoleRedirect /></PrivateRoute>
          } />

          {/* ═══ ROTAS ADMIN ═══ */}
          <Route element={
            <PrivateRoute><Layout /></PrivateRoute>
          }>
            {/* Admin */}
            <Route path="/admin/dashboard" element={<SafePage><Dashboard /></SafePage>} />
            <Route path="/admin/players" element={<SafePage><Players /></SafePage>} />
            <Route path="/admin/media" element={<SafePage><MediaLibrary /></SafePage>} />
            <Route path="/admin/campaigns" element={<SafePage><Campaigns /></SafePage>} />
            <Route path="/admin/playlists" element={<SafePage><Playlists /></SafePage>} />
            <Route path="/admin/finance" element={<SafePage><Finance /></SafePage>} />
            <Route path="/admin/users" element={<SafePage><Users /></SafePage>} />
            <Route path="/admin/leads" element={<SafePage><Leads /></SafePage>} />
            <Route path="/admin/reports" element={<SafePage><PlaybackReports /></SafePage>} />
            <Route path="/admin/settings" element={<div className="p-4">Configurações (Em breve)</div>} />
            <Route path="/admin/ajuda" element={<SafePage><HelpCenter /></SafePage>} />

            {/* Parceiro */}
            <Route path="/parceiro/:slug/dashboard" element={<SafePage><PartnerDashboard /></SafePage>} />
            <Route path="/parceiro/:slug/meu-anuncio" element={<SafePage><PartnerAdPage /></SafePage>} />
            <Route path="/parceiro/:slug/biblioteca" element={<SafePage><MediaLibrary /></SafePage>} />
            <Route path="/parceiro/:slug/campanhas" element={<SafePage><Campaigns /></SafePage>} />
            <Route path="/parceiro/:slug/financeiro" element={<SafePage><Finance /></SafePage>} />
            <Route path="/parceiro/:slug/ajuda" element={<SafePage><HelpCenter /></SafePage>} />

            {/* Anunciante (cliente) */}
            <Route path="/anunciante/:slug/dashboard" element={<SafePage><Dashboard /></SafePage>} />
            <Route path="/anunciante/:slug/biblioteca" element={<SafePage><MediaLibrary /></SafePage>} />
            <Route path="/anunciante/:slug/campanhas" element={<SafePage><Campaigns /></SafePage>} />
            <Route path="/anunciante/:slug/plano" element={<SafePage><MyPlan /></SafePage>} />
            <Route path="/anunciante/:slug/financeiro" element={<SafePage><Finance /></SafePage>} />
            <Route path="/anunciante/:slug/relatorios" element={<SafePage><PlaybackReports /></SafePage>} />
            <Route path="/anunciante/:slug/ajuda" element={<SafePage><HelpCenter /></SafePage>} />
          </Route>

          {/* ═══ LEGACY REDIRECTS (manter compatibilidade) ═══ */}
          <Route path="/dashboard" element={<Navigate to="/redirect" replace />} />
          <Route path="/partner" element={<Navigate to="/redirect" replace />} />
          <Route path="/players" element={<Navigate to="/admin/players" replace />} />
          <Route path="/media" element={<Navigate to="/redirect" replace />} />
          <Route path="/campaigns" element={<Navigate to="/redirect" replace />} />
          <Route path="/playlists" element={<Navigate to="/admin/playlists" replace />} />
          <Route path="/finance" element={<Navigate to="/redirect" replace />} />
          <Route path="/users" element={<Navigate to="/admin/users" replace />} />
          <Route path="/leads" element={<Navigate to="/admin/leads" replace />} />
          <Route path="/my-plan" element={<Navigate to="/redirect" replace />} />
          <Route path="/reports" element={<Navigate to="/redirect" replace />} />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </Router>
  );
}

export default App;
