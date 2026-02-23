import React from 'react';
import { Box, Package, X } from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';

export interface AggregatedProduct {
  product_id: string;
  product_name: string;
  product_code: string;
  unit: string;
  total_quantity: number;
}

export interface ProductsSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  aggregatedProducts: AggregatedProduct[];
  selectedCount: number;
  selectedTotal: number;
  onCreateTrip: () => void;
}

export function ProductsSummaryModal({
  isOpen,
  onClose,
  aggregatedProducts,
  selectedCount,
  selectedTotal,
  onCreateTrip,
}: ProductsSummaryModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <Card className="max-w-4xl w-full max-h-[80vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-purple-600 to-purple-700 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <Box className="w-6 h-6" />
                สรุปสินค้ารวมทั้งหมด
              </h2>
              <p className="text-sm text-purple-100 mt-1">จาก {selectedCount} ออเดอร์ที่เลือก</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
              aria-label="ปิด"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {aggregatedProducts.length === 0 ? (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              <Package className="w-16 h-16 mx-auto mb-4 opacity-30" />
              <p>ไม่มีรายการสินค้า</p>
            </div>
          ) : (
            <div>
              {/* Summary Stats */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-purple-50 rounded-lg p-4 text-center">
                  <div className="text-sm text-purple-600 mb-1">รายการสินค้า</div>
                  <div className="text-3xl font-bold text-purple-900">{aggregatedProducts.length}</div>
                </div>
                <div className="bg-blue-50 rounded-lg p-4 text-center">
                  <div className="text-sm text-blue-600 mb-1">จำนวนรวม</div>
                  <div className="text-3xl font-bold text-blue-900">
                    {aggregatedProducts.reduce((sum, p) => sum + p.total_quantity, 0).toLocaleString()}
                  </div>
                </div>
                <div className="bg-green-50 rounded-lg p-4 text-center">
                  <div className="text-sm text-green-600 mb-1">มูลค่ารวม</div>
                  <div className="text-3xl font-bold text-green-900">฿{selectedTotal.toLocaleString()}</div>
                </div>
              </div>

              {/* Products Table */}
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-purple-600 text-white sticky top-0">
                    <tr>
                      <th className="text-left py-3 px-4 font-semibold">#</th>
                      <th className="text-left py-3 px-4 font-semibold">รหัสสินค้า</th>
                      <th className="text-left py-3 px-4 font-semibold">ชื่อสินค้า</th>
                      <th className="text-right py-3 px-4 font-semibold">จำนวนรวม</th>
                      <th className="text-center py-3 px-4 font-semibold">หน่วย</th>
                    </tr>
                  </thead>
                  <tbody>
                    {aggregatedProducts.map((product, index) => (
                      <tr
                        key={product.product_id}
                        className="border-b border-gray-200 dark:border-gray-700 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors"
                      >
                        <td className="py-3 px-4 text-gray-500 dark:text-gray-400 text-sm">{index + 1}</td>
                        <td className="py-3 px-4">
                          <div className="font-mono text-sm text-gray-600 dark:text-gray-400">
                            {product.product_code}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-medium text-gray-900 dark:text-gray-100">{product.product_name}</div>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="font-bold text-xl text-purple-700 dark:text-purple-400">
                            {product.total_quantity.toLocaleString()}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <Badge variant="default">{product.unit}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Helpful Tip */}
              <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <div className="text-2xl">💡</div>
                  <div className="flex-1">
                    <div className="font-semibold text-yellow-900 mb-1">คำแนะนำในการเลือกรถ</div>
                    <div className="text-sm text-yellow-800">
                      ใช้ข้อมูลสรุปนี้ประกอบการพิจารณาเลือกรถที่มีพื้นที่เหมาะสมสำหรับจำนวนสินค้าในทริปนี้
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              ปิด
            </Button>
            <Button onClick={onCreateTrip}>ดำเนินการสร้างทริป</Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
