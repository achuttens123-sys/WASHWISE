import React from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'motion/react';
import { LogOut, User, Bell, Menu, X, ShieldCheck, Sun, Moon, FileText, Gift, Mail, RefreshCw } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { isSuperAdminEmail } from '../constants';
import TermsModal from './TermsModal';
import ReferralModal from './ReferralModal';

import NotificationCenter from './NotificationCenter';

const Layout: React.FC = () => {
  const { user, firebaseUser, reloadUser, resendEmailVerification, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);
  const [showTerms, setShowTerms] = React.useState(false);
  const [showReferralModal, setShowReferralModal] = React.useState(false);
  const [bannerResending, setBannerResending] = React.useState(false);
  const [bannerChecking, setBannerChecking] = React.useState(false);
  const [bannerNotice, setBannerNotice] = React.useState<string | null>(null);

  const handleBannerResend = async () => {
    try {
      setBannerResending(true);
      await resendEmailVerification();
      setBannerNotice('Verification link resent! Check your inbox.');
    } catch (e: any) {
      setBannerNotice(e.message || 'Error resending email.');
    } finally {
      setBannerResending(false);
    }
  };

  const handleBannerCheck = async () => {
    try {
      setBannerChecking(true);
      const reloaded = await reloadUser();
      if (reloaded?.emailVerified) {
        setBannerNotice('Email successfully verified!');
      } else {
        setBannerNotice('Email not confirmed yet. Please check your inbox.');
      }
    } catch (e: any) {
      setBannerNotice('Failed to check status.');
    } finally {
      setBannerChecking(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const isAuthPage = ['/', '/login'].includes(location.pathname);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 font-sans text-gray-900 dark:text-gray-100 transition-colors duration-300 flex flex-col overflow-x-clip w-full max-w-full">
      {/* Sticky Navigation Bar & System Banners */}
      <div className="sticky top-0 z-50 w-full shadow-sm">
        <header className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border-b border-gray-100 dark:border-gray-800 w-full transition-colors">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16 sm:h-20">
            <motion.div 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="flex items-center cursor-pointer shrink-0" 
              onClick={() => navigate(user ? '/dashboard' : '/')}
            >
              <div className="mr-2 sm:mr-3 shrink-0">
                <img 
                  src="/logo.png" 
                  alt="WASHWISE Logo" 
                  className="w-8 h-8 sm:w-10 sm:h-10 object-contain"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    // Fallback to CSS logo if image fails to load
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                    const parent = target.parentElement;
                    if (parent) {
                      const fallback = document.createElement('div');
                      fallback.className = "bg-blue-600 p-1.5 sm:p-2 rounded-lg sm:rounded-xl shadow-lg shadow-blue-200 dark:shadow-blue-900/20";
                      fallback.innerHTML = '<div class="w-4 h-4 sm:w-6 sm:h-6 border-2 border-white rounded-md"></div>';
                      parent.appendChild(fallback);
                    }
                  }}
                />
              </div>
              <span className="text-xl sm:text-2xl font-black text-gray-800 dark:text-white tracking-tight">WASHWISE</span>
            </motion.div>

            {/* Desktop Nav */}
            <div className="hidden md:flex items-center space-x-6">
              {/* Theme Toggle Switch */}
              <div className="flex items-center space-x-3 bg-gray-100 dark:bg-gray-800 p-1 rounded-2xl border border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => theme !== 'light' && toggleTheme()}
                  className={`p-2 rounded-xl transition-all ${theme === 'light' ? 'bg-white dark:bg-gray-700 text-blue-600 shadow-sm' : 'text-gray-400 hover:text-gray-200'}`}
                >
                  <Sun className="w-4 h-4" />
                </button>
                <button
                  onClick={() => theme !== 'dark' && toggleTheme()}
                  className={`p-2 rounded-xl transition-all ${theme === 'dark' ? 'bg-white dark:bg-gray-700 text-blue-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                >
                  <Moon className="w-4 h-4" />
                </button>
              </div>

              {!isAuthPage && user && (
                <>
                  <button
                    onClick={() => setShowReferralModal(true)}
                    className="flex items-center px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider bg-gradient-to-r from-amber-500/10 to-primary-electric/10 text-primary-electric dark:text-primary-electric-light border border-primary-electric/20 hover:border-primary-electric hover:shadow-md transition-all gap-1.5"
                  >
                    <Gift className="w-4 h-4 text-amber-500" />
                    <span>Refer & Earn</span>
                  </button>

                  {/* Balance / Credits Chip */}
                  <button
                    onClick={() => navigate('/profile')}
                    className="hidden md:flex items-center gap-2 px-3.5 py-2 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200/60 dark:border-gray-700/60 hover:border-blue-300 dark:hover:border-blue-700 transition-all text-xs font-bold"
                  >
                    <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                      <span>🧺</span>
                      <span>{user?.laundryCredits ?? (user?.kilosLeft ? user.kilosLeft * 10 : 0)} Cr</span>
                    </span>
                    <span className="text-gray-300 dark:text-gray-600">•</span>
                    <span className="flex items-center gap-1 text-primary-electric dark:text-primary-electric-light">
                      <span>₹{(user?.walletBalance || 0).toFixed(0)}</span>
                    </span>
                  </button>

                  {user?.role === 'admin' || isSuperAdminEmail(user?.email) ? (
                    <button 
                      onClick={() => navigate('/admin')}
                      className={`flex items-center px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                        location.pathname === '/admin' ? 'bg-blue-600 text-white shadow-lg shadow-blue-200 dark:shadow-blue-900/20' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                      }`}
                    >
                      <ShieldCheck className="w-4 h-4 mr-2" />
                      Admin
                    </button>
                  ) : null}
                  <NotificationCenter />
                  <div className="h-8 w-px bg-gray-100 dark:bg-gray-800" />
                  <button 
                    onClick={() => navigate('/profile')}
                    className="flex items-center space-x-3 bg-gray-50 dark:bg-gray-800 px-4 py-2 rounded-2xl border border-gray-100 dark:border-gray-700 hover:border-blue-200 dark:hover:border-blue-800 transition-all"
                  >
                    <div className="bg-blue-100 dark:bg-blue-900/30 p-1.5 rounded-lg">
                      <User className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    </div>
                    <span className="text-sm font-bold text-gray-700 dark:text-gray-300">{user?.name}</span>
                  </button>
                  <button 
                    onClick={handleLogout}
                    className="flex items-center text-sm font-bold text-red-500 hover:text-red-600 transition-colors"
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    Logout
                  </button>
                </>
              )}
              
              {isAuthPage && !user && (
                <button 
                  onClick={() => navigate('/')}
                  className="text-sm font-bold text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Home
                </button>
              )}
            </div>

            {/* Mobile Menu Button */}
            <div className="md:hidden flex items-center space-x-4">
              {!isAuthPage && user && <NotificationCenter />}
              <button 
                onClick={toggleTheme}
                className="p-2 rounded-xl bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border border-gray-100 dark:border-gray-700"
              >
                {theme === 'light' ? <Moon className="w-6 h-6" /> : <Sun className="w-6 h-6" />}
              </button>
              {!isAuthPage && user && (
                <button 
                  onClick={() => setIsMenuOpen(!isMenuOpen)}
                  className="p-2 text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                >
                  {isMenuOpen ? <X className="w-8 h-8" /> : <Menu className="w-8 h-8" />}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && !isAuthPage && user && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="md:hidden bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border-b border-gray-100 dark:border-gray-800 px-4 py-6 space-y-4 max-h-[calc(100vh-5rem)] overflow-y-auto"
          >
            {user?.role === 'admin' || isSuperAdminEmail(user?.email) ? (
              <button 
                onClick={() => { navigate('/admin'); setIsMenuOpen(false); }}
                className="w-full flex items-center space-x-3 p-4 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-bold rounded-2xl border border-blue-100 dark:border-blue-900/30"
              >
                <ShieldCheck className="w-5 h-5" />
                <span>Admin Dashboard</span>
              </button>
            ) : null}
            <button 
              onClick={() => { setShowReferralModal(true); setIsMenuOpen(false); }}
              className="w-full flex items-center space-x-3 p-4 bg-gradient-to-r from-amber-500/15 via-primary-electric/10 to-indigo-500/10 text-primary-electric dark:text-primary-electric-light font-bold rounded-2xl border border-primary-electric/20"
            >
              <div className="bg-amber-100 dark:bg-amber-900/30 p-2 rounded-xl text-amber-600 dark:text-amber-400">
                <Gift className="w-5 h-5" />
              </div>
              <div className="text-left">
                <p className="text-xs font-black uppercase tracking-wider text-amber-600 dark:text-amber-400">Refer & Earn</p>
                <p className="text-xs font-bold text-gray-700 dark:text-gray-200">Invite Friends & Get Free Credits</p>
              </div>
            </button>
            <button 
              onClick={() => { navigate('/profile'); setIsMenuOpen(false); }}
              className="w-full flex items-center space-x-3 p-4 bg-gray-50 dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700"
            >
              <div className="bg-blue-100 dark:bg-blue-900/30 p-2 rounded-xl">
                <User className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="text-left">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">My Account</p>
                <p className="font-bold text-gray-800 dark:text-gray-200">{user?.name}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="px-2 py-0.5 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 text-[10px] font-black rounded-md">
                    🧺 {user?.laundryCredits ?? (user?.kilosLeft ? user.kilosLeft * 10 : 0)} Credits
                  </span>
                  <span className="px-2 py-0.5 bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 text-[10px] font-black rounded-md">
                    ₹{(user?.walletBalance || 0).toFixed(0)} Wallet
                  </span>
                </div>
              </div>
            </button>
            <button 
              onClick={() => { setShowTerms(true); setIsMenuOpen(false); }}
              className="w-full flex items-center space-x-3 p-4 bg-gray-50 dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700"
            >
              <div className="bg-gray-100 dark:bg-gray-700 p-2 rounded-xl">
                <FileText className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              </div>
              <div className="text-left">
                <p className="font-bold text-gray-800 dark:text-gray-200">Terms & Conditions</p>
              </div>
            </button>
            <button 
              onClick={handleLogout}
              className="w-full flex items-center justify-center p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 font-bold rounded-2xl"
            >
              <LogOut className="w-5 h-5 mr-2" />
              Logout
            </button>
          </motion.div>
        )}
      </header>

      {/* Email Verification Reminder Banner */}
      {!isAuthPage && user && firebaseUser && !firebaseUser.emailVerified && firebaseUser.providerData.some(p => p.providerId === 'password') && (
        <div className="bg-amber-500/10 dark:bg-amber-500/15 border-b border-amber-500/30 px-4 py-3">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5 text-amber-900 dark:text-amber-200">
              <Mail className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <span>
                Please verify your email address (<strong>{firebaseUser.email}</strong>). Check your inbox for the confirmation link.
              </span>
              {bannerNotice && (
                <span className="font-bold text-amber-700 dark:text-amber-300 ml-2">
                  • {bannerNotice}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleBannerResend}
                disabled={bannerResending}
                className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-[11px] font-black uppercase tracking-wider transition-colors shadow-sm disabled:opacity-50"
              >
                {bannerResending ? 'Sending...' : 'Resend Link'}
              </button>
              <button
                type="button"
                onClick={handleBannerCheck}
                disabled={bannerChecking}
                className="px-3 py-1.5 bg-white dark:bg-gray-800 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700 rounded-xl text-[11px] font-black uppercase tracking-wider hover:bg-amber-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
              >
                {bannerChecking ? 'Checking...' : 'Check Status'}
              </button>
            </div>
          </div>
        </div>
      )}
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8 flex-grow w-full">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="py-12 border-t border-gray-100 dark:border-gray-800 mt-auto">
        <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-gray-400 dark:text-gray-500 font-medium order-2 md:order-1">© 2026 WASHWISE. Built for students, by students.</p>
          <div className="flex items-center gap-6 order-1 md:order-2">
            <button 
              onClick={() => setShowTerms(true)}
              className="text-sm font-bold text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors flex items-center gap-2"
            >
              <FileText className="w-4 h-4" />
              Terms & Conditions
            </button>
          </div>
        </div>
      </footer>

      <TermsModal 
        isOpen={showTerms}
        onClose={() => setShowTerms(false)}
        mode="detailed"
      />

      <ReferralModal
        isOpen={showReferralModal}
        onClose={() => setShowReferralModal(false)}
      />
    </div>
  );
};

export default Layout;
