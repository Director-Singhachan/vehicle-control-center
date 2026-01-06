// Staff Item Details Card - แสดงรายละเอียดการยกสินค้าของพนักงานแต่ละคน
import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Package, User } from 'lucide-react';
import { Card } from './ui/Card';
import type { StaffItemStatistics, StaffItemDetail } from '../services/reportsService';
import { useStaffItemDetails } from '../hooks/useReports';

interface StaffItemDetailsCardProps {
  staff: StaffItemStatistics;
  startDate: Date;
  endDate: Date;
  isDark?: boolean;
}

export const StaffItemDetailsCard: React.FC<StaffItemDetailsCardProps> = ({
  staff,
  startDate,
  endDate,
  isDark = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  /* Performance Optimization: Limit detailed history to 30 days by default */
  const [showFullHistory, setShowFullHistory] = useState(false);

  // Calculate duration in days
  const durationInDays = React.useMemo(() => {
    const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }, [startDate, endDate]);

  const isLongPeriod = durationInDays > 31;

  // Determine effective start date for details fetching
  const detailsStartDate = React.useMemo(() => {
    if (!isLongPeriod || showFullHistory) {
      return startDate;
    }
    const limitDate = new Date(endDate);
    limitDate.setDate(limitDate.getDate() - 30);
    return limitDate > startDate ? limitDate : startDate;
  }, [startDate, endDate, isLongPeriod, showFullHistory]);

  const { data: details, loading } = useStaffItemDetails(
    detailsStartDate,
    endDate,
    isExpanded ? staff.staff_id : undefined
  );

  // Group details by product
  const productGroups = React.useMemo(() => {
    if (!details || details.length === 0) return [];

    const groups = new Map<string, {
      product_id: string;
      product_code: string;
      product_name: string;
      category: string;
      unit: string;
      total_quantity: number;
      total_quantity_per_staff: number;
      trips: Array<{
        trip_number: string;
        planned_date: string;
        quantity_per_staff: number;
        store_name: string | null;
      }>;
    }>();

    details.forEach((detail) => {
      const key = detail.product_id;
      if (!groups.has(key)) {
        groups.set(key, {
          product_id: detail.product_id,
          product_code: detail.product_code,
          product_name: detail.product_name,
          category: detail.category,
          unit: detail.unit,
          total_quantity: 0,
          total_quantity_per_staff: 0,
          trips: [],
        });
      }

      const group = groups.get(key)!;
      group.total_quantity += detail.total_quantity;
      group.total_quantity_per_staff += detail.quantity_per_staff;
      group.trips.push({
        trip_number: detail.trip_number,
        planned_date: detail.planned_date,
        quantity_per_staff: detail.quantity_per_staff,
        store_name: detail.store_name,
      });
    });

    return Array.from(groups.values()).sort((a, b) =>
      b.total_quantity_per_staff - a.total_quantity_per_staff
    );
  }, [details]);

  return (
    <Card className="border border-slate-200 dark:border-slate-700">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
      >
        <div className="flex items-center gap-3 flex-1 text-left">
          <div className="w-10 h-10 rounded-full bg-enterprise-100 dark:bg-enterprise-900 flex items-center justify-center flex-shrink-0">
            <User className="w-5 h-5 text-enterprise-600 dark:text-enterprise-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-slate-900 dark:text-slate-100">
              {staff.staff_name}
            </div>
            <div className="text-sm text-slate-500 dark:text-slate-400">
              {staff.staff_code} {staff.staff_phone && `· ${staff.staff_phone}`}
            </div>
          </div>
          <div className="text-right ml-4">
            <div className="text-2xl font-bold text-enterprise-600 dark:text-enterprise-400">
              {staff.total_items_carried.toLocaleString('th-TH', {
                minimumFractionDigits: 0,
                maximumFractionDigits: 1,
              })}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              ชิ้นทั้งหมด
            </div>
          </div>
          <div className="ml-4">
            {isExpanded ? (
              <ChevronDown className="w-5 h-5 text-slate-400" />
            ) : (
              <ChevronRight className="w-5 h-5 text-slate-400" />
            )}
          </div>
        </div>
      </button>

      {isExpanded && (
        <div className="border-t border-slate-200 dark:border-slate-700 p-4">
          {/* Performance warning banner */}
          {isLongPeriod && !showFullHistory && (
            <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50 rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="text-sm text-amber-800 dark:text-amber-200">
                <span className="font-medium">แสดงข้อมูลเฉพาะ 30 วันล่าสุด</span> เพื่อความรวดเร็วในการแสดงผล
                <span className="opacity-75 block sm:inline sm:ml-1 text-xs sm:text-sm">
                  (เลือกช่วงเวลาทั้งหมด {durationInDays} วัน)
                </span>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowFullHistory(true);
                }}
                className="whitespace-nowrap text-xs px-3 py-1.5 bg-amber-100 hover:bg-amber-200 dark:bg-amber-800 dark:hover:bg-amber-700 text-amber-900 dark:text-white rounded-md transition-colors font-medium border border-amber-200 dark:border-amber-700"
              >
                โหลดข้อมูลทั้งหมด
              </button>
            </div>
          )}

          {loading ? (
            <div className="text-center py-4 text-slate-400">กำลังโหลดรายละเอียด...</div>
          ) : productGroups.length > 0 ? (
            <div className="space-y-3">
              <div className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                รายละเอียดสินค้าที่ยก:
              </div>
              {productGroups.map((product) => (
                <div
                  key={product.product_id}
                  className="border border-slate-200 dark:border-slate-700 rounded-lg p-3 bg-slate-50 dark:bg-slate-800/50"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="font-medium text-slate-900 dark:text-slate-100">
                        {product.product_name}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {product.product_code} · {product.category} · {product.unit}
                      </div>
                    </div>
                    <div className="text-right ml-4">
                      <div className="font-bold text-enterprise-600 dark:text-enterprise-400">
                        {product.total_quantity_per_staff.toLocaleString('th-TH', {
                          minimumFractionDigits: 0,
                          maximumFractionDigits: 2,
                        })}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {product.unit} (จากทั้งหมด {product.total_quantity.toLocaleString('th-TH')} {product.unit})
                      </div>
                    </div>
                  </div>

                  {/* Trip Details */}
                  {product.trips.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                      <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                        รายละเอียดทริป ({product.trips.length} ทริป):
                      </div>
                      <div className="space-y-1 max-h-32 overflow-y-auto">
                        {product.trips.map((trip, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between text-xs bg-white dark:bg-slate-900 rounded px-2 py-1"
                          >
                            <div className="flex-1">
                              <span className="font-medium text-slate-700 dark:text-slate-300">
                                {trip.trip_number}
                              </span>
                              {trip.store_name && (
                                <span className="text-slate-500 dark:text-slate-400 ml-2">
                                  · {trip.store_name}
                                </span>
                              )}
                            </div>
                            <div className="text-slate-600 dark:text-slate-400 ml-2">
                              {trip.quantity_per_staff.toLocaleString('th-TH', {
                                minimumFractionDigits: 0,
                                maximumFractionDigits: 2,
                              })} {product.unit}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-4 text-slate-400">
              ไม่มีรายละเอียดสินค้า
            </div>
          )}
        </div>
      )}
    </Card>
  );
};

