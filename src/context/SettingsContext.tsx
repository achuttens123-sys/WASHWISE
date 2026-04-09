import React, { createContext, useContext, useState, useEffect } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from './AuthContext';

// ... (interfaces stay the same)
interface PricingSettings {
  washFold: number;
  expressWash: number;
  instantBooking: number;
  minCharge: number;
  pricePerKg: number;
  minLoad: number;
}

interface SubscriptionPlan {
  id: string;
  name: string;
  kgLimit: number;
  price: number;
  originalPrice?: number;
  discount: number;
  description?: string;
}

interface GlobalSettings {
  pricing: PricingSettings;
  subscriptionPlans: SubscriptionPlan[];
  discounts: any[];
  promos: any[];
}

interface SettingsContextType {
  settings: GlobalSettings | null;
  loading: boolean;
  error: string | null;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isSuperAdmin, isAuthReady } = useAuth();
  const [settings, setSettings] = useState<GlobalSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const defaultSettings: GlobalSettings = {
      pricing: {
        washFold: 0,
        expressWash: 44,
        instantBooking: 44,
        minCharge: 156,
        pricePerKg: 39,
        minLoad: 5
      },
      subscriptionPlans: [
        { id: 'basic', name: 'Basic', kgLimit: 12, price: 421, originalPrice: 468, discount: 10, description: '12kg Monthly Capacity' },
        { id: 'standard', name: 'Standard', kgLimit: 16, price: 530, originalPrice: 624, discount: 15, description: '16kg Monthly Capacity' },
        { id: 'premium', name: 'Premium', kgLimit: 20, price: 647, originalPrice: 780, discount: 17, description: '20kg Monthly Capacity' },
        { id: 'super_premium', name: 'Super Premium', kgLimit: 32, price: 936, originalPrice: 1248, discount: 25, description: '32kg Monthly Capacity' }
      ],
      discounts: [],
      promos: []
    };

    const unsub = onSnapshot(doc(db, 'settings', 'global'), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data() as GlobalSettings;
        setSettings(data);
        
        // Auto-migrate legacy plans if detected (e.g. if names are PRO/ELITE or count is 3)
        const hasLegacyPlans = data.subscriptionPlans?.some(p => ['PRO', 'ELITE'].includes(p.name.toUpperCase())) || data.subscriptionPlans?.length === 3;
        if (hasLegacyPlans && isSuperAdmin) {
          console.log("Legacy plans detected, auto-migrating...");
          setDoc(doc(db, 'settings', 'global'), defaultSettings).catch(err => {
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
      // Fallback to defaults on error to prevent blocking the app
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
