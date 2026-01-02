import React, { useState, useMemo } from 'react';
import { Package, Calendar, MapPin, DollarSign, User, Phone, Filter, X } from 'lucide-react';
import { usePendingOrders } from '../hooks/useOrders';
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
        <div className="text-center text-red-600 py-8">
          เกิดข้อผิดพลาด: {error.message}
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout title="ออเดอร์ที่รอจัดทริป">
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
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Date Filter */}
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-gray-400" />
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
            {dateFilter && (
              <button
                onClick={() => setDateFilter('')}
                className="p-2 text-gray-500 hover:text-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          <Button onClick={refetch} variant="outline">
            รีเฟรช
          </Button>
        </div>

        {/* Selection Summary */}
        {selectedOrders.size > 0 && (
          <div className="flex items-center justify-between p-4 bg-blue-50 border border-blue-200 rounded-xl">
            <div className="flex items-center gap-4">
              <p className="text-sm font-medium text-blue-900">
                เลือกแล้ว {selectedOrders.size} ออเดอร์
              </p>
              <p className="text-sm text-blue-700">
                ยอดรวม: {new Intl.NumberFormat('th-TH').format(selectedTotal)} ฿
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={clearSelection} variant="outline">
                ยกเลิกการเลือก
              </Button>
              <Button size="sm">
                สร้างทริปจากออเดอร์ที่เลือก
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <div className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">ออเดอร์ทั้งหมด</p>
                <p className="text-2xl font-bold text-gray-900">{orders?.length || 0}</p>
              </div>
              <Package className="w-10 h-10 text-blue-500 opacity-50" />
            </div>
          </div>
        </Card>

        <Card>
          <div className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">ออเดอร์ที่กรอง</p>
                <p className="text-2xl font-bold text-gray-900">{filteredOrders.length}</p>
              </div>
              <Filter className="w-10 h-10 text-green-500 opacity-50" />
            </div>
          </div>
        </Card>

        <Card>
          <div className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">มูลค่ารวม</p>
                <p className="text-2xl font-bold text-gray-900">
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
          <div className="p-12 text-center text-gray-500">
            <Package className="w-16 h-16 mx-auto mb-4 opacity-30" />
            <p className="text-lg font-medium">ไม่มีออเดอร์ที่รอจัดทริป</p>
            <p className="text-sm mt-2">ออเดอร์ทั้งหมดถูกจัดเข้าทริปแล้ว</p>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {/* Select All */}
          <div className="flex items-center gap-2 px-4">
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
              เลือกทั้งหมด ({filteredOrders.length})
            </label>
          </div>

          {/* Order Cards */}
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
                        <h3 className="text-lg font-semibold text-gray-900">
                          {order.order_number}
                        </h3>
                        <p className="text-sm text-gray-500">
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
                        <User className="w-5 h-5 text-gray-400 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {order.customer_name}
                          </p>
                          <p className="text-xs text-gray-500">{order.customer_code}</p>
                        </div>
                      </div>

                      {order.customer_phone && (
                        <div className="flex items-start gap-3">
                          <Phone className="w-5 h-5 text-gray-400 mt-0.5" />
                          <p className="text-sm text-gray-700">{order.customer_phone}</p>
                        </div>
                      )}
                    </div>

                    {/* Delivery Address */}
                    {order.delivery_address && (
                      <div className="flex items-start gap-3 mb-4">
                        <MapPin className="w-5 h-5 text-gray-400 mt-0.5" />
                        <p className="text-sm text-gray-700">{order.delivery_address}</p>
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
                    <div className="mt-4 flex items-center justify-between pt-4 border-t border-gray-200">
                      <div className="text-xs text-gray-500">
                        สร้างโดย: {order.created_by_name}
                      </div>
                      <Button size="sm" variant="outline">
                        ดูรายละเอียด
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </PageLayout>
  );
}

