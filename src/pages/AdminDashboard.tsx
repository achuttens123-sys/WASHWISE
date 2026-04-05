import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  Search, 
  Filter, 
  Calendar, 
  Clock, 
  User, 
  CheckCircle2, 
  Clock3, 
  AlertCircle,
  Loader2,
  ChevronRight,
  Download,
  MoreVertical,
  MapPin,
  Plus,
  Trash2,
  Edit2,
  ToggleLeft,
  ToggleRight,
  ShieldAlert,
  ShieldCheck,
  Ban
} from 'lucide-react';
import { collection, query, orderBy, onSnapshot, updateDoc, doc, getDoc, runTransaction, where, limit, addDoc, deleteDoc, setDoc, getDocs } from 'firebase/firestore';
import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { db, handleFirestoreError, OperationType, firebaseConfig } from '../firebase';
import { Booking, TIME_SLOTS, Slot, AdminRole, User as AppUser } from '../types';
import { useSettings } from '../context/SettingsContext';
import { format, addDays } from 'date-fns';
import { sendNotification } from '../services/NotificationService';
import { StoreService, Store } from '../services/StoreService';
import { useAuth } from '../context/AuthContext';

import { Notification } from '../services/NotificationService';
import LoadingScreen from '../components/LoadingScreen';

// Initialize secondary app for user creation
const secondaryApp = initializeApp(firebaseConfig, 'Secondary');
const secondaryAuth = getAuth(secondaryApp);

const AdminDashboard: React.FC = () => {
  const { user: currentUser, isSuperAdmin, isStoreManager, isAdmin } = useAuth();
  const { settings } = useSettings();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [adminRoles, setAdminRoles] = useState<{ email: string; role: AdminRole }[]>([]);
  const [activeTab, setActiveTab] = useState<'bookings' | 'notifications' | 'stores' | 'team' | 'users'>('bookings');
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [userFormData, setUserFormData] = useState<Partial<AppUser>>({
    name: '',
    email: '',
    userType: 'guest',
    studentId: '',
    package: 'basic',
    points: 0
  });
  const [userPassword, setUserPassword] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [rejectionModal, setRejectionModal] = useState(false);
  const [rescheduleModal, setRescheduleModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [newDate, setNewDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [newSlot, setNewSlot] = useState(TIME_SLOTS[0]);
  const [processing, setProcessing] = useState(false);

  // Team Management State
  const [isTeamModalOpen, setIsTeamModalOpen] = useState(false);
  const [teamEmail, setTeamEmail] = useState('');
  const [teamRole, setTeamRole] = useState<AdminRole>('store_manager');
  const [teamStoreId, setTeamStoreId] = useState('');

  // Store Management State
  const [isStoreModalOpen, setIsStoreModalOpen] = useState(false);
  const [editingStore, setEditingStore] = useState<Store | null>(null);
  const [storeFormData, setStoreFormData] = useState<Partial<Store>>({
    name: '',
    address: '',
    latitude: 9.575086702360185,
    longitude: 76.62057146585084,
    isActive: true
  });

  useEffect(() => {
    if (!isAdmin) return;
    const q = isSuperAdmin 
      ? query(collection(db, 'bookings'), orderBy('createdAt', 'desc'))
      : query(collection(db, 'bookings'), where('storeId', '==', currentUser?.storeId || ''), orderBy('createdAt', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const bookingsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Booking[];
      setBookings(bookingsData);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'bookings');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;
    const q = query(collection(db, 'notifications'), orderBy('createdAt', 'desc'), limit(50));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notifs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];
      setNotifications(notifs);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'notifications');
    });
    return () => unsubscribe();
  }, [isAdmin]);

  useEffect(() => {
    if (!isSuperAdmin && !isStoreManager) return;
    const unsubscribe = StoreService.getAllStores((storesData) => {
      setStores(storesData);
    });
    return () => unsubscribe();
  }, [isSuperAdmin, isStoreManager]);

  useEffect(() => {
    if (!isSuperAdmin) return;
    const q = query(collection(db, 'admin_roles'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const roles = snapshot.docs.map(doc => ({ email: doc.id, role: doc.data().role })) as any[];
      setAdminRoles(roles);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'admin_roles');
    });
    return () => unsubscribe();
  }, [isSuperAdmin]);

  useEffect(() => {
    // Set initial active tab based on permissions
    if (isSuperAdmin) {
      setActiveTab('bookings');
    } else if (isStoreManager) {
      setActiveTab('stores');
    }
  }, [isAdmin, isStoreManager]);

  const handleAddTeamMember = async () => {
    if (!teamEmail || !teamRole) return;
    setProcessing(true);
    try {
      // 1. Add to admin_roles for email-based lookup
      await setDoc(doc(db, 'admin_roles', teamEmail.toLowerCase()), {
        role: teamRole,
        storeId: teamStoreId || null,
        addedAt: new Date().toISOString(),
        addedBy: currentUser?.email
      });

      // 2. If user exists, update their document directly
      const userQuery = query(collection(db, 'users'), where('email', '==', teamEmail.toLowerCase()));
      const userSnap = await getDocs(userQuery);
      if (!userSnap.empty) {
        const userDoc = userSnap.docs[0];
        await updateDoc(doc(db, 'users', userDoc.id), {
          role: 'admin',
          adminRole: teamRole,
          storeId: teamStoreId || null
        });
      }

      setIsTeamModalOpen(false);
      setTeamEmail('');
      setTeamStoreId('');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `admin_roles/${teamEmail}`);
    } finally {
      setProcessing(false);
    }
  };

  const handleRemoveTeamMember = async (email: string) => {
    if (!confirm(`Are you sure you want to remove ${email} from the team?`)) return;
    try {
      await deleteDoc(doc(db, 'admin_roles', email));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `admin_roles/${email}`);
    }
  };

  const handleSaveStore = async () => {
    if (!storeFormData.name || !storeFormData.address) return;
    setProcessing(true);
    try {
      if (editingStore?.id) {
        await StoreService.updateStore(editingStore.id, storeFormData);
      } else {
        await StoreService.addStore(storeFormData as Omit<Store, 'id'>);
      }
      setIsStoreModalOpen(false);
      setEditingStore(null);
      setStoreFormData({
        name: '',
        address: '',
        latitude: 9.575086702360185,
        longitude: 76.62057146585084,
        isActive: true
      });
    } catch (error) {
      console.error(error);
    } finally {
      setProcessing(false);
    }
  };

  const handleDeleteStore = async (id: string) => {
    if (!confirm('Are you sure you want to delete this store?')) return;
    try {
      await StoreService.deleteStore(id);
    } catch (error) {
      console.error(error);
    }
  };

  const toggleStoreStatus = async (store: Store) => {
    try {
      await StoreService.updateStore(store.id, { isActive: !store.isActive });
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    if (!isSuperAdmin) return;
    const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const usersData = snapshot.docs.map(doc => ({ ...doc.data() })) as AppUser[];
      setUsers(usersData);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'users');
    });
    return () => unsubscribe();
  }, [isSuperAdmin]);

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userFormData.email || !userFormData.name || !userPassword) return;

    try {
      // 1. Create in Firebase Auth using secondary app
      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, userFormData.email, userPassword);
      const uid = userCredential.user.uid;

      // 2. Create Firestore document
      const newUser: AppUser = {
        uid,
        name: userFormData.name!,
        email: userFormData.email!,
        userType: userFormData.userType || 'guest',
        studentId: userFormData.studentId || '',
        package: userFormData.package || 'basic',
        points: userFormData.points || 0,
        isRegistered: true,
        createdAt: new Date().toISOString(),
        subscriptionPaid: false
      };

      await setDoc(doc(db, 'users', uid), newUser);
      
      setIsUserModalOpen(false);
      setUserFormData({
        name: '',
        email: '',
        userType: 'guest',
        studentId: '',
        package: 'basic',
        points: 0
      });
      setUserPassword('');
    } catch (error: any) {
      console.error('Error adding user:', error);
      alert('Error adding user: ' + error.message);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!window.confirm('Are you sure you want to delete this user? This will remove their data from the database.')) return;

    try {
      await deleteDoc(doc(db, 'users', userId));
    } catch (error: any) {
      console.error('Error deleting user:', error);
      alert('Error deleting user: ' + error.message);
    }
  };

  const handleToggleSuspension = async (userId: string, currentStatus: boolean) => {
    try {
      await updateDoc(doc(db, 'users', userId), {
        isSuspended: !currentStatus
      });
    } catch (error: any) {
      console.error('Error toggling suspension:', error);
      alert('Error toggling suspension: ' + error.message);
    }
  };

  const filteredBookings = bookings.filter(booking => {
    const matchesSearch = 
      booking.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      booking.id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      booking.userId.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || booking.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const updateBookingStatus = async (bookingId: string, newStatus: Booking['status']) => {
    try {
      const bookingRef = doc(db, 'bookings', bookingId);
      
      await runTransaction(db, async (transaction) => {
        // 1. ALL READS FIRST
        const bookingSnap = await transaction.get(bookingRef);
        if (!bookingSnap.exists()) throw new Error('Booking not found.');
        const bookingData = bookingSnap.data() as Booking;

        const userRef = doc(db, 'users', bookingData.userId);
        const userSnap = await transaction.get(userRef);

        // 2. ALL WRITES LAST
        // Update booking status
        transaction.update(bookingRef, { status: newStatus });

        // If status is 'completed', add points to user
        if (newStatus === 'completed' && bookingData.status !== 'completed') {
          if (userSnap.exists()) {
            const currentPoints = userSnap.data().points || 0;
            const pointsToAdd = bookingData.pointsEarned || 0;
            transaction.update(userRef, { points: currentPoints + pointsToAdd });
          }
        }
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `bookings/${bookingId}`);
    }
  };

  const handleReject = async () => {
    if (!selectedBooking || !rejectionReason) return;
    setProcessing(true);
    try {
      await runTransaction(db, async (transaction) => {
        // 1. ALL READS FIRST
        const slotId = `${selectedBooking.date}_${selectedBooking.timeSlot}`;
        const slotRef = doc(db, 'slots', slotId);
        const slotSnap = await transaction.get(slotRef);

        const userRef = doc(db, 'users', selectedBooking.userId);
        const userSnap = await transaction.get(userRef);

        // 2. ALL WRITES LAST
        // Update booking status
        transaction.update(doc(db, 'bookings', selectedBooking.id!), {
          status: 'rejected',
          rejectionReason: rejectionReason
        });

        // Free up the machine in the slots collection
        if (slotSnap.exists()) {
          const machines = slotSnap.data().machines;
          machines[selectedBooking.machineNumber.toString()] = '';
          transaction.update(slotRef, { machines });
        }

        // Reverse points
        if (userSnap.exists()) {
          const userData = userSnap.data();
          let currentPoints = userData.points || 0;
          
          // If points were earned, deduct them
          if (selectedBooking.pointsEarned) {
            currentPoints -= selectedBooking.pointsEarned;
          }
          // If points were redeemed, refund them
          if (selectedBooking.pointsRedeemed) {
            currentPoints += selectedBooking.pointsRedeemed;
          }
          
          transaction.update(userRef, { points: Math.max(0, currentPoints) });
        }
      });

      // 4. Notify user
      // We need to fetch the user's email. For now we assume we have it or can get it.
      // In a real app, we'd have a users collection.
      const userSnap = await getDoc(doc(db, 'users', selectedBooking.userId));
      const userEmail = userSnap.exists() ? userSnap.data().email : 'user@example.com';

      await sendNotification(selectedBooking.userId, userEmail, selectedBooking.phone || '', 'booking_rejected', selectedBooking.id!, {
        reason: rejectionReason
      });

      setRejectionModal(false);
      setRejectionReason('');
      setSelectedBooking(null);
    } catch (error) {
      console.error(error);
    } finally {
      setProcessing(false);
    }
  };

  const handleReschedule = async () => {
    if (!selectedBooking || !newDate || !newSlot) return;
    setProcessing(true);
    try {
      const oldSlotInfo = `${selectedBooking.date} at ${selectedBooking.timeSlot}`;
      const newSlotInfo = `${newDate} at ${newSlot}`;

      await runTransaction(db, async (transaction) => {
        // 1. Free up old machine
        const oldSlotId = `${selectedBooking.date}_${selectedBooking.timeSlot}`;
        const oldSlotRef = doc(db, 'slots', oldSlotId);
        const oldSlotSnap = await transaction.get(oldSlotRef);
        if (oldSlotSnap.exists()) {
          const machines = oldSlotSnap.data().machines;
          machines[selectedBooking.machineNumber.toString()] = '';
          transaction.update(oldSlotRef, { machines });
        }

        // 2. Find machine in new slot
        const newSlotId = `${newDate}_${newSlot}`;
        const newSlotRef = doc(db, 'slots', newSlotId);
        const newSlotSnap = await transaction.get(newSlotRef);
        
        let newSlotData: Slot = newSlotSnap.exists() 
          ? newSlotSnap.data() as Slot 
          : { date: newDate, timeSlot: newSlot, machines: { '1': '', '2': '', '3': '', '4': '' } };

        let assignedMachine = -1;
        for (let i = 1; i <= 4; i++) {
          if (!newSlotData.machines[i.toString()]) {
            assignedMachine = i;
            break;
          }
        }

        if (assignedMachine === -1) throw new Error('New slot is full.');

        const updatedMachines = { ...newSlotData.machines, [assignedMachine.toString()]: selectedBooking.userId };
        if (!newSlotSnap.exists()) {
          transaction.set(newSlotRef, { ...newSlotData, machines: updatedMachines });
        } else {
          transaction.update(newSlotRef, { machines: updatedMachines });
        }

        // 3. Update booking
        transaction.update(doc(db, 'bookings', selectedBooking.id!), {
          date: newDate,
          timeSlot: newSlot,
          machineNumber: assignedMachine,
          status: 'rescheduled',
          rejectionReason: `Rescheduled from ${oldSlotInfo}`
        });
      });

      // 4. Notify user
      const userSnap = await getDoc(doc(db, 'users', selectedBooking.userId));
      const userEmail = userSnap.exists() ? userSnap.data().email : 'user@example.com';

      await sendNotification(selectedBooking.userId, userEmail, selectedBooking.phone || '', 'booking_rescheduled', selectedBooking.id!, {
        oldSlot: oldSlotInfo,
        newSlot: newSlotInfo,
        reason: 'Administrative reschedule'
      });

      setRescheduleModal(false);
      setSelectedBooking(null);
    } catch (error: any) {
      alert(error.message || 'Reschedule failed');
    } finally {
      setProcessing(false);
    }
  };

  const stats = {
    total: bookings.length,
    pending: bookings.filter(b => b.status === 'pending').length,
    paid: bookings.filter(b => !['pending', 'completed', 'rejected', 'rescheduled'].includes(b.status)).length,
    completed: bookings.filter(b => b.status === 'completed').length,
    revenue: bookings.reduce((acc, b) => acc + b.price, 0)
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-gray-800 dark:text-gray-100 tracking-tight uppercase">ADMIN DASHBOARD</h1>
          <p className="text-gray-500 dark:text-gray-400 font-medium">
            <span className="text-blue-600 dark:text-blue-400 font-bold uppercase tracking-wider text-xs mr-2">
              {isSuperAdmin ? 'Super Admin' : isStoreManager ? 'Store Manager' : 'Administrator'}
            </span>
            • Manage all laundry bookings and machine assignments.
          </p>
        </div>
        <button className="flex items-center px-4 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl text-sm font-bold text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all shadow-sm">
          <Download className="w-4 h-4 mr-2" />
          Export Report
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Bookings', value: stats.total, color: 'blue' },
          { label: 'Pending', value: stats.pending, color: 'yellow' },
          { label: 'Active/Paid', value: stats.paid, color: 'green' },
          { label: 'Total Revenue', value: `₹${stats.revenue}`, color: 'indigo' }
        ].map((stat, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            whileHover={{ y: -5, transition: { duration: 0.2 } }}
            className="bg-white dark:bg-gray-900 p-6 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm"
          >
            <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">{stat.label}</p>
            <p className={`text-2xl font-black text-${stat.color}-600 dark:text-${stat.color}-400 tracking-tight`}>{stat.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex space-x-4 border-b border-gray-100 dark:border-gray-800">
        {isAdmin && (
          <button
            onClick={() => setActiveTab('bookings')}
            className={`pb-4 px-2 text-sm font-bold transition-all relative ${
              activeTab === 'bookings' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'
            }`}
          >
            Bookings
            {activeTab === 'bookings' && (
              <motion.div
                layoutId="activeTab"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 dark:bg-blue-400"
              />
            )}
          </button>
        )}
        {isAdmin && (
          <button
            onClick={() => setActiveTab('notifications')}
            className={`pb-4 px-2 text-sm font-bold transition-all relative ${
              activeTab === 'notifications' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'
            }`}
          >
            Notifications
            {activeTab === 'notifications' && (
              <motion.div
                layoutId="activeTab"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 dark:bg-blue-400"
              />
            )}
          </button>
        )}
        {(isSuperAdmin || isStoreManager) && (
          <button
            onClick={() => setActiveTab('stores')}
            className={`pb-4 px-2 text-sm font-bold transition-all relative ${
              activeTab === 'stores' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'
            }`}
          >
            Stores
            {activeTab === 'stores' && (
              <motion.div
                layoutId="activeTab"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 dark:bg-blue-400"
              />
            )}
          </button>
        )}
        {isSuperAdmin && (
          <button
            onClick={() => setActiveTab('users')}
            className={`pb-4 px-2 text-sm font-bold transition-all relative ${
              activeTab === 'users' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'
            }`}
          >
            Users
            {activeTab === 'users' && (
              <motion.div
                layoutId="activeTab"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 dark:bg-blue-400"
              />
            )}
          </button>
        )}
        {isSuperAdmin && (
          <button
            onClick={() => setActiveTab('team')}
            className={`pb-4 px-2 text-sm font-bold transition-all relative ${
              activeTab === 'team' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'
            }`}
          >
            Team
            {activeTab === 'team' && (
              <motion.div
                layoutId="activeTab"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 dark:bg-blue-400"
              />
            )}
          </button>
        )}
      </div>

      {activeTab === 'bookings' ? (
        <>
          {/* Filters & Search */}
          <div className="bg-white dark:bg-gray-900 p-4 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name, ID or user..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-gray-100"
          />
        </div>
        <div className="flex gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl font-bold text-gray-600 dark:text-gray-400 outline-none focus:ring-2 focus:ring-blue-500 transition-all"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="paid">Paid</option>
            <option value="In Wash">In Wash</option>
            <option value="In Drier">In Drier</option>
            <option value="Ready to collect">Ready to collect</option>
            <option value="Ready to deliver">Ready to deliver</option>
            <option value="Ready for pick up">Ready for pick up</option>
            <option value="completed">Completed</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
      </div>

      {/* Bookings Table */}
      <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700">
                <th className="px-6 py-4 text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Booking ID</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Customer</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Schedule</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Machine</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Service</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto" />
                    <p className="mt-2 text-gray-500 dark:text-gray-400 font-medium tracking-tight">Loading bookings...</p>
                    <p className="mt-4 text-[10px] text-gray-400 dark:text-gray-600 italic max-w-xs mx-auto">
                      "We take utmost care in handling your garments and aim to provide a reliable, hygienic, and efficient laundry experience."
                    </p>
                  </td>
                </tr>
              ) : filteredBookings.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <AlertCircle className="w-8 h-8 text-gray-300 dark:text-gray-700 mx-auto" />
                    <p className="mt-2 text-gray-500 dark:text-gray-400 font-medium">No bookings found matching your criteria.</p>
                  </td>
                </tr>
              ) : (
                filteredBookings.map((booking, index) => (
                  <motion.tr 
                    key={booking.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.03 }}
                    className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <span className="text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded-lg">
                        {booking.id?.slice(-6).toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <div className="w-8 h-8 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mr-3">
                          <User className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-gray-800 dark:text-gray-200">{booking.userName}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-500">{booking.userId.slice(0, 8)}...</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        <div className="flex items-center text-xs font-medium text-gray-600 dark:text-gray-400">
                          <Calendar className="w-3 h-3 mr-1" />
                          {booking.date}
                        </div>
                        <div className="flex items-center text-xs font-medium text-gray-600 dark:text-gray-400">
                          <Clock className="w-3 h-3 mr-1" />
                          {booking.timeSlot}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-bold text-gray-700 dark:text-gray-300">M#{booking.machineNumber}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{booking.serviceType}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-500">{booking.approxLoad}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <select
                        value={booking.status}
                        onChange={(e) => updateBookingStatus(booking.id!, e.target.value as any)}
                        className={`px-2 py-1 rounded-full text-xs font-bold outline-none border-none cursor-pointer ${
                          booking.status === 'completed' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' :
                          booking.status === 'paid' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' :
                          booking.status === 'rejected' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' :
                          booking.status === 'pending' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400' :
                          'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400'
                        }`}
                      >
                        <option value="pending">PENDING</option>
                        <option value="paid">PAID</option>
                        <option value="In Wash">IN WASH</option>
                        <option value="In Drier">IN DRIER</option>
                        <option value="Ready to collect">READY TO COLLECT</option>
                        <option value="Ready to deliver">READY TO DELIVER</option>
                        <option value="Ready for pick up">READY FOR PICK UP</option>
                        <option value="Washing completed">WASHING COMPLETED</option>
                        <option value="Out for delivery">OUT FOR DELIVERY</option>
                        <option value="completed">COMPLETED</option>
                        <option value="rejected">REJECTED</option>
                        <option value="rescheduled">RESCHEDULED</option>
                      </select>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {!['completed', 'rejected', 'rescheduled'].includes(booking.status) && (
                          <>
                            <motion.button
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                              onClick={() => updateBookingStatus(booking.id!, 'completed')}
                              className="p-2 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors"
                              title="Mark as Completed"
                            >
                              <CheckCircle2 className="w-5 h-5" />
                            </motion.button>
                            <motion.button
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                              onClick={() => { setSelectedBooking(booking); setRejectionModal(true); }}
                              className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                              title="Reject Booking"
                            >
                              <AlertCircle className="w-5 h-5" />
                            </motion.button>
                            <motion.button
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                              onClick={() => { setSelectedBooking(booking); setRescheduleModal(true); }}
                              className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                              title="Reschedule Booking"
                            >
                              <Clock3 className="w-5 h-5" />
                            </motion.button>
                          </>
                        )}
                        <button className="p-2 text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors">
                          <ChevronRight className="w-5 h-5" />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
        </>
      ) : activeTab === 'notifications' ? (
        <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-gray-50 dark:border-gray-800 flex items-center justify-between">
            <h3 className="text-lg font-black text-gray-800 dark:text-gray-100 uppercase tracking-tight">Sent Notifications</h3>
            <span className="px-3 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-xs font-bold rounded-full uppercase tracking-wider">
              Last 50 messages
            </span>
          </div>
          <div className="divide-y divide-gray-50 dark:divide-gray-800">
            {notifications.length === 0 ? (
              <div className="p-12 text-center">
                <AlertCircle className="w-8 h-8 text-gray-300 dark:text-gray-700 mx-auto" />
                <p className="mt-2 text-gray-500 dark:text-gray-400 font-medium">No notifications sent yet.</p>
              </div>
            ) : (
              notifications.map((notif) => (
                <div key={notif.id} className="p-6 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          notif.type === 'booking_confirmed' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' :
                          notif.type === 'booking_rejected' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' :
                          'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                        }`}>
                          {notif.type.replace('_', ' ')}
                        </span>
                        <span className="text-xs font-bold text-gray-400 dark:text-gray-500">
                          {notif.createdAt?.toDate ? format(notif.createdAt.toDate(), 'MMM d, h:mm a') : 'Just now'}
                        </span>
                      </div>
                      <h4 className="font-bold text-gray-800 dark:text-gray-200 mb-1">{notif.title}</h4>
                      <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{notif.message}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">Recipient</p>
                      <p className="text-sm font-bold text-gray-700 dark:text-gray-300">{notif.email}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      ) : activeTab === 'team' ? (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-xl font-black text-gray-800 dark:text-gray-100 uppercase tracking-tight">Team Management</h3>
            <button 
              onClick={() => setIsTeamModalOpen(true)}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 dark:shadow-none"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Team Member
            </button>
          </div>

          <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700">
                    <th className="px-6 py-4 text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Email Address</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Role</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                  {adminRoles.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400 font-medium">
                        No team members added yet.
                      </td>
                    </tr>
                  ) : (
                    adminRoles.map((member) => (
                      <tr key={member.email} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                        <td className="px-6 py-4">
                          <span className="text-sm font-bold text-gray-800 dark:text-gray-200">{member.email}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest ${
                            member.role === 'super_admin' ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400' :
                            member.role === 'store_manager' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' :
                            member.role === 'store_staff' ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400' :
                            member.role === 'delivery_staff' ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400' :
                            'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                          }`}>
                            {member.role.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <button 
                            onClick={() => handleRemoveTeamMember(member.email)}
                            disabled={member.email === 'ashwinchuttipara@gmail.com'}
                            className="p-2 text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : activeTab === 'users' ? (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-xl font-black text-gray-800 dark:text-gray-100 uppercase tracking-tight">User Management</h3>
            <button 
              onClick={() => setIsUserModalOpen(true)}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 dark:shadow-none"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add New User
            </button>
          </div>

          <div className="bg-white dark:bg-gray-900 p-4 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm">
            <div className="relative mb-6">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by email or user ID..."
                value={userSearchTerm}
                onChange={(e) => setUserSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-gray-100"
              />
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left border-b border-gray-50 dark:border-gray-800">
                    <th className="px-6 py-4 text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">User</th>
                    <th className="px-6 py-4 text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">Type</th>
                    <th className="px-6 py-4 text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">Details</th>
                    <th className="px-6 py-4 text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                  {users.filter(u => 
                    u.email.toLowerCase().includes(userSearchTerm.toLowerCase()) || 
                    u.uid.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
                    u.name.toLowerCase().includes(userSearchTerm.toLowerCase())
                  ).map((u) => (
                    <tr key={u.uid} className="group hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-all">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                            <User className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                          </div>
                          <div>
                            <p className="font-black text-gray-800 dark:text-gray-100 uppercase tracking-tight">{u.name}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">{u.email}</p>
                            <p className="text-[10px] text-gray-400 dark:text-gray-500 font-mono mt-0.5">ID: {u.uid}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest ${
                          u.userType === 'subscriber' ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                        }`}>
                          {u.userType}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-xs space-y-1">
                          {u.userType === 'subscriber' && (
                            <>
                              <p className="text-gray-600 dark:text-gray-400 font-bold uppercase tracking-tight">Package: {u.package}</p>
                              <p className="text-gray-500 dark:text-gray-500">ID: {u.studentId}</p>
                              <p className={`font-black ${u.subscriptionPaid ? 'text-green-600' : 'text-red-600'}`}>
                                {u.subscriptionPaid ? 'PAID' : 'UNPAID'}
                              </p>
                            </>
                          )}
                          <p className="text-gray-400 dark:text-gray-500">Points: {u.points || 0}</p>
                          {u.isSuspended && (
                            <p className="text-red-600 font-black uppercase tracking-widest text-[10px] flex items-center gap-1">
                              <ShieldAlert className="w-3 h-3" /> Suspended
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex gap-2">
                          <button 
                            onClick={() => handleToggleSuspension(u.uid, !!u.isSuspended)}
                            disabled={u.email === 'ashwinchuttipara@gmail.com'}
                            title={u.isSuspended ? 'Unsuspend User' : 'Suspend User'}
                            className={`p-2 rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed ${
                              u.isSuspended 
                                ? 'text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20' 
                                : 'text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/20'
                            }`}
                          >
                            {u.isSuspended ? <ShieldCheck className="w-5 h-5" /> : <Ban className="w-5 h-5" />}
                          </button>
                          <button 
                            onClick={() => handleDeleteUser(u.uid)}
                            disabled={u.email === 'ashwinchuttipara@gmail.com'}
                            title="Delete User"
                            className="p-2 text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-xl font-black text-gray-800 dark:text-gray-100 uppercase tracking-tight">Manage Store Locations</h3>
            <button 
              onClick={() => {
                setEditingStore(null);
                setStoreFormData({
                  name: '',
                  address: '',
                  latitude: 9.575086702360185,
                  longitude: 76.62057146585084,
                  isActive: true
                });
                setIsStoreModalOpen(true);
              }}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 dark:shadow-none"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add New Store
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {stores.map((store) => (
              <motion.div
                key={store.id}
                layout
                className="bg-white dark:bg-gray-900 p-6 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm relative group"
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-2xl">
                    <MapPin className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => {
                        setEditingStore(store);
                        setStoreFormData(store);
                        setIsStoreModalOpen(true);
                      }}
                      className="p-2 text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-all"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => handleDeleteStore(store.id)}
                      className="p-2 text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                
                <h4 className="text-lg font-black text-gray-800 dark:text-gray-100 mb-1 uppercase tracking-tight">{store.name}</h4>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 line-clamp-2">{store.address}</p>
                
                <div className="flex items-center justify-between pt-4 border-t border-gray-50 dark:border-gray-800">
                  <div className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                    {store.latitude.toFixed(4)}, {store.longitude.toFixed(4)}
                  </div>
                  <button 
                    onClick={() => toggleStoreStatus(store)}
                    className={`flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${
                      store.isActive 
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' 
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
                    }`}
                  >
                    {store.isActive ? (
                      <><ToggleRight className="w-4 h-4" /> Active</>
                    ) : (
                      <><ToggleLeft className="w-4 h-4" /> Inactive</>
                    )}
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* User Modal */}
      {isUserModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-gray-900 rounded-3xl p-8 max-w-md w-full shadow-2xl border border-gray-100 dark:border-gray-800"
          >
            <h2 className="text-2xl font-black text-gray-800 dark:text-gray-100 mb-2 uppercase tracking-tight">Add New User</h2>
            <p className="text-gray-500 dark:text-gray-400 mb-6 font-medium">Create a new user account manually.</p>
            
            <form onSubmit={handleAddUser} className="space-y-4 mb-8">
              <div>
                <label className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1 block">Full Name</label>
                <input
                  type="text"
                  required
                  value={userFormData.name}
                  onChange={(e) => setUserFormData({ ...userFormData, name: e.target.value })}
                  placeholder="John Doe"
                  className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 dark:text-gray-100"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1 block">Email Address</label>
                <input
                  type="email"
                  required
                  value={userFormData.email}
                  onChange={(e) => setUserFormData({ ...userFormData, email: e.target.value })}
                  placeholder="user@example.com"
                  className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 dark:text-gray-100"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1 block">Password</label>
                <input
                  type="password"
                  required
                  value={userPassword}
                  onChange={(e) => setUserPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 dark:text-gray-100"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1 block">User Type</label>
                <select
                  value={userFormData.userType}
                  onChange={(e) => setUserFormData({ ...userFormData, userType: e.target.value as any })}
                  className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-bold text-gray-700 dark:text-gray-300"
                >
                  <option value="guest">Guest</option>
                  <option value="subscriber">Subscriber</option>
                </select>
              </div>

              {userFormData.userType === 'subscriber' && (
                <>
                  <div>
                    <label className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1 block">Student ID</label>
                    <input
                      type="text"
                      required
                      value={userFormData.studentId}
                      onChange={(e) => setUserFormData({ ...userFormData, studentId: e.target.value })}
                      placeholder="STU12345"
                      className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 dark:text-gray-100"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1 block">Package</label>
                    <select
                      value={userFormData.package}
                      onChange={(e) => setUserFormData({ ...userFormData, package: e.target.value as any })}
                      className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-bold text-gray-700 dark:text-gray-300"
                    >
                      {(settings?.subscriptionPlans || []).map((pkg) => (
                        <option key={pkg.id} value={pkg.id}>{pkg.name} (₹{pkg.price})</option>
                      ))}
                    </select>
                  </div>
                </>
              )}
              
              <div className="flex gap-4 pt-4">
                <button
                  type="button"
                  onClick={() => setIsUserModalOpen(false)}
                  className="flex-1 py-3 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 font-bold rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={processing}
                  className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 dark:shadow-none flex items-center justify-center"
                >
                  {processing ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Create User'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Rejection Modal */}
      {rejectionModal && selectedBooking && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-gray-900 rounded-3xl p-8 max-w-md w-full shadow-2xl border border-gray-100 dark:border-gray-800"
          >
            <h2 className="text-2xl font-black text-gray-800 dark:text-gray-100 mb-2 uppercase tracking-tight">Reject Booking</h2>
            <p className="text-gray-500 dark:text-gray-400 mb-6 font-medium">Please provide a reason for rejecting this booking.</p>
            
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="e.g., Machine maintenance, scheduling conflict..."
              className="w-full p-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl h-32 outline-none focus:ring-2 focus:ring-red-500 transition-all mb-6 dark:text-gray-100"
            />
            
            <div className="flex gap-4">
              <button
                onClick={() => setRejectionModal(false)}
                className="flex-1 py-3 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 font-bold rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={processing || !rejectionReason}
                className="flex-1 py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-all shadow-lg shadow-red-200 dark:shadow-none flex items-center justify-center"
              >
                {processing ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Confirm Reject'}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Reschedule Modal */}
      {rescheduleModal && selectedBooking && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-gray-900 rounded-3xl p-8 max-w-md w-full shadow-2xl border border-gray-100 dark:border-gray-800"
          >
            <h2 className="text-2xl font-black text-gray-800 dark:text-gray-100 mb-2 uppercase tracking-tight">Reschedule Booking</h2>
            <p className="text-gray-500 dark:text-gray-400 mb-6 font-medium text-sm">Move booking for {selectedBooking.userName} to a new slot.</p>
            
            <div className="space-y-4 mb-8">
              <div>
                <label className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1 block">New Date</label>
                <input
                  type="date"
                  value={newDate}
                  min={format(new Date(), 'yyyy-MM-dd')}
                  onChange={(e) => setNewDate(e.target.value)}
                  className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 dark:text-gray-100"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1 block">New Time Slot</label>
                <select
                  value={newSlot}
                  onChange={(e) => setNewSlot(e.target.value)}
                  className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-bold text-gray-700 dark:text-gray-300"
                >
                  {TIME_SLOTS.map(slot => (
                    <option key={slot} value={slot}>{slot}</option>
                  ))}
                </select>
              </div>
            </div>
            
            <div className="flex gap-4">
              <button
                onClick={() => setRescheduleModal(false)}
                className="flex-1 py-3 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 font-bold rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleReschedule}
                disabled={processing}
                className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 dark:shadow-none flex items-center justify-center"
              >
                {processing ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Confirm Move'}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Team Modal */}
      {isTeamModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-gray-900 rounded-3xl p-8 max-w-md w-full shadow-2xl border border-gray-100 dark:border-gray-800"
          >
            <h2 className="text-2xl font-black text-gray-800 dark:text-gray-100 mb-2 uppercase tracking-tight">Add Team Member</h2>
            <p className="text-gray-500 dark:text-gray-400 mb-6 font-medium">Grant administrative access to a user by email.</p>
            
            <div className="space-y-4 mb-8">
              <div>
                <label className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1 block">Email Address</label>
                <input
                  type="email"
                  value={teamEmail}
                  onChange={(e) => setTeamEmail(e.target.value)}
                  placeholder="user@example.com"
                  className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 dark:text-gray-100"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1 block">Assigned Role</label>
                <select
                  value={teamRole}
                  onChange={(e) => setTeamRole(e.target.value as AdminRole)}
                  className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-bold text-gray-700 dark:text-gray-300"
                >
                  <option value="super_admin">Super Admin</option>
                  <option value="store_manager">Store Manager</option>
                  <option value="store_staff">Store Staff</option>
                  <option value="delivery_staff">Delivery Staff</option>
                </select>
              </div>

              {teamRole !== 'super_admin' && (
                <div>
                  <label className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1 block">Assign to Store</label>
                  <select
                    value={teamStoreId}
                    onChange={(e) => setTeamStoreId(e.target.value)}
                    className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-bold text-gray-700 dark:text-gray-300"
                  >
                    <option value="">Select a Store</option>
                    {stores.map(store => (
                      <option key={store.id} value={store.id}>{store.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            
            <div className="flex gap-4">
              <button
                onClick={() => setIsTeamModalOpen(false)}
                className="flex-1 py-3 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 font-bold rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleAddTeamMember}
                disabled={processing || !teamEmail}
                className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 dark:shadow-none flex items-center justify-center"
              >
                {processing ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Add Member'}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Store Modal */}
      {isStoreModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-gray-900 rounded-3xl p-8 max-w-md w-full shadow-2xl border border-gray-100 dark:border-gray-800"
          >
            <h2 className="text-2xl font-black text-gray-800 dark:text-gray-100 mb-2 uppercase tracking-tight">
              {editingStore ? 'Edit Store' : 'Add New Store'}
            </h2>
            <p className="text-gray-500 dark:text-gray-400 mb-6 font-medium">Configure store location and details.</p>
            
            <div className="space-y-4 mb-8">
              <div>
                <label className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1 block">Store Name</label>
                <input
                  type="text"
                  value={storeFormData.name}
                  onChange={(e) => setStoreFormData({ ...storeFormData, name: e.target.value })}
                  placeholder="e.g., Main Office, Downtown Branch"
                  className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 dark:text-gray-100"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1 block">Address</label>
                <textarea
                  value={storeFormData.address}
                  onChange={(e) => setStoreFormData({ ...storeFormData, address: e.target.value })}
                  placeholder="Full address of the store"
                  className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 h-20 dark:text-gray-100"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1 block">Latitude</label>
                  <input
                    type="number"
                    step="any"
                    value={storeFormData.latitude}
                    onChange={(e) => setStoreFormData({ ...storeFormData, latitude: parseFloat(e.target.value) })}
                    className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 dark:text-gray-100"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1 block">Longitude</label>
                  <input
                    type="number"
                    step="any"
                    value={storeFormData.longitude}
                    onChange={(e) => setStoreFormData({ ...storeFormData, longitude: parseFloat(e.target.value) })}
                    className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 dark:text-gray-100"
                  />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={storeFormData.isActive}
                  onChange={(e) => setStoreFormData({ ...storeFormData, isActive: e.target.checked })}
                  className="w-5 h-5 rounded border-gray-300 dark:border-gray-700 text-blue-600 focus:ring-blue-500 dark:bg-gray-800"
                />
                <label htmlFor="isActive" className="text-sm font-bold text-gray-700 dark:text-gray-300">Store is Active</label>
              </div>
            </div>
            
            <div className="flex gap-4">
              <button
                onClick={() => setIsStoreModalOpen(false)}
                className="flex-1 py-3 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 font-bold rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveStore}
                disabled={processing || !storeFormData.name || !storeFormData.address}
                className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 dark:shadow-none flex items-center justify-center"
              >
                {processing ? <Loader2 className="w-5 h-5 animate-spin" /> : editingStore ? 'Update Store' : 'Add Store'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
