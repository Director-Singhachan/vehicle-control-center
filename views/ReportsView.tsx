// Reports View - Tab orchestrator for all report types
import React, { useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Droplet, Route, Wrench, DollarSign, Truck, FileText, Package, MapPin } from 'lucide-react';
import { PageLayout } from '../components/layout/PageLayout';

import { VehicleUsageReport } from './reports/VehicleUsageReport';
import { FuelConsumptionReport } from './reports/FuelConsumptionReport';
import { FuelReport } from './reports/FuelReport';
import { TripReport } from './reports/TripReport';
import { MaintenanceReport } from './reports/MaintenanceReport';
import { CostReport } from './reports/CostReport';
import { VehicleDocumentsReport } from './reports/VehicleDocumentsReport';
import { DeliveryReport } from './reports/DeliveryReport';
import { VehicleTripUsageReport } from './reports/VehicleTripUsageReport';
import { useReportFilters } from '../hooks/useReportFilters';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface ReportsViewProps {
  isDark?: boolean;
  onNavigateToStoreDetail?: (storeId: string) => void;
}

type ReportTab = 'fuel' | 'trip' | 'maintenance' | 'cost' | 'usage' | 'fuel-consumption' | 'delivery' | 'vehicle-documents' | 'vehicle-trip-usage';

const TAB_CONFIG: { id: ReportTab; label: string; Icon: LucideIcon }[] = [
  { id: 'fuel', label: 'รายงานน้ำมัน', Icon: Droplet },
  { id: 'trip', label: 'รายงานการเดินทาง', Icon: Route },
  { id: 'maintenance', label: 'รายงานการซ่อม', Icon: Wrench },
  { id: 'cost', label: 'วิเคราะห์ค่าใช้จ่าย', Icon: DollarSign },
  { id: 'usage', label: 'รถที่ใช้งานเยอะที่สุด', Icon: Truck },
  { id: 'fuel-consumption', label: 'การเติมน้ำมันแต่ละคัน', Icon: Droplet },
  { id: 'delivery', label: 'รายงานการส่งสินค้า', Icon: Package },
  { id: 'vehicle-documents', label: 'รายงานเอกสารรถ', Icon: FileText },
  { id: 'vehicle-trip-usage', label: 'รายงานการใช้รถละเอียด', Icon: MapPin },
];

export const ReportsView: React.FC<ReportsViewProps> = ({ isDark = false, onNavigateToStoreDetail }) => {
  const [activeTab, setActiveTab] = useState<ReportTab>('fuel');

  const filters = useReportFilters();

  return (
    <PageLayout
      title="รายงานและการวิเคราะห์"
      subtitle="สรุปข้อมูลการใช้น้ำมัน การเดินทาง การซ่อมบำรุง และค่าใช้จ่าย"
      actions={
        <div className="flex items-center gap-3">
          <select
            value={filters.months}
            onChange={(e) => filters.setMonths(Number(e.target.value))}
            className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
          >
            <option value={1}>1 เดือนล่าสุด</option>
            <option value={3}>3 เดือนล่าสุด</option>
            <option value={6}>6 เดือนล่าสุด</option>
            <option value={12}>12 เดือนล่าสุด</option>
          </select>
        </div>
      }
    >
      <div className="flex gap-2 border-b border-slate-200 dark:border-slate-700 mb-6">
        {TAB_CONFIG.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === id
                ? 'border-b-2 border-enterprise-600 text-enterprise-600 dark:text-enterprise-400'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Icon className="inline-block w-4 h-4 mr-2" />
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'fuel' && <FuelReport months={filters.months} isDark={isDark} />}
      {activeTab === 'trip' && <TripReport months={filters.months} isDark={isDark} />}
      {activeTab === 'maintenance' && <MaintenanceReport months={filters.months} isDark={isDark} />}
      {activeTab === 'cost' && <CostReport months={filters.months} isDark={isDark} />}
      {activeTab === 'usage' && (
        <VehicleUsageReport
          isDark={isDark}
          filterPeriod={filters.filterPeriod}
          setFilterPeriod={filters.setFilterPeriod}
          selectedBranch={filters.selectedBranch}
          setSelectedBranch={filters.setSelectedBranch}
          customStartDate={filters.customStartDate}
          setCustomStartDate={filters.setCustomStartDate}
          customEndDate={filters.customEndDate}
          setCustomEndDate={filters.setCustomEndDate}
          branches={filters.branches}
          usageRankingOptions={filters.usageRankingOptions}
        />
      )}
      {activeTab === 'fuel-consumption' && (
        <FuelConsumptionReport
          isDark={isDark}
          filterPeriod={filters.filterPeriod}
          setFilterPeriod={filters.setFilterPeriod}
          selectedBranch={filters.selectedBranch}
          setSelectedBranch={filters.setSelectedBranch}
          customStartDate={filters.customStartDate}
          setCustomStartDate={filters.setCustomStartDate}
          customEndDate={filters.customEndDate}
          setCustomEndDate={filters.setCustomEndDate}
          branches={filters.branches}
          fuelConsumptionOptions={filters.fuelConsumptionOptions}
        />
      )}
      {activeTab === 'delivery' && (
        <DeliveryReport
          startDate={filters.startDate}
          endDate={filters.endDate}
          isDark={isDark}
          onNavigateToStoreDetail={onNavigateToStoreDetail}
        />
      )}
      {activeTab === 'vehicle-documents' && (
        <VehicleDocumentsReport isDark={isDark} onNavigateToStoreDetail={onNavigateToStoreDetail} />
      )}
      {activeTab === 'vehicle-trip-usage' && (
        <VehicleTripUsageReport isDark={isDark} />
      )}
    </PageLayout>
  );
};



