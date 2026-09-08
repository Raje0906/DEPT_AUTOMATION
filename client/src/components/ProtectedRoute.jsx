import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function ProtectedRoute({ children, role }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center">
        <div className="text-sm text-draft">Loading...</div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  if (role && user.role !== role) {
    // Redirect to correct dashboard
    const roleRoutes = { student: '/student', faculty: '/faculty', hod: '/hod' };
    return <Navigate to={roleRoutes[user.role] || '/login'} replace />;
  }

  return children;
}
