import { doc, getDoc, runTransaction, getDocs, collection, Firestore } from 'firebase/firestore';

/**
 * Logic: XXXX/Month first 3 Letters/Year/Time of booking (24hrs HHmm)
 * Example: if booked at 10:07 AM on Aug 13, 2026 with sequence 1
 * Booking ID -> 0001/AUG/26/1007
 */
export const generateBookingId = (sequenceNumber: number, date: Date = new Date()): string => {
  const seq = Math.max(1, Number(sequenceNumber) || 1).toString().padStart(4, '0');
  const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const month = monthNames[date.getMonth()];
  const year = date.getFullYear().toString().slice(-2);
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const time = `${hours}${minutes}`;
  return `${seq}/${month}/${year}/${time}`;
};

/**
 * Atomically increments and gets the next booking sequence and generated booking ID inside a Firestore transaction.
 */
export const getNextBookingIdInTransaction = async (
  transaction: any,
  db: Firestore,
  date: Date = new Date()
): Promise<{ bookingId: string; sequence: number }> => {
  const counterRef = doc(db, 'counters', 'bookings');
  const counterSnap = await transaction.get(counterRef);

  let currentSequence = 0;
  if (counterSnap.exists()) {
    currentSequence = Number(counterSnap.data()?.lastSequence) || 0;
  }

  const nextSequence = currentSequence + 1;
  const bookingId = generateBookingId(nextSequence, date);

  transaction.set(counterRef, {
    lastSequence: nextSequence,
    updatedAt: new Date().toISOString()
  }, { merge: true });

  return { bookingId, sequence: nextSequence };
};

/**
 * Increments and gets the next booking ID outside a transaction with fallback.
 */
export const getNextBookingId = async (
  db: Firestore,
  date: Date = new Date()
): Promise<{ bookingId: string; sequence: number }> => {
  try {
    const counterRef = doc(db, 'counters', 'bookings');
    return await runTransaction(db, async (transaction) => {
      const counterSnap = await transaction.get(counterRef);
      let currentSequence = 0;
      if (counterSnap.exists()) {
        currentSequence = Number(counterSnap.data()?.lastSequence) || 0;
      }
      const nextSequence = currentSequence + 1;
      const bookingId = generateBookingId(nextSequence, date);
      transaction.set(counterRef, {
        lastSequence: nextSequence,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      return { bookingId, sequence: nextSequence };
    });
  } catch (error) {
    console.warn('Transaction on counter failed, falling back to count/timestamp:', error);
    try {
      const bookingsSnap = await getDocs(collection(db, 'bookings'));
      const nextSequence = bookingsSnap.size + 1;
      return {
        bookingId: generateBookingId(nextSequence, date),
        sequence: nextSequence
      };
    } catch {
      const fallbackSeq = 1;
      return {
        bookingId: generateBookingId(fallbackSeq, date),
        sequence: fallbackSeq
      };
    }
  }
};

/**
 * Cleanly formats a booking ID for display across any card, table, or notification
 */
export const getDisplayBookingId = (
  booking: { bookingId?: string; id?: string } | string | null | undefined
): string => {
  if (!booking) return 'N/A';
  if (typeof booking === 'string') {
    if (booking.includes('/')) return booking;
    return `#${booking.slice(-6).toUpperCase()}`;
  }
  if (booking.bookingId) {
    return booking.bookingId;
  }
  if (booking.id) {
    if (booking.id.includes('/')) return booking.id;
    return `#${booking.id.slice(-6).toUpperCase()}`;
  }
  return 'N/A';
};
