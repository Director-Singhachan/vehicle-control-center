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
import {
  getAreaGroupKey,
  getDistrictKey,
  getSubDistrictKey,
  THAI_LOCATION_PAIR_SEP,
} from '../utils/parseThaiAddress';
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

/** บรรทัดสินค้าหลังรวมบิลต่อร้าน — ใช้แสดงสรุปในเที่ยว */
export interface PlanningLineItem {
  product_id: string;
  product_name: string;
  quantity: number;
  unit: string | null;
  is_bonus: boolean;
}

export interface PlanningStore {
  id: string;
  store_id: string;
  customer_code: string;
  customer_name: string;
  address: string | null;
  orders: any[];
  /** รวมยอดคงค้างส่งต่อบิลของร้านนี้ (มีชื่อสินค้าจาก products) */
  line_items: PlanningLineItem[];
  total_pallets: number;
  total_weight_kg: number;
  areaKey: string;
  districtKey: string;
  /** ตำบล / แขวง สำหรับกรองและจัดกลุ่ม */
  subDistrictKey: string;
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

function buildPlanningLineItems(
  orders: any[],
  productMap: Map<string, { product_name?: string | null; weight_kg?: number | null }>,
): PlanningLineItem[] {
  const merged = mergeOrderItemsAcrossOrders(orders);
  return merged
    .map((m) => ({
      product_id: m.product_id,
      product_name: String(productMap.get(m.product_id)?.product_name ?? 'สินค้า').trim(),
      quantity: m.quantity,
      unit: m.unit != null && String(m.unit).trim() !== '' ? String(m.unit).trim() : null,
      is_bonus: m.is_bonus,
    }))
    .sort((a, b) => a.product_name.localeCompare(b.product_name, 'th'));
}

/** ที่อยู่จากแถว orders_with_details / pending — ไม่มี nested store */
function pendingOrderAddress(order: any): string | null {
  const d = order?.delivery_address;
  if (d != null && String(d).trim() !== '') return String(d).trim();
  const s = order?.store_address;
  if (s != null && String(s).trim() !== '') return String(s).trim();
  const nested = order?.store?.address;
  if (nested != null && String(nested).trim() !== '') return String(nested).trim();
  return null;
}

async function mapPendingOrdersToStores(ordersWithItems: any[]): Promise<PlanningStore[]> {
  const storeMap = new Map<string, PlanningStore>();

  for (const order of ordersWithItems) {
    const storeId = order.store_id as string | undefined;
    if (!storeId) continue;

    const addr = pendingOrderAddress(order);
    const areaKey = getAreaGroupKey(addr);
    const districtKey = getDistrictKey(addr);
    const subDistrictKey = getSubDistrictKey(addr);

    if (!storeMap.has(storeId)) {
      storeMap.set(storeId, {
        id: storeId,
        store_id: storeId,
        customer_code: order.customer_code || order.store?.customer_code || '-',
        customer_name: order.customer_name || order.store?.customer_name || '-',
        address: addr,
        orders: [],
        line_items: [],
        total_pallets: 0,
        total_weight_kg: 0,
        areaKey,
        districtKey,
        subDistrictKey,
      });
    } else {
      const st = storeMap.get(storeId)!;
      if (!st.address && addr) {
        st.address = addr;
        st.areaKey = areaKey;
        st.districtKey = districtKey;
        st.subDistrictKey = subDistrictKey;
      }
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
      store.line_items = buildPlanningLineItems(store.orders, productWeightMap);
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

/** คีย์สำหรับเทียบว่า “ขอบเขตการโหลดคิว” เปลี่ยนไหม — ไม่พึ่ง reference ของ object filter */
function stableBoardFetchKey(filters: { branch?: string; branchesIn?: string[] } | undefined): string {
  if (filters == null) return 'all';
  if (filters.branch) return `branch:${filters.branch}`;
  if (filters.branchesIn?.length) return `in:${[...filters.branchesIn].sort().join(',')}`;
  return 'blocked';
}

/** โหลดคิวใหม่โดยไม่ล้างร่าง: รีเฟรชข้อมูลร้านในเลน + คิวซ้าย = pending ที่ยังไม่อยู่ในเลน */
function mergeServerPendingIntoDraft(
  prevLanes: PlanningLane[],
  serverStores: PlanningStore[],
): { lanes: PlanningLane[]; backlog: PlanningStore[] } {
  const serverById = new Map(serverStores.map((s) => [s.store_id, s]));
  const inLaneIds = new Set<string>();

  const nextLanes = prevLanes.map((lane) => ({
    ...lane,
    slots: lane.slots.map((slot) => ({
      ...slot,
      stores: slot.stores.map((store) => {
        inLaneIds.add(store.store_id);
        const fresh = serverById.get(store.store_id);
        return fresh ?? store;
      }),
    })),
  }));

  const backlog = serverStores.filter((s) => !inLaneIds.has(s.store_id));
  return { lanes: nextLanes, backlog };
}

function planningStoreSubDistrictKey(s: PlanningStore): string {
  return s.subDistrictKey ?? getSubDistrictKey(s.address);
}

function storeMatchesBoardLocation(s: PlanningStore, districtFilter: string, subFilter: string): boolean {
  const dKey = s.districtKey;
  const sKey = planningStoreSubDistrictKey(s);
  const allD = districtFilter === '';
  const allS = subFilter === '';
  if (allD && allS) return true;
  if (!allD && allS) return dKey === districtFilter;
  if (!allD && !allS) return dKey === districtFilter && sKey === subFilter;
  if (allD && !allS) {
    const sep = THAI_LOCATION_PAIR_SEP;
    const i = subFilter.indexOf(sep);
    if (i !== -1) {
      const d = subFilter.slice(0, i);
      const t = subFilter.slice(i + sep.length);
      return dKey === d && sKey === t;
    }
    return sKey === subFilter;
  }
  return true;
}

export interface BacklogDistrictSummaryRow {
  districtKey: string;
  count: number;
  pallets: number;
  weightKg: number;
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
  const lanesRef = useRef(lanes);
  useEffect(() => {
    lanesRef.current = lanes;
  }, [lanes]);
  const lastBoardFetchKeyRef = useRef<string | null>(null);
  const fetchCompletedOnceRef = useRef(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeStore, setActiveStore] = useState<PlanningStore | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [boardDistrictFilter, setBoardDistrictFilter] = useState('');
  const [boardSubdistrictFilter, setBoardSubdistrictFilter] = useState('');
  const [selectedStoreIds, setSelectedStoreIds] = useState<Set<string>>(() => new Set());

  const ordersFetchFilters = useMemo(() => {
    if (featureLoading || !canUseBoard || orderScope.loading || !branchScopeReady) {
      return { branchesIn: [] as string[] };
    }
    return orderQueryFiltersForUiBranch(orderScope, branchFilter, BRANCH_ALL_VALUE);
  }, [
    featureLoading,
    canUseBoard,
    orderScope.loading,
    orderScope.unrestricted,
    orderScope.allowedBranches.join(','),
    branchFilter,
    branchScopeReady,
  ]);

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

  const orderScopeRef = useRef(orderScope);
  useEffect(() => {
    orderScopeRef.current = orderScope;
  }, [orderScope]);

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

  const fetchData = useCallback(
    async (options?: { resetDraft?: boolean }) => {
      const resetDraft = options?.resetDraft ?? true;
      const showFullLoading = resetDraft || !fetchCompletedOnceRef.current;
      if (showFullLoading) setLoading(true);

      try {
        const block = ordersFiltersBlockFetch(ordersFetchFilters);

        const [pendingOrders, vehListRaw, allProfiles] = await Promise.all([
          block ? Promise.resolve([] as any[]) : ordersService.getPendingOrders(ordersFetchFilters),
          vehicleService.getAll(),
          profileService.getAll().catch(() => [] as any[]),
        ]);

        let vehList = filterVehiclesForBoard(vehListRaw, orderScopeRef.current, branchFilter);

        const driverCandidates = ((allProfiles as any[]) ?? [])
          .filter((p: any) => p.role === 'driver')
          .map((p: any) => ({
            id: p.id as string,
            full_name: String(p.full_name ?? '').trim() || '—',
            branch: (p.branch as string | null) ?? null,
          }));
        const driverList = filterDriversForBoard(driverCandidates, orderScopeRef.current, branchFilter);

        const finalBacklog = await mapPendingOrdersToStores(pendingOrders);

        setVehicles(vehList);
        setDrivers(driverList);

        if (resetDraft) {
          setBacklog(finalBacklog);
          setSelectedStoreIds(new Set());
          setLanes(createEmptyLanes(INITIAL_TRIP_PLANNING_LANE_COUNT, Date.now()));
        } else {
          const { lanes: mergedLanes, backlog: mergedBacklog } = mergeServerPendingIntoDraft(
            lanesRef.current,
            finalBacklog,
          );
          setLanes(mergedLanes);
          setBacklog(mergedBacklog);
        }
        fetchCompletedOnceRef.current = true;
      } catch (e) {
        console.error('[useTripPlanningBoard] fetch failed', e);
        throw e;
      } finally {
        setLoading(false);
      }
    },
    [ordersFetchFilters, branchFilter],
  );

  useEffect(() => {
    if (!branchScopeReady) return;
    if (!featureLoading && canUseBoard && !orderScope.loading && !ordersFiltersBlockFetch(ordersFetchFilters)) {
      const key = stableBoardFetchKey(ordersFetchFilters);
      const resetDraft = lastBoardFetchKeyRef.current != null && lastBoardFetchKeyRef.current !== key;
      lastBoardFetchKeyRef.current = key;
      void fetchData({ resetDraft });
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

  const backlogDistrictSummary = useMemo(() => {
    const m = new Map<string, { count: number; pallets: number; weightKg: number }>();
    for (const s of backlog) {
      const cur = m.get(s.districtKey) ?? { count: 0, pallets: 0, weightKg: 0 };
      cur.count += 1;
      cur.pallets += s.total_pallets;
      cur.weightKg += s.total_weight_kg;
      m.set(s.districtKey, cur);
    }
    return [...m.entries()]
      .map(([districtKey, agg]) => ({ districtKey, ...agg }))
      .sort((a, b) => a.districtKey.localeCompare(b.districtKey, 'th'));
  }, [backlog]);

  const boardDistrictOptionKeys = useMemo(() => {
    const u = new Set(backlog.map((s) => s.districtKey));
    return [...u].sort((a, b) => a.localeCompare(b, 'th'));
  }, [backlog]);

  const boardSubdistrictSelectOptions = useMemo((): { value: string; label: string }[] => {
    if (boardDistrictFilter) {
      const subs = new Set<string>();
      for (const st of backlog) {
        if (st.districtKey === boardDistrictFilter) subs.add(planningStoreSubDistrictKey(st));
      }
      return [...subs]
        .sort((a, b) => a.localeCompare(b, 'th'))
        .map((sub) => ({ value: sub, label: sub }));
    }
    const seen = new Set<string>();
    const out: { value: string; label: string }[] = [];
    for (const st of backlog) {
      const d = st.districtKey;
      const sub = planningStoreSubDistrictKey(st);
      const value = `${d}${THAI_LOCATION_PAIR_SEP}${sub}`;
      if (seen.has(value)) continue;
      seen.add(value);
      out.push({
        value,
        label: `${sub} · ${d}`,
      });
    }
    out.sort((a, b) => a.label.localeCompare(b.label, 'th'));
    return out;
  }, [backlog, boardDistrictFilter]);

  const filteredBacklog = useMemo(() => {
    let list = backlog.filter((s) =>
      storeMatchesBoardLocation(s, boardDistrictFilter, boardSubdistrictFilter),
    );
    if (searchQuery.trim()) {
      const lower = searchQuery.toLowerCase();
      list = list.filter(
        (s) =>
          s.customer_name.toLowerCase().includes(lower) ||
          s.customer_code.toLowerCase().includes(lower) ||
          s.districtKey.toLowerCase().includes(lower) ||
          planningStoreSubDistrictKey(s).toLowerCase().includes(lower) ||
          s.areaKey.toLowerCase().includes(lower),
      );
    }
    return list;
  }, [backlog, searchQuery, boardDistrictFilter, boardSubdistrictFilter]);

  const onBoardDistrictFilterChange = useCallback((value: string) => {
    setBoardDistrictFilter(value);
    setBoardSubdistrictFilter('');
  }, []);

  const selectAllFilteredInBacklog = useCallback(() => {
    setSelectedStoreIds(new Set(filteredBacklog.map((s) => s.id)));
  }, [filteredBacklog]);

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
      await fetchData({ resetDraft: true });
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
    boardDistrictFilter,
    boardSubdistrictFilter,
    setBoardSubdistrictFilter,
    onBoardDistrictFilterChange,
    backlogDistrictSummary,
    boardDistrictOptionKeys,
    boardSubdistrictSelectOptions,
    selectAllFilteredInBacklog,
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
