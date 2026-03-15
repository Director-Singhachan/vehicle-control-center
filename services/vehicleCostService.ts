/**
 * vehicleCostService.ts
 * Phase 1: ดึงต้นทุนคงที่จาก vehicle_tax_records + vehicle_insurance_records (ปันส่วนรายปี)
 * Phase 2: vehicle_fixed_costs ปันส่วน + Daily Rate + รวมต้นทุนผันแปร (fuel, commission, tickets, vehicle_variable_costs)
 * Phase 3: CRUD สำหรับ vehicle_fixed_costs และ vehicle_variable_costs (UI บันทึกต้นทุน)
 */
import { supabase } from '../lib/supabase';
import type { Database } from '../types/database';

type VehicleFixedCostRow = Database['public']['Tables']['vehicle_fixed_costs']['Row'];
type VehicleFixedCostInsert = Database['public']['Tables']['vehicle_fixed_costs']['Insert'];
type VehicleFixedCostUpdate = Database['public']['Tables']['vehicle_fixed_costs']['Update'];
type VehicleVariableCostRow = Database['public']['Tables']['vehicle_variable_costs']['Row'];
type VehicleVariableCostInsert = Database['public']['Tables']['vehicle_variable_costs']['Insert'];
type VehicleVariableCostUpdate = Database['public']['Tables']['vehicle_variable_costs']['Update'];

export interface GetProratedFixedCostOptions {
  vehicleId: string;
  startDate: string; // YYYY-MM-DD or ISO
  endDate: string;
}

/** จำนวนวันระหว่างสองวัน (รวมทั้ง start และ end) */
export function daysInRange(start: string, end: string): number {
  const s = new Date(start.split('T')[0]);
  const e = new Date(end.split('T')[0]);
  const diff = Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(0, diff + 1);
}

/** คำนวณ overlap (วัน) ระหว่าง [refStart, refEnd] กับ [rangeStart, rangeEnd] */
function overlapDays(
  refStart: Date,
  refEnd: Date,
  rangeStart: Date,
  rangeEnd: Date
): number {
  const start = refStart > rangeStart ? refStart : rangeStart;
  const end = refEnd < rangeEnd ? refEnd : rangeEnd;
  if (end < start) return 0;
  return Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
}

/**
 * Phase 1: ต้นทุนคงที่จากภาษีและประกันเท่านั้น (ปันส่วนตามช่วงที่เลือก)
 * - ภาษี: แต่ละรายการถือว่า cover 1 ปีจาก paid_date；ปันส่วน = amount * (overlap_days / 365)
 * - ประกัน: premium_amount ปันส่วน = premium_amount * (days_in_range / 365)
 * คืนเป็นบาท (ไม่ติดลบ)
 */
export async function getProratedFixedCostFromTaxAndInsurance(
  options: GetProratedFixedCostOptions
): Promise<{ totalFixedFromTaxInsurance: number }> {
  const { vehicleId, startDate, endDate } = options;
  const startStr = startDate.split('T')[0];
  const endStr = endDate.split('T')[0];
  const rangeStart = new Date(startStr);
  const rangeEnd = new Date(endStr);
  const daysInFilter = daysInRange(startStr, endStr);

  let total = 0;

  // ภาษี: vehicle_tax_records — แต่ละรายการถือว่าเป็นรายปีจาก paid_date
  const { data: taxRows } = await supabase
    .from('vehicle_tax_records')
    .select('amount, paid_date')
    .eq('vehicle_id', vehicleId)
    .not('paid_date', 'is', null);

  if (taxRows?.length) {
    for (const row of taxRows) {
      const amount = Number(row.amount) || 0;
      if (amount <= 0) continue;
      const paid = new Date((row.paid_date as string).split('T')[0]);
      const yearEnd = new Date(paid);
      yearEnd.setFullYear(yearEnd.getFullYear() + 1);
      yearEnd.setDate(yearEnd.getDate() - 1);
      const days = overlapDays(paid, yearEnd, rangeStart, rangeEnd);
      if (days > 0) {
        total += amount * (days / 365);
      }
    }
  }

  // ประกัน: vehicle_insurance_records — ใช้รายการล่าสุด (created_at) premium_amount ปันส่วนตามจำนวนวันใน filter
  const { data: insRows } = await supabase
    .from('vehicle_insurance_records')
    .select('premium_amount, created_at')
    .eq('vehicle_id', vehicleId)
    .not('premium_amount', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1);

  if (insRows?.length && daysInFilter > 0) {
    const premium = Number(insRows[0].premium_amount) || 0;
    if (premium > 0) {
      total += premium * (Math.min(daysInFilter, 365) / 365);
    }
  }

  return { totalFixedFromTaxInsurance: Math.max(0, total) };
}

/**
 * Phase 2: ต้นทุนคงที่จาก vehicle_fixed_costs (ปันส่วนตาม period_type monthly/yearly)
 */
async function getProratedFixedCostFromVehicleFixedCosts(
  options: GetProratedFixedCostOptions
): Promise<number> {
  const { vehicleId, startDate, endDate } = options;
  const startStr = startDate.split('T')[0];
  const endStr = endDate.split('T')[0];
  const rangeStart = new Date(startStr);
  const rangeEnd = new Date(endStr);

  const { data: rows } = await supabase
    .from('vehicle_fixed_costs')
    .select('amount, period_type, period_start, period_end')
    .eq('vehicle_id', vehicleId);

  if (!rows?.length) return 0;

  let total = 0;
  for (const row of rows) {
    const amount = Number(row.amount) || 0;
    if (amount <= 0) continue;
    const periodStart = new Date((row.period_start as string).split('T')[0]);
    let periodEnd: Date;
    if (row.period_end) {
      periodEnd = new Date((row.period_end as string).split('T')[0]);
    } else {
      if (row.period_type === 'yearly') {
        periodEnd = new Date(periodStart);
        periodEnd.setFullYear(periodEnd.getFullYear() + 1);
        periodEnd.setDate(periodEnd.getDate() - 1);
      } else {
        periodEnd = new Date(periodStart);
        periodEnd.setMonth(periodEnd.getMonth() + 1);
        periodEnd.setDate(periodEnd.getDate() - 1);
      }
    }
    const days = overlapDays(periodStart, periodEnd, rangeStart, rangeEnd);
    if (days <= 0) continue;

    if (row.period_type === 'yearly') {
      const periodDays =
        Math.round((periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      total += amount * (days / Math.max(1, periodDays));
    } else {
      // monthly: amount ต่อเดือน, ปันส่วนตามจำนวนวันที่ overlap
      const periodDays =
        Math.round((periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      total += amount * (days / Math.max(1, periodDays));
    }
  }
  return Math.max(0, total);
}

/**
 * Phase 2: ต้นทุนคงที่รวมปันส่วน (ภาษี + ประกัน + vehicle_fixed_costs) และต้นทุนคงที่ต่อวัน
 */
export async function getTotalProratedFixedCostAndDailyRate(
  options: GetProratedFixedCostOptions
): Promise<{ totalFixed: number; dailyFixedCost: number }> {
  const [fromTaxIns, fromTable] = await Promise.all([
    getProratedFixedCostFromTaxAndInsurance(options),
    getProratedFixedCostFromVehicleFixedCosts(options),
  ]);
  const totalFixed =
    (fromTaxIns.totalFixedFromTaxInsurance || 0) + (fromTable || 0);
  const startStr = options.startDate.split('T')[0];
  const endStr = options.endDate.split('T')[0];
  const days = daysInRange(startStr, endStr);
  const dailyFixedCost = days > 0 ? totalFixed / days : 0;
  return { totalFixed: Math.max(0, totalFixed), dailyFixedCost };
}

/** Phase 2: สรุปต้นทุนผันแปร (น้ำมัน, ค่าคอม, ค่าซ่อมจาก tickets, vehicle_variable_costs) */
export interface VehicleVariableCostBreakdown {
  fuel_cost: number;
  commission_cost: number;
  maintenance_cost: number;
  other_variable: number;
  total_variable: number;
}

export async function getVariableCostSummary(
  options: GetProratedFixedCostOptions
): Promise<VehicleVariableCostBreakdown> {
  const { vehicleId, startDate, endDate } = options;
  const startStr = startDate.split('T')[0];
  const endStr = endDate.split('T')[0];
  const startDateTime = startDate.includes('T') ? startDate : `${startStr}T00:00:00.000Z`;
  const endDateTime = endDate.includes('T') ? endDate : `${endStr}T23:59:59.999Z`;

  const [fuelRes, tripsRes, ticketCostsRes, variableRes] = await Promise.all([
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
      .gte('planned_date', startStr)
      .lte('planned_date', endStr),
    (async () => {
      const [byCreated, byRepair] = await Promise.all([
        supabase
          .from('tickets')
          .select('id')
          .eq('vehicle_id', vehicleId)
          .gte('created_at', startDateTime)
          .lte('created_at', endDateTime),
        supabase
          .from('tickets')
          .select('id')
          .eq('vehicle_id', vehicleId)
          .not('repair_start_date', 'is', null)
          .gte('repair_start_date', startStr)
          .lte('repair_start_date', endStr),
      ]);
      const ids = new Set<number>([
        ...(byCreated.data ?? []).map((r) => r.id),
        ...(byRepair.data ?? []).map((r) => r.id),
      ]);
      return { data: Array.from(ids).map((id) => ({ id })) };
    })(),
    supabase
      .from('vehicle_variable_costs')
      .select('amount')
      .eq('vehicle_id', vehicleId)
      .gte('cost_date', startStr)
      .lte('cost_date', endStr),
  ]);

  let fuel_cost = 0;
  if (fuelRes.data?.length) {
    fuel_cost = fuelRes.data.reduce((sum, r) => {
      const c = r.total_cost ?? (r.liters ?? 0) * (r.price_per_liter ?? 0);
      return sum + (Number(c) || 0);
    }, 0);
  }

  const tripIds = (tripsRes.data ?? []).map((t) => t.id);
  let commission_cost = 0;
  if (tripIds.length > 0) {
    const { data: logs } = await supabase
      .from('commission_logs')
      .select('actual_commission')
      .in('delivery_trip_id', tripIds);
    if (logs) {
      commission_cost = logs.reduce(
        (sum, r) => sum + (Number(r.actual_commission) || 0),
        0
      );
    }
  }

  let maintenance_cost = 0;
  const ticketIds = (ticketCostsRes.data ?? []).map((t) => t.id);
  if (ticketIds.length > 0) {
    const { data: costs } = await supabase
      .from('ticket_costs')
      .select('cost')
      .in('ticket_id', ticketIds);
    if (costs) {
      maintenance_cost = costs.reduce(
        (sum, r) => sum + (Number(r.cost) || 0),
        0
      );
    }
  }

  let other_variable = 0;
  if (variableRes.data?.length) {
    other_variable = variableRes.data.reduce(
      (sum, r) => sum + (Number(r.amount) || 0),
      0
    );
  }

  const total_variable =
    fuel_cost + commission_cost + maintenance_cost + other_variable;

  return {
    fuel_cost,
    commission_cost,
    maintenance_cost,
    other_variable,
    total_variable,
  };
}

/**
 * Phase 2: สรุปต้นทุนครบ (คงที่ + ผันแปร + Daily Rate + แยกย่อย) สำหรับ UI / รายงาน
 */
export interface VehicleCostSummaryPhase2 {
  total_fixed: number;
  total_variable: number;
  daily_fixed_cost: number;
  fuel_cost: number;
  commission_cost: number;
  maintenance_cost: number;
  other_variable: number;
}

export async function getVehicleCostSummaryPhase2(
  options: GetProratedFixedCostOptions
): Promise<VehicleCostSummaryPhase2> {
  const [fixedResult, variableResult] = await Promise.all([
    getTotalProratedFixedCostAndDailyRate(options),
    getVariableCostSummary(options),
  ]);

  return {
    total_fixed: fixedResult.totalFixed,
    total_variable: variableResult.total_variable,
    daily_fixed_cost: fixedResult.dailyFixedCost,
    fuel_cost: variableResult.fuel_cost,
    commission_cost: variableResult.commission_cost,
    maintenance_cost: variableResult.maintenance_cost,
    other_variable: variableResult.other_variable,
  };
}

// ─── CRUD: vehicle_fixed_costs ─────────────────────────────────────────────────
export async function listFixedCosts(vehicleId: string): Promise<VehicleFixedCostRow[]> {
  const { data, error } = await supabase
    .from('vehicle_fixed_costs')
    .select('*')
    .eq('vehicle_id', vehicleId)
    .order('period_start', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createFixedCost(
  payload: Omit<VehicleFixedCostInsert, 'id' | 'created_at' | 'updated_at' | 'created_by'>
): Promise<VehicleFixedCostRow> {
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from('vehicle_fixed_costs')
    .insert({
      ...payload,
      created_by: user?.id ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateFixedCost(id: string, payload: VehicleFixedCostUpdate): Promise<VehicleFixedCostRow> {
  const { data, error } = await supabase
    .from('vehicle_fixed_costs')
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteFixedCost(id: string): Promise<void> {
  const { error } = await supabase.from('vehicle_fixed_costs').delete().eq('id', id);
  if (error) throw error;
}

// ─── CRUD: vehicle_variable_costs ────────────────────────────────────────────
export async function listVariableCosts(vehicleId: string): Promise<VehicleVariableCostRow[]> {
  const { data, error } = await supabase
    .from('vehicle_variable_costs')
    .select('*')
    .eq('vehicle_id', vehicleId)
    .order('cost_date', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createVariableCost(
  payload: Omit<VehicleVariableCostInsert, 'id' | 'created_by'>
): Promise<VehicleVariableCostRow> {
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from('vehicle_variable_costs')
    .insert({
      ...payload,
      created_by: user?.id ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateVariableCost(id: string, payload: VehicleVariableCostUpdate): Promise<VehicleVariableCostRow> {
  const { data, error } = await supabase
    .from('vehicle_variable_costs')
    .update(payload)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteVariableCost(id: string): Promise<void> {
  const { error } = await supabase.from('vehicle_variable_costs').delete().eq('id', id);
  if (error) throw error;
}

export const vehicleCostService = {
  getProratedFixedCostFromTaxAndInsurance,
  getTotalProratedFixedCostAndDailyRate,
  getVariableCostSummary,
  getVehicleCostSummaryPhase2,
  daysInRange,
  listFixedCosts,
  createFixedCost,
  updateFixedCost,
  deleteFixedCost,
  listVariableCosts,
  createVariableCost,
  updateVariableCost,
  deleteVariableCost,
};
