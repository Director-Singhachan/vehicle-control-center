import React, { useState, useMemo, useEffect, useCallback, memo, useRef } from 'react';
import { Package, Calendar, MapPin, DollarSign, User, Phone, Filter, X, Zap, ChevronDown, ChevronRight, Eye, Box, Edit, CheckCircle2, Clock, Layers, List, Navigation } from 'lucide-react';
import { usePendingOrders } from '../hooks/useOrders';
import { orderItemsService } from '../services/ordersService';
import { CreateTripFromOrdersView } from './CreateTripFromOrdersView';
import { DeliveryTripFormView } from './DeliveryTripFormView';
import { EditOrderView } from './EditOrderView';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { PageLayout } from '../components/ui/PageLayout';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { useToast } from '../hooks/useToast';
import { ToastContainer } from '../components/ui/Toast';
import { useAuth } from '../hooks/useAuth';
import { Building2 } from 'lucide-react';
import { getAreaGroupKey, getDistrictKey } from '../utils/parseThaiAddress';

// Memoized OrderCard component to prevent unnecessary re-renders
interface OrderCardProps {
  order: any;
  isSelected: boolean;
  isExpanded: boolean;
  orderItems: any[];
  onToggleSelection: (orderId: string) => void;
  onToggleDetails: (orderId: string) => void;
  onEdit: (orderId: string) => void;
  onUpdatePickup: (itemId: string, qty: number) => void;
  savingPickupItemId: string | null;
  pendingPickupValues: Record<string, number>;
}

const OrderCard = memo(({
  order,
  isSelected,
  isExpanded,
  orderItems,
  onToggleSelection,
  onToggleDetails,
  onEdit,
  onUpdatePickup,
  savingPickupItemId,
  pendingPickupValues,
}: OrderCardProps) => {
  // Memoize formatted dates and amounts
  const formattedOrderDate = useMemo(() => {
    return new Date(order.order_date).toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }, [order.order_date]);

  const formattedDeliveryDate = useMemo(() => {
    return order.delivery_date ? new Date(order.delivery_date).toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }) : null;
  }, [order.delivery_date]);

  const formattedAmount = useMemo(() => {
    return new Intl.NumberFormat('th-TH').format(order.total_amount);
  }, [order.total_amount]);

  const itemsTotal = useMemo(() => {
    if (!orderItems || orderItems.length === 0) return 0;
    return orderItems.reduce((sum: number, item: any) => sum + (item.quantity * (item.unit_price || 0)), 0);
  }, [orderItems]);

  // สรุปการรับที่ร้าน (แสดงเสมอถ้ามีข้อมูล)
  const pickupSummary = useMemo(() => {
    if (!orderItems || orderItems.length === 0) return null;
    const totalPickedUp = orderItems.reduce((sum: number, item: any) => sum + Number(item.quantity_picked_up_at_store ?? 0), 0);
    const totalDelivered = orderItems.reduce((sum: number, item: any) => sum + Number(item.quantity_delivered ?? 0), 0);
    const totalQty = orderItems.reduce((sum: number, item: any) => sum + Number(item.quantity), 0);
    if (totalPickedUp === 0 && totalDelivered === 0) return null;
    return { totalPickedUp, totalDelivered, totalQty };
  }, [orderItems]);

  return (
    <Card className={isSelected ? 'ring-2 ring-blue-500' : ''}>
      <div className="p-6">
        <div className="flex items-start gap-4">
          {/* Checkbox */}
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onToggleSelection(order.id)}
            className="mt-1 w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
          />

          {/* Order Details */}
          <div className="flex-1">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {order.order_number}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {formattedOrderDate}
                </p>
                {/* ✅ แสดง pickup summary ถ้ามีการรับที่ร้าน/ส่งแล้วบางส่วน */}
                {order.status === 'partial' && (
                  <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300 border border-orange-200 dark:border-orange-700">
                    ⏳ ส่งบางส่วนแล้ว
                  </span>
                )}
                {pickupSummary && pickupSummary.totalPickedUp > 0 && (
                  <span className="inline-flex items-center gap-1 mt-1 ml-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-700">
                    🏪 รับที่ร้าน {pickupSummary.totalPickedUp.toLocaleString()} ชิ้น
                  </span>
                )}
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-blue-600">
                  {formattedAmount} ฿
                </p>
                {pickupSummary && (
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                    คงเหลือ {Math.max(0, pickupSummary.totalQty - pickupSummary.totalPickedUp - pickupSummary.totalDelivered).toLocaleString()} / {pickupSummary.totalQty.toLocaleString()} ชิ้น
                  </p>
                )}
              </div>
            </div>

            {/* Customer Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div className="flex items-start gap-3">
                <User className="w-5 h-5 text-gray-400 dark:text-gray-500 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {order.customer_name}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{order.customer_code}</p>
                </div>
              </div>

              {order.customer_phone && (
                <div className="flex items-start gap-3">
                  <Phone className="w-5 h-5 text-gray-400 dark:text-gray-500 mt-0.5" />
                  <p className="text-sm text-gray-700 dark:text-gray-300">{order.customer_phone}</p>
                </div>
              )}
            </div>

            {/* Delivery Address */}
            {order.delivery_address && (
              <div className="flex items-start gap-3 mb-4">
                <MapPin className="w-5 h-5 text-gray-400 dark:text-gray-500 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-700 dark:text-gray-300">{order.delivery_address}</p>
                </div>
              </div>
            )}

            {/* Delivery Date */}
            {formattedDeliveryDate && (
              <div className="flex items-center gap-2 mb-4 p-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg">
                <Calendar className="w-5 h-5 text-orange-600 dark:text-orange-400 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-orange-900 dark:text-orange-100">
                    วันที่ลูกค้านัดส่ง
                  </p>
                  <p className="text-sm font-medium text-orange-700 dark:text-orange-300">
                    {formattedDeliveryDate}
                  </p>
                </div>
              </div>
            )}

            {/* Notes */}
            {order.notes && (
              <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-800">
                  <span className="font-medium">หมายเหตุ:</span> {order.notes}
                </p>
              </div>
            )}

            {/* Footer */}
            <div className="mt-4 flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
              <div className="text-xs text-gray-500 dark:text-gray-400">
                สร้างโดย: {order.created_by_name}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onEdit(order.id)}
                  className="flex items-center gap-1 text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                >
                  <Edit className="w-4 h-4" />
                  แก้ไข
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onToggleDetails(order.id)}
                  className="flex items-center gap-1"
                >
                  <Eye className="w-4 h-4" />
                  {isExpanded ? 'ซ่อนรายละเอียด' : 'ดูรายละเอียด'}
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4" />
                  ) : (
                    <ChevronRight className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </div>

            {/* Order Items (Expandable) */}
            {isExpanded && (
              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
                  <Package className="w-4 h-4 text-blue-600" />
                  รายการสินค้า
                </h4>
                {orderItems && orderItems.length > 0 ? (
                  <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3 overflow-x-auto">
                    <table className="w-full text-sm min-w-[600px]">
                      <thead>
                        <tr className="border-b border-gray-300 dark:border-gray-600">
                          <th className="text-left py-2 px-2 font-semibold text-gray-700 dark:text-gray-300">รหัส</th>
                          <th className="text-left py-2 px-2 font-semibold text-gray-700 dark:text-gray-300">ชื่อสินค้า</th>
                          <th className="text-right py-2 px-2 font-semibold text-gray-700 dark:text-gray-300">สั่ง</th>
                          <th className="text-right py-2 px-2 font-semibold text-orange-600 dark:text-orange-400" title="จำนวนที่ลูกค้ามารับที่ร้านแล้ว">
                            รับที่ร้าน 🏪
                          </th>
                          <th className="text-right py-2 px-2 font-semibold text-green-600 dark:text-green-400" title="จำนวนที่ส่งให้ลูกค้าแล้ว">
                            ส่งแล้ว ✅
                          </th>
                          <th className="text-right py-2 px-2 font-semibold text-blue-600 dark:text-blue-400">คงเหลือ</th>
                          <th className="text-left py-2 px-2 font-semibold text-gray-700 dark:text-gray-300">หน่วย</th>
                        </tr>
                      </thead>
                      <tbody>
                        {orderItems.map((item: any, idx: number) => {
                          const pickedUp = Number(item.quantity_picked_up_at_store ?? 0);
                          const delivered = Number(item.quantity_delivered ?? 0);
                          const remaining = Math.max(0, Number(item.quantity) - pickedUp - delivered);
                          const isFulfilled = remaining === 0;
                          return (
                            <tr
                              key={idx}
                              className={`border-b border-gray-200 dark:border-gray-700 last:border-0 ${isFulfilled ? 'opacity-50' : ''
                                }`}
                            >
                              <td className="py-2 px-2 text-gray-500 dark:text-gray-400">
                                {item.product?.product_code || '-'}
                              </td>
                              <td className="py-2 px-2">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className={`font-medium ${isFulfilled ? 'line-through text-gray-400' : 'text-gray-900 dark:text-gray-100'
                                    }`}>
                                    {item.product?.product_name || 'ไม่ระบุ'}
                                  </span>
                                  {item.is_bonus && (
                                    <Badge variant="success" className="text-xs">ของแถม</Badge>
                                  )}
                                  {isFulfilled && (
                                    <span className="inline-flex items-center gap-1 text-xs text-green-600 dark:text-green-400 font-medium">
                                      <CheckCircle2 className="w-3 h-3" /> ครบแล้ว
                                    </span>
                                  )}
                                </div>
                              </td>
                              {/* สั่ง */}
                              <td className="py-2 px-2 text-right font-semibold text-gray-700 dark:text-gray-300">
                                {Number(item.quantity).toLocaleString()}
                              </td>
                              {/* รับที่ร้าน — editable */}
                              <td className="py-2 px-2 text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <input
                                    type="number"
                                    min={0}
                                    max={Number(item.quantity)}
                                    step={1}
                                    value={pendingPickupValues[item.id] !== undefined ? pendingPickupValues[item.id] : pickedUp}
                                    disabled={savingPickupItemId === item.id}
                                    onChange={(e) => {
                                      const raw = Number(e.target.value);
                                      const val = Math.min(
                                        Number(item.quantity),
                                        Math.max(0, Number.isFinite(raw) ? Math.floor(raw) : 0)
                                      );
                                      onUpdatePickup(item.id, val);
                                    }}
                                    className="w-16 text-right border border-orange-300 dark:border-orange-600 rounded px-1 py-0.5 text-sm focus:ring-1 focus:ring-orange-400 bg-orange-50 dark:bg-orange-900/20 text-orange-800 dark:text-orange-200 disabled:opacity-50"
                                    title="จำนวนเต็มที่ลูกค้ารับไปที่หน้าร้าน — คงเหลือส่งอัตโนมัติ"
                                  />
                                  {savingPickupItemId === item.id && (
                                    <Clock className="w-3 h-3 text-orange-500 animate-spin" />
                                  )}
                                </div>
                              </td>
                              {/* ส่งแล้ว — readonly */}
                              <td className="py-2 px-2 text-right text-green-600 dark:text-green-400 font-semibold">
                                {delivered > 0 ? delivered.toLocaleString() : <span className="text-gray-300">—</span>}
                              </td>
                              {/* คงเหลือ */}
                              <td className="py-2 px-2 text-right">
                                <span className={`font-bold ${isFulfilled
                                  ? 'text-gray-400'
                                  : remaining < Number(item.quantity)
                                    ? 'text-orange-600 dark:text-orange-400'
                                    : 'text-blue-600 dark:text-blue-400'
                                  }`}>
                                  {remaining.toLocaleString()}
                                </span>
                              </td>
                              <td className="py-2 px-2 text-gray-500 dark:text-gray-400">
                                {item.product?.unit || '-'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="border-t-2 border-gray-400 dark:border-gray-500">
                          <td colSpan={2} className="py-2 px-2 text-right text-xs text-gray-500 font-medium">
                            รวม:
                          </td>
                          <td className="py-2 px-2 text-right font-bold text-gray-700 dark:text-gray-300">
                            {orderItems.reduce((s: number, i: any) => s + Number(i.quantity), 0).toLocaleString()}
                          </td>
                          <td className="py-2 px-2 text-right font-bold text-orange-600 dark:text-orange-400">
                            {orderItems.reduce((s: number, i: any) => s + Number(i.quantity_picked_up_at_store ?? 0), 0).toLocaleString()}
                          </td>
                          <td className="py-2 px-2 text-right font-bold text-green-600 dark:text-green-400">
                            {orderItems.reduce((s: number, i: any) => s + Number(i.quantity_delivered ?? 0), 0).toLocaleString()}
                          </td>
                          <td className="py-2 px-2 text-right font-bold text-blue-600 dark:text-blue-400">
                            {orderItems.reduce((s: number, i: any) => {
                              const rem = Math.max(0, Number(i.quantity) - Number(i.quantity_picked_up_at_store ?? 0) - Number(i.quantity_delivered ?? 0));
                              return s + rem;
                            }, 0).toLocaleString()}
                          </td>
                          <td />
                        </tr>
                      </tfoot>
                    </table>
                    <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
                      💡 กรอก <span className="text-orange-500 font-medium">"รับที่ร้าน"</span> เป็นจำนวนเต็มเมื่อลูกค้ามารับสินค้าที่หน้าร้าน — คงเหลือส่ง = สั่ง − รับที่ร้าน − ส่งแล้ว
                    </p>
                  </div>
                ) : (
                  <div className="flex items-center justify-center py-4">
                    <LoadingSpinner size={20} />
                    <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">กำลังโหลดรายการสินค้า...</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}, (prevProps, nextProps) => {
  // Custom comparison function for better performance
  // Only re-render if relevant props changed
  if (prevProps.order.id !== nextProps.order.id) return false;
  if (prevProps.isSelected !== nextProps.isSelected) return false;
  if (prevProps.isExpanded !== nextProps.isExpanded) return false;
  if (prevProps.savingPickupItemId !== nextProps.savingPickupItemId) return false;
  if (prevProps.orderItems.length !== nextProps.orderItems.length) return false;
  // Deep compare order items if expanded
  if (prevProps.isExpanded && nextProps.isExpanded) {
    for (let i = 0; i < prevProps.orderItems.length; i++) {
      if (prevProps.orderItems[i] !== nextProps.orderItems[i]) return false;
      // ตรวจสอบ pendingPickupValues สำหรับทุก item ที่กำลัง expanded
      const itemId = prevProps.orderItems[i]?.id;
      if (itemId) {
        const prevPending = prevProps.pendingPickupValues[itemId];
        const nextPending = nextProps.pendingPickupValues[itemId];
        if (prevPending !== nextPending) return false;
      }
    }
  }
  return true; // Props are equal, skip re-render
});

OrderCard.displayName = 'OrderCard';

const TRIP_DELETED_EVENT = 'trip-deleted';

export function PendingOrdersView() {
  const { orders, loading, error, refetch } = usePendingOrders();
  const { toasts, warning, dismissToast } = useToast();
  const { profile } = useAuth(); // For default branch

  // Refetch เมื่อมีการลบทริป (ออเดอร์จะกลับมาอยู่รอจัดทริปอีกครั้ง)
  useEffect(() => {
    const handleTripDeleted = () => refetch();
    window.addEventListener(TRIP_DELETED_EVENT, handleTripDeleted);
    return () => window.removeEventListener(TRIP_DELETED_EVENT, handleTripDeleted);
  }, [refetch]);

  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [branchFilter, setBranchFilter] = useState<string>(() => {
    // High-level roles or HQ users can see everything
    const isHighLevel = profile?.role === 'admin' || profile?.role === 'manager' || profile?.role === 'inspector' || profile?.role === 'executive';
    if (isHighLevel || profile?.branch === 'HQ') {
      return 'ALL';
    }
    // SD regular users are restricted to SD
    return profile?.branch || 'ALL';
  });
  const [showCreateTrip, setShowCreateTrip] = useState(false);
  const [showQuickCreate, setShowQuickCreate] = useState(false);
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
  const [orderItems, setOrderItems] = useState<Map<string, any[]>>(new Map());
  const [showProductsSummaryModal, setShowProductsSummaryModal] = useState(false);
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [savingPickupItemId, setSavingPickupItemId] = useState<string | null>(null);
  // ค่าที่กำลังพิมพ์ (แสดงทันที, ก่อน debounce)
  const [pendingPickupValues, setPendingPickupValues] = useState<Record<string, number>>({});
  const pickupDebounceRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  // จัดกลุ่มตามพื้นที่ (ตำบล/อำเภอ)
  const [groupByArea, setGroupByArea] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [districtFilter, setDistrictFilter] = useState<string>('ALL');
  const [subDistrictFilter, setSubDistrictFilter] = useState<string>('ALL');

  // อัปเดต quantity_picked_up_at_store — debounce 800ms
  const handleUpdatePickup = useCallback((itemId: string, qty: number) => {
    // 1. แสดงค่าใหม่ทันที (ไม่มี spinner)
    setPendingPickupValues(prev => ({ ...prev, [itemId]: qty }));

    // 2. ถ้ากำลังมี API call อยู่ (spinner ค้าง) ให้เคลียร์ทันทีเพราะ user กำลังพิมพ์ใหม่
    setSavingPickupItemId(prev => prev === itemId ? null : prev);

    // 3. ยกเลิก timer เดิม (ถ้ายังพิมพ์ไม่หยุด)
    if (pickupDebounceRef.current[itemId]) {
      clearTimeout(pickupDebounceRef.current[itemId]);
    }

    // 4. ตั้ง timer ใหม่ — ส่ง API หลังหยุดพิมพ์ 800ms
    pickupDebounceRef.current[itemId] = setTimeout(async () => {
      // อัปเดต orderItems map (optimistic update ก่อน API call)
      setOrderItems(prev => {
        const newMap = new Map(prev);
        newMap.forEach((items: any[], orderId) => {
          const updated = items.map((item: any) =>
            item.id === itemId
              ? { ...item, quantity_picked_up_at_store: qty }
              : item
          );
          newMap.set(orderId, updated);
        });
        return newMap;
      });

      setSavingPickupItemId(itemId); // แสดง spinner เฉพาะตอน API กำลังทำงาน
      try {
        await orderItemsService.updatePickedUpAtStore(itemId, qty);
      } catch (err) {
        console.error('[PendingOrdersView] updatePickedUpAtStore error:', err);
        refetch(); // revert on error
      } finally {
        setSavingPickupItemId(null);
        // ลบออกจาก pending เมื่อ save แล้ว (แสดงค่าจาก DB แทน)
        setPendingPickupValues(prev => {
          const next = { ...prev };
          delete next[itemId];
          return next;
        });
      }
    }, 800);
  }, [refetch]);

  // Filter orders
  const filteredOrders = useMemo(() => {
    if (!orders) return [];

    return orders.filter((order: any) => {
      const matchesSearch = !searchQuery ||
        order.customer_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        order.customer_code?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        order.order_number?.toLowerCase().includes(searchQuery.toLowerCase());

      // กรอกวันที่ใน filter แล้วให้กรองตามวันที่นัดส่ง ถ้ามี
      const matchesDate = !dateFilter || order.delivery_date === dateFilter;

      // Filter by branch
      const matchesBranch = !branchFilter || branchFilter === 'ALL' ||
        (order.branch && order.branch === branchFilter);

      return matchesSearch && matchesDate && matchesBranch;
    });
  }, [orders, searchQuery, dateFilter, branchFilter]);

  // Toggle order selection - use useCallback to prevent re-renders
  const toggleOrderSelection = useCallback((orderId: string) => {
    setSelectedOrders(prev => {
      const newSelection = new Set(prev);
      if (newSelection.has(orderId)) {
        newSelection.delete(orderId);
      } else {
        newSelection.add(orderId);
      }
      return newSelection;
    });
  }, []);

  // Select all filtered orders - use useCallback
  const selectAll = useCallback(() => {
    const allIds = new Set(filteredOrders.map((o: any) => o.id));
    setSelectedOrders(allIds);
  }, [filteredOrders]);

  // Clear selection - use useCallback
  const clearSelection = useCallback(() => {
    setSelectedOrders(new Set());
  }, []);

  // Calculate total for selected orders
  const selectedTotal = useMemo(() => {
    return filteredOrders
      .filter((order: any) => selectedOrders.has(order.id))
      .reduce((sum: number, order: any) => sum + (order.total_amount || 0), 0);
  }, [filteredOrders, selectedOrders]);

  // Get selected order objects
  const selectedOrderObjects = useMemo(() => {
    return filteredOrders.filter((order: any) => selectedOrders.has(order.id));
  }, [filteredOrders, selectedOrders]);

  // Fetch order items for selected orders
  useEffect(() => {
    const fetchOrderItems = async () => {
      const itemsMap = new Map(orderItems);

      for (const orderId of Array.from(selectedOrders)) {
        if (!itemsMap.has(orderId)) {
          try {
            const items = await orderItemsService.getByOrderId(orderId as string);
            itemsMap.set(orderId, items || []);
          } catch (error) {
            console.error(`Failed to fetch items for order ${orderId}:`, error);
            itemsMap.set(orderId, []);
          }
        }
      }

      setOrderItems(itemsMap);
    };

    if (selectedOrders.size > 0) {
      fetchOrderItems();
    }
  }, [selectedOrders]);

  // Calculate aggregated products from selected orders
  const aggregatedProducts = useMemo(() => {
    const productMap = new Map<string, {
      product_id: string;
      product_name: string;
      product_code: string;
      unit: string;
      total_quantity: number;
    }>();

    selectedOrderObjects.forEach((order) => {
      const items = orderItems.get(order.id) || [];
      items.forEach((item: any) => {
        const existing = productMap.get(item.product_id);
        if (existing) {
          existing.total_quantity += item.quantity;
        } else {
          productMap.set(item.product_id, {
            product_id: item.product_id,
            product_name: item.product?.product_name || 'ไม่ระบุ',
            product_code: item.product?.product_code || '',
            unit: item.product?.unit || 'หน่วย',
            total_quantity: item.quantity,
          });
        }
      });
    });

    return Array.from(productMap.values()).sort((a, b) =>
      a.product_name.localeCompare(b.product_name, 'th')
    );
  }, [selectedOrderObjects, orderItems]);

  // Memoize aggregated products total quantity
  const aggregatedProductsTotal = useMemo(() => {
    return aggregatedProducts.reduce((sum, p) => sum + p.total_quantity, 0);
  }, [aggregatedProducts]);

  // Memoize filtered orders total amount
  const filteredOrdersTotal = useMemo(() => {
    return filteredOrders.reduce((sum: number, o: any) => sum + (o.total_amount || 0), 0);
  }, [filteredOrders]);

  // รวบรวมรายชื่ออำเภอ + จำนวนออเดอร์ (ใช้กับ chip filter)
  const availableDistricts = useMemo(() => {
    const map = new Map<string, { count: number; total: number }>();
    filteredOrders.forEach((order: any) => {
      const address = order.delivery_address || order.store_address || '';
      const dk = getDistrictKey(address);
      const existing = map.get(dk) || { count: 0, total: 0 };
      existing.count++;
      existing.total += (order.total_amount || 0);
      map.set(dk, existing);
    });
    return Array.from(map.entries())
      .map(([key, val]) => ({ key, ...val }))
      .sort((a, b) => {
        if (a.key === 'ไม่ระบุอำเภอ') return 1;
        if (b.key === 'ไม่ระบุอำเภอ') return -1;
        return b.count - a.count;
      });
  }, [filteredOrders]);

  // รวบรวมรายชื่อตำบลภายในอำเภอที่เลือก (ใช้กับ chip filter ชั้น 2)
  const availableSubDistricts = useMemo(() => {
    if (districtFilter === 'ALL') return [];
    const map = new Map<string, { count: number; total: number }>();
    filteredOrders.forEach((order: any) => {
      const address = order.delivery_address || order.store_address || '';
      const dk = getDistrictKey(address);
      if (dk !== districtFilter) return;
      const areaKey = getAreaGroupKey(address);
      const existing = map.get(areaKey) || { count: 0, total: 0 };
      existing.count++;
      existing.total += (order.total_amount || 0);
      map.set(areaKey, existing);
    });
    return Array.from(map.entries())
      .map(([key, val]) => ({ key, ...val }))
      .sort((a, b) => {
        if (a.key.includes('ไม่ระบุ')) return 1;
        if (b.key.includes('ไม่ระบุ')) return -1;
        return b.count - a.count;
      });
  }, [filteredOrders, districtFilter]);

  // จัดกลุ่มออเดอร์ตาม อำเภอ > ตำบล
  const groupedOrders = useMemo(() => {
    if (!groupByArea) return null;

    // Source orders — apply districtFilter + subDistrictFilter
    let sourceOrders = filteredOrders;
    if (districtFilter !== 'ALL') {
      sourceOrders = sourceOrders.filter((order: any) => {
        const address = order.delivery_address || order.store_address || '';
        return getDistrictKey(address) === districtFilter;
      });
    }
    if (subDistrictFilter !== 'ALL') {
      sourceOrders = sourceOrders.filter((order: any) => {
        const address = order.delivery_address || order.store_address || '';
        return getAreaGroupKey(address) === subDistrictFilter;
      });
    }

    // Group by district first, then by area (district + sub-district)
    const districtMap = new Map<string, {
      districtKey: string;
      areas: Map<string, any[]>;
      totalOrders: number;
    }>();

    sourceOrders.forEach((order: any) => {
      const address = order.delivery_address || order.store_address || '';
      const districtKey = getDistrictKey(address);
      const areaKey = getAreaGroupKey(address);

      if (!districtMap.has(districtKey)) {
        districtMap.set(districtKey, {
          districtKey,
          areas: new Map(),
          totalOrders: 0,
        });
      }

      const district = districtMap.get(districtKey)!;
      if (!district.areas.has(areaKey)) {
        district.areas.set(areaKey, []);
      }
      district.areas.get(areaKey)!.push(order);
      district.totalOrders++;
    });

    // Sort: ไม่ระบุอำเภอ ไว้สุดท้าย, เรียง district ที่มีออเดอร์มากที่สุด
    return Array.from(districtMap.values()).sort((a, b) => {
      if (a.districtKey === 'ไม่ระบุอำเภอ') return 1;
      if (b.districtKey === 'ไม่ระบุอำเภอ') return -1;
      return b.totalOrders - a.totalOrders;
    });
  }, [filteredOrders, groupByArea, districtFilter, subDistrictFilter]);

  // Toggle group collapse
  const toggleGroupCollapse = useCallback((groupKey: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupKey)) {
        next.delete(groupKey);
      } else {
        next.add(groupKey);
      }
      return next;
    });
  }, []);

  // Select all orders in a group
  const selectGroupOrders = useCallback((orders: any[]) => {
    setSelectedOrders(prev => {
      const next = new Set(prev);
      const allSelected = orders.every(o => next.has(o.id));
      if (allSelected) {
        // Deselect all in group
        orders.forEach(o => next.delete(o.id));
      } else {
        // Select all in group
        orders.forEach(o => next.add(o.id));
      }
      return next;
    });
  }, []);

  // Toggle order details - use useCallback to prevent re-renders
  const toggleOrderDetails = useCallback(async (orderId: string) => {
    setExpandedOrders(prev => {
      const newExpanded = new Set(prev);
      const wasExpanded = newExpanded.has(orderId);

      if (wasExpanded) {
        newExpanded.delete(orderId);
      } else {
        newExpanded.add(orderId);
      }

      // Fetch items if not already fetched (check in callback to avoid stale closure)
      if (!wasExpanded) {
        setOrderItems(prevItems => {
          if (!prevItems.has(orderId)) {
            // Fetch asynchronously
            orderItemsService.getByOrderId(orderId).then(items => {
              setOrderItems(prev => {
                const newMap = new Map(prev);
                newMap.set(orderId, items || []);
                return newMap;
              });
            }).catch(error => {
              console.error(`Failed to fetch items for order ${orderId}:`, error);
            });
          }
          return prevItems;
        });
      }

      return newExpanded;
    });
  }, []);

  // Handle create trip
  const handleCreateTrip = () => {
    if (selectedOrders.size === 0) {
      warning('กรุณาเลือกออเดอร์อย่างน้อย 1 รายการ');
      return;
    }
    setShowCreateTrip(true);
  };

  const handleTripCreated = useCallback(() => {
    setShowCreateTrip(false);
    setSelectedOrders(new Set());
    refetch();
  }, [refetch]);

  // Memoize edit handler
  const handleEditOrder = useCallback((orderId: string) => {
    setEditingOrderId(orderId);
  }, []);

  // Show create trip view
  if (showCreateTrip) {
    return (
      <CreateTripFromOrdersView
        selectedOrders={selectedOrderObjects}
        onBack={() => setShowCreateTrip(false)}
        onSuccess={handleTripCreated}
      />
    );
  }

  // Show quick create trip view (manual/emergency)
  if (showQuickCreate) {
    return (
      <DeliveryTripFormView
        onSave={() => {
          setShowQuickCreate(false);
          refetch();
        }}
        onCancel={() => setShowQuickCreate(false)}
      />
    );
  }

  if (loading) {
    return (
      <PageLayout title="ออเดอร์ที่รอจัดทริป">
        <div className="flex items-center justify-center h-64">
          <LoadingSpinner />
        </div>
      </PageLayout>
    );
  }

  if (error) {
    return (
      <PageLayout title="ออเดอร์ที่รอจัดทริป">
        <div className="text-center text-red-600 dark:text-red-400 py-8">
          เกิดข้อผิดพลาด: {error.message}
        </div>
      </PageLayout>
    );
  }

  // ถ้ากำลังแก้ไขออเดอร์ แสดงหน้าแก้ไข
  if (editingOrderId) {
    return (
      <EditOrderView
        orderId={editingOrderId}
        onSave={() => {
          setEditingOrderId(null);
          refetch();
        }}
        onCancel={() => setEditingOrderId(null)}
      />
    );
  }

  return (
    <>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <PageLayout title="ออเดอร์ที่รอจัดทริป">
        {/* Sticky Summary Bar */}
        {selectedOrders.size > 0 && (
          <div className="sticky top-0 z-20 bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg mb-4 rounded-lg">
            <div className="px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-2">
                    <div className="bg-white/20 rounded-full p-2">
                      <Package className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xs text-blue-100">เลือกแล้ว</div>
                      <div className="text-2xl font-bold">{selectedOrders.size}</div>
                    </div>
                  </div>
                  <div className="h-10 w-px bg-white/30"></div>
                  <div>
                    <div className="text-xs text-blue-100">สินค้ารวม</div>
                    <div className="text-lg font-semibold">
                      {aggregatedProductsTotal} ชิ้น
                    </div>
                  </div>
                  <div className="h-10 w-px bg-white/30"></div>
                  <div>
                    <div className="text-xs text-blue-100">มูลค่ารวม</div>
                    <div className="text-lg font-semibold">
                      ฿{selectedTotal.toLocaleString()}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={() => setShowProductsSummaryModal(true)}
                    className="bg-white/20 hover:bg-white/30 text-white border-white/40"
                  >
                    <Box className="w-4 h-4 mr-1" />
                    สรุปสินค้า
                  </Button>
                  <Button
                    size="sm"
                    onClick={clearSelection}
                    variant="outline"
                    className="bg-white/10 hover:bg-white/20 text-white border-white/40"
                  >
                    ยกเลิกทั้งหมด
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleCreateTrip}
                    className="bg-white/20 hover:bg-white/30 text-white border-white/40 font-semibold"
                  >
                    สร้างทริป
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Info Banner */}
        <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <div className="flex items-start gap-3">
            <Package className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <div className="font-medium text-blue-900 dark:text-blue-100 mb-1">วิธีสร้างทริปจัดส่ง</div>
              <div className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
                <p>• <strong>สร้างจากออเดอร์</strong>: เลือกออเดอร์จากรายการด้านล่าง → คลิก "สร้างทริป" ที่แถบด้านบน</p>
                <p>• <strong>สร้างทริปด่วน</strong>: สำหรับกรณีฉุกเฉิน/พิเศษ → คลิกปุ่ม "สร้างทริปด่วน" ⚡</p>
              </div>
            </div>
          </div>
        </div>

        {/* Header with Filters */}
        <div className="mb-6 space-y-4">
          <div className="flex flex-wrap items-center gap-4">
            {/* Search */}
            <div className="flex-1 min-w-[250px]">
              <input
                type="text"
                placeholder="ค้นหาออเดอร์, ร้านค้า..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
              />
            </div>

            {/* Branch Filter */}
            <div className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-gray-400 dark:text-gray-500" />
              <select
                value={branchFilter}
                onChange={(e) => setBranchFilter(e.target.value)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={!(profile?.role === 'admin' || profile?.role === 'manager' || profile?.role === 'inspector' || profile?.role === 'executive' || profile?.branch === 'HQ')}
              >
                {(profile?.role === 'admin' || profile?.role === 'manager' || profile?.role === 'inspector' || profile?.role === 'executive' || profile?.branch === 'HQ') && (
                  <>
                    <option value="ALL">ทุกสาขา</option>
                    <option value="HQ">สำนักงานใหญ่</option>
                  </>
                )}
                <option value="SD">สาขาสอยดาว</option>
              </select>
            </div>

            {/* Date Filter */}
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-gray-400 dark:text-gray-500" />
              <input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              />
              {dateFilter && (
                <button
                  onClick={() => setDateFilter('')}
                  className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>

            <Button onClick={refetch} variant="outline">
              รีเฟรช
            </Button>

            {/* Toggle Group by Area */}
            <Button
              onClick={() => { setGroupByArea(prev => !prev); setCollapsedGroups(new Set()); setDistrictFilter('ALL'); setSubDistrictFilter('ALL'); }}
              variant={groupByArea ? 'primary' : 'outline'}
              className={`flex items-center gap-2 ${groupByArea ? 'bg-indigo-600 hover:bg-indigo-700 text-white' : 'border-indigo-300 text-indigo-600 hover:bg-indigo-50'}`}
            >
              {groupByArea ? <Layers className="w-4 h-4" /> : <List className="w-4 h-4" />}
              {groupByArea ? 'จัดกลุ่มตามพื้นที่' : 'จัดกลุ่มตามพื้นที่'}
            </Button>

            {/* Quick Create Button (always visible) */}
            <Button
              onClick={() => setShowQuickCreate(true)}
              variant="outline"
              className="flex items-center gap-2 border-orange-300 text-orange-600 hover:bg-orange-50"
            >
              <Zap className="w-4 h-4" />
              สร้างทริปด่วน
            </Button>
          </div>

        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card>
            <div className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">ออเดอร์ทั้งหมด</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{orders?.length || 0}</p>
                </div>
                <Package className="w-10 h-10 text-blue-500 opacity-50" />
              </div>
            </div>
          </Card>

          <Card>
            <div className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">ออเดอร์ที่กรอง</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{filteredOrders.length}</p>
                </div>
                <Filter className="w-10 h-10 text-green-500 opacity-50" />
              </div>
            </div>
          </Card>

          <Card>
            <div className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">มูลค่ารวม</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    {new Intl.NumberFormat('th-TH', {
                      notation: 'compact',
                      compactDisplay: 'short'
                    }).format(filteredOrdersTotal)} ฿
                  </p>
                </div>
                <DollarSign className="w-10 h-10 text-yellow-500 opacity-50" />
              </div>
            </div>
          </Card>
        </div>

        {/* Quick District Filter Chips */}
        {groupByArea && availableDistricts.length > 1 && (
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2 px-1">
              <MapPin className="w-4 h-4 text-indigo-500" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">กรองตามอำเภอ:</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {/* ALL chip */}
              <button
                onClick={() => { setDistrictFilter('ALL'); setSubDistrictFilter('ALL'); }}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${districtFilter === 'ALL'
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-400'
                  }`}
              >
                ทั้งหมด
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${districtFilter === 'ALL'
                    ? 'bg-white/20 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                  }`}>
                  {filteredOrders.length}
                </span>
              </button>

              {/* District chips */}
              {availableDistricts.map(d => (
                <button
                  key={d.key}
                  onClick={() => {
                    setDistrictFilter(prev => prev === d.key ? 'ALL' : d.key);
                    setSubDistrictFilter('ALL');
                  }}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${districtFilter === d.key
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                      : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-400'
                    }`}
                >
                  📍 {d.key}
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${districtFilter === d.key
                      ? 'bg-white/20 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                    }`}>
                    {d.count}
                  </span>
                </button>
              ))}
            </div>

            {/* Sub-district chips (shown when a district is selected) */}
            {districtFilter !== 'ALL' && availableSubDistricts.length > 1 && (
              <div className="mt-3 ml-4 pl-4 border-l-2 border-indigo-200 dark:border-indigo-700">
                <div className="flex items-center gap-2 mb-2 px-1">
                  <Navigation className="w-3.5 h-3.5 text-teal-500" />
                  <span className="text-xs font-medium text-gray-600 dark:text-gray-400">ตำบลใน {districtFilter}:</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {/* ALL sub-districts chip */}
                  <button
                    onClick={() => setSubDistrictFilter('ALL')}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${subDistrictFilter === 'ALL'
                        ? 'bg-teal-600 text-white border-teal-600 shadow-sm'
                        : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:border-teal-400 hover:text-teal-600 dark:hover:text-teal-400'
                      }`}
                  >
                    ทุกตำบล
                    <span className={`text-xs px-1 py-0 rounded-full ${subDistrictFilter === 'ALL'
                        ? 'bg-white/20 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-400'
                      }`}>
                      {availableSubDistricts.reduce((s, d) => s + d.count, 0)}
                    </span>
                  </button>

                  {availableSubDistricts.map(sd => {
                    // ดึงเฉพาะชื่อตำบลจาก areaKey ("อ.XXX / ต.YYY" -> "ต.YYY")
                    const label = sd.key.includes(' / ') ? sd.key.split(' / ')[1] : sd.key;
                    return (
                      <button
                        key={sd.key}
                        onClick={() => setSubDistrictFilter(prev => prev === sd.key ? 'ALL' : sd.key)}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${subDistrictFilter === sd.key
                            ? 'bg-teal-600 text-white border-teal-600 shadow-sm'
                            : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:border-teal-400 hover:text-teal-600 dark:hover:text-teal-400'
                          }`}
                      >
                        {label}
                        <span className={`text-xs px-1 py-0 rounded-full ${subDistrictFilter === sd.key
                            ? 'bg-white/20 text-white'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-400'
                          }`}>
                          {sd.count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Orders List */}
        {filteredOrders.length === 0 ? (
          <Card>
            <div className="p-12 text-center text-gray-500 dark:text-gray-400">
              <Package className="w-16 h-16 mx-auto mb-4 opacity-30" />
              <p className="text-lg font-medium">ไม่มีออเดอร์ที่รอจัดทริป</p>
              <p className="text-sm mt-2">ออเดอร์ทั้งหมดถูกจัดเข้าทริปแล้ว</p>
            </div>
          </Card>
        ) : (
          <div className="space-y-6">
            {/* Selected Orders Section (Compact View) */}
            {selectedOrderObjects.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-3 px-2">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                    <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse"></div>
                    ออเดอร์ที่เลือกแล้ว ({selectedOrderObjects.length})
                  </h3>
                </div>
                <div className="space-y-2">
                  {selectedOrderObjects.map((order: any) => (
                    <Card key={order.id} className="bg-blue-50 border-blue-200">
                      <div className="p-4">
                        <div className="flex items-center gap-4">
                          <input
                            type="checkbox"
                            checked={true}
                            onChange={() => toggleOrderSelection(order.id)}
                            className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                          />
                          <div className="flex-1 grid grid-cols-4 gap-4 items-center">
                            <div>
                              <div className="font-mono text-sm font-semibold text-blue-700">
                                {order.order_number}
                              </div>
                              <div className="text-xs text-gray-500">
                                {new Date(order.order_date).toLocaleDateString('th-TH', {
                                  day: 'numeric',
                                  month: 'short',
                                })}
                              </div>
                              {order.delivery_date && (
                                <div className="flex items-center gap-1 mt-1">
                                  <Calendar className="w-3 h-3 text-orange-600" />
                                  <span className="text-xs font-medium text-orange-600">
                                    นัดส่ง: {new Date(order.delivery_date).toLocaleDateString('th-TH', {
                                      day: 'numeric',
                                      month: 'short',
                                    })}
                                  </span>
                                </div>
                              )}
                            </div>
                            <div>
                              <div className="font-medium text-blue-900 dark:text-blue-100">{order.customer_name}</div>
                              <div className="text-xs text-blue-700 dark:text-blue-300">{order.customer_code}</div>
                            </div>
                            <div className="text-right">
                              <div className="font-bold text-blue-600">
                                ฿{order.total_amount.toLocaleString()}
                              </div>
                            </div>
                            <div className="text-right">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => toggleOrderDetails(order.id)}
                                className="text-xs"
                              >
                                {expandedOrders.has(order.id) ? (
                                  <>
                                    <ChevronDown className="w-3 h-3" />
                                    ซ่อน
                                  </>
                                ) : (
                                  <>
                                    <ChevronRight className="w-3 h-3" />
                                    ดู
                                  </>
                                )}
                              </Button>
                            </div>
                          </div>
                        </div>

                        {/* Order Items (Expandable) */}
                        {expandedOrders.has(order.id) && (
                          <div className="mt-4 pt-4 border-t border-blue-200">
                            <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                              <Package className="w-4 h-4 text-blue-600" />
                              รายการสินค้า
                            </h4>
                            {orderItems.get(order.id) ? (
                              <div className="bg-white rounded-lg p-3 overflow-x-auto">
                                <table className="w-full text-sm min-w-[580px]">
                                  <thead>
                                    <tr className="border-b border-gray-300">
                                      <th className="text-left py-2 px-2 font-semibold text-gray-700">รหัส</th>
                                      <th className="text-left py-2 px-2 font-semibold text-gray-700">ชื่อสินค้า</th>
                                      <th className="text-right py-2 px-2 font-semibold text-gray-700">สั่ง</th>
                                      <th className="text-right py-2 px-2 font-semibold text-orange-600" title="จำนวนที่ลูกค้ามารับที่ร้านแล้ว">รับที่ร้าน 🏪</th>
                                      <th className="text-right py-2 px-2 font-semibold text-green-600" title="จำนวนที่ส่งให้ลูกค้าแล้ว">ส่งแล้ว ✅</th>
                                      <th className="text-right py-2 px-2 font-semibold text-blue-600">คงเหลือ</th>
                                      <th className="text-left py-2 px-2 font-semibold text-gray-700">หน่วย</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {orderItems.get(order.id)!.map((item: any, idx: number) => {
                                      const pickedUp = Number(item.quantity_picked_up_at_store ?? 0);
                                      const delivered = Number(item.quantity_delivered ?? 0);
                                      const remaining = Math.max(0, Number(item.quantity) - pickedUp - delivered);
                                      const isFulfilled = remaining === 0;
                                      return (
                                        <tr key={idx} className={`border-b border-gray-200 last:border-0 ${isFulfilled ? 'opacity-50' : ''}`}>
                                          <td className="py-2 px-2 text-gray-500">{item.product?.product_code || '-'}</td>
                                          <td className="py-2 px-2">
                                            <div className="flex items-center gap-2 flex-wrap">
                                              <span className={`font-medium ${isFulfilled ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                                                {item.product?.product_name || 'ไม่ระบุ'}
                                              </span>
                                              {item.is_bonus && <Badge variant="success" className="text-xs">ของแถม</Badge>}
                                              {isFulfilled && (
                                                <span className="inline-flex items-center gap-1 text-xs text-green-600 font-medium">
                                                  <CheckCircle2 className="w-3 h-3" /> ครบแล้ว
                                                </span>
                                              )}
                                            </div>
                                          </td>
                                          <td className="py-2 px-2 text-right font-semibold text-gray-700">{Number(item.quantity).toLocaleString()}</td>
                                          <td className="py-2 px-2 text-right">
                                            <div className="flex items-center justify-end gap-1">
                                              <input
                                                type="number"
                                                min={0}
                                                max={Number(item.quantity)}
                                                step={1}
                                                value={pendingPickupValues[item.id] !== undefined ? pendingPickupValues[item.id] : pickedUp}
                                                disabled={savingPickupItemId === item.id}
                                                onChange={(e) => {
                                                  const raw = Number(e.target.value);
                                                  const val = Math.min(Number(item.quantity), Math.max(0, Number.isFinite(raw) ? Math.floor(raw) : 0));
                                                  handleUpdatePickup(item.id, val);
                                                }}
                                                className="w-16 text-right border border-orange-300 rounded px-1 py-0.5 text-sm focus:ring-1 focus:ring-orange-400 bg-orange-50 text-orange-800 disabled:opacity-50"
                                                title="จำนวนเต็มที่ลูกค้ารับไปที่หน้าร้าน — คงเหลือส่งอัตโนมัติ"
                                              />
                                              {savingPickupItemId === item.id && <Clock className="w-3 h-3 text-orange-500 animate-spin" />}
                                            </div>
                                          </td>
                                          <td className="py-2 px-2 text-right text-green-600 font-semibold">
                                            {delivered > 0 ? delivered.toLocaleString() : <span className="text-gray-300">—</span>}
                                          </td>
                                          <td className="py-2 px-2 text-right">
                                            <span className={`font-bold ${isFulfilled ? 'text-gray-400' : remaining < Number(item.quantity) ? 'text-orange-600' : 'text-blue-600'}`}>
                                              {remaining.toLocaleString()}
                                            </span>
                                          </td>
                                          <td className="py-2 px-2 text-gray-500">{item.product?.unit || '-'}</td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                  <tfoot>
                                    <tr className="border-t-2 border-gray-400">
                                      <td colSpan={2} className="py-2 px-2 text-right text-xs text-gray-500 font-medium">รวม:</td>
                                      <td className="py-2 px-2 text-right font-bold text-gray-700">
                                        {orderItems.get(order.id)!.reduce((s: number, i: any) => s + Number(i.quantity), 0).toLocaleString()}
                                      </td>
                                      <td className="py-2 px-2 text-right font-bold text-orange-600">
                                        {orderItems.get(order.id)!.reduce((s: number, i: any) => s + Number(i.quantity_picked_up_at_store ?? 0), 0).toLocaleString()}
                                      </td>
                                      <td className="py-2 px-2 text-right font-bold text-green-600">
                                        {orderItems.get(order.id)!.reduce((s: number, i: any) => s + Number(i.quantity_delivered ?? 0), 0).toLocaleString()}
                                      </td>
                                      <td className="py-2 px-2 text-right font-bold text-blue-600">
                                        {orderItems.get(order.id)!.reduce((s: number, i: any) =>
                                          s + Math.max(0, Number(i.quantity) - Number(i.quantity_picked_up_at_store ?? 0) - Number(i.quantity_delivered ?? 0))
                                          , 0).toLocaleString()}
                                      </td>
                                      <td />
                                    </tr>
                                  </tfoot>
                                </table>
                                <p className="mt-2 text-xs text-gray-400">
                                  💡 กรอก <span className="text-orange-500 font-medium">"รับที่ร้าน"</span> เมื่อลูกค้ามารับสินค้าที่หน้าร้าน — ระบบจะหักยอดคงเหลืออัตโนมัติ
                                </p>
                              </div>
                            ) : (
                              <div className="flex items-center justify-center py-4">
                                <LoadingSpinner size={20} />
                                <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">กำลังโหลด...</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* All Orders Section */}
            <div>
              <div className="flex items-center justify-between mb-3 px-2">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                  ออเดอร์ทั้งหมด ({filteredOrders.length})
                </h3>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selectedOrders.size === filteredOrders.length && filteredOrders.length > 0}
                    onChange={(e) => {
                      if (e.target.checked) {
                        selectAll();
                      } else {
                        clearSelection();
                      }
                    }}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    เลือกทั้งหมด
                  </label>
                </div>
              </div>

              {/* Grouped View by Area */}
              {groupByArea && groupedOrders ? (
                <div className="space-y-4">
                  {groupedOrders.map(district => (
                    <div key={district.districtKey} className="space-y-2">
                      {/* District Header */}
                      <div
                        className="flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-indigo-50 to-indigo-100 dark:from-indigo-900/30 dark:to-indigo-800/20 border border-indigo-200 dark:border-indigo-700 rounded-xl cursor-pointer hover:from-indigo-100 hover:to-indigo-150 dark:hover:from-indigo-900/40 transition-colors"
                        onClick={() => toggleGroupCollapse(district.districtKey)}
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
                                      onChange={() => selectGroupOrders(areaOrders)}
                                      className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                                      title={`เลือกทั้งหมดใน ${areaKey}`}
                                    />
                                    <button
                                      className="flex items-center gap-2 flex-1 text-left"
                                      onClick={() => toggleGroupCollapse(areaKey)}
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
                                      {areaOrders.map((order: any) => (
                                        <OrderCard
                                          key={order.id}
                                          order={order}
                                          isSelected={selectedOrders.has(order.id)}
                                          isExpanded={expandedOrders.has(order.id)}
                                          orderItems={orderItems.get(order.id) || []}
                                          onToggleSelection={toggleOrderSelection}
                                          onToggleDetails={toggleOrderDetails}
                                          onEdit={handleEditOrder}
                                          onUpdatePickup={handleUpdatePickup}
                                          savingPickupItemId={savingPickupItemId}
                                          pendingPickupValues={pendingPickupValues}
                                        />
                                      ))}
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
              ) : (
                /* Flat View (default) */
                <div>
                  {/* Order Cards (Full View) - Using memoized component */}
                  {filteredOrders.map((order: any) => (
                    <OrderCard
                      key={order.id}
                      order={order}
                      isSelected={selectedOrders.has(order.id)}
                      isExpanded={expandedOrders.has(order.id)}
                      orderItems={orderItems.get(order.id) || []}
                      onToggleSelection={toggleOrderSelection}
                      onToggleDetails={toggleOrderDetails}
                      onEdit={handleEditOrder}
                      onUpdatePickup={handleUpdatePickup}
                      savingPickupItemId={savingPickupItemId}
                      pendingPickupValues={pendingPickupValues}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Products Summary Modal */}
        {showProductsSummaryModal && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <Card className="max-w-4xl w-full max-h-[80vh] overflow-hidden flex flex-col">
              <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-purple-600 to-purple-700 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold flex items-center gap-2">
                      <Box className="w-6 h-6" />
                      สรุปสินค้ารวมทั้งหมด
                    </h2>
                    <p className="text-sm text-purple-100 mt-1">
                      จาก {selectedOrders.size} ออเดอร์ที่เลือก
                    </p>
                  </div>
                  <button
                    onClick={() => setShowProductsSummaryModal(false)}
                    className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6">
                {aggregatedProducts.length === 0 ? (
                  <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                    <Package className="w-16 h-16 mx-auto mb-4 opacity-30" />
                    <p>ไม่มีรายการสินค้า</p>
                  </div>
                ) : (
                  <div>
                    {/* Summary Stats */}
                    <div className="grid grid-cols-3 gap-4 mb-6">
                      <div className="bg-purple-50 rounded-lg p-4 text-center">
                        <div className="text-sm text-purple-600 mb-1">รายการสินค้า</div>
                        <div className="text-3xl font-bold text-purple-900">
                          {aggregatedProducts.length}
                        </div>
                      </div>
                      <div className="bg-blue-50 rounded-lg p-4 text-center">
                        <div className="text-sm text-blue-600 mb-1">จำนวนรวม</div>
                        <div className="text-3xl font-bold text-blue-900">
                          {aggregatedProducts.reduce((sum, p) => sum + p.total_quantity, 0).toLocaleString()}
                        </div>
                      </div>
                      <div className="bg-green-50 rounded-lg p-4 text-center">
                        <div className="text-sm text-green-600 mb-1">มูลค่ารวม</div>
                        <div className="text-3xl font-bold text-green-900">
                          ฿{selectedTotal.toLocaleString()}
                        </div>
                      </div>
                    </div>

                    {/* Products Table */}
                    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg overflow-hidden">
                      <table className="w-full">
                        <thead className="bg-purple-600 text-white sticky top-0">
                          <tr>
                            <th className="text-left py-3 px-4 font-semibold">#</th>
                            <th className="text-left py-3 px-4 font-semibold">รหัสสินค้า</th>
                            <th className="text-left py-3 px-4 font-semibold">ชื่อสินค้า</th>
                            <th className="text-right py-3 px-4 font-semibold">จำนวนรวม</th>
                            <th className="text-center py-3 px-4 font-semibold">หน่วย</th>
                          </tr>
                        </thead>
                        <tbody>
                          {aggregatedProducts.map((product, index) => (
                            <tr
                              key={product.product_id}
                              className="border-b border-gray-200 dark:border-gray-700 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors"
                            >
                              <td className="py-3 px-4 text-gray-500 dark:text-gray-400 text-sm">{index + 1}</td>
                              <td className="py-3 px-4">
                                <div className="font-mono text-sm text-gray-600 dark:text-gray-400">
                                  {product.product_code}
                                </div>
                              </td>
                              <td className="py-3 px-4">
                                <div className="font-medium text-gray-900 dark:text-gray-100">{product.product_name}</div>
                              </td>
                              <td className="py-3 px-4 text-right">
                                <div className="font-bold text-xl text-purple-700 dark:text-purple-400">
                                  {product.total_quantity.toLocaleString()}
                                </div>
                              </td>
                              <td className="py-3 px-4 text-center">
                                <Badge variant="default">{product.unit}</Badge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Helpful Tip */}
                    <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <div className="flex items-start gap-3">
                        <div className="text-2xl">💡</div>
                        <div className="flex-1">
                          <div className="font-semibold text-yellow-900 mb-1">
                            คำแนะนำในการเลือกรถ
                          </div>
                          <div className="text-sm text-yellow-800">
                            ใช้ข้อมูลสรุปนี้ประกอบการพิจารณาเลือกรถที่มีพื้นที่เหมาะสมสำหรับจำนวนสินค้าในทริปนี้
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setShowProductsSummaryModal(false)}
                  >
                    ปิด
                  </Button>
                  <Button onClick={handleCreateTrip}>
                    ดำเนินการสร้างทริป
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        )}
      </PageLayout>
    </>
  );
}

