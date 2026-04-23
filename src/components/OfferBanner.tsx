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
    <div className="w-full bg-black border-y-4 border-yellow-400 overflow-hidden relative">
      <AnimatePresence mode="wait">
        <motion.div
          key={currentOffer.offerId}
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -50, opacity: 0 }}
          className="flex flex-col md:flex-row items-center justify-between px-6 py-4 gap-4"
        >
          {/* BRUTALIST OFFER BADGE */}
          <div className="flex items-center gap-4">
            <div className="bg-yellow-400 text-black px-4 py-2 rotate-[-2deg] font-black text-2xl uppercase tracking-tighter">
              FLASH {currentOffer.remainingSlots <= 5 ? 'URGENT' : 'SALE'}
            </div>
            <div className="flex flex-col">
              <h4 className="text-white font-black text-xl leading-none uppercase tracking-tight">
                {currentOffer.name}
              </h4>
              <p className="text-yellow-400/80 font-mono text-[10px] uppercase tracking-widest mt-1">
                {currentOffer.description} • LIMITED SLOTS ONLY
              </p>
            </div>
          </div>

          {/* REAL-TIME COUNTERS */}
          <div className="flex items-center gap-8">
            <div className="flex flex-col items-center">
              <span className="text-gray-500 font-mono text-[10px] uppercase tracking-widest mb-1">Slots Left</span>
              <div className="flex items-baseline gap-1">
                <span className={`font-black text-3xl leading-none ${currentOffer.remainingSlots <= 3 ? 'text-red-500 animate-pulse' : 'text-white'}`}>
                  {currentOffer.remainingSlots}
                </span>
                <span className="text-gray-600 font-black text-sm uppercase">/ 10</span>
              </div>
            </div>

            <div className="h-10 w-px bg-white/10 hidden md:block" />

            <div className="flex flex-col items-end">
              <span className="text-gray-500 font-mono text-[10px] uppercase tracking-widest mb-1">Ends In</span>
              <div className="flex items-center gap-2 text-yellow-400 font-black text-xl tabular-nums">
                <Timer className="w-4 h-4" />
                {formatTime(timeLeft)}
              </div>
            </div>

            <motion.button
              whileHover={{ scale: 1.05, rotate: 1 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => window.location.href = '/booking'}
              className="bg-white text-black px-6 py-3 font-black uppercase text-sm tracking-widest hover:bg-yellow-400 transition-colors hidden lg:block"
            >
              Claim Special Offer
            </motion.button>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* BACKGROUND DECOR */}
      <div className="absolute top-0 right-0 w-64 h-full bg-white/5 skew-x-[-20deg] pointer-events-none" />
    </div>
  );
};
