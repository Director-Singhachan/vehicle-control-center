// DocumentExpiryChart - Chart showing document expiry trends by month
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
import { vehicleDocumentService } from '../services/vehicleDocumentService';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

interface DocumentExpiryChartProps {
  isDark: boolean;
  months?: number;
}

export const DocumentExpiryChart: React.FC<DocumentExpiryChartProps> = ({
  isDark,
  months = 6,
}) => {
  const [data, setData] = React.useState<{
    labels: string[];
    expired: number[];
    expiring: number[];
  } | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<Error | null>(null);

  React.useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await vehicleDocumentService.getExpiryByMonth(months);
        setData(result);
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to fetch expiry data');
        setError(error);
        console.error('[DocumentExpiryChart] Error:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [months]);

  if (loading) {
    return (
      <div className="h-64 w-full flex items-center justify-center">
        <div className="animate-pulse text-slate-500 dark:text-slate-400 text-sm">
          กำลังโหลดข้อมูล...
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="h-64 w-full flex items-center justify-center">
        <div className="text-center text-slate-500 dark:text-slate-400">
          <p className="text-sm">เกิดข้อผิดพลาดในการโหลดข้อมูล</p>
          <p className="text-xs mt-1">{error?.message}</p>
        </div>
      </div>
    );
  }

  if (data.labels.length === 0) {
    return (
      <div className="h-64 w-full flex items-center justify-center">
        <div className="text-center text-slate-500 dark:text-slate-400">
          <p className="text-sm">ไม่มีข้อมูลเอกสารที่หมดอายุ</p>
        </div>
      </div>
    );
  }

  const chartData = {
    labels: data.labels,
    datasets: [
      {
        label: 'หมดอายุแล้ว',
        data: data.expired,
        backgroundColor: isDark ? '#ef4444' : '#dc2626', // Red
        borderRadius: 4,
      },
      {
        label: 'ใกล้หมดอายุ',
        data: data.expiring,
        backgroundColor: isDark ? '#f59e0b' : '#d97706', // Amber
        borderRadius: 4,
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
          usePointStyle: true,
          padding: 15,
          font: {
            size: 12,
          },
        },
      },
      tooltip: {
        backgroundColor: isDark ? '#020617' : '#ffffff',
        titleColor: isDark ? '#f8fafc' : '#0f172a',
        bodyColor: isDark ? '#cbd5e1' : '#475569',
        borderColor: isDark ? '#334155' : '#e2e8f0',
        borderWidth: 1,
      },
    },
    scales: {
      x: {
        grid: {
          display: false,
        },
        ticks: {
          color: isDark ? '#94a3b8' : '#64748b',
          font: {
            size: 11,
          },
        },
      },
      y: {
        grid: {
          color: isDark ? '#334155' : '#e2e8f0',
          borderDash: [4, 4],
        },
        ticks: {
          color: isDark ? '#94a3b8' : '#64748b',
          font: {
            size: 11,
          },
          stepSize: 1,
        },
        beginAtZero: true,
      },
    },
  };

  return (
    <div className="h-64 w-full">
      <Bar data={chartData} options={options} />
    </div>
  );
};
