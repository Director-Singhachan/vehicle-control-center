// TripItemsSection — สรุปสินค้าทั้งหมดในเที่ยว (aggregated products table)
import React from 'react';
import { Package } from 'lucide-react';
import { Card } from '../ui/Card';

export interface AggregatedProductRow {
  product_id: string;
  product_code: string;
  product_name: string;
  category: string;
  unit: string;
  total_quantity: number;
  stores: Array<{ store_id: string; customer_name: string; quantity: number }>;
}

export interface TripItemsSectionProps {
  aggregatedProducts: AggregatedProductRow[];
}

export const TripItemsSection: React.FC<TripItemsSectionProps> = ({ aggregatedProducts }) => {
  if (aggregatedProducts.length === 0) return null;

  return (
    <Card>
      <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
        <Package size={20} />
        สรุปสินค้าทั้งหมดในเที่ยว
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700">
              <th className="text-left py-2 px-3 text-sm font-medium text-slate-700 dark:text-slate-300">รหัสสินค้า</th>
              <th className="text-left py-2 px-3 text-sm font-medium text-slate-700 dark:text-slate-300">ชื่อสินค้า</th>
              <th className="text-left py-2 px-3 text-sm font-medium text-slate-700 dark:text-slate-300">หมวดหมู่</th>
              <th className="text-right py-2 px-3 text-sm font-medium text-slate-700 dark:text-slate-300">จำนวนรวม</th>
              <th className="text-left py-2 px-3 text-sm font-medium text-slate-700 dark:text-slate-300">ร้านค้า</th>
            </tr>
          </thead>
          <tbody>
            {aggregatedProducts.map((product) => (
              <tr key={product.product_id} className="border-b border-slate-100 dark:border-slate-800">
                <td className="py-2 px-3 text-sm text-slate-900 dark:text-slate-100">{product.product_code}</td>
                <td className="py-2 px-3 text-sm text-slate-900 dark:text-slate-100">{product.product_name}</td>
                <td className="py-2 px-3 text-sm text-slate-500 dark:text-slate-400">{product.category}</td>
                <td className="py-2 px-3 text-sm text-right font-medium text-slate-900 dark:text-slate-100">
                  {product.total_quantity.toLocaleString()} {product.unit}
                </td>
                <td className="py-2 px-3 text-sm text-slate-500 dark:text-slate-400">
                  {product.stores.map(s => `${s.customer_name} (${s.quantity})`).join(', ')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
};
