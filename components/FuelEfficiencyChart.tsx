// Fuel Efficiency Chart - Display km/L over time
import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { Card } from './ui/Card';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface FuelEfficiencyData {
  date: string;
  efficiency: number;
  vehicle_plate?: string;
}

interface FuelEfficiencyChartProps {
  data: FuelEfficiencyData[];
  vehicleId?: string;
  isDark?: boolean;
}

export const FuelEfficiencyChart: React.FC<FuelEfficiencyChartProps> = ({
  data,
  vehicleId,
  isDark = false,
}) => {
  // Format data for chart
  const labels = data.map((item) =>
    new Date(item.date).toLocaleDateString('th-TH', { month: 'short', day: 'numeric' })
  );
  const efficiencyData = data.map((item) => Number(item.efficiency) || 0);

  const chartData = {
    labels,
    datasets: [
      {
        label: 'ประสิทธิภาพ (km/L)',
        data: efficiencyData,
        borderColor: isDark ? '#3b82f6' : '#2563eb',
        backgroundColor: isDark ? 'rgba(59, 130, 246, 0.1)' : 'rgba(37, 99, 235, 0.1)',
        borderWidth: 2,
        tension: 0.4,
        fill: true,
        pointBackgroundColor: isDark ? '#3b82f6' : '#2563eb',
        pointBorderColor: isDark ? '#1e40af' : '#1e3a8a',
        pointBorderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 6,
      },
    ],
  };

  const options = {
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
        mode: 'index' as const,
        intersect: false,
        backgroundColor: isDark ? '#1e293b' : '#ffffff',
        titleColor: isDark ? '#f8fafc' : '#0f172a',
        bodyColor: isDark ? '#cbd5e1' : '#475569',
        borderColor: isDark ? '#334155' : '#e2e8f0',
        borderWidth: 1,
        callbacks: {
          label: (context: any) => {
            return `${context.dataset.label}: ${context.parsed.y.toFixed(2)} km/L`;
          },
        },
      },
    },
    scales: {
      x: {
        grid: {
          display: false,
          drawBorder: false,
        },
        ticks: {
          color: isDark ? '#94a3b8' : '#64748b',
        },
      },
      y: {
        beginAtZero: false,
        grid: {
          color: isDark ? '#334155' : '#e2e8f0',
        },
        ticks: {
          color: isDark ? '#94a3b8' : '#64748b',
          callback: (value: any) => `${value} km/L`,
        },
      },
    },
  };

  if (data.length === 0) {
    return (
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
          กราฟประสิทธิภาพการใช้น้ำมัน (km/L)
        </h3>
        <div className="h-64 flex items-center justify-center text-slate-500 dark:text-slate-400">
          ไม่มีข้อมูล
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
        กราฟประสิทธิภาพการใช้น้ำมัน (km/L)
      </h3>
      <div className="h-64">
        <Line data={chartData} options={options} />
      </div>
    </Card>
  );
};

