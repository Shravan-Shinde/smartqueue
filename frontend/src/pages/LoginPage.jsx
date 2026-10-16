import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { Mail, Lock, Layers, Eye, EyeOff } from 'lucide-react';
import Card from '../components/common/Card';
import Input from '../components/common/Input';
import Button from '../components/common/Button';
import Toast from '../components/common/Toast';
import GoogleAuthButton from '../components/common/GoogleAuthButton';
import { loginThunk, googleAuthThunk, clearError } from '../store/slices/authSlice';

/**
 * SmartQueue Modern SaaS Login Page
 * Supports secure Email/Password & Google Identity Services Authentication with HTTP-only JWT
 */
const LoginPage = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { isAuthenticated, user, isLoading, error } = useSelector((state) => state.auth);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [clientError, setClientError] = useState('');

  // Role-based redirection after successful authentication
  useEffect(() => {
    if (isAuthenticated && user) {
      if (user.role === 'STAFF') {
        navigate('/staff', { replace: true });
      } else if (user.role === 'ADMIN') {
        navigate('/admin', { replace: true });
      } else {
        navigate('/dashboard', { replace: true });
      }
    }
  }, [isAuthenticated, user, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setClientError('');
    dispatch(clearError());

    if (!email || !password) {
      setClientError('Please enter both email address and password.');
      return;
    }

    dispatch(loginThunk({ email, password }));
  };

  const handleGoogleSuccess = useCallback((idToken) => {
    setClientError('');
    dispatch(clearError());
    dispatch(googleAuthThunk(idToken));
  }, [dispatch]);

  const handleGoogleError = useCallback((errorMessage) => {
    setClientError(errorMessage || 'Google authentication encountered an error.');
  }, []);

  const handleQuickLogin = (demoEmail, demoPassword = 'Demo@12345') => {
    setEmail(demoEmail);
    setPassword(demoPassword);
    setClientError('');
    dispatch(clearError());
    dispatch(loginThunk({ email: demoEmail, password: demoPassword }));
  };

  const isDemoEnabled = import.meta.env.DEV || import.meta.env.VITE_ENABLE_DEMO_LOGIN === 'true';

  const isRateLimited =
    error &&
    (error.toLowerCase().includes('too many') ||
      error.toLowerCase().includes('rate limit') ||
      error.toLowerCase().includes('lockout') ||
      error.includes('429'));

  return (
    <div className="min-h-screen w-full bg-[#171821] text-white flex flex-col items-center justify-center p-4 sm:p-6 selection:bg-[#F16B99] selection:text-white">
      <div className="w-full max-w-[440px] space-y-6">
        {/* SmartQueue Brand Header */}
        <div className="text-center space-y-2">
          <Link to="/" className="inline-flex items-center gap-2.5 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#8F9FF5] to-[#B27BDD] p-0.5 shadow-lg shadow-[#8F9FF5]/10 flex items-center justify-center transition-transform group-hover:scale-105">
              <div className="w-full h-full bg-[#1D1E27] rounded-[10px] flex items-center justify-center">
                <Layers className="w-5 h-5 text-[#8F9FF5]" />
              </div>
            </div>
            <span className="text-2xl font-extrabold text-white tracking-tight">
              Smart<span className="text-[#8F9FF5]">Queue</span>
            </span>
          </Link>
          <p className="text-xs text-[#8F9FF5]/80 font-medium">
            Sign in to access your platform account
          </p>
        </div>

        {/* Server & Client Error Alerts */}
        {(error || clientError) && (
          <div className="space-y-2">
            {isRateLimited ? (
              <div className="p-4 bg-[#C74646]/10 border border-[#C74646]/30 rounded-xl space-y-1 text-left">
                <h4 className="text-xs font-bold text-[#F16B99] uppercase tracking-wider">
                  ⚠️ Temporary Security Lockout (Rate Limited)
                </h4>
                <p className="text-xs text-slate-200 leading-relaxed">
                  Too many sign-in attempts detected. To protect your account, authentication is temporarily locked.
                </p>
                <p className="text-[11px] text-slate-400 font-semibold pt-1">
                  Please wait 15 minutes before attempting to log in again.
                </p>
              </div>
            ) : (
              <Toast
                type="error"
                message={clientError || error}
                onClose={() => {
                  setClientError('');
                  dispatch(clearError());
                }}
              />
            )}
          </div>
        )}

        <Card
          variant="surface"
          className="p-7 sm:p-8 space-y-5 bg-[#21222D] border border-[#282936] shadow-xl shadow-black/40 rounded-2xl"
        >
          {/* Quick Demo Login Chips (Only in development or demo mode) */}
          {isDemoEnabled && (
            <div className="space-y-2 bg-[#1D1E27] p-3 rounded-xl border border-[#282936]">
              <span className="text-[11px] font-bold text-[#8F9FF5] uppercase tracking-wider block text-center">
                ⚡ Development Demo Access
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => handleQuickLogin('demo.customer@smartqueue.local')}
                  className="px-3 py-1.5 bg-[#21222D] hover:bg-[#8F9FF5]/10 hover:text-[#8F9FF5] text-slate-200 rounded-lg text-xs font-bold transition-all border border-[#282936] text-center flex items-center justify-center gap-1.5 w-full"
                >
                  👤 Customer
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickLogin('demo.staff@smartqueue.local')}
                  className="px-3 py-1.5 bg-[#21222D] hover:bg-[#8F9FF5]/10 hover:text-[#8F9FF5] text-slate-200 rounded-lg text-xs font-bold transition-all border border-[#282936] text-center flex items-center justify-center gap-1.5 w-full"
                >
                  👨‍💼 Staff
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickLogin('demo.admin@smartqueue.local')}
                  className="px-3 py-1.5 bg-[#21222D] hover:bg-[#8F9FF5]/10 hover:text-[#8F9FF5] text-slate-200 rounded-lg text-xs font-bold transition-all border border-[#282936] text-center flex items-center justify-center gap-1.5 w-full"
                >
                  👑 Admin
                </button>
              </div>
            </div>
          )}

          {/* Email & Password Authentication Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5 text-left">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  placeholder="user@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={isLoading}
                  className="w-full bg-[#1D1E27] text-white placeholder-slate-500 text-sm rounded-xl border border-[#282936] pl-10 pr-4 py-2.5 transition-all duration-200 focus:outline-none focus:border-[#8F9FF5] focus:ring-1 focus:ring-[#8F9FF5] disabled:opacity-50"
                />
              </div>
            </div>

            <div className="space-y-1.5 text-left">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isLoading}
                  className="w-full bg-[#1D1E27] text-white placeholder-slate-500 text-sm rounded-xl border border-[#282936] pl-10 pr-10 py-2.5 transition-all duration-200 focus:outline-none focus:border-[#8F9FF5] focus:ring-1 focus:ring-[#8F9FF5] disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs pt-1">
              <label className="flex items-center gap-2 cursor-pointer text-slate-300 select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded border-[#282936] bg-[#1D1E27] text-[#8F9FF5] focus:ring-[#8F9FF5]"
                />
                <span>Remember me</span>
              </label>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 px-4 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-[#8F9FF5] to-[#B27BDD] hover:opacity-95 active:scale-[0.99] transition-all duration-200 shadow-md shadow-[#8F9FF5]/20 disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <span className="inline-block w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              ) : null}
              <span>Sign In</span>
            </button>
          </form>

          {/* SaaS Divider */}
          <div className="relative flex items-center justify-center py-1">
            <div className="w-full border-t border-[#282936]" />
            <span className="absolute bg-[#21222D] px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              OR CONTINUE WITH
            </span>
          </div>

          {/* Real Google Authentication */}
          <div className="w-full">
            <GoogleAuthButton
              text="continue_with"
              onSuccess={handleGoogleSuccess}
              onError={handleGoogleError}
              disabled={isLoading}
            />
          </div>
        </Card>

        {/* Link to Registration Page */}
        <p className="text-center text-xs text-slate-400">
          Don't have an account?{' '}
          <Link
            to="/register"
            className="text-[#8F9FF5] font-extrabold hover:text-[#B27BDD] hover:underline transition-colors"
          >
            Register here
          </Link>
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
