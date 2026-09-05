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
  savedAddresses?: string[];
  savedPhones?: string[];
  status?: 'active' | 'inactive';
  lastLogin?: any;
  studentId?: string;
  isRegistered?: boolean;
  lastOrderDate?: string;
  package?: string;
  subscriptionPaid?: boolean;
  subscriptionStartDate?: string;
  subscriptionSnapshot?: SubscriptionSnapshot;
  kilosLeft?: number;
  laundryCredits?: number;
  totalMonthlyCredits?: number;
  creditResetDate?: string;
  isSuspended?: boolean;
  walletBalance?: number;
  photoURL?: string;
  referralCode?: string;
  referredBy?: string;
  referralCount?: number;
  totalReferralCreditsEarned?: number;
  totalReferralCashEarned?: number;
  totalLoyaltyCreditsEarned?: number;
  completedWashCount?: number;
  createdAt?: any;
  termsAccepted?: boolean;
  emailVerified?: boolean;
  deviceIds?: string[];
  deviceId?: string;
  ipAddress?: string;
}

export interface LoyaltySettings {
  enabled: boolean;
  creditsPerWash: number; // e.g. 5
  redemptionThreshold: number; // e.g. 40
  rewardOnFreeWash?: boolean;
}

export interface ReferralSettings {
  enabled: boolean;
  referrerCredits: number;
  referrerWalletCash: number;
  refereeBonusCredits: number;
  refereeDiscountRupees: number;
  minBookingAmountToReward?: number;
  rewardTrigger?: 'first_order' | 'subscription_purchase' | 'immediate';
}

export interface ReferralRecord {
  id: string;
  referrerId: string;
  referrerName: string;
  referrerEmail?: string;
  referralCode: string;
  referredUserId: string;
  referredUserName: string;
  referredUserEmail?: string;
  status: 'pending' | 'completed' | 'expired';
  rewardCredits: number;
  rewardWalletCash: number;
  refereeBonusCredits: number;
  refereeDiscountRupees: number;
  orderId?: string;
  createdAt: string;
  completedAt?: string;
}

export interface Store {
  id: string;
  name: string;
  location: string;
  address: string;
  phone: string;
  storeCode?: string;
  districtCode?: string;
  latitude?: number;
  longitude?: number;
  active: boolean;
  isPaused?: boolean;
  maintenanceMessage?: string;
  createdAt: any;
}

export interface DistrictOption {
  code: string;
  name: string;
}

export const KERALA_DISTRICTS: DistrictOption[] = [
  { code: 'TV', name: 'Thiruvananthapuram' },
  { code: 'KL', name: 'Kollam' },
  { code: 'PT', name: 'Pathanamthitta' },
  { code: 'AL', name: 'Alappuzha' },
  { code: 'KT', name: 'Kottayam' },
  { code: 'EK', name: 'Ernakulam' },
  { code: 'ID', name: 'Idukki' },
  { code: 'TR', name: 'Thrissur' },
  { code: 'PL', name: 'Palakkad' },
  { code: 'ML', name: 'Malappuram' },
  { code: 'KZ', name: 'Kozhikode' },
  { code: 'KN', name: 'Kannur' },
  { code: 'KG', name: 'Kasargod' },
  { code: 'WY', name: 'Wayanad' }
];

export const generateStoreId = (storeSequenceNumber: number, districtCode: string): string => {
  const seq = storeSequenceNumber.toString().padStart(3, '0');
  const dist = (districtCode || 'KT').toUpperCase();
  return `WW${seq}${dist}`;
};

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

export interface PricingSettings {
  regular_price_per_kg: number;
  offer_price_per_kg: number;
  express_regular_price_per_kg: number;
  express_offer_price_per_kg: number;
  limited_time_offer: boolean;
  pricePerKg?: number;
  expressWash?: number;
  washFold?: number;
  instantBooking?: number;
  minCharge: number;
  minLoad: number;
  deliveryFee: number;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  regular_price: number;
  offer_price: number;
  price: number;
  originalPrice: number;
  credits: number;
  monthlyCredits?: number;
  kg_equivalent: number;
  kgLimit?: number;
  discount: number;
  savings?: number;
  mostPopular?: boolean;
  isMaxSavings?: boolean;
  active?: boolean;
  features?: string[];
  description?: string;
}

export interface SubscriptionSnapshot {
  plan_name: string;
  regular_price: number;
  offer_price: number;
  price_paid: number;
  credits: number;
  kg_equivalent: number;
  offer_active: boolean;
  purchase_date: string;
}

export interface Package {
  id: string;
  name: string;
  price: number;
  originalPrice: number;
  regular_price?: number;
  offer_price?: number;
  credits?: number;
  kg_equivalent?: number;
  description: string;
  features?: string[];
  mostPopular?: boolean;
  isMaxSavings?: boolean;
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

export interface GarmentPieceItem {
  id: string;
  category: 'Tops' | 'Bottoms' | 'Combos & Sets' | 'Activewear' | 'Whites' | string;
  subCategory?: string;
  name: string;
  description?: string;
  includes?: string;
  regular_price: number; // Regular reference price
  offer_price: number; // Promotional offer price
  price: number; // Active price
  avgWeight?: string; // e.g. "250g", "700g"
  approxWeightKg?: number;
  subscriberCredits?: number; // credits deducted for active subscribers (e.g. 3, 8, 5)
  unitCredits?: number;
  active?: boolean;
  offer_active?: boolean;
}

export interface GarmentPieceSnapshot {
  garment_id: string;
  garment_name: string;
  quantity: number;
  regular_unit_price: number;
  offer_unit_price: number;
  price_used: number;
  offer_active: boolean;
  total_price: number;
  timestamp: string;
}

export interface SelectedPieceItem {
  id: string;
  category: string;
  subCategory?: string;
  name: string;
  description?: string;
  includes?: string;
  count: number;
  unitPrice: number;
  regularUnitPrice?: number;
  offerUnitPrice?: number;
  regular_unit_price?: number;
  offer_unit_price?: number;
  price_used?: number;
  offer_active?: boolean;
  totalPrice: number;
  totalRegularPrice?: number;
  savings?: number;
  totalSavings?: number;
  unitCredits?: number;
  subscriberCredits?: number;
  totalCredits?: number;
  avgWeight?: string;
}

export interface Booking {
  id?: string;
  bookingId?: string; // Formatted ID: e.g. 0001/AUG/26/1007
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
  serviceType: 'Wash & Fold' | 'Express Wash' | 'Wash & Fold (Per Piece)' | 'Instant Booking' | 'Subscription';
  approxLoad?: '1-4 kg' | '5 kg' | '6 kg' | '7+ kg' | string;
  garmentPieces?: Record<string, number>;
  pieceBreakdown?: SelectedPieceItem[];
  garmentPieceSnapshots?: GarmentPieceSnapshot[];
  totalPieces?: number;
  price: number;
  regular_price_per_kg?: number;
  offer_price_per_kg?: number;
  price_used?: number;
  offer_active?: boolean;
  creditsUsed?: number;
  paymentType?: 'direct_inr' | 'laundry_credits' | 'wallet' | 'card' | 'netbanking' | 'pay_at_store';
  status: 'pending' | 'paid' | 'completed' | 'rejected' | 'rescheduled' | 'In Wash' | 'In Dryer' | 'Ready to collect' | 'Ready to deliver' | 'Ready for pick up' | 'Washing completed' | 'Out for delivery';
  loyaltyRewarded?: boolean;
  loyaltyCreditsAwarded?: number;
  loyaltyRewardedAt?: string;
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
