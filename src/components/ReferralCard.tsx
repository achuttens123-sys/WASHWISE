import React, { useState } from 'react';
import { Gift, Copy, Check, Share2, Sparkles, ChevronRight, Coins, Wallet } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { getReferralShareUrl, getReferralShareText } from '../utils/referral';
import ReferralModal from './ReferralModal';

interface ReferralCardProps {
  variant?: 'banner' | 'compact' | 'inline';
}

export const ReferralCard: React.FC<ReferralCardProps> = ({ variant = 'banner' }) => {
  const { user } = useAuth();
  const { settings } = useSettings();
  const [copied, setCopied] = useState(false);
  const [showModal, setShowModal] = useState(false);

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

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(referralCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleShare = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (navigator.share) {
      navigator.share({
        title: 'WashWise Referral',
        text: shareMessage,
        url: shareUrl
      }).catch(() => {});
    } else {
      const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(shareMessage)}`;
      window.open(waUrl, '_blank');
    }
  };

  if (variant === 'compact') {
    return (
      <>
        <div 
          onClick={() => setShowModal(true)}
          className="cursor-pointer p-4 rounded-2xl bg-gradient-to-r from-primary-electric/10 to-indigo-500/10 border border-primary-electric/20 hover:border-primary-electric/40 transition-all flex items-center justify-between group"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary-electric text-white flex items-center justify-center shadow-md shadow-primary-electric/20">
              <Gift className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-black uppercase tracking-wider text-primary-electric">
                  Refer & Earn
                </span>
                <span className="px-1.5 py-0.2 bg-primary-electric text-white text-[9px] font-black rounded-full uppercase">
                  +{referralConfig.referrerCredits} Credits
                </span>
              </div>
              <p className="text-xs font-bold text-gray-800 dark:text-high-contrast mt-0.5">
                Code: <span className="font-mono text-primary-electric font-black">{referralCode}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="p-2 text-primary-electric hover:bg-primary-electric/10 rounded-xl transition-colors"
              title="Copy Code"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
            </button>
            <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-primary-electric transition-colors" />
          </div>
        </div>

        <ReferralModal isOpen={showModal} onClose={() => setShowModal(false)} />
      </>
    );
  }

  return (
    <>
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-900 via-primary-electric to-[#3323cc] text-white p-6 sm:p-8 shadow-xl shadow-primary-electric/15">
        {/* Glow Decos */}
        <div className="absolute -right-10 -bottom-10 w-44 h-44 bg-white/10 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute right-10 top-0 w-32 h-32 bg-amber-400/15 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-lg">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-[11px] font-black uppercase tracking-wider">
              <Gift className="w-3.5 h-3.5" /> Refer Friends, Wash For Free
            </div>
            
            <h3 className="text-xl sm:text-2xl font-display font-black tracking-tight leading-snug">
              Earn {referralConfig.referrerCredits} Credits & ₹{referralConfig.referrerWalletCash} for every friend you invite!
            </h3>

            <p className="text-xs sm:text-sm text-indigo-100 font-medium leading-relaxed">
              Your friends get <span className="font-bold text-white">₹{referralConfig.refereeDiscountRupees} OFF + {referralConfig.refereeBonusCredits} Credits</span> on their first order. You get rewarded as soon as they wash!
            </p>
          </div>

          <div className="w-full md:w-auto shrink-0 flex flex-col sm:flex-row md:flex-col lg:flex-row items-center gap-3">
            <div className="w-full sm:w-auto bg-black/25 backdrop-blur-md border border-white/20 rounded-2xl py-3 px-4 flex items-center justify-between gap-3">
              <div>
                <span className="text-[9px] font-black uppercase tracking-wider text-indigo-200 block">
                  Your Referral Code
                </span>
                <span className="font-mono font-black text-base sm:text-lg text-white tracking-wider">
                  {referralCode}
                </span>
              </div>
              <button
                onClick={handleCopy}
                className="p-2.5 bg-white/15 hover:bg-white/25 rounded-xl transition-all text-white flex items-center justify-center"
                title="Copy Code"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>

            <div className="w-full sm:w-auto flex gap-2">
              <button
                onClick={handleShare}
                className="flex-1 sm:flex-none px-5 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30 transition-all"
              >
                <Share2 className="w-4 h-4" />
                <span>Invite</span>
              </button>

              <button
                onClick={() => setShowModal(true)}
                className="flex-1 sm:flex-none px-5 py-3.5 bg-white text-gray-900 hover:bg-indigo-50 rounded-2xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-lg transition-all"
              >
                <span>Details</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {copied && (
          <p className="mt-3 text-xs font-bold text-emerald-300 animate-fadeIn">
            ✓ Code {referralCode} copied to clipboard!
          </p>
        )}
      </div>

      <ReferralModal isOpen={showModal} onClose={() => setShowModal(false)} />
    </>
  );
};
export default ReferralCard;
