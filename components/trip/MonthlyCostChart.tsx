// MonthlyCostChart.tsx
// กราฟต้นทุนรายเดือน (ค่าน้ำมัน + ค่าคอม)
import React, { useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import type { VehicleMonthlySummary } from '../../services/vehicleTripUsageService';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

interface MonthlyCostChartProps {
  data: VehicleMonthlySummary[];
  isDark: boolean;
  /** แสดงชุดรายได้และกำไร (ซ่อนไว้ได้) */
  showRevenueAndProfit?: boolean;
}

function formatMonthLabel(month: string) {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1, 1);
  return d.toLocaleDateString('th-TH', { month: 'short', year: '2-digit' });
}

export const MonthlyCostChart: React.FC<MonthlyCostChartProps> = ({ data, isDark, showRevenueAndProfit = false }) => {
  const chartData = useMemo(() => {
    const labels = data.map((r) => formatMonthLabel(r.month));
    const datasets: { label: string; data: number[]; backgroundColor: string | string[]; borderRadius: number }[] = [
      {
        label: 'ค่าน้ำมัน (บาท)',
        data: data.map((r) => r.fuel_cost),
        backgroundColor: isDark ? 'rgba(245, 158, 11, 0.8)' : 'rgba(251, 191, 36, 0.8)',
        borderRadius: 4,
      },
      {
        label: 'ค่าคอม (บาท)',
        data: data.map((r) => r.commission_cost),
        backgroundColor: isDark ? 'rgba(139, 92, 246, 0.8)' : 'rgba(124, 58, 237, 0.8)',
        borderRadius: 4,
      },
    ];
    if (showRevenueAndProfit) {
      datasets.push(
        {
          label: 'รายได้ (บาท)',
          data: data.map((r) => r.revenue ?? 0),
          backgroundColor: isDark ? 'rgba(34, 197, 94, 0.8)' : 'rgba(22, 163, 74, 0.8)',
          borderRadius: 4,
        },
        {
          label: 'กำไร (บาท)',
          data: data.map((r) => r.profit ?? 0),
          backgroundColor: data.map((r) =>
            (r.profit ?? 0) >= 0
              ? isDark ? 'rgba(34, 197, 94, 0.6)' : 'rgba(34, 197, 94, 0.7)'
              : isDark ? 'rgba(239, 68, 68, 0.6)' : 'rgba(220, 38, 38, 0.7)'
          ),
          borderRadius: 4,
        }
      );
    }
    return { labels, datasets };
  }, [data, isDark, showRevenueAndProfit]);

  const options = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top' as const,
          labels: {
            color: isDark ? '#94a3b8' : '#64748b',
          },
        },
        tooltip: {
          backgroundColor: isDark ? '#020617' : '#ffffff',
          titleColor: isDark ? '#f8fafc' : '#0f172a',
          bodyColor: isDark ? '#cbd5e1' : '#475569',
          borderColor: isDark ? '#334155' : '#e2e8f0',
          borderWidth: 1,
          callbacks: {
            afterBody: (items: { dataIndex: number }[]) => {
              if (items.length === 0) return [];
              const idx = items[0].dataIndex;
              const row = data[idx];
              if (!row) return [];
              const lines = [
                `ต้นทุนรวม: ฿${row.total_cost.toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
                `ทริป: ${row.trip_count} · ระยะทาง: ${row.total_distance_km.toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 1 })} กม.`,
              ];
              if (showRevenueAndProfit && row.revenue != null) {
                lines.push(`รายได้: ฿${row.revenue.toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`);
                lines.push(`กำไร/ขาดทุน: ฿${row.profit.toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`);
              }
              return lines;
            },
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            color: isDark ? '#94a3b8' : '#64748b',
            maxRotation: 45,
          },
        },
        y: {
          grid: {
            color: isDark ? '#334155' : '#e2e8f0',
          },
          ticks: {
            color: isDark ? '#94a3b8' : '#64748b',
            callback: (value: unknown) => (typeof value === 'number' ? `฿${(value / 1000).toFixed(0)}k` : value),
          },
        },
      },
    }),
    [data, isDark, showRevenueAndProfit]
  );

  if (!data || data.length === 0) {
    return (
      <div className="h-72 w-full flex items-center justify-center text-slate-500 dark:text-slate-400 text-sm">
        ไม่มีข้อมูลรายเดือน
      </div>
    );
  }

  return (
    <div className="h-72 w-full">
      <Bar data={chartData} options={options} />
    </div>
  );
};
