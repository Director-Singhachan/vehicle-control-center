// Fuel Log Form View - Record fuel fill-up
import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  Save,
  AlertCircle,
  CheckCircle,
  Truck,
  Gauge,
  Droplet,
  DollarSign,
  MapPin,
  FileText,
  Upload,
  X,
  Search,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card } from '../components/ui/Card';
import { PageLayout } from '../components/layout/PageLayout';
import { useVehicles, useAuth, useActiveTrips } from '../hooks';
import { fuelService } from '../services/fuelService';
import { tripLogService } from '../services/tripLogService';
import { useDataCacheStore, createCacheKey } from '../stores/dataCacheStore';

interface FuelLogFormViewProps {
  vehicleId?: string;
  onSave?: () => void;
  onCancel?: () => void;
}

const FUEL_TYPES = [
  { value: 'gasoline_91', label: 'เบนซิน 91' },
  { value: 'gasoline_95', label: 'เบนซิน 95' },
  { value: 'gasohol_91', label: 'แก๊สโซฮอล์ 91' },
  { value: 'gasohol_95', label: 'แก๊สโซฮอล์ 95' },
  { value: 'diesel', label: 'ดีเซล' },
  { value: 'e20', label: 'E20' },
  { value: 'e85', label: 'E85' },
];

export const FuelLogFormView: React.FC<FuelLogFormViewProps> = ({
  vehicleId: initialVehicleId,
  onSave,
  onCancel,
}) => {
  const { user, isDriver } = useAuth();
  const { vehicles, loading: loadingVehicles, error: vehiclesError } = useVehicles();
  const { trips: activeTrips } = useActiveTrips();
  const cache = useDataCacheStore();

  const [selectedVehicleId, setSelectedVehicleId] = useState<string>(initialVehicleId || '');
  const [vehicleSearchQuery, setVehicleSearchQuery] = useState<string>('');
  const [showVehicleDropdown, setShowVehicleDropdown] = useState(false);
  const vehicleDropdownRef = useRef<HTMLDivElement>(null);

  const [formData, setFormData] = useState({
    odometer: '',
    fuel_type: 'gasoline_95',
    liters: '',
    price_per_liter: '',
    fuel_station: '',
    fuel_station_location: '',
    receipt_number: '',
    notes: '',
    is_full_tank: true,
  });

  const [receiptImage, setReceiptImage] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [odometerValidation, setOdometerValidation] = useState<{
    valid: boolean;
    warning?: string;
    lastOdometer?: number;
  } | null>(null);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [calculatedTotal, setCalculatedTotal] = useState<number>(0);
  const [lastFuelRecord, setLastFuelRecord] = useState<any>(null);

  // Calculate total cost
  useEffect(() => {
    const liters = parseFloat(formData.liters) || 0;
    const pricePerLiter = parseFloat(formData.price_per_liter) || 0;
    setCalculatedTotal(liters * pricePerLiter);
  }, [formData.liters, formData.price_per_liter]);

  // Auto-fill last odometer when vehicle is selected
  useEffect(() => {
    if (selectedVehicleId && !formData.odometer.trim()) {
      tripLogService.getLastOdometer(selectedVehicleId)
        .then((lastOdometer) => {
          if (lastOdometer !== null) {
            setFormData(prev => {
              if (!prev.odometer.trim()) {
                return { ...prev, odometer: lastOdometer.toString() };
              }
              return prev;
            });
          }
        })
        .catch((err) => {
          console.error('Error fetching last odometer:', err);
        });

      // Get last fuel record for this vehicle
      fuelService.getLatest(selectedVehicleId)
        .then((record) => {
          if (record) {
            setLastFuelRecord(record);
            // Auto-fill price per liter if available
            if (record.price_per_liter && !formData.price_per_liter) {
              setFormData(prev => ({
                ...prev,
                price_per_liter: record.price_per_liter.toString(),
              }));
            }
          }
        })
        .catch((err) => {
          console.error('Error fetching last fuel record:', err);
        });
    }
  }, [selectedVehicleId]);

  // Validate odometer when it changes
  useEffect(() => {
    if (formData.odometer && selectedVehicleId) {
      const odometerValue = parseInt(formData.odometer);
      if (!isNaN(odometerValue)) {
        tripLogService.validateOdometer(selectedVehicleId, odometerValue)
          .then((result) => {
            setOdometerValidation(result);
          })
          .catch((err) => {
            console.error('Error validating odometer:', err);
          });
      }
    } else {
      setOdometerValidation(null);
    }
  }, [formData.odometer, selectedVehicleId]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (vehicleDropdownRef.current && !vehicleDropdownRef.current.contains(event.target as Node)) {
        setShowVehicleDropdown(false);
      }
    };

    if (showVehicleDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showVehicleDropdown]);

  const selectedVehicle = vehicles.find(v => v.id === selectedVehicleId);

  // Filter vehicles based on search query and active trips
  // For drivers: only show vehicles they are using (have active trip with their driver_id) or vehicles with no active trip
  // For staff: show all vehicles but indicate which ones are in use
  const filteredVehicles = vehicles.filter((vehicle) => {
    // First filter by search query
    if (vehicleSearchQuery) {
      const query = vehicleSearchQuery.toLowerCase();
      const plate = vehicle.plate?.toLowerCase() || '';
      const make = vehicle.make?.toLowerCase() || '';
      const model = vehicle.model?.toLowerCase() || '';
      if (!plate.includes(query) && !make.includes(query) && !model.includes(query)) {
        return false;
      }
    }

    // Then filter by active trips (for drivers only)
    if (isDriver && user) {
      const vehicleActiveTrip = activeTrips.find(t => t.vehicle_id === vehicle.id);
      if (vehicleActiveTrip) {
        // Only show if the driver is the one using this vehicle
        return vehicleActiveTrip.driver_id === user.id;
      }
      // If no active trip, show the vehicle (available)
      return true;
    }

    // For staff, show all vehicles
    return true;
  });

  const handleReceiptUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError('ไฟล์รูปภาพต้องไม่เกิน 5 MB');
        return;
      }
      setReceiptImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setReceiptPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (!selectedVehicleId) {
      setError('กรุณาเลือกรถ');
      return;
    }

    if (!user) {
      setError('กรุณา login');
      return;
    }

    const odometerValue = parseInt(formData.odometer);
    if (isNaN(odometerValue) || odometerValue <= 0) {
      setError('กรุณากรอกเลขไมล์ที่ถูกต้อง');
      return;
    }

    const liters = parseFloat(formData.liters);
    if (isNaN(liters) || liters <= 0) {
      setError('กรุณากรอกจำนวนลิตรที่ถูกต้อง');
      return;
    }

    const pricePerLiter = parseFloat(formData.price_per_liter);
    if (isNaN(pricePerLiter) || pricePerLiter <= 0) {
      setError('กรุณากรอกราคาต่อลิตรที่ถูกต้อง');
      return;
    }

    setSaving(true);

    try {
      let receiptImageUrl: string | null = null;

      // Upload receipt image if provided
      if (receiptImage && selectedVehicleId) {
        receiptImageUrl = await fuelService.uploadReceipt(receiptImage, selectedVehicleId);
      }

      // Create fuel record
      await fuelService.create({
        vehicle_id: selectedVehicleId,
        user_id: user.id,
        odometer: odometerValue,
        fuel_type: formData.fuel_type,
        liters: liters,
        price_per_liter: pricePerLiter,
        fuel_station: formData.fuel_station || null,
        fuel_station_location: formData.fuel_station_location || null,
        receipt_number: formData.receipt_number || null,
        receipt_image_url: receiptImageUrl,
        notes: formData.notes || null,
        is_full_tank: formData.is_full_tank,
        filled_at: new Date().toISOString(),
      });

      setSuccess(true);

      // Clear form data after successful save
      setTimeout(() => {
        setFormData({
          odometer: '',
          fuel_type: 'gasoline_95',
          liters: '',
          price_per_liter: '',
          fuel_station: '',
          fuel_station_location: '',
          receipt_number: '',
          notes: '',
          is_full_tank: true,
        });
        setReceiptImage(null);
        setReceiptPreview(null);
        setSelectedVehicleId('');
        setVehicleSearchQuery('');
        setOdometerValidation(null);
        setShowVehicleDropdown(false);
        setSuccess(false);
        setLastFuelRecord(null);

        // Invalidate cache
        cache.invalidate([createCacheKey('fuel-logs', {})]);

        if (onSave) onSave();
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล');
    } finally {
      setSaving(false);
    }
  };

  // Show loading state
  if (loadingVehicles) {
    return (
      <PageLayout
        title="บันทึกการเติมน้ำมัน"
        subtitle="กำลังโหลดข้อมูล..."
        loading={true}
      />
    );
  }

  // Show error if vehicles failed to load
  if (vehiclesError) {
    return (
      <PageLayout
        title="บันทึกการเติมน้ำมัน"
        subtitle="เกิดข้อผิดพลาด"
        error={true}
        onRetry={() => window.location.reload()}
      />
    );
  }

  return (
    <PageLayout
      title="บันทึกการเติมน้ำมัน"
      subtitle="บันทึกข้อมูลการเติมน้ำมันแต่ละครั้ง"
      actions={
        onCancel && (
          <Button
            variant="outline"
            onClick={onCancel}
            className="flex items-center gap-2"
          >
            <ArrowLeft size={18} />
            ยกเลิก
          </Button>
        )
      }
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Success Message */}
        {success && (
          <Card className="p-4 bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800">
            <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-200">
              <CheckCircle size={20} />
              <span className="font-medium">บันทึกการเติมน้ำมันสำเร็จ</span>
            </div>
          </Card>
        )}

        {/* Error Message */}
        {error && (
          <Card className="p-4 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800">
            <div className="flex items-center gap-2 text-red-800 dark:text-red-200">
              <AlertCircle size={20} />
              <span>{error}</span>
            </div>
          </Card>
        )}

        {/* Vehicle Selection */}
        <Card className="p-6 relative z-20">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                <Truck className="inline mr-2" size={18} />
                เลือกรถ
              </label>
              {loadingVehicles ? (
                <div className="p-4 text-center text-slate-500 dark:text-slate-400">
                  กำลังโหลดรายการรถ...
                </div>
              ) : vehicles.length === 0 ? (
                <div className="p-4 text-center text-slate-500 dark:text-slate-400">
                  ไม่พบข้อมูลรถ
                </div>
              ) : (
                <div className="relative" ref={vehicleDropdownRef}>
                  {/* Search Input */}
                  {!selectedVehicleId && (
                    <div className="relative">
                      <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400">
                        <Search size={18} />
                      </div>
                      <input
                        type="text"
                        value={vehicleSearchQuery}
                        onChange={(e) => {
                          setVehicleSearchQuery(e.target.value);
                          setShowVehicleDropdown(true);
                        }}
                        onFocus={() => setShowVehicleDropdown(true)}
                        placeholder="พิมพ์เพื่อค้นหาทะเบียนรถ..."
                        className="w-full pl-10 pr-10 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-enterprise-500 focus:border-transparent"
                      />
                      {vehicleSearchQuery && (
                        <button
                          type="button"
                          onClick={() => {
                            setVehicleSearchQuery('');
                            setShowVehicleDropdown(false);
                          }}
                          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                        >
                          <X size={18} />
                        </button>
                      )}
                    </div>
                  )}

                  {/* Dropdown List */}
                  {showVehicleDropdown && filteredVehicles.length > 0 && !selectedVehicleId && (
                    <div className="absolute z-50 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg shadow-lg max-h-60 overflow-auto">
                      {filteredVehicles.map((vehicle) => {
                        const vehicleActiveTrip = activeTrips.find(t => t.vehicle_id === vehicle.id);
                        const isMyActiveTrip = vehicleActiveTrip && user && vehicleActiveTrip.driver_id === user.id;
                        return (
                          <button
                            key={vehicle.id}
                            type="button"
                            onClick={() => {
                              setSelectedVehicleId(vehicle.id);
                              setVehicleSearchQuery('');
                              setShowVehicleDropdown(false);
                              setOdometerValidation(null);
                              setError(null);
                            }}
                            className="w-full text-left px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <div className="font-medium text-slate-900 dark:text-white">
                                  {vehicle.plate}
                                </div>
                                {vehicle.make && vehicle.model && (
                                  <div className="text-sm text-slate-500 dark:text-slate-400">
                                    {vehicle.make} {vehicle.model}
                                  </div>
                                )}
                              </div>
                              {isMyActiveTrip && (
                                <span className="ml-2 px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 rounded-full text-xs font-medium">
                                  ใช้งานอยู่
                                </span>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Show selected vehicle */}
                  {selectedVehicleId && selectedVehicle && (() => {
                    const vehicleActiveTrip = activeTrips.find(t => t.vehicle_id === selectedVehicleId);
                    const isMyActiveTrip = vehicleActiveTrip && user && vehicleActiveTrip.driver_id === user.id;
                    return (
                      <div className="mt-2 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="font-medium text-slate-900 dark:text-white flex items-center gap-2">
                              {selectedVehicle.plate}
                              {isMyActiveTrip && (
                                <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 rounded-full text-xs font-medium">
                                  ใช้งานอยู่
                                </span>
                              )}
                            </div>
                            {selectedVehicle.make && selectedVehicle.model && (
                              <div className="text-sm text-slate-500 dark:text-slate-400">
                                {selectedVehicle.make} {selectedVehicle.model}
                              </div>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedVehicleId('');
                              setVehicleSearchQuery('');
                            }}
                            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                          >
                            <X size={18} />
                          </button>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Show message if no vehicles found */}
                  {vehicleSearchQuery && filteredVehicles.length === 0 && (
                    <div className="mt-2 p-3 text-center text-slate-500 dark:text-slate-400 text-sm">
                      ไม่พบรถที่ค้นหา
                    </div>
                  )}

                  {/* Info message for drivers */}
                  {isDriver && !vehicleSearchQuery && (
                    <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded text-sm text-blue-800 dark:text-blue-200">
                      <div className="flex items-center gap-2">
                        <AlertCircle size={16} />
                        <span>
                          คุณจะเห็นเฉพาะรถที่ตัวเองใช้งานอยู่หรือรถที่พร้อมใช้งาน (ไม่มีคนอื่นใช้งาน)
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* Fuel Information */}
        <Card className="p-6">
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
              ข้อมูลการเติมน้ำมัน
            </h3>

            {/* Odometer */}
            <div>
              <Input
                label={
                  <span className="flex items-center gap-2">
                    <Gauge size={18} />
                    เลขไมล์ (Odometer)
                  </span>
                }
                type="number"
                value={formData.odometer}
                onChange={(e) => setFormData({ ...formData, odometer: e.target.value })}
                placeholder="กรอกเลขไมล์"
                required
                min={0}
                error={odometerValidation && !odometerValidation.valid ? odometerValidation.warning : undefined}
                helperText={
                  odometerValidation?.lastOdometer
                    ? `เลขไมล์ล่าสุด: ${odometerValidation.lastOdometer.toLocaleString()} km (กรอกอัตโนมัติ)`
                    : 'เลขไมล์จะถูกกรอกอัตโนมัติเมื่อเลือกรถ'
                }
              />
              {odometerValidation?.warning && odometerValidation.valid && (
                <div className="mt-2 p-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded flex items-start gap-2 text-amber-800 dark:text-amber-200 text-sm">
                  <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
                  <span>{odometerValidation.warning}</span>
                </div>
              )}
            </div>

            {/* Fuel Type */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                <Droplet className="inline mr-2" size={18} />
                ประเภทน้ำมัน
              </label>
              <select
                value={formData.fuel_type}
                onChange={(e) => setFormData({ ...formData, fuel_type: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-enterprise-500 focus:border-transparent"
                required
              >
                {FUEL_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Liters and Price */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="จำนวนลิตร (Liters)"
                type="number"
                step="0.01"
                value={formData.liters}
                onChange={(e) => setFormData({ ...formData, liters: e.target.value })}
                placeholder="กรอกจำนวนลิตร"
                required
                min={0}
              />
              <Input
                label="ราคาต่อลิตร (บาท)"
                type="number"
                step="0.01"
                value={formData.price_per_liter}
                onChange={(e) => setFormData({ ...formData, price_per_liter: e.target.value })}
                placeholder="กรอกราคาต่อลิตร"
                required
                min={0}
                helperText={lastFuelRecord ? `ราคาล่าสุด: ${lastFuelRecord.price_per_liter.toLocaleString()} บาท/ลิตร` : undefined}
              />
            </div>

            {/* Total Cost */}
            {calculatedTotal > 0 && (
              <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    รวมเป็นเงิน
                  </span>
                  <span className="text-lg font-semibold text-slate-900 dark:text-white">
                    ฿{calculatedTotal.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            )}

            {/* Full Tank Toggle */}
            <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <Droplet size={18} className="text-slate-600 dark:text-slate-400" />
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  เติมเต็มถัง
                </span>
              </div>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, is_full_tank: !formData.is_full_tank })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  formData.is_full_tank ? 'bg-enterprise-600' : 'bg-slate-300 dark:bg-slate-600'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    formData.is_full_tank ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>
        </Card>

        {/* Station Information */}
        <Card className="p-6">
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
              ข้อมูลปั๊มน้ำมัน
            </h3>

            <Input
              label={
                <span className="flex items-center gap-2">
                  <MapPin size={18} />
                  ชื่อปั๊ม (ไม่บังคับ)
                </span>
              }
              value={formData.fuel_station}
              onChange={(e) => setFormData({ ...formData, fuel_station: e.target.value })}
              placeholder="กรอกชื่อปั๊มน้ำมัน"
            />

            <Input
              label="ที่อยู่ปั๊ม (ไม่บังคับ)"
              value={formData.fuel_station_location}
              onChange={(e) => setFormData({ ...formData, fuel_station_location: e.target.value })}
              placeholder="กรอกที่อยู่ปั๊ม"
            />

            <Input
              label="เลขที่ใบเสร็จ (ไม่บังคับ)"
              value={formData.receipt_number}
              onChange={(e) => setFormData({ ...formData, receipt_number: e.target.value })}
              placeholder="กรอกเลขที่ใบเสร็จ"
            />
          </div>
        </Card>

        {/* Receipt Upload */}
        <Card className="p-6">
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
              รูปใบเสร็จ (ไม่บังคับ)
            </h3>

            {receiptPreview ? (
              <div className="relative">
                <img
                  src={receiptPreview}
                  alt="Receipt preview"
                  className="w-full max-w-md rounded-lg border border-slate-200 dark:border-slate-700"
                />
                <button
                  type="button"
                  onClick={() => {
                    setReceiptImage(null);
                    setReceiptPreview(null);
                  }}
                  className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                >
                  <X size={16} />
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <Upload className="w-8 h-8 mb-2 text-slate-400" />
                  <p className="mb-2 text-sm text-slate-500 dark:text-slate-400">
                    <span className="font-semibold">คลิกเพื่ออัปโหลด</span> หรือลากไฟล์มาวาง
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">PNG, JPG, PDF (MAX. 5MB)</p>
                </div>
                <input
                  type="file"
                  className="hidden"
                  accept="image/*,.pdf"
                  onChange={handleReceiptUpload}
                />
              </label>
            )}
          </div>
        </Card>

        {/* Notes */}
        <Card className="p-6">
          <div className="space-y-4">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              <FileText className="inline mr-2" size={18} />
              หมายเหตุ (ไม่บังคับ)
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="กรอกหมายเหตุ"
              rows={3}
              className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-enterprise-500 focus:border-transparent resize-none"
            />
          </div>
        </Card>

        {/* Submit Button */}
        <div className="flex gap-4">
          <Button
            type="submit"
            disabled={saving}
            className="flex-1 flex items-center justify-center gap-2"
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                กำลังบันทึก...
              </>
            ) : (
              <>
                <Save size={18} />
                บันทึกการเติมน้ำมัน
              </>
            )}
          </Button>
          {onCancel && (
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
            >
              ยกเลิก
            </Button>
          )}
        </div>
      </form>
    </PageLayout>
  );
};

