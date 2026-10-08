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
  Sparkles
} from 'lucide-react';
import { collection, query, where, onSnapshot, updateDoc, doc, orderBy, limit, getDocs, getDoc, runTransaction, setDoc, deleteDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { Booking, Machine, User as AppUser, TIME_SLOTS, Slot, isMachineAvailableOnDate } from '../../types';
import { format } from 'date-fns';
import { WashingTagModal } from '../../components/WashingTagModal';
import { InvoiceModal } from '../../components/InvoiceModal';
import { TagScannerModal } from '../../components/TagScannerModal';
import { authFetch } from '../../utils/api';

const StoreManagerDashboard: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'today' | 'machines' | 'status' | 'logistics' | 'issues' | 'availability'>('today');
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [storeStaff, setStoreStaff] = useState<AppUser[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBookingForTag, setSelectedBookingForTag] = useState<Booking | null>(null);
  const [selectedBookingForInvoice, setSelectedBookingForInvoice] = useState<Booking | null>(null);
  const [storeDetails, setStoreDetails] = useState<{ name: string; phone: string; address: string } | null>(null);
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  // Machine Availability & Fleet Management State
  const [availabilityDate, setAvailabilityDate] = useState(format(new Date(), 'yyyy-MM-dd'));
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

  useEffect(() => {
    if (!user?.storeId) return;

    // Fetch all users for resolving booking user ids
    const usersQuery = query(collection(db, 'users'));
    const unsubscribeUsers = onSnapshot(usersQuery, (snapshot) => {
      setUsers(snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() })) as AppUser[]);
    }, (error) => {
      console.warn('Users snapshot error:', error);
    });

    // Fetch store bookings
    const bookingsQuery = query(
      collection(db, 'bookings'),
      where('storeId', '==', user.storeId),
      orderBy('createdAt', 'desc')
    );

    const unsubscribeBookings = onSnapshot(bookingsQuery, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Booking[];
      setBookings(data);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'bookings');
      setLoading(false);
    });

    // Fetch store machines
    const machinesQuery = query(
      collection(db, 'machines'),
      where('storeId', '==', user.storeId)
    );

    const unsubscribeMachines = onSnapshot(machinesQuery, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Machine[];
      setMachines(data.sort((a, b) => a.number - b.number));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'machines');
    });

    // Fetch store details for printing tags and invoices
    const unsubStore = onSnapshot(doc(db, 'stores', user.storeId), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setStoreDetails({
          name: data.name || `WASHWISE Store (${user.storeId})`,
          phone: data.phone || '+91 98470 12345',
          address: data.address || data.location || 'Store Location'
        });
      } else {
        setStoreDetails({
          name: `WASHWISE Store (${user.storeId})`,
          phone: '+91 98470 12345',
          address: 'Store Location'
        });
      }
    }, (error) => {
      console.warn('Store snapshot error:', error);
    });

    return () => {
      unsubscribeBookings();
      unsubscribeMachines();
      unsubscribeUsers();
      unsubStore();
    };
  }, [user?.storeId]);

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
    if (!user?.storeId) return;
    setIsClearingSlot(true);
    try {
      const m1Id = `${user.storeId}_M1_washer`;
      const m2Id = `${user.storeId}_M2_washer`;
      await setDoc(doc(db, 'machines', m1Id), {
        id: m1Id,
        storeId: user.storeId,
        number: 1,
        type: 'washer',
        status: 'idle',
        isAvailable: true,
        createdAt: new Date().toISOString()
      });
      await setDoc(doc(db, 'machines', m2Id), {
        id: m2Id,
        storeId: user.storeId,
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
    if (!user?.storeId) return;
    setIsClearingSlot(true);
    try {
      const mId = `${user.storeId}_M${machineForm.number}_${machineForm.type}`;
      const payload: any = {
        id: mId,
        storeId: user.storeId,
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

  const stats = {
    today: bookings.filter(b => b.date === format(new Date(), 'yyyy-MM-dd')).length,
    pending: bookings.filter(b => b.status === 'pending').length,
    washing: bookings.filter(b => b.status === 'In Wash').length,
    ready: bookings.filter(b => ['Ready to collect', 'Ready to deliver'].includes(b.status)).length,
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

  if (!user?.storeId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <div className="w-24 h-24 bg-amber-50 dark:bg-amber-900/20 rounded-[2.5rem] flex items-center justify-center mb-6">
          <AlertCircle className="w-12 h-12 text-amber-600" />
        </div>
        <h2 className="text-3xl font-black text-gray-800 dark:text-gray-100 tracking-tight uppercase mb-2">Store Not Assigned</h2>
        <p className="text-gray-500 dark:text-gray-400 font-medium max-w-md mx-auto">
          Your account has not been assigned to a specific store yet. Please contact the Super Admin to assign you to a store location.
        </p>
        <div className="mt-8 p-6 bg-gray-50 dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700">
          <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Your User ID</p>
          <code className="text-sm font-mono text-blue-600 dark:text-blue-400">{user?.uid}</code>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 className="w-12 h-12 text-blue-600 animate-spin mb-4" />
        <p className="text-gray-500 font-black uppercase tracking-widest text-sm">Loading Dashboard...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-gray-800 dark:text-gray-100 tracking-tight uppercase">STORE MANAGER</h1>
          <p className="text-gray-500 dark:text-gray-400 font-medium">
            Manage your store operations, machines, and staff tasks.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsScannerOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-sm hover:scale-105 active:scale-95 transition-all"
            title="Scan garment tags using camera or barcode gun"
          >
            <QrCode className="w-4 h-4" />
            <span>Scan Tag / QR</span>
          </button>
          <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
            <MapPin className="w-4 h-4 text-blue-600" />
            <span className="text-sm font-bold text-blue-700 dark:text-blue-400">Store: {user?.storeId || 'Not Assigned'}</span>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Today's Orders", value: stats.today, color: 'blue', icon: Calendar },
          { label: 'Pending', value: stats.pending, color: 'yellow', icon: Clock },
          { label: 'In Wash', value: stats.washing, color: 'indigo', icon: Loader2 },
          { label: 'Ready', value: stats.ready, color: 'green', icon: CheckCircle2 },
        ].map((stat, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-white dark:bg-gray-900 p-6 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm"
          >
            <div className="flex items-center justify-between mb-2">
              <stat.icon className={`w-5 h-5 text-${stat.color}-600`} />
              <span className={`text-[10px] font-black uppercase tracking-widest text-${stat.color}-600/50`}>Live</span>
            </div>
            <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">{stat.label}</p>
            <p className={`text-2xl font-black text-${stat.color}-600 dark:text-${stat.color}-400 tracking-tight`}>{stat.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex space-x-4 border-b border-gray-100 dark:border-gray-800 overflow-x-auto pb-px">
        {[
          { id: 'today', label: "Today's Orders", icon: Calendar },
          { id: 'machines', label: 'Machines', icon: Monitor },
          { id: 'availability', label: 'Machine Slots', icon: Clock },
          { id: 'status', label: 'Status Board', icon: LayoutDashboard },
          { id: 'logistics', label: 'Logistics', icon: Truck },
          { id: 'issues', label: 'Issues', icon: AlertCircle },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`pb-4 px-2 text-sm font-bold transition-all relative whitespace-nowrap flex items-center gap-2 ${
              activeTab === tab.id ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
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
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-black text-gray-800 dark:text-gray-100 uppercase tracking-tight">Orders for {format(new Date(), 'MMM dd, yyyy')}</h2>
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search orders..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

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
                              💵 Collect ₹{(booking.remainingAmount ?? (booking.price - (booking.prepaidAmount ?? 39))).toFixed(2)} Cash
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
                      {TIME_SLOTS.map(slot => (
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
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-gray-900 rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-gray-100 dark:border-gray-800"
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
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-gray-900 rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-gray-100 dark:border-gray-800"
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
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-gray-900 rounded-3xl max-w-sm w-full p-6 text-center shadow-2xl border border-gray-100 dark:border-gray-800"
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
          storeId={user?.storeId}
        />
      )}
    </div>
  );
};

export default StoreManagerDashboard;
