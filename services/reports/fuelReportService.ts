// Fuel reports - financials, monthly fuel, vehicle comparison, fuel trend
import { supabase } from '../../lib/supabase';

export interface Financials {
  todayCost: number;
  costTrend: number; // percent
  monthlyCost: number; // ค่าใช้จ่ายเดือนนี้
}

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

async function getMonthlyFuelReportImpl(months: number = 6, startDate?: Date, endDate?: Date, branch?: string): Promise<MonthlyFuelReport[]> {
  let queryStartDate: Date;
  if (startDate) {
    queryStartDate = startDate;
  } else {
    queryStartDate = new Date();
    queryStartDate.setMonth(queryStartDate.getMonth() - months);
  }

  let query: any;
  if (branch) {
    query = supabase
      .from('fuel_records')
      .select(`
        filled_at,
        liters,
        total_cost,
        fuel_efficiency,
        vehicle:vehicles!inner(branch)
      `)
      .eq('vehicle.branch', branch)
      .gte('filled_at', queryStartDate.toISOString());
  } else {
    query = supabase
      .from('fuel_efficiency_summary')
      .select('*')
      .gte('month', queryStartDate.toISOString().split('T')[0]);
  }

  if (endDate) {
    if (branch) {
      query = query.lte('filled_at', endDate.toISOString());
    } else {
      query = query.lte('month', endDate.toISOString().split('T')[0]);
    }
  }

  const { data, error } = await (branch ? query.order('filled_at', { ascending: true }) : query.order('month', { ascending: true }));
  if (error) throw error;

  const monthMap = new Map<string, {
    totalLiters: number;
    totalCost: number;
    totalPrice: number;
    fillCount: number;
    efficiencies: number[];
  }>();

  if (branch) {
    data?.forEach((record: any) => {
      const filledAt = new Date(record.filled_at);
      const monthKey = `${filledAt.getFullYear()}-${String(filledAt.getMonth() + 1).padStart(2, '0')}`;
      if (!monthMap.has(monthKey)) {
        monthMap.set(monthKey, { totalLiters: 0, totalCost: 0, totalPrice: 0, fillCount: 0, efficiencies: [] });
      }
      const entry = monthMap.get(monthKey)!;
      entry.totalLiters += Number(record.liters) || 0;
      entry.totalCost += Number(record.total_cost) || 0;
      entry.fillCount += 1;
      if (record.fuel_efficiency) entry.efficiencies.push(Number(record.fuel_efficiency));
    });
  } else {
    data?.forEach((record: any) => {
      const monthKey = record.month.toString().substring(0, 7);
      if (!monthMap.has(monthKey)) {
        monthMap.set(monthKey, { totalLiters: 0, totalCost: 0, totalPrice: 0, fillCount: 0, efficiencies: [] });
      }
      const entry = monthMap.get(monthKey)!;
      entry.totalLiters += Number(record.total_liters) || 0;
      entry.totalCost += Number(record.total_cost) || 0;
      entry.fillCount += Number(record.fill_count) || 0;
      if (record.avg_efficiency) entry.efficiencies.push(Number(record.avg_efficiency));
    });
  }

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
}

export const fuelReportService = {
  getFinancials: async (): Promise<Financials> => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayEnd = new Date(yesterday);
      yesterdayEnd.setHours(23, 59, 59, 999);
      const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

      const [
        todayMaintenanceResult,
        yesterdayMaintenanceResult,
        monthlyMaintenanceResult,
        todayFuelResult,
        yesterdayFuelResult,
        monthlyFuelResult,
      ] = await Promise.all([
        supabase.from('ticket_costs').select('cost').gte('created_at', today.toISOString()),
        supabase.from('ticket_costs').select('cost').gte('created_at', yesterday.toISOString()).lte('created_at', yesterdayEnd.toISOString()),
        supabase.from('ticket_costs').select('cost').gte('created_at', firstDayOfMonth.toISOString()),
        supabase.from('fuel_records').select('total_cost').gte('filled_at', today.toISOString()),
        supabase.from('fuel_records').select('total_cost').gte('filled_at', yesterday.toISOString()).lte('filled_at', yesterdayEnd.toISOString()),
        supabase.from('fuel_records').select('total_cost').gte('filled_at', firstDayOfMonth.toISOString()),
      ]);

      [todayMaintenanceResult, yesterdayMaintenanceResult, monthlyMaintenanceResult, todayFuelResult, yesterdayFuelResult, monthlyFuelResult].forEach((r) => {
        if (r.error) throw r.error;
      });

      const todayMaintenanceCost = todayMaintenanceResult.data?.reduce((sum, item) => sum + (item.cost || 0), 0) || 0;
      const yesterdayMaintenanceCost = yesterdayMaintenanceResult.data?.reduce((sum, item) => sum + (item.cost || 0), 0) || 0;
      const monthlyMaintenanceCost = monthlyMaintenanceResult.data?.reduce((sum, item) => sum + (item.cost || 0), 0) || 0;
      const todayFuelCost = todayFuelResult.data?.reduce((sum, item) => sum + (item.total_cost || 0), 0) || 0;
      const yesterdayFuelCost = yesterdayFuelResult.data?.reduce((sum, item) => sum + (item.total_cost || 0), 0) || 0;
      const monthlyFuelCost = monthlyFuelResult.data?.reduce((sum, item) => sum + (item.total_cost || 0), 0) || 0;

      const todayCost = todayMaintenanceCost + todayFuelCost;
      const yesterdayCost = yesterdayMaintenanceCost + yesterdayFuelCost;
      const monthlyCost = monthlyMaintenanceCost + monthlyFuelCost;
      const costTrend = yesterdayCost > 0 ? ((todayCost - yesterdayCost) / yesterdayCost) * 100 : 0;

      return { todayCost, costTrend, monthlyCost };
    } catch (error) {
      console.error('[fuelReportService] getFinancials error:', error);
      throw error;
    }
  },

  getMonthlyFuelReport: getMonthlyFuelReportImpl,

  getVehicleFuelComparison: async (months: number = 6, startDate?: Date, endDate?: Date, branch?: string): Promise<VehicleFuelComparison[]> => {
    let queryStartDate: Date;
    if (startDate) {
      queryStartDate = startDate;
    } else {
      queryStartDate = new Date();
      queryStartDate.setMonth(queryStartDate.getMonth() - months);
      queryStartDate.setHours(0, 0, 0, 0);
    }

    let query = supabase
      .from('fuel_records')
      .select(`
        vehicle_id,
        liters,
        total_cost,
        fuel_efficiency,
        distance_since_last_fill,
        odometer,
        vehicle:vehicles!inner(id, plate, make, model, branch)
      `)
      .gte('filled_at', queryStartDate.toISOString());

    if (endDate) query = query.lte('filled_at', endDate.toISOString());
    if (branch) query = query.eq('vehicle.branch', branch);

    const { data: fuelRecords, error } = await query.order('filled_at', { ascending: true });
    if (error) throw error;
    if (!fuelRecords || fuelRecords.length === 0) return [];

    const vehicleMap = new Map<string, {
      plate: string;
      make: string | null;
      model: string | null;
      totalLiters: number;
      totalCost: number;
      totalDistance: number;
      fillCount: number;
      weightedEfficiencySum: number;
      weightedEfficiencyLiters: number;
      minOdometer: number | null;
      maxOdometer: number | null;
      odoLiters: number;
    }>();

    fuelRecords.forEach((record: any) => {
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
          totalDistance: 0,
          fillCount: 0,
          weightedEfficiencySum: 0,
          weightedEfficiencyLiters: 0,
          minOdometer: null,
          maxOdometer: null,
          odoLiters: 0,
        });
      }
      const entry = vehicleMap.get(vehicleId)!;
      const liters = Number(record.liters) || 0;
      const cost = Number(record.total_cost) || 0;
      const distance = Number(record.distance_since_last_fill) || 0;
      const odometer = Number(record.odometer) || 0;
      const efficiency = record.fuel_efficiency !== null && record.fuel_efficiency !== undefined ? Number(record.fuel_efficiency) : null;
      entry.totalLiters += liters;
      entry.totalCost += cost;
      entry.fillCount += 1;
      if (distance > 0 && liters > 0) entry.totalDistance += distance;
      if (efficiency !== null && !isNaN(efficiency) && efficiency > 0 && efficiency < 1000 && liters > 0) {
        entry.weightedEfficiencySum += efficiency * liters;
        entry.weightedEfficiencyLiters += liters;
      }
      if (odometer > 0 && liters > 0) {
        if (entry.minOdometer === null || odometer < entry.minOdometer) entry.minOdometer = odometer;
        if (entry.maxOdometer === null || odometer > entry.maxOdometer) entry.maxOdometer = odometer;
        entry.odoLiters += liters;
      }
    });

    return Array.from(vehicleMap.entries())
      .map(([vehicle_id, data]) => {
        let averageEfficiency: number | null = null;
        if (data.totalDistance > 0 && data.totalLiters > 0) {
          averageEfficiency = data.totalDistance / data.totalLiters;
        } else if (data.weightedEfficiencyLiters > 0) {
          averageEfficiency = data.weightedEfficiencySum / data.weightedEfficiencyLiters;
        } else if (data.minOdometer !== null && data.maxOdometer !== null && data.maxOdometer > data.minOdometer && data.odoLiters > 0) {
          averageEfficiency = (data.maxOdometer - data.minOdometer) / data.odoLiters;
        }
        return {
          vehicle_id,
          plate: data.plate,
          make: data.make,
          model: data.model,
          totalLiters: data.totalLiters,
          totalCost: data.totalCost,
          averageEfficiency,
          fillCount: data.fillCount,
        };
      })
      .filter(vehicle => vehicle.totalCost > 0 || vehicle.totalLiters > 0)
      .sort((a, b) => b.totalCost - a.totalCost);
  },

  getFuelTrend: async (months: number = 6, startDate?: Date, endDate?: Date, branch?: string): Promise<FuelTrend> => {
    let report = await getMonthlyFuelReportImpl(months, startDate, endDate, branch);
    if (report.length === 0 && !startDate && !endDate) {
      report = await getMonthlyFuelReportImpl(24, undefined, undefined, branch);
    }
    return {
      labels: report.map(r => r.monthLabel),
      liters: report.map(r => r.totalLiters),
      costs: report.map(r => r.totalCost),
      efficiency: report.map(r => r.averageEfficiency),
    };
  },
};
