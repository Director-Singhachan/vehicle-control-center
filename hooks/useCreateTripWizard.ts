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
import type { StoreDelivery, ItemSplitQty, CapacitySummary } from '../types/createTripWizard';
import { splitKey } from '../types/createTripWizard';

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

  const [splitIntoTwoTrips, setSplitIntoTwoTrips] = useState(false);
  const [selectedVehicleId2, setSelectedVehicleId2] = useState('');
  const [selectedDriverId2, setSelectedDriverId2] = useState('');
  const [itemSplitMap, setItemSplitMap] = useState<Record<string, ItemSplitQty>>({});
  const [quantityInThisTripMap, setQuantityInThisTripMap] = useState<Record<string, number>>({});
  const [expandedStores, setExpandedStores] = useState<Set<string>>(new Set());

  const [selectedBranch, setSelectedBranch] = useState('');
  const [vehicleSearch, setVehicleSearch] = useState('');

  const [capacitySummary, setCapacitySummary] = useState<CapacitySummary | null>(null);
  const [capacitySummary2, setCapacitySummary2] = useState<CapacitySummary | null>(null);
  const [palletPackingResult, setPalletPackingResult] = useState<PalletPackingResult | null>(null);

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
    if (!splitIntoTwoTrips) return;
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
          newMap[key] = { vehicle1Qty: remaining, vehicle2Qty: 0 };
        } else {
          newMap[key] = itemSplitMap[key];
        }
      }
    }
    if (Object.keys(newMap).length > 0) {
      setItemSplitMap(prev => ({ ...prev, ...newMap }));
    }
  }, [splitIntoTwoTrips, storeDeliveries, orderItemsMap]);

  const handleSplitQtyChange = useCallback((orderId: string, itemId: string, vehicle: 1 | 2, value: number, totalQty: number) => {
    const key = splitKey(orderId, itemId);
    const clamped = Math.max(0, Math.min(totalQty, value));
    setItemSplitMap(prev => ({
      ...prev,
      [key]: vehicle === 1
        ? { vehicle1Qty: clamped, vehicle2Qty: totalQty - clamped }
        : { vehicle1Qty: totalQty - clamped, vehicle2Qty: clamped },
    }));
  }, []);

  const getItemsForVehicle = useCallback((vehicleNum: 1 | 2) => {
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
        const qty = split
          ? (vehicleNum === 1 ? split.vehicle1Qty : split.vehicle2Qty)
          : (vehicleNum === 1 ? remaining : 0);
        if (qty > 0) items.push({ product_id: item.product_id, quantity: qty });
      }
    }
    return items;
  }, [storeDeliveries, orderItemsMap, itemSplitMap]);

  const splitValidationErrors = useMemo(() => {
    if (!splitIntoTwoTrips) return [];
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
          const sum = split.vehicle1Qty + split.vehicle2Qty;
          if (Math.abs(sum - remaining) > 0.001) {
            errors.push(`${delivery.store_name} - ${item.product?.product_name || item.product_name || item.product_id}: จำนวนรวม ${sum} ≠ คงเหลือ ${remaining}`);
          }
        }
      }
    }
    return errors;
  }, [splitIntoTwoTrips, storeDeliveries, orderItemsMap, itemSplitMap]);

  useEffect(() => {
    if (!selectedVehicleId || storeDeliveries.length === 0) {
      setCapacitySummary(null);
      setCapacitySummary2(null);
      setPalletPackingResult(null);
      return;
    }
    const items1 = splitIntoTwoTrips ? getItemsForVehicle(1) : (() => {
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
    if (items1.length === 0 && !splitIntoTwoTrips) {
      setCapacitySummary(null);
      setCapacitySummary2(null);
      setPalletPackingResult(null);
      return;
    }
    setCapacitySummary(prev => ({ ...prev, loading: true, errors: [], warnings: [] } as CapacitySummary));
    const timeoutId = setTimeout(() => {
      const run1 = items1.length > 0
        ? calculateTripCapacity(items1, selectedVehicleId)
        : Promise.resolve({ summary: { totalPallets: 0, totalWeightKg: 0, totalHeightCm: 0, vehicleMaxPallets: null, vehicleMaxWeightKg: null, vehicleMaxHeightCm: null }, errors: [] as string[], warnings: [] as string[] });
      if (items1.length > 0) {
        calculatePalletAllocation(items1).then((packing) => {
          setPalletPackingResult(packing.errors.length === 0 ? packing : null);
        }).catch(() => setPalletPackingResult(null));
      } else {
        setPalletPackingResult(null);
      }
      run1.then(r => {
        setCapacitySummary({ totalPallets: r.summary.totalPallets, totalWeightKg: r.summary.totalWeightKg, totalHeightCm: r.summary.totalHeightCm, vehicleMaxPallets: r.summary.vehicleMaxPallets, vehicleMaxWeightKg: r.summary.vehicleMaxWeightKg, vehicleMaxHeightCm: r.summary.vehicleMaxHeightCm, loading: false, errors: r.errors, warnings: r.warnings });
      }).catch(err => {
        setCapacitySummary(prev => ({ ...prev, loading: false, errors: [err.message || 'ไม่สามารถคำนวณความจุได้'], warnings: [] } as CapacitySummary));
      });
      if (splitIntoTwoTrips && selectedVehicleId2) {
        const items2 = getItemsForVehicle(2);
        if (items2.length > 0) {
          setCapacitySummary2(prev => ({ ...prev, loading: true, errors: [], warnings: [] } as CapacitySummary));
          calculateTripCapacity(items2, selectedVehicleId2).then(r => {
            setCapacitySummary2({ totalPallets: r.summary.totalPallets, totalWeightKg: r.summary.totalWeightKg, totalHeightCm: r.summary.totalHeightCm, vehicleMaxPallets: r.summary.vehicleMaxPallets, vehicleMaxWeightKg: r.summary.vehicleMaxWeightKg, vehicleMaxHeightCm: r.summary.vehicleMaxHeightCm, loading: false, errors: r.errors, warnings: r.warnings });
          }).catch(err => {
            setCapacitySummary2(prev => ({ ...prev, loading: false, errors: [err.message || 'ไม่สามารถคำนวณความจุได้'], warnings: [] } as CapacitySummary));
          });
        } else {
          setCapacitySummary2(null);
        }
      } else {
        setCapacitySummary2(null);
      }
    }, 500);
    return () => clearTimeout(timeoutId);
  }, [selectedVehicleId, selectedVehicleId2, storeDeliveries, orderItemsMap, splitIntoTwoTrips, itemSplitMap, quantityInThisTripMap, getItemsForVehicle, getRemaining]);

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
  }, []);

  const setVehicleSearchAndClear = useCallback((search: string) => {
    setVehicleSearch(search);
    setSelectedVehicleId('');
    setSelectedVehicleId2('');
  }, []);

  const setSplitIntoTwoTripsWithExpanded = useCallback((checked: boolean) => {
    setSplitIntoTwoTrips(checked);
    if (checked) {
      setExpandedStores(new Set(storeDeliveries.map(d => d.id)));
    } else {
      setSelectedVehicleId2('');
      setSelectedDriverId2('');
      setCapacitySummary2(null);
      setExpandedStores(new Set());
    }
  }, [storeDeliveries]);

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
      if (capacitySummary?.errors?.length) {
        const dp1 = palletPackingResult ? palletPackingResult.totalPallets : capacitySummary.totalPallets;
        const nonPalletErrors1 = capacitySummary.errors.filter((msg) => !msg.startsWith('จำนวนพาเลท'));
        const recalc1 = [...nonPalletErrors1];
        if (capacitySummary.vehicleMaxPallets !== null && dp1 > capacitySummary.vehicleMaxPallets) {
          recalc1.push(`จำนวนพาเลทเกินความจุ: ${dp1} พาเลท (สูงสุด ${capacitySummary.vehicleMaxPallets} พาเลท)`);
        }
        if (recalc1.length > 0) {
          warning(`คัน 1: ${recalc1.join(', ')}`);
          return;
        }
      }
      if (capacitySummary2?.errors?.length) {
        warning(`คัน 2: ${capacitySummary2.errors.join(', ')}`);
        return;
      }
    } else {
      if (capacitySummary && capacitySummary.errors.length > 0) {
        const displayPallets = palletPackingResult ? palletPackingResult.totalPallets : capacitySummary.totalPallets;
        const nonPalletErrors = capacitySummary.errors.filter((msg) => !msg.startsWith('จำนวนพาเลท'));
        const recalculatedErrors = [...nonPalletErrors];
        if (capacitySummary.vehicleMaxPallets !== null && displayPallets > capacitySummary.vehicleMaxPallets) {
          recalculatedErrors.push(`จำนวนพาเลทเกินความจุ: ${displayPallets} พาเลท (สูงสุด ${capacitySummary.vehicleMaxPallets} พาเลท)`);
        }
        if (recalculatedErrors.length > 0) {
          warning(`ไม่สามารถสร้างทริปได้: ${recalculatedErrors.join(', ')}`);
          return;
        }
      }
    }

    setIsSubmitting(true);
    try {
      const buildStoresPayload = (deliveries: StoreDelivery[]) =>
        deliveries.map((delivery) => {
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
            }));
          return { store_id: delivery.store_id, sequence_order: delivery.sequence, items };
        })
        .filter((s) => s.items.length > 0);

      const buildSplitStoresPayload = (vehicleNum: 1 | 2) => {
        const storesMap: Record<string, { store_id: string; sequence_order: number; items: any[] }> = {};
        for (const delivery of storeDeliveries) {
          const orderItems = orderItemsMap.get(delivery.order_id) || [];
          for (const item of orderItems) {
            const remaining = getRemaining(item);
            const pickedUp = Number(item.quantity_picked_up_at_store ?? 0);
            const key = splitKey(delivery.order_id, item.id);
            const split = itemSplitMap[key];
            const qty = split ? (vehicleNum === 1 ? split.vehicle1Qty : split.vehicle2Qty) : (vehicleNum === 1 ? remaining : 0);
            if (qty > 0) {
              if (!storesMap[delivery.id]) {
                storesMap[delivery.id] = { store_id: delivery.store_id, sequence_order: delivery.sequence, items: [] };
              }
              storesMap[delivery.id].items.push({
                product_id: item.product_id,
                quantity: qty,
                quantity_picked_up_at_store: 0,
                notes: item.notes ? `${item.notes} [แบ่งจากออเดอร์ ${delivery.order_number}: ${qty}/${item.quantity}]` : `[แบ่งจากออเดอร์ ${delivery.order_number}: ${qty}/${item.quantity}]`,
                is_bonus: item.is_bonus || false,
              });
            } else if (vehicleNum === 1 && remaining === 0 && pickedUp > 0) {
              if (!storesMap[delivery.id]) {
                storesMap[delivery.id] = { store_id: delivery.store_id, sequence_order: delivery.sequence, items: [] };
              }
              storesMap[delivery.id].items.push({
                product_id: item.product_id,
                quantity: Number(item.quantity),
                quantity_picked_up_at_store: pickedUp,
                notes: item.notes || undefined,
                is_bonus: item.is_bonus || false,
              });
            }
          }
        }
        return Object.values(storesMap);
      };

      if (splitIntoTwoTrips) {
        const stores1 = buildSplitStoresPayload(1);
        const stores2 = buildSplitStoresPayload(2);
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
        const trip1StoreIds = new Set(stores1.map(s => s.store_id));
        const trip2StoreIds = new Set(stores2.map(s => s.store_id));
        const ordersForTrip1: string[] = [];
        const ordersForTrip2: string[] = [];
        const processedOrderIds = new Set<string>();
        for (const delivery of storeDeliveries) {
          if (processedOrderIds.has(delivery.order_id)) continue;
          processedOrderIds.add(delivery.order_id);
          const inTrip1 = trip1StoreIds.has(delivery.store_id);
          const inTrip2 = trip2StoreIds.has(delivery.store_id);
          if (inTrip1) ordersForTrip1.push(delivery.order_id);
          else if (inTrip2) ordersForTrip2.push(delivery.order_id);
        }
        if (ordersForTrip1.length > 0) await ordersService.assignToTrip(ordersForTrip1, trip1.id, user?.id!);
        if (ordersForTrip2.length > 0) await ordersService.assignToTrip(ordersForTrip2, trip2.id, user?.id!);
        success(`สร้างทริป 2 คันเรียบร้อย (ทริป 1: ${trip1.trip_number}, ทริป 2: ${trip2.trip_number})`);
      } else {
        const stores = buildStoresPayload(storeDeliveries);
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
        const orderIds = [...new Set(stores.map((s) => storeDeliveries.find((d) => d.store_id === s.store_id)?.order_id).filter(Boolean) as string[])];
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
    selectedVehicleId, selectedDriverId, selectedVehicleId2, selectedDriverId2,
    storeDeliveries, orderItemsMap, splitIntoTwoTrips, itemSplitMap, quantityInThisTripMap,
    splitValidationErrors, capacitySummary, capacitySummary2, palletPackingResult,
    getRemaining, getItemsForVehicle, user?.id, recommendationInput, aiHasFetched, aiRecommendations,
    selectedRecommendationVehicleId, onSuccess, warning, success, error,
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

  const setAllSplitForDelivery = useCallback((orderId: string, orderItems: any[], target: 'vehicle1' | 'vehicle2' | 'half') => {
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
        if (target === 'vehicle1') next[key] = { vehicle1Qty: rem, vehicle2Qty: 0 };
        else if (target === 'vehicle2') next[key] = { vehicle1Qty: 0, vehicle2Qty: rem };
        else next[key] = { vehicle1Qty: Math.floor(rem / 2), vehicle2Qty: rem - Math.floor(rem / 2) };
      }
      return next;
    });
  }, []);

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
    splitIntoTwoTrips,
    setSplitIntoTwoTripsWithExpanded,
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
    tripDate,
    setTripDate,
    notes,
    setNotes,
    skipStockDeduction,
    setSkipStockDeduction,
    // Confirmation & submit
    totals,
    selectedOrders,
    capacitySummary,
    capacitySummary2,
    palletPackingResult,
    getItemsForVehicle,
    isSubmitting,
    handleSubmit,
  };
}
