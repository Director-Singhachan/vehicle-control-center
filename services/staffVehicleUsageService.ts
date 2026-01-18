import { supabase } from '../lib/supabase';
import type { Database } from '../types/database';

type VehicleRow = Database['public']['Tables']['vehicles']['Row'];

interface CrewHistoryRow {
  delivery_trip_id: string;
  trip_number: string | null;
  staff_id: string;
  staff_name: string;
  role: string;
  status: string;
  start_at: string;
  end_at: string | null;
  reason_for_change: string | null;
  replaced_by_name: string | null;
  created_at: string;
}

export interface StaffVehicleUsageTripRow {
  delivery_trip_id: string;
  trip_number: string | null;
  planned_date: string | null;
  trip_status: string | null;
  vehicle_id: string | null;
  vehicle_plate: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  role: string | null;
  crew_status: string | null;
  start_at: string | null;
  end_at: string | null;
  distance_km: number | null;
  duration_hours: number | null;
  reason_for_change: string | null;
  replaced_by_name: string | null;
}

export interface StaffVehicleUsageSummary {
  staff_id: string;
  from: string | null;
  to: string | null;
  total_trips: number;
  vehicles_used: number;
  total_distance_km: number;
  total_duration_hours: number;
  last_activity_at: string | null;
  role_counts: {
    driver: number;
    helper: number;
  };
}

export interface GetStaffVehicleUsageParams {
  from?: string;
  to?: string;
  limit?: number;
}

const diffHours = (start: string | null, end: string | null): number | null => {
  if (!start || !end) return null;
  const s = new Date(start);
  const e = new Date(end);
  const ms = e.getTime() - s.getTime();
  if (!Number.isFinite(ms) || ms <= 0) return null;
  return ms / (1000 * 60 * 60);
};

export const staffVehicleUsageService = {
  getStaffVehicleUsage: async (
    staffId: string,
    params: GetStaffVehicleUsageParams = {}
  ): Promise<{ summary: StaffVehicleUsageSummary; trips: StaffVehicleUsageTripRow[] }> => {
    const limit = params.limit ?? 200;

    let historyQuery = (supabase as any)
      .from('delivery_trip_crew_history')
      .select('*')
      .eq('staff_id', staffId)
      .order('start_at', { ascending: false })
      .limit(limit);

    if (params.from) {
      historyQuery = historyQuery.gte('start_at', params.from);
    }
    if (params.to) {
      historyQuery = historyQuery.lte('start_at', params.to);
    }

    const { data: historyRows, error: historyError } = await historyQuery;

    if (historyError) {
      console.error('[staffVehicleUsageService] Error fetching crew history:', historyError);
      throw historyError;
    }

    const history = (historyRows || []) as CrewHistoryRow[];
    const tripIds = Array.from(new Set(history.map(r => r.delivery_trip_id).filter(Boolean)));

    if (tripIds.length === 0) {
      return {
        summary: {
          staff_id: staffId,
          from: params.from ?? null,
          to: params.to ?? null,
          total_trips: 0,
          vehicles_used: 0,
          total_distance_km: 0,
          total_duration_hours: 0,
          last_activity_at: null,
          role_counts: { driver: 0, helper: 0 },
        },
        trips: [],
      };
    }

    const [{ data: trips, error: tripsError }, { data: tripLogs, error: logsError }] = await Promise.all([
      supabase
        .from('delivery_trips')
        .select('id, trip_number, planned_date, status, vehicle_id, odometer_start, odometer_end')
        .in('id', tripIds),
      supabase
        .from('trip_logs')
        .select('id, delivery_trip_id, distance_km, manual_distance_km, duration_hours, checkout_time, checkin_time, status, vehicle_id')
        .in('delivery_trip_id', tripIds),
    ]);

    if (tripsError) {
      console.error('[staffVehicleUsageService] Error fetching delivery trips:', tripsError);
      throw tripsError;
    }

    if (logsError) {
      console.error('[staffVehicleUsageService] Error fetching trip logs:', logsError);
    }

    const tripList = (trips || []) as Array<Record<string, any>>;
    const vehicleIds = Array.from(new Set(tripList.map(t => t.vehicle_id).filter(Boolean)));

    const { data: vehicles, error: vehiclesError } = vehicleIds.length
      ? await supabase
          .from('vehicles')
          .select('id, plate, make, model')
          .in('id', vehicleIds)
      : { data: [], error: null };

    if (vehiclesError) {
      console.error('[staffVehicleUsageService] Error fetching vehicles:', vehiclesError);
      throw vehiclesError;
    }

    const tripMap = new Map(tripList.map(t => [t.id, t]));
    const vehicleMap = new Map<string, Pick<VehicleRow, 'id' | 'plate' | 'make' | 'model'>>(
      (vehicles || []).map((v: any) => [v.id, v])
    );

    const tripLogByTripId = new Map<string, any>();
    (tripLogs || []).forEach((l: any) => {
      if (!l?.delivery_trip_id) return;
      if (!tripLogByTripId.has(l.delivery_trip_id)) {
        tripLogByTripId.set(l.delivery_trip_id, l);
        return;
      }

      const existing = tripLogByTripId.get(l.delivery_trip_id);
      const existingTs = existing?.checkout_time ? new Date(existing.checkout_time).getTime() : 0;
      const newTs = l?.checkout_time ? new Date(l.checkout_time).getTime() : 0;
      if (newTs > existingTs) {
        tripLogByTripId.set(l.delivery_trip_id, l);
      }
    });

    const computeDistance = (trip: any, log: any): number | null => {
      if (log && typeof log.distance_km === 'number') return log.distance_km;
      if (log && typeof log.manual_distance_km === 'number') return log.manual_distance_km;
      if (
        trip &&
        typeof trip.odometer_start === 'number' &&
        typeof trip.odometer_end === 'number' &&
        trip.odometer_end >= trip.odometer_start
      ) {
        return trip.odometer_end - trip.odometer_start;
      }
      return null;
    };

    const computeDuration = (log: any): number | null => {
      if (log && typeof log.duration_hours === 'number') return log.duration_hours;
      if (log && log.checkout_time && log.checkin_time) {
        const h = diffHours(log.checkout_time, log.checkin_time);
        if (typeof h === 'number') return h;
      }
      return null;
    };

    const enrichedRows: StaffVehicleUsageTripRow[] = history.map((h) => {
      const trip = tripMap.get(h.delivery_trip_id);
      const log = tripLogByTripId.get(h.delivery_trip_id);
      const vehicle = trip?.vehicle_id ? vehicleMap.get(trip.vehicle_id) : undefined;
      const distance = computeDistance(trip, log);
      const duration = computeDuration(log);

      return {
        delivery_trip_id: h.delivery_trip_id,
        trip_number: trip?.trip_number ?? h.trip_number ?? null,
        planned_date: trip?.planned_date ?? null,
        trip_status: trip?.status ?? null,
        vehicle_id: trip?.vehicle_id ?? log?.vehicle_id ?? null,
        vehicle_plate: vehicle?.plate ?? null,
        vehicle_make: vehicle?.make ?? null,
        vehicle_model: vehicle?.model ?? null,
        role: h.role ?? null,
        crew_status: h.status ?? null,
        start_at: h.start_at ?? null,
        end_at: h.end_at ?? null,
        distance_km: distance,
        duration_hours: duration,
        reason_for_change: h.reason_for_change ?? null,
        replaced_by_name: h.replaced_by_name ?? null,
      };
    });

    const tripIdToDistance = new Map<string, number>();
    const tripIdToDuration = new Map<string, number>();
    const tripIdToVehicle = new Map<string, string>();
    const tripIdToPlanned = new Map<string, string>();

    tripIds.forEach((id) => {
      const trip = tripMap.get(id);
      const log = tripLogByTripId.get(id);
      const dist = computeDistance(trip, log);
      const dur = computeDuration(log);

      if (typeof dist === 'number') tripIdToDistance.set(id, dist);
      if (typeof dur === 'number') tripIdToDuration.set(id, dur);

      const vehicleId = trip?.vehicle_id ?? log?.vehicle_id;
      if (vehicleId) tripIdToVehicle.set(id, vehicleId);

      if (trip?.planned_date) tripIdToPlanned.set(id, trip.planned_date);
    });

    const vehiclesUsed = new Set(Array.from(tripIdToVehicle.values()));

    const totalDistanceKm = Array.from(tripIdToDistance.values()).reduce((a, b) => a + b, 0);
    const totalDurationHours = Array.from(tripIdToDuration.values()).reduce((a, b) => a + b, 0);

    const roleTripIds = {
      driver: new Set<string>(),
      helper: new Set<string>(),
    };

    enrichedRows.forEach((r) => {
      if (!r.delivery_trip_id) return;
      if (r.role === 'driver') roleTripIds.driver.add(r.delivery_trip_id);
      if (r.role === 'helper') roleTripIds.helper.add(r.delivery_trip_id);
    });

    const lastActivityAt = Array.from(tripIdToPlanned.values()).sort().slice(-1)[0] ?? null;

    return {
      summary: {
        staff_id: staffId,
        from: params.from ?? null,
        to: params.to ?? null,
        total_trips: tripIds.length,
        vehicles_used: vehiclesUsed.size,
        total_distance_km: totalDistanceKm,
        total_duration_hours: totalDurationHours,
        last_activity_at: lastActivityAt,
        role_counts: {
          driver: roleTripIds.driver.size,
          helper: roleTripIds.helper.size,
        },
      },
      trips: enrichedRows,
    };
  },
};
