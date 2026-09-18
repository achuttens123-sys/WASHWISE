import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'motion/react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { SettingsProvider } from './context/SettingsContext';
import Layout from './components/Layout';
import Home from './pages/Home';
import ErrorBoundary from './components/ErrorBoundary';
import PageTransition from './components/PageTransition';
import LoadingScreen from './components/LoadingScreen';
import { requestNotificationPermission, onMessageListener } from './services/NotificationService';
import { Toaster, toast } from 'react-hot-toast';
import { lazyWithRetry } from './utils/lazyWithRetry';

// Code-split route components with automatic retry and reload resilience
const Login = lazyWithRetry(() => import('./pages/Login'));
const Dashboard = lazyWithRetry(() => import('./pages/Dashboard'));
const BookingDetails = lazyWithRetry(() => import('./pages/BookingDetails'));
const Billing = lazyWithRetry(() => import('./pages/Billing'));
const Confirmation = lazyWithRetry(() => import('./pages/Confirmation'));
const Profile = lazyWithRetry(() => import('./pages/Profile'));
const AdminDashboard = lazyWithRetry(() => import('./pages/AdminDashboard'));
const SuperAdminDashboard = lazyWithRetry(() => import('./pages/dashboards/SuperAdminDashboard'));
const StoreManagerDashboard = lazyWithRetry(() => import('./pages/dashboards/StoreManagerDashboard'));
const StoreStaffDashboard = lazyWithRetry(() => import('./pages/dashboards/StoreStaffDashboard'));
const DeliveryStaffDashboard = lazyWithRetry(() => import('./pages/dashboards/DeliveryStaffDashboard'));

const ProtectedRoute: React.FC<{ children: React.ReactNode; adminOnly?: boolean }> = ({ children, adminOnly }) => {
  const { user, loading, isAdmin } = useAuth();
  
  if (loading) {
    return <LoadingScreen />;
  }
  
  if (!user) {
    return <Navigate to="/" replace />;
  }

  if (adminOnly && !isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }
  
  return <>{children}</>;
};

const AdminRouter: React.FC = () => {
  const { user, isSuperAdmin, isStoreManager, isStoreStaff, isDeliveryStaff } = useAuth();

  if (isSuperAdmin) return <SuperAdminDashboard />;
  if (isStoreManager) return <StoreManagerDashboard />;
  if (isStoreStaff) return <StoreStaffDashboard />;
  if (isDeliveryStaff) return <DeliveryStaffDashboard />;
  
  return <AdminDashboard />; // Fallback for other admin roles
};

const AnimatedRoutes: React.FC = () => {
  const location = useLocation();
  
  return (
    <Suspense fallback={<LoadingScreen />}>
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route element={<Layout />}>
            <Route path="/" element={<PageTransition><Home /></PageTransition>} />
            <Route path="/login" element={<PageTransition><Login /></PageTransition>} />
            
            <Route 
              path="/dashboard" 
              element={
                <ProtectedRoute>
                  <PageTransition><Dashboard /></PageTransition>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/booking-details" 
              element={
                <ProtectedRoute>
                  <PageTransition><BookingDetails /></PageTransition>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/billing" 
              element={
                <ProtectedRoute>
                  <PageTransition><Billing /></PageTransition>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/confirmation" 
              element={
                <ProtectedRoute>
                  <PageTransition><Confirmation /></PageTransition>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/profile" 
              element={
                <ProtectedRoute>
                  <PageTransition><Profile /></PageTransition>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin" 
              element={
                <ProtectedRoute adminOnly>
                  <PageTransition><AdminRouter /></PageTransition>
                </ProtectedRoute>
              } 
            />
          </Route>
        </Routes>
      </AnimatePresence>
    </Suspense>
  );
};

const AppContent: React.FC = () => {
  const { user } = useAuth();

  React.useEffect(() => {
    if (user) {
      requestNotificationPermission();
      
      onMessageListener().then((payload: any) => {
        console.log('Foreground message received:', payload);
        if (payload.notification) {
          toast.success(`${payload.notification.title}: ${payload.notification.body}`, {
            duration: 5000,
            position: 'top-right',
          });
        }
      }).catch(err => console.log('failed: ', err));
    }
  }, [user]);

  return (
    <Router>
      <Toaster />
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none bg-white dark:bg-deep-core transition-colors duration-500">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-primary-electric/5 blur-[120px] animate-pulse-glow" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-primary-electric-light/5 blur-[120px] animate-pulse-glow" style={{ animationDelay: '1s' }} />
      </div>
      <div className="min-h-screen font-sans text-gray-900 dark:text-high-contrast">
        <AnimatedRoutes />
      </div>
    </Router>
  );
};

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <SettingsProvider>
            <AppContent />
          </SettingsProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
