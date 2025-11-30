// Ticket Form View - Add/Edit ticket form
import React, { useState, useEffect } from 'react';
import { useTicket, useAuth } from '../hooks';
import { useVehicles } from '../hooks';
import { ticketService } from '../services';
import { storageService, type UploadProgress } from '../services/storageService';
import {
  ArrowLeft,
  Save,
  AlertCircle,
  CheckCircle,
  Upload,
  X,
  Image as ImageIcon,
  Trash2,
  FileVideo,
  Search,
  ChevronDown,
  Check
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

  // Vehicle search state
  const [vehicleSearch, setVehicleSearch] = useState('');
  const [showVehicleDropdown, setShowVehicleDropdown] = useState(false);
  const [filteredVehicles, setFilteredVehicles] = useState(vehicles);

  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [existingImages, setExistingImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Map<string, number>>(new Map());
  const [uploadStatus, setUploadStatus] = useState<string>('');
  // Store preview URLs to prevent them from being revoked
  const [previewUrls, setPreviewUrls] = useState<Map<File, string>>(new Map());

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  
  // Active ticket check state
  const [checkingActiveTicket, setCheckingActiveTicket] = useState(false);
  const [activeTicket, setActiveTicket] = useState<{ ticketNumber: string; status: string } | null>(null);
  
  // Active tickets for all vehicles (for dropdown display)
  const [vehicleActiveTickets, setVehicleActiveTickets] = useState<Map<string, { ticketNumber: string; status: string }>>(new Map());
  const [checkingVehicleTickets, setCheckingVehicleTickets] = useState(false);

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
      setExistingImages(Array.isArray(ticket.image_urls) ? ticket.image_urls as string[] : []);

      // Set initial vehicle search text if editing
      if (ticket.vehicle_id) {
        const vehicle = vehicles.find(v => v.id === ticket.vehicle_id);
        if (vehicle) {
          setVehicleSearch(`${vehicle.plate} ${vehicle.make ? `(${vehicle.make} ${vehicle.model})` : ''}`);
        }
      }
    }
  }, [ticket, vehicles]);

  // Filter vehicles when search changes
  useEffect(() => {
    if (!vehicleSearch) {
      setFilteredVehicles(vehicles);
      return;
    }

    const searchLower = vehicleSearch.toLowerCase();
    const filtered = vehicles.filter(v =>
      v.plate.toLowerCase().includes(searchLower) ||
      (v.make && v.make.toLowerCase().includes(searchLower)) ||
      (v.model && v.model.toLowerCase().includes(searchLower))
    );
    setFilteredVehicles(filtered);
  }, [vehicleSearch, vehicles]);

  // Check active tickets for all filtered vehicles when dropdown opens (only for new tickets)
  useEffect(() => {
    const checkVehicleTickets = async () => {
      if (isEdit || !showVehicleDropdown || filteredVehicles.length === 0) {
        return;
      }

      setCheckingVehicleTickets(true);
      try {
        const statusLabels: Record<string, string> = {
          pending: 'รออนุมัติ',
          approved_inspector: 'อนุมัติโดยผู้ตรวจสอบ',
          approved_manager: 'อนุมัติโดยผู้จัดการ',
          ready_for_repair: 'พร้อมซ่อม',
          in_progress: 'กำลังซ่อม',
        };

        // Check active tickets for all filtered vehicles in parallel
        const ticketPromises = filteredVehicles.map(async (vehicle) => {
          try {
            const active = await ticketService.getActiveTicket(vehicle.id);
            if (active) {
              // tickets_with_relations view includes ticket_number from tickets table
              const activeWithNumber = active as any;
              return {
                vehicleId: vehicle.id,
                ticket: {
                  ticketNumber: activeWithNumber.ticket_number || `#${active.id}`,
                  status: statusLabels[active.status] || active.status,
                },
              };
            }
            return null;
          } catch (err) {
            console.error(`[TicketFormView] Error checking ticket for vehicle ${vehicle.id}:`, err);
            return null;
          }
        });

        const results = await Promise.all(ticketPromises);
        const ticketsMap = new Map<string, { ticketNumber: string; status: string }>();
        
        results.forEach((result) => {
          if (result) {
            ticketsMap.set(result.vehicleId, result.ticket);
          }
        });

        setVehicleActiveTickets(ticketsMap);
      } catch (err) {
        console.error('[TicketFormView] Error checking vehicle tickets:', err);
      } finally {
        setCheckingVehicleTickets(false);
      }
    };

    // Debounce to avoid too many API calls
    const timeoutId = setTimeout(checkVehicleTickets, 300);
    return () => clearTimeout(timeoutId);
  }, [showVehicleDropdown, filteredVehicles, isEdit]);

  // Check for active ticket when vehicle is selected (only for new tickets)
  useEffect(() => {
    const checkActiveTicket = async () => {
      if (!formData.vehicle_id || isEdit) {
        setActiveTicket(null);
        return;
      }

      setCheckingActiveTicket(true);
      try {
        const active = await ticketService.getActiveTicket(formData.vehicle_id);
        if (active) {
          const statusLabels: Record<string, string> = {
            pending: 'รออนุมัติ',
            approved_inspector: 'อนุมัติโดยผู้ตรวจสอบ',
            approved_manager: 'อนุมัติโดยผู้จัดการ',
            ready_for_repair: 'พร้อมซ่อม',
            in_progress: 'กำลังซ่อม',
          };
          // tickets_with_relations view includes ticket_number from tickets table
          const activeWithNumber = active as any;
          setActiveTicket({
            ticketNumber: activeWithNumber.ticket_number || `#${active.id}`,
            status: statusLabels[active.status] || active.status,
          });
        } else {
          setActiveTicket(null);
        }
      } catch (err) {
        console.error('[TicketFormView] Error checking active ticket:', err);
        setActiveTicket(null);
      } finally {
        setCheckingActiveTicket(false);
      }
    };

    // Debounce check to avoid too many API calls
    const timeoutId = setTimeout(checkActiveTicket, 500);
    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.vehicle_id, isEdit]);

  // Cleanup blob URLs when component unmounts
  useEffect(() => {
    return () => {
      // Revoke all object URLs on cleanup
      previewUrls.forEach((url) => {
        URL.revokeObjectURL(url);
      });
    };
  }, [previewUrls]);

  const handleChange = (field: string, value: string | UrgencyLevel | TicketStatus) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError(null);
    setSuccess(false);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      // Validate file size (e.g., 10MB limit)
      const validFiles = newFiles.filter((file: File) => {
        if (file.size > 10 * 1024 * 1024) {
          setError(`ไฟล์ ${file.name} มีขนาดใหญ่เกิน 10MB`);
          return false;
        }
        return true;
      });

      // Create blob URLs for new files and store them
      const newPreviewUrls = new Map(previewUrls);
      validFiles.forEach((file: File) => {
        if (!newPreviewUrls.has(file)) {
          newPreviewUrls.set(file, URL.createObjectURL(file as Blob));
        }
      });
      setPreviewUrls(newPreviewUrls);
      setSelectedFiles(prev => [...prev, ...validFiles]);
    }
  };

  const removeFile = (index: number) => {
    const fileToRemove = selectedFiles[index];

    // Revoke the blob URL for the removed file
    const url = previewUrls.get(fileToRemove);
    if (url) {
      URL.revokeObjectURL(url);
      const newPreviewUrls = new Map(previewUrls);
      newPreviewUrls.delete(fileToRemove);
      setPreviewUrls(newPreviewUrls);
    }

    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const removeExistingImage = (url: string) => {
    setExistingImages(prev => prev.filter(img => img !== url));
  };

  const validate = (): boolean => {
    if (!formData.vehicle_id) {
      setError('กรุณาเลือกยานพาหนะ');
      return false;
    }
    
    // Check for active ticket (only for new tickets)
    if (!isEdit && activeTicket) {
      setError(`ไม่สามารถแจ้งซ่อมได้ เนื่องจากรถคันนี้มีตั๋ว ${activeTicket.ticketNumber} ที่ยังไม่เสร็จสิ้น (สถานะ: ${activeTicket.status}) กรุณารอให้ตั๋วเดิมเสร็จสิ้นก่อน`);
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
        image_urls: [] as string[],
      };

      // Upload files if any
      let uploadedUrls: string[] = [];
      if (selectedFiles.length > 0) {
        setUploading(true);
        setUploadStatus('กำลังเตรียมไฟล์...');

        try {
          // Upload with progress tracking
          uploadedUrls = await storageService.uploadFiles(
            selectedFiles,
            'ticket-attachments',
            '',
            (progress: UploadProgress) => {
              // Update progress for this file
              setUploadProgress(prev => {
                const newProgress = new Map(prev);
                newProgress.set(progress.fileName, progress.progress);
                return newProgress;
              });

              // Update status message
              if (progress.status === 'uploading') {
                if (progress.progress < 20) {
                  setUploadStatus(`กำลังบีบอัดรูปภาพ ${progress.fileName}...`);
                } else {
                  setUploadStatus(`กำลังอัปโหลด ${progress.fileName}... (${Math.round(progress.progress)}%)`);
                }
              } else if (progress.status === 'complete') {
                setUploadStatus(`อัปโหลด ${progress.fileName} สำเร็จ`);
              } else if (progress.status === 'error') {
                setUploadStatus(`เกิดข้อผิดพลาดกับ ${progress.fileName}`);
              }
            }
          );

          setUploadStatus('อัปโหลดไฟล์สำเร็จทั้งหมด');
        } catch (uploadError) {
          console.error('Upload failed:', uploadError);
          setError(uploadError instanceof Error ? uploadError.message : 'เกิดข้อผิดพลาดในการอัปโหลดไฟล์');
          setSaving(false);
          setUploading(false);
          setUploadStatus('');
          setUploadProgress(new Map());
          return;
        }
      }

      data.image_urls = [...existingImages, ...uploadedUrls];

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
      setUploading(false);
      setUploadStatus('');
      setUploadProgress(new Map());
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
    { value: 'low', label: 'ต่ำ (ใช้งานได้ปกติ)' },
    { value: 'medium', label: 'ปานกลาง (ควรซ่อมเร็วๆ นี้)' },
    { value: 'high', label: 'สูง (มีผลต่อการขับขี่)' },
    { value: 'critical', label: 'วิกฤต (ห้ามใช้งาน)' },
  ];

  const repairTypeOptions = [
    'เปลี่ยนถ่ายน้ำมันเครื่อง',
    'ยางและช่วงล่าง',
    'ระบบเบรก',
    'แบตเตอรี่และระบบไฟ',
    'เครื่องยนต์',
    'ระบบแอร์',
    'ตัวถังและสี',
    'กระจกและอุปกรณ์ภายนอก',
    'อุปกรณ์ภายในห้องโดยสาร',
    'ตรวจเช็คระยะ',
    'อื่นๆ'
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
          {/* Active Ticket Warning */}
          {!isEdit && activeTicket && (
            <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-amber-800 dark:text-amber-200 mb-1">
                  ⚠️ รถคันนี้มีตั๋วที่ยังไม่เสร็จสิ้น
                </p>
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  ตั๋ว <span className="font-semibold">{activeTicket.ticketNumber}</span> ยังอยู่ในสถานะ <span className="font-semibold">{activeTicket.status}</span>
                </p>
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
                  กรุณารอให้ตั๋วเดิมเสร็จสิ้น (สถานะ: เสร็จสิ้น หรือ ปฏิเสธ) ก่อนแจ้งซ่อมใหม่
                </p>
              </div>
            </div>
          )}

          {/* Checking Active Ticket */}
          {!isEdit && checkingActiveTicket && formData.vehicle_id && (
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg flex items-center gap-3">
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-600 border-t-transparent"></div>
              <p className="text-sm text-blue-800 dark:text-blue-200">
                กำลังตรวจสอบตั๋วที่ยังไม่เสร็จสิ้น...
              </p>
            </div>
          )}

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

          {/* Upload Progress Indicator */}
          {uploading && uploadStatus && (
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <div className="flex items-center gap-3 mb-2">
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-600 border-t-transparent"></div>
                <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
                  {uploadStatus}
                </p>
              </div>
              {/* Progress bars for individual files */}
              {Array.from(uploadProgress.entries()).map(([fileName, progress]) => (
                <div key={fileName} className="mt-2">
                  <div className="flex justify-between text-xs text-blue-700 dark:text-blue-300 mb-1">
                    <span className="truncate max-w-[70%]">{fileName}</span>
                    <span>{Math.round(progress)}%</span>
                  </div>
                  <div className="w-full bg-blue-200 dark:bg-blue-800 rounded-full h-1.5">
                    <div
                      className="bg-blue-600 dark:bg-blue-400 h-1.5 rounded-full transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Form Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2 relative">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                ยานพาหนะ *
              </label>
              {loadingVehicles ? (
                <p className="text-sm text-slate-500">กำลังโหลด...</p>
              ) : (
                <div className="relative">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                    <input
                      type="text"
                      value={vehicleSearch}
                      onChange={(e) => {
                        setVehicleSearch(e.target.value);
                        setShowVehicleDropdown(true);
                        if (e.target.value === '') {
                          handleChange('vehicle_id', '');
                        }
                      }}
                      onFocus={() => setShowVehicleDropdown(true)}
                      placeholder="ค้นหาทะเบียน, ยี่ห้อ หรือรุ่น..."
                      className="w-full pl-9 pr-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-enterprise-500 focus:border-transparent"
                      disabled={saving || !!initialVehicleId}
                    />
                    {initialVehicleId && (
                      <div className="absolute inset-0 bg-gray-100/50 dark:bg-gray-800/50 rounded-lg cursor-not-allowed" />
                    )}
                  </div>

                  {showVehicleDropdown && !initialVehicleId && (
                    <div className="absolute z-10 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg max-h-60 overflow-auto">
                      {checkingVehicleTickets && !isEdit && (
                        <div className="px-4 py-2 text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
                          <div className="animate-spin rounded-full h-3 w-3 border-2 border-slate-400 border-t-transparent"></div>
                          กำลังตรวจสอบสถานะตั๋ว...
                        </div>
                      )}
                      {filteredVehicles.length > 0 ? (
                        filteredVehicles.map(vehicle => {
                          const activeTicketInfo = vehicleActiveTickets.get(vehicle.id);
                          return (
                            <button
                              key={vehicle.id}
                              type="button"
                              onClick={() => {
                                handleChange('vehicle_id', vehicle.id);
                                setVehicleSearch(`${vehicle.plate} ${vehicle.make ? `(${vehicle.make} ${vehicle.model})` : ''}`);
                                setShowVehicleDropdown(false);
                              }}
                              className={`w-full text-left px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-700/50 flex items-center justify-between group ${
                                activeTicketInfo ? 'border-l-2 border-amber-400' : ''
                              }`}
                            >
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-slate-900 dark:text-white">
                                  {vehicle.plate}
                                </p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                  {vehicle.make} {vehicle.model}
                                </p>
                                {activeTicketInfo && (
                                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-1 font-medium">
                                    ⚠️ มีตั๋ว {activeTicketInfo.ticketNumber} ({activeTicketInfo.status})
                                  </p>
                                )}
                              </div>
                              {formData.vehicle_id === vehicle.id && (
                                <Check className="w-4 h-4 text-enterprise-600 dark:text-neon-blue flex-shrink-0 ml-2" />
                              )}
                            </button>
                          );
                        })
                      ) : (
                        <div className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400 text-center">
                          ไม่พบยานพาหนะ
                        </div>
                      )}
                    </div>
                  )}

                  {/* Overlay to close dropdown when clicking outside */}
                  {showVehicleDropdown && (
                    <div
                      className="fixed inset-0 z-0"
                      onClick={() => setShowVehicleDropdown(false)}
                    />
                  )}
                </div>
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
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                ประเภทการซ่อม *
              </label>
              <select
                value={formData.repair_type}
                onChange={(e) => handleChange('repair_type', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-enterprise-500 focus:border-transparent"
                required
                disabled={saving}
              >
                <option value="">เลือกประเภทการซ่อม</option>
                {repairTypeOptions.map(option => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
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

          {/* File Upload Section */}
          <div className="mt-6">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              รูปภาพหรือวิดีโอประกอบ
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mb-4">
              {/* Existing Images */}
              {existingImages.map((url, index) => (
                <div key={`existing-${index}`} className="relative group aspect-video bg-slate-100 dark:bg-slate-800 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700">
                  <img src={url} alt={`Evidence ${index + 1}`} className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removeExistingImage(url)}
                    className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}

              {/* Selected Files Previews */}
              {selectedFiles.map((file, index) => {
                const previewUrl = previewUrls.get(file);
                return (
                  <div key={`new-${index}`} className="relative group aspect-video bg-slate-100 dark:bg-slate-800 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 flex items-center justify-center">
                    {file.type.startsWith('image/') && previewUrl ? (
                      <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                    ) : file.type.startsWith('image/') ? (
                      <div className="flex flex-col items-center text-slate-500">
                        <ImageIcon size={32} className="mb-2" />
                        <span className="text-xs truncate max-w-[90%]">{file.name}</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center text-slate-500">
                        <FileVideo size={32} className="mb-2" />
                        <span className="text-xs truncate max-w-[90%]">{file.name}</span>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => removeFile(index)}
                      className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X size={16} />
                    </button>
                  </div>
                );
              })}

              {/* Upload Button */}
              <label className="cursor-pointer flex flex-col items-center justify-center aspect-video border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <Upload className="w-8 h-8 mb-3 text-slate-400" />
                  <p className="mb-2 text-sm text-slate-500 dark:text-slate-400">
                    <span className="font-semibold">คลิกเพื่ออัปโหลด</span>
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    PNG, JPG, MP4 (สูงสุด 10MB)
                  </p>
                </div>
                <input
                  type="file"
                  className="hidden"
                  multiple
                  accept="image/*,video/*"
                  capture="environment"
                  onChange={handleFileSelect}
                />
              </label>
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
              disabled={saving || uploading || (!isEdit && !!activeTicket) || checkingActiveTicket}
              isLoading={saving || uploading}
            >
              <Save className="w-4 h-4 mr-2" />
              {uploading ? 'กำลังอัปโหลด...' : 'บันทึก'}
            </Button>
          </div>
        </form>
      </Card>
    </PageLayout>
  );
};
