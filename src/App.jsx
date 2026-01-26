import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import MediaLibrary from './pages/MediaLibrary';
import Playlists from './pages/Playlists';
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
        <Routes>
          <Route path="/" element={<Login />} />

          {/* Rotas Protegidas */}
          <Route element={
            <PrivateRoute>
              <Layout />
            </PrivateRoute>
          }>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/players" element={<div className="p-4">Página de Players (Em breve)</div>} />
            <Route path="/media" element={<MediaLibrary />} />
            <Route path="/playlists" element={<Playlists />} />
            <Route path="/users" element={<div className="p-4">Gestão de Usuários (Em breve)</div>} />
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
