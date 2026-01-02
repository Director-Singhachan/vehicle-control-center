import React, { useState, useMemo } from 'react';
import { Package, Plus, Search, Edit2, Trash2, Filter, Download } from 'lucide-react';
import { useProducts, useProductCategories } from '../hooks/useInventory';
import { productService } from '../services/inventoryService';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { PageLayout } from '../components/ui/PageLayout';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { Modal } from '../components/ui/Modal';
import { useNotification } from '../hooks/useNotification';
import type { Database } from '../types/database';

type ProductInsert = Database['public']['Tables']['products']['Insert'];
type ProductUpdate = Database['public']['Tables']['products']['Update'];

export function ProductsManagementView() {
  const { products, loading, refetch } = useProducts();
  const { categories } = useProductCategories();
  const { showNotification } = useNotification();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [formData, setFormData] = useState<{
    product_code: string;
    product_name: string;
    description: string;
    category: string;
    unit: string;
    base_price: number;
    cost_per_unit: number;
    barcode: string;
    min_stock_level?: number;
  }>({
    product_code: '',
    product_name: '',
    description: '',
    category: '',
    unit: 'ชิ้น',
    base_price: 0,
    cost_per_unit: 0,
    barcode: '',
    min_stock_level: 0,
  });

  // กรองสินค้า (รองรับรหัสสินค้า product_code และชื่อสินค้า product_name)
  const filteredProducts = useMemo(() => {
    const keyword = searchQuery.toLowerCase();
    return products.filter((product: any) => {
      const matchesSearch =
        product.product_name?.toLowerCase().includes(keyword) ||
        product.product_code?.toLowerCase().includes(keyword) ||
        product.name?.toLowerCase().includes(keyword) || // เผื่อข้อมูลเก่า
        product.sku?.toLowerCase().includes(keyword);    // เผื่อข้อมูลเก่า

      const matchesCategory =
        selectedCategory === 'all' ||
        product.category === selectedCategory ||
        product.category_id === selectedCategory || // เผื่อข้อมูลเก่า
        product.category?.id === selectedCategory;

      return matchesSearch && matchesCategory;
    });
  }, [products, searchQuery, selectedCategory]);

  const handleOpenModal = (product?: any) => {
    if (product) {
      setEditingProduct(product);
      setFormData({
        product_code: product.product_code || product.sku || '',
        product_name: product.product_name || product.name || '',
        description: product.description || '',
        category: product.category?.id || product.category || '',
        unit: product.unit || '',
        base_price: product.base_price || product.price_per_unit || 0,
        cost_per_unit: product.cost_per_unit || 0,
        barcode: product.barcode || '',
        min_stock_level: product.min_stock_level ?? 0,
      });
    } else {
      setEditingProduct(null);
      setFormData({
        product_code: '',
        product_name: '',
        description: '',
        category: '',
        unit: 'ชิ้น',
        base_price: 0,
        cost_per_unit: 0,
        barcode: '',
        min_stock_level: 0,
      });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingProduct(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const payload: Partial<ProductInsert> = {
        product_code: formData.product_code,
        product_name: formData.product_name,
        description: formData.description || null,
        category: formData.category || null,
        unit: formData.unit || null,
        base_price: formData.base_price ?? 0,
        cost_per_unit: formData.cost_per_unit ?? 0,
        barcode: formData.barcode || null,
      };

      if (editingProduct) {
        await productService.update(editingProduct.id, payload as ProductUpdate);
        showNotification('success', 'อัพเดทสินค้าเรียบร้อย');
      } else {
        await productService.create(payload as ProductInsert);
        showNotification('success', 'เพิ่มสินค้าเรียบร้อย');
      }
      
      refetch();
      handleCloseModal();
    } catch (error: any) {
      showNotification('error', error.message || 'เกิดข้อผิดพลาด');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`ต้องการลบสินค้า "${name}" ใช่หรือไม่?`)) return;

    try {
      await productService.delete(id);
      showNotification('success', 'ลบสินค้าเรียบร้อย');
      refetch();
    } catch (error: any) {
      showNotification('error', error.message || 'เกิดข้อผิดพลาดในการลบ');
    }
  };

  if (loading) {
    return (
      <PageLayout title="จัดการสินค้า">
        <div className="flex items-center justify-center h-64">
          <LoadingSpinner />
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout title="จัดการสินค้า">
      {/* Header Actions */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        {/* Search */}
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="ค้นหาสินค้า (ชื่อหรือรหัสสินค้า)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Category Filter */}
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="pl-10 pr-8 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none bg-white"
          >
            <option value="all">ทุกหมวดหมู่</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>

        {/* Add Button */}
        <Button onClick={() => handleOpenModal()} className="flex items-center gap-2">
          <Plus className="w-5 h-5" />
          <span>เพิ่มสินค้า</span>
        </Button>
      </div>

      {/* Products Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left py-4 px-6 text-sm font-semibold text-gray-700">รหัสสินค้า</th>
                <th className="text-left py-4 px-6 text-sm font-semibold text-gray-700">สินค้า</th>
                <th className="text-left py-4 px-6 text-sm font-semibold text-gray-700">หมวดหมู่</th>
                <th className="text-right py-4 px-6 text-sm font-semibold text-gray-700">ราคาขาย</th>
                <th className="text-right py-4 px-6 text-sm font-semibold text-gray-700">ทุน</th>
                <th className="text-center py-4 px-6 text-sm font-semibold text-gray-700">หน่วย</th>
                <th className="text-right py-4 px-6 text-sm font-semibold text-gray-700">สต็อกต่ำสุด</th>
                <th className="text-center py-4 px-6 text-sm font-semibold text-gray-700">การกระทำ</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-6 px-6 text-center text-gray-500">
                    ไม่พบสินค้าที่ค้นหา (ทั้งหมด {products.length} รายการ)
                  </td>
                </tr>
              )}
              {filteredProducts.map((product: any) => (
                <tr key={product.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                  <td className="py-4 px-6">
                    <code className="text-sm font-mono bg-gray-100 px-2 py-1 rounded">
                      {product.product_code || product.sku}
                    </code>
                  </td>
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-3">
                      {product.category?.color && (
                        <div 
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: product.category.color }}
                        />
                      )}
                      <div>
                        <p className="font-medium text-gray-900">{product.product_name || product.name}</p>
                        {product.description && (
                          <p className="text-sm text-gray-500 line-clamp-1">{product.description}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-6">
                  <div className="text-sm text-gray-700">
                    {product.category?.name || product.category || '-'}
                  </div>
                  </td>
                  <td className="py-4 px-6 text-right font-medium text-gray-900">
                    {new Intl.NumberFormat('th-TH').format(product.base_price || product.price_per_unit || 0)} ฿
                  </td>
                  <td className="py-4 px-6 text-right text-gray-600">
                    {new Intl.NumberFormat('th-TH').format(product.cost_per_unit || 0)} ฿
                  </td>
                  <td className="py-4 px-6 text-center text-sm text-gray-600">
                    {product.unit}
                  </td>
                  <td className="py-4 px-6 text-right text-sm text-gray-600">
                    {product.min_stock_level ?? 0}
                  </td>
                  <td className="py-4 px-6">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => handleOpenModal(product)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="แก้ไข"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(product.id, product.product_name || product.name)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="ลบ"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredProducts.length === 0 && (
            <div className="text-center py-16 text-gray-500">
              <Package className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">ไม่พบสินค้า</p>
              <p className="text-sm mt-1">ลองค้นหาด้วยคำอื่นหรือเพิ่มสินค้าใหม่</p>
            </div>
          )}
        </div>
      </Card>

      {/* Add/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={editingProduct ? 'แก้ไขสินค้า' : 'เพิ่มสินค้าใหม่'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                รหัสสินค้า <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.product_code}
                onChange={(e) => setFormData({ ...formData, product_code: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                หมวดหมู่
              </label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">-- เลือกหมวดหมู่ --</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              ชื่อสินค้า <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.product_name}
              onChange={(e) => setFormData({ ...formData, product_name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              คำอธิบาย
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                หน่วย
              </label>
              <input
                type="text"
                value={formData.unit}
                onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                ราคาขาย (฿)
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.base_price}
                onChange={(e) => setFormData({ ...formData, base_price: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                ทุน (฿)
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.cost_per_unit}
                onChange={(e) => setFormData({ ...formData, cost_per_unit: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Barcode
              </label>
              <input
                type="text"
                value={formData.barcode}
                onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                สต็อกต่ำสุด
              </label>
              <input
                type="number"
                value={formData.min_stock_level}
                onChange={(e) => setFormData({ ...formData, min_stock_level: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="flex gap-3 justify-end pt-4 border-t">
            <Button type="button" onClick={handleCloseModal} variant="outline">
              ยกเลิก
            </Button>
            <Button type="submit">
              {editingProduct ? 'บันทึก' : 'เพิ่มสินค้า'}
            </Button>
          </div>
        </form>
      </Modal>
    </PageLayout>
  );
}

