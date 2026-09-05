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
  Database,
  Monitor,
  MessageSquare,
  Star,
  Send,
  Sparkles,
  Zap,
  Shirt,
  RotateCcw,
  Layers
} from 'lucide-react';
import { collection, query, orderBy, onSnapshot, updateDoc, doc, getDoc, runTransaction, where, limit, addDoc, deleteDoc, setDoc, getDocs } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../firebase';
import { Booking, AdminRole, User as AppUser, Store, Package, Slot, TIME_SLOTS, Machine, KERALA_DISTRICTS, generateStoreId, GarmentPieceItem } from '../../types';
import { GARMENT_CATALOG, normalizeGarmentItem } from '../../data/garmentCatalog';
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

const SuperAdminDashboard: React.FC = () => {
  const { user: currentUser } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [feedbacks, setFeedbacks] = useState<any[]>([]);
  const [replyingFeedbackId, setReplyingFeedbackId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'overview' | 'stores' | 'orders' | 'users' | 'pricing' | 'finance' | 'logistics' | 'maintenance' | 'availability' | 'machines' | 'feedback'>('overview');
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [globalSettings, setGlobalSettings] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [timeRange, setTimeRange] = useState<'daily' | 'weekly' | 'monthly'>('weekly');
  const [garmentCategoryFilter, setGarmentCategoryFilter] = useState<string>('all');
  const [garmentSearchTerm, setGarmentSearchTerm] = useState<string>('');
  
  // Store Management State
  const [isStoreModalOpen, setIsStoreModalOpen] = useState(false);
  const [editingStore, setEditingStore] = useState<Store | null>(null);
  const [storeFormData, setStoreFormData] = useState({ 
    customStoreId: '',
    districtCode: 'KT',
    name: '', 
    location: '', 
    address: '', 
    phone: '', 
    storeCode: 'KT', 
    latitude: 0, 
    longitude: 0, 
    active: true,
    isPaused: false,
    maintenanceMessage: 'Store is temporarily closed for maintenance.'
  });
  
  // Machine Management State
  const [isMachineModalOpen, setIsMachineModalOpen] = useState(false);
  const [editingMachine, setEditingMachine] = useState<Machine | null>(null);
  const [machineFormData, setMachineFormData] = useState({
    storeId: '',
    number: 1,
    type: 'washer' as 'washer' | 'dryer',
    status: 'idle' as any,
    isAvailable: true
  });
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

  // Machine Availability State
  const [availabilityDate, setAvailabilityDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedTimeSlot, setSelectedTimeSlot] = useState(TIME_SLOTS[0]);
  const [currentSlotData, setCurrentSlotData] = useState<Slot | null>(null);
  const [isClearingSlot, setIsClearingSlot] = useState(false);

  useEffect(() => {
    // Global data fetching for Super Admin
    const unsubBookings = onSnapshot(query(collection(db, 'bookings'), orderBy('createdAt', 'desc')), (snapshot) => {
      setBookings(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Booking[]);
      setLoading(false);
    }, (error) => {
      console.warn('Bookings snapshot error:', error);
      setLoading(false);
    });

    const unsubStores = onSnapshot(collection(db, 'stores'), (snapshot) => {
      setStores(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Store[]);
    }, (error) => {
      console.warn('Stores snapshot error:', error);
    });

    const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      setUsers(snapshot.docs.map(doc => ({ ...doc.data(), uid: doc.id })) as AppUser[]);
    }, (error) => {
      console.warn('Users snapshot error:', error);
    });

    const unsubMachines = onSnapshot(collection(db, 'machines'), (snapshot) => {
      setMachines(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Machine[]);
    }, (error) => {
      console.warn('Machines snapshot error:', error);
    });

    const unsubFeedbacks = onSnapshot(query(collection(db, 'feedback'), orderBy('createdAt', 'desc')), (snapshot) => {
      setFeedbacks(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      console.warn('Feedbacks snapshot notice:', error);
    });

    const defaultSettings = {
      pricing: {
        regular_price_per_kg: 69,
        offer_price_per_kg: 39,
        express_regular_price_per_kg: 89,
        express_offer_price_per_kg: 45,
        limited_time_offer: true,
        washFold: 0,
        expressWash: 45,
        instantBooking: 44,
        minCharge: 156,
        pricePerKg: 39,
        minLoad: 4,
        deliveryFee: 5
      },
      subscriptionPlans: [
        { id: 'basic', name: 'Basic', kg_equivalent: 12, kgLimit: 12, credits: 120, monthlyCredits: 120, regular_price: 828, offer_price: 468, price: 468, originalPrice: 828, discount: 43.48, savings: 360, active: true, features: ['12 KG Monthly Limit', 'Priority Machine Access', 'Exclusive Rewards'], description: '120 Laundry Credits (~12 KG Monthly)' },
        { id: 'standard', name: 'Standard', kg_equivalent: 16, kgLimit: 16, credits: 160, monthlyCredits: 160, regular_price: 1104, offer_price: 624, price: 624, originalPrice: 1104, discount: 43.48, savings: 480, active: true, features: ['16 KG Monthly Limit', 'Priority Machine Access', 'Exclusive Rewards'], description: '160 Laundry Credits (~16 KG Monthly)' },
        { id: 'premium', name: 'Premium', kg_equivalent: 20, kgLimit: 20, credits: 200, monthlyCredits: 200, regular_price: 1380, offer_price: 780, price: 780, originalPrice: 1380, discount: 43.48, savings: 600, mostPopular: true, isMaxSavings: true, active: true, features: ['20 KG Monthly Limit', 'Priority Machine Access', 'Exclusive Rewards', 'Max Savings'], description: '200 Laundry Credits (~20 KG Monthly)' },
        { id: 'super_premium', name: 'Super Premium', kg_equivalent: 32, kgLimit: 32, credits: 320, monthlyCredits: 320, regular_price: 2208, offer_price: 1248, price: 1248, originalPrice: 2208, discount: 43.48, savings: 960, isMaxSavings: true, active: true, features: ['32 KG Monthly Limit', 'Priority Machine Access', 'Exclusive Rewards', 'Max Savings'], description: '320 Laundry Credits (~32 KG Monthly)' }
      ],
      discounts: [],
      promos: [],
      garmentCatalog: GARMENT_CATALOG.map((item) => normalizeGarmentItem(item))
    };

    const loadSettings = async () => {
      try {
        const settingsDoc = await getDoc(doc(db, 'settings', 'global'));
        if (settingsDoc.exists()) {
          const data = settingsDoc.data();
          const rawCatalog = data?.garmentCatalog || defaultSettings.garmentCatalog;
          const normalizedCatalog = Array.isArray(rawCatalog) ? rawCatalog.map((item: any) => normalizeGarmentItem(item)) : defaultSettings.garmentCatalog;
          setGlobalSettings({
            ...defaultSettings,
            ...data,
            garmentCatalog: normalizedCatalog,
            pricing: {
              ...defaultSettings.pricing,
              ...(data?.pricing || {})
            }
          });
        } else {
          setGlobalSettings(defaultSettings);
          await setDoc(doc(db, 'settings', 'global'), defaultSettings);
        }
      } catch (error) {
        console.error("Manual Settings Load Error:", error);
        setGlobalSettings(defaultSettings);
      }
    };

    const unsubSettings = onSnapshot(doc(db, 'settings', 'global'), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        const rawCatalog = data?.garmentCatalog || defaultSettings.garmentCatalog;
        const normalizedCatalog = Array.isArray(rawCatalog) ? rawCatalog.map((item: any) => normalizeGarmentItem(item)) : defaultSettings.garmentCatalog;
        setGlobalSettings({
          ...defaultSettings,
          ...data,
          garmentCatalog: normalizedCatalog,
          pricing: {
            ...defaultSettings.pricing,
            ...(data?.pricing || {})
          }
        });
      } else {
        setGlobalSettings(defaultSettings);
        setDoc(doc(db, 'settings', 'global'), defaultSettings).catch(err => {
          console.error("Settings initialization failed:", err);
        });
      }
    }, (error) => {
      console.error("Settings Snapshot Error:", error);
      setGlobalSettings(defaultSettings);
      try {
        handleFirestoreError(error, OperationType.GET, 'settings/global');
      } catch (e) {
        // Error logged
      }
    });

    // Initial load attempt
    loadSettings();

    return () => {
      unsubBookings();
      unsubStores();
      unsubUsers();
      unsubMachines();
      unsubSettings();
    };
  }, []);

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

  const handleToggleMachineAvailability = async (machine: Machine) => {
    try {
      await updateDoc(doc(db, 'machines', machine.id), {
        isAvailable: !machine.isAvailable,
        status: !machine.isAvailable ? 'idle' : 'unavailable'
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `machines/${machine.id}`);
    }
  };

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

  // Automatic migration check for store ID 'RIT' -> 'WW001KT'
  useEffect(() => {
    const checkAndMigrateRIT = async () => {
      try {
        const ritDoc = await getDoc(doc(db, 'stores', 'RIT'));
        if (ritDoc.exists()) {
          console.log('Migrating RIT store to WW001KT...');
          const ritData = ritDoc.data();
          const newStoreData = {
            ...ritData,
            id: 'WW001KT',
            storeCode: 'KT',
            districtCode: 'KT',
            location: ritData.location || 'Kottayam',
            address: ritData.address || 'RIT Campus, Pampady, Kottayam'
          };
          await setDoc(doc(db, 'stores', 'WW001KT'), newStoreData);
          await deleteDoc(doc(db, 'stores', 'RIT'));
          await migrateStoreReferences('RIT', 'WW001KT');
          console.log('Successfully migrated store RIT to WW001KT');
        } else {
          const ritUsersQuery = query(collection(db, 'users'), where('storeId', '==', 'RIT'));
          const ritUsersSnap = await getDocs(ritUsersQuery);
          if (!ritUsersSnap.empty) {
            await migrateStoreReferences('RIT', 'WW001KT');
          }
        }
      } catch (err) {
        console.error('Auto migration of RIT store failed:', err);
      }
    };
    checkAndMigrateRIT();
  }, []);

  // Store Management Handlers
  const migrateStoreReferences = async (oldId: string, newId: string) => {
    try {
      // Update users
      const usersQuery = query(collection(db, 'users'), where('storeId', '==', oldId));
      const usersSnap = await getDocs(usersQuery);
      for (const uDoc of usersSnap.docs) {
        await updateDoc(doc(db, 'users', uDoc.id), { storeId: newId });
      }

      // Update machines
      const machinesQuery = query(collection(db, 'machines'), where('storeId', '==', oldId));
      const machinesSnap = await getDocs(machinesQuery);
      for (const mDoc of machinesSnap.docs) {
        await updateDoc(doc(db, 'machines', mDoc.id), { storeId: newId });
      }

      // Update bookings
      const bookingsQuery = query(collection(db, 'bookings'), where('storeId', '==', oldId));
      const bookingsSnap = await getDocs(bookingsQuery);
      for (const bDoc of bookingsSnap.docs) {
        await updateDoc(doc(db, 'bookings', bDoc.id), { storeId: newId });
      }

      // Update admin_roles
      const adminRolesQuery = query(collection(db, 'admin_roles'), where('storeId', '==', oldId));
      const adminRolesSnap = await getDocs(adminRolesQuery);
      for (const aDoc of adminRolesSnap.docs) {
        await updateDoc(doc(db, 'admin_roles', aDoc.id), { storeId: newId });
      }
    } catch (err) {
      console.error('Error migrating store references:', err);
    }
  };

  const handleOpenAddStoreModal = () => {
    setEditingStore(null);
    const defaultDistrict = 'KT';
    const storeSeq = stores.length + 1;
    const autoId = generateStoreId(storeSeq, defaultDistrict);
    setStoreFormData({ 
      customStoreId: autoId,
      districtCode: defaultDistrict,
      name: '', 
      location: '', 
      address: '', 
      phone: '', 
      storeCode: defaultDistrict, 
      latitude: 0, 
      longitude: 0, 
      active: true,
      isPaused: false,
      maintenanceMessage: 'Store is temporarily closed for maintenance.'
    });
    setIsStoreModalOpen(true);
  };

  const handleOpenEditStoreModal = (store: Store) => {
    setEditingStore(store);
    let dist = store.districtCode || store.storeCode || '';
    if (!dist && store.id && store.id.length >= 2) {
      dist = store.id.slice(-2);
    }
    if (!KERALA_DISTRICTS.some(d => d.code === dist)) {
      dist = 'KT';
    }
    setStoreFormData({ 
      customStoreId: store.id || '',
      districtCode: dist,
      name: store.name || '', 
      location: store.location || '', 
      address: store.address || '', 
      phone: store.phone || '',
      storeCode: store.storeCode || dist,
      latitude: (store as any).latitude || 0, 
      longitude: (store as any).longitude || 0, 
      active: store.active ?? true,
      isPaused: store.isPaused || false,
      maintenanceMessage: store.maintenanceMessage || 'Store is temporarily closed for maintenance.'
    });
    setIsStoreModalOpen(true);
  };

  const handleSaveStore = async () => {
    try {
      const finalStoreId = (storeFormData.customStoreId || '').trim().toUpperCase();
      if (!finalStoreId) {
        alert('Please specify a valid Store ID (e.g. WW001KT)');
        return;
      }

      const storePayload = {
        id: finalStoreId,
        name: storeFormData.name,
        location: storeFormData.location,
        address: storeFormData.address,
        phone: storeFormData.phone,
        storeCode: storeFormData.storeCode || storeFormData.districtCode,
        districtCode: storeFormData.districtCode,
        latitude: storeFormData.latitude,
        longitude: storeFormData.longitude,
        active: storeFormData.active,
        isPaused: storeFormData.isPaused,
        maintenanceMessage: storeFormData.maintenanceMessage
      };

      if (editingStore) {
        if (editingStore.id !== finalStoreId) {
          // Store ID changed! Migrate doc
          await setDoc(doc(db, 'stores', finalStoreId), {
            ...storePayload,
            createdAt: editingStore.createdAt || new Date().toISOString()
          });
          await deleteDoc(doc(db, 'stores', editingStore.id));
          await migrateStoreReferences(editingStore.id, finalStoreId);
        } else {
          await updateDoc(doc(db, 'stores', editingStore.id), storePayload);
        }
      } else {
        const existingDoc = await getDoc(doc(db, 'stores', finalStoreId));
        if (existingDoc.exists()) {
          alert(`Store ID "${finalStoreId}" already exists. Please choose a unique Store ID.`);
          return;
        }
        await setDoc(doc(db, 'stores', finalStoreId), { 
          ...storePayload, 
          createdAt: new Date().toISOString() 
        });
      }

      setIsStoreModalOpen(false);
      setEditingStore(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'stores');
    }
  };

  const handleSaveMachine = async () => {
    try {
      if (editingMachine) {
        await updateDoc(doc(db, 'machines', editingMachine.id), machineFormData);
      } else {
        const machineId = `${machineFormData.storeId}_M${machineFormData.number}_${machineFormData.type}`;
        await setDoc(doc(db, 'machines', machineId), {
          ...machineFormData,
          id: machineId
        });
      }
      setIsMachineModalOpen(false);
      setEditingMachine(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'machines');
    }
  };

  const handleDeleteMachine = async (id: string) => {
    setConfirmConfig({
      title: 'Delete Machine',
      message: 'Are you sure you want to delete this machine? This will remove it from the system.',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'machines', id));
        } catch (error) {
          handleFirestoreError(error, OperationType.DELETE, 'machines');
        }
      },
      variant: 'danger'
    });
    setIsConfirmModalOpen(true);
  };

  const handleToggleSlotPause = async () => {
    if (!currentSlotData) return;
    try {
      const slotId = `${availabilityDate}_${selectedTimeSlot}`;
      await setDoc(doc(db, 'slots', slotId), {
        ...currentSlotData,
        isPaused: !currentSlotData.isPaused
      }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `slots/${availabilityDate}_${selectedTimeSlot}`);
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
      message: 'CRITICAL: This will permanently delete ALL bookings and machine slots from the entire system. This action cannot be undone. Are you absolutely sure?',
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

          // 3. Clear Notifications (Mostly order related)
          try {
            const notificationsSnap = await getDocs(collection(db, 'notifications'));
            await Promise.all(notificationsSnap.docs.map(d => deleteDoc(doc(db, 'notifications', d.id))));
          } catch (e) {
            handleFirestoreError(e, OperationType.DELETE, 'notifications');
            throw e;
          }

          // 4. Reset User Stats (lastOrderDate, etc.)
          try {
            const usersSnap = await getDocs(collection(db, 'users'));
            await Promise.all(usersSnap.docs.map(d => updateDoc(doc(db, 'users', d.id), {
              lastOrderDate: null
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
    const search = (searchTerm || '').toLowerCase();
    const matchesSearch = (u?.name || '').toLowerCase().includes(search) || 
                          (u?.email || '').toLowerCase().includes(search) ||
                          (u?.uid || '').toLowerCase().includes(search) ||
                          (u?.phone || '').includes(searchTerm);
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
            onClick={handleOpenAddStoreModal}
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
          { id: 'pricing', label: 'Pricing Control', icon: DollarSign },
          { id: 'finance', label: 'Finance', icon: TrendingUp },
          { id: 'logistics', label: 'Logistics', icon: Truck },
          { id: 'maintenance', label: 'Maintenance', icon: Database },
          { id: 'availability', label: 'Machine Slots', icon: Monitor },
          { id: 'machines', label: 'Machine Management', icon: Activity },
          { id: 'feedback', label: 'Queries & Feedback', icon: MessageSquare },
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
                  pricing: { washFold: 0, expressWash: 45, instantBooking: 44, minCharge: 156, pricePerKg: 39, minLoad: 5, deliveryFee: 30 },
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
            {/* MASTER OFFER TOGGLE BANNER */}
            <div className={`p-8 rounded-[3rem] border-2 transition-all ${
              globalSettings.pricing?.limited_time_offer !== false
                ? 'bg-gradient-to-br from-amber-500/10 via-blue-500/5 to-purple-500/10 border-amber-500/30 dark:border-amber-500/20'
                : 'bg-gray-50 dark:bg-gray-800/40 border-gray-200 dark:border-gray-700'
            }`}>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex items-start gap-4">
                  <div className={`p-4 rounded-2xl shrink-0 ${
                    globalSettings.pricing?.limited_time_offer !== false
                      ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/30'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                  }`}>
                    <Tag className="w-8 h-8" />
                  </div>
                  <div>
                    <div className="flex items-center gap-3">
                      <h3 className="text-2xl font-black text-gray-800 dark:text-gray-100 uppercase tracking-tight">
                        Limited-Time Offer System
                      </h3>
                      <span className={`px-3 py-1 text-[10px] font-black uppercase tracking-widest rounded-full ${
                        globalSettings.pricing?.limited_time_offer !== false
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                          : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                      }`}>
                        {globalSettings.pricing?.limited_time_offer !== false ? 'ACTIVE (OFFER PRICING)' : 'INACTIVE (REGULAR PRICING)'}
                      </span>
                    </div>
                    <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 font-medium mt-1">
                      {globalSettings.pricing?.limited_time_offer !== false
                        ? 'Promotional Offer Prices (₹39/kg Normal, ₹45/kg Express, & Discounted Subscriptions) are currently applied to all customer orders.'
                        : 'Standard Regular Prices (₹69/kg Normal, ₹89/kg Express, & Full-rate Subscriptions) are currently applied.'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4 self-start md:self-auto">
                  <button
                    type="button"
                    onClick={() => {
                      const newOfferStatus = !(globalSettings.pricing?.limited_time_offer !== false);
                      setGlobalSettings({
                        ...globalSettings,
                        pricing: {
                          ...globalSettings.pricing,
                          limited_time_offer: newOfferStatus
                        }
                      });
                    }}
                    className={`px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all flex items-center gap-3 shadow-lg ${
                      globalSettings.pricing?.limited_time_offer !== false
                        ? 'bg-amber-500 text-white hover:bg-amber-600 shadow-amber-500/20'
                        : 'bg-gray-800 text-white hover:bg-gray-900 shadow-none'
                    }`}
                  >
                    {globalSettings.pricing?.limited_time_offer !== false ? (
                      <>
                        <ToggleRight className="w-6 h-6 text-yellow-200" />
                        <span>Offer Mode: ON</span>
                      </>
                    ) : (
                      <>
                        <ToggleLeft className="w-6 h-6 text-gray-400" />
                        <span>Offer Mode: OFF</span>
                      </>
                    )}
                  </button>
                  <button 
                    onClick={() => handleUpdateSettings(globalSettings)}
                    disabled={isSaving}
                    className="px-6 py-3 bg-blue-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-blue-700 transition-all flex items-center gap-2 disabled:opacity-50 shadow-lg shadow-blue-500/20"
                  >
                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Save All
                  </button>
                </div>
              </div>
            </div>

            {/* NORMAL & EXPRESS LAUNDRY PRICING CONFIGURATION */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Normal Laundry */}
              <div className="bg-white dark:bg-gray-900 p-8 rounded-[3rem] border border-gray-100 dark:border-gray-800 shadow-sm space-y-6">
                <div className="flex items-center gap-4 pb-4 border-b border-gray-100 dark:border-gray-800">
                  <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-2xl text-blue-600">
                    <DollarSign className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-gray-800 dark:text-gray-100 uppercase tracking-tight">Normal Laundry Pricing</h3>
                    <p className="text-xs text-gray-500 font-medium">Configure standard wash & fold rates per KG</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Regular Price per KG (₹)</label>
                    <input 
                      type="number"
                      value={globalSettings.pricing?.regular_price_per_kg ?? 69}
                      onChange={(e) => setGlobalSettings({
                        ...globalSettings,
                        pricing: {
                          ...globalSettings.pricing,
                          regular_price_per_kg: parseFloat(e.target.value) || 0
                        }
                      })}
                      className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl px-4 py-3 font-bold text-gray-800 dark:text-gray-100 outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-[10px] text-gray-400">Default base rate: ₹69/kg</p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-widest">Offer Price per KG (₹)</label>
                    <input 
                      type="number"
                      value={globalSettings.pricing?.offer_price_per_kg ?? 39}
                      onChange={(e) => setGlobalSettings({
                        ...globalSettings,
                        pricing: {
                          ...globalSettings.pricing,
                          offer_price_per_kg: parseFloat(e.target.value) || 0,
                          pricePerKg: parseFloat(e.target.value) || 0
                        }
                      })}
                      className="w-full bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-2xl px-4 py-3 font-black text-amber-600 dark:text-amber-400 outline-none focus:ring-2 focus:ring-amber-500"
                    />
                    <p className="text-[10px] text-amber-600/70">Limited-time promo rate: ₹39/kg</p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Minimum Load (KG)</label>
                    <input 
                      type="number"
                      value={globalSettings.pricing?.minLoad ?? 4}
                      onChange={(e) => setGlobalSettings({
                        ...globalSettings,
                        pricing: {
                          ...globalSettings.pricing,
                          minLoad: parseFloat(e.target.value) || 0
                        }
                      })}
                      className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl px-4 py-3 font-bold text-gray-800 dark:text-gray-100 outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Delivery Fee (₹)</label>
                    <input 
                      type="number"
                      value={globalSettings.pricing?.deliveryFee ?? 5}
                      onChange={(e) => setGlobalSettings({
                        ...globalSettings,
                        pricing: {
                          ...globalSettings.pricing,
                          deliveryFee: parseFloat(e.target.value) || 0
                        }
                      })}
                      className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl px-4 py-3 font-bold text-gray-800 dark:text-gray-100 outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Express Wash */}
              <div className="bg-white dark:bg-gray-900 p-8 rounded-[3rem] border border-gray-100 dark:border-gray-800 shadow-sm space-y-6">
                <div className="flex items-center gap-4 pb-4 border-b border-gray-100 dark:border-gray-800">
                  <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-2xl text-purple-600">
                    <Zap className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-gray-800 dark:text-gray-100 uppercase tracking-tight">Express Wash Pricing</h3>
                    <p className="text-xs text-gray-500 font-medium">Configure priority rush delivery wash rates</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Express Regular Price (₹/kg)</label>
                    <input 
                      type="number"
                      value={globalSettings.pricing?.express_regular_price_per_kg ?? 89}
                      onChange={(e) => setGlobalSettings({
                        ...globalSettings,
                        pricing: {
                          ...globalSettings.pricing,
                          express_regular_price_per_kg: parseFloat(e.target.value) || 0
                        }
                      })}
                      className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl px-4 py-3 font-bold text-gray-800 dark:text-gray-100 outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-[10px] text-gray-400">Regular express rate: ₹89/kg</p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-purple-600 dark:text-purple-400 uppercase tracking-widest">Express Offer Price (₹/kg)</label>
                    <input 
                      type="number"
                      value={globalSettings.pricing?.express_offer_price_per_kg ?? (globalSettings.pricing?.expressWash ?? 45)}
                      onChange={(e) => setGlobalSettings({
                        ...globalSettings,
                        pricing: {
                          ...globalSettings.pricing,
                          express_offer_price_per_kg: parseFloat(e.target.value) || 0,
                          expressWash: parseFloat(e.target.value) || 0
                        }
                      })}
                      className="w-full bg-purple-50/50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 rounded-2xl px-4 py-3 font-black text-purple-600 dark:text-purple-400 outline-none focus:ring-2 focus:ring-purple-500"
                    />
                    <p className="text-[10px] text-purple-600/70">Offer express rate: ₹45/kg</p>
                  </div>
                </div>

                <div className="p-4 bg-gray-50 dark:bg-gray-800/60 rounded-2xl text-xs text-gray-600 dark:text-gray-400 space-y-1">
                  <div className="font-bold uppercase tracking-wider text-[10px] text-gray-400">Live Active Rates Summary:</div>
                  <div className="flex justify-between font-medium">
                    <span>Normal Laundry Active Rate:</span>
                    <span className="font-bold text-blue-600">
                      ₹{globalSettings.pricing?.limited_time_offer !== false ? (globalSettings.pricing?.offer_price_per_kg ?? 39) : (globalSettings.pricing?.regular_price_per_kg ?? 69)}/kg
                    </span>
                  </div>
                  <div className="flex justify-between font-medium">
                    <span>Express Wash Active Rate:</span>
                    <span className="font-bold text-purple-600">
                      ₹{globalSettings.pricing?.limited_time_offer !== false ? (globalSettings.pricing?.express_offer_price_per_kg ?? 45) : (globalSettings.pricing?.express_regular_price_per_kg ?? 89)}/kg
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Subscription Plans Section */}
            <div className="bg-white dark:bg-gray-900 p-8 rounded-[3rem] border border-gray-100 dark:border-gray-800 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-2xl">
                    <PackageIcon className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-gray-800 dark:text-gray-100 uppercase tracking-tight">Subscription Plans Manager</h3>
                    <p className="text-sm text-gray-500 font-medium">Configure monthly plans with Regular Value, Offer Price, and Credits.</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <button 
                    type="button"
                    onClick={() => {
                      const regPerKg = globalSettings.pricing?.regular_price_per_kg ?? 69;
                      const offPerKg = globalSettings.pricing?.offer_price_per_kg ?? 39;
                      const isOfferActive = globalSettings.pricing?.limited_time_offer !== false;

                      const recalculated = [
                        { id: 'basic', name: 'Basic', kg_equivalent: 12, kgLimit: 12, credits: 120, monthlyCredits: 120, regular_price: 12 * regPerKg, offer_price: 12 * offPerKg, price: isOfferActive ? 12 * offPerKg : 12 * regPerKg, originalPrice: 12 * regPerKg, discount: Math.round(((12 * regPerKg - 12 * offPerKg) / (12 * regPerKg)) * 10000) / 100, savings: 12 * (regPerKg - offPerKg), active: true, features: ['12 KG Monthly Limit', 'Priority Machine Access', 'Exclusive Rewards'], description: '120 Laundry Credits (~12 KG Monthly)' },
                        { id: 'standard', name: 'Standard', kg_equivalent: 16, kgLimit: 16, credits: 160, monthlyCredits: 160, regular_price: 16 * regPerKg, offer_price: 16 * offPerKg, price: isOfferActive ? 16 * offPerKg : 16 * regPerKg, originalPrice: 16 * regPerKg, discount: Math.round(((16 * regPerKg - 16 * offPerKg) / (16 * regPerKg)) * 10000) / 100, savings: 16 * (regPerKg - offPerKg), active: true, features: ['16 KG Monthly Limit', 'Priority Machine Access', 'Exclusive Rewards'], description: '160 Laundry Credits (~16 KG Monthly)' },
                        { id: 'premium', name: 'Premium', kg_equivalent: 20, kgLimit: 20, credits: 200, monthlyCredits: 200, regular_price: 20 * regPerKg, offer_price: 20 * offPerKg, price: isOfferActive ? 20 * offPerKg : 20 * regPerKg, originalPrice: 20 * regPerKg, discount: Math.round(((20 * regPerKg - 20 * offPerKg) / (20 * regPerKg)) * 10000) / 100, savings: 20 * (regPerKg - offPerKg), mostPopular: true, isMaxSavings: true, active: true, features: ['20 KG Monthly Limit', 'Priority Machine Access', 'Exclusive Rewards', 'Max Savings'], description: '200 Laundry Credits (~20 KG Monthly)' },
                        { id: 'super_premium', name: 'Super Premium', kg_equivalent: 32, kgLimit: 32, credits: 320, monthlyCredits: 320, regular_price: 32 * regPerKg, offer_price: 32 * offPerKg, price: isOfferActive ? 32 * offPerKg : 32 * regPerKg, originalPrice: 32 * regPerKg, discount: Math.round(((32 * regPerKg - 32 * offPerKg) / (32 * regPerKg)) * 10000) / 100, savings: 32 * (regPerKg - offPerKg), isMaxSavings: true, active: true, features: ['32 KG Monthly Limit', 'Priority Machine Access', 'Exclusive Rewards', 'Max Savings'], description: '320 Laundry Credits (~32 KG Monthly)' }
                      ];
                      setGlobalSettings({ ...globalSettings, subscriptionPlans: recalculated });
                    }}
                    className="px-4 py-2 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-amber-100 transition-all flex items-center gap-2"
                  >
                    <Sparkles className="w-4 h-4" />
                    Auto-Calculate from Base Rates
                  </button>
                  <button 
                    type="button"
                    onClick={() => {
                      const newPlan = { 
                        id: Date.now().toString(), 
                        name: 'Custom Plan', 
                        kg_equivalent: 10, 
                        kgLimit: 10, 
                        credits: 100, 
                        monthlyCredits: 100, 
                        regular_price: 690, 
                        offer_price: 390, 
                        price: 390, 
                        originalPrice: 690, 
                        discount: 43.48, 
                        savings: 300, 
                        active: true,
                        features: ['10 KG Monthly Limit', 'Priority Access'] 
                      };
                      setGlobalSettings({ ...globalSettings, subscriptionPlans: [...(globalSettings.subscriptionPlans || []), newPlan] });
                    }}
                    className="px-4 py-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-blue-100 transition-all flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Add Plan
                  </button>
                </div>
              </div>

              <div className="space-y-6">
                {(globalSettings.subscriptionPlans || []).map((plan: any, index: number) => {
                  const regPrice = Number(plan.regular_price ?? (plan.originalPrice || 0));
                  const offPrice = Number(plan.offer_price ?? (plan.price || 0));
                  const savings = Math.max(0, regPrice - offPrice);
                  const discountPct = regPrice > 0 ? Math.round(((regPrice - offPrice) / regPrice) * 10000) / 100 : 0;

                  return (
                    <div key={plan.id} className="p-6 bg-gray-50 dark:bg-gray-800/50 rounded-[2rem] border border-gray-100 dark:border-gray-800 space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-4 items-center">
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
                          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">KG Equivalent</label>
                          <input 
                            type="number"
                            value={plan.kg_equivalent ?? plan.kgLimit ?? 12}
                            onChange={(e) => {
                              const newPlans = [...globalSettings.subscriptionPlans];
                              const kg = parseFloat(e.target.value) || 0;
                              newPlans[index].kg_equivalent = kg;
                              newPlans[index].kgLimit = kg;
                              newPlans[index].credits = kg * 10;
                              newPlans[index].monthlyCredits = kg * 10;
                              setGlobalSettings({ ...globalSettings, subscriptionPlans: newPlans });
                            }}
                            className="w-full bg-white dark:bg-gray-900 border-none rounded-xl px-4 py-2 text-sm font-bold outline-none"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Monthly Credits</label>
                          <input 
                            type="number"
                            value={plan.credits ?? plan.monthlyCredits ?? 120}
                            onChange={(e) => {
                              const newPlans = [...globalSettings.subscriptionPlans];
                              const creds = parseFloat(e.target.value) || 0;
                              newPlans[index].credits = creds;
                              newPlans[index].monthlyCredits = creds;
                              setGlobalSettings({ ...globalSettings, subscriptionPlans: newPlans });
                            }}
                            className="w-full bg-white dark:bg-gray-900 border-none rounded-xl px-4 py-2 text-sm font-bold outline-none"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Regular Price (₹)</label>
                          <input 
                            type="number"
                            value={regPrice}
                            onChange={(e) => {
                              const newPlans = [...globalSettings.subscriptionPlans];
                              const val = parseFloat(e.target.value) || 0;
                              newPlans[index].regular_price = val;
                              newPlans[index].originalPrice = val;
                              setGlobalSettings({ ...globalSettings, subscriptionPlans: newPlans });
                            }}
                            className="w-full bg-white dark:bg-gray-900 border-none rounded-xl px-4 py-2 text-sm font-bold outline-none"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-widest">Offer Price (₹)</label>
                          <input 
                            type="number"
                            value={offPrice}
                            onChange={(e) => {
                              const newPlans = [...globalSettings.subscriptionPlans];
                              const val = parseFloat(e.target.value) || 0;
                              newPlans[index].offer_price = val;
                              newPlans[index].price = val;
                              setGlobalSettings({ ...globalSettings, subscriptionPlans: newPlans });
                            }}
                            className="w-full bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-2 text-sm font-black text-amber-600 dark:text-amber-400 outline-none"
                          />
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-4 sm:pt-0">
                          <button
                            type="button"
                            onClick={() => {
                              const newPlans = [...globalSettings.subscriptionPlans];
                              newPlans[index].mostPopular = !newPlans[index].mostPopular;
                              setGlobalSettings({ ...globalSettings, subscriptionPlans: newPlans });
                            }}
                            className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-colors ${
                              plan.mostPopular ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-500'
                            }`}
                          >
                            {plan.mostPopular ? '★ Popular' : 'Normal'}
                          </button>
                          <button 
                            type="button"
                            onClick={() => {
                              const newPlans = globalSettings.subscriptionPlans.filter((_: any, i: number) => i !== index);
                              setGlobalSettings({ ...globalSettings, subscriptionPlans: newPlans });
                            }}
                            className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-xl transition-all"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Live Calculated Stats */}
                      <div className="flex flex-wrap items-center gap-4 text-xs pt-2 border-t border-gray-200 dark:border-gray-700 text-gray-500">
                        <span>Customer Saves: <strong className="text-green-600 dark:text-green-400">₹{savings} ({discountPct}%)</strong></span>
                        <span>•</span>
                        <span>Credits: <strong>{plan.credits || (plan.kg_equivalent * 10)} Credits</strong> (10 Credits = 1 KG)</span>
                        <span>•</span>
                        <span>Active Payable: <strong className="text-blue-600 dark:text-blue-400">₹{globalSettings.pricing?.limited_time_offer !== false ? offPrice : regPrice}</strong></span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* PIECE-BASED GARMENT CATALOG & PRICING MANAGER */}
            <div className="bg-white dark:bg-gray-900 p-8 rounded-[3rem] border border-gray-100 dark:border-gray-800 shadow-sm space-y-6">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-gray-100 dark:border-gray-800">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-2xl text-blue-600 dark:text-blue-400 shrink-0">
                    <Shirt className="w-7 h-7" />
                  </div>
                  <div>
                    <div className="flex items-center gap-3">
                      <h3 className="text-xl font-black text-gray-800 dark:text-gray-100 uppercase tracking-tight">
                        Piece-Based Garment Catalog & Pricing
                      </h3>
                      <span className="px-2.5 py-0.5 bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 rounded-lg text-[10px] font-black uppercase tracking-wider border border-blue-200 dark:border-blue-800/40">
                        {(globalSettings.garmentCatalog || []).length} Garments
                      </span>
                    </div>
                    <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 font-medium mt-1">
                      Configure Regular Reference Prices, Limited-Time Offer Prices, Subscriber Credits, and Active Status for each garment.
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <button 
                    type="button"
                    onClick={() => {
                      if (window.confirm('Reset all piece prices and categories back to standard catalog defaults?')) {
                        setGlobalSettings({
                          ...globalSettings,
                          garmentCatalog: GARMENT_CATALOG.map((item) => normalizeGarmentItem(item))
                        });
                      }
                    }}
                    className="px-4 py-2.5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-gray-200 dark:hover:bg-gray-700 transition-all flex items-center gap-2"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Reset to Defaults
                  </button>

                  <button 
                    type="button"
                    onClick={() => {
                      const newCatalog = (globalSettings.garmentCatalog || []).map((g: any) => {
                        const reg = g.regular_price || 20;
                        const off = Math.max(1, Math.round(reg * 0.65));
                        return { ...g, offer_price: off, offer_active: true };
                      });
                      setGlobalSettings({ ...globalSettings, garmentCatalog: newCatalog });
                    }}
                    className="px-4 py-2.5 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-all flex items-center gap-2"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    Auto-Promo (35% Off)
                  </button>

                  <button 
                    type="button"
                    onClick={() => {
                      const newId = 'item_' + Date.now();
                      const newItem: GarmentPieceItem = {
                        id: newId,
                        name: 'New Garment Item',
                        category: 'everyday',
                        regular_price: 25,
                        offer_price: 15,
                        price: 15,
                        subscriberCredits: 2,
                        unitCredits: 2,
                        approxWeightKg: 0.2,
                        active: true,
                        offer_active: true,
                        description: 'Custom piece item'
                      };
                      setGlobalSettings({
                        ...globalSettings,
                        garmentCatalog: [...(globalSettings.garmentCatalog || []), newItem]
                      });
                    }}
                    className="px-4 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-blue-700 transition-all flex items-center gap-2 shadow-lg shadow-blue-500/20"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Garment
                  </button>
                </div>
              </div>

              {/* FILTER & SEARCH CONTROLS */}
              <div className="flex flex-col md:flex-row gap-4 justify-between items-stretch md:items-center">
                <div className="flex flex-wrap gap-2">
                  {[
                    { id: 'all', label: 'All Garments' },
                    { id: 'everyday', label: 'Everyday' },
                    { id: 'heavy', label: 'Heavy' },
                    { id: 'whites', label: 'Whites' },
                    { id: 'traditional', label: 'Traditional' },
                    { id: 'bedding', label: 'Bedding' },
                    { id: 'kids_delicates', label: 'Delicates & Kids' }
                  ].map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setGarmentCategoryFilter(cat.id)}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                        garmentCategoryFilter === cat.id
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>

                <div className="relative w-full md:w-64">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input 
                    type="text"
                    placeholder="Search garments..."
                    value={garmentSearchTerm}
                    onChange={(e) => setGarmentSearchTerm(e.target.value)}
                    className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl pl-9 pr-3 py-1.5 text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* GARMENTS TABLE / LIST */}
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-gray-800 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                      <th className="pb-3">Garment Details</th>
                      <th className="pb-3">Category</th>
                      <th className="pb-3">Regular Price (₹)</th>
                      <th className="pb-3">Offer Price (₹)</th>
                      <th className="pb-3">Credits</th>
                      <th className="pb-3">Weight (KG)</th>
                      <th className="pb-3">Customer Live Preview</th>
                      <th className="pb-3 text-center">Offer</th>
                      <th className="pb-3 text-center">Status</th>
                      <th className="pb-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800/60">
                    {(globalSettings.garmentCatalog || [])
                      .filter((g: any) => {
                        const matchCat = garmentCategoryFilter === 'all' || g.category === garmentCategoryFilter;
                        const matchSearch = !garmentSearchTerm || g.name.toLowerCase().includes(garmentSearchTerm.toLowerCase());
                        return matchCat && matchSearch;
                      })
                      .map((garment: any, index: number) => {
                        const regPrice = Number(garment.regular_price ?? 20);
                        const offPrice = Number(garment.offer_price ?? 15);
                        const savings = Math.max(0, regPrice - offPrice);
                        const discountPct = regPrice > 0 ? Math.round(((regPrice - offPrice) / regPrice) * 100) : 0;
                        const isGlobalOffer = globalSettings.pricing?.limited_time_offer !== false;
                        const isItemOffer = garment.offer_active !== false;
                        const effectivePrice = (isGlobalOffer && isItemOffer) ? offPrice : regPrice;

                        // Find absolute index in full catalog for state mutations
                        const rawIndex = (globalSettings.garmentCatalog || []).findIndex((x: any) => x.id === garment.id);

                        return (
                          <tr key={garment.id || index} className="group hover:bg-gray-50/50 dark:hover:bg-gray-800/40 transition-colors">
                            {/* Name & ID */}
                            <td className="py-4 pr-3 min-w-[200px]">
                              <input 
                                type="text"
                                value={garment.name}
                                onChange={(e) => {
                                  const newCatalog = [...globalSettings.garmentCatalog];
                                  newCatalog[rawIndex].name = e.target.value;
                                  setGlobalSettings({ ...globalSettings, garmentCatalog: newCatalog });
                                }}
                                className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-1.5 text-xs font-black text-gray-800 dark:text-gray-100 outline-none focus:ring-2 focus:ring-blue-500"
                              />
                              <span className="text-[10px] text-gray-400 font-mono block mt-1">ID: {garment.id}</span>
                            </td>

                            {/* Category */}
                            <td className="py-4 pr-3 min-w-[130px]">
                              <select 
                                value={garment.category || 'everyday'}
                                onChange={(e) => {
                                  const newCatalog = [...globalSettings.garmentCatalog];
                                  newCatalog[rawIndex].category = e.target.value;
                                  setGlobalSettings({ ...globalSettings, garmentCatalog: newCatalog });
                                }}
                                className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-2.5 py-1.5 text-xs font-bold text-gray-700 dark:text-gray-300 outline-none w-full"
                              >
                                <option value="everyday">Everyday</option>
                                <option value="heavy">Heavy</option>
                                <option value="whites">Whites</option>
                                <option value="traditional">Traditional</option>
                                <option value="bedding">Bedding</option>
                                <option value="kids_delicates">Delicates & Kids</option>
                              </select>
                            </td>

                            {/* Regular Price (Strikethrough reference) */}
                            <td className="py-4 pr-3">
                              <div className="w-24">
                                <input 
                                  type="number"
                                  min="0"
                                  value={regPrice}
                                  onChange={(e) => {
                                    const newCatalog = [...globalSettings.garmentCatalog];
                                    const val = parseFloat(e.target.value) || 0;
                                    newCatalog[rawIndex].regular_price = val;
                                    setGlobalSettings({ ...globalSettings, garmentCatalog: newCatalog });
                                  }}
                                  className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-2.5 py-1.5 text-xs font-bold text-gray-700 dark:text-gray-300 outline-none focus:ring-2 focus:ring-blue-500"
                                />
                                <span className="text-[9px] text-gray-400 font-bold uppercase block mt-0.5">Base Rate</span>
                              </div>
                            </td>

                            {/* Offer Price */}
                            <td className="py-4 pr-3">
                              <div className="w-24">
                                <input 
                                  type="number"
                                  min="0"
                                  value={offPrice}
                                  onChange={(e) => {
                                    const newCatalog = [...globalSettings.garmentCatalog];
                                    const val = parseFloat(e.target.value) || 0;
                                    newCatalog[rawIndex].offer_price = val;
                                    newCatalog[rawIndex].price = val;
                                    setGlobalSettings({ ...globalSettings, garmentCatalog: newCatalog });
                                  }}
                                  className="w-full bg-amber-50/70 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-700/60 rounded-xl px-2.5 py-1.5 text-xs font-black text-amber-600 dark:text-amber-400 outline-none focus:ring-2 focus:ring-amber-500"
                                />
                                <span className="text-[9px] text-amber-600/80 font-bold uppercase block mt-0.5">Promo Rate</span>
                              </div>
                            </td>

                            {/* Subscriber Credits */}
                            <td className="py-4 pr-3">
                              <input 
                                type="number"
                                min="1"
                                value={garment.unitCredits || 2}
                                onChange={(e) => {
                                  const newCatalog = [...globalSettings.garmentCatalog];
                                  const val = parseInt(e.target.value) || 1;
                                  newCatalog[rawIndex].unitCredits = val;
                                  newCatalog[rawIndex].subscriber_credits = val;
                                  setGlobalSettings({ ...globalSettings, garmentCatalog: newCatalog });
                                }}
                                className="w-16 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-2.5 py-1.5 text-xs font-bold text-blue-600 dark:text-blue-400 outline-none text-center"
                              />
                            </td>

                            {/* Weight */}
                            <td className="py-4 pr-3">
                              <input 
                                type="number"
                                step="0.05"
                                min="0.05"
                                value={garment.approxWeightKg || 0.25}
                                onChange={(e) => {
                                  const newCatalog = [...globalSettings.garmentCatalog];
                                  const val = parseFloat(e.target.value) || 0.2;
                                  newCatalog[rawIndex].approxWeightKg = val;
                                  setGlobalSettings({ ...globalSettings, garmentCatalog: newCatalog });
                                }}
                                className="w-16 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-2 py-1.5 text-xs font-bold text-gray-600 dark:text-gray-400 outline-none text-center"
                              />
                            </td>

                            {/* Customer Live Preview */}
                            <td className="py-4 pr-3 min-w-[140px]">
                              <div className="flex flex-col gap-0.5">
                                <div className="flex items-baseline gap-1.5">
                                  <span className="text-sm font-black text-gray-900 dark:text-white">
                                    ₹{effectivePrice}
                                  </span>
                                  {isGlobalOffer && isItemOffer && savings > 0 && (
                                    <span className="text-[11px] text-gray-400 line-through font-semibold">
                                      ₹{regPrice}
                                    </span>
                                  )}
                                </div>
                                {isGlobalOffer && isItemOffer && savings > 0 ? (
                                  <span className="text-[9px] font-black text-green-600 dark:text-green-400 uppercase tracking-tight">
                                    Save ₹{savings} ({discountPct}%)
                                  </span>
                                ) : (
                                  <span className="text-[9px] text-gray-400 font-bold uppercase">
                                    Standard Rate
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Offer Active Switch */}
                            <td className="py-4 px-2 text-center">
                              <button
                                type="button"
                                title="Toggle promo offer for this garment"
                                onClick={() => {
                                  const newCatalog = [...globalSettings.garmentCatalog];
                                  newCatalog[rawIndex].offer_active = !(newCatalog[rawIndex].offer_active !== false);
                                  setGlobalSettings({ ...globalSettings, garmentCatalog: newCatalog });
                                }}
                                className={`p-1.5 rounded-lg transition-all ${
                                  garment.offer_active !== false 
                                    ? 'text-amber-500 bg-amber-50 dark:bg-amber-950/40' 
                                    : 'text-gray-400 bg-gray-100 dark:bg-gray-800'
                                }`}
                              >
                                {garment.offer_active !== false ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                              </button>
                            </td>

                            {/* Visibility Active Switch */}
                            <td className="py-4 px-2 text-center">
                              <button
                                type="button"
                                title="Toggle visibility in customer booking"
                                onClick={() => {
                                  const newCatalog = [...globalSettings.garmentCatalog];
                                  newCatalog[rawIndex].active = !(newCatalog[rawIndex].active !== false);
                                  setGlobalSettings({ ...globalSettings, garmentCatalog: newCatalog });
                                }}
                                className={`p-1.5 rounded-lg transition-all ${
                                  garment.active !== false 
                                    ? 'text-green-600 bg-green-50 dark:bg-green-950/40' 
                                    : 'text-gray-400 bg-gray-100 dark:bg-gray-800'
                                }`}
                              >
                                {garment.active !== false ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                              </button>
                            </td>

                            {/* Delete Item */}
                            <td className="py-4 pl-2 text-right">
                              <button
                                type="button"
                                onClick={() => {
                                  if (window.confirm(`Delete ${garment.name} from the piece catalog?`)) {
                                    const newCatalog = globalSettings.garmentCatalog.filter((_: any, i: number) => i !== rawIndex);
                                    setGlobalSettings({ ...globalSettings, garmentCatalog: newCatalog });
                                  }
                                }}
                                className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-xl transition-all"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>

              {/* Bottom Catalog Quick Actions & Save Button */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t border-gray-100 dark:border-gray-800">
                <div className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                  Changes made to garment prices and offers take effect on client checkout instantly when saved.
                </div>
                <button 
                  onClick={() => handleUpdateSettings(globalSettings)}
                  disabled={isSaving}
                  className="w-full sm:w-auto px-6 py-3 bg-blue-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-blue-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-blue-500/20"
                >
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Save All Settings & Catalog
                </button>
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
                    <p className="text-sm text-gray-500 font-medium">Manage automatic discounts applied to orders or subscriptions.</p>
                  </div>
                </div>
                <button 
                  onClick={() => {
                    const newDiscount = { id: Date.now().toString(), name: 'New Discount', type: 'percentage', value: 0, applicableFor: 'all', active: true };
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
                    <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 w-full">
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
                        value={Number.isNaN(discount.value) ? '' : discount.value}
                        onChange={(e) => {
                          const newDiscounts = [...globalSettings.discounts];
                          newDiscounts[index].value = e.target.value === '' ? 0 : (parseFloat(e.target.value) || 0);
                          setGlobalSettings({ ...globalSettings, discounts: newDiscounts });
                        }}
                        placeholder="Value"
                        className="bg-white dark:bg-gray-900 border-none rounded-xl px-4 py-2 text-sm font-bold outline-none"
                      />
                      <select 
                        value={discount.applicableFor || 'all'}
                        onChange={(e) => {
                          const newDiscounts = [...globalSettings.discounts];
                          newDiscounts[index].applicableFor = e.target.value;
                          setGlobalSettings({ ...globalSettings, discounts: newDiscounts });
                        }}
                        className="bg-white dark:bg-gray-900 border-none rounded-xl px-4 py-2 text-xs font-black outline-none text-indigo-600 dark:text-indigo-400"
                      >
                        <option value="all">Apply To: All (Wash & Subscription)</option>
                        <option value="wash">Apply To: Wash Orders Only</option>
                        <option value="subscription">Apply To: Subscriptions Only</option>
                      </select>
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
                    const newPromo = { id: Date.now().toString(), code: 'NEWPROMO', description: '', discountType: 'percentage', discountValue: 0, expiryDate: '', applicableFor: 'all', active: true };
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
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4 w-full">
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
                        value={Number.isNaN(promo.discountValue) ? '' : promo.discountValue}
                        onChange={(e) => {
                          const newPromos = [...globalSettings.promos];
                          newPromos[index].discountValue = e.target.value === '' ? 0 : (parseFloat(e.target.value) || 0);
                          setGlobalSettings({ ...globalSettings, promos: newPromos });
                        }}
                        placeholder="Value"
                        className="bg-white dark:bg-gray-900 border-none rounded-xl px-4 py-2 text-sm font-bold outline-none"
                      />
                      <select 
                        value={promo.applicableFor || 'all'}
                        onChange={(e) => {
                          const newPromos = [...globalSettings.promos];
                          newPromos[index].applicableFor = e.target.value;
                          setGlobalSettings({ ...globalSettings, promos: newPromos });
                        }}
                        className="bg-white dark:bg-gray-900 border-none rounded-xl px-4 py-2 text-xs font-black outline-none text-purple-600 dark:text-purple-400"
                      >
                        <option value="all">Apply To: All (Wash & Subscription)</option>
                        <option value="wash">Apply To: Wash Orders Only</option>
                        <option value="subscription">Apply To: Subscriptions Only</option>
                      </select>
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

            {/* Loyalty Points Rewards Program Configuration */}
            <div className="bg-white dark:bg-gray-900 p-8 rounded-[3rem] border border-gray-100 dark:border-gray-800 shadow-sm space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 dark:border-gray-800 pb-6">
                <div>
                  <div className="flex items-center gap-3">
                    <h3 className="text-xl font-black text-gray-800 dark:text-gray-100 uppercase tracking-tight">Loyalty Points Program</h3>
                    <span className="px-2.5 py-0.5 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-[10px] font-black uppercase rounded-full">
                      {(globalSettings.loyalty?.enabled ?? true) ? 'Active' : 'Disabled'}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 font-medium mt-1">
                    Reward customers with loyalty credits after every completed wash, redeemable for 100% free washes.
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      const current = globalSettings.loyalty || { enabled: true, creditsPerWash: 5, redemptionThreshold: 40, rewardOnFreeWash: false };
                      setGlobalSettings({
                        ...globalSettings,
                        loyalty: { ...current, enabled: !current.enabled }
                      });
                    }}
                    className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 border transition-all ${
                      (globalSettings.loyalty?.enabled ?? true)
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800'
                        : 'bg-gray-100 text-gray-500 border-gray-200 dark:bg-gray-800 dark:border-gray-700'
                    }`}
                  >
                    {(globalSettings.loyalty?.enabled ?? true) ? (
                      <>
                        <ToggleRight className="w-5 h-5 text-emerald-600" />
                        <span>Program Enabled</span>
                      </>
                    ) : (
                      <>
                        <ToggleLeft className="w-5 h-5 text-gray-400" />
                        <span>Program Disabled</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => handleUpdateSettings(globalSettings)}
                    disabled={isSaving}
                    className="px-5 py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-emerald-700 transition-all flex items-center gap-2 disabled:opacity-50 shadow-md shadow-emerald-500/20"
                  >
                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Save Loyalty Rules
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="p-5 bg-gray-50 dark:bg-gray-800/40 rounded-2xl border border-gray-100 dark:border-gray-800">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">
                    Credits Earned Per Wash
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={globalSettings.loyalty?.creditsPerWash ?? 5}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 1;
                        setGlobalSettings({
                          ...globalSettings,
                          loyalty: { ...(globalSettings.loyalty || { enabled: true, redemptionThreshold: 40, rewardOnFreeWash: false }), creditsPerWash: val }
                        });
                      }}
                      className="w-full px-4 py-2.5 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 font-bold text-gray-800 dark:text-gray-100 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                    <span className="text-xs font-bold text-emerald-600 shrink-0">Credits</span>
                  </div>
                  <p className="text-[11px] text-gray-400 mt-2">Default: 5 credits awarded upon wash completion.</p>
                </div>

                <div className="p-5 bg-gray-50 dark:bg-gray-800/40 rounded-2xl border border-gray-100 dark:border-gray-800">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">
                    Free Wash Threshold (4kg Load)
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      min="10"
                      max="200"
                      step="5"
                      value={globalSettings.loyalty?.redemptionThreshold ?? 40}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 40;
                        setGlobalSettings({
                          ...globalSettings,
                          loyalty: { ...(globalSettings.loyalty || { enabled: true, creditsPerWash: 5, rewardOnFreeWash: false }), redemptionThreshold: val }
                        });
                      }}
                      className="w-full px-4 py-2.5 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 font-bold text-gray-800 dark:text-gray-100 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                    <span className="text-xs font-bold text-emerald-600 shrink-0">Credits</span>
                  </div>
                  <p className="text-[11px] text-gray-400 mt-2">
                    40 credits = 8 completed washes @ 5 credits/wash = 1 free 4kg wash.
                  </p>
                </div>

                <div className="p-5 bg-gray-50 dark:bg-gray-800/40 rounded-2xl border border-gray-100 dark:border-gray-800 flex flex-col justify-between">
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">
                      Rollover / Accumulation Logic
                    </label>
                    <p className="text-xs font-bold text-gray-700 dark:text-gray-300 leading-relaxed">
                      Customers who have 40+ credits can choose to either redeem for a free wash OR pay normally to save credits (+5 added, making 45, 50, etc.).
                    </p>
                  </div>
                  <div className="mt-3 text-[10px] font-black text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 p-2 rounded-lg border border-emerald-200 dark:border-emerald-800/40">
                    ✓ Supported natively across web client & server
                  </div>
                </div>
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
                  onClick={handleOpenAddStoreModal}
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
                      <th className="pb-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Store ID</th>
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
                          <span className="px-3 py-1 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 rounded-xl text-xs font-black font-mono border border-blue-100 dark:border-blue-900/30">
                            {store.id}
                          </span>
                        </td>
                        <td className="py-6">
                          <div className="flex items-center gap-2 text-sm font-bold text-gray-600 dark:text-gray-400">
                            <MapPin className="w-4 h-4" />
                            {store.location}
                          </div>
                        </td>
                        <td className="py-6">
                          <div className="flex flex-col gap-1">
                            <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest w-fit ${
                              store.active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                            }`}>
                              {store.active ? 'Active' : 'Inactive'}
                            </span>
                            {store.isPaused && (
                              <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-amber-100 text-amber-700 w-fit">
                                Maintenance
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-6">
                          <span className="text-sm font-black text-gray-800 dark:text-gray-100">
                            {bookings.filter(b => b.storeId === store.id && b.date === format(new Date(), 'yyyy-MM-dd')).length}
                          </span>
                        </td>
                        <td className="py-6 text-right">
                          <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all">
                            <button 
                              onClick={() => handleOpenEditStoreModal(store)}
                              className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                              title="Edit Store"
                            >
                              <Edit2 className="w-5 h-5" />
                            </button>
                            <button 
                              onClick={() => {
                                setActiveTab('availability');
                                // In a real multi-store app, we'd filter by storeId here
                              }}
                              className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-xl transition-all"
                              title="Manage Machine Slots"
                            >
                              <Monitor className="w-5 h-5" />
                            </button>
                            <button 
                              onClick={() => handleDeleteStore(store.id)}
                              className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                              title="Delete Store"
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
                      .filter(b => {
                        const search = (searchTerm || '').toLowerCase();
                        return (b.id || '').toLowerCase().includes(search) || 
                               (b.bookingId || '').toLowerCase().includes(search) || 
                               (b.userName || '').toLowerCase().includes(search) ||
                               (b.userId || '').toLowerCase().includes(search);
                      })
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
                          <select
                            value={order.status}
                            onChange={async (e) => {
                              const newStatus = e.target.value as any;
                              try {
                                await updateDoc(doc(db, 'bookings', order.id!), { status: newStatus });
                                if (newStatus === 'completed' || newStatus === 'Washing completed') {
                                  fetch('/api/loyalty/trigger-reward', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ bookingId: order.id })
                                  }).catch(() => {});
                                }
                              } catch (err) {
                                console.error('Error updating order status:', err);
                              }
                            }}
                            className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest outline-none border cursor-pointer ${
                              order.status === 'completed' ? 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800' :
                              order.status === 'Washing completed' ? 'bg-teal-100 text-teal-700 border-teal-200 dark:bg-teal-900/30 dark:text-teal-400 dark:border-teal-800' :
                              order.status === 'pending' ? 'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800' :
                              'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800'
                            }`}
                          >
                            <option value="pending">pending</option>
                            <option value="paid">paid</option>
                            <option value="In Wash">In Wash</option>
                            <option value="In Dryer">In Dryer</option>
                            <option value="Washing completed">Washing completed</option>
                            <option value="Ready to deliver">Ready to deliver</option>
                            <option value="Ready to collect">Ready to collect</option>
                            <option value="Out for delivery">Out for delivery</option>
                            <option value="completed">completed</option>
                            <option value="cancelled">cancelled</option>
                            <option value="rejected">rejected</option>
                          </select>
                        </td>
                        <td className="py-6 text-right">
                          {order.paymentType === 'laundry_credits' || (order.creditsUsed !== undefined && order.creditsUsed > 0) ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-black bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
                              🧺 {order.creditsUsed} Credits
                            </span>
                          ) : (
                            <span className="text-sm font-black text-gray-800 dark:text-gray-100">₹{order.price}</span>
                          )}
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

            <div className="bg-amber-50 dark:bg-amber-900/10 p-6 rounded-[2.5rem] border border-amber-100 dark:border-amber-900/20 flex items-start gap-4">
              <AlertCircle className="w-6 h-6 text-amber-600 shrink-0 mt-1" />
              <div>
                <h4 className="text-sm font-black text-amber-800 dark:text-amber-200 uppercase tracking-tight mb-1">Important Note</h4>
                <p className="text-xs text-amber-700 dark:text-amber-400 font-medium leading-relaxed">
                  Clearing a slot manually will make the machine available for other users to book immediately. 
                  This action does NOT automatically cancel or refund the user's booking. 
                  Please ensure you communicate with the user or handle the booking status separately in the Global Orders tab.
                </p>
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
            className="space-y-8"
          >
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div>
                <h2 className="text-2xl font-black text-gray-800 dark:text-gray-100 uppercase tracking-tight">Machine Management</h2>
                <p className="text-gray-500 dark:text-gray-400 font-medium">Add, edit, and control global machine availability.</p>
              </div>
              <button 
                onClick={() => {
                  setEditingMachine(null);
                  setMachineFormData({ storeId: stores[0]?.id || '', number: machines.length + 1, type: 'washer', status: 'idle', isAvailable: true });
                  setIsMachineModalOpen(true);
                }}
                className="px-8 py-4 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 dark:shadow-none flex items-center gap-2"
              >
                <Plus className="w-5 h-5" />
                Add New Machine
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {machines.map((machine) => (
                <div key={machine.id} className="bg-white dark:bg-gray-900 p-8 rounded-[3rem] border border-gray-100 dark:border-gray-800 shadow-sm relative overflow-hidden group">
                  <div className="flex items-start justify-between mb-6">
                    <div className={`p-4 rounded-2xl ${machine.isAvailable ? 'bg-blue-50 text-blue-600' : 'bg-red-50 text-red-600'}`}>
                      <Monitor className="w-8 h-8" />
                    </div>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => {
                          setEditingMachine(machine);
                          setMachineFormData({ storeId: machine.storeId, number: machine.number, type: machine.type, status: machine.status, isAvailable: machine.isAvailable });
                          setIsMachineModalOpen(true);
                        }}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl text-gray-400 hover:text-blue-600 transition-all"
                      >
                        <Edit2 className="w-5 h-5" />
                      </button>
                      <button 
                        onClick={() => handleDeleteMachine(machine.id)}
                        className="p-2 hover:bg-red-50 rounded-xl text-gray-400 hover:text-red-600 transition-all"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  <div className="mb-6">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-xl font-black text-gray-800 dark:text-gray-100">Machine #{machine.number}</h3>
                      <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-[9px] font-black uppercase tracking-widest rounded-lg">{machine.type}</span>
                    </div>
                    <p className="text-xs text-gray-500 font-medium">{stores.find(s => s.id === machine.storeId)?.name || 'Unknown Store'}</p>
                  </div>

                  <div className="flex items-center justify-between pt-6 border-t border-gray-50 dark:border-gray-800">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${
                        machine.status === 'idle' ? 'bg-green-500' : 
                        machine.status === 'maintenance' ? 'bg-amber-500' : 'bg-red-500'
                      }`} />
                      <span className="text-[10px] font-black uppercase tracking-widest text-gray-600 dark:text-gray-400">{machine.status}</span>
                    </div>
                    <button 
                      onClick={() => handleToggleMachineAvailability(machine)}
                      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                        machine.isAvailable 
                          ? 'bg-green-50 text-green-600 hover:bg-green-100' 
                          : 'bg-red-50 text-red-600 hover:bg-red-100'
                      }`}
                    >
                      {machine.isAvailable ? <ShieldCheck className="w-4 h-4" /> : <ShieldAlert className="w-4 h-4" />}
                      {machine.isAvailable ? 'Available' : 'Unavailable'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {activeTab === 'feedback' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-gray-900 p-6 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm">
              <div>
                <h3 className="text-xl font-black text-gray-800 dark:text-gray-100 uppercase tracking-tight flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-blue-600" /> User Queries & Feedback ({feedbacks.length})
                </h3>
                <p className="text-xs text-gray-500 font-medium mt-1">
                  Monitor customer concerns, app reviews, store feedback, and issue reports.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <div className="px-4 py-2 bg-blue-50 dark:bg-blue-900/20 rounded-2xl border border-blue-100 dark:border-blue-800/40 text-center">
                  <p className="text-[10px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-400">Total Submissions</p>
                  <p className="text-xl font-black text-blue-900 dark:text-blue-100">{feedbacks.length}</p>
                </div>
                <div className="px-4 py-2 bg-amber-50 dark:bg-amber-900/20 rounded-2xl border border-amber-100 dark:border-amber-800/40 text-center">
                  <p className="text-[10px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-400">Avg Rating</p>
                  <p className="text-xl font-black text-amber-900 dark:text-amber-100 flex items-center justify-center gap-1">
                    {(feedbacks.filter(f => f.rating).reduce((acc, f) => acc + (f.rating || 0), 0) / (feedbacks.filter(f => f.rating).length || 1)).toFixed(1)} <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                  </p>
                </div>
              </div>
            </div>

            {feedbacks.length === 0 ? (
              <div className="bg-white dark:bg-gray-900 rounded-3xl p-12 text-center border border-gray-100 dark:border-gray-800 space-y-3">
                <MessageSquare className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto" />
                <h4 className="text-lg font-black text-gray-800 dark:text-gray-100 uppercase tracking-tight">No Submissions Yet</h4>
                <p className="text-xs text-gray-400">Customer feedback and query tickets will appear here automatically.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {feedbacks.map((fb) => (
                  <div
                    key={fb.id}
                    className="bg-white dark:bg-gray-900 rounded-3xl p-6 border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-md transition-all space-y-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="px-3 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-black text-[10px] uppercase tracking-widest rounded-full">
                            {fb.category ? fb.category.replace('_', ' ') : 'General'}
                          </span>
                          {fb.rating && (
                            <span className="flex items-center gap-1 text-xs font-bold text-amber-500 bg-amber-50 dark:bg-amber-900/20 px-2.5 py-0.5 rounded-full">
                              <Star className="w-3.5 h-3.5 fill-amber-400" /> {fb.rating}/5
                            </span>
                          )}
                        </div>
                        <h4 className="font-black text-base text-gray-900 dark:text-white">
                          {fb.subject || 'No Subject'}
                        </h4>
                      </div>

                      <select
                        value={fb.status || 'new'}
                        onChange={async (e) => {
                          const newStatus = e.target.value;
                          try {
                            await updateDoc(doc(db, 'feedback', fb.id), { status: newStatus });
                          } catch (err) {
                            console.error('Error updating feedback status:', err);
                          }
                        }}
                        className={`text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-xl outline-none border cursor-pointer ${
                          fb.status === 'resolved' ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300' :
                          fb.status === 'in_progress' ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300' :
                          'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300'
                        }`}
                      >
                        <option value="new">NEW</option>
                        <option value="in_progress">IN PROGRESS</option>
                        <option value="resolved">RESOLVED</option>
                      </select>
                    </div>

                    <p className="text-xs text-gray-600 dark:text-gray-300 font-medium whitespace-pre-wrap leading-relaxed bg-gray-50 dark:bg-gray-800/50 p-4 rounded-2xl">
                      {fb.message}
                    </p>

                    {/* Admin Reply Section */}
                    {fb.adminReply ? (
                      <div className="bg-blue-50/70 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/50 p-4 rounded-2xl space-y-1.5">
                        <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-400">
                          <span className="flex items-center gap-1">
                            <Sparkles className="w-3 h-3 text-amber-500" /> Official Admin Response
                          </span>
                          {fb.repliedAt && (
                            <span>
                              {new Date(fb.repliedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                        </div>
                        <p className="text-xs font-semibold text-gray-800 dark:text-gray-200">
                          {fb.adminReply}
                        </p>
                        <button
                          onClick={() => {
                            setReplyingFeedbackId(fb.id);
                            setReplyText(fb.adminReply);
                          }}
                          className="text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:underline pt-1 inline-block"
                        >
                          Edit Response
                        </button>
                      </div>
                    ) : (
                      replyingFeedbackId !== fb.id && (
                        <button
                          onClick={() => {
                            setReplyingFeedbackId(fb.id);
                            setReplyText('');
                          }}
                          className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all shadow-md shadow-blue-500/20 flex items-center justify-center gap-2"
                        >
                          <MessageSquare className="w-4 h-4" /> Reply to Query / Feedback
                        </button>
                      )
                    )}

                    {/* Reply Input Form */}
                    {replyingFeedbackId === fb.id && (
                      <div className="bg-gray-50 dark:bg-gray-800/80 p-4 rounded-2xl border border-gray-200 dark:border-gray-700 space-y-3 animate-fadeIn">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest">
                            Send Official Text Response
                          </label>
                          <button
                            onClick={() => setReplyingFeedbackId(null)}
                            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                        <textarea
                          rows={3}
                          placeholder="Type your response to the user query..."
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-3 text-xs font-medium text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setReplyingFeedbackId(null)}
                            className="px-3 py-1.5 text-xs font-bold text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={async () => {
                              if (!replyText.trim()) return;
                              try {
                                await updateDoc(doc(db, 'feedback', fb.id), {
                                  adminReply: replyText.trim(),
                                  repliedAt: new Date().toISOString(),
                                  repliedBy: currentUser?.name || 'Super Admin',
                                  status: 'resolved'
                                });

                                if (fb.userId && fb.userId !== 'anonymous') {
                                  await addDoc(collection(db, 'notifications'), {
                                    userId: fb.userId,
                                    title: 'Response to your Query/Feedback',
                                    message: `Admin responded: "${replyText.trim()}"`,
                                    type: 'system',
                                    createdAt: new Date().toISOString(),
                                    read: false
                                  });
                                }

                                setReplyingFeedbackId(null);
                                setReplyText('');
                              } catch (err) {
                                console.error('Error sending reply:', err);
                              }
                            }}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-blue-500/20 flex items-center gap-1.5 uppercase tracking-wider"
                          >
                            <Send className="w-3.5 h-3.5" /> Send Response & Mark Resolved
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="pt-2 border-t border-gray-100 dark:border-gray-800 flex flex-wrap items-center justify-between text-[10px] font-bold text-gray-400 gap-2">
                      <div className="flex items-center gap-2">
                        <User className="w-3.5 h-3.5 text-gray-400" />
                        <span>{fb.userName || 'User'} ({fb.userEmail || fb.userId})</span>
                      </div>
                      <span>
                        {new Date(fb.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
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
              className="bg-white dark:bg-gray-900 w-full max-w-2xl rounded-[3rem] overflow-hidden shadow-2xl max-h-[90vh] flex flex-col"
            >
              <div className="p-8 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between shrink-0">
                <h3 className="text-2xl font-black text-gray-800 dark:text-gray-100 uppercase tracking-tight">
                  {editingStore ? 'Edit Store' : 'Add New Store'}
                </h3>
                <button onClick={() => setIsStoreModalOpen(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-all">
                  <X className="w-6 h-6 text-gray-400" />
                </button>
              </div>
              <div className="p-8 space-y-6 overflow-y-auto flex-1 custom-scrollbar">
                {/* District and Store ID section */}
                <div className="p-6 bg-blue-50/50 dark:bg-blue-950/20 rounded-3xl border border-blue-100 dark:border-blue-900/30 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-blue-900 dark:text-blue-200 uppercase tracking-wider">
                      Store Identification & District Selection
                    </span>
                    <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/50 px-2.5 py-1 rounded-lg">
                      Washwise Convention
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest ml-1">
                        District (Kerala)
                      </label>
                      <select
                        value={storeFormData.districtCode}
                        onChange={(e) => {
                          const newDist = e.target.value;
                          const seq = stores.length + (editingStore ? 0 : 1);
                          const suggested = generateStoreId(seq, newDist);
                          setStoreFormData({
                            ...storeFormData,
                            districtCode: newDist,
                            storeCode: newDist,
                            customStoreId: suggested
                          });
                        }}
                        className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl px-5 py-3.5 text-gray-800 dark:text-gray-100 font-bold outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm"
                      >
                        {KERALA_DISTRICTS.map((d) => (
                          <option key={d.code} value={d.code}>
                            {d.code} - {d.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest ml-1">
                        Store ID (Inputted by Super Admin)
                      </label>
                      <input 
                        type="text"
                        value={storeFormData.customStoreId}
                        onChange={(e) => setStoreFormData({ ...storeFormData, customStoreId: e.target.value.toUpperCase() })}
                        className="w-full bg-white dark:bg-gray-800 border border-blue-200 dark:border-blue-800/60 rounded-2xl px-5 py-3.5 text-blue-700 dark:text-blue-300 font-black font-mono tracking-wider outline-none focus:ring-2 focus:ring-blue-500 transition-all text-base"
                        placeholder="e.g. WW001KT"
                      />
                    </div>
                  </div>
                  <p className="text-[11px] text-blue-600/80 dark:text-blue-400/80 font-medium">
                    Naming rule: <strong>WW</strong> + 3-digit sequence number + District Code (e.g. <strong>WW001KT</strong> for 1st store in Kottayam). Super Admin can edit this ID directly.
                  </p>
                </div>

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
                      placeholder="e.g. Kottayam, Pampady"
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
                      value={Number.isNaN(storeFormData.latitude) ? '' : storeFormData.latitude}
                      onChange={(e) => setStoreFormData({ ...storeFormData, latitude: e.target.value === '' ? 0 : (parseFloat(e.target.value) || 0) })}
                      className="w-full bg-gray-50 dark:bg-gray-800 border-none rounded-2xl px-6 py-4 text-gray-800 dark:text-gray-100 font-bold outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Longitude</label>
                    <input 
                      type="number"
                      step="any"
                      value={Number.isNaN(storeFormData.longitude) ? '' : storeFormData.longitude}
                      onChange={(e) => setStoreFormData({ ...storeFormData, longitude: e.target.value === '' ? 0 : (parseFloat(e.target.value) || 0) })}
                      className="w-full bg-gray-50 dark:bg-gray-800 border-none rounded-2xl px-6 py-4 text-gray-800 dark:text-gray-100 font-bold outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                    />
                  </div>
                </div>

                <div className="p-6 bg-amber-50 dark:bg-amber-900/10 rounded-3xl border border-amber-100 dark:border-amber-900/20 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <AlertCircle className="w-5 h-5 text-amber-600" />
                      <span className="text-sm font-black text-amber-900 dark:text-amber-100 uppercase tracking-tight">Maintenance Mode</span>
                    </div>
                    <button 
                      onClick={() => setStoreFormData({ ...storeFormData, isPaused: !storeFormData.isPaused })}
                      className={`p-1 rounded-lg transition-all ${storeFormData.isPaused ? 'text-amber-600' : 'text-gray-400'}`}
                    >
                      {storeFormData.isPaused ? <ToggleRight className="w-8 h-8" /> : <ToggleLeft className="w-8 h-8" />}
                    </button>
                  </div>
                  {storeFormData.isPaused && (
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-amber-600 uppercase tracking-widest">Maintenance Message</label>
                      <input 
                        type="text"
                        value={storeFormData.maintenanceMessage}
                        onChange={(e) => setStoreFormData({ ...storeFormData, maintenanceMessage: e.target.value })}
                        className="w-full bg-white dark:bg-gray-900 border-none rounded-xl px-4 py-2 text-sm font-bold outline-none"
                        placeholder="Display message to customers"
                      />
                    </div>
                  )}
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
        {isMachineModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMachineModalOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md bg-white dark:bg-gray-900 rounded-[2.5rem] shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
            >
              <div className="p-8 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between shrink-0">
                <h3 className="text-2xl font-black text-gray-800 dark:text-gray-100 uppercase tracking-tight">
                  {editingMachine ? 'Edit Machine' : 'New Machine'}
                </h3>
                <button onClick={() => setIsMachineModalOpen(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-all">
                  <X className="w-6 h-6 text-gray-400" />
                </button>
              </div>

              <div className="p-8 space-y-6 overflow-y-auto flex-1 custom-scrollbar">
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Store</label>
                    <select 
                      value={machineFormData.storeId}
                      onChange={(e) => setMachineFormData({ ...machineFormData, storeId: e.target.value })}
                      className="w-full bg-gray-50 dark:bg-gray-800 border-none rounded-2xl px-6 py-4 text-gray-800 dark:text-gray-100 font-bold outline-none"
                    >
                      {stores.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Number</label>
                      <input 
                        type="number"
                        value={Number.isNaN(machineFormData.number) ? '' : machineFormData.number}
                        onChange={(e) => setMachineFormData({ ...machineFormData, number: e.target.value === '' ? 1 : (parseInt(e.target.value) || 1) })}
                        className="w-full bg-gray-50 dark:bg-gray-800 border-none rounded-2xl px-6 py-4 text-gray-800 dark:text-gray-100 font-bold outline-none"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Type</label>
                      <select 
                        value={machineFormData.type}
                        onChange={(e) => setMachineFormData({ ...machineFormData, type: e.target.value as any })}
                        className="w-full bg-gray-50 dark:bg-gray-800 border-none rounded-2xl px-6 py-4 text-gray-800 dark:text-gray-100 font-bold outline-none"
                      >
                        <option value="washer">Washer</option>
                        <option value="dryer">Dryer</option>
                      </select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Initial Status</label>
                    <select 
                      value={machineFormData.status}
                      onChange={(e) => setMachineFormData({ ...machineFormData, status: e.target.value as any })}
                      className="w-full bg-gray-50 dark:bg-gray-800 border-none rounded-2xl px-6 py-4 text-gray-800 dark:text-gray-100 font-bold outline-none"
                    >
                      <option value="idle">Idle</option>
                      <option value="maintenance">Maintenance</option>
                      <option value="unavailable">Unavailable</option>
                    </select>
                  </div>
                </div>

                <div className="mt-8 flex gap-4">
                  <button 
                    onClick={() => setIsMachineModalOpen(false)}
                    className="flex-1 py-4 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded-2xl font-bold hover:bg-gray-200 transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleSaveMachine}
                    className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 dark:shadow-none"
                  >
                    {editingMachine ? 'Update Machine' : 'Create Machine'}
                  </button>
                </div>
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
