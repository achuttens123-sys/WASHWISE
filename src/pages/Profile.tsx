import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { User, Mail, GraduationCap, Calendar, Settings, LogOut, Wallet, History, Shield, Loader2, CheckCircle, ArrowLeft, ArrowRight, AlertCircle, Trophy, Zap, Star, Gift, Copy, Share2, TrendingUp } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Booking } from '../types';

const Profile: React.FC = () => {
  const { user, logout, updateUser } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'profile' | 'wallet' | 'history' | 'rewards'>('profile');
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [studentId, setStudentId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
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

  const copyReferralCode = () => {
    if (user?.referralCode) {
      navigator.clipboard.writeText(user.referralCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleShare = async () => {
    if (!user?.referralCode) return;
    
    const shareData = {
      title: 'Join WashWise!',
      text: `Use my referral code ${user.referralCode} to get exclusive benefits at WashWise!`,
      url: window.location.origin
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        // Fallback: copy to clipboard if share API is not available
        copyReferralCode();
      }
    } catch (err) {
      console.error('Error sharing:', err);
    }
  };

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
    <div className="max-w-6xl mx-auto px-4 py-12">
      <div className="flex flex-col lg:flex-row gap-12">
        {/* Sidebar Navigation */}
        <div className="w-full lg:w-72 shrink-0">
          <div className="sticky top-24 space-y-8">
            <div className="px-4">
              <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight leading-none mb-2">Account</h1>
              <p className="text-sm font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Settings & Activity</p>
            </div>

            <nav className="space-y-1">
              {[
                { id: 'profile', label: 'My Profile', icon: User },
                { id: 'wallet', label: 'Wallet', icon: Wallet },
                { id: 'history', label: 'Booking History', icon: History },
                { id: 'rewards', label: 'Rewards & Ranks', icon: Trophy },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => { setActiveTab(tab.id as any); setIsUpgrading(false); }}
                  className={`w-full flex items-center px-6 py-4 rounded-[2rem] transition-all duration-300 group ${
                    activeTab === tab.id && !isUpgrading 
                      ? 'bg-blue-600 text-white shadow-2xl shadow-blue-200 dark:shadow-blue-900/20' 
                      : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/50'
                  }`}
                >
                  <tab.icon className={`w-5 h-5 mr-4 transition-transform duration-300 ${activeTab === tab.id ? 'scale-110' : 'group-hover:scale-110'}`} />
                  <span className="font-black text-sm uppercase tracking-wider">{tab.label}</span>
                </button>
              ))}
            </nav>

            <div className="pt-8 px-4 border-t border-gray-100 dark:border-gray-800">
              <button
                onClick={handleLogout}
                className="w-full flex items-center px-6 py-4 rounded-[2rem] text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/10 transition-all duration-300 group"
              >
                <LogOut className="w-5 h-5 mr-4 group-hover:-translate-x-1 transition-transform" />
                <span className="font-black text-sm uppercase tracking-wider">Logout</span>
              </button>
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 min-w-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab + (isUpgrading ? '-upgrade' : '')}
              initial={{ opacity: 0, y: 20, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.98 }}
              transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
              className="bg-white dark:bg-gray-900/50 backdrop-blur-xl p-8 md:p-12 rounded-[3.5rem] shadow-2xl shadow-gray-200/50 dark:shadow-none border border-gray-100 dark:border-gray-800 relative overflow-hidden"
            >
              {/* Decorative Background Element */}
              <div className="absolute -top-24 -right-24 w-64 h-64 bg-blue-50 dark:bg-blue-900/10 rounded-full blur-3xl opacity-50 pointer-events-none" />

              {activeTab === 'profile' && !isUpgrading && (
                <div className="space-y-12 relative z-10">
                  <div className="flex flex-col md:flex-row items-center md:items-start gap-8">
                    <div className="relative group">
                      <div className="w-32 h-32 bg-gradient-to-br from-blue-100 to-blue-50 dark:from-blue-900/40 dark:to-blue-800/20 rounded-[2.5rem] flex items-center justify-center text-blue-600 dark:text-blue-400 shadow-inner">
                        <User className="w-16 h-16" />
                      </div>
                      <button 
                        onClick={() => setIsEditing(!isEditing)}
                        className={`absolute -bottom-2 -right-2 p-3 rounded-2xl shadow-lg border transition-all ${
                          isEditing 
                            ? 'bg-blue-600 text-white border-blue-500' 
                            : 'bg-white dark:bg-gray-800 text-gray-400 border-gray-100 dark:border-gray-700 hover:text-blue-500'
                        }`}
                      >
                        <Settings className="w-5 h-5" />
                      </button>
                    </div>
                    <div className="text-center md:text-left pt-2 flex-1">
                      {isEditing ? (
                        <div className="space-y-4 max-w-md">
                          <div>
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Full Name</label>
                            <input
                              type="text"
                              value={editForm.name}
                              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                              className="w-full px-6 py-4 bg-gray-50 dark:bg-gray-800/50 border-2 border-transparent focus:border-blue-500 rounded-2xl outline-none transition-all font-bold dark:text-white"
                              placeholder="Your Name"
                            />
                          </div>
                        </div>
                      ) : (
                        <h2 className="text-4xl font-black text-gray-900 dark:text-white tracking-tight mb-2 uppercase">{user.name}</h2>
                      )}
                      <div className="flex flex-wrap justify-center md:justify-start gap-3 mt-4">
                        <span className={`inline-flex items-center px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${
                          user.userType === 'subscriber' 
                            ? 'bg-green-50 text-green-600 border-green-100 dark:bg-green-900/20 dark:text-green-400 dark:border-green-900/30' 
                            : 'bg-gray-50 text-gray-500 border-gray-100 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700'
                        }`}>
                          <Shield className="w-3 h-3 mr-2" />
                          {user.userType === 'subscriber' ? 'Premium Subscriber' : 'Guest Account'}
                        </span>
                        <span className="inline-flex items-center px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-blue-50 text-blue-600 border border-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-900/30">
                          Level {user.level || 'Bronze'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {isEditing ? (
                    <form onSubmit={handleSaveProfile} className="space-y-8">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Phone Number</label>
                          <input
                            type="tel"
                            value={editForm.phone}
                            onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                            className="w-full px-6 py-4 bg-gray-50 dark:bg-gray-800/50 border-2 border-transparent focus:border-blue-500 rounded-2xl outline-none transition-all font-bold dark:text-white"
                            placeholder="Your Phone Number"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Address / Hostel</label>
                          <input
                            type="text"
                            value={editForm.address}
                            onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                            className="w-full px-6 py-4 bg-gray-50 dark:bg-gray-800/50 border-2 border-transparent focus:border-blue-500 rounded-2xl outline-none transition-all font-bold dark:text-white"
                            placeholder="Your Address"
                          />
                        </div>
                      </div>

                      {error && (
                        <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-2xl border border-red-100 dark:border-red-900/30">
                          <AlertCircle className="w-5 h-5" />
                          <p className="text-xs font-bold">{error}</p>
                        </div>
                      )}

                      <div className="flex gap-4">
                        <button
                          type="submit"
                          disabled={loading}
                          className="flex-1 py-5 bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest rounded-2xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 dark:shadow-none flex items-center justify-center disabled:opacity-50"
                        >
                          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Save Changes'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsEditing(false)}
                          className="flex-1 py-5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-[10px] font-black uppercase tracking-widest rounded-2xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-all"
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
                        <div key={i} className="p-8 bg-gray-50/50 dark:bg-gray-800/30 rounded-[2.5rem] border border-gray-100 dark:border-gray-800 group hover:border-blue-200 dark:hover:border-blue-900/30 transition-all duration-300">
                          <p className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em] mb-3">{item.label}</p>
                          <div className="flex items-center text-gray-900 dark:text-gray-100">
                            <div className="p-2 bg-white dark:bg-gray-800 rounded-xl mr-4 shadow-sm group-hover:scale-110 transition-transform">
                              <item.icon className="w-5 h-5 text-blue-500" />
                            </div>
                            <span className="text-lg font-bold tracking-tight">{item.value}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Quick Referral Card on Main Profile */}
                  <div className="p-8 bg-blue-50/50 dark:bg-blue-900/10 rounded-[2.5rem] border border-blue-100/50 dark:border-blue-900/20">
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
                      <div className="flex items-center gap-4">
                        <div className="p-3 bg-blue-600 text-white rounded-2xl">
                          <Gift className="w-6 h-6" />
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-1">Your Referral Code</p>
                          <p className="text-xl font-black text-gray-900 dark:text-white tracking-widest italic">{user.referralCode || 'WASH-7788'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 w-full sm:w-auto">
                        <button 
                          onClick={copyReferralCode}
                          className="flex-1 sm:flex-none px-6 py-3 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-all border border-gray-100 dark:border-gray-700 flex items-center justify-center gap-2"
                        >
                          {copied ? <CheckCircle className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                          {copied ? 'Copied' : 'Copy'}
                        </button>
                        <button 
                          onClick={handleShare}
                          className="flex-1 sm:flex-none px-6 py-3 bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 dark:shadow-none flex items-center justify-center gap-2"
                        >
                          <Share2 className="w-4 h-4" />
                          Share
                        </button>
                      </div>
                    </div>
                  </div>

                  {user.userType === 'guest' && (
                    <div className="relative p-12 bg-gradient-to-br from-blue-600 to-blue-800 rounded-[3.5rem] text-white overflow-hidden shadow-2xl shadow-blue-200 dark:shadow-none">
                      <div className="absolute top-0 right-0 p-8 opacity-10 rotate-12">
                        <Zap className="w-64 h-64" />
                      </div>
                      <div className="relative z-10">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 mb-10">
                          <div className="flex items-center gap-4">
                            <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-md">
                              <Trophy className="w-8 h-8" />
                            </div>
                            <div>
                              <h3 className="text-3xl font-black uppercase tracking-tight">Go Premium</h3>
                              <p className="text-xs font-bold text-blue-100 uppercase tracking-widest opacity-80">Basic Plan: 12kg Monthly Capacity</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] font-black uppercase tracking-widest text-blue-200 mb-1">Starting at</p>
                            <div className="flex items-baseline justify-end gap-1">
                              <span className="text-4xl font-black tracking-tighter italic">₹468</span>
                              <span className="text-sm font-bold opacity-60">/mo</span>
                            </div>
                            <p className="text-[10px] font-bold text-blue-200 opacity-60 italic">(₹39 × 12kg)</p>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
                          {[
                            { title: '12kg Capacity', desc: 'Perfect for regular laundry needs', icon: Zap },
                            { title: 'Exclusive Discounts', desc: 'Save up to 20% on every wash', icon: Star },
                            { title: 'Advance Booking', desc: 'Book slots up to 7 days in advance', icon: Calendar },
                            { title: 'Free Pickup/Drop', desc: 'Complimentary laundry concierge', icon: Shield },
                          ].map((benefit, i) => (
                            <div key={i} className="flex items-start gap-4 p-4 bg-white/10 rounded-2xl backdrop-blur-sm border border-white/10">
                              <div className="p-2 bg-white/20 rounded-xl">
                                <benefit.icon className="w-5 h-5" />
                              </div>
                              <div>
                                <p className="font-black text-sm uppercase tracking-tight mb-1">{benefit.title}</p>
                                <p className="text-xs text-blue-100 opacity-80 leading-relaxed">{benefit.desc}</p>
                              </div>
                            </div>
                          ))}
                        </div>

                        <button 
                          onClick={() => navigate('/billing?type=subscription&plan=basic')}
                          className="w-full sm:w-auto px-12 py-5 bg-white text-blue-600 text-xs font-black uppercase tracking-[0.2em] rounded-2xl hover:bg-blue-50 transition-all shadow-2xl shadow-blue-900/40 active:scale-95 flex items-center justify-center gap-3"
                        >
                          Upgrade to Basic Premium
                          <ArrowRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'profile' && isUpgrading && (
                <div className="space-y-10 relative z-10">
                  <div className="flex items-center gap-6">
                    <button 
                      onClick={() => setIsUpgrading(false)}
                      className="p-4 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-2xl transition-all group"
                    >
                      <ArrowLeft className="w-6 h-6 text-gray-500 group-hover:-translate-x-1 transition-transform" />
                    </button>
                    <div>
                      <h2 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight uppercase">Verify Status</h2>
                      <p className="text-sm font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Student Subscription</p>
                    </div>
                  </div>

                  <form onSubmit={handleUpgrade} className="space-y-8 max-w-md">
                    <div className="space-y-3">
                      <label className="text-xs font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest ml-1">Enter Student ID</label>
                      <div className="relative group">
                        <GraduationCap className="absolute left-5 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                        <input
                          type="text"
                          required
                          value={studentId}
                          onChange={(e) => setStudentId(e.target.value)}
                          placeholder="e.g. STU12345"
                          className="w-full pl-16 pr-6 py-5 bg-gray-50 dark:bg-gray-800/50 border-2 border-transparent focus:border-blue-500 focus:bg-white dark:focus:bg-gray-800 rounded-[2rem] outline-none transition-all font-bold text-lg dark:text-white"
                        />
                      </div>
                      <div className="flex items-start gap-2 ml-1">
                        <AlertCircle className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                        <p className="text-[10px] text-gray-500 font-bold leading-relaxed">Verification is required to access student-only pricing and benefits.</p>
                      </div>
                    </div>

                    {error && (
                      <motion.div 
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex items-center gap-3 p-5 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-2xl border border-red-100 dark:border-red-900/30"
                      >
                        <AlertCircle className="w-5 h-5" />
                        <p className="text-sm font-bold">{error}</p>
                      </motion.div>
                    )}

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full py-6 bg-blue-600 text-white text-xs font-black uppercase tracking-[0.2em] rounded-[2rem] hover:bg-blue-700 transition-all shadow-2xl shadow-blue-200 dark:shadow-none flex items-center justify-center disabled:opacity-50"
                    >
                      {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : 'Activate Subscription'}
                    </button>
                  </form>
                </div>
              )}

              {activeTab === 'wallet' && (
                <div className="space-y-12 relative z-10">
                  <div className="relative p-12 bg-gradient-to-br from-gray-900 to-black rounded-[3.5rem] text-white shadow-2xl overflow-hidden group">
                    {/* Card Pattern Overlay */}
                    <div className="absolute inset-0 opacity-10 pointer-events-none">
                      <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white/20 via-transparent to-transparent" />
                    </div>
                    
                    <div className="relative z-10">
                      <div className="flex justify-between items-start mb-16">
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-500 mb-2">Available Balance</p>
                          <h2 className="text-6xl font-black tracking-tighter italic">₹1,240<span className="text-2xl opacity-50">.00</span></h2>
                        </div>
                        <div className="w-16 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-lg shadow-blue-500/20" />
                      </div>
                      
                      <div className="flex flex-col sm:flex-row gap-4">
                        <button className="flex-1 py-5 bg-white text-black text-[10px] font-black uppercase tracking-widest rounded-2xl hover:bg-blue-50 transition-all active:scale-95">
                          Add Funds
                        </button>
                        <button className="flex-1 py-5 bg-white/10 text-white text-[10px] font-black uppercase tracking-widest rounded-2xl hover:bg-white/20 transition-all backdrop-blur-md active:scale-95">
                          Transfer
                        </button>
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-8 px-2">
                      <h3 className="text-xl font-black text-gray-900 dark:text-white tracking-tight uppercase">Recent Activity</h3>
                      <button className="text-[10px] font-black text-blue-600 uppercase tracking-widest hover:underline">View All</button>
                    </div>
                    <div className="space-y-4">
                      {[
                        { title: 'Laundry Booking', date: '24 Mar 2026', amount: -250, status: 'Completed' },
                        { title: 'Wallet Top-up', date: '20 Mar 2026', amount: 500, status: 'Completed' },
                        { title: 'Laundry Booking', date: '18 Mar 2026', amount: -200, status: 'Completed' },
                      ].map((tx, i) => (
                        <div key={i} className="flex items-center justify-between p-6 bg-gray-50/50 dark:bg-gray-800/30 rounded-[2rem] border border-gray-100 dark:border-gray-800 group hover:border-blue-100 dark:hover:border-blue-900/20 transition-all">
                          <div className="flex items-center">
                            <div className={`p-4 rounded-2xl mr-6 transition-transform group-hover:scale-110 ${tx.amount > 0 ? 'bg-green-50 dark:bg-green-900/20 text-green-600' : 'bg-red-50 dark:bg-red-900/20 text-red-600'}`}>
                              <Wallet className="w-6 h-6" />
                            </div>
                            <div>
                              <p className="font-black text-gray-900 dark:text-gray-100 uppercase text-xs tracking-tight">{tx.title}</p>
                              <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mt-1">{tx.date}</p>
                            </div>
                          </div>
                          <p className={`text-lg font-black tracking-tighter ${tx.amount > 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {tx.amount > 0 ? '+' : ''}₹{Math.abs(tx.amount)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'history' && (
                <div className="space-y-10 relative z-10">
                  <div className="px-2">
                    <h3 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight uppercase mb-2">History</h3>
                    <p className="text-sm font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Your past laundry sessions</p>
                  </div>

                  <div className="space-y-6">
                    {loadingBookings ? (
                      <div className="flex flex-col items-center justify-center py-24 text-center">
                        <div className="relative">
                          <Loader2 className="w-12 h-12 animate-spin text-blue-600 mb-6" />
                          <div className="absolute inset-0 blur-xl bg-blue-400/20 animate-pulse" />
                        </div>
                        <p className="text-lg font-black text-gray-900 dark:text-white tracking-tight uppercase">Retrieving Records</p>
                        <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mt-2">Just a moment...</p>
                      </div>
                    ) : bookings.length === 0 ? (
                      <div className="text-center py-24 bg-gray-50/50 dark:bg-gray-800/30 rounded-[3rem] border-2 border-dashed border-gray-200 dark:border-gray-800">
                        <div className="p-6 bg-white dark:bg-gray-800 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-6 shadow-sm">
                          <AlertCircle className="w-10 h-10 text-gray-300 dark:text-gray-600" />
                        </div>
                        <p className="text-xl font-black text-gray-900 dark:text-white tracking-tight uppercase">No Bookings Yet</p>
                        <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mt-2">Start your first wash today!</p>
                      </div>
                    ) : (
                      bookings.map((booking) => (
                        <div key={booking.id} className="p-8 bg-gray-50/50 dark:bg-gray-800/30 rounded-[2.5rem] border border-gray-100 dark:border-gray-800 flex flex-col md:flex-row md:items-center justify-between gap-8 group hover:border-blue-200 dark:hover:border-blue-900/30 transition-all duration-300">
                          <div className="space-y-4">
                            <div className="flex flex-wrap items-center gap-3">
                              <span className="text-[10px] font-black text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-3 py-1.5 rounded-full border border-blue-100 dark:border-blue-900/30 uppercase tracking-widest">
                                ID: {booking.id?.slice(-6).toUpperCase()}
                              </span>
                              <span className={`text-[10px] font-black px-3 py-1.5 rounded-full uppercase tracking-widest border ${
                                booking.status === 'completed' ? 'bg-green-50 text-green-600 border-green-100' :
                                booking.status === 'rejected' ? 'bg-red-50 text-red-600 border-red-100' :
                                'bg-blue-50 text-blue-600 border-blue-100'
                              }`}>
                                {booking.status}
                              </span>
                            </div>
                            <div>
                              <p className="text-2xl font-black text-gray-900 dark:text-white tracking-tight uppercase">{booking.serviceType}</p>
                              <div className="flex items-center text-sm font-bold text-gray-500 dark:text-gray-400 mt-1">
                                <Calendar className="w-4 h-4 mr-2" />
                                {booking.date} <span className="mx-2 opacity-30">•</span> {booking.timeSlot}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-6">
                            <div className="text-right">
                              <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-1">Total Paid</p>
                              <p className="text-2xl font-black text-gray-900 dark:text-white tracking-tighter italic">₹{booking.price.toFixed(2)}</p>
                            </div>
                            <button className="px-8 py-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white text-[10px] font-black uppercase tracking-widest rounded-2xl hover:bg-gray-900 hover:text-white dark:hover:bg-white dark:hover:text-black transition-all shadow-sm">
                              Details
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'rewards' && (
                <div className="space-y-12 relative z-10">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {[
                      { label: 'Experience (XP)', value: user.xp || 0, icon: Zap, color: 'bg-blue-600', shadow: 'shadow-blue-200', sub: `Level ${user.level || 'Bronze'}` },
                      { label: 'WashWise Points', value: user.points || 0, icon: Star, color: 'bg-yellow-500', shadow: 'shadow-yellow-200', sub: 'Redeemable' },
                      { label: 'Week Streak', value: user.streak || 0, icon: TrendingUp, color: 'bg-indigo-600', shadow: 'shadow-indigo-200', sub: 'Active' },
                    ].map((stat, i) => (
                      <div key={i} className={`${stat.color} p-8 rounded-[3rem] text-white shadow-2xl ${stat.shadow} dark:shadow-none relative overflow-hidden group`}>
                        <div className="absolute -top-4 -right-4 opacity-10 group-hover:scale-110 transition-transform duration-500">
                          <stat.icon className="w-32 h-32" />
                        </div>
                        <div className="relative z-10">
                          <div className="flex items-center justify-between mb-8">
                            <div className="p-4 bg-white/20 rounded-2xl backdrop-blur-md">
                              <stat.icon className="w-6 h-6" />
                            </div>
                            <span className="text-[10px] font-black uppercase tracking-widest bg-white/20 px-3 py-1.5 rounded-full backdrop-blur-md">{stat.sub}</span>
                          </div>
                          <p className="text-5xl font-black tracking-tighter italic mb-1">{stat.value}</p>
                          <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-70">{stat.label}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Referral Bento Box */}
                  <div className="p-10 bg-gray-50/50 dark:bg-gray-800/30 rounded-[3.5rem] border border-gray-100 dark:border-gray-800">
                    <div className="flex flex-col lg:flex-row items-center gap-12">
                      <div className="w-32 h-32 bg-white dark:bg-gray-800 rounded-[2.5rem] flex items-center justify-center shadow-xl shadow-gray-200/50 dark:shadow-none shrink-0 group">
                        <Gift className="w-12 h-12 text-blue-600 group-hover:rotate-12 transition-transform" />
                      </div>
                      <div className="flex-1 text-center lg:text-left space-y-6">
                        <div>
                          <h3 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight uppercase mb-2">Invite & Earn</h3>
                          <p className="text-sm font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Share the love, get rewarded</p>
                        </div>
                        
                          <div className="flex flex-col sm:flex-row items-center gap-6">
                          <div className="flex-1 w-full flex items-center justify-between px-8 py-5 bg-white dark:bg-gray-800 rounded-[2rem] border border-gray-100 dark:border-gray-700 shadow-sm">
                            <span className="text-2xl font-black text-blue-600 tracking-[0.3em] italic">{user.referralCode || 'WASH-7788'}</span>
                            <button 
                              onClick={copyReferralCode}
                              className="p-3 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-2xl transition-all active:scale-90"
                            >
                              {copied ? <CheckCircle className="w-6 h-6 text-green-500" /> : <Copy className="w-6 h-6 text-gray-400" />}
                            </button>
                          </div>
                          <button 
                            onClick={handleShare}
                            className="w-full sm:w-auto px-10 py-5 bg-gray-900 dark:bg-white text-white dark:text-black text-[10px] font-black uppercase tracking-widest rounded-[2rem] hover:scale-105 transition-all shadow-xl active:scale-95 flex items-center justify-center gap-3"
                          >
                            <Share2 className="w-4 h-4" />
                            Share Link
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Progression Track */}
                  <div className="p-12 bg-gray-900 text-white rounded-[3.5rem] relative overflow-hidden shadow-2xl">
                    <div className="absolute top-0 right-0 p-12 opacity-5 rotate-12">
                      <Trophy className="w-64 h-64" />
                    </div>
                    <div className="relative z-10">
                      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-10">
                        <div>
                          <h3 className="text-3xl font-black tracking-tight uppercase mb-2 italic">Progression</h3>
                          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Road to Silver Tier</p>
                        </div>
                        <div className="text-right">
                          <span className="text-4xl font-black tracking-tighter italic text-blue-400">{(user.xp || 0)}</span>
                          <span className="text-xl font-black opacity-30 italic ml-2">/ 500 XP</span>
                        </div>
                      </div>
                      
                      <div className="space-y-6">
                        <div className="h-6 bg-white/5 rounded-full overflow-hidden p-1 border border-white/10">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.min(((user.xp || 0) / 500) * 100, 100)}%` }}
                            className="h-full bg-gradient-to-r from-blue-600 to-blue-400 rounded-full shadow-[0_0_20px_rgba(37,99,235,0.5)]"
                          />
                        </div>
                        <div className="flex justify-between items-center px-2">
                          <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Current: Bronze</p>
                          <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Next: Silver</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default Profile;
