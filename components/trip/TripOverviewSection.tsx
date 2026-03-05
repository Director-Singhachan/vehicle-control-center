import React from 'react';
import {
  Truck,
  User,
  Calendar,
  Gauge,
  MapPin,
  Package,
  Users,
  BarChart3,
  FileText,
  ChevronRight,
  Clock,
  CheckCircle,
  X,
  AlertCircle,
  Store,
  Layers,
} from 'lucide-react';
import { Card } from '../ui/Card';
import type { TripTabId } from '../ui/TripDetailTabs';

interface TripOverviewSectionProps {
  trip: any;
  aggregatedProducts: any[];
  staffDistribution: any[];
  editHistory: any[];
  itemChanges: any[];
  postAnalyses: any[];
  pickupBreakdown: any[];
  vehicleImageError: boolean;
  driverImageError: boolean;
  onVehicleImageError: () => void;
  onDriverImageError: () => void;
  onSelectImage: (img: { url: string; alt: string }) => void;
  onTabChange: (tab: TripTabId) => void;
}

const STATUS_CONFIG: Record<string, { label: string; className: string; icon: React.ElementType }> =
  {
    planned: {
      label: 'วางแผน',
      className:
        'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200',
      icon: Calendar,
    },
    in_progress: {
      label: 'กำลังดำเนินการ',
      className:
        'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-200',
      icon: Clock,
    },
    completed: {
      label: 'เสร็จสิ้น',
      className:
        'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200',
      icon: CheckCircle,
    },
    cancelled: {
      label: 'ยกเลิก',
      className:
        'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200',
      icon: X,
    },
  };

function StatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.planned;
  const Icon = config.icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${config.className}`}
    >
      <Icon size={13} />
      {config.label}
    </span>
  );
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString('th-TH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
}

function StatCard({ icon, label, value, sub, color = 'text-enterprise-600 dark:text-enterprise-400' }: StatCardProps) {
  return (
    <div className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-700/50">
      <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-white dark:bg-slate-700/50 flex items-center justify-center shadow-sm">
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-xs text-slate-500 dark:text-slate-400 truncate">{label}</div>
        <div className={`text-xl font-bold leading-tight ${color}`}>{value}</div>
        {sub && <div className="text-xs text-slate-400 dark:text-slate-500 truncate">{sub}</div>}
      </div>
    </div>
  );
}

interface PreviewCardProps {
  icon: React.ReactNode;
  title: string;
  tab: TripTabId;
  onTabChange: (tab: TripTabId) => void;
  badge?: number;
  badgeVariant?: 'default' | 'warning';
  children: React.ReactNode;
  emptyText?: string;
  isEmpty?: boolean;
}

function PreviewCard({
  icon,
  title,
  tab,
  onTabChange,
  badge,
  badgeVariant,
  children,
  emptyText = 'ยังไม่มีข้อมูล',
  isEmpty = false,
}: PreviewCardProps) {
  const badgeCls =
    badgeVariant === 'warning'
      ? 'bg-amber-100 dark:bg-amber-800/60 text-amber-700 dark:text-amber-300'
      : 'bg-enterprise-100 dark:bg-enterprise-800/60 text-enterprise-700 dark:text-enterprise-300';

  return (
    <div className="bg-white/80 dark:bg-charcoal-900/50 backdrop-blur-sm border border-slate-200 dark:border-slate-700/50 rounded-xl flex flex-col overflow-hidden shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <div className="flex items-center gap-2">
          <span className="text-slate-500 dark:text-slate-400">{icon}</span>
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{title}</span>
          {badge !== undefined && badge > 0 && (
            <span className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-semibold leading-none ${badgeCls}`}>
              {badge > 99 ? '99+' : badge}
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-4 pb-3 text-sm text-slate-600 dark:text-slate-400">
        {isEmpty ? (
          <p className="text-slate-400 dark:text-slate-500 text-xs py-2">{emptyText}</p>
        ) : (
          children
        )}
      </div>

      {/* Footer button */}
      <button
        onClick={() => onTabChange(tab)}
        className="flex items-center justify-center gap-1.5 w-full px-4 py-2.5 mt-auto
          border-t border-slate-100 dark:border-slate-700/50
          text-xs font-medium text-enterprise-600 dark:text-enterprise-400
          hover:bg-enterprise-50 dark:hover:bg-enterprise-900/20
          transition-colors duration-150"
      >
        ดูทั้งหมด
        <ChevronRight size={13} />
      </button>
    </div>
  );
}

export const TripOverviewSection: React.FC<TripOverviewSectionProps> = ({
  trip,
  aggregatedProducts,
  staffDistribution,
  editHistory,
  itemChanges,
  postAnalyses,
  pickupBreakdown,
  vehicleImageError,
  driverImageError,
  onVehicleImageError,
  onDriverImageError,
  onSelectImage,
  onTabChange,
}) => {
  const storeCount = trip.stores?.length ?? 0;
  const skuCount = aggregatedProducts.length;
  const totalItems = aggregatedProducts.reduce(
    (sum: number, p: any) => sum + (Number(p.total_quantity) || 0),
    0,
  );
  const crewCount = staffDistribution.length;
  const kmDriven =
    trip.odometer_start && trip.odometer_end
      ? trip.odometer_end - trip.odometer_start
      : null;
  const historyCount = editHistory.length + itemChanges.length;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ── Basic Info Card ─────────────────────────────────────────── */}
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <FileText size={18} className="text-slate-400" />
            ข้อมูลพื้นฐาน
            {trip.has_item_changes && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/60 dark:text-purple-200">
                <AlertCircle size={10} />
                มีการแก้ไขสินค้า
              </span>
            )}
          </h3>
          <StatusBadge status={trip.status} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Vehicle */}
          <div className="flex items-center gap-3">
            {trip.vehicle?.image_url && !vehicleImageError ? (
              <img
                src={trip.vehicle.image_url}
                alt={trip.vehicle.plate || 'Vehicle'}
                className="w-16 h-16 rounded-lg object-cover border border-slate-200 dark:border-slate-700 flex-shrink-0"
                onError={onVehicleImageError}
              />
            ) : (
              <div className="flex-shrink-0 flex items-center justify-center w-16 h-16 rounded-lg bg-slate-100 dark:bg-slate-800">
                <Truck className="text-slate-400" size={24} />
              </div>
            )}
            <div>
              <div className="text-xs text-slate-500 dark:text-slate-400">รถ</div>
              <div className="font-semibold text-slate-900 dark:text-slate-100">
                {trip.vehicle?.plate || 'N/A'}
              </div>
              {trip.vehicle?.make && trip.vehicle?.model && (
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {trip.vehicle.make} {trip.vehicle.model}
                </div>
              )}
            </div>
          </div>

          {/* Driver */}
          {trip.driver && (
            <div className="flex items-center gap-3">
              {trip.driver.avatar_url && !driverImageError ? (
                <img
                  src={trip.driver.avatar_url}
                  alt={trip.driver.full_name || 'Driver'}
                  className="w-16 h-16 rounded-full object-cover border-2 border-slate-200 dark:border-slate-700 flex-shrink-0 cursor-pointer hover:ring-2 hover:ring-enterprise-500 transition-all"
                  onClick={() =>
                    onSelectImage({ url: trip.driver.avatar_url!, alt: trip.driver.full_name || 'Driver' })
                  }
                  onError={onDriverImageError}
                />
              ) : (
                <div className="flex-shrink-0 flex items-center justify-center w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800">
                  <User className="text-slate-400" size={24} />
                </div>
              )}
              <div>
                <div className="text-xs text-slate-500 dark:text-slate-400">คนขับ</div>
                <div className="font-semibold text-slate-900 dark:text-slate-100">
                  {trip.driver.full_name}
                </div>
              </div>
            </div>
          )}

          {/* Planned date */}
          <div className="flex items-center gap-3">
            <Calendar className="flex-shrink-0 text-slate-400" size={20} />
            <div>
              <div className="text-xs text-slate-500 dark:text-slate-400">วันที่วางแผน</div>
              <div className="font-medium text-slate-900 dark:text-slate-100">
                {formatDate(trip.planned_date)}
              </div>
            </div>
          </div>

          {/* Odometer */}
          {(trip.odometer_start || trip.odometer_end) && (
            <div className="flex items-center gap-3">
              <Gauge className="flex-shrink-0 text-slate-400" size={20} />
              <div>
                <div className="text-xs text-slate-500 dark:text-slate-400">เลขไมล์</div>
                <div className="font-medium text-slate-900 dark:text-slate-100">
                  {trip.odometer_start
                    ? `${trip.odometer_start.toLocaleString()} กม.`
                    : '—'}
                  {trip.odometer_end && (
                    <span className="text-slate-500"> → {trip.odometer_end.toLocaleString()} กม.</span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Notes */}
          {trip.notes && (
            <div className="sm:col-span-2">
              <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">หมายเหตุ</div>
              <div className="text-sm text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/40 rounded-lg px-3 py-2">
                {trip.notes}
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* ── Stat Cards ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          icon={<MapPin size={18} className="text-enterprise-500" />}
          label="ร้านค้าในทริป"
          value={storeCount}
          sub="จุดส่ง"
        />
        <StatCard
          icon={<Package size={18} className="text-blue-500" />}
          label="SKU สินค้า"
          value={skuCount}
          sub={totalItems > 0 ? `รวม ${totalItems.toLocaleString('th-TH', { maximumFractionDigits: 0 })} หน่วย` : undefined}
          color="text-blue-600 dark:text-blue-400"
        />
        <StatCard
          icon={<Users size={18} className="text-green-500" />}
          label="พนักงานในทริป"
          value={crewCount || '—'}
          sub={crewCount > 0 ? 'คน' : 'ยังไม่ระบุ'}
          color="text-green-600 dark:text-green-400"
        />
        <StatCard
          icon={<Gauge size={18} className="text-orange-500" />}
          label="ระยะทาง"
          value={kmDriven !== null ? `${kmDriven.toLocaleString()} กม.` : '—'}
          sub={kmDriven !== null ? 'ระยะจริง' : 'ยังไม่บันทึก'}
          color="text-orange-600 dark:text-orange-400"
        />
      </div>

      {/* ── Mini Preview Grid ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {/* Stores preview */}
        <PreviewCard
          icon={<MapPin size={16} />}
          title="ร้านค้าในทริป"
          tab="stores"
          onTabChange={onTabChange}
          badge={storeCount}
          isEmpty={storeCount === 0}
          emptyText="ยังไม่มีร้านค้าในทริปนี้"
        >
          <ul className="space-y-1.5 py-1">
            {(trip.stores || [])
              .slice(0, 3)
              .sort((a: any, b: any) => a.sequence_order - b.sequence_order)
              .map((s: any) => (
                <li key={s.id} className="flex items-center gap-2">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-enterprise-100 dark:bg-enterprise-900/60 text-enterprise-600 dark:text-enterprise-400 text-[10px] font-bold flex items-center justify-center">
                    {s.sequence_order}
                  </span>
                  <span className="truncate text-slate-700 dark:text-slate-300 text-xs">
                    {s.store?.customer_code} — {s.store?.customer_name}
                  </span>
                </li>
              ))}
            {storeCount > 3 && (
              <li className="text-xs text-slate-400 dark:text-slate-500 pl-7">
                +{storeCount - 3} ร้านค้าอีก...
              </li>
            )}
          </ul>
        </PreviewCard>

        {/* Products preview */}
        <PreviewCard
          icon={<Package size={16} />}
          title="สรุปสินค้าในเที่ยว"
          tab="products"
          onTabChange={onTabChange}
          badge={skuCount}
          isEmpty={skuCount === 0}
          emptyText="ยังไม่มีสินค้า"
        >
          <ul className="space-y-1.5 py-1">
            {aggregatedProducts.slice(0, 3).map((p: any) => (
              <li key={p.product_id} className="flex items-center justify-between gap-2">
                <span className="truncate text-slate-700 dark:text-slate-300 text-xs">
                  {p.product_code}
                </span>
                <span className="flex-shrink-0 font-semibold text-slate-900 dark:text-slate-100 text-xs">
                  {Number(p.total_quantity).toLocaleString('th-TH', { maximumFractionDigits: 0 })}{' '}
                  {p.unit}
                </span>
              </li>
            ))}
            {skuCount > 3 && (
              <li className="text-xs text-slate-400 dark:text-slate-500">+{skuCount - 3} SKU อีก...</li>
            )}
          </ul>
        </PreviewCard>

        {/* Crew preview */}
        <PreviewCard
          icon={<Users size={16} />}
          title="พนักงานในทริป"
          tab="crew"
          onTabChange={onTabChange}
          badge={crewCount}
          isEmpty={crewCount === 0}
          emptyText="ยังไม่ได้กำหนดพนักงาน"
        >
          <ul className="space-y-1.5 py-1">
            {staffDistribution.slice(0, 3).map((s: any) => (
              <li key={s.crew_id} className="flex items-center gap-2">
                <span className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-semibold ${
                  s.staff_role === 'driver'
                    ? 'bg-blue-100 dark:bg-blue-900/60 text-blue-600 dark:text-blue-300'
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                }`}>
                  {s.staff_role === 'driver' ? 'D' : 'H'}
                </span>
                <span className="truncate text-slate-700 dark:text-slate-300 text-xs">
                  {s.staff_name}
                </span>
              </li>
            ))}
          </ul>
        </PreviewCard>

        {/* Analytics preview */}
        <PreviewCard
          icon={<BarChart3 size={16} />}
          title="สถิติ & AI Trip Analysis"
          tab="analytics"
          onTabChange={onTabChange}
          isEmpty={staffDistribution.length === 0 && postAnalyses.length === 0}
          emptyText="ยังไม่มีข้อมูลสถิติหรือการวิเคราะห์"
        >
          <div className="space-y-1.5 py-1">
            {staffDistribution.length > 0 && (
              <div className="text-xs text-slate-600 dark:text-slate-400">
                สถิติยกสินค้า:{' '}
                <span className="font-medium text-slate-800 dark:text-slate-200">
                  {staffDistribution.length} พนักงาน
                </span>
              </div>
            )}
            {postAnalyses.length > 0 ? (
              <div className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400">
                <CheckCircle size={11} />
                มีผลวิเคราะห์ AI {postAnalyses.length} รายการ
              </div>
            ) : (
              <div className="text-xs text-slate-400 dark:text-slate-500">
                ยังไม่มี AI Analysis
              </div>
            )}
          </div>
        </PreviewCard>

        {/* History preview */}
        <PreviewCard
          icon={<FileText size={16} />}
          title="ประวัติการแก้ไข"
          tab="history"
          onTabChange={onTabChange}
          badge={historyCount}
          badgeVariant={historyCount > 0 ? 'warning' : 'default'}
          isEmpty={historyCount === 0}
          emptyText="ยังไม่มีประวัติการแก้ไข"
        >
          <div className="space-y-1.5 py-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 dark:text-slate-400">แก้ไขข้อมูลทริป</span>
              <span className="font-medium text-slate-700 dark:text-slate-300">
                {editHistory.length} ครั้ง
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 dark:text-slate-400">แก้ไขสินค้า</span>
              <span className="font-medium text-slate-700 dark:text-slate-300">
                {itemChanges.length} รายการ
              </span>
            </div>
          </div>
        </PreviewCard>

        {/* Loading plan preview */}
        <PreviewCard
          icon={<Layers size={16} />}
          title="การจัดเรียงสินค้า"
          tab="loading"
          onTabChange={onTabChange}
          isEmpty={false}
        >
          <div className="py-1 text-xs text-slate-500 dark:text-slate-400">
            ดูหรือแก้ไขแผนการจัดเรียงสินค้าบนรถ
          </div>
          {pickupBreakdown.length > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 mt-1">
              <Store size={11} />
              มีลูกค้ารับที่ร้าน {pickupBreakdown.length} ราย
            </div>
          )}
        </PreviewCard>
      </div>
    </div>
  );
};
