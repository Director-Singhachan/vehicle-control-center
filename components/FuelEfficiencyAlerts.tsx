// Fuel Efficiency Alerts Component
import React from 'react';
import { AlertTriangle, TrendingDown, Truck, RefreshCw, Droplet } from 'lucide-react';
import { Card, CardHeader, CardContent } from './ui/Card';
import { Button } from './ui/Button';
import { useFuelEfficiencyAlerts } from '../hooks/useFuelLogs';

interface FuelEfficiencyAlertsProps {
  maxItems?: number;
  showHeader?: boolean;
  onVehicleClick?: (vehicleId: string) => void;
}

export const FuelEfficiencyAlerts: React.FC<FuelEfficiencyAlertsProps> = ({
  maxItems,
  showHeader = true,
  onVehicleClick,
}) => {
  const { alerts, loading, error, refetch } = useFuelEfficiencyAlerts();

  const displayAlerts = maxItems ? alerts.slice(0, maxItems) : alerts;

  if (loading) {
    return (
      <Card>
        <div className="flex items-center justify-center py-8">
          <RefreshCw className="animate-spin text-slate-400" size={24} />
          <span className="ml-2 text-slate-500 dark:text-slate-400">กำลังโหลดข้อมูล...</span>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <div className="flex items-center gap-2 text-red-800 dark:text-red-200">
            <AlertTriangle size={20} />
            <span>เกิดข้อผิดพลาด: {error.message}</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            className="mt-3"
          >
            ลองอีกครั้ง
          </Button>
        </div>
      </Card>
    );
  }

  if (alerts.length === 0) {
    return (
      <Card>
        {showHeader && (
          <CardHeader
            title="การแจ้งเตือนประสิทธิภาพน้ำมัน"
            subtitle="รถที่มีประสิทธิภาพน้ำมันลดลงมากกว่า 20%"
            action={
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetch()}
                className="flex items-center gap-2"
              >
                <RefreshCw size={16} />
                รีเฟรช
              </Button>
            }
          />
        )}
        <CardContent>
          <div className="text-center py-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/20 mb-4">
              <Droplet className="text-emerald-600 dark:text-emerald-400" size={32} />
            </div>
            <p className="text-slate-600 dark:text-slate-400 font-medium">
              ไม่มีการแจ้งเตือน
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-500 mt-1">
              รถทั้งหมดมีประสิทธิภาพน้ำมันอยู่ในเกณฑ์ปกติ
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      {showHeader && (
        <CardHeader
          title="การแจ้งเตือนประสิทธิภาพน้ำมัน"
          subtitle={`พบ ${alerts.length} รถที่มีประสิทธิภาพลดลงมากกว่า 20%`}
          action={
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              className="flex items-center gap-2"
            >
              <RefreshCw size={16} />
              รีเฟรช
            </Button>
          }
        />
      )}
      <CardContent>
        <div className="space-y-4">
          {displayAlerts.map((alert) => (
            <FuelEfficiencyAlertCard
              key={alert.vehicle_id}
              alert={alert}
              onClick={() => onVehicleClick?.(alert.vehicle_id)}
            />
          ))}
          {maxItems && alerts.length > maxItems && (
            <div className="text-center pt-2">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                และอีก {alerts.length - maxItems} รถ
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

interface FuelEfficiencyAlertCardProps {
  alert: {
    vehicle_id: string;
    vehicle_plate: string;
    vehicle_make: string | null;
    vehicle_model: string | null;
    current_efficiency: number;
    average_efficiency: number;
    efficiency_drop_percent: number;
    last_fill_date: string;
  };
  onClick?: () => void;
}

const FuelEfficiencyAlertCard: React.FC<FuelEfficiencyAlertCardProps> = ({
  alert,
  onClick,
}) => {
  const getSeverityColor = (dropPercent: number) => {
    if (dropPercent >= 40) {
      return {
        bg: 'bg-red-50 dark:bg-red-900/20',
        border: 'border-red-300 dark:border-red-800',
        text: 'text-red-800 dark:text-red-200',
        icon: 'text-red-600 dark:text-red-400',
        badge: 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200',
      };
    } else if (dropPercent >= 30) {
      return {
        bg: 'bg-orange-50 dark:bg-orange-900/20',
        border: 'border-orange-300 dark:border-orange-800',
        text: 'text-orange-800 dark:text-orange-200',
        icon: 'text-orange-600 dark:text-orange-400',
        badge: 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-200',
      };
    } else {
      return {
        bg: 'bg-amber-50 dark:bg-amber-900/20',
        border: 'border-amber-300 dark:border-amber-800',
        text: 'text-amber-800 dark:text-amber-200',
        icon: 'text-amber-600 dark:text-amber-400',
        badge: 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200',
      };
    }
  };

  const colors = getSeverityColor(alert.efficiency_drop_percent);
  const lastFillDate = new Date(alert.last_fill_date).toLocaleDateString('th-TH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div
      className={`${colors.bg} ${colors.border} border-l-4 rounded-lg p-4 transition-all hover:shadow-md ${
        onClick ? 'cursor-pointer' : ''
      }`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          {/* Vehicle Info */}
          <div className="flex items-center gap-2 mb-2">
            <Truck className={colors.icon} size={20} />
            <div>
              <h4 className="font-semibold text-slate-900 dark:text-white">
                {alert.vehicle_plate}
              </h4>
              {(alert.vehicle_make || alert.vehicle_model) && (
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {alert.vehicle_make} {alert.vehicle_model}
                </p>
              )}
            </div>
          </div>

          {/* Efficiency Comparison */}
          <div className="mt-3 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-600 dark:text-slate-400">ประสิทธิภาพปัจจุบัน:</span>
              <span className="font-semibold text-slate-900 dark:text-white">
                {alert.current_efficiency.toFixed(2)} km/L
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-600 dark:text-slate-400">ค่าเฉลี่ยปกติ:</span>
              <span className="font-semibold text-slate-900 dark:text-white">
                {alert.average_efficiency.toFixed(2)} km/L
              </span>
            </div>
            <div className="flex items-center gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
              <TrendingDown className={colors.icon} size={16} />
              <span className="text-sm text-slate-600 dark:text-slate-400">ลดลง:</span>
              <span className={`font-bold ${colors.text}`}>
                {alert.efficiency_drop_percent.toFixed(1)}%
              </span>
            </div>
          </div>

          {/* Last Fill Date */}
          <div className="mt-3 text-xs text-slate-500 dark:text-slate-500">
            เติมน้ำมันล่าสุด: {lastFillDate}
          </div>
        </div>

        {/* Badge */}
        <div className={`${colors.badge} px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap`}>
          {alert.efficiency_drop_percent >= 40
            ? 'วิกฤต'
            : alert.efficiency_drop_percent >= 30
            ? 'รุนแรง'
            : 'ควรตรวจสอบ'}
        </div>
      </div>
    </div>
  );
};

