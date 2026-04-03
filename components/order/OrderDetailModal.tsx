import React from 'react';
import { Modal } from '../ui/Modal';
import { LoadingSpinner } from '../ui/LoadingSpinner';

interface OrderDetailModalProps {
  order: any;
  loading: boolean;
  error: string | null;
  items: any[];
  summary: { ordered: number; pickedUp: number; delivered: number; remaining: number } | null;
  onClose: () => void;
  getStatusBadge: (order: any) => React.ReactNode;
}

export const OrderDetailModal: React.FC<OrderDetailModalProps> = ({
  order,
  loading,
  error,
  items,
  summary,
  onClose,
  getStatusBadge,
}) => {
  return (
    <Modal
      isOpen={!!order}
      onClose={onClose}
      title={`รายละเอียดออเดอร์ ${order?.order_number || (order ? 'รอจัดทริป' : '')}`}
      size="large"
    >
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <LoadingSpinner />
        </div>
      ) : error ? (
        <div className="p-6 text-center text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/10 rounded-xl">
          <p className="font-semibold mb-1">เกิดข้อผิดพลาด</p>
          <p className="text-sm">{error}</p>
        </div>
      ) : order ? (
        <div className="space-y-6">
          {/* Header Card */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 p-5 rounded-2xl bg-slate-50 dark:bg-charcoal-950 border border-slate-100 dark:border-slate-800/60 shadow-inner">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-bold tracking-wider text-slate-400 uppercase">ร้านค้า</span>
              <div className="text-xl font-bold text-slate-900 dark:text-white leading-tight">
                {order.customer_name}
              </div>
              <div className="text-sm font-medium text-enterprise-600 dark:text-enterprise-400">{order.customer_code}</div>
            </div>
            
            <div className="flex flex-col md:items-end gap-3">
              <div className="drop-shadow-sm">{getStatusBadge(order)}</div>
              
              <div className="text-sm text-slate-600 dark:text-slate-400 space-y-1.5 md:text-right">
                <div className="flex items-center gap-2 md:justify-end">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600"></span>
                  สร้าง:{' '}
                  <span className="font-medium text-slate-900 dark:text-slate-200">
                    {new Date(order.created_at).toLocaleDateString('th-TH', {
                      year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                    })}
                  </span>
                </div>
                {order.delivery_date && (
                  <div className="flex items-center gap-2 md:justify-end">
                    <span className="w-1.5 h-1.5 rounded-full bg-orange-400"></span>
                    นัดส่ง:{' '}
                    <span className="font-semibold text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 px-1.5 py-0.5 rounded">
                      {new Date(order.delivery_date).toLocaleDateString('th-TH', {
                        year: 'numeric', month: 'short', day: 'numeric',
                      })}
                    </span>
                  </div>
                )}
              </div>
              
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-sm font-medium text-slate-500">ยอดรวม</span>
                <span className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                  <span className="text-lg text-slate-400 mr-0.5">฿</span>
                  {order.total_amount?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>

          {/* Quantity Summary Card */}
          {summary && (
            <div className="relative overflow-hidden p-4 rounded-xl bg-gradient-to-r from-enterprise-50 to-white dark:from-enterprise-900/20 dark:to-charcoal-900 border border-enterprise-100 dark:border-enterprise-800 shadow-sm">
              <div className="absolute top-0 right-0 w-32 h-32 bg-enterprise-200/50 dark:bg-enterprise-700/20 blur-3xl -mr-10 -mt-10 rounded-full"></div>
              <div className="text-xs font-bold text-enterprise-800 dark:text-enterprise-300 uppercase tracking-widest mb-3 relative z-10">สรุปจำนวนรวมสินค้า</div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 relative z-10">
                <div className="flex flex-col">
                  <span className="text-sm text-slate-500 font-medium">สั่งทั้งหมด</span>
                  <span className="text-xl font-bold text-slate-800 dark:text-slate-200">{summary.ordered.toLocaleString()} <span className="text-xs font-normal">ชิ้น</span></span>
                </div>
                <div className="flex flex-col">
                  <span className="text-sm text-amber-600 dark:text-amber-500 font-medium">🏪 รับที่ร้าน</span>
                  <span className="text-xl font-bold text-amber-700 dark:text-amber-400">{summary.pickedUp.toLocaleString()} <span className="text-xs font-normal">ชิ้น</span></span>
                </div>
                <div className="flex flex-col">
                  <span className="text-sm text-emerald-600 dark:text-emerald-500 font-medium">✅ ส่งแล้ว</span>
                  <span className="text-xl font-bold text-emerald-700 dark:text-emerald-400">{summary.delivered.toLocaleString()} <span className="text-xs font-normal">ชิ้น</span></span>
                </div>
                <div className="flex flex-col">
                  <span className="text-sm text-slate-500 font-medium border-l border-slate-200 dark:border-slate-700 pl-4">คงเหลือ</span>
                  <span className="text-xl font-bold text-slate-800 dark:text-slate-200 pl-4">{summary.remaining.toLocaleString()} <span className="text-xs font-normal">ชิ้น</span></span>
                </div>
              </div>
            </div>
          )}

          {/* Items Table */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="font-bold py-3 px-4 text-xs tracking-wider uppercase text-slate-600 dark:text-slate-400">สินค้า</th>
                    <th className="font-bold py-3 px-4 text-xs tracking-wider uppercase text-slate-600 dark:text-slate-400 text-right">จำนวนสั่ง</th>
                    <th className="font-bold py-3 px-4 text-xs tracking-wider uppercase text-amber-600 dark:text-amber-500 text-right bg-amber-50/50 dark:bg-amber-900/10">🏪 รับตึก</th>
                    <th className="font-bold py-3 px-4 text-xs tracking-wider uppercase text-emerald-600 dark:text-emerald-500 text-right bg-emerald-50/50 dark:bg-emerald-900/10">✅ ส่งแล้ว</th>
                    <th className="font-bold py-3 px-4 text-xs tracking-wider uppercase text-slate-600 dark:text-slate-400 text-right">ราคา/หน่วย</th>
                    <th className="font-bold py-3 px-4 text-xs tracking-wider uppercase text-slate-600 dark:text-slate-400 text-right">ลด (%)</th>
                    <th className="font-bold py-3 px-4 text-xs tracking-wider uppercase text-slate-600 dark:text-slate-400 text-right">รวมบรรทัด</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-8 text-slate-500 dark:text-slate-400 bg-slate-50/30 dark:bg-charcoal-900/30">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-charcoal-800 flex items-center justify-center">
                            <span className="text-xl">📦</span>
                          </div>
                          ไม่มีรายการสินค้า
                        </div>
                      </td>
                    </tr>
                  ) : (
                    items.map((item: any) => {
                      const pickedUp = Number(item.quantity_picked_up_at_store ?? 0);
                      const delivered = Number(item.quantity_delivered ?? 0);
                      const hasPickupOrDelivery = pickedUp > 0 || delivered > 0;
                      
                      return (
                        <tr key={item.id} className={`hover:bg-slate-50 dark:hover:bg-charcoal-800/30 transition-colors ${hasPickupOrDelivery ? 'bg-amber-50/20 dark:bg-amber-900/5' : 'bg-white dark:bg-charcoal-900'}`}>
                          <td className="py-3 px-4">
                            <div className="font-semibold text-sm text-slate-900 dark:text-white line-clamp-1">
                              {item.product?.product_name || 'ไม่ระบุชื่อสินค้า'}
                            </div>
                            <div className="text-xs font-medium text-slate-500 font-mono mt-0.5">
                              {item.product?.product_code || '-'}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <span className="font-semibold text-slate-900 dark:text-white">{item.quantity?.toLocaleString()}</span>
                            <span className="text-xs text-slate-500 ml-1">{item.unit || item.product?.unit || ''}</span>
                          </td>
                          <td className="py-3 px-4 text-right bg-amber-50/30 dark:bg-amber-900/10">
                            {pickedUp > 0 ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400">
                                {pickedUp.toLocaleString()} {item.unit || item.product?.unit || ''}
                              </span>
                            ) : (
                              <span className="text-slate-300 dark:text-slate-600 font-medium">—</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right bg-emerald-50/30 dark:bg-emerald-900/10">
                            {delivered > 0 ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400">
                                {delivered.toLocaleString()} {item.unit || item.product?.unit || ''}
                              </span>
                            ) : (
                              <span className="text-slate-300 dark:text-slate-600 font-medium">—</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right text-sm font-medium text-slate-700 dark:text-slate-300">
                            ฿{item.unit_price?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-3 px-4 text-right text-sm">
                            {item.discount_percent > 0 ? (
                              <span className="inline-flex px-1.5 py-0.5 bg-rose-50 text-rose-600 dark:bg-rose-900/20 dark:text-rose-400 rounded text-xs font-bold">
                                {item.discount_percent}%
                              </span>
                            ) : (
                              <span className="text-slate-400 dark:text-slate-500">0%</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-slate-900 dark:text-white">
                            ฿{item.line_total?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}
    </Modal>
  );
};
