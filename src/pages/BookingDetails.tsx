import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, Check, Package, Truck, Weight, Info, MapPin, Phone, AlertTriangle, Home } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { StoreService, Store } from '../services/StoreService';

const BookingDetails: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { settings } = useSettings();
  
  const dateStr = searchParams.get('date') || '';
  const timeSlot = searchParams.get('slot') || '';

  const [bookingData, setBookingData] = useState({
    pickupDrop: false,
    serviceType: 'Wash & Fold' as 'Wash & Fold' | 'Express Wash' | 'Instant Booking',
    approxLoad: '1-4 kg' as '1-4 kg' | '5 kg' | '6 kg' | '7+ kg',
    address: '',
    phone: '',
    latitude: 0,
    longitude: 0,
    deliveryFee: 0,
    storeId: ''
  });

  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);

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
    } else if (bookingData.serviceType === 'Instant Booking') {
      basePrice += pricing.instantBooking;
    }
    
    if (bookingData.pickupDrop && user?.userType !== 'subscriber') {
      basePrice += 30; // Flat delivery fee
    }
    
    return basePrice;
  };

  const handleNext = () => {
    if (bookingData.pickupDrop && (!bookingData.address || !bookingData.phone)) {
      return;
    }

    const price = calculatePrice();
    const isSubscriber = user?.userType === 'subscriber';
    const deliveryFee = (bookingData.pickupDrop && !isSubscriber) ? 30 : 0;

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
      storeId: bookingData.storeId
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
                  className="space-y-6 overflow-hidden"
                >
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Pickup Address</label>
                    <div className="relative">
                      <Home className="absolute left-4 top-4 w-5 h-5 text-gray-400 dark:text-gray-500" />
                      <textarea
                        required
                        value={bookingData.address}
                        onChange={(e) => setBookingData({ ...bookingData, address: e.target.value })}
                        placeholder="Enter your full address with landmarks..."
                        rows={3}
                        className="w-full pl-12 pr-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-gray-100 resize-none"
                      />
                    </div>
                  </div>

                  {stores.length > 0 && (
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Select Store</label>
                      <select
                        value={bookingData.storeId}
                        onChange={(e) => {
                          const store = stores.find(s => s.id === e.target.value);
                          setSelectedStore(store || null);
                          setBookingData({ ...bookingData, storeId: e.target.value });
                        }}
                        className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-gray-100"
                      >
                        {stores.map(store => (
                          <option key={store.id} value={store.id}>{store.name}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="p-4 rounded-2xl flex items-start gap-4 bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200">
                    <Info className="w-5 h-5 mt-0.5" />
                    <div>
                      <p className="text-sm font-bold">Delivery Information</p>
                      <p className="text-xs opacity-80">
                        {user?.userType === 'subscriber' 
                          ? 'Delivery is FREE for subscribers!' 
                          : 'A flat delivery fee of ₹30 applies for pickup and drop service.'}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Contact Phone</label>
                      <div className="relative">
                        <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
                        <input
                          type="tel"
                          required
                          value={bookingData.phone}
                          onChange={(e) => setBookingData({ ...bookingData, phone: e.target.value })}
                          placeholder="Enter your phone number"
                          className="w-full pl-12 pr-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-gray-100"
                        />
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </section>

          {/* Service Type */}
          <section>
            <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4 flex items-center">
              <Package className="w-4 h-4 mr-2" /> Service Type
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {['Wash & Fold', 'Express Wash', 'Instant Booking'].map((type) => (
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
                    {type === 'Wash & Fold' ? 'Standard care' : type === 'Express Wash' ? 'Faster delivery' : 'Priority booking'}
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
            <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl flex items-start">
              <Info className="w-4 h-4 text-amber-600 dark:text-amber-400 mr-2 mt-0.5" />
              <p className="text-xs text-amber-800 dark:text-amber-200">Minimum charge of ₹{settings?.pricing.minCharge || 156} applies for up to 4 kg.</p>
            </div>
          </section>
        </div>

        <button
          onClick={handleNext}
          disabled={bookingData.pickupDrop && (!bookingData.address || !bookingData.phone)}
          className={`w-full mt-10 py-4 font-bold rounded-2xl transition-all shadow-lg flex items-center justify-center ${
            bookingData.pickupDrop && (!bookingData.address || !bookingData.phone)
              ? 'bg-gray-200 dark:bg-gray-800 text-gray-400 dark:text-gray-600 cursor-not-allowed shadow-none'
              : 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-200 dark:shadow-none'
          }`}
        >
          Proceed to Billing
          <ArrowLeft className="w-4 h-4 ml-2 rotate-180" />
        </button>
      </motion.div>
    </div>
  );
};

export default BookingDetails;
