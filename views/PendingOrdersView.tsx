import React, { useState, useMemo, useEffect } from 'react';
import { Package, Calendar, MapPin, DollarSign, User, Phone, Filter, X, Zap, ChevronDown, ChevronRight, Eye, Box, Edit } from 'lucide-react';
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

export function PendingOrdersView() {
  const { orders, loading, error, refetch } = usePendingOrders();

  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [showCreateTrip, setShowCreateTrip] = useState(false);
  const [showQuickCreate, setShowQuickCreate] = useState(false);
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
  const [orderItems, setOrderItems] = useState<Map<string, any[]>>(new Map());
  const [showProductsSummaryModal, setShowProductsSummaryModal] = useState(false);
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);

  // Filter orders
  const filteredOrders = useMemo(() => {
    if (!orders) return [];

    return orders.filter((order: any) => {
      const matchesSearch = !searchQuery ||
        order.customer_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        order.customer_code?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        order.order_number?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesDate = !dateFilter || order.order_date === dateFilter;

      return matchesSearch && matchesDate;
    });
  }, [orders, searchQuery, dateFilter]);

  // Toggle order selection
  const toggleOrderSelection = (orderId: string) => {
    const newSelection = new Set(selectedOrders);
    if (newSelection.has(orderId)) {
      newSelection.delete(orderId);
    } else {
      newSelection.add(orderId);
    }
    setSelectedOrders(newSelection);
  };

  // Select all filtered orders
  const selectAll = () => {
    const allIds = new Set(filteredOrders.map((o: any) => o.id));
    setSelectedOrders(allIds);
  };

  // Clear selection
  const clearSelection = () => {
    setSelectedOrders(new Set());
  };

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

  // Toggle order details
  const toggleOrderDetails = async (orderId: string) => {
    const newExpanded = new Set(expandedOrders);
    if (newExpanded.has(orderId)) {
      newExpanded.delete(orderId);
    } else {
      newExpanded.add(orderId);

      // Fetch items if not already fetched
      if (!orderItems.has(orderId)) {
        try {
          const items = await orderItemsService.getByOrderId(orderId);
          setOrderItems(new Map(orderItems).set(orderId, items || []));
        } catch (error) {
          console.error(`Failed to fetch items for order ${orderId}:`, error);
        }
      }
    }
    setExpandedOrders(newExpanded);
  };

  // Handle create trip
  const handleCreateTrip = () => {
    if (selectedOrders.size === 0) {
      alert('กรุณาเลือกออเดอร์อย่างน้อย 1 รายการ');
      return;
    }
    setShowCreateTrip(true);
  };

  const handleTripCreated = () => {
    setShowCreateTrip(false);
    setSelectedOrders(new Set());
    refetch();
  };

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
                    {aggregatedProducts.reduce((sum, p) => sum + p.total_quantity, 0)} ชิ้น
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
                  }).format(
                    filteredOrders.reduce((sum: number, o: any) => sum + (o.total_amount || 0), 0)
                  )} ฿
                </p>
              </div>
              <DollarSign className="w-10 h-10 text-yellow-500 opacity-50" />
            </div>
          </div>
        </Card>
      </div>

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
                            <div className="bg-white rounded-lg p-3">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="border-b border-gray-300">
                                    <th className="text-left py-2 px-2 font-semibold text-gray-700">รหัสสินค้า</th>
                                    <th className="text-left py-2 px-2 font-semibold text-gray-700">ชื่อสินค้า</th>
                                    <th className="text-right py-2 px-2 font-semibold text-gray-700">จำนวน</th>
                                    <th className="text-left py-2 px-2 font-semibold text-gray-700">หน่วย</th>
                                    <th className="text-right py-2 px-2 font-semibold text-gray-700">ราคา/หน่วย</th>
                                    <th className="text-right py-2 px-2 font-semibold text-gray-700">ราคารวม</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {orderItems.get(order.id)!.map((item: any, idx: number) => (
                                    <tr key={idx} className="border-b border-gray-200 dark:border-gray-700 last:border-0">
                                      <td className="py-2 px-2 text-gray-600 dark:text-gray-400">{item.product?.product_code || '-'}</td>
                                      <td className="py-2 px-2 text-gray-900 dark:text-gray-100">
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <span>{item.product?.product_name || 'ไม่ระบุ'}</span>
                                          {item.is_bonus && (
                                            <Badge variant="success" className="text-xs">
                                              ของแถม
                                            </Badge>
                                          )}
                                        </div>
                                      </td>
                                      <td className="py-2 px-2 text-right font-semibold text-blue-600 dark:text-blue-400">
                                        {item.quantity.toLocaleString()}
                                      </td>
                                      <td className="py-2 px-2 text-gray-600 dark:text-gray-400">{item.product?.unit || '-'}</td>
                                      <td className="py-2 px-2 text-right text-gray-700 dark:text-gray-300">
                                        ฿{item.unit_price?.toLocaleString() || '0'}
                                      </td>
                                      <td className="py-2 px-2 text-right font-semibold text-gray-900 dark:text-gray-100">
                                        ฿{((item.quantity * (item.unit_price || 0))).toLocaleString()}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
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
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
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
                <label className="text-sm font-medium text-gray-700">
                  เลือกทั้งหมด
                </label>
              </div>
            </div>

            {/* Order Cards (Full View) */}
            {filteredOrders.map((order: any) => (
              <Card key={order.id} className={selectedOrders.has(order.id) ? 'ring-2 ring-blue-500' : ''}>
                <div className="p-6">
                  <div className="flex items-start gap-4">
                    {/* Checkbox */}
                    <input
                      type="checkbox"
                      checked={selectedOrders.has(order.id)}
                      onChange={() => toggleOrderSelection(order.id)}
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
                            {new Date(order.order_date).toLocaleDateString('th-TH', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                            })}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-blue-600">
                            {new Intl.NumberFormat('th-TH').format(order.total_amount)} ฿
                          </p>
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
                          <p className="text-sm text-gray-700 dark:text-gray-300">{order.delivery_address}</p>
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
                            onClick={() => setEditingOrderId(order.id)}
                            className="flex items-center gap-1 text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                          >
                            <Edit className="w-4 h-4" />
                            แก้ไข
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => toggleOrderDetails(order.id)}
                            className="flex items-center gap-1"
                          >
                            <Eye className="w-4 h-4" />
                            {expandedOrders.has(order.id) ? 'ซ่อนรายละเอียด' : 'ดูรายละเอียด'}
                            {expandedOrders.has(order.id) ? (
                              <ChevronDown className="w-4 h-4" />
                            ) : (
                              <ChevronRight className="w-4 h-4" />
                            )}
                          </Button>
                        </div>
                      </div>

                      {/* Order Items (Expandable) */}
                      {expandedOrders.has(order.id) && (
                        <div className="mt-4 pt-4 border-t border-gray-200">
                          <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                            <Package className="w-4 h-4 text-blue-600" />
                            รายการสินค้า
                          </h4>
                          {orderItems.get(order.id) ? (
                            <div className="bg-gray-50 rounded-lg p-3">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="border-b border-gray-300">
                                    <th className="text-left py-2 px-2 font-semibold text-gray-700">รหัสสินค้า</th>
                                    <th className="text-left py-2 px-2 font-semibold text-gray-700">ชื่อสินค้า</th>
                                    <th className="text-right py-2 px-2 font-semibold text-gray-700">จำนวน</th>
                                    <th className="text-left py-2 px-2 font-semibold text-gray-700">หน่วย</th>
                                    <th className="text-right py-2 px-2 font-semibold text-gray-700">ราคา/หน่วย</th>
                                    <th className="text-right py-2 px-2 font-semibold text-gray-700">ราคารวม</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {orderItems.get(order.id)!.map((item: any, idx: number) => (
                                    <tr key={idx} className="border-b border-gray-200 last:border-0">
                                      <td className="py-2 px-2 text-gray-600">{item.product?.product_code || '-'}</td>
                                      <td className="py-2 px-2 text-gray-900">
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <span>{item.product?.product_name || 'ไม่ระบุ'}</span>
                                          {item.is_bonus && (
                                            <Badge variant="success" className="text-xs">
                                              ของแถม
                                            </Badge>
                                          )}
                                        </div>
                                      </td>
                                      <td className="py-2 px-2 text-right font-semibold text-blue-600">
                                        {item.quantity.toLocaleString()}
                                      </td>
                                      <td className="py-2 px-2 text-gray-600">{item.product?.unit || '-'}</td>
                                      <td className="py-2 px-2 text-right text-gray-700">
                                        ฿{item.unit_price?.toLocaleString() || '0'}
                                      </td>
                                      <td className="py-2 px-2 text-right font-semibold text-gray-900">
                                        ฿{((item.quantity * (item.unit_price || 0))).toLocaleString()}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                                <tfoot>
                                  <tr className="border-t-2 border-gray-400 font-bold">
                                    <td colSpan={5} className="py-2 px-2 text-right text-gray-900">
                                      ยอดรวม:
                                    </td>
                                    <td className="py-2 px-2 text-right text-blue-600">
                                      ฿{orderItems.get(order.id)!.reduce(
                                        (sum: number, item: any) => sum + (item.quantity * (item.unit_price || 0)),
                                        0
                                      ).toLocaleString()}
                                    </td>
                                  </tr>
                                </tfoot>
                              </table>
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
            ))}
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
  );
}

