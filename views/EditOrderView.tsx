import React, { useState, useMemo, useRef, useEffect } from 'react';
import { ShoppingCart, Plus, Trash2, Search, Check, Edit, AlertTriangle } from 'lucide-react';
import { useProducts, useWarehouses } from '../hooks/useInventory';
import { ordersService, orderItemsService } from '../services/ordersService';
import { productTierPriceService } from '../services/customerTierService';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { PageLayout } from '../components/ui/PageLayout';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { useAuth } from '../hooks';
import { supabase } from '../lib/supabase';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';

interface OrderItem {
  id?: string; // สำหรับ item ที่มีอยู่แล้ว
  product_id: string;
  product?: any;
  quantity: number | '';
  unit_price: number;
  discount_percent: number | '';
}

interface EditOrderViewProps {
  orderId: string;
  onSave?: () => void;
  onCancel?: () => void;
}

export function EditOrderView({ orderId, onSave, onCancel }: EditOrderViewProps) {
  const { products, loading: productsLoading } = useProducts();
  const { warehouses, loading: warehousesLoading } = useWarehouses();
  const { user } = useAuth();

  const showNotification = (type: 'success' | 'error' | 'warning', message: string) => {
    if (type === 'error') {
      alert(`❌ ${message}`);
    } else if (type === 'warning') {
      alert(`⚠️ ${message}`);
    } else {
      alert(`✅ ${message}`);
    }
  };

  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedStore, setSelectedStore] = useState<any>(null);
  const [selectedWarehouse, setSelectedWarehouse] = useState<any>(null);
  const [stores, setStores] = useState<any[]>([]);
  const [storesLoading, setStoresLoading] = useState(false);
  const [storeSearch, setStoreSearch] = useState('');

  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [notes, setNotes] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showWarningDialog, setShowWarningDialog] = useState(false);
  const [hasAssignedTrip, setHasAssignedTrip] = useState(false);

  // Refs สำหรับ click outside
  const storeDropdownRef = useRef<HTMLDivElement>(null);
  const productDropdownRef = useRef<HTMLDivElement>(null);
  const priceUpdateTimeouts = useRef<Record<string, NodeJS.Timeout>>({});

  // โหลดข้อมูลออเดอร์
  useEffect(() => {
    loadOrder();
  }, [orderId]);

  const loadOrder = async () => {
    try {
      setLoading(true);
      const orderData = await ordersService.getById(orderId);
      setOrder(orderData);

      // ตรวจสอบว่าออเดอร์ถูก assign กับทริปแล้วหรือไม่
      if (orderData.delivery_trip_id) {
        setHasAssignedTrip(true);
      }

      // โหลด store
      if (orderData.store_id) {
        const { data: storeData } = await supabase
          .from('stores')
          .select('*, customer_tiers(tier_name, tier_code, color)')
          .eq('id', orderData.store_id)
          .single();
        if (storeData) {
          setSelectedStore(storeData);
        }
      }

      // โหลด warehouse
      if (orderData.warehouse_id) {
        const warehouse = warehouses?.find(w => w.id === orderData.warehouse_id);
        if (warehouse) {
          setSelectedWarehouse(warehouse);
        }
      }

      // โหลด order items
      const items = await orderItemsService.getByOrderId(orderId);
      setOrderItems(
        items.map((item: any) => ({
          id: item.id,
          product_id: item.product_id,
          product: item.product,
          quantity: item.quantity,
          unit_price: item.unit_price || 0,
          discount_percent: item.discount_percent || '',
        }))
      );

      setNotes(orderData.notes || '');
      setDeliveryDate(orderData.delivery_date || '');
    } catch (error: any) {
      showNotification('error', 'เกิดข้อผิดพลาดในการโหลดข้อมูลออเดอร์');
      console.error('Error loading order:', error);
    } finally {
      setLoading(false);
    }
  };

  // ปิด dropdown เมื่อคลิกข้างนอก
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (storeDropdownRef.current && !storeDropdownRef.current.contains(event.target as Node)) {
        if (stores.length > 0) {
          setStores([]);
          setStoreSearch('');
        }
      }

      if (productDropdownRef.current && !productDropdownRef.current.contains(event.target as Node)) {
        if (productSearch) {
          setProductSearch('');
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [stores.length, productSearch]);

  // ค้นหาร้านค้า
  const searchStores = async (query: string) => {
    if (query.length < 2) {
      setStores([]);
      return;
    }

    setStoresLoading(true);
    try {
      const { data, error } = await supabase
        .from('stores')
        .select('*, customer_tiers(tier_name, tier_code, color)')
        .or(`customer_name.ilike.%${query}%,customer_code.ilike.%${query}%`)
        .eq('is_active', true)
        .limit(10);

      if (error) throw error;
      setStores(data || []);
    } catch (error: any) {
      showNotification('error', 'เกิดข้อผิดพลาดในการค้นหาร้านค้า');
    } finally {
      setStoresLoading(false);
    }
  };

  const handleStoreSearch = (query: string) => {
    setStoreSearch(query);
    searchStores(query);
  };

  const handleSelectStore = (store: any) => {
    setSelectedStore(store);
    setStores([]);
    setStoreSearch('');
  };

  // กรองสินค้า
  const filteredProducts = useMemo(() => {
    if (!productSearch) return [];

    if (!products || products.length === 0) return [];

    const filtered = products.filter((product: any) =>
      product.product_name?.toLowerCase().includes(productSearch.toLowerCase()) ||
      product.product_code?.toLowerCase().includes(productSearch.toLowerCase())
    ).slice(0, 10);

    return filtered;
  }, [products, productSearch]);

  // เพิ่มสินค้า
  const handleAddProduct = async (product: any) => {
    if (!selectedStore) {
      showNotification('error', 'กรุณาเลือกร้านค้าก่อน');
      return;
    }

    // ตรวจสอบว่ามีสินค้านี้แล้วหรือไม่
    const existingItem = orderItems.find(item => item.product_id === product.id);
    if (existingItem) {
      showNotification('warning', 'สินค้านี้มีในรายการแล้ว');
      return;
    }

    try {
      // คำนวณราคาตาม tier
      const price = await productTierPriceService.calculatePriceForStore(
        product.id,
        selectedStore.id,
        1
      );

      const newItem: OrderItem = {
        product_id: product.id,
        product: product,
        quantity: '',
        unit_price: price || product.base_price || 0,
        discount_percent: '',
      };

      setOrderItems([...orderItems, newItem]);
      setProductSearch('');
    } catch (error: any) {
      showNotification('error', 'ไม่สามารถดึงราคาสินค้าได้');
    }
  };

  // อัพเดทจำนวนสินค้า
  const handleUpdateQuantity = (index: number, value: string) => {
    const updated = [...orderItems];
    let num = 0;

    if (value === '') {
      updated[index].quantity = '';
    } else {
      num = Math.max(0, Number(value) || 0);
      updated[index].quantity = num;
    }
    setOrderItems(updated);

    // Debounce price update based on quantity
    const item = updated[index];
    if (selectedStore && item.product_id) {
      if (priceUpdateTimeouts.current[item.product_id]) {
        clearTimeout(priceUpdateTimeouts.current[item.product_id]);
      }

      priceUpdateTimeouts.current[item.product_id] = setTimeout(async () => {
        if (num > 0) {
          try {
            const price = await productTierPriceService.calculatePriceForStore(
              item.product_id,
              selectedStore.id,
              num
            );

            setOrderItems(prev => prev.map(p =>
              p.product_id === item.product_id ? { ...p, unit_price: price } : p
            ));
          } catch (err) {
            console.error('Error updating price:', err);
          }
        }
      }, 500);
    }
  };

  // อัพเดทส่วนลด
  const handleUpdateDiscount = (index: number, value: string) => {
    const updated = [...orderItems];
    if (value === '') {
      updated[index].discount_percent = '';
    } else {
      const num = Number(value);
      if (!isNaN(num)) {
        updated[index].discount_percent = Math.min(100, Math.max(0, num));
      }
    }
    setOrderItems(updated);
  };

  // ลบสินค้า
  const handleRemoveItem = (index: number) => {
    setOrderItems(orderItems.filter((_, i) => i !== index));
  };

  // คำนวณยอดรวม
  const calculateTotal = useMemo(() => {
    const subtotal = orderItems.reduce((sum, item) => {
      const qty = Number(item.quantity || 0);
      return sum + (item.unit_price * qty);
    }, 0);

    const discountAmount = orderItems.reduce((sum, item) => {
      const qty = Number(item.quantity || 0);
      const discount = Number(item.discount_percent || 0);
      return sum + (item.unit_price * qty * discount / 100);
    }, 0);

    const total = subtotal - discountAmount;

    return { subtotal, discountAmount, total };
  }, [orderItems]);

  // บันทึกออเดอร์
  const handleSubmit = async () => {
    if (!selectedStore) {
      showNotification('error', 'กรุณาเลือกร้านค้า');
      return;
    }

    const hasInvalidQuantity = orderItems.some(item => Number(item.quantity || 0) <= 0);
    if (hasInvalidQuantity) {
      showNotification('error', 'กรุณาใส่จำนวนสินค้ามากกว่า 0');
      return;
    }

    if (orderItems.length === 0) {
      showNotification('error', 'กรุณาเพิ่มสินค้าอย่างน้อย 1 รายการ');
      return;
    }

    // ถ้าออเดอร์ถูก assign กับทริปแล้ว แสดง warning
    if (hasAssignedTrip) {
      setShowWarningDialog(true);
      return;
    }

    await performUpdate();
  };

  const performUpdate = async () => {
    setIsSubmitting(true);

    try {
      // 1. อัพเดทข้อมูลออเดอร์
      await ordersService.update(orderId, {
        store_id: selectedStore.id,
        notes: notes || null,
        delivery_address: selectedStore.address || null,
        delivery_date: deliveryDate || null,
        warehouse_id: selectedWarehouse?.id || null,
        updated_by: user?.id,
      });

      // 2. ดึง order items ที่มีอยู่
      const existingItems = await orderItemsService.getByOrderId(orderId);
      const existingItemIds = new Set(existingItems.map((item: any) => item.id));

      // 3. แยก items ที่ต้องเพิ่ม, อัพเดท, และลบ
      const itemsToAdd: OrderItem[] = [];
      const itemsToUpdate: Array<{ id: string; data: any }> = [];
      const itemsToDelete: string[] = [];

      orderItems.forEach((item) => {
        if (item.id && existingItemIds.has(item.id)) {
          // Item ที่มีอยู่แล้ว - อัพเดท
          itemsToUpdate.push({
            id: item.id,
            data: {
              product_id: item.product_id,
              quantity: Number(item.quantity || 0),
              unit_price: item.unit_price,
              discount_percent: Number(item.discount_percent || 0),
            },
          });
        } else if (!item.id) {
          // Item ใหม่ - เพิ่ม
          itemsToAdd.push(item);
        }
      });

      // หา items ที่ถูกลบ (มีใน existing แต่ไม่มีใน orderItems)
      existingItems.forEach((existingItem: any) => {
        if (!orderItems.find(item => item.id === existingItem.id)) {
          itemsToDelete.push(existingItem.id);
        }
      });

      // 4. ลบ items ที่ถูกลบ
      if (itemsToDelete.length > 0) {
        for (const itemId of itemsToDelete) {
          await orderItemsService.delete(itemId);
        }
      }

      // 5. อัพเดท items ที่มีอยู่
      for (const { id, data } of itemsToUpdate) {
        await orderItemsService.update(id, data);
      }

      // 6. เพิ่ม items ใหม่
      if (itemsToAdd.length > 0) {
        for (const item of itemsToAdd) {
          await orderItemsService.add({
            order_id: orderId,
            product_id: item.product_id,
            quantity: Number(item.quantity || 0),
            unit_price: item.unit_price,
            discount_percent: Number(item.discount_percent || 0),
          });
        }
      }

      // 7. อัพเดท total_amount
      await ordersService.update(orderId, {
        total_amount: calculateTotal.total,
      });

      // 8. Sync ไปยังทริป (ทำงานอัตโนมัติผ่าน database trigger)
      // หมายเหตุ: การ sync จะทำงานอัตโนมัติใน database backend
      // ไม่ต้องเรียก sync service เอง เพราะ database trigger จะจัดการให้
      if (hasAssignedTrip) {
        showNotification('success', 'แก้ไขออเดอร์เรียบร้อย ระบบจะ sync ไปยังทริปอัตโนมัติ');
      } else {
        showNotification('success', 'แก้ไขออเดอร์เรียบร้อย');
      }

      onSave?.();
    } catch (error: any) {
      showNotification('error', error.message || 'เกิดข้อผิดพลาดในการแก้ไขออเดอร์');
    } finally {
      setIsSubmitting(false);
      setShowWarningDialog(false);
    }
  };

  if (loading) {
    return (
      <PageLayout title="แก้ไขออเดอร์">
        <Card>
          <div className="p-12 flex items-center justify-center">
            <LoadingSpinner />
          </div>
        </Card>
      </PageLayout>
    );
  }

  if (!order) {
    return (
      <PageLayout title="แก้ไขออเดอร์">
        <Card>
          <div className="p-12 text-center">
            <AlertTriangle className="w-16 h-16 mx-auto mb-4 text-red-500" />
            <p className="text-red-600 dark:text-red-400">ไม่พบข้อมูลออเดอร์</p>
            {onCancel && (
              <Button onClick={onCancel} className="mt-4">
                กลับ
              </Button>
            )}
          </div>
        </Card>
      </PageLayout>
    );
  }

  return (
    <PageLayout title={`แก้ไขออเดอร์ ${order.order_number || ''}`}>
      {hasAssignedTrip && (
        <Card className="mb-6 border-orange-300 dark:border-orange-700 bg-orange-50 dark:bg-orange-900/20">
          <div className="p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-orange-600 dark:text-orange-400 mt-0.5 flex-shrink-0" />
            <div>
              <div className="font-semibold text-orange-900 dark:text-orange-300 mb-1">
                ⚠️ ออเดอร์นี้ถูกกำหนดทริปแล้ว
              </div>
              <div className="text-sm text-orange-700 dark:text-orange-400">
                การแก้ไขออเดอร์นี้อาจส่งผลกระทบต่อทริปที่กำหนดไว้แล้ว กรุณาตรวจสอบและยืนยันการแก้ไข
              </div>
            </div>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Store & Products Selection */}
        <div className="lg:col-span-2 space-y-6">
          {/* Warehouse Selection */}
          <Card>
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">1. เลือกสาขา/คลังสินค้า</h3>
              {warehousesLoading ? (
                <div className="flex justify-center py-4">
                  <LoadingSpinner />
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {warehouses?.map((wh) => (
                    <div
                      key={wh.id}
                      onClick={() => setSelectedWarehouse(wh)}
                      className={`cursor-pointer p-4 rounded-xl border-2 transition-all ${
                        selectedWarehouse?.id === wh.id
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                          : 'border-gray-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-700'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className={`text-sm font-medium px-2 py-0.5 rounded ${
                          wh.type === 'main'
                            ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
                            : 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300'
                        }`}>
                          {wh.type === 'main' ? 'สำนักงานใหญ่' : 'สาขา'}
                        </span>
                        {selectedWarehouse?.id === wh.id && (
                          <Check className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                        )}
                      </div>
                      <p className="font-semibold text-gray-900 dark:text-white">{wh.name}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{wh.code}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>

          {/* Store Selection */}
          <Card className={`overflow-visible ${stores.length > 0 && !selectedStore ? 'relative z-50' : ''}`}>
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">2. เลือกร้านค้า</h3>

              {selectedStore ? (
                <div className="flex items-center justify-between p-4 bg-green-50 dark:bg-green-900/20 border-2 border-green-200 dark:border-green-700 rounded-xl">
                  <div className="flex items-center gap-3">
                    <Check className="w-5 h-5 text-green-600 dark:text-green-400" />
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-white">{selectedStore.customer_name}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{selectedStore.customer_code}</p>
                      {selectedStore.customer_tiers && (
                        <Badge
                          className="mt-1"
                          style={{
                            backgroundColor: `${selectedStore.customer_tiers.color}20`,
                            color: selectedStore.customer_tiers.color
                          }}
                        >
                          {selectedStore.customer_tiers.tier_name}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setSelectedStore(null)}
                  >
                    เปลี่ยน
                  </Button>
                </div>
              ) : (
                <div className="relative" ref={storeDropdownRef}>
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
                  <input
                    type="text"
                    placeholder="ค้นหาร้านค้า (ชื่อหรือรหัส)..."
                    value={storeSearch}
                    onChange={(e) => handleStoreSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                  />

                  {storesLoading && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <LoadingSpinner size={20} />
                    </div>
                  )}

                  {stores.length > 0 && (
                    <div className="absolute z-50 w-full mt-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-xl shadow-lg dark:shadow-black/50 max-h-60 overflow-y-auto">
                      {stores.map((store) => (
                        <button
                          key={store.id}
                          onClick={() => handleSelectStore(store)}
                          className="w-full p-4 text-left hover:bg-gray-50 dark:hover:bg-slate-700/50 border-b border-gray-100 dark:border-slate-700 last:border-b-0"
                        >
                          <p className="font-medium text-gray-900 dark:text-white">{store.customer_name}</p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">{store.customer_code}</p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </Card>

          {/* Products Selection */}
          <Card className={`overflow-visible ${productSearch && filteredProducts.length > 0 ? 'relative z-50' : ''}`}>
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">3. จัดการสินค้า</h3>

              <div className="relative mb-4" ref={productDropdownRef}>
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
                <input
                  type="text"
                  placeholder="ค้นหาสินค้า (ชื่อหรือรหัส)..."
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={!selectedStore}
                />

                {productsLoading && productSearch && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <LoadingSpinner size={20} />
                  </div>
                )}

                {productSearch && !productsLoading && (
                  <>
                    {filteredProducts.length > 0 ? (
                      <div className="absolute z-50 w-full mt-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-xl shadow-lg dark:shadow-black/50 max-h-60 overflow-y-auto">
                        {filteredProducts.map((product: any) => (
                          <button
                            key={product.id}
                            onClick={() => handleAddProduct(product)}
                            className="w-full p-4 text-left hover:bg-gray-50 dark:hover:bg-slate-700/50 border-b border-gray-100 dark:border-slate-700 last:border-b-0 flex items-center justify-between gap-3"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <p className="font-medium text-gray-900 dark:text-white truncate">{product.product_name}</p>
                                {product.unit && (
                                  <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 text-xs flex-shrink-0">
                                    {product.unit}
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm text-gray-500 dark:text-gray-400">{product.product_code}</p>
                            </div>
                            <p className="text-sm font-semibold text-blue-600 dark:text-blue-400 flex-shrink-0">
                              {new Intl.NumberFormat('th-TH').format(product.base_price || 0)} ฿
                            </p>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="absolute z-50 w-full mt-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-xl shadow-lg dark:shadow-black/50 p-4">
                        <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
                          {products && products.length > 0
                            ? `ไม่พบสินค้าที่ค้นหา "${productSearch}"`
                            : 'ยังไม่มีข้อมูลสินค้าในระบบ'}
                        </p>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Order Items Table */}
              {orderItems.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full table-fixed">
                    <colgroup>
                      <col className="w-[28%]" />
                      <col className="w-[10%]" />
                      <col className="w-[14%]" />
                      <col className="w-[14%]" />
                      <col className="w-[14%]" />
                      <col className="w-[14%]" />
                      <col className="w-[6%]" />
                    </colgroup>
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-slate-700">
                        <th className="text-left py-3 px-2 text-sm font-semibold text-gray-700 dark:text-gray-300">สินค้า</th>
                        <th className="text-center py-3 px-2 text-sm font-semibold text-gray-700 dark:text-gray-300">หน่วย</th>
                        <th className="text-right py-3 px-2 text-sm font-semibold text-gray-700 dark:text-gray-300">ราคา</th>
                        <th className="text-center py-3 px-2 text-sm font-semibold text-gray-700 dark:text-gray-300">จำนวน</th>
                        <th className="text-center py-3 px-2 text-sm font-semibold text-gray-700 dark:text-gray-300">ส่วนลด%</th>
                        <th className="text-right py-3 px-2 text-sm font-semibold text-gray-700 dark:text-gray-300">รวม</th>
                        <th className="text-center py-3 px-2 text-sm font-semibold text-gray-700 dark:text-gray-300"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {orderItems.map((item, index) => {
                        const qty = Number(item.quantity || 0);
                        const discount = Number(item.discount_percent || 0);
                        const lineTotal = (item.unit_price * qty) - (item.unit_price * qty * discount / 100);

                        return (
                          <tr key={index} className="border-b border-gray-100 dark:border-slate-700">
                            <td className="py-3 px-2 align-top">
                              <p className="font-medium text-gray-900 dark:text-white text-sm">{item.product?.product_name}</p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">{item.product?.product_code}</p>
                            </td>
                            <td className="py-3 px-2 text-center align-top">
                              <span className="inline-block px-2 py-1 text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded">
                                {item.product?.unit || '-'}
                              </span>
                            </td>
                            <td className="py-3 px-2 text-right text-sm align-top text-gray-900 dark:text-white">
                              {new Intl.NumberFormat('th-TH').format(item.unit_price)} ฿
                            </td>
                            <td className="py-3 px-2 text-center align-top">
                              <input
                                type="number"
                                value={item.quantity === '' ? '' : item.quantity}
                                onChange={(e) => handleUpdateQuantity(index, e.target.value)}
                                className="w-full px-2 py-1 border border-gray-300 dark:border-slate-600 rounded text-center bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                                min="0"
                                inputMode="decimal"
                                placeholder="จำนวน"
                              />
                            </td>
                            <td className="py-3 px-2 text-center align-top">
                              <input
                                type="number"
                                value={item.discount_percent === '' ? '' : item.discount_percent}
                                onChange={(e) => handleUpdateDiscount(index, e.target.value)}
                                className="w-full px-2 py-1 border border-gray-300 dark:border-slate-600 rounded text-center bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                                min="0"
                                max="100"
                                step="0.01"
                                placeholder="%"
                              />
                            </td>
                            <td className="py-3 px-2 text-right font-semibold text-gray-900 dark:text-white align-top">
                              {new Intl.NumberFormat('th-TH').format(lineTotal)} ฿
                            </td>
                            <td className="py-3 px-2 text-center align-top">
                              <button
                                onClick={() => handleRemoveItem(index)}
                                className="p-1 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {orderItems.length === 0 && (
                <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                  <ShoppingCart className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>ยังไม่มีสินค้าในรายการ</p>
                  <p className="text-sm mt-1">ค้นหาและเพิ่มสินค้าด้านบน</p>
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Right: Summary */}
        <div className="space-y-6">
          <Card>
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">สรุปออเดอร์</h3>

              <div className="space-y-3 mb-4">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">ยอดรวม:</span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {new Intl.NumberFormat('th-TH').format(calculateTotal.subtotal)} ฿
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">ส่วนลด:</span>
                  <span className="font-semibold text-red-600 dark:text-red-400">
                    -{new Intl.NumberFormat('th-TH').format(calculateTotal.discountAmount)} ฿
                  </span>
                </div>
                <div className="flex justify-between pt-3 border-t border-gray-200 dark:border-slate-700">
                  <span className="font-semibold text-gray-900 dark:text-white">ยอดสุทธิ:</span>
                  <span className="font-bold text-xl text-blue-600 dark:text-blue-400">
                    {new Intl.NumberFormat('th-TH').format(calculateTotal.total)} ฿
                  </span>
                </div>
              </div>

              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    วันที่ต้องการส่ง
                  </label>
                  <input
                    type="date"
                    value={deliveryDate}
                    onChange={(e) => setDeliveryDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    หมายเหตุ
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                    rows={3}
                    placeholder="หมายเหตุเพิ่มเติม..."
                  />
                </div>
              </div>

              <div className="flex gap-2">
                {onCancel && (
                  <Button
                    variant="outline"
                    onClick={onCancel}
                    disabled={isSubmitting}
                    className="flex-1"
                  >
                    ยกเลิก
                  </Button>
                )}
                <Button
                  onClick={handleSubmit}
                  disabled={!selectedStore || orderItems.length === 0 || isSubmitting}
                  className="flex-1"
                >
                  {isSubmitting ? 'กำลังบันทึก...' : 'บันทึกการแก้ไข'}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Warning Dialog for Assigned Trip */}
      <ConfirmDialog
        isOpen={showWarningDialog}
        onCancel={() => setShowWarningDialog(false)}
        onConfirm={performUpdate}
        title="ยืนยันการแก้ไขออเดอร์"
        message={
          <div className="space-y-2">
            <p className="font-semibold text-orange-600 dark:text-orange-400">
              ⚠️ ออเดอร์นี้ถูกกำหนดทริปแล้ว
            </p>
            <p>คุณแน่ใจหรือไม่ว่าต้องการแก้ไขออเดอร์นี้?</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              การแก้ไขอาจส่งผลกระทบต่อทริปที่กำหนดไว้แล้ว กรุณาตรวจสอบข้อมูลให้ถูกต้อง
            </p>
          </div>
        }
        confirmText="ยืนยันแก้ไข"
        cancelText="ยกเลิก"
        variant="warning"
      />
    </PageLayout>
  );
}
