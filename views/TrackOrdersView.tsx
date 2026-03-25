import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Clock } from 'lucide-react';
import { PageLayout } from '../components/ui/PageLayout';
import { Badge } from '../components/ui/Badge';
import { ordersService, orderItemsService } from '../services/ordersService';
import { EditOrderView } from './EditOrderView';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
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
}

export function TrackOrdersView() {
  const { profile } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [branchFilter, setBranchFilter] = useState<string>(() => {
    const isHighLevel = profile?.role === 'admin' || profile?.role === 'manager' || profile?.role === 'inspector' || profile?.role === 'executive';
    if (isHighLevel || profile?.branch === 'HQ') {
      return 'ALL';
    }
    return profile?.branch || 'ALL';
  });
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

  const loadOrders = useCallback(async () => {
    try {
      setLoading(true);
      const data = await ordersService.getAll();
      setOrders(data);
    } catch (error) {
      console.error('Error loading orders:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, branchFilter]);

  // สถานะที่ใช้แสดงผลบน UI (คำนวณจาก orders.status + trip_status + delivery_trip_id)
  const getEffectiveStatus = (order: Order): string => {
    const baseStatus = (order.status || '').toLowerCase();
    const tripStatus = order.trip_status || null;
    const hasTrip = !!order.delivery_trip_id;

    // ยกเลิก = จบนัด
    if (baseStatus === 'cancelled') return 'cancelled';

    // ถ้ายังไม่ได้ผูกทริป
    if (!hasTrip) {
      if (baseStatus === 'delivered' || baseStatus === 'partial') return baseStatus;
      // pending/confirmed/assigned ที่ไม่มีทริป → รอจัดทริป
      return 'pending';
    }

    // มีทริปแล้ว → ใช้สถานะทริปเป็นหลักในการบอก "กำหนดทริปแล้ว / กำลังจัดส่ง / ส่งเสร็จแล้ว"
    switch (tripStatus) {
      case 'planned':
        return 'assigned';
      case 'in_progress':
        return 'in_delivery';
      case 'completed':
        // ถ้า DB คำนวณ delivered/partial ไว้แล้ว ให้ใช้ผลนั้น
        if (baseStatus === 'delivered' || baseStatus === 'partial') return baseStatus;
        // กันกรณี trigger/RPC พลาด แต่ทริปถูกปิดแล้ว → ถือว่าส่งเสร็จ
        return 'delivered';
      case 'cancelled':
        // ทริปถูกยกเลิก แต่ order ยังผูกทริปไว้ → ให้กลับไปมองเป็น "รอจัดทริป"
        return 'pending';
      default:
        // ไม่รู้สถานะทริป → ถ้า DB มีสถานะที่รู้จักให้ใช้ต่อ, ไม่งั้นถือว่ารอจัดทริป
        if (['pending', 'confirmed', 'assigned', 'in_delivery', 'delivered', 'partial'].includes(baseStatus)) {
          return baseStatus;
        }
        return 'pending';
    }
  };

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

      // Search filter
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        if (
          !order.order_number?.toLowerCase().includes(search) &&
          !order.customer_name?.toLowerCase().includes(search) &&
          !order.customer_code?.toLowerCase().includes(search)
        ) {
          return false;
        }
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
      if (branchFilter && branchFilter !== 'ALL') {
        if (order.branch !== branchFilter) {
          return false;
        }
      }

      return true;
    });
  }, [orders, searchTerm, statusFilter, branchFilter]);

  const offset = (currentPage - 1) * itemsPerPage;
  const paginatedOrders = useMemo(
    () => filteredOrders.slice(offset, offset + itemsPerPage),
    [filteredOrders, offset, itemsPerPage]
  );
  const totalPages = Math.ceil(filteredOrders.length / itemsPerPage) || 1;
  const startIndex = offset;
  const endIndex = Math.min(offset + itemsPerPage, filteredOrders.length);

  const getStatusBadge = (order: Order) => {
    const status = getEffectiveStatus(order);
    const deliveryTripId = order.delivery_trip_id;
    
    // ถ้า delivery_trip_id เป็น null แล้ว ไม่ควรแสดง "กำหนดทริปแล้ว" แม้ว่า status จะเป็น 'assigned' ก็ตาม
    // (กรณีที่ลบทริปแล้วแต่ status ยังไม่ถูกอัปเดต)
    if (status === 'assigned' && !deliveryTripId) {
      return <Badge variant="warning">รอจัดทริป</Badge>;
    }
    
    switch (status) {
      case 'pending':
        return <Badge variant="warning">รอจัดทริป</Badge>;
      case 'partial':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300 border border-orange-200 dark:border-orange-700">
            ⏳ ส่งบางส่วน
          </span>
        );
      case 'assigned':
        return <Badge variant="info">กำหนดทริปแล้ว</Badge>;
      case 'in_delivery':
        return <Badge variant="default">กำลังจัดส่ง</Badge>;
      case 'delivered':
        return !deliveryTripId ? (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-700">
            ✓ จัดส่งสำเร็จ มารับเอง
          </span>
        ) : (
          <Badge variant="success">จัดส่งแล้ว</Badge>
        );
      case 'cancelled':
        return <Badge variant="error">ยกเลิก</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

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
        statusFilter={statusFilter}
        onStatusChange={setStatusFilter}
        onRefresh={loadOrders}
        loading={loading}
        profile={profile}
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

