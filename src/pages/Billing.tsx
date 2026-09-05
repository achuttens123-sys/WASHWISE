import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, CreditCard, Loader2, CheckCircle2, ShieldCheck, Wallet, Store, Zap, Check, Sparkles, Coins } from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { Booking } from '../types';

const Billing: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, updateUser } = useAuth();
  const { settings } = useSettings();
  
  const [loading, setLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'wallet' | 'card' | 'pay_at_store' | 'subscription_credits'>('wallet');
  const [error, setError] = useState('');
  const [promoCode, setPromoCode] = useState('');
  const [discount, setDiscount] = useState(0);
  const [promoError, setPromoError] = useState('');
  const [promoApplied, setPromoApplied] = useState(false);
  const [storeName, setStoreName] = useState<string>('Loading...');
  const [autoDiscount, setAutoDiscount] = useState(0);
  const [limitedOffers, setLimitedOffers] = useState<any[]>([]);
  const [appliedLimitedOffer, setAppliedLimitedOffer] = useState<any>(null);
  const [isApplyingOffer, setIsApplyingOffer] = useState(false);

  const isSubscription = searchParams.get('type') === 'subscription';
  const packageId = searchParams.get('packageId');
  const selectedPackage = (settings?.subscriptionPlans || []).find(p => p.id === packageId);

  let parsedPieceBreakdown: any[] = [];
  try {
    const rawBreakdown = searchParams.get('pieceBreakdown');
    if (rawBreakdown) {
      parsedPieceBreakdown = JSON.parse(rawBreakdown);
    }
  } catch (e) {
    console.error('Failed to parse pieceBreakdown:', e);
  }

  let parsedGarmentPieces: Record<string, number> = {};
  try {
    const rawPieces = searchParams.get('garmentPieces');
    if (rawPieces) {
      parsedGarmentPieces = JSON.parse(rawPieces);
    }
  } catch (e) {
    console.error('Failed to parse garmentPieces:', e);
  }

  const parsedTotalPieces = parseInt(searchParams.get('totalPieces') || '0', 10);

  const bookingInfo = {
    date: searchParams.get('date') || '',
    slot: searchParams.get('slot') || '',
    pickupDrop: searchParams.get('pickupDrop') === 'true',
    serviceType: searchParams.get('serviceType') || '',
    approxLoad: searchParams.get('approxLoad') || '',
    totalPieces: parsedTotalPieces,
    garmentPieces: parsedGarmentPieces,
    pieceBreakdown: parsedPieceBreakdown,
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

  const isOfferActive = settings?.pricing?.limited_time_offer !== false;
  const normalActiveRate = isOfferActive 
    ? (settings?.pricing?.offer_price_per_kg ?? settings?.pricing?.pricePerKg ?? 39) 
    : (settings?.pricing?.regular_price_per_kg ?? 69);
  const expressActiveRate = isOfferActive 
    ? (settings?.pricing?.express_offer_price_per_kg ?? settings?.pricing?.expressWash ?? 45) 
    : (settings?.pricing?.express_regular_price_per_kg ?? 89);

  const getLoadKg = (approxLoad: string): number => {
    if (approxLoad === '5 kg') return 5;
    if (approxLoad === '6 kg') return 6;
    if (approxLoad === '7+ kg') return 7;
    return 4;
  };

  const subscriberLoadKg = getLoadKg(bookingInfo.approxLoad);

  // Compute base direct price (fallback if query param was missing)
  const computedBasePrice = isSubscription 
    ? (selectedPackage?.price || 0)
    : (bookingInfo.price > 0 ? bookingInfo.price : (
        bookingInfo.serviceType === 'Wash & Fold (Per Piece)'
          ? (bookingInfo.pieceBreakdown || []).reduce((s: number, i: any) => s + (i.totalPrice || 0), 0)
          : bookingInfo.serviceType === 'Express Wash'
            ? (subscriberLoadKg * expressActiveRate)
            : (subscriberLoadKg * normalActiveRate)
      ));

  const isSubscriber = (user?.userType === 'subscriber' || !!user?.subscriptionPaid);
  const directDeliveryFee = (!isSubscription && bookingInfo.pickupDrop && !isSubscriber)
    ? (bookingInfo.deliveryFee > 0 ? bookingInfo.deliveryFee : (settings?.pricing?.deliveryFee ?? 30))
    : 0;

  const appliedDiscountAmount = appliedLimitedOffer 
    ? Math.max(0, computedBasePrice - appliedLimitedOffer.discountedPrice)
    : Math.max(0, autoDiscount + (computedBasePrice - autoDiscount) * discount);

  const directPriceWithoutDelivery = appliedLimitedOffer 
    ? appliedLimitedOffer.discountedPrice
    : Math.max(0, (computedBasePrice - autoDiscount) * (1 - discount));

  const finalPrice = isSubscription 
    ? directPriceWithoutDelivery 
    : directPriceWithoutDelivery + directDeliveryFee;

  const isPerPiece = bookingInfo.serviceType === 'Wash & Fold (Per Piece)';
  const parsedTotalCreditsParam = searchParams.get('totalCredits');

  // Calculate credits needed for this booking
  let bookingCreditsNeeded = 0;
  if (isPerPiece) {
    if (parsedTotalCreditsParam && !isNaN(parseInt(parsedTotalCreditsParam, 10))) {
      bookingCreditsNeeded = parseInt(parsedTotalCreditsParam, 10);
    } else {
      bookingCreditsNeeded = (bookingInfo.pieceBreakdown || []).reduce((sum: number, item: any) => {
        return sum + (item.totalCredits || (item.unitCredits ? item.unitCredits * item.count : (item.subscriberCredits || 3) * item.count) || 0);
      }, 0);
    }
  } else {
    bookingCreditsNeeded = subscriberLoadKg * 10;
  }

  // Available credits balance (from Subscription or Loyalty wash rewards)
  const userCurrentCredits = user?.laundryCredits !== undefined && user?.laundryCredits !== null && !isNaN(user.laundryCredits)
    ? user.laundryCredits
    : (user?.kilosLeft !== undefined ? user.kilosLeft * 10 : 0);

  const subscriberTotalMonthlyCredits = user?.totalMonthlyCredits || (
    user?.package === 'super_premium' ? 320 :
    user?.package === 'premium' ? 200 :
    user?.package === 'standard' ? 160 : 120
  );

  const userRemainingCredits = Math.max(0, userCurrentCredits - bookingCreditsNeeded);
  const userDeficitCredits = Math.max(0, bookingCreditsNeeded - userCurrentCredits);
  const hasInsufficientCredits = userDeficitCredits > 0;
  const userRemainingKilos = Math.floor(userRemainingCredits / 10);

  // Selection state for payment option: 'credits' vs 'direct'
  const [paymentOption, setPaymentOption] = useState<'credits' | 'direct'>(() => {
    if (isSubscription) return 'direct';
    if (userCurrentCredits >= bookingCreditsNeeded) return 'credits';
    return 'direct';
  });

  const isPayingWithCredits = !isSubscription && paymentOption === 'credits';

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
        const fraction = foundPromo.discountValue / (computedBasePrice || 1);
        setDiscount(fraction);
      }
      setPromoApplied(true);
    } else {
      setPromoError('Invalid promo code');
      setDiscount(0);
      setPromoApplied(false);
    }
  };

  const handleSubscriberBook = async () => {
    if (!user) return;
    if (hasInsufficientCredits) {
      setError(`Insufficient Laundry Credits. This order requires ${bookingCreditsNeeded} Credits, but you have ${userCurrentCredits} Credits available.`);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/payments/process-booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.uid,
          paymentMethod: 'subscription_credits',
          bookingDetails: {
            ...bookingInfo,
            price: 0,
            discountAmount: 0
          }
        })
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to book using credits');
      }

      const newCreditsLeft = userRemainingCredits;
      const newKilosLeft = userRemainingKilos;
      if (updateUser) {
        await updateUser({ 
          laundryCredits: newCreditsLeft,
          kilosLeft: newKilosLeft 
        });
      }

      if (data.bookingDocId || data.bookingId) {
        localStorage.setItem('lastBookingId', data.bookingDocId || data.bookingId);
      }

      navigate('/confirmation');
    } catch (err: any) {
      console.error('Error completing credit booking:', err);
      setError(err.message || 'Failed to complete booking. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handlePayment = async () => {
    if (!user) return;
    setLoading(true);
    setError('');

    try {
      if (isSubscription) {
        if (paymentMethod === 'wallet' && (user.walletBalance || 0) < finalPrice) {
          setError('Insufficient wallet balance for this subscription.');
          setLoading(false);
          return;
        }

        const response = await fetch('/api/payments/process-subscription', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: user.uid,
            packageId: packageId || 'basic',
            paymentMethod
          })
        });

        const data = await response.json();
        if (!response.ok || !data.success) {
          throw new Error(data.error || 'Subscription activation failed');
        }

        const kgLimit = selectedPackage?.kgLimit ?? 12;
        const creditsLimit = (selectedPackage?.kgLimit ?? 12) * 10;
        const subData: any = {
          userType: 'subscriber' as const,
          package: packageId || 'basic',
          subscriptionPaid: true,
          kilosLeft: kgLimit,
          laundryCredits: creditsLimit,
          totalMonthlyCredits: creditsLimit,
          subscriptionStartDate: new Date().toISOString()
        };
        if (paymentMethod === 'wallet') {
          subData.walletBalance = Math.max(0, (user.walletBalance || 0) - finalPrice);
        }
        if (updateUser) {
          await updateUser(subData);
        }

        navigate('/dashboard');
        return;
      }

      // If paying through credits
      if (isPayingWithCredits || paymentMethod === 'subscription_credits') {
        await handleSubscriberBook();
        return;
      }

      // Regular direct payment wash booking
      if (paymentMethod === 'wallet' && (user.walletBalance || 0) < finalPrice) {
        setError('Insufficient wallet balance. Please choose another payment method or top up your wallet.');
        setLoading(false);
        return;
      }

      const response = await fetch('/api/payments/process-booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.uid,
          paymentMethod,
          bookingDetails: {
            ...bookingInfo,
            price: computedBasePrice,
            deliveryFee: directDeliveryFee,
            discountAmount: appliedDiscountAmount,
            appliedPromoCode: promoApplied ? promoCode : undefined,
            appliedOfferId: appliedLimitedOffer?.offerId || undefined
          }
        })
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to process booking');
      }

      if (paymentMethod === 'wallet' && updateUser) {
        await updateUser({
          walletBalance: Math.max(0, (user.walletBalance || 0) - finalPrice)
        });
      }

      if (data.bookingDocId || data.bookingId) {
        localStorage.setItem('lastBookingId', data.bookingDocId || data.bookingId);
      }

      navigate('/confirmation');
    } catch (err: any) {
      setError(err.message || 'Payment failed. Please try again.');
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

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
            {(settings?.subscriptionPlans || []).map((plan) => {
              const regPrice = plan.regular_price || plan.originalPrice || ((plan.kgLimit || 12) * (settings?.pricing?.regular_price_per_kg || 69));
              const activePrice = plan.price;
              const hasDiscount = settings?.pricing?.limited_time_offer !== false && regPrice > activePrice;
              const savings = Math.max(0, regPrice - activePrice);

              return (
                <motion.div
                  key={plan.id}
                  whileHover={{ y: -8 }}
                  className="bg-white dark:bg-gray-900 p-6 sm:p-8 rounded-2xl sm:rounded-[3rem] border-2 border-gray-100 dark:border-gray-800 shadow-xl hover:border-blue-500 transition-all flex flex-col"
                >
                  <div className="mb-6">
                    <h3 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight uppercase mb-2">{plan.name}</h3>
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl sm:text-4xl font-black tracking-tight text-blue-600 dark:text-blue-400">₹{activePrice}</span>
                      <span className="text-gray-400 font-bold uppercase text-[10px] tracking-wider">/ month</span>
                    </div>
                    {hasDiscount && (
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-xs sm:text-sm text-gray-400 dark:text-gray-500 line-through font-bold">₹{regPrice}</span>
                        <span className="text-[10px] font-black text-emerald-700 dark:text-emerald-300 uppercase bg-emerald-100/90 dark:bg-emerald-950/60 border border-emerald-300/60 dark:border-emerald-800/60 px-2 py-0.5 rounded-md shadow-xs">
                          Save ₹{savings}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="space-y-4 mb-8 flex-1">
                    <div className="flex items-center gap-3 text-sm font-bold text-gray-600 dark:text-gray-300">
                      <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
                      <span>{plan.kgLimit} KG Monthly Limit</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm font-bold text-gray-600 dark:text-gray-300">
                      <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
                      <span>{plan.credits || ((plan.kgLimit || 12) * 10)} Monthly Credits</span>
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
              );
            })}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 sm:gap-8">
          <div className="md:col-span-8 space-y-4 sm:space-y-6">
            {/* Ask for option to pay through credits or through direct payment */}
            {!isSubscription && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white dark:bg-gray-900 p-5 sm:p-6 rounded-2xl sm:rounded-3xl shadow-xl border border-gray-100 dark:border-gray-800 space-y-4"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-base sm:text-lg font-black text-gray-900 dark:text-white uppercase tracking-tight flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                      Payment Option
                    </h2>
                    <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mt-0.5">
                      Choose how you would like to settle this wash booking
                    </p>
                  </div>
                  <span className="hidden sm:inline-flex px-3 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-[10px] font-black uppercase rounded-full tracking-wider border border-blue-200 dark:border-blue-800">
                    Flexible Payment
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  {/* Option 1: Pay through Credits */}
                  <motion.button
                    type="button"
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    onClick={() => {
                      setPaymentOption('credits');
                      setPaymentMethod('subscription_credits');
                      setError('');
                    }}
                    className={`p-4 sm:p-5 rounded-2xl border-2 text-left transition-all relative flex flex-col justify-between haptic-feedback overflow-hidden ${
                      isPayingWithCredits
                        ? 'border-emerald-600 bg-emerald-50/80 dark:bg-emerald-950/30 shadow-md ring-2 ring-emerald-500/20'
                        : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:border-emerald-300 dark:hover:border-emerald-700/60'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex items-center gap-3">
                        <div className={`p-2.5 rounded-xl ${isPayingWithCredits ? 'bg-emerald-600 text-white shadow-sm' : 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400'}`}>
                          <Zap className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-black text-sm text-gray-900 dark:text-white uppercase tracking-tight">Pay through Credits</span>
                          </div>
                          <p className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                            Deduct {bookingCreditsNeeded} Credits • ₹0.00 to pay
                          </p>
                        </div>
                      </div>
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center border-2 shrink-0 ${isPayingWithCredits ? 'border-emerald-600' : 'border-gray-300 dark:border-gray-600'}`}>
                        {isPayingWithCredits && <div className="w-2.5 h-2.5 bg-emerald-600 rounded-full" />}
                      </div>
                    </div>

                    <div className="pt-2 border-t border-emerald-100 dark:border-emerald-900/40 flex items-center justify-between text-xs font-semibold text-gray-600 dark:text-gray-300">
                      <span>Available: <strong>🧺 {userCurrentCredits} Credits</strong></span>
                      {hasInsufficientCredits ? (
                        <span className="text-[10px] font-black text-red-600 bg-red-100 dark:bg-red-900/40 px-2 py-0.5 rounded-md">Short {userDeficitCredits}</span>
                      ) : (
                        <span className="text-[10px] font-black text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/50 px-2 py-0.5 rounded-md uppercase">100% Free Wash</span>
                      )}
                    </div>
                  </motion.button>

                  {/* Option 2: Direct Payment */}
                  <motion.button
                    type="button"
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    onClick={() => {
                      setPaymentOption('direct');
                      if (paymentMethod === 'subscription_credits') {
                        setPaymentMethod('wallet');
                      }
                      setError('');
                    }}
                    className={`p-4 sm:p-5 rounded-2xl border-2 text-left transition-all relative flex flex-col justify-between haptic-feedback overflow-hidden ${
                      !isPayingWithCredits
                        ? 'border-blue-600 bg-blue-50/80 dark:bg-blue-950/30 shadow-md ring-2 ring-blue-500/20'
                        : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:border-blue-300 dark:hover:border-blue-700/60'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex items-center gap-3">
                        <div className={`p-2.5 rounded-xl ${!isPayingWithCredits ? 'bg-blue-600 text-white shadow-sm' : 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400'}`}>
                          <CreditCard className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-black text-sm text-gray-900 dark:text-white uppercase tracking-tight">Direct Payment</span>
                          </div>
                          <p className="text-[11px] font-bold text-blue-600 dark:text-blue-400">
                            ₹{finalPrice.toFixed(2)} • Wallet, UPI, Cards, Store
                          </p>
                        </div>
                      </div>
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center border-2 shrink-0 ${!isPayingWithCredits ? 'border-blue-600' : 'border-gray-300 dark:border-gray-600'}`}>
                        {!isPayingWithCredits && <div className="w-2.5 h-2.5 bg-blue-600 rounded-full" />}
                      </div>
                    </div>

                    <div className="pt-2 border-t border-blue-100 dark:border-blue-900/40 flex items-center justify-between text-xs font-semibold text-gray-600 dark:text-gray-300">
                      <span className="truncate">Save credits for later</span>
                      <span className="text-[10px] font-black text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/50 px-2 py-0.5 rounded-md uppercase">Earn +5 Credits</span>
                    </div>
                  </motion.button>
                </div>
              </motion.div>
            )}

            {/* Selected Payment Interface */}
            {isPayingWithCredits ? (
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-white dark:bg-gray-900 p-6 sm:p-8 rounded-2xl sm:rounded-3xl shadow-xl border-2 border-green-500/30 dark:border-green-500/20"
              >
                <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-100 dark:border-gray-800">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-green-500/10 text-green-600 dark:text-green-400 rounded-2xl">
                      {isSubscriber ? <Zap className="w-6 h-6" /> : <Coins className="w-6 h-6" />}
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 uppercase tracking-tight">
                        {isSubscriber ? 'Subscriber Account' : 'Loyalty Credits'}
                      </h2>
                      <p className="text-xs text-green-600 dark:text-green-400 font-bold uppercase tracking-wider">
                        {isSubscriber ? 'Active Subscription Coverage' : 'Loyalty Reward Coverage'}
                      </p>
                    </div>
                  </div>
                  <span className="px-3 py-1 bg-green-500/10 text-green-600 dark:text-green-400 text-[10px] font-black uppercase rounded-full tracking-widest border border-green-500/20">
                    {isSubscriber ? (user?.package ? `${user.package.toUpperCase()} PLAN` : 'BASIC PLAN') : 'LOYALTY REWARDS'}
                  </span>
                </div>

                <div className="p-6 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/20 rounded-2xl border border-green-100 dark:border-green-900/40 space-y-4 mb-6">
                  <div className="flex justify-between items-center text-sm font-bold text-gray-700 dark:text-gray-300">
                    <span>Current Credits Balance:</span>
                    <span className="text-xl font-black text-gray-900 dark:text-white">
                      🧺 {userCurrentCredits} {isSubscriber ? `/ ${subscriberTotalMonthlyCredits}` : ''} Credits
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm font-bold text-gray-700 dark:text-gray-300">
                    <span>
                      {isPerPiece ? `Garment Pieces Selected (${bookingInfo.totalPieces} pcs):` : `Laundry Weight (${bookingInfo.approxLoad}):`}
                    </span>
                    <span className="text-xl font-black text-green-600 dark:text-green-400">
                      {bookingCreditsNeeded} Credits
                    </span>
                  </div>
                  <div className="pt-3 border-t border-green-200 dark:border-green-900/50 flex justify-between items-center">
                    <span className="text-xs font-black uppercase tracking-widest text-gray-500 dark:text-gray-400">
                      Credits Balance After Order:
                    </span>
                    <span className={`text-2xl font-black ${userRemainingCredits >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600'}`}>
                      🧺 {userRemainingCredits} Credits
                    </span>
                  </div>
                </div>

                {hasInsufficientCredits && (
                  <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 rounded-xl text-xs font-bold space-y-3">
                    <div>
                      <p className="font-black uppercase tracking-wider">⚠️ Credit Balance Exceeded</p>
                      <p className="mt-1">
                        This booking requires <strong>{bookingCreditsNeeded} Credits</strong>, but you only have <strong>{userCurrentCredits} Credits</strong> available.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setPaymentOption('direct');
                        setPaymentMethod('wallet');
                        setError('');
                      }}
                      className="px-3 py-2 bg-blue-600 text-white rounded-lg font-bold text-[11px] uppercase tracking-wider hover:bg-blue-700 transition-colors inline-flex items-center gap-1.5"
                    >
                      <CreditCard className="w-3.5 h-3.5" />
                      Switch to Direct Payment (₹{finalPrice.toFixed(2)})
                    </button>
                  </div>
                )}

                {error && (
                  <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl text-xs font-bold uppercase tracking-wide">
                    {error}
                  </div>
                )}

                <motion.button
                  whileHover={{ scale: hasInsufficientCredits ? 1 : 1.02 }}
                  whileTap={{ scale: hasInsufficientCredits ? 1 : 0.98 }}
                  onClick={handleSubscriberBook}
                  disabled={loading || hasInsufficientCredits}
                  className={`w-full py-5 text-white font-black text-sm uppercase tracking-widest rounded-2xl shadow-xl transition-all flex items-center justify-center gap-3 haptic-feedback ${
                    hasInsufficientCredits 
                      ? 'bg-gray-400 cursor-not-allowed shadow-none' 
                      : 'bg-green-600 hover:bg-green-700 shadow-green-600/20 glow-green'
                  }`}
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-6 h-6 animate-spin" />
                      <span>Confirming Booking...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-6 h-6" />
                      <span>Confirm and Deduct {bookingCreditsNeeded} Credits</span>
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
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 flex items-center">
                  <CreditCard className="w-6 h-6 mr-2 text-blue-600 dark:text-blue-400" />
                  {isSubscription ? 'Payment Method' : 'Direct Payment Method'}
                </h2>
                {!isSubscription && isSubscriber && (
                  <span className="text-[10px] font-black text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-300/60 dark:border-emerald-800/60 px-2.5 py-1 rounded-full uppercase tracking-wider">
                    Free Delivery Active
                  </span>
                )}
              </div>
              
              <div className="space-y-4">
                {/* Wallet Option */}
                <motion.button
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={() => { setPaymentMethod('wallet'); setError(''); }}
                  className={`w-full p-4 rounded-2xl border-2 transition-all flex items-center justify-between haptic-feedback relative overflow-hidden ${
                    paymentMethod === 'wallet' ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20 glow-blue' : 'border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 hover:border-blue-200 dark:hover:border-blue-800'
                  }`}
                >
                  <div className="flex items-center">
                    <div className={`p-2 rounded-lg mr-4 ${paymentMethod === 'wallet' ? 'bg-blue-600' : 'bg-gray-100 dark:bg-gray-800'}`}>
                      <Wallet className={`w-5 h-5 ${paymentMethod === 'wallet' ? 'text-white' : 'text-gray-500 dark:text-gray-400'}`} />
                    </div>
                    <div className="text-left">
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-gray-800 dark:text-gray-100">Student Wallet</p>
                        <span className="px-2 py-0.5 bg-blue-600 text-white text-[9px] font-black uppercase rounded-md tracking-wider">1-Click Pay</span>
                      </div>
                      <p className={`text-xs font-medium ${paymentMethod === 'wallet' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'}`}>Balance: ₹{(user?.walletBalance || 0).toFixed(2)}</p>
                    </div>
                  </div>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center border-2 ${paymentMethod === 'wallet' ? 'border-blue-600' : 'border-gray-200 dark:border-gray-700'}`}>
                    {paymentMethod === 'wallet' && <motion.div layoutId="payment-dot" className="w-3 h-3 bg-blue-600 rounded-full" />}
                  </div>
                </motion.button>

                {/* Card / Online Payment Option */}
                <motion.button
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 }}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={() => { setPaymentMethod('card'); setError(''); }}
                  className={`w-full p-4 rounded-2xl border-2 transition-all flex items-center justify-between haptic-feedback relative overflow-hidden ${
                    paymentMethod === 'card' ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20 glow-blue' : 'border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 hover:border-blue-200 dark:hover:border-blue-800'
                  }`}
                >
                  <div className="flex items-center">
                    <div className={`p-2 rounded-lg mr-4 ${paymentMethod === 'card' ? 'bg-blue-600' : 'bg-gray-100 dark:bg-gray-800'}`}>
                      <CreditCard className={`w-5 h-5 ${paymentMethod === 'card' ? 'text-white' : 'text-gray-500 dark:text-gray-400'}`} />
                    </div>
                    <div className="text-left">
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-gray-800 dark:text-gray-100">Online Payment</p>
                        <span className="px-2 py-0.5 bg-green-600 text-white text-[9px] font-black uppercase rounded-md tracking-wider">Instant</span>
                      </div>
                      <p className={`text-xs font-medium ${paymentMethod === 'card' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'}`}>Cards, NetBanking & Instant Verification</p>
                    </div>
                  </div>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center border-2 ${paymentMethod === 'card' ? 'border-blue-600' : 'border-gray-200 dark:border-gray-700'}`}>
                    {paymentMethod === 'card' && <motion.div layoutId="payment-dot" className="w-3 h-3 bg-blue-600 rounded-full" />}
                  </div>
                </motion.button>

                {/* Pay at Store Option (Non-subscription orders only) */}
                {!isSubscription && (
                  <motion.button
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    onClick={() => { setPaymentMethod('pay_at_store'); setError(''); }}
                    className={`w-full p-4 rounded-2xl border-2 transition-all flex items-center justify-between haptic-feedback ${
                      paymentMethod === 'pay_at_store' ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20 glow-blue' : 'border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 hover:border-blue-200 dark:hover:border-blue-800'
                    }`}
                  >
                    <div className="flex items-center">
                      <div className={`p-2 rounded-lg mr-4 ${paymentMethod === 'pay_at_store' ? 'bg-blue-600' : 'bg-gray-100 dark:bg-gray-800'}`}>
                        <Store className={`w-5 h-5 ${paymentMethod === 'pay_at_store' ? 'text-white' : 'text-gray-500 dark:text-gray-400'}`} />
                      </div>
                      <div className="text-left">
                        <p className="font-bold text-gray-800 dark:text-gray-100">Pay at Store</p>
                        <p className={`text-xs font-medium ${paymentMethod === 'pay_at_store' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'}`}>Pay when dropping off or collecting garments</p>
                      </div>
                    </div>
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center border-2 ${paymentMethod === 'pay_at_store' ? 'border-blue-600' : 'border-gray-200 dark:border-gray-700'}`}>
                      {paymentMethod === 'pay_at_store' && <motion.div layoutId="payment-dot" className="w-3 h-3 bg-blue-600 rounded-full" />}
                    </div>
                  </motion.button>
                )}
              </div>

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
                    paymentMethod === 'wallet' ? `Pay ₹${finalPrice.toFixed(2)} with Wallet` :
                    paymentMethod === 'card' ? `Pay ₹${finalPrice.toFixed(2)} Online` :
                    `Confirm Booking (Pay at Store)`
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
                      <span className="text-gray-500 dark:text-gray-400">{bookingInfo.serviceType === 'Wash & Fold (Per Piece)' ? 'Total Items' : 'Load'}</span>
                      <span className="font-medium text-gray-800 dark:text-gray-200">{bookingInfo.approxLoad}</span>
                    </div>
                    {bookingInfo.serviceType === 'Wash & Fold (Per Piece)' && bookingInfo.pieceBreakdown && bookingInfo.pieceBreakdown.length > 0 && (
                      <div className="pt-2 pb-1">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Selected Garments</p>
                        <div className="p-3 bg-gray-50 dark:bg-gray-800/80 rounded-xl space-y-1.5 border border-gray-100 dark:border-gray-700/60">
                          {bookingInfo.pieceBreakdown.map((item: any, idx: number) => (
                            <div key={idx} className="flex justify-between text-xs text-gray-600 dark:text-gray-300">
                              <span>{item.count}x {item.name}</span>
                              {isPayingWithCredits ? (
                                <span className="font-semibold text-green-600 dark:text-green-400">
                                  {item.totalCredits || (item.subscriberCredits ? item.subscriberCredits * item.count : (item.unitCredits ? item.unitCredits * item.count : item.count * 3))} Credits
                                </span>
                              ) : (
                                <span className="font-semibold text-gray-800 dark:text-gray-200">₹{item.totalPrice}</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500 dark:text-gray-400">Pickup/Drop</span>
                      <span className="font-medium text-gray-800 dark:text-gray-200">
                        {bookingInfo.pickupDrop ? (isSubscriber || isPayingWithCredits ? 'Yes (Free)' : 'Yes') : 'No'}
                      </span>
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
                {/* Special Limited Offers (Direct payment only) */}
                {!isSubscription && !isPayingWithCredits && limitedOffers.length > 0 && !appliedLimitedOffer && (
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

                {appliedLimitedOffer && !isPayingWithCredits && (
                   <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl flex items-center justify-between">
                     <div>
                       <p className="text-[10px] font-black text-green-600 uppercase tracking-widest">Special Offer Applied</p>
                       <p className="text-sm font-bold text-green-800 dark:text-green-200">{appliedLimitedOffer.offerApplied}</p>
                     </div>
                     <CheckCircle2 className="w-5 h-5 text-green-600" />
                   </div>
                )}

                {/* Promo Code Input (Direct payment only) */}
                {!isSubscription && !isPayingWithCredits && (
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
                )}

                <div className="space-y-2 pt-2">
                  {isPayingWithCredits ? (
                    <>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500 dark:text-gray-400">
                          {isPerPiece ? `Wash & Fold (${bookingInfo.totalPieces} pcs)` : `Wash & Fold (${bookingInfo.approxLoad})`}
                        </span>
                        <span className="font-bold text-green-600 dark:text-green-400">
                          {bookingCreditsNeeded} Credits
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500 dark:text-gray-400">Coverage</span>
                        <span className="font-medium text-green-600 dark:text-green-400">
                          {isSubscriber ? 'Subscriber Plan (100% Covered)' : 'Loyalty Credits (100% Covered)'}
                        </span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500 dark:text-gray-400">
                          {bookingInfo.serviceType === 'Wash & Fold (Per Piece)'
                            ? `Wash & Fold (Per Piece - ${bookingInfo.totalPieces} items)`
                            : bookingInfo.serviceType === 'Express Wash' 
                              ? `Express Wash (₹${expressActiveRate}/kg)` 
                              : `Wash & Fold (₹${normalActiveRate}/kg)`}
                        </span>
                        <span className="font-medium text-gray-800 dark:text-gray-200">
                          ₹{isSubscription ? (selectedPackage?.originalPrice || selectedPackage?.price || 0).toFixed(2) : computedBasePrice.toFixed(2)}
                        </span>
                      </div>

                      {!isSubscription && bookingInfo.pickupDrop && (
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500 dark:text-gray-400">Delivery Fee</span>
                          <span className="font-medium text-gray-800 dark:text-gray-200">
                            {isSubscriber ? 'FREE (Subscriber Perk)' : (directDeliveryFee > 0 ? `₹${directDeliveryFee.toFixed(2)}` : 'FREE')}
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
                          <span>-₹{((computedBasePrice - autoDiscount) * discount).toFixed(2)}</span>
                        </div>
                      )}
                    </>
                  )}
                  
                  <div className="flex justify-between text-lg font-bold pt-4 border-t border-gray-200 dark:border-gray-700 mt-4">
                    <span className="text-gray-800 dark:text-gray-100">Total</span>
                    <span className="text-blue-600 dark:text-blue-400 font-black text-2xl">
                      {isPayingWithCredits ? '₹0.00' : `₹${finalPrice.toFixed(2)}`}
                    </span>
                  </div>
                  {isPayingWithCredits ? (
                    <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-widest text-right mt-1">
                      🧺 {bookingCreditsNeeded} Credits Deducted (Free Wash)
                    </p>
                  ) : (
                    <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-widest text-right mt-1">
                      ✨ Earn +5 Loyalty Credits on Completion
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
