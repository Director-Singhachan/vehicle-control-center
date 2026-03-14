// vehicleTripUsageService.ts
// Summarizes vehicle usage by day over a date range using tripLogService.getTripHistory
import { supabase } from '../lib/supabase';
import { tripLogService, type TripLogWithRelations } from './tripLogService';
import { tripHistoryAggregatesService } from './deliveryTrip/tripHistoryAggregatesService';

// ─────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────

export interface VehicleTripDetail {
  trip_log_id: string;
  delivery_trip_id: string | null;
  trip_number: string | null;
  checkout_time: string | null;
  checkin_time: string | null;
  driver_name: string;
  destination: string | null;
  route: string | null;
  notes: string | null;
  distance_km: number | null;
  odometer_start: number | null;
  odometer_end: number | null;
  /** หาก true คือ manual_distance_km ถูกใช้แทน odometer */
  is_manual_distance: boolean;
  status: string;
}

export interface VehicleTripDailySummary {
  date: string; // YYYY-MM-DD
  trip_count: number;
  total_distance_km: number;
  /** รายชื่อคนขับ (ไม่ซ้ำ) */
  drivers: string[];
  trips: VehicleTripDetail[];
}

export interface GetVehicleDailyUsageOptions {
  vehicleId: string;
  startDate: string; // ISO date string or date-time string
  endDate: string;   // ISO date string or date-time string
}

/** สรุปสินค้าแต่ละชนิดที่รถบรรทุกในช่วงวันที่ที่เลือก (รวมทุกทริป) */
export interface VehicleProductSummaryItem {
  product_id: string;
  product_code: string;
  product_name: string;
  category: string;
  unit: string;
  total_quantity: number;
}

/** สรุปต้นทุนของรถในช่วงวันที่ (น้ำมัน + ค่าคอม) */
export interface VehicleCostSummary {
  fuel_cost: number;
  commission_cost: number;
  total_cost: number;
}

/** สรุปรายเดือน: จำนวนทริป, ระยะทาง, ค่าน้ำมัน, ค่าคอม ต่อเดือน */
export interface VehicleMonthlySummary {
  month: string; // YYYY-MM
  trip_count: number;
  total_distance_km: number;
  fuel_cost: number;
  commission_cost: number;
  total_cost: number;
}

// ─────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────

function calcDistance(trip: TripLogWithRelations): number | null {
  if (trip.manual_distance_km !== null && trip.manual_distance_km !== undefined) {
    return trip.manual_distance_km;
  }
  if (trip.odometer_start != null && trip.odometer_end != null && trip.odometer_end > trip.odometer_start) {
    return trip.odometer_end - trip.odometer_start;
  }
  return null;
}

function toLocalDate(isoString: string | null): string | null {
  if (!isoString) return null;
  // Use UTC date portion only (checkout_time is stored in UTC but represents actual time)
  // We use local date relative to Thailand timezone (UTC+7)
  const d = new Date(isoString);
  // Convert to UTC+7 for grouping
  const localDate = new Date(d.getTime() + 7 * 60 * 60 * 1000);
  return localDate.toISOString().split('T')[0];
}

function mapToDetail(trip: TripLogWithRelations): VehicleTripDetail {
  const distance = calcDistance(trip);
  const isManual = trip.manual_distance_km !== null && trip.manual_distance_km !== undefined;
  return {
    trip_log_id: trip.id,
    delivery_trip_id: trip.delivery_trip?.id ?? null,
    trip_number: trip.delivery_trip?.trip_number ?? null,
    checkout_time: trip.checkout_time ?? null,
    checkin_time: trip.checkin_time ?? null,
    driver_name: trip.driver?.full_name ?? 'ไม่ทราบชื่อผู้ขับ',
    destination: trip.destination ?? null,
    route: trip.route ?? null,
    notes: trip.notes ?? null,
    distance_km: distance,
    odometer_start: trip.odometer_start ?? null,
    odometer_end: trip.odometer_end ?? null,
    is_manual_distance: isManual,
    status: trip.status,
  };
}

// ─────────────────────────────────────────────────
// Service
// ─────────────────────────────────────────────────

export const vehicleTripUsageService = {
  /**
   * ดึง trip logs ของรถในช่วงวันที่ที่กำหนด แล้ว group ตามวัน (UTC+7)
   * คืน VehicleTripDailySummary[] เรียงจากวันใหม่ → เก่า
   */
  getVehicleDailyUsage: async (options: GetVehicleDailyUsageOptions): Promise<VehicleTripDailySummary[]> => {
    const { vehicleId, startDate, endDate } = options;

    // ปรับ endDate ให้ครอบ 23:59:59 ของวันสุดท้าย (ถ้าเป็น date เฉยๆ)
    const endDateTime = endDate.includes('T')
      ? endDate
      : `${endDate}T23:59:59.999Z`;

    const startDateTime = startDate.includes('T')
      ? startDate
      : `${startDate}T00:00:00.000Z`;

    const { data: trips } = await tripLogService.getTripHistory({
      vehicle_id: vehicleId,
      start_date: startDateTime,
      end_date: endDateTime,
      limit: 1000,
    });

    // Group ตามวัน UTC+7
    const dayMap = new Map<string, TripLogWithRelations[]>();

    for (const trip of trips) {
      const dateKey = toLocalDate(trip.checkout_time) ?? 'unknown';
      if (!dayMap.has(dateKey)) {
        dayMap.set(dateKey, []);
      }
      dayMap.get(dateKey)!.push(trip);
    }

    const results: VehicleTripDailySummary[] = [];

    for (const [date, dayTrips] of dayMap.entries()) {
      if (date === 'unknown') continue;

      const driverSet = new Set<string>();
      let totalDistance = 0;

      for (const t of dayTrips) {
        const name = t.driver?.full_name;
        if (name) driverSet.add(name);
        const d = calcDistance(t);
        if (d !== null) totalDistance += d;
      }

      results.push({
        date,
        trip_count: dayTrips.length,
        total_distance_km: totalDistance,
        drivers: Array.from(driverSet),
        trips: dayTrips.map(mapToDetail),
      });
    }

    // เรียงจากวันใหม่ → เก่า
    results.sort((a, b) => b.date.localeCompare(a.date));
    return results;
  },

  /**
   * สรุปผลรวมสินค้าแต่ละชนิดที่รถคันนี้บรรทุกในช่วงวันที่ที่เลือก (รวมทุกทริป delivery)
   * คืน array เรียงจากมากไปน้อยตามจำนวน (total_quantity)
   */
  getVehicleProductSummary: async (
    options: GetVehicleDailyUsageOptions
  ): Promise<VehicleProductSummaryItem[]> => {
    const { vehicleId, startDate, endDate } = options;

    const endDateTime = endDate.includes('T') ? endDate : `${endDate}T23:59:59.999Z`;
    const startDateTime = startDate.includes('T') ? startDate : `${startDate}T00:00:00.000Z`;

    const { data: trips } = await tripLogService.getTripHistory({
      vehicle_id: vehicleId,
      start_date: startDateTime,
      end_date: endDateTime,
      limit: 1000,
    });

    const deliveryTripIds = new Set<string>();
    for (const trip of trips) {
      const id = trip.delivery_trip?.id;
      if (id) deliveryTripIds.add(id);
    }

    const productMap = new Map<
      string,
      { product_code: string; product_name: string; category: string; unit: string; total_quantity: number }
    >();

    // โหลดสินค้าของทุกทริปแบบขนาน แทนทีละทริป
    const tripIdsArray = Array.from(deliveryTripIds);
    const allItemsArrays = await Promise.all(
      tripIdsArray.map((tripId) => tripHistoryAggregatesService.getAggregatedProducts(tripId))
    );

    for (const items of allItemsArrays) {
      for (const item of items) {
        const existing = productMap.get(item.product_id);
        if (existing) {
          existing.total_quantity += item.total_quantity;
        } else {
          productMap.set(item.product_id, {
            product_code: item.product_code,
            product_name: item.product_name,
            category: item.category,
            unit: item.unit,
            total_quantity: item.total_quantity,
          });
        }
      }
    }

    const result: VehicleProductSummaryItem[] = Array.from(productMap.entries()).map(
      ([product_id, v]) => ({
        product_id,
        product_code: v.product_code,
        product_name: v.product_name,
        category: v.category,
        unit: v.unit,
        total_quantity: v.total_quantity,
      })
    );

    result.sort(
      (a, b) =>
        b.total_quantity - a.total_quantity ||
        (a.product_name || a.product_code || '').localeCompare(b.product_name || b.product_code || '')
    );
    return result;
  },

  /**
   * สรุปต้นทุนของรถในช่วงวันที่: ค่าน้ำมัน + ค่าคอม
   * ใช้ fuel_records (filled_at ในช่วง) และ commission_logs ผ่าน delivery_trips (vehicle_id + planned_date ในช่วง)
   */
  getVehicleCostSummary: async (options: GetVehicleDailyUsageOptions): Promise<VehicleCostSummary> => {
    const { vehicleId, startDate, endDate } = options;

    const endDateTime = endDate.includes('T') ? endDate : `${endDate}T23:59:59.999Z`;
    const startDateTime = startDate.includes('T') ? startDate : `${startDate}T00:00:00.000Z`;

    const [fuelResult, tripsResult] = await Promise.all([
      supabase
        .from('fuel_records')
        .select('total_cost, liters, price_per_liter')
        .eq('vehicle_id', vehicleId)
        .gte('filled_at', startDateTime)
        .lte('filled_at', endDateTime),
      supabase
        .from('delivery_trips')
        .select('id')
        .eq('vehicle_id', vehicleId)
        .gte('planned_date', startDate.split('T')[0])
        .lte('planned_date', endDate.split('T')[0]),
    ]);

    let fuel_cost = 0;
    if (!fuelResult.error && fuelResult.data) {
      for (const row of fuelResult.data) {
        const cost = row.total_cost ?? (row.liters ?? 0) * (row.price_per_liter ?? 0);
        fuel_cost += Number(cost) || 0;
      }
    }

    const tripIds = (tripsResult.data ?? []).map((t) => t.id);
    let commission_cost = 0;
    if (tripIds.length > 0) {
      const { data: logs } = await supabase
        .from('commission_logs')
        .select('actual_commission')
        .in('delivery_trip_id', tripIds);
      if (logs) {
        commission_cost = logs.reduce((sum, r) => sum + (Number(r.actual_commission) || 0), 0);
      }
    }

    return {
      fuel_cost,
      commission_cost,
      total_cost: fuel_cost + commission_cost,
    };
  },

  /**
   * สรุปรายเดือน: จำนวนทริป, ระยะทาง, ค่าน้ำมัน, ค่าคอม ต่อเดือน (รถคันเดียว, ในช่วงที่เลือก)
   * คืน array เรียงจากเดือนเก่า → ใหม่
   */
  getVehicleMonthlySummary: async (
    options: GetVehicleDailyUsageOptions
  ): Promise<VehicleMonthlySummary[]> => {
    const { vehicleId, startDate, endDate } = options;

    const endDateTime = endDate.includes('T') ? endDate : `${endDate}T23:59:59.999Z`;
    const startDateTime = startDate.includes('T') ? startDate : `${startDate}T00:00:00.000Z`;
    const startDateOnly = startDate.split('T')[0];
    const endDateOnly = endDate.split('T')[0];
    const startMonth = startDateOnly.slice(0, 7);
    const endMonth = endDateOnly.slice(0, 7);

    const [tripsResult, fuelResult, tripsByMonthResult] = await Promise.all([
      tripLogService.getTripHistory({
        vehicle_id: vehicleId,
        start_date: startDateTime,
        end_date: endDateTime,
        limit: 2000,
      }),
      supabase
        .from('fuel_records')
        .select('filled_at, total_cost, liters, price_per_liter')
        .eq('vehicle_id', vehicleId)
        .gte('filled_at', startDateTime)
        .lte('filled_at', endDateTime),
      supabase
        .from('delivery_trips')
        .select('id, planned_date')
        .eq('vehicle_id', vehicleId)
        .gte('planned_date', startDateOnly)
        .lte('planned_date', endDateOnly),
    ]);

    const trips = tripsResult.data ?? [];
    const fuelRows = fuelResult.data ?? [];
    const deliveryTrips = tripsByMonthResult.data ?? [];

    const monthSet = new Set<string>();
    for (let m = startMonth; m <= endMonth; ) {
      monthSet.add(m);
      const [y, mo] = m.split('-').map(Number);
      if (mo >= 12) m = `${y + 1}-01`;
      else m = `${y}-${String(mo + 1).padStart(2, '0')}`;
    }

    const monthList = Array.from(monthSet).sort();

    const monthly: Record<
      string,
      { trip_count: number; total_distance_km: number; fuel_cost: number; commission_cost: number }
    > = {};
    for (const m of monthList) {
      monthly[m] = {
        trip_count: 0,
        total_distance_km: 0,
        fuel_cost: 0,
        commission_cost: 0,
      };
    }

    for (const trip of trips) {
      const dateKey = toLocalDate(trip.checkout_time);
      if (!dateKey) continue;
      const m = dateKey.slice(0, 7);
      if (!monthly[m]) continue;
      monthly[m].trip_count += 1;
      const d = calcDistance(trip);
      if (d !== null) monthly[m].total_distance_km += d;
    }

    for (const row of fuelRows) {
      const filled = row.filled_at ? String(row.filled_at).slice(0, 7) : '';
      if (!monthly[filled]) continue;
      const cost = row.total_cost ?? (row.liters ?? 0) * (row.price_per_liter ?? 0);
      monthly[filled].fuel_cost += Number(cost) || 0;
    }

    const tripIdsByMonth = new Map<string, string[]>();
    for (const dt of deliveryTrips) {
      const planned = (dt.planned_date as string)?.slice(0, 7);
      if (!planned || !monthSet.has(planned)) continue;
      if (!tripIdsByMonth.has(planned)) tripIdsByMonth.set(planned, []);
      tripIdsByMonth.get(planned)!.push(dt.id);
    }

    for (const [month, tripIds] of tripIdsByMonth) {
      if (tripIds.length === 0) continue;
      const { data: logs } = await supabase
        .from('commission_logs')
        .select('actual_commission')
        .in('delivery_trip_id', tripIds);
      if (logs) {
        const sum = logs.reduce((s, r) => s + (Number(r.actual_commission) || 0), 0);
        if (monthly[month]) monthly[month].commission_cost = sum;
      }
    }

    const result: VehicleMonthlySummary[] = monthList.map((month) => {
      const v = monthly[month];
      return {
        month,
        trip_count: v.trip_count,
        total_distance_km: v.total_distance_km,
        fuel_cost: v.fuel_cost,
        commission_cost: v.commission_cost,
        total_cost: v.fuel_cost + v.commission_cost,
      };
    });

    return result;
  },
};
