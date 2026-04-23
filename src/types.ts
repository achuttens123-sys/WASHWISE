export type AdminRole = 'super_admin' | 'store_admin' | 'store_manager' | 'store_staff' | 'delivery_staff' | 'delivery_partner';

export interface User {
  uid: string;
  name: string;
  email: string;
  phone?: string;
  userType: 'guest' | 'subscriber' | 'admin';
  role?: 'admin' | 'user';
  adminRole?: AdminRole;
  storeId?: string; // Assigned store for managers and staff
  employeeId?: string;
  staffId?: string;
  isFirstLogin?: boolean;
  address?: string;
  status?: 'active' | 'inactive';
  lastLogin?: any;
  studentId?: string;
  isRegistered?: boolean;
  lastOrderDate?: string;
  package?: string;
  subscriptionPaid?: boolean;
  subscriptionStartDate?: string;
  isSuspended?: boolean;
  walletBalance?: number;
  photoURL?: string;
  createdAt?: any;
  termsAccepted?: boolean;
  deviceIds?: string[];
  deviceId?: string;
  ipAddress?: string;
}

export interface Store {
  id: string;
  name: string;
  location: string;
  address: string;
  phone: string;
  storeCode?: string;
  latitude?: number;
  longitude?: number;
  active: boolean;
  isPaused?: boolean;
  maintenanceMessage?: string;
  createdAt: any;
}

export interface Machine {
  id: string;
  storeId: string;
  number: number;
  type: 'washer' | 'dryer';
  status: 'free' | 'occupied' | 'maintenance' | 'unavailable' | 'idle' | 'running';
  isAvailable?: boolean;
  currentBookingId?: string;
  timeRemaining?: number;
}

export interface Bag {
  id: string;
  orderId: string;
  weight: number;
  tagId: string;
}

export interface Package {
  id: string;
  name: string;
  price: number;
  originalPrice: number;
  description: string;
}

export interface Slot {
  id?: string;
  date: string; // YYYY-MM-DD
  timeSlot: string; // e.g., "09:00-10:00"
  machines: {
    [key: string]: string; // machine number (1-4) -> user uid
  };
  isPaused?: boolean;
}

export interface Booking {
  id?: string;
  userId: string;
  userName: string;
  date: string;
  timeSlot: string;
  machineNumber: number;
  pickupDrop: boolean;
  address?: string;
  phone?: string;
  latitude?: number;
  longitude?: number;
  deliveryFee?: number;
  storeId?: string;
  staffId?: string;
  deliveryStaffId?: string;
  serviceType: 'Wash & Fold' | 'Express Wash' | 'Instant Booking' | 'Subscription';
  approxLoad: '1-4 kg' | '5 kg' | '6 kg' | '7+ kg';
  price: number;
  status: 'pending' | 'paid' | 'completed' | 'rejected' | 'rescheduled' | 'In Wash' | 'In Dryer' | 'Ready to collect' | 'Ready to deliver' | 'Ready for pick up' | 'Washing completed' | 'Out for delivery';
  packageId?: string;
  garmentInstructions?: string;
  createdAt?: any;
  rejectionReason?: string;
  rescheduledTo?: string; // ID of the new booking if this was rejected and rescheduled
}

export const TIME_SLOTS = [
  "08:00-09:00 AM",
  "09:00-10:00 AM",
  "10:00-11:00 AM",
  "11:00-12:00 PM",
  "12:00-01:00 PM",
  "01:00-02:00 PM",
  "02:00-03:00 PM",
  "03:00-04:00 PM",
  "04:00-05:00 PM",
  "05:00-06:00 PM",
  "06:00-07:00 PM",
  "07:00-08:00 PM"
];
