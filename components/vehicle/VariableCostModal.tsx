// VariableCostModal — เพิ่ม/แก้ไข ต้นทุนผันแปร (vehicle_variable_costs), เลือกเที่ยว (optional)
import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { vehicleCostService } from '../../services/vehicleCostService';
import type { Database } from '../../types/database';
import type { DeliveryTripWithRelations } from '../../services/deliveryTripService';

type VehicleVariableCostRow = Database['public']['Tables']['vehicle_variable_costs']['Row'];

interface VariableCostModalProps {
  isOpen: boolean;
  onClose: () => void;
  vehicleId: string;
  editRow: VehicleVariableCostRow | null;
  trips: DeliveryTripWithRelations[];
  onSuccess: () => void;
}

const COST_TYPE_OPTIONS = [
  { value: 'ทางด่วน', label: 'ทางด่วน' },
  { value: 'ปะยาง', label: 'ปะยาง' },
  { value: 'เบี้ยเลี้ยง', label: 'เบี้ยเลี้ยง' },
  { value: 'อื่นๆ', label: 'อื่นๆ' },
];

export const VariableCostModal: React.FC<VariableCostModalProps> = ({
  isOpen,
  onClose,
  vehicleId,
  editRow,
  trips,
  onSuccess,
}) => {
  const [cost_type, setCostType] = useState('ทางด่วน');
  const [amount, setAmount] = useState('');
  const [cost_date, setCostDate] = useState('');
  const [delivery_trip_id, setDeliveryTripId] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    if (editRow) {
      setCostType(editRow.cost_type);
      setAmount(String(editRow.amount));
      setCostDate(editRow.cost_date?.split('T')[0] ?? '');
      setDeliveryTripId(editRow.delivery_trip_id ?? '');
      setNotes(editRow.notes ?? '');
    } else {
      setCostType('ทางด่วน');
      setAmount('');
      setCostDate(new Date().toISOString().split('T')[0]);
      setDeliveryTripId('');
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
    if (!cost_date.trim()) {
      setError('กรุณาเลือกวันที่เกิดค่าใช้จ่าย');
      return;
    }
    setSaving(true);
    try {
      if (editRow) {
        await vehicleCostService.updateVariableCost(editRow.id, {
          cost_type: cost_type.trim() || 'อื่นๆ',
          amount: numAmount,
          cost_date: cost_date,
          delivery_trip_id: delivery_trip_id || null,
          notes: notes.trim() || null,
        });
      } else {
        await vehicleCostService.createVariableCost({
          vehicle_id: vehicleId,
          cost_type: cost_type.trim() || 'อื่นๆ',
          amount: numAmount,
          cost_date: cost_date,
          delivery_trip_id: delivery_trip_id || null,
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
      title={editRow ? 'แก้ไขต้นทุนผันแปร' : 'เพิ่มต้นทุนผันแปร'}
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
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">วันที่เกิดค่าใช้จ่าย <span className="text-red-500">*</span></label>
          <Input
            type="date"
            value={cost_date}
            onChange={(e) => setCostDate(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">เที่ยวที่เกี่ยวข้อง (ไม่บังคับ)</label>
          <select
            value={delivery_trip_id}
            onChange={(e) => setDeliveryTripId(e.target.value)}
            className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
          >
            <option value="">— ไม่ผูกเที่ยว (ซ่อม/ทั่วไป) —</option>
            {trips.map((t) => (
              <option key={t.id} value={t.id}>
                {t.trip_number ?? t.id.slice(0, 8)} — {t.planned_date}
              </option>
            ))}
          </select>
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
