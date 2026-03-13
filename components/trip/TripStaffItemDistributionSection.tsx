// TripStaffItemDistributionSection.tsx
// แสดงการแบ่งสินค้าตามพนักงานในทริป — lazy load เมื่อ tripId เปลี่ยน
import React, { useState, useEffect } from 'react';
import { Users, RefreshCw } from 'lucide-react';
import { tripHistoryAggregatesService } from '../../services/deliveryTrip/tripHistoryAggregatesService';

interface TripStaffItemDistributionSectionProps {
  tripId: string;
  isDark?: boolean;
}

const ROLE_LABEL: Record<string, string> = {
  driver: 'คนขับ',
  helper: 'ลูกมือ',
};

export const TripStaffItemDistributionSection: React.FC<TripStaffItemDistributionSectionProps> = ({
  tripId,
  isDark = false,
}) => {
  const [distribution, setDistribution] = useState<Awaited<ReturnType<typeof tripHistoryAggregatesService.getStaffItemDistribution>>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tripId) return;
    let cancelled = false;

    const fetchDistribution = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await tripHistoryAggregatesService.getStaffItemDistribution(tripId);
        if (!cancelled) setDistribution(data);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'โหลดข้อมูลพนักงานไม่สำเร็จ');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchDistribution();
    return () => { cancelled = true; };
  }, [tripId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6 text-slate-500 dark:text-slate-400 gap-2">
        <RefreshCw size={16} className="animate-spin" />
        <span>กำลังโหลดข้อมูลพนักงาน...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-4 text-sm text-red-500 dark:text-red-400">{error}</div>
    );
  }

  if (distribution.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-slate-500 dark:text-slate-400">
        <Users size={28} className="mb-2 text-slate-400 dark:text-slate-600" />
        <p className="text-sm">ไม่มีข้อมูลการแบ่งสินค้าในทริปนี้</p>
        <p className="text-xs text-slate-400 dark:text-slate-600 mt-1">
          (อาจเป็นทริปที่ไม่ใช่ delivery trip)
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60">
            <th className="text-left py-2 px-3 text-slate-700 dark:text-slate-300 font-medium">ชื่อพนักงาน</th>
            <th className="text-left py-2 px-3 text-slate-700 dark:text-slate-300 font-medium">บทบาท</th>
            <th className="text-right py-2 px-3 text-slate-700 dark:text-slate-300 font-medium">ชิ้นงานที่ถือ</th>
            <th className="text-right py-2 px-3 text-slate-700 dark:text-slate-300 font-medium">ต่อคน (เฉลี่ย)</th>
            <th className="text-right py-2 px-3 text-slate-700 dark:text-slate-300 font-medium">SKU</th>
            <th className="text-right py-2 px-3 text-slate-700 dark:text-slate-300 font-medium">ร้านค้า</th>
          </tr>
        </thead>
        <tbody>
          {distribution.map((staff) => (
            <tr
              key={staff.crew_id}
              className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40"
            >
              <td className="py-2 px-3 text-slate-900 dark:text-slate-100 font-medium">
                {staff.staff_name}
              </td>
              <td className="py-2 px-3">
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                    staff.staff_role === 'driver'
                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                      : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                  }`}
                >
                  {ROLE_LABEL[staff.staff_role] ?? staff.staff_role}
                </span>
              </td>
              <td className="py-2 px-3 text-right text-slate-900 dark:text-slate-100 font-semibold">
                {staff.total_items_to_carry.toLocaleString('th-TH')}
              </td>
              <td className="py-2 px-3 text-right text-slate-600 dark:text-slate-400">
                {staff.total_items_per_staff.toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 1 })}
              </td>
              <td className="py-2 px-3 text-right text-slate-600 dark:text-slate-400">
                {staff.distinct_product_count}
              </td>
              <td className="py-2 px-3 text-right text-slate-600 dark:text-slate-400">
                {staff.distinct_store_count}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40">
            <td colSpan={2} className="py-2 px-3 text-slate-700 dark:text-slate-300 font-medium text-sm">
              รวม {distribution.length} คน
            </td>
            <td className="py-2 px-3 text-right text-slate-900 dark:text-slate-100 font-bold">
              {distribution.reduce((s, d) => s + d.total_items_to_carry, 0).toLocaleString('th-TH')}
            </td>
            <td colSpan={3} />
          </tr>
        </tfoot>
      </table>
    </div>
  );
};
