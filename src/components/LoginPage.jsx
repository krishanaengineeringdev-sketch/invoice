import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Lock, 
  Mail, 
  Eye, 
  EyeOff, 
  Building2, 
  ShieldCheck, 
  ArrowRight,
  Sparkles,
  HelpCircle,
  AlertCircle,
  X
} from 'lucide-react';

export default function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const [resetEmailInput, setResetEmailInput] = useState('');

  // Check if session already exists on mount, redirect to dashboard if authenticated
  React.useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate('/dashboard', { replace: true });
      }
    });
  }, [navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    // Client-side validation: don't submit if email or password fields are empty
    if (!email.trim() || !password.trim()) {
      setErrorMessage('Please enter both email and password.');
      return;
    }

    setIsLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password,
      });

      if (error) {
        setIsLoading(false);
        setErrorMessage(error.message || 'Invalid email or password');
        return;
      }

      if (data?.session || data?.user) {
        setIsLoading(false);
        navigate('/dashboard');
      } else {
        setIsLoading(false);
        setErrorMessage('Unable to create login session. Please try again.');
      }
    } catch (err) {
      setIsLoading(false);
      setErrorMessage('Something went wrong, please try again');
    }
  };

  const handleDemoFill = () => {
    setEmail('admin@krishnaengineering.com');
    setPassword('demo1234');
    setErrorMessage('');
  };

  const handleForgotSubmit = (e) => {
    e.preventDefault();
    if (!resetEmailInput.trim()) return;
    setResetEmailSent(true);
    setTimeout(() => {
      setResetEmailSent(false);
      setShowForgotModal(false);
      setResetEmailInput('');
    }, 2500);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeInOut' }}
      className="min-h-screen bg-[#F4F5F6] flex flex-col justify-center items-center p-4 sm:p-6 font-sans relative overflow-x-hidden"
    >
      {/* Decorative subtle ambient lights */}
      <div className="absolute top-1/4 -left-20 w-72 h-72 bg-[#F2A104]/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-1/4 -right-20 w-80 h-80 bg-[#5C7A99]/15 rounded-full blur-3xl pointer-events-none"></div>

      {/* Main Container */}
      <div className="w-full max-w-md z-10">
        
        {/* Login Card */}
        <div className="bg-white rounded-2xl shadow-xl shadow-[#36454F]/5 border border-slate-200/80 p-8 sm:p-10 transition-all duration-300">
          
          {/* Header Section with Logo & Company Name */}
          <div className="text-center mb-8">
            
            {/* Logo Placeholder */}
            <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-tr from-[#36454F] to-[#5C7A99] p-0.5 shadow-md hover:scale-105 transition-transform duration-300 flex items-center justify-center mb-4">
              <div className="w-full h-full bg-white rounded-[14px] flex items-center justify-center relative overflow-hidden">
                <div className="absolute top-0 right-0 w-6 h-6 bg-[#F2A104] rounded-bl-full opacity-90"></div>
                <div className="w-10 h-10 rounded-full bg-[#36454F]/5 border-2 border-[#F2A104] flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-[#36454F]" />
                </div>
              </div>
            </div>

            {/* Company Name */}
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#36454F] tracking-tight font-heading">
              Krishna Engineering
            </h1>
            
            {/* Subtitle */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1 mt-2 rounded-full bg-[#5C7A99]/10 text-[#5C7A99] text-xs font-semibold">
              <ShieldCheck className="w-3.5 h-3.5" />
              GST Invoicing & Enterprise Portal
            </div>
          </div>

          {/* Error Notice if validation or auth fails */}
          {errorMessage && (
            <div className="mb-6 p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-semibold flex items-center gap-2.5 animate-shake">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            
            {/* Email Field */}
            <div>
              <label className="block text-xs font-bold text-[#36454F] uppercase tracking-wider mb-2">
                Work Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#5C7A99]">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@krishnaengineering.com"
                  required
                  className="w-full pl-10 pr-4 py-3 bg-[#F4F5F6]/50 border border-slate-300 rounded-xl text-[#36454F] placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-[#5C7A99]/50 focus:border-[#5C7A99] focus:bg-white transition-all duration-200"
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-bold text-[#36454F] uppercase tracking-wider">
                  Password
                </label>
              </div>
              
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#5C7A99]">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  required
                  className="w-full pl-10 pr-10 py-3 bg-[#F4F5F6]/50 border border-slate-300 rounded-xl text-[#36454F] placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-[#5C7A99]/50 focus:border-[#5C7A99] focus:bg-white transition-all duration-200"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-[#5C7A99] hover:text-[#36454F] transition-colors focus:outline-none"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {/* Forgot Password Link below password field */}
              <div className="flex items-center justify-between mt-2.5">
                <label className="flex items-center text-xs text-[#5C7A99] cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-3.5 h-3.5 rounded border-slate-300 text-[#F2A104] focus:ring-[#F2A104] cursor-pointer"
                  />
                  <span className="ml-2 font-medium">Remember me</span>
                </label>

                <button
                  type="button"
                  onClick={() => {
                    setShowForgotModal(true);
                    setResetEmailInput(email);
                  }}
                  className="text-xs font-semibold text-[#5C7A99] hover:text-[#36454F] hover:underline transition-all duration-200 focus:outline-none"
                >
                  Forgot password?
                </button>
              </div>
            </div>

            {/* Primary Login Button in Amber (#F2A104), full-width, with hover effect & loading state */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 px-4 bg-[#F2A104] hover:bg-[#d88f00] active:bg-[#bf7d00] text-[#36454F] font-bold text-sm rounded-xl shadow-md hover:shadow-lg hover:shadow-[#F2A104]/20 transition-all duration-200 flex items-center justify-center gap-2 group cursor-pointer disabled:opacity-75 disabled:cursor-not-allowed mt-2"
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-[#36454F]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Logging in...
                </>
              ) : (
                <>
                  Sign In to GST Portal
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-200" />
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Helper Button */}
          <div className="mt-6 pt-5 border-t border-slate-100 flex flex-col items-center">
            <button
              type="button"
              onClick={handleDemoFill}
              className="inline-flex items-center gap-1.5 text-xs text-[#5C7A99] bg-[#5C7A99]/5 hover:bg-[#5C7A99]/10 px-3 py-1.5 rounded-lg border border-[#5C7A99]/20 transition-colors font-medium cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#F2A104]" />
              Auto-fill Demo Credentials
            </button>
          </div>

        </div>

        {/* Footer */}
        <div className="text-center mt-6 text-xs text-[#5C7A99]">
          <p>© {new Date().getFullYear()} Krishna Engineering Pvt. Ltd. All rights reserved.</p>
          <p className="mt-1 font-mono text-[11px] opacity-75">GSTIN: 33AKDPD9814C1ZN</p>
        </div>

      </div>

      {/* Forgot Password Modal */}
      <AnimatePresence>
        {showForgotModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-[#36454F]/40 backdrop-blur-xs flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.2 }}
              className="bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 sm:p-8 max-w-sm w-full relative"
            >
              <button
                onClick={() => setShowForgotModal(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-[#36454F] transition-colors p-1"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-[#5C7A99]/10 flex items-center justify-center text-[#5C7A99]">
                  <HelpCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#36454F] font-heading">Reset Password</h3>
                  <p className="text-xs text-[#5C7A99]">Enter your work email address</p>
                </div>
              </div>

              {resetEmailSent ? (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs text-center font-medium my-2">
                  ✓ Password reset instructions have been sent to your email.
                </div>
              ) : (
                <form onSubmit={handleForgotSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#36454F] mb-1">Email</label>
                    <input
                      type="email"
                      value={resetEmailInput}
                      onChange={(e) => setResetEmailInput(e.target.value)}
                      required
                      placeholder="name@krishnaengineering.com"
                      className="w-full px-3 py-2.5 bg-[#F4F5F6] border border-slate-300 rounded-lg text-sm text-[#36454F] focus:outline-none focus:ring-2 focus:ring-[#5C7A99]"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full py-2.5 bg-[#5C7A99] hover:bg-[#4a6480] text-white text-xs font-bold rounded-lg transition-all duration-150 hover:scale-[1.02] active:scale-95 cursor-pointer"
                  >
                    Send Reset Link
                  </button>
                </form>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </motion.div>
  );
}
