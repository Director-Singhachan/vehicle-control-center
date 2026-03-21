import React, { type Dispatch, type SetStateAction } from 'react';
import { Users, Calendar } from 'lucide-react';
import { Card } from '../ui/Card';
import type { SplitMode } from '../../types/createTripWizard';
import { CrewAssignmentHelperPickers } from './CrewAssignmentHelperPickers';

export interface CrewAssignmentStepProps {
  splitIntoTwoTrips: boolean;
  splitIntoThreeTrips?: boolean;
  setSplitIntoTwoTripsWithExpanded: (checked: boolean) => void;
  setSplitModeWithExpanded?: (mode: SplitMode) => void;
  /** Driver when not split */
  driversLoading: boolean;
  selectedBranch: string;
  filteredDrivers: Array<{ id: string; full_name: string; branch?: string | null }>;
  selectedDriverId: string;
  setSelectedDriverId: (id: string) => void;
  /** When split: vehicle + driver for trip 1, 2, (3) */
  vehiclesLoading: boolean;
  filteredVehicles: any[];
  selectedVehicleId: string;
  setSelectedVehicleId: (id: string) => void;
  selectedVehicleId2: string;
  setSelectedVehicleId2: (id: string) => void;
  selectedDriverId2: string;
  setSelectedDriverId2: (id: string) => void;
  selectedVehicleId3?: string;
  setSelectedVehicleId3?: (id: string) => void;
  selectedDriverId3?: string;
  setSelectedDriverId3?: (id: string) => void;
  /** Trip date, notes, skip stock */
  tripDate: string;
  setTripDate: (date: string) => void;
  notes: string;
  setNotes: (notes: string) => void;
  skipStockDeduction: boolean;
  setSkipStockDeduction: (v: boolean) => void;
  helperStaffIds1: string[];
  setHelperStaffIds1: Dispatch<SetStateAction<string[]>>;
  helperStaffIds2: string[];
  setHelperStaffIds2: Dispatch<SetStateAction<string[]>>;
  helperStaffIds3: string[];
  setHelperStaffIds3: Dispatch<SetStateAction<string[]>>;
  /** Next sequence for same vehicle+date */
  nextTripSequence1?: number;
  nextTripSequence2?: number;
  nextTripSequence3?: number;
}

export function CrewAssignmentStep({
  splitIntoTwoTrips,
  splitIntoThreeTrips = false,
  setSplitIntoTwoTripsWithExpanded,
  setSplitModeWithExpanded,
  driversLoading,
  selectedBranch,
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
  selectedVehicleId3 = '',
  setSelectedVehicleId3,
  selectedDriverId3 = '',
  setSelectedDriverId3,
  tripDate,
  setTripDate,
  notes,
  setNotes,
  skipStockDeduction,
  setSkipStockDeduction,
  helperStaffIds1,
  setHelperStaffIds1,
  helperStaffIds2,
  setHelperStaffIds2,
  helperStaffIds3,
  setHelperStaffIds3,
  nextTripSequence1 = 1,
  nextTripSequence2 = 1,
  nextTripSequence3 = 1,
}: CrewAssignmentStepProps) {
  return (
    <Card>
      <div className="p-6">
        <div className="space-y-4">
          {!splitIntoTwoTrips && !splitIntoThreeTrips && (
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
              {nextTripSequence1 > 1 && (
                <p className="mt-2 text-sm text-enterprise-600 dark:text-enterprise-400">
                  รถคันนี้มีทริปในวันนี้แล้ว — เที่ยวนี้จะเป็น <strong>เที่ยวที่ {nextTripSequence1}</strong>
                </p>
              )}
            </div>
          )}

          <div className="space-y-2 p-4 bg-slate-50 dark:bg-slate-900/30 border border-slate-200 dark:border-slate-700 rounded-lg">
            <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">โหมดการแบ่งสินค้า</p>
            <div className="flex items-center gap-3">
              <input
                type="radio"
                name="splitMode"
                id="splitModeSingle"
                checked={!splitIntoTwoTrips && !splitIntoThreeTrips}
                onChange={() => setSplitIntoTwoTripsWithExpanded(false)}
                className="w-4 h-4 text-gray-600 border-gray-300 focus:ring-gray-500"
              />
              <label htmlFor="splitModeSingle" className="text-sm text-gray-700 dark:text-gray-300 cursor-pointer">ไม่แบ่ง (ทริปเดียว)</label>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="radio"
                name="splitMode"
                id="splitIntoTwoTrips"
                checked={splitIntoTwoTrips}
                onChange={() => setSplitIntoTwoTripsWithExpanded(true)}
                className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
              />
              <label htmlFor="splitIntoTwoTrips" className="flex-1 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                <span className="font-medium">แบ่ง 2 คัน</span>
                <span className="text-gray-500 dark:text-gray-400 ml-2">(รถคัน 1 + คัน 2)</span>
              </label>
            </div>
            {setSplitModeWithExpanded && (
              <div className="flex items-center gap-3">
                <input
                  type="radio"
                  name="splitMode"
                  id="splitIntoThreeTrips"
                  checked={splitIntoThreeTrips}
                  onChange={() => setSplitModeWithExpanded('3trips')}
                  className="w-4 h-4 text-enterprise-600 border-gray-300 focus:ring-enterprise-500"
                />
                <label htmlFor="splitIntoThreeTrips" className="flex-1 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                  <span className="font-medium">แบ่ง 3 เที่ยว</span>
                  <span className="text-gray-500 dark:text-gray-400 ml-2">(ออเดอร์เดียว รถคันเดียวกันหรือคนละคันได้)</span>
                </label>
              </div>
            )}
          </div>

          {splitIntoTwoTrips && !splitIntoThreeTrips && (
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
                  {nextTripSequence1 > 1 && (
                    <p className="mt-1 text-xs text-enterprise-600 dark:text-enterprise-400">
                      เที่ยวที่ {nextTripSequence1} ในวันนี้
                    </p>
                  )}
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
                  {nextTripSequence2 > 1 && (
                    <p className="mt-1 text-xs text-enterprise-600 dark:text-enterprise-400">
                      เที่ยวที่ {nextTripSequence2} ในวันนี้
                    </p>
                  )}
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

          {splitIntoThreeTrips && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 border border-enterprise-200 dark:border-enterprise-800 rounded-lg bg-enterprise-50/50 dark:bg-enterprise-900/10">
              <div className="space-y-3">
                <h4 className="font-medium text-gray-900 dark:text-gray-100">เที่ยวที่ 1</h4>
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
                      <option key={v.id} value={v.id}>{v.plate} {v.make ? `- ${v.make}` : ''} {v.model || ''}</option>
                    ))}
                  </select>
                  {nextTripSequence1 > 1 && <p className="mt-1 text-xs text-enterprise-600 dark:text-enterprise-400">เที่ยวที่ {nextTripSequence1} ในวันนี้</p>}
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">พนักงานขับรถ</label>
                  <select value={selectedDriverId} onChange={(e) => setSelectedDriverId(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" disabled={driversLoading}>
                    <option value="">-- เลือกพนักงาน --</option>
                    {filteredDrivers.map((d) => <option key={d.id} value={d.id}>{d.full_name}</option>)}
                  </select>
                </div>
              </div>
              <div className="space-y-3">
                <h4 className="font-medium text-gray-900 dark:text-gray-100">เที่ยวที่ 2</h4>
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
                      <option key={v.id} value={v.id}>{v.plate} {v.make ? `- ${v.make}` : ''} {v.model || ''}</option>
                    ))}
                  </select>
                  {nextTripSequence2 > 1 && <p className="mt-1 text-xs text-enterprise-600 dark:text-enterprise-400">เที่ยวที่ {nextTripSequence2} ในวันนี้</p>}
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">พนักงานขับรถ</label>
                  <select value={selectedDriverId2} onChange={(e) => setSelectedDriverId2(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" disabled={driversLoading}>
                    <option value="">-- เลือกพนักงาน --</option>
                    {filteredDrivers.map((d) => <option key={d.id} value={d.id}>{d.full_name}</option>)}
                  </select>
                </div>
              </div>
              <div className="space-y-3">
                <h4 className="font-medium text-gray-900 dark:text-gray-100">เที่ยวที่ 3</h4>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">รถ</label>
                  <select
                    value={selectedVehicleId3}
                    onChange={(e) => setSelectedVehicleId3?.(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    disabled={vehiclesLoading}
                  >
                    <option value="">-- เลือกรถ --</option>
                    {filteredVehicles.map((v: any) => (
                      <option key={v.id} value={v.id}>{v.plate} {v.make ? `- ${v.make}` : ''} {v.model || ''}</option>
                    ))}
                  </select>
                  {nextTripSequence3 > 1 && <p className="mt-1 text-xs text-enterprise-600 dark:text-enterprise-400">เที่ยวที่ {nextTripSequence3} ในวันนี้</p>}
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">พนักงานขับรถ</label>
                  <select value={selectedDriverId3} onChange={(e) => setSelectedDriverId3?.(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" disabled={driversLoading}>
                    <option value="">-- เลือกพนักงาน --</option>
                    {filteredDrivers.map((d) => <option key={d.id} value={d.id}>{d.full_name}</option>)}
                  </select>
                </div>
              </div>
            </div>
          )}

          <CrewAssignmentHelperPickers
            filterBranchCode={selectedBranch}
            splitIntoTwoTrips={splitIntoTwoTrips}
            splitIntoThreeTrips={splitIntoThreeTrips}
            selectedDriverId={selectedDriverId}
            selectedDriverId2={selectedDriverId2}
            selectedDriverId3={selectedDriverId3}
            helperStaffIds1={helperStaffIds1}
            setHelperStaffIds1={setHelperStaffIds1}
            helperStaffIds2={helperStaffIds2}
            setHelperStaffIds2={setHelperStaffIds2}
            helperStaffIds3={helperStaffIds3}
            setHelperStaffIds3={setHelperStaffIds3}
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
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
