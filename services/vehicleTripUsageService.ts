// vehicleTripUsageService.ts
// Summarizes vehicle usage by day over a date range using tripLogService.getTripHistory
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
};
