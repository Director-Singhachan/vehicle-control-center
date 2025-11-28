// Daily Summary Service - สรุปการใช้รถรายวัน
import { supabase } from '../lib/supabase';

export interface DailyVehicleSummary {
  vehicle_id: string;
  vehicle_plate: string;
  vehicle_make?: string | null;
  vehicle_model?: string | null;
  trip_count: number;
  total_distance_km: number;
  odometer_start: number | null; // ไมล์เริ่มต้นของวัน (จากทริปแรก)
  odometer_end: number | null; // ไมล์สิ้นสุดของวัน (จากทริปสุดท้าย)
  drivers: string[]; // รายชื่อพนักงานที่ใช้รถในวันนั้น
}

export interface DailySummary {
  date: string; // YYYY-MM-DD
  total_vehicles: number;
  total_trips: number;
  total_distance_km: number;
  vehicles: DailyVehicleSummary[];
}

export const dailySummaryService = {
  /**
   * ดึงข้อมูลสรุปการใช้รถสำหรับวันที่กำหนด
   * @param date วันที่ในรูปแบบ YYYY-MM-DD (ถ้าไม่ระบุจะใช้วันนี้)
   */
  getDailySummary: async (date?: string): Promise<DailySummary | null> => {
    const targetDate = date || new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    
    // ดึงข้อมูลทริปที่ check-in แล้วในวันที่กำหนด
    // ใช้ checkout_time เป็นเกณฑ์ (เพราะทริปอาจ check-in ในวันถัดไป)
    const startOfDay = `${targetDate}T00:00:00.000Z`;
    const endOfDay = `${targetDate}T23:59:59.999Z`;

    const { data: trips, error } = await supabase
      .from('trip_logs')
      .select(`
        id,
        vehicle_id,
        driver_id,
        odometer_start,
        odometer_end,
        checkout_time,
        checkin_time,
        status,
        vehicle:vehicles!trip_logs_vehicle_id_fkey(
          id,
          plate,
          make,
          model
        ),
        driver:profiles!trip_logs_driver_id_fkey(
          id,
          full_name
        )
      `)
      .eq('status', 'checked_in')
      .gte('checkout_time', startOfDay)
      .lte('checkout_time', endOfDay)
      .order('checkout_time', { ascending: true });

    if (error) {
      console.error('[dailySummaryService] Error fetching trips:', error);
      throw error;
    }

    if (!trips || trips.length === 0) {
      return {
        date: targetDate,
        total_vehicles: 0,
        total_trips: 0,
        total_distance_km: 0,
        vehicles: [],
      };
    }

    // จัดกลุ่มตาม vehicle_id
    const vehicleMap = new Map<string, {
      vehicle_id: string;
      vehicle_plate: string;
      vehicle_make?: string | null;
      vehicle_model?: string | null;
      trip_count: number;
      total_distance_km: number;
      odometer_start: number | null;
      odometer_end: number | null;
      drivers: Set<string>; // ใช้ Set เพื่อไม่ให้ซ้ำ
      trips: any[]; // เก็บทริปทั้งหมดเพื่อหา odometer_start/end
    }>();

    for (const trip of trips) {
      const vehicle = (trip as any).vehicle as {
        id: string;
        plate: string;
        make?: string | null;
        model?: string | null;
      } | null;

      const driver = (trip as any).driver as {
        id: string;
        full_name?: string | null;
      } | null;

      if (!vehicle) continue;

      const vehicleId = vehicle.id;
      const distance = trip.odometer_end && trip.odometer_start
        ? trip.odometer_end - trip.odometer_start
        : 0;

      const driverName = driver?.full_name || 'ไม่ทราบชื่อ';

      if (vehicleMap.has(vehicleId)) {
        const existing = vehicleMap.get(vehicleId)!;
        existing.trip_count += 1;
        existing.total_distance_km += distance;
        existing.drivers.add(driverName);
        existing.trips.push(trip);
        
        // อัปเดต odometer_start (ใช้ค่าที่น้อยที่สุด)
        if (trip.odometer_start && (!existing.odometer_start || trip.odometer_start < existing.odometer_start)) {
          existing.odometer_start = trip.odometer_start;
        }
        
        // อัปเดต odometer_end (ใช้ค่าที่มากที่สุด)
        if (trip.odometer_end && (!existing.odometer_end || trip.odometer_end > existing.odometer_end)) {
          existing.odometer_end = trip.odometer_end;
        }
      } else {
        vehicleMap.set(vehicleId, {
          vehicle_id: vehicleId,
          vehicle_plate: vehicle.plate,
          vehicle_make: vehicle.make,
          vehicle_model: vehicle.model,
          trip_count: 1,
          total_distance_km: distance,
          odometer_start: trip.odometer_start || null,
          odometer_end: trip.odometer_end || null,
          drivers: new Set([driverName]),
          trips: [trip],
        });
      }
    }

    // แปลง Set เป็น Array และเรียงลำดับ
    const vehicles: DailyVehicleSummary[] = Array.from(vehicleMap.values()).map(v => ({
      vehicle_id: v.vehicle_id,
      vehicle_plate: v.vehicle_plate,
      vehicle_make: v.vehicle_make,
      vehicle_model: v.vehicle_model,
      trip_count: v.trip_count,
      total_distance_km: Math.round(v.total_distance_km * 100) / 100,
      odometer_start: v.odometer_start,
      odometer_end: v.odometer_end,
      drivers: Array.from(v.drivers).sort(),
    }));

    const total_trips = trips.length;
    const total_distance_km = vehicles.reduce((sum, v) => sum + v.total_distance_km, 0);

    return {
      date: targetDate,
      total_vehicles: vehicles.length,
      total_trips,
      total_distance_km: Math.round(total_distance_km * 100) / 100, // ปัดเป็น 2 ทศนิยม
      vehicles,
    };
  },

  /**
   * สร้างข้อความสรุปสำหรับ Telegram
   */
  formatTelegramMessage: (summary: DailySummary): string => {
    const date = new Date(summary.date);
    const dateStr = date.toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long',
    });

    let message = `📊 *สรุปการใช้รถรายวัน*\n\n`;
    message += `📅 วันที่: ${dateStr}\n\n`;
    message += `📈 *ภาพรวม:*\n`;
    message += `🚗 จำนวนรถที่ใช้งาน: ${summary.total_vehicles} คัน\n`;
    message += `🔄 จำนวนทริปทั้งหมด: ${summary.total_trips} ทริป\n`;
    message += `📏 ระยะทางรวม: ${summary.total_distance_km.toLocaleString('th-TH')} กิโลเมตร\n\n`;

    if (summary.vehicles.length > 0) {
      message += `🚙 *รายละเอียดตามรถ:*\n\n`;
      
      // เรียงตามระยะทางมากไปน้อย
      const sortedVehicles = [...summary.vehicles].sort(
        (a, b) => b.total_distance_km - a.total_distance_km
      );

      for (const vehicle of sortedVehicles) {
        const vehicleLabel = vehicle.vehicle_make && vehicle.vehicle_model
          ? `${vehicle.vehicle_plate} (${vehicle.vehicle_make} ${vehicle.vehicle_model})`
          : vehicle.vehicle_plate;
        
        message += `🚗 *${vehicleLabel}*\n`;
        message += `   🔄 ${vehicle.trip_count} ทริป\n`;
        message += `   📏 ${vehicle.total_distance_km.toLocaleString('th-TH')} กิโลเมตร\n\n`;
      }
    } else {
      message += `⚠️ ไม่มีข้อมูลการใช้รถในวันนี้\n`;
    }

    return message;
  },
};

