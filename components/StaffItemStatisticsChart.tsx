// Staff Item Statistics Chart - กราฟเปรียบเทียบการยกสินค้าของพนักงานแต่ละคน
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
import type { StaffItemStatistics } from '../services/reportsService';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

interface StaffItemStatisticsChartProps {
  data: StaffItemStatistics[];
  isDark?: boolean;
}

export const StaffItemStatisticsChart: React.FC<StaffItemStatisticsChartProps> = ({
  data,
  isDark = false,
}) => {
  // Sort by total_items_carried descending
  const sortedData = [...data].sort((a, b) => b.total_items_carried - a.total_items_carried);

  // Prepare chart data
  const chartData = {
    labels: sortedData.map(staff => staff.staff_name || staff.staff_code || 'N/A'),
    datasets: [
      {
        label: 'จำนวนสินค้าที่ยก (ชิ้น)',
        data: sortedData.map(staff => staff.total_items_carried),
        backgroundColor: sortedData.map((staff, index) => {
          // Use different colors for better visualization
          const colors = [
            'rgba(59, 130, 246, 0.8)',   // blue
            'rgba(16, 185, 129, 0.8)',   // green
            'rgba(245, 158, 11, 0.8)',   // yellow
            'rgba(239, 68, 68, 0.8)',    // red
            'rgba(139, 92, 246, 0.8)',   // purple
            'rgba(236, 72, 153, 0.8)',   // pink
            'rgba(20, 184, 166, 0.8)',   // teal
            'rgba(251, 146, 60, 0.8)',   // orange
          ];
          return colors[index % colors.length];
        }),
        borderColor: sortedData.map((staff, index) => {
          const colors = [
            'rgba(59, 130, 246, 1)',
            'rgba(16, 185, 129, 1)',
            'rgba(245, 158, 11, 1)',
            'rgba(239, 68, 68, 1)',
            'rgba(139, 92, 246, 1)',
            'rgba(236, 72, 153, 1)',
            'rgba(20, 184, 166, 1)',
            'rgba(251, 146, 60, 1)',
          ];
          return colors[index % colors.length];
        }),
        borderWidth: 2,
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
          color: isDark ? '#e2e8f0' : '#1e293b',
          font: {
            size: 12,
          },
        },
      },
      title: {
        display: true,
        text: 'สถิติการยกสินค้าของพนักงานแต่ละคน',
        color: isDark ? '#e2e8f0' : '#1e293b',
        font: {
          size: 16,
          weight: 'bold' as const,
        },
      },
      tooltip: {
        backgroundColor: isDark ? 'rgba(30, 41, 59, 0.95)' : 'rgba(255, 255, 255, 0.95)',
        titleColor: isDark ? '#e2e8f0' : '#1e293b',
        bodyColor: isDark ? '#e2e8f0' : '#1e293b',
        borderColor: isDark ? '#475569' : '#cbd5e1',
        borderWidth: 1,
        callbacks: {
          label: function(context: any) {
            const staff = sortedData[context.dataIndex];
            return [
              `จำนวนสินค้า: ${staff.total_items_carried.toLocaleString('th-TH', {
                minimumFractionDigits: 0,
                maximumFractionDigits: 1,
              })} ชิ้น`,
              `จำนวนทริป: ${staff.total_trips} ทริป`,
              `ทริปที่เสร็จแล้ว: ${staff.completed_trips} ทริป`,
            ];
          },
        },
      },
    },
    scales: {
      x: {
        ticks: {
          color: isDark ? '#94a3b8' : '#64748b',
          font: {
            size: 11,
          },
        },
        grid: {
          color: isDark ? 'rgba(148, 163, 184, 0.1)' : 'rgba(100, 116, 139, 0.1)',
        },
      },
      y: {
        beginAtZero: true,
        ticks: {
          color: isDark ? '#94a3b8' : '#64748b',
          font: {
            size: 11,
          },
          callback: function(value: any) {
            return value.toLocaleString('th-TH') + ' ชิ้น';
          },
        },
        grid: {
          color: isDark ? 'rgba(148, 163, 184, 0.1)' : 'rgba(100, 116, 139, 0.1)',
        },
      },
    },
  };

  if (sortedData.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-500 dark:text-slate-400">
        <p>ไม่มีข้อมูลการยกสินค้าของพนักงานในช่วงเวลาที่เลือก</p>
      </div>
    );
  }

  return (
    <div className="h-96">
      <Bar data={chartData} options={options} />
    </div>
  );
};

