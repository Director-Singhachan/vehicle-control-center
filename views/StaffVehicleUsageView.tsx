import React from 'react';
import { ArrowLeft, Calendar, RefreshCw } from 'lucide-react';
import { PageLayout } from '../components/layout/PageLayout';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import {
  staffVehicleUsageService,
  type StaffVehicleUsageSummary,
  type StaffVehicleUsageTripRow,
} from '../services/staffVehicleUsageService';
import { serviceStaffService } from '../services/serviceStaffService';
import { StaffVehicleUsageCard } from '../components/staff/StaffVehicleUsageCard';
import { StaffTripHistoryTable } from '../components/staff/StaffTripHistoryTable';

interface StaffVehicleUsageViewProps {
  staffId: string;
  onBack?: () => void;
  initialState?: {
    from?: string;
    to?: string;
    page?: number;
    scrollY?: number;
  };
  onViewTrip?: (
    tripId: string,
    state: { from: string; to: string; page: number; scrollY: number }
  ) => void;
}

const toISODate = (d: Date) => {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const toStartOfDayISO = (dateStr: string) => {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1, 0, 0, 0, 0);
  return dt.toISOString();
};

const toEndOfDayISO = (dateStr: string) => {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1, 23, 59, 59, 999);
  return dt.toISOString();
};

export const StaffVehicleUsageView: React.FC<StaffVehicleUsageViewProps> = ({
  staffId,
  onBack,
  initialState,
  onViewTrip,
}) => {
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [staffName, setStaffName] = React.useState<string>('');

  const [from, setFrom] = React.useState<string>(() => {
    if (initialState?.from) return initialState.from;
    const d = new Date();
    d.setMonth(d.getMonth() - 3);
    return toISODate(d);
  });
  const [to, setTo] = React.useState<string>(() => initialState?.to || toISODate(new Date()));

  const PAGE_SIZE = 50;
  const [page, setPage] = React.useState<number>(() => {
    const p = initialState?.page;
    return typeof p === 'number' && Number.isFinite(p) && p > 0 ? Math.floor(p) : 1;
  });
  const didInitRef = React.useRef(false);
  const didRestoreScrollRef = React.useRef(false);

  const [summary, setSummary] = React.useState<StaffVehicleUsageSummary | null>(null);
  const [trips, setTrips] = React.useState<StaffVehicleUsageTripRow[]>([]);

  const load = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      if (from && to && from > to) {
        setError('ช่วงเวลาไม่ถูกต้อง: วันที่เริ่มต้นต้องไม่มากกว่าวันที่สิ้นสุด');
        setSummary(null);
        setTrips([]);
        return;
      }

      const staff = await serviceStaffService.getById(staffId);
      setStaffName(staff?.name || '');

      const result = await staffVehicleUsageService.getStaffVehicleUsage(staffId, {
        from: from ? toStartOfDayISO(from) : undefined,
        to: to ? toEndOfDayISO(to) : undefined,
        limit: 300,
      });

      setSummary(result.summary);
      setTrips(result.trips);
    } catch (e: any) {
      console.error('[StaffVehicleUsageView] Error:', e);
      setError(e?.message || 'ไม่สามารถโหลดข้อมูลสรุปการเดินทางของพนักงานได้');
      setSummary(null);
      setTrips([]);
    } finally {
      setLoading(false);
    }
  }, [staffId, from, to]);

  React.useEffect(() => {
    load();
  }, [load]);

  // Reset page when filters change (but keep initial restore)
  React.useEffect(() => {
    if (!didInitRef.current) {
      didInitRef.current = true;
      return;
    }
    setPage(1);
  }, [staffId, from, to]);

  React.useEffect(() => {
    if (didRestoreScrollRef.current) return;
    const y = initialState?.scrollY;
    if (typeof y !== 'number' || !Number.isFinite(y) || y < 0) return;
    didRestoreScrollRef.current = true;
    requestAnimationFrame(() => window.scrollTo({ top: y || 0, behavior: 'auto' }));
  }, [initialState?.scrollY]);

  return (
    <PageLayout
      title={staffName ? `สรุปการเดินทาง: ${staffName}` : 'สรุปการเดินทางของพนักงาน'}
      subtitle="สรุปและประวัติการเข้าร่วมทริปของพนักงาน"
      actions={
        <div className="flex items-center gap-2">
          {onBack && (
            <Button variant="outline" onClick={onBack}>
              <ArrowLeft size={18} className="mr-2" />
              กลับ
            </Button>
          )}
          <Button variant="outline" onClick={load} isLoading={loading}>
            <RefreshCw size={18} className="mr-2" />
            รีเฟรช
          </Button>
        </div>
      }
    >
      <Card className="p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Calendar size={18} className="text-slate-500" />
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">ช่วงเวลา</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">เริ่มต้น</label>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              max={to || undefined}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">สิ้นสุด</label>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              min={from || undefined}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
            />
          </div>
          <div className="flex items-end lg:col-span-2">
            <Button onClick={load} isLoading={loading} className="w-full">ค้นหา</Button>
          </div>
        </div>
      </Card>

      {error && (
        <Card className="p-6 mb-6">
          <div className="text-red-600 dark:text-red-400">{error}</div>
        </Card>
      )}

      {summary && <StaffVehicleUsageCard summary={summary} />}

      <div className="mt-6">
        <StaffTripHistoryTable
          trips={trips}
          page={page}
          pageSize={PAGE_SIZE}
          onPageChange={(next) => setPage(next)}
          onViewTrip={
            onViewTrip
              ? (tripId) => {
                  onViewTrip(tripId, {
                    from,
                    to,
                    page,
                    scrollY: window.scrollY || 0,
                  });
                }
              : undefined
          }
        />
      </div>
    </PageLayout>
  );
};
