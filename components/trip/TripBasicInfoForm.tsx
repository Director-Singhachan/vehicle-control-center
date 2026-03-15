// TripBasicInfoForm — วันที่, รถ, คนขับ, ไมล์, หมายเหตุ, จุดหมายปลายทาง (จาก useDeliveryTripForm)
import React from 'react';
import { createPortal } from 'react-dom';
import { Truck, Search, MapPin } from 'lucide-react';
import { Input } from '../ui/Input';
import { Card } from '../ui/Card';
import type { RefObject } from 'react';

export interface TripBasicInfoFormData {
  vehicle_id: string;
  driver_id: string;
  planned_date: string;
  odometer_start: string;
  notes: string;
  trip_revenue?: string;
  trip_start_date?: string;
  trip_end_date?: string;
}

export interface DriverOption {
  id: string;
  full_name: string;
}

export interface VehicleOption {
  id: string;
  plate?: string | null;
  make?: string | null;
  model?: string | null;
}

export interface TripBasicInfoFormProps {
  formData: TripBasicInfoFormData;
  setFormData: React.Dispatch<React.SetStateAction<TripBasicInfoFormData>>;
  vehicleSearch: string;
  setVehicleSearch: (value: string) => void;
  showVehicleDropdown: boolean;
  setShowVehicleDropdown: (value: boolean) => void;
  vehicleInputRef: RefObject<HTMLDivElement | null>;
  vehicleDropdownPosition: { top: number; left: number; width: number } | null;
  setVehicleDropdownPosition: (value: { top: number; left: number; width: number } | null) => void;
  filteredVehicles: VehicleOption[];
  activeVehicleIds: Set<string>;
  vehiclesWithActiveTickets: Set<string>;
  vehiclesWithActiveDeliveryTrips: Set<string>;
  onSelectVehicle: (vehicleId: string, e?: React.MouseEvent) => void;
  drivers: DriverOption[];
  latestOdometer: number | null;
  /** แสดงบล็อกจุดหมายปลายทางเมื่อมีรถและมีร้านที่เลือก */
  showDestinations?: boolean;
  destinationsText?: string;
}

export const TripBasicInfoForm: React.FC<TripBasicInfoFormProps> = ({
  formData,
  setFormData,
  vehicleSearch,
  setVehicleSearch,
  showVehicleDropdown,
  setShowVehicleDropdown,
  vehicleInputRef,
  vehicleDropdownPosition,
  filteredVehicles,
  activeVehicleIds,
  vehiclesWithActiveTickets,
  vehiclesWithActiveDeliveryTrips,
  onSelectVehicle,
  drivers,
  latestOdometer,
  showDestinations = false,
  destinationsText = '',
}) => {
  return (
    <Card>
      <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
        <Truck size={20} />
        ข้อมูลพื้นฐาน
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="relative z-10">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            รถ <span className="text-red-500">*</span>
          </label>
          <div className="relative" data-vehicle-dropdown ref={vehicleInputRef}>
            <Input
              type="text"
              value={vehicleSearch}
              onChange={(e) => {
                setVehicleSearch(e.target.value);
                setShowVehicleDropdown(true);
              }}
              onFocus={() => {
                if (!formData.vehicle_id) {
                  setVehicleSearch('');
                }
                setShowVehicleDropdown(true);
              }}
              placeholder="พิมพ์ค้นหาหรือเลือกรถ"
              icon={<Search size={18} />}
              data-vehicle-input
              required={!formData.vehicle_id}
            />
            {showVehicleDropdown && filteredVehicles.length > 0 && vehicleDropdownPosition && createPortal(
              <div
                data-vehicle-dropdown-portal
                className="fixed bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg shadow-xl z-[9999] max-h-60 overflow-y-auto overscroll-contain"
                style={{
                  top: `${vehicleDropdownPosition.top}px`,
                  left: `${vehicleDropdownPosition.left}px`,
                  width: `${vehicleDropdownPosition.width}px`,
                }}
                onMouseDown={(e) => e.stopPropagation()}
              >
                {filteredVehicles.map((vehicle) => {
                  const isInUse = activeVehicleIds.has(vehicle.id);
                  const hasActiveTicket = vehiclesWithActiveTickets.has(vehicle.id);
                  const hasActiveDeliveryTrip = vehiclesWithActiveDeliveryTrips.has(vehicle.id);
                  const statuses: string[] = [];
                  if (isInUse) statuses.push('🚗 ใช้งานอยู่');
                  if (hasActiveTicket) statuses.push('🔧 ซ่อมอยู่');
                  if (hasActiveDeliveryTrip) statuses.push('📦 จัดส่งอยู่');

                  return (
                    <button
                      key={vehicle.id}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        onSelectVehicle(vehicle.id, e);
                      }}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                      className="w-full text-left px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-700"
                    >
                      <div className="font-medium text-slate-900 dark:text-slate-100">
                        {vehicle.plate} {vehicle.make && vehicle.model ? `(${vehicle.make} ${vehicle.model})` : ''}
                      </div>
                      {statuses.length > 0 && (
                        <div className="text-xs mt-0.5 space-y-0.5">
                          {statuses.map((status, idx) => (
                            <div
                              key={idx}
                              className={
                                status.includes('ใช้งานอยู่')
                                  ? 'text-amber-600 dark:text-amber-400'
                                  : status.includes('ซ่อมอยู่')
                                    ? 'text-red-600 dark:text-red-400'
                                    : 'text-blue-600 dark:text-blue-400'
                              }
                            >
                              {status}
                            </div>
                          ))}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>,
              document.body
            )}
            {formData.vehicle_id && (
              <div className="mt-1 space-y-1">
                {activeVehicleIds.has(formData.vehicle_id) && (
                  <div className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                    <span>⚠️</span>
                    <span>รถคันนี้กำลังใช้งานอยู่</span>
                  </div>
                )}
                {vehiclesWithActiveTickets.has(formData.vehicle_id) && (
                  <div className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
                    <span>⚠️</span>
                    <span>รถคันนี้กำลังซ่อมอยู่</span>
                  </div>
                )}
                {vehiclesWithActiveDeliveryTrips.has(formData.vehicle_id) && (
                  <div className="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1">
                    <span>⚠️</span>
                    <span>รถคันนี้มีทริปจัดส่งอยู่</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            วันที่วางแผน <span className="text-red-500">*</span>
          </label>
          <Input
            type="date"
            value={formData.planned_date}
            onChange={(e) => setFormData(prev => ({ ...prev, planned_date: e.target.value }))}
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            คนขับ <span className="text-red-500">*</span>
          </label>
          <select
            value={formData.driver_id}
            onChange={(e) => setFormData(prev => ({ ...prev, driver_id: e.target.value }))}
            className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
            required
          >
            <option value="">เลือกคนขับ</option>
            {drivers.map((driver) => (
              <option key={driver.id} value={driver.id}>
                {driver.full_name}
              </option>
            ))}
          </select>
        </div>

        <div>{/* placeholder for grid alignment */}</div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            ไมล์เริ่มต้น
          </label>
          <div className="relative">
            <Input
              type="number"
              value={formData.odometer_start}
              onChange={(e) => setFormData(prev => ({ ...prev, odometer_start: e.target.value }))}
              placeholder="กรอกเลขไมล์ขาออก"
              min={0}
              step={1}
            />
            {latestOdometer !== null && (
              <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                เลขไมล์ล่าสุด: <span className="font-medium">{latestOdometer.toLocaleString()}</span> กม.
                {formData.odometer_start && parseInt(formData.odometer_start, 10) < latestOdometer && (
                  <span className="ml-2 text-amber-600 dark:text-amber-400">
                    ⚠️ น้อยกว่าเลขไมล์ล่าสุด
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            หมายเหตุ
          </label>
          <Input
            value={formData.notes}
            onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
            placeholder="หมายเหตุเพิ่มเติม"
          />
        </div>

        {/* รายได้เที่ยว — สำหรับ P&L (กำไรจากสินค้าในเที่ยว / ค่าจ้างส่ง) */}
        <div className="md:col-span-2 border-t border-slate-200 dark:border-slate-700 pt-4 mt-2">
          <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">รายได้และวันเที่ยว (ใช้คำนวณ P&L)</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">รายได้เที่ยว (บาท)</label>
              <Input
                type="number"
                value={formData.trip_revenue ?? ''}
                onChange={(e) => setFormData(prev => ({ ...prev, trip_revenue: e.target.value }))}
                placeholder="กำไรจากสินค้า / ค่าจ้างส่ง"
                min={0}
                step={0.01}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">วันเริ่มเที่ยว</label>
              <Input
                type="date"
                value={formData.trip_start_date ?? ''}
                onChange={(e) => setFormData(prev => ({ ...prev, trip_start_date: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">วันสิ้นสุดเที่ยว</label>
              <Input
                type="date"
                value={formData.trip_end_date ?? ''}
                onChange={(e) => setFormData(prev => ({ ...prev, trip_end_date: e.target.value }))}
              />
            </div>
          </div>
        </div>
      </div>

      {showDestinations && (
        <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <div className="flex items-center gap-2 text-blue-800 dark:text-blue-200">
            <MapPin size={16} />
            <span className="font-medium">จุดหมายปลายทาง:</span>
          </div>
          <p className="mt-1 text-sm text-blue-700 dark:text-blue-300">
            {destinationsText || 'ยังไม่ได้เลือกร้านค้า'}
          </p>
        </div>
      )}
    </Card>
  );
};
