import { collection, addDoc, serverTimestamp, doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { getToken, onMessage } from 'firebase/messaging';
import { db, messaging, auth } from '../firebase';

export interface Notification {
  id?: string;
  userId: string;
  title: string;
  message: string;
  type: 'booking_confirmed' | 'booking_rejected' | 'booking_rescheduled';
  bookingId: string;
  email: string;
  createdAt: any;
  isRead: boolean;
}

const VAPID_KEY = import.meta.env.VITE_FCM_VAPID_KEY;

export const requestNotificationPermission = async () => {
  if (!messaging) return null;

  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      console.log('Notification permission granted.');
      const token = await getToken(messaging, {
        vapidKey: VAPID_KEY,
      });

      if (token) {
        if (import.meta.env.DEV) console.log('FCM Token:', token);
        await saveTokenToFirestore(token);
        return token;
      } else {
        console.log('No registration token available. Request permission to generate one.');
      }
    } else {
      console.log('Unable to get permission to notify.');
    }
  } catch (error) {
    console.error('An error occurred while retrieving token. ', error);
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

export const onMessageListener = () =>
  new Promise((resolve) => {
    if (!messaging) return;
    onMessage(messaging, (payload) => {
      console.log('Message received. ', payload);
      resolve(payload);
    });
  });

export const sendNotification = async (
  userId: string,
  email: string,
  phone: string,
  type: Notification['type'],
  bookingId: string,
  details: { oldSlot?: string; newSlot?: string; reason?: string } = {}
) => {
  let title = '';
  let message = '';
  const displayBookingId = bookingId ? (bookingId.includes('/') ? bookingId : bookingId.slice(-6).toUpperCase()) : '';

  switch (type) {
    case 'booking_confirmed':
      title = 'Booking Confirmed! 🧺';
      message = `Your laundry booking (${displayBookingId}) has been confirmed. See you at ${details.newSlot}!`;
      break;
    case 'booking_rejected':
      title = 'Booking Rejected ❌';
      message = `Your booking (${displayBookingId}) was rejected. Reason: ${details.reason || 'No reason provided.'}`;
      break;
    case 'booking_rescheduled':
      title = 'Booking Rescheduled 🔄';
      message = `Your booking (${displayBookingId}) was rescheduled from ${details.oldSlot} to ${details.newSlot}. Reason: ${details.reason || 'Scheduling conflict.'}`;
      break;
  }

  // 1. Store in Firestore (The "Real" Integration for our app)
  try {
    await addDoc(collection(db, 'notifications'), {
      userId,
      email,
      title,
      message,
      type,
      bookingId,
      createdAt: serverTimestamp(),
      isRead: false
    });

    console.log(`%c [NOTIFICATION STORED FOR ${email}]`, 'background: #222; color: #bada55; font-size: 16px');
  } catch (error) {
    console.error('Error sending notification:', error);
  }
};
