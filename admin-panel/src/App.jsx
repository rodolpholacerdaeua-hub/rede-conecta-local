import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Players from './pages/Players';
import MediaLibrary from './pages/MediaLibrary';
import Playlists from './pages/Playlists';
import Campaigns from './pages/Campaigns';
import Finance from './pages/Finance';
import Users from './pages/Users';
import MyPlan from './pages/MyPlan';
import Player from './pages/Player';
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

function App() {
  return (
    <Router>
      <AuthProvider>
        <AIAgentSimulator />
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/player/:terminalId" element={<Player />} />

          {/* Rotas Protegidas */}
          <Route element={
            <PrivateRoute>
              <Layout />
            </PrivateRoute>
          }>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/players" element={<Players />} />
            <Route path="/media" element={<MediaLibrary />} />
            <Route path="/campaigns" element={<Campaigns />} />
            <Route path="/playlists" element={<Playlists />} />
            <Route path="/finance" element={<Finance />} />
            <Route path="/users" element={<Users />} />
            <Route path="/my-plan" element={<MyPlan />} />
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
