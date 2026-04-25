import React from 'react';
import { FileWarning, Link2, RefreshCw } from 'lucide-react';
import { Badge } from '../ui/Badge';
import { getOrderBillCorrectionFlags } from '../../utils/orderBillCorrection';

interface BillCorrectionBadgesProps {
  order: {
    related_prior_order_id?: string | null;
    related_prior_order_number?: string | null;
    exclude_from_vehicle_revenue_rollup?: boolean | null;
    replaces_sml_doc_no?: string | null;
  };
  className?: string;
}

/**
 * ป้ายสั้น ๆ ว่าออเดอร์นี้เกี่ยวกับการแก้บิล / แทนที่บิลเดิมหรือไม่
 */
export const BillCorrectionBadges: React.FC<BillCorrectionBadgesProps> = ({ order, className = '' }) => {
  const flags = getOrderBillCorrectionFlags(order);
  if (!flags.isFollowUpCorrection && !flags.isSupersededByNewBill && !flags.replacesSmlDocNo) {
    return null;
  }

  const priorNo = order.related_prior_order_number?.trim() || null;

  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${className}`}>
      {flags.isFollowUpCorrection && (
        <>
          <Badge
            variant="warning"
            className="text-xs font-semibold inline-flex items-center gap-1 ring-1 ring-amber-400/70 dark:ring-amber-600 dark:bg-amber-900/35"
            title={
              priorNo
                ? `ออเดอร์นี้เชื่อมกับบิลเดิม ${priorNo} ในระบบ (แก้บิล / เลขเอกสารใหม่หลังมีข้อผิดพลาด)`
                : 'ออเดอร์นี้เชื่อมกับบิลเดิมในระบบ (แก้บิล / เลขเอกสารใหม่หลังมีข้อผิดพลาด)'
            }
          >
            <Link2 className="w-3 h-3 shrink-0" aria-hidden />
            แก้บิล / เชื่อมบิลเดิม
          </Badge>
          {priorNo && (
            <Badge
              variant="info"
              className="text-xs font-medium inline-flex items-center gap-1 max-w-[min(100%,220px)] ring-1 ring-blue-300/60 dark:ring-blue-700/80"
              title={`รหัสออเดอร์ของบิลเดิมในระบบ: ${priorNo}`}
            >
              <span className="truncate">ออเดอร์เดิม: {priorNo}</span>
            </Badge>
          )}
        </>
      )}
      {flags.isSupersededByNewBill && (
        <Badge
          variant="default"
          className="text-xs font-semibold inline-flex items-center gap-1 bg-slate-200/90 text-slate-800 dark:bg-charcoal-700 dark:text-slate-100 ring-1 ring-slate-300/80 dark:ring-slate-600"
          title="มีออเดอร์ใหม่ที่ผูกมาจากบิลนี้ — ยอดรายได้ต่อรถไม่นับซ้ำกับบิลใหม่"
        >
          <RefreshCw className="w-3 h-3 shrink-0" aria-hidden />
          มีบิลใหม่แทน
        </Badge>
      )}
      {flags.replacesSmlDocNo && (
        <Badge
          variant="info"
          className="text-xs font-normal inline-flex items-center gap-1 max-w-[min(100%,280px)]"
          title={`เลขเอกสาร SML ของบิลเดิมที่อ้างอิง: ${flags.replacesSmlDocNo}`}
        >
          <FileWarning className="w-3 h-3 shrink-0" aria-hidden />
          <span className="truncate">เลข SML เดิม: {flags.replacesSmlDocNo}</span>
        </Badge>
      )}
    </div>
  );
};
