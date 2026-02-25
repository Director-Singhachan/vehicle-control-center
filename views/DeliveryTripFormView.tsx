// Delivery Trip Form View - Create/Edit delivery trip
import React from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowLeft,
  Save,
  Plus,
  X,
  Trash2,
  Search,
  MapPin,
  Package,
  Truck,
  User,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  AlertCircle,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card } from '../components/ui/Card';
import { PalletConfigSelector } from '../components/trip/PalletConfigSelector';
import { PageLayout } from '../components/layout/PageLayout';
import { useDeliveryTripForm } from '../hooks/useDeliveryTripForm';

interface DeliveryTripFormViewProps {
  tripId?: string;
  onSave?: () => void;
  onCancel?: () => void;
}

export const DeliveryTripFormView: React.FC<DeliveryTripFormViewProps> = ({
  tripId,
  onSave,
  onCancel,
}) => {
  const {
    isEdit,
    trip,
    loadingTrip,
    vehicles,
    formData,
    setFormData,
    storeSearch,
    setStoreSearch,
    showStoreDropdown,
    setShowStoreDropdown,
    getStoreInfo,
    productSearch,
    setProductSearch,
    productSearchDebounced,
    loadingProducts,
    getProductInfo,
    cacheProduct,
    getFilteredProducts,
    drivers,
    loadingDrivers,
    vehicleSearch,
    setVehicleSearch,
    showVehicleDropdown,
    setShowVehicleDropdown,
    vehicleInputRef,
    vehicleDropdownPosition,
    setVehicleDropdownPosition,
    filteredVehicles,
    activeVehicleIds,
    vehiclesWithActiveTickets,
    vehiclesWithActiveDeliveryTrips,
    saving,
    error,
    setError,
    success,
    latestOdometer,
    expandedStoreIndex,
    setExpandedStoreIndex,
    productQuantityInput,
    setProductQuantityInput,
    selectedStores,
    setSelectedStores,
    storeInputRef,
    filteredStores,
    handleSelectVehicle,
    handleAddStore,
    handleRemoveStore,
    handleAddProduct,
    handleRemoveProduct,
    handleUpdateQuantity,
    aggregatedProducts,
    destinations,
    handleSubmit,
    handleFormKeyDown,
    availableStaff,
    selectedHelpers,
    setSelectedHelpers,
    helperSearch,
    setHelperSearch,
    showHelperDropdown,
    setShowHelperDropdown,
    helperInputRef,
    helperDropdownPosition,
    setHelperDropdownPosition,
    selectedDriverStaffId,
    setSelectedDriverStaffId,
    driverStaffSearch,
    setDriverStaffSearch,
    showDriverStaffDropdown,
    setShowDriverStaffDropdown,
    driverStaffInputRef,
    driverStaffDropdownPosition,
    setDriverStaffDropdownPosition,
    editReason,
    setEditReason,
    capacitySummary,
    palletPackingResult,
  } = useDeliveryTripForm({ tripId, onSave, onCancel });

  if (loadingTrip) {
    return (
      <PageLayout title={isEdit ? 'แก้ไขทริปส่งสินค้า' : 'สร้างทริปส่งสินค้า'} loading={true} />
    );
  }

  return (
    <PageLayout
      title={isEdit ? 'แก้ไขทริปส่งสินค้า' : 'สร้างทริปส่งสินค้า'}
      subtitle={isEdit ? 'แก้ไขข้อมูลทริปส่งสินค้า' : 'สร้างทริปส่งสินค้าใหม่'}
    >
      <form onSubmit={handleSubmit} onKeyDown={handleFormKeyDown} className="space-y-6">
        {/* Basic Info */}
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
                    onMouseDown={(e) => {
                      // Allow scrolling by not preventing default
                      e.stopPropagation();
                    }}
                  >
                    {filteredVehicles.map((vehicle) => {
                      const isInUse = activeVehicleIds.has(vehicle.id); // In use (trip logs)
                      const hasActiveTicket = vehiclesWithActiveTickets.has(vehicle.id); // Has active maintenance ticket
                      const hasActiveDeliveryTrip = vehiclesWithActiveDeliveryTrips.has(vehicle.id); // Has active delivery trip

                      // Collect all statuses
                      const statuses: string[] = [];
                      if (isInUse) {
                        statuses.push('🚗 ใช้งานอยู่');
                      }
                      if (hasActiveTicket) {
                        statuses.push('🔧 ซ่อมอยู่');
                      }
                      if (hasActiveDeliveryTrip) {
                        statuses.push('📦 จัดส่งอยู่');
                      }

                      return (
                        <button
                          key={vehicle.id}
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault(); // Prevent input from losing focus
                            handleSelectVehicle(vehicle.id, e);
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
                onChange={(e) => setFormData({ ...formData, planned_date: e.target.value })}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                คนขับ <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.driver_id}
                onChange={(e) => setFormData({ ...formData, driver_id: e.target.value })}
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

            <div>
              {/* placeholder for grid alignment */}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                ไมล์เริ่มต้น
              </label>
              <div className="relative">
                <Input
                  type="number"
                  value={formData.odometer_start}
                  onChange={(e) => setFormData({ ...formData, odometer_start: e.target.value })}
                  placeholder="กรอกเลขไมล์ขาออก"
                  min="0"
                  step="1"
                />
                {latestOdometer !== null && (
                  <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    เลขไมล์ล่าสุด: <span className="font-medium">{latestOdometer.toLocaleString()}</span> กม.
                    {formData.odometer_start && parseInt(formData.odometer_start) < latestOdometer && (
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
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="หมายเหตุเพิ่มเติม"
              />
            </div>
          </div>

          {/* Auto-populated destinations */}
          {formData.vehicle_id && selectedStores.length > 0 && (
            <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <div className="flex items-center gap-2 text-blue-800 dark:text-blue-200">
                <MapPin size={16} />
                <span className="font-medium">จุดหมายปลายทาง:</span>
              </div>
              <p className="mt-1 text-sm text-blue-700 dark:text-blue-300">
                {destinations || 'ยังไม่ได้เลือกร้านค้า'}
              </p>
            </div>
          )}
        </Card>

        {/* Crew Assignment Section */}
        <Card>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
            <User size={20} />
            จัดพนักงานประจำทริป
            <span className="text-sm font-normal text-slate-500 dark:text-slate-400">(สำคัญ - มีผลต่อค่าคอมมิชชั่น)</span>
          </h3>

          {(!selectedDriverStaffId && selectedHelpers.length === 0) && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-2">
              <AlertCircle className="text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" size={20} />
              <div>
                <p className="text-sm font-medium text-red-800 dark:text-red-200">ยังไม่ได้จัดพนักงาน</p>
                <p className="text-xs text-red-600 dark:text-red-300 mt-1">กรุณาเลือกคนขับและพนักงานบริการเพื่อให้ระบบคำนวณค่าคอมมิชชั่นได้ถูกต้อง</p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Driver Staff Selection */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                คนขับ (เลือกได้ 1 คน) <span className="text-red-500">*</span>
              </label>
              <div className="relative" ref={driverStaffInputRef} data-driver-staff-dropdown>
                <Input
                  type="text"
                  value={driverStaffSearch}
                  onChange={(e) => {
                    setDriverStaffSearch(e.target.value);
                    setShowDriverStaffDropdown(true);
                    if (!e.target.value) {
                      setSelectedDriverStaffId('');
                    }
                    if (driverStaffInputRef.current) {
                      const rect = driverStaffInputRef.current.getBoundingClientRect();
                      setDriverStaffDropdownPosition({
                        top: rect.bottom + window.scrollY + 4,
                        left: rect.left + window.scrollX,
                        width: rect.width,
                      });
                    }
                  }}
                  onFocus={() => {
                    setShowDriverStaffDropdown(true);
                    if (driverStaffInputRef.current) {
                      const rect = driverStaffInputRef.current.getBoundingClientRect();
                      setDriverStaffDropdownPosition({
                        top: rect.bottom + window.scrollY + 4,
                        left: rect.left + window.scrollX,
                        width: rect.width,
                      });
                    }
                  }}
                  placeholder="ค้นหาคนขับ..."
                  icon={<Search size={18} />}
                  data-driver-staff-input
                />
                {selectedDriverStaffId && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedDriverStaffId('');
                      setDriverStaffSearch('');
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                  >
                    <X size={16} />
                  </button>
                )}
                {showDriverStaffDropdown && driverStaffDropdownPosition && createPortal(
                  <div
                    data-driver-staff-dropdown-portal
                    className="fixed bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg shadow-xl z-[9999] max-h-60 overflow-y-auto overscroll-contain"
                    style={{
                      top: `${driverStaffDropdownPosition.top}px`,
                      left: `${driverStaffDropdownPosition.left}px`,
                      width: `${driverStaffDropdownPosition.width}px`,
                    }}
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    {availableStaff
                      .filter(s => !selectedHelpers.includes(s.id))
                      .filter(s => {
                        const search = driverStaffSearch.toLowerCase();
                        return s.name.toLowerCase().includes(search) ||
                          (s.employee_code || '').toLowerCase().includes(search);
                      })
                      .map(staff => (
                        <button
                          key={staff.id}
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setSelectedDriverStaffId(staff.id);
                            setDriverStaffSearch(`${staff.name}${staff.employee_code ? ` (${staff.employee_code})` : ''}`);
                            setShowDriverStaffDropdown(false);
                            setDriverStaffDropdownPosition(null);
                          }}
                          className={`w-full text-left px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 text-sm ${selectedDriverStaffId === staff.id ? 'bg-blue-50 dark:bg-blue-900/30' : ''
                            }`}
                        >
                          <div className="font-medium text-slate-900 dark:text-slate-100">{staff.name}</div>
                          {staff.employee_code && (
                            <div className="text-xs text-slate-500 dark:text-slate-400">{staff.employee_code}</div>
                          )}
                        </button>
                      ))}
                    {availableStaff
                      .filter(s => !selectedHelpers.includes(s.id))
                      .filter(s => s.name.toLowerCase().includes(driverStaffSearch.toLowerCase()) ||
                        (s.employee_code || '').toLowerCase().includes(driverStaffSearch.toLowerCase())).length === 0 && (
                        <div className="px-4 py-2 text-sm text-slate-500 dark:text-slate-400 text-center">
                          ไม่พบพนักงาน
                        </div>
                      )}
                  </div>,
                  document.body
                )}
              </div>
              {selectedDriverStaffId && (
                <div className="mt-2 p-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                  <div className="flex items-center gap-2 text-sm text-green-800 dark:text-green-200">
                    <CheckCircle size={14} />
                    <span className="font-medium">
                      {availableStaff.find(s => s.id === selectedDriverStaffId)?.name || 'เลือกแล้ว'}
                    </span>
                    <span className="px-2 py-0.5 bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 text-xs rounded-full">คนขับ</span>
                  </div>
                </div>
              )}
            </div>

            {/* Helper Selection */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                พนักงานบริการ (เลือกได้หลายคน)
              </label>
              <div className="relative" ref={helperInputRef} data-helper-dropdown>
                <div className="flex flex-wrap gap-2 p-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 min-h-[42px]">
                  {selectedHelpers.map(helperId => {
                    const helper = availableStaff.find(s => s.id === helperId);
                    return (
                      <span key={helperId} className="inline-flex items-center px-2 py-1 rounded-md text-sm font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                        {helper?.name || 'Unknown'}
                        <button
                          type="button"
                          onClick={() => setSelectedHelpers(prev => prev.filter(id => id !== helperId))}
                          className="ml-1 hover:text-blue-900 dark:hover:text-blue-100"
                        >
                          <X size={14} />
                        </button>
                      </span>
                    );
                  })}
                  <input
                    type="text"
                    value={helperSearch}
                    onChange={(e) => {
                      setHelperSearch(e.target.value);
                      setShowHelperDropdown(true);
                      if (helperInputRef.current) {
                        const rect = helperInputRef.current.getBoundingClientRect();
                        setHelperDropdownPosition({
                          top: rect.bottom + window.scrollY + 4,
                          left: rect.left + window.scrollX,
                          width: rect.width,
                        });
                      }
                    }}
                    onFocus={() => {
                      setShowHelperDropdown(true);
                      if (helperInputRef.current) {
                        const rect = helperInputRef.current.getBoundingClientRect();
                        setHelperDropdownPosition({
                          top: rect.bottom + window.scrollY + 4,
                          left: rect.left + window.scrollX,
                          width: rect.width,
                        });
                      }
                    }}
                    placeholder={selectedHelpers.length === 0 ? "ค้นหาพนักงานบริการ..." : "เพิ่มอีก..."}
                    className="flex-1 min-w-[120px] outline-none bg-transparent text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400"
                    data-helper-input
                  />
                </div>

                {showHelperDropdown && helperDropdownPosition && createPortal(
                  <div
                    data-helper-dropdown-portal
                    className="fixed bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg shadow-xl z-[9999] max-h-60 overflow-y-auto overscroll-contain"
                    style={{
                      top: `${helperDropdownPosition.top}px`,
                      left: `${helperDropdownPosition.left}px`,
                      width: `${helperDropdownPosition.width}px`,
                    }}
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    {availableStaff
                      .filter(s => !selectedHelpers.includes(s.id) && s.id !== selectedDriverStaffId)
                      .filter(s => s.name.toLowerCase().includes(helperSearch.toLowerCase()) ||
                        (s.employee_code || '').toLowerCase().includes(helperSearch.toLowerCase()))
                      .map(staff => (
                        <button
                          key={staff.id}
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setSelectedHelpers(prev => [...prev, staff.id]);
                            setHelperSearch('');
                            setTimeout(() => {
                              if (helperInputRef.current) {
                                const rect = helperInputRef.current.getBoundingClientRect();
                                setHelperDropdownPosition({
                                  top: rect.bottom + window.scrollY + 4,
                                  left: rect.left + window.scrollX,
                                  width: rect.width,
                                });
                              }
                            }, 0);
                          }}
                          className="w-full text-left px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 text-sm text-slate-900 dark:text-slate-100"
                        >
                          <div>{staff.name}</div>
                          {staff.employee_code && (
                            <div className="text-xs text-slate-500 dark:text-slate-400">{staff.employee_code}</div>
                          )}
                        </button>
                      ))}
                    {availableStaff
                      .filter(s => !selectedHelpers.includes(s.id) && s.id !== selectedDriverStaffId)
                      .filter(s => s.name.toLowerCase().includes(helperSearch.toLowerCase()) ||
                        (s.employee_code || '').toLowerCase().includes(helperSearch.toLowerCase())).length === 0 && (
                        <div className="px-4 py-2 text-sm text-slate-500 dark:text-slate-400 text-center">
                          ไม่พบพนักงาน
                        </div>
                      )}
                  </div>,
                  document.body
                )}
              </div>
            </div>
          </div>

          {/* Crew Summary */}
          {(selectedDriverStaffId || selectedHelpers.length > 0) && (
            <div className="mt-4 p-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg">
              <div className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                สรุปพนักงานในทริป ({(selectedDriverStaffId ? 1 : 0) + selectedHelpers.length} คน)
              </div>
              <div className="flex flex-wrap gap-2">
                {selectedDriverStaffId && (
                  <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200 border border-blue-200 dark:border-blue-800">
                    <Truck size={14} />
                    {availableStaff.find(s => s.id === selectedDriverStaffId)?.name || 'คนขับ'}
                    <span className="text-xs font-medium ml-1">(คนขับ)</span>
                  </span>
                )}
                {selectedHelpers.map(helperId => {
                  const helper = availableStaff.find(s => s.id === helperId);
                  return (
                    <span key={helperId} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200 border border-green-200 dark:border-green-800">
                      <User size={14} />
                      {helper?.name || 'Unknown'}
                      <span className="text-xs font-medium ml-1">(บริการ)</span>
                    </span>
                  );
                })}
              </div>
            </div>
          )}
        </Card>

        {/* Capacity Summary */}
        {formData.vehicle_id && selectedStores.length > 0 && (() => {
          // Check if there are any items in any store
          const hasItems = selectedStores.some(store => store.items.length > 0);

          return (
            <Card>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
                <Package size={20} />
                สรุปความจุ
              </h3>
              {!hasItems ? (
                <div className="text-center py-4 text-slate-500 dark:text-slate-400">
                  <p>กรุณาเพิ่มสินค้าในร้านค้าก่อน</p>
                  <p className="text-xs mt-2">ระบบจะคำนวณความจุอัตโนมัติเมื่อมีการเพิ่มสินค้า</p>
                </div>
              ) : capacitySummary?.loading ? (
                <div className="text-center py-4 text-slate-500 dark:text-slate-400">
                  กำลังคำนวณ...
                </div>
              ) : capacitySummary ? (
                <div className="space-y-3">
                  {capacitySummary.errors.length > 0 && (
                    <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                      <div className="flex items-center gap-2 text-red-800 dark:text-red-200 mb-2">
                        <AlertCircle size={16} />
                        <span className="font-medium">ข้อผิดพลาด:</span>
                      </div>
                      <ul className="list-disc list-inside text-sm text-red-700 dark:text-red-300 space-y-1">
                        {capacitySummary.errors.map((error, idx) => (
                          <li key={idx}>{error}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {capacitySummary.warnings.length > 0 && (
                    <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                      <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200 mb-2">
                        <AlertCircle size={16} />
                        <span className="font-medium">คำเตือน:</span>
                      </div>
                      <ul className="list-disc list-inside text-sm text-amber-700 dark:text-amber-300 space-y-1">
                        {capacitySummary.warnings.map((warning, idx) => (
                          <li key={idx}>{warning}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                      <div className="text-sm text-slate-600 dark:text-slate-400 mb-1">
                        จำนวนพาเลท
                        {palletPackingResult ? (
                          <span className="block text-xs text-green-600 dark:text-green-400 font-normal mt-0.5">
                            (คำนวณแบบ bin-packing จัดรวมหลายชนิดบนพาเลทเดียวกัน)
                          </span>
                        ) : (
                          <span className="block text-xs text-slate-500 dark:text-slate-500 font-normal mt-0.5">
                            (ค่าประมาณแยกตามชนิดสินค้า การจัดเรียงจริงอาจใช้น้อยกว่าถ้ารวมพาเลทได้)
                          </span>
                        )}
                      </div>
                      {(() => {
                        const displayPallets = palletPackingResult?.totalPallets ?? capacitySummary.totalPallets;
                        const maxPallets = capacitySummary.vehicleMaxPallets;
                        return (
                          <>
                            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                              {displayPallets}
                              {maxPallets !== null && (
                                <span className="text-lg font-normal text-slate-500 dark:text-slate-400">
                                  {' '}/ {maxPallets}
                                </span>
                              )}
                            </div>
                            {maxPallets !== null && (
                              <div className="mt-2">
                                <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                                  <div
                                    className={`h-2 rounded-full ${displayPallets > maxPallets
                                      ? 'bg-red-500'
                                      : displayPallets > maxPallets * 0.9
                                        ? 'bg-amber-500'
                                        : 'bg-green-500'
                                      }`}
                                    style={{
                                      width: `${Math.min(
                                        100,
                                        (displayPallets / maxPallets) * 100
                                      )}%`,
                                    }}
                                  />
                                </div>
                                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                  {Math.round(
                                    (displayPallets / maxPallets) * 100
                                  )}
                                  % ของความจุ
                                </div>
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </div>
                    <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                      <div className="text-sm text-slate-600 dark:text-slate-400 mb-1">
                        น้ำหนักรวม
                      </div>
                      <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                        {capacitySummary.totalWeightKg.toFixed(2)} กก.
                        {capacitySummary.vehicleMaxWeightKg !== null && (
                          <span className="text-lg font-normal text-slate-500 dark:text-slate-400">
                            {' '}/ {capacitySummary.vehicleMaxWeightKg} กก.
                          </span>
                        )}
                      </div>
                      {capacitySummary.vehicleMaxWeightKg !== null && (
                        <div className="mt-2">
                          <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full ${capacitySummary.totalWeightKg > capacitySummary.vehicleMaxWeightKg
                                ? 'bg-red-500'
                                : capacitySummary.totalWeightKg > capacitySummary.vehicleMaxWeightKg * 0.9
                                  ? 'bg-amber-500'
                                  : 'bg-green-500'
                                }`}
                              style={{
                                width: `${Math.min(
                                  100,
                                  (capacitySummary.totalWeightKg / capacitySummary.vehicleMaxWeightKg) * 100
                                )}%`,
                              }}
                            />
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                            {Math.round(
                              (capacitySummary.totalWeightKg / capacitySummary.vehicleMaxWeightKg) * 100
                            )}
                            % ของความจุ
                          </div>
                        </div>
                      )}
                    </div>
                    {/* ตัดการแสดงความสูงรวมออก (ยังคำนวณภายในแต่ไม่แสดง) */}
                  </div>
                </div>
              ) : (
                <div className="text-sm text-slate-500 dark:text-slate-400">
                  กำลังคำนวณความจุ...
                </div>
              )}
            </Card>
          );
        })()}

        {/* Stores and Products */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Package size={20} />
              ร้านค้าและสินค้า
            </h3>
            <div className="relative z-10" data-store-dropdown ref={storeInputRef}>
              <div className="flex items-center gap-2">
                <Input
                  type="text"
                  placeholder="ค้นหาร้านค้า..."
                  value={storeSearch}
                  onChange={(e) => {
                    setStoreSearch(e.target.value);
                    setShowStoreDropdown(true);
                  }}
                  onFocus={() => setShowStoreDropdown(true)}
                  icon={<Search size={18} />}
                  className="w-64"
                  data-store-input
                />
                {showStoreDropdown && (
                  <div
                    data-store-dropdown-portal
                    className="absolute top-full left-0 mt-1 w-64 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg shadow-xl z-[9999] max-h-60 overflow-y-auto overscroll-contain"
                    onMouseDown={(e) => {
                      // Allow scrolling by not preventing default
                      e.stopPropagation();
                    }}
                  >
                    {(() => {
                      const availableStores = filteredStores.filter(store => !selectedStores.find(s => s.store_id === store.id));
                      const totalMatches = filteredStores.length;

                      return availableStores.length > 0 ? (
                        <>
                          {totalMatches > 100 && (
                            <div className="px-4 py-2 text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
                              แสดง {availableStores.length} จาก {totalMatches} รายการที่พบ (แสดงสูงสุด 100 รายการ)
                            </div>
                          )}
                          {availableStores.map((store) => (
                            <button
                              key={store.id}
                              type="button"
                              onMouseDown={(e) => {
                                // Use onMouseDown to prevent dropdown from closing before click
                                e.preventDefault();
                                e.stopPropagation();
                                handleAddStore(store.id);
                              }}
                              className="w-full text-left px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-700"
                            >
                              <div className="font-medium text-slate-900 dark:text-slate-100">
                                {store.customer_code} - {store.customer_name}
                              </div>
                            </button>
                          ))}
                        </>
                      ) : (
                        <div className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400 text-center">
                          {storeSearch ? (totalMatches > 0 ? 'ร้านค้านี้ถูกเลือกไปแล้ว' : 'ไม่พบร้านค้าที่ค้นหา') : 'พิมพ์เพื่อค้นหาร้านค้า'}
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Selected Stores */}
          <div className="space-y-4">
            {selectedStores.map((storeWithItems, storeIndex) => {
              // Use getStoreInfo to get store from cache if stores array is empty
              const store = getStoreInfo(storeWithItems.store_id);
              if (!store) {
                // Store not found - show placeholder or loading
                return (
                  <div
                    key={storeWithItems.store_id}
                    className="border border-slate-200 dark:border-slate-700 rounded-lg p-4"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-semibold">
                          {storeWithItems.sequence_order}
                        </span>
                        <div className="text-slate-500 dark:text-slate-400">
                          กำลังโหลดข้อมูลร้านค้า... (ID: {storeWithItems.store_id.substring(0, 8)}...)
                        </div>
                      </div>
                    </div>
                    <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                      <div className="text-sm text-slate-600 dark:text-slate-400 mb-1">
                        ความสูงกองสูงสุด
                      </div>
                      <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                        {capacitySummary?.totalHeightCm?.toFixed(1) || '0.0'} ซม.
                        {capacitySummary && capacitySummary.vehicleMaxHeightCm !== null && (
                          <span className="text-lg font-normal text-slate-500 dark:text-slate-400">
                            {' '}/ {capacitySummary!.vehicleMaxHeightCm} ซม.
                          </span>
                        )}
                      </div>
                      {capacitySummary && capacitySummary.vehicleMaxHeightCm !== null && (
                        <div className="mt-2">
                          <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full ${capacitySummary!.totalHeightCm > capacitySummary!.vehicleMaxHeightCm
                                ? 'bg-red-500'
                                : capacitySummary!.totalHeightCm > capacitySummary!.vehicleMaxHeightCm * 0.9
                                  ? 'bg-amber-500'
                                  : 'bg-green-500'
                                }`}
                              style={{
                                width: `${Math.min(
                                  100,
                                  (capacitySummary!.totalHeightCm / capacitySummary!.vehicleMaxHeightCm) * 100
                                )}%`,
                              }}
                            />
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                            {Math.round(
                              (capacitySummary!.totalHeightCm / capacitySummary!.vehicleMaxHeightCm) * 100
                            )}
                            % ของความจุ
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              }

              const isExpanded = expandedStoreIndex === storeIndex;
              const filteredProducts = getFilteredProducts(storeIndex);

              return (
                <div
                  key={store.id}
                  className="border border-slate-200 dark:border-slate-700 rounded-lg p-4"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <span className="flex items-center justify-center w-8 h-8 rounded-full bg-enterprise-100 dark:bg-enterprise-900 text-enterprise-600 dark:text-enterprise-400 font-semibold">
                        {storeWithItems.sequence_order}
                      </span>
                      <div>
                        <div className="font-medium text-slate-900 dark:text-slate-100">
                          {store.customer_code} - {store.customer_name}
                        </div>
                        <div className="text-sm text-slate-500 dark:text-slate-400">
                          {storeWithItems.items.length > 0 ? (
                            <span className="text-green-600 dark:text-green-400 font-medium">
                              ✓ {storeWithItems.items.length} รายการสินค้า (เสร็จแล้ว)
                            </span>
                          ) : (
                            <span className="text-amber-600 dark:text-amber-400">
                              ⚠ ยังไม่มีสินค้า
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setExpandedStoreIndex(isExpanded ? null : storeIndex)}
                        className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded"
                      >
                        {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveStore(storeIndex)}
                        className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="mt-4 space-y-4">
                      {/* Product Search */}
                      <div>
                        <Input
                          type="text"
                          placeholder="ค้นหาสินค้า..."
                          value={productSearch.get(storeIndex) || ''}
                          onChange={(e) => {
                            const newSearch = new Map(productSearch);
                            newSearch.set(storeIndex, e.target.value);
                            setProductSearch(newSearch);
                          }}
                          icon={<Search size={18} />}
                        />
                      </div>

                      {/* Product Selector with Quantity Input */}
                      {filteredProducts.length > 0 && (
                        <div className="space-y-2 max-h-60 overflow-y-auto p-2 border border-slate-200 dark:border-slate-700 rounded">
                          <div className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">
                            เลือกสินค้าและระบุจำนวน:
                          </div>
                          {filteredProducts.map((product) => {
                            const inputKey = `${storeIndex}-${product.id}`;
                            const existingItem = storeWithItems.items.find(item => item.product_id === product.id);
                            const currentQuantity = productQuantityInput.get(inputKey) ?? (existingItem ? existingItem.quantity.toString() : '');

                            const isAdded = !!existingItem;

                            return (
                              <div
                                key={product.id}
                                className={`flex items-center gap-2 p-2 rounded border ${isAdded
                                  ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700 hover:bg-green-100 dark:hover:bg-green-900/30'
                                  : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                                  }`}
                              >
                                <div className="flex-1 min-w-0">
                                  <div className={`font-medium text-sm ${isAdded
                                    ? 'text-green-900 dark:text-green-100'
                                    : 'text-slate-900 dark:text-slate-100'
                                    }`}>
                                    {product.product_code}
                                    {isAdded && (
                                      <span className="ml-2 text-xs text-green-600 dark:text-green-400">
                                        (เพิ่มแล้ว: {existingItem.quantity} {product.unit})
                                      </span>
                                    )}
                                  </div>
                                  <div className={`text-xs truncate ${isAdded
                                    ? 'text-green-700 dark:text-green-300'
                                    : 'text-slate-500 dark:text-slate-400'
                                    }`}>
                                    {product.product_name} ({product.unit})
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Input
                                    type="number"
                                    value={currentQuantity}
                                    onChange={(e) => {
                                      const value = e.target.value;
                                      // Allow empty string
                                      const newMap = new Map(productQuantityInput);
                                      newMap.set(inputKey, value);
                                      setProductQuantityInput(newMap);
                                    }}
                                    placeholder="จำนวน"
                                    className="w-20"
                                    min="0"
                                    step="0.01"
                                  />
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      const quantity = parseFloat(currentQuantity);
                                      // Validate quantity before adding
                                      if (!quantity || quantity <= 0) {
                                        setError('กรุณาระบุจำนวนสินค้าที่มากกว่า 0');
                                        return;
                                      }
                                      handleAddProduct(storeIndex, product.id, quantity);
                                      // Clear input after adding
                                      const newMap = new Map(productQuantityInput);
                                      newMap.delete(inputKey);
                                      setProductQuantityInput(newMap);
                                    }}
                                  >
                                    <Plus size={16} />
                                  </Button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Selected Products */}
                      {storeWithItems.items.length > 0 && (
                        <div className="space-y-2">
                          <div className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center justify-between">
                            <span>สินค้าที่เลือก ({storeWithItems.items.length} รายการ):</span>
                            <button
                              type="button"
                              onClick={() => {
                                // Auto-collapse when store has products
                                setExpandedStoreIndex(null);
                              }}
                              className="text-xs text-enterprise-600 dark:text-enterprise-400 hover:underline flex items-center gap-1"
                            >
                              <ChevronUp size={14} />
                              ยุบร้านนี้
                            </button>
                          </div>

                          {/* Header row */}
                          <div className={`hidden sm:grid gap-2 px-2 text-xs font-medium text-slate-500 dark:text-slate-400 ${isEdit ? 'sm:grid-cols-[2fr_2fr_1.5fr_1fr_1fr_auto]' : 'sm:grid-cols-[2fr_2fr_1.5fr_1fr_auto]'}`}>
                            <div>รหัสสินค้า</div>
                            <div>ชื่อสินค้า</div>
                            <div>หมวดหมู่</div>
                            <div className="text-right">จำนวน / หน่วย</div>
                            {isEdit && <div className="text-right text-amber-600 dark:text-amber-400">รับที่ร้าน</div>}
                            <div className="text-center">ลบ</div>
                          </div>

                          {storeWithItems.items.map((item, itemIndex) => {
                            const product = getProductInfo(item.product_id);
                            if (!product) return null;

                            return (
                              <div
                                key={item.product_id}
                                className={`flex flex-col gap-2 p-2 bg-slate-50 dark:bg-slate-800 rounded ${isEdit ? 'sm:grid sm:grid-cols-[2fr_2fr_1.5fr_1fr_1fr_auto]' : 'sm:grid sm:grid-cols-[2fr_2fr_1.5fr_1fr_auto]'}`}
                              >
                                {/* Code */}
                                <div className="min-w-0">
                                  <div className="sm:hidden text-[11px] text-slate-500 dark:text-slate-400 mb-0.5">
                                    รหัสสินค้า
                                  </div>
                                  <div className="font-medium text-slate-900 dark:text-slate-100 break-words text-sm">
                                    {product.product_code}
                                  </div>
                                </div>

                                {/* Name */}
                                <div className="min-w-0">
                                  <div className="sm:hidden text-[11px] text-slate-500 dark:text-slate-400 mb-0.5">
                                    ชื่อสินค้า
                                  </div>
                                  <div className="text-sm text-slate-900 dark:text-slate-100 break-words">
                                    {product.product_name}
                                  </div>
                                </div>

                                {/* Category */}
                                <div className="min-w-0">
                                  <div className="sm:hidden text-[11px] text-slate-500 dark:text-slate-400 mb-0.5">
                                    หมวดหมู่
                                  </div>
                                  <div className="text-xs text-slate-500 dark:text-slate-400">
                                    {product.category}
                                  </div>
                                </div>

                                {/* Quantity + unit */}
                                <div className="flex items-center gap-1 sm:justify-end">
                                  <div className="flex-1 sm:flex-none">
                                    <div className="sm:hidden text-[11px] text-slate-500 dark:text-slate-400 mb-0.5">
                                      จำนวน
                                    </div>
                                    <Input
                                      type="number"
                                      value={item.quantity}
                                      onChange={(e) =>
                                        handleUpdateQuantity(
                                          storeIndex,
                                          itemIndex,
                                          parseFloat(e.target.value) || 0
                                        )
                                      }
                                      className="w-full text-right"
                                      min="0"
                                      step="0.01"
                                    />
                                  </div>
                                  <div className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap pl-1">
                                    {product.unit}
                                  </div>
                                </div>

                                {/* Quantity picked up at store (edit mode only) */}
                                {isEdit && (
                                  <div className="flex flex-col gap-0.5 sm:justify-end">
                                    <div className="sm:hidden text-[11px] text-amber-600 dark:text-amber-400 mb-0.5">
                                      รับที่ร้านแล้ว
                                    </div>
                                    <Input
                                      type="number"
                                      value={item.quantity_picked_up_at_store ?? 0}
                                      onChange={(e) => {
                                        const raw = parseFloat(e.target.value) || 0;
                                        const val = Math.min(item.quantity, Math.max(0, Math.floor(raw)));
                                        const updatedStores = [...selectedStores];
                                        updatedStores[storeIndex].items[itemIndex].quantity_picked_up_at_store = val;
                                        setSelectedStores(updatedStores);
                                      }}
                                      className="w-full text-right border-amber-300 dark:border-amber-700"
                                      min="0"
                                      max={item.quantity}
                                      step="1"
                                      title="จำนวนเต็มที่ลูกค้ารับที่ร้านแล้ว (ไม่ต้องขนส่ง)"
                                    />
                                    {(item.quantity_picked_up_at_store ?? 0) > 0 && (
                                      <div className="text-[10px] text-green-600 dark:text-green-400 text-right">
                                        ส่ง: {Math.max(0, item.quantity - (item.quantity_picked_up_at_store ?? 0)).toLocaleString()} {product.unit}
                                      </div>
                                    )}
                                  </div>
                                )}

                                {/* Remove button */}
                                <div className="flex items-center justify-end">
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveProduct(storeIndex, itemIndex)}
                                    className="p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                                  >
                                    <X size={16} />
                                  </button>
                                </div>

                                {/* Phase 0: Pallet Config Selector - Full width below */}
                                <div className="col-span-full">
                                  <PalletConfigSelector
                                    productId={item.product_id}
                                    productName={product.product_name}
                                    quantity={item.quantity}
                                    configs={product.product_pallet_configs || []}
                                    selectedConfigId={item.selected_pallet_config_id}
                                    onChange={(configId) => {
                                      const updatedStores = [...selectedStores];
                                      updatedStores[storeIndex].items[itemIndex].selected_pallet_config_id = configId;
                                      setSelectedStores(updatedStores);
                                    }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>

        {/* Aggregated Products Summary */}
        {aggregatedProducts.length > 0 && (
          <Card>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
              <Package size={20} />
              สรุปสินค้าทั้งหมดในเที่ยว
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700">
                    <th className="text-left py-2 px-3 text-sm font-medium text-slate-700 dark:text-slate-300">
                      รหัสสินค้า
                    </th>
                    <th className="text-left py-2 px-3 text-sm font-medium text-slate-700 dark:text-slate-300">
                      ชื่อสินค้า
                    </th>
                    <th className="text-left py-2 px-3 text-sm font-medium text-slate-700 dark:text-slate-300">
                      หมวดหมู่
                    </th>
                    <th className="text-right py-2 px-3 text-sm font-medium text-slate-700 dark:text-slate-300">
                      จำนวนรวม
                    </th>
                    <th className="text-left py-2 px-3 text-sm font-medium text-slate-700 dark:text-slate-300">
                      ร้านค้า
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {aggregatedProducts.map((product) => (
                    <tr
                      key={product.product_id}
                      className="border-b border-slate-100 dark:border-slate-800"
                    >
                      <td className="py-2 px-3 text-sm text-slate-900 dark:text-slate-100">
                        {product.product_code}
                      </td>
                      <td className="py-2 px-3 text-sm text-slate-900 dark:text-slate-100">
                        {product.product_name}
                      </td>
                      <td className="py-2 px-3 text-sm text-slate-500 dark:text-slate-400">
                        {product.category}
                      </td>
                      <td className="py-2 px-3 text-sm text-right font-medium text-slate-900 dark:text-slate-100">
                        {product.total_quantity.toLocaleString()} {product.unit}
                      </td>
                      <td className="py-2 px-3 text-sm text-slate-500 dark:text-slate-400">
                        {product.stores.map(s => `${s.customer_name} (${s.quantity})`).join(', ')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* Edit Reason - Required for Edit Mode */}
        {isEdit && (
          <Card className="p-6 bg-amber-50 dark:bg-amber-900/20 border-2 border-amber-300 dark:border-amber-700">
            <h3 className="text-lg font-semibold text-amber-800 dark:text-amber-200 mb-4 flex items-center gap-2">
              <AlertCircle size={20} />
              เหตุผลในการแก้ไข (บังคับ)
            </h3>
            <p className="text-sm text-amber-700 dark:text-amber-300 mb-3">
              กรุณาระบุเหตุผลในการแก้ไขข้อมูลทริป เพื่อบันทึกประวัติการแก้ไข
            </p>
            <textarea
              value={editReason}
              onChange={(e) => setEditReason(e.target.value)}
              placeholder="เช่น แก้ไขรถ, เปลี่ยนคนขับ, แก้ไขร้านค้า, แก้ไขสินค้า, เป็นต้น"
              rows={3}
              required
              className="w-full px-4 py-2 border-2 border-amber-300 dark:border-amber-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-amber-500 focus:border-transparent resize-none"
            />
          </Card>
        )}

        {/* Error & Success Messages */}
        {error && (
          <Card className="p-4 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800">
            <div className="flex items-center gap-2 text-red-800 dark:text-red-200">
              <X size={20} />
              <span>{error}</span>
            </div>
          </Card>
        )}

        {success && (
          <Card className="p-4 bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
            <div className="flex items-center gap-2 text-green-800 dark:text-green-200">
              <Save size={20} />
              <span>บันทึกทริปสำเร็จ</span>
            </div>
          </Card>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between">
          <Button type="button" variant="outline" onClick={onCancel}>
            <ArrowLeft size={18} className="mr-2" />
            ยกเลิก
          </Button>
          <Button type="submit" isLoading={saving} disabled={saving}>
            <Save size={18} className="mr-2" />
            {isEdit ? 'บันทึกการแก้ไข' : 'สร้างทริป'}
          </Button>
        </div>
      </form>
    </PageLayout>
  );
};


