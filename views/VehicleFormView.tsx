// Vehicle Form View - Add/Edit vehicle form
import React, { useState, useEffect } from 'react';
import { useVehicle } from '../hooks';
import { vehicleService } from '../services';
import {
  ArrowLeft,
  Save,
  AlertCircle,
  CheckCircle
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card } from '../components/ui/Card';
import { PageLayout } from '../components/layout/PageLayout';

interface VehicleFormViewProps {
  vehicleId?: string;
  onSave?: () => void;
  onCancel?: () => void;
}

export const VehicleFormView: React.FC<VehicleFormViewProps> = ({
  vehicleId,
  onSave,
  onCancel,
}) => {
  const isEdit = !!vehicleId;
  const { vehicle, loading: loadingVehicle } = useVehicle(vehicleId || null);

  const [formData, setFormData] = useState({
    plate: '',
    make: '',
    model: '',
    type: '',
    branch: '',
    lat: '',
    lng: '',
    image_url: '',
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Load vehicle data when editing
  useEffect(() => {
    if (vehicle) {
      setFormData({
        plate: vehicle.plate || '',
        make: vehicle.make || '',
        model: vehicle.model || '',
        type: vehicle.type || '',
        branch: vehicle.branch || '',
        lat: vehicle.lat?.toString() || '',
        lng: vehicle.lng?.toString() || '',
        image_url: vehicle.image_url || '',
      });
    }
  }, [vehicle]);

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError(null);
    setSuccess(false);
  };

  const validate = (): boolean => {
    if (!formData.plate.trim()) {
      setError('กรุณากรอกป้ายทะเบียน');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const data = {
        plate: formData.plate.trim(),
        make: formData.make.trim() || null,
        model: formData.model.trim() || null,
        type: formData.type.trim() || null,
        branch: formData.branch.trim() || null,
        lat: formData.lat ? parseFloat(formData.lat) : null,
        lng: formData.lng ? parseFloat(formData.lng) : null,
        image_url: formData.image_url.trim() || null,
      };

      if (isEdit && vehicleId) {
        await vehicleService.update(vehicleId, data);
      } else {
        await vehicleService.create(data);
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

  if (loadingVehicle && isEdit) {
    return (
      <PageLayout
        title="กำลังโหลด..."
        subtitle="กำลังดึงข้อมูลยานพาหนะ"
        loading={true}
      />
    );
  }

  return (
    <PageLayout
      title={isEdit ? 'แก้ไขยานพาหนะ' : 'เพิ่มยานพาหนะ'}
      subtitle={isEdit ? 'แก้ไขข้อมูลยานพาหนะ' : 'เพิ่มยานพาหนะใหม่เข้าสู่ระบบ'}
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
              <Input
                label="ป้ายทะเบียน *"
                type="text"
                value={formData.plate}
                onChange={(e) => handleChange('plate', e.target.value)}
                placeholder="กก-1234"
                required
                disabled={saving || (isEdit && !!vehicle)}
                error={error && !formData.plate ? 'กรุณากรอกป้ายทะเบียน' : undefined}
              />
              {isEdit && vehicle && (
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  ป้ายทะเบียนไม่สามารถแก้ไขได้
                </p>
              )}
            </div>

            <Input
              label="ยี่ห้อ"
              type="text"
              value={formData.make}
              onChange={(e) => handleChange('make', e.target.value)}
              placeholder="Toyota"
              disabled={saving}
            />

            <Input
              label="รุ่น"
              type="text"
              value={formData.model}
              onChange={(e) => handleChange('model', e.target.value)}
              placeholder="Hilux"
              disabled={saving}
            />

            <Input
              label="ประเภท"
              type="text"
              value={formData.type}
              onChange={(e) => handleChange('type', e.target.value)}
              placeholder="Pickup"
              disabled={saving}
            />

            <Input
              label="สาขา"
              type="text"
              value={formData.branch}
              onChange={(e) => handleChange('branch', e.target.value)}
              placeholder="สาขา A"
              disabled={saving}
            />

            <div className="md:col-span-2">
              <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-4">
                รูปภาพยานพาหนะ
              </h3>
              <Input
                label="URL รูปภาพ"
                type="url"
                value={formData.image_url}
                onChange={(e) => handleChange('image_url', e.target.value)}
                placeholder="https://example.com/car-image.jpg"
                disabled={saving}
              />
              {formData.image_url && (
                <div className="mt-4 relative h-48 w-full rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700">
                  <img
                    src={formData.image_url}
                    alt="Vehicle Preview"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&q=80&w=1000';
                    }}
                  />
                </div>
              )}
            </div>

            <div className="md:col-span-2">
              <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-4">
                ตำแหน่ง (ไม่บังคับ)
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Latitude"
                  type="number"
                  step="any"
                  value={formData.lat}
                  onChange={(e) => handleChange('lat', e.target.value)}
                  placeholder="13.7563"
                  disabled={saving}
                />
                <Input
                  label="Longitude"
                  type="number"
                  step="any"
                  value={formData.lng}
                  onChange={(e) => handleChange('lng', e.target.value)}
                  placeholder="100.5018"
                  disabled={saving}
                />
              </div>
            </div>
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

