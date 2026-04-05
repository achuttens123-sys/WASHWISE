import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

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

  switch (type) {
    case 'booking_confirmed':
      title = 'Booking Confirmed! 🧺';
      message = `Your laundry booking (${bookingId.slice(-6).toUpperCase()}) has been confirmed. See you at ${details.newSlot}!`;
      break;
    case 'booking_rejected':
      title = 'Booking Rejected ❌';
      message = `Your booking (${bookingId.slice(-6).toUpperCase()}) was rejected. Reason: ${details.reason || 'No reason provided.'}`;
      break;
    case 'booking_rescheduled':
      title = 'Booking Rescheduled 🔄';
      message = `Your booking was rescheduled from ${details.oldSlot} to ${details.newSlot}. Reason: ${details.reason || 'Scheduling conflict.'}`;
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
