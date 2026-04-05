import React from 'react';
import { motion } from 'motion/react';
import { Loader2 } from 'lucide-react';

const LoadingScreen: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-950 p-6 text-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center"
      >
        <div className="relative mb-8">
          <div className="w-16 h-16 border-4 border-blue-100 dark:border-blue-900/30 rounded-full" />
          <Loader2 className="w-16 h-16 text-blue-600 dark:text-blue-500 animate-spin absolute top-0 left-0" />
        </div>
        
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="max-w-xs"
        >
          <p className="text-sm font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3">Loading WashWise</p>
          <p className="text-gray-600 dark:text-gray-400 text-sm font-medium leading-relaxed italic">
            "We take utmost care in handling your garments and aim to provide a reliable, hygienic, and efficient laundry experience."
          </p>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default LoadingScreen;
