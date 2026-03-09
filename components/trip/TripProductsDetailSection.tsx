import React from 'react';
import { Package, Store } from 'lucide-react';
import { Card, CardHeader } from '../ui/Card';
import type { PickupEntry } from '../../hooks/useDeliveryTripDetail';

interface TripProductsDetailSectionProps {
  aggregatedProducts: any[];
  pickupBreakdown: PickupEntry[];
}

export const TripProductsDetailSection: React.FC<TripProductsDetailSectionProps> = ({
  aggregatedProducts,
  pickupBreakdown,
}) => {
  const hasPickups = aggregatedProducts.some((p) => (p.total_picked_up_at_store ?? 0) > 0);
  const totalItems = aggregatedProducts.reduce(
    (sum, p) => sum + (Number(p.total_quantity) || 0),
    0,
  );

  return (
    <div className="space-y-4 animate-fade-in">
      <Card>
        <CardHeader
          title="สรุปสินค้าทั้งหมดในเที่ยว"
          subtitle={
            aggregatedProducts.length > 0
              ? `${aggregatedProducts.length} SKU · รวม ${totalItems.toLocaleString('th-TH', { maximumFractionDigits: 0 })} หน่วย`
              : undefined
          }
        />

        {/* Pickup alert */}
        {hasPickups && (
          <div className="mb-4 flex items-start gap-3 p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
            <Store className="flex-shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" size={18} />
            <div>
              <p className="font-semibold text-amber-800 dark:text-amber-200 text-sm">
                มีลูกค้ามารับสินค้าที่หน้าร้านแล้ว
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
                จำนวนด้านล่างคือ <strong>จำนวนที่ต้องจัดส่งจริง</strong>{' '}
                (ยอดสั่งลบส่วนที่รับที่ร้านแล้ว)
              </p>
            </div>
          </div>
        )}

        {aggregatedProducts.length === 0 ? (
          <div className="py-10 text-center">
            <Package size={36} className="mx-auto mb-3 text-slate-300 dark:text-slate-600" />
            <p className="text-sm text-slate-400 dark:text-slate-500">ยังไม่มีสินค้าในเที่ยวนี้</p>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  <th className="text-left px-6 py-2.5 text-xs font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap">
                    สินค้า
                  </th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap">
                    รวมทั้งหมด
                  </th>
                  {hasPickups && (
                    <th className="text-right px-4 py-2.5 text-xs font-semibold text-amber-600 dark:text-amber-400 whitespace-nowrap">
                      รับที่ร้าน
                    </th>
                  )}
                  <th className="text-right px-6 py-2.5 text-xs font-semibold text-enterprise-600 dark:text-enterprise-400 whitespace-nowrap">
                    ต้องจัดส่ง
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {aggregatedProducts.map((product: any) => {
                  const total = Number(product.total_quantity) || 0;
                  const pickedUp = Number(product.total_picked_up_at_store) || 0;
                  const toDeliver = total - pickedUp;

                  return (
                    <tr
                      key={product.product_id}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors"
                    >
                      <td className="px-6 py-3">
                        <div className="font-medium text-slate-900 dark:text-slate-100">
                          {product.product_name}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          {product.product_code}
                          {product.category && ` · ${product.category}`}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-300 font-medium whitespace-nowrap">
                        {total.toLocaleString('th-TH', { maximumFractionDigits: 2 })} {product.unit}
                      </td>
                      {hasPickups && (
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          {pickedUp > 0 ? (
                            <span className="text-amber-600 dark:text-amber-400 font-medium">
                              -{pickedUp.toLocaleString('th-TH', { maximumFractionDigits: 2 })}{' '}
                              {product.unit}
                            </span>
                          ) : (
                            <span className="text-slate-300 dark:text-slate-600">—</span>
                          )}
                        </td>
                      )}
                      <td className="px-6 py-3 text-right whitespace-nowrap">
                        <span className="font-bold text-enterprise-600 dark:text-enterprise-400">
                          {toDeliver.toLocaleString('th-TH', { maximumFractionDigits: 2 })}{' '}
                          {product.unit}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/30">
                  <td className="px-6 py-3 font-semibold text-slate-700 dark:text-slate-300 text-xs">
                    รวม {aggregatedProducts.length} SKU
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-700 dark:text-slate-300 text-xs whitespace-nowrap">
                    {totalItems.toLocaleString('th-TH', { maximumFractionDigits: 0 })} หน่วย
                  </td>
                  {hasPickups && <td />}
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};
