import React from 'react';
import { Card } from '../../components/ui/Card';
import { VehicleFuelConsumptionChart } from '../../components/VehicleFuelConsumptionChart';
import { ReportFilters } from './ReportFilters';
import { useVehicleFuelConsumption } from '../../hooks/useReports';
import type { FilterPeriod } from '../../hooks/useReportFilters';

const formatNumber = (value: number, decimals: number = 1) => {
  return value.toFixed(decimals);
};

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

export interface FuelConsumptionReportProps {
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
  fuelConsumptionOptions: { startDate: Date; endDate: Date; branch?: string };
}

export const FuelConsumptionReport: React.FC<FuelConsumptionReportProps> = ({
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
  fuelConsumptionOptions,
}) => {
  const { data: vehicleFuelConsumption, loading: fuelConsumptionLoading } =
    useVehicleFuelConsumption(fuelConsumptionOptions);

  const sortedData = React.useMemo(() => {
    if (!vehicleFuelConsumption || vehicleFuelConsumption.length === 0) return [];
    return [...vehicleFuelConsumption].sort((a, b) => b.totalCost - a.totalCost);
  }, [vehicleFuelConsumption]);

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

      {/* Vehicle Fuel Consumption Chart */}
      <Card>
        <div className="flex justify-between items-center mb-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              กราฟการเติมน้ำมันของแต่ละคัน
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              แสดงค่าใช้จ่ายและอัตราการบริโภคน้ำมัน (km/L)
            </p>
          </div>
        </div>
        {fuelConsumptionLoading ? (
          <div className="h-96 flex items-center justify-center text-slate-400">
            กำลังโหลด...
          </div>
        ) : (
          <VehicleFuelConsumptionChart
            data={vehicleFuelConsumption || []}
            isDark={isDark}
            showEfficiency={true}
            limit={20}
          />
        )}
      </Card>

      {/* Vehicle Fuel Consumption Table */}
      {vehicleFuelConsumption && vehicleFuelConsumption.length > 0 && (
        <Card>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
            ตารางสรุปการเติมน้ำมัน
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
                    รวมลิตร
                  </th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">
                    ค่าใช้จ่าย (฿)
                  </th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">
                    จำนวนครั้ง
                  </th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">
                    ประสิทธิภาพ (km/L)
                  </th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">
                    ราคาเฉลี่ย (฿/L)
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedData.map((vehicle, index) => (
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
                    <td className="py-3 px-4 text-right text-slate-900 dark:text-slate-100">
                      {formatNumber(vehicle.totalLiters, 2)}
                    </td>
                    <td className="py-3 px-4 text-right text-slate-900 dark:text-slate-100 font-semibold">
                      {formatCurrency(vehicle.totalCost)}
                    </td>
                    <td className="py-3 px-4 text-right text-slate-600 dark:text-slate-400">
                      {vehicle.fillCount}
                    </td>
                    <td className="py-3 px-4 text-right text-slate-900 dark:text-slate-100">
                      {vehicle.averageEfficiency
                        ? formatNumber(vehicle.averageEfficiency, 2)
                        : '-'}
                    </td>
                    <td className="py-3 px-4 text-right text-slate-600 dark:text-slate-400">
                      {formatNumber(vehicle.averagePricePerLiter, 2)}
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
