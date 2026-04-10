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
  splitIntoThreeTrips?: boolean;
  selectedVehicleId: string;
  selectedVehicleId2: string;
  selectedVehicleId3?: string;
  selectedDriverId: string;
  selectedDriverId2: string;
  selectedDriverId3?: string;
  splitValidationErrors: string[];
  getItemsForVehicle: (tripNum: 1 | 2 | 3) => Array<{ product_id: string; quantity: number }>;
  isSubmitting: boolean;
  handleSubmit: () => void;
  capacitySummary: CapacitySummary | null;
  capacitySummary2: CapacitySummary | null;
  capacitySummary3?: CapacitySummary | null;
  palletPackingResult: PalletPackingResult | null;
  palletPackingResult2?: PalletPackingResult | null;
  palletPackingResult3?: PalletPackingResult | null;
}

export function TripConfirmationStep({
  totals,
  selectedOrders,
  storeDeliveries,
  orderItemsMap,
  splitIntoTwoTrips,
  splitIntoThreeTrips = false,
  selectedVehicleId,
  selectedVehicleId2,
  selectedVehicleId3 = '',
  selectedDriverId,
  selectedDriverId2,
  selectedDriverId3 = '',
  splitValidationErrors,
  getItemsForVehicle,
  isSubmitting,
  handleSubmit,
  capacitySummary,
  capacitySummary2,
  capacitySummary3 = null,
  palletPackingResult,
  palletPackingResult2 = null,
  palletPackingResult3 = null,
}: TripConfirmationStepProps) {
  const hasItems = Array.from(orderItemsMap.values()).some((items: any[]) => Array.isArray(items) && items.length > 0);
  const items2Length = getItemsForVehicle(2).length;
  const items3Length = getItemsForVehicle(3).length;
  const showCapacity2 = (splitIntoTwoTrips || splitIntoThreeTrips) && selectedVehicleId2 && items2Length > 0;
  const showCapacity3 = splitIntoThreeTrips && selectedVehicleId3 && items3Length > 0;
  const submitDisabled =
    isSubmitting ||
    !selectedVehicleId ||
    !selectedDriverId ||
    storeDeliveries.length === 0 ||
    (splitIntoTwoTrips && (!selectedVehicleId2 || !selectedDriverId2 || splitValidationErrors.length > 0 || items2Length === 0)) ||
    (splitIntoThreeTrips && (!selectedVehicleId2 || !selectedDriverId2 || !selectedVehicleId3 || !selectedDriverId3 || splitValidationErrors.length > 0 || items2Length === 0 || items3Length === 0));

  const renderCapacityCard = (
    title: string,
    summary: CapacitySummary | null,
    packingResult: PalletPackingResult | null,
    emptyText: string
  ) => {
    if (summary?.loading) {
      return <div className="text-center py-4 text-gray-500">กำลังคำนวณ...</div>;
    }

    if (!summary) {
      return <div className="text-sm text-gray-500">{emptyText}</div>;
    }

    const displayPallets = packingResult ? packingResult.totalPallets : summary.totalPallets;
    const nonPalletErrors = summary.errors.filter((msg) => !msg.startsWith('จำนวนพาเลท'));
    const nonPalletWarnings = summary.warnings.filter((msg) => !msg.startsWith('จำนวนพาเลท'));
    const palletErrors: string[] = [];
    const palletWarnings: string[] = [];

    if (summary.vehicleMaxPallets !== null) {
      if (displayPallets > summary.vehicleMaxPallets) {
        palletErrors.push(`จำนวนพาเลทเกินความจุ: ${displayPallets} พาเลท (สูงสุด ${summary.vehicleMaxPallets} พาเลท)`);
      } else if (displayPallets > summary.vehicleMaxPallets * 0.9) {
        palletWarnings.push(`จำนวนพาเลทใกล้เต็มความจุ: ${displayPallets}/${summary.vehicleMaxPallets} พาเลท (${Math.round((displayPallets / summary.vehicleMaxPallets) * 100)}%)`);
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
              {packingResult ? 'จำนวนพาเลท (จัดรวม)' : 'จำนวนพาเลท'}
              <span className="block text-xs text-gray-500 font-normal mt-0.5">
                {packingResult ? 'หลายชนิดบนพาเลทเดียวกัน ตามน้ำหนัก/ปริมาตร' : '(ค่าประมาณแยกตามชนิดสินค้า การจัดเรียงจริงอาจใช้น้อยกว่าถ้ารวมพาเลทได้)'}
              </span>
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {displayPallets}
              {summary.vehicleMaxPallets !== null && (
                <span className="text-lg font-normal text-gray-500"> / {summary.vehicleMaxPallets}</span>
              )}
            </div>
            {summary.vehicleMaxPallets !== null && (
              <div className="mt-2">
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${
                      displayPallets > summary.vehicleMaxPallets
                        ? 'bg-red-500'
                        : displayPallets > summary.vehicleMaxPallets * 0.9
                          ? 'bg-amber-500'
                          : 'bg-green-500'
                    }`}
                    style={{ width: `${Math.min(100, (displayPallets / summary.vehicleMaxPallets) * 100)}%` }}
                  />
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {Math.round((displayPallets / summary.vehicleMaxPallets) * 100)}% ของความจุ
                </div>
              </div>
            )}
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <div className="text-sm text-gray-600 mb-1">น้ำหนักรวม</div>
            <div className="text-2xl font-bold text-gray-900">
              {summary.totalWeightKg.toFixed(2)} กก.
              {summary.vehicleMaxWeightKg !== null && (
                <span className="text-lg font-normal text-gray-500"> / {summary.vehicleMaxWeightKg} กก.</span>
              )}
            </div>
            {summary.vehicleMaxWeightKg !== null && (
              <div className="mt-2">
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${
                      summary.totalWeightKg > summary.vehicleMaxWeightKg
                        ? 'bg-red-500'
                        : summary.totalWeightKg > summary.vehicleMaxWeightKg * 0.9
                          ? 'bg-amber-500'
                          : 'bg-green-500'
                    }`}
                    style={{
                      width: `${Math.min(100, (summary.totalWeightKg / summary.vehicleMaxWeightKg) * 100)}%`,
                    }}
                  />
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {Math.round((summary.totalWeightKg / summary.vehicleMaxWeightKg) * 100)}% ของความจุ
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

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
              {splitIntoThreeTrips ? 'สรุปความจุ (เที่ยว 1)' : splitIntoTwoTrips ? 'สรุปความจุ (คัน 1)' : 'สรุปความจุ'}
            </h3>
            {!hasItems ? (
              <div className="text-center py-4 text-gray-500">
                <p>กำลังโหลดข้อมูลสินค้า...</p>
              </div>
            ) : (
              renderCapacityCard(
                splitIntoThreeTrips ? 'สรุปความจุ (เที่ยว 1)' : splitIntoTwoTrips ? 'สรุปความจุ (คัน 1)' : 'สรุปความจุ',
                capacitySummary,
                palletPackingResult,
                'กำลังคำนวณความจุ...'
              )
            )}
          </div>
        </Card>
      )}

      {showCapacity2 && (
        <Card>
          <div className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Package size={20} />
              {splitIntoThreeTrips ? 'สรุปความจุ (เที่ยว 2)' : 'สรุปความจุ (คัน 2)'}
            </h3>
            {renderCapacityCard(
              splitIntoThreeTrips ? 'สรุปความจุ (เที่ยว 2)' : 'สรุปความจุ (คัน 2)',
              capacitySummary2,
              palletPackingResult2,
              `เลือกรถ${splitIntoThreeTrips ? 'เที่ยวที่ 2' : 'คันที่ 2'} และจัดร้านลง${splitIntoThreeTrips ? 'เที่ยว 2' : 'คัน 2'} เพื่อดูความจุ`
            )}
          </div>
        </Card>
      )}

      {showCapacity3 && (
        <Card>
          <div className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Package size={20} />
              สรุปความจุ (เที่ยว 3)
            </h3>
            {renderCapacityCard(
              'สรุปความจุ (เที่ยว 3)',
              capacitySummary3,
              palletPackingResult3,
              'เลือกรถเที่ยวที่ 3 และจัดร้านลงเที่ยว 3 เพื่อดูความจุ'
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
