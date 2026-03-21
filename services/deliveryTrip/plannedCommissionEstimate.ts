/**
 * ประมาณการค่าคอมก่อนปิดทริป — ใช้สูตรเดียวกับ crewService.calculateCommission ส่วนยอดรวม:
 * totalCommission = จำนวนชิ้น × rate_per_unit (จาก commission_rates)
 * การปันต่อคนตามเวลางานทำหลังปิดทริปจริง อาจทำให้ยอดต่อคนไม่เท่ากัน แต่ยอดรวมทริปเท่ากันหากจำนวนชิ้นตรง
 */
import { supabase } from '../../lib/supabase';
import type { Database } from '../../types/database';

type CommissionRate = Database['public']['Tables']['commission_rates']['Row'];

export interface PlannedCommissionResult {
  commissionTotal: number;
  ratePerUnit: number | null;
  vehicleType: string | null;
  itemQuantity: number;
  warning: string | null;
}

/**
 * @param totalItemQuantity จำนวนชิ้นสินค้าที่วางแผนส่งในทริป (รวมทุกบรรทัด)
 */
export async function getPlannedCommissionForItems(
  vehicleId: string,
  totalItemQuantity: number
): Promise<PlannedCommissionResult> {
  if (totalItemQuantity <= 0) {
    return {
      commissionTotal: 0,
      ratePerUnit: null,
      vehicleType: null,
      itemQuantity: 0,
      warning: null,
    };
  }

  const { data: veh, error: vehErr } = await supabase
    .from('vehicles')
    .select('type')
    .eq('id', vehicleId)
    .maybeSingle();

  if (vehErr || !veh) {
    return {
      commissionTotal: 0,
      ratePerUnit: null,
      vehicleType: null,
      itemQuantity: totalItemQuantity,
      warning: 'ไม่พบข้อมูลรถ — คำนวณค่าคอมไม่ได้',
    };
  }

  const vehicleType = (veh as { type: string | null }).type || 'unknown';
  const today = new Date().toISOString().split('T')[0];

  const { data: rates, error: ratesError } = await supabase
    .from('commission_rates')
    .select('*')
    .eq('is_active', true)
    .lte('effective_from', today)
    .or(`effective_until.is.null,effective_until.gte.${today}`)
    .order('vehicle_type', { ascending: false, nullsFirst: false })
    .order('service_type', { ascending: false, nullsFirst: false });

  if (ratesError) {
    return {
      commissionTotal: 0,
      ratePerUnit: null,
      vehicleType,
      itemQuantity: totalItemQuantity,
      warning: `โหลดอัตราค่าคอมไม่ได้: ${ratesError.message}`,
    };
  }

  const serviceType = 'standard';
  let selectedRate: CommissionRate | null = null;
  const list = (rates ?? []) as CommissionRate[];

  if (list.length > 0) {
    selectedRate =
      list.find((r) => r.vehicle_type === vehicleType && r.service_type === serviceType) ?? null;
    if (!selectedRate) {
      selectedRate = list.find((r) => r.vehicle_type === vehicleType && !r.service_type) ?? null;
    }
    if (!selectedRate) {
      selectedRate = list.find((r) => !r.vehicle_type && r.service_type === serviceType) ?? null;
    }
    if (!selectedRate) {
      selectedRate = list.find((r) => !r.vehicle_type && !r.service_type) ?? null;
    }
  }

  if (!selectedRate) {
    return {
      commissionTotal: 0,
      ratePerUnit: null,
      vehicleType,
      itemQuantity: totalItemQuantity,
      warning: `ไม่พบอัตราค่าคอมสำหรับประเภทรถ "${vehicleType}" — ตั้งค่าในเมนูอัตราค่าคอม`,
    };
  }

  const ratePerUnit = Number(selectedRate.rate_per_unit);
  const commissionTotal = Math.round(totalItemQuantity * ratePerUnit * 100) / 100;

  return {
    commissionTotal,
    ratePerUnit,
    vehicleType,
    itemQuantity: totalItemQuantity,
    warning: null,
  };
}
