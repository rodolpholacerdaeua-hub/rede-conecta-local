import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import ErrorBoundary from './components/ErrorBoundary';
import Login from './pages/Login';
import ResetPassword from './pages/ResetPassword';
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
import AIAgentSimulator from './components/AIAgentSimulator';
import Layout from './components/Layout';

// Componente para proteger rotas
const PrivateRoute = ({ children }) => {
  const { currentUser } = useAuth();

  if (!currentUser) {
    return <Navigate to="/" replace />;
  }

  return children;
};

// HOC para envolver páginas com Error Boundary
const SafePage = ({ children }) => (
  <ErrorBoundary>
    {children}
  </ErrorBoundary>
);

function App() {
  return (
    <Router>
      <AuthProvider>
        <AIAgentSimulator />
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/player/:terminalId" element={<SafePage><Player /></SafePage>} />

          {/* Rotas Protegidas */}
          <Route element={
            <PrivateRoute>
              <Layout />
            </PrivateRoute>
          }>
            <Route path="/dashboard" element={<SafePage><Dashboard /></SafePage>} />
            <Route path="/players" element={<SafePage><Players /></SafePage>} />
            <Route path="/media" element={<SafePage><MediaLibrary /></SafePage>} />
            <Route path="/campaigns" element={<SafePage><Campaigns /></SafePage>} />
            <Route path="/playlists" element={<SafePage><Playlists /></SafePage>} />
            <Route path="/finance" element={<SafePage><Finance /></SafePage>} />
            <Route path="/users" element={<SafePage><Users /></SafePage>} />
            <Route path="/leads" element={<SafePage><Leads /></SafePage>} />
            <Route path="/my-plan" element={<SafePage><MyPlan /></SafePage>} />
            <Route path="/reports" element={<SafePage><PlaybackReports /></SafePage>} />
            <Route path="/settings" element={<div className="p-4">Configurações (Em breve)</div>} />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </Router>
  );
}

export default App;

