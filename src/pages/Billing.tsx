import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, CreditCard, Loader2, CheckCircle2, ShieldCheck, Wallet, QrCode, Smartphone, Check, Copy, ExternalLink } from 'lucide-react';
import { doc, getDoc, setDoc, updateDoc, collection, addDoc, runTransaction, onSnapshot } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { Booking, Slot } from '../types';
import { QRCodeSVG } from 'qrcode.react';
import { sendNotification } from '../services/NotificationService';

const Billing: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { settings } = useSettings();
  
  const [loading, setLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'wallet' | 'upi'>('wallet');
  const [upiStep, setUpiStep] = useState<'id' | 'qr' | 'verify'>('id');
  const [upiId, setUpiId] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [promoCode, setPromoCode] = useState('');
  const [discount, setDiscount] = useState(0);
  const [promoError, setPromoError] = useState('');
  const [promoApplied, setPromoApplied] = useState(false);
  const [activeBookingId, setActiveBookingId] = useState<string | null>(null);
  const [usePoints, setUsePoints] = useState(false);
  const [storeName, setStoreName] = useState<string>('Loading...');

  const isSubscription = searchParams.get('type') === 'subscription';
  const packageId = searchParams.get('packageId');
  const selectedPackage = (settings?.subscriptionPlans || []).find(p => p.id === packageId);

  const bookingInfo = {
    date: searchParams.get('date') || '',
    slot: searchParams.get('slot') || '',
    pickupDrop: searchParams.get('pickupDrop') === 'true',
    serviceType: searchParams.get('serviceType') || '',
    approxLoad: searchParams.get('approxLoad') || '',
    price: isSubscription ? (selectedPackage?.price || 0) : parseFloat(searchParams.get('price') || '0'),
    address: searchParams.get('address') || '',
    phone: searchParams.get('phone') || '',
    latitude: parseFloat(searchParams.get('lat') || '0'),
    longitude: parseFloat(searchParams.get('lng') || '0'),
    deliveryFee: parseFloat(searchParams.get('fee') || '0'),
    storeId: searchParams.get('storeId') || '',
    garmentInstructions: searchParams.get('garmentInstructions') || ''
  };

  // Fetch store name
  useEffect(() => {
    if (bookingInfo.storeId) {
      const fetchStore = async () => {
        try {
          const storeDoc = await getDoc(doc(db, 'stores', bookingInfo.storeId));
          if (storeDoc.exists()) {
            setStoreName(storeDoc.data().name);
          } else if (bookingInfo.storeId === 'default') {
            setStoreName('Main Office');
          } else {
            setStoreName('Unknown Store');
          }
        } catch (e) {
          console.error(e);
          setStoreName('WASHWISE Center');
        }
      };
      fetchStore();
    }
  }, [bookingInfo.storeId]);

  // Listen for real-time status updates (The Protocol)
  useEffect(() => {
    if (!activeBookingId) return;

    console.log('Protocol: Listening for payment confirmation on:', activeBookingId);
    const unsubscribe = onSnapshot(doc(db, 'bookings', activeBookingId), async (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        if (data.status === 'paid') {
          console.log('Protocol: Payment confirmed! Autoloading...');
          localStorage.setItem('lastBookingId', activeBookingId);
          
          // If it was a subscription, update the user status
          if (data.serviceType === 'Subscription') {
            try {
              await updateDoc(doc(db, 'users', user!.uid), {
                subscriptionPaid: true,
                subscriptionStartDate: new Date().toISOString()
              });
            } catch (err) {
              console.error('Error updating subscription status:', err);
            }
          }

          // Send confirmation notification/email
          sendNotification(user!.uid, user!.email, bookingInfo.phone, 'booking_confirmed', activeBookingId, {
            newSlot: data.serviceType === 'Subscription' ? 'Subscription' : `${data.date} at ${data.timeSlot}`
          });

          if (data.serviceType === 'Subscription') {
            navigate('/dashboard');
          } else {
            navigate('/confirmation');
          }
        }
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `bookings/${activeBookingId}`);
    });

    return () => unsubscribe();
  }, [activeBookingId, navigate, user, bookingInfo.phone]);

  const pointsEarned = bookingInfo.approxLoad === '1-4 kg' ? 20 : 30;
  const pointsRequired = bookingInfo.approxLoad === '1-4 kg' ? 200 : 300;
  const hasEnoughPoints = (user?.points || 0) >= pointsRequired;

  const discountedPrice = usePoints ? 0 : bookingInfo.price * (1 - discount);

  // UPI Payment Link
  const upiIdToUse = '9048270616@slc';
  const transactionNote = isSubscription 
    ? `Washwise Subscription ${selectedPackage?.name}` 
    : `Washwise Booking ${bookingInfo.date} ${bookingInfo.slot}`;
  const upiLink = `upi://pay?pa=${upiIdToUse}&pn=WASHWISE%20Laundry&am=${discountedPrice.toFixed(2)}&cu=INR&tn=${encodeURIComponent(transactionNote)}`;

  const handleCopyUPI = () => {
    navigator.clipboard.writeText(upiIdToUse);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const applyPromoCode = () => {
    setPromoError('');
    const code = promoCode.trim().toUpperCase();
    if (code === 'FREETRIAL') {
      setDiscount(1); // 100%
      setPromoApplied(true);
    } else if (code === 'NEW') {
      setDiscount(0.5); // 50%
      setPromoApplied(true);
    } else {
      setPromoError('Invalid promo code');
      setDiscount(0);
      setPromoApplied(false);
    }
  };

  const handlePayment = async () => {
    if (!user) return;
    
    if (isSubscription && paymentMethod === 'wallet') {
      if ((user.walletBalance || 0) < discountedPrice) {
        setError('Insufficient wallet balance.');
        return;
      }
      setLoading(true);
      try {
        // For wallet subscription, we just update the user's status (instant)
        await updateDoc(doc(db, 'users', user.uid), {
          subscriptionPaid: true,
          subscriptionStartDate: new Date().toISOString(),
          walletBalance: (user.walletBalance || 0) - discountedPrice
        });
        navigate('/dashboard');
      } catch (err: any) {
        setError(err.message || 'Payment failed. Please try again.');
      } finally {
        setLoading(false);
      }
      return;
    }

    if (usePoints) {
      if (!hasEnoughPoints) {
        setError('Not enough points for a free wash.');
        return;
      }
      setLoading(true);
      try {
        await completeInstantBooking(true);
      } catch (err: any) {
        setError(err.message || 'Payment failed. Please try again.');
      } finally {
        setLoading(false);
      }
      return;
    }

    if (paymentMethod === 'upi' && upiStep === 'id') {
      if (!upiId.includes('@')) {
        setError('Please enter a valid UPI ID');
        return;
      }
      setLoading(true);
      
      // Step 1: Create the "Pending" booking first (The Protocol)
      const bookingId = await createPendingBooking();
      if (bookingId) {
        setLoading(false);
        setUpiStep('verify');
        setActiveBookingId(bookingId);
        setError('');
      }
      return;
    }

    if (paymentMethod === 'upi' && upiStep === 'qr') {
      setLoading(true);
      const bookingId = await createPendingBooking();
      if (bookingId) {
        setLoading(false);
        setUpiStep('verify');
        setActiveBookingId(bookingId);
      }
      return;
    }

    setLoading(true);
    setError('');

    try {
      // For Wallet, we do a direct transaction
      await completeInstantBooking();
    } catch (err: any) {
      setError(err.message || 'Payment failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const createPendingBooking = async () => {
    try {
      const bookingRef = doc(collection(db, 'bookings'));
      
      const booking: Booking = {
        userId: user!.uid,
        userName: user!.name,
        date: isSubscription ? new Date().toISOString().split('T')[0] : bookingInfo.date,
        timeSlot: isSubscription ? 'Subscription' : bookingInfo.slot,
        machineNumber: 0, // Will be assigned on confirmation
        pickupDrop: isSubscription ? false : bookingInfo.pickupDrop,
        address: bookingInfo.address,
        phone: bookingInfo.phone,
        latitude: bookingInfo.latitude,
        longitude: bookingInfo.longitude,
        deliveryFee: bookingInfo.deliveryFee,
        storeId: bookingInfo.storeId,
        garmentInstructions: bookingInfo.garmentInstructions,
        serviceType: isSubscription ? 'Subscription' : bookingInfo.serviceType as any,
        approxLoad: isSubscription ? '1-2 kg' : bookingInfo.approxLoad as any,
        packageId: isSubscription ? packageId || undefined : undefined,
        price: discountedPrice,
        status: 'pending',
        pointsEarned: isSubscription ? 0 : pointsEarned,
        createdAt: new Date().toISOString()
      };

      await setDoc(bookingRef, booking);
      return bookingRef.id;
    } catch (err) {
      console.error('Error creating pending booking:', err);
      setError('Could not initiate booking. Please try again.');
      return null;
    }
  };

  const completeInstantBooking = async (isPointsPayment = false) => {
    if (!user) return;
    
    const slotId = `${bookingInfo.date}_${bookingInfo.slot}`;
    const slotRef = doc(db, 'slots', slotId);

    await runTransaction(db, async (transaction) => {
      // 1. ALL READS FIRST
      const slotDoc = await transaction.get(slotRef);
      const userRef = doc(db, 'users', user.uid);
      const userDoc = await transaction.get(userRef);

      // 2. ALL WRITES LAST
      let slotData: Slot = slotDoc.exists() 
        ? slotDoc.data() as Slot 
        : { date: bookingInfo.date, timeSlot: bookingInfo.slot, machines: { '1': '', '2': '', '3': '', '4': '' } };

      let assignedMachine = -1;
      for (let i = 1; i <= 4; i++) {
        if (!slotData.machines[i.toString()]) {
          assignedMachine = i;
          break;
        }
      }

      if (assignedMachine === -1) throw new Error('Slot is full.');

      const updatedMachines = { ...slotData.machines, [assignedMachine.toString()]: user.uid };
      if (!slotDoc.exists()) {
        transaction.set(slotRef, { ...slotData, machines: updatedMachines });
      } else {
        transaction.update(slotRef, { machines: updatedMachines });
      }

      // Update User Points and Wallet
      const userData = userDoc.exists() ? userDoc.data() : {};
      const currentPoints = userData.points || 0;
      const currentWallet = userData.walletBalance || 0;
      
      if (isPointsPayment) {
        transaction.update(userRef, { points: currentPoints - pointsRequired });
      } else if (paymentMethod === 'wallet') {
        if (currentWallet < discountedPrice) throw new Error('Insufficient wallet balance.');
        transaction.update(userRef, { walletBalance: currentWallet - discountedPrice });
      }
      // Points earning moved to AdminDashboard (on completion)

      const bookingRef = doc(collection(db, 'bookings'));
      const booking: Booking = {
        userId: user.uid,
        userName: user.name,
        date: bookingInfo.date,
        timeSlot: bookingInfo.slot,
        machineNumber: assignedMachine,
        pickupDrop: bookingInfo.pickupDrop,
        address: bookingInfo.address,
        phone: bookingInfo.phone,
        latitude: bookingInfo.latitude,
        longitude: bookingInfo.longitude,
        deliveryFee: bookingInfo.deliveryFee,
        storeId: bookingInfo.storeId,
        garmentInstructions: bookingInfo.garmentInstructions,
        serviceType: bookingInfo.serviceType as any,
        approxLoad: bookingInfo.approxLoad as any,
        price: isPointsPayment ? 0 : discountedPrice,
        status: 'paid',
        pointsEarned: isPointsPayment ? 0 : pointsEarned,
        pointsRedeemed: isPointsPayment ? pointsRequired : 0,
        createdAt: new Date().toISOString()
      };

      transaction.set(bookingRef, booking);
      localStorage.setItem('lastBookingId', bookingRef.id);
      
      // Send confirmation notification/email
      sendNotification(user.uid, user.email, bookingInfo.phone, 'booking_confirmed', bookingRef.id, {
        newSlot: `${bookingInfo.date} at ${bookingInfo.slot}`
      });
    });

    navigate('/confirmation');
  };

  // Simulated Webhook Trigger (For Testing the Protocol)
  const simulateIncomingPayment = async () => {
    if (!activeBookingId) return;
    setLoading(true);
    try {
      // In a real app, this update happens via a server-side Webhook from the Bank
      await updateDoc(doc(db, 'bookings', activeBookingId), {
        status: 'paid',
        machineNumber: Math.floor(Math.random() * 4) + 1 // Simulate machine assignment
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-4 sm:py-8">
      <button 
        onClick={() => navigate(-1)}
        className="flex items-center text-gray-500 hover:text-blue-600 mb-6 sm:mb-8 transition-colors text-sm"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back
      </button>

      {isSubscription && !selectedPackage ? (
        <div className="space-y-6 sm:space-y-8">
          <div className="text-center mb-8 sm:mb-12">
            <h1 className="text-2xl sm:text-4xl font-black text-gray-900 dark:text-white tracking-tight uppercase mb-2 sm:mb-4">Select Your Plan</h1>
            <p className="text-gray-500 dark:text-gray-400 font-bold uppercase tracking-widest text-[10px] sm:text-sm">Choose the perfect subscription for your laundry needs</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
            {(settings?.subscriptionPlans || []).map((plan) => (
              <motion.div
                key={plan.id}
                whileHover={{ y: -8 }}
                className="bg-white dark:bg-gray-900 p-6 sm:p-8 rounded-2xl sm:rounded-[3rem] border-2 border-gray-100 dark:border-gray-800 shadow-xl hover:border-blue-500 transition-all flex flex-col"
              >
                <div className="mb-8">
                  <h3 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight uppercase mb-2">{plan.name}</h3>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-black tracking-tighter italic text-blue-600">₹{plan.price}</span>
                    <span className="text-gray-400 font-bold uppercase text-[10px]">/ month</span>
                  </div>
                  {plan.originalPrice && (
                    <p className="text-xs text-gray-400 line-through mt-1">₹{plan.originalPrice}</p>
                  )}
                </div>

                <div className="space-y-4 mb-10 flex-1">
                  <div className="flex items-center gap-3 text-sm font-bold text-gray-600 dark:text-gray-300">
                    <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
                    <span>{plan.kgLimit} KG Monthly Limit</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm font-bold text-gray-600 dark:text-gray-300">
                    <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
                    <span>Priority Machine Access</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm font-bold text-gray-600 dark:text-gray-300">
                    <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
                    <span>Exclusive Rewards</span>
                  </div>
                </div>

                <button
                  onClick={() => navigate(`/billing?type=subscription&packageId=${plan.id}`)}
                  className="w-full py-4 bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest rounded-2xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 dark:shadow-none haptic-feedback glow-blue"
                >
                  Select {plan.name}
                </button>
              </motion.div>
            ))}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 sm:gap-8">
        <div className="md:col-span-8 space-y-4 sm:space-y-6">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-white dark:bg-gray-900 p-6 sm:p-8 rounded-2xl sm:rounded-3xl shadow-xl border border-blue-50 dark:border-gray-800"
          >
            <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-6 flex items-center">
              <CreditCard className="w-6 h-6 mr-2 text-blue-600 dark:text-blue-400" /> Payment Method
            </h2>
            
            <div className="space-y-4">
              {/* Points Option */}
              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                onClick={() => { setUsePoints(!usePoints); setError(''); }}
                className={`w-full p-4 rounded-2xl border-2 transition-all flex items-center justify-between haptic-feedback ${
                  usePoints ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 glow-indigo' : 'border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 hover:border-indigo-200 dark:hover:border-indigo-800'
                }`}
              >
                <div className="flex items-center">
                  <div className={`p-2 rounded-lg mr-4 ${usePoints ? 'bg-indigo-600' : 'bg-gray-100 dark:bg-gray-800'}`}>
                    <CheckCircle2 className={`w-5 h-5 ${usePoints ? 'text-white' : 'text-gray-500 dark:text-gray-400'}`} />
                  </div>
                  <div className="text-left">
                    <p className="font-bold text-gray-800 dark:text-gray-100">Use Points</p>
                    <p className={`text-xs font-medium ${usePoints ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-500 dark:text-gray-400'}`}>
                      Available: {user?.points || 0} pts (Need {pointsRequired} pts)
                    </p>
                  </div>
                </div>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center border-2 ${usePoints ? 'border-indigo-600' : 'border-gray-200 dark:border-gray-700'}`}>
                  {usePoints && <motion.div layoutId="payment-dot" className="w-3 h-3 bg-indigo-600 rounded-full" />}
                </div>
              </motion.button>

              {!usePoints && (
                <div className="space-y-4">
                  {/* Wallet Option */}
                  <motion.button
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    onClick={() => { setPaymentMethod('wallet'); setError(''); }}
                    className={`w-full p-4 rounded-2xl border-2 transition-all flex items-center justify-between haptic-feedback ${
                      paymentMethod === 'wallet' ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20 glow-blue' : 'border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 hover:border-blue-200 dark:hover:border-blue-800'
                    }`}
                  >
                <div className="flex items-center">
                  <div className={`p-2 rounded-lg mr-4 ${paymentMethod === 'wallet' ? 'bg-blue-600' : 'bg-gray-100 dark:bg-gray-800'}`}>
                    <Wallet className={`w-5 h-5 ${paymentMethod === 'wallet' ? 'text-white' : 'text-gray-500 dark:text-gray-400'}`} />
                  </div>
                  <div className="text-left">
                    <p className="font-bold text-gray-800 dark:text-gray-100">Student Wallet</p>
                    <p className={`text-xs font-medium ${paymentMethod === 'wallet' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'}`}>Balance: ₹{(user?.walletBalance || 0).toFixed(2)}</p>
                  </div>
                </div>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center border-2 ${paymentMethod === 'wallet' ? 'border-blue-600' : 'border-gray-200 dark:border-gray-700'}`}>
                  {paymentMethod === 'wallet' && <motion.div layoutId="payment-dot" className="w-3 h-3 bg-blue-600 rounded-full" />}
                </div>
              </motion.button>

              {/* UPI Option */}
              <motion.button
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                onClick={() => { setPaymentMethod('upi'); setError(''); }}
                className={`w-full p-4 rounded-2xl border-2 transition-all flex items-center justify-between haptic-feedback ${
                  paymentMethod === 'upi' ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20 glow-blue' : 'border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 hover:border-blue-200 dark:hover:border-blue-800'
                }`}
              >
                <div className="flex items-center">
                  <div className={`p-2 rounded-lg mr-4 ${paymentMethod === 'upi' ? 'bg-blue-600' : 'bg-gray-100 dark:bg-gray-800'}`}>
                    <Smartphone className={`w-5 h-5 ${paymentMethod === 'upi' ? 'text-white' : 'text-gray-500 dark:text-gray-400'}`} />
                  </div>
                  <div className="text-left">
                    <p className="font-bold text-gray-800 dark:text-gray-100">UPI Payment</p>
                    <p className={`text-xs font-medium ${paymentMethod === 'upi' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'}`}>GPay, PhonePe, Paytm</p>
                  </div>
                </div>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center border-2 ${paymentMethod === 'upi' ? 'border-blue-600' : 'border-gray-200 dark:border-gray-700'}`}>
                  {paymentMethod === 'upi' && <motion.div layoutId="payment-dot" className="w-3 h-3 bg-blue-600 rounded-full" />}
                </div>
              </motion.button>
            </div>
          )}
        </div>

            <AnimatePresence mode="wait">
              {paymentMethod === 'upi' && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-6 pt-6 border-t border-gray-100 dark:border-gray-800 overflow-hidden"
                >
                  <div className="flex bg-gray-50 dark:bg-gray-800 p-1 rounded-xl mb-6">
                    <button 
                      onClick={() => setUpiStep('id')}
                      className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${upiStep === 'id' ? 'bg-white dark:bg-gray-700 shadow-sm text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'}`}
                    >
                      UPI ID
                    </button>
                    <button 
                      onClick={() => setUpiStep('qr')}
                      className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${upiStep === 'qr' ? 'bg-white dark:bg-gray-700 shadow-sm text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'}`}
                    >
                      Scan QR
                    </button>
                  </div>

                  {upiStep === 'id' && (
                    <div className="space-y-4">
                      <label className="text-sm font-bold text-gray-700 dark:text-gray-300">Enter UPI ID</label>
                      <div className="relative">
                        <QrCode className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
                        <input
                          type="text"
                          value={upiId}
                          onChange={(e) => setUpiId(e.target.value)}
                          placeholder="username@bank"
                          className="w-full pl-12 pr-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-gray-100"
                        />
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        {['@okaxis', '@okicici', '@paytm', '@ybl'].map(suffix => (
                          <button 
                            key={suffix}
                            onClick={() => setUpiId(prev => prev.split('@')[0] + suffix)}
                            className="px-3 py-1 bg-gray-100 dark:bg-gray-700 text-xs font-bold text-gray-600 dark:text-gray-400 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
                          >
                            {suffix}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {upiStep === 'qr' && (
                    <div className="text-center space-y-4 py-4">
                      <div className="bg-white p-4 rounded-2xl shadow-sm inline-block border border-gray-100 dark:border-gray-800">
                        <QRCodeSVG value={upiLink} size={180} />
                      </div>
                      <div className="space-y-1">
                        <p className="font-bold text-gray-800 dark:text-gray-100">Scan to Pay</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Scan this QR with any UPI app</p>
                        <div className="flex items-center justify-center gap-2 mt-2">
                          <code className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded text-xs font-mono dark:text-gray-300">{upiIdToUse}</code>
                          <button 
                            onClick={handleCopyUPI}
                            className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                          >
                            {copied ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3 text-gray-400 dark:text-gray-500" />}
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center justify-center gap-4 pt-2">
                        <img src="https://upload.wikimedia.org/wikipedia/commons/c/c4/Google_Pay_Logo.svg" className="h-4" alt="GPay" />
                        <img src="https://upload.wikimedia.org/wikipedia/commons/e/e1/PhonePe_Logo.svg" className="h-4" alt="PhonePe" />
                        <img src="https://upload.wikimedia.org/wikipedia/commons/2/24/Paytm_Logo_%28standalone%29.svg" className="h-4" alt="Paytm" />
                      </div>
                    </div>
                  )}

                  {upiStep === 'verify' && (
                    <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-2xl text-center space-y-4 animate-pulse-glow">
                      <div className="w-16 h-16 bg-white dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto shadow-sm">
                        <Smartphone className="w-8 h-8 text-blue-600 dark:text-blue-400 animate-bounce" />
                      </div>
                      <div>
                        <p className="font-bold text-gray-800 dark:text-gray-100">Request Sent!</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Please open your UPI app and approve the payment of ₹{discountedPrice.toFixed(2)}</p>
                      </div>
                      <div className="flex items-center justify-center text-xs font-bold text-blue-600 dark:text-blue-400">
                        <Loader2 className="w-3 h-3 animate-spin mr-2" />
                        Waiting for confirmation...
                      </div>
                      
                      {/* Simulation Button for the User to test the Protocol */}
                      <button 
                        onClick={simulateIncomingPayment}
                        className="w-full py-2 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-[10px] font-black rounded-lg hover:bg-green-200 dark:hover:bg-green-800 transition-all uppercase tracking-widest"
                      >
                        Simulate Incoming Payment (Protocol Test)
                      </button>

                      <button 
                        onClick={() => setUpiStep('id')}
                        className="text-xs text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 underline"
                      >
                        Change UPI ID
                      </button>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            <div className="mt-8 pt-8 border-t border-gray-100 dark:border-gray-800">
              <div className="flex items-center text-gray-500 dark:text-gray-400 text-sm mb-4">
                <ShieldCheck className="w-4 h-4 mr-2 text-green-500" />
                Secure 256-bit SSL encrypted payment
              </div>
              
              {error && <p className="text-red-500 text-sm mb-4 font-medium bg-red-50 dark:bg-red-900/20 p-3 rounded-xl">{error}</p>}

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handlePayment}
                disabled={loading}
                className="w-full py-3 sm:py-4 bg-blue-600 text-white font-bold rounded-xl sm:rounded-2xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 dark:shadow-none flex items-center justify-center haptic-feedback glow-blue"
              >
                {loading ? (
                  <Loader2 className="w-6 h-6 animate-spin" />
                ) : (
                  paymentMethod === 'upi' && upiStep === 'id' ? 'Verify UPI ID' : 
                  paymentMethod === 'upi' && upiStep === 'qr' ? 'I have paid' :
                  `Pay ₹${discountedPrice.toFixed(2)}`
                )}
              </motion.button>
            </div>
          </motion.div>
        </div>

        <div className="md:col-span-4">
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-gray-50 dark:bg-gray-900 p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-gray-100 dark:border-gray-800 sticky top-8 min-w-[280px] w-full"
          >
            <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-4">Summary</h3>
            <div className="space-y-3 pb-4 border-b border-gray-200 dark:border-gray-700">
              {isSubscription ? (
                <>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500 dark:text-gray-400">Package</span>
                    <span className="font-medium text-gray-800 dark:text-gray-200">{selectedPackage?.name}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500 dark:text-gray-400">Benefits</span>
                    <span className="font-medium text-gray-800 dark:text-gray-200">{selectedPackage?.description}</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500 dark:text-gray-400">Date</span>
                    <span className="font-medium text-gray-800 dark:text-gray-200">{bookingInfo.date}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500 dark:text-gray-400">Time Slot</span>
                    <span className="font-medium text-gray-800 dark:text-gray-200">{bookingInfo.slot}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500 dark:text-gray-400">Service</span>
                    <span className="font-medium text-gray-800 dark:text-gray-200">{bookingInfo.serviceType}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500 dark:text-gray-400">Load</span>
                    <span className="font-medium text-gray-800 dark:text-gray-200">{bookingInfo.approxLoad}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500 dark:text-gray-400">Pickup/Drop</span>
                    <span className="font-medium text-gray-800 dark:text-gray-200">{bookingInfo.pickupDrop ? 'Yes' : 'No'}</span>
                  </div>
                  {bookingInfo.pickupDrop && bookingInfo.address && (
                    <div className="pt-2">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Address</p>
                      <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2">{bookingInfo.address}</p>
                    </div>
                  )}
                  {bookingInfo.garmentInstructions && (
                    <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-100 dark:border-amber-800/30">
                      <p className="text-[10px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-widest mb-1">Garment Instructions</p>
                      <p className="text-xs text-amber-800 dark:text-amber-200 font-medium italic">"{bookingInfo.garmentInstructions}"</p>
                    </div>
                  )}
                </>
              )}
            </div>
            
            <div className="pt-4 space-y-4">
              {/* Promo Code Input */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Promo Code</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={promoCode}
                    onChange={(e) => setPromoCode(e.target.value)}
                    placeholder="Enter code"
                    className="flex-1 min-w-0 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none dark:text-gray-100"
                  />
                  <button 
                    onClick={applyPromoCode}
                    className="px-4 py-2 bg-gray-800 dark:bg-gray-700 text-white text-xs font-bold rounded-xl hover:bg-black dark:hover:bg-gray-600 transition-colors"
                  >
                    Apply
                  </button>
                </div>
                {promoError && <p className="text-red-500 text-[10px] font-bold">{promoError}</p>}
                {promoApplied && <p className="text-green-600 text-[10px] font-bold">Promo code applied!</p>}
              </div>

              <div className="space-y-2 pt-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">Base Price</span>
                  <span className="font-medium text-gray-800 dark:text-gray-200">
                    ₹{isSubscription ? selectedPackage?.originalPrice || selectedPackage?.price : (
                      bookingInfo.approxLoad === '1-4 kg' ? settings?.pricing.minCharge :
                      bookingInfo.approxLoad === '5 kg' ? 5 * (settings?.pricing.pricePerKg || 0) :
                      bookingInfo.approxLoad === '6 kg' ? 6 * (settings?.pricing.pricePerKg || 0) :
                      bookingInfo.approxLoad === '7+ kg' ? 7 * (settings?.pricing.pricePerKg || 0) : 0
                    )}
                  </span>
                </div>
                
                {!isSubscription && bookingInfo.serviceType === 'Express Wash' && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500 dark:text-gray-400">Express Wash Premium</span>
                    <span className="font-medium text-gray-800 dark:text-gray-200">₹{settings?.pricing.expressWash.toFixed(2)}</span>
                  </div>
                )}

                {!isSubscription && bookingInfo.serviceType === 'Instant Booking' && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500 dark:text-gray-400">Instant Booking Premium</span>
                    <span className="font-medium text-gray-800 dark:text-gray-200">₹{settings?.pricing.instantBooking.toFixed(2)}</span>
                  </div>
                )}

                {!isSubscription && bookingInfo.pickupDrop && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500 dark:text-gray-400">Delivery Fee</span>
                    <span className="font-medium text-gray-800 dark:text-gray-200">
                      {bookingInfo.deliveryFee > 0 ? `₹${bookingInfo.deliveryFee.toFixed(2)}` : 'FREE'}
                    </span>
                  </div>
                )}

                {isSubscription && selectedPackage && (
                  <div className="flex justify-between text-sm text-green-600 dark:text-green-400 font-bold">
                    <span>Package Discount</span>
                    <span>-₹{(selectedPackage.originalPrice - selectedPackage.price).toFixed(2)}</span>
                  </div>
                )}
                
                {discount > 0 && (
                  <div className="flex justify-between text-sm text-green-600 dark:text-green-400 font-bold">
                    <span>Promo Discount ({(discount * 100).toFixed(0)}%)</span>
                    <span>-₹{(bookingInfo.price * discount).toFixed(2)}</span>
                  </div>
                )}
                
                <div className="flex justify-between text-lg font-bold pt-4 border-t border-gray-200 dark:border-gray-700 mt-4">
                  <span className="text-gray-800 dark:text-gray-100">Total</span>
                  <span className="text-blue-600 dark:text-blue-400">₹{discountedPrice.toFixed(2)}</span>
                </div>

                {!usePoints && !isSubscription && (
                  <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-2xl border border-indigo-100 dark:border-indigo-900/30 flex items-center justify-between mt-4">
                    <div className="flex items-center">
                      <div className="bg-indigo-600 dark:bg-indigo-700 p-2 rounded-lg mr-3">
                        <CheckCircle2 className="w-4 h-4 text-white" />
                      </div>
                      <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">Points Earned</span>
                    </div>
                    <span className="text-sm font-black text-indigo-600 dark:text-indigo-400">+{pointsEarned} pts</span>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    )}
  </div>
  );
};

export default Billing;
