/**
 * Pure helpers for trip contribution estimate (Layer 1 + 2, no office).
 * Used by tripContributionEstimateService and unit tests.
 */

/** รายการวันที่ YYYY-MM-DD ระหว่าง start ถึง end (รวมทั้งสองปลาย) */
export function getDatesInRange(start: string, end: string): string[] {
  const out: string[] = [];
  const [sy, sm, sd] = start.slice(0, 10).split('-').map(Number);
  const [ey, em, ed] = end.slice(0, 10).split('-').map(Number);
  const d = new Date(sy!, sm! - 1, sd!);
  const endD = new Date(ey!, em! - 1, ed!);
  while (d <= endD) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    out.push(`${y}-${m}-${day}`);
    d.setDate(d.getDate() + 1);
  }
  return out;
}

export function daysInRangeInclusive(start: string, end: string): number {
  const s = new Date(start.split('T')[0]);
  const e = new Date(end.split('T')[0]);
  const diff = Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(0, diff + 1);
}

export interface TripRange {
  start: string;
  end: string;
  days: number;
}

/**
 * ช่วงวันเที่ยวจากฟอร์ม: trip_start_date + trip_end_date หรือ fallback planned_date วันเดียว
 */
export function deriveTripDateRangeFromForm(
  plannedDate: string,
  tripStartDate?: string | null,
  tripEndDate?: string | null
): TripRange {
  const p = plannedDate.split('T')[0] || '';
  const startStr = tripStartDate?.split('T')[0];
  const endStr = tripEndDate?.split('T')[0];
  if (startStr && endStr) {
    const days = daysInRangeInclusive(startStr, endStr);
    return { start: startStr, end: endStr, days: Math.max(1, days) };
  }
  return { start: p, end: p, days: 1 };
}

/** ช่วงวันจากแถวทริปใน DB — ใช้ trip_start/end หรือ planned_date */
export function getTripRangeFromTripRow(trip: {
  trip_start_date: string | null;
  trip_end_date: string | null;
  planned_date: string;
}): TripRange {
  const startStr = trip.trip_start_date?.split('T')[0];
  const endStr = trip.trip_end_date?.split('T')[0];
  if (startStr && endStr) {
    const days = daysInRangeInclusive(startStr, endStr);
    return { start: startStr, end: endStr, days: Math.max(1, days) };
  }
  const p = trip.planned_date.split('T')[0] || '';
  return { start: p, end: p, days: 1 };
}

export interface ContributionTotalsInput {
  revenue: number;
  fixedCost: number;
  fuelCost: number;
  personnelCost: number;
}

export interface ContributionTotalsResult {
  estimatedContribution: number;
  totalCost: number;
}

/**
 * กำไรขั้นต้นโดยประมาณ = รายได้ − ต้นทุนคงที่ − น้ำมัน − บุคลากร (ไม่รวมค่าคอมในเฟสนี้)
 */
export function computeContributionTotals(input: ContributionTotalsInput): ContributionTotalsResult {
  const { revenue, fixedCost, fuelCost, personnelCost } = input;
  const totalCost = fixedCost + fuelCost + personnelCost;
  return {
    estimatedContribution: revenue - totalCost,
    totalCost,
  };
}

type SalaryRow = {
  staff_id: string;
  effective_from: string;
  effective_to: string | null;
  monthly_salary: number;
};

function toDateOnly(s: string | null): string {
  if (!s) return '';
  return s.slice(0, 10);
}

export function getEffectiveSalaryAt(staffId: string, dateStr: string, rows: SalaryRow[]): number {
  const dateNorm = toDateOnly(dateStr);
  if (!dateNorm) return 0;
  const candidates = rows.filter(
    (r) =>
      r.staff_id === staffId &&
      toDateOnly(r.effective_from) <= dateNorm &&
      (r.effective_to == null || toDateOnly(r.effective_to) >= dateNorm)
  );
  if (candidates.length === 0) return 0;
  candidates.sort((a, b) => (toDateOnly(b.effective_from) > toDateOnly(a.effective_from) ? 1 : -1));
  return Number(candidates[0].monthly_salary) || 0;
}

/**
 * คำนวณต้นทุนบุคลากรสำหรับทริปหนึ่ง โดย divisor = จำนวนเที่ยวของพนักงานในวันนั้น (จาก DB) + 1 สำหรับทริปที่กำลังประมาณการ
 */
export function computePersonnelCostForTrip(
  crewStaffIds: string[],
  tripDates: string[],
  personnelDayTripCountOthers: Map<string, number>,
  salaryRows: SalaryRow[]
): number {
  let personnelCost = 0;
  for (const staffId of crewStaffIds) {
    for (const date of tripDates) {
      const monthly = getEffectiveSalaryAt(staffId, date, salaryRows);
      const dailyRate = monthly / 30;
      const key = `${staffId}:${date}`;
      const others = personnelDayTripCountOthers.get(key) ?? 0;
      const nTripsSameDay = others + 1;
      personnelCost += dailyRate / nTripsSameDay;
    }
  }
  return personnelCost;
}
