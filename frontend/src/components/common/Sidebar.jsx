import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Search,
  Clock,
  UserCheck,
  Building2,
  MapPin,
  Briefcase,
  Monitor,
  BarChart3,
  Activity,
  Star,
  Settings,
  X,
  Layers,
  LogIn,
  UserPlus,
  History,
} from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import { setSidebarOpen } from '../../store';

/**
 * Reusable SmartQueue Navigation Sidebar & Mobile Drawer Component
 * Role-Aware navigation rendered with warm architectural palette.
 */
const Sidebar = () => {
  const location = useLocation();
  const dispatch = useDispatch();
  const isOpen = useSelector((state) => state.ui.sidebarOpen);
  const { user, isAuthenticated } = useSelector((state) => state.auth);

  const currentPath = location.pathname;

  const customerNav = [
    { label: 'Customer Portal', path: '/dashboard', icon: LayoutDashboard },
    { label: 'Discover Services', path: '/discover', icon: Search },
    { label: 'Service History', path: '/customer/history', icon: History },
    { label: 'User Profile', path: '/profile', icon: UserCheck },
  ];

  const staffNav = [
    { label: 'Staff Operational Panel', path: '/staff', icon: Monitor },
    { label: 'Service History', path: '/staff/history', icon: Clock },
    { label: 'User Profile', path: '/profile', icon: UserCheck },
  ];

  const adminNav = [
    { label: 'Live Crowd Monitor', path: '/admin/live-crowd', icon: Activity },
    { label: 'Admin Analytics', path: '/admin/analytics', icon: BarChart3 },
    { label: 'Customer Reviews', path: '/admin/reviews', icon: Star },
    { label: 'Staff Management', path: '/admin/staff', icon: UserPlus },
    { label: 'Organizations', path: '/admin', icon: Building2 },
    { label: 'Locations & Counters', path: '/admin', icon: MapPin },
    { label: 'Department Control', path: '/admin', icon: Briefcase },
    { label: 'System Settings', path: '/admin', icon: Settings },
    { label: 'User Profile', path: '/profile', icon: UserCheck },
  ];

  const guestNav = [
    { label: 'Home Page', path: '/', icon: Layers },
    { label: 'Discover Services', path: '/discover', icon: Search },
    { label: 'Sign In', path: '/login', icon: LogIn },
    { label: 'Create Account', path: '/register', icon: UserPlus },
  ];

  const renderNavSection = (title, items) => (
    <div className="mb-6">
      <h5 className="px-3 text-[10px] font-bold text-sq-primary uppercase tracking-wider mb-2">
        {title}
      </h5>
      <div className="space-y-1">
        {items.map((item, idx) => {
          const ItemIcon = item.icon;
          const isActive = currentPath === item.path;
          return (
            <Link
              key={idx}
              to={item.path}
              onClick={() => dispatch(setSidebarOpen(false))}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                isActive
                  ? 'bg-sq-primarySubtle text-sq-primary border border-sq-borderStrong shadow-md shadow-sm font-bold'
                  : 'text-sq-textSecondary hover:text-sq-textPrimary hover:bg-sq-surfaceSecondary'
              }`}
            >
              <ItemIcon className={`w-4 h-4 ${isActive ? 'text-sq-primary' : 'text-sq-muted'}`} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Drawer Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/75 backdrop-blur-sm lg:hidden transition-opacity"
          onClick={() => dispatch(setSidebarOpen(false))}
        />
      )}

      {/* Sidebar Panel */}
      <aside
        className={`fixed top-0 left-0 z-50 h-full w-64 bg-sq-surface border-r border-sq-border p-4 flex flex-col justify-between transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Top Brand Header */}
        <div>
          <div className="flex items-center justify-between px-2 mb-6 lg:mb-8">
            <Link to="/" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-sq-primary flex items-center justify-center text-white font-extrabold shadow-md">
                <Layers className="w-4 h-4" />
              </div>
              <span className="text-base font-extrabold text-sq-textPrimary">
                Smart<span className="text-sq-primary">Queue</span>
              </span>
            </Link>

            <button
              onClick={() => dispatch(setSidebarOpen(false))}
              className="lg:hidden p-1.5 text-sq-textSecondary hover:text-sq-textPrimary hover:bg-sq-surfaceSecondary rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Role-Aware Navigation Links */}
          <div className="overflow-y-auto max-h-[calc(100vh-160px)] pr-1">
            {!isAuthenticated && renderNavSection('Guest Access', guestNav)}
            {isAuthenticated && user?.role === 'CUSTOMER' && renderNavSection('Customer Navigation', customerNav)}
            {isAuthenticated && user?.role === 'STAFF' && renderNavSection('Staff Workspace', staffNav)}
            {isAuthenticated && user?.role === 'ADMIN' && renderNavSection('Admin & Platform', adminNav)}
          </div>
        </div>

        {/* Footer info tag - Professional production status */}
        <div className="pt-4 border-t border-sq-border px-2">
          <div className="p-3 bg-sq-surfaceSecondary rounded-xl border border-sq-border">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-sq-primary animate-pulse" />
              <span className="text-xs font-semibold text-sq-textPrimary">
                {isAuthenticated ? `${user?.role} Active` : 'Guest Session'}
              </span>
            </div>
            <p className="text-[10px] text-sq-muted mt-1">SmartQueue Platform v1.0</p>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
