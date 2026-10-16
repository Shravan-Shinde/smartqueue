import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { Mail, Lock, User, Phone, Layers, Eye, EyeOff } from 'lucide-react';
import Card from '../components/common/Card';
import Toast from '../components/common/Toast';
import GoogleAuthButton from '../components/common/GoogleAuthButton';
import { registerThunk, googleAuthThunk, clearError } from '../store/slices/authSlice';

/**
 * SmartQueue Modern SaaS Customer Registration Page
 * Enforces role isolation (public registration ALWAYS creates CUSTOMER account)
 */
const RegisterPage = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { isAuthenticated, user, isLoading, error } = useSelector((state) => state.auth);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [clientError, setClientError] = useState('');

  // Redirect authenticated user to appropriate dashboard
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

    if (!name || !email || !password || !confirmPassword) {
      setClientError('Please fill in all required fields.');
      return;
    }

    if (name.trim().length < 2) {
      setClientError('Name must be at least 2 characters long.');
      return;
    }

    if (password.length < 8) {
      setClientError('Password must be at least 8 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setClientError('Passwords do not match.');
      return;
    }

    // MANDATORY SECURITY: Public registration ALWAYS creates CUSTOMER role
    dispatch(
      registerThunk({
        name: name.trim(),
        email: email.trim(),
        phone: phone ? phone.trim() : undefined,
        password,
      })
    );
  };

  const handleGoogleSuccess = useCallback((idToken) => {
    setClientError('');
    dispatch(clearError());
    dispatch(googleAuthThunk(idToken));
  }, [dispatch]);

  const handleGoogleError = useCallback((errorMessage) => {
    setClientError(errorMessage || 'Google registration encountered an error.');
  }, []);

  return (
    <div className="min-h-screen w-full bg-[#171821] text-white flex flex-col items-center justify-center p-4 sm:p-6 selection:bg-[#F16B99] selection:text-white">
      <div className="w-full max-w-[460px] space-y-6">
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
            Create your SmartQueue customer account
          </p>
        </div>

        {/* Error Alerts */}
        {(error || clientError) && (
          <Toast
            type="error"
            message={clientError || error}
            onClose={() => {
              setClientError('');
              dispatch(clearError());
            }}
          />
        )}

        <Card
          variant="surface"
          className="p-7 sm:p-8 space-y-5 bg-[#21222D] border border-[#282936] shadow-xl shadow-black/40 rounded-2xl"
        >
          {/* Registration Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5 text-left">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                Full Name *
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  placeholder="Alex Morgan"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  disabled={isLoading}
                  className="w-full bg-[#1D1E27] text-white placeholder-slate-500 text-sm rounded-xl border border-[#282936] pl-10 pr-4 py-2.5 transition-all duration-200 focus:outline-none focus:border-[#8F9FF5] focus:ring-1 focus:ring-[#8F9FF5] disabled:opacity-50"
                />
              </div>
            </div>

            <div className="space-y-1.5 text-left">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                Email Address *
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  placeholder="alex@example.com"
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
                Phone Number <span className="text-slate-500 lowercase">(optional)</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Phone className="w-4 h-4" />
                </div>
                <input
                  type="tel"
                  placeholder="+1 (555) 019-2834"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  disabled={isLoading}
                  className="w-full bg-[#1D1E27] text-white placeholder-slate-500 text-sm rounded-xl border border-[#282936] pl-10 pr-4 py-2.5 transition-all duration-200 focus:outline-none focus:border-[#8F9FF5] focus:ring-1 focus:ring-[#8F9FF5] disabled:opacity-50"
                />
              </div>
            </div>

            <div className="space-y-1.5 text-left">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                Password * <span className="text-slate-500 lowercase">(min. 8 characters)</span>
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

            <div className="space-y-1.5 text-left">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                Confirm Password *
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  disabled={isLoading}
                  className="w-full bg-[#1D1E27] text-white placeholder-slate-500 text-sm rounded-xl border border-[#282936] pl-10 pr-10 py-2.5 transition-all duration-200 focus:outline-none focus:border-[#8F9FF5] focus:ring-1 focus:ring-[#8F9FF5] disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                  aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 px-4 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-[#8F9FF5] to-[#B27BDD] hover:opacity-95 active:scale-[0.99] transition-all duration-200 shadow-md shadow-[#8F9FF5]/20 disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2 mt-2"
            >
              {isLoading ? (
                <span className="inline-block w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              ) : null}
              <span>Create Account</span>
            </button>
          </form>

          {/* SaaS Divider */}
          <div className="relative flex items-center justify-center py-1">
            <div className="w-full border-t border-[#282936]" />
            <span className="absolute bg-[#21222D] px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              OR SIGN UP WITH
            </span>
          </div>

          {/* Real Google Authentication */}
          <div className="w-full">
            <GoogleAuthButton
              text="signup_with"
              onSuccess={handleGoogleSuccess}
              onError={handleGoogleError}
              disabled={isLoading}
            />
          </div>
        </Card>

        {/* Link to Login Page */}
        <p className="text-center text-xs text-slate-400">
          Already have an account?{' '}
          <Link
            to="/login"
            className="text-[#8F9FF5] font-extrabold hover:text-[#B27BDD] hover:underline transition-colors"
          >
            Sign in here
          </Link>
        </p>
      </div>
    </div>
  );
};

export default RegisterPage;
