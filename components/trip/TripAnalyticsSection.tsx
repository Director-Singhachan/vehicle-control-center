import React from 'react';
import { BarChart3, Users } from 'lucide-react';
import { Card, CardHeader } from '../ui/Card';
import { SkeletonCard } from '../ui/Skeleton';
import { TripPostAnalysisPanel } from './TripPostAnalysisPanel';
import type { PostTripAnalysisEntry } from '../../hooks/useDeliveryTripDetail';

interface TripAnalyticsSectionProps {
  tripId: string;
  tripStatus: string;
  staffDistribution: any[];
  productDistribution: any[];
  distributionLoading: boolean;
  postAnalyses: PostTripAnalysisEntry[];
  postAnalysisLoading: boolean;
  postAnalysisError: string | null;
}

function WorkloadBadge({ diffPercent }: { diffPercent: number }) {
  if (Math.abs(diffPercent) < 1)
    return (
      <span className="px-2 py-0.5 rounded text-xs bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300">
        สมดุล
      </span>
    );
  if (diffPercent > 10)
    return (
      <span className="px-2 py-0.5 rounded text-xs bg-red-100 text-red-700 dark:bg-red-900/60 dark:text-red-300">
        ยกมาก
      </span>
    );
  if (diffPercent < -10)
    return (
      <span className="px-2 py-0.5 rounded text-xs bg-green-100 text-green-700 dark:bg-green-900/60 dark:text-green-300">
        ยกน้อย
      </span>
    );
  if (diffPercent > 0)
    return (
      <span className="px-2 py-0.5 rounded text-xs bg-orange-100 text-orange-700 dark:bg-orange-900/60 dark:text-orange-300">
        ยกมากกว่า
      </span>
    );
  return (
    <span className="px-2 py-0.5 rounded text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300">
      ยกน้อยกว่า
    </span>
  );
}

function getBarColor(diffPercent: number) {
  if (diffPercent > 10) return 'bg-red-500';
  if (diffPercent < -10) return 'bg-green-500';
  if (diffPercent > 0) return 'bg-orange-500';
  return 'bg-blue-500';
}

function getValueColor(diffPercent: number) {
  if (diffPercent > 10) return 'text-red-600 dark:text-red-400';
  if (diffPercent < -10) return 'text-green-600 dark:text-green-400';
  if (diffPercent > 0) return 'text-orange-600 dark:text-orange-400';
  if (diffPercent < 0) return 'text-blue-600 dark:text-blue-400';
  return 'text-slate-600 dark:text-slate-400';
}

export const TripAnalyticsSection: React.FC<TripAnalyticsSectionProps> = ({
  tripId,
  tripStatus,
  staffDistribution,
  productDistribution,
  distributionLoading,
}) => {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* ── AI Post-Trip Analysis ─────────────────────────────────── */}
      <TripPostAnalysisPanel tripId={tripId} tripStatus={tripStatus} />

      {/* ── Staff Item Distribution ───────────────────────────────── */}
      <Card>
        <CardHeader
          title="สถิติการยกสินค้าต่อพนักงาน"
          subtitle="จำนวนสินค้าถูกหารด้วยจำนวนพนักงานทั้งหมด เพื่อให้ทุกคนยกเท่ากัน"
        />

        {distributionLoading && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <SkeletonCard key={i} className="h-20" />
            ))}
          </div>
        )}

        {!distributionLoading && staffDistribution.length === 0 && (
          <div className="py-8 text-center">
            <Users size={32} className="mx-auto mb-2 text-slate-300 dark:text-slate-600" />
            <p className="text-sm text-slate-400 dark:text-slate-500">
              ยังไม่มีข้อมูลสถิติการยกสินค้า
            </p>
          </div>
        )}

        {!distributionLoading && staffDistribution.length > 0 && (
          <>
            <div className="mb-4 px-3 py-2.5 bg-slate-50 dark:bg-slate-800/40 rounded-lg text-sm text-slate-600 dark:text-slate-400">
              พนักงานทั้งหมด{' '}
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                {staffDistribution.length} คน
              </span>
            </div>

            <div className="space-y-3">
              {staffDistribution.map((staff, index) => {
                const avg =
                  staffDistribution.reduce((s, x) => s + x.total_items_per_staff, 0) /
                  staffDistribution.length;
                const diff = staff.total_items_per_staff - avg;
                const diffPct = avg > 0 ? (diff / avg) * 100 : 0;

                return (
                  <div
                    key={staff.crew_id}
                    className="border border-slate-200 dark:border-slate-700 rounded-xl p-4"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div
                          className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-bold text-base ${
                            staff.staff_role === 'driver'
                              ? 'bg-blue-100 dark:bg-blue-900/60 text-blue-600 dark:text-blue-400'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          {index + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-slate-900 dark:text-slate-100">
                              {staff.staff_name}
                            </span>
                            {staff.staff_role === 'driver' && (
                              <span className="text-xs px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300">
                                คนขับ
                              </span>
                            )}
                            <WorkloadBadge diffPercent={diffPct} />
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            {staff.staff_code}
                            {staff.staff_phone && ` · ${staff.staff_phone}`}
                          </div>
                        </div>
                      </div>

                      <div className="flex-shrink-0 text-right ml-4">
                        <div className={`text-2xl font-bold ${getValueColor(diffPct)}`}>
                          {staff.total_items_per_staff.toLocaleString('th-TH', {
                            maximumFractionDigits: 1,
                          })}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">ชิ้น/คน</div>
                        {Math.abs(diffPct) >= 1 && (
                          <div className={`text-xs mt-0.5 ${getValueColor(diffPct)}`}>
                            {diffPct > 0 ? '+' : ''}
                            {diffPct.toFixed(1)}% จากค่าเฉลี่ย
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700/50">
                      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1.5">
                        <span>เทียบค่าเฉลี่ย ({avg.toFixed(1)} ชิ้น/คน)</span>
                        <span>รวม: {staff.total_items_to_carry.toFixed(0)} ชิ้น</span>
                      </div>
                      <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${getBarColor(diffPct)} transition-all duration-500`}
                          style={{
                            width: `${Math.min(100, Math.max(4, (staff.total_items_per_staff / (avg * 1.5)) * 100))}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </Card>

      {/* ── Product Distribution by Type ─────────────────────────── */}
      <Card>
        <CardHeader
          title="สรุปการกระจายสินค้าตามชนิด"
          subtitle="จำนวนสินค้าแต่ละชนิดที่ต้องจัดส่งในเที่ยวนี้"
        />

        {distributionLoading && (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <SkeletonCard key={i} className="h-28" />
            ))}
          </div>
        )}

        {!distributionLoading && productDistribution.length === 0 && (
          <div className="py-8 text-center">
            <BarChart3 size={32} className="mx-auto mb-2 text-slate-300 dark:text-slate-600" />
            <p className="text-sm text-slate-400 dark:text-slate-500">
              ยังไม่มีข้อมูลการกระจายสินค้า
            </p>
          </div>
        )}

        {!distributionLoading && productDistribution.length > 0 && (
          <div className="space-y-3">
            {productDistribution.map((product: any) => (
              <div
                key={product.product_id}
                className="border border-slate-200 dark:border-slate-700 rounded-xl p-4"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                      {product.product_name}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {product.product_code}
                      {product.category && ` · ${product.category}`}
                      {` · ${product.unit}`}
                    </div>
                  </div>
                  <div className="flex-shrink-0 text-right ml-4">
                    <div className="text-lg font-bold text-enterprise-600 dark:text-enterprise-400">
                      {product.quantity_per_staff.toLocaleString('th-TH', {
                        maximumFractionDigits: 2,
                      })}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      {product.unit}/คน
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 pt-3 border-t border-slate-100 dark:border-slate-700/50 text-sm">
                  <div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">รวมทั้งหมด</div>
                    <div className="font-semibold text-slate-900 dark:text-slate-100">
                      {product.total_quantity.toLocaleString('th-TH', { maximumFractionDigits: 2 })}{' '}
                      {product.unit}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">จำนวนร้าน</div>
                    <div className="font-semibold text-slate-900 dark:text-slate-100">
                      {product.store_count} ร้าน
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">พนักงาน</div>
                    <div className="font-semibold text-slate-900 dark:text-slate-100">
                      {product.total_staff_count} คน
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};
