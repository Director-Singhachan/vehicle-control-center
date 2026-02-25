import React from 'react';
import { Users, Calendar } from 'lucide-react';
import { Card } from '../ui/Card';

export interface CrewAssignmentStepProps {
  splitIntoTwoTrips: boolean;
  setSplitIntoTwoTripsWithExpanded: (checked: boolean) => void;
  /** Driver when not split */
  driversLoading: boolean;
  selectedBranch: string;
  filteredDrivers: Array<{ id: string; full_name: string; branch?: string | null }>;
  selectedDriverId: string;
  setSelectedDriverId: (id: string) => void;
  /** When split: vehicle + driver for trip 1 & 2 */
  vehiclesLoading: boolean;
  filteredVehicles: any[];
  selectedVehicleId: string;
  setSelectedVehicleId: (id: string) => void;
  selectedVehicleId2: string;
  setSelectedVehicleId2: (id: string) => void;
  selectedDriverId2: string;
  setSelectedDriverId2: (id: string) => void;
  /** Trip date, notes, skip stock */
  tripDate: string;
  setTripDate: (date: string) => void;
  notes: string;
  setNotes: (notes: string) => void;
  skipStockDeduction: boolean;
  setSkipStockDeduction: (v: boolean) => void;
}

export function CrewAssignmentStep({
  splitIntoTwoTrips,
  setSplitIntoTwoTripsWithExpanded,
  driversLoading,
  filteredDrivers,
  selectedDriverId,
  setSelectedDriverId,
  vehiclesLoading,
  filteredVehicles,
  selectedVehicleId,
  setSelectedVehicleId,
  selectedVehicleId2,
  setSelectedVehicleId2,
  selectedDriverId2,
  setSelectedDriverId2,
  tripDate,
  setTripDate,
  notes,
  setNotes,
  skipStockDeduction,
  setSkipStockDeduction,
}: CrewAssignmentStepProps) {
  return (
    <Card>
      <div className="p-6">
        <div className="space-y-4">
          {!splitIntoTwoTrips && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Users className="w-4 h-4 inline mr-1" />
                พนักงานขับรถ *
              </label>
              <select
                value={selectedDriverId}
                onChange={(e) => setSelectedDriverId(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                disabled={driversLoading}
              >
                <option value="">
                  {driversLoading
                    ? 'กำลังโหลดพนักงาน...'
                    : filteredDrivers.length === 0
                      ? 'ไม่พบพนักงานขับรถในสาขานี้'
                      : '-- เลือกพนักงาน --'}
                </option>
                {filteredDrivers.map((driver) => (
                  <option key={driver.id} value={driver.id}>
                    {driver.full_name}
                    {driver.branch ? ` [${driver.branch}]` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-slate-900/30 border border-slate-200 dark:border-slate-700 rounded-lg">
            <input
              type="checkbox"
              id="splitIntoTwoTrips"
              checked={splitIntoTwoTrips}
              onChange={(e) => setSplitIntoTwoTripsWithExpanded(e.target.checked)}
              className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <label htmlFor="splitIntoTwoTrips" className="flex-1 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
              <span className="font-medium">แบ่งสินค้าขึ้น 2 คัน</span>
              <span className="text-gray-500 dark:text-gray-400 ml-2">
                (กำหนดได้ว่าสินค้าแต่ละรายการจะขึ้นรถคันไหน จำนวนเท่าไร)
              </span>
            </label>
          </div>

          {splitIntoTwoTrips && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 border border-blue-200 dark:border-blue-800 rounded-lg bg-blue-50/50 dark:bg-blue-900/10">
              <div className="space-y-3">
                <h4 className="font-medium text-gray-900 dark:text-gray-100">ทริป 1 (คันที่ 1)</h4>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">รถ</label>
                  <select
                    value={selectedVehicleId}
                    onChange={(e) => setSelectedVehicleId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    disabled={vehiclesLoading}
                  >
                    <option value="">-- เลือกรถ --</option>
                    {filteredVehicles.map((v: any) => (
                      <option key={v.id} value={v.id}>
                        {v.plate} {v.make ? `- ${v.make}` : ''} {v.model || ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">พนักงานขับรถ</label>
                  <select
                    value={selectedDriverId}
                    onChange={(e) => setSelectedDriverId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    disabled={driversLoading}
                  >
                    <option value="">-- เลือกพนักงาน --</option>
                    {filteredDrivers.map((d) => (
                      <option key={d.id} value={d.id}>{d.full_name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="space-y-3">
                <h4 className="font-medium text-gray-900 dark:text-gray-100">ทริป 2 (คันที่ 2)</h4>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">รถ</label>
                  <select
                    value={selectedVehicleId2}
                    onChange={(e) => setSelectedVehicleId2(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    disabled={vehiclesLoading}
                  >
                    <option value="">-- เลือกรถ --</option>
                    {filteredVehicles.map((v: any) => (
                      <option key={v.id} value={v.id}>
                        {v.plate} {v.make ? `- ${v.make}` : ''} {v.model || ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">พนักงานขับรถ</label>
                  <select
                    value={selectedDriverId2}
                    onChange={(e) => setSelectedDriverId2(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    disabled={driversLoading}
                  >
                    <option value="">-- เลือกพนักงาน --</option>
                    {filteredDrivers.map((d) => (
                      <option key={d.id} value={d.id}>{d.full_name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Calendar className="w-4 h-4 inline mr-1" />
              วันที่ส่ง *
            </label>
            <input
              type="date"
              value={tripDate}
              onChange={(e) => setTripDate(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center gap-3 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
            <input
              type="checkbox"
              id="skipStockDeduction"
              checked={skipStockDeduction}
              onChange={(e) => setSkipStockDeduction(e.target.checked)}
              className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <label htmlFor="skipStockDeduction" className="flex-1 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
              <span className="font-medium">ไม่ตัดสต๊อก</span>
              <span className="text-gray-500 dark:text-gray-400 ml-2">
                (ใช้สำหรับระบบใบน้อยที่ยังไม่ตัดสต๊อก)
              </span>
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              หมายเหตุ
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              rows={3}
              placeholder="หมายเหตุเพิ่มเติม..."
            />
          </div>
        </div>
      </div>
    </Card>
  );
}
