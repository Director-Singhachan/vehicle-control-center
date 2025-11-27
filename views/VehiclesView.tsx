// Vehicles View - List all vehicles with filters and search
import React, { useState, useMemo } from 'react';
import { useVehicles, useVehiclesWithStatus } from '../hooks';
import { useAuth } from '../hooks';
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
  AlertTriangle
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card } from '../components/ui/Card';
import { PageLayout } from '../components/layout/PageLayout';
import type { Database } from '../types/database';

type Vehicle = Database['public']['Tables']['vehicles']['Row'];
type VehicleWithStatus = Database['public']['Views']['vehicles_with_status']['Row'];

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
  const { isManager, isAdmin } = useAuth();
  const { vehicles, loading, error, refetch } = useVehicles();
  
  // Try to get vehicles with status, but don't block if it fails
  const { vehicles: vehiclesWithStatus, loading: loadingStatus, error: statusError, refetch: refetchStatus } = useVehiclesWithStatus();
  
  // If status view fails, we can still show vehicles without status
  const hasStatusData = !statusError && vehiclesWithStatus && vehiclesWithStatus.length > 0;

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
    });
  }, [vehicles, loading, error, vehiclesWithStatus, loadingStatus, statusError]);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'maintenance' | 'idle'>('all');
  const [branchFilter, setBranchFilter] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);

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

  // Filter vehicles
  const filteredVehicles = useMemo(() => {
    let filtered = vehicles;

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(v =>
        v.plate.toLowerCase().includes(query) ||
        v.make?.toLowerCase().includes(query) ||
        v.model?.toLowerCase().includes(query) ||
        v.branch?.toLowerCase().includes(query)
      );
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

    return filtered;
  }, [vehicles, searchQuery, statusFilter, branchFilter, statusMap]);

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

  const canEdit = isManager || isAdmin;

  return (
    <PageLayout
      title="ยานพาหนะ"
      subtitle={`ทั้งหมด ${filteredVehicles.length} คัน${!hasStatusData && statusError ? ' (แสดงเฉพาะข้อมูลพื้นฐาน)' : ''}`}
      loading={loading}
      error={!!error}
      onRetry={() => {
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
            onClick={() => setShowFilters(!showFilters)}
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
            <div className="flex gap-2">
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${statusFilter === 'all'
                    ? 'bg-enterprise-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
              >
                ทั้งหมด
              </button>
              <button
                onClick={() => setStatusFilter('active')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${statusFilter === 'active'
                    ? 'bg-green-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
              >
                ใช้งาน
              </button>
              <button
                onClick={() => setStatusFilter('maintenance')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${statusFilter === 'maintenance'
                    ? 'bg-yellow-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
              >
                ซ่อมบำรุง
              </button>
              <button
                onClick={() => setStatusFilter('idle')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${statusFilter === 'idle'
                    ? 'bg-slate-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
              >
                ว่าง
              </button>
            </div>
          </div>

          {/* Advanced Filters */}
          {showFilters && (
            <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                      <option key={branch} value={branch}>{branch}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}
        </Card>

        {/* Error Messages */}
        {error && (
          <Card className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
            <div className="flex items-center gap-2 text-red-800 dark:text-red-200">
              <AlertTriangle size={20} />
              <div className="flex-1">
                <p className="font-medium">เกิดข้อผิดพลาดในการโหลดข้อมูลรถ</p>
                <p className="text-sm mt-1">{error.message}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
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
        {filteredVehicles.length === 0 && !loading && !loadingStatus ? (
          <Card className="p-12 text-center">
            <Truck className="w-16 h-16 mx-auto mb-4 text-slate-400 opacity-50" />
            <h3 className="text-lg font-medium text-slate-600 dark:text-slate-300 mb-2">
              {vehicles.length === 0
                ? 'ไม่พบยานพาหนะ'
                : 'ไม่พบยานพาหนะที่ตรงกับเงื่อนไข'}
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
              {searchQuery || statusFilter !== 'all' || branchFilter !== 'all'
                ? 'ลองเปลี่ยนเงื่อนไขการค้นหา'
                : canEdit
                  ? 'เริ่มต้นด้วยการเพิ่มยานพาหนะ'
                  : 'ยังไม่มีข้อมูลยานพาหนะ'}
            </p>
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredVehicles.map((vehicle) => {
              const statusBadge = getStatusBadge(vehicle.id);
              const StatusIcon = statusBadge.icon;

              return (
                <Card key={vehicle.id} className="overflow-hidden hover:shadow-lg transition-shadow group">
                  <div className="relative h-48 bg-slate-100 dark:bg-slate-800">
                    <img
                      src={vehicle.image_url || 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&q=80&w=1000'}
                      alt={vehicle.plate}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&q=80&w=1000';
                      }}
                    />
                    <div className="absolute top-3 right-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1 shadow-sm ${statusBadge.className}`}>
                        <StatusIcon className="w-3 h-3" />
                        {statusBadge.label}
                      </span>
                    </div>
                  </div>

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
                    </div>

                    <div className="flex gap-2 pt-4 border-t border-slate-200 dark:border-slate-700">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => onViewDetail?.(vehicle.id)}
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        ดูรายละเอียด
                      </Button>
                      {canEdit && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onEdit?.(vehicle.id)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </PageLayout>
  );
};
