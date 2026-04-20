/**
 * ทริปที่ทำเครื่องหมายปัญหาข้อมูลการขาย/บิล หรือโน้ตแบบ [DATA_ISSUE] (ย้อนหลัง)
 */
export function tripHasSalesDataIssue(trip: {
  has_sales_data_issue?: boolean;
  notes?: string | null;
}): boolean {
  if (trip?.has_sales_data_issue) return true;
  const n = trip?.notes;
  return typeof n === 'string' && n.includes('[DATA_ISSUE]');
}
