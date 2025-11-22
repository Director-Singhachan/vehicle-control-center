// Ticket Form View - Add/Edit ticket form
import React, { useState, useEffect } from 'react';
import { useTicket, useAuth } from '../hooks';
import { useVehicles } from '../hooks';
import { ticketService } from '../services';
import { 
  ArrowLeft,
  Save,
  AlertCircle,
  CheckCircle,
  Upload,
  X
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card } from '../components/ui/Card';
import { PageLayout } from '../components/layout/PageLayout';
import type { Database } from '../types/database';

type TicketStatus = Database['public']['Tables']['tickets']['Row']['status'];
type UrgencyLevel = Database['public']['Tables']['tickets']['Row']['urgency'];

interface TicketFormViewProps {
  ticketId?: number;
  vehicleId?: string;
  onSave?: () => void;
  onCancel?: () => void;
}

export const TicketFormView: React.FC<TicketFormViewProps> = ({
  ticketId,
  vehicleId: initialVehicleId,
  onSave,
  onCancel,
}) => {
  const isEdit = !!ticketId;
  const { user, profile } = useAuth();
  const { ticket, loading: loadingTicket } = useTicket(ticketId || null);
  const { vehicles, loading: loadingVehicles } = useVehicles();
  
  const [formData, setFormData] = useState({
    vehicle_id: initialVehicleId || '',
    odometer: '',
    urgency: 'low' as UrgencyLevel,
    repair_type: '',
    problem_description: '',
    status: 'pending' as TicketStatus,
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Load ticket data when editing
  useEffect(() => {
    if (ticket) {
      setFormData({
        vehicle_id: ticket.vehicle_id || '',
        odometer: ticket.odometer?.toString() || '',
        urgency: ticket.urgency || 'low',
        repair_type: ticket.repair_type || '',
        problem_description: ticket.problem_description || '',
        status: ticket.status || 'pending',
      });
    }
  }, [ticket]);

  const handleChange = (field: string, value: string | UrgencyLevel | TicketStatus) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError(null);
    setSuccess(false);
  };

  const validate = (): boolean => {
    if (!formData.vehicle_id) {
      setError('กรุณาเลือกยานพาหนะ');
      return false;
    }
    if (!formData.repair_type?.trim()) {
      setError('กรุณากรอกประเภทการซ่อม');
      return false;
    }
    if (!formData.problem_description?.trim()) {
      setError('กรุณากรอกคำอธิบายปัญหา');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validate()) return;

    if (!user || !profile) {
      setError('กรุณาเข้าสู่ระบบก่อนสร้างตั๋ว');
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const data = {
        reporter_id: user.id,
        vehicle_id: formData.vehicle_id,
        odometer: formData.odometer ? parseInt(formData.odometer) : null,
        urgency: formData.urgency,
        repair_type: formData.repair_type.trim(),
        problem_description: formData.problem_description.trim(),
        status: isEdit ? formData.status : 'pending',
      };

      if (isEdit && ticketId) {
        await ticketService.update(ticketId, data);
      } else {
        await ticketService.create(data);
      }

      setSuccess(true);
      
      // Call onSave callback after a short delay
      setTimeout(() => {
        if (onSave) onSave();
      }, 1000);
    } catch (err: any) {
      setError(err.message || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล');
    } finally {
      setSaving(false);
    }
  };

  if (loadingTicket && isEdit) {
    return (
      <PageLayout
        title="กำลังโหลด..."
        subtitle="กำลังดึงข้อมูลตั๋ว"
        loading={true}
      />
    );
  }

  const urgencyOptions: { value: UrgencyLevel; label: string }[] = [
    { value: 'low', label: 'ต่ำ' },
    { value: 'medium', label: 'ปานกลาง' },
    { value: 'high', label: 'สูง' },
    { value: 'critical', label: 'วิกฤต' },
  ];

  const statusOptions: { value: TicketStatus; label: string }[] = [
    { value: 'pending', label: 'รออนุมัติ' },
    { value: 'approved_inspector', label: 'อนุมัติโดยผู้ตรวจสอบ' },
    { value: 'approved_manager', label: 'อนุมัติโดยผู้จัดการ' },
    { value: 'ready_for_repair', label: 'พร้อมซ่อม' },
    { value: 'in_progress', label: 'กำลังซ่อม' },
    { value: 'completed', label: 'เสร็จสิ้น' },
    { value: 'rejected', label: 'ปฏิเสธ' },
  ];

  return (
    <PageLayout
      title={isEdit ? 'แก้ไขตั๋วซ่อมบำรุง' : 'สร้างตั๋วซ่อมบำรุง'}
      subtitle={isEdit ? 'แก้ไขข้อมูลตั๋วซ่อมบำรุง' : 'สร้างตั๋วซ่อมบำรุงใหม่'}
      actions={
        <Button variant="outline" onClick={onCancel}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          ยกเลิก
        </Button>
      }
    >
      <Card className="p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Error/Success Messages */}
          {error && (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
            </div>
          )}

          {success && (
            <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-green-800 dark:text-green-200">
                บันทึกข้อมูลสำเร็จ
              </p>
            </div>
          )}

          {/* Form Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                ยานพาหนะ *
              </label>
              {loadingVehicles ? (
                <p className="text-sm text-slate-500">กำลังโหลด...</p>
              ) : (
                <select
                  value={formData.vehicle_id}
                  onChange={(e) => handleChange('vehicle_id', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-enterprise-500 focus:border-transparent"
                  required
                  disabled={saving || !!initialVehicleId}
                >
                  <option value="">เลือกยานพาหนะ</option>
                  {vehicles.map(vehicle => (
                    <option key={vehicle.id} value={vehicle.id}>
                      {vehicle.plate} {vehicle.make && vehicle.model ? `(${vehicle.make} ${vehicle.model})` : ''}
                    </option>
                  ))}
                </select>
              )}
              {initialVehicleId && (
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  ยานพาหนะถูกกำหนดไว้แล้ว
                </p>
              )}
            </div>

            <Input
              label="เลขไมล์ (กม.)"
              type="number"
              value={formData.odometer}
              onChange={(e) => handleChange('odometer', e.target.value)}
              placeholder="50000"
              disabled={saving}
            />

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                ความเร่งด่วน *
              </label>
              <select
                value={formData.urgency}
                onChange={(e) => handleChange('urgency', e.target.value as UrgencyLevel)}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-enterprise-500 focus:border-transparent"
                required
                disabled={saving}
              >
                {urgencyOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <Input
                label="ประเภทการซ่อม *"
                type="text"
                value={formData.repair_type}
                onChange={(e) => handleChange('repair_type', e.target.value)}
                placeholder="เช่น เปลี่ยนยาง, ซ่อมเครื่องยนต์, ตรวจเช็ค"
                required
                disabled={saving}
                error={error && !formData.repair_type ? 'กรุณากรอกประเภทการซ่อม' : undefined}
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                คำอธิบายปัญหา *
              </label>
              <textarea
                value={formData.problem_description}
                onChange={(e) => handleChange('problem_description', e.target.value)}
                placeholder="อธิบายปัญหาหรืออาการที่พบ..."
                rows={5}
                required
                disabled={saving}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-enterprise-500 focus:border-transparent resize-none"
              />
              {error && !formData.problem_description && (
                <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                  กรุณากรอกคำอธิบายปัญหา
                </p>
              )}
            </div>

            {isEdit && (
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  สถานะ
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => handleChange('status', e.target.value as TicketStatus)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-enterprise-500 focus:border-transparent"
                  disabled={saving}
                >
                  {statusOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Form Actions */}
          <div className="flex justify-end gap-3 pt-6 border-t border-slate-200 dark:border-slate-700">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={saving}
            >
              ยกเลิก
            </Button>
            <Button
              type="submit"
              disabled={saving}
              isLoading={saving}
            >
              <Save className="w-4 h-4 mr-2" />
              บันทึก
            </Button>
          </div>
        </form>
      </Card>
    </PageLayout>
  );
};

