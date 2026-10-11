import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Download, Smartphone, Laptop, CheckCircle, Share, PlusSquare, ArrowRight, ShieldCheck, Sparkles, Zap, RefreshCw } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { useNavigate } from 'react-router-dom';

const InstallApp: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [installSuccess, setInstallSuccess] = useState(false);
  const [installing, setInstalling] = useState(false);
  const navigate = useNavigate();

  const handleInstallClick = async () => {
    if (isInstallable) {
      setInstalling(true);
      try {
        const success = await install();
        if (success) {
          setInstallSuccess(true);
        }
      } finally {
        setInstalling(false);
      }
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 sm:py-16">
      {/* Header Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-10 sm:mb-14"
      >
        {/* Brand App Icon Display */}
        <div className="w-24 h-24 sm:w-28 sm:h-28 mx-auto mb-6 flex items-center justify-center">
          <img
            src="/pwa-192x192.png"
            alt="WashWise Logo"
            className="w-full h-full object-contain rounded-3xl shadow-lg"
          />
        </div>

        <h1 className="text-3xl sm:text-5xl font-black font-display text-gray-900 dark:text-white tracking-tight uppercase">
          Install WashWise
        </h1>
        <p className="mt-3 text-sm sm:text-base text-gray-500 dark:text-gray-400 max-w-lg mx-auto font-medium">
          Get the fast, full-screen native app experience on your phone, tablet, or desktop with 1 tap.
        </p>
      </motion.div>

      {/* Main Action Box */}
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.1 }}
        className="bg-white dark:bg-gray-900 rounded-3xl sm:rounded-[2.5rem] border border-gray-100 dark:border-gray-800 p-6 sm:p-10 shadow-xl mb-10 text-center"
      >
        {isInstalled || installSuccess ? (
          <div className="py-6 space-y-4">
            <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto">
              <CheckCircle className="w-8 h-8" />
            </div>
            <h3 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tight">
              App Already Installed!
            </h3>
            <p className="text-sm text-gray-500 max-w-md mx-auto">
              WashWise is installed on your device. Open it from your home screen or desktop launcher, or continue inside this browser.
            </p>
            <button
              onClick={() => navigate('/dashboard')}
              className="mt-4 px-8 py-3.5 bg-[#3b5bfd] hover:bg-blue-600 text-white font-black uppercase tracking-wider text-xs rounded-xl shadow-lg shadow-blue-500/25 transition-all inline-flex items-center gap-2"
            >
              <span>Go to Dashboard</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        ) : isInstallable ? (
          <div className="space-y-6">
            <div className="inline-block p-4 rounded-2xl bg-blue-50 dark:bg-blue-950/30 text-[#3b5bfd]">
              <Download className="w-10 h-10 animate-bounce" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tight">
                Ready to Install
              </h2>
              <p className="text-xs sm:text-sm text-gray-500 max-w-md mx-auto mt-1">
                Click below to add WashWise directly to your home screen with no app store downloads needed.
              </p>
            </div>
            <button
              onClick={handleInstallClick}
              disabled={installing}
              className="w-full sm:w-auto px-10 py-4 bg-[#3b5bfd] hover:bg-blue-600 active:scale-95 text-white font-black uppercase tracking-widest text-sm rounded-2xl shadow-xl shadow-blue-500/30 transition-all inline-flex items-center justify-center gap-3"
            >
              <Download className="w-5 h-5" />
              <span>{installing ? 'Opening Prompt...' : 'Install WashWise Now'}</span>
            </button>
          </div>
        ) : isIOS ? (
          <div className="text-left space-y-6 max-w-lg mx-auto">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-50 dark:bg-blue-950/30 text-[#3b5bfd] rounded-2xl">
                <Smartphone className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-tight">
                  How to Install on iPhone / iPad (Safari)
                </h3>
                <p className="text-xs text-gray-500">Requires Safari on iOS</p>
              </div>
            </div>

            <div className="space-y-3 text-xs sm:text-sm text-gray-700 dark:text-gray-300 font-medium">
              <div className="flex items-start gap-3 p-3.5 bg-gray-50 dark:bg-gray-800/70 rounded-2xl">
                <span className="w-6 h-6 bg-[#3b5bfd] text-white rounded-full flex items-center justify-center text-xs font-black shrink-0">1</span>
                <p>Tap the <Share className="w-4 h-4 inline mx-1 text-[#3b5bfd]" /> <strong>Share</strong> icon in the bottom toolbar of Safari.</p>
              </div>
              <div className="flex items-start gap-3 p-3.5 bg-gray-50 dark:bg-gray-800/70 rounded-2xl">
                <span className="w-6 h-6 bg-[#3b5bfd] text-white rounded-full flex items-center justify-center text-xs font-black shrink-0">2</span>
                <p>Scroll down in the share sheet and tap <PlusSquare className="w-4 h-4 inline mx-1 text-[#3b5bfd]" /> <strong>Add to Home Screen</strong>.</p>
              </div>
              <div className="flex items-start gap-3 p-3.5 bg-gray-50 dark:bg-gray-800/70 rounded-2xl">
                <span className="w-6 h-6 bg-[#3b5bfd] text-white rounded-full flex items-center justify-center text-xs font-black shrink-0">3</span>
                <p>Tap <strong>Add</strong> in the top right corner. WashWise will appear on your phone home screen with its official icon!</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6 text-left max-w-lg mx-auto">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-50 dark:bg-blue-950/30 text-[#3b5bfd] rounded-2xl">
                <Laptop className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-tight">
                  Install via Browser Menu
                </h3>
                <p className="text-xs text-gray-500">Chrome, Edge, Samsung Internet, Brave</p>
              </div>
            </div>

            <div className="space-y-3 text-xs sm:text-sm text-gray-700 dark:text-gray-300 font-medium">
              <div className="p-3.5 bg-gray-50 dark:bg-gray-800/70 rounded-2xl">
                <p className="font-bold text-gray-900 dark:text-white mb-1">On Android:</p>
                <p>Tap the <strong>⋮ (three dots)</strong> menu in Chrome &rarr; select <strong>Install App</strong> or <strong>Add to Home screen</strong>.</p>
              </div>
              <div className="p-3.5 bg-gray-50 dark:bg-gray-800/70 rounded-2xl">
                <p className="font-bold text-gray-900 dark:text-white mb-1">On Computer (Mac/PC):</p>
                <p>Click the <strong>Install WashWise icon</strong> (<Download className="w-3.5 h-3.5 inline mx-1 text-[#3b5bfd]" />) at the right edge of your browser URL address bar.</p>
              </div>
            </div>

            <div className="pt-2 text-center">
              <button
                onClick={() => window.location.reload()}
                className="inline-flex items-center gap-2 text-xs font-bold text-[#3b5bfd] hover:underline"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Reload page to trigger install prompt</span>
              </button>
            </div>
          </div>
        )}
      </motion.div>

      {/* Feature Highlights Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
        <div className="p-6 bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800">
          <div className="w-10 h-10 bg-blue-50 dark:bg-blue-950/30 text-[#3b5bfd] rounded-xl flex items-center justify-center mb-3">
            <Zap className="w-5 h-5" />
          </div>
          <h4 className="text-sm font-black text-gray-900 dark:text-white uppercase">Instant Launch</h4>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Zero app store downloads. Launches in &lt;1 second directly from your home screen.
          </p>
        </div>

        <div className="p-6 bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800">
          <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 rounded-xl flex items-center justify-center mb-3">
            <Smartphone className="w-5 h-5" />
          </div>
          <h4 className="text-sm font-black text-gray-900 dark:text-white uppercase">Full Screen App Mode</h4>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Hides browser navigation tabs and URL bars for an immersive mobile app look and feel.
          </p>
        </div>

        <div className="p-6 bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800">
          <div className="w-10 h-10 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 rounded-xl flex items-center justify-center mb-3">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <h4 className="text-sm font-black text-gray-900 dark:text-white uppercase">Offline & Lightweight</h4>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Cached assets save your mobile data and load fast even on weak campus Wi-Fi networks.
          </p>
        </div>
      </div>
    </div>
  );
};

export default InstallApp;
