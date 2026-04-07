import { collection, getDocs, query, where, addDoc, updateDoc, deleteDoc, doc, onSnapshot } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Store } from '../types';

export const DEFAULT_BASE = {
  lat: 9.575086702360185,
  lng: 76.62057146585084,
  name: 'WASHWISE Main Office'
};

export const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c; // Distance in km
  return d;
};

const deg2rad = (deg: number): number => {
  return deg * (Math.PI / 180);
};

export const getDeliveryFee = (distance: number): { fee: number; available: boolean } => {
  if (distance <= 3) {
    return { fee: 0, available: true };
  } else if (distance <= 7) {
    // 4km is 20rs, 5km is 30rs, 6km is 40rs, 7km is 50rs
    // Formula: (Math.ceil(distance) - 3) * 10 + 10
    const fee = (Math.ceil(distance) - 3) * 10 + 10;
    return { fee, available: true };
  } else {
    return { fee: 0, available: false };
  }
};

export const StoreService = {
  async getStores(): Promise<Store[]> {
    const q = query(collection(db, 'stores'), where('active', '==', true));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Store));
  },

  getAllStores(callback: (stores: Store[]) => void) {
    return onSnapshot(collection(db, 'stores'), (snapshot) => {
      const stores = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Store));
      callback(stores);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'stores');
    });
  },

  async addStore(store: Omit<Store, 'id'>) {
    return await addDoc(collection(db, 'stores'), store);
  },

  async updateStore(id: string, store: Partial<Store>) {
    return await updateDoc(doc(db, 'stores', id), store);
  },

  async deleteStore(id: string) {
    return await deleteDoc(doc(db, 'stores', id));
  },

  async getNearestStore(lat: number, lng: number): Promise<{ store: Store; distance: number } | null> {
    const stores = await this.getStores();
    if (stores.length === 0) {
      // Fallback to default if no stores in DB yet
      const distance = calculateDistance(lat, lng, DEFAULT_BASE.lat, DEFAULT_BASE.lng);
      return { 
        store: { ...DEFAULT_BASE, id: 'default', latitude: DEFAULT_BASE.lat, longitude: DEFAULT_BASE.lng, active: true, address: 'Main Office', location: 'Main Office', phone: '', createdAt: new Date().toISOString() }, 
        distance 
      };
    }

    let nearest = null;
    let minDistance = Infinity;

    for (const store of stores) {
      const dist = calculateDistance(lat, lng, store.latitude || 0, store.longitude || 0);
      if (dist < minDistance) {
        minDistance = dist;
        nearest = store;
      }
    }

    return nearest ? { store: nearest, distance: minDistance } : null;
  }
};
