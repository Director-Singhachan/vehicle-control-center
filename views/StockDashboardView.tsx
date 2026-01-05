import React, { useMemo } from 'react';
import { Package, Warehouse, AlertTriangle, TrendingUp, DollarSign, Box } from 'lucide-react';
import { useInventory, useWarehouses, useInventoryStats, useLowStockItems } from '../hooks/useInventory';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { PageLayout } from '../components/ui/PageLayout';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';

export function StockDashboardView() {
  const { stats, loading: statsLoading } = useInventoryStats();
  const { lowStock, loading: lowStockLoading } = useLowStockItems();
  const { warehouses, loading: warehousesLoading } = useWarehouses();
  const { inventory, loading: inventoryLoading } = useInventory();

  // จัดกลุ่มสต็อกตามคลัง
  const stockByWarehouse = useMemo(() => {
    const grouped = inventory.reduce((acc, item) => {
      if (!acc[item.warehouse_id]) {
        acc[item.warehouse_id] = {
          warehouse_code: item.warehouse_code,
          warehouse_name: item.warehouse_name,
          warehouse_type: item.warehouse_type,
          totalValue: 0,
          itemCount: 0,
        };
      }
      const price = item.base_price ?? item.price_per_unit ?? 0;
      acc[item.warehouse_id].totalValue += item.quantity * price;
      acc[item.warehouse_id].itemCount += 1;
      return acc;
    }, {} as Record<string, any>);

    return Object.values(grouped);
  }, [inventory]);

  const safeValue = (val: number | null | undefined) => (isFinite(val || 0) ? val || 0 : 0);

  // สินค้าที่มีการเคลื่อนไหวสูง (ตัวอย่าง - ควรดึงจากข้อมูลจริง)
  const topProducts = useMemo(() => {
    return inventory
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);
  }, [inventory]);

  const loading = statsLoading || lowStockLoading || warehousesLoading || inventoryLoading;

  if (loading) {
    return (
      <PageLayout title="แดชบอร์ดคลังสินค้า">
        <div className="flex items-center justify-center h-64">
          <LoadingSpinner />
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout title="แดชบอร์ดคลังสินค้า">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {/* Total Products */}
        <Card className="relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-500/10 to-transparent rounded-bl-full" />
          <div className="relative p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
                <Package className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <TrendingUp className="w-5 h-5 text-green-500" />
            </div>
            <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">รายการสินค้า</h3>
            <p className="text-3xl font-bold text-gray-900 dark:text-white">{stats.totalProducts}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">รายการทั้งหมด</p>
          </div>
        </Card>

        {/* Total Value */}
        <Card className="relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-green-500/10 to-transparent rounded-bl-full" />
          <div className="relative p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-xl">
                <DollarSign className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
            </div>
            <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">มูลค่าสต็อก</h3>
            <p className="text-3xl font-bold text-gray-900 dark:text-white">
              {new Intl.NumberFormat('th-TH', {
                style: 'currency',
                currency: 'THB',
                maximumFractionDigits: 0,
              }).format(stats.totalValue)}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">มูลค่าทั้งหมด</p>
          </div>
        </Card>

        {/* Warehouses */}
        <Card className="relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-purple-500/10 to-transparent rounded-bl-full" />
          <div className="relative p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-xl">
                <Warehouse className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
            </div>
            <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">คลังสินค้า</h3>
            <p className="text-3xl font-bold text-gray-900 dark:text-white">{stats.warehouses}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">คลังที่ใช้งาน</p>
          </div>
        </Card>

        {/* Low Stock Alerts */}
        <Card className="relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-amber-500/10 to-transparent rounded-bl-full" />
          <div className="relative p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-amber-100 dark:bg-amber-900/30 rounded-xl">
                <AlertTriangle className="w-6 h-6 text-amber-600 dark:text-amber-400" />
              </div>
            </div>
            <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">แจ้งเตือนสต็อก</h3>
            <div className="flex items-baseline gap-2">
              <p className="text-3xl font-bold text-gray-900 dark:text-white">{stats.lowStockCount}</p>
              {stats.outOfStockCount > 0 && (
                <span className="text-sm text-red-600 dark:text-red-400 font-medium">
                  ({stats.outOfStockCount} หมด)
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">สต็อกต่ำ</p>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Stock by Warehouse */}
        <Card>
          <div className="p-6 border-b border-gray-200 dark:border-slate-700">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <Warehouse className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">สต็อกตามคลัง</h2>
            </div>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {stockByWarehouse.map((warehouse: any) => (
                <div key={warehouse.warehouse_code} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-slate-800/50 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-700/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white dark:bg-slate-900 rounded-lg shadow-sm">
                      <Box className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{warehouse.warehouse_name}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{warehouse.warehouse_code}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-gray-900 dark:text-white">
                      {new Intl.NumberFormat('th-TH').format(warehouse.totalValue)} ฿
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{warehouse.itemCount} รายการ</p>
                  </div>
                </div>
              ))}
              {stockByWarehouse.length === 0 && (
                <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                  <Warehouse className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>ไม่มีข้อมูลสต็อก</p>
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* Low Stock Alerts */}
        <Card>
          <div className="p-6 border-b border-gray-200 dark:border-slate-700">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">แจ้งเตือนสต็อกต่ำ</h2>
            </div>
          </div>
          <div className="p-6">
            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {lowStock.map((item) => (
                <div key={item.id} className="flex items-center justify-between p-3 bg-gradient-to-r from-amber-50 dark:from-amber-900/20 to-white dark:to-transparent rounded-xl border border-amber-100 dark:border-amber-800">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-medium text-gray-900 dark:text-white">{item.product_name}</p>
                      <Badge variant={item.stock_status === 'out_of_stock' ? 'error' : 'warning'}>
                        {item.stock_status === 'out_of_stock' ? 'หมด' : 'ต่ำ'}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{item.warehouse_name}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-amber-600 dark:text-amber-400">
                      {item.available_quantity}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">คงเหลือ</p>
                  </div>
                </div>
              ))}
              {lowStock.length === 0 && (
                <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                  <AlertTriangle className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>ไม่มีแจ้งเตือนสต็อกต่ำ</p>
                  <p className="text-sm mt-1">สต็อกทุกรายการอยู่ในระดับปกติ</p>
                </div>
              )}
            </div>
          </div>
        </Card>
      </div>

      {/* Top Products */}
      <Card>
        <div className="p-6 border-b border-gray-200 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <Package className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">สินค้าสต็อกสูงสุด</h2>
          </div>
        </div>
        <div className="p-6">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-slate-700">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">สินค้า</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">SKU</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">คลัง</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">คงเหลือ</th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">มูลค่า</th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">สถานะ</th>
                </tr>
              </thead>
              <tbody>
                {topProducts.map((item) => (
                  <tr key={item.id} className="border-b border-gray-100 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-3">
                        {item.category_color && (
                          <div 
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: item.category_color }}
                          />
                        )}
                        <span className="font-medium text-gray-900 dark:text-white">{item.product_name}</span>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-sm text-gray-600 dark:text-gray-400">{item.product_sku}</td>
                    <td className="py-4 px-4 text-sm text-gray-600 dark:text-gray-400">{item.warehouse_name}</td>
                    <td className="py-4 px-4 text-right">
                      <span className="font-semibold text-gray-900 dark:text-white">{item.quantity}</span>
                      <span className="text-sm text-gray-500 dark:text-gray-400 ml-1">{item.product_unit}</span>
                    </td>
                    <td className="py-4 px-4 text-right font-medium text-gray-900 dark:text-white">
                      {new Intl.NumberFormat('th-TH').format(item.quantity * (item.base_price ?? item.price_per_unit ?? 0))} ฿
                    </td>
                    <td className="py-4 px-4 text-center">
                      <Badge
                        variant={
                          item.stock_status === 'out_of_stock' ? 'error' :
                          item.stock_status === 'low_stock' ? 'warning' :
                          'success'
                        }
                      >
                        {
                          item.stock_status === 'out_of_stock' ? 'หมด' :
                          item.stock_status === 'low_stock' ? 'ต่ำ' :
                          'ปกติ'
                        }
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {topProducts.length === 0 && (
              <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>ไม่มีข้อมูลสินค้า</p>
              </div>
            )}
          </div>
        </div>
      </Card>
    </PageLayout>
  );
}

