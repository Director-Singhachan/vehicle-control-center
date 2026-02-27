import React, { useState, useMemo, useEffect, useCallback, memo } from 'react';
import { Package, Calendar, MapPin, DollarSign, User, Phone, Filter, X, Zap, ChevronDown, ChevronRight, Eye, Edit, Layers, List, Navigation, Ban } from 'lucide-react';
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
import { OrderItemsTable } from '../components/order/OrderItemsTable';
import { ProductsSummaryModal } from '../components/order/ProductsSummaryModal';
import { SelectedOrdersSummaryBar } from '../components/order/SelectedOrdersSummaryBar';
import { AreaGroupedOrderList } from '../components/order/AreaGroupedOrderList';
import { usePendingOrdersFilters } from '../hooks/usePendingOrdersFilters';
import { usePickupUpdate } from '../hooks/usePickupUpdate';
import { PaymentStatusBadge } from '../components/order/PaymentStatusBadge';

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

  const isShippingForbidden = order.payment_status === 'รอชำระ' || order.payment_status === 'รอชำระหนี้คงค้าง';

  return (
    <Card className={isSelected ? 'ring-2 ring-blue-500' : ''}>
      <div className="p-6">
        <div className="flex items-start gap-4">
          {/* Checkbox */}
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => !isShippingForbidden && onToggleSelection(order.id)}
            disabled={isShippingForbidden}
            className={`mt-1 w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 ${isShippingForbidden ? 'opacity-50 cursor-not-allowed' : ''}`}
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
                {order.payment_status && (
                  <div className="mt-2">
                    <PaymentStatusBadge status={order.payment_status} />
                  </div>
                )}
                {isShippingForbidden && (
                  <p className="mt-2 text-xs font-bold text-red-600 dark:text-red-400 flex items-center gap-1">
                    <Ban className="w-3 h-3" />
                    ห้ามจัดขึ้นรถ (รอเคลียร์ยอดชำระ)
                  </p>
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
                <OrderItemsTable
                  items={orderItems || []}
                  onUpdatePickup={onUpdatePickup}
                  savingPickupItemId={savingPickupItemId}
                  pendingPickupValues={pendingPickupValues}
                  showHint={true}
                  containerClassName="bg-gray-50 dark:bg-gray-800/50"
                  isLoading={!orderItems || orderItems.length === 0}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}, (prevProps, nextProps) => {
  // Custom comparison function for better performance
  if (prevProps.order.id !== nextProps.order.id) return false;
  if (prevProps.isSelected !== nextProps.isSelected) return false;
  if (prevProps.isExpanded !== nextProps.isExpanded) return false;
  if (prevProps.savingPickupItemId !== nextProps.savingPickupItemId) return false;
  if (prevProps.orderItems.length !== nextProps.orderItems.length) return false;
  if (prevProps.isExpanded && nextProps.isExpanded) {
    for (let i = 0; i < prevProps.orderItems.length; i++) {
      if (prevProps.orderItems[i] !== nextProps.orderItems[i]) return false;
      const itemId = prevProps.orderItems[i]?.id;
      if (itemId) {
        const prevPending = prevProps.pendingPickupValues[itemId];
        const nextPending = nextProps.pendingPickupValues[itemId];
        if (prevPending !== nextPending) return false;
      }
    }
  }
  return true;
});

OrderCard.displayName = 'OrderCard';

const TRIP_DELETED_EVENT = 'trip-deleted';

export function PendingOrdersView() {
  const { orders, loading, error, refetch } = usePendingOrders();
  const { toasts, warning, dismissToast } = useToast();
  const { profile } = useAuth();

  // Refetch เมื่อมีการลบทริป
  useEffect(() => {
    const handleTripDeleted = () => refetch();
    window.addEventListener(TRIP_DELETED_EVENT, handleTripDeleted);
    return () => window.removeEventListener(TRIP_DELETED_EVENT, handleTripDeleted);
  }, [refetch]);

  // ── Custom Hooks (Phase 2) ──
  const {
    searchQuery, setSearchQuery,
    dateFilter, setDateFilter,
    branchFilter, setBranchFilter,
    groupByArea,
    collapsedGroups,
    districtFilter,
    subDistrictFilter,
    filteredOrders,
    filteredOrdersTotal,
    availableDistricts,
    availableSubDistricts,
    groupedOrders,
    toggleGroupCollapse,
    toggleGroupByArea,
    handleSetDistrictFilter,
    handleSetSubDistrictFilter,
    resetDistrictFilter,
  } = usePendingOrdersFilters({ orders, profile });

  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  const [showCreateTrip, setShowCreateTrip] = useState(false);
  const [showQuickCreate, setShowQuickCreate] = useState(false);
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
  const [orderItems, setOrderItems] = useState<Map<string, any[]>>(new Map());
  const [showProductsSummaryModal, setShowProductsSummaryModal] = useState(false);
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);

  const { savingPickupItemId, pendingPickupValues, handleUpdatePickup } = usePickupUpdate({
    setOrderItems,
    refetch,
  });

  // Toggle order selection
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

  // Select all filtered orders
  const selectAll = useCallback(() => {
    const allIds = new Set(filteredOrders.map((o: any) => o.id));
    setSelectedOrders(allIds);
  }, [filteredOrders]);

  // Clear selection
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

  // Select all orders in a group
  const selectGroupOrders = useCallback((orders: any[]) => {
    setSelectedOrders(prev => {
      const next = new Set(prev);
      const allSelected = orders.every(o => next.has(o.id));
      if (allSelected) {
        orders.forEach(o => next.delete(o.id));
      } else {
        orders.forEach(o => next.add(o.id));
      }
      return next;
    });
  }, []);

  // Toggle order details
  const toggleOrderDetails = useCallback(async (orderId: string) => {
    setExpandedOrders(prev => {
      const newExpanded = new Set(prev);
      const wasExpanded = newExpanded.has(orderId);

      if (wasExpanded) {
        newExpanded.delete(orderId);
      } else {
        newExpanded.add(orderId);
      }

      if (!wasExpanded) {
        setOrderItems(prevItems => {
          if (!prevItems.has(orderId)) {
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

  const handleEditOrder = useCallback((orderId: string) => {
    setEditingOrderId(orderId);
  }, []);

  // ── Render OrderCard helper for AreaGroupedOrderList ──
  const renderOrderCard = useCallback((order: any) => (
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
  ), [selectedOrders, expandedOrders, orderItems, toggleOrderSelection, toggleOrderDetails, handleEditOrder, handleUpdatePickup, savingPickupItemId, pendingPickupValues]);

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
      <SelectedOrdersSummaryBar
        selectedCount={selectedOrders.size}
        productsTotal={aggregatedProductsTotal}
        selectedTotal={selectedTotal}
        onShowSummary={() => setShowProductsSummaryModal(true)}
        onClearSelection={clearSelection}
        onCreateTrip={handleCreateTrip}
      />
      <PageLayout title="ออเดอร์ที่รอจัดทริป">

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
              onClick={toggleGroupByArea}
              variant={groupByArea ? 'primary' : 'outline'}
              className={`flex items-center gap-2 ${groupByArea ? 'bg-indigo-600 hover:bg-indigo-700 text-white' : 'border-indigo-300 text-indigo-600 hover:bg-indigo-50'}`}
            >
              {groupByArea ? <Layers className="w-4 h-4" /> : <List className="w-4 h-4" />}
              {groupByArea ? 'จัดกลุ่มตามพื้นที่' : 'จัดกลุ่มตามพื้นที่'}
            </Button>

            {/* Quick Create Button */}
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
                onClick={resetDistrictFilter}
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
                  onClick={() => handleSetDistrictFilter(d.key)}
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

            {/* Sub-district chips */}
            {districtFilter !== 'ALL' && availableSubDistricts.length > 1 && (
              <div className="mt-3 ml-4 pl-4 border-l-2 border-indigo-200 dark:border-indigo-700">
                <div className="flex items-center gap-2 mb-2 px-1">
                  <Navigation className="w-3.5 h-3.5 text-teal-500" />
                  <span className="text-xs font-medium text-gray-600 dark:text-gray-400">ตำบลใน {districtFilter}:</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {/* ALL sub-districts chip */}
                  <button
                    onClick={() => handleSetSubDistrictFilter('ALL')}
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
                    const label = sd.key.includes(' / ') ? sd.key.split(' / ')[1] : sd.key;
                    return (
                      <button
                        key={sd.key}
                        onClick={() => handleSetSubDistrictFilter(sd.key)}
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
                            <OrderItemsTable
                              items={orderItems.get(order.id) || []}
                              onUpdatePickup={handleUpdatePickup}
                              savingPickupItemId={savingPickupItemId}
                              pendingPickupValues={pendingPickupValues}
                              showHint={true}
                              containerClassName="bg-white"
                              isLoading={!orderItems.get(order.id)}
                            />
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
                <AreaGroupedOrderList
                  groupedOrders={groupedOrders}
                  selectedOrders={selectedOrders}
                  expandedOrders={expandedOrders}
                  collapsedGroups={collapsedGroups}
                  orderItems={orderItems}
                  savingPickupItemId={savingPickupItemId}
                  pendingPickupValues={pendingPickupValues}
                  onToggleSelection={toggleOrderSelection}
                  onToggleDetails={toggleOrderDetails}
                  onEdit={handleEditOrder}
                  onUpdatePickup={handleUpdatePickup}
                  onToggleGroupCollapse={toggleGroupCollapse}
                  onSelectGroupOrders={selectGroupOrders}
                  renderOrderCard={renderOrderCard}
                />
              ) : (
                /* Flat View (default) */
                <div>
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
        <ProductsSummaryModal
          isOpen={showProductsSummaryModal}
          onClose={() => setShowProductsSummaryModal(false)}
          aggregatedProducts={aggregatedProducts}
          selectedCount={selectedOrders.size}
          selectedTotal={selectedTotal}
          onCreateTrip={handleCreateTrip}
        />
      </PageLayout>
    </>
  );
}
