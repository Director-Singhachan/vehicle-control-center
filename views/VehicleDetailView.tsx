// Vehicle Detail View - Show detailed information about a vehicle
import React from 'react';
import { useVehicle, useMaintenanceHistory } from '../hooks';
import { useAuth } from '../hooks';
import {
  Truck,
  Edit,
  ArrowLeft,
  MapPin,
  Calendar,
  Activity,
  Wrench,
  Clock,
  FileText,
  DollarSign
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { PageLayout } from '../components/layout/PageLayout';
import { VehicleGroupBadge } from '../components/vehicle/VehicleGroupBadge';
import { VehicleDocumentManager } from '../components/vehicle/VehicleDocumentManager';
import { useTickets } from '../hooks';

interface VehicleDetailViewProps {
  vehicleId: string;
  onEdit?: (vehicleId: string) => void;
  onBack?: () => void;
  onViewTicket?: (ticketId: number) => void;
}

export const VehicleDetailView: React.FC<VehicleDetailViewProps> = ({
  vehicleId,
  onEdit,
  onBack,
  onViewTicket,
}) => {
  const { isManager, isAdmin } = useAuth();
  const { vehicle, loading, error } = useVehicle(vehicleId);
  const {
    history: maintenanceHistory,
    loading: loadingHistory,
    error: maintenanceError,
  } = useMaintenanceHistory(vehicleId);
  const { tickets, loading: loadingTickets, error: ticketsError } = useTickets({
    filters: { vehicle_id: vehicleId },
    autoFetch: true
  });

  const canEdit = isManager || isAdmin;

  if (loading || loadingTickets) {
    return (
      <PageLayout
        title="กำลังโหลด..."
        subtitle="กำลังดึงข้อมูลยานพาหนะ"
        loading={true}
      />
    );
  }

  if (error || !vehicle) {
    return (
      <PageLayout
        title="ไม่พบข้อมูล"
        subtitle={error?.message || "ไม่สามารถโหลดข้อมูลยานพาหนะได้"}
        error={true}
        actions={
          <Button variant="outline" onClick={onBack}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            กลับ
          </Button>
        }
      />
    );
  }

  // Get status (simplified - should use vehicles_with_status view)
  const status = 'idle'; // TODO: Get from vehicles_with_status

  const statusConfig = {
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

  const StatusIcon = statusConfig[status as keyof typeof statusConfig].icon;

  return (
    <PageLayout
      title={vehicle.plate}
      subtitle={`${vehicle.make} ${vehicle.model || ''}`.trim()}
      actions={
        <div className="flex gap-3">
          {onBack && (
            <Button variant="outline" onClick={onBack}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              กลับ
            </Button>
          )}
          {canEdit && onEdit && (
            <Button onClick={() => onEdit(vehicleId)}>
              <Edit className="w-4 h-4 mr-2" />
              แก้ไข
            </Button>
          )}
        </div>
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Vehicle Image & Info Card */}
          <Card className="overflow-hidden">
            <div className="relative h-64 md:h-80 bg-slate-100 dark:bg-slate-800">
              <img
                src={vehicle.image_url || 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&q=80&w=1000'}
                alt={vehicle.plate}
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&q=80&w=1000';
                }}
              />
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-6">
                <div className="flex items-end justify-between">
                  <div>
                    <h1 className="text-3xl font-bold text-white mb-1">{vehicle.plate}</h1>
                    <p className="text-slate-200 text-lg">{vehicle.make} {vehicle.model}</p>
                    {vehicle.owner_group && (
                      <div className="mt-2">
                        <VehicleGroupBadge ownerGroup={vehicle.owner_group} />
                      </div>
                    )}
                  </div>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium flex items-center gap-2 ${statusConfig[status as keyof typeof statusConfig].className
                    }`}>
                    <StatusIcon className="w-4 h-4" />
                    {statusConfig[status as keyof typeof statusConfig].label}
                  </span>
                </div>
              </div>
            </div>

            <div className="p-6">
              <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-6">
                ข้อมูลยานพาหนะ
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">
                    ป้ายทะเบียน
                  </label>
                  <p className="text-lg font-semibold text-slate-900 dark:text-white">
                    {vehicle.plate}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">
                    ยี่ห้อ
                  </label>
                  <p className="text-lg text-slate-900 dark:text-white">
                    {vehicle.make || '-'}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">
                    รุ่น
                  </label>
                  <p className="text-lg text-slate-900 dark:text-white">
                    {vehicle.model || '-'}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">
                    ประเภท
                  </label>
                  <p className="text-lg text-slate-900 dark:text-white">
                    {vehicle.type || '-'}
                  </p>
                </div>

                {vehicle.branch && (
                  <div>
                    <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">
                      สาขา
                    </label>
                    <p className="text-lg text-slate-900 dark:text-white flex items-center gap-2">
                      <MapPin className="w-4 h-4" />
                      {vehicle.branch}
                    </p>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">
                    วันที่เพิ่ม
                  </label>
                  <p className="text-lg text-slate-900 dark:text-white flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    {new Date(vehicle.created_at).toLocaleDateString('th-TH', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </p>
                </div>

                {vehicle.lat && vehicle.lng && (
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">
                      ตำแหน่ง
                    </label>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      {vehicle.lat.toFixed(6)}, {vehicle.lng.toFixed(6)}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </Card>

          {/* Maintenance History Table */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <Wrench className="w-5 h-5" />
                ประวัติการซ่อมบำรุงของคันนี้
              </h2>
              <span className="text-sm text-slate-500 dark:text-slate-400">
                {maintenanceHistory.length} รายการ
              </span>
            </div>

            {loadingHistory ? (
              <div className="text-sm text-slate-500 dark:text-slate-400 py-4">
                กำลังโหลดประวัติการซ่อมบำรุง...
              </div>
            ) : maintenanceError ? (
              <div className="text-sm text-red-500 dark:text-red-400 py-4">
                ไม่สามารถโหลดประวัติการซ่อมบำรุงได้: {maintenanceError.message}
              </div>
            ) : maintenanceHistory.length === 0 ? (
              <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                <Wrench className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>ยังไม่มีประวัติการซ่อมบำรุงสำหรับรถคันนี้</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60">
                      <th className="px-3 py-2 text-left font-medium text-slate-600 dark:text-slate-300">
                        วันที่ซ่อม
                      </th>
                      <th className="px-3 py-2 text-left font-medium text-slate-600 dark:text-slate-300">
                        ประเภทงาน
                      </th>
                      <th className="px-3 py-2 text-left font-medium text-slate-600 dark:text-slate-300">
                        เลขไมล์
                      </th>
                      <th className="px-3 py-2 text-left font-medium text-slate-600 dark:text-slate-300">
                        ค่าใช้จ่าย
                      </th>
                      <th className="px-3 py-2 text-left font-medium text-slate-600 dark:text-slate-300">
                        อู่ซ่อม
                      </th>
                      <th className="px-3 py-2 text-left font-medium text-slate-600 dark:text-slate-300">
                        หมายเหตุ
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {maintenanceHistory.map((item) => (
                      <tr
                        key={item.id}
                        className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60"
                      >
                        <td className="px-3 py-2 text-slate-800 dark:text-slate-100 whitespace-nowrap">
                          {item.performed_at
                            ? new Date(item.performed_at).toLocaleDateString('th-TH', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                              })
                            : '-'}
                        </td>
                        <td className="px-3 py-2 text-slate-800 dark:text-slate-100">
                          {item.maintenance_name || item.maintenance_type || '-'}
                        </td>
                        <td className="px-3 py-2 text-slate-700 dark:text-slate-200">
                          {item.odometer ? `${item.odometer.toLocaleString()} กม.` : '-'}
                        </td>
                        <td className="px-3 py-2 text-slate-800 dark:text-slate-100 whitespace-nowrap">
                          {typeof item.cost === 'number'
                            ? `฿${item.cost.toLocaleString()}`
                            : '-'}
                        </td>
                        <td className="px-3 py-2 text-slate-700 dark:text-slate-200">
                          {item.garage || '-'}
                        </td>
                        <td className="px-3 py-2 text-slate-600 dark:text-slate-300 max-w-xs">
                          {item.description || item.notes || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {/* Vehicle Documents */}
          <VehicleDocumentManager vehicleId={vehicleId} canEdit={canEdit} />

          {/* Recent Tickets */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <FileText className="w-5 h-5" />
                ตั๋วซ่อมบำรุงล่าสุด
              </h2>
              <span className="text-sm text-slate-500 dark:text-slate-400">
                {tickets.length} รายการ
              </span>
            </div>

            {tickets.length === 0 ? (
              <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>ยังไม่มีตั๋วซ่อมบำรุง</p>
              </div>
            ) : (
              <div className="space-y-3">
                {tickets.slice(0, 5).map((ticket) => (
                  <div
                    key={ticket.id}
                    className="p-4 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    onClick={() => onViewTicket?.(ticket.id)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="font-medium text-slate-900 dark:text-white">
                          {ticket.repair_type || 'ไม่ระบุประเภท'}
                        </p>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                          {ticket.problem_description || 'ไม่มีคำอธิบาย'}
                        </p>
                        <div className="flex items-center gap-4 mt-2 text-xs text-slate-500 dark:text-slate-400">
                          <span>สถานะ: {ticket.status}</span>
                          <span>ความเร่งด่วน: {ticket.urgency}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Sidebar Stats */}
        <div className="space-y-6">
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
              สถิติ
            </h3>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
                  ตั๋วทั้งหมด
                </p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">
                  {tickets.length}
                </p>
              </div>
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
                  ตั๋วที่รออนุมัติ
                </p>
                <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                  {tickets.filter(t => t.status === 'pending').length}
                </p>
              </div>
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
                  กำลังซ่อม
                </p>
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {tickets.filter(t => t.status === 'in_progress').length}
                </p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </PageLayout>
  );
};
