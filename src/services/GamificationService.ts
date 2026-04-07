import { 
  doc, 
  updateDoc, 
  getDoc, 
  collection, 
  query, 
  where, 
  getDocs, 
  addDoc, 
  serverTimestamp, 
  increment,
  setDoc,
  orderBy,
  limit,
  Timestamp
} from 'firebase/firestore';
import { db } from '../firebase';
import { User, Booking, LeaderboardEntry, Referral, Mission, UserMission } from '../types';

export const GamificationService = {
  // XP & Points Calculation
  async awardOrderRewards(userId: string, booking: Booking) {
    if (booking.status !== 'completed') return;

    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) return;
    const userData = userSnap.data() as User;

    // Diminishing Returns Logic
    const today = new Date().toISOString().split('T')[0];
    const ordersTodayQuery = query(
      collection(db, 'bookings'),
      where('userId', '==', userId),
      where('status', '==', 'completed'),
      where('date', '==', today)
    );
    const ordersTodaySnap = await getDocs(ordersTodayQuery);
    const orderCount = ordersTodaySnap.size;

    let multiplier = 1.0;
    if (orderCount > 4) multiplier = 0.2;
    else if (orderCount > 2) multiplier = 0.5;

    // Risk Score Penalty
    if ((userData.riskScore || 0) > 60) multiplier *= 0.7;
    // Subscription Bonus
    if (userData.userType === 'subscriber') multiplier *= 1.1;

    let xpToAdd = 0;
    let pointsToAdd = 0;

    // Base rewards: Completed wash order (≥ ₹150 or 4kg) → +20 XP, +10 points
    const weight = parseInt(booking.approxLoad?.split(' ')[0] || '0');
    if (booking.price >= 150 || weight >= 4) {
      xpToAdd = Math.floor(20 * multiplier);
      pointsToAdd = Math.floor(10 * multiplier);
    }

    if (xpToAdd > 0 || pointsToAdd > 0) {
      await updateDoc(userRef, {
        xp: increment(xpToAdd),
        points: increment(pointsToAdd),
        riskScore: increment(-10) // Valid completed order → -10
      });

      // Update Leaderboard
      await this.updateLeaderboardScore(userId);
      // Update Missions
      await this.updateMissionProgress(userId, 'orders', 1);
    }
  },

  async awardSubscriptionRewards(userId: string) {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      xp: increment(100)
    });
    await this.updateLeaderboardScore(userId);
  },

  async handleReferral(referrerCode: string, referredUserId: string) {
    // Find referrer by code
    const usersQuery = query(collection(db, 'users'), where('referralCode', '==', referrerCode), limit(1));
    const usersSnap = await getDocs(usersQuery);
    
    if (usersSnap.empty) return;
    const referrerId = usersSnap.docs[0].id;

    // Create pending referral record
    await addDoc(collection(db, 'referrals'), {
      referrerId,
      referredUserId,
      status: 'pending',
      createdAt: serverTimestamp()
    });

    // XP reward removed from signup per requirements
    await this.updateLeaderboardScore(referrerId);
  },

  async validateReferral(referredUserId: string, firstOrder: Booking) {
    // Requirements: status == "completed", value >= ₹150
    if (firstOrder.status !== 'completed' || firstOrder.price < 150) return;

    // Check if user already rewarded for first order
    const referredUserRef = doc(db, 'users', referredUserId);
    const referredUserSnap = await getDoc(referredUserRef);
    if (!referredUserSnap.exists()) return;
    const referredUserData = referredUserSnap.data() as User;
    if (referredUserData.firstOrderRewarded) return;

    const referralQuery = query(
      collection(db, 'referrals'),
      where('referredUserId', '==', referredUserId),
      where('status', '==', 'pending')
    );
    const referralSnap = await getDocs(referralQuery);
    
    if (!referralSnap.empty) {
      const referralDoc = referralSnap.docs[0];
      const referralData = referralDoc.data() as Referral;
      const referrerId = referralData.referrerId;
      const referrerRef = doc(db, 'users', referrerId);
      const referrerSnap = await getDoc(referrerRef);
      
      if (!referrerSnap.exists()) return;
      const referrerData = referrerSnap.data() as User;

      // Fraud Detection
      let isFraud = false;
      let riskReason = '';

      // 1. Multiple accounts from same device
      if (referredUserData.deviceId && referrerData.deviceId && referredUserData.deviceId === referrerData.deviceId) {
        isFraud = true;
        riskReason = 'multi-account';
      }

      // 2. Repeated referrals from same IP cluster
      if (referredUserData.ipAddress && referrerData.ipAddress && referredUserData.ipAddress === referrerData.ipAddress) {
        isFraud = true;
        riskReason = 'same-ip';
      }

      // 3. Abnormal referral frequency (>3/hour)
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const recentReferralsQuery = query(
        collection(db, 'referrals'),
        where('referrerId', '==', referrerId),
        where('createdAt', '>=', Timestamp.fromDate(oneHourAgo))
      );
      const recentReferralsSnap = await getDocs(recentReferralsQuery);
      if (recentReferralsSnap.size > 3) {
        isFraud = true;
        riskReason = 'spam-referral';
      }

      if (isFraud) {
        await this.updateRiskScore(referrerId, 'spam-referral');
        await updateDoc(doc(db, 'referrals', referralDoc.id), {
          status: 'flagged',
          riskReason,
          flaggedAt: serverTimestamp()
        });
        // Per requirements: do not credit rewards or delay them. 
        // Here we flag and don't credit.
        return;
      }

      // Credit Referrer: ₹50 equivalent points (e.g. 50 points)
      await updateDoc(referrerRef, {
        points: increment(50),
        xp: increment(100),
        totalReferrals: increment(1)
      });

      // Credit Referred User: ₹30 welcome bonus
      await updateDoc(referredUserRef, {
        points: increment(30),
        firstOrderRewarded: true
      });

      await updateDoc(doc(db, 'referrals', referralDoc.id), {
        status: 'completed',
        completedAt: serverTimestamp()
      });

      await this.updateLeaderboardScore(referrerId);
      await this.updateMissionProgress(referrerId, 'referrals', 1);
    }
  },

  // Leaderboard Scoring Formula
  async calculateTotalScore(userId: string): Promise<number> {
    const userSnap = await getDoc(doc(db, 'users', userId));
    if (!userSnap.exists()) return 0;
    const user = userSnap.data() as User;

    // Usage Score: log(totalKg + 1) × 100
    // We need to sum up weights from completed bookings
    const bookingsQuery = query(
      collection(db, 'bookings'),
      where('userId', '==', userId),
      where('status', '==', 'completed')
    );
    const bookingsSnap = await getDocs(bookingsQuery);
    let totalKg = 0;
    bookingsSnap.forEach(doc => {
      const data = doc.data() as Booking;
      const kg = parseInt(data.approxLoad?.split(' ')[0] || '0');
      totalKg += kg;
    });
    const usageScore = Math.log(totalKg + 1) * 100;

    // Consistency Score: streakWeeks × 50
    const consistencyScore = (user.streak || 0) * 50;

    // Referral Score: referrals × 80 (Cap: top 5 per week count fully - simplified here)
    const referralScore = (user.totalReferrals || 0) * 80;

    // Efficiency Score: actions × 20 (simplified: count off-peak bookings)
    // For now, let's just use a placeholder or count specific actions
    const efficiencyScore = 0; 

    const totalScore = (usageScore * 0.4) + (consistencyScore * 0.25) + (referralScore * 0.2) + (efficiencyScore * 0.15);
    
    // Multipliers
    let finalScore = totalScore;
    if (user.userType === 'subscriber') finalScore *= 1.1;
    if ((user.riskScore || 0) > 60) finalScore *= 0.7;

    return Math.floor(finalScore);
  },

  async updateLeaderboardScore(userId: string) {
    const userSnap = await getDoc(doc(db, 'users', userId));
    if (!userSnap.exists()) return;
    const user = userSnap.data() as User;

    const score = await this.calculateTotalScore(userId);

    const leaderboardRef = doc(db, 'leaderboard', userId);
    await setDoc(leaderboardRef, {
      userId,
      userName: user.name,
      photoURL: user.photoURL || '',
      totalScore: score,
      weeklyScore: score, // Simplified: reset logic will handle this
      lastUpdated: serverTimestamp()
    }, { merge: true });
  },

  // Anti-Abuse System
  async updateRiskScore(userId: string, action: 'multi-account' | 'suspicious-referral' | 'spam-referral' | 'cancellation') {
    const userRef = doc(db, 'users', userId);
    let incrementValue = 0;

    switch (action) {
      case 'multi-account': incrementValue = 20; break;
      case 'suspicious-referral': incrementValue = 15; break;
      case 'spam-referral': incrementValue = 20; break;
      case 'cancellation': incrementValue = 10; break;
    }

    await updateDoc(userRef, {
      riskScore: increment(incrementValue)
    });
  },

  // Missions
  async updateMissionProgress(userId: string, type: 'orders' | 'referrals' | 'spend' | 'streak', value: number) {
    const missionsQuery = query(collection(db, 'missions'), where('requirement.type', '==', type));
    const missionsSnap = await getDocs(missionsQuery);

    for (const missionDoc of missionsSnap.docs) {
      const mission = missionDoc.data() as Mission;
      const userMissionRef = doc(db, 'userMissions', `${userId}_${missionDoc.id}`);
      const userMissionSnap = await getDoc(userMissionRef);

      if (userMissionSnap.exists()) {
        const userMission = userMissionSnap.data() as UserMission;
        if (userMission.status === 'in-progress') {
          const newProgress = userMission.progress + value;
          const status = newProgress >= mission.requirement.value ? 'completed' : 'in-progress';
          await updateDoc(userMissionRef, {
            progress: newProgress,
            status,
            lastUpdated: serverTimestamp()
          });
        }
      } else {
        const status = value >= mission.requirement.value ? 'completed' : 'in-progress';
        await setDoc(userMissionRef, {
          userId,
          missionId: missionDoc.id,
          progress: value,
          status,
          lastUpdated: serverTimestamp()
        });
      }
    }
  },

  async claimMissionReward(userId: string, userMissionId: string) {
    const userMissionRef = doc(db, 'userMissions', userMissionId);
    const userMissionSnap = await getDoc(userMissionRef);
    if (!userMissionSnap.exists()) return;
    const userMission = userMissionSnap.data() as UserMission;

    if (userMission.status === 'completed') {
      const missionSnap = await getDoc(doc(db, 'missions', userMission.missionId));
      if (!missionSnap.exists()) return;
      const mission = missionSnap.data() as Mission;

      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        xp: increment(mission.rewardXP),
        points: increment(mission.rewardPoints)
      });

      await updateDoc(userMissionRef, {
        status: 'claimed',
        lastUpdated: serverTimestamp()
      });

      await this.updateLeaderboardScore(userId);
    }
  }
};
