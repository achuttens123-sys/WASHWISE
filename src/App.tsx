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
import { requestNotificationPermission, onMessageListener, showDeviceSystemNotification } from './services/NotificationService';
import { getDisplayBookingId } from './services/BookingIdService';
import { Toaster, toast } from 'react-hot-toast';
import { lazyWithRetry } from './utils/lazyWithRetry';
import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';

// Code-split route components with automatic retry and reload resilience
const Login = lazyWithRetry(() => import('./pages/Login'));
const Dashboard = lazyWithRetry(() => import('./pages/Dashboard'));
const BookingDetails = lazyWithRetry(() => import('./pages/BookingDetails'));
const Billing = lazyWithRetry(() => import('./pages/Billing'));
const Confirmation = lazyWithRetry(() => import('./pages/Confirmation'));
const Orders = lazyWithRetry(() => import('./pages/Orders'));
const Profile = lazyWithRetry(() => import('./pages/Profile'));
const AdminDashboard = lazyWithRetry(() => import('./pages/AdminDashboard'));
const SuperAdminDashboard = lazyWithRetry(() => import('./pages/dashboards/SuperAdminDashboard'));
const StoreManagerDashboard = lazyWithRetry(() => import('./pages/dashboards/StoreManagerDashboard'));
const StoreStaffDashboard = lazyWithRetry(() => import('./pages/dashboards/StoreStaffDashboard'));
const DeliveryStaffDashboard = lazyWithRetry(() => import('./pages/dashboards/DeliveryStaffDashboard'));
const InstallApp = lazyWithRetry(() => import('./pages/InstallApp'));

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
  const { user, isSuperAdmin, isStoreAdmin, isStoreManager, isStoreStaff, isDeliveryStaff } = useAuth();

  if (isSuperAdmin) return <SuperAdminDashboard />;
  if (isStoreManager || isStoreAdmin) return <StoreManagerDashboard />;
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
            <Route path="/install" element={<PageTransition><InstallApp /></PageTransition>} />
            
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
              path="/orders" 
              element={
                <ProtectedRoute>
                  <PageTransition><Orders /></PageTransition>
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

// Module-level deduplication cache to ensure strictly ONE notification per event across renders & FCM multicasts
const processedNotificationEvents = new Map<string, number>();
let lastProcessedSummary = '';
let lastProcessedTime = 0;

const AppContent: React.FC = () => {
  const { user } = useAuth();

  React.useEffect(() => {
    if (!user) return;

    requestNotificationPermission();

    const unsubscribe = onMessageListener(async (payload: any) => {
      console.log('Foreground message received:', payload);
      if (!payload) return;

      const data = payload.data || {};
      const notification = payload.notification || {};

      // 1. Resolve the custom order ID (e.g., 0033/OCT/26/0956) instead of generic system strings
      const candidates = [
        data.customOrderId,
        data.customBookingId,
        data.bookingId,
        data.orderId,
        data.displayBookingId,
      ];

      // Check if custom order ID with sequential format (contains '/') already exists in payload data
      let customOrderId = candidates.find((c: any) => typeof c === 'string' && c.includes('/')) || '';

      // Check if custom order ID format exists inside notification text
      if (!customOrderId) {
        const combinedText = `${notification.title || ''} ${notification.body || ''} ${data.title || ''} ${data.body || ''}`;
        const match = combinedText.match(/\b\d{4}\/[A-Za-z]{3}\/\d{2}\/\d{4}\b/);
        if (match) {
          customOrderId = match[0];
        }
      }

      // Check raw document ID to fetch actual custom order ID from Firestore if missing
      const rawDocId = data.bookingDocId || 
        (typeof data.bookingId === 'string' && !data.bookingId.includes('/') ? data.bookingId.replace(/^#/, '') : '');

      if (!customOrderId && rawDocId) {
        try {
          const bookingSnap = await getDoc(doc(db, 'bookings', rawDocId));
          if (bookingSnap.exists()) {
            const bData = bookingSnap.data();
            if (bData?.bookingId && typeof bData.bookingId === 'string' && bData.bookingId.includes('/')) {
              customOrderId = bData.bookingId;
            } else if (bData?.customBookingId && typeof bData.customBookingId === 'string' && bData.customBookingId.includes('/')) {
              customOrderId = bData.customBookingId;
            }
          }
        } catch (err) {
          console.warn('Could not retrieve booking doc for custom order ID:', err);
        }
      }

      // Fallback: If still not resolved, check getDisplayBookingId
      if (!customOrderId) {
        const fallback = getDisplayBookingId(data.bookingId || data.bookingDocId);
        if (fallback && fallback !== 'N/A') {
          customOrderId = fallback;
        }
      }

      // 2. Prepare title & body and replace generic system strings (#XXXXXX or raw doc IDs) with custom order ID
      let title = notification.title || data.title || 'WashWise Update';
      let body = notification.body || data.body || 'Order status updated';

      if (customOrderId && customOrderId !== 'N/A') {
        // Strip out generic system placeholders like #123456 or #A1B2C3
        body = body.replace(/#[a-zA-Z0-9_\-\/]+/g, customOrderId);
        title = title.replace(/#[a-zA-Z0-9_\-\/]+/g, customOrderId);

        // Strip out raw Firestore document ID if present in body or title
        if (rawDocId) {
          body = body.split(rawDocId).join(customOrderId);
          title = title.split(rawDocId).join(customOrderId);
        }

        // If the body doesn't contain the custom order ID, prepend or format it cleanly
        if (!body.includes(customOrderId) && !title.includes(customOrderId)) {
          body = `Order ${customOrderId}: ${body}`;
        }
      }

      // 3. Deduplication: Guarantee STRICTLY a single notification is triggered
      // DO NOT use payload.messageId / fcmMessageId because FCM sends a distinct messageId to each device token
      const eventOrderId = customOrderId || rawDocId || data.bookingId || 'order';
      const eventStatus = (data.status || '').toLowerCase().trim();
      const eventTitle = title.toLowerCase().trim();
      const dedupKey = `${eventOrderId}__${eventStatus || eventTitle}`.replace(/[^a-zA-Z0-9_]/g, '_');

      const now = Date.now();
      const lastProcessedTimeForEvent = processedNotificationEvents.get(dedupKey);

      // A: Drop duplicate delivery of identical event within 15 seconds
      if (lastProcessedTimeForEvent && (now - lastProcessedTimeForEvent) < 15000) {
        console.log(`[onMessageListener] Duplicate notification suppressed for event: ${dedupKey}`);
        return;
      }

      // B: Drop rapid-burst deliveries (e.g. multicast to multiple tokens arriving within 3 seconds)
      const messageSummary = `${title}:::${body}`;
      if (messageSummary === lastProcessedSummary && (now - lastProcessedTime) < 3000) {
        console.log(`[onMessageListener] Rapid multicast duplicate suppressed: ${messageSummary}`);
        return;
      }

      // Record this delivery
      processedNotificationEvents.set(dedupKey, now);
      lastProcessedSummary = messageSummary;
      lastProcessedTime = now;

      // Clean up old entries from deduplication map
      if (processedNotificationEvents.size > 200) {
        for (const [key, ts] of processedNotificationEvents.entries()) {
          if (now - ts > 30000) {
            processedNotificationEvents.delete(key);
          }
        }
      }

      // 4. Trigger strictly a single notification
      // A single toast notification with deterministic ID to prevent stacking
      toast.success(`${title}: ${body}`, {
        id: `toast-${dedupKey}`,
        duration: 5000,
        position: 'top-right',
      });

      // Single device notification with coordinated tag
      showDeviceSystemNotification(title, {
        body,
        data: {
          ...data,
          bookingId: customOrderId,
          customOrderId
        },
        tag: `order-${customOrderId || 'status'}`
      });
    });

    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
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
