// Trip Log List View - Display trip history
import React, { useState } from 'react';
import {
  Truck,
  Gauge,
  MapPin,
  Clock,
  Calendar,
  Filter,
  Download,
  Search,
  CheckCircle,
  AlertCircle,
  ArrowRight,
  Plus
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card } from '../components/ui/Card';
import { PageLayout } from '../components/layout/PageLayout';
import { useTripLogs, useVehicles } from '../hooks';
import type { TripLogWithRelations } from '../services/tripLogService';

interface TripLogListViewProps {
  onCreateCheckout?: () => void;
  onCreateCheckin?: (tripId: string) => void;
}

export const TripLogListView: React.FC<TripLogListViewProps> = ({
  onCreateCheckout,
  onCreateCheckin,
}) => {
  const { vehicles } = useVehicles();

  const [filters, setFilters] = useState<{
    vehicle_id?: string;
    start_date?: string;
    end_date?: string;
    status?: 'checked_out' | 'checked_in';
  }>({});

  const [searchTerm, setSearchTerm] = useState('');

  const { trips, loading, error, refetch } = useTripLogs(filters);

  // Filter trips by search term
  const filteredTrips = trips.filter((trip) => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      trip.vehicle?.plate?.toLowerCase().includes(searchLower) ||
      trip.driver?.full_name?.toLowerCase().includes(searchLower) ||
      trip.destination?.toLowerCase().includes(searchLower) ||
      trip.route?.toLowerCase().includes(searchLower)
    );
  });

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString('th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDuration = (hours: number | null) => {
    if (!hours) return 'N/A';
    const h = Math.floor(hours);
    const m = Math.floor((hours - h) * 60);
    return `${h} ชม. ${m} นาที`;
  };

  const handleExport = () => {
    // TODO: Implement Excel export
    alert('ฟีเจอร์ Export to Excel กำลังพัฒนา');
  };

  return (
    <PageLayout
      title="ประวัติการเดินทาง"
      subtitle="รายการการเดินทางทั้งหมด"
      actions={
        <div className="flex gap-2">
          {onCreateCheckout && (
            <Button
              onClick={onCreateCheckout}
              className="flex items-center gap-2"
            >
              <Plus size={18} />
              บันทึกการใช้งานรถ
            </Button>
          )}
          <Button
            variant="outline"
            onClick={handleExport}
            className="flex items-center gap-2"
          >
            <Download size={18} />
            Export Excel
          </Button>
        </div>
      }
    >
      {/* Filters */}
      <Card className="p-6 mb-6">
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300 mb-4">
            <Filter size={20} />
            <span className="font-semibold">ตัวกรอง</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                รถ
              </label>
              <select
                value={filters.vehicle_id || ''}
                onChange={(e) =>
                  setFilters({ ...filters, vehicle_id: e.target.value || undefined })
                }
                className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              >
                <option value="">ทั้งหมด</option>
                {vehicles.map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.id}>
                    {vehicle.plate} {vehicle.make && vehicle.model ? `(${vehicle.make} ${vehicle.model})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                วันที่เริ่มต้น
              </label>
              <Input
                type="date"
                value={filters.start_date || ''}
                onChange={(e) =>
                  setFilters({ ...filters, start_date: e.target.value || undefined })
                }
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                วันที่สิ้นสุด
              </label>
              <Input
                type="date"
                value={filters.end_date || ''}
                onChange={(e) =>
                  setFilters({ ...filters, end_date: e.target.value || undefined })
                }
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                สถานะ
              </label>
              <select
                value={filters.status || ''}
                onChange={(e) =>
                  setFilters({
                    ...filters,
                    status: (e.target.value as 'checked_out' | 'checked_in') || undefined,
                  })
                }
                className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              >
                <option value="">ทั้งหมด</option>
                <option value="checked_out">ออกไปแล้ว</option>
                <option value="checked_in">กลับแล้ว</option>
              </select>
            </div>
          </div>

          {/* Search */}
          <div>
            <Input
              label="ค้นหา"
              placeholder="ค้นหาจากป้ายทะเบียน, ชื่อคนขับ, ปลายทาง..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              icon={<Search size={18} />}
            />
          </div>
        </div>
      </Card>

      {/* Error Message */}
      {error && (
        <Card className="p-4 mb-6 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800">
          <div className="flex items-center gap-2 text-red-800 dark:text-red-200">
            <AlertCircle size={20} />
            <span>{error.message}</span>
          </div>
        </Card>
      )}

      {/* Loading State */}
      {loading && (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-enterprise-600 mx-auto"></div>
          <p className="mt-4 text-slate-600 dark:text-slate-400">กำลังโหลดข้อมูล...</p>
        </div>
      )}

      {/* Trips List */}
      {!loading && filteredTrips.length === 0 && (
        <Card className="p-12 text-center">
          <Truck className="mx-auto mb-4 text-slate-400" size={48} />
          <p className="text-slate-600 dark:text-slate-400">
            {searchTerm || Object.keys(filters).length > 0
              ? 'ไม่พบข้อมูลที่ค้นหา'
              : 'ยังไม่มีข้อมูลการเดินทาง'}
          </p>
        </Card>
      )}

      {!loading && filteredTrips.length > 0 && (
        <div className="space-y-4">
          <div className="text-sm text-slate-600 dark:text-slate-400 mb-4">
            พบทั้งหมด {filteredTrips.length} รายการ
          </div>

          {filteredTrips.map((trip) => (
            <Card key={trip.id} className="p-6 hover:shadow-md transition-shadow">
              <div className="flex items-start gap-4">
                {/* Vehicle Image */}
                <div className="w-24 h-24 flex-shrink-0 rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  {trip.vehicle?.image_url ? (
                    <img
                      src={trip.vehicle.image_url}
                      alt={trip.vehicle.plate}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-400">
                      <Truck size={32} />
                    </div>
                  )}
                </div>

                <div className="flex-1">
                  {/* Header */}
                  <div className="flex items-center gap-3 mb-4">
                    <div
                      className={`w-3 h-3 rounded-full ${trip.status === 'checked_in'
                          ? 'bg-emerald-500'
                          : 'bg-amber-500'
                        }`}
                    />
                    <div>
                      <h3 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                        <Truck size={18} />
                        {trip.vehicle?.plate || 'N/A'}
                      </h3>
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        {trip.driver?.full_name || 'N/A'}
                      </p>
                    </div>
                    <div className="ml-auto">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-medium ${trip.status === 'checked_in'
                            ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-200'
                            : 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200'
                          }`}
                      >
                        {trip.status === 'checked_in' ? (
                          <span className="flex items-center gap-1">
                            <CheckCircle size={14} />
                            กลับแล้ว
                          </span>
                        ) : (
                          <span className="flex items-center gap-1">
                            <Clock size={14} />
                            ออกไปแล้ว
                          </span>
                        )}
                      </span>
                    </div>
                  </div>

                  {/* Trip Details */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="flex items-center gap-2 text-sm">
                      <Gauge size={16} className="text-slate-400" />
                      <div>
                        <div className="text-slate-600 dark:text-slate-400">เลขไมล์ออก</div>
                        <div className="font-medium text-slate-900 dark:text-white">
                          {trip.odometer_start.toLocaleString()} km
                        </div>
                      </div>
                    </div>

                    {trip.odometer_end && (
                      <div className="flex items-center gap-2 text-sm">
                        <Gauge size={16} className="text-slate-400" />
                        <div>
                          <div className="text-slate-600 dark:text-slate-400">เลขไมล์กลับ</div>
                          <div className="font-medium text-slate-900 dark:text-white">
                            {trip.odometer_end.toLocaleString()} km
                          </div>
                        </div>
                      </div>
                    )}

                    {trip.distance_km && (
                      <div className="flex items-center gap-2 text-sm">
                        <ArrowRight size={16} className="text-slate-400" />
                        <div>
                          <div className="text-slate-600 dark:text-slate-400">ระยะทาง</div>
                          <div className="font-medium text-slate-900 dark:text-white">
                            {trip.distance_km.toLocaleString()} km
                          </div>
                        </div>
                      </div>
                    )}

                    {trip.duration_hours && (
                      <div className="flex items-center gap-2 text-sm">
                        <Clock size={16} className="text-slate-400" />
                        <div>
                          <div className="text-slate-600 dark:text-slate-400">เวลา</div>
                          <div className="font-medium text-slate-900 dark:text-white">
                            {formatDuration(trip.duration_hours)}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Additional Info */}
                  {(trip.destination || trip.route || trip.notes) && (
                    <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                        {trip.destination && (
                          <div className="flex items-start gap-2">
                            <MapPin size={16} className="text-slate-400 mt-0.5 flex-shrink-0" />
                            <div>
                              <div className="text-slate-600 dark:text-slate-400">ปลายทาง</div>
                              <div className="text-slate-900 dark:text-white">{trip.destination}</div>
                            </div>
                          </div>
                        )}

                        {trip.route && (
                          <div className="flex items-start gap-2">
                            <ArrowRight size={16} className="text-slate-400 mt-0.5 flex-shrink-0" />
                            <div>
                              <div className="text-slate-600 dark:text-slate-400">เส้นทาง</div>
                              <div className="text-slate-900 dark:text-white">{trip.route}</div>
                            </div>
                          </div>
                        )}

                        {trip.notes && (
                          <div className="flex items-start gap-2">
                            <Calendar size={16} className="text-slate-400 mt-0.5 flex-shrink-0" />
                            <div>
                              <div className="text-slate-600 dark:text-slate-400">หมายเหตุ</div>
                              <div className="text-slate-900 dark:text-white">{trip.notes}</div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Timestamps */}
                  <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                    <div className="flex flex-wrap gap-4 text-xs text-slate-500 dark:text-slate-500">
                      <div className="flex items-center gap-1">
                        <Clock size={12} />
                        ออก: {formatDate(trip.checkout_time)}
                      </div>
                      {trip.checkin_time && (
                        <div className="flex items-center gap-1">
                          <CheckCircle size={12} />
                          กลับ: {formatDate(trip.checkin_time)}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </PageLayout>
  );
};

