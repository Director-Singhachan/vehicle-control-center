import React, { useState, useMemo } from 'react';
import { ShoppingCart, Plus, Trash2, Search, Check } from 'lucide-react';
import { useProducts } from '../hooks/useInventory';
import { ordersService } from '../services/ordersService';
import { productTierPriceService } from '../services/customerTierService';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { PageLayout } from '../components/ui/PageLayout';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { useAuth } from '../hooks';
import { supabase } from '../lib/supabase';

interface OrderItem {
  product_id: string;
  product?: any;
  quantity: number;
  unit_price: number;
  discount_percent: number;
}

export function CreateOrderView() {
  const { products, loading: productsLoading } = useProducts();
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

  const [selectedStore, setSelectedStore] = useState<any>(null);
  const [stores, setStores] = useState<any[]>([]);
  const [storesLoading, setStoresLoading] = useState(false);
  const [storeSearch, setStoreSearch] = useState('');

  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [notes, setNotes] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);

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
    
    return products
      .filter((product: any) => 
        product.product_name?.toLowerCase().includes(productSearch.toLowerCase()) ||
        product.product_code?.toLowerCase().includes(productSearch.toLowerCase())
      )
      .slice(0, 10);
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
        quantity: 1,
        unit_price: price || product.base_price || 0,
        discount_percent: 0,
      };

      setOrderItems([...orderItems, newItem]);
      setProductSearch('');
    } catch (error: any) {
      showNotification('error', 'ไม่สามารถดึงราคาสินค้าได้');
    }
  };

  // อัพเดทจำนวนสินค้า
  const handleUpdateQuantity = (index: number, quantity: number) => {
    if (quantity < 1) return;
    
    const updated = [...orderItems];
    updated[index].quantity = quantity;
    setOrderItems(updated);
  };

  // อัพเดทส่วนลด
  const handleUpdateDiscount = (index: number, discount: number) => {
    if (discount < 0 || discount > 100) return;
    
    const updated = [...orderItems];
    updated[index].discount_percent = discount;
    setOrderItems(updated);
  };

  // ลบสินค้า
  const handleRemoveItem = (index: number) => {
    setOrderItems(orderItems.filter((_, i) => i !== index));
  };

  // คำนวณยอดรวม
  const calculateTotal = useMemo(() => {
    const subtotal = orderItems.reduce((sum, item) => {
      return sum + (item.unit_price * item.quantity);
    }, 0);

    const discountAmount = orderItems.reduce((sum, item) => {
      return sum + (item.unit_price * item.quantity * item.discount_percent / 100);
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

    if (orderItems.length === 0) {
      showNotification('error', 'กรุณาเพิ่มสินค้าอย่างน้อย 1 รายการ');
      return;
    }

    setIsSubmitting(true);

    try {
      await ordersService.createWithItems(
        {
          customer_id: selectedStore.id,
          order_date: new Date().toISOString().split('T')[0],
          status: 'confirmed',
          notes: notes || null,
          delivery_address: selectedStore.address || null,
          delivery_latitude: selectedStore.latitude || null,
          delivery_longitude: selectedStore.longitude || null,
          created_by: user?.id,
        },
        orderItems.map(item => ({
          product_id: item.product_id,
          quantity: item.quantity,
          unit_price: item.unit_price,
          discount_percent: item.discount_percent,
        }))
      );

      showNotification('success', 'สร้างออเดอร์เรียบร้อย');
      
      // Reset form
      setSelectedStore(null);
      setOrderItems([]);
      setNotes('');
      setDeliveryDate('');
    } catch (error: any) {
      showNotification('error', error.message || 'เกิดข้อผิดพลาดในการสร้างออเดอร์');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <PageLayout title="สร้างออเดอร์ใหม่">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Store & Products Selection */}
        <div className="lg:col-span-2 space-y-6">
          {/* Store Selection */}
          <Card>
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">1. เลือกร้านค้า</h3>
              
              {selectedStore ? (
                <div className="flex items-center justify-between p-4 bg-green-50 border-2 border-green-200 rounded-xl">
                  <div className="flex items-center gap-3">
                    <Check className="w-5 h-5 text-green-600" />
                    <div>
                      <p className="font-semibold text-gray-900">{selectedStore.customer_name}</p>
                      <p className="text-sm text-gray-600">{selectedStore.customer_code}</p>
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
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="ค้นหาร้านค้า (ชื่อหรือรหัส)..."
                    value={storeSearch}
                    onChange={(e) => handleStoreSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500"
                  />
                  
                  {storesLoading && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <LoadingSpinner size={20} />
                    </div>
                  )}

                  {stores.length > 0 && (
                    <div className="absolute z-10 w-full mt-2 bg-white border border-gray-200 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                      {stores.map((store) => (
                        <button
                          key={store.id}
                          onClick={() => handleSelectStore(store)}
                          className="w-full p-4 text-left hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                        >
                          <p className="font-medium text-gray-900">{store.customer_name}</p>
                          <p className="text-sm text-gray-500">{store.customer_code}</p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </Card>

          {/* Products Selection */}
          <Card>
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">2. เพิ่มสินค้า</h3>
              
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="ค้นหาสินค้า..."
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500"
                  disabled={!selectedStore}
                />

                {filteredProducts.length > 0 && productSearch && (
                  <div className="absolute z-10 w-full mt-2 bg-white border border-gray-200 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                    {filteredProducts.map((product: any) => (
                      <button
                        key={product.id}
                        onClick={() => handleAddProduct(product)}
                        className="w-full p-4 text-left hover:bg-gray-50 border-b border-gray-100 last:border-b-0 flex items-center justify-between"
                      >
                        <div>
                          <p className="font-medium text-gray-900">{product.product_name}</p>
                          <p className="text-sm text-gray-500">{product.product_code}</p>
                        </div>
                        <p className="text-sm font-semibold text-blue-600">
                          {new Intl.NumberFormat('th-TH').format(product.base_price)} ฿
                        </p>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Order Items Table */}
              {orderItems.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-3 px-2 text-sm font-semibold text-gray-700">สินค้า</th>
                        <th className="text-right py-3 px-2 text-sm font-semibold text-gray-700">ราคา</th>
                        <th className="text-center py-3 px-2 text-sm font-semibold text-gray-700">จำนวน</th>
                        <th className="text-center py-3 px-2 text-sm font-semibold text-gray-700">ส่วนลด%</th>
                        <th className="text-right py-3 px-2 text-sm font-semibold text-gray-700">รวม</th>
                        <th className="text-center py-3 px-2 text-sm font-semibold text-gray-700"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {orderItems.map((item, index) => {
                        const lineTotal = (item.unit_price * item.quantity) - (item.unit_price * item.quantity * item.discount_percent / 100);
                        
                        return (
                          <tr key={index} className="border-b border-gray-100">
                            <td className="py-3 px-2">
                              <p className="font-medium text-gray-900 text-sm">{item.product?.product_name}</p>
                              <p className="text-xs text-gray-500">{item.product?.product_code}</p>
                            </td>
                            <td className="py-3 px-2 text-right text-sm">
                              {new Intl.NumberFormat('th-TH').format(item.unit_price)} ฿
                            </td>
                            <td className="py-3 px-2">
                              <input
                                type="number"
                                value={item.quantity}
                                onChange={(e) => handleUpdateQuantity(index, parseInt(e.target.value) || 1)}
                                className="w-20 px-2 py-1 border border-gray-300 rounded text-center"
                                min="1"
                              />
                            </td>
                            <td className="py-3 px-2">
                              <input
                                type="number"
                                value={item.discount_percent}
                                onChange={(e) => handleUpdateDiscount(index, parseFloat(e.target.value) || 0)}
                                className="w-16 px-2 py-1 border border-gray-300 rounded text-center"
                                min="0"
                                max="100"
                                step="0.01"
                              />
                            </td>
                            <td className="py-3 px-2 text-right font-semibold text-gray-900">
                              {new Intl.NumberFormat('th-TH').format(lineTotal)} ฿
                            </td>
                            <td className="py-3 px-2 text-center">
                              <button
                                onClick={() => handleRemoveItem(index)}
                                className="p-1 text-red-600 hover:bg-red-50 rounded"
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
                <div className="text-center py-12 text-gray-500">
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
              <h3 className="text-lg font-semibold text-gray-900 mb-4">สรุปออเดอร์</h3>
              
              <div className="space-y-3 mb-4">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">ยอดรวม:</span>
                  <span className="font-semibold">
                    {new Intl.NumberFormat('th-TH').format(calculateTotal.subtotal)} ฿
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">ส่วนลด:</span>
                  <span className="font-semibold text-red-600">
                    -{new Intl.NumberFormat('th-TH').format(calculateTotal.discountAmount)} ฿
                  </span>
                </div>
                <div className="flex justify-between pt-3 border-t border-gray-200">
                  <span className="font-semibold text-gray-900">ยอดสุทธิ:</span>
                  <span className="font-bold text-xl text-blue-600">
                    {new Intl.NumberFormat('th-TH').format(calculateTotal.total)} ฿
                  </span>
                </div>
              </div>

              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    วันที่ต้องการส่ง
                  </label>
                  <input
                    type="date"
                    value={deliveryDate}
                    onChange={(e) => setDeliveryDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    หมายเหตุ
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    rows={3}
                    placeholder="หมายเหตุเพิ่มเติม..."
                  />
                </div>
              </div>

              <Button
                onClick={handleSubmit}
                disabled={!selectedStore || orderItems.length === 0 || isSubmitting}
                className="w-full"
              >
                {isSubmitting ? 'กำลังบันทึก...' : 'สร้างออเดอร์'}
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </PageLayout>
  );
}

