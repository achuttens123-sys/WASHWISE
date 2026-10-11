import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Bell, 
  Plus, 
  Trash2, 
  Save, 
  CheckCircle, 
  Clock, 
  Send, 
  RefreshCw, 
  Sparkles, 
  Calendar, 
  Check, 
  AlertCircle,
  ToggleLeft,
  ToggleRight,
  Shield,
  MessageSquare
} from 'lucide-react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useSettings } from '../../context/SettingsContext';
import { ReminderSettings, ReminderTemplate, DEFAULT_REMINDER_SETTINGS } from '../../types';
import { authFetch } from '../../utils/api';

export const ReminderManager: React.FC = () => {
  const { settings } = useSettings();
  const currentReminders: ReminderSettings = settings?.reminders || DEFAULT_REMINDER_SETTINGS;

  const [reminderConfig, setReminderConfig] = useState<ReminderSettings>(currentReminders);
  const [newReminderText, setNewReminderText] = useState('');
  const [newReminderTag, setNewReminderTag] = useState<ReminderTemplate['tag']>('custom');
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [testingWeekly, setTestingWeekly] = useState(false);
  const [testWeeklyMessage, setTestWeeklyMessage] = useState<string | null>(null);

  // Sync state if settings update
  React.useEffect(() => {
    if (settings?.reminders) {
      setReminderConfig(settings.reminders);
    }
  }, [settings?.reminders]);

  const handleToggleActive = (templateId: string) => {
    setReminderConfig((prev) => ({
      ...prev,
      templates: prev.templates.map((t) =>
        t.id === templateId ? { ...t, active: !t.active } : t
      ),
    }));
  };

  const handleDeleteTemplate = (templateId: string) => {
    setReminderConfig((prev) => ({
      ...prev,
      templates: prev.templates.filter((t) => t.id !== templateId),
    }));
  };

  const handleAddTemplate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newReminderText.trim()) return;

    const newTemplate: ReminderTemplate = {
      id: `template_${Date.now()}`,
      text: newReminderText.trim(),
      tag: newReminderTag,
      active: true,
    };

    setReminderConfig((prev) => ({
      ...prev,
      templates: [newTemplate, ...prev.templates],
    }));

    setNewReminderText('');
    setNewReminderTag('custom');
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    setSaveSuccess(false);
    try {
      await setDoc(
        doc(db, 'settings', 'global'),
        { reminders: reminderConfig },
        { merge: true }
      );
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error('Error saving reminder settings:', error);
      alert('Failed to save reminder settings. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleTriggerTestReminder = async () => {
    setTestingWeekly(true);
    setTestWeeklyMessage(null);
    try {
      const res = await authFetch('/api/reminders/trigger-check', {
        method: 'POST',
      });
      const data = await res.json();
      if (res.ok) {
        setTestWeeklyMessage(`Scan complete: ${data.remindersSent || 0} reminders processed (${data.message || 'Success'})`);
      } else {
        setTestWeeklyMessage(`Error: ${data.error || 'Failed to trigger check'}`);
      }
    } catch (err: any) {
      setTestWeeklyMessage(`Network Error: ${err.message}`);
    } finally {
      setTestingWeekly(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Status */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl sm:rounded-3xl p-6 sm:p-8 border border-gray-100 dark:border-gray-800 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="p-3 sm:p-4 bg-blue-50 dark:bg-blue-950/40 text-blue-600 rounded-2xl">
            <Bell className="w-6 h-6 sm:w-8 sm:h-8" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tight">
                Wash Reminders & Smart Notifications
              </h2>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                reminderConfig.enabled 
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300' 
                  : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
              }`}>
                {reminderConfig.enabled ? 'Active' : 'Disabled'}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-2xl font-medium">
              Sends gentle, non-intrusive Malayalam & English reminders 5 days after a wash to re-book slots before weekend rush.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <button
            onClick={() => setReminderConfig(prev => ({ ...prev, enabled: !prev.enabled }))}
            className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all ${
              reminderConfig.enabled
                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
            }`}
          >
            {reminderConfig.enabled ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
            <span>{reminderConfig.enabled ? 'Reminders ON' : 'Reminders OFF'}</span>
          </button>

          <button
            onClick={handleSaveSettings}
            disabled={saving}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 shadow-md shadow-blue-500/20 transition-all disabled:opacity-50"
          >
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : saveSuccess ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            <span>{saving ? 'Saving...' : saveSuccess ? 'Saved!' : 'Save Settings'}</span>
          </button>
        </div>
      </div>

      {/* Rules & Safeguards Grid (Anti-Irritation Controls) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
        <div className="bg-white dark:bg-gray-900 p-5 sm:p-6 rounded-2xl border border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-2.5 mb-2">
            <Clock className="w-4 h-4 text-blue-600" />
            <h3 className="text-xs font-black text-gray-700 dark:text-gray-300 uppercase tracking-wider">
              Interval After Last Wash
            </h3>
          </div>
          <div className="flex items-center gap-3 mt-3">
            <input
              type="number"
              min={1}
              max={30}
              value={reminderConfig.daysAfterLastBooking}
              onChange={(e) => setReminderConfig(prev => ({ ...prev, daysAfterLastBooking: Math.max(1, parseInt(e.target.value) || 5) }))}
              className="w-20 px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-black text-center text-gray-900 dark:text-white"
            />
            <span className="text-xs text-gray-500 font-bold">Days since last booking (Default: 5)</span>
          </div>
          <p className="text-[11px] text-gray-400 mt-2 font-medium">
            Triggered automatically 5 days after a student's last wash slot.
          </p>
        </div>

        <div className="bg-white dark:bg-gray-900 p-5 sm:p-6 rounded-2xl border border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-2.5 mb-2">
            <Shield className="w-4 h-4 text-indigo-600" />
            <h3 className="text-xs font-black text-gray-700 dark:text-gray-300 uppercase tracking-wider">
              Anti-Irritation Limit
            </h3>
          </div>
          <div className="flex items-center gap-3 mt-3">
            <input
              type="number"
              min={1}
              max={3}
              value={reminderConfig.maxRemindersPerWeek ?? 1}
              onChange={(e) => setReminderConfig(prev => ({ ...prev, maxRemindersPerWeek: Math.max(1, parseInt(e.target.value) || 1) }))}
              className="w-20 px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-black text-center text-gray-900 dark:text-white"
            />
            <span className="text-xs text-gray-500 font-bold">Max reminder / week per user</span>
          </div>
          <p className="text-[11px] text-gray-400 mt-2 font-medium">
            Prevents spamming students who haven't logged in recently.
          </p>
        </div>

        <div className="bg-white dark:bg-gray-900 p-5 sm:p-6 rounded-2xl border border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-2.5 mb-2">
            <Sparkles className="w-4 h-4 text-amber-600" />
            <h3 className="text-xs font-black text-gray-700 dark:text-gray-300 uppercase tracking-wider">
              Slot & Renewal Notices
            </h3>
          </div>
          <div className="space-y-2 mt-2 text-xs text-gray-600 dark:text-gray-400">
            <div className="flex justify-between items-center">
              <span>Upcoming Wash:</span>
              <span className="font-black text-gray-900 dark:text-white">{reminderConfig.upcomingWashHoursNotice ?? 2} hrs prior</span>
            </div>
            <div className="flex justify-between items-center">
              <span>Subscription Expiry:</span>
              <span className="font-black text-gray-900 dark:text-white">{reminderConfig.subscriptionDaysNotice ?? 3} days prior</span>
            </div>
          </div>
          <p className="text-[11px] text-gray-400 mt-2 font-medium">
            Automatically notifies for pickup, drying & drop-off.
          </p>
        </div>
      </div>

      {/* Add New Reminder Text / Line Form */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl sm:rounded-3xl p-6 sm:p-8 border border-gray-100 dark:border-gray-800 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <MessageSquare className="w-5 h-5 text-blue-600" />
          <h3 className="text-base font-black text-gray-900 dark:text-white uppercase tracking-tight">
            Add New Reminder Line / Text
          </h3>
        </div>
        <p className="text-xs text-gray-500 mb-4">
          Add fresh, witty, or Malayalam reminder texts. WashWise randomly selects active templates so users never get fatigued by the same line.
        </p>

        <form onSubmit={handleAddTemplate} className="space-y-4">
          <div>
            <textarea
              rows={2}
              value={newReminderText}
              onChange={(e) => setNewReminderText(e.target.value)}
              placeholder="e.g. “Weekend plans undo? 👀 clothes ready aano? 😉” or “Innu small wash cheythal… weekend free aakum 😌”"
              className="w-full p-3.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl text-xs sm:text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 resize-none font-medium"
            />
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Category Tag:</span>
              <select
                value={newReminderTag}
                onChange={(e) => setNewReminderTag(e.target.value as any)}
                className="px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold text-gray-700 dark:text-gray-300 outline-none"
              >
                <option value="weekly_checkin">Weekly Check-in</option>
                <option value="weekend_vibe">Weekend Vibe</option>
                <option value="weekday_smart">Weekday Smart Wash</option>
                <option value="fomo_slot">FOMO / Slots Filling</option>
                <option value="custom">Custom Line</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={!newReminderText.trim()}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Add Reminder Line</span>
            </button>
          </div>
        </form>
      </div>

      {/* Reminder Lines List / Table */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl sm:rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-black text-gray-900 dark:text-white uppercase tracking-tight">
              Active Reminder Templates ({reminderConfig.templates.filter(t => t.active).length} / {reminderConfig.templates.length})
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Toggle individual texts on or off, or delete ones you don't want to send.
            </p>
          </div>

          <button
            onClick={handleTriggerTestReminder}
            disabled={testingWeekly}
            className="px-4 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-blue-50 dark:hover:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{testingWeekly ? 'Running check...' : 'Test Run Reminders Scan'}</span>
          </button>
        </div>

        {testWeeklyMessage && (
          <div className="px-6 py-3 bg-blue-50 dark:bg-blue-950/30 border-b border-blue-100 dark:border-blue-900/40 text-xs font-bold text-blue-700 dark:text-blue-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{testWeeklyMessage}</span>
          </div>
        )}

        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          {reminderConfig.templates.map((template, idx) => (
            <div
              key={template.id || idx}
              className={`p-4 sm:p-5 flex items-start sm:items-center justify-between gap-4 transition-colors ${
                template.active ? 'bg-white dark:bg-gray-900' : 'bg-gray-50/50 dark:bg-gray-900/40 opacity-60'
              }`}
            >
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider ${
                    template.tag === 'weekend_vibe'
                      ? 'bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300'
                      : template.tag === 'fomo_slot'
                      ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                      : template.tag === 'weekday_smart'
                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                      : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                  }`}>
                    {template.tag?.replace('_', ' ') || 'General'}
                  </span>
                  <span className="text-[10px] text-gray-400 font-bold">#{idx + 1}</span>
                </div>
                <p className="text-xs sm:text-sm font-semibold text-gray-900 dark:text-white leading-relaxed">
                  {template.text}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => handleToggleActive(template.id)}
                  title={template.active ? 'Disable line' : 'Enable line'}
                  className={`p-2 rounded-xl transition-all ${
                    template.active
                      ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:bg-emerald-950/30'
                      : 'bg-gray-100 text-gray-400 hover:bg-gray-200 dark:bg-gray-800'
                  }`}
                >
                  {template.active ? <CheckCircle className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                </button>

                <button
                  type="button"
                  onClick={() => handleDeleteTemplate(template.id)}
                  title="Delete line"
                  className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-xl transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ReminderManager;
