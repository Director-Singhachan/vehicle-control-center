import React, { useState, useMemo, useCallback, memo, useEffect, useRef } from 'react';
import { Truck, MapPin, Package, Calendar, User, Phone, CheckCircle, Clock, CheckSquare, Square, Eye, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Building2, Layers } from 'lucide-react';
import { useAuth, useToast } from '../hooks';
import { useDeliveryTrips } from '../hooks/useDeliveryTrips';
import { deliveryTripService } from '../services/deliveryTripService';
import { tripMetricsService } from '../services/tripMetricsService';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { PageLayout } from '../components/ui/PageLayout';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { ToastContainer } from '../components/ui/Toast';
import { Modal } from '../components/ui/Modal';

// Memoized TripCard component to prevent unnecessary re-renders
interface TripCardProps {
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

const TripCard = memo(({
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
                  {(store.order_status === 'partial' || store.order_status === 'assigned') && (
                    <span className="text-amber-600 dark:text-amber-400" title="ส่งบางส่วน มีของค้างส่ง">⏳</span>
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
                      {(store.order_status === 'partial' || store.order_status === 'assigned') && (
                        <Badge variant="warning" className="text-xs" title="ออเดอร์นี้ส่งไม่ครบในทริปนี้ มีบางส่วนค้างส่งทริปอื่น">
                          ⏳ ส่งบางส่วน มีของค้างส่ง
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
                                    {Math.floor(Number(item.quantity) || 0).toLocaleString('th-TH', { maximumFractionDigits: 0 })} {item.product?.unit || 'ชิ้น'}
                                  </span>
                                  {(Number(item.quantity_picked_up_at_store) || 0) > 0 && (
                                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                                      รับที่ร้านแล้ว {Math.floor(Number(item.quantity_picked_up_at_store)).toLocaleString('th-TH', { maximumFractionDigits: 0 })} {item.product?.unit || 'ชิ้น'}
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

// โหมดแสดงผล: ดูแบบทริป vs ดูแบบรายร้าน
type ViewMode = 'by_trip' | 'by_store';

// สินค้ารวมยอด: product_id เดียวกันจากหลายทริป → แสดงเป็นแถวเดียว + breakdown
interface SummaryItem {
  product_id: string;
  product: any;
  totalQuantity: number;
  totalPickedUp: number; // รับที่ร้านแล้ว (จำนวนเต็ม)
  is_bonus: boolean;
  // breakdown ต่อรถ (เมื่อแบ่งหลายคัน)
  breakdown: Array<{
    trip_id: string;
    trip_number: string;
    vehicle_plate: string;
    quantity: number;
    pickedUp?: number;
  }>;
}

// Merged store: ร้านเดียวกันจากหลายทริป รวมเป็นก้อนเดียว
interface MergedStoreEntry {
  store_id: string;
  store: any; // { customer_name, customer_code, address, phone }
  trips: Array<{
    trip_id: string;
    trip_number: string;
    vehicle_plate: string;
    driver_name: string;
    trip_store_id: string; // delivery_trip_stores.id
    sequence_order: number;
    delivery_status: string;
    invoice_status: string;
    items: any[];
  }>;
  allItems: any[]; // รวมสินค้าทุกทริป (มี trip info ติดมาด้วย)
  summaryItems: SummaryItem[]; // สินค้ารวมยอด (group by product_id + is_bonus)
  allInvoiced: boolean;
  anyInvoiced: boolean;
}

// Memoized StoreCard for by-store view
interface StoreCardProps {
  entry: MergedStoreEntry;
  expandedStores: Set<string>;
  updatingStatus: Set<string>;
  onToggleExpand: (storeId: string) => void;
  onViewDetail: (entry: MergedStoreEntry) => void;
  onToggleInvoiceStatus: (tripId: string, storeId: string, currentStatus: string) => void;
}

const StoreCard = memo(({ entry, expandedStores, updatingStatus, onToggleExpand, onViewDetail, onToggleInvoiceStatus }: StoreCardProps) => {
  const isExpanded = expandedStores.has(entry.store_id);
  const isSplit = entry.trips.length > 1;
  const hasPartialRemaining = entry.trips.some((t: any) => t.order_status === 'partial' || t.order_status === 'assigned');

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
              {hasPartialRemaining && (
                <Badge variant="warning" className="text-xs" title="ออเดอร์นี้ส่งไม่ครบในทริปนี้ มีบางส่วนค้างส่งทริปอื่น">
                  ⏳ ส่งบางส่วน มีของค้างส่ง
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
                        {Math.floor(si.totalQuantity).toLocaleString('th-TH', { maximumFractionDigits: 0 })} {si.product?.unit || 'ชิ้น'}
                      </span>
                      {si.totalPickedUp > 0 && (
                        <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                          รับที่ร้านแล้ว {si.totalPickedUp.toLocaleString('th-TH', { maximumFractionDigits: 0 })} {si.product?.unit || 'ชิ้น'}
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

export function SalesTripsView() {
  const { user, profile } = useAuth();
  const { toasts, success, error, warning, dismissToast } = useToast();
  const [dateFilter, setDateFilter] = useState(new Date().toISOString().split('T')[0]);
  const [branchFilter, setBranchFilter] = useState<string>(() => {
    return profile?.branch || 'ALL';
  });
  const [updatingStatus, setUpdatingStatus] = useState<Set<string>>(new Set());
  const [expandedStores, setExpandedStores] = useState<Set<string>>(new Set());
  const [selectedStoreDetail, setSelectedStoreDetail] = useState<{ tripId: string; store: any } | null>(null);
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<ViewMode>('by_trip'); // default = ดูแบบทริป (จัดกลุ่มตามทริป)
  // สำหรับ modal แบบ merged store
  const [selectedMergedStore, setSelectedMergedStore] = useState<MergedStoreEntry | null>(null);
  // Index สำหรับเลื่อน \"หน้าต่าง\" สรุปทริปวันนี้ (ควบคุมด้วยปุ่มลูกศรเท่านั้น)
  const [tripSummaryIndex, setTripSummaryIndex] = useState(0);

  // Auto-check all items when invoice_status is 'issued'
  useEffect(() => {
    if (selectedStoreDetail && selectedStoreDetail.store.invoice_status === 'issued') {
      // Auto-check all items when invoice is already issued
      const allItemKeys = selectedStoreDetail.store.items.map((item: any) => {
        return `${selectedStoreDetail.tripId}-${selectedStoreDetail.store.store_id}-${item.id}`;
      });
      setCheckedItems(new Set(allItemKeys));
    } else if (selectedStoreDetail && selectedStoreDetail.store.invoice_status !== 'issued') {
      // Reset checked items when invoice is not issued
      setCheckedItems(new Set());
    }
  }, [selectedStoreDetail]);

  // Fetch trips with full details for invoicing
  // Sales view needs items data to display and manage invoices
  // ดึงเฉพาะทริปที่ยังใช้งาน (ไม่รวม cancelled) เพื่อไม่ให้ทริปที่ลบ/ยกเลิกแล้วค้างอยู่บนหน้าออกบิล
  const { trips, loading, error: tripsError, refetch } = useDeliveryTrips({
    planned_date_from: dateFilter,
    planned_date_to: dateFilter,
    branch: branchFilter === 'ALL' ? undefined : branchFilter,
    status: ['planned', 'in_progress', 'completed'], // ไม่ดึง cancelled
    lite: false, // Use full mode to load items data (required for invoicing)
    sortAscending: true, // Oldest trips first (created earlier at top)
    autoFetch: true,
    autoRefresh: false, // Disable auto-refresh for better performance
  });

  // Batch check which trips have packing layout
  const [tripsWithLayout, setTripsWithLayout] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!trips || trips.length === 0) return;
    const ids = trips.map((t: any) => t.id);
    tripMetricsService.getTripsWithPackingLayout(ids).then(setTripsWithLayout).catch(() => { });
  }, [trips]);

  // Show all trips that are ready for invoicing
  // Sales can create invoices for any trip (not just assigned to them)
  // ไม่แสดงทริปที่ยกเลิกแล้ว — เพื่อไม่ให้ทริปที่ลบ/ยกเลิกแล้วค้างอยู่บนหน้าออกบิล
  const myTrips = useMemo(() => {
    if (!trips) return [];

    return trips.filter((trip: any) => {
      if (trip.status === 'cancelled') return false;
      return trip.stores && trip.stores.length > 0;
    });
  }, [trips]);

  // คำนวณสถิติการออกบิล
  const invoiceStats = useMemo(() => {
    let totalStores = 0;
    let issuedStores = 0;

    myTrips.forEach((trip: any) => {
      if (trip.stores) {
        trip.stores.forEach((store: any) => {
          totalStores++;
          if (store.invoice_status === 'issued') {
            issuedStores++;
          }
        });
      }
    });

    return {
      total: totalStores,
      issued: issuedStores,
      pending: totalStores - issuedStores,
      completionRate: totalStores > 0 ? (issuedStores / totalStores) * 100 : 0,
    };
  }, [myTrips]);

  // Memoize stats calculations
  const inProgressCount = useMemo(() => myTrips.filter((t: any) => t.status === 'in_progress').length, [myTrips]);
  const completedCount = useMemo(() => myTrips.filter((t: any) => t.status === 'completed').length, [myTrips]);
  const totalStopsCount = useMemo(() => myTrips.reduce((sum: number, t: any) => sum + (t.stores?.length || 0), 0), [myTrips]);

  // Per-trip invoice stats (for trip summary index)
  const tripInvoiceStats = useMemo(() => {
    return myTrips.map((trip: any) => {
      const stores = trip.stores || [];
      const totalStores = stores.length;
      const issuedStores = stores.filter((s: any) => s.invoice_status === 'issued').length;
      return {
        tripId: trip.id,
        tripNumber: trip.trip_number || `ทริป #${trip.sequence_order}`,
        vehiclePlate: trip.vehicle?.plate || 'ไม่ระบุ',
        driverName: trip.driver?.full_name || 'ไม่ระบุ',
        status: trip.status,
        totalStores,
        issuedStores,
        pendingStores: totalStores - issuedStores,
        isAllIssued: issuedStores === totalStores && totalStores > 0,
        stores: stores.map((s: any) => ({
          storeId: s.store_id,
          storeName: s.store?.customer_name || 'ไม่ระบุ',
          storeCode: s.store?.customer_code || '',
          invoiceStatus: s.invoice_status || 'pending',
          itemCount: s.items?.length || 0,
          sequenceOrder: s.sequence_order,
        })).sort((a: any, b: any) => a.sequenceOrder - b.sequenceOrder),
      };
    });
  }, [myTrips]);

  // สร้าง merged stores: รวมร้านเดียวกันจากหลายทริปเข้าด้วยกัน
  const mergedStores = useMemo((): MergedStoreEntry[] => {
    const map = new Map<string, MergedStoreEntry>();

    for (const trip of myTrips) {
      for (const store of (trip.stores || [])) {
        const storeId = store.store_id;
        if (!map.has(storeId)) {
          map.set(storeId, {
            store_id: storeId,
            store: store.store,
            trips: [],
            allItems: [],
            summaryItems: [],
            allInvoiced: true,
            anyInvoiced: false,
          });
        }
        const entry = map.get(storeId)!;
        const tripInfo = {
          trip_id: trip.id,
          trip_number: trip.trip_number || `#${trip.sequence_order}`,
          vehicle_plate: trip.vehicle?.plate || 'ไม่ระบุ',
          driver_name: trip.driver?.full_name || 'ไม่ระบุ',
          trip_store_id: store.id,
          sequence_order: store.sequence_order,
          delivery_status: store.delivery_status || 'pending',
          invoice_status: store.invoice_status || 'pending',
          order_status: store.order_status,
          items: store.items || [],
        };
        entry.trips.push(tripInfo);

        if (tripInfo.invoice_status !== 'issued') entry.allInvoiced = false;
        if (tripInfo.invoice_status === 'issued') entry.anyInvoiced = true;

        for (const item of (store.items || [])) {
          entry.allItems.push({
            ...item,
            _tripId: trip.id,
            _tripNumber: tripInfo.trip_number,
            _vehiclePlate: tripInfo.vehicle_plate,
            _tripIndex: entry.trips.length - 1,
          });
        }
      }
    }

    // สร้าง summaryItems: รวมยอดสินค้าตัวเดียวกัน (group by product_id + is_bonus)
    for (const entry of map.values()) {
      const productMap = new Map<string, SummaryItem>();
      for (const item of entry.allItems) {
        const key = `${item.product_id}_${item.is_bonus ? 'bonus' : 'normal'}`;
        if (!productMap.has(key)) {
          productMap.set(key, {
            product_id: item.product_id,
            product: item.product,
            totalQuantity: 0,
            totalPickedUp: 0,
            is_bonus: !!item.is_bonus,
            breakdown: [],
          });
        }
        const summary = productMap.get(key)!;
        const qty = Number(item.quantity) || 0;
        const pickedUp = Math.floor(Number(item.quantity_picked_up_at_store) || 0);
        summary.totalQuantity += qty;
        summary.totalPickedUp += pickedUp;
        summary.breakdown.push({
          trip_id: item._tripId,
          trip_number: item._tripNumber,
          vehicle_plate: item._vehiclePlate,
          quantity: qty,
          pickedUp,
        });
      }
      entry.summaryItems = Array.from(productMap.values());
    }

    return Array.from(map.values());
  }, [myTrips]);

  // Handlers for TripCard
  const handleToggleStoreExpand = useCallback((tripId: string, storeId: string) => {
    const key = `${tripId}-${storeId}`;
    setExpandedStores(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  const handleViewStoreDetail = useCallback((tripId: string, store: any) => {
    setSelectedStoreDetail({ tripId, store });
  }, []);

  // เปลี่ยนสถานะการออกบิล
  const handleToggleInvoiceStatus = useCallback(async (
    tripId: string,
    storeId: string,
    currentStatus: string,
    onStatusUpdated?: (newStatus: 'pending' | 'issued') => void
  ) => {
    const key = `${tripId}-${storeId}`;
    setUpdatingStatus(prev => new Set(prev).add(key));

    try {
      const newStatus = currentStatus === 'issued' ? 'pending' : 'issued';
      await deliveryTripService.updateStoreInvoiceStatus(tripId, storeId, newStatus);

      // Call callback to update local state immediately
      if (onStatusUpdated) {
        onStatusUpdated(newStatus);
      }

      // Refresh trips to ensure data consistency
      // Add a small delay to ensure database update is committed
      await new Promise(resolve => setTimeout(resolve, 300));
      await refetch();

      // Show success message after state update
      setTimeout(() => {
        if (newStatus === 'issued') {
          success('บันทึกสถานะการออกบิลเรียบร้อย');
        } else {
          success('ยกเลิกสถานะการออกบิลเรียบร้อย');
        }
      }, 100);
    } catch (err: any) {
      console.error('Error updating invoice status:', err);
      error(err.message || 'เกิดข้อผิดพลาดในการอัพเดทสถานะการออกบิล');
      throw err; // Re-throw to allow caller to handle
    } finally {
      setUpdatingStatus(prev => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  }, [refetch, success, error]);

  if (loading) {
    return (
      <PageLayout title="ทริปของฉัน">
        <div className="flex items-center justify-center h-64">
          <LoadingSpinner />
        </div>
      </PageLayout>
    );
  }

  if (tripsError) {
    return (
      <>
        <ToastContainer toasts={toasts} onDismiss={dismissToast} />
        <PageLayout title="ออกใบแจ้งหนี้ - ทริปส่งสินค้า">
          <div className="text-center text-red-600 dark:text-red-400 py-8">
            เกิดข้อผิดพลาด: {tripsError.message}
          </div>
        </PageLayout>
      </>
    );
  }

  return (
    <>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <PageLayout title="ออกใบแจ้งหนี้ - ทริปส่งสินค้า">
        <div className="space-y-6">
          {/* Date Filter + Branch Filter + View Mode Toggle */}
          <div className="mb-6 flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-gray-400 dark:text-gray-500" />
              <input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
              />
            </div>

            {/* Branch Filter */}
            <div className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-gray-400 dark:text-gray-500" />
              <select
                value={branchFilter}
                onChange={(e) => setBranchFilter(e.target.value)}
                className="px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
              >
                <option value="ALL">ทุกสาขา</option>
                <option value="HQ">สำนักงานใหญ่</option>
                <option value="SD">สาขาสอยดาว</option>
              </select>
            </div>

            <Button onClick={refetch} variant="outline">
              รีเฟรช
            </Button>

            {/* View Mode Toggle */}
            <div className="flex items-center bg-gray-100 dark:bg-slate-800 rounded-lg p-1 ml-auto">
              <button
                onClick={() => setViewMode('by_store')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${viewMode === 'by_store'
                  ? 'bg-white dark:bg-slate-700 text-blue-700 dark:text-blue-300 shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
                  }`}
              >
                <MapPin className="w-4 h-4 inline mr-1" />
                ดูแบบรายร้าน
              </button>
              <button
                onClick={() => setViewMode('by_trip')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${viewMode === 'by_trip'
                  ? 'bg-white dark:bg-slate-700 text-blue-700 dark:text-blue-300 shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
                  }`}
              >
                <Truck className="w-4 h-4 inline mr-1" />
                ดูแบบทริป
              </button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card>
              <div className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">ทริปทั้งหมด</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{myTrips.length}</p>
                  </div>
                  <Truck className="w-10 h-10 text-blue-500 opacity-50" />
                </div>
              </div>
            </Card>

            <Card>
              <div className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">กำลังดำเนินการ</p>
                    <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                      {inProgressCount}
                    </p>
                  </div>
                  <Clock className="w-10 h-10 text-yellow-500 opacity-50" />
                </div>
              </div>
            </Card>

            <Card>
              <div className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">เสร็จสิ้น</p>
                    <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                      {completedCount}
                    </p>
                  </div>
                  <CheckCircle className="w-10 h-10 text-green-500 opacity-50" />
                </div>
              </div>
            </Card>

            <Card>
              <div className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">จุดส่งทั้งหมด</p>
                    <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                      {totalStopsCount}
                    </p>
                  </div>
                  <MapPin className="w-10 h-10 text-purple-500 opacity-50" />
                </div>
              </div>
            </Card>

            <Card>
              <div className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">ออกบิลแล้ว</p>
                    <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                      {invoiceStats.issued} / {invoiceStats.total}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {invoiceStats.completionRate.toFixed(0)}% เสร็จสมบูรณ์
                    </p>
                  </div>
                  <CheckCircle className="w-10 h-10 text-green-500 opacity-50" />
                </div>
              </div>
            </Card>

            <Card>
              <div className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">รอออกบิล</p>
                    <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                      {invoiceStats.pending}
                    </p>
                  </div>
                  <Clock className="w-10 h-10 text-orange-500 opacity-50" />
                </div>
              </div>
            </Card>
          </div>

          {/* Trip Summary Index - เลื่อนแนวนอน คลิกเพื่อ scroll ไปที่ทริป */}
          {myTrips.length > 0 && viewMode === 'by_trip' && (
            <Card className="mb-6">
              <div className="p-4 pb-3">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    <Truck className="w-4 h-4 text-blue-500" />
                    สรุปทริปวันนี้ ({myTrips.length} ทริป)
                  </h3>
                  {tripInvoiceStats.length > 2 && (
                    <span className="text-[11px] text-gray-400 dark:text-gray-500 flex items-center gap-1">
                      เลื่อนเพื่อดูเพิ่ม <ChevronRight className="w-3 h-3" />
                    </span>
                  )}
                </div>

                {/* Horizontal viewport (Window) แสดงเฉพาะช่วงที่พอดีกับจอ */}
                <div className="relative w-full overflow-hidden">
                  {/* Left scroll button (เลื่อนไปดูทริปก่อนหน้า) */}
                  {tripInvoiceStats.length > 1 && tripSummaryIndex > 0 && (
                    <button
                      onClick={() => {
                        setTripSummaryIndex(prev => Math.max(0, prev - 1));
                      }}
                      className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-white dark:bg-slate-800 shadow-lg border border-gray-200 dark:border-slate-600 flex items-center justify-center opacity-70 hover:opacity-100 transition-opacity hover:bg-gray-50 dark:hover:bg-slate-700"
                    >
                      <ChevronLeft className="w-4 h-4 text-gray-600 dark:text-gray-300" />
                    </button>
                  )}

                  {/* Conveyor strip: การ์ดทริปเรียงต่อกันในแถวเดียว */}
                  <div
                    id="trip-summary-scroll"
                    className="flex flex-nowrap gap-3 pb-2 px-2 transition-transform duration-300 ease-out"
                    style={{
                      transform: `translateX(-${tripSummaryIndex * 280}px)`,
                    }}
                  >
                    {tripInvoiceStats.map((stat) => {
                      const progressPercent = stat.totalStores > 0 ? (stat.issuedStores / stat.totalStores) * 100 : 0;
                      return (
                        <button
                          key={stat.tripId}
                          type="button"
                          onClick={() => {
                            const el = document.getElementById(`trip-card-${stat.tripId}`);
                            if (el) {
                              el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                              // Flash highlight effect
                              el.classList.add('ring-2', 'ring-blue-500', 'ring-offset-2');
                              setTimeout(() => el.classList.remove('ring-2', 'ring-blue-500', 'ring-offset-2'), 2000);
                            }
                          }}
                          className={`flex-none w-[260px] p-3 rounded-lg border-2 transition-all text-left hover:shadow-md hover:scale-[1.02] active:scale-[0.98] cursor-pointer ${stat.isAllIssued
                            ? 'border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/20 hover:border-green-400'
                            : stat.issuedStores > 0
                              ? 'border-yellow-300 dark:border-yellow-700 bg-yellow-50 dark:bg-yellow-900/20 hover:border-yellow-400'
                              : 'border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 hover:border-blue-300 dark:hover:border-blue-600'
                            }`}
                        >
                          {/* Trip Header */}
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-gray-900 dark:text-white text-sm">{stat.tripNumber}</span>
                              <Badge
                                variant={
                                  stat.status === 'completed' ? 'success' :
                                    stat.status === 'in_progress' ? 'warning' :
                                      stat.status === 'cancelled' ? 'error' : 'default'
                                }
                              >
                                {stat.status === 'completed' ? 'เสร็จ' :
                                  stat.status === 'in_progress' ? 'กำลังส่ง' :
                                    stat.status === 'cancelled' ? 'ยกเลิก' : 'รอ'}
                              </Badge>
                            </div>
                            <span className={`text-[11px] font-bold ${stat.isAllIssued ? 'text-green-600 dark:text-green-400' : 'text-orange-600 dark:text-orange-400'
                              }`}>
                              {stat.isAllIssued ? '✅ ครบ' : `${stat.issuedStores}/${stat.totalStores}`}
                            </span>
                          </div>

                          {/* Vehicle & Driver */}
                          <div className="flex items-center gap-2 text-[11px] text-gray-500 dark:text-gray-400 mb-2">
                            <span className="flex items-center gap-0.5">
                              <Truck className="w-3 h-3" /> {stat.vehiclePlate}
                            </span>
                            <span className="flex items-center gap-0.5 truncate">
                              <User className="w-3 h-3 flex-shrink-0" /> {stat.driverName}
                            </span>
                          </div>

                          {/* Progress Bar */}
                          <div className="mb-2">
                            <div className="w-full bg-gray-200 dark:bg-slate-700 rounded-full h-1">
                              <div
                                className={`h-1 rounded-full transition-all ${progressPercent === 100 ? 'bg-green-500' :
                                  progressPercent > 0 ? 'bg-yellow-500' : 'bg-gray-300 dark:bg-slate-600'
                                  }`}
                                style={{ width: `${progressPercent}%` }}
                              />
                            </div>
                          </div>

                          {/* Store List (compact) */}
                          <div className="space-y-0.5">
                            {stat.stores.map((store: any, idx: number) => (
                              <div
                                key={store.storeId}
                                className={`flex items-center gap-1.5 text-[11px] py-0.5 px-1.5 rounded ${store.invoiceStatus === 'issued'
                                  ? 'text-green-700 dark:text-green-300'
                                  : 'text-gray-600 dark:text-gray-400'
                                  }`}
                              >
                                <span className="w-4 h-4 flex-shrink-0 rounded-full bg-blue-500 dark:bg-blue-600 text-white flex items-center justify-center font-bold text-[8px]">
                                  {store.sequenceOrder || idx + 1}
                                </span>
                                <span className="flex-1 truncate">{store.storeName}</span>
                                {store.invoiceStatus === 'issued' ? (
                                  <CheckCircle className="w-3 h-3 text-green-500 flex-shrink-0" />
                                ) : (
                                  <Clock className="w-3 h-3 text-orange-400 flex-shrink-0" />
                                )}
                              </div>
                            ))}
                          </div>

                          {/* Click hint */}
                          <div className="mt-2 pt-1.5 border-t border-gray-200 dark:border-slate-700 text-center">
                            <span className="text-[10px] text-blue-500 dark:text-blue-400 font-medium flex items-center justify-center gap-1">
                              คลิกเพื่อไปที่ทริปนี้ <ChevronDown className="w-3 h-3" />
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>


                  {/* Right scroll button (เลื่อนไปดูทริปถัดไป) */}
                  {tripInvoiceStats.length > 1 && (
                    <button
                      onClick={() => {
                        const visibleCount = 3; // ประมาณจำนวนการ์ดที่มองเห็นได้ใน 1 หน้าต่าง
                        const maxIndex = Math.max(0, tripInvoiceStats.length - visibleCount);
                        setTripSummaryIndex(prev => Math.min(maxIndex, prev + 1));
                      }}
                      className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-white dark:bg-slate-800 shadow-lg border border-gray-200 dark:border-slate-600 flex items-center justify-center opacity-70 hover:opacity-100 transition-opacity hover:bg-gray-50 dark:hover:bg-slate-700"
                    >
                      <ChevronRight className="w-4 h-4 text-gray-600 dark:text-gray-300" />
                    </button>
                  )}
                </div>
              </div>
            </Card>
          )}

          {/* Content */}
          {myTrips.length === 0 ? (
            <Card>
              <div className="p-12 text-center text-gray-500 dark:text-gray-400">
                <Truck className="w-16 h-16 mx-auto mb-4 opacity-30" />
                <p className="text-lg font-medium">ไม่มีทริปในวันที่เลือก</p>
                <p className="text-sm mt-2">เลือกวันอื่นเพื่อดูทริปของคุณ</p>
              </div>
            </Card>
          ) : viewMode === 'by_trip' ? (
            /* === แสดงแบบทริป (เหมือนเดิม) === */
            <div className="space-y-6">
              {myTrips.map((trip: any) => (
                <div key={trip.id} id={`trip-card-${trip.id}`} className="scroll-mt-4 transition-all duration-300 rounded-xl">
                  <TripCard
                    trip={trip}
                    expandedStores={expandedStores}
                    updatingStatus={updatingStatus}
                    onToggleStoreExpand={handleToggleStoreExpand}
                    onViewStoreDetail={handleViewStoreDetail}
                    onToggleInvoiceStatus={handleToggleInvoiceStatus}
                    hasPackingLayout={tripsWithLayout.has(trip.id)}
                  />
                </div>
              ))}
            </div>
          ) : (
            /* === แสดงแบบรายร้าน (merged) === */
            <div className="space-y-4">
              {mergedStores.length === 0 ? (
                <Card>
                  <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                    <MapPin className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>ไม่มีร้านค้าในทริปวันนี้</p>
                  </div>
                </Card>
              ) : (
                mergedStores.map((entry) => (
                  <StoreCard
                    key={entry.store_id}
                    entry={entry}
                    expandedStores={expandedStores}
                    updatingStatus={updatingStatus}
                    onToggleExpand={(storeId) => {
                      setExpandedStores(prev => {
                        const next = new Set(prev);
                        if (next.has(storeId)) next.delete(storeId);
                        else next.add(storeId);
                        return next;
                      });
                    }}
                    onViewDetail={(entry) => setSelectedMergedStore(entry)}
                    onToggleInvoiceStatus={handleToggleInvoiceStatus}
                  />
                ))
              )}
            </div>
          )}

          {/* Store Detail Modal */}
          {selectedStoreDetail && (
            <Modal
              isOpen={!!selectedStoreDetail}
              onClose={() => {
                setSelectedStoreDetail(null);
                setCheckedItems(new Set()); // Reset checked items when closing modal
              }}
              title={`รายละเอียดสินค้า - ${selectedStoreDetail.store.store?.customer_name || 'ไม่ระบุชื่อร้าน'}`}
              size="large"
            >
              <div className="space-y-4">
                {/* Store Info */}
                <div className="p-4 bg-gray-50 dark:bg-slate-800/50 rounded-lg">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-3">ข้อมูลร้านค้า</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">รหัสลูกค้า:</span>
                      <span className="ml-2 font-medium text-gray-900 dark:text-white">
                        {selectedStoreDetail.store.store?.customer_code || 'ไม่ระบุ'}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">ชื่อร้าน:</span>
                      <span className="ml-2 font-medium text-gray-900 dark:text-white">
                        {selectedStoreDetail.store.store?.customer_name || 'ไม่ระบุ'}
                      </span>
                    </div>
                    {selectedStoreDetail.store.store?.address && (
                      <div className="md:col-span-2">
                        <span className="text-gray-600 dark:text-gray-400">ที่อยู่:</span>
                        <span className="ml-2 text-gray-900 dark:text-white">
                          {selectedStoreDetail.store.store.address}
                        </span>
                      </div>
                    )}
                    {selectedStoreDetail.store.store?.phone && (
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">เบอร์โทร:</span>
                        <span className="ml-2 text-gray-900 dark:text-white">
                          {selectedStoreDetail.store.store.phone}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {(selectedStoreDetail.store.order_status === 'partial' || selectedStoreDetail.store.order_status === 'assigned') && (
                  <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                    <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                      ⏳ ออเดอร์นี้ส่งไม่ครบในทริปนี้ — มีบางส่วนค้างส่งทริปอื่น
                    </p>
                    <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                      รายการด้านล่างเป็นเฉพาะส่วนที่จัดส่งในทริปนี้เท่านั้น
                    </p>
                  </div>
                )}

                {/* Items List with Checklist Helper */}
                {selectedStoreDetail.store.items && selectedStoreDetail.store.items.length > 0 ? (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold text-gray-900 dark:text-white">
                        รายการสินค้า ({selectedStoreDetail.store.items.length} รายการ)
                      </h3>
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-gray-600 dark:text-gray-400">💡</span>
                        <span className="text-gray-600 dark:text-gray-400">
                          ใช้รายการนี้เป็นคู่มือในการคีย์บิลในระบบอื่น
                        </span>
                      </div>
                    </div>

                    {/* Summary Card with Progress */}
                    <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                      <div className="flex items-center justify-between text-sm mb-2">
                        <span className="text-blue-800 dark:text-blue-200 font-medium">
                          📋 สรุปรายการสินค้า
                        </span>
                        <span className="text-blue-700 dark:text-blue-300">
                          รวม {selectedStoreDetail.store.items.length} รายการ
                        </span>
                      </div>
                      {(() => {
                        const totalItems = selectedStoreDetail.store.items.length;
                        const checkedCount = selectedStoreDetail.store.items.filter((item: any) => {
                          const itemKey = `${selectedStoreDetail.tripId}-${selectedStoreDetail.store.store_id}-${item.id}`;
                          return checkedItems.has(itemKey);
                        }).length;
                        const progress = totalItems > 0 ? (checkedCount / totalItems) * 100 : 0;

                        return (
                          <div className="mt-2">
                            <div className="flex items-center justify-between text-xs mb-1">
                              <span className="text-blue-700 dark:text-blue-300">
                                คีย์แล้ว: {checkedCount} / {totalItems} รายการ
                              </span>
                              <span className={`font-semibold ${progress === 100
                                ? 'text-green-600 dark:text-green-400'
                                : progress > 0
                                  ? 'text-yellow-600 dark:text-yellow-400'
                                  : 'text-gray-600 dark:text-gray-400'
                                }`}>
                                {progress.toFixed(0)}%
                              </span>
                            </div>
                            <div className="w-full bg-gray-200 dark:bg-slate-700 rounded-full h-2">
                              <div
                                className={`h-2 rounded-full transition-all duration-300 ${progress === 100
                                  ? 'bg-green-500'
                                  : progress > 0
                                    ? 'bg-yellow-500'
                                    : 'bg-gray-300 dark:bg-slate-600'
                                  }`}
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                          </div>
                        );
                      })()}
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse">
                        <thead>
                          <tr className="border-b-2 border-gray-300 dark:border-slate-600 bg-gray-50 dark:bg-slate-800">
                            <th className="text-center py-3 px-3 text-sm font-semibold text-gray-700 dark:text-gray-300 w-12">✓</th>
                            <th className="text-center py-3 px-3 text-sm font-semibold text-gray-700 dark:text-gray-300 w-16">ลำดับ</th>
                            <th className="text-left py-3 px-3 text-sm font-semibold text-gray-700 dark:text-gray-300">รหัสสินค้า</th>
                            <th className="text-left py-3 px-3 text-sm font-semibold text-gray-700 dark:text-gray-300">ชื่อสินค้า</th>
                            <th className="text-left py-3 px-3 text-sm font-semibold text-gray-700 dark:text-gray-300">หมวดหมู่</th>
                            <th className="text-right py-3 px-3 text-sm font-semibold text-gray-700 dark:text-gray-300">จำนวนสั่ง</th>
                            <th className="text-right py-3 px-3 text-sm font-semibold text-amber-600 dark:text-amber-400">รับที่ร้านแล้ว</th>
                            <th className="text-right py-3 px-3 text-sm font-semibold text-gray-700 dark:text-gray-300">หน่วย</th>
                            {selectedStoreDetail.store.items[0]?.product?.base_price ? (
                              <th className="text-right py-3 px-3 text-sm font-semibold text-gray-700 dark:text-gray-300">ราคาต่อหน่วย</th>
                            ) : null}
                          </tr>
                        </thead>
                        <tbody>
                          {selectedStoreDetail.store.items.map((item: any, index: number) => {
                            const itemKey = `${selectedStoreDetail.tripId}-${selectedStoreDetail.store.store_id}-${item.id}`;
                            const isChecked = checkedItems.has(itemKey);

                            return (
                              <tr
                                key={item.id}
                                className={`border-b border-gray-100 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors ${isChecked ? 'bg-green-50 dark:bg-green-900/10' : ''
                                  }`}
                              >
                                <td className="py-3 px-3 text-center">
                                  <button
                                    onClick={() => {
                                      setCheckedItems(prev => {
                                        const next = new Set(prev);
                                        if (next.has(itemKey)) {
                                          next.delete(itemKey);
                                        } else {
                                          next.add(itemKey);
                                        }
                                        return next;
                                      });
                                    }}
                                    className={`
                                  w-6 h-6 border-2 rounded flex items-center justify-center transition-all cursor-pointer
                                  ${isChecked
                                        ? 'bg-green-500 border-green-600 dark:bg-green-600 dark:border-green-700'
                                        : 'bg-white dark:bg-slate-800 border-gray-300 dark:border-slate-600 hover:border-green-400 dark:hover:border-green-500'
                                      }
                                `}
                                    title={isChecked ? 'คลิกเพื่อยกเลิกการเช็ค' : 'คลิกเพื่อเช็คว่าคีย์สินค้านี้แล้ว'}
                                  >
                                    {isChecked && (
                                      <CheckCircle className="w-4 h-4 text-white" />
                                    )}
                                  </button>
                                </td>
                                <td className="py-3 px-3 text-sm text-center text-gray-600 dark:text-gray-400 font-mono font-semibold">
                                  {index + 1}
                                </td>
                                <td className="py-3 px-3 text-sm">
                                  <div className="flex flex-col gap-1 items-start">
                                    <Badge variant="info" className="text-xs font-mono">
                                      {item.product?.product_code || 'ไม่ระบุ'}
                                    </Badge>
                                    {item.is_bonus && (
                                      <Badge variant="success" className="text-xs">
                                        ของแถม
                                      </Badge>
                                    )}
                                  </div>
                                </td>
                                <td className="py-3 px-3 text-sm font-medium text-gray-900 dark:text-white">
                                  {item.product?.product_name || 'ไม่ระบุชื่อ'}
                                </td>
                                <td className="py-3 px-3 text-sm text-gray-600 dark:text-gray-400">
                                  {item.product?.category || '-'}
                                </td>
                                <td className="py-3 px-3 text-sm text-right font-semibold text-gray-900 dark:text-white">
                                  {Math.floor(Number(item.quantity) || 0).toLocaleString('th-TH', { maximumFractionDigits: 0 })}
                                </td>
                                <td className="py-3 px-3 text-sm text-right">
                                  {(() => {
                                    const pickedUp = Math.floor(Number(item.quantity_picked_up_at_store) || 0);
                                    const unit = item.product?.unit || 'ชิ้น';
                                    if (pickedUp > 0) {
                                      return (
                                        <span className="text-amber-600 dark:text-amber-400 font-medium" title="ลูกค้ามารับไปที่หน้าร้านแล้ว">
                                          {pickedUp.toLocaleString('th-TH', { maximumFractionDigits: 0 })} {unit}
                                        </span>
                                      );
                                    }
                                    return <span className="text-gray-400 dark:text-gray-500">—</span>;
                                  })()}
                                </td>
                                <td className="py-3 px-3 text-sm text-right text-gray-600 dark:text-gray-400">
                                  {item.product?.unit || 'ชิ้น'}
                                </td>
                                {item.product?.base_price ? (
                                  <td className="py-3 px-3 text-sm text-right text-gray-600 dark:text-gray-400">
                                    {new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' }).format(item.product.base_price)}
                                  </td>
                                ) : null}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Helper Text */}
                    <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                      <p className="text-xs text-yellow-800 dark:text-yellow-300">
                        <strong>💡 คำแนะนำ:</strong> ใช้รายการนี้เป็นคู่มือในการคีย์บิลในระบบอื่น จำนวนเป็น<strong>จำนวนเต็ม</strong>เท่านั้น คอลัมน์ &quot;รับที่ร้านแล้ว&quot; ระบุจำนวนที่ลูกค้ามารับไปที่หน้าร้านแล้ว — ตรวจสอบให้ครบทุกรายการก่อนกด &quot;ยืนยันการออกบิล&quot;
                      </p>
                    </div>

                    {/* Confirm Button */}
                    <div className="mt-6 pt-4 border-t border-gray-200 dark:border-slate-700">
                      {(() => {
                        const totalItems = selectedStoreDetail.store.items.length;
                        const checkedCount = selectedStoreDetail.store.items.filter((item: any) => {
                          const itemKey = `${selectedStoreDetail.tripId}-${selectedStoreDetail.store.store_id}-${item.id}`;
                          return checkedItems.has(itemKey);
                        }).length;
                        const allChecked = checkedCount === totalItems && totalItems > 0;
                        const currentInvoiceStatus = selectedStoreDetail.store.invoice_status || 'pending';
                        const isAlreadyIssued = currentInvoiceStatus === 'issued';
                        const modalKey = `${selectedStoreDetail.tripId}-${selectedStoreDetail.store.store_id}`;
                        const isUpdating = updatingStatus.has(modalKey);

                        return (
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              {!allChecked && totalItems > 0 && (
                                <p className="text-sm text-orange-600 dark:text-orange-400">
                                  ⚠️ ยังไม่ได้เช็ครายการครบ ({checkedCount} / {totalItems} รายการ)
                                </p>
                              )}
                              {allChecked && !isAlreadyIssued && (
                                <p className="text-sm text-green-600 dark:text-green-400">
                                  ✅ เช็ครายการครบแล้ว พร้อมยืนยันการออกบิล
                                </p>
                              )}
                              {isAlreadyIssued && (
                                <p className="text-sm text-blue-600 dark:text-blue-400">
                                  ℹ️ สถานะการออกบิล: ออกบิลแล้ว
                                </p>
                              )}
                            </div>
                            <div className="flex gap-3">
                              {isAlreadyIssued ? (
                                <Button
                                  variant="outline"
                                  onClick={async () => {
                                    await handleToggleInvoiceStatus(
                                      selectedStoreDetail.tripId,
                                      selectedStoreDetail.store.store_id,
                                      currentInvoiceStatus,
                                      (newStatus) => {
                                        // Update the selectedStoreDetail state immediately
                                        setSelectedStoreDetail(prev => {
                                          if (!prev) return null;
                                          return {
                                            ...prev,
                                            store: {
                                              ...prev.store,
                                              invoice_status: newStatus,
                                            },
                                          };
                                        });
                                      }
                                    );
                                    // Close modal after updating
                                    setTimeout(() => {
                                      setSelectedStoreDetail(null);
                                      // Don't reset checkedItems here - let useEffect handle it based on invoice_status
                                    }, 1000);
                                  }}
                                  disabled={isUpdating}
                                >
                                  {isUpdating ? (
                                    <>
                                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2" />
                                      กำลังอัพเดท...
                                    </>
                                  ) : (
                                    <>
                                      <Square className="w-4 h-4 mr-2" />
                                      ยกเลิกสถานะออกบิล
                                    </>
                                  )}
                                </Button>
                              ) : (
                                <Button
                                  onClick={async () => {
                                    if (!allChecked) {
                                      warning('กรุณาเช็ครายการสินค้าให้ครบก่อนยืนยันการออกบิล');
                                      return;
                                    }

                                    // Call handleToggleInvoiceStatus with callback to update state immediately
                                    await handleToggleInvoiceStatus(
                                      selectedStoreDetail.tripId,
                                      selectedStoreDetail.store.store_id,
                                      currentInvoiceStatus,
                                      (newStatus) => {
                                        // Update the selectedStoreDetail state immediately
                                        setSelectedStoreDetail(prev => {
                                          if (!prev) return null;
                                          return {
                                            ...prev,
                                            store: {
                                              ...prev.store,
                                              invoice_status: newStatus,
                                            },
                                          };
                                        });
                                      }
                                    );

                                    // Close modal after a short delay to show success
                                    setTimeout(() => {
                                      setSelectedStoreDetail(null);
                                      // Don't reset checkedItems here - let useEffect handle it based on invoice_status
                                    }, 1500);
                                  }}
                                  disabled={!allChecked || isUpdating}
                                  className={`
                                ${allChecked
                                      ? 'bg-green-600 hover:bg-green-700 dark:bg-green-600 dark:hover:bg-green-700'
                                      : 'bg-gray-300 dark:bg-gray-600 cursor-not-allowed'
                                    }
                              `}
                                >
                                  {isUpdating ? (
                                    <>
                                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                                      กำลังอัพเดท...
                                    </>
                                  ) : (
                                    <>
                                      <CheckCircle className="w-4 h-4 mr-2" />
                                      ยืนยันการออกบิล
                                    </>
                                  )}
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>ยังไม่มีรายการสินค้า</p>
                  </div>
                )}
              </div>
            </Modal>
          )}
          {/* Merged Store Detail Modal (แบบรายร้าน) */}
          {selectedMergedStore && (
            <Modal
              isOpen={!!selectedMergedStore}
              onClose={() => setSelectedMergedStore(null)}
              title={`รายละเอียดสินค้า - ${selectedMergedStore.store?.customer_name || 'ไม่ระบุชื่อร้าน'}`}
              size="large"
            >
              <div className="space-y-4">
                {/* Store Info */}
                <div className="p-4 bg-gray-50 dark:bg-slate-800/50 rounded-lg">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-3">ข้อมูลร้านค้า</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">รหัสลูกค้า:</span>
                      <span className="ml-2 font-medium text-gray-900 dark:text-white">
                        {selectedMergedStore.store?.customer_code || 'ไม่ระบุ'}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">ชื่อร้าน:</span>
                      <span className="ml-2 font-medium text-gray-900 dark:text-white">
                        {selectedMergedStore.store?.customer_name || 'ไม่ระบุ'}
                      </span>
                    </div>
                    {selectedMergedStore.store?.address && (
                      <div className="md:col-span-2">
                        <span className="text-gray-600 dark:text-gray-400">ที่อยู่:</span>
                        <span className="ml-2 text-gray-900 dark:text-white">{selectedMergedStore.store.address}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Trip Info */}
                {selectedMergedStore.trips.length > 1 && (
                  <div className="p-4 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-lg">
                    <p className="text-sm font-semibold text-amber-800 dark:text-amber-300 mb-2">
                      สินค้าร้านนี้แบ่งส่งด้วยรถ {selectedMergedStore.trips.length} คัน (ออกบิลรวมเป็นใบเดียว)
                    </p>
                    {selectedMergedStore.trips.map((t) => (
                      <div key={t.trip_id} className="flex items-center gap-4 text-sm py-1 flex-wrap">
                        <div className="flex items-center gap-1 text-gray-700 dark:text-gray-300">
                          <Truck className="w-4 h-4 text-blue-500" />
                          <span className="font-medium">{t.vehicle_plate}</span>
                        </div>
                        <div className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
                          <User className="w-3 h-3" />
                          <span>{t.driver_name}</span>
                        </div>
                        <Badge variant="default" className="text-xs">{t.trip_number}</Badge>
                        <span className="text-xs text-gray-500">{t.items.length} รายการ</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Items Table — ยอดรวม */}
                {selectedMergedStore.summaryItems.length > 0 ? (
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white mb-3">
                      รายการสินค้า ({selectedMergedStore.summaryItems.length} รายการ)
                    </h3>
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse">
                        <thead>
                          <tr className="border-b-2 border-gray-300 dark:border-slate-600 bg-gray-50 dark:bg-slate-800">
                            <th className="text-center py-3 px-3 text-sm font-semibold text-gray-700 dark:text-gray-300 w-16">ลำดับ</th>
                            <th className="text-left py-3 px-3 text-sm font-semibold text-gray-700 dark:text-gray-300">รหัสสินค้า</th>
                            <th className="text-left py-3 px-3 text-sm font-semibold text-gray-700 dark:text-gray-300">ชื่อสินค้า</th>
                            <th className="text-right py-3 px-3 text-sm font-semibold text-gray-700 dark:text-gray-300">จำนวนสั่ง</th>
                            <th className="text-right py-3 px-3 text-sm font-semibold text-amber-600 dark:text-amber-400">รับที่ร้านแล้ว</th>
                            <th className="text-right py-3 px-3 text-sm font-semibold text-gray-700 dark:text-gray-300">หน่วย</th>
                            {selectedMergedStore.trips.length > 1 && (
                              <th className="text-left py-3 px-3 text-sm font-semibold text-gray-700 dark:text-gray-300">แบ่งตามรถ</th>
                            )}
                          </tr>
                        </thead>
                        <tbody>
                          {selectedMergedStore.summaryItems.map((si, index) => (
                            <tr key={`${si.product_id}-${si.is_bonus}`} className="border-b border-gray-100 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800/50">
                              <td className="py-3 px-3 text-sm text-center text-gray-600 dark:text-gray-400 font-mono font-semibold">
                                {index + 1}
                              </td>
                              <td className="py-3 px-3 text-sm">
                                <Badge variant="info" className="text-xs font-mono">{si.product?.product_code || 'ไม่ระบุ'}</Badge>
                                {si.is_bonus && <Badge variant="success" className="text-xs ml-1">ของแถม</Badge>}
                              </td>
                              <td className="py-3 px-3 text-sm font-medium text-gray-900 dark:text-white">
                                {si.product?.product_name || 'ไม่ระบุชื่อ'}
                              </td>
                              <td className="py-3 px-3 text-sm text-right font-bold text-gray-900 dark:text-white">
                                {Math.floor(si.totalQuantity).toLocaleString('th-TH', { maximumFractionDigits: 0 })}
                              </td>
                              <td className="py-3 px-3 text-sm text-right">
                                {si.totalPickedUp > 0 ? (
                                  <span className="text-amber-600 dark:text-amber-400 font-medium">
                                    {si.totalPickedUp.toLocaleString('th-TH', { maximumFractionDigits: 0 })} {si.product?.unit || 'ชิ้น'}
                                  </span>
                                ) : (
                                  <span className="text-gray-400 dark:text-gray-500">—</span>
                                )}
                              </td>
                              <td className="py-3 px-3 text-sm text-right text-gray-600 dark:text-gray-400">
                                {si.product?.unit || 'ชิ้น'}
                              </td>
                              {selectedMergedStore.trips.length > 1 && (
                                <td className="py-3 px-3 text-sm">
                                  <div className="flex flex-wrap gap-1.5">
                                    {si.breakdown.map((b, bi) => (
                                      <span key={bi} className="inline-flex items-center gap-1 text-xs bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-400 px-2 py-0.5 rounded">
                                        <Truck className="w-3 h-3" />{b.vehicle_plate}: {Math.floor(b.quantity || 0).toLocaleString('th-TH', { maximumFractionDigits: 0 })}
                                        {b.pickedUp != null && b.pickedUp > 0 && (
                                          <span className="text-amber-600 dark:text-amber-400"> (รับที่ร้าน {b.pickedUp})</span>
                                        )}
                                      </span>
                                    ))}
                                  </div>
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                      <p className="text-xs text-blue-800 dark:text-blue-300">
                        <strong>ข้อมูลสำคัญ:</strong> จำนวนเป็น<strong>จำนวนเต็ม</strong>เท่านั้น คอลัมน์ &quot;รับที่ร้านแล้ว&quot; ระบุจำนวนที่ลูกค้ามารับไปที่หน้าร้านแล้ว
                        {selectedMergedStore.trips.length > 1 && (
                          <> ควรออกเป็น <strong>บิลเดียว</strong> คอลัมน์ &quot;แบ่งตามรถ&quot; แสดงว่าสินค้าถูกส่งไปกับรถทะเบียนใดจำนวนเท่าไร</>
                        )}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>ยังไม่มีรายการสินค้า</p>
                  </div>
                )}
              </div>
            </Modal>
          )}
        </div>
      </PageLayout >
    </>
  );
}

