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
    <div className="space-y-6">
      {/* Limited-Time Offer Global Notice Banner */}
      {isOfferActive && !isSubscriber && (
        <div className="p-3.5 bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-500/10 border border-amber-500/30 dark:border-amber-500/20 rounded-2xl flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="px-2 py-0.5 bg-amber-500 text-white text-[10px] font-black uppercase tracking-wider rounded-md shadow-xs flex items-center gap-1">
              <Tag className="w-3 h-3" />
              LIMITED-TIME OFFER
            </span>
            <p className="text-xs font-bold text-amber-900 dark:text-amber-200">
              Special promotional piece rates applied. Save up to ₹10 on every garment!
            </p>
          </div>
        </div>
      )}

      {/* Subscriber Credits Context Banner */}
      {isSubscriber && (
        <div className="p-4 bg-gradient-to-r from-emerald-500/10 via-green-500/10 to-teal-500/10 border border-green-500/20 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-green-500/20 text-green-600 dark:text-green-400 flex items-center justify-center shrink-0">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-green-700 dark:text-green-300">
                  Subscriber Laundry Credits
                </span>
                <span className="px-2 py-0.5 bg-green-500/20 text-green-700 dark:text-green-300 text-[10px] font-black rounded-full">
                  ACTIVE BENEFIT
                </span>
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-300">
                Piece selections are automatically deducted from your monthly credit allowance (1 KG = 10 Credits).
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 self-end sm:self-center bg-white dark:bg-gray-800/80 px-4 py-2 rounded-xl border border-green-500/20 shadow-sm">
            <span className="text-[10px] font-black uppercase text-gray-500 tracking-wider">Available Balance:</span>
            <span className="text-sm font-black text-green-600 dark:text-green-400">
              🧺 {subscriberCreditsLeft} / {totalMonthlyCredits} Credits
            </span>
          </div>
        </div>
      )}

      {/* Category filter tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
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
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-2 shrink-0 ${
                isSelected
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-200 dark:shadow-none'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              {tab !== 'All' && getCategoryIcon(tab)}
              <span>{tab}</span>
              {countInTab > 0 && (
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${
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
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
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
              className={`p-4 sm:p-5 rounded-2xl border-2 transition-all flex flex-col justify-between relative ${
                isSelected
                  ? isSubscriber
                    ? 'bg-green-50/70 dark:bg-green-950/20 border-green-500 shadow-sm'
                    : 'bg-blue-50/70 dark:bg-blue-900/20 border-blue-600 shadow-sm'
                  : 'bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800 hover:border-blue-200 dark:hover:border-blue-800'
              }`}
            >
              {/* Limited offer mini badge */}
              {itemOfferActive && !isSubscriber && (
                <div className="absolute top-3 right-3 flex items-center gap-1.5">
                  <span className="px-2 py-0.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[9px] font-black uppercase tracking-wider rounded-full shadow-xs">
                    LIMITED OFFER
                  </span>
                </div>
              )}

              <div>
                <div className="flex items-start justify-between gap-2 mb-2 pr-16 sm:pr-24">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="inline-block text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-blue-100/70 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300">
                        {item.subCategory}
                      </span>
                      {item.avgWeight && (
                        <span className="inline-block text-[10px] font-bold text-gray-400 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">
                          avg {item.avgWeight}
                        </span>
                      )}
                    </div>
                    <h4 className="font-bold text-sm sm:text-base text-gray-900 dark:text-gray-100 leading-snug">
                      {item.name}
                    </h4>
                  </div>
                </div>

                {item.includes && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-3 italic">
                    Includes: {item.includes}
                  </p>
                )}

                {/* Hero Pricing Display with Strikethrough & Big Offer Price */}
                <div className="mt-2 mb-4 p-2.5 bg-gray-50/70 dark:bg-gray-800/40 rounded-xl border border-gray-100 dark:border-gray-800 flex items-center justify-between">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    {isSubscriber ? (
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-black text-green-600 dark:text-green-400">
                          {unitCredits} Credits
                        </span>
                        <span className="text-[11px] font-bold text-gray-400">
                          (₹{activeUnitPrice} tariff)
                        </span>
                      </div>
                    ) : itemOfferActive ? (
                      <div className="flex items-baseline gap-2 flex-wrap">
                        {/* Strikethrough Regular Price */}
                        <span className="text-xs sm:text-sm font-bold text-gray-400 dark:text-gray-500 line-through">
                          ₹{regPrice}
                        </span>
                        {/* Bold Offer Price */}
                        <span className="text-xl sm:text-2xl font-black text-blue-600 dark:text-blue-400 tracking-tight">
                          ₹{offPrice}
                        </span>
                        <span className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase">
                          / item
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-xl sm:text-2xl font-black text-gray-900 dark:text-gray-100">
                          ₹{regPrice}
                        </span>
                        <span className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase">
                          / item
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Savings Tag */}
                  {itemOfferActive && !isSubscriber && (
                    <div className="flex items-center gap-1 px-2 py-0.5 bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-800 rounded-md">
                      <ArrowDownRight className="w-3 h-3 text-green-600 dark:text-green-400" />
                      <span className="text-[10px] font-black text-green-600 dark:text-green-400 uppercase">
                        Save ₹{perItemSavings}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Quantity Stepper and Subtotal Footer */}
              <div className="pt-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between">
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {count > 0 ? (
                    isSubscriber ? (
                      <span className="font-bold text-green-600 dark:text-green-400">
                        Subtotal: {count * unitCredits} Credits
                      </span>
                    ) : (
                      <div className="flex flex-col">
                        <span className="font-bold text-blue-600 dark:text-blue-400">
                          Subtotal: ₹{count * activeUnitPrice}
                        </span>
                        {itemOfferActive && (
                          <span className="text-[10px] font-bold text-green-600 dark:text-green-400">
                            Saved: ₹{count * perItemSavings}
                          </span>
                        )}
                      </div>
                    )
                  ) : (
                    <span className="text-[11px] text-gray-400">
                      Select quantity
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => updateCount(item.id, -1)}
                    disabled={count === 0}
                    aria-label={`Decrease ${item.name}`}
                    className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all ${
                      count > 0
                        ? isSubscriber
                          ? 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 hover:bg-green-200'
                          : 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 hover:bg-blue-200'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-300 dark:text-gray-600 cursor-not-allowed'
                    }`}
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>

                  <input
                    type="number"
                    min="0"
                    max="99"
                    value={count === 0 ? '' : count}
                    placeholder="0"
                    onChange={(e) => setCountDirect(item.id, parseInt(e.target.value, 10))}
                    className="w-10 h-8 text-center font-bold text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-gray-800 dark:text-gray-100"
                  />

                  <button
                    type="button"
                    onClick={() => updateCount(item.id, 1)}
                    aria-label={`Increase ${item.name}`}
                    className={`w-8 h-8 rounded-xl text-white flex items-center justify-center transition-all shadow-sm ${
                      isSubscriber ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'
                    }`}
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Warnings if credits exceeded */}
      {isCreditsExceeded && (
        <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800 rounded-2xl flex items-start gap-3 text-amber-800 dark:text-amber-200 text-xs">
          <AlertCircle className="w-5 h-5 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
          <div>
            <p className="font-bold uppercase tracking-wider">Credit Allowance Exceeded</p>
            <p className="mt-0.5">
              You selected {totalCredits} Credits worth of garments, but have {subscriberCreditsLeft} Credits remaining this cycle. You can pay for excess items using direct ₹ pricing at checkout.
            </p>
          </div>
        </div>
      )}

      {/* Total Pieces & Subtotal Bar with Strikethrough & Savings */}
      <div className={`p-4 sm:p-5 rounded-2xl border flex flex-wrap items-center justify-between gap-4 ${
        isSubscriber
          ? 'bg-green-50/80 dark:bg-green-950/40 border-green-200/70 dark:border-green-800/50'
          : 'bg-blue-50/80 dark:bg-blue-950/40 border-blue-200/70 dark:border-blue-800/50'
      }`}>
        <div className="flex items-center gap-3.5">
          <div className={`w-11 h-11 rounded-xl text-white flex items-center justify-center font-black text-base shadow-sm ${
            isSubscriber ? 'bg-green-600' : 'bg-blue-600'
          }`}>
            {totalPieces}
          </div>
          <div>
            <p className={`text-xs font-black uppercase tracking-wider ${
              isSubscriber ? 'text-green-900 dark:text-green-200' : 'text-blue-900 dark:text-blue-200'
            }`}>
              {totalPieces === 1 ? '1 Garment Selected' : `${totalPieces} Garments Selected`}
            </p>
            <p className={`text-[11px] ${
              isSubscriber ? 'text-green-700/80 dark:text-green-300/80' : 'text-blue-700/80 dark:text-blue-300/80'
            }`}>
              {totalPieces > 0 ? 'Itemized custom garment wash & fold' : 'Select your tops, bottoms, combos, activewear or whites'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 block">
              {isSubscriber ? 'Credits Required' : 'Total Piece Amount'}
            </span>
            {isSubscriber ? (
              <span className="text-xl font-black text-green-600 dark:text-green-400">
                {totalCredits} Credits
              </span>
            ) : (
              <div className="flex items-baseline gap-2 justify-end">
                {isOfferActive && totalSavings > 0 && (
                  <span className="text-sm font-bold text-gray-400 dark:text-gray-500 line-through">
                    ₹{totalRegularPrice}
                  </span>
                )}
                <span className="text-xl sm:text-2xl font-black text-blue-600 dark:text-blue-400">
                  ₹{totalPrice}
                </span>
              </div>
            )}
            {!isSubscriber && isOfferActive && totalSavings > 0 && (
              <span className="text-[11px] font-black text-green-600 dark:text-green-400 block">
                You save ₹{totalSavings} with Offer!
              </span>
            )}
          </div>

          {totalPieces > 0 && (
            <button
              type="button"
              onClick={handleReset}
              className="p-2.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors"
              title="Reset Selection"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};


