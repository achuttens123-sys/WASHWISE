import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Calendar, Clock, CheckCircle2, XCircle, ChevronRight, Loader2, CalendarDays, Circle, FileText } from 'lucide-react';
import { collection, query, where, getDocs, doc, getDoc, onSnapshot, orderBy } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { TIME_SLOTS, Slot, Booking } from '../types';
import { format, addDays, isSameDay } from 'date-fns';
import TermsModal from '../components/TermsModal';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [view, setView] = useState<'today' | 'advance'>('today');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [slotsData, setSlotsData] = useState<Record<string, Slot>>({});
  const [loading, setLoading] = useState(true);
  const [activeBookings, setActiveBookings] = useState<Booking[]>([]);
  const [showTerms, setShowTerms] = useState(false);

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
      const bookings = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Booking[];
      setActiveBookings(bookings);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'bookings');
    });

    return () => unsubscribe();
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
    if (!slot) return 4; // All 4 machines available if no slot document exists yet
    
    let occupiedCount = 0;
    Object.values(slot.machines).forEach(uid => {
      if (uid) occupiedCount++;
    });
    
    return 4 - occupiedCount;
  };

  const isSlotInPast = (slot: string) => {
    if (!isSameDay(selectedDate, new Date())) return false;
    
    const [timeRange, period] = slot.split(' ');
    const [startTime] = timeRange.split('-');
    let [hours, minutes] = startTime.split(':').map(Number);
    
    // Logic for the specific format in TIME_SLOTS: "HH:mm-HH:mm AM/PM"
    if (period === 'PM') {
      if (hours < 11) hours += 12; // 12 PM stays 12, 1-10 PM becomes 13-22. 11 PM is not in our list but would stay 11 (AM) if it was 11:00-12:00 PM
    } else if (period === 'AM') {
      if (hours === 12) hours = 0;
    }
    
    const slotTime = new Date();
    slotTime.setHours(hours, minutes, 0, 0);
    
    return slotTime < new Date();
  };

  const handleSlotSelect = (timeSlot: string) => {
    if (user?.userType === 'subscriber' && !user?.subscriptionPaid) {
      navigate(`/billing?type=subscription&packageId=${user.package}`);
      return;
    }
    const availability = getMachineAvailability(timeSlot);
    const isPast = isSlotInPast(timeSlot);
    if (availability === 0 || isPast) return;
    
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    navigate(`/booking-details?date=${dateStr}&slot=${encodeURIComponent(timeSlot)}`);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-4 sm:py-8">
      {user?.userType === 'subscriber' && !user?.subscriptionPaid && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-3 sm:p-4 rounded-xl sm:rounded-2xl mb-6 sm:mb-8 flex items-center justify-between gap-3"
        >
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="bg-amber-100 dark:bg-amber-800 p-1.5 sm:p-2 rounded-lg">
              <XCircle className="w-4 h-4 sm:w-5 sm:h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="font-bold text-amber-800 dark:text-amber-100 text-xs sm:text-sm">Subscription Payment Required</p>
              <p className="text-amber-600 dark:text-amber-400 text-[10px] sm:text-xs">Complete payment to start booking.</p>
            </div>
          </div>
          <button
            onClick={() => navigate(`/billing?type=subscription&packageId=${user.package}`)}
            className="px-3 sm:px-4 py-1.5 sm:py-2 bg-amber-600 text-white text-[10px] sm:text-xs font-bold rounded-lg sm:rounded-xl hover:bg-amber-700 transition-all shrink-0"
          >
            Pay Now
          </button>
        </motion.div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 sm:gap-6 mb-6 sm:mb-8">
        <div className="md:col-span-3">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-blue-600 rounded-xl sm:rounded-2xl flex items-center justify-center shadow-lg shadow-blue-200 dark:shadow-blue-900/20 shrink-0">
                <span className="text-xl sm:text-2xl font-black text-white">{user?.name?.[0]?.toUpperCase()}</span>
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 dark:text-gray-100">Welcome, {user?.name}</h1>
                <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-1">
                  <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Book your laundry slot below</p>
                  {user?.userType === 'subscriber' && user?.package && user?.subscriptionPaid && (
                    <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-[9px] sm:text-[10px] font-black uppercase tracking-widest rounded-full">
                      {user.package} Plan
                    </span>
                  )}
                  <button 
                    onClick={() => setShowTerms(true)}
                    className="text-[10px] sm:text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline transition-all flex items-center gap-1"
                  >
                    <FileText className="w-3 h-3" />
                    Terms
                  </button>
                </div>
              </div>
            </div>
            
            <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-lg sm:rounded-xl w-fit">
              <button
                onClick={() => { setView('today'); setSelectedDate(new Date()); }}
                className={`px-4 sm:px-6 py-1.5 sm:py-2 rounded-md sm:rounded-lg text-xs sm:text-sm font-medium transition-all ${view === 'today' ? 'bg-white dark:bg-gray-700 shadow-sm text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
              >
                Today
              </button>
              <button
                onClick={() => setView('advance')}
                className={`px-4 sm:px-6 py-1.5 sm:py-2 rounded-md sm:rounded-lg text-xs sm:text-sm font-medium transition-all ${view === 'advance' ? 'bg-white dark:bg-gray-700 shadow-sm text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
              >
                Advance
              </button>
            </div>
          </div>
        </div>

        <div className="md:col-span-1">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-indigo-600 dark:bg-indigo-700 p-4 sm:p-6 rounded-2xl sm:rounded-[2rem] text-white shadow-xl shadow-indigo-200 dark:shadow-indigo-900/20 relative overflow-hidden group"
          >
            <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/10 rounded-full blur-2xl opacity-0 group-hover:opacity-100 group-hover:scale-150 transition-all duration-500" />
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-3 sm:mb-4">
                <div className="p-1.5 sm:p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                  <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                </div>
                <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest opacity-80">Loyalty Points</span>
              </div>
              <p className="text-3xl sm:text-4xl font-black tracking-tighter mb-1">{user?.points || 0}</p>
              <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest opacity-60">Available Balance</p>
              
              <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-white/10">
                <div className="flex justify-between items-end">
                  <div>
                    <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest opacity-60 mb-1">Next Free Wash</p>
                    <div className="w-20 sm:w-24 h-1 sm:h-1.5 bg-white/20 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-white transition-all duration-1000" 
                        style={{ width: `${Math.min(100, ((user?.points || 0) / 200) * 100)}%` }}
                      />
                    </div>
                  </div>
                  <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest">
                    {Math.max(0, 200 - (user?.points || 0))} pts left
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {activeBookings.length > 0 && (
        <div className="mb-10">
          <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4 ml-1">Active Wash Status</h2>
          <div className="grid grid-cols-1 gap-6">
            {activeBookings.map((booking) => {
              const steps = booking.pickupDrop ? [
                { label: 'Booking confirmed', statuses: ['paid', 'Ready for pick up', 'In Wash', 'In Drier', 'Washing completed', 'Out for delivery', 'completed'] },
                { label: 'Ready for Pickup', statuses: ['Ready for pick up', 'In Wash', 'In Drier', 'Washing completed', 'Out for delivery', 'completed'] },
                { label: 'In wash', statuses: ['In Wash', 'In Drier', 'Washing completed', 'Out for delivery', 'completed'] },
                { label: 'In Drier', statuses: ['In Drier', 'Washing completed', 'Out for delivery', 'completed'] },
                { label: 'Washing completed', statuses: ['Washing completed', 'Out for delivery', 'completed'] },
                { label: 'Out for delivery', statuses: ['Out for delivery', 'completed'] }
              ] : [
                { label: 'Booking confirmed', statuses: ['paid', 'In Wash', 'In Drier', 'Washing completed', 'Ready to collect', 'completed'] },
                { label: 'In wash', statuses: ['In Wash', 'In Drier', 'Washing completed', 'Ready to collect', 'completed'] },
                { label: 'In Drier', statuses: ['In Drier', 'Washing completed', 'Ready to collect', 'completed'] },
                { label: 'Washing Completed', statuses: ['Washing completed', 'Ready to collect', 'completed'] },
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

              return (
                <motion.div
                  key={booking.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white dark:bg-gray-900 p-4 sm:p-6 rounded-2xl sm:rounded-[2rem] border border-blue-50 dark:border-gray-800 shadow-xl shadow-blue-100/20 dark:shadow-none"
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 sm:mb-8">
                    <div className="flex items-center gap-3 sm:gap-4">
                      <div className="p-2 sm:p-3 bg-blue-600 rounded-xl sm:rounded-2xl shadow-lg shadow-blue-200 dark:shadow-none">
                        <Loader2 className={`w-5 h-5 sm:w-6 sm:h-6 text-white ${['In Wash', 'In Drier'].includes(booking.status) ? 'animate-spin' : ''}`} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-[10px] sm:text-xs font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest">{booking.serviceType}</p>
                          <span className="text-[9px] sm:text-[10px] font-black text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-lg">M#{booking.machineNumber}</span>
                        </div>
                        <h3 className="text-lg sm:text-xl font-black text-gray-800 dark:text-gray-100 tracking-tight">{booking.status.toUpperCase()}</h3>
                      </div>
                    </div>
                    <div className="text-left md:text-right">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Scheduled For</p>
                      <p className="text-xs sm:text-sm font-black text-gray-700 dark:text-gray-300">{booking.date} • {booking.timeSlot}</p>
                    </div>
                  </div>

                  <div className="relative overflow-x-auto pb-2 scrollbar-hide">
                    <div className="min-w-[400px] relative">
                      {/* Progress Line */}
                      <div className="absolute top-4 left-4 right-4 h-0.5 bg-gray-100 dark:bg-gray-800 -z-0" />
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${(currentStepIndex / (steps.length - 1)) * 100}%` }}
                        className="absolute top-4 left-4 h-0.5 bg-blue-600 -z-0" 
                      />

                      <div className="flex justify-between relative z-10">
                        {steps.map((step, idx) => {
                          const isCompleted = idx < currentStepIndex;
                          const isCurrent = idx === currentStepIndex;
                          const isPending = idx > currentStepIndex;

                          return (
                            <div key={idx} className="flex flex-col items-center group">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-500 ${
                                isCompleted ? 'bg-blue-600 text-white' : 
                                isCurrent ? 'bg-white dark:bg-gray-900 border-4 border-blue-600 text-blue-600 scale-125 shadow-lg shadow-blue-200 dark:shadow-none' : 
                                'bg-white dark:bg-gray-900 border-4 border-gray-100 dark:border-gray-800 text-gray-300'
                              }`}>
                                {isCompleted ? <CheckCircle2 className="w-5 h-5" /> : <Circle className="w-2 h-2 fill-current" />}
                              </div>
                              <p className={`mt-3 text-[9px] sm:text-[10px] font-black uppercase tracking-tighter text-center max-w-[60px] transition-colors duration-500 ${
                                isCurrent ? 'text-blue-600 dark:text-blue-400' : 
                                isCompleted ? 'text-gray-600 dark:text-gray-300' : 
                                'text-gray-300 dark:text-gray-600'
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

      <AnimatePresence mode="wait">
        {view === 'advance' && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-8 overflow-hidden"
          >
            <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-hide">
              {[...Array(7)].map((_, i) => {
                const date = addDays(new Date(), i);
                const isSelected = isSameDay(date, selectedDate);
                return (
                  <button
                    key={i}
                    onClick={() => setSelectedDate(date)}
                    className={`flex-shrink-0 w-20 py-4 rounded-2xl border-2 transition-all flex flex-col items-center justify-center ${
                      isSelected ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-200 dark:shadow-blue-900/20' : 'bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800 text-gray-600 dark:text-gray-400 hover:border-blue-200'
                    }`}
                  >
                    <span className="text-xs uppercase font-bold opacity-70">{format(date, 'EEE')}</span>
                    <span className="text-xl font-bold">{format(date, 'd')}</span>
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full flex flex-col items-center justify-center py-20 text-center">
            <Loader2 className="w-10 h-10 text-blue-600 animate-spin mb-4" />
            <p className="text-gray-500 dark:text-gray-400 font-medium tracking-tight">Loading slots...</p>
            <p className="mt-4 text-[10px] text-gray-400 dark:text-gray-600 italic max-w-xs mx-auto">
              "We take utmost care in handling your garments and aim to provide a reliable, hygienic, and efficient laundry experience."
            </p>
          </div>
        ) : (
          TIME_SLOTS.map((slot, index) => {
            const availability = getMachineAvailability(slot);
            const isFull = availability === 0;
            const isPast = isSlotInPast(slot);
            const isUnavailable = isFull || isPast || user?.isSuspended;
            
            return (
              <motion.button
                key={slot}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                whileHover={!isUnavailable ? { scale: 1.02, translateY: -4 } : {}}
                whileTap={!isUnavailable ? { scale: 0.98 } : {}}
                onClick={() => handleSlotSelect(slot)}
                disabled={isUnavailable}
                className={`p-6 rounded-3xl border-2 text-left transition-all flex flex-col justify-between h-48 ${
                  isUnavailable 
                    ? 'bg-gray-100/50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 opacity-40 cursor-not-allowed grayscale' 
                    : 'bg-white dark:bg-gray-900 border-blue-50 dark:border-blue-900/20 hover:border-blue-500 hover:shadow-xl hover:shadow-blue-100 dark:hover:shadow-blue-900/20'
                }`}
              >
                <div className="flex justify-between items-start w-full">
                  <div className={`p-3 rounded-2xl ${isUnavailable ? 'bg-gray-200 dark:bg-gray-700' : 'bg-blue-50 dark:bg-blue-900/20'}`}>
                    <Clock className={`w-6 h-6 ${isUnavailable ? 'text-gray-400 dark:text-gray-500' : 'text-blue-600 dark:text-blue-400'}`} />
                  </div>
                  {user?.isSuspended ? (
                    <span className="px-3 py-1 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-[10px] font-black rounded-full uppercase tracking-widest">Account Suspended</span>
                  ) : isFull ? (
                    <span className="px-3 py-1 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-[10px] font-black rounded-full uppercase tracking-widest">Slot Full</span>
                  ) : isPast ? (
                    <span className="px-3 py-1 bg-gray-200 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-[10px] font-black rounded-full uppercase tracking-widest">Past Slot</span>
                  ) : (
                    <span className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 text-[10px] font-black rounded-full uppercase tracking-widest">Available</span>
                  )}
                </div>
                
                <div>
                  <h3 className={`text-lg font-black tracking-tight ${isUnavailable ? 'text-gray-400 dark:text-gray-500' : 'text-gray-800 dark:text-gray-100'}`}>{slot}</h3>
                  <div className="flex items-center mt-2">
                    <div className="flex -space-x-1 mr-3">
                      {[...Array(4)].map((_, i) => (
                        <div 
                          key={i} 
                          className={`w-2.5 h-2.5 rounded-full border border-white dark:border-gray-800 ${i < (4 - availability) ? 'bg-blue-500' : 'bg-gray-200 dark:bg-gray-700'}`}
                        />
                      ))}
                    </div>
                    <span className={`text-[11px] font-bold uppercase tracking-wider ${isUnavailable ? 'text-gray-400 dark:text-gray-500' : 'text-gray-600 dark:text-gray-400'}`}>
                      {availability} machines left
                    </span>
                  </div>
                </div>
              </motion.button>
            );
          })
        )}
      </div>

      <div className="mt-16 pt-8 border-t border-gray-100 dark:border-gray-800">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 bg-gray-50 dark:bg-gray-900/50 p-8 rounded-[2.5rem]">
          <div>
            <h3 className="text-xl font-black text-gray-800 dark:text-gray-100 tracking-tight mb-2">Need help?</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">Review our service policies and guidelines to ensure the best care for your garments.</p>
          </div>
          <button
            onClick={() => setShowTerms(true)}
            className="flex items-center gap-3 px-8 py-4 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 font-bold rounded-2xl border border-gray-200 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400 transition-all shadow-sm group"
          >
            <FileText className="w-5 h-5 text-gray-400 group-hover:text-blue-500 transition-colors" />
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
  );
};

export default Dashboard;
