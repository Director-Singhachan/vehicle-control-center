/**
 * Trip P&L Report Service (Phase 4)
 * คำนวณรายได้ ต้นทุนผันแปร ต้นทุนคงที่×วันเที่ยว และกำไรสุทธิต่อเที่ยว
 * ปรับเป็น batch queries เพื่อลดจำนวนรอบการเชื่อมต่อ DB (โหลดเร็วขึ้นเมื่อข้อมูลเยอะ)
 */
import { supabase } from '../../lib/supabase';
import {
  getTotalProratedFixedCostAndDailyRate,
  daysInRange,
} from '../vehicleCostService';

export interface TripPnlOptions {
  startDate: string; // YYYY-MM-DD
  endDate: string;
  vehicleId?: string | null;
}

/** รายละเอียดต้นทุนผันแปร (สำหรับแสดงภาพการคำนวณ) */
export interface TripPnlVariableBreakdown {
  /** ต้นทุนอื่นผูกเที่ยว (vehicle_variable_costs + commission_logs) */
  other: number;
  /** ค่าน้ำมันในช่วงวันเที่ยว */
  fuel: number;
}

/** ที่มาของจำนวนวันเที่ยว */
export type TripDaysSource = 'trip_start_end' | 'trip_log' | 'planned_date';

export interface TripPnlRow {
  tripId: string;
  trip_number: string | null;
  planned_date: string;
  vehicle_id: string;
  vehicle_plate?: string | null;
  revenue: number;
  trip_days: number;
  variable_cost: number;
  fixed_cost: number; // daily_fixed_cost × trip_days
  net_profit: number;
  /** สำหรับแสดงภาพการคำนวณใน UI */
  breakdown?: {
    variable: TripPnlVariableBreakdown;
    days_source: TripDaysSource;
    date_range: { start: string; end: string };
    daily_fixed_cost: number;
  };
}

type TripWithDates = {
  id: string;
  vehicle_id: string;
  trip_number: string | null;
  planned_date: string;
  trip_revenue: number | null;
  trip_start_date: string | null;
  trip_end_date: string | null;
};

/** คำนวณจำนวนวันและช่วงวันของเที่ยว (จากฟิลด์เที่ยว หรือจาก trip_log ถ้าไม่มี) */
function getTripRangeFromFields(trip: TripWithDates): { days: number; start: string; end: string } | null {
  const startStr = trip.trip_start_date?.split('T')[0];
  const endStr = trip.trip_end_date?.split('T')[0];
  if (startStr && endStr) {
    const days = daysInRange(startStr, endStr);
    return { days: Math.max(1, days), start: startStr, end: endStr };
  }
  return null;
}

/** รวมต้นทุนจาก fuel record หนึ่งรายการ */
function fuelCost(r: { total_cost?: number | null; liters?: number | null; price_per_liter?: number | null }): number {
  const c = r.total_cost ?? (Number(r.liters) ?? 0) * (Number(r.price_per_liter) ?? 0);
  return Number(c) || 0;
}

/**
 * ดึงรายการ Trip P&L ในช่วงวันที่ (และตาม vehicle ถ้าระบุ)
 * ใช้ batch queries: ดึงทุกเที่ยว + ข้อมูลเสริมครั้งเดียว แล้วคำนวณใน memory
 */
export async function getTripPnlList(options: TripPnlOptions): Promise<TripPnlRow[]> {
  const { startDate, endDate, vehicleId } = options;
  const startStr = startDate.split('T')[0];
  const endStr = endDate.split('T')[0];
  const startDateTime = `${startStr}T00:00:00.000Z`;
  const endDateTime = `${endStr}T23:59:59.999Z`;

  // 1) ดึงเที่ยวทั้งหมดในช่วง
  let query = supabase
    .from('delivery_trips')
    .select('id, trip_number, planned_date, vehicle_id, trip_revenue, trip_start_date, trip_end_date')
    .gte('planned_date', startStr)
    .lte('planned_date', endStr)
    .order('planned_date', { ascending: true })
    .order('created_at', { ascending: true });

  if (vehicleId) {
    query = query.eq('vehicle_id', vehicleId);
  }

  const { data: tripsData, error } = await query;
  if (error) throw error;
  const trips = (tripsData ?? []) as TripWithDates[];
  if (!trips.length) return [];

  const tripIds = trips.map((t) => t.id);
  const vehicleIds = [...new Set(trips.map((t) => t.vehicle_id))];

  // 2) Batch: รถ (plate), trip_logs สำหรับเที่ยวที่ไม่มี start/end, ต้นทุนผันแปร, ค่าคอม, น้ำมัน
  const needLogIds = trips
    .filter((t) => !getTripRangeFromFields(t))
    .map((t) => t.id);

  const [
    vehiclesRes,
    tripLogsRes,
    variableCostsRes,
    commissionRes,
    fuelRes,
  ] = await Promise.all([
    supabase.from('vehicles').select('id, plate').in('id', vehicleIds),
    needLogIds.length > 0
      ? supabase
          .from('trip_logs')
          .select('delivery_trip_id, checkout_time, checkin_time')
          .in('delivery_trip_id', needLogIds)
          .order('checkout_time', { ascending: true })
      : Promise.resolve({ data: [] as { delivery_trip_id: string; checkout_time: string; checkin_time: string | null }[] }),
    supabase
      .from('vehicle_variable_costs')
      .select('delivery_trip_id, amount')
      .in('delivery_trip_id', tripIds),
    supabase
      .from('commission_logs')
      .select('delivery_trip_id, actual_commission')
      .in('delivery_trip_id', tripIds),
    supabase
      .from('fuel_records')
      .select('vehicle_id, filled_at, total_cost, liters, price_per_liter')
      .in('vehicle_id', vehicleIds)
      .gte('filled_at', startDateTime)
      .lte('filled_at', endDateTime),
  ]);

  const vehicles = vehiclesRes.data ?? [];
  const plateByVehicle = new Map<string, string | null>(
    vehicles.map((v: { id: string; plate: string | null }) => [v.id, v.plate])
  );

  // tripId -> { start, end, days } จาก trip_log (ใช้เที่ยวที่ยังไม่มี range)
  const rangeByTripFromLog = new Map<string, { start: string; end: string; days: number }>();
  for (const row of tripLogsRes.data ?? []) {
    const id = (row as { delivery_trip_id?: string }).delivery_trip_id;
    if (!id || rangeByTripFromLog.has(id)) continue;
    const checkout = (row as { checkout_time: string }).checkout_time;
    const checkin = (row as { checkin_time: string | null }).checkin_time;
    if (!checkout) continue;
    const start = checkout.split('T')[0];
    const end = (checkin || new Date().toISOString()).split('T')[0];
    rangeByTripFromLog.set(id, { start, end, days: Math.max(1, daysInRange(start, end)) });
  }

  // tripId -> ต้นทุนผันแปร (variable_costs + commission)
  const variableByTrip = new Map<string, number>();
  for (const r of variableCostsRes.data ?? []) {
    const id = (r as { delivery_trip_id: string; amount: number }).delivery_trip_id;
    const amt = Number((r as { amount: number }).amount) || 0;
    variableByTrip.set(id, (variableByTrip.get(id) ?? 0) + amt);
  }
  for (const r of commissionRes.data ?? []) {
    const id = (r as { delivery_trip_id: string }).delivery_trip_id;
    const amt = Number((r as { actual_commission: number | null }).actual_commission) || 0;
    variableByTrip.set(id, (variableByTrip.get(id) ?? 0) + amt);
  }

  // น้ำมัน: รายการทั้งหมดในช่วง (ใช้กรองต่อตามช่วงวันเที่ยว)
  const fuelRecords = (fuelRes.data ?? []) as {
    vehicle_id: string;
    filled_at: string;
    total_cost?: number | null;
    liters?: number | null;
    price_per_liter?: number | null;
  }[];

  // 3) Daily fixed cost ต่อรถ (ครั้งเดียวต่อรถ ไม่ใช่ต่อเที่ยว) — ใช้ช่วง filter
  const dailyFixedByVehicle = new Map<string, number>();
  await Promise.all(
    vehicleIds.map(async (vid: string) => {
      const { dailyFixedCost } = await getTotalProratedFixedCostAndDailyRate({
        vehicleId: vid,
        startDate: startStr,
        endDate: endStr,
      });
      dailyFixedByVehicle.set(vid, dailyFixedCost);
    })
  );

  // 4) สร้างแถวผลลัพธ์ (คำนวณใน memory)
  const rows: TripPnlRow[] = [];
  for (const t of trips) {
    const tid = t.id;
    let range = getTripRangeFromFields(t);
    if (!range) {
      range = rangeByTripFromLog.get(tid) ?? {
        start: (t.planned_date ?? '').split('T')[0] || startStr,
        end: (t.planned_date ?? '').split('T')[0] || startStr,
        days: 1,
      };
    }

    const revenue = Number(t.trip_revenue) || 0;
    const otherVariable = variableByTrip.get(tid) ?? 0;
    let fuelVariable = 0;
    const tripStart = `${range.start}T00:00:00.000Z`;
    const tripEnd = `${range.end}T23:59:59.999Z`;
    for (const f of fuelRecords) {
      if (f.vehicle_id !== t.vehicle_id) continue;
      if (f.filled_at >= tripStart && f.filled_at <= tripEnd) {
        fuelVariable += fuelCost(f);
      }
    }
    const variable_cost = otherVariable + fuelVariable;

    const dailyFixed = dailyFixedByVehicle.get(t.vehicle_id) ?? 0;
    const fixed_cost = dailyFixed * range.days;
    const net_profit = revenue - variable_cost - fixed_cost;

    const daysSource: TripDaysSource = getTripRangeFromFields(t)
      ? 'trip_start_end'
      : rangeByTripFromLog.has(tid)
        ? 'trip_log'
        : 'planned_date';

    rows.push({
      tripId: tid,
      trip_number: t.trip_number != null ? String(t.trip_number) : null,
      planned_date: String(t.planned_date ?? ''),
      vehicle_id: String(t.vehicle_id),
      vehicle_plate: plateByVehicle.get(t.vehicle_id) ?? null,
      revenue,
      trip_days: range.days,
      variable_cost,
      fixed_cost,
      net_profit,
      breakdown: {
        variable: { other: otherVariable, fuel: fuelVariable },
        days_source: daysSource,
        date_range: { start: range.start, end: range.end },
        daily_fixed_cost: dailyFixed,
      },
    });
  }
  return rows;
}
