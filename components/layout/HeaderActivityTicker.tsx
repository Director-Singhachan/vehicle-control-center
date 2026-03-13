import React, { useState, useEffect, useRef } from 'react';
import { Clock, Truck, CheckCircle2, Activity, ChevronDown, X } from 'lucide-react';
import type { ActivityTickerItem } from '../../hooks/useActivityTicker';

interface HeaderActivityTickerProps {
    items: ActivityTickerItem[];
    loading: boolean;
    showBranchTag?: boolean;
}

const iconMap = {
    pending_order: Clock,
    active_trip: Truck,
    order_assigned: CheckCircle2,
};

const colorMap = {
    amber: {
        bg: 'bg-amber-500/15 dark:bg-amber-400/10',
        text: 'text-amber-700 dark:text-amber-300',
        icon: 'text-amber-500 dark:text-amber-400',
        border: 'border-amber-200 dark:border-amber-800/50',
    },
    blue: {
        bg: 'bg-blue-500/15 dark:bg-blue-400/10',
        text: 'text-blue-700 dark:text-blue-300',
        icon: 'text-blue-500 dark:text-blue-400',
        border: 'border-blue-200 dark:border-blue-800/50',
    },
    green: {
        bg: 'bg-emerald-500/15 dark:bg-emerald-400/10',
        text: 'text-emerald-700 dark:text-emerald-300',
        icon: 'text-emerald-500 dark:text-emerald-400',
        border: 'border-emerald-200 dark:border-emerald-800/50',
    },
};

const typeLabels = {
    pending_order: 'รอจัดทริป',
    active_trip: 'กำลังจัดส่ง',
    order_assigned: 'จัดทริปแล้ว',
};

export const HeaderActivityTicker: React.FC<HeaderActivityTickerProps> = ({
    items,
    loading,
    showBranchTag = false,
}) => {
    const [showPanel, setShowPanel] = useState(false);
    const panelRef = useRef<HTMLDivElement>(null);

    // Close panel on outside click
    useEffect(() => {
        if (!showPanel) return;
        const handleClickOutside = (e: MouseEvent) => {
            if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
                setShowPanel(false);
            }
        };
        const timeoutId = setTimeout(() => {
            document.addEventListener('click', handleClickOutside);
        }, 100);
        return () => {
            clearTimeout(timeoutId);
            document.removeEventListener('click', handleClickOutside);
        };
    }, [showPanel]);

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

    // Group items by type for the dropdown panel
    const grouped = {
        pending_order: items.filter(i => i.type === 'pending_order'),
        active_trip: items.filter(i => i.type === 'active_trip'),
        order_assigned: items.filter(i => i.type === 'order_assigned'),
    };

    // Duplicate items for seamless loop
    const duplicatedItems = [...items, ...items, ...items];

    return (
        <div className="ml-4 hidden md:flex items-center flex-1 min-w-0 max-w-[600px] lg:max-w-[800px] relative" ref={panelRef}>
            {/* Clickable ticker area */}
            <div
                className="relative w-full overflow-hidden rounded-full bg-slate-50/80 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/40 h-9 cursor-pointer group"
                onClick={() => setShowPanel(!showPanel)}
            >
                {/* Ticker content */}
                <div className="ticker-header-wrapper h-full">
                    <div className={`ticker-header-content h-full ${showPanel ? 'ticker-paused' : ''}`}>
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
                <div className="absolute top-0 right-0 h-full w-12 bg-gradient-to-l from-slate-50/80 dark:from-slate-800/50 to-transparent pointer-events-none z-10 flex items-center justify-end pr-2">
                    <ChevronDown size={14} className={`text-slate-400 dark:text-slate-500 transition-transform duration-200 ${showPanel ? 'rotate-180' : ''}`} />
                </div>
            </div>

            {/* Dropdown Panel */}
            {showPanel && (
                <div className="absolute top-full left-0 mt-2 w-full min-w-[360px] max-w-[600px] bg-white dark:bg-charcoal-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
                    {/* Header */}
                    <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Activity size={16} className="text-enterprise-500" />
                            <span className="text-sm font-semibold text-slate-900 dark:text-white">
                                กิจกรรมทั้งหมด
                            </span>
                            <span className="text-xs text-slate-400 dark:text-slate-500">
                                ({items.length} รายการ)
                            </span>
                        </div>
                        <button
                            onClick={(e) => { e.stopPropagation(); setShowPanel(false); }}
                            className="p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"
                        >
                            <X size={16} />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="max-h-80 overflow-y-auto">
                        {Object.entries(grouped).map(([type, groupItems]) => {
                            if (groupItems.length === 0) return null;
                            const typedType = type as keyof typeof typeLabels;
                            const Icon = iconMap[typedType];
                            const firstItem = groupItems[0];
                            const colors = colorMap[firstItem.color];

                            return (
                                <div key={type}>
                                    {/* Section header */}
                                    <div className={`px-4 py-2 ${colors.bg} flex items-center gap-2 sticky top-0`}>
                                        <Icon size={14} className={colors.icon} />
                                        <span className={`text-xs font-bold uppercase tracking-wider ${colors.text}`}>
                                            {typeLabels[typedType]}
                                        </span>
                                        <span className={`text-[11px] ${colors.text} opacity-70`}>
                                            ({groupItems.length})
                                        </span>
                                    </div>
                                    {/* Items */}
                                    {groupItems.map((item) => {
                                        const ItemIcon = iconMap[item.type];
                                        const itemColors = colorMap[item.color];
                                        return (
                                            <div
                                                key={item.id}
                                                className="px-4 py-2.5 flex items-center gap-3 border-b border-slate-50 dark:border-slate-800/50 last:border-b-0 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors"
                                            >
                                                <div className={`w-7 h-7 rounded-full ${itemColors.bg} flex items-center justify-center flex-shrink-0`}>
                                                    <ItemIcon size={14} className={itemColors.icon} />
                                                </div>
                                                <span className="text-sm text-slate-700 dark:text-slate-200 flex-1">
                                                    {item.label}
                                                </span>
                                                {showBranchTag && item.branch && (
                                                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${itemColors.bg} ${itemColors.text}`}>
                                                        {item.branch}
                                                    </span>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

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

        .ticker-header-content.ticker-paused {
          animation-play-state: paused;
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
