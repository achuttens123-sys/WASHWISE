import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { LogIn, UserPlus, Sparkles, Zap, ArrowRight, ShieldCheck, Clock, CreditCard, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const prefetchRoutes = () => {
  // Pre-load essential chunks in background for zero-latency instant transitions
  import('./Login').catch(() => {});
  import('./Dashboard').catch(() => {});
  import('./BookingDetails').catch(() => {});
};

const Home: React.FC = () => {
  const navigate = useNavigate();
  const { user, loading, isAdmin } = useAuth();

  // If already logged in on this device, immediately forward to user dashboard
  useEffect(() => {
    if (!loading && user) {
      if (isAdmin || user.adminRole || user.role === 'admin') {
        navigate('/admin', { replace: true });
      } else {
        navigate('/dashboard', { replace: true });
      }
    }
  }, [user, loading, isAdmin, navigate]);

  useEffect(() => {
    // Prefetch login & booking components on idle for 0ms transition
    if ('requestIdleCallback' in window) {
      (window as any).requestIdleCallback(prefetchRoutes);
    } else {
      const timer = setTimeout(prefetchRoutes, 500);
      return () => clearTimeout(timer);
    }
  }, []);

  // If user is already authenticated on this device, show smooth transition rather than login/signup cards
  if (user) {
    return (
      <div className="flex flex-col items-center justify-center w-full flex-1 h-[calc(100dvh-4rem)] sm:h-[calc(100dvh-5rem)] px-4 select-none">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center justify-center space-y-4 text-center max-w-sm w-full p-8 bg-white dark:bg-gray-900 rounded-[2.5rem] border border-gray-100 dark:border-gray-800 shadow-xl shadow-blue-500/5"
        >
          <div className="w-16 h-16 rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center animate-pulse">
            <Zap className="w-8 h-8" />
          </div>
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-full text-[10px] font-black uppercase tracking-wider mb-2">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Device Authenticated</span>
            </div>
            <h2 className="text-xl font-display font-black text-gray-900 dark:text-white uppercase tracking-tight">
              Welcome back{user.name ? `, ${user.name.split(' ')[0]}` : ''}!
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Resuming your session...
            </p>
          </div>
          <button
            onClick={() => navigate(isAdmin ? '/admin' : '/dashboard', { replace: true })}
            className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-md shadow-blue-500/20 transition-all hover:scale-102"
          >
            <span>Open Dashboard</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center w-full flex-1 h-[calc(100dvh-4rem)] sm:h-[calc(100dvh-5rem)] max-h-[calc(100dvh-4rem)] sm:max-h-[calc(100dvh-5rem)] px-3.5 sm:px-6 overflow-hidden relative select-none">
      {/* Background ambient radial glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 sm:w-96 h-80 sm:h-96 bg-primary-electric/10 blur-3xl rounded-full pointer-events-none -z-10" />

      {/* Central Hero Block: Perfectly Centered around the Login & Sign Up Boxes */}
      <div className="w-full max-w-md sm:max-w-lg flex flex-col items-center justify-center z-10 -translate-y-8 sm:-translate-y-10 md:-translate-y-12">
        
        {/* WASHWISE Header: Directly above the cards */}
        <motion.div
          initial={{ opacity: 0, y: -10, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: "spring", damping: 22 }}
          className="text-center mb-3 sm:mb-4 w-full"
        >
          <div className="inline-flex items-center gap-1.5 px-3 py-0.5 sm:py-1 bg-primary-electric/10 rounded-full text-primary-electric dark:text-primary-electric-light text-[10px] sm:text-xs font-black uppercase tracking-wider mb-1.5 sm:mb-2">
            <Zap className="w-3.5 h-3.5" />
            <span>Smart Laundry Ecosystem</span>
          </div>

          <h1 className="text-3xl sm:text-5xl md:text-6xl font-display font-black text-primary-electric dark:text-primary-electric-light tracking-tight sm:tracking-tighter uppercase leading-none">
            WASHWISE
          </h1>

          <p className="text-gray-500 dark:text-gray-400 font-medium text-[11px] sm:text-sm tracking-wide uppercase max-w-xs sm:max-w-md mx-auto mt-1 leading-snug">
            Seamless Laundry Booking & Slot Scheduling for Students
          </p>
        </motion.div>

        {/* Login & Sign Up Cards Grid */}
        <div className="grid grid-cols-2 gap-3 sm:gap-5 w-full">
          {/* LOG IN CARD */}
          <motion.button
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.08 }}
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.97 }}
            onMouseEnter={prefetchRoutes}
            onTouchStart={prefetchRoutes}
            onClick={() => navigate('/login?mode=login')}
            className="flex flex-col items-center justify-between p-3.5 sm:p-5 bg-white dark:bg-surface-container rounded-2xl sm:rounded-3xl border border-gray-100 dark:border-gray-800/60 shadow-md sm:shadow-xl shadow-black/5 dark:shadow-none transition-all group haptic-feedback relative overflow-hidden text-center h-[9.75rem] sm:h-48"
          >
            <div className="w-full flex flex-col items-center">
              <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl bg-primary-electric/10 flex items-center justify-center mb-2 sm:mb-3 group-hover:bg-primary-electric group-hover:text-white transition-all text-primary-electric dark:text-primary-electric-light shrink-0">
                <LogIn className="w-5 h-5 sm:w-7 sm:h-7 transition-colors" />
              </div>
              <h2 className="text-xs sm:text-xl font-display font-black text-gray-800 dark:text-high-contrast tracking-tight uppercase leading-snug">
                Log In
              </h2>
              <p className="text-[9.5px] sm:text-xs text-gray-400 dark:text-gray-500 mt-0.5 font-bold uppercase tracking-wider leading-tight truncate w-full px-1">
                Google • Email • Phone
              </p>
            </div>
            <div className="mt-2 sm:mt-4 inline-flex items-center gap-1 text-[10px] sm:text-xs font-black text-primary-electric dark:text-primary-electric-light uppercase tracking-wider group-hover:translate-x-1 transition-transform">
              <span>Sign In</span>
              <ArrowRight className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            </div>
          </motion.button>

          {/* SIGN UP CARD */}
          <motion.button
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.12 }}
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.97 }}
            onMouseEnter={prefetchRoutes}
            onTouchStart={prefetchRoutes}
            onClick={() => navigate('/login?mode=signup')}
            className="flex flex-col items-center justify-between p-3.5 sm:p-5 bg-gradient-to-br from-primary-electric to-[#3323cc] rounded-2xl sm:rounded-3xl shadow-md sm:shadow-xl shadow-primary-electric/25 dark:shadow-none transition-all group haptic-feedback relative overflow-hidden text-center text-white h-[9.75rem] sm:h-48"
          >
            <div className="w-full flex flex-col items-center">
              <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl bg-white/10 flex items-center justify-center mb-2 sm:mb-3 group-hover:bg-white/20 transition-colors shrink-0">
                <UserPlus className="w-5 h-5 sm:w-7 sm:h-7 text-white" />
              </div>
              <div className="flex items-center gap-1 justify-center leading-snug">
                <h2 className="text-xs sm:text-xl font-display font-black tracking-tight uppercase">
                  Sign Up
                </h2>
                <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-yellow-300 animate-pulse shrink-0" />
              </div>
              <p className="text-[9.5px] sm:text-xs text-primary-electric-light/90 mt-0.5 font-bold uppercase tracking-wider leading-tight truncate w-full px-1">
                Free In Seconds
              </p>
            </div>
            <div className="mt-2 sm:mt-4 inline-flex items-center gap-1 text-[10px] sm:text-xs font-black text-white uppercase tracking-wider group-hover:translate-x-1 transition-transform">
              <span>Get Started</span>
              <ArrowRight className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            </div>
            
            {/* Ambient Glow */}
            <div className="absolute -right-6 -bottom-6 w-20 h-20 sm:w-32 sm:h-32 bg-white/10 rounded-full blur-2xl pointer-events-none" />
          </motion.button>
        </div>

        {/* Feature Highlights beneath boxes - Clean SVG icons, no emojis */}
        <div className="w-full text-center mt-3.5 sm:mt-5">
          <div className="inline-flex items-center justify-center gap-2 sm:gap-4 text-[9.5px] sm:text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
            <span className="flex items-center gap-1">
              <Zap className="w-3 h-3 text-amber-500" /> Instant Slots
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3 text-blue-500" /> Live Status
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <CreditCard className="w-3 h-3 text-emerald-500" /> Campus Wallet
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
