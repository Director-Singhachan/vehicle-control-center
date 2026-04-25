import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Clock } from 'lucide-react';
import { PageLayout } from '../components/ui/PageLayout';
import { ordersService, orderItemsService } from '../services/ordersService';
import { EditOrderView } from './EditOrderView';
import { useOrderBranchScope } from '../hooks/useOrderBranchScope';
import { supabase } from '../lib/supabase';
import { getEffectiveOrderUiStatus } from '../utils/orderEffectiveStatus';
import { orderMatchesTrackBillIssueFilter, type TrackBillIssueFilter } from '../utils/orderBillCorrection';
import { OrderEffectiveStatusBadge } from '../components/order/OrderEffectiveStatusBadge';
import {
  BRANCH_ALL_LABEL,
  BRANCH_ALL_VALUE,
  BRANCH_FILTER_OPTIONS,
  getBranchLabel,
} from '../utils/branchLabels';
import { orderQueryFiltersForUiBranch } from '../utils/orderUserScope';
import { TrackOrdersFilterBar } from '../components/order/TrackOrdersFilterBar';
import { TrackOrdersStats } from '../components/order/TrackOrdersStats';
import { TrackOrdersTable } from '../components/order/TrackOrdersTable';
import { OrderDetailModal } from '../components/order/OrderDetailModal';

interface Order {
  id: string;
  order_number: string | null;
  customer_name: string;
  customer_code: string;
  total_amount: number;
  created_at: string;
  status: string;
  store_id: string;
  delivery_date?: string | null;
  branch?: string | null;
  delivery_trip_id?: string | null;
  trip_status?: 'planned' | 'in_progress' | 'completed' | 'cancelled' | null;
  related_prior_order_id?: string | null;
  related_prior_order_number?: string | null;
  exclude_from_vehicle_revenue_rollup?: boolean | null;
  replaces_sml_doc_no?: string | null;
}

export function TrackOrdersView() {
  const orderScope = useOrderBranchScope();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [billIssueFilter, setBillIssueFilter] = useState<TrackBillIssueFilter>('all');
  const [branchFilter, setBranchFilter] = useState<string>('ALL');
  const [detailOrder, setDetailOrder] = useState<any | null>(null);
  const [detailItems, setDetailItems] = useState<any[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);

  // สรุปจำนวนรวมต่อออเดอร์ (สั่งทั้งหมด / รับที่ร้าน / ส่งแล้ว / คงเหลือ)
  const detailSummary = useMemo(() => {
    if (!detailItems || detailItems.length === 0) return null;

    let ordered = 0;
    let pickedUp = 0;
    let delivered = 0;
    let remaining = 0;

    for (const item of detailItems) {
      const qty = Number(item.quantity || 0);
      const picked = Number(item.quantity_picked_up_at_store ?? 0);
      const deliv = Number(item.quantity_delivered ?? 0);
      const method = (item.fulfillment_method ?? 'delivery') as string;

      ordered += qty;
      pickedUp += picked;
      if (method === 'delivery') {
        delivered += deliv;
        remaining += Math.max(qty - picked - deliv, 0);
      } else {
        // pickup ไม่มี quantity_delivered
        remaining += Math.max(qty - picked, 0);
      }
    }

    return { ordered, pickedUp, delivered, remaining };
  }, [detailItems]);

  const [currentPage, setCurrentPage] = useState(1);
  const [pageInput, setPageInput] = useState('');
  const itemsPerPage = 100;

  const trackBranchOptions = useMemo(() => {
    if (orderScope.loading) {
      return [{ value: BRANCH_ALL_VALUE, label: BRANCH_ALL_LABEL }];
    }
    if (orderScope.unrestricted) {
      return BRANCH_FILTER_OPTIONS;
    }
    const allowed = orderScope.allowedBranches;
    if (allowed.length === 0) {
      return [{ value: BRANCH_ALL_VALUE, label: BRANCH_ALL_LABEL }];
    }
    const opts = allowed.map((b) => ({ value: b, label: getBranchLabel(b) }));
    if (allowed.length === 1) return opts;
    return [{ value: BRANCH_ALL_VALUE, label: 'ทุกสาขา (ที่อนุญาต)' }, ...opts];
  }, [orderScope]);

  const trackBranchSelectDisabled =
    !orderScope.loading && !orderScope.unrestricted && orderScope.allowedBranches.length === 1;

  useEffect(() => {
    if (orderScope.loading) return;
    if (orderScope.unrestricted) return;
    const a = orderScope.allowedBranches;
    if (a.length === 1) {
      setBranchFilter((prev) => (prev !== a[0] ? a[0] : prev));
      return;
    }
    if (a.length > 1 && branchFilter !== BRANCH_ALL_VALUE && branchFilter !== 'ALL' && !a.includes(branchFilter)) {
      setBranchFilter(BRANCH_ALL_VALUE);
    }
  }, [orderScope.loading, orderScope.unrestricted, orderScope.allowedBranches, branchFilter]);

  const loadOrders = useCallback(async () => {
    if (orderScope.loading) return;
    try {
      setLoading(true);
      const f = orderQueryFiltersForUiBranch(orderScope, branchFilter, BRANCH_ALL_VALUE);
      let data: Order[];
      if (f?.branchesIn !== undefined) {
        if (f.branchesIn.length === 0) {
          data = [];
        } else {
          data = (await ordersService.getAll({ branchesIn: f.branchesIn })) as Order[];
        }
      } else if (f?.branch) {
        data = (await ordersService.getAll({ branch: f.branch })) as Order[];
      } else {
        data = (await ordersService.getAll()) as Order[];
      }
      setOrders(data);
    } catch (error) {
      console.error('Error loading orders:', error);
    } finally {
      setLoading(false);
    }
  }, [orderScope, branchFilter]);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, branchFilter, billIssueFilter]);

  const billCaseCountInList = useMemo(
    () => orders.filter((o) => orderMatchesTrackBillIssueFilter(o, 'any')).length,
    [orders]
  );

  const getEffectiveStatus = (order: Order): string => getEffectiveOrderUiStatus(order);

  // Subscribe realtime changes on orders so Track Orders auto-refreshes
  useEffect(() => {
    const channel = supabase
      .channel('track-orders-orders')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
        },
        () => {
          // Reload full list so aggregate stats + filters stay consistent
          loadOrders();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadOrders]);

  // โหลดข้อมูลใหม่เมื่อผู้ใช้กลับมาที่แท็บ/หน้านี้ (หลังลงเลขไมล์ขากลับหรือปิดทริปแล้ว)
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') loadOrders();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [loadOrders]);

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      const uiStatus = getEffectiveStatus(order);

      // Search filter (รวมเลข SML อ้างอิงบิลเดิม)
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        const sml = String(order.replaces_sml_doc_no ?? '').toLowerCase();
        const priorNo = String(order.related_prior_order_number ?? '').toLowerCase();
        if (
          !order.order_number?.toLowerCase().includes(search) &&
          !order.customer_name?.toLowerCase().includes(search) &&
          !order.customer_code?.toLowerCase().includes(search) &&
          !(sml && sml.includes(search)) &&
          !(priorNo && priorNo.includes(search))
        ) {
          return false;
        }
      }

      if (!orderMatchesTrackBillIssueFilter(order, billIssueFilter)) {
        return false;
      }

      // Status filter
      if (statusFilter !== 'all') {
        if (statusFilter === 'assigned') {
          // "กำหนดทริปแล้ว" = มีทริปแล้ว แต่ยังไม่ออกไปส่ง
          if (uiStatus !== 'assigned') {
            return false;
          }
        } else if (statusFilter === 'pending') {
          if (uiStatus !== 'pending') {
            return false;
          }
        } else {
          if (uiStatus !== statusFilter) {
            return false;
          }
        }
      }

      // Branch filter
      if (
        branchFilter &&
        branchFilter !== 'ALL' &&
        branchFilter !== BRANCH_ALL_VALUE
      ) {
        if (order.branch !== branchFilter) {
          return false;
        }
      }

      return true;
    });
  }, [orders, searchTerm, statusFilter, branchFilter, billIssueFilter]);

  const offset = (currentPage - 1) * itemsPerPage;
  const paginatedOrders = useMemo(
    () => filteredOrders.slice(offset, offset + itemsPerPage),
    [filteredOrders, offset, itemsPerPage]
  );
  const totalPages = Math.ceil(filteredOrders.length / itemsPerPage) || 1;
  const startIndex = offset;
  const endIndex = Math.min(offset + itemsPerPage, filteredOrders.length);

  const getStatusBadge = (order: Order) => <OrderEffectiveStatusBadge order={order} />;

  const stats = useMemo(() => {
    return {
      total: filteredOrders.length,
      pending: filteredOrders.filter((o) => getEffectiveStatus(o) === 'pending').length,
      partial: filteredOrders.filter((o) => getEffectiveStatus(o) === 'partial').length,
      assigned: filteredOrders.filter((o) => getEffectiveStatus(o) === 'assigned').length,
      in_delivery: filteredOrders.filter((o) => getEffectiveStatus(o) === 'in_delivery').length,
      delivered: filteredOrders.filter((o) => getEffectiveStatus(o) === 'delivered').length,
    };
  }, [filteredOrders]);

  const openDetail = async (order: any) => {
    try {
      setDetailOrder(order);
      setDetailLoading(true);
      setDetailError(null);
      const items = await orderItemsService.getByOrderId(order.id);
      setDetailItems(items);
    } catch (err: any) {
      console.error('Error loading order items:', err);
      setDetailError(err?.message || 'ไม่สามารถโหลดรายการสินค้าได้');
    } finally {
      setDetailLoading(false);
    }
  };

  const closeDetail = () => {
    setDetailOrder(null);
    setDetailItems([]);
    setDetailError(null);
  };

  // ถ้ากำลังแก้ไขออเดอร์ แสดงหน้าแก้ไข
  if (editingOrderId) {
    return (
      <EditOrderView
        orderId={editingOrderId}
        onSave={() => {
          setEditingOrderId(null);
          loadOrders();
        }}
        onCancel={() => setEditingOrderId(null)}
      />
    );
  }

  return (
    <PageLayout title="ติดตามออเดอร์">
      <TrackOrdersFilterBar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        branchFilter={branchFilter}
        onBranchChange={setBranchFilter}
        branchOptions={trackBranchOptions}
        branchSelectDisabled={trackBranchSelectDisabled}
        statusFilter={statusFilter}
        onStatusChange={setStatusFilter}
        billIssueFilter={billIssueFilter}
        onBillIssueFilterChange={setBillIssueFilter}
        billCaseCountInList={billCaseCountInList}
        onRefresh={loadOrders}
        loading={loading}
      />

      <TrackOrdersStats stats={stats} />

      <TrackOrdersTable
        orders={paginatedOrders}
        loading={loading}
        filteredCount={filteredOrders.length}
        currentPage={currentPage}
        setCurrentPage={setCurrentPage}
        totalPages={totalPages}
        startIndex={startIndex}
        endIndex={endIndex}
        onOpenDetail={openDetail}
        onEditOrder={setEditingOrderId}
        getEffectiveStatus={getEffectiveStatus}
        getStatusBadge={getStatusBadge}
      />

      <OrderDetailModal
        order={detailOrder}
        loading={detailLoading}
        error={detailError}
        items={detailItems}
        summary={detailSummary}
        onClose={closeDetail}
        getStatusBadge={getStatusBadge}
      />

      {/* Info Message */}
      <div className="mt-8 p-4 bg-enterprise-50/50 dark:bg-enterprise-900/10 border border-enterprise-100 dark:border-enterprise-900/30 rounded-xl flex flex-col sm:flex-row items-center sm:items-start gap-4 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-enterprise-200/30 dark:bg-enterprise-700/10 blur-3xl -mr-10 -mt-10 rounded-full"></div>
        <div className="w-10 h-10 rounded-full bg-enterprise-100 dark:bg-enterprise-800/50 flex items-center justify-center shrink-0">
          <Clock className="w-5 h-5 text-enterprise-600 dark:text-enterprise-400" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-enterprise-900 dark:text-enterprise-300 mb-1">หมายเหตุสำคัญ</h3>
          <p className="text-sm text-enterprise-700/90 dark:text-enterprise-400/80 leading-relaxed">
            หน้านี้ออกแบบมาเพื่อติดตามสถานะออเดอร์และการจัดส่งเท่านั้น หากต้องการสร้างทริปจัดส่ง กรุณาไปที่เมนู <span className="font-semibold px-1.5 py-0.5 bg-enterprise-100 dark:bg-enterprise-800/60 rounded">ทริปส่งสินค้า</span>
          </p>
        </div>
      </div>
    </PageLayout>
  );
}

