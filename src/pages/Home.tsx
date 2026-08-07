import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { LogIn, UserPlus, Sparkles, Zap } from 'lucide-react';

const Home: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center min-h-[82vh] px-4 py-8">
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", damping: 18 }}
        className="text-center mb-12 sm:mb-16 relative max-w-xl mx-auto"
      >
        <div className="absolute inset-0 bg-primary-electric/10 blur-3xl rounded-full -z-10 animate-pulse-glow" />
        <img 
          src="/logo.png" 
          alt="WASHWISE Logo" 
          className="w-24 h-24 sm:w-28 sm:h-28 mx-auto mb-6 object-contain drop-shadow-[0_0_30px_rgba(79,70,229,0.3)]"
          referrerPolicy="no-referrer"
          onError={(e) => (e.target as HTMLImageElement).style.display = 'none'}
        />
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary-electric/10 rounded-full text-primary-electric dark:text-primary-electric-light text-xs font-black uppercase tracking-widest mb-4">
          <Zap className="w-3.5 h-3.5" />
          <span>Smart Laundry Ecosystem</span>
        </div>
        <h1 className="text-5xl sm:text-6xl md:text-7xl font-display font-black text-primary-electric dark:text-primary-electric-light mb-4 tracking-tighter uppercase">
          WASHWISE
        </h1>
        <p className="text-gray-500 dark:text-gray-400 font-medium text-base sm:text-lg tracking-wide uppercase">
          Seamless Laundry Booking & Slot Scheduling for Students
        </p>
      </motion.div>

      {/* Login & Signup Landing Options */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 w-full max-w-2xl">
        {/* LOG IN CARD */}
        <motion.button
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.15 }}
          whileHover={{ scale: 1.02, y: -4 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => navigate('/login?mode=login')}
          className="flex flex-col items-center justify-center p-8 sm:p-10 bg-white dark:bg-surface-container rounded-3xl border border-gray-100 dark:border-gray-800/60 shadow-2xl shadow-black/5 dark:shadow-none transition-all group haptic-feedback relative overflow-hidden text-center"
        >
          <div className="bg-primary-electric/10 p-5 rounded-2xl mb-6 group-hover:bg-primary-electric group-hover:text-white transition-all text-primary-electric dark:text-primary-electric-light">
            <LogIn className="w-10 h-10 transition-colors" />
          </div>
          <h2 className="text-2xl font-display font-black text-gray-800 dark:text-high-contrast tracking-tight uppercase">
            Log In
          </h2>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-2 font-bold uppercase tracking-widest leading-relaxed">
            Access your account via Google, Email, or Phone
          </p>
          <div className="mt-6 inline-flex items-center gap-1.5 text-xs font-black text-primary-electric dark:text-primary-electric-light uppercase tracking-wider group-hover:translate-x-1 transition-transform">
            <span>Continue to Sign In</span>
            <span>→</span>
          </div>
        </motion.button>

        {/* SIGN UP CARD */}
        <motion.button
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.25 }}
          whileHover={{ scale: 1.02, y: -4 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => navigate('/login?mode=signup')}
          className="flex flex-col items-center justify-center p-8 sm:p-10 bg-gradient-to-br from-primary-electric to-[#3323cc] rounded-3xl shadow-2xl shadow-primary-electric/25 dark:shadow-none transition-all group haptic-feedback relative overflow-hidden text-center text-white"
        >
          <div className="bg-white/10 p-5 rounded-2xl mb-6 group-hover:bg-white/20 transition-colors">
            <UserPlus className="w-10 h-10 text-white" />
          </div>
          <div className="flex items-center gap-2 justify-center mb-1">
            <h2 className="text-2xl font-display font-black tracking-tight uppercase">
              Sign Up
            </h2>
            <Sparkles className="w-5 h-5 text-yellow-300 animate-pulse" />
          </div>
          <p className="text-xs text-primary-electric-light/80 font-bold uppercase tracking-widest leading-relaxed">
            Create a new WashWise account in seconds
          </p>
          <div className="mt-6 inline-flex items-center gap-1.5 text-xs font-black text-white uppercase tracking-wider group-hover:translate-x-1 transition-transform">
            <span>Get Started Free</span>
            <span>→</span>
          </div>
          
          {/* Ambient Glow */}
          <div className="absolute -right-6 -bottom-6 w-32 h-32 bg-white/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700" />
        </motion.button>
      </div>
    </div>
  );
};

export default Home;
