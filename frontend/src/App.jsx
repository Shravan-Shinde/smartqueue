import React, { useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { fetchMeThunk } from './store/slices/authSlice';

import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import CustomerDashboard from './pages/CustomerDashboard';
import OrganizationDetailsPage from './pages/OrganizationDetailsPage';
import QueuePreviewPage from './pages/QueuePreviewPage';
import StaffDashboard from './pages/StaffDashboard';
import StaffHistoryPage from './pages/StaffHistoryPage';
import AdminDashboard from './pages/AdminDashboard';
import AdminStaffPage from './pages/AdminStaffPage';
import ProfilePage from './pages/ProfilePage';
import CustomerHistoryPage from './pages/CustomerHistoryPage';
import DiscoverServicesPage from './pages/DiscoverServicesPage';
import ProtectedRoute from './components/auth/ProtectedRoute';
import SkeletonLoader from './components/common/SkeletonLoader';

// Code-split heavy admin modules to reduce initial JavaScript bundle size
const AdminAnalyticsPage = React.lazy(() => import('./pages/AdminAnalyticsPage'));
const AdminLiveCrowdPage = React.lazy(() => import('./pages/AdminLiveCrowdPage'));
const AdminReviewPage = React.lazy(() => import('./pages/AdminReviewPage'));

/**
 * SmartQueue Main Application Router
 */
function App() {
  const dispatch = useDispatch();

  // Initialize authentication session from HTTP-only cookie on app mount
  useEffect(() => {
    dispatch(fetchMeThunk());
  }, [dispatch]);

  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/discover" element={<DiscoverServicesPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/queue/:id" element={<QueuePreviewPage />} />

      {/* Organization Discovery & Details Routes */}
      <Route path="/organizations/:organizationId" element={<OrganizationDetailsPage />} />

      {/* Protected Routes (Customer / Staff / Admin) */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute allowedRoles={['CUSTOMER', 'STAFF', 'ADMIN']}>
            <CustomerDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile"
        element={
          <ProtectedRoute allowedRoles={['CUSTOMER', 'STAFF', 'ADMIN']}>
            <ProfilePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/customer/history"
        element={
          <ProtectedRoute allowedRoles={['CUSTOMER']}>
            <CustomerHistoryPage />
          </ProtectedRoute>
        }
      />

      {/* Staff-Only Protected Routes */}
      <Route
        path="/staff"
        element={
          <ProtectedRoute allowedRoles={['STAFF']}>
            <StaffDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/staff/history"
        element={
          <ProtectedRoute allowedRoles={['STAFF']}>
            <StaffHistoryPage />
          </ProtectedRoute>
        }
      />

      {/* Admin-Only Protected Routes */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute allowedRoles={['ADMIN']}>
            <AdminDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/staff"
        element={
          <ProtectedRoute allowedRoles={['ADMIN']}>
            <AdminStaffPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/analytics"
        element={
          <ProtectedRoute allowedRoles={['ADMIN']}>
            <React.Suspense fallback={<div className="min-h-screen bg-sq-bg p-8 text-center text-sq-textSecondary animate-pulse">Loading Analytics Dashboard...</div>}>
              <AdminAnalyticsPage />
            </React.Suspense>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/live-crowd"
        element={
          <ProtectedRoute allowedRoles={['ADMIN']}>
            <React.Suspense fallback={<div className="min-h-screen bg-sq-bg p-8 text-center text-sq-textSecondary animate-pulse">Loading Live Crowd Dashboard...</div>}>
              <AdminLiveCrowdPage />
            </React.Suspense>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/reviews"
        element={
          <ProtectedRoute allowedRoles={['ADMIN']}>
            <React.Suspense fallback={<div className="min-h-screen bg-sq-bg p-8 text-center text-sq-textSecondary animate-pulse">Loading Reviews Dashboard...</div>}>
              <AdminReviewPage />
            </React.Suspense>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

export default App;
