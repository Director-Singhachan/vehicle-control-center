import React from 'react';
import { FileText, Package, AlertCircle } from 'lucide-react';
import { Card, CardHeader } from '../ui/Card';
import { SkeletonCard } from '../ui/Skeleton';
import type { DeliveryTripItemChangeWithDetails } from '../../services/deliveryTripService';

interface TripHistorySectionProps {
  editHistory: any[];
  editHistoryLoading: boolean;
  editHistoryError: string | null;
  itemChanges: DeliveryTripItemChangeWithDetails[];
  itemChangesLoading: boolean;
  itemChangesError: string | null;
}

const FIELD_NAMES: Record<string, string> = {
  planned_date: 'วันที่วางแผน',
  odometer_start: 'เลขไมล์เริ่มต้น',
  odometer_end: 'เลขไมล์สิ้นสุด',
  status: 'สถานะทริป',
  notes: 'หมายเหตุ',
  sequence_order: 'ลำดับทริป',
  vehicle_id: 'รถที่ใช้',
  driver_id: 'คนขับ',
  trip_revenue: 'รายรับทริป',
  trip_start_date: 'วันเริ่มทริปจริง',
  trip_end_date: 'วันสิ้นสุดทริปจริง',
};

const STATUS_LABELS: Record<string, string> = {
  planned: 'วางแผนแล้ว',
  in_progress: 'กำลังดำเนินการ',
  completed: 'เสร็จสิ้น',
  cancelled: 'ยกเลิก',
};

// Fields ที่เป็น UUID — ไม่แสดง UUID ดิบ แสดงแค่ว่า "มีการเปลี่ยนแปลง"
const UUID_FIELDS = new Set(['vehicle_id', 'driver_id']);

function formatDateTime(date: string) {
  return new Date(date).toLocaleString('th-TH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatFieldValue(field: string, val: any) {
  if (val === null || val === undefined || val === '') return '—';
  if (UUID_FIELDS.has(field)) return '(มีการเปลี่ยนแปลง)';
  if (field === 'status') return STATUS_LABELS[val] ?? val;
  if (field === 'planned_date' || field === 'trip_start_date' || field === 'trip_end_date') {
    return new Date(val).toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }
  if (field === 'trip_revenue') return `${Number(val).toLocaleString()} บาท`;
  return String(val);
}


export const TripHistorySection: React.FC<TripHistorySectionProps> = ({
  editHistory,
  editHistoryLoading,
  editHistoryError,
  itemChanges,
  itemChangesLoading,
  itemChangesError,
}) => {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* ── Trip Edit History ─────────────────────────────────────── */}
      <Card>
        <CardHeader
          title="ประวัติการแก้ไขข้อมูลทริป"
          subtitle="บันทึกการเปลี่ยนแปลงข้อมูลหลักของทริป"
        />

        {editHistoryLoading && (
          <div className="space-y-3">
            {[1, 2].map((i) => <SkeletonCard key={i} className="h-20" />)}
          </div>
        )}

        {editHistoryError && (
          <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400 py-3">
            <AlertCircle size={16} />
            {editHistoryError}
          </div>
        )}

        {!editHistoryLoading && !editHistoryError && editHistory.length === 0 && (
          <p className="text-sm text-slate-400 dark:text-slate-500 py-4 text-center">
            ยังไม่มีประวัติการแก้ไขข้อมูลทริปนี้
          </p>
        )}

        {!editHistoryLoading && !editHistoryError && editHistory.length > 0 && (
          <div className="space-y-3">
            {editHistory.map((edit: any, idx: number) => {
              const changedFields = Object.keys(edit.changes?.new_values || {}).filter(
                (f) => f !== 'updated_at',
              );

              return (
                <div
                  key={edit.id ?? idx}
                  className="border border-slate-200 dark:border-slate-700 rounded-xl p-4 text-sm"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-semibold text-slate-900 dark:text-slate-100">
                      {edit.editor_name || edit.editor?.full_name || 'ไม่ระบุผู้แก้ไข'}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      {formatDateTime(edit.edited_at || edit.created_at)}
                    </div>
                  </div>

                  {edit.edit_reason && (
                    <div className="text-xs text-slate-500 dark:text-slate-400 mb-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg px-3 py-1.5">
                      เหตุผล: {edit.edit_reason}
                    </div>
                  )}

                  {changedFields.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                        การเปลี่ยนแปลง:
                      </div>
                      {changedFields.map((field) => {
                        const oldVal = edit.changes.old_values?.[field];
                        const newVal = edit.changes.new_values?.[field];
                        return (
                          <div
                            key={field}
                            className="p-2 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700"
                          >
                            <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                              {FIELD_NAMES[field] || field}
                            </div>
                            <div className="flex items-center gap-2 text-xs">
                              <span className="text-red-600 dark:text-red-400 line-through">
                                {formatFieldValue(field, oldVal)}
                              </span>
                              <span className="text-slate-400">→</span>
                              <span className="text-green-600 dark:text-green-400 font-medium">
                                {formatFieldValue(field, newVal)}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* ── Item Change History ───────────────────────────────────── */}
      <Card>
        <CardHeader
          title="ประวัติการแก้ไขสินค้า"
          subtitle="บันทึกการเพิ่ม ลบ หรือแก้ไขจำนวนสินค้าในทริป"
        />

        {itemChangesLoading && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <SkeletonCard key={i} className="h-16" />)}
          </div>
        )}

        {itemChangesError && (
          <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400 py-3">
            <AlertCircle size={16} />
            {itemChangesError}
          </div>
        )}

        {!itemChangesLoading && !itemChangesError && itemChanges.length === 0 && (
          <div className="py-8 text-center">
            <Package size={32} className="mx-auto mb-2 text-slate-300 dark:text-slate-600" />
            <p className="text-sm text-slate-400 dark:text-slate-500">
              ยังไม่มีประวัติการแก้ไขสินค้าในทริปนี้
            </p>
          </div>
        )}

        {!itemChangesLoading && !itemChangesError && itemChanges.length > 0 && (
          <div className="space-y-3">
            {itemChanges.map((change) => {
              const actionLabel =
                change.action === 'add'
                  ? 'เพิ่มรายการ'
                  : change.action === 'remove'
                    ? 'ลบรายการ'
                    : 'แก้ไขจำนวน';

              const actionColor =
                change.action === 'add'
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/60 dark:text-green-300'
                  : change.action === 'remove'
                    ? 'bg-red-100 text-red-700 dark:bg-red-900/60 dark:text-red-300'
                    : 'bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300';

              const storeLabel = change.store
                ? `${change.store.customer_code} — ${change.store.customer_name}`
                : 'ไม่ระบุร้านค้า';

              const productLabel = change.product
                ? `${change.product.product_code} — ${change.product.product_name}`
                : 'ไม่ระบุสินค้า';

              return (
                <div
                  key={change.id}
                  className="border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-sm"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${actionColor}`}>
                      {actionLabel}
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {formatDateTime(change.created_at)}
                    </span>
                  </div>

                  <div className="space-y-1 text-slate-700 dark:text-slate-300">
                    <div className="text-xs">
                      <span className="text-slate-500 dark:text-slate-400">ร้านค้า: </span>
                      {storeLabel}
                    </div>
                    <div className="text-xs">
                      <span className="text-slate-500 dark:text-slate-400">สินค้า: </span>
                      {productLabel}
                    </div>
                    <div className="text-xs">
                      <span className="text-slate-500 dark:text-slate-400">ปริมาณ: </span>
                      {change.old_quantity != null && change.new_quantity != null ? (
                        <>
                          <span className="text-red-500 line-through">
                            {Number(change.old_quantity).toLocaleString()}
                          </span>
                          {' → '}
                          <span className="text-green-600 dark:text-green-400 font-medium">
                            {Number(change.new_quantity).toLocaleString()}
                          </span>
                        </>
                      ) : change.old_quantity != null ? (
                        <span className="text-red-500">
                          {Number(change.old_quantity).toLocaleString()} → 0
                        </span>
                      ) : change.new_quantity != null ? (
                        <span className="text-green-600 dark:text-green-400">
                          0 → {Number(change.new_quantity).toLocaleString()}
                        </span>
                      ) : (
                        '—'
                      )}
                    </div>
                    {change.reason && (
                      <div className="text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/40 rounded px-2 py-1 mt-1">
                        เหตุผล: {change.reason}
                      </div>
                    )}
                    {change.user && (
                      <div className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                        โดย: {change.user.full_name}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
};
