import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Calendar, Clock, CheckCircle2, XCircle, ChevronRight, Loader2, CalendarDays, Circle, FileText, Zap, MessageSquare, Info, Sparkles, AlertCircle, Wallet, Gift, ArrowRight, Award, Coins } from 'lucide-react';
import { collection, query, where, getDocs, doc, getDoc, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { TIME_SLOTS, Slot, Booking, Store, Machine, isMachineAvailableOnDate, checkIsSubscriber } from '../types';
import { format, addDays, isSameDay } from 'date-fns';
import TermsModal from '../components/TermsModal';
import { OfferBanner } from '../components/OfferBanner';
import { ReferralCard } from '../components/ReferralCard';

const LAUNDRY_TIPS = [
  "Separate whites from colors to prevent bleeding.",
  "Turn jeans inside out to preserve their color.",
  "Use cold water for delicate fabrics to avoid shrinking.",
  "Don't overload the machine; it needs space to clean properly.",
  "Clean your lint filter after every drying cycle.",
  "Pre-treat stains as soon as possible for best results.",
  "Use the right amount of detergent; more isn't always better.",
  "Check pockets for coins or tissues before washing!"
];

// Module-level cache for instant date-switching and zero-latency slot renders
const slotsMemoryCache = new Map<string, { data: Record<string, Slot>; timestamp: number }>();

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { settings } = useSettings();
  
  const isSubscriber = checkIsSubscriber(user);
  const isOfferActive = settings?.pricing?.limited_time_offer !== false;
  const standardRatePerKg = isOfferActive
    ? (settings?.pricing?.offer_price_per_kg ?? settings?.pricing?.pricePerKg ?? 39)
    : (settings?.pricing?.regular_price_per_kg ?? 69);
  const minWashKg = 4; // standard base wash load (1-4 kg)
  const standardWashPrice = minWashKg * standardRatePerKg; // 4 * 39 = 156
  const standardWashCredits = minWashKg * 10; // 40 credits
  const userCredits = Number(user?.laundryCredits ?? ((user?.kilosLeft || 0) * 10));
  const hasCredits = userCredits >= standardWashCredits;
  
  const [view, setView] = useState<'today' | 'advance'>('today');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [slotsData, setSlotsData] = useState<Record<string, Slot>>({});
  const [loading, setLoading] = useState(true);
  const [activeBookings, setActiveBookings] = useState<Booking[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [showTerms, setShowTerms] = useState(false);
  const [dailyTip, setDailyTip] = useState('');

  useEffect(() => {
    setDailyTip(LAUNDRY_TIPS[Math.floor(Math.random() * LAUNDRY_TIPS.length)]);
  }, []);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 17) return "Good Afternoon";
    return "Good Evening";
  };

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'bookings'),
      where('userId', '==', user.uid),
      where('status', 'not-in', ['completed', 'rejected']),
      orderBy('status'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const todayStr = format(new Date(), 'yyyy-MM-dd');
      const bookings = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Booking[];
      
      // Filter out bookings that are in the past and have terminal or near-terminal statuses
      const filteredBookings = bookings.filter(b => {
        const isPast = b.date < todayStr;
        const isNearTerminal = ['Washing completed', 'Ready to deliver', 'Ready to collect', 'Out for delivery'].includes(b.status);
        
        if (isPast && isNearTerminal) return false;
        return true;
      });

      setActiveBookings(filteredBookings);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'bookings');
    });

    const unsubStores = onSnapshot(collection(db, 'stores'), (snapshot) => {
      setStores(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Store[]);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'stores');
    });

    const unsubMachines = onSnapshot(collection(db, 'machines'), (snapshot) => {
      setMachines(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Machine[]);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'machines');
    });

    return () => {
      unsubscribe();
      unsubStores();
      unsubMachines();
    };
  }, [user]);

  useEffect(() => {
    let isCancelled = false;

    const fetchSlots = async () => {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      const cached = slotsMemoryCache.get(dateStr);
      const now = Date.now();

      // Instant render from cache
      if (cached) {
        setSlotsData(cached.data);
        setLoading(false);
        // If cache is very fresh (< 15 seconds), skip network refetch
        if (now - cached.timestamp < 15000) {
          return;
        }
      } else {
        setLoading(true);
      }

      const q = query(collection(db, 'slots'), where('date', '==', dateStr));
      try {
        const querySnapshot = await getDocs(q);
        if (isCancelled) return;
        
        const newSlotsData: Record<string, Slot> = {};
        querySnapshot.forEach((doc) => {
          const data = doc.data() as Slot;
          newSlotsData[data.timeSlot] = data;
        });
        
        slotsMemoryCache.set(dateStr, { data: newSlotsData, timestamp: Date.now() });
        setSlotsData(newSlotsData);
      } catch (error) {
        if (!isCancelled) {
          handleFirestoreError(error, OperationType.LIST, 'slots');
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    };

    fetchSlots();

    return () => {
      isCancelled = true;
    };
  }, [selectedDate]);

  const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');

  // Determine active machines for the currently selected date
  const activeMachinesForDate = useMemo(() => {
    if (machines.length === 0) {
      // Sensible initial launch default: 2 machines
      return [
        { id: 'm1', number: 1, type: 'washer', status: 'idle', isAvailable: true } as Machine,
        { id: 'm2', number: 2, type: 'washer', status: 'idle', isAvailable: true } as Machine
      ];
    }
    return machines.filter(m => isMachineAvailableOnDate(m, selectedDateStr));
  }, [machines, selectedDateStr]);

  const totalSlotsCapacity = Math.max(0, activeMachinesForDate.length);

  const getMachineAvailability = (timeSlot: string) => {
    if (totalSlotsCapacity === 0) return 0;
    const slot = slotsData[timeSlot];
    if (!slot || !slot.machines) return totalSlotsCapacity;
    
    let occupiedCount = 0;
    activeMachinesForDate.forEach(m => {
      const occupant = slot.machines[m.number.toString()];
      if (occupant && occupant.trim() !== '') {
        occupiedCount++;
      }
    });
    
    return Math.max(0, totalSlotsCapacity - occupiedCount);
  };

  const isSlotInPast = (slot: string) => {
    if (!isSameDay(selectedDate, new Date())) return false;
    
    const [timeRange, period] = slot.split(' ');
    const [, endTime] = timeRange.split('-'); // Use end time instead of start time
    let [hours, minutes] = endTime.split(':').map(Number);
    
    // Logic for the specific format in TIME_SLOTS: "HH:mm-HH:mm AM/PM"
    if (period === 'PM') {
      if (hours < 12) hours += 12; // 12 PM stays 12, 1-11 PM becomes 13-23
    } else if (period === 'AM') {
      if (hours === 12) hours = 0;
    }
    
    const slotEndTime = new Date();
    slotEndTime.setHours(hours, minutes, 0, 0);
    
    return slotEndTime <= new Date();
  };

  const handleSlotSelect = (timeSlot: string) => {
    if (user?.userType === 'subscriber' && !user?.subscriptionPaid) {
      navigate(`/billing?type=subscription&packageId=${user.package}`);
      return;
    }
    const availability = getMachineAvailability(timeSlot);
    const isPast = isSlotInPast(timeSlot);
    const isPaused = slotsData[timeSlot]?.isPaused;
    
    if (availability === 0 || isPast || isPaused) return;
    
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    navigate(`/booking-details?date=${dateStr}&slot=${encodeURIComponent(timeSlot)}`);
  };

  const isStorePaused = stores.some(s => s.isPaused);
  const maintenanceMessage = stores.find(s => s.isPaused)?.maintenanceMessage || 'Store is temporarily closed for maintenance.';

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-4 py-2 sm:py-12">
      {/* GLOBAL OFFER BANNER */}
      <div className="mb-2 sm:mb-8">
        <OfferBanner />
      </div>

      <div className="p-0">
        {isStorePaused && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-amber-50 dark:bg-amber-900/10 p-4 sm:p-8 rounded-2xl mb-4 sm:mb-10 flex items-start gap-4 sm:gap-6 border border-amber-200/50 dark:border-amber-800/40"
        >
          <div className="bg-amber-100 dark:bg-amber-900/30 p-2.5 sm:p-4 rounded-xl sm:rounded-2xl shrink-0">
            <AlertCircle className="w-5 h-5 sm:w-7 sm:h-7 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <h3 className="text-sm sm:text-xl font-display font-black text-amber-900 dark:text-amber-100 uppercase tracking-tight">Maintenance Notice</h3>
            <p className="text-xs sm:text-sm text-amber-700 dark:text-amber-400 font-medium mt-0.5 sm:mt-1">{maintenanceMessage}</p>
            <p className="text-[9px] sm:text-[10px] text-amber-600 dark:text-amber-500 mt-2 font-black uppercase tracking-widest">Bookings are temporarily suspended</p>
          </div>
        </motion.div>
      )}

      {user?.userType === 'subscriber' && !user?.subscriptionPaid && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-amber-50 dark:bg-amber-900/10 p-4 sm:p-6 rounded-2xl mb-4 sm:mb-10 flex items-center justify-between gap-3 sm:gap-6 border border-amber-200/50 dark:border-amber-800/40"
        >
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            <div className="bg-amber-100 dark:bg-amber-900/30 p-2 sm:p-3 rounded-xl sm:rounded-2xl shrink-0">
              <XCircle className="w-5 h-5 sm:w-6 sm:h-6 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="min-w-0">
              <p className="font-display font-black text-amber-900 dark:text-amber-100 uppercase tracking-tight text-xs sm:text-base truncate">Payment Required</p>
              <p className="text-amber-600 dark:text-amber-400 text-[10px] sm:text-xs font-medium uppercase tracking-widest mt-0.5 truncate">Complete payment to start booking</p>
            </div>
          </div>
          <button
            onClick={() => navigate(`/billing?type=subscription&packageId=${user.package}`)}
            className="px-4 sm:px-8 py-2.5 sm:py-4 bg-amber-600 text-white text-[10px] sm:text-xs font-black uppercase tracking-widest rounded-xl sm:rounded-2xl hover:bg-amber-700 transition-all shrink-0 shadow-md shadow-amber-200 dark:shadow-none"
          >
            Pay Now
          </button>
        </motion.div>
      )}

      {/* MOBILE COMPACT HEADER (Visible on Mobile / Tablet < lg) */}
      <div className="lg:hidden bg-white dark:bg-surface-container p-3 rounded-2xl shadow-sm border border-gray-100 dark:border-surface-highest/10 mb-3">
        <div className="flex items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <motion.div 
              whileTap={{ scale: 0.95 }}
              className="w-10 h-10 bg-primary-electric rounded-xl flex items-center justify-center shadow-md shadow-primary-electric/30 shrink-0 cursor-pointer"
              onClick={() => navigate('/profile')}
            >
              <span className="text-base font-display font-black text-white">{user?.name?.[0]?.toUpperCase() || 'U'}</span>
            </motion.div>
            <div className="min-w-0">
              <p className="text-[9px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-wider leading-none">
                {getGreeting()}
              </p>
              <h2 className="text-sm font-display font-black text-gray-800 dark:text-high-contrast tracking-tight uppercase truncate mt-0.5">
                {user?.name || 'Customer'}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Live Active Orders Pill */}
            {activeBookings.length > 0 ? (
              <button
                onClick={() => document.getElementById('active-orders-section')?.scrollIntoView({ behavior: 'smooth' })}
                className="px-2.5 py-1 bg-primary-electric/10 text-primary-electric dark:text-primary-electric-light text-[10px] font-black uppercase rounded-lg border border-primary-electric/25 flex items-center gap-1.5 shadow-xs"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-primary-electric animate-pulse" />
                <span>{activeBookings.length} Active</span>
              </button>
            ) : (
              <span className="px-2 py-1 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 text-[9px] font-black uppercase rounded-lg border border-emerald-200/50">
                Ready
              </span>
            )}
            
            <button
              onClick={() => navigate('/profile')}
              className="p-1.5 bg-gray-50 dark:bg-surface-low hover:bg-gray-100 dark:hover:bg-surface-highest rounded-lg text-gray-400 transition-colors"
              title="My Bookings"
            >
              <Clock className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Compact Balance Pills Row */}
        <div className="flex flex-wrap items-center gap-1.5 mt-2.5 pt-2 border-t border-gray-50 dark:border-surface-highest/10">
          {(user?.userType === 'subscriber' || !!user?.subscriptionPaid) ? (
            <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 text-[9px] font-black uppercase rounded-md border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>🧺 {user.laundryCredits ?? (user.kilosLeft ? user.kilosLeft * 10 : 120)} Credits</span>
            </span>
          ) : (user?.laundryCredits && user.laundryCredits > 0) ? (
            <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 text-[9px] font-black uppercase rounded-md border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
              <span>🧺 {user.laundryCredits} Credits</span>
            </span>
          ) : null}

          {(user?.walletBalance !== undefined && user?.walletBalance > 0) && (
            <span 
              onClick={() => navigate('/profile')}
              className="px-2 py-0.5 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 text-[9px] font-black uppercase rounded-md border border-blue-200 dark:border-blue-800 flex items-center gap-1 cursor-pointer"
            >
              <Wallet className="w-2.5 h-2.5 text-blue-600 dark:text-blue-400" />
              <span>₹{Number(user.walletBalance).toFixed(2)} Wallet</span>
            </span>
          )}
        </div>
      </div>

      {/* DESKTOP BENTO HEADER (Visible on desktop >= lg) */}
      <div className="hidden lg:flex flex-col lg:flex-row gap-6 mb-8 w-full items-stretch">
        {/* Main Dashboard Info - Large Bento Card */}
        <div className="flex-[3] min-w-0 bg-white dark:bg-surface-container p-6 xl:p-8 rounded-[2.5rem] shadow-xl shadow-black/5 dark:shadow-none border border-gray-100/50 dark:border-surface-highest/10 relative overflow-hidden group">
          <div className="absolute -right-20 -top-20 w-64 h-64 bg-primary-electric/5 rounded-full blur-[100px] pointer-events-none" />
          
          <div className="relative z-10 flex flex-col h-full justify-between gap-6 min-w-0 w-full">
            <div className="flex items-center gap-6 min-w-0">
              <motion.div 
                whileHover={{ scale: 1.05, rotate: -2 }}
                className="w-16 h-16 xl:w-20 xl:h-20 bg-primary-electric rounded-2xl flex items-center justify-center shadow-xl shadow-primary-electric/40 shrink-0 cursor-pointer relative group/avatar"
                onClick={() => navigate('/profile')}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent opacity-0 group-hover/avatar:opacity-100 transition-opacity rounded-2xl" />
                <span className="text-2xl xl:text-3xl font-display font-black text-white">{user?.name?.[0]?.toUpperCase() || 'U'}</span>
              </motion.div>
              
              <div className="min-w-0 flex-1 space-y-1.5">
                <h1 className="text-2xl xl:text-3xl font-display font-black text-gray-800 dark:text-high-contrast tracking-tight uppercase leading-[0.95] break-words">
                  {getGreeting()}
                </h1>
                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 pt-0.5 max-w-full">
                  <p className="text-[11px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-wider leading-none shrink-0">
                    {user?.name}
                  </p>
                  {(user?.userType === 'subscriber' || !!user?.subscriptionPaid) ? (
                    <>
                      <div className="inline-block h-1 w-1 bg-gray-300 dark:bg-gray-600 rounded-full shrink-0" />
                      <span className="px-2.5 py-0.5 bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300 text-[10px] font-black uppercase rounded-full tracking-wider border border-green-200 dark:border-green-800 inline-flex items-center gap-1.5 shadow-sm shrink-0 whitespace-nowrap">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse shrink-0" />
                        <span>🧺 {user.laundryCredits ?? (user.kilosLeft ? user.kilosLeft * 10 : 120)} / {user.totalMonthlyCredits ?? (user.package === 'super_premium' ? 320 : user.package === 'premium' ? 200 : user.package === 'standard' ? 160 : 120)} CREDITS</span>
                      </span>
                    </>
                  ) : (user?.laundryCredits && user.laundryCredits > 0) ? (
                    <>
                      <div className="inline-block h-1 w-1 bg-gray-300 dark:bg-gray-600 rounded-full shrink-0" />
                      <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 text-[10px] font-black uppercase rounded-full tracking-wider border border-emerald-200 dark:border-emerald-800 inline-flex items-center gap-1.5 shadow-sm shrink-0 whitespace-nowrap">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                        <span>🧺 {user.laundryCredits} LAUNDRY CREDITS</span>
                      </span>
                    </>
                  ) : null}

                  {(user?.walletBalance !== undefined && user?.walletBalance > 0) && (
                    <>
                      <div className="inline-block h-1 w-1 bg-gray-300 dark:bg-gray-600 rounded-full shrink-0" />
                      <span 
                        onClick={() => navigate('/profile')}
                        className="px-2.5 py-0.5 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-300 text-[10px] font-black uppercase rounded-full tracking-wider border border-blue-200 dark:border-blue-800 inline-flex items-center gap-1.5 shadow-sm shrink-0 whitespace-nowrap cursor-pointer transition-colors"
                      >
                        <Wallet className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                        <span>₹{Number(user.walletBalance).toFixed(2)} WALLET</span>
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Desktop View Toggle */}
            <div className="relative flex bg-gray-100/50 dark:bg-surface-low p-1 rounded-2xl w-fit shadow-inner border border-gray-200/20 dark:border-surface-highest/10 min-w-[260px] overflow-hidden">
              <motion.div
                initial={false}
                animate={{ x: view === 'today' ? 0 : '100%' }}
                className="absolute top-1 bottom-1 left-1 w-[calc(50%-4px)] bg-white dark:bg-surface-highest rounded-xl shadow-md z-0"
                transition={{ type: "spring", stiffness: 350, damping: 35 }}
              />
              <button
                onClick={() => { setView('today'); setSelectedDate(new Date()); }}
                className={`relative z-10 flex-1 px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-[0.15em] transition-colors duration-300 ${view === 'today' ? 'text-primary-electric dark:text-primary-electric-light' : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'}`}
              >
                Today
              </button>
              <button
                onClick={() => setView('advance')}
                className={`relative z-10 flex-1 px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-[0.15em] transition-colors duration-300 ${view === 'advance' ? 'text-primary-electric dark:text-primary-electric-light' : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'}`}
              >
                Advance
              </button>
            </div>
          </div>
        </div>

        {/* Desktop Status Bento Card */}
        <div className="lg:w-72 shrink-0 bg-white dark:bg-surface-container p-6 rounded-[2.5rem] shadow-xl shadow-black/5 dark:shadow-none border border-gray-100/50 dark:border-surface-highest/10 relative overflow-hidden group flex flex-col justify-between items-center text-center">
          <div className="absolute top-5 right-5 p-1.5 bg-primary-electric/5 rounded-lg opacity-40 group-hover:opacity-100 transition-all">
            <Sparkles className="w-4 h-4 text-primary-electric" />
          </div>
          
          <div className="space-y-1 relative z-10">
            <p className="text-[9px] font-black uppercase tracking-[0.25em] text-gray-400 dark:text-gray-500 leading-none">Your Status</p>
            <div className="h-px w-6 bg-primary-electric/20 mx-auto mt-2" />
          </div>
          
          <div className="py-3 relative z-10">
            {activeBookings.length > 0 ? (
              <div className="space-y-1">
                <motion.span 
                  key={activeBookings.length}
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="block text-4xl xl:text-5xl font-display font-black text-primary-electric dark:text-primary-electric-light leading-none tracking-tighter italic"
                >
                  {activeBookings.length}
                </motion.span>
                <span className="block text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-[0.2em]">Active Orders</span>
              </div>
            ) : (
              <div className="space-y-0.5">
                <span className="block text-sm font-display font-black text-primary-electric/30 dark:text-primary-electric-light/30 uppercase tracking-widest">All Clear</span>
                <span className="block text-3xl font-display font-black text-primary-electric dark:text-primary-electric-light leading-none uppercase tracking-tighter italic">READY</span>
              </div>
            )}
          </div>
          
          <div className="relative z-10 flex gap-1.5 items-center px-3 py-1 bg-gray-50 dark:bg-surface-highest rounded-full border border-gray-100 dark:border-surface-highest/5">
            <div className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
            <span className="text-[8px] font-black uppercase tracking-widest text-gray-500 dark:text-gray-400">Live Status</span>
          </div>
        </div>
      </div>

      {/* MOBILE COMPACT TODAY / ADVANCE TOGGLE */}
      <div className="lg:hidden flex bg-gray-100 dark:bg-surface-low p-1 rounded-xl w-full shadow-inner border border-gray-200/20 dark:border-surface-highest/10 mb-2.5 relative overflow-hidden">
        <motion.div
          initial={false}
          animate={{ x: view === 'today' ? 0 : '100%' }}
          className="absolute top-1 bottom-1 left-1 w-[calc(50%-4px)] bg-white dark:bg-surface-highest rounded-lg shadow-xs z-0"
          transition={{ type: "spring", stiffness: 400, damping: 35 }}
        />
        <button
          onClick={() => { setView('today'); setSelectedDate(new Date()); }}
          className={`relative z-10 flex-1 py-1.5 text-[10px] font-black uppercase tracking-wider text-center transition-colors duration-200 ${view === 'today' ? 'text-primary-electric dark:text-primary-electric-light' : 'text-gray-400 dark:text-gray-500'}`}
        >
          Today
        </button>
        <button
          onClick={() => setView('advance')}
          className={`relative z-10 flex-1 py-1.5 text-[10px] font-black uppercase tracking-wider text-center transition-colors duration-200 ${view === 'advance' ? 'text-primary-electric dark:text-primary-electric-light' : 'text-gray-400 dark:text-gray-500'}`}
        >
          Advance
        </button>
      </div>

      {/* ADVANCE DATE SELECTOR (COMPACT PILLS) - Positioned immediately below the greeting & toggle box */}
      <AnimatePresence mode="wait">
        {view === 'advance' && (
          <motion.div
            initial={{ opacity: 0, height: 0, y: -6 }}
            animate={{ opacity: 1, height: 'auto', y: 0 }}
            exit={{ opacity: 0, height: 0, y: -6 }}
            transition={{ duration: 0.25 }}
            className="mb-4 sm:mb-6 overflow-hidden"
          >
            <div className="flex items-center justify-between mb-2 px-1">
              <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-primary-electric dark:text-primary-electric-light flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                Select Advance Booking Date
              </span>
              <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500">
                {format(selectedDate, 'EEEE, d MMMM yyyy')}
              </span>
            </div>
            <div className="flex gap-2 sm:gap-4 overflow-x-auto pb-2 scrollbar-hide snap-x">
              {[...Array(7)].map((_, i) => {
                const date = addDays(new Date(), i);
                const isSelected = isSameDay(date, selectedDate);
                return (
                  <button
                    key={i}
                    onClick={() => setSelectedDate(date)}
                    className={`flex-shrink-0 w-14 sm:w-20 py-2.5 sm:py-4 rounded-xl sm:rounded-2xl transition-all flex flex-col items-center justify-center snap-center haptic-feedback ${
                      isSelected 
                        ? 'bg-primary-electric text-white shadow-md sm:shadow-xl shadow-primary-electric/25 scale-[1.02]' 
                        : 'bg-white dark:bg-surface-container text-gray-400 dark:text-gray-500 hover:bg-gray-50 dark:hover:bg-surface-highest border border-gray-100 dark:border-surface-highest/10 hover:border-primary-electric/30'
                    }`}
                  >
                    <span className="text-[8px] sm:text-[10px] uppercase font-black tracking-wider opacity-70 mb-0.5 sm:mb-1">{format(date, 'EEE')}</span>
                    <span className="text-base sm:text-2xl font-display font-black leading-none">{format(date, 'd')}</span>
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ACTIVE WASH STATUS (MOBILE COMPACT CAROUSEL + DESKTOP CARDS) */}
      {activeBookings.length > 0 && (
        <div id="active-orders-section" className="mb-3 sm:mb-8">
          <div className="flex items-center justify-between mb-2 px-0.5">
            <h2 className="text-[10px] sm:text-xs font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Active Orders ({activeBookings.length})
            </h2>
            {activeBookings.length > 1 && (
              <span className="text-[9px] font-bold text-gray-400 sm:hidden">
                Swipe cards ➔
              </span>
            )}
          </div>

          {/* Mobile Horizontal Snap-Carousel */}
          <div className="sm:hidden flex gap-2.5 overflow-x-auto snap-x scrollbar-hide pb-1 pt-0.5 -mx-3 px-3">
            {activeBookings.map((booking) => {
              const steps = booking.pickupDrop ? [
                { label: 'Confirmed', statuses: ['paid', 'pending'] },
                { label: 'Pickup Ready', statuses: ['Ready for pick up'] },
                { label: 'In Wash', statuses: ['In Wash', 'In Dryer'] },
                { label: 'Washed', statuses: ['Washing completed', 'Ready to deliver'] },
                { label: 'Out for Delivery', statuses: ['Out for delivery', 'completed'] }
              ] : [
                { label: 'Confirmed', statuses: ['paid', 'pending'] },
                { label: 'In Wash', statuses: ['In Wash', 'In Dryer'] },
                { label: 'Washed', statuses: ['Washing completed'] },
                { label: 'Pickup Ready', statuses: ['Ready to collect', 'completed'] }
              ];

              let currentStepIndex = 0;
              for (let i = steps.length - 1; i >= 0; i--) {
                if (steps[i].statuses.includes(booking.status)) {
                  currentStepIndex = i;
                  break;
                }
              }

              return (
                <div
                  key={booking.id}
                  className="snap-center w-[85vw] max-w-[320px] bg-white dark:bg-surface-container p-3 rounded-2xl border border-gray-100 dark:border-surface-highest/10 shadow-sm shrink-0 flex flex-col justify-between"
                >
                  <div>
                    {/* Top Row: Service + Status */}
                    <div className="flex items-center justify-between gap-1.5 mb-1.5">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <div className={`p-1 shrink-0 bg-primary-electric rounded-md ${['In Wash', 'In Dryer'].includes(booking.status) ? 'animate-pulse' : ''}`}>
                          <Loader2 className={`w-3 h-3 text-white ${['In Wash', 'In Dryer'].includes(booking.status) ? 'animate-spin' : ''}`} />
                        </div>
                        <span className="text-[11px] font-black text-primary-electric dark:text-primary-electric-light uppercase tracking-tight truncate">
                          {booking.serviceType}
                        </span>
                        <span className="text-[9px] font-black text-gray-500 bg-gray-100 dark:bg-surface-low px-1.5 py-0.5 rounded uppercase">
                          M#{booking.machineNumber}
                        </span>
                      </div>
                      <span className="text-[9px] font-mono font-bold bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded shrink-0">
                        ID: {booking.bookingId || `#${booking.id?.slice(-4).toUpperCase()}`}
                      </span>
                    </div>

                    {/* Schedule info */}
                    <p className="text-[10px] text-gray-500 dark:text-gray-400 font-semibold">
                      📅 {booking.date} • {booking.timeSlot}
                    </p>
                  </div>

                  {/* Compact Mobile Progress Bar */}
                  <div className="mt-2.5 pt-2 border-t border-gray-50 dark:border-surface-highest/10">
                    <div className="flex gap-1 h-1.5 w-full">
                      {steps.map((_, idx) => (
                        <div 
                          key={idx} 
                          className={`flex-1 rounded-full ${
                            idx <= currentStepIndex 
                              ? 'bg-primary-electric' 
                              : 'bg-gray-100 dark:bg-surface-low'
                          }`}
                        />
                      ))}
                    </div>
                    <div className="flex justify-between items-center text-[9px] font-bold text-gray-400 mt-1">
                      <span>Step {currentStepIndex + 1}/{steps.length}: <strong className="text-primary-electric dark:text-primary-electric-light uppercase">{steps[currentStepIndex].label}</strong></span>
                      <span className="uppercase text-[8px] tracking-wider text-emerald-600 font-black">Live</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop Active Bookings Grid */}
          <div className="hidden sm:grid grid-cols-1 gap-6">
            {activeBookings.map((booking, index) => {
              const steps = booking.pickupDrop ? [
                { label: 'Order Confirmed', statuses: ['paid', 'pending'] },
                { label: 'Ready for Pickup', statuses: ['Ready for pick up'] },
                { label: 'In wash', statuses: ['In Wash', 'In Dryer'] },
                { label: 'Completed', statuses: ['Washing completed', 'Ready to deliver'] },
                { label: 'Out for Delivery', statuses: ['Out for delivery', 'completed'] }
              ] : [
                { label: 'Confirmed', statuses: ['paid', 'pending'] },
                { label: 'In wash', statuses: ['In Wash', 'In Dryer'] },
                { label: 'Completed', statuses: ['Washing completed'] },
                { label: 'Ready for Pickup', statuses: ['Ready to collect', 'completed'] }
              ];

              let currentStepIndex = -1;
              for (let i = steps.length - 1; i >= 0; i--) {
                if (steps[i].statuses.includes(booking.status)) {
                  currentStepIndex = i;
                  break;
                }
              }
              if (currentStepIndex === -1) currentStepIndex = 0;
              const isEffectivelyComplete = booking.status === 'completed';
              const displayStepIndex = isEffectivelyComplete ? steps.length : currentStepIndex;

              const getStatusLabel = (status: string) => {
                if (booking.pickupDrop) {
                  const labels: Record<string, string> = {
                    'paid': 'Order Confirmed',
                    'pending': 'Order Confirmed',
                    'Ready for pick up': 'Ready for Pickup',
                    'In Wash': 'In wash',
                    'In Dryer': 'In wash',
                    'Washing completed': 'Completed',
                    'Ready to deliver': 'Completed',
                    'Out for delivery': 'Out for Delivery',
                    'completed': 'Out for Delivery',
                    'cancelled': 'Cancelled'
                  };
                  return (labels[status] || status).toUpperCase();
                } else {
                  const labels: Record<string, string> = {
                    'paid': 'Confirmed',
                    'pending': 'Confirmed',
                    'In Wash': 'In wash',
                    'In Dryer': 'In wash',
                    'Washing completed': 'Completed',
                    'Ready to collect': 'Ready for customer pickup',
                    'completed': 'Ready for customer pickup',
                    'cancelled': 'Cancelled'
                  };
                  return (labels[status] || status).toUpperCase();
                }
              };

              return (
                <motion.div
                  key={booking.id}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="bg-white dark:bg-surface-container p-6 rounded-2xl shadow-lg shadow-black/5 dark:shadow-none transition-all relative overflow-hidden group border border-gray-100 dark:border-surface-highest/10"
                >
                  <div className="flex items-center justify-between gap-6 mb-6">
                    <div className="flex items-center gap-4 min-w-0">
                      <div className={`p-3.5 shrink-0 bg-primary-electric rounded-xl shadow-md shadow-primary-electric/20 ${['In Wash', 'In Dryer'].includes(booking.status) ? 'animate-pulse' : ''}`}>
                        <Loader2 className={`w-6 h-6 text-white ${['In Wash', 'In Dryer'].includes(booking.status) ? 'animate-spin' : ''}`} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <p className="text-[10px] font-black text-primary-electric dark:text-primary-electric-light uppercase tracking-widest">{booking.serviceType}</p>
                          <span className="text-[10px] font-black text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-surface-low px-2 py-0.5 rounded uppercase tracking-wider">M#{booking.machineNumber}</span>
                          <span className="text-[10px] font-black text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded uppercase tracking-wider">
                            ID: {booking.bookingId || `#${booking.id?.slice(-6).toUpperCase()}`}
                          </span>
                        </div>
                        <h3 className="text-xl font-display font-black text-gray-800 dark:text-high-contrast tracking-tight uppercase leading-tight">{getStatusLabel(booking.status)}</h3>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-0.5">Scheduled For</p>
                      <p className="text-sm font-black text-gray-700 dark:text-gray-300 uppercase tracking-tight">{booking.date} • {booking.timeSlot}</p>
                    </div>
                  </div>

                  <div className="relative overflow-hidden pt-1 pb-1">
                    <div className="w-full relative min-h-[60px] flex flex-col justify-center">
                      <div className="flex justify-between items-start relative z-10 w-full">
                        {steps.map((step, idx) => {
                          const isCompleted = idx < displayStepIndex;
                          const isCurrent = idx === currentStepIndex && !isEffectivelyComplete;

                          return (
                            <div 
                              key={idx} 
                              className="flex flex-col items-center flex-1 text-center group min-w-0 relative"
                            >
                              {idx < steps.length - 1 && (
                                <div className="absolute top-4 left-1/2 w-full h-0.5 bg-gray-100 dark:bg-surface-low -z-10" />
                              )}
                              {idx < steps.length - 1 && (
                                <div 
                                  className={`absolute top-4 left-1/2 h-0.5 bg-primary-electric -z-10 ${
                                    (idx < currentStepIndex || isEffectivelyComplete) ? 'w-full' : 'w-0'
                                  }`}
                                />
                              )}
                              <div 
                                className={`w-8 h-8 rounded-full shrink-0 flex items-center justify-center relative z-10 ${
                                  isCompleted ? 'bg-primary-electric text-white' : 
                                  isCurrent ? 'bg-white dark:bg-surface-container border-2 border-primary-electric text-primary-electric shadow-sm' : 
                                  'bg-white dark:bg-surface-container border-2 border-gray-100 dark:border-surface-low text-gray-300 dark:text-gray-700'
                                }`}
                              >
                                {isCompleted ? (
                                  <CheckCircle2 className="w-4 h-4" />
                                ) : (
                                  <div className={`w-2 h-2 rounded-full ${isCurrent ? 'bg-primary-electric animate-pulse' : 'bg-gray-200 dark:bg-gray-700'}`} />
                                )}
                              </div>
                              <p className={`mt-2 text-[9px] font-black uppercase tracking-tighter text-center w-full px-0.5 truncate ${
                                isCurrent ? 'text-primary-electric dark:text-primary-electric-light' : 
                                isCompleted ? 'text-gray-500 dark:text-gray-400' : 
                                'text-gray-300 dark:text-gray-700'
                              }`}>
                                {step.label}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* LOYALTY REWARDS - COMPACT MOBILE STRIP + DESKTOP CARD */}
      {(() => {
        const userCredits = Number(user?.laundryCredits ?? ((user?.kilosLeft || 0) * 10));
        const freeWashesReady = Math.floor(userCredits / 40);
        const cycleCredits = userCredits % 40;
        const progressPercent = userCredits >= 40 
          ? (cycleCredits === 0 ? 100 : Math.round((cycleCredits / 40) * 100))
          : Math.round((userCredits / 40) * 100);
        const creditsToNext = userCredits >= 40 && cycleCredits === 0 ? 0 : (40 - cycleCredits);

        return (
          <>
            {/* Mobile Slim Strip */}
            <div className="sm:hidden mb-2.5 p-2 bg-white dark:bg-surface-container rounded-xl border border-gray-100 dark:border-surface-highest/10 shadow-xs flex items-center justify-between gap-2.5">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-6 h-6 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <Coins className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] font-black uppercase text-gray-800 dark:text-high-contrast block truncate">
                    Loyalty Rewards
                  </span>
                  <span className="text-[9px] text-gray-400 font-bold block truncate">
                    {freeWashesReady > 0 ? `🎉 ${freeWashesReady} Free Wash Ready!` : `${creditsToNext} Cr to Free Wash`}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <div className="w-16 h-1.5 bg-gray-100 dark:bg-surface-highest/40 rounded-full overflow-hidden">
                  <div 
                    style={{ width: `${Math.min(100, Math.max(5, progressPercent))}%` }}
                    className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full"
                  />
                </div>
                <span className="text-xs font-display font-black text-emerald-600 dark:text-emerald-400">
                  {userCredits} <span className="text-[8px] font-bold text-gray-400">Cr</span>
                </span>
              </div>
            </div>

            {/* Desktop Full Card */}
            <div className="hidden sm:block mb-6 p-4 sm:p-5 bg-white dark:bg-surface-container rounded-2xl border border-gray-100 dark:border-surface-highest/10 shadow-sm relative overflow-hidden">
              <div className="flex items-center justify-between gap-4 mb-2.5">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                    <Coins className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-xs font-black uppercase tracking-wider text-gray-800 dark:text-high-contrast">
                        Loyalty Rewards
                      </h3>
                      <span className="px-2 py-0.5 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-[9px] font-black uppercase rounded-full border border-emerald-200/50 dark:border-emerald-800/40">
                        +5 Cr / Wash
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 font-medium">
                      {freeWashesReady > 0 ? (
                        <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                          🎉 {freeWashesReady} Free 4kg Wash{freeWashesReady > 1 ? 'es' : ''} Ready ({freeWashesReady * 40} Credits)
                        </span>
                      ) : (
                        <span>{creditsToNext} credits to unlock a Free 4kg Wash</span>
                      )}
                    </p>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-[9px] font-black uppercase tracking-wider text-gray-400 block">Rewards Gained</span>
                  <span className="text-base sm:text-lg font-display font-black text-emerald-600 dark:text-emerald-400 tracking-tight leading-none">
                    {userCredits} <span className="text-[11px] font-bold text-gray-500 dark:text-gray-400">Credits</span>
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="h-2 w-full bg-gray-100 dark:bg-surface-highest/40 rounded-full overflow-hidden">
                  <div
                    style={{ width: `${Math.min(100, Math.max(3, progressPercent))}%` }}
                    className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-500"
                  />
                </div>
                <div className="flex items-center justify-between text-[10px] font-bold text-gray-400 dark:text-gray-500">
                  <span>Next reward cycle: {cycleCredits} / 40 Cr</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-black">
                    {userCredits >= 40 ? 'Free Wash Unlocked' : `${progressPercent}% Completed`}
                  </span>
                </div>
              </div>
            </div>
          </>
        );
      })()}

      {/* BOOKING SLOTS HEADER INFO */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-2.5 px-0.5">
        <div>
          <h2 className="text-xs sm:text-sm font-display font-black text-gray-800 dark:text-high-contrast uppercase tracking-tight flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-primary-electric" />
            <span>Available Slots • {format(selectedDate, 'EEE, d MMM')}</span>
          </h2>
          <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 font-medium">
            {isSubscriber ? (
              <span>
                Subscriber Account: <strong className="text-emerald-600 dark:text-emerald-400 font-bold">₹0 to pay ({standardWashCredits} Credits • ₹{standardWashPrice} value)</strong> • Wash covered by monthly plan
              </span>
            ) : (
              <span>
                Standard wash <strong className="text-gray-800 dark:text-gray-200 font-bold">₹{standardWashPrice}</strong> • Cash on Delivery slot allocation fee <strong className="text-primary-electric font-bold">₹39 prepaid online</strong>
              </span>
            )}
          </p>
        </div>
        {isSubscriber && (
          <div className="self-start sm:self-auto flex items-center gap-1 px-2 py-0.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/60 dark:border-emerald-800/40 rounded-lg text-[9px] sm:text-[10px] font-black text-emerald-700 dark:text-emerald-300">
            <span>🧺 Balance: {userCredits} Credits</span>
          </div>
        )}
      </div>

      {/* BOOKING SLOTS GRID - COMPACT FOR MOBILE */}
      <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-4">
        {loading ? (
          <div className="col-span-full flex flex-col items-center justify-center py-12 sm:py-20 text-center">
            <Loader2 className="w-8 h-8 sm:w-10 sm:h-10 text-primary-electric animate-spin mb-3" />
            <p className="text-xs sm:text-sm text-gray-400 dark:text-gray-500 font-black uppercase tracking-wider">Loading slots...</p>
          </div>
        ) : (
          TIME_SLOTS.map((slot, index) => {
            const availability = getMachineAvailability(slot);
            const isFull = availability === 0;
            const isPast = isSlotInPast(slot);
            const isPaused = slotsData[slot]?.isPaused;
            const isUnavailable = isFull || isPast || user?.isSuspended || isStorePaused || isPaused;
            
            return (
              <motion.button
                key={slot}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.02 }}
                whileHover={!isUnavailable ? { scale: 1.02, y: -2 } : {}}
                whileTap={!isUnavailable ? { scale: 0.98 } : {}}
                onClick={() => handleSlotSelect(slot)}
                disabled={isUnavailable}
                className={`p-2.5 sm:p-4 rounded-xl sm:rounded-2xl text-left transition-all flex flex-col justify-between min-h-[5.8rem] sm:min-h-[9.8rem] relative overflow-hidden group haptic-feedback ${
                  isUnavailable 
                    ? 'bg-gray-50/50 dark:bg-surface-low/50 opacity-40 cursor-not-allowed grayscale' 
                    : 'bg-white dark:bg-surface-container shadow-xs sm:shadow-md hover:shadow-lg hover:border-primary-electric/30 border border-gray-100 dark:border-surface-highest/10'
                }`}
              >
                <div className="flex justify-between items-center w-full relative z-10 gap-1">
                  <div className={`p-1 sm:p-2 rounded-lg shrink-0 ${isUnavailable ? 'bg-gray-100 dark:bg-surface-low' : 'bg-primary-electric/10'}`}>
                    <Clock className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${isUnavailable ? 'text-gray-400 dark:text-gray-500' : 'text-primary-electric dark:text-primary-electric-light'}`} />
                  </div>
                  {user?.isSuspended ? (
                    <span className="px-1.5 py-0.5 sm:px-2.5 sm:py-0.5 bg-red-500 text-white text-[7.5px] sm:text-[9px] font-black rounded-full uppercase tracking-wider">Suspended</span>
                  ) : isStorePaused || isPaused ? (
                    <span className="px-1.5 py-0.5 sm:px-2.5 sm:py-0.5 bg-amber-500 text-white text-[7.5px] sm:text-[9px] font-black rounded-full uppercase tracking-wider">Paused</span>
                  ) : isFull ? (
                    <span className="px-1.5 py-0.5 sm:px-2.5 sm:py-0.5 bg-red-500 text-white text-[7.5px] sm:text-[9px] font-black rounded-full uppercase tracking-wider">Full</span>
                  ) : isPast ? (
                    <span className="px-1.5 py-0.5 sm:px-2.5 sm:py-0.5 bg-gray-400 text-white text-[7.5px] sm:text-[9px] font-black rounded-full uppercase tracking-wider">Past</span>
                  ) : (
                    <span className="px-1.5 py-0.5 sm:px-2.5 sm:py-0.5 bg-green-500 text-white text-[7.5px] sm:text-[9px] font-black rounded-full uppercase tracking-wider">Available</span>
                  )}
                </div>
                
                <div className="relative z-10 w-full min-w-0">
                  <h3 className={`text-[11px] xs:text-xs sm:text-base font-display font-black tracking-tight uppercase leading-tight truncate ${isUnavailable ? 'text-gray-400 dark:text-gray-500' : 'text-gray-800 dark:text-high-contrast'}`}>{slot}</h3>
                  <div className="flex items-center mt-0.5 sm:mt-1">
                    <div className="flex -space-x-1 mr-1.5 shrink-0">
                      {[...Array(Math.max(1, totalSlotsCapacity))].map((_, i) => (
                        <div 
                          key={i} 
                          className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full ring-1 ring-white dark:ring-surface-container ${i < (totalSlotsCapacity - availability) ? 'bg-primary-electric' : 'bg-gray-200 dark:bg-surface-low'}`}
                        />
                      ))}
                    </div>
                    <span className={`text-[7.5px] sm:text-[9px] font-bold uppercase tracking-wider truncate ${isUnavailable ? 'text-gray-400 dark:text-gray-500' : 'text-gray-500 dark:text-gray-400'}`}>
                      {availability} left
                    </span>
                  </div>

                  {/* Amount to be paid along with credits in brackets for subscriber accounts */}
                  <div className="mt-1.5 sm:mt-2.5 pt-1.5 border-t border-gray-100 dark:border-surface-highest/20 flex items-center justify-between gap-1 w-full min-w-0">
                    {isSubscriber ? (
                      <div className="flex items-center gap-1 min-w-0 truncate">
                        {hasCredits ? (
                          <>
                            <span className="line-through text-gray-400 dark:text-gray-500 text-[8px] sm:text-[10px]">
                              ₹{standardWashPrice}
                            </span>
                            <span className="text-[10px] sm:text-xs font-black text-emerald-600 dark:text-emerald-400">
                              ₹0
                            </span>
                            <span className="text-[8.5px] sm:text-[10.5px] font-bold text-primary-electric dark:text-primary-electric-light truncate">
                              ({standardWashCredits} Credits • ₹{standardWashPrice})
                            </span>
                          </>
                        ) : (
                          <>
                            <span className="text-[10px] sm:text-xs font-black text-gray-800 dark:text-gray-200">
                              ₹{standardWashPrice}
                            </span>
                            <span className="text-[8px] sm:text-[10px] font-bold text-amber-600 dark:text-amber-400 truncate">
                              ({standardWashCredits} Credits • ₹{standardWashPrice})
                            </span>
                          </>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 min-w-0 truncate">
                        <span className="text-[10px] sm:text-xs font-black text-gray-800 dark:text-gray-200">
                          ₹{standardWashPrice}
                        </span>
                        <span className="text-[7.5px] sm:text-[9px] font-bold text-primary-electric/80 dark:text-primary-electric-light/80 truncate">
                          • ₹39 COD Fee
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {!isUnavailable && (
                  <div className="absolute -right-8 -bottom-8 w-20 h-20 bg-primary-electric/5 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-500 pointer-events-none" />
                )}
              </motion.button>
            );
          })
        )}
      </div>

      {/* MOBILE COMPACT LAUNDRY TIP */}
      <div className="sm:hidden mt-3 p-2.5 bg-primary-electric/5 dark:bg-primary-electric/10 rounded-xl flex items-center gap-2 border border-primary-electric/10">
        <Info className="w-3.5 h-3.5 text-primary-electric shrink-0" />
        <p className="text-[10px] text-gray-600 dark:text-gray-400 font-medium leading-tight italic truncate">
          Tip: "{dailyTip}"
        </p>
      </div>

      {/* DESKTOP QUICK ACTIONS & TIP SECTION (Hidden on mobile to preserve viewport space) */}
      <div className="hidden sm:grid grid-cols-1 md:grid-cols-3 gap-6 mt-8 mb-8">
        <div className="md:col-span-2 grid grid-cols-2 gap-4">
          {[
            { label: 'Book Now', icon: Sparkles, color: 'primary-electric', action: () => { setView('today'); setSelectedDate(new Date()); } },
            { label: 'My Bookings', icon: Clock, color: 'indigo', action: () => navigate('/profile') },
          ].map((item, i) => (
            <motion.button
              key={i}
              whileHover={{ y: -4, scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              onClick={item.action}
              className="p-5 bg-white dark:bg-surface-container rounded-2xl shadow-sm border border-gray-100 dark:border-surface-highest/10 flex items-center justify-center gap-3 transition-all group haptic-feedback"
            >
              <div className="p-2.5 bg-gray-50 dark:bg-surface-highest rounded-xl group-hover:bg-primary-electric/10 transition-colors">
                <item.icon className="w-5 h-5 text-gray-400 group-hover:text-primary-electric transition-colors" />
              </div>
              <span className="text-xs font-black uppercase tracking-wider text-gray-500 group-hover:text-gray-800 dark:group-hover:text-high-contrast transition-colors">{item.label}</span>
            </motion.button>
          ))}
        </div>

        <div className="bg-primary-electric/5 dark:bg-primary-electric/10 p-5 rounded-2xl flex items-start gap-4 border border-primary-electric/10">
          <div className="p-2 bg-primary-electric/10 rounded-xl shrink-0">
            <Info className="w-4 h-4 text-primary-electric" />
          </div>
          <div>
            <p className="text-[9px] font-black text-primary-electric uppercase tracking-widest mb-1">Laundry Tip</p>
            <p className="text-xs text-gray-600 dark:text-gray-300 font-medium leading-relaxed italic">"{dailyTip}"</p>
          </div>
        </div>
      </div>

      {/* Refer & Earn Feature Banner */}
      <div className="mt-6 sm:mt-10">
        <ReferralCard />
      </div>

      {/* Need Help / Terms Footer */}
      <div className="mt-8 sm:mt-14 pt-6 border-t border-gray-100 dark:border-surface-low">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-gray-50 dark:bg-surface-low p-4 sm:p-8 rounded-2xl">
          <div>
            <h3 className="text-base sm:text-xl font-display font-black text-gray-800 dark:text-high-contrast tracking-tight uppercase mb-1">Need help?</h3>
            <p className="text-xs text-gray-400 dark:text-gray-500 font-medium uppercase tracking-wider">Review our service policies and guidelines for care.</p>
          </div>
          <button
            onClick={() => setShowTerms(true)}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-white dark:bg-surface-highest text-gray-700 dark:text-high-contrast text-xs font-black uppercase tracking-wider rounded-xl shadow-xs"
          >
            <FileText className="w-4 h-4 text-gray-400" />
            Terms & Conditions
          </button>
        </div>
      </div>

      <TermsModal 
        isOpen={showTerms}
        onClose={() => setShowTerms(false)}
        mode="detailed"
      />
      </div>
    </div>
  );
};

export default Dashboard;
