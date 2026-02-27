// Vehicle Recommendation Service - AI-powered vehicle suggestions for trip planning
// Phase 1+2: Rule-based scoring algorithm using historical trip data
import { supabase } from '../lib/supabase';
import { tripMetricsService } from './tripMetricsService';
import { parseThaiAddress } from '../utils/parseThaiAddress';

// ============================================================
// Interfaces
// ============================================================

export interface RecommendationInput {
  store_ids: string[];
  items: Array<{ product_id: string; quantity: number; store_id: string }>;
  planned_date: string;
  branch?: string;
}

export interface VehicleRecommendation {
  vehicle_id: string;
  vehicle_plate: string;
  vehicle_type: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  overall_score: number; // 0-100
  rank: number;
  scores: {
    capacity_fit: number; // 0-100
    load_similarity: number; // 0-100 น้ำหนักทริปใกล้เคียงประวัติรถ
    product_compatibility: number; // 0-100 สินค้า fragile/liquid/temp vs รถ
    pallet_efficiency: number; // 0-100 จำนวนพาเลท vs พื้นที่รถ
    historical_success: number; // 0-100
    availability: number; // 0-100
    branch_match: number; // 0-100
    store_familiarity: number; // 0-100
    district_familiarity: number; // 0-100 ★ Phase 2: รถคุ้นเคยอำเภอเดียวกัน
    category_match: number; // 0-100 ★ Phase 2: หมวดสินค้าตรงกับประวัติ
  };
  capacity_info: {
    estimated_weight_kg: number;
    max_weight_kg: number | null;
    weight_utilization_pct: number | null;
    estimated_volume_liter: number;
    max_volume_liter: number | null;
    volume_utilization_pct: number | null;
    /** จำนวนพาเลทที่ระบบคำนวณจากสินค้า */
    estimated_pallets: number;
    /** จำนวนพาเลทที่รถรับได้ (จาก loading_constraints.max_pallets หรือประเมินจากขนาด) */
    max_pallets: number | null;
  };
  historical_stats: {
    similar_trips_count: number;
    avg_utilization: number | null;
    success_rate: number | null;
  };
  reasoning: string;
  confidence: 'high' | 'medium' | 'low';
}

interface VehicleRow {
  id: string;
  plate: string;
  type: string | null;
  make: string | null;
  model: string | null;
  branch: string | null;
  max_weight_kg: number | null;
  cargo_volume_liter: number | null;
  cargo_length_cm: number | null;
  cargo_width_cm: number | null;
  cargo_height_cm: number | null;
  has_shelves: boolean;
  loading_constraints: any;
}

interface ProductInfo {
  id: string;
  weight_kg: number | null;
  volume_liter: number | null;
}

/** Per-trip record for overlap filter + time-decay */
interface TripRecord {
  planned_date: string;
  store_ids: string[];
  district_keys: string[]; // Phase 2: อำเภอของร้านในทริปนี้
  product_categories: string[]; // Phase 2: หมวดสินค้าในทริปนี้
  actual_weight_kg: number | null;
  utilization: number | null;
  packing_score: number | null;
  had_issues: boolean;
}

interface HistoricalTripStats {
  vehicle_id: string;
  completed_trips: number;
  trips: TripRecord[];
  avg_utilization: number | null;
  avg_weight_kg: number | null;
  issue_count: number;
  store_ids_served: string[];
  district_keys_served: string[]; // Phase 2: อำเภอทั้งหมดที่เคยส่ง
  product_categories_served: string[]; // Phase 2: หมวดสินค้าทั้งหมดที่เคยส่ง
  weight_range: { min: number; max: number } | null;
  packing_score_avg: number | null;
}

/** Decay weight by days ago: 0-30→1.0, 31-60→0.7, 61-90→0.4 */
function getDecayWeight(plannedDate: string, refDate: string): number {
  const a = new Date(plannedDate).getTime();
  const b = new Date(refDate).getTime();
  const daysAgo = Math.floor((b - a) / (24 * 60 * 60 * 1000));
  if (daysAgo <= 30) return 1.0;
  if (daysAgo <= 60) return 0.7;
  if (daysAgo <= 90) return 0.4;
  return 0.2;
}

/** Overlap = |intersection| / |target|; true if >= 0.5 */
function hasStoreOverlap(tripStoreIds: string[], targetStoreIds: string[]): boolean {
  if (targetStoreIds.length === 0) return true;
  const targetSet = new Set(targetStoreIds);
  const overlap = tripStoreIds.filter((id) => targetSet.has(id)).length;
  return overlap / targetStoreIds.length >= 0.5;
}

// ============================================================
// Scoring Weights — Phase 3: Dynamic Weights from Feedback Loop
// ============================================================

/** Feature flag: เปิด/ปิด dynamic weights จาก feedback data */
const ENABLE_DYNAMIC_WEIGHTS = false; // เปิดเมื่อมี feedback data เพียงพอ (≥30 records)

/** Baseline weights — ค่าเริ่มต้นที่ใช้เมื่อปิด dynamic weights */
const BASELINE_WEIGHTS = {
  historical_success: 0.22,
  load_similarity: 0.16,
  store_familiarity: 0.14,
  district_familiarity: 0.05,
  category_match: 0.05,
  capacity_fit: 0.18,
  pallet_efficiency: 0.08,
  product_compatibility: 0.06,
  availability: 0.03,
  branch_match: 0.03,
};

type WeightKeys = keyof typeof BASELINE_WEIGHTS;

/** Mutable WEIGHTS — จะถูก override จาก feedback ถ้าเปิด dynamic weights */
let WEIGHTS = { ...BASELINE_WEIGHTS };

/** Cache สำหรับ dynamic weights (refresh ทุก 30 นาที) */
let _dynamicWeightsCache: { weights: typeof BASELINE_WEIGHTS; ts: number } | null = null;
const DYNAMIC_WEIGHTS_TTL = 30 * 60 * 1000; // 30 minutes

/**
 * Phase 3G: Feedback Loop — อ่าน accepted/rejected จาก ai_trip_recommendations
 * แล้วปรับ WEIGHTS ± ≤ 0.03 ต่อรอบ (clamp ที่ ±30% จาก baseline)
 */
async function computeDynamicWeights(): Promise<typeof BASELINE_WEIGHTS> {
  const now = Date.now();
  if (_dynamicWeightsCache && (now - _dynamicWeightsCache.ts) < DYNAMIC_WEIGHTS_TTL) {
    return _dynamicWeightsCache.weights;
  }

  try {
    // ดึง feedback ล่าสุด 100 records ที่มีสถานะ accepted/rejected
    const { data: feedbacks, error } = await supabase
      .from('ai_trip_recommendations')
      .select('status, utilization_scores, confidence_score')
      .in('status', ['accepted', 'rejected'])
      .order('created_at', { ascending: false })
      .limit(100);

    if (error || !feedbacks || feedbacks.length < 10) {
      // ถ้า feedback น้อยกว่า 10 → ใช้ baseline
      const result = { ...BASELINE_WEIGHTS };
      _dynamicWeightsCache = { weights: result, ts: now };
      return result;
    }

    const accepted = feedbacks.filter((f: any) => f.status === 'accepted');
    const rejected = feedbacks.filter((f: any) => f.status === 'rejected');
    const acceptRate = accepted.length / feedbacks.length;

    // คำนวณ delta: ถ้า accept rate สูง → เพิ่ม historical dimensions เล็กน้อย
    // ถ้า reject rate สูง → ลด historical dimensions + เพิ่ม capacity dimensions
    const delta: Partial<Record<WeightKeys, number>> = {};
    const MAX_DELTA = 0.03;

    if (acceptRate >= 0.7) {
      // Users ยอมรับบ่อย → เพิ่ม historical weights เล็กน้อย
      delta.historical_success = 0.01;
      delta.store_familiarity = 0.01;
      delta.district_familiarity = 0.005;
      delta.category_match = 0.005;
      // ลดจากที่อื่น
      delta.capacity_fit = -0.01;
      delta.branch_match = -0.01;
    } else if (acceptRate <= 0.3) {
      // Users reject บ่อย → เพิ่ม capacity, ลด historical
      delta.capacity_fit = 0.02;
      delta.pallet_efficiency = 0.01;
      delta.historical_success = -0.02;
      delta.load_similarity = -0.01;
    }
    // accept rate 30-70% → ไม่ปรับ

    // Apply deltas with clamp ±30% of baseline
    const result = { ...BASELINE_WEIGHTS };
    for (const key of Object.keys(BASELINE_WEIGHTS) as WeightKeys[]) {
      const base = BASELINE_WEIGHTS[key];
      const d = delta[key] ?? 0;
      const clamped = Math.max(-MAX_DELTA, Math.min(MAX_DELTA, d));
      result[key] = Math.max(base * 0.7, Math.min(base * 1.3, base + clamped));
    }

    // Normalize to sum = 1.0
    const total = Object.values(result).reduce((s, v) => s + v, 0);
    if (total > 0) {
      for (const key of Object.keys(result) as WeightKeys[]) {
        result[key] = result[key] / total;
      }
    }

    _dynamicWeightsCache = { weights: result, ts: now };
    return result;
  } catch (err) {
    console.warn('[vehicleRecommendation] computeDynamicWeights error:', err);
    const result = { ...BASELINE_WEIGHTS };
    _dynamicWeightsCache = { weights: result, ts: now };
    return result;
  }
}

/** ดึง WEIGHTS ปัจจุบัน (baseline หรือ dynamic ตาม feature flag) */
async function getActiveWeights(): Promise<typeof BASELINE_WEIGHTS> {
  if (!ENABLE_DYNAMIC_WEIGHTS) return BASELINE_WEIGHTS;
  return computeDynamicWeights();
}

// ============================================================
// Service Implementation
// ============================================================

export const vehicleRecommendationService = {
  /**
   * Get ranked vehicle recommendations for a set of orders/items
   */
  getRecommendations: async (
    input: RecommendationInput,
    limit: number = 5
  ): Promise<VehicleRecommendation[]> => {
    try {
      // 1–6. Parallel fetch (ลดเวลารอ ~60%)
      const [vehicles, loadEstimate, busyTripCountByVehicle, historicalStats, targetDistrictKeys, w] = await Promise.all([
        fetchVehicles(),
        estimateLoad(input.items),
        getBusyVehicles(input.planned_date),
        getHistoricalStatsCached(),
        getStoreDistrictKeys(input.store_ids),
        getActiveWeights(),
      ]);

      if (vehicles.length === 0) return [];

      // Phase 2: หมวดสินค้าของออเดอร์ปัจจุบัน
      const targetCategories = loadEstimate.productCategories;

      // 7. Score each vehicle (10 dimensions)
      const scored = vehicles.map((vehicle) => {
        const scores = {
          capacity_fit: scoreCapacityFit(vehicle, loadEstimate),
          load_similarity: scoreLoadSimilarity(vehicle.id, historicalStats, loadEstimate, input.store_ids),
          product_compatibility: scoreProductCompatibility(vehicle, loadEstimate),
          pallet_efficiency: scorePalletEfficiency(vehicle, loadEstimate),
          historical_success: scoreHistoricalSuccess(vehicle.id, historicalStats, loadEstimate),
          availability: scoreAvailability(vehicle.id, busyTripCountByVehicle),
          branch_match: scoreBranchMatch(vehicle.branch, input.branch),
          store_familiarity: scoreStoreFamiliarity(vehicle.id, input.store_ids, historicalStats),
          district_familiarity: scoreDistrictFamiliarity(vehicle.id, targetDistrictKeys, historicalStats),
          category_match: scoreCategoryMatch(vehicle.id, targetCategories, historicalStats),
        };

        const overall_raw = Math.round(
          scores.capacity_fit * w.capacity_fit +
          scores.load_similarity * w.load_similarity +
          scores.product_compatibility * w.product_compatibility +
          scores.pallet_efficiency * w.pallet_efficiency +
          scores.historical_success * w.historical_success +
          scores.availability * w.availability +
          scores.branch_match * w.branch_match +
          scores.store_familiarity * w.store_familiarity +
          scores.district_familiarity * w.district_familiarity +
          scores.category_match * w.category_match
        );

        // Hard penalty: ถ้าพาเลทไม่พอ หรือสินค้าไม่เข้ากับรถ → ลดคะแนนรวมอย่างรุนแรง
        let overall = overall_raw;
        if (scores.pallet_efficiency === 0) {
          overall = Math.min(overall, 35); // Cap ที่ 35 ถ้าพาเลทไม่พอแน่ๆ
        } else if (scores.pallet_efficiency < 30) {
          overall = Math.round(overall * 0.65); // ลด 35%
        }
        if (scores.product_compatibility < 30) {
          overall = Math.round(overall * 0.7); // ลด 30% ถ้าสินค้าไม่เข้ากัน
        }
        if (scores.capacity_fit === 0) {
          overall = 0; // เกินพิกัดชัดเจน → 0
        }

        const confidence = determineConfidence(historicalStats, vehicle.id);
        const tripCount = busyTripCountByVehicle.get(vehicle.id) ?? 0;
        const reasoning = generateReasoning(scores, vehicle, loadEstimate, confidence, tripCount);

        return {
          vehicle_id: vehicle.id,
          vehicle_plate: vehicle.plate,
          vehicle_type: vehicle.type,
          vehicle_make: vehicle.make,
          vehicle_model: vehicle.model,
          overall_score: overall,
          rank: 0, // assigned after sorting
          scores,
          capacity_info: {
            estimated_weight_kg: loadEstimate.totalWeightKg,
            max_weight_kg: vehicle.max_weight_kg,
            weight_utilization_pct: vehicle.max_weight_kg
              ? Math.round((loadEstimate.totalWeightKg / vehicle.max_weight_kg) * 100)
              : null,
            estimated_volume_liter: loadEstimate.totalVolumeLiter,
            max_volume_liter: vehicle.cargo_volume_liter,
            volume_utilization_pct: vehicle.cargo_volume_liter
              ? Math.round((loadEstimate.totalVolumeLiter / vehicle.cargo_volume_liter) * 100)
              : null,
            estimated_pallets: loadEstimate.estimatedPallets,
            max_pallets: getVehicleMaxPallets(vehicle),
          },
          historical_stats: getVehicleHistoricalSummary(vehicle.id, historicalStats, input.store_ids),
          reasoning,
          confidence,
        } as VehicleRecommendation;
      });

      // 6. กรองรถที่บรรทุกไม่ได้ (น้ำหนัก/พาเลทไม่พอ); เรียงตามประวัติทริปก่อน แล้วค่อยคะแนนรวม
      const tripHistoryScore = (r: VehicleRecommendation) =>
        (r.scores.load_similarity + r.scores.historical_success + r.scores.store_familiarity) / 3;

      const filtered = scored
        .filter((r) => r.scores.capacity_fit > 0) // น้ำหนัก/ปริมาตรเกินพิกัด → ตัดออก
        .filter((r) => r.scores.pallet_efficiency > 0) // ใส่พาเลทไม่พอ → ตัดออก
        .sort((a, b) => {
          const historyA = tripHistoryScore(a);
          const historyB = tripHistoryScore(b);
          if (Math.abs(historyB - historyA) >= 2) return historyB - historyA;
          return b.overall_score - a.overall_score;
        })
        .slice(0, limit);

      // Assign rank
      filtered.forEach((r, i) => {
        r.rank = i + 1;
      });

      return filtered;
    } catch (err) {
      console.error('[vehicleRecommendationService] getRecommendations error:', err);
      return [];
    }
  },

  /**
   * Record user feedback on a recommendation (accepted/rejected)
   */
  /**
   * เรียก AI (Edge Function) เพื่อแนะนำรถ + คำแนะนำการจัดเรียง (packing_tips)
   * ใช้เมื่อตั้งค่า GEMINI_API_KEY ใน Supabase secrets แล้ว
   * ถ้าเรียกไม่สำเร็จ คืน null — ให้ใช้ผลจาก getRecommendations (rule-based) แทน
   */
  getAIRecommendation: async (params: {
    trip: {
      estimated_weight_kg: number;
      estimated_volume_liter: number;
      store_count: number;
      item_count?: number;
      items_summary?: string;
      planned_date?: string;
      /** จำนวนพาเลทที่ระบบคำนวณ (จาก bin packing จัดรวมหลายชนิดได้) */
      estimated_pallets?: number;
      /** การจัดสรรพาเลทแต่ละใบ (จาก bin packing) — ส่งให้ AI แนะนำวิธีจัดเรียง/ซ้อนได้เฉพาะทาง */
      pallet_allocation?: Array<{
        pallet_index: number;
        items: Array<{
          product_id: string;
          product_name?: string | null;
          product_code?: string | null;
          quantity: number;
          weight_kg: number;
          volume_liter: number;
        }>;
        total_weight_kg?: number;
        total_volume_liter?: number;
      }>;
    };
    vehicles: Array<{
      vehicle_id: string;
      plate: string;
      max_weight_kg?: number | null;
      cargo_volume_liter?: number | null;
      branch?: string | null;
    }>;
    historical_context?: string;
    /** ข้อมูล pattern การจัดเรียงจากประวัติ (จาก getPackingPatternInsights) */
    packing_patterns?: string;
    /** โปรไฟล์การจัดเรียงสินค้าแต่ละตัวจากประวัติรถคันนี้ (จาก getProductPackingProfiles) */
    product_packing_profiles?: string;
    /** ร่างแผนจัดเรียงที่ระบบ rule-based คำนวณมาให้ (จาก computePackingPlan) */
    computed_packing_plan?: string;
  }): Promise<{
    suggested_vehicle_id: string | null;
    reasoning: string | null;
    packing_tips: string | null;
    error?: string;
  } | null> => {
    try {
      const { data, error } = await supabase.functions.invoke('ai-trip-recommendation', {
        body: {
          trip: params.trip,
          vehicles: params.vehicles,
          historical_context: params.historical_context,
          packing_patterns: params.packing_patterns,
          product_packing_profiles: params.product_packing_profiles,
          computed_packing_plan: params.computed_packing_plan,
        },
      });
      if (error) {
        console.warn('[vehicleRecommendationService] getAIRecommendation error:', error);
        return { suggested_vehicle_id: null, reasoning: null, packing_tips: null, error: error.message || 'เรียก AI ไม่สำเร็จ' };
      }
      const result = data as { suggested_vehicle_id?: string | null; reasoning?: string | null; packing_tips?: string | null; error?: string };
      return {
        suggested_vehicle_id: result?.suggested_vehicle_id ?? null,
        reasoning: result?.reasoning ?? null,
        packing_tips: result?.packing_tips ?? null,
        error: result?.error,
      };
    } catch (err) {
      console.warn('[vehicleRecommendationService] getAIRecommendation exception:', err);
      return { suggested_vehicle_id: null, reasoning: null, packing_tips: null, error: err instanceof Error ? err.message : 'เกิดข้อผิดพลาด' };
    }
  },

  recordFeedback: async (data: {
    input_hash: string;
    requested_products: any;
    requested_stores: any;
    planned_date: string;
    recommended_vehicle_id: string;
    recommended_trips: any;
    status: 'accepted' | 'rejected';
    confidence_score: number;
    reasoning: string;
    created_by?: string;
  }): Promise<void> => {
    try {
      const { error } = await supabase.from('ai_trip_recommendations').insert({
        input_hash: data.input_hash,
        requested_products: data.requested_products,
        requested_stores: data.requested_stores,
        planned_date: data.planned_date,
        recommended_trips: data.recommended_trips,
        confidence_score: data.confidence_score,
        reasoning: data.reasoning,
        status: data.status,
        accepted_at: data.status === 'accepted' ? new Date().toISOString() : null,
        accepted_by: data.status === 'accepted' ? data.created_by : null,
        rejected_at: data.status === 'rejected' ? new Date().toISOString() : null,
        rejected_by: data.status === 'rejected' ? data.created_by : null,
        created_by: data.created_by,
        ai_model_version: 'rule-based-v1',
      });

      if (error) {
        console.warn('[vehicleRecommendationService] recordFeedback error (non-blocking):', error);
      }
    } catch (err) {
      // Non-blocking: don't throw if feedback recording fails
      console.warn('[vehicleRecommendationService] recordFeedback exception:', err);
    }
  },
};

// ============================================================
// Data Fetching Helpers
// ============================================================

async function fetchVehicles(): Promise<VehicleRow[]> {
  const { data, error } = await supabase
    .from('vehicles')
    .select('id, plate, type, make, model, branch, max_weight_kg, cargo_volume_liter, cargo_length_cm, cargo_width_cm, cargo_height_cm, has_shelves, loading_constraints')
    .order('plate');

  if (error) {
    console.error('[vehicleRecommendation] fetchVehicles error:', error);
    return [];
  }
  return (data || []) as VehicleRow[];
}

interface LoadEstimate {
  totalWeightKg: number;
  totalVolumeLiter: number;
  totalItems: number;
  estimatedPallets: number;
  hasFragile: boolean;
  hasLiquid: boolean;
  hasTemperatureReq: boolean;
  tempRequirements: string[];
  productCategories: string[]; // Phase 2: หมวดสินค้าที่อยู่ในออเดอร์
}

async function estimateLoad(
  items: Array<{ product_id: string; quantity: number }>
): Promise<LoadEstimate> {
  const productIds = [...new Set(items.map((i) => i.product_id))];
  if (productIds.length === 0) {
    return { totalWeightKg: 0, totalVolumeLiter: 0, totalItems: 0, estimatedPallets: 0, hasFragile: false, hasLiquid: false, hasTemperatureReq: false, tempRequirements: [], productCategories: [] };
  }

  const { data: products, error } = await supabase
    .from('products')
    .select('id, product_name, weight_kg, volume_liter, is_fragile, is_liquid, requires_temperature, uses_pallet, category')
    .in('id', productIds);

  if (error) {
    console.error('[vehicleRecommendation] estimateLoad error:', error);
    return { totalWeightKg: 0, totalVolumeLiter: 0, totalItems: items.length, estimatedPallets: 0, hasFragile: false, hasLiquid: false, hasTemperatureReq: false, tempRequirements: [], productCategories: [] };
  }

  const productMap = new Map<string, any>();
  (products || []).forEach((p: any) => productMap.set(p.id, p));

  let totalWeightKg = 0;
  let totalVolumeLiter = 0;
  let totalItems = 0;
  let hasFragile = false;
  let hasLiquid = false;
  let hasTemperatureReq = false;
  const tempReqSet = new Set<string>();
  const categorySet = new Set<string>(); // Phase 2

  for (const item of items) {
    const product = productMap.get(item.product_id);
    totalItems += item.quantity;
    if (product) {
      totalWeightKg += (product.weight_kg || 0) * item.quantity;
      totalVolumeLiter += (product.volume_liter || 0) * item.quantity;
      if (product.is_fragile) hasFragile = true;
      if (product.is_liquid) hasLiquid = true;
      if (product.requires_temperature) {
        hasTemperatureReq = true;
        tempReqSet.add(product.requires_temperature);
      }
      if (product.category) categorySet.add(product.category); // Phase 2
    }
  }

  // ★ ใช้ logic เดียวกับ Packing Simulation (มาตรฐาน → ประวัติ → ประมาณ) สำหรับจำนวนพาเลท
  let estimatedPallets = 1;
  const byProduct = new Map<string, number>();
  for (const item of items) {
    byProduct.set(item.product_id, (byProduct.get(item.product_id) || 0) + item.quantity);
  }
  const planItems = Array.from(byProduct.entries())
    .map(([product_id, quantity]) => {
      const p = productMap.get(product_id);
      return p
        ? { product_id, product_name: p.product_name || product_id, quantity, weight_kg: (p.weight_kg || 0) * quantity }
        : null;
    })
    .filter((x): x is NonNullable<typeof x> => x != null);

  if (planItems.length > 0) {
    try {
      const summary = await tripMetricsService.computePackingPlanSummary({
        items: planItems,
        vehicleMaxPallets: null,
      });
      estimatedPallets = Math.max(1, summary.totalPallets);
      totalWeightKg = summary.totalWeightKg; // ใช้น้ำหนักจากแผนจัดเรียง (สอดคล้องกับพาเลท)
    } catch (err) {
      console.warn('[vehicleRecommendation] computePackingPlanSummary error, using fallback', err);
      const PALLET_MAX_KG = 800;
      const PALLET_MAX_LITER = 960;
      const palletsByWeight = totalWeightKg > 0 ? Math.ceil(totalWeightKg / PALLET_MAX_KG) : 0;
      const palletsByVolume = totalVolumeLiter > 0 ? Math.ceil(totalVolumeLiter / PALLET_MAX_LITER) : 0;
      estimatedPallets = Math.max(palletsByWeight, palletsByVolume, 1);
    }
  } else {
    const PALLET_MAX_KG = 800;
    const PALLET_MAX_LITER = 960;
    const palletsByWeight = totalWeightKg > 0 ? Math.ceil(totalWeightKg / PALLET_MAX_KG) : 0;
    const palletsByVolume = totalVolumeLiter > 0 ? Math.ceil(totalVolumeLiter / PALLET_MAX_LITER) : 0;
    estimatedPallets = Math.max(palletsByWeight, palletsByVolume, 1);
  }

  return {
    totalWeightKg,
    totalVolumeLiter,
    totalItems,
    estimatedPallets,
    hasFragile,
    hasLiquid,
    hasTemperatureReq,
    tempRequirements: Array.from(tempReqSet),
    productCategories: Array.from(categorySet),
  };
}

async function getBusyVehicles(plannedDate: string): Promise<Map<string, number>> {
  const { data, error } = await supabase
    .from('delivery_trips')
    .select('vehicle_id')
    .eq('planned_date', plannedDate)
    .in('status', ['planned', 'in_progress']);

  if (error) {
    console.error('[vehicleRecommendation] getBusyVehicles error:', error);
    return new Map();
  }

  const countByVehicle = new Map<string, number>();
  for (const t of data || []) {
    const vid = (t as any).vehicle_id;
    countByVehicle.set(vid, (countByVehicle.get(vid) || 0) + 1);
  }
  return countByVehicle;
}

async function getHistoricalStats(): Promise<HistoricalTripStats[]> {
  // Get completed trips from last 90 days
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
  const fromDate = ninetyDaysAgo.toISOString().split('T')[0];

  const { data: trips, error } = await supabase
    .from('delivery_trips')
    .select(`
      id,
      vehicle_id,
      planned_date,
      space_utilization_percent,
      actual_weight_kg,
      had_packing_issues,
      packing_efficiency_score,
      delivery_trip_stores (store_id, stores:store_id (address)),
      delivery_trip_items (products:product_id (category))
    `)
    .eq('status', 'completed')
    .gte('planned_date', fromDate);

  if (error) {
    console.error('[vehicleRecommendation] getHistoricalStats error:', error);
    return [];
  }

  const refDate = new Date().toISOString().split('T')[0];

  const statsMap = new Map<string, HistoricalTripStats>();

  for (const trip of (trips || [])) {
    const vid = trip.vehicle_id;
    const storeEntries = (trip as any).delivery_trip_stores || [];
    const storeIds = storeEntries.map((s: any) => s.store_id);
    // Phase 2: parse district from store address
    const districtKeys: string[] = [];
    for (const se of storeEntries) {
      const addr = se.stores?.address;
      if (addr) {
        const parsed = parseThaiAddress(addr);
        if (parsed.district) districtKeys.push(`อ.${parsed.district}`);
      }
    }
    // Phase 2: product categories
    const itemEntries = (trip as any).delivery_trip_items || [];
    const prodCats: string[] = [];
    for (const ie of itemEntries) {
      const cat = ie.products?.category;
      if (cat) prodCats.push(cat);
    }
    const util = trip.space_utilization_percent ?? null;
    const weight = trip.actual_weight_kg ?? null;
    const packScore = (trip as any).packing_efficiency_score ?? null;

    const record: TripRecord = {
      planned_date: trip.planned_date || refDate,
      store_ids: storeIds,
      district_keys: [...new Set(districtKeys)],
      product_categories: [...new Set(prodCats)],
      actual_weight_kg: weight,
      utilization: util,
      packing_score: packScore,
      had_issues: Boolean(trip.had_packing_issues),
    };

    if (!statsMap.has(vid)) {
      statsMap.set(vid, {
        vehicle_id: vid,
        completed_trips: 0,
        trips: [],
        avg_utilization: null,
        avg_weight_kg: null,
        issue_count: 0,
        store_ids_served: [],
        district_keys_served: [],
        product_categories_served: [],
        weight_range: null,
        packing_score_avg: null,
      });
    }

    const stat = statsMap.get(vid)!;
    stat.completed_trips += 1;
    stat.trips.push(record);
    if (record.had_issues) stat.issue_count += 1;
    stat.store_ids_served.push(...storeIds);
    stat.district_keys_served.push(...record.district_keys);
    stat.product_categories_served.push(...record.product_categories);

    if (weight !== null) {
      if (!stat.weight_range) stat.weight_range = { min: weight, max: weight };
      else {
        stat.weight_range.min = Math.min(stat.weight_range.min, weight);
        stat.weight_range.max = Math.max(stat.weight_range.max, weight);
      }
    }
  }

  for (const stat of statsMap.values()) {
    if (stat.trips.length > 0) {
      // Weighted average utilization (time-decay)
      let sumW = 0;
      let sumUW = 0;
      for (const t of stat.trips) {
        if (t.utilization !== null) {
          const w = getDecayWeight(t.planned_date, refDate);
          sumUW += t.utilization * w;
          sumW += w;
        }
      }
      stat.avg_utilization = sumW > 0 ? sumUW / sumW : null;

      // Weighted average weight (time-decay)
      let sumWW = 0;
      let sumWWt = 0;
      for (const t of stat.trips) {
        if (t.actual_weight_kg !== null) {
          const w = getDecayWeight(t.planned_date, refDate);
          sumWW += t.actual_weight_kg * w;
          sumWWt += w;
        }
      }
      stat.avg_weight_kg = sumWWt > 0 ? sumWW / sumWWt : null;

      // Weighted average packing score (time-decay)
      let sumPW = 0;
      let sumPWt = 0;
      for (const t of stat.trips) {
        if (t.packing_score !== null) {
          const w = getDecayWeight(t.planned_date, refDate);
          sumPW += t.packing_score * w;
          sumPWt += w;
        }
      }
      stat.packing_score_avg = sumPWt > 0 ? sumPW / sumPWt : null;
    }
  }

  return Array.from(statsMap.values());
}

// ============================================================
// Cache Layer: getHistoricalStatsCached (TTL 5 นาที)
// ============================================================

let _historicalStatsCache: { data: HistoricalTripStats[]; ts: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function getHistoricalStatsCached(): Promise<HistoricalTripStats[]> {
  const now = Date.now();
  if (_historicalStatsCache && (now - _historicalStatsCache.ts) < CACHE_TTL) {
    return _historicalStatsCache.data;
  }
  const data = await getHistoricalStats();
  _historicalStatsCache = { data, ts: now };
  return data;
}

// ============================================================
// Phase 2: District helpers
// ============================================================

/** ดึง district key ของร้านใน order ปัจจุบัน — ใช้ parseThaiAddress parse จาก address */
async function getStoreDistrictKeys(storeIds: string[]): Promise<string[]> {
  if (storeIds.length === 0) return [];
  const { data, error } = await supabase
    .from('stores')
    .select('id, address')
    .in('id', storeIds);
  if (error || !data) return [];

  const keys = new Set<string>();
  for (const store of data) {
    const addr = (store as any).address;
    if (addr) {
      const parsed = parseThaiAddress(addr);
      if (parsed.district) keys.add(`อ.${parsed.district}`);
    }
  }
  return Array.from(keys);
}

// ============================================================
// Phase 2: New Scoring Functions
// ============================================================

/** ★ Phase 2D: รถเคยส่งในอำเภอเดียวกันกับออเดอร์ปัจจุบันหรือไม่ */
function scoreDistrictFamiliarity(
  vehicleId: string,
  targetDistrictKeys: string[],
  stats: HistoricalTripStats[]
): number {
  if (targetDistrictKeys.length === 0) return 50; // ไม่มีข้อมูล district

  const vehicleStat = stats.find((s) => s.vehicle_id === vehicleId);
  if (!vehicleStat || vehicleStat.district_keys_served.length === 0) return 40; // ไม่มีประวัติ

  const servedSet = new Set(vehicleStat.district_keys_served);
  const matchCount = targetDistrictKeys.filter((dk) => servedSet.has(dk)).length;
  const matchRate = matchCount / targetDistrictKeys.length;

  if (matchRate >= 0.7) return 100;
  if (matchRate >= 0.3) return 75;
  if (matchRate > 0) return 55;
  return 40;
}

/** ★ Phase 2E: หมวดสินค้าในออเดอร์ตรงกับที่รถเคยส่งหรือไม่ */
function scoreCategoryMatch(
  vehicleId: string,
  targetCategories: string[],
  stats: HistoricalTripStats[]
): number {
  if (targetCategories.length === 0) return 50; // ไม่มีข้อมูลหมวดสินค้า

  const vehicleStat = stats.find((s) => s.vehicle_id === vehicleId);
  if (!vehicleStat || vehicleStat.product_categories_served.length === 0) return 40; // ไม่มีประวัติ

  const servedSet = new Set(vehicleStat.product_categories_served);
  const matchCount = targetCategories.filter((cat) => servedSet.has(cat)).length;
  const matchRate = matchCount / targetCategories.length;

  if (matchRate >= 0.8) return 100;
  if (matchRate >= 0.5) return 80;
  if (matchRate > 0) return 60;
  return 40;
}

// ============================================================
// Scoring Functions (0-100 each)
// ============================================================

function scoreCapacityFit(
  vehicle: VehicleRow,
  load: { totalWeightKg: number; totalVolumeLiter: number; totalItems: number }
): number {
  // If no capacity data at all, give a neutral score
  if (!vehicle.max_weight_kg && !vehicle.cargo_volume_liter) {
    return 50;
  }

  let weightScore = 100;
  let volumeScore = 100;
  let hasWeightData = false;
  let hasVolumeData = false;

  // Weight scoring
  if (vehicle.max_weight_kg && load.totalWeightKg > 0) {
    hasWeightData = true;
    const utilization = load.totalWeightKg / vehicle.max_weight_kg;

    if (utilization > 1.0) {
      // Overloaded: heavily penalize
      weightScore = Math.max(0, 100 - (utilization - 1.0) * 200);
    } else if (utilization >= 0.5 && utilization <= 0.9) {
      // Sweet spot: 50-90% utilization is ideal
      weightScore = 100;
    } else if (utilization < 0.5) {
      // Underutilized: mild penalty (vehicle too large for this load)
      weightScore = 60 + utilization * 80; // 60-100 range
    } else {
      // 90-100%: slightly penalize (tight fit)
      weightScore = 100 - (utilization - 0.9) * 100; // 90-100
    }
  }

  // Volume scoring (similar logic)
  if (vehicle.cargo_volume_liter && load.totalVolumeLiter > 0) {
    hasVolumeData = true;
    const utilization = load.totalVolumeLiter / vehicle.cargo_volume_liter;

    if (utilization > 1.0) {
      volumeScore = Math.max(0, 100 - (utilization - 1.0) * 200);
    } else if (utilization >= 0.4 && utilization <= 0.85) {
      volumeScore = 100;
    } else if (utilization < 0.4) {
      volumeScore = 60 + utilization * 100;
    } else {
      volumeScore = 100 - (utilization - 0.85) * 150;
    }
  }

  // Combine: use whichever metric is available
  if (hasWeightData && hasVolumeData) {
    return Math.round(Math.min(weightScore, volumeScore));
  } else if (hasWeightData) {
    return Math.round(weightScore);
  } else if (hasVolumeData) {
    return Math.round(volumeScore);
  }

  return 50; // No data to compare
}

function scoreHistoricalSuccess(
  vehicleId: string,
  stats: HistoricalTripStats[],
  load: { totalWeightKg: number }
): number {
  const vehicleStat = stats.find((s) => s.vehicle_id === vehicleId);
  if (!vehicleStat || vehicleStat.completed_trips === 0) {
    return 50; // No history: neutral score
  }

  let score = 50; // Base

  // Bonus for many completed trips (experienced vehicle)
  const tripBonus = Math.min(20, vehicleStat.completed_trips * 2);
  score += tripBonus;

  // Bonus for good utilization
  if (vehicleStat.avg_utilization !== null) {
    if (vehicleStat.avg_utilization >= 50 && vehicleStat.avg_utilization <= 90) {
      score += 20; // Good utilization range
    } else if (vehicleStat.avg_utilization > 90) {
      score += 10; // Often fully loaded (might be tight)
    }
  }

  // Bonus for good packing score
  if (vehicleStat.packing_score_avg !== null) {
    if (vehicleStat.packing_score_avg >= 80) {
      score += 10;
    } else if (vehicleStat.packing_score_avg >= 60) {
      score += 5;
    }
  }

  // Penalty for packing issues
  const issueRate = vehicleStat.issue_count / vehicleStat.completed_trips;
  if (issueRate > 0.3) {
    score -= 20;
  } else if (issueRate > 0.1) {
    score -= 10;
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

// ★ เทียบน้ำหนักทริปปัจจุบันกับประวัติ — ใช้เฉพาะทริปที่ overlap ≥ 50% กับร้านปลายทาง
function scoreLoadSimilarity(
  vehicleId: string,
  stats: HistoricalTripStats[],
  load: LoadEstimate,
  targetStoreIds: string[]
): number {
  const vehicleStat = stats.find((s) => s.vehicle_id === vehicleId);
  if (!vehicleStat || !vehicleStat.trips.length || load.totalWeightKg <= 0) {
    return 50; // No data: neutral
  }

  const refDate = new Date().toISOString().split('T')[0];
  const similar = vehicleStat.trips.filter((t) => hasStoreOverlap(t.store_ids, targetStoreIds));
  if (similar.length === 0) return 50; // No similar trips

  let sumW = 0;
  let sumWW = 0;
  for (const t of similar) {
    if (t.actual_weight_kg !== null) {
      const w = getDecayWeight(t.planned_date, refDate);
      sumWW += t.actual_weight_kg * w;
      sumW += w;
    }
  }
  const avgWeight = sumW > 0 ? sumWW / sumW : null;
  if (avgWeight === null) return 50;

  const diff = Math.abs(load.totalWeightKg - avgWeight);
  const diffPct = diff / avgWeight;

  // ±15% → 100, ±30% → 85, ±50% → 65, ±80% → 40, >80% → 25
  if (diffPct <= 0.15) return 100;
  if (diffPct <= 0.30) return 85;
  if (diffPct <= 0.50) return 65;
  if (diffPct <= 0.80) return 40;
  return 25;
}

// ★ NEW: เช็คคุณสมบัติสินค้า vs ข้อจำกัดรถ
function scoreProductCompatibility(
  vehicle: VehicleRow,
  load: LoadEstimate
): number {
  let score = 80; // Base: assume compatible
  const constraints = vehicle.loading_constraints || {};

  // Temperature: สินค้าต้องคุมอุณหภูมิ แต่รถไม่มีตู้เย็น → penalty หนัก
  if (load.hasTemperatureReq) {
    if (constraints.has_temperature_control) {
      score += 20; // Perfect match
    } else {
      score -= 50; // Severe penalty
    }
  }

  // Fragile: สินค้าเปราะบาง → รถที่มีชั้นวางได้โบนัส
  if (load.hasFragile) {
    if (vehicle.has_shelves) {
      score += 10;
    } else {
      score -= 10;
    }
  }

  // Liquid: ไม่ penalty แต่ถ้ามี constraint ที่ห้ามก็ลด
  if (load.hasLiquid && constraints.no_liquid) {
    score -= 30;
  }

  return Math.max(0, Math.min(100, score));
}

/** คืนค่าจำนวนพาเลทสูงสุดที่รถรับได้ — ใช้ loading_constraints.max_pallets ก่อน แล้วค่อยประเมินจากขนาด */
function getVehicleMaxPallets(vehicle: VehicleRow): number | null {
  const config =
    vehicle.loading_constraints != null &&
      typeof vehicle.loading_constraints === 'object' &&
      typeof (vehicle.loading_constraints as any).max_pallets === 'number'
      ? (vehicle.loading_constraints as any).max_pallets
      : null;
  if (config != null && config > 0) return config;
  if (vehicle.cargo_length_cm && vehicle.cargo_width_cm) {
    const lengthAligned = Math.floor(vehicle.cargo_length_cm / 120) * Math.floor(vehicle.cargo_width_cm / 100);
    const widthAligned = Math.floor(vehicle.cargo_length_cm / 100) * Math.floor(vehicle.cargo_width_cm / 120);
    return Math.max(lengthAligned, widthAligned) || null;
  }
  if (vehicle.cargo_volume_liter) return Math.floor(vehicle.cargo_volume_liter / 960) || null;
  return null;
}

// ★ จำนวนพาเลทที่ต้องการ vs ที่รถรับได้ — ใช้ loading_constraints.max_pallets เป็นหลัก (ข้อมูลที่ลงไว้แล้ว)
function scorePalletEfficiency(
  vehicle: VehicleRow,
  load: LoadEstimate
): number {
  if (load.estimatedPallets <= 0) return 80; // ไม่มีข้อมูลพาเลท

  const maxPallets = getVehicleMaxPallets(vehicle);
  if (maxPallets == null || maxPallets <= 0) return 50; // ไม่สามารถประเมินได้

  // รถใส่พาเลทไม่พอ → ตัดออกจากคำแนะนำ (คะแนน 0)
  if (load.estimatedPallets > maxPallets) {
    return 0;
  }

  // พอดีหรือเหลือ → แนะนำรถที่ใส่ได้พอ หรือใกล้เคียง (ไม่เอาคันใหญ่เกินไปเป็นอันดับต้น)
  const ratio = load.estimatedPallets / maxPallets;
  if (ratio >= 0.6 && ratio <= 1) return 100; // ใช้ 60–100% → เหมาะสมมาก
  if (ratio >= 0.3) return 85; // ใช้ 30–60% → โอเค
  if (ratio > 0) return 70; // ใช้น้อยมาก → รถใหญ่ไปแต่ยังใช้ได้
  return 60;
}

function scoreAvailability(vehicleId: string, busyTripCount: Map<string, number>): number {
  const count = busyTripCount.get(vehicleId) ?? 0;
  if (count === 0) return 100;
  if (count === 1) return 50;
  return 10; // 2+
}

function scoreBranchMatch(vehicleBranch: string | null, orderBranch?: string): number {
  if (!orderBranch || orderBranch === 'ALL') return 80;
  if (!vehicleBranch) return 50;
  return vehicleBranch === orderBranch ? 100 : 30;
}

function scoreStoreFamiliarity(
  vehicleId: string,
  targetStoreIds: string[],
  stats: HistoricalTripStats[]
): number {
  if (targetStoreIds.length === 0) return 50;

  const vehicleStat = stats.find((s) => s.vehicle_id === vehicleId);
  if (!vehicleStat || vehicleStat.store_ids_served.length === 0) {
    return 50; // No history
  }

  const servedSet = new Set(vehicleStat.store_ids_served);
  const matchCount = targetStoreIds.filter((sid) => servedSet.has(sid)).length;
  const matchRate = matchCount / targetStoreIds.length;

  return Math.round(50 + matchRate * 50); // 50-100 range
}

// ============================================================
// Helpers
// ============================================================

function determineConfidence(
  stats: HistoricalTripStats[],
  vehicleId: string
): 'high' | 'medium' | 'low' {
  const vehicleStat = stats.find((s) => s.vehicle_id === vehicleId);
  const totalTrips = stats.reduce((sum, s) => sum + s.completed_trips, 0);

  if (totalTrips >= 50 && vehicleStat && vehicleStat.completed_trips >= 10) {
    return 'high';
  }
  if (totalTrips >= 10) {
    return 'medium';
  }
  return 'low';
}

function getVehicleHistoricalSummary(
  vehicleId: string,
  stats: HistoricalTripStats[],
  targetStoreIds: string[] = []
): VehicleRecommendation['historical_stats'] {
  const vehicleStat = stats.find((s) => s.vehicle_id === vehicleId);
  if (!vehicleStat) {
    return { similar_trips_count: 0, avg_utilization: null, success_rate: null };
  }

  const similarCount =
    targetStoreIds.length > 0
      ? vehicleStat.trips.filter((t) => hasStoreOverlap(t.store_ids, targetStoreIds)).length
      : vehicleStat.completed_trips;

  const successRate =
    vehicleStat.completed_trips > 0
      ? ((vehicleStat.completed_trips - vehicleStat.issue_count) / vehicleStat.completed_trips) * 100
      : null;

  return {
    similar_trips_count: similarCount,
    avg_utilization: vehicleStat.avg_utilization !== null ? Math.round(vehicleStat.avg_utilization) : null,
    success_rate: successRate !== null ? Math.round(successRate) : null,
  };
}

function generateReasoning(
  scores: VehicleRecommendation['scores'],
  vehicle: VehicleRow,
  load: LoadEstimate,
  confidence: 'high' | 'medium' | 'low',
  tripCountToday: number = 0
): string {
  const parts: string[] = [];

  // ★ นำด้วยประวัติทริป (ความตั้งใจ: ให้ความสำคัญกับข้อมูลที่เคยวิ่งมาแล้ว)
  if (scores.store_familiarity >= 80) {
    parts.push('เคยส่งร้านเหล่านี้มาก่อน');
  }
  if (scores.load_similarity >= 85) {
    parts.push('น้ำหนักใกล้เคียงทริปเก่าที่เคยส่งสำเร็จ');
  } else if (scores.load_similarity <= 40) {
    parts.push('น้ำหนักต่างจากที่เคยส่ง');
  }
  if (scores.historical_success >= 80) {
    parts.push('มีประวัติทริปสำเร็จดี');
  } else if (scores.historical_success <= 40) {
    parts.push('ประวัติทริปน้อย');
  }
  if (scores.branch_match >= 80) {
    parts.push('ตรงสาขา');
  }

  // ความจุ/พาเลท
  if (vehicle.max_weight_kg && load.totalWeightKg > 0) {
    const pct = Math.round((load.totalWeightKg / vehicle.max_weight_kg) * 100);
    if (pct > 100) {
      parts.push(`⚠️ น้ำหนักเกินพิกัด (${pct}%)`);
    } else if (pct >= 50) {
      parts.push(`ใช้ความจุน้ำหนัก ${pct}%`);
    } else if (pct < 30) {
      parts.push(`ใช้ความจุ ${pct}%`);
    }
  }
  if (scores.pallet_efficiency < 50 && load.estimatedPallets > 0) {
    parts.push(`⚠️ ต้องการ ${load.estimatedPallets} พาเลท อาจไม่พอ`);
  } else if (scores.pallet_efficiency >= 80 && load.estimatedPallets > 0) {
    parts.push(`รับ ${load.estimatedPallets} พาเลทได้`);
  }

  // สินค้า/ความพร้อม
  if (scores.product_compatibility < 50) {
    if (load.hasTemperatureReq) parts.push('🌡️ สินค้าต้องคุมอุณหภูมิ');
    if (load.hasFragile) parts.push('⚠️ มีสินค้าเปราะบาง');
  }
  if (scores.availability < 50) {
    parts.push(tripCountToday > 0 ? `⚠️ มีทริป ${tripCountToday} เที่ยวในวันนี้` : '⚠️ รถมีทริปอื่นในวันนี้');
  }
  // Phase 2: district + category
  if (scores.district_familiarity >= 75) {
    parts.push('📍 คุ้นเคยพื้นที่อำเภอนี้');
  } else if (scores.district_familiarity <= 40) {
    parts.push('ไม่เคยส่งพื้นที่นี้');
  }
  if (scores.category_match >= 80) {
    parts.push('📦 สินค้าตรงหมวดที่เคยส่ง');
  }

  if (parts.length === 0) {
    parts.push('คะแนนรวมปานกลาง');
  }

  return parts.join(' · ');
}

/**
 * Generate a simple hash for recommendation input (for deduplication)
 */
export function hashRecommendationInput(input: RecommendationInput): string {
  const key = JSON.stringify({
    stores: input.store_ids.sort(),
    items: input.items
      .map((i) => `${i.product_id}:${i.quantity}`)
      .sort(),
    date: input.planned_date,
    branch: input.branch || '',
  });
  // Simple hash
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    const char = key.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return `rbv1_${Math.abs(hash).toString(36)}`;
}
