import { supabase } from '../lib/supabase';
import type { Database } from '../types/database';

type StaffSalaryRow = Database['public']['Tables']['staff_salaries']['Row'];
type StaffSalaryInsert = Database['public']['Tables']['staff_salaries']['Insert'];
type StaffSalaryUpdate = Database['public']['Tables']['staff_salaries']['Update'];

/** วันที่เป็นสตริง YYYY-MM-DD */
function toDateString(d: Date | string): string {
  if (typeof d === 'string') return d.slice(0, 10);
  return d.toISOString().slice(0, 10);
}

export const staffSalaryService = {
  /** รายการเงินเดือนของพนักงานคนหนึ่ง (เรียง effective_from ล่าสุดก่อน) */
  listByStaff: async (staffId: string): Promise<StaffSalaryRow[]> => {
    const { data, error } = await supabase
      .from('staff_salaries')
      .select('*')
      .eq('staff_id', staffId)
      .order('effective_from', { ascending: false });

    if (error) {
      console.error('[staffSalaryService] listByStaff:', error);
      throw error;
    }
    return data || [];
  },

  /**
   * เงินเดือนที่มีผล ณ วันที่ asOfDate (ใช้แถวที่ effective_from <= asOfDate และ effective_to >= asOfDate หรือ null)
   * คืน null ถ้าไม่มีข้อมูล
   */
  getEffectiveSalary: async (
    staffId: string,
    asOfDate: Date | string
  ): Promise<number | null> => {
    const dateStr = toDateString(asOfDate);
    const { data, error } = await supabase
      .from('staff_salaries')
      .select('monthly_salary, effective_from')
      .eq('staff_id', staffId)
      .lte('effective_from', dateStr)
      .or(`effective_to.is.null,effective_to.gte.${dateStr}`)
      .order('effective_from', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('[staffSalaryService] getEffectiveSalary:', error);
      throw error;
    }
    return data?.monthly_salary ?? null;
  },

  /**
   * เงินเดือนรายเดือนที่มีผล ณ วันที่ asOfDate สำหรับหลาย staff_id
   * คืน Map<staff_id, monthly_salary> — ถ้าไม่มีข้อมูลจะไม่มี key
   */
  getSalariesForStaffIds: async (
    staffIds: string[],
    asOfDate: Date | string
  ): Promise<Map<string, number>> => {
    if (staffIds.length === 0) return new Map();

    const dateStr = toDateString(asOfDate);
    const { data, error } = await supabase
      .from('staff_salaries')
      .select('staff_id, monthly_salary, effective_from')
      .in('staff_id', staffIds)
      .lte('effective_from', dateStr)
      .or(`effective_to.is.null,effective_to.gte.${dateStr}`)
      .order('effective_from', { ascending: false });

    if (error) {
      console.error('[staffSalaryService] getSalariesForStaffIds:', error);
      throw error;
    }

    const rows = (data || []) as { staff_id: string; monthly_salary: number; effective_from: string }[];
    const map = new Map<string, number>();
    const seen = new Set<string>();
    for (const row of rows) {
      if (seen.has(row.staff_id)) continue;
      seen.add(row.staff_id);
      map.set(row.staff_id, row.monthly_salary);
    }
    return map;
  },

  create: async (payload: StaffSalaryInsert): Promise<StaffSalaryRow> => {
    const { data, error } = await supabase
      .from('staff_salaries')
      .insert(payload)
      .select()
      .single();

    if (error) {
      console.error('[staffSalaryService] create:', error);
      throw error;
    }
    return data as StaffSalaryRow;
  },

  update: async (id: string, payload: StaffSalaryUpdate): Promise<StaffSalaryRow> => {
    const { data, error } = await supabase
      .from('staff_salaries')
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('[staffSalaryService] update:', error);
      throw error;
    }
    return data as StaffSalaryRow;
  },

  delete: async (id: string): Promise<void> => {
    const { error } = await supabase.from('staff_salaries').delete().eq('id', id);
    if (error) {
      console.error('[staffSalaryService] delete:', error);
      throw error;
    }
  },
};
