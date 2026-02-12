import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { ArrowLeft, Truck, Users, MapPin, Calendar, Package, Save, Plus, GripVertical, X, Search, Building2, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';
import { useVehicles } from '../hooks/useVehicles';
import { profileService } from '../services/profileService';
import { deliveryTripService } from '../services/deliveryTripService';
import { ordersService, orderItemsService } from '../services/ordersService';
import { inventoryService } from '../services/inventoryService';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { PageLayout } from '../components/ui/PageLayout';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { useAuth } from '../hooks';
import { useToast } from '../hooks/useToast';
import { ToastContainer } from '../components/ui/Toast';
import { calculateTripCapacity } from '../utils/tripCapacityValidation';
import { calculatePalletAllocation, type PalletPackingResult } from '../utils/palletPacking';
import { AlertCircle } from 'lucide-react';
import { useVehicleRecommendation } from '../hooks/useVehicleRecommendation';
import { VehicleRecommendationPanel } from '../components/trip/VehicleRecommendationPanel';
import { vehicleRecommendationService, hashRecommendationInput } from '../services/vehicleRecommendationService';
import type { RecommendationInput } from '../services/vehicleRecommendationService';
import { tripMetricsService } from '../services/tripMetricsService';

interface CreateTripFromOrdersViewProps {
  selectedOrders: any[];
  onBack: () => void;
  onSuccess: () => void;
}

interface StoreDelivery {
  id: string;
  order_id: string;
  store_id: string;
  store_name: string;
  store_code: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  order_number: string;
  total_amount: number;
  sequence: number;
  delivery_date: string | null;
}

// การแบ่งสินค้าระดับรายการ: key = `${orderId}_${itemId}` → จำนวนที่ขึ้นแต่ละคัน
interface ItemSplitQty {
  vehicle1Qty: number;
  vehicle2Qty: number;
}

type CapacitySummary = {
  totalPallets: number;
  totalWeightKg: number;
  totalHeightCm: number;
  vehicleMaxPallets: number | null;
  vehicleMaxWeightKg: number | null;
  vehicleMaxHeightCm: number | null;
  loading: boolean;
  errors: string[];
  warnings: string[];
};

export function CreateTripFromOrdersView({ selectedOrders, onBack, onSuccess }: CreateTripFromOrdersViewProps) {
  const { user } = useAuth();
  const { vehicles, loading: vehiclesLoading } = useVehicles();
  const { toasts, success, error, warning, dismissToast } = useToast();

  const [drivers, setDrivers] = useState<Array<{ id: string; full_name: string; branch?: string | null }>>([]);
  const [driversLoading, setDriversLoading] = useState(false);
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [selectedDriverId, setSelectedDriverId] = useState('');
  const [tripDate, setTripDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderItemsMap, setOrderItemsMap] = useState<Map<string, any[]>>(new Map());
  const [skipStockDeduction, setSkipStockDeduction] = useState(true);

  // แบ่งเป็น 2 คัน — ระดับสินค้า
  const [splitIntoTwoTrips, setSplitIntoTwoTrips] = useState(false);
  const [selectedVehicleId2, setSelectedVehicleId2] = useState('');
  const [selectedDriverId2, setSelectedDriverId2] = useState('');
  // itemSplitMap: key = `${orderId}_${itemId}` → { vehicle1Qty, vehicle2Qty }
  const [itemSplitMap, setItemSplitMap] = useState<Record<string, ItemSplitQty>>({});
  // UI: ร้านที่กางรายละเอียดสินค้า
  const [expandedStores, setExpandedStores] = useState<Set<string>>(new Set());

  // Vehicle filtering
  const [selectedBranch, setSelectedBranch] = useState('');
  const [vehicleSearch, setVehicleSearch] = useState('');

  // Capacity summary
  const [capacitySummary, setCapacitySummary] = useState<CapacitySummary | null>(null);
  const [capacitySummary2, setCapacitySummary2] = useState<CapacitySummary | null>(null);
  /** ผล bin packing (จัดรวมหลายชนิดบนพาเลทเดียวกัน) — ใช้แสดงจำนวนพาเลทที่แม่นยำขึ้น */
  const [palletPackingResult, setPalletPackingResult] = useState<PalletPackingResult | null>(null);

  // สร้างรายการร้านค้าจากออเดอร์ที่เลือก
  const [storeDeliveries, setStoreDeliveries] = useState<StoreDelivery[]>(() => {
    return selectedOrders.map((order, index) => {
      // Debug log
      if (!order.store_id) {
        console.error('[CreateTrip] Missing store_id for order:', order);
      }

      return {
        id: `${order.id}-${index}`,
        order_id: order.id,
        store_id: order.store_id, // จาก orders table
        store_name: order.customer_name, // จาก stores.customer_name
        store_code: order.customer_code, // จาก stores.customer_code
        address: order.delivery_address || order.store_address || '',
        latitude: order.delivery_latitude,
        longitude: order.delivery_longitude,
        order_number: order.order_number,
        total_amount: order.total_amount,
        sequence: index + 1,
        delivery_date: order.delivery_date || null,
      };
    });
  });

  // Debug: log vehicles data
  useEffect(() => {
    console.log('[CreateTrip] vehicles:', vehicles);
    console.log('[CreateTrip] vehiclesLoading:', vehiclesLoading);
  }, [vehicles, vehiclesLoading]);

  // Fetch drivers list
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

  // Fetch order items for all orders
  useEffect(() => {
    const fetchOrderItems = async () => {
      const itemsMap = new Map<string, any[]>();

      for (const order of selectedOrders) {
        try {
          const items = await orderItemsService.getByOrderId(order.id);
          itemsMap.set(order.id, items || []);
        } catch (error) {
          console.error(`Failed to fetch items for order ${order.id}:`, error);
          itemsMap.set(order.id, []);
        }
      }

      setOrderItemsMap(itemsMap);
    };

    fetchOrderItems();
  }, [selectedOrders]);

  // สร้าง key สำหรับ itemSplitMap
  const splitKey = (orderId: string, itemId: string) => `${orderId}_${itemId}`;

  // เมื่อเปิดโหมดแบ่ง 2 คัน ให้ init ค่า default (ทั้งหมดอยู่คัน 1, คัน 2 = 0)
  useEffect(() => {
    if (!splitIntoTwoTrips) return;
    const newMap: Record<string, ItemSplitQty> = {};
    for (const delivery of storeDeliveries) {
      const items = orderItemsMap.get(delivery.order_id) || [];
      for (const item of items) {
        const key = splitKey(delivery.order_id, item.id);
        if (!itemSplitMap[key]) {
          newMap[key] = { vehicle1Qty: item.quantity, vehicle2Qty: 0 };
        } else {
          newMap[key] = itemSplitMap[key];
        }
      }
    }
    if (Object.keys(newMap).length > 0) {
      setItemSplitMap(prev => ({ ...prev, ...newMap }));
    }
  }, [splitIntoTwoTrips, storeDeliveries, orderItemsMap]);

  // เปลี่ยนจำนวนคัน 1 → คัน 2 = ส่วนที่เหลือ (หรือกลับกัน)
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

  // Collect items for capacity: ถ้าแบ่ง 2 คัน ใช้จำนวนจาก split map
  const getItemsForVehicle = useCallback((vehicleNum: 1 | 2) => {
    const items: Array<{ product_id: string; quantity: number }> = [];
    for (const delivery of storeDeliveries) {
      const orderItems = orderItemsMap.get(delivery.order_id) || [];
      for (const item of orderItems) {
        const key = splitKey(delivery.order_id, item.id);
        const split = itemSplitMap[key];
        const qty = split
          ? (vehicleNum === 1 ? split.vehicle1Qty : split.vehicle2Qty)
          : (vehicleNum === 1 ? item.quantity : 0);
        if (qty > 0) {
          items.push({ product_id: item.product_id, quantity: qty });
        }
      }
    }
    return items;
  }, [storeDeliveries, orderItemsMap, itemSplitMap]);

  // ตรวจสอบว่า split จำนวนครบถ้วน (sum = original)
  const splitValidationErrors = useMemo(() => {
    if (!splitIntoTwoTrips) return [];
    const errors: string[] = [];
    for (const delivery of storeDeliveries) {
      const items = orderItemsMap.get(delivery.order_id) || [];
      for (const item of items) {
        const key = splitKey(delivery.order_id, item.id);
        const split = itemSplitMap[key];
        if (split) {
          const sum = split.vehicle1Qty + split.vehicle2Qty;
          if (Math.abs(sum - item.quantity) > 0.001) {
            errors.push(`${delivery.store_name} - ${item.product?.product_name || item.product_name || item.product?.product_code || item.product_code || item.product_id}: จำนวนรวม ${sum} ≠ สั่ง ${item.quantity}`);
          }
        }
      }
    }
    return errors;
  }, [splitIntoTwoTrips, storeDeliveries, orderItemsMap, itemSplitMap]);

  // Calculate capacity summary (with debounce)
  useEffect(() => {
    if (!selectedVehicleId || storeDeliveries.length === 0) {
      setCapacitySummary(null);
      setCapacitySummary2(null);
      setPalletPackingResult(null);
      return;
    }

    // Collect items per vehicle
    const items1 = splitIntoTwoTrips ? getItemsForVehicle(1) : (() => {
      const all: Array<{ product_id: string; quantity: number }> = [];
      for (const d of storeDeliveries) {
        for (const item of (orderItemsMap.get(d.order_id) || [])) {
          all.push({ product_id: item.product_id, quantity: item.quantity });
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
      // Trip 1
      const run1 = items1.length > 0
        ? calculateTripCapacity(items1, selectedVehicleId)
        : Promise.resolve({ summary: { totalPallets: 0, totalWeightKg: 0, totalHeightCm: 0, vehicleMaxPallets: null, vehicleMaxWeightKg: null, vehicleMaxHeightCm: null }, errors: [] as string[], warnings: [] as string[] });

      if (items1.length > 0) {
        calculatePalletAllocation(items1).then((packing) => {
          setPalletPackingResult(packing.errors.length > 0 ? null : packing);
        }).catch(() => setPalletPackingResult(null));
      } else {
        setPalletPackingResult(null);
      }

      run1.then(r => {
        setCapacitySummary({ totalPallets: r.summary.totalPallets, totalWeightKg: r.summary.totalWeightKg, totalHeightCm: r.summary.totalHeightCm, vehicleMaxPallets: r.summary.vehicleMaxPallets, vehicleMaxWeightKg: r.summary.vehicleMaxWeightKg, vehicleMaxHeightCm: r.summary.vehicleMaxHeightCm, loading: false, errors: r.errors, warnings: r.warnings });
      }).catch(err => {
        setCapacitySummary(prev => ({ ...prev, loading: false, errors: [err.message || 'ไม่สามารถคำนวณความจุได้'], warnings: [] } as CapacitySummary));
      });

      // Trip 2
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
  }, [selectedVehicleId, selectedVehicleId2, storeDeliveries, orderItemsMap, splitIntoTwoTrips, itemSplitMap, getItemsForVehicle]);

  // Get unique branches from vehicles
  const branches = useMemo(() => {
    if (!vehicles || vehicles.length === 0) return [];
    const uniqueBranches = new Set<string>();
    vehicles.forEach((v: any) => {
      if (v.branch) {
        uniqueBranches.add(v.branch);
      }
    });
    return Array.from(uniqueBranches).sort();
  }, [vehicles]);

  // Filter vehicles by branch and search
  const filteredVehicles = useMemo(() => {
    if (!vehicles) return [];

    let filtered = vehicles;

    // Filter by branch
    if (selectedBranch) {
      filtered = filtered.filter((v: any) => v.branch === selectedBranch);
    }

    // Filter by search term (plate, make, model)
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

  // Filter drivers by selected branch (ถ้าเลือกสาขา ให้แสดงเฉพาะพนักงานของสาขานั้น)
  const filteredDrivers = useMemo(() => {
    if (!drivers) return [];
    if (!selectedBranch) return drivers;
    return drivers.filter((d) => d.branch === selectedBranch);
  }, [drivers, selectedBranch]);

  // ============================================================
  // AI Vehicle Recommendation
  // ============================================================
  const recommendationInput = useMemo<RecommendationInput | null>(() => {
    if (storeDeliveries.length === 0 || orderItemsMap.size === 0) return null;

    const store_ids = [...new Set(storeDeliveries.map((d) => d.store_id))];
    const items: RecommendationInput['items'] = [];

    for (const delivery of storeDeliveries) {
      const orderItems = orderItemsMap.get(delivery.order_id) || [];
      for (const item of orderItems) {
        items.push({
          product_id: item.product_id,
          quantity: item.quantity,
          store_id: delivery.store_id,
        });
      }
    }

    if (items.length === 0) return null;

    return {
      store_ids,
      items,
      planned_date: tripDate,
      branch: selectedBranch || undefined,
    };
  }, [storeDeliveries, orderItemsMap, tripDate, selectedBranch]);

  const {
    recommendations: aiRecommendations,
    loading: aiLoading,
    error: aiError,
    fetch: fetchRecommendations,
    hasFetched: aiHasFetched,
  } = useVehicleRecommendation(recommendationInput);

  // Track which recommendation was selected (for feedback recording)
  const [selectedRecommendationVehicleId, setSelectedRecommendationVehicleId] = useState<string | null>(null);

  // AI แนะนำ (Edge Function): ผลจากปุ่ม "ใช้ AI แนะนำ"
  const [aiExtraResult, setAiExtraResult] = useState<{
    suggested_vehicle_id: string | null;
    reasoning: string | null;
    packing_tips: string | null;
    error?: string;
  } | null>(null);
  const [aiExtraLoading, setAiExtraLoading] = useState(false);
  /** Cooldown หลังกดใช้ AI (วินาทีที่เหลือ) เพื่อไม่ให้กดซ้ำเกินโควต้า */
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

      // ดึงทริปที่คล้ายกันจากประวัติ เพื่อใช้เป็น historical_context ให้ AI วิเคราะห์เป็น insight
      try {
        const rawProductIds: string[] = input.items.map(
          (i: any) => i.product_id as string
        );
        const productIds = Array.from(new Set<string>(rawProductIds));
        const similarTrips = await tripMetricsService.getSimilarTripsForLoad({
          totalWeightKg: first.capacity_info.estimated_weight_kg,
          totalVolumeLiter: first.capacity_info.estimated_volume_liter,
          storeIds: input.store_ids,
          productIds,
          limit: 8,
        });
        const ctx = await tripMetricsService.buildSimilarTripsContext(similarTrips);
        if (ctx.trim().length > 0) {
          historical_context = ctx;
        }
      } catch (err) {
        console.warn('[CreateTripFromOrdersView] getSimilarTripsForLoad error:', err);
      }

      // ดึง packing pattern insights จาก analytics views
      let packing_patterns: string | undefined;
      try {
        const patterns = await tripMetricsService.getPackingPatternInsights();
        if (patterns.trim().length > 0) {
          packing_patterns = patterns;
        }
      } catch (err) {
        console.warn('[CreateTripFromOrdersView] getPackingPatternInsights error:', err);
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
        // Fallback: ใช้คำนวณแบบเดิม (แยกตามชนิดสินค้า)
        try {
          const cap = await calculateTripCapacity(tripItems, first.vehicle_id);
          estimated_pallets = cap.summary.totalPallets;
        } catch {
          /* ไม่ส่ง estimated_pallets */
        }
      }
      const trip = {
        estimated_weight_kg: first.capacity_info.estimated_weight_kg,
        estimated_volume_liter: first.capacity_info.estimated_volume_liter,
        store_count: input.store_ids.length,
        item_count: input.items.length,
        items_summary: `${input.items.length} รายการสินค้า`,
        planned_date: input.planned_date,
        ...(estimated_pallets != null && { estimated_pallets }),
        ...(pallet_allocation != null && pallet_allocation.length > 0 && { pallet_allocation }),
      };
      const vehicles = aiRecommendations.slice(0, 5).map((r) => ({
        vehicle_id: r.vehicle_id,
        plate: r.vehicle_plate,
        max_weight_kg: r.capacity_info.max_weight_kg,
        cargo_volume_liter: r.capacity_info.max_volume_liter,
        branch: null as string | null,
      }));
      const result = await vehicleRecommendationService.getAIRecommendation({
        trip,
        vehicles,
        historical_context,
        packing_patterns,
      });
      setAiExtraResult(result ?? null);
      if (result?.suggested_vehicle_id) {
        setSelectedVehicleId(result.suggested_vehicle_id);
        setSelectedRecommendationVehicleId(result.suggested_vehicle_id);
      }
      setAiCooldownRemaining(AI_COOLDOWN_SECONDS);
    } catch (err) {
      console.warn('[CreateTripFromOrdersView] getAIRecommendation error:', err);
      setAiCooldownRemaining(AI_COOLDOWN_SECONDS);
    } finally {
      setAiExtraLoading(false);
    }
  }, [recommendationInput, aiRecommendations]);

  // นับถอยหลัง cooldown ทุก 1 วินาที
  useEffect(() => {
    if (aiCooldownRemaining <= 0) return;
    const t = setInterval(() => {
      setAiCooldownRemaining((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(t);
  }, [aiCooldownRemaining]);

  // ล้างผล AI เมื่อรายการแนะนำรถเปลี่ยน (ผู้ใช้เปลี่ยนร้าน/สินค้า แล้วระบบโหลดแนะนำใหม่)
  useEffect(() => {
    setAiExtraResult(null);
  }, [aiRecommendations.length, aiRecommendations[0]?.vehicle_id]);

  // Drag & Drop handlers
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const newDeliveries = [...storeDeliveries];
    const draggedItem = newDeliveries[draggedIndex];

    newDeliveries.splice(draggedIndex, 1);
    newDeliveries.splice(index, 0, draggedItem);

    // Update sequences
    newDeliveries.forEach((delivery, idx) => {
      delivery.sequence = idx + 1;
    });

    setStoreDeliveries(newDeliveries);
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  // Remove delivery
  const handleRemoveDelivery = (id: string) => {
    const newDeliveries = storeDeliveries
      .filter(d => d.id !== id)
      .map((delivery, idx) => ({
        ...delivery,
        sequence: idx + 1,
      }));
    setStoreDeliveries(newDeliveries);
  };

  // Calculate totals
  const totals = useMemo(() => {
    const totalAmount = storeDeliveries.reduce((sum, d) => sum + d.total_amount, 0);
    const totalStops = storeDeliveries.length;
    return { totalAmount, totalStops };
  }, [storeDeliveries]);

  // Submit
  const handleSubmit = async () => {
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
        warning(`คัน 1: ${capacitySummary.errors.join(', ')}`);
        return;
      }
      if (capacitySummary2?.errors?.length) {
        warning(`คัน 2: ${capacitySummary2.errors.join(', ')}`);
        return;
      }
    } else {
      if (capacitySummary && capacitySummary.errors.length > 0) {
        warning(`ไม่สามารถสร้างทริปได้: ${capacitySummary.errors.join(', ')}`);
        return;
      }
    }

    setIsSubmitting(true);

    try {
      // สร้าง stores payload ปกติ (ไม่แบ่ง)
      const buildStoresPayload = (deliveries: StoreDelivery[]) =>
        deliveries.map((delivery) => {
          const orderItems = orderItemsMap.get(delivery.order_id) || [];
          return {
            store_id: delivery.store_id,
            sequence_order: delivery.sequence,
            items: orderItems.map((item: any) => ({
              product_id: item.product_id,
              quantity: item.quantity,
              notes: item.notes || undefined,
              is_bonus: item.is_bonus || false,
            })),
          };
        });

      // สร้าง stores payload แบบแบ่ง (vehicleNum = 1 | 2)
      const buildSplitStoresPayload = (vehicleNum: 1 | 2) => {
        const storesMap: Record<string, { store_id: string; sequence_order: number; items: any[] }> = {};
        for (const delivery of storeDeliveries) {
          const orderItems = orderItemsMap.get(delivery.order_id) || [];
          for (const item of orderItems) {
            const key = splitKey(delivery.order_id, item.id);
            const split = itemSplitMap[key];
            const qty = split ? (vehicleNum === 1 ? split.vehicle1Qty : split.vehicle2Qty) : (vehicleNum === 1 ? item.quantity : 0);
            if (qty > 0) {
              // ใช้ delivery.id เป็น key เพราะ 1 ออเดอร์ = 1 ร้าน (1 delivery)
              if (!storesMap[delivery.id]) {
                storesMap[delivery.id] = {
                  store_id: delivery.store_id,
                  sequence_order: delivery.sequence,
                  items: [],
                };
              }
              storesMap[delivery.id].items.push({
                product_id: item.product_id,
                quantity: qty,
                notes: item.notes ? `${item.notes} [แบ่งจากออเดอร์ ${delivery.order_number}: ${qty}/${item.quantity}]` : `[แบ่งจากออเดอร์ ${delivery.order_number}: ${qty}/${item.quantity}]`,
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

        // สร้างทริป 1 ก่อน แล้วค่อยทริป 2 (เพื่อให้ trip_number ไม่ conflict)
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

        // ========================================================================
        // ผูกออเดอร์กับทริปที่ถูกต้อง:
        // - ออเดอร์ 1 ตัวผูกได้แค่ 1 ทริป (delivery_trip_id ใน orders table)
        // - order_number จะถูกสร้างโดย RPC ที่ JOIN store_id กับ delivery_trip_stores
        // - ดังนั้นต้องผูกออเดอร์กับทริปที่มี store_id ของมันอยู่ใน delivery_trip_stores
        //
        // กรณีที่เป็นไปได้:
        //   A) สินค้าของร้านนี้อยู่ทริป 1 อย่างเดียว → ผูกกับทริป 1
        //   B) สินค้าของร้านนี้อยู่ทริป 2 อย่างเดียว → ผูกกับทริป 2
        //   C) สินค้าของร้านนี้อยู่ทั้ง 2 ทริป → ผูกกับทริป 1 (เป็น primary)
        // ========================================================================
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

          if (inTrip1) {
            // กรณี A หรือ C: ร้านนี้อยู่ในทริป 1 → ผูกกับทริป 1
            ordersForTrip1.push(delivery.order_id);
          } else if (inTrip2) {
            // กรณี B: ร้านนี้อยู่เฉพาะทริป 2 → ผูกกับทริป 2
            ordersForTrip2.push(delivery.order_id);
          }
        }

        // ผูกออเดอร์กับทริปที่ถูกต้อง (เรียงตามลำดับเพื่อให้ order_number ถูกสร้างเรียงกัน)
        if (ordersForTrip1.length > 0) {
          await ordersService.assignToTrip(ordersForTrip1, trip1.id, user?.id!);
        }
        if (ordersForTrip2.length > 0) {
          await ordersService.assignToTrip(ordersForTrip2, trip2.id, user?.id!);
        }

        success(`สร้างทริป 2 คันเรียบร้อย (ทริป 1: ${trip1.trip_number}, ทริป 2: ${trip2.trip_number})`);
      } else {
        const stores = buildStoresPayload(storeDeliveries);
        const trip = await deliveryTripService.create({
          vehicle_id: selectedVehicleId,
          driver_id: selectedDriverId,
          planned_date: tripDate,
          notes: notes || undefined,
          stores,
        });
        const orderIds = storeDeliveries.map(d => d.order_id);
        await ordersService.assignToTrip(orderIds, trip.id, user?.id!);
        success('สร้างทริปเรียบร้อย');
      }

      // Record AI recommendation feedback (non-blocking)
      if (recommendationInput && aiHasFetched && aiRecommendations.length > 0) {
        const topRec = aiRecommendations[0];
        const wasAccepted = selectedVehicleId === selectedRecommendationVehicleId;
        vehicleRecommendationService.recordFeedback({
          input_hash: hashRecommendationInput(recommendationInput),
          requested_products: recommendationInput.items,
          requested_stores: recommendationInput.store_ids,
          planned_date: recommendationInput.planned_date,
          recommended_vehicle_id: topRec.vehicle_id,
          recommended_trips: aiRecommendations.slice(0, 3).map((r) => ({
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
  };

  return (
    <>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <PageLayout
        title="สร้างทริปจากออเดอร์"
        actions={
          <Button onClick={onBack} variant="outline">
            <ArrowLeft className="w-4 h-4 mr-2" />
            ย้อนกลับ
          </Button>
        }
      >
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Trip Settings */}
          <div className="lg:col-span-2 space-y-6">
            {/* Trip Info */}
            <Card>
              <div className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">ข้อมูลทริป</h3>

                <div className="space-y-4">
                  {/* AI Vehicle Recommendation Panel */}
                  {!splitIntoTwoTrips && (
                    <VehicleRecommendationPanel
                      recommendations={aiRecommendations}
                      loading={aiLoading}
                      error={aiError}
                      hasFetched={aiHasFetched}
                      onSelectVehicle={handleAiSelectVehicle}
                      selectedVehicleId={selectedVehicleId}
                      onRefresh={fetchRecommendations}
                      onRequestAI={handleRequestAI}
                      aiLoading={aiExtraLoading}
                      aiResult={aiExtraResult}
                      aiCooldownRemaining={aiCooldownRemaining}
                    />
                  )}

                  {/* Branch & search: always show */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">
                        <Building2 className="w-3 h-3 inline mr-1" />
                        สาขา
                      </label>
                      <select
                        value={selectedBranch}
                        onChange={(e) => {
                          setSelectedBranch(e.target.value);
                          setSelectedVehicleId('');
                          setSelectedVehicleId2('');
                        }}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        disabled={vehiclesLoading}
                      >
                        <option value="">ทุกสาขา</option>
                        {branches.map((branch) => (
                          <option key={branch} value={branch}>
                            {branch}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">
                        <Search className="w-3 h-3 inline mr-1" />
                        ค้นหา (ทะเบียน/ยี่ห้อ/รุ่น)
                      </label>
                      <input
                        type="text"
                        value={vehicleSearch}
                        onChange={(e) => {
                          setVehicleSearch(e.target.value);
                          setSelectedVehicleId('');
                          setSelectedVehicleId2('');
                        }}
                        placeholder="พิมพ์เพื่อค้นหา..."
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        disabled={vehiclesLoading}
                      />
                    </div>
                  </div>

                  {/* Vehicle + Driver: single block when not split */}
                  {!splitIntoTwoTrips && (
                    <>
                      <div className="space-y-3">
                        <label className="block text-sm font-medium text-gray-700">
                          <Truck className="w-4 h-4 inline mr-1" />
                          เลือกรถ *
                        </label>
                        <select
                          value={selectedVehicleId}
                          onChange={(e) => setSelectedVehicleId(e.target.value)}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          disabled={vehiclesLoading}
                        >
                          <option value="">
                            {vehiclesLoading
                              ? 'กำลังโหลด...'
                              : filteredVehicles.length === 0
                                ? 'ไม่พบรถที่ตรงกับเงื่อนไข'
                                : `-- เลือกรถ (${filteredVehicles.length} คัน) --`}
                          </option>
                          {filteredVehicles.map((vehicle: any) => (
                            <option key={vehicle.id} value={vehicle.id}>
                              {vehicle.plate} {vehicle.make ? `- ${vehicle.make}` : ''} {vehicle.model || ''} {vehicle.branch ? `[${vehicle.branch}]` : ''}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          <Users className="w-4 h-4 inline mr-1" />
                          พนักงานขับรถ *
                        </label>
                        <select
                          value={selectedDriverId}
                          onChange={(e) => setSelectedDriverId(e.target.value)}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          disabled={driversLoading}
                        >
                          <option value="">
                            {driversLoading
                              ? 'กำลังโหลดพนักงาน...'
                              : selectedBranch && filteredDrivers.length === 0
                                ? 'ไม่พบพนักงานขับรถในสาขานี้'
                                : '-- เลือกพนักงาน --'}
                          </option>
                          {filteredDrivers.map((driver) => (
                            <option key={driver.id} value={driver.id}>
                              {driver.full_name}
                              {driver.branch ? ` [${driver.branch}]` : ''}
                            </option>
                          ))}
                        </select>
                      </div>
                    </>
                  )}

                  {/* แบ่งเป็น 2 คัน */}
                  <div className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-slate-900/30 border border-slate-200 dark:border-slate-700 rounded-lg">
                    <input
                      type="checkbox"
                      id="splitIntoTwoTrips"
                      checked={splitIntoTwoTrips}
                      onChange={(e) => {
                        setSplitIntoTwoTrips(e.target.checked);
                        if (e.target.checked) {
                          // เปิดรายการสินค้าทุกร้าน เพื่อให้จัดแบ่งได้ทันที
                          setExpandedStores(new Set(storeDeliveries.map(d => d.id)));
                        } else {
                          setSelectedVehicleId2('');
                          setSelectedDriverId2('');
                          setCapacitySummary2(null);
                          setExpandedStores(new Set());
                        }
                      }}
                      className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <label htmlFor="splitIntoTwoTrips" className="flex-1 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                      <span className="font-medium">แบ่งสินค้าขึ้น 2 คัน</span>
                      <span className="text-gray-500 dark:text-gray-400 ml-2">
                        (กำหนดได้ว่าสินค้าแต่ละรายการจะขึ้นรถคันไหน จำนวนเท่าไร)
                      </span>
                    </label>
                  </div>

                  {splitIntoTwoTrips && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 border border-blue-200 dark:border-blue-800 rounded-lg bg-blue-50/50 dark:bg-blue-900/10">
                      <div className="space-y-3">
                        <h4 className="font-medium text-gray-900 dark:text-gray-100">ทริป 1 (คันที่ 1)</h4>
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">รถ</label>
                          <select
                            value={selectedVehicleId}
                            onChange={(e) => setSelectedVehicleId(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                            disabled={vehiclesLoading}
                          >
                            <option value="">-- เลือกรถ --</option>
                            {filteredVehicles.map((v: any) => (
                              <option key={v.id} value={v.id}>
                                {v.plate} {v.make ? `- ${v.make}` : ''} {v.model || ''}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">พนักงานขับรถ</label>
                          <select
                            value={selectedDriverId}
                            onChange={(e) => setSelectedDriverId(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                            disabled={driversLoading}
                          >
                            <option value="">-- เลือกพนักงาน --</option>
                            {filteredDrivers.map((d) => (
                              <option key={d.id} value={d.id}>{d.full_name}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div className="space-y-3">
                        <h4 className="font-medium text-gray-900 dark:text-gray-100">ทริป 2 (คันที่ 2)</h4>
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">รถ</label>
                          <select
                            value={selectedVehicleId2}
                            onChange={(e) => setSelectedVehicleId2(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                            disabled={vehiclesLoading}
                          >
                            <option value="">-- เลือกรถ --</option>
                            {filteredVehicles.map((v: any) => (
                              <option key={v.id} value={v.id}>
                                {v.plate} {v.make ? `- ${v.make}` : ''} {v.model || ''}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">พนักงานขับรถ</label>
                          <select
                            value={selectedDriverId2}
                            onChange={(e) => setSelectedDriverId2(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                            disabled={driversLoading}
                          >
                            <option value="">-- เลือกพนักงาน --</option>
                            {filteredDrivers.map((d) => (
                              <option key={d.id} value={d.id}>{d.full_name}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Trip Date */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <Calendar className="w-4 h-4 inline mr-1" />
                      วันที่ส่ง *
                    </label>
                    <input
                      type="date"
                      value={tripDate}
                      onChange={(e) => setTripDate(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {/* Skip Stock Deduction Option */}
                  <div className="flex items-center gap-3 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                    <input
                      type="checkbox"
                      id="skipStockDeduction"
                      checked={skipStockDeduction}
                      onChange={(e) => setSkipStockDeduction(e.target.checked)}
                      className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <label htmlFor="skipStockDeduction" className="flex-1 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                      <span className="font-medium">ไม่ตัดสต๊อก</span>
                      <span className="text-gray-500 dark:text-gray-400 ml-2">
                        (ใช้สำหรับระบบใบน้อยที่ยังไม่ตัดสต๊อก)
                      </span>
                    </label>
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      หมายเหตุ
                    </label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      rows={3}
                      placeholder="หมายเหตุเพิ่มเติม..."
                    />
                  </div>
                </div>
              </div>
            </Card>

            {/* Store Deliveries with Drag & Drop */}
            <Card>
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">
                    ลำดับการจัดส่ง ({storeDeliveries.length} จุด)
                  </h3>
                  <p className="text-sm text-gray-500">
                    ลากเพื่อจัดเรียงลำดับ
                  </p>
                </div>
                {storeDeliveries.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>ไม่มีร้านค้าในรายการ</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {storeDeliveries.map((delivery, index) => {
                      const orderItems = orderItemsMap.get(delivery.order_id) || [];
                      const isExpanded = expandedStores.has(delivery.id);

                      return (
                        <div
                          key={delivery.id}
                          className={`bg-white border-2 rounded-xl hover:shadow-md transition-all ${draggedIndex === index ? 'opacity-50 border-blue-500' : 'border-gray-200'}`}
                        >
                          {/* Store Header (draggable) */}
                          <div
                            draggable
                            onDragStart={() => handleDragStart(index)}
                            onDragOver={(e) => handleDragOver(e, index)}
                            onDragEnd={handleDragEnd}
                            className="flex items-center gap-4 p-4 cursor-move"
                          >
                            <GripVertical className="w-5 h-5 text-gray-400 flex-shrink-0" />

                            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold text-sm">
                              {delivery.sequence}
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <p className="font-semibold text-gray-900 truncate">{delivery.store_name}</p>
                                <Badge variant="info" className="text-xs flex-shrink-0">
                                  {delivery.order_number}
                                </Badge>
                              </div>
                              <div className="flex items-start gap-2 text-sm text-gray-600">
                                <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                <p className="line-clamp-1">{delivery.address || 'ไม่มีที่อยู่'}</p>
                              </div>
                              {delivery.delivery_date && (
                                <div className="flex items-center gap-2 text-sm mt-1">
                                  <Calendar className="w-4 h-4 text-orange-600 flex-shrink-0" />
                                  <span className="font-medium text-orange-600">
                                    นัดส่ง: {new Date(delivery.delivery_date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}
                                  </span>
                                </div>
                              )}
                            </div>

                            <div className="text-right flex-shrink-0">
                              <p className="text-lg font-bold text-blue-600">
                                {new Intl.NumberFormat('th-TH').format(delivery.total_amount)} ฿
                              </p>
                            </div>

                            {/* Expand/collapse items */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setExpandedStores(prev => {
                                  const next = new Set(prev);
                                  if (next.has(delivery.id)) next.delete(delivery.id);
                                  else next.add(delivery.id);
                                  return next;
                                });
                              }}
                              className="flex-shrink-0 p-2 text-gray-500 hover:bg-gray-100 rounded-lg"
                              title="ดูรายการสินค้า"
                            >
                              {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                            </button>

                            <button
                              onClick={() => handleRemoveDelivery(delivery.id)}
                              className="flex-shrink-0 p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            >
                              <X className="w-5 h-5" />
                            </button>
                          </div>

                          {/* Items list (expanded) */}
                          {isExpanded && orderItems.length > 0 && (
                            <div className="border-t border-gray-100 px-4 pb-4">
                              <table className="w-full text-sm mt-3">
                                <thead>
                                  <tr className="text-left text-xs text-gray-500 uppercase">
                                    <th className="pb-2 font-medium">สินค้า</th>
                                    <th className="pb-2 font-medium text-center">สั่ง</th>
                                    {splitIntoTwoTrips && (
                                      <>
                                        <th className="pb-2 font-medium text-center">
                                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-100 text-blue-800">คัน 1</span>
                                        </th>
                                        <th className="pb-2 font-medium text-center">
                                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">คัน 2</span>
                                        </th>
                                        <th className="pb-2 font-medium text-center">ตรวจ</th>
                                      </>
                                    )}
                                  </tr>
                                </thead>
                                <tbody>
                                  {orderItems.map((item: any) => {
                                    const key = splitKey(delivery.order_id, item.id);
                                    const split = itemSplitMap[key] || { vehicle1Qty: item.quantity, vehicle2Qty: 0 };
                                    const sumOk = Math.abs((split.vehicle1Qty + split.vehicle2Qty) - item.quantity) < 0.001;
                                    return (
                                      <tr key={item.id} className="border-t border-gray-50">
                                        <td className="py-2">
                                          <div className="font-medium text-gray-900">{item.product?.product_name || item.product_name || item.product?.product_code || item.product_code || 'N/A'}</div>
                                          {item.product?.product_code && <div className="text-xs text-gray-500">{item.product.product_code}</div>}
                                          {item.is_bonus && <span className="text-xs text-purple-600 font-medium">แถม</span>}
                                        </td>
                                        <td className="py-2 text-center font-semibold text-gray-700">
                                          {item.quantity}
                                        </td>
                                        {splitIntoTwoTrips && (
                                          <>
                                            <td className="py-2 text-center">
                                              <input
                                                type="number"
                                                min={0}
                                                max={item.quantity}
                                                step="any"
                                                value={split.vehicle1Qty}
                                                onFocus={(e) => e.target.select()}
                                                onChange={(e) => handleSplitQtyChange(delivery.order_id, item.id, 1, parseFloat(e.target.value) || 0, item.quantity)}
                                                className="w-20 px-2 py-1 text-center border border-blue-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 bg-blue-50"
                                              />
                                            </td>
                                            <td className="py-2 text-center">
                                              <input
                                                type="number"
                                                min={0}
                                                max={item.quantity}
                                                step="any"
                                                value={split.vehicle2Qty}
                                                onFocus={(e) => e.target.select()}
                                                onChange={(e) => handleSplitQtyChange(delivery.order_id, item.id, 2, parseFloat(e.target.value) || 0, item.quantity)}
                                                className="w-20 px-2 py-1 text-center border border-emerald-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 bg-emerald-50"
                                              />
                                            </td>
                                            <td className="py-2 text-center">
                                              {sumOk ? (
                                                <span className="text-green-600 font-bold text-base">&#10003;</span>
                                              ) : (
                                                <span className="text-red-600 font-bold text-base" title={`รวม ${split.vehicle1Qty + split.vehicle2Qty} ≠ ${item.quantity}`}>&#10007;</span>
                                              )}
                                            </td>
                                          </>
                                        )}
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                              {splitIntoTwoTrips && (
                                <div className="mt-2 flex gap-2">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      for (const item of orderItems) {
                                        const key = splitKey(delivery.order_id, item.id);
                                        setItemSplitMap(prev => ({ ...prev, [key]: { vehicle1Qty: item.quantity, vehicle2Qty: 0 } }));
                                      }
                                    }}
                                    className="text-xs px-3 py-1 rounded border border-blue-300 text-blue-700 hover:bg-blue-50"
                                  >
                                    ทั้งหมดไปคัน 1
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      for (const item of orderItems) {
                                        const key = splitKey(delivery.order_id, item.id);
                                        setItemSplitMap(prev => ({ ...prev, [key]: { vehicle1Qty: 0, vehicle2Qty: item.quantity } }));
                                      }
                                    }}
                                    className="text-xs px-3 py-1 rounded border border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                                  >
                                    ทั้งหมดไปคัน 2
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      for (const item of orderItems) {
                                        const key = splitKey(delivery.order_id, item.id);
                                        const half = Math.floor(item.quantity / 2);
                                        setItemSplitMap(prev => ({ ...prev, [key]: { vehicle1Qty: half, vehicle2Qty: item.quantity - half } }));
                                      }
                                    }}
                                    className="text-xs px-3 py-1 rounded border border-gray-300 text-gray-700 hover:bg-gray-50"
                                  >
                                    แบ่งครึ่ง
                                  </button>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Collapsed items hint */}
                          {!isExpanded && orderItems.length > 0 && (
                            <div className="px-4 pb-3 text-xs text-gray-400">
                              {orderItems.length} รายการสินค้า — คลิก &#9660; เพื่อดูรายละเอียด
                              {splitIntoTwoTrips && (() => {
                                const v2Count = orderItems.filter((item: any) => {
                                  const key = splitKey(delivery.order_id, item.id);
                                  return (itemSplitMap[key]?.vehicle2Qty ?? 0) > 0;
                                }).length;
                                return v2Count > 0 ? (
                                  <span className="ml-2 px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 font-medium">
                                    {v2Count} รายการแบ่งไปคัน 2
                                  </span>
                                ) : null;
                              })()}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Split validation errors */}
                {splitIntoTwoTrips && splitValidationErrors.length > 0 && (
                  <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex items-center gap-2 text-red-800 mb-2">
                      <AlertTriangle size={16} />
                      <span className="font-medium text-sm">จำนวนแบ่งไม่ตรง:</span>
                    </div>
                    <ul className="list-disc list-inside text-xs text-red-700 space-y-1">
                      {splitValidationErrors.map((err, idx) => (
                        <li key={idx}>{err}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </Card>
          </div>

          {/* Right: Summary */}
          <div className="space-y-6">
            <Card>
              <div className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">สรุปทริป</h3>

                <div className="space-y-4">
                  <div className="flex items-center justify-between py-3 border-b border-gray-200">
                    <div className="flex items-center gap-2 text-gray-600">
                      <Package className="w-5 h-5" />
                      <span>จำนวนจุดส่ง</span>
                    </div>
                    <span className="text-xl font-bold text-gray-900">
                      {totals.totalStops}
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-3 border-b border-gray-200">
                    <div className="flex items-center gap-2 text-gray-600">
                      <Package className="w-5 h-5" />
                      <span>จำนวนออเดอร์</span>
                    </div>
                    <span className="text-xl font-bold text-gray-900">
                      {selectedOrders.length}
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-3">
                    <span className="font-semibold text-gray-900">มูลค่ารวม</span>
                    <span className="text-2xl font-bold text-blue-600">
                      {new Intl.NumberFormat('th-TH').format(totals.totalAmount)} ฿
                    </span>
                  </div>
                </div>

                <div className="mt-6 pt-6 border-t border-gray-200">
                  <Button
                    onClick={handleSubmit}
                    disabled={
                      isSubmitting ||
                      !selectedVehicleId ||
                      !selectedDriverId ||
                      storeDeliveries.length === 0 ||
                      (splitIntoTwoTrips && (
                        !selectedVehicleId2 || !selectedDriverId2 ||
                        splitValidationErrors.length > 0 ||
                        getItemsForVehicle(2).length === 0
                      ))
                    }
                    className="w-full"
                  >
                    {isSubmitting ? (
                      <>
                        <LoadingSpinner size={16} className="mr-2" />
                        กำลังสร้างทริป...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4 mr-2" />
                        สร้างทริป
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </Card>

            {/* Capacity Summary */}
            {selectedVehicleId && storeDeliveries.length > 0 && (() => {
              // Check if there are any items in any order
              const hasItems = Array.from(orderItemsMap.values()).some((items: any[]) => Array.isArray(items) && items.length > 0);

              return (
                <Card>
                  <div className="p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <Package size={20} />
                      {splitIntoTwoTrips ? 'สรุปความจุ (คัน 1)' : 'สรุปความจุ'}
                    </h3>
                    {!hasItems ? (
                      <div className="text-center py-4 text-gray-500">
                        <p>กำลังโหลดข้อมูลสินค้า...</p>
                      </div>
                    ) : capacitySummary?.loading ? (
                      <div className="text-center py-4 text-gray-500">
                        กำลังคำนวณ...
                      </div>
                    ) : capacitySummary ? (() => {
                      // ใช้จำนวนพาเลทเดียวกับที่แสดง (bin packing) ในการให้ error/warning
                      const displayPallets = palletPackingResult
                        ? palletPackingResult.totalPallets
                        : capacitySummary.totalPallets;

                      const nonPalletErrors = capacitySummary.errors.filter(
                        (msg) => !msg.startsWith('จำนวนพาเลท')
                      );
                      const nonPalletWarnings = capacitySummary.warnings.filter(
                        (msg) => !msg.startsWith('จำนวนพาเลท')
                      );

                      const palletErrors: string[] = [];
                      const palletWarnings: string[] = [];

                      if (capacitySummary.vehicleMaxPallets !== null) {
                        if (displayPallets > capacitySummary.vehicleMaxPallets) {
                          palletErrors.push(
                            `จำนวนพาเลทเกินความจุ: ${displayPallets} พาเลท (สูงสุด ${capacitySummary.vehicleMaxPallets} พาเลท)`
                          );
                        } else if (displayPallets > capacitySummary.vehicleMaxPallets * 0.9) {
                          palletWarnings.push(
                            `จำนวนพาเลทใกล้เต็มความจุ: ${displayPallets}/${capacitySummary.vehicleMaxPallets} พาเลท (${Math.round((displayPallets / capacitySummary.vehicleMaxPallets) * 100)}%)`
                          );
                        }
                      }

                      const errorsToShow = [...nonPalletErrors, ...palletErrors];
                      const warningsToShow = [...nonPalletWarnings, ...palletWarnings];

                      return (
                        <div className="space-y-3">
                          {errorsToShow.length > 0 && (
                            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                              <div className="flex items-center gap-2 text-red-800 mb-2">
                                <AlertCircle size={16} />
                                <span className="font-medium">ข้อผิดพลาด:</span>
                              </div>
                              <ul className="list-disc list-inside text-sm text-red-700 space-y-1">
                                {errorsToShow.map((error, idx) => (
                                  <li key={idx}>{error}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {warningsToShow.length > 0 && (
                            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                              <div className="flex items-center gap-2 text-amber-800 mb-2">
                                <AlertCircle size={16} />
                                <span className="font-medium">คำเตือน:</span>
                              </div>
                              <ul className="list-disc list-inside text-sm text-amber-700 space-y-1">
                                {warningsToShow.map((warning, idx) => (
                                  <li key={idx}>{warning}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          <div className="grid grid-cols-2 gap-4">
                            <div className="p-3 bg-gray-50 rounded-lg">
                              <div className="text-sm text-gray-600 mb-1">
                                {palletPackingResult
                                  ? 'จำนวนพาเลท (จัดรวม)'
                                  : 'จำนวนพาเลท'}
                                <span className="block text-xs text-gray-500 font-normal mt-0.5">
                                  {palletPackingResult
                                    ? 'หลายชนิดบนพาเลทเดียวกัน ตามน้ำหนัก/ปริมาตร'
                                    : '(ค่าประมาณแยกตามชนิดสินค้า การจัดเรียงจริงอาจใช้น้อยกว่าถ้ารวมพาเลทได้)'}
                                </span>
                              </div>
                              <div className="text-2xl font-bold text-gray-900">
                                {displayPallets}
                                {capacitySummary.vehicleMaxPallets !== null && (
                                  <span className="text-lg font-normal text-gray-500">
                                    {' '}/ {capacitySummary.vehicleMaxPallets}
                                  </span>
                                )}
                              </div>
                              {capacitySummary.vehicleMaxPallets !== null && (() => {
                                const pct = (displayPallets / capacitySummary.vehicleMaxPallets) * 100;
                                return (
                                  <div className="mt-2">
                                    <div className="w-full bg-gray-200 rounded-full h-2">
                                      <div
                                        className={`h-2 rounded-full ${displayPallets > capacitySummary.vehicleMaxPallets
                                          ? 'bg-red-500'
                                          : displayPallets > capacitySummary.vehicleMaxPallets * 0.9
                                            ? 'bg-amber-500'
                                            : 'bg-green-500'
                                          }`}
                                        style={{
                                          width: `${Math.min(100, pct)}%`,
                                        }}
                                      />
                                    </div>
                                    <div className="text-xs text-gray-500 mt-1">
                                      {Math.round(pct)}% ของความจุ
                                    </div>
                                  </div>
                                );
                              })()}
                            </div>
                            <div className="p-3 bg-gray-50 rounded-lg">
                              <div className="text-sm text-gray-600 mb-1">
                                น้ำหนักรวม
                              </div>
                              <div className="text-2xl font-bold text-gray-900">
                                {capacitySummary.totalWeightKg.toFixed(2)} กก.
                                {capacitySummary.vehicleMaxWeightKg !== null && (
                                  <span className="text-lg font-normal text-gray-500">
                                    {' '}/ {capacitySummary.vehicleMaxWeightKg} กก.
                                  </span>
                                )}
                              </div>
                              {capacitySummary.vehicleMaxWeightKg !== null && (
                                <div className="mt-2">
                                  <div className="w-full bg-gray-200 rounded-full h-2">
                                    <div
                                      className={`h-2 rounded-full ${capacitySummary.totalWeightKg > capacitySummary.vehicleMaxWeightKg
                                        ? 'bg-red-500'
                                        : capacitySummary.totalWeightKg > capacitySummary.vehicleMaxWeightKg * 0.9
                                          ? 'bg-amber-500'
                                          : 'bg-green-500'
                                        }`}
                                      style={{
                                        width: `${Math.min(
                                          100,
                                          (capacitySummary.totalWeightKg / capacitySummary.vehicleMaxWeightKg) * 100
                                        )}%`,
                                      }}
                                    />
                                  </div>
                                  <div className="text-xs text-gray-500 mt-1">
                                    {Math.round(
                                      (capacitySummary.totalWeightKg / capacitySummary.vehicleMaxWeightKg) * 100
                                    )}
                                    % ของความจุ
                                  </div>
                                </div>
                              )}
                            </div>
                            {/* ตัดการแสดงความสูงรวมออกจากหน้านี้ตามคำขอ (ยังคำนวณภายในแต่ไม่แสดง) */}
                          </div>
                        </div>
                      );
                    })() : (
                      <div className="text-sm text-gray-500">
                        กำลังคำนวณความจุ...
                      </div>
                    )}
                  </div>
                </Card>
              );
            })()}

            {/* Capacity Summary คัน 2 (เมื่อแบ่ง 2 คัน) */}
            {splitIntoTwoTrips && selectedVehicleId2 && getItemsForVehicle(2).length > 0 && (
              <Card>
                <div className="p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <Package size={20} />
                    สรุปความจุ (คัน 2)
                  </h3>
                  {capacitySummary2?.loading ? (
                    <div className="text-center py-4 text-gray-500">กำลังคำนวณ...</div>
                  ) : capacitySummary2 ? (
                    <div className="space-y-3">
                      {capacitySummary2.errors.length > 0 && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                          <div className="flex items-center gap-2 text-red-800 mb-2">
                            <AlertCircle size={16} />
                            <span className="font-medium">ข้อผิดพลาด:</span>
                          </div>
                          <ul className="list-disc list-inside text-sm text-red-700 space-y-1">
                            {capacitySummary2.errors.map((error, idx) => (
                              <li key={idx}>{error}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-3 bg-gray-50 rounded-lg">
                          <div className="text-sm text-gray-600 mb-1">พาเลท</div>
                          <div className="text-xl font-bold text-gray-900">
                            {capacitySummary2.totalPallets}
                            {capacitySummary2.vehicleMaxPallets != null && (
                              <span className="text-sm font-normal text-gray-500"> / {capacitySummary2.vehicleMaxPallets}</span>
                            )}
                          </div>
                        </div>
                        <div className="p-3 bg-gray-50 rounded-lg">
                          <div className="text-sm text-gray-600 mb-1">น้ำหนัก (กก.)</div>
                          <div className="text-xl font-bold text-gray-900">
                            {capacitySummary2.totalWeightKg.toFixed(2)}
                            {capacitySummary2.vehicleMaxWeightKg != null && (
                              <span className="text-sm font-normal text-gray-500"> / {capacitySummary2.vehicleMaxWeightKg}</span>
                            )}
                          </div>
                        </div>
                        {/* ตัดการแสดงความสูงรวมของคันที่ 2 ออกตามคำขอ */}
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-gray-500">เลือกรถคันที่ 2 และจัดร้านลงคัน 2 เพื่อดูความจุ</div>
                  )}
                </div>
              </Card>
            )}

            {/* Selected Orders List */}
            <Card>
              <div className="p-6">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">
                  ออเดอร์ที่เลือก ({selectedOrders.length})
                </h3>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {selectedOrders.map((order) => (
                    <div key={order.id} className="p-3 bg-gray-50 rounded-lg">
                      <p className="text-sm font-medium text-gray-900">{order.order_number}</p>
                      <p className="text-xs text-gray-500">{order.customer_name}</p>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          </div>
        </div>
      </PageLayout>
    </>
  );
}

