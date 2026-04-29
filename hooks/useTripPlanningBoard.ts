import { useCallback, useEffect, useMemo, useState } from 'react';
import type { DragEndEvent, DragOverEvent, DragStartEvent } from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import {
  KeyboardSensor,
  PointerSensor,
  defaultDropAnimationSideEffects,
  type DropAnimation,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';

import { useAuth } from './useAuth';
import { useFeatureAccess } from './useFeatureAccess';
import { useOrderBranchScope } from './useOrderBranchScope';
import { useToast } from './useToast';
import { ordersService } from '../services/ordersService';
import { deliveryTripService } from '../services/deliveryTripService';
import { vehicleService } from '../services/vehicleService';
import { tripMetricsService } from '../services/tripMetricsService';
import { supabase } from '../lib/supabase';
import { getAreaGroupKey, getDistrictKey } from '../utils/parseThaiAddress';
import { mergeOrderItemsAcrossOrders } from '../utils/tripPlanningMerge';

/** เริ่มจากคอลัมน์รถว่าง — ให้เห็นภาพรถหลายคันได้ทันที (จากแผนจัดคิว) */
export const INITIAL_TRIP_PLANNING_LANE_COUNT = 7;

export interface PlanningStore {
  id: string;
  store_id: string;
  customer_code: string;
  customer_name: string;
  address: string | null;
  orders: any[];
  total_pallets: number;
  total_weight_kg: number;
  areaKey: string;
  districtKey: string;
}

export interface PlanningSlot {
  id: string;
  stores: PlanningStore[];
  vehicle_id: string | null;
}

export interface PlanningLane {
  id: string;
  vehicle_id: string | null;
  slots: PlanningSlot[];
}

function createEmptyLanes(count: number, baseTime: number): PlanningLane[] {
  return Array.from({ length: count }, (_, idx) => ({
    id: `lane-${idx + 1}`,
    vehicle_id: null,
    slots: [
      {
        id: `slot-${idx + 1}-1-${baseTime}`,
        stores: [],
        vehicle_id: null,
      },
    ],
  }));
}

const PRODUCT_IDS_CHUNK = 200;

/** ดึง products เป็นก้อนใหญ่ครั้งเดียวแทนยิงทีละร้าน (ลด waterfall) */
async function fetchProductWeightMap(productIds: string[]): Promise<
  Map<string, { product_name?: string | null; weight_kg?: number | null }>
> {
  const uniq = [...new Set(productIds.filter(Boolean))];
  const map = new Map<string, { product_name?: string | null; weight_kg?: number | null }>();
  if (uniq.length === 0) return map;

  const chunks: string[][] = [];
  for (let i = 0; i < uniq.length; i += PRODUCT_IDS_CHUNK) {
    chunks.push(uniq.slice(i, i + PRODUCT_IDS_CHUNK));
  }
  const chunkResults = await Promise.all(
    chunks.map((slice) =>
      supabase.from('products').select('id, product_name, weight_kg').in('id', slice).then((r) => r.data ?? []),
    ),
  );
  for (const prodRows of chunkResults) {
    for (const p of prodRows) {
      map.set((p as any).id, {
        product_name: (p as any).product_name,
        weight_kg: (p as any).weight_kg,
      });
    }
  }
  return map;
}

/** คำนวณพาเลทจาก orders + product map (ไม่เรียก products ซ้ำ) */
async function computePalletsForStore(
  orders: any[],
  sharedProductMap: Map<string, { product_name?: string | null; weight_kg?: number | null }>,
): Promise<{ totalPallets: number; totalWeightKg: number }> {
  const merged = mergeOrderItemsAcrossOrders(orders);
  if (merged.length === 0) return { totalPallets: 0, totalWeightKg: 0 };

  const productMap = sharedProductMap;

  const planItems = merged.map((m) => {
    const p = productMap.get(m.product_id);
    const wPerUnit = Number(p?.weight_kg ?? 0) || 0;
    const weightTotal = m.quantity * wPerUnit;
    return {
      product_id: m.product_id,
      product_name: String(p?.product_name ?? 'สินค้า').trim(),
      quantity: m.quantity,
      weight_kg: weightTotal,
    };
  });

  const summary = await tripMetricsService.computePackingPlanSummary({
    items: planItems,
    vehicleMaxPallets: null,
  });

  return {
    totalPallets: summary.totalPallets,
    totalWeightKg: summary.totalWeightKg,
  };
}

async function mapPendingOrdersToStores(ordersWithItems: any[]): Promise<PlanningStore[]> {
  const storeMap = new Map<string, PlanningStore>();

  for (const order of ordersWithItems) {
    const storeId = order.store_id as string | undefined;
    if (!storeId) continue;

    const addr = order.delivery_address || order.store?.address || null;
    const areaKey = getAreaGroupKey(addr);
    const districtKey = getDistrictKey(addr);

    if (!storeMap.has(storeId)) {
      storeMap.set(storeId, {
        id: storeId,
        store_id: storeId,
        customer_code: order.customer_code || order.store?.customer_code || '-',
        customer_name: order.customer_name || order.store?.customer_name || '-',
        address: addr,
        orders: [],
        total_pallets: 0,
        total_weight_kg: 0,
        areaKey,
        districtKey,
      });
    }
    storeMap.get(storeId)!.orders.push(order);
  }

  const storesArr = [...storeMap.values()];

  const allProductIds: string[] = [];
  for (const store of storesArr) {
    const merged = mergeOrderItemsAcrossOrders(store.orders);
    for (const m of merged) {
      if (m.product_id) allProductIds.push(m.product_id);
    }
  }
  const productWeightMap = await fetchProductWeightMap(allProductIds);

  await Promise.all(
    storesArr.map(async (store) => {
      const { totalPallets, totalWeightKg } = await computePalletsForStore(store.orders, productWeightMap);
      store.total_pallets = totalPallets;
      store.total_weight_kg = totalWeightKg;
    }),
  );

  return storesArr;
}

export function useTripPlanningBoard() {
  const { profile } = useAuth();
  const toastApi = useToast();
  const { success, error, warning } = toastApi;
  const orderScope = useOrderBranchScope();
  const { can, loading: featureLoading } = useFeatureAccess();

  const canUseBoard = can('tab.trip_planning_board', 'view');

  const pendingFilters = useMemo(() => {
    if (featureLoading || !canUseBoard || orderScope.loading) {
      return { branchesIn: [] as string[] };
    }
    if (orderScope.unrestricted) {
      return undefined;
    }
    return { branchesIn: orderScope.allowedBranches };
  }, [featureLoading, canUseBoard, orderScope.loading, orderScope.unrestricted, orderScope.allowedBranches]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [backlog, setBacklog] = useState<PlanningStore[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [lanes, setLanes] = useState<PlanningLane[]>(() => createEmptyLanes(INITIAL_TRIP_PLANNING_LANE_COUNT, Date.now()));
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeStore, setActiveStore] = useState<PlanningStore | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStoreIds, setSelectedStoreIds] = useState<Set<string>>(() => new Set());

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const dropAnimationConfig: DropAnimation = {
    sideEffects: defaultDropAnimationSideEffects({
      styles: { active: { opacity: '0.5' } },
    }),
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [pendingOrders, vehListRaw] = await Promise.all([
        pendingFilters?.branchesIn?.length === 0
          ? Promise.resolve([] as any[])
          : ordersService.getPendingOrders(pendingFilters),
        vehicleService.getAll(),
      ]);

      let vehList = vehListRaw;
      if (!orderScope.loading && orderScope.unrestricted !== true && orderScope.allowedBranches?.length) {
        const allowed = new Set(orderScope.allowedBranches);
        vehList = vehList.filter((v: any) => !v.branch || allowed.has(String(v.branch)));
      }

      const finalBacklog = await mapPendingOrdersToStores(pendingOrders);

      setBacklog(finalBacklog);
      setVehicles(vehList);
      setSelectedStoreIds(new Set());
      setLanes(createEmptyLanes(INITIAL_TRIP_PLANNING_LANE_COUNT, Date.now()));
    } catch (e) {
      console.error('[useTripPlanningBoard] fetch failed', e);
      throw e;
    } finally {
      setLoading(false);
    }
  }, [pendingFilters, orderScope.loading, orderScope.unrestricted, orderScope.allowedBranches]);

  useEffect(() => {
    if (!featureLoading && canUseBoard && !orderScope.loading && pendingFilters?.branchesIn?.length !== 0) {
      void fetchData();
    }
    if (
      pendingFilters?.branchesIn?.length === 0 &&
      !orderScope.loading &&
      !featureLoading &&
      canUseBoard
    ) {
      setLoading(false);
      setBacklog([]);
      setVehicles([]);
    }
  }, [featureLoading, canUseBoard, orderScope.loading, pendingFilters, fetchData]);

  const filteredBacklog = useMemo(() => {
    if (!searchQuery.trim()) return backlog;
    const lower = searchQuery.toLowerCase();
    return backlog.filter(
      (s) =>
        s.customer_name.toLowerCase().includes(lower) ||
        s.customer_code.toLowerCase().includes(lower) ||
        s.districtKey.toLowerCase().includes(lower) ||
        s.areaKey.toLowerCase().includes(lower),
    );
  }, [backlog, searchQuery]);

  const findContainer = useCallback(
    (id: string) => {
      if (id === 'backlog-container') return 'backlog-container';
      const inBacklog = backlog.some((s) => s.id === id);
      if (inBacklog) return 'backlog-container';

      for (const lane of lanes) {
        for (const slot of lane.slots) {
          if (slot.id === id || slot.stores.some((s) => s.id === id)) {
            return slot.id;
          }
        }
      }
      return null;
    },
    [backlog, lanes],
  );

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const id = String(event.active.id);
      setActiveId(id);

      const inBacklog = backlog.find((s) => s.id === id);
      if (inBacklog) {
        setActiveStore(inBacklog);
        return;
      }
      for (const lane of lanes) {
        for (const slot of lane.slots) {
          const inSlot = slot.stores.find((s) => s.id === id);
          if (inSlot) {
            setActiveStore(inSlot);
            return;
          }
        }
      }
    },
    [backlog, lanes],
  );

  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      const { active, over } = event;
      if (!over) return;

      const aId = String(active.id);
      const oId = String(over.id);

      const activeContainer = findContainer(aId);
      const overContainer = findContainer(oId);

      if (!activeContainer || !overContainer || activeContainer === overContainer) {
        return;
      }

      let storeToMove: PlanningStore | null = null;

      if (activeContainer === 'backlog-container') {
        const idx = backlog.findIndex((s) => s.id === aId);
        storeToMove = backlog[idx];
        setBacklog((prev) => prev.filter((s) => s.id !== aId));
        setLanes((prev) =>
          prev.map((lane) => ({
            ...lane,
            slots: lane.slots.map((slot) => {
              if (slot.id === overContainer) {
                return { ...slot, stores: [...slot.stores, storeToMove!] };
              }
              return slot;
            }),
          })),
        );
      } else {
        setLanes((prev) =>
          prev.map((lane) => ({
            ...lane,
            slots: lane.slots.map((slot) => {
              if (slot.id === activeContainer) {
                const idx = slot.stores.findIndex((s) => s.id === aId);
                storeToMove = slot.stores[idx];
                return { ...slot, stores: slot.stores.filter((s) => s.id !== aId) };
              }
              return slot;
            }),
          })),
        );

        if (overContainer === 'backlog-container') {
          setBacklog((prev) => [...prev, storeToMove!]);
        } else {
          setLanes((prev) =>
            prev.map((lane) => ({
              ...lane,
              slots: lane.slots.map((slot) => {
                if (slot.id === overContainer) {
                  return { ...slot, stores: [...slot.stores, storeToMove!] };
                }
                return slot;
              }),
            })),
          );
        }
      }
    },
    [backlog, findContainer],
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveId(null);
      setActiveStore(null);

      const { active, over } = event;
      if (!over) return;

      const activeIdLocal = String(active.id);
      const overIdLocal = String(over.id);

      const activeContainer = findContainer(activeIdLocal);
      const overContainer = findContainer(overIdLocal);

      if (!activeContainer || !overContainer || activeContainer !== overContainer) {
        return;
      }

      if (activeIdLocal === overIdLocal) return;

      if (activeContainer === 'backlog-container') {
        setBacklog((prev) => {
          const oldIndex = prev.findIndex((s) => s.id === activeIdLocal);
          const newIndex = prev.findIndex((s) => s.id === overIdLocal);
          if (oldIndex === -1 || newIndex === -1) return prev;
          return arrayMove(prev, oldIndex, newIndex);
        });
      } else {
        setLanes((prev) =>
          prev.map((lane) => ({
            ...lane,
            slots: lane.slots.map((slot) => {
              if (slot.id === activeContainer) {
                const oldIndex = slot.stores.findIndex((s) => s.id === activeIdLocal);
                const newIndex = slot.stores.findIndex((s) => s.id === overIdLocal);
                if (oldIndex === -1 || newIndex === -1) return slot;
                return { ...slot, stores: arrayMove(slot.stores, oldIndex, newIndex) };
              }
              return slot;
            }),
          })),
        );
      }
    },
    [findContainer],
  );

  const toggleSelectStore = useCallback((storeId: string) => {
    setSelectedStoreIds((prev) => {
      const n = new Set(prev);
      if (n.has(storeId)) n.delete(storeId);
      else n.add(storeId);
      return n;
    });
  }, []);

  const clearSelection = useCallback(() => setSelectedStoreIds(new Set()), []);

  /** ย้ายร้านในคิวที่ถูกติ็กจากซ้ายลงในช่องเที่ยว (multi-select ตามแผน) */
  const moveSelectedToSlot = useCallback(
    (slotId: string) => {
      if (selectedStoreIds.size === 0) return;

      const toMoveIds = backlog.filter((s) => selectedStoreIds.has(s.id)).map((s) => s.id);
      if (toMoveIds.length === 0) return;

      const moving = backlog.filter((s) => toMoveIds.includes(s.id));
      setBacklog((prev) => prev.filter((s) => !toMoveIds.includes(s.id)));
      setLanes((prev) =>
        prev.map((lane) => ({
          ...lane,
          slots: lane.slots.map((slot) =>
            slot.id === slotId ? { ...slot, stores: [...slot.stores, ...moving] } : slot,
          ),
        })),
      );
      setSelectedStoreIds(new Set());
    },
    [backlog, selectedStoreIds],
  );

  const updateLaneVehicle = useCallback((laneId: string, vehicleId: string | null) => {
    setLanes((prev) =>
      prev.map((lane) => {
        if (lane.id !== laneId) return lane;
        return {
          ...lane,
          vehicle_id: vehicleId,
          slots: lane.slots.map((slot) => ({
            ...slot,
            vehicle_id: vehicleId,
          })),
        };
      }),
    );
  }, []);

  const addSlotToLane = useCallback((laneId: string) => {
    setLanes((prev) =>
      prev.map((lane) => {
        if (lane.id !== laneId) return lane;
        const newSlotId = `slot-${laneId}-${lane.slots.length + 1}-${Date.now()}`;
        return {
          ...lane,
          slots: [
            ...lane.slots,
            {
              id: newSlotId,
              stores: [],
              vehicle_id: lane.vehicle_id,
            },
          ],
        };
      }),
    );
  }, []);

  const addLane = useCallback(() => {
    const newLaneId = `lane-${Date.now()}`;
    const newSlotId = `slot-${newLaneId}-1-${Date.now()}`;
    setLanes((prev) => [
      ...prev,
      {
        id: newLaneId,
        vehicle_id: null,
        slots: [{ id: newSlotId, stores: [], vehicle_id: null }],
      },
    ]);
  }, []);

  const handleConfirmPlanning = useCallback(async () => {
    const uid = profile?.id;
    if (!uid) {
      error('ไม่ได้ล็อกอิน');
      return;
    }

    const activeSlotsAll = lanes.flatMap((l) => l.slots).filter((s) => s.stores.length > 0);

    if (activeSlotsAll.length === 0) {
      warning('กรุณาวางอย่างน้อย 1 ทริปก่อนยืนยัน');
      return;
    }

    const missingVehicleSlots = activeSlotsAll.filter((s) => !s.vehicle_id);
    if (missingVehicleSlots.length > 0) {
      error('กรุณาเลือกรถทุกคอลัมน์ที่มีการวางคิว (หรือลากกลับคิว)');
      return;
    }

    setSaving(true);
    try {
      const plannedDate = new Date().toISOString().split('T')[0];
      let successCount = 0;

      const slotsOrdered = [...activeSlotsAll].sort((a, b) => a.id.localeCompare(b.id));

      for (const slot of slotsOrdered) {
        const vehicle_id = slot.vehicle_id!;
        const storesPayload = slot.stores.map((s, idx) => ({
          store_id: s.store_id,
          sequence_order: idx + 1,
          items: mergeOrderItemsAcrossOrders(s.orders).map((m) => ({
            product_id: m.product_id,
            quantity: m.quantity,
            unit: m.unit != null && String(m.unit).trim() !== '' ? String(m.unit).trim() : null,
            is_bonus: m.is_bonus,
            quantity_picked_up_at_store: 0 as number,
          })),
        }));

        const created = await deliveryTripService.create({
          vehicle_id,
          planned_date: plannedDate,
          notes: 'จัดทริปจากบอร์ดจัดคิว',
          stores: storesPayload,
        });

        const orderIds = [...new Set(slot.stores.flatMap((st) => st.orders.map((o: any) => o?.id)).filter(Boolean))];

        if (orderIds.length > 0) {
          await ordersService.assignToTrip(orderIds, created.id, uid);
        }

        successCount++;
      }

      success(`สร้างและผูกออเดอร์แล้ว ${successCount} ทริป`);
      await fetchData();
    } catch (e: any) {
      console.error('[useTripPlanningBoard] confirm:', e);
      error(e?.message || 'เกิดข้อผิดพลาดในการสร้างทริป');
    } finally {
      setSaving(false);
    }
  }, [lanes, profile?.id, error, warning, success, fetchData]);

  return {
    orderScope,
    featureLoading,
    canUseBoard,
    pendingFilters,
    loading,
    saving,
    setSaving,
    backlog,
    vehicles,
    lanes,
    setLanes,
    fetchData,
    activeId,
    activeStore,
    searchQuery,
    setSearchQuery,
    filteredBacklog,
    selectedStoreIds,
    toggleSelectStore,
    clearSelection,
    moveSelectedToSlot,
    toasts: toastApi.toasts,
    dismissToast: toastApi.dismissToast,
    sensors,
    dropAnimationConfig,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    updateLaneVehicle,
    addSlotToLane,
    addLane,
    findContainer,
    handleConfirmPlanning,
  };
}
