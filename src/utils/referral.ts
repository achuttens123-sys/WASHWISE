import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

/**
 * Generates a clean, human-friendly referral code
 * Example: "WW-RAHUL49" or "WW-K982"
 */
export function generateUserReferralCode(name?: string): string {
  const cleanName = (name || 'USER')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .substring(0, 5);
  
  const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `WW-${cleanName || 'WASH'}${randomSuffix}`;
}

/**
 * Generates a shareable referral URL for web and mobile
 */
export function getReferralShareUrl(referralCode: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://washwise.app';
  return `${origin}/login?mode=signup&ref=${encodeURIComponent(referralCode)}`;
}

/**
 * Formats standard promotional message for WhatsApp / SMS / Social
 */
export function getReferralShareText(referralCode: string, referrerName?: string): string {
  const shareUrl = getReferralShareUrl(referralCode);
  const nameStr = referrerName ? `${referrerName} has invited you to` : 'Join';
  return `🧺 ${nameStr} WashWise Laundry!\n\nSign up with referral code *${referralCode}* to get 10 Free Laundry Credits & ₹50 OFF your first wash order.\n\nClaim your reward here:\n${shareUrl}`;
}

/**
 * Validates whether a referral code exists and returns referrer information
 */
export async function validateReferralCode(code: string, currentUserId?: string): Promise<{
  valid: boolean;
  message: string;
  referrerUser?: {
    uid: string;
    name: string;
    email?: string;
  };
}> {
  const trimmed = (code || '').trim().toUpperCase();
  if (!trimmed) {
    return { valid: false, message: 'Please enter a referral code.' };
  }

  // 1. Try server-side validation endpoint first (bypasses client firestore security rules seamlessly)
  try {
    const res = await fetch('/api/referrals/validate-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: trimmed, currentUserId })
    });
    const data = await res.json();
    if (res.ok && data.valid) {
      return {
        valid: true,
        message: data.message || `Valid code from ${data.referrer?.name || 'a WashWise member'}!`,
        referrerUser: data.referrer
      };
    } else if (res.status === 400 || res.status === 404) {
      return { valid: false, message: data.error || 'Invalid or expired referral code.' };
    }
  } catch (apiErr) {
    console.warn('API referral validation fallback:', apiErr);
  }

  // 2. Fallback to direct firestore lookup if server is unreachable
  try {
    const q = query(
      collection(db, 'users'),
      where('referralCode', '==', trimmed)
    );
    const snap = await getDocs(q);

    if (snap.empty) {
      return { valid: false, message: 'Invalid or expired referral code.' };
    }

    const referrerDoc = snap.docs[0];
    const referrerData = referrerDoc.data();

    // Prevent self-referral
    if (currentUserId && referrerDoc.id === currentUserId) {
      return { valid: false, message: 'You cannot use your own referral code.' };
    }

    return {
      valid: true,
      message: `Valid code from ${referrerData.name || 'a WashWise member'}!`,
      referrerUser: {
        uid: referrerDoc.id,
        name: referrerData.name || 'WashWise Member',
        email: referrerData.email || ''
      }
    };
  } catch (error: any) {
    console.error('Error validating referral code fallback:', error);
    return { valid: false, message: 'Could not verify code right now.' };
  }
}
