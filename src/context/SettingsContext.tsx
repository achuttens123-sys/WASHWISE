import React, { createContext, useContext, useState, useEffect } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from './AuthContext';
import { GarmentPieceItem, PricingSettings, SubscriptionPlan, ReferralSettings, LoyaltySettings } from '../types';
import { GARMENT_CATALOG, normalizeGarmentItem } from '../data/garmentCatalog';

export const DEFAULT_LOYALTY_SETTINGS: LoyaltySettings = {
  enabled: true,
  creditsPerWash: 5,
  redemptionThreshold: 40,
  rewardOnFreeWash: false
};

export const DEFAULT_REFERRAL_SETTINGS: ReferralSettings = {
  enabled: true,
  referrerCredits: 20,
  referrerWalletCash: 50,
  refereeBonusCredits: 10,
  refereeDiscountRupees: 50,
  minBookingAmountToReward: 40,
  rewardTrigger: 'first_order'
};

export interface GlobalDiscount {
  id: string;
  name: string;
  type: 'percentage' | 'fixed';
  value: number;
  active: boolean;
  applicableFor?: 'all' | 'wash' | 'subscription';
}

export interface PromoCode {
  id: string;
  code: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  expiryDate?: string;
  description?: string;
  active: boolean;
  applicableFor?: 'all' | 'wash' | 'subscription';
}

export interface GlobalSettings {
  pricing: PricingSettings;
  subscriptionPlans: SubscriptionPlan[];
  discounts: GlobalDiscount[];
  promos: PromoCode[];
  allowCreditRollover?: boolean;
  garmentCatalog?: GarmentPieceItem[];
  referral?: ReferralSettings;
  loyalty?: LoyaltySettings;
}

export const DEFAULT_SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  { 
    id: 'basic', 
    name: 'Basic', 
    kg_equivalent: 12, 
    kgLimit: 12, 
    credits: 120, 
    monthlyCredits: 120, 
    regular_price: 828, 
    offer_price: 468, 
    price: 468, 
    originalPrice: 828, 
    discount: 43.48, 
    savings: 360,
    active: true,
    features: ['12 KG Monthly Limit', 'Priority Machine Access', 'Exclusive Rewards'],
    description: '120 Laundry Credits (~12 KG Monthly)' 
  },
  { 
    id: 'standard', 
    name: 'Standard', 
    kg_equivalent: 16, 
    kgLimit: 16, 
    credits: 160, 
    monthlyCredits: 160, 
    regular_price: 1104, 
    offer_price: 624, 
    price: 624, 
    originalPrice: 1104, 
    discount: 43.48, 
    savings: 480,
    active: true,
    features: ['16 KG Monthly Limit', 'Priority Machine Access', 'Exclusive Rewards'],
    description: '160 Laundry Credits (~16 KG Monthly)' 
  },
  { 
    id: 'premium', 
    name: 'Premium', 
    kg_equivalent: 20, 
    kgLimit: 20, 
    credits: 200, 
    monthlyCredits: 200, 
    regular_price: 1380, 
    offer_price: 780, 
    price: 780, 
    originalPrice: 1380, 
    discount: 43.48, 
    savings: 600,
    mostPopular: true,
    isMaxSavings: true,
    active: true,
    features: ['20 KG Monthly Limit', 'Priority Machine Access', 'Exclusive Rewards', 'Max Savings'],
    description: '200 Laundry Credits (~20 KG Monthly)' 
  },
  { 
    id: 'super_premium', 
    name: 'Super Premium', 
    kg_equivalent: 32, 
    kgLimit: 32, 
    credits: 320, 
    monthlyCredits: 320, 
    regular_price: 2208, 
    offer_price: 1248, 
    price: 1248, 
    originalPrice: 2208, 
    discount: 43.48, 
    savings: 960,
    isMaxSavings: true,
    active: true,
    features: ['32 KG Monthly Limit', 'Priority Machine Access', 'Exclusive Rewards', 'Max Savings'],
    description: '320 Laundry Credits (~32 KG Monthly)' 
  }
];

export const DEFAULT_PRICING: PricingSettings = {
  regular_price_per_kg: 69,
  offer_price_per_kg: 39,
  express_regular_price_per_kg: 89,
  express_offer_price_per_kg: 45,
  limited_time_offer: true,
  washFold: 0,
  expressWash: 45,
  instantBooking: 44,
  minCharge: 156,
  pricePerKg: 39,
  minLoad: 4,
  deliveryFee: 5
};

export const normalizeSubscriptionPlans = (plans: any[], isOfferActive: boolean, pricingSettings?: any): SubscriptionPlan[] => {
  const regRate = Number(pricingSettings?.regular_price_per_kg ?? 69);
  const offRate = Number(pricingSettings?.offer_price_per_kg ?? 39);

  if (!plans || plans.length === 0) return DEFAULT_SUBSCRIPTION_PLANS;

  return plans.map((p: any) => {
    const kg = Number(p.kg_equivalent ?? p.kgLimit ?? 12);
    const credits = Number(p.credits ?? p.monthlyCredits ?? (kg * 10));
    
    // Determine expected base values
    const calculatedRegular = kg * regRate;
    const calculatedOffer = kg * offRate;

    // Extract or calculate regular price (ensure it is greater than offer price)
    let regular = Number(p.regular_price ?? p.originalPrice ?? calculatedRegular);
    let offer = Number(p.offer_price ?? (p.price && p.price < calculatedRegular ? p.price : calculatedOffer));

    if (!regular || regular <= offer || regular === 0) {
      regular = calculatedRegular;
    }
    if (!offer || offer === 0) {
      offer = calculatedOffer;
    }
    
    const savings = Math.max(0, regular - offer);
    const discount = regular > 0 ? Math.round(((regular - offer) / regular) * 10000) / 100 : 0;
    const activePrice = isOfferActive ? offer : regular;

    return {
      id: p.id || 'basic',
      name: p.name || 'Plan',
      regular_price: regular,
      offer_price: offer,
      price: activePrice,
      originalPrice: regular,
      credits,
      monthlyCredits: credits,
      kg_equivalent: kg,
      kgLimit: kg,
      discount,
      savings,
      mostPopular: Boolean(p.mostPopular || p.id === 'premium'),
      isMaxSavings: Boolean(p.isMaxSavings || p.id === 'premium' || p.id === 'super_premium'),
      active: p.active !== false,
      features: p.features || ['Priority Machine Access', 'Exclusive Rewards'],
      description: p.description || `${credits} Laundry Credits (~${kg} KG Monthly)`
    };
  });
};

interface SettingsContextType {
  settings: GlobalSettings | null;
  loading: boolean;
  error: string | null;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isSuperAdmin } = useAuth();
  const [settings, setSettings] = useState<GlobalSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const defaultSettings: GlobalSettings = {
      pricing: DEFAULT_PRICING,
      subscriptionPlans: DEFAULT_SUBSCRIPTION_PLANS,
      allowCreditRollover: false,
      garmentCatalog: GARMENT_CATALOG,
      discounts: [],
      promos: [],
      referral: DEFAULT_REFERRAL_SETTINGS,
      loyalty: DEFAULT_LOYALTY_SETTINGS
    };

    const unsub = onSnapshot(doc(db, 'settings', 'global'), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data() as any;
        const rawPricing = data?.pricing || {};
        
        const isOfferActive = rawPricing.limited_time_offer !== false;
        const regPerKg = Number(rawPricing.regular_price_per_kg ?? 69);
        const offPerKg = Number(rawPricing.offer_price_per_kg ?? 39);
        const expRegPerKg = Number(rawPricing.express_regular_price_per_kg ?? 89);
        const expOffPerKg = Number(rawPricing.express_offer_price_per_kg ?? (rawPricing.expressWash ?? 45));
        
        const activePricePerKg = isOfferActive ? offPerKg : regPerKg;
        const activeExpressPerKg = isOfferActive ? expOffPerKg : expRegPerKg;
        const minLoad = Number(rawPricing.minLoad ?? 4);
        const minCharge = Number(rawPricing.minCharge ?? (minLoad * activePricePerKg));
        const deliveryFee = Number(rawPricing.deliveryFee ?? 5);

        const pricingMerged: PricingSettings = {
          regular_price_per_kg: regPerKg,
          offer_price_per_kg: offPerKg,
          express_regular_price_per_kg: expRegPerKg,
          express_offer_price_per_kg: expOffPerKg,
          limited_time_offer: isOfferActive,
          washFold: Number(rawPricing.washFold ?? 0),
          expressWash: activeExpressPerKg,
          instantBooking: Number(rawPricing.instantBooking ?? 44),
          minCharge,
          pricePerKg: activePricePerKg,
          minLoad,
          deliveryFee
        };

        const mergedPlans = normalizeSubscriptionPlans(data?.subscriptionPlans || defaultSettings.subscriptionPlans, isOfferActive, pricingMerged);

        const mergedGarments = (() => {
          if (!data?.garmentCatalog || data.garmentCatalog.length === 0) {
            return GARMENT_CATALOG.map(g => normalizeGarmentItem(g, isOfferActive));
          }
          const existingIds = new Set(data.garmentCatalog.map((g: any) => g.id));
          const missingDefaults = GARMENT_CATALOG.filter(g => !existingIds.has(g.id));
          const combined = [...data.garmentCatalog, ...missingDefaults];
          return combined.map((g: any) => normalizeGarmentItem(g, isOfferActive));
        })();

        const mergedSettings: GlobalSettings = {
          ...defaultSettings,
          ...data,
          pricing: pricingMerged,
          subscriptionPlans: mergedPlans,
          allowCreditRollover: data?.allowCreditRollover ?? false,
          garmentCatalog: mergedGarments,
          discounts: data?.discounts || defaultSettings.discounts,
          promos: data?.promos || defaultSettings.promos,
          referral: data?.referral ? { ...DEFAULT_REFERRAL_SETTINGS, ...data.referral } : DEFAULT_REFERRAL_SETTINGS,
          loyalty: data?.loyalty ? { ...DEFAULT_LOYALTY_SETTINGS, ...data.loyalty } : DEFAULT_LOYALTY_SETTINGS
        };
        setSettings(mergedSettings);
        
        // Auto-migrate legacy plans or missing offer pricing fields if detected
        const hasLegacyPlans = (data.subscriptionPlans?.some((p: any) => [421, 530, 647, 936].includes(p.price) || !p.regular_price || !p.offer_price)) ||
                               data?.pricing?.regular_price_per_kg === undefined ||
                               data?.pricing?.offer_price_per_kg === undefined ||
                               data?.garmentCatalog?.some((g: any) => !g.regular_price || !g.offer_price);
                               
        if (hasLegacyPlans && isSuperAdmin) {
          console.log("Legacy plans, missing offer pricing, or missing garment offer pricing detected, auto-migrating to regular & offer pricing...");
          setDoc(doc(db, 'settings', 'global'), mergedSettings, { merge: true }).catch(err => {
            console.error("Settings auto-migration failed:", err);
          });
        }
      } else {
        // Initialize if not exists
        setSettings(defaultSettings);
        if (isSuperAdmin) {
          setDoc(doc(db, 'settings', 'global'), defaultSettings).catch(err => {
            console.error("Settings initialization failed:", err);
          });
        }
      }
      setLoading(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, 'settings/global');
      setError(err.message);
      setSettings(defaultSettings);
      setLoading(false);
    });

    return () => unsub();
  }, [isSuperAdmin]);

  return (
    <SettingsContext.Provider value={{ settings, loading, error }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};


