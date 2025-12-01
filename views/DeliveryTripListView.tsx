// Delivery Trip List View - Display all delivery trips
import React, { useState, useEffect, useRef } from 'react';
import {
  Package,
  Plus,
  Search,
  Filter,
  Eye,
  Calendar,
  Truck,
  User,
  MapPin,
  CheckCircle,
  Clock,
  X,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Download,
  History,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card } from '../components/ui/Card';
import { PageLayout } from '../components/layout/PageLayout';
import { useDeliveryTrips, useVehicles } from '../hooks';
import type { DeliveryTripWithRelations } from '../services/deliveryTripService';

interface DeliveryTripListViewProps {
  onViewDetail?: (tripId: string) => void;
  onCreate?: () => void;
}

export const DeliveryTripListView: React.FC<DeliveryTripListViewProps> = ({
  onViewDetail,
  onCreate,
}) => {
  const { vehicles } = useVehicles();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string[] | 'all'>('all');
  const [vehicleFilter, setVehicleFilter] = useState<string>('');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [showFilters, setShowFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  const { trips, total, loading, error, refetch } = useDeliveryTrips({
    status: statusFilter !== 'all' && Array.isArray(statusFilter) ? statusFilter : undefined,
    vehicle_id: vehicleFilter || undefined,
    planned_date_from: dateFrom || undefined,
    planned_date_to: dateTo || undefined,
    autoFetch: true,
    page: currentPage,
    pageSize: itemsPerPage,
  });

  // Auto-refetch when component becomes visible (e.g., after check-in)
  // Use useRef to store refetch function to avoid infinite loop
  const refetchRef = useRef(refetch);
  refetchRef.current = refetch;

  useEffect(() => {
    // Refetch immediately when component mounts (in case status was updated)
    refetchRef.current();

    // Refetch periodically to catch status updates
    const intervalId = setInterval(() => {
      refetchRef.current();
    }, 30000); // Refetch every 30 seconds (less frequent to avoid performance issues)

    // Also refetch on window focus (user comes back to tab)
    const handleFocus = () => {
      refetchRef.current();
    };
    window.addEventListener('focus', handleFocus);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener('focus', handleFocus);
    };
  }, []); // Empty dependency array - only run once on mount

  // Filter trips by search term (client-side, within current page)
  const filteredTrips = trips.filter(trip => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      trip.trip_number?.toLowerCase().includes(search) ||
      trip.vehicle?.plate?.toLowerCase().includes(search) ||
      trip.driver?.full_name?.toLowerCase().includes(search) ||
      trip.notes?.toLowerCase().includes(search)
    );
  });

  // Pagination (server-side for total, client-side search mayลดจำนวนในหน้านั้น)
  const totalPages = Math.ceil((total || 0) / itemsPerPage) || 1;

  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, vehicleFilter, dateFrom, dateTo]);

  const getStatusBadge = (status: string) => {
    const badges = {
      planned: {
        label: 'รอจัดส่ง',
        className: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
        icon: Calendar,
      },
      in_progress: {
        label: 'กำลังจัดส่ง',
        className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
        icon: Clock,
      },
      completed: {
        label: 'จัดส่งเสร็จแล้ว',
        className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
        icon: CheckCircle,
      },
      cancelled: {
        label: 'ยกเลิก',
        className: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
        icon: X,
      },
    };

    const badge = badges[status as keyof typeof badges] || badges.planned;
    const Icon = badge.icon;

    return (
      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${badge.className}`}>
        <Icon size={12} />
        {badge.label}
      </span>
    );
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <PageLayout
      title="ทริปส่งสินค้า"
      subtitle="จัดการทริปส่งสินค้าและรายการสินค้า"
      actions={
        <Button onClick={onCreate} className="flex items-center gap-2">
          <Plus size={18} />
          สร้างทริปใหม่
        </Button>
      }
      loading={loading}
      error={!!error}
      onRetry={refetch}
    >
      {/* Filters */}
      <Card className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Filter size={20} />
            ตัวกรอง
          </h3>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="text-sm text-enterprise-600 dark:text-enterprise-400 hover:underline"
          >
            {showFilters ? 'ซ่อน' : 'แสดง'}
          </button>
        </div>

        {showFilters && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                สถานะ
              </label>
              <select
                value={Array.isArray(statusFilter) ? statusFilter.join(',') : statusFilter}
                onChange={(e) => {
                  const value = e.target.value;
                  setStatusFilter(value === 'all' ? 'all' : value.split(','));
                }}
                className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              >
                <option value="all">ทั้งหมด</option>
                <option value="planned">รอจัดส่ง</option>
                <option value="in_progress">กำลังจัดส่ง</option>
                <option value="completed">จัดส่งเสร็จแล้ว</option>
                <option value="cancelled">ยกเลิก</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                รถ
              </label>
              <select
                value={vehicleFilter}
                onChange={(e) => setVehicleFilter(e.target.value)}
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
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                วันที่สิ้นสุด
              </label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
          </div>
        )}

        <div>
          <Input
            label="ค้นหา"
            placeholder="ค้นหาจากรหัสทริป, ป้ายทะเบียน, ชื่อคนขับ..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            icon={<Search size={18} />}
          />
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
          <Package className="mx-auto mb-4 text-slate-400" size={48} />
          <p className="text-slate-600 dark:text-slate-400">
            {searchTerm || statusFilter !== 'all' || vehicleFilter || dateFrom || dateTo
              ? 'ไม่พบข้อมูลที่ค้นหา'
              : 'ยังไม่มีทริปส่งสินค้า'}
          </p>
        </Card>
      )}

      {/* Trips Grid */}
      {!loading && filteredTrips.length > 0 && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            {filteredTrips.map((trip) => (
              <Card
                key={trip.id}
                className="hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => onViewDetail?.(trip.id)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                      <span>{trip.trip_number || 'N/A'}</span>
                      {trip.has_item_changes && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                          <History size={12} />
                          มีการแก้ไขสินค้า
                        </span>
                      )}
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                      {formatDate(trip.planned_date)}
                    </p>
                  </div>
                  {getStatusBadge(trip.status)}
                </div>

                <div className="space-y-2 mb-4">
                  <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                    <Truck size={16} />
                    <span>{trip.vehicle?.plate || 'N/A'}</span>
                    {trip.vehicle?.make && trip.vehicle?.model && (
                      <span className="text-slate-400">({trip.vehicle.make} {trip.vehicle.model})</span>
                    )}
                  </div>

                  {trip.driver && (
                    <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                      <User size={16} />
                      <span>{trip.driver.full_name}</span>
                    </div>
                  )}

                  {trip.stores && trip.stores.length > 0 && (
                    <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                      <MapPin size={16} />
                      <span>{trip.stores.length} ร้าน</span>
                    </div>
                  )}

                  {trip.odometer_start && (
                    <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                      <Package size={16} />
                      <span>ไมล์เริ่มต้น: {trip.odometer_start.toLocaleString()}</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-700">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      onViewDetail?.(trip.id);
                    }}
                  >
                    <Eye size={16} className="mr-1" />
                    ดูรายละเอียด
                  </Button>
                </div>
              </Card>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <div className="text-sm text-slate-600 dark:text-slate-400">
                แสดง {startIndex + 1}-{Math.min(startIndex + itemsPerPage, filteredTrips.length)} จาก {filteredTrips.length} รายการ
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft size={16} />
                </Button>
                <span className="text-sm text-slate-600 dark:text-slate-400">
                  หน้า {currentPage} จาก {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  <ChevronRight size={16} />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </PageLayout>
  );
};

