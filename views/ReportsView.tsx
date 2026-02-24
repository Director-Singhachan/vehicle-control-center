// Reports View - Comprehensive reports and analytics
import React, { useState } from 'react';
import { Droplet, Route, Wrench, DollarSign, Truck, FileText, Package } from 'lucide-react';
import { PageLayout } from '../components/layout/PageLayout';

import { VehicleUsageReport } from './reports/VehicleUsageReport';
import { FuelConsumptionReport } from './reports/FuelConsumptionReport';
import { FuelReport } from './reports/FuelReport';
import { TripReport } from './reports/TripReport';
import { MaintenanceReport } from './reports/MaintenanceReport';
import { CostReport } from './reports/CostReport';
import { VehicleDocumentsReport } from './reports/VehicleDocumentsReport';
import { DeliveryReport } from './reports/DeliveryReport';
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

type ReportTab = 'fuel' | 'trip' | 'maintenance' | 'cost' | 'usage' | 'fuel-consumption' | 'delivery' | 'vehicle-documents';

export const ReportsView: React.FC<ReportsViewProps> = ({ isDark = false, onNavigateToStoreDetail }) => {
  const [activeTab, setActiveTab] = useState<ReportTab>('fuel');

  const {
    months,
    setMonths,
    filterPeriod,
    setFilterPeriod,
    selectedBranch,
    setSelectedBranch,
    customStartDate,
    setCustomStartDate,
    customEndDate,
    setCustomEndDate,
    branches,
    startDate,
    endDate,
    usageRankingOptions,
    fuelConsumptionOptions,
  } = useReportFilters();
  
  return (
    <PageLayout
      title="รายงานและการวิเคราะห์"
      subtitle="สรุปข้อมูลการใช้น้ำมัน การเดินทาง การซ่อมบำรุง และค่าใช้จ่าย"
      actions={
        <div className="flex items-center gap-3">
          <select
            value={months}
            onChange={(e) => setMonths(Number(e.target.value))}
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
      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200 dark:border-slate-700 mb-6">
        <button
          onClick={() => setActiveTab('fuel')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'fuel'
              ? 'border-b-2 border-enterprise-600 text-enterprise-600 dark:text-enterprise-400'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <Droplet className="inline-block w-4 h-4 mr-2" />
          รายงานน้ำมัน
        </button>
        <button
          onClick={() => setActiveTab('trip')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'trip'
              ? 'border-b-2 border-enterprise-600 text-enterprise-600 dark:text-enterprise-400'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <Route className="inline-block w-4 h-4 mr-2" />
          รายงานการเดินทาง
        </button>
        <button
          onClick={() => setActiveTab('maintenance')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'maintenance'
              ? 'border-b-2 border-enterprise-600 text-enterprise-600 dark:text-enterprise-400'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <Wrench className="inline-block w-4 h-4 mr-2" />
          รายงานการซ่อม
        </button>
        <button
          onClick={() => setActiveTab('cost')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'cost'
              ? 'border-b-2 border-enterprise-600 text-enterprise-600 dark:text-enterprise-400'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <DollarSign className="inline-block w-4 h-4 mr-2" />
          วิเคราะห์ค่าใช้จ่าย
        </button>
        <button
          onClick={() => setActiveTab('usage')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'usage'
              ? 'border-b-2 border-enterprise-600 text-enterprise-600 dark:text-enterprise-400'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <Truck className="inline-block w-4 h-4 mr-2" />
          รถที่ใช้งานเยอะที่สุด
        </button>
        <button
          onClick={() => setActiveTab('fuel-consumption')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'fuel-consumption'
              ? 'border-b-2 border-enterprise-600 text-enterprise-600 dark:text-enterprise-400'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <Droplet className="inline-block w-4 h-4 mr-2" />
          การเติมน้ำมันแต่ละคัน
        </button>
        <button
          onClick={() => setActiveTab('delivery')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'delivery'
              ? 'border-b-2 border-enterprise-600 text-enterprise-600 dark:text-enterprise-400'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <Package className="inline-block w-4 h-4 mr-2" />
          รายงานการส่งสินค้า
        </button>
        <button
          onClick={() => setActiveTab('vehicle-documents')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'vehicle-documents'
              ? 'border-b-2 border-enterprise-600 text-enterprise-600 dark:text-enterprise-400'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <FileText className="inline-block w-4 h-4 mr-2" />
          รายงานเอกสารรถ
        </button>
      </div>

      {/* Fuel Reports Tab */}
      {activeTab === 'fuel' && <FuelReport months={months} isDark={isDark} />}

      {/* Trip Reports Tab */}
      {activeTab === 'trip' && <TripReport months={months} isDark={isDark} />}

      {/* Maintenance Reports Tab */}
      {activeTab === 'maintenance' && <MaintenanceReport months={months} isDark={isDark} />}

      {/* Cost Analysis Tab */}
      {activeTab === 'cost' && <CostReport months={months} isDark={isDark} />}

      {/* Vehicle Usage Ranking Tab */}
      {activeTab === 'usage' && (
        <VehicleUsageReport
          isDark={isDark}
          filterPeriod={filterPeriod}
          setFilterPeriod={setFilterPeriod}
          selectedBranch={selectedBranch}
          setSelectedBranch={setSelectedBranch}
          customStartDate={customStartDate}
          setCustomStartDate={setCustomStartDate}
          customEndDate={customEndDate}
          setCustomEndDate={setCustomEndDate}
          branches={branches}
          usageRankingOptions={usageRankingOptions}
        />
      )}

      {/* Vehicle Fuel Consumption Tab */}
      {activeTab === 'fuel-consumption' && (
        <FuelConsumptionReport
          isDark={isDark}
          filterPeriod={filterPeriod}
          setFilterPeriod={setFilterPeriod}
          selectedBranch={selectedBranch}
          setSelectedBranch={setSelectedBranch}
          customStartDate={customStartDate}
          setCustomStartDate={setCustomStartDate}
          customEndDate={customEndDate}
          setCustomEndDate={setCustomEndDate}
          branches={branches}
          fuelConsumptionOptions={fuelConsumptionOptions}
        />
      )}

      {/* Delivery Reports Tab */}
      {activeTab === 'delivery' && (
        <DeliveryReport startDate={startDate} endDate={endDate} isDark={isDark} onNavigateToStoreDetail={onNavigateToStoreDetail} />
      )}

      {/* Vehicle Documents Reports Tab */}
      {activeTab === 'vehicle-documents' && (
        <VehicleDocumentsReport isDark={isDark} onNavigateToStoreDetail={onNavigateToStoreDetail} />
      )}
    </PageLayout>
  );
};



