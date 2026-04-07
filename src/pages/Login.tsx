import React, { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Mail, User, ArrowLeft, Loader2, LogIn, GraduationCap, CheckCircle, Lock, Package, ShieldCheck } from 'lucide-react';
import { signInWithPopup, GoogleAuthProvider, createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import TermsModal from '../components/TermsModal';

const Login: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { login } = useAuth();
  const { settings } = useSettings();
  
  const userType = searchParams.get('type') || 'guest';
  const isSubscriber = userType === 'subscriber';

  const [step, setStep] = useState<'login' | 'register'>('login');
  const [authMethod, setAuthMethod] = useState<'google' | 'email' | 'staff'>('google');
  const [isSignup, setIsSignup] = useState(false);
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [loggedInStaff, setLoggedInStaff] = useState<any>(null);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    staffId: '',
    newPassword: '',
    confirmPassword: '',
    fullName: '',
    studentId: '',
    referralCode: '',
    selectedPackage: settings?.subscriptionPlans[0]?.id || 'basic'
  });
  const [tempUser, setTempUser] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showTerms, setShowTerms] = useState(false);
  const [pendingUserData, setPendingUserData] = useState<any>(null);

  const handleAuthSuccess = async (fbUser: any) => {
    // Check if user already exists in Firestore
    const userDoc = await getDoc(doc(db, 'users', fbUser.uid));
    
    // Check for admin role by email
    const adminRoleDoc = await getDoc(doc(db, 'admin_roles', fbUser.email || ''));
    const adminRoleData = adminRoleDoc.exists() ? adminRoleDoc.data() : null;
    const isAdminEmail = fbUser.email === 'ashwinchuttipara@gmail.com';

    if (userDoc.exists()) {
      const existingData = userDoc.data();
      
      // Check if user is suspended
      if (existingData.isSuspended) {
        setError('Your account has been suspended. Please contact support.');
        setLoading(false);
        return;
      }
      
      // Update role if found in admin_roles or if it's the hardcoded admin
      const updatedData = {
        ...existingData,
        role: (isAdminEmail || adminRoleData) ? 'admin' as const : existingData.role,
        userType: (isAdminEmail || adminRoleData) ? 'admin' as const : existingData.userType,
        adminRole: adminRoleData?.role || (isAdminEmail ? 'super_admin' : (existingData.adminRole || null))
      };
      
      await login(updatedData as any);
      if (updatedData.adminRole) {
        navigate('/admin');
      } else {
        navigate('/dashboard');
      }
    } else {
      // New user
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

      if (isSubscriber) {
        setTempUser({ ...fbUser, deviceId, ipAddress });
        setStep('register');
      } else {
        const userData = {
          uid: fbUser.uid,
          name: fbUser.displayName || formData.fullName || 'Guest User',
          email: fbUser.email || formData.email || '',
          userType: (isAdminEmail || adminRoleData) ? 'admin' as const : 'guest' as const,
          role: (isAdminEmail || adminRoleData) ? 'admin' as const : 'user' as const,
          adminRole: adminRoleData?.role || (isAdminEmail ? 'super_admin' : null),
          isRegistered: true,
          createdAt: new Date().toISOString(),
          termsAccepted: false,
          deviceId,
          ipAddress,
          referredBy: formData.referralCode || null
        };
        setPendingUserData(userData);
        setShowTerms(true);
      }
    }
  };

  const finalizeRegistration = async () => {
    if (!pendingUserData) return;
    setLoading(true);
    try {
      const finalData = { ...pendingUserData, termsAccepted: true };
      await login(finalData);
      
      // Handle referral if code was provided
      if (finalData.referredBy) {
        const { GamificationService } = await import('../services/GamificationService');
        await GamificationService.handleReferral(finalData.referredBy, finalData.uid);
      }

      setShowTerms(false);
      if (finalData.adminRole) {
        navigate('/admin');
      } else if (finalData.userType === 'subscriber') {
        navigate(`/billing?type=subscription&packageId=${formData.selectedPackage}`);
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      setError('Registration failed. Try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

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
        // User closed the popup, don't show a scary error
        setLoading(false);
        return;
      } else if (err.code === 'auth/cancelled-popup-request') {
        return;
      } else {
        setError('Login failed. Please try again.');
      }
      console.error('Google Login Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (isSignup) {
        const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
        await handleAuthSuccess(userCredential.user);
      } else {
        const userCredential = await signInWithEmailAndPassword(auth, formData.email, formData.password);
        await handleAuthSuccess(userCredential.user);
      }
    } catch (err: any) {
      if (err.code === 'auth/user-not-found') {
        setError('No account found with this email.');
      } else if (err.code === 'auth/wrong-password') {
        setError('Incorrect password.');
      } else if (err.code === 'auth/email-already-in-use') {
        setError('Email already in use.');
      } else {
        setError('Authentication failed. Please try again.');
      }
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleStaffLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staffId: formData.staffId, password: formData.password })
      });

      const result = await response.json();
      if (result.success) {
        if (result.user.isFirstLogin) {
          setLoggedInStaff(result.user);
          setShowPasswordChange(true);
        } else {
          const { signInWithCustomToken } = await import('firebase/auth');
          const userCredential = await signInWithCustomToken(auth, result.token);
          await handleAuthSuccess(userCredential.user);
        }
      } else {
        setError(result.error || 'Login failed');
      }
    } catch (err) {
      console.error(err);
      setError('An error occurred during login');
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.newPassword !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (formData.newPassword.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          staffId: loggedInStaff.staffId, 
          newPassword: formData.newPassword 
        })
      });

      const result = await response.json();
      if (result.success) {
        const { signInWithCustomToken } = await import('firebase/auth');
        const userCredential = await signInWithCustomToken(auth, result.token);
        await handleAuthSuccess(userCredential.user);
      } else {
        setError(result.error || 'Failed to change password');
      }
    } catch (err) {
      console.error(err);
      setError('An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.studentId || (!formData.fullName && !tempUser?.displayName)) {
      setError('Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      const userData = {
        uid: tempUser.uid,
        name: formData.fullName || tempUser.displayName || 'Subscriber',
        email: tempUser.email || formData.email || '',
        userType: 'subscriber' as const,
        studentId: formData.studentId,
        package: formData.selectedPackage,
        isRegistered: true,
        createdAt: new Date().toISOString(),
        termsAccepted: false,
        deviceId: tempUser.deviceId,
        ipAddress: tempUser.ipAddress,
        referredBy: formData.referralCode || null
      };
      
      setPendingUserData(userData);
      setShowTerms(true);
    } catch (err) {
      setError('Registration failed. Try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-4 sm:py-8">
      <button 
        onClick={() => navigate('/')}
        className="flex items-center text-gray-500 hover:text-blue-600 mb-6 sm:mb-8 transition-colors text-sm"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Home
      </button>

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white dark:bg-gray-900 p-6 sm:p-8 rounded-2xl sm:rounded-3xl shadow-xl border border-blue-50 dark:border-gray-800"
      >
        <AnimatePresence mode="wait">
          {step === 'login' ? (
            <motion.div
              key="login-step"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
            >
              <div className="text-center mb-6 sm:mb-8">
                <h2 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-gray-100">
                  {isSubscriber ? (isSignup ? 'Subscriber Signup' : 'Subscriber Login') : 'Guest Login'}
                </h2>
                <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-2">
                  {isSubscriber 
                    ? (isSignup ? 'Create account to start subscription' : 'Sign in to access subscription')
                    : 'Sign in with your account to continue'}
                </p>
              </div>

              <div className="space-y-6">
                {/* Auth Method Toggle */}
                <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-xl">
                  <button
                    onClick={() => { setAuthMethod('google'); setIsSignup(false); }}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                      authMethod === 'google' 
                        ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm' 
                        : 'text-gray-500 dark:text-gray-400'
                    }`}
                  >
                    Google
                  </button>
                  <button
                    onClick={() => { setAuthMethod('email'); setIsSignup(false); }}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                      authMethod === 'email' 
                        ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm' 
                        : 'text-gray-500 dark:text-gray-400'
                    }`}
                  >
                    Email
                  </button>
                  <button
                    onClick={() => { setAuthMethod('staff'); setIsSignup(false); }}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                      authMethod === 'staff' 
                        ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm' 
                        : 'text-gray-500 dark:text-gray-400'
                    }`}
                  >
                    Staff ID
                  </button>
                </div>

                {error && <p className="text-red-500 text-sm text-center font-medium bg-red-50 dark:bg-red-900/20 p-3 rounded-xl">{error}</p>}

                {authMethod === 'google' ? (
                  <button
                    onClick={handleGoogleLogin}
                    disabled={loading}
                    className="w-full py-3 sm:py-4 bg-white dark:bg-gray-800 border-2 border-gray-100 dark:border-gray-700 text-gray-700 dark:text-gray-200 font-semibold rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-all flex items-center justify-center shadow-sm hover:shadow-md"
                  >
                    {loading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5 mr-3" alt="Google" />
                        Sign in with Google
                      </>
                    )}
                  </button>
                ) : authMethod === 'email' ? (
                  <form onSubmit={handleEmailAuth} className="space-y-4">
                    {isSignup && (
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300 ml-1">Full Name</label>
                        <div className="relative">
                          <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
                          <input
                            type="text"
                            required
                            value={formData.fullName}
                            onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                            placeholder="Enter your full name"
                            className="w-full pl-12 pr-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all dark:text-gray-100"
                          />
                        </div>
                      </div>
                    )}
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300 ml-1">Email Address</label>
                      <div className="relative">
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
                        <input
                          type="email"
                          required
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          placeholder="name@example.com"
                          className="w-full pl-12 pr-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all dark:text-gray-100"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300 ml-1">Password</label>
                      <div className="relative">
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
                        <input
                          type="password"
                          required
                          value={formData.password}
                          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                          placeholder="••••••••"
                          className="w-full pl-12 pr-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all dark:text-gray-100"
                        />
                      </div>
                    </div>

                    {isSignup && (
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300 ml-1">Referral Code (Optional)</label>
                        <div className="relative">
                          <Package className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
                          <input
                            type="text"
                            value={formData.referralCode}
                            onChange={(e) => setFormData({ ...formData, referralCode: e.target.value.toUpperCase() })}
                            placeholder="Have a referral code? Enter to get rewards"
                            className="w-full pl-12 pr-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all dark:text-gray-100"
                          />
                        </div>
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full py-3 sm:py-4 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-all flex items-center justify-center shadow-lg shadow-blue-200 dark:shadow-none"
                    >
                      {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (isSignup ? 'Create Account' : 'Sign In')}
                    </button>

                    <button
                      type="button"
                      onClick={() => setIsSignup(!isSignup)}
                      className="w-full text-sm font-bold text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      {isSignup ? 'Already have an account? Login' : (isSubscriber ? 'New subscriber? Create an account' : 'Don\'t have an account? Sign up')}
                    </button>
                  </form>
                ) : (
                  <form onSubmit={handleStaffLogin} className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300 ml-1">Staff ID</label>
                      <div className="relative">
                        <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
                        <input
                          type="text"
                          required
                          value={formData.staffId}
                          onChange={(e) => setFormData({ ...formData, staffId: e.target.value })}
                          placeholder="e.g. WW-MGR-001"
                          className="w-full pl-12 pr-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all dark:text-gray-100"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300 ml-1">Password</label>
                      <div className="relative">
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
                        <input
                          type="password"
                          required
                          value={formData.password}
                          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                          placeholder="••••••••"
                          className="w-full pl-12 pr-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all dark:text-gray-100"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full py-3 sm:py-4 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-all flex items-center justify-center shadow-lg shadow-blue-200 dark:shadow-none"
                    >
                      {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Staff Login'}
                    </button>
                  </form>
                )}

                <p className="text-xs text-center text-gray-400 dark:text-gray-500 px-4">
                  By signing in, you agree to our Terms of Service and Privacy Policy.
                </p>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="register-step"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
            >
              <div className="text-center mb-8">
                <div className="bg-blue-50 dark:bg-blue-900/20 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                  <GraduationCap className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                </div>
                <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Complete Signup</h2>
                <p className="text-gray-500 dark:text-gray-400 mt-2">Please provide your student details</p>
              </div>

              <form onSubmit={handleRegister} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 ml-1">Full Name</label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
                    <input
                      type="text"
                      required
                      value={formData.fullName}
                      onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                      placeholder="Enter your full name"
                      className="w-full pl-12 pr-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all dark:text-gray-100"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 ml-1">Student ID</label>
                  <div className="relative">
                    <GraduationCap className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
                    <input
                      type="text"
                      required
                      value={formData.studentId}
                      onChange={(e) => setFormData({ ...formData, studentId: e.target.value })}
                      placeholder="e.g. STU12345"
                      className="w-full pl-12 pr-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all dark:text-gray-100"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 ml-1">Referral Code (Optional)</label>
                  <div className="relative">
                    <Package className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
                    <input
                      type="text"
                      value={formData.referralCode}
                      onChange={(e) => setFormData({ ...formData, referralCode: e.target.value.toUpperCase() })}
                      placeholder="Have a referral code? Enter to get rewards"
                      className="w-full pl-12 pr-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all dark:text-gray-100"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 ml-1">Select Package</label>
                  <div className="grid grid-cols-1 gap-3">
                    {(settings?.subscriptionPlans || []).map((pkg) => {
                      return (
                        <button
                          key={pkg.id}
                          type="button"
                          onClick={() => setFormData({ ...formData, selectedPackage: pkg.id })}
                          className={`flex items-center justify-between p-4 rounded-xl border-2 transition-all ${
                            formData.selectedPackage === pkg.id
                              ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20'
                              : 'border-gray-100 dark:border-gray-800 hover:border-gray-200'
                          }`}
                        >
                          <div className="text-left">
                            <div className="flex items-center gap-2">
                              <p className="font-bold text-gray-800 dark:text-gray-100">{pkg.name}</p>
                              <span className="px-1.5 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 text-[8px] font-black uppercase tracking-widest rounded">
                                {pkg.discount}% OFF
                              </span>
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400">{pkg.kgLimit} kg/month</p>
                          </div>
                          <div className="text-right">
                            <p className="font-black text-blue-600 dark:text-blue-400">₹{pkg.price}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {error && <p className="text-red-500 text-sm text-center font-medium bg-red-50 dark:bg-red-900/20 p-3 rounded-xl">{error}</p>}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 sm:py-4 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-all flex items-center justify-center shadow-lg shadow-blue-200 dark:shadow-none"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Complete Registration'}
                </button>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      <TermsModal 
        isOpen={showTerms}
        onClose={() => setShowTerms(false)}
        onAccept={finalizeRegistration}
        mode="disclaimer"
        loading={loading}
      />

      {/* Password Change Modal */}
      <AnimatePresence>
        {showPasswordChange && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white dark:bg-gray-900 w-full max-w-md rounded-2xl sm:rounded-[3rem] shadow-2xl overflow-hidden p-6 sm:p-8"
            >
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/20 rounded-full flex items-center justify-center text-blue-600 mx-auto mb-4">
                  <Lock className="w-8 h-8" />
                </div>
                <h3 className="text-2xl font-black text-gray-800 dark:text-gray-100 uppercase tracking-tight">Security Update</h3>
                <p className="text-gray-500 font-medium mt-2">This is your first login. Please set a new secure password.</p>
              </div>

              <form onSubmit={handleChangePassword} className="space-y-4">
                {error && <p className="text-red-500 text-sm text-center font-medium bg-red-50 dark:bg-red-900/20 p-3 rounded-xl">{error}</p>}
                
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 ml-1">New Password</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
                    <input
                      type="password"
                      required
                      value={formData.newPassword}
                      onChange={(e) => setFormData({ ...formData, newPassword: e.target.value })}
                      placeholder="Min 8 characters"
                      className="w-full pl-12 pr-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all dark:text-gray-100"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 ml-1">Confirm Password</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
                    <input
                      type="password"
                      required
                      value={formData.confirmPassword}
                      onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                      placeholder="Repeat new password"
                      className="w-full pl-12 pr-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all dark:text-gray-100"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 sm:py-4 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-all flex items-center justify-center shadow-lg shadow-blue-200 dark:shadow-none mt-4"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Update Password & Login'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Login;
