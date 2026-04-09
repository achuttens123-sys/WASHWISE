import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'motion/react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { SettingsProvider } from './context/SettingsContext';
import Layout from './components/Layout';
import Home from './pages/Home';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import BookingDetails from './pages/BookingDetails';
import Billing from './pages/Billing';
import Confirmation from './pages/Confirmation';
import Profile from './pages/Profile';
import Leaderboard from './pages/Leaderboard';
import Missions from './pages/Missions';
import AdminDashboard from './pages/AdminDashboard';
import SuperAdminDashboard from './pages/dashboards/SuperAdminDashboard';
import StoreManagerDashboard from './pages/dashboards/StoreManagerDashboard';
import StoreStaffDashboard from './pages/dashboards/StoreStaffDashboard';
import DeliveryStaffDashboard from './pages/dashboards/DeliveryStaffDashboard';
import ErrorBoundary from './components/ErrorBoundary';
import PageTransition from './components/PageTransition';
import LoadingScreen from './components/LoadingScreen';

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
            path="/leaderboard" 
            element={
              <ProtectedRoute>
                <PageTransition><Leaderboard /></PageTransition>
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/missions" 
            element={
              <ProtectedRoute>
                <PageTransition><Missions /></PageTransition>
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
  );
};

const AppContent: React.FC = () => {
  return (
    <Router>
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-blue-400/10 blur-[120px] animate-pulse-glow" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-purple-400/10 blur-[120px] animate-pulse-glow" style={{ animationDelay: '1s' }} />
      </div>
      <AnimatedRoutes />
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
