import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User as FirebaseUser, sendEmailVerification } from 'firebase/auth';
import { doc, getDoc, onSnapshot, setDoc, updateDoc } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { User } from '../types';
import { isSuperAdminEmail } from '../constants';
import { generateUserReferralCode } from '../utils/referral';

interface AuthContextType {
  user: User | null;
  firebaseUser: FirebaseUser | null;
  loading: boolean;
  isAuthReady: boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  isStoreManager: boolean;
  isStoreStaff: boolean;
  isDeliveryStaff: boolean;
  isEmailVerified: boolean;
  reloadUser: () => Promise<FirebaseUser | null>;
  resendEmailVerification: () => Promise<void>;
  login: (userData: User) => Promise<void>;
  updateUser: (userData: Partial<User>) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const cleanData = (data: any) => {
  const cleaned = { ...data };
  Object.keys(cleaned).forEach(key => {
    if (cleaned[key] === undefined || (key === 'adminRole' && !cleaned[key])) {
      delete cleaned[key];
    }
  });
  return cleaned;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthReady, setIsAuthReady] = useState(false);

  const isSuperAdmin = user?.adminRole === 'super_admin' || isSuperAdminEmail(user?.email);
  const isStoreManager = user?.adminRole === 'store_manager';
  const isStoreStaff = user?.adminRole === 'store_staff';
  const isDeliveryStaff = user?.adminRole === 'delivery_staff';
  const isAdmin = isSuperAdmin || isStoreManager || isStoreStaff || isDeliveryStaff || user?.role === 'admin' || !!user?.adminRole;

  useEffect(() => {
    let userUnsubscribe: (() => void) | null = null;

    const authUnsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      setFirebaseUser(fbUser);
      
      if (userUnsubscribe) {
        userUnsubscribe();
        userUnsubscribe = null;
      }

      if (fbUser) {
        userUnsubscribe = onSnapshot(doc(db, 'users', fbUser.uid), async (docSnap) => {
          if (docSnap.exists()) {
            const userData = docSnap.data() as User;
            if (userData.isSuspended) {
              setUser(null);
              auth.signOut();
              alert('Your account has been suspended. Please contact support.');
            } else {
              // If adminRole is not in user doc, check admin_roles (legacy/email-based)
              if (!userData.adminRole && fbUser.email) {
                try {
                  const adminRoleSnap = await getDoc(doc(db, 'admin_roles', fbUser.email));
                  if (adminRoleSnap.exists()) {
                    userData.adminRole = adminRoleSnap.data().role;
                    userData.role = 'admin';
                  }
                } catch (e) {
                  console.error('Error fetching admin role:', e);
                }
              }
              
              // Hardcoded super admin check
              if (isSuperAdminEmail(fbUser.email)) {
                userData.adminRole = 'super_admin';
                userData.role = 'admin';
              }

              // Ensure subscriber status consistency
              if (userData.userType === 'subscriber' || userData.subscriptionPaid) {
                userData.userType = 'subscriber';
                userData.subscriptionPaid = true;
                const defaultPlanCredits = userData.package === 'super_premium' ? 320 :
                                           userData.package === 'premium' ? 200 :
                                           userData.package === 'standard' ? 160 : 120;
                if (!userData.totalMonthlyCredits) {
                  userData.totalMonthlyCredits = defaultPlanCredits;
                }
                if (userData.laundryCredits === undefined || userData.laundryCredits === null || isNaN(userData.laundryCredits)) {
                  userData.laundryCredits = userData.kilosLeft !== undefined && !isNaN(userData.kilosLeft) ? userData.kilosLeft * 10 : defaultPlanCredits;
                }
                if (userData.kilosLeft === undefined || userData.kilosLeft === null || isNaN(userData.kilosLeft)) {
                  userData.kilosLeft = Math.floor(userData.laundryCredits / 10);
                }
              } else if (userData.laundryCredits !== undefined && userData.laundryCredits !== null && !isNaN(userData.laundryCredits)) {
                if (userData.kilosLeft === undefined || userData.kilosLeft === null || isNaN(userData.kilosLeft)) {
                  userData.kilosLeft = Math.floor(userData.laundryCredits / 10);
                }
              }

              // Ensure user has a referral code for Refer & Earn
              if (!userData.referralCode) {
                const newCode = generateUserReferralCode(userData.name || fbUser.displayName);
                userData.referralCode = newCode;
                updateDoc(doc(db, 'users', fbUser.uid), { referralCode: newCode }).catch(() => {});
              }

              setUser(userData);
            }
          } else {
            setUser(null);
          }
          setLoading(false);
          setIsAuthReady(true);
        }, (error) => {
          console.error('User Snapshot Error:', error);
          handleFirestoreError(error, OperationType.GET, `users/${fbUser.uid}`);
          setLoading(false);
          setIsAuthReady(true);
        });
      } else {
        setUser(null);
        setLoading(false);
        setIsAuthReady(true);
      }
    });

    return () => {
      authUnsubscribe();
      if (userUnsubscribe) userUnsubscribe();
    };
  }, []);

  const login = async (userData: User) => {
    const cleanedUserData = cleanData(userData);
    setUser(cleanedUserData);
    try {
      await setDoc(doc(db, 'users', userData.uid), cleanedUserData, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${userData.uid}`);
    }
  };

  const updateUser = async (userData: Partial<User>) => {
    if (!user) return;
    const cleanedUpdate = cleanData(userData);
    const updatedUser = { ...user, ...cleanedUpdate };
    setUser(updatedUser);
    try {
      await updateDoc(doc(db, 'users', user.uid), cleanedUpdate);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}`);
    }
  };

  const isEmailVerified = Boolean(firebaseUser?.emailVerified);

  const reloadUser = async (): Promise<FirebaseUser | null> => {
    if (auth.currentUser) {
      await auth.currentUser.reload();
      const reloadedUser = auth.currentUser;
      setFirebaseUser(reloadedUser);
      if (reloadedUser?.emailVerified && user && !user.emailVerified) {
        updateUser({ emailVerified: true }).catch(() => {});
      }
      return reloadedUser;
    }
    return null;
  };

  const resendEmailVerification = async () => {
    if (auth.currentUser) {
      await sendEmailVerification(auth.currentUser);
    }
  };

  const logout = async () => {
    await auth.signOut();
    setUser(null);
    setFirebaseUser(null);
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      firebaseUser, 
      loading, 
      isAuthReady, 
      isAdmin, 
      isSuperAdmin, 
      isStoreManager, 
      isStoreStaff,
      isDeliveryStaff,
      isEmailVerified,
      reloadUser,
      resendEmailVerification,
      login, 
      updateUser, 
      logout 
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
