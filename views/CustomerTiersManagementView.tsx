import React, { useState } from 'react';
import { Users, Plus, Edit2, Trash2, Award, TrendingUp } from 'lucide-react';
import { useCustomerTiers, useCustomerCountByTier } from '../hooks/useCustomerTiers';
import { customerTierService } from '../services/customerTierService';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { PageLayout } from '../components/ui/PageLayout';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { Modal } from '../components/ui/Modal';
import { useNotification } from '../hooks/useNotification';
import type { Database } from '../types/database';

type CustomerTierInsert = Database['public']['Tables']['customer_tiers']['Insert'];

export function CustomerTiersManagementView() {
  const { tiers, loading, refetch } = useCustomerTiers();
  const { counts } = useCustomerCountByTier();
  const { showNotification } = useNotification();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTier, setEditingTier] = useState<any>(null);
  const [formData, setFormData] = useState<Partial<CustomerTierInsert & { discount_percent: number | string; min_order_amount: number | string; display_order: number | string }>>({
    tier_code: '',
    tier_name: '',
    description: '',
    discount_percent: 0,
    min_order_amount: 0,
    color: '#3B82F6',
    display_order: 0,
  });

  const handleOpenModal = (tier?: any) => {
    if (tier) {
      setEditingTier(tier);
      setFormData({
        tier_code: tier.tier_code,
        tier_name: tier.tier_name,
        description: tier.description || '',
        discount_percent: tier.discount_percent || '',
        min_order_amount: tier.min_order_amount || '',
        color: tier.color,
        display_order: tier.display_order || '',
      });
    } else {
      setEditingTier(null);
      setFormData({
        tier_code: '',
        tier_name: '',
        description: '',
        discount_percent: 0,
        min_order_amount: 0,
        color: '#3B82F6',
        display_order: 0,
      });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingTier(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Convert string values to numbers
    const payload = {
      ...formData,
      discount_percent: Number(formData.discount_percent) || 0,
      min_order_amount: Number(formData.min_order_amount) || 0,
      display_order: Number(formData.display_order) || 0,
    };

    try {
      if (editingTier) {
        await customerTierService.update(editingTier.id, payload);
        showNotification('success', 'อัพเดทระดับลูกค้าเรียบร้อย');
      } else {
        await customerTierService.create(payload as CustomerTierInsert);
        showNotification('success', 'เพิ่มระดับลูกค้าเรียบร้อย');
      }
      
      refetch();
      handleCloseModal();
    } catch (error: any) {
      showNotification('error', error.message || 'เกิดข้อผิดพลาด');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`ต้องการลบระดับ "${name}" ใช่หรือไม่?`)) return;

    try {
      await customerTierService.delete(id);
      showNotification('success', 'ลบระดับลูกค้าเรียบร้อย');
      refetch();
    } catch (error: any) {
      showNotification('error', error.message || 'เกิดข้อผิดพลาดในการลบ');
    }
  };

  const getCustomerCount = (tierId: string) => {
    const count = counts.find((c: any) => c.tier_id === tierId);
    return count?.count || 0;
  };

  if (loading) {
    return (
      <PageLayout title="จัดการระดับลูกค้า">
        <div className="flex items-center justify-center h-64">
          <LoadingSpinner />
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout title="จัดการระดับลูกค้า">
      {/* Header Actions */}
      <div className="flex justify-between items-center mb-6">
        <p className="text-gray-600 dark:text-gray-400">กำหนดระดับลูกค้าและส่วนลดสำหรับแต่ละระดับ</p>
        <Button onClick={() => handleOpenModal()} className="flex items-center gap-2">
          <Plus className="w-5 h-5" />
          <span>เพิ่มระดับลูกค้า</span>
        </Button>
      </div>

      {/* Tiers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {tiers.map((tier) => (
          <Card key={tier.id} className="relative overflow-hidden hover:shadow-lg transition-shadow">
            {/* Background Decoration */}
            <div 
              className="absolute top-0 right-0 w-32 h-32 rounded-bl-full opacity-10"
              style={{ backgroundColor: tier.color }}
            />
            
            <div className="relative p-6">
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div 
                    className="p-3 rounded-xl"
                    style={{ backgroundColor: `${tier.color}20` }}
                  >
                    <Award className="w-6 h-6" style={{ color: tier.color }} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white text-lg">{tier.tier_name}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">รหัส: {tier.tier_code}</p>
                  </div>
                </div>
              </div>

              {/* Details */}
              <div className="space-y-3 mb-4">
                {tier.description && (
                  <p className="text-sm text-gray-600 dark:text-gray-400">{tier.description}</p>
                )}

                <div className="flex items-center justify-between py-2 border-t border-gray-100 dark:border-slate-700">
                  <span className="text-sm text-gray-600 dark:text-gray-400">ส่วนลด:</span>
                  <span className="font-semibold text-green-600 dark:text-green-400">
                    {tier.discount_percent}%
                  </span>
                </div>

                {tier.min_order_amount > 0 && (
                  <div className="flex items-center justify-between py-2 border-t border-gray-100 dark:border-slate-700">
                    <span className="text-sm text-gray-600 dark:text-gray-400">ยอดขั้นต่ำ:</span>
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {new Intl.NumberFormat('th-TH').format(tier.min_order_amount)} ฿
                    </span>
                  </div>
                )}

                <div className="flex items-center justify-between py-2 border-t border-gray-100 dark:border-slate-700">
                  <span className="text-sm text-gray-600 dark:text-gray-400">จำนวนลูกค้า:</span>
                  <Badge variant="info">
                    {getCustomerCount(tier.id)} ราย
                  </Badge>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-4 border-t border-gray-200 dark:border-slate-700">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleOpenModal(tier)}
                  className="flex-1 flex items-center justify-center gap-2"
                >
                  <Edit2 className="w-4 h-4" />
                  <span>แก้ไข</span>
                </Button>
                <button
                  onClick={() => handleDelete(tier.id, tier.tier_name)}
                  className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                  title="ลบ"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {tiers.length === 0 && (
        <Card>
          <div className="text-center py-16 text-gray-500 dark:text-gray-400">
            <Users className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium">ยังไม่มีระดับลูกค้า</p>
            <p className="text-sm mt-1">เริ่มต้นโดยเพิ่มระดับลูกค้าใหม่</p>
          </div>
        </Card>
      )}

      {/* Add/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={editingTier ? 'แก้ไขระดับลูกค้า' : 'เพิ่มระดับลูกค้าใหม่'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                รหัสระดับ <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.tier_code}
                onChange={(e) => setFormData({ ...formData, tier_code: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 disabled:opacity-50"
                placeholder="A, B, C, D"
                required
                disabled={!!editingTier}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                สี
              </label>
              <input
                type="color"
                value={formData.color}
                onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                className="w-full h-10 px-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              ชื่อระดับ <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.tier_name}
              onChange={(e) => setFormData({ ...formData, tier_name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
              placeholder="เช่น ลูกค้า VIP, ลูกค้าทอง"
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
              placeholder="รายละเอียดเกี่ยวกับระดับนี้"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                ส่วนลด (%)
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.discount_percent ?? ''}
                onChange={(e) => setFormData({ ...formData, discount_percent: e.target.value as any })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                min="0"
                max="100"
                placeholder="%"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                ยอดสั่งซื้อขั้นต่ำ (฿)
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.min_order_amount ?? ''}
                onChange={(e) => setFormData({ ...formData, min_order_amount: e.target.value as any })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                min="0"
                placeholder="฿"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              ลำดับการแสดงผล
            </label>
            <input
              type="number"
                value={formData.display_order ?? ''}
              onChange={(e) => setFormData({ ...formData, display_order: e.target.value as any })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
              min="0"
              placeholder="ลำดับ"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">ตัวเลขน้อยจะแสดงก่อน</p>
          </div>

          <div className="flex gap-3 justify-end pt-4 border-t dark:border-slate-700">
            <Button type="button" onClick={handleCloseModal} variant="outline">
              ยกเลิก
            </Button>
            <Button type="submit">
              {editingTier ? 'บันทึก' : 'เพิ่มระดับลูกค้า'}
            </Button>
          </div>
        </form>
      </Modal>
    </PageLayout>
  );
}

