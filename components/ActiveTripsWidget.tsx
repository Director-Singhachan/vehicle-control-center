// Active Trips Widget - Display vehicles that are checked out but not checked in
import React from 'react';
import {
  Truck,
  Clock,
  AlertTriangle,
  MapPin,
  Gauge,
  User,
  ArrowRight
} from 'lucide-react';
import { Card } from './ui/Card';
import { useActiveTrips, useOverdueTrips } from '../hooks';
import type { TripLogWithRelations } from '../services/tripLogService';

interface ActiveTripsWidgetProps {
  vehicleId?: string;
  showOverdueOnly?: boolean;
  onTripClick?: (tripId: string) => void;
}

export const ActiveTripsWidget: React.FC<ActiveTripsWidgetProps> = ({
  vehicleId,
  showOverdueOnly = false,
  onTripClick,
}) => {
  const { trips: activeTrips, loading, error } = useActiveTrips(vehicleId);
  const { trips: overdueTrips } = useOverdueTrips();

  const displayTrips = showOverdueOnly
    ? activeTrips.filter((trip) =>
        overdueTrips.some((ot) => ot.id === trip.id)
      )
    : activeTrips;

  const formatTimeAgo = (date: string) => {
    const now = new Date();
    const then = new Date(date);
    const diffMs = now.getTime() - then.getTime();
    const diffHours = Math.floor(diffMs / 3600000);
    const diffMins = Math.floor((diffMs % 3600000) / 60000);

    if (diffHours >= 12) {
      return `${diffHours} ชั่วโมง (เกิน 12 ชม.)`;
    }
    if (diffHours > 0) {
      return `${diffHours} ชั่วโมง ${diffMins} นาที`;
    }
    return `${diffMins} นาที`;
  };

  const isOverdue = (trip: TripLogWithRelations) => {
    const checkoutTime = new Date(trip.checkout_time);
    const now = new Date();
    const diffHours = (now.getTime() - checkoutTime.getTime()) / 3600000;
    return diffHours >= 12;
  };

  if (loading) {
    return (
      <Card className="p-6">
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-enterprise-600 mx-auto"></div>
          <p className="mt-4 text-sm text-slate-600 dark:text-slate-400">กำลังโหลด...</p>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-6 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800">
        <div className="flex items-center gap-2 text-red-800 dark:text-red-200">
          <AlertTriangle size={20} />
          <span className="text-sm">{error.message}</span>
        </div>
      </Card>
    );
  }

  if (displayTrips.length === 0) {
    return (
      <Card className="p-6">
        <div className="text-center py-8">
          <Truck className="mx-auto mb-3 text-slate-400" size={48} />
          <p className="text-slate-600 dark:text-slate-400">
            {showOverdueOnly
              ? 'ไม่มีรถที่ออกเกิน 12 ชั่วโมง'
              : 'ไม่มีรถที่กำลังใช้งาน'}
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-semibold text-slate-900 dark:text-white text-lg">
          {showOverdueOnly ? 'รถที่ออกเกิน 12 ชั่วโมง' : 'รถที่กำลังใช้งาน'}
        </h3>
        <span className="text-sm text-slate-500 dark:text-slate-400">
          {displayTrips.length} คัน
        </span>
      </div>

      <div className="space-y-4">
        {displayTrips.map((trip) => {
          const overdue = isOverdue(trip);
          
          return (
            <div
              key={trip.id}
              className={`p-4 rounded-lg border transition-colors ${
                overdue
                  ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                  : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700'
              } ${
                onTripClick ? 'cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800' : ''
              }`}
              onClick={() => onTripClick && onTripClick(trip.id)}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-3 h-3 rounded-full ${
                      overdue ? 'bg-red-500' : 'bg-amber-500'
                    }`}
                  />
                  <div>
                    <h4 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                      <Truck size={18} />
                      {trip.vehicle?.plate || 'N/A'}
                    </h4>
                    <p className="text-sm text-slate-600 dark:text-slate-400 flex items-center gap-1 mt-1">
                      <User size={14} />
                      {trip.driver?.full_name || 'N/A'}
                    </p>
                  </div>
                </div>
                {overdue && (
                  <div className="flex items-center gap-1 text-red-600 dark:text-red-400 text-sm">
                    <AlertTriangle size={16} />
                    <span className="font-medium">เกิน 12 ชม.</span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="flex items-center gap-2">
                  <Gauge size={16} className="text-slate-400" />
                  <div>
                    <div className="text-slate-600 dark:text-slate-400 text-xs">เลขไมล์ออก</div>
                    <div className="font-medium text-slate-900 dark:text-white">
                      {trip.odometer_start.toLocaleString()} km
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Clock size={16} className="text-slate-400" />
                  <div>
                    <div className="text-slate-600 dark:text-slate-400 text-xs">ออกเมื่อ</div>
                    <div className="font-medium text-slate-900 dark:text-white">
                      {formatTimeAgo(trip.checkout_time)}
                    </div>
                  </div>
                </div>
              </div>

              {trip.destination && (
                <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                  <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                    <MapPin size={14} />
                    <span>{trip.destination}</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {showOverdueOnly && overdueTrips.length > 0 && (
        <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
          <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200 text-sm">
            <AlertTriangle size={16} />
            <span>
              มีรถ {overdueTrips.length} คันที่ออกเกิน 12 ชั่วโมง กรุณาตรวจสอบ
            </span>
          </div>
        </div>
      )}
    </Card>
  );
};

