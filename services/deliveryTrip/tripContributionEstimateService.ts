/**
 * ประมาณการกำไรขั้นต้นรายเที่ยว (Layer 1 + 2) สำหรับฟอร์มจัดทริป — ไม่รวมออฟฟิศ
 * ตัวหารจำนวนเที่ยวต่อสาขา (delivery_trips.branch)
 */
import { supabase } from '../../lib/supabase';
import { getTotalProratedFixedCostAndDailyRate } from '../vehicleCostService';
import {
  deriveTripDateRangeFromForm,
  getTripRangeFromTripRow,
  getDatesInRange,
  computeContributionTotals,
  computePersonnelCostForTrip,
} from '../../utils/tripContributionEstimate';
import { getPlannedCommissionForItems } from './plannedCommissionEstimate';

export interface TripContributionEstimateInput {
  vehicleId: string;
  branch: string | null;
  plannedDate: string;
  tripStartDate?: string | null;
  tripEndDate?: string | null;
  crewStaffIds: string[];
  revenue: number | null;
  estimatedFuelBaht: number;
  /** จำนวนชิ้นสินค้าในทริป (รวม) — ใช้ประมาณค่าคอม ชิ้น × rate จาก commission_rates */
  totalItemQuantity?: number;
  excludeTripId?: string | null;
}

export interface TripContributionEstimateResult {
  estimatedContribution: number;
  revenue: number;
  fixedCost: number;
  fuelCost: number;
  /** ค่าคอมโดยประมาณ (จำนวนชิ้น × อัตราต่อหน่วย) */
  commissionCost: number;
  /** อัตราค่าคอมต่อชิ้นที่ใช้ (บาท/ชิ้น) ถ้ามี */
  commissionRatePerUnit: number | null;
  personnelCost: number;
  /** คำอธิบาย / หมายเหตุค่าคอมและต้นทุนผันแปร */
  commissionNote: string;
  tripDays: number;
  dailyFixedCost: number;
  totalCost: number;
  warnings: string[];
}

type TripRow = {
  id: string;
  planned_date: string;
  trip_start_date: string | null;
  trip_end_date: string | null;
};

function applyBranchFilter<T extends { eq: (c: string, v: string) => T; is: (c: string, v: null) => T }>(
  query: T,
  branch: string | null
): T {
  if (branch === null || branch === '') {
    return query.is('branch', null);
  }
  return query.eq('branch', branch);
}

/**
 * สร้าง map จำนวนเที่ยวของ (staffId:date) จากทริปอื่นในสาขาเดียวกัน (ไม่รวม excludeTripId)
 */
function buildPersonnelDayTripCountOthers(
  trips: TripRow[],
  crewsByTrip: Map<string, string[]>,
  excludeTripId?: string | null
): Map<string, number> {
  const map = new Map<string, number>();
  for (const t of trips) {
    if (excludeTripId && t.id === excludeTripId) continue;
    const range = getTripRangeFromTripRow(t);
    const crewIds = crewsByTrip.get(t.id) ?? [];
    const dates = getDatesInRange(range.start, range.end);
    for (const staffId of crewIds) {
      for (const date of dates) {
        const key = `${staffId}:${date}`;
        map.set(key, (map.get(key) ?? 0) + 1);
      }
    }
  }
  return map;
}

export async function getTripContributionEstimate(
  input: TripContributionEstimateInput
): Promise<TripContributionEstimateResult> {
  const warnings: string[] = [];
  const {
    vehicleId,
    branch,
    plannedDate,
    tripStartDate,
    tripEndDate,
    crewStaffIds,
    revenue: revenueInput,
    estimatedFuelBaht,
    totalItemQuantity: totalItemQtyInput,
    excludeTripId,
  } = input;

  const totalItemQuantity = Math.max(0, Number(totalItemQtyInput) || 0);

  const revenue = revenueInput != null && !Number.isNaN(revenueInput) ? Number(revenueInput) : 0;
  if (revenueInput == null || Number.isNaN(Number(revenueInput))) {
    warnings.push('ยังไม่ระบุรายได้เที่ยว — ตัวเลขกำไรจะเป็น 0 จนกว่าจะกรอก');
  }

  if (!vehicleId) {
    warnings.push('ยังไม่เลือกรถ — ไม่สามารถคำนวณต้นทุนคงที่ได้');
    const { estimatedContribution, totalCost } = computeContributionTotals({
      revenue,
      fixedCost: 0,
      fuelCost: Math.max(0, estimatedFuelBaht),
      personnelCost: 0,
      commissionCost: 0,
    });
    return {
      estimatedContribution,
      revenue,
      fixedCost: 0,
      fuelCost: Math.max(0, estimatedFuelBaht),
      commissionCost: 0,
      commissionRatePerUnit: null,
      personnelCost: 0,
      commissionNote:
        'เลือกรถเพื่อประมาณค่าคอมจากจำนวนชิ้น — หลังปิดทริประบบจะปันค่าคอมต่อคนตามเวลางานจริง',
      tripDays: 1,
      dailyFixedCost: 0,
      totalCost,
      warnings,
    };
  }

  const tripRange = deriveTripDateRangeFromForm(plannedDate, tripStartDate, tripEndDate);
  const tripDates = getDatesInRange(tripRange.start, tripRange.end);
  const tripDays = tripRange.days;

  const rangeStart = tripRange.start;
  const rangeEnd = tripRange.end;

  let query = supabase
    .from('delivery_trips')
    .select('id, planned_date, trip_start_date, trip_end_date')
    .gte('planned_date', rangeStart)
    .lte('planned_date', rangeEnd);
  query = applyBranchFilter(query, branch);

  const { data: tripsData, error: tripsError } = await query;
  if (tripsError) throw tripsError;
  const trips = (tripsData ?? []) as TripRow[];

  const tripIds = trips.map((t) => t.id);
  const crewsByTrip = new Map<string, string[]>();

  if (tripIds.length > 0) {
    const { data: crewsData, error: crewsError } = await supabase
      .from('delivery_trip_crews')
      .select('delivery_trip_id, staff_id, status')
      .in('delivery_trip_id', tripIds);
    if (crewsError) throw crewsError;
    for (const row of crewsData ?? []) {
      const r = row as { delivery_trip_id: string; staff_id: string; status?: string };
      if (r.status !== 'active') continue;
      const list = crewsByTrip.get(r.delivery_trip_id) ?? [];
      if (!list.includes(r.staff_id)) list.push(r.staff_id);
      crewsByTrip.set(r.delivery_trip_id, list);
    }
  }

  const personnelDayTripCountOthers = buildPersonnelDayTripCountOthers(trips, crewsByTrip, excludeTripId);

  const uniqueCrewIds = [...new Set(crewStaffIds.filter(Boolean))];
  type SalaryRow = {
    staff_id: string;
    effective_from: string;
    effective_to: string | null;
    monthly_salary: number;
  };
  let salaryRows: SalaryRow[] = [];
  if (uniqueCrewIds.length > 0) {
    const { data: salData, error: salError } = await supabase
      .from('staff_salaries')
      .select('staff_id, effective_from, effective_to, monthly_salary')
      .in('staff_id', uniqueCrewIds);
    if (salError) throw salError;
    salaryRows = (salData ?? []) as SalaryRow[];
  }

  const personnelCost = computePersonnelCostForTrip(
    uniqueCrewIds,
    tripDates,
    personnelDayTripCountOthers,
    salaryRows
  );

  if (uniqueCrewIds.length === 0) {
    warnings.push('ยังไม่ระบุคนขับ/ลูกเรือ — ต้นทุนบุคลากรจะเป็น 0');
  }

  const dayForFixedRate = tripRange.start;
  const { dailyFixedCost } = await getTotalProratedFixedCostAndDailyRate({
    vehicleId,
    startDate: dayForFixedRate,
    endDate: dayForFixedRate,
  });

  const fixedCost = dailyFixedCost * tripDays;
  const fuelCost = Math.max(0, Number(estimatedFuelBaht) || 0);

  const plannedComm = await getPlannedCommissionForItems(vehicleId, totalItemQuantity);
  const commissionCost = plannedComm.commissionTotal;
  if (plannedComm.warning) {
    warnings.push(plannedComm.warning);
  }
  if (totalItemQuantity <= 0) {
    warnings.push('ยังไม่มีจำนวนชิ้นสินค้าในทริป — ค่าคอมประมาณจะเป็น 0');
  }

  const commissionNote =
    totalItemQuantity > 0 && plannedComm.ratePerUnit != null
      ? `ค่าคอมประมาณ = ${totalItemQuantity.toLocaleString('th-TH')} ชิ้น × ${plannedComm.ratePerUnit.toLocaleString('th-TH')} บาท/ชิ้น — ยอดรวมทริปเทียบกับหลังปิดทริป ส่วนการปันต่อพนักงานตามเวลางานอาจต่างจากยอดต่อคน`
      : 'ค่าคอมประมาณจากจำนวนชิ้น × อัตราในระบบ — หลังปิดทริปจะบันทึกตาม commission_logs';

  const { estimatedContribution, totalCost } = computeContributionTotals({
    revenue,
    fixedCost,
    fuelCost,
    personnelCost,
    commissionCost,
  });

  return {
    estimatedContribution,
    revenue,
    fixedCost,
    fuelCost,
    commissionCost,
    commissionRatePerUnit: plannedComm.ratePerUnit,
    personnelCost,
    commissionNote,
    tripDays,
    dailyFixedCost,
    totalCost,
    warnings,
  };
}
