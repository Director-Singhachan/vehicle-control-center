import React from 'react';
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
  BarController,
  LineController,
} from 'chart.js';
import { Chart } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
  BarController,
  LineController
);

interface VehicleFuelConsumptionData {
  vehicle_id: string;
  plate: string;
  make: string | null;
  model: string | null;
  branch: string | null;
  totalLiters: number;
  totalCost: number;
  fillCount: number;
  averageEfficiency: number | null;
  averagePricePerLiter: number;
}

interface VehicleFuelConsumptionChartProps {
  data: VehicleFuelConsumptionData[];
  isDark: boolean;
  showEfficiency?: boolean;
  limit?: number;
}

export const VehicleFuelConsumptionChart: React.FC<VehicleFuelConsumptionChartProps> = ({
  data,
  isDark,
  showEfficiency = true,
  limit = 10,
}) => {
  if (!data || data.length === 0) {
    return (
      <div className="h-96 w-full flex items-center justify-center text-slate-500 dark:text-slate-400">
        <div className="text-center">
          <p className="text-sm">ไม่มีข้อมูลการเติมน้ำมัน</p>
          <p className="text-xs mt-1">กรุณาเพิ่มข้อมูลการเติมน้ำมันเพื่อดูข้อมูล</p>
        </div>
      </div>
    );
  }

  // Sort by totalCost and take top N
  const sortedData = [...data]
    .sort((a, b) => b.totalCost - a.totalCost)
    .slice(0, limit);

  const chartData = {
    labels: sortedData.map(v => v.plate),
    datasets: [
      {
        label: 'ค่าใช้จ่าย (฿)',
        data: sortedData.map(v => v.totalCost),
        backgroundColor: isDark 
          ? 'rgba(139, 92, 246, 0.8)' 
          : 'rgba(124, 58, 237, 0.8)',
        borderRadius: 4,
        yAxisID: 'y',
      },
      ...(showEfficiency ? [{
        label: 'ประสิทธิภาพ (km/L)',
        data: sortedData.map(v => v.averageEfficiency || 0),
        type: 'line' as const,
        borderColor: isDark ? '#10b981' : '#059669',
        backgroundColor: 'transparent',
        borderWidth: 2,
        yAxisID: 'y1',
      }] : []),
    ],
  };

  const options = {
    indexAxis: 'y' as const, // Horizontal bar chart
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'top' as const,
        labels: {
          color: isDark ? '#cbd5e1' : '#475569',
        },
      },
      tooltip: {
        backgroundColor: isDark ? '#020617' : '#ffffff',
        titleColor: isDark ? '#f8fafc' : '#0f172a',
        bodyColor: isDark ? '#cbd5e1' : '#475569',
        borderColor: isDark ? '#334155' : '#e2e8f0',
        borderWidth: 1,
        callbacks: {
          afterLabel: (context: any) => {
            const vehicle = sortedData[context.dataIndex];
            return [
              `จำนวนลิตร: ${vehicle.totalLiters.toFixed(2)} L`,
              `จำนวนครั้ง: ${vehicle.fillCount}`,
              vehicle.averageEfficiency 
                ? `ประสิทธิภาพ: ${vehicle.averageEfficiency.toFixed(2)} km/L`
                : 'ประสิทธิภาพ: -',
              `ราคาเฉลี่ย: ${vehicle.averagePricePerLiter.toFixed(2)} ฿/L`,
              vehicle.branch ? `สาขา: ${vehicle.branch}` : '',
            ].filter(Boolean);
          },
        },
      },
    },
    scales: {
      x: {
        grid: {
          color: isDark ? '#334155' : '#e2e8f0',
        },
        ticks: {
          color: isDark ? '#94a3b8' : '#64748b',
          callback: (value: any) => {
            return `฿${Number(value).toLocaleString('th-TH')}`;
          },
        },
      },
      y: {
        grid: {
          display: false,
        },
        ticks: {
          color: isDark ? '#94a3b8' : '#64748b',
        },
        position: 'left' as const,
      },
      ...(showEfficiency ? {
        y1: {
          type: 'linear' as const,
          display: true,
          position: 'right' as const,
          grid: {
            drawOnChartArea: false,
          },
          ticks: {
            color: isDark ? '#10b981' : '#059669',
            callback: (value: any) => {
              return `${Number(value).toFixed(1)} km/L`;
            },
          },
        },
      } : {}),
    },
  };

  return (
    <div className="h-96 w-full">
      <Chart type="bar" data={chartData as any} options={options} />
    </div>
  );
};

