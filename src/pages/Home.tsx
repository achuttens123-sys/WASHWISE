import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { UserCircle, UserCheck } from 'lucide-react';

const Home: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] px-4">
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", damping: 15 }}
        className="text-center mb-16 relative"
      >
        <div className="absolute inset-0 bg-primary-electric/10 blur-3xl rounded-full -z-10 animate-pulse-glow" />
        <img 
          src="/logo.png" 
          alt="WASHWISE Logo" 
          className="w-28 h-28 mx-auto mb-8 object-contain drop-shadow-[0_0_30px_rgba(79,70,229,0.3)]"
          referrerPolicy="no-referrer"
          onError={(e) => (e.target as HTMLImageElement).style.display = 'none'}
        />
        <h1 className="text-6xl md:text-7xl font-display font-black text-primary-electric dark:text-primary-electric-light mb-4 tracking-tighter uppercase">WASHWISE</h1>
        <p className="text-gray-500 dark:text-gray-400 font-medium text-lg tracking-wide uppercase">Smart laundry booking for students</p>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-2xl">
        <motion.button
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          whileHover={{ scale: 1.02, y: -4 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => navigate('/login?type=guest')}
          className="flex flex-col items-center justify-center p-10 bg-white dark:bg-surface-container rounded-2xl shadow-2xl shadow-black/5 dark:shadow-none transition-all group haptic-feedback relative overflow-hidden"
        >
          <div className="bg-gray-50 dark:bg-surface-highest p-5 rounded-2xl mb-6 group-hover:bg-gray-100 dark:group-hover:bg-primary-electric/10 transition-colors">
            <UserCircle className="w-12 h-12 text-gray-400 dark:text-gray-500 group-hover:text-primary-electric transition-colors" />
          </div>
          <h2 className="text-2xl font-display font-black text-gray-800 dark:text-high-contrast tracking-tight uppercase">Guest Login</h2>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-2 font-medium uppercase tracking-widest">Quick one-time booking</p>
        </motion.button>

        <motion.button
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
          whileHover={{ scale: 1.02, y: -4 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => navigate('/login?type=subscriber')}
          className="flex flex-col items-center justify-center p-10 bg-gradient-to-br from-primary-electric to-[#3323cc] rounded-2xl shadow-2xl shadow-primary-electric/20 dark:shadow-none transition-all group haptic-feedback relative overflow-hidden"
        >
          <div className="bg-white/10 p-5 rounded-2xl mb-6 group-hover:bg-white/20 transition-colors">
            <UserCheck className="w-12 h-12 text-white" />
          </div>
          <h2 className="text-2xl font-display font-black text-white tracking-tight uppercase">Subscriber Login</h2>
          <p className="text-sm text-primary-electric-light/80 mt-2 font-medium uppercase tracking-widest">Manage your plan</p>
          
          {/* Ambient Glow */}
          <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-white/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700" />
        </motion.button>
      </div>
    </div>
  );
};

export default Home;
