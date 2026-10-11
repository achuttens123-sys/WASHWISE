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
  suspendedReason?: string;
  riskLevel?: 'low' | 'medium' | 'high' | 'blocked';
  riskScore?: number;
  riskFlags?: string[];
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

export interface ReminderTemplate {
  id: string;
  text: string;
  tag?: 'weekly_checkin' | 'weekend_vibe' | 'weekday_smart' | 'fomo_slot' | 'custom';
  active: boolean;
}

export interface ReminderSettings {
  enabled: boolean;
  daysAfterLastBooking: number; // default: 5 days
  quietHoursStart?: number; // e.g. 22 (10 PM)
  quietHoursEnd?: number; // e.g. 8 (8 AM)
  maxRemindersPerWeek?: number; // default: 1 to prevent irritation
  templates: ReminderTemplate[];
  upcomingWashHoursNotice?: number; // default: 2 hours prior
  subscriptionDaysNotice?: number; // default: 3 days prior
}

export const DEFAULT_REMINDER_TEMPLATES: ReminderTemplate[] = [
  { id: '1', text: 'New week alle… ningal busy aayal mathi, laundry njangal handle cheyyam', tag: 'weekly_checkin', active: true },
  { id: '2', text: 'Just checking… laundry plan undo? 😏', tag: 'weekly_checkin', active: true },
  { id: '3', text: 'Half week kazhinju… little refresh venam alle?', tag: 'weekday_smart', active: true },
  { id: '4', text: '“Innu small wash cheythal… weekend free aakum 😌”', tag: 'weekday_smart', active: true },
  { id: '5', text: '“Ningal relax cheyyan… njangal laundry handle cheyyam 🤍”', tag: 'weekday_smart', active: true },
  { id: '6', text: '“Weekend plans undo? 👀 clothes ready aano? 😉”', tag: 'weekend_vibe', active: true },
  { id: '7', text: '“Friday vibe set aakan… fresh clothes must alle 😏”', tag: 'weekend_vibe', active: true },
  { id: '8', text: '“Innu perfect day aanu… laundry kazhinjal full relax 😌”', tag: 'weekend_vibe', active: true },
  { id: '9', text: '“Saturday chillinu munpe… oru quick wash cheyyam? 😊”', tag: 'weekend_vibe', active: true },
  { id: '10', text: '“Hey… ningal relax cheyyu 🤍 but slots fast fill aavunnu… book cheyyumo? 😊”', tag: 'fomo_slot', active: true },
  { id: '11', text: '“Innu wash njangal handle cheyyam… but kurachu slots mathram baki 😌”', tag: 'fomo_slot', active: true },
  { id: '12', text: '“Ningalk vendi oru slot save cheyyan thonni 😏 but others fast aayi book cheyyunnu 👀”', tag: 'fomo_slot', active: true },
  { id: '13', text: '“Late aayal… ningal miss aakum 😌 njangal wait cheyyunnu ketto”', tag: 'fomo_slot', active: true },
];

export const DEFAULT_REMINDER_SETTINGS: ReminderSettings = {
  enabled: true,
  daysAfterLastBooking: 5,
  quietHoursStart: 22,
  quietHoursEnd: 8,
  maxRemindersPerWeek: 1,
  templates: DEFAULT_REMINDER_TEMPLATES,
  upcomingWashHoursNotice: 2,
  subscriptionDaysNotice: 3,
};

export interface ReferralSettings {
  enabled: boolean;
  referrerCredits: number;
  referrerWalletCash: number;
  maxWalletCashReferrals?: number; // Only first N referrals give wallet money (default: 3). Remaining referrals are credit-only.
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
  isCashRewarded?: boolean;
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
  unavailableFrom?: string; // YYYY-MM-DD start of non-availability
  unavailableTo?: string;   // YYYY-MM-DD end of non-availability (inclusive, optional for ongoing)
  unavailableReason?: string;
  currentBookingId?: string;
  timeRemaining?: number;
  createdAt?: any;
}

export const isMachineAvailableOnDate = (machine: Machine, targetDateStr: string): boolean => {
  // If permanently disabled or in maintenance/unavailable status
  if (machine.isAvailable === false) return false;
  if (machine.status === 'maintenance' || machine.status === 'unavailable') return false;

  // Check date range non-availability
  if (machine.unavailableFrom) {
    if (machine.unavailableTo) {
      if (targetDateStr >= machine.unavailableFrom && targetDateStr <= machine.unavailableTo) {
        return false;
      }
    } else {
      if (targetDateStr >= machine.unavailableFrom) {
        return false;
      }
    }
  }

  return true;
};

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
  codConvenienceFee?: number;
  codSlotBookingFee?: number;
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
  codConvenienceFee?: number;
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
  totalAmount?: number;
  prepaidAmount?: number;
  remainingAmount?: number;
  isCodPrepaid?: boolean;
  codPrepaidMethod?: 'wallet' | 'card' | 'upi' | 'netbanking' | string;
  codBalancePaid?: boolean;
  codBalancePaidAt?: string;
  bookingFeeType?: 'flat_39' | 'percent_20';
  codSlotBookingFee?: number;
  slotBookingFee?: number;
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
  weightKg?: number | string;
  pickupDate?: string;
  deliveryDate?: string;
  slotNumber?: string | number;
  tagPrinted?: boolean;
  tagPrintedAt?: string;
  invoicePrinted?: boolean;
  invoicePrintedAt?: string;
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

// Helper to convert time slot strings like "08:00-09:00 AM" into sortable minutes from midnight
export const parseSlotToMinutes = (slotStr: string): number => {
  try {
    const parts = slotStr.trim().split(' ');
    const range = parts[0] || '';
    const period = (parts[1] || '').toUpperCase();
    const startTime = range.split('-')[0] || '';
    let [hours, minutes] = startTime.split(':').map(Number);
    if (isNaN(hours)) hours = 0;
    if (isNaN(minutes)) minutes = 0;
    
    if (period === 'PM' && hours < 12) {
      hours += 12;
    } else if (period === 'AM' && hours === 12) {
      hours = 0;
    }
    return hours * 60 + minutes;
  } catch (e) {
    return 0;
  }
};

export const sortTimeSlots = (slots: string[]): string[] => {
  return [...slots].sort((a, b) => parseSlotToMinutes(a) - parseSlotToMinutes(b));
};

export const checkIsSubscriber = (user: any): boolean => {
  if (!user) return false;
  return Boolean(
    user.userType === 'subscriber' ||
    user.subscriptionPaid === true ||
    Boolean(user.package) ||
    (typeof user.laundryCredits === 'number' && user.laundryCredits > 0) ||
    (typeof user.kilosLeft === 'number' && user.kilosLeft > 0)
  );
};

export type RiskType = 
  | 'HIGH_BOOKING_VELOCITY'
  | 'EXCESSIVE_COD_ORDERS'
  | 'PROMO_BRUTE_FORCE'
  | 'SUSPICIOUS_TOPUP'
  | 'SUSPENDED_ACCOUNT_ATTEMPT'
  | 'REFERRAL_RING_DETECTED'
  | 'TAMPERED_CLIENT_PRICE'
  | 'UNAUTHORIZED_ADMIN_ATTEMPT';

export type RiskSeverity = 'low' | 'medium' | 'high' | 'critical';
export type RiskAction = 'blocked' | 'flagged' | 'warned';

export interface RiskLog {
  id?: string;
  userId?: string;
  userEmail?: string;
  ipAddress?: string;
  riskType: RiskType;
  severity: RiskSeverity;
  actionTaken: RiskAction;
  details: string;
  metadata?: Record<string, any>;
  createdAt: string;
}

export interface RiskSettings {
  maxDailyBookingsPerUser: number;
  maxActiveCodBookings: number;
  maxSingleWalletTopup: number;
  maxDailyWalletTopup: number;
  promoAttemptLimit: number;
  enforceIpReferralCheck: boolean;
  autoBlockHighRisk: boolean;
}

