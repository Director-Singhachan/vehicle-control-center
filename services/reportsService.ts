// Reports Service - Analytics and reporting
import { supabase, getSupabaseConfigError } from '../lib/supabase';

export interface Financials {
  todayCost: number;
  costTrend: number; // percent
  monthlyCost: number; // ค่าใช้จ่ายเดือนนี้
}

export interface MaintenanceTrends {
  labels: string[];
  costs: number[];
  incidents: number[];
}

// Fuel Reports
export interface MonthlyFuelReport {
  month: string; // YYYY-MM
  monthLabel: string; // "ม.ค. 2025"
  totalLiters: number;
  totalCost: number;
  averagePricePerLiter: number;
  averageEfficiency: number | null;
  fillCount: number;
}

export interface VehicleFuelComparison {
  vehicle_id: string;
  plate: string;
  make: string | null;
  model: string | null;
  totalLiters: number;
  totalCost: number;
  averageEfficiency: number | null;
  fillCount: number;
}

export interface FuelTrend {
  labels: string[];
  liters: number[];
  costs: number[];
  efficiency: (number | null)[];
}

// Trip Reports
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

// Commission / Staff workload reports
export interface StaffCommissionSummary {
  staff_id: string;
  staff_name: string;
  totalTrips: number;
  totalActualCommission: number;
  averageCommissionPerTrip: number;
}

// Staff Item Statistics
export interface StaffItemStatistics {
  staff_id: string;
  staff_name: string;
  staff_code: string | null;
  staff_phone: string | null;
  staff_status: string;
  total_trips: number;
  total_items_carried: number;
  completed_trips: number;
  in_progress_trips: number;
  planned_trips: number;
  last_trip_date: string | null;
  first_trip_date: string | null;
}

// Staff Item Details (รายละเอียดการยกสินค้าแต่ละชนิด)
export interface StaffItemDetail {
  staff_id: string;
  staff_name: string;
  staff_code: string | null;
  staff_phone: string | null;
  staff_status: string;
  delivery_trip_id: string;
  trip_number: string;
  planned_date: string;
  product_id: string;
  product_code: string;
  product_name: string;
  category: string;
  unit: string;
  total_quantity: number;
  quantity_per_staff: number;
  store_name: string | null;
  store_code: string | null;
}

// Maintenance Reports
export interface MonthlyMaintenanceReport {
  month: string;
  monthLabel: string;
  totalCost: number;
  ticketCount: number;
  averageCost: number;
}

export interface VehicleMaintenanceComparison {
  vehicle_id: string;
  plate: string;
  make: string | null;
  model: string | null;
  totalCost: number;
  ticketCount: number;
  averageCost: number;
  lastMaintenanceDate: string | null;
}

export interface VehicleMaintenanceHistory {
  ticket_id: number;
  vehicle_id: string;
  plate: string;
  title: string;
  status: string;
  totalCost: number;
  created_at: string;
  completed_at: string | null;
}

// Cost Analysis
export interface CostAnalysis {
  totalFuelCost: number;
  totalMaintenanceCost: number;
  totalCost: number;
  period: {
    start: string;
    end: string;
  };
}

export interface CostPerKm {
  vehicle_id: string;
  plate: string;
  make: string | null;
  model: string | null;
  totalDistance: number;
  totalFuelCost: number;
  totalMaintenanceCost: number;
  totalCost: number;
  costPerKm: number;
}

export interface MonthlyCostTrend {
  month: string;
  monthLabel: string;
  fuelCost: number;
  maintenanceCost: number;
  totalCost: number;
}

export const reportsService = {

  // Get financials (costs only - no revenue)
  // Includes both maintenance costs (ticket_costs) and fuel costs (fuel_records)
  getFinancials: async (): Promise<Financials> => {
    try {
      console.log('[reportsService] Fetching financials...');
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayEnd = new Date(yesterday);
      yesterdayEnd.setHours(23, 59, 59, 999);

      // First day of current month
      const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

      // Use Promise.all for parallel execution
      // Fetch both maintenance costs and fuel costs
      const [
        todayMaintenanceResult,
        yesterdayMaintenanceResult,
        monthlyMaintenanceResult,
        todayFuelResult,
        yesterdayFuelResult,
        monthlyFuelResult,
      ] = await Promise.all([
        // Today's maintenance costs
        supabase
          .from('ticket_costs')
          .select('cost')
          .gte('created_at', today.toISOString()),

        // Yesterday's maintenance costs
        supabase
          .from('ticket_costs')
          .select('cost')
          .gte('created_at', yesterday.toISOString())
          .lte('created_at', yesterdayEnd.toISOString()),

        // This month's maintenance costs
        supabase
          .from('ticket_costs')
          .select('cost')
          .gte('created_at', firstDayOfMonth.toISOString()),

        // Today's fuel costs
        supabase
          .from('fuel_records')
          .select('total_cost')
          .gte('filled_at', today.toISOString()),

        // Yesterday's fuel costs
        supabase
          .from('fuel_records')
          .select('total_cost')
          .gte('filled_at', yesterday.toISOString())
          .lte('filled_at', yesterdayEnd.toISOString()),

        // This month's fuel costs
        supabase
          .from('fuel_records')
          .select('total_cost')
          .gte('filled_at', firstDayOfMonth.toISOString()),
      ]);

      // Check for errors
      if (todayMaintenanceResult.error) {
        console.error('[reportsService] Error fetching today maintenance costs:', todayMaintenanceResult.error);
        throw todayMaintenanceResult.error;
      }
      if (yesterdayMaintenanceResult.error) {
        console.error('[reportsService] Error fetching yesterday maintenance costs:', yesterdayMaintenanceResult.error);
        throw yesterdayMaintenanceResult.error;
      }
      if (monthlyMaintenanceResult.error) {
        console.error('[reportsService] Error fetching monthly maintenance costs:', monthlyMaintenanceResult.error);
        throw monthlyMaintenanceResult.error;
      }
      if (todayFuelResult.error) {
        console.error('[reportsService] Error fetching today fuel costs:', todayFuelResult.error);
        throw todayFuelResult.error;
      }
      if (yesterdayFuelResult.error) {
        console.error('[reportsService] Error fetching yesterday fuel costs:', yesterdayFuelResult.error);
        throw yesterdayFuelResult.error;
      }
      if (monthlyFuelResult.error) {
        console.error('[reportsService] Error fetching monthly fuel costs:', monthlyFuelResult.error);
        throw monthlyFuelResult.error;
      }

      // Calculate maintenance costs
      const todayMaintenanceCost = todayMaintenanceResult.data?.reduce((sum, item) => sum + (item.cost || 0), 0) || 0;
      const yesterdayMaintenanceCost = yesterdayMaintenanceResult.data?.reduce((sum, item) => sum + (item.cost || 0), 0) || 0;
      const monthlyMaintenanceCost = monthlyMaintenanceResult.data?.reduce((sum, item) => sum + (item.cost || 0), 0) || 0;

      // Calculate fuel costs
      const todayFuelCost = todayFuelResult.data?.reduce((sum, item) => sum + (item.total_cost || 0), 0) || 0;
      const yesterdayFuelCost = yesterdayFuelResult.data?.reduce((sum, item) => sum + (item.total_cost || 0), 0) || 0;
      const monthlyFuelCost = monthlyFuelResult.data?.reduce((sum, item) => sum + (item.total_cost || 0), 0) || 0;

      // Combine maintenance and fuel costs
      const todayCost = todayMaintenanceCost + todayFuelCost;
      const yesterdayCost = yesterdayMaintenanceCost + yesterdayFuelCost;
      const monthlyCost = monthlyMaintenanceCost + monthlyFuelCost;

      console.log('[reportsService] Costs:', {
        today: { maintenance: todayMaintenanceCost, fuel: todayFuelCost, total: todayCost },
        yesterday: { maintenance: yesterdayMaintenanceCost, fuel: yesterdayFuelCost, total: yesterdayCost },
        monthly: { maintenance: monthlyMaintenanceCost, fuel: monthlyFuelCost, total: monthlyCost },
      });

      // Calculate trend
      const costTrend = yesterdayCost > 0
        ? ((todayCost - yesterdayCost) / yesterdayCost) * 100
        : 0;

      return {
        todayCost: todayCost,
        costTrend: costTrend,
        monthlyCost: monthlyCost,
      };
    } catch (error) {
      console.error('[reportsService] getFinancials error:', error);
      throw error;
    }
  },

  // Get maintenance trends (monthly)
  getMaintenanceTrends: async (months: number = 6): Promise<MaintenanceTrends> => {
    // Get last N months
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);

    // Optimize: Fetch only necessary columns
    const [costsResult, incidentsResult] = await Promise.all([
      // Monthly costs
      supabase
        .from('ticket_costs')
        .select(`
          cost,
          ticket:tickets!inner(created_at)
        `)
        .gte('tickets.created_at', startDate.toISOString()),

      // Monthly incidents - only need created_at
      supabase
        .from('tickets')
        .select('created_at')
        .gte('created_at', startDate.toISOString())
    ]);

    if (costsResult.error) throw costsResult.error;
    if (incidentsResult.error) throw incidentsResult.error;

    const costsData = costsResult.data;
    const incidentsData = incidentsResult.data;

    // Group by month
    const monthMap = new Map<string, { costs: number; incidents: number }>();

    // Process costs
    costsData?.forEach(item => {
      const ticket = item.ticket as { created_at: string } | null;
      if (!ticket) return;

      const date = new Date(ticket.created_at);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

      if (!monthMap.has(monthKey)) {
        monthMap.set(monthKey, { costs: 0, incidents: 0 });
      }
      const entry = monthMap.get(monthKey)!;
      entry.costs += item.cost || 0;
    });

    // Process incidents
    incidentsData?.forEach(item => {
      const date = new Date(item.created_at);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

      if (!monthMap.has(monthKey)) {
        monthMap.set(monthKey, { costs: 0, incidents: 0 });
      }
      const entry = monthMap.get(monthKey)!;
      entry.incidents += 1;
    });

    // Convert to arrays
    const sortedMonths = Array.from(monthMap.entries()).sort();
    const labels = sortedMonths.map(([key]) => {
      const [year, month] = key.split('-');
      const date = new Date(parseInt(year), parseInt(month) - 1);
      return date.toLocaleDateString('th-TH', { month: 'short' });
    });
    const costs = sortedMonths.map(([, data]) => data.costs);
    const incidents = sortedMonths.map(([, data]) => data.incidents);

    return {
      labels,
      costs,
      incidents,
    };
  },

  // ========== Fuel Reports ==========

  // Get monthly fuel report
  getMonthlyFuelReport: async (months: number = 6, startDate?: Date, endDate?: Date, branch?: string): Promise<MonthlyFuelReport[]> => {
    let queryStartDate: Date;
    if (startDate) {
      queryStartDate = startDate;
    } else {
      queryStartDate = new Date();
      queryStartDate.setMonth(queryStartDate.getMonth() - months);
    }

    let query = supabase
      .from('fuel_efficiency_summary')
      .select('*')
      .gte('month', queryStartDate.toISOString().split('T')[0]);

    if (endDate) {
      query = query.lte('month', endDate.toISOString().split('T')[0]);
    }

    if (branch) {
      query = query.eq('branch', branch);
    }

    const { data, error } = await query.order('month', { ascending: true });

    if (error) throw error;

    // Group by month across all vehicles
    const monthMap = new Map<string, {
      totalLiters: number;
      totalCost: number;
      totalPrice: number;
      fillCount: number;
      efficiencies: number[];
    }>();

    data?.forEach(record => {
      const monthKey = record.month.toString().substring(0, 7); // YYYY-MM

      if (!monthMap.has(monthKey)) {
        monthMap.set(monthKey, {
          totalLiters: 0,
          totalCost: 0,
          totalPrice: 0,
          fillCount: 0,
          efficiencies: [],
        });
      }

      const entry = monthMap.get(monthKey)!;
      entry.totalLiters += record.total_liters || 0;
      entry.totalCost += record.total_cost || 0;
      entry.fillCount += record.fill_count || 0;
      if (record.avg_efficiency) {
        entry.efficiencies.push(record.avg_efficiency);
      }
    });

    // Convert to array
    const sortedMonths = Array.from(monthMap.entries()).sort();
    return sortedMonths.map(([month, data]) => {
      const date = new Date(month + '-01');
      return {
        month,
        monthLabel: date.toLocaleDateString('th-TH', { month: 'short', year: 'numeric' }),
        totalLiters: data.totalLiters,
        totalCost: data.totalCost,
        averagePricePerLiter: data.fillCount > 0 ? data.totalCost / (data.totalLiters || 1) : 0,
        averageEfficiency: data.efficiencies.length > 0
          ? data.efficiencies.reduce((sum, eff) => sum + eff, 0) / data.efficiencies.length
          : null,
        fillCount: data.fillCount,
      };
    });
  },

  // Get vehicle fuel cost comparison
  getVehicleFuelComparison: async (months: number = 6, startDate?: Date, endDate?: Date, branch?: string): Promise<VehicleFuelComparison[]> => {
    let queryStartDate: Date;
    if (startDate) {
      queryStartDate = startDate;
    } else {
      queryStartDate = new Date();
      queryStartDate.setMonth(queryStartDate.getMonth() - months);
      queryStartDate.setHours(0, 0, 0, 0);
    }

    // Query fuel_records directly instead of using fuel_efficiency_summary view
    // This ensures we get all fuel records even if the view doesn't have data
    let query = supabase
      .from('fuel_records')
      .select(`
        vehicle_id,
        liters,
        total_cost,
        fuel_efficiency,
        vehicle:vehicles!inner(
          id,
          plate,
          make,
          model,
          branch
        )
      `)
      .gte('filled_at', queryStartDate.toISOString());

    if (endDate) {
      query = query.lte('filled_at', endDate.toISOString());
    }

    if (branch) {
      query = query.eq('vehicle.branch', branch);
    }

    const { data: fuelRecords, error } = await query
      .order('filled_at', { ascending: true });

    if (error) {
      console.error('[reportsService] getVehicleFuelComparison error:', error);
      throw error;
    }

    if (!fuelRecords || fuelRecords.length === 0) {
      return [];
    }

    // Group by vehicle
    const vehicleMap = new Map<string, {
      plate: string;
      make: string | null;
      model: string | null;
      totalLiters: number;
      totalCost: number;
      fillCount: number;
      efficiencies: number[];
    }>();

    fuelRecords.forEach(record => {
      const vehicleId = record.vehicle_id;
      const vehicle = record.vehicle as { id: string; plate: string; make: string | null; model: string | null } | null;

      if (!vehicleId || !vehicle) return;

      if (!vehicleMap.has(vehicleId)) {
        vehicleMap.set(vehicleId, {
          plate: vehicle.plate,
          make: vehicle.make,
          model: vehicle.model,
          totalLiters: 0,
          totalCost: 0,
          fillCount: 0,
          efficiencies: [],
        });
      }

      const entry = vehicleMap.get(vehicleId)!;
      entry.totalLiters += Number(record.liters) || 0;
      entry.totalCost += Number(record.total_cost) || 0;
      entry.fillCount += 1;
      if (record.fuel_efficiency) {
        entry.efficiencies.push(Number(record.fuel_efficiency));
      }
    });

    // Convert to array and calculate averages
    return Array.from(vehicleMap.entries())
      .map(([vehicle_id, data]) => ({
        vehicle_id,
        plate: data.plate,
        make: data.make,
        model: data.model,
        totalLiters: data.totalLiters,
        totalCost: data.totalCost,
        averageEfficiency: data.efficiencies.length > 0
          ? data.efficiencies.reduce((sum, eff) => sum + eff, 0) / data.efficiencies.length
          : null,
        fillCount: data.fillCount,
      }))
      .filter(vehicle => vehicle.totalCost > 0 || vehicle.totalLiters > 0) // Only show vehicles with fuel data
      .sort((a, b) => b.totalCost - a.totalCost);
  },

  // Get fuel trend (for charts)
  getFuelTrend: async (months: number = 6, startDate?: Date, endDate?: Date, branch?: string): Promise<FuelTrend> => {
    const report = await reportsService.getMonthlyFuelReport(months, startDate, endDate, branch);

    return {
      labels: report.map(r => r.monthLabel),
      liters: report.map(r => r.totalLiters),
      costs: report.map(r => r.totalCost),
      efficiency: report.map(r => r.averageEfficiency),
    };
  },

  // ========== Trip Reports ==========

  // Get monthly trip report
  getMonthlyTripReport: async (months: number = 6): Promise<MonthlyTripReport[]> => {
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);

    const { data, error } = await supabase
      .from('vehicle_usage_summary')
      .select('*')
      .gte('month', startDate.toISOString().split('T')[0])
      .order('month', { ascending: true });

    if (error) throw error;

    // Group by month across all vehicles
    const monthMap = new Map<string, {
      totalTrips: number;
      totalDistance: number;
      totalHours: number;
    }>();

    data?.forEach(record => {
      const monthKey = record.month.toString().substring(0, 7); // YYYY-MM

      if (!monthMap.has(monthKey)) {
        monthMap.set(monthKey, {
          totalTrips: 0,
          totalDistance: 0,
          totalHours: 0,
        });
      }

      const entry = monthMap.get(monthKey)!;
      entry.totalTrips += record.trip_count || 0;
      entry.totalDistance += record.total_distance || 0;
      entry.totalHours += record.total_hours || 0;
    });

    // Convert to array
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

  // Get vehicle trip summary
  getVehicleTripSummary: async (months: number = 6): Promise<VehicleTripSummary[]> => {
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);

    const { data, error } = await supabase
      .from('vehicle_usage_summary')
      .select('*')
      .gte('month', startDate.toISOString().split('T')[0]);

    if (error) throw error;

    // Group by vehicle
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

    // Convert to array
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

  // Get driver trip report
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

    // Group by driver
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
      if (vehicle?.plate) {
        entry.vehicles.add(vehicle.plate);
      }
    });

    // Convert to array
    return Array.from(driverMap.entries()).map(([driver_id, data]) => ({
      driver_id,
      driver_name: data.driver_name,
      totalTrips: data.totalTrips,
      totalDistance: data.totalDistance,
      totalHours: data.totalHours,
      vehicles_used: Array.from(data.vehicles),
    })).sort((a, b) => b.totalDistance - a.totalDistance);
  },

  // ========== Maintenance Reports ==========

  // Get monthly maintenance report
  getMonthlyMaintenanceReport: async (months: number = 6): Promise<MonthlyMaintenanceReport[]> => {
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);

    const { data, error } = await supabase
      .from('ticket_costs')
      .select(`
        cost,
        ticket:tickets!inner(created_at, id)
      `)
      .gte('tickets.created_at', startDate.toISOString());

    if (error) throw error;

    // Group by month
    const monthMap = new Map<string, {
      totalCost: number;
      ticketIds: Set<number>;
    }>();

    data?.forEach(item => {
      const ticket = item.ticket as { created_at: string; id: number } | null;
      if (!ticket) return;

      const date = new Date(ticket.created_at);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

      if (!monthMap.has(monthKey)) {
        monthMap.set(monthKey, {
          totalCost: 0,
          ticketIds: new Set(),
        });
      }

      const entry = monthMap.get(monthKey)!;
      entry.totalCost += item.cost || 0;
      entry.ticketIds.add(ticket.id);
    });

    // Convert to array
    const sortedMonths = Array.from(monthMap.entries()).sort();
    return sortedMonths.map(([month, data]) => {
      const date = new Date(month + '-01');
      return {
        month,
        monthLabel: date.toLocaleDateString('th-TH', { month: 'short', year: 'numeric' }),
        totalCost: data.totalCost,
        ticketCount: data.ticketIds.size,
        averageCost: data.ticketIds.size > 0 ? data.totalCost / data.ticketIds.size : 0,
      };
    });
  },

  // Get vehicle maintenance comparison
  getVehicleMaintenanceComparison: async (months: number = 6): Promise<VehicleMaintenanceComparison[]> => {
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);

    const { data, error } = await supabase
      .from('ticket_costs')
      .select(`
        cost,
        ticket:tickets!inner(id, vehicle_id, created_at, status, vehicles(plate, make, model))
      `)
      .gte('tickets.created_at', startDate.toISOString());

    if (error) throw error;

    // Group by vehicle
    const vehicleMap = new Map<string, {
      plate: string;
      make: string | null;
      model: string | null;
      totalCost: number;
      ticketIds: Set<number>;
      lastMaintenanceDate: string | null;
    }>();

    data?.forEach(item => {
      const ticket = item.ticket as {
        id: number;
        vehicle_id: string;
        created_at: string;
        vehicles: { plate: string; make: string | null; model: string | null } | null;
      } | null;

      if (!ticket || !ticket.vehicle_id) return;

      if (!vehicleMap.has(ticket.vehicle_id)) {
        vehicleMap.set(ticket.vehicle_id, {
          plate: ticket.vehicles?.plate || 'Unknown',
          make: ticket.vehicles?.make || null,
          model: ticket.vehicles?.model || null,
          totalCost: 0,
          ticketIds: new Set(),
          lastMaintenanceDate: null,
        });
      }

      const entry = vehicleMap.get(ticket.vehicle_id)!;
      entry.totalCost += item.cost || 0;
      entry.ticketIds.add(ticket.id);

      // Track latest maintenance date
      const ticketDate = new Date(ticket.created_at);
      if (!entry.lastMaintenanceDate || ticketDate > new Date(entry.lastMaintenanceDate)) {
        entry.lastMaintenanceDate = ticket.created_at;
      }
    });

    // Convert to array
    return Array.from(vehicleMap.entries()).map(([vehicle_id, data]) => ({
      vehicle_id,
      plate: data.plate,
      make: data.make,
      model: data.model,
      totalCost: data.totalCost,
      ticketCount: data.ticketIds.size,
      averageCost: data.ticketIds.size > 0 ? data.totalCost / data.ticketIds.size : 0,
      lastMaintenanceDate: data.lastMaintenanceDate,
    })).sort((a, b) => b.totalCost - a.totalCost);
  },

  // Get vehicle maintenance history
  getVehicleMaintenanceHistory: async (vehicleId: string): Promise<VehicleMaintenanceHistory[]> => {
    const { data, error } = await supabase
      .from('tickets')
      .select(`
        id,
        vehicle_id,
        title,
        status,
        created_at,
        completed_at,
        vehicles(plate),
        ticket_costs(cost)
      `)
      .eq('vehicle_id', vehicleId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data || []).map(ticket => {
      const costs = ticket.ticket_costs as Array<{ cost: number | null }> | null;
      const totalCost = costs?.reduce((sum, c) => sum + (c.cost || 0), 0) || 0;
      const vehicle = ticket.vehicles as { plate: string } | null;

      return {
        ticket_id: ticket.id,
        vehicle_id: ticket.vehicle_id,
        plate: vehicle?.plate || 'Unknown',
        title: ticket.title,
        status: ticket.status,
        totalCost,
        created_at: ticket.created_at,
        completed_at: ticket.completed_at,
      };
    });
  },

  // ========== Cost Analysis ==========

  // Get cost analysis (fuel + maintenance)
  getCostAnalysis: async (startDate: Date, endDate: Date): Promise<CostAnalysis> => {
    const [fuelResult, maintenanceResult] = await Promise.all([
      // Fuel costs
      supabase
        .from('fuel_records')
        .select('total_cost')
        .gte('filled_at', startDate.toISOString())
        .lte('filled_at', endDate.toISOString()),

      // Maintenance costs
      supabase
        .from('ticket_costs')
        .select(`
          cost,
          ticket:tickets!inner(created_at)
        `)
        .gte('tickets.created_at', startDate.toISOString())
        .lte('tickets.created_at', endDate.toISOString()),
    ]);

    if (fuelResult.error) throw fuelResult.error;
    if (maintenanceResult.error) throw maintenanceResult.error;

    const totalFuelCost = fuelResult.data?.reduce((sum, item) => sum + (item.total_cost || 0), 0) || 0;
    const totalMaintenanceCost = maintenanceResult.data?.reduce((sum, item) => sum + (item.cost || 0), 0) || 0;

    return {
      totalFuelCost,
      totalMaintenanceCost,
      totalCost: totalFuelCost + totalMaintenanceCost,
      period: {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
      },
    };
  },

  // Get cost per km for each vehicle
  getCostPerKm: async (months: number = 6): Promise<CostPerKm[]> => {
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);

    // Get fuel costs by vehicle
    const { data: fuelData, error: fuelError } = await supabase
      .from('fuel_records')
      .select('vehicle_id, total_cost, vehicles(plate, make, model)')
      .gte('filled_at', startDate.toISOString());

    if (fuelError) throw fuelError;

    // Get maintenance costs by vehicle
    const { data: maintenanceData, error: maintenanceError } = await supabase
      .from('ticket_costs')
      .select(`
        cost,
        ticket:tickets!inner(vehicle_id, created_at, vehicles(plate, make, model))
      `)
      .gte('tickets.created_at', startDate.toISOString());

    if (maintenanceError) throw maintenanceError;

    // Get trip distances by vehicle
    const { data: tripData, error: tripError } = await supabase
      .from('trip_logs')
      .select('vehicle_id, distance_km, vehicles(plate, make, model)')
      .eq('status', 'checked_in')
      .not('distance_km', 'is', null)
      .gte('checkout_time', startDate.toISOString());

    if (tripError) throw tripError;

    // Group by vehicle
    const vehicleMap = new Map<string, {
      plate: string;
      make: string | null;
      model: string | null;
      totalFuelCost: number;
      totalMaintenanceCost: number;
      totalDistance: number;
    }>();

    // Process fuel costs
    fuelData?.forEach(record => {
      const vehicle = record.vehicles as { plate: string; make: string | null; model: string | null } | null;
      const vehicleId = record.vehicle_id;

      if (!vehicleMap.has(vehicleId)) {
        vehicleMap.set(vehicleId, {
          plate: vehicle?.plate || 'Unknown',
          make: vehicle?.make || null,
          model: vehicle?.model || null,
          totalFuelCost: 0,
          totalMaintenanceCost: 0,
          totalDistance: 0,
        });
      }

      vehicleMap.get(vehicleId)!.totalFuelCost += record.total_cost || 0;
    });

    // Process maintenance costs
    maintenanceData?.forEach(item => {
      const ticket = item.ticket as {
        vehicle_id: string;
        vehicles: { plate: string; make: string | null; model: string | null } | null;
      } | null;

      if (!ticket?.vehicle_id) return;

      if (!vehicleMap.has(ticket.vehicle_id)) {
        vehicleMap.set(ticket.vehicle_id, {
          plate: ticket.vehicles?.plate || 'Unknown',
          make: ticket.vehicles?.make || null,
          model: ticket.vehicles?.model || null,
          totalFuelCost: 0,
          totalMaintenanceCost: 0,
          totalDistance: 0,
        });
      }

      vehicleMap.get(ticket.vehicle_id)!.totalMaintenanceCost += item.cost || 0;
    });

    // Process trip distances
    tripData?.forEach(trip => {
      const vehicle = trip.vehicles as { plate: string; make: string | null; model: string | null } | null;
      const vehicleId = trip.vehicle_id;

      if (!vehicleMap.has(vehicleId)) {
        vehicleMap.set(vehicleId, {
          plate: vehicle?.plate || 'Unknown',
          make: vehicle?.make || null,
          model: vehicle?.model || null,
          totalFuelCost: 0,
          totalMaintenanceCost: 0,
          totalDistance: 0,
        });
      }

      vehicleMap.get(vehicleId)!.totalDistance += trip.distance_km || 0;
    });

    // Convert to array and calculate cost per km
    return Array.from(vehicleMap.entries()).map(([vehicle_id, data]) => {
      const totalCost = data.totalFuelCost + data.totalMaintenanceCost;
      return {
        vehicle_id,
        plate: data.plate,
        make: data.make,
        model: data.model,
        totalDistance: data.totalDistance,
        totalFuelCost: data.totalFuelCost,
        totalMaintenanceCost: data.totalMaintenanceCost,
        totalCost,
        costPerKm: data.totalDistance > 0 ? totalCost / data.totalDistance : 0,
      };
    }).sort((a, b) => b.totalCost - a.totalCost);
  },

  // Get monthly cost trend
  getMonthlyCostTrend: async (months: number = 6): Promise<MonthlyCostTrend[]> => {
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);

    // Get fuel costs by month
    const { data: fuelData, error: fuelError } = await supabase
      .from('fuel_records')
      .select('total_cost, filled_at')
      .gte('filled_at', startDate.toISOString());

    if (fuelError) throw fuelError;

    // Get maintenance costs by month
    const { data: maintenanceData, error: maintenanceError } = await supabase
      .from('ticket_costs')
      .select(`
        cost,
        ticket:tickets!inner(created_at)
      `)
      .gte('tickets.created_at', startDate.toISOString());

    if (maintenanceError) throw maintenanceError;

    // Group by month
    const monthMap = new Map<string, {
      fuelCost: number;
      maintenanceCost: number;
    }>();

    // Process fuel costs
    fuelData?.forEach(record => {
      const date = new Date(record.filled_at);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

      if (!monthMap.has(monthKey)) {
        monthMap.set(monthKey, { fuelCost: 0, maintenanceCost: 0 });
      }

      monthMap.get(monthKey)!.fuelCost += record.total_cost || 0;
    });

    // Process maintenance costs
    maintenanceData?.forEach(item => {
      const ticket = item.ticket as { created_at: string } | null;
      if (!ticket) return;

      const date = new Date(ticket.created_at);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

      if (!monthMap.has(monthKey)) {
        monthMap.set(monthKey, { fuelCost: 0, maintenanceCost: 0 });
      }

      monthMap.get(monthKey)!.maintenanceCost += item.cost || 0;
    });

    // Convert to array
    const sortedMonths = Array.from(monthMap.entries()).sort();
    return sortedMonths.map(([month, data]) => {
      const date = new Date(month + '-01');
      return {
        month,
        monthLabel: date.toLocaleDateString('th-TH', { month: 'short', year: 'numeric' }),
        fuelCost: data.fuelCost,
        maintenanceCost: data.maintenanceCost,
        totalCost: data.fuelCost + data.maintenanceCost,
      };
    });
  },

  // ========== Vehicle Usage Ranking ==========

  // Get vehicle usage ranking (รถที่วิ่งเยอะที่สุด)
  // รองรับกรองเดือน/ปี/สาขา
  getVehicleUsageRanking: async (options?: {
    startDate?: Date;
    endDate?: Date;
    branch?: string | null;
    limit?: number;
  }): Promise<Array<{
    vehicle_id: string;
    plate: string;
    make: string | null;
    model: string | null;
    branch: string | null;
    totalDistance: number;
    totalTrips: number;
    totalHours: number;
    averageDistance: number;
  }>> => {
    try {
      // Check if Supabase is properly configured
      const configError = getSupabaseConfigError();
      if (configError) {
        throw new Error(`Supabase configuration error: ${configError}`);
      }

      if (!supabase) {
        throw new Error('Supabase client is not initialized');
      }

      let startDate: Date;
      let endDate: Date;

      if (options?.startDate && options?.endDate) {
        startDate = options.startDate;
        endDate = options.endDate;
      } else {
        // Default: 3 เดือนล่าสุด (เพื่อให้มีข้อมูลแสดง)
        const now = new Date();
        startDate = new Date(now.getFullYear(), now.getMonth() - 2, 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      }

      console.log('[reportsService] getVehicleUsageRanking - Querying trip_logs from', startDate.toISOString(), 'to', endDate.toISOString());

      // Query trip logs first (simpler query without join)
      const tripLogsQuery = supabase
        .from('trip_logs')
        .select('vehicle_id, distance_km, duration_hours, checkout_time')
        .eq('status', 'checked_in')
        .gte('checkout_time', startDate.toISOString())
        .lte('checkout_time', endDate.toISOString());

      const { data: tripLogs, error: tripLogsError } = await tripLogsQuery;

      if (tripLogsError) {
        console.error('[reportsService] getVehicleUsageRanking trip_logs query error:', tripLogsError);
        // Check if it's a network error
        if (tripLogsError.message?.includes('fetch') || tripLogsError.message?.includes('Failed to fetch')) {
          throw new Error(`Network error: ไม่สามารถเชื่อมต่อกับฐานข้อมูลได้ กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ตหรือ VPN. Original error: ${tripLogsError.message}`);
        }
        throw tripLogsError;
      }

      if (!tripLogs || tripLogs.length === 0) {
        return [];
      }

      // Get unique vehicle IDs
      const vehicleIds = [...new Set(tripLogs.map(t => t.vehicle_id).filter(Boolean))];

      if (vehicleIds.length === 0) {
        return [];
      }

      console.log('[reportsService] getVehicleUsageRanking - Found', vehicleIds.length, 'unique vehicles');

      // Query vehicles separately
      const vehiclesQuery = supabase
        .from('vehicles')
        .select('id, plate, make, model, branch')
        .in('id', vehicleIds);

      const { data: vehicles, error: vehiclesError } = await vehiclesQuery;

      if (vehiclesError) {
        console.error('[reportsService] getVehicleUsageRanking vehicles query error:', vehiclesError);
        // Check if it's a network error
        if (vehiclesError.message?.includes('fetch') || vehiclesError.message?.includes('Failed to fetch')) {
          throw new Error(`Network error: ไม่สามารถเชื่อมต่อกับฐานข้อมูลได้ กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ตหรือ VPN. Original error: ${vehiclesError.message}`);
        }
        throw vehiclesError;
      }

      if (!vehicles || vehicles.length === 0) {
        console.warn('[reportsService] getVehicleUsageRanking: No vehicles found for vehicle IDs:', vehicleIds);
        return [];
      }

      if (vehiclesError) {
        console.error('[reportsService] getVehicleUsageRanking vehicles query error:', vehiclesError);
        throw vehiclesError;
      }

      // Create vehicle lookup map
      const vehicleMap = new Map<string, {
        plate: string;
        make: string | null;
        model: string | null;
        branch: string | null;
      }>();

      vehicles?.forEach(v => {
        vehicleMap.set(v.id, {
          plate: v.plate,
          make: v.make,
          model: v.model,
          branch: v.branch,
        });
      });

      // Group trip logs by vehicle
      const usageMap = new Map<string, {
        plate: string;
        make: string | null;
        model: string | null;
        branch: string | null;
        totalDistance: number;
        totalTrips: number;
        totalHours: number;
      }>();

      tripLogs.forEach(trip => {
        if (!trip.vehicle_id) return;

        const vehicle = vehicleMap.get(trip.vehicle_id);
        if (!vehicle) return;

        // Filter by branch if provided
        if (options?.branch && vehicle.branch !== options.branch) {
          return;
        }

        if (!usageMap.has(trip.vehicle_id)) {
          usageMap.set(trip.vehicle_id, {
            plate: vehicle.plate,
            make: vehicle.make,
            model: vehicle.model,
            branch: vehicle.branch,
            totalDistance: 0,
            totalTrips: 0,
            totalHours: 0,
          });
        }

        const entry = usageMap.get(trip.vehicle_id)!;
        entry.totalDistance += trip.distance_km || 0;
        entry.totalTrips += 1;
        entry.totalHours += trip.duration_hours || 0;
      });

      // Convert to array and sort by totalDistance
      const result = Array.from(usageMap.entries()).map(([vehicle_id, data]) => ({
        vehicle_id,
        plate: data.plate,
        make: data.make,
        model: data.model,
        branch: data.branch,
        totalDistance: data.totalDistance,
        totalTrips: data.totalTrips,
        totalHours: data.totalHours,
        averageDistance: data.totalTrips > 0 ? data.totalDistance / data.totalTrips : 0,
      })).sort((a, b) => b.totalDistance - a.totalDistance);

      // Apply limit if provided
      const finalResult = options?.limit ? result.slice(0, options.limit) : result;
      console.log('[reportsService] getVehicleUsageRanking - Returning', finalResult.length, 'vehicles');
      return finalResult;
    } catch (error) {
      console.error('[reportsService] getVehicleUsageRanking error:', error);
      // Re-throw with better error message if it's a network error
      if (error instanceof Error && (error.message.includes('fetch') || error.message.includes('Failed to fetch'))) {
        throw new Error(`Network error: ไม่สามารถเชื่อมต่อกับฐานข้อมูลได้ กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ตหรือ VPN. Original error: ${error.message}`);
      }
      throw error;
    }
  },

  // Get vehicle fuel consumption chart data (กราฟการเติมน้ำมันของแต่ละคัน)
  // รองรับกรองเดือน/ปี/สาขา
  getVehicleFuelConsumption: async (options?: {
    startDate?: Date;
    endDate?: Date;
    branch?: string | null;
  }): Promise<Array<{
    vehicle_id: string;
    plate: string;
    make: string | null;
    model: string | null;
    branch: string | null;
    totalLiters: number;
    totalCost: number;
    fillCount: number;
    averageEfficiency: number | null;
    averagePricePerLiter: number;
  }>> => {
    try {
      let startDate: Date;
      let endDate: Date;

      if (options?.startDate && options?.endDate) {
        startDate = options.startDate;
        endDate = options.endDate;
      } else {
        // Default: 3 เดือนล่าสุด (เพื่อให้มีข้อมูลแสดง)
        const now = new Date();
        startDate = new Date(now.getFullYear(), now.getMonth() - 2, 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      }

      // Query fuel_records directly instead of using fuel_efficiency_summary view
      // This allows us to show data even if it's not a full month yet
      console.log('[reportsService] getVehicleFuelConsumption - Querying from', startDate.toISOString(), 'to', endDate.toISOString());

      // Query fuel_records with vehicle info
      // Need odometer and distance_since_last_fill to calculate accurate efficiency
      let query = supabase
        .from('fuel_records')
        .select(`
          vehicle_id,
          liters,
          total_cost,
          fuel_efficiency,
          odometer,
          distance_since_last_fill,
          filled_at,
          vehicle:vehicles!fuel_records_vehicle_id_fkey(
            id,
            plate,
            make,
            model,
            branch
          )
        `)
        .gte('filled_at', startDate.toISOString())
        .lte('filled_at', endDate.toISOString())
        .order('filled_at', { ascending: true });

      const { data: fuelRecords, error } = await query;

      if (error) {
        console.error('[reportsService] getVehicleFuelConsumption query error:', error);
        // Check if it's a network error
        if (error.message?.includes('fetch') || error.message?.includes('Failed to fetch')) {
          throw new Error(`Network error: ไม่สามารถเชื่อมต่อกับฐานข้อมูลได้ กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ตหรือ VPN. Original error: ${error.message}`);
        }
        throw error;
      }

      console.log('[reportsService] getVehicleFuelConsumption - Found', fuelRecords?.length || 0, 'fuel records');

      if (!fuelRecords || fuelRecords.length === 0) {
        return [];
      }

      // Group by vehicle and calculate accurate efficiency
      const vehicleMap = new Map<string, {
        plate: string;
        make: string | null;
        model: string | null;
        branch: string | null;
        totalLiters: number;
        totalCost: number;
        fillCount: number;
        totalDistance: number; // Total distance traveled (sum of distance_since_last_fill)
        firstOdometer: number | null; // First odometer reading in the period
        lastOdometer: number | null; // Last odometer reading in the period
      }>();

      fuelRecords.forEach(record => {
        const vehicle = record.vehicle as {
          id: string;
          plate: string;
          make: string | null;
          model: string | null;
          branch: string | null;
        } | null;

        if (!vehicle || !record.vehicle_id) return;

        // Filter by branch if provided
        if (options?.branch && vehicle.branch !== options.branch) {
          return;
        }

        if (!vehicleMap.has(record.vehicle_id)) {
          vehicleMap.set(record.vehicle_id, {
            plate: vehicle.plate,
            make: vehicle.make,
            model: vehicle.model,
            branch: vehicle.branch,
            totalLiters: 0,
            totalCost: 0,
            fillCount: 0,
            totalDistance: 0,
            firstOdometer: record.odometer || null,
            lastOdometer: record.odometer || null,
          });
        }

        const entry = vehicleMap.get(record.vehicle_id)!;
        entry.totalLiters += record.liters || 0;
        entry.totalCost += record.total_cost || 0;
        entry.fillCount += 1;

        // Add distance if available
        // ใช้ distance_since_last_fill เท่านั้น (ไม่ใช้ odometer range)
        // เพราะ distance_since_last_fill คำนวณจาก odometer ระหว่างการเติมน้ำมัน 2 ครั้ง
        // ซึ่งแม่นยำกว่าการใช้ odometer range ที่อาจไม่ครอบคลุมทุกครั้ง
        if (record.distance_since_last_fill && record.distance_since_last_fill > 0) {
          entry.totalDistance += record.distance_since_last_fill;
        }

        // Update odometer range
        if (record.odometer) {
          if (entry.firstOdometer === null || record.odometer < entry.firstOdometer) {
            entry.firstOdometer = record.odometer;
          }
          if (entry.lastOdometer === null || record.odometer > entry.lastOdometer) {
            entry.lastOdometer = record.odometer;
          }
        }
      });

      // Convert to array and calculate accurate efficiency using the most precise formula
      const result = Array.from(vehicleMap.entries()).map(([vehicle_id, data]) => {
        /**
         * สูตรคณิตศาสตร์ที่แม่นยำที่สุดสำหรับการคำนวณประสิทธิภาพน้ำมัน:
         * 
         * วิธีที่ 1: Total Distance / Total Liters (วิธีที่แม่นยำที่สุด) ✅
         * สูตร: efficiency = Σ(distance_since_last_fill) / Σ(liters)
         * 
         * ข้อดี:
         * - คำนวณจากระยะทางรวมและปริมาณน้ำมันรวม
         * - ครอบคลุมทุกครั้งที่เติมน้ำมัน
         * - ไม่ถูกบิดเบือนโดยการเติมน้ำมันบางครั้งที่น้อยหรือมาก
         * - เหมือนกับการคำนวณประสิทธิภาพจริงของรถ
         * 
         * วิธีที่ 2: Weighted Average (เท่ากับวิธีที่ 1)
         * สูตร: efficiency = Σ(efficiency_i × liters_i) / Σ(liters_i)
         * ซึ่งเท่ากับ: Σ(distance_i) / Σ(liters_i) = วิธีที่ 1
         * 
         * วิธีที่ 3: Simple Average (ไม่แม่นยำ - ไม่ใช้)
         * สูตร: efficiency = Σ(efficiency_i) / n
         * ข้อเสีย: ไม่คำนึงถึงปริมาณน้ำมันในแต่ละครั้ง
         */

        let calculatedEfficiency: number | null = null;

        // วิธีที่แม่นยำที่สุด: ใช้ totalDistance (sum of distance_since_last_fill)
        if (data.totalDistance > 0 && data.totalLiters > 0) {
          // สูตร: efficiency = totalDistance / totalLiters
          calculatedEfficiency = data.totalDistance / data.totalLiters;
        }
        // Fallback: ใช้ odometer range (ถ้าไม่มี distance_since_last_fill)
        // หมายเหตุ: วิธีนี้จะแม่นยำน้อยกว่าเพราะอาจไม่ครอบคลุมทุกครั้งที่เติมน้ำมัน
        else if (data.firstOdometer !== null && data.lastOdometer !== null && data.totalLiters > 0) {
          const odometerRange = data.lastOdometer - data.firstOdometer;
          if (odometerRange > 0) {
            // สูตร: efficiency = (lastOdometer - firstOdometer) / totalLiters
            calculatedEfficiency = odometerRange / data.totalLiters;
          }
        }

        return {
          vehicle_id,
          plate: data.plate,
          make: data.make,
          model: data.model,
          branch: data.branch,
          totalLiters: data.totalLiters,
          totalCost: data.totalCost,
          fillCount: data.fillCount,
          averageEfficiency: calculatedEfficiency,
          averagePricePerLiter: data.fillCount > 0 ? data.totalCost / (data.totalLiters || 1) : 0,
        };
      }).sort((a, b) => b.totalCost - a.totalCost);

      console.log('[reportsService] getVehicleFuelConsumption - Returning', result.length, 'vehicles');
      return result;
    } catch (error) {
      console.error('[reportsService] getVehicleFuelConsumption error:', error);
      // Re-throw with better error message if it's a network error
      if (error instanceof Error && (error.message.includes('fetch') || error.message.includes('Failed to fetch'))) {
        throw new Error(`Network error: ไม่สามารถเชื่อมต่อกับฐานข้อมูลได้ กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ตหรือ VPN. Original error: ${error.message}`);
      }
      throw error;
    }
  },

  // ========================================
  // Delivery Trip Reports
  // ========================================

  /**
   * Get delivery summary by vehicle
   * สรุปการส่งสินค้าตามรถ
   */
  getDeliverySummaryByVehicle: async (
    startDate?: Date,
    endDate?: Date,
    vehicleId?: string
  ): Promise<Array<{
    vehicle_id: string;
    plate: string;
    make: string | null;
    model: string | null;
    branch: string | null;
    totalTrips: number;
    totalStores: number;
    totalItems: number;
    totalQuantity: number;
    totalDistance: number;
    averageItemsPerTrip: number;
    averageQuantityPerTrip: number;
    averageStoresPerTrip: number;
  }>> => {
    try {
      const { supabase } = await import('../lib/supabase');

      // Default to last 3 months if no date range provided
      if (!startDate || !endDate) {
        const now = new Date();
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        startDate = new Date(now.getFullYear(), now.getMonth() - 2, 1);
      }

      // ใช้วันที่ local เพื่อหลีกเลี่ยงปัญหา timezone (เหมือนใน getProductDeliveryHistory)
      const formatDateForQuery = (date: Date): string => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };

      const startDateStr = formatDateForQuery(startDate);
      const endDateStr = formatDateForQuery(endDate);

      // Query from pre-aggregated daily stats table for trips/stores/items/quantity (fast)
      let statsQuery = supabase
        .from('delivery_stats_by_day_vehicle')
        .select(`
          stat_date,
          vehicle_id,
          total_trips,
          total_stores,
          total_items,
          total_quantity
        `)
        .gte('stat_date', startDateStr)
        .lte('stat_date', endDateStr);

      if (vehicleId) {
        statsQuery = statsQuery.eq('vehicle_id', vehicleId);
      }

      const { data: stats, error: statsError } = await statsQuery;

      if (statsError) {
        console.error('[reportsService] Error fetching vehicle stats:', statsError);
        throw statsError;
      }

      if (!stats || stats.length === 0) {
        return [];
      }

      // Get vehicle info separately to avoid dependency on relationship names
      const vehicleIds = Array.from(new Set(stats.map((s: any) => s.vehicle_id))).filter(Boolean);

      const { data: vehicles, error: vehiclesError } = await supabase
        .from('vehicles')
        .select('id, plate, make, model, branch')
        .in('id', vehicleIds);

      if (vehiclesError) {
        console.error('[reportsService] Error fetching vehicles for stats:', vehiclesError);
        throw vehiclesError;
      }

      const vehicleMap = new Map(
        (vehicles || []).map((v: any) => [v.id, v])
      );

      // **แก้ไข: ดึงระยะทางจาก trip_logs โดยตรง (ข้อมูลจริง)**
      // Query trip_logs for actual distance - นับทุก trip ไม่ว่าจะมี delivery_trip_id หรือไม่
      // เพราะระยะทางจริงของรถต้องนับทุกการใช้งาน (สำคัญสำหรับการคำนวณน้ำมัน, ค่าใช้จ่าย, การบำรุงรักษา)
      let tripLogsQuery = supabase
        .from('trip_logs')
        .select('vehicle_id, distance_km')
        .eq('status', 'checked_in')
        .not('distance_km', 'is', null)
        .gte('checkout_time', startDate.toISOString())
        .lte('checkout_time', endDate.toISOString())
        .in('vehicle_id', vehicleIds);

      const { data: tripLogs, error: tripLogsError } = await tripLogsQuery;

      if (tripLogsError) {
        console.error('[reportsService] Error fetching trip logs for distance:', tripLogsError);
        // Fallback to stats table distance if trip_logs query fails
        console.warn('[reportsService] Falling back to delivery_stats_by_day_vehicle distance');
      }

      // Aggregate stats by vehicle across multiple days
      const aggregatedByVehicle = new Map<string, {
        vehicle_id: string;
        plate: string;
        make: string | null;
        model: string | null;
        branch: string | null;
        totalTrips: number;
        totalStores: number;
        totalItems: number;
        totalQuantity: number;
        totalDistance: number;
      }>();

      (stats as any[]).forEach(stat => {
        const vid = stat.vehicle_id;
        if (!vid) return;

        const vehicle = vehicleMap.get(vid) as any;

        if (!aggregatedByVehicle.has(vid)) {
          aggregatedByVehicle.set(vid, {
            vehicle_id: vid,
            plate: vehicle?.plate || 'N/A',
            make: vehicle?.make || null,
            model: vehicle?.model || null,
            branch: vehicle?.branch || null,
            totalTrips: 0,
            totalStores: 0,
            totalItems: 0,
            totalQuantity: 0,
            totalDistance: 0,
          });
        }

        const agg = aggregatedByVehicle.get(vid)!;
        agg.totalTrips += Number(stat.total_trips || 0);
        agg.totalStores += Number(stat.total_stores || 0);
        agg.totalItems += Number(stat.total_items || 0);
        agg.totalQuantity += Number(stat.total_quantity || 0);
        // ระยะทางจะคำนวณจาก trip_logs แทน (ด้านล่าง)
      });

      // **แก้ไข: คำนวณระยะทางจาก trip_logs โดยตรง (ข้อมูลจริง)**
      // Sum distance from trip_logs for each vehicle
      if (tripLogs && tripLogs.length > 0) {
        const distanceMap = new Map<string, number>();

        tripLogs.forEach(log => {
          if (!log.vehicle_id || !log.distance_km) return;

          const vid = log.vehicle_id;
          if (!distanceMap.has(vid)) {
            distanceMap.set(vid, 0);
          }
          distanceMap.set(vid, (distanceMap.get(vid) || 0) + Number(log.distance_km || 0));
        });

        // Update aggregatedByVehicle with actual distance from trip_logs
        distanceMap.forEach((distance, vid) => {
          if (aggregatedByVehicle.has(vid)) {
            aggregatedByVehicle.get(vid)!.totalDistance = distance;
          }
        });
      } else {
        // Fallback: If no trip_logs data, try to get from stats table (may not be accurate)
        console.warn('[reportsService] No trip_logs data found, falling back to stats table distance');
        const { data: statsWithDistance } = await supabase
          .from('delivery_stats_by_day_vehicle')
          .select('vehicle_id, total_distance_km')
          .gte('stat_date', startDateStr)
          .lte('stat_date', endDateStr);

        if (vehicleId && statsWithDistance) {
          // Filter by vehicle if specified
          const filteredStats = statsWithDistance.filter((s: any) => s.vehicle_id === vehicleId);
          filteredStats.forEach((stat: any) => {
            const vid = stat.vehicle_id;
            if (aggregatedByVehicle.has(vid)) {
              aggregatedByVehicle.get(vid)!.totalDistance += Number(stat.total_distance_km || 0);
            }
          });
        } else if (statsWithDistance) {
          // Sum distance from stats table for all vehicles
          statsWithDistance.forEach((stat: any) => {
            const vid = stat.vehicle_id;
            if (aggregatedByVehicle.has(vid)) {
              aggregatedByVehicle.get(vid)!.totalDistance += Number(stat.total_distance_km || 0);
            }
          });
        }
      }

      const result = Array.from(aggregatedByVehicle.values()).map(vehicleData => ({
        vehicle_id: vehicleData.vehicle_id,
        plate: vehicleData.plate,
        make: vehicleData.make,
        model: vehicleData.model,
        branch: vehicleData.branch,
        totalTrips: vehicleData.totalTrips,
        totalStores: vehicleData.totalStores,
        totalItems: vehicleData.totalItems,
        totalQuantity: vehicleData.totalQuantity,
        totalDistance: vehicleData.totalDistance, // ใช้ระยะทางจาก trip_logs (ข้อมูลจริง)
        averageItemsPerTrip: vehicleData.totalTrips > 0 ? vehicleData.totalItems / vehicleData.totalTrips : 0,
        averageQuantityPerTrip: vehicleData.totalTrips > 0 ? vehicleData.totalQuantity / vehicleData.totalTrips : 0,
        averageStoresPerTrip: vehicleData.totalTrips > 0 ? vehicleData.totalStores / vehicleData.totalTrips : 0,
      })).sort((a, b) => b.totalTrips - a.totalTrips);

      return result;
    } catch (error) {
      console.error('[reportsService] getDeliverySummaryByVehicle error:', error);
      throw error;
    }
  },

  /**
   * Get delivery summary by store
   * สรุปการส่งสินค้าตามร้าน
   */
  getDeliverySummaryByStore: async (
    startDate?: Date,
    endDate?: Date,
    storeId?: string
  ): Promise<Array<{
    store_id: string;
    customer_code: string;
    customer_name: string;
    address: string | null;
    totalTrips: number;
    totalItems: number;
    totalQuantity: number;
    products: Array<{
      product_id: string;
      product_code: string;
      product_name: string;
      unit: string;
      totalQuantity: number;
      deliveryCount: number;
    }>;
  }>> => {
    try {
      const { supabase } = await import('../lib/supabase');

      // Default to last 3 months if no date range provided
      if (!startDate || !endDate) {
        const now = new Date();
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        startDate = new Date(now.getFullYear(), now.getMonth() - 2, 1);
      }

      // ใช้วันที่ local เพื่อเลี่ยง timezone
      const formatDateForQuery = (date: Date): string => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };

      const startDateStr = formatDateForQuery(startDate);
      const endDateStr = formatDateForQuery(endDate);

      console.log('[getDeliverySummaryByStore] Using date range:', { startDateStr, endDateStr });

      // 1) ดึง summary ตามร้านจากตาราง daily stats (เร็วมาก)
      let storeStatsQuery = supabase
        .from('delivery_stats_by_day_store')
        .select('stat_date, store_id, total_trips, total_items, total_quantity')
        .gte('stat_date', startDateStr)
        .lte('stat_date', endDateStr);

      if (storeId) {
        storeStatsQuery = storeStatsQuery.eq('store_id', storeId);
      }

      const { data: storeStats, error: storeStatsError } = await storeStatsQuery;

      if (storeStatsError) {
        console.error('[reportsService] Error fetching store stats:', storeStatsError);
        throw storeStatsError;
      }

      if (!storeStats || storeStats.length === 0) {
        return [];
      }

      // Aggregate summary per store acrossหลายวัน
      const aggregatedStoreStats = new Map<string, {
        store_id: string;
        totalTrips: number;
        totalItems: number;
        totalQuantity: number;
      }>();

      (storeStats as any[]).forEach(stat => {
        const sid = stat.store_id;
        if (!sid) return;

        if (!aggregatedStoreStats.has(sid)) {
          aggregatedStoreStats.set(sid, {
            store_id: sid,
            totalTrips: 0,
            totalItems: 0,
            totalQuantity: 0,
          });
        }

        const agg = aggregatedStoreStats.get(sid)!;
        agg.totalTrips += Number(stat.total_trips || 0);
        agg.totalItems += Number(stat.total_items || 0);
        agg.totalQuantity += Number(stat.total_quantity || 0);
      });

      const storeIds = Array.from(aggregatedStoreStats.keys());

      // 2) ดึงรายละเอียดร้าน
      const { data: stores, error: storesError } = await supabase
        .from('stores')
        .select('id, customer_code, customer_name, address')
        .in('id', storeIds);

      if (storesError) {
        console.error('[reportsService] Error fetching stores for stats:', storesError);
        throw storesError;
      }

      const storeMap = new Map(
        (stores || []).map((s: any) => [s.id, s])
      );

      // 3) ดึง summary ระดับ ร้าน+สินค้า
      let storeProductStatsQuery = supabase
        .from('delivery_stats_by_day_store_product')
        .select('stat_date, store_id, product_id, total_deliveries, total_quantity')
        .gte('stat_date', startDateStr)
        .lte('stat_date', endDateStr)
        .in('store_id', storeIds);

      const { data: storeProductStats, error: storeProductError } = await storeProductStatsQuery;

      if (storeProductError) {
        console.error('[reportsService] Error fetching store+product stats:', storeProductError);
        throw storeProductError;
      }

      const productIds = Array.from(
        new Set(
          (storeProductStats || []).map((s: any) => s.product_id).filter(Boolean)
        )
      );

      // 4) ดึงข้อมูลสินค้า
      let productsMap = new Map<string, any>();
      if (productIds.length > 0) {
        const { data: products, error: productsError } = await supabase
          .from('products')
          .select('id, product_code, product_name, unit')
          .in('id', productIds);

        if (productsError) {
          console.error('[reportsService] Error fetching products for stats:', productsError);
          throw productsError;
        }

        productsMap = new Map(
          (products || []).map((p: any) => [p.id, p])
        );
      }

      // 5) รวม summary ระดับร้าน + รายการสินค้า
      const storeProductAgg = new Map<string, Map<string, {
        product_id: string;
        totalQuantity: number;
        deliveryCount: number;
      }>>();

      (storeProductStats || []).forEach((stat: any) => {
        const sid = stat.store_id;
        const pid = stat.product_id;
        if (!sid || !pid) return;

        if (!storeProductAgg.has(sid)) {
          storeProductAgg.set(sid, new Map());
        }
        const productMapForStore = storeProductAgg.get(sid)!;

        if (!productMapForStore.has(pid)) {
          productMapForStore.set(pid, {
            product_id: pid,
            totalQuantity: 0,
            deliveryCount: 0,
          });
        }

        const agg = productMapForStore.get(pid)!;
        agg.totalQuantity += Number(stat.total_quantity || 0);
        agg.deliveryCount += Number(stat.total_deliveries || 0);
      });

      // 6) ประกอบผลลัพธ์สุดท้าย
      const result = Array.from(aggregatedStoreStats.values()).map(storeStat => {
        const store = storeMap.get(storeStat.store_id) as any;
        if (!store) return null;

        const productMapForStore = storeProductAgg.get(storeStat.store_id) || new Map();

        const products = Array.from(productMapForStore.values()).map(p => {
          const product = productsMap.get(p.product_id) as any;
          return {
            product_id: p.product_id,
            product_code: product?.product_code || '',
            product_name: product?.product_name || '',
            unit: product?.unit || '',
            totalQuantity: p.totalQuantity,
            deliveryCount: p.deliveryCount,
          };
        }).sort((a, b) => b.totalQuantity - a.totalQuantity);

        return {
          store_id: storeStat.store_id,
          customer_code: store.customer_code,
          customer_name: store.customer_name,
          address: store.address,
          totalTrips: storeStat.totalTrips,
          totalItems: storeStat.totalItems,
          totalQuantity: storeStat.totalQuantity,
          products,
        };
      }).filter(Boolean) as Array<{
        store_id: string;
        customer_code: string;
        customer_name: string;
        address: string | null;
        totalTrips: number;
        totalItems: number;
        totalQuantity: number;
        products: Array<{
          product_id: string;
          product_code: string;
          product_name: string;
          unit: string;
          totalQuantity: number;
          deliveryCount: number;
        }>;
      }>;

      // เรียงตามจำนวนทริปมาก→น้อย
      return result.sort((a, b) => b.totalTrips - a.totalTrips);
    } catch (error) {
      console.error('[reportsService] getDeliverySummaryByStore error:', error);
      throw error;
    }
  },

  /**
   * Get delivery summary by product
   * สรุปการส่งสินค้าตามสินค้า
   */
  getDeliverySummaryByProduct: async (
    startDate?: Date,
    endDate?: Date,
    productId?: string
  ): Promise<Array<{
    product_id: string;
    product_code: string;
    product_name: string;
    category: string;
    unit: string;
    totalQuantity: number;
    totalDeliveries: number;
    totalStores: number;
    stores: Array<{
      store_id: string;
      customer_code: string;
      customer_name: string;
      quantity: number;
      deliveryCount: number;
    }>;
  }>> => {
    try {
      const { supabase } = await import('../lib/supabase');

      // Default to last 3 months if no date range provided
      if (!startDate || !endDate) {
        const now = new Date();
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        startDate = new Date(now.getFullYear(), now.getMonth() - 2, 1);
      }

      // ใช้วันที่ local เพื่อเลี่ยง timezone
      const formatDateForQuery = (date: Date): string => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };

      const startDateStr = formatDateForQuery(startDate);
      const endDateStr = formatDateForQuery(endDate);

      // 1) ดึง summary ระดับร้าน+สินค้า จาก daily stats table
      let statsQuery = supabase
        .from('delivery_stats_by_day_store_product')
        .select('stat_date, store_id, product_id, total_deliveries, total_quantity')
        .gte('stat_date', startDateStr)
        .lte('stat_date', endDateStr);

      if (productId) {
        statsQuery = statsQuery.eq('product_id', productId);
      }

      const { data: stats, error: statsError } = await statsQuery;

      if (statsError) {
        console.error('[reportsService] Error fetching product stats:', statsError);
        throw statsError;
      }

      console.log('[getDeliverySummaryByProduct] Using date range:', { startDateStr, endDateStr });

      if (!stats || stats.length === 0) {
        return [];
      }

      const productIds = Array.from(
        new Set((stats as any[]).map(s => s.product_id).filter(Boolean))
      );
      const storeIds = Array.from(
        new Set((stats as any[]).map(s => s.store_id).filter(Boolean))
      );

      // 2) ดึงข้อมูลสินค้า
      const { data: products, error: productsError } = await supabase
        .from('products')
        .select('id, product_code, product_name, category, unit')
        .in('id', productIds);

      if (productsError) {
        console.error('[reportsService] Error fetching products for stats:', productsError);
        throw productsError;
      }

      const productMap = new Map(
        (products || []).map((p: any) => [p.id, p])
      );

      // 3) ดึงข้อมูลร้าน (สำหรับ stores array)
      let storesMap = new Map<string, any>();
      if (storeIds.length > 0) {
        const { data: stores, error: storesError } = await supabase
          .from('stores')
          .select('id, customer_code, customer_name')
          .in('id', storeIds);

        if (storesError) {
          console.error('[reportsService] Error fetching stores for product stats:', storesError);
          throw storesError;
        }

        storesMap = new Map(
          (stores || []).map((s: any) => [s.id, s])
        );
      }

      // 4) รวม summary ตามสินค้า
      const productAgg = new Map<string, {
        product_id: string;
        totalQuantity: number;
        totalDeliveries: number;
        storeStats: Map<string, {
          store_id: string;
          totalQuantity: number;
          deliveryCount: number;
        }>;
      }>();

      (stats as any[]).forEach(stat => {
        const pid = stat.product_id;
        const sid = stat.store_id;
        if (!pid || !sid) return;

        if (!productAgg.has(pid)) {
          productAgg.set(pid, {
            product_id: pid,
            totalQuantity: 0,
            totalDeliveries: 0,
            storeStats: new Map(),
          });
        }

        const agg = productAgg.get(pid)!;
        agg.totalQuantity += Number(stat.total_quantity || 0);
        agg.totalDeliveries += Number(stat.total_deliveries || 0);

        if (!agg.storeStats.has(sid)) {
          agg.storeStats.set(sid, {
            store_id: sid,
            totalQuantity: 0,
            deliveryCount: 0,
          });
        }

        const storeAgg = agg.storeStats.get(sid)!;
        storeAgg.totalQuantity += Number(stat.total_quantity || 0);
        storeAgg.deliveryCount += Number(stat.total_deliveries || 0);
      });

      // 5) ประกอบผลลัพธ์สุดท้าย
      const result = Array.from(productAgg.values()).map(productStat => {
        const product = productMap.get(productStat.product_id) as any;
        if (!product) return null;

        const stores = Array.from(productStat.storeStats.values()).map(s => {
          const store = storesMap.get(s.store_id) as any;
          return {
            store_id: s.store_id,
            customer_code: store?.customer_code || '',
            customer_name: store?.customer_name || '',
            quantity: s.totalQuantity,
            deliveryCount: s.deliveryCount,
          };
        }).sort((a, b) => b.quantity - a.quantity);

        return {
          product_id: product.id,
          product_code: product.product_code,
          product_name: product.product_name,
          category: product.category,
          unit: product.unit,
          totalQuantity: productStat.totalQuantity,
          totalDeliveries: productStat.totalDeliveries,
          totalStores: productStat.storeStats.size,
          stores,
        };
      }).filter(Boolean) as Array<{
        product_id: string;
        product_code: string;
        product_name: string;
        category: string;
        unit: string;
        totalQuantity: number;
        totalDeliveries: number;
        totalStores: number;
        stores: Array<{
          store_id: string;
          customer_code: string;
          customer_name: string;
          quantity: number;
          deliveryCount: number;
        }>;
      }>;

      // เรียงสินค้าที่มีจำนวนรวมมาก→น้อย
      return result.sort((a, b) => b.totalQuantity - a.totalQuantity);
    } catch (error) {
      console.error('[reportsService] getDeliverySummaryByProduct error:', error);
      throw error;
    }
  },

  /**
   * Get monthly delivery report
   * รายงานการส่งสินค้ารายเดือน
   */
  getMonthlyDeliveryReport: async (
    months: number = 6
  ): Promise<Array<{
    month: string; // YYYY-MM
    monthLabel: string; // "ม.ค. 2025"
    totalTrips: number;
    totalStores: number;
    totalItems: number;
    totalQuantity: number;
    totalDistance: number;
    averageItemsPerTrip: number;
    averageQuantityPerTrip: number;
  }>> => {
    try {
      const { supabase } = await import('../lib/supabase');

      const now = new Date();
      const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      const startDate = new Date(now.getFullYear(), now.getMonth() - months + 1, 1);

      // Query completed delivery trips
      // We need to filter by actual delivery date, not planned_date or updated_at
      // Strategy: Get all completed trips, then filter by store delivery dates
      const { data: allCompletedTrips, error: tripsError } = await supabase
        .from('delivery_trips')
        .select('id, planned_date')
        .eq('status', 'completed');

      if (tripsError) {
        console.error('[reportsService] Error fetching trips:', tripsError);
        throw tripsError;
      }

      if (!allCompletedTrips || allCompletedTrips.length === 0) {
        return [];
      }

      const allTripIds = allCompletedTrips.map(t => t.id);

      // Get trip stores - we'll filter by date in memory with fallbacks
      const { data: tripStores } = await supabase
        .from('delivery_trip_stores')
        .select(`
          id, 
          delivery_trip_id, 
          delivery_status, 
          delivered_at,
          delivery_trip:delivery_trips!inner(id, updated_at, planned_date)
        `)
        .in('delivery_trip_id', allTripIds);

      if (!tripStores || tripStores.length === 0) {
        return [];
      }

      // Get trip_logs to find checkin_time for trips without delivered_at
      let tripLogs: any[] = [];
      try {
        const { data: tripLogsData, error: tripLogsError } = await supabase
          .from('trip_logs')
          .select('id, delivery_trip_id, checkin_time')
          .in('delivery_trip_id', allTripIds)
          .not('checkin_time', 'is', null);

        if (tripLogsError) {
          console.warn('[reportsService] trip_logs fetch error, fallback to empty:', tripLogsError.message);
        } else {
          tripLogs = tripLogsData || [];
        }
      } catch (err: any) {
        console.warn('[reportsService] trip_logs fetch exception, fallback to empty:', err?.message || err);
      }

      const tripLogMap = new Map((tripLogs || []).map(tl => [tl.delivery_trip_id, tl]));

      // Filter stores by date range in memory
      // Priority: delivered_at > checkin_time > updated_at > planned_date
      const filteredStores = tripStores.filter((store: any) => {
        // Determine effective date - use multiple fallbacks
        let effectiveDateStr = store.delivered_at;

        if (!effectiveDateStr) {
          // Fallback 1: Use checkin_time from trip_logs (most accurate for old data)
          const tripLog = tripLogMap.get(store.delivery_trip_id) as any;
          if (tripLog?.checkin_time) {
            effectiveDateStr = tripLog.checkin_time;
          }
        }

        if (!effectiveDateStr) {
          // Fallback 2: Use trip updated_at
          effectiveDateStr = store.delivery_trip?.updated_at;
        }

        if (!effectiveDateStr) {
          // Fallback 3: Use trip planned_date (last resort)
          effectiveDateStr = store.delivery_trip?.planned_date;
        }

        if (!effectiveDateStr) return false; // Skip stores without any date

        const effectiveDate = new Date(effectiveDateStr);
        return effectiveDate >= startDate && effectiveDate <= endDate;
      });

      if (filteredStores.length === 0) {
        return [];
      }

      // Get unique trip IDs from filtered stores
      const tripIds = [...new Set(filteredStores.map((ts: any) => ts.delivery_trip_id))];

      const tripStoreIds = (tripStores || []).map(ts => ts.id);

      // Get trip items
      const { data: tripItems } = await supabase
        .from('delivery_trip_items')
        .select('delivery_trip_store_id, quantity')
        .in('delivery_trip_store_id', tripStoreIds);

      // Get trip logs for distance (use different variable name to avoid conflict)
      // Note: .in() already filters out null values, so no need for .not('delivery_trip_id', 'is', null)
      // Cannot use both .in() and .not() on the same column in Supabase
      const { data: tripLogsForDistance } = await supabase
        .from('trip_logs')
        .select('delivery_trip_id, distance_km')
        .in('delivery_trip_id', tripIds);

      // Filter out null delivery_trip_id in JavaScript (in case some slips through)
      const filteredTripLogs = (tripLogsForDistance || []).filter(log => log.delivery_trip_id !== null);

      // Group by month
      const monthMap = new Map<string, {
        trips: any[];
        tripLogs: typeof tripLogs;
      }>();

      allCompletedTrips.forEach(trip => {
        const date = new Date(trip.planned_date);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

        if (!monthMap.has(monthKey)) {
          monthMap.set(monthKey, {
            trips: [],
            tripLogs: [],
          });
        }
        monthMap.get(monthKey)!.trips.push(trip);
      });

      // Add trip logs for distance calculation
      filteredTripLogs.forEach(log => {
        if (log.delivery_trip_id) {
          // Find which month this trip belongs to based on filtered stores
          const storeForTrip = filteredStores.find((s: any) => s.delivery_trip_id === log.delivery_trip_id);
          if (storeForTrip) {
            // Determine effective date for grouping
            let effectiveDateStr = storeForTrip.delivered_at;

            if (!effectiveDateStr) {
              const tripLog = tripLogMap.get(storeForTrip.delivery_trip_id) as any;
              if (tripLog?.checkin_time) {
                effectiveDateStr = tripLog.checkin_time;
              }
            }

            if (!effectiveDateStr) {
              effectiveDateStr = storeForTrip.delivery_trip?.updated_at;
            }

            if (!effectiveDateStr) {
              effectiveDateStr = storeForTrip.delivery_trip?.planned_date;
            }

            if (effectiveDateStr) {
              const date = new Date(effectiveDateStr);
              const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
              const monthData = monthMap.get(monthKey);
              if (monthData) {
                monthData.tripLogs.push(log);
              }
            }
          }
        }
      });

      // Calculate metrics
      const result = Array.from(monthMap.entries()).map(([monthKey, monthData]) => {
        const date = new Date(monthKey + '-01');
        const monthLabel = date.toLocaleDateString('th-TH', { month: 'short', year: 'numeric' });

        const tripIdsForMonth = Array.from(monthData.trips);
        const storesForMonth = filteredStores.filter((ts: any) => tripIdsForMonth.includes(ts.delivery_trip_id));
        const itemsForMonth = (tripItems || []).filter(item => {
          const store = tripStores?.find(ts => ts.id === item.delivery_trip_store_id);
          return store && tripIdsForMonth.includes(store.delivery_trip_id);
        });

        const totalQuantity = itemsForMonth.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
        const totalDistance = monthData.tripLogs.reduce((sum, log) => sum + (log.distance_km || 0), 0);

        return {
          month: monthKey,
          monthLabel,
          totalTrips: tripIdsForMonth.length,
          totalStores: storesForMonth.length,
          totalItems: itemsForMonth.length,
          totalQuantity,
          totalDistance,
          averageItemsPerTrip: monthData.trips.length > 0 ? itemsForMonth.length / monthData.trips.length : 0,
          averageQuantityPerTrip: monthData.trips.length > 0 ? totalQuantity / monthData.trips.length : 0,
        };
      }).sort((a, b) => a.month.localeCompare(b.month));

      return result;
    } catch (error) {
      console.error('[reportsService] getMonthlyDeliveryReport error:', error);
      throw error;
    }
  },

  /**
   * Get staff commission summary
   * สรุปค่าคอมมิชชั่นตามพนักงาน (ใช้สำหรับดูภาพรวมการกระจายงาน/ค่าคอม)
   * ใช้ข้อมูลจาก commission_logs ที่ถูกคำนวณและบันทึกแล้ว
   */
  getStaffCommissionSummary: async (
    startDate?: Date,
    endDate?: Date
  ): Promise<StaffCommissionSummary[]> => {
    try {
      const { supabase } = await import('../lib/supabase');

      // ถ้าไม่กำหนดช่วงวันที่ ให้ default เป็น 3 เดือนล่าสุด
      if (!startDate || !endDate) {
        const now = new Date();
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        startDate = new Date(now.getFullYear(), now.getMonth() - 2, 1);
      }

      const formatDateForQuery = (date: Date): string => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };

      const startDateStr = formatDateForQuery(startDate);
      const endDateStr = formatDateForQuery(endDate);

      // 1) ดึงทริปที่อยู่ในช่วงวันที่ (ใช้ planned_date ของ delivery_trips)
      const { data: trips, error: tripsError } = await supabase
        .from('delivery_trips')
        .select('id, planned_date')
        .eq('status', 'completed')
        .gte('planned_date', startDateStr)
        .lte('planned_date', endDateStr);

      if (tripsError) {
        console.error('[reportsService] Error fetching trips for staff commission summary:', tripsError);
        throw tripsError;
      }

      if (!trips || trips.length === 0) {
        return [];
      }

      const tripIds = (trips as any[]).map(t => t.id);

      // 2) ดึง commission_logs ของทริปเหล่านี้ พร้อมข้อมูลพนักงาน
      const { data: logs, error: logsError } = await supabase
        .from('commission_logs')
        .select(`
          staff_id,
          delivery_trip_id,
          total_items_delivered,
          actual_commission,
          staff:service_staff!commission_logs_staff_id_fkey (
            id,
            name,
            status
          )
        `)
        .in('delivery_trip_id', tripIds);

      if (logsError) {
        console.error('[reportsService] Error fetching commission logs for staff summary:', logsError);
        throw logsError;
      }

      if (!logs || logs.length === 0) {
        return [];
      }

      // 3) สรุปข้อมูลตามพนักงาน
      type StaffAgg = {
        staff_id: string;
        staff_name: string;
        totalActualCommission: number;
        tripIds: Set<string>;
      };

      const staffMap = new Map<string, StaffAgg>();

      (logs as any[]).forEach(log => {
        const staffId = log.staff_id as string | null;
        if (!staffId) return;

        const staffName =
          (log.staff as any)?.name ||
          'ไม่ทราบชื่อ';

        if (!staffMap.has(staffId)) {
          staffMap.set(staffId, {
            staff_id: staffId,
            staff_name: staffName,
            totalActualCommission: 0,
            tripIds: new Set<string>(),
          });
        }

        const agg = staffMap.get(staffId)!;
        agg.totalActualCommission += Number(log.actual_commission || 0);
        if (log.delivery_trip_id) {
          agg.tripIds.add(log.delivery_trip_id as string);
        }
      });

      // 4) แปลงเป็น array และคำนวณค่าเฉลี่ย/ทริป
      const result: StaffCommissionSummary[] = Array.from(staffMap.values()).map(agg => {
        const totalTrips = agg.tripIds.size;
        const totalActualCommission = agg.totalActualCommission;

        return {
          staff_id: agg.staff_id,
          staff_name: agg.staff_name,
          totalTrips,
          totalActualCommission,
          averageCommissionPerTrip: totalTrips > 0
            ? totalActualCommission / totalTrips
            : 0,
        };
      })
        // เรียงจากคนที่มียอดค่าคอมมากไปน้อย
        .sort((a, b) => b.totalActualCommission - a.totalActualCommission);

      return result;
    } catch (error) {
      console.error('[reportsService] getStaffCommissionSummary error:', error);
      throw error;
    }
  },

  /**
   * Get detailed delivery history for a specific store and product
   * รายละเอียดการส่งสินค้าแต่ละครั้งของร้านและสินค้า
   */
  getProductDeliveryHistory: async (
    storeId: string,
    productId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<Array<{
    delivery_date: string;
    trip_number: string;
    trip_id: string;
    quantity: number;
    vehicle_plate: string | null;
    driver_name: string | null;
  }>> => {
    try {
      const { supabase } = await import('../lib/supabase');

      // Default to last 3 months if no date range provided
      if (!startDate || !endDate) {
        const now = new Date();
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        startDate = new Date(now.getFullYear(), now.getMonth() - 2, 1);
      }

      // Ensure dates are valid
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        throw new Error('Invalid date range provided');
      }

      // Format dates properly for Supabase (YYYY-MM-DD)
      // Use local date to avoid timezone issues
      const formatDateForQuery = (date: Date): string => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };

      const startDateStr = formatDateForQuery(startDate);
      const endDateStr = formatDateForQuery(endDate);

      console.log('[getProductDeliveryHistory] Query params:', {
        storeId,
        productId,
        startDate: startDateStr,
        endDate: endDateStr,
        startDateObj: startDate,
        endDateObj: endDate,
      });

      // Query completed delivery trips
      let tripsQuery = supabase
        .from('delivery_trips')
        .select(`
          id,
          trip_number,
          planned_date,
          vehicle:vehicles!delivery_trips_vehicle_id_fkey(plate),
          driver:profiles!delivery_trips_driver_id_fkey(full_name)
        `)
        .eq('status', 'completed')
        .gte('planned_date', startDateStr)
        .lte('planned_date', endDateStr);

      const { data: trips, error: tripsError } = await tripsQuery;

      if (tripsError) {
        console.error('[reportsService] Error fetching trips:', {
          error: tripsError,
          message: tripsError.message,
          details: tripsError.details,
          hint: tripsError.hint,
          code: tripsError.code,
          query: {
            storeId,
            productId,
            startDate: startDateStr,
            endDate: endDateStr,
          },
        });
        throw new Error(`Failed to fetch delivery trips: ${tripsError.message || 'Unknown error'}`);
      }

      if (!trips || trips.length === 0) {
        console.log('[getProductDeliveryHistory] No trips found for date range:', {
          startDate: startDateStr,
          endDate: endDateStr,
        });
        return [];
      }

      const tripIds = trips.map((t: any) => t.id);
      const tripMap = new Map(trips.map((t: any) => [t.id, t]));

      // Get trip stores for this store
      const { data: tripStores } = await supabase
        .from('delivery_trip_stores')
        .select('id, delivery_trip_id')
        .in('delivery_trip_id', tripIds)
        .eq('store_id', storeId);

      if (!tripStores || tripStores.length === 0) {
        return [];
      }

      // Get trip items for this product
      const tripStoreIds = tripStores.map(ts => ts.id);
      const { data: tripItems } = await supabase
        .from('delivery_trip_items')
        .select('delivery_trip_store_id, quantity')
        .in('delivery_trip_store_id', tripStoreIds)
        .eq('product_id', productId);

      if (!tripItems || tripItems.length === 0) {
        return [];
      }

      // Map items to trips
      const result = tripItems.map(item => {
        const tripStore = tripStores.find(ts => ts.id === item.delivery_trip_store_id);
        if (!tripStore) {
          console.warn('[getProductDeliveryHistory] Trip store not found for item:', item);
          return null;
        }

        const trip = tripMap.get(tripStore.delivery_trip_id) as any;
        if (!trip) {
          console.warn('[getProductDeliveryHistory] Trip not found for trip_id:', tripStore.delivery_trip_id);
          return null;
        }

        const vehicle = trip.vehicle as any;
        const driver = trip.driver as any;

        return {
          delivery_date: trip.planned_date,
          trip_number: trip.trip_number,
          trip_id: trip.id,
          quantity: Number(item.quantity || 0),
          vehicle_plate: vehicle?.plate || null,
          driver_name: driver?.full_name || null,
        };
      }).filter((item): item is {
        delivery_date: string;
        trip_number: string;
        trip_id: string;
        quantity: number;
        vehicle_plate: string | null;
        driver_name: string | null;
      } => item !== null);

      // Sort by date descending (newest first)
      const sorted = result.sort((a, b) => {
        const dateCompare = b.delivery_date.localeCompare(a.delivery_date);
        if (dateCompare !== 0) return dateCompare;
        // If same date, sort by trip_number
        return b.trip_number.localeCompare(a.trip_number);
      });

      console.log('[getProductDeliveryHistory] Result:', {
        storeId,
        productId,
        totalItems: tripItems.length,
        totalTrips: trips.length,
        resultCount: sorted.length,
        sample: sorted.slice(0, 3),
      });

      return sorted;
    } catch (error) {
      console.error('[reportsService] getProductDeliveryHistory error:', error);
      throw error;
    }
  },

  /**
   * Get staff item statistics (จำนวนสินค้าที่พนักงานแต่ละคนยก)
   * สถิติการยกสินค้าของพนักงานแต่ละคนในช่วงเวลาที่กำหนด
   */
  getStaffItemStatistics: async (
    startDate?: Date,
    endDate?: Date
  ): Promise<StaffItemStatistics[]> => {
    try {
      const { supabase } = await import('../lib/supabase');

      // Format dates for SQL function
      const formatDateForQuery = (date: Date): string => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };

      const startDateStr = startDate ? formatDateForQuery(startDate) : null;
      const endDateStr = endDate ? formatDateForQuery(endDate) : null;

      // Call SQL function
      const { data, error } = await supabase.rpc('get_staff_item_statistics', {
        start_date: startDateStr,
        end_date: endDateStr,
      });

      if (error) {
        console.error('[reportsService] getStaffItemStatistics error:', error);
        throw error;
      }

      return (data || []).map((item: any) => ({
        staff_id: item.staff_id,
        staff_name: item.staff_name,
        staff_code: item.staff_code,
        staff_phone: item.staff_phone,
        staff_status: item.staff_status,
        total_trips: parseInt(item.total_trips || '0', 10),
        total_items_carried: parseFloat(item.total_items_carried || '0'),
        completed_trips: parseInt(item.completed_trips || '0', 10),
        in_progress_trips: parseInt(item.in_progress_trips || '0', 10),
        planned_trips: parseInt(item.planned_trips || '0', 10),
        last_trip_date: item.last_trip_date,
        first_trip_date: item.first_trip_date,
      }));
    } catch (error) {
      console.error('[reportsService] getStaffItemStatistics error:', error);
      throw error;
    }
  },

  /**
   * Get detailed staff item distribution (รายละเอียดการยกสินค้าของพนักงานแต่ละคนแบบละเอียด)
   * แสดงว่าพนักงานแต่ละคนยกสินค้าแต่ละชนิดไปเท่าไร
   */
  getStaffItemDetails: async (
    startDate?: Date,
    endDate?: Date,
    staffId?: string
  ): Promise<StaffItemDetail[]> => {
    try {
      const { supabase } = await import('../lib/supabase');

      // Format dates for SQL function
      const formatDateForQuery = (date: Date): string => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };

      const startDateStr = startDate ? formatDateForQuery(startDate) : null;
      const endDateStr = endDate ? formatDateForQuery(endDate) : null;

      // Call SQL function
      const { data, error } = await supabase.rpc('get_staff_item_details', {
        start_date: startDateStr,
        end_date: endDateStr,
        staff_id_param: staffId || null,
      });

      if (error) {
        console.error('[reportsService] getStaffItemDetails error:', error);
        throw error;
      }

      return (data || []).map((item: any) => ({
        staff_id: item.staff_id,
        staff_name: item.staff_name,
        staff_code: item.staff_code,
        staff_phone: item.staff_phone,
        staff_status: item.staff_status,
        delivery_trip_id: item.delivery_trip_id,
        trip_number: item.trip_number,
        planned_date: item.planned_date,
        product_id: item.product_id,
        product_code: item.product_code,
        product_name: item.product_name,
        category: item.category,
        unit: item.unit,
        total_quantity: parseFloat(item.total_quantity || '0'),
        quantity_per_staff: parseFloat(item.quantity_per_staff || '0'),
        store_name: item.store_name,
        store_code: item.store_code,
      }));
    } catch (error) {
      console.error('[reportsService] getStaffItemDetails error:', error);
      throw error;
    }
  },

  /**
   * Refresh delivery stats by vehicle for a date range
   * รีเฟรชข้อมูลสรุปการส่งสินค้าตามรถสำหรับช่วงวันที่ที่กำหนด
   */
  refreshDeliveryStatsByVehicle: async (
    startDate?: Date,
    endDate?: Date
  ): Promise<void> => {
    try {
      const { supabase } = await import('../lib/supabase');

      // Default to last 3 months if no date range provided
      if (!startDate || !endDate) {
        const now = new Date();
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        startDate = new Date(now.getFullYear(), now.getMonth() - 2, 1);
      }

      // Format dates for SQL function
      const formatDateForQuery = (date: Date): string => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };

      const startDateStr = formatDateForQuery(startDate);
      const endDateStr = formatDateForQuery(endDate);

      // Call the refresh function via RPC
      const { error } = await supabase.rpc('refresh_delivery_stats_by_day_vehicle', {
        p_start_date: startDateStr,
        p_end_date: endDateStr,
      });

      if (error) {
        console.error('[reportsService] Error refreshing delivery stats:', error);
        throw error;
      }
    } catch (error) {
      console.error('[reportsService] refreshDeliveryStatsByVehicle error:', error);
      throw error;
    }
  },
};

