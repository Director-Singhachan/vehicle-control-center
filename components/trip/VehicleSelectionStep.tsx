import React from 'react';
import { Truck, Search, Building2 } from 'lucide-react';
import { Card } from '../ui/Card';
import { getBranchLabel } from '../../utils/branchLabels';
import { VehicleRecommendationPanel } from './VehicleRecommendationPanel';

export interface VehicleSelectionStepProps {
  splitIntoTwoTrips: boolean;
  /** AI recommendation panel (only when not split) */
  aiRecommendations: any[];
  aiLoading: boolean;
  aiError: Error | null;
  aiHasFetched: boolean;
  fetchRecommendations: () => void;
  handleAiSelectVehicle: (vehicleId: string) => void;
  selectedVehicleId: string;
  handleRequestAI: () => void;
  aiExtraLoading: boolean;
  aiExtraResult: { suggested_vehicle_id: string | null; reasoning: string | null; packing_tips: string | null; error?: string } | null;
  aiCooldownRemaining: number;
  /** Branch & search */
  selectedBranch: string;
  setSelectedBranch: (branch: string) => void;
  vehicleSearch: string;
  setVehicleSearch: (search: string) => void;
  branches: string[];
  vehiclesLoading: boolean;
  /** Vehicle select (when not split) */
  filteredVehicles: any[];
  setSelectedVehicleId: (id: string) => void;
}

export function VehicleSelectionStep({
  splitIntoTwoTrips,
  aiRecommendations,
  aiLoading,
  aiError,
  aiHasFetched,
  fetchRecommendations,
  handleAiSelectVehicle,
  selectedVehicleId,
  handleRequestAI,
  aiExtraLoading,
  aiExtraResult,
  aiCooldownRemaining,
  selectedBranch,
  setSelectedBranch,
  vehicleSearch,
  setVehicleSearch,
  branches,
  vehiclesLoading,
  filteredVehicles,
  setSelectedVehicleId,
}: VehicleSelectionStepProps) {
  return (
    <Card>
      <div className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">ข้อมูลทริป</h3>
        <div className="space-y-4">
          {!splitIntoTwoTrips && (
            <VehicleRecommendationPanel
              recommendations={aiRecommendations}
              loading={aiLoading}
              error={aiError}
              hasFetched={aiHasFetched}
              onSelectVehicle={handleAiSelectVehicle}
              selectedVehicleId={selectedVehicleId}
              onRefresh={fetchRecommendations}
              onRequestAI={handleRequestAI}
              aiLoading={aiExtraLoading}
              aiResult={aiExtraResult}
              aiCooldownRemaining={aiCooldownRemaining}
            />
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-600 mb-1">
                <Building2 className="w-3 h-3 inline mr-1" />
                สาขา
              </label>
              <select
                value={selectedBranch}
                onChange={(e) => setSelectedBranch(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                disabled={vehiclesLoading}
              >
                <option value="">ทุกสาขา</option>
                {branches.map((branch) => (
                  <option key={branch} value={branch}>
                    {getBranchLabel(branch)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">
                <Search className="w-3 h-3 inline mr-1" />
                ค้นหา (ทะเบียน/ยี่ห้อ/รุ่น)
              </label>
              <input
                type="text"
                value={vehicleSearch}
                onChange={(e) => setVehicleSearch(e.target.value)}
                placeholder="พิมพ์เพื่อค้นหา..."
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                disabled={vehiclesLoading}
              />
            </div>
          </div>

          {!splitIntoTwoTrips && (
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-700">
                <Truck className="w-4 h-4 inline mr-1" />
                เลือกรถ *
              </label>
              <select
                value={selectedVehicleId}
                onChange={(e) => setSelectedVehicleId(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                disabled={vehiclesLoading}
              >
                <option value="">
                  {vehiclesLoading
                    ? 'กำลังโหลด...'
                    : filteredVehicles.length === 0
                      ? 'ไม่พบรถที่ตรงกับเงื่อนไข'
                      : `-- เลือกรถ (${filteredVehicles.length} คัน) --`}
                </option>
                {filteredVehicles.map((vehicle: any) => (
                  <option key={vehicle.id} value={vehicle.id}>
                    {vehicle.plate} {vehicle.make ? `- ${vehicle.make}` : ''} {vehicle.model || ''} {vehicle.branch ? `[${vehicle.branch}]` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
