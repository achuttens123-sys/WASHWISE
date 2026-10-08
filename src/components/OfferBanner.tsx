import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Timer, FireExtinguisher as Fire, Zap, AlertCircle } from 'lucide-react';
import { format, differenceInSeconds, parseISO } from 'date-fns';

interface LimitedOffer {
  offerId: string;
  name: string;
  remainingSlots: number;
  discountType: string;
  discountValue: number;
  description: string;
  expiresAt: string;
}

export const OfferBanner: React.FC = () => {
  const [offers, setOffers] = useState<LimitedOffer[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState<number>(0);

  useEffect(() => {
    const fetchOffers = async () => {
      try {
        const response = await fetch('/api/offers/active');
        const data = await response.json();
        setOffers(data);
      } catch (error) {
        console.error('Error fetching limited offers:', error);
      }
    };

    fetchOffers();
    const interval = setInterval(fetchOffers, 30000); // Pulse every 30s
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (offers.length === 0) return;
    
    const timer = setInterval(() => {
      const activeOffer = offers[currentIndex];
      const seconds = differenceInSeconds(parseISO(activeOffer.expiresAt), new Date());
      setTimeLeft(Math.max(0, seconds));
    }, 1000);

    return () => clearInterval(timer);
  }, [offers, currentIndex]);

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h > 0 ? h + 'h ' : ''}${m}m ${s}s`;
  };

  if (offers.length === 0) return null;

  const currentOffer = offers[currentIndex];

  return (
    <div className="w-full bg-black border-y-2 sm:border-y-4 border-yellow-400 overflow-hidden relative">
      <AnimatePresence mode="wait">
        <motion.div
          key={currentOffer.offerId}
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -20, opacity: 0 }}
          className="flex items-center justify-between px-3 py-2 sm:px-6 sm:py-4 gap-2 sm:gap-4"
        >
          {/* OFFER BADGE */}
          <div className="flex items-center gap-2 sm:gap-4 min-w-0">
            <div className="bg-yellow-400 text-black px-2 py-0.5 sm:px-4 sm:py-2 rotate-[-2deg] font-black text-xs sm:text-2xl uppercase tracking-tighter shrink-0">
              FLASH {currentOffer.remainingSlots <= 5 ? 'SALE' : 'DEAL'}
            </div>
            <div className="flex flex-col min-w-0">
              <h4 className="text-white font-black text-xs sm:text-xl leading-none uppercase tracking-tight truncate">
                {currentOffer.name}
              </h4>
              <p className="text-yellow-400/80 font-mono text-[8px] sm:text-[10px] uppercase tracking-widest mt-0.5 hidden sm:block truncate">
                {currentOffer.description} • LIMITED SLOTS ONLY
              </p>
            </div>
          </div>

          {/* REAL-TIME COUNTERS */}
          <div className="flex items-center gap-3 sm:gap-8 shrink-0">
            <div className="flex items-center sm:flex-col sm:items-center gap-1 sm:gap-0">
              <span className="text-gray-500 font-mono text-[8px] sm:text-[10px] uppercase tracking-widest hidden sm:block mb-1">Slots Left</span>
              <div className="flex items-baseline gap-0.5 sm:gap-1">
                <span className={`font-black text-xs sm:text-3xl leading-none ${currentOffer.remainingSlots <= 3 ? 'text-red-500 animate-pulse' : 'text-white'}`}>
                  {currentOffer.remainingSlots}
                </span>
                <span className="text-gray-500 font-black text-[9px] sm:text-sm uppercase">/10</span>
              </div>
            </div>

            <div className="h-6 sm:h-10 w-px bg-white/10" />

            <div className="flex items-center sm:flex-col sm:items-end gap-1 sm:gap-0">
              <span className="text-gray-500 font-mono text-[8px] sm:text-[10px] uppercase tracking-widest hidden sm:block mb-1">Ends In</span>
              <div className="flex items-center gap-1 sm:gap-2 text-yellow-400 font-black text-xs sm:text-xl tabular-nums">
                <Timer className="w-3 h-3 sm:w-4 sm:h-4 shrink-0" />
                <span>{formatTime(timeLeft)}</span>
              </div>
            </div>

            <motion.button
              whileHover={{ scale: 1.05, rotate: 1 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => window.location.href = '/booking'}
              className="bg-white text-black px-4 sm:px-6 py-2 sm:py-3 font-black uppercase text-xs sm:text-sm tracking-widest hover:bg-yellow-400 transition-colors hidden md:block"
            >
              Claim
            </motion.button>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* BACKGROUND DECOR */}
      <div className="absolute top-0 right-0 w-64 h-full bg-white/5 skew-x-[-20deg] pointer-events-none" />
    </div>
  );
};
