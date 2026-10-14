import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { 
  Mail, 
  User, 
  ArrowLeft, 
  Loader2, 
  LogIn, 
  Lock, 
  Phone, 
  UserPlus, 
  KeyRound, 
  CheckCircle2, 
  X, 
  Gift, 
  Sparkles,
  RefreshCw,
  AlertCircle,
  ShieldCheck,
  Inbox
} from 'lucide-react';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  sendEmailVerification
} from 'firebase/auth';
import { doc, getDoc, collection, addDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { isSuperAdminEmail } from '../constants';
import { useAuth } from '../context/AuthContext';
import TermsModal from '../components/TermsModal';
import { generateUserReferralCode, validateReferralCode } from '../utils/referral';
import { authFetch } from '../utils/api';

const Login: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, loading: authLoading, isAdmin, login } = useAuth();
  
  // Read mode from URL query string or default to 'login'
  const initialMode = searchParams.get('mode') === 'signup' ? 'signup' : 'login';
  const [mode, setMode] = useState<'login' | 'signup'>(initialMode);
  
  // Remember this device - stays logged in until user explicitly decides to logout
  const [rememberDevice, setRememberDevice] = useState(true);

  // If already authenticated on this device, immediately forward to dashboard
  useEffect(() => {
    if (!authLoading && user) {
      if (isAdmin || user.adminRole || user.role === 'admin') {
        navigate('/admin', { replace: true });
      } else {
        navigate('/dashboard', { replace: true });
      }
    }
  }, [user, authLoading, isAdmin, navigate]);

  // Auth method selection: 'email' | 'google'
  const [authMethod, setAuthMethod] = useState<'email' | 'google'>('google');

  // Form State
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    phone: '',
    fullName: ''
  });

  // Restore remembered email on device if available
  useEffect(() => {
    try {
      const savedEmail = localStorage.getItem('washwise_remembered_email');
      if (savedEmail) {
        setFormData(prev => ({ ...prev, email: savedEmail }));
      }
    } catch (e) {}
  }, []);

  // Prefetch Dashboard in background for instant transition on login
  useEffect(() => {
    const prefetchDashboard = () => {
      import('./Dashboard').catch(() => {});
    };
    if ('requestIdleCallback' in window) {
      (window as any).requestIdleCallback(prefetchDashboard);
    } else {
      setTimeout(prefetchDashboard, 500);
    }
  }, []);

  // Referral code state
  const [referralInput, setReferralInput] = useState(searchParams.get('ref') || '');
  const [referralStatus, setReferralStatus] = useState<{ valid?: boolean; message?: string; referrer?: any } | null>(null);
  const [showReferralField, setShowReferralField] = useState(Boolean(searchParams.get('ref')));

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [honeypotTrap, setHoneypotTrap] = useState('');
  const [showTerms, setShowTerms] = useState(false);
  const [pendingUserData, setPendingUserData] = useState<any>(null);

  // Progressive Lockout State
  const [failedAttempts, setFailedAttempts] = useState<number>(() => {
    try {
      return Number(localStorage.getItem('washwise_failed_login_attempts')) || 0;
    } catch {
      return 0;
    }
  });

  const [lockoutRemaining, setLockoutRemaining] = useState<number>(() => {
    try {
      const until = Number(localStorage.getItem('washwise_auth_lockout_until')) || 0;
      const rem = Math.ceil((until - Date.now()) / 1000);
      return rem > 0 ? rem : 0;
    } catch {
      return 0;
    }
  });

  useEffect(() => {
    if (lockoutRemaining <= 0) return;
    const timer = setInterval(() => {
      setLockoutRemaining((prev) => {
        if (prev <= 1) {
          try {
            localStorage.removeItem('washwise_auth_lockout_until');
          } catch {}
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [lockoutRemaining]);

  // Forgot Password State
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [resetError, setResetError] = useState('');

  // Dual Email & Phone Verification State
  const [showVerificationScreen, setShowVerificationScreen] = useState(false);
  const [verificationChannel, setVerificationChannel] = useState<'email' | 'phone'>('email');
  const [verificationEmail, setVerificationEmail] = useState('');
  const [verificationPendingInfo, setVerificationPendingInfo] = useState<{
    phone: string;
    fullName: string;
  } | null>(null);
  const [verificationChecking, setVerificationChecking] = useState(false);
  const [verificationResending, setVerificationResending] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<{
    type: 'info' | 'success' | 'error';
    message: string;
  } | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Phone OTP Verification specific state
  const [otpPhone, setOtpPhone] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpSending, setOtpSending] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [otpDevHint, setOtpDevHint] = useState('');
  const [otpCooldown, setOtpCooldown] = useState(0);

  // Phone OTP cooldown timer
  useEffect(() => {
    if (otpCooldown <= 0) return;
    const timer = setTimeout(() => {
      setOtpCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearTimeout(timer);
  }, [otpCooldown]);

  // Password requirements calculation
  const passwordCriteria = {
    minLength: formData.password.length >= 8,
    hasUpper: /[A-Z]/.test(formData.password),
    hasLower: /[a-z]/.test(formData.password),
    hasNumber: /[0-9]/.test(formData.password)
  };
  const isPasswordValid = passwordCriteria.minLength && passwordCriteria.hasUpper && passwordCriteria.hasLower && passwordCriteria.hasNumber;

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => {
      setResendCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  // Polling verification status when verification screen is active
  useEffect(() => {
    if (!showVerificationScreen) return;
    const interval = setInterval(async () => {
      if (auth.currentUser) {
        try {
          await auth.currentUser.reload();
          if (auth.currentUser.emailVerified) {
            clearInterval(interval);
            setVerificationStatus({
              type: 'success',
              message: 'Email confirmed! Setting up your account...'
            });
            setTimeout(async () => {
              const userToProcess = auth.currentUser;
              setShowVerificationScreen(false);
              if (userToProcess) {
                await handleAuthSuccess(
                  userToProcess,
                  verificationPendingInfo?.phone,
                  verificationPendingInfo?.fullName
                );
              }
            }, 800);
          }
        } catch (e) {
          console.error('Polling reload error:', e);
        }
      }
    }, 3500);
    return () => clearInterval(interval);
  }, [showVerificationScreen, verificationPendingInfo]);

  const handleCheckVerification = async () => {
    setVerificationChecking(true);
    setVerificationStatus(null);
    try {
      if (!auth.currentUser) {
        setVerificationStatus({
          type: 'error',
          message: 'No active session found. Please sign in with your email and password.'
        });
        return;
      }
      await auth.currentUser.reload();
      if (auth.currentUser.emailVerified) {
        setVerificationStatus({
          type: 'success',
          message: 'Email verified successfully! Setting up your account...'
        });
        setTimeout(async () => {
          const userToProcess = auth.currentUser;
          setShowVerificationScreen(false);
          if (userToProcess) {
            await handleAuthSuccess(
              userToProcess,
              verificationPendingInfo?.phone,
              verificationPendingInfo?.fullName
            );
          }
        }, 800);
      } else {
        setVerificationStatus({
          type: 'error',
          message: 'Your email has not been verified yet. Please open the verification link sent to your inbox, then click this button again.'
        });
      }
    } catch (err: any) {
      console.error('Error checking email verification:', err);
      setVerificationStatus({
        type: 'error',
        message: err.message || 'Failed to check verification status. Please try again.'
      });
    } finally {
      setVerificationChecking(false);
    }
  };

  const handleResendVerification = async () => {
    if (resendCooldown > 0 || verificationResending) return;
    setVerificationResending(true);
    setVerificationStatus(null);
    try {
      if (auth.currentUser) {
        await sendEmailVerification(auth.currentUser);
        setResendCooldown(60);
        setVerificationStatus({
          type: 'info',
          message: `A fresh verification link has been sent to ${verificationEmail}. Please check your inbox and spam folder.`
        });
      } else {
        setVerificationStatus({
          type: 'error',
          message: 'Session not found. Please log in with your credentials.'
        });
      }
    } catch (err: any) {
      console.error('Resend verification error:', err);
      if (err.code === 'auth/too-many-requests') {
        setVerificationStatus({
          type: 'error',
          message: 'Too many requests. Please wait a minute before requesting another verification email.'
        });
        setResendCooldown(60);
      } else {
        setVerificationStatus({
          type: 'error',
          message: err.message || 'Could not resend verification email. Please try again later.'
        });
      }
    } finally {
      setVerificationResending(false);
    }
  };

  const handleCancelVerification = async () => {
    try {
      await auth.signOut();
    } catch (e) {}
    setShowVerificationScreen(false);
    setVerificationStatus(null);
  };

  // Sync mode and referral code from URL search params
  useEffect(() => {
    const queryMode = searchParams.get('mode');
    const refCode = searchParams.get('ref');
    if (refCode) {
      setReferralInput(refCode);
      setShowReferralField(true);
      setMode('signup');
      validateReferralCode(refCode).then(res => {
        setReferralStatus(res.valid ? { valid: true, message: res.message, referrer: res.referrerUser } : { valid: false, message: res.message });
      });
    } else if (queryMode === 'signup' || queryMode === 'login') {
      setMode(queryMode);
    }
  }, [searchParams]);

  const handleValidateReferral = async () => {
    if (!referralInput.trim()) {
      setReferralStatus(null);
      return;
    }
    const res = await validateReferralCode(referralInput.trim());
    setReferralStatus(res.valid ? { valid: true, message: res.message, referrer: res.referrerUser } : { valid: false, message: res.message });
  };

  /**
   * System Automatic Detection & Routing
   * Checks if user already exists in Firestore users collection or admin_roles.
   */
  const handleAuthSuccess = async (fbUser: any, customPhone?: string, customName?: string) => {
    try {
      const userDoc = await getDoc(doc(db, 'users', fbUser.uid));
      
      // Check for admin role by email or phone
      const emailOrPhone = fbUser.email || fbUser.phoneNumber || customPhone || '';
      const adminRoleDoc = await getDoc(doc(db, 'admin_roles', emailOrPhone));
      const adminRoleData = adminRoleDoc.exists() ? adminRoleDoc.data() : null;
      const isAdminEmail = isSuperAdminEmail(fbUser.email);

      if (userDoc.exists()) {
        const existingData = userDoc.data();
        
        if (existingData.isSuspended) {
          setError('Your account has been suspended. Please contact support.');
          setLoading(false);
          return;
        }
        
        // Preserve or update role automatically
        const determinedAdminRole = adminRoleData?.role || (isAdminEmail ? 'super_admin' : (existingData.adminRole || undefined));
        const updatedData: any = {
          ...existingData,
          role: (isAdminEmail || adminRoleData) ? 'admin' as const : (existingData.role || 'user'),
          userType: (isAdminEmail || adminRoleData) ? 'admin' as const : (existingData.userType || 'guest')
        };
        if (fbUser.emailVerified) {
          updatedData.emailVerified = true;
        }
        if (determinedAdminRole) {
          updatedData.adminRole = determinedAdminRole;
        } else {
          delete updatedData.adminRole;
        }
        
        // Store device memory so user stays logged in across sessions on this device
        try {
          if (rememberDevice) {
            localStorage.setItem('washwise_remember_device', 'true');
            if (fbUser.email || formData.email) {
              localStorage.setItem('washwise_remembered_email', fbUser.email || formData.email);
            }
          }
        } catch (e) {}

        await login(updatedData as any);
        if (updatedData.adminRole || updatedData.role === 'admin') {
          navigate('/admin');
        } else {
          navigate('/dashboard');
        }
      } else {
        // New User Automatic Setup
        const deviceId = localStorage.getItem('deviceId') || `dev-${Math.random().toString(36).substring(2, 15)}`;
        localStorage.setItem('deviceId', deviceId);
        
        let ipAddress = 'unknown';
        try {
          const ipRes = await fetch('https://api.ipify.org?format=json');
          const ipData = await ipRes.json();
          ipAddress = ipData.ip;
        } catch (e) {
          console.error('Failed to fetch IP:', e);
        }

        const assignedAdminRole = adminRoleData?.role || (isAdminEmail ? 'super_admin' : undefined);
        const newUserData: any = {
          uid: fbUser.uid,
          name: fbUser.displayName || formData.fullName || customName || 'WashWise User',
          email: fbUser.email || formData.email || '',
          phone: fbUser.phoneNumber || formData.phone || customPhone || '',
          userType: assignedAdminRole ? ('admin' as const) : ('guest' as const),
          role: assignedAdminRole ? ('admin' as const) : ('user' as const),
          isRegistered: true,
          emailVerified: Boolean(fbUser.emailVerified),
          createdAt: new Date().toISOString(),
          termsAccepted: false,
          deviceId,
          ipAddress
        };
        if (assignedAdminRole) {
          newUserData.adminRole = assignedAdminRole;
        }

        setPendingUserData(newUserData);
        setShowTerms(true);
      }
    } catch (err: any) {
      console.error('Auth Processing Error:', err);
      setError(err.message || 'Error completing login. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const finalizeRegistration = async () => {
    if (!pendingUserData) return;
    setLoading(true);
    try {
      const finalData = { 
        ...pendingUserData, 
        termsAccepted: true,
        emailVerified: Boolean(auth.currentUser?.emailVerified ?? pendingUserData.emailVerified)
      };
      
      // Auto-assign referralCode for the new user
      if (!finalData.referralCode) {
        finalData.referralCode = generateUserReferralCode(finalData.name);
      }

      // Check if user entered a referral code during signup
      const trimmedRef = referralInput.trim().toUpperCase();
      
      // Store device memory so new user stays logged in across sessions on this device
      try {
        if (rememberDevice) {
          localStorage.setItem('washwise_remember_device', 'true');
          if (finalData.email) {
            localStorage.setItem('washwise_remembered_email', finalData.email);
          }
        }
      } catch (e) {}

      // Save user profile first
      await login(finalData);

      // If user entered a referral code, securely apply welcome bonus via server
      if (trimmedRef) {
        try {
          const refRes = await authFetch('/api/referrals/apply-signup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ referralCode: trimmedRef })
          });
          const refData = await refRes.json();
          if (refRes.ok && refData.success) {
            console.log('Referral bonus successfully granted by server');
          } else {
            console.warn('Referral bonus notice:', refData.error);
          }
        } catch (refErr) {
          console.error('Error applying referral code via server:', refErr);
        }
      }
      
      setShowTerms(false);
      if (finalData.adminRole || finalData.role === 'admin') {
        navigate('/admin');
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      setError('Registration failed. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Google Login
  const handleGoogleLogin = async () => {
    if (loading) return;
    setLoading(true);
    setError('');
    
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const userCredential = await signInWithPopup(auth, provider);
      await handleAuthSuccess(userCredential.user);
    } catch (err: any) {
      if (err.code === 'auth/popup-blocked') {
        setError('Popup blocked! Please allow popups for this site.');
      } else if (err.code === 'auth/popup-closed-by-user') {
        setLoading(false);
        return;
      } else {
        setError('Google login failed. Please try again.');
      }
      console.error('Google Login Error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Send Phone OTP for Student Verification
  const handleSendPhoneOtp = async () => {
    if (otpCooldown > 0 || otpSending) return;
    const phoneToVerify = (otpPhone || formData.phone || verificationPendingInfo?.phone || '').trim();
    const digitsOnly = phoneToVerify.replace(/[^0-9]/g, '');
    if (!phoneToVerify || digitsOnly.length < 10) {
      setVerificationStatus({
        type: 'error',
        message: 'Please provide a valid 10-digit mobile phone number.'
      });
      return;
    }

    setOtpSending(true);
    setVerificationStatus(null);
    try {
      const res = await fetch('/api/auth/send-phone-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: phoneToVerify,
          _hp_trap: honeypotTrap
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setOtpSent(true);
        setOtpCooldown(60);
        if (data.devOtp) {
          setOtpDevHint(data.devOtp);
        }
        setVerificationStatus({
          type: 'info',
          message: `Verification code sent to ${phoneToVerify}.`
        });
      } else {
        setVerificationStatus({
          type: 'error',
          message: data.error || 'Failed to dispatch verification code. Please try again.'
        });
      }
    } catch (e: any) {
      setVerificationStatus({
        type: 'error',
        message: 'Network error while requesting verification code. Please try again.'
      });
    } finally {
      setOtpSending(false);
    }
  };

  // Verify Phone OTP
  const handleVerifyPhoneOtp = async () => {
    const phoneToVerify = (otpPhone || formData.phone || verificationPendingInfo?.phone || '').trim();
    const cleanOtp = otpCode.trim();
    if (!cleanOtp || cleanOtp.length !== 6) {
      setVerificationStatus({
        type: 'error',
        message: 'Please enter the complete 6-digit verification code.'
      });
      return;
    }

    setOtpVerifying(true);
    setVerificationStatus(null);
    try {
      const res = await fetch('/api/auth/verify-phone-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: phoneToVerify,
          otp: cleanOtp,
          uid: auth.currentUser?.uid,
          _hp_trap: honeypotTrap
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setVerificationStatus({
          type: 'success',
          message: 'Phone verified successfully! Finalizing your account...'
        });
        setTimeout(async () => {
          const userToProcess = auth.currentUser;
          setShowVerificationScreen(false);
          if (userToProcess) {
            await handleAuthSuccess(
              userToProcess,
              phoneToVerify,
              verificationPendingInfo?.fullName
            );
          }
        }, 800);
      } else {
        setVerificationStatus({
          type: 'error',
          message: data.error || 'Invalid verification code. Please check and try again.'
        });
      }
    } catch (e) {
      setVerificationStatus({
        type: 'error',
        message: 'Network error validating code. Please try again.'
      });
    } finally {
      setOtpVerifying(false);
    }
  };

  // Email Login & Signup with Anti-Enumeration & Progressive Lockout
  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (honeypotTrap) {
      setError('Suspicious automated activity detected.');
      return;
    }

    if (lockoutRemaining > 0) {
      setError(`Login is temporarily locked for security. Please wait ${lockoutRemaining} seconds.`);
      return;
    }

    setLoading(true);
    setError('');

    try {
      if (mode === 'signup') {
        if (!formData.fullName.trim()) {
          setError('Please enter your full name.');
          setLoading(false);
          return;
        }
        if (!formData.phone.trim() || formData.phone.replace(/[^0-9]/g, '').length < 10) {
          setError('Please enter a valid 10-digit phone number.');
          setLoading(false);
          return;
        }

        // Strict Password Requirements Check
        if (!isPasswordValid) {
          setError('Password does not meet security requirements: Minimum 8 characters, with uppercase, lowercase, and a number.');
          setLoading(false);
          return;
        }

        const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
        
        // Dispatch email verification link
        try {
          await sendEmailVerification(userCredential.user);
        } catch (sendErr) {
          console.error('Initial sendEmailVerification error:', sendErr);
        }

        // Present email & phone verification screen to user
        setVerificationEmail(formData.email);
        setVerificationPendingInfo({ phone: formData.phone, fullName: formData.fullName });
        setOtpPhone(formData.phone);
        setShowVerificationScreen(true);
        setResendCooldown(60);
        setVerificationStatus({
          type: 'info',
          message: `A verification link has been sent to ${formData.email}. You can also verify via phone OTP below.`
        });
        setLoading(false);
        return;
      } else {
        const userCredential = await signInWithEmailAndPassword(auth, formData.email, formData.password);
        
        // Reset failed attempt counters upon successful sign-in
        try {
          localStorage.removeItem('washwise_failed_login_attempts');
          localStorage.removeItem('washwise_auth_lockout_until');
        } catch {}
        setFailedAttempts(0);
        setLockoutRemaining(0);

        // Enforce verification on email/password sign-in
        if (!userCredential.user.emailVerified) {
          // Check if user has phoneVerified recorded in Firestore
          let isPhoneVerifiedInDb = false;
          try {
            const userSnap = await getDoc(doc(db, 'users', userCredential.user.uid));
            if (userSnap.exists() && userSnap.data()?.phoneVerified) {
              isPhoneVerifiedInDb = true;
            }
          } catch (e) {}

          if (!isPhoneVerifiedInDb) {
            setVerificationEmail(formData.email);
            setVerificationPendingInfo({ phone: formData.phone || '', fullName: '' });
            setOtpPhone(formData.phone || '');
            setShowVerificationScreen(true);
            setResendCooldown(30);
            setVerificationStatus({
              type: 'info',
              message: 'Your account is not verified yet. Confirm via email link or phone OTP below.'
            });
            try {
              await sendEmailVerification(userCredential.user);
            } catch (sendErr) {}
            setLoading(false);
            return;
          }
        }

        await handleAuthSuccess(userCredential.user);
      }
    } catch (err: any) {
      console.warn('Auth Error:', err.code);

      if (mode === 'signup') {
        if (err.code === 'auth/email-already-in-use') {
          setError('An account with this email already exists. Please log in.');
        } else if (err.code === 'auth/weak-password') {
          setError('Password is too weak. Please choose a stronger password.');
        } else {
          setError('Failed to create account. Please verify your details and try again.');
        }
      } else {
        // Increment failed attempt counter and evaluate progressive lockout
        const nextFailed = failedAttempts + 1;
        setFailedAttempts(nextFailed);
        try {
          localStorage.setItem('washwise_failed_login_attempts', nextFailed.toString());
        } catch {}

        if (nextFailed >= 5) {
          const lockUntil = Date.now() + 60 * 1000;
          try {
            localStorage.setItem('washwise_auth_lockout_until', lockUntil.toString());
          } catch {}
          setLockoutRemaining(60);
          setError('Too many failed attempts. Login is locked for 60 seconds for security.');
        } else {
          // Anti-enumeration: Generic response for credential or user errors
          const remaining = 5 - nextFailed;
          setError(`Invalid email or password. Please verify your credentials and try again. (${remaining} attempt${remaining === 1 ? '' : 's'} remaining before lockout)`);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  // Secure Password Reset Handler with Anti-Enumeration & Bot Defense
  const handleSendPasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (honeypotTrap) {
      setResetSuccess(true);
      return;
    }
    const emailToReset = resetEmail.trim();
    if (!emailToReset || !emailToReset.includes('@')) {
      setResetError('Please enter a valid email address.');
      return;
    }
    setResetLoading(true);
    setResetError('');
    setResetSuccess(false);

    try {
      // Dispatch via server API with honeypot and rate limiting
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: emailToReset,
          _hp_trap: honeypotTrap
        })
      });

      if (!res.ok) {
        // Fallback to client SDK
        try {
          await sendPasswordResetEmail(auth, emailToReset);
        } catch (clientErr: any) {
          // Anti-enumeration: Never disclose auth/user-not-found
          if (clientErr.code !== 'auth/user-not-found' && clientErr.code !== 'auth/invalid-email') {
            console.warn('Password reset client notice:', clientErr.message);
          }
        }
      }
      
      // Anti-enumeration guarantee: ALWAYS show standard generic success confirmation
      setResetSuccess(true);
    } catch (err: any) {
      console.warn('Password reset process notice:', err);
      // Still display generic success
      setResetSuccess(true);
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto px-3.5 sm:px-4 py-2 sm:py-6 my-auto flex flex-col justify-center">
      <button 
        onClick={() => navigate('/')}
        className="inline-flex items-center text-gray-500 hover:text-primary-electric mb-2.5 sm:mb-4 transition-colors text-xs sm:text-sm font-bold uppercase tracking-wider self-start"
      >
        <ArrowLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2" />
        Back to Home
      </button>

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white dark:bg-surface-container p-4 sm:p-10 rounded-2xl sm:rounded-3xl border border-gray-100 dark:border-gray-800 shadow-xl shadow-black/5 dark:shadow-none relative overflow-hidden"
      >
        {/* Account Deletion Notice */}
        {searchParams.get('deleted') === 'true' && (
          <div className="p-4 bg-green-500/10 border border-green-500/30 text-green-600 dark:text-green-400 text-xs font-bold rounded-2xl mb-6 text-center flex items-center justify-center gap-2">
            <span>Your account has been permanently deleted.</span>
          </div>
        )}

        {/* Dual Email & Phone OTP Verification Screen */}
        {showVerificationScreen ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-5"
          >
            {/* Channel Switcher Tabs */}
            <div className="flex bg-gray-100 dark:bg-surface-low p-1.5 rounded-2xl">
              <button
                type="button"
                onClick={() => { setVerificationChannel('email'); setVerificationStatus(null); }}
                className={`flex-1 py-2 text-xs font-black uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                  verificationChannel === 'email'
                    ? 'bg-white dark:bg-surface-highest text-primary-electric shadow-sm'
                    : 'text-gray-400 dark:text-gray-500 hover:text-gray-700'
                }`}
              >
                <Mail className="w-3.5 h-3.5" />
                <span>Email Link</span>
              </button>
              <button
                type="button"
                onClick={() => { setVerificationChannel('phone'); setVerificationStatus(null); }}
                className={`flex-1 py-2 text-xs font-black uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                  verificationChannel === 'phone'
                    ? 'bg-white dark:bg-surface-highest text-primary-electric shadow-sm'
                    : 'text-gray-400 dark:text-gray-500 hover:text-gray-700'
                }`}
              >
                <Phone className="w-3.5 h-3.5" />
                <span>Phone OTP</span>
              </button>
            </div>

            {verificationChannel === 'email' ? (
              <div className="space-y-5">
                <div className="text-center">
                  <div className="w-14 h-14 mx-auto rounded-2xl bg-primary-electric/10 dark:bg-primary-electric/20 text-primary-electric flex items-center justify-center mb-3 relative">
                    <Mail className="w-7 h-7" />
                    <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-amber-500 rounded-full border-2 border-white dark:border-surface-container animate-pulse" />
                  </div>
                  <h2 className="text-xl font-display font-black text-gray-800 dark:text-high-contrast uppercase tracking-tight">
                    Verify Your Email
                  </h2>
                  <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1 font-bold uppercase tracking-widest">
                    Confirmation link sent to
                  </p>
                  <div className="mt-2.5 p-2.5 bg-gray-50 dark:bg-surface-low rounded-xl border border-gray-200 dark:border-gray-800 text-center font-mono font-bold text-xs text-primary-electric dark:text-primary-electric-light break-all select-all">
                    {verificationEmail}
                  </div>
                </div>

                {/* Instruction card */}
                <div className="bg-blue-50/70 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/40 rounded-2xl p-3.5 text-xs space-y-2 text-gray-600 dark:text-gray-300">
                  <div className="flex items-start gap-2">
                    <span className="w-4 h-4 rounded-full bg-primary-electric/10 text-primary-electric font-black flex items-center justify-center shrink-0 text-[10px]">
                      1
                    </span>
                    <span>Open the confirmation email in your inbox or spam folder.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="w-4 h-4 rounded-full bg-primary-electric/10 text-primary-electric font-black flex items-center justify-center shrink-0 text-[10px]">
                      2
                    </span>
                    <span>Click the link inside to verify your student email.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="w-4 h-4 rounded-full bg-primary-electric/10 text-primary-electric font-black flex items-center justify-center shrink-0 text-[10px]">
                      3
                    </span>
                    <span>Return and click below (or wait for auto-detection).</span>
                  </div>
                </div>

                {/* Status Feedback Message */}
                {verificationStatus && (
                  <motion.div
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 border ${
                      verificationStatus.type === 'success'
                        ? 'bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-900/40'
                        : verificationStatus.type === 'error'
                        ? 'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 border-red-200 dark:border-red-900/40'
                        : 'bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-900/40'
                    }`}
                  >
                    {verificationStatus.type === 'success' ? (
                      <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                    ) : verificationStatus.type === 'error' ? (
                      <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                    ) : (
                      <Mail className="w-4 h-4 text-amber-600 shrink-0" />
                    )}
                    <span>{verificationStatus.message}</span>
                  </motion.div>
                )}

                {/* Action Buttons */}
                <div className="space-y-2.5 pt-1">
                  <button
                    type="button"
                    onClick={handleCheckVerification}
                    disabled={verificationChecking}
                    className="w-full py-3.5 bg-primary-electric hover:bg-primary-electric/90 text-white font-black uppercase tracking-wider text-xs rounded-2xl shadow-xl shadow-primary-electric/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {verificationChecking ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Checking Status...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>I've Verified My Email</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handleResendVerification}
                    disabled={resendCooldown > 0 || verificationResending}
                    className={`w-full py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 border ${
                      resendCooldown > 0 || verificationResending
                        ? 'bg-gray-50 dark:bg-surface-low border-gray-200 dark:border-gray-800 text-gray-400 cursor-not-allowed'
                        : 'bg-white dark:bg-surface-highest border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    {verificationResending ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Resending...</span>
                      </>
                    ) : (
                      <>
                        <RefreshCw className={`w-3.5 h-3.5 ${resendCooldown > 0 ? '' : 'text-primary-electric'}`} />
                        <span>{resendCooldown > 0 ? `Resend Link in ${resendCooldown}s` : 'Resend Verification Link'}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              /* Phone OTP Channel */
              <div className="space-y-5">
                <div className="text-center">
                  <div className="w-14 h-14 mx-auto rounded-2xl bg-primary-electric/10 dark:bg-primary-electric/20 text-primary-electric flex items-center justify-center mb-3">
                    <Phone className="w-7 h-7" />
                  </div>
                  <h2 className="text-xl font-display font-black text-gray-800 dark:text-high-contrast uppercase tracking-tight">
                    Verify via Phone OTP
                  </h2>
                  <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1 font-bold uppercase tracking-widest">
                    Quick mobile confirmation for students
                  </p>
                </div>

                <div className="space-y-3.5">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">
                      Mobile Number
                    </label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          type="tel"
                          value={otpPhone}
                          onChange={(e) => setOtpPhone(e.target.value)}
                          placeholder="+91 98765 43210"
                          className="w-full pl-11 pr-3 py-3 bg-gray-50 dark:bg-surface-low rounded-xl border border-gray-200 dark:border-gray-800 outline-none font-bold text-xs sm:text-sm text-gray-800 dark:text-white"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handleSendPhoneOtp}
                        disabled={otpCooldown > 0 || otpSending}
                        className="px-4 py-3 bg-primary-electric hover:bg-primary-electric/90 text-white rounded-xl text-xs font-black uppercase tracking-wider disabled:opacity-50 transition-all flex items-center gap-1.5 shrink-0"
                      >
                        {otpSending ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : otpCooldown > 0 ? (
                          `${otpCooldown}s`
                        ) : otpSent ? (
                          'Resend'
                        ) : (
                          'Send Code'
                        )}
                      </button>
                    </div>
                  </div>

                  {otpDevHint && (
                    <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-700 dark:text-emerald-300 text-xs flex items-center justify-between font-mono">
                      <span>SMS Demo Code: <strong>{otpDevHint}</strong></span>
                      <button
                        type="button"
                        onClick={() => setOtpCode(otpDevHint)}
                        className="text-[10px] uppercase font-bold underline ml-2"
                      >
                        Auto-fill
                      </button>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">
                      6-Digit SMS Verification Code
                    </label>
                    <input
                      type="text"
                      maxLength={6}
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/[^0-9]/g, ''))}
                      placeholder="• • • • • •"
                      className="w-full text-center tracking-[0.4em] font-mono font-black text-xl py-3.5 bg-gray-50 dark:bg-surface-low rounded-xl border border-gray-200 dark:border-gray-800 outline-none focus:bg-white dark:focus:bg-surface-highest transition-all text-gray-800 dark:text-white"
                    />
                  </div>

                  {/* Status Feedback Message */}
                  {verificationStatus && (
                    <motion.div
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 border ${
                        verificationStatus.type === 'success'
                          ? 'bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-900/40'
                          : verificationStatus.type === 'error'
                          ? 'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 border-red-200 dark:border-red-900/40'
                          : 'bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-900/40'
                      }`}
                    >
                      {verificationStatus.type === 'success' ? (
                        <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                      ) : verificationStatus.type === 'error' ? (
                        <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                      ) : (
                        <Phone className="w-4 h-4 text-amber-600 shrink-0" />
                      )}
                      <span>{verificationStatus.message}</span>
                    </motion.div>
                  )}

                  <button
                    type="button"
                    onClick={handleVerifyPhoneOtp}
                    disabled={otpVerifying || otpCode.length !== 6}
                    className="w-full py-4 bg-primary-electric hover:bg-primary-electric/90 text-white font-black uppercase tracking-wider text-xs rounded-2xl shadow-xl shadow-primary-electric/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {otpVerifying ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Validating Code...</span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-4 h-4" />
                        <span>Verify Phone & Complete</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={handleCancelVerification}
              className="w-full text-center py-2 text-xs font-bold text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 uppercase tracking-widest transition-colors"
            >
              ← Back to Login / Edit Email
            </button>
          </motion.div>
        ) : (
          <>
            {/* Mode Switcher: Log In vs Sign Up */}
            <div className="flex bg-gray-100 dark:bg-surface-low p-1 sm:p-1.5 rounded-xl sm:rounded-2xl mb-5 sm:mb-8">
          <button
            type="button"
            onClick={() => { setMode('login'); setError(''); }}
            className={`flex-1 py-2 sm:py-3 text-[11px] sm:text-xs font-black uppercase tracking-wider sm:tracking-widest rounded-lg sm:rounded-xl transition-all flex items-center justify-center gap-1.5 sm:gap-2 ${
              mode === 'login' 
                ? 'bg-white dark:bg-surface-highest text-primary-electric dark:text-primary-electric-light shadow-xs sm:shadow-md' 
                : 'text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <LogIn className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span>Log In</span>
          </button>
          <button
            type="button"
            onClick={() => { setMode('signup'); setError(''); }}
            className={`flex-1 py-2 sm:py-3 text-[11px] sm:text-xs font-black uppercase tracking-wider sm:tracking-widest rounded-lg sm:rounded-xl transition-all flex items-center justify-center gap-1.5 sm:gap-2 ${
              mode === 'signup' 
                ? 'bg-white dark:bg-surface-highest text-primary-electric dark:text-primary-electric-light shadow-xs sm:shadow-md' 
                : 'text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span>Sign Up</span>
          </button>
        </div>

        <div className="text-center mb-5 sm:mb-8">
          <h2 className="text-2xl sm:text-3xl font-display font-black text-gray-800 dark:text-high-contrast uppercase tracking-tight">
            {mode === 'login' ? 'Welcome Back' : 'Create Account'}
          </h2>
          <p className="text-[11px] sm:text-xs text-gray-400 dark:text-gray-500 mt-1 sm:mt-2 font-bold uppercase tracking-wider sm:tracking-widest">
            {mode === 'login' ? 'Sign in to access WashWise services' : 'Sign up to get started with WashWise'}
          </p>
        </div>

        {/* Auth Method Selector (Email | Google) */}
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-2 bg-gray-50 dark:bg-surface-low p-1.5 rounded-2xl">
            <button
              type="button"
              onClick={() => { setAuthMethod('google'); setError(''); }}
              className={`py-2.5 text-[11px] font-black uppercase tracking-wider rounded-xl transition-all ${
                authMethod === 'google' 
                  ? 'bg-white dark:bg-surface-highest text-primary-electric dark:text-primary-electric-light shadow-sm' 
                  : 'text-gray-400 dark:text-gray-500 hover:text-gray-600'
              }`}
            >
              Google
            </button>
            <button
              type="button"
              onClick={() => { setAuthMethod('email'); setError(''); }}
              className={`py-2.5 text-[11px] font-black uppercase tracking-wider rounded-xl transition-all ${
                authMethod === 'email' 
                  ? 'bg-white dark:bg-surface-highest text-primary-electric dark:text-primary-electric-light shadow-sm' 
                  : 'text-gray-400 dark:text-gray-500 hover:text-gray-600'
              }`}
            >
              Email & Phone
            </button>
          </div>

          {error && (
            <motion.p 
              initial={{ opacity: 0, y: -5 }} 
              animate={{ opacity: 1, y: 0 }}
              className="text-red-500 text-xs text-center font-bold uppercase tracking-widest bg-red-50 dark:bg-red-900/10 p-4 rounded-2xl border border-red-100 dark:border-red-900/30"
            >
              {error}
            </motion.p>
          )}

          {/* 1. EMAIL & PHONE AUTH METHOD */}
          {authMethod === 'email' && (
            <motion.form 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              onSubmit={handleEmailAuth} 
              className="space-y-5"
            >
              {/* Bot trap honeypot field */}
              <input
                type="text"
                name="_hp_trap"
                value={honeypotTrap}
                onChange={(e) => setHoneypotTrap(e.target.value)}
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
                className="opacity-0 absolute pointer-events-none -z-50 h-0 w-0 p-0 m-0 border-0"
              />

              {mode === 'signup' && (
                <div className="space-y-2">
                  <label className="text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Full Name</label>
                  <div className="relative">
                    <User className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
                    <input
                      type="text"
                      required
                      value={formData.fullName}
                      onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                      placeholder="e.g. Rahul Sharma"
                      className="w-full pl-13 pr-5 py-4 bg-gray-50 dark:bg-surface-low rounded-2xl focus:bg-white dark:focus:bg-surface-highest border border-gray-200 dark:border-gray-800 outline-none transition-all dark:text-high-contrast font-bold text-sm"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="name@example.com"
                    className="w-full pl-13 pr-5 py-4 bg-gray-50 dark:bg-surface-low rounded-2xl focus:bg-white dark:focus:bg-surface-highest border border-gray-200 dark:border-gray-800 outline-none transition-all dark:text-high-contrast font-bold text-sm"
                  />
                </div>
              </div>

              {mode === 'signup' && (
                <div className="space-y-2">
                  <label className="text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Phone Number</label>
                  <div className="relative">
                    <Phone className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
                    <input
                      type="tel"
                      required
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="+91 98765 43210"
                      className="w-full pl-13 pr-5 py-4 bg-gray-50 dark:bg-surface-low rounded-2xl focus:bg-white dark:focus:bg-surface-highest border border-gray-200 dark:border-gray-800 outline-none transition-all dark:text-high-contrast font-bold text-sm"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <div className="flex justify-between items-center ml-1">
                  <label className="text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">Password</label>
                  {mode === 'login' && (
                    <button
                      type="button"
                      onClick={() => {
                        setResetEmail(formData.email);
                        setResetSuccess(false);
                        setResetError('');
                        setShowForgotPassword(true);
                      }}
                      className="text-xs font-bold text-primary-electric hover:underline focus:outline-none"
                    >
                      Forgot Password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
                  <input
                    type="password"
                    required
                    disabled={mode === 'login' && lockoutRemaining > 0}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="••••••••"
                    className="w-full pl-13 pr-5 py-4 bg-gray-50 dark:bg-surface-low rounded-2xl focus:bg-white dark:focus:bg-surface-highest border border-gray-200 dark:border-gray-800 outline-none transition-all dark:text-high-contrast font-bold text-sm disabled:opacity-50"
                  />
                </div>

                {/* Password Criteria Checklist during signup */}
                {mode === 'signup' && formData.password.length > 0 && (
                  <div className="p-3 bg-gray-50 dark:bg-surface-low rounded-2xl border border-gray-200 dark:border-gray-800 space-y-1.5 text-[11px]">
                    <div className="flex items-center gap-1.5">
                      {passwordCriteria.minLength ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      ) : (
                        <span className="w-3.5 h-3.5 rounded-full border border-gray-300 dark:border-gray-600 shrink-0 inline-block" />
                      )}
                      <span className={passwordCriteria.minLength ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-gray-400'}>
                        At least 8 characters
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {passwordCriteria.hasUpper ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      ) : (
                        <span className="w-3.5 h-3.5 rounded-full border border-gray-300 dark:border-gray-600 shrink-0 inline-block" />
                      )}
                      <span className={passwordCriteria.hasUpper ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-gray-400'}>
                        At least 1 uppercase letter (A-Z)
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {passwordCriteria.hasLower ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      ) : (
                        <span className="w-3.5 h-3.5 rounded-full border border-gray-300 dark:border-gray-600 shrink-0 inline-block" />
                      )}
                      <span className={passwordCriteria.hasLower ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-gray-400'}>
                        At least 1 lowercase letter (a-z)
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {passwordCriteria.hasNumber ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      ) : (
                        <span className="w-3.5 h-3.5 rounded-full border border-gray-300 dark:border-gray-600 shrink-0 inline-block" />
                      )}
                      <span className={passwordCriteria.hasNumber ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-gray-400'}>
                        At least 1 number (0-9)
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Progressive Lockout Banner */}
              {lockoutRemaining > 0 && mode === 'login' && (
                <div className="p-3.5 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40 rounded-2xl flex items-center gap-2.5 text-red-700 dark:text-red-300 text-xs font-bold">
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0 animate-pulse" />
                  <span>
                    Login locked due to repeated failed attempts. Please wait <strong className="font-mono tabular-nums">{lockoutRemaining}s</strong> before trying again.
                  </span>
                </div>
              )}

              {/* Referral Code (Optional for Signup) */}
              {mode === 'signup' && (
                <div className="space-y-2">
                  <div className="flex justify-between items-center ml-1">
                    <label className="text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest flex items-center gap-1.5">
                      <Gift className="w-3.5 h-3.5 text-primary-electric" />
                      Referral Code <span className="text-[10px] font-medium text-gray-400 lowercase">(optional)</span>
                    </label>
                    {!showReferralField && (
                      <button
                        type="button"
                        onClick={() => setShowReferralField(true)}
                        className="text-xs font-bold text-primary-electric hover:underline"
                      >
                        Have a code?
                      </button>
                    )}
                  </div>

                  {showReferralField && (
                    <div className="space-y-1.5">
                      <div className="relative">
                        <Gift className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-primary-electric" />
                        <input
                          type="text"
                          value={referralInput}
                          onChange={(e) => {
                            setReferralInput(e.target.value.toUpperCase());
                            setReferralStatus(null);
                          }}
                          onBlur={handleValidateReferral}
                          placeholder="e.g. WW-RAHUL49"
                          className="w-full pl-13 pr-24 py-4 bg-gray-50 dark:bg-surface-low rounded-2xl focus:bg-white dark:focus:bg-surface-highest border border-gray-200 dark:border-gray-800 outline-none transition-all dark:text-high-contrast font-mono font-bold text-sm tracking-wider uppercase"
                        />
                        <button
                          type="button"
                          onClick={handleValidateReferral}
                          className="absolute right-3 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-primary-electric/10 hover:bg-primary-electric/20 text-primary-electric text-[11px] font-black uppercase tracking-wider rounded-xl transition-all"
                        >
                          Check
                        </button>
                      </div>

                      {referralStatus && (
                        <p className={`text-xs font-bold px-3 py-1.5 rounded-xl flex items-center gap-1.5 ${
                          referralStatus.valid 
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' 
                            : 'bg-red-500/10 text-red-500 border border-red-500/20'
                        }`}>
                          {referralStatus.valid ? <Sparkles className="w-3.5 h-3.5 shrink-0" /> : <X className="w-3.5 h-3.5 shrink-0" />}
                          <span>{referralStatus.message}</span>
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Stay Logged In on this Device Memory Option */}
              <div className="flex items-center justify-between px-1 py-1">
                <label className="flex items-center gap-2.5 cursor-pointer select-none group">
                  <input
                    type="checkbox"
                    checked={rememberDevice}
                    onChange={(e) => setRememberDevice(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500/20 border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 transition-colors"
                  />
                  <span className="text-xs font-bold text-gray-600 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white transition-colors">
                    Stay logged in on this device
                  </span>
                </label>
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                  Until Logout
                </span>
              </div>

              <button
                type="submit"
                disabled={loading || (mode === 'login' && lockoutRemaining > 0)}
                className="w-full py-4.5 bg-gradient-to-br from-primary-electric to-[#3323cc] text-white font-black uppercase tracking-widest text-xs rounded-2xl transition-all shadow-xl shadow-primary-electric/20 dark:shadow-none haptic-feedback flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : mode === 'login' && lockoutRemaining > 0 ? (
                  `Locked (${lockoutRemaining}s)`
                ) : mode === 'signup' ? (
                  'Create Account'
                ) : (
                  'Sign In'
                )}
              </button>
            </motion.form>
          )}

          {/* 2. GOOGLE AUTH METHOD */}
          {authMethod === 'google' && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              {mode === 'signup' && (
                <div className="p-4 bg-primary-electric/5 dark:bg-primary-electric/10 border border-primary-electric/20 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase tracking-wider text-primary-electric flex items-center gap-1.5">
                      <Gift className="w-4 h-4" /> Got a Friend's Referral Code?
                    </span>
                    {!showReferralField && (
                      <button
                        type="button"
                        onClick={() => setShowReferralField(true)}
                        className="text-xs font-bold text-primary-electric underline"
                      >
                        Enter Code
                      </button>
                    )}
                  </div>

                  {showReferralField && (
                    <div className="space-y-2">
                      <div className="relative">
                        <input
                          type="text"
                          value={referralInput}
                          onChange={(e) => {
                            setReferralInput(e.target.value.toUpperCase());
                            setReferralStatus(null);
                          }}
                          onBlur={handleValidateReferral}
                          placeholder="e.g. WW-RAHUL49"
                          className="w-full pl-4 pr-24 py-3 bg-white dark:bg-surface-highest rounded-xl border border-gray-200 dark:border-gray-700 outline-none font-mono font-bold text-xs uppercase"
                        />
                        <button
                          type="button"
                          onClick={handleValidateReferral}
                          className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1 bg-primary-electric text-white text-[10px] font-black uppercase rounded-lg shadow-sm"
                        >
                          Apply
                        </button>
                      </div>

                      {referralStatus && (
                        <p className={`text-xs font-bold px-3 py-1.5 rounded-xl flex items-center gap-1.5 ${
                          referralStatus.valid 
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' 
                            : 'text-red-500'
                        }`}>
                          {referralStatus.valid ? <Sparkles className="w-3.5 h-3.5 shrink-0" /> : <X className="w-3.5 h-3.5 shrink-0" />}
                          <span>{referralStatus.message}</span>
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Stay Logged In on this Device Memory Option */}
              <div className="flex items-center justify-between px-1 py-1">
                <label className="flex items-center gap-2.5 cursor-pointer select-none group">
                  <input
                    type="checkbox"
                    checked={rememberDevice}
                    onChange={(e) => setRememberDevice(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500/20 border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 transition-colors"
                  />
                  <span className="text-xs font-bold text-gray-600 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white transition-colors">
                    Stay logged in on this device
                  </span>
                </label>
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                  Until Logout
                </span>
              </div>

              <button
                onClick={handleGoogleLogin}
                disabled={loading}
                className="w-full py-4 px-6 bg-white dark:bg-surface-highest text-gray-700 dark:text-high-contrast font-black uppercase tracking-wider text-xs sm:text-sm rounded-2xl hover:bg-gray-50 dark:hover:bg-opacity-80 border border-gray-200 dark:border-gray-700 transition-all flex items-center justify-center gap-3 shadow-sm haptic-feedback"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5 shrink-0" alt="Google" />
                    <span className="whitespace-nowrap">
                      {mode === 'login' ? 'Continue with Google' : 'Sign Up with Google'}
                    </span>
                  </>
                )}
              </button>
            </motion.div>
          )}

          <p className="text-[10px] text-center text-gray-400 dark:text-gray-500 px-4 font-bold uppercase tracking-widest leading-relaxed pt-2">
            By logging in, you agree to WashWise <br /> Terms of Service & Privacy Policy.
          </p>
        </div>
        </>
      )}
      </motion.div>

      {/* Forgot Password Modal */}
      {showForgotPassword && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            onClick={() => setShowForgotPassword(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm cursor-pointer"
            aria-label="Close modal overlay"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="bg-white dark:bg-surface-container w-full max-w-md p-6 sm:p-8 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-2xl relative overflow-hidden z-10"
          >
            <button
              onClick={() => setShowForgotPassword(false)}
              className="absolute top-5 right-5 p-2 rounded-xl text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-surface-highest transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-2xl bg-primary-electric/10 text-primary-electric flex items-center justify-center">
                <KeyRound className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-black text-gray-800 dark:text-high-contrast uppercase tracking-tight">
                  Reset Password
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                  We'll send a secure reset link to your email
                </p>
              </div>
            </div>

            {resetSuccess ? (
              <div className="space-y-4 py-2">
                <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-800/40 rounded-2xl flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
                  <div className="text-xs text-emerald-900 dark:text-emerald-200 space-y-1">
                    <p className="font-bold">Password Reset Email Sent!</p>
                    <p className="leading-relaxed">
                      We sent an email to <span className="font-bold underline">{resetEmail}</span>. Check your inbox and spam folder to set your new password.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowForgotPassword(false)}
                  className="w-full py-3.5 bg-primary-electric text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-md hover:bg-primary-electric/90 transition-all"
                >
                  Back to Login
                </button>
              </div>
            ) : (
              <form onSubmit={handleSendPasswordReset} className="space-y-4 pt-2">
                {/* Bot trap honeypot field */}
                <input
                  type="text"
                  name="_hp_trap"
                  value={honeypotTrap}
                  onChange={(e) => setHoneypotTrap(e.target.value)}
                  tabIndex={-1}
                  autoComplete="off"
                  aria-hidden="true"
                  className="opacity-0 absolute pointer-events-none -z-50 h-0 w-0 p-0 m-0 border-0"
                />
                {resetError && (
                  <p className="text-red-500 text-xs font-bold uppercase tracking-widest bg-red-50 dark:bg-red-900/10 p-3.5 rounded-xl border border-red-100 dark:border-red-900/30">
                    {resetError}
                  </p>
                )}

                <div className="space-y-2">
                  <label className="text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">
                    Registered Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
                    <input
                      type="email"
                      required
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      placeholder="name@example.com"
                      className="w-full pl-11 pr-4 py-3.5 bg-gray-50 dark:bg-surface-low rounded-2xl focus:bg-white dark:focus:bg-surface-highest border border-gray-200 dark:border-gray-800 outline-none transition-all dark:text-high-contrast font-bold text-xs sm:text-sm"
                    />
                  </div>
                </div>

                <div className="flex gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowForgotPassword(false)}
                    className="flex-1 py-3.5 bg-gray-100 dark:bg-surface-low text-gray-600 dark:text-gray-300 font-bold text-xs uppercase tracking-wider rounded-xl hover:bg-gray-200 dark:hover:bg-surface-highest transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={resetLoading}
                    className="flex-1 py-3.5 bg-primary-electric text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-md hover:bg-primary-electric/90 transition-all flex items-center justify-center"
                  >
                    {resetLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Send Link'}
                  </button>
                </div>
              </form>
            )}
          </motion.div>
        </div>
      )}

      <TermsModal 
        isOpen={showTerms}
        onClose={() => setShowTerms(false)}
        onAccept={finalizeRegistration}
        mode="disclaimer"
        loading={loading}
      />
    </div>
  );
};

export default Login;

