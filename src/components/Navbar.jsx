import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { 
  Building2, 
  Menu, 
  X, 
  User, 
  LogOut, 
  LayoutDashboard, 
  FileText, 
  Boxes,
  ClipboardList
} from 'lucide-react';

export default function Navbar({ activeTab, customActions }) {
  const navigate = useNavigate();
  const { displayName } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error('Error signing out:', err);
    } finally {
      navigate('/login', { replace: true });
    }
  };

  const navLinks = [
    { id: 'dashboard', label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard },
    { id: 'quotations', label: 'Quotations', to: '/quotations', icon: ClipboardList },
    { id: 'invoices', label: 'Invoice History', to: '/invoices', icon: FileText },
    { id: 'materials', label: 'Materials', to: '/materials', icon: Boxes },
  ];

  return (
    <header className="bg-[#36454F] text-white shadow-md sticky top-0 z-40 print:hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="h-16 flex items-center justify-between gap-4">
          
          {/* Logo & Main Title (Left) */}
          <div className="flex items-center gap-4 sm:gap-6">
            <Link to="/dashboard" className="flex items-center gap-2.5 sm:gap-3 group">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#F2A104] flex items-center justify-center text-[#36454F] font-bold shadow-xs group-hover:scale-105 transition-transform shrink-0">
                <Building2 className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <div className="min-w-0">
                <h1 className="text-base sm:text-xl font-bold tracking-tight text-white font-heading truncate">
                  Krishna Engineering
                </h1>
                <span className="text-[10px] sm:text-[11px] text-[#5C7A99] font-medium tracking-wide block truncate">
                  GST Invoice Portal
                </span>
              </div>
            </Link>

            {/* Desktop Navigation Links */}
            <nav className="hidden md:flex items-center gap-1 pl-4 border-l border-white/10">
              {navLinks.map((link) => {
                const Icon = link.icon;
                const isActive = activeTab === link.id;
                return (
                  <Link
                    key={link.id}
                    to={link.to}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                      isActive
                        ? 'bg-[#F2A104] text-[#36454F]'
                        : 'text-slate-300 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{link.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Right Side Items (Desktop Actions + Mobile Toggle) */}
          <div className="flex items-center gap-2 sm:gap-3">
            
            {/* Optional Custom Action Buttons (e.g. Save Invoice or Edit/Print) */}
            {customActions && (
              <div className="hidden sm:flex items-center gap-2">
                {customActions}
              </div>
            )}

            {/* Desktop User Badge */}
            <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 text-white text-xs font-medium border border-white/10">
              <div className="w-6 h-6 rounded-full bg-[#F2A104] text-[#36454F] flex items-center justify-center font-bold shrink-0">
                <User className="w-3.5 h-3.5" />
              </div>
              <span className="font-semibold max-w-[160px] truncate" title={displayName}>
                {displayName}
              </span>
            </div>

            {/* Desktop Logout Button */}
            <button
              onClick={handleLogout}
              className="hidden md:inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-[#F2A104] text-white hover:text-[#36454F] text-xs font-bold transition-all duration-200 cursor-pointer border border-white/10 hover:border-transparent min-h-[44px]"
              title="Logout from session"
            >
              <LogOut className="w-4 h-4" />
              <span>Logout</span>
            </button>

            {/* Mobile Hamburger Menu Toggle Button */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2 rounded-xl bg-white/10 text-white hover:bg-white/20 transition-colors cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label="Toggle navigation menu"
            >
              {isMobileMenuOpen ? <X className="w-6 h-6 text-[#F2A104]" /> : <Menu className="w-6 h-6" />}
            </button>

          </div>

        </div>
      </div>

      {/* Mobile Collapsible Navigation Drawer */}
      {isMobileMenuOpen && (
        <div className="md:hidden border-t border-white/10 bg-[#36454F] px-4 pt-3 pb-4 space-y-3 animate-in slide-in-from-top-2 duration-200">
          
          {/* Mobile Links List */}
          <div className="space-y-1">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive = activeTab === link.id;
              return (
                <Link
                  key={link.id}
                  to={link.to}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-bold transition-colors min-h-[44px] ${
                    isActive
                      ? 'bg-[#F2A104] text-[#36454F]'
                      : 'text-slate-200 hover:bg-white/10'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span>{link.label}</span>
                </Link>
              );
            })}
          </div>

          {/* Mobile Custom Actions (if passed, e.g. Save/Print) */}
          {customActions && (
            <div className="pt-2 border-t border-white/10 flex flex-col gap-2 sm:hidden">
              {customActions}
            </div>
          )}

          {/* User Info & Logout Button */}
          <div className="pt-3 border-t border-white/10 flex flex-col gap-3">
            <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-white/5 text-slate-200 text-xs">
              <div className="w-7 h-7 rounded-full bg-[#F2A104] text-[#36454F] flex items-center justify-center font-bold shrink-0">
                <User className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="block text-[10px] text-[#5C7A99] font-bold uppercase tracking-wider">Logged In As</span>
                <span className="font-bold text-white truncate block">{displayName}</span>
              </div>
            </div>

            <button
              onClick={() => {
                setIsMobileMenuOpen(false);
                handleLogout();
              }}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-rose-600/90 hover:bg-rose-600 text-white text-xs font-bold transition-colors min-h-[44px] cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>Logout</span>
            </button>
          </div>

        </div>
      )}
    </header>
  );
}
