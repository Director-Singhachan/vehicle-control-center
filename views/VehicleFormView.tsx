// Vehicle Form View - Add/Edit vehicle form
import React, { useState, useEffect } from 'react';
import { useVehicle } from '../hooks';
import { vehicleService } from '../services';
import { storageService } from '../services/storageService';
import {
  ArrowLeft,
  Save,
  AlertCircle,
  CheckCircle,
  Upload,
  X,
  Image as ImageIcon
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

  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
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
      if (vehicle.image_url) {
        setImagePreview(vehicle.image_url);
      }
    }
  }, [vehicle]);

  // Handle image file selection
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      
      // Validate file type
      if (!file.type.startsWith('image/')) {
        setError('กรุณาเลือกรูปภาพเท่านั้น');
        return;
      }
      
      // Validate file size (10MB limit)
      if (file.size > 10 * 1024 * 1024) {
        setError('ไฟล์รูปภาพมีขนาดใหญ่เกิน 10MB');
        return;
      }
      
      setSelectedImage(file);
      setError(null);
      
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
    setFormData(prev => ({ ...prev, image_url: '' }));
  };

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
      let imageUrl = formData.image_url.trim() || null;

      // Upload image if a new one is selected
      if (selectedImage) {
        setUploading(true);
        try {
          // Upload to 'vehicle-images' bucket (or 'ticket-attachments' if vehicle-images doesn't exist)
          imageUrl = await storageService.uploadFile(selectedImage, 'ticket-attachments', 'vehicles');
        } catch (uploadError) {
          console.error('Upload failed:', uploadError);
          setError('เกิดข้อผิดพลาดในการอัปโหลดรูปภาพ: ' + (uploadError instanceof Error ? uploadError.message : 'Unknown error'));
          setSaving(false);
          setUploading(false);
          return;
        } finally {
          setUploading(false);
        }
      }

      const data = {
        plate: formData.plate.trim(),
        make: formData.make.trim() || null,
        model: formData.model.trim() || null,
        type: formData.type.trim() || null,
        branch: formData.branch.trim() || null,
        lat: formData.lat ? parseFloat(formData.lat) : null,
        lng: formData.lng ? parseFloat(formData.lng) : null,
        image_url: imageUrl,
      };

      if (isEdit && vehicleId) {
        await vehicleService.update(vehicleId, data);
      } else {
        await vehicleService.create(data);
      }

      setSuccess(true);
      setSelectedImage(null);

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
              <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-2">
                <ImageIcon className="w-4 h-4" />
                รูปภาพยานพาหนะ (รูปโปรไฟล์)
              </h3>
              
              {/* Image Upload */}
              <div className="space-y-4">
                {/* File Input */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    อัปโหลดรูปภาพ
                  </label>
                  <div className="flex items-center gap-3">
                    <label className="flex-1 cursor-pointer">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageSelect}
                        className="hidden"
                        disabled={saving || uploading}
                      />
                      <div className="flex items-center justify-center gap-2 px-4 py-2 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg hover:border-enterprise-500 dark:hover:border-enterprise-500 transition-colors">
                        <Upload className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                        <span className="text-sm text-slate-600 dark:text-slate-400">
                          {uploading ? 'กำลังอัปโหลด...' : 'เลือกรูปภาพ'}
                        </span>
                      </div>
                    </label>
                    {(imagePreview || selectedImage) && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={removeImage}
                        disabled={saving || uploading}
                      >
                        <X className="w-4 h-4 mr-1" />
                        ลบ
                      </Button>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    รองรับไฟล์ JPG, PNG, GIF ขนาดไม่เกิน 10MB
                  </p>
                </div>

                {/* Image Preview */}
                {imagePreview && (
                  <div className="relative h-64 w-full rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800">
                    <img
                      src={imagePreview}
                      alt="Vehicle Preview"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2VlZSIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IiM5OTkiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5JbWFnZSBFcnJvcjwvdGV4dD48L3N2Zz4=';
                      }}
                    />
                  </div>
                )}

                {/* Manual URL Input (Optional) */}
                <div>
                  <Input
                    label="หรือใส่ URL รูปภาพ (ถ้ามี)"
                    type="url"
                    value={formData.image_url}
                    onChange={(e) => {
                      handleChange('image_url', e.target.value);
                      if (e.target.value && !selectedImage) {
                        setImagePreview(e.target.value);
                      }
                    }}
                    placeholder="https://example.com/car-image.jpg"
                    disabled={saving || uploading || !!selectedImage}
                  />
                  {selectedImage && (
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      กรุณาลบรูปภาพที่เลือกไว้ก่อนเพื่อใช้ URL แทน
                    </p>
                  )}
                </div>
              </div>
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

