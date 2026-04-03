import React, { useState, useMemo } from 'react';
import { Package, Plus, Edit2, Trash2, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { useTripItems } from '../hooks/useInventory';
import { useProducts } from '../hooks/useInventory';
import { tripItemService } from '../services/inventoryService';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { Modal } from '../components/ui/Modal';
import { useNotification } from '../hooks/useNotification';
import type { Database } from '../types/database';

// NOTE: The backend/service for trip items returns additional computed/editable fields
// (e.g. planned_quantity/loaded_quantity/delivered_quantity) that may not map 1:1
// to the generated Supabase table row types. We keep the form state loosely typed
// to avoid incorrect TS errors.
type TripItem = Database['public']['Tables']['delivery_trip_items']['Row'];

interface TripItemsManagementViewProps {
  tripId: string;
  tripStatus?: string;
  onUpdate?: () => void;
}

export function TripItemsManagementView({ tripId, tripStatus = 'pending', onUpdate }: TripItemsManagementViewProps) {
  const { items, loading, refetch } = useTripItems(tripId);
  const { products } = useProducts();
  const { showNotification } = useNotification();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [formData, setFormData] = useState<any>({
    product_id: '',
    planned_quantity: 0,
    loaded_quantity: 0,
    delivered_quantity: 0,
    unit_price: 0,
  });

  const isEditable = tripStatus !== 'completed';

  // คำนวณสถิติ
  const stats = useMemo(() => {
    const totalPlanned = items.reduce((sum: number, item: any) => sum + item.planned_quantity, 0);
    const totalLoaded = items.reduce((sum: number, item: any) => sum + item.loaded_quantity, 0);
    const totalDelivered = items.reduce((sum: number, item: any) => sum + item.delivered_quantity, 0);
    const totalValue = items.reduce((sum: number, item: any) => 
      sum + ((item.unit_price || 0) * item.delivered_quantity), 0
    );

    return { totalPlanned, totalLoaded, totalDelivered, totalValue };
  }, [items]);

  const handleOpenModal = (item?: any) => {
    if (item) {
      setEditingItem(item);
      setFormData({
        product_id: item.product_id,
        planned_quantity: item.planned_quantity,
        loaded_quantity: item.loaded_quantity,
        delivered_quantity: item.delivered_quantity,
        returned_quantity: item.returned_quantity,
        damaged_quantity: item.damaged_quantity,
        unit_price: item.unit_price || 0,
        note: item.note || '',
      });
    } else {
      setEditingItem(null);
      setFormData({
        product_id: '',
        planned_quantity: 0,
        loaded_quantity: 0,
        delivered_quantity: 0,
        unit_price: 0,
      });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingItem(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (editingItem) {
        await tripItemService.update(editingItem.id, formData);
        showNotification('success', 'อัพเดทสินค้าเรียบร้อย');
      } else {
        await tripItemService.create({
          trip_id: tripId,
          ...formData,
        } as any);
        showNotification('success', 'เพิ่มสินค้าเรียบร้อย');
      }
      
      refetch();
      onUpdate?.();
      handleCloseModal();
    } catch (error: any) {
      showNotification('error', error.message || 'เกิดข้อผิดพลาด');
    }
  };

  const handleDelete = async (id: string, productName: string) => {
    if (!confirm(`ต้องการลบสินค้า "${productName}" ออกจากทริปใช่หรือไม่?`)) return;

    try {
      await tripItemService.delete(id);
      showNotification('success', 'ลบสินค้าเรียบร้อย');
      refetch();
      onUpdate?.();
    } catch (error: any) {
      showNotification('error', error.message || 'เกิดข้อผิดพลาดในการลบ');
    }
  };

  const getStatusBadge = (item: any) => {
    const delivered = item.delivered_quantity;
    const planned = item.planned_quantity;

    if (delivered === 0) return <Badge variant="error">ยังไม่ส่ง</Badge>;
    if (delivered < planned) return <Badge variant="warning">ส่งไม่ครบ</Badge>;
    if (delivered === planned) return <Badge variant="success">ส่งครบ</Badge>;
    if (delivered > planned) return <Badge variant="info">ส่งเกิน</Badge>;
    return null;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-gray-600">วางแผนส่ง</p>
            <Package className="w-5 h-5 text-blue-500" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{stats.totalPlanned}</p>
          <p className="text-xs text-gray-500 mt-1">หน่วย</p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-gray-600">โหลดจริง</p>
            <CheckCircle className="w-5 h-5 text-green-500" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{stats.totalLoaded}</p>
          <p className="text-xs text-gray-500 mt-1">หน่วย</p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-gray-600">ส่งมอบแล้ว</p>
            <CheckCircle className="w-5 h-5 text-purple-500" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{stats.totalDelivered}</p>
          <p className="text-xs text-gray-500 mt-1">หน่วย</p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-gray-600">มูลค่ารวม</p>
            <div className="text-lg font-bold text-green-600">฿</div>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {new Intl.NumberFormat('th-TH').format(stats.totalValue)}
          </p>
          <p className="text-xs text-gray-500 mt-1">บาท</p>
        </Card>
      </div>

      {/* Items Table */}
      <Card>
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">รายการสินค้า</h3>
          {isEditable && (
            <Button size="sm" onClick={() => handleOpenModal()} className="flex items-center gap-2">
              <Plus className="w-4 h-4" />
              <span>เพิ่มสินค้า</span>
            </Button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">สินค้า</th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">วางแผน</th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">โหลด</th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">ส่งมอบ</th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">ตีกลับ</th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">เสียหาย</th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">ราคา/หน่วย</th>
                <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">สถานะ</th>
                {isEditable && (
                  <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">การกระทำ</th>
                )}
              </tr>
            </thead>
            <tbody>
              {items.map((item: any) => (
                <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                  <td className="py-3 px-4">
                    <div>
                      <p className="font-medium text-gray-900">{item.product?.product_name}</p>
                      <p className="text-sm text-gray-500">{item.product?.product_code}</p>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-right font-medium text-gray-900">
                    {item.planned_quantity}
                  </td>
                  <td className="py-3 px-4 text-right text-green-600 font-medium">
                    {item.loaded_quantity}
                  </td>
                  <td className="py-3 px-4 text-right text-blue-600 font-semibold">
                    {item.delivered_quantity}
                  </td>
                  <td className="py-3 px-4 text-right text-amber-600">
                    {item.returned_quantity || 0}
                  </td>
                  <td className="py-3 px-4 text-right text-red-600">
                    {item.damaged_quantity || 0}
                  </td>
                  <td className="py-3 px-4 text-right text-gray-600">
                    {new Intl.NumberFormat('th-TH').format(item.unit_price || 0)} ฿
                  </td>
                  <td className="py-3 px-4 text-center">
                    {getStatusBadge(item)}
                  </td>
                  {isEditable && (
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleOpenModal(item)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="แก้ไข"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(item.id, item.product?.product_name)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="ลบ"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>

          {items.length === 0 && (
            <div className="text-center py-16 text-gray-500">
              <Package className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">ยังไม่มีสินค้าในทริปนี้</p>
              {isEditable && (
                <Button onClick={() => handleOpenModal()} className="mt-4">
                  เพิ่มสินค้าแรก
                </Button>
              )}
            </div>
          )}
        </div>
      </Card>

      {/* Add/Edit Modal */}
      {isEditable && (
        <Modal
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          title={editingItem ? 'แก้ไขสินค้า' : 'เพิ่มสินค้าในทริป'}
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                สินค้า <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.product_id}
                onChange={(e) => setFormData({ ...formData, product_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
                disabled={!!editingItem}
              >
                <option value="">-- เลือกสินค้า --</option>
                {products.map((product: any) => (
                  <option key={product.id} value={product.id}>
                    {product.product_name} ({product.product_code})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  จำนวนวางแผน <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  value={formData.planned_quantity}
                  onChange={(e) => setFormData({ ...formData, planned_quantity: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  min="0"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  จำนวนโหลดจริง
                </label>
                <input
                  type="number"
                  value={formData.loaded_quantity}
                  onChange={(e) => setFormData({ ...formData, loaded_quantity: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  min="0"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  ส่งมอบแล้ว
                </label>
                <input
                  type="number"
                  value={formData.delivered_quantity}
                  onChange={(e) => setFormData({ ...formData, delivered_quantity: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  min="0"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  ตีกลับ
                </label>
                <input
                  type="number"
                  value={formData.returned_quantity}
                  onChange={(e) => setFormData({ ...formData, returned_quantity: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  min="0"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  เสียหาย
                </label>
                <input
                  type="number"
                  value={formData.damaged_quantity}
                  onChange={(e) => setFormData({ ...formData, damaged_quantity: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  min="0"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                ราคาต่อหน่วย (฿)
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.unit_price}
                onChange={(e) => setFormData({ ...formData, unit_price: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                min="0"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                หมายเหตุ
              </label>
              <textarea
                value={formData.note}
                onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                rows={3}
              />
            </div>

            <div className="flex gap-3 justify-end pt-4 border-t">
              <Button type="button" onClick={handleCloseModal} variant="outline">
                ยกเลิก
              </Button>
              <Button type="submit">
                {editingItem ? 'บันทึก' : 'เพิ่มสินค้า'}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

