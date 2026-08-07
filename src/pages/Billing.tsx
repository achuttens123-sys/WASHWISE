import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, CreditCard, Loader2, CheckCircle2, ShieldCheck, Wallet, QrCode, Smartphone, Check, Copy, ExternalLink, Zap } from 'lucide-react';
import { doc, getDoc, setDoc, updateDoc, collection, addDoc, runTransaction, onSnapshot } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { Booking, Slot } from '../types';
import { QRCodeSVG } from 'qrcode.react';
import { sendNotification } from '../services/NotificationService';
import { initiateRazorpayPayment } from '../services/RazorpayService';

const Billing: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, updateUser } = useAuth();
  const { settings } = useSettings();
  
  const [loading, setLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'razorpay' | 'wallet' | 'upi'>('razorpay');
  const [upiStep, setUpiStep] = useState<'id' | 'qr' | 'verify'>('id');
  const [upiId, setUpiId] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [promoCode, setPromoCode] = useState('');
  const [discount, setDiscount] = useState(0);
  const [promoError, setPromoError] = useState('');
  const [promoApplied, setPromoApplied] = useState(false);
  const [activeBookingId, setActiveBookingId] = useState<string | null>(null);
  const [storeName, setStoreName] = useState<string>('Loading...');
  const [autoDiscount, setAutoDiscount] = useState(0);
  const [limitedOffers, setLimitedOffers] = useState<any[]>([]);
  const [appliedLimitedOffer, setAppliedLimitedOffer] = useState<any>(null);
  const [isApplyingOffer, setIsApplyingOffer] = useState(false);

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
              const kgLimit = selectedPackage?.kgLimit ?? 12;
              const subData = {
                userType: 'subscriber' as const,
                package: data.packageId || packageId || 'basic',
                subscriptionPaid: true,
                kilosLeft: kgLimit,
                subscriptionStartDate: new Date().toISOString()
              };
              await updateDoc(doc(db, 'users', user!.uid), subData);
              if (updateUser) {
                await updateUser(subData);
              }
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

  // Calculate Auto Discounts (Global)
  useEffect(() => {
    if (settings?.discounts) {
      let totalAutoDiscount = 0;
      settings.discounts.forEach(d => {
        if (d.active) {
          const target = d.applicableFor || 'all';
          const isMatch = target === 'all' || 
                          (isSubscription && target === 'subscription') || 
                          (!isSubscription && target === 'wash');
          if (isMatch) {
            if (d.type === 'percentage') {
              totalAutoDiscount += (bookingInfo.price * (d.value / 100));
            } else {
              totalAutoDiscount += d.value;
            }
          }
        }
      });
      setAutoDiscount(totalAutoDiscount);
    }
  }, [settings?.discounts, bookingInfo.price, isSubscription]);

  // Fetch Active Limited Offers
  useEffect(() => {
    const fetchLimitedOffers = async () => {
      try {
        const res = await fetch('/api/offers/active');
        const data = await res.json();
        setLimitedOffers(data);
      } catch (err) {
        console.error("Error fetching limited offers:", err);
      }
    };
    fetchLimitedOffers();
  }, []);

  const applyLimitedOffer = async (offerId: string) => {
    setIsApplyingOffer(true);
    setError('');
    try {
      const response = await fetch('/api/booking/apply-offer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user?.uid,
          offerId,
          cartValue: bookingInfo.price - autoDiscount,
          serviceType: bookingInfo.serviceType,
          userDetails: {
            phone: bookingInfo.phone,
            address: bookingInfo.address
          }
        })
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error);

      setAppliedLimitedOffer(result);
      setDiscount(0); // Clear regular promo if limited is applied
      setPromoApplied(false);
      setPromoCode('');
    } catch (err: any) {
      setError(err.message || "Failed to apply special offer");
    } finally {
      setIsApplyingOffer(false);
    }
  };

  const finalPrice = appliedLimitedOffer 
    ? appliedLimitedOffer.discountedPrice
    : Math.max(0, (bookingInfo.price - autoDiscount) * (1 - discount));

  // UPI Payment Link
  const upiIdToUse = '9048270616@slc';
  const transactionNote = isSubscription 
    ? `Washwise Subscription ${selectedPackage?.name}` 
    : `Washwise Booking ${bookingInfo.date} ${bookingInfo.slot}`;
  const upiLink = `upi://pay?pa=${upiIdToUse}&pn=WASHWISE%20Laundry&am=${finalPrice.toFixed(2)}&cu=INR&tn=${encodeURIComponent(transactionNote)}`;

  const handleCopyUPI = () => {
    navigator.clipboard.writeText(upiIdToUse);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const applyPromoCode = () => {
    setPromoError('');
    const code = promoCode.trim().toUpperCase();
    
    if (!settings?.promos) {
      setPromoError('Promo codes currently unavailable');
      return;
    }

    const foundPromo = settings.promos.find(p => p.code.toUpperCase() === code && p.active);

    if (foundPromo) {
      const target = foundPromo.applicableFor || 'all';
      if (target === 'subscription' && !isSubscription) {
        setPromoError('This promo code is valid for subscription orders only');
        setDiscount(0);
        setPromoApplied(false);
        return;
      }
      if (target === 'wash' && isSubscription) {
        setPromoError('This promo code is valid for wash orders only');
        setDiscount(0);
        setPromoApplied(false);
        return;
      }

      // Check expiry if exists
      if (foundPromo.expiryDate) {
        const expiry = new Date(foundPromo.expiryDate);
        if (expiry < new Date()) {
          setPromoError('This promo code has expired');
          return;
        }
      }

      if (foundPromo.discountType === 'percentage') {
        setDiscount(foundPromo.discountValue / 100);
      } else {
        // For fixed discount, we'll calculate the fraction of base price to keep calculation consistent
        const fraction = foundPromo.discountValue / (bookingInfo.price || 1);
        setDiscount(fraction);
      }
      setPromoApplied(true);
    } else {
      setPromoError('Invalid promo code');
      setDiscount(0);
      setPromoApplied(false);
    }
  };

  const handlePayment = async () => {
    if (!user) return;
    
    if (paymentMethod === 'razorpay') {
      setLoading(true);
      setError('');
      try {
        await initiateRazorpayPayment({
          amount: finalPrice,
          description: isSubscription 
            ? `Subscription: ${selectedPackage?.name || 'WashWise Plan'}`
            : `Washwise Booking: ${bookingInfo.date} (${bookingInfo.slot})`,
          type: isSubscription ? 'subscription' : 'booking',
          userId: user.uid,
          userName: user.name,
          userEmail: user.email,
          userPhone: bookingInfo.phone || user.phone || '',
          bookingData: {
            userId: user.uid,
            userName: user.name,
            date: isSubscription ? new Date().toISOString().split('T')[0] : bookingInfo.date,
            timeSlot: isSubscription ? 'Subscription' : bookingInfo.slot,
            slot: bookingInfo.slot,
            pickupDrop: bookingInfo.pickupDrop,
            address: bookingInfo.address,
            phone: bookingInfo.phone,
            latitude: bookingInfo.latitude,
            longitude: bookingInfo.longitude,
            deliveryFee: bookingInfo.deliveryFee,
            storeId: bookingInfo.storeId,
            garmentInstructions: bookingInfo.garmentInstructions,
            serviceType: isSubscription ? 'Subscription' : bookingInfo.serviceType,
            approxLoad: isSubscription ? '1-2 kg' : bookingInfo.approxLoad,
            price: finalPrice
          },
          onSuccess: async (data: any) => {
            if (isSubscription) {
              try {
                const kgLimit = selectedPackage?.kgLimit ?? 12;
                const subData = {
                  userType: 'subscriber' as const,
                  package: packageId || 'basic',
                  subscriptionPaid: true,
                  kilosLeft: kgLimit,
                  subscriptionStartDate: new Date().toISOString()
                };
                await updateDoc(doc(db, 'users', user.uid), subData);
                if (updateUser) {
                  await updateUser(subData);
                }
              } catch (e) {
                console.error('Error updating Razorpay subscription status:', e);
              }
            }
            setLoading(false);
            if (data.bookingId) {
              localStorage.setItem('lastBookingId', data.bookingId);
            }
            sendNotification(user.uid, user.email, bookingInfo.phone, 'booking_confirmed', data.bookingId || 'SUB', {
              newSlot: isSubscription ? 'Subscription' : `${bookingInfo.date} at ${bookingInfo.slot}`
            });

            if (isSubscription) {
              navigate('/dashboard');
            } else {
              navigate('/confirmation');
            }
          },
          onError: (errMsg: string) => {
            setLoading(false);
            setError(errMsg);
          },
          onDismiss: () => {
            setLoading(false);
          }
        });
      } catch (err: any) {
        setLoading(false);
        setError(err.message || 'Razorpay payment failed');
      }
      return;
    }

    if (isSubscription && paymentMethod === 'wallet') {
      if ((user.walletBalance || 0) < finalPrice) {
        setError('Insufficient wallet balance.');
        return;
      }
      setLoading(true);
      try {
        const kgLimit = selectedPackage?.kgLimit ?? 12;
        const subData = {
          userType: 'subscriber' as const,
          package: packageId || 'basic',
          subscriptionPaid: true,
          kilosLeft: kgLimit,
          subscriptionStartDate: new Date().toISOString(),
          walletBalance: (user.walletBalance || 0) - finalPrice
        };
        await updateDoc(doc(db, 'users', user.uid), subData);
        if (updateUser) {
          await updateUser(subData);
        }
        navigate('/dashboard');
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
        price: finalPrice,
        status: 'pending',
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

  const completeInstantBooking = async () => {
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

      // Update Wallet
      const userData = userDoc.exists() ? userDoc.data() : {};
      const currentWallet = userData.walletBalance || 0;
      
      if (paymentMethod === 'wallet') {
        if (currentWallet < finalPrice) throw new Error('Insufficient wallet balance.');
        transaction.update(userRef, { walletBalance: currentWallet - finalPrice });
      }

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
        price: finalPrice,
        status: 'paid',
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

      if (isSubscription && user) {
        const kgLimit = selectedPackage?.kgLimit ?? 12;
        const subData = {
          userType: 'subscriber' as const,
          package: packageId || 'basic',
          subscriptionPaid: true,
          kilosLeft: kgLimit,
          subscriptionStartDate: new Date().toISOString()
        };
        await updateDoc(doc(db, 'users', user.uid), subData);
        if (updateUser) {
          await updateUser(subData);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const isSubscriberBooking = (user?.userType === 'subscriber' || !!user?.subscriptionPaid) && !isSubscription;

  const getLoadKg = (approxLoad: string): number => {
    if (approxLoad === '5 kg') return 5;
    if (approxLoad === '6 kg') return 6;
    if (approxLoad === '7+ kg') return 7;
    return 4;
  };

  const subscriberLoadKg = getLoadKg(bookingInfo.approxLoad);
  const subscriberCurrentKilosLeft = user?.kilosLeft !== undefined && user?.kilosLeft !== null && !isNaN(user.kilosLeft)
    ? user.kilosLeft
    : 12;
  const subscriberRemainingKilos = Math.max(0, subscriberCurrentKilosLeft - subscriberLoadKg);

  const handleSubscriberBook = async () => {
    if (!user) return;
    setLoading(true);
    setError('');

    try {
      const newKilosLeft = subscriberRemainingKilos;

      await updateDoc(doc(db, 'users', user.uid), {
        kilosLeft: newKilosLeft
      });
      if (updateUser) {
        await updateUser({ kilosLeft: newKilosLeft });
      }

      const slotId = `${bookingInfo.date}_${bookingInfo.slot}`;
      const slotRef = doc(db, 'slots', slotId);

      let assignedMachine = 1;
      try {
        await runTransaction(db, async (transaction) => {
          const slotDoc = await transaction.get(slotRef);
          let slotData: Slot = slotDoc.exists() 
            ? slotDoc.data() as Slot 
            : { date: bookingInfo.date, timeSlot: bookingInfo.slot, machines: { '1': '', '2': '', '3': '', '4': '' } };

          for (let i = 1; i <= 4; i++) {
            if (!slotData.machines[i.toString()]) {
              assignedMachine = i;
              break;
            }
          }
          const updatedMachines = { ...slotData.machines, [assignedMachine.toString()]: user.uid };
          if (!slotDoc.exists()) {
            transaction.set(slotRef, { ...slotData, machines: updatedMachines });
          } else {
            transaction.update(slotRef, { machines: updatedMachines });
          }

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
            deliveryFee: 0,
            storeId: bookingInfo.storeId,
            garmentInstructions: bookingInfo.garmentInstructions,
            serviceType: bookingInfo.serviceType as any,
            approxLoad: bookingInfo.approxLoad as any,
            price: 0,
            status: 'paid',
            createdAt: new Date().toISOString()
          };

          transaction.set(bookingRef, booking);
          localStorage.setItem('lastBookingId', bookingRef.id);
          
          sendNotification(user.uid, user.email, bookingInfo.phone, 'booking_confirmed', bookingRef.id, {
            newSlot: `${bookingInfo.date} at ${bookingInfo.slot}`
          });
        });
      } catch (e: any) {
        console.error('Transaction error, creating direct booking:', e);
        const bookingRef = doc(collection(db, 'bookings'));
        const booking: Booking = {
          userId: user.uid,
          userName: user.name,
          date: bookingInfo.date,
          timeSlot: bookingInfo.slot,
          machineNumber: 1,
          pickupDrop: bookingInfo.pickupDrop,
          address: bookingInfo.address,
          phone: bookingInfo.phone,
          latitude: bookingInfo.latitude,
          longitude: bookingInfo.longitude,
          deliveryFee: 0,
          storeId: bookingInfo.storeId,
          garmentInstructions: bookingInfo.garmentInstructions,
          serviceType: bookingInfo.serviceType as any,
          approxLoad: bookingInfo.approxLoad as any,
          price: 0,
          status: 'paid',
          createdAt: new Date().toISOString()
        };
        await setDoc(bookingRef, booking);
        localStorage.setItem('lastBookingId', bookingRef.id);
      }

      navigate('/confirmation');
    } catch (err: any) {
      console.error('Error completing subscriber booking:', err);
      setError(err.message || 'Failed to complete booking. Please try again.');
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
                    <span>Free Maintenance Checks</span>
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
            {isSubscriberBooking ? (
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-white dark:bg-gray-900 p-6 sm:p-8 rounded-2xl sm:rounded-3xl shadow-xl border-2 border-green-500/30 dark:border-green-500/20"
              >
                <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-100 dark:border-gray-800">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-green-500/10 text-green-600 dark:text-green-400 rounded-2xl">
                      <Zap className="w-6 h-6" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 uppercase tracking-tight">Subscriber Account</h2>
                      <p className="text-xs text-green-600 dark:text-green-400 font-bold uppercase tracking-wider">Active Subscription Coverage</p>
                    </div>
                  </div>
                  <span className="px-3 py-1 bg-green-500/10 text-green-600 dark:text-green-400 text-[10px] font-black uppercase rounded-full tracking-widest border border-green-500/20">
                    {user?.package ? `${user.package.toUpperCase()} PLAN` : 'BASIC PLAN'}
                  </span>
                </div>

                <div className="p-6 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/20 rounded-2xl border border-green-100 dark:border-green-900/40 space-y-4 mb-8">
                  <div className="flex justify-between items-center text-sm font-bold text-gray-700 dark:text-gray-300">
                    <span>Current Kilos Balance:</span>
                    <span className="text-xl font-black text-gray-900 dark:text-white">{subscriberCurrentKilosLeft} KG</span>
                  </div>
                  <div className="flex justify-between items-center text-sm font-bold text-gray-700 dark:text-gray-300">
                    <span>Laundry Weight Selected:</span>
                    <span className="text-xl font-black text-blue-600 dark:text-blue-400">{subscriberLoadKg} KG ({bookingInfo.approxLoad})</span>
                  </div>
                  <div className="pt-3 border-t border-green-200 dark:border-green-900/50 flex justify-between items-center">
                    <span className="text-xs font-black uppercase tracking-widest text-gray-500 dark:text-gray-400">Kilos Left After Booking:</span>
                    <span className={`text-2xl font-black ${subscriberRemainingKilos >= 0 ? 'text-green-600 dark:text-green-400' : 'text-amber-600'}`}>
                      {subscriberRemainingKilos} KG
                    </span>
                  </div>
                </div>

                {error && (
                  <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl text-xs font-bold uppercase tracking-wide">
                    {error}
                  </div>
                )}

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleSubscriberBook}
                  disabled={loading}
                  className="w-full py-5 bg-green-600 hover:bg-green-700 text-white font-black text-sm uppercase tracking-widest rounded-2xl shadow-xl shadow-green-600/20 transition-all flex items-center justify-center gap-3 haptic-feedback glow-green"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-6 h-6 animate-spin" />
                      <span>Confirming Booking...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-6 h-6" />
                      <span>Confirm and Book</span>
                    </>
                  )}
                </motion.button>
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-white dark:bg-gray-900 p-6 sm:p-8 rounded-2xl sm:rounded-3xl shadow-xl border border-blue-50 dark:border-gray-800"
              >
              <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-6 flex items-center">
                <CreditCard className="w-6 h-6 mr-2 text-blue-600 dark:text-blue-400" /> Payment Method
              </h2>
              
              <div className="space-y-4">
                {/* Razorpay Option */}
                <motion.button
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={() => { setPaymentMethod('razorpay'); setError(''); }}
                  className={`w-full p-4 rounded-2xl border-2 transition-all flex items-center justify-between haptic-feedback relative overflow-hidden ${
                    paymentMethod === 'razorpay' ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20 glow-blue' : 'border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 hover:border-blue-200 dark:hover:border-blue-800'
                  }`}
                >
                  <div className="flex items-center">
                    <div className={`p-2 rounded-lg mr-4 ${paymentMethod === 'razorpay' ? 'bg-blue-600' : 'bg-gray-100 dark:bg-gray-800'}`}>
                      <CreditCard className={`w-5 h-5 ${paymentMethod === 'razorpay' ? 'text-white' : 'text-gray-500 dark:text-gray-400'}`} />
                    </div>
                    <div className="text-left">
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-gray-800 dark:text-gray-100">Razorpay Online</p>
                        <span className="px-2 py-0.5 bg-blue-600 text-white text-[9px] font-black uppercase rounded-md tracking-wider">Fast & Secure</span>
                      </div>
                      <p className={`text-xs font-medium ${paymentMethod === 'razorpay' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'}`}>Cards, UPI, NetBanking, Wallets</p>
                    </div>
                  </div>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center border-2 ${paymentMethod === 'razorpay' ? 'border-blue-600' : 'border-gray-200 dark:border-gray-700'}`}>
                    {paymentMethod === 'razorpay' && <motion.div layoutId="payment-dot" className="w-3 h-3 bg-blue-600 rounded-full" />}
                  </div>
                </motion.button>

                {/* Wallet Option */}
                <motion.button
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 }}
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
                      <p className="font-bold text-gray-800 dark:text-gray-100">Direct UPI Scan</p>
                      <p className={`text-xs font-medium ${paymentMethod === 'upi' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'}`}>GPay, PhonePe, Paytm QR</p>
                    </div>
                  </div>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center border-2 ${paymentMethod === 'upi' ? 'border-blue-600' : 'border-gray-200 dark:border-gray-700'}`}>
                    {paymentMethod === 'upi' && <motion.div layoutId="payment-dot" className="w-3 h-3 bg-blue-600 rounded-full" />}
                  </div>
                </motion.button>
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
                          <img src="https://upload.wikimedia.org/wikipedia/commons/c/c4/Google_Pay_Logo.svg" className="h-4" alt="GPay" referrerPolicy="no-referrer" />
                          <img src="https://upload.wikimedia.org/wikipedia/commons/e/e1/PhonePe_Logo.svg" className="h-4" alt="PhonePe" referrerPolicy="no-referrer" />
                          <img src="https://upload.wikimedia.org/wikipedia/commons/2/24/Paytm_Logo_%28standalone%29.svg" className="h-4" alt="Paytm" referrerPolicy="no-referrer" />
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
                          <p className="text-sm text-gray-500 dark:text-gray-400">Please open your UPI app and approve the payment of ₹{finalPrice.toFixed(2)}</p>
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
                    paymentMethod === 'razorpay' ? `Pay ₹${finalPrice.toFixed(2)} via Razorpay` :
                    paymentMethod === 'upi' && upiStep === 'id' ? 'Verify UPI ID' : 
                    paymentMethod === 'upi' && upiStep === 'qr' ? 'I have paid' :
                    `Pay ₹${finalPrice.toFixed(2)}`
                  )}
                </motion.button>
              </div>
            </motion.div>
          )}
          </div>

          <div className="md:col-span-4 lg:col-span-4 w-full">
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-gray-50 dark:bg-gray-900 p-5 rounded-[2rem] border border-gray-100 dark:border-gray-800 md:sticky md:top-8 w-full shadow-sm space-y-6"
            >
              <h3 className="text-lg font-black text-gray-800 dark:text-gray-100 uppercase tracking-tight border-b border-gray-200 dark:border-gray-700 pb-3">Summary</h3>
              <div className="space-y-3 pb-6 border-b border-gray-200 dark:border-gray-700">
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
                        <p className="text-[10px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-widest mb-1">Garment Instructions & Care</p>
                        <p className="text-xs text-amber-800 dark:text-amber-200 font-medium italic">"{bookingInfo.garmentInstructions}"</p>
                        <p className="text-[10px] text-amber-700/80 dark:text-amber-300/80 font-medium mt-1.5 pt-1.5 border-t border-amber-200/50 dark:border-amber-800/40">
                          *Color bleeding, white item segregation & special care details noted for store staff.
                        </p>
                      </div>
                    )}
                  </>
                )}
              </div>
              
              <div className="pt-4 space-y-4">
                {/* Special Limited Offers */}
                {!isSubscription && limitedOffers.length > 0 && !appliedLimitedOffer && (
                   <div className="space-y-3 pb-4 border-b border-gray-100 dark:border-gray-800">
                     <label className="text-[10px] font-black text-amber-600 dark:text-amber-500 uppercase tracking-widest flex items-center gap-2">
                       <Zap className="w-3 h-3 fill-current" /> Special Offers Only For Today
                     </label>
                     <div className="space-y-2">
                       {limitedOffers.map(offer => (
                         <button
                           key={offer.offerId}
                           onClick={() => applyLimitedOffer(offer.offerId)}
                           disabled={isApplyingOffer || offer.remainingSlots === 0}
                           className="w-full p-3 bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/20 rounded-xl text-left hover:border-amber-300 transition-all group disabled:opacity-50"
                         >
                           <div className="flex justify-between items-center">
                             <p className="text-xs font-black text-amber-900 dark:text-amber-100 uppercase">{offer.name}</p>
                             <span className="text-[10px] font-black text-amber-600 bg-amber-200/50 px-2 py-0.5 rounded-full">{offer.remainingSlots} LEFT</span>
                           </div>
                           <p className="text-[10px] text-amber-700 dark:text-amber-400 font-medium mt-1">{offer.description}</p>
                         </button>
                       ))}
                     </div>
                   </div>
                )}

                {appliedLimitedOffer && (
                   <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl flex items-center justify-between">
                     <div>
                       <p className="text-[10px] font-black text-green-600 uppercase tracking-widest">Special Offer Applied</p>
                       <p className="text-sm font-bold text-green-800 dark:text-green-200">{appliedLimitedOffer.offerApplied}</p>
                     </div>
                     <CheckCircle2 className="w-5 h-5 text-green-600" />
                   </div>
                )}

                {/* Promo Code Input */}
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">Promo Code</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={promoCode}
                      onChange={(e) => setPromoCode(e.target.value)}
                      placeholder="ENTER CODE"
                      className="flex-1 min-w-0 px-3 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold uppercase tracking-wider focus:ring-2 focus:ring-blue-500 outline-none dark:text-gray-100"
                    />
                    <button 
                      onClick={applyPromoCode}
                      className="px-4 py-2.5 bg-blue-600 dark:bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-blue-700 transition-all flex-shrink-0"
                    >
                      Apply
                    </button>
                  </div>
                  {promoError && <p className="text-red-500 text-[10px] font-bold uppercase tracking-wide px-1">{promoError}</p>}
                  {promoApplied && <p className="text-green-600 text-[10px] font-bold uppercase tracking-wide px-1">Promo applied!</p>}
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
                  
                  {autoDiscount > 0 && (
                    <div className="flex justify-between text-sm text-green-600 dark:text-green-400 font-bold">
                      <span>Automatic Discount</span>
                      <span>-₹{autoDiscount.toFixed(2)}</span>
                    </div>
                  )}

                  {appliedLimitedOffer && (
                    <div className="flex justify-between text-sm text-green-600 dark:text-green-400 font-bold mb-2">
                      <span>Limited Offer: {appliedLimitedOffer.offerApplied}</span>
                      <span>-₹{(appliedLimitedOffer.originalPrice - appliedLimitedOffer.discountedPrice).toFixed(2)}</span>
                    </div>
                  )}

                  {discount > 0 && !appliedLimitedOffer && (
                    <div className="flex justify-between text-sm text-green-600 dark:text-green-400 font-bold">
                      <span>Promo Discount</span>
                      <span>-₹{((bookingInfo.price - autoDiscount) * discount).toFixed(2)}</span>
                    </div>
                  )}
                  
                  <div className="flex justify-between text-lg font-bold pt-4 border-t border-gray-200 dark:border-gray-700 mt-4">
                    <span className="text-gray-800 dark:text-gray-100">Total</span>
                    <span className="text-blue-600 dark:text-blue-400 font-black text-2xl">
                      {isSubscriberBooking ? '₹0.00' : `₹${finalPrice.toFixed(2)}`}
                    </span>
                  </div>
                  {isSubscriberBooking && (
                    <p className="text-[10px] text-green-600 dark:text-green-400 font-bold uppercase tracking-widest text-right mt-1">
                      Covered by Subscriber Account
                    </p>
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
