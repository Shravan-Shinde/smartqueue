import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Layers, Menu, User, LogIn, Wifi, WifiOff } from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import { toggleSidebar } from '../../store';
import NotificationBell from '../notifications/NotificationBell';
import GlobalSearch from './GlobalSearch';
import socketService from '../../services/socketService';

/**
 * Reusable SmartQueue Header Navigation Bar Component
 * Standardized Dark SaaS Visual System (#171821, #21222D, #8FAF6F)
 */
const Navbar = ({ roleTitle = 'Platform Portal' }) => {
  const dispatch = useDispatch();
  const { user, isAuthenticated } = useSelector((state) => state.auth);
  const [socketState, setSocketState] = useState(socketService.getConnectionState());

  useEffect(() => {
    const unsubscribe = socketService.onConnectionStateChange((state) => {
      setSocketState(state);
    });
    return () => unsubscribe();
  }, []);

  return (
    <header className="sticky top-0 z-40 w-full bg-sq-surface/95 backdrop-blur-md border-b border-sq-border px-4 lg:px-8 py-3 transition-all">
      <div className="flex items-center justify-between gap-4">
        {/* Left: Mobile Toggle & Brand Logo */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => dispatch(toggleSidebar())}
            className="lg:hidden p-2 text-sq-textSecondary hover:text-sq-textPrimary hover:bg-sq-surfaceSecondary rounded-xl transition-colors"
            aria-label="Toggle navigation menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-sq-primary to-sq-primaryDark p-0.5 shadow-lg  group-hover:scale-105 transition-transform flex items-center justify-center">
              <div className="w-full h-full bg-sq-bg rounded-[10px] flex items-center justify-center">
                <Layers className="w-5 h-5 text-sq-primary" />
              </div>
            </div>
            <div className="flex flex-col">
              <span className="text-lg font-extrabold text-sq-textPrimary tracking-tight leading-none">
                Smart<span className="text-sq-primary">Queue</span>
              </span>
              <span className="text-[10px] font-semibold text-sq-primary uppercase tracking-wider mt-0.5">
                {isAuthenticated ? `${user?.role} Portal` : roleTitle}
              </span>
            </div>
          </Link>
        </div>

        {/* Center: Live Global Search Bar */}
        <div className="hidden md:flex items-center flex-1 max-w-md mx-6">
          <GlobalSearch />
        </div>

        {/* Right: Socket Status, Actions & Authenticated User Display */}
        <div className="flex items-center gap-3">
          {/* Socket.IO Connection Pill */}
          <div
            className={`hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border transition-colors ${
              socketState === 'CONNECTED'
                ? 'bg-sq-primarySubtle text-sq-primary border-sq-borderStrong'
                : socketState === 'RECONNECTING'
                ? 'bg-sq-warningBg text-sq-warning border-sq-warning animate-pulse'
                : 'bg-sq-dangerBg text-sq-danger border-sq-danger'
            }`}
            title={`Real-Time Engine Status: ${socketState}`}
          >
            {socketState === 'CONNECTED' ? (
              <Wifi className="w-3.5 h-3.5" />
            ) : (
              <WifiOff className="w-3.5 h-3.5" />
            )}
            <span>{socketState}</span>
          </div>

          {isAuthenticated ? (
            <>
              {/* Customer Real-Time Notification Bell */}
              {user?.role === 'CUSTOMER' && <NotificationBell />}

              {/* Real Profile Avatar & Name */}
              <Link
                to="/profile"
                className="flex items-center gap-2.5 p-1.5 rounded-xl border border-sq-border bg-sq-surfaceSecondary hover:bg-sq-surfaceSecondary transition-colors"
              >
                <div className="w-7 h-7 rounded-lg bg-sq-primary text-white flex items-center justify-center text-xs font-extrabold shadow-md">
                  {user?.name ? user.name.charAt(0).toUpperCase() : <User className="w-4 h-4" />}
                </div>
                <div className="hidden sm:flex flex-col pr-1">
                  <span className="text-xs font-bold text-sq-textPrimary leading-none">
                    {user?.name}
                  </span>
                  <span className="text-[9px] font-bold text-sq-primary uppercase tracking-wider mt-0.5">
                    {user?.role}
                  </span>
                </div>
              </Link>
            </>
          ) : (
            <Link
              to="/login"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-extrabold bg-sq-primary text-white hover:bg-sq-primarySubtle transition-all shadow-md shadow-sm"
            >
              <LogIn className="w-4 h-4" />
              <span>Sign In</span>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
};

export default Navbar;
