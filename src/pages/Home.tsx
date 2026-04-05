import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { UserCircle, UserCheck } from 'lucide-react';

const Home: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-12"
      >
        <h1 className="text-4xl font-bold text-blue-600 dark:text-blue-500 mb-2">WASHWISE</h1>
        <p className="text-gray-600 dark:text-gray-400">Smart laundry booking for students</p>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-md">
        <motion.button
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => navigate('/login?type=guest')}
          className="flex flex-col items-center justify-center p-8 bg-white dark:bg-gray-900 border-2 border-blue-100 dark:border-gray-800 rounded-2xl shadow-sm hover:shadow-md transition-all group"
        >
          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-full mb-4 group-hover:bg-blue-100 dark:group-hover:bg-blue-900/40 transition-colors">
            <UserCircle className="w-10 h-10 text-blue-600 dark:text-blue-400" />
          </div>
          <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100">Guest Login</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Quick one-time booking</p>
        </motion.button>

        <motion.button
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => navigate('/login?type=subscriber')}
          className="flex flex-col items-center justify-center p-8 bg-blue-600 dark:bg-blue-700 border-2 border-blue-600 dark:border-blue-700 rounded-2xl shadow-sm hover:shadow-md transition-all group"
        >
          <div className="bg-blue-500 dark:bg-blue-600 p-4 rounded-full mb-4 group-hover:bg-blue-400 dark:group-hover:bg-blue-500 transition-colors">
            <UserCheck className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-xl font-semibold text-white">Subscriber Login</h2>
          <p className="text-sm text-blue-100 dark:text-blue-200 mt-1">Manage your plan</p>
        </motion.button>
      </div>
    </div>
  );
};

export default Home;
