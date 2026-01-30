import React, { useState, useMemo, useEffect } from 'react';
import { ArrowLeft, Truck, Users, MapPin, Calendar, Package, Save, Plus, GripVertical, X, Search, Building2 } from 'lucide-react';
import { useVehicles } from '../hooks/useVehicles';
import { useWarehouses } from '../hooks/useInventory';
import { profileService } from '../services/profileService';
import { deliveryTripService } from '../services/deliveryTripService';
import { ordersService, orderItemsService } from '../services/ordersService';
import { inventoryService } from '../services/inventoryService';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { PageLayout } from '../components/ui/PageLayout';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { useAuth } from '../hooks';
import { useToast } from '../hooks/useToast';
import { ToastContainer } from '../components/ui/Toast';
import { calculateTripCapacity } from '../utils/tripCapacityValidation';
import { AlertCircle } from 'lucide-react';

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
  delivery_date: string | null;
}

export function CreateTripFromOrdersView({ selectedOrders, onBack, onSuccess }: CreateTripFromOrdersViewProps) {
  const { user } = useAuth();
  const { vehicles, loading: vehiclesLoading } = useVehicles();
  const { warehouses, loading: warehousesLoading } = useWarehouses();
  const { toasts, success, error, warning, dismissToast } = useToast();

  const [drivers, setDrivers] = useState<Array<{ id: string; full_name: string; branch?: string | null }>>([]);
  const [driversLoading, setDriversLoading] = useState(false);
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('');
  const [selectedDriverId, setSelectedDriverId] = useState('');
  const [tripDate, setTripDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderItemsMap, setOrderItemsMap] = useState<Map<string, any[]>>(new Map());
  const [skipStockDeduction, setSkipStockDeduction] = useState(true); // เริ่มต้นเป็น true เพื่อไม่ตัดสต๊อก
  
  // Vehicle filtering
  const [selectedBranch, setSelectedBranch] = useState('');
  const [vehicleSearch, setVehicleSearch] = useState('');

  // Capacity summary state
  const [capacitySummary, setCapacitySummary] = useState<{
    totalPallets: number;
    totalWeightKg: number;
    vehicleMaxPallets: number | null;
    vehicleMaxWeightKg: number | null;
    loading: boolean;
    errors: string[];
    warnings: string[];
  } | null>(null);

  // สร้างรายการร้านค้าจากออเดอร์ที่เลือก
  const [storeDeliveries, setStoreDeliveries] = useState<StoreDelivery[]>(() => {
    return selectedOrders.map((order, index) => {
      // Debug log
      if (!order.store_id) {
        console.error('[CreateTrip] Missing store_id for order:', order);
      }
      
      return {
        id: `${order.id}-${index}`,
        order_id: order.id,
        store_id: order.store_id, // จาก orders table
        store_name: order.customer_name, // จาก stores.customer_name
        store_code: order.customer_code, // จาก stores.customer_code
        address: order.delivery_address || order.store_address || '',
        latitude: order.delivery_latitude,
        longitude: order.delivery_longitude,
        order_number: order.order_number,
        total_amount: order.total_amount,
        sequence: index + 1,
        delivery_date: order.delivery_date || null,
      };
    });
  });

  // Debug: log vehicles data
  useEffect(() => {
    console.log('[CreateTrip] vehicles:', vehicles);
    console.log('[CreateTrip] vehiclesLoading:', vehiclesLoading);
  }, [vehicles, vehiclesLoading]);

  // Fetch drivers list
  useEffect(() => {
    const fetchDrivers = async () => {
      try {
        setDriversLoading(true);
        const profiles = await profileService.getAll();
        const driverProfiles = profiles.filter((p: any) => p.role === 'driver');
        setDrivers(
          driverProfiles.map((p: any) => ({
            id: p.id,
            full_name: p.full_name || '',
            branch: (p.branch as string | null) ?? null,
          }))
        );
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

  // Calculate capacity summary when vehicle or items change (with debounce)
  useEffect(() => {
    if (!selectedVehicleId || storeDeliveries.length === 0) {
      setCapacitySummary(null);
      return;
    }

    // Collect all items from all stores (from order items)
    const allItems: Array<{ product_id: string; quantity: number }> = [];
    for (const delivery of storeDeliveries) {
      const orderItems = orderItemsMap.get(delivery.order_id) || [];
      for (const item of orderItems) {
        allItems.push({
          product_id: item.product_id,
          quantity: item.quantity,
        });
      }
    }

    if (allItems.length === 0) {
      setCapacitySummary(null);
      return;
    }

    // Set loading state
    setCapacitySummary(prev => ({
      ...prev,
      loading: true,
      errors: [],
      warnings: [],
    } as any));

    // Debounce: wait 500ms before calculating (to avoid too many requests)
    const timeoutId = setTimeout(() => {
      // Calculate capacity
      calculateTripCapacity(allItems, selectedVehicleId)
        .then(result => {
          setCapacitySummary({
            totalPallets: result.summary.totalPallets,
            totalWeightKg: result.summary.totalWeightKg,
            vehicleMaxPallets: result.summary.vehicleMaxPallets,
            vehicleMaxWeightKg: result.summary.vehicleMaxWeightKg,
            loading: false,
            errors: result.errors,
            warnings: result.warnings,
          });
        })
        .catch(err => {
          console.error('[CreateTripFromOrdersView] Error calculating capacity:', err);
          setCapacitySummary(prev => ({
            ...prev,
            loading: false,
            errors: [err.message || 'ไม่สามารถคำนวณความจุได้'],
            warnings: [],
          } as any));
        });
    }, 500);

    // Cleanup: cancel timeout if component unmounts or dependencies change
    return () => clearTimeout(timeoutId);
  }, [selectedVehicleId, storeDeliveries, orderItemsMap]);

  // Get unique branches from vehicles
  const branches = useMemo(() => {
    if (!vehicles || vehicles.length === 0) return [];
    const uniqueBranches = new Set<string>();
    vehicles.forEach((v: any) => {
      if (v.branch) {
        uniqueBranches.add(v.branch);
      }
    });
    return Array.from(uniqueBranches).sort();
  }, [vehicles]);

  // Filter vehicles by branch and search
  const filteredVehicles = useMemo(() => {
    if (!vehicles) return [];
    
    let filtered = vehicles;
    
    // Filter by branch
    if (selectedBranch) {
      filtered = filtered.filter((v: any) => v.branch === selectedBranch);
    }
    
    // Filter by search term (plate, make, model)
    if (vehicleSearch) {
      const search = vehicleSearch.toLowerCase();
      filtered = filtered.filter((v: any) => {
        const plate = (v.plate || '').toLowerCase();
        const make = (v.make || '').toLowerCase();
        const model = (v.model || '').toLowerCase();
        return plate.includes(search) || make.includes(search) || model.includes(search);
      });
    }
    
    return filtered;
  }, [vehicles, selectedBranch, vehicleSearch]);

  // Filter drivers by selected branch (ถ้าเลือกสาขา ให้แสดงเฉพาะพนักงานของสาขานั้น)
  const filteredDrivers = useMemo(() => {
    if (!drivers) return [];
    if (!selectedBranch) return drivers;
    return drivers.filter((d) => d.branch === selectedBranch);
  }, [drivers, selectedBranch]);

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
    // ถ้าต้องการตัดสต๊อก ต้องเลือกคลังสินค้า
    if (!skipStockDeduction && !selectedWarehouseId) {
      warning('กรุณาเลือกคลังสินค้าต้นทาง (เมื่อต้องการตัดสต๊อก)');
      return;
    }
    if (!selectedVehicleId) {
      warning('กรุณาเลือกรถ');
      return;
    }

    if (!selectedDriverId) {
      warning('กรุณาเลือกพนักงานขับรถ');
      return;
    }

    if (storeDeliveries.length === 0) {
      warning('กรุณาเลือกร้านค้าอย่างน้อย 1 ร้าน');
      return;
    }

    // Validate capacity if summary exists and has errors
    if (capacitySummary && capacitySummary.errors.length > 0) {
      warning(`ไม่สามารถสร้างทริปได้: ${capacitySummary.errors.join(', ')}`);
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
            is_bonus: item.is_bonus || false,
          })),
        };
      });

      // Reserve stock per order item from selected warehouse (ถ้าไม่ข้ามการตัดสต๊อก)
      if (!skipStockDeduction) {
        for (const delivery of storeDeliveries) {
          const orderItems = orderItemsMap.get(delivery.order_id) || [];
          for (const item of orderItems) {
            await inventoryService.reserveStock(
              selectedWarehouseId,
              item.product_id,
              item.quantity
            );
          }
        }
      }

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

      success('สร้างทริปเรียบร้อย');
      onSuccess();
    } catch (err: any) {
      console.error('Error creating trip:', err);
      error(`เกิดข้อผิดพลาด: ${err.message || 'ไม่สามารถสร้างทริปได้'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
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
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-gray-700">
                    <Truck className="w-4 h-4 inline mr-1" />
                    เลือกรถ *
                  </label>
                  
                  {/* Branch Filter */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">
                        <Building2 className="w-3 h-3 inline mr-1" />
                        สาขา
                      </label>
                      <select
                        value={selectedBranch}
                        onChange={(e) => {
                          setSelectedBranch(e.target.value);
                          setSelectedVehicleId(''); // Reset vehicle selection
                        }}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        disabled={vehiclesLoading}
                      >
                        <option value="">ทุกสาขา</option>
                        {branches.map((branch) => (
                          <option key={branch} value={branch}>
                            {branch}
                          </option>
                        ))}
                      </select>
                    </div>
                    
                    {/* Vehicle Search */}
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">
                        <Search className="w-3 h-3 inline mr-1" />
                        ค้นหา (ทะเบียน/ยี่ห้อ/รุ่น)
                      </label>
                      <input
                        type="text"
                        value={vehicleSearch}
                        onChange={(e) => {
                          setVehicleSearch(e.target.value);
                          setSelectedVehicleId(''); // Reset vehicle selection
                        }}
                        placeholder="พิมพ์เพื่อค้นหา..."
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        disabled={vehiclesLoading}
                      />
                    </div>
                  </div>

                  {/* Vehicle Dropdown */}
                  <select
                    value={selectedVehicleId}
                    onChange={(e) => setSelectedVehicleId(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    disabled={vehiclesLoading}
                  >
                    <option value="">
                      {vehiclesLoading 
                        ? 'กำลังโหลด...' 
                        : filteredVehicles.length === 0 
                          ? 'ไม่พบรถที่ตรงกับเงื่อนไข' 
                          : `-- เลือกรถ (${filteredVehicles.length} คัน) --`}
                    </option>
                    {filteredVehicles.map((vehicle: any) => (
                      <option key={vehicle.id} value={vehicle.id}>
                        {vehicle.plate} {vehicle.make ? `- ${vehicle.make}` : ''} {vehicle.model || ''} {vehicle.branch ? `[${vehicle.branch}]` : ''}
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
                    <option value="">
                      {driversLoading
                        ? 'กำลังโหลดพนักงาน...'
                        : selectedBranch && filteredDrivers.length === 0
                          ? 'ไม่พบพนักงานขับรถในสาขานี้'
                          : '-- เลือกพนักงาน --'}
                    </option>
                    {filteredDrivers.map((driver) => (
                      <option key={driver.id} value={driver.id}>
                        {driver.full_name}
                        {driver.branch ? ` [${driver.branch}]` : ''}
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

                {/* Skip Stock Deduction Option */}
                <div className="flex items-center gap-3 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                  <input
                    type="checkbox"
                    id="skipStockDeduction"
                    checked={skipStockDeduction}
                    onChange={(e) => setSkipStockDeduction(e.target.checked)}
                    className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="skipStockDeduction" className="flex-1 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                    <span className="font-medium">ไม่ตัดสต๊อก</span>
                    <span className="text-gray-500 dark:text-gray-400 ml-2">
                      (ใช้สำหรับระบบใบน้อยที่ยังไม่ตัดสต๊อก)
                    </span>
                  </label>
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
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    คลังสินค้าต้นทาง {!skipStockDeduction && '*'}
                    {skipStockDeduction && <span className="text-gray-400 text-xs ml-1">(ไม่จำเป็น)</span>}
                  </label>
                  <select
                    value={selectedWarehouseId}
                    onChange={(e) => setSelectedWarehouseId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    disabled={warehousesLoading}
                  >
                    <option value="">-- เลือกคลัง --</option>
                    {warehouses.map((w: any) => (
                      <option key={w.id} value={w.id}>
                        {w.code} - {w.name}
                      </option>
                    ))}
                  </select>
                </div>
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
                          <Badge variant="info" className="text-xs">
                            {delivery.order_number}
                          </Badge>
                        </div>
                        <div className="flex items-start gap-2 text-sm text-gray-600">
                          <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
                          <p className="line-clamp-1">{delivery.address || 'ไม่มีที่อยู่'}</p>
                        </div>
                        {delivery.delivery_date && (
                          <div className="flex items-center gap-2 text-sm mt-1">
                            <Calendar className="w-4 h-4 text-orange-600 flex-shrink-0" />
                            <span className="font-medium text-orange-600">
                              วันที่ลูกค้านัดส่ง: {new Date(delivery.delivery_date).toLocaleDateString('th-TH', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                              })}
                            </span>
                          </div>
                        )}
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

          {/* Capacity Summary */}
          {selectedVehicleId && storeDeliveries.length > 0 && (() => {
            // Check if there are any items in any order
            const hasItems = Array.from(orderItemsMap.values()).some((items: any[]) => Array.isArray(items) && items.length > 0);
            
            return (
              <Card>
                <div className="p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <Package size={20} />
                    สรุปความจุ
                  </h3>
                  {!hasItems ? (
                    <div className="text-center py-4 text-gray-500">
                      <p>กำลังโหลดข้อมูลสินค้า...</p>
                    </div>
                  ) : capacitySummary?.loading ? (
                    <div className="text-center py-4 text-gray-500">
                      กำลังคำนวณ...
                    </div>
                  ) : capacitySummary ? (
                    <div className="space-y-3">
                      {capacitySummary.errors.length > 0 && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                          <div className="flex items-center gap-2 text-red-800 mb-2">
                            <AlertCircle size={16} />
                            <span className="font-medium">ข้อผิดพลาด:</span>
                          </div>
                          <ul className="list-disc list-inside text-sm text-red-700 space-y-1">
                            {capacitySummary.errors.map((error, idx) => (
                              <li key={idx}>{error}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {capacitySummary.warnings.length > 0 && (
                        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                          <div className="flex items-center gap-2 text-amber-800 mb-2">
                            <AlertCircle size={16} />
                            <span className="font-medium">คำเตือน:</span>
                          </div>
                          <ul className="list-disc list-inside text-sm text-amber-700 space-y-1">
                            {capacitySummary.warnings.map((warning, idx) => (
                              <li key={idx}>{warning}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-3 bg-gray-50 rounded-lg">
                          <div className="text-sm text-gray-600 mb-1">
                            จำนวนพาเลท
                          </div>
                          <div className="text-2xl font-bold text-gray-900">
                            {capacitySummary.totalPallets}
                            {capacitySummary.vehicleMaxPallets !== null && (
                              <span className="text-lg font-normal text-gray-500">
                                {' '}/ {capacitySummary.vehicleMaxPallets}
                              </span>
                            )}
                          </div>
                          {capacitySummary.vehicleMaxPallets !== null && (
                            <div className="mt-2">
                              <div className="w-full bg-gray-200 rounded-full h-2">
                                <div
                                  className={`h-2 rounded-full ${
                                    capacitySummary.totalPallets > capacitySummary.vehicleMaxPallets
                                      ? 'bg-red-500'
                                      : capacitySummary.totalPallets > capacitySummary.vehicleMaxPallets * 0.9
                                        ? 'bg-amber-500'
                                        : 'bg-green-500'
                                  }`}
                                  style={{
                                    width: `${Math.min(
                                      100,
                                      (capacitySummary.totalPallets / capacitySummary.vehicleMaxPallets) * 100
                                    )}%`,
                                  }}
                                />
                              </div>
                              <div className="text-xs text-gray-500 mt-1">
                                {Math.round(
                                  (capacitySummary.totalPallets / capacitySummary.vehicleMaxPallets) * 100
                                )}
                                % ของความจุ
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="p-3 bg-gray-50 rounded-lg">
                          <div className="text-sm text-gray-600 mb-1">
                            น้ำหนักรวม
                          </div>
                          <div className="text-2xl font-bold text-gray-900">
                            {capacitySummary.totalWeightKg.toFixed(2)} กก.
                            {capacitySummary.vehicleMaxWeightKg !== null && (
                              <span className="text-lg font-normal text-gray-500">
                                {' '}/ {capacitySummary.vehicleMaxWeightKg} กก.
                              </span>
                            )}
                          </div>
                          {capacitySummary.vehicleMaxWeightKg !== null && (
                            <div className="mt-2">
                              <div className="w-full bg-gray-200 rounded-full h-2">
                                <div
                                  className={`h-2 rounded-full ${
                                    capacitySummary.totalWeightKg > capacitySummary.vehicleMaxWeightKg
                                      ? 'bg-red-500'
                                      : capacitySummary.totalWeightKg > capacitySummary.vehicleMaxWeightKg * 0.9
                                        ? 'bg-amber-500'
                                        : 'bg-green-500'
                                  }`}
                                  style={{
                                    width: `${Math.min(
                                      100,
                                      (capacitySummary.totalWeightKg / capacitySummary.vehicleMaxWeightKg) * 100
                                    )}%`,
                                  }}
                                />
                              </div>
                              <div className="text-xs text-gray-500 mt-1">
                                {Math.round(
                                  (capacitySummary.totalWeightKg / capacitySummary.vehicleMaxWeightKg) * 100
                                )}
                                % ของความจุ
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-gray-500">
                      กำลังคำนวณความจุ...
                    </div>
                  )}
                </div>
              </Card>
            );
          })()}

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
    </>
  );
}

