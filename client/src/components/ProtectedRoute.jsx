import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { isAuthorizedMagazineCreator } from '../utils/magazinePermissions';
import { isAuthorizedFeedbackCoordinator } from '../utils/feedbackPermissions';

export default function ProtectedRoute({ children, role, requireCoordinator, requireMagazineCreator, requireFeedbackCoordinator }) {
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

  if (requireCoordinator && user.role === 'faculty' && !user.is_seminar_coordinator) {
    return <Navigate to="/faculty" replace />;
  }

  if (requireMagazineCreator && !isAuthorizedMagazineCreator(user)) {
    return <Navigate to="/faculty/magazines" replace />;
  }

  if (requireFeedbackCoordinator && !isAuthorizedFeedbackCoordinator(user)) {
    return <Navigate to="/faculty" replace />;
  }

  return children;
}
