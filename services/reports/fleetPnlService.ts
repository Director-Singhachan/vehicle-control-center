/**
 * Fleet P&L Report Service (Phase 6)
 * รวมรายได้/ต้นทุน/กำไรสุทธิของรถทุกคัน — Dashboard มหภาค
 */
import { supabase } from '../../lib/supabase';
import { getVehiclePnlSummary, type VehiclePnlSummary } from './vehiclePnlService';

export interface FleetPnlOptions {
  startDate: string; // YYYY-MM-DD
  endDate: string;
  /** ถ้าไม่ส่ง จะดึงรถทุกคันจาก vehicles */
  vehicleIds?: string[] | null;
}

export interface FleetPnlResult {
  start_date: string;
  end_date: string;
  total_revenue: number;
  total_cost: number;
  net_profit: number;
  vehicle_count: number;
  /** รายการ P&L ต่อคัน (เรียงกำไรสุทธิมากไปน้อย) */
  rows: (VehiclePnlSummary & { plate?: string | null })[];
}

/**
 * ดึงสรุป P&L ทั้งกองรถ ในช่วงวันที่
 */
export async function getFleetPnlSummary(
  options: FleetPnlOptions
): Promise<FleetPnlResult> {
  const { startDate, endDate, vehicleIds: inputVehicleIds } = options;
  const startStr = startDate.split('T')[0];
  const endStr = endDate.split('T')[0];

  let vehicleIds: string[] = inputVehicleIds ?? [];
  if (vehicleIds.length === 0) {
    const { data: vehicles } = await supabase
      .from('vehicles')
      .select('id')
      .order('plate', { ascending: true });
    vehicleIds = (vehicles ?? []).map((r) => (r as { id: string }).id);
  }

  if (vehicleIds.length === 0) {
    return {
      start_date: startStr,
      end_date: endStr,
      total_revenue: 0,
      total_cost: 0,
      net_profit: 0,
      vehicle_count: 0,
      rows: [],
    };
  }

  const summaries = await Promise.all(
    vehicleIds.map((vehicleId) =>
      getVehiclePnlSummary({ vehicleId, startDate: startStr, endDate: endStr })
    )
  );

  const valid = summaries.filter(
    (s): s is VehiclePnlSummary => s != null
  ) as VehiclePnlSummary[];

  const { data: plates } = await supabase
    .from('vehicles')
    .select('id, plate')
    .in('id', valid.map((v) => v.vehicle_id));

  const plateMap = new Map<string, string | null>();
  for (const p of plates ?? []) {
    const row = p as { id: string; plate: string | null };
    plateMap.set(row.id, row.plate ?? null);
  }

  const rows: (VehiclePnlSummary & { plate?: string | null })[] = valid
    .map((s) => ({
      ...s,
      plate: plateMap.get(s.vehicle_id) ?? null,
    }))
    .sort((a, b) => b.net_profit - a.net_profit);

  const total_revenue = rows.reduce((s, r) => s + r.revenue, 0);
  const total_cost = rows.reduce((s, r) => s + r.total_cost, 0);
  const net_profit = total_revenue - total_cost;

  return {
    start_date: startStr,
    end_date: endStr,
    total_revenue,
    total_cost,
    net_profit,
    vehicle_count: rows.length,
    rows,
  };
}
