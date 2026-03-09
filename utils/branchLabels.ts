/**
 * ชื่อแสดง (display name) ของสาขา — ใช้ทั้ง dropdown, badge, และรายงาน
 * ค่าใน DB: HQ = สำนักงานใหญ่, SD = สาขาสอยดาว
 */

export const BRANCH_LABELS: Record<string, string> = {
  HQ: 'สำนักงานใหญ่',
  SD: 'สาขาสอยดาว',
};

export const BRANCH_OPTIONS: { value: string; label: string }[] = [
  { value: 'HQ', label: BRANCH_LABELS.HQ },
  { value: 'SD', label: BRANCH_LABELS.SD },
];

/** ค่า "ทุกสาขา" สำหรับ filter (ไม่เก็บใน DB) */
export const BRANCH_ALL_VALUE = 'ALL';
export const BRANCH_ALL_LABEL = 'ทุกสาขา';

/** ตัวเลือกสำหรับ dropdown กรองสาขา (รวม "ทุกสาขา") */
export const BRANCH_FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: BRANCH_ALL_VALUE, label: BRANCH_ALL_LABEL },
  ...BRANCH_OPTIONS,
];

/**
 * แปลงรหัสสาขาเป็นชื่อแสดง
 * @param code รหัสสาขา (HQ, SD) หรือ null/undefined
 * @returns ชื่อแสดง หรือค่าเดิมถ้าไม่มีใน BRANCH_LABELS
 */
export function getBranchLabel(code: string | null | undefined): string {
  if (code == null || code === '') return '-';
  return BRANCH_LABELS[code] ?? code;
}
