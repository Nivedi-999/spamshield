// src/App.js
import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import CssBaseline from '@mui/material/CssBaseline';

// Pages
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import EmailDetail from './pages/EmailDetail';
import Settings from './pages/Settings';
import NotFound from './pages/NotFound';
import AllEmails from './pages/Emails/AllEmails';  // ← NEW PAGE

// Components
import Layout from './components/Layout';

// Services
import { getCurrentUser } from './services/authService';

// Theme
import { ThemeProvider } from './contexts/ThemeContext';
import './darkMode.css';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const userData = await getCurrentUser();
        setUser(userData);
      } catch (error) {
        console.error('Authentication error:', error);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    checkAuth();
  }, []);

  const ProtectedRoute = ({ children }) => {
    if (loading) return <div>Loading...</div>;
    return user ? children : <Navigate to="/login" />;
  };

  return (
    <ThemeProvider>
      <CssBaseline />
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />

          {/* DASHBOARD */}
          <Route path="/" element={
            <ProtectedRoute>
              <Layout user={user}>
                <Dashboard />
              </Layout>
            </ProtectedRoute>
          } />
          <Route path="/dashboard" element={
            <ProtectedRoute>
              <Layout user={user}>
                <Dashboard />
              </Layout>
            </ProtectedRoute>
          } />

          {/* ALL EMAILS — ADD THIS */}
          <Route path="/emails" element={
            <ProtectedRoute>
              <Layout user={user}>
                <AllEmails />
              </Layout>
            </ProtectedRoute>
          } />

          {/* EMAIL DETAIL */}
          <Route path="/email/:id" element={
            <ProtectedRoute>
              <Layout user={user}>
                <EmailDetail />
              </Layout>
            </ProtectedRoute>
          } />

          {/* SETTINGS */}
          <Route path="/settings" element={
            <ProtectedRoute>
              <Layout user={user}>
                <Settings />
              </Layout>
            </ProtectedRoute>
          } />

          {/* 404 */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Router>
    </ThemeProvider>
  );
}

export default App;