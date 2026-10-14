import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Calendar, 
  Clock, 
  CheckCircle2, 
  Loader2, 
  LayoutDashboard, 
  Settings, 
  Users, 
  Package, 
  AlertCircle,
  Truck,
  Monitor,
  Plus,
  Search,
  Filter,
  ChevronRight,
  MoreVertical,
  MapPin,
  User,
  Trash2,
  Ban,
  Printer,
  Tag,
  Receipt,
  QrCode,
  CalendarRange,
  ShieldCheck,
  ShieldAlert,
  Edit2,
  X,
  Sparkles,
  ShoppingBag,
  Phone,
  ArrowUpDown,
  CreditCard,
  ChevronDown,
  ExternalLink,
  FileText,
  Check,
  Store as StoreIcon,
  DollarSign,
  ArrowRight
} from 'lucide-react';
import { collection, query, where, onSnapshot, updateDoc, doc, orderBy, limit, getDocs, getDoc, runTransaction, setDoc, deleteDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../context/SettingsContext';
import { Booking, Machine, User as AppUser, TIME_SLOTS, Slot, isMachineAvailableOnDate, Store } from '../../types';
import { format } from 'date-fns';
import { WashingTagModal } from '../../components/WashingTagModal';
import { InvoiceModal } from '../../components/InvoiceModal';
import { TagScannerModal } from '../../components/TagScannerModal';
import { PaginationControls } from '../../components/PaginationControls';
import { getTodayIST, formatIST, formatDateTimeIST } from '../../utils/timezone';
import { authFetch } from '../../utils/api';

const StoreManagerDashboard: React.FC = () => {
  const { user } = useAuth();
  const { settings } = useSettings();
  const availableSlots = settings?.customSlots && Array.isArray(settings.customSlots) && settings.customSlots.length > 0
    ? settings.customSlots
    : TIME_SLOTS;

  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState<string>(() => {
    return user?.storeId || localStorage.getItem('washwise_mgr_storeId') || '';
  });
  const effectiveStoreId = selectedStoreId || user?.storeId || (stores[0]?.id || 'default');

  const [activeTab, setActiveTab] = useState<'today' | 'all_orders' | 'machines' | 'status' | 'logistics' | 'issues' | 'availability'>('today');
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [storeStaff, setStoreStaff] = useState<AppUser[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBookingForTag, setSelectedBookingForTag] = useState<Booking | null>(null);
  const [selectedBookingForInvoice, setSelectedBookingForInvoice] = useState<Booking | null>(null);
  const [selectedBookingForDetails, setSelectedBookingForDetails] = useState<Booking | null>(null);
  const [storeDetails, setStoreDetails] = useState<{ name: string; phone: string; address: string } | null>(null);
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  // All Orders dedicated filter and pagination state
  const [allOrdersSearchTerm, setAllOrdersSearchTerm] = useState('');
  const [allOrdersStatusFilter, setAllOrdersStatusFilter] = useState('all');
  const [allOrdersDateFilter, setAllOrdersDateFilter] = useState<'all' | 'today' | 'upcoming' | 'past'>('all');
  const [allOrdersServiceFilter, setAllOrdersServiceFilter] = useState('all');
  const [sideColumnStatusFilter, setSideColumnStatusFilter] = useState<'all' | 'active' | 'completed'>('all');
  const [allOrdersPage, setAllOrdersPage] = useState<number>(1);
  const [allOrdersPageSize, setAllOrdersPageSize] = useState<number>(10);

  // Reset page when any all_orders filter changes
  useEffect(() => {
    setAllOrdersPage(1);
  }, [allOrdersSearchTerm, allOrdersStatusFilter, allOrdersDateFilter, allOrdersServiceFilter]);

  // Machine Availability & Fleet Management State
  const [availabilityDate, setAvailabilityDate] = useState(() => getTodayIST());
  const [selectedTimeSlot, setSelectedTimeSlot] = useState(TIME_SLOTS[0]);
  const [currentSlotData, setCurrentSlotData] = useState<Slot | null>(null);
  const [isClearingSlot, setIsClearingSlot] = useState(false);

  // Modals & Forms for Machine Fleet Management
  const [isAddMachineModalOpen, setIsAddMachineModalOpen] = useState(false);
  const [isDateRangeModalOpen, setIsDateRangeModalOpen] = useState(false);
  const [isDeleteConfirmModalOpen, setIsDeleteConfirmModalOpen] = useState(false);
  const [machineToEditDateRange, setMachineToEditDateRange] = useState<Machine | null>(null);
  const [machineToDelete, setMachineToDelete] = useState<Machine | null>(null);
  const [machineForm, setMachineForm] = useState<{
    number: number;
    type: 'washer' | 'dryer';
    status: 'idle' | 'unavailable' | 'maintenance';
    isAvailable: boolean;
    unavailableFrom?: string;
    unavailableTo?: string;
    unavailableReason?: string;
  }>({
    number: 1,
    type: 'washer',
    status: 'idle',
    isAvailable: true,
    unavailableFrom: '',
    unavailableTo: '',
    unavailableReason: ''
  });
  const [dateRangeForm, setDateRangeForm] = useState({
    unavailableFrom: '',
    unavailableTo: '',
    unavailableReason: ''
  });

  // 1. Fetch available stores and auto-resolve active store
  useEffect(() => {
    const unsubStores = onSnapshot(collection(db, 'stores'), (snapshot) => {
      const storeList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Store[];
      setStores(storeList);
      if (storeList.length > 0) {
        setSelectedStoreId(prev => {
          if (user?.storeId && storeList.some(s => s.id === user.storeId)) {
            return user.storeId;
          }
          if (prev && storeList.some(s => s.id === prev)) {
            return prev;
          }
          return user?.storeId || storeList[0].id;
        });
      }
    }, (error) => {
      console.warn('Stores snapshot error:', error);
    });
    return () => unsubStores();
  }, [user?.storeId]);

  // Persist chosen store to localStorage
  useEffect(() => {
    if (effectiveStoreId) {
      localStorage.setItem('washwise_mgr_storeId', effectiveStoreId);
    }
  }, [effectiveStoreId]);

  // 2. Main data listener for effectiveStoreId
  useEffect(() => {
    if (!effectiveStoreId) {
      setLoading(false);
      return;
    }

    // Fetch all users for resolving booking user ids
    const usersQuery = query(collection(db, 'users'));
    const unsubscribeUsers = onSnapshot(usersQuery, (snapshot) => {
      setUsers(snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() })) as AppUser[]);
    }, (error) => {
      console.warn('Users snapshot error:', error);
    });

    // Fetch store bookings: Listen to bookings collection without composite index constraint to guarantee 100% receipt
    const unsubscribeBookings = onSnapshot(collection(db, 'bookings'), (snapshot) => {
      const allData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Booking[];
      
      const isDefaultOrFirstStore = 
        effectiveStoreId === 'default' || 
        stores.length === 0 || 
        stores[0]?.id === effectiveStoreId ||
        stores.some(s => s.id === effectiveStoreId && (s as any).isDefault);

      // Filter bookings matching this store:
      // Matches if viewing all stores, OR booking's storeId == effectiveStoreId,
      // OR if booking has storeId 'default' or missing, and this is the default/primary store
      const currentStore = stores.find(s => s.id === effectiveStoreId);
      const storeData = allData.filter(b => {
        if (effectiveStoreId === 'all') return true;
        if (b.storeId === effectiveStoreId) return true;
        if (isDefaultOrFirstStore && (!b.storeId || b.storeId === 'default' || b.storeId === '')) return true;
        if (currentStore && (b.storeId === currentStore.name || b.storeId === currentStore.location)) return true;
        return false;
      });

      // Sort client-side by createdAt descending (fallback to date and slot)
      storeData.sort((a, b) => {
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : (a.date ? new Date(a.date).getTime() : 0);
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : (b.date ? new Date(b.date).getTime() : 0);
        return timeB - timeA;
      });

      setBookings(storeData);
      setLoading(false);
    }, (error) => {
      console.warn('Bookings snapshot error:', error);
      handleFirestoreError(error, OperationType.GET, 'bookings');
      setLoading(false);
    });

    // Fetch store machines
    const machinesQuery = effectiveStoreId === 'all'
      ? collection(db, 'machines')
      : query(
          collection(db, 'machines'),
          where('storeId', '==', effectiveStoreId)
        );

    const unsubscribeMachines = onSnapshot(machinesQuery, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Machine[];
      setMachines(data.sort((a, b) => a.number - b.number));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'machines');
    });

    // Fetch store details for printing tags and invoices
    let unsubStore = () => {};
    if (effectiveStoreId === 'all') {
      setStoreDetails({
        name: 'All WashWise Stores (Global View)',
        phone: '+91 98470 12345',
        address: 'All Store Locations & Laundromats'
      });
    } else {
      unsubStore = onSnapshot(doc(db, 'stores', effectiveStoreId), (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          setStoreDetails({
            name: data.name || `WASHWISE Store (${effectiveStoreId})`,
            phone: data.phone || '+91 98470 12345',
            address: data.address || data.location || 'Store Location'
          });
        } else {
          const matched = stores.find(s => s.id === effectiveStoreId);
          setStoreDetails({
            name: matched?.name || `WASHWISE Store (${effectiveStoreId})`,
            phone: matched?.phone || '+91 98470 12345',
            address: matched?.address || 'Store Location'
          });
        }
      }, (error) => {
        console.warn('Store snapshot error:', error);
      });
    }

    return () => {
      unsubscribeBookings();
      unsubscribeMachines();
      unsubscribeUsers();
      unsubStore();
    };
  }, [effectiveStoreId, stores]);

  const updateBookingStatus = async (id: string, status: Booking['status']) => {
    try {
      await updateDoc(doc(db, 'bookings', id), { status });
      if (status === 'completed' || status === 'Washing completed') {
        authFetch('/api/loyalty/trigger-reward', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bookingId: id })
        }).catch(() => {});
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `bookings/${id}`);
    }
  };

  const assignMachine = async (bookingId: string, machineId: string) => {
    try {
      await runTransaction(db, async (transaction) => {
        const machineRef = doc(db, 'machines', machineId);
        const bookingRef = doc(db, 'bookings', bookingId);
        
        transaction.update(machineRef, { 
          status: 'occupied', 
          currentBookingId: bookingId 
        });
        transaction.update(bookingRef, { 
          status: 'In Wash',
          machineId: machineId
        });
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `machines/${machineId}`);
    }
  };

  const clearMachine = async (machineId: string) => {
    try {
      await updateDoc(doc(db, 'machines', machineId), {
        status: 'free',
        currentBookingId: null,
        timeRemaining: 0
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `machines/${machineId}`);
    }
  };

  useEffect(() => {
    if (activeTab !== 'availability') return;

    const slotId = `${availabilityDate}_${selectedTimeSlot}`;
    const unsubSlot = onSnapshot(doc(db, 'slots', slotId), (snapshot) => {
      if (snapshot.exists()) {
        setCurrentSlotData({ id: snapshot.id, ...snapshot.data() } as Slot);
      } else {
        setCurrentSlotData({
          date: availabilityDate,
          timeSlot: selectedTimeSlot,
          machines: { '1': '', '2': '', '3': '', '4': '' }
        });
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `slots/${slotId}`);
    });

    return () => unsubSlot();
  }, [activeTab, availabilityDate, selectedTimeSlot]);

  const handleClearSlot = async (machineNumber: string) => {
    if (!currentSlotData) return;
    
    setIsClearingSlot(true);
    try {
      const slotId = `${availabilityDate}_${selectedTimeSlot}`;
      const slotRef = doc(db, 'slots', slotId);
      
      await runTransaction(db, async (transaction) => {
        const slotSnap = await transaction.get(slotRef);
        if (!slotSnap.exists()) return;
        
        const machines = slotSnap.data().machines;
        const updatedMachines = { ...machines };
        delete updatedMachines[machineNumber];
        
        transaction.update(slotRef, { machines: updatedMachines });
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `slots/${availabilityDate}_${selectedTimeSlot}`);
    } finally {
      setIsClearingSlot(false);
    }
  };

  const handleQuickLaunchTwoMachines = async () => {
    if (!effectiveStoreId) return;
    setIsClearingSlot(true);
    try {
      const m1Id = `${effectiveStoreId}_M1_washer`;
      const m2Id = `${effectiveStoreId}_M2_washer`;
      await setDoc(doc(db, 'machines', m1Id), {
        id: m1Id,
        storeId: effectiveStoreId,
        number: 1,
        type: 'washer',
        status: 'idle',
        isAvailable: true,
        createdAt: new Date().toISOString()
      });
      await setDoc(doc(db, 'machines', m2Id), {
        id: m2Id,
        storeId: effectiveStoreId,
        number: 2,
        type: 'washer',
        status: 'idle',
        isAvailable: true,
        createdAt: new Date().toISOString()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'machines');
    } finally {
      setIsClearingSlot(false);
    }
  };

  const handleOpenAddMachineModal = () => {
    const nextNumber = machines.length > 0 
      ? Math.max(...machines.map(m => m.number || 0)) + 1 
      : 1;
    setMachineForm({
      number: nextNumber,
      type: 'washer',
      status: 'idle',
      isAvailable: true,
      unavailableFrom: '',
      unavailableTo: '',
      unavailableReason: ''
    });
    setIsAddMachineModalOpen(true);
  };

  const handleSaveNewMachine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!effectiveStoreId) return;
    setIsClearingSlot(true);
    try {
      const mId = `${effectiveStoreId}_M${machineForm.number}_${machineForm.type}`;
      const payload: any = {
        id: mId,
        storeId: effectiveStoreId,
        number: Number(machineForm.number),
        type: machineForm.type,
        status: machineForm.isAvailable ? 'idle' : 'unavailable',
        isAvailable: Boolean(machineForm.isAvailable),
        createdAt: new Date().toISOString()
      };
      if (machineForm.unavailableFrom) {
        payload.unavailableFrom = machineForm.unavailableFrom;
        if (machineForm.unavailableTo) payload.unavailableTo = machineForm.unavailableTo;
        if (machineForm.unavailableReason) payload.unavailableReason = machineForm.unavailableReason;
      }
      await setDoc(doc(db, 'machines', mId), payload);
      setIsAddMachineModalOpen(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'machines');
    } finally {
      setIsClearingSlot(false);
    }
  };

  const handleToggleMachineGlobalAvailability = async (machine: Machine) => {
    const newAvailable = !machine.isAvailable;
    setIsClearingSlot(true);
    try {
      await updateDoc(doc(db, 'machines', machine.id), {
        isAvailable: newAvailable,
        status: newAvailable ? 'idle' : 'unavailable'
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `machines/${machine.id}`);
    } finally {
      setIsClearingSlot(false);
    }
  };

  const handleOpenDateRangeModal = (machine: Machine) => {
    setMachineToEditDateRange(machine);
    setDateRangeForm({
      unavailableFrom: machine.unavailableFrom || format(new Date(), 'yyyy-MM-dd'),
      unavailableTo: machine.unavailableTo || '',
      unavailableReason: machine.unavailableReason || ''
    });
    setIsDateRangeModalOpen(true);
  };

  const handleSaveDateRange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!machineToEditDateRange) return;
    setIsClearingSlot(true);
    try {
      await updateDoc(doc(db, 'machines', machineToEditDateRange.id), {
        unavailableFrom: dateRangeForm.unavailableFrom || null,
        unavailableTo: dateRangeForm.unavailableTo || null,
        unavailableReason: dateRangeForm.unavailableReason || 'Scheduled Non-Availability'
      });
      setIsDateRangeModalOpen(false);
      setMachineToEditDateRange(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `machines/${machineToEditDateRange.id}`);
    } finally {
      setIsClearingSlot(false);
    }
  };

  const handleClearDateRange = async () => {
    if (!machineToEditDateRange) return;
    setIsClearingSlot(true);
    try {
      await updateDoc(doc(db, 'machines', machineToEditDateRange.id), {
        unavailableFrom: null,
        unavailableTo: null,
        unavailableReason: null
      });
      setIsDateRangeModalOpen(false);
      setMachineToEditDateRange(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `machines/${machineToEditDateRange.id}`);
    } finally {
      setIsClearingSlot(false);
    }
  };

  const handleConfirmDeleteMachine = async () => {
    if (!machineToDelete) return;
    setIsClearingSlot(true);
    try {
      await deleteDoc(doc(db, 'machines', machineToDelete.id));
      setIsDeleteConfirmModalOpen(false);
      setMachineToDelete(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `machines/${machineToDelete.id}`);
    } finally {
      setIsClearingSlot(false);
    }
  };

  const handleToggleSlotMachineAvailability = async (machineNumber: string, isCurrentlyAvailable: boolean) => {
    setIsClearingSlot(true);
    try {
      const slotId = `${availabilityDate}_${selectedTimeSlot}`;
      const slotRef = doc(db, 'slots', slotId);
      
      await runTransaction(db, async (transaction) => {
        const slotSnap = await transaction.get(slotRef);
        
        let updatedMachines: Record<string, string> = {};
        if (slotSnap.exists()) {
          updatedMachines = { ...slotSnap.data().machines };
        }
        
        if (isCurrentlyAvailable) {
          updatedMachines[machineNumber] = 'unavailable';
        } else {
          delete updatedMachines[machineNumber];
        }
        
        if (slotSnap.exists()) {
          transaction.update(slotRef, { machines: updatedMachines });
        } else {
          transaction.set(slotRef, { 
            date: availabilityDate,
            timeSlot: selectedTimeSlot,
            machines: updatedMachines,
            createdAt: new Date().toISOString()
          });
        }
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `slots/${availabilityDate}_${selectedTimeSlot}`);
    } finally {
      setIsClearingSlot(false);
    }
  };

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const stats = {
    total: bookings.length,
    today: bookings.filter(b => b.date === todayStr).length,
    upcoming: bookings.filter(b => (b.date || '') > todayStr).length,
    pending: bookings.filter(b => b.status === 'pending').length,
    washing: bookings.filter(b => ['In Wash', 'In Dryer'].includes(b.status)).length,
    ready: bookings.filter(b => ['Ready to collect', 'Ready to deliver', 'Washing completed'].includes(b.status)).length,
    completed: bookings.filter(b => b.status === 'completed').length,
    revenue: bookings.reduce((sum, b) => sum + (Number(b.price || b.totalAmount || 0)), 0),
  };

  const getStatusOptions = (pickupDrop: boolean) => {
    if (pickupDrop) {
      return [
        { value: 'paid', label: 'Order Confirmed' },
        { value: 'Ready for pick up', label: 'Ready for Pickup (Driver)' },
        { value: 'In Wash', label: 'In wash' },
        { value: 'In Dryer', label: 'In wash (Drying)' },
        { value: 'Washing completed', label: 'Completed' },
        { value: 'Ready to deliver', label: 'Ready for Delivery' },
        { value: 'Out for delivery', label: 'Out for Delivery' },
        { value: 'completed', label: 'Finalized' },
        { value: 'cancelled', label: 'Cancelled' }
      ];
    } else {
      return [
        { value: 'paid', label: 'Confirmed' },
        { value: 'In Wash', label: 'In wash' },
        { value: 'In Dryer', label: 'In wash (Drying)' },
        { value: 'Washing completed', label: 'Completed' },
        { value: 'Ready to collect', label: 'Ready for customer pickup' },
        { value: 'completed', label: 'Finalized' },
        { value: 'cancelled', label: 'Cancelled' }
      ];
    }
  };

  if (loading && stores.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 className="w-12 h-12 text-blue-600 animate-spin mb-4" />
        <p className="text-gray-500 font-black uppercase tracking-widest text-sm">Loading Store Dashboard...</p>
      </div>
    );
  }

  if (!loading && stores.length === 0 && !effectiveStoreId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <div className="w-24 h-24 bg-amber-50 dark:bg-amber-900/20 rounded-[2.5rem] flex items-center justify-center mb-6">
          <AlertCircle className="w-12 h-12 text-amber-600" />
        </div>
        <h2 className="text-3xl font-black text-gray-800 dark:text-gray-100 tracking-tight uppercase mb-2">No Stores Configured</h2>
        <p className="text-gray-500 dark:text-gray-400 font-medium max-w-md mx-auto">
          No stores were found in the database. Please create a store in the Super Admin dashboard first.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Top Header with Store Switcher & Tools */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-black text-gray-800 dark:text-gray-100 tracking-tight uppercase">STORE OPERATIONS</h1>
            <span className="px-2.5 py-1 bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-300 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /> Live Orders Hub
            </span>
          </div>
          <p className="text-gray-500 dark:text-gray-400 font-medium text-xs sm:text-sm mt-0.5">
            Realtime orders, wash workflow, machines & pickup management for <span className="font-bold text-gray-700 dark:text-gray-200">{storeDetails?.name || effectiveStoreId}</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Interactive Store Selector */}
          <div className="flex items-center gap-2 p-1.5 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-xs">
            <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0">
              <StoreIcon className="w-4 h-4" />
            </div>
            <div className="flex flex-col pr-1">
              <span className="text-[9px] font-black uppercase tracking-wider text-blue-600 dark:text-blue-400 leading-none">Active Store</span>
              {stores.length > 0 ? (
                <div className="relative flex items-center">
                  <select
                    value={effectiveStoreId}
                    onChange={(e) => setSelectedStoreId(e.target.value)}
                    className="text-xs font-black text-gray-800 dark:text-gray-100 bg-transparent border-none outline-none cursor-pointer pr-4 appearance-none hover:text-blue-600"
                  >
                    <option value="all" className="dark:bg-gray-900 text-gray-900 dark:text-white font-bold">
                      All Stores (Global View)
                    </option>
                    {stores.map(s => (
                      <option key={s.id} value={s.id} className="dark:bg-gray-900 text-gray-900 dark:text-white">
                        {s.name} ({s.id}){user?.storeId === s.id ? ' • Assigned' : ''}
                      </option>
                    ))}
                    {!stores.some(s => s.id === 'default') && (
                      <option value="default" className="dark:bg-gray-900 text-gray-900 dark:text-white">
                        Default Hub (default)
                      </option>
                    )}
                  </select>
                  <ChevronDown className="w-3 h-3 text-gray-400 pointer-events-none absolute right-0" />
                </div>
              ) : (
                <span className="text-xs font-black text-gray-800 dark:text-gray-100">
                  {effectiveStoreId}
                </span>
              )}
            </div>
          </div>

          <button
            onClick={() => setIsScannerOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2.5 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-sm hover:scale-105 active:scale-95 transition-all shrink-0"
            title="Scan garment tags using camera or barcode gun"
          >
            <QrCode className="w-4 h-4" />
            <span className="hidden sm:inline">Scan Tag / QR</span>
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        {[
          { label: "All Store Orders", value: stats.total, color: 'blue', icon: ShoppingBag, tab: 'all_orders' },
          { label: "Today's Orders", value: stats.today, color: 'emerald', icon: Calendar, tab: 'today' },
          { label: 'In Wash / Dryer', value: stats.washing, color: 'indigo', icon: Loader2, tab: 'status' },
          { label: 'Ready for Pickup', value: stats.ready, color: 'green', icon: CheckCircle2, tab: 'logistics' },
          { label: 'Store Revenue', value: `₹${stats.revenue.toLocaleString('en-IN')}`, color: 'amber', icon: DollarSign, tab: 'all_orders' },
        ].map((stat, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            onClick={() => setActiveTab(stat.tab as any)}
            className="bg-white dark:bg-gray-900 p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-gray-100 dark:border-gray-800 shadow-xs hover:border-blue-300 dark:hover:border-blue-700 cursor-pointer transition-all group"
          >
            <div className="flex items-center justify-between mb-2">
              <stat.icon className={`w-5 h-5 text-${stat.color}-600 group-hover:scale-110 transition-transform`} />
              <span className={`text-[9px] font-black uppercase tracking-widest text-${stat.color}-600/60 bg-${stat.color}-50 dark:bg-${stat.color}-950/40 px-1.5 py-0.5 rounded-md`}>Live</span>
            </div>
            <p className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-0.5">{stat.label}</p>
            <p className={`text-xl sm:text-2xl font-black text-gray-800 dark:text-gray-100 tracking-tight`}>{stat.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Tabs Bar */}
      <div className="flex space-x-2 sm:space-x-4 border-b border-gray-100 dark:border-gray-800 overflow-x-auto pb-px">
        {[
          { id: 'today', label: "Today's Orders", icon: Calendar, count: stats.today },
          { id: 'all_orders', label: 'All Orders', icon: ShoppingBag, count: stats.total },
          { id: 'machines', label: 'Machines', icon: Monitor, count: machines.length },
          { id: 'availability', label: 'Machine Slots', icon: Clock },
          { id: 'status', label: 'Status Board', icon: LayoutDashboard },
          { id: 'logistics', label: 'Logistics', icon: Truck },
          { id: 'issues', label: 'Issues', icon: AlertCircle },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`pb-4 px-3 text-xs sm:text-sm font-bold transition-all relative whitespace-nowrap flex items-center gap-2 ${
              activeTab === tab.id ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            <span>{tab.label}</span>
            {tab.count !== undefined && (
              <span className={`text-[10px] font-black px-1.5 py-0.2 rounded-full ${
                activeTab === tab.id 
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300' 
                  : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
              }`}>
                {tab.count}
              </span>
            )}
            {activeTab === tab.id && (
              <motion.div
                layoutId="activeTab"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 dark:bg-blue-400"
              />
            )}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'today' && (
          <motion.div
            key="today"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-black text-gray-800 dark:text-gray-100 uppercase tracking-tight">Today's Schedule ({format(new Date(), 'MMM dd, yyyy')})</h2>
                <p className="text-xs text-gray-500 font-medium">Orders and slot bookings scheduled for today.</p>
              </div>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search today's orders..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Responsive 2-Column Layout: Left = Today's Slots, Right = Dedicated Column for All Orders Done at this Store */}
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
              {/* Left Column: Today's Orders (xl:col-span-8) */}
              <div className="xl:col-span-8 space-y-4">
                {/* Banner if orders exist on future/other dates */}
                {stats.total > stats.today && (
                  <div className="p-4 bg-gradient-to-r from-blue-50 via-indigo-50 to-blue-50 dark:from-blue-950/30 dark:via-indigo-950/30 dark:to-blue-950/30 border border-blue-200 dark:border-blue-900/40 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                        <Calendar className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-xs sm:text-sm font-black text-gray-800 dark:text-gray-100">
                          {stats.upcoming > 0 
                            ? `${stats.upcoming} Upcoming order(s) booked for future dates` 
                            : `${stats.total} total store orders on record`}
                        </p>
                        <p className="text-[11px] text-gray-500 dark:text-gray-400">
                          Today has {stats.today} slot(s) booked. Check the right column or switch to "All Orders" tab to manage all bookings.
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setActiveTab('all_orders')}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all shrink-0 self-start sm:self-auto shadow-xs hover:scale-105 active:scale-95 flex items-center gap-1.5"
                    >
                      <ShoppingBag className="w-3.5 h-3.5" />
                      <span>Full Register ({stats.total}) &rarr;</span>
                    </button>
                  </div>
                )}

                {bookings.filter(b => b.date === format(new Date(), 'yyyy-MM-dd')).length === 0 ? (
                  <div className="text-center py-12 bg-white dark:bg-gray-900 rounded-[2rem] border border-gray-100 dark:border-gray-800 p-8 space-y-3">
                    <div className="w-16 h-16 rounded-3xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 flex items-center justify-center mx-auto">
                      <Calendar className="w-8 h-8" />
                    </div>
                    <h3 className="text-lg font-black text-gray-800 dark:text-gray-100 uppercase tracking-tight">No Orders Scheduled For Today</h3>
                    <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto">
                      No slots have been booked for today ({format(new Date(), 'MMM dd, yyyy')}).
                      {stats.total > 0 && ` There are ${stats.total} order(s) booked on other dates for this store visible in the column to the right.`}
                    </p>
                    {stats.total > 0 && (
                      <button
                        onClick={() => setActiveTab('all_orders')}
                        className="mt-2 inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black uppercase tracking-wider rounded-xl shadow-xs transition-all hover:scale-105"
                      >
                        <ShoppingBag className="w-4 h-4" />
                        <span>View All Store Orders ({stats.total})</span>
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4">
                  {bookings
                    .filter(b => b.date === format(new Date(), 'yyyy-MM-dd'))
                    .filter(b => {
                      const search = (searchTerm || '').toLowerCase();
                      return (b.userName || '').toLowerCase().includes(search) || 
                             (b.id || '').toLowerCase().includes(search) || 
                             (b.bookingId || '').toLowerCase().includes(search) ||
                             (b.userId || '').toLowerCase().includes(search);
                    })
                    .map((booking) => (
                      <div key={booking.id} className="bg-white dark:bg-gray-900 p-6 rounded-[2rem] border border-gray-100 dark:border-gray-800 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/20 rounded-2xl flex items-center justify-center">
                            <User className="w-6 h-6 text-blue-600" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-black text-gray-800 dark:text-gray-100">{booking.userName}</p>
                              <span className="text-[10px] font-black text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded-full">
                                {booking.bookingId || `#${booking.id?.slice(-6).toUpperCase()}`}
                              </span>
                            </div>
                            <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">{booking.timeSlot}</p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-8">
                          <div>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Service</p>
                            <p className="text-sm font-bold text-gray-700 dark:text-gray-300">{booking.serviceType}</p>
                            {booking.garmentInstructions && (
                              <p className="text-[10px] text-amber-600 dark:text-amber-400 font-medium italic mt-0.5" title={booking.garmentInstructions}>
                                Instr: {booking.garmentInstructions}
                              </p>
                            )}
                          </div>
                          <div>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Status</p>
                            <select 
                              value={booking.status}
                              onChange={(e) => updateBookingStatus(booking.id!, e.target.value as any)}
                              className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest outline-none border-none cursor-pointer ${
                                ['paid', 'pending'].includes(booking.status) ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                                booking.status === 'Ready for pick up' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                                ['In Wash', 'In Dryer'].includes(booking.status) ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400' :
                                ['Washing completed', 'Ready to deliver'].includes(booking.status) ? 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400' :
                                booking.status === 'Ready to collect' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' :
                                booking.status === 'Out for delivery' ? 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400' :
                                booking.status === 'completed' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                                'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                              }`}
                            >
                              {getStatusOptions(booking.pickupDrop).map(opt => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap justify-end">
                          {/* Print Tag Button */}
                          <button
                            onClick={() => setSelectedBookingForTag(booking)}
                            className="px-3 py-2 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 text-xs font-black uppercase tracking-wider rounded-xl transition-all border border-indigo-200 dark:border-indigo-800 flex items-center gap-1.5 hover:scale-105 active:scale-95"
                            title="Print Garment Washing Tag with QR, Slot No, Weight, Pieces & Dates"
                          >
                            <Tag className="w-3.5 h-3.5" />
                            <span>Tag</span>
                            {booking.tagPrinted && (
                              <span className="w-1.5 h-1.5 rounded-full bg-green-500" title="Tag Printed" />
                            )}
                          </button>

                          {/* Print Invoice Button */}
                          <button
                            onClick={() => setSelectedBookingForInvoice(booking)}
                            className="px-3 py-2 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 dark:hover:bg-blue-900/50 text-blue-600 dark:text-blue-400 text-xs font-black uppercase tracking-wider rounded-xl transition-all border border-blue-200 dark:border-blue-800 flex items-center gap-1.5 hover:scale-105 active:scale-95"
                            title="Print Store Tax Invoice & Challan"
                          >
                            <Receipt className="w-3.5 h-3.5" />
                            <span>Invoice</span>
                          </button>

                          {booking.status === 'pending' && (
                            <button 
                              onClick={() => setActiveTab('machines')}
                              className="px-4 py-2 bg-blue-600 text-white text-xs font-black uppercase tracking-widest rounded-xl hover:bg-blue-700 transition-colors"
                            >
                              Assign Machine
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Right Column: Dedicated "All Orders Done at This Store" Column (xl:col-span-4) */}
              <div className="xl:col-span-4 space-y-4">
                <div className="bg-white dark:bg-gray-900 p-5 rounded-[2rem] border border-gray-100 dark:border-gray-800 shadow-xs flex flex-col">
                  {/* Column Header */}
                  <div className="flex items-center justify-between pb-3.5 border-b border-gray-100 dark:border-gray-800">
                    <div>
                      <div className="flex items-center gap-2">
                        <ShoppingBag className="w-4 h-4 text-blue-600" />
                        <h3 className="text-sm font-black text-gray-800 dark:text-gray-100 uppercase tracking-tight">All Store Orders</h3>
                        <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 rounded-full text-[10px] font-black">
                          {bookings.length}
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-400 font-medium mt-0.5">
                        Orders done at {storeDetails?.name || effectiveStoreId}
                      </p>
                    </div>

                    <button
                      onClick={() => setActiveTab('all_orders')}
                      className="px-2.5 py-1 bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 dark:hover:bg-blue-900/50 text-blue-600 dark:text-blue-300 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center gap-1 transition-all"
                      title="Open full interactive order register"
                    >
                      <span>Full Register</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>

                  {/* Filter Pills for this column */}
                  <div className="flex items-center gap-1.5 py-3 border-b border-gray-50 dark:border-gray-800/80">
                    {[
                      { id: 'all', label: `All (${bookings.length})` },
                      { id: 'active', label: `In Progress (${bookings.filter(b => !['completed', 'cancelled'].includes(b.status)).length})` },
                      { id: 'completed', label: `Completed (${bookings.filter(b => b.status === 'completed').length})` }
                    ].map(f => (
                      <button
                        key={f.id}
                        onClick={() => setSideColumnStatusFilter(f.id as any)}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-black transition-all ${
                          sideColumnStatusFilter === f.id
                            ? 'bg-blue-600 text-white shadow-2xs'
                            : 'bg-gray-100 dark:bg-gray-800 text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>

                  {/* Column Orders List */}
                  <div className="divide-y divide-gray-50 dark:divide-gray-800/80 max-h-[620px] overflow-y-auto pr-1 mt-1 space-y-0.5">
                    {(() => {
                      const colOrders = bookings.filter(b => {
                        if (sideColumnStatusFilter === 'active') {
                          return !['completed', 'cancelled'].includes(b.status);
                        }
                        if (sideColumnStatusFilter === 'completed') {
                          return b.status === 'completed';
                        }
                        return true;
                      });

                      if (colOrders.length === 0) {
                        return (
                          <div className="py-12 text-center text-gray-400 text-xs font-medium space-y-2">
                            <ShoppingBag className="w-8 h-8 mx-auto text-gray-300 dark:text-gray-700" />
                            <p>No orders found for this filter.</p>
                          </div>
                        );
                      }

                      return colOrders.slice(0, 30).map(order => (
                        <div 
                          key={order.id} 
                          className="py-3 px-2 hover:bg-gray-50/80 dark:hover:bg-gray-800/40 rounded-xl transition-all group cursor-pointer"
                          onClick={() => setSelectedBookingForDetails(order)}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-mono font-black text-[11px] text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 px-1.5 py-0.2 rounded">
                                  {order.bookingId || `#${order.id?.slice(-6).toUpperCase()}`}
                                </span>
                                <span className="text-[11px] font-black text-gray-800 dark:text-gray-100 truncate">
                                  {order.userName || 'Student'}
                                </span>
                              </div>

                              <div className="flex items-center gap-2 text-[10px] text-gray-400 font-bold mt-1">
                                <span className="flex items-center gap-1">
                                  <Calendar className="w-3 h-3" />
                                  {order.date}
                                </span>
                                <span>•</span>
                                <span>{order.timeSlot}</span>
                              </div>

                              <p className="text-[10px] text-gray-500 font-medium truncate mt-0.5">
                                {order.serviceType} • {order.approxLoad || (order.totalPieces ? `${order.totalPieces} pcs` : 'Std')}
                              </p>
                            </div>

                            <div className="flex flex-col items-end gap-1 shrink-0">
                              <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                                order.status === 'completed' ? 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300' :
                                ['In Wash', 'In Dryer'].includes(order.status) ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300' :
                                ['Ready to collect', 'Ready for pick up'].includes(order.status) ? 'bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300' :
                                'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300'
                              }`}>
                                {order.status}
                              </span>

                              <span className="text-xs font-black text-gray-900 dark:text-white">
                                {order.paymentType === 'laundry_credits' || (order.paymentType as any) === 'subscription_credits'
                                  ? 'Credits'
                                  : `₹${Number(order.price || order.totalAmount || 0)}`}
                              </span>

                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                                <button
                                  onClick={() => setSelectedBookingForTag(order)}
                                  className="p-1 text-gray-400 hover:text-indigo-600 rounded"
                                  title="Print Tag"
                                >
                                  <Tag className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={() => setSelectedBookingForInvoice(order)}
                                  className="p-1 text-gray-400 hover:text-blue-600 rounded"
                                  title="Print Invoice"
                                >
                                  <Receipt className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ));
                    })()}
                  </div>

                  {/* Bottom Footer button */}
                  <div className="pt-3 border-t border-gray-100 dark:border-gray-800 mt-2">
                    <button
                      onClick={() => setActiveTab('all_orders')}
                      className="w-full py-2.5 bg-gray-50 hover:bg-blue-50 dark:bg-gray-800 dark:hover:bg-blue-950/40 text-gray-700 hover:text-blue-600 dark:text-gray-300 dark:hover:text-blue-400 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all"
                    >
                      <ShoppingBag className="w-3.5 h-3.5" />
                      <span>View All {bookings.length} Orders in Full Table &rarr;</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* ============================================================ */}
        {/* ALL STORE ORDERS TAB (NEW REQUESTED SECTION) */}
        {/* ============================================================ */}
        {activeTab === 'all_orders' && (
          <motion.div
            key="all_orders"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            {/* Header with Title and Search/Filters */}
            <div className="bg-white dark:bg-gray-900 p-6 rounded-[2rem] border border-gray-100 dark:border-gray-800 shadow-xs space-y-4">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-black text-gray-800 dark:text-gray-100 uppercase tracking-tight">All Store Orders</h2>
                    <span className="px-2.5 py-0.5 bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 text-xs font-black rounded-full">
                      {bookings.length} Total
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 font-medium">
                    Complete orders register for <span className="font-bold text-gray-700 dark:text-gray-300">{storeDetails?.name || effectiveStoreId}</span> across all dates.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  {/* Search Bar */}
                  <div className="relative w-full sm:w-72">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search ID, customer, phone..."
                      value={allOrdersSearchTerm}
                      onChange={(e) => setAllOrdersSearchTerm(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs sm:text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {/* Status Dropdown Filter */}
                  <select
                    value={allOrdersStatusFilter}
                    onChange={(e) => setAllOrdersStatusFilter(e.target.value)}
                    className="px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold text-gray-700 dark:text-gray-300 outline-none"
                  >
                    <option value="all">All Statuses</option>
                    <option value="active">Active (In Progress)</option>
                    <option value="paid">Confirmed (Paid)</option>
                    <option value="In Wash">In Wash</option>
                    <option value="In Dryer">In Dryer</option>
                    <option value="Washing completed">Washing completed</option>
                    <option value="Ready to collect">Ready to collect</option>
                    <option value="Ready to deliver">Ready to deliver</option>
                    <option value="Out for delivery">Out for delivery</option>
                    <option value="completed">Completed</option>
                    <option value="pending">Pending</option>
                    <option value="cancelled">Cancelled</option>
                  </select>

                  {/* Service Filter */}
                  <select
                    value={allOrdersServiceFilter}
                    onChange={(e) => setAllOrdersServiceFilter(e.target.value)}
                    className="px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold text-gray-700 dark:text-gray-300 outline-none"
                  >
                    <option value="all">All Services</option>
                    <option value="Wash & Fold">Wash & Fold</option>
                    <option value="Express Wash">Express Wash</option>
                    <option value="Wash & Fold (Per Piece)">Per Piece</option>
                  </select>
                </div>
              </div>

              {/* Date Filter Quick Pills */}
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-gray-50 dark:border-gray-800">
                <span className="text-[10px] font-black uppercase tracking-wider text-gray-400 mr-1">Time Horizon:</span>
                {[
                  { id: 'all', label: `All Dates (${bookings.length})` },
                  { id: 'today', label: `Today (${stats.today})` },
                  { id: 'upcoming', label: `Upcoming (${stats.upcoming})` },
                  { id: 'past', label: `Past / History (${Math.max(0, bookings.length - stats.today - stats.upcoming)})` },
                ].map(df => (
                  <button
                    key={df.id}
                    onClick={() => setAllOrdersDateFilter(df.id as any)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                      allOrdersDateFilter === df.id
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                    }`}
                  >
                    {df.label}
                  </button>
                ))}

                {(allOrdersSearchTerm || allOrdersStatusFilter !== 'all' || allOrdersDateFilter !== 'all' || allOrdersServiceFilter !== 'all') && (
                  <button
                    onClick={() => {
                      setAllOrdersSearchTerm('');
                      setAllOrdersStatusFilter('all');
                      setAllOrdersDateFilter('all');
                      setAllOrdersServiceFilter('all');
                    }}
                    className="ml-auto text-xs text-blue-600 hover:underline font-bold"
                  >
                    Clear All Filters
                  </button>
                )}
              </div>
            </div>

            {/* Orders Table */}
            {(() => {
              const filteredOrders = bookings.filter(order => {
                const search = (allOrdersSearchTerm || '').toLowerCase().trim();
                const matchesSearch = !search || 
                  (order.id || '').toLowerCase().includes(search) ||
                  (order.bookingId || '').toLowerCase().includes(search) ||
                  (order.userName || '').toLowerCase().includes(search) ||
                  (order.phone || '').toLowerCase().includes(search) ||
                  (order.address || '').toLowerCase().includes(search) ||
                  (order.serviceType || '').toLowerCase().includes(search) ||
                  (order.timeSlot || '').toLowerCase().includes(search) ||
                  (order.date || '').toLowerCase().includes(search);

                if (!matchesSearch) return false;

                if (allOrdersStatusFilter !== 'all') {
                  if (allOrdersStatusFilter === 'active') {
                    if (['completed', 'cancelled'].includes(order.status)) return false;
                  } else if (order.status !== allOrdersStatusFilter) {
                    return false;
                  }
                }

                if (allOrdersDateFilter === 'today') {
                  if (order.date !== todayStr) return false;
                } else if (allOrdersDateFilter === 'upcoming') {
                  if ((order.date || '') <= todayStr) return false;
                } else if (allOrdersDateFilter === 'past') {
                  if ((order.date || '') >= todayStr) return false;
                }

                if (allOrdersServiceFilter !== 'all') {
                  if (order.serviceType !== allOrdersServiceFilter) return false;
                }

                return true;
              });

              if (filteredOrders.length === 0) {
                return (
                  <div className="text-center py-16 bg-white dark:bg-gray-900 rounded-[2.5rem] border border-gray-100 dark:border-gray-800 p-8 space-y-3">
                    <div className="w-16 h-16 rounded-3xl bg-gray-50 dark:bg-gray-800 text-gray-400 flex items-center justify-center mx-auto">
                      <ShoppingBag className="w-8 h-8" />
                    </div>
                    <h3 className="text-lg font-black text-gray-800 dark:text-gray-100 uppercase tracking-tight">No Matching Orders Found</h3>
                    <p className="text-xs sm:text-sm text-gray-500 max-w-md mx-auto">
                      No orders match your current search or filter criteria for store <span className="font-semibold text-gray-700 dark:text-gray-300">{storeDetails?.name || effectiveStoreId}</span>.
                    </p>
                    <button
                      onClick={() => {
                        setAllOrdersSearchTerm('');
                        setAllOrdersStatusFilter('all');
                        setAllOrdersDateFilter('all');
                        setAllOrdersServiceFilter('all');
                      }}
                      className="px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl text-xs font-bold hover:bg-gray-200 transition-all"
                    >
                      Reset Filters
                    </button>
                  </div>
                );
              }

              return (
                <div className="bg-white dark:bg-gray-900 rounded-[2.5rem] border border-gray-100 dark:border-gray-800 overflow-hidden shadow-xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-gray-50/70 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                          <th className="px-5 py-4">Order ID & Slot</th>
                          <th className="px-5 py-4">Customer</th>
                          <th className="px-5 py-4">Service & Load</th>
                          <th className="px-5 py-4">Machine</th>
                          <th className="px-5 py-4">Payment</th>
                          <th className="px-5 py-4">Status</th>
                          <th className="px-5 py-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50 dark:divide-gray-800/80 text-xs">
                        {filteredOrders.slice((allOrdersPage - 1) * allOrdersPageSize, allOrdersPage * allOrdersPageSize).map((order) => (
                          <tr key={order.id} className="hover:bg-gray-50/60 dark:hover:bg-gray-800/40 transition-all">
                            {/* Order ID & Time */}
                            <td className="px-5 py-4">
                              <div className="space-y-1">
                                <span className="font-mono font-black text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 px-2 py-0.5 rounded-md inline-block">
                                  {order.bookingId || `#${order.id?.slice(-6).toUpperCase()}`}
                                </span>
                                <div className="flex items-center gap-1.5 text-[11px] text-gray-600 dark:text-gray-300 font-bold">
                                  <Calendar className="w-3 h-3 text-gray-400" />
                                  <span>{order.date}</span>
                                </div>
                                <span className="text-[10px] text-gray-400 font-medium block">
                                  {order.timeSlot}
                                </span>
                              </div>
                            </td>

                            {/* Customer */}
                            <td className="px-5 py-4">
                              <div className="space-y-0.5 max-w-[180px]">
                                <p className="font-black text-gray-800 dark:text-gray-100 truncate">{order.userName || 'Student'}</p>
                                {order.phone && (
                                  <a 
                                    href={`tel:${order.phone}`}
                                    className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline font-bold flex items-center gap-1"
                                  >
                                    <Phone className="w-3 h-3" />
                                    <span>{order.phone}</span>
                                  </a>
                                )}
                                <div className="pt-0.5">
                                  {order.pickupDrop ? (
                                    <span className="text-[9px] font-black uppercase tracking-wider text-purple-700 bg-purple-50 dark:bg-purple-950/50 dark:text-purple-300 px-1.5 py-0.5 rounded">
                                      Pickup/Drop
                                    </span>
                                  ) : (
                                    <span className="text-[9px] font-black uppercase tracking-wider text-gray-500 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">
                                      Store Dropoff
                                    </span>
                                  )}
                                </div>
                              </div>
                            </td>

                            {/* Service & Load */}
                            <td className="px-5 py-4">
                              <div className="space-y-1">
                                <span className="font-bold text-gray-800 dark:text-gray-200 block">
                                  {order.serviceType}
                                </span>
                                <span className="text-[11px] text-gray-500 font-medium">
                                  {order.approxLoad || (order.totalPieces ? `${order.totalPieces} pieces` : 'Standard')}
                                </span>
                                {order.garmentInstructions && (
                                  <p className="text-[10px] text-amber-600 dark:text-amber-400 font-medium italic truncate max-w-[150px]" title={order.garmentInstructions}>
                                    Note: {order.garmentInstructions}
                                  </p>
                                )}
                              </div>
                            </td>

                            {/* Machine Assigned */}
                            <td className="px-5 py-4">
                              {(order as any).machineId || order.machineNumber ? (
                                <span className="px-2.5 py-1 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 rounded-lg text-xs font-bold inline-flex items-center gap-1">
                                  <Monitor className="w-3 h-3" />
                                  <span>M#{order.machineNumber || (order as any).machineId?.split('_')[1]?.replace('M', '') || '1'}</span>
                                </span>
                              ) : (
                                <button
                                  onClick={() => setActiveTab('machines')}
                                  className="text-[11px] font-bold text-gray-500 hover:text-blue-600 bg-gray-50 dark:bg-gray-800 px-2 py-1 rounded-lg border border-dashed border-gray-300 dark:border-gray-700 hover:border-blue-400"
                                >
                                  + Assign
                                </button>
                              )}
                            </td>

                            {/* Payment */}
                            <td className="px-5 py-4">
                              <div className="space-y-0.5">
                                <span className="font-black text-gray-900 dark:text-white text-xs block">
                                  {order.paymentType === 'laundry_credits' || (order.paymentType as any) === 'subscription_credits'
                                    ? 'Credits'
                                    : `₹${Number(order.price || order.totalAmount || 0)}`}
                                </span>
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block capitalize">
                                  {order.paymentType?.replace('_', ' ') || 'Paid'}
                                </span>
                                {order.paymentType === 'pay_at_store' && order.remainingAmount && (
                                  <span className="text-[9px] font-black text-amber-600 bg-amber-50 dark:bg-amber-950/40 px-1 rounded block">
                                    Bal: ₹{order.remainingAmount}
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Status with quick inline updater */}
                            <td className="px-5 py-4">
                              <select 
                                value={order.status}
                                onChange={(e) => updateBookingStatus(order.id!, e.target.value as any)}
                                className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider outline-none border cursor-pointer ${
                                  order.status === 'completed' ? 'bg-green-100 text-green-700 border-green-200 dark:bg-green-950/40 dark:text-green-300 dark:border-green-800' :
                                  order.status === 'Washing completed' ? 'bg-teal-100 text-teal-700 border-teal-200 dark:bg-teal-950/40 dark:text-teal-300 dark:border-teal-800' :
                                  order.status === 'In Wash' ? 'bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800' :
                                  order.status === 'In Dryer' ? 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800' :
                                  order.status === 'pending' ? 'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-950/40 dark:text-yellow-300 dark:border-yellow-800' :
                                  'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800'
                                }`}
                              >
                                {getStatusOptions(order.pickupDrop).map(opt => (
                                  <option key={opt.value} value={opt.value} className="bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
                                    {opt.label}
                                  </option>
                                ))}
                              </select>
                            </td>

                            {/* Actions */}
                            <td className="px-5 py-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => setSelectedBookingForTag(order)}
                                  className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-lg transition-all"
                                  title="Print Washing Tag"
                                >
                                  <Tag className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => setSelectedBookingForInvoice(order)}
                                  className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-lg transition-all"
                                  title="Print Invoice"
                                >
                                  <Receipt className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => setSelectedBookingForDetails(order)}
                                  className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-all"
                                  title="View Order Details"
                                >
                                  <FileText className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {filteredOrders.length > 0 && (
                    <PaginationControls
                      currentPage={allOrdersPage}
                      totalItems={filteredOrders.length}
                      pageSize={allOrdersPageSize}
                      onPageChange={setAllOrdersPage}
                      onPageSizeChange={setAllOrdersPageSize}
                      pageSizeOptions={[5, 10, 25, 50]}
                      itemLabel="orders"
                    />
                  )}
                </div>
              );
            })()}
          </motion.div>
        )}

        {activeTab === 'status' && (
          <motion.div
            key="status"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-black text-gray-800 dark:text-gray-100 uppercase tracking-tight">Global Status Board</h2>
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search all orders..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="bg-white dark:bg-gray-900 rounded-[2.5rem] border border-gray-100 dark:border-gray-800 overflow-hidden shadow-sm">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50/50 dark:bg-gray-800/50">
                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Order ID</th>
                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Customer</th>
                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Service</th>
                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Status</th>
                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Date</th>
                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                  {bookings
                    .filter(b => {
                      const search = (searchTerm || '').toLowerCase();
                      return (b.userName || '').toLowerCase().includes(search) || 
                             (b.id || '').toLowerCase().includes(search) || 
                             (b.bookingId || '').toLowerCase().includes(search) ||
                             (b.userId || '').toLowerCase().includes(search);
                    })
                    .map((booking) => (
                      <tr key={booking.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-all">
                        <td className="px-6 py-4">
                          <span className="text-xs font-black text-gray-800 dark:text-gray-100">{booking.bookingId || `#${booking.id?.slice(-6).toUpperCase()}`}</span>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-sm font-bold text-gray-800 dark:text-gray-100">{booking.userName}</p>
                          {booking.paymentType === 'pay_at_store' && (
                            <span className="inline-block mt-1 px-2 py-0.5 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 rounded text-[9px] font-black uppercase tracking-wider border border-amber-200 dark:border-amber-900/50">
                              Collect ₹{(booking.remainingAmount ?? (booking.price - (booking.prepaidAmount ?? 39))).toFixed(2)} Cash
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm font-medium text-gray-600 dark:text-gray-400">{booking.serviceType}</span>
                          {booking.garmentInstructions && (
                            <p className="text-[10px] text-amber-600 dark:text-amber-400 font-medium italic mt-1 max-w-[150px] truncate" title={booking.garmentInstructions}>
                              Instr: {booking.garmentInstructions}
                            </p>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <select 
                            value={booking.status}
                            onChange={(e) => updateBookingStatus(booking.id!, e.target.value as any)}
                            className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest outline-none border-none cursor-pointer ${
                              ['paid', 'pending'].includes(booking.status) ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                              booking.status === 'Ready for pick up' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                              ['In Wash', 'In Dryer'].includes(booking.status) ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400' :
                              ['Washing completed', 'Ready to deliver'].includes(booking.status) ? 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400' :
                              booking.status === 'Ready to collect' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' :
                              booking.status === 'Out for delivery' ? 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400' :
                              booking.status === 'completed' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                              'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                            }`}
                          >
                            {getStatusOptions(booking.pickupDrop).map(opt => (
                              <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-6 py-4 text-xs font-bold text-gray-500">
                          {booking.date}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => setSelectedBookingForTag(booking)}
                              className="p-2 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 rounded-xl transition-all border border-indigo-200 dark:border-indigo-800 hover:scale-105 active:scale-95"
                              title="Print Washing Tag"
                            >
                              <Tag className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setSelectedBookingForInvoice(booking)}
                              className="p-2 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 dark:hover:bg-blue-900/50 text-blue-600 dark:text-blue-400 rounded-xl transition-all border border-blue-200 dark:border-blue-800 hover:scale-105 active:scale-95"
                              title="Print Tax Invoice"
                            >
                              <Receipt className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}

        {activeTab === 'logistics' && (
          <motion.div
            key="logistics"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-black text-gray-800 dark:text-gray-100 uppercase tracking-tight">Logistics & Delivery</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white dark:bg-gray-900 p-8 rounded-[3rem] border border-gray-100 dark:border-gray-800 shadow-sm">
                <h3 className="text-lg font-black text-gray-800 dark:text-gray-100 uppercase tracking-tight mb-6 flex items-center gap-2">
                  <Truck className="w-5 h-5 text-blue-600" />
                  Ready for Delivery
                </h3>
                <div className="space-y-4">
                  {bookings.filter(b => b.status === 'Ready to deliver').length === 0 ? (
                    <p className="text-sm text-gray-500 font-medium text-center py-8">No orders ready for delivery.</p>
                  ) : (
                    bookings.filter(b => b.status === 'Ready to deliver').map(b => (
                      <div key={b.id} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-gray-100 dark:border-gray-800">
                        <div>
                          <p className="text-sm font-black text-gray-800 dark:text-gray-100">{b.userName}</p>
                          <p className="text-xs text-gray-500 font-bold">{b.address?.slice(0, 30)}...</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setSelectedBookingForTag(b)}
                            className="p-2 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-xl transition-colors border border-indigo-200 dark:border-indigo-800"
                            title="Print Washing Tag"
                          >
                            <Tag className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setSelectedBookingForInvoice(b)}
                            className="p-2 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded-xl transition-colors border border-blue-200 dark:border-blue-800"
                            title="Print Invoice"
                          >
                            <Receipt className="w-3.5 h-3.5" />
                          </button>
                          <button 
                            onClick={() => updateBookingStatus(b.id!, 'Out for delivery')}
                            className="px-4 py-2 bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-blue-700 transition-colors"
                          >
                            Dispatch
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="bg-white dark:bg-gray-900 p-8 rounded-[3rem] border border-gray-100 dark:border-gray-800 shadow-sm">
                <h3 className="text-lg font-black text-gray-800 dark:text-gray-100 uppercase tracking-tight mb-6 flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-indigo-600" />
                  Ready for Pickup
                </h3>
                <div className="space-y-4">
                  {bookings.filter(b => ['Ready for pick up', 'Ready to collect'].includes(b.status)).length === 0 ? (
                    <p className="text-sm text-gray-500 font-medium text-center py-8">No orders ready for pickup.</p>
                  ) : (
                    bookings.filter(b => ['Ready for pick up', 'Ready to collect'].includes(b.status)).map(b => (
                      <div key={b.id} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-gray-100 dark:border-gray-800">
                        <div>
                          <p className="text-sm font-black text-gray-800 dark:text-gray-100">{b.userName}</p>
                          <p className="text-xs text-gray-500 font-bold">
                            {b.status === 'Ready to collect' ? 'Customer Pickup' : 'Driver Pickup'}
                          </p>
                          {b.address && (
                            <p className="text-[10px] text-gray-400 mt-1 truncate max-w-[150px]">{b.address}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setSelectedBookingForTag(b)}
                            className="p-2 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-xl transition-colors border border-indigo-200 dark:border-indigo-800"
                            title="Print Washing Tag"
                          >
                            <Tag className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setSelectedBookingForInvoice(b)}
                            className="p-2 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded-xl transition-colors border border-blue-200 dark:border-blue-800"
                            title="Print Invoice"
                          >
                            <Receipt className="w-3.5 h-3.5" />
                          </button>
                          <button 
                            onClick={() => updateBookingStatus(b.id!, b.status === 'Ready to collect' ? 'completed' : 'In Wash')}
                            className="px-4 py-2 bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-indigo-700 transition-colors"
                          >
                            {b.status === 'Ready to collect' ? 'Handed Over' : 'Picked Up'}
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'machines' && (
          <motion.div
            key="machines"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-black text-gray-800 dark:text-gray-100 uppercase tracking-tight">Machine Fleet</h2>
                <p className="text-gray-500 dark:text-gray-400 font-medium text-sm">
                  Active machines: {machines.filter(m => isMachineAvailableOnDate(m, format(new Date(), 'yyyy-MM-dd'))).length} (= {machines.filter(m => isMachineAvailableOnDate(m, format(new Date(), 'yyyy-MM-dd'))).length} booking slots/hr).
                </p>
              </div>
              <button
                onClick={handleOpenAddMachineModal}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-xs font-black uppercase tracking-wider shadow-sm flex items-center gap-2 hover:scale-105 active:scale-95 transition-all self-start sm:self-auto"
              >
                <Plus className="w-4 h-4" />
                <span>Add Machine</span>
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {machines.map((machine) => {
                const todayStr = format(new Date(), 'yyyy-MM-dd');
                const isAvailableToday = isMachineAvailableOnDate(machine, todayStr);

                return (
                  <div key={machine.id} className="bg-white dark:bg-gray-900 p-6 rounded-[2.5rem] border border-gray-100 dark:border-gray-800 shadow-sm flex flex-col items-center text-center relative group">
                    <button
                      onClick={() => {
                        setMachineToDelete(machine);
                        setIsDeleteConfirmModalOpen(true);
                      }}
                      className="absolute top-4 right-4 p-2 text-gray-300 hover:text-red-500 rounded-xl transition-colors"
                      title="Delete Machine"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>

                    <div className={`w-16 h-16 rounded-[1.5rem] flex items-center justify-center mb-4 ${
                      !isAvailableToday ? 'bg-red-50 text-red-600 dark:bg-red-900/20' :
                      machine.status === 'free' || machine.status === 'idle' ? 'bg-green-50 text-green-600 dark:bg-green-900/20' :
                      machine.status === 'occupied' ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20' :
                      'bg-red-50 text-red-600'
                    }`}>
                      <Monitor className="w-8 h-8" />
                    </div>
                    <h3 className="text-lg font-black text-gray-800 dark:text-gray-100">M#{machine.number}</h3>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">{machine.type}</p>
                    
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest mb-3 ${
                      !isAvailableToday ? 'bg-red-100 text-red-700 dark:bg-red-900/30' :
                      machine.status === 'occupied' ? 'bg-blue-100 text-blue-700' :
                      'bg-green-100 text-green-700'
                    }`}>
                      {!isAvailableToday ? 'Unavailable' : machine.status}
                    </span>

                    {machine.unavailableFrom && (
                      <p className="text-[9px] font-bold text-red-600 dark:text-red-400 mb-3 px-2 py-0.5 bg-red-50 dark:bg-red-950/30 rounded-lg">
                        Offline: {machine.unavailableFrom} {machine.unavailableTo ? `to ${machine.unavailableTo}` : ''}
                      </p>
                    )}

                    <div className="w-full space-y-2 mt-auto">
                      <button
                        onClick={() => handleOpenDateRangeModal(machine)}
                        className="w-full py-1.5 px-2 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 text-gray-600 dark:text-gray-300 text-[10px] font-bold rounded-lg transition-colors border border-gray-200 dark:border-gray-700 flex items-center justify-center gap-1"
                      >
                        <CalendarRange className="w-3 h-3 text-blue-600" />
                        <span>Date Range</span>
                      </button>

                      {machine.status === 'occupied' && (
                        <button
                          onClick={() => clearMachine(machine.id)}
                          className="w-full px-3 py-1 bg-red-50 text-red-600 text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-red-600 hover:text-white transition-all border border-red-100 dark:border-red-900/20"
                        >
                          Force Clear
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}

              <button 
                onClick={handleOpenAddMachineModal}
                className="bg-gray-50 dark:bg-gray-800/50 min-h-[220px] p-6 rounded-[2.5rem] border-2 border-dashed border-gray-200 dark:border-gray-700 flex flex-col items-center justify-center text-gray-400 hover:text-blue-600 hover:border-blue-600 transition-all group"
              >
                <Plus className="w-8 h-8 mb-2 group-hover:scale-110 transition-transform" />
                <span className="text-xs font-black uppercase tracking-widest">Add Machine</span>
              </button>
            </div>
          </motion.div>
        )}
        {activeTab === 'availability' && (
          <motion.div
            key="availability"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-8"
          >
            {/* CAPACITY & FLEET HEADER */}
            <div className="bg-white dark:bg-gray-900 p-6 sm:p-8 rounded-[2.5rem] border border-gray-100 dark:border-gray-800 shadow-sm">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-gray-100 dark:border-gray-800">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <h2 className="text-2xl font-black text-gray-800 dark:text-gray-100 uppercase tracking-tight">Machine Availability Management</h2>
                    <span className="px-3 py-1 bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 text-xs font-black uppercase tracking-wider rounded-full">
                      Store: {user?.storeId}
                    </span>
                  </div>
                  <p className="text-gray-500 dark:text-gray-400 font-medium text-sm">
                    Configure machine availability, schedule offline date ranges, and dynamically scale hourly booking slots.
                  </p>
                </div>
                
                <div className="flex flex-wrap items-center gap-3">
                  {machines.length === 0 && (
                    <button
                      onClick={handleQuickLaunchTwoMachines}
                      disabled={isClearingSlot}
                      className="px-5 py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-2xl text-xs font-black uppercase tracking-wider shadow-sm flex items-center gap-2 hover:scale-105 active:scale-95 transition-all"
                    >
                      <Sparkles className="w-4 h-4" />
                      <span>Quick Setup: 2 Launch Machines</span>
                    </button>
                  )}
                  <button
                    onClick={handleOpenAddMachineModal}
                    className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-xs font-black uppercase tracking-wider shadow-sm flex items-center gap-2 hover:scale-105 active:scale-95 transition-all"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add New Machine</span>
                  </button>
                </div>
              </div>

              {/* Explanatory Banner & Capacity Metric */}
              <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2 p-4 bg-blue-50/70 dark:bg-blue-950/20 rounded-2xl border border-blue-100 dark:border-blue-900/30 flex items-start gap-3">
                  <div className="p-2 bg-blue-600 text-white rounded-xl shrink-0 mt-0.5">
                    <Monitor className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-blue-900 dark:text-blue-200 uppercase tracking-wider">Dynamic Slot Capacity Rule</h4>
                    <p className="text-xs text-blue-800/80 dark:text-blue-300 font-medium mt-0.5 leading-relaxed">
                      Active machines directly dictate consumer slot capacity. For launch, having <strong>2 active machines = 2 slots per hour</strong>, completely preventing overbooking. When you add a 3rd machine, <strong>3 slots per hour</strong> will automatically become available to customers.
                    </p>
                  </div>
                </div>

                <div className="p-4 bg-gray-50 dark:bg-gray-800/60 rounded-2xl border border-gray-100 dark:border-gray-800 flex flex-col justify-center text-center">
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Active Store Capacity</span>
                  <div className="flex items-center justify-center gap-2 mt-1">
                    <span className="text-3xl font-black text-gray-800 dark:text-gray-100">
                      {machines.filter(m => isMachineAvailableOnDate(m, format(new Date(), 'yyyy-MM-dd'))).length}
                    </span>
                    <span className="text-xs font-bold text-gray-500">Slots / Hour</span>
                  </div>
                  <span className="text-[10px] font-medium text-gray-400 mt-0.5">({machines.length} Total Registered Machines)</span>
                </div>
              </div>
            </div>

            {/* STORE MACHINE FLEET CARDS */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest">
                  Store Fleet Machines ({machines.length})
                </h3>
              </div>

              {machines.length === 0 ? (
                <div className="bg-white dark:bg-gray-900 p-12 rounded-[2.5rem] border border-gray-100 dark:border-gray-800 text-center">
                  <Monitor className="w-12 h-12 text-gray-300 dark:text-gray-700 mx-auto mb-3" />
                  <h4 className="text-lg font-black text-gray-700 dark:text-gray-200 uppercase tracking-tight mb-1">No Machines Configured</h4>
                  <p className="text-xs text-gray-500 max-w-md mx-auto mb-6">
                    Set up your 2 launch machines to limit bookings to 2 slots per hour, or add machines manually.
                  </p>
                  <button
                    onClick={handleQuickLaunchTwoMachines}
                    className="px-6 py-3 bg-blue-600 text-white rounded-xl text-xs font-black uppercase tracking-wider hover:bg-blue-700 transition-all shadow-sm"
                  >
                    Quick Setup: 2 Launch Machines
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {machines.map((machine) => {
                    const todayStr = format(new Date(), 'yyyy-MM-dd');
                    const isAvailableToday = isMachineAvailableOnDate(machine, todayStr);
                    const hasDateRange = Boolean(machine.unavailableFrom);

                    return (
                      <div 
                        key={machine.id} 
                        className={`bg-white dark:bg-gray-900 p-6 rounded-[2.5rem] border transition-all shadow-sm flex flex-col justify-between ${
                          !isAvailableToday 
                            ? 'border-red-200 dark:border-red-900/30' 
                            : 'border-gray-100 dark:border-gray-800'
                        }`}
                      >
                        <div>
                          {/* Card Top Row */}
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex items-center gap-3">
                              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                                isAvailableToday 
                                  ? 'bg-green-50 text-green-600 dark:bg-green-900/20' 
                                  : 'bg-red-50 text-red-600 dark:bg-red-900/20'
                              }`}>
                                <Monitor className="w-6 h-6" />
                              </div>
                              <div>
                                <h3 className="text-lg font-black text-gray-800 dark:text-gray-100">Machine #{machine.number}</h3>
                                <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">
                                  {machine.type}
                                </span>
                              </div>
                            </div>

                            <button
                              onClick={() => {
                                setMachineToDelete(machine);
                                setIsDeleteConfirmModalOpen(true);
                              }}
                              className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all"
                              title="Delete Machine"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>

                          {/* Status Badge */}
                          <div className="mb-4">
                            {hasDateRange ? (
                              <div className="p-3 bg-red-50 dark:bg-red-950/20 rounded-xl border border-red-100 dark:border-red-900/30">
                                <div className="flex items-center gap-1.5 text-red-600 dark:text-red-400 text-xs font-black uppercase tracking-tight">
                                  <CalendarRange className="w-3.5 h-3.5" />
                                  <span>Unavailable (Scheduled Date Range)</span>
                                </div>
                                <p className="text-[11px] font-bold text-gray-700 dark:text-gray-300 mt-1">
                                  From {machine.unavailableFrom} {machine.unavailableTo ? `to ${machine.unavailableTo}` : '(Indefinite)'}
                                </p>
                                {machine.unavailableReason && (
                                  <p className="text-[10px] text-gray-500 italic mt-0.5">
                                    "{machine.unavailableReason}"
                                  </p>
                                )}
                              </div>
                            ) : machine.isAvailable ? (
                              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 text-[10px] font-black uppercase tracking-wider rounded-full">
                                <ShieldCheck className="w-3.5 h-3.5" />
                                <span>Active & Available</span>
                              </div>
                            ) : (
                              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 text-[10px] font-black uppercase tracking-wider rounded-full">
                                <ShieldAlert className="w-3.5 h-3.5" />
                                <span>Marked Inactive</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="space-y-2 pt-4 border-t border-gray-100 dark:border-gray-800">
                          <button
                            onClick={() => handleOpenDateRangeModal(machine)}
                            className="w-full py-2.5 px-3 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 border border-gray-200 dark:border-gray-700"
                          >
                            <CalendarRange className="w-3.5 h-3.5 text-blue-600" />
                            <span>{hasDateRange ? 'Edit Date Range Non-Availability' : 'Schedule Inactive Dates'}</span>
                          </button>

                          <div className="flex gap-2">
                            <button
                              onClick={() => handleToggleMachineGlobalAvailability(machine)}
                              disabled={isClearingSlot}
                              className={`flex-1 py-2 px-3 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all border flex items-center justify-center gap-1.5 ${
                                machine.isAvailable
                                  ? 'bg-red-50 text-red-600 border-red-100 hover:bg-red-600 hover:text-white'
                                  : 'bg-green-50 text-green-600 border-green-100 hover:bg-green-600 hover:text-white'
                              }`}
                            >
                              {machine.isAvailable ? 'Mark Inactive' : 'Make Active'}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* TIME SLOT INSPECTOR & OVERRIDES */}
            <div className="pt-8 border-t border-gray-200 dark:border-gray-800 space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                  <h3 className="text-xl font-black text-gray-800 dark:text-gray-100 uppercase tracking-tight">Time Slot Booking Inspector</h3>
                  <p className="text-gray-500 dark:text-gray-400 font-medium text-xs">
                    Inspect specific hourly slots on a given date to view customer bookings or override slot status.
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Select Date</label>
                    <input
                      type="date"
                      value={availabilityDate}
                      onChange={(e) => setAvailabilityDate(e.target.value)}
                      className="px-4 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Select Time Slot</label>
                    <select
                      value={selectedTimeSlot}
                      onChange={(e) => setSelectedTimeSlot(e.target.value)}
                      className="px-4 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {availableSlots.map(slot => (
                        <option key={slot} value={slot}>{slot}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Dynamic Slot Machines List */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {machines.length === 0 ? (
                  <p className="col-span-full text-center text-sm text-gray-400 py-6">
                    No machines configured. Please add machines above to view slots.
                  </p>
                ) : (
                  machines.map((machine) => {
                    const machineNum = machine.number.toString();
                    const isAvailableOnSelectedDate = isMachineAvailableOnDate(machine, availabilityDate);
                    const bookedUserId = currentSlotData?.machines[machineNum];
                    const bookedUser = users.find(u => u.uid === bookedUserId);
                    
                    return (
                      <div 
                        key={machine.id} 
                        className="bg-white dark:bg-gray-900 p-6 rounded-[2.5rem] border border-gray-100 dark:border-gray-800 shadow-sm flex flex-col items-center text-center relative overflow-hidden group"
                      >
                        <div className={`w-16 h-16 rounded-[1.5rem] flex items-center justify-center mb-4 transition-all duration-500 ${
                          !isAvailableOnSelectedDate 
                            ? 'bg-amber-50 text-amber-600 dark:bg-amber-900/20' 
                            : bookedUserId 
                              ? (bookedUserId === 'unavailable' ? 'bg-red-50 text-red-600 dark:bg-red-900/20' : 'bg-blue-50 text-blue-600 dark:bg-blue-900/20') 
                              : 'bg-green-50 text-green-600 dark:bg-green-900/20'
                        }`}>
                          <Monitor className="w-8 h-8" />
                        </div>
                        
                        <h3 className="text-lg font-black text-gray-800 dark:text-gray-100 mb-0.5">Machine #{machine.number}</h3>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">{machine.type}</p>
                        
                        {!isAvailableOnSelectedDate ? (
                          <div className="space-y-3 w-full">
                            <div className="p-3 bg-amber-50 dark:bg-amber-950/20 rounded-2xl border border-amber-100 dark:border-amber-900/30 text-center">
                              <p className="text-[10px] font-black text-amber-700 dark:text-amber-300 uppercase tracking-wider">Scheduled Offline on this Date</p>
                              {machine.unavailableReason && (
                                <p className="text-[10px] text-gray-500 italic mt-0.5">"{machine.unavailableReason}"</p>
                              )}
                            </div>
                            <button
                              onClick={() => handleOpenDateRangeModal(machine)}
                              className="w-full py-2 text-[10px] font-black uppercase tracking-wider text-blue-600 bg-blue-50 dark:bg-blue-950/30 rounded-xl hover:bg-blue-100"
                            >
                              Edit Schedule
                            </button>
                          </div>
                        ) : bookedUserId ? (
                          <div className="space-y-4 w-full">
                            <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-gray-100 dark:border-gray-800">
                              {bookedUserId === 'unavailable' ? (
                                <div className="flex flex-col items-center py-1">
                                  <Ban className="w-5 h-5 text-red-500 mb-1" />
                                  <p className="text-[10px] font-black text-red-600 uppercase tracking-widest">Marked Unavailable</p>
                                </div>
                              ) : (
                                <>
                                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Booked By</p>
                                  <p className="text-xs font-bold text-gray-800 dark:text-gray-100 truncate">{bookedUser?.name || 'Customer'}</p>
                                  <p className="text-[9px] font-mono text-gray-500 truncate">{bookedUserId}</p>
                                </>
                              )}
                            </div>
                            
                            <button
                              onClick={() => bookedUserId === 'unavailable' ? handleToggleSlotMachineAvailability(machineNum, false) : handleClearSlot(machineNum)}
                              disabled={isClearingSlot}
                              className={`w-full py-2.5 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all border flex items-center justify-center gap-2 ${
                                bookedUserId === 'unavailable' 
                                  ? 'bg-green-50 text-green-600 border-green-100 hover:bg-green-600 hover:text-white' 
                                  : 'bg-red-50 text-red-600 border-red-100 hover:bg-red-600 hover:text-white'
                              }`}
                            >
                              {isClearingSlot ? <Loader2 className="w-3 h-3 animate-spin" /> : bookedUserId === 'unavailable' ? <CheckCircle2 className="w-3 h-3" /> : <Trash2 className="w-3 h-3" />}
                              {bookedUserId === 'unavailable' ? 'Make Available' : 'Clear Slot'}
                            </button>
                          </div>
                        ) : (
                          <div className="flex flex-col gap-3 w-full">
                            <div className="py-1">
                              <span className="px-3 py-1 bg-green-100 text-green-700 text-[10px] font-black uppercase tracking-widest rounded-full">
                                Available
                              </span>
                            </div>
                            <button
                              onClick={() => handleToggleSlotMachineAvailability(machineNum, true)}
                              disabled={isClearingSlot}
                              className="w-full py-2.5 bg-gray-50 text-gray-600 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-gray-800 hover:text-white transition-all border border-gray-100 dark:border-gray-800 flex items-center justify-center gap-1.5"
                            >
                              {isClearingSlot ? <Loader2 className="w-3 h-3 animate-spin" /> : <Ban className="w-3 h-3" />}
                              Mark Unavailable
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MODAL: ADD NEW MACHINE */}
      {isAddMachineModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            onClick={() => setIsAddMachineModalOpen(false)}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm cursor-pointer"
            aria-label="Close modal overlay"
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative z-10 bg-white dark:bg-gray-900 rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-gray-100 dark:border-gray-800"
          >
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-xl font-black text-gray-800 dark:text-gray-100 uppercase tracking-tight">Add New Machine</h3>
                <p className="text-xs text-gray-500 font-medium">Add a machine to increase hourly slots capacity</p>
              </div>
              <button 
                onClick={() => setIsAddMachineModalOpen(false)}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveNewMachine} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider block mb-1">
                  Machine Number
                </label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  required
                  value={machineForm.number}
                  onChange={(e) => setMachineForm({ ...machineForm, number: parseInt(e.target.value, 10) || 1 })}
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider block mb-1">
                  Machine Type
                </label>
                <select
                  value={machineForm.type}
                  onChange={(e) => setMachineForm({ ...machineForm, type: e.target.value as 'washer' | 'dryer' })}
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="washer">Standard Washer</option>
                  <option value="dryer">Express Dryer</option>
                </select>
              </div>

              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-2xl">
                <div>
                  <p className="text-xs font-bold text-gray-800 dark:text-gray-200 uppercase tracking-wider">Initial Availability</p>
                  <p className="text-[10px] text-gray-500">Enable this machine immediately for customer booking</p>
                </div>
                <button
                  type="button"
                  onClick={() => setMachineForm({ ...machineForm, isAvailable: !machineForm.isAvailable })}
                  className={`w-12 h-6 rounded-full transition-colors relative p-0.5 ${
                    machineForm.isAvailable ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-700'
                  }`}
                >
                  <div className={`w-5 h-5 rounded-full bg-white transition-transform ${
                    machineForm.isAvailable ? 'translate-x-6' : 'translate-x-0'
                  }`} />
                </button>
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsAddMachineModalOpen(false)}
                  className="flex-1 py-3 text-xs font-bold uppercase tracking-wider text-gray-500 bg-gray-100 dark:bg-gray-800 rounded-xl hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isClearingSlot}
                  className="flex-1 py-3 text-xs font-black uppercase tracking-wider text-white bg-blue-600 rounded-xl hover:bg-blue-700 shadow-md shadow-blue-500/20"
                >
                  Save Machine
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* MODAL: SCHEDULE NON-AVAILABILITY DATE RANGE */}
      {isDateRangeModalOpen && machineToEditDateRange && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            onClick={() => {
              setIsDateRangeModalOpen(false);
              setMachineToEditDateRange(null);
            }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm cursor-pointer"
            aria-label="Close modal overlay"
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative z-10 bg-white dark:bg-gray-900 rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-gray-100 dark:border-gray-800"
          >
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-xl font-black text-gray-800 dark:text-gray-100 uppercase tracking-tight">
                  Schedule Non-Availability
                </h3>
                <p className="text-xs text-blue-600 dark:text-blue-400 font-bold">
                  Machine #{machineToEditDateRange.number} ({machineToEditDateRange.type})
                </p>
              </div>
              <button 
                onClick={() => {
                  setIsDateRangeModalOpen(false);
                  setMachineToEditDateRange(null);
                }}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-gray-500 mb-5 leading-relaxed">
              Set a date range during which this machine will be unavailable. During this window, hourly slots for customers will automatically reduce so overbooking cannot occur.
            </p>

            <form onSubmit={handleSaveDateRange} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider block mb-1">
                  Unavailable From (Start Date) *
                </label>
                <input
                  type="date"
                  required
                  value={dateRangeForm.unavailableFrom}
                  onChange={(e) => setDateRangeForm({ ...dateRangeForm, unavailableFrom: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider block mb-1">
                  Unavailable To (End Date, Inclusive)
                </label>
                <input
                  type="date"
                  value={dateRangeForm.unavailableTo}
                  min={dateRangeForm.unavailableFrom}
                  onChange={(e) => setDateRangeForm({ ...dateRangeForm, unavailableTo: e.target.value })}
                  placeholder="Leave blank for ongoing / indefinite"
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-[10px] text-gray-400 mt-1 block">Leave blank if unavailable until further notice</span>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider block mb-1">
                  Reason / Notes
                </label>
                <input
                  type="text"
                  placeholder="e.g. Launch restriction, Maintenance, Waiting for parts"
                  value={dateRangeForm.unavailableReason}
                  onChange={(e) => setDateRangeForm({ ...dateRangeForm, unavailableReason: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="pt-4 flex flex-col gap-2">
                <button
                  type="submit"
                  disabled={isClearingSlot}
                  className="w-full py-3 text-xs font-black uppercase tracking-wider text-white bg-blue-600 rounded-xl hover:bg-blue-700 shadow-md shadow-blue-500/20"
                >
                  Save Date Range Restriction
                </button>

                {machineToEditDateRange.unavailableFrom && (
                  <button
                    type="button"
                    onClick={handleClearDateRange}
                    disabled={isClearingSlot}
                    className="w-full py-2.5 text-xs font-bold uppercase tracking-wider text-red-600 bg-red-50 hover:bg-red-100 rounded-xl transition-colors"
                  >
                    Clear Restriction (Restore Full Availability)
                  </button>
                )}
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* MODAL: DELETE MACHINE CONFIRMATION */}
      {isDeleteConfirmModalOpen && machineToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            onClick={() => {
              setIsDeleteConfirmModalOpen(false);
              setMachineToDelete(null);
            }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm cursor-pointer"
            aria-label="Close modal overlay"
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative z-10 bg-white dark:bg-gray-900 rounded-3xl max-w-sm w-full p-6 text-center shadow-2xl border border-gray-100 dark:border-gray-800"
          >
            <div className="w-14 h-14 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-black text-gray-800 dark:text-gray-100 uppercase tracking-tight mb-2">
              Delete Machine #{machineToDelete.number}?
            </h3>
            <p className="text-xs text-gray-500 leading-relaxed mb-6">
              Deleting this machine will permanently remove it from your fleet and reduce hourly booking capacity by 1 slot per hour.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setIsDeleteConfirmModalOpen(false);
                  setMachineToDelete(null);
                }}
                className="flex-1 py-3 text-xs font-bold uppercase tracking-wider text-gray-500 bg-gray-100 dark:bg-gray-800 rounded-xl hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteMachine}
                disabled={isClearingSlot}
                className="flex-1 py-3 text-xs font-black uppercase tracking-wider text-white bg-red-600 rounded-xl hover:bg-red-700 shadow-md shadow-red-500/20"
              >
                Delete Machine
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Washing Tag Print Modal */}
      {selectedBookingForTag && (
        <WashingTagModal
          booking={selectedBookingForTag}
          storeName={storeDetails?.name}
          storePhone={storeDetails?.phone}
          storeAddress={storeDetails?.address}
          onClose={() => setSelectedBookingForTag(null)}
          onUpdated={(updatedFields) => {
            setBookings(prev => prev.map(b => b.id === selectedBookingForTag.id ? { ...b, ...updatedFields } : b));
          }}
        />
      )}

      {/* Tax Invoice Print Modal */}
      {selectedBookingForInvoice && (
        <InvoiceModal
          booking={selectedBookingForInvoice}
          storeName={storeDetails?.name}
          storePhone={storeDetails?.phone}
          storeAddress={storeDetails?.address}
          onClose={() => setSelectedBookingForInvoice(null)}
        />
      )}

      {/* QR & Barcode Tag Scanner Modal */}
      {isScannerOpen && (
        <TagScannerModal
          onClose={() => setIsScannerOpen(false)}
          onOpenTagModal={(b) => setSelectedBookingForTag(b)}
          storeId={effectiveStoreId}
        />
      )}

      {/* Order Details Modal */}
      {selectedBookingForDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            onClick={() => setSelectedBookingForDetails(null)}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm cursor-pointer"
            aria-label="Close modal overlay"
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative z-10 bg-white dark:bg-gray-900 rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-gray-100 dark:border-gray-800 max-h-[90vh] overflow-y-auto space-y-6"
          >
            <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-gray-800">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-blue-600 dark:text-blue-400">Order Dossier</span>
                <h3 className="text-xl font-black text-gray-800 dark:text-gray-100">
                  {selectedBookingForDetails.bookingId || `#${selectedBookingForDetails.id?.slice(-6).toUpperCase()}`}
                </h3>
              </div>
              <button 
                onClick={() => setSelectedBookingForDetails(null)}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Customer Details */}
            <div className="p-4 bg-gray-50 dark:bg-gray-800/60 rounded-2xl space-y-2">
              <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">Customer Details</p>
              <div className="flex justify-between items-center text-sm font-bold text-gray-800 dark:text-gray-200">
                <span>{selectedBookingForDetails.userName || 'Student'}</span>
                {selectedBookingForDetails.phone && (
                  <a href={`tel:${selectedBookingForDetails.phone}`} className="text-blue-600 hover:underline text-xs flex items-center gap-1">
                    <Phone className="w-3 h-3" />
                    <span>{selectedBookingForDetails.phone}</span>
                  </a>
                )}
              </div>
              {selectedBookingForDetails.address && (
                <p className="text-xs text-gray-500 font-medium">
                  {selectedBookingForDetails.address}
                </p>
              )}
            </div>

            {/* Slot & Service */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-gray-50 dark:bg-gray-800/60 rounded-xl">
                <span className="text-[10px] font-black uppercase text-gray-400 block mb-0.5">Date & Slot</span>
                <span className="font-bold text-gray-800 dark:text-gray-200 block">{selectedBookingForDetails.date}</span>
                <span className="text-[11px] text-gray-500">{selectedBookingForDetails.timeSlot}</span>
              </div>
              <div className="p-3 bg-gray-50 dark:bg-gray-800/60 rounded-xl">
                <span className="text-[10px] font-black uppercase text-gray-400 block mb-0.5">Service & Load</span>
                <span className="font-bold text-gray-800 dark:text-gray-200 block">{selectedBookingForDetails.serviceType}</span>
                <span className="text-[11px] text-gray-500">{selectedBookingForDetails.approxLoad || `${selectedBookingForDetails.totalPieces || ''} pcs`}</span>
              </div>
            </div>

            {/* Garment Instructions */}
            {selectedBookingForDetails.garmentInstructions && (
              <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-xl">
                <p className="text-[10px] font-black text-amber-700 dark:text-amber-400 uppercase tracking-wider mb-0.5">Special Care Instructions</p>
                <p className="text-xs text-amber-900 dark:text-amber-200 italic font-medium">"{selectedBookingForDetails.garmentInstructions}"</p>
              </div>
            )}

            {/* Payment Details */}
            <div className="p-4 bg-gray-50 dark:bg-gray-800/60 rounded-2xl space-y-2 text-xs">
              <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">Payment Breakdown</p>
              <div className="flex justify-between text-gray-600 dark:text-gray-300">
                <span>Total Amount:</span>
                <span className="font-black text-gray-900 dark:text-white">
                  {(selectedBookingForDetails.paymentType as string) === 'subscription_credits' || selectedBookingForDetails.paymentType === 'laundry_credits'
                    ? 'Credits'
                    : `₹${Number(selectedBookingForDetails.price || selectedBookingForDetails.totalAmount || 0)}`}
                </span>
              </div>
              <div className="flex justify-between text-gray-600 dark:text-gray-300">
                <span>Payment Mode:</span>
                <span className="font-bold capitalize">{selectedBookingForDetails.paymentType?.replace('_', ' ') || 'Paid'}</span>
              </div>
              {selectedBookingForDetails.paymentType === 'pay_at_store' && (
                <>
                  <div className="flex justify-between text-emerald-600 font-bold">
                    <span>Prepaid Slot Deposit:</span>
                    <span>₹{selectedBookingForDetails.prepaidAmount || 0}</span>
                  </div>
                  <div className="flex justify-between text-amber-600 font-black">
                    <span>Payable at Store:</span>
                    <span>₹{selectedBookingForDetails.remainingAmount || 0}</span>
                  </div>
                </>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => {
                  setSelectedBookingForTag(selectedBookingForDetails);
                  setSelectedBookingForDetails(null);
                }}
                className="px-4 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
              >
                <Tag className="w-4 h-4" />
                <span>Wash Tag</span>
              </button>
              <button
                onClick={() => {
                  setSelectedBookingForInvoice(selectedBookingForDetails);
                  setSelectedBookingForDetails(null);
                }}
                className="px-4 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
              >
                <Receipt className="w-4 h-4" />
                <span>Invoice</span>
              </button>
              <button
                onClick={() => setSelectedBookingForDetails(null)}
                className="px-5 py-2.5 bg-gray-900 hover:bg-gray-800 text-white dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100 rounded-xl text-xs font-bold transition-all"
              >
                Close
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default StoreManagerDashboard;
