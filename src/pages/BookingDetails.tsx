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
import { Store } from '../types';
import TermsModal from '../components/TermsModal';
import { GarmentPieceSelector } from '../components/GarmentPieceSelector';
import { calculateGarmentTotal, GARMENT_CATALOG } from '../data/garmentCatalog';

const BookingDetails: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, updateUser } = useAuth();
  const { settings } = useSettings();
  
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [isTermsOpen, setIsTermsOpen] = useState(false);
  const [isAddingNewAddress, setIsAddingNewAddress] = useState(false);
  const [newAddressText, setNewAddressText] = useState('');
  const [isAddingNewPhone, setIsAddingNewPhone] = useState(false);
  const [newPhoneText, setNewPhoneText] = useState('');
  
  const dateStr = searchParams.get('date') || '';
  const timeSlot = searchParams.get('slot') || '';

  const [bookingData, setBookingData] = useState({
    pickupDrop: false,
    pickupDropAnswered: false,
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
  const isSubscriber = user?.userType === 'subscriber';
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

    const price = calculatePrice();
    const isSubscriber = user?.userType === 'subscriber';
    const deliveryFee = (bookingData.pickupDrop && !isSubscriber) ? (settings?.pricing?.deliveryFee ?? 30) : 0;

    const params = new URLSearchParams({
      date: dateStr,
      slot: timeSlot,
      pickupDrop: bookingData.pickupDrop.toString(),
      serviceType: bookingData.serviceType,
      approxLoad: isPerPiece ? `${totalPieces} pieces` : bookingData.approxLoad,
      price: price.toString(),
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
    <div className="max-w-2xl mx-auto px-4 py-8 pb-32">
      <button 
        onClick={() => navigate('/dashboard')}
        className="flex items-center text-gray-500 hover:text-blue-600 mb-8 transition-colors text-sm font-medium"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Change Slot
      </button>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white dark:bg-gray-900 p-6 sm:p-8 rounded-3xl shadow-xl border border-blue-50 dark:border-gray-800"
      >
        {/* Selected Slot Header Card */}
        <div className="mb-8 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-2xl flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">Selected Slot</p>
            <h2 className="text-base sm:text-lg font-bold text-gray-800 dark:text-gray-100">{dateStr} | {timeSlot}</h2>
          </div>
          <div className="bg-white dark:bg-gray-800 p-2 rounded-xl shadow-sm">
            <Check className="w-5 h-5 text-green-500" />
          </div>
        </div>

        <div className="space-y-10">
          {/* STEP 1: Store Selection */}
          <section>
            <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4 flex items-center">
              <StoreIcon className="w-4 h-4 mr-2 text-blue-600 dark:text-blue-400" /> 1. Select Store
            </h3>
            
            <div className="relative mb-3">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input 
                type="text"
                placeholder="Search for a store by name or location..."
                value={storeSearch}
                onChange={(e) => setStoreSearch(e.target.value)}
                className="w-full pl-11 pr-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-gray-100"
              />
            </div>

            <div className="grid grid-cols-1 gap-2.5 max-h-56 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-gray-700">
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
                    className={`p-3.5 rounded-2xl border-2 transition-all text-left flex items-center justify-between ${
                      bookingData.storeId === store.id 
                        ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-600' 
                        : 'bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800 hover:border-blue-200 dark:hover:border-blue-800'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-xl ${bookingData.storeId === store.id ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-400'}`}>
                        <StoreIcon className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="font-bold text-sm text-gray-800 dark:text-gray-100">{store.name}</p>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{store.location}</p>
                      </div>
                    </div>
                    {bookingData.storeId === store.id && (
                      <div className="w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center">
                        <Check className="w-3.5 h-3.5 text-white" />
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
                <div className="py-6 text-center">
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
                <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4 flex items-center">
                  <Truck className="w-4 h-4 mr-2 text-blue-600 dark:text-blue-400" /> 2. Pickup & Drop
                </h3>
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setBookingData(prev => ({ ...prev, pickupDrop: true, pickupDropAnswered: true }))}
                    className={`p-4 rounded-2xl border-2 transition-all text-left ${
                      bookingData.pickupDropAnswered && bookingData.pickupDrop ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-600' : 'bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800 hover:border-blue-200 dark:hover:border-blue-800'
                    }`}
                  >
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-bold text-gray-800 dark:text-gray-100">Yes</span>
                      {bookingData.pickupDropAnswered && bookingData.pickupDrop && (
                        <motion.div layoutId="pickup-dot" className="w-4 h-4 bg-blue-600 rounded-full" />
                      )}
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Doorstep service</p>
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setBookingData(prev => ({ ...prev, pickupDrop: false, pickupDropAnswered: true }))}
                    className={`p-4 rounded-2xl border-2 transition-all text-left ${
                      bookingData.pickupDropAnswered && !bookingData.pickupDrop ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-600' : 'bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800 hover:border-blue-200 dark:hover:border-blue-800'
                    }`}
                  >
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-bold text-gray-800 dark:text-gray-100">No</span>
                      {bookingData.pickupDropAnswered && !bookingData.pickupDrop && (
                        <motion.div layoutId="pickup-dot" className="w-4 h-4 bg-blue-600 rounded-full" />
                      )}
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Self drop (Free)</p>
                  </motion.button>
                </div>

                <AnimatePresence>
                  {bookingData.pickupDrop && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="space-y-6 overflow-hidden mb-6"
                    >
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Pickup Address</label>
                        
                        {!isAddingNewAddress && (user?.savedAddresses?.length || user?.address) ? (
                          <div className="space-y-3">
                            {Array.from(new Set([...(user?.savedAddresses || []), user?.address].filter(Boolean))).map((addr: string, i) => (
                              <div 
                                key={i} 
                                onClick={() => setBookingData(prev => ({ ...prev, address: addr }))}
                                className={`p-4 rounded-xl border-2 transition-all cursor-pointer flex gap-4 ${
                                  bookingData.address === addr 
                                    ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-600' 
                                    : 'bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800 hover:border-blue-200 dark:hover:border-blue-800'
                                }`}
                              >
                                <div className="mt-1">
                                  {bookingData.address === addr ? (
                                    <motion.div layoutId="pickup-addr-dot" className="w-4 h-4 bg-blue-600 rounded-full" />
                                  ) : (
                                    <div className="w-4 h-4 border-2 border-gray-300 dark:border-gray-600 rounded-full" />
                                  )}
                                </div>
                                <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{addr}</span>
                              </div>
                            ))}
                            
                            <button 
                              onClick={() => {
                                setIsAddingNewAddress(true);
                                setNewAddressText('');
                              }}
                              className="flex items-center gap-2 text-sm font-bold text-blue-600 dark:text-blue-400 p-2 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl transition-colors w-full"
                            >
                              <Plus className="w-4 h-4" /> Add New Address
                            </button>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <div className="relative">
                              <Home className="absolute left-4 top-4 w-5 h-5 text-gray-400 dark:text-gray-500" />
                              <textarea
                                required
                                value={newAddressText}
                                onChange={(e) => {
                                  setNewAddressText(e.target.value);
                                  setBookingData(prev => ({ ...prev, address: e.target.value }));
                                }}
                                placeholder="Enter your full address with landmarks..."
                                rows={3}
                                className="w-full pl-12 pr-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-gray-100 resize-none text-sm"
                              />
                            </div>
                            <div className="flex gap-3">
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
                                className="flex-1 py-3 bg-blue-600 text-white font-bold text-sm rounded-xl hover:bg-blue-700 transition-colors"
                              >
                                Save & Use This Address
                              </button>
                              {(user?.savedAddresses?.length || user?.address) ? (
                                <button
                                  onClick={() => {
                                    setIsAddingNewAddress(false);
                                    setBookingData(prev => ({ ...prev, address: user.address || user.savedAddresses?.[0] || '' }));
                                  }}
                                  className="px-6 py-3 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-bold text-sm rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                                >
                                  Cancel
                                </button>
                              ) : null}
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="p-4 rounded-2xl flex items-start gap-4 bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200">
                        <Info className="w-5 h-5 mt-0.5 shrink-0" />
                        <div>
                          <p className="text-sm font-bold">Delivery Information</p>
                          <p className="text-xs opacity-80 mt-0.5">
                            {user?.userType === 'subscriber' 
                              ? 'Delivery is FREE for subscribers!' 
                              : `A flat delivery fee of ₹${settings?.pricing?.deliveryFee ?? 30} applies for pickup and drop service.`}
                          </p>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Contact Phone</label>
                          
                          {!isAddingNewPhone && (user?.savedPhones?.length || user?.phone) ? (
                            <div className="space-y-3">
                              {Array.from(new Set([...(user?.savedPhones || []), user?.phone].filter(Boolean))).map((ph: string, i) => (
                                <div 
                                  key={i} 
                                  onClick={() => setBookingData(prev => ({ ...prev, phone: ph }))}
                                  className={`p-4 rounded-xl border-2 transition-all cursor-pointer flex gap-4 ${
                                    bookingData.phone === ph 
                                      ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-600' 
                                      : 'bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800 hover:border-blue-200 dark:hover:border-blue-800'
                                  }`}
                                >
                                  <div className="mt-1">
                                    {bookingData.phone === ph ? (
                                      <motion.div layoutId="contact-phone-dot" className="w-4 h-4 bg-blue-600 rounded-full" />
                                    ) : (
                                      <div className="w-4 h-4 border-2 border-gray-300 dark:border-gray-600 rounded-full" />
                                    )}
                                  </div>
                                  <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{ph}</span>
                                </div>
                              ))}
                              
                              <button 
                                onClick={() => {
                                  setIsAddingNewPhone(true);
                                  setNewPhoneText('');
                                }}
                                className="flex items-center gap-2 text-sm font-bold text-blue-600 dark:text-blue-400 p-2 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl transition-colors w-full"
                              >
                                <Plus className="w-4 h-4" /> Add New Phone
                              </button>
                            </div>
                          ) : (
                            <div className="space-y-3">
                              <div className="relative">
                                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
                                <input
                                  type="tel"
                                  required
                                  value={newPhoneText}
                                  onChange={(e) => {
                                    setNewPhoneText(e.target.value);
                                    setBookingData(prev => ({ ...prev, phone: e.target.value }));
                                  }}
                                  placeholder="Enter your contact phone number"
                                  className="w-full pl-12 pr-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-gray-100 text-sm"
                                />
                              </div>
                              <div className="flex gap-3">
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
                                  className="flex-1 py-3 bg-blue-600 text-white font-bold text-sm rounded-xl hover:bg-blue-700 transition-colors"
                                >
                                  Save & Use This Number
                                </button>
                                {(user?.savedPhones?.length || user?.phone) ? (
                                  <button
                                    onClick={() => {
                                      setIsAddingNewPhone(false);
                                      setBookingData(prev => ({ ...prev, phone: user.phone || user.savedPhones?.[0] || '' }));
                                    }}
                                    className="px-6 py-3 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-bold text-sm rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                                  >
                                    Cancel
                                  </button>
                                ) : null}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.section>
            )}
          </AnimatePresence>

          {/* STEP 3: Service Type (Unveils once Pickup & Drop is answered) */}
          <AnimatePresence>
            {isStepStoreValid && bookingData.pickupDropAnswered && (
              <motion.section
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 15 }}
              >
                <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4 flex items-center">
                  <Package className="w-4 h-4 mr-2 text-blue-600 dark:text-blue-400" /> 3. Service Type
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                  {[
                    { 
                      type: 'Wash & Fold', 
                      title: 'Wash & Fold',
                      subtitle: 'Per Weight',
                      desc: 'Standard laundry care', 
                      unitPrice: standardRate,
                      regularUnitPrice: isOfferActive && regularStandardRate > standardRate ? regularStandardRate : null,
                      unitLabel: '/ kg',
                      isPerPiece: false,
                      badge: isOfferActive ? 'LIMITED OFFER' : null
                    },
                    { 
                      type: 'Express Wash', 
                      title: 'Express Wash',
                      subtitle: 'Priority Wash',
                      desc: 'Same-day faster turnaround', 
                      unitPrice: expressRate,
                      regularUnitPrice: isOfferActive && regularExpressRate > expressRate ? regularExpressRate : null,
                      unitLabel: '/ kg',
                      isPerPiece: false,
                      badge: isOfferActive ? 'FASTEST' : null
                    },
                    { 
                      type: 'Wash & Fold (Per Piece)', 
                      title: 'Wash & Fold',
                      subtitle: 'Per Piece',
                      desc: 'Itemized custom count', 
                      unitPrice: isOfferActive ? minOfferPiecePrice : minRegularPiecePrice,
                      regularUnitPrice: isOfferActive && minRegularPiecePrice > minOfferPiecePrice ? minRegularPiecePrice : null,
                      unitLabel: '/ piece',
                      isPerPiece: true,
                      badge: isOfferActive ? 'LIMITED OFFER' : null
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
                        className={`p-4 sm:p-5 rounded-2xl border-2 transition-all text-left flex flex-col justify-between relative shadow-sm ${
                          isSelected 
                            ? 'bg-blue-50/90 dark:bg-blue-900/30 border-blue-600 ring-2 ring-blue-500/20 dark:ring-blue-400/20' 
                            : 'bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800 hover:border-blue-200 dark:hover:border-blue-800 hover:shadow-md'
                        }`}
                      >
                        {badge && (
                          <span className="absolute -top-2.5 right-3 px-2.5 py-0.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[9px] font-black uppercase tracking-wider rounded-full shadow-sm">
                            {badge}
                          </span>
                        )}

                        {/* Top: Title, Subtitle, Description */}
                        <div>
                          <div className="flex justify-between items-start mb-1">
                            <div>
                              <span className="font-black text-base sm:text-lg text-gray-900 dark:text-gray-100 leading-snug block">
                                {title}
                              </span>
                              <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                                {subtitle}
                              </span>
                            </div>
                            {isSelected ? (
                              <motion.div layoutId="service-dot" className="w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center shrink-0 ml-1 mt-0.5 shadow-sm">
                                <Check className="w-3.5 h-3.5 text-white stroke-[3]" />
                              </motion.div>
                            ) : (
                              <div className="w-5 h-5 rounded-full border-2 border-gray-200 dark:border-gray-700 shrink-0 ml-1 mt-0.5" />
                            )}
                          </div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 mb-3">{desc}</p>
                        </div>

                        {/* Bottom: Hero Price Section with Strong Hierarchy */}
                        <div className="pt-3 border-t border-gray-100 dark:border-gray-800/80 mt-auto">
                          <div className="flex items-baseline gap-1.5 flex-wrap">
                            {isPiece && (
                              <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-tight">
                                From
                              </span>
                            )}
                            <span className="text-2xl sm:text-3xl font-black text-blue-600 dark:text-blue-400 tracking-tight">
                              ₹{unitPrice}
                            </span>
                            <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                              {unitLabel}
                            </span>
                          </div>

                          {/* Regular Price Strikethrough & Savings Tag */}
                          {regularUnitPrice && (
                            <div className="mt-1.5 flex items-center gap-2">
                              <span className="text-xs text-gray-400 dark:text-gray-500 line-through font-bold">
                                ₹{regularUnitPrice}{unitLabel}
                              </span>
                              <span className="text-[10px] font-black uppercase text-emerald-700 dark:text-emerald-300 bg-emerald-100/90 dark:bg-emerald-950/60 border border-emerald-300/60 dark:border-emerald-800/60 px-1.5 py-0.5 rounded-md">
                                Save ₹{savingsPerKg}/kg
                              </span>
                            </div>
                          )}
                        </div>
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
                  /* Standard / Express Load Options */
                  <div>
                    <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4 flex items-center">
                      <Weight className="w-4 h-4 mr-2 text-blue-600 dark:text-blue-400" /> 4. Approximate Load
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
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
                            whileHover={{ scale: 1.03, y: -2 }}
                            whileTap={{ scale: 0.97 }}
                            onClick={() => setBookingData(prev => ({ ...prev, approxLoad: option.id as any }))}
                            className={`p-4 rounded-2xl border-2 transition-all text-center flex flex-col items-center justify-between min-h-[140px] relative shadow-sm ${
                              bookingData.approxLoad === option.id
                                ? 'bg-blue-50/90 dark:bg-blue-900/30 border-blue-600 ring-2 ring-blue-500/20 dark:ring-blue-400/20'
                                : 'bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800 hover:border-blue-200 dark:hover:border-blue-800 hover:shadow-md'
                            }`}
                          >
                            <span className="font-extrabold text-sm sm:text-base text-gray-900 dark:text-gray-100 tracking-tight">
                              {option.label}
                            </span>
                            
                            <div className="flex flex-col items-center my-1">
                              <span className="text-2xl sm:text-3xl font-black text-blue-600 dark:text-blue-400 tracking-tight">
                                ₹{loadBasePrice}
                              </span>
                              
                              {hasDiscount && (
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <span className="text-xs text-gray-400 dark:text-gray-500 line-through font-bold">
                                    ₹{loadRegularPrice}
                                  </span>
                                  <span className="text-[9px] font-black uppercase text-emerald-700 dark:text-emerald-300 bg-emerald-100/90 dark:bg-emerald-950/60 px-1.5 py-0.2 rounded">
                                    -₹{savingsAmount}
                                  </span>
                                </div>
                              )}
                            </div>

                            <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
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

                    <div className="mt-4 p-4 bg-amber-50/90 dark:bg-amber-950/30 rounded-2xl border border-amber-200/70 dark:border-amber-800/50 space-y-3">
                      {/* Minimum Charge Disclaimer */}
                      <div className="flex items-start gap-2.5">
                        <Info className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                        <div className="text-xs text-amber-900 dark:text-amber-200 leading-relaxed">
                          <span className="font-bold">Minimum Charge Disclaimer: </span>
                          {isExpress ? (
                            <span>
                              A minimum charge of <strong className="font-bold">₹{4 * expressRate}</strong> applies for Express Wash loads up to 4 kg
                              {isOfferActive && regularExpressRate > expressRate && (
                                <span className="text-amber-700/80 dark:text-amber-300/80"> (Regular <span className="line-through">₹{4 * regularExpressRate}</span>)</span>
                              )}.
                            </span>
                          ) : (
                            <span>
                              A minimum charge of <strong className="font-bold">₹{4 * standardRate}</strong> applies for laundry loads up to 4 kg
                              {isOfferActive && regularStandardRate > standardRate && (
                                <span className="text-amber-700/80 dark:text-amber-300/80"> (Regular <span className="line-through">₹{4 * regularStandardRate}</span>)</span>
                              )}.
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Outfit Guide */}
                      <div className="pt-2.5 border-t border-amber-200/60 dark:border-amber-800/40 text-xs text-amber-900 dark:text-amber-200 space-y-1.5">
                        <div className="font-bold text-[11px] sm:text-xs text-amber-800 dark:text-amber-300">
                          1 outfit ≈ 1 top + 1 bottom
                        </div>
                        <div className="inline-flex flex-wrap items-center gap-2 bg-amber-100/70 dark:bg-amber-900/30 px-3 py-1.5 rounded-lg text-[11px] sm:text-xs font-semibold text-amber-800 dark:text-amber-300">
                          <span>T-shirt ≈ 250g</span>
                          <span className="text-amber-400 dark:text-amber-600">|</span>
                          <span>Jeans ≈ 550g</span>
                          <span className="text-amber-400 dark:text-amber-600">|</span>
                          <span>Pants ≈ 400g</span>
                        </div>
                      </div>

                      {/* Weight verification & excess policy */}
                      <div className="pt-2.5 border-t border-amber-200/60 dark:border-amber-800/40 text-[11px] sm:text-xs text-amber-900/90 dark:text-amber-200/90 leading-relaxed">
                        <p>
                          Your laundry may be weighed before processing. If the actual weight exceeds your selected category, the applicable higher category may be charged. However, don’t worry—if it’s only a small variation, it's on us.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Per-Piece Garment Item Selection */
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center">
                        <Shirt className="w-4 h-4 mr-2 text-blue-600 dark:text-blue-400" /> 4. Select Garment Pieces
                      </h3>
                      {totalPieces > 0 && (
                        <span className="text-xs font-black text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/40 px-2.5 py-1 rounded-lg">
                          {totalPieces} {totalPieces === 1 ? 'piece' : 'pieces'} (₹{pieceTotalPrice})
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
                <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4 flex items-center">
                  <AlertTriangle className="w-4 h-4 mr-2 text-blue-600 dark:text-blue-400" /> 5. Special Instructions & Care
                </h3>
                <div className="space-y-3">
                  <label className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Garment Care Details</label>
                  
                  <div className="p-3.5 bg-blue-50/80 dark:bg-blue-950/30 rounded-xl border border-blue-200/60 dark:border-blue-800/40 flex items-start gap-2.5">
                    <AlertTriangle className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
                    <div className="text-xs text-blue-900 dark:text-blue-200 space-y-1">
                      <p className="font-bold uppercase tracking-wider text-[11px] text-blue-700 dark:text-blue-300">Garment Care & Color Bleeding Disclaimer:</p>
                      <p>
                        Please specify any <strong>color-bleeding garments, white clothes, delicate fabrics, or specific washing needs</strong> below. WashWise is not liable for color bleeding or damage if unflagged in care details.
                      </p>
                    </div>
                  </div>

                  <textarea
                    value={bookingData.garmentInstructions}
                    onChange={(e) => setBookingData(prev => ({ ...prev, garmentInstructions: e.target.value }))}
                    placeholder="e.g. Red cotton shirt bleeds color (wash separately), white linen shirt needs gentle wash, delicate silk item, remove stain on sleeve..."
                    rows={3}
                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-gray-100 resize-none text-xs sm:text-sm"
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
            className={`mt-8 p-5 sm:p-6 rounded-3xl border-2 shadow-sm ${
              isSubscriber 
                ? 'bg-gradient-to-br from-green-50/90 via-emerald-50/30 to-teal-50/70 dark:from-gray-900 dark:via-gray-800/80 dark:to-gray-900 border-green-200/80 dark:border-green-800/50'
                : 'bg-gradient-to-br from-blue-50/90 via-indigo-50/30 to-blue-50/70 dark:from-gray-900 dark:via-gray-800/80 dark:to-gray-900 border-blue-200/80 dark:border-blue-800/50'
            }`}
          >
            <div className={`flex items-center justify-between pb-3 border-b ${
              isSubscriber ? 'border-green-200/60 dark:border-green-800/40' : 'border-blue-200/60 dark:border-blue-800/40'
            }`}>
              <div className="flex items-center gap-2">
                <Receipt className={`w-4 h-4 sm:w-5 sm:h-5 ${isSubscriber ? 'text-green-600 dark:text-green-400' : 'text-blue-600 dark:text-blue-400'}`} />
                <span className="text-xs font-black uppercase tracking-wider text-gray-800 dark:text-gray-200">
                  {isSubscriber ? 'Subscriber Booking Summary' : 'Live Price Estimate'}
                </span>
              </div>
              <span className={`text-xs font-bold px-3 py-1 rounded-xl ${
                isSubscriber 
                  ? 'text-green-700 dark:text-green-300 bg-green-100/80 dark:bg-green-900/50'
                  : 'text-blue-700 dark:text-blue-300 bg-blue-100/80 dark:bg-blue-900/50'
              }`}>
                {bookingData.serviceType} • {isPerPiece ? `${totalPieces} pieces` : bookingData.approxLoad}
              </span>
            </div>

            <div className="space-y-2.5 py-3.5 text-xs sm:text-sm">
              <div className="flex justify-between items-center text-gray-600 dark:text-gray-300">
                <span>
                  {isPerPiece 
                    ? `Wash & Fold (Per Piece: ${totalPieces} items)`
                    : `${bookingData.serviceType} (${bookingData.approxLoad} @ ₹${currentRatePerKg}/kg)`}
                </span>
                {isSubscriber ? (
                  <span className="font-black text-green-600 dark:text-green-400">
                    {totalCreditsNeeded} Credits
                  </span>
                ) : (
                  <span className="font-bold text-gray-800 dark:text-gray-100">₹{currentBasePrice}</span>
                )}
              </div>

              {isPerPiece && pieceBreakdown.length > 0 && (
                <div className={`pl-3 py-1 border-l-2 space-y-1 ${
                  isSubscriber ? 'border-green-400 dark:border-green-600' : 'border-blue-300 dark:border-blue-700'
                }`}>
                  {pieceBreakdown.map((item) => (
                    <div key={item.id} className="flex justify-between text-[11px] text-gray-500 dark:text-gray-400">
                      <span>{item.count}x {item.name}</span>
                      {isSubscriber ? (
                        <span className="font-semibold text-green-600 dark:text-green-400">{item.totalCredits} Credits</span>
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
                    <Truck className={`w-3.5 h-3.5 ${isSubscriber ? 'text-green-600 dark:text-green-400' : 'text-blue-600 dark:text-blue-400'}`} /> Pickup & Drop Delivery Fee
                  </span>
                  <span className="font-bold text-gray-800 dark:text-gray-100">
                    {isSubscriber ? <span className="text-green-600 dark:text-green-400 font-bold">FREE (Subscriber Benefit)</span> : `+₹${deliveryFee}`}
                  </span>
                </div>
              ) : (
                <div className="flex justify-between items-center text-gray-500 dark:text-gray-400 text-xs">
                  <span>Store Visit (Self Drop & Pickup)</span>
                  <span className="text-green-600 dark:text-green-400 font-bold">₹0 (No delivery charge)</span>
                </div>
              )}

              {isSubscriber && (
                <div className="p-3 bg-white/80 dark:bg-gray-800/80 rounded-xl border border-green-500/20 flex items-center justify-between text-xs">
                  <span className="text-gray-600 dark:text-gray-300 font-medium">Your Monthly Credit Balance:</span>
                  <span className="font-black text-green-700 dark:text-green-300">
                    🧺 {user?.laundryCredits ?? 160} Credits Available
                  </span>
                </div>
              )}
            </div>

            <div className={`pt-3.5 border-t flex justify-between items-center ${
              isSubscriber ? 'border-green-200/60 dark:border-green-800/40' : 'border-blue-200/60 dark:border-blue-800/40'
            }`}>
              <div>
                <span className="text-xs font-black text-gray-700 dark:text-gray-300 uppercase tracking-widest block">
                  {isSubscriber ? 'Credits to Deduct' : 'Total Bill Price'}
                </span>
                <span className="text-[10px] text-gray-500 dark:text-gray-400">
                  {isSubscriber 
                    ? 'Covered under your active membership' 
                    : bookingData.pickupDrop ? `(₹${currentBasePrice} wash + ₹${deliveryFee} delivery)` : '(Inclusive of all charges)'}
                </span>
              </div>
              <div className="text-right">
                {isSubscriber ? (
                  <span className="text-2xl sm:text-3xl font-black text-green-600 dark:text-green-400 tracking-tight">
                    {totalCreditsNeeded} Credits
                  </span>
                ) : (
                  <div className="flex flex-col items-end">
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl sm:text-3xl font-black text-blue-600 dark:text-blue-400 tracking-tight">
                        ₹{currentTotalPrice}
                      </span>
                      {isOfferActive && currentTotalSavings > 0 && (
                        <span className="text-sm sm:text-base text-gray-400 dark:text-gray-500 line-through font-bold">
                          ₹{currentRegularTotalPrice}
                        </span>
                      )}
                    </div>
                    {isOfferActive && currentTotalSavings > 0 && (
                      <span className="text-[10px] sm:text-xs font-black text-green-600 dark:text-green-400 uppercase tracking-tight">
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
        <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-800/60 rounded-2xl border border-gray-200/80 dark:border-gray-700/80 flex items-center gap-3">
          <input
            type="checkbox"
            id="termsCheckbox"
            checked={acceptedTerms}
            onChange={(e) => setAcceptedTerms(e.target.checked)}
            className="w-5 h-5 text-blue-600 rounded-md border-gray-300 focus:ring-blue-500 cursor-pointer accent-blue-600 shrink-0"
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
          <p className="mt-3 text-xs text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 shrink-0" />
            Please select at least 1 garment piece to proceed.
          </p>
        )}

        <button
          onClick={handleNext}
          disabled={!canProceed}
          className={`w-full mt-6 py-4 font-bold rounded-2xl transition-all shadow-lg flex items-center justify-center gap-2 ${
            !canProceed
              ? 'bg-gray-200 dark:bg-gray-800 text-gray-400 dark:text-gray-600 cursor-not-allowed shadow-none'
              : isSubscriber
                ? 'bg-green-600 text-white hover:bg-green-700 shadow-green-200 dark:shadow-none'
                : 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-200 dark:shadow-none'
          }`}
        >
          <span>
            {isSubscriber 
              ? `Proceed with ${totalCreditsNeeded} Credits` 
              : `Proceed to Billing • ₹${currentTotalPrice}`}
          </span>
          <ArrowLeft className="w-4 h-4 rotate-180" />
        </button>

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
