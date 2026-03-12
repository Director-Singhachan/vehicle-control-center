import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Package, Search, Clock, CheckCircle, Eye, Edit, ChevronLeft, ChevronRight, Building2, ShoppingBag, RefreshCw } from 'lucide-react';
import { PageLayout } from '../components/ui/PageLayout';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { ordersService, orderItemsService } from '../services/ordersService';
import { Modal } from '../components/ui/Modal';
import { EditOrderView } from './EditOrderView';
import { useAuth } from '../hooks/useAuth';
import { BRANCH_FILTER_OPTIONS, getBranchLabel } from '../utils/branchLabels';

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
          // สำหรับ 'assigned' ต้องตรวจสอบทั้ง status และ delivery_trip_id
          if (order.status !== 'assigned' || !order.delivery_trip_id) {
            return false;
          }
        } else if (statusFilter === 'pending') {
          // สำหรับ 'pending' รวมถึงออเดอร์ที่ status เป็น 'assigned' แต่ไม่มี delivery_trip_id (ลบทริปแล้ว)
          if (order.status !== 'pending' && order.status !== 'confirmed' && !(order.status === 'assigned' && !order.delivery_trip_id)) {
            return false;
          }
        } else {
          if (order.status !== statusFilter) {
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
    const status = order.status;
    const deliveryTripId = order.delivery_trip_id;
    
    // ถ้า delivery_trip_id เป็น null แล้ว ไม่ควรแสดง "กำหนดทริปแล้ว" แม้ว่า status จะเป็น 'assigned' ก็ตาม
    // (กรณีที่ลบทริปแล้วแต่ status ยังไม่ถูกอัปเดต)
    if (status === 'assigned' && !deliveryTripId) {
      return <Badge variant="warning">รอจัดทริป</Badge>;
    }
    
    switch (status) {
      case 'pending':
      case 'confirmed':
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
      pending: filteredOrders.filter((o) => o.status === 'pending' || o.status === 'confirmed' || (o.status === 'assigned' && !o.delivery_trip_id)).length,
      partial: filteredOrders.filter((o) => o.status === 'partial').length,
      assigned: filteredOrders.filter((o) => o.status === 'assigned' && o.delivery_trip_id).length,
      in_delivery: filteredOrders.filter((o) => o.status === 'in_delivery').length,
      delivered: filteredOrders.filter((o) => o.status === 'delivered').length,
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
      {/* Filters */}
      <Card className="mb-4">
        <div className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 w-5 h-5" />
                <input
                  type="text"
                  placeholder="ค้นหาเลขออเดอร์, ร้านค้า..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                />
              </div>
            </div>

            {/* Branch Filter */}
            <div className="w-full md:w-48">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-gray-400 dark:text-gray-500 flex-shrink-0" />
                <select
                  value={branchFilter}
                  onChange={(e) => setBranchFilter(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={!(profile?.role === 'admin' || profile?.role === 'manager' || profile?.role === 'inspector' || profile?.role === 'executive' || profile?.branch === 'HQ')}
                >
                  {(profile?.role === 'admin' || profile?.role === 'manager' || profile?.role === 'inspector' || profile?.role === 'executive' || profile?.branch === 'HQ') ? (
                    BRANCH_FILTER_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))
                  ) : (
                    <option value="SD">{getBranchLabel('SD')}</option>
                  )}
                </select>
              </div>
            </div>

            {/* Status Filter */}
            <div className="w-full md:w-48">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
              >
                <option value="all">ทุกสถานะ</option>
                <option value="pending">รอจัดทริป</option>
                <option value="partial">ส่งบางส่วน</option>
                <option value="assigned">กำหนดทริปแล้ว</option>
                <option value="in_delivery">กำลังจัดส่ง</option>
                <option value="delivered">จัดส่งแล้ว</option>
                <option value="cancelled">ยกเลิก</option>
              </select>
            </div>

            {/* รีเฟรช — หลังลงเลขไมล์ขากลับ/ปิดทริป ให้กดเพื่ออัปเดตสถานะออเดอร์ */}
            <Button
              type="button"
              variant="outline"
              size="default"
              onClick={() => loadOrders()}
              disabled={loading}
              className="flex items-center gap-2 shrink-0"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              รีเฟรช
            </Button>
          </div>
        </div>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-4">
        <Card>
          <div className="p-4 text-center">
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats.total}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">ทั้งหมด</div>
          </div>
        </Card>
        <Card>
          <div className="p-4 text-center">
            <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{stats.pending}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">รอจัดทริป</div>
          </div>
        </Card>
        {/* Partial — ใหม่! */}
        {stats.partial > 0 && (
          <Card className="ring-2 ring-orange-300 dark:ring-orange-700">
            <div className="p-4 text-center">
              <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">{stats.partial}</div>
              <div className="text-sm text-orange-700 dark:text-orange-300 font-medium">⏳ ส่งบางส่วน</div>
            </div>
          </Card>
        )}
        <Card>
          <div className="p-4 text-center">
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.assigned}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">กำหนดทริปแล้ว</div>
          </div>
        </Card>
        <Card>
          <div className="p-4 text-center">
            <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">{stats.in_delivery}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">กำลังจัดส่ง</div>
          </div>
        </Card>
        <Card>
          <div className="p-4 text-center">
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.delivered}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">จัดส่งแล้ว</div>
          </div>
        </Card>
      </div>

      {/* Orders List */}
      <Card>
        {loading ? (
          <div className="p-12 flex items-center justify-center">
            <LoadingSpinner />
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="p-12 text-center text-gray-500 dark:text-gray-400">
            <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>ไม่พบออเดอร์</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">เลขออเดอร์</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">ร้านค้า</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">ยอดรวม</th>
                    <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">สถานะ</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">วันที่นัดส่ง</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">วันที่สร้าง</th>
                    <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">จัดการ</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedOrders.map((order) => (
                    <tr key={order.id} className={`border-b border-gray-100 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700/50 ${order.status === 'partial' ? 'bg-orange-50/30 dark:bg-orange-900/10' : ''}`}>
                      <td className="py-3 px-4 font-mono text-sm text-blue-600 dark:text-blue-400">
                        <div>{order.order_number || <span className="text-amber-600 dark:text-amber-400">รอจัดทริป</span>}</div>
                        {order.status === 'partial' && (
                          <div className="text-xs text-orange-600 dark:text-orange-400 font-normal mt-0.5">
                            รอจัดส่งส่วนที่เหลือ
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-gray-900 dark:text-white">{order.customer_name}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">{order.customer_code}</div>
                      </td>
                      <td className="py-3 px-4 text-right font-semibold text-gray-900 dark:text-white">
                        ฿{order.total_amount.toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-center">{getStatusBadge(order)}</td>
                      <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400">
                        {order.delivery_date
                          ? new Date(order.delivery_date).toLocaleDateString('th-TH', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })
                          : '-'}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400">
                        {new Date(order.created_at).toLocaleDateString('th-TH', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <Button size="sm" variant="outline" onClick={() => openDetail(order)}>
                            <Eye className="w-4 h-4 mr-1" />
                            ดู
                          </Button>
                          {(order.status === 'pending' || order.status === 'confirmed' || order.status === 'assigned') && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setEditingOrderId(order.id)}
                              className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                            >
                              <Edit className="w-4 h-4 mr-1" />
                              แก้ไข
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination - 100 รายการต่อหน้า ตามมาตรฐานหน้าอื่น */}
            {totalPages > 1 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-4 py-4 border-t border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/30">
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  แสดง {startIndex + 1} - {endIndex} จาก {filteredOrders.length.toLocaleString('th-TH')} รายการ
                </div>

                <div className="flex items-center gap-2 flex-wrap justify-center">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="flex items-center gap-1"
                  >
                    <ChevronLeft size={16} />
                    ก่อนหน้า
                  </Button>

                  <div className="flex items-center gap-1 flex-wrap">
                    {(() => {
                      const pages: (number | string)[] = [];
                      if (totalPages <= 7) {
                        for (let i = 1; i <= totalPages; i++) pages.push(i);
                      } else {
                        pages.push(1);
                        const startPage = Math.max(2, currentPage - 2);
                        const endPage = Math.min(totalPages - 1, currentPage + 2);
                        if (startPage > 2) pages.push('ellipsis-start');
                        for (let i = startPage; i <= endPage; i++) {
                          if (i !== 1 && i !== totalPages) pages.push(i);
                        }
                        if (endPage < totalPages - 1) pages.push('ellipsis-end');
                        pages.push(totalPages);
                      }
                      return pages.map((page) => {
                        if (typeof page === 'string') {
                          return <span key={page} className="px-2 text-gray-400 dark:text-slate-500">...</span>;
                        }
                        return (
                          <button
                            key={page}
                            onClick={() => setCurrentPage(page)}
                            className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${currentPage === page
                              ? 'bg-enterprise-600 text-white'
                              : 'bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-700'
                              }`}
                          >
                            {page.toLocaleString('th-TH')}
                          </button>
                        );
                      });
                    })()}
                  </div>

                  {totalPages > 10 && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600 dark:text-gray-400">ไปที่หน้า:</span>
                      <input
                        type="number"
                        min={1}
                        max={totalPages}
                        value={pageInput}
                        onChange={(e) => setPageInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            const page = parseInt(pageInput, 10);
                            if (page >= 1 && page <= totalPages) {
                              setCurrentPage(page);
                              setPageInput('');
                            }
                          }
                        }}
                        placeholder={`1-${totalPages}`}
                        className="w-20 px-2 py-1 text-sm border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const page = parseInt(pageInput, 10);
                          if (page >= 1 && page <= totalPages) {
                            setCurrentPage(page);
                            setPageInput('');
                          }
                        }}
                      >
                        ไป
                      </Button>
                    </div>
                  )}

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                    className="flex items-center gap-1"
                  >
                    ถัดไป
                    <ChevronRight size={16} />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>

      {/* Order Detail Modal */}
      <Modal
        isOpen={!!detailOrder}
        onClose={closeDetail}
        title={`รายละเอียดออเดอร์ ${detailOrder?.order_number || (detailOrder ? 'รอจัดทริป' : '')}`}
        size="large"
      >
        {detailLoading ? (
          <div className="flex items-center justify-center py-12">
            <LoadingSpinner />
          </div>
        ) : detailError ? (
          <div className="text-red-600 dark:text-red-400">{detailError}</div>
        ) : detailOrder ? (
          <div className="space-y-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div>
                <div className="text-sm text-gray-500 dark:text-gray-400">ร้านค้า</div>
                <div className="text-lg font-semibold text-gray-900 dark:text-white">
                  {detailOrder.customer_name}
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">{detailOrder.customer_code}</div>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                {getStatusBadge(detailOrder.status)}
                <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                  <div>
                    วันที่สร้าง:{' '}
                    {new Date(detailOrder.created_at).toLocaleDateString('th-TH', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                  {detailOrder.delivery_date && (
                    <div>
                      วันที่ลูกค้านัดส่ง:{' '}
                      {new Date(detailOrder.delivery_date).toLocaleDateString('th-TH', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </div>
                  )}
                </div>
                <div className="text-sm font-semibold text-gray-900 dark:text-white">
                  ยอดรวม ฿{detailOrder.total_amount?.toLocaleString()}
                </div>
              </div>
            </div>

            {detailSummary && (
              <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-sm text-blue-900 dark:text-blue-100">
                <div className="font-semibold mb-1">สรุปจำนวนรวมทุกสินค้าในออเดอร์นี้</div>
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  <span>สั่งทั้งหมด {detailSummary.ordered.toLocaleString()} ชิ้น</span>
                  <span>รับที่ร้าน {detailSummary.pickedUp.toLocaleString()} ชิ้น</span>
                  <span>ส่งแล้ว {detailSummary.delivered.toLocaleString()} ชิ้น</span>
                  <span>คงเหลือ {detailSummary.remaining.toLocaleString()} ชิ้น</span>
                </div>
              </div>
            )}

            <div className="border border-gray-200 dark:border-slate-700 rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-slate-800/50">
                  <tr>
                    <th className="text-left py-2 px-3 text-sm font-semibold text-gray-700 dark:text-gray-300">สินค้า</th>
                    <th className="text-right py-2 px-3 text-sm font-semibold text-gray-700 dark:text-gray-300">จำนวนสั่ง</th>
                    <th className="text-right py-2 px-3 text-sm font-semibold text-amber-600 dark:text-amber-400" title="ลูกค้ามารับที่ร้านแล้ว">
                      🏪 รับที่ร้าน
                    </th>
                    <th className="text-right py-2 px-3 text-sm font-semibold text-green-600 dark:text-green-400" title="การจัดส่งจากทริป">
                      ✅ ส่งแล้ว
                    </th>
                    <th className="text-right py-2 px-3 text-sm font-semibold text-gray-700 dark:text-gray-300">ราคา/หน่วย</th>
                    <th className="text-right py-2 px-3 text-sm font-semibold text-gray-700 dark:text-gray-300">ส่วนลด (%)</th>
                    <th className="text-right py-2 px-3 text-sm font-semibold text-gray-700 dark:text-gray-300">รวมบรรทัด</th>
                  </tr>
                </thead>
                <tbody>
                  {detailItems.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-4 text-gray-500 dark:text-gray-400">
                        ไม่มีรายการสินค้า
                      </td>
                    </tr>
                  ) : (
                    detailItems.map((item: any) => {
                      const pickedUp = Number(item.quantity_picked_up_at_store ?? 0);
                      const delivered = Number(item.quantity_delivered ?? 0);
                      const hasPickupOrDelivery = pickedUp > 0 || delivered > 0;
                      return (
                        <tr key={item.id} className={`border-t border-gray-100 dark:border-slate-700 ${hasPickupOrDelivery ? 'bg-amber-50/30 dark:bg-amber-900/10' : ''}`}>
                          <td className="py-2 px-3">
                            <div className="font-medium text-gray-900 dark:text-white">
                              {item.product?.product_name || 'ไม่ระบุชื่อสินค้า'}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              {item.product?.product_code || '-'}
                            </div>
                          </td>
                          <td className="py-2 px-3 text-right text-gray-900 dark:text-white">
                            {item.quantity?.toLocaleString()} {item.product?.unit || ''}
                          </td>
                          {/* 🏪 รับที่ร้าน */}
                          <td className="py-2 px-3 text-right">
                            {pickedUp > 0 ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300">
                                {pickedUp.toLocaleString()} {item.product?.unit || ''}
                              </span>
                            ) : (
                              <span className="text-gray-300 dark:text-gray-600">—</span>
                            )}
                          </td>
                          {/* ✅ ส่งแล้ว */}
                          <td className="py-2 px-3 text-right">
                            {delivered > 0 ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300">
                                {delivered.toLocaleString()} {item.product?.unit || ''}
                              </span>
                            ) : (
                              <span className="text-gray-300 dark:text-gray-600">—</span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-right text-gray-900 dark:text-white">
                            ฿{item.unit_price?.toLocaleString()}
                          </td>
                          <td className="py-2 px-3 text-right text-gray-900 dark:text-white">
                            {item.discount_percent || 0}%
                          </td>
                          <td className="py-2 px-3 text-right font-semibold text-gray-900 dark:text-white">
                            ฿{item.line_total?.toLocaleString()}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </Modal>

      {/* Info Message */}
      <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
        <div className="flex items-start gap-3">
          <Clock className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
          <div>
            <div className="font-medium text-blue-900 dark:text-blue-300">หมายเหตุ</div>
            <div className="text-sm text-blue-700 dark:text-blue-300">
              หน้านี้สำหรับติดตามสถานะออเดอร์เท่านั้น การสร้างทริปจัดส่งจะทำได้ที่เมนู "ทริปส่งสินค้า" เท่านั้น
            </div>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}

