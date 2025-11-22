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

interface UsageChartProps {
  data: {
    labels: string[];
    data: number[];
  };
  isDark: boolean;
}

export const UsageChart: React.FC<UsageChartProps> = ({ data, isDark }) => {
  const chartData = {
    labels: data.labels,
    datasets: [
      {
        label: 'ยานพาหนะที่ใช้งาน',
        data: data.data,
        borderColor: isDark ? '#8b5cf6' : '#7c3aed', // Violet
        backgroundColor: isDark ? 'rgba(139, 92, 246, 0.1)' : 'rgba(124, 58, 237, 0.1)',
        borderWidth: 2,
        tension: 0.4,
        fill: true,
        pointBackgroundColor: isDark ? '#020617' : '#ffffff', // Deep Space
        pointBorderColor: isDark ? '#8b5cf6' : '#7c3aed',
        pointBorderWidth: 2,
      },
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
        mode: 'index' as const,
        intersect: false,
        backgroundColor: isDark ? '#020617' : '#ffffff', // Deep Space
        titleColor: isDark ? '#f8fafc' : '#0f172a',
        bodyColor: isDark ? '#cbd5e1' : '#475569',
        borderColor: isDark ? '#334155' : '#e2e8f0',
        borderWidth: 1,
      }
    },
    scales: {
      x: {
        grid: {
          display: false,
          drawBorder: false,
        },
        ticks: {
          color: isDark ? '#94a3b8' : '#64748b',
        }
      },
      y: {
        grid: {
          color: isDark ? '#334155' : '#e2e8f0',
          borderDash: [4, 4],
        },
        ticks: {
          color: isDark ? '#94a3b8' : '#64748b',
        },
        min: 0,
        max: 100,
      }
    }
  };

  return (
    <div className="h-64 w-full">
      <Line data={chartData} options={options} />
    </div>
  );
};