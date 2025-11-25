// Trip Log Form View - Check-out/Check-in form
import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  Save, 
  AlertCircle, 
  CheckCircle,
  Truck,
  Gauge,
  MapPin,
  Route,
  FileText,
  Clock,
  AlertTriangle
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card } from '../components/ui/Card';
import { PageLayout } from '../components/layout/PageLayout';
import { useVehicles, useActiveTrips, useTripCheckout, useTripCheckin, useVehicleStatus } from '../hooks';
import { tripLogService } from '../services/tripLogService';

interface TripLogFormViewProps {
  vehicleId?: string;
  tripId?: string; // For check-in
  mode?: 'checkout' | 'checkin';
  onSave?: () => void;
  onCancel?: () => void;
}

export const TripLogFormView: React.FC<TripLogFormViewProps> = ({
  vehicleId: initialVehicleId,
  tripId,
  mode: initialMode,
  onSave,
  onCancel,
}) => {
  const { vehicles, loading: loadingVehicles, error: vehiclesError } = useVehicles();
  const { trips: activeTrips, refetch: refetchActiveTrips, loading: loadingActiveTrips } = useActiveTrips();
  const { checkout, loading: checkingOut } = useTripCheckout();
  const { checkin, loading: checkingIn } = useTripCheckin();
  const { activeTrip: vehicleActiveTrip, refetch: refetchVehicleStatus, loading: loadingVehicleStatus } = useVehicleStatus(initialVehicleId || '');

  // Determine mode: if tripId provided, it's check-in; otherwise checkout
  const [mode, setMode] = useState<'checkout' | 'checkin'>(initialMode || (tripId ? 'checkin' : 'checkout'));
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>(initialVehicleId || '');
  const [selectedTripId, setSelectedTripId] = useState<string>(tripId || '');

  const [formData, setFormData] = useState({
    odometer: '',
    destination: '',
    route: '',
    notes: '',
  });

  const [odometerValidation, setOdometerValidation] = useState<{
    valid: boolean;
    warning?: string;
    lastOdometer?: number;
  } | null>(null);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Load active trip data for check-in
  useEffect(() => {
    if (mode === 'checkin') {
      if (selectedTripId) {
        // If tripId is provided, load that trip
        tripLogService.getById(selectedTripId).then((trip) => {
          if (trip) {
            setFormData({
              odometer: '',
              destination: trip.destination || '',
              route: trip.route || '',
              notes: trip.notes || '',
            });
            setSelectedVehicleId(trip.vehicle_id);
          }
        }).catch((err) => {
          console.error('Error loading trip:', err);
          setError('ไม่สามารถโหลดข้อมูลการเดินทางได้');
        });
      } else if (selectedVehicleId && vehicleActiveTrip) {
        // If vehicleId is provided, use the active trip for that vehicle
        setSelectedTripId(vehicleActiveTrip.id);
        setFormData({
          odometer: '',
          destination: vehicleActiveTrip.destination || '',
          route: vehicleActiveTrip.route || '',
          notes: vehicleActiveTrip.notes || '',
        });
      } else if (selectedVehicleId && !vehicleActiveTrip && !loadingVehicleStatus) {
        // Vehicle has no active trip
        setError('รถคันนี้ไม่มี trip ที่ยังไม่ check-in');
      } else if (!selectedVehicleId && !selectedTripId) {
        // Try to find active trip from activeTrips
        if (activeTrips.length > 0) {
          const firstActiveTrip = activeTrips[0];
          setSelectedTripId(firstActiveTrip.id);
          setSelectedVehicleId(firstActiveTrip.vehicle_id);
          setFormData({
            odometer: '',
            destination: firstActiveTrip.destination || '',
            route: firstActiveTrip.route || '',
            notes: firstActiveTrip.notes || '',
          });
        }
      }
    }
  }, [mode, selectedTripId, selectedVehicleId, vehicleActiveTrip, activeTrips, loadingVehicleStatus]);

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

  const selectedVehicle = vehicles.find(v => v.id === selectedVehicleId);
  const selectedTrip = activeTrips.find(t => t.id === selectedTripId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (!selectedVehicleId) {
      setError('กรุณาเลือกรถ');
      return;
    }

    const odometerValue = parseInt(formData.odometer);
    if (isNaN(odometerValue) || odometerValue <= 0) {
      setError('กรุณากรอกเลขไมล์ที่ถูกต้อง');
      return;
    }

    setSaving(true);

    try {
      if (mode === 'checkout') {
        // Check if vehicle already has active trip
        const vehicleStatus = await tripLogService.getActiveTripsByVehicle(selectedVehicleId);
        if (vehicleStatus.length > 0) {
          setError('รถคันนี้มี trip ที่ยังไม่ check-in กรุณา check-in ก่อน');
          setSaving(false);
          return;
        }

        await checkout({
          vehicle_id: selectedVehicleId,
          odometer_start: odometerValue,
          destination: formData.destination || undefined,
          route: formData.route || undefined,
          notes: formData.notes || undefined,
        });

        setSuccess(true);
        setTimeout(() => {
          if (onSave) onSave();
        }, 1500);
      } else {
        // Check-in
        if (!selectedTripId) {
          setError('ไม่พบข้อมูลการเดินทาง');
          setSaving(false);
          return;
        }

        // Validate odometer_end > odometer_start
        if (selectedTrip && odometerValue <= selectedTrip.odometer_start) {
          setError(`เลขไมล์กลับ (${odometerValue.toLocaleString()}) ต้องมากกว่าเลขไมล์ออก (${selectedTrip.odometer_start.toLocaleString()})`);
          setSaving(false);
          return;
        }

        // Validate distance <= 500 km
        if (selectedTrip && (odometerValue - selectedTrip.odometer_start) > 500) {
          setError(`ระยะทาง (${(odometerValue - selectedTrip.odometer_start).toLocaleString()} km) เกิน 500 km กรุณาตรวจสอบ`);
          setSaving(false);
          return;
        }

        await checkin(selectedTripId, {
          odometer_end: odometerValue,
          destination: formData.destination || undefined,
          route: formData.route || undefined,
          notes: formData.notes || undefined,
        });

        setSuccess(true);
        setTimeout(() => {
          if (onSave) onSave();
        }, 1500);
      }

      // Refresh active trips
      refetchActiveTrips();
      if (selectedVehicleId) {
        refetchVehicleStatus();
      }
    } catch (err: any) {
      setError(err.message || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล');
    } finally {
      setSaving(false);
    }
  };

  // Show loading state
  if (loadingVehicles || (mode === 'checkin' && loadingVehicleStatus)) {
    return (
      <PageLayout
        title={mode === 'checkout' ? 'บันทึกเลขไมล์ออก' : 'บันทึกเลขไมล์กลับ'}
        subtitle="กำลังโหลดข้อมูล..."
        loading={true}
      />
    );
  }

  // Show error if vehicles failed to load
  if (vehiclesError) {
    return (
      <PageLayout
        title={mode === 'checkout' ? 'บันทึกเลขไมล์ออก' : 'บันทึกเลขไมล์กลับ'}
        subtitle="เกิดข้อผิดพลาด"
        error={true}
        onRetry={() => window.location.reload()}
      />
    );
  }

  return (
    <PageLayout
      title={mode === 'checkout' ? 'บันทึกเลขไมล์ออก' : 'บันทึกเลขไมล์กลับ'}
      subtitle={mode === 'checkout' 
        ? 'บันทึกเลขไมล์เมื่อออกเดินทาง' 
        : 'บันทึกเลขไมล์เมื่อกลับจากเดินทาง'}
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
              <span className="font-medium">
                {mode === 'checkout' ? 'บันทึกการออกเดินทางสำเร็จ' : 'บันทึกการกลับสำเร็จ'}
              </span>
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

        {/* Vehicle Selection (for checkout) */}
        {mode === 'checkout' && (
          <Card className="p-6">
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
                  <select
                    value={selectedVehicleId}
                    onChange={(e) => {
                      setSelectedVehicleId(e.target.value);
                      setOdometerValidation(null);
                    }}
                    className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-enterprise-500 focus:border-transparent"
                    required
                  >
                    <option value="">-- เลือกรถ --</option>
                    {vehicles.map((vehicle) => {
                      const hasActiveTrip = activeTrips.some(t => t.vehicle_id === vehicle.id);
                      return (
                        <option 
                          key={vehicle.id} 
                          value={vehicle.id}
                          disabled={hasActiveTrip}
                        >
                          {vehicle.plate} {vehicle.make && vehicle.model ? `(${vehicle.make} ${vehicle.model})` : ''}
                          {hasActiveTrip ? ' - มี trip ที่ยังไม่ check-in' : ''}
                        </option>
                      );
                    })}
                  </select>
                )}
              </div>
            </div>
          </Card>
        )}

        {/* Active Trip Info (for check-in) */}
        {mode === 'checkin' && loadingVehicleStatus && (
          <Card className="p-6">
            <div className="text-center text-slate-500 dark:text-slate-400">
              กำลังโหลดข้อมูลการเดินทาง...
            </div>
          </Card>
        )}
        {mode === 'checkin' && !loadingVehicleStatus && !selectedTrip && (
          <Card className="p-6 bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800">
            <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
              <AlertTriangle size={20} />
              <span>ไม่พบข้อมูลการเดินทางที่ยังไม่ check-in สำหรับรถคันนี้</span>
            </div>
          </Card>
        )}
        {mode === 'checkin' && selectedTrip && (
          <Card className="p-6 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
            <div className="space-y-2">
              <h3 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <Truck size={18} />
                รถ: {selectedTrip.vehicle?.plate || 'N/A'}
              </h3>
              <div className="text-sm text-slate-600 dark:text-slate-400">
                <div className="flex items-center gap-2">
                  <Gauge size={16} />
                  เลขไมล์ออก: {selectedTrip.odometer_start.toLocaleString()} km
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <Clock size={16} />
                  ออกเมื่อ: {new Date(selectedTrip.checkout_time).toLocaleString('th-TH')}
                </div>
                {selectedTrip.destination && (
                  <div className="flex items-center gap-2 mt-1">
                    <MapPin size={16} />
                    ปลายทาง: {selectedTrip.destination}
                  </div>
                )}
              </div>
            </div>
          </Card>
        )}

        {/* Odometer Input */}
        <Card className="p-6">
          <div className="space-y-4">
            <div>
              <Input
                label={
                  <span className="flex items-center gap-2">
                    <Gauge size={18} />
                    {mode === 'checkout' ? 'เลขไมล์ออก' : 'เลขไมล์กลับ'}
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
                    ? `เลขไมล์ล่าสุด: ${odometerValidation.lastOdometer.toLocaleString()} km`
                    : undefined
                }
              />
              {odometerValidation?.warning && odometerValidation.valid && (
                <div className="mt-2 p-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded flex items-start gap-2 text-amber-800 dark:text-amber-200 text-sm">
                  <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
                  <span>{odometerValidation.warning}</span>
                </div>
              )}
            </div>

            {/* Distance calculation for check-in */}
            {mode === 'checkin' && selectedTrip && formData.odometer && (
              <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                <div className="text-sm text-slate-600 dark:text-slate-400">
                  ระยะทาง: {(() => {
                    const odometerValue = parseInt(formData.odometer);
                    if (!isNaN(odometerValue) && odometerValue > selectedTrip.odometer_start) {
                      const distance = odometerValue - selectedTrip.odometer_start;
                      return `${distance.toLocaleString()} km`;
                    }
                    return 'N/A';
                  })()}
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* Optional Fields */}
        <Card className="p-6">
          <div className="space-y-4">
            <Input
              label={
                <span className="flex items-center gap-2">
                  <MapPin size={18} />
                  ปลายทาง (ไม่บังคับ)
                </span>
              }
              value={formData.destination}
              onChange={(e) => setFormData({ ...formData, destination: e.target.value })}
              placeholder="กรอกปลายทาง"
            />

            <Input
              label={
                <span className="flex items-center gap-2">
                  <Route size={18} />
                  เส้นทาง (ไม่บังคับ)
                </span>
              }
              value={formData.route}
              onChange={(e) => setFormData({ ...formData, route: e.target.value })}
              placeholder="กรอกเส้นทาง"
            />

            <div>
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
          </div>
        </Card>

        {/* Submit Button */}
        <div className="flex gap-4">
          <Button
            type="submit"
            disabled={saving || checkingOut || checkingIn}
            className="flex-1 flex items-center justify-center gap-2"
          >
            {saving || checkingOut || checkingIn ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                กำลังบันทึก...
              </>
            ) : (
              <>
                <Save size={18} />
                {mode === 'checkout' ? 'บันทึกการออก' : 'บันทึกการกลับ'}
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

