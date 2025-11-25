import React from 'react';
import { Truck, Gauge, Wrench, Calendar } from 'lucide-react';
import type { Database } from '../types/database';

type VehicleDashboard = Database['public']['Views']['vehicle_dashboard']['Row'];

interface VehicleStatusSectionProps {
  vehicles: VehicleDashboard[];
  isDark: boolean;
}

const getStatusColor = (status: string | null) => {
  if (status === 'in_progress') return 'bg-emerald-500';
  if (status === 'maintenance') return 'bg-red-500';
  return 'bg-amber-400';
};

const getStatusLabel = (status: string | null) => {
  if (status === 'in_progress') return 'ใช้งานอยู่';
  if (status === 'maintenance') return 'ซ่อมบำรุง';
  return 'ว่าง';
};

const formatOdometer = (value: number | null) => {
  if (!value) return 'N/A';
  return value.toLocaleString('th-TH');
};

const formatDate = (date: string | null) => {
  if (!date) return 'N/A';
  const d = new Date(date);
  return d.toLocaleDateString('th-TH', { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric' 
  });
};

export const VehicleStatusSection: React.FC<VehicleStatusSectionProps> = ({ 
  vehicles, 
  isDark 
}) => {
  if (!vehicles || vehicles.length === 0) {
    return (
      <div className="bg-white/80 dark:bg-charcoal-900/50 backdrop-blur-md p-6 rounded-xl border border-slate-200 dark:border-slate-700/50">
        <div className="text-center text-slate-500 dark:text-slate-400 py-8">
          <Truck className="mx-auto mb-3 opacity-50" size={48} />
          <p>ไม่มีข้อมูลรถ</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white/80 dark:bg-charcoal-900/50 backdrop-blur-md p-6 rounded-xl border border-slate-200 dark:border-slate-700/50 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-semibold text-slate-900 dark:text-white text-lg">
          สถานะรถทั้งหมด
        </h3>
        <span className="text-sm text-slate-500 dark:text-slate-400">
          {vehicles.length} คัน
        </span>
      </div>

      <div className="space-y-3 max-h-[600px] overflow-y-auto">
        {vehicles.map((vehicle) => {
          const status = vehicle.usage_status || 'idle';
          const statusColor = getStatusColor(status);
          const statusLabel = getStatusLabel(status);

          return (
            <div
              key={vehicle.id}
              className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <div className={`w-3 h-3 rounded-full ${statusColor}`} />
                    <h4 className="font-semibold text-slate-900 dark:text-white">
                      {vehicle.plate}
                    </h4>
                    <span className="px-2 py-0.5 text-xs rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                      {statusLabel}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3 text-sm">
                    <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                      <Gauge size={16} className="text-slate-400" />
                      <span className="font-medium">{formatOdometer(vehicle.current_odometer)} km</span>
                    </div>

                    {vehicle.last_maintenance_date && (
                      <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                        <Wrench size={16} className="text-slate-400" />
                        <span className="text-xs">
                          ซ่อม: {formatDate(vehicle.last_maintenance_date)}
                        </span>
                      </div>
                    )}

                    {vehicle.avg_fuel_efficiency && (
                      <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                        <Truck size={16} className="text-slate-400" />
                        <span className="text-xs">
                          {vehicle.avg_fuel_efficiency.toFixed(1)} km/L
                        </span>
                      </div>
                    )}

                    {vehicle.last_fuel_date && (
                      <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                        <Calendar size={16} className="text-slate-400" />
                        <span className="text-xs">
                          เติม: {formatDate(vehicle.last_fuel_date)}
                        </span>
                      </div>
                    )}
                  </div>

                  {vehicle.make || vehicle.model ? (
                    <div className="mt-2 text-xs text-slate-500 dark:text-slate-500">
                      {vehicle.make} {vehicle.model}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

