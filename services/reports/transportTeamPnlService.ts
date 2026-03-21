/**
 * ผลประกอบการทีมขนส่งหน้างาน — รายได้จากทริป (ตาม planned_date) เทียบค่าจ้างทีมพนักงานหน้างาน
 * (service_staff active ที่เชื่อม profiles.role = driver | service_staff เท่านั้น)
 * ไม่รวมหลังบ้าน / ค่าใช้จ่ายอื่นขององค์กร
 */
import { supabase } from '../../lib/supabase';
import { getDatesInRange, getEffectiveSalaryAt } from '../../utils/tripContributionEstimate';

export interface TransportTeamPnlOptions {
  startDate: string;
  endDate: string;
  /** กรองทริปและพนักงานตามสาขา (HQ/SD) — ว่าง = ทุกสาขา */
  branch?: string | null;
  /** ถ้า true คืนรายวันสำหรับกราฟ (ช่วงยาวอาจใหญ่) */
  includeDailyBreakdown?: boolean;
}

export interface TransportTeamPnlDailyRow {
  date: string;
  trip_revenue: number;
  payroll_cost: number;
  net: number;
}

export interface TransportTeamPnlSummary {
  start_date: string;
  end_date: string;
  branch: string | null;
  /** จำนวนวันในช่วง (รวมปลาย) */
  calendar_days: number;
  /** รายได้รวมจาก trip_revenue ของทริปที่ planned_date อยู่ในช่วง (ยกเว้น cancelled) */
  trip_revenue_total: number;
  /** ค่าจ้างรวม: สำหรับแต่ละวันในช่วง รวม (เงินเดือนที่มีผล / 30) ต่อคนต่อวัน — เฉพาะคนขับ/พนักงานบริการที่ active และเชื่อมบัญชี */
  field_team_payroll_total: number;
  net: number;
  trip_count: number;
  field_staff_count: number;
  daily?: TransportTeamPnlDailyRow[];
  notes: string[];
}

type SalaryRow = {
  staff_id: string;
  effective_from: string;
  effective_to: string | null;
  monthly_salary: number;
};

/** บทบาทหน้างานที่นับในค่าจ้างทีมขนส่ง — คนขับ / พนักงานบริการ */
const FRONTLINE_PAYROLL_ROLES = ['driver', 'service_staff'] as const;

export async function getTransportTeamPnlSummary(
  options: TransportTeamPnlOptions
): Promise<TransportTeamPnlSummary> {
  const startStr = options.startDate.split('T')[0];
  const endStr = options.endDate.split('T')[0];
  const branch = options.branch?.trim() || null;
  const notes: string[] = [];

  const dates: string[] = getDatesInRange(startStr, endStr);
  const calendarDays = dates.length;

  let tripQuery = supabase
    .from('delivery_trips')
    .select('id, planned_date, trip_revenue, status')
    .gte('planned_date', startStr)
    .lte('planned_date', endStr)
    .neq('status', 'cancelled');

  if (branch) {
    tripQuery = tripQuery.eq('branch', branch);
  }

  const { data: tripsData, error: tripErr } = await tripQuery;
  if (tripErr) throw tripErr;
  const trips = (tripsData ?? []) as {
    id: string;
    planned_date: string;
    trip_revenue: number | null;
    status: string;
  }[];

  let tripRevenueTotal = 0;
  const revenueByDate = new Map<string, number>();
  for (const t of trips) {
    const d = (t.planned_date ?? '').split('T')[0];
    const rev = Number(t.trip_revenue) || 0;
    tripRevenueTotal += rev;
    revenueByDate.set(d, (revenueByDate.get(d) ?? 0) + rev);
  }

  let staffQuery = supabase.from('service_staff').select('id, user_id').eq('status', 'active');
  if (branch) {
    staffQuery = staffQuery.eq('branch', branch);
  }

  const { data: staffRows, error: staffErr } = await staffQuery;
  if (staffErr) throw staffErr;

  const staffList = (staffRows ?? []) as { id: string; user_id: string | null }[];
  const distinctUserIds = Array.from(
    new Set(
      staffList
        .map((r) => r.user_id)
        .filter((uid): uid is string => typeof uid === 'string' && uid.length > 0)
    )
  );

  let allowedUserIds = new Set<string>();
  if (distinctUserIds.length > 0) {
    const { data: profileRows, error: profileErr } = await supabase
      .from('profiles')
      .select('id')
      .in('id', distinctUserIds)
      .in('role', [...FRONTLINE_PAYROLL_ROLES]);
    if (profileErr) throw profileErr;
    for (const p of profileRows ?? []) {
      const id = (p as { id: string }).id;
      if (id) allowedUserIds.add(id);
    }
  }

  const rawIds: string[] = staffList
    .filter((r) => r.user_id && allowedUserIds.has(r.user_id))
    .map((r) => String(r.id))
    .filter((id) => id.length > 0);
  const staffIds = Array.from(new Set(rawIds));
  const fieldStaffCount = staffIds.length;

  if (fieldStaffCount === 0) {
    notes.push(
      'ไม่พบพนักงานหน้างาน (profiles.role = คนขับหรือพนักงานบริการ) ที่ active และอยู่ในขอบเขตสาขา — ค่าจ้างจะเป็น 0'
    );
  }

  let salaryRows: SalaryRow[] = [];
  if (staffIds.length > 0) {
    const { data: salData, error: salErr } = await supabase
      .from('staff_salaries')
      .select('staff_id, effective_from, effective_to, monthly_salary')
      .in('staff_id', staffIds);
    if (salErr) throw salErr;
    salaryRows = (salData ?? []) as SalaryRow[];
  }

  let fieldTeamPayrollTotal = 0;
  const payrollByDate = new Map<string, number>();

  for (const date of dates) {
    let dayPay = 0;
    for (const staffId of staffIds) {
      const monthly = getEffectiveSalaryAt(staffId, date, salaryRows);
      const daily = monthly / 30;
      dayPay += daily;
    }
    fieldTeamPayrollTotal += dayPay;
    payrollByDate.set(date, dayPay);
  }

  if (staffIds.length > 0 && salaryRows.length === 0) {
    notes.push('ไม่พบข้อมูล staff_salaries สำหรับพนักงานในขอบเขต — ค่าจ้างจะเป็น 0');
  }

  const net = tripRevenueTotal - fieldTeamPayrollTotal;

  notes.push(
    'รายได้ = ผลรวม trip_revenue ของทริปที่ planned_date อยู่ในช่วง (ไม่รวมทริปยกเลิก)'
  );
  notes.push(
    'ค่าจ้าง = พนักงาน service_staff สถานะ active ในสาขาที่เลือก (หรือทุกสาขา) เฉพาะที่เชื่อมบัญชีและ role เป็น คนขับ หรือ พนักงานบริการ × เงินเดือนที่มีผลต่อวัน (÷30) ทุกวันในช่วง — รวมวันที่ไม่มีทริป'
  );

  let daily: TransportTeamPnlDailyRow[] | undefined;
  if (options.includeDailyBreakdown) {
    daily = dates.map((date) => {
      const tr = revenueByDate.get(date) ?? 0;
      const pr = payrollByDate.get(date) ?? 0;
      return { date, trip_revenue: tr, payroll_cost: pr, net: tr - pr };
    });
  }

  return {
    start_date: startStr,
    end_date: endStr,
    branch,
    calendar_days: calendarDays,
    trip_revenue_total: Math.round(tripRevenueTotal * 100) / 100,
    field_team_payroll_total: Math.round(fieldTeamPayrollTotal * 100) / 100,
    net: Math.round(net * 100) / 100,
    trip_count: trips.length,
    field_staff_count: fieldStaffCount,
    daily,
    notes,
  };
}
