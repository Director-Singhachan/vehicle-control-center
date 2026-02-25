import React, { memo } from 'react';
import { ChevronDown, ChevronRight, MapPin } from 'lucide-react';
import { Badge } from '../ui/Badge';

interface AreaGroupedOrderListProps {
    groupedOrders: Array<{
        districtKey: string;
        areas: Map<string, any[]>;
        totalOrders: number;
    }>;
    selectedOrders: Set<string>;
    expandedOrders: Set<string>;
    collapsedGroups: Set<string>;
    orderItems: Map<string, any[]>;
    savingPickupItemId: string | null;
    pendingPickupValues: Record<string, number>;
    onToggleSelection: (orderId: string) => void;
    onToggleDetails: (orderId: string) => void;
    onEdit: (orderId: string) => void;
    onUpdatePickup: (itemId: string, qty: number) => void;
    onToggleGroupCollapse: (groupKey: string) => void;
    onSelectGroupOrders: (orders: any[]) => void;
    /** The OrderCard component to render each order */
    renderOrderCard: (order: any) => React.ReactNode;
}

export const AreaGroupedOrderList = memo(function AreaGroupedOrderList({
    groupedOrders,
    selectedOrders,
    collapsedGroups,
    onToggleGroupCollapse,
    onSelectGroupOrders,
    renderOrderCard,
}: AreaGroupedOrderListProps) {
    return (
        <div className="space-y-4">
            {groupedOrders.map(district => (
                <div key={district.districtKey} className="space-y-2">
                    {/* District Header */}
                    <div
                        className="flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-indigo-50 to-indigo-100 dark:from-indigo-900/30 dark:to-indigo-800/20 border border-indigo-200 dark:border-indigo-700 rounded-xl cursor-pointer hover:from-indigo-100 hover:to-indigo-150 dark:hover:from-indigo-900/40 transition-colors"
                        onClick={() => onToggleGroupCollapse(district.districtKey)}
                    >
                        {collapsedGroups.has(district.districtKey) ? (
                            <ChevronRight className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                        ) : (
                            <ChevronDown className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                        )}
                        <MapPin className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                        <h3 className="text-base font-bold text-indigo-900 dark:text-indigo-100 flex-1">
                            {district.districtKey}
                        </h3>
                        <Badge variant="info" className="text-sm">
                            {district.totalOrders} ออเดอร์
                        </Badge>
                    </div>

                    {/* Sub-areas within district */}
                    {!collapsedGroups.has(district.districtKey) && (
                        <div className="ml-4 space-y-3">
                            {Array.from(district.areas.entries())
                                .sort(([, a], [, b]) => b.length - a.length)
                                .map(([areaKey, areaOrders]) => {
                                    const allInGroupSelected = areaOrders.every((o: any) => selectedOrders.has(o.id));
                                    const someInGroupSelected = areaOrders.some((o: any) => selectedOrders.has(o.id));
                                    const isAreaCollapsed = collapsedGroups.has(areaKey);

                                    return (
                                        <div key={areaKey} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                                            {/* Area Sub-Header */}
                                            <div className="flex items-center gap-3 px-4 py-2.5 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
                                                <input
                                                    type="checkbox"
                                                    checked={allInGroupSelected}
                                                    ref={(el) => { if (el) el.indeterminate = someInGroupSelected && !allInGroupSelected; }}
                                                    onChange={() => onSelectGroupOrders(areaOrders)}
                                                    className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                                                    title={`เลือกทั้งหมดใน ${areaKey}`}
                                                />
                                                <button
                                                    className="flex items-center gap-2 flex-1 text-left"
                                                    onClick={() => onToggleGroupCollapse(areaKey)}
                                                >
                                                    {isAreaCollapsed ? (
                                                        <ChevronRight className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                                                    ) : (
                                                        <ChevronDown className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                                                    )}
                                                    <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                                                        {areaKey}
                                                    </span>
                                                </button>
                                                <span className="text-xs text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-700 px-2 py-0.5 rounded-full border border-gray-200 dark:border-gray-600">
                                                    {areaOrders.length} ร้าน
                                                </span>
                                                <span className="text-xs font-medium text-indigo-600 dark:text-indigo-400">
                                                    ฿{areaOrders.reduce((s: number, o: any) => s + (o.total_amount || 0), 0).toLocaleString()}
                                                </span>
                                            </div>

                                            {/* Orders in this area */}
                                            {!isAreaCollapsed && (
                                                <div className="divide-y divide-gray-100 dark:divide-gray-800">
                                                    {areaOrders.map((order: any) => renderOrderCard(order))}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
});
