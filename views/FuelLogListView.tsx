// Fuel Log List View - Display fuel fill-up history
import React, { useState, useEffect } from 'react';
import {
  Truck,
  Gauge,
  Droplet,
  DollarSign,
  Calendar,
  Filter,
  Download,
  Search,
  Plus,
  ChevronLeft,
  ChevronRight,
  MapPin,
  FileText,
  User,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card } from '../components/ui/Card';
import { PageLayout } from '../components/layout/PageLayout';
import { useFuelLogs, useFuelStats, useVehicles } from '../hooks';
import type { Database } from '../types/database';

type FuelRecord = Database['public']['Tables']['fuel_records']['Row'];

interface FuelLogListViewProps {
  onCreate?: () => void;
}

const FUEL_TYPE_LABELS: Record<string, string> = {
  gasoline_91: 'เบนซิน 91',
  gasoline_95: 'เบนซิน 95',
  gasohol_91: 'แก๊สโซฮอล์ 91',
  gasohol_95: 'แก๊สโซฮอล์ 95',
  diesel: 'ดีเซล',
  e20: 'E20',
  e85: 'E85',
};

export const FuelLogListView: React.FC<FuelLogListViewProps> = ({
  onCreate,
}) => {
  const { vehicles } = useVehicles();

  const [filters, setFilters] = useState<{
    vehicle_id?: string;
    start_date?: string;
    end_date?: string;
    fuel_type?: string;
  }>({});

  const [currentPage, setCurrentPage] = useState(1);
  const [pageInput, setPageInput] = useState('');
  const itemsPerPage = 20;

  // Calculate pagination
  const offset = (currentPage - 1) * itemsPerPage;

  // Fetch fuel logs with server-side pagination
  const { fuelLogs, totalCount, loading, error, refetch } = useFuelLogs({
    ...filters,
    limit: itemsPerPage,
    offset: offset,
  });

  // Fetch fuel stats
  const { stats } = useFuelStats(filters);

  // Pagination (using server-side count)
  const totalPages = Math.ceil(totalCount / itemsPerPage);
  const startIndex = offset;
  const endIndex = Math.min(startIndex + itemsPerPage, totalCount);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filters]);

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString('th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDateOnly = (date: string) => {
    return new Date(date).toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const handleExport = () => {
    // TODO: Implement Excel export
    alert('ฟีเจอร์ Export to Excel กำลังพัฒนา');
  };

  const selectedVehicle = vehicles.find(v => v.id === filters.vehicle_id);

  return (
    <PageLayout
      title="ประวัติการเติมน้ำมัน"
      subtitle={loading ? 'กำลังโหลด...' : `ทั้งหมด ${totalCount.toLocaleString('th-TH')} รายการ${totalPages > 1 ? ` (หน้า ${currentPage}/${totalPages})` : ''}`}
      actions={
        <div className="flex gap-2">
          {onCreate && (
            <Button onClick={onCreate}>
              <Plus className="w-4 h-4 mr-2" />
              บันทึกการเติมน้ำมัน
            </Button>
          )}
          <Button variant="outline" onClick={handleExport}>
            <Download className="w-4 h-4 mr-2" />
            Export Excel
          </Button>
        </div>
      }
      loading={loading}
      error={!!error}
      onRetry={refetch}
    >
      <div className="space-y-6">
        {/* Stats Summary */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="p-4">
              <div className="text-sm text-slate-600 dark:text-slate-400 mb-1">ค่าใช้จ่ายรวม</div>
              <div className="text-2xl font-bold text-slate-900 dark:text-white">
                ฿{stats.totalCost.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </Card>
            <Card className="p-4">
              <div className="text-sm text-slate-600 dark:text-slate-400 mb-1">จำนวนลิตรรวม</div>
              <div className="text-2xl font-bold text-slate-900 dark:text-white">
                {stats.totalLiters.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} L
              </div>
            </Card>
            <Card className="p-4">
              <div className="text-sm text-slate-600 dark:text-slate-400 mb-1">ราคาเฉลี่ย/ลิตร</div>
              <div className="text-2xl font-bold text-slate-900 dark:text-white">
                ฿{stats.averagePricePerLiter.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </Card>
            <Card className="p-4">
              <div className="text-sm text-slate-600 dark:text-slate-400 mb-1">ประสิทธิภาพเฉลี่ย</div>
              <div className="text-2xl font-bold text-slate-900 dark:text-white">
                {stats.averageEfficiency ? `${stats.averageEfficiency.toFixed(2)} km/L` : 'N/A'}
              </div>
            </Card>
          </div>
        )}

        {/* Filters */}
        <Card className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Vehicle Filter */}
            <div className="flex-1">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                รถ
              </label>
              <select
                value={filters.vehicle_id || ''}
                onChange={(e) => setFilters({ ...filters, vehicle_id: e.target.value || undefined })}
                className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-enterprise-500 focus:border-transparent"
              >
                <option value="">ทั้งหมด</option>
                {vehicles.map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.id}>
                    {vehicle.plate} {vehicle.make && vehicle.model && `(${vehicle.make} ${vehicle.model})`}
                  </option>
                ))}
              </select>
            </div>

            {/* Fuel Type Filter */}
            <div className="flex-1">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                ประเภทน้ำมัน
              </label>
              <select
                value={filters.fuel_type || ''}
                onChange={(e) => setFilters({ ...filters, fuel_type: e.target.value || undefined })}
                className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-enterprise-500 focus:border-transparent"
              >
                <option value="">ทั้งหมด</option>
                {Object.entries(FUEL_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            {/* Date Range */}
            <div className="flex-1">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                วันที่เริ่มต้น
              </label>
              <Input
                type="date"
                value={filters.start_date || ''}
                onChange={(e) => setFilters({ ...filters, start_date: e.target.value || undefined })}
              />
            </div>

            <div className="flex-1">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                วันที่สิ้นสุด
              </label>
              <Input
                type="date"
                value={filters.end_date || ''}
                onChange={(e) => setFilters({ ...filters, end_date: e.target.value || undefined })}
              />
            </div>

            {/* Clear Filters */}
            <div className="flex items-end">
              <Button
                variant="outline"
                onClick={() => {
                  setFilters({});
                  setCurrentPage(1);
                }}
              >
                <Filter className="w-4 h-4 mr-2" />
                ล้างตัวกรอง
              </Button>
            </div>
          </div>
        </Card>

        {/* Fuel Logs List */}
        {totalCount === 0 ? (
          <Card className="p-12 text-center">
            <Droplet className="w-16 h-16 mx-auto mb-4 text-slate-400 opacity-50" />
            <h3 className="text-lg font-medium text-slate-600 dark:text-slate-300 mb-2">
              ไม่พบข้อมูลการเติมน้ำมัน
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {Object.keys(filters).length > 0
                ? 'ลองเปลี่ยนเงื่อนไขการค้นหา'
                : onCreate
                ? 'เริ่มต้นด้วยการบันทึกการเติมน้ำมัน'
                : 'ยังไม่มีข้อมูลการเติมน้ำมัน'}
            </p>
          </Card>
        ) : (
          <>
            <div className="space-y-4">
              {fuelLogs.map((record) => {
                const vehicle = vehicles.find(v => v.id === record.vehicle_id);
                return (
                  <Card key={record.id} className="p-6 hover:shadow-lg transition-shadow">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="p-2 bg-enterprise-100 dark:bg-enterprise-900 rounded-lg">
                            <Droplet className="w-5 h-5 text-enterprise-600 dark:text-enterprise-400" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-lg text-slate-900 dark:text-white">
                              {vehicle?.plate || 'N/A'}
                            </h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                              {FUEL_TYPE_LABELS[record.fuel_type] || record.fuel_type} • {formatDateOnly(record.filled_at)}
                            </p>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-4 text-sm">
                          <div>
                            <p className="text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1">
                              <Gauge size={14} />
                              เลขไมล์
                            </p>
                            <p className="font-medium text-slate-900 dark:text-white">
                              {record.odometer.toLocaleString()} km
                            </p>
                          </div>

                          <div>
                            <p className="text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1">
                              <Droplet size={14} />
                              จำนวนลิตร
                            </p>
                            <p className="font-medium text-slate-900 dark:text-white">
                              {Number(record.liters).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} L
                            </p>
                          </div>

                          <div>
                            <p className="text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1">
                              <DollarSign size={14} />
                              ราคา/ลิตร
                            </p>
                            <p className="font-medium text-slate-900 dark:text-white">
                              ฿{Number(record.price_per_liter).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </p>
                          </div>

                          <div>
                            <p className="text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1">
                              <DollarSign size={14} />
                              รวมเป็นเงิน
                            </p>
                            <p className="font-medium text-slate-900 dark:text-white text-lg">
                              ฿{Number(record.total_cost || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </p>
                          </div>

                          <div>
                            <p className="text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1">
                              <User size={14} />
                              เติมโดย
                            </p>
                            <p className="font-medium text-slate-900 dark:text-white">
                              {(record as any).user?.full_name || 'N/A'}
                            </p>
                          </div>
                        </div>

                        {/* Fuel Efficiency */}
                        {record.fuel_efficiency && (
                          <div className="mt-3 p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                            <p className="text-sm text-blue-800 dark:text-blue-200">
                              <span className="font-medium">ประสิทธิภาพ:</span> {Number(record.fuel_efficiency).toFixed(2)} km/L
                              {record.distance_since_last_fill && (
                                <span className="ml-2">
                                  (ระยะทาง: {record.distance_since_last_fill.toLocaleString()} km)
                                </span>
                              )}
                            </p>
                          </div>
                        )}

                        {/* Additional Info */}
                        {(record.fuel_station || record.receipt_number || record.notes) && (
                          <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700 grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                            {record.fuel_station && (
                              <div>
                                <p className="text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1">
                                  <MapPin size={14} />
                                  ปั๊มน้ำมัน
                                </p>
                                <p className="font-medium text-slate-900 dark:text-white">
                                  {record.fuel_station}
                                </p>
                                {record.fuel_station_location && (
                                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                                    {record.fuel_station_location}
                                  </p>
                                )}
                              </div>
                            )}

                            {record.receipt_number && (
                              <div>
                                <p className="text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1">
                                  <FileText size={14} />
                                  เลขที่ใบเสร็จ
                                </p>
                                <p className="font-medium text-slate-900 dark:text-white">
                                  {record.receipt_number}
                                </p>
                              </div>
                            )}

                            {record.notes && (
                              <div>
                                <p className="text-slate-500 dark:text-slate-400 mb-1">หมายเหตุ</p>
                                <p className="text-slate-900 dark:text-white">
                                  {record.notes}
                                </p>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Receipt Image */}
                        {record.receipt_image_url && (
                          <div className="mt-3">
                            <a
                              href={record.receipt_image_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-2 text-sm text-enterprise-600 dark:text-enterprise-400 hover:underline"
                            >
                              <FileText size={14} />
                              ดูรูปใบเสร็จ
                            </a>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col gap-2 items-end">
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {formatDate(record.filled_at)}
                        </div>
                        {record.is_full_tank && (
                          <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 rounded-full text-xs font-medium">
                            เติมเต็มถัง
                          </span>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <Card className="p-4">
                <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                  <div className="text-sm text-slate-600 dark:text-slate-400">
                    แสดง {startIndex + 1}-{endIndex} จาก {totalCount.toLocaleString('th-TH')} รายการ
                    {totalPages > 1 && (
                      <span className="ml-2">(ทั้งหมด {totalPages.toLocaleString('th-TH')} หน้า)</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap justify-center">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                      className="flex items-center gap-1"
                    >
                      <ChevronLeft size={16} />
                      ก่อนหน้า
                    </Button>

                    {/* Page Numbers */}
                    <div className="flex items-center gap-1 flex-wrap">
                      {(() => {
                        const pages: (number | string)[] = [];

                        if (totalPages <= 7) {
                          for (let i = 1; i <= totalPages; i++) {
                            pages.push(i);
                          }
                        } else {
                          pages.push(1);

                          const startPage = Math.max(2, currentPage - 2);
                          const endPage = Math.min(totalPages - 1, currentPage + 2);

                          if (startPage > 2) {
                            pages.push('ellipsis-start');
                          }

                          for (let i = startPage; i <= endPage; i++) {
                            if (i !== 1 && i !== totalPages) {
                              pages.push(i);
                            }
                          }

                          if (endPage < totalPages - 1) {
                            pages.push('ellipsis-end');
                          }

                          pages.push(totalPages);
                        }

                        return pages.map((page) => {
                          if (typeof page === 'string') {
                            return (
                              <span key={page} className="px-2 text-slate-400">
                                ...
                              </span>
                            );
                          }

                          return (
                            <button
                              key={page}
                              onClick={() => setCurrentPage(page)}
                              className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                                currentPage === page
                                  ? 'bg-enterprise-600 text-white'
                                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                              }`}
                            >
                              {page.toLocaleString('th-TH')}
                            </button>
                          );
                        });
                      })()}
                    </div>

                    {/* Jump to Page Input */}
                    {totalPages > 10 && (
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-slate-600 dark:text-slate-400">ไปที่หน้า:</span>
                        <input
                          type="number"
                          min="1"
                          max={totalPages}
                          value={pageInput}
                          onChange={(e) => setPageInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              const page = parseInt(pageInput);
                              if (page >= 1 && page <= totalPages) {
                                setCurrentPage(page);
                                setPageInput('');
                              }
                            }
                          }}
                          placeholder={`1-${totalPages}`}
                          className="w-20 px-2 py-1 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-enterprise-500 focus:border-transparent"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const page = parseInt(pageInput);
                            if (page >= 1 && page <= totalPages) {
                              setCurrentPage(page);
                              setPageInput('');
                            }
                          }}
                          disabled={!pageInput || parseInt(pageInput) < 1 || parseInt(pageInput) > totalPages}
                        >
                          ไป
                        </Button>
                      </div>
                    )}

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                      className="flex items-center gap-1"
                    >
                      ถัดไป
                      <ChevronRight size={16} />
                    </Button>
                  </div>
                </div>
              </Card>
            )}
          </>
        )}
      </div>
    </PageLayout>
  );
};

