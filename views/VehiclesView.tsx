// Vehicles View - List all vehicles with filters and search
import React, { useState, useMemo, useCallback } from 'react';
import { useVehicles, useVehiclesWithStatus } from '../hooks';
import { useFeatureAccess } from '../hooks/useFeatureAccess';
import {
  Truck,
  Plus,
  Search,
  Filter,
  Edit,
  Eye,
  MapPin,
  Activity,
  Wrench,
  Clock,
  X,
  AlertTriangle,
  RefreshCw
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card } from '../components/ui/Card';
import { PageLayout } from '../components/layout/PageLayout';
import { VehicleGroupBadge } from '../components/vehicle/VehicleGroupBadge';
import { VehicleDocumentBadge } from '../components/vehicle/VehicleDocumentBadge';
import { ImageModal } from '../components/ui/ImageModal';
import { getBranchLabel } from '../utils/branchLabels';
import type { Database } from '../types/database';

type Vehicle = Database['public']['Tables']['vehicles']['Row'];
type VehicleWithStatus = Database['public']['Views']['vehicles_with_status']['Row'];

// Vehicle Card Component - Memoized to prevent unnecessary re-renders
interface VehicleCardProps {
  vehicle: Vehicle;
  statusBadge: {
    label: string;
    className: string;
    icon: React.ComponentType<{ className?: string; size?: number }>;
  };
  canEdit: boolean;
  onViewDetail?: (vehicleId: string) => void;
  onEdit?: (vehicleId: string) => void;
}

const VehicleCard = React.memo<VehicleCardProps>(({
  vehicle,
  statusBadge,
  canEdit,
  onViewDetail,
  onEdit,
}) => {
  const [isImageOpen, setIsImageOpen] = useState(false);
  const fallbackImageUrl =
    'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&q=80&w=1000';
  const imageUrl = vehicle.image_url || fallbackImageUrl;
  const StatusIcon = statusBadge.icon;
  const handleViewDetail = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    onViewDetail?.(vehicle.id);
  }, [vehicle.id, onViewDetail]);

  const handleEdit = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    onEdit?.(vehicle.id);
  }, [vehicle.id, onEdit]);

  const handleImageError = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    e.currentTarget.src = fallbackImageUrl;
  }, []);

  return (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow group">
      <div className="relative h-48 bg-slate-100 dark:bg-slate-800">
        <img
          src={imageUrl}
          alt={vehicle.plate}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105 cursor-zoom-in"
          onError={handleImageError}
          loading="lazy"
          onClick={() => setIsImageOpen(true)}
        />
        <div className="absolute top-3 right-3 flex flex-col gap-2 items-end">
          <span className={`px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1 shadow-sm ${statusBadge.className}`}>
            <StatusIcon className="w-3 h-3" />
            {statusBadge.label}
          </span>
          <VehicleDocumentBadge vehicleId={vehicle.id} compact={true} />
        </div>
      </div>
      <ImageModal
        isOpen={isImageOpen}
        imageUrl={imageUrl}
        alt={vehicle.plate}
        onClose={() => setIsImageOpen(false)}
      />

      <div className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-enterprise-100 dark:bg-enterprise-900 rounded-lg">
              <Truck className="w-5 h-5 text-enterprise-600 dark:text-enterprise-400" />
            </div>
            <div>
              <h3 className="font-semibold text-lg text-slate-900 dark:text-white">
                {vehicle.plate}
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {vehicle.make} {vehicle.model}
              </p>
              {vehicle.owner_group && (
                <div className="mt-1">
                  <VehicleGroupBadge ownerGroup={vehicle.owner_group} />
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-2 mb-4">
          {vehicle.type && (
            <div className="flex items-center text-sm text-slate-600 dark:text-slate-400">
              <span className="w-20">ประเภท:</span>
              <span className="font-medium">{vehicle.type}</span>
            </div>
          )}
          {vehicle.branch && (
            <div className="flex items-center text-sm text-slate-600 dark:text-slate-400">
              <MapPin className="w-4 h-4 mr-1" />
              <span>{vehicle.branch}</span>
            </div>
          )}
          <VehicleDocumentBadge vehicleId={vehicle.id} compact={false} />
        </div>

        <div className="flex gap-2 pt-4 border-t border-slate-200 dark:border-slate-700">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={handleViewDetail}
          >
            <Eye className="w-4 h-4 mr-1" />
            ดูรายละเอียด
          </Button>
          {canEdit && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleEdit}
            >
              <Edit className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}, (prevProps, nextProps) => {
  // Custom comparison function for React.memo
  return (
    prevProps.vehicle.id === nextProps.vehicle.id &&
    prevProps.vehicle.plate === nextProps.vehicle.plate &&
    prevProps.vehicle.make === nextProps.vehicle.make &&
    prevProps.vehicle.model === nextProps.vehicle.model &&
    prevProps.vehicle.branch === nextProps.vehicle.branch &&
    prevProps.vehicle.type === nextProps.vehicle.type &&
    prevProps.vehicle.image_url === nextProps.vehicle.image_url &&
    prevProps.statusBadge.label === nextProps.statusBadge.label &&
    prevProps.canEdit === nextProps.canEdit
  );
});

VehicleCard.displayName = 'VehicleCard';

interface VehiclesViewProps {
  onViewDetail?: (vehicleId: string) => void;
  onEdit?: (vehicleId: string) => void;
  onCreate?: () => void;
}

export const VehiclesView: React.FC<VehiclesViewProps> = ({
  onViewDetail,
  onEdit,
  onCreate,
}) => {
  console.log('[VehiclesView] ✅✅✅ Component rendered - START');
  console.log('[VehiclesView] Props:', { onViewDetail: !!onViewDetail, onEdit: !!onEdit, onCreate: !!onCreate });
  
  const { can, loading: featureAccessLoading } = useFeatureAccess();
  const canViewVehicles = can('tab.vehicles', 'view');
  const canEdit = can('tab.vehicles', 'edit');
  console.log('[VehiclesView] Access:', { canViewVehicles, canEdit });
  const { vehicles, loading, error, refetch } = useVehicles({
    autoFetch: !featureAccessLoading && canViewVehicles,
  });
  
  // Try to get vehicles with status, but don't block if it fails
  const { vehicles: vehiclesWithStatus, loading: loadingStatus, error: statusError, refetch: refetchStatus } = useVehiclesWithStatus({
    autoFetch: !featureAccessLoading && canViewVehicles,
  });
  
  // If status view fails, we can still show vehicles without status
  const hasStatusData = !statusError && vehiclesWithStatus && vehiclesWithStatus.length > 0;

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'maintenance' | 'idle'>('all');
  const [branchFilter, setBranchFilter] = useState<string>('all');
  const [ownerGroupFilter, setOwnerGroupFilter] = useState<'all' | 'thaikit' | 'sing_chanthaburi' | 'rental'>('all');
  const [showFilters, setShowFilters] = useState(false);

  // Memoize filter handlers to prevent unnecessary re-renders
  const handleStatusFilterAll = useCallback(() => setStatusFilter('all'), []);
  const handleStatusFilterActive = useCallback(() => setStatusFilter('active'), []);
  const handleStatusFilterMaintenance = useCallback(() => setStatusFilter('maintenance'), []);
  const handleStatusFilterIdle = useCallback(() => setStatusFilter('idle'), []);
  const handleToggleFilters = useCallback(() => setShowFilters(prev => !prev), []);

  // Create status map from vehiclesWithStatus
  // If status view is not available, all vehicles default to 'idle'
  const statusMap = useMemo(() => {
    const map = new Map<string, 'active' | 'maintenance' | 'idle'>();
    if (hasStatusData && vehiclesWithStatus && Array.isArray(vehiclesWithStatus) && vehiclesWithStatus.length > 0) {
      vehiclesWithStatus.forEach(v => {
        if (v && v.id && v.status) {
          map.set(v.id, v.status as 'active' | 'maintenance' | 'idle');
        }
      });
    }
    // If no status data, all vehicles default to 'idle' (don't block rendering)
    return map;
  }, [vehiclesWithStatus, hasStatusData]);

  // Get unique branches
  const branches = useMemo(() => {
    const branchSet = new Set<string>();
    vehicles.forEach(v => {
      if (v.branch) branchSet.add(v.branch);
    });
    return Array.from(branchSet).sort();
  }, [vehicles]);

  // Filter vehicles - Optimized with useMemo to prevent recalculation on every render
  const filteredVehicles = useMemo(() => {
    // Early return if no vehicles
    if (vehicles.length === 0) return [];

    let filtered = vehicles;

    // Search filter - use early return for better performance
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(v => {
        const plate = v.plate?.toLowerCase() || '';
        const make = v.make?.toLowerCase() || '';
        const model = v.model?.toLowerCase() || '';
        const branch = v.branch?.toLowerCase() || '';
        return plate.includes(query) || make.includes(query) || model.includes(query) || branch.includes(query);
      });
    }

    // Status filter (only if status map has data)
    if (statusFilter !== 'all' && statusMap.size > 0) {
      filtered = filtered.filter(v => {
        const status = statusMap.get(v.id) || 'idle';
        return status === statusFilter;
      });
    }

    // Branch filter
    if (branchFilter !== 'all') {
      filtered = filtered.filter(v => v.branch === branchFilter);
    }

    // Owner group filter
    if (ownerGroupFilter !== 'all') {
      filtered = filtered.filter(v => v.owner_group === ownerGroupFilter);
    }

    return filtered;
  }, [vehicles, searchQuery, statusFilter, branchFilter, ownerGroupFilter, statusMap]);

  // Log initial state - moved after filteredVehicles declaration
  React.useEffect(() => {
    console.log('[VehiclesView] Initial render:', {
      vehiclesCount: vehicles.length,
      loading,
      hasError: !!error,
      errorMessage: error?.message,
      vehiclesWithStatusCount: vehiclesWithStatus?.length || 0,
      loadingStatus,
      hasStatusError: !!statusError,
      statusErrorMessage: statusError?.message,
      hasStatusData,
      filteredVehiclesCount: filteredVehicles.length,
    });
  }, []); // Only log on mount

  // Debug logging for production issues
  React.useEffect(() => {
    console.log('[VehiclesView] State:', {
      vehiclesCount: vehicles.length,
      loading,
      hasError: !!error,
      errorMessage: error?.message,
      vehiclesWithStatusCount: vehiclesWithStatus?.length || 0,
      loadingStatus,
      hasStatusError: !!statusError,
      statusErrorMessage: statusError?.message,
      filteredVehiclesCount: filteredVehicles.length,
    });
  }, [vehicles, loading, error, vehiclesWithStatus, loadingStatus, statusError, filteredVehicles]);

  const getStatusBadge = (vehicleId: string) => {
    // If status map is empty or error, default to idle
    const status = (statusMap.size > 0 ? statusMap.get(vehicleId) : null) || 'idle';
    const badges = {
      active: {
        label: 'ใช้งาน',
        className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
        icon: Activity,
      },
      maintenance: {
        label: 'ซ่อมบำรุง',
        className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
        icon: Wrench,
      },
      idle: {
        label: 'ว่าง',
        className: 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-200',
        icon: Clock,
      },
    };
    return badges[status];
  };

  // Never show loading state - always show UI (even if empty or error)
  // This prevents infinite loading when API calls timeout or are slow
  // Data will appear when it's ready
  const showLoading = false; // Always false - never show loading spinner
  const showError = false; // Don't show error state - show UI with empty data instead

  console.log('[VehiclesView] About to render:', {
    vehiclesCount: vehicles.length,
    filteredVehiclesCount: filteredVehicles.length,
    loading,
    hasError: !!error,
    showLoading,
    showError,
  });

  if (featureAccessLoading) {
    return <PageLayout title="ยานพาหนะ" loading={true} />;
  }

  if (!canViewVehicles) {
    return (
      <PageLayout title="ยานพาหนะ">
        <Card className="p-12 text-center">
          <Truck className="w-16 h-16 mx-auto mb-4 text-slate-400 opacity-50" />
          <h3 className="text-lg font-medium text-slate-600 dark:text-slate-300 mb-2">
            คุณไม่มีสิทธิ์เข้าถึงหน้านี้
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            ต้องได้รับสิทธิ์ "ยานพาหนะ" ก่อนใช้งาน
          </p>
        </Card>
      </PageLayout>
    );
  }

  return (
    <PageLayout
      title="ยานพาหนะ"
      subtitle={`ทั้งหมด ${filteredVehicles.length} คัน${!hasStatusData && statusError ? ' (แสดงเฉพาะข้อมูลพื้นฐาน)' : ''}`}
      loading={showLoading}
      error={showError}
      onRetry={() => {
        console.log('[VehiclesView] Retry clicked');
        refetch();
        if (statusError) {
          refetchStatus();
        }
      }}
      actions={
        <div className="flex gap-3">
          {canEdit && (
            <Button onClick={onCreate}>
              <Plus className="w-4 h-4 mr-2" />
              เพิ่มยานพาหนะ
            </Button>
          )}
          <Button
            variant="outline"
            onClick={handleToggleFilters}
          >
            <Filter className="w-4 h-4 mr-2" />
            กรอง
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Search and Filters */}
        <Card className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                <Input
                  type="text"
                  placeholder="ค้นหาจากป้ายทะเบียน, ยี่ห้อ, รุ่น, สาขา..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Quick Status Filters */}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={handleStatusFilterAll}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${statusFilter === 'all'
                    ? 'bg-enterprise-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
              >
                ทั้งหมด
              </button>
              <button
                onClick={handleStatusFilterActive}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${statusFilter === 'active'
                    ? 'bg-green-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
              >
                ใช้งาน
              </button>
              <button
                onClick={handleStatusFilterMaintenance}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${statusFilter === 'maintenance'
                    ? 'bg-yellow-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
              >
                ซ่อมบำรุง
              </button>
              <button
                onClick={handleStatusFilterIdle}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${statusFilter === 'idle'
                    ? 'bg-slate-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
              >
                ว่าง
              </button>
            </div>
          </div>

          {/* Quick Owner Group Filters */}
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={() => setOwnerGroupFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                ownerGroupFilter === 'all'
                  ? 'bg-enterprise-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              ทุกกลุ่ม
            </button>
            <button
              onClick={() => setOwnerGroupFilter('thaikit')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                ownerGroupFilter === 'thaikit'
                  ? 'bg-blue-600 text-white'
                  : 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/30'
              }`}
            >
              บริษัทไทยกิจ
            </button>
            <button
              onClick={() => setOwnerGroupFilter('sing_chanthaburi')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                ownerGroupFilter === 'sing_chanthaburi'
                  ? 'bg-green-600 text-white'
                  : 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-900/30'
              }`}
            >
              บริษัทสิงห์จันทบุรีจำกัด
            </button>
            <button
              onClick={() => setOwnerGroupFilter('rental')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                ownerGroupFilter === 'rental'
                  ? 'bg-purple-600 text-white'
                  : 'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/30'
              }`}
            >
              รถเช่า
            </button>
          </div>

          {/* Advanced Filters */}
          {showFilters && (
            <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    สาขา
                  </label>
                  <select
                    value={branchFilter}
                    onChange={(e) => setBranchFilter(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-enterprise-500 focus:border-transparent"
                  >
                    <option value="all">ทุกสาขา</option>
                    {branches.map(branch => (
                      <option key={branch} value={branch}>{getBranchLabel(branch)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    กลุ่มเจ้าของรถ
                  </label>
                  <select
                    value={ownerGroupFilter}
                    onChange={(e) => setOwnerGroupFilter(e.target.value as 'all' | 'thaikit' | 'sing_chanthaburi' | 'rental')}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-enterprise-500 focus:border-transparent"
                  >
                    <option value="all">ทุกกลุ่ม</option>
                    <option value="thaikit">บริษัทไทยกิจ</option>
                    <option value="sing_chanthaburi">บริษัทสิงห์จันทบุรีจำกัด</option>
                    <option value="rental">รถเช่า</option>
                  </select>
                </div>
              </div>
            </div>
          )}
        </Card>

        {/* Error Messages - Show but don't block UI */}
        {error && (
          <Card className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 mb-6">
            <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
              <AlertTriangle size={20} />
              <div className="flex-1">
                <p className="font-medium">⚠️ ไม่สามารถโหลดข้อมูลรถได้</p>
                <p className="text-sm mt-1">{error.message}</p>
                <p className="text-xs mt-2 text-amber-700 dark:text-amber-300">
                  💡 ตรวจสอบ: Environment variables ใน Vercel, RLS policies, Network connection
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  console.log('[VehiclesView] Retry clicked');
                  refetch();
                  if (statusError) refetchStatus();
                }}
              >
                ลองอีกครั้ง
              </Button>
            </div>
          </Card>
        )}

        {statusError && !error && (
          <Card className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
            <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
              <AlertTriangle size={20} />
              <div className="flex-1">
                <p className="text-sm">ไม่สามารถโหลดสถานะรถได้ (แสดงเฉพาะข้อมูลพื้นฐาน)</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetchStatus()}
              >
                ลองอีกครั้ง
              </Button>
            </div>
          </Card>
        )}

        {/* Vehicles Grid/List */}
        {loading && vehicles.length === 0 ? (
          // Show loading state only if we have no cached data
          <Card className="p-12 text-center">
            <div className="flex flex-col items-center">
              <RefreshCw className="w-8 h-8 animate-spin text-slate-400 mb-4" />
              <p className="text-slate-600 dark:text-slate-400">กำลังโหลดข้อมูล...</p>
            </div>
          </Card>
        ) : filteredVehicles.length === 0 ? (
          // Empty state - show when no vehicles match filters
          <Card className="p-12 text-center">
            <Truck className="w-16 h-16 mx-auto mb-4 text-slate-400 opacity-50" />
            <h3 className="text-lg font-medium text-slate-600 dark:text-slate-300 mb-2">
              {vehicles.length === 0
                ? 'ไม่พบยานพาหนะ'
                : 'ไม่พบยานพาหนะที่ตรงกับเงื่อนไข'}
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
              {searchQuery || statusFilter !== 'all' || branchFilter !== 'all' || ownerGroupFilter !== 'all'
                ? 'ลองเปลี่ยนเงื่อนไขการค้นหา'
                : canEdit
                  ? 'เริ่มต้นด้วยการเพิ่มยานพาหนะ'
                  : 'ยังไม่มีข้อมูลยานพาหนะ'}
            </p>
            {(searchQuery || statusFilter !== 'all' || branchFilter !== 'all' || ownerGroupFilter !== 'all') && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchQuery('');
                  setStatusFilter('all');
                  setBranchFilter('all');
                  setOwnerGroupFilter('all');
                }}
              >
                <X className="w-4 h-4 mr-2" />
                ล้างตัวกรอง
              </Button>
            )}
            {vehicles.length === 0 && (
              <Button
                variant="outline"
                onClick={() => {
                  refetch();
                  if (statusError) refetchStatus();
                }}
              >
                รีเฟรชข้อมูล
              </Button>
            )}
          </Card>
        ) : (
          // Show vehicles grid
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredVehicles.map((vehicle) => (
              <VehicleCard
                key={vehicle.id}
                vehicle={vehicle}
                statusBadge={getStatusBadge(vehicle.id)}
                canEdit={canEdit}
                onViewDetail={onViewDetail}
                onEdit={onEdit}
              />
            ))}
          </div>
        )}
      </div>
    </PageLayout>
  );
};
