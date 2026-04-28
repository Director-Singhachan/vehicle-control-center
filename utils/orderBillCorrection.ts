/**
 * เคสแก้บิล / เลขเอกสาร SML ใหม่ — ใช้แสดงป้ายในรายการออเดอร์
 *
 * - related_prior_order_id: บิลนี้ผูกกับออเดอร์เดิม (บิลแก้)
 * - exclude_from_vehicle_revenue_rollup: บิลเดิมที่มีบิลใหม่มาแทน (กันยอดรายได้ซ้ำ)
 * - replaces_sml_doc_no: เลข SML บิลเดิมที่อ้างอิง (บันทึกมือ)
 */

export interface OrderBillCorrectionInput {
  related_prior_order_id?: string | null;
  exclude_from_vehicle_revenue_rollup?: boolean | null;
  replaces_sml_doc_no?: string | null;
}

export interface OrderBillCorrectionFlags {
  /** บิลนี้เป็นออเดอร์ใหม่ที่เชื่อมกับบิลเดิม */
  isFollowUpCorrection: boolean;
  /** บิลเดิมที่ถูกแทนด้วยบิลใหม่ (ยอดรายได้ต่อรถไม่นับซ้ำ) */
  isSupersededByNewBill: boolean;
  replacesSmlDocNo: string | null;
}

export function getOrderBillCorrectionFlags(order: OrderBillCorrectionInput): OrderBillCorrectionFlags {
  const doc = order.replaces_sml_doc_no?.trim();
  return {
    isFollowUpCorrection: order.related_prior_order_id != null && order.related_prior_order_id !== '',
    isSupersededByNewBill: order.exclude_from_vehicle_revenue_rollup === true,
    replacesSmlDocNo: doc ? doc : null,
  };
}

export function orderHasBillCorrectionVisible(order: OrderBillCorrectionInput): boolean {
  const f = getOrderBillCorrectionFlags(order);
  return f.isFollowUpCorrection || f.isSupersededByNewBill || f.replacesSmlDocNo != null;
}

/** ตัวกรองเคสบิลในหน้าติดตามออเดอร์ */
export type TrackBillIssueFilter = 'all' | 'any' | 'follow_up' | 'superseded';

/**
 * ออเดอร์ผ่านตัวกรองเคสบิลหรือไม่ (ใช้ข้อมูลที่บันทึกใน orders แล้ว)
 */
export function orderMatchesTrackBillIssueFilter(
  order: OrderBillCorrectionInput,
  filter: TrackBillIssueFilter
): boolean {
  if (filter === 'all') return true;
  const f = getOrderBillCorrectionFlags(order);
  if (filter === 'any') {
    return f.isFollowUpCorrection || f.isSupersededByNewBill || f.replacesSmlDocNo != null;
  }
  if (filter === 'follow_up') return f.isFollowUpCorrection;
  if (filter === 'superseded') return f.isSupersededByNewBill;
  return true;
}
