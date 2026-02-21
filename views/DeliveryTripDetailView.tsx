// Delivery Trip Detail View - Show detailed information about a delivery trip
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Package,
  Edit,
  ArrowLeft,
  Calendar,
  Truck,
  User,
  MapPin,
  Gauge,
  CheckCircle,
  Clock,
  X,
  AlertCircle,
  Download,
  FileText,
  Users,
  BarChart3,
  Plus,
  Search,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { PageLayout } from '../components/layout/PageLayout';
import { ImageModal } from '../components/ui/ImageModal';
import { Modal } from '../components/ui/Modal';
import { useDeliveryTrip, useAuth } from '../hooks';
import { deliveryTripService } from '../services/deliveryTripService';
import { ordersService, orderItemsService } from '../services/ordersService';
import { pdfService } from '../services/pdfService';
import { CrewAssignment } from '../components/crew/CrewAssignment';
import type {
  DeliveryTripStoreWithDetails,
  DeliveryTripItemWithProduct,
  DeliveryTripItemChangeWithDetails,
} from '../services/deliveryTripService';
import { tripMetricsService, type PostTripAnalysisEntry } from '../services/tripMetricsService';
import { TripPostAnalysisPanel } from '../components/trip/TripPostAnalysisPanel';
import { PackingSimulator } from '../components/trip/PackingSimulator';

interface DeliveryTripDetailViewProps {
  tripId: string;
  onEdit?: (tripId: string) => void;
  onBack?: () => void;
  onRecordMetrics?: () => void;
}

export const DeliveryTripDetailView: React.FC<DeliveryTripDetailViewProps> = ({
  tripId,
  onEdit,
  onBack,
  onRecordMetrics,
}) => {
  const { trip, loading, error, refetch } = useDeliveryTrip(tripId);
  const [printing, setPrinting] = useState(false);
  const [printingForklift, setPrintingForklift] = useState(false);
  const [vehicleImageError, setVehicleImageError] = useState(false);
  const [driverImageError, setDriverImageError] = useState(false);
  const [selectedImage, setSelectedImage] = useState<{ url: string; alt: string } | null>(null);
  const [showPackingLayout, setShowPackingLayout] = useState(false);

  // Get aggregated products
  const [aggregatedProducts, setAggregatedProducts] = useState<any[]>([]);

  // Item change history (audit log)
  const [itemChanges, setItemChanges] = useState<DeliveryTripItemChangeWithDetails[]>([]);
  const [itemChangesLoading, setItemChangesLoading] = useState(false);
  const [itemChangesError, setItemChangesError] = useState<string | null>(null);

  // Trip edit history (audit log for trip data changes)
  const [editHistory, setEditHistory] = useState<any[]>([]);
  const [editHistoryLoading, setEditHistoryLoading] = useState(false);
  const [editHistoryError, setEditHistoryError] = useState<string | null>(null);

  // Staff item distribution
  const [staffDistribution, setStaffDistribution] = useState<any[]>([]);
  const [productDistribution, setProductDistribution] = useState<any[]>([]);
  const [distributionLoading, setDistributionLoading] = useState(false);

  // Post-Trip Analysis (AI Insight หลังจบทริป)
  const [postAnalyses, setPostAnalyses] = useState<PostTripAnalysisEntry[]>([]);
  const [postAnalysisLoading, setPostAnalysisLoading] = useState(false);
  const [postAnalysisError, setPostAnalysisError] = useState<string | null>(null);

  // เพิ่มร้านในทริป (ออเดอร์ที่ตกหล่น)
  const [addOrderModalOpen, setAddOrderModalOpen] = useState(false);
  const [pendingOrders, setPendingOrders] = useState<any[]>([]);
  const [pendingOrdersLoading, setPendingOrdersLoading] = useState(false);
  const [addOrderSearch, setAddOrderSearch] = useState('');
  const [selectedOrderToAdd, setSelectedOrderToAdd] = useState<any | null>(null);
  const [addOrderReason, setAddOrderReason] = useState('');
  const [addOrderSubmitting, setAddOrderSubmitting] = useState(false);
  const [addOrderError, setAddOrderError] = useState<string | null>(null);
  const { user } = useAuth();

  React.useEffect(() => {
    if (trip) {
      deliveryTripService.getAggregatedProducts(trip.id).then(setAggregatedProducts);
      // Reset image error states when trip changes
      setVehicleImageError(false);
      setDriverImageError(false);

      // Load staff item distribution
      setDistributionLoading(true);
      Promise.all([
        deliveryTripService.getStaffItemDistribution(trip.id),
        deliveryTripService.getProductDistributionByTrip(trip.id),
      ])
        .then(([staffDist, productDist]) => {
          setStaffDistribution(staffDist);
          setProductDistribution(productDist);
        })
        .catch((err) => {
          console.error('[DeliveryTripDetailView] Error loading distribution:', err);
          setStaffDistribution([]);
          setProductDistribution([]);
        })
        .finally(() => {
          setDistributionLoading(false);
        });

      // Load post-trip analysis (AI insight) ถ้ามี
      setPostAnalysisLoading(true);
      setPostAnalysisError(null);
      tripMetricsService
        .getPostTripAnalysisForTrip(trip.id)
        .then((entries) => {
          setPostAnalyses(entries);
        })
        .catch((err: any) => {
          console.error('[DeliveryTripDetailView] Error loading post-trip analysis:', err);
          setPostAnalyses([]);
          setPostAnalysisError(err?.message || 'ไม่สามารถโหลดผลการวิเคราะห์ทริปได้');
        })
        .finally(() => {
          setPostAnalysisLoading(false);
        });
    }
  }, [trip]);

  React.useEffect(() => {
    const fetchHistory = async () => {
      if (!trip) return;
      try {
        setItemChangesLoading(true);
        setItemChangesError(null);
        const data = await deliveryTripService.getItemChangeHistory(trip.id);
        setItemChanges(data);
      } catch (err: any) {
        console.error('[DeliveryTripDetailView] Error loading item change history:', err);
        setItemChangesError(err?.message || 'ไม่สามารถโหลดประวัติการแก้ไขสินค้าได้');
      } finally {
        setItemChangesLoading(false);
      }
    };

    fetchHistory();
  }, [trip]);

  // Fetch trip edit history
  React.useEffect(() => {
    const fetchEditHistory = async () => {
      if (!trip) return;
      try {
        setEditHistoryLoading(true);
        setEditHistoryError(null);
        const data = await deliveryTripService.getDeliveryTripEditHistory(trip.id);
        setEditHistory(data);
      } catch (err: any) {
        console.error('[DeliveryTripDetailView] Error loading trip edit history:', err);
        setEditHistoryError(err?.message || 'ไม่สามารถโหลดประวัติการแก้ไขข้อมูลทริปได้');
      } finally {
        setEditHistoryLoading(false);
      }
    };

    fetchEditHistory();
  }, [trip]);

  // โหลดออเดอร์ที่รอจัดทริปเมื่อเปิดโมดัลเพิ่มร้าน
  useEffect(() => {
    if (!addOrderModalOpen || !trip) return;
    setPendingOrdersLoading(true);
    setAddOrderError(null);
    setSelectedOrderToAdd(null);
    setAddOrderReason('');
    ordersService.getPendingOrders()
      .then((data) => setPendingOrders(data || []))
      .catch((err) => setAddOrderError(err?.message || 'โหลดรายการออเดอร์ไม่สำเร็จ'))
      .finally(() => setPendingOrdersLoading(false));
  }, [addOrderModalOpen, trip?.id]);

  // ออเดอร์ที่แสดงในโมดัล (ตัดร้านที่มีในทริปแล้ว + ค้นหา)
  const pendingOrdersToShow = useMemo(() => {
    const storeIdsInTrip = new Set((trip?.stores || []).map((s: any) => s.store_id));
    let list = (pendingOrders || []).filter((o: any) => !storeIdsInTrip.has(o.store_id));
    if (addOrderSearch.trim()) {
      const q = addOrderSearch.toLowerCase().trim();
      list = list.filter((o: any) =>
        (o.order_number && o.order_number.toLowerCase().includes(q)) ||
        (o.customer_name && o.customer_name.toLowerCase().includes(q)) ||
        (o.customer_code && o.customer_code.toLowerCase().includes(q))
      );
    }
    return list;
  }, [trip?.stores, pendingOrders, addOrderSearch]);

  const handleAddOrderToTrip = useCallback(async () => {
    if (!trip || !selectedOrderToAdd || !user?.id) return;
    if (!addOrderReason.trim()) {
      setAddOrderError('กรุณาระบุเหตุผลในการเพิ่มร้าน (เช่น เพิ่มร้านที่ตกหล่น)');
      return;
    }
    setAddOrderSubmitting(true);
    setAddOrderError(null);
    try {
      const orderItems = await orderItemsService.getByOrderId(selectedOrderToAdd.id);
      const newStore = {
        store_id: selectedOrderToAdd.store_id,
        sequence_order: (trip.stores?.length || 0) + 1,
        items: (orderItems || [])
          .filter((item: any) => {
            const remaining = Math.max(0, Number(item.quantity) - Number(item.quantity_picked_up_at_store ?? 0) - Number(item.quantity_delivered ?? 0));
            return remaining > 0;
          })
          .map((item: any) => ({
            product_id: item.product_id,
            quantity: Number(item.quantity),
            quantity_picked_up_at_store: Number(item.quantity_picked_up_at_store ?? 0),
            notes: item.notes || undefined,
            is_bonus: !!item.is_bonus,
            selected_pallet_config_id: item.selected_pallet_config_id || undefined,
          })),
      };
      const existingStores = (trip.stores || []).map((s: any) => ({
        store_id: s.store_id,
        sequence_order: s.sequence_order,
        items: (s.items || []).map((i: any) => ({
          product_id: i.product_id,
          quantity: Number(i.quantity) || 0,
          notes: i.notes || undefined,
          is_bonus: !!i.is_bonus,
          selected_pallet_config_id: i.selected_pallet_config_id || undefined,
        })),
      }));
      const allStores = [...existingStores, newStore];
      await deliveryTripService.update(trip.id, {
        stores: allStores,
        edit_reason: addOrderReason.trim(),
      });
      await ordersService.assignToTrip([selectedOrderToAdd.id], trip.id, user.id);
      setAddOrderModalOpen(false);
      refetch();
    } catch (err: any) {
      setAddOrderError(err?.message || 'ไม่สามารถเพิ่มร้านเข้ากับทริปได้');
    } finally {
      setAddOrderSubmitting(false);
    }
  }, [trip, selectedOrderToAdd, addOrderReason, user?.id, refetch]);



  const getStatusBadge = (status: string) => {
    const badges = {
      planned: {
        label: 'วางแผน',
        className: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
        icon: Calendar,
      },
      in_progress: {
        label: 'กำลังดำเนินการ',
        className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
        icon: Clock,
      },
      completed: {
        label: 'เสร็จสิ้น',
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
      <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${badge.className}`}>
        <Icon size={14} />
        {badge.label}
      </span>
    );
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatDateTime = (date: string) => {
    return new Date(date).toLocaleString('th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handlePrint = async () => {
    if (!trip) return;

    try {
      setPrinting(true);
      const fullTrip = await deliveryTripService.getById(trip.id);
      await pdfService.generateDeliveryTripPDFA5(fullTrip || trip, aggregatedProducts);
    } catch (err: any) {
      console.error('[DeliveryTripDetailView] Error printing:', err);
      alert('ไม่สามารถพิมพ์เอกสารได้: ' + (err.message || 'Unknown error'));
    } finally {
      setPrinting(false);
    }
  };

  const handlePrintForklift = async () => {
    if (!trip) return;

    try {
      setPrintingForklift(true);
      const fullTrip = await deliveryTripService.getById(trip.id);
      await pdfService.generateDeliveryTripForkliftSummaryPDFA5(fullTrip || trip, aggregatedProducts);
    } catch (err: any) {
      console.error('[DeliveryTripDetailView] Error printing forklift summary:', err);
      alert('ไม่สามารถพิมพ์เอกสารโฟล์คลิฟท์ได้: ' + (err.message || 'Unknown error'));
    } finally {
      setPrintingForklift(false);
    }
  };

  if (loading) {
    return <PageLayout title="รายละเอียดทริปส่งสินค้า" loading={true} />;
  }

  if (error || !trip) {
    return (
      <PageLayout
        title="รายละเอียดทริปส่งสินค้า"
        error={true}
        onRetry={refetch}
      >
        <Card className="p-8 text-center">
          <AlertCircle className="mx-auto mb-4 text-red-500" size={48} />
          <p className="text-red-600 dark:text-red-400">
            {error?.message || 'ไม่พบข้อมูลทริป'}
          </p>
        </Card>
      </PageLayout>
    );
  }

  return (
    <PageLayout
      title={`ทริป ${trip.trip_number || 'N/A'}`}
      subtitle="รายละเอียดทริปส่งสินค้า"
      actions={
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handlePrint} isLoading={printing}>
            <Download size={18} className="mr-2" />
            พิมพ์ A5
          </Button>
          <Button
            variant="outline"
            onClick={handlePrintForklift}
            isLoading={printingForklift}
          >
            <Download size={18} className="mr-2" />
            พิมพ์ A5 (โฟล์คลิฟท์)
          </Button>
          {onRecordMetrics && (
            <Button
              variant="outline"
              onClick={onRecordMetrics}
              className="relative"
            >
              <BarChart3 size={18} className="mr-2" />
              บันทึกเมตริกซ์
              {(trip as any).actual_pallets_used != null && (
                <CheckCircle size={14} className="ml-1 text-green-600 dark:text-green-400" />
              )}
            </Button>
          )}
          {(trip.status === 'planned' || trip.status === 'in_progress') && (
            <Button variant="outline" onClick={() => setAddOrderModalOpen(true)}>
              <Plus size={18} className="mr-2" />
              เพิ่มร้านในทริป
            </Button>
          )}
          {onEdit && (
            <Button variant="outline" onClick={() => onEdit(trip.id)}>
              <Edit size={18} className="mr-2" />
              แก้ไขข้อมูลทริป
            </Button>
          )}
        </div>
      }
    >
      {/* Basic Info */}
      <Card className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <FileText size={20} />
            ข้อมูลพื้นฐาน
            {trip.has_item_changes && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                มีการแก้ไขสินค้า
              </span>
            )}
          </h3>
          {getStatusBadge(trip.status)}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-center gap-3">
            {trip.vehicle?.image_url && !vehicleImageError ? (
              <img
                src={trip.vehicle.image_url}
                alt={trip.vehicle.plate || 'Vehicle'}
                className="w-16 h-16 rounded-lg object-cover border border-slate-200 dark:border-slate-700"
                onError={() => setVehicleImageError(true)}
              />
            ) : (
              <div className="flex items-center justify-center w-16 h-16 rounded-lg bg-slate-100 dark:bg-slate-800">
                <Truck className="text-slate-400" size={24} />
              </div>
            )}
            <div>
              <div className="text-sm text-slate-500 dark:text-slate-400">รถ</div>
              <div className="font-medium text-slate-900 dark:text-slate-100">
                {trip.vehicle?.plate || 'N/A'}
                {trip.vehicle?.make && trip.vehicle?.model && (
                  <span className="text-slate-500"> ({trip.vehicle.make} {trip.vehicle.model})</span>
                )}
              </div>
            </div>
          </div>

          {trip.driver && (
            <div className="flex items-center gap-3">
              {trip.driver.avatar_url && !driverImageError ? (
                <img
                  src={trip.driver.avatar_url}
                  alt={trip.driver.full_name || 'Driver'}
                  className="w-16 h-16 rounded-full object-cover border-2 border-slate-200 dark:border-slate-700 cursor-pointer hover:ring-2 hover:ring-enterprise-500 transition-all"
                  onClick={() => {
                    setSelectedImage({
                      url: trip.driver.avatar_url!,
                      alt: trip.driver.full_name || 'Driver'
                    });
                  }}
                  onError={() => setDriverImageError(true)}
                />
              ) : (
                <div className="flex items-center justify-center w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800">
                  <User className="text-slate-400" size={24} />
                </div>
              )}
              <div>
                <div className="text-sm text-slate-500 dark:text-slate-400">คนขับ</div>
                <div className="font-medium text-slate-900 dark:text-slate-100">
                  {trip.driver.full_name}
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center gap-3">
            <Calendar className="text-slate-400" size={20} />
            <div>
              <div className="text-sm text-slate-500 dark:text-slate-400">วันที่วางแผน</div>
              <div className="font-medium text-slate-900 dark:text-slate-100">
                {formatDate(trip.planned_date)}
              </div>
            </div>
          </div>

          {trip.odometer_start && (
            <div className="flex items-center gap-3">
              <Gauge className="text-slate-400" size={20} />
              <div>
                <div className="text-sm text-slate-500 dark:text-slate-400">ไมล์เริ่มต้น</div>
                <div className="font-medium text-slate-900 dark:text-slate-100">
                  {trip.odometer_start.toLocaleString()} กม.
                </div>
              </div>
            </div>
          )}

          {trip.odometer_end && (
            <div className="flex items-center gap-3">
              <Gauge className="text-slate-400" size={20} />
              <div>
                <div className="text-sm text-slate-500 dark:text-slate-400">ไมล์สิ้นสุด</div>
                <div className="font-medium text-slate-900 dark:text-slate-100">
                  {trip.odometer_end.toLocaleString()} กม.
                </div>
              </div>
            </div>
          )}

          {trip.notes && (
            <div className="md:col-span-2">
              <div className="text-sm text-slate-500 dark:text-slate-400 mb-1">หมายเหตุ</div>
              <div className="text-slate-900 dark:text-slate-100">{trip.notes}</div>
            </div>
          )}
        </div>
      </Card>

      {/* Staff Item Distribution - Statistics */}
      {!distributionLoading && staffDistribution.length > 0 && (
        <Card className="mb-6">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
            <Users size={20} />
            สถิติการยกสินค้าต่อพนักงาน
          </h3>

          <div className="mb-4 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
            <div className="text-sm text-slate-600 dark:text-slate-400">
              พนักงานทั้งหมด: <span className="font-semibold text-slate-900 dark:text-slate-100">{staffDistribution.length} คน</span>
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-500 mt-1">
              จำนวนสินค้าถูกหารด้วยจำนวนพนักงานทั้งหมด เพื่อให้ทุกคนยกเท่ากัน
            </div>
          </div>

          <div className="space-y-3">
            {staffDistribution.map((staff, index) => {
              // คำนวณค่าเฉลี่ยจากข้อมูลที่มี
              const avgItems = staffDistribution.reduce((sum, s) => sum + s.total_items_per_staff, 0) / staffDistribution.length;
              const diffFromAvg = staff.total_items_per_staff - avgItems;
              const diffPercent = avgItems > 0 ? (diffFromAvg / avgItems) * 100 : 0;

              // กำหนดสีตามความแตกต่างจากค่าเฉลี่ย
              const getStatusColor = () => {
                if (Math.abs(diffPercent) < 1) return 'text-slate-600 dark:text-slate-400'; // ใกล้ค่าเฉลี่ย
                if (diffPercent > 10) return 'text-red-600 dark:text-red-400'; // มากกว่าเฉลี่ยมาก
                if (diffPercent < -10) return 'text-green-600 dark:text-green-400'; // น้อยกว่าเฉลี่ยมาก
                if (diffPercent > 0) return 'text-orange-600 dark:text-orange-400'; // มากกว่าเฉลี่ยนิดหน่อย
                return 'text-blue-600 dark:text-blue-400'; // น้อยกว่าเฉลี่ยนิดหน่อย
              };

              const getStatusBadge = () => {
                if (Math.abs(diffPercent) < 1) return { text: 'สมดุล', color: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300' };
                if (diffPercent > 10) return { text: 'ยกมาก', color: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' };
                if (diffPercent < -10) return { text: 'ยกน้อย', color: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' };
                if (diffPercent > 0) return { text: 'ยกมากกว่า', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300' };
                return { text: 'ยกน้อยกว่า', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' };
              };

              const status = getStatusBadge();

              return (
                <div
                  key={staff.crew_id}
                  className="border border-slate-200 dark:border-slate-700 rounded-lg p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg ${staff.staff_role === 'driver'
                        ? 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                        }`}>
                        {index + 1}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <div className="font-medium text-slate-900 dark:text-slate-100">
                            {staff.staff_name}
                          </div>
                          {staff.staff_role === 'driver' && (
                            <span className="text-xs px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300">
                              คนขับ
                            </span>
                          )}
                          <span className={`text-xs px-2 py-0.5 rounded ${status.color}`}>
                            {status.text}
                          </span>
                        </div>
                        <div className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                          {staff.staff_code} {staff.staff_phone && `· ${staff.staff_phone}`}
                        </div>
                      </div>
                    </div>

                    <div className="text-right ml-4">
                      <div className={`text-3xl font-bold ${getStatusColor()}`}>
                        {staff.total_items_per_staff.toLocaleString('th-TH', {
                          minimumFractionDigits: 0,
                          maximumFractionDigits: 1,
                        })}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        ชิ้น/คน
                      </div>
                      {Math.abs(diffPercent) >= 1 && (
                        <div className={`text-xs mt-1 ${getStatusColor()}`}>
                          {diffPercent > 0 ? '+' : ''}{diffPercent.toFixed(1)}% จากค่าเฉลี่ย
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Progress bar showing comparison */}
                  <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                    <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
                      <span>เปรียบเทียบกับค่าเฉลี่ย ({avgItems.toFixed(1)} ชิ้น/คน)</span>
                      <span>รวมทั้งหมด: {staff.total_items_to_carry.toFixed(0)} ชิ้น</span>
                    </div>
                    <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${diffPercent > 10 ? 'bg-red-500' :
                          diffPercent < -10 ? 'bg-green-500' :
                            diffPercent > 0 ? 'bg-orange-500' :
                              'bg-blue-500'
                          }`}
                        style={{
                          width: `${Math.min(100, Math.max(0, (staff.total_items_per_staff / (avgItems * 1.5)) * 100))}%`
                        }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Product Distribution Summary */}
      {!distributionLoading && productDistribution.length > 0 && (
        <Card className="mb-6">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
            <BarChart3 size={20} />
            สรุปการกระจายสินค้าตามชนิด
          </h3>

          <div className="space-y-3">
            {productDistribution.map((product) => (
              <div
                key={product.product_id}
                className="border border-slate-200 dark:border-slate-700 rounded-lg p-4"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div className="font-medium text-slate-900 dark:text-slate-100">
                      {product.product_name}
                    </div>
                    <div className="text-sm text-slate-500 dark:text-slate-400">
                      {product.product_code} · {product.category} · {product.unit}
                    </div>
                  </div>
                  <div className="text-right ml-4">
                    <div className="text-lg font-bold text-enterprise-600 dark:text-enterprise-400">
                      {product.quantity_per_staff.toLocaleString('th-TH', {
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 2,
                      })}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      {product.unit}/คน
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 mt-3 pt-3 border-t border-slate-200 dark:border-slate-700 text-sm">
                  <div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">รวมทั้งหมด</div>
                    <div className="font-semibold text-slate-900 dark:text-slate-100">
                      {product.total_quantity.toLocaleString('th-TH', {
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 2,
                      })} {product.unit}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">จำนวนร้าน</div>
                    <div className="font-semibold text-slate-900 dark:text-slate-100">
                      {product.store_count} ร้าน
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">พนักงานทั้งหมด</div>
                    <div className="font-semibold text-slate-900 dark:text-slate-100">
                      {product.total_staff_count} คน
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Post-Trip Analysis (AI Insight) */}
      <TripPostAnalysisPanel tripId={trip.id} tripStatus={trip.status} />

      {/* Stores */}
      {trip.stores && trip.stores.length > 0 && (
        <Card className="mb-6">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
            <MapPin size={20} />
            ร้านค้า ({trip.stores.length} ร้าน)
          </h3>

          <div className="space-y-4">
            {trip.stores
              .sort((a, b) => a.sequence_order - b.sequence_order)
              .map((storeWithDetails) => {
                const store = storeWithDetails.store;
                if (!store) return null;

                return (
                  <div
                    key={storeWithDetails.id}
                    className="border border-slate-200 dark:border-slate-700 rounded-lg p-4"
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <span className="flex items-center justify-center w-8 h-8 rounded-full bg-enterprise-100 dark:bg-enterprise-900 text-enterprise-600 dark:text-enterprise-400 font-semibold">
                        {storeWithDetails.sequence_order}
                      </span>
                      <div className="flex-1">
                        <div className="font-medium text-slate-900 dark:text-slate-100">
                          {store.customer_code} - {store.customer_name}
                        </div>
                        {store.address && (
                          <div className="text-sm text-slate-500 dark:text-slate-400">
                            {store.address}
                          </div>
                        )}
                        {store.phone && (
                          <div className="text-sm text-slate-500 dark:text-slate-400">
                            โทร: {store.phone}
                          </div>
                        )}
                      </div>
                      {storeWithDetails.delivery_status && (
                        (() => {
                          // ถ้าทริปจบแล้ว แต่สถานะร้านค้ายัง pending ให้แสดงเป็น "ส่งแล้ว" เพื่อให้สอดคล้องกับการใช้งานจริง
                          const rawStatus = storeWithDetails.delivery_status;
                          const effectiveStatus =
                            rawStatus === 'pending' && trip.status === 'completed'
                              ? 'delivered'
                              : rawStatus;

                          const className =
                            effectiveStatus === 'delivered'
                              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                              : effectiveStatus === 'failed'
                                ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                                : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';

                          const label =
                            effectiveStatus === 'delivered'
                              ? 'ส่งแล้ว'
                              : effectiveStatus === 'failed'
                                ? 'ส่งไม่สำเร็จ'
                                : 'รอส่ง';

                          return (
                            <span className={`px-2 py-1 rounded text-xs ${className}`}>
                              {label}
                            </span>
                          );
                        })()
                      )}
                    </div>

                    {/* Products for this store */}
                    {storeWithDetails.items && storeWithDetails.items.length > 0 && (
                      <div className="mt-3 pl-11">
                        <div className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                          สินค้า ({storeWithDetails.items.length} รายการ):
                        </div>
                        <div className="space-y-1">
                          {storeWithDetails.items.map((item) => {
                            const product = item.product;
                            if (!product) return null;

                            const quantityValue = Number(item.quantity) || 0;
                            // pickup_at_store comes from delivery_trip_items.quantity_picked_up_at_store
                            const pickedUpAtStore = Number((item as any).quantity_picked_up_at_store ?? 0);

                            return (
                              <div
                                key={item.id}
                                className="flex items-center justify-between gap-2 text-sm text-slate-600 dark:text-slate-400"
                              >
                                <div className="flex-1">
                                  • {product.product_code} - {product.product_name}
                                  {item.is_bonus && (
                                    <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                                      ของแถม
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 text-right min-w-[200px] justify-end">
                                  <span className="text-slate-700 dark:text-slate-300 font-medium">
                                    {quantityValue.toLocaleString()} {product.unit}
                                  </span>
                                  {pickedUpAtStore > 0 && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-700" title="ลูกค้ารับที่ร้านแล้ว">
                                      🏪 รับที่ร้าน {pickedUpAtStore.toLocaleString()}
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        </Card>
      )}

{/* Aggregated Products */ }
{
  aggregatedProducts.length > 0 && (
    <Card className="mb-6">
      <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
        <Package size={20} />
        สรุปสินค้าทั้งหมดในเที่ยว
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700">
              <th className="text-left py-2 px-3 text-sm font-medium text-slate-700 dark:text-slate-300">
                รหัสสินค้า
              </th>
              <th className="text-left py-2 px-3 text-sm font-medium text-slate-700 dark:text-slate-300">
                ชื่อสินค้า
              </th>
              <th className="text-left py-2 px-3 text-sm font-medium text-slate-700 dark:text-slate-300">
                หมวดหมู่
              </th>
              <th className="text-right py-2 px-3 text-sm font-medium text-slate-700 dark:text-slate-300">
                จำนวนรวม
              </th>
              <th className="text-left py-2 px-3 text-sm font-medium text-slate-700 dark:text-slate-300">
                ร้านค้า
              </th>
            </tr>
          </thead>
          <tbody>
            {aggregatedProducts.map((product) => (
              <tr
                key={product.product_id}
                className="border-b border-slate-100 dark:border-slate-800"
              >
                <td className="py-2 px-3 text-sm text-slate-900 dark:text-slate-100">
                  {product.product_code}
                </td>
                <td className="py-2 px-3 text-sm text-slate-900 dark:text-slate-100">
                  {product.product_name}
                </td>
                <td className="py-2 px-3 text-sm text-slate-500 dark:text-slate-400">
                  {product.category}
                </td>
                <td className="py-2 px-3 text-sm text-right font-medium text-slate-900 dark:text-slate-100">
                  {product.total_quantity.toLocaleString()} {product.unit}
                </td>
                <td className="py-2 px-3 text-sm text-slate-500 dark:text-slate-400">
                  {product.stores.map(s => `${s.customer_name} (${s.quantity})`).join(', ')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

{/* Crew Assignment Section */ }
<CrewAssignment
  tripId={trip.id}
  tripStatus={trip.status}
  onUpdate={() => {
    refetch();
  }}
/>

{/* Trip Edit History (Audit Log for Trip Data Changes) */ }
<Card>
  <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
    <FileText size={20} />
    ประวัติการแก้ไขข้อมูลทริป
  </h3>

  {editHistoryLoading && (
    <div className="text-center py-8 text-slate-500 dark:text-slate-400">
      กำลังโหลดประวัติการแก้ไข...
    </div>
  )}

  {editHistoryError && (
    <div className="text-center py-8 text-red-600 dark:text-red-400">
      {editHistoryError}
    </div>
  )}

  {!editHistoryLoading && !editHistoryError && editHistory.length === 0 && (
    <div className="text-center py-8 text-slate-500 dark:text-slate-400">
      ยังไม่มีประวัติการแก้ไขข้อมูลทริป
    </div>
  )}

  {!editHistoryLoading && !editHistoryError && editHistory.length > 0 && (
    <div className="space-y-4">
      {editHistory.map((edit, index) => (
        <div
          key={edit.id || index}
          className="border border-slate-200 dark:border-slate-700 rounded-lg p-4 bg-slate-50 dark:bg-slate-800/50"
        >
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-blue-500"></div>
              <span className="font-medium text-slate-900 dark:text-slate-100">
                {edit.editor?.full_name || 'ไม่ทราบชื่อ'}
              </span>
              <span className="text-sm text-slate-500 dark:text-slate-400">
                ({edit.editor?.email || 'ไม่มีอีเมล'})
              </span>
            </div>
            <span className="text-sm text-slate-500 dark:text-slate-400">
              {new Date(edit.edited_at).toLocaleString('th-TH', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </div>

          <div className="mb-3 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded">
            <div className="text-sm font-medium text-amber-800 dark:text-amber-200 mb-1">
              เหตุผล:
            </div>
            <div className="text-sm text-amber-900 dark:text-amber-100">
              {edit.edit_reason}
            </div>
          </div>

          {edit.changes && (() => {
            // Filter out UUID fields (vehicle_id, driver_id) and only show meaningful changes
            const fieldsToShow = Object.keys(edit.changes.new_values || {}).filter(
              field => !['vehicle_id', 'driver_id'].includes(field)
            );

            if (fieldsToShow.length === 0) {
              return null;
            }

            return (
              <div className="space-y-2">
                <div className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  การเปลี่ยนแปลง:
                </div>
                <div className="space-y-2">
                  {fieldsToShow.map((field) => {
                    const oldValue = edit.changes.old_values?.[field];
                    const newValue = edit.changes.new_values?.[field];

                    // Format field name
                    const fieldNames: Record<string, string> = {
                      'planned_date': 'วันที่วางแผน',
                      'odometer_start': 'เลขไมล์เริ่มต้น',
                      'odometer_end': 'เลขไมล์สิ้นสุด',
                      'status': 'สถานะ',
                      'notes': 'หมายเหตุ',
                      'sequence_order': 'ลำดับ',
                    };

                    const fieldLabel = fieldNames[field] || field;

                    // Format values
                    const formatValue = (val: any) => {
                      if (val === null || val === undefined || val === '') return '-';
                      if (field === 'planned_date') {
                        return new Date(val).toLocaleDateString('th-TH', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        });
                      }
                      return String(val);
                    };

                    return (
                      <div key={field} className="p-2 bg-white dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-700">
                        <div className="font-medium text-slate-600 dark:text-slate-400 text-xs mb-1">
                          {fieldLabel}
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-red-600 dark:text-red-400 line-through">
                            {formatValue(oldValue)}
                          </span>
                          <span className="text-slate-400">→</span>
                          <span className="text-green-600 dark:text-green-400 font-medium">
                            {formatValue(newValue)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}
        </div>
      ))}
    </div>
  )}
</Card>

{/* Item Change History (Audit Log) */ }
<Card>
  <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
    <FileText size={20} />
    ประวัติการแก้ไขสินค้า
  </h3>

  {itemChangesLoading && (
    <p className="text-sm text-slate-500 dark:text-slate-400">กำลังโหลดประวัติการแก้ไข...</p>
  )}

  {itemChangesError && (
    <p className="text-sm text-red-600 dark:text-red-400">{itemChangesError}</p>
  )}

  {!itemChangesLoading && !itemChangesError && itemChanges.length === 0 && (
    <p className="text-sm text-slate-500 dark:text-slate-400">
      ยังไม่มีประวัติการแก้ไขสินค้าในทริปนี้
    </p>
  )}

  {!itemChangesLoading && !itemChangesError && itemChanges.length > 0 && (
    <div className="space-y-3">
      {itemChanges.map((change) => {
        const actionLabel =
          change.action === 'add'
            ? 'เพิ่มรายการ'
            : change.action === 'remove'
              ? 'ลบรายการ'
              : 'แก้ไขจำนวน';

        const storeLabel = change.store
          ? `${change.store.customer_code} - ${change.store.customer_name}`
          : 'ไม่ระบุร้านค้า';

        const productLabel = change.product
          ? `${change.product.product_code} - ${change.product.product_name}`
          : 'ไม่ระบุสินค้า';

        return (
          <div
            key={change.id}
            className="border border-slate-200 dark:border-slate-700 rounded-lg p-3 text-sm"
          >
            <div className="flex justify-between items-center mb-1">
              <div className="font-medium text-slate-900 dark:text-slate-100">
                {actionLabel}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {formatDateTime(change.created_at)}
              </div>
            </div>
            <div className="text-slate-700 dark:text-slate-300">
              <div>ร้านค้า: {storeLabel}</div>
              <div>สินค้า: {productLabel}</div>
              <div className="mt-1">
                ปริมาณ:{' '}
                {change.old_quantity != null && change.new_quantity != null
                  ? `${Number(change.old_quantity).toLocaleString()} → ${Number(
                    change.new_quantity,
                  ).toLocaleString()}`
                  : change.old_quantity != null
                    ? `${Number(change.old_quantity).toLocaleString()} → 0`
                    : change.new_quantity != null
                      ? `0 → ${Number(change.new_quantity).toLocaleString()}`
                      : '-'}
              </div>
              {change.reason && (
                <div className="mt-1 text-slate-600 dark:text-slate-300">
                  เหตุผล: {change.reason}
                </div>
              )}
              {change.user && (
                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  โดย: {change.user.full_name}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  )}
</Card>

{/* Packing Layout Section */ }
<Card>
  <div className="flex items-center justify-between">
    <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
      <Package size={20} />
      การจัดเรียงสินค้า
    </h3>
    <Button
      variant={showPackingLayout ? 'outline' : 'primary'}
      size="sm"
      onClick={() => setShowPackingLayout(!showPackingLayout)}
    >
      {showPackingLayout ? 'ซ่อน' : 'ดูการจัดเรียง / บันทึก'}
    </Button>
  </div>
  {showPackingLayout && (
    <div className="mt-4">
      <PackingSimulator
        tripId={tripId}
        onClose={() => setShowPackingLayout(false)}
        onSaved={() => refetch()}
        embedInDetailView
      />
    </div>
  )}
</Card>

{/* Back Button */ }
{
  onBack && (
    <div className="mt-6">
      <Button variant="outline" onClick={onBack}>
        <ArrowLeft size={18} className="mr-2" />
        กลับ
      </Button>
    </div>
  )
}

{/* Modal: เพิ่มร้านในทริป (ออเดอร์ที่ตกหล่น) */ }
<Modal
  isOpen={addOrderModalOpen}
  onClose={() => {
    if (!addOrderSubmitting) setAddOrderModalOpen(false);
  }}
  title="เพิ่มร้านในทริป"
  size="large"
>
  <div className="space-y-4">
    <p className="text-sm text-slate-600 dark:text-slate-400">
      เลือกออเดอร์ที่รอจัดทริปเพื่อเพิ่มร้านเข้ากับทริปนี้ (ไม่ต้องลบทริปแล้วสร้างใหม่)
    </p>

    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
      <input
        type="text"
        placeholder="ค้นหาเลขออเดอร์, ร้านค้า..."
        value={addOrderSearch}
        onChange={(e) => setAddOrderSearch(e.target.value)}
        className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
      />
    </div>

    {addOrderError && (
      <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-sm">
        {addOrderError}
      </div>
    )}

    <div>
      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
        เหตุผลในการเพิ่มร้าน <span className="text-red-500">*</span>
      </label>
      <input
        type="text"
        value={addOrderReason}
        onChange={(e) => setAddOrderReason(e.target.value)}
        placeholder="เช่น เพิ่มร้านที่ตกหล่น"
        className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
      />
    </div>

    {pendingOrdersLoading ? (
      <div className="py-8 text-center text-slate-500 dark:text-slate-400">กำลังโหลดออเดอร์...</div>
    ) : pendingOrdersToShow.length === 0 ? (
      <div className="py-8 text-center text-slate-500 dark:text-slate-400">
        {pendingOrders.length === 0
          ? 'ไม่มีออเดอร์ที่รอจัดทริป'
          : 'ออเดอร์ที่รอจัดทริปทั้งหมดอยู่ในทริปนี้แล้ว หรือไม่ตรงกับคำค้นหา'}
      </div>
    ) : (
      <div className="max-h-64 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-lg divide-y divide-slate-200 dark:divide-slate-700">
        {pendingOrdersToShow.map((order: any) => (
          <button
            key={order.id}
            type="button"
            onClick={() => setSelectedOrderToAdd(selectedOrderToAdd?.id === order.id ? null : order)}
            className={`w-full p-4 text-left transition-colors ${selectedOrderToAdd?.id === order.id
              ? 'bg-enterprise-100 dark:bg-enterprise-900/30 border-l-4 border-enterprise-600'
              : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
              }`}
          >
            <div className="flex justify-between items-start">
              <div>
                <span className="font-mono text-sm text-blue-600 dark:text-blue-400">{order.order_number}</span>
                <span className="ml-2 font-medium text-slate-900 dark:text-white">{order.customer_name}</span>
              </div>
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                ฿{(order.total_amount || 0).toLocaleString()}
              </span>
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{order.customer_code}</div>
          </button>
        ))}
      </div>
    )}

    <div className="flex justify-end gap-2 pt-2">
      <Button variant="outline" onClick={() => setAddOrderModalOpen(false)} disabled={addOrderSubmitting}>
        ยกเลิก
      </Button>
      <Button
        onClick={handleAddOrderToTrip}
        disabled={!selectedOrderToAdd || !addOrderReason.trim() || addOrderSubmitting}
        isLoading={addOrderSubmitting}
      >
        เพิ่มร้านเข้ากับทริป
      </Button>
    </div>
  </div>
</Modal>

{/* Image Modal */ }
<ImageModal
  isOpen={!!selectedImage}
  imageUrl={selectedImage?.url || ''}
  alt={selectedImage?.alt || ''}
  onClose={() => setSelectedImage(null)}
/>
    </PageLayout >
  );
};

