import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { onAuthStateChanged, onIdTokenChanged, User as FirebaseUser, sendEmailVerification } from 'firebase/auth';
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
  isStoreAdmin: boolean;
  isStoreManager: boolean;
  isStoreStaff: boolean;
  isDeliveryStaff: boolean;
  isEmailVerified: boolean;
  isPhoneVerified: boolean;
  isAccountVerified: boolean;
  reloadUser: () => Promise<FirebaseUser | null>;
  resendEmailVerification: () => Promise<void>;
  login: (userData: User) => Promise<void>;
  updateUser: (userData: Partial<User>) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const DEVICE_SESSION_KEY = 'washwise_device_auth_session';
export const DEVICE_REMEMBER_FLAG = 'washwise_remember_device';
export const LAST_ACTIVITY_KEY = 'washwise_last_activity';
export const INACTIVITY_TIMEOUT_MS = 14 * 24 * 60 * 60 * 1000; // 14-day inactivity window

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
  const activeSnapshotUnsubRef = useRef<(() => void) | null>(null);

  // Restore user instantly from device memory to eliminate flash of logged-out state
  const [user, setUser] = useState<User | null>(() => {
    if (typeof window !== 'undefined') {
      try {
        const lastActive = localStorage.getItem(LAST_ACTIVITY_KEY);
        if (lastActive && Date.now() - Number(lastActive) > INACTIVITY_TIMEOUT_MS) {
          // Session expired due to inactivity
          localStorage.removeItem(DEVICE_SESSION_KEY);
          localStorage.removeItem(DEVICE_REMEMBER_FLAG);
          localStorage.removeItem(LAST_ACTIVITY_KEY);
          return null;
        }

        const saved = localStorage.getItem(DEVICE_SESSION_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed && parsed.uid) {
            return parsed as User;
          }
        }
      } catch (e) {
        console.warn('Failed to parse device auth memory:', e);
      }
    }
    return null;
  });

  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  
  // If user was already cached in device memory, don't block render with loading spinner
  const [loading, setLoading] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(DEVICE_SESSION_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed && parsed.uid) return false;
        }
      } catch (e) {}
    }
    return true;
  });

  const [isAuthReady, setIsAuthReady] = useState(false);

  // Inactivity tracking: record user activity across common interaction events
  useEffect(() => {
    let lastRecorded = 0;
    const recordActivity = () => {
      const now = Date.now();
      if (now - lastRecorded > 30000) { // Throttle writes to once every 30 seconds
        lastRecorded = now;
        try {
          localStorage.setItem(LAST_ACTIVITY_KEY, now.toString());
        } catch (e) {}
      }
    };

    recordActivity();
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
    events.forEach(evt => window.addEventListener(evt, recordActivity, { passive: true }));

    // Periodic inactivity checker (runs every 10 minutes)
    const inactivityInterval = setInterval(() => {
      try {
        const stored = localStorage.getItem(LAST_ACTIVITY_KEY);
        if (stored && Date.now() - Number(stored) > INACTIVITY_TIMEOUT_MS && auth.currentUser) {
          console.warn('[AuthContext] Session expired due to inactivity. Logging out.');
          logout();
        }
      } catch (e) {}
    }, 10 * 60 * 1000);

    return () => {
      events.forEach(evt => window.removeEventListener(evt, recordActivity));
      clearInterval(inactivityInterval);
    };
  }, []);

  // Background proactive token refresh (every 20 minutes)
  useEffect(() => {
    const tokenRefreshInterval = setInterval(async () => {
      if (auth.currentUser) {
        try {
          await auth.currentUser.getIdToken(false);
          console.log('[AuthContext] Background ID token refreshed smoothly');
        } catch (err) {
          console.warn('[AuthContext] Token refresh notice:', err);
        }
      }
    }, 20 * 60 * 1000);

    return () => clearInterval(tokenRefreshInterval);
  }, []);

  const isSuperAdmin = user?.adminRole === 'super_admin' || isSuperAdminEmail(user?.email);
  const isStoreAdmin = user?.adminRole === 'store_admin';
  const isStoreManager = user?.adminRole === 'store_manager' || isStoreAdmin;
  const isStoreStaff = user?.adminRole === 'store_staff';
  const isDeliveryStaff = user?.adminRole === 'delivery_staff' || user?.adminRole === 'delivery_partner';
  const isAdmin = isSuperAdmin || isStoreAdmin || isStoreManager || isStoreStaff || isDeliveryStaff || user?.role === 'admin' || !!user?.adminRole;

  useEffect(() => {
    // Listen for both auth state and ID token refresh changes
    const idTokenUnsubscribe = onIdTokenChanged(auth, async (fbUser) => {
      setFirebaseUser(fbUser);

      // Clean up previous user snapshot listener
      if (activeSnapshotUnsubRef.current) {
        activeSnapshotUnsubRef.current();
        activeSnapshotUnsubRef.current = null;
      }

      if (fbUser) {
        activeSnapshotUnsubRef.current = onSnapshot(doc(db, 'users', fbUser.uid), async (docSnap) => {
          if (docSnap.exists()) {
            const userData = docSnap.data() as User;
            if (userData.isSuspended) {
              await logout();
              alert('Your account has been suspended. Please contact support.');
              return;
            } else {
              // If adminRole is not in user doc, check admin_roles (email-based)
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

              // Store persistent device memory so user stays logged in across sessions
              try {
                localStorage.setItem(DEVICE_SESSION_KEY, JSON.stringify(userData));
                localStorage.setItem(DEVICE_REMEMBER_FLAG, 'true');
                localStorage.setItem(LAST_ACTIVITY_KEY, Date.now().toString());
              } catch (e) {
                console.warn('Could not save device session:', e);
              }

              setUser(userData);
            }
          } else {
            // User record does not exist yet in Firestore
            const saved = localStorage.getItem(DEVICE_SESSION_KEY);
            if (!saved) {
              setUser(null);
            }
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
        // Firebase Auth reported no active user
        localStorage.removeItem(DEVICE_SESSION_KEY);
        localStorage.removeItem(DEVICE_REMEMBER_FLAG);
        setUser(null);
        setLoading(false);
        setIsAuthReady(true);
      }
    });

    return () => {
      idTokenUnsubscribe();
      if (activeSnapshotUnsubRef.current) {
        activeSnapshotUnsubRef.current();
        activeSnapshotUnsubRef.current = null;
      }
    };
  }, []);

  const login = async (userData: User) => {
    const cleanedUserData = cleanData(userData);
    setUser(cleanedUserData);
    try {
      localStorage.setItem(DEVICE_SESSION_KEY, JSON.stringify(cleanedUserData));
      localStorage.setItem(DEVICE_REMEMBER_FLAG, 'true');
      localStorage.setItem(LAST_ACTIVITY_KEY, Date.now().toString());
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
      localStorage.setItem(DEVICE_SESSION_KEY, JSON.stringify(updatedUser));
      localStorage.setItem(LAST_ACTIVITY_KEY, Date.now().toString());
      await updateDoc(doc(db, 'users', user.uid), cleanedUpdate);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}`);
    }
  };

  const isEmailVerified = Boolean(firebaseUser?.emailVerified || user?.emailVerified);
  const isPhoneVerified = Boolean(user?.phoneVerified);
  const isAccountVerified = isEmailVerified || isPhoneVerified;

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
    try {
      // Unsubscribe active snapshot listener immediately to prevent any post-logout permission errors
      if (activeSnapshotUnsubRef.current) {
        activeSnapshotUnsubRef.current();
        activeSnapshotUnsubRef.current = null;
      }
      localStorage.removeItem(DEVICE_SESSION_KEY);
      localStorage.removeItem(DEVICE_REMEMBER_FLAG);
      localStorage.removeItem('washwise_remembered_email');
      localStorage.removeItem(LAST_ACTIVITY_KEY);
      localStorage.removeItem('washwise_auth_lockout_until');
      localStorage.removeItem('washwise_failed_login_attempts');
      sessionStorage.clear();
      await auth.signOut();
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      setUser(null);
      setFirebaseUser(null);
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      firebaseUser, 
      loading, 
      isAuthReady, 
      isAdmin, 
      isSuperAdmin, 
      isStoreAdmin, 
      isStoreManager, 
      isStoreStaff, 
      isDeliveryStaff, 
      isEmailVerified,
      isPhoneVerified,
      isAccountVerified,
      reloadUser, 
      resendEmailVerification, 
      login, 
      updateUser, 
      logout 
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
