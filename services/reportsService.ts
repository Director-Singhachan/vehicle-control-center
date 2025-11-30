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
  getMonthlyFuelReport: async (months: number = 6): Promise<MonthlyFuelReport[]> => {
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);

    const { data, error } = await supabase
      .from('fuel_efficiency_summary')
      .select('*')
      .gte('month', startDate.toISOString().split('T')[0])
      .order('month', { ascending: true });

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
  getVehicleFuelComparison: async (months: number = 6): Promise<VehicleFuelComparison[]> => {
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);

    const { data, error } = await supabase
      .from('fuel_efficiency_summary')
      .select('*')
      .gte('month', startDate.toISOString().split('T')[0]);

    if (error) throw error;

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

    data?.forEach(record => {
      if (!vehicleMap.has(record.vehicle_id)) {
        vehicleMap.set(record.vehicle_id, {
          plate: record.plate,
          make: record.make,
          model: record.model,
          totalLiters: 0,
          totalCost: 0,
          fillCount: 0,
          efficiencies: [],
        });
      }

      const entry = vehicleMap.get(record.vehicle_id)!;
      entry.totalLiters += record.total_liters || 0;
      entry.totalCost += record.total_cost || 0;
      entry.fillCount += record.fill_count || 0;
      if (record.avg_efficiency) {
        entry.efficiencies.push(record.avg_efficiency);
      }
    });

    // Convert to array and calculate averages
    return Array.from(vehicleMap.entries()).map(([vehicle_id, data]) => ({
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
    })).sort((a, b) => b.totalCost - a.totalCost);
  },

  // Get fuel trend (for charts)
  getFuelTrend: async (months: number = 6): Promise<FuelTrend> => {
    const report = await reportsService.getMonthlyFuelReport(months);
    
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
};

