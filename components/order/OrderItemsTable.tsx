import React from 'react';
import { CheckCircle2, Clock } from 'lucide-react';
import { Badge } from '../ui/Badge';
import { LoadingSpinner } from '../ui/LoadingSpinner';

export interface OrderItemsTableProps {
  items: any[];
  onUpdatePickup?: (itemId: string, qty: number) => void;
  savingPickupItemId?: string | null;
  pendingPickupValues?: Record<string, number>;
  readonly?: boolean;
  showHint?: boolean;
  containerClassName?: string;
  isLoading?: boolean;
}

export function OrderItemsTable({
  items,
  onUpdatePickup,
  savingPickupItemId = null,
  pendingPickupValues = {},
  readonly = false,
  showHint = true,
  containerClassName = 'bg-gray-50 dark:bg-gray-800/50',
  isLoading = false,
}: OrderItemsTableProps) {
  const canEditPickup = !readonly && !!onUpdatePickup;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <LoadingSpinner size={20} />
        <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">กำลังโหลดรายการสินค้า...</span>
      </div>
    );
  }

  if (!items || items.length === 0) {
    return (
      <div className="flex items-center justify-center py-4">
        <span className="text-sm text-gray-500 dark:text-gray-400">ไม่มีรายการสินค้า</span>
      </div>
    );
  }

  return (
    <div className={`rounded-lg p-3 overflow-x-auto ${containerClassName}`}>
      <table className="w-full text-sm min-w-[580px]">
        <thead>
          <tr className="border-b border-gray-300 dark:border-gray-600">
            <th className="text-left py-2 px-2 font-semibold text-gray-700 dark:text-gray-300">รหัส</th>
            <th className="text-left py-2 px-2 font-semibold text-gray-700 dark:text-gray-300">ชื่อสินค้า</th>
            <th className="text-right py-2 px-2 font-semibold text-gray-700 dark:text-gray-300">สั่ง</th>
            <th className="text-right py-2 px-2 font-semibold text-orange-600 dark:text-orange-400" title="จำนวนที่ลูกค้ามารับที่ร้านแล้ว">
              รับที่ร้าน 🏪
            </th>
            <th className="text-right py-2 px-2 font-semibold text-green-600 dark:text-green-400" title="จำนวนที่ส่งให้ลูกค้าแล้ว">
              ส่งแล้ว ✅
            </th>
            <th className="text-right py-2 px-2 font-semibold text-blue-600 dark:text-blue-400">คงเหลือ</th>
            <th className="text-left py-2 px-2 font-semibold text-gray-700 dark:text-gray-300">หน่วย</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item: any, idx: number) => {
            const pickedUp = Number(item.quantity_picked_up_at_store ?? 0);
            const delivered = Number(item.quantity_delivered ?? 0);
            const remaining = Math.max(0, Number(item.quantity) - pickedUp - delivered);
            const isFulfilled = remaining === 0;
            const displayPickup = pendingPickupValues[item.id] !== undefined ? pendingPickupValues[item.id] : pickedUp;

            return (
              <tr
                key={idx}
                className={`border-b border-gray-200 dark:border-gray-700 last:border-0 ${isFulfilled ? 'opacity-50' : ''}`}
              >
                <td className="py-2 px-2 text-gray-500 dark:text-gray-400">
                  {item.product?.product_code || '-'}
                </td>
                <td className="py-2 px-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`font-medium ${
                        isFulfilled ? 'line-through text-gray-400' : 'text-gray-900 dark:text-gray-100'
                      }`}
                    >
                      {item.product?.product_name || 'ไม่ระบุ'}
                    </span>
                    {item.is_bonus && (
                      <Badge variant="success" className="text-xs">
                        ของแถม
                      </Badge>
                    )}
                    {isFulfilled && (
                      <span className="inline-flex items-center gap-1 text-xs text-green-600 dark:text-green-400 font-medium">
                        <CheckCircle2 className="w-3 h-3" /> ครบแล้ว
                      </span>
                    )}
                  </div>
                </td>
                <td className="py-2 px-2 text-right font-semibold text-gray-700 dark:text-gray-300">
                  {Number(item.quantity).toLocaleString()}
                </td>
                <td className="py-2 px-2 text-right">
                  {canEditPickup ? (
                    <div className="flex items-center justify-end gap-1">
                      <input
                        type="number"
                        min={0}
                        max={Number(item.quantity)}
                        step={1}
                        value={displayPickup}
                        disabled={savingPickupItemId === item.id}
                        onChange={(e) => {
                          const raw = Number(e.target.value);
                          const val = Math.min(
                            Number(item.quantity),
                            Math.max(0, Number.isFinite(raw) ? Math.floor(raw) : 0)
                          );
                          onUpdatePickup!(item.id, val);
                        }}
                        className="w-16 text-right border border-orange-300 dark:border-orange-600 rounded px-1 py-0.5 text-sm focus:ring-1 focus:ring-orange-400 bg-orange-50 dark:bg-orange-900/20 text-orange-800 dark:text-orange-200 disabled:opacity-50"
                        title="จำนวนเต็มที่ลูกค้ารับไปที่หน้าร้าน — คงเหลือส่งอัตโนมัติ"
                      />
                      {savingPickupItemId === item.id && (
                        <Clock className="w-3 h-3 text-orange-500 animate-spin" />
                      )}
                    </div>
                  ) : (
                    <span className="text-orange-600 dark:text-orange-400 font-semibold">
                      {pickedUp > 0 ? pickedUp.toLocaleString() : <span className="text-gray-300">—</span>}
                    </span>
                  )}
                </td>
                <td className="py-2 px-2 text-right text-green-600 dark:text-green-400 font-semibold">
                  {delivered > 0 ? delivered.toLocaleString() : <span className="text-gray-300">—</span>}
                </td>
                <td className="py-2 px-2 text-right">
                  <span
                    className={`font-bold ${
                      isFulfilled
                        ? 'text-gray-400'
                        : remaining < Number(item.quantity)
                          ? 'text-orange-600 dark:text-orange-400'
                          : 'text-blue-600 dark:text-blue-400'
                    }`}
                  >
                    {remaining.toLocaleString()}
                  </span>
                </td>
                <td className="py-2 px-2 text-gray-500 dark:text-gray-400">{item.product?.unit || '-'}</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-gray-400 dark:border-gray-500">
            <td colSpan={2} className="py-2 px-2 text-right text-xs text-gray-500 font-medium">
              รวม:
            </td>
            <td className="py-2 px-2 text-right font-bold text-gray-700 dark:text-gray-300">
              {items.reduce((s: number, i: any) => s + Number(i.quantity), 0).toLocaleString()}
            </td>
            <td className="py-2 px-2 text-right font-bold text-orange-600 dark:text-orange-400">
              {items.reduce((s: number, i: any) => s + Number(i.quantity_picked_up_at_store ?? 0), 0).toLocaleString()}
            </td>
            <td className="py-2 px-2 text-right font-bold text-green-600 dark:text-green-400">
              {items.reduce((s: number, i: any) => s + Number(i.quantity_delivered ?? 0), 0).toLocaleString()}
            </td>
            <td className="py-2 px-2 text-right font-bold text-blue-600 dark:text-blue-400">
              {items
                .reduce((s: number, i: any) => {
                  const rem = Math.max(
                    0,
                    Number(i.quantity) - Number(i.quantity_picked_up_at_store ?? 0) - Number(i.quantity_delivered ?? 0)
                  );
                  return s + rem;
                }, 0)
                .toLocaleString()}
            </td>
            <td />
          </tr>
        </tfoot>
      </table>
      {showHint && (
        <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
          💡 กรอก <span className="text-orange-500 font-medium">&quot;รับที่ร้าน&quot;</span> เป็นจำนวนเต็มเมื่อลูกค้ามารับสินค้าที่หน้าร้าน
          — คงเหลือส่ง = สั่ง − รับที่ร้าน − ส่งแล้ว
        </p>
      )}
    </div>
  );
}
