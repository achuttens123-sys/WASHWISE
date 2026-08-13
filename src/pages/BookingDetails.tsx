import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, Check, Package, Truck, Weight, Info, MapPin, Phone, AlertTriangle, Home, Search, Store as StoreIcon, Plus } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { StoreService } from '../services/StoreService';
import { Store } from '../types';
import TermsModal from '../components/TermsModal';

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
    serviceType: 'Wash & Fold' as 'Wash & Fold' | 'Express Wash',
    approxLoad: '1-4 kg' as '1-4 kg' | '5 kg' | '6 kg' | '7+ kg',
    address: '',
    phone: '',
    latitude: 0,
    longitude: 0,
    deliveryFee: 0,
    storeId: '',
    garmentInstructions: ''
  });

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

  const calculatePrice = () => {
    if (!settings) return 0;
    const { pricing } = settings;
    
    let basePrice = pricing.minCharge;
    const loadRange = bookingData.approxLoad;
    
    if (loadRange === '5 kg') {
      basePrice = 5 * pricing.pricePerKg;
    } else if (loadRange === '6 kg') {
      basePrice = 6 * pricing.pricePerKg;
    } else if (loadRange === '7+ kg') {
      basePrice = 7 * pricing.pricePerKg;
    }
    
    if (bookingData.serviceType === 'Express Wash') {
      basePrice += pricing.expressWash;
    }
    
    if (bookingData.pickupDrop && user?.userType !== 'subscriber') {
      basePrice += settings?.pricing?.deliveryFee ?? 30; // Dynamic delivery fee
    }
    
    return basePrice;
  };

  const handleNext = () => {
    if (bookingData.pickupDrop && (!bookingData.address || !bookingData.phone)) {
      return;
    }

    if (!bookingData.storeId) {
      return;
    }

    const price = calculatePrice();
    const isSubscriber = user?.userType === 'subscriber';
    const deliveryFee = (bookingData.pickupDrop && !isSubscriber) ? (settings?.pricing?.deliveryFee ?? 30) : 0;

    const params = new URLSearchParams({
      date: dateStr,
      slot: timeSlot,
      pickupDrop: bookingData.pickupDrop.toString(),
      serviceType: bookingData.serviceType,
      approxLoad: bookingData.approxLoad,
      price: price.toString(),
      address: bookingData.address,
      phone: bookingData.phone,
      lat: "0",
      lng: "0",
      fee: deliveryFee.toString(),
      storeId: bookingData.storeId,
      garmentInstructions: bookingData.garmentInstructions
    });
    navigate(`/billing?${params.toString()}`);
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 pb-32">
      <button 
        onClick={() => navigate('/dashboard')}
        className="flex items-center text-gray-500 hover:text-blue-600 mb-8 transition-colors"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Change Slot
      </button>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white dark:bg-gray-900 p-8 rounded-3xl shadow-xl border border-blue-50 dark:border-gray-800"
      >
        <div className="mb-8 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-2xl flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">Selected Slot</p>
            <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">{dateStr} | {timeSlot}</h2>
          </div>
          <div className="bg-white dark:bg-gray-800 p-2 rounded-xl shadow-sm">
            <Check className="w-6 h-6 text-green-500" />
          </div>
        </div>

        <div className="space-y-10">
          {/* Pickup & Drop */}
          <section>
            <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4 flex items-center">
              <Truck className="w-4 h-4 mr-2" /> Pickup & Drop
            </h3>
            <div className="grid grid-cols-2 gap-4 mb-6">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setBookingData({ ...bookingData, pickupDrop: true })}
                className={`p-4 rounded-2xl border-2 transition-all text-left ${
                  bookingData.pickupDrop ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-600' : 'bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800 hover:border-blue-200 dark:hover:border-blue-800'
                }`}
              >
                <div className="flex justify-between items-center mb-2">
                  <span className="font-bold text-gray-800 dark:text-gray-100">Yes</span>
                  {bookingData.pickupDrop && <motion.div layoutId="pickup-dot" className="w-4 h-4 bg-blue-600 rounded-full" />}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Doorstep service</p>
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setBookingData({ ...bookingData, pickupDrop: false })}
                className={`p-4 rounded-2xl border-2 transition-all text-left ${
                  !bookingData.pickupDrop ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-600' : 'bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800 hover:border-blue-200 dark:hover:border-blue-800'
                }`}
              >
                <div className="flex justify-between items-center mb-2">
                  <span className="font-bold text-gray-800 dark:text-gray-100">No</span>
                  {!bookingData.pickupDrop && <motion.div layoutId="pickup-dot" className="w-4 h-4 bg-blue-600 rounded-full" />}
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
                            onClick={() => setBookingData({ ...bookingData, address: addr })}
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
                              setBookingData({ ...bookingData, address: e.target.value });
                            }}
                            placeholder="Enter your full address with landmarks..."
                            rows={3}
                            className="w-full pl-12 pr-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-gray-100 resize-none"
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
                              setBookingData({ ...bookingData, address: newAddressText.trim() });
                              setIsAddingNewAddress(false);
                            }}
                            className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors"
                          >
                            Save & Use This Address
                          </button>
                          {(user?.savedAddresses?.length || user?.address) ? (
                            <button
                              onClick={() => {
                                setIsAddingNewAddress(false);
                                setBookingData({ ...bookingData, address: user.address || user.savedAddresses?.[0] || '' });
                              }}
                              className="px-6 py-3 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-bold rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                            >
                              Cancel
                            </button>
                          ) : null}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="p-4 rounded-2xl flex items-start gap-4 bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200">
                    <Info className="w-5 h-5 mt-0.5" />
                    <div>
                      <p className="text-sm font-bold">Delivery Information</p>
                      <p className="text-xs opacity-80">
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
                              onClick={() => setBookingData({ ...bookingData, phone: ph })}
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
                                setBookingData({ ...bookingData, phone: e.target.value });
                              }}
                              placeholder="Enter your phone number"
                              className="w-full pl-12 pr-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-gray-100"
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
                                setBookingData({ ...bookingData, phone: newPhoneText.trim() });
                                setIsAddingNewPhone(false);
                              }}
                              className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors"
                            >
                              Save & Use This Number
                            </button>
                            {(user?.savedPhones?.length || user?.phone) ? (
                              <button
                                onClick={() => {
                                  setIsAddingNewPhone(false);
                                  setBookingData({ ...bookingData, phone: user.phone || user.savedPhones?.[0] || '' });
                                }}
                                className="px-6 py-3 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-bold rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
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

            {/* Store Selection - Always Visible */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center">
                <StoreIcon className="w-4 h-4 mr-2" /> Select Store
              </h3>
              
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input 
                  type="text"
                  placeholder="Search for a shop by name or location..."
                  value={storeSearch}
                  onChange={(e) => setStoreSearch(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-gray-100"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 max-h-60 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-gray-700">
                {stores
                  .filter(s => 
                    s.name.toLowerCase().includes(storeSearch.toLowerCase()) || 
                    s.location.toLowerCase().includes(storeSearch.toLowerCase())
                  )
                  .map(store => (
                    <button
                      key={store.id}
                      onClick={() => {
                        setSelectedStore(store);
                        setBookingData({ ...bookingData, storeId: store.id });
                      }}
                      className={`p-4 rounded-2xl border-2 transition-all text-left flex items-center justify-between ${
                        bookingData.storeId === store.id 
                          ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-600' 
                          : 'bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800 hover:border-blue-200 dark:hover:border-blue-800'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-xl ${bookingData.storeId === store.id ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-400'}`}>
                          <StoreIcon className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="font-bold text-gray-800 dark:text-gray-100">{store.name}</p>
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{store.location}</p>
                        </div>
                      </div>
                      {bookingData.storeId === store.id && (
                        <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center">
                          <Check className="w-4 h-4 text-white" />
                        </div>
                      )}
                    </button>
                  ))}
                {stores.filter(s => 
                  s.name.toLowerCase().includes(storeSearch.toLowerCase()) || 
                  s.location.toLowerCase().includes(storeSearch.toLowerCase())
                ).length === 0 && (
                  <div className="py-8 text-center">
                    <p className="text-gray-500 dark:text-gray-400 font-medium">No stores found matching your search.</p>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Service Type */}
          <section>
            <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4 flex items-center">
              <Package className="w-4 h-4 mr-2" /> Service Type
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {['Wash & Fold', 'Express Wash'].map((type) => (
                <motion.button
                  key={type}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setBookingData({ ...bookingData, serviceType: type as any })}
                  className={`p-4 rounded-2xl border-2 transition-all text-left ${
                    bookingData.serviceType === type ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-600' : 'bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800 hover:border-blue-200 dark:hover:border-blue-800'
                  }`}
                >
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-bold text-gray-800 dark:text-gray-100">{type}</span>
                    {bookingData.serviceType === type && <motion.div layoutId="service-dot" className="w-4 h-4 bg-blue-600 rounded-full" />}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {type === 'Wash & Fold' ? 'Standard care' : 'Faster delivery'}
                  </p>
                </motion.button>
              ))}
            </div>
          </section>

          {/* Approx Load */}
          <section>
            <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4 flex items-center">
              <Weight className="w-4 h-4 mr-2" /> Approximate Load
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {['1-4 kg', '5 kg', '6 kg', '7+ kg'].map((load, index) => (
                <motion.button
                  key={load}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.1 + index * 0.05 }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setBookingData({ ...bookingData, approxLoad: load as any })}
                  className={`p-4 rounded-2xl border-2 transition-all text-center ${
                    bookingData.approxLoad === load ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-600' : 'bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800 hover:border-blue-200 dark:hover:border-blue-800'
                  }`}
                >
                  <span className="font-bold text-sm text-gray-800 dark:text-gray-100">{load}</span>
                </motion.button>
              ))}
            </div>
            <div className="mt-4 p-3.5 bg-amber-50 dark:bg-amber-950/30 rounded-xl border border-amber-200/60 dark:border-amber-800/40 flex items-start gap-2.5">
              <Info className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
              <div className="text-xs text-amber-800 dark:text-amber-200">
                <span className="font-bold">Minimum Charge Disclaimer: </span>
                A minimum charge of ₹{settings?.pricing.minCharge || 156} applies for laundry loads up to 4 kg.
              </div>
            </div>
          </section>

          {/* Garment Instructions */}
          <section>
            <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4 flex items-center">
              <AlertTriangle className="w-4 h-4 mr-2" /> Special Instructions & Care
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
                onChange={(e) => setBookingData({ ...bookingData, garmentInstructions: e.target.value })}
                placeholder="e.g. Red cotton shirt bleeds color (wash separately), white linen shirt needs gentle wash, delicate silk item, remove stain on sleeve..."
                rows={3}
                className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-gray-100 resize-none text-xs sm:text-sm"
              />
            </div>
          </section>
        </div>

        {/* Terms and Conditions Checkbox */}
        <div className="mt-8 p-4 bg-gray-50 dark:bg-gray-800/60 rounded-2xl border border-gray-200/80 dark:border-gray-700/80 flex items-center gap-3">
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

        <button
          onClick={handleNext}
          disabled={(bookingData.pickupDrop && (!bookingData.address || !bookingData.phone)) || !bookingData.storeId || !acceptedTerms}
          className={`w-full mt-6 py-4 font-bold rounded-2xl transition-all shadow-lg flex items-center justify-center ${
            (bookingData.pickupDrop && (!bookingData.address || !bookingData.phone)) || !bookingData.storeId || !acceptedTerms
              ? 'bg-gray-200 dark:bg-gray-800 text-gray-400 dark:text-gray-600 cursor-not-allowed shadow-none'
              : 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-200 dark:shadow-none'
          }`}
        >
          Proceed to Billing
          <ArrowLeft className="w-4 h-4 ml-2 rotate-180" />
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
