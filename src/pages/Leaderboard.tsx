import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Trophy, 
  Medal, 
  Crown, 
  TrendingUp, 
  Users, 
  MapPin, 
  Search, 
  ChevronRight,
  Loader2,
  Star
} from 'lucide-react';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { LeaderboardEntry } from '../types';

const Leaderboard: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'weekly' | 'overall' | 'hostel'>('weekly');
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    setLoading(true);
    const q = query(
      collection(db, 'leaderboard'),
      orderBy(activeTab === 'weekly' ? 'weeklyScore' : 'totalScore', 'desc'),
      limit(100)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc, index) => ({
        ...doc.data(),
        rank: index + 1
      })) as LeaderboardEntry[];
      setEntries(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [activeTab]);

  const filteredEntries = entries.filter(e => 
    e.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.hostel?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const currentUserEntry = entries.find(e => e.userId === user?.uid);

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1: return <Crown className="w-6 h-6 text-yellow-500" />;
      case 2: return <Medal className="w-6 h-6 text-gray-400" />;
      case 3: return <Medal className="w-6 h-6 text-amber-600" />;
      default: return <span className="text-sm font-black text-gray-400">#{rank}</span>;
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-black text-gray-800 dark:text-gray-100 tracking-tight uppercase">Leaderboard</h1>
          <p className="text-gray-500 dark:text-gray-400 font-bold uppercase tracking-widest text-xs">
            Compete with others and earn rewards
          </p>
        </div>
        <div className="p-4 bg-yellow-500 rounded-3xl shadow-xl shadow-yellow-200 dark:shadow-none animate-pulse-glow glow-amber">
          <Trophy className="w-8 h-8 text-white animate-bounce" />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex p-1 bg-gray-100 dark:bg-gray-800 rounded-[2rem]">
        {(['weekly', 'overall', 'hostel'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-3 text-xs font-black uppercase tracking-widest rounded-[1.8rem] transition-all relative haptic-feedback ${
              activeTab === tab ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab}
            {activeTab === tab && (
              <motion.div
                layoutId="activeTab"
                className="absolute inset-0 bg-white dark:bg-gray-900 rounded-[1.8rem] shadow-sm -z-10"
              />
            )}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          placeholder="Search players or hostels..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-12 pr-6 py-4 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-[2rem] text-sm font-bold outline-none focus:ring-4 focus:ring-blue-500/10 transition-all"
        />
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin mb-4" />
          <p className="text-gray-500 font-black uppercase tracking-widest text-sm">Loading Ranks...</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Top 3 */}
          <div className="grid grid-cols-3 gap-4 mb-8">
            {[2, 1, 3].map((pos) => {
              const entry = entries.find(e => e.rank === pos);
              if (!entry) return null;
              return (
                <motion.div
                  key={pos}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  whileHover={{ y: -12, scale: pos === 1 ? 1.15 : 1.05 }}
                  className={`flex flex-col items-center p-6 rounded-[2.5rem] relative transition-all ${
                    pos === 1 
                      ? 'bg-blue-600 text-white scale-110 z-10 shadow-2xl shadow-blue-200 dark:shadow-none glow-blue' 
                      : 'bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800'
                  }`}
                >
                  <div className="absolute -top-4">
                    {getRankIcon(pos)}
                  </div>
                  <div className={`w-16 h-16 rounded-2xl mb-4 overflow-hidden border-4 ${pos === 1 ? 'border-blue-400' : 'border-gray-100 dark:border-gray-800'}`}>
                    <img 
                      src={entry.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${entry.userName}`} 
                      alt={entry.userName}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <p className={`text-sm font-black truncate w-full text-center ${pos === 1 ? 'text-white' : 'text-gray-800 dark:text-gray-100'}`}>
                    {entry.userName}
                  </p>
                  <p className={`text-[10px] font-black uppercase tracking-widest ${pos === 1 ? 'text-blue-200' : 'text-gray-400 dark:text-gray-500'}`}>
                    {activeTab === 'weekly' ? entry.weeklyScore : entry.totalScore} PTS
                  </p>
                </motion.div>
              );
            })}
          </div>

          {/* List */}
          <div className="bg-white dark:bg-gray-900 rounded-[2.5rem] border border-gray-100 dark:border-gray-800 overflow-hidden">
            {filteredEntries.slice(3).map((entry) => (
              <div 
                key={entry.userId}
                className={`flex items-center justify-between p-6 border-b border-gray-50 dark:border-gray-800 last:border-0 ${
                  entry.userId === user?.uid ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className="w-8 text-center">
                    <span className="text-sm font-black text-gray-400 dark:text-gray-500">#{entry.rank}</span>
                  </div>
                  <div className="w-10 h-10 rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-800">
                    <img 
                      src={entry.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${entry.userName}`} 
                      alt={entry.userName}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div>
                    <p className="text-sm font-black text-gray-800 dark:text-gray-100">{entry.userName}</p>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1">
                      <MapPin className="w-2 h-2" /> {entry.hostel || 'Main Campus'}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-black text-blue-600 dark:text-blue-400">
                    {activeTab === 'weekly' ? entry.weeklyScore : entry.totalScore}
                  </p>
                  <p className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">Points</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pinned User Rank */}
      {currentUserEntry && (
        <motion.div 
          initial={{ y: 100 }}
          animate={{ y: 0 }}
          className="fixed bottom-24 left-4 right-4 max-w-4xl mx-auto bg-blue-600 text-white p-4 rounded-[2rem] shadow-2xl flex items-center justify-between z-50 animate-pulse-glow glow-blue"
        >
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center font-black">
              #{currentUserEntry.rank}
            </div>
            <div>
              <p className="text-sm font-black">Your Rank</p>
              <p className="text-[10px] font-bold text-blue-200 uppercase tracking-widest">Keep going to reach top 10!</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-lg font-black">{activeTab === 'weekly' ? currentUserEntry.weeklyScore : currentUserEntry.totalScore}</p>
            <p className="text-[10px] font-black text-blue-200 uppercase tracking-widest">Points</p>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default Leaderboard;
