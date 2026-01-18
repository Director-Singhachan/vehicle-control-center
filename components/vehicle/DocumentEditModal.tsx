// DocumentEditModal - Modal for editing vehicle document details
import React, { useState, useEffect } from 'react';
import { Edit, X } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { vehicleDocumentService } from '../../services/vehicleDocumentService';
import type { DocumentWithDetails } from '../../services/vehicleDocumentService';

interface DocumentEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  document: DocumentWithDetails | null;
  onUpdated?: () => void;
}

export const DocumentEditModal: React.FC<DocumentEditModalProps> = ({
  isOpen,
  onClose,
  document,
  onUpdated,
}) => {
  const [formData, setFormData] = useState({
    issued_date: '',
    expiry_date: '',
    remind_before_days: '',
    notes: '',
  });
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load document data when modal opens
  useEffect(() => {
    if (isOpen && document) {
      setFormData({
        issued_date: document.issued_date ? document.issued_date.split('T')[0] : '',
        expiry_date: document.expiry_date ? document.expiry_date.split('T')[0] : '',
        remind_before_days: document.remind_before_days?.toString() || '30',
        notes: document.notes || '',
      });
      setError(null);
    }
  }, [isOpen, document]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!document) return;

    setError(null);
    setUpdating(true);

    try {
      await vehicleDocumentService.updateDocument(document.id, {
        issued_date: formData.issued_date || null,
        expiry_date: formData.expiry_date || null,
        remind_before_days: formData.remind_before_days ? parseInt(formData.remind_before_days) : null,
        notes: formData.notes || null,
      });

      onUpdated?.();
      onClose();
    } catch (err: any) {
      console.error('Error updating document:', err);
      setError(err.message || 'เกิดข้อผิดพลาดในการอัปเดตเอกสาร');
    } finally {
      setUpdating(false);
    }
  };

  if (!document) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="แก้ไขข้อมูลเอกสาร"
      size="medium"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 text-sm text-red-600 dark:text-red-400">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            ชื่อไฟล์
          </label>
          <Input
            value={document.file_name}
            disabled
            className="bg-slate-50 dark:bg-slate-800"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            วันที่ออกเอกสาร
          </label>
          <Input
            type="date"
            value={formData.issued_date}
            onChange={(e) => setFormData({ ...formData, issued_date: e.target.value })}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            วันที่หมดอายุ
          </label>
          <Input
            type="date"
            value={formData.expiry_date}
            onChange={(e) => setFormData({ ...formData, expiry_date: e.target.value })}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            แจ้งเตือนก่อนหมดอายุ (วัน)
          </label>
          <Input
            type="number"
            min="1"
            max="365"
            value={formData.remind_before_days}
            onChange={(e) => setFormData({ ...formData, remind_before_days: e.target.value })}
            placeholder="30"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            หมายเหตุ
          </label>
          <textarea
            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-enterprise-500 focus:border-transparent"
            rows={3}
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            placeholder="หมายเหตุเพิ่มเติม..."
          />
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t border-slate-200 dark:border-slate-700">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={updating}
          >
            ยกเลิก
          </Button>
          <Button
            type="submit"
            disabled={updating}
          >
            {updating ? 'กำลังอัปเดต...' : 'บันทึก'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
