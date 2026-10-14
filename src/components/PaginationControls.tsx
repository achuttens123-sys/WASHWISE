import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

export interface PaginationControlsProps {
  currentPage: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (newPage: number) => void;
  onPageSizeChange?: (newPageSize: number) => void;
  pageSizeOptions?: number[];
  className?: string;
  itemLabel?: string;
}

export const PaginationControls: React.FC<PaginationControlsProps> = ({
  currentPage,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [5, 10, 25, 50],
  className = '',
  itemLabel = 'items'
}) => {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(totalItems, currentPage * pageSize);

  const canGoPrev = currentPage > 1;
  const canGoNext = currentPage < totalPages;

  return (
    <div className={`flex flex-col sm:flex-row items-center justify-between gap-3 py-3 px-4 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400 bg-slate-50/50 dark:bg-slate-900/40 rounded-b-xl ${className}`}>
      {/* Range text & Page size selector */}
      <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-start">
        <span className="font-mono tabular-nums">
          Showing <strong className="text-slate-900 dark:text-white font-semibold">{startItem}</strong> to{' '}
          <strong className="text-slate-900 dark:text-white font-semibold">{endItem}</strong> of{' '}
          <strong className="text-slate-900 dark:text-white font-semibold">{totalItems}</strong> {itemLabel}
        </span>

        {onPageSizeChange && (
          <div className="flex items-center gap-1.5 ml-2">
            <label htmlFor="pagination-page-size" className="text-[11px] text-slate-500 hidden sm:inline">
              Per page:
            </label>
            <select
              id="pagination-page-size"
              aria-label="Select number of items per page"
              value={pageSize}
              onChange={(e) => {
                const newSize = Number(e.target.value);
                onPageSizeChange(newSize);
                onPageChange(1);
              }}
              className="py-1 px-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-xs font-mono text-slate-800 dark:text-slate-200 outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Navigation Buttons */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(1)}
          disabled={!canGoPrev}
          aria-label="Go to first page"
          className="min-h-[36px] min-w-[36px] p-1.5 rounded-md flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none transition-colors focus-visible:ring-2 focus-visible:ring-indigo-500 outline-none"
        >
          <ChevronsLeft className="w-4 h-4" />
        </button>

        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={!canGoPrev}
          aria-label="Go to previous page"
          className="min-h-[36px] px-2.5 py-1.5 rounded-md flex items-center gap-1 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none font-medium transition-colors focus-visible:ring-2 focus-visible:ring-indigo-500 outline-none"
        >
          <ChevronLeft className="w-4 h-4" />
          <span className="hidden sm:inline">Prev</span>
        </button>

        <span className="px-2 font-mono tabular-nums text-slate-700 dark:text-slate-300">
          Page <strong className="text-slate-900 dark:text-white">{currentPage}</strong> of{' '}
          <strong className="text-slate-900 dark:text-white">{totalPages}</strong>
        </span>

        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={!canGoNext}
          aria-label="Go to next page"
          className="min-h-[36px] px-2.5 py-1.5 rounded-md flex items-center gap-1 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none font-medium transition-colors focus-visible:ring-2 focus-visible:ring-indigo-500 outline-none"
        >
          <span className="hidden sm:inline">Next</span>
          <ChevronRight className="w-4 h-4" />
        </button>

        <button
          onClick={() => onPageChange(totalPages)}
          disabled={!canGoNext}
          aria-label="Go to last page"
          className="min-h-[36px] min-w-[36px] p-1.5 rounded-md flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none transition-colors focus-visible:ring-2 focus-visible:ring-indigo-500 outline-none"
        >
          <ChevronsRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
