// Delivery Trip Form View - Create/Edit delivery trip
import React from 'react';
import {
  ArrowLeft,
  Save,
  X,
  Package,
  AlertCircle,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { TripBasicInfoForm } from '../components/trip/TripBasicInfoForm';
import { TripCrewSection } from '../components/trip/TripCrewSection';
import { TripOrdersSection } from '../components/trip/TripOrdersSection';
import { TripItemsSection } from '../components/trip/TripItemsSection';
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
    tripBranch,
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
      <PageLayout
        title={isEdit ? 'แก้ไขทริปส่งสินค้า' : 'สร้างทริปส่งสินค้า'}
        loading={true}
      >
        {/* ใช้ PageLayout ในโหมด loading ขณะกำลังดึงข้อมูลทริป */}
      </PageLayout>
    );
  }

  return (
    <PageLayout
      title={isEdit ? 'แก้ไขทริปส่งสินค้า' : 'สร้างทริปส่งสินค้า'}
      subtitle={isEdit ? 'แก้ไขข้อมูลทริปส่งสินค้า' : 'สร้างทริปส่งสินค้าใหม่'}
    >
      <form onSubmit={handleSubmit} onKeyDown={handleFormKeyDown} className="space-y-6">
        <TripBasicInfoForm
          formData={formData}
          setFormData={setFormData}
          vehicleSearch={vehicleSearch}
          setVehicleSearch={setVehicleSearch}
          showVehicleDropdown={showVehicleDropdown}
          setShowVehicleDropdown={setShowVehicleDropdown}
          vehicleInputRef={vehicleInputRef}
          vehicleDropdownPosition={vehicleDropdownPosition}
          setVehicleDropdownPosition={setVehicleDropdownPosition}
          filteredVehicles={filteredVehicles}
          activeVehicleIds={activeVehicleIds}
          vehiclesWithActiveTickets={vehiclesWithActiveTickets}
          vehiclesWithActiveDeliveryTrips={vehiclesWithActiveDeliveryTrips}
          onSelectVehicle={handleSelectVehicle}
          drivers={drivers}
          latestOdometer={latestOdometer}
          showDestinations={!!(formData.vehicle_id && selectedStores.length > 0)}
          destinationsText={destinations}
        />

        <TripCrewSection
          availableStaff={availableStaff}
          tripBranch={tripBranch}
          selectedDriverStaffId={selectedDriverStaffId}
          setSelectedDriverStaffId={setSelectedDriverStaffId}
          driverStaffSearch={driverStaffSearch}
          setDriverStaffSearch={setDriverStaffSearch}
          showDriverStaffDropdown={showDriverStaffDropdown}
          setShowDriverStaffDropdown={setShowDriverStaffDropdown}
          driverStaffInputRef={driverStaffInputRef}
          driverStaffDropdownPosition={driverStaffDropdownPosition}
          setDriverStaffDropdownPosition={setDriverStaffDropdownPosition}
          selectedHelpers={selectedHelpers}
          setSelectedHelpers={setSelectedHelpers}
          helperSearch={helperSearch}
          setHelperSearch={setHelperSearch}
          showHelperDropdown={showHelperDropdown}
          setShowHelperDropdown={setShowHelperDropdown}
          helperInputRef={helperInputRef}
          helperDropdownPosition={helperDropdownPosition}
          setHelperDropdownPosition={setHelperDropdownPosition}
        />

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

        <TripOrdersSection
          storeSearch={storeSearch}
          setStoreSearch={setStoreSearch}
          showStoreDropdown={showStoreDropdown}
          setShowStoreDropdown={setShowStoreDropdown}
          storeInputRef={storeInputRef}
          filteredStores={filteredStores}
          selectedStores={selectedStores}
          setSelectedStores={setSelectedStores}
          getStoreInfo={getStoreInfo}
          onAddStore={handleAddStore}
          onRemoveStore={handleRemoveStore}
          expandedStoreIndex={expandedStoreIndex}
          setExpandedStoreIndex={setExpandedStoreIndex}
          productSearch={productSearch}
          setProductSearch={setProductSearch}
          getFilteredProducts={getFilteredProducts}
          productQuantityInput={productQuantityInput}
          setProductQuantityInput={setProductQuantityInput}
          getProductInfo={getProductInfo}
          onAddProduct={handleAddProduct}
          onRemoveProduct={handleRemoveProduct}
          onUpdateQuantity={handleUpdateQuantity}
          setError={setError}
          capacitySummary={capacitySummary}
          isEdit={isEdit}
        />

        <TripItemsSection aggregatedProducts={aggregatedProducts} />

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


