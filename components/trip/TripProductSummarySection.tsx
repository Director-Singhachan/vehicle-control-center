// TripProductSummarySection.tsx
// แสดงสรุปสินค้าในทริป — lazy load เมื่อ tripId เปลี่ยน
import React, { useState, useEffect } from 'react';
import { Package, RefreshCw } from 'lucide-react';
import { tripHistoryAggregatesService } from '../../services/deliveryTrip/tripHistoryAggregatesService';

interface TripProductSummarySectionProps {
  tripId: string;
  isDark?: boolean;
}

export const TripProductSummarySection: React.FC<TripProductSummarySectionProps> = ({
  tripId,
  isDark = false,
}) => {
  const [products, setProducts] = useState<Awaited<ReturnType<typeof tripHistoryAggregatesService.getAggregatedProducts>>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tripId) return;
    let cancelled = false;

    const fetchProducts = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await tripHistoryAggregatesService.getAggregatedProducts(tripId);
        if (!cancelled) setProducts(data);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'โหลดข้อมูลสินค้าไม่สำเร็จ');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchProducts();
    return () => { cancelled = true; };
  }, [tripId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6 text-slate-500 dark:text-slate-400 gap-2">
        <RefreshCw size={16} className="animate-spin" />
        <span>กำลังโหลดข้อมูลสินค้า...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-4 text-sm text-red-500 dark:text-red-400">{error}</div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-slate-500 dark:text-slate-400">
        <Package size={28} className="mb-2 text-slate-400 dark:text-slate-600" />
        <p className="text-sm">ไม่มีข้อมูลสินค้าในทริปนี้</p>
        <p className="text-xs text-slate-400 dark:text-slate-600 mt-1">
          (อาจเป็นทริปที่ไม่ใช่ delivery trip)
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60">
            <th className="text-left py-2 px-3 text-slate-700 dark:text-slate-300 font-medium">รหัสสินค้า</th>
            <th className="text-left py-2 px-3 text-slate-700 dark:text-slate-300 font-medium">ชื่อสินค้า</th>
            <th className="text-left py-2 px-3 text-slate-700 dark:text-slate-300 font-medium">หน่วย</th>
            <th className="text-right py-2 px-3 text-slate-700 dark:text-slate-300 font-medium">จำนวนรวม</th>
            <th className="text-right py-2 px-3 text-slate-700 dark:text-slate-300 font-medium">รับที่ร้าน</th>
            <th className="text-left py-2 px-3 text-slate-700 dark:text-slate-300 font-medium">หมวด</th>
          </tr>
        </thead>
        <tbody>
          {products.map((product) => (
            <tr
              key={`${product.product_id}-${product.is_bonus ? 'b' : 'n'}-${product.unit || ''}`}
              className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40"
            >
              <td className="py-2 px-3 text-slate-700 dark:text-slate-300 font-mono text-xs whitespace-nowrap">
                {product.product_code}
              </td>
              <td className="py-2 px-3 text-slate-900 dark:text-slate-100">
                {product.product_name}
              </td>
              <td className="py-2 px-3 text-slate-600 dark:text-slate-400 text-xs">
                {product.unit}
              </td>
              <td className="py-2 px-3 text-right text-slate-900 dark:text-slate-100 font-semibold">
                {product.total_quantity.toLocaleString('th-TH')}
              </td>
              <td className="py-2 px-3 text-right text-slate-600 dark:text-slate-400">
                {product.total_picked_up_at_store > 0
                  ? product.total_picked_up_at_store.toLocaleString('th-TH')
                  : '-'}
              </td>
              <td className="py-2 px-3 text-slate-500 dark:text-slate-400 text-xs">
                {product.category || '-'}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40">
            <td colSpan={3} className="py-2 px-3 text-slate-700 dark:text-slate-300 font-medium text-sm">
              รวม {products.length} รายการสินค้า
            </td>
            <td className="py-2 px-3 text-right text-slate-900 dark:text-slate-100 font-bold">
              {products.reduce((s, p) => s + p.total_quantity, 0).toLocaleString('th-TH')}
            </td>
            <td colSpan={2} />
          </tr>
        </tfoot>
      </table>
    </div>
  );
};
