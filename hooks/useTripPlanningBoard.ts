import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
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
import { profileService } from '../services/profileService';
import { tripMetricsService } from '../services/tripMetricsService';
import { supabase } from '../lib/supabase';
import { getAreaGroupKey, getDistrictKey } from '../utils/parseThaiAddress';
import { orderQueryFiltersForUiBranch, normalizeProfileBranch } from '../utils/orderUserScope';
import {
  BRANCH_ALL_VALUE,
  BRANCH_ALL_LABEL,
  BRANCH_FILTER_OPTIONS,
  getBranchLabel,
} from '../utils/branchLabels';
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

/** ตรงกับ delivery_trips.service_type + wizard (ลงมือ/ตักลง/ค่าเริ่มต้นระบบ) */
export type PlanningTripServiceType = 'standard' | 'carry_in' | 'lift_off';

export interface PlanningSlot {
  id: string;
  stores: PlanningStore[];
  vehicle_id: string | null;
  /** profiles.id เหมือน wizard — ว่างเมื่อไม่เลือก (บันทึกแล้ว backend ใช้ผู้ใช้ปัจจุบัน) */
  driver_id?: string | null;
  service_type?: PlanningTripServiceType;
  /** ซ่อนรายการร้านในเที่ยวนี้เพื่อดูหลายเที่ยวได้สะดวก */
  stores_collapsed?: boolean;
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
        driver_id: null,
        service_type: 'carry_in',
        stores_collapsed: false,
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

/** ห้ามโหลดออเดอร์เมื่อ filters เป็น branchesIn ว่าง (กำลังโหลด scope / ไม่มีสาขาอนุญาต) */
function ordersFiltersBlockFetch(filters: { branch?: string; branchesIn?: string[] } | undefined): boolean {
  return filters?.branchesIn !== undefined && filters.branchesIn.length === 0;
}

function filterVehiclesForBoard(
  vehicles: any[],
  scope: { loading: boolean; unrestricted: boolean; allowedBranches: string[] },
  uiBranch: string,
): any[] {
  if (scope.loading) return vehicles;
  let list = vehicles;
  if (!scope.unrestricted && scope.allowedBranches?.length) {
    const allowed = new Set(scope.allowedBranches);
    list = list.filter((v: any) => !v.branch || allowed.has(String(v.branch)));
  }
  if (uiBranch && uiBranch !== BRANCH_ALL_VALUE) {
    list = list.filter((v: any) => !v.branch || String(v.branch) === uiBranch);
  }
  return list;
}

/** กรองโปรไฟล์คนขับให้สอดคล้องสาขารถ/ออเดอร์บนบอร์ด */
function filterDriversForBoard(
  drivers: Array<{ id: string; full_name: string; branch?: string | null }>,
  scope: { loading: boolean; unrestricted: boolean; allowedBranches: string[] },
  uiBranch: string,
): Array<{ id: string; full_name: string; branch?: string | null }> {
  if (scope.loading) return drivers;
  let list = drivers;
  if (!scope.unrestricted && scope.allowedBranches?.length) {
    const allowed = new Set(scope.allowedBranches);
    list = list.filter((d) => !d.branch || allowed.has(String(d.branch)));
  }
  if (uiBranch && uiBranch !== BRANCH_ALL_VALUE) {
    list = list.filter((d) => !d.branch || String(d.branch) === uiBranch);
  }
  return list;
}

export function useTripPlanningBoard() {
  const { profile } = useAuth();
  const toastApi = useToast();
  const { success, error, warning } = toastApi;
  const orderScope = useOrderBranchScope();
  const { can, loading: featureLoading } = useFeatureAccess();

  const canUseBoard = can('tab.trip_planning_board', 'view');

  const [branchFilter, setBranchFilter] = useState<string>(BRANCH_ALL_VALUE);
  /** กำหนดสาขาเริ่มต้นจากโปรไฟล์/สโคปก่อน fetch ครั้งแรก — กัน admin ที่โปรไฟล์สาขา SD แต่โหลดคิวรวมทุกสาขา */
  const [branchScopeReady, setBranchScopeReady] = useState(false);
  const branchBootstrapOnceRef = useRef(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [backlog, setBacklog] = useState<PlanningStore[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<Array<{ id: string; full_name: string; branch?: string | null }>>([]);
  const [lanes, setLanes] = useState<PlanningLane[]>(() => createEmptyLanes(INITIAL_TRIP_PLANNING_LANE_COUNT, Date.now()));
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeStore, setActiveStore] = useState<PlanningStore | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStoreIds, setSelectedStoreIds] = useState<Set<string>>(() => new Set());

  const ordersFetchFilters = useMemo(() => {
    if (featureLoading || !canUseBoard || orderScope.loading || !branchScopeReady) {
      return { branchesIn: [] as string[] };
    }
    return orderQueryFiltersForUiBranch(orderScope, branchFilter, BRANCH_ALL_VALUE);
  }, [featureLoading, canUseBoard, orderScope, branchFilter, branchScopeReady]);

  const boardBranchOptions = useMemo(() => {
    if (orderScope.loading) {
      return [{ value: BRANCH_ALL_VALUE, label: BRANCH_ALL_LABEL }];
    }
    if (orderScope.unrestricted) {
      return BRANCH_FILTER_OPTIONS;
    }
    const allowed = orderScope.allowedBranches;
    if (allowed.length === 0) {
      return [{ value: BRANCH_ALL_VALUE, label: BRANCH_ALL_LABEL }];
    }
    const opts = allowed.map((b) => ({ value: b, label: getBranchLabel(b) }));
    if (allowed.length === 1) return opts;
    return [{ value: BRANCH_ALL_VALUE, label: 'ทุกสาขา (ที่อนุญาต)' }, ...opts];
  }, [orderScope]);

  const boardBranchSelectDisabled = orderScope.loading || (!orderScope.unrestricted && orderScope.allowedBranches.length <= 1);

  useLayoutEffect(() => {
    if (branchBootstrapOnceRef.current) return;
    if (featureLoading || !canUseBoard || orderScope.loading) return;

    if (!orderScope.unrestricted) {
      const allowed = orderScope.allowedBranches;
      if (allowed.length === 1) {
        setBranchFilter(allowed[0]!);
      }
      branchBootstrapOnceRef.current = true;
      setBranchScopeReady(true);
      return;
    }

    if (!profile) return;
    setBranchFilter(normalizeProfileBranch(profile.branch));
    branchBootstrapOnceRef.current = true;
    setBranchScopeReady(true);
  }, [
    featureLoading,
    canUseBoard,
    orderScope.loading,
    orderScope.unrestricted,
    orderScope.allowedBranches,
    profile,
  ]);

  useEffect(() => {
    if (!orderScope || orderScope.loading || orderScope.unrestricted) return;
    const allowed = orderScope.allowedBranches;
    if (allowed.length > 1 && branchFilter !== BRANCH_ALL_VALUE && !allowed.includes(branchFilter)) {
      setBranchFilter(BRANCH_ALL_VALUE);
    }
  }, [orderScope, branchFilter]);

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
      const block = ordersFiltersBlockFetch(ordersFetchFilters);

      const [pendingOrders, vehListRaw, allProfiles] = await Promise.all([
        block ? Promise.resolve([] as any[]) : ordersService.getPendingOrders(ordersFetchFilters),
        vehicleService.getAll(),
        profileService.getAll().catch(() => [] as any[]),
      ]);

      let vehList = filterVehiclesForBoard(vehListRaw, orderScope, branchFilter);

      const driverCandidates = ((allProfiles as any[]) ?? [])
        .filter((p: any) => p.role === 'driver')
        .map((p: any) => ({
          id: p.id as string,
          full_name: String(p.full_name ?? '').trim() || '—',
          branch: (p.branch as string | null) ?? null,
        }));
      const driverList = filterDriversForBoard(driverCandidates, orderScope, branchFilter);

      const finalBacklog = await mapPendingOrdersToStores(pendingOrders);

      setBacklog(finalBacklog);
      setVehicles(vehList);
      setDrivers(driverList);
      setSelectedStoreIds(new Set());
      setLanes(createEmptyLanes(INITIAL_TRIP_PLANNING_LANE_COUNT, Date.now()));
    } catch (e) {
      console.error('[useTripPlanningBoard] fetch failed', e);
      throw e;
    } finally {
      setLoading(false);
    }
  }, [ordersFetchFilters, orderScope, branchFilter]);

  useEffect(() => {
    if (!branchScopeReady) return;
    if (!featureLoading && canUseBoard && !orderScope.loading && !ordersFiltersBlockFetch(ordersFetchFilters)) {
      void fetchData();
    }
    if (
      ordersFiltersBlockFetch(ordersFetchFilters) &&
      !orderScope.loading &&
      !featureLoading &&
      canUseBoard
    ) {
      setLoading(false);
      setBacklog([]);
      setVehicles([]);
      setDrivers([]);
    }
  }, [featureLoading, canUseBoard, orderScope.loading, ordersFetchFilters, fetchData, branchScopeReady]);

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
              driver_id: null,
              service_type: 'carry_in' as PlanningTripServiceType,
              stores_collapsed: false,
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
        slots: [
          {
            id: newSlotId,
            stores: [],
            vehicle_id: null,
            driver_id: null,
            service_type: 'carry_in' as PlanningTripServiceType,
            stores_collapsed: false,
          },
        ],
      },
    ]);
  }, []);

  const updateSlotDriver = useCallback((laneId: string, slotId: string, driverId: string | null) => {
    setLanes((prev) =>
      prev.map((lane) =>
        lane.id !== laneId
          ? lane
          : {
              ...lane,
              slots: lane.slots.map((slot) =>
                slot.id === slotId ? { ...slot, driver_id: driverId } : slot,
              ),
            },
      ),
    );
  }, []);

  const updateSlotServiceType = useCallback((laneId: string, slotId: string, st: PlanningTripServiceType) => {
    setLanes((prev) =>
      prev.map((lane) =>
        lane.id !== laneId
          ? lane
          : {
              ...lane,
              slots: lane.slots.map((slot) =>
                slot.id === slotId ? { ...slot, service_type: st } : slot,
              ),
            },
      ),
    );
  }, []);

  const toggleSlotStoresCollapsed = useCallback((slotId: string) => {
    setLanes((prev) =>
      prev.map((lane) => ({
        ...lane,
        slots: lane.slots.map((slot) =>
          slot.id === slotId ? { ...slot, stores_collapsed: !slot.stores_collapsed } : slot,
        ),
      })),
    );
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
          service_type: slot.service_type ?? 'carry_in',
          ...(slot.driver_id ? { driver_id: slot.driver_id } : {}),
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
    loading,
    saving,
    setSaving,
    branchFilter,
    setBranchFilter,
    boardBranchOptions,
    boardBranchSelectDisabled,
    backlog,
    vehicles,
    drivers,
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
    updateSlotDriver,
    updateSlotServiceType,
    toggleSlotStoresCollapsed,
    findContainer,
    handleConfirmPlanning,
  };
}
