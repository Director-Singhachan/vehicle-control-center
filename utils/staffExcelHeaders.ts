/**
 * หัวคอลัมน์สำหรับไฟล์ Excel พนักงาน — ใช้ร่วมกันระหว่าง StaffImportModal และ StaffBulkEmailModal
 */

/** หา index คอลัมน์จากหลายชื่อที่เป็นไปได้ */
export function staffColumnIndex(
  colMap: Record<string, number>,
  candidates: string[],
): number | undefined {
  for (const key of candidates) {
    if (colMap[key] !== undefined) return colMap[key];
  }
  return undefined;
}

export const STAFF_EMAIL_HEADER_CANDIDATES = [
  'Email',
  'email',
  'E-mail',
  'e-mail',
  'อีเมล',
  'E-mail Address',
];

export const STAFF_EMPLOYEE_CODE_HEADER_CANDIDATES = ['รหัสพนักงาน'];
