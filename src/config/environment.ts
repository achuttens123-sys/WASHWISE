/**
 * WashWise Environment Configuration
 * Provides strict environment separation for development, staging, and production.
 */

export type AppEnvironment = 'development' | 'staging' | 'production';

export interface EnvironmentConfig {
  env: AppEnvironment;
  isProduction: boolean;
  isDevelopment: boolean;
  databaseId: string;
  appTitle: string;
  apiBaseUrl: string;
  idempotencyTtlSeconds: number;
  backupConfig: {
    automatedDaily: boolean;
    retentionDays: number;
    scheduleDescription: string;
    targetCollections: string[];
  };
  security: {
    enforceStrictConstraints: boolean;
    requireVerificationForBooking: boolean;
    maxFailedLoginsBeforeLockout: number;
    lockoutDurationSeconds: number;
  };
}

const getEnvironment = (): AppEnvironment => {
  // Check Vite client-side mode
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    if (import.meta.env.MODE === 'production' || import.meta.env.VITE_APP_ENV === 'production') {
      return 'production';
    }
    if (import.meta.env.MODE === 'staging' || import.meta.env.VITE_APP_ENV === 'staging') {
      return 'staging';
    }
    return 'development';
  }

  // Node server-side environment
  if (typeof process !== 'undefined' && process.env) {
    if (process.env.NODE_ENV === 'production' || process.env.APP_ENV === 'production') {
      return 'production';
    }
    if (process.env.APP_ENV === 'staging') {
      return 'staging';
    }
  }

  return 'development';
};

const currentEnv = getEnvironment();

export const ENV_CONFIG: EnvironmentConfig = {
  env: currentEnv,
  isProduction: currentEnv === 'production',
  isDevelopment: currentEnv === 'development',
  databaseId: 'ai-studio-6b5b095e-68c1-470b-9128-f13836f9ab93',
  appTitle: currentEnv === 'production' ? 'WashWise' : `WashWise [${currentEnv.toUpperCase()}]`,
  apiBaseUrl: '',
  idempotencyTtlSeconds: 86400, // 24 hours
  backupConfig: {
    automatedDaily: true,
    retentionDays: 30,
    scheduleDescription: 'Daily snapshot at 02:00 UTC',
    targetCollections: [
      'users',
      'bookings',
      'slots',
      'stores',
      'machines',
      'settings',
      'limited_offers',
      'wallet_transactions'
    ]
  },
  security: {
    enforceStrictConstraints: true,
    requireVerificationForBooking: true,
    maxFailedLoginsBeforeLockout: 5,
    lockoutDurationSeconds: 60
  }
};
