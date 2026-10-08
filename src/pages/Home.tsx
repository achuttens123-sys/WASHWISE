import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { LogIn, UserPlus, Sparkles, Zap } from 'lucide-react';

const prefetchLogin = () => {
  // Pre-load login chunk in background
  import('./Login').catch(() => {});
};

const Home: React.FC = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Prefetch login component on idle for 0ms transition
    if ('requestIdleCallback' in window) {
      (window as any).requestIdleCallback(prefetchLogin);
    } else {
      const timer = setTimeout(prefetchLogin, 800);
      return () => clearTimeout(timer);
    }
  }, []);

  return (
    <div className="flex flex-col items-center justify-center w-full flex-1 min-h-[calc(100dvh-4rem)] max-h-[calc(100dvh-4rem)] px-3.5 sm:px-6 py-2 overflow-hidden">
      <motion.div
        initial={{ opacity: 0, y: 10, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", damping: 20 }}
        className="text-center mb-4 sm:mb-8 relative max-w-lg mx-auto w-full shrink-0"
      >
        <div className="absolute inset-0 bg-primary-electric/10 blur-3xl rounded-full -z-10 pointer-events-none" />
        
        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 sm:px-3 sm:py-1 bg-primary-electric/10 rounded-full text-primary-electric dark:text-primary-electric-light text-[9px] sm:text-xs font-black uppercase tracking-wider mb-2">
          <Zap className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
          <span>Smart Laundry Ecosystem</span>
        </div>
        <h1 className="text-3xl sm:text-5xl md:text-6xl font-display font-black text-primary-electric dark:text-primary-electric-light mb-1 tracking-tight sm:tracking-tighter uppercase leading-none">
          WASHWISE
        </h1>
        <p className="text-gray-500 dark:text-gray-400 font-medium text-[10px] sm:text-sm tracking-wide uppercase max-w-xs sm:max-w-md mx-auto leading-relaxed">
          Seamless Laundry Booking & Slot Scheduling for Students
        </p>
      </motion.div>

      {/* Login & Signup Landing Options - Compact Side-by-Side Cards (Zero Scroll) */}
      <div className="grid grid-cols-2 gap-2.5 sm:gap-6 w-full max-w-md sm:max-w-lg shrink-0">
        {/* LOG IN CARD */}
        <motion.button
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          whileHover={{ scale: 1.02, y: -2 }}
          whileTap={{ scale: 0.97 }}
          onMouseEnter={prefetchLogin}
          onTouchStart={prefetchLogin}
          onClick={() => navigate('/login?mode=login')}
          className="flex flex-col items-center justify-between p-3 sm:p-6 bg-white dark:bg-surface-container rounded-2xl sm:rounded-3xl border border-gray-100 dark:border-gray-800/60 shadow-md sm:shadow-xl shadow-black/5 dark:shadow-none transition-all group haptic-feedback relative overflow-hidden text-center h-36 sm:h-48"
        >
          <div className="w-full flex flex-col items-center">
            <div className="bg-primary-electric/10 p-2 sm:p-3.5 rounded-xl sm:rounded-2xl mb-1.5 sm:mb-4 group-hover:bg-primary-electric group-hover:text-white transition-all text-primary-electric dark:text-primary-electric-light shrink-0">
              <LogIn className="w-4 h-4 sm:w-7 sm:h-7 transition-colors" />
            </div>
            <h2 className="text-xs sm:text-xl font-display font-black text-gray-800 dark:text-high-contrast tracking-tight uppercase leading-tight">
              Log In
            </h2>
            <p className="text-[8.5px] sm:text-xs text-gray-400 dark:text-gray-500 mt-0.5 font-bold uppercase tracking-wider leading-tight line-clamp-2">
              Google, Email, Phone
            </p>
          </div>
          <div className="mt-1.5 sm:mt-4 inline-flex items-center gap-1 text-[9px] sm:text-xs font-black text-primary-electric dark:text-primary-electric-light uppercase tracking-wider group-hover:translate-x-1 transition-transform">
            <span>Sign In</span>
            <span>→</span>
          </div>
        </motion.button>

        {/* SIGN UP CARD */}
        <motion.button
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.15 }}
          whileHover={{ scale: 1.02, y: -2 }}
          whileTap={{ scale: 0.97 }}
          onMouseEnter={prefetchLogin}
          onTouchStart={prefetchLogin}
          onClick={() => navigate('/login?mode=signup')}
          className="flex flex-col items-center justify-between p-3 sm:p-6 bg-gradient-to-br from-primary-electric to-[#3323cc] rounded-2xl sm:rounded-3xl shadow-md sm:shadow-xl shadow-primary-electric/25 dark:shadow-none transition-all group haptic-feedback relative overflow-hidden text-center text-white h-36 sm:h-48"
        >
          <div className="w-full flex flex-col items-center">
            <div className="bg-white/10 p-2 sm:p-3.5 rounded-xl sm:rounded-2xl mb-1.5 sm:mb-4 group-hover:bg-white/20 transition-colors shrink-0">
              <UserPlus className="w-4 h-4 sm:w-7 sm:h-7 text-white" />
            </div>
            <div className="flex items-center gap-1 justify-center leading-tight">
              <h2 className="text-xs sm:text-xl font-display font-black tracking-tight uppercase">
                Sign Up
              </h2>
              <Sparkles className="w-3 h-3 sm:w-4 sm:h-4 text-yellow-300 animate-pulse" />
            </div>
            <p className="text-[8.5px] sm:text-xs text-primary-electric-light/80 mt-0.5 font-bold uppercase tracking-wider leading-tight line-clamp-2">
              Free in seconds
            </p>
          </div>
          <div className="mt-1.5 sm:mt-4 inline-flex items-center gap-1 text-[9px] sm:text-xs font-black text-white uppercase tracking-wider group-hover:translate-x-1 transition-transform">
            <span>Get Started</span>
            <span>→</span>
          </div>
          
          {/* Ambient Glow */}
          <div className="absolute -right-6 -bottom-6 w-20 h-20 sm:w-32 sm:h-32 bg-white/10 rounded-full blur-2xl pointer-events-none" />
        </motion.button>
      </div>
    </div>
  );
};

export default Home;
