import { useState, useEffect, useCallback, useMemo } from 'react';
import { useDeliveryTrip } from './useDeliveryTrips';
import { useAuth } from './useAuth';
import { deliveryTripService } from '../services/deliveryTripService';
import { ordersService } from '../services/ordersService';
import { tripMetricsService } from '../services/tripMetricsService';
import type { PostTripAnalysisEntry } from '../services/tripMetricsService';
import type { DeliveryTripItemChangeWithDetails } from '../services/deliveryTripService';

export type { PostTripAnalysisEntry };

export interface PickupEntry {
  store_id: string;
  store_name: string;
  customer_code: string;
  order_id: string;
  order_number: string | null;
  items: Array<{
    product_code: string;
    product_name: string;
    unit: string;
    quantity_picked_up: number;
    is_bonus: boolean;
  }>;
}

export function useDeliveryTripDetail(tripId: string) {
  const { trip, loading, error, refetch } = useDeliveryTrip(tripId);
  const { user } = useAuth();

  // Aggregated / computed data
  const [aggregatedProducts, setAggregatedProducts] = useState<any[]>([]);
  const [staffDistribution, setStaffDistribution] = useState<any[]>([]);
  const [productDistribution, setProductDistribution] = useState<any[]>([]);
  const [distributionLoading, setDistributionLoading] = useState(false);
  const [postAnalyses, setPostAnalyses] = useState<PostTripAnalysisEntry[]>([]);
  const [postAnalysisLoading, setPostAnalysisLoading] = useState(false);
  const [postAnalysisError, setPostAnalysisError] = useState<string | null>(null);
  const [pickupBreakdown, setPickupBreakdown] = useState<PickupEntry[]>([]);

  // Audit logs
  const [itemChanges, setItemChanges] = useState<DeliveryTripItemChangeWithDetails[]>([]);
  const [itemChangesLoading, setItemChangesLoading] = useState(false);
  const [itemChangesError, setItemChangesError] = useState<string | null>(null);
  const [editHistory, setEditHistory] = useState<any[]>([]);
  const [editHistoryLoading, setEditHistoryLoading] = useState(false);
  const [editHistoryError, setEditHistoryError] = useState<string | null>(null);

  // Image display state
  const [vehicleImageError, setVehicleImageError] = useState(false);
  const [driverImageError, setDriverImageError] = useState(false);
  const [selectedImage, setSelectedImage] = useState<{ url: string; alt: string } | null>(null);

  // Add-order-to-trip modal state
  const [addOrderModalOpen, setAddOrderModalOpen] = useState(false);
  const [pendingOrders, setPendingOrders] = useState<any[]>([]);
  const [pendingOrdersLoading, setPendingOrdersLoading] = useState(false);
  const [addOrderSearch, setAddOrderSearch] = useState('');
  const [selectedOrdersToAdd, setSelectedOrdersToAdd] = useState<any[]>([]);
  const [addOrderReason, setAddOrderReason] = useState('');
  const [addOrderSubmitting, setAddOrderSubmitting] = useState(false);
  const [addOrderError, setAddOrderError] = useState<string | null>(null);

  // ─── Load aggregated data when trip changes ───────────────────────────────
  useEffect(() => {
    if (!trip) return;

    setVehicleImageError(false);
    setDriverImageError(false);

    deliveryTripService.getAggregatedProducts(trip.id).then(setAggregatedProducts);

    setDistributionLoading(true);
    Promise.all([
      deliveryTripService.getStaffItemDistribution(trip.id),
      deliveryTripService.getProductDistributionByTrip(trip.id),
    ])
      .then(([staffDist, productDist]) => {
        setStaffDistribution(staffDist);
        setProductDistribution(productDist);
      })
      .catch(() => {
        setStaffDistribution([]);
        setProductDistribution([]);
      })
      .finally(() => setDistributionLoading(false));

    setPostAnalysisLoading(true);
    setPostAnalysisError(null);
    tripMetricsService
      .getPostTripAnalysisForTrip(trip.id)
      .then(setPostAnalyses)
      .catch((err: any) => {
        setPostAnalyses([]);
        setPostAnalysisError(err?.message || 'ไม่สามารถโหลดผลการวิเคราะห์ทริปได้');
      })
      .finally(() => setPostAnalysisLoading(false));

    ordersService
      .getPickupBreakdownByTrip(trip.id)
      .then(setPickupBreakdown)
      .catch(() => setPickupBreakdown([]));
  }, [trip?.id]);

  // ─── Load item change history ─────────────────────────────────────────────
  useEffect(() => {
    if (!trip) return;
    setItemChangesLoading(true);
    setItemChangesError(null);
    deliveryTripService
      .getItemChangeHistory(trip.id)
      .then(setItemChanges)
      .catch((err: any) =>
        setItemChangesError(err?.message || 'ไม่สามารถโหลดประวัติการแก้ไขสินค้าได้'),
      )
      .finally(() => setItemChangesLoading(false));
  }, [trip?.id]);

  // ─── Load trip edit history ───────────────────────────────────────────────
  useEffect(() => {
    if (!trip) return;
    setEditHistoryLoading(true);
    setEditHistoryError(null);
    deliveryTripService
      .getDeliveryTripEditHistory(trip.id)
      .then(setEditHistory)
      .catch((err: any) =>
        setEditHistoryError(err?.message || 'ไม่สามารถโหลดประวัติการแก้ไขข้อมูลทริปได้'),
      )
      .finally(() => setEditHistoryLoading(false));
  }, [trip?.id]);

  // ─── Load pending orders when add-order modal opens ──────────────────────
  useEffect(() => {
    if (!addOrderModalOpen || !trip) return;
    setPendingOrdersLoading(true);
    setAddOrderError(null);
    setSelectedOrdersToAdd([]);
    setAddOrderReason('');
    ordersService
      .getPendingOrders()
      .then((data) => setPendingOrders(data || []))
      .catch((err) => setAddOrderError(err?.message || 'โหลดรายการออเดอร์ไม่สำเร็จ'))
      .finally(() => setPendingOrdersLoading(false));
  }, [addOrderModalOpen, trip?.id]);

  // ─── Filtered pending orders for modal ───────────────────────────────────
  const pendingOrdersToShow = useMemo(() => {
    const storeIdsInTrip = new Set((trip?.stores || []).map((s: any) => s.store_id));
    let list = (pendingOrders || []).filter((o: any) => !storeIdsInTrip.has(o.store_id));
    if (addOrderSearch.trim()) {
      const q = addOrderSearch.toLowerCase().trim();
      list = list.filter(
        (o: any) =>
          (o.order_number && o.order_number.toLowerCase().includes(q)) ||
          (o.customer_name && o.customer_name.toLowerCase().includes(q)) ||
          (o.customer_code && o.customer_code.toLowerCase().includes(q)),
      );
    }
    return list;
  }, [trip?.stores, pendingOrders, addOrderSearch]);

  // ─── Add order to trip ────────────────────────────────────────────────────
  const handleAddOrderToTrip = useCallback(async () => {
    if (!trip || !user?.id || selectedOrdersToAdd.length === 0) return;
    if (!addOrderReason.trim()) {
      setAddOrderError('กรุณาระบุเหตุผลในการเพิ่มร้าน (เช่น เพิ่มร้านที่ตกหล่น)');
      return;
    }

    setAddOrderSubmitting(true);
    setAddOrderError(null);

    try {
      const existingStores = (trip.stores || []).map((s: any) => ({
        store_id: s.store_id,
        sequence_order: s.sequence_order,
        items: (s.items || []).map((item: any) => ({
          product_id: item.product_id,
          quantity: Number(item.quantity),
          is_bonus: item.is_bonus || false,
        })),
      }));

      const baseSequence = existingStores.reduce(
        (max: number, s: any) => Math.max(max, s.sequence_order),
        0,
      );

      const newStores = selectedOrdersToAdd
        .map((order: any, index: number) => {
          const items = (order.items || [])
            .filter((item: any) => item.product_id && Number(item.quantity) > 0)
            .map((item: any) => ({
              product_id: item.product_id,
              quantity: Number(item.quantity),
              is_bonus: false,
            }));
          return { store_id: order.store_id, sequence_order: baseSequence + index + 1, items };
        })
        .filter((store: any) => (store.items || []).length > 0);

      if (newStores.length === 0) {
        setAddOrderError('ไม่พบสินค้าที่ต้องจัดส่งในออเดอร์ที่เลือก');
        return;
      }

      await deliveryTripService.update(trip.id, {
        stores: [...existingStores, ...newStores],
        edit_reason: addOrderReason.trim(),
      });

      const orderIds = selectedOrdersToAdd.map((o: any) => o.id);
      await ordersService.assignToTrip(orderIds, trip.id, user.id);
      setAddOrderModalOpen(false);
      refetch();
    } catch (err: any) {
      setAddOrderError(err?.message || 'ไม่สามารถเพิ่มร้านเข้ากับทริปได้');
    } finally {
      setAddOrderSubmitting(false);
    }
  }, [trip, selectedOrdersToAdd, addOrderReason, user?.id, refetch]);

  return {
    // Core
    trip,
    loading,
    error,
    refetch,

    // Aggregated data
    aggregatedProducts,
    staffDistribution,
    productDistribution,
    distributionLoading,
    postAnalyses,
    postAnalysisLoading,
    postAnalysisError,
    pickupBreakdown,

    // Audit logs
    itemChanges,
    itemChangesLoading,
    itemChangesError,
    editHistory,
    editHistoryLoading,
    editHistoryError,

    // Image state
    vehicleImageError,
    driverImageError,
    setVehicleImageError,
    setDriverImageError,
    selectedImage,
    setSelectedImage,

    // Add-order modal
    addOrderModalOpen,
    setAddOrderModalOpen,
    pendingOrders,
    pendingOrdersLoading,
    pendingOrdersToShow,
    addOrderSearch,
    setAddOrderSearch,
    selectedOrdersToAdd,
    setSelectedOrdersToAdd,
    addOrderReason,
    setAddOrderReason,
    addOrderSubmitting,
    addOrderError,
    handleAddOrderToTrip,
  };
}
