// Trip Metrics Service - บันทึกและดึงข้อมูล metrics หลังจบทริป (AI Trip Optimization)
import { supabase } from '../lib/supabase';

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
   * Export ข้อมูลทริปที่มี metrics สำหรับ ML training (date range)
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
      }
    >
  > => {
    const { data, error } = await supabase
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
    return (data ?? []) as Array<
      TripMetrics & {
        id: string;
        trip_number: string | null;
        vehicle_id: string;
        planned_date: string;
      }
    >;
  },
};
