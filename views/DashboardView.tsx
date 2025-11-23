import React from 'react';
import {
  Truck,
  Activity,
  Wrench,
  DollarSign,
  MoreHorizontal,
  RefreshCw
} from 'lucide-react';
import { StatusCard } from '../components/StatusCard';
import { UsageChart } from '../components/UsageChart';
import { MaintenanceTrendChart } from '../components/MaintenanceTrendChart';
import { MapWidget } from '../components/MapWidget';
import { PageLayout } from '../components/layout/PageLayout';
import { useDashboard } from '../hooks';

interface DashboardProps {
  isDark: boolean;
  onNavigateToTickets?: () => void;
  onNavigateToTicketDetail?: (ticketId: number) => void;
}

export const DashboardView: React.FC<DashboardProps> = ({ 
  isDark,
  onNavigateToTickets,
  onNavigateToTicketDetail,
}) => {
  const { data, loading, error, refetch } = useDashboard();

  const { summary, financials, usageData, maintenanceTrends, vehicles } = data;

  return (
    <PageLayout
      title="ภาพรวมแดชบอร์ด"
      subtitle="ข้อมูลสถานะยานพาหนะและปฏิบัติการแบบเรียลไทม์"
      actions={
        <button onClick={refetch} className="p-2 text-slate-500 hover:text-enterprise-600 dark:hover:text-neon-blue transition-colors">
          <RefreshCw size={20} />
        </button>
      }
      loading={loading}
      error={!!error || !summary || !financials || !usageData || !maintenanceTrends}
      onRetry={refetch}
    >

      {/* Status Cards Grid */}
      {summary && financials && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatusCard
            title="ยานพาหนะทั้งหมด"
            value={summary.total || 0}
            subValue={`${summary.idle || 0} คันว่างอยู่ขณะนี้`}
            icon={Truck}
          />
          <StatusCard
            title="ยานพาหนะที่ใช้งาน"
            value={summary.active || 0}
            subValue={`อัตราการใช้งาน ${summary.total > 0 ? Math.round(((summary.active || 0) / summary.total) * 100) : 0}%`}
            icon={Activity}
          />
          <StatusCard
            title="การซ่อมบำรุง"
            value={summary.maintenance || 0}
            subValue="ตั๋วความสำคัญสูง"
            icon={Wrench}
            alert={(summary.maintenance || 0) > 10}
          />
          <StatusCard
            title="ค่าใช้จ่ายวันนี้"
            value={`฿${(financials.todayCost || 0).toLocaleString('th-TH')}`}
            icon={DollarSign}
            trend={financials.costTrend || 0}
            trendLabel="เทียบกับเมื่อวาน"
          />
        </div>
      )}

      {/* Charts Section */}
      {usageData && maintenanceTrends && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
            {/* Usage Chart */}
            <div className="bg-white/80 dark:bg-charcoal-900/50 backdrop-blur-md p-6 rounded-xl border border-slate-200 dark:border-slate-700/50 shadow-sm hover:shadow-glow transition-all duration-300">
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-semibold text-slate-900 dark:text-white">อัตราการใช้งานยานพาหนะ</h3>
                <button className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                  <MoreHorizontal size={20} />
                </button>
              </div>
              <UsageChart data={usageData} isDark={isDark} />
            </div>

            {/* Maintenance Chart */}
            <div className="bg-white/80 dark:bg-charcoal-900/50 backdrop-blur-md p-6 rounded-xl border border-slate-200 dark:border-slate-700/50 shadow-sm hover:shadow-glow transition-all duration-300">
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-semibold text-slate-900 dark:text-white">ค่าใช้จ่ายการซ่อมบำรุง</h3>
                <button className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                  <MoreHorizontal size={20} />
                </button>
              </div>
              <MaintenanceTrendChart data={maintenanceTrends} isDark={isDark} />
            </div>
          </div>

          {/* Map Widget */}
          <div className="grid grid-cols-1 gap-6 mt-6">
            <div className="bg-white/80 dark:bg-charcoal-900/50 backdrop-blur-md p-6 rounded-xl border border-slate-200 dark:border-slate-700/50 shadow-sm min-h-[450px]">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold text-slate-900 dark:text-white">แผนที่ยานพาหนะแบบเรียลไทม์</h3>
                <div className="flex space-x-2">
                  <span className="text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 px-2 py-1 rounded-full flex items-center">
                    <span className="w-2 h-2 bg-green-500 rounded-full mr-1 animate-pulse"></span> สด
                  </span>
                </div>
              </div>
              <div className="h-96 w-full bg-slate-100 dark:bg-slate-900 rounded-lg overflow-hidden">
                <MapWidget vehicles={vehicles} isDark={isDark} />
              </div>
            </div>
          </div>
        </>
      )}

    </PageLayout>
  );
};