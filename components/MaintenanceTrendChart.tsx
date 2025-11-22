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

interface MaintenanceTrendProps {
  data: {
    labels: string[];
    costs: number[];
    incidents: number[];
  };
  isDark: boolean;
}

export const MaintenanceTrendChart: React.FC<MaintenanceTrendProps> = ({ data, isDark }) => {
  const chartData = {
    labels: data.labels,
    datasets: [
      {
        label: 'ค่าใช้จ่ายการซ่อมบำรุง (฿)',
        data: data.costs,
        backgroundColor: isDark ? '#6366f1' : '#4f46e5',
        borderRadius: 4,
      },
      {
        label: 'Incidents',
        data: data.incidents.map(i => i * 100), // Scaled for visualization on same axis roughly or just hide it
        hidden: true // Simple bar chart for now as requested
      }
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        backgroundColor: isDark ? '#1e293b' : '#ffffff',
        titleColor: isDark ? '#f8fafc' : '#0f172a',
        bodyColor: isDark ? '#cbd5e1' : '#475569',
        borderColor: isDark ? '#334155' : '#e2e8f0',
        borderWidth: 1,
      }
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: isDark ? '#94a3b8' : '#64748b' }
      },
      y: {
        grid: { 
          color: isDark ? '#334155' : '#e2e8f0',
          borderDash: [4, 4]
        },
        ticks: { color: isDark ? '#94a3b8' : '#64748b' }
      }
    }
  };

  return (
    <div className="h-64 w-full">
      <Bar data={chartData} options={options} />
    </div>
  );
};