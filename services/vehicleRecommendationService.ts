// Vehicle Recommendation Service - AI-powered vehicle suggestions for trip planning
// Phase 1: Rule-based scoring algorithm using historical trip data
import { supabase } from '../lib/supabase';
import { tripMetricsService } from './tripMetricsService';

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
    load_similarity: number; // 0-100 ★ NEW: น้ำหนักทริปใกล้เคียงประวัติรถ
    product_compatibility: number; // 0-100 ★ NEW: สินค้า fragile/liquid/temp vs รถ
    pallet_efficiency: number; // 0-100 ★ NEW: จำนวนพาเลท vs พื้นที่รถ
    historical_success: number; // 0-100
    availability: number; // 0-100
    branch_match: number; // 0-100
    store_familiarity: number; // 0-100
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

interface HistoricalTripStats {
  vehicle_id: string;
  completed_trips: number;
  avg_utilization: number | null;
  avg_weight_kg: number | null;
  issue_count: number;
  store_ids_served: string[];
  weight_range: { min: number; max: number } | null;
  packing_score_avg: number | null;
}

// ============================================================
// Scoring Weights (configurable)
// ============================================================

const WEIGHTS = {
  capacity_fit: 0.25,
  load_similarity: 0.15,
  product_compatibility: 0.10,
  pallet_efficiency: 0.10,
  historical_success: 0.15,
  availability: 0.15,
  branch_match: 0.05,
  store_familiarity: 0.05,
};

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
      // 1. Fetch all active vehicles
      const vehicles = await fetchVehicles();
      if (vehicles.length === 0) return [];

      // 2. Estimate total load from items (enhanced: includes pallets + product properties)
      const loadEstimate = await estimateLoad(input.items);

      // 3. Check vehicle availability on planned date
      const busyVehicleIds = await getBusyVehicles(input.planned_date);

      // 4. Fetch historical trip data (last 90 days)
      const historicalStats = await getHistoricalStats();

      // 5. Score each vehicle (8 dimensions)
      const scored = vehicles.map((vehicle) => {
        const scores = {
          capacity_fit: scoreCapacityFit(vehicle, loadEstimate),
          load_similarity: scoreLoadSimilarity(vehicle.id, historicalStats, loadEstimate),
          product_compatibility: scoreProductCompatibility(vehicle, loadEstimate),
          pallet_efficiency: scorePalletEfficiency(vehicle, loadEstimate),
          historical_success: scoreHistoricalSuccess(vehicle.id, historicalStats, loadEstimate),
          availability: scoreAvailability(vehicle.id, busyVehicleIds),
          branch_match: scoreBranchMatch(vehicle.branch, input.branch),
          store_familiarity: scoreStoreFamiliarity(vehicle.id, input.store_ids, historicalStats),
        };

        const overall_raw = Math.round(
          scores.capacity_fit * WEIGHTS.capacity_fit +
          scores.load_similarity * WEIGHTS.load_similarity +
          scores.product_compatibility * WEIGHTS.product_compatibility +
          scores.pallet_efficiency * WEIGHTS.pallet_efficiency +
          scores.historical_success * WEIGHTS.historical_success +
          scores.availability * WEIGHTS.availability +
          scores.branch_match * WEIGHTS.branch_match +
          scores.store_familiarity * WEIGHTS.store_familiarity
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
        const reasoning = generateReasoning(scores, vehicle, loadEstimate, confidence);

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
          historical_stats: getVehicleHistoricalSummary(vehicle.id, historicalStats),
          reasoning,
          confidence,
        } as VehicleRecommendation;
      });

      // 6. Sort by score descending; กรองรถที่น้ำหนักไม่พอ หรือใส่พาเลทไม่พอ
      const filtered = scored
        .filter((r) => r.scores.capacity_fit > 0) // น้ำหนัก/ปริมาตรเกินพิกัด → ตัดออก
        .filter((r) => r.scores.pallet_efficiency > 0) // ใส่พาเลทไม่พอ (ต้องการมากกว่าที่รถรับได้) → ตัดออก
        .sort((a, b) => b.overall_score - a.overall_score)
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
}

async function estimateLoad(
  items: Array<{ product_id: string; quantity: number }>
): Promise<LoadEstimate> {
  const productIds = [...new Set(items.map((i) => i.product_id))];
  if (productIds.length === 0) {
    return { totalWeightKg: 0, totalVolumeLiter: 0, totalItems: 0, estimatedPallets: 0, hasFragile: false, hasLiquid: false, hasTemperatureReq: false, tempRequirements: [] };
  }

  const { data: products, error } = await supabase
    .from('products')
    .select('id, product_name, weight_kg, volume_liter, is_fragile, is_liquid, requires_temperature, uses_pallet')
    .in('id', productIds);

  if (error) {
    console.error('[vehicleRecommendation] estimateLoad error:', error);
    return { totalWeightKg: 0, totalVolumeLiter: 0, totalItems: items.length, estimatedPallets: 0, hasFragile: false, hasLiquid: false, hasTemperatureReq: false, tempRequirements: [] };
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
  };
}

async function getBusyVehicles(plannedDate: string): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('delivery_trips')
    .select('vehicle_id')
    .eq('planned_date', plannedDate)
    .in('status', ['planned', 'in_progress']);

  if (error) {
    console.error('[vehicleRecommendation] getBusyVehicles error:', error);
    return new Set();
  }

  return new Set((data || []).map((t: any) => t.vehicle_id));
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
      space_utilization_percent,
      actual_weight_kg,
      had_packing_issues,
      packing_efficiency_score,
      delivery_trip_stores (store_id)
    `)
    .eq('status', 'completed')
    .gte('planned_date', fromDate);

  if (error) {
    console.error('[vehicleRecommendation] getHistoricalStats error:', error);
    return [];
  }

  // Aggregate by vehicle
  const statsMap = new Map<string, HistoricalTripStats>();

  for (const trip of (trips || [])) {
    const vid = trip.vehicle_id;
    if (!statsMap.has(vid)) {
      statsMap.set(vid, {
        vehicle_id: vid,
        completed_trips: 0,
        avg_utilization: null,
        avg_weight_kg: null,
        issue_count: 0,
        store_ids_served: [],
        weight_range: null,
        packing_score_avg: null,
      });
    }

    const stat = statsMap.get(vid)!;
    stat.completed_trips += 1;

    if (trip.had_packing_issues) {
      stat.issue_count += 1;
    }

    // Collect utilization values for averaging
    if (trip.space_utilization_percent !== null && trip.space_utilization_percent !== undefined) {
      const prevTotal = (stat.avg_utilization ?? 0) * (stat.completed_trips - 1);
      stat.avg_utilization = (prevTotal + trip.space_utilization_percent) / stat.completed_trips;
    }

    if (trip.actual_weight_kg !== null && trip.actual_weight_kg !== undefined) {
      const prevTotal = (stat.avg_weight_kg ?? 0) * (stat.completed_trips - 1);
      stat.avg_weight_kg = (prevTotal + trip.actual_weight_kg) / stat.completed_trips;
      // Track weight range
      if (!stat.weight_range) {
        stat.weight_range = { min: trip.actual_weight_kg, max: trip.actual_weight_kg };
      } else {
        stat.weight_range.min = Math.min(stat.weight_range.min, trip.actual_weight_kg);
        stat.weight_range.max = Math.max(stat.weight_range.max, trip.actual_weight_kg);
      }
    }

    // Track packing score
    const packScore = (trip as any).packing_efficiency_score;
    if (packScore !== null && packScore !== undefined) {
      const prevPackTotal = (stat.packing_score_avg ?? 0) * (stat.completed_trips - 1);
      stat.packing_score_avg = (prevPackTotal + packScore) / stat.completed_trips;
    }

    // Collect store IDs served
    const storeIds = (trip.delivery_trip_stores || []).map((s: any) => s.store_id);
    stat.store_ids_served.push(...storeIds);
  }

  return Array.from(statsMap.values());
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

// ★ NEW: เทียบน้ำหนักทริปปัจจุบันกับประวัติน้ำหนักของรถคันนี้
function scoreLoadSimilarity(
  vehicleId: string,
  stats: HistoricalTripStats[],
  load: LoadEstimate
): number {
  const vehicleStat = stats.find((s) => s.vehicle_id === vehicleId);
  if (!vehicleStat || vehicleStat.avg_weight_kg === null || load.totalWeightKg <= 0) {
    return 50; // No data: neutral
  }

  const avgWeight = vehicleStat.avg_weight_kg;
  const diff = Math.abs(load.totalWeightKg - avgWeight);
  const diffPct = diff / avgWeight;

  // ±15% → 100, ±30% → 75, ±50% → 50, >80% → 25
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

function scoreAvailability(vehicleId: string, busyVehicleIds: Set<string>): number {
  return busyVehicleIds.has(vehicleId) ? 10 : 100;
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
  stats: HistoricalTripStats[]
): VehicleRecommendation['historical_stats'] {
  const vehicleStat = stats.find((s) => s.vehicle_id === vehicleId);
  if (!vehicleStat) {
    return { similar_trips_count: 0, avg_utilization: null, success_rate: null };
  }

  const successRate =
    vehicleStat.completed_trips > 0
      ? ((vehicleStat.completed_trips - vehicleStat.issue_count) / vehicleStat.completed_trips) * 100
      : null;

  return {
    similar_trips_count: vehicleStat.completed_trips,
    avg_utilization: vehicleStat.avg_utilization !== null ? Math.round(vehicleStat.avg_utilization) : null,
    success_rate: successRate !== null ? Math.round(successRate) : null,
  };
}

function generateReasoning(
  scores: VehicleRecommendation['scores'],
  vehicle: VehicleRow,
  load: LoadEstimate,
  confidence: 'high' | 'medium' | 'low'
): string {
  const parts: string[] = [];

  // Capacity — แสดง % utilization จริง
  if (vehicle.max_weight_kg && load.totalWeightKg > 0) {
    const pct = Math.round((load.totalWeightKg / vehicle.max_weight_kg) * 100);
    if (pct > 100) {
      parts.push(`⚠️ น้ำหนักเกินพิกัด (${pct}%)`);
    } else if (pct >= 50) {
      parts.push(`ใช้ความจุน้ำหนัก ${pct}%`);
    } else {
      parts.push(`ใช้ความจุแค่ ${pct}% (รถอาจใหญ่เกินไป)`);
    }
  }

  // Pallet efficiency
  if (scores.pallet_efficiency < 50 && load.estimatedPallets > 0) {
    parts.push(`⚠️ ต้องการ ${load.estimatedPallets} พาเลท อาจไม่พอ`);
  } else if (scores.pallet_efficiency >= 80 && load.estimatedPallets > 0) {
    parts.push(`รับ ${load.estimatedPallets} พาเลทได้สบาย`);
  }

  // Load similarity
  if (scores.load_similarity >= 85) {
    parts.push('น้ำหนักใกล้เคียงทริปเก่าที่เคยส่งสำเร็จ');
  } else if (scores.load_similarity <= 40) {
    parts.push('น้ำหนักต่างจากที่เคยส่ง');
  }

  // Product compatibility warnings
  if (scores.product_compatibility < 50) {
    if (load.hasTemperatureReq) {
      parts.push(`🌡️ สินค้าต้องคุมอุณหภูมิ (${load.tempRequirements.join(', ')}) แต่รถอาจไม่มีตู้เย็น`);
    }
    if (load.hasFragile) {
      parts.push('⚠️ มีสินค้าเปราะบางแต่รถไม่มีชั้นวาง');
    }
  } else if (scores.product_compatibility >= 90) {
    if (load.hasTemperatureReq) {
      parts.push('✅ รถมีตู้เย็นรองรับสินค้าคุมอุณหภูมิ');
    }
  }

  // Availability
  if (scores.availability < 50) {
    parts.push('⚠️ รถมีทริปอื่นในวันเดียวกัน');
  }

  // History
  if (scores.historical_success >= 80) {
    parts.push('มีประวัติใช้งานดี');
  } else if (scores.historical_success <= 40) {
    parts.push('ประวัติใช้งานน้อย');
  }

  // Branch
  if (scores.branch_match >= 80) {
    parts.push('ตรงสาขา');
  }

  // Store familiarity
  if (scores.store_familiarity >= 80) {
    parts.push('เคยส่งร้านเหล่านี้มาก่อน');
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
