import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ShieldAlert, 
  ShieldCheck, 
  AlertTriangle, 
  Lock, 
  Unlock, 
  UserX, 
  UserCheck, 
  RefreshCw, 
  Sliders, 
  Search, 
  Filter, 
  Ban, 
  CheckCircle2, 
  Clock, 
  Zap, 
  DollarSign, 
  Calendar, 
  Tag, 
  ChevronRight,
  Activity,
  Layers
} from 'lucide-react';
import { authFetch } from '../utils/api';
import { RiskLog, RiskSettings, User as AppUser } from '../types';

interface FraudRiskCenterProps {
  onRefreshStats?: () => void;
}

export const FraudRiskCenter: React.FC<FraudRiskCenterProps> = ({ onRefreshStats }) => {
  const [activeSubTab, setActiveSubTab] = useState<'stream' | 'watchlist' | 'controls'>('stream');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [overview, setOverview] = useState<{
    systemStatus: string;
    totalIncidents: number;
    incidents24h: number;
    highSeverityCount: number;
    blockedCount: number;
    flaggedUsersCount: number;
    suspendedUsersCount: number;
    flaggedUsers: any[];
    recentLogs: RiskLog[];
  } | null>(null);

  const [logs, setLogs] = useState<RiskLog[]>([]);
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Risk Controls State
  const [riskSettings, setRiskSettings] = useState<RiskSettings>({
    maxDailyBookingsPerUser: 3,
    maxActiveCodBookings: 2,
    maxSingleWalletTopup: 5000,
    maxDailyWalletTopup: 15000,
    promoAttemptLimit: 5,
    enforceIpReferralCheck: true,
    autoBlockHighRisk: false
  });
  const [savingSettings, setSavingSettings] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [notificationMsg, setNotificationMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchData = async () => {
    try {
      setRefreshing(true);
      const [overviewRes, logsRes, settingsRes] = await Promise.all([
        authFetch('/api/admin/risk/overview'),
        authFetch('/api/admin/risk/logs?limit=100'),
        authFetch('/api/admin/risk/settings')
      ]);

      if (overviewRes.ok) {
        const data = await overviewRes.json();
        setOverview(data);
      }
      if (logsRes.ok) {
        const data = await logsRes.json();
        setLogs(data.logs || []);
      }
      if (settingsRes.ok) {
        const data = await settingsRes.json();
        if (data.settings) {
          setRiskSettings(data.settings);
        }
      }
    } catch (err) {
      console.error('Error fetching fraud risk data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const showNotification = (type: 'success' | 'error', text: string) => {
    setNotificationMsg({ type, text });
    setTimeout(() => setNotificationMsg(null), 4000);
  };

  const handleUserAction = async (targetUserId: string, action: 'suspend' | 'unsuspend' | 'clear_flags', reason?: string) => {
    try {
      setActionLoadingId(targetUserId);
      const res = await authFetch('/api/admin/risk/user-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId, action, reason })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update user');
      }

      showNotification('success', `User successfully ${action === 'suspend' ? 'suspended' : action === 'unsuspend' ? 'reinstated' : 'cleared'}.`);
      await fetchData();
      if (onRefreshStats) onRefreshStats();
    } catch (err: any) {
      showNotification('error', err.message || 'Action failed');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSavingSettings(true);
      const res = await authFetch('/api/admin/risk/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: riskSettings })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save settings');
      showNotification('success', 'Fraud and risk defense thresholds updated.');
    } catch (err: any) {
      showNotification('error', err.message || 'Failed to update settings');
    } finally {
      setSavingSettings(false);
    }
  };

  const filteredLogs = logs.filter(log => {
    if (severityFilter !== 'all' && log.severity !== severityFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchType = log.riskType?.toLowerCase().includes(q);
      const matchEmail = log.userEmail?.toLowerCase().includes(q);
      const matchDetails = log.details?.toLowerCase().includes(q);
      const matchIp = log.ipAddress?.toLowerCase().includes(q);
      return matchType || matchEmail || matchDetails || matchIp;
    }
    return true;
  });

  const getSeverityBadgeClass = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-500/10 text-red-500 border-red-500/30';
      case 'high':
        return 'bg-rose-500/10 text-rose-500 border-rose-500/30';
      case 'medium':
        return 'bg-amber-500/10 text-amber-500 border-amber-500/30';
      case 'low':
      default:
        return 'bg-blue-500/10 text-blue-500 border-blue-500/30';
    }
  };

  const getActionBadgeClass = (action: string) => {
    switch (action) {
      case 'blocked':
        return 'bg-red-500 text-white';
      case 'flagged':
        return 'bg-amber-500 text-white';
      default:
        return 'bg-gray-600 text-white';
    }
  };

  const formatRiskTypeName = (type: string) => {
    switch (type) {
      case 'HIGH_BOOKING_VELOCITY': return 'Booking Velocity Hoarding';
      case 'EXCESSIVE_COD_ORDERS': return 'Unpaid COD Slot Hoarding';
      case 'PROMO_BRUTE_FORCE': return 'Promo Brute Force Enumeration';
      case 'SUSPICIOUS_TOPUP': return 'Excessive Wallet Top-Up Attempt';
      case 'SUSPENDED_ACCOUNT_ATTEMPT': return 'Suspended Account Activity';
      case 'REFERRAL_RING_DETECTED': return 'Referral Collusion Ring';
      case 'TAMPERED_CLIENT_PRICE': return 'Manipulated Pricing Attempt';
      case 'ADMIN_ACTION_SUSPEND': return 'Admin Suspension';
      case 'ADMIN_ACTION_UNSUSPEND': return 'Admin Reinstatement';
      default: return type.replace(/_/g, ' ');
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      <AnimatePresence>
        {notificationMsg && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`p-3.5 rounded-xl border text-sm font-semibold flex items-center justify-between shadow-lg ${
              notificationMsg.type === 'success' 
                ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-500/30 text-emerald-800 dark:text-emerald-200' 
                : 'bg-red-50 dark:bg-red-950/60 border-red-500/30 text-red-800 dark:text-red-200'
            }`}
          >
            <div className="flex items-center gap-2">
              {notificationMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <AlertTriangle className="w-4 h-4 text-red-500" />}
              <span>{notificationMsg.text}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Shield Header & Status */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-6 shadow-xl border border-indigo-900/50">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-7 h-7 text-indigo-400" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-xl font-bold tracking-tight">Fraud and Risk Protection Engine</h2>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold tracking-wide uppercase flex items-center gap-1.5 ${
                  overview?.systemStatus === 'Elevated' 
                    ? 'bg-red-500/20 text-red-300 border border-red-500/40' 
                    : overview?.systemStatus === 'Guarded' 
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' 
                    : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                }`}>
                  <span className="w-2 h-2 rounded-full bg-current animate-pulse"></span>
                  Status: {overview?.systemStatus || 'Optimal'}
                </span>
              </div>
              <p className="text-sm text-indigo-200/80 mt-1">
                Authoritative server defense protecting against machine slot hoarding, unpaid COD abuse, promo enumeration, and wallet manipulation.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={fetchData}
              disabled={refreshing}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold transition-all border border-white/10 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh Radar
            </button>
          </div>
        </div>

        {/* Real-time Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 mt-6 pt-6 border-t border-indigo-800/40">
          <div className="bg-white/5 rounded-xl p-3.5 border border-white/10">
            <div className="text-xs text-indigo-300 font-medium">Blocked Attacks</div>
            <div className="text-2xl font-black text-white mt-1">{overview?.blockedCount ?? 0}</div>
            <div className="text-[11px] text-indigo-200/60 mt-0.5">Automated interceptions</div>
          </div>

          <div className="bg-white/5 rounded-xl p-3.5 border border-white/10">
            <div className="text-xs text-indigo-300 font-medium">Triggers (24 Hours)</div>
            <div className="text-2xl font-black text-amber-300 mt-1">{overview?.incidents24h ?? 0}</div>
            <div className="text-[11px] text-indigo-200/60 mt-0.5">Velocity and promo alerts</div>
          </div>

          <div className="bg-white/5 rounded-xl p-3.5 border border-white/10">
            <div className="text-xs text-indigo-300 font-medium">High Severity Incidents</div>
            <div className="text-2xl font-black text-rose-400 mt-1">{overview?.highSeverityCount ?? 0}</div>
            <div className="text-[11px] text-indigo-200/60 mt-0.5">Requiring review</div>
          </div>

          <div className="bg-white/5 rounded-xl p-3.5 border border-white/10">
            <div className="text-xs text-indigo-300 font-medium">Suspended Accounts</div>
            <div className="text-2xl font-black text-red-300 mt-1">{overview?.suspendedUsersCount ?? 0}</div>
            <div className="text-[11px] text-indigo-200/60 mt-0.5">Security freezes active</div>
          </div>
        </div>
      </div>

      {/* Sub-Navigation Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-800 gap-1 overflow-x-auto pb-px">
        <button
          onClick={() => setActiveSubTab('stream')}
          className={`flex items-center gap-2 px-4 py-2.5 font-semibold text-sm border-b-2 whitespace-nowrap transition-colors ${
            activeSubTab === 'stream'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
          }`}
        >
          <Activity className="w-4 h-4" />
          Incident Log Stream ({filteredLogs.length})
        </button>

        <button
          onClick={() => setActiveSubTab('watchlist')}
          className={`flex items-center gap-2 px-4 py-2.5 font-semibold text-sm border-b-2 whitespace-nowrap transition-colors ${
            activeSubTab === 'watchlist'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
          }`}
        >
          <ShieldAlert className="w-4 h-4" />
          Flagged Users ({overview?.flaggedUsers?.length || 0})
        </button>

        <button
          onClick={() => setActiveSubTab('controls')}
          className={`flex items-center gap-2 px-4 py-2.5 font-semibold text-sm border-b-2 whitespace-nowrap transition-colors ${
            activeSubTab === 'controls'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
          }`}
        >
          <Sliders className="w-4 h-4" />
          Defense Rules & Thresholds
        </button>
      </div>

      {/* TAB 1: INCIDENT LOG STREAM */}
      {activeSubTab === 'stream' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between bg-white dark:bg-gray-800/80 p-3.5 rounded-xl border border-gray-200 dark:border-gray-700">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by user, IP, or rule trigger..."
                className="w-full pl-9 pr-4 py-2 text-xs rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Severity:</span>
              <select
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value)}
                className="px-3 py-2 text-xs rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="all">All Severities</option>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
          </div>

          {/* Incident List */}
          {filteredLogs.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-xl p-12 text-center border border-gray-200 dark:border-gray-700">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3 opacity-80" />
              <h3 className="text-base font-bold text-gray-900 dark:text-white">Zero High-Risk Incidents Found</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-sm mx-auto">
                No active threats matching your filter criteria. The automated defense engine is actively screening all incoming requests.
              </p>
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden divide-y divide-gray-100 dark:divide-gray-700/60 shadow-sm">
              {filteredLogs.map((log, idx) => (
                <div key={log.id || idx} className="p-4 hover:bg-gray-50/70 dark:hover:bg-gray-700/30 transition-colors">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wider border ${getSeverityBadgeClass(log.severity)}`}>
                        {log.severity}
                      </span>
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${getActionBadgeClass(log.actionTaken)}`}>
                        {log.actionTaken}
                      </span>
                      <span className="font-bold text-xs text-gray-900 dark:text-white">
                        {formatRiskTypeName(log.riskType)}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 shrink-0">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{log.createdAt ? new Date(log.createdAt).toLocaleString() : 'Just now'}</span>
                    </div>
                  </div>

                  <p className="text-xs text-gray-700 dark:text-gray-300 mt-2 leading-relaxed">
                    {log.details}
                  </p>

                  <div className="flex flex-wrap items-center justify-between gap-3 mt-3 pt-2.5 border-t border-gray-100 dark:border-gray-700/40 text-[11px] text-gray-500 dark:text-gray-400">
                    <div className="flex items-center gap-4 flex-wrap">
                      {log.userEmail && (
                        <span>User: <strong className="text-gray-700 dark:text-gray-300">{log.userEmail}</strong></span>
                      )}
                      <span>IP: <code className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-900 font-mono text-[10px] text-gray-700 dark:text-gray-300">{log.ipAddress || 'unknown'}</code></span>
                    </div>

                    {log.userId && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleUserAction(log.userId!, 'suspend', `Suspended due to ${log.riskType}`)}
                          disabled={actionLoadingId === log.userId}
                          className="px-2.5 py-1 text-[11px] font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 dark:hover:bg-rose-900/50 rounded-lg transition-colors border border-rose-200 dark:border-rose-900"
                        >
                          Suspend User
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: SUSPICIOUS ACCOUNTS WATCHLIST */}
      {activeSubTab === 'watchlist' && (
        <div className="space-y-4">
          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-xl p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-900 dark:text-amber-200 leading-relaxed">
              <strong>Account Risk Scoring</strong>: Accounts flagged with elevated risk scores have triggered repeated security rules (e.g., booking velocity abuse, repeated promo enumeration, or unpaid COD order limits). Suspended accounts are barred from placing bookings or topping up wallets.
            </div>
          </div>

          {(!overview?.flaggedUsers || overview.flaggedUsers.length === 0) ? (
            <div className="bg-white dark:bg-gray-800 rounded-xl p-12 text-center border border-gray-200 dark:border-gray-700">
              <ShieldCheck className="w-12 h-12 text-emerald-500 mx-auto mb-3 opacity-80" />
              <h3 className="text-base font-bold text-gray-900 dark:text-white">No Accounts Currently Flagged</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-sm mx-auto">
                All registered campus members have a clean risk rating. Any suspicious activity will immediately be flagged here for investigation.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {overview.flaggedUsers.map(user => (
                <div key={user.uid} className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col justify-between">
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-sm text-gray-900 dark:text-white">{user.name || 'Unnamed User'}</h4>
                          {user.isSuspended && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700 dark:bg-red-950/80 dark:text-red-300 border border-red-200 dark:border-red-800">
                              Suspended
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{user.email}</p>
                      </div>

                      <div className="text-right">
                        <div className="text-xs font-semibold text-gray-500 dark:text-gray-400">Risk Score</div>
                        <div className={`text-lg font-black ${
                          user.riskScore >= 70 ? 'text-red-500' : user.riskScore >= 40 ? 'text-amber-500' : 'text-blue-500'
                        }`}>
                          {user.riskScore}/100
                        </div>
                      </div>
                    </div>

                    {user.riskFlags && user.riskFlags.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {user.riskFlags.map((flag: string, fIdx: number) => (
                          <span key={fIdx} className="px-2 py-0.5 rounded-md bg-gray-100 dark:bg-gray-900 text-[10px] font-semibold text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700">
                            {formatRiskTypeName(flag)}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-700 flex items-center justify-end gap-2">
                    <button
                      onClick={() => handleUserAction(user.uid, 'clear_flags')}
                      disabled={actionLoadingId === user.uid}
                      className="px-3 py-1.5 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    >
                      Reset Score
                    </button>

                    {user.isSuspended ? (
                      <button
                        onClick={() => handleUserAction(user.uid, 'unsuspend')}
                        disabled={actionLoadingId === user.uid}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 rounded-lg transition-colors border border-emerald-300 dark:border-emerald-800"
                      >
                        <Unlock className="w-3.5 h-3.5" />
                        Reinstate Account
                      </button>
                    ) : (
                      <button
                        onClick={() => handleUserAction(user.uid, 'suspend', 'Suspended by Administrator')}
                        disabled={actionLoadingId === user.uid}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/60 hover:bg-red-100 dark:hover:bg-red-900/60 rounded-lg transition-colors border border-red-300 dark:border-red-800"
                      >
                        <Ban className="w-3.5 h-3.5" />
                        Freeze Account
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: DEFENSE RULES & CONTROLS */}
      {activeSubTab === 'controls' && (
        <form onSubmit={handleSaveSettings} className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm space-y-6">
          <div>
            <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Sliders className="w-5 h-5 text-indigo-500" />
              Automated Fraud Defense Thresholds
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Tune dynamic safety limits to protect campus fleet capacity, prevent coupon dictionary attacks, and enforce payment limits.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Control 1: Max Daily Bookings */}
            <div className="space-y-1.5 p-4 rounded-xl bg-gray-50 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-700/60">
              <label className="text-xs font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-indigo-500" />
                Max Daily Bookings Per Student
              </label>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">
                Prevents slot hoarding by single accounts on peak laundry days.
              </p>
              <input
                type="number"
                min="1"
                max="10"
                value={riskSettings.maxDailyBookingsPerUser}
                onChange={(e) => setRiskSettings({ ...riskSettings, maxDailyBookingsPerUser: Number(e.target.value) })}
                className="w-full mt-2 px-3.5 py-2 text-xs rounded-lg bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            {/* Control 2: Max Active COD Bookings */}
            <div className="space-y-1.5 p-4 rounded-xl bg-gray-50 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-700/60">
              <label className="text-xs font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-amber-500" />
                Max Active Pay-at-Store / COD Bookings
              </label>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">
                Limits how many unpaid orders a student can have active simultaneously.
              </p>
              <input
                type="number"
                min="1"
                max="5"
                value={riskSettings.maxActiveCodBookings}
                onChange={(e) => setRiskSettings({ ...riskSettings, maxActiveCodBookings: Number(e.target.value) })}
                className="w-full mt-2 px-3.5 py-2 text-xs rounded-lg bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            {/* Control 3: Max Single Wallet Top-Up */}
            <div className="space-y-1.5 p-4 rounded-xl bg-gray-50 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-700/60">
              <label className="text-xs font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                <DollarSign className="w-4 h-4 text-emerald-500" />
                Max Single Wallet Top-Up (INR)
              </label>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">
                Ceiling limit per single wallet load to mitigate card fraud exposure.
              </p>
              <input
                type="number"
                min="500"
                max="25000"
                step="500"
                value={riskSettings.maxSingleWalletTopup}
                onChange={(e) => setRiskSettings({ ...riskSettings, maxSingleWalletTopup: Number(e.target.value) })}
                className="w-full mt-2 px-3.5 py-2 text-xs rounded-lg bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            {/* Control 4: Max Daily Cumulative Wallet Top-Up */}
            <div className="space-y-1.5 p-4 rounded-xl bg-gray-50 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-700/60">
              <label className="text-xs font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                <DollarSign className="w-4 h-4 text-emerald-500" />
                Max Daily Cumulative Top-Up (INR)
              </label>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">
                Total wallet top-up velocity ceiling allowed per user in 24 hours.
              </p>
              <input
                type="number"
                min="1000"
                max="50000"
                step="1000"
                value={riskSettings.maxDailyWalletTopup}
                onChange={(e) => setRiskSettings({ ...riskSettings, maxDailyWalletTopup: Number(e.target.value) })}
                className="w-full mt-2 px-3.5 py-2 text-xs rounded-lg bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            {/* Control 5: Promo Code Failure Lockout */}
            <div className="space-y-1.5 p-4 rounded-xl bg-gray-50 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-700/60">
              <label className="text-xs font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                <Tag className="w-4 h-4 text-purple-500" />
                Failed Promo Attempts Before 15-Min Lockout
              </label>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">
                Mitigates coupon brute-force guessing and enumeration scripts.
              </p>
              <input
                type="number"
                min="3"
                max="10"
                value={riskSettings.promoAttemptLimit}
                onChange={(e) => setRiskSettings({ ...riskSettings, promoAttemptLimit: Number(e.target.value) })}
                className="w-full mt-2 px-3.5 py-2 text-xs rounded-lg bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            {/* Control 6: IP Referral Check */}
            <div className="space-y-1.5 p-4 rounded-xl bg-gray-50 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-700/60 flex flex-col justify-between">
              <div>
                <label className="text-xs font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-indigo-500" />
                  Referral Ring & IP Collision Detection
                </label>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                  Automatically flags bonus abuse when referrals originate from the exact same device/IP network.
                </p>
              </div>
              <label className="flex items-center gap-2.5 mt-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={riskSettings.enforceIpReferralCheck}
                  onChange={(e) => setRiskSettings({ ...riskSettings, enforceIpReferralCheck: e.target.checked })}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                />
                <span className="text-xs font-semibold text-gray-800 dark:text-gray-200">
                  Enable Referral Ring Screening
                </span>
              </label>
            </div>
          </div>

          <div className="pt-4 border-t border-gray-200 dark:border-gray-700 flex justify-end">
            <button
              type="submit"
              disabled={savingSettings}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-md hover:shadow-lg disabled:opacity-50"
            >
              {savingSettings ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
              Save Risk Protection Rules
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
export default FraudRiskCenter;
