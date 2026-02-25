// Product/vehicle reports - maintenance, cost analysis, usage ranking, fuel consumption
import { supabase, getSupabaseConfigError } from '../../lib/supabase';

export interface MaintenanceTrends {
  labels: string[];
  costs: number[];
  incidents: number[];
}

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

export const productReportService = {
  getMaintenanceTrends: async (months: number = 6): Promise<MaintenanceTrends> => {
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);

    const [costsResult, incidentsResult] = await Promise.all([
      supabase
        .from('ticket_costs')
        .select(`
          cost,
          ticket:tickets!inner(created_at)
        `)
        .gte('tickets.created_at', startDate.toISOString()),
      supabase
        .from('tickets')
        .select('created_at')
        .gte('created_at', startDate.toISOString())
    ]);

    if (costsResult.error) throw costsResult.error;
    if (incidentsResult.error) throw incidentsResult.error;

    const costsData = costsResult.data;
    const incidentsData = incidentsResult.data;
    const monthMap = new Map<string, { costs: number; incidents: number }>();

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

    incidentsData?.forEach(item => {
      const date = new Date(item.created_at);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (!monthMap.has(monthKey)) {
        monthMap.set(monthKey, { costs: 0, incidents: 0 });
      }
      const entry = monthMap.get(monthKey)!;
      entry.incidents += 1;
    });

    const sortedMonths = Array.from(monthMap.entries()).sort();
    const labels = sortedMonths.map(([key]) => {
      const [year, month] = key.split('-');
      const date = new Date(parseInt(year), parseInt(month) - 1);
      return date.toLocaleDateString('th-TH', { month: 'short' });
    });
    const costs = sortedMonths.map(([, data]) => data.costs);
    const incidents = sortedMonths.map(([, data]) => data.incidents);

    return { labels, costs, incidents };
  },

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
        monthMap.set(monthKey, { totalCost: 0, ticketIds: new Set() });
      }
      const entry = monthMap.get(monthKey)!;
      entry.totalCost += item.cost || 0;
      entry.ticketIds.add(ticket.id);
    });

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
      const ticketDate = new Date(ticket.created_at);
      if (!entry.lastMaintenanceDate || ticketDate > new Date(entry.lastMaintenanceDate)) {
        entry.lastMaintenanceDate = ticket.created_at;
      }
    });

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

  getCostAnalysis: async (startDate: Date, endDate: Date): Promise<CostAnalysis> => {
    const [fuelResult, maintenanceResult] = await Promise.all([
      supabase
        .from('fuel_records')
        .select('total_cost')
        .gte('filled_at', startDate.toISOString())
        .lte('filled_at', endDate.toISOString()),
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

  getCostPerKm: async (months: number = 6): Promise<CostPerKm[]> => {
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);

    const { data: fuelData, error: fuelError } = await supabase
      .from('fuel_records')
      .select('vehicle_id, total_cost, vehicles(plate, make, model)')
      .gte('filled_at', startDate.toISOString());

    if (fuelError) throw fuelError;

    const { data: maintenanceData, error: maintenanceError } = await supabase
      .from('ticket_costs')
      .select(`
        cost,
        ticket:tickets!inner(vehicle_id, created_at, vehicles(plate, make, model))
      `)
      .gte('tickets.created_at', startDate.toISOString());

    if (maintenanceError) throw maintenanceError;

    const { data: tripData, error: tripError } = await supabase
      .from('trip_logs')
      .select('vehicle_id, distance_km, vehicles(plate, make, model)')
      .eq('status', 'checked_in')
      .not('distance_km', 'is', null)
      .gte('checkout_time', startDate.toISOString());

    if (tripError) throw tripError;

    const vehicleMap = new Map<string, {
      plate: string;
      make: string | null;
      model: string | null;
      totalFuelCost: number;
      totalMaintenanceCost: number;
      totalDistance: number;
    }>();

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

  getMonthlyCostTrend: async (months: number = 6): Promise<MonthlyCostTrend[]> => {
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);

    const { data: fuelData, error: fuelError } = await supabase
      .from('fuel_records')
      .select('total_cost, filled_at')
      .gte('filled_at', startDate.toISOString());

    if (fuelError) throw fuelError;

    const { data: maintenanceData, error: maintenanceError } = await supabase
      .from('ticket_costs')
      .select(`
        cost,
        ticket:tickets!inner(created_at)
      `)
      .gte('tickets.created_at', startDate.toISOString());

    if (maintenanceError) throw maintenanceError;

    const monthMap = new Map<string, { fuelCost: number; maintenanceCost: number }>();

    fuelData?.forEach(record => {
      const date = new Date(record.filled_at);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (!monthMap.has(monthKey)) {
        monthMap.set(monthKey, { fuelCost: 0, maintenanceCost: 0 });
      }
      monthMap.get(monthKey)!.fuelCost += record.total_cost || 0;
    });

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
        const now = new Date();
        startDate = new Date(now.getFullYear(), now.getMonth() - 2, 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      }

      const { data: tripLogs, error: tripLogsError } = await supabase
        .from('trip_logs')
        .select('vehicle_id, distance_km, duration_hours, checkout_time')
        .eq('status', 'checked_in')
        .gte('checkout_time', startDate.toISOString())
        .lte('checkout_time', endDate.toISOString());

      if (tripLogsError) {
        if (tripLogsError.message?.includes('fetch') || tripLogsError.message?.includes('Failed to fetch')) {
          throw new Error(`Network error: ไม่สามารถเชื่อมต่อกับฐานข้อมูลได้ กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ตหรือ VPN. Original error: ${tripLogsError.message}`);
        }
        throw tripLogsError;
      }

      if (!tripLogs || tripLogs.length === 0) {
        return [];
      }

      const vehicleIds = [...new Set(tripLogs.map(t => t.vehicle_id).filter(Boolean))];
      if (vehicleIds.length === 0) return [];

      const { data: vehicles, error: vehiclesError } = await supabase
        .from('vehicles')
        .select('id, plate, make, model, branch')
        .in('id', vehicleIds);

      if (vehiclesError) {
        if (vehiclesError.message?.includes('fetch') || vehiclesError.message?.includes('Failed to fetch')) {
          throw new Error(`Network error: ไม่สามารถเชื่อมต่อกับฐานข้อมูลได้ กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ตหรือ VPN. Original error: ${vehiclesError.message}`);
        }
        throw vehiclesError;
      }

      if (!vehicles || vehicles.length === 0) return [];

      const vehicleMap = new Map<string, {
        plate: string;
        make: string | null;
        model: string | null;
        branch: string | null;
      }>();
      vehicles?.forEach(v => {
        vehicleMap.set(v.id, { plate: v.plate, make: v.make, model: v.model, branch: v.branch });
      });

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
        if (options?.branch && vehicle.branch !== options.branch) return;

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

      return options?.limit ? result.slice(0, options.limit) : result;
    } catch (error) {
      if (error instanceof Error && (error.message.includes('fetch') || error.message.includes('Failed to fetch'))) {
        throw new Error(`Network error: ไม่สามารถเชื่อมต่อกับฐานข้อมูลได้ กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ตหรือ VPN. Original error: ${error.message}`);
      }
      throw error;
    }
  },

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
        const now = new Date();
        startDate = new Date(now.getFullYear(), now.getMonth() - 2, 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      }

      const { data: fuelRecords, error } = await supabase
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

      if (error) {
        if (error.message?.includes('fetch') || error.message?.includes('Failed to fetch')) {
          throw new Error(`Network error: ไม่สามารถเชื่อมต่อกับฐานข้อมูลได้ กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ตหรือ VPN. Original error: ${error.message}`);
        }
        throw error;
      }

      if (!fuelRecords || fuelRecords.length === 0) return [];

      const vehicleMap = new Map<string, {
        plate: string;
        make: string | null;
        model: string | null;
        branch: string | null;
        totalLiters: number;
        totalCost: number;
        fillCount: number;
        totalDistance: number;
        firstOdometer: number | null;
        lastOdometer: number | null;
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
        if (options?.branch && vehicle.branch !== options.branch) return;

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
        if (record.distance_since_last_fill && record.distance_since_last_fill > 0) {
          entry.totalDistance += record.distance_since_last_fill;
        }
        if (record.odometer) {
          if (entry.firstOdometer === null || record.odometer < entry.firstOdometer) {
            entry.firstOdometer = record.odometer;
          }
          if (entry.lastOdometer === null || record.odometer > entry.lastOdometer) {
            entry.lastOdometer = record.odometer;
          }
        }
      });

      return Array.from(vehicleMap.entries()).map(([vehicle_id, data]) => {
        let calculatedEfficiency: number | null = null;
        if (data.totalDistance > 0 && data.totalLiters > 0) {
          calculatedEfficiency = data.totalDistance / data.totalLiters;
        } else if (data.firstOdometer !== null && data.lastOdometer !== null && data.totalLiters > 0) {
          const odometerRange = data.lastOdometer - data.firstOdometer;
          if (odometerRange > 0) {
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
    } catch (error) {
      if (error instanceof Error && (error.message.includes('fetch') || error.message.includes('Failed to fetch'))) {
        throw new Error(`Network error: ไม่สามารถเชื่อมต่อกับฐานข้อมูลได้ กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ตหรือ VPN. Original error: ${error.message}`);
      }
      throw error;
    }
  },
};
