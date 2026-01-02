import React, { useState, useMemo } from 'react';
import { DollarSign, Plus, Edit2, Trash2, Search, Copy, TrendingUp, Package } from 'lucide-react';
import { useProducts } from '../hooks/useInventory';
import { useCustomerTiers, useProductTierPrices } from '../hooks/useCustomerTiers';
import { productTierPriceService } from '../services/customerTierService';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { PageLayout } from '../components/ui/PageLayout';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { Modal } from '../components/ui/Modal';
import { useNotification } from '../hooks/useNotification';
import { useAuth } from '../hooks';
import type { Database } from '../types/database';

type ProductTierPriceInsert = Database['public']['Tables']['product_tier_prices']['Insert'];

export function ProductTierPricingView() {
  const { products, loading: productsLoading } = useProducts();
  const { tiers, loading: tiersLoading } = useCustomerTiers();
  const { showNotification } = useNotification();
  const { user } = useAuth();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [isPriceModalOpen, setIsPriceModalOpen] = useState(false);
  const [editingPrice, setEditingPrice] = useState<any>(null);
  const [priceFormData, setPriceFormData] = useState<Partial<ProductTierPriceInsert>>({
    tier_id: '',
    price: 0,
    min_quantity: 1,
  });

  const { prices: productPrices, loading: pricesLoading, refetch: refetchPrices } = useProductTierPrices(
    selectedProduct?.id || null
  );

  // กรองสินค้า
  const filteredProducts = useMemo(() => {
    if (!searchQuery) return products;
    
    return products.filter((product: any) => 
      product.product_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.product_code?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [products, searchQuery]);

  // จัดกลุ่มราคาตาม tier
  const pricesByTier = useMemo(() => {
    const grouped: Record<string, any[]> = {};
    
    productPrices.forEach((price: any) => {
      const tierId = price.tier_id;
      if (!grouped[tierId]) {
        grouped[tierId] = [];
      }
      grouped[tierId].push(price);
    });

    return grouped;
  }, [productPrices]);

  const handleSelectProduct = (product: any) => {
    setSelectedProduct(product);
  };

  const handleOpenPriceModal = (price?: any) => {
    if (price) {
      setEditingPrice(price);
      setPriceFormData({
        tier_id: price.tier_id,
        price: price.price,
        min_quantity: price.min_quantity,
        effective_from: price.effective_from,
        effective_to: price.effective_to,
      });
    } else {
      setEditingPrice(null);
      setPriceFormData({
        tier_id: '',
        price: selectedProduct?.base_price || 0,
        min_quantity: 1,
      });
    }
    setIsPriceModalOpen(true);
  };

  const handleClosePriceModal = () => {
    setIsPriceModalOpen(false);
    setEditingPrice(null);
  };

  const handleSubmitPrice = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedProduct) return;

    try {
      if (editingPrice) {
        await productTierPriceService.update(editingPrice.id, {
          ...priceFormData,
          created_by: user?.id,
        });
        showNotification('success', 'อัพเดทราคาเรียบร้อย');
      } else {
        await productTierPriceService.create({
          product_id: selectedProduct.id,
          ...priceFormData,
          created_by: user?.id,
        } as ProductTierPriceInsert);
        showNotification('success', 'เพิ่มราคาเรียบร้อย');
      }
      
      refetchPrices();
      handleClosePriceModal();
    } catch (error: any) {
      showNotification('error', error.message || 'เกิดข้อผิดพลาด');
    }
  };

  const handleDeletePrice = async (id: string) => {
    if (!confirm('ต้องการลบราคานี้ใช่หรือไม่?')) return;

    try {
      await productTierPriceService.delete(id);
      showNotification('success', 'ลบราคาเรียบร้อย');
      refetchPrices();
    } catch (error: any) {
      showNotification('error', error.message || 'เกิดข้อผิดพลาดในการลบ');
    }
  };

  const handleCopyFromTier = async () => {
    // TODO: Implement copy prices from another tier
    alert('ฟีเจอร์นี้กำลังพัฒนา');
  };

  const getPriceForTier = (tierId: string) => {
    const tierPrices = pricesByTier[tierId] || [];
    if (tierPrices.length === 0) return null;
    return tierPrices[0]; // ราคาแรก (min_quantity = 1)
  };

  const calculateMargin = (price: number, cost: number) => {
    if (price === 0) return 0;
    return ((price - cost) / price * 100).toFixed(2);
  };

  if (productsLoading || tiersLoading) {
    return (
      <PageLayout title="กำหนดราคาสินค้า">
        <div className="flex items-center justify-center h-64">
          <LoadingSpinner />
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout title="กำหนดราคาสินค้า">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Product List */}
        <div className="lg:col-span-1">
          <Card>
            <div className="p-4 border-b border-gray-200">
              <h3 className="font-semibold text-gray-900 mb-3">เลือกสินค้า</h3>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="ค้นหาสินค้า..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>
            </div>
            <div className="max-h-[600px] overflow-y-auto">
              {filteredProducts.map((product: any) => (
                <button
                  key={product.id}
                  onClick={() => handleSelectProduct(product)}
                  className={`w-full text-left p-4 border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                    selectedProduct?.id === product.id ? 'bg-blue-50 border-blue-200' : ''
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="font-medium text-gray-900 text-sm">{product.product_name}</p>
                      <p className="text-xs text-gray-500 mt-1">{product.product_code}</p>
                      <p className="text-xs text-gray-600 mt-1">
                        ราคาฐาน: {new Intl.NumberFormat('th-TH').format(product.base_price || 0)} ฿
                      </p>
                    </div>
                    {selectedProduct?.id === product.id && (
                      <div className="w-2 h-2 bg-blue-500 rounded-full ml-2 mt-1" />
                    )}
                  </div>
                </button>
              ))}
              {filteredProducts.length === 0 && (
                <div className="text-center py-12 text-gray-500">
                  <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>ไม่พบสินค้า</p>
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Right: Pricing Details */}
        <div className="lg:col-span-2">
          {selectedProduct ? (
            <Card>
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900">{selectedProduct.product_name}</h3>
                    <p className="text-sm text-gray-500 mt-1">รหัส: {selectedProduct.product_code}</p>
                  </div>
                  <Button onClick={() => handleOpenPriceModal()} className="flex items-center gap-2">
                    <Plus className="w-4 h-4" />
                    <span>เพิ่มราคา</span>
                  </Button>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <p className="text-xs text-gray-600">ราคาฐาน</p>
                    <p className="text-lg font-semibold text-gray-900 mt-1">
                      {new Intl.NumberFormat('th-TH').format(selectedProduct.base_price || 0)} ฿
                    </p>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <p className="text-xs text-gray-600">ทุน</p>
                    <p className="text-lg font-semibold text-gray-900 mt-1">
                      {new Intl.NumberFormat('th-TH').format(selectedProduct.cost_per_unit || 0)} ฿
                    </p>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <p className="text-xs text-gray-600">หน่วย</p>
                    <p className="text-lg font-semibold text-gray-900 mt-1">
                      {selectedProduct.unit}
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-6">
                <h4 className="font-semibold text-gray-900 mb-4">ราคาตามระดับลูกค้า</h4>
                
                {pricesLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <LoadingSpinner />
                  </div>
                ) : (
                  <div className="space-y-4">
                    {tiers.map((tier) => {
                      const tierPrice = getPriceForTier(tier.id);
                      const allTierPrices = pricesByTier[tier.id] || [];

                      return (
                        <div 
                          key={tier.id}
                          className="border border-gray-200 rounded-xl overflow-hidden"
                        >
                          <div 
                            className="p-4 flex items-center justify-between"
                            style={{ backgroundColor: `${tier.color}10` }}
                          >
                            <div className="flex items-center gap-3">
                              <div 
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: tier.color }}
                              />
                              <div>
                                <p className="font-medium text-gray-900">{tier.tier_name}</p>
                                <p className="text-sm text-gray-500">ส่วนลด {tier.discount_percent}%</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              {tierPrice ? (
                                <>
                                  <div className="text-right">
                                    <p className="text-xl font-bold text-gray-900">
                                      {new Intl.NumberFormat('th-TH').format(tierPrice.price)} ฿
                                    </p>
                                    <p className="text-xs text-gray-500">
                                      กำไร {calculateMargin(tierPrice.price, selectedProduct.cost_per_unit)}%
                                    </p>
                                  </div>
                                  <button
                                    onClick={() => handleOpenPriceModal(tierPrice)}
                                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                  >
                                    <Edit2 className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => handleDeletePrice(tierPrice.id)}
                                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </>
                              ) : (
                                <Badge variant="warning">ยังไม่กำหนด</Badge>
                              )}
                            </div>
                          </div>

                          {/* Quantity-based pricing */}
                          {allTierPrices.length > 1 && (
                            <div className="p-4 bg-gray-50 border-t border-gray-200">
                              <p className="text-xs font-medium text-gray-600 mb-2">ราคาตามจำนวน:</p>
                              <div className="space-y-2">
                                {allTierPrices.map((price: any) => (
                                  <div key={price.id} className="flex items-center justify-between text-sm">
                                    <span className="text-gray-600">
                                      ขั้นต่ำ {price.min_quantity} {selectedProduct.unit}
                                    </span>
                                    <div className="flex items-center gap-2">
                                      <span className="font-medium text-gray-900">
                                        {new Intl.NumberFormat('th-TH').format(price.price)} ฿
                                      </span>
                                      <button
                                        onClick={() => handleOpenPriceModal(price)}
                                        className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                                      >
                                        <Edit2 className="w-3 h-3" />
                                      </button>
                                      <button
                                        onClick={() => handleDeletePrice(price.id)}
                                        className="p-1 text-red-600 hover:bg-red-50 rounded"
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </Card>
          ) : (
            <Card>
              <div className="text-center py-24 text-gray-500">
                <DollarSign className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">เลือกสินค้าเพื่อกำหนดราคา</p>
                <p className="text-sm mt-2">คลิกที่สินค้าทางซ้ายเพื่อเริ่มต้น</p>
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Price Modal */}
      <Modal
        isOpen={isPriceModalOpen}
        onClose={handleClosePriceModal}
        title={editingPrice ? 'แก้ไขราคา' : 'เพิ่มราคาสำหรับระดับลูกค้า'}
      >
        <form onSubmit={handleSubmitPrice} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              ระดับลูกค้า <span className="text-red-500">*</span>
            </label>
            <select
              value={priceFormData.tier_id}
              onChange={(e) => setPriceFormData({ ...priceFormData, tier_id: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              required
              disabled={!!editingPrice}
            >
              <option value="">-- เลือกระดับลูกค้า --</option>
              {tiers.map((tier) => (
                <option key={tier.id} value={tier.id}>
                  {tier.tier_name} (ส่วนลด {tier.discount_percent}%)
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                ราคา (฿) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                value={priceFormData.price}
                onChange={(e) => setPriceFormData({ ...priceFormData, price: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
                min="0"
              />
              {selectedProduct && (
                <p className="text-xs text-gray-500 mt-1">
                  กำไร: {calculateMargin(priceFormData.price || 0, selectedProduct.cost_per_unit)}%
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                จำนวนขั้นต่ำ
              </label>
              <input
                type="number"
                value={priceFormData.min_quantity}
                onChange={(e) => setPriceFormData({ ...priceFormData, min_quantity: parseInt(e.target.value) || 1 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                min="1"
              />
              <p className="text-xs text-gray-500 mt-1">สำหรับราคาขั้นบันได</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                วันที่เริ่มใช้
              </label>
              <input
                type="date"
                value={priceFormData.effective_from || ''}
                onChange={(e) => setPriceFormData({ ...priceFormData, effective_from: e.target.value || null })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                วันที่สิ้นสุด
              </label>
              <input
                type="date"
                value={priceFormData.effective_to || ''}
                onChange={(e) => setPriceFormData({ ...priceFormData, effective_to: e.target.value || null })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="flex gap-3 justify-end pt-4 border-t">
            <Button type="button" onClick={handleClosePriceModal} variant="outline">
              ยกเลิก
            </Button>
            <Button type="submit">
              {editingPrice ? 'บันทึก' : 'เพิ่มราคา'}
            </Button>
          </div>
        </form>
      </Modal>
    </PageLayout>
  );
}

