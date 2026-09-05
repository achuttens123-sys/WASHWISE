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

const Login: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { login } = useAuth();
  
  // Read mode from URL query string or default to 'login'
  const initialMode = searchParams.get('mode') === 'signup' ? 'signup' : 'login';
  const [mode, setMode] = useState<'login' | 'signup'>(initialMode);
  
  // Auth method selection: 'email' | 'google'
  const [authMethod, setAuthMethod] = useState<'email' | 'google'>('google');

  // Form State
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    phone: '',
    fullName: ''
  });

  // Referral code state
  const [referralInput, setReferralInput] = useState(searchParams.get('ref') || '');
  const [referralStatus, setReferralStatus] = useState<{ valid?: boolean; message?: string; referrer?: any } | null>(null);
  const [showReferralField, setShowReferralField] = useState(Boolean(searchParams.get('ref')));

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showTerms, setShowTerms] = useState(false);
  const [pendingUserData, setPendingUserData] = useState<any>(null);

  // Forgot Password State
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [resetError, setResetError] = useState('');

  // Email Verification State
  const [showVerificationScreen, setShowVerificationScreen] = useState(false);
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
      if (trimmedRef) {
        try {
          const valRes = await validateReferralCode(trimmedRef, finalData.uid);
          if (valRes.valid && valRes.referrerUser) {
            finalData.referredBy = valRes.referrerUser.uid;
            // Welcome bonus for the referee: 10 laundry credits and ₹50 wallet discount
            finalData.laundryCredits = (finalData.laundryCredits || 0) + 10;
            finalData.walletBalance = (finalData.walletBalance || 0) + 50;

            // Record pending referral document
            await addDoc(collection(db, 'referrals'), {
              referrerId: valRes.referrerUser.uid,
              referrerName: valRes.referrerUser.name,
              referrerEmail: valRes.referrerUser.email || '',
              referralCode: trimmedRef,
              referredUserId: finalData.uid,
              referredUserName: finalData.name,
              referredUserEmail: finalData.email || '',
              status: 'pending',
              rewardCredits: 20,
              rewardWalletCash: 50,
              refereeBonusCredits: 10,
              refereeDiscountRupees: 50,
              createdAt: new Date().toISOString()
            });

            // Notify referrer
            await addDoc(collection(db, 'notifications'), {
              userId: valRes.referrerUser.uid,
              title: "🎉 Friend Joined with your Code!",
              message: `${finalData.name} signed up with your referral code. You'll receive 20 Laundry Credits & ₹50 wallet cash once they complete their first wash!`,
              type: "referral_invite",
              isRead: false,
              createdAt: new Date().toISOString()
            });

            // Notify new user (referee) of their welcome credits & wallet bonus
            await addDoc(collection(db, 'notifications'), {
              userId: finalData.uid,
              title: "🎉 Welcome Bonus Credited!",
              message: `You earned 10 Free Laundry Credits (approx. 1 kg wash) & ₹50 in your Student Wallet by joining with code ${trimmedRef}!`,
              type: "referral_welcome",
              isRead: false,
              createdAt: new Date().toISOString()
            });

            // Add wallet transaction record for the welcome bonus
            await addDoc(collection(db, 'wallet_transactions'), {
              userId: finalData.uid,
              amount: 50,
              type: "credit",
              method: "referral_bonus",
              description: `Referral Welcome Bonus (${trimmedRef})`,
              createdAt: new Date().toISOString()
            });
          }
        } catch (refErr) {
          console.error('Error applying referral code:', refErr);
        }
      }

      await login(finalData);
      
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

  // Email Login & Signup
  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (mode === 'signup') {
        if (!formData.fullName.trim()) {
          setError('Please enter your full name.');
          setLoading(false);
          return;
        }
        if (!formData.phone.trim()) {
          setError('Please enter your phone number.');
          setLoading(false);
          return;
        }
        const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
        
        // Send email verification link
        try {
          await sendEmailVerification(userCredential.user);
        } catch (sendErr) {
          console.error('Initial sendEmailVerification error:', sendErr);
        }

        // Present email verification screen to user
        setVerificationEmail(formData.email);
        setVerificationPendingInfo({ phone: formData.phone, fullName: formData.fullName });
        setShowVerificationScreen(true);
        setResendCooldown(60);
        setVerificationStatus({
          type: 'info',
          message: `A verification link has been sent to ${formData.email}. Please verify your email to complete registration.`
        });
        setLoading(false);
        return;
      } else {
        const userCredential = await signInWithEmailAndPassword(auth, formData.email, formData.password);
        
        // Enforce email verification on email/password sign-in
        if (!userCredential.user.emailVerified) {
          setVerificationEmail(formData.email);
          setVerificationPendingInfo({ phone: '', fullName: '' });
          setShowVerificationScreen(true);
          setResendCooldown(30);
          setVerificationStatus({
            type: 'info',
            message: 'Your email address is not verified yet. Please check your inbox or resend the verification link below.'
          });
          try {
            await sendEmailVerification(userCredential.user);
          } catch (sendErr) {
            // Already sent or rate limited, ignore
          }
          setLoading(false);
          return;
        }

        await handleAuthSuccess(userCredential.user);
      }
    } catch (err: any) {
      if (err.code === 'auth/user-not-found') {
        setError('No account found with this email.');
      } else if (err.code === 'auth/wrong-password') {
        setError('Incorrect password.');
      } else if (err.code === 'auth/email-already-in-use') {
        setError('An account with this email already exists. Please log in.');
      } else if (err.code === 'auth/invalid-credential') {
        setError('Invalid email or password.');
      } else {
        setError(err.message || 'Authentication failed. Please check your credentials.');
      }
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Password Reset Handler
  const handleSendPasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    const emailToReset = resetEmail.trim();
    if (!emailToReset) {
      setResetError('Please enter your email address.');
      return;
    }
    setResetLoading(true);
    setResetError('');
    setResetSuccess(false);

    try {
      await sendPasswordResetEmail(auth, emailToReset);
      setResetSuccess(true);
    } catch (err: any) {
      console.error('Password reset error:', err);
      if (err.code === 'auth/user-not-found') {
        setResetError('No account found with this email address.');
      } else if (err.code === 'auth/invalid-email') {
        setResetError('Please enter a valid email address.');
      } else if (err.code === 'auth/too-many-requests') {
        setResetError('Too many requests. Please wait a moment and try again.');
      } else if (err.code === 'auth/network-request-failed') {
        setResetError('Network connection error. Please try again.');
      } else {
        setResetError(err.message || 'Failed to send password reset email. Please try again.');
      }
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-8 sm:py-12">
      <button 
        onClick={() => navigate('/')}
        className="flex items-center text-gray-500 hover:text-primary-electric mb-8 transition-colors text-sm font-bold uppercase tracking-widest"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Home
      </button>

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white dark:bg-surface-container p-6 sm:p-10 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-2xl shadow-black/5 dark:shadow-none relative overflow-hidden"
      >
        {/* Account Deletion Notice */}
        {searchParams.get('deleted') === 'true' && (
          <div className="p-4 bg-green-500/10 border border-green-500/30 text-green-600 dark:text-green-400 text-xs font-bold rounded-2xl mb-6 text-center flex items-center justify-center gap-2">
            <span>Your account has been permanently deleted.</span>
          </div>
        )}

        {/* Email Verification Screen */}
        {showVerificationScreen ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="text-center">
              <div className="w-16 h-16 mx-auto rounded-3xl bg-primary-electric/10 dark:bg-primary-electric/20 text-primary-electric flex items-center justify-center mb-4 relative">
                <Mail className="w-8 h-8" />
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 rounded-full border-2 border-white dark:border-surface-container animate-pulse" />
              </div>
              <h2 className="text-2xl font-display font-black text-gray-800 dark:text-high-contrast uppercase tracking-tight">
                Verify Your Email
              </h2>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-2 font-bold uppercase tracking-widest">
                We sent a confirmation link to
              </p>
              <div className="mt-3 p-3 bg-gray-50 dark:bg-surface-low rounded-2xl border border-gray-200 dark:border-gray-800 text-center font-mono font-bold text-sm text-primary-electric dark:text-primary-electric-light break-all select-all">
                {verificationEmail}
              </div>
            </div>

            {/* Instruction card */}
            <div className="bg-blue-50/70 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/40 rounded-2xl p-4 text-xs space-y-2.5 text-gray-600 dark:text-gray-300">
              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-primary-electric/10 text-primary-electric font-black flex items-center justify-center shrink-0 text-[10px]">
                  1
                </span>
                <span>Open the verification email sent to your inbox.</span>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-primary-electric/10 text-primary-electric font-black flex items-center justify-center shrink-0 text-[10px]">
                  2
                </span>
                <span>Click the confirmation link to verify your email.</span>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-primary-electric/10 text-primary-electric font-black flex items-center justify-center shrink-0 text-[10px]">
                  3
                </span>
                <span>Return here and click <strong>"I've Verified My Email"</strong> (or wait for auto-detection).</span>
              </div>
            </div>

            {/* Status Feedback Message */}
            {verificationStatus && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className={`p-3.5 rounded-2xl text-xs font-bold flex items-center gap-2.5 border ${
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
            <div className="space-y-3 pt-2">
              <button
                type="button"
                onClick={handleCheckVerification}
                disabled={verificationChecking}
                className="w-full py-4 bg-primary-electric hover:bg-primary-electric/90 text-white font-black uppercase tracking-wider text-xs rounded-2xl shadow-xl shadow-primary-electric/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {verificationChecking ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Verifying...</span>
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
                className={`w-full py-3.5 rounded-2xl text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 border ${
                  resendCooldown > 0 || verificationResending
                    ? 'bg-gray-50 dark:bg-surface-low border-gray-200 dark:border-gray-800 text-gray-400 cursor-not-allowed'
                    : 'bg-white dark:bg-surface-highest border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-opacity-80'
                }`}
              >
                {verificationResending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Resending Email...</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className={`w-3.5 h-3.5 ${resendCooldown > 0 ? '' : 'text-primary-electric'}`} />
                    <span>{resendCooldown > 0 ? `Resend Link in ${resendCooldown}s` : 'Resend Verification Link'}</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleCancelVerification}
                className="w-full text-center py-2.5 text-xs font-bold text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 uppercase tracking-widest transition-colors"
              >
                ← Back to Login / Edit Email
              </button>
            </div>
          </motion.div>
        ) : (
          <>
            {/* Mode Switcher: Log In vs Sign Up */}
            <div className="flex bg-gray-100 dark:bg-surface-low p-1.5 rounded-2xl mb-8">
          <button
            type="button"
            onClick={() => { setMode('login'); setError(''); }}
            className={`flex-1 py-3 text-xs font-black uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-2 ${
              mode === 'login' 
                ? 'bg-white dark:bg-surface-highest text-primary-electric dark:text-primary-electric-light shadow-md' 
                : 'text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <LogIn className="w-4 h-4" />
            <span>Log In</span>
          </button>
          <button
            type="button"
            onClick={() => { setMode('signup'); setError(''); }}
            className={`flex-1 py-3 text-xs font-black uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-2 ${
              mode === 'signup' 
                ? 'bg-white dark:bg-surface-highest text-primary-electric dark:text-primary-electric-light shadow-md' 
                : 'text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <UserPlus className="w-4 h-4" />
            <span>Sign Up</span>
          </button>
        </div>

        <div className="text-center mb-8">
          <h2 className="text-3xl font-display font-black text-gray-800 dark:text-high-contrast uppercase tracking-tight">
            {mode === 'login' ? 'Welcome Back' : 'Create Account'}
          </h2>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-2 font-bold uppercase tracking-widest">
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
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="••••••••"
                    className="w-full pl-13 pr-5 py-4 bg-gray-50 dark:bg-surface-low rounded-2xl focus:bg-white dark:focus:bg-surface-highest border border-gray-200 dark:border-gray-800 outline-none transition-all dark:text-high-contrast font-bold text-sm"
                  />
                </div>
              </div>

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

              <button
                type="submit"
                disabled={loading}
                className="w-full py-4.5 bg-gradient-to-br from-primary-electric to-[#3323cc] text-white font-black uppercase tracking-widest text-xs rounded-2xl transition-all shadow-xl shadow-primary-electric/20 dark:shadow-none haptic-feedback flex items-center justify-center"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (mode === 'signup' ? 'Create Account' : 'Sign In')}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="bg-white dark:bg-surface-container w-full max-w-md p-6 sm:p-8 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-2xl relative overflow-hidden"
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

