import React, { useMemo, memo } from 'react';
import {
    Truck, MapPin, Package, Calendar, User, Phone,
    CheckCircle, CheckSquare, Square, Eye, ChevronDown, ChevronUp, Layers,
} from 'lucide-react';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';

// ────────────────────────────────────────────
// TripCard — ใช้สำหรับ by-trip view
// ────────────────────────────────────────────
export interface TripCardProps {
    trip: any;
    expandedStores: Set<string>;
    updatingStatus: Set<string>;
    onToggleStoreExpand: (tripId: string, storeId: string) => void;
    onViewStoreDetail: (tripId: string, store: any) => void;
    onToggleInvoiceStatus: (tripId: string, storeId: string, currentStatus: string) => void;
    onFetchFullDetails?: (tripId: string) => Promise<void>;
    tripsWithFullDetails?: Set<string>;
    hasPackingLayout?: boolean;
}

export const TripCard = memo(({
    trip,
    expandedStores,
    updatingStatus,
    onToggleStoreExpand,
    onViewStoreDetail,
    onToggleInvoiceStatus,
    onFetchFullDetails,
    tripsWithFullDetails,
    hasPackingLayout,
}: TripCardProps) => {
    // Memoize formatted date
    const formattedDate = useMemo(() => {
        return new Date(trip.planned_date).toLocaleDateString('th-TH', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });
    }, [trip.planned_date]);

    // Memoize sorted stores
    const sortedStores = useMemo(() => {
        if (!trip.stores) return [];
        return [...trip.stores].sort((a: any, b: any) => a.sequence_order - b.sequence_order);
    }, [trip.stores]);

    // Invoice progress for this trip
    const tripInvoiceProgress = useMemo(() => {
        const stores = trip.stores || [];
        const total = stores.length;
        const issued = stores.filter((s: any) => s.invoice_status === 'issued').length;
        return { total, issued, pending: total - issued, percent: total > 0 ? (issued / total) * 100 : 0 };
    }, [trip.stores]);

    return (
        <Card>
            <div className="p-6">
                {/* Trip Header */}
                <div className="flex items-start justify-between mb-4 pb-4 border-b border-gray-200 dark:border-slate-700">
                    <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                                {trip.trip_number || `ทริป #${trip.sequence_order}`}
                            </h3>
                            <Badge
                                variant={
                                    trip.status === 'completed' ? 'success' :
                                        trip.status === 'in_progress' ? 'warning' :
                                            trip.status === 'cancelled' ? 'error' :
                                                'default'
                                }
                            >
                                {trip.status === 'completed' ? 'เสร็จสิ้น' :
                                    trip.status === 'in_progress' ? 'กำลังดำเนินการ' :
                                        trip.status === 'cancelled' ? 'ยกเลิก' :
                                            'รอดำเนินการ'}
                            </Badge>
                            {hasPackingLayout && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200">
                                    <Layers size={11} />
                                    จัดเรียงแล้ว
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400 flex-wrap">
                            <div className="flex items-center gap-1">
                                <Truck className="w-4 h-4" />
                                <span>{trip.vehicle?.plate || 'ไม่ระบุ'}</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <User className="w-4 h-4" />
                                <span>คนขับ: {trip.driver?.full_name || 'ไม่ระบุ'}</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <Calendar className="w-4 h-4" />
                                <span>{formattedDate}</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <MapPin className="w-4 h-4" />
                                <span>{trip.stores?.length || 0} จุดส่ง</span>
                            </div>
                        </div>
                        {trip.crews && trip.crews.length > 0 && (
                            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mt-2">
                                <User className="w-4 h-4" />
                                <span>พนักงานบริการ:</span>
                                <div className="flex gap-2 flex-wrap">
                                    {trip.crews.map((crew: any) => (
                                        <Badge key={crew.id} variant="info">
                                            {crew.staff?.name || 'ไม่ระบุชื่อ'}
                                        </Badge>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Invoice Progress Badge */}
                    <div className="flex-shrink-0 ml-4">
                        <div className={`text-center px-4 py-3 rounded-xl border-2 min-w-[120px] ${tripInvoiceProgress.percent === 100
                            ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700'
                            : tripInvoiceProgress.issued > 0
                                ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-300 dark:border-yellow-700'
                                : 'bg-gray-50 dark:bg-slate-800/50 border-gray-200 dark:border-slate-700'
                            }`}>
                            <div className={`text-2xl font-bold ${tripInvoiceProgress.percent === 100
                                ? 'text-green-600 dark:text-green-400'
                                : tripInvoiceProgress.issued > 0
                                    ? 'text-yellow-600 dark:text-yellow-400'
                                    : 'text-gray-600 dark:text-gray-400'
                                }`}>
                                {tripInvoiceProgress.issued}/{tripInvoiceProgress.total}
                            </div>
                            <div className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">ออกบิลแล้ว</div>
                            <div className="w-full bg-gray-200 dark:bg-slate-700 rounded-full h-1.5 mt-2">
                                <div
                                    className={`h-1.5 rounded-full transition-all ${tripInvoiceProgress.percent === 100 ? 'bg-green-500' :
                                        tripInvoiceProgress.issued > 0 ? 'bg-yellow-500' : 'bg-gray-300 dark:bg-slate-600'
                                        }`}
                                    style={{ width: `${tripInvoiceProgress.percent}%` }}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Quick Store Index */}
                {sortedStores.length > 0 && (
                    <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-lg">
                        <p className="text-xs font-semibold text-blue-800 dark:text-blue-200 mb-2">
                            ร้านค้าในทริปนี้ ({sortedStores.length} ร้าน)
                        </p>
                        <div className="flex flex-wrap gap-2">
                            {sortedStores.map((store: any, idx: number) => (
                                <span
                                    key={store.id}
                                    className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium ${store.invoice_status === 'issued'
                                        ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200'
                                        : 'bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-slate-600'
                                        }`}
                                >
                                    <span className="w-4 h-4 rounded-full bg-blue-500 dark:bg-blue-600 text-white flex items-center justify-center font-bold text-[9px] flex-shrink-0">
                                        {store.sequence_order || idx + 1}
                                    </span>
                                    {store.store?.customer_name || 'ไม่ระบุ'}
                                    {store.invoice_status === 'issued' && (
                                        <CheckCircle className="w-3 h-3 text-green-600 dark:text-green-400" />
                                    )}

                                </span>
                            ))}
                        </div>
                    </div>
                )}

                {/* Store Deliveries */}
                {sortedStores.length > 0 && (
                    <div className="space-y-3">
                        <h4 className="font-semibold text-gray-900 dark:text-white mb-3">
                            รายการจัดส่ง (เรียงตามลำดับ)
                        </h4>
                        {sortedStores.map((store: any, index: number) => {
                            const storeKey = `${trip.id}-${store.store_id}`;
                            const isExpanded = expandedStores.has(storeKey);
                            const isUpdating = updatingStatus.has(storeKey);

                            return (
                                <div
                                    key={store.id}
                                    className="flex items-start gap-4 p-4 bg-gray-50 dark:bg-slate-800/50 rounded-xl"
                                >
                                    {/* Sequence Number */}
                                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-500 dark:bg-blue-600 text-white flex items-center justify-center font-bold text-sm">
                                        {store.sequence_order || index + 1}
                                    </div>

                                    {/* Store Info */}
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <p className="font-semibold text-gray-900 dark:text-white">
                                                {store.store?.customer_name}
                                            </p>
                                            <Badge variant="info" className="text-xs">
                                                {store.store?.customer_code}
                                            </Badge>
                                            {store.status === 'delivered' && (
                                                <Badge variant="success" className="text-xs">
                                                    <CheckCircle className="w-3 h-3 mr-1" />
                                                    ส่งแล้ว
                                                </Badge>
                                            )}

                                        </div>

                                        {store.store?.address && (
                                            <div className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400 mb-2">
                                                <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                                <p>{store.store.address}</p>
                                            </div>
                                        )}

                                        {store.store?.phone && (
                                            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                                                <Phone className="w-4 h-4" />
                                                <p>{store.store.phone}</p>
                                            </div>
                                        )}

                                        {/* Items Summary - แสดงเมื่อ expand */}
                                        {store.items && store.items.length > 0 && (
                                            <div className="mt-3">
                                                <div className="flex items-center justify-between mb-2">
                                                    <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                                                        <Package className="w-3 h-3" />
                                                        รายการสินค้า ({store.items.length} รายการ)
                                                    </p>
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            onClick={() => {
                                                                onToggleStoreExpand(trip.id, store.store_id);
                                                            }}
                                                            className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 px-2 py-1 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20"
                                                        >
                                                            {isExpanded ? (
                                                                <>
                                                                    <ChevronUp className="w-3 h-3" />
                                                                    ซ่อนรายการ
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <ChevronDown className="w-3 h-3" />
                                                                    ดูรายการสินค้า
                                                                </>
                                                            )}
                                                        </button>
                                                        <button
                                                            onClick={() => {
                                                                onViewStoreDetail(trip.id, store);
                                                            }}
                                                            className="text-xs text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1 px-2 py-1 rounded hover:bg-purple-50 dark:hover:bg-purple-900/20"
                                                        >
                                                            <Eye className="w-3 h-3" />
                                                            ดูทั้งหมด
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* แสดงรายการสินค้าเมื่อ expand */}
                                                {isExpanded && store.items && store.items.length > 0 && (
                                                    <div className="p-3 bg-white dark:bg-slate-900/50 rounded-lg border border-gray-200 dark:border-slate-700 space-y-2 max-h-96 overflow-y-auto">
                                                        {store.items.map((item: any, itemIndex: number) => (
                                                            <div key={item.id} className="flex items-center justify-between text-sm py-2 px-2 border-b border-gray-100 dark:border-slate-700 last:border-b-0 hover:bg-gray-50 dark:hover:bg-slate-800/50 rounded">
                                                                <div className="flex items-start gap-3 flex-1 min-w-0">
                                                                    <span className="text-xs text-gray-400 dark:text-gray-500 font-mono w-6 flex-shrink-0">
                                                                        {itemIndex + 1}.
                                                                    </span>
                                                                    <div className="flex-1 min-w-0">
                                                                        <div className="flex items-center gap-2 flex-wrap">
                                                                            <span className="text-gray-900 dark:text-white font-medium">
                                                                                {item.product?.product_name || 'ไม่ระบุชื่อ'}
                                                                            </span>
                                                                            {item.product?.product_code && (
                                                                                <Badge variant="info" className="text-xs font-mono">
                                                                                    {item.product.product_code}
                                                                                </Badge>
                                                                            )}
                                                                        </div>
                                                                        {item.product?.category && (
                                                                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                                                                หมวดหมู่: {item.product.category}
                                                                            </p>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                                <div className="text-right ml-4 flex-shrink-0">
                                                                    <span className="text-gray-700 dark:text-gray-300 font-semibold text-sm">
                                                                        {Math.floor(Number(item.quantity) || 0).toLocaleString('th-TH', { maximumFractionDigits: 0 })} {item.unit || item.product?.unit || 'ชิ้น'}
                                                                    </span>
                                                                    {(Number(item.quantity_picked_up_at_store) || 0) > 0 && (
                                                                        <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                                                                            รับที่ร้านแล้ว {Math.floor(Number(item.quantity_picked_up_at_store)).toLocaleString('th-TH', { maximumFractionDigits: 0 })} {item.unit || item.product?.unit || 'ชิ้น'}
                                                                        </p>
                                                                    )}
                                                                    {item.product?.base_price && (
                                                                        <p className="text-xs text-gray-500 dark:text-gray-400">
                                                                            {new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' }).format(item.product.base_price)}
                                                                        </p>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {/* Invoice Status Toggle */}
                                    <div className="flex-shrink-0 flex flex-col items-end gap-2">
                                        <button
                                            onClick={() => onToggleInvoiceStatus(trip.id, store.store_id, store.invoice_status || 'pending')}
                                            disabled={trip.status === 'cancelled' || isUpdating}
                                            className={`
                        flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all
                        ${store.invoice_status === 'issued'
                                                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 border-2 border-green-300 dark:border-green-700'
                                                    : 'bg-gray-100 text-gray-700 dark:bg-slate-700 dark:text-gray-300 border-2 border-gray-300 dark:border-slate-600 hover:bg-gray-200 dark:hover:bg-slate-600'
                                                }
                        ${trip.status === 'cancelled' || isUpdating
                                                    ? 'opacity-50 cursor-not-allowed'
                                                    : 'cursor-pointer'
                                                }
                      `}
                                            title={store.invoice_status === 'issued' ? 'คลิกเพื่อยกเลิกสถานะ' : 'คลิกเพื่อยืนยันว่าออกบิลแล้ว'}
                                        >
                                            {isUpdating ? (
                                                <>
                                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current" />
                                                    <span>กำลังบันทึก...</span>
                                                </>
                                            ) : store.invoice_status === 'issued' ? (
                                                <>
                                                    <CheckSquare className="w-4 h-4" />
                                                    <span>ออกบิลแล้ว</span>
                                                </>
                                            ) : (
                                                <>
                                                    <Square className="w-4 h-4" />
                                                    <span>ยังไม่ออกบิล</span>
                                                </>
                                            )}
                                        </button>

                                        {/* สรุปสถานะ */}
                                        <div className="text-xs text-gray-500 dark:text-gray-400 text-right">
                                            {store.items && store.items.length > 0 ? (
                                                <div className="flex flex-col items-end gap-0.5">
                                                    <span className="font-medium">สินค้า {store.items.length} รายการ</span>
                                                    {!isExpanded && (
                                                        <span className="text-xs text-gray-400 dark:text-gray-500">
                                                            คลิก "ดูรายการสินค้า" เพื่อดูรายละเอียด
                                                        </span>
                                                    )}
                                                </div>
                                            ) : (
                                                <span className="text-orange-600 dark:text-orange-400">ไม่มีสินค้า</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Trip Notes */}
                {trip.notes && (
                    <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                        <p className="text-sm text-yellow-800 dark:text-yellow-300">
                            <span className="font-medium">หมายเหตุ:</span> {trip.notes}
                        </p>
                    </div>
                )}
            </div>
        </Card>
    );
}, (prevProps, nextProps) => {
    // Custom comparison for better performance
    if (prevProps.trip.id !== nextProps.trip.id) return false;
    if (prevProps.trip.status !== nextProps.trip.status) return false;
    if (prevProps.expandedStores !== nextProps.expandedStores) return false;
    if (prevProps.updatingStatus !== nextProps.updatingStatus) return false;
    if (prevProps.hasPackingLayout !== nextProps.hasPackingLayout) return false;
    // Deep compare stores invoice_status
    const prevStores = prevProps.trip.stores || [];
    const nextStores = nextProps.trip.stores || [];
    if (prevStores.length !== nextStores.length) return false;
    for (let i = 0; i < prevStores.length; i++) {
        if (prevStores[i].invoice_status !== nextStores[i].invoice_status) return false;
    }
    return true; // Props are equal, skip re-render
});

TripCard.displayName = 'TripCard';

// ────────────────────────────────────────────
// StoreCard — ใช้สำหรับ by-store view (merged)
// ────────────────────────────────────────────

// Types for merged store view
export interface SummaryItem {
    product_id: string;
    product: any;
    totalQuantity: number;
    totalPickedUp: number;
    is_bonus: boolean;
    breakdown: Array<{
        trip_id: string;
        trip_number: string;
        vehicle_plate: string;
        quantity: number;
        pickedUp?: number;
    }>;
}

export interface MergedStoreEntry {
    store_id: string;
    store: any;
    trips: Array<{
        trip_id: string;
        trip_number: string;
        vehicle_plate: string;
        driver_name: string;
        trip_store_id: string;
        sequence_order: number;
        delivery_status: string;
        invoice_status: string;
        order_status?: string;
        items: any[];
    }>;
    allItems: any[];
    summaryItems: SummaryItem[];
    allInvoiced: boolean;
    anyInvoiced: boolean;
}

export interface StoreCardProps {
    entry: MergedStoreEntry;
    expandedStores: Set<string>;
    updatingStatus: Set<string>;
    onToggleExpand: (storeId: string) => void;
    onViewDetail: (entry: MergedStoreEntry) => void;
    onToggleInvoiceStatus: (tripId: string, storeId: string, currentStatus: string) => void;
}

export const StoreCard = memo(({ entry, expandedStores, updatingStatus, onToggleExpand, onViewDetail, onToggleInvoiceStatus }: StoreCardProps) => {
    const isExpanded = expandedStores.has(entry.store_id);
    const isSplit = entry.trips.length > 1;

    return (
        <Card>
            <div className="p-5">
                {/* Store Header */}
                <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <p className="text-lg font-semibold text-gray-900 dark:text-white">
                                {entry.store?.customer_name || 'ไม่ระบุชื่อ'}
                            </p>
                            <Badge variant="info" className="text-xs">{entry.store?.customer_code || '-'}</Badge>
                            {isSplit && (
                                <Badge variant="warning" className="text-xs">
                                    <Truck className="w-3 h-3 mr-1 inline" />
                                    แบ่งส่ง {entry.trips.length} คัน
                                </Badge>
                            )}

                        </div>
                        {entry.store?.address && (
                            <div className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400 mb-1">
                                <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                <p>{entry.store.address}</p>
                            </div>
                        )}
                        {entry.store?.phone && (
                            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                                <Phone className="w-4 h-4" />
                                <p>{entry.store.phone}</p>
                            </div>
                        )}
                    </div>

                    {/* Invoice Status (toggle all trips at once for this store) */}
                    <div className="flex-shrink-0 flex flex-col items-end gap-2">
                        {entry.trips.map((t) => {
                            const key = `${t.trip_id}-${entry.store_id}`;
                            const isUpdating = updatingStatus.has(key);
                            return (
                                <button
                                    key={t.trip_id}
                                    onClick={() => onToggleInvoiceStatus(t.trip_id, entry.store_id, t.invoice_status || 'pending')}
                                    disabled={isUpdating}
                                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${t.invoice_status === 'issued'
                                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 border border-green-300'
                                        : 'bg-gray-100 text-gray-700 dark:bg-slate-700 dark:text-gray-300 border border-gray-300 hover:bg-gray-200'
                                        } ${isUpdating ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                                >
                                    {isUpdating ? (
                                        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-current" />
                                    ) : t.invoice_status === 'issued' ? (
                                        <CheckSquare className="w-3 h-3" />
                                    ) : (
                                        <Square className="w-3 h-3" />
                                    )}
                                    <span>{isSplit ? `ทริป ${t.trip_number}: ` : ''}{t.invoice_status === 'issued' ? 'ออกบิลแล้ว' : 'ยังไม่ออกบิล'}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Vehicle/Trip info strip */}
                <div className={`rounded-lg p-3 mb-3 space-y-2 ${isSplit ? 'bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800' : 'bg-gray-50 dark:bg-slate-800/50'}`}>
                    {isSplit && (
                        <p className="text-xs font-semibold text-amber-800 dark:text-amber-300 mb-2">
                            สินค้าร้านนี้แบ่งส่งด้วยรถ {entry.trips.length} คัน (ออกบิลรวมเป็นใบเดียว)
                        </p>
                    )}
                    {entry.trips.map((t) => (
                        <div key={t.trip_id} className="flex items-center gap-4 text-sm flex-wrap">
                            <div className="flex items-center gap-1 text-gray-700 dark:text-gray-300">
                                <Truck className="w-4 h-4 text-blue-500" />
                                <span className="font-medium">{t.vehicle_plate || 'ไม่ระบุ'}</span>
                            </div>
                            <div className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
                                <User className="w-3 h-3" />
                                <span>{t.driver_name || 'ไม่ระบุ'}</span>
                            </div>
                            <Badge variant="default" className="text-xs">{t.trip_number}</Badge>
                            <span className="text-xs text-gray-500">{t.items.length} รายการ</span>
                        </div>
                    ))}
                </div>

                {/* Items — แสดงเป็นยอดรวม */}
                <div>
                    <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                            <Package className="w-3 h-3" />
                            รายการสินค้า ({entry.summaryItems.length} รายการ{isSplit ? `, รวมจาก ${entry.trips.length} คัน` : ''})
                        </p>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => onToggleExpand(entry.store_id)}
                                className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 px-2 py-1 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20"
                            >
                                {isExpanded ? <><ChevronUp className="w-3 h-3" />ซ่อน</> : <><ChevronDown className="w-3 h-3" />ดูรายการ</>}
                            </button>
                            <button
                                onClick={() => onViewDetail(entry)}
                                className="text-xs text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1 px-2 py-1 rounded hover:bg-purple-50 dark:hover:bg-purple-900/20"
                            >
                                <Eye className="w-3 h-3" />ดูทั้งหมด
                            </button>
                        </div>
                    </div>

                    {isExpanded && entry.summaryItems.length > 0 && (
                        <div className="p-3 bg-white dark:bg-slate-900/50 rounded-lg border border-gray-200 dark:border-slate-700 space-y-2 max-h-96 overflow-y-auto">
                            {entry.summaryItems.map((si, idx) => (
                                <div key={`${si.product_id}-${si.is_bonus}`} className="py-2 px-2 border-b border-gray-100 dark:border-slate-700 last:border-b-0 hover:bg-gray-50 dark:hover:bg-slate-800/50 rounded">
                                    <div className="flex items-center justify-between text-sm">
                                        <div className="flex items-start gap-3 flex-1 min-w-0">
                                            <span className="text-xs text-gray-400 font-mono w-6 flex-shrink-0">{idx + 1}.</span>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="text-gray-900 dark:text-white font-medium">
                                                        {si.product?.product_name || 'ไม่ระบุชื่อ'}
                                                    </span>
                                                    {si.product?.product_code && (
                                                        <Badge variant="info" className="text-xs font-mono">{si.product.product_code}</Badge>
                                                    )}
                                                    {si.is_bonus && <Badge variant="success" className="text-xs">ของแถม</Badge>}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-right ml-4 flex-shrink-0">
                                            <span className="text-gray-900 dark:text-white font-bold text-sm">
                                                {Math.floor(si.totalQuantity).toLocaleString('th-TH', { maximumFractionDigits: 0 })} {si.line_unit || si.product?.unit || 'ชิ้น'}
                                            </span>
                                            {si.totalPickedUp > 0 && (
                                                <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                                                    รับที่ร้านแล้ว {si.totalPickedUp.toLocaleString('th-TH', { maximumFractionDigits: 0 })} {si.line_unit || si.product?.unit || 'ชิ้น'}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                    {/* breakdown เมื่อแบ่งหลายคัน */}
                                    {isSplit && si.breakdown.length > 1 && (
                                        <div className="ml-9 mt-1 flex flex-wrap gap-2">
                                            {si.breakdown.map((b, bi) => (
                                                <span key={bi} className="inline-flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                                                    <Truck className="w-3 h-3" />
                                                    {b.vehicle_plate}: {Math.floor(b.quantity || 0).toLocaleString('th-TH', { maximumFractionDigits: 0 })}
                                                    {b.pickedUp != null && b.pickedUp > 0 && (
                                                        <span className="text-amber-600 dark:text-amber-400"> (รับที่ร้าน {b.pickedUp})</span>
                                                    )}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </Card>
    );
});

StoreCard.displayName = 'StoreCard';
