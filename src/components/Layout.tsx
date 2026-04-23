import React from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'motion/react';
import { LogOut, User, Bell, Menu, X, ShieldCheck, Sun, Moon, FileText } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { isSuperAdminEmail } from '../constants';
import TermsModal from './TermsModal';

import NotificationCenter from './NotificationCenter';

const Layout: React.FC = () => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);
  const [showTerms, setShowTerms] = React.useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const isAuthPage = ['/', '/login'].includes(location.pathname);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 font-sans text-gray-900 dark:text-gray-100 transition-colors duration-300 flex flex-col">
      {/* Header */}
      <header className="bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 sticky top-0 z-50 w-full">
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
            className="md:hidden bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 px-4 py-6 space-y-4"
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
              onClick={() => { navigate('/profile'); setIsMenuOpen(false); }}
              className="w-full flex items-center space-x-3 p-4 bg-gray-50 dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700"
            >
              <div className="bg-blue-100 dark:bg-blue-900/30 p-2 rounded-xl">
                <User className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="text-left">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">My Account</p>
                <p className="font-bold text-gray-800 dark:text-gray-200">{user?.name}</p>
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
    </div>
  );
};

export default Layout;
