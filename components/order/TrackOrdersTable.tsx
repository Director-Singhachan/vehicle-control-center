import React, { useState } from 'react';
import { Package, ChevronLeft, ChevronRight, Eye, Edit } from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { LoadingSpinner } from '../ui/LoadingSpinner';

interface TrackOrdersTableProps {
  orders: any[];
  loading: boolean;
  filteredCount: number;
  currentPage: number;
  setCurrentPage: (page: number) => void;
  totalPages: number;
  startIndex: number;
  endIndex: number;
  onOpenDetail: (order: any) => void;
  onEditOrder: (orderId: string) => void;
  getEffectiveStatus: (order: any) => string;
  getStatusBadge: (order: any) => React.ReactNode;
}

export const TrackOrdersTable: React.FC<TrackOrdersTableProps> = ({
  orders,
  loading,
  filteredCount,
  currentPage,
  setCurrentPage,
  totalPages,
  startIndex,
  endIndex,
  onOpenDetail,
  onEditOrder,
  getEffectiveStatus,
  getStatusBadge,
}) => {
  const [pageInput, setPageInput] = useState('');

  if (loading) {
    return (
      <Card className="border-0 shadow-sm ring-1 ring-slate-200/50 dark:ring-slate-700/50 relative overflow-hidden bg-white/80 dark:bg-charcoal-900/80 backdrop-blur-xl">
        <div className="p-16 flex flex-col items-center justify-center">
          <LoadingSpinner />
          <p className="mt-4 text-slate-500 dark:text-slate-400 font-medium animate-pulse">กำลังโหลดข้อมูลออเดอร์...</p>
        </div>
      </Card>
    );
  }

  if (orders.length === 0) {
    return (
      <Card className="border-0 shadow-sm ring-1 ring-slate-200/50 dark:ring-slate-700/50 bg-white/80 dark:bg-charcoal-900/80 backdrop-blur-xl">
        <div className="p-16 text-center text-slate-500 dark:text-slate-400 flex flex-col items-center justify-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center ring-4 ring-slate-50 dark:ring-charcoal-950">
            <Package className="w-8 h-8 text-slate-400" />
          </div>
          <p className="text-lg font-medium text-slate-600 dark:text-slate-300">ไม่พบออเดอร์</p>
          <p className="text-sm">ลองปรับการกรองสถานะ หรือเปลี่ยนคำค้นหาใหม่</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="border-0 shadow-sm ring-1 ring-slate-200/50 dark:ring-slate-700/50 overflow-hidden bg-white dark:bg-charcoal-900">
      <div className="overflow-x-auto custom-scrollbar">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700/80 bg-slate-50/80 dark:bg-charcoal-950/50">
              <th className="py-4 px-5 text-sm font-bold text-slate-700 dark:text-slate-300 whitespace-nowrap">เลขออเดอร์</th>
              <th className="py-4 px-5 text-sm font-bold text-slate-700 dark:text-slate-300 whitespace-nowrap">ร้านค้า</th>
              <th className="py-4 px-5 text-sm font-bold text-slate-700 dark:text-slate-300 whitespace-nowrap text-right">ยอดรวม</th>
              <th className="py-4 px-5 text-sm font-bold text-slate-700 dark:text-slate-300 whitespace-nowrap text-center">สถานะ</th>
              <th className="py-4 px-5 text-sm font-bold text-slate-700 dark:text-slate-300 whitespace-nowrap">วันที่นัดส่ง</th>
              <th className="py-4 px-5 text-sm font-bold text-slate-700 dark:text-slate-300 whitespace-nowrap">วันที่สร้าง</th>
              <th className="py-4 px-5 text-sm font-bold text-slate-700 dark:text-slate-300 whitespace-nowrap text-center">จัดการ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
            {orders.map((order) => {
              const effStatus = getEffectiveStatus(order);
              const isPartial = effStatus === 'partial';
              
              return (
                <tr 
                  key={order.id} 
                  className={`group hover:bg-slate-50/80 dark:hover:bg-charcoal-800/50 transition-colors ${isPartial ? 'bg-orange-50/20 dark:bg-orange-900/10' : ''}`}
                >
                  <td className="py-3 px-5 whitespace-nowrap">
                    <div className="font-mono text-sm font-medium text-enterprise-600 dark:text-enterprise-400 group-hover:text-enterprise-700 dark:group-hover:text-enterprise-300 transition-colors">
                      {order.order_number || <span className="text-amber-500 font-normal">รอจัดทริป</span>}
                    </div>
                    {isPartial && (
                      <div className="text-xs text-orange-500 font-medium mt-0.5 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse"></span>
                        รอจัดส่งส่วนที่เหลือ
                      </div>
                    )}
                  </td>
                  <td className="py-3 px-5">
                    <div className="font-semibold text-slate-900 dark:text-white line-clamp-1">{order.customer_name}</div>
                    <div className="text-xs font-medium text-slate-500 dark:text-slate-400">{order.customer_code}</div>
                  </td>
                  <td className="py-3 px-5 text-right whitespace-nowrap">
                    <span className="font-semibold text-slate-900 dark:text-white">
                      ฿{order.total_amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </td>
                  <td className="py-3 px-5 text-center whitespace-nowrap">
                    <div className="inline-flex drop-shadow-sm">
                      {getStatusBadge(order)}
                    </div>
                  </td>
                  <td className="py-3 px-5 whitespace-nowrap">
                    <div className="text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-charcoal-950 inline-flex px-2.5 py-1 rounded-md border border-slate-100 dark:border-slate-800">
                      {order.delivery_date
                        ? new Date(order.delivery_date).toLocaleDateString('th-TH', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })
                        : '-'}
                    </div>
                  </td>
                  <td className="py-3 px-5 whitespace-nowrap text-sm text-slate-500 dark:text-slate-400">
                    {new Date(order.created_at).toLocaleDateString('th-TH', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>
                  <td className="py-3 px-5 text-center whitespace-nowrap">
                    <div className="flex items-center justify-center gap-2 opacity-80 group-hover:opacity-100 transition-opacity">
                      <Button size="sm" variant="outline" onClick={() => onOpenDetail(order)} className="h-8 inline-flex items-center justify-center whitespace-nowrap shadow-sm hover:shadow">
                        <Eye className="w-4 h-4 mr-1.5" />
                        ดู
                      </Button>
                      {(['pending', 'confirmed', 'assigned'].includes(effStatus)) && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onEditOrder(order.id)}
                          className="h-8 inline-flex items-center justify-center whitespace-nowrap text-enterprise-600 hover:text-enterprise-700 border-enterprise-200 hover:bg-enterprise-50 dark:text-enterprise-400 dark:hover:text-enterprise-300 dark:border-enterprise-900/50 dark:hover:bg-enterprise-900/20 shadow-sm hover:shadow"
                        >
                          <Edit className="w-4 h-4 mr-1.5" />
                          แก้ไข
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-charcoal-950/30">
          <div className="text-sm font-medium text-slate-500 dark:text-slate-400">
            แสดง <span className="text-slate-900 dark:text-white font-semibold">{startIndex + 1} - {endIndex}</span> จาก <span className="text-slate-900 dark:text-white font-semibold">{filteredCount.toLocaleString('th-TH')}</span> รายการ
          </div>

          <div className="flex items-center gap-2 flex-wrap justify-center">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="flex items-center gap-1 disabled:opacity-50"
            >
              <ChevronLeft size={16} />
              <span className="hidden sm:inline">ก่อนหน้า</span>
            </Button>

            <div className="flex items-center gap-1">
              {(() => {
                const pages: (number | string)[] = [];
                if (totalPages <= 7) {
                  for (let i = 1; i <= totalPages; i++) pages.push(i);
                } else {
                  pages.push(1);
                  const startPage = Math.max(2, currentPage - 2);
                  const endPage = Math.min(totalPages - 1, currentPage + 2);
                  if (startPage > 2) pages.push('ellipsis-start');
                  for (let i = startPage; i <= endPage; i++) {
                    if (i !== 1 && i !== totalPages) pages.push(i);
                  }
                  if (endPage < totalPages - 1) pages.push('ellipsis-end');
                  pages.push(totalPages);
                }
                return pages.map((page, idx) => {
                  if (typeof page === 'string') {
                    return <span key={`${page}-${idx}`} className="px-2 text-slate-400">...</span>;
                  }
                  return (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`w-8 h-8 rounded-lg text-sm font-medium transition-all ${currentPage === page
                        ? 'bg-enterprise-600 text-white shadow-md shadow-enterprise-500/20 ring-1 ring-enterprise-600'
                        : 'bg-white dark:bg-charcoal-900 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-charcoal-800 ring-1 ring-slate-200 dark:ring-slate-700'
                        }`}
                    >
                      {page}
                    </button>
                  );
                });
              })()}
            </div>

            {totalPages > 10 && (
              <div className="hidden md:flex items-center gap-2 ml-2 pl-2 border-l border-slate-200 dark:border-slate-700">
                <input
                  type="number"
                  min={1}
                  max={totalPages}
                  value={pageInput}
                  onChange={(e) => setPageInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const page = parseInt(pageInput, 10);
                      if (page >= 1 && page <= totalPages) {
                        setCurrentPage(page);
                        setPageInput('');
                      }
                    }
                  }}
                  placeholder="หน้า"
                  className="w-16 px-2 py-1.5 text-sm text-center border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-charcoal-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-enterprise-500/50 outline-none transition-all"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const page = parseInt(pageInput, 10);
                    if (page >= 1 && page <= totalPages) {
                      setCurrentPage(page);
                      setPageInput('');
                    }
                  }}
                  className="px-3"
                >
                  ไป
                </Button>
              </div>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className="flex items-center gap-1 disabled:opacity-50 ml-1"
            >
              <span className="hidden sm:inline">ถัดไป</span>
              <ChevronRight size={16} />
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
};
