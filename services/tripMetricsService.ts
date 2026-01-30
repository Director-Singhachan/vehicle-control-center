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
   * ดึงข้อมูลพื้นฐานของทริป (จำนวนสินค้า, ระยะทาง, ระยะเวลา) จากข้อมูลที่มีอยู่แล้ว
   * ใช้สำหรับเติมข้อมูลที่สามารถคำนวณได้จากระบบเดิม
   */
  getTripBasicData: async (tripId: string): Promise<{
    total_products_quantity: number;
    total_items_count: number;
    stores_count: number;
    distance_km: number | null;
    duration_hours: number | null;
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

    // ดึงจำนวนสินค้าและร้าน
    const { data: items, error: itemsError } = await supabase
      .from('delivery_trip_items')
      .select('quantity, delivery_trip_store_id')
      .eq('delivery_trip_id', tripId);

    if (itemsError) {
      console.error('[tripMetricsService] getTripBasicData items error:', itemsError);
      throw itemsError;
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
};
