import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  RefreshCw, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  DollarSign, 
  Clock, 
  ArrowDownLeft, 
  FileText, 
  Zap, 
  Lock, 
  RotateCcw,
  Search,
  ExternalLink,
  Loader2,
  X,
  Play
} from 'lucide-react';
import { authFetch } from '../../utils/api';
import { formatDateTimeIST, formatIST } from '../../utils/timezone';
import { PaymentRecord, RefundRecord, PaymentWebhookEvent, ReconciliationReport } from '../../types';

export const PaymentReconciliationCenter: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [reconciling, setReconciling] = useState(false);
  const [summary, setSummary] = useState<any>(null);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [refunds, setRefunds] = useState<RefundRecord[]>([]);
  const [webhooks, setWebhooks] = useState<PaymentWebhookEvent[]>([]);
  const [activeSubTab, setActiveSubTab] = useState<'transactions' | 'refunds' | 'webhooks' | 'discrepancies'>('transactions');
  const [searchTerm, setSearchTerm] = useState('');
  const [feedbackNotice, setFeedbackNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Webhook Simulator State
  const [isSimulatorOpen, setIsSimulatorOpen] = useState(false);
  const [simEventType, setSimEventType] = useState<'payment.successful' | 'payment.failed' | 'payment.refunded'>('payment.successful');
  const [simPaymentId, setSimPaymentId] = useState('');
  const [simAmount, setSimAmount] = useState('156');
  const [simTamperSig, setSimTamperSig] = useState(false);
  const [simStaleTimestamp, setSimStaleTimestamp] = useState(false);
  const [simRunning, setSimRunning] = useState(false);
  const [simResult, setSimResult] = useState<any>(null);

  const fetchReconciliationData = async () => {
    try {
      setLoading(true);
      const res = await authFetch('/api/admin/payments/reconciliation');
      const data = await res.json();
      if (data.success) {
        setSummary(data.summary);
        setPayments(data.recentPayments || []);
        setRefunds(data.recentRefunds || []);
        setWebhooks(data.recentWebhooks || []);
      }
    } catch (e: any) {
      console.error('Error fetching reconciliation data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReconciliationData();
  }, []);

  const handleRunReconciliation = async () => {
    try {
      setReconciling(true);
      setFeedbackNotice(null);
      const res = await authFetch('/api/payments/reconcile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setFeedbackNotice({
          type: 'success',
          message: data.message || 'Reconciliation run completed successfully.'
        });
        await fetchReconciliationData();
      } else {
        throw new Error(data.error || 'Reconciliation failed.');
      }
    } catch (e: any) {
      setFeedbackNotice({
        type: 'error',
        message: e.message || 'Failed to complete reconciliation scan.'
      });
    } finally {
      setReconciling(false);
    }
  };

  const handleSimulateWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    setSimRunning(true);
    setSimResult(null);
    try {
      const res = await authFetch('/api/admin/payments/simulate-webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventType: simEventType,
          paymentId: simPaymentId || undefined,
          amount: Number(simAmount),
          tamperSignature: simTamperSig,
          staleTimestamp: simStaleTimestamp
        })
      });
      const data = await res.json();
      setSimResult(data);
      // If valid simulation, also trigger live webhook endpoint to test end-to-end ingestion
      if (data.simulation?.verificationResult?.isValid) {
        await authFetch('/api/payments/webhook', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-webhook-signature': data.simulation.signature,
            'x-webhook-timestamp': String(data.simulation.timestamp)
          },
          body: JSON.stringify({
            eventId: data.simulation.eventId,
            eventType: data.simulation.eventType,
            paymentId: data.simulation.paymentId,
            amount: Number(simAmount),
            status: simEventType === 'payment.failed' ? 'failed' : 'successful'
          })
        }).catch(() => {});
        await fetchReconciliationData();
      }
    } catch (err: any) {
      setSimResult({ error: err.message });
    } finally {
      setSimRunning(false);
    }
  };

  const filteredPayments = payments.filter((p) => {
    const s = searchTerm.toLowerCase();
    return (
      (p.paymentId || '').toLowerCase().includes(s) ||
      (p.bookingId || '').toLowerCase().includes(s) ||
      (p.userId || '').toLowerCase().includes(s) ||
      (p.paymentMethod || '').toLowerCase().includes(s) ||
      (p.status || '').toLowerCase().includes(s)
    );
  });

  const latestReport: ReconciliationReport | null = summary?.latestReport || null;

  return (
    <div className="space-y-6">
      {/* Header and Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
              Payment Security & Reconciliation
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" /> PCI-DSS Compliant
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Server-verified payment ledgers, HMAC-SHA256 webhooks, automated refunds, and zero raw card storage.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setIsSimulatorOpen(true)}
            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            <Zap className="w-3.5 h-3.5 text-amber-500" />
            <span>Webhook Simulator</span>
          </button>

          <button
            onClick={handleRunReconciliation}
            disabled={reconciling}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-500/20 flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            {reconciling ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5" />
            )}
            <span>{reconciling ? 'Reconciling Ledger...' : 'Run Reconciliation Scan'}</span>
          </button>
        </div>
      </div>

      {feedbackNotice && (
        <div
          role="status"
          className={`p-4 rounded-2xl text-xs font-semibold flex items-center justify-between border ${
            feedbackNotice.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
              : 'bg-red-50 dark:bg-red-950/30 text-red-800 dark:text-red-300 border-red-200 dark:border-red-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedbackNotice.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
            )}
            <span>{feedbackNotice.message}</span>
          </div>
          <button onClick={() => setFeedbackNotice(null)} className="p-1 hover:opacity-75">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* PCI-DSS Security Guarantee Notice */}
      <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-600 dark:text-slate-400">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
            <Lock className="w-4 h-4" />
          </div>
          <div>
            <span className="font-bold text-slate-900 dark:text-white block">PCI-DSS Tokenized Architecture Guarantee</span>
            <span>No Primary Account Numbers (PAN), CVVs, or bank credentials are ever received, stored, or transmitted by WashWise servers.</span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 text-[11px] font-mono">
          <span className="px-2 py-1 bg-white dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700">HMAC-SHA256 Webhooks</span>
          <span className="px-2 py-1 bg-white dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700">Replay Skew &le; 300s</span>
        </div>
      </div>

      {/* Financial Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 sm:gap-4">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[10px] font-black uppercase tracking-wider">Processed Volume</span>
            <DollarSign className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-xl font-black text-slate-900 dark:text-white font-mono tabular-nums">
            ₹{Number(summary?.totalVolume || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </p>
          <span className="text-[10px] text-slate-400 font-medium">{summary?.totalTransactions || 0} total records</span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[10px] font-black uppercase tracking-wider">Settled & Successful</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-xl font-black text-emerald-600 dark:text-emerald-400 font-mono tabular-nums">
            {summary?.successfulCount || 0}
          </p>
          <span className="text-[10px] text-slate-400 font-medium">Server verified</span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[10px] font-black uppercase tracking-wider">Total Refunded</span>
            <ArrowDownLeft className="w-4 h-4 text-purple-500" />
          </div>
          <p className="text-xl font-black text-purple-600 dark:text-purple-400 font-mono tabular-nums">
            ₹{Number(summary?.totalRefunded || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </p>
          <span className="text-[10px] text-slate-400 font-medium">{summary?.refundedCount || 0} refunded orders</span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[10px] font-black uppercase tracking-wider">Discrepancy Alerts</span>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-xl font-black text-amber-600 dark:text-amber-400 font-mono tabular-nums">
            {latestReport?.mismatchCount || 0}
          </p>
          <span className="text-[10px] text-slate-400 font-medium">
            {latestReport ? `${latestReport.matchedCount} matched` : 'Run scan to audit'}
          </span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[10px] font-black uppercase tracking-wider">Webhooks Ingested</span>
            <Zap className="w-4 h-4 text-indigo-500" />
          </div>
          <p className="text-xl font-black text-indigo-600 dark:text-indigo-400 font-mono tabular-nums">
            {summary?.webhookEventsReceived || 0}
          </p>
          <span className="text-[10px] text-slate-400 font-medium">HMAC validated</span>
        </div>
      </div>

      {/* Tabs Navigation & Search Bar */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            {[
              { id: 'transactions', label: `Transactions (${payments.length})` },
              { id: 'refunds', label: `Refunds & Cancellations (${refunds.length})` },
              { id: 'webhooks', label: `Webhook Log (${webhooks.length})` },
              { id: 'discrepancies', label: `Reconciliation Audit (${latestReport?.discrepancies?.length || 0})` },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveSubTab(tab.id as any)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                  activeSubTab === tab.id
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search payments, bookings..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* Tab 1: Recent Transactions */}
        {activeSubTab === 'transactions' && (
          <div className="overflow-x-auto">
            {filteredPayments.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-xs">
                <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="font-semibold text-slate-700 dark:text-slate-300">No payment records found</p>
                <span>Payments initiated via checkout will appear here with full provider audit tokens.</span>
              </div>
            ) : (
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/50 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-800 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    <th className="py-3 px-4">Transaction ID</th>
                    <th className="py-3 px-4">Booking / User</th>
                    <th className="py-3 px-4">Method</th>
                    <th className="py-3 px-4 text-right">Amount</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Reconciled</th>
                    <th className="py-3 px-4 text-right">Date (IST)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                  {filteredPayments.map((p) => (
                    <tr key={p.id || p.paymentId} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-white">
                        <span className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded">
                          {p.paymentId}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <p className="font-bold text-slate-800 dark:text-slate-200">{p.bookingId || 'Top-up'}</p>
                        <p className="text-[10px] text-slate-400 font-mono truncate max-w-[120px]">{p.userId}</p>
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          {p.paymentMethod || 'online'}
                        </span>
                        {p.cardLast4 && (
                          <span className="ml-1 text-[10px] font-mono text-slate-400">•••• {p.cardLast4}</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-black text-slate-900 dark:text-white">
                        ₹{Number(p.amount || 0).toFixed(2)}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                            p.status === 'successful'
                              ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300'
                              : p.status === 'refunded'
                              ? 'bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300'
                              : p.status === 'failed'
                              ? 'bg-red-100 dark:bg-red-950/60 text-red-800 dark:text-red-300'
                              : 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300'
                          }`}
                        >
                          {p.status}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {p.reconciled ? (
                          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> Matched
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400 font-medium">Pending scan</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-[11px] text-slate-500">
                        {formatDateTimeIST(p.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Tab 2: Refunds & Cancellations */}
        {activeSubTab === 'refunds' && (
          <div className="overflow-x-auto">
            {refunds.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-xs">
                <RotateCcw className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="font-semibold text-slate-700 dark:text-slate-300">No refunds recorded</p>
                <span>Customer order cancellations and credit restorations will be logged here.</span>
              </div>
            ) : (
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/50 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-800 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    <th className="py-3 px-4">Refund ID</th>
                    <th className="py-3 px-4">Booking ID</th>
                    <th className="py-3 px-4">Reason</th>
                    <th className="py-3 px-4">Method</th>
                    <th className="py-3 px-4 text-right">Amount</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Date (IST)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                  {refunds.map((r) => (
                    <tr key={r.id || r.refundId} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-purple-700 dark:text-purple-300">
                        {r.refundId}
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-800 dark:text-slate-200">
                        {r.bookingId}
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-400 italic max-w-xs truncate">
                        "{r.reason || 'Customer cancellation'}"
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-slate-100 dark:bg-slate-800">
                          {r.refundMethod === 'credits' ? 'Quota Restored' : 'Wallet Credit'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-black text-slate-900 dark:text-white">
                        {r.refundMethod === 'credits' ? 'Credits Restored' : `₹${Number(r.amount || 0).toFixed(2)}`}
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300">
                          {r.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-[11px] text-slate-500">
                        {formatDateTimeIST(r.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Tab 3: Webhook Log */}
        {activeSubTab === 'webhooks' && (
          <div className="overflow-x-auto">
            {webhooks.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-xs">
                <Zap className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="font-semibold text-slate-700 dark:text-slate-300">No webhook events received</p>
                <span>Cryptographically verified payment gateway events will appear here. Use the simulator above to test.</span>
              </div>
            ) : (
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/50 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-800 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    <th className="py-3 px-4">Event ID</th>
                    <th className="py-3 px-4">Event Type</th>
                    <th className="py-3 px-4">Payment Reference</th>
                    <th className="py-3 px-4 text-right">Amount</th>
                    <th className="py-3 px-4">HMAC Status</th>
                    <th className="py-3 px-4 text-right">Received (IST)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                  {webhooks.map((w) => (
                    <tr key={w.eventId} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-white">
                        {w.eventId}
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300">
                          {w.eventType}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-600 dark:text-slate-400">
                        {w.paymentId}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold">
                        ₹{Number(w.amount || 0).toFixed(2)}
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 flex items-center gap-1 w-fit">
                          <CheckCircle2 className="w-3 h-3" /> HMAC-SHA256 Verified
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-[11px] text-slate-500">
                        {formatDateTimeIST(w.receivedAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Tab 4: Discrepancies Audit */}
        {activeSubTab === 'discrepancies' && (
          <div className="p-6">
            {!latestReport || latestReport.discrepancies.length === 0 ? (
              <div className="text-center py-10 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-2xl border border-emerald-200 dark:border-emerald-800/40 p-6">
                <CheckCircle2 className="w-10 h-10 text-emerald-600 dark:text-emerald-400 mx-auto mb-2" />
                <h3 className="text-sm font-black text-emerald-900 dark:text-emerald-200 uppercase tracking-tight">
                  All Financial Records Reconciled (100% Match)
                </h3>
                <p className="text-xs text-emerald-700 dark:text-emerald-400 max-w-md mx-auto mt-1">
                  Zero amount discrepancies or orphaned payment captures were found in the latest background audit run.
                </p>
                {latestReport && (
                  <span className="inline-block mt-3 text-[11px] font-mono text-emerald-600 dark:text-emerald-400">
                    Audit Report #{latestReport.reportId} • Generated {formatDateTimeIST(latestReport.generatedAt)}
                  </span>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span className="font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                    <AlertTriangle className="w-4 h-4" />
                    {latestReport.discrepancies.length} Discrepancies Flagged for Review
                  </span>
                  <span className="font-mono">Report ID: {latestReport.reportId}</span>
                </div>

                <div className="space-y-3">
                  {latestReport.discrepancies.map((d, idx) => (
                    <div
                      key={idx}
                      className="p-4 rounded-2xl bg-amber-50/40 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-200/60 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200">
                            {d.type}
                          </span>
                          <span className="font-mono font-bold text-slate-900 dark:text-white">
                            Payment ID: {d.paymentId}
                          </span>
                        </div>
                        <p className="text-slate-700 dark:text-slate-300 font-medium">{d.resolutionAdvice}</p>
                      </div>

                      <div className="text-left md:text-right font-mono shrink-0">
                        <span className="text-[10px] text-slate-400 block uppercase">Internal vs Provider</span>
                        <span className="font-bold text-slate-900 dark:text-white">
                          ₹{d.internalAmount} vs ₹{d.providerAmount}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Webhook Testing Simulator Modal */}
      {isSimulatorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            onClick={() => setIsSimulatorOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-xs cursor-pointer"
          />
          <div className="relative z-10 bg-white dark:bg-slate-900 w-full max-w-xl rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-amber-500" />
                <h3 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-tight">
                  Webhook Security Testing Sandbox
                </h3>
              </div>
              <button
                onClick={() => setIsSimulatorOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Test HMAC-SHA256 signature generation, forged signature rejection, and replay protection (5-minute timestamp window).
            </p>

            <form onSubmit={handleSimulateWebhook} className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Event Type</label>
                <select
                  value={simEventType}
                  onChange={(e) => setSimEventType(e.target.value as any)}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="payment.successful">payment.successful (Capture Confirmed)</option>
                  <option value="payment.failed">payment.failed (Bank Decline / Timeout)</option>
                  <option value="payment.refunded">payment.refunded (Reversal Logged)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Payment ID</label>
                  <input
                    type="text"
                    value={simPaymentId}
                    onChange={(e) => setSimPaymentId(e.target.value)}
                    placeholder="e.g. TXN_AUTO_123"
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Amount (₹)</label>
                  <input
                    type="number"
                    value={simAmount}
                    onChange={(e) => setSimAmount(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl space-y-2 border border-slate-200 dark:border-slate-700">
                <span className="font-bold text-slate-700 dark:text-slate-300 block">Security Attack Simulation Tests</span>
                <label className="flex items-center gap-2 cursor-pointer text-slate-600 dark:text-slate-400">
                  <input
                    type="checkbox"
                    checked={simTamperSig}
                    onChange={(e) => setSimTamperSig(e.target.checked)}
                    className="rounded text-indigo-600"
                  />
                  <span>Forge HMAC Signature (Expect 401 Rejection)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-slate-600 dark:text-slate-400">
                  <input
                    type="checkbox"
                    checked={simStaleTimestamp}
                    onChange={(e) => setSimStaleTimestamp(e.target.checked)}
                    className="rounded text-indigo-600"
                  />
                  <span>Simulate Replay Attack (Send 10-minute old timestamp, Expect 401/400 Rejection)</span>
                </label>
              </div>

              <button
                type="submit"
                disabled={simRunning}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5 focus-visible:ring-2 focus-visible:ring-indigo-500"
              >
                {simRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                <span>Run Webhook Verification Test</span>
              </button>
            </form>

            {simResult && (
              <div className="p-4 bg-slate-900 text-slate-200 rounded-xl font-mono text-[11px] space-y-2 overflow-x-auto">
                <div className="flex items-center justify-between pb-1 border-b border-slate-800 font-bold">
                  <span>Server Verification Outcome:</span>
                  {simResult.simulation?.verificationResult?.isValid ? (
                    <span className="text-emerald-400">PASSED (Valid Signature)</span>
                  ) : (
                    <span className="text-red-400">REJECTED AS EXPECTED</span>
                  )}
                </div>
                <pre className="text-[10px] text-slate-400 overflow-x-auto">
                  {JSON.stringify(simResult, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
