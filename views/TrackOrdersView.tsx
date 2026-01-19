import React, { useState, useMemo } from 'react';
import { Package, Search, Filter, Clock, CheckCircle, Truck, Eye, Edit } from 'lucide-react';
import { PageLayout } from '../components/ui/PageLayout';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { ordersService, orderItemsService } from '../services/ordersService';
import { Modal } from '../components/ui/Modal';
import { EditOrderView } from './EditOrderView';

interface Order {
  id: string;
  order_number: string;
  customer_name: string;
  customer_code: string;
  total_amount: number;
  created_at: string;
  status: string;
  store_id: string;
  delivery_date?: string | null;
}

export function TrackOrdersView() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [detailOrder, setDetailOrder] = useState<any | null>(null);
  const [detailItems, setDetailItems] = useState<any[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);

  React.useEffect(() => {
    loadOrders();
  }, []);

  const loadOrders = async () => {
    try {
      setLoading(true);
      // Get all orders (not just pending)
      const data = await ordersService.getAll();
      setOrders(data);
    } catch (error) {
      console.error('Error loading orders:', error);
    } finally {
      setLoading(false);
    }
  };

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
      if (statusFilter !== 'all' && order.status !== statusFilter) {
        return false;
      }

      return true;
    });
  }, [orders, searchTerm, statusFilter]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="warning">รอจัดทริป</Badge>;
      case 'assigned':
        return <Badge variant="info">กำหนดทริปแล้ว</Badge>;
      case 'in_transit':
        return <Badge variant="default">กำลังจัดส่ง</Badge>;
      case 'delivered':
        return <Badge variant="success">จัดส่งแล้ว</Badge>;
      case 'cancelled':
        return <Badge variant="error">ยกเลิก</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const stats = useMemo(() => {
    return {
      total: filteredOrders.length,
      pending: filteredOrders.filter((o) => o.status === 'pending').length,
      assigned: filteredOrders.filter((o) => o.status === 'assigned').length,
      in_transit: filteredOrders.filter((o) => o.status === 'in_transit').length,
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

            {/* Status Filter */}
            <div className="w-full md:w-48">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
              >
                <option value="all">ทุกสถานะ</option>
                <option value="pending">รอจัดทริป</option>
                <option value="assigned">กำหนดทริปแล้ว</option>
                <option value="in_transit">กำลังจัดส่ง</option>
                <option value="delivered">จัดส่งแล้ว</option>
                <option value="cancelled">ยกเลิก</option>
              </select>
            </div>
          </div>
        </div>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
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
        <Card>
          <div className="p-4 text-center">
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.assigned}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">กำหนดทริปแล้ว</div>
          </div>
        </Card>
        <Card>
          <div className="p-4 text-center">
            <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">{stats.in_transit}</div>
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
                {filteredOrders.map((order) => (
                  <tr key={order.id} className="border-b border-gray-100 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700/50">
                    <td className="py-3 px-4 font-mono text-sm text-blue-600 dark:text-blue-400">{order.order_number}</td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-gray-900 dark:text-white">{order.customer_name}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">{order.customer_code}</div>
                    </td>
                    <td className="py-3 px-4 text-right font-semibold text-gray-900 dark:text-white">
                      ฿{order.total_amount.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-center">{getStatusBadge(order.status)}</td>
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
        )}
      </Card>

      {/* Order Detail Modal */}
      <Modal
        isOpen={!!detailOrder}
        onClose={closeDetail}
        title={`รายละเอียดออเดอร์ ${detailOrder?.order_number || ''}`}
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

            <div className="border border-gray-200 dark:border-slate-700 rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-slate-800/50">
                  <tr>
                    <th className="text-left py-2 px-3 text-sm font-semibold text-gray-700 dark:text-gray-300">สินค้า</th>
                    <th className="text-right py-2 px-3 text-sm font-semibold text-gray-700 dark:text-gray-300">จำนวน</th>
                    <th className="text-right py-2 px-3 text-sm font-semibold text-gray-700 dark:text-gray-300">ราคาต่อหน่วย</th>
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
                    detailItems.map((item: any) => (
                      <tr key={item.id} className="border-t border-gray-100 dark:border-slate-700">
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
                    ))
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

