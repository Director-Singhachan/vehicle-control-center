import React, { useState, useMemo, useEffect } from 'react';
import { Package, Plus, Search, Edit2, Trash2, Filter, Download, ChevronLeft, ChevronRight } from 'lucide-react';
import { useProducts, useProductCategories } from '../hooks/useInventory';
import { productService } from '../services/inventoryService';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { PageLayout } from '../components/ui/PageLayout';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { Modal } from '../components/ui/Modal';
import { useNotification } from '../hooks/useNotification';
import { ProductPalletConfigManager } from '../components/product/ProductPalletConfigManager';
import type { Database } from '../types/database';

type ProductInsert = Database['public']['Tables']['products']['Insert'];
type ProductUpdate = Database['public']['Tables']['products']['Update'];

export function ProductsManagementView() {
  const { products, loading, refetch } = useProducts();
  const { categories } = useProductCategories();
  const { showNotification } = useNotification();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageInput, setPageInput] = useState('');
  const [itemsPerPage, setItemsPerPage] = useState(100);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [formData, setFormData] = useState<{
    product_code: string;
    product_name: string;
    description: string;
    category: string;
    unit: string;
    base_price: string;
    cost_per_unit: string;
    barcode: string;
    min_stock_level?: string;
    // Extra fields for AI/trip optimization
    weight_kg?: string;
    length_cm?: string;
    width_cm?: string;
    height_cm?: string;
    is_fragile?: boolean;
    is_liquid?: boolean;
    requires_temperature?: string;
    uses_pallet?: boolean;
  }>({
    product_code: '',
    product_name: '',
    description: '',
    category: '',
    unit: 'ชิ้น',
    base_price: '',
    cost_per_unit: '',
    barcode: '',
    min_stock_level: '',
    weight_kg: '',
    length_cm: '',
    width_cm: '',
    height_cm: '',
    is_fragile: false,
    is_liquid: false,
    requires_temperature: '',
    uses_pallet: false,
  });

  // กรองสินค้า (รองรับรหัสสินค้า product_code และชื่อสินค้า product_name)
  const filteredProducts = useMemo(() => {
    const keyword = searchQuery.toLowerCase();
    return products.filter((product: any) => {
      const matchesSearch =
        product.product_name?.toLowerCase().includes(keyword) ||
        product.product_code?.toLowerCase().includes(keyword);

      const matchesCategory =
        selectedCategory === 'all' ||
        product.category === selectedCategory ||
        product.category_id === selectedCategory || // เผื่อข้อมูลเก่า
        product.category?.id === selectedCategory;

      return matchesSearch && matchesCategory;
    });
  }, [products, searchQuery, selectedCategory]);

  // Pagination (client-side)
  const totalCount = filteredProducts.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / itemsPerPage));
  const offset = (currentPage - 1) * itemsPerPage;
  const paginatedProducts = filteredProducts.slice(offset, offset + itemsPerPage);
  const startIndex = totalCount === 0 ? 0 : offset;
  const endIndex = totalCount === 0 ? 0 : Math.min(offset + itemsPerPage, totalCount);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedCategory, itemsPerPage]);

  const handleOpenModal = (product?: any) => {
    if (product) {
      setEditingProduct(product);
      setFormData({
        product_code: product.product_code || '',
        product_name: product.product_name || '',
        description: product.description || '',
        category: product.category?.id || product.category || '',
        unit: product.unit || '',
        base_price: product.base_price?.toString() || product.price_per_unit?.toString() || '',
        cost_per_unit: product.cost_per_unit?.toString() || '',
        barcode: product.barcode || '',
        min_stock_level: product.min_stock_level !== undefined && product.min_stock_level !== null
          ? product.min_stock_level.toString()
          : '',
        weight_kg: product.weight_kg !== undefined && product.weight_kg !== null ? product.weight_kg.toString() : '',
        length_cm: (product as any).length_cm !== undefined && (product as any).length_cm !== null
          ? String((product as any).length_cm)
          : '',
        width_cm: (product as any).width_cm !== undefined && (product as any).width_cm !== null
          ? String((product as any).width_cm)
          : '',
        height_cm: (product as any).height_cm !== undefined && (product as any).height_cm !== null
          ? String((product as any).height_cm)
          : '',
        is_fragile: (product as any).is_fragile ?? false,
        is_liquid: (product as any).is_liquid ?? false,
        requires_temperature: (product as any).requires_temperature || '',
        uses_pallet: (product as any).uses_pallet ?? false,
      });
    } else {
      setEditingProduct(null);
      setFormData({
        product_code: '',
        product_name: '',
        description: '',
        category: '',
        unit: 'ชิ้น',
        base_price: '',
        cost_per_unit: '',
        barcode: '',
        min_stock_level: '',
        weight_kg: '',
        length_cm: '',
        width_cm: '',
        height_cm: '',
        is_fragile: false,
        is_liquid: false,
        requires_temperature: '',
        uses_pallet: false,
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
      const toNumberOrNull = (v: string | undefined) => {
        if (v === undefined || v === '') return null;
        const n = Number(v);
        return isNaN(n) ? null : n;
      };

      // ใช้ any เพื่อรองรับฟิลด์เสริมอย่าง min_stock_level ที่อาจยังไม่อยู่ใน type ที่ gen มาจาก DB
      const payload: any = {
        product_code: formData.product_code,
        product_name: formData.product_name,
        description: formData.description || null,
        category: formData.category || null,
        unit: formData.unit || null,
        base_price: toNumberOrNull(formData.base_price),
        cost_per_unit: toNumberOrNull(formData.cost_per_unit),
        barcode: formData.barcode || null,
        // Extra fields for AI/trip optimization
        weight_kg: toNumberOrNull(formData.weight_kg),
        length_cm: toNumberOrNull(formData.length_cm),
        width_cm: toNumberOrNull(formData.width_cm),
        height_cm: toNumberOrNull(formData.height_cm),
        is_fragile: !!formData.is_fragile,
        is_liquid: !!formData.is_liquid,
        requires_temperature: formData.requires_temperature || null,
      };

      // NOTE: Database constraint ถูกลบไปแล้ว (20260129000001_remove_pallet_constraint.sql)
      // ตอนนี้สามารถตั้ง uses_pallet=true ได้โดยไม่จำเป็นต้องมี pallet_id
      // Logic การคำนวณใน tripCapacityValidation.ts จะดูที่ product_pallet_configs เป็นหลัก
      payload.uses_pallet = !!formData.uses_pallet;

      // เพิ่ม min_stock_level เฉพาะถ้ามีค่า (เพื่อหลีกเลี่ยง error ถ้ายังไม่มีคอลัมน์ในฐานข้อมูล)
      // ถ้าต้องการใช้ min_stock_level ให้รัน migration: sql/add_min_stock_level_to_products.sql ก่อน
      const minStockLevel = toNumberOrNull(formData.min_stock_level);
      if (minStockLevel !== null && minStockLevel !== undefined) {
        payload.min_stock_level = minStockLevel;
      }

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
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
          <input
            type="text"
            placeholder="ค้นหาสินค้า (ชื่อหรือรหัสสินค้า)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
          />
        </div>

        {/* Category Filter + Page size */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="pl-10 pr-8 py-2.5 border border-gray-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent appearance-none"
            >
              <option value="all">ทุกหมวดหมู่</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          <select
            value={itemsPerPage}
            onChange={(e) => {
              setItemsPerPage(Number(e.target.value));
              setCurrentPage(1);
            }}
            className="px-2 py-2 text-xs border border-gray-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value={20}>20 รายการ/หน้า</option>
            <option value={50}>50 รายการ/หน้า</option>
            <option value={100}>100 รายการ/หน้า</option>
          </select>

          {/* Add Button */}
          <Button onClick={() => handleOpenModal()} className="flex items-center gap-2">
            <Plus className="w-5 h-5" />
            <span>เพิ่มสินค้า</span>
          </Button>
        </div>
      </div>

      {/* Products Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50">
                <th className="text-left py-4 px-6 text-sm font-semibold text-gray-700 dark:text-gray-300">รหัสสินค้า</th>
                <th className="text-left py-4 px-6 text-sm font-semibold text-gray-700 dark:text-gray-300">สินค้า</th>
                <th className="text-left py-4 px-6 text-sm font-semibold text-gray-700 dark:text-gray-300">หมวดหมู่</th>
                <th className="text-right py-4 px-6 text-sm font-semibold text-gray-700 dark:text-gray-300">ราคาขาย</th>
                <th className="text-right py-4 px-6 text-sm font-semibold text-gray-700 dark:text-gray-300">ทุน</th>
                <th className="text-center py-4 px-6 text-sm font-semibold text-gray-700 dark:text-gray-300">หน่วย</th>
                <th className="text-right py-4 px-6 text-sm font-semibold text-gray-700 dark:text-gray-300">สต็อกต่ำสุด</th>
                <th className="text-center py-4 px-6 text-sm font-semibold text-gray-700 dark:text-gray-300">การกระทำ</th>
              </tr>
            </thead>
            <tbody>
              {paginatedProducts.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-6 px-6 text-center text-gray-500 dark:text-gray-400">
                    ไม่พบสินค้าที่ค้นหา (ทั้งหมด {products.length} รายการ)
                  </td>
                </tr>
              )}
              {paginatedProducts.map((product: any) => (
                <tr key={product.id} className="border-b border-gray-100 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
                  <td className="py-4 px-6">
                    <code className="text-sm font-mono bg-gray-100 dark:bg-slate-800 text-gray-900 dark:text-white px-2 py-1 rounded">
                      {product.product_code}
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
                        <p className="font-medium text-gray-900 dark:text-white">{product.product_name}</p>
                        {product.description && (
                          <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-1">{product.description}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <div className="text-sm text-gray-700 dark:text-gray-300">
                      {product.category?.name || product.category || '-'}
                    </div>
                  </td>
                  <td className="py-4 px-6 text-right font-medium text-gray-900 dark:text-white">
                    {new Intl.NumberFormat('th-TH').format(product.base_price || product.price_per_unit || 0)} ฿
                  </td>
                  <td className="py-4 px-6 text-right text-gray-600 dark:text-gray-400">
                    {new Intl.NumberFormat('th-TH').format(product.cost_per_unit || 0)} ฿
                  </td>
                  <td className="py-4 px-6 text-center text-sm text-gray-600 dark:text-gray-400">
                    {product.unit}
                  </td>
                  <td className="py-4 px-6 text-right text-sm text-gray-600 dark:text-gray-400">
                    {product.min_stock_level ?? 0}
                  </td>
                  <td className="py-4 px-6">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => handleOpenModal(product)}
                        className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                        title="แก้ไข"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(product.id, product.product_name)}
                        className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
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
        </div>

        {/* Pagination */}
        {totalCount > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-4 py-4 border-t border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/40">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              แสดง {startIndex + 1} - {endIndex} จาก {totalCount.toLocaleString('th-TH')} รายการ
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="flex items-center gap-1"
              >
                <ChevronLeft size={16} />
                ก่อนหน้า
              </Button>

              {/* Page Numbers */}
              <div className="flex items-center gap-1 flex-wrap">
                {(() => {
                  const pages: (number | string)[] = [];

                  if (totalPages <= 7) {
                    for (let i = 1; i <= totalPages; i++) {
                      pages.push(i);
                    }
                  } else {
                    pages.push(1);

                    const startPage = Math.max(2, currentPage - 2);
                    const endPage = Math.min(totalPages - 1, currentPage + 2);

                    if (startPage > 2) {
                      pages.push('ellipsis-start');
                    }

                    for (let i = startPage; i <= endPage; i++) {
                      if (i !== 1 && i !== totalPages) {
                        pages.push(i);
                      }
                    }

                    if (endPage < totalPages - 1) {
                      pages.push('ellipsis-end');
                    }

                    pages.push(totalPages);
                  }

                  return pages.map((page) => {
                    if (typeof page === 'string') {
                      return (
                        <span key={page} className="px-2 text-gray-400">
                          ...
                        </span>
                      );
                    }

                    return (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${currentPage === page
                          ? 'bg-blue-600 text-white'
                          : 'bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-slate-700 hover:bg-gray-100 dark:hover:bg-slate-700'
                          }`}
                      >
                        {page.toLocaleString('th-TH')}
                      </button>
                    );
                  });
                })()}
              </div>

              {/* Jump to page when many pages */}
              {totalPages > 10 && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600 dark:text-gray-400">ไปที่หน้า:</span>
                  <input
                    type="number"
                    min={1}
                    max={totalPages}
                    value={pageInput}
                    onChange={(e) => setPageInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const page = parseInt(pageInput);
                        if (page >= 1 && page <= totalPages) {
                          setCurrentPage(page);
                          setPageInput('');
                        }
                      }
                    }}
                    placeholder={`1-${totalPages}`}
                    className="w-20 px-2 py-1 text-sm border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const page = parseInt(pageInput);
                      if (page >= 1 && page <= totalPages) {
                        setCurrentPage(page);
                        setPageInput('');
                      }
                    }}
                  >
                    ไป
                  </Button>
                </div>
              )}

              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                className="flex items-center gap-1"
              >
                ถัดไป
                <ChevronRight size={16} />
              </Button>
            </div>
          </div>
        )}
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
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                รหัสสินค้า <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.product_code}
                onChange={(e) => setFormData({ ...formData, product_code: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                หมวดหมู่
              </label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
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

          {/* Extra fields: dimensions & weight for AI/trip optimization */}
          <div className="mt-4 border-t border-gray-200 dark:border-slate-700 pt-4">
            <h3 className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-3">
              ข้อมูลขนาดและคุณสมบัติ (ใช้ช่วยวางแผนทริป / AI) — ไม่บังคับ
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  น้ำหนักต่อหน่วย (กก.)
                </label>
                <input
                  type="number"
                  step="0.001"
                  value={formData.weight_kg}
                  onChange={(e) => setFormData({ ...formData, weight_kg: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                  placeholder="เช่น 0.75"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  ยาว (ซม.)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={formData.length_cm}
                  onChange={(e) => setFormData({ ...formData, length_cm: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                  placeholder="เช่น 30"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  กว้าง (ซม.)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={formData.width_cm}
                  onChange={(e) => setFormData({ ...formData, width_cm: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                  placeholder="เช่น 20"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  สูง (ซม.)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={formData.height_cm}
                  onChange={(e) => setFormData({ ...formData, height_cm: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                  placeholder="เช่น 15"
                />
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
              <div className="flex items-center gap-2">
                <input
                  id="is_fragile"
                  type="checkbox"
                  checked={!!formData.is_fragile}
                  onChange={(e) => setFormData({ ...formData, is_fragile: e.target.checked })}
                  className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="is_fragile" className="text-sm text-gray-700 dark:text-gray-300">
                  เป็นของแตกง่าย
                </label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  id="is_liquid"
                  type="checkbox"
                  checked={!!formData.is_liquid}
                  onChange={(e) => setFormData({ ...formData, is_liquid: e.target.checked })}
                  className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="is_liquid" className="text-sm text-gray-700 dark:text-gray-300">
                  เป็นของเหลว
                </label>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  อุณหภูมิที่ต้องการ
                </label>
                <select
                  value={formData.requires_temperature}
                  onChange={(e) => setFormData({ ...formData, requires_temperature: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                >
                  <option value="">ปกติ (อุณหภูมิห้อง)</option>
                  <option value="cold">เย็น (Cold)</option>
                  <option value="frozen">แช่แข็ง (Frozen)</option>
                </select>
              </div>
            </div>

            <div className="mt-4 flex items-center gap-2">
              <input
                id="uses_pallet"
                type="checkbox"
                checked={!!formData.uses_pallet}
                onChange={(e) => setFormData({ ...formData, uses_pallet: e.target.checked })}
                className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <label htmlFor="uses_pallet" className="text-sm text-gray-700 dark:text-gray-300">
                สินค้านี้วางบนพาเลท (ใช้สำหรับคำนวณการจัดทริป)
              </label>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              ชื่อสินค้า <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.product_name}
              onChange={(e) => setFormData({ ...formData, product_name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              คำอธิบาย
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                หน่วย
              </label>
              <input
                type="text"
                value={formData.unit}
                onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                ราคาขาย (฿)
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.base_price}
                onChange={(e) => setFormData({ ...formData, base_price: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                placeholder="เช่น 25.00"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                ทุน (฿)
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.cost_per_unit}
                onChange={(e) => setFormData({ ...formData, cost_per_unit: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                placeholder="เช่น 18.50"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Barcode
              </label>
              <input
                type="text"
                value={formData.barcode}
                onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                สต็อกต่ำสุด
              </label>
              <input
                type="number"
                value={formData.min_stock_level}
                onChange={(e) => setFormData({ ...formData, min_stock_level: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                placeholder="ใส่ตัวเลข หรือเว้นว่าง"
              />
            </div>
          </div>

          <div className="flex gap-3 justify-end pt-4 border-t dark:border-slate-700">
            <Button type="button" onClick={handleCloseModal} variant="outline">
              ยกเลิก
            </Button>
            <Button type="submit">
              {editingProduct ? 'บันทึก' : 'เพิ่มสินค้า'}
            </Button>
          </div>
        </form>

        {/* Product Pallet Config Manager - แสดงเฉพาะเมื่อแก้ไขสินค้าที่มี id แล้ว */}
        {editingProduct?.id && (
          <div className="mt-6 pt-6 border-t border-gray-200 dark:border-slate-700">
            <ProductPalletConfigManager
              productId={editingProduct.id}
              productName={editingProduct.product_name || formData.product_name || 'สินค้า'}
              canEdit={true}
            />
          </div>
        )}
      </Modal>
    </PageLayout>
  );
}

