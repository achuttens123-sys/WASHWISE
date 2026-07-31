import React, { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Mail, User, ArrowLeft, Loader2, LogIn, GraduationCap, CheckCircle, Lock, Package, ShieldCheck } from 'lucide-react';
import { signInWithPopup, GoogleAuthProvider, createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { isSuperAdminEmail } from '../constants';
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
  const [authMethod, setAuthMethod] = useState<'google' | 'email'>('google');
  const [isSignup, setIsSignup] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    fullName: '',
    studentId: '',
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
    const isAdminEmail = isSuperAdminEmail(fbUser.email);

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
          ipAddress
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
        ipAddress: tempUser.ipAddress
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
        className="bg-white dark:bg-surface-container p-5 sm:p-10 rounded-2xl shadow-2xl shadow-black/5 dark:shadow-none relative overflow-hidden"
      >
        <AnimatePresence mode="wait">
          {step === 'login' ? (
            <motion.div
              key="login-step"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
            >
              <div className="text-center mb-10">
                <h2 className="text-3xl font-display font-black text-gray-800 dark:text-high-contrast uppercase tracking-tight">
                  {isSubscriber ? (isSignup ? 'Subscriber Signup' : 'Subscriber Login') : 'Guest Login'}
                </h2>
                <p className="text-sm text-gray-400 dark:text-gray-500 mt-3 font-medium uppercase tracking-widest">
                  {isSubscriber 
                    ? (isSignup ? 'Create account to start subscription' : 'Sign in to access subscription')
                    : 'Sign in with your account to continue'}
                </p>
              </div>

              <div className="space-y-8">
                {/* Auth Method Toggle */}
                <div className="flex bg-gray-50 dark:bg-surface-low p-1.5 rounded-2xl">
                  <button
                    onClick={() => { setAuthMethod('google'); setIsSignup(false); }}
                    className={`flex-1 py-3 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${
                      authMethod === 'google' 
                        ? 'bg-white dark:bg-surface-highest text-primary-electric dark:text-primary-electric-light shadow-sm' 
                        : 'text-gray-400 dark:text-gray-500'
                    }`}
                  >
                    Google
                  </button>
                  <button
                    onClick={() => { setAuthMethod('email'); setIsSignup(false); }}
                    className={`flex-1 py-3 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${
                      authMethod === 'email' 
                        ? 'bg-white dark:bg-surface-highest text-primary-electric dark:text-primary-electric-light shadow-sm' 
                        : 'text-gray-400 dark:text-gray-500'
                    }`}
                  >
                    Email
                  </button>
                </div>

                {error && <p className="text-red-500 text-xs text-center font-black uppercase tracking-widest bg-red-50 dark:bg-red-900/10 p-4 rounded-2xl">{error}</p>}

                {authMethod === 'google' ? (
                  <button
                    onClick={handleGoogleLogin}
                    disabled={loading}
                    className="w-full py-4 px-6 bg-white dark:bg-surface-highest text-gray-700 dark:text-high-contrast font-black uppercase tracking-wider text-xs sm:text-sm rounded-2xl hover:bg-gray-50 dark:hover:bg-opacity-80 transition-all flex items-center justify-center gap-3 shadow-sm"
                  >
                    {loading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5 shrink-0" alt="Google" />
                        <span className="whitespace-nowrap">Sign in with Google</span>
                      </>
                    )}
                  </button>
                ) : (
                  <form onSubmit={handleEmailAuth} className="space-y-6">
                    {isSignup && (
                      <div className="space-y-3">
                        <label className="text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Full Name</label>
                        <div className="relative">
                          <User className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
                          <input
                            type="text"
                            required
                            value={formData.fullName}
                            onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                            placeholder="Enter your full name"
                            className="w-full pl-14 pr-6 py-5 bg-gray-50 dark:bg-surface-low rounded-2xl focus:bg-white dark:focus:bg-surface-highest outline-none transition-all dark:text-high-contrast font-bold"
                          />
                        </div>
                      </div>
                    )}
                    <div className="space-y-3">
                      <label className="text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Email Address</label>
                      <div className="relative">
                        <Mail className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
                        <input
                          type="email"
                          required
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          placeholder="name@example.com"
                          className="w-full pl-14 pr-6 py-5 bg-gray-50 dark:bg-surface-low rounded-2xl focus:bg-white dark:focus:bg-surface-highest outline-none transition-all dark:text-high-contrast font-bold"
                        />
                      </div>
                    </div>

                    <div className="space-y-3">
                      <label className="text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Password</label>
                      <div className="relative">
                        <Lock className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
                        <input
                          type="password"
                          required
                          value={formData.password}
                          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                          placeholder="••••••••"
                          className="w-full pl-14 pr-6 py-5 bg-gray-50 dark:bg-surface-low rounded-2xl focus:bg-white dark:focus:bg-surface-highest outline-none transition-all dark:text-high-contrast font-bold"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full py-5 bg-gradient-to-br from-primary-electric to-[#3323cc] text-white font-black uppercase tracking-widest rounded-2xl transition-all shadow-xl shadow-primary-electric/20 dark:shadow-none haptic-feedback"
                    >
                      {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (isSignup ? 'Create Account' : 'Sign In')}
                    </button>

                    <button
                      type="button"
                      onClick={() => setIsSignup(!isSignup)}
                      className="w-full text-xs font-black text-primary-electric dark:text-primary-electric-light hover:opacity-80 transition-opacity uppercase tracking-widest"
                    >
                      {isSignup ? 'Already have an account? Login' : (isSubscriber ? 'New subscriber? Create an account' : 'Don\'t have an account? Sign up')}
                    </button>
                  </form>
                )}

                <p className="text-[10px] text-center text-gray-400 dark:text-gray-500 px-4 font-bold uppercase tracking-widest leading-relaxed">
                  By signing in, you agree to our <br /> Terms of Service and Privacy Policy.
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
              <div className="text-center mb-10">
                <div className="bg-primary-electric/10 w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <GraduationCap className="w-10 h-10 text-primary-electric dark:text-primary-electric-light" />
                </div>
                <h2 className="text-3xl font-display font-black text-gray-800 dark:text-high-contrast uppercase tracking-tight">Complete Signup</h2>
                <p className="text-sm text-gray-400 dark:text-gray-500 mt-3 font-medium uppercase tracking-widest">Please provide your student details</p>
              </div>

              <form onSubmit={handleRegister} className="space-y-8">
                <div className="space-y-3">
                  <label className="text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Full Name</label>
                  <div className="relative">
                    <User className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
                    <input
                      type="text"
                      required
                      value={formData.fullName}
                      onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                      placeholder="Enter your full name"
                      className="w-full pl-14 pr-6 py-5 bg-gray-50 dark:bg-surface-low rounded-2xl focus:bg-white dark:focus:bg-surface-highest outline-none transition-all dark:text-high-contrast font-bold"
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Student ID</label>
                  <div className="relative">
                    <GraduationCap className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
                    <input
                      type="text"
                      required
                      value={formData.studentId}
                      onChange={(e) => setFormData({ ...formData, studentId: e.target.value })}
                      placeholder="e.g. STU12345"
                      className="w-full pl-14 pr-6 py-5 bg-gray-50 dark:bg-surface-low rounded-2xl focus:bg-white dark:focus:bg-surface-highest outline-none transition-all dark:text-high-contrast font-bold"
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Select Package</label>
                  <div className="grid grid-cols-1 gap-4">
                    {(settings?.subscriptionPlans || []).map((pkg) => {
                      return (
                        <button
                          key={pkg.id}
                          type="button"
                          onClick={() => setFormData({ ...formData, selectedPackage: pkg.id })}
                          className={`flex items-center justify-between p-6 rounded-2xl transition-all relative overflow-hidden ${
                            formData.selectedPackage === pkg.id
                              ? 'bg-primary-electric/10 ring-2 ring-primary-electric'
                              : 'bg-gray-50 dark:bg-surface-low hover:bg-gray-100 dark:hover:bg-surface-highest'
                          }`}
                        >
                          <div className="text-left relative z-10">
                            <div className="flex items-center gap-3">
                              <p className="font-black text-gray-800 dark:text-high-contrast uppercase tracking-tight">{pkg.name}</p>
                              <span className="px-2 py-0.5 bg-green-500 text-white text-[8px] font-black uppercase tracking-widest rounded">
                                {pkg.discount}% OFF
                              </span>
                            </div>
                            <p className="text-xs text-gray-400 dark:text-gray-500 font-bold uppercase tracking-widest mt-1">{pkg.kgLimit} kg/month</p>
                          </div>
                          <div className="text-right relative z-10">
                            <p className="font-black text-primary-electric dark:text-primary-electric-light text-xl">₹{pkg.price}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {error && <p className="text-red-500 text-xs text-center font-black uppercase tracking-widest bg-red-50 dark:bg-red-900/10 p-4 rounded-2xl">{error}</p>}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-5 bg-gradient-to-br from-primary-electric to-[#3323cc] text-white font-black uppercase tracking-widest rounded-2xl transition-all shadow-xl shadow-primary-electric/20 dark:shadow-none haptic-feedback"
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
    </div>
  );
};

export default Login;
