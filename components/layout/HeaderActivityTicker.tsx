import React from 'react';
import { Clock, Truck, CheckCircle2, Activity } from 'lucide-react';
import type { ActivityTickerItem } from '../../hooks/useActivityTicker';

interface HeaderActivityTickerProps {
    items: ActivityTickerItem[];
    loading: boolean;
    showBranchTag?: boolean;
}

const iconMap = {
    pending_orders: Clock,
    active_trip: Truck,
    order_assigned: CheckCircle2,
};

const colorMap = {
    amber: {
        bg: 'bg-amber-500/15 dark:bg-amber-400/10',
        text: 'text-amber-700 dark:text-amber-300',
        icon: 'text-amber-500 dark:text-amber-400',
        dot: 'bg-amber-500',
    },
    blue: {
        bg: 'bg-blue-500/15 dark:bg-blue-400/10',
        text: 'text-blue-700 dark:text-blue-300',
        icon: 'text-blue-500 dark:text-blue-400',
        dot: 'bg-blue-500',
    },
    green: {
        bg: 'bg-emerald-500/15 dark:bg-emerald-400/10',
        text: 'text-emerald-700 dark:text-emerald-300',
        icon: 'text-emerald-500 dark:text-emerald-400',
        dot: 'bg-emerald-500',
    },
};

export const HeaderActivityTicker: React.FC<HeaderActivityTickerProps> = ({
    items,
    loading,
    showBranchTag = false,
}) => {
    if (loading) {
        return (
            <div className="ml-4 hidden md:flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500">
                <Activity size={14} className="animate-pulse" />
                <span>กำลังโหลดกิจกรรม...</span>
            </div>
        );
    }

    if (items.length === 0) {
        return (
            <div className="ml-4 hidden md:flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500">
                <Activity size={14} />
                <span>ไม่มีกิจกรรมค้างดำเนินการ</span>
            </div>
        );
    }

    // Duplicate items for seamless loop
    const duplicatedItems = [...items, ...items, ...items];

    return (
        <div className="ml-4 hidden md:flex items-center flex-1 min-w-0 max-w-[600px] lg:max-w-[800px]">
            <div className="relative w-full overflow-hidden rounded-full bg-slate-50/80 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/40 h-9">
                {/* Ticker content */}
                <div className="ticker-header-wrapper h-full">
                    <div className="ticker-header-content h-full">
                        {duplicatedItems.map((item, index) => {
                            const Icon = iconMap[item.type];
                            const colors = colorMap[item.color];
                            return (
                                <div
                                    key={`${item.id}-${index}`}
                                    className="ticker-header-item inline-flex items-center gap-2 px-3 h-full"
                                >
                                    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full ${colors.bg}`}>
                                        <Icon size={13} className={colors.icon} />
                                        <span className={`text-xs font-medium whitespace-nowrap ${colors.text}`}>
                                            {item.label}
                                        </span>
                                        {showBranchTag && item.branch && (
                                            <span className="text-[10px] font-bold opacity-60 ml-0.5">
                                                [{item.branch}]
                                            </span>
                                        )}
                                    </div>
                                    {/* Dot separator */}
                                    <div className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-600 mx-1 flex-shrink-0" />
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Gradient fades */}
                <div className="absolute top-0 left-0 h-full w-8 bg-gradient-to-r from-slate-50/80 dark:from-slate-800/50 to-transparent pointer-events-none z-10" />
                <div className="absolute top-0 right-0 h-full w-8 bg-gradient-to-l from-slate-50/80 dark:from-slate-800/50 to-transparent pointer-events-none z-10" />
            </div>

            <style>{`
        .ticker-header-wrapper {
          width: 100%;
          overflow: hidden;
        }

        .ticker-header-content {
          display: inline-flex;
          align-items: center;
          animation: tickerHeader 40s linear infinite;
          will-change: transform;
        }

        .ticker-header-item {
          flex-shrink: 0;
          white-space: nowrap;
        }

        @keyframes tickerHeader {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-33.333%);
          }
        }

        /* Pause on hover */
        .ticker-header-wrapper:hover .ticker-header-content {
          animation-play-state: paused;
        }

        @media (prefers-reduced-motion: reduce) {
          .ticker-header-content {
            animation: none;
          }
        }
      `}</style>
        </div>
    );
};
