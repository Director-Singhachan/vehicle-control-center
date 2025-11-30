import React from 'react';
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

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

interface VehicleUsageRankingData {
  vehicle_id: string;
  plate: string;
  make: string | null;
  model: string | null;
  branch: string | null;
  totalDistance: number;
  totalTrips: number;
  totalHours: number;
  averageDistance: number;
}

interface VehicleUsageRankingChartProps {
  data: VehicleUsageRankingData[];
  isDark: boolean;
  limit?: number;
}

export const VehicleUsageRankingChart: React.FC<VehicleUsageRankingChartProps> = ({
  data,
  isDark,
  limit = 10,
}) => {
  if (!data || data.length === 0) {
    return (
      <div className="h-96 w-full flex items-center justify-center text-slate-500 dark:text-slate-400">
        <div className="text-center">
          <p className="text-sm">ไม่มีข้อมูลการใช้งาน</p>
          <p className="text-xs mt-1">กรุณาเช็คอินการเดินทางเพื่อดูข้อมูล</p>
        </div>
      </div>
    );
  }

  // Sort by totalDistance and take top N
  const sortedData = [...data]
    .sort((a, b) => b.totalDistance - a.totalDistance)
    .slice(0, limit);

  const chartData = {
    labels: sortedData.map(v => v.plate),
    datasets: [
      {
        label: 'ระยะทางรวม (km)',
        data: sortedData.map(v => v.totalDistance),
        backgroundColor: isDark 
          ? 'rgba(139, 92, 246, 0.8)' 
          : 'rgba(124, 58, 237, 0.8)',
        borderRadius: 4,
      },
    ],
  };

  const options = {
    indexAxis: 'y' as const, // Horizontal bar chart
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
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
              `จำนวนเที่ยว: ${vehicle.totalTrips}`,
              `เวลารวม: ${vehicle.totalHours.toFixed(1)} ชม.`,
              `ระยะทางเฉลี่ย: ${vehicle.averageDistance.toFixed(1)} km`,
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
            return `${Number(value).toLocaleString('th-TH')} km`;
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
      },
    },
  };

  return (
    <div className="h-96 w-full">
      <Bar data={chartData} options={options} />
    </div>
  );
};

