import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { User, Mail, Phone, Shield, Calendar, LogOut, CheckCircle2 } from 'lucide-react';
import MainLayout from '../layouts/MainLayout';
import Card from '../components/common/Card';
import Badge from '../components/common/Badge';
import Button from '../components/common/Button';
import { logoutThunk } from '../store/slices/authSlice';

/**
 * SmartQueue Authenticated User Profile Page
 */
const ProfilePage = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user, isLoading } = useSelector((state) => state.auth);

  const handleLogout = async () => {
    await dispatch(logoutThunk());
    navigate('/login', { replace: true });
  };

  if (!user) return null;

  const formattedDate = user.createdAt
    ? new Date(user.createdAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : 'Recently';

  const roleVariant = {
    CUSTOMER: 'pink',
    STAFF: 'lavender',
    ADMIN: 'purple',
  };

  return (
    <MainLayout roleTitle="User Profile">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-sq-textPrimary">Account Profile</h1>
          <Badge variant={roleVariant[user.role] || 'pink'} size="lg">
            {user.role} ROLE
          </Badge>
        </div>

        <Card variant="surface" className="space-y-6">
          {/* User Header */}
          <div className="flex items-center gap-4 pb-6 border-b border-sq-border">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-[#865D36] to-[#AC8968] flex items-center justify-center text-white text-2xl font-black shadow-lg shadow-sq-warning/20">
              {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
            </div>
            <div>
              <h2 className="text-xl font-bold text-sq-textPrimary">{user.name}</h2>
              <p className="text-xs text-sq-textSecondary flex items-center gap-1 mt-0.5">
                <Mail className="w-3.5 h-3.5 text-sq-muted" /> {user.email}
              </p>
              <div className="mt-2 flex items-center gap-2">
                <Badge variant={user.isActive ? 'success' : 'danger'} size="sm" dot>
                  {user.isActive ? 'ACCOUNT ACTIVE' : 'INACTIVE'}
                </Badge>
                {user.isVerified && (
                  <Badge variant="info" size="sm">
                    VERIFIED
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {/* User Profile Attributes */}
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3.5 bg-sq-surfaceSecondary rounded-xl border border-sq-border">
              <span className="text-xs text-sq-textSecondary flex items-center gap-2">
                <User className="w-4 h-4 text-sq-textSecondary" /> Full Name
              </span>
              <span className="text-xs font-semibold text-sq-textPrimary">{user.name}</span>
            </div>

            <div className="flex items-center justify-between p-3.5 bg-sq-surfaceSecondary rounded-xl border border-sq-border">
              <span className="text-xs text-sq-textSecondary flex items-center gap-2">
                <Mail className="w-4 h-4 text-sq-textSecondary" /> Email Address
              </span>
              <span className="text-xs font-semibold text-sq-textPrimary">{user.email}</span>
            </div>

            <div className="flex items-center justify-between p-3.5 bg-sq-surfaceSecondary rounded-xl border border-sq-border">
              <span className="text-xs text-sq-textSecondary flex items-center gap-2">
                <Phone className="w-4 h-4 text-sq-textSecondary" /> Phone Number
              </span>
              <span className="text-xs font-semibold text-sq-textPrimary">
                {user.phone || 'Not provided'}
              </span>
            </div>

            <div className="flex items-center justify-between p-3.5 bg-sq-surfaceSecondary rounded-xl border border-sq-border">
              <span className="text-xs text-sq-textSecondary flex items-center gap-2">
                <Shield className="w-4 h-4 text-sq-textSecondary" /> System Role
              </span>
              <span className="text-xs font-bold text-sq-textSecondary uppercase">{user.role}</span>
            </div>

            <div className="flex items-center justify-between p-3.5 bg-sq-surfaceSecondary rounded-xl border border-sq-border">
              <span className="text-xs text-sq-textSecondary flex items-center gap-2">
                <Calendar className="w-4 h-4 text-sq-textSecondary" /> Member Since
              </span>
              <span className="text-xs font-semibold text-sq-textPrimary">{formattedDate}</span>
            </div>
          </div>

          {/* Real Logout Action */}
          <div className="pt-4 border-t border-sq-border">
            <Button
              variant="danger"
              className="w-full"
              icon={LogOut}
              onClick={handleLogout}
              isLoading={isLoading}
            >
              Sign Out Account
            </Button>
          </div>
        </Card>
      </div>
    </MainLayout>
  );
};

export default ProfilePage;
