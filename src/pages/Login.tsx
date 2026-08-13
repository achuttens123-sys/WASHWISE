import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Mail, User, ArrowLeft, Loader2, LogIn, Lock, Phone, UserPlus } from 'lucide-react';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { isSuperAdminEmail } from '../constants';
import { useAuth } from '../context/AuthContext';
import TermsModal from '../components/TermsModal';

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

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showTerms, setShowTerms] = useState(false);
  const [pendingUserData, setPendingUserData] = useState<any>(null);

  // Sync mode changes from URL search params
  useEffect(() => {
    const queryMode = searchParams.get('mode');
    if (queryMode === 'signup' || queryMode === 'login') {
      setMode(queryMode);
    }
  }, [searchParams]);

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
        const updatedData = {
          ...existingData,
          role: (isAdminEmail || adminRoleData) ? 'admin' as const : (existingData.role || 'user'),
          userType: (isAdminEmail || adminRoleData) ? 'admin' as const : (existingData.userType || 'guest'),
          adminRole: adminRoleData?.role || (isAdminEmail ? 'super_admin' : (existingData.adminRole || null))
        };
        
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

        const newUserData = {
          uid: fbUser.uid,
          name: fbUser.displayName || formData.fullName || customName || 'WashWise User',
          email: fbUser.email || formData.email || '',
          phone: fbUser.phoneNumber || formData.phone || customPhone || '',
          userType: (isAdminEmail || adminRoleData) ? ('admin' as const) : ('guest' as const),
          role: (isAdminEmail || adminRoleData) ? ('admin' as const) : ('user' as const),
          adminRole: adminRoleData?.role || (isAdminEmail ? 'super_admin' : null),
          isRegistered: true,
          createdAt: new Date().toISOString(),
          termsAccepted: false,
          deviceId,
          ipAddress
        };

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
      const finalData = { ...pendingUserData, termsAccepted: true };
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
        await handleAuthSuccess(userCredential.user, formData.phone, formData.fullName);
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
                <label className="text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Password</label>
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

