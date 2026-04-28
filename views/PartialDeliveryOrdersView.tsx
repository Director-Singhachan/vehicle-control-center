import React, { useState, useMemo } from 'react';
import {
  Package, Search, ArrowRight, AlertTriangle, RefreshCw, Calendar, Truck
} from 'lucide-react';
import { PageLayout } from '../components/ui/PageLayout';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { BillCorrectionBadges } from '../components/order/BillCorrectionBadges';
import { OrderEffectiveStatusBadge } from '../components/order/OrderEffectiveStatusBadge';
import { Button } from '../components/ui/Button';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { ToastContainer } from '../components/ui/Toast';
import { useToast } from '../hooks/useToast';
import { usePartialOrders, type PartialOrder } from '../hooks/usePartialOrders';
import { useOrderBranchScope } from '../hooks/useOrderBranchScope';
import { OrderShipmentPlanningView } from './OrderShipmentPlanningView';
import {
  BRANCH_ALL_VALUE,
  BRANCH_FILTER_OPTIONS,
  getBranchLabel,
} from '../utils/branchLabels';

export function PartialDeliveryOrdersView() {
  const { toasts, dismissToast } = useToast();
  const orderScope = useOrderBranchScope();

  const filters = useMemo(() => {
    if (orderScope.loading) return { branchesIn: [] as string[] };
    if (orderScope.unrestricted) return undefined;
    return { branchesIn: orderScope.allowedBranches };
  }, [orderScope.loading, orderScope.unrestricted, orderScope.allowedBranches]);

  const { orders, loading, error, refetch } = usePartialOrders(filters);

  const [searchTerm, setSearchTerm] = useState('');
  const [branchFilter, setBranchFilter] = useState(BRANCH_ALL_VALUE);
  const [planningOrderId, setPlanningOrderId] = useState<string | null>(null);

  const isSingleBranch =
    orderScope.loading || (!orderScope.unrestricted && orderScope.allowedBranches.length <= 1);

  const filteredOrders = useMemo(() => {
    let result = orders;
    if (branchFilter && branchFilter !== BRANCH_ALL_VALUE) {
      result = result.filter((o) => o.branch === branchFilter);
    }
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      result = result.filter(
        (o) =>
          o.order_number?.toLowerCase().includes(q) ||
          o.customer_name?.toLowerCase().includes(q) ||
          o.customer_code?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [orders, branchFilter, searchTerm]);

  if (planningOrderId) {
    return (
      <OrderShipmentPlanningView
        orderId={planningOrderId}
        onBack={() => setPlanningOrderId(null)}
        onSuccess={() => {
          setPlanningOrderId(null);
          refetch();
        }}
      />
    );
  }

  return (
    <>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <PageLayout title="ออเดอร์แบ่งส่ง">
        {/* Header info — นิยาม B: มีการแบ่งขึ้นทริปแล้ว (allocation) และยังมีของเหลือที่ยังไม่ถูกจัดไปทริป */}
        <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800 dark:text-amber-300">
            รายการนี้รวมทั้งออเดอร์ที่<strong>จัดทริปแล้วแต่ยังไม่ส่งครบ</strong> (รวมทริปที่ยังวางแผนอยู่)
            และกรณีที่<strong>ส่งไปแล้วบางส่วน</strong> แต่ยังมีสินค้าคงเหลือ
            — คลิก <strong>สร้างทริปถัดไป</strong> เพื่อนำของเหลือไปสร้างทริปรอบถัดไป
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="ค้นหาออเดอร์ / ร้านค้า..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-300 dark:border-charcoal-800 rounded-lg text-sm bg-white dark:bg-charcoal-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-enterprise-500"
            />
          </div>
          {!isSingleBranch && (
            <select
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-charcoal-800 rounded-lg text-sm bg-white dark:bg-charcoal-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-enterprise-500"
            >
              {BRANCH_FILTER_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          )}
          <Button variant="outline" size="sm" onClick={refetch} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            รีเฟรช
          </Button>
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
          <div className="bg-white dark:bg-charcoal-900 border border-gray-200 dark:border-charcoal-800 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{filteredOrders.length}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">ออเดอร์รอส่งต่อ</div>
          </div>
          <div className="bg-white dark:bg-charcoal-900 border border-gray-200 dark:border-charcoal-800 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-enterprise-600 dark:text-enterprise-400">
              {filteredOrders.reduce((s, o) => s + o.total_remaining, 0).toLocaleString('th-TH')}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">หน่วยที่เหลือรวม</div>
          </div>
          <div className="bg-white dark:bg-charcoal-900 border border-gray-200 dark:border-charcoal-800 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {filteredOrders.reduce((s, o) => s + o.trip_count, 0)}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">ทริปที่จัดไปแล้วรวม</div>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex justify-center py-16">
            <LoadingSpinner size={32} />
          </div>
        ) : error ? (
          <div className="text-center py-16">
            <AlertTriangle className="w-10 h-10 text-red-400 mx-auto mb-3" />
            <p className="text-red-600 dark:text-red-400">{error.message}</p>
            <Button variant="outline" className="mt-4" onClick={refetch}>ลองใหม่</Button>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Package className="w-12 h-12 mx-auto mb-3 opacity-40" />
            <p className="font-medium">ไม่มีออเดอร์ในคิวนี้</p>
            <p className="text-sm mt-1 max-w-md mx-auto">
              ออเดอร์ที่มีการแบ่งขึ้นทริปแล้วและยังมีของเหลือจะแสดงที่นี่
              ถ้าไม่มีรายการ แปลว่ายังไม่มี allocation ค้าง หรือสินค้าถูกจัดครบแล้ว
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredOrders.map((order) => (
              <PartialOrderCard
                key={order.order_id}
                order={order}
                onPlanNext={() => setPlanningOrderId(order.order_id)}
              />
            ))}
          </div>
        )}
      </PageLayout>
    </>
  );
}

interface PartialOrderCardProps {
  order: PartialOrder;
  onPlanNext: () => void;
}

function PartialOrderCard({ order, onPlanNext }: PartialOrderCardProps) {
  const deliveryPct =
    order.total_delivery_qty > 0
      ? Math.round((order.total_allocated / order.total_delivery_qty) * 100)
      : 0;

  const formattedDate = order.order_date
    ? new Date(order.order_date).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' })
    : '-';

  const formattedLatestTrip = order.latest_trip_date
    ? new Date(order.latest_trip_date).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' })
    : null;

  return (
    <Card className="p-4">
      <div className="flex flex-col sm:flex-row sm:items-start gap-4">
        <div className="flex-1 min-w-0">
          {/* Header row */}
          <div className="flex items-center flex-wrap gap-2 mb-1">
            <span className="font-semibold text-gray-900 dark:text-white text-sm">
              {order.order_number || '(ไม่มีเลข)'}
            </span>
            <Badge variant="warning" className="text-xs">ค้างส่งต่อ</Badge>
            {order.branch && (
              <Badge variant="default" className="text-xs">{getBranchLabel(order.branch)}</Badge>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">สถานะจัดส่ง</span>
            <OrderEffectiveStatusBadge order={order} />
            <BillCorrectionBadges order={order} />
          </div>

          <p className="text-sm text-gray-700 dark:text-gray-300 truncate">
            {order.customer_name || order.store_name || '-'}
          </p>
          {order.delivery_address && (
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">{order.delivery_address}</p>
          )}

          {/* Meta row */}
          <div className="flex flex-wrap gap-4 mt-2 text-xs text-gray-500 dark:text-gray-400">
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              ออเดอร์ {formattedDate}
            </span>
            {formattedLatestTrip && (
              <span className="flex items-center gap-1">
                <Truck className="w-3.5 h-3.5" />
                ทริปล่าสุด {formattedLatestTrip}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Package className="w-3.5 h-3.5" />
              จัดทริปไปแล้ว {order.trip_count} เที่ยว
            </span>
          </div>

          {/* Progress bar */}
          <div className="mt-3">
            <div className="flex justify-between text-xs mb-1">
              <span className="text-gray-600 dark:text-gray-400">
                จัดทริปแล้ว {order.total_allocated.toLocaleString('th-TH')} /
                {' '}{order.total_delivery_qty.toLocaleString('th-TH')} หน่วย
              </span>
              <span className="font-medium text-amber-600 dark:text-amber-400">
                เหลือ {order.total_remaining.toLocaleString('th-TH')} หน่วย
              </span>
            </div>
            <div className="h-2 bg-gray-100 dark:bg-charcoal-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-enterprise-500 rounded-full transition-all"
                style={{ width: `${deliveryPct}%` }}
              />
            </div>
          </div>
        </div>

        {/* Action */}
        <div className="flex-shrink-0 self-center sm:self-start sm:mt-1">
          <Button onClick={onPlanNext} size="sm">
            สร้างทริปถัดไป
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>
    </Card>
  );
}
