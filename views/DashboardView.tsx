import React, { useEffect, useState } from 'react';
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
import { vehicleService, ticketService, vehicleUsageService, reportsService, Vehicle } from '../services';

interface DashboardProps {
  isDark: boolean;
}

export const DashboardView: React.FC<DashboardProps> = ({ isDark }) => {
  const [summary, setSummary] = useState<any>(null);
  const [financials, setFinancials] = useState<any>(null);
  const [usageData, setUsageData] = useState<any>(null);
  const [maintData, setMaintData] = useState<any>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    setError(false);
    try {
      const [sum, fin, use, maint, veh] = await Promise.all([
        vehicleService.getSummary(),
        reportsService.getFinancials(),
        vehicleUsageService.getDailyUsage(),
        reportsService.getMaintenanceTrends(),
        vehicleService.getLocations()
      ]);

      setSummary(sum);
      setFinancials(fin);
      setUsageData(use);
      setMaintData(maint);
      setVehicles(veh);
    } catch (e) {
      console.error("Error fetching dashboard data", e);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <PageLayout
      title="Dashboard Overview"
      subtitle="Real-time fleet telemetry and operational status."
      actions={
        <button onClick={fetchData} className="p-2 text-slate-500 hover:text-enterprise-600 dark:hover:text-neon-blue transition-colors">
          <RefreshCw size={20} />
        </button>
      }
      loading={loading}
      error={error || !summary || !financials || !usageData || !maintData}
      onRetry={fetchData}
    >

      {/* Status Cards Grid */}
      {summary && financials && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatusCard 
            title="Total Vehicles" 
            value={summary.total} 
            subValue={`${summary.idle} Idle currently`}
            icon={Truck} 
            trend={1.2} 
            trendLabel="added this month"
          />
          <StatusCard 
            title="Active Fleet" 
            value={summary.active} 
            subValue={`${Math.round((summary.active / summary.total) * 100)}% utilization`}
            icon={Activity} 
            trend={5.4} 
          />
          <StatusCard 
            title="Maintenance" 
            value={summary.maintenance} 
            subValue="High priority tickets"
            icon={Wrench} 
            alert={summary.maintenance > 10}
          />
          <StatusCard 
            title="Today's Revenue" 
            value={`$${financials.todayRevenue.toLocaleString()}`} 
            icon={DollarSign} 
            trend={financials.revenueTrend}
          />
        </div>
      )}

      {/* Charts Section */}
      {usageData && maintData && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Usage Chart */}
            <div className="bg-white dark:bg-charcoal-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-semibold text-slate-900 dark:text-white">Fleet Utilization</h3>
                <button className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                  <MoreHorizontal size={20} />
                </button>
              </div>
              <UsageChart data={usageData} isDark={isDark} />
            </div>

            {/* Maintenance Chart */}
            <div className="bg-white dark:bg-charcoal-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-semibold text-slate-900 dark:text-white">Maintenance Costs</h3>
                <button className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                  <MoreHorizontal size={20} />
                </button>
              </div>
              <MaintenanceTrendChart data={maintData} isDark={isDark} />
            </div>
          </div>

          {/* Map Widget */}
          <div className="grid grid-cols-1 gap-6">
            <div className="bg-white dark:bg-charcoal-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm min-h-[450px]">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold text-slate-900 dark:text-white">Live Fleet Map</h3>
                <div className="flex space-x-2">
                   <span className="text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 px-2 py-1 rounded-full flex items-center">
                     <span className="w-2 h-2 bg-green-500 rounded-full mr-1 animate-pulse"></span> Live
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