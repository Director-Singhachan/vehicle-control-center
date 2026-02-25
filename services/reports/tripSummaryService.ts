// Trip summary reports - monthly trip, vehicle summary, driver report
import { supabase } from '../../lib/supabase';

export interface MonthlyTripReport {
  month: string;
  monthLabel: string;
  totalTrips: number;
  totalDistance: number;
  totalHours: number;
  averageDistance: number;
  averageHours: number;
}

export interface VehicleTripSummary {
  vehicle_id: string;
  plate: string;
  make: string | null;
  model: string | null;
  totalTrips: number;
  totalDistance: number;
  totalHours: number;
  averageDistance: number;
}

export interface DriverTripReport {
  driver_id: string;
  driver_name: string;
  totalTrips: number;
  totalDistance: number;
  totalHours: number;
  vehicles_used: string[];
}

export const tripSummaryService = {
  getMonthlyTripReport: async (months: number = 6): Promise<MonthlyTripReport[]> => {
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);

    const { data, error } = await supabase
      .from('vehicle_usage_summary')
      .select('*')
      .gte('month', startDate.toISOString().split('T')[0])
      .order('month', { ascending: true });

    if (error) throw error;

    const monthMap = new Map<string, { totalTrips: number; totalDistance: number; totalHours: number }>();
    data?.forEach(record => {
      const monthKey = record.month.toString().substring(0, 7);
      if (!monthMap.has(monthKey)) {
        monthMap.set(monthKey, { totalTrips: 0, totalDistance: 0, totalHours: 0 });
      }
      const entry = monthMap.get(monthKey)!;
      entry.totalTrips += record.trip_count || 0;
      entry.totalDistance += record.total_distance || 0;
      entry.totalHours += record.total_hours || 0;
    });

    const sortedMonths = Array.from(monthMap.entries()).sort();
    return sortedMonths.map(([month, data]) => {
      const date = new Date(month + '-01');
      return {
        month,
        monthLabel: date.toLocaleDateString('th-TH', { month: 'short', year: 'numeric' }),
        totalTrips: data.totalTrips,
        totalDistance: data.totalDistance,
        totalHours: data.totalHours,
        averageDistance: data.totalTrips > 0 ? data.totalDistance / data.totalTrips : 0,
        averageHours: data.totalTrips > 0 ? data.totalHours / data.totalTrips : 0,
      };
    });
  },

  getVehicleTripSummary: async (months: number = 6): Promise<VehicleTripSummary[]> => {
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);

    const { data, error } = await supabase
      .from('vehicle_usage_summary')
      .select('*')
      .gte('month', startDate.toISOString().split('T')[0]);

    if (error) throw error;

    const vehicleMap = new Map<string, {
      plate: string;
      make: string | null;
      model: string | null;
      totalTrips: number;
      totalDistance: number;
      totalHours: number;
    }>();

    data?.forEach(record => {
      if (!vehicleMap.has(record.vehicle_id)) {
        vehicleMap.set(record.vehicle_id, {
          plate: record.plate,
          make: record.make,
          model: record.model,
          totalTrips: 0,
          totalDistance: 0,
          totalHours: 0,
        });
      }
      const entry = vehicleMap.get(record.vehicle_id)!;
      entry.totalTrips += record.trip_count || 0;
      entry.totalDistance += record.total_distance || 0;
      entry.totalHours += record.total_hours || 0;
    });

    return Array.from(vehicleMap.entries()).map(([vehicle_id, data]) => ({
      vehicle_id,
      plate: data.plate,
      make: data.make,
      model: data.model,
      totalTrips: data.totalTrips,
      totalDistance: data.totalDistance,
      totalHours: data.totalHours,
      averageDistance: data.totalTrips > 0 ? data.totalDistance / data.totalTrips : 0,
    })).sort((a, b) => b.totalDistance - a.totalDistance);
  },

  getDriverTripReport: async (months: number = 6): Promise<DriverTripReport[]> => {
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);

    const { data, error } = await supabase
      .from('trip_logs')
      .select(`
        driver_id,
        distance_km,
        duration_hours,
        checkout_time,
        checkin_time,
        driver:profiles!trip_logs_driver_id_fkey(full_name),
        vehicle:vehicles(plate)
      `)
      .eq('status', 'checked_in')
      .gte('checkout_time', startDate.toISOString())
      .order('checkout_time', { ascending: false });

    if (error) throw error;

    const driverMap = new Map<string, {
      driver_name: string;
      totalTrips: number;
      totalDistance: number;
      totalHours: number;
      vehicles: Set<string>;
    }>();

    data?.forEach(trip => {
      const driverId = trip.driver_id;
      const driver = trip.driver as { full_name: string } | null;
      const vehicle = trip.vehicle as { plate: string } | null;
      if (!driverMap.has(driverId)) {
        driverMap.set(driverId, {
          driver_name: driver?.full_name || 'Unknown',
          totalTrips: 0,
          totalDistance: 0,
          totalHours: 0,
          vehicles: new Set(),
        });
      }
      const entry = driverMap.get(driverId)!;
      entry.totalTrips += 1;
      entry.totalDistance += trip.distance_km || 0;
      entry.totalHours += trip.duration_hours || 0;
      if (vehicle?.plate) entry.vehicles.add(vehicle.plate);
    });

    return Array.from(driverMap.entries()).map(([driver_id, data]) => ({
      driver_id,
      driver_name: data.driver_name,
      totalTrips: data.totalTrips,
      totalDistance: data.totalDistance,
      totalHours: data.totalHours,
      vehicles_used: Array.from(data.vehicles),
    })).sort((a, b) => b.totalDistance - a.totalDistance);
  },
};
