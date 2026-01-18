import React, { useState, useMemo, useEffect } from 'react';
import { Trash2, Search, Filter, Calendar, AlertTriangle, CheckCircle, Package, X } from 'lucide-react';
import { ordersService } from '../services/ordersService';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { PageLayout } from '../components/ui/PageLayout';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { ToastContainer } from '../components/ui/Toast';
import { useAuth, useToast } from '../hooks';

interface Order {
  id: string;
  order_number: string | null;
  order_date: string;
  status: string;
  total_amount: number | null;
  created_at: string;
  customer_name?: string;
  customer_code?: string;
  delivery_trip_id?: string | null;
}

export function CleanupTestOrdersView() {
  const { user, isAdmin, isManager } = useAuth();
  const { toasts, success, error: showError, warning, dismissToast } = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showWithoutNumber, setShowWithoutNumber] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteMode, setDeleteMode] = useState<'selected' | 'all' | 'without_number' | 'date_range'>('selected');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // ตรวจสอบสิทธิ์
  const canDelete = isAdmin || isManager;

  // โหลดข้อมูลออเดอร์
  useEffect(() => {
    loadOrders();
  }, []);

  const loadOrders = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await ordersService.getAll();
      setOrders(data || []);
    } catch (err: any) {
      setError(err.message || 'เกิดข้อผิดพลาดในการโหลดข้อมูล');
      console.error('Error loading orders:', err);
    } finally {
      setLoading(false);
    }
  };

  // กรองข้อมูล
  const filteredOrders = useMemo(() => {
    let filtered = orders;

    // กรองตาม search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (order) =>
          order.order_number?.toLowerCase().includes(query) ||
          order.customer_name?.toLowerCase().includes(query) ||
          order.customer_code?.toLowerCase().includes(query)
      );
    }

    // กรองตามวันที่
    if (dateFilter) {
      filtered = filtered.filter((order) => order.order_date === dateFilter);
    }

    // กรองตามสถานะ
    if (statusFilter !== 'all') {
      filtered = filtered.filter((order) => order.status === statusFilter);
    }

    // กรองออเดอร์ที่ไม่มี order_number
    if (showWithoutNumber) {
      filtered = filtered.filter((order) => !order.order_number || order.order_number === '');
    }

    return filtered;
  }, [orders, searchQuery, dateFilter, statusFilter, showWithoutNumber]);

  // Toggle selection
  const toggleOrderSelection = (orderId: string) => {
    const order = orders.find((o) => o.id === orderId);
    if (order && isOrderAssignedToTrip(order)) {
      // ไม่สามารถเลือกออเดอร์ที่ถูกกำหนดทริปแล้ว
      return;
    }
    const newSelected = new Set(selectedOrders);
    if (newSelected.has(orderId)) {
      newSelected.delete(orderId);
    } else {
      newSelected.add(orderId);
    }
    setSelectedOrders(newSelected);
  };

  const toggleSelectAll = () => {
    // กรองออเดอร์ที่สามารถเลือกได้ (ไม่ถูกกำหนดทริป)
    const selectableOrders = filteredOrders.filter((o) => !isOrderAssignedToTrip(o));
    
    if (selectedOrders.size === selectableOrders.length && selectableOrders.length > 0) {
      setSelectedOrders(new Set());
    } else {
      setSelectedOrders(new Set(selectableOrders.map((o) => o.id)));
    }
  };

  // ตรวจสอบว่าออเดอร์ถูกกำหนดทริปแล้วหรือไม่
  const isOrderAssignedToTrip = (order: Order): boolean => {
    return !!(order.delivery_trip_id || order.status === 'assigned');
  };

  // ลบออเดอร์
  const handleDelete = async () => {
    if (!canDelete) {
      showError('คุณไม่มีสิทธิ์ในการลบออเดอร์');
      return;
    }

    setIsDeleting(true);
    try {
      let orderIdsToDelete: string[] = [];
      let allOrderIds: string[] = [];

      if (deleteMode === 'selected' && selectedOrders.size > 0) {
        // ลบออเดอร์ที่เลือก
        allOrderIds = Array.from(selectedOrders);
      } else if (deleteMode === 'all') {
        // ลบทั้งหมดที่กรอง
        allOrderIds = filteredOrders.map((o) => o.id);
      } else if (deleteMode === 'without_number') {
        // ลบออเดอร์ที่ไม่มี order_number
        allOrderIds = filteredOrders
          .filter((o) => !o.order_number || o.order_number === '')
          .map((o) => o.id);
      } else if (deleteMode === 'date_range' && dateFrom && dateTo) {
        // ลบตามช่วงวันที่
        allOrderIds = filteredOrders
          .filter((o) => o.order_date >= dateFrom && o.order_date <= dateTo)
          .map((o) => o.id);
      }

      // กรองออเดอร์ที่ถูกกำหนดทริปแล้วออก
      const ordersToCheck = orders.filter((o) => allOrderIds.includes(o.id));
      const assignedOrders = ordersToCheck.filter((o) => isOrderAssignedToTrip(o));
      orderIdsToDelete = allOrderIds.filter((id) => {
        const order = orders.find((o) => o.id === id);
        return order && !isOrderAssignedToTrip(order);
      });

      if (assignedOrders.length > 0) {
        const assignedNumbers = assignedOrders
          .map((o) => o.order_number || o.id.substring(0, 8))
          .join(', ');
        warning(
          `ไม่สามารถลบออเดอร์ที่ถูกกำหนดทริปแล้วได้ (${assignedOrders.length} รายการ)\nออเดอร์ที่สามารถลบได้: ${orderIdsToDelete.length} รายการ`,
          8000
        );
      }

      if (orderIdsToDelete.length === 0) {
        if (assignedOrders.length > 0) {
          warning('ไม่มีออเดอร์ที่สามารถลบได้ (ออเดอร์ทั้งหมดถูกกำหนดทริปแล้ว)');
        } else {
          warning('ไม่มีออเดอร์ที่ต้องการลบ');
        }
        setIsDeleting(false);
        return;
      }

      // ลบออเดอร์หลายรายการพร้อมกัน
      const deletedOrders = await ordersService.deleteMany(orderIdsToDelete);

      if (!deletedOrders || deletedOrders.length === 0) {
        showError('ไม่สามารถลบออเดอร์ได้ (อาจไม่มีสิทธิ์หรือออเดอร์ถูกกำหนดทริปแล้ว)');
        setIsDeleting(false);
        return;
      }

      if (assignedOrders.length > 0) {
        success(
          `ลบออเดอร์เรียบร้อย: ${deletedOrders.length} รายการ\nข้ามออเดอร์ที่ถูกกำหนดทริปแล้ว: ${assignedOrders.length} รายการ`,
          6000
        );
      } else {
        success(`ลบออเดอร์เรียบร้อย: ${deletedOrders.length} รายการ`);
      }
      setSelectedOrders(new Set());
      setDeleteConfirmOpen(false);
      await loadOrders();
    } catch (err: any) {
      console.error('Error deleting orders:', err);
      const errorMessage = err.message || 'เกิดข้อผิดพลาดในการลบออเดอร์';
      showError(
        `${errorMessage}\nกรุณาตรวจสอบ:\n- สิทธิ์การลบ (ต้องเป็น Admin/Manager)\n- ออเดอร์ที่เลือกไม่ถูกกำหนดทริปแล้ว`,
        8000
      );
    } finally {
      setIsDeleting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; variant: 'default' | 'success' | 'warning' | 'error' | 'info' }> = {
      pending: { label: 'รออนุมัติ', variant: 'warning' },
      confirmed: { label: 'ยืนยันแล้ว', variant: 'info' },
      assigned: { label: 'จัดทริปแล้ว', variant: 'info' },
      in_delivery: { label: 'กำลังส่ง', variant: 'warning' },
      delivered: { label: 'ส่งแล้ว', variant: 'success' },
      cancelled: { label: 'ยกเลิก', variant: 'error' },
    };

    const statusInfo = statusMap[status] || { label: status, variant: 'default' as const };
    return <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>;
  };

  if (!canDelete) {
    return (
      <PageLayout title="จัดการออเดอร์">
        <Card>
          <div className="p-12 text-center">
            <AlertTriangle className="w-16 h-16 mx-auto mb-4 text-red-500" />
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              ไม่มีสิทธิ์เข้าถึง
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              คุณต้องมีสิทธิ์ Admin หรือ Manager เพื่อเข้าถึงหน้านี้
            </p>
          </div>
        </Card>
      </PageLayout>
    );
  }

  return (
    <>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <PageLayout title="จัดการออเดอร์">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <div className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">ออเดอร์ทั้งหมด</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{orders.length}</p>
              </div>
              <Package className="w-10 h-10 text-blue-500 opacity-50" />
            </div>
          </div>
        </Card>

        <Card>
          <div className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">ที่เลือกแล้ว</p>
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {selectedOrders.size}
                </p>
              </div>
              <CheckCircle className="w-10 h-10 text-blue-500 opacity-50" />
            </div>
          </div>
        </Card>

        <Card>
          <div className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">ไม่มีเลขกำกับ</p>
                <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                  {orders.filter((o) => !o.order_number || o.order_number === '').length}
                </p>
              </div>
              <AlertTriangle className="w-10 h-10 text-orange-500 opacity-50" />
            </div>
          </div>
        </Card>

        <Card>
          <div className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">ผลลัพธ์ที่กรอง</p>
                <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                  {filteredOrders.length}
                </p>
              </div>
              <Filter className="w-10 h-10 text-purple-500 opacity-50" />
            </div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <div className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            <Filter className="w-5 h-5 inline mr-2" />
            กรองข้อมูล
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Search */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                <Search className="w-4 h-4 inline mr-1" />
                ค้นหา
              </label>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="เลขที่ออเดอร์, ชื่อลูกค้า..."
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Date Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                <Calendar className="w-4 h-4 inline mr-1" />
                วันที่ออเดอร์
              </label>
              <input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Status Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                สถานะ
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">ทั้งหมด</option>
                <option value="pending">รออนุมัติ</option>
                <option value="confirmed">ยืนยันแล้ว</option>
                <option value="assigned">จัดทริปแล้ว</option>
                <option value="in_delivery">กำลังส่ง</option>
                <option value="delivered">ส่งแล้ว</option>
                <option value="cancelled">ยกเลิก</option>
              </select>
            </div>

            {/* Show Without Number */}
            <div className="flex items-end">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showWithoutNumber}
                  onChange={(e) => setShowWithoutNumber(e.target.checked)}
                  className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  แสดงเฉพาะที่ไม่มีเลขกำกับ
                </span>
              </label>
            </div>
          </div>
        </div>
      </Card>

      {/* Actions */}
      <Card className="mb-6">
        <div className="p-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                size="sm"
                onClick={toggleSelectAll}
                disabled={filteredOrders.length === 0}
              >
                {selectedOrders.size === filteredOrders.length ? 'ยกเลิกเลือกทั้งหมด' : 'เลือกทั้งหมด'}
              </Button>
              <span className="text-sm text-gray-600 dark:text-gray-400">
                เลือกแล้ว: {selectedOrders.size} / {filteredOrders.length}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setDeleteMode('selected');
                  if (selectedOrders.size === 0) {
                    warning('กรุณาเลือกออเดอร์ที่ต้องการลบ');
                    return;
                  }
                  setDeleteConfirmOpen(true);
                }}
                disabled={selectedOrders.size === 0 || isDeleting}
              >
                <Trash2 className="w-4 h-4 mr-1" />
                ลบที่เลือก ({selectedOrders.size})
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setDeleteMode('without_number');
                  const count = filteredOrders.filter((o) => !o.order_number || o.order_number === '').length;
                  if (count === 0) {
                    warning('ไม่มีออเดอร์ที่ไม่มีเลขกำกับ');
                    return;
                  }
                  setDeleteConfirmOpen(true);
                }}
                disabled={isDeleting}
              >
                <Trash2 className="w-4 h-4 mr-1" />
                ลบที่ไม่มีเลขกำกับ
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setDeleteMode('all');
                  if (filteredOrders.length === 0) {
                    warning('ไม่มีออเดอร์ที่ต้องการลบ');
                    return;
                  }
                  setDeleteConfirmOpen(true);
                }}
                disabled={filteredOrders.length === 0 || isDeleting}
              >
                <Trash2 className="w-4 h-4 mr-1" />
                ลบทั้งหมดที่กรอง ({filteredOrders.length})
              </Button>
            </div>
          </div>

          {/* Date Range Delete */}
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-slate-700">
            <div className="flex items-center gap-4 flex-wrap">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                ลบตามช่วงวันที่:
              </span>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                placeholder="จากวันที่"
                className="px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-gray-600 dark:text-gray-400">ถึง</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                placeholder="ถึงวันที่"
                className="px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (!dateFrom || !dateTo) {
                    warning('กรุณาเลือกช่วงวันที่');
                    return;
                  }
                  setDeleteMode('date_range');
                  const count = filteredOrders.filter(
                    (o) => o.order_date >= dateFrom && o.order_date <= dateTo
                  ).length;
                  if (count === 0) {
                    warning('ไม่มีออเดอร์ในช่วงวันที่ที่เลือก');
                    return;
                  }
                  setDeleteConfirmOpen(true);
                }}
                disabled={!dateFrom || !dateTo || isDeleting}
              >
                <Trash2 className="w-4 h-4 mr-1" />
                ลบตามช่วงวันที่
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Orders List */}
      {loading ? (
        <Card>
          <div className="p-12 text-center">
            <LoadingSpinner />
            <p className="mt-4 text-gray-600 dark:text-gray-400">กำลังโหลดข้อมูล...</p>
          </div>
        </Card>
      ) : error ? (
        <Card>
          <div className="p-12 text-center">
            <AlertTriangle className="w-16 h-16 mx-auto mb-4 text-red-500" />
            <p className="text-red-600 dark:text-red-400">{error}</p>
            <Button variant="outline" onClick={loadOrders} className="mt-4">
              ลองใหม่
            </Button>
          </div>
        </Card>
      ) : filteredOrders.length === 0 ? (
        <Card>
          <div className="p-12 text-center">
            <Package className="w-16 h-16 mx-auto mb-4 text-gray-400 opacity-50" />
            <p className="text-gray-600 dark:text-gray-400">ไม่พบออเดอร์ที่ตรงกับเงื่อนไข</p>
          </div>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-slate-700">
                  <th className="text-left py-3 px-4">
                    <input
                      type="checkbox"
                      checked={
                        (() => {
                          const selectableOrders = filteredOrders.filter((o) => !isOrderAssignedToTrip(o));
                          return selectedOrders.size === selectableOrders.length && selectableOrders.length > 0;
                        })()
                      }
                      onChange={toggleSelectAll}
                      className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
                    เลขที่ออเดอร์
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
                    ลูกค้า
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
                    วันที่ออเดอร์
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
                    สถานะ
                  </th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
                    ยอดรวม
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
                    วันที่สร้าง
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((order) => {
                  const isAssigned = isOrderAssignedToTrip(order);
                  return (
                    <tr
                      key={order.id}
                      className={`border-b border-gray-100 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800/50 ${
                        selectedOrders.has(order.id) ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                      } ${isAssigned ? 'opacity-60 bg-gray-50 dark:bg-slate-800/30' : ''}`}
                    >
                      <td className="py-3 px-4">
                        <input
                          type="checkbox"
                          checked={selectedOrders.has(order.id)}
                          onChange={() => toggleOrderSelection(order.id)}
                          disabled={isAssigned}
                          title={isAssigned ? 'ออเดอร์นี้ถูกกำหนดทริปแล้ว ไม่สามารถลบได้' : ''}
                          className={`w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 ${
                            isAssigned ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
                          }`}
                        />
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          {order.order_number ? (
                            <span className="font-mono text-sm font-semibold text-blue-600 dark:text-blue-400">
                              {order.order_number}
                            </span>
                          ) : (
                            <span className="text-sm text-gray-400 italic">ไม่มีเลขกำกับ</span>
                          )}
                          {isAssigned && (
                            <Badge variant="info" className="text-xs">
                              กำหนดทริปแล้ว
                            </Badge>
                          )}
                        </div>
                      </td>
                    <td className="py-3 px-4">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">
                          {order.customer_name || 'ไม่ระบุ'}
                        </p>
                        {order.customer_code && (
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {order.customer_code}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400">
                      {new Date(order.order_date).toLocaleDateString('th-TH', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </td>
                    <td className="py-3 px-4">{getStatusBadge(order.status)}</td>
                    <td className="py-3 px-4 text-right font-semibold text-gray-900 dark:text-white">
                      {order.total_amount
                        ? new Intl.NumberFormat('th-TH').format(order.total_amount)
                        : '0'}{' '}
                      ฿
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
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={deleteConfirmOpen}
        onCancel={() => setDeleteConfirmOpen(false)}
        onConfirm={handleDelete}
        title="ยืนยันการลบออเดอร์"
        message={
          deleteMode === 'selected'
            ? `คุณต้องการลบออเดอร์ที่เลือก ${selectedOrders.size} รายการ ใช่หรือไม่?\n\n⚠️ การลบนี้ไม่สามารถกู้คืนได้!`
            : deleteMode === 'all'
            ? `คุณต้องการลบออเดอร์ทั้งหมดที่กรอง ${filteredOrders.length} รายการ ใช่หรือไม่?\n\n⚠️ การลบนี้ไม่สามารถกู้คืนได้!`
            : deleteMode === 'without_number'
            ? `คุณต้องการลบออเดอร์ที่ไม่มีเลขกำกับทั้งหมด ใช่หรือไม่?\n\n⚠️ การลบนี้ไม่สามารถกู้คืนได้!`
            : `คุณต้องการลบออเดอร์ในช่วงวันที่ ${dateFrom} ถึง ${dateTo} ใช่หรือไม่?\n\n⚠️ การลบนี้ไม่สามารถกู้คืนได้!`
        }
        confirmText={isDeleting ? 'กำลังลบ...' : 'ลบ'}
        cancelText="ยกเลิก"
        variant="danger"
      />
    </PageLayout>
    </>
  );
}
