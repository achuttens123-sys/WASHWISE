import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Truck, 
  MapPin, 
  Phone, 
  CheckCircle2, 
  Loader2, 
  Navigation, 
  AlertCircle,
  Package,
  User,
  Clock,
  ChevronRight,
  Map as MapIcon,
  ExternalLink
} from 'lucide-react';
import { collection, query, where, onSnapshot, updateDoc, doc, orderBy, getDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { Booking } from '../../types';
import { GamificationService } from '../../services/GamificationService';
import { format } from 'date-fns';

const DeliveryStaffDashboard: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'pickups' | 'deliveries'>('pickups');
  const [tasks, setTasks] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.storeId) return;

    // Fetch pickups or deliveries assigned to the store
    const q = query(
      collection(db, 'bookings'),
      where('storeId', '==', user.storeId),
      where('pickupDrop', '==', true),
      where('status', 'in', ['paid', 'Ready for pick up', 'Ready to deliver', 'Out for delivery']),
      orderBy('createdAt', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Booking[];
      setTasks(data);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'bookings');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user?.storeId]);

  const updateStatus = async (id: string, status: Booking['status']) => {
    try {
      await updateDoc(doc(db, 'bookings', id), { status });
      
      if (status === 'completed') {
        const bookingSnap = await getDoc(doc(db, 'bookings', id));
        if (bookingSnap.exists()) {
          const booking = bookingSnap.data() as Booking;
          await GamificationService.awardOrderRewards(booking.userId, { ...booking, id });
          await GamificationService.validateReferral(booking.userId, { ...booking, id });
        }
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `bookings/${id}`);
    }
  };

  const openInMaps = (lat: number, lng: number) => {
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, '_blank');
  };

  const pickups = tasks.filter(t => ['paid', 'Ready for pick up'].includes(t.status));
  const deliveries = tasks.filter(t => ['Ready to deliver', 'Out for delivery'].includes(t.status));

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 className="w-12 h-12 text-blue-600 animate-spin mb-4" />
        <p className="text-gray-500 font-black uppercase tracking-widest text-sm">Loading Routes...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-black text-gray-800 dark:text-gray-100 tracking-tight uppercase">DELIVERY PANEL</h1>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-gray-500 dark:text-gray-400 font-bold uppercase tracking-widest text-xs">
              {pickups.length} Pickups • {deliveries.length} Deliveries
            </p>
            <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest bg-indigo-50 dark:bg-indigo-900/20 px-2 py-0.5 rounded-lg">
              Store: {user?.storeId}
            </span>
          </div>
        </div>
        <div className="p-4 bg-indigo-600 rounded-3xl shadow-xl shadow-indigo-200 dark:shadow-none">
          <Truck className="w-8 h-8 text-white" />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex p-1 bg-gray-100 dark:bg-gray-800 rounded-[2rem]">
        <button
          onClick={() => setActiveTab('pickups')}
          className={`flex-1 flex items-center justify-center gap-2 py-4 rounded-[1.8rem] font-black uppercase tracking-widest text-xs transition-all ${
            activeTab === 'pickups' ? 'bg-white dark:bg-gray-700 text-blue-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'
          }`}
        >
          <Package className="w-4 h-4" />
          Pickups ({pickups.length})
        </button>
        <button
          onClick={() => setActiveTab('deliveries')}
          className={`flex-1 flex items-center justify-center gap-2 py-4 rounded-[1.8rem] font-black uppercase tracking-widest text-xs transition-all ${
            activeTab === 'deliveries' ? 'bg-white dark:bg-gray-700 text-indigo-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'
          }`}
        >
          <Truck className="w-4 h-4" />
          Deliveries ({deliveries.length})
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {(activeTab === 'pickups' ? pickups : deliveries).length === 0 ? (
          <div className="bg-white dark:bg-gray-900 p-12 rounded-[3rem] border border-gray-100 dark:border-gray-800 text-center">
            <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-black text-gray-800 dark:text-gray-100 uppercase tracking-tight">No Active Tasks</h2>
            <p className="text-gray-500 dark:text-gray-400 font-medium">All {activeTab} for today are completed.</p>
          </div>
        ) : (
          (activeTab === 'pickups' ? pickups : deliveries).map((task, index) => (
            <motion.div
              key={task.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="bg-white dark:bg-gray-900 p-8 rounded-[3rem] border border-gray-100 dark:border-gray-800 shadow-xl shadow-gray-100/50 dark:shadow-none"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
                <div className="flex items-center gap-6">
                  <div className={`w-20 h-20 rounded-[2rem] flex items-center justify-center ${
                    activeTab === 'pickups' ? 'bg-blue-50 text-blue-600' : 'bg-indigo-50 text-indigo-600'
                  }`}>
                    <User className="w-10 h-10" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="px-3 py-1 bg-gray-100 dark:bg-gray-800 text-gray-500 text-[10px] font-black uppercase tracking-widest rounded-full">
                        {task.timeSlot}
                      </span>
                      <span className={`px-3 py-1 text-[10px] font-black uppercase tracking-widest rounded-full ${
                        task.status === 'Out for delivery' ? 'bg-indigo-100 text-indigo-700' : 'bg-blue-100 text-blue-700'
                      }`}>
                        {task.status}
                      </span>
                    </div>
                    <h3 className="text-2xl font-black text-gray-800 dark:text-gray-100 tracking-tight">{task.userName}</h3>
                    <div className="flex items-center gap-2 text-sm font-bold text-gray-400 uppercase tracking-widest">
                      <MapPin className="w-4 h-4" />
                      {task.address || 'No Address Provided'}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    onClick={() => task.latitude && task.longitude && openInMaps(task.latitude, task.longitude)}
                    className="flex-1 md:flex-none p-6 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 rounded-[2rem] font-black uppercase tracking-widest hover:bg-gray-200 transition-all group"
                  >
                    <Navigation className="w-6 h-6 group-hover:scale-110 transition-transform" />
                  </button>
                  <a
                    href={`tel:${task.phone}`}
                    className="flex-1 md:flex-none p-6 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 rounded-[2rem] font-black uppercase tracking-widest hover:bg-gray-200 transition-all group"
                  >
                    <Phone className="w-6 h-6 group-hover:scale-110 transition-transform" />
                  </a>
                  
                  {activeTab === 'pickups' && (
                    <button
                      onClick={() => updateStatus(task.id!, 'Ready for pick up')}
                      className="flex-1 md:flex-none px-8 py-6 bg-blue-600 text-white rounded-[2rem] font-black uppercase tracking-widest hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 dark:shadow-none group"
                    >
                      Mark Picked
                    </button>
                  )}

                  {activeTab === 'deliveries' && (
                    <>
                      {task.status === 'Ready to deliver' ? (
                        <button
                          onClick={() => updateStatus(task.id!, 'Out for delivery')}
                          className="flex-1 md:flex-none px-8 py-6 bg-indigo-600 text-white rounded-[2rem] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 dark:shadow-none group"
                        >
                          Start Delivery
                        </button>
                      ) : (
                        <button
                          onClick={() => updateStatus(task.id!, 'completed')}
                          className="flex-1 md:flex-none px-8 py-6 bg-green-600 text-white rounded-[2rem] font-black uppercase tracking-widest hover:bg-green-700 transition-all shadow-lg shadow-green-200 dark:shadow-none group"
                        >
                          Mark Delivered
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
};

export default DeliveryStaffDashboard;
