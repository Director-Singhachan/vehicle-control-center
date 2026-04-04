// Store Delivery Detail View - Show detailed delivery statistics for a specific store
import React, { useState, useMemo } from 'react';
import {
  ArrowLeft,
  Calendar,
  Package,
  Download,
  FileText,
  TrendingUp,
  BarChart3,
  ChevronDown,
  ChevronRight,
  Truck,
  User,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { PageLayout } from '../components/layout/PageLayout';
import { useDeliverySummaryByStore, useProductDeliveryHistory } from '../hooks/useReports';
import { excelExport } from '../utils/excelExport';
import { storeService, type Store } from '../services/storeService';

interface StoreDeliveryDetailViewProps {
  storeId: string;
  onBack?: () => void;
  isDark?: boolean;
}

export const StoreDeliveryDetailView: React.FC<StoreDeliveryDetailViewProps> = ({
  storeId,
  onBack,
  isDark = false,
}) => {
  const [startDate, setStartDate] = useState<Date>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() - 2, 1); // Default: last 3 months
  });
  const [endDate, setEndDate] = useState<Date>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  });

  const { data: storeData, loading, error } = useDeliverySummaryByStore(startDate, endDate, storeId);
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set());
  
  // Also fetch store info as fallback
  const [storeInfo, setStoreInfo] = useState<Store | null>(null);
  const [loadingStore, setLoadingStore] = useState(true);

  React.useEffect(() => {
    const fetchStore = async () => {
      try {
        setLoadingStore(true);
        const { data: stores } = await storeService.getAll();
        const foundStore = stores.find(s => s.id === storeId);
        if (foundStore) {
          setStoreInfo(foundStore);
        }
      } catch (err) {
        console.error('[StoreDeliveryDetailView] Error fetching store:', err);
      } finally {
        setLoadingStore(false);
      }
    };
    if (storeId) {
      fetchStore();
    }
  }, [storeId]);

  const formatNumber = (value: number, decimals: number = 0) => {
    return value.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const storeSummary = storeData && storeData.length > 0 ? storeData[0] : null;
  const sortedProducts = storeSummary?.products 
    ? [...storeSummary.products].sort((a, b) => b.totalQuantity - a.totalQuantity)
    : [];

  // Use storeSummary data first, fallback to storeInfo
  const displayStore = storeSummary ? {
    customer_code: storeSummary.customer_code,
    customer_name: storeSummary.customer_name,
    address: storeSummary.address,
  } : storeInfo ? {
    customer_code: storeInfo.customer_code,
    customer_name: storeInfo.customer_name,
    address: storeInfo.address,
  } : null;

  const exportReport = () => {
    if (!storeSummary || !sortedProducts.length) return;
    
    const exportData = sortedProducts.map(product => ({
      product_code: product.product_code,
      product_name: product.product_name,
      unit: product.unit,
      totalQuantity: product.totalQuantity,
      deliveryCount: product.deliveryCount,
    }));

    excelExport.exportToExcel(
      exportData,
      [
        { key: 'product_code', label: 'รหัสสินค้า', width: 15 },
        { key: 'product_name', label: 'ชื่อสินค้า', width: 30 },
        { key: 'unit', label: 'หน่วย', width: 10 },
        { key: 'totalQuantity', label: 'จำนวนรวม', width: 15, format: excelExport.formatNumber },
        { key: 'deliveryCount', label: 'จำนวนครั้งที่ส่ง', width: 18, format: excelExport.formatNumber },
      ],
      `รายงานสินค้าที่ส่งไปร้าน_${displayStore?.customer_code || storeId}_${new Date().toISOString().split('T')[0]}.xlsx`,
      `รายงานสินค้าที่ส่งไปร้าน ${displayStore?.customer_name || ''}`
    );
  };

  return (
    <PageLayout
      title={`รายละเอียดการส่งสินค้า${displayStore ? ` - ${displayStore.customer_name}` : ''}`}
      subtitle={displayStore?.customer_code ? `รหัสลูกค้า: ${displayStore.customer_code}` : loadingStore ? 'กำลังโหลดข้อมูลร้าน...' : 'ไม่พบข้อมูลร้าน'}
      actions={
        <div className="flex gap-2">
          {onBack && (
            <Button onClick={onBack} variant="outline" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              กลับ
            </Button>
          )}
          {storeSummary && sortedProducts.length > 0 && (
            <Button onClick={exportReport} variant="outline" size="sm">
              <Download className="w-4 h-4 mr-2" />
              Export Excel
            </Button>
          )}
        </div>
      }
      loading={loading}
      error={!!error}
    >
      <div className="space-y-6">
        {/* Store Info Card */}
        {displayStore ? (
          <Card>
            <div className="mb-4 pb-4 border-b border-slate-200 dark:border-slate-700">
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Package className="w-6 h-6 text-enterprise-600 dark:text-enterprise-400" />
                {displayStore.customer_name}
              </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">รหัสลูกค้า</p>
                <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">{displayStore.customer_code}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">ชื่อร้าน</p>
                <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">{displayStore.customer_name}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">ที่อยู่</p>
                <p className="text-sm text-slate-700 dark:text-slate-300">{displayStore.address || '-'}</p>
              </div>
            </div>
          </Card>
        ) : loadingStore ? (
          <Card>
            <div className="text-center py-4 text-slate-500 dark:text-slate-400">กำลังโหลดข้อมูลร้าน...</div>
          </Card>
        ) : (
          <Card>
            <div className="text-center py-4 text-slate-500 dark:text-slate-400">ไม่พบข้อมูลร้าน</div>
          </Card>
        )}

        {/* Date Range Filter */}
        <Card>
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-slate-500 dark:text-slate-400" />
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">กรองช่วงเวลา:</span>
            </div>
            <div className="flex gap-2 items-center">
              <input
                type="date"
                value={startDate.toISOString().split('T')[0]}
                onChange={(e) => setStartDate(new Date(e.target.value))}
                className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm"
              />
              <span className="text-slate-500 dark:text-slate-400">ถึง</span>
              <input
                type="date"
                value={endDate.toISOString().split('T')[0]}
                onChange={(e) => {
                  const newDate = new Date(e.target.value);
                  newDate.setHours(23, 59, 59, 999);
                  setEndDate(newDate);
                }}
                className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm"
              />
            </div>
            <div className="text-sm text-slate-500 dark:text-slate-400">
              {formatDate(startDate)} - {formatDate(endDate)}
            </div>
          </div>
        </Card>

        {/* Summary Statistics */}
        {storeSummary && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">จำนวนเที่ยว</p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{formatNumber(storeSummary.totalTrips)}</p>
                </div>
                <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                  <FileText className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
            </Card>
            <Card>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">จำนวนรายการ</p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{formatNumber(storeSummary.totalItems)}</p>
                </div>
                <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                  <Package className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                </div>
              </div>
            </Card>
            <Card>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">จำนวนสินค้ารวม</p>
                  <p className="text-2xl font-bold text-enterprise-600 dark:text-enterprise-400">{formatNumber(storeSummary.totalQuantity)}</p>
                </div>
                <div className="p-3 bg-enterprise-100 dark:bg-enterprise-900/30 rounded-lg">
                  <TrendingUp className="w-6 h-6 text-enterprise-600 dark:text-enterprise-400" />
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* Products Table */}
        <Card>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              สถิติสินค้าแต่ละชนิดที่ส่ง (เรียงตามจำนวนที่ส่ง)
            </h3>
          </div>
          {loading ? (
            <div className="text-center py-8 text-slate-400">กำลังโหลด...</div>
          ) : sortedProducts.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">ลำดับ</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">รหัสสินค้า</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">ชื่อสินค้า</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">หน่วย</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">จำนวนรวม</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">จำนวนครั้งที่ส่ง</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300">เฉลี่ยต่อครั้ง</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedProducts.map((product, index) => {
                    const averagePerDelivery = product.deliveryCount > 0 
                      ? product.totalQuantity / product.deliveryCount 
                      : 0;
                    const isExpanded = expandedProducts.has(product.product_id);
                    
                    return (
                      <React.Fragment key={product.product_id}>
                        <tr 
                          className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer"
                          onClick={() => {
                            const newExpanded = new Set(expandedProducts);
                            if (isExpanded) {
                              newExpanded.delete(product.product_id);
                            } else {
                              newExpanded.add(product.product_id);
                            }
                            setExpandedProducts(newExpanded);
                          }}
                        >
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              {isExpanded ? (
                                <ChevronDown className="w-4 h-4 text-slate-500" />
                              ) : (
                                <ChevronRight className="w-4 h-4 text-slate-500" />
                              )}
                              <span className="text-slate-600 dark:text-slate-400">{index + 1}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4 font-medium text-slate-900 dark:text-slate-100">{product.product_code}</td>
                          <td className="py-3 px-4 text-slate-900 dark:text-slate-100">{product.product_name}</td>
                          <td className="py-3 px-4 text-slate-600 dark:text-slate-400">{product.unit}</td>
                          <td className="py-3 px-4 text-right font-medium text-enterprise-600 dark:text-enterprise-400">
                            {formatNumber(product.totalQuantity)}
                          </td>
                          <td className="py-3 px-4 text-right text-slate-600 dark:text-slate-400">
                            {formatNumber(product.deliveryCount)}
                          </td>
                          <td className="py-3 px-4 text-right text-slate-600 dark:text-slate-400">
                            {formatNumber(averagePerDelivery, 2)}
                          </td>
                        </tr>
                        {isExpanded && (
                          <ProductDeliveryHistoryRow
                            storeId={storeId}
                            productId={product.product_id}
                            productName={product.product_name}
                            startDate={startDate}
                            endDate={endDate}
                            formatNumber={formatNumber}
                          />
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 text-slate-400">
              {storeSummary ? 'ไม่มีข้อมูลสินค้าในช่วงเวลาที่เลือก' : 'ไม่พบข้อมูลร้านค้า'}
            </div>
          )}
        </Card>
      </div>
    </PageLayout>
  );
};

// Product Delivery History Row Component
const ProductDeliveryHistoryRow: React.FC<{
  storeId: string;
  productId: string;
  productName: string;
  startDate: Date;
  endDate: Date;
  formatNumber: (value: number, decimals?: number) => string;
}> = ({ storeId, productId, productName, startDate, endDate, formatNumber }) => {
  const { data: history, loading, error } = useProductDeliveryHistory(storeId, productId, startDate, endDate);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatDateShort = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // Calculate summary statistics
  const summary = React.useMemo(() => {
    if (!history || history.length === 0) return null;
    
    const totalQuantity = history.reduce((sum, item) => sum + item.quantity, 0);
    const uniqueDates = new Set(history.map(item => item.delivery_date));
    const uniqueTrips = new Set(history.map(item => item.trip_number));
    
    // Group by date
    const byDate = new Map<string, typeof history>();
    history.forEach(item => {
      const date = item.delivery_date;
      if (!byDate.has(date)) {
        byDate.set(date, []);
      }
      byDate.get(date)!.push(item);
    });

    return {
      totalQuantity,
      totalDeliveries: history.length,
      uniqueDates: uniqueDates.size,
      uniqueTrips: uniqueTrips.size,
      byDate: Array.from(byDate.entries()).sort((a, b) => b[0].localeCompare(a[0])), // Sort by date descending
    };
  }, [history]);

  return (
    <tr>
      <td colSpan={7} className="py-4 px-4 bg-slate-50 dark:bg-slate-900/50">
        <div className="ml-6 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-base font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Package className="w-5 h-5 text-enterprise-600 dark:text-enterprise-400" />
              ไทม์ไลน์การส่งสินค้า: {productName}
            </h4>
          </div>

          {loading ? (
            <div className="text-center py-8 text-slate-400 text-sm">
              <div className="animate-pulse">กำลังโหลดข้อมูล...</div>
            </div>
          ) : error ? (
            <div className="text-center py-8 text-red-400 text-sm">
              เกิดข้อผิดพลาด: {error.message}
            </div>
          ) : summary && summary.totalDeliveries > 0 ? (
            <>
              {/* Summary Statistics */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                <div className="bg-white dark:bg-slate-800 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">จำนวนรวมทั้งหมด</p>
                  <p className="text-lg font-bold text-enterprise-600 dark:text-enterprise-400">
                    {formatNumber(summary.totalQuantity)}
                  </p>
                </div>
                <div className="bg-white dark:bg-slate-800 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">จำนวนครั้งที่ส่ง</p>
                  <p className="text-lg font-bold text-slate-900 dark:text-slate-100">
                    {formatNumber(summary.totalDeliveries)}
                  </p>
                </div>
                <div className="bg-white dark:bg-slate-800 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">จำนวนวันที่มีการส่ง</p>
                  <p className="text-lg font-bold text-slate-900 dark:text-slate-100">
                    {formatNumber(summary.uniqueDates)}
                  </p>
                </div>
                <div className="bg-white dark:bg-slate-800 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">จำนวนทริป</p>
                  <p className="text-lg font-bold text-slate-900 dark:text-slate-100">
                    {formatNumber(summary.uniqueTrips)}
                  </p>
                </div>
              </div>

              {/* Timeline by Date */}
              <div className="space-y-4">
                <h5 className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  รายละเอียดตามวันที่ส่ง
                </h5>
                {summary.byDate.map(([date, items]) => {
                  const dateTotal = items.reduce((sum, item) => sum + item.quantity, 0);
                  const uniqueTripsForDate = new Set(items.map(item => item.trip_number));
                  
                  return (
                    <div key={date} className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
                      <div className="bg-slate-100 dark:bg-slate-700 px-4 py-2 border-b border-slate-200 dark:border-slate-600">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                            <span className="font-semibold text-slate-900 dark:text-slate-100">
                              {formatDate(date)}
                            </span>
                          </div>
                          <div className="flex items-center gap-4 text-sm">
                            <span className="text-slate-600 dark:text-slate-400">
                              ส่ง {items.length} ครั้ง
                            </span>
                            <span className="font-medium text-enterprise-600 dark:text-enterprise-400">
                              รวม {formatNumber(dateTotal)}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="p-4">
                        <div className="space-y-2">
                          {items.map((item, idx) => (
                            <div 
                              key={`${item.trip_id}-${idx}`}
                              className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900/50 rounded border border-slate-200 dark:border-slate-700"
                            >
                              <div className="flex items-center gap-3 flex-1">
                                <div className="flex-shrink-0">
                                  <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                                    {item.trip_number}
                                  </span>
                                </div>
                                <div className="flex items-center gap-4 text-sm text-slate-600 dark:text-slate-400 flex-1">
                                  {item.vehicle_plate && (
                                    <span className="flex items-center gap-1.5">
                                      <Truck className="w-4 h-4" />
                                      {item.vehicle_plate}
                                    </span>
                                  )}
                                  {item.driver_name && (
                                    <span className="flex items-center gap-1.5">
                                      <User className="w-4 h-4" />
                                      {item.driver_name}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="flex-shrink-0">
                                <span className="text-base font-bold text-enterprise-600 dark:text-enterprise-400">
                                  {formatNumber(item.quantity)}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="text-center py-8 text-slate-400 text-sm">
              <Package className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>ไม่มีข้อมูลการส่งสินค้านี้ในช่วงเวลาที่เลือก</p>
              <p className="text-xs mt-1">กรุณาเลือกช่วงเวลาอื่นหรือตรวจสอบว่ามีการส่งสินค้านี้ไปยังร้านนี้หรือไม่</p>
            </div>
          )}
        </div>
      </td>
    </tr>
  );
};

