// Trip Metrics Service - บันทึกและดึงข้อมูล metrics หลังจบทริป (AI Trip Optimization)
import { supabase } from '../lib/supabase';
import type { Database } from '../types/database';

type ProductRow = Database['public']['Tables']['products']['Row'];

export interface TripMetrics {
  actual_pallets_used?: number | null;
  actual_weight_kg?: number | null;
  space_utilization_percent?: number | null;
  packing_efficiency_score?: number | null;
  had_packing_issues?: boolean | null;
  packing_issues_notes?: string | null;
  actual_distance_km?: number | null;
  actual_duration_hours?: number | null;
}

export interface TripPackingSnapshotInsert {
  delivery_trip_id: string;
  vehicle_id: string;
  packing_layout: Record<string, unknown>;
  pallets_used: number;
  weight_kg: number;
  volume_used_liter: number;
  utilization_percent: number;
  notes?: string | null;
}

export interface AggregatedMetricsFilters {
  planned_date_from?: string;
  planned_date_to?: string;
  vehicle_id?: string;
  driver_id?: string;
  status?: string[];
}

export interface AggregatedMetricsResult {
  trip_count: number;
  avg_utilization: number | null;
  avg_packing_score: number | null;
  trips_with_issues_count: number;
  trips_with_metrics_count: number;
}

export interface SimilarTripSummary {
  delivery_trip_id: string;
  trip_number: string | null;
  vehicle_id: string;
  vehicle_plate: string | null;
  planned_date: string | null;
  actual_weight_kg: number | null;
  actual_pallets_used: number | null;
  space_utilization_percent: number | null;
  had_packing_issues: boolean | null;
  similarity_score: number | null;
  layout_similarity_score: number | null; // New field for layout pattern similarity
  main_categories: string[] | null;
  store_ids: string[] | null;
}

export interface SimilarTripsQueryInput {
  totalWeightKg: number;
  totalVolumeLiter: number;
  storeIds?: string[];
  productIds?: string[];
  limit?: number;
}

export interface PostTripAnalysisEntry {
  id: string;
  delivery_trip_id: string;
  analysis_type: string;
  ai_summary: string;
  created_at: string;
  created_by: string | null;
}

// ==================== Packing Layout Types ====================

export interface PackingLayoutItemInput {
  delivery_trip_item_id: string;
  quantity: number;
  layer_index?: number | null; // null = โหมดง่าย, 0+ = โหมดละเอียด (0=ชั้นล่างสุด)
}

export interface PackingLayoutPosition {
  position_type: 'pallet' | 'floor';
  position_index: number;
  total_layers: number; // จำนวนชั้นที่ซ้อนกัน
  notes?: string;
  items: PackingLayoutItemInput[];
}

export interface PackingLayoutSavePayload {
  positions: PackingLayoutPosition[];
}

export interface PackingLayoutResultItem {
  id: string;
  delivery_trip_item_id: string;
  quantity: number;
  layer_index: number | null; // null = โหมดง่าย, 0+ = โหมดละเอียด
  product_id: string;
  product_code: string;
  product_name: string;
  category: string;
  unit: string;
  weight_kg: number | null;
}

export interface PackingLayoutResultPosition {
  id: string;
  position_type: 'pallet' | 'floor';
  position_index: number;
  total_layers: number;
  notes: string | null;
  items: PackingLayoutResultItem[];
}

export interface PackingLayoutResult {
  positions: PackingLayoutResultPosition[];
  total_pallets: number;
  total_floor_zones: number;
}

export const tripMetricsService = {
  /**
   * บันทึก metrics หลังจบทริป (อัปเดตคอลัมน์ใน delivery_trips)
   */
  saveTripMetrics: async (tripId: string, metrics: TripMetrics): Promise<void> => {
    const { error } = await supabase
      .from('delivery_trips')
      .update({
        actual_pallets_used: metrics.actual_pallets_used ?? null,
        actual_weight_kg: metrics.actual_weight_kg ?? null,
        space_utilization_percent: metrics.space_utilization_percent ?? null,
        packing_efficiency_score: metrics.packing_efficiency_score ?? null,
        had_packing_issues: metrics.had_packing_issues ?? false,
        packing_issues_notes: metrics.packing_issues_notes ?? null,
        actual_distance_km: metrics.actual_distance_km ?? null,
        actual_duration_hours: metrics.actual_duration_hours ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', tripId);

    if (error) {
      console.error('[tripMetricsService] saveTripMetrics error:', error);
      throw error;
    }
  },

  /**
   * ดึงข้อมูล metrics ของทริป
   */
  getTripMetrics: async (tripId: string): Promise<TripMetrics | null> => {
    const { data, error } = await supabase
      .from('delivery_trips')
      .select(
        'actual_pallets_used, actual_weight_kg, space_utilization_percent, packing_efficiency_score, had_packing_issues, packing_issues_notes, actual_distance_km, actual_duration_hours'
      )
      .eq('id', tripId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // no rows
      console.error('[tripMetricsService] getTripMetrics error:', error);
      throw error;
    }
    return data as TripMetrics;
  },

  /**
   * ดึงข้อมูล aggregated metrics สำหรับ analysis
   */
  getAggregatedMetrics: async (
    filters?: AggregatedMetricsFilters
  ): Promise<AggregatedMetricsResult> => {
    let query = supabase
      .from('delivery_trips')
      .select(
        'id, space_utilization_percent, packing_efficiency_score, had_packing_issues'
      );

    if (filters?.planned_date_from) {
      query = query.gte('planned_date', filters.planned_date_from);
    }
    if (filters?.planned_date_to) {
      query = query.lte('planned_date', filters.planned_date_to);
    }
    if (filters?.vehicle_id) {
      query = query.eq('vehicle_id', filters.vehicle_id);
    }
    if (filters?.driver_id) {
      query = query.eq('driver_id', filters.driver_id);
    }
    if (filters?.status && filters.status.length > 0) {
      query = query.in('status', filters.status);
    }

    const { data: rows, error } = await query;

    if (error) {
      console.error('[tripMetricsService] getAggregatedMetrics error:', error);
      throw error;
    }

    const trips = rows ?? [];
    const withMetrics = trips.filter(
      (t: { space_utilization_percent?: number | null; packing_efficiency_score?: number | null }) =>
        t.space_utilization_percent != null || t.packing_efficiency_score != null
    );
    const utilValues = withMetrics
      .map((t: { space_utilization_percent?: number | null }) => t.space_utilization_percent)
      .filter((v): v is number => typeof v === 'number');
    const scoreValues = withMetrics
      .map((t: { packing_efficiency_score?: number | null }) => t.packing_efficiency_score)
      .filter((v): v is number => typeof v === 'number');
    const withIssues = trips.filter(
      (t: { had_packing_issues?: boolean | null }) => t.had_packing_issues === true
    );

    return {
      trip_count: trips.length,
      avg_utilization:
        utilValues.length > 0
          ? utilValues.reduce((a, b) => a + b, 0) / utilValues.length
          : null,
      avg_packing_score:
        scoreValues.length > 0
          ? scoreValues.reduce((a, b) => a + b, 0) / scoreValues.length
          : null,
      trips_with_issues_count: withIssues.length,
      trips_with_metrics_count: withMetrics.length,
    };
  },

  /**
   * บันทึก packing snapshot (สำหรับ ML training)
   */
  savePackingSnapshot: async (
    snapshot: TripPackingSnapshotInsert
  ): Promise<{ id: string }> => {
    const { data, error } = await supabase
      .from('trip_packing_snapshots')
      .insert({
        delivery_trip_id: snapshot.delivery_trip_id,
        vehicle_id: snapshot.vehicle_id,
        packing_layout: snapshot.packing_layout,
        pallets_used: snapshot.pallets_used,
        weight_kg: snapshot.weight_kg,
        volume_used_liter: snapshot.volume_used_liter,
        utilization_percent: snapshot.utilization_percent,
        notes: snapshot.notes ?? null,
      })
      .select('id')
      .single();

    if (error) {
      console.error('[tripMetricsService] savePackingSnapshot error:', error);
      throw error;
    }
    return { id: data.id };
  },

  /**
   * Helper: แปลงรายการ Similar Trips ให้เป็นข้อความสรุป (ใช้เป็น historical_context สำหรับ AI)
   * รวมข้อมูลการจัดเรียงจริงจาก layout ที่บันทึกไว้ (ถ้ามี)
   */
  buildSimilarTripsContext: async (similarTrips: SimilarTripSummary[]): Promise<string> => {
    if (!similarTrips || similarTrips.length === 0) {
      return '';
    }

    const header = 'ทริปคล้ายกันจากประวัติ (สูงสุด 10 ทริป):';
    const lines: string[] = [header];

    // ดึง layout summary สำหรับทริปที่มีการบันทึก layout
    const tripIds = similarTrips.map(t => t.delivery_trip_id);
    const tripsWithLayout = await tripMetricsService.getTripsWithPackingLayout(tripIds);

    for (const t of similarTrips.slice(0, 10)) {
      const tripLabel = t.trip_number || t.delivery_trip_id?.substring(0, 8) || 'ไม่ทราบรหัสทริป';
      const vehicleLabel = t.vehicle_plate || 'ไม่ระบุรถ';
      const weightLabel =
        typeof t.actual_weight_kg === 'number'
          ? `${t.actual_weight_kg.toFixed(0)} kg`
          : 'ไม่ระบุน้ำหนัก';
      const utilLabel =
        typeof t.space_utilization_percent === 'number'
          ? `${t.space_utilization_percent.toFixed(0)}%`
          : 'ไม่ระบุโหลด';
      const palletsLabel =
        typeof t.actual_pallets_used === 'number'
          ? `${t.actual_pallets_used} พาเลท`
          : '-';
      const issueLabel =
        t.had_packing_issues === true
          ? 'มีปัญหาจัดเรียง'
          : 'ไม่มีปัญหาจัดเรียง';
      const categories =
        t.main_categories && t.main_categories.length > 0
          ? t.main_categories.join(', ')
          : '';
      const layoutScoreLabel =
        typeof t.layout_similarity_score === 'number' && t.layout_similarity_score > 0
          ? ` (ความคล้ายการจัดเรียง ${(t.layout_similarity_score * 100).toFixed(0)}%)`
          : '';

      const parts: string[] = [
        `ทริป ${tripLabel} – รถ ${vehicleLabel}`,
        `น้ำหนัก ${weightLabel}`,
        `โหลด ${utilLabel}`,
        `พาเลทจริง ${palletsLabel}`,
        issueLabel,
      ];

      if (categories) {
        parts.push(`หมวดสินค้า: ${categories}`);
      }

      lines.push('- ' + parts.join(' | ') + layoutScoreLabel);

      // เพิ่มข้อมูลการจัดเรียงจริง ถ้ามี
      if (tripsWithLayout.has(t.delivery_trip_id)) {
        const layoutSummary = await tripMetricsService.getTripPackingLayoutSummary(t.delivery_trip_id);
        if (layoutSummary) {
          lines.push(`  📦 การจัดเรียงจริง:`);
          for (const layoutLine of layoutSummary.split('\n')) {
            lines.push(`    ${layoutLine}`);
          }
        }
      }
    }

    return lines.join('\n');
  },

  /**
   * บันทึกผลวิเคราะห์ทริป (Post-Trip Analysis) ลงตาราง trip_post_analysis
   */
  savePostTripAnalysis: async (params: {
    delivery_trip_id: string;
    analysis_type: string;
    ai_summary: string;
    created_by?: string;
  }): Promise<void> => {
    const { error } = await supabase.from('trip_post_analysis').insert({
      delivery_trip_id: params.delivery_trip_id,
      analysis_type: params.analysis_type,
      ai_summary: params.ai_summary,
      created_by: params.created_by ?? null,
    });

    if (error) {
      console.error('[tripMetricsService] savePostTripAnalysis error:', error);
      throw error;
    }
  },

  /**
   * ดึงผลวิเคราะห์ทริปทั้งหมดสำหรับทริปหนึ่ง ๆ
   */
  getPostTripAnalysisForTrip: async (
    tripId: string
  ): Promise<PostTripAnalysisEntry[]> => {
    const { data, error } = await supabase
      .from('trip_post_analysis')
      .select('id, delivery_trip_id, analysis_type, ai_summary, created_at, created_by')
      .eq('delivery_trip_id', tripId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[tripMetricsService] getPostTripAnalysisForTrip error:', error);
      throw error;
    }

    return (data || []) as PostTripAnalysisEntry[];
  },

  /**
   * ดึง "ทริปที่คล้ายกัน" จาก DB ด้วยฟังก์ชัน get_similar_trips (SQL)
   * ใช้สำหรับสร้าง historical_context ให้ AI วิเคราะห์เป็น insight
   */
  getSimilarTripsForLoad: async (
    input: SimilarTripsQueryInput
  ): Promise<SimilarTripSummary[]> => {
    const payload: Record<string, unknown> = {
      p_current_weight_kg: input.totalWeightKg,
      p_current_volume_liter: input.totalVolumeLiter,
      p_limit: input.limit ?? 10,
    };

    if (input.storeIds && input.storeIds.length > 0) {
      payload.p_store_ids = input.storeIds;
    }
    if (input.productIds && input.productIds.length > 0) {
      payload.p_product_ids = input.productIds;
    }

    const { data, error } = await supabase.rpc('get_similar_trips', payload);

    if (error) {
      if (error.code === '42883') {
        // Function ยังไม่ถูกสร้าง (ยังไม่รัน migration) → ไม่ถือเป็น error ร้ายแรง
        console.warn(
          '[tripMetricsService] get_similar_trips RPC not found. Run migration: sql/20260228000007_create_similar_trips_function.sql'
        );
        return [];
      }
      console.error('[tripMetricsService] getSimilarTripsForLoad error:', error);
      throw error;
    }

    const rows = (Array.isArray(data) ? data : []) as SimilarTripSummary[];
    return rows;
  },

  /**
   * ดึงข้อมูล pattern การจัดเรียงจาก analytics views (pallet_weight_distribution + packing_product_affinity)
   * ใช้เป็น packing_patterns context ให้ AI แนะนำการจัดสินค้าอย่างเฉพาะทาง
   */
  getPackingPatternInsights: async (): Promise<string> => {
    const lines: string[] = [];

    // 1) ดึงข้อมูลน้ำหนักพาเลทเฉลี่ย (position 1-4)
    try {
      const { data: weightData, error: weightErr } = await supabase
        .from('pallet_weight_distribution')
        .select('pallet_position, avg_weight_kg, max_weight_kg, min_weight_kg, weight_pattern, position_index')
        .order('position_index', { ascending: true })
        .limit(4);

      if (!weightErr && weightData && weightData.length > 0) {
        lines.push('📊 รูปแบบน้ำหนักพาเลทจากประวัติ:');
        for (const row of weightData) {
          const avg = typeof row.avg_weight_kg === 'number' ? row.avg_weight_kg.toFixed(0) : '?';
          const max = typeof row.max_weight_kg === 'number' ? row.max_weight_kg.toFixed(0) : '?';
          const min = typeof row.min_weight_kg === 'number' ? row.min_weight_kg.toFixed(0) : '?';
          const pattern = row.weight_pattern || '';
          lines.push(`- ${row.pallet_position}: เฉลี่ย ${avg}kg (${min}-${max}kg) ${pattern}`);
        }
      }
    } catch {
      // View อาจยังไม่ถูกสร้าง → ข้ามโดยไม่ error
    }

    // 2) ดึงคู่สินค้าที่มักจัดด้วยกัน (top 5 pairs)
    try {
      const { data: affinityData, error: affinityErr } = await supabase
        .from('packing_product_affinity')
        .select('product_pair, cooccurrence_count, trip_count, affinity_percentage')
        .order('cooccurrence_count', { ascending: false })
        .limit(5);

      if (!affinityErr && affinityData && affinityData.length > 0) {
        lines.push('');
        lines.push('🔗 คู่สินค้าที่มักจัดด้วยกัน:');
        for (const row of affinityData) {
          const pct = typeof row.affinity_percentage === 'number' ? row.affinity_percentage.toFixed(0) : '?';
          lines.push(`- ${row.product_pair}: ${row.cooccurrence_count} ครั้ง (${row.trip_count} ทริป, ${pct}%)`);
        }
      }
    } catch {
      // View อาจยังไม่ถูกสร้าง → ข้ามโดยไม่ error
    }

    return lines.join('\n');
  },

  /**
   * ดึงข้อมูลพื้นฐานของทริป (จำนวนสินค้า, ระยะทาง, ระยะเวลา) จากข้อมูลที่มีอยู่แล้ว
   * ใช้สำหรับเติมข้อมูลที่สามารถคำนวณได้จากระบบเดิม
   */
  getTripBasicData: async (tripId: string): Promise<{
    total_products_quantity: number;
    total_items_count: number;
    stores_count: number;
    distance_km: number | null;
    duration_hours: number | null;
    /** น้ำหนักรวมที่คำนวณจาก (จำนวน × น้ำหนักต่อหน่วย) ของสินค้าในทริป */
    calculated_weight_kg: number;
  }> => {
    // ดึงข้อมูลทริป
    const { data: trip, error: tripError } = await supabase
      .from('delivery_trips')
      .select('id, odometer_start, odometer_end')
      .eq('id', tripId)
      .single();

    if (tripError) {
      console.error('[tripMetricsService] getTripBasicData trip error:', tripError);
      throw tripError;
    }

    // ดึงจำนวนสินค้าและร้าน (รวม product_id สำหรับคำนวณน้ำหนัก)
    const { data: items, error: itemsError } = await supabase
      .from('delivery_trip_items')
      .select('quantity, delivery_trip_store_id, product_id')
      .eq('delivery_trip_id', tripId);

    if (itemsError) {
      console.error('[tripMetricsService] getTripBasicData items error:', itemsError);
      throw itemsError;
    }

    // คำนวณน้ำหนักรวมจากสินค้าในทริป (จำนวน × น้ำหนักต่อหน่วย)
    let calculated_weight_kg = 0;
    const productIds = [...new Set((items ?? []).map((i: { product_id?: string }) => i.product_id).filter(Boolean))];
    if (productIds.length > 0) {
      const { data: products, error: productsError } = await supabase
        .from('products')
        .select('id, weight_kg')
        .in('id', productIds);
      if (!productsError && products) {
        const weightByProduct = new Map<string, number>();
        products.forEach((p: { id: string; weight_kg?: number | null }) => {
          weightByProduct.set(p.id, p.weight_kg ?? 0);
        });
        calculated_weight_kg = (items ?? []).reduce((sum, item: { product_id?: string; quantity?: number }) => {
          const w = weightByProduct.get(item.product_id || '') ?? 0;
          return sum + (Number(item.quantity || 0) * w);
        }, 0);
      }
    }

    // ดึงจำนวนร้าน
    const { data: stores, error: storesError } = await supabase
      .from('delivery_trip_stores')
      .select('id')
      .eq('delivery_trip_id', tripId);

    if (storesError) {
      console.error('[tripMetricsService] getTripBasicData stores error:', storesError);
      throw storesError;
    }

    // คำนวณจำนวนสินค้า
    const total_products_quantity = (items ?? []).reduce(
      (sum, item) => sum + Number(item.quantity || 0),
      0
    );
    const total_items_count = items?.length || 0;
    const stores_count = stores?.length || 0;

    // ดึงระยะทางจาก trip_logs (Priority 1)
    const { data: tripLog, error: logError } = await supabase
      .from('trip_logs')
      .select('distance_km, duration_hours')
      .eq('delivery_trip_id', tripId)
      .eq('status', 'checked_in')
      .order('checkin_time', { ascending: false })
      .limit(1)
      .maybeSingle();

    let distance_km: number | null = null;
    let duration_hours: number | null = null;

    if (!logError && tripLog) {
      distance_km = tripLog.distance_km ?? null;
      duration_hours = tripLog.duration_hours ?? null;
    }

    // ถ้าไม่มี trip_logs ให้คำนวณจาก odometer
    if (distance_km === null && trip?.odometer_start && trip?.odometer_end) {
      distance_km = trip.odometer_end - trip.odometer_start;
    }

    return {
      total_products_quantity,
      total_items_count,
      stores_count,
      distance_km,
      duration_hours,
      calculated_weight_kg,
    };
  },

  /**
   * ดึงรายละเอียดสินค้าแต่ละรายการในทริป (สำหรับ AI training แบบละเอียด)
   */
  getTripItemsDetails: async (tripId: string): Promise<
    Array<{
      product_id: string;
      product_code: string;
      product_name: string;
      category: string;
      quantity: number;
      // Product dimensions
      length_cm: number | null;
      width_cm: number | null;
      height_cm: number | null;
      weight_kg: number | null;
      volume_liter: number | null;
      // Product properties
      is_fragile: boolean;
      is_liquid: boolean;
      requires_temperature: string | null;
      stacking_limit: number | null;
      packaging_type: string | null;
      uses_pallet: boolean;
      // Pallet config ที่เลือกใช้
      selected_pallet_config_id: string | null;
      pallet_config: {
        config_name: string | null;
        layers: number | null;
        units_per_layer: number | null;
        total_units: number | null;
        total_height_cm: number | null;
        total_weight_kg: number | null;
      } | null;
      // Store info
      store_id: string;
      store_sequence: number;
      is_bonus: boolean;
    }>
  > => {
    // ดึง trip items พร้อม product และ store info
    const { data: tripStores, error: storesError } = await supabase
      .from('delivery_trip_stores')
      .select('id, store_id, sequence_order')
      .eq('delivery_trip_id', tripId)
      .order('sequence_order', { ascending: true });

    if (storesError) {
      console.error('[tripMetricsService] getTripItemsDetails stores error:', storesError);
      throw storesError;
    }

    type StoreInfo = {
      store_id: string;
      sequence: number;
    };

    const storeMap = new Map<string, StoreInfo>(
      (tripStores ?? []).map((ts) => [
        ts.id,
        { store_id: ts.store_id, sequence: ts.sequence_order },
      ])
    );

    const storeIds = Array.from(storeMap.keys());
    if (storeIds.length === 0) return [];

    // ดึง trip items
    const { data: items, error: itemsError } = await supabase
      .from('delivery_trip_items')
      .select('id, delivery_trip_store_id, product_id, quantity, selected_pallet_config_id, is_bonus')
      .in('delivery_trip_store_id', storeIds);

    if (itemsError) {
      console.error('[tripMetricsService] getTripItemsDetails items error:', itemsError);
      throw itemsError;
    }

    if (!items || items.length === 0) return [];

    // ดึง product details
    const productIds = [...new Set(items.map((item) => item.product_id))];
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select(
        'id, product_code, product_name, category, length_cm, width_cm, height_cm, weight_kg, volume_liter, is_fragile, is_liquid, requires_temperature, stacking_limit, packaging_type, uses_pallet'
      )
      .in('id', productIds);

    if (productsError) {
      console.error('[tripMetricsService] getTripItemsDetails products error:', productsError);
      throw productsError;
    }

    type ProductSelect = {
      id: string;
      product_code: string;
      product_name: string;
      category: string;
      length_cm: number | null;
      width_cm: number | null;
      height_cm: number | null;
      weight_kg: number | null;
      volume_liter: number | null;
      is_fragile: boolean | null;
      is_liquid: boolean | null;
      requires_temperature: string | null;
      stacking_limit: number | null;
      packaging_type: string | null;
      uses_pallet: boolean | null;
    };

    const productMap = new Map<string, ProductSelect>(
      (products ?? []).map((p) => [p.id, p as unknown as ProductSelect])
    );

    // ดึง pallet configs
    const palletConfigIds = items
      .map((item) => item.selected_pallet_config_id)
      .filter((id): id is string => id !== null);

    type PalletConfig = {
      config_name: string | null;
      layers: number | null;
      units_per_layer: number | null;
      total_units: number | null;
      total_height_cm: number | null;
      total_weight_kg: number | null;
    };

    let palletConfigMap = new Map<string, PalletConfig>();
    if (palletConfigIds.length > 0) {
      const { data: palletConfigs } = await supabase
        .from('product_pallet_configs')
        .select('id, config_name, layers, units_per_layer, total_units, total_height_cm, total_weight_kg')
        .in('id', palletConfigIds);
      palletConfigMap = new Map<string, PalletConfig>(
        (palletConfigs ?? []).map((pc) => [
          pc.id,
          {
            config_name: pc.config_name ?? null,
            layers: pc.layers ?? null,
            units_per_layer: pc.units_per_layer ?? null,
            total_units: pc.total_units ?? null,
            total_height_cm: pc.total_height_cm ?? null,
            total_weight_kg: pc.total_weight_kg ?? null,
          },
        ])
      );
    }

    // รวมข้อมูล
    return items.map((item) => {
      const product = productMap.get(item.product_id);
      const storeInfo = storeMap.get(item.delivery_trip_store_id);
      const palletConfig = item.selected_pallet_config_id
        ? palletConfigMap.get(item.selected_pallet_config_id) || null
        : null;

      return {
        product_id: item.product_id,
        product_code: product?.product_code || '',
        product_name: product?.product_name || '',
        category: product?.category || '',
        quantity: Number(item.quantity || 0),
        length_cm: product?.length_cm ?? null,
        width_cm: product?.width_cm ?? null,
        height_cm: product?.height_cm ?? null,
        weight_kg: product?.weight_kg ?? null,
        volume_liter: product?.volume_liter ?? null,
        is_fragile: product?.is_fragile || false,
        is_liquid: product?.is_liquid || false,
        requires_temperature: product?.requires_temperature ?? null,
        stacking_limit: product?.stacking_limit ?? null,
        packaging_type: product?.packaging_type ?? null,
        uses_pallet: product?.uses_pallet || false,
        selected_pallet_config_id: item.selected_pallet_config_id ?? null,
        pallet_config: palletConfig,
        store_id: storeInfo?.store_id || '',
        store_sequence: storeInfo?.sequence || 0,
        is_bonus: item.is_bonus || false,
      };
    });
  },

  /**
   * ดึงรายละเอียดรถ (สำหรับ AI training แบบละเอียด)
   */
  getVehicleDetails: async (vehicleId: string): Promise<{
    vehicle_id: string;
    plate: string | null;
    // Vehicle dimensions
    cargo_length_cm: number | null;
    cargo_width_cm: number | null;
    cargo_height_cm: number | null;
    cargo_volume_liter: number | null;
    max_weight_kg: number | null;
    // Vehicle properties
    has_shelves: boolean;
    shelf_config: Record<string, unknown> | null;
    cargo_shape_type: string | null;
    loading_constraints: Record<string, unknown> | null;
  }> => {
    const { data: vehicle, error } = await supabase
      .from('vehicles')
      .select(
        'id, plate, cargo_length_cm, cargo_width_cm, cargo_height_cm, cargo_volume_liter, max_weight_kg, has_shelves, shelf_config, cargo_shape_type, loading_constraints'
      )
      .eq('id', vehicleId)
      .single();

    if (error) {
      console.error('[tripMetricsService] getVehicleDetails error:', error);
      throw error;
    }

    return {
      vehicle_id: vehicle.id,
      plate: vehicle.plate ?? null,
      cargo_length_cm: vehicle.cargo_length_cm ?? null,
      cargo_width_cm: vehicle.cargo_width_cm ?? null,
      cargo_height_cm: vehicle.cargo_height_cm ?? null,
      cargo_volume_liter: vehicle.cargo_volume_liter ?? null,
      max_weight_kg: vehicle.max_weight_kg ?? null,
      has_shelves: vehicle.has_shelves || false,
      shelf_config: vehicle.shelf_config as Record<string, unknown> | null,
      cargo_shape_type: vehicle.cargo_shape_type ?? null,
      loading_constraints: vehicle.loading_constraints as Record<string, unknown> | null,
    };
  },

  /**
   * Export ข้อมูลทริปที่มี metrics สำหรับ ML training (date range)
   * รวมข้อมูลพื้นฐานที่มีอยู่แล้ว (จำนวนสินค้า, ระยะทาง, ระยะเวลา) + ข้อมูลที่ต้องบันทึก (จำนวนพาเลท, utilization, etc.)
   */
  exportTrainingData: async (dateRange: {
    from: string;
    to: string;
  }): Promise<
    Array<
      TripMetrics & {
        id: string;
        trip_number: string | null;
        vehicle_id: string;
        planned_date: string;
        // ข้อมูลพื้นฐานที่มีอยู่แล้ว
        total_products_quantity: number;
        total_items_count: number;
        stores_count: number;
        // ระยะทางและเวลาจาก trip_logs (ถ้ามี)
        distance_from_logs_km: number | null;
        duration_from_logs_hours: number | null;
      }
    >
  > => {
    // ดึงข้อมูลทริปที่มี metrics
    const { data: trips, error } = await supabase
      .from('delivery_trips')
      .select(
        'id, trip_number, vehicle_id, planned_date, actual_pallets_used, actual_weight_kg, space_utilization_percent, packing_efficiency_score, had_packing_issues, packing_issues_notes, actual_distance_km, actual_duration_hours'
      )
      .gte('planned_date', dateRange.from)
      .lte('planned_date', dateRange.to)
      .not('space_utilization_percent', 'is', null)
      .order('planned_date', { ascending: true });

    if (error) {
      console.error('[tripMetricsService] exportTrainingData error:', error);
      throw error;
    }

    // ดึงข้อมูลพื้นฐานสำหรับแต่ละทริป
    const enrichedTrips = await Promise.all(
      (trips ?? []).map(async (trip) => {
        const basicData = await tripMetricsService.getTripBasicData(trip.id);
        return {
          ...trip,
          total_products_quantity: basicData.total_products_quantity,
          total_items_count: basicData.total_items_count,
          stores_count: basicData.stores_count,
          distance_from_logs_km: basicData.distance_km,
          duration_from_logs_hours: basicData.duration_hours,
        };
      })
    );

    return enrichedTrips as Array<
      TripMetrics & {
        id: string;
        trip_number: string | null;
        vehicle_id: string;
        planned_date: string;
        total_products_quantity: number;
        total_items_count: number;
        stores_count: number;
        distance_from_logs_km: number | null;
        duration_from_logs_hours: number | null;
      }
    >;
  },

  /**
   * Export ข้อมูลทริปแบบละเอียดสำหรับ AI training (รวมรายละเอียดสินค้าแต่ละรายการและข้อมูลรถ)
   * ใช้สำหรับการวิเคราะห์การจัดเรียงแบบละเอียด
   */
  exportDetailedTrainingData: async (dateRange: {
    from: string;
    to: string;
  }): Promise<
    Array<
      TripMetrics & {
        id: string;
        trip_number: string | null;
        vehicle_id: string;
        planned_date: string;
        // ข้อมูลพื้นฐาน
        total_products_quantity: number;
        total_items_count: number;
        stores_count: number;
        distance_from_logs_km: number | null;
        duration_from_logs_hours: number | null;
        // รายละเอียดรถ
        vehicle: {
          vehicle_id: string;
          plate: string | null;
          cargo_length_cm: number | null;
          cargo_width_cm: number | null;
          cargo_height_cm: number | null;
          cargo_volume_liter: number | null;
          max_weight_kg: number | null;
          has_shelves: boolean;
          shelf_config: Record<string, unknown> | null;
          cargo_shape_type: string | null;
          loading_constraints: Record<string, unknown> | null;
        };
        // รายละเอียดสินค้าแต่ละรายการ
        items: Array<{
          product_id: string;
          product_code: string;
          product_name: string;
          category: string;
          quantity: number;
          length_cm: number | null;
          width_cm: number | null;
          height_cm: number | null;
          weight_kg: number | null;
          volume_liter: number | null;
          is_fragile: boolean;
          is_liquid: boolean;
          requires_temperature: string | null;
          stacking_limit: number | null;
          packaging_type: string | null;
          uses_pallet: boolean;
          selected_pallet_config_id: string | null;
          pallet_config: {
            config_name: string | null;
            layers: number | null;
            units_per_layer: number | null;
            total_units: number | null;
            total_height_cm: number | null;
            total_weight_kg: number | null;
          } | null;
          store_id: string;
          store_sequence: number;
          is_bonus: boolean;
        }>;
      }
    >
  > => {
    // ดึงข้อมูลทริปที่มี metrics
    const { data: trips, error } = await supabase
      .from('delivery_trips')
      .select(
        'id, trip_number, vehicle_id, planned_date, actual_pallets_used, actual_weight_kg, space_utilization_percent, packing_efficiency_score, had_packing_issues, packing_issues_notes, actual_distance_km, actual_duration_hours'
      )
      .gte('planned_date', dateRange.from)
      .lte('planned_date', dateRange.to)
      .not('space_utilization_percent', 'is', null)
      .order('planned_date', { ascending: true });

    if (error) {
      console.error('[tripMetricsService] exportDetailedTrainingData error:', error);
      throw error;
    }

    // ดึงข้อมูลละเอียดสำหรับแต่ละทริป
    const detailedTrips = await Promise.all(
      (trips ?? []).map(async (trip) => {
        const basicData = await tripMetricsService.getTripBasicData(trip.id);
        const items = await tripMetricsService.getTripItemsDetails(trip.id);
        const vehicle = await tripMetricsService.getVehicleDetails(trip.vehicle_id);

        return {
          ...trip,
          total_products_quantity: basicData.total_products_quantity,
          total_items_count: basicData.total_items_count,
          stores_count: basicData.stores_count,
          distance_from_logs_km: basicData.distance_km,
          duration_from_logs_hours: basicData.duration_hours,
          vehicle,
          items,
        };
      })
    );

    return detailedTrips as Array<
      TripMetrics & {
        id: string;
        trip_number: string | null;
        vehicle_id: string;
        planned_date: string;
        total_products_quantity: number;
        total_items_count: number;
        stores_count: number;
        distance_from_logs_km: number | null;
        duration_from_logs_hours: number | null;
        vehicle: {
          vehicle_id: string;
          plate: string | null;
          cargo_length_cm: number | null;
          cargo_width_cm: number | null;
          cargo_height_cm: number | null;
          cargo_volume_liter: number | null;
          max_weight_kg: number | null;
          has_shelves: boolean;
          shelf_config: Record<string, unknown> | null;
          cargo_shape_type: string | null;
          loading_constraints: Record<string, unknown> | null;
        };
        items: Array<{
          product_id: string;
          product_code: string;
          product_name: string;
          category: string;
          quantity: number;
          length_cm: number | null;
          width_cm: number | null;
          height_cm: number | null;
          weight_kg: number | null;
          volume_liter: number | null;
          is_fragile: boolean;
          is_liquid: boolean;
          requires_temperature: string | null;
          stacking_limit: number | null;
          packaging_type: string | null;
          uses_pallet: boolean;
          selected_pallet_config_id: string | null;
          pallet_config: {
            config_name: string | null;
            layers: number | null;
            units_per_layer: number | null;
            total_units: number | null;
            total_height_cm: number | null;
            total_weight_kg: number | null;
          } | null;
          store_id: string;
          store_sequence: number;
          is_bonus: boolean;
        }>;
      }
    >;
  },

  // ==================== Packing Layout Methods ====================

  /**
   * บันทึก layout การจัดเรียงสินค้าของทริป (ลบ layout เดิมแล้ว insert ใหม่ทั้งหมด)
   * 1 position = 1 พาเลท/พื้น + total_layers + สินค้า
   * พร้อมอัปเดต actual_pallets_used ใน delivery_trips
   */
  saveTripPackingLayout: async (
    tripId: string,
    payload: PackingLayoutSavePayload
  ): Promise<void> => {
    // 1. ลบ layout เดิมทั้งหมดของทริปนี้ (CASCADE จะลบ items ด้วย)
    const { error: deleteError } = await supabase
      .from('trip_packing_layout')
      .delete()
      .eq('delivery_trip_id', tripId);

    if (deleteError) {
      console.error('[tripMetricsService] saveTripPackingLayout delete error:', deleteError);
      throw deleteError;
    }

    if (!payload.positions || payload.positions.length === 0) {
      await supabase
        .from('delivery_trips')
        .update({ actual_pallets_used: 0, updated_at: new Date().toISOString() })
        .eq('id', tripId);
      return;
    }

    // 2. Insert ตำแหน่งทั้งหมด (1 row = 1 พาเลท/พื้น)
    const layoutRows = payload.positions.map((pos) => ({
      delivery_trip_id: tripId,
      position_type: pos.position_type,
      position_index: pos.position_index,
      total_layers: pos.total_layers || 1,
      notes: pos.notes ?? null,
    }));

    const { data: insertedLayouts, error: layoutError } = await supabase
      .from('trip_packing_layout')
      .insert(layoutRows)
      .select('id, position_type, position_index');

    if (layoutError) {
      console.error('[tripMetricsService] saveTripPackingLayout insert layouts error:', layoutError);
      throw layoutError;
    }

    if (!insertedLayouts || insertedLayouts.length === 0) {
      throw new Error('Failed to insert packing layout positions');
    }

    // 3. Map positions → inserted IDs
    const layoutIdMap = new Map<string, string>();
    for (const ins of insertedLayouts) {
      const key = `${ins.position_type}-${ins.position_index}`;
      layoutIdMap.set(key, ins.id);
    }

    // 4. Insert items ทั้งหมด (batch) — รองรับ layer_index (null = โหมดง่าย, 0+ = โหมดละเอียด)
    const allItemRows: Array<{
      trip_packing_layout_id: string;
      delivery_trip_item_id: string;
      quantity: number;
      layer_index: number | null;
    }> = [];

    for (const pos of payload.positions) {
      const key = `${pos.position_type}-${pos.position_index}`;
      const layoutId = layoutIdMap.get(key);
      if (!layoutId) continue;

      for (const item of pos.items) {
        if (item.quantity > 0) {
          allItemRows.push({
            trip_packing_layout_id: layoutId,
            delivery_trip_item_id: item.delivery_trip_item_id,
            quantity: item.quantity,
            layer_index: item.layer_index ?? null,
          });
        }
      }
    }

    if (allItemRows.length > 0) {
      const { error: itemsError } = await supabase
        .from('trip_packing_layout_items')
        .insert(allItemRows);

      if (itemsError) {
        console.error('[tripMetricsService] saveTripPackingLayout insert items error:', itemsError);
        throw itemsError;
      }
    }

    // 5. อัปเดต actual_pallets_used
    const palletCount = payload.positions.filter((p) => p.position_type === 'pallet').length;
    await supabase
      .from('delivery_trips')
      .update({
        actual_pallets_used: palletCount,
        updated_at: new Date().toISOString(),
      })
      .eq('id', tripId);
  },

  /**
   * ดึง layout การจัดเรียงสินค้าของทริป พร้อมรายละเอียดสินค้า
   */
  getTripPackingLayout: async (
    tripId: string
  ): Promise<PackingLayoutResult> => {
    const { data: layouts, error: layoutError } = await supabase
      .from('trip_packing_layout')
      .select('id, position_type, position_index, total_layers, notes')
      .eq('delivery_trip_id', tripId)
      .order('position_type', { ascending: true })
      .order('position_index', { ascending: true });

    if (layoutError) {
      console.error('[tripMetricsService] getTripPackingLayout error:', layoutError);
      throw layoutError;
    }

    if (!layouts || layouts.length === 0) {
      return { positions: [], total_pallets: 0, total_floor_zones: 0 };
    }

    // ดึง layout items ทั้งหมด (รวม layer_index)
    const layoutIds = layouts.map((l) => l.id);
    const { data: items, error: itemsError } = await supabase
      .from('trip_packing_layout_items')
      .select('id, trip_packing_layout_id, delivery_trip_item_id, quantity, layer_index')
      .in('trip_packing_layout_id', layoutIds);

    if (itemsError) {
      console.error('[tripMetricsService] getTripPackingLayout items error:', itemsError);
      throw itemsError;
    }

    // ดึง delivery_trip_items เพื่อ map product_id
    const tripItemIds = [...new Set((items ?? []).map((i) => i.delivery_trip_item_id))];
    let tripItemMap = new Map<string, { product_id: string }>();

    if (tripItemIds.length > 0) {
      const { data: tripItems } = await supabase
        .from('delivery_trip_items')
        .select('id, product_id')
        .in('id', tripItemIds);

      tripItemMap = new Map(
        (tripItems ?? []).map((ti) => [ti.id, { product_id: ti.product_id }])
      );
    }

    // ดึง product details
    const productIds = [...new Set([...tripItemMap.values()].map((v) => v.product_id))];
    let productMap = new Map<string, {
      product_code: string;
      product_name: string;
      category: string;
      unit: string;
      weight_kg: number | null;
    }>();

    if (productIds.length > 0) {
      const { data: products } = await supabase
        .from('products')
        .select('id, product_code, product_name, category, unit, weight_kg')
        .in('id', productIds);

      productMap = new Map(
        (products ?? []).map((p) => [
          p.id,
          {
            product_code: p.product_code || '',
            product_name: p.product_name || '',
            category: p.category || '',
            unit: p.unit || '',
            weight_kg: p.weight_kg ?? null,
          },
        ])
      );
    }

    // Group items by layout id
    const itemsByLayout = new Map<string, typeof items>();
    for (const item of items ?? []) {
      const existing = itemsByLayout.get(item.trip_packing_layout_id) || [];
      existing.push(item);
      itemsByLayout.set(item.trip_packing_layout_id, existing);
    }

    // Build result
    const positions: PackingLayoutResultPosition[] = layouts.map((layout) => {
      const layoutItems = itemsByLayout.get(layout.id) || [];
      return {
        id: layout.id,
        position_type: layout.position_type as 'pallet' | 'floor',
        position_index: layout.position_index,
        total_layers: (layout as any).total_layers ?? 1,
        notes: layout.notes ?? null,
        items: layoutItems.map((li) => {
          const tripItem = tripItemMap.get(li.delivery_trip_item_id);
          const product = tripItem ? productMap.get(tripItem.product_id) : undefined;
          return {
            id: li.id,
            delivery_trip_item_id: li.delivery_trip_item_id,
            quantity: Number(li.quantity),
            layer_index: (li as any).layer_index ?? null,
            product_id: tripItem?.product_id || '',
            product_code: product?.product_code || '',
            product_name: product?.product_name || '',
            category: product?.category || '',
            unit: product?.unit || '',
            weight_kg: product?.weight_kg ?? null,
          };
        }),
      };
    });

    const total_pallets = positions.filter((p) => p.position_type === 'pallet').length;
    const total_floor_zones = positions.filter((p) => p.position_type === 'floor').length;

    return { positions, total_pallets, total_floor_zones };
  },

  /**
   * ลบ layout ทั้งหมดของทริป
   */
  deleteTripPackingLayout: async (tripId: string): Promise<void> => {
    const { error } = await supabase
      .from('trip_packing_layout')
      .delete()
      .eq('delivery_trip_id', tripId);

    if (error) {
      console.error('[tripMetricsService] deleteTripPackingLayout error:', error);
      throw error;
    }
  },

  /**
   * สร้างข้อความสรุป layout สำหรับ AI context
   * รองรับ 2 โหมด:
   * โหมดง่าย (layer_index=null):  - พาเลท 1 (450kg, 4 ชั้น): เบียร์ 60 ลัง (ชั้นละ ~15)
   * โหมดละเอียด (layer_index>=0):  - พาเลท 1 (450kg, 4 ชั้น):
   *   ชั้น 1 (ล่างสุด): เบียร์ 15 ลัง + น้ำดื่ม 10 ลัง
   *   ชั้น 2: เบียร์ 15 ลัง + น้ำดื่ม 10 ลัง
   *   ชั้น 3: ทิชชู่ 5 แพ็ค
   *   ชั้น 4 (บนสุด): ทิชชู่ 5 แพ็ค
   */
  getTripPackingLayoutSummary: async (tripId: string): Promise<string | null> => {
    try {
      const layout = await tripMetricsService.getTripPackingLayout(tripId);
      if (!layout || layout.positions.length === 0) return null;

      const lines: string[] = [];
      for (const pos of layout.positions) {
        const posLabel =
          pos.position_type === 'pallet'
            ? `พาเลท ${pos.position_index}`
            : `บนพื้น ${pos.position_index}`;

        const totalWeight = pos.items.reduce(
          (sum, item) => sum + (item.weight_kg ? item.weight_kg * item.quantity : 0),
          0
        );

        const weightStr = totalWeight > 0 ? `, ${totalWeight.toFixed(0)}kg` : '';
        const layerStr = pos.total_layers > 1 ? `, ${pos.total_layers} ชั้น` : '';

        // ตรวจว่าเป็นโหมดละเอียดหรือไม่ (มี item ที่ layer_index != null)
        const isDetailed = pos.items.some((item) => item.layer_index !== null && item.layer_index !== undefined);

        if (isDetailed && pos.total_layers > 1) {
          // โหมดละเอียด: แยกสินค้าตามชั้น
          lines.push(`- ${posLabel}${weightStr}${layerStr}:`);
          for (let li = 0; li < pos.total_layers; li++) {
            const layerItems = pos.items.filter((item) => item.layer_index === li);
            if (layerItems.length === 0) continue;
            const layerNum = li + 1;
            let suffix = '';
            if (li === 0) suffix = ' (ล่างสุด)';
            else if (li === pos.total_layers - 1) suffix = ' (บนสุด)';
            const descs = layerItems.map(
              (item) => `${item.product_name} ${item.quantity} ${item.unit}`
            );
            lines.push(`  ชั้น ${layerNum}${suffix}: ${descs.join(' + ')}`);
          }
        } else {
          // โหมดง่าย: สินค้ารวม + จำนวนชั้น
          const itemDescs = pos.items.map((item) => {
            let desc = `${item.product_name} ${item.quantity} ${item.unit}`;
            if (pos.items.length === 1 && pos.total_layers > 1) {
              const perLayer = Math.round(item.quantity / pos.total_layers);
              desc += ` (ชั้นละ ~${perLayer})`;
            }
            return desc;
          });
          lines.push(`- ${posLabel}${weightStr}${layerStr}: ${itemDescs.join(' + ')}`);
        }
      }

      return lines.join('\n');
    } catch (err) {
      console.warn('[tripMetricsService] getTripPackingLayoutSummary error:', err);
      return null;
    }
  },

  /**
   * Batch check: ทริปไหนมี packing layout แล้วบ้าง
   * คืน Set<tripId> ที่มี layout อย่างน้อย 1 position
   */
  getTripsWithPackingLayout: async (tripIds: string[]): Promise<Set<string>> => {
    if (tripIds.length === 0) return new Set();
    try {
      const { data, error } = await supabase
        .from('trip_packing_layout')
        .select('delivery_trip_id')
        .in('delivery_trip_id', tripIds);

      if (error) {
        console.warn('[tripMetricsService] getTripsWithPackingLayout error:', error);
        return new Set();
      }

      return new Set((data ?? []).map((d) => d.delivery_trip_id));
    } catch {
      return new Set();
    }
  },
};
