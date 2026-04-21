import React, { useState, useMemo, useCallback, memo, useEffect, useRef } from 'react';
import { Truck, MapPin, Package, Calendar, User, Phone, CheckCircle, Clock, CheckSquare, Square, Eye, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Building2, Layers, Info } from 'lucide-react';
import { useAuth, useToast } from '../hooks';
import { useDeliveryTrips } from '../hooks/useDeliveryTrips';
import { useInvoiceStatus } from '../hooks/useInvoiceStatus';
import { deliveryTripService } from '../services/deliveryTripService';
import { ordersService, type OrderInvoiceDisplayLine } from '../services/ordersService';
import { tripMetricsService } from '../services/tripMetricsService';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { PageLayout } from '../components/ui/PageLayout';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { ToastContainer } from '../components/ui/Toast';
import { Modal } from '../components/ui/Modal';
import { TripCard } from '../components/trip/SalesTripCard';

// โหมดแสดงผล: ดูแบบทริป vs ดูแบบรายร้าน
type ViewMode = 'by_trip' | 'by_store';

/** ข้อความใต้ชื่อสินค้า — เปรียบเทียบบรรทัดออเดอร์กับรายการในทริปวันนี้ */
const MSG_PRODUCT_NOT_ON_TRIP_TODAY =
  'ยังไม่มีในรายการทริปวันนี้ — จะมีเมื่อจัดสินค้านี้ลงทริป';
const MSG_PRODUCT_ON_TRIP_WITH_BREAKDOWN =
  'จัดลงทริปวันนี้แล้ว — ยอดส่งต่อรถอยู่ด้านล่าง';
const MSG_PRODUCT_ON_TRIP_MODAL_MULTI_TRIP =
  'จัดลงทริปวันนี้แล้ว — ยอดส่งต่อรถดูในคอลัมน์แบ่งตามรถ';
const MSG_PRODUCT_ON_TRIP_COMPACT = 'จัดลงทริปวันนี้แล้ว';

// สินค้ารวมยอด: product_id เดียวกันจากหลายทริป → แสดงเป็นแถวเดียว + breakdown
interface SummaryItem {
  product_id: string;
  product: any;
  /** หน่วยจากบรรทัดทริป/ออเดอร์ (delivery_trip_items.unit) */
  line_unit?: string | null;
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

function getMergedSummaryCheckKey(si: SummaryItem): string {
  return `${si.product_id}-${si.is_bonus ? 'bonus' : 'normal'}`;
}

/** orderQuantities map keys are `${product_id}_${bonus|normal}_${unit}` — aggregate all unit variants for billing */
function aggregateOrderQtyForProduct(
  map: Map<string, { ordered: number; pickedUp: number; delivered?: number }>,
  productId: string,
  isBonus: boolean,
): { ordered: number; pickedUp: number; delivered: number } {
  const token = isBonus ? 'bonus' : 'normal';
  const prefix = `${productId}_${token}_`;
  let ordered = 0;
  let pickedUp = 0;
  let delivered = 0;
  for (const [k, v] of map) {
    if (k === `${productId}_${token}_` || k.startsWith(prefix)) {
      ordered += v.ordered;
      pickedUp += v.pickedUp;
      delivered += v.delivered ?? 0;
    }
  }
  return { ordered, pickedUp, delivered };
}

/** รวมบรรทัด delivery_trip_items ในทริปเดียว → แถวเดียวต่อสินค้า (ใบแจ้งหนี้) */
function buildSingleTripInvoiceRows(items: any[]): Array<{
  rowKey: string;
  product_id: string;
  is_bonus: boolean;
  product: any;
  line_unit: string;
  tripQuantity: number;
  tripPickedUp: number;
}> {
  const rowMap = new Map<
    string,
    {
      rowKey: string;
      product_id: string;
      is_bonus: boolean;
      product: any;
      line_unit: string;
      tripQuantity: number;
      tripPickedUp: number;
    }
  >();
  for (const item of items || []) {
    const rowKey = `${item.product_id}-${item.is_bonus ? 'bonus' : 'normal'}`;
    if (!rowMap.has(rowKey)) {
      const lu =
        item.unit != null && String(item.unit).trim() !== ''
          ? String(item.unit).trim()
          : (item.product?.unit ?? 'ชิ้น');
      rowMap.set(rowKey, {
        rowKey,
        product_id: item.product_id,
        is_bonus: !!item.is_bonus,
        product: item.product,
        line_unit: lu,
        tripQuantity: 0,
        tripPickedUp: 0,
      });
    }
    const row = rowMap.get(rowKey)!;
    row.tripQuantity += Number(item.quantity) || 0;
    row.tripPickedUp += Math.floor(Number(item.quantity_picked_up_at_store) || 0);
  }
  return Array.from(rowMap.values());
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
    order_status?: string;
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
  /** เปิด modal เช็ครายการสินค้าทีละรายการ (เดียวกับมุมมองแบบทริป) — ถ้าไม่ส่ง จะใช้ onViewDetail แบบเดิม */
  onOpenInvoiceChecklist?: (entry: MergedStoreEntry) => void;
  onToggleInvoiceStatus: (tripId: string, storeId: string, currentStatus: string) => void;
  /** ยอดตาม order_items (ใบแจ้งหนี้) + quantity_delivered — โหลดแยกจากทริป */
  orderQtyMap?: Map<string, { ordered: number; pickedUp: number; delivered: number }>;
  /** รายการตามบรรทัดออเดอร์จริง (ครบทุกรายการที่สั่ง) — ถ้ามีจะใช้แทน summaryItems */
  orderInvoiceLines?: OrderInvoiceDisplayLine[];
}

const StoreCard = memo(
  ({
    entry,
    expandedStores,
    updatingStatus,
    onToggleExpand,
    onViewDetail,
    onOpenInvoiceChecklist,
    onToggleInvoiceStatus,
    orderQtyMap,
    orderInvoiceLines,
  }: StoreCardProps) => {
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
              รายการสินค้า (
              {orderInvoiceLines?.length ?? entry.summaryItems.length} รายการ
              {orderInvoiceLines?.length ? ' ตามออเดอร์' : ''}
              {isSplit ? `, รวมจาก ${entry.trips.length} คัน` : ''})
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => onToggleExpand(entry.store_id)}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 px-2 py-1 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20"
              >
                {isExpanded ? <><ChevronUp className="w-3 h-3" />ซ่อน</> : <><ChevronDown className="w-3 h-3" />ดูรายการ</>}
              </button>
              <button
                type="button"
                onClick={() =>
                  onOpenInvoiceChecklist ? onOpenInvoiceChecklist(entry) : onViewDetail(entry)
                }
                title={
                  onOpenInvoiceChecklist
                    ? 'เปิดรายการเพื่อเช็คสินค้าก่อนยืนยันออกบิล (ยอดรวมต่อสินค้า รวมทุกคันสำหรับร้านนี้)'
                    : 'ดูรายละเอียดรวม'
                }
                className="text-xs text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1 px-2 py-1 rounded hover:bg-purple-50 dark:hover:bg-purple-900/20"
              >
                <Eye className="w-3 h-3" />ดูทั้งหมด
              </button>
            </div>
          </div>

          {isExpanded &&
            ((orderInvoiceLines?.length ?? 0) > 0 || entry.summaryItems.length > 0) && (
            <div className="p-3 bg-white dark:bg-slate-900/50 rounded-lg border border-gray-200 dark:border-slate-700 space-y-2 max-h-96 overflow-y-auto">
              {orderInvoiceLines && orderInvoiceLines.length > 0
                ? orderInvoiceLines.map((line, idx) => {
                    const summarySi = entry.summaryItems.find(
                      (si) => si.product_id === line.product_id && si.is_bonus === line.is_bonus,
                    );
                    const unitLabel =
                      line.unit || line.product?.unit || summarySi?.line_unit || summarySi?.product?.unit || 'ชิ้น';
                    const deliverPct =
                      line.ordered > 0
                        ? Math.min(100, Math.round((line.delivered / line.ordered) * 100))
                        : null;
                    const remaining = line.ordered > 0 ? Math.max(0, line.ordered - line.delivered) : null;
                    const showTripBreakdown =
                      summarySi &&
                      (isSplit ? summarySi.breakdown.length >= 1 : summarySi.breakdown.length > 1);
                    return (
                      <div
                        key={line.rowKey}
                        className="py-2 px-2 border-b border-gray-100 dark:border-slate-700 last:border-b-0 hover:bg-gray-50 dark:hover:bg-slate-800/50 rounded"
                      >
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-start gap-3 flex-1 min-w-0">
                            <span className="text-xs text-gray-400 font-mono w-6 flex-shrink-0">{idx + 1}.</span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-gray-900 dark:text-white font-medium">
                                  {line.product?.product_name || summarySi?.product?.product_name || 'ไม่ระบุชื่อ'}
                                </span>
                                {(line.product?.product_code || summarySi?.product?.product_code) && (
                                  <Badge variant="info" className="text-xs font-mono">
                                    {line.product?.product_code || summarySi?.product?.product_code}
                                  </Badge>
                                )}
                                {line.is_bonus && <Badge variant="success" className="text-xs">ของแถม</Badge>}
                              </div>
                              {!summarySi && (
                                <p className="text-[11px] text-amber-700 dark:text-amber-300 mt-1">
                                  {MSG_PRODUCT_NOT_ON_TRIP_TODAY}
                                </p>
                              )}
                              {summarySi && (
                                <p className="text-[11px] text-enterprise-600 dark:text-enterprise-400 mt-1">
                                  {showTripBreakdown
                                    ? MSG_PRODUCT_ON_TRIP_WITH_BREAKDOWN
                                    : MSG_PRODUCT_ON_TRIP_COMPACT}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="text-right ml-4 flex-shrink-0">
                            <span className="text-gray-900 dark:text-white font-bold text-sm">
                              {Math.floor(line.ordered).toLocaleString('th-TH', { maximumFractionDigits: 0 })}{' '}
                              {unitLabel}
                            </span>
                            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">ตามออเดอร์ (ออกบิล)</p>
                            {line.ordered > 0 && deliverPct != null && remaining != null && (
                              <p className="text-xs text-enterprise-600 dark:text-enterprise-400 mt-1 font-medium">
                                จัดส่งแล้ว {line.delivered.toLocaleString('th-TH', { maximumFractionDigits: 0 })} /{' '}
                                {line.ordered.toLocaleString('th-TH', { maximumFractionDigits: 0 })} ({deliverPct}%) ·
                                คงเหลือ {remaining.toLocaleString('th-TH', { maximumFractionDigits: 0 })}
                              </p>
                            )}
                            {line.pickedUp > 0 && (
                              <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                                รับที่ร้านแล้ว {line.pickedUp.toLocaleString('th-TH', { maximumFractionDigits: 0 })}{' '}
                                {unitLabel}
                              </p>
                            )}
                          </div>
                        </div>
                        {showTripBreakdown && summarySi && (
                          <div className="ml-9 mt-1 flex flex-wrap gap-2">
                            <span className="text-[10px] text-gray-500 dark:text-gray-400 mr-1">จัดในทริป:</span>
                            {summarySi.breakdown.map((b, bi) => (
                              <span
                                key={bi}
                                className="inline-flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-slate-800 px-2 py-0.5 rounded"
                              >
                                <Truck className="w-3 h-3" />
                                {b.vehicle_plate}:{' '}
                                {Math.floor(b.quantity || 0).toLocaleString('th-TH', {
                                  maximumFractionDigits: 0,
                                })}
                                {b.pickedUp != null && b.pickedUp > 0 && (
                                  <span className="text-amber-600 dark:text-amber-400"> (รับที่ร้าน {b.pickedUp})</span>
                                )}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })
                : entry.summaryItems.map((si, idx) => {
                    const agg = orderQtyMap?.size
                      ? aggregateOrderQtyForProduct(orderQtyMap, si.product_id, si.is_bonus)
                      : null;
                    const billQty = agg && agg.ordered > 0 ? agg.ordered : si.totalQuantity;
                    const unitLabel = si.line_unit || si.product?.unit || 'ชิ้น';
                    const deliverPct =
                      agg && agg.ordered > 0 ? Math.min(100, Math.round((agg.delivered / agg.ordered) * 100)) : null;
                    const remaining =
                      agg && agg.ordered > 0 ? Math.max(0, agg.ordered - agg.delivered) : null;
                    return (
                      <div
                        key={`${si.product_id}-${si.is_bonus}`}
                        className="py-2 px-2 border-b border-gray-100 dark:border-slate-700 last:border-b-0 hover:bg-gray-50 dark:hover:bg-slate-800/50 rounded"
                      >
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-start gap-3 flex-1 min-w-0">
                            <span className="text-xs text-gray-400 font-mono w-6 flex-shrink-0">{idx + 1}.</span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-gray-900 dark:text-white font-medium">
                                  {si.product?.product_name || 'ไม่ระบุชื่อ'}
                                </span>
                                {si.product?.product_code && (
                                  <Badge variant="info" className="text-xs font-mono">
                                    {si.product.product_code}
                                  </Badge>
                                )}
                                {si.is_bonus && <Badge variant="success" className="text-xs">ของแถม</Badge>}
                              </div>
                            </div>
                          </div>
                          <div className="text-right ml-4 flex-shrink-0">
                            <span className="text-gray-900 dark:text-white font-bold text-sm">
                              {Math.floor(billQty).toLocaleString('th-TH', { maximumFractionDigits: 0 })} {unitLabel}
                            </span>
                            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                              {agg && agg.ordered > 0 ? 'ตามออเดอร์ (ออกบิล)' : 'รวมจากทริป'}
                            </p>
                            {agg && agg.ordered > 0 && deliverPct != null && remaining != null && (
                              <p className="text-xs text-enterprise-600 dark:text-enterprise-400 mt-1 font-medium">
                                จัดส่งแล้ว {agg.delivered.toLocaleString('th-TH', { maximumFractionDigits: 0 })} /{' '}
                                {agg.ordered.toLocaleString('th-TH', { maximumFractionDigits: 0 })} ({deliverPct}%) ·
                                คงเหลือ {remaining.toLocaleString('th-TH', { maximumFractionDigits: 0 })}
                              </p>
                            )}
                            {si.totalPickedUp > 0 && (
                              <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                                รับที่ร้านแล้ว {si.totalPickedUp.toLocaleString('th-TH', { maximumFractionDigits: 0 })}{' '}
                                {unitLabel}
                              </p>
                            )}
                          </div>
                        </div>
                        {isSplit && si.breakdown.length > 1 && (
                          <div className="ml-9 mt-1 flex flex-wrap gap-2">
                            {si.breakdown.map((b, bi) => (
                              <span
                                key={bi}
                                className="inline-flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-slate-800 px-2 py-0.5 rounded"
                              >
                                <Truck className="w-3 h-3" />
                                {b.vehicle_plate}:{' '}
                                {Math.floor(b.quantity || 0).toLocaleString('th-TH', { maximumFractionDigits: 0 })}
                                {b.pickedUp != null && b.pickedUp > 0 && (
                                  <span className="text-amber-600 dark:text-amber-400"> (รับที่ร้าน {b.pickedUp})</span>
                                )}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
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
  const [expandedStores, setExpandedStores] = useState<Set<string>>(new Set());
  const [selectedStoreDetail, setSelectedStoreDetail] = useState<{ tripId: string; store: any } | null>(null);
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());
  const [orderQuantitiesByProduct, setOrderQuantitiesByProduct] = useState<
    Map<string, { ordered: number; pickedUp: number; delivered: number }>
  >(new Map());
  /** มุมมองรายร้าน: ยอดออเดอร์เต็มต่อ store_id (รวมทุกทริปในวันนี้) */
  const [orderQtyByStoreId, setOrderQtyByStoreId] = useState<
    Map<string, Map<string, { ordered: number; pickedUp: number; delivered: number }>>
  >(new Map());
  /** บรรทัด order_items ครบ — มุมมองรายร้าน (รวมรายการที่ยังไม่อยู่ในทริปวันนี้) */
  const [orderInvoiceLinesByStoreId, setOrderInvoiceLinesByStoreId] = useState<
    Map<string, OrderInvoiceDisplayLine[]>
  >(new Map());
  /** มุมมองทริป: key `${tripId}__${storeId}` */
  const [orderQtyByTripStoreKey, setOrderQtyByTripStoreKey] = useState<
    Map<string, Map<string, { ordered: number; pickedUp: number; delivered: number }>>
  >(new Map());
  const [viewMode, setViewMode] = useState<ViewMode>('by_trip'); // default = ดูแบบทริป (จัดกลุ่มตามทริป)
  // สำหรับ modal แบบ merged store
  const [selectedMergedStore, setSelectedMergedStore] = useState<MergedStoreEntry | null>(null);
  const [mergedCheckedItems, setMergedCheckedItems] = useState<Set<string>>(new Set());
  // Index สำหรับเลื่อน \"หน้าต่าง\" สรุปทริปวันนี้ (ควบคุมด้วยปุ่มลูกศรเท่านั้น)
  const [tripSummaryIndex, setTripSummaryIndex] = useState(0);
  // ขนาด viewport สรุปทริป - คำนวณจากความกว้างหน้าจอ
  const tripSummaryContainerRef = useRef<HTMLDivElement>(null);
  const [tripSummaryLayout, setTripSummaryLayout] = useState({
    blockWidth: 260,
    blocksVisible: 5,
    stepSize: 272,
  });

  // โหลดยอดออเดอร์เต็ม (สั่งทั้งหมด + รับที่ร้าน) สำหรับ modal รายละเอียดสินค้า
  useEffect(() => {
    if (!selectedStoreDetail) {
      setOrderQuantitiesByProduct(new Map());
      return;
    }
    const tripId = selectedStoreDetail.tripId;
    const storeId = selectedStoreDetail.store.store_id;
    if (!tripId || !storeId) return;

    ordersService
      .getOrderQuantitiesByProductForStoreInTrip(tripId, storeId)
      .then(setOrderQuantitiesByProduct)
      .catch(() => setOrderQuantitiesByProduct(new Map()));
  }, [selectedStoreDetail]);

  const singleTripInvoiceRows = useMemo(() => {
    if (!selectedStoreDetail?.store?.items?.length) return [];
    return buildSingleTripInvoiceRows(selectedStoreDetail.store.items);
  }, [selectedStoreDetail]);

  // Auto-check all items when invoice_status is 'issued'
  useEffect(() => {
    if (selectedStoreDetail && selectedStoreDetail.store.invoice_status === 'issued') {
      // Auto-check all items when invoice is already issued
      const rows = buildSingleTripInvoiceRows(selectedStoreDetail.store.items || []);
      const allItemKeys = rows.map((row) => {
        return `${selectedStoreDetail.tripId}-${selectedStoreDetail.store.store_id}-${row.rowKey}`;
      });
      setCheckedItems(new Set(allItemKeys));
    } else if (selectedStoreDetail && selectedStoreDetail.store.invoice_status !== 'issued') {
      // Reset checked items when invoice is not issued
      setCheckedItems(new Set());
    }
  }, [selectedStoreDetail]);

  useEffect(() => {
    if (!selectedMergedStore) {
      setMergedCheckedItems(new Set());
      return;
    }
    const allIssued = selectedMergedStore.trips.every((t) => (t.invoice_status || 'pending') === 'issued');
    if (allIssued) {
      const lines = orderInvoiceLinesByStoreId.get(selectedMergedStore.store_id);
      const keys =
        lines && lines.length > 0
          ? lines.map((l) => l.rowKey)
          : selectedMergedStore.summaryItems.map(getMergedSummaryCheckKey);
      setMergedCheckedItems(new Set(keys));
    } else {
      setMergedCheckedItems(new Set());
    }
  }, [selectedMergedStore, orderInvoiceLinesByStoreId]);

  // Fetch trips with full details for invoicing
  // Sales view needs items data to display and manage invoices
  // ดึงเฉพาะทริปที่ยังใช้งาน (ไม่รวม cancelled) เพื่อไม่ให้ทริปที่ลบ/ยกเลิกแล้วค้างอยู่บนหน้าออกบิล
  const { trips, loading, error: tripsError, refetch } = useDeliveryTrips({
    planned_date_from: dateFilter,
    planned_date_to: dateFilter,
    branch: branchFilter === 'ALL' ? undefined : branchFilter,
    status: ['planned', 'in_progress', 'completed'], // ไม่ดึง cancelled
    lite: false, // Use full mode to load items data (required for invoicing)
  });

  const { updatingStatus, handleToggleInvoiceStatus } = useInvoiceStatus({
    refetch,
    onSuccess: success,
    onError: error,
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

  // คำนวณขนาดบล็อคให้พอดีกับหน้าจอ — แสดง 5 บล็อคเสมอ แบ่งสัดส่วนเท่ากัน
  useEffect(() => {
    const el = tripSummaryContainerRef.current;
    if (!el) return;
    const GAP = 12;
    const PADDING = 16;
    const BLOCKS = 5; // แสดง 5 บล็อคเสมอ
    const MIN_BLOCK = 180;

    const update = () => {
      const w = el.offsetWidth;
      if (w <= 0) return;
      // 5 บล็อค เรียงเท่ากัน: (ความกว้าง - padding - ช่องว่าง 4 จุด) / 5
      const rawBlockWidth = (w - PADDING - (BLOCKS - 1) * GAP) / BLOCKS;
      const blockWidth = Math.max(MIN_BLOCK, rawBlockWidth);
      const stepSize = blockWidth + GAP;
      setTripSummaryLayout({ blockWidth, blocksVisible: BLOCKS, stepSize });
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [tripInvoiceStats.length]); // re-measure when trips change (section may mount/unmount)

  // Clamp tripSummaryIndex เมื่อ layout เปลี่ยน (เช่น resize หน้าต่าง)
  useEffect(() => {
    const maxIndex = Math.max(0, tripInvoiceStats.length - tripSummaryLayout.blocksVisible);
    setTripSummaryIndex(prev => Math.min(prev, maxIndex));
  }, [tripSummaryLayout.blocksVisible, tripInvoiceStats.length]);

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
          const lu =
            item.unit != null && String(item.unit).trim() !== ''
              ? String(item.unit).trim()
              : item.product?.unit ?? null;
          productMap.set(key, {
            product_id: item.product_id,
            product: item.product,
            line_unit: lu,
            totalQuantity: 0,
            totalPickedUp: 0,
            is_bonus: !!item.is_bonus,
            breakdown: [],
          });
        }
        const summary = productMap.get(key)!;
        const qty = Number(item.quantity) || 0;
        const pickedUp = Math.floor(Number(item.quantity_picked_up_at_store) || 0);
        if (!summary.line_unit) {
          const lu =
            item.unit != null && String(item.unit).trim() !== ''
              ? String(item.unit).trim()
              : item.product?.unit ?? null;
          if (lu) summary.line_unit = lu;
        }
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

  /** ร้านที่โผล่ในหลายทริปในวันเดียวกัน — ออกบิลควรใช้มุมมองรายร้านจะชัดเจนกว่า */
  const splitAcrossTripsInfo = useMemo(() => {
    const storeIds = new Set<string>();
    for (const e of mergedStores) {
      if (e.trips.length > 1) storeIds.add(e.store_id);
    }
    return { count: storeIds.size, storeIds };
  }, [mergedStores]);

  useEffect(() => {
    if (!mergedStores.length) {
      setOrderQtyByStoreId(new Map());
      setOrderInvoiceLinesByStoreId(new Map());
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const results = await Promise.all(
          mergedStores.map(async (e) => {
            const tripIds = e.trips.map((t) => t.trip_id);
            const bundle = await ordersService.getInvoiceBundleForStoreAcrossTrips(tripIds, e.store_id);
            return [e.store_id, bundle] as const;
          }),
        );
        if (!cancelled) {
          setOrderQtyByStoreId(new Map(results.map(([id, b]) => [id, b.qtyMap])));
          setOrderInvoiceLinesByStoreId(new Map(results.map(([id, b]) => [id, b.lines])));
        }
      } catch {
        if (!cancelled) {
          setOrderQtyByStoreId(new Map());
          setOrderInvoiceLinesByStoreId(new Map());
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mergedStores]);

  useEffect(() => {
    if (!myTrips.length) {
      setOrderQtyByTripStoreKey(new Map());
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const pairs: { key: string; tripId: string; storeId: string }[] = [];
        for (const trip of myTrips) {
          for (const store of trip.stores || []) {
            pairs.push({
              key: `${trip.id}__${store.store_id}`,
              tripId: trip.id,
              storeId: store.store_id,
            });
          }
        }
        const results = await Promise.all(
          pairs.map(async ({ key, tripId, storeId }) => {
            const m = await ordersService.getOrderQuantitiesByProductForStoreInTrip(tripId, storeId);
            return [key, m] as const;
          }),
        );
        if (!cancelled) setOrderQtyByTripStoreKey(new Map(results));
      } catch {
        if (!cancelled) setOrderQtyByTripStoreKey(new Map());
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [myTrips]);

  const openByStoreInvoiceView = useCallback(() => setViewMode('by_store'), []);

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

  /** มุมมองแบบรายร้าน: เปิด modal สรุปตามร้านเสมอ (ครบบรรทัดออเดอร์จาก order_items — ไม่จำกัดแค่ของในทริป) */
  const handleOpenInvoiceChecklistFromMerged = useCallback((entry: MergedStoreEntry) => {
    setSelectedMergedStore(entry);
  }, []);

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
        <div className="space-y-6 min-w-0 overflow-x-hidden">
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

          {viewMode === 'by_trip' && splitAcrossTripsInfo.count > 0 && (
            <div
              className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl border border-amber-200 dark:border-amber-800/80 bg-amber-50 dark:bg-amber-950/40 px-4 py-3 text-sm text-amber-900 dark:text-amber-100"
              role="status"
            >
              <div className="flex items-start gap-3 min-w-0">
                <Info className="w-5 h-5 flex-shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" aria-hidden />
                <div className="min-w-0">
                  <p className="font-semibold text-amber-950 dark:text-amber-50">
                    แนะนำ: สลับไปดูแบบรายร้านเมื่อมีการแบ่งส่งหลายทริป
                  </p>
                  <p className="mt-1 text-amber-900/90 dark:text-amber-200/90 leading-relaxed">
                    วันนี้มี {splitAcrossTripsInfo.count} ร้านที่สินค้าแบ่งไปกับมากกว่าหนึ่งทริป — มุมมองแบบทริปจะเห็นทีละคันอาจทำให้เช็คยอดออกบิลสับสนได้
                    การดูแบบรายร้านจะรวมยอดต่อสินค้าและเช็คออกบิลครั้งเดียวต่อร้านตามที่ออกใบแจ้งหนี้จริง
                  </p>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                className="flex-shrink-0 border-amber-300 dark:border-amber-700 text-amber-950 dark:text-amber-50 bg-white/80 dark:bg-charcoal-900 hover:bg-amber-100 dark:hover:bg-amber-900/30"
                onClick={openByStoreInvoiceView}
              >
                <MapPin className="w-4 h-4 mr-1.5 inline" />
                ไปดูแบบรายร้าน
              </Button>
            </div>
          )}

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

          {/* Trip Summary Index - เลื่อนแนวนอน คลิกเพื่อ scroll ไปที่ทริป (แสดงสูงสุด 5 บล็อค) */}
          {myTrips.length > 0 && viewMode === 'by_trip' && (
            <Card className="mb-6 min-w-0 overflow-hidden">
              <div className="p-4 pb-3 min-w-0">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    <Truck className="w-4 h-4 text-blue-500" />
                    สรุปทริปวันนี้ ({myTrips.length} ทริป)
                  </h3>
                  {tripInvoiceStats.length > tripSummaryLayout.blocksVisible && (
                    <span className="text-[11px] text-gray-400 dark:text-gray-500 flex items-center gap-1">
                      เลื่อนเพื่อดูเพิ่ม <ChevronRight className="w-3 h-3" />
                    </span>
                  )}
                </div>

                {/* Horizontal viewport - คำนวณขนาดบล็อคให้พอดีกับหน้าจอ (สูงสุด 5 บล็อค) */}
                <div ref={tripSummaryContainerRef} className="relative w-full min-w-0 overflow-hidden">
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
                      transform: `translateX(-${tripSummaryIndex * tripSummaryLayout.stepSize}px)`,
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
                          style={{ width: tripSummaryLayout.blockWidth }}
                          className={`flex-none flex-shrink-0 p-3 rounded-lg border-2 transition-all text-left hover:shadow-md hover:scale-[1.02] active:scale-[0.98] cursor-pointer ${stat.isAllIssued
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
                  {tripInvoiceStats.length > 1 && tripSummaryIndex < Math.max(0, tripInvoiceStats.length - tripSummaryLayout.blocksVisible) && (
                    <button
                      onClick={() => {
                        const maxIndex = Math.max(0, tripInvoiceStats.length - tripSummaryLayout.blocksVisible);
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
                    storeIdsSplitAcrossTrips={splitAcrossTripsInfo.storeIds}
                    onSuggestByStoreInvoiceView={openByStoreInvoiceView}
                    orderQtyByTripStore={orderQtyByTripStoreKey}
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
                    onOpenInvoiceChecklist={handleOpenInvoiceChecklistFromMerged}
                    onToggleInvoiceStatus={handleToggleInvoiceStatus}
                    orderQtyMap={orderQtyByStoreId.get(entry.store_id)}
                    orderInvoiceLines={orderInvoiceLinesByStoreId.get(entry.store_id)}
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

                {/* Items List with Checklist Helper — รวมแถวต่อสินค้า (ใบแจ้งหนี้) แม้ในทริปเดียวจะแบ่งหลายบรรทัด */}
                {singleTripInvoiceRows.length > 0 ? (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold text-gray-900 dark:text-white">
                        รายการสินค้า ({singleTripInvoiceRows.length} รายการ)
                      </h3>
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-gray-600 dark:text-gray-400">💡</span>
                        <span className="text-gray-600 dark:text-gray-400">
                          ใช้รายการนี้เป็นคู่มือในการคีย์บิลในระบบอื่น
                        </span>
                      </div>
                    </div>

                    {/* Summary: สั่งทั้งหมด + รับที่ร้าน (จาก order_items จริง) */}
                    {orderQuantitiesByProduct.size > 0 && (
                      <div className="mb-4 p-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg">
                        <div className="text-sm font-medium text-emerald-800 dark:text-emerald-200 mb-1">
                          สรุปยอดออเดอร์ (จากข้อมูลออเดอร์จริง)
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-emerald-700 dark:text-emerald-300">
                          <span>
                            สั่งทั้งหมด{' '}
                            {new Intl.NumberFormat('th-TH').format(
                              (() => {
                                let total = 0;
                                for (const v of orderQuantitiesByProduct.values()) {
                                  total += v.ordered;
                                }
                                return total;
                              })()
                            )}{' '}
                            ชิ้น
                          </span>
                          <span>
                            จัดส่งแล้ว (สะสม){' '}
                            {new Intl.NumberFormat('th-TH').format(
                              (() => {
                                let total = 0;
                                for (const v of orderQuantitiesByProduct.values()) {
                                  total += v.delivered;
                                }
                                return total;
                              })()
                            )}{' '}
                            ชิ้น
                          </span>
                          <span>
                            รับที่ร้านแล้ว{' '}
                            {new Intl.NumberFormat('th-TH').format(
                              (() => {
                                let total = 0;
                                for (const v of orderQuantitiesByProduct.values()) {
                                  total += v.pickedUp;
                                }
                                return total;
                              })()
                            )}{' '}
                            ชิ้น
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Summary Card with Progress */}
                    <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                      <div className="flex items-center justify-between text-sm mb-2">
                        <span className="text-blue-800 dark:text-blue-200 font-medium">
                          📋 สรุปรายการสินค้า
                        </span>
                        <span className="text-blue-700 dark:text-blue-300">
                          รวม {singleTripInvoiceRows.length} รายการ
                        </span>
                      </div>
                      {(() => {
                        const totalItems = singleTripInvoiceRows.length;
                        const checkedCount = singleTripInvoiceRows.filter((row) => {
                          const itemKey = `${selectedStoreDetail.tripId}-${selectedStoreDetail.store.store_id}-${row.rowKey}`;
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
                            <th className="text-right py-3 px-3 text-sm font-semibold text-gray-700 dark:text-gray-300">
                              ส่งในทริปนี้
                            </th>
                            <th className="text-right py-3 px-3 text-sm font-semibold text-gray-700 dark:text-gray-300">จำนวนสั่ง</th>
                            <th className="text-right py-3 px-3 text-sm font-semibold text-blue-600 dark:text-blue-400">
                              จัดส่งแล้ว (สะสม)
                            </th>
                            <th className="text-right py-3 px-3 text-sm font-semibold text-amber-600 dark:text-amber-400">รับที่ร้านแล้ว</th>
                            <th className="text-right py-3 px-3 text-sm font-semibold text-gray-700 dark:text-gray-300">หน่วย</th>
                            {singleTripInvoiceRows.some((r) => r.product?.base_price) ? (
                              <th className="text-right py-3 px-3 text-sm font-semibold text-gray-700 dark:text-gray-300">ราคาต่อหน่วย</th>
                            ) : null}
                          </tr>
                        </thead>
                        <tbody>
                          {singleTripInvoiceRows.map((row, index) => {
                            const itemKey = `${selectedStoreDetail.tripId}-${selectedStoreDetail.store.store_id}-${row.rowKey}`;
                            const isChecked = checkedItems.has(itemKey);
                            const agg = aggregateOrderQtyForProduct(
                              orderQuantitiesByProduct,
                              row.product_id,
                              row.is_bonus,
                            );
                            const unit = row.line_unit || row.product?.unit || 'ชิ้น';
                            const ordered =
                              orderQuantitiesByProduct.size > 0
                                ? agg.ordered
                                : Math.floor(row.tripQuantity) + Math.floor(row.tripPickedUp);
                            const pickedUp =
                              orderQuantitiesByProduct.size > 0 ? agg.pickedUp : Math.floor(row.tripPickedUp);
                            const delivered =
                              orderQuantitiesByProduct.size > 0 ? agg.delivered : null;

                            return (
                              <tr
                                key={row.rowKey}
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
                                      {row.product?.product_code || 'ไม่ระบุ'}
                                    </Badge>
                                    {row.is_bonus && (
                                      <Badge variant="success" className="text-xs">
                                        ของแถม
                                      </Badge>
                                    )}
                                  </div>
                                </td>
                                <td className="py-3 px-3 text-sm font-medium text-gray-900 dark:text-white">
                                  {row.product?.product_name || 'ไม่ระบุชื่อ'}
                                </td>
                                <td className="py-3 px-3 text-sm text-gray-600 dark:text-gray-400">
                                  {row.product?.category || '-'}
                                </td>
                                <td className="py-3 px-3 text-sm text-right font-medium text-gray-800 dark:text-gray-200">
                                  {Math.floor(row.tripQuantity).toLocaleString('th-TH', { maximumFractionDigits: 0 })}
                                </td>
                                <td className="py-3 px-3 text-sm text-right font-semibold text-gray-900 dark:text-white">
                                  {ordered.toLocaleString('th-TH', { maximumFractionDigits: 0 })}
                                </td>
                                <td className="py-3 px-3 text-sm text-right font-medium text-blue-700 dark:text-blue-300">
                                  {delivered != null
                                    ? delivered.toLocaleString('th-TH', { maximumFractionDigits: 0 })
                                    : '—'}
                                </td>
                                <td className="py-3 px-3 text-sm text-right">
                                  {pickedUp > 0 ? (
                                    <span className="text-amber-600 dark:text-amber-400 font-medium" title="ลูกค้ามารับไปที่หน้าร้านแล้ว">
                                      {pickedUp.toLocaleString('th-TH', { maximumFractionDigits: 0 })} {unit}
                                    </span>
                                  ) : (
                                    <span className="text-gray-400 dark:text-gray-500">—</span>
                                  )}
                                </td>
                                <td className="py-3 px-3 text-sm text-right text-gray-600 dark:text-gray-400">
                                  {unit}
                                </td>
                                {singleTripInvoiceRows.some((r) => r.product?.base_price) ? (
                                  <td className="py-3 px-3 text-sm text-right text-gray-600 dark:text-gray-400">
                                    {row.product?.base_price != null
                                      ? new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' }).format(
                                        row.product.base_price,
                                      )
                                      : '—'}
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
                        <strong>💡 คำแนะนำ:</strong> แต่ละแถว = สินค้าหนึ่งรายการต่อใบแจ้งหนี้ (ถ้าแบ่งหลายบรรทัดในทริปจะถูกรวมให้แล้ว) &quot;ส่งในทริปนี้&quot; = จำนวนที่บรรทึกในทริปนี้เท่านั้น &quot;จำนวนสั่ง&quot; = ยอดที่ลูกค้าสั่งทั้งหมดในออเดอร์ &quot;รับที่ร้านแล้ว&quot; = จำนวนที่ลูกค้ามารับไปที่หน้าร้าน — ใช้เป็นคู่มือคีย์บิลในระบบอื่น (จำนวนเต็มเท่านั้น) ตรวจสอบให้ครบทุกรายการก่อนกด &quot;ยืนยันการออกบิล&quot;
                      </p>
                    </div>

                    {/* Confirm Button */}
                    <div className="mt-6 pt-4 border-t border-gray-200 dark:border-slate-700">
                      {(() => {
                        const totalItems = singleTripInvoiceRows.length;
                        const checkedCount = singleTripInvoiceRows.filter((row) => {
                          const itemKey = `${selectedStoreDetail.tripId}-${selectedStoreDetail.store.store_id}-${row.rowKey}`;
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
              onClose={() => {
                setSelectedMergedStore(null);
                setMergedCheckedItems(new Set());
              }}
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

                {/* Items Table — ยอดรวม + เช็ครายการ (มุมมองรายร้าน) */}
                {(() => {
                  const ms = selectedMergedStore;
                  const invLinesModal = orderInvoiceLinesByStoreId.get(ms.store_id) ?? [];
                  const hasInvoiceRows =
                    invLinesModal.length > 0 || ms.summaryItems.length > 0;
                  return hasInvoiceRows;
                })() ? (
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white mb-3">
                      {(() => {
                        const inv = orderInvoiceLinesByStoreId.get(selectedMergedStore.store_id) ?? [];
                        const n =
                          inv.length > 0 ? inv.length : selectedMergedStore.summaryItems.length;
                        return (
                          <>
                            รายการสินค้า ({n} รายการ{inv.length > 0 ? ' ตามออเดอร์ทั้งหมด' : ''})
                          </>
                        );
                      })()}
                    </h3>
                    {(() => {
                      const ms = selectedMergedStore;
                      const mergedStoreId = ms.store_id;
                      const invLinesModal = orderInvoiceLinesByStoreId.get(mergedStoreId) ?? [];
                      const mergedTotal =
                        invLinesModal.length > 0 ? invLinesModal.length : ms.summaryItems.length;
                      const mergedCheckedCount =
                        invLinesModal.length > 0
                          ? invLinesModal.filter((l) => mergedCheckedItems.has(l.rowKey)).length
                          : ms.summaryItems.filter((si) =>
                              mergedCheckedItems.has(getMergedSummaryCheckKey(si)),
                            ).length;
                      const allMergedChecked = mergedTotal > 0 && mergedCheckedCount === mergedTotal;
                      const allMergedTripsIssued = ms.trips.every(
                        (t) => (t.invoice_status || 'pending') === 'issued',
                      );
                      const mergedModalUpdating = ms.trips.some((t) =>
                        updatingStatus.has(`${t.trip_id}-${mergedStoreId}`),
                      );
                      const mergedProgress =
                        mergedTotal > 0 ? (mergedCheckedCount / mergedTotal) * 100 : 0;
                      const mergedOrderMap = orderQtyByStoreId.get(mergedStoreId);

                      return (
                        <>
                          {mergedOrderMap && mergedOrderMap.size > 0 && (
                            <div className="mb-4 p-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg">
                              <div className="text-sm font-medium text-emerald-800 dark:text-emerald-200 mb-1">
                                สรุปตามออเดอร์ — ใช้ออกใบแจ้งหนี้ / ความคืบหน้าจัดส่ง
                              </div>
                              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-emerald-700 dark:text-emerald-300">
                                <span>
                                  สั่งทั้งหมด{' '}
                                  {(() => {
                                    let t = 0;
                                    for (const v of mergedOrderMap.values()) t += v.ordered;
                                    return new Intl.NumberFormat('th-TH').format(t);
                                  })()}{' '}
                                  (หน่วยตามบรรทัดออเดอร์)
                                </span>
                                <span>
                                  จัดส่งแล้ว{' '}
                                  {(() => {
                                    let t = 0;
                                    for (const v of mergedOrderMap.values()) t += v.delivered;
                                    return new Intl.NumberFormat('th-TH').format(t);
                                  })()}
                                </span>
                              </div>
                            </div>
                          )}
                          <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                            <div className="flex items-center justify-between text-sm mb-2">
                              <span className="text-blue-800 dark:text-blue-200 font-medium">
                                สรุปการเช็ค (ยอดรวมต่อสินค้า — ทุกคันในร้านนี้)
                              </span>
                              <span className="text-blue-700 dark:text-blue-300">
                                คีย์แล้ว {mergedCheckedCount} / {mergedTotal} รายการ
                              </span>
                            </div>
                            <div className="w-full bg-gray-200 dark:bg-slate-700 rounded-full h-2">
                              <div
                                className={`h-2 rounded-full transition-all duration-300 ${
                                  mergedProgress === 100
                                    ? 'bg-green-500'
                                    : mergedProgress > 0
                                      ? 'bg-yellow-500'
                                      : 'bg-gray-300 dark:bg-slate-600'
                                }`}
                                style={{ width: `${mergedProgress}%` }}
                              />
                            </div>
                          </div>

                          <div className="overflow-x-auto">
                            <table className="w-full border-collapse">
                              <thead>
                                <tr className="border-b-2 border-gray-300 dark:border-slate-600 bg-gray-50 dark:bg-slate-800">
                                  <th className="text-center py-3 px-3 text-sm font-semibold text-gray-700 dark:text-gray-300 w-12">
                                    ✓
                                  </th>
                                  <th className="text-center py-3 px-3 text-sm font-semibold text-gray-700 dark:text-gray-300 w-16">
                                    ลำดับ
                                  </th>
                                  <th className="text-left py-3 px-3 text-sm font-semibold text-gray-700 dark:text-gray-300">
                                    รหัสสินค้า
                                  </th>
                                  <th className="text-left py-3 px-3 text-sm font-semibold text-gray-700 dark:text-gray-300">
                                    ชื่อสินค้า
                                  </th>
                                  <th className="text-right py-3 px-3 text-sm font-semibold text-gray-700 dark:text-gray-300">
                                    จำนวนสั่ง (ออเดอร์)
                                  </th>
                                  <th className="text-right py-3 px-3 text-sm font-semibold text-blue-600 dark:text-blue-400">
                                    จัดส่งแล้ว (สะสม)
                                  </th>
                                  <th className="text-right py-3 px-3 text-sm font-semibold text-amber-600 dark:text-amber-400">
                                    รับที่ร้านแล้ว
                                  </th>
                                  <th className="text-right py-3 px-3 text-sm font-semibold text-gray-700 dark:text-gray-300">
                                    หน่วย
                                  </th>
                                  {ms.trips.length > 1 && (
                                    <th className="text-left py-3 px-3 text-sm font-semibold text-gray-700 dark:text-gray-300">
                                      แบ่งตามรถ
                                    </th>
                                  )}
                                </tr>
                              </thead>
                              <tbody>
                                {(invLinesModal.length > 0 ? invLinesModal : ms.summaryItems).map((rowOrSi, index) => {
                                  const invLine =
                                    invLinesModal.length > 0
                                      ? (rowOrSi as OrderInvoiceDisplayLine)
                                      : null;
                                  const si =
                                    invLinesModal.length > 0
                                      ? ms.summaryItems.find(
                                          (s) =>
                                            s.product_id === invLine!.product_id &&
                                            s.is_bonus === invLine!.is_bonus,
                                        )
                                      : (rowOrSi as SummaryItem);
                                  const rowKey =
                                    invLine?.rowKey ?? getMergedSummaryCheckKey(si as SummaryItem);
                                  const isRowChecked = mergedCheckedItems.has(rowKey);
                                  const rowAgg =
                                    !invLine && mergedOrderMap?.size && si
                                      ? aggregateOrderQtyForProduct(
                                          mergedOrderMap,
                                          (si as SummaryItem).product_id,
                                          (si as SummaryItem).is_bonus,
                                        )
                                      : null;
                                  const billQty = invLine
                                    ? invLine.ordered
                                    : rowAgg && rowAgg.ordered > 0
                                      ? rowAgg.ordered
                                      : (si as SummaryItem).totalQuantity;
                                  const pickedDisplay = invLine
                                    ? invLine.pickedUp
                                    : rowAgg && rowAgg.pickedUp > 0
                                      ? rowAgg.pickedUp
                                      : (si as SummaryItem).totalPickedUp;
                                  const deliveredDisp = invLine
                                    ? invLine.delivered
                                    : rowAgg != null
                                      ? rowAgg.delivered
                                      : null;
                                  const unitCol = invLine
                                    ? invLine.unit ||
                                      invLine.product?.unit ||
                                      si?.line_unit ||
                                      si?.product?.unit ||
                                      'ชิ้น'
                                    : (si as SummaryItem).line_unit ||
                                      (si as SummaryItem).product?.unit ||
                                      'ชิ้น';
                                  const productCodeDisp = invLine?.product?.product_code ?? si?.product?.product_code;
                                  const productNameDisp =
                                    invLine?.product?.product_name ?? si?.product?.product_name ?? 'ไม่ระบุชื่อ';
                                  const bonusDisp = invLine ? invLine.is_bonus : (si as SummaryItem).is_bonus;
                                  const breakdownSi = si as SummaryItem | undefined;
                                  return (
                                    <tr
                                      key={rowKey}
                                      className={`border-b border-gray-100 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800/50 ${
                                        isRowChecked ? 'bg-green-50 dark:bg-green-900/10' : ''
                                      }`}
                                    >
                                      <td className="py-3 px-3 text-center">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setMergedCheckedItems((prev) => {
                                              const next = new Set(prev);
                                              if (next.has(rowKey)) next.delete(rowKey);
                                              else next.add(rowKey);
                                              return next;
                                            });
                                          }}
                                          className={`
                                            w-6 h-6 border-2 rounded flex items-center justify-center transition-all cursor-pointer
                                            ${
                                              isRowChecked
                                                ? 'bg-green-500 border-green-600 dark:bg-green-600 dark:border-green-700'
                                                : 'bg-white dark:bg-slate-800 border-gray-300 dark:border-slate-600 hover:border-green-400 dark:hover:border-green-500'
                                            }
                                          `}
                                          title={
                                            isRowChecked
                                              ? 'คลิกเพื่อยกเลิกการเช็ค'
                                              : 'คลิกเพื่อเช็คว่าคีย์สินค้านี้แล้ว'
                                          }
                                        >
                                          {isRowChecked && <CheckCircle className="w-4 h-4 text-white" />}
                                        </button>
                                      </td>
                                      <td className="py-3 px-3 text-sm text-center text-gray-600 dark:text-gray-400 font-mono font-semibold">
                                        {index + 1}
                                      </td>
                                      <td className="py-3 px-3 text-sm">
                                        <Badge variant="info" className="text-xs font-mono">
                                          {productCodeDisp || 'ไม่ระบุ'}
                                        </Badge>
                                        {bonusDisp && (
                                          <Badge variant="success" className="text-xs ml-1">
                                            ของแถม
                                          </Badge>
                                        )}
                                      </td>
                                      <td className="py-3 px-3 text-sm font-medium text-gray-900 dark:text-white">
                                        <div>{productNameDisp}</div>
                                        {invLine && !breakdownSi && (
                                          <p className="text-[11px] text-amber-700 dark:text-amber-300 mt-1">
                                            {MSG_PRODUCT_NOT_ON_TRIP_TODAY}
                                          </p>
                                        )}
                                        {invLine && breakdownSi && (
                                          <p className="text-[11px] text-enterprise-600 dark:text-enterprise-400 mt-1">
                                            {ms.trips.length > 1
                                              ? MSG_PRODUCT_ON_TRIP_MODAL_MULTI_TRIP
                                              : MSG_PRODUCT_ON_TRIP_COMPACT}
                                          </p>
                                        )}
                                      </td>
                                      <td className="py-3 px-3 text-sm text-right font-bold text-gray-900 dark:text-white">
                                        {Math.floor(billQty).toLocaleString('th-TH', {
                                          maximumFractionDigits: 0,
                                        })}
                                      </td>
                                      <td className="py-3 px-3 text-sm text-right font-medium text-blue-700 dark:text-blue-300">
                                        {deliveredDisp != null
                                          ? deliveredDisp.toLocaleString('th-TH', {
                                              maximumFractionDigits: 0,
                                            })
                                          : '—'}
                                      </td>
                                      <td className="py-3 px-3 text-sm text-right">
                                        {pickedDisplay > 0 ? (
                                          <span className="text-amber-600 dark:text-amber-400 font-medium">
                                            {pickedDisplay.toLocaleString('th-TH', {
                                              maximumFractionDigits: 0,
                                            })}{' '}
                                            {unitCol}
                                          </span>
                                        ) : (
                                          <span className="text-gray-400 dark:text-gray-500">—</span>
                                        )}
                                      </td>
                                      <td className="py-3 px-3 text-sm text-right text-gray-600 dark:text-gray-400">
                                        {unitCol}
                                      </td>
                                      {ms.trips.length > 1 && (
                                        <td className="py-3 px-3 text-sm">
                                          <div className="flex flex-wrap gap-1.5">
                                            {(breakdownSi?.breakdown ?? []).map((b, bi) => (
                                              <span
                                                key={bi}
                                                className="inline-flex items-center gap-1 text-xs bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-400 px-2 py-0.5 rounded"
                                              >
                                                <Truck className="w-3 h-3" />
                                                {b.vehicle_plate}:{' '}
                                                {Math.floor(b.quantity || 0).toLocaleString('th-TH', {
                                                  maximumFractionDigits: 0,
                                                })}
                                                {b.pickedUp != null && b.pickedUp > 0 && (
                                                  <span className="text-amber-600 dark:text-amber-400">
                                                    {' '}
                                                    (รับที่ร้าน {b.pickedUp})
                                                  </span>
                                                )}
                                              </span>
                                            ))}
                                          </div>
                                        </td>
                                      )}
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>

                          <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                            <p className="text-xs text-yellow-800 dark:text-yellow-300">
                              <strong>คำแนะนำ:</strong> เช็คตามแถวสรุป (รวมทุกคันสำหรับร้านนี้) ก่อนกดยืนยัน — ระบบจะบันทึก
                              &quot;ออกบิลแล้ว&quot; ให้ทุกทริปที่จุดส่งร้านนี้พร้อมกัน
                            </p>
                          </div>

                          <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                            <p className="text-xs text-blue-800 dark:text-blue-300">
                              <strong>ข้อมูลสำคัญ:</strong> จำนวนเป็น<strong>จำนวนเต็ม</strong>เท่านั้น คอลัมน์
                              &quot;รับที่ร้านแล้ว&quot; ระบุจำนวนที่ลูกค้ามารับไปที่หน้าร้านแล้ว
                              {ms.trips.length > 1 && (
                                <>
                                  {' '}
                                  ควรออกเป็น <strong>บิลเดียว</strong> คอลัมน์ &quot;แบ่งตามรถ&quot; แสดงว่าสินค้าถูกส่งไปกับรถทะเบียนใดจำนวนเท่าไร
                                </>
                              )}
                            </p>
                          </div>

                          <div className="mt-6 pt-4 border-t border-gray-200 dark:border-slate-700">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                              <div className="flex-1 text-sm">
                                {!allMergedChecked && mergedTotal > 0 && !allMergedTripsIssued && (
                                  <p className="text-orange-600 dark:text-orange-400">
                                    ยังไม่ได้เช็ครายการครบ ({mergedCheckedCount} / {mergedTotal} รายการ)
                                  </p>
                                )}
                                {allMergedChecked && !allMergedTripsIssued && (
                                  <p className="text-green-600 dark:text-green-400">
                                    เช็ครายการครบแล้ว — กดยืนยันเพื่อบันทึกออกบิลทุกทริปสำหรับร้านนี้
                                  </p>
                                )}
                                {allMergedTripsIssued && (
                                  <p className="text-blue-600 dark:text-blue-400">
                                    ทุกทริปสำหรับร้านนี้ทำสถานะออกบิลแล้ว
                                  </p>
                                )}
                              </div>
                              <div className="flex flex-wrap gap-3 justify-end">
                                {allMergedTripsIssued ? (
                                  <Button
                                    variant="outline"
                                    type="button"
                                    disabled={mergedModalUpdating}
                                    onClick={async () => {
                                      try {
                                        for (const t of ms.trips) {
                                          if ((t.invoice_status || 'pending') === 'issued') {
                                            await handleToggleInvoiceStatus(
                                              t.trip_id,
                                              mergedStoreId,
                                              'issued',
                                            );
                                          }
                                        }
                                        setTimeout(() => setSelectedMergedStore(null), 800);
                                      } catch {
                                        /* useInvoiceStatus onError */
                                      }
                                    }}
                                  >
                                    {mergedModalUpdating ? (
                                      <>
                                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2" />
                                        กำลังอัปเดต...
                                      </>
                                    ) : (
                                      <>
                                        <Square className="w-4 h-4 mr-2" />
                                        ยกเลิกสถานะออกบิล (ทุกทริป)
                                      </>
                                    )}
                                  </Button>
                                ) : (
                                  <Button
                                    type="button"
                                    disabled={!allMergedChecked || mergedModalUpdating}
                                    onClick={async () => {
                                      if (!allMergedChecked) {
                                        warning('กรุณาเช็ครายการสินค้าให้ครบก่อนยืนยันการออกบิล');
                                        return;
                                      }
                                      try {
                                        for (const t of ms.trips) {
                                          const cur = t.invoice_status || 'pending';
                                          if (cur !== 'issued') {
                                            await handleToggleInvoiceStatus(
                                              t.trip_id,
                                              mergedStoreId,
                                              cur,
                                            );
                                          }
                                        }
                                        setTimeout(() => setSelectedMergedStore(null), 800);
                                      } catch {
                                        /* useInvoiceStatus onError */
                                      }
                                    }}
                                    className={
                                      allMergedChecked
                                        ? 'bg-green-600 hover:bg-green-700 dark:bg-green-600 dark:hover:bg-green-700'
                                        : 'bg-gray-300 dark:bg-gray-600 cursor-not-allowed'
                                    }
                                  >
                                    {mergedModalUpdating ? (
                                      <>
                                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                                        กำลังอัปเดต...
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
                          </div>
                        </>
                      );
                    })()}
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

