import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowLeft, Check, Package, Truck, Weight, Info, MapPin, Phone, 
  AlertTriangle, Home, Search, Store as StoreIcon, Plus, Receipt, Shirt 
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { StoreService } from '../services/StoreService';
import { Store, checkIsSubscriber } from '../types';
import TermsModal from '../components/TermsModal';
import { GarmentPieceSelector } from '../components/GarmentPieceSelector';
import { calculateGarmentTotal, GARMENT_CATALOG } from '../data/garmentCatalog';

const BookingDetails: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, updateUser } = useAuth();
  const { settings } = useSettings();
  
  const [acceptedTerms, setAcceptedTerms] = useState(true);
  const [isTermsOpen, setIsTermsOpen] = useState(false);
  const [isAddingNewAddress, setIsAddingNewAddress] = useState(false);
  const [newAddressText, setNewAddressText] = useState('');
  const [isAddingNewPhone, setIsAddingNewPhone] = useState(false);
  const [newPhoneText, setNewPhoneText] = useState('');
  
  const dateStr = searchParams.get('date') || '';
  const timeSlot = searchParams.get('slot') || '';

  const [bookingData, setBookingData] = useState({
    pickupDrop: false,
    pickupDropAnswered: true,
    serviceType: 'Wash & Fold' as 'Wash & Fold' | 'Express Wash' | 'Wash & Fold (Per Piece)',
    serviceTypeSelected: true,
    approxLoad: '1-4 kg' as '1-4 kg' | '5 kg' | '6 kg' | '7+ kg',
    address: '',
    phone: '',
    latitude: 0,
    longitude: 0,
    deliveryFee: 0,
    storeId: '',
    garmentInstructions: ''
  });

  const [garmentCounts, setGarmentCounts] = useState<Record<string, number>>({});
  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);
  const [storeSearch, setStoreSearch] = useState('');

  useEffect(() => {
    const fetchStores = async () => {
      const allStores = await StoreService.getStores();
      setStores(allStores);
      if (allStores.length > 0) {
        setSelectedStore(allStores[0]);
        setBookingData(prev => ({ ...prev, storeId: allStores[0].id }));
      }
    };
    fetchStores();

    // Prefetch next checkout steps for fast 0ms booking transitions
    const prefetchNextSteps = () => {
      import('./Billing').catch(() => {});
      import('./Confirmation').catch(() => {});
    };
    if ('requestIdleCallback' in window) {
      (window as any).requestIdleCallback(prefetchNextSteps);
    } else {
      setTimeout(prefetchNextSteps, 800);
    }
  }, []);

  useEffect(() => {
    if (user) {
      setBookingData(prev => ({
        ...prev,
        address: prev.address || user.address || '',
        phone: prev.phone || user.phone || ''
      }));
    }
  }, [user]);

  const isOfferActive = settings?.pricing?.limited_time_offer !== false;
  const isExpress = bookingData.serviceType === 'Express Wash';
  const isPerPiece = bookingData.serviceType === 'Wash & Fold (Per Piece)';
  
  const standardRate = isOfferActive
    ? (settings?.pricing?.offer_price_per_kg ?? settings?.pricing?.pricePerKg ?? 39)
    : (settings?.pricing?.regular_price_per_kg ?? 69);
    
  const expressRate = isOfferActive
    ? (settings?.pricing?.express_offer_price_per_kg ?? settings?.pricing?.expressWash ?? 45)
    : (settings?.pricing?.express_regular_price_per_kg ?? 89);

  const regularStandardRate = settings?.pricing?.regular_price_per_kg ?? 69;
  const regularExpressRate = settings?.pricing?.express_regular_price_per_kg ?? 89;

  const currentRatePerKg = isExpress ? expressRate : standardRate;
  const isSubscriber = checkIsSubscriber(user);
  const deliveryFee = (bookingData.pickupDrop && !isSubscriber) ? (settings?.pricing?.deliveryFee ?? 30) : 0;

  const { 
    totalPieces, 
    totalPrice: pieceTotalPrice, 
    totalRegularPrice: pieceTotalRegularPrice,
    totalSavings: pieceTotalSavings,
    totalCredits: pieceTotalCredits, 
    breakdown: pieceBreakdown,
    snapshots: pieceSnapshots
  } = calculateGarmentTotal(garmentCounts, settings?.garmentCatalog, isOfferActive);

  const getLoadCredits = (loadId: string) => {
    switch (loadId) {
      case '1-4 kg': return 40;
      case '5 kg': return 50;
      case '6 kg': return 60;
      case '7+ kg': return 70;
      default: return 40;
    }
  };

  const getLoadPrice = (loadId: string) => {
    if (loadId === '1-4 kg') {
      return isExpress ? (4 * expressRate) : (4 * standardRate);
    } else if (loadId === '5 kg') {
      return 5 * currentRatePerKg;
    } else if (loadId === '6 kg') {
      return 6 * currentRatePerKg;
    } else if (loadId === '7+ kg') {
      return 7 * currentRatePerKg;
    }
    return 0;
  };

  const getRegularLoadPrice = (loadId: string) => {
    const regRate = isExpress ? regularExpressRate : regularStandardRate;
    if (loadId === '1-4 kg') {
      return 4 * regRate;
    } else if (loadId === '5 kg') {
      return 5 * regRate;
    } else if (loadId === '6 kg') {
      return 6 * regRate;
    } else if (loadId === '7+ kg') {
      return 7 * regRate;
    }
    return 0;
  };

  const currentBasePrice = isPerPiece ? pieceTotalPrice : getLoadPrice(bookingData.approxLoad);
  const currentTotalPrice = currentBasePrice + deliveryFee;
  const currentRegularTotalPrice = isPerPiece 
    ? (pieceTotalRegularPrice + deliveryFee) 
    : (getRegularLoadPrice(bookingData.approxLoad) + deliveryFee);
  const currentTotalSavings = isPerPiece
    ? pieceTotalSavings
    : (getRegularLoadPrice(bookingData.approxLoad) - getLoadPrice(bookingData.approxLoad));

  const totalCreditsNeeded = isPerPiece ? pieceTotalCredits : getLoadCredits(bookingData.approxLoad);

  const calculatePrice = () => {
    return currentTotalPrice;
  };

  const isStepStoreValid = Boolean(bookingData.storeId);
  const isStepPickupValid = bookingData.pickupDropAnswered && (!bookingData.pickupDrop || (bookingData.address.trim() && bookingData.phone.trim()));
  const isStepServiceValid = Boolean(bookingData.serviceType);
  const isStepItemsValid = isPerPiece ? totalPieces > 0 : Boolean(bookingData.approxLoad);
  const canProceed = isStepStoreValid && isStepPickupValid && isStepServiceValid && isStepItemsValid && acceptedTerms;

  // Active Catalog item prices for UI display
  const activeCatalog = (settings?.garmentCatalog && settings.garmentCatalog.length > 0)
    ? settings.garmentCatalog.filter(g => g.active !== false)
    : GARMENT_CATALOG;
  const minOfferPiecePrice = activeCatalog.length > 0 
    ? Math.min(...activeCatalog.map(g => g.offer_price ?? g.price ?? 10))
    : 10;
  const minRegularPiecePrice = activeCatalog.length > 0
    ? Math.min(...activeCatalog.map(g => g.regular_price ?? 15))
    : 15;

  const handleNext = () => {
    if (!canProceed) return;

    const isSubscriber = checkIsSubscriber(user);
    const deliveryFee = (bookingData.pickupDrop && !isSubscriber) ? (settings?.pricing?.deliveryFee ?? 30) : 0;

    const params = new URLSearchParams({
      date: dateStr,
      slot: timeSlot,
      pickupDrop: bookingData.pickupDrop.toString(),
      serviceType: bookingData.serviceType,
      approxLoad: isPerPiece ? `${totalPieces} pieces` : bookingData.approxLoad,
      price: currentBasePrice.toString(),
      totalCredits: totalCreditsNeeded.toString(),
      address: bookingData.address,
      phone: bookingData.phone,
      lat: "0",
      lng: "0",
      fee: deliveryFee.toString(),
      storeId: bookingData.storeId,
      garmentInstructions: bookingData.garmentInstructions,
      totalPieces: totalPieces.toString(),
      garmentPieces: JSON.stringify(garmentCounts),
      pieceBreakdown: JSON.stringify(pieceBreakdown),
      garmentPieceSnapshots: JSON.stringify(pieceSnapshots),
      pieceTotalRegularPrice: pieceTotalRegularPrice.toString(),
      pieceTotalSavings: pieceTotalSavings.toString()
    });
    navigate(`/billing?${params.toString()}`);
  };

  return (
    <div className="max-w-2xl mx-auto px-1 sm:px-4 py-2 sm:py-8 pb-24 sm:pb-32">
      <button 
        onClick={() => navigate('/dashboard')}
        className="flex items-center text-gray-500 hover:text-blue-600 mb-2.5 sm:mb-8 transition-colors text-xs sm:text-sm font-medium"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Change Slot
      </button>

      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white dark:bg-gray-900 p-3 sm:p-8 rounded-xl sm:rounded-3xl shadow-sm sm:shadow-xl border border-blue-50 dark:border-gray-800"
      >
        {/* Selected Slot Header Card */}
        <div className="mb-3.5 sm:mb-8 p-2.5 sm:p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl sm:rounded-2xl flex items-center justify-between">
          <div>
            <p className="text-[9px] sm:text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">Selected Slot</p>
            <h2 className="text-xs sm:text-lg font-bold text-gray-800 dark:text-gray-100">{dateStr} | {timeSlot}</h2>
            <p className="text-[10px] sm:text-xs font-semibold mt-0.5">
              {isSubscriber ? (
                <span className="text-emerald-700 dark:text-emerald-300">
                  Amount to be paid: <strong className="font-bold">₹0 ({totalCreditsNeeded} Credits • ₹{currentTotalPrice.toFixed(2)} value)</strong>
                </span>
              ) : (
                <span className="text-gray-600 dark:text-gray-400">
                  Estimated: <strong className="text-gray-800 dark:text-gray-200">₹{currentTotalPrice.toFixed(2)}</strong> (₹39 online slot fee for COD)
                </span>
              )}
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 p-1.5 sm:p-2 rounded-lg sm:rounded-xl shadow-xs shrink-0 ml-2">
            <Check className="w-4 h-4 sm:w-5 sm:h-5 text-green-500" />
          </div>
        </div>

        <div className="space-y-3 sm:space-y-5">
          {/* STEP 1: Store Selection */}
          <section>
            <h3 className="text-xs sm:text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 sm:mb-3 flex items-center">
              <StoreIcon className="w-3.5 h-3.5 mr-1.5 text-blue-600 dark:text-blue-400" /> 1. Select Store
            </h3>
            
            <div className="relative mb-2">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input 
                type="text"
                placeholder="Search store name or location..."
                value={storeSearch}
                onChange={(e) => setStoreSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg sm:rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-gray-100"
              />
            </div>

            <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-gray-700">
              {stores
                .filter(s => {
                  const search = (storeSearch || '').toLowerCase();
                  return (s.name || '').toLowerCase().includes(search) || 
                         (s.location || '').toLowerCase().includes(search) ||
                         (s.address || '').toLowerCase().includes(search);
                })
                .map(store => (
                  <button
                    key={store.id}
                    onClick={() => {
                      setSelectedStore(store);
                      setBookingData(prev => ({ ...prev, storeId: store.id }));
                    }}
                    className={`p-2.5 sm:p-3 rounded-xl border-2 transition-all text-left flex items-center justify-between ${
                      bookingData.storeId === store.id 
                        ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-600' 
                        : 'bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800 hover:border-blue-200 dark:hover:border-blue-800'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1 mr-2">
                      <div className={`p-1.5 rounded-lg shrink-0 ${bookingData.storeId === store.id ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-400'}`}>
                        <StoreIcon className="w-3.5 h-3.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-xs sm:text-sm text-gray-800 dark:text-gray-100 truncate">{store.name}</p>
                        <p className="text-[9px] sm:text-[10px] font-bold text-gray-400 uppercase tracking-widest truncate">{store.location}</p>
                      </div>
                    </div>
                    {bookingData.storeId === store.id && (
                      <div className="w-4 h-4 bg-blue-600 rounded-full flex items-center justify-center shrink-0">
                        <Check className="w-3 h-3 text-white" />
                      </div>
                    )}
                  </button>
                ))}
              {stores.filter(s => {
                const search = (storeSearch || '').toLowerCase();
                return (s.name || '').toLowerCase().includes(search) || 
                       (s.location || '').toLowerCase().includes(search) ||
                       (s.address || '').toLowerCase().includes(search);
              }).length === 0 && (
                <div className="py-4 text-center">
                  <p className="text-gray-500 dark:text-gray-400 text-xs font-medium">No stores found matching your search.</p>
                </div>
              )}
            </div>
          </section>

          {/* STEP 2: Pickup & Drop (Unveils once Store is selected) */}
          <AnimatePresence>
            {isStepStoreValid && (
              <motion.section
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 15 }}
              >
                <h3 className="text-xs sm:text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 sm:mb-3 flex items-center">
                  <Truck className="w-3.5 h-3.5 mr-1.5 text-blue-600 dark:text-blue-400" /> 2. Pickup & Drop
                </h3>
                <div className="grid grid-cols-2 gap-2.5 sm:gap-4 mb-3 sm:mb-4">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setBookingData(prev => ({ ...prev, pickupDrop: true, pickupDropAnswered: true }))}
                    className={`p-2.5 sm:p-3.5 rounded-xl border-2 transition-all text-left ${
                      bookingData.pickupDropAnswered && bookingData.pickupDrop ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-600' : 'bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800 hover:border-blue-200 dark:hover:border-blue-800'
                    }`}
                  >
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-bold text-xs sm:text-sm text-gray-800 dark:text-gray-100">Yes</span>
                      {bookingData.pickupDropAnswered && bookingData.pickupDrop && (
                        <motion.div layoutId="pickup-dot" className="w-3.5 h-3.5 bg-blue-600 rounded-full" />
                      )}
                    </div>
                    <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">Doorstep service</p>
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setBookingData(prev => ({ ...prev, pickupDrop: false, pickupDropAnswered: true }))}
                    className={`p-2.5 sm:p-3.5 rounded-xl border-2 transition-all text-left ${
                      bookingData.pickupDropAnswered && !bookingData.pickupDrop ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-600' : 'bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800 hover:border-blue-200 dark:hover:border-blue-800'
                    }`}
                  >
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-bold text-xs sm:text-sm text-gray-800 dark:text-gray-100">No</span>
                      {bookingData.pickupDropAnswered && !bookingData.pickupDrop && (
                        <motion.div layoutId="pickup-dot" className="w-3.5 h-3.5 bg-blue-600 rounded-full" />
                      )}
                    </div>
                    <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">Self drop (Free)</p>
                  </motion.button>
                </div>

                <AnimatePresence>
                  {bookingData.pickupDrop && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="space-y-4 overflow-hidden mb-4"
                    >
                      <div className="space-y-2">
                        <label className="text-[10px] sm:text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Pickup Address</label>
                        
                        {!isAddingNewAddress && (user?.savedAddresses?.length || user?.address) ? (
                          <div className="space-y-2">
                            {Array.from(new Set([...(user?.savedAddresses || []), user?.address].filter(Boolean))).map((addr: string, i) => (
                              <div 
                                key={i} 
                                onClick={() => setBookingData(prev => ({ ...prev, address: addr }))}
                                className={`p-2.5 sm:p-3 rounded-xl border-2 transition-all cursor-pointer flex gap-3 ${
                                  bookingData.address === addr 
                                    ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-600' 
                                    : 'bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800 hover:border-blue-200 dark:hover:border-blue-800'
                                }`}
                              >
                                <div className="mt-0.5">
                                  {bookingData.address === addr ? (
                                    <motion.div layoutId="pickup-addr-dot" className="w-3.5 h-3.5 bg-blue-600 rounded-full" />
                                  ) : (
                                    <div className="w-3.5 h-3.5 border-2 border-gray-300 dark:border-gray-600 rounded-full" />
                                  )}
                                </div>
                                <span className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-200">{addr}</span>
                              </div>
                            ))}
                            
                            <button 
                              onClick={() => {
                                setIsAddingNewAddress(true);
                                setNewAddressText('');
                              }}
                              className="flex items-center gap-1.5 text-xs font-bold text-blue-600 dark:text-blue-400 p-1.5 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors w-full"
                            >
                              <Plus className="w-3.5 h-3.5" /> Add New Address
                            </button>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <div className="relative">
                              <Home className="absolute left-3 top-3 w-4 h-4 text-gray-400 dark:text-gray-500" />
                              <textarea
                                required
                                value={newAddressText}
                                onChange={(e) => {
                                  setNewAddressText(e.target.value);
                                  setBookingData(prev => ({ ...prev, address: e.target.value }));
                                }}
                                placeholder="Enter your full address with landmarks..."
                                rows={2}
                                className="w-full pl-9 pr-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-gray-100 resize-none text-xs sm:text-sm"
                              />
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={async () => {
                                  if (!newAddressText.trim()) return;
                                  const currentSaved = user?.savedAddresses || [];
                                  const newSaved = [...currentSaved, newAddressText.trim()];
                                  if (updateUser) {
                                    await updateUser({ savedAddresses: newSaved, address: user?.address || newAddressText.trim() });
                                  }
                                  setBookingData(prev => ({ ...prev, address: newAddressText.trim() }));
                                  setIsAddingNewAddress(false);
                                }}
                                className="flex-1 py-2 bg-blue-600 text-white font-bold text-xs rounded-xl hover:bg-blue-700 transition-colors"
                              >
                                Save & Use This Address
                              </button>
                              {(user?.savedAddresses?.length || user?.address) ? (
                                <button
                                  onClick={() => {
                                    setIsAddingNewAddress(false);
                                    setBookingData(prev => ({ ...prev, address: user.address || user.savedAddresses?.[0] || '' }));
                                  }}
                                  className="px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-bold text-xs rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                                >
                                  Cancel
                                </button>
                              ) : null}
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="p-2.5 rounded-xl flex items-start gap-2.5 bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200">
                        <Info className="w-4 h-4 mt-0.5 shrink-0" />
                        <div>
                          <p className="text-xs font-bold">Delivery Fee</p>
                          <p className="text-[11px] opacity-80 mt-0.5">
                            {isSubscriber 
                              ? 'Delivery is FREE for subscribers!' 
                              : `A flat delivery fee of ₹${settings?.pricing?.deliveryFee ?? 30} applies.`}
                          </p>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] sm:text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Contact Phone</label>
                        
                        {!isAddingNewPhone && (user?.savedPhones?.length || user?.phone) ? (
                          <div className="space-y-2">
                            {Array.from(new Set([...(user?.savedPhones || []), user?.phone].filter(Boolean))).map((ph: string, i) => (
                              <div 
                                key={i} 
                                onClick={() => setBookingData(prev => ({ ...prev, phone: ph }))}
                                className={`p-2.5 sm:p-3 rounded-xl border-2 transition-all cursor-pointer flex gap-3 ${
                                  bookingData.phone === ph 
                                    ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-600' 
                                    : 'bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800 hover:border-blue-200 dark:hover:border-blue-800'
                                }`}
                              >
                                <div className="mt-0.5">
                                  {bookingData.phone === ph ? (
                                    <motion.div layoutId="contact-phone-dot" className="w-3.5 h-3.5 bg-blue-600 rounded-full" />
                                  ) : (
                                    <div className="w-3.5 h-3.5 border-2 border-gray-300 dark:border-gray-600 rounded-full" />
                                  )}
                                </div>
                                <span className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-200">{ph}</span>
                              </div>
                            ))}
                            
                            <button 
                              onClick={() => {
                                setIsAddingNewPhone(true);
                                setNewPhoneText('');
                              }}
                              className="flex items-center gap-1.5 text-xs font-bold text-blue-600 dark:text-blue-400 p-1.5 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors w-full"
                            >
                              <Plus className="w-3.5 h-3.5" /> Add New Phone
                            </button>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <div className="relative">
                              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
                              <input
                                type="tel"
                                required
                                value={newPhoneText}
                                onChange={(e) => {
                                  setNewPhoneText(e.target.value);
                                  setBookingData(prev => ({ ...prev, phone: e.target.value }));
                                }}
                                placeholder="Enter your contact phone number"
                                className="w-full pl-9 pr-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-gray-100 text-xs sm:text-sm"
                              />
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={async () => {
                                  if (!newPhoneText.trim()) return;
                                  const currentSaved = user?.savedPhones || [];
                                  const newSaved = [...currentSaved, newPhoneText.trim()];
                                  if (updateUser) {
                                    await updateUser({ savedPhones: newSaved, phone: user?.phone || newPhoneText.trim() });
                                  }
                                  setBookingData(prev => ({ ...prev, phone: newPhoneText.trim() }));
                                  setIsAddingNewPhone(false);
                                }}
                                className="flex-1 py-2 bg-blue-600 text-white font-bold text-xs rounded-xl hover:bg-blue-700 transition-colors"
                              >
                                Save & Use This Number
                              </button>
                              {(user?.savedPhones?.length || user?.phone) ? (
                                <button
                                  onClick={() => {
                                    setIsAddingNewPhone(false);
                                    setBookingData(prev => ({ ...prev, phone: user.phone || user.savedPhones?.[0] || '' }));
                                  }}
                                  className="px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-bold text-xs rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                                >
                                  Cancel
                                </button>
                              ) : null}
                            </div>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.section>
            )}
          </AnimatePresence>

          {/* STEP 3: Service Type - SIZED AND STRUCTURED EXACTLY AS APPROXIMATE LOAD BOXES */}
          <AnimatePresence>
            {isStepStoreValid && bookingData.pickupDropAnswered && (
              <motion.section
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 15 }}
              >
                <h3 className="text-xs sm:text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 sm:mb-3 flex items-center">
                  <Package className="w-3.5 h-3.5 mr-1.5 text-blue-600 dark:text-blue-400" /> 3. Service Type
                </h3>
                <div className="grid grid-cols-3 gap-2 sm:gap-3.5">
                  {[
                    { 
                      type: 'Wash & Fold', 
                      title: 'Wash & Fold',
                      subtitle: 'Per Weight',
                      desc: 'Standard', 
                      unitPrice: standardRate,
                      regularUnitPrice: isOfferActive && regularStandardRate > standardRate ? regularStandardRate : null,
                      unitLabel: '/kg',
                      isPerPiece: false,
                      badge: isOfferActive ? 'OFFER' : null
                    },
                    { 
                      type: 'Express Wash', 
                      title: 'Express Wash',
                      subtitle: 'Priority',
                      desc: 'Fastest', 
                      unitPrice: expressRate,
                      regularUnitPrice: isOfferActive && regularExpressRate > expressRate ? regularExpressRate : null,
                      unitLabel: '/kg',
                      isPerPiece: false,
                      badge: isOfferActive ? 'FAST' : null
                    },
                    { 
                      type: 'Wash & Fold (Per Piece)', 
                      title: 'Wash & Fold',
                      subtitle: 'Per Piece',
                      desc: 'Itemized', 
                      unitPrice: isOfferActive ? minOfferPiecePrice : minRegularPiecePrice,
                      regularUnitPrice: isOfferActive && minRegularPiecePrice > minOfferPiecePrice ? minRegularPiecePrice : null,
                      unitLabel: '/pc',
                      isPerPiece: true,
                      badge: isOfferActive ? 'OFFER' : null
                    }
                  ].map(({ type, title, subtitle, desc, unitPrice, regularUnitPrice, unitLabel, isPerPiece: isPiece, badge }) => {
                    const isSelected = bookingData.serviceType === type;
                    const savingsPerKg = regularUnitPrice ? (regularUnitPrice - unitPrice) : 0;
                    
                    return (
                      <motion.button
                        key={type}
                        whileHover={{ scale: 1.02, y: -2 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setBookingData(prev => ({ ...prev, serviceType: type as any }))}
                        className={`p-2 sm:p-3.5 rounded-xl sm:rounded-2xl border-2 transition-all text-center flex flex-col items-center justify-between min-h-[105px] sm:min-h-[135px] relative shadow-xs sm:shadow-sm ${
                          isSelected 
                            ? 'bg-blue-50/90 dark:bg-blue-900/30 border-blue-600 ring-2 ring-blue-500/20 dark:ring-blue-400/20' 
                            : 'bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800 hover:border-blue-200 dark:hover:border-blue-800'
                        }`}
                      >
                        {badge && (
                          <span className="absolute -top-2 right-1 sm:right-2 px-1.5 py-0.2 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[8px] sm:text-[9px] font-black uppercase tracking-wider rounded-full shadow-xs">
                            {badge}
                          </span>
                        )}

                        {/* Top: Title & Subtitle */}
                        <div className="flex flex-col items-center w-full">
                          <span className="font-extrabold text-[11px] sm:text-sm text-gray-900 dark:text-gray-100 tracking-tight leading-tight truncate w-full">
                            {title}
                          </span>
                          <span className="text-[8.5px] sm:text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider mt-0.5 truncate w-full">
                            {subtitle}
                          </span>
                        </div>

                        {/* Center: Price Section (Same as Approximate Load) */}
                        <div className="flex flex-col items-center my-0.5 sm:my-1">
                          <div className="flex items-baseline gap-0.5">
                            {isPiece && <span className="text-[8px] sm:text-[10px] font-bold text-gray-400 uppercase">From</span>}
                            <span className="text-lg sm:text-2xl font-black text-blue-600 dark:text-blue-400 tracking-tight leading-none">
                              ₹{unitPrice}
                            </span>
                            <span className="text-[8px] sm:text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase">
                              {unitLabel}
                            </span>
                          </div>

                          {/* Regular Price Strikethrough & Savings Tag */}
                          {regularUnitPrice && (
                            <div className="flex items-center gap-1 mt-0.5">
                              <span className="text-[8.5px] sm:text-[10px] text-gray-400 dark:text-gray-500 line-through font-bold">
                                ₹{regularUnitPrice}
                              </span>
                              <span className="text-[7.5px] sm:text-[8.5px] font-black uppercase text-emerald-700 dark:text-emerald-300 bg-emerald-100/90 dark:bg-emerald-950/60 px-1 py-0.2 rounded">
                                -₹{savingsPerKg}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Bottom Pill (Same as Approximate Load) */}
                        <span className={`text-[8.5px] sm:text-[10px] font-medium px-1.5 sm:px-2 py-0.5 rounded-full truncate max-w-full ${
                          isSelected 
                            ? 'bg-blue-100/80 dark:bg-blue-900/60 text-blue-800 dark:text-blue-200 font-bold' 
                            : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
                        }`}>
                          {desc}
                        </span>
                      </motion.button>
                    );
                  })}
                </div>
              </motion.section>
            )}
          </AnimatePresence>

          {/* STEP 4: Approximate Load OR Per-Piece Garment Selector */}
          <AnimatePresence>
            {isStepStoreValid && bookingData.pickupDropAnswered && bookingData.serviceType && (
              <motion.section
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 15 }}
              >
                {!isPerPiece ? (
                  /* Standard / Express Load Options - COMPACT BOXES */
                  <div>
                    <h3 className="text-xs sm:text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 sm:mb-3 flex items-center">
                      <Weight className="w-3.5 h-3.5 mr-1.5 text-blue-600 dark:text-blue-400" /> 4. Approximate Load
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3.5">
                      {[
                        { id: '1-4 kg', label: '1-4 kg', outfits: '5–6 outfits' },
                        { id: '5 kg', label: '5 kg', outfits: '6–7 outfits' },
                        { id: '6 kg', label: '6 kg', outfits: '7–9 outfits' },
                        { id: '7+ kg', label: '7+ kg', outfits: '9–10 outfits' },
                      ].map((option, index) => {
                        const loadBasePrice = getLoadPrice(option.id);
                        const loadRegularPrice = getRegularLoadPrice(option.id);
                        const hasDiscount = isOfferActive && loadRegularPrice > loadBasePrice;
                        const savingsAmount = loadRegularPrice - loadBasePrice;

                        return (
                          <motion.button
                            key={option.id}
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.05 + index * 0.04 }}
                            whileHover={{ scale: 1.02, y: -2 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => setBookingData(prev => ({ ...prev, approxLoad: option.id as any }))}
                            className={`p-2 sm:p-3.5 rounded-xl sm:rounded-2xl border-2 transition-all text-center flex flex-col items-center justify-between min-h-[105px] sm:min-h-[135px] relative shadow-xs sm:shadow-sm ${
                              bookingData.approxLoad === option.id
                                ? 'bg-blue-50/90 dark:bg-blue-900/30 border-blue-600 ring-2 ring-blue-500/20 dark:ring-blue-400/20'
                                : 'bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800 hover:border-blue-200 dark:hover:border-blue-800'
                            }`}
                          >
                            <span className="font-extrabold text-[11px] sm:text-sm text-gray-900 dark:text-gray-100 tracking-tight">
                              {option.label}
                            </span>
                            
                            <div className="flex flex-col items-center my-0.5 sm:my-1">
                              <span className="text-lg sm:text-2xl font-black text-blue-600 dark:text-blue-400 tracking-tight leading-none">
                                ₹{loadBasePrice}
                              </span>
                              
                              {hasDiscount && (
                                <div className="flex items-center gap-1 mt-0.5">
                                  <span className="text-[8.5px] sm:text-[10px] text-gray-400 dark:text-gray-500 line-through font-bold">
                                    ₹{loadRegularPrice}
                                  </span>
                                  <span className="text-[7.5px] sm:text-[8.5px] font-black uppercase text-emerald-700 dark:text-emerald-300 bg-emerald-100/90 dark:bg-emerald-950/60 px-1 py-0.2 rounded">
                                    -₹{savingsAmount}
                                  </span>
                                </div>
                              )}
                            </div>

                            <span className={`text-[8.5px] sm:text-[10px] font-medium px-1.5 sm:px-2 py-0.5 rounded-full ${
                              bookingData.approxLoad === option.id 
                                ? 'bg-blue-100/80 dark:bg-blue-900/60 text-blue-800 dark:text-blue-200 font-bold' 
                                : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
                            }`}>
                              {option.outfits}
                            </span>
                          </motion.button>
                        );
                      })}
                    </div>

                    {/* Compact Disclaimer & Quick Outfit Guide */}
                    <div className="mt-2.5 p-2.5 sm:p-3 bg-amber-50/90 dark:bg-amber-950/30 rounded-xl border border-amber-200/70 dark:border-amber-800/50 space-y-1.5">
                      <div className="flex items-start gap-2">
                        <Info className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                        <div className="text-[10px] sm:text-xs text-amber-900 dark:text-amber-200 leading-snug">
                          <span className="font-bold">Min Charge: </span>
                          {isExpress ? (
                            <span>
                              ₹{4 * expressRate} min applies for loads up to 4 kg
                              {isOfferActive && regularExpressRate > expressRate && (
                                <span className="text-amber-700/80 dark:text-amber-300/80"> (Reg <span className="line-through">₹{4 * regularExpressRate}</span>)</span>
                              )}.
                            </span>
                          ) : (
                            <span>
                              ₹{4 * standardRate} min applies for loads up to 4 kg
                              {isOfferActive && regularStandardRate > standardRate && (
                                <span className="text-amber-700/80 dark:text-amber-300/80"> (Reg <span className="line-through">₹{4 * regularStandardRate}</span>)</span>
                              )}.
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Outfit reference weights inline */}
                      <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-amber-200/50 dark:border-amber-800/40 text-[9.5px] sm:text-[11px] text-amber-800 dark:text-amber-300 font-medium">
                        <span className="font-bold">Guide:</span>
                        <span>1 outfit ≈ 1 top + 1 bottom</span>
                        <span>•</span>
                        <span>T-shirt ≈ 250g</span>
                        <span>•</span>
                        <span>Jeans ≈ 550g</span>
                        <span>•</span>
                        <span>Pants ≈ 400g</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Per-Piece Garment Item Selection */
                  <div>
                    <div className="flex items-center justify-between mb-2 sm:mb-3">
                      <h3 className="text-xs sm:text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center">
                        <Shirt className="w-3.5 h-3.5 mr-1.5 text-blue-600 dark:text-blue-400" /> 4. Select Garment Pieces
                      </h3>
                      {totalPieces > 0 && (
                        <span className="text-[10px] sm:text-xs font-black text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/40 px-2 py-0.5 rounded-lg">
                          {totalPieces} {totalPieces === 1 ? 'pc' : 'pcs'} {isSubscriber ? `• ${totalCreditsNeeded} Cr (₹${pieceTotalPrice})` : `(₹${pieceTotalPrice})`}
                        </span>
                      )}
                    </div>

                    <GarmentPieceSelector 
                      garmentCounts={garmentCounts}
                      onChange={setGarmentCounts}
                      isSubscriber={isSubscriber}
                      subscriberCreditsLeft={user?.laundryCredits ?? 160}
                      totalMonthlyCredits={user?.totalMonthlyCredits ?? 160}
                      customCatalog={settings?.garmentCatalog}
                      isOfferActive={isOfferActive}
                    />
                  </div>
                )}
              </motion.section>
            )}
          </AnimatePresence>

          {/* STEP 5: Special Instructions & Care */}
          <AnimatePresence>
            {isStepStoreValid && bookingData.pickupDropAnswered && (
              <motion.section
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 15 }}
              >
                <h3 className="text-xs sm:text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 sm:mb-3 flex items-center">
                  <AlertTriangle className="w-3.5 h-3.5 mr-1.5 text-blue-600 dark:text-blue-400" /> 5. Special Instructions & Care
                </h3>
                <div className="space-y-2">
                  <div className="p-2.5 sm:p-3 bg-blue-50/80 dark:bg-blue-950/30 rounded-lg sm:rounded-xl border border-blue-200/60 dark:border-blue-800/40 flex items-start gap-2">
                    <AlertTriangle className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
                    <div className="text-[10.5px] sm:text-xs text-blue-900 dark:text-blue-200 space-y-0.5">
                      <p className="font-bold uppercase tracking-wider text-[10px] sm:text-[11px] text-blue-700 dark:text-blue-300">Care & Color Bleeding Note:</p>
                      <p>
                        Specify any <strong>color-bleeding, whites, delicate fabrics, or special washing needs</strong>.
                      </p>
                    </div>
                  </div>

                  <textarea
                    value={bookingData.garmentInstructions}
                    onChange={(e) => setBookingData(prev => ({ ...prev, garmentInstructions: e.target.value }))}
                    placeholder="e.g. Red shirt bleeds color, wash whites separately, delicate silk item..."
                    rows={2}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg sm:rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-gray-100 resize-none text-xs sm:text-sm"
                  />
                </div>
              </motion.section>
            )}
          </AnimatePresence>
        </div>

        {/* Live Total Bill Price Card */}
        {isStepStoreValid && bookingData.pickupDropAnswered && (
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className={`mt-4 sm:mt-8 p-3.5 sm:p-6 rounded-xl sm:rounded-3xl border shadow-xs sm:shadow-sm ${
              isSubscriber 
                ? 'bg-gradient-to-br from-green-50/90 via-emerald-50/30 to-teal-50/70 dark:from-gray-900 dark:via-gray-800/80 dark:to-gray-900 border-green-200/80 dark:border-green-800/50'
                : 'bg-gradient-to-br from-blue-50/90 via-indigo-50/30 to-blue-50/70 dark:from-gray-900 dark:via-gray-800/80 dark:to-gray-900 border-blue-200/80 dark:border-blue-800/50'
            }`}
          >
            <div className={`flex items-center justify-between pb-2.5 sm:pb-3 border-b ${
              isSubscriber ? 'border-green-200/60 dark:border-green-800/40' : 'border-blue-200/60 dark:border-blue-800/40'
            }`}>
              <div className="flex items-center gap-1.5 sm:gap-2">
                <Receipt className={`w-3.5 h-3.5 sm:w-5 sm:h-5 ${isSubscriber ? 'text-green-600 dark:text-green-400' : 'text-blue-600 dark:text-blue-400'}`} />
                <span className="text-[11px] sm:text-xs font-black uppercase tracking-wider text-gray-800 dark:text-gray-200">
                  {isSubscriber ? 'Subscriber Summary' : 'Live Estimate'}
                </span>
              </div>
              <span className={`text-[10px] sm:text-xs font-bold px-2 sm:px-3 py-0.5 sm:py-1 rounded-lg sm:rounded-xl ${
                isSubscriber 
                  ? 'text-green-700 dark:text-green-300 bg-green-100/80 dark:bg-green-900/50'
                  : 'text-blue-700 dark:text-blue-300 bg-blue-100/80 dark:bg-blue-900/50'
              }`}>
                {bookingData.serviceType} • {isPerPiece ? `${totalPieces} pcs` : bookingData.approxLoad}
              </span>
            </div>

            <div className="space-y-2 py-2.5 sm:py-3.5 text-xs sm:text-sm">
              <div className="flex justify-between items-center text-gray-600 dark:text-gray-300">
                <span className="truncate pr-2">
                  {isPerPiece 
                    ? `Wash & Fold (${totalPieces} items)`
                    : `${bookingData.serviceType} (${bookingData.approxLoad} @ ₹${currentRatePerKg}/kg)`}
                </span>
                {isSubscriber ? (
                  <span className="font-black text-green-600 dark:text-green-400 shrink-0">
                    {totalCreditsNeeded} Credits <span className="font-bold text-gray-500 dark:text-gray-400">({isPerPiece ? `₹${pieceTotalPrice}` : `₹${currentBasePrice}`})</span>
                  </span>
                ) : (
                  <span className="font-bold text-gray-800 dark:text-gray-100 shrink-0">₹{currentBasePrice}</span>
                )}
              </div>

              {isPerPiece && pieceBreakdown.length > 0 && (
                <div className={`pl-2.5 py-1 border-l-2 space-y-0.5 ${
                  isSubscriber ? 'border-green-400 dark:border-green-600' : 'border-blue-300 dark:border-blue-700'
                }`}>
                  {pieceBreakdown.map((item) => (
                    <div key={item.id} className="flex justify-between text-[10px] sm:text-[11px] text-gray-500 dark:text-gray-400">
                      <span>{item.count}x {item.name}</span>
                      {isSubscriber ? (
                        <span className="font-semibold text-green-600 dark:text-green-400">
                          {item.totalCredits} Cr <span className="text-gray-500 dark:text-gray-400">(₹{item.totalPrice})</span>
                        </span>
                      ) : (
                        <span>₹{item.totalPrice}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {bookingData.pickupDrop ? (
                <div className="flex justify-between items-center text-gray-600 dark:text-gray-300">
                  <span className="flex items-center gap-1.5">
                    <Truck className={`w-3.5 h-3.5 ${isSubscriber ? 'text-green-600 dark:text-green-400' : 'text-blue-600 dark:text-blue-400'}`} /> Pickup & Drop Fee
                  </span>
                  <span className="font-bold text-gray-800 dark:text-gray-100">
                    {isSubscriber ? <span className="text-green-600 dark:text-green-400 font-bold">FREE</span> : `+₹${deliveryFee}`}
                  </span>
                </div>
              ) : (
                <div className="flex justify-between items-center text-gray-500 dark:text-gray-400 text-[11px] sm:text-xs">
                  <span>Store Visit (Self Drop & Pickup)</span>
                  <span className="text-green-600 dark:text-green-400 font-bold">₹0</span>
                </div>
              )}

              {isSubscriber && (
                <div className="p-2 sm:p-3 bg-white/80 dark:bg-gray-800/80 rounded-lg sm:rounded-xl border border-green-500/20 flex items-center justify-between text-[11px] sm:text-xs">
                  <span className="text-gray-600 dark:text-gray-300 font-medium">Monthly Credit Balance:</span>
                  <span className="font-black text-green-700 dark:text-green-300">
                    {user?.laundryCredits ?? 160} Cr Available
                  </span>
                </div>
              )}
            </div>

            <div className={`pt-2.5 sm:pt-3.5 border-t flex justify-between items-center ${
              isSubscriber ? 'border-green-200/60 dark:border-green-800/40' : 'border-blue-200/60 dark:border-blue-800/40'
            }`}>
              <div>
                <span className="text-[10px] sm:text-xs font-black text-gray-700 dark:text-gray-300 uppercase tracking-widest block">
                  {isSubscriber ? 'Credits to Deduct' : 'Total Bill Price'}
                </span>
                <span className="text-[9px] sm:text-[10px] text-gray-500 dark:text-gray-400">
                  {isSubscriber 
                    ? 'Covered under your plan' 
                    : bookingData.pickupDrop ? `(₹${currentBasePrice} + ₹${deliveryFee} delivery)` : '(Inclusive of taxes)'}
                </span>
              </div>
              <div className="text-right">
                {isSubscriber ? (
                  <div className="flex flex-col items-end">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-xl sm:text-3xl font-black text-green-600 dark:text-green-400 tracking-tight">
                        {totalCreditsNeeded} Credits
                      </span>
                      <span className="text-sm sm:text-xl font-bold text-gray-500 dark:text-gray-400">
                        (₹{currentTotalPrice})
                      </span>
                    </div>
                    <span className="text-[10px] sm:text-[11px] font-bold text-green-700 dark:text-green-400">
                      ₹0 to pay (Covered by Credits)
                    </span>
                  </div>
                ) : (
                  <div className="flex flex-col items-end">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-xl sm:text-3xl font-black text-blue-600 dark:text-blue-400 tracking-tight">
                        ₹{currentTotalPrice}
                      </span>
                      {isOfferActive && currentTotalSavings > 0 && (
                        <span className="text-xs sm:text-base text-gray-400 dark:text-gray-500 line-through font-bold">
                          ₹{currentRegularTotalPrice}
                        </span>
                      )}
                    </div>
                    {isOfferActive && currentTotalSavings > 0 && (
                      <span className="text-[9px] sm:text-xs font-black text-green-600 dark:text-green-400 uppercase tracking-tight">
                        You save ₹{currentTotalSavings}!
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {/* Terms and Conditions Checkbox */}
        <div className="mt-4 sm:mt-6 p-3 sm:p-4 bg-gray-50 dark:bg-gray-800/60 rounded-xl sm:rounded-2xl border border-gray-200/80 dark:border-gray-700/80 flex items-center gap-2.5 sm:gap-3">
          <input
            type="checkbox"
            id="termsCheckbox"
            checked={acceptedTerms}
            onChange={(e) => setAcceptedTerms(e.target.checked)}
            className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 rounded-md border-gray-300 focus:ring-blue-500 cursor-pointer accent-blue-600 shrink-0"
          />
          <label htmlFor="termsCheckbox" className="text-xs sm:text-sm text-gray-700 dark:text-gray-300 font-medium select-none cursor-pointer">
            I accept the{' '}
            <button
              type="button"
              onClick={() => setIsTermsOpen(true)}
              className="text-blue-600 dark:text-blue-400 font-bold underline hover:text-blue-700 dark:hover:text-blue-300 focus:outline-none"
            >
              Terms and Conditions
            </button>
          </label>
        </div>

        {/* Validation warning if per piece is chosen but 0 pieces selected */}
        {isPerPiece && totalPieces === 0 && (
          <p className="mt-2.5 sm:mt-3 text-xs text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 shrink-0" />
            Please select at least 1 garment piece to proceed.
          </p>
        )}

        <button
          onClick={handleNext}
          disabled={!canProceed}
          className={`w-full mt-4 sm:mt-6 py-3 sm:py-4 font-bold rounded-xl sm:rounded-2xl transition-all shadow-md sm:shadow-lg flex items-center justify-center gap-2 text-xs sm:text-base haptic-feedback touch-manipulation ${
            !canProceed
              ? 'bg-gray-200 dark:bg-gray-800 text-gray-400 dark:text-gray-600 cursor-not-allowed shadow-none'
              : isSubscriber
                ? 'bg-green-600 text-white hover:bg-green-700 shadow-green-200 dark:shadow-none'
                : 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-200 dark:shadow-none'
          }`}
        >
          <span>
            {isSubscriber 
              ? `Proceed with ${totalCreditsNeeded} Credits (₹${currentTotalPrice})` 
              : `Proceed to Billing • ₹${currentTotalPrice}`}
          </span>
          <ArrowLeft className="w-4 h-4 rotate-180" />
        </button>

        {/* Mobile Sticky Floating Quick Action Bar */}
        <div className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md p-3 border-t border-gray-200/80 dark:border-gray-800 shadow-2xl flex items-center justify-between gap-3 safe-area-pb">
          <div className="min-w-0">
            <span className="text-[10px] uppercase font-black tracking-wider text-gray-400 block truncate">
              {isSubscriber ? 'Membership Order' : 'Estimated Total'}
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className={`text-base font-display font-black leading-tight ${isSubscriber ? 'text-emerald-600 dark:text-emerald-400' : 'text-blue-600 dark:text-blue-400'}`}>
                {isSubscriber ? '₹0' : `₹${currentTotalPrice}`}
              </span>
              {isSubscriber && (
                <span className="text-[10px] font-bold text-gray-500">({totalCreditsNeeded} Cr)</span>
              )}
            </div>
          </div>

          <button
            onClick={handleNext}
            disabled={!canProceed}
            className={`px-5 py-2.5 rounded-xl font-bold text-xs flex items-center gap-1.5 shrink-0 transition-all shadow-md haptic-feedback touch-manipulation ${
              !canProceed
                ? 'bg-gray-200 dark:bg-gray-800 text-gray-400 dark:text-gray-600 cursor-not-allowed'
                : isSubscriber
                  ? 'bg-green-600 text-white hover:bg-green-700 shadow-green-600/20'
                  : 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-600/20'
            }`}
          >
            <span>Proceed</span>
            <ArrowLeft className="w-3.5 h-3.5 rotate-180" />
          </button>
        </div>

        <TermsModal
          isOpen={isTermsOpen}
          onClose={() => setIsTermsOpen(false)}
          onAccept={() => {
            setAcceptedTerms(true);
            setIsTermsOpen(false);
          }}
        />
      </motion.div>
    </div>
  );
};

export default BookingDetails;
