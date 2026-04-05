import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  CheckCircle2, 
  Loader2, 
  AlertCircle,
  Package,
  User,
  Clock,
  ChevronRight,
  Play,
  Check,
  Wind,
  Droplets
} from 'lucide-react';
import { collection, query, where, onSnapshot, updateDoc, doc, orderBy } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { Booking } from '../../types';
import { format } from 'date-fns';

const StoreStaffDashboard: React.FC = () => {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.storeId) return;

    // Fetch assigned or available tasks for the store
    const q = query(
      collection(db, 'bookings'),
      where('storeId', '==', user.storeId),
      where('status', 'in', ['paid', 'In Wash', 'In Drier', 'Washing completed']),
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
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `bookings/${id}`);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 className="w-12 h-12 text-blue-600 animate-spin mb-4" />
        <p className="text-gray-500 font-black uppercase tracking-widest text-sm">Loading Tasks...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-black text-gray-800 dark:text-gray-100 tracking-tight uppercase">MY TASKS</h1>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-gray-500 dark:text-gray-400 font-bold uppercase tracking-widest text-xs">
              {tasks.length} Active Tasks • {format(new Date(), 'MMM dd')}
            </p>
            <span className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded-lg">
              Store: {user?.storeId}
            </span>
          </div>
        </div>
        <div className="p-4 bg-blue-600 rounded-3xl shadow-xl shadow-blue-200 dark:shadow-none">
          <Package className="w-8 h-8 text-white" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {tasks.length === 0 ? (
          <div className="bg-white dark:bg-gray-900 p-12 rounded-[3rem] border border-gray-100 dark:border-gray-800 text-center">
            <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-black text-gray-800 dark:text-gray-100 uppercase tracking-tight">All Caught Up!</h2>
            <p className="text-gray-500 dark:text-gray-400 font-medium">No active tasks assigned to your store right now.</p>
          </div>
        ) : (
          tasks.map((task, index) => (
            <motion.div
              key={task.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="bg-white dark:bg-gray-900 p-8 rounded-[3rem] border border-gray-100 dark:border-gray-800 shadow-xl shadow-gray-100/50 dark:shadow-none relative overflow-hidden"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
                <div className="flex items-center gap-6">
                  <div className="w-20 h-20 bg-blue-50 dark:bg-blue-900/20 rounded-[2rem] flex items-center justify-center text-blue-600">
                    <User className="w-10 h-10" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="px-3 py-1 bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest rounded-full">
                        M#{task.machineNumber}
                      </span>
                      <span className="px-3 py-1 bg-gray-100 dark:bg-gray-800 text-gray-500 text-[10px] font-black uppercase tracking-widest rounded-full">
                        {task.timeSlot}
                      </span>
                    </div>
                    <h3 className="text-2xl font-black text-gray-800 dark:text-gray-100 tracking-tight">{task.userName}</h3>
                    <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">{task.serviceType} • {task.approxLoad}</p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-4">
                  {task.status === 'paid' && (
                    <button
                      onClick={() => updateStatus(task.id!, 'In Wash')}
                      className="flex-1 md:flex-none flex items-center justify-center gap-3 px-8 py-6 bg-blue-600 text-white rounded-[2rem] font-black uppercase tracking-widest hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 dark:shadow-none group"
                    >
                      <Droplets className="w-6 h-6 group-hover:scale-110 transition-transform" />
                      Start Washing
                    </button>
                  )}
                  {task.status === 'In Wash' && (
                    <button
                      onClick={() => updateStatus(task.id!, 'In Drier')}
                      className="flex-1 md:flex-none flex items-center justify-center gap-3 px-8 py-6 bg-indigo-600 text-white rounded-[2rem] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 dark:shadow-none group"
                    >
                      <Wind className="w-6 h-6 group-hover:scale-110 transition-transform" />
                      Move to Drying
                    </button>
                  )}
                  {task.status === 'In Drier' && (
                    <button
                      onClick={() => updateStatus(task.id!, 'Washing completed')}
                      className="flex-1 md:flex-none flex items-center justify-center gap-3 px-8 py-6 bg-green-600 text-white rounded-[2rem] font-black uppercase tracking-widest hover:bg-green-700 transition-all shadow-lg shadow-green-200 dark:shadow-none group"
                    >
                      <Check className="w-6 h-6 group-hover:scale-110 transition-transform" />
                      Mark Ready
                    </button>
                  )}
                  {task.status === 'Washing completed' && (
                    <div className="flex items-center gap-3 px-8 py-6 bg-green-50 dark:bg-green-900/20 text-green-600 rounded-[2rem] font-black uppercase tracking-widest">
                      <CheckCircle2 className="w-6 h-6" />
                      Ready for Pickup
                    </div>
                  )}
                </div>
              </div>
              
              {/* Progress Bar */}
              <div className="absolute bottom-0 left-0 right-0 h-2 bg-gray-100 dark:bg-gray-800">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ 
                    width: task.status === 'paid' ? '25%' : 
                           task.status === 'In Wash' ? '50%' : 
                           task.status === 'In Drier' ? '75%' : '100%' 
                  }}
                  className={`h-full transition-all duration-1000 ${
                    task.status === 'Washing completed' ? 'bg-green-500' : 'bg-blue-500'
                  }`}
                />
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
};

export default StoreStaffDashboard;
