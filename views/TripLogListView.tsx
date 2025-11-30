// Trip Log List View - Display trip history
import React, { useState, useMemo, useEffect } from 'react';
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
  Plus,
  ChevronLeft,
  ChevronRight,
  X,
  ZoomIn,
  Package
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card } from '../components/ui/Card';
import { PageLayout } from '../components/layout/PageLayout';
import { Avatar } from '../components/ui/Avatar';
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
    branch?: string;
  }>({});

  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageInput, setPageInput] = useState('');
  const itemsPerPage = 20;
  const [expandedImage, setExpandedImage] = useState<{ src: string; alt: string } | null>(null);

  // Calculate pagination
  const offset = (currentPage - 1) * itemsPerPage;

  // Fetch trips with server-side pagination
  const { trips, totalCount, loading, error, refetch } = useTripLogs({
    ...filters,
    limit: itemsPerPage,
    offset: offset,
    search: searchTerm || undefined,
  });

  // Pagination (using server-side count)
  const totalPages = Math.ceil(totalCount / itemsPerPage);
  const startIndex = offset;
  const endIndex = Math.min(startIndex + itemsPerPage, totalCount);

  // Reset to page 1 when filters or search change
  useEffect(() => {
    setCurrentPage(1);
  }, [filters, searchTerm]);

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

  // Get unique branches from vehicles
  const branches = useMemo(() => {
    const uniqueBranches = new Set<string>();
    vehicles.forEach(v => {
      if (v.branch) {
        uniqueBranches.add(v.branch);
      }
    });
    return Array.from(uniqueBranches).sort();
  }, [vehicles]);

  // Filter vehicles by branch if branch filter is selected
  const filteredVehicles = useMemo(() => {
    if (!filters.branch) return vehicles;
    return vehicles.filter(v => v.branch === filters.branch);
  }, [vehicles, filters.branch]);

  // Filter trips by branch if branch filter is active but no specific vehicle is selected
  const displayedTrips = useMemo(() => {
    if (!filters.branch || filters.vehicle_id) return trips;
    // Filter by vehicle branch
    return trips.filter(trip => {
      const vehicle = vehicles.find(v => v.id === trip.vehicle_id);
      return vehicle?.branch === filters.branch;
    });
  }, [trips, vehicles, filters.branch, filters.vehicle_id]);

  // Adjust total count if filtering by branch
  const displayedTotalCount = useMemo(() => {
    if (!filters.branch || filters.vehicle_id) return totalCount;
    return displayedTrips.length;
  }, [totalCount, displayedTrips, filters.branch, filters.vehicle_id]);

  return (
    <PageLayout
      title="ประวัติการเดินทาง"
      subtitle={loading ? 'กำลังโหลด...' : `ทั้งหมด ${displayedTotalCount.toLocaleString('th-TH')} รายการ${totalPages > 1 ? ` (หน้า ${currentPage}/${totalPages})` : ''}`}
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

          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {/* Branch Filter */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                สาขา
              </label>
              <select
                value={filters.branch || ''}
                onChange={(e) => {
                  setFilters({ ...filters, branch: e.target.value || undefined, vehicle_id: undefined });
                }}
                className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              >
                <option value="">ทั้งหมด</option>
                {branches.map((branch) => (
                  <option key={branch} value={branch}>
                    {branch}
                  </option>
                ))}
              </select>
            </div>

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
                {filteredVehicles.map((vehicle) => (
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

          {/* Branch filter info */}
          {filters.branch && (
            <div className="text-sm text-slate-600 dark:text-slate-400 mt-2">
              กำลังแสดงเฉพาะรถในสาขา: <span className="font-medium">{filters.branch}</span>
            </div>
          )}

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
      {!loading && displayedTotalCount === 0 && (
        <Card className="p-12 text-center">
          <Truck className="mx-auto mb-4 text-slate-400" size={48} />
          <p className="text-slate-600 dark:text-slate-400">
            {searchTerm || Object.keys(filters).length > 0
              ? 'ไม่พบข้อมูลที่ค้นหา'
              : 'ยังไม่มีข้อมูลการเดินทาง'}
          </p>
        </Card>
      )}

      {!loading && totalCount > 0 && (
        <>
          <div className="space-y-4">
            <div className="text-sm text-slate-600 dark:text-slate-400 mb-4">
              พบทั้งหมด {totalCount.toLocaleString('th-TH')} รายการ
            </div>

            {displayedTrips.map((trip) => (
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
                        <div className="flex items-center gap-2 mt-1">
                          {trip.driver?.avatar_url ? (
                            <button
                              onClick={() => setExpandedImage({
                                src: trip.driver.avatar_url!,
                                alt: trip.driver.full_name || 'Driver'
                              })}
                              className="relative group cursor-pointer transition-transform hover:scale-105"
                              title="คลิกเพื่อขยายรูป"
                            >
                              <Avatar
                                src={trip.driver.avatar_url}
                                alt={trip.driver.full_name || 'Driver'}
                                size="sm"
                                fallback={trip.driver.full_name}
                                className="ring-2 ring-transparent group-hover:ring-enterprise-500 transition-all"
                              />
                              <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/20 rounded-full transition-colors">
                                <ZoomIn size={12} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                              </div>
                            </button>
                          ) : (
                            <Avatar
                              src={trip.driver?.avatar_url}
                              alt={trip.driver?.full_name || 'Driver'}
                              size="sm"
                              fallback={trip.driver?.full_name}
                            />
                          )}
                          <p className="text-sm text-slate-600 dark:text-slate-400">
                            {trip.driver?.full_name || 'N/A'}
                          </p>
                        </div>
                        {trip.delivery_trip?.trip_number && (
                          <div className="flex items-center gap-2 mt-2">
                            <Package size={14} className="text-enterprise-600 dark:text-enterprise-400" />
                            <span className="text-xs font-medium text-enterprise-600 dark:text-enterprise-400 bg-enterprise-50 dark:bg-enterprise-900/30 px-2 py-0.5 rounded">
                              {trip.delivery_trip.trip_number}
                            </span>
                          </div>
                        )}
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

            {/* Pagination */}
            {totalPages > 1 && (
              <Card className="p-4 mt-6">
                <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                  <div className="text-sm text-slate-600 dark:text-slate-400">
                    แสดง {startIndex + 1}-{endIndex} จาก {totalCount.toLocaleString('th-TH')} รายการ
                    {totalPages > 1 && (
                      <span className="ml-2">(ทั้งหมด {totalPages.toLocaleString('th-TH')} หน้า)</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap justify-center">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                      className="flex items-center gap-1"
                    >
                      <ChevronLeft size={16} />
                      ก่อนหน้า
                    </Button>

                    {/* Page Numbers */}
                    <div className="flex items-center gap-1 flex-wrap">
                      {(() => {
                        const pages: (number | string)[] = [];

                        // For small number of pages, show all
                        if (totalPages <= 7) {
                          for (let i = 1; i <= totalPages; i++) {
                            pages.push(i);
                          }
                        } else {
                          // Always show first page
                          pages.push(1);

                          // Calculate range around current page (show 2 pages on each side)
                          const startPage = Math.max(2, currentPage - 2);
                          const endPage = Math.min(totalPages - 1, currentPage + 2);

                          // Add ellipsis if needed before current range
                          if (startPage > 2) {
                            pages.push('ellipsis-start');
                          }

                          // Add pages around current page
                          for (let i = startPage; i <= endPage; i++) {
                            if (i !== 1 && i !== totalPages) {
                              pages.push(i);
                            }
                          }

                          // Add ellipsis if needed after current range
                          if (endPage < totalPages - 1) {
                            pages.push('ellipsis-end');
                          }

                          // Always show last page
                          pages.push(totalPages);
                        }

                        return pages.map((page) => {
                          if (typeof page === 'string') {
                            return (
                              <span key={page} className="px-2 text-slate-400">
                                ...
                              </span>
                            );
                          }

                          return (
                            <button
                              key={page}
                              onClick={() => setCurrentPage(page)}
                              className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${currentPage === page
                                  ? 'bg-enterprise-600 text-white'
                                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                                }`}
                            >
                              {page.toLocaleString('th-TH')}
                            </button>
                          );
                        });
                      })()}
                    </div>

                    {/* Jump to Page Input (for large page counts) */}
                    {totalPages > 10 && (
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-slate-600 dark:text-slate-400">ไปที่หน้า:</span>
                        <input
                          type="number"
                          min="1"
                          max={totalPages}
                          value={pageInput}
                          onChange={(e) => setPageInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              const page = parseInt(pageInput);
                              if (page >= 1 && page <= totalPages) {
                                setCurrentPage(page);
                                setPageInput('');
                              }
                            }
                          }}
                          placeholder={`1-${totalPages}`}
                          className="w-20 px-2 py-1 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-enterprise-500 focus:border-transparent"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const page = parseInt(pageInput);
                            if (page >= 1 && page <= totalPages) {
                              setCurrentPage(page);
                              setPageInput('');
                            }
                          }}
                          disabled={!pageInput || parseInt(pageInput) < 1 || parseInt(pageInput) > totalPages}
                        >
                          ไป
                        </Button>
                      </div>
                    )}

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                      className="flex items-center gap-1"
                    >
                      ถัดไป
                      <ChevronRight size={16} />
                    </Button>
                  </div>
                </div>
              </Card>
            )}
          </div>
        </>
      )}

      {/* Image Expansion Modal */}
      {expandedImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={() => setExpandedImage(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] w-full">
            <button
              onClick={() => setExpandedImage(null)}
              className="absolute -top-12 right-0 text-white hover:text-slate-300 transition-colors p-2"
              aria-label="ปิด"
            >
              <X size={24} />
            </button>
            <div className="bg-white dark:bg-slate-800 rounded-lg overflow-hidden shadow-2xl">
              <img
                src={expandedImage.src}
                alt={expandedImage.alt}
                className="w-full h-auto max-h-[80vh] object-contain"
                onClick={(e) => e.stopPropagation()}
              />
              <div className="p-4 border-t border-slate-200 dark:border-slate-700">
                <p className="text-center text-slate-700 dark:text-slate-300 font-medium">
                  {expandedImage.alt}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </PageLayout>
  );
};

