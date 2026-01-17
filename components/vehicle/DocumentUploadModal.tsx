// DocumentUploadModal - Modal for uploading vehicle documents
import React, { useState, useRef, useEffect } from 'react';
import { Upload, X, FileText, Calendar, AlertCircle } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { storageService } from '../../services/storageService';
import { vehicleDocumentService } from '../../services/vehicleDocumentService';
import type { UploadProgress } from '../../services/storageService';

export type DocumentType = 'registration' | 'tax' | 'insurance' | 'inspection' | 'other';

interface DocumentUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  vehicleId: string;
  documentType: DocumentType;
  onUploaded?: () => void;
}

const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  registration: 'ทะเบียนรถ / เล่มรถ',
  tax: 'ภาษีรถ / ต่อทะเบียน',
  insurance: 'ประกัน',
  inspection: 'พรบ./ตรวจสภาพ',
  other: 'อื่นๆ',
};

export const DocumentUploadModal: React.FC<DocumentUploadModalProps> = ({
  isOpen,
  onClose,
  vehicleId,
  documentType,
  onUploaded,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    issued_date: '',
    expiry_date: '',
    remind_before_days: '30',
    notes: '',
  });
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset form when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      // Reset state when modal closes
      setSelectedFile(null);
      setFilePreview(null);
      setFormData({
        issued_date: '',
        expiry_date: '',
        remind_before_days: '30',
        notes: '',
      });
      setError(null);
      setUploadProgress(null);
    }
  }, [isOpen]);

  // Cleanup preview URL
  useEffect(() => {
    return () => {
      if (filePreview) {
        URL.revokeObjectURL(filePreview);
      }
    };
  }, [filePreview]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (50MB limit)
    if (file.size > 50 * 1024 * 1024) {
      setError('ไฟล์มีขนาดใหญ่เกิน 50MB');
      return;
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      setError('รองรับเฉพาะไฟล์รูปภาพ (JPG, PNG, GIF, WEBP) และ PDF');
      return;
    }

    setSelectedFile(file);
    setError(null);

    // Create preview for images
    if (file.type.startsWith('image/')) {
      const previewUrl = URL.createObjectURL(file);
      setFilePreview(previewUrl);
    } else {
      setFilePreview(null);
    }
  };

  const handleRemoveFile = () => {
    if (filePreview) {
      URL.revokeObjectURL(filePreview);
    }
    setSelectedFile(null);
    setFilePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedFile) {
      setError('กรุณาเลือกไฟล์');
      return;
    }

    if (!formData.issued_date) {
      setError('กรุณากรอกวันที่ออกเอกสาร');
      return;
    }

    setUploading(true);
    setUploadProgress({
      fileName: selectedFile.name,
      progress: 0,
      status: 'uploading',
    });

    try {
      // Upload file to storage
      const filePath = `vehicle-${vehicleId}/${documentType}`;
      const fileUrl = await storageService.uploadFile(
        selectedFile,
        'vehicle-documents',
        filePath,
        (progress) => {
          setUploadProgress(progress);
        }
      );

      // Create document record
      await vehicleDocumentService.createDocument({
        vehicle_id: vehicleId,
        document_type: documentType,
        file_url: fileUrl,
        file_name: selectedFile.name,
        mime_type: selectedFile.type,
        issued_date: formData.issued_date || undefined,
        expiry_date: formData.expiry_date || undefined,
        remind_before_days: formData.remind_before_days ? parseInt(formData.remind_before_days) : undefined,
        notes: formData.notes || undefined,
      });

      // If tax or insurance, create specific record
      if (documentType === 'tax' || documentType === 'insurance') {
        // The service will handle creating the specific record
        // We'll need to get the document_id from the created document
        // For now, we'll let the service handle it
      }

      // Success - close modal and refresh
      onUploaded?.();
      onClose();
    } catch (err: any) {
      console.error('Error uploading document:', err);
      setError(err.message || 'เกิดข้อผิดพลาดในการอัปโหลดเอกสาร');
      setUploadProgress({
        fileName: selectedFile.name,
        progress: 0,
        status: 'error',
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`อัปโหลด${DOCUMENT_TYPE_LABELS[documentType]}`}
      size="medium"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Document Type Display (Read-only) */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            ประเภทเอกสาร
          </label>
          <div className="px-3 py-2 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-900 dark:text-white">
            {DOCUMENT_TYPE_LABELS[documentType]}
          </div>
        </div>

        {/* File Upload */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            ไฟล์เอกสาร <span className="text-red-500">*</span>
          </label>
          {selectedFile ? (
            <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1">
                  <FileText className="w-5 h-5 text-slate-500 dark:text-slate-400" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                      {selectedFile.name}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {(selectedFile.size / 1024).toFixed(2)} KB
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleRemoveFile}
                  disabled={uploading}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
              {filePreview && (
                <div className="mt-4">
                  <img
                    src={filePreview}
                    alt="Preview"
                    className="max-w-full max-h-48 rounded-lg border border-slate-200 dark:border-slate-700"
                  />
                </div>
              )}
            </div>
          ) : (
            <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                <Upload className="w-8 h-8 mb-2 text-slate-400" />
                <p className="mb-2 text-sm text-slate-500 dark:text-slate-400">
                  <span className="font-semibold">คลิกเพื่ออัปโหลด</span> หรือลากไฟล์มาวาง
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  PNG, JPG, GIF, WEBP, PDF (MAX. 50MB)
                </p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept="image/*,.pdf"
                onChange={handleFileSelect}
                disabled={uploading}
              />
            </label>
          )}
        </div>

        {/* Upload Progress */}
        {uploadProgress && uploadProgress.status === 'uploading' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-600 dark:text-slate-400">
                กำลังอัปโหลด: {uploadProgress.fileName}
              </span>
              <span className="text-slate-600 dark:text-slate-400">
                {uploadProgress.progress}%
              </span>
            </div>
            <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
              <div
                className="bg-enterprise-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress.progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Issued Date */}
        <Input
          type="date"
          label="วันที่ออกเอกสาร"
          value={formData.issued_date}
          onChange={(e) => setFormData({ ...formData, issued_date: e.target.value })}
          required
          disabled={uploading}
        />

        {/* Expiry Date */}
        <Input
          type="date"
          label="วันหมดอายุ (ไม่บังคับ)"
          value={formData.expiry_date}
          onChange={(e) => setFormData({ ...formData, expiry_date: e.target.value })}
          disabled={uploading}
        />

        {/* Remind Before Days */}
        <Input
          type="number"
          label="เตือนล่วงหน้า (วัน)"
          value={formData.remind_before_days}
          onChange={(e) => setFormData({ ...formData, remind_before_days: e.target.value })}
          min="1"
          max="365"
          disabled={uploading}
          helperText="จำนวนวันที่จะเตือนก่อนหมดอายุ (ค่าเริ่มต้น: 30 วัน)"
        />

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            หมายเหตุ (ไม่บังคับ)
          </label>
          <textarea
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            placeholder="กรอกหมายเหตุ"
            rows={3}
            disabled={uploading}
            className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent resize-none"
          />
        </div>

        {/* Error Message */}
        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0" />
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 justify-end pt-4 border-t border-slate-200 dark:border-slate-700">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={uploading}
          >
            ยกเลิก
          </Button>
          <Button
            type="submit"
            isLoading={uploading}
            disabled={uploading || !selectedFile}
          >
            <Upload className="w-4 h-4 mr-2" />
            บันทึก
          </Button>
        </div>
      </form>
    </Modal>
  );
};
