// Delivery Trip List View - Display all delivery trips
import React, { useState, useEffect } from 'react';
import {
  Package,
  Plus,
  Search,
  Filter,
  Eye,
  Calendar,
  Truck,
  User,
  Users,
  MapPin,
  CheckCircle,
  Clock,
  X,
  AlertCircle,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Download,
  History,
  XCircle,
  Trash2,
  Layers,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card } from '../components/ui/Card';
import { PageLayout } from '../components/layout/PageLayout';
import { ImageModal } from '../components/ui/ImageModal';
import { useDeliveryTrips, useVehicles, useAuth } from '../hooks';
import { deliveryTripService, type DeliveryTripWithRelations } from '../services/deliveryTripService';
import { tripMetricsService } from '../services/tripMetricsService';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';

interface DeliveryTripListViewProps {
  onViewDetail?: (tripId: string) => void;
  onCreate?: () => void;
}

export const DeliveryTripListView: React.FC<DeliveryTripListViewProps> = ({
  onViewDetail,
  onCreate,
}) => {
  const { vehicles } = useVehicles();
  const { isReadOnly, profile } = useAuth(); // Get user profile for branch info
  // State for filters and pagination
  // Initialize from sessionStorage if available to persist state across navigation (e.g. back button)
  const getInitialState = <T,>(key: string, defaultValue: T): T => {
    try {
      if (typeof window === 'undefined') return defaultValue;
      const saved = sessionStorage.getItem(`deliveryTrips_${key}`);
      return saved ? JSON.parse(saved) : defaultValue;
    } catch (e) {
      console.error('Error loading state from sessionStorage:', e);
      return defaultValue;
    }
  };

  const [searchInput, setSearchInput] = useState<string>(() => getInitialState('searchInput', '')); // User input (immediate)
  const [searchTerm, setSearchTerm] = useState<string>(''); // Debounced search term (for query)
  const [statusFilter, setStatusFilter] = useState<string[] | 'all'>(() => getInitialState('statusFilter', 'all'));
  const [vehicleFilter, setVehicleFilter] = useState<string>(() => getInitialState('vehicleFilter', ''));
  const [branchFilter, setBranchFilter] = useState<string>(() => {
    // Default to user's branch, or 'ALL' if user is admin/manager
    const saved = getInitialState('branchFilter', '');
    if (saved) return saved;
    return profile?.branch || 'ALL';
  });
  const [dateFrom, setDateFrom] = useState<string>(() => getInitialState('dateFrom', ''));
  const [dateTo, setDateTo] = useState<string>(() => getInitialState('dateTo', ''));
  const [showFilters, setShowFilters] = useState(() => getInitialState('showFilters', false));
  const [onlyChanged, setOnlyChanged] = useState(() => getInitialState('onlyChanged', false));
  const [currentPage, setCurrentPage] = useState(() => getInitialState('currentPage', 1));
  const [pageInput, setPageInput] = useState('');

  const itemsPerPage = 20;

  // Debounce search input (wait 500ms after user stops typing)
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchTerm(searchInput);
    }, 500); // 500ms delay

    return () => clearTimeout(timer);
  }, [searchInput]);

  // Persist state to sessionStorage whenever it changes
  useEffect(() => {
    try {
      sessionStorage.setItem('deliveryTrips_searchInput', JSON.stringify(searchInput));
      sessionStorage.setItem('deliveryTrips_statusFilter', JSON.stringify(statusFilter));
      sessionStorage.setItem('deliveryTrips_vehicleFilter', JSON.stringify(vehicleFilter));
      sessionStorage.setItem('deliveryTrips_branchFilter', JSON.stringify(branchFilter));
      sessionStorage.setItem('deliveryTrips_dateFrom', JSON.stringify(dateFrom));
      sessionStorage.setItem('deliveryTrips_dateTo', JSON.stringify(dateTo));
      sessionStorage.setItem('deliveryTrips_showFilters', JSON.stringify(showFilters));
      sessionStorage.setItem('deliveryTrips_onlyChanged', JSON.stringify(onlyChanged));
      sessionStorage.setItem('deliveryTrips_currentPage', JSON.stringify(currentPage));
    } catch (e) {
      console.error('Error saving state to sessionStorage:', e);
    }
  }, [searchInput, statusFilter, vehicleFilter, branchFilter, dateFrom, dateTo, showFilters, onlyChanged, currentPage]);

  const [cancelTripId, setCancelTripId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);
  const [deleteTripId, setDeleteTripId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const { isAdmin, isManager } = useAuth();
  const [selectedImage, setSelectedImage] = useState<{ url: string; alt: string } | null>(null);
  const [tripsWithLayout, setTripsWithLayout] = useState<Set<string>>(new Set());

  const { trips, total, loading, error, refetch, prefetch } = useDeliveryTrips({
    status: statusFilter !== 'all' && Array.isArray(statusFilter) ? statusFilter : undefined,
    vehicle_id: vehicleFilter || undefined,
    planned_date_from: dateFrom || undefined,
    planned_date_to: dateTo || undefined,
    has_item_changes: onlyChanged ? true : undefined,
    search: searchTerm || undefined, // Pass search term to hook for database-level filtering
    branch: branchFilter || undefined, // Pass branch filter
    autoFetch: true,
    page: currentPage,
    pageSize: itemsPerPage,
    lite: true, // Use lite mode for list view optimization (fetches less data)
  });

  // Note: Removed auto-refetch on mount and window focus to avoid unnecessary reloads
  // Data will be fetched automatically by useDeliveryTrips hook when needed

  // Use trips directly - filtering is now done at database level
  const filteredTrips = trips;

  // Batch check which trips have packing layout
  useEffect(() => {
    if (filteredTrips.length === 0) return;
    const ids = filteredTrips.map((t) => t.id);
    tripMetricsService.getTripsWithPackingLayout(ids).then(setTripsWithLayout).catch(() => { });
  }, [filteredTrips]);

  // Pagination (server-side for total, client-side search mayลดจำนวนในหน้านั้น)
  const totalPages = Math.ceil((total || 0) / itemsPerPage) || 1;

  // Clear filters function
  const clearFilters = () => {
    setSearchInput(''); // Clear input (will trigger debounce to clear searchTerm)
    setStatusFilter('all');
    setVehicleFilter('');
    setBranchFilter(profile?.branch || 'ALL'); // Reset to user's branch
    setDateFrom('');
    setDateTo('');
    setOnlyChanged(false);
    setCurrentPage(1);
    // Session storage will be updated by the effect
  };

  // Reset to page 1 when filters or search change (like TripLogListView)
  // Use searchTerm (debounced) instead of searchInput to avoid resetting on every keystroke
  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, vehicleFilter, branchFilter, dateFrom, dateTo, onlyChanged, searchTerm]); // Use debounced searchTerm, not searchInput

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
        <Button
          onClick={isReadOnly ? undefined : onCreate}
          disabled={isReadOnly}
          className="flex items-center gap-2"
        >
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
          <div className="flex items-center gap-4">
            {(statusFilter !== 'all' || vehicleFilter || branchFilter !== (profile?.branch || 'ALL') || dateFrom || dateTo || onlyChanged || searchInput) && (
              <button
                onClick={clearFilters}
                className="text-sm text-red-600 dark:text-red-400 hover:underline flex items-center gap-1"
              >
                <XCircle size={14} />
                ล้างตัวกรอง
              </button>
            )}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="text-sm text-enterprise-600 dark:text-enterprise-400 hover:underline"
            >
              {showFilters ? 'ซ่อน' : 'แสดง'}
            </button>
          </div>
        </div>

        {showFilters && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                สาขา
              </label>
              <select
                value={branchFilter}
                onChange={(e) => setBranchFilter(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              >
                <option value="ALL">ทั้งหมด</option>
                <option value="HQ">สำนักงานใหญ่</option>
                <option value="SD">สาขาสอยดาว</option>
              </select>
            </div>

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

            <div className="flex items-end">
              <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  className="rounded border-slate-300 dark:border-slate-600 text-enterprise-600 focus:ring-enterprise-500"
                  checked={onlyChanged}
                  onChange={(e) => setOnlyChanged(e.target.checked)}
                />
                แสดงเฉพาะทริปที่มีการแก้ไขสินค้า
              </label>
            </div>
          </div>
        )}

        <div>
          <Input
            label="ค้นหา"
            placeholder="ค้นหาจากรหัสทริป, ป้ายทะเบียน, ชื่อคนขับ..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
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
            {searchInput || statusFilter !== 'all' || vehicleFilter || branchFilter !== (profile?.branch || 'ALL') || dateFrom || dateTo
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
                      <span>
                        {trip.trip_number ||
                          (trip.sequence_order ? `ทริป #${trip.sequence_order}` : `ทริป #${trip.id.substring(0, 8)}`)}
                      </span>
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
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      {tripsWithLayout.has(trip.id) && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200">
                          <Layers size={11} />
                          จัดเรียงแล้ว
                        </span>
                      )}
                      {(trip as any).actual_pallets_used != null && (
                        <span className="text-xs text-slate-400 dark:text-slate-500">
                          บันทึกเมตริกซ์แล้ว
                        </span>
                      )}
                    </div>
                  </div>
                  {getStatusBadge(trip.status)}
                </div>

                <div className="space-y-2 mb-4">
                  <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                    {trip.vehicle?.image_url ? (
                      <img
                        src={trip.vehicle.image_url}
                        alt={trip.vehicle.plate || 'Vehicle'}
                        className="w-8 h-8 rounded object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <Truck size={16} />
                    )}
                    <span>{trip.vehicle?.plate || 'N/A'}</span>
                    {trip.vehicle?.make && trip.vehicle?.model && (
                      <span className="text-slate-400">({trip.vehicle.make} {trip.vehicle.model})</span>
                    )}
                  </div>

                  {trip.driver && (
                    <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                      {trip.driver.avatar_url ? (
                        <img
                          src={trip.driver.avatar_url}
                          alt={trip.driver.full_name || 'Driver'}
                          className="w-8 h-8 rounded-full object-cover cursor-pointer hover:ring-2 hover:ring-enterprise-500 transition-all"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedImage({
                              url: trip.driver.avatar_url!,
                              alt: trip.driver.full_name || 'Driver'
                            });
                          }}
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        <User size={16} />
                      )}
                      <span>{trip.driver.full_name}</span>
                    </div>
                  )}

                  {trip.stores && trip.stores.length > 0 && (
                    <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                      <MapPin size={16} />
                      <span>{trip.stores.length} ร้าน</span>
                    </div>
                  )}

                  {/* Crew Status */}
                  {(() => {
                    const crews = trip.crews || [];
                    const driverCrew = crews.find(c => c.role === 'driver');
                    const helperCrews = crews.filter(c => c.role === 'helper');
                    const hasCrew = crews.length > 0;
                    const hasDriver = !!driverCrew;
                    const hasHelpers = helperCrews.length > 0;

                    if (!hasCrew && trip.status !== 'cancelled') {
                      return (
                        <div className="flex items-center gap-2 text-sm">
                          <AlertTriangle size={16} className="text-red-500" />
                          <span className="text-red-600 dark:text-red-400 font-medium">
                            ยังไม่ได้จัดพนักงาน
                          </span>
                        </div>
                      );
                    }

                    if (hasCrew) {
                      return (
                        <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                          <Users size={16} className={hasDriver ? 'text-green-500' : 'text-amber-500'} />
                          <span>
                            {hasDriver
                              ? `${driverCrew?.staff?.name || 'คนขับ'}`
                              : <span className="text-amber-600 dark:text-amber-400">ยังไม่มีคนขับ</span>
                            }
                            {hasHelpers ? (
                              <span className="text-slate-400"> + {helperCrews.length} พนักงานบริการ</span>
                            ) : (
                              hasDriver && (
                                <span className="ml-1 text-amber-600 dark:text-amber-400">
                                  (ยังไม่ได้จัดพนักงานบริการ)
                                </span>
                              )
                            )}
                          </span>
                        </div>
                      );
                    }

                    return null;
                  })()}

                  {trip.odometer_start && (
                    <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                      <Package size={16} />
                      <span>ไมล์เริ่มต้น: {trip.odometer_start.toLocaleString()}</span>
                    </div>
                  )}
                </div>

                <div
                  className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-700 gap-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onViewDetail?.(trip.id)}
                  >
                    <Eye size={16} className="mr-1" />
                    ดูรายละเอียด
                  </Button>
                  <div className="flex items-center gap-2">
                    {(trip.status === 'planned' || trip.status === 'in_progress') && (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={isReadOnly}
                        onClick={() => {
                          if (isReadOnly) return;
                          console.log('[DeliveryTripListView] Cancel button clicked for trip:', trip.id);
                          setCancelTripId(trip.id);
                        }}
                        className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                      >
                        <XCircle size={16} className="mr-1" />
                        ยกเลิก
                      </Button>
                    )}
                    {(isAdmin || isManager) && trip.status !== 'completed' && (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={isReadOnly || isDeleting}
                        onClick={() => {
                          if (isReadOnly) return;
                          setDeleteTripId(trip.id);
                        }}
                        className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 border-red-300 dark:border-red-700"
                      >
                        <Trash2 size={16} className="mr-1" />
                        ลบ
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <Card className="p-4 mt-6">
              <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="text-sm text-slate-600 dark:text-slate-400">
                  แสดงหน้า {currentPage} จาก {totalPages} ({total.toLocaleString('th-TH')} รายการ)
                </div>
                <div className="flex items-center gap-2 flex-wrap justify-center">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    onMouseEnter={() => {
                      if (currentPage > 1) {
                        prefetch?.(currentPage - 1);
                      }
                    }}
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
                            onMouseEnter={() => prefetch?.(page)}
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

                  {/* Jump to Page Input */}
                  {totalPages > 1 && (
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
                        className="w-20 px-2 py-1 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-enterprise-500 focus:border-transparent"
                        placeholder={`1-${totalPages}`}
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
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    onMouseEnter={() => {
                      if (currentPage < totalPages) {
                        prefetch?.(currentPage + 1);
                      }
                    }}
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
        </>
      )}

      {/* Cancel Trip Dialog */}
      <ConfirmDialog
        isOpen={cancelTripId !== null}
        onCancel={() => {
          setCancelTripId(null);
          setCancelReason('');
        }}
        onConfirm={async () => {
          if (isReadOnly) return;
          if (!cancelTripId) return;
          console.log('[DeliveryTripListView] Confirming cancel for trip:', cancelTripId);
          setIsCancelling(true);
          try {
            await deliveryTripService.cancel(cancelTripId, cancelReason || undefined);
            console.log('[DeliveryTripListView] Trip cancelled successfully');
            setCancelTripId(null);
            setCancelReason('');
            // Wait a bit before refetching to ensure database is updated
            setTimeout(async () => {
              await refetch();
            }, 500);
          } catch (err: any) {
            console.error('[DeliveryTripListView] Error cancelling trip:', err);
            const errorMessage = err.message || 'เกิดข้อผิดพลาดในการยกเลิกทริป';
            alert(errorMessage);
            // Don't close dialog on error so user can see the error message
          } finally {
            setIsCancelling(false);
          }
        }}
        title="ยกเลิกทริปส่งสินค้า"
        message={
          <div className="space-y-4" onClick={(e) => e.stopPropagation()}>
            <p>คุณต้องการยกเลิกทริปส่งสินค้านี้หรือไม่?</p>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                เหตุผล (ไม่บังคับ)
              </label>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                placeholder="ระบุเหตุผลในการยกเลิกทริป..."
                className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                rows={3}
              />
            </div>
          </div>
        }
        confirmText="ยืนยันยกเลิกทริป"
        cancelText="ยกเลิก"
        variant="danger"
      />

      {/* Delete Trip Dialog */}
      <ConfirmDialog
        isOpen={deleteTripId !== null}
        onCancel={() => {
          setDeleteTripId(null);
        }}
        onConfirm={async () => {
          if (isReadOnly) return;
          if (!deleteTripId) return;
          console.log('[DeliveryTripListView] Confirming delete for trip:', deleteTripId);
          setIsDeleting(true);
          try {
            await deliveryTripService.delete(deleteTripId);
            console.log('[DeliveryTripListView] Trip deleted successfully');
            setDeleteTripId(null);
            // แจ้งให้หน้าออเดอร์ที่รอจัดทริป refetch เมื่อผู้ใช้ไปที่หน้านั้น
            window.dispatchEvent(new CustomEvent('trip-deleted'));
            // Wait a bit before refetching to ensure database is updated
            setTimeout(async () => {
              await refetch();
            }, 500);
          } catch (err: any) {
            console.error('[DeliveryTripListView] Error deleting trip:', err);
            const errorMessage = err.message || 'เกิดข้อผิดพลาดในการลบทริป';
            alert(errorMessage);
            // Don't close dialog on error so user can see the error message
          } finally {
            setIsDeleting(false);
          }
        }}
        title="ลบทริปส่งสินค้า"
        message={
          <div className="space-y-2">
            <p className="font-semibold text-red-600 dark:text-red-400">
              ⚠️ คำเตือน: การลบทริปนี้จะลบข้อมูลทั้งหมดและไม่สามารถกู้คืนได้!
            </p>
            <p>คุณแน่ใจหรือไม่ว่าต้องการลบทริปส่งสินค้านี้?</p>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              ข้อมูลที่จะถูกลบ: ทริป, ร้านค้า, สินค้า, และประวัติทั้งหมด
            </p>
          </div>
        }
        confirmText={isDeleting ? 'กำลังลบ...' : 'ยืนยันลบทริป'}
        cancelText="ยกเลิก"
        variant="danger"
      />

      {/* Image Modal */}
      <ImageModal
        isOpen={!!selectedImage}
        imageUrl={selectedImage?.url || ''}
        alt={selectedImage?.alt || ''}
        onClose={() => setSelectedImage(null)}
      />
    </PageLayout>
  );
};

