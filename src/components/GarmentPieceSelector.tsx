import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Plus, Minus, Shirt, Sparkles, Layers, RotateCcw, Zap, AlertCircle, Sun, Tag, ArrowDownRight } from 'lucide-react';
import { GARMENT_CATALOG, GARMENT_CATEGORIES, calculateGarmentTotal } from '../data/garmentCatalog';
import { GarmentPieceItem } from '../types';

interface GarmentPieceSelectorProps {
  garmentCounts: Record<string, number>;
  onChange: (counts: Record<string, number>) => void;
  isSubscriber?: boolean;
  subscriberCreditsLeft?: number;
  totalMonthlyCredits?: number;
  customCatalog?: GarmentPieceItem[];
  isOfferActive?: boolean;
}

export const GarmentPieceSelector: React.FC<GarmentPieceSelectorProps> = ({
  garmentCounts,
  onChange,
  isSubscriber = false,
  subscriberCreditsLeft = 160,
  totalMonthlyCredits = 160,
  customCatalog,
  isOfferActive = true
}) => {
  const [activeCategoryTab, setActiveCategoryTab] = useState<'All' | 'Tops' | 'Bottoms' | 'Combos & Sets' | 'Activewear' | 'Whites' | string>('All');

  const catalog = customCatalog && customCatalog.length > 0 ? customCatalog : GARMENT_CATALOG;

  const updateCount = (itemId: string, delta: number) => {
    const current = garmentCounts[itemId] || 0;
    const next = Math.max(0, current + delta);
    const updated = { ...garmentCounts };
    if (next === 0) {
      delete updated[itemId];
    } else {
      updated[itemId] = next;
    }
    onChange(updated);
  };

  const setCountDirect = (itemId: string, value: number) => {
    const next = Math.max(0, isNaN(value) ? 0 : value);
    const updated = { ...garmentCounts };
    if (next === 0) {
      delete updated[itemId];
    } else {
      updated[itemId] = next;
    }
    onChange(updated);
  };

  const handleReset = () => {
    onChange({});
  };

  const {
    totalPieces,
    totalPrice,
    totalRegularPrice,
    totalSavings,
    totalCredits
  } = calculateGarmentTotal(garmentCounts, catalog, isOfferActive);

  const isCreditsExceeded = isSubscriber && totalCredits > subscriberCreditsLeft;

  const getCategoryIcon = (cat: string) => {
    switch (cat) {
      case 'Tops':
        return <Shirt className="w-4 h-4" />;
      case 'Bottoms':
        return <Layers className="w-4 h-4" />;
      case 'Combos & Sets':
        return <Sparkles className="w-4 h-4" />;
      case 'Activewear':
        return <Zap className="w-4 h-4" />;
      case 'Whites':
        return <Sun className="w-4 h-4" />;
      default:
        return <Shirt className="w-4 h-4" />;
    }
  };

  const filteredItems = activeCategoryTab === 'All'
    ? catalog
    : catalog.filter(item => item.category === activeCategoryTab);

  return (
    <div className="space-y-3 sm:space-y-6">
      {/* Limited-Time Offer Global Notice Banner */}
      {isOfferActive && !isSubscriber && (
        <div className="p-2.5 sm:p-3.5 bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-500/10 border border-amber-500/30 dark:border-amber-500/20 rounded-xl sm:rounded-2xl flex items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <span className="px-1.5 sm:px-2 py-0.5 bg-amber-500 text-white text-[9px] sm:text-[10px] font-black uppercase tracking-wider rounded-md shadow-xs flex items-center gap-1 shrink-0">
              <Tag className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
              OFFER
            </span>
            <p className="text-[11px] sm:text-xs font-bold text-amber-900 dark:text-amber-200 truncate">
              Promotional piece rates applied. Save up to ₹10/item!
            </p>
          </div>
        </div>
      )}

      {/* Subscriber Credits Context Banner */}
      {isSubscriber && (
        <div className="p-2.5 sm:p-4 bg-gradient-to-r from-emerald-500/10 via-green-500/10 to-teal-500/10 border border-green-500/20 rounded-xl sm:rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-3">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="w-7 h-7 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-green-500/20 text-green-600 dark:text-green-400 flex items-center justify-center shrink-0">
              <Zap className="w-3.5 h-3.5 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] sm:text-xs font-black uppercase tracking-wider text-green-700 dark:text-green-300">
                  Laundry Credits
                </span>
                <span className="px-1.5 py-0.2 bg-green-500/20 text-green-700 dark:text-green-300 text-[8.5px] sm:text-[10px] font-black rounded-full">
                  ACTIVE
                </span>
              </div>
              <p className="text-[10px] sm:text-xs text-gray-600 dark:text-gray-300 truncate">
                Deducted from monthly credit allowance (1 KG = 10 Credits).
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-center bg-white dark:bg-gray-800/80 px-2.5 sm:px-4 py-1 sm:py-2 rounded-lg sm:rounded-xl border border-green-500/20 shadow-xs shrink-0">
            <span className="text-[9px] sm:text-[10px] font-black uppercase text-gray-500 tracking-wider">Balance:</span>
            <span className="text-xs sm:text-sm font-black text-green-600 dark:text-green-400">
              {subscriberCreditsLeft} / {totalMonthlyCredits} Cr
            </span>
          </div>
        </div>
      )}

      {/* Category filter tabs */}
      <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-1 sm:pb-2 scrollbar-none">
        {(['All', ...GARMENT_CATEGORIES] as const).map(tab => {
          const isSelected = activeCategoryTab === tab;
          const countInTab = tab === 'All' 
            ? totalPieces 
            : catalog.filter(i => i.category === tab).reduce((s, i) => s + (garmentCounts[i.id] || 0), 0);

          return (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveCategoryTab(tab)}
              className={`px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1 sm:gap-2 shrink-0 ${
                isSelected
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              {tab !== 'All' && getCategoryIcon(tab)}
              <span>{tab}</span>
              {countInTab > 0 && (
                <span className={`px-1 sm:px-1.5 py-0.2 rounded-full text-[9px] sm:text-[10px] font-black ${
                  isSelected ? 'bg-white text-blue-600' : 'bg-blue-600 text-white'
                }`}>
                  {countInTab}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Garments Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3.5">
        {filteredItems.map(item => {
          const count = garmentCounts[item.id] || 0;
          const isSelected = count > 0;
          const unitCredits = item.subscriberCredits ?? 3;
          const regPrice = item.regular_price ?? item.price;
          const offPrice = item.offer_price ?? item.price;
          const itemOfferActive = isOfferActive && (item.offer_active !== false) && (regPrice > offPrice);
          const activeUnitPrice = itemOfferActive ? offPrice : regPrice;
          const perItemSavings = itemOfferActive ? (regPrice - offPrice) : 0;

          return (
            <motion.div
              key={item.id}
              layout
              className={`p-2.5 sm:p-4 rounded-xl sm:rounded-2xl border transition-all flex flex-col justify-between relative overflow-hidden ${
                isSelected
                  ? isSubscriber
                    ? 'bg-green-50/70 dark:bg-green-950/20 border-green-500 shadow-xs'
                    : 'bg-blue-50/70 dark:bg-blue-900/20 border-blue-600 shadow-xs'
                  : 'bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800 hover:border-blue-200 dark:hover:border-blue-800'
              }`}
            >
              {/* Limited offer mini badge */}
              {itemOfferActive && !isSubscriber && (
                <div className="absolute top-2 right-2 flex items-center gap-1">
                  <span className="px-1.5 py-0.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[8.5px] font-black uppercase tracking-wider rounded-md shadow-xs">
                    OFFER
                  </span>
                </div>
              )}

              <div>
                <div className="flex items-start justify-between gap-1 mb-1 pr-14 sm:pr-20">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1 flex-wrap">
                      <span className="inline-block text-[9px] sm:text-[10px] font-black uppercase tracking-wider px-1.5 py-0.2 rounded bg-blue-100/70 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300">
                        {item.subCategory}
                      </span>
                      {item.avgWeight && (
                        <span className="inline-block text-[9px] sm:text-[10px] font-bold text-gray-400 bg-gray-100 dark:bg-gray-800 px-1 py-0.2 rounded">
                          avg {item.avgWeight}
                        </span>
                      )}
                    </div>
                    <h4 className="font-bold text-xs sm:text-sm text-gray-900 dark:text-gray-100 leading-tight">
                      {item.name}
                    </h4>
                  </div>
                </div>

                {item.includes && (
                  <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 mb-1.5 italic truncate">
                    Includes: {item.includes}
                  </p>
                )}

                {/* Pricing Display */}
                <div className="mt-1.5 mb-2.5 p-1.5 sm:p-2 bg-gray-50/70 dark:bg-gray-800/40 rounded-lg sm:rounded-xl border border-gray-100 dark:border-gray-800 flex items-center justify-between gap-1">
                  <div className="flex items-baseline gap-1.5 flex-wrap">
                    {isSubscriber ? (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-sm sm:text-base font-black text-green-600 dark:text-green-400">
                          {unitCredits} Credits
                        </span>
                        <span className="text-[10px] sm:text-xs font-bold text-gray-500 dark:text-gray-400">
                          (₹{activeUnitPrice})
                        </span>
                      </div>
                    ) : itemOfferActive ? (
                      <div className="flex items-baseline gap-1.5 flex-wrap">
                        {/* Strikethrough Regular Price */}
                        <span className="text-[11px] sm:text-xs font-bold text-gray-400 dark:text-gray-500 line-through">
                          ₹{regPrice}
                        </span>
                        {/* Bold Offer Price */}
                        <span className="text-base sm:text-xl font-black text-blue-600 dark:text-blue-400 tracking-tight">
                          ₹{offPrice}
                        </span>
                        <span className="text-[9px] sm:text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase">
                          / item
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-baseline gap-1">
                        <span className="text-base sm:text-xl font-black text-gray-900 dark:text-gray-100">
                          ₹{regPrice}
                        </span>
                        <span className="text-[9px] sm:text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase">
                          / item
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Savings Tag */}
                  {itemOfferActive && !isSubscriber && (
                    <div className="flex items-center gap-0.5 px-1.5 py-0.2 bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-800 rounded">
                      <ArrowDownRight className="w-2.5 h-2.5 text-green-600 dark:text-green-400" />
                      <span className="text-[9px] font-black text-green-600 dark:text-green-400 uppercase">
                        Save ₹{perItemSavings}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Quantity Stepper and Subtotal Footer */}
              <div className="pt-2 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between gap-1">
                <div className="text-[11px] text-gray-500 dark:text-gray-400 min-w-0 truncate">
                  {count > 0 ? (
                    isSubscriber ? (
                      <span className="font-bold text-green-600 dark:text-green-400 truncate block">
                        {count * unitCredits} Cr <span className="text-[10px] font-normal text-gray-400">(₹{count * activeUnitPrice})</span>
                      </span>
                    ) : (
                      <div className="flex flex-col truncate">
                        <span className="font-bold text-blue-600 dark:text-blue-400 truncate">
                          Subtotal: ₹{count * activeUnitPrice}
                        </span>
                        {itemOfferActive && (
                          <span className="text-[9px] font-bold text-green-600 dark:text-green-400">
                            Saved ₹{count * perItemSavings}
                          </span>
                        )}
                      </div>
                    )
                  ) : (
                    <span className="text-[10px] text-gray-400">
                      Select qty
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => updateCount(item.id, -1)}
                    disabled={count === 0}
                    aria-label={`Decrease ${item.name}`}
                    className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all haptic-feedback touch-manipulation ${
                      count > 0
                        ? isSubscriber
                          ? 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 hover:bg-green-200'
                          : 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 hover:bg-blue-200'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-300 dark:text-gray-600 cursor-not-allowed'
                    }`}
                  >
                    <Minus className="w-3 h-3" />
                  </button>

                  <input
                    type="number"
                    min="0"
                    max="99"
                    value={count === 0 ? '' : count}
                    placeholder="0"
                    onChange={(e) => setCountDirect(item.id, parseInt(e.target.value, 10))}
                    className="w-8 h-7 text-center font-bold text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-1 focus:ring-blue-500 outline-none text-gray-800 dark:text-gray-100"
                  />

                  <button
                    type="button"
                    onClick={() => updateCount(item.id, 1)}
                    aria-label={`Increase ${item.name}`}
                    className={`w-7 h-7 rounded-lg text-white flex items-center justify-center transition-all shadow-xs haptic-feedback touch-manipulation ${
                      isSubscriber ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'
                    }`}
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Warnings if credits exceeded */}
      {isCreditsExceeded && (
        <div className="p-2.5 sm:p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800 rounded-xl sm:rounded-2xl flex items-start gap-2 text-amber-800 dark:text-amber-200 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
          <div>
            <p className="font-bold uppercase tracking-wider text-[11px] sm:text-xs">Credit Allowance Exceeded</p>
            <p className="mt-0.5 text-[10px] sm:text-xs">
              Selected {totalCredits} Credits (₹{totalPrice}) exceeds your {subscriberCreditsLeft} Credits remaining. Excess is payable at checkout.
            </p>
          </div>
        </div>
      )}

      {/* Total Pieces & Subtotal Bar with Strikethrough & Savings */}
      <div className={`p-2.5 sm:p-4 rounded-xl sm:rounded-2xl border flex flex-wrap items-center justify-between gap-2 sm:gap-4 ${
        isSubscriber
          ? 'bg-green-50/80 dark:bg-green-950/40 border-green-200/70 dark:border-green-800/50'
          : 'bg-blue-50/80 dark:bg-blue-950/40 border-blue-200/70 dark:border-blue-800/50'
      }`}>
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl text-white flex items-center justify-center font-black text-xs sm:text-sm shadow-xs shrink-0 ${
            isSubscriber ? 'bg-green-600' : 'bg-blue-600'
          }`}>
            {totalPieces}
          </div>
          <div className="min-w-0">
            <p className={`text-[11px] sm:text-xs font-black uppercase tracking-wider truncate ${
              isSubscriber ? 'text-green-900 dark:text-green-200' : 'text-blue-900 dark:text-blue-200'
            }`}>
              {totalPieces === 1 ? '1 Garment' : `${totalPieces} Garments`}
            </p>
            <p className={`text-[9.5px] sm:text-[11px] truncate ${
              isSubscriber ? 'text-green-700/80 dark:text-green-300/80' : 'text-blue-700/80 dark:text-blue-300/80'
            }`}>
              {totalPieces > 0 ? 'Custom garment wash & fold' : 'Select items above'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-4 ml-auto">
          <div className="text-right">
            <span className="text-[9px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 block">
              {isSubscriber ? 'Credits Due' : 'Amount'}
            </span>
            {isSubscriber ? (
              <div className="flex items-baseline gap-1 justify-end">
                <span className="text-sm sm:text-base font-black text-green-600 dark:text-green-400">
                  {totalCredits} Cr
                </span>
                <span className="text-[10px] sm:text-xs font-bold text-gray-500">
                  (₹{totalPrice})
                </span>
              </div>
            ) : (
              <div className="flex items-baseline gap-1 justify-end">
                {isOfferActive && totalSavings > 0 && (
                  <span className="text-[10px] sm:text-xs font-bold text-gray-400 dark:text-gray-500 line-through">
                    ₹{totalRegularPrice}
                  </span>
                )}
                <span className="text-sm sm:text-lg font-black text-blue-600 dark:text-blue-400">
                  ₹{totalPrice}
                </span>
              </div>
            )}
            {!isSubscriber && isOfferActive && totalSavings > 0 && (
              <span className="text-[9px] font-black text-green-600 dark:text-green-400 block">
                Save ₹{totalSavings}
              </span>
            )}
          </div>

          {totalPieces > 0 && (
            <button
              type="button"
              onClick={handleReset}
              className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors shrink-0"
              title="Reset Selection"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};


