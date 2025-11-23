// Skeleton Loading Components - Better UX than full-screen loading
import React from 'react';

export const SkeletonCard: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`bg-white dark:bg-charcoal-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 animate-pulse ${className}`}>
    <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/3 mb-4"></div>
    <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-1/2 mb-2"></div>
    <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-2/3"></div>
  </div>
);

export const SkeletonText: React.FC<{ lines?: number; className?: string }> = ({ 
  lines = 3, 
  className = '' 
}) => (
  <div className={`space-y-2 ${className}`}>
    {Array.from({ length: lines }).map((_, i) => (
      <div
        key={i}
        className={`h-4 bg-slate-200 dark:bg-slate-700 rounded animate-pulse ${
          i === lines - 1 ? 'w-2/3' : 'w-full'
        }`}
      />
    ))}
  </div>
);

export const SkeletonTable: React.FC<{ rows?: number; cols?: number }> = ({ 
  rows = 5, 
  cols = 4 
}) => (
  <div className="space-y-3">
    {/* Header */}
    <div className="flex gap-4 pb-2 border-b border-slate-200 dark:border-slate-700">
      {Array.from({ length: cols }).map((_, i) => (
        <div
          key={i}
          className="h-4 bg-slate-200 dark:bg-slate-700 rounded flex-1 animate-pulse"
        />
      ))}
    </div>
    {/* Rows */}
    {Array.from({ length: rows }).map((_, rowIdx) => (
      <div key={rowIdx} className="flex gap-4">
        {Array.from({ length: cols }).map((_, colIdx) => (
          <div
            key={colIdx}
            className="h-4 bg-slate-200 dark:bg-slate-700 rounded flex-1 animate-pulse"
          />
        ))}
      </div>
    ))}
  </div>
);

