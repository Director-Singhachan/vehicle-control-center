import React from 'react';

export type TripTabId =
  | 'overview'
  | 'stores'
  | 'products'
  | 'crew'
  | 'analytics'
  | 'history'
  | 'loading';

export interface TripTab {
  id: TripTabId;
  label: string;
  icon: React.ReactNode;
  badge?: number;
  badgeVariant?: 'default' | 'warning' | 'info';
}

interface TripDetailTabsProps {
  tabs: TripTab[];
  activeTab: TripTabId;
  onChange: (tab: TripTabId) => void;
  className?: string;
}

export const TripDetailTabs: React.FC<TripDetailTabsProps> = ({
  tabs,
  activeTab,
  onChange,
  className = '',
}) => {
  return (
    <div
      className={`
        bg-white/80 dark:bg-charcoal-900/50 backdrop-blur-md
        border border-slate-200 dark:border-slate-700/50
        rounded-xl shadow-sm mb-6 overflow-hidden
        ${className}
      `}
    >
      <div className="flex overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
        {tabs.map((tab) => {
          const isActive = tab.id === activeTab;

          const badgeClasses =
            tab.badgeVariant === 'warning'
              ? 'bg-amber-100 dark:bg-amber-800/60 text-amber-700 dark:text-amber-300'
              : tab.badgeVariant === 'info'
                ? 'bg-blue-100 dark:bg-blue-800/60 text-blue-700 dark:text-blue-300'
                : isActive
                  ? 'bg-enterprise-100 dark:bg-enterprise-800/60 text-enterprise-700 dark:text-enterprise-300'
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300';

          return (
            <button
              key={tab.id}
              onClick={() => onChange(tab.id)}
              className={`
                flex items-center gap-2 px-4 py-3.5 text-sm font-medium
                whitespace-nowrap border-b-2 transition-all duration-200
                flex-shrink-0 focus:outline-none
                ${
                  isActive
                    ? 'border-enterprise-500 text-enterprise-600 dark:text-enterprise-400 bg-enterprise-50/50 dark:bg-enterprise-900/20'
                    : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                }
              `}
            >
              <span className="flex-shrink-0">{tab.icon}</span>
              {tab.label}
              {tab.badge !== undefined && tab.badge > 0 && (
                <span
                  className={`
                    inline-flex items-center justify-center min-w-[20px] h-5 px-1.5
                    rounded-full text-[10px] font-semibold leading-none
                    ${badgeClasses}
                  `}
                >
                  {tab.badge > 99 ? '99+' : tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
