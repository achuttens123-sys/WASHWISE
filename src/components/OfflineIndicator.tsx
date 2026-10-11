import React from 'react';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed top-20 left-1/2 -translate-x-1/2 z-[90] px-4 py-2 bg-amber-600 text-white text-xs font-black uppercase tracking-wider rounded-2xl shadow-xl flex items-center gap-2 border border-amber-500 animate-pulse"
    >
      <WifiOff className="w-4 h-4" />
      <span>You are currently offline. Cached data is available.</span>
    </div>
  );
};
