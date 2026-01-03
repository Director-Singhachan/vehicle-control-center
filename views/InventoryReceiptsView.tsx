import React, { useEffect, useMemo, useState } from 'react';
import { Calendar, Package, Warehouse, FileText, Filter } from 'lucide-react';
import { PageLayout } from '../components/ui/PageLayout';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { Badge } from '../components/ui/Badge';
import { inventoryService } from '../services/inventoryService';
import { useProducts, useWarehouses } from '../hooks/useInventory';

export function InventoryReceiptsView() {
  const { products } = useProducts();
  const { warehouses } = useWarehouses();

  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split('T')[0]);
  const [warehouseId, setWarehouseId] = useState('');
  const [productId, setProductId] = useState('');
  const [search, setSearch] = useState('');

  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const txs = await inventoryService.getTransactions({
        warehouseId: warehouseId || undefined,
        productId: productId || undefined,
        startDate: dateFrom || undefined,
        endDate: dateTo || undefined,
      });
      // รับเฉพาะ in
      setData((txs || []).filter((t: any) => t.transaction_type === 'in'));
    } catch (err: any) {
      setError(err.message || 'เกิดข้อผิดพลาด');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const kw = search.toLowerCase();
    return data.filter((tx: any) => {
      if (kw) {
        const doc = (tx.ref_code || '').toLowerCase();
        const note = (tx.note || '').toLowerCase();
        const pCode = (tx.product?.product_code || '').toLowerCase();
        const pName = (tx.product?.product_name || '').toLowerCase();
        if (
          !doc.includes(kw) &&
          !note.includes(kw) &&
          !pCode.includes(kw) &&
          !pName.includes(kw)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [data, search]);

  const totalQty = useMemo(() => {
    return filtered.reduce((sum, tx) => sum + (Number(tx.quantity) || 0), 0);
  }, [filtered]);

  return (
    <PageLayout title="ประวัติรับสินค้าเข้า">
      <Card>
        <div className="p-4 grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">ตั้งแต่วันที่</label>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-gray-400 dark:text-gray-500" />
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">ถึงวันที่</label>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-gray-400 dark:text-gray-500" />
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">คลังสินค้า</label>
            <div className="flex items-center gap-2">
              <Warehouse className="w-4 h-4 text-gray-400 dark:text-gray-500" />
              <select
                value={warehouseId}
                onChange={(e) => setWarehouseId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
              >
                <option value="">ทุกคลัง</option>
                {warehouses.map((w: any) => (
                  <option key={w.id} value={w.id}>
                    {w.code} - {w.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">สินค้า</label>
            <div className="flex items-center gap-2">
              <Package className="w-4 h-4 text-gray-400 dark:text-gray-500" />
              <select
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
              >
                <option value="">ทุกสินค้า</option>
                {products.map((p: any) => (
                  <option key={p.id} value={p.id}>
                    {p.product_code} - {p.product_name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">คำค้น (ใบกำกับ/หมายเหตุ/สินค้า)</label>
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-400 dark:text-gray-500" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                placeholder="เช่น INV-2026 หรือ ชื่อสินค้า"
              />
            </div>
          </div>
          <div className="flex gap-2 md:justify-end">
            <Button variant="outline" onClick={() => fetchData()}>
              ค้นหา
            </Button>
          </div>
        </div>
      </Card>

      <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <div className="p-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">จำนวนรับเข้า (รายการแสดงผล)</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{filtered.length}</p>
          </div>
        </Card>
        <Card>
          <div className="p-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">จำนวนรวม</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{totalQty}</p>
          </div>
        </Card>
        <Card>
          <div className="p-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">สถานะข้อมูล</p>
            <p className="text-lg font-semibold text-green-600 dark:text-green-400">พร้อมใช้งาน</p>
          </div>
        </Card>
      </div>

      <Card className="mt-4">
        {loading ? (
          <div className="p-12 flex items-center justify-center">
            <LoadingSpinner />
          </div>
        ) : error ? (
          <div className="p-4 text-red-600 dark:text-red-400">{error}</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-gray-500 dark:text-gray-400">
            <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>ไม่พบรายการรับเข้า</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">วันที่</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">คลัง</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">สินค้า</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">จำนวน</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">หน่วย</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">ใบกำกับ/อ้างอิง</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">ผู้บันทึก</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">หมายเหตุ</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((tx) => (
                  <tr key={tx.id} className="border-b border-gray-100 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700/50">
                    <td className="py-3 px-4 text-sm text-gray-700 dark:text-gray-300">
                      {new Date(tx.created_at).toLocaleString('th-TH', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-700 dark:text-gray-300">
                      {tx.warehouse?.name || '-'}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-900 dark:text-white">
                      <div className="flex items-center gap-2">
                        <div>
                          <div className="font-medium">{tx.product?.product_name || '-'}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">{tx.product?.product_code || ''}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right font-semibold text-gray-900 dark:text-white">
                      {tx.quantity}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-700 dark:text-gray-300">
                      {tx.product?.unit || '-'}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-700 dark:text-gray-300">
                      {tx.ref_code ? (
                        <Badge variant="info">{tx.ref_code}</Badge>
                      ) : (
                        <span className="text-gray-400 dark:text-gray-500">-</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-700 dark:text-gray-300">
                      {tx.creator?.full_name || '-'}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-700 dark:text-gray-300">
                      {tx.note || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </PageLayout>
  );
}


