import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Loader2, Sparkles, Info } from 'lucide-react';

const LAUNDRY_TIPS = [
  "Separate whites from colors to prevent bleeding.",
  "Turn jeans inside out to preserve their color.",
  "Use cold water for delicate fabrics to avoid shrinking.",
  "Don't overload the machine; it needs space to clean properly.",
  "Clean your lint filter after every drying cycle.",
  "Pre-treat stains as soon as possible for best results.",
  "Use the right amount of detergent; more isn't always better.",
  "Check pockets for coins or tissues before washing!",
  "Zip up zippers and hook bras to prevent snagging other clothes.",
  "Air dry your sweaters flat to keep them from stretching.",
  "Use a mesh bag for small items like socks and masks.",
  "Read the care label! It's there for a reason."
];

const LoadingScreen: React.FC = () => {
  const [tip, setTip] = useState('');

  useEffect(() => {
    setTip(LAUNDRY_TIPS[Math.floor(Math.random() * LAUNDRY_TIPS.length)]);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-950 p-6 text-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center"
      >
        <div className="relative mb-8">
          <div className="w-20 h-20 border-4 border-blue-100 dark:border-blue-900/30 rounded-full" />
          <Loader2 className="w-20 h-20 text-blue-600 dark:text-blue-500 animate-spin absolute top-0 left-0" />
          <motion.div 
            animate={{ 
              scale: [1, 1.2, 1],
              opacity: [0.5, 1, 0.5]
            }}
            transition={{ 
              duration: 2,
              repeat: Infinity
            }}
            className="absolute -top-2 -right-2 p-1.5 bg-blue-600 rounded-lg shadow-lg"
          >
            <Sparkles className="w-4 h-4 text-white" />
          </motion.div>
        </div>
        
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="max-w-sm"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 dark:bg-blue-900/20 rounded-full mb-4">
            <Info className="w-3 h-3 text-blue-600 dark:text-blue-400" />
            <p className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest">Laundry Tip</p>
          </div>
          
          <AnimatePresence mode="wait">
            <motion.p 
              key={tip}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="text-gray-800 dark:text-gray-200 text-base font-bold leading-relaxed italic tracking-tight"
            >
              "{tip}"
            </motion.p>
          </AnimatePresence>
          
          <p className="mt-8 text-[10px] font-black text-gray-400 dark:text-gray-600 uppercase tracking-[0.2em]">
            Loading WashWise...
          </p>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default LoadingScreen;
