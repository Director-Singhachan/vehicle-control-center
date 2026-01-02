import React, { useState, useMemo, useEffect } from 'react';
import { ArrowLeft, Truck, Users, MapPin, Calendar, Package, Save, Plus, GripVertical, X } from 'lucide-react';
import { useVehicles } from '../hooks/useVehicles';
import { profileService } from '../services/profileService';
import { deliveryTripService } from '../services/deliveryTripService';
import { ordersService, orderItemsService } from '../services/ordersService';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { PageLayout } from '../components/ui/PageLayout';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { useAuth } from '../hooks';

interface CreateTripFromOrdersViewProps {
  selectedOrders: any[];
  onBack: () => void;
  onSuccess: () => void;
}

interface StoreDelivery {
  id: string;
  order_id: string;
  store_id: string;
  store_name: string;
  store_code: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  order_number: string;
  total_amount: number;
  sequence: number;
}

export function CreateTripFromOrdersView({ selectedOrders, onBack, onSuccess }: CreateTripFromOrdersViewProps) {
  const { user } = useAuth();
  const { vehicles, loading: vehiclesLoading } = useVehicles();

  const [drivers, setDrivers] = useState<Array<{ id: string; full_name: string }>>([]);
  const [driversLoading, setDriversLoading] = useState(false);
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [selectedDriverId, setSelectedDriverId] = useState('');
  const [tripDate, setTripDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderItemsMap, setOrderItemsMap] = useState<Map<string, any[]>>(new Map());

  // สร้างรายการร้านค้าจากออเดอร์ที่เลือก
  const [storeDeliveries, setStoreDeliveries] = useState<StoreDelivery[]>(() => {
    return selectedOrders.map((order, index) => ({
      id: `${order.id}-${index}`,
      order_id: order.id,
      store_id: order.customer_id,
      store_name: order.customer_name,
      store_code: order.customer_code,
      address: order.delivery_address || order.customer_address || '',
      latitude: order.delivery_latitude,
      longitude: order.delivery_longitude,
      order_number: order.order_number,
      total_amount: order.total_amount,
      sequence: index + 1,
    }));
  });

  // Fetch drivers list
  useEffect(() => {
    const fetchDrivers = async () => {
      try {
        setDriversLoading(true);
        const profiles = await profileService.getAll();
        const driverProfiles = profiles.filter(p => p.role === 'driver');
        setDrivers(driverProfiles.map(p => ({ id: p.id, full_name: p.full_name || '' })));
      } catch (err) {
        console.error('Error fetching drivers:', err);
        setDrivers([]);
      } finally {
        setDriversLoading(false);
      }
    };

    fetchDrivers();
  }, []);

  // Fetch order items for all orders
  useEffect(() => {
    const fetchOrderItems = async () => {
      const itemsMap = new Map<string, any[]>();
      
      for (const order of selectedOrders) {
        try {
          const items = await orderItemsService.getByOrderId(order.id);
          itemsMap.set(order.id, items || []);
        } catch (error) {
          console.error(`Failed to fetch items for order ${order.id}:`, error);
          itemsMap.set(order.id, []);
        }
      }
      
      setOrderItemsMap(itemsMap);
    };

    fetchOrderItems();
  }, [selectedOrders]);

  // Drag & Drop handlers
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const newDeliveries = [...storeDeliveries];
    const draggedItem = newDeliveries[draggedIndex];
    
    newDeliveries.splice(draggedIndex, 1);
    newDeliveries.splice(index, 0, draggedItem);
    
    // Update sequences
    newDeliveries.forEach((delivery, idx) => {
      delivery.sequence = idx + 1;
    });

    setStoreDeliveries(newDeliveries);
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  // Remove delivery
  const handleRemoveDelivery = (id: string) => {
    const newDeliveries = storeDeliveries
      .filter(d => d.id !== id)
      .map((delivery, idx) => ({
        ...delivery,
        sequence: idx + 1,
      }));
    setStoreDeliveries(newDeliveries);
  };

  // Calculate totals
  const totals = useMemo(() => {
    const totalAmount = storeDeliveries.reduce((sum, d) => sum + d.total_amount, 0);
    const totalStops = storeDeliveries.length;
    return { totalAmount, totalStops };
  }, [storeDeliveries]);

  // Submit
  const handleSubmit = async () => {
    if (!selectedVehicleId) {
      alert('กรุณาเลือกรถ');
      return;
    }

    if (!selectedDriverId) {
      alert('กรุณาเลือกพนักงานขับรถ');
      return;
    }

    if (storeDeliveries.length === 0) {
      alert('กรุณาเลือกร้านค้าอย่างน้อย 1 ร้าน');
      return;
    }

    setIsSubmitting(true);

    try {
      // Build stores array with items from orders
      const stores = storeDeliveries.map((delivery) => {
        const orderItems = orderItemsMap.get(delivery.order_id) || [];
        
        return {
          store_id: delivery.store_id,
          sequence_order: delivery.sequence,
          items: orderItems.map((item: any) => ({
            product_id: item.product_id,
            quantity: item.quantity,
            notes: item.notes || undefined,
          })),
        };
      });

      // Create delivery trip with all stores and items
      const trip = await deliveryTripService.create({
        vehicle_id: selectedVehicleId,
        driver_id: selectedDriverId,
        planned_date: tripDate,
        notes: notes || undefined,
        stores,
      });

      // Update orders status and link to trip
      const orderIds = storeDeliveries.map(d => d.order_id);
      await ordersService.assignToTrip(orderIds, trip.id, user?.id!);

      alert('✅ สร้างทริปเรียบร้อย');
      onSuccess();
    } catch (error: any) {
      console.error('Error creating trip:', error);
      alert(`❌ เกิดข้อผิดพลาด: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <PageLayout
      title="สร้างทริปจากออเดอร์"
      actions={
        <Button onClick={onBack} variant="outline">
          <ArrowLeft className="w-4 h-4 mr-2" />
          ย้อนกลับ
        </Button>
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Trip Settings */}
        <div className="lg:col-span-2 space-y-6">
          {/* Trip Info */}
          <Card>
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">ข้อมูลทริป</h3>
              
              <div className="space-y-4">
                {/* Vehicle Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Truck className="w-4 h-4 inline mr-1" />
                    เลือกรถ *
                  </label>
                  <select
                    value={selectedVehicleId}
                    onChange={(e) => setSelectedVehicleId(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    disabled={vehiclesLoading}
                  >
                    <option value="">-- เลือกรถ --</option>
                    {vehicles?.filter((v: any) => v.is_active).map((vehicle: any) => (
                      <option key={vehicle.id} value={vehicle.id}>
                        {vehicle.plate} - {vehicle.make} {vehicle.model}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Driver Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Users className="w-4 h-4 inline mr-1" />
                    พนักงานขับรถ *
                  </label>
                  <select
                    value={selectedDriverId}
                    onChange={(e) => setSelectedDriverId(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    disabled={driversLoading}
                  >
                    <option value="">-- เลือกพนักงาน --</option>
                    {drivers?.map((driver: any) => (
                      <option key={driver.id} value={driver.id}>
                        {driver.full_name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Trip Date */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Calendar className="w-4 h-4 inline mr-1" />
                    วันที่ส่ง *
                  </label>
                  <input
                    type="date"
                    value={tripDate}
                    onChange={(e) => setTripDate(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    หมายเหตุ
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    rows={3}
                    placeholder="หมายเหตุเพิ่มเติม..."
                  />
                </div>
              </div>
            </div>
          </Card>

          {/* Store Deliveries with Drag & Drop */}
          <Card>
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  ลำดับการจัดส่ง ({storeDeliveries.length} จุด)
                </h3>
                <p className="text-sm text-gray-500">
                  ลากเพื่อจัดเรียงลำดับ
                </p>
              </div>

              {storeDeliveries.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>ไม่มีร้านค้าในรายการ</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {storeDeliveries.map((delivery, index) => (
                    <div
                      key={delivery.id}
                      draggable
                      onDragStart={() => handleDragStart(index)}
                      onDragOver={(e) => handleDragOver(e, index)}
                      onDragEnd={handleDragEnd}
                      className={`flex items-center gap-4 p-4 bg-white border-2 rounded-xl cursor-move hover:shadow-md transition-all ${
                        draggedIndex === index ? 'opacity-50 border-blue-500' : 'border-gray-200'
                      }`}
                    >
                      {/* Drag Handle */}
                      <GripVertical className="w-5 h-5 text-gray-400" />

                      {/* Sequence Number */}
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold text-sm">
                        {delivery.sequence}
                      </div>

                      {/* Store Info */}
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-semibold text-gray-900">{delivery.store_name}</p>
                          <Badge variant="outline" className="text-xs">
                            {delivery.order_number}
                          </Badge>
                        </div>
                        <div className="flex items-start gap-2 text-sm text-gray-600">
                          <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
                          <p className="line-clamp-1">{delivery.address || 'ไม่มีที่อยู่'}</p>
                        </div>
                      </div>

                      {/* Amount */}
                      <div className="text-right flex-shrink-0">
                        <p className="text-lg font-bold text-blue-600">
                          {new Intl.NumberFormat('th-TH').format(delivery.total_amount)} ฿
                        </p>
                      </div>

                      {/* Remove Button */}
                      <button
                        onClick={() => handleRemoveDelivery(delivery.id)}
                        className="flex-shrink-0 p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Right: Summary */}
        <div className="space-y-6">
          <Card>
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">สรุปทริป</h3>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between py-3 border-b border-gray-200">
                  <div className="flex items-center gap-2 text-gray-600">
                    <Package className="w-5 h-5" />
                    <span>จำนวนจุดส่ง</span>
                  </div>
                  <span className="text-xl font-bold text-gray-900">
                    {totals.totalStops}
                  </span>
                </div>

                <div className="flex items-center justify-between py-3 border-b border-gray-200">
                  <div className="flex items-center gap-2 text-gray-600">
                    <Package className="w-5 h-5" />
                    <span>จำนวนออเดอร์</span>
                  </div>
                  <span className="text-xl font-bold text-gray-900">
                    {selectedOrders.length}
                  </span>
                </div>

                <div className="flex items-center justify-between pt-3">
                  <span className="font-semibold text-gray-900">มูลค่ารวม</span>
                  <span className="text-2xl font-bold text-blue-600">
                    {new Intl.NumberFormat('th-TH').format(totals.totalAmount)} ฿
                  </span>
                </div>
              </div>

              <div className="mt-6 pt-6 border-t border-gray-200">
                <Button
                  onClick={handleSubmit}
                  disabled={isSubmitting || !selectedVehicleId || !selectedDriverId || storeDeliveries.length === 0}
                  className="w-full"
                >
                  {isSubmitting ? (
                    <>
                      <LoadingSpinner size={16} className="mr-2" />
                      กำลังสร้างทริป...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      สร้างทริป
                    </>
                  )}
                </Button>
              </div>
            </div>
          </Card>

          {/* Selected Orders List */}
          <Card>
            <div className="p-6">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">
                ออเดอร์ที่เลือก ({selectedOrders.length})
              </h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {selectedOrders.map((order) => (
                  <div key={order.id} className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-sm font-medium text-gray-900">{order.order_number}</p>
                    <p className="text-xs text-gray-500">{order.customer_name}</p>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>
      </div>
    </PageLayout>
  );
}

