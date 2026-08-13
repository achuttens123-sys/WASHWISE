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
  Ban
} from 'lucide-react';
import { collection, query, where, onSnapshot, updateDoc, doc, orderBy, limit, getDocs, getDoc, runTransaction, setDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { Booking, Machine, User as AppUser, TIME_SLOTS, Slot } from '../../types';
import { format } from 'date-fns';

const StoreManagerDashboard: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'today' | 'machines' | 'status' | 'logistics' | 'issues' | 'availability'>('today');
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [storeStaff, setStoreStaff] = useState<AppUser[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Machine Availability State
  const [availabilityDate, setAvailabilityDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedTimeSlot, setSelectedTimeSlot] = useState(TIME_SLOTS[0]);
  const [currentSlotData, setCurrentSlotData] = useState<Slot | null>(null);
  const [isClearingSlot, setIsClearingSlot] = useState(false);

  useEffect(() => {
    if (!user?.storeId) return;

    // Fetch all users for resolving booking user ids
    const usersQuery = query(collection(db, 'users'));
    const unsubscribeUsers = onSnapshot(usersQuery, (snapshot) => {
      setUsers(snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() })) as AppUser[]);
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

    return () => {
      unsubscribeBookings();
      unsubscribeMachines();
      unsubscribeUsers();
    };
  }, [user?.storeId]);

  const updateBookingStatus = async (id: string, status: Booking['status']) => {
    try {
      await updateDoc(doc(db, 'bookings', id), { status });
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
        <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
          <MapPin className="w-4 h-4 text-blue-600" />
          <span className="text-sm font-bold text-blue-700 dark:text-blue-400">Store: {user?.storeId || 'Not Assigned'}</span>
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
                .filter(b => b.userName.toLowerCase().includes(searchTerm.toLowerCase()) || b.id?.toLowerCase().includes(searchTerm.toLowerCase()))
                .map((booking) => (
                  <div key={booking.id} className="bg-white dark:bg-gray-900 p-6 rounded-[2rem] border border-gray-100 dark:border-gray-800 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/20 rounded-2xl flex items-center justify-center">
                        <User className="w-6 h-6 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-sm font-black text-gray-800 dark:text-gray-100">{booking.userName}</p>
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

                    <div className="flex items-center gap-2">
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
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                  {bookings
                    .filter(b => b.userName.toLowerCase().includes(searchTerm.toLowerCase()) || b.id?.toLowerCase().includes(searchTerm.toLowerCase()))
                    .map((booking) => (
                      <tr key={booking.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-all">
                        <td className="px-6 py-4">
                          <span className="text-xs font-black text-gray-800 dark:text-gray-100">#{booking.id?.slice(-6).toUpperCase()}</span>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-sm font-bold text-gray-800 dark:text-gray-100">{booking.userName}</p>
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
                        <button 
                          onClick={() => updateBookingStatus(b.id!, 'Out for delivery')}
                          className="px-4 py-2 bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-blue-700 transition-colors"
                        >
                          Dispatch
                        </button>
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
                        <button 
                          onClick={() => updateBookingStatus(b.id!, b.status === 'Ready to collect' ? 'completed' : 'In Wash')}
                          className="px-4 py-2 bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-indigo-700 transition-colors"
                        >
                          {b.status === 'Ready to collect' ? 'Handed Over' : 'Picked Up'}
                        </button>
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
            className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6"
          >
            {machines.map((machine) => (
              <div key={machine.id} className="bg-white dark:bg-gray-900 p-6 rounded-[2.5rem] border border-gray-100 dark:border-gray-800 shadow-sm flex flex-col items-center text-center">
                <div className={`w-16 h-16 rounded-[1.5rem] flex items-center justify-center mb-4 ${
                  machine.status === 'free' ? 'bg-green-50 text-green-600' :
                  machine.status === 'occupied' ? 'bg-blue-50 text-blue-600' :
                  'bg-red-50 text-red-600'
                }`}>
                  <Monitor className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-black text-gray-800 dark:text-gray-100">M#{machine.number}</h3>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">{machine.type}</p>
                <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                  machine.status === 'free' ? 'bg-green-100 text-green-700' :
                  machine.status === 'occupied' ? 'bg-blue-100 text-blue-700' :
                  'bg-red-100 text-red-700'
                }`}>
                  {machine.status}
                </span>

                {machine.status === 'occupied' && (
                  <button
                    onClick={() => clearMachine(machine.id)}
                    className="mt-4 px-3 py-1 bg-red-50 text-red-600 text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-red-600 hover:text-white transition-all border border-red-100 dark:border-red-900/20"
                  >
                    Force Clear
                  </button>
                )}
              </div>
            ))}
            <button className="bg-gray-50 dark:bg-gray-800/50 p-6 rounded-[2.5rem] border-2 border-dashed border-gray-200 dark:border-gray-700 flex flex-col items-center justify-center text-gray-400 hover:text-blue-600 hover:border-blue-600 transition-all group">
              <Plus className="w-8 h-8 mb-2 group-hover:scale-110 transition-transform" />
              <span className="text-xs font-black uppercase tracking-widest">Add Machine</span>
            </button>
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
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div>
                <h2 className="text-2xl font-black text-gray-800 dark:text-gray-100 uppercase tracking-tight">Machine Availability Management</h2>
                <p className="text-gray-500 dark:text-gray-400 font-medium">View and manually clear booked slots for machines.</p>
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

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[1, 2, 3, 4].map((num) => {
                const machineNum = num.toString();
                const bookedUserId = currentSlotData?.machines[machineNum];
                const bookedUser = users.find(u => u.uid === bookedUserId);
                
                return (
                  <div key={machineNum} className="bg-white dark:bg-gray-900 p-8 rounded-[3rem] border border-gray-100 dark:border-gray-800 shadow-sm flex flex-col items-center text-center relative overflow-hidden group">
                    <div className={`w-20 h-20 rounded-[2rem] flex items-center justify-center mb-6 transition-all duration-500 ${
                      bookedUserId ? (bookedUserId === 'unavailable' ? 'bg-red-50 text-red-600 dark:bg-red-900/20' : 'bg-blue-50 text-blue-600 dark:bg-blue-900/20') : 'bg-green-50 text-green-600 dark:bg-green-900/20'
                    }`}>
                      <Monitor className="w-10 h-10" />
                    </div>
                    
                    <h3 className="text-xl font-black text-gray-800 dark:text-gray-100 mb-1">Machine #{machineNum}</h3>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-6">Standard Washer</p>
                    
                    {bookedUserId ? (
                      <div className="space-y-4 w-full">
                        <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-gray-100 dark:border-gray-800">
                          {bookedUserId === 'unavailable' ? (
                            <div className="flex flex-col items-center py-2">
                              <Ban className="w-6 h-6 text-red-500 mb-2" />
                              <p className="text-[10px] font-black text-red-600 uppercase tracking-widest">Marked Unavailable</p>
                            </div>
                          ) : (
                            <>
                              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Booked By</p>
                              <p className="text-sm font-bold text-gray-800 dark:text-gray-100 truncate">{bookedUser?.name || 'Unknown User'}</p>
                              <p className="text-[10px] font-mono text-gray-500 truncate">{bookedUserId}</p>
                            </>
                          )}
                        </div>
                        
                        <button
                          onClick={() => bookedUserId === 'unavailable' ? handleToggleSlotMachineAvailability(machineNum, false) : handleClearSlot(machineNum)}
                          disabled={isClearingSlot}
                          className={`w-full py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all border flex items-center justify-center gap-2 ${
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
                        <div className="py-2">
                          <span className="px-4 py-2 bg-green-100 text-green-700 text-[10px] font-black uppercase tracking-widest rounded-full">
                            Available
                          </span>
                        </div>
                        <button
                          onClick={() => handleToggleSlotMachineAvailability(machineNum, true)}
                          disabled={isClearingSlot}
                          className="w-full py-3 bg-gray-50 text-gray-600 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-gray-800 hover:text-white transition-all border border-gray-100 dark:border-gray-800 flex items-center justify-center gap-2"
                        >
                          {isClearingSlot ? <Loader2 className="w-3 h-3 animate-spin" /> : <Ban className="w-3 h-3" />}
                          Mark Unavailable
                        </button>
                      </div>
                    )}

                    {/* Decorative background element */}
                    <div className={`absolute -right-4 -bottom-4 w-24 h-24 rounded-full blur-3xl opacity-10 transition-all duration-500 ${
                      bookedUserId ? (bookedUserId === 'unavailable' ? 'bg-red-600' : 'bg-blue-600') : 'bg-green-600'
                    }`} />
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default StoreManagerDashboard;
