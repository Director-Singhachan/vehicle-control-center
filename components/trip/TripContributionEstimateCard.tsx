// การ์ดประมาณการกำไรขั้นต้นรายเที่ยว (Layer 1 + 2) — ไม่รวมออฟฟิศ; ค่าคอมเป็นประมาณการจากจำนวนชิ้น × อัตรา
import React from 'react';
import { Calculator, AlertCircle } from 'lucide-react';
import { Card } from '../ui/Card';
import { Input } from '../ui/Input';
import type { TripContributionEstimateResult } from '../../services/deliveryTrip/tripContributionEstimateService';
import { getBranchLabel } from '../../utils/branchLabels';

function formatMoney(n: number): string {
  return n.toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export interface TripContributionEstimateCardProps {
  estimatedFuelStr: string;
  onEstimatedFuelChange: (value: string) => void;
  data: TripContributionEstimateResult | null;
  loading: boolean;
  error: string | null;
  branchCode: string | null;
  /** หัวข้อการ์ด (เช่น เที่ยวที่ 1) */
  title?: string;
  /** แสดงช่องน้ำมันในการ์ด — ถ้า false ให้ควบคุมน้ำมันจากพ่อ (เช่น แบ่งหลายเที่ยว) */
  showFuelInput?: boolean;
}

export const TripContributionEstimateCard: React.FC<TripContributionEstimateCardProps> = ({
  estimatedFuelStr,
  onEstimatedFuelChange,
  data,
  loading,
  error,
  branchCode,
  title = 'ประมาณการคุ้มค่าทริป (ขนส่ง)',
  showFuelInput = true,
}) => {
  return (
    <Card>
      <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2">
        <Calculator size={20} className="text-enterprise-600 dark:text-enterprise-400" />
        {title}
      </h3>
      <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
        คำนวณจากรายได้เที่ยว ต้นทุนรถต่อวัน × วันเที่ยว น้ำมันโดยประมาณ ค่าคอมโดยประมาณ (ชิ้น × อัตราต่อชิ้น) และเงินเดือนลูกเรือปันตามจำนวนเที่ยวในสาขา{' '}
        <span className="font-medium text-slate-600 dark:text-slate-300">{getBranchLabel(branchCode)}</span>
        {' — '}
        <span className="text-amber-700 dark:text-amber-400">ไม่รวมค่าออฟฟิศ — ค่าคอมจริงอาจต่างหลังปิดทริป (เช่น แบ่งตามชั่วโมง)</span>
      </p>

      {showFuelInput && (
        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            น้ำมันโดยประมาณ (บาท)
          </label>
          <Input
            type="number"
            value={estimatedFuelStr}
            onChange={(e) => onEstimatedFuelChange(e.target.value)}
            placeholder="0 — กรอกเมื่อทราบประมาณการ"
            min={0}
            step={1}
            className="dark:bg-charcoal-900 dark:border-slate-600 dark:text-white"
          />
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-2 text-sm text-red-800 dark:text-red-200">
          <AlertCircle size={18} className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {loading && (
        <div className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">กำลังคำนวณประมาณการ…</div>
      )}

      {!loading && data && (
        <div className="space-y-3">
          <div
            className={`rounded-lg p-4 border ${
              data.estimatedContribution >= 0
                ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
            }`}
          >
            <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">กำไรขั้นต้นโดยประมาณ (หลังหักต้นทุนขนส่งที่ระบุ)</p>
            <p
              className={`text-2xl font-bold ${
                data.estimatedContribution >= 0
                  ? 'text-green-700 dark:text-green-400'
                  : 'text-red-700 dark:text-red-400'
              }`}
            >
              {data.estimatedContribution >= 0 ? '' : '−'}฿{formatMoney(Math.abs(data.estimatedContribution))}
            </p>
          </div>

          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
            <div className="flex justify-between gap-2 p-2 rounded bg-slate-50 dark:bg-slate-800/80">
              <dt className="text-slate-600 dark:text-slate-400">รายได้เที่ยว</dt>
              <dd className="font-medium text-slate-900 dark:text-slate-100">฿{formatMoney(data.revenue)}</dd>
            </div>
            <div className="flex justify-between gap-2 p-2 rounded bg-slate-50 dark:bg-slate-800/80">
              <dt className="text-slate-600 dark:text-slate-400">ต้นทุนรถ (คงที่ × {data.tripDays} วัน)</dt>
              <dd className="font-medium text-slate-900 dark:text-slate-100">฿{formatMoney(data.fixedCost)}</dd>
            </div>
            <div className="flex justify-between gap-2 p-2 rounded bg-slate-50 dark:bg-slate-800/80">
              <dt className="text-slate-600 dark:text-slate-400">น้ำมัน (ประมาณ)</dt>
              <dd className="font-medium text-slate-900 dark:text-slate-100">฿{formatMoney(data.fuelCost)}</dd>
            </div>
            <div className="flex justify-between gap-2 p-2 rounded bg-slate-50 dark:bg-slate-800/80">
              <dt className="text-slate-600 dark:text-slate-400">
                ค่าคอม (ประมาณ){data.commissionRatePerUnit != null ? ` @ ${formatMoney(data.commissionRatePerUnit)}/ชิ้น` : ''}
              </dt>
              <dd className="font-medium text-slate-900 dark:text-slate-100">฿{formatMoney(data.commissionCost ?? 0)}</dd>
            </div>
            <div className="sm:col-span-2 flex justify-between gap-2 p-2 rounded bg-blue-50/80 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900/40">
              <dt className="text-slate-600 dark:text-slate-400">ต้นทุนผันแปรรวม (น้ำมัน + ค่าคอม)</dt>
              <dd className="font-medium text-slate-900 dark:text-slate-100">
                ฿{formatMoney(data.fuelCost + (data.commissionCost ?? 0))}
              </dd>
            </div>
            <div className="flex justify-between gap-2 p-2 rounded bg-slate-50 dark:bg-slate-800/80">
              <dt className="text-slate-600 dark:text-slate-400">ต้นทุนบุคลากร (ปันส่วนเงินเดือน)</dt>
              <dd className="font-medium text-slate-900 dark:text-slate-100">฿{formatMoney(data.personnelCost)}</dd>
            </div>
            <div className="sm:col-span-2 flex justify-between gap-2 p-2 rounded bg-slate-100 dark:bg-slate-800/60">
              <dt className="text-slate-600 dark:text-slate-400">ต้นทุนรวม (ประมาณ)</dt>
              <dd className="font-semibold text-slate-900 dark:text-slate-100">฿{formatMoney(data.totalCost)}</dd>
            </div>
          </dl>

          <p className="text-xs text-slate-500 dark:text-slate-500">{data.commissionNote}</p>

          {data.warnings.length > 0 && (
            <ul className="text-xs text-amber-800 dark:text-amber-300 list-disc list-inside space-y-1">
              {data.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Card>
  );
};
