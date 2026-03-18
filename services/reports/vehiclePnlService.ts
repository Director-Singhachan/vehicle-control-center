/**
 * Vehicle P&L Report Service (Phase 5)
 * กำไรสุทธิรถ 1 คัน, ต้นทุนจอดทิ้ง (Idle Cost), Utilization, ต้นทุนต่อกม./เที่ยว/ชิ้น
 * รวมต้นทุนบุคลากรต่อเที่ยว (จาก staff_salaries + delivery_trip_crews)
 */
import { supabase } from '../../lib/supabase';
import {
  getVehicleCostSummaryPhase2,
  daysInRange,
} from '../vehicleCostService';
import { getTripPnlList } from './tripPnlService';

export interface VehiclePnlOptions {
  vehicleId: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;
}

export interface VehiclePnlSummary {
  vehicle_id: string;
  start_date: string;
  end_date: string;
  days_in_filter: number;
  days_with_work: number;
  revenue: number;
  total_fixed: number;
  total_variable: number;
  /** ต้นทุนบุคลากรรวม (จากลูกเรือเที่ยว × เงินเดือนปันส่วน) */
  total_personnel: number;
  total_cost: number;
  daily_fixed_cost: number;
  net_profit: number;
  idle_cost: number;
  utilization: number; // 0–1
  total_distance_km: number;
  total_trips: number;
  total_pieces: number;
  cost_per_km: number | null;
  cost_per_trip: number | null;
  cost_per_piece: number | null;
}

/**
 * ดึงสรุป P&L รถ 1 คัน ในช่วงวันที่
 */
export async function getVehiclePnlSummary(
  options: VehiclePnlOptions
): Promise<VehiclePnlSummary | null> {
  const { vehicleId, startDate, endDate } = options;
  const startStr = startDate.split('T')[0];
  const endStr = endDate.split('T')[0];
  const startDateTime = `${startStr}T00:00:00.000Z`;
  const endDateTime = `${endStr}T23:59:59.999Z`;

  const days_in_filter = daysInRange(startStr, endStr);
  if (days_in_filter <= 0) return null;

  const [costSummary, tripsRes, tripLogsRes, total_pieces] = await Promise.all([
    getVehicleCostSummaryPhase2({ vehicleId, startDate: startStr, endDate: endStr }),
    supabase
      .from('delivery_trips_ready_for_pnl')
      .select('id, trip_revenue')
      .eq('vehicle_id', vehicleId)
      .gte('planned_date', startStr)
      .lte('planned_date', endStr),
    supabase
      .from('trip_logs')
      .select('checkout_time, distance_km, manual_distance_km, odometer_start, odometer_end')
      .eq('vehicle_id', vehicleId)
      .gte('checkout_time', startDateTime)
      .lte('checkout_time', endDateTime),
    (async () => {
      const { data: trips } = await supabase
        .from('delivery_trips_ready_for_pnl')
        .select('id')
        .eq('vehicle_id', vehicleId)
        .gte('planned_date', startStr)
        .lte('planned_date', endStr);
      const tripIds = (trips ?? []).map((t) => t.id);
      if (tripIds.length === 0) return 0;
      const { data: stores } = await supabase
        .from('delivery_trip_stores')
        .select('id')
        .in('delivery_trip_id', tripIds);
      const storeIds = (stores ?? []).map((s) => s.id);
      if (storeIds.length === 0) return 0;
      const { data: items } = await supabase
        .from('delivery_trip_items')
        .select('quantity')
        .in('delivery_trip_store_id', storeIds);
      return (items ?? []).reduce((sum, r) => sum + (Number(r.quantity) || 0), 0);
    })(),
  ]);

  const revenue = (tripsRes.data ?? []).reduce(
    (s, r) => s + (Number((r as { trip_revenue?: number | null }).trip_revenue) || 0),
    0
  );

  const total_trips = tripsRes.data?.length ?? 0;

  const daysSet = new Set<string>();
  for (const log of tripLogsRes.data ?? []) {
    const t = (log as { checkout_time?: string }).checkout_time;
    if (t) daysSet.add(t.split('T')[0]);
  }
  const days_with_work = daysSet.size;

  let total_distance_km = 0;
  for (const log of tripLogsRes.data ?? []) {
    const r = log as {
      manual_distance_km?: number | null;
      distance_km?: number | null;
      odometer_start?: number | null;
      odometer_end?: number | null;
    };
    const d =
      r.manual_distance_km != null
        ? r.manual_distance_km
        : r.distance_km != null
          ? r.distance_km
          : r.odometer_start != null && r.odometer_end != null && r.odometer_end > r.odometer_start
            ? r.odometer_end - r.odometer_start
            : null;
    if (d != null) total_distance_km += Number(d);
  }

  const total_fixed = costSummary.total_fixed;
  const total_variable = costSummary.total_variable;
  const tripRows = await getTripPnlList({
    startDate: startStr,
    endDate: endStr,
    vehicleId,
  });
  const total_personnel = tripRows.reduce((s, r) => s + r.personnel_cost, 0);
  const total_cost = total_fixed + total_variable + total_personnel;
  const daily_fixed_cost = costSummary.daily_fixed_cost;
  const net_profit = revenue - total_cost;
  const idle_cost = daily_fixed_cost * Math.max(0, days_in_filter - days_with_work);
  const utilization = days_in_filter > 0 ? days_with_work / days_in_filter : 0;

  const cost_per_km =
    total_distance_km > 0 ? total_cost / total_distance_km : null;
  const cost_per_trip = total_trips > 0 ? total_cost / total_trips : null;
  const cost_per_piece = total_pieces > 0 ? total_cost / total_pieces : null;

  return {
    vehicle_id: vehicleId,
    start_date: startStr,
    end_date: endStr,
    days_in_filter,
    days_with_work,
    revenue,
    total_fixed,
    total_variable,
    total_personnel,
    total_cost,
    daily_fixed_cost,
    net_profit,
    idle_cost,
    utilization,
    total_distance_km,
    total_trips,
    total_pieces,
    cost_per_km,
    cost_per_trip,
    cost_per_piece,
  };
}
