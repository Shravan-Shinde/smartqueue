import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { Loader2 } from 'lucide-react';

/**
 * SmartQueue ProtectedRoute Guard
 * Handles authentication status, role authorization, and initialization spinner
 */
const ProtectedRoute = ({ children, allowedRoles }) => {
  const location = useLocation();
  const { isAuthenticated, isInitialized, user } = useSelector((state) => state.auth);

  // 1. App initialization loading state
  if (!isInitialized) {
    return (
      <div className="min-h-screen bg-sq-bg flex flex-col items-center justify-center p-4 text-sq-textPrimary">
        <Loader2 className="w-10 h-10 text-sq-primary animate-spin mb-4" />
        <span className="text-sm font-semibold text-sq-textSecondary">
          Initializing SmartQueue Session...
        </span>
      </div>
    );
  }

  // 2. Unauthenticated check -> Redirect to /login
  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // 3. Role authorization check -> Redirect unauthorized user to role homepage
  if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    if (user.role === 'CUSTOMER') {
      return <Navigate to="/dashboard" replace />;
    }
    if (user.role === 'STAFF') {
      return <Navigate to="/staff" replace />;
    }
    if (user.role === 'ADMIN') {
      return <Navigate to="/admin" replace />;
    }
    return <Navigate to="/" replace />;
  }

  return children;
};

export default ProtectedRoute;
