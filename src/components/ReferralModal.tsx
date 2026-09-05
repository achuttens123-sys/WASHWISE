import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Gift, 
  Copy, 
  Check, 
  Share2, 
  X, 
  Sparkles, 
  Users, 
  Coins, 
  Wallet, 
  MessageCircle, 
  CheckCircle2, 
  Clock, 
  Award,
  ChevronRight,
  Info
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { getReferralShareUrl, getReferralShareText } from '../utils/referral';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { ReferralRecord } from '../types';

interface ReferralModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ReferralModal: React.FC<ReferralModalProps> = ({ isOpen, onClose }) => {
  const { user } = useAuth();
  const { settings } = useSettings();
  const [copied, setCopied] = useState(false);
  const [referrals, setReferrals] = useState<ReferralRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  const referralConfig = settings?.referral || {
    enabled: true,
    referrerCredits: 20,
    referrerWalletCash: 50,
    refereeBonusCredits: 10,
    refereeDiscountRupees: 50
  };

  const referralCode = user?.referralCode || 'WASHWISE';
  const shareUrl = getReferralShareUrl(referralCode);
  const shareMessage = getReferralShareText(referralCode, user?.name);

  useEffect(() => {
    if (!user?.uid || !isOpen) return;

    const q = query(
      collection(db, 'referrals'),
      where('referrerId', '==', user.uid)
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const list: ReferralRecord[] = [];
      snapshot.forEach(doc => {
        list.push({ id: doc.id, ...doc.data() } as ReferralRecord);
      });
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setReferrals(list);
      setLoadingHistory(false);
    }, (err) => {
      console.error('Error fetching referrals:', err);
      setLoadingHistory(false);
    });

    return () => unsub();
  }, [user?.uid, isOpen]);

  const handleCopy = () => {
    navigator.clipboard.writeText(referralCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleWhatsAppShare = () => {
    const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(shareMessage)}`;
    window.open(waUrl, '_blank');
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'WashWise Laundry Referral',
          text: shareMessage,
          url: shareUrl
        });
      } catch (err) {
        // User dismissed share dialog
      }
    } else {
      handleCopyLink();
    }
  };

  const completedReferrals = referrals.filter(r => r.status === 'completed');
  const pendingReferrals = referrals.filter(r => r.status === 'pending');

  const totalCreditsEarned = user?.totalReferralCreditsEarned || (completedReferrals.length * referralConfig.referrerCredits);
  const totalCashEarned = user?.totalReferralCashEarned || (completedReferrals.length * referralConfig.referrerWalletCash);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="bg-white dark:bg-surface-container w-full max-w-xl max-h-[90vh] rounded-3xl border border-gray-100 dark:border-gray-800 shadow-2xl overflow-hidden flex flex-col relative"
        >
          {/* Header Banner */}
          <div className="relative bg-gradient-to-br from-primary-electric via-[#3323cc] to-indigo-900 text-white p-6 sm:p-8 shrink-0 overflow-hidden">
            <button
              onClick={onClose}
              className="absolute top-5 right-5 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="relative z-10">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-xs font-black uppercase tracking-wider mb-3">
                <Gift className="w-3.5 h-3.5" /> Refer & Earn Rewards
              </div>
              <h2 className="text-2xl sm:text-3xl font-display font-black tracking-tight leading-tight">
                Give ₹{referralConfig.refereeDiscountRupees}, Get {referralConfig.referrerCredits} Credits + ₹{referralConfig.referrerWalletCash}
              </h2>
              <p className="text-xs sm:text-sm text-indigo-100 mt-2 font-medium leading-relaxed max-w-md">
                Invite fellow students & friends. When they complete their first wash, you both get rewarded!
              </p>
            </div>

            {/* Background Glow Deco */}
            <div className="absolute -right-8 -bottom-10 w-48 h-48 bg-white/10 rounded-full blur-2xl pointer-events-none" />
          </div>

          {/* Scrollable Content */}
          <div className="p-6 sm:p-8 overflow-y-auto space-y-6 flex-1 custom-scrollbar">
            {/* Referral Code Box */}
            <div className="p-5 rounded-2xl bg-gray-50 dark:bg-surface-low border border-gray-200 dark:border-gray-800 space-y-3">
              <div className="flex justify-between items-center text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                <span>Your Unique Referral Code</span>
                <span className="text-primary-electric font-black flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5" /> Unlimited Uses
                </span>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-3">
                <div className="w-full flex-1 bg-white dark:bg-surface-highest border-2 border-dashed border-primary-electric/40 rounded-2xl py-3.5 px-5 flex items-center justify-between shadow-sm">
                  <span className="font-mono font-black text-xl sm:text-2xl text-gray-900 dark:text-high-contrast tracking-widest">
                    {referralCode}
                  </span>
                  <button
                    onClick={handleCopy}
                    className="p-2 text-primary-electric hover:bg-primary-electric/10 rounded-xl transition-all"
                    title="Copy Code"
                  >
                    {copied ? <Check className="w-5 h-5 text-emerald-500" /> : <Copy className="w-5 h-5" />}
                  </button>
                </div>

                <div className="w-full sm:w-auto flex gap-2">
                  <button
                    onClick={handleWhatsAppShare}
                    className="flex-1 sm:flex-none px-4 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 transition-all"
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span>WhatsApp</span>
                  </button>

                  <button
                    onClick={handleNativeShare}
                    className="flex-1 sm:flex-none px-4 py-3.5 bg-gray-900 dark:bg-surface-highest hover:bg-gray-800 text-white rounded-2xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all"
                  >
                    <Share2 className="w-4 h-4" />
                    <span>Share</span>
                  </button>
                </div>
              </div>

              {copied && (
                <p className="text-center text-xs font-bold text-emerald-600 dark:text-emerald-400 animate-fadeIn">
                  ✓ Copied to clipboard! Ready to share.
                </p>
              )}
            </div>

            {/* Live Stats */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-4 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/30 text-center">
                <div className="w-8 h-8 mx-auto mb-1.5 rounded-xl bg-indigo-500/10 text-primary-electric flex items-center justify-center">
                  <Users className="w-4 h-4" />
                </div>
                <div className="text-xl sm:text-2xl font-display font-black text-gray-900 dark:text-high-contrast">
                  {referrals.length}
                </div>
                <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mt-0.5">
                  Friends Invited
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30 text-center">
                <div className="w-8 h-8 mx-auto mb-1.5 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
                  <Coins className="w-4 h-4" />
                </div>
                <div className="text-xl sm:text-2xl font-display font-black text-gray-900 dark:text-high-contrast">
                  {totalCreditsEarned}
                </div>
                <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mt-0.5">
                  Credits Earned
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 text-center">
                <div className="w-8 h-8 mx-auto mb-1.5 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                  <Wallet className="w-4 h-4" />
                </div>
                <div className="text-xl sm:text-2xl font-display font-black text-gray-900 dark:text-high-contrast">
                  ₹{totalCashEarned}
                </div>
                <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mt-0.5">
                  Cashback Won
                </div>
              </div>
            </div>

            {/* How It Works Steps */}
            <div className="space-y-3">
              <h3 className="text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">
                How It Works
              </h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-4 rounded-2xl bg-gray-50 dark:bg-surface-low border border-gray-100 dark:border-gray-800 space-y-1.5">
                  <div className="w-6 h-6 rounded-full bg-primary-electric text-white font-black text-xs flex items-center justify-center">
                    1
                  </div>
                  <h4 className="font-bold text-xs text-gray-900 dark:text-high-contrast">
                    Share Your Code
                  </h4>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-normal">
                    Send your referral link or code to friends & hostel mates.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-gray-50 dark:bg-surface-low border border-gray-100 dark:border-gray-800 space-y-1.5">
                  <div className="w-6 h-6 rounded-full bg-primary-electric text-white font-black text-xs flex items-center justify-center">
                    2
                  </div>
                  <h4 className="font-bold text-xs text-gray-900 dark:text-high-contrast">
                    Friend Signs Up
                  </h4>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-normal">
                    They instantly get {referralConfig.refereeBonusCredits} Credits + ₹{referralConfig.refereeDiscountRupees} OFF on their first wash.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-gray-50 dark:bg-surface-low border border-gray-100 dark:border-gray-800 space-y-1.5">
                  <div className="w-6 h-6 rounded-full bg-emerald-600 text-white font-black text-xs flex items-center justify-center">
                    3
                  </div>
                  <h4 className="font-bold text-xs text-gray-900 dark:text-high-contrast">
                    You Get Rewarded
                  </h4>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-normal">
                    You get {referralConfig.referrerCredits} Credits & ₹{referralConfig.referrerWalletCash} cash automatically when they place an order!
                  </p>
                </div>
              </div>
            </div>

            {/* Referrals History List */}
            <div className="space-y-3 pt-2">
              <div className="flex justify-between items-center">
                <h3 className="text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">
                  Invited Friends ({referrals.length})
                </h3>
                {pendingReferrals.length > 0 && (
                  <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 px-2.5 py-0.5 rounded-full">
                    {pendingReferrals.length} pending first wash
                  </span>
                )}
              </div>

              {loadingHistory ? (
                <div className="py-6 text-center text-xs text-gray-400">Loading referral history...</div>
              ) : referrals.length === 0 ? (
                <div className="p-6 rounded-2xl bg-gray-50 dark:bg-surface-low text-center border border-dashed border-gray-200 dark:border-gray-800">
                  <Users className="w-8 h-8 mx-auto text-gray-300 dark:text-gray-600 mb-2" />
                  <p className="text-xs font-bold text-gray-600 dark:text-gray-300">
                    No friends invited yet
                  </p>
                  <p className="text-[11px] text-gray-400 mt-1">
                    Share your code above to start earning free laundry credits!
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {referrals.map((item) => (
                    <div
                      key={item.id}
                      className="p-3.5 rounded-xl bg-gray-50 dark:bg-surface-low border border-gray-100 dark:border-gray-800 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black ${
                          item.status === 'completed' 
                            ? 'bg-emerald-500/10 text-emerald-600' 
                            : 'bg-amber-500/10 text-amber-600'
                        }`}>
                          {item.status === 'completed' ? <CheckCircle2 className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                        </div>
                        <div>
                          <p className="font-bold text-gray-900 dark:text-high-contrast">
                            {item.referredUserName || 'Student Friend'}
                          </p>
                          <p className="text-[10px] text-gray-400">
                            {new Date(item.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                          </p>
                        </div>
                      </div>

                      <div className="text-right">
                        {item.status === 'completed' ? (
                          <span className="inline-flex items-center gap-1 font-black text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 px-2 py-1 rounded-lg text-[10px] uppercase">
                            +{item.rewardCredits || 20} Credits & +₹{item.rewardWalletCash || 50}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 px-2 py-1 rounded-lg text-[10px] uppercase">
                            Waiting for 1st order
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Footer CTA */}
          <div className="p-4 sm:p-6 bg-gray-50 dark:bg-surface-low border-t border-gray-100 dark:border-gray-800 flex justify-between items-center shrink-0">
            <span className="text-xs font-bold text-gray-500">
              Instant credit upon first wash completion
            </span>
            <button
              onClick={onClose}
              className="px-6 py-2.5 bg-primary-electric hover:bg-[#3323cc] text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all shadow-md"
            >
              Done
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
export default ReferralModal;
