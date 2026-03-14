// ProductSummaryChart.tsx
// กราฟสรุปสินค้าตามหมวดหมู่ และตามรายการสินค้า (กรองหมวดหมู่ได้)
import React, { useMemo, useState } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';
import type { VehicleProductSummaryItem } from '../../services/vehicleTripUsageService';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

const CATEGORY_COLORS = [
  'rgba(59, 130, 246, 0.85)',   // blue
  'rgba(34, 197, 94, 0.85)',    // green
  'rgba(234, 179, 8, 0.85)',   // yellow
  'rgba(249, 115, 22, 0.85)',  // orange
  'rgba(168, 85, 247, 0.85)',  // purple
  'rgba(236, 72, 153, 0.85)',  // pink
  'rgba(20, 184, 166, 0.85)',  // teal
  'rgba(239, 68, 68, 0.85)',   // red
];

interface ProductSummaryChartProps {
  data: VehicleProductSummaryItem[];
  isDark: boolean;
  /** จำนวนรายการสินค้าสูงสุดในกราฟ Bar (เรียงจากมากไปน้อย) */
  productBarLimit?: number;
}

export const ProductSummaryChart: React.FC<ProductSummaryChartProps> = ({
  data,
  isDark,
  productBarLimit = 15,
}) => {
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const categories = useMemo(() => {
    const set = new Set<string>();
    data.forEach((p) => set.add(p.category || 'ไม่ระบุหมวดหมู่'));
    return Array.from(set).sort();
  }, [data]);

  const byCategory = useMemo(() => {
    const map = new Map<string, number>();
    data.forEach((p) => {
      const cat = p.category || 'ไม่ระบุหมวดหมู่';
      map.set(cat, (map.get(cat) ?? 0) + p.total_quantity);
    });
    return Array.from(map.entries())
      .map(([category, total_quantity]) => ({ category, total_quantity }))
      .sort((a, b) => b.total_quantity - a.total_quantity);
  }, [data]);

  const filteredProducts = useMemo(() => {
    if (categoryFilter === 'all') {
      return [...data].sort((a, b) => b.total_quantity - a.total_quantity).slice(0, productBarLimit);
    }
    return data
      .filter((p) => (p.category || 'ไม่ระบุหมวดหมู่') === categoryFilter)
      .sort((a, b) => b.total_quantity - a.total_quantity)
      .slice(0, productBarLimit);
  }, [data, categoryFilter, productBarLimit]);

  const doughnutData = useMemo(() => {
    if (byCategory.length === 0) return null;
    return {
      labels: byCategory.map((c) => c.category),
      datasets: [
        {
          data: byCategory.map((c) => c.total_quantity),
          backgroundColor: byCategory.map((_, i) => CATEGORY_COLORS[i % CATEGORY_COLORS.length]),
          borderColor: isDark ? 'rgba(15, 23, 42, 0.9)' : 'rgba(255,255,255,0.9)',
          borderWidth: 2,
        },
      ],
    };
  }, [byCategory, isDark]);

  const barData = useMemo(() => {
    if (filteredProducts.length === 0) return null;
    const labels = filteredProducts.map(
      (p) => p.product_name || p.product_code || p.product_id.slice(0, 8)
    );
    return {
      labels,
      datasets: [
        {
          label: 'จำนวน (ชิ้น)',
          data: filteredProducts.map((p) => p.total_quantity),
          backgroundColor: isDark
            ? 'rgba(124, 58, 237, 0.8)'
            : 'rgba(99, 102, 241, 0.8)',
          borderRadius: 4,
        },
      ],
    };
  }, [filteredProducts, isDark]);

  const tooltipBg = isDark ? '#0f172a' : '#ffffff';
  const tooltipBorder = isDark ? '#334155' : '#e2e8f0';
  const textColor = isDark ? '#94a3b8' : '#64748b';
  const gridColor = isDark ? '#334155' : '#e2e8f0';

  const doughnutOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right' as const,
          labels: { color: textColor, padding: 12 },
        },
        tooltip: {
          backgroundColor: tooltipBg,
          titleColor: isDark ? '#f1f5f9' : '#0f172a',
          bodyColor: textColor,
          borderColor: tooltipBorder,
          borderWidth: 1,
          callbacks: {
            label: (ctx: { raw: number; label: string }) => {
              const total = byCategory.reduce((s, c) => s + c.total_quantity, 0);
              const pct = total > 0 ? ((ctx.raw as number) / total * 100).toFixed(1) : '0';
              return ` ${ctx.label}: ${Number(ctx.raw).toLocaleString('th-TH')} ชิ้น (${pct}%)`;
            },
          },
        },
      },
    }),
    [isDark, textColor, tooltipBg, tooltipBorder, byCategory]
  );

  const barOptions = useMemo(
    () => ({
      indexAxis: 'y' as const,
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: tooltipBg,
          titleColor: isDark ? '#f1f5f9' : '#0f172a',
          bodyColor: textColor,
          borderColor: tooltipBorder,
          borderWidth: 1,
          callbacks: {
            label: (ctx: { raw: number }) =>
              ` จำนวน: ${Number(ctx.raw).toLocaleString('th-TH')} ชิ้น`,
          },
        },
      },
      scales: {
        x: {
          grid: { color: gridColor },
          ticks: {
            color: textColor,
            callback: (value: unknown) => `${Number(value).toLocaleString('th-TH')}`,
          },
        },
        y: {
          grid: { display: false },
          ticks: { color: textColor, maxRotation: 0, autoSkip: true },
        },
      },
    }),
    [isDark, textColor, tooltipBg, tooltipBorder, gridColor]
  );

  if (!data || data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-slate-500 dark:text-slate-400 text-sm">
        ไม่มีข้อมูลสินค้า
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* กราฟวงกลม: แยกตามหมวดหมู่ */}
      {byCategory.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
            สัดส่วนสินค้าแยกตามหมวดหมู่
          </h4>
          <div className="h-72 w-full max-w-md">
            {doughnutData && (
              <Doughnut data={doughnutData} options={doughnutOptions} />
            )}
          </div>
        </div>
      )}

      {/* กราฟแท่ง: รายการสินค้า + กรองหมวดหมู่ */}
      <div>
        <div className="flex flex-wrap items-center gap-3 mb-3">
          <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            จำนวนต่อรายการสินค้า
          </h4>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-1.5 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-enterprise-500"
          >
            <option value="all">ทุกหมวดหมู่</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
          {categoryFilter !== 'all' && (
            <span className="text-xs text-slate-500 dark:text-slate-400">
              แสดงสูงสุด {productBarLimit} รายการ
            </span>
          )}
        </div>
        <div className="h-96 w-full min-h-[240px]">
          {barData && filteredProducts.length > 0 ? (
            <Bar data={barData} options={barOptions} />
          ) : (
            <div className="h-full flex items-center justify-center text-slate-500 dark:text-slate-400 text-sm">
              {categoryFilter === 'all' ? 'ไม่มีข้อมูล' : `ไม่มีสินค้าในหมวด "${categoryFilter}"`}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
