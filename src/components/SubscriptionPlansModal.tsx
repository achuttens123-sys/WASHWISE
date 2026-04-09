import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, CheckCircle2, Zap, Star, Shield, Crown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useSettings } from '../context/SettingsContext';

interface SubscriptionPlansModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SubscriptionPlansModal: React.FC<SubscriptionPlansModalProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const { settings } = useSettings();

  const handleSelectPlan = (planId: string) => {
    navigate(`/billing?type=subscription&packageId=${planId}`);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-gray-950/80 backdrop-blur-sm"
        />
        
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="relative w-full max-w-5xl bg-white dark:bg-gray-900 rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="p-6 sm:p-8 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-gray-50 dark:bg-gray-800/50">
            <div>
              <h2 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white tracking-tight uppercase">Choose Your Plan</h2>
              <p className="text-xs sm:text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mt-1">Select the perfect subscription for your needs</p>
            </div>
            <button 
              onClick={onClose}
              className="p-3 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-2xl transition-colors"
            >
              <X className="w-6 h-6 text-gray-500" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6 sm:p-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {(settings?.subscriptionPlans || []).map((plan) => (
                <motion.div
                  key={plan.id}
                  whileHover={{ y: -8 }}
                  className={`relative p-6 rounded-[2rem] border-2 transition-all flex flex-col h-full ${
                    plan.id === 'premium' 
                      ? 'border-blue-500 bg-blue-50/30 dark:bg-blue-900/10 shadow-xl shadow-blue-100 dark:shadow-none' 
                      : 'border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 hover:border-blue-200 dark:hover:border-blue-800'
                  }`}
                >
                  {plan.id === 'premium' && (
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest rounded-full shadow-lg">
                      Most Popular
                    </div>
                  )}

                  <div className="mb-6">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 ${
                      plan.id === 'basic' ? 'bg-green-100 dark:bg-green-900/30 text-green-600' :
                      plan.id === 'standard' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600' :
                      plan.id === 'premium' ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-600' :
                      'bg-amber-100 dark:bg-amber-900/30 text-amber-600'
                    }`}>
                      {plan.id === 'basic' ? <Zap className="w-6 h-6" /> :
                       plan.id === 'standard' ? <Star className="w-6 h-6" /> :
                       plan.id === 'premium' ? <Crown className="w-6 h-6" /> :
                       <Shield className="w-6 h-6" />}
                    </div>
                    <h3 className="text-xl font-black text-gray-900 dark:text-white tracking-tight uppercase mb-1">{plan.name}</h3>
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-black tracking-tighter italic text-blue-600">₹{plan.price}</span>
                      <span className="text-gray-400 font-bold uppercase text-[10px]">/mo</span>
                    </div>
                    {plan.originalPrice && (
                      <p className="text-xs text-gray-400 line-through mt-1">₹{plan.originalPrice}</p>
                    )}
                  </div>

                  <div className="space-y-3 mb-8 flex-1">
                    <div className="flex items-center gap-2 text-xs font-bold text-gray-600 dark:text-gray-300">
                      <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                      <span>{plan.kgLimit} KG Monthly Limit</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs font-bold text-gray-600 dark:text-gray-300">
                      <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                      <span>Priority Machine Access</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs font-bold text-gray-600 dark:text-gray-300">
                      <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                      <span>Exclusive Rewards</span>
                    </div>
                    {plan.discount > 15 && (
                      <div className="flex items-center gap-2 text-xs font-bold text-gray-600 dark:text-gray-300">
                        <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                        <span>Max Savings ({plan.discount}%)</span>
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => handleSelectPlan(plan.id)}
                    className={`w-full py-4 text-[10px] font-black uppercase tracking-widest rounded-2xl transition-all haptic-feedback ${
                      plan.id === 'premium'
                        ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-200 dark:shadow-none glow-blue'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                    }`}
                  >
                    Select {plan.name}
                  </button>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="p-6 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-800 text-center">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em]">
              All plans include free pickup & drop for campus residents
            </p>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default SubscriptionPlansModal;
