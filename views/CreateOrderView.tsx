import React, { useState, useMemo, useRef, useEffect } from 'react';
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
  quantity: number | ''; // allow empty while typing
  unit_price: number;
  discount_percent: number | ''; // allow empty while typing
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

  // Refs สำหรับ click outside
  const storeDropdownRef = useRef<HTMLDivElement>(null);
  const productDropdownRef = useRef<HTMLDivElement>(null);

  // ปิด dropdown เมื่อคลิกข้างนอก
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // ปิด store dropdown
      if (storeDropdownRef.current && !storeDropdownRef.current.contains(event.target as Node)) {
        if (stores.length > 0) {
          setStores([]);
          setStoreSearch('');
        }
      }
      
      // ปิด product dropdown
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
    
    console.log('[CreateOrderView] Filtering products:', {
      totalProducts: products?.length || 0,
      searchQuery: productSearch,
      sampleProducts: products?.slice(0, 3).map((p: any) => ({ 
        code: p.product_code, 
        name: p.product_name 
      }))
    });
    
    if (!products || products.length === 0) return [];
    
    const filtered = products.filter((product: any) => 
      product.product_name?.toLowerCase().includes(productSearch.toLowerCase()) ||
      product.product_code?.toLowerCase().includes(productSearch.toLowerCase())
    ).slice(0, 10);
    
    console.log('[CreateOrderView] Filtered results:', filtered.length);
    
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
        quantity: '', // let user type freely
        unit_price: price || product.base_price || 0,
        discount_percent: '', // let user type freely
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
    if (value === '') {
      updated[index].quantity = '';
    } else {
      const num = Math.max(0, Number(value) || 0);
      updated[index].quantity = num;
    }
    setOrderItems(updated);
  };

  // อัพเดทส่วนลด
  const handleUpdateDiscount = (index: number, value: string) => {
    const updated = [...orderItems];
    if (value === '') {
      updated[index].discount_percent = '';
    } else {
      const num = Number(value);
      // clamp 0-100 but allow typing decimals
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

  // validate quantities > 0
  const hasInvalidQuantity = orderItems.some(item => Number(item.quantity || 0) <= 0);
  if (hasInvalidQuantity) {
    showNotification('error', 'กรุณาใส่จำนวนสินค้ามากกว่า 0');
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
          store_id: selectedStore.id,
          order_date: new Date().toISOString().split('T')[0],
          status: 'confirmed',
          notes: notes || null,
          delivery_address: selectedStore.address || null,
          created_by: user?.id,
        },
        orderItems.map(item => ({
          product_id: item.product_id,
          quantity: Number(item.quantity || 0),
          unit_price: item.unit_price,
          discount_percent: Number(item.discount_percent || 0),
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
          <Card className={`overflow-visible ${stores.length > 0 && !selectedStore ? 'relative z-50' : ''}`}>
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">1. เลือกร้านค้า</h3>
              
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
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">2. เพิ่มสินค้า</h3>
              
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

                {/* Loading indicator */}
                {productsLoading && productSearch && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <LoadingSpinner size={20} />
                  </div>
                )}

                {/* Show results if found */}
                {productSearch && !productsLoading && (
                  <>
                    {filteredProducts.length > 0 ? (
                      <div className="absolute z-50 w-full mt-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-xl shadow-lg dark:shadow-black/50 max-h-60 overflow-y-auto">
                        {filteredProducts.map((product: any) => (
                          <button
                            key={product.id}
                            onClick={() => handleAddProduct(product)}
                            className="w-full p-4 text-left hover:bg-gray-50 dark:hover:bg-slate-700/50 border-b border-gray-100 dark:border-slate-700 last:border-b-0 flex items-center justify-between"
                          >
                            <div>
                              <p className="font-medium text-gray-900 dark:text-white">{product.product_name}</p>
                              <p className="text-sm text-gray-500 dark:text-gray-400">{product.product_code}</p>
                            </div>
                            <p className="text-sm font-semibold text-blue-600 dark:text-blue-400">
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
                            : 'ยังไม่มีข้อมูลสินค้าในระบบ กรุณาเพิ่มสินค้าก่อน'}
                        </p>
                      </div>
                    )}
                    <div className="mt-2 text-xs text-gray-500 dark:text-gray-400 text-right">
                      ผลลัพธ์: {filteredProducts.length} รายการ
                    </div>
                  </>
                )}

                {/* Debug info - remove in production */}
                {productSearch && !productsLoading && (
                  <div className="mt-2 text-xs text-gray-400 dark:text-gray-500">
                    ข้อมูลสินค้าทั้งหมด: {products?.length || 0} รายการ
                  </div>
                )}
              </div>

              {/* Order Items Table */}
              {orderItems.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full table-fixed">
                    <colgroup>
                      <col className="w-[32%]" />
                      <col className="w-[16%]" />
                      <col className="w-[16%]" />
                      <col className="w-[16%]" />
                      <col className="w-[16%]" />
                      <col className="w-[4%]" />
                    </colgroup>
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-slate-700">
                        <th className="text-left py-3 px-2 text-sm font-semibold text-gray-700 dark:text-gray-300">สินค้า</th>
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

