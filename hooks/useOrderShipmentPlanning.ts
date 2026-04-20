/**
 * Hook: useOrderShipmentPlanning
 *
 * Manages state for "Order Shipment Planning" — the screen where a user
 * creates the next delivery trip leg from an order's remaining items.
 *
 * Flow:
 *  1. Load order details + remaining quantities (from allocation view).
 *  2. User selects vehicle, driver, date, and per-item quantity for this leg.
 *  3. On submit: create delivery_trip → delivery_trip_store → delivery_trip_items
 *     → allocation rows → assign order to trip (first time only).
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { deliveryTripService } from '../services/deliveryTripService';
import { ordersService } from '../services/ordersService';
import { allocationService } from '../services/allocationService';
import type { OrderItemRemaining } from '../services/allocationService';
import { profileService } from '../services/profileService';
import { useVehicles } from './useVehicles';
import { useAuth } from './useAuth';
import { useToast } from './useToast';

interface LegItem {
  order_item_id: string;
  product_id: string;
  product_name: string;
  product_code: string;
  unit: string;
  total_quantity: number;
  remaining_unallocated: number;
  quantity_for_this_leg: string | number;
}

export interface ShipmentPlanningDriver {
  id: string;
  full_name: string;
  branch: string | null;
}

export function useOrderShipmentPlanning(orderId: string | null, onSuccess?: () => void) {
  const { user } = useAuth();
  const { vehicles, loading: vehiclesLoading, error: vehiclesError } = useVehicles();
  const { success, error: toastError } = useToast();

  const [orderDetail, setOrderDetail] = useState<any | null>(null);
  const [remainingItems, setRemainingItems] = useState<OrderItemRemaining[]>([]);
  const [legItems, setLegItems] = useState<LegItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [drivers, setDrivers] = useState<ShipmentPlanningDriver[]>([]);

  /** '' = ทุกสาขา; ค่าเริ่มต้นตั้งจากสาขาของออเดอร์เมื่อโหลดแล้ว */
  const [selectedBranch, setSelectedBranch] = useState<string>('');

  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [selectedDriverId, setSelectedDriverId] = useState('');
  const [tripDate, setTripDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');

  // Load order + remaining items
  useEffect(() => {
    if (!orderId) return;
    let cancelled = false;

    const load = async () => {
      try {
        setLoading(true);

        const [detailData, remainingData, driversData] = await Promise.all([
          supabase
            .from('orders_with_details')
            .select('*')
            .eq('id', orderId)
            .single(),
          allocationService.getRemainingByOrderId(orderId),
          profileService.getAll(),
        ]);

        if (cancelled) return;

        if (detailData.error) throw new Error(detailData.error.message);
        const detail = detailData.data;
        setOrderDetail(detail);
        const orderBranch = detail?.branch != null && String(detail.branch).trim() !== '' ? String(detail.branch) : '';
        setSelectedBranch(orderBranch);
        setSelectedVehicleId('');
        setSelectedDriverId('');
        setRemainingItems(remainingData);

        const driverProfiles = (driversData || []).filter((p: any) => p.role === 'driver');
        setDrivers(
          driverProfiles.map((p: any) => ({
            id: p.id,
            full_name: p.full_name || '',
            branch: p.branch != null && String(p.branch).trim() !== '' ? String(p.branch) : null,
          }))
        );

        // Load product names for remaining delivery items
        const deliveryItems = remainingData.filter(
          (r) => r.fulfillment_method !== 'pickup' && r.remaining_unallocated > 0
        );

        if (deliveryItems.length === 0) {
          setLegItems([]);
          return;
        }

        const productIds = [...new Set(deliveryItems.map((r) => r.product_id))];
        const { data: products } = await supabase
          .from('products')
          .select('id, product_name, product_code, unit')
          .in('id', productIds);

        type ProductRow = { id: string; product_name: string | null; product_code: string | null; unit: string | null };
        const productMap = new Map<string, ProductRow>((products ?? []).map((p: any) => [p.id, p as ProductRow]));

        setLegItems(
          deliveryItems.map((r) => {
            const p = productMap.get(r.product_id);
            return {
              order_item_id: r.order_item_id,
              product_id: r.product_id,
              product_name: p?.product_name ?? 'ไม่ระบุชื่อสินค้า',
              product_code: p?.product_code ?? '-',
              unit: p?.unit ?? 'หน่วย',
              total_quantity: r.total_quantity,
              remaining_unallocated: r.remaining_unallocated,
              quantity_for_this_leg: r.remaining_unallocated,
            };
          })
        );
      } catch (err: any) {
        console.error('[useOrderShipmentPlanning] load error:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [orderId]);

  const setLegQty = useCallback((orderItemId: string, value: string | number) => {
    setLegItems((prev) =>
      prev.map((item) =>
        item.order_item_id === orderItemId
          ? { ...item, quantity_for_this_leg: value }
          : item
      )
    );
  }, []);

  const totalLegQty = useMemo(
    () => legItems.reduce((sum, item) => sum + (Number(item.quantity_for_this_leg) || 0), 0),
    [legItems]
  );

  const isValid = useMemo(
    () => !!selectedVehicleId && !!tripDate && totalLegQty > 0,
    [selectedVehicleId, tripDate, totalLegQty]
  );

  const handleSubmit = useCallback(async () => {
    if (!orderId || !user || !isValid) return;

    const itemsForLeg = legItems.filter((item) => (Number(item.quantity_for_this_leg) || 0) > 0);

    // Validate quantities don't exceed remaining
    for (const item of itemsForLeg) {
      const qty = Number(item.quantity_for_this_leg);
      if (qty > item.remaining_unallocated) {
        toastError(`${item.product_name}: จำนวนที่ระบุ (${qty}) เกินกว่าที่เหลือ (${item.remaining_unallocated})`);
        return;
      }
    }

    try {
      setSubmitting(true);

      const storeId = orderDetail?.store_id;
      if (!storeId) throw new Error('ไม่พบ store_id ของออเดอร์');

      // Build stores/items payload for trip creation
      const storesPayload = [
        {
          store_id: storeId,
          sequence_order: 1,
          items: itemsForLeg.map((item) => ({
            product_id: item.product_id,
            quantity: Number(item.quantity_for_this_leg),
            quantity_picked_up_at_store: 0,
            notes: null,
            is_bonus: false,
            unit: item.unit || null,
          })),
        },
      ];

      // 1. Create the delivery trip
      const trip = await deliveryTripService.create({
        vehicle_id: selectedVehicleId,
        driver_id: selectedDriverId || user.id,
        planned_date: tripDate,
        notes: notes || undefined,
        stores: storesPayload,
      });

      // 2. Check if this is the FIRST allocation for the order BEFORE creating records.
      //    If delivery_trip_id is null on the order, this is the first leg — set it for
      //    backward compatibility with existing trip detail / status logic.
      const isFirstLeg = !orderDetail?.delivery_trip_id;

      // 3. Determine sequence number for this allocation leg
      const seqNo = await allocationService.getNextSequenceNo(orderId);

      // 4. Create allocation rows (one per order item in this leg)
      await allocationService.createAllocations({
        order_id: orderId,
        delivery_trip_id: trip.id,
        sequence_no: seqNo,
        items: itemsForLeg.map((item) => ({
          order_item_id: item.order_item_id,
          allocated_quantity: Number(item.quantity_for_this_leg),
        })),
      });

      // 5. Assign order → trip via ordersService only for the first leg
      //    (sets orders.delivery_trip_id for backward compatibility).
      if (isFirstLeg) {
        await ordersService.assignToTrip([orderId], trip.id, user.id);
      }

      success(`สร้างทริป ${trip.trip_number} เรียบร้อย (${totalLegQty} รายการ)`);
      onSuccess?.();
    } catch (err: any) {
      console.error('[useOrderShipmentPlanning] submit error:', err);
      toastError(err.message || 'เกิดข้อผิดพลาดในการสร้างทริป');
    } finally {
      setSubmitting(false);
    }
  }, [
    orderId, user, isValid, legItems, orderDetail, selectedVehicleId, selectedDriverId,
    tripDate, notes, remainingItems, totalLegQty, onSuccess, success, toastError,
  ]);

  const branches = useMemo(() => {
    if (!vehicles?.length) return [];
    const unique = new Set<string>();
    vehicles.forEach((v: any) => {
      if (v.branch != null && String(v.branch).trim() !== '') unique.add(String(v.branch));
    });
    return Array.from(unique).sort();
  }, [vehicles]);

  /** ตาราง vehicles ไม่มี status — อย่ากรองด้วย status === 'active' (จะได้รายการว่าง); ถ้ามี status ค่อยตัดซ่อมบำรุง/ปลดระวาง */
  const filteredVehicles = useMemo(() => {
    let list = vehicles.filter((v: any) => {
      const s = v.status;
      if (s == null || s === '') return true;
      const lower = String(s).toLowerCase();
      return lower !== 'maintenance' && lower !== 'inactive' && lower !== 'retired';
    });
    if (selectedBranch) {
      list = list.filter((v: any) => v.branch === selectedBranch);
    }
    return list;
  }, [vehicles, selectedBranch]);

  const filteredDrivers = useMemo(() => {
    if (!selectedBranch) return drivers;
    return drivers.filter((d) => d.branch === selectedBranch);
  }, [drivers, selectedBranch]);

  useEffect(() => {
    if (!selectedVehicleId) return;
    if (!filteredVehicles.some((v: any) => v.id === selectedVehicleId)) {
      setSelectedVehicleId('');
    }
  }, [filteredVehicles, selectedVehicleId]);

  useEffect(() => {
    if (!selectedDriverId) return;
    if (!filteredDrivers.some((d) => d.id === selectedDriverId)) {
      setSelectedDriverId('');
    }
  }, [filteredDrivers, selectedDriverId]);

  return {
    orderDetail,
    legItems,
    loading,
    submitting,
    drivers,
    vehicles,
    filteredDrivers,
    filteredVehicles,
    vehiclesLoading,
    vehiclesError,
    branches,
    selectedBranch,
    setSelectedBranch,
    selectedVehicleId,
    setSelectedVehicleId,
    selectedDriverId,
    setSelectedDriverId,
    tripDate,
    setTripDate,
    notes,
    setNotes,
    setLegQty,
    totalLegQty,
    isValid,
    handleSubmit,
  };
}
