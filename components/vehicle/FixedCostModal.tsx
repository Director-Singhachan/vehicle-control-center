// FixedCostModal — เพิ่ม/แก้ไข ต้นทุนคงที่ (vehicle_fixed_costs)
import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { vehicleCostService } from '../../services/vehicleCostService';
import type { Database } from '../../types/database';

type VehicleFixedCostRow = Database['public']['Tables']['vehicle_fixed_costs']['Row'];

interface FixedCostModalProps {
  isOpen: boolean;
  onClose: () => void;
  vehicleId: string;
  editRow: VehicleFixedCostRow | null;
  onSuccess: () => void;
}

const COST_TYPE_OPTIONS = [
  { value: 'ค่างวด', label: 'ค่างวด' },
  { value: 'เงินเดือน', label: 'เงินเดือน' },
  { value: 'ภาษี', label: 'ภาษี' },
  { value: 'อื่นๆ', label: 'อื่นๆ' },
];

export const FixedCostModal: React.FC<FixedCostModalProps> = ({
  isOpen,
  onClose,
  vehicleId,
  editRow,
  onSuccess,
}) => {
  const [cost_type, setCostType] = useState('ค่างวด');
  const [amount, setAmount] = useState('');
  const [period_type, setPeriodType] = useState<'monthly' | 'yearly'>('monthly');
  const [period_start, setPeriodStart] = useState('');
  const [period_end, setPeriodEnd] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    if (editRow) {
      setCostType(editRow.cost_type);
      setAmount(String(editRow.amount));
      setPeriodType(editRow.period_type);
      setPeriodStart(editRow.period_start?.split('T')[0] ?? '');
      setPeriodEnd(editRow.period_end?.split('T')[0] ?? '');
      setNotes(editRow.notes ?? '');
    } else {
      const today = new Date().toISOString().split('T')[0];
      setCostType('ค่างวด');
      setAmount('');
      setPeriodType('monthly');
      setPeriodStart(today);
      setPeriodEnd('');
      setNotes('');
    }
    setError(null);
  }, [isOpen, editRow]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount < 0) {
      setError('กรุณากรอกจำนวนเงินที่ถูกต้อง');
      return;
    }
    if (!period_start.trim()) {
      setError('กรุณาเลือกวันเริ่มต้นช่วง');
      return;
    }
    setSaving(true);
    try {
      if (editRow) {
        await vehicleCostService.updateFixedCost(editRow.id, {
          cost_type: cost_type.trim() || 'อื่นๆ',
          amount: numAmount,
          period_type,
          period_start: period_start,
          period_end: period_end.trim() || null,
          notes: notes.trim() || null,
        });
      } else {
        await vehicleCostService.createFixedCost({
          vehicle_id: vehicleId,
          cost_type: cost_type.trim() || 'อื่นๆ',
          amount: numAmount,
          period_type,
          period_start: period_start,
          period_end: period_end.trim() || null,
          notes: notes.trim() || null,
        });
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'เกิดข้อผิดพลาด');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editRow ? 'แก้ไขต้นทุนคงที่' : 'เพิ่มต้นทุนคงที่'}
      size="medium"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3 text-sm text-red-600 dark:text-red-400">
            {error}
          </div>
        )}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">ประเภทต้นทุน</label>
          <select
            value={cost_type}
            onChange={(e) => setCostType(e.target.value)}
            className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
          >
            {COST_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">จำนวนเงิน (บาท) <span className="text-red-500">*</span></label>
          <Input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            min={0}
            step={0.01}
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">ช่วงเวลา</label>
          <div className="flex gap-4">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="period_type"
                checked={period_type === 'monthly'}
                onChange={() => setPeriodType('monthly')}
                className="rounded border-slate-300 dark:border-slate-600"
              />
              <span className="text-slate-700 dark:text-slate-300">รายเดือน</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="period_type"
                checked={period_type === 'yearly'}
                onChange={() => setPeriodType('yearly')}
                className="rounded border-slate-300 dark:border-slate-600"
              />
              <span className="text-slate-700 dark:text-slate-300">รายปี</span>
            </label>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">วันเริ่มต้น <span className="text-red-500">*</span></label>
            <Input
              type="date"
              value={period_start}
              onChange={(e) => setPeriodStart(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">วันสิ้นสุด (ไม่บังคับ)</label>
            <Input
              type="date"
              value={period_end}
              onChange={(e) => setPeriodEnd(e.target.value)}
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">หมายเหตุ</label>
          <Input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="หมายเหตุ"
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>ยกเลิก</Button>
          <Button type="submit" disabled={saving}>{saving ? 'กำลังบันทึก...' : 'บันทึก'}</Button>
        </div>
      </form>
    </Modal>
  );
};
