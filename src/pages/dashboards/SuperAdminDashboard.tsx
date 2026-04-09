import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
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
  Ban,
  TrendingUp,
  DollarSign,
  Store as StoreIcon,
  Users as UsersIcon,
  BarChart3,
  Truck,
  Package as PackageIcon,
  Tag,
  Percent,
  Settings as SettingsIcon,
  Save,
  X,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
  LayoutDashboard,
  Mail,
  Phone,
  Briefcase,
  Map as MapIcon,
  Navigation,
  History,
  Database
} from 'lucide-react';
import { collection, query, orderBy, onSnapshot, updateDoc, doc, getDoc, runTransaction, where, limit, addDoc, deleteDoc, setDoc, getDocs } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../firebase';
import { Booking, AdminRole, User as AppUser, Store, Package } from '../../types';
import { format, subDays, startOfDay, endOfDay, isWithinInterval, startOfMonth, endOfMonth, startOfWeek, endOfWeek } from 'date-fns';
import { useAuth } from '../../context/AuthContext';
import { StoreService } from '../../services/StoreService';
import LoadingScreen from '../../components/LoadingScreen';
import ConfirmModal from '../../components/ConfirmModal';
import { 
  LineChart, 
  Line, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  AreaChart, 
  Area,
  PieChart,
  Pie,
  Cell
} from 'recharts';

import StaffManagement from '../../components/admin/StaffManagement';

const SuperAdminDashboard: React.FC = () => {
  const { user: currentUser } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'stores' | 'orders' | 'users' | 'staff' | 'pricing' | 'finance' | 'logistics' | 'maintenance'>('overview');
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [globalSettings, setGlobalSettings] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [timeRange, setTimeRange] = useState<'daily' | 'weekly' | 'monthly'>('weekly');
  
  // Store Management State
  const [isStoreModalOpen, setIsStoreModalOpen] = useState(false);
  const [editingStore, setEditingStore] = useState<Store | null>(null);
  const [storeFormData, setStoreFormData] = useState({ name: '', location: '', address: '', phone: '', storeCode: '', latitude: 0, longitude: 0, active: true });
  
  // User Management State
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const [userFilterRole, setUserFilterRole] = useState<string>('all');
  const [userFilterStore, setUserFilterStore] = useState<string>('all');
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [confirmConfig, setConfirmConfig] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
    variant: 'danger' | 'warning' | 'info';
  }>({
    title: '',
    message: '',
    onConfirm: () => {},
    variant: 'danger'
  });

  useEffect(() => {
    // Global data fetching for Super Admin
    const unsubBookings = onSnapshot(query(collection(db, 'bookings'), orderBy('createdAt', 'desc')), (snapshot) => {
      setBookings(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Booking[]);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'bookings');
      setLoading(false);
    });

    const unsubStores = onSnapshot(collection(db, 'stores'), (snapshot) => {
      setStores(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Store[]);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'stores');
    });

    const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      setUsers(snapshot.docs.map(doc => ({ ...doc.data(), uid: doc.id })) as AppUser[]);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'users');
    });

    const loadSettings = async () => {
      try {
        const settingsDoc = await getDoc(doc(db, 'settings', 'global'));
        if (settingsDoc.exists()) {
          setGlobalSettings(settingsDoc.data());
        } else {
          const initialSettings = {
            pricing: { washFold: 0, expressWash: 44, instantBooking: 44, minCharge: 156, pricePerKg: 39, minLoad: 5 },
            subscriptionPlans: [
              { id: 'basic', name: 'Basic', kgLimit: 12, price: 421, originalPrice: 468, discount: 10, description: '12kg Monthly Capacity' },
              { id: 'standard', name: 'Standard', kgLimit: 16, price: 530, originalPrice: 624, discount: 15, description: '16kg Monthly Capacity' },
              { id: 'premium', name: 'Premium', kgLimit: 20, price: 647, originalPrice: 780, discount: 17, description: '20kg Monthly Capacity' },
              { id: 'super_premium', name: 'Super Premium', kgLimit: 32, price: 936, originalPrice: 1248, discount: 25, description: '32kg Monthly Capacity' }
            ],
            discounts: [],
            promos: []
          };
          setGlobalSettings(initialSettings);
          await setDoc(doc(db, 'settings', 'global'), initialSettings);
        }
      } catch (error) {
        console.error("Manual Settings Load Error:", error);
        setGlobalSettings({
          pricing: { washFold: 0, expressWash: 44, instantBooking: 44, minCharge: 156, pricePerKg: 39, minLoad: 5 },
          subscriptionPlans: [
            { id: 'basic', name: 'Basic', kgLimit: 12, price: 421, originalPrice: 468, discount: 10, description: '12kg Monthly Capacity' },
            { id: 'standard', name: 'Standard', kgLimit: 16, price: 530, originalPrice: 624, discount: 15, description: '16kg Monthly Capacity' },
            { id: 'premium', name: 'Premium', kgLimit: 20, price: 647, originalPrice: 780, discount: 17, description: '20kg Monthly Capacity' },
            { id: 'super_premium', name: 'Super Premium', kgLimit: 32, price: 936, originalPrice: 1248, discount: 25, description: '32kg Monthly Capacity' }
          ],
          discounts: [],
          promos: []
        });
      }
    };

    const unsubSettings = onSnapshot(doc(db, 'settings', 'global'), (snapshot) => {
      if (snapshot.exists()) {
        setGlobalSettings(snapshot.data());
      } else {
        // Initialize if not exists
        const initialSettings = {
          pricing: {
            washFold: 0,
            expressWash: 44,
            instantBooking: 44,
            minCharge: 156,
            pricePerKg: 39,
            minLoad: 5
          },
          subscriptionPlans: [
            { id: 'basic', name: 'Basic', kgLimit: 12, price: 421, originalPrice: 468, discount: 10, description: '12kg Monthly Capacity' },
            { id: 'standard', name: 'Standard', kgLimit: 16, price: 530, originalPrice: 624, discount: 15, description: '16kg Monthly Capacity' },
            { id: 'premium', name: 'Premium', kgLimit: 20, price: 647, originalPrice: 780, discount: 17, description: '20kg Monthly Capacity' },
            { id: 'super_premium', name: 'Super Premium', kgLimit: 32, price: 936, originalPrice: 1248, discount: 25, description: '32kg Monthly Capacity' }
          ],
          discounts: [],
          promos: []
        };
        setGlobalSettings(initialSettings);
        setDoc(doc(db, 'settings', 'global'), initialSettings).catch(err => {
          console.error("Settings initialization failed:", err);
        });
      }
    }, (error) => {
      console.error("Settings Snapshot Error:", error);
      // Fallback to avoid infinite loading
      const fallbackSettings = {
        pricing: { washFold: 0, expressWash: 44, instantBooking: 44, minCharge: 156, pricePerKg: 39, minLoad: 5 },
        subscriptionPlans: [
          { id: 'basic', name: 'Basic', kgLimit: 12, price: 421, originalPrice: 468, discount: 10, description: '12kg Monthly Capacity' },
          { id: 'standard', name: 'Standard', kgLimit: 16, price: 530, originalPrice: 624, discount: 15, description: '16kg Monthly Capacity' },
          { id: 'premium', name: 'Premium', kgLimit: 20, price: 647, originalPrice: 780, discount: 17, description: '20kg Monthly Capacity' },
          { id: 'super_premium', name: 'Super Premium', kgLimit: 32, price: 936, originalPrice: 1248, discount: 25, description: '32kg Monthly Capacity' }
        ],
        discounts: [],
        promos: []
      };
      setGlobalSettings(fallbackSettings);
      
      try {
        handleFirestoreError(error, OperationType.GET, 'settings/global');
      } catch (e) {
        // Error is logged by handleFirestoreError
      }
    });

    // Initial load attempt
    loadSettings();

    return () => {
      unsubBookings();
      unsubStores();
      unsubUsers();
      unsubSettings();
    };
  }, []);

  const stats = {
    revenue: bookings.reduce((acc, b) => acc + (b.price || 0), 0),
    ordersToday: bookings.filter(b => b.date === format(new Date(), 'yyyy-MM-dd')).length,
    activeStores: stores.filter(s => s.active).length,
    totalUsers: users.length,
  };

  const handleUpdateSettings = async (newSettings: any) => {
    setIsSaving(true);
    try {
      await setDoc(doc(db, 'settings', 'global'), newSettings);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'settings/global');
    } finally {
      setIsSaving(false);
    }
  };

  // Store Management Handlers
  const handleSaveStore = async () => {
    try {
      if (editingStore) {
        await updateDoc(doc(db, 'stores', editingStore.id), storeFormData);
      } else {
        // Generate WW#### ID by finding the max existing ID
        let nextNumber = 1;
        if (stores.length > 0) {
          const ids = stores
            .map(s => parseInt(s.id.replace('WW', '')))
            .filter(n => !isNaN(n));
          if (ids.length > 0) {
            nextNumber = Math.max(...ids) + 1;
          }
        }
        const nextId = 'WW' + nextNumber.toString().padStart(4, '0');
        await setDoc(doc(db, 'stores', nextId), { 
          ...storeFormData, 
          id: nextId,
          createdAt: new Date().toISOString() 
        });
      }
      setIsStoreModalOpen(false);
      setEditingStore(null);
      setStoreFormData({ name: '', location: '', address: '', phone: '', storeCode: '', latitude: 0, longitude: 0, active: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'stores');
    }
  };

  const handleDeleteStore = async (id: string) => {
    setConfirmConfig({
      title: 'Delete Store',
      message: 'Are you sure you want to delete this store? This will remove it from the system.',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'stores', id));
        } catch (error) {
          handleFirestoreError(error, OperationType.DELETE, 'stores');
        }
      },
      variant: 'danger'
    });
    setIsConfirmModalOpen(true);
  };

  // User Management Handlers
  const handleDeleteUser = async (userId: string) => {
    if (userId === currentUser?.uid) return;
    
    setConfirmConfig({
      title: 'Delete User Account',
      message: 'Are you sure you want to delete this user? This will remove their account from Firebase Authentication and their data from Firestore. This action cannot be undone.',
      onConfirm: async () => {
        try {
          const response = await fetch('/api/auth/delete-user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ uid: userId })
          });
          
          const result = await response.json();
          if (!result.success) {
            throw new Error(result.error || 'Failed to delete user');
          }
        } catch (error: any) {
          console.error('Error deleting user:', error);
          alert(`Error: ${error.message}`);
        }
      },
      variant: 'danger'
    });
    setIsConfirmModalOpen(true);
  };

  const handleUpdateUserRole = async (userId: string, role: string, adminRole?: string, storeId?: string) => {
    try {
      await updateDoc(doc(db, 'users', userId), {
        role,
        adminRole: adminRole || null,
        storeId: storeId || null
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${userId}`);
    }
  };

  const handleToggleUserStatus = async (userId: string, currentStatus: boolean) => {
    try {
      await updateDoc(doc(db, 'users', userId), { isRegistered: !currentStatus });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${userId}`);
    }
  };

  const handleClearAllOrders = async () => {
    setConfirmConfig({
      title: 'Clear All Order History',
      message: 'CRITICAL: This will permanently delete ALL bookings, machine slots, and mission progress from the entire system. This action cannot be undone. Are you absolutely sure?',
      onConfirm: async () => {
        setIsSaving(true);
        try {
          // 1. Clear Bookings
          try {
            const bookingsSnap = await getDocs(collection(db, 'bookings'));
            await Promise.all(bookingsSnap.docs.map(d => deleteDoc(doc(db, 'bookings', d.id))));
          } catch (e) {
            handleFirestoreError(e, OperationType.DELETE, 'bookings');
            throw e;
          }
          
          // 2. Clear Slots (Machine assignments)
          try {
            const slotsSnap = await getDocs(collection(db, 'slots'));
            await Promise.all(slotsSnap.docs.map(d => deleteDoc(doc(db, 'slots', d.id))));
          } catch (e) {
            handleFirestoreError(e, OperationType.DELETE, 'slots');
            throw e;
          }

          // 3. Clear User Missions (Progress tied to orders)
          try {
            const missionsSnap = await getDocs(collection(db, 'userMissions'));
            await Promise.all(missionsSnap.docs.map(d => deleteDoc(doc(db, 'userMissions', d.id))));
          } catch (e) {
            handleFirestoreError(e, OperationType.DELETE, 'userMissions');
            throw e;
          }

          // 4. Clear Notifications (Mostly order related)
          try {
            const notificationsSnap = await getDocs(collection(db, 'notifications'));
            await Promise.all(notificationsSnap.docs.map(d => deleteDoc(doc(db, 'notifications', d.id))));
          } catch (e) {
            handleFirestoreError(e, OperationType.DELETE, 'notifications');
            throw e;
          }

          // 5. Reset User Stats (lastOrderDate, etc.)
          try {
            const usersSnap = await getDocs(collection(db, 'users'));
            await Promise.all(usersSnap.docs.map(d => updateDoc(doc(db, 'users', d.id), {
              lastOrderDate: null,
              firstOrderRewarded: false
            })));
          } catch (e) {
            handleFirestoreError(e, OperationType.UPDATE, 'users/stats');
            throw e;
          }
          
          alert('System reset successful. All order history has been cleared.');
        } catch (error) {
          console.error("Global Reset Error:", error);
        } finally {
          setIsSaving(false);
        }
      },
      variant: 'danger'
    });
    setIsConfirmModalOpen(true);
  };

  // Data Visualization Logic
  const getChartData = () => {
    const days = timeRange === 'daily' ? 1 : timeRange === 'weekly' ? 7 : 30;
    const data = [];
    for (let i = days - 1; i >= 0; i--) {
      const date = subDays(new Date(), i);
      const dateStr = format(date, 'yyyy-MM-dd');
      const dayBookings = bookings.filter(b => b.date === dateStr);
      data.push({
        name: format(date, days > 7 ? 'MMM dd' : 'EEE'),
        revenue: dayBookings.reduce((acc, b) => acc + (b.price || 0), 0),
        orders: dayBookings.length
      });
    }
    return data;
  };

  const chartData = getChartData();

  const filteredUsers = users.filter(u => {
    const matchesSearch = u.name.toLowerCase().includes(searchTerm.toLowerCase()) || u.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = userFilterRole === 'all' || u.adminRole === userFilterRole || (userFilterRole === 'user' && !u.adminRole);
    const matchesStore = userFilterStore === 'all' || u.storeId === userFilterStore;
    return matchesSearch && matchesRole && matchesStore;
  });

  const COLORS = ['#3b82f6', '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e'];

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-gray-800 dark:text-gray-100 tracking-tight uppercase">SUPER ADMIN PANEL</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">
            Full control over multi-store operations, pricing, and global logistics.
          </p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <button className="px-3 sm:px-4 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg sm:rounded-xl text-sm font-bold text-gray-600 dark:text-gray-400 hover:bg-gray-50 transition-all shadow-sm flex items-center gap-2">
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Report</span>
          </button>
          <button 
            onClick={() => {
              setEditingStore(null);
              setStoreFormData({ name: '', location: '', address: '', phone: '', storeCode: '', latitude: 0, longitude: 0, active: true });
              setIsStoreModalOpen(true);
            }}
            className="px-3 sm:px-4 py-2 bg-blue-600 text-white rounded-lg sm:rounded-xl text-sm font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 dark:shadow-none flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">New Store</span>
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
        {[
          { label: 'Total Revenue', value: `₹${stats.revenue.toLocaleString()}`, icon: DollarSign, color: 'green' },
          { label: 'Orders Today', value: stats.ordersToday, icon: TrendingUp, color: 'blue' },
          { label: 'Active Stores', value: stats.activeStores, icon: StoreIcon, color: 'indigo' },
          { label: 'Total Users', value: stats.totalUsers, icon: UsersIcon, color: 'purple' },
        ].map((stat, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-white dark:bg-gray-900 p-4 sm:p-6 rounded-2xl sm:rounded-[2.5rem] border border-gray-100 dark:border-gray-800 shadow-sm relative overflow-hidden group"
          >
            <div className={`absolute -right-4 -top-4 w-24 h-24 bg-${stat.color}-50 dark:bg-${stat.color}-900/10 rounded-full blur-2xl opacity-0 group-hover:opacity-100 group-hover:scale-150 transition-all duration-500`} />
            <div className="relative z-10">
              <div className={`p-2 sm:p-3 bg-${stat.color}-50 dark:bg-${stat.color}-900/20 rounded-xl sm:rounded-2xl w-fit mb-3 sm:mb-4`}>
                <stat.icon className={`w-5 h-5 sm:w-6 sm:h-6 text-${stat.color}-600`} />
              </div>
              <p className="text-[10px] sm:text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1">{stat.label}</p>
              <p className="text-2xl sm:text-3xl font-black text-gray-800 dark:text-gray-100 tracking-tight">{stat.value}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Navigation Tabs */}
      <div className="flex space-x-6 border-b border-gray-100 dark:border-gray-800 overflow-x-auto pb-px">
        {[
          { id: 'overview', label: 'Overview', icon: BarChart3 },
          { id: 'stores', label: 'Stores', icon: StoreIcon },
          { id: 'orders', label: 'Global Orders', icon: PackageIcon },
          { id: 'users', label: 'User Management', icon: UsersIcon },
          { id: 'staff', label: 'Staff Management', icon: Briefcase },
          { id: 'pricing', label: 'Pricing Control', icon: DollarSign },
          { id: 'finance', label: 'Finance', icon: TrendingUp },
          { id: 'logistics', label: 'Logistics', icon: Truck },
          { id: 'maintenance', label: 'Maintenance', icon: Database },
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
        {activeTab === 'overview' && (
          <motion.div
            key="overview"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-8"
          >
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
              <div className="lg:col-span-2 bg-white dark:bg-gray-900 p-4 sm:p-8 rounded-2xl sm:rounded-[3rem] border border-gray-100 dark:border-gray-800 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 sm:mb-8 gap-4">
                  <h3 className="text-lg sm:text-xl font-black text-gray-800 dark:text-gray-100 uppercase tracking-tight">Revenue & Orders</h3>
                  <div className="flex bg-gray-50 dark:bg-gray-800 rounded-xl p-1 w-fit">
                    {(['daily', 'weekly', 'monthly'] as const).map((range) => (
                      <button
                        key={range}
                        onClick={() => setTimeRange(range)}
                        className={`px-3 sm:px-4 py-1.5 sm:py-2 text-[9px] sm:text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${
                          timeRange === range 
                            ? 'bg-white dark:bg-gray-900 text-blue-600 shadow-sm' 
                            : 'text-gray-400 hover:text-gray-600'
                        }`}
                      >
                        {range}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="h-64 sm:h-80 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis 
                        dataKey="name" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }}
                        dy={10}
                      />
                      <YAxis 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: '#fff', 
                          borderRadius: '1rem', 
                          border: 'none', 
                          boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' 
                        }}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="revenue" 
                        stroke="#3b82f6" 
                        strokeWidth={4}
                        fillOpacity={1} 
                        fill="url(#colorRevenue)" 
                      />
                      <Area 
                        type="monotone" 
                        dataKey="orders" 
                        stroke="#6366f1" 
                        strokeWidth={4}
                        fillOpacity={0} 
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-indigo-600 dark:bg-indigo-700 p-6 sm:p-8 rounded-2xl sm:rounded-[3rem] text-white shadow-xl shadow-indigo-200 dark:shadow-none relative overflow-hidden group">
                <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-white/10 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="relative z-10">
                  <h3 className="text-lg sm:text-xl font-black uppercase tracking-tight mb-6">Store Performance</h3>
                  <div className="space-y-4 sm:space-y-6">
                    {stores.map((store, i) => {
                      const storeBookings = bookings.filter(b => b.storeId === store.id);
                      const performance = Math.min(100, Math.round((storeBookings.length / (bookings.length || 1)) * 100 * 2));
                      return (
                        <div key={i} className="space-y-2">
                          <div className="flex justify-between text-xs font-bold uppercase tracking-widest opacity-80">
                            <span>{store.name}</span>
                            <span>{performance}%</span>
                          </div>
                          <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                            <motion.div 
                              initial={{ width: 0 }}
                              animate={{ width: `${performance}%` }}
                              className="h-full bg-white" 
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="bg-white dark:bg-gray-900 p-8 rounded-[3rem] border border-gray-100 dark:border-gray-800 shadow-sm">
                <h3 className="text-xl font-black text-gray-800 dark:text-gray-100 uppercase tracking-tight mb-8">Orders per Day</h3>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis 
                        dataKey="name" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }}
                      />
                      <YAxis 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }}
                      />
                      <Tooltip cursor={{ fill: '#f8fafc' }} />
                      <Bar dataKey="orders" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              
              <div className="bg-white dark:bg-gray-900 p-8 rounded-[3rem] border border-gray-100 dark:border-gray-800 shadow-sm">
                <h3 className="text-xl font-black text-gray-800 dark:text-gray-100 uppercase tracking-tight mb-8">Service Distribution</h3>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={[
                          { name: 'Wash & Fold', value: bookings.filter(b => b.serviceType === 'Wash & Fold').length },
                          { name: 'Express Wash', value: bookings.filter(b => b.serviceType === 'Express Wash').length },
                          { name: 'Instant', value: bookings.filter(b => b.serviceType === 'Instant Booking').length },
                          { name: 'Subscription', value: bookings.filter(b => b.serviceType === 'Subscription').length },
                        ]}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {COLORS.map((color, index) => (
                          <Cell key={`cell-${index}`} fill={color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'pricing' && !globalSettings && (
          <div className="flex flex-col items-center justify-center h-64 gap-4">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            <div className="text-center">
              <p className="text-sm text-gray-500 font-medium mb-2">Loading pricing settings...</p>
              <button 
                onClick={() => setGlobalSettings({
                  pricing: { washFold: 0, expressWash: 44, instantBooking: 44, minCharge: 156, pricePerKg: 39, minLoad: 5 },
                  subscriptionPlans: [
                    { id: 'basic', name: 'Basic', kgLimit: 12, price: 421, originalPrice: 468, discount: 10, description: '12kg Monthly Capacity' },
                    { id: 'standard', name: 'Standard', kgLimit: 16, price: 530, originalPrice: 624, discount: 15, description: '16kg Monthly Capacity' },
                    { id: 'premium', name: 'Premium', kgLimit: 20, price: 647, originalPrice: 780, discount: 17, description: '20kg Monthly Capacity' },
                    { id: 'super_premium', name: 'Super Premium', kgLimit: 32, price: 936, originalPrice: 1248, discount: 25, description: '32kg Monthly Capacity' }
                  ],
                  discounts: [],
                  promos: []
                })}
                className="text-xs font-black text-blue-600 uppercase tracking-widest hover:underline"
              >
                Skip Loading & Use Defaults
              </button>
            </div>
          </div>
        )}

        {activeTab === 'pricing' && globalSettings && (
          <motion.div
            key="pricing"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-8"
          >
            {/* Pricing Section */}
            <div className="bg-white dark:bg-gray-900 p-8 rounded-[3rem] border border-gray-100 dark:border-gray-800 shadow-sm">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-2xl">
                    <DollarSign className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-gray-800 dark:text-gray-100 uppercase tracking-tight">Service Pricing</h3>
                    <p className="text-sm text-gray-500 font-medium">Configure base rates for all laundry services.</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => {
                      const newPlans = [
                        { id: 'basic', name: 'Basic', kgLimit: 12, price: 421, originalPrice: 468, discount: 10, description: '12kg Monthly Capacity' },
                        { id: 'standard', name: 'Standard', kgLimit: 16, price: 530, originalPrice: 624, discount: 15, description: '16kg Monthly Capacity' },
                        { id: 'premium', name: 'Premium', kgLimit: 20, price: 647, originalPrice: 780, discount: 17, description: '20kg Monthly Capacity' },
                        { id: 'super_premium', name: 'Super Premium', kgLimit: 32, price: 936, originalPrice: 1248, discount: 25, description: '32kg Monthly Capacity' }
                      ];
                      setGlobalSettings({ ...globalSettings, subscriptionPlans: newPlans });
                    }}
                    className="px-4 py-2 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-amber-100 transition-all flex items-center gap-2"
                  >
                    <Percent className="w-4 h-4" />
                    Apply New Plans
                  </button>
                  <button 
                    onClick={() => handleUpdateSettings(globalSettings)}
                    disabled={isSaving}
                    className="px-6 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition-all flex items-center gap-2 disabled:opacity-50"
                  >
                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Save Changes
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {Object.entries(globalSettings.pricing).map(([key, value]: [string, any]) => (
                  <div key={key} className="space-y-2">
                    <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">
                      {key.replace(/([A-Z])/g, ' $1').trim()} {key.includes('Load') ? '(kg)' : '(₹)'}
                    </label>
                    <input 
                      type="number"
                      value={value}
                      onChange={(e) => setGlobalSettings({
                        ...globalSettings,
                        pricing: { ...globalSettings.pricing, [key]: parseFloat(e.target.value) }
                      })}
                      className="w-full bg-gray-50 dark:bg-gray-800 border-none rounded-2xl px-6 py-4 text-gray-800 dark:text-gray-100 font-bold outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Subscription Plans Section */}
            <div className="bg-white dark:bg-gray-900 p-8 rounded-[3rem] border border-gray-100 dark:border-gray-800 shadow-sm">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-2xl">
                    <PackageIcon className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-gray-800 dark:text-gray-100 uppercase tracking-tight">Subscription Plans</h3>
                    <p className="text-sm text-gray-500 font-medium">Configure monthly laundry packages.</p>
                  </div>
                </div>
                <button 
                  onClick={() => {
                    const newPlan = { id: Date.now().toString(), name: 'New Plan', kgLimit: 10, price: 0, discount: 0 };
                    setGlobalSettings({ ...globalSettings, subscriptionPlans: [...(globalSettings.subscriptionPlans || []), newPlan] });
                  }}
                  className="px-4 py-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-blue-100 transition-all flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add Plan
                </button>
              </div>

              <div className="space-y-4">
                {(globalSettings.subscriptionPlans || []).map((plan: any, index: number) => (
                  <div key={plan.id} className="grid grid-cols-1 md:grid-cols-5 gap-4 p-6 bg-gray-50 dark:bg-gray-800/50 rounded-[2rem] border border-gray-100 dark:border-gray-800">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Plan Name</label>
                      <input 
                        type="text"
                        value={plan.name}
                        onChange={(e) => {
                          const newPlans = [...globalSettings.subscriptionPlans];
                          newPlans[index].name = e.target.value;
                          setGlobalSettings({ ...globalSettings, subscriptionPlans: newPlans });
                        }}
                        className="w-full bg-white dark:bg-gray-900 border-none rounded-xl px-4 py-2 text-sm font-bold outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">KG Limit</label>
                      <input 
                        type="number"
                        value={plan.kgLimit}
                        onChange={(e) => {
                          const newPlans = [...globalSettings.subscriptionPlans];
                          newPlans[index].kgLimit = parseFloat(e.target.value);
                          setGlobalSettings({ ...globalSettings, subscriptionPlans: newPlans });
                        }}
                        className="w-full bg-white dark:bg-gray-900 border-none rounded-xl px-4 py-2 text-sm font-bold outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Price (₹)</label>
                      <input 
                        type="number"
                        value={plan.price}
                        onChange={(e) => {
                          const newPlans = [...globalSettings.subscriptionPlans];
                          newPlans[index].price = parseFloat(e.target.value);
                          setGlobalSettings({ ...globalSettings, subscriptionPlans: newPlans });
                        }}
                        className="w-full bg-white dark:bg-gray-900 border-none rounded-xl px-4 py-2 text-sm font-bold outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Discount (%)</label>
                      <input 
                        type="number"
                        value={plan.discount}
                        onChange={(e) => {
                          const newPlans = [...globalSettings.subscriptionPlans];
                          newPlans[index].discount = parseFloat(e.target.value);
                          setGlobalSettings({ ...globalSettings, subscriptionPlans: newPlans });
                        }}
                        className="w-full bg-white dark:bg-gray-900 border-none rounded-xl px-4 py-2 text-sm font-bold outline-none"
                      />
                    </div>
                    <div className="flex items-end justify-end">
                      <button 
                        onClick={() => {
                          const newPlans = globalSettings.subscriptionPlans.filter((_: any, i: number) => i !== index);
                          setGlobalSettings({ ...globalSettings, subscriptionPlans: newPlans });
                        }}
                        className="p-3 text-red-600 hover:bg-red-50 rounded-xl transition-all"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Discounts Section */}
            <div className="bg-white dark:bg-gray-900 p-8 rounded-[3rem] border border-gray-100 dark:border-gray-800 shadow-sm">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl">
                    <Percent className="w-6 h-6 text-indigo-600" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-gray-800 dark:text-gray-100 uppercase tracking-tight">Global Discounts</h3>
                    <p className="text-sm text-gray-500 font-medium">Manage automatic discounts applied to orders.</p>
                  </div>
                </div>
                <button 
                  onClick={() => {
                    const newDiscount = { id: Date.now().toString(), name: 'New Discount', type: 'percentage', value: 0, active: true };
                    setGlobalSettings({ ...globalSettings, discounts: [...globalSettings.discounts, newDiscount] });
                  }}
                  className="px-4 py-2 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-indigo-100 transition-all flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add Discount
                </button>
              </div>

              <div className="space-y-4">
                {globalSettings.discounts.map((discount: any, index: number) => (
                  <div key={discount.id} className="flex flex-col md:flex-row items-center gap-4 p-6 bg-gray-50 dark:bg-gray-800/50 rounded-[2rem] border border-gray-100 dark:border-gray-800">
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4 w-full">
                      <input 
                        type="text"
                        value={discount.name}
                        onChange={(e) => {
                          const newDiscounts = [...globalSettings.discounts];
                          newDiscounts[index].name = e.target.value;
                          setGlobalSettings({ ...globalSettings, discounts: newDiscounts });
                        }}
                        placeholder="Discount Name"
                        className="bg-white dark:bg-gray-900 border-none rounded-xl px-4 py-2 text-sm font-bold outline-none"
                      />
                      <select 
                        value={discount.type}
                        onChange={(e) => {
                          const newDiscounts = [...globalSettings.discounts];
                          newDiscounts[index].type = e.target.value;
                          setGlobalSettings({ ...globalSettings, discounts: newDiscounts });
                        }}
                        className="bg-white dark:bg-gray-900 border-none rounded-xl px-4 py-2 text-sm font-bold outline-none"
                      >
                        <option value="percentage">Percentage (%)</option>
                        <option value="fixed">Fixed (₹)</option>
                      </select>
                      <input 
                        type="number"
                        value={discount.value}
                        onChange={(e) => {
                          const newDiscounts = [...globalSettings.discounts];
                          newDiscounts[index].value = parseFloat(e.target.value);
                          setGlobalSettings({ ...globalSettings, discounts: newDiscounts });
                        }}
                        placeholder="Value"
                        className="bg-white dark:bg-gray-900 border-none rounded-xl px-4 py-2 text-sm font-bold outline-none"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => {
                          const newDiscounts = [...globalSettings.discounts];
                          newDiscounts[index].active = !newDiscounts[index].active;
                          setGlobalSettings({ ...globalSettings, discounts: newDiscounts });
                        }}
                        className={`p-2 rounded-lg transition-all ${discount.active ? 'text-green-600 bg-green-50' : 'text-gray-400 bg-gray-100'}`}
                      >
                        {discount.active ? <ToggleRight className="w-6 h-6" /> : <ToggleLeft className="w-6 h-6" />}
                      </button>
                      <button 
                        onClick={() => {
                          const newDiscounts = globalSettings.discounts.filter((_: any, i: number) => i !== index);
                          setGlobalSettings({ ...globalSettings, discounts: newDiscounts });
                        }}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-all"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Promos Section */}
            <div className="bg-white dark:bg-gray-900 p-8 rounded-[3rem] border border-gray-100 dark:border-gray-800 shadow-sm">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-2xl">
                    <Tag className="w-6 h-6 text-purple-600" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-gray-800 dark:text-gray-100 uppercase tracking-tight">Promo Codes</h3>
                    <p className="text-sm text-gray-500 font-medium">Create and manage coupon codes for marketing.</p>
                  </div>
                </div>
                <button 
                  onClick={() => {
                    const newPromo = { id: Date.now().toString(), code: 'NEWPROMO', description: '', discountType: 'percentage', discountValue: 0, expiryDate: '', active: true };
                    setGlobalSettings({ ...globalSettings, promos: [...globalSettings.promos, newPromo] });
                  }}
                  className="px-4 py-2 bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-purple-100 transition-all flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add Promo
                </button>
              </div>

              <div className="space-y-4">
                {globalSettings.promos.map((promo: any, index: number) => (
                  <div key={promo.id} className="flex flex-col gap-4 p-6 bg-gray-50 dark:bg-gray-800/50 rounded-[2rem] border border-gray-100 dark:border-gray-800">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 w-full">
                      <input 
                        type="text"
                        value={promo.code}
                        onChange={(e) => {
                          const newPromos = [...globalSettings.promos];
                          newPromos[index].code = e.target.value.toUpperCase();
                          setGlobalSettings({ ...globalSettings, promos: newPromos });
                        }}
                        placeholder="CODE"
                        className="bg-white dark:bg-gray-900 border-none rounded-xl px-4 py-2 text-sm font-bold outline-none"
                      />
                      <select 
                        value={promo.discountType}
                        onChange={(e) => {
                          const newPromos = [...globalSettings.promos];
                          newPromos[index].discountType = e.target.value;
                          setGlobalSettings({ ...globalSettings, promos: newPromos });
                        }}
                        className="bg-white dark:bg-gray-900 border-none rounded-xl px-4 py-2 text-sm font-bold outline-none"
                      >
                        <option value="percentage">Percentage (%)</option>
                        <option value="fixed">Fixed (₹)</option>
                      </select>
                      <input 
                        type="number"
                        value={promo.discountValue}
                        onChange={(e) => {
                          const newPromos = [...globalSettings.promos];
                          newPromos[index].discountValue = parseFloat(e.target.value);
                          setGlobalSettings({ ...globalSettings, promos: newPromos });
                        }}
                        placeholder="Value"
                        className="bg-white dark:bg-gray-900 border-none rounded-xl px-4 py-2 text-sm font-bold outline-none"
                      />
                      <input 
                        type="date"
                        value={promo.expiryDate}
                        onChange={(e) => {
                          const newPromos = [...globalSettings.promos];
                          newPromos[index].expiryDate = e.target.value;
                          setGlobalSettings({ ...globalSettings, promos: newPromos });
                        }}
                        className="bg-white dark:bg-gray-900 border-none rounded-xl px-4 py-2 text-sm font-bold outline-none"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <input 
                        type="text"
                        value={promo.description}
                        onChange={(e) => {
                          const newPromos = [...globalSettings.promos];
                          newPromos[index].description = e.target.value;
                          setGlobalSettings({ ...globalSettings, promos: newPromos });
                        }}
                        placeholder="Description (e.g., First order discount)"
                        className="flex-1 bg-white dark:bg-gray-900 border-none rounded-xl px-4 py-2 text-sm font-medium outline-none mr-4"
                      />
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => {
                            const newPromos = [...globalSettings.promos];
                            newPromos[index].active = !newPromos[index].active;
                            setGlobalSettings({ ...globalSettings, promos: newPromos });
                          }}
                          className={`p-2 rounded-lg transition-all ${promo.active ? 'text-green-600 bg-green-50' : 'text-gray-400 bg-gray-100'}`}
                        >
                          {promo.active ? <ToggleRight className="w-6 h-6" /> : <ToggleLeft className="w-6 h-6" />}
                        </button>
                        <button 
                          onClick={() => {
                            const newPromos = globalSettings.promos.filter((_: any, i: number) => i !== index);
                            setGlobalSettings({ ...globalSettings, promos: newPromos });
                          }}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-all"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'stores' && (
          <motion.div
            key="stores"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-8"
          >
            <div className="bg-white dark:bg-gray-900 p-8 rounded-[3rem] border border-gray-100 dark:border-gray-800 shadow-sm">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                <div>
                  <h3 className="text-xl font-black text-gray-800 dark:text-gray-100 uppercase tracking-tight">Store Directory</h3>
                  <p className="text-sm text-gray-500 font-medium">Manage all laundry outlets and their operational status.</p>
                </div>
                <button 
                  onClick={() => {
                    setEditingStore(null);
                    setStoreFormData({ name: '', location: '', address: '', phone: '', storeCode: '', latitude: 0, longitude: 0, active: true });
                    setIsStoreModalOpen(true);
                  }}
                  className="px-6 py-3 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 dark:shadow-none flex items-center gap-2"
                >
                  <Plus className="w-5 h-5" />
                  Add Store
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left border-b border-gray-50 dark:border-gray-800">
                      <th className="pb-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Store Info</th>
                      <th className="pb-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Code</th>
                      <th className="pb-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Location</th>
                      <th className="pb-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Status</th>
                      <th className="pb-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Daily Orders</th>
                      <th className="pb-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                    {stores.map((store) => (
                      <tr key={store.id} className="group hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-all">
                        <td className="py-6">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
                              <StoreIcon className="w-6 h-6 text-blue-600" />
                            </div>
                            <div>
                              <p className="font-black text-gray-800 dark:text-gray-100 tracking-tight">{store.name}</p>
                              <p className="text-xs text-gray-500 font-medium">{store.address}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-6">
                          <div className="flex items-center gap-2 text-sm font-bold text-gray-600 dark:text-gray-400">
                            <MapPin className="w-4 h-4" />
                            {store.location}
                          </div>
                        </td>
                        <td className="py-6">
                          <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                            store.active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                          }`}>
                            {store.active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="py-6">
                          <span className="text-sm font-black text-gray-800 dark:text-gray-100">
                            {bookings.filter(b => b.storeId === store.id && b.date === format(new Date(), 'yyyy-MM-dd')).length}
                          </span>
                        </td>
                        <td className="py-6 text-right">
                          <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all">
                            <button 
                              onClick={() => {
                                setEditingStore(store);
                                setStoreFormData({ 
                                  name: store.name || '', 
                                  location: store.location || '', 
                                  address: store.address || '', 
                                  phone: store.phone || '',
                                  storeCode: store.storeCode || '',
                                  latitude: (store as any).latitude || 0, 
                                  longitude: (store as any).longitude || 0, 
                                  active: store.active ?? true 
                                });
                                setIsStoreModalOpen(true);
                              }}
                              className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                            >
                              <Edit2 className="w-5 h-5" />
                            </button>
                            <button 
                              onClick={() => handleDeleteStore(store.id)}
                              className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
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
          </motion.div>
        )}

        {activeTab === 'orders' && (
          <motion.div
            key="orders"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-8"
          >
            <div className="bg-white dark:bg-gray-900 p-8 rounded-[3rem] border border-gray-100 dark:border-gray-800 shadow-sm">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                <div>
                  <h3 className="text-xl font-black text-gray-800 dark:text-gray-100 uppercase tracking-tight">Global Orders</h3>
                  <p className="text-sm text-gray-500 font-medium">Monitor and manage all laundry orders across all stores.</p>
                </div>
                <div className="flex items-center gap-4">
                   <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input 
                      type="text"
                      placeholder="Search orders..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-12 pr-6 py-3 bg-gray-50 dark:bg-gray-800 border-none rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500 transition-all w-full md:w-64"
                    />
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left border-b border-gray-50 dark:border-gray-800">
                      <th className="pb-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Order ID</th>
                      <th className="pb-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Customer</th>
                      <th className="pb-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Store</th>
                      <th className="pb-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Service</th>
                      <th className="pb-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Status</th>
                      <th className="pb-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                    {bookings
                      .filter(b => b.id?.toLowerCase().includes(searchTerm.toLowerCase()) || b.userName.toLowerCase().includes(searchTerm.toLowerCase()))
                      .map((order) => (
                      <tr key={order.id} className="group hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-all">
                        <td className="py-6">
                          <span className="text-sm font-black text-gray-800 dark:text-gray-100">#{order.id?.slice(-6).toUpperCase()}</span>
                        </td>
                        <td className="py-6">
                          <div>
                            <p className="font-bold text-gray-800 dark:text-gray-100">{order.userName}</p>
                            <p className="text-xs text-gray-500">{order.date}</p>
                          </div>
                        </td>
                        <td className="py-6">
                          <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                            {stores.find(s => s.id === order.storeId)?.name || 'Unknown'}
                          </span>
                        </td>
                        <td className="py-6">
                          <span className="text-sm font-medium text-gray-600 dark:text-gray-400">{order.serviceType}</span>
                          {order.garmentInstructions && (
                            <p className="text-[10px] text-amber-600 dark:text-amber-400 font-medium italic mt-1 max-w-[150px] truncate" title={order.garmentInstructions}>
                              Instr: {order.garmentInstructions}
                            </p>
                          )}
                        </td>
                        <td className="py-6">
                          <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                            order.status === 'completed' ? 'bg-green-100 text-green-700' :
                            order.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-blue-100 text-blue-700'
                          }`}>
                            {order.status}
                          </span>
                        </td>
                        <td className="py-6 text-right">
                          <span className="text-sm font-black text-gray-800 dark:text-gray-100">₹{order.price}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'users' && (
          <motion.div
            key="users"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-8"
          >
            <div className="bg-white dark:bg-gray-900 p-8 rounded-[3rem] border border-gray-100 dark:border-gray-800 shadow-sm">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                <div>
                  <h3 className="text-xl font-black text-gray-800 dark:text-gray-100 uppercase tracking-tight">User Directory</h3>
                  <p className="text-sm text-gray-500 font-medium">Manage roles and permissions for all users.</p>
                </div>
                <div className="flex flex-wrap items-center gap-4">
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input 
                      type="text"
                      placeholder="Search users..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-12 pr-6 py-3 bg-gray-50 dark:bg-gray-800 border-none rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500 transition-all w-full md:w-64"
                    />
                  </div>
                  <select 
                    value={userFilterRole}
                    onChange={(e) => setUserFilterRole(e.target.value)}
                    className="px-4 py-3 bg-gray-50 dark:bg-gray-800 border-none rounded-2xl text-sm font-bold outline-none"
                  >
                    <option value="all">All Roles</option>
                    <option value="super_admin">Super Admin</option>
                    <option value="store_admin">Store Admin</option>
                    <option value="delivery_partner">Logistics</option>
                    <option value="user">Customer</option>
                  </select>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left border-b border-gray-50 dark:border-gray-800">
                      <th className="pb-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">User Info</th>
                      <th className="pb-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Role</th>
                      <th className="pb-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Assigned Store</th>
                      <th className="pb-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Status</th>
                      <th className="pb-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                    {filteredUsers.map((user) => (
                      <tr key={user.uid} className="group hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-all">
                        <td className="py-6">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center overflow-hidden">
                              {user.photoURL ? (
                                <img src={user.photoURL} alt={user.name} className="w-full h-full object-cover" />
                              ) : (
                                <User className="w-6 h-6 text-gray-400" />
                              )}
                            </div>
                            <div>
                              <p className="font-black text-gray-800 dark:text-gray-100 tracking-tight">{user.name}</p>
                              <p className="text-xs text-gray-500 font-medium">{user.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-6">
                          <div className="flex items-center gap-2">
                            {user.adminRole === 'super_admin' ? (
                              <ShieldAlert className="w-4 h-4 text-red-500" />
                            ) : user.adminRole === 'store_admin' ? (
                              <ShieldCheck className="w-4 h-4 text-blue-500" />
                            ) : (
                              <User className="w-4 h-4 text-gray-400" />
                            )}
                            <span className="text-sm font-bold text-gray-700 dark:text-gray-300 capitalize">
                              {user.adminRole?.replace('_', ' ') || 'Customer'}
                            </span>
                          </div>
                        </td>
                        <td className="py-6">
                          <span className="text-sm font-bold text-gray-600 dark:text-gray-400">
                            {stores.find(s => s.id === user.storeId)?.name || 'N/A'}
                          </span>
                        </td>
                        <td className="py-6">
                          <button 
                            onClick={() => handleToggleUserStatus(user.uid, user.isRegistered || false)}
                            className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${
                              user.isRegistered ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                            }`}
                          >
                            {user.isRegistered ? 'Active' : 'Inactive'}
                          </button>
                        </td>
                        <td className="py-6 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <select 
                              onChange={(e) => {
                                const [role, adminRole] = e.target.value.split(':');
                                handleUpdateUserRole(user.uid, role, adminRole);
                              }}
                              className="text-xs font-bold bg-gray-50 dark:bg-gray-800 border-none rounded-lg px-2 py-1 outline-none"
                              defaultValue={`${user.role}:${user.adminRole || ''}`}
                            >
                              <option value="user:">Customer</option>
                              <option value="admin:store_admin">Store Admin</option>
                              <option value="admin:delivery_partner">Logistics</option>
                              <option value="admin:super_admin">Super Admin</option>
                            </select>
                            <button className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all">
                              <History className="w-5 h-5" />
                            </button>
                            {user.uid !== currentUser?.uid && (
                              <button 
                                onClick={() => handleDeleteUser(user.uid)}
                                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                              >
                                <Trash2 className="w-5 h-5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'staff' && (
          <motion.div
            key="staff"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <StaffManagement stores={stores} />
          </motion.div>
        )}

        {activeTab === 'finance' && (
          <motion.div
            key="finance"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-8"
          >
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 bg-white dark:bg-gray-900 p-8 rounded-[3rem] border border-gray-100 dark:border-gray-800 shadow-sm">
                <h3 className="text-xl font-black text-gray-800 dark:text-gray-100 uppercase tracking-tight mb-8">Revenue Analysis</h3>
                <div className="h-80 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} />
                      <Tooltip />
                      <Area type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={4} fill="#3b82f6" fillOpacity={0.1} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="bg-white dark:bg-gray-900 p-8 rounded-[3rem] border border-gray-100 dark:border-gray-800 shadow-sm">
                <h3 className="text-xl font-black text-gray-800 dark:text-gray-100 uppercase tracking-tight mb-8">Profit Margin</h3>
                <div className="h-80 flex flex-col items-center justify-center">
                  <div className="relative w-48 h-48">
                    <svg className="w-full h-full" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="45" fill="none" stroke="#f1f5f9" strokeWidth="10" />
                      <circle cx="50" cy="50" r="45" fill="none" stroke="#3b82f6" strokeWidth="10" strokeDasharray="282.7" strokeDashoffset="70.6" strokeLinecap="round" className="rotate-[-90deg] origin-center transition-all duration-1000" />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-4xl font-black text-gray-800 dark:text-gray-100 tracking-tight">75%</span>
                      <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Net Margin</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'logistics' && (
          <motion.div
            key="logistics"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-8"
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {[
                { label: 'Pending Pickups', value: '12', icon: MapPin, color: 'blue' },
                { label: 'In Transit', value: '8', icon: Truck, color: 'indigo' },
                { label: 'Completed Today', value: '45', icon: CheckCircle2, color: 'green' },
              ].map((stat, i) => (
                <div key={i} className="bg-white dark:bg-gray-900 p-8 rounded-[3rem] border border-gray-100 dark:border-gray-800 shadow-sm">
                  <div className={`p-3 bg-${stat.color}-50 dark:bg-${stat.color}-900/20 rounded-2xl w-fit mb-4`}>
                    <stat.icon className={`w-6 h-6 text-${stat.color}-600`} />
                  </div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">{stat.label}</p>
                  <p className="text-3xl font-black text-gray-800 dark:text-gray-100 tracking-tight">{stat.value}</p>
                </div>
              ))}
            </div>

            <div className="bg-white dark:bg-gray-900 p-8 rounded-[3rem] border border-gray-100 dark:border-gray-800 shadow-sm min-h-[400px] flex flex-col items-center justify-center text-center">
              <div className="p-6 bg-blue-50 dark:bg-blue-900/20 rounded-full mb-6">
                <MapIcon className="w-12 h-12 text-blue-600" />
              </div>
              <h3 className="text-2xl font-black text-gray-800 dark:text-gray-100 tracking-tight mb-2">Live Logistics Map</h3>
              <p className="text-gray-500 max-w-md mx-auto font-medium">
                Real-time tracking of delivery partners and pickup routes across all active stores.
              </p>
              <button className="mt-8 px-8 py-3 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 dark:shadow-none flex items-center gap-2">
                <Navigation className="w-5 h-5" />
                Launch Full Map
              </button>
            </div>
          </motion.div>
        )}

        {activeTab === 'maintenance' && (
          <motion.div
            key="maintenance"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-8"
          >
            <div className="bg-white dark:bg-gray-900 p-8 rounded-[3rem] border border-gray-100 dark:border-gray-800 shadow-sm">
              <div className="flex items-center gap-4 mb-8">
                <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-2xl">
                  <ShieldAlert className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-gray-800 dark:text-gray-100 uppercase tracking-tight">System Maintenance</h3>
                  <p className="text-sm text-gray-500 font-medium">Critical system operations and data management.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="p-8 bg-red-50 dark:bg-red-900/10 rounded-[2.5rem] border border-red-100 dark:border-red-900/20">
                  <h4 className="text-lg font-black text-red-600 uppercase tracking-tight mb-4">Reset Order History</h4>
                  <p className="text-sm text-red-700 dark:text-red-400 font-medium mb-6">
                    This will delete all bookings, machine assignments, and order-related progress. 
                    Users will see a completely fresh dashboard with no history.
                  </p>
                  <button 
                    onClick={handleClearAllOrders}
                    disabled={isSaving}
                    className="px-8 py-4 bg-red-600 text-white rounded-2xl font-bold hover:bg-red-700 transition-all shadow-lg shadow-red-200 dark:shadow-none flex items-center gap-2 disabled:opacity-50"
                  >
                    {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Trash2 className="w-5 h-5" />}
                    Clear All Orders & Reset History
                  </button>
                </div>

                <div className="p-8 bg-blue-50 dark:bg-blue-900/10 rounded-[2.5rem] border border-blue-100 dark:border-blue-900/20">
                  <h4 className="text-lg font-black text-blue-600 uppercase tracking-tight mb-4">System Health</h4>
                  <p className="text-sm text-blue-700 dark:text-blue-400 font-medium mb-6">
                    Current active bookings: {bookings.length}<br />
                    Total registered users: {users.length}<br />
                    Active stores: {stores.length}
                  </p>
                  <button 
                    className="px-8 py-4 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 dark:shadow-none flex items-center gap-2"
                  >
                    <Activity className="w-5 h-5" />
                    Run Diagnostics
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Store Modal */}
      <AnimatePresence>
        {isStoreModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-gray-900 w-full max-w-2xl rounded-[3rem] overflow-hidden shadow-2xl"
            >
              <div className="p-8 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
                <h3 className="text-2xl font-black text-gray-800 dark:text-gray-100 uppercase tracking-tight">
                  {editingStore ? 'Edit Store' : 'Add New Store'}
                </h3>
                <button onClick={() => setIsStoreModalOpen(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-all">
                  <X className="w-6 h-6 text-gray-400" />
                </button>
              </div>
              <div className="p-8 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Store Name</label>
                    <input 
                      type="text"
                      value={storeFormData.name}
                      onChange={(e) => setStoreFormData({ ...storeFormData, name: e.target.value })}
                      className="w-full bg-gray-50 dark:bg-gray-800 border-none rounded-2xl px-6 py-4 text-gray-800 dark:text-gray-100 font-bold outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                      placeholder="e.g. WashWise Downtown"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Location (City/Area)</label>
                    <input 
                      type="text"
                      value={storeFormData.location}
                      onChange={(e) => setStoreFormData({ ...storeFormData, location: e.target.value })}
                      className="w-full bg-gray-50 dark:bg-gray-800 border-none rounded-2xl px-6 py-4 text-gray-800 dark:text-gray-100 font-bold outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                      placeholder="e.g. Mumbai, Bandra"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Store Code (e.g. KOT, TVM)</label>
                    <input 
                      type="text"
                      value={storeFormData.storeCode}
                      onChange={(e) => setStoreFormData({ ...storeFormData, storeCode: e.target.value.toUpperCase() })}
                      className="w-full bg-gray-50 dark:bg-gray-800 border-none rounded-2xl px-6 py-4 text-gray-800 dark:text-gray-100 font-bold outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                      placeholder="e.g. KOT"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Phone Number</label>
                    <input 
                      type="tel"
                      value={storeFormData.phone}
                      onChange={(e) => setStoreFormData({ ...storeFormData, phone: e.target.value })}
                      className="w-full bg-gray-50 dark:bg-gray-800 border-none rounded-2xl px-6 py-4 text-gray-800 dark:text-gray-100 font-bold outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                      placeholder="e.g. +91 9876543210"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Full Address</label>
                  <textarea 
                    value={storeFormData.address}
                    onChange={(e) => setStoreFormData({ ...storeFormData, address: e.target.value })}
                    className="w-full bg-gray-50 dark:bg-gray-800 border-none rounded-2xl px-6 py-4 text-gray-800 dark:text-gray-100 font-bold outline-none focus:ring-2 focus:ring-blue-500 transition-all min-h-[100px]"
                    placeholder="Enter complete street address..."
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Latitude</label>
                    <input 
                      type="number"
                      step="any"
                      value={storeFormData.latitude}
                      onChange={(e) => setStoreFormData({ ...storeFormData, latitude: parseFloat(e.target.value) })}
                      className="w-full bg-gray-50 dark:bg-gray-800 border-none rounded-2xl px-6 py-4 text-gray-800 dark:text-gray-100 font-bold outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Longitude</label>
                    <input 
                      type="number"
                      step="any"
                      value={storeFormData.longitude}
                      onChange={(e) => setStoreFormData({ ...storeFormData, longitude: parseFloat(e.target.value) })}
                      className="w-full bg-gray-50 dark:bg-gray-800 border-none rounded-2xl px-6 py-4 text-gray-800 dark:text-gray-100 font-bold outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Operational Status</label>
                  <div className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-2xl">
                    <button
                      onClick={() => setStoreFormData({ ...storeFormData, active: !storeFormData.active })}
                      className={`p-2 rounded-xl transition-all ${storeFormData.active ? 'text-green-600 bg-green-50' : 'text-red-600 bg-red-50'}`}
                    >
                      {storeFormData.active ? <ToggleRight className="w-8 h-8" /> : <ToggleLeft className="w-8 h-8" />}
                    </button>
                    <span className="font-bold text-gray-700 dark:text-gray-300">
                      {storeFormData.active ? 'Store is Active' : 'Store is Inactive'}
                    </span>
                  </div>
                </div>
              </div>
              <div className="p-8 bg-gray-50 dark:bg-gray-800/50 flex items-center justify-end gap-4">
                <button 
                  onClick={() => setIsStoreModalOpen(false)}
                  className="px-6 py-3 text-sm font-bold text-gray-500 hover:text-gray-700 transition-all"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleSaveStore}
                  className="px-8 py-3 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 dark:shadow-none"
                >
                  {editingStore ? 'Update Store' : 'Create Store'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Confirm Modal */}
      <ConfirmModal
        isOpen={isConfirmModalOpen}
        onClose={() => setIsConfirmModalOpen(false)}
        onConfirm={confirmConfig.onConfirm}
        title={confirmConfig.title}
        message={confirmConfig.message}
        variant={confirmConfig.variant}
      />
    </div>
  );
};

export default SuperAdminDashboard;
