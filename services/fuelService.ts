// Fuel Service - CRUD operations for fuel_records
import { supabase } from '../lib/supabase';
import type { Database } from '../types/database';
import { notificationService } from './notificationService';

type FuelRecord = Database['public']['Tables']['fuel_records']['Row'];
type FuelRecordInsert = Database['public']['Tables']['fuel_records']['Insert'];
type FuelRecordUpdate = Database['public']['Tables']['fuel_records']['Update'];
type FuelEfficiencySummary = Database['public']['Views']['fuel_efficiency_summary']['Row'];

export const fuelService = {
  // Get all fuel records
  getAll: async (filters?: {
    vehicle_id?: string;
    user_id?: string;
  }): Promise<FuelRecord[]> => {
    let query = supabase
      .from('fuel_records')
      .select('*')
      .order('filled_at', { ascending: false });

    if (filters?.vehicle_id) {
      query = query.eq('vehicle_id', filters.vehicle_id);
    }
    if (filters?.user_id) {
      query = query.eq('user_id', filters.user_id);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  },

  // Get fuel record by ID
  getById: async (id: string): Promise<any | null> => {
    const { data, error } = await supabase
      .from('fuel_records')
      .select(`
        *,
        user:profiles!user_id(full_name, email, avatar_url),
        vehicle:vehicles!vehicle_id(plate, make, model, branch, image_url)
      `)
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  },

  // Get fuel efficiency summary (using view)
  getEfficiencySummary: async (vehicleId?: string): Promise<FuelEfficiencySummary[]> => {
    let query = supabase
      .from('fuel_efficiency_summary')
      .select('*')
      .order('month', { ascending: false });

    if (vehicleId) {
      query = query.eq('vehicle_id', vehicleId);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  },

  // Get latest fuel record for a vehicle
  getLatest: async (vehicleId: string): Promise<FuelRecord | null> => {
    const { data, error } = await supabase
      .from('fuel_records')
      .select('*')
      .eq('vehicle_id', vehicleId)
      .order('filled_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows returned
    return data || null;
  },

  // Create fuel record
  create: async (record: FuelRecordInsert): Promise<FuelRecord> => {
    const { data, error } = await supabase
      .from('fuel_records')
      .insert(record)
      .select()
      .single();

    if (error) throw error;

    // Create notification event for fuel refill
    try {
      // Fetch vehicle and user details for notification
      const { data: vehicle } = await supabase
        .from('vehicles')
        .select('plate, make, model')
        .eq('id', record.vehicle_id)
        .single();

      const { data: user } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', record.user_id)
        .single();

      const vehicleLabel = vehicle?.make && vehicle?.model
        ? `${vehicle.plate} (${vehicle.make} ${vehicle.model})`
        : (vehicle?.plate || 'ไม่ระบุทะเบียน');

      const filledAt = new Date(record.filled_at).toLocaleString('th-TH', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });

      const totalCost = record.liters * record.price_per_liter;

      const messageLines = [
        `⛽ [บันทึกการเติมน้ำมัน]`,
        `🚗 รถ: ${vehicleLabel}`,
        `👤 ผู้เติม: ${user?.full_name || 'ไม่ระบุ'}`,
        `💧 ปริมาณ: ${Number(record.liters).toLocaleString()} ลิตร`,
        `💰 ราคา: ${totalCost.toLocaleString()} บาท`,
        `🏷️ ราคา/ลิตร: ${Number(record.price_per_liter).toLocaleString()} บาท`,
        `📏 เลขไมล์: ${Number(record.odometer).toLocaleString()} km`,
        `⛽ ประเภท: ${record.fuel_type}`,
        `⏰ เวลา: ${filledAt}`,
        record.fuel_station ? `🏪 ปั๊ม: ${record.fuel_station}` : undefined,
        record.notes ? `📝 หมายเหตุ: ${record.notes}` : undefined,
      ].filter(Boolean);

      const baseEvent = {
        event_type: 'fuel_refill' as const,
        title: `เติมน้ำมัน: ${vehicle?.plate}`,
        message: messageLines.join('\n'),
        payload: {
          fuel_record_id: data.id,
          vehicle_id: record.vehicle_id,
          liters: record.liters,
          total_cost: totalCost,
        },
      };

      // Telegram (กลุ่มกลาง)
      await notificationService.createEvent({
        channel: 'telegram', // Send fuel refill notifications via Telegram
        ...baseEvent,
      });

      // LINE (กลุ่มกลาง)
      await notificationService.createEvent({
        channel: 'line',
        ...baseEvent,
      });

    } catch (notifyError) {
      console.error('[fuelService] Failed to create notification event for fuel_refill:', notifyError);
      // Don't throw to avoid affecting the save operation
    }

    return data;
  },

  // Update fuel record (with admin-only odometer editing)
  update: async (id: string, updates: FuelRecordUpdate): Promise<FuelRecord> => {
    // Get current user
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      throw new Error('User not authenticated');
    }

    // Get user profile to check role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    // Prevent odometer updates for non-admin users
    if (profile?.role !== 'admin' && updates.odometer !== undefined) {
      delete (updates as any).odometer;
    }

    // Note: total_cost is a generated column, so we don't need to calculate or send it
    // It will be automatically calculated by the database as: liters * price_per_liter

    // Remove total_cost from updates if it exists (it's a generated column)
    if ('total_cost' in updates) {
      delete (updates as any).total_cost;
    }

    const { data, error } = await supabase
      .from('fuel_records')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Delete fuel record
  delete: async (id: string): Promise<void> => {
    const { error } = await supabase
      .from('fuel_records')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  // Get fuel history with pagination and filters
  getFuelHistory: async (filters?: {
    vehicle_id?: string;
    user_id?: string;
    start_date?: string;
    end_date?: string;
    fuel_type?: string;
    branch?: string;
    limit?: number;
    offset?: number;
  }): Promise<{
    data: (FuelRecord & {
      user?: { full_name: string; email?: string; avatar_url?: string | null };
      vehicle?: { plate: string; make?: string; model?: string; branch?: string; image_url?: string | null };
    })[]; count: number
  }> => {
    const limit = filters?.limit || 100;
    const offset = filters?.offset || 0;

    let query;

    if (filters?.branch) {
      // Use inner join behavior to filter by branch
      query = supabase
        .from('fuel_records')
        .select(`
          *,
          user:profiles!user_id(full_name, email, avatar_url),
          vehicle:vehicles!inner(plate, make, model, branch, image_url)
        `, { count: 'exact' })
        .eq('vehicle.branch', filters.branch);
    } else {
      query = supabase
        .from('fuel_records')
        .select(`
          *,
          user:profiles!user_id(full_name, email, avatar_url),
          vehicle:vehicles!vehicle_id(plate, make, model, branch, image_url)
        `, { count: 'exact' });
    }

    query = query.order('filled_at', { ascending: false }).range(offset, offset + limit - 1);

    if (filters?.vehicle_id) {
      query = query.eq('vehicle_id', filters.vehicle_id);
    }
    if (filters?.user_id) {
      query = query.eq('user_id', filters.user_id);
    }
    if (filters?.start_date) {
      query = query.gte('filled_at', filters.start_date);
    }
    if (filters?.end_date) {
      query = query.lte('filled_at', filters.end_date);
    }
    if (filters?.fuel_type) {
      query = query.eq('fuel_type', filters.fuel_type);
    }

    const { data, error, count } = await query;

    if (error) throw error;
    return {
      data: data || [],
      count: count || 0,
    };
  },

  // Get fuel statistics
  getFuelStats: async (filters?: {
    vehicle_id?: string;
    start_date?: string;
    end_date?: string;
    branch?: string;
  }): Promise<{
    totalCost: number;
    totalLiters: number;
    averagePricePerLiter: number;
    averageEfficiency: number | null;
    totalRecords: number;
  }> => {
    let query;

    if (filters?.branch) {
      query = supabase
        .from('fuel_records')
        .select('total_cost, liters, price_per_liter, fuel_efficiency, vehicle:vehicles!inner(branch)')
        .eq('vehicle.branch', filters.branch);
    } else {
      query = supabase
        .from('fuel_records')
        .select('total_cost, liters, price_per_liter, fuel_efficiency');
    }

    if (filters?.vehicle_id) {
      query = query.eq('vehicle_id', filters.vehicle_id);
    }
    if (filters?.start_date) {
      query = query.gte('filled_at', filters.start_date);
    }
    if (filters?.end_date) {
      query = query.lte('filled_at', filters.end_date);
    }

    const { data, error } = await query;

    if (error) throw error;

    const records = data || [];
    const totalCost = records.reduce((sum, r) => sum + (Number(r.total_cost) || 0), 0);
    const totalLiters = records.reduce((sum, r) => sum + (Number(r.liters) || 0), 0);
    const totalPrice = records.reduce((sum, r) => sum + (Number(r.price_per_liter) || 0), 0);
    const efficiencyRecords = records.filter(r => r.fuel_efficiency !== null);
    const totalEfficiency = efficiencyRecords.reduce((sum, r) => sum + (Number(r.fuel_efficiency) || 0), 0);

    return {
      totalCost,
      totalLiters,
      averagePricePerLiter: records.length > 0 ? totalPrice / records.length : 0,
      averageEfficiency: efficiencyRecords.length > 0 ? totalEfficiency / efficiencyRecords.length : null,
      totalRecords: records.length,
    };
  },

  // Upload receipt image
  uploadReceipt: async (file: File, vehicleId: string): Promise<string> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const fileExt = file.name.split('.').pop();
    const fileName = `${vehicleId}/${user.id}/${Date.now()}.${fileExt}`;
    const filePath = `fuel-receipts/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('ticket-attachments') // Using existing bucket, or create new one
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
      .from('ticket-attachments')
      .getPublicUrl(filePath);

    return publicUrl;
  },

  // Get fuel efficiency alerts (vehicles with efficiency 20% below average)
  getEfficiencyAlerts: async (): Promise<Array<{
    vehicle_id: string;
    vehicle_plate: string;
    vehicle_make: string | null;
    vehicle_model: string | null;
    current_efficiency: number;
    average_efficiency: number;
    efficiency_drop_percent: number;
    last_fill_date: string;
  }>> => {
    // Get all vehicles with their efficiency data
    const { data: efficiencySummary, error } = await supabase
      .from('fuel_efficiency_summary')
      .select('*')
      .not('avg_efficiency', 'is', null)
      .order('month', { ascending: false });

    if (error) throw error;

    // Group by vehicle and calculate overall average
    const vehicleAverages = new Map<string, {
      plate: string;
      make: string | null;
      model: string | null;
      efficiencies: number[];
      lastMonth: string;
    }>();

    efficiencySummary?.forEach((record) => {
      if (!record.avg_efficiency) return;

      const existing = vehicleAverages.get(record.vehicle_id) || {
        plate: record.plate,
        make: record.make,
        model: record.model,
        efficiencies: [],
        lastMonth: record.month,
      };

      existing.efficiencies.push(record.avg_efficiency);
      if (record.month > existing.lastMonth) {
        existing.lastMonth = record.month;
      }

      vehicleAverages.set(record.vehicle_id, existing);
    });

    // Calculate alerts
    const alerts: Array<{
      vehicle_id: string;
      vehicle_plate: string;
      vehicle_make: string | null;
      vehicle_model: string | null;
      current_efficiency: number;
      average_efficiency: number;
      efficiency_drop_percent: number;
      last_fill_date: string;
    }> = [];

    vehicleAverages.forEach((data, vehicleId) => {
      if (data.efficiencies.length < 2) return; // Need at least 2 months to compare

      // Get overall average (excluding last month)
      const historicalEfficiencies = data.efficiencies.slice(1); // Exclude most recent
      const overallAverage = historicalEfficiencies.reduce((sum, eff) => sum + eff, 0) / historicalEfficiencies.length;
      const currentEfficiency = data.efficiencies[0]; // Most recent month

      // Check if current efficiency is 20% below average
      const dropPercent = ((overallAverage - currentEfficiency) / overallAverage) * 100;

      if (dropPercent >= 20) {
        // Get last fill date
        alerts.push({
          vehicle_id: vehicleId,
          vehicle_plate: data.plate,
          vehicle_make: data.make,
          vehicle_model: data.model,
          current_efficiency: currentEfficiency,
          average_efficiency: overallAverage,
          efficiency_drop_percent: dropPercent,
          last_fill_date: data.lastMonth,
        });
      }
    });

    return alerts.sort((a, b) => b.efficiency_drop_percent - a.efficiency_drop_percent);
  },

  // Get monthly fuel costs report
  getMonthlyFuelCosts: async (months: number = 12): Promise<Array<{
    month: string;
    total_cost: number;
    total_liters: number;
    average_price_per_liter: number;
    fill_count: number;
    vehicles: Array<{
      vehicle_id: string;
      plate: string;
      cost: number;
      liters: number;
    }>;
  }>> => {
    const { data: summary, error } = await supabase
      .from('fuel_efficiency_summary')
      .select('*')
      .order('month', { ascending: false })
      .limit(months);

    if (error) throw error;

    // Group by month
    const monthlyData = new Map<string, {
      month: string;
      total_cost: number;
      total_liters: number;
      total_price: number;
      fill_count: number;
      vehicles: Map<string, { vehicle_id: string; plate: string; cost: number; liters: number }>;
    }>();

    summary?.forEach((record) => {
      const monthKey = record.month;
      const existing = monthlyData.get(monthKey) || {
        month: monthKey,
        total_cost: 0,
        total_liters: 0,
        total_price: 0,
        fill_count: 0,
        vehicles: new Map(),
      };

      existing.total_cost += Number(record.total_cost) || 0;
      existing.total_liters += Number(record.total_liters) || 0;
      existing.fill_count += Number(record.fill_count) || 0;

      // Track per vehicle
      const vehicleData = existing.vehicles.get(record.vehicle_id) || {
        vehicle_id: record.vehicle_id,
        plate: record.plate,
        cost: 0,
        liters: 0,
      };
      vehicleData.cost += Number(record.total_cost) || 0;
      vehicleData.liters += Number(record.total_liters) || 0;
      existing.vehicles.set(record.vehicle_id, vehicleData);

      monthlyData.set(monthKey, existing);
    });

    // Convert to array format
    return Array.from(monthlyData.values())
      .map((data) => ({
        month: data.month,
        total_cost: data.total_cost,
        total_liters: data.total_liters,
        average_price_per_liter: data.total_liters > 0 ? data.total_cost / data.total_liters : 0,
        fill_count: data.fill_count,
        vehicles: Array.from(data.vehicles.values()),
      }))
      .sort((a, b) => b.month.localeCompare(a.month));
  },

  // Get vehicle efficiency comparison
  getVehicleEfficiencyComparison: async ({
    months = 6,
    startDate,
    endDate,
    branch,
  }: {
    months?: number;
    startDate?: Date;
    endDate?: Date;
    branch?: string;
  }): Promise<Array<{
    vehicle_id: string;
    plate: string;
    make: string | null;
    model: string | null;
    average_efficiency: number;
    total_distance: number;
    total_liters: number;
    total_cost: number;
    fill_count: number;
    efficiency_rank: number;
  }>> => {
    let queryStartDate: string;
    if (startDate) {
      queryStartDate = startDate.toISOString().split('T')[0];
    } else {
      const date = new Date();
      date.setMonth(date.getMonth() - months);
      date.setDate(1); // First day of month
      queryStartDate = date.toISOString().split('T')[0];
    }

    let query = supabase
      .from('fuel_efficiency_summary')
      .select('*')
      .gte('month', queryStartDate)
      .not('avg_efficiency', 'is', null);

    if (endDate) {
      query = query.lte('month', endDate.toISOString().split('T')[0]);
    }

    if (branch) {
      query = query.eq('branch', branch);
    }

    const { data: summary, error } = await query;

    if (error) throw error;

    // Group by vehicle
    const vehicleData = new Map<string, {
      vehicle_id: string;
      plate: string;
      make: string | null;
      model: string | null;
      efficiencies: number[];
      total_liters: number;
      total_cost: number;
      fill_count: number;
    }>();

    summary?.forEach((record) => {
      if (!record.avg_efficiency) return;

      const existing = vehicleData.get(record.vehicle_id) || {
        vehicle_id: record.vehicle_id,
        plate: record.plate,
        make: record.make,
        model: record.model,
        efficiencies: [],
        total_liters: 0,
        total_cost: 0,
        fill_count: 0,
      };

      existing.efficiencies.push(record.avg_efficiency);
      existing.total_liters += Number(record.total_liters) || 0;
      existing.total_cost += Number(record.total_cost) || 0;
      existing.fill_count += Number(record.fill_count) || 0;

      vehicleData.set(record.vehicle_id, existing);
    });

    // Calculate averages and total distance
    const comparison = Array.from(vehicleData.values())
      .map((data) => {
        const averageEfficiency = data.efficiencies.reduce((sum, eff) => sum + eff, 0) / data.efficiencies.length;
        const totalDistance = averageEfficiency * data.total_liters;

        return {
          vehicle_id: data.vehicle_id,
          plate: data.plate,
          make: data.make,
          model: data.model,
          average_efficiency: averageEfficiency,
          total_distance: totalDistance,
          total_liters: data.total_liters,
          total_cost: data.total_cost,
          fill_count: data.fill_count,
          efficiency_rank: 0, // Will be set after sorting
        };
      })
      .sort((a, b) => b.average_efficiency - a.average_efficiency)
      .map((item, index) => ({
        ...item,
        efficiency_rank: index + 1,
      }));

    return comparison;
  },
};

