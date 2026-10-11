import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Loader2, 
  Calendar, 
  Shield, 
  Wallet, 
  AlertCircle, 
  ArrowRight, 
  Search, 
  RefreshCw, 
  Plus, 
  ChevronRight, 
  MapPin, 
  FileText, 
  X, 
  Zap, 
  Sparkles, 
  Package, 
  RotateCcw,
  HelpCircle,
  Check
} from 'lucide-react';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { Booking, Store } from '../types';
import FeedbackModal from '../components/FeedbackModal';

const Orders: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();

  const tabParam = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState<'active' | 'history'>(
    tabParam === 'history' ? 'history' : 'active'
  );

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [historyFilter, setHistoryFilter] = useState<'all' | 'completed' | 'cancelled'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Details Modal
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  // Feedback/Support Modal
  const [isSupportModalOpen, setIsSupportModalOpen] = useState(false);
  const [supportBookingId, setSupportBookingId] = useState<string | undefined>(undefined);

  // Sync tab with URL search parameter
  useEffect(() => {
    if (tabParam === 'history' && activeTab !== 'history') {
      setActiveTab('history');
    } else if (tabParam === 'active' && activeTab !== 'active') {
      setActiveTab('active');
    }
  }, [tabParam]);

  const handleTabChange = (tab: 'active' | 'history') => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  // Real-time Firestore bookings listener
  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const q = query(
      collection(db, 'bookings'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Booking[];
        setBookings(data);
        setLoading(false);
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, 'bookings');
        setLoading(false);
      }
    );

    const unsubStores = onSnapshot(
      collection(db, 'stores'),
      (snapshot) => {
        setStores(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as Store[]);
      },
      (error) => {
        console.warn('Error fetching stores:', error);
      }
    );

    return () => {
      unsubscribe();
      unsubStores();
    };
  }, [user]);

  // Separate active orders from history
  const { activeOrders, pastOrders } = useMemo(() => {
    const active: Booking[] = [];
    const past: Booking[] = [];

    bookings.forEach((booking) => {
      const isTerminal = ['completed', 'rejected', 'cancelled'].includes(booking.status);
      if (isTerminal) {
        past.push(booking);
      } else {
        active.push(booking);
      }
    });

    return { activeOrders: active, pastOrders: past };
  }, [bookings]);

  // Filter past orders by status and search query
  const filteredPastOrders = useMemo(() => {
    return pastOrders.filter((b) => {
      // Status filter
      if (historyFilter === 'completed' && b.status !== 'completed') return false;
      if (historyFilter === 'cancelled' && !['rejected', 'cancelled'].includes(b.status)) return false;

      // Search query
      if (searchQuery.trim()) {
        const queryLower = searchQuery.toLowerCase().trim();
        const bookingId = (b.bookingId || b.id || '').toLowerCase();
        const serviceType = (b.serviceType || '').toLowerCase();
        const date = (b.date || '').toLowerCase();
        const status = (b.status || '').toLowerCase();

        return (
          bookingId.includes(queryLower) ||
          serviceType.includes(queryLower) ||
          date.includes(queryLower) ||
          status.includes(queryLower)
        );
      }

      return true;
    });
  }, [pastOrders, historyFilter, searchQuery]);

  // Helper for tracking steps on active bookings
  const getStepData = (booking: Booking) => {
    const isPickupDrop = booking.pickupDrop;
    const steps = isPickupDrop
      ? [
          { label: 'Confirmed', statuses: ['paid', 'pending'] },
          { label: 'Pickup Ready', statuses: ['Ready for pick up'] },
          { label: 'In Wash', statuses: ['In Wash', 'In Dryer'] },
          { label: 'Washed', statuses: ['Washing completed', 'Ready to deliver'] },
          { label: 'Out for Delivery', statuses: ['Out for delivery', 'completed'] },
        ]
      : [
          { label: 'Confirmed', statuses: ['paid', 'pending'] },
          { label: 'In Wash', statuses: ['In Wash', 'In Dryer'] },
          { label: 'Washed', statuses: ['Washing completed'] },
          { label: 'Pickup Ready', statuses: ['Ready to collect', 'completed'] },
        ];

    let currentStepIndex = 0;
    for (let i = steps.length - 1; i >= 0; i--) {
      if (steps[i].statuses.includes(booking.status)) {
        currentStepIndex = i;
        break;
      }
    }

    return { steps, currentStepIndex };
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
            Completed
          </span>
        );
      case 'rejected':
      case 'cancelled':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300 border border-red-200 dark:border-red-800">
            <XCircle className="w-3 h-3 text-red-500" />
            {status}
          </span>
        );
      case 'In Wash':
      case 'In Dryer':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
            <Loader2 className="w-3 h-3 text-blue-500 animate-spin" />
            {status}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-primary-electric/10 text-primary-electric dark:text-primary-electric-light border border-primary-electric/20">
            <span className="w-1.5 h-1.5 rounded-full bg-primary-electric animate-pulse" />
            {status}
          </span>
        );
    }
  };

  const getStoreName = (storeId?: string) => {
    if (!storeId) return 'Main Laundry Hub';
    const store = stores.find((s) => s.id === storeId);
    return store?.name || 'Main Laundry Hub';
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-3.5 sm:space-y-6 select-none px-1 sm:px-0">
      {/* Top Header & Page Title - Compact Mobile */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-4 pb-2 border-b border-gray-100 dark:border-surface-highest/10">
        <div>
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] sm:text-[10px] font-black uppercase tracking-wider bg-primary-electric/10 text-primary-electric dark:text-primary-electric-light">
              <Clock className="w-2.5 h-2.5 sm:w-3 sm:h-3" /> Laundry Portal
            </span>
            {activeOrders.length > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] sm:text-[10px] font-black uppercase tracking-wider bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200/50">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                {activeOrders.length} In Progress
              </span>
            )}
          </div>
          <h1 className="text-xl sm:text-3xl font-display font-black text-gray-800 dark:text-high-contrast tracking-tight uppercase leading-tight">
            My Orders
          </h1>
          <p className="text-[11px] sm:text-xs font-medium text-gray-500 dark:text-gray-400">
            Real-time wash tracking and verified order receipts
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-1.5 px-3 py-2 sm:px-4 sm:py-2.5 bg-primary-electric hover:bg-blue-600 text-white rounded-xl text-[11px] sm:text-xs font-black uppercase tracking-wider transition-all shadow-md shadow-primary-electric/25 haptic-feedback shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Book New Wash</span>
          </button>
        </div>
      </div>

      {/* Main Tab Switcher - Compact */}
      <div className="flex p-0.5 sm:p-1 bg-gray-100 dark:bg-surface-low rounded-xl sm:rounded-2xl max-w-sm w-full border border-gray-200/50 dark:border-surface-highest/20 relative shadow-inner">
        <button
          onClick={() => handleTabChange('active')}
          className={`flex-1 py-2 sm:py-2.5 px-2.5 sm:px-4 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 relative z-10 ${
            activeTab === 'active'
              ? 'bg-white dark:bg-surface-container text-primary-electric dark:text-primary-electric-light shadow-sm'
              : 'text-gray-500 hover:text-gray-900 dark:hover:text-gray-200'
          }`}
        >
          <span className="relative flex items-center gap-1">
            {activeOrders.length > 0 && (
              <span className="w-1.5 h-1.5 rounded-full bg-primary-electric animate-pulse" />
            )}
            Active
          </span>
          <span
            className={`px-1.5 py-0.2 rounded-full text-[9px] font-black ${
              activeTab === 'active'
                ? 'bg-primary-electric/10 text-primary-electric'
                : 'bg-gray-200 dark:bg-surface-highest text-gray-600 dark:text-gray-300'
            }`}
          >
            {activeOrders.length}
          </span>
        </button>

        <button
          onClick={() => handleTabChange('history')}
          className={`flex-1 py-2 sm:py-2.5 px-2.5 sm:px-4 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 relative z-10 ${
            activeTab === 'history'
              ? 'bg-white dark:bg-surface-container text-primary-electric dark:text-primary-electric-light shadow-sm'
              : 'text-gray-500 hover:text-gray-900 dark:hover:text-gray-200'
          }`}
        >
          <span>History</span>
          <span
            className={`px-1.5 py-0.2 rounded-full text-[9px] font-black ${
              activeTab === 'history'
                ? 'bg-primary-electric/10 text-primary-electric'
                : 'bg-gray-200 dark:bg-surface-highest text-gray-600 dark:text-gray-300'
            }`}
          >
            {pastOrders.length}
          </span>
        </button>
      </div>

      {/* Main Tab Content */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-12 sm:py-24 text-center">
          <Loader2 className="w-8 h-8 sm:w-12 sm:h-12 animate-spin text-primary-electric mb-3" />
          <p className="text-xs sm:text-base font-display font-black text-gray-700 dark:text-gray-300 uppercase tracking-tight">
            Syncing Orders...
          </p>
          <p className="text-[11px] text-gray-400 mt-0.5">Connecting to live updates</p>
        </div>
      ) : activeTab === 'active' ? (
        /* ================= ACTIVE ORDERS TAB ================= */
        <div className="space-y-3 sm:space-y-6">
          {activeOrders.length === 0 ? (
            <div className="text-center py-10 sm:py-20 bg-white dark:bg-surface-container rounded-2xl sm:rounded-3xl border border-dashed border-gray-200 dark:border-surface-highest/20 p-4 sm:p-12 shadow-xs">
              <div className="w-12 h-12 sm:w-20 sm:h-20 bg-blue-50 dark:bg-blue-900/20 rounded-2xl flex items-center justify-center mx-auto mb-3 text-primary-electric">
                <Package className="w-6 h-6 sm:w-10 sm:h-10" />
              </div>
              <h3 className="text-base sm:text-2xl font-display font-black text-gray-800 dark:text-high-contrast uppercase tracking-tight mb-1">
                No Active Washes Right Now
              </h3>
              <p className="text-[11px] sm:text-sm text-gray-500 dark:text-gray-400 max-w-sm mx-auto mb-4">
                You have no laundry orders in progress. Book a machine slot or doorstep pickup to get clean clothes.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <button
                  onClick={() => navigate('/dashboard')}
                  className="px-4 py-2 sm:px-6 sm:py-3 bg-primary-electric hover:bg-blue-600 text-white rounded-xl sm:rounded-2xl text-[11px] sm:text-xs font-black uppercase tracking-wider transition-all shadow-md shadow-primary-electric/25 flex items-center gap-1.5 haptic-feedback"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Book Laundry Slot</span>
                </button>
                {pastOrders.length > 0 && (
                  <button
                    onClick={() => handleTabChange('history')}
                    className="px-4 py-2 sm:px-6 sm:py-3 bg-gray-50 dark:bg-surface-low hover:bg-gray-100 dark:hover:bg-surface-highest text-gray-700 dark:text-gray-300 rounded-xl sm:rounded-2xl text-[11px] sm:text-xs font-black uppercase tracking-wider transition-all border border-gray-200 dark:border-surface-highest/20"
                  >
                    View History ({pastOrders.length})
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:gap-6">
              {activeOrders.map((booking, index) => {
                const { steps, currentStepIndex } = getStepData(booking);
                const isPickupDrop = booking.pickupDrop;

                return (
                  <motion.div
                    key={booking.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.04 }}
                    className="bg-white dark:bg-surface-container rounded-2xl sm:rounded-3xl p-3.5 sm:p-6 shadow-xs sm:shadow-lg border border-gray-100 dark:border-surface-highest/15 relative overflow-hidden group"
                  >
                    {/* Top status bar - Ultra compact & bounded */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2.5 sm:pb-4 border-b border-gray-100 dark:border-surface-highest/10">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`w-9 h-9 sm:w-12 sm:h-12 rounded-xl bg-primary-electric text-white shadow-xs flex items-center justify-center shrink-0 ${
                            ['In Wash', 'In Dryer'].includes(booking.status) ? 'animate-pulse' : ''
                          }`}
                        >
                          {['In Wash', 'In Dryer'].includes(booking.status) ? (
                            <Loader2 className="w-4 h-4 sm:w-6 sm:h-6 animate-spin" />
                          ) : (
                            <Zap className="w-4 h-4 sm:w-6 sm:h-6" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                            <span className="text-[10px] sm:text-xs font-black text-primary-electric dark:text-primary-electric-light uppercase tracking-wider truncate">
                              {booking.serviceType}
                            </span>
                            <span className="text-[9px] sm:text-[10px] font-black text-gray-500 bg-gray-100 dark:bg-surface-low px-1.5 py-0.5 rounded uppercase">
                              M#{booking.machineNumber}
                            </span>
                            <span className="text-[9px] sm:text-[10px] font-mono font-bold bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded truncate">
                              {booking.bookingId || `#${booking.id?.slice(-6).toUpperCase()}`}
                            </span>
                            {isPickupDrop ? (
                              <span className="text-[8.5px] sm:text-[10px] font-black bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 px-1.5 py-0.5 rounded uppercase">
                                Pickup & Drop
                              </span>
                            ) : (
                              <span className="text-[8.5px] sm:text-[10px] font-black bg-gray-100 dark:bg-surface-low text-gray-600 dark:text-gray-400 px-1.5 py-0.5 rounded uppercase">
                                Self Drop
                              </span>
                            )}
                          </div>
                          <h3 className="text-xs sm:text-lg font-display font-black text-gray-900 dark:text-high-contrast uppercase tracking-tight truncate">
                            Status: {booking.status}
                          </h3>
                        </div>
                      </div>

                      <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center shrink-0 pt-1 sm:pt-0 border-t sm:border-t-0 border-gray-50 dark:border-surface-highest/10">
                        <span className="text-[9px] sm:text-[10px] font-black text-gray-400 uppercase tracking-wider">
                          Slot:
                        </span>
                        <span className="text-[11px] sm:text-xs font-black text-gray-800 dark:text-gray-200 uppercase truncate">
                          {booking.date} • {booking.timeSlot}
                        </span>
                      </div>
                    </div>

                    {/* Step Tracker Progress Bar - Compact */}
                    <div className="py-2.5 sm:py-5">
                      {/* Mobile Step view */}
                      <div className="sm:hidden space-y-1.5">
                        <div className="flex gap-1 h-1.5 w-full bg-gray-100 dark:bg-surface-low rounded-full overflow-hidden p-0.5">
                          {steps.map((_, idx) => (
                            <div
                              key={idx}
                              className={`flex-1 rounded-full ${
                                idx <= currentStepIndex
                                  ? 'bg-primary-electric'
                                  : 'bg-transparent'
                              }`}
                            />
                          ))}
                        </div>
                        <div className="flex justify-between items-center text-[9.5px] font-bold text-gray-500 dark:text-gray-400 pt-0.5">
                          <span className="truncate">
                            Step {currentStepIndex + 1}/{steps.length}:{' '}
                            <strong className="text-primary-electric uppercase">
                              {steps[currentStepIndex].label}
                            </strong>
                          </span>
                          <span className="text-emerald-600 dark:text-emerald-400 font-black uppercase text-[8.5px] flex items-center gap-1 shrink-0">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Live
                          </span>
                        </div>
                      </div>

                      {/* Desktop Step view */}
                      <div className="hidden sm:block">
                        <div className="flex justify-between items-start relative w-full">
                          {steps.map((step, idx) => {
                            const isCompleted = idx < currentStepIndex;
                            const isCurrent = idx === currentStepIndex;

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
                                      idx < currentStepIndex ? 'w-full' : 'w-0'
                                    }`}
                                  />
                                )}
                                <div
                                  className={`w-7 h-7 rounded-full shrink-0 flex items-center justify-center relative z-10 transition-all ${
                                    isCompleted
                                      ? 'bg-primary-electric text-white'
                                      : isCurrent
                                      ? 'bg-white dark:bg-surface-container border-2 border-primary-electric text-primary-electric shadow-xs scale-105'
                                      : 'bg-white dark:bg-surface-container border-2 border-gray-200 dark:border-surface-low text-gray-300'
                                  }`}
                                >
                                  {isCompleted ? (
                                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                                  ) : isCurrent ? (
                                    <div className="w-2 h-2 rounded-full bg-primary-electric animate-pulse" />
                                  ) : (
                                    <div className="w-1.5 h-1.5 rounded-full bg-gray-200 dark:bg-surface-highest" />
                                  )}
                                </div>
                                <p
                                  className={`mt-1.5 text-[9px] font-black uppercase tracking-tight truncate w-full px-1 ${
                                    isCurrent
                                      ? 'text-primary-electric dark:text-primary-electric-light'
                                      : isCompleted
                                      ? 'text-gray-700 dark:text-gray-300'
                                      : 'text-gray-400 dark:text-gray-600'
                                  }`}
                                >
                                  {step.label}
                                </p>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    {/* Order summary info & action buttons - Compact */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-2.5 sm:pt-3 border-t border-gray-100 dark:border-surface-highest/10">
                      <div className="flex flex-wrap items-center gap-2.5 text-[10px] sm:text-xs min-w-0">
                        <div className="min-w-0">
                          <span className="text-[9px] font-black text-gray-400 uppercase tracking-wider block">
                            Hub
                          </span>
                          <span className="font-bold text-gray-800 dark:text-gray-200 truncate block max-w-[140px] sm:max-w-none">
                            {getStoreName(booking.storeId)}
                          </span>
                        </div>

                        <div className="h-4 w-px bg-gray-200 dark:bg-surface-highest/20" />

                        <div>
                          <span className="text-[9px] font-black text-gray-400 uppercase tracking-wider block">
                            Billing
                          </span>
                          <span className="font-bold text-gray-800 dark:text-gray-200">
                            ₹{Number(booking.price || 0).toFixed(0)}
                            {booking.paymentType === 'pay_at_store' && (
                              <span className="ml-1 text-amber-600 text-[9px] font-bold">
                                (COD Due: ₹{((booking.remainingAmount ?? (booking.price - (booking.prepaidAmount ?? 39))) || 0).toFixed(0)})
                              </span>
                            )}
                          </span>
                        </div>

                        {booking.garmentInstructions && (
                          <>
                            <div className="h-4 w-px bg-gray-200 dark:bg-surface-highest/20" />
                            <div className="max-w-[150px] sm:max-w-xs truncate">
                              <span className="text-[9px] font-black text-gray-400 uppercase tracking-wider block">
                                Care Note
                              </span>
                              <span className="font-medium text-gray-600 dark:text-gray-400 italic text-[10px] truncate block">
                                "{booking.garmentInstructions}"
                              </span>
                            </div>
                          </>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 self-end sm:self-auto shrink-0">
                        <button
                          onClick={() => {
                            setSupportBookingId(booking.bookingId || booking.id);
                            setIsSupportModalOpen(true);
                          }}
                          className="px-2.5 py-1.5 rounded-lg text-[10px] sm:text-xs font-bold text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-surface-highest transition-colors flex items-center gap-1"
                        >
                          <HelpCircle className="w-3 h-3" />
                          <span>Help</span>
                        </button>
                        <button
                          onClick={() => {
                            setSelectedBooking(booking);
                            setShowDetailsModal(true);
                          }}
                          className="px-3 py-1.5 bg-gray-900 dark:bg-surface-highest hover:bg-primary-electric dark:hover:bg-primary-electric text-white rounded-lg text-[10px] sm:text-xs font-black uppercase tracking-wider transition-colors flex items-center gap-1 shadow-xs"
                        >
                          <FileText className="w-3 h-3" />
                          <span>Receipt</span>
                        </button>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* ================= ORDER HISTORY TAB ================= */
        <div className="space-y-3 sm:space-y-4">
          {/* History Search & Filters Bar - Compact */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 bg-white dark:bg-surface-container p-2 sm:p-3 rounded-xl sm:rounded-2xl border border-gray-100 dark:border-surface-highest/15 shadow-xs">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search ID, service, or date..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-7 py-1.5 bg-gray-50 dark:bg-surface-low rounded-lg text-xs font-medium text-gray-800 dark:text-high-contrast border border-transparent focus:border-primary-electric focus:bg-white dark:focus:bg-surface-highest focus:outline-none transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Filter pills */}
            <div className="flex items-center gap-1 shrink-0 overflow-x-auto pb-0.5 sm:pb-0 scrollbar-none">
              <button
                onClick={() => setHistoryFilter('all')}
                className={`px-2.5 py-1 rounded-lg text-[10px] sm:text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap ${
                  historyFilter === 'all'
                    ? 'bg-primary-electric text-white shadow-xs'
                    : 'bg-gray-50 dark:bg-surface-low text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-surface-highest'
                }`}
              >
                All ({pastOrders.length})
              </button>
              <button
                onClick={() => setHistoryFilter('completed')}
                className={`px-2.5 py-1 rounded-lg text-[10px] sm:text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap ${
                  historyFilter === 'completed'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-gray-50 dark:bg-surface-low text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-surface-highest'
                }`}
              >
                Done ({pastOrders.filter((b) => b.status === 'completed').length})
              </button>
              <button
                onClick={() => setHistoryFilter('cancelled')}
                className={`px-2.5 py-1 rounded-lg text-[10px] sm:text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap ${
                  historyFilter === 'cancelled'
                    ? 'bg-red-600 text-white shadow-xs'
                    : 'bg-gray-50 dark:bg-surface-low text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-surface-highest'
                }`}
              >
                Cancelled ({pastOrders.filter((b) => ['rejected', 'cancelled'].includes(b.status)).length})
              </button>
            </div>
          </div>

          {/* History List */}
          {filteredPastOrders.length === 0 ? (
            <div className="text-center py-10 bg-white dark:bg-surface-container rounded-2xl border border-dashed border-gray-200 dark:border-surface-highest/20 p-4 sm:p-8">
              <AlertCircle className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
              <h3 className="text-sm font-display font-black text-gray-800 dark:text-high-contrast uppercase tracking-tight mb-0.5">
                {searchQuery || historyFilter !== 'all' ? 'No Matching Orders' : 'No Order History Yet'}
              </h3>
              <p className="text-[11px] text-gray-400 max-w-xs mx-auto mb-3">
                {searchQuery || historyFilter !== 'all'
                  ? 'Try clearing filters or search query.'
                  : 'Past wash cycles and receipts will appear here.'}
              </p>
              {(searchQuery || historyFilter !== 'all') && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setHistoryFilter('all');
                  }}
                  className="px-3 py-1.5 bg-gray-100 dark:bg-surface-highest text-gray-700 dark:text-gray-300 rounded-lg text-xs font-bold"
                >
                  Clear Filters
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-2 sm:space-y-3">
              {filteredPastOrders.map((booking) => (
                <div
                  key={booking.id}
                  className="bg-white dark:bg-surface-container p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-gray-100 dark:border-surface-highest/10 hover:border-primary-electric/25 transition-all shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-4 group"
                >
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[9px] sm:text-[10px] font-mono font-bold text-primary-electric dark:text-primary-electric-light bg-primary-electric/5 px-2 py-0.5 rounded border border-primary-electric/15 truncate">
                        ID: {booking.bookingId || `#${booking.id?.slice(-6).toUpperCase()}`}
                      </span>
                      {getStatusBadge(booking.status)}
                      <span className="text-[9px] sm:text-[10px] font-black text-gray-500 bg-gray-100 dark:bg-surface-low px-1.5 py-0.5 rounded uppercase">
                        M#{booking.machineNumber}
                      </span>
                      {booking.pickupDrop && (
                        <span className="text-[8.5px] sm:text-[10px] font-black text-purple-600 bg-purple-50 dark:bg-purple-950/40 px-1.5 py-0.5 rounded uppercase">
                          Pickup & Drop
                        </span>
                      )}
                    </div>

                    <div className="min-w-0">
                      <h4 className="text-xs sm:text-sm font-display font-black text-gray-900 dark:text-high-contrast uppercase tracking-tight truncate">
                        {booking.serviceType}
                      </h4>
                      <div className="flex flex-wrap items-center gap-1.5 text-[10px] sm:text-[11px] text-gray-400 dark:text-gray-500 font-medium mt-0.5">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-primary-electric" />
                          {booking.date}
                        </span>
                        <span>•</span>
                        <span>{booking.timeSlot}</span>
                        <span>•</span>
                        <span className="truncate max-w-[120px] sm:max-w-none">{getStoreName(booking.storeId)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-gray-100 dark:border-surface-highest/10 shrink-0">
                    <div className="text-left sm:text-right">
                      <span className="text-[8.5px] sm:text-[9px] font-black text-gray-400 uppercase tracking-wider block">
                        Amount
                      </span>
                      <span className="text-sm sm:text-base font-display font-black text-gray-900 dark:text-high-contrast">
                        ₹{Number(booking.price || 0).toFixed(0)}
                      </span>
                      {booking.paymentType && (
                        <span className="text-[8px] sm:text-[8.5px] font-bold text-gray-400 uppercase block truncate">
                          {booking.paymentType.replace('_', ' ')}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => {
                          setSelectedBooking(booking);
                          setShowDetailsModal(true);
                        }}
                        className="px-2.5 py-1.5 bg-gray-50 dark:bg-surface-low hover:bg-gray-100 dark:hover:bg-surface-highest text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-surface-highest/20 rounded-lg text-[10px] sm:text-xs font-black uppercase tracking-wider transition-colors shadow-xs haptic-feedback"
                      >
                        Receipt
                      </button>

                      <button
                        onClick={() => navigate('/dashboard')}
                        title="Book similar slot"
                        className="p-1.5 bg-primary-electric/10 hover:bg-primary-electric text-primary-electric hover:text-white rounded-lg transition-all shadow-xs"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Booking Details Receipt Modal */}
      <AnimatePresence>
        {showDetailsModal && selectedBooking && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowDetailsModal(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative w-full max-w-xl bg-white dark:bg-surface-container rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden border border-gray-100 dark:border-surface-highest/15 max-h-[88vh] flex flex-col"
            >
              {/* Modal Header */}
              <div className="p-3.5 sm:p-6 border-b border-gray-100 dark:border-surface-highest/10 flex items-center justify-between">
                <div>
                  <span className="text-[9px] sm:text-[10px] font-black text-primary-electric uppercase tracking-widest block">
                    Official Wash Receipt
                  </span>
                  <h2 className="text-base sm:text-2xl font-display font-black text-gray-900 dark:text-high-contrast uppercase tracking-tight">
                    Booking Details
                  </h2>
                </div>
                <button
                  onClick={() => setShowDetailsModal(false)}
                  className="p-1.5 sm:p-2 rounded-lg sm:rounded-xl bg-gray-100 dark:bg-surface-low hover:bg-gray-200 text-gray-500 transition-colors"
                >
                  <X className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-3.5 sm:p-6 overflow-y-auto space-y-3.5 sm:space-y-6">
                {/* ID & Status Banner */}
                <div className="p-3 sm:p-4 bg-gray-50 dark:bg-surface-low rounded-xl sm:rounded-2xl flex items-center justify-between gap-2.5">
                  <div className="min-w-0">
                    <span className="text-[9px] sm:text-[10px] font-black text-gray-400 uppercase tracking-wider block">
                      Booking Reference
                    </span>
                    <span className="text-sm sm:text-base font-mono font-black text-gray-800 dark:text-white truncate block">
                      {selectedBooking.bookingId || `#${selectedBooking.id?.slice(-8).toUpperCase()}`}
                    </span>
                  </div>
                  <div className="shrink-0">{getStatusBadge(selectedBooking.status)}</div>
                </div>

                {/* Grid Info */}
                <div className="grid grid-cols-2 gap-2 sm:gap-4">
                  <div className="p-2.5 sm:p-4 bg-gray-50/50 dark:bg-surface-low/50 rounded-xl sm:rounded-2xl border border-gray-100 dark:border-surface-highest/10">
                    <span className="text-[9px] sm:text-[10px] font-black text-gray-400 uppercase tracking-wider block mb-0.5">
                      Service
                    </span>
                    <span className="text-xs sm:text-sm font-black text-gray-800 dark:text-white uppercase truncate block">
                      {selectedBooking.serviceType}
                    </span>
                  </div>

                  <div className="p-2.5 sm:p-4 bg-gray-50/50 dark:bg-surface-low/50 rounded-xl sm:rounded-2xl border border-gray-100 dark:border-surface-highest/10">
                    <span className="text-[9px] sm:text-[10px] font-black text-gray-400 uppercase tracking-wider block mb-0.5">
                      Machine & Hub
                    </span>
                    <span className="text-xs sm:text-sm font-black text-gray-800 dark:text-white uppercase truncate block">
                      Machine #{selectedBooking.machineNumber}
                    </span>
                    <span className="text-[10px] text-gray-400 block truncate">
                      {getStoreName(selectedBooking.storeId)}
                    </span>
                  </div>

                  <div className="p-2.5 sm:p-4 bg-gray-50/50 dark:bg-surface-low/50 rounded-xl sm:rounded-2xl border border-gray-100 dark:border-surface-highest/10">
                    <span className="text-[9px] sm:text-[10px] font-black text-gray-400 uppercase tracking-wider block mb-0.5">
                      Date & Slot
                    </span>
                    <span className="text-xs sm:text-sm font-black text-gray-800 dark:text-white uppercase truncate block">
                      {selectedBooking.date}
                    </span>
                    <span className="text-[10px] text-gray-400 block truncate">{selectedBooking.timeSlot}</span>
                  </div>

                  <div className="p-2.5 sm:p-4 bg-gray-50/50 dark:bg-surface-low/50 rounded-xl sm:rounded-2xl border border-gray-100 dark:border-surface-highest/10">
                    <span className="text-[9px] sm:text-[10px] font-black text-gray-400 uppercase tracking-wider block mb-0.5">
                      Collection Mode
                    </span>
                    <span className="text-xs sm:text-sm font-black text-gray-800 dark:text-white uppercase truncate block">
                      {selectedBooking.pickupDrop ? 'Doorstep Delivery' : 'Self Drop/Collect'}
                    </span>
                  </div>
                </div>

                {/* Delivery Address if present */}
                {selectedBooking.pickupDrop && selectedBooking.address && (
                  <div className="p-3 sm:p-4 bg-purple-50/60 dark:bg-purple-950/20 rounded-xl sm:rounded-2xl border border-purple-100 dark:border-purple-900/30">
                    <span className="text-[9px] sm:text-[10px] font-black text-purple-700 dark:text-purple-300 uppercase tracking-wider block mb-1 flex items-center gap-1.5">
                      <MapPin className="w-3 h-3" /> Delivery Address
                    </span>
                    <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 break-words">
                      {selectedBooking.address}
                    </p>
                    {selectedBooking.phone && (
                      <p className="text-[10px] text-gray-500 mt-0.5">Phone: {selectedBooking.phone}</p>
                    )}
                  </div>
                )}

                {/* Care instructions if present */}
                {selectedBooking.garmentInstructions && (
                  <div className="p-3 sm:p-4 bg-blue-50/60 dark:bg-blue-900/20 rounded-xl sm:rounded-2xl border border-blue-100 dark:border-blue-900/30">
                    <span className="text-[9px] sm:text-[10px] font-black text-blue-700 dark:text-blue-300 uppercase tracking-wider block mb-0.5">
                      Special Care Instructions
                    </span>
                    <p className="text-xs text-gray-700 dark:text-gray-300 italic break-words">
                      "{selectedBooking.garmentInstructions}"
                    </p>
                  </div>
                )}

                {/* Payment Breakdown */}
                <div className="p-3.5 sm:p-5 bg-gray-50 dark:bg-surface-low rounded-xl sm:rounded-2xl space-y-2">
                  <span className="text-[9px] sm:text-[10px] font-black text-gray-400 uppercase tracking-wider block pb-1 border-b border-gray-200 dark:border-surface-highest/20">
                    Payment Summary
                  </span>
                  <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400">
                    <span>Base Service</span>
                    <span className="font-bold text-gray-800 dark:text-gray-200">
                      ₹{Number(selectedBooking.price || 0).toFixed(0)}
                    </span>
                  </div>
                  {selectedBooking.deliveryFee ? (
                    <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400">
                      <span>Delivery & Handling</span>
                      <span className="font-bold text-gray-800 dark:text-gray-200">
                        ₹{Number(selectedBooking.deliveryFee).toFixed(2)}
                      </span>
                    </div>
                  ) : null}
                  {selectedBooking.paymentType === 'pay_at_store' && (
                    <>
                      <div className="flex justify-between text-xs text-emerald-600 dark:text-emerald-400">
                        <span>Prepaid Online (Slot Fee)</span>
                        <span className="font-bold">
                          ₹{Number(selectedBooking.prepaidAmount ?? 39).toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between text-xs text-amber-600 dark:text-amber-400 font-bold">
                        <span>Cash Balance Due on Delivery</span>
                        <span>
                          ₹{Number(
                            selectedBooking.remainingAmount ??
                              selectedBooking.price - (selectedBooking.prepaidAmount ?? 39)
                          ).toFixed(2)}
                        </span>
                      </div>
                    </>
                  )}
                  <div className="pt-2 border-t border-gray-200 dark:border-surface-highest/20 flex justify-between items-center text-sm font-black text-gray-900 dark:text-white uppercase">
                    <span>Total Order Amount</span>
                    <span className="text-lg text-primary-electric">
                      ₹{Number(selectedBooking.price || 0).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-4 sm:p-6 border-t border-gray-100 dark:border-surface-highest/10 flex items-center justify-between gap-3 bg-gray-50/50 dark:bg-surface-low/50">
                <button
                  onClick={() => {
                    setSupportBookingId(selectedBooking.bookingId || selectedBooking.id);
                    setShowDetailsModal(false);
                    setIsSupportModalOpen(true);
                  }}
                  className="px-4 py-2.5 text-xs font-bold text-gray-600 dark:text-gray-400 hover:text-primary-electric flex items-center gap-1.5"
                >
                  <HelpCircle className="w-4 h-4" />
                  <span>Report Issue / Support</span>
                </button>
                <button
                  onClick={() => setShowDetailsModal(false)}
                  className="px-6 py-2.5 bg-gray-900 dark:bg-white text-white dark:text-black rounded-xl text-xs font-black uppercase tracking-wider transition-colors shadow-sm"
                >
                  Close Receipt
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Support / Feedback Modal */}
      <FeedbackModal
        isOpen={isSupportModalOpen}
        onClose={() => setIsSupportModalOpen(false)}
        title="Order Assistance & Feedback"
        subtitle={
          supportBookingId
            ? `Regarding Booking Ref: ${supportBookingId}`
            : 'How can our store team help with your order?'
        }
        isOptional={false}
      />
    </div>
  );
};

export default Orders;
