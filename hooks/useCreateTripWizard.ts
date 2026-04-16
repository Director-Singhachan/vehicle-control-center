import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { profileService } from '../services/profileService';
import { deliveryTripService } from '../services/deliveryTripService';
import { ordersService, orderItemsService } from '../services/ordersService';
import { calculateTripCapacity } from '../utils/tripCapacityValidation';
import { calculatePalletAllocation, type PalletPackingResult } from '../utils/palletPacking';
import { useVehicleRecommendation } from './useVehicleRecommendation';
import { vehicleRecommendationService, hashRecommendationInput } from '../services/vehicleRecommendationService';
import type { RecommendationInput } from '../services/vehicleRecommendationService';
import { tripMetricsService } from '../services/tripMetricsService';
import { useAuth } from './useAuth';
import { useToast } from './useToast';
import { useVehicles } from './useVehicles';
import { useDeliveryTrips } from './useDeliveryTrips';
import type { StoreDelivery, ItemSplitQty, CapacitySummary, SplitMode, TripSlot, MultiTripItemQty } from '../types/createTripWizard';
import { splitKey, createTripSlot } from '../types/createTripWizard';

export interface UseCreateTripWizardParams {
  selectedOrders: any[];
  onSuccess: () => void;
}

export function useCreateTripWizard({ selectedOrders, onSuccess }: UseCreateTripWizardParams) {
  const { user } = useAuth();
  const { vehicles, loading: vehiclesLoading } = useVehicles();
  const { success, error, warning } = useToast();

  const [currentStep] = useState(1); // Reserved for future wizard UI (1=order, 2=vehicle, 3=crew, 4=confirm)
  const [drivers, setDrivers] = useState<Array<{ id: string; full_name: string; branch?: string | null }>>([]);
  const [driversLoading, setDriversLoading] = useState(false);
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [selectedDriverId, setSelectedDriverId] = useState('');
  const [tripDate, setTripDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderItemsMap, setOrderItemsMap] = useState<Map<string, any[]>>(new Map());
  const [skipStockDeduction, setSkipStockDeduction] = useState(true);

  const [splitMode, setSplitMode] = useState<SplitMode>('single');
  const splitIntoTwoTrips = splitMode === '2vehicles';
  const splitIntoThreeTrips = splitMode === '3trips';
  const [selectedVehicleId2, setSelectedVehicleId2] = useState('');
  const [selectedDriverId2, setSelectedDriverId2] = useState('');
  const [selectedVehicleId3, setSelectedVehicleId3] = useState('');
  const [selectedDriverId3, setSelectedDriverId3] = useState('');
  const [itemSplitMap, setItemSplitMap] = useState<Record<string, ItemSplitQty>>({});
  const [quantityInThisTripMap, setQuantityInThisTripMap] = useState<Record<string, number>>({});
  const [expandedStores, setExpandedStores] = useState<Set<string>>(new Set());

  const [selectedBranch, setSelectedBranch] = useState('');
  const [vehicleSearch, setVehicleSearch] = useState('');

  const [capacitySummary, setCapacitySummary] = useState<CapacitySummary | null>(null);
  const [capacitySummary2, setCapacitySummary2] = useState<CapacitySummary | null>(null);
  const [capacitySummary3, setCapacitySummary3] = useState<CapacitySummary | null>(null);
  const [palletPackingResult, setPalletPackingResult] = useState<PalletPackingResult | null>(null);
  const [palletPackingResult2, setPalletPackingResult2] = useState<PalletPackingResult | null>(null);
  const [palletPackingResult3, setPalletPackingResult3] = useState<PalletPackingResult | null>(null);

  const [storeDeliveries, setStoreDeliveries] = useState<StoreDelivery[]>(() =>
    selectedOrders.map((order, index) => ({
      id: `${order.id}-${index}`,
      order_id: order.id,
      store_id: order.store_id,
      store_name: order.customer_name,
      store_code: order.customer_code,
      address: order.delivery_address || order.store_address || '',
      latitude: order.delivery_latitude,
      longitude: order.delivery_longitude,
      order_number: order.order_number,
      total_amount: order.total_amount,
      sequence: index + 1,
      delivery_date: order.delivery_date || null,
    }))
  );

  useEffect(() => {
    const fetchDrivers = async () => {
      try {
        setDriversLoading(true);
        const profiles = await profileService.getAll();
        const driverProfiles = profiles.filter((p: any) => p.role === 'driver');
        setDrivers(
          driverProfiles.map((p: any) => ({
            id: p.id,
            full_name: p.full_name || '',
            branch: (p.branch as string | null) ?? null,
          }))
        );
      } catch (err) {
        console.error('Error fetching drivers:', err);
        setDrivers([]);
      } finally {
        setDriversLoading(false);
      }
    };
    fetchDrivers();
  }, []);

  useEffect(() => {
    const fetchOrderItems = async () => {
      const itemsMap = new Map<string, any[]>();
      for (const order of selectedOrders) {
        try {
          const items = await orderItemsService.getByOrderId(order.id);
          // เฉพาะ fulfillment_method = 'delivery' เท่านั้น (pickup = ลูกค้ามารับเอง ไม่ต้องจัดทริป)
          const deliveryItems = (items || []).filter(
            (i: any) => (i.fulfillment_method ?? 'delivery') !== 'pickup'
          );
          itemsMap.set(order.id, deliveryItems);
        } catch (err) {
          console.error(`Failed to fetch items for order ${order.id}:`, err);
          itemsMap.set(order.id, []);
        }
      }
      setOrderItemsMap(itemsMap);
    };
    fetchOrderItems();
  }, [selectedOrders]);

  const getRemaining = useCallback((item: any) => Math.max(0,
    Number(item.quantity)
    - Number(item.quantity_picked_up_at_store ?? 0)
    - Number(item.quantity_delivered ?? 0)
  ), []);

  useEffect(() => {
    if (splitMode === 'single') return;
    const newMap: Record<string, ItemSplitQty> = {};
    for (const delivery of storeDeliveries) {
      const items = orderItemsMap.get(delivery.order_id) || [];
      for (const item of items) {
        const remaining = Math.max(0,
          Number(item.quantity)
          - Number(item.quantity_picked_up_at_store ?? 0)
          - Number(item.quantity_delivered ?? 0)
        );
        if (remaining <= 0) continue;
        const key = splitKey(delivery.order_id, item.id);
        if (!itemSplitMap[key]) {
          if (splitMode === '2vehicles') {
            newMap[key] = { vehicle1Qty: remaining, vehicle2Qty: 0 };
          } else {
            newMap[key] = { vehicle1Qty: 0, vehicle2Qty: 0, trip1Qty: remaining, trip2Qty: 0, trip3Qty: 0 };
          }
        } else {
          newMap[key] = itemSplitMap[key];
        }
      }
    }
    if (Object.keys(newMap).length > 0) {
      setItemSplitMap(prev => ({ ...prev, ...newMap }));
    }
  }, [splitMode, storeDeliveries, orderItemsMap]);

  const handleSplitQtyChange = useCallback((orderId: string, itemId: string, target: 1 | 2 | 3, value: number, totalQty: number) => {
    const key = splitKey(orderId, itemId);
    const clamped = Math.max(0, Math.min(totalQty, value));
    setItemSplitMap(prev => {
      const cur = prev[key] || { vehicle1Qty: 0, vehicle2Qty: 0, trip1Qty: 0, trip2Qty: 0, trip3Qty: 0 };
      if (splitMode === '2vehicles') {
        return {
          ...prev,
          [key]: target === 1
            ? { ...cur, vehicle1Qty: clamped, vehicle2Qty: totalQty - clamped }
            : { ...cur, vehicle1Qty: totalQty - clamped, vehicle2Qty: clamped },
        };
      }
      const rest = totalQty - clamped;
      const half = Math.floor(rest / 2);
      if (target === 1) {
        return { ...prev, [key]: { ...cur, trip1Qty: clamped, trip2Qty: half, trip3Qty: rest - half } };
      }
      if (target === 2) {
        return { ...prev, [key]: { ...cur, trip1Qty: half, trip2Qty: clamped, trip3Qty: rest - half } };
      }
      return { ...prev, [key]: { ...cur, trip1Qty: half, trip2Qty: rest - half, trip3Qty: clamped } };
    });
  }, [splitMode]);

  const getItemsForVehicle = useCallback((tripNum: 1 | 2 | 3) => {
    const items: Array<{ product_id: string; quantity: number }> = [];
    for (const delivery of storeDeliveries) {
      const orderItems = orderItemsMap.get(delivery.order_id) || [];
      for (const item of orderItems) {
        const remaining = Math.max(0,
          Number(item.quantity)
          - Number(item.quantity_picked_up_at_store ?? 0)
          - Number(item.quantity_delivered ?? 0)
        );
        const key = splitKey(delivery.order_id, item.id);
        const split = itemSplitMap[key];
        let qty = 0;
        if (splitMode === '3trips') {
          qty = tripNum === 1 ? (split?.trip1Qty ?? remaining) : tripNum === 2 ? (split?.trip2Qty ?? 0) : (split?.trip3Qty ?? 0);
        } else {
          qty = split ? (tripNum === 1 ? split.vehicle1Qty : split.vehicle2Qty) : (tripNum === 1 ? remaining : 0);
        }
        if (qty > 0) items.push({ product_id: item.product_id, quantity: qty });
      }
    }
    return items;
  }, [storeDeliveries, orderItemsMap, itemSplitMap, splitMode]);

  const getCapacityBlockingErrors = useCallback((
    summary: CapacitySummary | null,
    packingResult: PalletPackingResult | null
  ) => {
    if (!summary) return [];

    const displayPallets = packingResult?.totalPallets ?? summary.totalPallets;
    const nonPalletErrors = summary.errors.filter((msg) => !msg.startsWith('จำนวนพาเลท'));
    const recalculatedErrors = [...nonPalletErrors];

    if (summary.vehicleMaxPallets !== null && displayPallets > summary.vehicleMaxPallets) {
      recalculatedErrors.push(`จำนวนพาเลทเกินความจุ: ${displayPallets} พาเลท (สูงสุด ${summary.vehicleMaxPallets} พาเลท)`);
    }

    return recalculatedErrors;
  }, []);

  const splitValidationErrors = useMemo(() => {
    if (splitMode === 'single') return [];
    const errors: string[] = [];
    for (const delivery of storeDeliveries) {
      const items = orderItemsMap.get(delivery.order_id) || [];
      for (const item of items) {
        const remaining = Math.max(0,
          Number(item.quantity)
          - Number(item.quantity_picked_up_at_store ?? 0)
          - Number(item.quantity_delivered ?? 0)
        );
        if (remaining <= 0) continue;
        const key = splitKey(delivery.order_id, item.id);
        const split = itemSplitMap[key];
        if (split) {
          const sum = splitMode === '2vehicles'
            ? split.vehicle1Qty + split.vehicle2Qty
            : (split.trip1Qty ?? 0) + (split.trip2Qty ?? 0) + (split.trip3Qty ?? 0);
          if (Math.abs(sum - remaining) > 0.001) {
            errors.push(`${delivery.store_name} - ${item.product?.product_name || item.product_name || item.product_id}: จำนวนรวม ${sum} ≠ คงเหลือ ${remaining}`);
          }
        }
      }
    }
    return errors;
  }, [splitMode, storeDeliveries, orderItemsMap, itemSplitMap]);

  useEffect(() => {
    if (!selectedVehicleId || storeDeliveries.length === 0) {
      setCapacitySummary(null);
      setCapacitySummary2(null);
      setCapacitySummary3(null);
      setPalletPackingResult(null);
      setPalletPackingResult2(null);
      setPalletPackingResult3(null);
      return;
    }
    const items1 = (splitIntoTwoTrips || splitIntoThreeTrips) ? getItemsForVehicle(1) : (() => {
      const all: Array<{ product_id: string; quantity: number }> = [];
      for (const d of storeDeliveries) {
        for (const item of (orderItemsMap.get(d.order_id) || [])) {
          const remaining = getRemaining(item);
          const qty = quantityInThisTripMap[splitKey(d.order_id, item.id)] ?? remaining;
          const v = Math.max(0, Math.min(remaining, qty));
          if (v > 0) all.push({ product_id: item.product_id, quantity: v });
        }
      }
      return all;
    })();
    if (items1.length === 0 && !splitIntoTwoTrips && !splitIntoThreeTrips) {
      setCapacitySummary(null);
      setCapacitySummary2(null);
      setCapacitySummary3(null);
      setPalletPackingResult(null);
      setPalletPackingResult2(null);
      setPalletPackingResult3(null);
      return;
    }
    setCapacitySummary(prev => ({ ...prev, loading: true, errors: [], warnings: [] } as CapacitySummary));
    const timeoutId = setTimeout(() => {
      const updatePalletPacking = (
        items: Array<{ product_id: string; quantity: number }>,
        setter: React.Dispatch<React.SetStateAction<PalletPackingResult | null>>
      ) => {
        if (items.length > 0) {
          calculatePalletAllocation(items)
            .then((packing) => {
              setter(packing.errors.length === 0 ? packing : null);
            })
            .catch(() => setter(null));
          return;
        }
        setter(null);
      };

      const run1 = items1.length > 0
        ? calculateTripCapacity(items1, selectedVehicleId)
        : Promise.resolve({ summary: { totalPallets: 0, totalWeightKg: 0, totalHeightCm: 0, vehicleMaxPallets: null, vehicleMaxWeightKg: null, vehicleMaxHeightCm: null }, errors: [] as string[], warnings: [] as string[] });
      updatePalletPacking(items1, setPalletPackingResult);
      run1.then(r => {
        setCapacitySummary({ totalPallets: r.summary.totalPallets, totalWeightKg: r.summary.totalWeightKg, totalHeightCm: r.summary.totalHeightCm, vehicleMaxPallets: r.summary.vehicleMaxPallets, vehicleMaxWeightKg: r.summary.vehicleMaxWeightKg, vehicleMaxHeightCm: r.summary.vehicleMaxHeightCm, loading: false, errors: r.errors, warnings: r.warnings });
      }).catch(err => {
        setCapacitySummary(prev => ({ ...prev, loading: false, errors: [err.message || 'ไม่สามารถคำนวณความจุได้'], warnings: [] } as CapacitySummary));
      });
      if ((splitIntoTwoTrips || splitIntoThreeTrips) && selectedVehicleId2) {
        const items2 = getItemsForVehicle(2);
        if (items2.length > 0) {
          setCapacitySummary2(prev => ({ ...prev, loading: true, errors: [], warnings: [] } as CapacitySummary));
          updatePalletPacking(items2, setPalletPackingResult2);
          calculateTripCapacity(items2, selectedVehicleId2).then(r => {
            setCapacitySummary2({ totalPallets: r.summary.totalPallets, totalWeightKg: r.summary.totalWeightKg, totalHeightCm: r.summary.totalHeightCm, vehicleMaxPallets: r.summary.vehicleMaxPallets, vehicleMaxWeightKg: r.summary.vehicleMaxWeightKg, vehicleMaxHeightCm: r.summary.vehicleMaxHeightCm, loading: false, errors: r.errors, warnings: r.warnings });
          }).catch(err => {
            setCapacitySummary2(prev => ({ ...prev, loading: false, errors: [err.message || 'ไม่สามารถคำนวณความจุได้'], warnings: [] } as CapacitySummary));
          });
        } else {
          setCapacitySummary2(null);
          setPalletPackingResult2(null);
        }
      } else {
        setCapacitySummary2(null);
        setPalletPackingResult2(null);
      }
      if (splitIntoThreeTrips && selectedVehicleId3) {
        const items3 = getItemsForVehicle(3);
        if (items3.length > 0) {
          setCapacitySummary3(prev => ({ ...prev, loading: true, errors: [], warnings: [] } as CapacitySummary));
          updatePalletPacking(items3, setPalletPackingResult3);
          calculateTripCapacity(items3, selectedVehicleId3).then(r => {
            setCapacitySummary3({ totalPallets: r.summary.totalPallets, totalWeightKg: r.summary.totalWeightKg, totalHeightCm: r.summary.totalHeightCm, vehicleMaxPallets: r.summary.vehicleMaxPallets, vehicleMaxWeightKg: r.summary.vehicleMaxWeightKg, vehicleMaxHeightCm: r.summary.vehicleMaxHeightCm, loading: false, errors: r.errors, warnings: r.warnings });
          }).catch(err => {
            setCapacitySummary3(prev => ({ ...prev, loading: false, errors: [err.message || 'ไม่สามารถคำนวณความจุได้'], warnings: [] } as CapacitySummary));
          });
        } else {
          setCapacitySummary3(null);
          setPalletPackingResult3(null);
        }
      } else {
        setCapacitySummary3(null);
        setPalletPackingResult3(null);
      }
    }, 500);
    return () => clearTimeout(timeoutId);
  }, [selectedVehicleId, selectedVehicleId2, selectedVehicleId3, storeDeliveries, orderItemsMap, splitIntoTwoTrips, splitIntoThreeTrips, itemSplitMap, quantityInThisTripMap, getItemsForVehicle, getRemaining]);

  const branches = useMemo(() => {
    if (!vehicles || vehicles.length === 0) return [];
    const uniqueBranches = new Set<string>();
    vehicles.forEach((v: any) => { if (v.branch) uniqueBranches.add(v.branch); });
    return Array.from(uniqueBranches).sort();
  }, [vehicles]);

  const filteredVehicles = useMemo(() => {
    if (!vehicles) return [];
    let filtered = vehicles;
    if (selectedBranch) filtered = filtered.filter((v: any) => v.branch === selectedBranch);
    if (vehicleSearch) {
      const search = vehicleSearch.toLowerCase();
      filtered = filtered.filter((v: any) => {
        const plate = (v.plate || '').toLowerCase();
        const make = (v.make || '').toLowerCase();
        const model = (v.model || '').toLowerCase();
        return plate.includes(search) || make.includes(search) || model.includes(search);
      });
    }
    return filtered;
  }, [vehicles, selectedBranch, vehicleSearch]);

  const filteredDrivers = useMemo(() => {
    if (!drivers) return [];
    if (!selectedBranch) return drivers;
    return drivers.filter((d) => d.branch === selectedBranch);
  }, [drivers, selectedBranch]);

  const recommendationInput = useMemo<RecommendationInput | null>(() => {
    if (storeDeliveries.length === 0 || orderItemsMap.size === 0) return null;
    const store_ids = [...new Set(storeDeliveries.map((d) => d.store_id))];
    const items: RecommendationInput['items'] = [];
    for (const delivery of storeDeliveries) {
      const orderItems = orderItemsMap.get(delivery.order_id) || [];
      for (const item of orderItems) {
        items.push({ product_id: item.product_id, quantity: item.quantity, store_id: delivery.store_id });
      }
    }
    if (items.length === 0) return null;
    return { store_ids, items, planned_date: tripDate, branch: selectedBranch || undefined };
  }, [storeDeliveries, orderItemsMap, tripDate, selectedBranch]);

  const {
    recommendations: aiRecommendations,
    loading: aiLoading,
    error: aiError,
    fetch: fetchRecommendations,
    hasFetched: aiHasFetched,
  } = useVehicleRecommendation(recommendationInput);

  // Trips already planned for the same vehicle on the same date (for "เที่ยวที่ 2, 3, ..." hint)
  const { trips: sameVehicleDateTrips1 } = useDeliveryTrips({
    vehicle_id: selectedVehicleId || undefined,
    planned_date_from: tripDate || undefined,
    planned_date_to: tripDate || undefined,
    autoFetch: !!(selectedVehicleId && tripDate),
    pageSize: 20,
  });
  const { trips: sameVehicleDateTrips2 } = useDeliveryTrips({
    vehicle_id: selectedVehicleId2 || undefined,
    planned_date_from: tripDate || undefined,
    planned_date_to: tripDate || undefined,
    autoFetch: !!((splitIntoTwoTrips || splitIntoThreeTrips) && selectedVehicleId2 && tripDate),
    pageSize: 20,
  });
  const { trips: sameVehicleDateTrips3 } = useDeliveryTrips({
    vehicle_id: selectedVehicleId3 || undefined,
    planned_date_from: tripDate || undefined,
    planned_date_to: tripDate || undefined,
    autoFetch: !!(splitIntoThreeTrips && selectedVehicleId3 && tripDate),
    pageSize: 20,
  });

  const nextTripSequence1 = useMemo(() => {
    if (!sameVehicleDateTrips1.length) return 1;
    const max = Math.max(0, ...sameVehicleDateTrips1.map((t: any) => t.sequence_order ?? 0));
    return max + 1;
  }, [sameVehicleDateTrips1]);
  const nextTripSequence2 = useMemo(() => {
    if (!sameVehicleDateTrips2.length) return 1;
    const max = Math.max(0, ...sameVehicleDateTrips2.map((t: any) => t.sequence_order ?? 0));
    return max + 1;
  }, [sameVehicleDateTrips2]);
  const nextTripSequence3 = useMemo(() => {
    if (!sameVehicleDateTrips3.length) return 1;
    const max = Math.max(0, ...sameVehicleDateTrips3.map((t: any) => t.sequence_order ?? 0));
    return max + 1;
  }, [sameVehicleDateTrips3]);

  const [selectedRecommendationVehicleId, setSelectedRecommendationVehicleId] = useState<string | null>(null);
  const [aiExtraResult, setAiExtraResult] = useState<{
    suggested_vehicle_id: string | null;
    reasoning: string | null;
    packing_tips: string | null;
    error?: string;
  } | null>(null);
  const [aiExtraLoading, setAiExtraLoading] = useState(false);
  const [aiCooldownRemaining, setAiCooldownRemaining] = useState(0);
  const AI_COOLDOWN_SECONDS = 60;

  const handleAiSelectVehicle = useCallback((vehicleId: string) => {
    setSelectedVehicleId(vehicleId);
    setSelectedRecommendationVehicleId(vehicleId);
  }, []);

  const handleRequestAI = useCallback(async () => {
    const input = recommendationInput;
    if (!input || input.items.length === 0 || aiRecommendations.length === 0 || aiCooldownRemaining > 0) return;
    setAiExtraLoading(true);
    setAiExtraResult(null);
    try {
      const first = aiRecommendations[0];
      const tripItems = input.items.map(({ product_id, quantity }) => ({ product_id, quantity }));
      let estimated_pallets: number | undefined;
      let pallet_allocation: typeof undefined | Array<{ pallet_index: number; items: Array<{ product_id: string; product_name?: string | null; product_code?: string | null; quantity: number; weight_kg: number; volume_liter: number }>; total_weight_kg?: number; total_volume_liter?: number }> = undefined;
      let historical_context: string | undefined;
      const targetVehicleId = selectedVehicleId || first.vehicle_id;

      try {
        const rawProductIds: string[] = input.items.map((i: any) => i.product_id as string);
        const productIds = Array.from(new Set<string>(rawProductIds));
        const similarTrips = await tripMetricsService.getSimilarTripsForLoad({
          totalWeightKg: first.capacity_info.estimated_weight_kg,
          totalVolumeLiter: first.capacity_info.estimated_volume_liter,
          storeIds: input.store_ids,
          productIds,
          vehicleId: targetVehicleId,
          limit: 10,
        });
        const ctx = await tripMetricsService.buildSimilarTripsContext(similarTrips);
        if (ctx.trim().length > 0) historical_context = ctx;
      } catch (err) {
        console.warn('[useCreateTripWizard] getSimilarTripsForLoad error:', err);
      }

      let packing_patterns: string | undefined;
      try {
        const patterns = await tripMetricsService.getPackingPatternInsights();
        if (patterns.trim().length > 0) packing_patterns = patterns;
      } catch (err) {
        console.warn('[useCreateTripWizard] getPackingPatternInsights error:', err);
      }

      let product_packing_profiles: string | undefined;
      try {
        const rawProductIds: string[] = input.items.map((i: any) => i.product_id as string);
        const uniqueProductIds = Array.from(new Set<string>(rawProductIds));
        const profiles = await tripMetricsService.getProductPackingProfiles(uniqueProductIds, targetVehicleId);
        if (profiles.trim().length > 0) product_packing_profiles = profiles;
      } catch (err) {
        console.warn('[useCreateTripWizard] getProductPackingProfiles error:', err);
      }

      let computed_packing_plan: string | undefined;
      try {
        const planItems: Array<{ product_id: string; product_name: string; quantity: number; weight_kg: number }> = [];
        if (pallet_allocation && pallet_allocation.length > 0) {
          const merged = new Map<string, { product_id: string; product_name: string; quantity: number; weight_kg: number }>();
          for (const p of pallet_allocation) {
            for (const item of p.items) {
              const existing = merged.get(item.product_id);
              if (existing) {
                existing.quantity += item.quantity;
                existing.weight_kg += item.weight_kg;
              } else {
                merged.set(item.product_id, {
                  product_id: item.product_id,
                  product_name: item.product_name || item.product_code || item.product_id,
                  quantity: item.quantity,
                  weight_kg: item.weight_kg,
                });
              }
            }
          }
          planItems.push(...merged.values());
        }
        if (planItems.length > 0) {
          const plan = await tripMetricsService.computePackingPlan({
            items: planItems,
            vehicleMaxPallets: capacitySummary?.vehicleMaxPallets ?? null,
          });
          if (plan.trim().length > 0) computed_packing_plan = plan;
        }
      } catch (err) {
        console.warn('[useCreateTripWizard] computePackingPlan error:', err);
      }
      try {
        const packing = await calculatePalletAllocation(tripItems);
        if (packing.errors.length === 0) {
          estimated_pallets = packing.totalPallets;
          pallet_allocation = packing.palletAllocations.map((p) => ({
            pallet_index: p.pallet_index,
            items: p.items.map((i) => ({
              product_id: i.product_id,
              product_name: i.product_name,
              product_code: i.product_code,
              quantity: i.quantity,
              weight_kg: i.weight_kg,
              volume_liter: i.volume_liter,
            })),
            total_weight_kg: p.total_weight_kg,
            total_volume_liter: p.total_volume_liter,
          }));
        }
      } catch {
        try {
          const cap = await calculateTripCapacity(tripItems, targetVehicleId);
          estimated_pallets = cap.summary.totalPallets;
        } catch {
          /* skip */
        }
      }

      let items_summary = `${input.items.length} รายการสินค้า`;
      if (pallet_allocation && pallet_allocation.length > 0) {
        const productSummaries = new Map<string, { name: string; qty: number }>();
        for (const p of pallet_allocation) {
          for (const item of p.items) {
            const key = item.product_id;
            const existing = productSummaries.get(key);
            if (existing) {
              existing.qty += item.quantity;
            } else {
              productSummaries.set(key, {
                name: item.product_name || item.product_code || item.product_id,
                qty: item.quantity,
              });
            }
          }
        }
        const summaryLines = Array.from(productSummaries.values())
          .map(({ name, qty }) => `${name} (${qty} หน่วย)`)
          .join(', ');
        if (summaryLines) items_summary = summaryLines;
      }

      const selectedVehicleObj = vehicles.find((v: any) => v.id === targetVehicleId);
      const selectedPlate = selectedVehicleObj?.plate || 'ไม่ระบุ';
      const trip = {
        estimated_weight_kg: first.capacity_info.estimated_weight_kg,
        estimated_volume_liter: first.capacity_info.estimated_volume_liter,
        store_count: input.store_ids.length,
        item_count: input.items.length,
        items_summary,
        planned_date: input.planned_date,
        selected_vehicle_plate: selectedPlate,
        vehicle_max_pallets: capacitySummary?.vehicleMaxPallets ?? null,
        ...(estimated_pallets != null && { estimated_pallets }),
        ...(pallet_allocation != null && pallet_allocation.length > 0 && { pallet_allocation }),
      };
      const vehiclesList = aiRecommendations.slice(0, 5).map((r: any) => ({
        vehicle_id: r.vehicle_id,
        plate: r.vehicle_plate,
        max_weight_kg: r.capacity_info.max_weight_kg,
        cargo_volume_liter: r.capacity_info.max_volume_liter,
        branch: null as string | null,
      }));
      const result = await vehicleRecommendationService.getAIRecommendation({
        trip,
        vehicles: vehiclesList,
        historical_context,
        packing_patterns,
        product_packing_profiles,
        computed_packing_plan,
      });
      setAiExtraResult(result ?? null);
      if (result?.suggested_vehicle_id) {
        setSelectedVehicleId(result.suggested_vehicle_id);
        setSelectedRecommendationVehicleId(result.suggested_vehicle_id);
      }
      setAiCooldownRemaining(AI_COOLDOWN_SECONDS);
    } catch (err) {
      console.warn('[useCreateTripWizard] getAIRecommendation error:', err);
      setAiCooldownRemaining(AI_COOLDOWN_SECONDS);
    } finally {
      setAiExtraLoading(false);
    }
  }, [recommendationInput, aiRecommendations, selectedVehicleId, vehicles, capacitySummary?.vehicleMaxPallets]);

  useEffect(() => {
    if (aiCooldownRemaining <= 0) return;
    const t = setInterval(() => setAiCooldownRemaining((prev) => Math.max(0, prev - 1)), 1000);
    return () => clearInterval(t);
  }, [aiCooldownRemaining]);

  useEffect(() => {
    setAiExtraResult(null);
  }, [aiRecommendations.length, aiRecommendations[0]?.vehicle_id]);

  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const handleDragStart = useCallback((index: number) => setDraggedIndex(index), []);
  const handleDragEnd = useCallback(() => setDraggedIndex(null), []);
  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    const newDeliveries = [...storeDeliveries];
    const draggedItem = newDeliveries[draggedIndex];
    newDeliveries.splice(draggedIndex, 1);
    newDeliveries.splice(index, 0, draggedItem);
    newDeliveries.forEach((delivery, idx) => { delivery.sequence = idx + 1; });
    setStoreDeliveries(newDeliveries);
    setDraggedIndex(index);
  }, [draggedIndex, storeDeliveries]);

  const handleRemoveDelivery = useCallback((id: string) => {
    setStoreDeliveries(prev =>
      prev.filter(d => d.id !== id).map((delivery, idx) => ({ ...delivery, sequence: idx + 1 }))
    );
  }, []);

  const totals = useMemo(() => ({
    totalAmount: storeDeliveries.reduce((sum, d) => sum + d.total_amount, 0),
    totalStops: storeDeliveries.length,
  }), [storeDeliveries]);

  const setBranchAndClearVehicles = useCallback((branch: string) => {
    setSelectedBranch(branch);
    setSelectedVehicleId('');
    setSelectedVehicleId2('');
    setSelectedVehicleId3('');
  }, []);

  const setVehicleSearchAndClear = useCallback((search: string) => {
    setVehicleSearch(search);
    setSelectedVehicleId('');
    setSelectedVehicleId2('');
    setSelectedVehicleId3('');
  }, []);

  const setSplitModeWithExpanded = useCallback((mode: SplitMode) => {
    setSplitMode(mode);
    if (mode === '2vehicles' || mode === '3trips') {
      setExpandedStores(new Set(storeDeliveries.map(d => d.id)));
    } else {
      setSelectedVehicleId2('');
      setSelectedDriverId2('');
      setSelectedVehicleId3('');
      setSelectedDriverId3('');
      setCapacitySummary2(null);
      setCapacitySummary3(null);
      setExpandedStores(new Set());
    }
  }, [storeDeliveries]);
  const setSplitIntoTwoTripsWithExpanded = useCallback((checked: boolean) => {
    setSplitModeWithExpanded(checked ? '2vehicles' : 'single');
  }, [setSplitModeWithExpanded]);

  const handleSubmit = useCallback(async () => {
    if (!selectedVehicleId) {
      warning('กรุณาเลือกรถ');
      return;
    }
    if (!selectedDriverId) {
      warning('กรุณาเลือกพนักงานขับรถ');
      return;
    }
    if (storeDeliveries.length === 0) {
      warning('กรุณาเลือกร้านค้าอย่างน้อย 1 ร้าน');
      return;
    }
    if (splitIntoTwoTrips) {
      if (!selectedVehicleId2 || !selectedDriverId2) {
        warning('เมื่อแบ่ง 2 คัน กรุณาเลือกรถและพนักงานขับรถของคันที่ 2');
        return;
      }
      if (splitValidationErrors.length > 0) {
        warning(`จำนวนสินค้าแบ่งไม่ตรง: ${splitValidationErrors[0]}`);
        return;
      }
      const items2 = getItemsForVehicle(2);
      if (items2.length === 0) {
        warning('คันที่ 2 ยังไม่มีสินค้า กรุณาแบ่งสินค้าไปคันที่ 2 อย่างน้อย 1 รายการ');
        return;
      }
    }
    if (splitIntoThreeTrips) {
      if (!selectedVehicleId2 || !selectedDriverId2 || !selectedVehicleId3 || !selectedDriverId3) {
        warning('เมื่อแบ่ง 3 เที่ยว กรุณาเลือกรถและพนักงานขับรถของเที่ยวที่ 2 และเที่ยวที่ 3');
        return;
      }
      if (splitValidationErrors.length > 0) {
        warning(`จำนวนสินค้าแบ่งไม่ตรง: ${splitValidationErrors[0]}`);
        return;
      }
      const items2 = getItemsForVehicle(2);
      const items3 = getItemsForVehicle(3);
      if (items2.length === 0) {
        warning('เที่ยวที่ 2 ยังไม่มีสินค้า กรุณาแบ่งสินค้าไปเที่ยวที่ 2 อย่างน้อย 1 รายการ');
        return;
      }
      if (items3.length === 0) {
        warning('เที่ยวที่ 3 ยังไม่มีสินค้า กรุณาแบ่งสินค้าไปเที่ยวที่ 3 อย่างน้อย 1 รายการ');
        return;
      }
      const trip1Errors = getCapacityBlockingErrors(capacitySummary, palletPackingResult);
      if (trip1Errors.length > 0) { warning(`เที่ยว 1: ${trip1Errors.join(', ')}`); return; }
      const trip2Errors = getCapacityBlockingErrors(capacitySummary2, palletPackingResult2);
      if (trip2Errors.length > 0) { warning(`เที่ยว 2: ${trip2Errors.join(', ')}`); return; }
      const trip3Errors = getCapacityBlockingErrors(capacitySummary3, palletPackingResult3);
      if (trip3Errors.length > 0) { warning(`เที่ยว 3: ${trip3Errors.join(', ')}`); return; }
    }
    if (splitIntoTwoTrips) {
      const trip1Errors = getCapacityBlockingErrors(capacitySummary, palletPackingResult);
      if (trip1Errors.length > 0) { warning(`คัน 1: ${trip1Errors.join(', ')}`); return; }
      const trip2Errors = getCapacityBlockingErrors(capacitySummary2, palletPackingResult2);
      if (trip2Errors.length > 0) { warning(`คัน 2: ${trip2Errors.join(', ')}`); return; }
    }
    if (splitMode === 'single') {
      const singleTripErrors = getCapacityBlockingErrors(capacitySummary, palletPackingResult);
      if (singleTripErrors.length > 0) {
        warning(`ไม่สามารถสร้างทริปได้: ${singleTripErrors.join(', ')}`);
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const buildStoresPayload = (deliveries: StoreDelivery[]) => {
        const storesMap = new Map<string, { store_id: string; sequence_order: number; items: any[] }>();
        const includedOrderIds = new Set<string>();
        for (const delivery of deliveries) {
          const orderItems = orderItemsMap.get(delivery.order_id) || [];
          const items = orderItems
            .map((item: any) => {
              const remaining = getRemaining(item);
              const qtyInTrip = quantityInThisTripMap[splitKey(delivery.order_id, item.id)] ?? remaining;
              const qty = Math.max(0, Math.min(remaining, qtyInTrip));
              const pickedUp = Number(item.quantity_picked_up_at_store ?? 0);
              return { item, qty, remaining, pickedUp };
            })
            .filter(({ qty, remaining, pickedUp }) => qty > 0 || (remaining === 0 && pickedUp > 0))
            .map(({ item }) => ({
              product_id: item.product_id,
              quantity: Number(item.quantity),
              quantity_picked_up_at_store: Number(item.quantity_picked_up_at_store ?? 0),
              notes: item.notes || undefined,
              is_bonus: item.is_bonus || false,
              unit:
                (item.unit != null && String(item.unit).trim() !== '' ? String(item.unit).trim() : null) ||
                (item.product?.unit ? String(item.product.unit) : null),
            }));
          if (items.length === 0) continue;
          includedOrderIds.add(delivery.order_id);
          const existingStore = storesMap.get(delivery.store_id);
          if (existingStore) {
            existingStore.sequence_order = Math.min(existingStore.sequence_order, delivery.sequence);
            existingStore.items.push(...items);
            continue;
          }
          storesMap.set(delivery.store_id, {
            store_id: delivery.store_id,
            sequence_order: delivery.sequence,
            items,
          });
        }
        return {
          stores: Array.from(storesMap.values()).sort((a, b) => a.sequence_order - b.sequence_order),
          orderIds: Array.from(includedOrderIds),
        };
      };

      const buildSplitStoresPayload = (tripNum: 1 | 2 | 3) => {
        const storesMap = new Map<string, { store_id: string; sequence_order: number; items: any[] }>();
        const includedOrderIds = new Set<string>();
        for (const delivery of storeDeliveries) {
          const orderItems = orderItemsMap.get(delivery.order_id) || [];
          let hasItemsInTrip = false;
          for (const item of orderItems) {
            const remaining = getRemaining(item);
            const pickedUp = Number(item.quantity_picked_up_at_store ?? 0);
            const key = splitKey(delivery.order_id, item.id);
            const split = itemSplitMap[key];
            let qty = 0;
            if (splitMode === '3trips') {
              qty = tripNum === 1 ? (split?.trip1Qty ?? remaining) : tripNum === 2 ? (split?.trip2Qty ?? 0) : (split?.trip3Qty ?? 0);
            } else {
              qty = split ? (tripNum === 1 ? split.vehicle1Qty : split.vehicle2Qty) : (tripNum === 1 ? remaining : 0);
            }
            if (qty > 0) {
              hasItemsInTrip = true;
              const existingStore = storesMap.get(delivery.store_id);
              if (existingStore) {
                existingStore.sequence_order = Math.min(existingStore.sequence_order, delivery.sequence);
              } else {
                storesMap.set(delivery.store_id, { store_id: delivery.store_id, sequence_order: delivery.sequence, items: [] });
              }
              storesMap.get(delivery.store_id)!.items.push({
                product_id: item.product_id,
                quantity: qty,
                quantity_picked_up_at_store: 0,
                notes: item.notes ? `${item.notes} [แบ่งจากออเดอร์ ${delivery.order_number}: ${qty}/${item.quantity}]` : `[แบ่งจากออเดอร์ ${delivery.order_number}: ${qty}/${item.quantity}]`,
                is_bonus: item.is_bonus || false,
                unit:
                  (item.unit != null && String(item.unit).trim() !== '' ? String(item.unit).trim() : null) ||
                  (item.product?.unit ? String(item.product.unit) : null),
              });
            } else if (tripNum === 1 && remaining === 0 && pickedUp > 0) {
              hasItemsInTrip = true;
              const existingStore = storesMap.get(delivery.store_id);
              if (existingStore) {
                existingStore.sequence_order = Math.min(existingStore.sequence_order, delivery.sequence);
              } else {
                storesMap.set(delivery.store_id, { store_id: delivery.store_id, sequence_order: delivery.sequence, items: [] });
              }
              storesMap.get(delivery.store_id)!.items.push({
                product_id: item.product_id,
                quantity: Number(item.quantity),
                quantity_picked_up_at_store: pickedUp,
                notes: item.notes || undefined,
                is_bonus: item.is_bonus || false,
                unit:
                  (item.unit != null && String(item.unit).trim() !== '' ? String(item.unit).trim() : null) ||
                  (item.product?.unit ? String(item.product.unit) : null),
              });
            }
          }
          if (hasItemsInTrip) {
            includedOrderIds.add(delivery.order_id);
          }
        }
        return {
          stores: Array.from(storesMap.values()).sort((a, b) => a.sequence_order - b.sequence_order),
          orderIds: Array.from(includedOrderIds),
        };
      };

      if (splitIntoTwoTrips) {
        const payload1 = buildSplitStoresPayload(1);
        const payload2 = buildSplitStoresPayload(2);
        const stores1 = payload1.stores;
        const stores2 = payload2.stores;
        const trip1 = await deliveryTripService.create({
          vehicle_id: selectedVehicleId,
          driver_id: selectedDriverId,
          planned_date: tripDate,
          notes: notes ? `[คัน 1] ${notes}` : '[คัน 1]',
          stores: stores1,
        });
        const trip2 = await deliveryTripService.create({
          vehicle_id: selectedVehicleId2,
          driver_id: selectedDriverId2,
          planned_date: tripDate,
          notes: notes ? `[คัน 2] ${notes}` : '[คัน 2]',
          stores: stores2,
        });
        const ordersForTrip1 = payload1.orderIds;
        const ordersForTrip1Set = new Set(ordersForTrip1);
        const ordersForTrip2 = payload2.orderIds.filter((orderId) => !ordersForTrip1Set.has(orderId));
        if (ordersForTrip1.length > 0) await ordersService.assignToTrip(ordersForTrip1, trip1.id, user?.id!);
        if (ordersForTrip2.length > 0) await ordersService.assignToTrip(ordersForTrip2, trip2.id, user?.id!);
        success(`สร้างทริป 2 คันเรียบร้อย (ทริป 1: ${trip1.trip_number}, ทริป 2: ${trip2.trip_number})`);
      } else if (splitIntoThreeTrips) {
        const payload1 = buildSplitStoresPayload(1);
        const payload2 = buildSplitStoresPayload(2);
        const payload3 = buildSplitStoresPayload(3);
        const stores1 = payload1.stores;
        const stores2 = payload2.stores;
        const stores3 = payload3.stores;
        const trip1 = await deliveryTripService.create({
          vehicle_id: selectedVehicleId,
          driver_id: selectedDriverId,
          planned_date: tripDate,
          notes: notes ? `[เที่ยว 1] ${notes}` : '[เที่ยว 1]',
          stores: stores1,
        });
        const trip2 = await deliveryTripService.create({
          vehicle_id: selectedVehicleId2,
          driver_id: selectedDriverId2,
          planned_date: tripDate,
          notes: notes ? `[เที่ยว 2] ${notes}` : '[เที่ยว 2]',
          stores: stores2,
        });
        const trip3 = await deliveryTripService.create({
          vehicle_id: selectedVehicleId3,
          driver_id: selectedDriverId3,
          planned_date: tripDate,
          notes: notes ? `[เที่ยว 3] ${notes}` : '[เที่ยว 3]',
          stores: stores3,
        });
        const ordersForTrip1 = payload1.orderIds;
        const ordersForTrip1Set = new Set(ordersForTrip1);
        const ordersForTrip2 = payload2.orderIds.filter((orderId) => !ordersForTrip1Set.has(orderId));
        const assignedOrderIds = new Set([...ordersForTrip1, ...ordersForTrip2]);
        const ordersForTrip3 = payload3.orderIds.filter((orderId) => !assignedOrderIds.has(orderId));
        if (ordersForTrip1.length > 0) await ordersService.assignToTrip(ordersForTrip1, trip1.id, user?.id!);
        if (ordersForTrip2.length > 0) await ordersService.assignToTrip(ordersForTrip2, trip2.id, user?.id!);
        if (ordersForTrip3.length > 0) await ordersService.assignToTrip(ordersForTrip3, trip3.id, user?.id!);
        success(`สร้างทริป 3 เที่ยวเรียบร้อย (${trip1.trip_number}, ${trip2.trip_number}, ${trip3.trip_number})`);
      } else if (splitMode === 'multi') {
        // Dynamic N-slot multi-trip mode
        const createdTrips: { trip_number: string }[] = [];
        const allAssignedOrderIds = new Set<string>();

        for (const slot of tripSlots) {
          if (!slot.vehicleId) continue;

          // Build stores/items for this slot from multiTripItemQty
          const storesMap = new Map<string, { store_id: string; sequence_order: number; items: any[] }>();
          const includedOrderIds = new Set<string>();

          for (const delivery of storeDeliveries) {
            const orderItems = orderItemsMap.get(delivery.order_id) || [];
            for (const item of orderItems) {
              const key = splitKey(delivery.order_id, item.id);
              const qty = multiTripItemQty[key]?.[slot.id] ?? 0;
              if (qty <= 0) continue;
              if (!storesMap.has(delivery.store_id)) {
                storesMap.set(delivery.store_id, {
                  store_id: delivery.store_id,
                  sequence_order: delivery.sequence,
                  items: [],
                });
              }
              storesMap.get(delivery.store_id)!.items.push({
                product_id: item.product_id,
                quantity: qty,
                quantity_picked_up_at_store: 0,
                notes: item.notes ?? null,
                is_bonus: item.is_bonus || false,
                unit: item.unit != null && String(item.unit).trim() !== '' ? String(item.unit).trim() : null,
              });
              includedOrderIds.add(delivery.order_id);
            }
          }

          const stores = Array.from(storesMap.values());
          if (stores.length === 0) continue;

          const trip = await deliveryTripService.create({
            vehicle_id: slot.vehicleId,
            driver_id: slot.driverId || selectedDriverId,
            planned_date: tripDate,
            notes: notes ? `[${slot.label}] ${notes}` : `[${slot.label}]`,
            stores,
          });
          createdTrips.push(trip);

          const newOrderIds = [...includedOrderIds].filter((id) => !allAssignedOrderIds.has(id));
          if (newOrderIds.length > 0) await ordersService.assignToTrip(newOrderIds, trip.id, user?.id!);
          newOrderIds.forEach((id) => allAssignedOrderIds.add(id));
        }

        if (createdTrips.length === 0) {
          error('กรุณากำหนดจำนวนสินค้าและรถให้กับอย่างน้อย 1 เที่ยว');
          setIsSubmitting(false);
          return;
        }

        success(`สร้างทริป ${createdTrips.length} เที่ยวเรียบร้อย (${createdTrips.map((t) => t.trip_number).join(', ')})`);
      } else {
        const payload = buildStoresPayload(storeDeliveries);
        const stores = payload.stores;
        if (stores.length === 0) {
          error('กรุณาระบุสินค้าที่นำไปส่งในทริปนี้อย่างน้อย 1 รายการ (คอลัมน์ "นำไปส่งในทริปนี้")');
          setIsSubmitting(false);
          return;
        }
        const trip = await deliveryTripService.create({
          vehicle_id: selectedVehicleId,
          driver_id: selectedDriverId,
          planned_date: tripDate,
          notes: notes || undefined,
          stores,
        });
        const orderIds = payload.orderIds;
        if (orderIds.length > 0) await ordersService.assignToTrip(orderIds, trip.id, user?.id!);
        success('สร้างทริปเรียบร้อย');
      }

      if (recommendationInput && aiHasFetched && aiRecommendations.length > 0) {
        const topRec = aiRecommendations[0];
        const wasAccepted = selectedVehicleId === selectedRecommendationVehicleId;
        vehicleRecommendationService.recordFeedback({
          input_hash: hashRecommendationInput(recommendationInput),
          requested_products: recommendationInput.items,
          requested_stores: recommendationInput.store_ids,
          planned_date: recommendationInput.planned_date,
          recommended_vehicle_id: topRec.vehicle_id,
          recommended_trips: aiRecommendations.slice(0, 3).map((r: any) => ({
            vehicle_id: r.vehicle_id,
            vehicle_plate: r.vehicle_plate,
            score: r.overall_score,
          })),
          status: wasAccepted ? 'accepted' : 'rejected',
          confidence_score: topRec.overall_score,
          reasoning: topRec.reasoning,
          created_by: user?.id,
        });
      }
      onSuccess();
    } catch (err: any) {
      console.error('Error creating trip:', err);
      error(`เกิดข้อผิดพลาด: ${err.message || 'ไม่สามารถสร้างทริปได้'}`);
    } finally {
      setIsSubmitting(false);
    }
  }, [
    selectedVehicleId, selectedDriverId, selectedVehicleId2, selectedDriverId2, selectedVehicleId3, selectedDriverId3,
    storeDeliveries, orderItemsMap, splitIntoTwoTrips, splitIntoThreeTrips, splitMode, itemSplitMap, quantityInThisTripMap,
    splitValidationErrors, capacitySummary, capacitySummary2, capacitySummary3, palletPackingResult, palletPackingResult2, palletPackingResult3,
    getRemaining, getItemsForVehicle, user?.id, recommendationInput, aiHasFetched, aiRecommendations,
    selectedRecommendationVehicleId, onSuccess, warning, success, error, getCapacityBlockingErrors,
    tripSlots, multiTripItemQty,
  ]);

  const setQuantityInThisTripMapForKey = useCallback((key: string, value: number) => {
    setQuantityInThisTripMap(prev => ({ ...prev, [key]: value }));
  }, []);

  const toggleExpandedStore = useCallback((deliveryId: string) => {
    setExpandedStores(prev => {
      const next = new Set(prev);
      if (next.has(deliveryId)) next.delete(deliveryId);
      else next.add(deliveryId);
      return next;
    });
  }, []);

  const setAllQuantityInThisTripForDelivery = useCallback((orderId: string, orderItems: any[], value: 'all' | 'none') => {
    setQuantityInThisTripMap(prev => {
      const next = { ...prev };
      for (const item of orderItems) {
        const rem = getRemaining(item);
        if (rem <= 0 && value === 'all') continue;
        const key = splitKey(orderId, item.id);
        next[key] = value === 'all' ? rem : 0;
      }
      return next;
    });
  }, [getRemaining]);

  // ── Dynamic multi-trip slot state (splitMode === 'multi') ──────────────────

  const [tripSlots, setTripSlots] = useState<TripSlot[]>(() => [createTripSlot(1), createTripSlot(2)]);
  const [multiTripItemQty, setMultiTripItemQty] = useState<MultiTripItemQty>({});

  const addTripSlot = useCallback(() => {
    setTripSlots((prev) => {
      const next = prev.length + 1;
      return [...prev, createTripSlot(next)];
    });
  }, []);

  const removeTripSlot = useCallback((slotId: string) => {
    setTripSlots((prev) => {
      if (prev.length <= 2) return prev;
      return prev.filter((s) => s.id !== slotId);
    });
    // Remove qty entries for removed slot
    setMultiTripItemQty((prev) => {
      const next = { ...prev };
      for (const key of Object.keys(next)) {
        const { [slotId]: _removed, ...rest } = next[key] ?? {};
        next[key] = rest;
      }
      return next;
    });
  }, []);

  const updateTripSlot = useCallback(<K extends keyof TripSlot>(slotId: string, field: K, value: TripSlot[K]) => {
    setTripSlots((prev) => prev.map((s) => (s.id === slotId ? { ...s, [field]: value } : s)));
  }, []);

  const setMultiTripQty = useCallback((slotId: string, itemKey: string, qty: number) => {
    setMultiTripItemQty((prev) => ({
      ...prev,
      [itemKey]: { ...(prev[itemKey] ?? {}), [slotId]: qty },
    }));
  }, []);

  /** Distribute remaining quantity evenly across all slots for a given item. */
  const distributeEvenlyMulti = useCallback((orderId: string, orderItems: any[]) => {
    setMultiTripItemQty((prev) => {
      const next = { ...prev };
      for (const item of orderItems) {
        const rem = Math.max(0,
          Number(item.quantity)
          - Number(item.quantity_picked_up_at_store ?? 0)
          - Number(item.quantity_delivered ?? 0)
        );
        if (rem <= 0) continue;
        const key = splitKey(orderId, item.id);
        const perSlot = Math.floor(rem / tripSlots.length);
        const slotQty: Record<string, number> = {};
        tripSlots.forEach((slot, idx) => {
          slotQty[slot.id] = idx === tripSlots.length - 1 ? rem - perSlot * (tripSlots.length - 1) : perSlot;
        });
        next[key] = slotQty;
      }
      return next;
    });
  }, [tripSlots]);

  const setAllSplitForDelivery = useCallback((orderId: string, orderItems: any[], target: 'vehicle1' | 'vehicle2' | 'vehicle3' | 'half') => {
    setItemSplitMap(prev => {
      const next = { ...prev };
      for (const item of orderItems) {
        const rem = Math.max(0,
          Number(item.quantity)
          - Number(item.quantity_picked_up_at_store ?? 0)
          - Number(item.quantity_delivered ?? 0)
        );
        if (rem <= 0) continue;
        const key = splitKey(orderId, item.id);
        if (splitMode === '3trips') {
          if (target === 'vehicle1') next[key] = { vehicle1Qty: 0, vehicle2Qty: 0, trip1Qty: rem, trip2Qty: 0, trip3Qty: 0 };
          else if (target === 'vehicle2') next[key] = { vehicle1Qty: 0, vehicle2Qty: 0, trip1Qty: 0, trip2Qty: rem, trip3Qty: 0 };
          else if (target === 'vehicle3') next[key] = { vehicle1Qty: 0, vehicle2Qty: 0, trip1Qty: 0, trip2Qty: 0, trip3Qty: rem };
          else {
            const third = Math.floor(rem / 3);
            next[key] = { vehicle1Qty: 0, vehicle2Qty: 0, trip1Qty: third, trip2Qty: third, trip3Qty: rem - third * 2 };
          }
        } else {
          if (target === 'vehicle1') next[key] = { vehicle1Qty: rem, vehicle2Qty: 0 };
          else if (target === 'vehicle2') next[key] = { vehicle1Qty: 0, vehicle2Qty: rem };
          else next[key] = { vehicle1Qty: Math.floor(rem / 2), vehicle2Qty: rem - Math.floor(rem / 2) };
        }
      }
      return next;
    });
  }, [splitMode]);

  return {
    currentStep,
    // Order selection
    storeDeliveries,
    setStoreDeliveries,
    orderItemsMap,
    expandedStores,
    toggleExpandedStore,
    splitKey,
    getRemaining,
    splitMode,
    splitIntoTwoTrips,
    splitIntoThreeTrips,
    setSplitIntoTwoTripsWithExpanded,
    setSplitModeWithExpanded,
    itemSplitMap,
    handleSplitQtyChange,
    quantityInThisTripMap,
    setQuantityInThisTripMap,
    setQuantityInThisTripMapForKey,
    setAllQuantityInThisTripForDelivery,
    setAllSplitForDelivery,
    splitValidationErrors,
    draggedIndex,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    handleRemoveDelivery,
    // Vehicle selection
    vehicles,
    vehiclesLoading,
    selectedBranch,
    setSelectedBranch: setBranchAndClearVehicles,
    vehicleSearch,
    setVehicleSearch: setVehicleSearchAndClear,
    branches,
    filteredVehicles,
    selectedVehicleId,
    setSelectedVehicleId,
    // AI recommendation
    aiRecommendations,
    aiLoading,
    aiError,
    aiHasFetched,
    fetchRecommendations,
    handleAiSelectVehicle,
    handleRequestAI,
    aiExtraLoading,
    aiExtraResult,
    aiCooldownRemaining,
    // Crew assignment
    drivers,
    driversLoading,
    filteredDrivers,
    selectedDriverId,
    setSelectedDriverId,
    selectedVehicleId2,
    setSelectedVehicleId2,
    selectedDriverId2,
    setSelectedDriverId2,
    selectedVehicleId3,
    setSelectedVehicleId3,
    selectedDriverId3,
    setSelectedDriverId3,
    tripDate,
    setTripDate,
    notes,
    setNotes,
    skipStockDeduction,
    setSkipStockDeduction,
    nextTripSequence1,
    nextTripSequence2,
    nextTripSequence3,
    // Confirmation & submit
    totals,
    selectedOrders,
    capacitySummary,
    capacitySummary2,
    capacitySummary3,
    palletPackingResult,
    palletPackingResult2,
    palletPackingResult3,
    getItemsForVehicle,
    isSubmitting,
    handleSubmit,
    // Dynamic multi-trip slots (splitMode === 'multi')
    tripSlots,
    addTripSlot,
    removeTripSlot,
    updateTripSlot,
    multiTripItemQty,
    setMultiTripQty,
    distributeEvenlyMulti,
  };
}
