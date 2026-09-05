import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { User, Mail, GraduationCap, Calendar, Settings, LogOut, Wallet, History, Shield, Loader2, CheckCircle, ArrowLeft, ArrowRight, AlertCircle, Trophy, Zap, Star, Gift, Copy, Share2, TrendingUp, X, Check, MapPin, Trash2, Edit3, PhoneCall, Plus, HelpCircle, MessageSquare, Send, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, orderBy, onSnapshot, doc, deleteDoc } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { Booking } from '../types';
import SubscriptionPlansModal from '../components/SubscriptionPlansModal';
import FeedbackModal from '../components/FeedbackModal';
import { ReferralCard } from '../components/ReferralCard';
import { useSettings } from '../context/SettingsContext';
import { getReferralShareUrl, getReferralShareText } from '../utils/referral';
import { ReferralRecord } from '../types';

const Profile: React.FC = () => {
  const { user, logout, updateUser } = useAuth();
  const { settings } = useSettings();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'profile' | 'wallet' | 'referrals' | 'history' | 'support'>('profile');
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);
  const [userFeedbacks, setUserFeedbacks] = useState<any[]>([]);
  const [loadingFeedbacks, setLoadingFeedbacks] = useState(false);

  // Referral states
  const [userReferrals, setUserReferrals] = useState<ReferralRecord[]>([]);
  const [loadingReferrals, setLoadingReferrals] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);

  const [isPlansModalOpen, setIsPlansModalOpen] = useState(false);
  const [showAddFundsModal, setShowAddFundsModal] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState<number>(200);
  const [topUpLoading, setTopUpLoading] = useState(false);
  const [topUpError, setTopUpError] = useState('');
  const [studentId, setStudentId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);
  
  // Account Deletion state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmInput, setDeleteConfirmInput] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(false);
  const [walletTransactions, setWalletTransactions] = useState<any[]>([]);
  const [loadingWalletTx, setLoadingWalletTx] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [editForm, setEditForm] = useState({
    name: user?.name || '',
    phone: user?.phone || '',
    address: user?.address || '',
  });

  useEffect(() => {
    if (user) {
      setEditForm({
        name: user.name || '',
        phone: user.phone || '',
        address: user.address || '',
      });
    }
  }, [user]);

  useEffect(() => {
    if (!user || activeTab !== 'wallet') return;
    
    setLoadingWalletTx(true);
    const q = query(
      collection(db, 'wallet_transactions'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const txs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setWalletTransactions(txs);
      setLoadingWalletTx(false);
    }, (error) => {
      console.error('Error loading wallet transactions:', error);
      setLoadingWalletTx(false);
    });
    
    return () => unsubscribe();
  }, [user, activeTab]);

  useEffect(() => {
    if (!user || activeTab !== 'history') return;
    
    setLoadingBookings(true);
    const q = query(
      collection(db, 'bookings'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const bookingsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Booking[];
      setBookings(bookingsData);
      setLoadingBookings(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'bookings');
      setLoadingBookings(false);
    });

    return () => unsubscribe();
  }, [user, activeTab]);

  useEffect(() => {
    if (!user || activeTab !== 'support') return;
    
    setLoadingFeedbacks(true);
    const q = query(
      collection(db, 'feedback'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setUserFeedbacks(list);
      setLoadingFeedbacks(false);
    }, (error) => {
      console.error('Error loading feedback:', error);
      setLoadingFeedbacks(false);
    });

    return () => unsubscribe();
  }, [user, activeTab]);

  useEffect(() => {
    if (!user || activeTab !== 'referrals') return;

    setLoadingReferrals(true);
    const q = query(
      collection(db, 'referrals'),
      where('referrerId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as ReferralRecord[];
      setUserReferrals(list);
      setLoadingReferrals(false);
    }, (error) => {
      console.error('Error loading referrals:', error);
      setLoadingReferrals(false);
    });

    return () => unsubscribe();
  }, [user, activeTab]);

  if (!user) return null;

  const handleTopUpWallet = async (amount: number) => {
    if (!user) return;
    setTopUpLoading(true);
    setTopUpError('');
    try {
      const response = await fetch('/api/payments/wallet-topup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.uid,
          amount,
          paymentMethod: 'card'
        })
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to top up wallet');
      }

      setTopUpLoading(false);
      setShowAddFundsModal(false);
      if (updateUser) {
        await updateUser({ walletBalance: data.newBalance });
      }
    } catch (err: any) {
      setTopUpLoading(false);
      setTopUpError(err.message || 'Top-up failed');
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const handleUpgrade = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentId) {
      setError('Please enter your Student ID');
      return;
    }

    setLoading(true);
    setError('');
    try {
      await updateUser({
        userType: 'subscriber',
        studentId: studentId,
        isRegistered: true
      });
      setIsUpgrading(false);
    } catch (err) {
      setError('Upgrade failed. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editForm.name.trim()) {
      setError('Please enter a valid name.');
      return;
    }
    setLoading(true);
    setError('');
    setSaveSuccess(false);
    try {
      const currentSavedAddresses = user?.savedAddresses || [];
      const newAddress = editForm.address.trim();
      let updatedSavedAddresses = currentSavedAddresses;
      if (newAddress && !currentSavedAddresses.includes(newAddress)) {
        updatedSavedAddresses = [...currentSavedAddresses, newAddress];
      }

      const currentSavedPhones = user?.savedPhones || [];
      const newPhone = editForm.phone.trim();
      let updatedSavedPhones = currentSavedPhones;
      if (newPhone && !currentSavedPhones.includes(newPhone)) {
        updatedSavedPhones = [...currentSavedPhones, newPhone];
      }

      await updateUser({
        name: editForm.name.trim(),
        phone: newPhone || user?.phone,
        address: newAddress || user?.address,
        savedAddresses: updatedSavedAddresses,
        savedPhones: updatedSavedPhones
      });
      setIsEditing(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 5000);
    } catch (err) {
      setError('Failed to update profile. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!user) return;
    setDeleteLoading(true);
    setDeleteError('');

    try {
      // 1. Call backend API to delete user from Auth & Firestore
      const response = await fetch('/api/auth/delete-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: user.uid }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to delete account on server');
      }

      // 2. Client-side Firestore delete fallback if needed
      try {
        await deleteDoc(doc(db, 'users', user.uid));
      } catch (e) {
        // Ignore if already deleted on server
      }

      // 3. Client Firebase Auth delete
      if (auth.currentUser) {
        try {
          await auth.currentUser.delete();
        } catch (authErr) {
          console.warn('Client Auth delete notice:', authErr);
        }
      }

      // 4. Clear auth state and redirect
      await logout();
      setShowDeleteModal(false);
      navigate('/login?deleted=true');
    } catch (err: any) {
      console.error('Error deleting account:', err);
      setDeleteError(err.message || 'Failed to delete account. Please try logging in again first.');
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 sm:py-20">
      <div className="flex flex-col lg:flex-row gap-6 lg:gap-16">
        {/* Sidebar Navigation */}
        <div className="w-full lg:w-72 shrink-0">
          <div className="sticky top-24 space-y-6 lg:space-y-10">
            <div className="px-2 sm:px-4">
              <h1 className="text-3xl sm:text-5xl font-display font-black text-gray-800 dark:text-high-contrast tracking-tighter uppercase leading-none mb-2 sm:mb-3">Account</h1>
              <p className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">Settings & Activity</p>
            </div>

            <nav className="flex lg:flex-col gap-2 overflow-x-auto pb-2 lg:pb-0 scrollbar-none">
              {[
                { id: 'profile', label: 'My Profile', icon: User },
                { id: 'wallet', label: 'Wallet', icon: Wallet },
                { id: 'referrals', label: 'Refer & Earn', icon: Gift },
                { id: 'history', label: 'Booking History', icon: History },
                { id: 'support', label: 'Queries & Feedback', icon: HelpCircle },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => { setActiveTab(tab.id as any); setIsUpgrading(false); }}
                  className={`flex-1 min-w-[120px] lg:w-full flex items-center justify-center lg:justify-start px-4 sm:px-8 py-3.5 sm:py-5 rounded-2xl transition-all duration-300 group haptic-feedback shrink-0 ${
                    activeTab === tab.id && !isUpgrading 
                      ? 'bg-primary-electric text-white shadow-xl shadow-primary-electric/20 dark:shadow-none' 
                      : 'text-gray-400 dark:text-gray-500 hover:bg-gray-50 dark:hover:bg-surface-low'
                  }`}
                >
                  <tab.icon className={`w-4 h-4 sm:w-5 sm:h-5 mr-2 sm:mr-4 transition-transform duration-300 ${activeTab === tab.id ? 'scale-110' : 'group-hover:scale-110'}`} />
                  <span className="font-black text-[10px] uppercase tracking-widest whitespace-nowrap">{tab.label}</span>
                </button>
              ))}
            </nav>

            <div className="hidden lg:block pt-10 px-4 border-t border-gray-100 dark:border-surface-low">
              <button
                onClick={handleLogout}
                className="w-full flex items-center px-8 py-5 rounded-2xl text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/10 transition-all duration-300 group haptic-feedback"
              >
                <LogOut className="w-5 h-5 mr-4 group-hover:-translate-x-1 transition-transform" />
                <span className="font-black text-[10px] uppercase tracking-widest">Logout</span>
              </button>
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 min-w-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab + (isUpgrading ? '-upgrade' : '')}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-white dark:bg-surface-container p-4 sm:p-8 md:p-16 rounded-2xl sm:rounded-[3rem] shadow-2xl shadow-black/5 dark:shadow-none border border-gray-50 dark:border-surface-low relative overflow-hidden"
            >
              {/* Decorative Background Element */}
              <div className="absolute -top-24 -right-24 w-64 h-64 bg-primary-electric/5 rounded-full blur-3xl pointer-events-none" />

              {activeTab === 'profile' && !isUpgrading && (
                <div className="space-y-6 sm:space-y-12 relative z-10">
                  {/* Save Success Alert */}
                  {saveSuccess && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="p-6 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded-2xl border border-green-200 dark:border-green-900/30 flex items-center gap-4"
                    >
                      <CheckCircle className="w-6 h-6 text-green-500 shrink-0" />
                      <div>
                        <p className="text-xs font-black uppercase tracking-widest">Profile Updated Successfully!</p>
                        <p className="text-[10px] font-medium opacity-80">Your name and address information have been saved.</p>
                      </div>
                    </motion.div>
                  )}

                  <div className="flex flex-col md:flex-row items-center md:items-start gap-12">
                    <div className="relative group">
                      <div className="w-40 h-40 bg-gray-50 dark:bg-surface-low rounded-3xl flex items-center justify-center text-primary-electric dark:text-primary-electric-light shadow-inner overflow-hidden">
                        <User className="w-20 h-20" />
                      </div>
                      <button 
                        onClick={() => {
                          setIsEditing(!isEditing);
                          setEditForm({
                            name: user.name || '',
                            phone: user.phone || '',
                            address: user.address || '',
                          });
                        }}
                        title="Edit Profile Details"
                        className={`absolute -bottom-3 -right-3 p-4 rounded-2xl shadow-2xl border transition-all haptic-feedback ${
                          isEditing 
                            ? 'bg-primary-electric text-white border-primary-electric' 
                            : 'bg-white dark:bg-surface-highest text-gray-400 border-gray-100 dark:border-surface-low hover:text-primary-electric'
                        }`}
                      >
                        <Edit3 className="w-6 h-6" />
                      </button>
                    </div>

                    <div className="text-center md:text-left pt-2 flex-1">
                      <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 mb-2">
                        <h2 className="text-4xl sm:text-5xl font-display font-black text-gray-800 dark:text-high-contrast tracking-tighter uppercase leading-none break-words">
                          {user.name || 'Anonymous User'}
                        </h2>
                        {!isEditing && (
                          <button
                            onClick={() => {
                              setIsEditing(true);
                              setEditForm({
                                name: user.name || '',
                                phone: user.phone || '',
                                address: user.address || '',
                              });
                            }}
                            className="px-4 py-2 bg-primary-electric/10 text-primary-electric hover:bg-primary-electric hover:text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all haptic-feedback"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            Edit Profile
                          </button>
                        )}
                      </div>

                      <div className="flex flex-wrap justify-center md:justify-start gap-4 mt-4">
                        <span className={`inline-flex items-center px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-widest border ${
                          (user.userType === 'subscriber' || !!user.subscriptionPaid)
                            ? 'bg-green-50 text-green-600 border-green-100 dark:bg-green-900/20 dark:text-green-400 dark:border-green-900/30' 
                            : 'bg-gray-50 text-gray-400 border-gray-100 dark:bg-surface-low dark:text-gray-500 dark:border-surface-low'
                        }`}>
                          <Shield className="w-3 h-3 mr-2" />
                          {(user.userType === 'subscriber' || !!user.subscriptionPaid) ? 'Subscriber Account' : 'Guest Account'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {isEditing ? (
                    <form onSubmit={handleSaveProfile} className="space-y-8 bg-gray-50/50 dark:bg-surface-low/30 p-8 md:p-10 rounded-3xl border border-gray-100 dark:border-surface-low">
                      <div className="flex items-center justify-between pb-4 border-b border-gray-200/50 dark:border-surface-low">
                        <h3 className="text-xl font-display font-black text-gray-800 dark:text-high-contrast uppercase tracking-tight">Edit Profile & Address</h3>
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Update details below</span>
                      </div>

                      <div className="space-y-6">
                        <div>
                          <label className="block text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2 ml-1">
                            Full Name
                          </label>
                          <input
                            type="text"
                            required
                            value={editForm.name}
                            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                            className="w-full px-6 py-4 bg-white dark:bg-surface-low border border-gray-200 dark:border-surface-low rounded-2xl outline-none transition-all font-bold text-sm dark:text-high-contrast focus:ring-4 focus:ring-primary-electric/10"
                            placeholder="Enter your full name"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2 ml-1">
                            Address / Hostel Location
                          </label>
                          <textarea
                            rows={3}
                            value={editForm.address}
                            onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                            className="w-full px-6 py-4 bg-white dark:bg-surface-low border border-gray-200 dark:border-surface-low rounded-2xl outline-none transition-all font-medium text-sm dark:text-high-contrast focus:ring-4 focus:ring-primary-electric/10 resize-none"
                            placeholder="Enter full address or Hostel Name & Room Number (e.g. Block B, Room 302, Green Campus)"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2 ml-1">
                            Phone Number
                          </label>
                          <input
                            type="tel"
                            value={editForm.phone}
                            onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                            className="w-full px-6 py-4 bg-white dark:bg-surface-low border border-gray-200 dark:border-surface-low rounded-2xl outline-none transition-all font-bold text-sm dark:text-high-contrast focus:ring-4 focus:ring-primary-electric/10"
                            placeholder="Enter 10-digit mobile number"
                          />
                        </div>
                      </div>

                      {error && (
                        <div className="flex items-center gap-4 p-5 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-2xl border border-red-100 dark:border-red-900/30">
                          <AlertCircle className="w-5 h-5 shrink-0" />
                          <p className="text-xs font-black uppercase tracking-widest">{error}</p>
                        </div>
                      )}

                      <div className="flex gap-4 pt-2">
                        <button
                          type="submit"
                          disabled={loading}
                          className="flex-1 py-5 bg-primary-electric text-white text-xs font-black uppercase tracking-widest rounded-2xl hover:bg-primary-electric/90 transition-all shadow-xl shadow-primary-electric/20 dark:shadow-none flex items-center justify-center disabled:opacity-50 haptic-feedback"
                        >
                          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Save Profile Changes'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsEditing(false)}
                          className="px-8 py-5 bg-white dark:bg-surface-low border border-gray-200 dark:border-surface-low text-gray-600 dark:text-gray-300 text-xs font-black uppercase tracking-widest rounded-2xl hover:bg-gray-100 dark:hover:bg-surface-highest transition-all haptic-feedback"
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Full Name Card */}
                      <div className="p-8 bg-gray-50/30 dark:bg-surface-low/30 rounded-3xl border border-gray-50 dark:border-surface-low group hover:border-primary-electric/20 transition-all duration-300 flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between mb-3">
                            <p className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">Full Name</p>
                            <button
                              onClick={() => {
                                setIsEditing(true);
                                setEditForm({ name: user.name || '', phone: user.phone || '', address: user.address || '' });
                              }}
                              className="text-xs font-bold text-primary-electric hover:underline flex items-center gap-1"
                            >
                              <Edit3 className="w-3 h-3" />
                              Change
                            </button>
                          </div>
                          <div className="flex items-center text-gray-800 dark:text-high-contrast">
                            <div className="p-3 bg-white dark:bg-surface-highest rounded-2xl mr-4 shadow-sm text-primary-electric">
                              <User className="w-5 h-5" />
                            </div>
                            <span className="text-lg font-display font-black tracking-tight uppercase break-words">{user.name || 'Not set'}</span>
                          </div>
                        </div>
                      </div>

                      {/* Address Card */}
                      <div className="p-8 bg-gray-50/30 dark:bg-surface-low/30 rounded-3xl border border-gray-50 dark:border-surface-low group hover:border-primary-electric/20 transition-all duration-300 flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between mb-3">
                            <p className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">Delivery Addresses</p>
                            <button
                              onClick={() => {
                                setIsEditing(true);
                                setEditForm({ name: user.name || '', phone: user.phone || '', address: '' });
                              }}
                              className="text-xs font-bold text-primary-electric hover:underline flex items-center gap-1"
                            >
                              <Plus className="w-3 h-3" />
                              Add Address
                            </button>
                          </div>
                          
                          <div className="space-y-4 mt-4">
                            {Array.from(new Set([...(user?.savedAddresses || []), user?.address].filter(Boolean))).length > 0 ? (
                              Array.from(new Set([...(user?.savedAddresses || []), user?.address].filter(Boolean))).map((addr: string, i) => (
                                <div key={i} className="flex items-start text-gray-800 dark:text-high-contrast bg-white dark:bg-surface-highest p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-surface-low relative group/addr">
                                  <div className="p-2 bg-primary-electric/10 rounded-xl mr-4 text-primary-electric shrink-0">
                                    <MapPin className="w-5 h-5" />
                                  </div>
                                  <div className="flex-1">
                                    <span className="text-sm font-bold tracking-tight text-gray-700 dark:text-gray-200 leading-relaxed block">{addr}</span>
                                  </div>
                                  <button 
                                    onClick={async (e) => {
                                      e.stopPropagation();
                                      const currentSaved = user?.savedAddresses || [];
                                      const updatedSaved = currentSaved.filter(a => a !== addr);
                                      const newPrimary = user?.address === addr ? (updatedSaved[0] || '') : user?.address;
                                      if (updateUser) {
                                        await updateUser({ savedAddresses: updatedSaved, address: newPrimary });
                                      }
                                    }}
                                    className="opacity-0 group-hover/addr:opacity-100 p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all absolute right-2 top-2"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              ))
                            ) : (
                              <div className="flex items-start text-gray-800 dark:text-high-contrast">
                                <div className="p-3 bg-white dark:bg-surface-highest rounded-2xl mr-4 shadow-sm text-primary-electric shrink-0">
                                  <MapPin className="w-5 h-5" />
                                </div>
                                <div>
                                  <span className="text-sm font-semibold text-gray-400 dark:text-gray-500 block mb-2">No addresses added yet</span>
                                  <button
                                    onClick={() => {
                                      setIsEditing(true);
                                      setEditForm({ name: user.name || '', phone: user.phone || '', address: '' });
                                    }}
                                    className="px-4 py-2 bg-primary-electric text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-primary-electric/90 transition-all shadow-md"
                                  >
                                    + Add Address
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Email Card */}
                      <div className="p-8 bg-gray-50/30 dark:bg-surface-low/30 rounded-3xl border border-gray-50 dark:border-surface-low group hover:border-primary-electric/20 transition-all duration-300">
                        <p className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3">Email Address</p>
                        <div className="flex items-center text-gray-800 dark:text-high-contrast">
                          <div className="p-3 bg-white dark:bg-surface-highest rounded-2xl mr-4 shadow-sm text-primary-electric">
                            <Mail className="w-5 h-5" />
                          </div>
                          <span className="text-base font-display font-black tracking-tight break-all">{user.email}</span>
                        </div>
                      </div>

                      {/* Phone Card */}
                      <div className="p-8 bg-gray-50/30 dark:bg-surface-low/30 rounded-3xl border border-gray-50 dark:border-surface-low group hover:border-primary-electric/20 transition-all duration-300">
                        <div className="flex items-center justify-between mb-3">
                          <p className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">Phone Numbers</p>
                          <button
                            onClick={() => {
                              setIsEditing(true);
                              setEditForm({ name: user.name || '', phone: '', address: user.address || '' });
                            }}
                            className="text-xs font-bold text-primary-electric hover:underline flex items-center gap-1"
                          >
                            <Plus className="w-3 h-3" />
                            Add Phone
                          </button>
                        </div>
                        
                        <div className="space-y-4 mt-4">
                          {Array.from(new Set([...(user?.savedPhones || []), user?.phone].filter(Boolean))).length > 0 ? (
                            Array.from(new Set([...(user?.savedPhones || []), user?.phone].filter(Boolean))).map((ph: string, i) => (
                              <div key={i} className="flex items-center text-gray-800 dark:text-high-contrast bg-white dark:bg-surface-highest p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-surface-low relative group/phone">
                                <div className="p-2 bg-primary-electric/10 rounded-xl mr-4 text-primary-electric shrink-0">
                                  <PhoneCall className="w-5 h-5" />
                                </div>
                                <div className="flex-1">
                                  <span className="text-lg font-display font-black tracking-tight uppercase">{ph}</span>
                                </div>
                                <button 
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    const currentSaved = user?.savedPhones || [];
                                    const updatedSaved = currentSaved.filter(p => p !== ph);
                                    const newPrimary = user?.phone === ph ? (updatedSaved[0] || '') : user?.phone;
                                    if (updateUser) {
                                      await updateUser({ savedPhones: updatedSaved, phone: newPrimary });
                                    }
                                  }}
                                  className="opacity-0 group-hover/phone:opacity-100 p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all absolute right-2"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            ))
                          ) : (
                            <div className="flex items-center text-gray-800 dark:text-high-contrast">
                              <div className="p-3 bg-white dark:bg-surface-highest rounded-2xl mr-4 shadow-sm text-primary-electric shrink-0">
                                <PhoneCall className="w-5 h-5" />
                              </div>
                              <div>
                                <span className="text-sm font-semibold text-gray-400 dark:text-gray-500 block mb-2">No phone numbers added yet</span>
                                <button
                                  onClick={() => {
                                    setIsEditing(true);
                                    setEditForm({ name: user.name || '', phone: '', address: user.address || '' });
                                  }}
                                  className="px-4 py-2 bg-primary-electric text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-primary-electric/90 transition-all shadow-md"
                                >
                                  + Add Phone
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {user.studentId && (
                        <div className="p-8 bg-gray-50/30 dark:bg-surface-low/30 rounded-3xl border border-gray-50 dark:border-surface-low">
                          <p className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3">Student ID</p>
                          <div className="flex items-center text-gray-800 dark:text-high-contrast">
                            <div className="p-3 bg-white dark:bg-surface-highest rounded-2xl mr-4 shadow-sm text-primary-electric">
                              <GraduationCap className="w-5 h-5" />
                            </div>
                            <span className="text-lg font-display font-black tracking-tight uppercase">{user.studentId}</span>
                          </div>
                        </div>
                      )}

                      <div className="p-8 bg-gray-50/30 dark:bg-surface-low/30 rounded-3xl border border-gray-50 dark:border-surface-low">
                        <p className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3">Member Since</p>
                        <div className="flex items-center text-gray-800 dark:text-high-contrast">
                          <div className="p-3 bg-white dark:bg-surface-highest rounded-2xl mr-4 shadow-sm text-primary-electric">
                            <Calendar className="w-5 h-5" />
                          </div>
                          <span className="text-lg font-display font-black tracking-tight uppercase">{new Date(user.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Account Settings / Danger Zone Section */}
                  <div className="pt-8 border-t border-gray-100 dark:border-surface-low">
                    <div className="p-8 md:p-10 bg-red-50/50 dark:bg-red-950/20 rounded-3xl border border-red-100 dark:border-red-900/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Trash2 className="w-5 h-5 text-red-600 dark:text-red-400" />
                          <h3 className="text-lg font-display font-black text-red-700 dark:text-red-400 uppercase tracking-tight">
                            Delete Account
                          </h3>
                        </div>
                        <p className="text-xs text-gray-600 dark:text-gray-400 max-w-xl font-medium leading-relaxed">
                          Permanently delete your profile, saved address, booking history, and wallet data. This action cannot be undone.
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          setShowDeleteModal(true);
                          setDeleteError('');
                          setDeleteConfirmInput('');
                        }}
                        className="px-6 py-3.5 bg-red-600 hover:bg-red-700 text-white text-xs font-black uppercase tracking-widest rounded-2xl transition-all shadow-lg shadow-red-600/20 shrink-0 flex items-center gap-2 haptic-feedback"
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete Account
                      </button>
                    </div>
                  </div>

                  {/* No Referral Card Needed for Utility Model */}

                  {(user.userType === 'subscriber' || !!user.subscriptionPaid) && (
                    <div className="relative p-4 sm:p-8 md:p-10 bg-gradient-to-br from-blue-900 via-indigo-900 to-slate-900 rounded-2xl sm:rounded-[2.5rem] text-white overflow-hidden shadow-2xl border border-blue-500/30">
                      <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
                      <div className="relative z-10 space-y-4 sm:space-y-8">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 border-b border-white/10 pb-4 sm:pb-6">
                          <div className="flex items-center gap-3 sm:gap-4">
                            <div className="p-2.5 sm:p-4 bg-blue-500/20 rounded-xl sm:rounded-2xl border border-blue-400/30 shrink-0">
                              <Trophy className="w-5 h-5 sm:w-8 sm:h-8 text-blue-400" />
                            </div>
                            <div>
                              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                                <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-blue-400 bg-blue-500/20 px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full border border-blue-400/30">
                                  Subscriber
                                </span>
                                <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-green-400 bg-green-500/20 px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full border border-green-400/30">
                                  Active
                                </span>
                              </div>
                              <h3 className="text-lg sm:text-2xl font-display font-black uppercase tracking-tight text-white mt-0.5 sm:mt-1">
                                {user.package ? `${user.package.toUpperCase()} PLAN` : 'BASIC PLAN'}
                              </h3>
                            </div>
                          </div>
                          <button
                            onClick={() => setIsPlansModalOpen(true)}
                            className="px-4 py-2 sm:px-5 sm:py-2.5 bg-white/10 hover:bg-white/20 text-white text-[11px] sm:text-xs font-black uppercase tracking-wider rounded-xl border border-white/20 transition-all flex items-center justify-center gap-2 shrink-0 self-start sm:self-center"
                          >
                            <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                            <span>Manage Plan</span>
                          </button>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-5">
                          {/* KILOS LEFT CARD */}
                          <div className="p-4 sm:p-6 bg-white/10 backdrop-blur-md rounded-xl sm:rounded-2xl border border-white/10 flex flex-col justify-between space-y-3 sm:space-y-4">
                            <div>
                              <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-blue-200 mb-1 sm:mb-2">Kilos Left Balance</p>
                              <div className="flex items-baseline gap-2">
                                <span className="text-3xl sm:text-5xl font-display font-black text-white tracking-tighter">
                                  {user.kilosLeft !== undefined && user.kilosLeft !== null && !isNaN(user.kilosLeft) ? user.kilosLeft : 12}
                                </span>
                                <span className="text-sm sm:text-lg font-black text-blue-300 uppercase">KG</span>
                              </div>
                            </div>
                            <div className="pt-2.5 sm:pt-4 border-t border-white/10 flex items-center justify-between gap-2 text-[11px] sm:text-xs text-blue-200 font-medium">
                              <span>Monthly: 12 KG</span>
                              <span className="text-green-400 font-bold bg-green-500/10 px-2 py-0.5 rounded-lg border border-green-500/20">
                                {Math.round(((user.kilosLeft ?? 12) / 12) * 100)}% Capacity Left
                              </span>
                            </div>
                          </div>

                          {/* SUBSCRIPTION START DATE */}
                          <div className="p-4 sm:p-6 bg-white/10 backdrop-blur-md rounded-xl sm:rounded-2xl border border-white/10 flex flex-col justify-between space-y-3 sm:space-y-4">
                            <div>
                              <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-blue-200 mb-1 sm:mb-2">Subscription Activated</p>
                              <p className="text-base sm:text-xl font-display font-black text-white uppercase">
                                {user.subscriptionStartDate ? new Date(user.subscriptionStartDate).toLocaleDateString() : 'Active Member'}
                              </p>
                            </div>
                            <div className="pt-2.5 sm:pt-4 border-t border-white/10 text-[11px] sm:text-xs text-blue-200 font-medium flex items-center gap-2">
                              <CheckCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-green-400 shrink-0" />
                              <span>Zero Additional Charge for Booking</span>
                            </div>
                          </div>

                          {/* SUBSCRIBER PERKS */}
                          <div className="p-4 sm:p-6 bg-white/10 backdrop-blur-md rounded-xl sm:rounded-2xl border border-white/10 flex flex-col justify-between space-y-3 sm:space-y-4">
                            <div>
                              <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-blue-200 mb-1 sm:mb-2">Subscriber Privileges</p>
                              <ul className="text-[11px] sm:text-xs text-blue-100 space-y-1.5 sm:space-y-2 font-medium">
                                <li className="flex items-center gap-2">
                                  <Check className="w-3.5 h-3.5 text-green-400 shrink-0" />
                                  <span>Free Doorstep Pickup & Drop</span>
                                </li>
                                <li className="flex items-center gap-2">
                                  <Check className="w-3.5 h-3.5 text-green-400 shrink-0" />
                                  <span>Auto Kilos Deduction on Wash</span>
                                </li>
                              </ul>
                            </div>
                            <button
                              onClick={() => navigate('/dashboard')}
                              className="w-full py-3 px-4 bg-blue-500 hover:bg-blue-600 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-blue-500/30 flex items-center justify-center gap-2 haptic-feedback"
                            >
                              <span>Book Laundry Wash</span>
                              <ArrowRight className="w-4 h-4 shrink-0" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {!(user.userType === 'subscriber' || !!user.subscriptionPaid) && (user.laundryCredits && user.laundryCredits > 0) && (
                    <div className="relative p-6 sm:p-8 bg-gradient-to-br from-emerald-600 via-teal-700 to-slate-900 rounded-2xl sm:rounded-[2.5rem] text-white overflow-hidden shadow-2xl border border-emerald-400/30">
                      <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-400/10 rounded-full blur-3xl pointer-events-none" />
                      <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                          <div className="p-3 sm:p-4 bg-emerald-500/20 rounded-2xl border border-emerald-400/30 shrink-0">
                            <Gift className="w-6 h-6 sm:w-8 sm:h-8 text-emerald-300" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-300 bg-emerald-500/20 px-3 py-0.5 rounded-full border border-emerald-400/30">
                                Promotional & Referral Credits
                              </span>
                            </div>
                            <h3 className="text-xl sm:text-2xl font-display font-black uppercase tracking-tight text-white mt-1">
                              {user.laundryCredits} Free Laundry Credits
                            </h3>
                            <p className="text-xs text-emerald-100 font-medium mt-0.5">
                              Equivalent to approx. {((user.laundryCredits || 0) / 10).toFixed(1)} kg wash • Usable on any wash booking
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => navigate('/dashboard')}
                          className="px-6 py-3 bg-white text-emerald-800 hover:bg-emerald-50 font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 shrink-0"
                        >
                          <span>Redeem on Wash</span>
                          <ArrowRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}

                  {!(user.userType === 'subscriber' || !!user.subscriptionPaid) && (
                    <div className="relative p-6 sm:p-12 md:p-16 bg-primary-electric rounded-2xl sm:rounded-[3rem] text-white overflow-hidden shadow-2xl shadow-primary-electric/20 dark:shadow-none group">
                      <div className="absolute top-0 right-0 p-6 sm:p-12 opacity-10 rotate-12 group-hover:scale-110 transition-transform duration-1000">
                        <Zap className="w-40 sm:w-72 h-40 sm:h-72" />
                      </div>
                      <div className="relative z-10">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 sm:gap-10 mb-8 sm:mb-12">
                          <div className="flex items-center gap-4 sm:gap-6">
                            <div className="p-3 sm:p-5 bg-white/20 rounded-xl sm:rounded-2xl backdrop-blur-md shrink-0">
                              <Trophy className="w-6 h-6 sm:w-10 sm:h-10" />
                            </div>
                            <div>
                              <h3 className="text-2xl sm:text-4xl font-display font-black uppercase tracking-tighter leading-none mb-1 sm:mb-2">Go Premium</h3>
                              <p className="text-[9px] sm:text-[10px] font-black text-white/60 uppercase tracking-widest">Basic Plan: 12kg Monthly Capacity</p>
                            </div>
                          </div>
                          <div className="text-left md:text-right">
                            <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-white/60 mb-1 sm:mb-2">Starting at</p>
                            <div className="flex items-baseline md:justify-end gap-2">
                              <span className="text-3xl sm:text-5xl font-display font-black tracking-tighter italic">₹421</span>
                              <span className="text-xs sm:text-sm font-black opacity-60">/mo</span>
                            </div>
                            <p className="text-[9px] sm:text-[10px] font-black text-white/40 italic mt-0.5 sm:mt-1">(₹39 × 12kg - 10% Off)</p>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-8 mb-8 sm:mb-12">
                          {[
                            { title: '12kg Capacity', desc: 'Perfect for regular laundry needs', icon: Zap },
                            { title: 'Exclusive Discounts', desc: 'Save up to 20% on every wash', icon: Star },
                            { title: 'Advance Booking', desc: 'Book slots up to 7 days in advance', icon: Calendar },
                            { title: 'Free Pickup/Drop', desc: 'Complimentary laundry concierge', icon: Shield },
                          ].map((benefit, i) => (
                            <div key={i} className="flex items-start gap-3 sm:gap-5 p-4 sm:p-6 bg-white/10 rounded-xl sm:rounded-2xl backdrop-blur-sm border border-white/10 group/benefit">
                              <div className="p-2.5 sm:p-3 bg-white/20 rounded-lg sm:rounded-xl group-hover/benefit:scale-110 transition-transform shrink-0">
                                <benefit.icon className="w-4 h-4 sm:w-6 sm:h-6" />
                              </div>
                              <div>
                                <p className="font-display font-black text-xs sm:text-base uppercase tracking-tight mb-0.5 sm:mb-1">{benefit.title}</p>
                                <p className="text-[11px] sm:text-xs text-white/60 leading-relaxed font-medium">{benefit.desc}</p>
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className="flex flex-col sm:flex-row gap-6">
                          <button 
                            onClick={() => navigate('/billing?type=subscription&packageId=basic')}
                            className="flex-1 px-10 py-6 bg-white text-primary-electric text-[10px] font-black uppercase tracking-widest rounded-2xl hover:bg-gray-50 transition-all shadow-2xl shadow-black/20 active:scale-95 flex items-center justify-center gap-4 haptic-feedback"
                          >
                            Buy Basic Plan
                            <ArrowRight className="w-5 h-5" />
                          </button>
                          <button 
                            onClick={() => setIsPlansModalOpen(true)}
                            className="flex-1 px-10 py-6 bg-white/10 text-white text-[10px] font-black uppercase tracking-widest rounded-2xl hover:bg-white/20 transition-all border border-white/20 active:scale-95 flex items-center justify-center gap-4 haptic-feedback"
                          >
                            Explore All Plans
                            <ArrowRight className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'profile' && isUpgrading && (
                <div className="space-y-12 relative z-10">
                  <div className="flex items-center gap-8">
                    <button 
                      onClick={() => setIsUpgrading(false)}
                      className="p-5 bg-gray-50 dark:bg-surface-low hover:bg-gray-100 dark:hover:bg-surface-highest rounded-2xl transition-all group haptic-feedback"
                    >
                      <ArrowLeft className="w-8 h-8 text-gray-400 group-hover:-translate-x-1 transition-transform" />
                    </button>
                    <div>
                      <h2 className="text-4xl font-display font-black text-gray-800 dark:text-high-contrast tracking-tighter uppercase leading-none">Verify Status</h2>
                      <p className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mt-2">Student Subscription</p>
                    </div>
                  </div>

                  <form onSubmit={handleUpgrade} className="space-y-10 max-w-md">
                    <div className="space-y-4">
                      <label className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Enter Student ID</label>
                      <div className="relative group">
                        <GraduationCap className="absolute left-6 top-1/2 -translate-y-1/2 w-7 h-7 text-gray-400 group-focus-within:text-primary-electric transition-colors" />
                        <input
                          type="text"
                          required
                          value={studentId}
                          onChange={(e) => setStudentId(e.target.value)}
                          placeholder="e.g. STU12345"
                          className="w-full pl-16 pr-8 py-6 bg-gray-50 dark:bg-surface-low border-none rounded-2xl outline-none transition-all font-black uppercase tracking-widest text-lg dark:text-high-contrast focus:ring-4 focus:ring-primary-electric/10"
                        />
                      </div>
                      <div className="flex items-start gap-3 ml-1">
                        <AlertCircle className="w-5 h-5 text-primary-electric shrink-0 mt-0.5" />
                        <p className="text-[10px] text-gray-400 dark:text-gray-500 font-black uppercase tracking-widest leading-relaxed">Verification is required to access student-only pricing and benefits.</p>
                      </div>
                    </div>

                    {error && (
                      <motion.div 
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex items-center gap-4 p-6 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-2xl border border-red-100 dark:border-red-900/30"
                      >
                        <AlertCircle className="w-6 h-6" />
                        <p className="text-[10px] font-black uppercase tracking-widest">{error}</p>
                      </motion.div>
                    )}

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full py-7 bg-primary-electric text-white text-[10px] font-black uppercase tracking-widest rounded-2xl hover:bg-primary-electric/90 transition-all shadow-2xl shadow-primary-electric/20 dark:shadow-none flex items-center justify-center disabled:opacity-50 haptic-feedback"
                    >
                      {loading ? <Loader2 className="w-7 h-7 animate-spin" /> : 'Activate Subscription'}
                    </button>
                  </form>
                </div>
              )}

              {activeTab === 'wallet' && (
                <div className="space-y-16 relative z-10">
                  <div className="relative p-16 bg-white dark:bg-surface-highest rounded-[3rem] text-gray-900 dark:text-white shadow-2xl overflow-hidden group border border-gray-100 dark:border-white/10">
                    {/* Card Pattern Overlay */}
                    <div className="absolute inset-0 opacity-10 pointer-events-none">
                      <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white/20 via-transparent to-transparent" />
                    </div>
                    
                    <div className="relative z-10">
                      <div className="flex justify-between items-start mb-20">
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-500 mb-3">Available Balance</p>
                          <h2 className="text-7xl font-display font-black tracking-tighter italic leading-none">₹{user.walletBalance || 0}<span className="text-3xl opacity-30">.00</span></h2>
                        </div>
                        <div className="w-20 h-12 bg-primary-electric rounded-xl shadow-2xl shadow-primary-electric/40" />
                      </div>
                      
                      <div className="flex flex-col sm:flex-row gap-6">
                        <button 
                          onClick={() => setShowAddFundsModal(true)}
                          className="flex-1 py-6 bg-primary-electric text-white text-[10px] font-black uppercase tracking-widest rounded-2xl hover:bg-primary-electric/90 transition-all active:scale-95 haptic-feedback shadow-lg shadow-primary-electric/20"
                        >
                          Add Funds to Wallet
                        </button>
                        <button className="flex-1 py-6 bg-gray-100 dark:bg-white/10 text-gray-900 dark:text-white text-[10px] font-black uppercase tracking-widest rounded-2xl hover:bg-gray-200 dark:hover:bg-white/20 transition-all backdrop-blur-md active:scale-95 haptic-feedback">
                          Transfer
                        </button>
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-10 px-4">
                      <h3 className="text-3xl font-display font-black text-gray-800 dark:text-high-contrast tracking-tighter uppercase leading-none">Recent Activity</h3>
                      <button className="text-[10px] font-black text-primary-electric dark:text-primary-electric-light uppercase tracking-widest hover:underline haptic-feedback">View All</button>
                    </div>
                    <div className="space-y-6">
                      {loadingWalletTx ? (
                        <div className="flex flex-col items-center justify-center py-16">
                          <Loader2 className="w-8 h-8 animate-spin text-primary-electric" />
                          <p className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mt-4">Loading Transactions...</p>
                        </div>
                      ) : walletTransactions.length === 0 ? (
                        <div className="text-center py-16 bg-gray-50/30 dark:bg-surface-low/30 rounded-3xl border border-dashed border-gray-100 dark:border-surface-low">
                          <div className="p-8 bg-white dark:bg-surface-highest rounded-3xl w-24 h-24 flex items-center justify-center mx-auto mb-8 shadow-sm">
                            <Wallet className="w-12 h-12 text-gray-200 dark:text-gray-700" />
                          </div>
                          <p className="text-xl font-display font-black text-gray-800 dark:text-high-contrast tracking-tight uppercase">No Transactions</p>
                          <p className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mt-3">Add funds to see activity here</p>
                        </div>
                      ) : (
                        walletTransactions.map((tx, i) => (
                        <div key={i} className="flex items-center justify-between p-8 bg-gray-50/30 dark:bg-surface-low/30 rounded-3xl border border-gray-50 dark:border-surface-low group hover:border-primary-electric/20 transition-all duration-500">
                          <div className="flex items-center">
                            <div className={`p-5 rounded-2xl mr-8 transition-transform group-hover:scale-110 ${tx.amount > 0 ? 'bg-green-50 dark:bg-green-900/20 text-green-600' : 'bg-red-50 dark:bg-red-900/20 text-red-600'}`}>
                              <Wallet className="w-8 h-8" />
                            </div>
                            <div>
                              <p className="font-display font-black text-gray-800 dark:text-high-contrast uppercase text-base tracking-tight mb-1">{tx.description || tx.type}</p>
                              <p className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">
                                {new Date(tx.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                              </p>
                            </div>
                          </div>
                          <p className={`text-2xl font-display font-black tracking-tighter italic ${tx.amount > 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {tx.amount > 0 ? '+' : ''}₹{Math.abs(tx.amount)}
                          </p>
                        </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'history' && (
                <div className="space-y-12 relative z-10">
                  <div className="px-4">
                    <h3 className="text-4xl font-display font-black text-gray-800 dark:text-high-contrast tracking-tighter uppercase leading-none mb-3">History</h3>
                    <p className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">Your past laundry sessions</p>
                  </div>

                  <div className="space-y-8">
                    {loadingBookings ? (
                      <div className="flex flex-col items-center justify-center py-32 text-center">
                        <div className="relative mb-8">
                          <Loader2 className="w-16 h-16 animate-spin text-primary-electric" />
                          <div className="absolute inset-0 blur-2xl bg-primary-electric/20 animate-pulse" />
                        </div>
                        <p className="text-xl font-display font-black text-gray-800 dark:text-high-contrast tracking-tight uppercase">Retrieving Records</p>
                        <p className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mt-3">Just a moment...</p>
                      </div>
                    ) : bookings.length === 0 ? (
                      <div className="text-center py-32 bg-gray-50/30 dark:bg-surface-low/30 rounded-[3rem] border-2 border-dashed border-gray-100 dark:border-surface-low">
                        <div className="p-8 bg-white dark:bg-surface-highest rounded-3xl w-24 h-24 flex items-center justify-center mx-auto mb-8 shadow-sm">
                          <AlertCircle className="w-12 h-12 text-gray-200 dark:text-gray-700" />
                        </div>
                        <p className="text-2xl font-display font-black text-gray-800 dark:text-high-contrast tracking-tight uppercase">No Bookings Yet</p>
                        <p className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mt-3">Start your first wash today!</p>
                      </div>
                    ) : (
                      bookings.map((booking) => (
                        <div key={booking.id} className="p-10 bg-gray-50/30 dark:bg-surface-low/30 rounded-3xl border border-gray-50 dark:border-surface-low flex flex-col md:flex-row md:items-center justify-between gap-10 group hover:border-primary-electric/20 transition-all duration-500">
                          <div className="space-y-6">
                            <div className="flex flex-wrap items-center gap-4">
                              <span className="text-[10px] font-black text-primary-electric dark:text-primary-electric-light bg-primary-electric/5 dark:bg-primary-electric/10 px-4 py-2 rounded-full border border-primary-electric/10 uppercase tracking-widest">
                                ID: {booking.bookingId || booking.id?.slice(-6).toUpperCase()}
                              </span>
                              <span className={`text-[10px] font-black px-4 py-2 rounded-full uppercase tracking-widest border ${
                                booking.status === 'completed' ? 'bg-green-50 text-green-600 border-green-100' :
                                booking.status === 'rejected' ? 'bg-red-50 text-red-600 border-red-100' :
                                'bg-primary-electric/5 text-primary-electric border-primary-electric/10'
                              }`}>
                                {booking.status}
                              </span>
                            </div>
                            <div>
                              <p className="text-3xl font-display font-black text-gray-800 dark:text-high-contrast tracking-tight uppercase mb-2">{booking.serviceType}</p>
                              <div className="flex items-center text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">
                                <Calendar className="w-4 h-4 mr-3 text-primary-electric" />
                                {booking.date} <span className="mx-3 opacity-30">•</span> {booking.timeSlot}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-8">
                            <div className="text-right">
                              <p className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2">Total Paid</p>
                              <p className="text-3xl font-display font-black text-gray-800 dark:text-high-contrast tracking-tighter italic leading-none">₹{booking.price.toFixed(2)}</p>
                            </div>
                            <button 
                              onClick={() => {
                                setSelectedBooking(booking);
                                setShowDetailsModal(true);
                              }}
                              className="px-10 py-5 bg-white dark:bg-surface-highest border border-gray-100 dark:border-surface-low text-gray-800 dark:text-high-contrast text-[10px] font-black uppercase tracking-widest rounded-2xl hover:bg-gray-800 hover:text-white dark:hover:bg-white dark:hover:text-black transition-all shadow-sm haptic-feedback"
                            >
                              Details
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'support' && (
                <div className="space-y-8 relative z-10">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 dark:border-surface-low pb-6">
                    <div>
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-800/50 mb-2">
                        <Sparkles className="w-3 h-3" /> Customer Support & Feedback
                      </span>
                      <h3 className="text-3xl font-display font-black text-gray-800 dark:text-high-contrast tracking-tighter uppercase leading-none">
                        Queries & Feedback
                      </h3>
                      <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mt-1">
                        Have a question, issue, or feedback? Inform our team directly.
                      </p>
                    </div>

                    <button
                      onClick={() => setIsFeedbackModalOpen(true)}
                      className="px-6 py-4 bg-primary-electric text-white text-xs font-black uppercase tracking-widest rounded-2xl hover:bg-primary-electric/90 transition-all shadow-lg shadow-primary-electric/20 shrink-0 flex items-center justify-center gap-2"
                    >
                      <Plus className="w-4 h-4" /> Submit Query / Feedback
                    </button>
                  </div>

                  {/* Quick Action Card */}
                  <div className="bg-gradient-to-r from-blue-500 to-indigo-600 rounded-3xl p-6 sm:p-8 text-white shadow-xl flex flex-col sm:flex-row items-center justify-between gap-6">
                    <div className="space-y-2 text-center sm:text-left">
                      <h4 className="text-xl font-black uppercase tracking-tight flex items-center justify-center sm:justify-start gap-2">
                        Need Instant Help with a Booking? <HelpCircle className="w-5 h-5 text-yellow-300" />
                      </h4>
                      <p className="text-xs text-blue-100 max-w-xl font-medium">
                        Whether it is a machine issue, payment query, or timing change, share your details and our store manager will review it.
                      </p>
                    </div>
                    <button
                      onClick={() => setIsFeedbackModalOpen(true)}
                      className="px-6 py-3.5 bg-white text-blue-600 font-bold rounded-2xl hover:bg-blue-50 transition-all shadow-md text-xs uppercase tracking-wider shrink-0"
                    >
                      Write To Us
                    </button>
                  </div>

                  {/* List of Previous Feedbacks / Queries */}
                  <div>
                    <h4 className="text-lg font-black text-gray-800 dark:text-white uppercase tracking-tight mb-4">
                      Your Submitted Queries & Feedback
                    </h4>

                    {loadingFeedbacks ? (
                      <div className="flex flex-col items-center justify-center py-16">
                        <Loader2 className="w-8 h-8 animate-spin text-primary-electric" />
                        <p className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mt-4">
                          Loading submitted queries...
                        </p>
                      </div>
                    ) : userFeedbacks.length === 0 ? (
                      <div className="text-center py-12 bg-gray-50/50 dark:bg-surface-low/30 rounded-3xl border border-dashed border-gray-200 dark:border-surface-low p-6">
                        <MessageSquare className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                        <p className="text-base font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                          No Queries or Feedback Submitted Yet
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          Click "Submit Query / Feedback" above to inform us of any issue or suggestion.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {userFeedbacks.map((fb) => (
                          <div
                            key={fb.id}
                            className="p-5 sm:p-6 bg-gray-50 dark:bg-surface-low/50 rounded-2xl border border-gray-100 dark:border-surface-low space-y-3"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                                  {fb.category ? fb.category.replace('_', ' ') : 'Query'}
                                </span>
                                {fb.rating && (
                                  <span className="flex items-center text-xs font-bold text-amber-500 gap-1 bg-amber-50 dark:bg-amber-900/20 px-2.5 py-1 rounded-full">
                                    <Star className="w-3.5 h-3.5 fill-amber-400" /> {fb.rating}/5
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                                {new Date(fb.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                              </span>
                            </div>

                            {fb.subject && (
                              <h5 className="font-bold text-sm text-gray-900 dark:text-white">
                                {fb.subject}
                              </h5>
                            )}

                            <p className="text-xs font-medium text-gray-600 dark:text-gray-300 whitespace-pre-wrap">
                              {fb.message}
                            </p>

                            <div className="pt-1 flex items-center justify-between text-[10px] font-bold text-gray-400 border-t border-gray-100 dark:border-surface-low">
                              <span>Status: <span className="text-blue-600 dark:text-blue-400 uppercase">{fb.status || 'Received'}</span></span>
                              {fb.bookingId && <span>Booking ID: #{fb.bookingId.slice(-6).toUpperCase()}</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'referrals' && !isUpgrading && (
                <div className="space-y-8 sm:space-y-12 relative z-10">
                  {/* Hero Banner */}
                  <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-900 via-primary-electric to-[#3323cc] text-white p-6 sm:p-10 shadow-2xl">
                    <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-white/10 rounded-full blur-2xl pointer-events-none" />
                    
                    <div className="relative z-10 space-y-3 max-w-xl">
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-xs font-black uppercase tracking-wider">
                        <Gift className="w-3.5 h-3.5" /> WashWise Referral Network
                      </div>
                      <h2 className="text-2xl sm:text-4xl font-display font-black tracking-tight leading-tight">
                        Give ₹{settings?.referral?.refereeDiscountRupees ?? 50}, Earn {settings?.referral?.referrerCredits ?? 20} Credits + ₹{settings?.referral?.referrerWalletCash ?? 50}
                      </h2>
                      <p className="text-xs sm:text-sm text-indigo-100 font-medium leading-relaxed">
                        Share your referral code with college friends and hostel mates. When they complete their first wash, you automatically earn laundry credits and real wallet cash!
                      </p>
                    </div>
                  </div>

                  {/* Share Code Section */}
                  <div className="p-6 sm:p-8 bg-gray-50 dark:bg-surface-low rounded-3xl border border-gray-100 dark:border-surface-low space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <h3 className="text-sm font-black uppercase tracking-wider text-gray-900 dark:text-high-contrast">
                          Your Exclusive Referral Code
                        </h3>
                        <p className="text-xs text-gray-400">
                          Friends enter this code during signup to get ₹{settings?.referral?.refereeDiscountRupees ?? 50} OFF instantly.
                        </p>
                      </div>
                      <span className="text-xs font-black text-primary-electric flex items-center gap-1">
                        <Sparkles className="w-3.5 h-3.5" /> Unlimited Rewarded Invites
                      </span>
                    </div>

                    <div className="flex flex-col sm:flex-row items-center gap-3">
                      <div className="w-full flex-1 bg-white dark:bg-surface-highest border-2 border-dashed border-primary-electric/40 rounded-2xl py-4 px-6 flex items-center justify-between shadow-sm">
                        <span className="font-mono font-black text-2xl text-gray-900 dark:text-high-contrast tracking-widest">
                          {user.referralCode || 'WASHWISE'}
                        </span>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(user.referralCode || 'WASHWISE');
                            setCodeCopied(true);
                            setTimeout(() => setCodeCopied(false), 2500);
                          }}
                          className="p-2.5 text-primary-electric hover:bg-primary-electric/10 rounded-xl transition-all"
                          title="Copy Code"
                        >
                          {codeCopied ? <Check className="w-5 h-5 text-emerald-500" /> : <Copy className="w-5 h-5" />}
                        </button>
                      </div>

                      <div className="w-full sm:w-auto flex gap-2">
                        <button
                          onClick={() => {
                            const shareText = getReferralShareText(user.referralCode || 'WASHWISE', user.name);
                            const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`;
                            window.open(waUrl, '_blank');
                          }}
                          className="flex-1 sm:flex-none px-5 py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 transition-all"
                        >
                          <Share2 className="w-4 h-4" />
                          <span>WhatsApp</span>
                        </button>

                        <button
                          onClick={async () => {
                            const code = user.referralCode || 'WASHWISE';
                            const shareUrl = getReferralShareUrl(code);
                            const shareText = getReferralShareText(code, user.name);
                            if (navigator.share) {
                              try {
                                await navigator.share({
                                  title: 'WashWise Laundry Referral',
                                  text: shareText,
                                  url: shareUrl
                                });
                              } catch (e) {}
                            } else {
                              navigator.clipboard.writeText(shareUrl);
                              setCodeCopied(true);
                              setTimeout(() => setCodeCopied(false), 2500);
                            }
                          }}
                          className="flex-1 sm:flex-none px-5 py-4 bg-gray-900 dark:bg-surface-highest hover:bg-gray-800 text-white rounded-2xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all"
                        >
                          <Copy className="w-4 h-4" />
                          <span>Copy Link</span>
                        </button>
                      </div>
                    </div>

                    {codeCopied && (
                      <p className="text-center text-xs font-bold text-emerald-600 dark:text-emerald-400">
                        ✓ Referral code copied to clipboard!
                      </p>
                    )}
                  </div>

                  {/* Summary Metric Counters */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="p-6 rounded-3xl bg-indigo-50/60 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/30 text-center">
                      <div className="w-10 h-10 mx-auto mb-2 rounded-2xl bg-indigo-500/10 text-primary-electric flex items-center justify-center">
                        <User className="w-5 h-5" />
                      </div>
                      <div className="text-3xl font-display font-black text-gray-900 dark:text-high-contrast">
                        {userReferrals.length}
                      </div>
                      <div className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mt-1">
                        Friends Invited
                      </div>
                    </div>

                    <div className="p-6 rounded-3xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30 text-center">
                      <div className="w-10 h-10 mx-auto mb-2 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
                        <Zap className="w-5 h-5" />
                      </div>
                      <div className="text-3xl font-display font-black text-gray-900 dark:text-high-contrast">
                        {user.totalReferralCreditsEarned || (userReferrals.filter(r => r.status === 'completed').length * (settings?.referral?.referrerCredits ?? 20))}
                      </div>
                      <div className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mt-1">
                        Laundry Credits Earned
                      </div>
                    </div>

                    <div className="p-6 rounded-3xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 text-center">
                      <div className="w-10 h-10 mx-auto mb-2 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                        <Wallet className="w-5 h-5" />
                      </div>
                      <div className="text-3xl font-display font-black text-gray-900 dark:text-high-contrast">
                        ₹{user.totalReferralCashEarned || (userReferrals.filter(r => r.status === 'completed').length * (settings?.referral?.referrerWalletCash ?? 50))}
                      </div>
                      <div className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mt-1">
                        Wallet Cash Won
                      </div>
                    </div>
                  </div>

                  {/* Referral Ledger / Friends History */}
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-lg font-black text-gray-800 dark:text-white uppercase tracking-tight">
                        Invited Friends & Referral Status
                      </h4>
                      {userReferrals.filter(r => r.status === 'pending').length > 0 && (
                        <span className="text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 px-3 py-1 rounded-full">
                          {userReferrals.filter(r => r.status === 'pending').length} pending first wash
                        </span>
                      )}
                    </div>

                    {loadingReferrals ? (
                      <div className="flex flex-col items-center justify-center py-16">
                        <Loader2 className="w-8 h-8 animate-spin text-primary-electric" />
                        <p className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mt-4">
                          Loading referral history...
                        </p>
                      </div>
                    ) : userReferrals.length === 0 ? (
                      <div className="text-center py-12 bg-gray-50/50 dark:bg-surface-low/30 rounded-3xl border border-dashed border-gray-200 dark:border-surface-low p-6">
                        <Gift className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                        <p className="text-base font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                          No Friends Invited Yet
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          Share your code via WhatsApp to start accumulating laundry credits and wallet cash!
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {userReferrals.map((item) => (
                          <div
                            key={item.id}
                            className="p-5 bg-gray-50 dark:bg-surface-low/50 rounded-2xl border border-gray-100 dark:border-surface-low flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                          >
                            <div className="flex items-center gap-3.5">
                              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black ${
                                item.status === 'completed' 
                                  ? 'bg-emerald-500/10 text-emerald-600' 
                                  : 'bg-amber-500/10 text-amber-600'
                              }`}>
                                {item.status === 'completed' ? <CheckCircle className="w-5 h-5" /> : <Zap className="w-5 h-5" />}
                              </div>
                              <div>
                                <p className="font-bold text-sm text-gray-900 dark:text-high-contrast">
                                  {item.referredUserName || 'Friend'}
                                </p>
                                <p className="text-[11px] text-gray-400">
                                  Joined on {new Date(item.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center justify-between sm:justify-end gap-3">
                              {item.status === 'completed' ? (
                                <span className="inline-flex items-center gap-1.5 font-black text-emerald-700 dark:text-emerald-300 bg-emerald-100/80 dark:bg-emerald-950/40 px-3 py-1.5 rounded-xl text-xs uppercase tracking-wider">
                                  ✓ +{item.rewardCredits || 20} Credits & +₹{item.rewardWalletCash || 50} Cash
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 font-bold text-amber-700 dark:text-amber-300 bg-amber-100/80 dark:bg-amber-950/40 px-3 py-1.5 rounded-xl text-xs uppercase tracking-wider">
                                  ⏳ Awaiting First Wash Order
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          {/* Feedback Modal for User Profile */}
          <FeedbackModal
            isOpen={isFeedbackModalOpen}
            onClose={() => setIsFeedbackModalOpen(false)}
            title="Help, Queries & Feedback"
            subtitle="Send us your questions, report issues, or provide feedback."
            isOptional={false}
          />
        </div>
      </div>
      <AnimatePresence>
        {showDetailsModal && selectedBooking && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowDetailsModal(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-xl"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-2xl bg-white dark:bg-surface-container rounded-[3rem] shadow-2xl overflow-hidden border border-gray-100 dark:border-surface-low"
            >
              <div className="p-12 md:p-16">
                <div className="flex justify-between items-start mb-12">
                  <div>
                    <h2 className="text-4xl font-display font-black text-gray-800 dark:text-high-contrast tracking-tighter uppercase leading-none mb-3">Booking Details</h2>
                    <p className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">Booking ID: {selectedBooking.bookingId || selectedBooking.id?.toUpperCase()}</p>
                  </div>
                  <button 
                    onClick={() => setShowDetailsModal(false)}
                    className="p-4 bg-gray-50 dark:bg-surface-low hover:bg-gray-100 dark:hover:bg-surface-highest rounded-2xl transition-all haptic-feedback"
                  >
                    <X className="w-6 h-6 text-gray-400" />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-10 mb-12">
                  {[
                    { label: 'Service Type', value: selectedBooking.serviceType, icon: Zap },
                    { label: 'Date & Time', value: `${selectedBooking.date} • ${selectedBooking.timeSlot}`, icon: Calendar },
                    { label: 'Status', value: selectedBooking.status, icon: Shield, color: selectedBooking.status === 'completed' ? 'text-green-500' : 'text-primary-electric' },
                    { label: 'Total Amount', value: `₹${selectedBooking.price.toFixed(2)}`, icon: Wallet },
                  ].map((item, i) => (
                    <div key={i} className="p-8 bg-gray-50/30 dark:bg-surface-low/30 rounded-3xl border border-gray-50 dark:border-surface-low">
                      <p className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-4">{item.label}</p>
                      <div className="flex items-center gap-4">
                        <item.icon className={`w-6 h-6 ${item.color || 'text-primary-electric'}`} />
                        <span className="text-xl font-display font-black text-gray-800 dark:text-high-contrast tracking-tight uppercase">{item.value}</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="p-10 bg-primary-electric/5 dark:bg-primary-electric/10 rounded-3xl border border-primary-electric/10 mb-12">
                  <div className="flex items-center gap-6">
                    <div className="p-4 bg-primary-electric text-white rounded-2xl">
                      <AlertCircle className="w-8 h-8" />
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-primary-electric dark:text-primary-electric-light uppercase tracking-widest mb-2">Need Help?</p>
                      <p className="text-sm font-medium text-gray-600 dark:text-gray-400 leading-relaxed">If you have any issues with this booking, please contact our support team with your Transaction ID.</p>
                    </div>
                  </div>
                </div>

                <button 
                  onClick={() => setShowDetailsModal(false)}
                  className="w-full py-7 bg-gray-900 dark:bg-surface-highest text-white text-[10px] font-black uppercase tracking-widest rounded-2xl hover:bg-black dark:hover:bg-white dark:hover:text-black transition-all haptic-feedback"
                >
                  Close Details
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <SubscriptionPlansModal 
        isOpen={isPlansModalOpen}
        onClose={() => setIsPlansModalOpen(false)}
      />

      {/* Add Funds Modal */}
      <AnimatePresence>
        {showAddFundsModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl relative"
            >
              <button
                onClick={() => setShowAddFundsModal(false)}
                className="absolute top-5 right-5 p-2 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-all"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-blue-50 dark:bg-blue-900/30 rounded-2xl text-blue-600 dark:text-blue-400">
                  <Wallet className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100">Top Up Wallet</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Add funds via Razorpay Secure Checkout</p>
                </div>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
                    Enter Amount (₹)
                  </label>
                  <input
                    type="number"
                    min="10"
                    max="10000"
                    value={Number.isNaN(topUpAmount) ? '' : topUpAmount}
                    onChange={(e) => setTopUpAmount(e.target.value === '' ? 0 : (Number(e.target.value) || 0))}
                    className="w-full px-5 py-4 rounded-2xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-2xl font-bold text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
                    Quick Select
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {[100, 200, 500, 1000].map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => setTopUpAmount(amt)}
                        className={`py-2.5 rounded-xl text-xs font-bold transition-all ${
                          topUpAmount === amt
                            ? 'bg-blue-600 text-white shadow-md'
                            : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                        }`}
                      >
                        ₹{amt}
                      </button>
                    ))}
                  </div>
                </div>

                {topUpError && (
                  <p className="text-xs font-bold text-red-500 bg-red-50 dark:bg-red-900/20 p-3 rounded-xl">
                    {topUpError}
                  </p>
                )}

                <button
                  disabled={topUpLoading || topUpAmount <= 0}
                  onClick={() => handleTopUpWallet(topUpAmount)}
                  className="w-full py-4 bg-blue-600 text-white font-bold rounded-2xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 dark:shadow-none flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {topUpLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    `Proceed to Add ₹${topUpAmount}`
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Delete Account Confirmation Modal */}
        {showDeleteModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-surface-container border border-red-200 dark:border-red-900/40 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl relative overflow-hidden"
            >
              <button
                onClick={() => setShowDeleteModal(false)}
                className="absolute top-5 right-5 p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-full hover:bg-gray-100 dark:hover:bg-surface-low transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-4 mb-6">
                <div className="p-3 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-2xl">
                  <Trash2 className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-xl font-display font-black text-gray-900 dark:text-high-contrast uppercase tracking-tight">
                    Delete Account?
                  </h3>
                  <p className="text-xs text-red-600 dark:text-red-400 font-bold uppercase tracking-wider">
                    Irreversible Action
                  </p>
                </div>
              </div>

              <div className="space-y-4 mb-6">
                <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
                  Are you sure you want to delete <strong className="text-gray-900 dark:text-white">{user.name || user.email}</strong>?
                </p>
                <ul className="text-xs text-gray-500 dark:text-gray-400 space-y-1.5 list-disc pl-4">
                  <li>Your user profile and saved address will be erased.</li>
                  <li>Your phone number and member information will be wiped.</li>
                  <li>Active bookings and wallet balance will be lost permanently.</li>
                </ul>

                <div className="pt-2">
                  <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-2">
                    Type <span className="text-red-600 font-bold">DELETE</span> to confirm:
                  </label>
                  <input
                    type="text"
                    value={deleteConfirmInput}
                    onChange={(e) => setDeleteConfirmInput(e.target.value)}
                    placeholder="Type DELETE"
                    className="w-full px-4 py-3 bg-gray-50 dark:bg-surface-low border border-gray-200 dark:border-surface-low rounded-xl text-sm font-black uppercase tracking-widest text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-red-500/30"
                  />
                </div>

                {deleteError && (
                  <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/40 rounded-xl text-xs text-red-600 dark:text-red-400 font-medium">
                    {deleteError}
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowDeleteModal(false)}
                  className="flex-1 py-3.5 bg-gray-100 dark:bg-surface-low text-gray-700 dark:text-gray-300 text-xs font-black uppercase tracking-widest rounded-xl hover:bg-gray-200 dark:hover:bg-surface-highest transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={deleteConfirmInput !== 'DELETE' || deleteLoading}
                  onClick={handleDeleteAccount}
                  className="flex-1 py-3.5 bg-red-600 text-white text-xs font-black uppercase tracking-widest rounded-xl hover:bg-red-700 transition-colors shadow-lg shadow-red-600/20 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {deleteLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    'Permanently Delete'
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Profile;
