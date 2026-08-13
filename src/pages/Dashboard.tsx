import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Calendar, Clock, CheckCircle2, XCircle, ChevronRight, Loader2, CalendarDays, Circle, FileText, Zap, MessageSquare, Info, Sparkles, AlertCircle } from 'lucide-react';
import { collection, query, where, getDocs, doc, getDoc, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { TIME_SLOTS, Slot, Booking, Store, Machine } from '../types';
import { format, addDays, isSameDay } from 'date-fns';
import TermsModal from '../components/TermsModal';
import { OfferBanner } from '../components/OfferBanner';

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

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  
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
    const fetchSlots = async () => {
      setLoading(true);
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      const q = query(collection(db, 'slots'), where('date', '==', dateStr));
      try {
        const querySnapshot = await getDocs(q);
        
        const newSlotsData: Record<string, Slot> = {};
        querySnapshot.forEach((doc) => {
          const data = doc.data() as Slot;
          newSlotsData[data.timeSlot] = data;
        });
        
        setSlotsData(newSlotsData);
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, 'slots');
      } finally {
        setLoading(false);
      }
    };

    fetchSlots();
  }, [selectedDate]);

  const getMachineAvailability = (timeSlot: string) => {
    const slot = slotsData[timeSlot];
    
    // Count total available machines in the system for this store
    // (Assuming single store for now, or we'd filter by storeId)
    const availableMachines = machines.filter(m => m.isAvailable && m.status !== 'maintenance' && m.status !== 'unavailable');
    const totalAvailableCount = availableMachines.length || 4; // Fallback to 4 if no machines defined yet

    if (!slot) return totalAvailableCount;
    
    let occupiedCount = 0;
    Object.values(slot.machines).forEach(uid => {
      if (uid) occupiedCount++;
    });
    
    return Math.max(0, totalAvailableCount - occupiedCount);
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
    <div className="max-w-4xl mx-auto px-0 sm:px-4 py-0 sm:py-12">
      {/* GLOBAL OFFER BANNER */}
      <div className="mb-0 sm:mb-8">
        <OfferBanner />
      </div>

      <div className="px-4 py-8 sm:p-0">
        {isStorePaused && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-amber-50 dark:bg-amber-900/10 p-8 rounded-2xl mb-10 flex items-start gap-6"
        >
          <div className="bg-amber-100 dark:bg-amber-900/30 p-4 rounded-2xl">
            <AlertCircle className="w-7 h-7 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <h3 className="text-xl font-display font-black text-amber-900 dark:text-amber-100 uppercase tracking-tight">Maintenance Notice</h3>
            <p className="text-amber-700 dark:text-amber-400 font-medium mt-1">{maintenanceMessage}</p>
            <p className="text-[10px] text-amber-600 dark:text-amber-500 mt-3 font-black uppercase tracking-widest">Bookings are temporarily suspended</p>
          </div>
        </motion.div>
      )}

      {user?.userType === 'subscriber' && !user?.subscriptionPaid && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-amber-50 dark:bg-amber-900/10 p-6 rounded-2xl mb-10 flex items-center justify-between gap-6"
        >
          <div className="flex items-center gap-4">
            <div className="bg-amber-100 dark:bg-amber-900/30 p-3 rounded-2xl">
              <XCircle className="w-6 h-6 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="font-display font-black text-amber-900 dark:text-amber-100 uppercase tracking-tight">Payment Required</p>
              <p className="text-amber-600 dark:text-amber-400 text-xs font-medium uppercase tracking-widest mt-1">Complete payment to start booking</p>
            </div>
          </div>
          <button
            onClick={() => navigate(`/billing?type=subscription&packageId=${user.package}`)}
            className="px-8 py-4 bg-amber-600 text-white text-xs font-black uppercase tracking-widest rounded-2xl hover:bg-amber-700 transition-all shrink-0 shadow-lg shadow-amber-200 dark:shadow-none"
          >
            Pay Now
          </button>
        </motion.div>
      )}

      <div className="flex flex-col lg:flex-row gap-6 mb-12 sm:mb-16 w-full items-stretch">
        {/* Main Dashboard Info - Large Bento Card */}
        <div className="flex-[3] bg-white dark:bg-surface-container p-6 sm:p-10 xl:p-12 rounded-[2rem] sm:rounded-[3.5rem] shadow-2xl shadow-black/5 dark:shadow-none border border-gray-100/50 dark:border-surface-highest/10 relative overflow-hidden group">
          {/* Subtle Background Accent */}
          <div className="absolute -right-20 -top-20 w-64 h-64 bg-primary-electric/5 rounded-full blur-[100px] pointer-events-none" />
          
          <div className="relative z-10 flex flex-col h-full justify-between gap-10">
            <div className="flex flex-col sm:flex-row sm:items-center gap-6 sm:gap-10">
              <motion.div 
                whileHover={{ scale: 1.05, rotate: -2 }}
                className="w-16 h-16 sm:w-24 sm:h-24 bg-primary-electric rounded-[1.5rem] sm:rounded-3xl flex items-center justify-center shadow-2xl shadow-primary-electric/40 shrink-0 cursor-pointer relative group/avatar"
                onClick={() => navigate('/profile')}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent opacity-0 group-hover/avatar:opacity-100 transition-opacity rounded-3xl" />
                <span className="text-2xl sm:text-4xl font-display font-black text-white">{user?.name?.[0]?.toUpperCase()}</span>
              </motion.div>
              
              <div className="space-y-1 sm:space-y-2">
                <h1 className="text-3xl sm:text-4xl lg:text-5xl xl:text-6xl font-display font-black text-gray-800 dark:text-high-contrast tracking-tighter uppercase leading-[0.9]">
                  {getGreeting()}
                </h1>
                <div className="flex flex-wrap items-center gap-3">
                  <p className="text-[9px] sm:text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.3em] leading-none">
                    {user?.name}
                  </p>
                  {(user?.userType === 'subscriber' || !!user?.subscriptionPaid) && (
                    <>
                      <div className="h-1 w-1 bg-gray-300 dark:bg-gray-600 rounded-full" />
                      <span className="px-2.5 py-0.5 bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400 text-[9px] font-black uppercase rounded-full tracking-wider border border-green-200 dark:border-green-800">
                        Subscriber Account • {user.kilosLeft ?? 12} KG Left
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* View Toggle - Ultra-Clean Style */}
            <div className="relative flex bg-gray-100/50 dark:bg-surface-low p-1.5 rounded-[1.5rem] w-full sm:w-fit shadow-inner border border-gray-200/20 dark:border-surface-highest/10 sm:min-w-[300px] overflow-hidden">
              <motion.div
                initial={false}
                animate={{ x: view === 'today' ? 0 : '100%' }}
                className="absolute top-1.5 bottom-1.5 left-1.5 w-[calc(50%-6px)] bg-white dark:bg-surface-highest rounded-[1.2rem] shadow-xl z-0"
                transition={{ type: "spring", stiffness: 350, damping: 35 }}
              />
              <button
                onClick={() => { setView('today'); setSelectedDate(new Date()); }}
                className={`relative z-10 flex-1 px-4 sm:px-8 py-3 rounded-[1.2rem] text-[9px] sm:text-[10px] font-black uppercase tracking-[0.2em] transition-colors duration-300 ${view === 'today' ? 'text-primary-electric dark:text-primary-electric-light' : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'}`}
              >
                Today
              </button>
              <button
                onClick={() => setView('advance')}
                className={`relative z-10 flex-1 px-4 sm:px-8 py-3 rounded-[1.2rem] text-[9px] sm:text-[10px] font-black uppercase tracking-[0.2em] transition-colors duration-300 ${view === 'advance' ? 'text-primary-electric dark:text-primary-electric-light' : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'}`}
              >
                Advance
              </button>
            </div>
          </div>
        </div>

        {/* Status Card - Specialized Bento Card */}
        <div className="lg:w-80 shrink-0 bg-white dark:bg-surface-container p-8 sm:p-10 rounded-[2.5rem] sm:rounded-[3.5rem] shadow-2xl shadow-black/5 dark:shadow-none border border-gray-100/50 dark:border-surface-highest/10 relative overflow-hidden group flex flex-col justify-between items-center text-center">
          {/* Visual Accents */}
          <div className="absolute top-6 right-6 p-2 bg-primary-electric/5 rounded-xl opacity-40 group-hover:opacity-100 group-hover:scale-110 transition-all duration-500">
            <Sparkles className="w-5 h-5 text-primary-electric" />
          </div>
          
          <div className="space-y-1 relative z-10">
            <p id="dashboard-status-title" className="text-[9px] font-black uppercase tracking-[0.3em] text-gray-400 dark:text-gray-500 leading-none">Your Status</p>
            <div className="h-px w-6 bg-primary-electric/20 mx-auto mt-3" />
          </div>
          
          <div className="py-6 sm:py-8 relative z-10">
            {activeBookings.length > 0 ? (
              <div className="space-y-2">
                <motion.span 
                  key={activeBookings.length}
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="block text-5xl sm:text-7xl font-display font-black text-primary-electric dark:text-primary-electric-light leading-none tracking-tighter italic"
                >
                  {activeBookings.length}
                </motion.span>
                <span className="block text-[10px] sm:text-[11px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-[0.3em]">Active Orders</span>
              </div>
            ) : (
              <div className="space-y-1">
                <span className="block text-lg sm:text-xl font-display font-black text-primary-electric/20 dark:text-primary-electric-light/20 leading-tight uppercase tracking-[0.2em]">All Clear</span>
                <span className="block text-4xl sm:text-6xl font-display font-black text-primary-electric dark:text-primary-electric-light leading-[0.85] uppercase tracking-tighter italic">READY</span>
              </div>
            )}
          </div>
          
          <motion.div 
            whileHover={{ scale: 1.05 }}
            className="relative z-10 flex gap-2 items-center px-4 py-2 bg-gray-50 dark:bg-surface-highest rounded-full border border-gray-100 dark:border-surface-highest/5"
          >
            <div className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
            <span className="text-[8px] font-black uppercase tracking-widest text-gray-500 dark:text-gray-400">Live Status</span>
          </motion.div>
        </div>
      </div>

      {/* Quick Actions & Tip Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
        <div className="md:col-span-2 grid grid-cols-2 gap-4">
          {[
            { label: 'Book Now', icon: Sparkles, color: 'primary-electric', action: () => setView('today') },
            { label: 'My Bookings', icon: Clock, color: 'indigo', action: () => navigate('/profile') },
          ].map((item, i) => (
            <motion.button
              key={i}
              whileHover={{ y: -6, scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={item.action}
              className="p-8 bg-white dark:bg-surface-container rounded-2xl shadow-xl shadow-black/5 dark:shadow-none flex flex-col items-center justify-center gap-4 transition-all group haptic-feedback"
            >
              <div className="p-5 bg-gray-50 dark:bg-surface-highest rounded-2xl group-hover:bg-primary-electric/10 transition-colors">
                <item.icon className="w-8 h-8 text-gray-400 dark:text-gray-500 group-hover:text-primary-electric transition-colors" />
              </div>
              <span className="text-xs font-black uppercase tracking-widest text-gray-500 dark:text-gray-400 group-hover:text-gray-800 dark:group-hover:text-high-contrast transition-colors">{item.label}</span>
            </motion.button>
          ))}
        </div>

        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="bg-primary-electric/5 dark:bg-primary-electric/10 p-8 rounded-2xl flex items-start gap-6 relative overflow-hidden group"
        >
          <div className="p-3 bg-primary-electric/10 dark:bg-primary-electric/20 rounded-2xl shrink-0">
            <Info className="w-6 h-6 text-primary-electric dark:text-primary-electric-light" />
          </div>
          <div>
            <p className="text-[10px] font-black text-primary-electric dark:text-primary-electric-light uppercase tracking-widest mb-2">Laundry Tip</p>
            <p className="text-sm text-gray-600 dark:text-gray-300 font-medium leading-relaxed italic">"{dailyTip}"</p>
          </div>
          <div className="absolute -right-8 -bottom-8 w-32 h-32 bg-primary-electric/5 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-700" />
        </motion.div>
      </div>

      {/* Active Wash Status */}
      {activeBookings.length > 0 && (
        <div className="mb-12">
          <h2 className="text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-6 ml-1">Active Wash Status</h2>
          <div className="grid grid-cols-1 gap-8">
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

              // Show progress bar as complete for completed bookings
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
                  initial={{ opacity: 0, y: 20, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ delay: index * 0.1 }}
                  whileHover={{ y: -6 }}
                  className="bg-white dark:bg-surface-container p-4 sm:p-8 rounded-2xl shadow-2xl shadow-black/5 dark:shadow-none transition-all duration-300 relative overflow-hidden group"
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 md:gap-8 mb-8 md:mb-10">
                    <div className="flex items-center gap-3 sm:gap-6 min-w-0">
                      <div className={`p-3.5 sm:p-5 shrink-0 bg-primary-electric rounded-2xl shadow-xl shadow-primary-electric/20 ${['In Wash', 'In Dryer'].includes(booking.status) ? 'animate-pulse' : ''}`}>
                        <Loader2 className={`w-6 h-6 sm:w-8 sm:h-8 text-white ${['In Wash', 'In Dryer'].includes(booking.status) ? 'animate-spin' : ''}`} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 sm:gap-3 mb-1.5 flex-wrap">
                          <p className="text-[10px] font-black text-primary-electric dark:text-primary-electric-light uppercase tracking-widest">{booking.serviceType}</p>
                          <span className="text-[10px] font-black text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-surface-low px-2.5 sm:px-3 py-1 rounded-full uppercase tracking-widest">M#{booking.machineNumber}</span>
                        </div>
                        <h3 className="text-xl sm:text-2xl md:text-3xl font-display font-black text-gray-800 dark:text-high-contrast tracking-tight uppercase break-words leading-tight">{getStatusLabel(booking.status)}</h3>
                      </div>
                    </div>
                    {booking.garmentInstructions && (
                      <div className="p-4 bg-amber-50 dark:bg-amber-900/10 rounded-2xl border border-amber-100/50 dark:border-amber-900/20">
                        <p className="text-[10px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-widest mb-1">Your Instructions</p>
                        <p className="text-xs text-amber-800 dark:text-amber-200 font-medium italic">"{booking.garmentInstructions}"</p>
                      </div>
                    )}
                    <div className="text-left md:text-right">
                      <p className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1">Scheduled For</p>
                      <p className="text-sm font-black text-gray-700 dark:text-gray-300 uppercase tracking-tight">{booking.date} • {booking.timeSlot}</p>
                    </div>
                  </div>

                  <div className="relative overflow-hidden pt-2 pb-2 sm:pb-4">
                    <div className="w-full relative min-h-[75px] sm:min-h-[96px] flex flex-col justify-center">
                      <div className="flex justify-between items-start relative z-10 w-full">
                        {steps.map((step, idx) => {
                          const isCompleted = idx < displayStepIndex;
                          const isCurrent = idx === currentStepIndex && !isEffectivelyComplete;

                          return (
                            <motion.div 
                              key={idx} 
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: 0.3 + idx * 0.1 }}
                              className="flex flex-col items-center flex-1 text-center group min-w-0 relative"
                            >
                              {/* Background line to next step */}
                              {idx < steps.length - 1 && (
                                <div className="absolute top-3.5 sm:top-5 left-1/2 w-full h-0.5 sm:h-1 bg-gray-100 dark:bg-surface-low -z-10" />
                              )}
                              {/* Active line to next step */}
                              {idx < steps.length - 1 && (
                                <motion.div 
                                  initial={{ width: '0%' }}
                                  animate={{ 
                                    width: (idx < currentStepIndex || isEffectivelyComplete) ? '100%' : '0%' 
                                  }}
                                  transition={{ type: "spring", stiffness: 50, damping: 20 }}
                                  className="absolute top-3.5 sm:top-5 left-1/2 h-0.5 sm:h-1 bg-primary-electric shadow-[0_0_10px_rgba(var(--primary-electric),0.5)] -z-10 origin-left" 
                                />
                              )}
                              <motion.div 
                                animate={isCurrent ? { scale: [1, 1.15, 1] } : {}}
                                transition={isCurrent ? { repeat: Infinity, duration: 2 } : {}}
                                className={`w-7 h-7 sm:w-10 sm:h-10 rounded-full shrink-0 flex items-center justify-center transition-all duration-700 relative z-10 ${
                                  isCompleted ? 'bg-primary-electric text-white' : 
                                  isCurrent ? 'bg-white dark:bg-surface-container border-2 sm:border-4 border-primary-electric text-primary-electric shadow-md sm:shadow-xl shadow-primary-electric/20' : 
                                  'bg-white dark:bg-surface-container border-2 sm:border-4 border-gray-100 dark:border-surface-low text-gray-200 dark:text-gray-700'
                                }`}
                              >
                                {isCompleted ? (
                                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}>
                                    <CheckCircle2 className="w-4 h-4 sm:w-6 sm:h-6" />
                                  </motion.div>
                                ) : (
                                  <div className={`w-2 h-2 sm:w-3 sm:h-3 rounded-full ${isCurrent ? 'bg-primary-electric animate-pulse' : 'bg-gray-200 dark:bg-gray-700'}`} />
                                )}
                              </motion.div>
                              <p className={`mt-1.5 sm:mt-4 text-[8px] sm:text-[10px] font-black uppercase tracking-tighter text-center w-full px-0.5 truncate sm:whitespace-normal transition-colors duration-700 ${
                                isCurrent ? 'text-primary-electric dark:text-primary-electric-light' : 
                                isCompleted ? 'text-gray-500 dark:text-gray-400' : 
                                'text-gray-200 dark:text-gray-700'
                              }`}>
                                {step.label}
                              </p>
                            </motion.div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                  
                  {/* Ambient Glow */}
                  <div className="absolute -left-10 -bottom-10 w-40 h-40 bg-primary-electric/5 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-700" />
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      <AnimatePresence mode="wait">
        {view === 'advance' && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-10 overflow-hidden"
          >
            <div className="flex gap-4 overflow-x-auto pb-6 scrollbar-hide">
              {[...Array(7)].map((_, i) => {
                const date = addDays(new Date(), i);
                const isSelected = isSameDay(date, selectedDate);
                return (
                  <button
                    key={i}
                    onClick={() => setSelectedDate(date)}
                    className={`flex-shrink-0 w-24 py-6 rounded-2xl transition-all flex flex-col items-center justify-center haptic-feedback ${
                      isSelected ? 'bg-primary-electric text-white shadow-2xl shadow-primary-electric/20' : 'bg-white dark:bg-surface-container text-gray-400 dark:text-gray-500 hover:bg-gray-50 dark:hover:bg-surface-highest'
                    }`}
                  >
                    <span className="text-[10px] uppercase font-black tracking-widest opacity-60 mb-2">{format(date, 'EEE')}</span>
                    <span className="text-2xl font-display font-black">{format(date, 'd')}</span>
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
        {loading ? (
          <div className="col-span-full flex flex-col items-center justify-center py-24 text-center">
            <Loader2 className="w-12 h-12 text-primary-electric animate-spin mb-6" />
            <p className="text-gray-400 dark:text-gray-500 font-black uppercase tracking-widest">Loading slots...</p>
            <p className="mt-6 text-[10px] text-gray-400 dark:text-gray-600 italic max-w-xs mx-auto font-medium uppercase tracking-widest leading-relaxed">
              "We take utmost care in handling your garments and aim to provide a reliable, efficient laundry experience."
            </p>
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
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                whileHover={!isUnavailable ? { scale: 1.02, y: -6 } : {}}
                whileTap={!isUnavailable ? { scale: 0.98 } : {}}
                onClick={() => handleSlotSelect(slot)}
                disabled={isUnavailable}
                className={`p-3.5 sm:p-8 rounded-2xl text-left transition-all flex flex-col justify-between h-36 sm:h-56 relative overflow-hidden group haptic-feedback ${
                  isUnavailable 
                    ? 'bg-gray-50/50 dark:bg-surface-low/50 opacity-40 cursor-not-allowed grayscale' 
                    : 'bg-white dark:bg-surface-container shadow-xl shadow-black/5 dark:shadow-none hover:shadow-2xl hover:shadow-primary-electric/10'
                }`}
              >
                <div className="flex justify-between items-start w-full relative z-10 gap-1">
                  <div className={`p-2 sm:p-4 rounded-xl sm:rounded-2xl shrink-0 ${isUnavailable ? 'bg-gray-100 dark:bg-surface-low' : 'bg-primary-electric/10'}`}>
                    <Clock className={`w-4 h-4 sm:w-7 sm:h-7 ${isUnavailable ? 'text-gray-400 dark:text-gray-500' : 'text-primary-electric dark:text-primary-electric-light'}`} />
                  </div>
                  {user?.isSuspended ? (
                    <span className="px-1.5 py-0.5 sm:px-3 sm:py-1 bg-red-500 text-white text-[8px] sm:text-[9px] font-black rounded-full uppercase tracking-wider sm:tracking-widest">Suspended</span>
                  ) : isStorePaused ? (
                    <span className="px-1.5 py-0.5 sm:px-3 sm:py-1 bg-amber-500 text-white text-[8px] sm:text-[9px] font-black rounded-full uppercase tracking-wider sm:tracking-widest">Paused</span>
                  ) : isPaused ? (
                    <span className="px-1.5 py-0.5 sm:px-3 sm:py-1 bg-amber-500 text-white text-[8px] sm:text-[9px] font-black rounded-full uppercase tracking-wider sm:tracking-widest">Paused</span>
                  ) : isFull ? (
                    <span className="px-1.5 py-0.5 sm:px-3 sm:py-1 bg-red-500 text-white text-[8px] sm:text-[9px] font-black rounded-full uppercase tracking-wider sm:tracking-widest">Full</span>
                  ) : isPast ? (
                    <span className="px-1.5 py-0.5 sm:px-3 sm:py-1 bg-gray-400 text-white text-[8px] sm:text-[9px] font-black rounded-full uppercase tracking-wider sm:tracking-widest">Past</span>
                  ) : (
                    <span className="px-1.5 py-0.5 sm:px-3 sm:py-1 bg-green-500 text-white text-[8px] sm:text-[9px] font-black rounded-full uppercase tracking-wider sm:tracking-widest">Available</span>
                  )}
                </div>
                
                <div className="relative z-10 w-full min-w-0">
                  <h3 className={`text-xs xs:text-sm sm:text-2xl font-display font-black tracking-tighter sm:tracking-tight uppercase truncate ${isUnavailable ? 'text-gray-400 dark:text-gray-500' : 'text-gray-800 dark:text-high-contrast'}`}>{slot}</h3>
                  <div className="flex items-center mt-1 sm:mt-3">
                    <div className="flex -space-x-1 sm:-space-x-1.5 mr-2 sm:mr-4 shrink-0">
                      {[...Array(4)].map((_, i) => (
                        <div 
                          key={i} 
                          className={`w-2 h-2 sm:w-3 sm:h-3 rounded-full ring-1 sm:ring-2 ring-white dark:ring-surface-container ${i < (4 - availability) ? 'bg-primary-electric' : 'bg-gray-100 dark:bg-surface-low'}`}
                        />
                      ))}
                    </div>
                    <span className={`text-[8px] sm:text-[10px] font-black uppercase tracking-wider sm:tracking-widest truncate ${isUnavailable ? 'text-gray-400 dark:text-gray-500' : 'text-gray-500 dark:text-gray-400'}`}>
                      {availability} left
                    </span>
                  </div>
                </div>

                {/* Ambient Glow */}
                {!isUnavailable && (
                  <div className="absolute -right-10 -bottom-10 w-32 h-32 bg-primary-electric/5 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-700" />
                )}
              </motion.button>
            );
          })
        )}
      </div>

      <div className="mt-20 pt-12 border-t border-gray-50 dark:border-surface-low">
        <div className="flex flex-col md:flex-row items-center justify-between gap-8 bg-gray-50 dark:bg-surface-low p-10 rounded-2xl relative overflow-hidden group">
          <div className="relative z-10">
            <h3 className="text-2xl font-display font-black text-gray-800 dark:text-high-contrast tracking-tight uppercase mb-3">Need help?</h3>
            <p className="text-sm text-gray-400 dark:text-gray-500 font-medium uppercase tracking-widest leading-relaxed">Review our service policies and guidelines <br /> to ensure the best care for your garments.</p>
          </div>
          <button
            onClick={() => setShowTerms(true)}
            className="flex items-center gap-4 px-10 py-5 bg-white dark:bg-surface-highest text-gray-700 dark:text-high-contrast font-black uppercase tracking-widest rounded-2xl transition-all shadow-xl shadow-black/5 group relative z-10 haptic-feedback"
          >
            <FileText className="w-6 h-6 text-gray-400 group-hover:text-primary-electric transition-colors" />
            Terms & Conditions
          </button>
          
          <div className="absolute -right-12 -bottom-12 w-48 h-48 bg-primary-electric/5 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-700" />
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
