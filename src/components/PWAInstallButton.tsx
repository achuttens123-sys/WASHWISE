import React, { useState } from 'react';
import { Download, Smartphone, Share, PlusSquare, X, CheckCircle, Sparkles } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  className?: string;
  variant?: 'header' | 'banner' | 'profile';
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  className = '',
  variant = 'header',
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [justInstalled, setJustInstalled] = useState(false);

  // If already running in standalone / installed PWA mode, suppress install button
  if (isInstalled) {
    return null;
  }

  const handleInstallClick = async () => {
    if (isInstallable) {
      const success = await install();
      if (success) {
        setJustInstalled(true);
        setTimeout(() => setJustInstalled(false), 4000);
      }
    } else if (isIOS) {
      setShowIOSGuide(true);
    } else {
      // General instructions for desktop Chrome / Edge or browsers before prompt event fires
      setShowIOSGuide(true);
    }
  };

  if (variant === 'profile') {
    return (
      <>
        <div className={`p-4 sm:p-6 bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-950/20 dark:to-blue-950/20 rounded-2xl sm:rounded-3xl border border-indigo-100 dark:border-indigo-900/40 ${className}`}>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="p-3 bg-primary-electric text-white rounded-2xl shadow-md shadow-primary-electric/20 shrink-0">
                <Smartphone className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-sm sm:text-base font-black text-gray-900 dark:text-white uppercase tracking-tight">
                    Install WashWise App
                  </h4>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mt-0.5">
                  Fast 1-tap home screen launcher, fullscreen interface & instant slot booking
                </p>
              </div>
            </div>

            <button
              onClick={handleInstallClick}
              className="w-full sm:w-auto px-5 py-3 bg-primary-electric hover:bg-blue-600 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all shadow-md shadow-primary-electric/25 flex items-center justify-center gap-2 shrink-0 haptic-feedback"
            >
              <Download className="w-4 h-4" />
              <span>Install to Phone / PC</span>
            </button>
          </div>
        </div>

        {/* Modal Guide */}
        {showIOSGuide && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <div
              onClick={() => setShowIOSGuide(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm cursor-pointer"
            />
            <div className="relative z-10 w-full max-w-sm rounded-3xl bg-white dark:bg-gray-900 p-6 sm:p-7 shadow-2xl border border-gray-100 dark:border-gray-800">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 rounded-xl">
                    <Smartphone className="w-5 h-5" />
                  </div>
                  <h3 className="text-base font-black uppercase tracking-tight text-gray-900 dark:text-white">
                    {isIOS ? 'Install on iPhone / iPad' : 'Install on Your Device'}
                  </h3>
                </div>
                <button
                  onClick={() => setShowIOSGuide(false)}
                  className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {isIOS ? (
                <div className="space-y-3.5 text-xs text-gray-600 dark:text-gray-300 font-medium">
                  <div className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-800/60 rounded-xl">
                    <span className="w-5 h-5 bg-indigo-600 text-white rounded-full flex items-center justify-center text-[10px] font-black shrink-0">1</span>
                    <p>Tap the <Share className="w-3.5 h-3.5 inline mx-1 text-primary-electric" /> <strong>Share</strong> icon in the Safari bottom bar.</p>
                  </div>
                  <div className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-800/60 rounded-xl">
                    <span className="w-5 h-5 bg-indigo-600 text-white rounded-full flex items-center justify-center text-[10px] font-black shrink-0">2</span>
                    <p>Scroll down and select <PlusSquare className="w-3.5 h-3.5 inline mx-1 text-primary-electric" /> <strong>Add to Home Screen</strong>.</p>
                  </div>
                  <div className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-800/60 rounded-xl">
                    <span className="w-5 h-5 bg-indigo-600 text-white rounded-full flex items-center justify-center text-[10px] font-black shrink-0">3</span>
                    <p>Tap <strong>Add</strong> in the top right corner. WashWise will appear on your home screen!</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3 text-xs text-gray-600 dark:text-gray-300 font-medium">
                  <p>In Chrome or Edge, click the <strong>Install WashWise</strong> icon in the address bar (or browser menu ⋮ &rarr; <strong>Install WashWise</strong> or <strong>Add to Home Screen</strong>).</p>
                  <p className="text-gray-400 text-[11px]">This creates a desktop or mobile application icon with a standalone window.</p>
                </div>
              )}

              <button
                onClick={() => setShowIOSGuide(false)}
                className="mt-5 w-full rounded-xl bg-gray-100 dark:bg-gray-800 py-3 text-xs font-black uppercase tracking-wider text-gray-800 dark:text-gray-200 hover:bg-gray-200 transition-colors"
              >
                Got It
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  // Header compact button
  return (
    <>
      <button
        onClick={handleInstallClick}
        aria-label="Install WashWise Application"
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary-electric/10 hover:bg-primary-electric text-primary-electric hover:text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all haptic-feedback shrink-0 ${className}`}
      >
        <Download className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Install App</span>
      </button>

      {/* Guide modal for iOS or non-prompting browsers */}
      {showIOSGuide && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div
            onClick={() => setShowIOSGuide(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm cursor-pointer"
          />
          <div className="relative z-10 w-full max-w-sm rounded-3xl bg-white dark:bg-gray-900 p-6 sm:p-7 shadow-2xl border border-gray-100 dark:border-gray-800">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 rounded-xl">
                  <Smartphone className="w-5 h-5" />
                </div>
                <h3 className="text-base font-black uppercase tracking-tight text-gray-900 dark:text-white">
                  {isIOS ? 'Install on iPhone / iPad' : 'Install on Your Device'}
                </h3>
              </div>
              <button
                onClick={() => setShowIOSGuide(false)}
                className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {isIOS ? (
              <div className="space-y-3.5 text-xs text-gray-600 dark:text-gray-300 font-medium">
                <div className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-800/60 rounded-xl">
                  <span className="w-5 h-5 bg-indigo-600 text-white rounded-full flex items-center justify-center text-[10px] font-black shrink-0">1</span>
                  <p>Tap the <Share className="w-3.5 h-3.5 inline mx-1 text-primary-electric" /> <strong>Share</strong> icon in the Safari bottom bar.</p>
                </div>
                <div className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-800/60 rounded-xl">
                  <span className="w-5 h-5 bg-indigo-600 text-white rounded-full flex items-center justify-center text-[10px] font-black shrink-0">2</span>
                  <p>Scroll down and tap <PlusSquare className="w-3.5 h-3.5 inline mx-1 text-primary-electric" /> <strong>Add to Home Screen</strong>.</p>
                </div>
                <div className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-800/60 rounded-xl">
                  <span className="w-5 h-5 bg-indigo-600 text-white rounded-full flex items-center justify-center text-[10px] font-black shrink-0">3</span>
                  <p>Tap <strong>Add</strong> in the top right corner.</p>
                </div>
              </div>
            ) : (
              <div className="space-y-3 text-xs text-gray-600 dark:text-gray-300 font-medium">
                <p>To install WashWise on your computer or Android phone, click the install icon in your browser's address bar or menu (⋮ &rarr; <strong>Install WashWise</strong>).</p>
              </div>
            )}

            <button
              onClick={() => setShowIOSGuide(false)}
              className="mt-5 w-full rounded-xl bg-gray-100 dark:bg-gray-800 py-3 text-xs font-black uppercase tracking-wider text-gray-800 dark:text-gray-200 hover:bg-gray-200 transition-colors"
            >
              Got It
            </button>
          </div>
        </div>
      )}
    </>
  );
};
