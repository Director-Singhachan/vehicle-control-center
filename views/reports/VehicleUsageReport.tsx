import React from 'react';
import { Card } from '../../components/ui/Card';
import { VehicleUsageRankingChart } from '../../components/VehicleUsageRankingChart';
import { ReportFilters } from './ReportFilters';
import { useVehicleUsageRanking } from '../../hooks/useReports';
import type { FilterPeriod } from '../../hooks/useReportFilters';

const formatNumber = (value: number, decimals: number = 1) => {
  return value.toFixed(decimals);
};

export interface VehicleUsageReportProps {
  isDark?: boolean;
  filterPeriod: FilterPeriod;
  setFilterPeriod: (value: FilterPeriod) => void;
  selectedBranch: string | null;
  setSelectedBranch: (value: string | null) => void;
  customStartDate: string;
  setCustomStartDate: (value: string) => void;
  customEndDate: string;
  setCustomEndDate: (value: string) => void;
  branches: string[];
  usageRankingOptions: { startDate: Date; endDate: Date; branch?: string; limit: number };
}

export const VehicleUsageReport: React.FC<VehicleUsageReportProps> = ({
  isDark = false,
  filterPeriod,
  setFilterPeriod,
  selectedBranch,
  setSelectedBranch,
  customStartDate,
  setCustomStartDate,
  customEndDate,
  setCustomEndDate,
  branches,
  usageRankingOptions,
}) => {
  const { data: vehicleUsageRanking, loading: usageRankingLoading } =
    useVehicleUsageRanking(usageRankingOptions);

  return (
    <div className="space-y-6">
      <ReportFilters
        filterPeriod={filterPeriod}
        setFilterPeriod={setFilterPeriod}
        selectedBranch={selectedBranch}
        setSelectedBranch={setSelectedBranch}
        customStartDate={customStartDate}
        setCustomStartDate={setCustomStartDate}
        customEndDate={customEndDate}
        setCustomEndDate={setCustomEndDate}
        branches={branches}
      />

      {/* Vehicle Usage Ranking Chart */}
      <Card>
        <div className="flex justify-between items-center mb-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              กราฟรถที่วิ่งเยอะที่สุด
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              เรียงตามระยะทางรวม (km) - แสดง 20 อันดับแรก
            </p>
          </div>
        </div>
        {usageRankingLoading ? (
          <div className="h-96 flex items-center justify-center text-slate-400">
            กำลังโหลด...
          </div>
        ) : (
          <VehicleUsageRankingChart
            data={vehicleUsageRanking || []}
            isDark={isDark}
            limit={20}
          />
        )}
      </Card>

      {/* Vehicle Usage Ranking Table */}
      {vehicleUsageRanking && vehicleUsageRanking.length > 0 && (
        <Card>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
            ตารางสรุปการใช้งาน
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">
                    อันดับ
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">
                    ทะเบียน
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">
                    ยี่ห้อ/รุ่น
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">
                    สาขา
                  </th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">
                    ระยะทางรวม (km)
                  </th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">
                    จำนวนเที่ยว
                  </th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">
                    เวลารวม (ชม.)
                  </th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">
                    ระยะทางเฉลี่ย (km)
                  </th>
                </tr>
              </thead>
              <tbody>
                {vehicleUsageRanking.map((vehicle, index) => (
                  <tr
                    key={vehicle.vehicle_id}
                    className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                  >
                    <td className="py-3 px-4 text-slate-900 dark:text-slate-100 font-medium">
                      {index === 0 && '🥇'}
                      {index === 1 && '🥈'}
                      {index === 2 && '🥉'}
                      {index > 2 && `${index + 1}.`}
                    </td>
                    <td className="py-3 px-4 text-slate-900 dark:text-slate-100 font-medium">
                      {vehicle.plate}
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                      {vehicle.make} {vehicle.model}
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                      {vehicle.branch || '-'}
                    </td>
                    <td className="py-3 px-4 text-right text-slate-900 dark:text-slate-100 font-semibold">
                      {formatNumber(vehicle.totalDistance, 0)}
                    </td>
                    <td className="py-3 px-4 text-right text-slate-900 dark:text-slate-100">
                      {vehicle.totalTrips}
                    </td>
                    <td className="py-3 px-4 text-right text-slate-900 dark:text-slate-100">
                      {formatNumber(vehicle.totalHours, 1)}
                    </td>
                    <td className="py-3 px-4 text-right text-slate-900 dark:text-slate-100">
                      {formatNumber(vehicle.averageDistance, 1)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
};
