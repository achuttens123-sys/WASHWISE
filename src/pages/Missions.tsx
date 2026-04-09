import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Target, 
  CheckCircle2, 
  Clock, 
  Star, 
  Zap, 
  Trophy, 
  ChevronRight,
  Loader2,
  Gift,
  Lock
} from 'lucide-react';
import { collection, query, where, onSnapshot, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { Mission, UserMission } from '../types';
import { GamificationService } from '../services/GamificationService';

const Missions: React.FC = () => {
  const { user } = useAuth();
  const [missions, setMissions] = useState<Mission[]>([]);
  const [userMissions, setUserMissions] = useState<UserMission[]>([]);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    // Fetch all missions
    const fetchMissions = async () => {
      const missionsSnap = await getDocs(collection(db, 'missions'));
      const missionsData = missionsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Mission[];
      setMissions(missionsData);
    };

    fetchMissions();

    // Listen to user missions
    const q = query(collection(db, 'userMissions'), where('userId', '==', user?.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as UserMission[];
      setUserMissions(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user?.uid]);

  const handleClaim = async (userMissionId: string) => {
    setClaiming(userMissionId);
    try {
      await GamificationService.claimMissionReward(user?.uid!, userMissionId);
    } catch (error) {
      console.error(error);
    } finally {
      setClaiming(null);
    }
  };

  const getMissionProgress = (missionId: string) => {
    const userMission = userMissions.find(um => um.missionId === missionId);
    return userMission ? userMission.progress : 0;
  };

  const getMissionStatus = (missionId: string) => {
    const userMission = userMissions.find(um => um.missionId === missionId);
    return userMission ? userMission.status : 'in-progress';
  };

  const getUserMissionId = (missionId: string) => {
    const userMission = userMissions.find(um => um.missionId === missionId);
    return userMission?.id;
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="w-12 h-12 text-blue-600 animate-spin mb-4" />
        <p className="text-gray-500 font-black uppercase tracking-widest text-sm">Loading Missions...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-black text-gray-800 dark:text-gray-100 tracking-tight uppercase">Missions</h1>
          <p className="text-gray-500 dark:text-gray-400 font-bold uppercase tracking-widest text-xs">
            Complete tasks to earn XP and Points
          </p>
        </div>
        <div className="p-4 bg-blue-600 rounded-3xl shadow-xl shadow-blue-200 dark:shadow-none animate-pulse-glow glow-blue">
          <Target className="w-8 h-8 text-white animate-bounce" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {missions.map((mission) => {
          const progress = getMissionProgress(mission.id);
          const status = getMissionStatus(mission.id);
          const userMissionId = getUserMissionId(mission.id);
          const percent = Math.min(Math.floor((progress / mission.requirement.value) * 100), 100);

          return (
            <motion.div
              key={mission.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              whileHover={{ y: -8, scale: 1.02 }}
              className={`p-6 rounded-[2.5rem] border transition-all ${
                status === 'claimed' 
                  ? 'bg-gray-50 dark:bg-gray-800/50 border-gray-100 dark:border-gray-800 opacity-60' 
                  : 'bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800 shadow-sm hover:border-blue-200 dark:hover:border-blue-900/30'
              }`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className={`p-3 rounded-2xl ${
                  status === 'claimed' ? 'bg-gray-200 text-gray-500' : 'bg-blue-50 text-blue-600'
                }`}>
                  {mission.requirement.type === 'orders' ? <Zap className="w-6 h-6" /> : 
                   mission.requirement.type === 'referrals' ? <Star className="w-6 h-6" /> : 
                   <Trophy className="w-6 h-6" />}
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Rewards</p>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-blue-600">+{mission.rewardXP} XP</span>
                    <span className="text-xs font-black text-yellow-600">+{mission.rewardPoints} PTS</span>
                  </div>
                </div>
              </div>

              <h3 className="text-lg font-black text-gray-800 dark:text-gray-100 mb-2">{mission.title}</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 font-bold mb-6">{mission.description}</p>

              <div className="space-y-4">
                <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest">
                  <span className="text-gray-400 dark:text-gray-500">Progress</span>
                  <span className="text-blue-600 dark:text-blue-400">{progress} / {mission.requirement.value}</span>
                </div>
                <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${percent}%` }}
                    className={`h-full ${status === 'claimed' ? 'bg-gray-400' : 'bg-blue-600'}`}
                  />
                </div>

                {status === 'completed' && (
                  <button
                    onClick={() => userMissionId && handleClaim(userMissionId)}
                    disabled={claiming === userMissionId}
                    className="w-full py-3 bg-blue-600 text-white text-xs font-black uppercase tracking-widest rounded-2xl hover:bg-blue-700 transition-all flex items-center justify-center gap-2 haptic-feedback glow-blue animate-pulse-glow"
                  >
                    {claiming === userMissionId ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Gift className="w-4 h-4" />
                        Claim Reward
                      </>
                    )}
                  </button>
                )}

                {status === 'claimed' && (
                  <div className="w-full py-3 bg-gray-100 dark:bg-gray-800 text-gray-400 text-xs font-black uppercase tracking-widest rounded-2xl flex items-center justify-center gap-2">
                    <CheckCircle2 className="w-4 h-4" />
                    Claimed
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

export default Missions;
