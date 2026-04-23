import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { User, Mail, GraduationCap, Calendar, Settings, LogOut, Wallet, History, Shield, Loader2, CheckCircle, ArrowLeft, ArrowRight, AlertCircle, Trophy, Zap, Star, Gift, Copy, Share2, TrendingUp, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Booking } from '../types';
import SubscriptionPlansModal from '../components/SubscriptionPlansModal';

const Profile: React.FC = () => {
  const { user, logout, updateUser } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'profile' | 'wallet' | 'history'>('profile');
  const [isUpgrading, setIsUpgrading] = useState(false);

  const [isPlansModalOpen, setIsPlansModalOpen] = useState(false);
  const [studentId, setStudentId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(false);
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

  if (!user) return null;

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
    setLoading(true);
    setError('');
    try {
      await updateUser({
        name: editForm.name,
        phone: editForm.phone,
        address: editForm.address,
      });
      setIsEditing(false);
    } catch (err) {
      setError('Failed to update profile. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-12 sm:py-20">
      <div className="flex flex-col lg:flex-row gap-16">
        {/* Sidebar Navigation */}
        <div className="w-full lg:w-72 shrink-0">
          <div className="sticky top-24 space-y-10">
            <div className="px-4">
              <h1 className="text-5xl font-display font-black text-gray-800 dark:text-high-contrast tracking-tighter uppercase leading-none mb-3">Account</h1>
              <p className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">Settings & Activity</p>
            </div>

            <nav className="space-y-2">
              {[
                { id: 'profile', label: 'My Profile', icon: User },
                { id: 'wallet', label: 'Wallet', icon: Wallet },
                { id: 'history', label: 'Booking History', icon: History },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => { setActiveTab(tab.id as any); setIsUpgrading(false); }}
                  className={`w-full flex items-center px-8 py-5 rounded-2xl transition-all duration-300 group haptic-feedback ${
                    activeTab === tab.id && !isUpgrading 
                      ? 'bg-primary-electric text-white shadow-2xl shadow-primary-electric/20 dark:shadow-none' 
                      : 'text-gray-400 dark:text-gray-500 hover:bg-gray-50 dark:hover:bg-surface-low'
                  }`}
                >
                  <tab.icon className={`w-5 h-5 mr-4 transition-transform duration-300 ${activeTab === tab.id ? 'scale-110' : 'group-hover:scale-110'}`} />
                  <span className="font-black text-[10px] uppercase tracking-widest">{tab.label}</span>
                </button>
              ))}
            </nav>

            <div className="pt-10 px-4 border-t border-gray-100 dark:border-surface-low">
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
              className="bg-white dark:bg-surface-container p-8 md:p-16 rounded-[3rem] shadow-2xl shadow-black/5 dark:shadow-none border border-gray-50 dark:border-surface-low relative overflow-hidden"
            >
              {/* Decorative Background Element */}
              <div className="absolute -top-24 -right-24 w-64 h-64 bg-primary-electric/5 rounded-full blur-3xl pointer-events-none" />

              {activeTab === 'profile' && !isUpgrading && (
                <div className="space-y-16 relative z-10">
                  <div className="flex flex-col md:flex-row items-center md:items-start gap-12">
                    <div className="relative group">
                      <div className="w-40 h-40 bg-gray-50 dark:bg-surface-low rounded-3xl flex items-center justify-center text-primary-electric dark:text-primary-electric-light shadow-inner overflow-hidden">
                        <User className="w-20 h-20" />
                      </div>
                      <button 
                        onClick={() => setIsEditing(!isEditing)}
                        className={`absolute -bottom-3 -right-3 p-4 rounded-2xl shadow-2xl border transition-all haptic-feedback ${
                          isEditing 
                            ? 'bg-primary-electric text-white border-primary-electric' 
                            : 'bg-white dark:bg-surface-highest text-gray-400 border-gray-100 dark:border-surface-low hover:text-primary-electric'
                        }`}
                      >
                        <Settings className="w-6 h-6" />
                      </button>
                    </div>
                    <div className="text-center md:text-left pt-4 flex-1">
                      {isEditing ? (
                        <div className="space-y-6 max-w-md">
                          <div>
                            <label className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Full Name</label>
                            <input
                              type="text"
                              value={editForm.name}
                              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                              className="w-full px-8 py-5 bg-gray-50 dark:bg-surface-low border-none rounded-2xl outline-none transition-all font-black uppercase tracking-widest text-sm dark:text-high-contrast focus:ring-4 focus:ring-primary-electric/10"
                              placeholder="Your Name"
                            />
                          </div>
                        </div>
                      ) : (
                        <h2 className="text-5xl font-display font-black text-gray-800 dark:text-high-contrast tracking-tighter mb-4 uppercase leading-none break-words">{user.name}</h2>
                      )}
                      <div className="flex flex-wrap justify-center md:justify-start gap-4 mt-6">
                        <span className={`inline-flex items-center px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-widest border ${
                          user.userType === 'subscriber' 
                            ? 'bg-green-50 text-green-600 border-green-100 dark:bg-green-900/20 dark:text-green-400 dark:border-green-900/30' 
                            : 'bg-gray-50 text-gray-400 border-gray-100 dark:bg-surface-low dark:text-gray-500 dark:border-surface-low'
                        }`}>
                          <Shield className="w-3 h-3 mr-2" />
                          {user.userType === 'subscriber' ? 'Premium Subscriber' : 'Guest Account'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {isEditing ? (
                    <form onSubmit={handleSaveProfile} className="space-y-10">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                        <div className="space-y-3">
                          <label className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Phone Number</label>
                          <input
                            type="tel"
                            value={editForm.phone}
                            onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                            className="w-full px-8 py-5 bg-gray-50 dark:bg-surface-low border-none rounded-2xl outline-none transition-all font-black uppercase tracking-widest text-sm dark:text-high-contrast focus:ring-4 focus:ring-primary-electric/10"
                            placeholder="Your Phone Number"
                          />
                        </div>
                        <div className="space-y-3">
                          <label className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Address / Hostel</label>
                          <input
                            type="text"
                            value={editForm.address}
                            onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                            className="w-full px-8 py-5 bg-gray-50 dark:bg-surface-low border-none rounded-2xl outline-none transition-all font-black uppercase tracking-widest text-sm dark:text-high-contrast focus:ring-4 focus:ring-primary-electric/10"
                            placeholder="Your Address"
                          />
                        </div>
                      </div>

                      {error && (
                        <div className="flex items-center gap-4 p-6 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-2xl border border-red-100 dark:border-red-900/30">
                          <AlertCircle className="w-6 h-6" />
                          <p className="text-[10px] font-black uppercase tracking-widest">{error}</p>
                        </div>
                      )}

                      <div className="flex gap-6">
                        <button
                          type="submit"
                          disabled={loading}
                          className="flex-1 py-6 bg-primary-electric text-white text-[10px] font-black uppercase tracking-widest rounded-2xl hover:bg-primary-electric/90 transition-all shadow-xl shadow-primary-electric/20 dark:shadow-none flex items-center justify-center disabled:opacity-50 haptic-feedback"
                        >
                          {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : 'Save Changes'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsEditing(false)}
                          className="flex-1 py-6 bg-gray-50 dark:bg-surface-low text-gray-400 dark:text-gray-500 text-[10px] font-black uppercase tracking-widest rounded-2xl hover:bg-gray-100 dark:hover:bg-surface-highest transition-all haptic-feedback"
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      {[
                        { label: 'Email Address', value: user.email, icon: Mail },
                        { label: 'Phone Number', value: user.phone || 'Not set', icon: History, hide: !user.phone && !isEditing },
                        { label: 'Address', value: user.address || 'Not set', icon: Shield, hide: !user.address && !isEditing },
                        { label: 'Student ID', value: user.studentId, icon: GraduationCap, hide: !user.studentId },
                        { label: 'Member Since', value: new Date(user.createdAt).toLocaleDateString(), icon: Calendar },
                      ].map((item, i) => !item.hide && (
                        <div key={i} className="p-10 bg-gray-50/30 dark:bg-surface-low/30 rounded-3xl border border-gray-50 dark:border-surface-low group hover:border-primary-electric/20 transition-all duration-500">
                          <p className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-4">{item.label}</p>
                          <div className="flex items-center text-gray-800 dark:text-high-contrast">
                            <div className="p-3 bg-white dark:bg-surface-highest rounded-2xl mr-5 shadow-sm group-hover:scale-110 transition-transform">
                              <item.icon className="w-6 h-6 text-primary-electric" />
                            </div>
                            <span className="text-xl font-display font-black tracking-tight break-all uppercase">{item.value}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* No Referral Card Needed for Utility Model */}

                  {user.userType === 'guest' && (
                    <div className="relative p-16 bg-primary-electric rounded-[3rem] text-white overflow-hidden shadow-2xl shadow-primary-electric/20 dark:shadow-none group">
                      <div className="absolute top-0 right-0 p-12 opacity-10 rotate-12 group-hover:scale-110 transition-transform duration-1000">
                        <Zap className="w-72 h-72" />
                      </div>
                      <div className="relative z-10">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-10 mb-12">
                          <div className="flex items-center gap-6">
                            <div className="p-5 bg-white/20 rounded-2xl backdrop-blur-md">
                              <Trophy className="w-10 h-10" />
                            </div>
                            <div>
                              <h3 className="text-4xl font-display font-black uppercase tracking-tighter leading-none mb-2">Go Premium</h3>
                              <p className="text-[10px] font-black text-white/60 uppercase tracking-widest">Basic Plan: 12kg Monthly Capacity</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] font-black uppercase tracking-widest text-white/60 mb-2">Starting at</p>
                            <div className="flex items-baseline justify-end gap-2">
                              <span className="text-5xl font-display font-black tracking-tighter italic">₹421</span>
                              <span className="text-sm font-black opacity-60">/mo</span>
                            </div>
                            <p className="text-[10px] font-black text-white/40 italic mt-1">(₹39 × 12kg - 10% Off)</p>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
                          {[
                            { title: '12kg Capacity', desc: 'Perfect for regular laundry needs', icon: Zap },
                            { title: 'Exclusive Discounts', desc: 'Save up to 20% on every wash', icon: Star },
                            { title: 'Advance Booking', desc: 'Book slots up to 7 days in advance', icon: Calendar },
                            { title: 'Free Pickup/Drop', desc: 'Complimentary laundry concierge', icon: Shield },
                          ].map((benefit, i) => (
                            <div key={i} className="flex items-start gap-5 p-6 bg-white/10 rounded-2xl backdrop-blur-sm border border-white/10 group/benefit">
                              <div className="p-3 bg-white/20 rounded-xl group-hover/benefit:scale-110 transition-transform">
                                <benefit.icon className="w-6 h-6" />
                              </div>
                              <div>
                                <p className="font-display font-black text-base uppercase tracking-tight mb-1">{benefit.title}</p>
                                <p className="text-xs text-white/60 leading-relaxed font-medium">{benefit.desc}</p>
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
                  <div className="relative p-16 bg-gray-900 dark:bg-surface-highest rounded-[3rem] text-white shadow-2xl overflow-hidden group">
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
                        <button className="flex-1 py-6 bg-white text-black text-[10px] font-black uppercase tracking-widest rounded-2xl hover:bg-gray-50 transition-all active:scale-95 haptic-feedback">
                          Add Funds
                        </button>
                        <button className="flex-1 py-6 bg-white/10 text-white text-[10px] font-black uppercase tracking-widest rounded-2xl hover:bg-white/20 transition-all backdrop-blur-md active:scale-95 haptic-feedback">
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
                      {[
                        { title: 'Laundry Booking', date: '24 Mar 2026', amount: -250, status: 'Completed' },
                        { title: 'Wallet Top-up', date: '20 Mar 2026', amount: 500, status: 'Completed' },
                        { title: 'Laundry Booking', date: '18 Mar 2026', amount: -200, status: 'Completed' },
                      ].map((tx, i) => (
                        <div key={i} className="flex items-center justify-between p-8 bg-gray-50/30 dark:bg-surface-low/30 rounded-3xl border border-gray-50 dark:border-surface-low group hover:border-primary-electric/20 transition-all duration-500">
                          <div className="flex items-center">
                            <div className={`p-5 rounded-2xl mr-8 transition-transform group-hover:scale-110 ${tx.amount > 0 ? 'bg-green-50 dark:bg-green-900/20 text-green-600' : 'bg-red-50 dark:bg-red-900/20 text-red-600'}`}>
                              <Wallet className="w-8 h-8" />
                            </div>
                            <div>
                              <p className="font-display font-black text-gray-800 dark:text-high-contrast uppercase text-base tracking-tight mb-1">{tx.title}</p>
                              <p className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">{tx.date}</p>
                            </div>
                          </div>
                          <p className={`text-2xl font-display font-black tracking-tighter italic ${tx.amount > 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {tx.amount > 0 ? '+' : ''}₹{Math.abs(tx.amount)}
                          </p>
                        </div>
                      ))}
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
                                ID: {booking.id?.slice(-6).toUpperCase()}
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

               {/* Removed Rewards Tab */}
            </motion.div>
          </AnimatePresence>
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
                    <p className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">Transaction ID: {selectedBooking.id?.toUpperCase()}</p>
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
    </div>
  );
};

export default Profile;
