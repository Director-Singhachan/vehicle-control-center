// Reports Service - Analytics and reporting
import { supabase } from '../lib/supabase';

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
      const [todayResult, yesterdayResult, monthlyResult] = await Promise.all([
        // Today's costs
        supabase
          .from('ticket_costs')
          .select('cost')
          .gte('created_at', today.toISOString()),

        // Yesterday's costs
        supabase
          .from('ticket_costs')
          .select('cost')
          .gte('created_at', yesterday.toISOString())
          .lte('created_at', yesterdayEnd.toISOString()),

        // This month's costs
        supabase
          .from('ticket_costs')
          .select('cost')
          .gte('created_at', firstDayOfMonth.toISOString())
      ]);

      if (todayResult.error) {
        console.error('[reportsService] Error fetching today costs:', todayResult.error);
        throw todayResult.error;
      }

      if (yesterdayResult.error) {
        console.error('[reportsService] Error fetching yesterday costs:', yesterdayResult.error);
        throw yesterdayResult.error;
      }

      if (monthlyResult.error) {
        console.error('[reportsService] Error fetching monthly costs:', monthlyResult.error);
        throw monthlyResult.error;
      }

      const todayCosts = todayResult.data;
      const yesterdayCosts = yesterdayResult.data;
      const monthlyCosts = monthlyResult.data;

      console.log('[reportsService] Costs count:', { 
        today: todayCosts?.length, 
        yesterday: yesterdayCosts?.length,
        monthly: monthlyCosts?.length 
      });

      const todayCost = todayCosts?.reduce((sum, item) => sum + (item.cost || 0), 0) || 0;
      const yesterdayCost = yesterdayCosts?.reduce((sum, item) => sum + (item.cost || 0), 0) || 0;
      const monthlyCost = monthlyCosts?.reduce((sum, item) => sum + (item.cost || 0), 0) || 0;

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
};

