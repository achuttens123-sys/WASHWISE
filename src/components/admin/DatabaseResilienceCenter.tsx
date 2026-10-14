import React, { useState, useEffect } from 'react';
import { 
  Database, 
  HardDrive, 
  ShieldCheck, 
  RefreshCw, 
  Download, 
  Play, 
  RotateCcw, 
  CheckCircle2, 
  AlertTriangle, 
  Server, 
  Clock, 
  FileText, 
  Copy, 
  Check, 
  ArrowRight,
  Layers,
  Activity
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { authFetch } from '../../utils/api';
import { DatabaseBackup, SchemaMigration } from '../../types';
import { ENV_CONFIG } from '../../config/environment';

export const DatabaseResilienceCenter: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<'backups' | 'restoration' | 'migrations'>('backups');
  const [backups, setBackups] = useState<DatabaseBackup[]>([]);
  const [loadingBackups, setLoadingBackups] = useState(false);
  const [creatingBackup, setCreatingBackup] = useState(false);

  // Restoration test state
  const [testingRestoration, setTestingRestoration] = useState(false);
  const [restorationReport, setRestorationReport] = useState<any>(null);

  // Migrations state
  const [migrations, setMigrations] = useState<SchemaMigration[]>([]);
  const [loadingMigrations, setLoadingMigrations] = useState(false);
  const [runningMigration, setRunningMigration] = useState(false);
  const [rollingBack, setRollingBack] = useState(false);
  const [currentVersion, setCurrentVersion] = useState<number>(0);
  const [copiedChecksum, setCopiedChecksum] = useState<string | null>(null);

  const fetchBackups = async () => {
    setLoadingBackups(true);
    try {
      const res = await authFetch('/api/admin/backups');
      const data = await res.json();
      if (data.success && Array.isArray(data.backups)) {
        setBackups(data.backups);
      }
    } catch (err) {
      console.error('Error fetching backups:', err);
    } finally {
      setLoadingBackups(false);
    }
  };

  const fetchMigrations = async () => {
    setLoadingMigrations(true);
    try {
      const res = await authFetch('/api/admin/migrations/status');
      const data = await res.json();
      if (data.success) {
        setMigrations(data.migrations || []);
        setCurrentVersion(data.currentSchemaVersion || 0);
      }
    } catch (err) {
      console.error('Error fetching migrations:', err);
    } finally {
      setLoadingMigrations(false);
    }
  };

  useEffect(() => {
    fetchBackups();
    fetchMigrations();
  }, []);

  const handleCreateBackup = async () => {
    setCreatingBackup(true);
    try {
      const res = await authFetch('/api/admin/backups/create', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        toast.success(`Backup snapshot created successfully (${data.backup?.totalDocuments || 0} docs)`);
        fetchBackups();
      } else {
        toast.error(data.error || 'Failed to create backup snapshot');
      }
    } catch (err: any) {
      toast.error(err.message || 'Network error creating backup');
    } finally {
      setCreatingBackup(false);
    }
  };

  const handleRunRestorationTest = async (backupId?: string) => {
    setTestingRestoration(true);
    setRestorationReport(null);
    try {
      const res = await authFetch('/api/admin/backups/restore-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ backupId })
      });
      const data = await res.json();
      if (data.success) {
        setRestorationReport(data);
        toast.success(`Restoration test passed in ${data.executionTimeMs}ms! Zero violations found.`);
        fetchBackups();
      } else {
        toast.error(data.error || 'Restoration verification test failed');
      }
    } catch (err: any) {
      toast.error(err.message || 'Error running restoration test');
    } finally {
      setTestingRestoration(false);
    }
  };

  const handleRunMigrations = async (dryRun = false) => {
    setRunningMigration(true);
    try {
      const res = await authFetch('/api/admin/migrations/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dryRun })
      });
      const data = await res.json();
      if (data.success) {
        if (dryRun) {
          toast.success(`Pre-flight check passed: ${data.pendingCount} pending migrations validated.`);
        } else {
          toast.success(`Successfully applied ${data.executedCount} pending migration(s)!`);
          fetchMigrations();
        }
      } else {
        toast.error(data.error || 'Migration execution failed');
      }
    } catch (err: any) {
      toast.error(err.message || 'Network error executing migrations');
    } finally {
      setRunningMigration(false);
    }
  };

  const handleRollback = async () => {
    if (!window.confirm('Are you sure you want to rollback the most recent schema migration?')) {
      return;
    }
    setRollingBack(true);
    try {
      const res = await authFetch('/api/admin/migrations/rollback', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        toast.success(`Rolled back migration v${data.rolledBackVersion}: ${data.name}`);
        fetchMigrations();
      } else {
        toast.error(data.error || 'Rollback failed');
      }
    } catch (err: any) {
      toast.error(err.message || 'Error rolling back migration');
    } finally {
      setRollingBack(false);
    }
  };

  const copyChecksum = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedChecksum(text);
    setTimeout(() => setCopiedChecksum(null), 2000);
    toast.success('SHA-256 Checksum copied to clipboard');
  };

  const pendingMigrationsCount = migrations.filter(m => m.status === 'pending').length;

  return (
    <div className="space-y-6">
      {/* Header & Resilience Architecture Overview */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-5">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/50">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">Database Integrity & Resilience Center</h2>
                <span className="text-xs font-mono font-medium px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60">
                  {ENV_CONFIG.env.toUpperCase()}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Atomic transactions, double-booking prevention, automated snapshots, non-destructive restoration testing, and schema migrations.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => { fetchBackups(); fetchMigrations(); }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh Status
            </button>
            <button
              onClick={handleCreateBackup}
              disabled={creatingBackup}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-lg shadow-xs transition-colors"
            >
              {creatingBackup ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <HardDrive className="w-3.5 h-3.5" />}
              Create Snapshot Now
            </button>
          </div>
        </div>

        {/* Operational Indicators Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-5">
          <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium block">Environment & Database</span>
            <span className="text-sm font-semibold text-slate-900 dark:text-white mt-1 block">
              {ENV_CONFIG.isProduction ? 'Production Cluster' : 'Development Sandbox'}
            </span>
            <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 truncate block mt-0.5">
              db: {ENV_CONFIG.databaseId.slice(0, 18)}...
            </span>
          </div>

          <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium block">Concurrency Protection</span>
            <span className="text-sm font-semibold text-slate-900 dark:text-white mt-1 block flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              runTransaction Locking
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5">
              Atomic slot claim + idempotency deduping
            </span>
          </div>

          <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium block">Automated Daily Backups</span>
            <span className="text-sm font-semibold text-slate-900 dark:text-white mt-1 block flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              {backups.length} Snapshots Available
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5">
              {ENV_CONFIG.backupConfig.scheduleDescription}
            </span>
          </div>

          <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium block">Database Schema Version</span>
            <span className="text-sm font-semibold text-slate-900 dark:text-white mt-1 block flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              v{currentVersion} / {migrations.length} Applied
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5">
              {pendingMigrationsCount === 0 ? 'All migrations up to date' : `${pendingMigrationsCount} pending update(s)`}
            </span>
          </div>
        </div>
      </div>

      {/* Sub-Tab Navigation */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 space-x-6 text-sm">
        <button
          onClick={() => setActiveSubTab('backups')}
          className={`pb-3 font-semibold transition-colors flex items-center gap-2 border-b-2 -mb-px ${
            activeSubTab === 'backups'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <HardDrive className="w-4 h-4" />
          Automated Backups ({backups.length})
        </button>

        <button
          onClick={() => setActiveSubTab('restoration')}
          className={`pb-3 font-semibold transition-colors flex items-center gap-2 border-b-2 -mb-px ${
            activeSubTab === 'restoration'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <CheckCircle2 className="w-4 h-4" />
          Restoration Test Suite
        </button>

        <button
          onClick={() => setActiveSubTab('migrations')}
          className={`pb-3 font-semibold transition-colors flex items-center gap-2 border-b-2 -mb-px ${
            activeSubTab === 'migrations'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <Layers className="w-4 h-4" />
          Schema Migrations ({migrations.length})
        </button>
      </div>

      {/* SUB-TAB 1: BACKUPS */}
      {activeSubTab === 'backups' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Database Snapshot Archives</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Snapshots include users, bookings, slots, stores, machines, settings, and transaction ledgers with SHA-256 integrity verification.
              </p>
            </div>
            <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
              Retention: {ENV_CONFIG.backupConfig.retentionDays} days
            </span>
          </div>

          {loadingBackups ? (
            <div className="py-12 flex flex-col items-center justify-center text-slate-400">
              <RefreshCw className="w-6 h-6 animate-spin mb-2" />
              <span className="text-xs">Loading backup archive records...</span>
            </div>
          ) : backups.length === 0 ? (
            <div className="py-12 text-center text-slate-500">
              <HardDrive className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
              <p className="text-sm font-medium">No backup snapshots recorded yet.</p>
              <button
                onClick={handleCreateBackup}
                disabled={creatingBackup}
                className="mt-3 px-4 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors"
              >
                Create First Snapshot
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Snapshot ID / Timestamp</th>
                    <th className="py-3 px-4">Environment</th>
                    <th className="py-3 px-4 text-right">Documents</th>
                    <th className="py-3 px-4">Collections Breakdown</th>
                    <th className="py-3 px-4">SHA-256 Checksum</th>
                    <th className="py-3 px-4">Disaster Recovery Audit</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                  {backups.map((b) => (
                    <tr key={b.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="py-3.5 px-4">
                        <span className="font-mono font-medium text-slate-900 dark:text-white block">{b.id}</span>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                          {new Date(b.timestamp).toLocaleString()}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="font-mono px-2 py-0.5 rounded text-[11px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          {b.environment || 'development'}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-right font-mono font-bold tabular-nums text-slate-900 dark:text-white">
                        {b.totalDocuments || 0}
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex flex-wrap gap-1 max-w-xs text-[10px] font-mono text-slate-600 dark:text-slate-400">
                          {b.collections ? (
                            Object.entries(b.collections).map(([k, count]) => (
                              <span key={k} className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded">
                                {k}: <strong className="text-slate-800 dark:text-slate-200">{count}</strong>
                              </span>
                            ))
                          ) : (
                            <span>All primary collections</span>
                          )}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 font-mono text-[11px]">
                        <div className="flex items-center gap-1">
                          <span className="truncate w-24 text-slate-500">
                            {b.checksumSha256 ? `${b.checksumSha256.slice(0, 10)}...` : 'N/A'}
                          </span>
                          {b.checksumSha256 && (
                            <button
                              onClick={() => copyChecksum(b.checksumSha256)}
                              className="text-slate-400 hover:text-slate-600 p-0.5 rounded"
                              title="Copy SHA-256"
                            >
                              {copiedChecksum === b.checksumSha256 ? (
                                <Check className="w-3 h-3 text-emerald-600" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          )}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        {b.restorationStatus === 'verified' ? (
                          <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Verified</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-[11px]">Untested</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleRunRestorationTest(b.id)}
                            disabled={testingRestoration}
                            className="px-2.5 py-1 text-[11px] font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded transition-colors"
                          >
                            Test Restore
                          </button>
                          <a
                            href={`/api/admin/backups/${b.id}/download`}
                            download
                            className="p-1 text-slate-500 hover:text-indigo-600 rounded transition-colors"
                            title="Download JSON Snapshot"
                          >
                            <Download className="w-4 h-4" />
                          </a>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 2: RESTORATION VERIFICATION TEST SUITE */}
      {activeSubTab === 'restoration' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Non-Destructive Restoration Verification Test</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 max-w-2xl">
                  Executes a complete dry-run disaster recovery drill. Loads a snapshot, verifies records inside an isolated sandbox partition (<code className="font-mono text-[11px] text-indigo-600 dark:text-indigo-400">_backup_verification_test</code>), verifies foreign-key integrity between orders and users, and performs an atomic non-destructive teardown.
                </p>
              </div>

              <button
                onClick={() => handleRunRestorationTest()}
                disabled={testingRestoration}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-lg shadow-xs transition-colors shrink-0"
              >
                {testingRestoration ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Executing Verification Drill...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    Run Restoration Verification Test
                  </>
                )}
              </button>
            </div>
          </div>

          {restorationReport && (
            <div className="bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/60 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-emerald-100 dark:border-emerald-900/40 pb-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-sm font-bold text-emerald-900 dark:text-emerald-200">
                    Disaster Recovery Restoration Test Passed
                  </span>
                </div>
                <span className="text-xs font-mono text-emerald-700 dark:text-emerald-400">
                  Duration: {restorationReport.executionTimeMs}ms
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-white dark:bg-slate-900 p-3 rounded-lg border border-emerald-200/50 dark:border-emerald-900/30">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-medium">Documents Verified</span>
                  <span className="text-base font-bold font-mono text-slate-900 dark:text-white mt-0.5 block">
                    {restorationReport.totalDocumentsRestoredAndVerified} Records
                  </span>
                </div>

                <div className="bg-white dark:bg-slate-900 p-3 rounded-lg border border-emerald-200/50 dark:border-emerald-900/30">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-medium">Referential Integrity</span>
                  <span className="text-base font-bold text-emerald-600 dark:text-emerald-400 mt-0.5 block flex items-center gap-1">
                    <ShieldCheck className="w-4 h-4" />
                    0 Violations (100% Valid)
                  </span>
                </div>

                <div className="bg-white dark:bg-slate-900 p-3 rounded-lg border border-emerald-200/50 dark:border-emerald-900/30">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-medium">Sandbox Teardown</span>
                  <span className="text-base font-bold text-slate-900 dark:text-white mt-0.5 block">
                    Clean Teardown Confirmed
                  </span>
                </div>
              </div>

              {restorationReport.collectionReports && (
                <div className="bg-white dark:bg-slate-900 rounded-lg p-3 border border-emerald-200/50 dark:border-emerald-900/30">
                  <span className="text-xs font-semibold text-slate-900 dark:text-white block mb-2">Sample Verification Per Collection</span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
                    {Object.entries(restorationReport.collectionReports).map(([coll, stat]: [string, any]) => (
                      <div key={coll} className="flex items-center justify-between p-1.5 bg-slate-50 dark:bg-slate-800 rounded">
                        <span className="text-slate-600 dark:text-slate-400">{coll}:</span>
                        <span className="text-emerald-600 dark:text-emerald-400 font-bold">{stat.restored} ok</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 3: SCHEMA MIGRATIONS */}
      {activeSubTab === 'migrations' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Database Schema Migrations</h3>
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                  Current: v{currentVersion}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Version-controlled schema transformations with automated validation and reversible rollback handlers.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleRunMigrations(true)}
                disabled={runningMigration || pendingMigrationsCount === 0}
                className="px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 disabled:opacity-40 rounded-lg transition-colors"
              >
                Pre-Flight Dry Run
              </button>

              <button
                onClick={() => handleRunMigrations(false)}
                disabled={runningMigration || pendingMigrationsCount === 0}
                className="px-3.5 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 rounded-lg shadow-xs transition-colors"
              >
                {runningMigration ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : 'Apply Pending Migrations'}
              </button>

              <button
                onClick={handleRollback}
                disabled={rollingBack || currentVersion === 0}
                className="px-3 py-1.5 text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 disabled:opacity-40 rounded-lg transition-colors"
              >
                Rollback Latest
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-4">Version</th>
                  <th className="py-3 px-4">Migration Name</th>
                  <th className="py-3 px-4">Transformation Scope</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Applied Date</th>
                  <th className="py-3 px-4 text-right">Execution Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                {migrations.map((m) => (
                  <tr key={m.version} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-900 dark:text-white">
                      v{m.version}
                    </td>

                    <td className="py-3.5 px-4 font-mono font-medium text-slate-900 dark:text-white">
                      {m.name}
                    </td>

                    <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400 max-w-sm">
                      {m.description}
                    </td>

                    <td className="py-3.5 px-4">
                      {m.status === 'applied' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                          <CheckCircle2 className="w-3 h-3" />
                          Applied
                        </span>
                      ) : m.status === 'rolled_back' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                          <RotateCcw className="w-3 h-3" />
                          Rolled Back
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                          Pending
                        </span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 font-mono text-[11px] text-slate-500">
                      {m.appliedAt ? new Date(m.appliedAt).toLocaleString() : '—'}
                    </td>

                    <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-500">
                      {m.executionTimeMs ? `${m.executionTimeMs}ms` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
