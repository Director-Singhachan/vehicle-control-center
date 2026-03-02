import React, { useEffect, useState, useMemo } from 'react';
import { Package, Printer, CircleCheck, Building2, History } from 'lucide-react';
import { PageLayout } from '../components/ui/PageLayout';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { useToast } from '../hooks/useToast';
import { ToastContainer } from '../components/ui/Toast';
import { useAuth } from '../hooks/useAuth';
import { ordersService, type PickupPendingItem } from '../services/ordersService';
import { pdfService } from '../services/pdfService';

type GroupedOrder = {
  orderId: string;
  orderNumber: string | null;
  orderDate: string;
  store: { customer_code: string; customer_name: string; address: string | null; branch: string | null };
  items: PickupPendingItem[];
};

function groupByOrder(items: PickupPendingItem[]): GroupedOrder[] {
  const map = new Map<string, GroupedOrder>();
  for (const item of items) {
    const existing = map.get(item.order_id);
    if (existing) {
      existing.items.push(item);
    } else {
      map.set(item.order_id, {
        orderId: item.order_id,
        orderNumber: item.order.order_number,
        orderDate: item.order.order_date,
        store: item.order.store,
        items: [item],
      });
    }
  }
  return Array.from(map.values()).sort(
    (a, b) => new Date(a.orderDate).getTime() - new Date(b.orderDate).getTime()
  );
}

export function PickupOrdersView() {
  const { profile } = useAuth();
  const { toasts, success, error, dismissToast } = useToast();
  const [tab, setTab] = useState<'pending' | 'history'>('pending');
  const [items, setItems] = useState<PickupPendingItem[]>([]);
  const [historyOrders, setHistoryOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmingOrderId, setConfirmingOrderId] = useState<string | null>(null);
  const [branchFilter, setBranchFilter] = useState<string>(() => {
    const isHighLevel =
      profile?.role === 'admin' ||
      profile?.role === 'manager' ||
      profile?.role === 'inspector' ||
      profile?.role === 'executive';
    if (isHighLevel || profile?.branch === 'HQ') return 'ALL';
    return profile?.branch || 'ALL';
  });

  const fetchItems = async () => {
    try {
      setLoading(true);
      const data = await ordersService.getPickupPendingItems(
        branchFilter && branchFilter !== 'ALL' ? { branch: branchFilter } : undefined
      );
      setItems(data);
    } catch (err: any) {
      error(err?.message || 'โหลดรายการล้มเหลว');
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const data = await ordersService.getPickupFulfilledOrders(
        branchFilter && branchFilter !== 'ALL' ? { branch: branchFilter } : undefined
      );
      setHistoryOrders(data);
    } catch (err: any) {
      error(err?.message || 'โหลดประวัติล้มเหลว');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (tab === 'pending') fetchItems();
    else fetchHistory();
  }, [branchFilter, tab]);

  const grouped = useMemo(() => groupByOrder(items), [items]);

  const handlePrintSlip = async (group: GroupedOrder) => {
    try {
      const orderPayload = {
        order_number: group.orderNumber,
        order_date: group.orderDate,
        customer_name: group.store.customer_name,
        customer_code: group.store.customer_code,
        store_address: group.store.address,
      };
      const itemsPayload = group.items.map((i) => ({
        quantity: i.quantity_remaining,
        product: {
          product_code: i.product.product_code,
          product_name: i.product.product_name,
          category: i.product.category,
          unit: i.product.unit,
        },
      }));
      await pdfService.generateOrderPickupSlipPDF(orderPayload, itemsPayload);
      success('พิมพ์ใบเบิกสำเร็จ');
    } catch (err: any) {
      error(err?.message || 'พิมพ์ใบเบิกล้มเหลว');
    }
  };

  const handleConfirmReceived = async (orderId: string) => {
    try {
      setConfirmingOrderId(orderId);
      const { updated, orderStatus } = await ordersService.markPickupItemsFulfilled(
        orderId,
        undefined,
        profile?.id
      );
      if (updated > 0) {
        success(
          orderStatus === 'delivered'
            ? 'ยืนยันรับแล้ว และออเดอร์ครบทุกรายการแล้ว'
            : `ยืนยันรับแล้ว ${updated} รายการ`
        );
        fetchItems();
        fetchHistory(); // รีเฟรชประวัติเสมอ — ออเดอร์ผสมจะโผล่ในประวัติเมื่อรับส่วน pickup ครบ
      }
    } catch (err: any) {
      error(err?.message || 'ยืนยันรับแล้วล้มเหลว');
    } finally {
      setConfirmingOrderId(null);
    }
  };

  return (
    <PageLayout
      title="รายการรอรับเอง (ลูกค้ามารับเอง)"
      actions={
        <div className="flex items-center gap-2">
          {(profile?.role === 'admin' ||
            profile?.role === 'manager' ||
            profile?.role === 'inspector' ||
            profile?.role === 'executive' ||
            profile?.branch === 'HQ') && (
            <select
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
            >
              <option value="ALL">ทุกสาขา</option>
              <option value="HQ">HQ</option>
              <option value="SD">สอยดาว</option>
            </select>
          )}
          <Button variant="outline" size="sm" onClick={tab === 'pending' ? fetchItems : fetchHistory} disabled={loading}>
            โหลดใหม่
          </Button>
        </div>
      }
    >
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setTab('pending')}
          className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 ${
            tab === 'pending'
              ? 'bg-enterprise-600 text-white dark:bg-blue-600 dark:text-white'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
          }`}
        >
          <Package size={18} />
          รอรับ ({grouped.length})
        </button>
        <button
          onClick={() => setTab('history')}
          className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 ${
            tab === 'history'
              ? 'bg-enterprise-600 text-white dark:bg-blue-600 dark:text-white'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
          }`}
        >
          <History size={18} />
          ประวัติที่รับแล้ว
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <LoadingSpinner />
        </div>
      ) : tab === 'history' ? (
        historyOrders.length === 0 ? (
          <Card>
            <div className="p-12 text-center">
              <History className="mx-auto mb-4 text-slate-400 dark:text-slate-500" size={48} />
              <p className="text-slate-600 dark:text-slate-400">ยังไม่มีประวัติรับเอง</p>
              <p className="text-sm text-slate-500 dark:text-slate-500 mt-1">
                ออเดอร์ที่ลูกค้ามารับครบแล้วจะแสดงที่นี่
              </p>
            </div>
          </Card>
        ) : (
          <div className="space-y-4">
            {historyOrders.map((order: any) => (
              <Card key={order.id} className="overflow-hidden">
                <div className="p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <Building2 className="w-5 h-5 text-slate-500 dark:text-slate-400" />
                      <div>
                        <h3 className="font-semibold text-gray-900 dark:text-white">
                          {order.order_number || `#${order.id?.slice(0, 8)}`}
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {order.customer_code} — {order.customer_name}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-500">
                          รับแล้วเมื่อ{' '}
                          {new Date(order.pickup_fulfilled_at || order.updated_at || order.created_at).toLocaleDateString('th-TH', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                      {order.branch && (
                        <span className="px-2 py-0.5 rounded-full text-xs bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400">
                          {order.branch}
                        </span>
                      )}
                    </div>
                    <span className="px-3 py-1 rounded-full text-sm font-medium bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300">
                      รับครบแล้ว
                    </span>
                  </div>
                  {order.pickup_items?.length > 0 && (
                    <div className="mt-3 pl-8 pt-3 border-t border-gray-100 dark:border-slate-700">
                      <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">รายการที่รับไป:</div>
                      <ul className="space-y-1 text-sm text-gray-700 dark:text-gray-300">
                        {order.pickup_items.map((item: any, idx: number) => (
                          <li key={idx} className="flex items-center gap-2">
                            • {item.product_code} — {item.product_name}: {item.quantity.toLocaleString('th-TH')} {item.unit}
                            {item.is_bonus && (
                              <span className="text-xs px-1.5 py-0.5 rounded bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300">
                                ของแถม
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )
      ) : grouped.length === 0 ? (
        <Card>
          <div className="p-12 text-center">
            <Package className="mx-auto mb-4 text-slate-400 dark:text-slate-500" size={48} />
            <p className="text-slate-600 dark:text-slate-400">ไม่มีรายการรอรับเอง</p>
            <p className="text-sm text-slate-500 dark:text-slate-500 mt-1">
              ออเดอร์ที่เลือกลูกค้ามารับเองจะแสดงที่นี่ เมื่อลูกค้ามารับแล้ว สามารถยืนยันรับได้
            </p>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {grouped.map((group) => (
            <Card key={group.orderId} className="overflow-hidden">
              <div className="p-4 md:p-6">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Building2 className="w-5 h-5 text-slate-500 dark:text-slate-400" />
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        {group.orderNumber || group.orderId.slice(0, 8)}
                      </h3>
                      {group.store.branch && (
                        <span className="px-2 py-0.5 text-xs rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400">
                          {group.store.branch}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {group.store.customer_code} — {group.store.customer_name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                      {new Date(group.orderDate).toLocaleDateString('th-TH', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePrintSlip(group)}
                      className="flex items-center gap-2"
                    >
                      <Printer size={16} />
                      พิมพ์ใบเบิก
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleConfirmReceived(group.orderId)}
                      disabled={confirmingOrderId === group.orderId}
                      className="flex items-center gap-2 bg-green-600 hover:bg-green-700 dark:bg-green-600 dark:hover:bg-green-700"
                    >
                      {confirmingOrderId === group.orderId ? (
                        <LoadingSpinner className="w-4 h-4" />
                      ) : (
                        <CircleCheck size={16} />
                      )}
                      ยืนยันลูกค้ามารับแล้ว
                    </Button>
                  </div>
                </div>

                <div className="mt-4 border-t border-slate-200 dark:border-slate-700 pt-4">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                        <th className="pb-2 font-medium">รหัสสินค้า</th>
                        <th className="pb-2 font-medium">ชื่อสินค้า</th>
                        <th className="pb-2 font-medium text-right">จำนวน</th>
                        <th className="pb-2 font-medium">หน่วย</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.items.map((item) => (
                        <tr
                          key={item.id}
                          className="border-b border-slate-100 dark:border-slate-800 last:border-0"
                        >
                          <td className="py-2 text-gray-900 dark:text-white">
                            {item.product.product_code}
                          </td>
                          <td className="py-2 text-gray-700 dark:text-gray-300">
                            {item.product.product_name}
                          </td>
                          <td className="py-2 text-right font-medium">
                            {item.quantity_remaining.toLocaleString()}
                          </td>
                          <td className="py-2 text-slate-500 dark:text-slate-400">
                            {item.product.unit}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </PageLayout>
  );
}
