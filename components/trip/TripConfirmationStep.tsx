import React from 'react';
import { Package, Save, AlertCircle } from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import type { CapacitySummary } from '../../types/createTripWizard';
import type { PalletPackingResult } from '../../utils/palletPacking';

export interface TripConfirmationStepProps {
  totals: { totalAmount: number; totalStops: number };
  selectedOrders: any[];
  storeDeliveries: { id: string }[];
  orderItemsMap: Map<string, any[]>;
  splitIntoTwoTrips: boolean;
  selectedVehicleId: string;
  selectedVehicleId2: string;
  selectedDriverId: string;
  selectedDriverId2: string;
  splitValidationErrors: string[];
  getItemsForVehicle: (vehicleNum: 1 | 2) => Array<{ product_id: string; quantity: number }>;
  isSubmitting: boolean;
  handleSubmit: () => void;
  capacitySummary: CapacitySummary | null;
  capacitySummary2: CapacitySummary | null;
  palletPackingResult: PalletPackingResult | null;
}

export function TripConfirmationStep({
  totals,
  selectedOrders,
  storeDeliveries,
  orderItemsMap,
  splitIntoTwoTrips,
  selectedVehicleId,
  selectedVehicleId2,
  selectedDriverId,
  selectedDriverId2,
  splitValidationErrors,
  getItemsForVehicle,
  isSubmitting,
  handleSubmit,
  capacitySummary,
  capacitySummary2,
  palletPackingResult,
}: TripConfirmationStepProps) {
  const hasItems = Array.from(orderItemsMap.values()).some((items: any[]) => Array.isArray(items) && items.length > 0);
  const items2Length = getItemsForVehicle(2).length;
  const showCapacity2 = splitIntoTwoTrips && selectedVehicleId2 && items2Length > 0;
  const submitDisabled =
    isSubmitting ||
    !selectedVehicleId ||
    !selectedDriverId ||
    storeDeliveries.length === 0 ||
    (splitIntoTwoTrips && (!selectedVehicleId2 || !selectedDriverId2 || splitValidationErrors.length > 0 || items2Length === 0));

  return (
    <div className="space-y-6">
      <Card>
        <div className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">สรุปทริป</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between py-3 border-b border-gray-200">
              <div className="flex items-center gap-2 text-gray-600">
                <Package className="w-5 h-5" />
                <span>จำนวนจุดส่ง</span>
              </div>
              <span className="text-xl font-bold text-gray-900">{totals.totalStops}</span>
            </div>
            <div className="flex items-center justify-between py-3 border-b border-gray-200">
              <div className="flex items-center gap-2 text-gray-600">
                <Package className="w-5 h-5" />
                <span>จำนวนออเดอร์</span>
              </div>
              <span className="text-xl font-bold text-gray-900">{selectedOrders.length}</span>
            </div>
            <div className="flex items-center justify-between pt-3">
              <span className="font-semibold text-gray-900">มูลค่ารวม</span>
              <span className="text-2xl font-bold text-blue-600">
                {new Intl.NumberFormat('th-TH').format(totals.totalAmount)} ฿
              </span>
            </div>
          </div>
          <div className="mt-6 pt-6 border-t border-gray-200">
            <Button onClick={handleSubmit} disabled={submitDisabled} className="w-full">
              {isSubmitting ? (
                <>
                  <LoadingSpinner size={16} className="mr-2" />
                  กำลังสร้างทริป...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  สร้างทริป
                </>
              )}
            </Button>
          </div>
        </div>
      </Card>

      {selectedVehicleId && storeDeliveries.length > 0 && (
        <Card>
          <div className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Package size={20} />
              {splitIntoTwoTrips ? 'สรุปความจุ (คัน 1)' : 'สรุปความจุ'}
            </h3>
            {!hasItems ? (
              <div className="text-center py-4 text-gray-500">
                <p>กำลังโหลดข้อมูลสินค้า...</p>
              </div>
            ) : capacitySummary?.loading ? (
              <div className="text-center py-4 text-gray-500">กำลังคำนวณ...</div>
            ) : capacitySummary ? (
              (() => {
                const displayPallets = palletPackingResult ? palletPackingResult.totalPallets : capacitySummary.totalPallets;
                const nonPalletErrors = capacitySummary.errors.filter((msg) => !msg.startsWith('จำนวนพาเลท'));
                const nonPalletWarnings = capacitySummary.warnings.filter((msg) => !msg.startsWith('จำนวนพาเลท'));
                const palletErrors: string[] = [];
                const palletWarnings: string[] = [];
                if (capacitySummary.vehicleMaxPallets !== null) {
                  if (displayPallets > capacitySummary.vehicleMaxPallets) {
                    palletErrors.push(`จำนวนพาเลทเกินความจุ: ${displayPallets} พาเลท (สูงสุด ${capacitySummary.vehicleMaxPallets} พาเลท)`);
                  } else if (displayPallets > capacitySummary.vehicleMaxPallets * 0.9) {
                    palletWarnings.push(`จำนวนพาเลทใกล้เต็มความจุ: ${displayPallets}/${capacitySummary.vehicleMaxPallets} พาเลท (${Math.round((displayPallets / capacitySummary.vehicleMaxPallets) * 100)}%)`);
                  }
                }
                const errorsToShow = [...nonPalletErrors, ...palletErrors];
                const warningsToShow = [...nonPalletWarnings, ...palletWarnings];
                return (
                  <div className="space-y-3">
                    {errorsToShow.length > 0 && (
                      <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                        <div className="flex items-center gap-2 text-red-800 mb-2">
                          <AlertCircle size={16} />
                          <span className="font-medium">ข้อผิดพลาด:</span>
                        </div>
                        <ul className="list-disc list-inside text-sm text-red-700 space-y-1">
                          {errorsToShow.map((error, idx) => (
                            <li key={idx}>{error}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {warningsToShow.length > 0 && (
                      <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                        <div className="flex items-center gap-2 text-amber-800 mb-2">
                          <AlertCircle size={16} />
                          <span className="font-medium">คำเตือน:</span>
                        </div>
                        <ul className="list-disc list-inside text-sm text-amber-700 space-y-1">
                          {warningsToShow.map((warning, idx) => (
                            <li key={idx}>{warning}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-3 bg-gray-50 rounded-lg">
                        <div className="text-sm text-gray-600 mb-1">
                          {palletPackingResult ? 'จำนวนพาเลท (จัดรวม)' : 'จำนวนพาเลท'}
                          <span className="block text-xs text-gray-500 font-normal mt-0.5">
                            {palletPackingResult ? 'หลายชนิดบนพาเลทเดียวกัน ตามน้ำหนัก/ปริมาตร' : '(ค่าประมาณแยกตามชนิดสินค้า การจัดเรียงจริงอาจใช้น้อยกว่าถ้ารวมพาเลทได้)'}
                          </span>
                        </div>
                        <div className="text-2xl font-bold text-gray-900">
                          {displayPallets}
                          {capacitySummary.vehicleMaxPallets !== null && (
                            <span className="text-lg font-normal text-gray-500"> / {capacitySummary.vehicleMaxPallets}</span>
                          )}
                        </div>
                        {capacitySummary.vehicleMaxPallets !== null && (
                          <div className="mt-2">
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div
                                className={`h-2 rounded-full ${
                                  displayPallets > capacitySummary.vehicleMaxPallets
                                    ? 'bg-red-500'
                                    : displayPallets > capacitySummary.vehicleMaxPallets * 0.9
                                      ? 'bg-amber-500'
                                      : 'bg-green-500'
                                }`}
                                style={{ width: `${Math.min(100, (displayPallets / capacitySummary.vehicleMaxPallets) * 100)}%` }}
                              />
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                              {Math.round((displayPallets / capacitySummary.vehicleMaxPallets) * 100)}% ของความจุ
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="p-3 bg-gray-50 rounded-lg">
                        <div className="text-sm text-gray-600 mb-1">น้ำหนักรวม</div>
                        <div className="text-2xl font-bold text-gray-900">
                          {capacitySummary.totalWeightKg.toFixed(2)} กก.
                          {capacitySummary.vehicleMaxWeightKg !== null && (
                            <span className="text-lg font-normal text-gray-500"> / {capacitySummary.vehicleMaxWeightKg} กก.</span>
                          )}
                        </div>
                        {capacitySummary.vehicleMaxWeightKg !== null && (
                          <div className="mt-2">
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div
                                className={`h-2 rounded-full ${
                                  capacitySummary.totalWeightKg > capacitySummary.vehicleMaxWeightKg
                                    ? 'bg-red-500'
                                    : capacitySummary.totalWeightKg > capacitySummary.vehicleMaxWeightKg * 0.9
                                      ? 'bg-amber-500'
                                      : 'bg-green-500'
                                }`}
                                style={{
                                  width: `${Math.min(100, (capacitySummary.totalWeightKg / capacitySummary.vehicleMaxWeightKg) * 100)}%`,
                                }}
                              />
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                              {Math.round((capacitySummary.totalWeightKg / capacitySummary.vehicleMaxWeightKg) * 100)}% ของความจุ
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()
            ) : (
              <div className="text-sm text-gray-500">กำลังคำนวณความจุ...</div>
            )}
          </div>
        </Card>
      )}

      {showCapacity2 && (
        <Card>
          <div className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Package size={20} />
              สรุปความจุ (คัน 2)
            </h3>
            {capacitySummary2?.loading ? (
              <div className="text-center py-4 text-gray-500">กำลังคำนวณ...</div>
            ) : capacitySummary2 ? (
              <div className="space-y-3">
                {capacitySummary2.errors.length > 0 && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex items-center gap-2 text-red-800 mb-2">
                      <AlertCircle size={16} />
                      <span className="font-medium">ข้อผิดพลาด:</span>
                    </div>
                    <ul className="list-disc list-inside text-sm text-red-700 space-y-1">
                      {capacitySummary2.errors.map((error, idx) => (
                        <li key={idx}>{error}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <div className="text-sm text-gray-600 mb-1">พาเลท</div>
                    <div className="text-xl font-bold text-gray-900">
                      {capacitySummary2.totalPallets}
                      {capacitySummary2.vehicleMaxPallets != null && (
                        <span className="text-sm font-normal text-gray-500"> / {capacitySummary2.vehicleMaxPallets}</span>
                      )}
                    </div>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <div className="text-sm text-gray-600 mb-1">น้ำหนัก (กก.)</div>
                    <div className="text-xl font-bold text-gray-900">
                      {capacitySummary2.totalWeightKg.toFixed(2)}
                      {capacitySummary2.vehicleMaxWeightKg != null && (
                        <span className="text-sm font-normal text-gray-500"> / {capacitySummary2.vehicleMaxWeightKg}</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-sm text-gray-500">เลือกรถคันที่ 2 และจัดร้านลงคัน 2 เพื่อดูความจุ</div>
            )}
          </div>
        </Card>
      )}

      <Card>
        <div className="p-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">ออเดอร์ที่เลือก ({selectedOrders.length})</h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {selectedOrders.map((order) => (
              <div key={order.id} className="p-3 bg-gray-50 rounded-lg">
                <p className="text-sm font-medium text-gray-900">{order.order_number || 'รอจัดทริป'}</p>
                <p className="text-xs text-gray-500">{order.customer_name}</p>
              </div>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
}
