// Fuel Efficiency Alerts Widget - สำหรับแสดงใน Dashboard
import React from 'react';
import { AlertTriangle, TrendingDown } from 'lucide-react';
import { useFuelEfficiencyAlerts } from '../hooks/useFuelLogs';
import { StatusCard } from './StatusCard';

interface FuelEfficiencyAlertsWidgetProps {
  onViewAll?: () => void;
}

export const FuelEfficiencyAlertsWidget: React.FC<FuelEfficiencyAlertsWidgetProps> = ({
  onViewAll,
}) => {
  const { alerts, loading } = useFuelEfficiencyAlerts();

  if (loading) {
    return (
      <StatusCard
        title="การแจ้งเตือนประสิทธิภาพน้ำมัน"
        value="..."
        icon={AlertTriangle}
        alert={false}
      />
    );
  }

  const criticalCount = alerts.filter((a) => a.efficiency_drop_percent >= 40).length;
  const warningCount = alerts.filter(
    (a) => a.efficiency_drop_percent >= 30 && a.efficiency_drop_percent < 40
  ).length;

  return (
    <StatusCard
      title="การแจ้งเตือนประสิทธิภาพน้ำมัน"
      value={alerts.length}
      subValue={
        alerts.length > 0
          ? `วิกฤต ${criticalCount} | รุนแรง ${warningCount}`
          : 'ไม่มีรถที่ต้องแจ้งเตือน'
      }
      icon={TrendingDown}
      alert={alerts.length > 0}
      trend={alerts.length > 0 ? -alerts.length : undefined}
      trendLabel="รถที่ต้องตรวจสอบ"
    />
  );
};

