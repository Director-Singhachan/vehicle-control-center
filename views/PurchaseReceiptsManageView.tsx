import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ClipboardList, Package, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { PageLayout } from '../components/ui/PageLayout';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge, type BadgeVariant } from '../components/ui/Badge';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { ToastContainer } from '../components/ui/Toast';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { useAuth, useToast } from '../hooks';
import { useFeatureAccess } from '../hooks/useFeatureAccess';
import { useProducts, useWarehouses } from '../hooks/useInventory';
import { purchaseReceiptService } from '../services/purchaseReceiptService';
import type { Database } from '../types/database';

type PurchaseReceipt = Database['public']['Tables']['purchase_receipts']['Row'];

const emptyLine = () => ({
  product_id: '',
  product_query: '',
  quantity: '' as string | number,
  unit_cost: '' as string | number,
  unit: '' as string,
});

export function PurchaseReceiptsManageView() {
  const { profile } = useAuth();
  const { toasts, dismissToast, success, error } = useToast();
  const { can } = useFeatureAccess();
  const { products, loading: productsLoading } = useProducts();
  const { warehouses, loading: whLoading } = useWarehouses();

  const canEdit = can('tab.purchase_receipts', 'edit');

  const [tab, setTab] = useState<'receipts' | 'avg'>('receipts');
  const [list, setList] = useState<PurchaseReceipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [whFilter, setWhFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [receiptDate, setReceiptDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [warehouseId, setWarehouseId] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [invoiceRef, setInvoiceRef] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState([emptyLine()]);
  const [submitting, setSubmitting] = useState(false);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detailItems, setDetailItems] = useState<any[] | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [avgRows, setAvgRows] = useState<any[]>([]);
  const [avgLoading, setAvgLoading] = useState(false);

  const [postId, setPostId] = useState<string | null>(null);
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [openProductPickerLine, setOpenProductPickerLine] = useState<number | null>(null);
  const productPickerRowRefs = useRef<(HTMLDivElement | null)[]>([]);

  const filteredProductsForPicker = useCallback(
    (query: string) => {
      const q = query.trim().toLowerCase();
      const list = products || [];
      if (!q) return list.slice(0, 100);
      return list
        .filter(
          (p: any) =>
            String(p.product_code || '')
              .toLowerCase()
              .includes(q) ||
            String(p.product_name || '')
              .toLowerCase()
              .includes(q),
        )
        .slice(0, 100);
    },
    [products],
  );

  useEffect(() => {
    if (openProductPickerLine === null) return;
    const el = productPickerRowRefs.current[openProductPickerLine];
    if (!el) return;
    const handler = (e: MouseEvent) => {
      if (!el.contains(e.target as Node)) {
        setOpenProductPickerLine(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [openProductPickerLine]);

  const whName = useMemo(() => {
    const m = new Map((warehouses || []).map((w: any) => [w.id, `${w.code ?? ''} ${w.name ?? ''}`.trim()]));
    return (id: string) => m.get(id) ?? id.slice(0, 8);
  }, [warehouses]);

  const productLabel = useMemo(() => {
    const m = new Map((products || []).map((p: any) => [p.id, `${p.product_code} — ${p.product_name}`]));
    return (id: string) => m.get(id) ?? id.slice(0, 8);
  }, [products]);

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const data = await purchaseReceiptService.list({
        warehouseId: whFilter || undefined,
        status: statusFilter || undefined,
        limit: 300,
      });
      setList(data);
    } catch (e: any) {
      error(e.message || 'โหลดรายการไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }, [whFilter, statusFilter, error]);

  const loadAvg = useCallback(async () => {
    setAvgLoading(true);
    try {
      const data = await purchaseReceiptService.listMovingAvgCosts({
        warehouseId: whFilter || undefined,
      });
      setAvgRows(data);
    } catch (e: any) {
      error(e.message || 'โหลดต้นทุนเฉลี่ยไม่สำเร็จ');
    } finally {
      setAvgLoading(false);
    }
  }, [whFilter, error]);

  useEffect(() => {
    if (tab === 'receipts') loadList();
    else loadAvg();
  }, [tab, loadList, loadAvg]);

  const toggleExpand = async (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
      setDetailItems(null);
      return;
    }
    setExpandedId(id);
    setDetailLoading(true);
    setDetailItems(null);
    try {
      const { items } = await purchaseReceiptService.getWithItems(id);
      setDetailItems(items as any[]);
    } catch (e: any) {
      error(e.message || 'โหลดรายละเอียดไม่สำเร็จ');
    } finally {
      setDetailLoading(false);
    }
  };

  const addLine = () => setLines((prev) => [...prev, emptyLine()]);
  const removeLine = (i: number) => setLines((prev) => prev.filter((_, idx) => idx !== i));
  const updateLine = (i: number, patch: Partial<(typeof lines)[0]>) => {
    setLines((prev) => prev.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  };

  const handleCreateDraft = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.id) {
      error('ต้องเข้าสู่ระบบ');
      return;
    }
    if (!warehouseId) {
      error('เลือกคลัง');
      return;
    }
    const parsed = lines
      .filter((l) => l.product_id)
      .map((l) => ({
        product_id: l.product_id,
        quantity: Number(l.quantity) || 0,
        unit_cost: Number(l.unit_cost) || 0,
        unit: l.unit?.trim() ? l.unit.trim() : null,
      }))
      .filter((l) => l.quantity > 0 && l.unit_cost >= 0);

    if (!parsed.length) {
      error('ระบุรายการสินค้า จำนวน และราคาทุน');
      return;
    }

    setSubmitting(true);
    try {
      await purchaseReceiptService.createDraft({
        receipt_date: receiptDate,
        warehouse_id: warehouseId,
        supplier_name: supplierName.trim() || null,
        invoice_ref: invoiceRef.trim() || null,
        notes: notes.trim() || null,
        created_by: profile.id,
        lines: parsed,
      });
      success('บันทึกร่างแล้ว — เมื่อตรวจสอบครบให้กด「ยืนยันรับเข้า」');
      setLines([emptyLine()]);
      setSupplierName('');
      setInvoiceRef('');
      setNotes('');
      await loadList();
    } catch (e: any) {
      error(e.message || 'บันทึกไม่สำเร็จ');
    } finally {
      setSubmitting(false);
    }
  };

  const statusBadge = (s: string) => {
    const v: BadgeVariant = s === 'posted' ? 'success' : s === 'cancelled' ? 'default' : 'warning';
    const label = s === 'posted' ? 'รับเข้าแล้ว' : s === 'cancelled' ? 'ยกเลิก' : 'ร่าง';
    return <Badge variant={v}>{label}</Badge>;
  };

  const confirmPost = async () => {
    if (!postId) return;
    const id = postId;
    setPostId(null);
    try {
      await purchaseReceiptService.postReceipt(id);
      success('รับเข้าระบบแล้ว — อัปเดตต้นทุนเฉลี่ย (ไม่ตัดสต็อก)');
      setExpandedId(null);
      setDetailItems(null);
      await loadList();
      if (tab === 'avg') await loadAvg();
    } catch (e: any) {
      error(e.message || 'ยืนยันรับเข้าไม่สำเร็จ');
    }
  };

  const confirmCancel = async () => {
    if (!cancelId) return;
    const id = cancelId;
    setCancelId(null);
    try {
      await purchaseReceiptService.cancelDraft(id);
      success('ยกเลิกใบร่างแล้ว');
      setExpandedId(null);
      setDetailItems(null);
      await loadList();
    } catch (e: any) {
      error(e.message || 'ยกเลิกไม่สำเร็จ');
    }
  };

  return (
    <PageLayout title="บันทึกต้นทุนจัดซื้อ">
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <div className="flex gap-2 mb-6">
        <Button
          variant={tab === 'receipts' ? 'primary' : 'outline'}
          onClick={() => setTab('receipts')}
          className="dark:border-slate-600"
        >
          <ClipboardList className="w-4 h-4 mr-2" />
          ใบรับสินค้า
        </Button>
        <Button
          variant={tab === 'avg' ? 'primary' : 'outline'}
          onClick={() => setTab('avg')}
          className="dark:border-slate-600"
        >
          <Package className="w-4 h-4 mr-2" />
          สรุปต้นทุนเฉลี่ย
        </Button>
      </div>

      {tab === 'receipts' && (
        <>
          {canEdit && (
            <Card className="mb-6 p-4 md:p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">บันทึกใบรับร่าง</h2>
              <form onSubmit={handleCreateDraft} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">วันที่รับสินค้า</label>
                    <input
                      type="date"
                      value={receiptDate}
                      onChange={(e) => setReceiptDate(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">คลัง</label>
                    <select
                      value={warehouseId}
                      onChange={(e) => setWarehouseId(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                      disabled={whLoading}
                    >
                      <option value="">เลือกคลัง</option>
                      {(warehouses || []).map((w: any) => (
                        <option key={w.id} value={w.id}>
                          {w.code} — {w.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">เลขที่ใบกำกับ/อ้างอิง</label>
                    <input
                      value={invoiceRef}
                      onChange={(e) => setInvoiceRef(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                      placeholder="INV-..."
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">ผู้ขาย</label>
                    <input
                      value={supplierName}
                      onChange={(e) => setSupplierName(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">หมายเหตุ</label>
                    <input
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                    />
                  </div>
                </div>

                <div className="border border-gray-200 dark:border-slate-700 rounded-lg overflow-hidden">
                  <div className="bg-slate-50 dark:bg-slate-800/80 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                    รายการสินค้า
                  </div>
                  <div className="divide-y divide-gray-100 dark:divide-slate-800">
                    {lines.map((line, i) => (
                      <div key={i} className="p-3 grid grid-cols-1 md:grid-cols-12 gap-2 items-end">
                        <div
                          ref={(el) => {
                            productPickerRowRefs.current[i] = el;
                          }}
                          className={`md:col-span-5 relative ${openProductPickerLine === i ? 'z-50' : ''}`}
                        >
                          <label className="text-xs text-gray-500 dark:text-gray-400">สินค้า (พิมพ์ค้นหา)</label>
                          <input
                            type="text"
                            value={line.product_query}
                            onChange={(e) => {
                              const v = e.target.value;
                              updateLine(i, {
                                product_query: v,
                                product_id: '',
                                unit: '',
                              });
                              setOpenProductPickerLine(i);
                            }}
                            onFocus={() => setOpenProductPickerLine(i)}
                            placeholder="รหัสหรือชื่อสินค้า..."
                            disabled={productsLoading}
                            className="w-full px-2 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-sm placeholder-gray-400 dark:placeholder-gray-500"
                          />
                          {openProductPickerLine === i && !productsLoading && (
                            <ul className="absolute left-0 right-0 mt-1 max-h-48 overflow-y-auto rounded-lg border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-900 shadow-lg dark:shadow-black/40 z-[60]">
                              {filteredProductsForPicker(line.product_query).length === 0 ? (
                                <li className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">ไม่พบสินค้า</li>
                              ) : (
                                filteredProductsForPicker(line.product_query).map((p: any) => (
                                  <li key={p.id}>
                                    <button
                                      type="button"
                                      className="w-full text-left px-3 py-2 text-sm text-gray-900 dark:text-white hover:bg-enterprise-50 dark:hover:bg-slate-800"
                                      onClick={() => {
                                        updateLine(i, {
                                          product_id: p.id,
                                          product_query: `${p.product_code} — ${p.product_name}`,
                                          unit: p.unit ? String(p.unit) : '',
                                        });
                                        setOpenProductPickerLine(null);
                                      }}
                                    >
                                      <span className="font-mono text-xs text-enterprise-600 dark:text-enterprise-400">{p.product_code}</span>
                                      <span className="mx-1 text-gray-400">·</span>
                                      {p.product_name}
                                    </button>
                                  </li>
                                ))
                              )}
                            </ul>
                          )}
                        </div>
                        <div className="md:col-span-2">
                          <label className="text-xs text-gray-500 dark:text-gray-400">จำนวน</label>
                          <input
                            value={line.quantity === '' ? '' : line.quantity}
                            onChange={(e) => updateLine(i, { quantity: e.target.value })}
                            className="w-full px-2 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-sm"
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label className="text-xs text-gray-500 dark:text-gray-400">ราคาทุน/หน่วย</label>
                          <input
                            value={line.unit_cost === '' ? '' : line.unit_cost}
                            onChange={(e) => updateLine(i, { unit_cost: e.target.value })}
                            className="w-full px-2 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-sm"
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label className="text-xs text-gray-500 dark:text-gray-400">หน่วย (ถ้ามี)</label>
                          <input
                            value={line.unit}
                            onChange={(e) => updateLine(i, { unit: e.target.value })}
                            className="w-full px-2 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-sm"
                          />
                        </div>
                        <div className="md:col-span-1 flex justify-end pb-2">
                          {lines.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeLine(i)}
                              className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                              aria-label="ลบแถว"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="p-2 border-t border-gray-100 dark:border-slate-800">
                    <Button type="button" variant="outline" onClick={addLine} className="dark:border-slate-600">
                      <Plus className="w-4 h-4 mr-2" />
                      เพิ่มแถว
                    </Button>
                  </div>
                </div>

                <Button type="submit" disabled={submitting || whLoading || productsLoading}>
                  {submitting ? 'กำลังบันทึก...' : 'บันทึกใบร่าง'}
                </Button>
              </form>
            </Card>
          )}

          <Card className="p-4 md:p-6">
            <div className="flex flex-wrap gap-4 items-end justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">รายการใบรับสินค้า</h2>
              <Button variant="outline" onClick={loadList} className="dark:border-slate-600">
                <RefreshCw className="w-4 h-4 mr-2" />
                รีเฟรช
              </Button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">คลัง</label>
                <select
                  value={whFilter}
                  onChange={(e) => setWhFilter(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-sm"
                >
                  <option value="">ทุกคลัง</option>
                  {(warehouses || []).map((w: any) => (
                    <option key={w.id} value={w.id}>
                      {w.code}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">สถานะ</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-sm"
                >
                  <option value="">ทั้งหมด</option>
                  <option value="draft">ร่าง</option>
                  <option value="posted">รับเข้าแล้ว</option>
                  <option value="cancelled">ยกเลิก</option>
                </select>
              </div>
            </div>

            {loading ? (
              <LoadingSpinner />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-slate-700 text-gray-600 dark:text-gray-400">
                      <th className="py-2 pr-2">วันที่</th>
                      <th className="py-2 pr-2">คลัง</th>
                      <th className="py-2 pr-2">อ้างอิง</th>
                      <th className="py-2 pr-2">สถานะ</th>
                      <th className="py-2">การทำงาน</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((r) => (
                      <React.Fragment key={r.id}>
                        <tr className="border-b border-gray-100 dark:border-slate-800 hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                          <td className="py-2 pr-2 text-gray-900 dark:text-white">{r.receipt_date}</td>
                          <td className="py-2 pr-2 text-gray-700 dark:text-gray-300">{whName(r.warehouse_id)}</td>
                          <td className="py-2 pr-2 text-gray-700 dark:text-gray-300">{r.invoice_ref || '—'}</td>
                          <td className="py-2 pr-2">{statusBadge(r.status)}</td>
                          <td className="py-2">
                            <div className="flex flex-wrap gap-2">
                              <Button variant="outline" className="text-xs py-1 px-2 dark:border-slate-600" onClick={() => toggleExpand(r.id)}>
                                {expandedId === r.id ? 'พับ' : 'รายละเอียด'}
                              </Button>
                              {canEdit && r.status === 'draft' && (
                                <>
                                  <Button variant="primary" className="text-xs py-1 px-2" onClick={() => setPostId(r.id)}>
                                    ยืนยันรับเข้า
                                  </Button>
                                  <Button variant="outline" className="text-xs py-1 px-2 dark:border-slate-600" onClick={() => setCancelId(r.id)}>
                                    ยกเลิกใบร่าง
                                  </Button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                        {expandedId === r.id && (
                          <tr>
                            <td colSpan={5} className="pb-4 pt-0 bg-slate-50/50 dark:bg-slate-900/40 px-2">
                              {detailLoading ? (
                                <LoadingSpinner />
                              ) : detailItems ? (
                                <ul className="text-sm space-y-1 text-gray-800 dark:text-gray-200">
                                  {detailItems.map((it: any) => (
                                    <li key={it.id}>
                                      {productLabel(it.product_id)} × {it.quantity} @ {Number(it.unit_cost).toLocaleString()} ={' '}
                                      {Number(it.line_total).toLocaleString()} บาท
                                    </li>
                                  ))}
                                </ul>
                              ) : null}
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
                {!list.length && (
                  <p className="text-gray-500 dark:text-gray-400 text-sm py-6 text-center">ยังไม่มีข้อมูล</p>
                )}
              </div>
            )}
          </Card>
        </>
      )}

      {tab === 'avg' && (
        <Card className="p-4 md:p-6">
          <div className="flex flex-wrap gap-4 items-end justify-between mb-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              ต้นทุนเฉลี่ยคำนวณจากใบรับที่ยืนยันรับเข้าแล้ว — ปริมาณฐานใช้สำหรับคิดค่าเฉลี่ยเคลื่อนที่ ไม่ใช่ยอดสต็อกจริง
            </p>
            <Button variant="outline" onClick={loadAvg} className="dark:border-slate-600">
              <RefreshCw className="w-4 h-4 mr-2" />
              รีเฟรช
            </Button>
          </div>
          <div className="mb-4 max-w-xs">
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">กรองคลัง</label>
            <select
              value={whFilter}
              onChange={(e) => setWhFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-sm"
            >
              <option value="">ทุกคลัง</option>
              {(warehouses || []).map((w: any) => (
                <option key={w.id} value={w.id}>
                  {w.code}
                </option>
              ))}
            </select>
          </div>
          {avgLoading ? (
            <LoadingSpinner />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-slate-700 text-gray-600 dark:text-gray-400">
                    <th className="py-2 pr-2">คลัง</th>
                    <th className="py-2 pr-2">สินค้า</th>
                    <th className="py-2 pr-2 text-right">ต้นทุนเฉลี่ย/หน่วย</th>
                    <th className="py-2 pr-2 text-right">ปริมาณฐาน (เฉลี่ย)</th>
                  </tr>
                </thead>
                <tbody>
                  {avgRows.map((row) => (
                    <tr key={`${row.warehouse_id}-${row.product_id}`} className="border-b border-gray-100 dark:border-slate-800">
                      <td className="py-2 pr-2 text-gray-900 dark:text-white">{whName(row.warehouse_id)}</td>
                      <td className="py-2 pr-2 text-gray-700 dark:text-gray-300">{productLabel(row.product_id)}</td>
                      <td className="py-2 pr-2 text-right tabular-nums">{Number(row.avg_unit_cost).toLocaleString()}</td>
                      <td className="py-2 pr-2 text-right tabular-nums">{Number(row.basis_qty).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!avgRows.length && (
                <p className="text-gray-500 dark:text-gray-400 text-sm py-6 text-center">ยังไม่มีต้นทุนเฉลี่ย — ยืนยันรับเข้าใบรับสินค้าก่อน</p>
              )}
            </div>
          )}
        </Card>
      )}

      <ConfirmDialog
        isOpen={!!postId}
        title="ยืนยันรับเข้าระบบ?"
        message="ระบบจะนำรายการนี้ไปคำนวณต้นทุนเฉลี่ยต่อสินค้าในคลังนี้ (ไม่ตัดสต็อก)"
        confirmText="ยืนยันรับเข้า"
        variant="warning"
        onConfirm={confirmPost}
        onCancel={() => setPostId(null)}
      />
      <ConfirmDialog
        isOpen={!!cancelId}
        title="ยกเลิกใบร่าง?"
        message="ใบนี้จะถูกทำเครื่องหมายว่ายกเลิก และแก้ไขไม่ได้อีก"
        confirmText="ยกเลิกใบ"
        variant="warning"
        onConfirm={confirmCancel}
        onCancel={() => setCancelId(null)}
      />
    </PageLayout>
  );
}
