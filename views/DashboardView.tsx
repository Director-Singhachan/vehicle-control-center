import React from 'react';
import {
  Truck,
  Activity,
  Wrench,
  DollarSign,
  MoreHorizontal,
  RefreshCw,
  FileText,
  Calendar
} from 'lucide-react';
import { StatusCard } from '../components/StatusCard';
import { UsageChart } from '../components/UsageChart';
import { MaintenanceTrendChart } from '../components/MaintenanceTrendChart';
import { VehicleStatusSection } from '../components/VehicleStatusSection';
import { ActivityFeed } from '../components/ActivityFeed';
import { ActiveTripsWidget } from '../components/ActiveTripsWidget';
import { PageLayout } from '../components/layout/PageLayout';
import { useDashboard } from '../hooks';

interface DashboardProps {
  isDark: boolean;
  onNavigateToTickets?: () => void;
  onNavigateToTicketDetail?: (ticketId: number) => void;
  onNavigateToTripLogs?: () => void;
  onCheckInTrip?: (tripId: string) => void;
}

export const DashboardView: React.FC<DashboardProps> = ({
  isDark,
  onNavigateToTickets,
  onNavigateToTicketDetail,
  onNavigateToTripLogs,
  onCheckInTrip,
}) => {
  const { data, loading, error, refetch } = useDashboard();

  // Debug logging
  React.useEffect(() => {
    console.log('[DashboardView] State:', {
      hasData: !!data,
      loading,
      hasError: !!error,
      hasSummary: !!data?.summary,
      hasFinancials: !!data?.financials,
    });
  }, [data, loading, error]);

  const { summary, financials, usageData, maintenanceTrends, vehicles, vehicleDashboard, recentTickets, pendingTicketsCount } = data || {};

  // Never show loading state - always show UI (even if empty or error)
  // This prevents infinite loading when API calls timeout or are slow
  // Data will appear when it's ready
  const showLoading = false; // Always false - never show loading spinner
  const showError = false; // Don't show error state - show UI with empty data instead

  return (
    <PageLayout
      title="ภาพรวมแดชบอร์ด"
      subtitle="ข้อมูลสถานะยานพาหนะและปฏิบัติการแบบเรียลไทม์"
      actions={
        <button onClick={refetch} className="p-2 text-slate-500 hover:text-enterprise-600 dark:hover:text-neon-blue transition-colors">
          <RefreshCw size={20} />
        </button>
      }
      loading={showLoading}
      error={showError}
      onRetry={refetch}
    >

      {/* Show error message if all API calls failed */}
      {error && !summary && !financials && !usageData && !maintenanceTrends && (
        <div className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-yellow-800 dark:text-yellow-200 font-semibold mb-1">
                ⚠️ ไม่สามารถโหลดข้อมูลได้
              </p>
              <p className="text-yellow-700 dark:text-yellow-300 text-sm">
                {error.message || 'กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ตหรือ VPN'}
              </p>
            </div>
            <button
              onClick={refetch}
              className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors text-sm"
            >
              ลองอีกครั้ง
            </button>
          </div>
        </div>
      )}

      {/* Show empty state if no data and no error */}
      {!error && !summary && !financials && !usageData && !maintenanceTrends && (
        <div className="mb-6 p-8 text-center bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-700">
          <p className="text-slate-600 dark:text-slate-400 mb-4">
            กำลังโหลดข้อมูล...
          </p>
          <div className="flex justify-center">
            <RefreshCw className="animate-spin text-slate-400" size={24} />
          </div>
        </div>
      )}

      {/* Status Cards Grid */}
      {summary && financials ? (
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
            title="ตั๋วรอดำเนินการ"
            value={pendingTicketsCount || 0}
            subValue="รอการอนุมัติ"
            icon={FileText}
            alert={(pendingTicketsCount || 0) > 0}
          />
          <StatusCard
            title="ค่าใช้จ่ายเดือนนี้"
            value={`฿${(financials.monthlyCost || 0).toLocaleString('th-TH')}`}
            icon={Calendar}
            subValue={`วันนี้: ฿${(financials.todayCost || 0).toLocaleString('th-TH')}`}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white/80 dark:bg-charcoal-900/50 backdrop-blur-md p-6 rounded-xl border border-slate-200 dark:border-slate-700/50">
            <div className="animate-pulse">
              <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/2 mb-2"></div>
              <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-1/3"></div>
            </div>
          </div>
          <div className="bg-white/80 dark:bg-charcoal-900/50 backdrop-blur-md p-6 rounded-xl border border-slate-200 dark:border-slate-700/50">
            <div className="animate-pulse">
              <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/2 mb-2"></div>
              <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-1/3"></div>
            </div>
          </div>
          <div className="bg-white/80 dark:bg-charcoal-900/50 backdrop-blur-md p-6 rounded-xl border border-slate-200 dark:border-slate-700/50">
            <div className="animate-pulse">
              <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/2 mb-2"></div>
              <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-1/3"></div>
            </div>
          </div>
          <div className="bg-white/80 dark:bg-charcoal-900/50 backdrop-blur-md p-6 rounded-xl border border-slate-200 dark:border-slate-700/50">
            <div className="animate-pulse">
              <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/2 mb-2"></div>
              <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-1/3"></div>
            </div>
          </div>
        </div>
      )}

      {/* Active Trips Widget */}
      <div className="mt-6">
        <ActiveTripsWidget 
          onCheckIn={onCheckInTrip}
          onTripClick={onNavigateToTripLogs ? () => onNavigateToTripLogs() : undefined}
        />
      </div>

      {/* Vehicle Status Section */}
      {vehicleDashboard && vehicleDashboard.length > 0 && (
        <div className="mt-6">
          <VehicleStatusSection vehicles={vehicleDashboard} isDark={isDark} />
        </div>
      )}

      {/* Charts Section */}
      {usageData && maintenanceTrends ? (
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
        </>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
          <div className="bg-white/80 dark:bg-charcoal-900/50 backdrop-blur-md p-6 rounded-xl border border-slate-200 dark:border-slate-700/50">
            <div className="animate-pulse">
              <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded w-1/3 mb-4"></div>
              <div className="h-64 bg-slate-200 dark:bg-slate-700 rounded"></div>
            </div>
          </div>
          <div className="bg-white/80 dark:bg-charcoal-900/50 backdrop-blur-md p-6 rounded-xl border border-slate-200 dark:border-slate-700/50">
            <div className="animate-pulse">
              <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded w-1/3 mb-4"></div>
              <div className="h-64 bg-slate-200 dark:bg-slate-700 rounded"></div>
            </div>
          </div>
        </div>
      )}

      {/* Activity Feed */}
      <div className="mt-6">
        <ActivityFeed 
          tickets={recentTickets} 
          isDark={isDark}
          onNavigateToTicket={onNavigateToTicketDetail}
        />
      </div>

    </PageLayout>
  );
};