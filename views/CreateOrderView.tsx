import React, { useState, useMemo, useRef, useEffect } from 'react';
import { ShoppingCart, Plus, Trash2, Search, Check, Grid3x3, Clock, Gift, Truck, Store, FileText, History } from 'lucide-react';
import { useIncompleteOrdersCount } from '../hooks/useIncompleteOrdersCount';
import { useProducts, useWarehouses, useProductCategories } from '../hooks/useInventory';
import { ordersService } from '../services/ordersService';
import { productTierPriceService } from '../services/customerTierService';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { PageLayout } from '../components/ui/PageLayout';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { ToastContainer } from '../components/ui/Toast';
import { useAuth, useToast } from '../hooks';
import { supabase } from '../lib/supabase';
import { PaymentStatusBadge, PaymentStatus } from '../components/order/PaymentStatusBadge';
import { OrderUploadModal } from '../components/order/OrderUploadModal';

interface OrderItem {
  product_id: string;
  product?: any;
  quantity: number | ''; // allow empty while typing
  unit_price: number;
  discount_percent: number | ''; // allow empty while typing
  is_bonus?: boolean; // ของแถม
  fulfillment_method?: 'delivery' | 'pickup'; // วิธีรับสินค้า
}

type FulfillmentMode = 'delivery' | 'pickup' | 'mixed';

// LocalStorage keys
const RECENT_PRODUCTS_KEY = 'recent_products';
const MAX_RECENT_PRODUCTS = 20;

interface CreateOrderViewProps {
  onNavigateToPendingSales?: () => void;
  onNavigateToConfirmOrders?: () => void;
}

export const CreateOrderView: React.FC<CreateOrderViewProps> = ({ 
  onNavigateToPendingSales,
  onNavigateToConfirmOrders
}) => {
  const { products, loading: productsLoading } = useProducts();
  const { warehouses, loading: warehousesLoading } = useWarehouses();
  const { categories, loading: categoriesLoading } = useProductCategories();
  const { count: incompleteCount } = useIncompleteOrdersCount();
  const { profile } = useAuth();
  const { toasts, success, error, warning, dismissToast } = useToast();

  const [selectedStore, setSelectedStore] = useState<any>(null);
  const [selectedWarehouse, setSelectedWarehouse] = useState<any>(null);
  const [stores, setStores] = useState<any[]>([]);
  const [storesLoading, setStoresLoading] = useState(false);
  const [storeSearch, setStoreSearch] = useState('');

  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showProductBrowser, setShowProductBrowser] = useState(false);
  const [recentProducts, setRecentProducts] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [deliveryTimeSlot, setDeliveryTimeSlot] = useState<'เช้า' | 'บ่าย' | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus | ''>('');

  const [isSubmitting, setIsSubmitting] = useState(false);

  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

  // Filter warehouses based on user branch
  const filteredWarehouses = useMemo(() => {
    if (!warehouses) return [];
    const isHighLevel = profile?.role === 'admin' || profile?.role === 'manager' || profile?.role === 'inspector' || profile?.role === 'executive';
    if (isHighLevel || profile?.branch === 'HQ') {
      return warehouses;
    }
    return warehouses.filter(w => w.branch === profile?.branch);
  }, [warehouses, profile]);

  // Set default warehouse if only one is available
  useEffect(() => {
    if (filteredWarehouses.length === 1 && !selectedWarehouse) {
      setSelectedWarehouse(filteredWarehouses[0]);
    }
  }, [filteredWarehouses, selectedWarehouse]);

  // Refs สำหรับ click outside
  const storeDropdownRef = useRef<HTMLDivElement>(null);
  const productDropdownRef = useRef<HTMLDivElement>(null);
  const priceUpdateTimeouts = useRef<Record<string, NodeJS.Timeout>>({});
  const quantityInputRefs = useRef<Array<HTMLInputElement | null>>([]);

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
      let queryBuilder = supabase
        .from('stores')
        .select('*, customer_tiers(tier_name, tier_code, color)')
        .or(`customer_name.ilike.%${query}%,customer_code.ilike.%${query}%`)
        .eq('is_active', true);

      // Filter by branch for restricted users
      const isHighLevel = profile?.role === 'admin' || profile?.role === 'manager' || profile?.role === 'inspector' || profile?.role === 'executive';
      if (!isHighLevel && profile?.branch && profile?.branch !== 'HQ') {
        queryBuilder = queryBuilder.eq('branch', profile.branch);
      }

      const { data, error } = await queryBuilder.limit(10);

      if (error) throw error;
      setStores(data || []);
    } catch (error: any) {
      error('เกิดข้อผิดพลาดในการค้นหาร้านค้า');
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

  // โหลด recent products จาก localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(RECENT_PRODUCTS_KEY);
      if (stored) {
        setRecentProducts(JSON.parse(stored));
      }
    } catch (err) {
      console.error('Error loading recent products:', err);
    }
  }, []);

  // เก็บ recent product เมื่อเพิ่มสินค้า
  const addToRecentProducts = (productId: string) => {
    try {
      const updated = [productId, ...recentProducts.filter(id => id !== productId)]
        .slice(0, MAX_RECENT_PRODUCTS);
      setRecentProducts(updated);
      localStorage.setItem(RECENT_PRODUCTS_KEY, JSON.stringify(updated));
    } catch (err) {
      console.error('Error saving recent products:', err);
    }
  };

  // กรองสินค้า - ค้นหาทั้งชื่อ, รหัส, barcode, description
  const filteredProducts = useMemo(() => {
    if (!products || products.length === 0) return [];

    // ถ้ามีการค้นหา ให้ค้นหาตามคำค้นหา
    if (productSearch) {
      const searchLower = productSearch.toLowerCase();
      const filtered = products.filter((product: any) =>
        product.product_name?.toLowerCase().includes(searchLower) ||
        product.product_code?.toLowerCase().includes(searchLower) ||
        product.barcode?.toLowerCase().includes(searchLower) ||
        product.description?.toLowerCase().includes(searchLower) ||
        product.category?.toLowerCase().includes(searchLower)
      );

      // เรียงลำดับ: ตรงกับรหัสสินค้า > ตรงกับชื่อ > อื่นๆ
      const sorted = filtered.sort((a: any, b: any) => {
        const aCodeMatch = a.product_code?.toLowerCase().startsWith(searchLower) ? 0 : 1;
        const bCodeMatch = b.product_code?.toLowerCase().startsWith(searchLower) ? 0 : 1;
        if (aCodeMatch !== bCodeMatch) return aCodeMatch - bCodeMatch;

        const aNameMatch = a.product_name?.toLowerCase().startsWith(searchLower) ? 0 : 1;
        const bNameMatch = b.product_name?.toLowerCase().startsWith(searchLower) ? 0 : 1;
        if (aNameMatch !== bNameMatch) return aNameMatch - bNameMatch;

        return 0;
      });

      return sorted.slice(0, 20); // แสดงสูงสุด 20 รายการ
    }

    // ถ้ายังไม่พิมพ์ แสดงสินค้าตามหมวดหมู่ที่เลือก
    if (selectedCategory === 'all') {
      return products?.slice(0, 50) || []; // แสดง 50 รายการแรก
    }

    if (selectedCategory === 'recent') {
      return []; // recent products จะแสดงแยก
    }

    return products?.filter((p: any) => p.category === selectedCategory).slice(0, 50) || [];
  }, [products, productSearch, selectedCategory]);

  // สินค้าที่ใช้ล่าสุด
  const recentProductsList = useMemo(() => {
    if (!products || recentProducts.length === 0) return [];
    return recentProducts
      .map(id => products.find((p: any) => p.id === id))
      .filter(Boolean)
      .slice(0, 10);
  }, [products, recentProducts]);

  // เพิ่มสินค้า
  const handleAddProduct = async (product: any, asBonus: boolean = false) => {
    if (!selectedStore) {
      error('กรุณาเลือกร้านค้าก่อน');
      return;
    }

    const existingItem = orderItems.find(
      item => item.product_id === product.id && !item.is_bonus
    );
    if (!asBonus && existingItem) {
      warning('สินค้านี้มีในรายการแล้ว (สามารถเพิ่มเป็นของแถมได้)');
      return;
    }

    try {
      // คำนวณราคาตาม tier (ถ้าไม่ใช่ของแถม)
      let price = 0;
      if (!asBonus) {
        price = await productTierPriceService.calculatePriceForStore(
          product.id,
          selectedStore.id,
          1
        ) || product.base_price || 0;
      }

      const newItem: OrderItem = {
        product_id: product.id,
        product: product,
        quantity: '', // let user type freely
        unit_price: price,
        discount_percent: '', // let user type freely
        is_bonus: asBonus,
        fulfillment_method: 'delivery',
      };

      setOrderItems([...orderItems, newItem]);

      // เก็บ recent product
      addToRecentProducts(product.id);

      // ซ่อนการเลือกสินค้าอัตโนมัติเมื่อกดเพิ่ม
      setShowProductBrowser(false);
      setProductSearch('');
    } catch (error: any) {
      error('ไม่สามารถดึงราคาสินค้าได้');
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

    // Debounce price update based on quantity (Volume Discount)
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

  const handleQuantityKeyDown = (
    index: number,
    event: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    const nextInput = quantityInputRefs.current[index + 1];
    if (nextInput) {
      nextInput.focus();
      nextInput.select();
    }
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

  // Toggle ของแถม
  const handleToggleBonus = (index: number) => {
    const updated = [...orderItems];
    const item = updated[index];
    const newIsBonus = !item.is_bonus;

    updated[index] = {
      ...item,
      is_bonus: newIsBonus,
      unit_price: newIsBonus ? 0 : (item.product?.base_price || 0), // ถ้าเป็นของแถมให้ราคาเป็น 0
    };

    setOrderItems(updated);

    // ถ้าเปลี่ยนจากของแถมเป็นปกติ ต้องคำนวณราคาใหม่
    if (!newIsBonus && selectedStore && item.product_id) {
      const qty = Number(item.quantity || 0);
      if (qty > 0) {
        productTierPriceService.calculatePriceForStore(
          item.product_id,
          selectedStore.id,
          qty
        ).then(price => {
          setOrderItems(prev => prev.map((p, i) =>
            i === index ? { ...p, unit_price: price || p.product?.base_price || 0 } : p
          ));
        }).catch(err => {
          console.error('Error updating price:', err);
        });
      }
    }
  };

  // คำนวณยอดรวม (ไม่นับของแถม)
  const calculateTotal = useMemo(() => {
    const subtotal = orderItems
      .filter(item => !item.is_bonus) // ไม่นับของแถม
      .reduce((sum, item) => {
        const qty = Number(item.quantity || 0);
        return sum + (item.unit_price * qty);
      }, 0);

    const discountAmount = orderItems
      .filter(item => !item.is_bonus) // ไม่นับของแถม
      .reduce((sum, item) => {
        const qty = Number(item.quantity || 0);
        const discount = Number(item.discount_percent || 0);
        return sum + (item.unit_price * qty * discount / 100);
      }, 0);

    const total = subtotal - discountAmount;

    return { subtotal, discountAmount, total };
  }, [orderItems]);

  // บันทึกออเดอร์
  const handleSubmit = async () => {
    if (!selectedWarehouse) {
      error('กรุณาเลือกคลังสินค้าก่อนสร้างออเดอร์');
      return;
    }

    if (!selectedStore) {
      error('กรุณาเลือกร้านค้า');
      return;
    }

    // validate quantities > 0
    const hasInvalidQuantity = orderItems.some(item => Number(item.quantity || 0) <= 0);
    if (hasInvalidQuantity) {
      error('กรุณาใส่จำนวนสินค้ามากกว่า 0');
      return;
    }

    if (orderItems.length === 0) {
      error('กรุณาเพิ่มสินค้าอย่างน้อย 1 รายการ');
      return;
    }

    setIsSubmitting(true);

    try {
      const orderInsert = {
        store_id: selectedStore.id,
        order_date: new Date().toISOString().split('T')[0],
        status: 'awaiting_confirmation',
        notes: notes || null,
        delivery_address: selectedStore.address || null,
        // บันทึกวันที่ต้องการส่ง (ถ้าไม่ได้เลือก ให้เป็น null)
        delivery_date: deliveryDate || null,
        created_by: profile?.id,
        warehouse_id: selectedWarehouse?.id || null,
      };

      const itemsToSubmit = orderItems.map(item => ({
        product_id: item.product_id,
        quantity: Number(item.quantity || 0),
        unit_price: item.is_bonus ? 0 : item.unit_price, // ของแถมราคาเป็น 0
        discount_percent: Number(item.discount_percent || 0),
        is_bonus: item.is_bonus || false,
        fulfillment_method: 'delivery',
      }));

      await ordersService.createWithItems(
        orderInsert,
        itemsToSubmit,
        paymentStatus || null,
        deliveryTimeSlot
      );

      success('สร้างออเดอร์เรียบร้อย');
      onNavigateToConfirmOrders?.();

      // Reset form
      setSelectedStore(null);
      // Keep warehouse selected for convenience
      setOrderItems([]);
      setNotes('');
      setDeliveryDate('');
      setDeliveryTimeSlot(null);
      setPaymentStatus('');
    } catch (err: any) {
      error(err.message || 'เกิดข้อผิดพลาดในการสร้างออเดอร์');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <PageLayout
        title="สร้างออเดอร์ใหม่"
        actions={
          <div className="flex items-center gap-2">
            <div className="relative">
              <Button
                onClick={onNavigateToPendingSales}
                variant="outline"
                className="flex items-center gap-2 bg-white text-orange-600 border-orange-200 hover:bg-orange-50 dark:bg-slate-800 dark:text-orange-400 dark:border-slate-700 dark:hover:bg-slate-700"
              >
                <FileText className="w-4 h-4" />
                ใบขายคงค้าง
              </Button>
              {incompleteCount > 0 && (
                <span className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow-sm ring-2 ring-white dark:ring-slate-900 animate-in zoom-in duration-300">
                  {incompleteCount > 99 ? '99+' : incompleteCount}
                </span>
              )}
            </div>
            <Button
              onClick={() => setIsUploadModalOpen(true)}
              variant="outline"
              className="flex items-center gap-2 bg-white text-blue-600 border-blue-200 hover:bg-blue-50 dark:bg-slate-800 dark:text-blue-400 dark:border-slate-700 dark:hover:bg-slate-700"
            >
              <Grid3x3 className="w-4 h-4" />
              อัพโหลดใบขาย
            </Button>
          </div>
        }
      >
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
                    {filteredWarehouses?.map((wh) => (
                      <div
                        key={wh.id}
                        onClick={() => setSelectedWarehouse(wh)}
                        className={`cursor-pointer p-4 rounded-xl border-2 transition-all ${selectedWarehouse?.id === wh.id
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                          : 'border-gray-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-700'
                          }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className={`text-sm font-medium px-2 py-0.5 rounded ${wh.type === 'main'
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
                        {selectedStore.customer_tiers ? (
                          <Badge
                            className="mt-1"
                            style={{
                              backgroundColor: `${selectedStore.customer_tiers.color}20`,
                              color: selectedStore.customer_tiers.color
                            }}
                          >
                            {selectedStore.customer_tiers.tier_name}
                          </Badge>
                        ) : null}
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
            <Card className={`overflow-visible ${(productSearch || showProductBrowser) && filteredProducts.length > 0 ? 'relative z-50' : ''}`}>
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">3. เพิ่มสินค้า</h3>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowProductBrowser(!showProductBrowser)}
                    disabled={!selectedStore}
                    className="flex items-center gap-2"
                  >
                    <Grid3x3 className="w-4 h-4" />
                    {showProductBrowser ? 'ซ่อน' : 'เลือกสินค้า'}
                  </Button>
                </div>

                <div className="relative mb-4" ref={productDropdownRef}>
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
                  <input
                    type="text"
                    placeholder="ค้นหาสินค้า (ชื่อ, รหัส, หรือบาร์โค้ด)..."
                    value={productSearch}
                    onChange={(e) => {
                      setProductSearch(e.target.value);
                      if (e.target.value) {
                        setShowProductBrowser(false);
                      }
                    }}
                    onFocus={() => {
                      if (!productSearch) {
                        setShowProductBrowser(true);
                      }
                    }}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={!selectedStore}
                  />

                  {/* Loading indicator */}
                  {productsLoading && productSearch && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <LoadingSpinner size={20} />
                    </div>
                  )}

                  {/* Product Browser - แสดงเมื่อยังไม่พิมพ์หรือกดปุ่มเลือกสินค้า */}
                  {showProductBrowser && !productSearch && !productsLoading && selectedStore && (
                    <div className="absolute z-50 w-full mt-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-xl shadow-lg dark:shadow-black/50 max-h-[600px] overflow-y-auto">
                      {/* Tabs: Recent, Categories */}
                      <div className="sticky top-0 bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 p-2 flex gap-2 overflow-x-auto">
                        {recentProductsList.length > 0 && (
                          <button
                            onClick={() => setSelectedCategory('recent')}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors flex items-center gap-1 ${selectedCategory === 'recent'
                              ? 'bg-blue-500 text-white'
                              : 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-600'
                              }`}
                          >
                            <Clock className="w-4 h-4" />
                            ใช้ล่าสุด ({recentProductsList.length})
                          </button>
                        )}
                        <button
                          onClick={() => setSelectedCategory('all')}
                          className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${selectedCategory === 'all'
                            ? 'bg-blue-500 text-white'
                            : 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-600'
                            }`}
                        >
                          ทั้งหมด
                        </button>
                        {categories.map((cat: any) => (
                          <button
                            key={cat.id || cat.name}
                            onClick={() => setSelectedCategory(cat.name || cat.id)}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${selectedCategory === (cat.name || cat.id)
                              ? 'bg-blue-500 text-white'
                              : 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-600'
                              }`}
                          >
                            {cat.name || cat.id}
                          </button>
                        ))}
                      </div>

                      {/* Products Grid */}
                      <div className="p-4">
                        {/* แสดงสินค้าที่ใช้ล่าสุด */}
                        {selectedCategory === 'recent' && recentProductsList.length > 0 && (
                          <div className="grid grid-cols-1 gap-2 max-h-[500px] overflow-y-auto">
                            {recentProductsList.map((product: any) => (
                              <div
                                key={product.id}
                                className="p-3 border border-gray-200 dark:border-slate-700 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors"
                              >
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                      <p className="font-medium text-gray-900 dark:text-white truncate">{product.product_name}</p>
                                      {product.unit ? (
                                        <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 text-xs">
                                          {product.unit}
                                        </Badge>
                                      ) : null}
                                    </div>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">{product.product_code}</p>
                                  </div>
                                  <p className="text-sm font-semibold text-blue-600 dark:text-blue-400 ml-2">
                                    {new Intl.NumberFormat('th-TH').format(product.base_price || 0)} ฿
                                  </p>
                                </div>
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => handleAddProduct(product, false)}
                                    className="flex-1 px-3 py-1.5 text-xs font-medium bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                                  >
                                    เพิ่ม
                                  </button>
                                  <button
                                    onClick={() => handleAddProduct(product, true)}
                                    className="flex-1 px-3 py-1.5 text-xs font-medium bg-green-500 text-white rounded hover:bg-green-600 transition-colors flex items-center justify-center gap-1"
                                  >
                                    <Gift className="w-3 h-3" />
                                    เพิ่มเป็นของแถม
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* แสดงสินค้าตามหมวดหมู่ */}
                        {selectedCategory !== 'recent' && (
                          <div className="grid grid-cols-1 gap-2 max-h-[500px] overflow-y-auto">
                            {filteredProducts.length > 0 ? (
                              filteredProducts.slice(0, 30).map((product: any) => (
                                <div
                                  key={product.id}
                                  className="p-3 border border-gray-200 dark:border-slate-700 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors"
                                >
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 mb-1">
                                        <p className="font-medium text-gray-900 dark:text-white truncate">{product.product_name}</p>
                                        {product.unit ? (
                                          <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 text-xs">
                                            {product.unit}
                                          </Badge>
                                        ) : null}
                                      </div>
                                      <p className="text-xs text-gray-500 dark:text-gray-400">{product.product_code}</p>
                                    </div>
                                    <p className="text-sm font-semibold text-blue-600 dark:text-blue-400 ml-2">
                                      {new Intl.NumberFormat('th-TH').format(product.base_price || 0)} ฿
                                    </p>
                                  </div>
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => handleAddProduct(product, false)}
                                      className="flex-1 px-3 py-1.5 text-xs font-medium bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                                    >
                                      เพิ่ม
                                    </button>
                                    <button
                                      onClick={() => handleAddProduct(product, true)}
                                      className="flex-1 px-3 py-1.5 text-xs font-medium bg-green-500 text-white rounded hover:bg-green-600 transition-colors flex items-center justify-center gap-1"
                                    >
                                      <Gift className="w-3 h-3" />
                                      เพิ่มเป็นของแถม
                                    </button>
                                  </div>
                                </div>
                              ))
                            ) : (
                              <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">
                                {selectedCategory === 'all'
                                  ? 'ยังไม่มีสินค้าในระบบ'
                                  : 'ไม่พบสินค้าในหมวดหมู่นี้'}
                              </p>
                            )}
                          </div>
                        )}

                        {/* แสดงข้อความเมื่อไม่มีสินค้าที่ใช้ล่าสุด */}
                        {selectedCategory === 'recent' && recentProductsList.length === 0 && (
                          <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">
                            ยังไม่มีสินค้าที่ใช้ล่าสุด
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Search Results - แสดงเมื่อพิมพ์ค้นหา */}
                  {productSearch && !productsLoading && (
                    <>
                      {filteredProducts.length > 0 ? (
                        <div className="absolute z-50 w-full mt-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-xl shadow-lg dark:shadow-black/50 max-h-[500px] overflow-y-auto">
                          {filteredProducts.map((product: any) => (
                            <div
                              key={product.id}
                              className="w-full p-4 hover:bg-gray-50 dark:hover:bg-slate-700/50 border-b border-gray-100 dark:border-slate-700 last:border-b-0"
                            >
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <p className="font-medium text-gray-900 dark:text-white truncate">{product.product_name}</p>
                                    {product.unit ? (
                                      <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 text-xs flex-shrink-0">
                                        {product.unit}
                                      </Badge>
                                    ) : null}
                                  </div>
                                  <p className="text-sm text-gray-500 dark:text-gray-400">{product.product_code}</p>
                                </div>
                                <p className="text-sm font-semibold text-blue-600 dark:text-blue-400 flex-shrink-0">
                                  {new Intl.NumberFormat('th-TH').format(product.base_price || 0)} ฿
                                </p>
                              </div>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleAddProduct(product, false)}
                                  className="flex-1 px-3 py-1.5 text-xs font-medium bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                                >
                                  เพิ่ม
                                </button>
                                <button
                                  onClick={() => handleAddProduct(product, true)}
                                  className="flex-1 px-3 py-1.5 text-xs font-medium bg-green-500 text-white rounded hover:bg-green-600 transition-colors flex items-center justify-center gap-1"
                                >
                                  <Gift className="w-3 h-3" />
                                  เพิ่มเป็นของแถม
                                </button>
                              </div>
                            </div>
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
                </div>

                {/* Order Items Table */}
                {orderItems.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full table-fixed">
                      <colgroup>
                        <col className="min-w-0 w-[26%]" />
                        <col className="w-[9%]" />
                        <col className="w-[13%]" />
                        <col className="w-[13%]" />
                        <col className="w-[13%]" />
                        <col className="w-[13%]" />
                        {/* คอลัมน์ลบ — ต้องมี col ครบทุกคอลัมน์ ไม่งั้น table-fixed จะให้ความกว้าง 0 ทำให้ปุ่มหาย */}
                        <col className="w-12 shrink-0" />
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
                            <tr key={index} className={`border-b border-gray-100 dark:border-slate-700 ${item.is_bonus ? 'bg-green-50 dark:bg-green-900/10' : ''}`}>
                              <td className="py-3 px-2 align-top">
                                <div className="flex items-start gap-2">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                      <p className="font-medium text-gray-900 dark:text-white text-sm">{item.product?.product_name}</p>
                                      {item.is_bonus ? (
                                        <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 text-xs flex items-center gap-1">
                                          <Gift className="w-3 h-3" />
                                          ของแถม
                                        </Badge>
                                      ) : null}
                                    </div>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">{item.product?.product_code}</p>
                                  </div>
                                  <button
                                    onClick={() => handleToggleBonus(index)}
                                    className="mt-1 p-1 text-gray-400 hover:text-green-600 dark:hover:text-green-400 transition-colors"
                                    title={item.is_bonus ? 'ยกเลิกของแถม' : 'ทำเป็นของแถม'}
                                  >
                                    <Gift className={`w-4 h-4 ${item.is_bonus ? 'text-green-600 dark:text-green-400' : ''}`} />
                                  </button>
                                </div>
                              </td>
                              <td className="py-3 px-2 text-center align-top">
                                <span className="inline-block px-2 py-1 text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded">
                                  {item.product?.unit || '-'}
                                </span>
                              </td>
                              <td className="py-3 px-2 text-right text-sm align-top text-gray-900 dark:text-white">
                                {item.is_bonus ? (
                                  <span className="text-green-600 dark:text-green-400 font-medium">ของแถม</span>
                                ) : (
                                  <span>{new Intl.NumberFormat('th-TH').format(item.unit_price)} ฿</span>
                                )}
                              </td>
                              <td className="py-3 px-2 text-center align-top">
                                <input
                                  type="number"
                                  value={item.quantity === '' ? '' : item.quantity}
                                  onChange={(e) => handleUpdateQuantity(index, e.target.value)}
                                  onKeyDown={(e) => handleQuantityKeyDown(index, e)}
                                  ref={(el) => {
                                    quantityInputRefs.current[index] = el;
                                  }}
                                  className="no-spinner w-full px-2 py-1 border border-gray-300 dark:border-slate-600 rounded text-center bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
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
                                {item.is_bonus ? (
                                  <span className="text-green-600 dark:text-green-400">0 ฿</span>
                                ) : (
                                  <span>{new Intl.NumberFormat('th-TH').format(lineTotal)} ฿</span>
                                )}
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
                  {paymentStatus && (
                    <div className="flex justify-center pt-2">
                      <PaymentStatusBadge status={paymentStatus} />
                    </div>
                  )}
                </div>

                <div className="space-y-4 mb-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      สถานะการชำระเงิน
                    </label>
                    <select
                      value={paymentStatus}
                      onChange={(e) => setPaymentStatus(e.target.value as PaymentStatus | '')}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                    >
                      <option value="">-- ไม่ระบุ --</option>
                      <option value="ชำระแล้ว">ชำระแล้ว</option>
                      <option value="รอชำระ">รอชำระ</option>
                      <option value="นัดชำระหนี้คงค้างเรียบร้อยแล้ว">นัดชำระหนี้คงค้างเรียบร้อยแล้ว</option>
                      <option value="รอชำระหนี้คงค้าง">รอชำระหนี้คงค้าง</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      วันที่ต้องการส่ง
                    </label>
                    <div className="flex gap-4">
                      <div className="flex-1">
                        <input
                          type="date"
                          value={deliveryDate}
                          onChange={(e) => setDeliveryDate(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                        />
                      </div>
                      <div className="flex items-center gap-4 bg-gray-50 dark:bg-slate-800/50 px-4 rounded-lg border border-gray-200 dark:border-slate-700">
                        <label className="flex items-center gap-2 cursor-pointer group">
                          <input
                            type="radio"
                            name="deliveryTimeSlot"
                            checked={deliveryTimeSlot === 'เช้า'}
                            onChange={() => setDeliveryTimeSlot('เช้า')}
                            className="w-4 h-4 text-enterprise-600 focus:ring-enterprise-500 border-gray-300"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300 group-hover:text-enterprise-600 transition-colors">เช้า</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer group">
                          <input
                            type="radio"
                            name="deliveryTimeSlot"
                            checked={deliveryTimeSlot === 'บ่าย'}
                            onChange={() => setDeliveryTimeSlot('บ่าย')}
                            className="w-4 h-4 text-enterprise-600 focus:ring-enterprise-500 border-gray-300"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300 group-hover:text-enterprise-600 transition-colors">บ่าย</span>
                        </label>
                        {deliveryTimeSlot && (
                          <button
                            onClick={() => setDeliveryTimeSlot(null)}
                            className="text-[10px] text-gray-400 hover:text-red-500 underline ml-1"
                          >
                            ล้าง
                          </button>
                        )}
                      </div>
                    </div>
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
                  disabled={!selectedWarehouse || !selectedStore || orderItems.length === 0 || isSubmitting}
                  className="w-full"
                >
                  {isSubmitting ? 'กำลังบันทึก...' : 'สร้างออเดอร์'}
                </Button>
              </div>
            </Card>

            {/* รายการสินค้าที่เลือก */}
            {orderItems.length > 0 && (
              <Card>
                <div className="p-6">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    รายการสินค้า ({orderItems.length} รายการ)
                  </h3>

                  <div className="space-y-2 max-h-[600px] overflow-y-auto">
                    {orderItems.map((item, index) => {
                      const qty = Number(item.quantity || 0);

                      return (
                        <div
                          key={index}
                          className={`p-3 rounded-lg border transition-all ${item.is_bonus
                            ? 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20'
                            : 'border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-blue-300 dark:hover:border-blue-700'
                            }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <p className="font-medium text-gray-900 dark:text-white text-sm truncate">
                                  {item.product?.product_name || 'ไม่ระบุชื่อ'}
                                </p>
                                {item.is_bonus && (
                                  <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 text-xs flex items-center gap-1 flex-shrink-0">
                                    <Gift className="w-3 h-3" />
                                    ของแถม
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                                {item.product?.product_code || '-'}
                              </p>
                              <div className="flex items-center gap-2">
                                <span className="text-sm text-gray-600 dark:text-gray-400">จำนวน:</span>
                                <span className="font-semibold text-gray-900 dark:text-white">
                                  {qty > 0 ? new Intl.NumberFormat('th-TH').format(qty) : '-'}
                                </span>
                                {item.product?.unit && (
                                  <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 text-xs">
                                    {item.product.unit}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </Card>
            )}
          </div>
        </div>
      </PageLayout>

      <OrderUploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onSuccess={() => {
          onNavigateToConfirmOrders?.();
        }}
        selectedWarehouse={selectedWarehouse}
      />
    </>
  );
}

