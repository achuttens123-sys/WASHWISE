import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, X, CheckCircle2, AlertCircle, Clock3, Loader2, Sparkles, Shirt, Truck, CreditCard } from 'lucide-react';
import { collection, query, where, orderBy, onSnapshot, updateDoc, doc, limit } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { Notification, showDeviceSystemNotification } from '../services/NotificationService';
import { getDisplayBookingId } from '../services/BookingIdService';
import { format } from 'date-fns';

import { useNavigate } from 'react-router-dom';

const NotificationCenter: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const isInitialLoadRef = React.useRef(true);
  const notifiedIdsRef = React.useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc'),
      limit(20)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const rawNotifs = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data()
      })) as any[];

      // Client-side visual deduplication: ensure user never sees duplicate notification cards for same order & status
      const seenCards = new Set<string>();
      const notifs: any[] = [];

      for (const notif of rawNotifs) {
        const orderId = getDisplayBookingId(notif.bookingId || notif.bookingDocId);
        const cardKey = `${orderId}_${notif.type}_${notif.title}`;
        if (!seenCards.has(cardKey)) {
          seenCards.add(cardKey);
          notifs.push({
            ...notif,
            displayBookingId: orderId
          });
        }
      }

      // When a fresh unread notification arrives (not on first mount), post strictly once to OS notification bar
      if (!isInitialLoadRef.current) {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added') {
            const newNotif = change.doc.data() as any;
            const orderId = getDisplayBookingId(newNotif.bookingId || newNotif.bookingDocId);
            const notifKey = `${orderId}_${newNotif.type}`;
            if (newNotif && !newNotif.isRead && !notifiedIdsRef.current.has(notifKey)) {
              notifiedIdsRef.current.add(notifKey);
              showDeviceSystemNotification(newNotif.title || 'WashWise Update', {
                body: newNotif.message || `Order ${orderId}: New laundry update received`,
                tag: `order-${orderId || change.doc.id}`,
                data: {
                  bookingId: orderId,
                  link: newNotif.link
                }
              });
            }
          }
        });
      }
      isInitialLoadRef.current = false;

      setNotifications(notifs.slice(0, 10));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'notifications');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const markAsRead = async (id: string) => {
    try {
      await updateDoc(doc(db, 'notifications', id), { isRead: true });
    } catch (error) {
      console.error(error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const unread = notifications.filter(n => !n.isRead);
      await Promise.all(unread.map(n => updateDoc(doc(db, 'notifications', (n as any).id), { isRead: true })));
    } catch (error) {
      console.error(error);
    }
  };

  const getIcon = (type: Notification['type']) => {
    switch (type) {
      case 'booking_confirmed': return <CheckCircle2 className="w-5 h-5 text-green-500" />;
      case 'booking_rejected': return <AlertCircle className="w-5 h-5 text-red-500" />;
      case 'booking_rescheduled': return <Clock3 className="w-5 h-5 text-blue-500" />;
      case 'upcoming_wash': return <Clock3 className="w-5 h-5 text-amber-500" />;
      case 'wash_stage_update': return <Shirt className="w-5 h-5 text-blue-500" />;
      case 'ready_for_pickup': return <Sparkles className="w-5 h-5 text-emerald-500" />;
      case 'out_for_delivery': return <Truck className="w-5 h-5 text-purple-500" />;
      case 'wash_completed': return <CheckCircle2 className="w-5 h-5 text-green-500" />;
      case 'weekly_wash_reminder': return <Sparkles className="w-5 h-5 text-[#3b5bfd]" />;
      case 'subscription_renewal_reminder': return <CreditCard className="w-5 h-5 text-indigo-500" />;
      default: return <Bell className="w-5 h-5 text-blue-500" />;
    }
  };

  return (
    <div className="relative">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={`relative p-2 text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 transition-all bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 haptic-feedback ${unreadCount > 0 ? 'ring-2 ring-blue-500/20' : ''}`}
      >
        <Bell className={`w-6 h-6 ${unreadCount > 0 ? 'animate-pulse-glow text-blue-600 dark:text-blue-400' : ''}`} />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 w-5 h-5 bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-white dark:border-gray-900 transform translate-x-1 -translate-y-1 animate-bounce">
            {unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <div 
              className="fixed inset-0 z-40 bg-black/40 backdrop-blur-xs" 
              onClick={() => setIsOpen(false)} 
            />
            {/* Responsive Container: Fixed overlay on mobile, anchored right-dropdown on desktop */}
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.96 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="fixed inset-x-3 top-20 sm:top-auto sm:inset-x-auto sm:absolute sm:right-0 sm:mt-3 w-auto sm:w-96 max-w-[calc(100vw-1.5rem)] bg-white dark:bg-gray-900 rounded-3xl shadow-2xl border border-gray-100 dark:border-gray-800 z-50 overflow-hidden"
            >
              <div className="p-4 sm:p-5 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl">
                <div className="flex items-center gap-2">
                  <Bell className="w-4 h-4 text-primary-electric" />
                  <h3 className="text-sm sm:text-base font-black text-gray-800 dark:text-gray-100 tracking-tight uppercase">
                    Notifications
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  {unreadCount > 0 && (
                    <button 
                      onClick={markAllAsRead}
                      className="text-[10px] sm:text-xs font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest hover:underline px-1 py-0.5"
                    >
                      Mark all read
                    </button>
                  )}
                  <button
                    onClick={() => setIsOpen(false)}
                    aria-label="Close notification dropdown"
                    className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="max-h-[65vh] sm:max-h-96 overflow-y-auto divide-y divide-gray-50 dark:divide-gray-800/80">
                {loading ? (
                  <div className="p-12 text-center">
                    <Loader2 className="w-6 h-6 animate-spin text-blue-600 mx-auto" />
                  </div>
                ) : notifications.length === 0 ? (
                  <div className="p-12 text-center">
                    <Bell className="w-8 h-8 text-gray-200 dark:text-gray-700 mx-auto mb-2" />
                    <p className="text-sm font-bold text-gray-400 dark:text-gray-500">No notifications yet</p>
                  </div>
                ) : (
                  notifications.map((notif) => (
                    <div 
                      key={(notif as any).id}
                      onClick={() => {
                        markAsRead((notif as any).id);
                        setIsOpen(false);
                        if (notif.link) {
                          navigate(notif.link);
                        } else if (notif.bookingId) {
                          navigate(`/confirmation?id=${notif.bookingId}`);
                        } else {
                          navigate('/dashboard');
                        }
                      }}
                      className={`p-4 border-b border-gray-50 dark:border-gray-800 flex gap-4 transition-colors cursor-pointer ${notif.isRead ? 'opacity-60' : 'bg-blue-50/30 dark:bg-blue-900/10 hover:bg-blue-50/50 dark:hover:bg-blue-900/20'}`}
                    >
                      <div className="flex-shrink-0 mt-1">
                        {getIcon(notif.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-black text-gray-800 dark:text-gray-200 leading-tight mb-1">{notif.title}</p>
                        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 line-clamp-2 mb-2">{notif.message}</p>
                        <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
                          {notif.createdAt?.toDate ? format(notif.createdAt.toDate(), 'MMM d, h:mm a') : 'Just now'}
                        </p>
                      </div>
                      {!notif.isRead && (
                        <div className="w-2 h-2 bg-blue-600 dark:bg-blue-400 rounded-full mt-2 flex-shrink-0" />
                      )}
                    </div>
                  ))
                )}
              </div>

              <div className="p-4 bg-gray-50 dark:bg-gray-800 text-center">
                <button className="text-xs font-bold text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                  View all activity
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default NotificationCenter;
