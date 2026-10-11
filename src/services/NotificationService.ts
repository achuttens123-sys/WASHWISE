import { collection, addDoc, serverTimestamp, doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { getToken, onMessage } from 'firebase/messaging';
import { db, messaging, auth } from '../firebase';
import { getDisplayBookingId } from './BookingIdService';

export type NotificationType = 
  | 'booking_confirmed' 
  | 'booking_rejected' 
  | 'booking_rescheduled'
  | 'upcoming_wash'
  | 'wash_stage_update'
  | 'ready_for_pickup'
  | 'out_for_delivery'
  | 'wash_completed'
  | 'weekly_wash_reminder'
  | 'subscription_renewal_reminder';

export interface Notification {
  id?: string;
  userId: string;
  title: string;
  message: string;
  type: NotificationType;
  bookingId?: string;
  email?: string;
  createdAt: any;
  isRead: boolean;
  link?: string;
}

const VAPID_KEY = import.meta.env.VITE_FCM_VAPID_KEY;

// Deduplication cache to prevent duplicate device system status bar notifications
const recentDeviceNotifications = new Map<string, number>();

/**
 * Dispatches an OS/device status bar notification when permitted.
 * Supported across Android Chrome, desktop browsers, and PWA standalone windows.
 */
export const showDeviceSystemNotification = async (title: string, options: { body: string; icon?: string; data?: any; tag?: string }) => {
  if (typeof window === 'undefined') return;

  const tag = options.tag || 'washwise-order-status';
  const dedupKey = `${tag}___${title}___${options.body}`;
  const now = Date.now();
  const lastTime = recentDeviceNotifications.get(dedupKey);
  if (lastTime && (now - lastTime) < 15000) {
    // Suppress duplicate device notification
    return;
  }
  recentDeviceNotifications.set(dedupKey, now);

  if (recentDeviceNotifications.size > 100) {
    for (const [k, time] of recentDeviceNotifications.entries()) {
      if (now - time > 30000) recentDeviceNotifications.delete(k);
    }
  }

  // Attempt vibration if hardware supports it
  try {
    if ('vibrate' in navigator) {
      navigator.vibrate([200, 100, 200]);
    }
  } catch (e) {
    // Vibration ignored
  }

  try {
    if ('Notification' in window && Notification.permission === 'granted') {
      // 1. Prefer ServiceWorker registration showNotification (required on mobile Chrome/Android for persistent status bar)
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration && 'showNotification' in registration) {
          const swOptions: any = {
            body: options.body,
            icon: options.icon || '/pwa-192x192.png',
            badge: '/pwa-192x192.png',
            tag: options.tag || 'washwise-order-status',
            data: options.data || {},
            vibrate: [200, 100, 200],
          };
          await (registration as any).showNotification(title, swOptions);
          return;
        }
      }

      // 2. Fallback to standard Window Notification API
      new Notification(title, {
        body: options.body,
        icon: options.icon || '/pwa-192x192.png',
        tag: options.tag || 'washwise-order-status',
        data: options.data || {},
      });
    }
  } catch (err) {
    console.warn('Could not post system notification:', err);
  }
};

export const requestNotificationPermission = async () => {
  if (typeof window === 'undefined' || !('Notification' in window)) return null;

  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      console.log('Device Notification permission granted.');

      // Also ensure service worker is active for mobile background push
      if ('serviceWorker' in navigator) {
        try {
          await navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/' });
        } catch (swErr) {
          // SW registration complete
        }
      }

      if (messaging) {
        const token = await getToken(messaging, {
          vapidKey: VAPID_KEY,
        });

        if (token) {
          if (import.meta.env.DEV) console.log('FCM Token:', token);
          await saveTokenToFirestore(token);
          return token;
        }
      }
    }
  } catch (error) {
    console.error('An error occurred while requesting notification token.', error);
  }
  return null;
};

const saveTokenToFirestore = async (token: string) => {
  const user = auth.currentUser;
  if (!user) return;

  try {
    const userRef = doc(db, 'users', user.uid);
    await updateDoc(userRef, {
      fcmTokens: arrayUnion(token),
    });
    console.log('Token saved to Firestore');
  } catch (error) {
    console.error('Error saving token to Firestore:', error);
  }
};

export const onMessageListener = (callback?: (payload: any) => void) => {
  if (!messaging) return () => {};
  return onMessage(messaging, (payload) => {
    console.log('FCM Message received in foreground:', payload);
    if (callback) {
      callback(payload);
    }
  });
};

export const sendNotification = async (
  userId: string,
  email: string,
  phone: string,
  type: Notification['type'],
  bookingId: string = '',
  details: { oldSlot?: string; newSlot?: string; reason?: string; customTitle?: string; customMessage?: string; link?: string } = {}
) => {
  let title = details.customTitle || '';
  let message = details.customMessage || '';
  const displayBookingId = getDisplayBookingId(bookingId);

  if (!title || !message) {
    switch (type) {
      case 'booking_confirmed':
        title = 'Booking Confirmed';
        message = `Your laundry booking (${displayBookingId}) has been confirmed. See you at ${details.newSlot}!`;
        break;
      case 'booking_rejected':
        title = 'Booking Rejected';
        message = `Your booking (${displayBookingId}) was rejected. Reason: ${details.reason || 'No reason provided.'}`;
        break;
      case 'booking_rescheduled':
        title = 'Booking Rescheduled';
        message = `Your booking (${displayBookingId}) was rescheduled from ${details.oldSlot} to ${details.newSlot}. Reason: ${details.reason || 'Scheduling conflict.'}`;
        break;
      case 'upcoming_wash':
        title = '⏰ Upcoming Wash Reminder';
        message = `Your laundry slot starts soon (${details.newSlot || 'today'}). Get your clothes ready for drop-off!`;
        break;
      case 'wash_stage_update':
        title = '🧺 Wash Cycle Update';
        message = `Your laundry #${displayBookingId} is now ${details.reason || 'being washed'}.`;
        break;
      case 'ready_for_pickup':
        title = '✨ Clean Clothes Ready for Pickup!';
        message = `Your clothes for booking #${displayBookingId} are fresh, folded & ready for pickup at the hub.`;
        break;
      case 'out_for_delivery':
        title = '🚚 Out for Delivery';
        message = `Your laundry #${displayBookingId} is on the way to your address!`;
        break;
      case 'wash_completed':
        title = '✅ Wash Completed';
        message = `Order #${displayBookingId} has been successfully completed. Enjoy clean clothes!`;
        break;
      case 'weekly_wash_reminder':
        title = 'WashWise Laundry Reminder 🤍';
        message = details.customMessage || 'Just checking… laundry plan undo? Book your slot before weekend rush!';
        break;
      case 'subscription_renewal_reminder':
        title = '💳 Subscription & Credits Renewal';
        message = details.customMessage || 'Your laundry credits or subscription are renewing soon. Keep washing with zero hassle!';
        break;
    }
  }

  // 1. Store in Firestore (The "Real" Integration for our app)
  try {
    await addDoc(collection(db, 'notifications'), {
      userId,
      email: email || '',
      title,
      message,
      type,
      bookingId: displayBookingId,
      link: details.link || (displayBookingId ? `/confirmation?id=${displayBookingId}` : '/dashboard'),
      createdAt: serverTimestamp(),
      isRead: false
    });

    console.log(`%c [NOTIFICATION STORED FOR ${email || userId}]`, 'background: #222; color: #bada55; font-size: 16px');
  } catch (error) {
    console.error('Error sending notification:', error);
  }
};
