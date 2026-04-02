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
  vehicleId?: string; // กรองเฉพาะรถคันนี้ (ทะเบียนเดียวกัน) เพื่อให้ historical context แม่นยำขึ้น
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

    // ★ Batch ดึงสินค้าของทริปเหล่านี้ (delivery_trip_items + products)
    let tripItemsMap = new Map<string, Array<{ product_name: string; quantity: number; unit: string; weight_kg: number | null }>>();
    try {
      const { data: allTripItems, error: tiErr } = await supabase
        .from('delivery_trip_items')
        .select(`
          delivery_trip_id,
          quantity,
          products!inner (
            product_name,
            unit,
            weight_kg
          )
        `)
        .in('delivery_trip_id', tripIds);

      if (!tiErr && allTripItems) {
        for (const item of allTripItems) {
          const tid = item.delivery_trip_id;
          const existing = tripItemsMap.get(tid) || [];
          const prod = (item as any).products;
          existing.push({
            product_name: prod?.product_name || 'ไม่ทราบ',
            quantity: Number(item.quantity),
            unit: prod?.unit || 'หน่วย',
            weight_kg: prod?.weight_kg ?? null,
          });
          tripItemsMap.set(tid, existing);
        }
      }
    } catch (err) {
      console.warn('[tripMetricsService] buildSimilarTripsContext: fetch items error', err);
    }

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

      // ★ แสดงรายการสินค้าของทริปนี้ (จำนวน + น้ำหนัก)
      const tripItems = tripItemsMap.get(t.delivery_trip_id);
      if (tripItems && tripItems.length > 0) {
        // จัดเรียงตามน้ำหนักรวม (มาก → น้อย)
        const sortedItems = [...tripItems].sort((a, b) => {
          const wa = (a.weight_kg ?? 0) * a.quantity;
          const wb = (b.weight_kg ?? 0) * b.quantity;
          return wb - wa;
        });

        const totalWeightCalc = sortedItems.reduce((s, i) => s + (i.weight_kg ?? 0) * i.quantity, 0);
        lines.push(`  🛒 สินค้าในทริป (รวม ${totalWeightCalc.toFixed(0)} kg):`);
        for (const item of sortedItems) {
          const itemWeight = (item.weight_kg ?? 0) * item.quantity;
          const weightNote = itemWeight > 0 ? ` (${itemWeight.toFixed(1)} kg)` : '';
          lines.push(`    • ${item.product_name}: ${item.quantity} ${item.unit}${weightNote}`);
        }
      }

      // ★ เพิ่มข้อมูลการจัดเรียงจริง ถ้ามี (layer-by-layer)
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
    if (input.vehicleId) {
      payload.p_vehicle_id = input.vehicleId;
    }

    console.log('[tripMetricsService] getSimilarTripsForLoad payload:', JSON.stringify(payload, null, 2));

    const { data, error } = await supabase.rpc('get_similar_trips', payload);

    if (error) {
      console.error('[tripMetricsService] getSimilarTripsForLoad error:', error.code, error.message);

      // 42883 = function not found, 42725 = function is not unique (มี overload ซ้ำ)
      if (error.code === '42883' || error.code === '42725') {
        console.warn(
          '[tripMetricsService] get_similar_trips RPC error. Trying without p_vehicle_id. Run migration: sql/20260213000001_add_vehicle_filter_to_similar_trips.sql'
        );
        const fallbackPayload = { ...payload };
        delete fallbackPayload.p_vehicle_id;
        const { data: fbData, error: fbError } = await supabase.rpc('get_similar_trips', fallbackPayload);
        if (fbError) {
          console.error('[tripMetricsService] getSimilarTripsForLoad fallback also failed:', fbError.code, fbError.message);
          return [];
        }
        const fbRows = (Array.isArray(fbData) ? fbData : []) as SimilarTripSummary[];
        console.log(`[tripMetricsService] getSimilarTripsForLoad fallback returned ${fbRows.length} rows`);
        return fbRows;
      }
      // ถ้า SQL function ยังไม่รองรับ p_vehicle_id → ลองเรียกโดยไม่ส่ง p_vehicle_id
      if (error.message?.includes('p_vehicle_id')) {
        console.warn(
          '[tripMetricsService] get_similar_trips does not support p_vehicle_id yet, calling without it'
        );
        const fallbackPayload = { ...payload };
        delete fallbackPayload.p_vehicle_id;
        const { data: fbData, error: fbError } = await supabase.rpc('get_similar_trips', fallbackPayload);
        if (fbError) {
          console.error('[tripMetricsService] getSimilarTripsForLoad fallback error:', fbError);
          return [];
        }
        return (Array.isArray(fbData) ? fbData : []) as SimilarTripSummary[];
      }
      console.error('[tripMetricsService] getSimilarTripsForLoad unexpected error:', error);
      return [];
    }

    let rows = (Array.isArray(data) ? data : []) as SimilarTripSummary[];
    console.log(`[tripMetricsService] getSimilarTripsForLoad returned ${rows.length} rows for vehicleId=${input.vehicleId || '(all)'}`);

    // ถ้ากรองเฉพาะรถแล้วไม่มีผลลัพธ์ → fallback ดึงจากทุกคัน (แต่ label ไว้ว่าเป็น fallback)
    if (rows.length === 0 && input.vehicleId) {
      console.info(
        '[tripMetricsService] No similar trips for vehicleId, falling back to all vehicles'
      );
      const fallbackPayload = { ...payload };
      delete fallbackPayload.p_vehicle_id;
      const { data: fbData, error: fbError } = await supabase.rpc('get_similar_trips', fallbackPayload);
      if (!fbError && fbData) {
        rows = (Array.isArray(fbData) ? fbData : []) as SimilarTripSummary[];
        console.log(`[tripMetricsService] getSimilarTripsForLoad fallback returned ${rows.length} rows`);
      }
    }

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
   * ดึง profile การจัดเรียงสินค้าแต่ละตัว จากประวัติ layout จริง (เฉพาะรถคันที่ระบุ)
   * เช่น "เบียร์ลีโอขวด: วางพาเลทแรก 80%, ชั้นล่าง 90%, เฉลี่ย 80 หน่วย/พาเลท"
   * ถ้ารถคันนั้นไม่มีข้อมูล → fallback ดูจากทุกคัน (ส่ง null เป็น vehicle_id)
   */
  getProductPackingProfiles: async (
    productIds: string[],
    vehicleId: string
  ): Promise<string> => {
    if (!productIds || productIds.length === 0) return '';

    const lines: string[] = [];

    try {
      // ลองดึงเฉพาะรถคันที่เลือก
      console.log('[tripMetricsService] getProductPackingProfiles: vehicleId=', vehicleId, 'productIds=', productIds.length);
      const { data, error } = await supabase.rpc('get_product_packing_profiles', {
        p_vehicle_id: vehicleId,
        p_product_ids: productIds,
      });

      if (error) {
        console.warn('[tripMetricsService] getProductPackingProfiles error:', error.message, error.code);
      }

      let profiles = (!error && data && data.length > 0) ? data : null;
      let fromAllVehicles = false;

      // ★ ถ้ารถคันนี้ไม่มีข้อมูล → fallback ดึงจากรถทุกคัน (ส่ง null vehicle_id)
      if (!profiles || profiles.length === 0) {
        console.info('[tripMetricsService] No packing profiles for this vehicle, trying all vehicles...');
        try {
          // เรียกด้วย vehicle_id = null (ดึงจากทุกคัน)
          // ★ ถ้า SQL function ไม่รับ null → ใช้ query ตรงแทน
          const { data: fbData, error: fbError } = await supabase
            .from('trip_packing_layout_items')
            .select(`
              id,
              trip_packing_layout_id,
              delivery_trip_item_id,
              quantity,
              layer_index,
              trip_packing_layout!inner (
                id,
                delivery_trip_id,
                position_index,
                position_type,
                total_layers,
                delivery_trips!inner (
                  id,
                  status,
                  vehicle_id
                )
              ),
              delivery_trip_items!inner (
                product_id,
                products!inner (
                  id,
                  product_name
                )
              )
            `)
            .limit(200);

          if (!fbError && fbData && fbData.length > 0) {
            // สินค้าที่ตรงกับ productIds
            const matchingItems = fbData.filter((item: any) => {
              const pid = item.delivery_trip_items?.product_id;
              return productIds.includes(pid);
            });

            if (matchingItems.length > 0) {
              fromAllVehicles = true;
              // สร้าง summary เอง
              const productMap = new Map<string, { name: string; count: number; positions: Map<number, number>; layers: Map<string, number> }>();

              for (const item of matchingItems) {
                const pid = item.delivery_trip_items?.product_id;
                const pname = item.delivery_trip_items?.products?.product_name || 'ไม่ทราบ';
                const posIdx = (item.trip_packing_layout as any)?.position_index ?? 0;
                const layerIdx = item.layer_index;
                const totalLayers = (item.trip_packing_layout as any)?.total_layers;

                let entry = productMap.get(pid);
                if (!entry) {
                  entry = { name: pname, count: 0, positions: new Map(), layers: new Map() };
                  productMap.set(pid, entry);
                }
                entry.count++;
                entry.positions.set(posIdx, (entry.positions.get(posIdx) || 0) + 1);

                const layerLabel = layerIdx == null ? 'ไม่ระบุชั้น'
                  : layerIdx === 0 ? 'ล่างสุด'
                    : (totalLayers != null && layerIdx >= totalLayers - 1) ? 'บนสุด'
                      : 'กลาง';
                entry.layers.set(layerLabel, (entry.layers.get(layerLabel) || 0) + 1);
              }

              lines.push('📦 โปรไฟล์การจัดเรียงสินค้า (จากประวัติรถทุกคัน — ไม่มีข้อมูลเฉพาะรถคันนี้):');
              for (const [, entry] of productMap) {
                const posStr = Array.from(entry.positions.entries())
                  .sort(([, a], [, b]) => b - a)
                  .map(([pos, cnt]) => `พาเลท ${pos}: ${Math.round(cnt / entry.count * 100)}%`)
                  .join(', ');
                const layerStr = Array.from(entry.layers.entries())
                  .sort(([, a], [, b]) => b - a)
                  .map(([layer, cnt]) => `${layer}: ${Math.round(cnt / entry.count * 100)}%`)
                  .join(', ');
                lines.push(`- ${entry.name} (${entry.count} ครั้ง): ตำแหน่ง [${posStr}] ชั้น [${layerStr}]`);
              }
            }
          }
        } catch (fbErr) {
          console.warn('[tripMetricsService] fallback query error:', fbErr);
        }

        if (!fromAllVehicles) {
          console.info('[tripMetricsService] No packing profiles found at all');
          return '';
        }
      } else {
        lines.push('📦 โปรไฟล์การจัดเรียงสินค้า (จากประวัติรถคันนี้):');

        for (const p of profiles) {
          const name = p.product_name || 'ไม่ทราบชื่อ';
          const packed = p.times_packed || 0;
          if (packed < 1) continue;

          const posDist = typeof p.position_distribution === 'object' && p.position_distribution
            ? Object.entries(p.position_distribution as Record<string, number>)
              .sort(([, a], [, b]) => (b as number) - (a as number))
              .map(([pos, pct]) => `พาเลท ${pos}: ${pct}%`)
              .join(', ')
            : '';

          const layerDist = typeof p.layer_distribution === 'object' && p.layer_distribution
            ? Object.entries(p.layer_distribution as Record<string, number>)
              .sort(([, a], [, b]) => (b as number) - (a as number))
              .map(([layer, pct]) => `${layer}: ${pct}%`)
              .join(', ')
            : '';

          const avgQty = typeof p.avg_qty_per_pallet === 'number' ? p.avg_qty_per_pallet.toFixed(0) : '?';
          const maxQty = typeof p.max_qty_per_pallet === 'number' ? p.max_qty_per_pallet.toFixed(0) : '?';

          const coPacked = Array.isArray(p.top_copacked) && p.top_copacked.length > 0
            ? p.top_copacked.join(', ')
            : '';

          let line = `- ${name} (บันทึก ${packed} ครั้ง):`;
          if (posDist) line += ` ตำแหน่ง [${posDist}]`;
          if (layerDist) line += ` ชั้น [${layerDist}]`;
          line += ` เฉลี่ย ${avgQty} ต่อพาเลท (max ${maxQty})`;
          if (coPacked) line += ` จัดคู่กับ: ${coPacked}`;

          lines.push(line);
        }
      }
    } catch (err) {
      console.error('[tripMetricsService] getProductPackingProfiles unexpected error:', err);
    }

    return lines.join('\n');
  },

  /**
   * ดึงมาตรฐานการจัดเรียงต่อสินค้า จาก product_pallet_configs (ชั้นละกี่ชิ้น, พาเลทละกี่ชิ้น)
   * ใช้ config ที่ is_default หรือตัวแรกของแต่ละ product
   */
  getPackingStandards: async (productIds: string[]): Promise<Map<string, { units_per_layer: number; layers: number; total_units: number; config_name: string | null }>> => {
    const map = new Map<string, { units_per_layer: number; layers: number; total_units: number; config_name: string | null }>();
    if (!productIds || productIds.length === 0) return map;
    try {
      const { data: rows, error } = await supabase
        .from('product_pallet_configs')
        .select('id, product_id, config_name, layers, units_per_layer, total_units')
        .in('product_id', productIds)
        .eq('is_active', true)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: true });

      if (error) {
        console.warn('[tripMetricsService] getPackingStandards error:', error);
        return map;
      }
      for (const row of rows ?? []) {
        const pid = (row as any).product_id;
        if (!pid || map.has(pid)) continue;
        const layers = Number((row as any).layers) || 1;
        const upl = Number((row as any).units_per_layer) || 0;
        const total = Number((row as any).total_units) ?? layers * upl;
        map.set(pid, {
          units_per_layer: upl,
          layers,
          total_units: total > 0 ? total : layers * upl,
          config_name: (row as any).config_name ?? null,
        });
      }
    } catch (err) {
      console.warn('[tripMetricsService] getPackingStandards unexpected error:', err);
    }
    return map;
  },

  /**
   * ดึง config การจัดเรียงทุกแบบต่อสินค้า (สำหรับแสดงตัวเลือกเต็มพาเลท 60, 75 ฯลฯ)
   */
  getProductPackingConfigs: async (productIds: string[]): Promise<Map<string, Array<{ units_per_layer: number; layers: number; total_units: number; config_name: string | null }>>> => {
    const map = new Map<string, Array<{ units_per_layer: number; layers: number; total_units: number; config_name: string | null }>>();
    if (!productIds || productIds.length === 0) return map;
    try {
      const { data: rows, error } = await supabase
        .from('product_pallet_configs')
        .select('id, product_id, config_name, layers, units_per_layer, total_units')
        .in('product_id', productIds)
        .eq('is_active', true)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: true });

      if (error) {
        console.warn('[tripMetricsService] getProductPackingConfigs error:', error);
        return map;
      }
      for (const row of rows ?? []) {
        const pid = (row as any).product_id;
        if (!pid) continue;
        const layers = Number((row as any).layers) || 1;
        const upl = Number((row as any).units_per_layer) || 0;
        const total = Number((row as any).total_units) ?? layers * upl;
        const entry = {
          units_per_layer: upl,
          layers,
          total_units: total > 0 ? total : layers * upl,
          config_name: (row as any).config_name ?? null,
        };
        if (!map.has(pid)) map.set(pid, []);
        map.get(pid)!.push(entry);
      }
    } catch (err) {
      console.warn('[tripMetricsService] getProductPackingConfigs unexpected error:', err);
    }
    return map;
  },

  /**
   * ★ คำนวณ "ร่างแผนจัดเรียง" จาก rule-based (มาตรฐาน → ประวัติ → ประมาณ) คืนค่าเป็นตัวเลข
   * ใช้ตอนสร้างทริปและแนะนำรถ ให้ใช้ logic เดียวกับ Packing Simulation
   */
  computePackingPlanSummary: async (params: {
    items: Array<{
      product_id: string;
      product_name: string;
      quantity: number;
      weight_kg: number; // น้ำหนักรวม (qty × unit_weight)
    }>;
    vehicleMaxPallets?: number | null;
  }): Promise<{
    totalPallets: number;
    totalWeightKg: number;
    totalLayers: number;
    summaryText: string;
  }> => {
    const core = await tripMetricsService._computePackingPlanCore(params);
    const totalWeightKg =
      core.pallets.reduce((s, p) => s + p.total_weight_kg, 0) +
      core.floorItems.reduce((s, f) => s + f.weight_kg, 0);
    return {
      totalPallets: core.totalPalletsNeeded,
      totalWeightKg,
      totalLayers: core.totalLayers,
      summaryText: core.lines.join('\n'),
    };
  },

  /**
   * ★ คำนวณ "ร่างแผนจัดเรียง" จาก rule-based
   * ใช้มาตรฐานจาก product_pallet_configs เป็นหลัก → ถ้าไม่มีใช้ประวัติ layout → ถ้าไม่มีใช้ประมาณค่า
   * แล้วคำนวณว่าทริปปัจจุบันต้องใช้กี่ชั้น กี่พาเลท
   * ส่งให้ AI ใช้เป็นฐาน (ไม่ต้องคิดเอง)
   */
  computePackingPlan: async (params: {
    items: Array<{
      product_id: string;
      product_name: string;
      quantity: number;
      weight_kg: number;  // น้ำหนักรวม (qty × unit_weight)
    }>;
    vehicleMaxPallets?: number | null;
  }): Promise<string> => {
    const core = await tripMetricsService._computePackingPlanCore(params);
    return core.lines.join('\n');
  },

  /** Core logic สำหรับคำนวณแผนจัดเรียง (ใช้ร่วมกัน computePackingPlan และ computePackingPlanSummary) */
  _computePackingPlanCore: async (params: {
    items: Array<{ product_id: string; product_name: string; quantity: number; weight_kg: number }>;
    vehicleMaxPallets?: number | null;
  }): Promise<{
    productPlans: Array<{ product_id: string; product_name: string; quantity: number; weight_kg: number; units_per_layer: number; layers_needed: number; data_source: 'มาตรฐาน' | 'ประวัติจริง' | 'ประมาณค่า' }>;
    pallets: Array<{ pallet_index: number; items: Array<{ product_name: string; quantity: number; layers: number; weight_kg: number; layer_start: number }>; total_layers: number; total_weight_kg: number }>;
    totalPalletsNeeded: number;
    totalLayers: number;
    floorItems: Array<{ product_name: string; quantity: number; weight_kg: number; reason: string }>;
    lines: string[];
  }> => {
    const lines: string[] = [];
    if (!params.items || params.items.length === 0) {
      return { productPlans: [], pallets: [], totalPalletsNeeded: 0, totalLayers: 0, floorItems: [], lines: [] };
    }

    const MAX_LAYERS_PER_PALLET = 4;
    const productIds = [...new Set(params.items.map(i => i.product_id))];

    const standardsMap = await tripMetricsService.getPackingStandards(productIds);
    const unitsPerLayerMap = new Map<string, number>();
    const dataSourceMap = new Map<string, 'มาตรฐาน' | 'ประวัติจริง' | 'ประมาณค่า'>();
    for (const [pid, std] of standardsMap) {
      if (std.units_per_layer > 0) {
        unitsPerLayerMap.set(pid, std.units_per_layer);
        dataSourceMap.set(pid, 'มาตรฐาน');
      }
    }

    try {
      const { data: layoutItems, error } = await supabase
        .from('trip_packing_layout_items')
        .select(`quantity, layer_index, delivery_trip_item_id, delivery_trip_items!inner (product_id)`)
        .limit(500);
      if (!error && layoutItems && layoutItems.length > 0) {
        const relevant = layoutItems.filter((item: any) => {
          const pid = item.delivery_trip_items?.product_id;
          return productIds.includes(pid) && item.layer_index !== null;
        });
        const productLayerData = new Map<string, number[]>();
        for (const item of relevant) {
          const pid = (item as any).delivery_trip_items?.product_id;
          if (!pid) continue;
          if (dataSourceMap.get(pid) === 'มาตรฐาน') continue;
          const existing = productLayerData.get(pid) || [];
          existing.push(Number(item.quantity));
          productLayerData.set(pid, existing);
        }
        for (const [pid, quantities] of productLayerData) {
          if (quantities.length > 0 && !unitsPerLayerMap.has(pid)) {
            const avg = quantities.reduce((a, b) => a + b, 0) / quantities.length;
            unitsPerLayerMap.set(pid, Math.round(avg));
            dataSourceMap.set(pid, 'ประวัติจริง');
          }
        }
      }
    } catch (err) {
      console.warn('[tripMetricsService] _computePackingPlanCore: layout query error', err);
    }

    const DEFAULT_UNITS_PER_LAYER = 10;
    interface ProductPlan { product_id: string; product_name: string; quantity: number; weight_kg: number; units_per_layer: number; layers_needed: number; data_source: 'มาตรฐาน' | 'ประวัติจริง' | 'ประมาณค่า'; }
    const productPlans: ProductPlan[] = params.items
      .filter(i => i.quantity > 0)
      .map(item => {
        const upl = unitsPerLayerMap.get(item.product_id) ?? DEFAULT_UNITS_PER_LAYER;
        const source = dataSourceMap.get(item.product_id) ?? 'ประมาณค่า';
        return { ...item, units_per_layer: upl, layers_needed: Math.ceil(item.quantity / upl), data_source: source };
      })
      .sort((a, b) => b.weight_kg - a.weight_kg);

    const totalLayers = productPlans.reduce((s, p) => s + p.layers_needed, 0);
    const totalPalletsNeeded = Math.ceil(totalLayers / MAX_LAYERS_PER_PALLET);
    const vehicleMax = params.vehicleMaxPallets ?? null;

    interface PalletPlan { pallet_index: number; items: Array<{ product_name: string; quantity: number; layers: number; weight_kg: number; layer_start: number }>; total_layers: number; total_weight_kg: number; }
    const pallets: PalletPlan[] = [];
    let currentPallet: PalletPlan = { pallet_index: 1, items: [], total_layers: 0, total_weight_kg: 0 };

    for (const plan of productPlans) {
      let remaining = plan.layers_needed;
      let remainingQty = plan.quantity;
      while (remaining > 0) {
        const available = MAX_LAYERS_PER_PALLET - currentPallet.total_layers;
        if (available <= 0) {
          pallets.push(currentPallet);
          currentPallet = { pallet_index: pallets.length + 1, items: [], total_layers: 0, total_weight_kg: 0 };
          continue;
        }
        const layersToUse = Math.min(remaining, available);
        const qtyForThis = Math.min(remainingQty, layersToUse * plan.units_per_layer);
        const weightForThis = plan.quantity > 0 ? (plan.weight_kg * qtyForThis / plan.quantity) : 0;
        currentPallet.items.push({ product_name: plan.product_name, quantity: qtyForThis, layers: layersToUse, weight_kg: weightForThis, layer_start: currentPallet.total_layers });
        currentPallet.total_layers += layersToUse;
        currentPallet.total_weight_kg += weightForThis;
        remaining -= layersToUse;
        remainingQty -= qtyForThis;
      }
    }
    if (currentPallet.items.length > 0) pallets.push(currentPallet);

    const floorItems: Array<{ product_name: string; quantity: number; weight_kg: number; reason: string }> = [];
    if (vehicleMax && vehicleMax > totalPalletsNeeded) {
      for (const pallet of pallets) {
        const smallItems = pallet.items.filter(i => i.layers === 1 && i.weight_kg < 50);
        for (const smallItem of smallItems) {
          floorItems.push({
            product_name: smallItem.product_name,
            quantity: smallItem.quantity,
            weight_kg: smallItem.weight_kg,
            reason: `จำนวนน้อย (${smallItem.quantity} หน่วย, ${smallItem.weight_kg.toFixed(0)} kg) — วางแยกบนพื้นรถได้ ง่ายต่อการหยิบ`,
          });
          pallet.items = pallet.items.filter(i => i !== smallItem);
          pallet.total_layers -= smallItem.layers;
          pallet.total_weight_kg -= smallItem.weight_kg;
        }
      }
    }

    lines.push('🔧 ร่างแผนจัดเรียงจากระบบ (Rule-based — คำนวณจากประวัติ layout จริง):');
    lines.push('');
    lines.push('📐 การประมาณจำนวนชั้น:');
    for (const plan of productPlans) {
      lines.push(`  • ${plan.product_name}: ${plan.quantity} หน่วย ÷ ${plan.units_per_layer} ต่อชั้น = ${plan.layers_needed} ชั้น (${plan.data_source}) น้ำหนัก ${plan.weight_kg.toFixed(0)} kg`);
    }
    lines.push(`  → รวมทั้งหมด: ${totalLayers} ชั้น = ${totalPalletsNeeded} พาเลท (พาเลทละ ${MAX_LAYERS_PER_PALLET} ชั้น)`);
    if (vehicleMax) lines.push(`  → รถรองรับ: ${vehicleMax} พาเลท | ใช้: ${totalPalletsNeeded} | ว่าง: ${Math.max(0, vehicleMax - totalPalletsNeeded)} ตำแหน่ง`);
    lines.push('');
    lines.push('📋 แผนจัดเรียงแนะนำ (หนักอยู่ล่าง → เบาอยู่บน):');
    for (const pallet of pallets.filter(p => p.items.length > 0)) {
      lines.push(`  พาเลทที่ ${pallet.pallet_index} (${pallet.total_layers} ชั้น, ${pallet.total_weight_kg.toFixed(0)} kg):`);
      for (const item of pallet.items) {
        const layerEnd = item.layer_start + item.layers;
        const layerLabel = item.layers === 1 ? `ชั้น ${item.layer_start + 1}` : `ชั้น ${item.layer_start + 1}-${layerEnd}`;
        let position = item.layer_start === 0 ? ' (ล่างสุด)' : layerEnd >= pallet.total_layers ? ' (บนสุด)' : '';
        lines.push(`    ${layerLabel}${position}: ${item.product_name} ${item.quantity} หน่วย (${item.weight_kg.toFixed(0)} kg)`);
      }
    }
    if (floorItems.length > 0) {
      lines.push(''); lines.push('  🚛 วางบนพื้นรถ (แยกจากพาเลท):');
      for (const item of floorItems) lines.push(`    • ${item.product_name}: ${item.quantity} หน่วย — ${item.reason}`);
    }
    lines.push('');
    lines.push('⚠️ นี่คือร่างแผนจากระบบ — AI กรุณาตรวจสอบ ปรับ และเสนอความเห็นเพิ่มเติมจากข้อมูลประวัติ');

    return { productPlans, pallets, totalPalletsNeeded, totalLayers, floorItems, lines };
  },

  /**
   * ดึงคำแนะนำการจัดเรียงสำหรับ simulation (รวม pattern insights + product profiles + packing plan)
   * ใช้ในหน้า Packing Simulation — ไม่บันทึกลง DB
   */
  getSimulationSuggestions: async (params: {
    tripId: string;
    vehicleId?: string | null;
    items: Array<{
      product_id: string;
      product_name: string;
      quantity: number;
      weight_kg: number;
    }>;
    vehicleMaxPallets?: number | null;
  }): Promise<string> => {
    const sections: string[] = [];
    const productIds = params.items.length > 0 ? [...new Set(params.items.map((i) => i.product_id))] : [];

    try {
      const [patternInsights, productProfiles, packingPlan, standardsMap] = await Promise.all([
        tripMetricsService.getPackingPatternInsights(),
        params.vehicleId && params.items.length > 0
          ? tripMetricsService.getProductPackingProfiles(
              productIds,
              params.vehicleId
            )
          : '',
        params.items.length > 0
          ? tripMetricsService.computePackingPlan({
              items: params.items.map((i) => ({
                product_id: i.product_id,
                product_name: i.product_name,
                quantity: i.quantity,
                weight_kg: i.weight_kg,
              })),
              vehicleMaxPallets: params.vehicleMaxPallets ?? null,
            })
          : '',
        productIds.length > 0 ? tripMetricsService.getPackingStandards(productIds) : Promise.resolve(new Map()),
      ]);

      if (standardsMap.size > 0) {
        const nameById = new Map(params.items.map((i) => [i.product_id, i.product_name]));
        const stdLines = Array.from(standardsMap.entries()).map(([pid, std]) => {
          const name = nameById.get(pid) || 'สินค้า';
          return `  • ${name}: ชั้นละ ${std.units_per_layer} ชิ้น, พาเลทละ ${std.total_units} ชิ้น${std.config_name ? ` (${std.config_name})` : ''}`;
        });
        sections.push('📐 มาตรฐานการจัดเรียง (จากระบบ):\n' + stdLines.join('\n'));
      }
      if (patternInsights.trim()) {
        sections.push(patternInsights);
      }
      if (productProfiles.trim()) {
        sections.push('📦 ประวัติการจัดสินค้านี้ (ตามรถ):\n' + productProfiles);
      }
      if (packingPlan.trim()) {
        sections.push(packingPlan);
      }
    } catch (err) {
      console.error('[tripMetricsService] getSimulationSuggestions error:', err);
      return 'ไม่สามารถโหลดคำแนะนำได้ กรุณาลองใหม่ในภายหลัง';
    }

    return sections.length > 0 ? sections.join('\n\n---\n\n') : 'ไม่มีข้อมูลแนะนำสำหรับทริปนี้';
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
      .select('id, delivery_trip_store_id, product_id, quantity, selected_pallet_config_id, is_bonus, unit')
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
        packaging_type:
          ((item as { unit?: string | null }).unit != null &&
          String((item as { unit?: string | null }).unit).trim() !== ''
            ? String((item as { unit?: string | null }).unit).trim()
            : null) ||
          product?.packaging_type ||
          null,
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
