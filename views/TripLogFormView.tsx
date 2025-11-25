// Trip Log Form View - Check-out/Check-in form
import React, { useState, useEffect, useRef } from 'react';
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
  AlertTriangle,
  Search,
  ChevronDown,
  X
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card } from '../components/ui/Card';
import { PageLayout } from '../components/layout/PageLayout';
import { useVehicles, useActiveTrips, useTripCheckout, useTripCheckin, useVehicleStatus, useAuth } from '../hooks';
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
  const { user } = useAuth();
  const { vehicles, loading: loadingVehicles, error: vehiclesError } = useVehicles();
  const { trips: activeTrips, refetch: refetchActiveTrips, loading: loadingActiveTrips } = useActiveTrips();
  const { checkout, loading: checkingOut } = useTripCheckout();
  const { checkin, loading: checkingIn } = useTripCheckin();

  // Determine mode: if tripId provided, it's check-in; otherwise checkout
  const [mode, setMode] = useState<'checkout' | 'checkin'>(initialMode || (tripId ? 'checkin' : 'checkout'));
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>(initialVehicleId || '');
  const [selectedTripId, setSelectedTripId] = useState<string>(tripId || '');
  const [vehicleSearchQuery, setVehicleSearchQuery] = useState<string>('');
  const [showVehicleDropdown, setShowVehicleDropdown] = useState(false);
  const vehicleDropdownRef = useRef<HTMLDivElement>(null);

  // Use selectedVehicleId after it's initialized
  const { activeTrip: vehicleActiveTrip, refetch: refetchVehicleStatus, loading: loadingVehicleStatus } = useVehicleStatus(selectedVehicleId || '');

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
  const [successMode, setSuccessMode] = useState<'checkout' | 'checkin' | null>(null); // Track which mode succeeded
  const [tripData, setTripData] = useState<any>(null); // Store full trip data for check-in
  const [userMismatch, setUserMismatch] = useState(false);

  // Detect when vehicle with active trip is selected in checkout mode
  useEffect(() => {
    if (mode === 'checkout' && selectedVehicleId) {
      const activeTrip = activeTrips.find(t => t.vehicle_id === selectedVehicleId);
      if (activeTrip) {
        // Vehicle has active trip - switch to check-in mode
        setMode('checkin');
        setSelectedTripId(activeTrip.id);
        setTripData(activeTrip);
        setFormData({
          odometer: '',
          destination: activeTrip.destination || '',
          route: activeTrip.route || '',
          notes: activeTrip.notes || '',
        });
        
        // Reset success state when switching modes
        setSuccess(false);
        setSuccessMode(null);
        
        // Check user match
        if (user && activeTrip.driver_id && activeTrip.driver_id !== user.id) {
          setUserMismatch(true);
          setError('คุณไม่สามารถบันทึกเลขไมล์กลับได้ เนื่องจากไม่ใช่ผู้ใช้งานคนเดียวกัน');
        } else {
          setUserMismatch(false);
          setError(null);
        }
      } else {
        // No active trip - ensure checkout mode and clear all check-in related data
        setMode('checkout');
        setTripData(null);
        setSelectedTripId('');
        setUserMismatch(false);
        // Reset success state when switching modes
        setSuccess(false);
        setSuccessMode(null);
        // Clear form data when switching back to checkout mode
        setFormData({
          odometer: '',
          destination: '',
          route: '',
          notes: '',
        });
      }
    }
  }, [selectedVehicleId, activeTrips, mode, user]);

  // Load active trip data for check-in
  useEffect(() => {
    if (mode === 'checkin') {
      const loadTrip = async (trip: any) => {
        // Check if current user matches trip driver_id
        if (user && trip.driver_id && trip.driver_id !== user.id) {
          setUserMismatch(true);
          setError('คุณไม่สามารถบันทึกเลขไมล์กลับได้ เนื่องจากไม่ใช่ผู้ใช้งานคนเดียวกัน');
          return;
        } else {
          setUserMismatch(false);
        }

        setTripData(trip);
        setFormData({
          odometer: '',
          destination: trip.destination || '',
          route: trip.route || '',
          notes: trip.notes || '',
        });
        setSelectedVehicleId(trip.vehicle_id);
      };

      if (selectedTripId) {
        // If tripId is provided, load that trip
        tripLogService.getById(selectedTripId).then((trip) => {
          if (trip) {
            loadTrip(trip);
            // Reset success state when loading trip
            setSuccess(false);
            setSuccessMode(null);
          }
        }).catch((err) => {
          console.error('Error loading trip:', err);
          setError('ไม่สามารถโหลดข้อมูลการเดินทางได้');
        });
      } else if (selectedVehicleId && vehicleActiveTrip) {
        // If vehicleId is provided, use the active trip for that vehicle
        setSelectedTripId(vehicleActiveTrip.id);
        loadTrip(vehicleActiveTrip);
        // Reset success state when loading trip
        setSuccess(false);
        setSuccessMode(null);
      } else if (selectedVehicleId && !vehicleActiveTrip && !loadingVehicleStatus) {
        // Vehicle has no active trip
        setError('รถคันนี้ไม่มี trip ที่ยังไม่ check-in');
      } else if (!selectedVehicleId && !selectedTripId) {
        // Try to find active trip from activeTrips
        if (activeTrips.length > 0) {
          const firstActiveTrip = activeTrips[0];
          setSelectedTripId(firstActiveTrip.id);
          setSelectedVehicleId(firstActiveTrip.vehicle_id);
          loadTrip(firstActiveTrip);
          // Reset success state when loading trip
          setSuccess(false);
          setSuccessMode(null);
        }
      }
    }
  }, [mode, selectedTripId, selectedVehicleId, vehicleActiveTrip, activeTrips, loadingVehicleStatus, user]);

  // Validate odometer when it changes
  useEffect(() => {
    if (formData.odometer && selectedVehicleId) {
      const odometerValue = parseInt(formData.odometer);
      if (!isNaN(odometerValue)) {
        // For check-in mode, validate against trip start odometer instead of database
        if (mode === 'checkin' && tripData) {
          const tripStart = tripData.odometer_start;
          const distance = odometerValue - tripStart;

          if (odometerValue <= tripStart) {
            setOdometerValidation({
              valid: false,
              lastOdometer: tripStart,
              warning: `เลขไมล์กลับ (${odometerValue.toLocaleString()}) ต้องมากกว่าเลขไมล์ออก (${tripStart.toLocaleString()})`,
            });
          } else if (distance > 500) {
            setOdometerValidation({
              valid: true,
              lastOdometer: tripStart,
              warning: `ระยะทาง (${distance.toLocaleString()} km) เกิน 500 km กรุณาตรวจสอบ`,
            });
          } else {
            setOdometerValidation({
              valid: true,
              lastOdometer: tripStart,
            });
          }
        } else {
          // For checkout mode, validate against database
          tripLogService.validateOdometer(selectedVehicleId, odometerValue)
            .then((result) => {
              setOdometerValidation(result);
            })
            .catch((err) => {
              console.error('Error validating odometer:', err);
            });
        }
      }
    } else {
      setOdometerValidation(null);
    }
  }, [formData.odometer, selectedVehicleId, mode, tripData]);

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
  const selectedTrip = activeTrips.find(t => t.id === selectedTripId);

  // Filter vehicles based on search query
  const filteredVehicles = vehicles.filter((vehicle) => {
    if (!vehicleSearchQuery) return true;
    const query = vehicleSearchQuery.toLowerCase();
    const plate = vehicle.plate?.toLowerCase() || '';
    const make = vehicle.make?.toLowerCase() || '';
    const model = vehicle.model?.toLowerCase() || '';
    return plate.includes(query) || make.includes(query) || model.includes(query);
  });

  // Use all filtered vehicles - don't hide active ones
  // This allows selecting an active vehicle to switch to check-in mode
  const availableVehicles = filteredVehicles;

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

        setSuccessMode('checkout');
        setSuccess(true);
        
        // Clear form data after successful checkout
        setTimeout(() => {
          setFormData({
            odometer: '',
            destination: '',
            route: '',
            notes: '',
          });
          setSelectedVehicleId('');
          setVehicleSearchQuery('');
          setOdometerValidation(null);
          setShowVehicleDropdown(false);
          setSuccessMode(null);
          
          if (onSave) onSave();
        }, 1500);
      } else {
        // Check-in
        if (!selectedTripId) {
          setError('ไม่พบข้อมูลการเดินทาง');
          setSaving(false);
          return;
        }

        // Validate user matches trip driver_id
        if (user && tripData && tripData.driver_id && tripData.driver_id !== user.id) {
          setError('คุณไม่สามารถบันทึกเลขไมล์กลับได้ เนื่องจากไม่ใช่ผู้ใช้งานคนเดียวกัน');
          setSaving(false);
          return;
        }

        // Validate odometer_end > odometer_start
        const tripStart = tripData?.odometer_start || selectedTrip?.odometer_start;
        if (tripStart && odometerValue <= tripStart) {
          setError(`เลขไมล์กลับ (${odometerValue.toLocaleString()}) ต้องมากกว่าเลขไมล์ออก (${tripStart.toLocaleString()})`);
          setSaving(false);
          return;
        }

        // Validate distance <= 500 km
        if (tripStart && (odometerValue - tripStart) > 500) {
          setError(`ระยะทาง (${(odometerValue - tripStart).toLocaleString()} km) เกิน 500 km กรุณาตรวจสอบ`);
          setSaving(false);
          return;
        }

        // For check-in, only send odometer_end (other fields are read-only)
        await checkin(selectedTripId, {
          odometer_end: odometerValue,
          // Don't update destination, route, notes - keep original values
        });

        setSuccessMode('checkin');
        setSuccess(true);
        
        // Refetch active trips to update the list (remove the completed trip)
        refetchActiveTrips();
        
        // Clear form data after successful check-in
        setTimeout(() => {
          // Clear all form state
          setFormData({
            odometer: '',
            destination: '',
            route: '',
            notes: '',
          });
          setSelectedVehicleId('');
          setSelectedTripId('');
          setVehicleSearchQuery('');
          setTripData(null);
          setOdometerValidation(null);
          setShowVehicleDropdown(false);
          setUserMismatch(false);
          setSuccessMode(null);
          setSuccess(false);
          setError(null);
          // Reset to checkout mode for next entry
          setMode('checkout');
          
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
        title={mode === 'checkout' ? 'บันทึกการออกเดินทาง' : 'บันทึกการกลับ'}
        subtitle="กำลังโหลดข้อมูล..."
        loading={true}
      />
    );
  }

  // Show error if vehicles failed to load
  if (vehiclesError) {
    return (
      <PageLayout
        title={mode === 'checkout' ? 'บันทึกการออกเดินทาง' : 'บันทึกการกลับ'}
        subtitle="เกิดข้อผิดพลาด"
        error={true}
        onRetry={() => window.location.reload()}
      />
    );
  }

  return (
    <PageLayout
      title={mode === 'checkout' ? 'บันทึกการออกเดินทาง' : 'บันทึกการกลับ'}
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
                {successMode === 'checkout' ? 'บันทึกการออกเดินทางสำเร็จ' : successMode === 'checkin' ? 'บันทึกการกลับสำเร็จ' : mode === 'checkout' ? 'บันทึกการออกเดินทางสำเร็จ' : 'บันทึกการกลับสำเร็จ'}
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
                    {/* Search Input - Only show when no vehicle is selected */}
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
                    {showVehicleDropdown && availableVehicles.length > 0 && !selectedVehicleId && (
                      <div className="absolute z-50 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg shadow-lg max-h-60 overflow-auto">
                        {availableVehicles.map((vehicle) => (
                          <button
                            key={vehicle.id}
                            type="button"
                            onClick={() => {
                              setSelectedVehicleId(vehicle.id);
                              setVehicleSearchQuery(''); // Clear search query
                              setShowVehicleDropdown(false);
                              setOdometerValidation(null);
                              setError(null);
                              setTripData(null);
                            }}
                            className={`w-full text-left px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors ${selectedVehicleId === vehicle.id ? 'bg-enterprise-50 dark:bg-enterprise-900/20' : ''
                              }`}
                          >
                            <div className="font-medium text-slate-900 dark:text-white">
                              {vehicle.plate}
                            </div>
                            {vehicle.make && vehicle.model && (
                              <div className="text-sm text-slate-500 dark:text-slate-400">
                                {vehicle.make} {vehicle.model}
                              </div>
                            )}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Show selected vehicle */}
                    {selectedVehicleId && selectedVehicle && (
                      <div className="mt-2 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium text-slate-900 dark:text-white">
                              {selectedVehicle.plate}
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
                    )}

                    {/* Show message if no vehicles found */}
                    {vehicleSearchQuery && availableVehicles.length === 0 && (
                      <div className="mt-2 p-3 text-center text-slate-500 dark:text-slate-400 text-sm">
                        ไม่พบรถที่ค้นหา
                      </div>
                    )}

                    {/* Show message about vehicles with active trips */}
                    {(() => {
                      const activeVehicleCount = vehicles.filter(v => activeTrips.some(t => t.vehicle_id === v.id)).length;
                      if (activeVehicleCount > 0 && !vehicleSearchQuery) {
                        return (
                          <div className="mt-2 p-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded text-sm text-amber-800 dark:text-amber-200">
                            <div className="flex items-center gap-2">
                              <AlertTriangle size={16} />
                              <span>
                                มีรถ {activeVehicleCount} คันที่ออกไปแล้วยังไม่กลับ
                                (พิมพ์เพื่อค้นหาและบันทึกการกลับ)
                              </span>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    })()}
                  </div>
                )}
              </div>
            </div>
          </Card>
        )}

        {/* Active Trip Info - Show when vehicle with active trip is selected */}
        {mode === 'checkin' && tripData && (
          <Card className="p-6 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <Truck size={18} />
                  ข้อมูลการออกเดินทาง
                </h3>
                {userMismatch && (
                  <span className="px-3 py-1 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 rounded-full text-xs font-medium">
                    ไม่ใช่ผู้ใช้งานคนเดียวกัน
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-slate-600 dark:text-slate-400 mb-1">รถ</div>
                  <div className="font-medium text-slate-900 dark:text-white">
                    {tripData.vehicle?.plate || 'N/A'}
                    {tripData.vehicle?.make && tripData.vehicle?.model && (
                      <span className="text-slate-500 dark:text-slate-400 ml-2">
                        ({tripData.vehicle.make} {tripData.vehicle.model})
                      </span>
                    )}
                  </div>
                </div>

                <div>
                  <div className="text-slate-600 dark:text-slate-400 mb-1">ผู้ขับ</div>
                  <div className="font-medium text-slate-900 dark:text-white">
                    {tripData.driver?.full_name || 'N/A'}
                  </div>
                </div>

                <div>
                  <div className="text-slate-600 dark:text-slate-400 mb-1 flex items-center gap-1">
                    <Gauge size={14} />
                    เลขไมล์ออก
                  </div>
                  <div className="font-medium text-slate-900 dark:text-white text-lg">
                    {(tripData.odometer_start || 0).toLocaleString()} km
                  </div>
                </div>

                <div>
                  <div className="text-slate-600 dark:text-slate-400 mb-1 flex items-center gap-1">
                    <Clock size={14} />
                    ออกเมื่อ
                  </div>
                  <div className="font-medium text-slate-900 dark:text-white">
                    {new Date(tripData.checkout_time || new Date()).toLocaleString('th-TH')}
                  </div>
                </div>

                {tripData.destination && (
                  <div className="md:col-span-2">
                    <div className="text-slate-600 dark:text-slate-400 mb-1 flex items-center gap-1">
                      <MapPin size={14} />
                      ปลายทาง
                    </div>
                    <div className="font-medium text-slate-900 dark:text-white">
                      {tripData.destination}
                    </div>
                  </div>
                )}

                {tripData.route && (
                  <div className="md:col-span-2">
                    <div className="text-slate-600 dark:text-slate-400 mb-1 flex items-center gap-1">
                      <Route size={14} />
                      เส้นทาง
                    </div>
                    <div className="font-medium text-slate-900 dark:text-white">
                      {tripData.route}
                    </div>
                  </div>
                )}

                {tripData.notes && (
                  <div className="md:col-span-2">
                    <div className="text-slate-600 dark:text-slate-400 mb-1 flex items-center gap-1">
                      <FileText size={14} />
                      หมายเหตุ
                    </div>
                    <div className="font-medium text-slate-900 dark:text-white">
                      {tripData.notes}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </Card>
        )}

        {/* Show error if no trip data but in checkin mode */}
        {mode === 'checkin' && !tripData && !loadingVehicleStatus && selectedVehicleId && (
          <Card className="p-6 bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800">
            <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
              <AlertTriangle size={20} />
              <span>ไม่พบข้อมูลการเดินทางที่ยังไม่ check-in สำหรับรถคันนี้</span>
            </div>
          </Card>
        )}

        {/* Show error if user mismatch */}
        {mode === 'checkin' && userMismatch && tripData && (
          <Card className="p-6 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800">
            <div className="flex items-center gap-2 text-red-800 dark:text-red-200">
              <AlertCircle size={20} />
              <span>คุณไม่สามารถบันทึกเลขไมล์กลับได้ เนื่องจากไม่ใช่ผู้ใช้งานคนเดียวกัน</span>
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
                  mode === 'checkin' && tripData
                    ? `เลขไมล์ออก: ${tripData.odometer_start.toLocaleString()} km`
                    : odometerValidation?.lastOdometer
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
            {mode === 'checkin' && tripData && formData.odometer && (
              <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                <div className="text-sm text-slate-600 dark:text-slate-400">
                  <div className="font-medium mb-1">ระยะทางที่วิ่ง:</div>
                  <div className="text-lg font-semibold text-slate-900 dark:text-white">
                    {(() => {
                      const odometerValue = parseInt(formData.odometer);
                      const tripStart = tripData.odometer_start;
                      if (!isNaN(odometerValue) && tripStart && odometerValue > tripStart) {
                        const distance = odometerValue - tripStart;
                        return `${distance.toLocaleString()} km`;
                      }
                      return 'N/A';
                    })()}
                  </div>
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* Optional Fields - Only show for checkout, hide for check-in */}
        {mode === 'checkout' && (
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
        )}

        {/* Submit Button */}
        <div className="flex gap-4">
          <Button
            type="submit"
            disabled={saving || checkingOut || checkingIn || userMismatch}
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
                {mode === 'checkout' ? 'บันทึกการออกเดินทาง' : 'บันทึกการกลับ'}
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

