import React, { useState } from 'react';
import { Warehouse, Package, Plus, Edit2, Trash2, MapPin, User, ArrowDownCircle } from 'lucide-react';
import { useWarehouses, useInventory, useProducts } from '../hooks/useInventory';
import { warehouseService, inventoryService } from '../services/inventoryService';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { PageLayout } from '../components/ui/PageLayout';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { Modal } from '../components/ui/Modal';
import { useNotification } from '../hooks/useNotification';
import { useAuth } from '../hooks';

interface WarehouseRow {
  id: string;
  code: string;
  name: string;
  type: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  manager_id: string | null;
  capacity_m3: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export function WarehouseManagementView() {
  const { warehouses, loading, refetch } = useWarehouses();
  const { products } = useProducts();
  const { showNotification } = useNotification();
  const { user } = useAuth();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isInventoryModalOpen, setIsInventoryModalOpen] = useState(false);
  const [isStockInModalOpen, setIsStockInModalOpen] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState<any>(null);
  const [selectedWarehouse, setSelectedWarehouse] = useState<any>(null);
  const [formData, setFormData] = useState<Partial<WarehouseRow>>({
    code: '',
    name: '',
    type: 'branch',
    address: '',
  });

  const { inventory: warehouseInventory, loading: inventoryLoading, refetch: refetchInventory } = useInventory(
    selectedWarehouse?.id
  );

  const [stockInForm, setStockInForm] = useState<{
    product_id: string;
    quantity: number;
    note: string;
    ref_code: string;
  }>({
    product_id: '',
    quantity: 0,
    note: '',
    ref_code: '',
  });

  const [productSearch, setProductSearch] = useState('');

  const handleOpenModal = (warehouse?: any) => {
    if (warehouse) {
      setEditingWarehouse(warehouse);
      setFormData({
        code: warehouse.code,
        name: warehouse.name,
        type: warehouse.type,
        address: warehouse.address || '',
        latitude: warehouse.latitude,
        longitude: warehouse.longitude,
        capacity_m3: warehouse.capacity_m3,
      });
    } else {
      setEditingWarehouse(null);
      setFormData({
        code: '',
        name: '',
        type: 'branch',
        address: '',
      });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingWarehouse(null);
  };

  const handleViewInventory = (warehouse: any) => {
    setSelectedWarehouse(warehouse);
    setIsInventoryModalOpen(true);
  };

  const handleOpenStockIn = () => {
    if (!selectedWarehouse) {
      showNotification('warning', 'โปรดเลือกคลังสินค้าก่อน');
      return;
    }
    setStockInForm({ product_id: '', quantity: 0, note: '', ref_code: '' });
    setIsStockInModalOpen(true);
  };

  const handleStockInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWarehouse) {
      showNotification('warning', 'โปรดเลือกคลังสินค้าก่อน');
      return;
    }
    if (!stockInForm.product_id) {
      showNotification('warning', 'โปรดเลือกสินค้า');
      return;
    }
    if (stockInForm.quantity <= 0) {
      showNotification('warning', 'จำนวนต้องมากกว่า 0');
      return;
    }

    try {
      await inventoryService.adjustStock(
        selectedWarehouse.id,
        stockInForm.product_id,
        stockInForm.quantity,
        user?.id || 'system',
        stockInForm.note || undefined,
        stockInForm.ref_code || undefined
      );

      showNotification('success', 'รับสินค้าเข้าเรียบร้อย');
      setIsStockInModalOpen(false);
      await refetchInventory();
    } catch (error: any) {
      showNotification('error', error.message || 'เกิดข้อผิดพลาดในการรับสินค้าเข้า');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (editingWarehouse) {
        await warehouseService.update(editingWarehouse.id, formData);
        showNotification('success', 'อัพเดทคลังสินค้าเรียบร้อย');
      } else {
        await warehouseService.create(formData as Omit<WarehouseRow, 'id' | 'created_at' | 'updated_at'>);
        showNotification('success', 'เพิ่มคลังสินค้าเรียบร้อย');
      }

      refetch();
      handleCloseModal();
    } catch (error: any) {
      showNotification('error', error.message || 'เกิดข้อผิดพลาด');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`ต้องการลบคลัง "${name}" ใช่หรือไม่?`)) return;

    try {
      await warehouseService.delete(id);
      showNotification('success', 'ลบคลังสินค้าเรียบร้อย');
      refetch();
    } catch (error: any) {
      showNotification('error', error.message || 'เกิดข้อผิดพลาดในการลบ');
    }
  };

  const getTypeLabel = (type: string) => {
    const types: Record<string, string> = {
      main: 'คลังหลัก',
      branch: 'สาขา',
      mobile: 'รถ',
    };
    return types[type] || type;
  };

  const getTypeBadgeColor = (type: string) => {
    const colors: Record<string, string> = {
      main: 'bg-blue-100 text-blue-700',
      branch: 'bg-green-100 text-green-700',
      mobile: 'bg-purple-100 text-purple-700',
    };
    return colors[type] || 'bg-gray-100 text-gray-700';
  };

  if (loading) {
    return (
      <PageLayout title="จัดการคลังสินค้า">
        <div className="flex items-center justify-center h-64">
          <LoadingSpinner />
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout title="จัดการคลังสินค้า">
      {/* Header Actions */}
      <div className="flex justify-end mb-6">
        <Button onClick={() => handleOpenModal()} className="flex items-center gap-2">
          <Plus className="w-5 h-5" />
          <span>เพิ่มคลังสินค้า</span>
        </Button>
      </div>

      {/* Warehouses Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {warehouses.map((warehouse: any) => (
          <Card key={warehouse.id} className="relative overflow-hidden hover:shadow-lg transition-shadow">
            {/* Background Decoration */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-500/5 to-transparent rounded-bl-full" />

            <div className="relative p-6">
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-blue-100 rounded-xl">
                    <Warehouse className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 text-lg">{warehouse.name}</h3>
                    <p className="text-sm text-gray-500">{warehouse.code}</p>
                  </div>
                </div>
                <Badge className={getTypeBadgeColor(warehouse.type)}>
                  {getTypeLabel(warehouse.type)}
                </Badge>
              </div>

              {/* Details */}
              <div className="space-y-3 mb-4">
                {warehouse.address && (
                  <div className="flex items-start gap-2 text-sm text-gray-600">
                    <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span className="line-clamp-2">{warehouse.address}</span>
                  </div>
                )}

                {warehouse.manager && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <User className="w-4 h-4 flex-shrink-0" />
                    <span>{warehouse.manager.full_name}</span>
                  </div>
                )}

                {warehouse.capacity_m3 && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Package className="w-4 h-4 flex-shrink-0" />
                    <span>ความจุ: {warehouse.capacity_m3} ลบ.ม.</span>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-4 border-t border-gray-200">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleViewInventory(warehouse)}
                  className="flex-1 flex items-center justify-center gap-2"
                >
                  <Package className="w-4 h-4" />
                  <span>ดูสต็อก</span>
                </Button>
                <button
                  onClick={() => handleOpenModal(warehouse)}
                  className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  title="แก้ไข"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(warehouse.id, warehouse.name)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="ลบ"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {warehouses.length === 0 && (
        <Card>
          <div className="text-center py-16 text-gray-500">
            <Warehouse className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium">ยังไม่มีคลังสินค้า</p>
            <p className="text-sm mt-1">เริ่มต้นโดยเพิ่มคลังสินค้าใหม่</p>
          </div>
        </Card>
      )}

      {/* Add/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={editingWarehouse ? 'แก้ไขคลังสินค้า' : 'เพิ่มคลังสินค้าใหม่'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                รหัสคลัง <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="WH-001"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                ประเภท <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="main">คลังหลัก</option>
                <option value="branch">สาขา</option>
                <option value="mobile">รถ</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              ชื่อคลัง <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              ที่อยู่
            </label>
            <textarea
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                ละติจูด
              </label>
              <input
                type="number"
                step="0.000001"
                value={formData.latitude || ''}
                onChange={(e) => setFormData({ ...formData, latitude: parseFloat(e.target.value) || null })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="13.736717"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                ลองจิจูด
              </label>
              <input
                type="number"
                step="0.000001"
                value={formData.longitude || ''}
                onChange={(e) => setFormData({ ...formData, longitude: parseFloat(e.target.value) || null })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="100.523186"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              ความจุ (ลูกบาศก์เมตร)
            </label>
            <input
              type="number"
              step="0.01"
              value={formData.capacity_m3 || ''}
              onChange={(e) => setFormData({ ...formData, capacity_m3: parseFloat(e.target.value) || null })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex gap-3 justify-end pt-4 border-t">
            <Button type="button" onClick={handleCloseModal} variant="outline">
              ยกเลิก
            </Button>
            <Button type="submit">
              {editingWarehouse ? 'บันทึก' : 'เพิ่มคลังสินค้า'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Inventory Modal */}
      <Modal
        isOpen={isInventoryModalOpen}
        onClose={() => setIsInventoryModalOpen(false)}
        title={`สต็อกในคลัง: ${selectedWarehouse?.name || ''}`}
        size="large"
      >
        {inventoryLoading ? (
          <div className="flex items-center justify-center py-12">
            <LoadingSpinner />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex justify-end">
              <Button onClick={handleOpenStockIn} className="flex items-center gap-2">
                <ArrowDownCircle className="w-4 h-4" />
                รับสินค้าเข้า
              </Button>
            </div>

            {warehouseInventory.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Package className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p>ยังไม่มีสต็อกในคลังนี้</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">สินค้า</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">รหัสสินค้า</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">คงเหลือ</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">จอง</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">พร้อมใช้</th>
                      <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">สถานะ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {warehouseInventory.map((item) => (
                      <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            {item.category_color && (
                              <div
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: item.category_color }}
                              />
                            )}
                            <span className="font-medium text-gray-900">
                              {item.product_name}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-600">
                          {item.product_code || item.product_sku || '-'}
                        </td>
                        <td className="py-3 px-4 text-right font-semibold text-gray-900">
                          {item.quantity} {item.product_unit}
                        </td>
                        <td className="py-3 px-4 text-right text-sm text-gray-600">
                          {item.reserved_quantity}
                        </td>
                        <td className="py-3 px-4 text-right font-semibold text-green-600">
                          {item.available_quantity}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <Badge
                            variant={
                              item.stock_status === 'out_of_stock' ? 'error' :
                                item.stock_status === 'low_stock' ? 'warning' :
                                  'success'
                            }
                          >
                            {
                              item.stock_status === 'out_of_stock' ? 'หมด' :
                                item.stock_status === 'low_stock' ? 'ต่ำ' :
                                  'ปกติ'
                            }
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Stock In Modal */}
      <Modal
        isOpen={isStockInModalOpen}
        onClose={() => setIsStockInModalOpen(false)}
        title={`รับสินค้าเข้า: ${selectedWarehouse?.name || ''}`}
      >
        <form onSubmit={handleStockInSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              สินค้า *
            </label>
            <div className="space-y-2">
              <input
                type="text"
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="พิมพ์รหัสหรือชื่อสินค้า"
              />
              <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-lg">
                {products
                  .filter((p: any) => {
                    if (!productSearch) return true;
                    const kw = productSearch.toLowerCase();
                    return (
                      (p.product_code || '').toLowerCase().includes(kw) ||
                      (p.product_name || '').toLowerCase().includes(kw)
                    );
                  })
                  .slice(0, 30)
                  .map((p: any) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setStockInForm({ ...stockInForm, product_id: p.id });
                        setProductSearch(`${p.product_code || ''} ${p.product_name || ''}`.trim());
                      }}
                      className={`w-full text-left px-3 py-2 hover:bg-gray-50 ${stockInForm.product_id === p.id ? 'bg-blue-50 text-blue-700 font-medium' : ''
                        }`}
                    >
                      <div className="text-sm">{p.product_code}</div>
                      <div className="text-xs text-gray-500">{p.product_name}</div>
                    </button>
                  ))}
                {products.length === 0 && (
                  <div className="px-3 py-2 text-sm text-gray-500">ยังไม่มีรายการสินค้า</div>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                จำนวน *
              </label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={stockInForm.quantity}
                onChange={(e) => setStockInForm({ ...stockInForm, quantity: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                เลขที่เอกสาร/ใบกำกับ
              </label>
              <input
                type="text"
                value={stockInForm.ref_code}
                onChange={(e) => setStockInForm({ ...stockInForm, ref_code: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="เช่น INV-2026-0001"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              หมายเหตุ
            </label>
            <input
              type="text"
              value={stockInForm.note}
              onChange={(e) => setStockInForm({ ...stockInForm, note: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="เช่น รับเข้าจากสำนักงานใหญ่"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => setIsStockInModalOpen(false)}>
              ยกเลิก
            </Button>
            <Button type="submit">บันทึก</Button>
          </div>
        </form>
      </Modal>
    </PageLayout>
  );
}

