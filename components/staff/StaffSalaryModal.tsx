// Modal จัดการเงินเดือนพนักงาน (staff_salaries) — ฝั่ง HR
import React, { useState, useEffect, useCallback } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { staffSalaryService } from '../../services/staffSalaryService';
import type { Database } from '../../types/database';

type StaffSalaryRow = Database['public']['Tables']['staff_salaries']['Row'];

interface StaffSalaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  staffId: string;
  staffName: string;
  onSuccess?: () => void;
  createdBy?: string | null;
}

export const StaffSalaryModal: React.FC<StaffSalaryModalProps> = ({
  isOpen,
  onClose,
  staffId,
  staffName,
  onSuccess,
  createdBy,
}) => {
  const [list, setList] = useState<StaffSalaryRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [effective_from, setEffectiveFrom] = useState('');
  const [monthly_salary, setMonthlySalary] = useState('');
  const [effective_to, setEffectiveTo] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const fetchList = useCallback(async () => {
    if (!staffId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await staffSalaryService.listByStaff(staffId);
      setList(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'โหลดข้อมูลไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }, [staffId]);

  useEffect(() => {
    if (isOpen && staffId) fetchList();
  }, [isOpen, staffId, fetchList]);

  useEffect(() => {
    if (!isOpen) {
      setEditId(null);
      setEffectiveFrom('');
      setMonthlySalary('');
      setEffectiveTo('');
      setNotes('');
      setError(null);
      setDeleteId(null);
    } else {
      const today = new Date().toISOString().split('T')[0];
      if (!editId && !effective_from) setEffectiveFrom(today);
    }
  }, [isOpen, editId, effective_from]);

  const resetForm = () => {
    setEditId(null);
    const today = new Date().toISOString().split('T')[0];
    setEffectiveFrom(today);
    setMonthlySalary('');
    setEffectiveTo('');
    setNotes('');
  };

  const handleEdit = (row: StaffSalaryRow) => {
    setEditId(row.id);
    setEffectiveFrom(row.effective_from.slice(0, 10));
    setMonthlySalary(String(row.monthly_salary));
    setEffectiveTo(row.effective_to ? row.effective_to.slice(0, 10) : '');
    setNotes(row.notes ?? '');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const salary = parseFloat(monthly_salary);
    if (isNaN(salary) || salary < 0) {
      setError('กรุณากรอกเงินเดือนที่ถูกต้อง');
      return;
    }
    if (!effective_from.trim()) {
      setError('กรุณาเลือกวันเริ่มต้น');
      return;
    }
    setSaving(true);
    try {
      if (editId) {
        await staffSalaryService.update(editId, {
          effective_from: effective_from,
          effective_to: effective_to.trim() || null,
          monthly_salary: salary,
          notes: notes.trim() || null,
        });
      } else {
        await staffSalaryService.create({
          staff_id: staffId,
          effective_from: effective_from,
          effective_to: effective_to.trim() || null,
          monthly_salary: salary,
          notes: notes.trim() || null,
          created_by: createdBy ?? undefined,
        });
      }
      resetForm();
      await fetchList();
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'บันทึกไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteId) return;
    try {
      await staffSalaryService.delete(deleteId);
      setDeleteId(null);
      await fetchList();
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ลบไม่สำเร็จ');
    }
  };

  const formatDate = (d: string | null) => (d ? d.slice(0, 10) : '—');
  const formatMoney = (n: number) => new Intl.NumberFormat('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={`เงินเดือน — ${staffName}`}
        size="large"
      >
        <div className="p-6 space-y-4">
          {loading && (
            <div className="text-center py-4 text-slate-500 dark:text-slate-400">กำลังโหลด...</div>
          )}
          {error && (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          )}

          {/* Form เพิ่ม/แก้ไข */}
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">วันเริ่มต้น</label>
                <Input
                  type="date"
                  value={effective_from}
                  onChange={(e) => setEffectiveFrom(e.target.value)}
                  className="w-full"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">วันสิ้นสุด (ไม่กรอก = ยังใช้อยู่)</label>
                <Input
                  type="date"
                  value={effective_to}
                  onChange={(e) => setEffectiveTo(e.target.value)}
                  className="w-full"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">เงินเดือนรายเดือน (บาท)</label>
                <Input
                  type="number"
                  min={0}
                  step={1}
                  value={monthly_salary}
                  onChange={(e) => setMonthlySalary(e.target.value)}
                  placeholder="0"
                  className="w-full"
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={saving}>
                  {editId ? 'บันทึกการแก้ไข' : 'เพิ่มอัตรา'}
                </Button>
                {editId && (
                  <Button type="button" variant="outline" onClick={resetForm}>
                    ยกเลิก
                  </Button>
                )}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">หมายเหตุ</label>
              <Input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="หมายเหตุ (ถ้ามี)"
                className="w-full"
              />
            </div>
          </form>

          {/* ตารางประวัติ */}
          <div>
            <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">ประวัติอัตราเงินเดือน</h3>
            {list.length === 0 && !loading && (
              <p className="text-sm text-slate-500 dark:text-slate-400">ยังไม่มีข้อมูลเงินเดือน</p>
            )}
            {list.length > 0 && (
              <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-800">
                    <tr>
                      <th className="px-3 py-2 text-left text-slate-600 dark:text-slate-400">วันเริ่มต้น</th>
                      <th className="px-3 py-2 text-left text-slate-600 dark:text-slate-400">วันสิ้นสุด</th>
                      <th className="px-3 py-2 text-right text-slate-600 dark:text-slate-400">เงินเดือน/เดือน</th>
                      <th className="px-3 py-2 text-left text-slate-600 dark:text-slate-400">หมายเหตุ</th>
                      <th className="px-3 py-2 w-24" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                    {list.map((row) => (
                      <tr key={row.id} className="bg-white dark:bg-slate-900">
                        <td className="px-3 py-2 text-slate-900 dark:text-white">{formatDate(row.effective_from)}</td>
                        <td className="px-3 py-2 text-slate-600 dark:text-slate-400">{row.effective_to ? formatDate(row.effective_to) : 'ปัจจุบัน'}</td>
                        <td className="px-3 py-2 text-right font-medium text-slate-900 dark:text-white">{formatMoney(row.monthly_salary)}</td>
                        <td className="px-3 py-2 text-slate-600 dark:text-slate-400 max-w-[120px] truncate" title={row.notes ?? ''}>{row.notes ?? '—'}</td>
                        <td className="px-3 py-2">
                          <div className="flex gap-1">
                            <Button variant="outline" size="sm" onClick={() => handleEdit(row)}>แก้ไข</Button>
                            <Button variant="outline" size="sm" className="text-red-600 dark:text-red-400" onClick={() => setDeleteId(row.id)}>ลบ</Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </Modal>
      <ConfirmDialog
        isOpen={!!deleteId}
        title="ยืนยันการลบ"
        message="คุณแน่ใจหรือไม่ว่าต้องการลบอัตราเงินเดือนนี้?"
        confirmText="ลบ"
        cancelText="ยกเลิก"
        variant="danger"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteId(null)}
      />
    </>
  );
}
