// Tickets View - List all tickets with filters and search
import React, { useState, useMemo, useEffect } from 'react';
import { useTicketsWithRelations, useAuth } from '../hooks';
import { 
  FileText, 
  Plus, 
  Search, 
  Filter, 
  Eye,
  AlertCircle,
  CheckCircle,
  X,
  Clock,
  AlertTriangle,
  Zap,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card } from '../components/ui/Card';
import { PageLayout } from '../components/layout/PageLayout';
import type { Database } from '../types/database';

type TicketWithRelations = Database['public']['Views']['tickets_with_relations']['Row'];
type TicketStatus = Database['public']['Tables']['tickets']['Row']['status'];
type UrgencyLevel = Database['public']['Tables']['tickets']['Row']['urgency'];

interface TicketsViewProps {
  onViewDetail?: (ticketId: number) => void;
  onCreate?: () => void;
}

export const TicketsView: React.FC<TicketsViewProps> = ({
  onViewDetail,
  onCreate,
}) => {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<TicketStatus[] | 'all'>('all');
  const [urgencyFilter, setUrgencyFilter] = useState<UrgencyLevel[] | 'all'>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageInput, setPageInput] = useState('');
  const itemsPerPage = 20;

  // Calculate pagination
  const offset = (currentPage - 1) * itemsPerPage;

  // Fetch tickets with relations (server-side pagination)
  const { tickets, totalCount, loading, error, refetch } = useTicketsWithRelations({
    status: statusFilter !== 'all' && Array.isArray(statusFilter) ? statusFilter : undefined,
    limit: itemsPerPage,
    offset: offset,
    search: searchQuery || undefined,
  });

  // Filter tickets (client-side filtering for urgency only, as it's not in service yet)
  // Note: For better performance with large datasets, urgency filter should be moved to server-side
  const filteredTickets = useMemo(() => {
    let filtered = tickets || [];

    // Urgency filter (client-side for now, can be moved to server-side later)
    if (urgencyFilter !== 'all' && Array.isArray(urgencyFilter)) {
      filtered = filtered.filter(t => urgencyFilter.includes(t.urgency));
    }

    return filtered;
  }, [tickets, urgencyFilter]);

  // Pagination (using server-side count, but adjust if urgency filter is applied)
  // Note: If urgency filter is active, totalCount may not be accurate
  // For accurate count with urgency filter, we'd need to fetch all matching records or add urgency to server-side filter
  const effectiveTotalCount = urgencyFilter !== 'all' && Array.isArray(urgencyFilter) 
    ? filteredTickets.length // Approximate - not accurate for pagination
    : totalCount;
  
  const totalPages = Math.ceil(effectiveTotalCount / itemsPerPage);
  const startIndex = offset;
  const endIndex = Math.min(startIndex + itemsPerPage, effectiveTotalCount);
  const paginatedTickets = filteredTickets;

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, urgencyFilter]);

  const getStatusBadge = (status: TicketStatus) => {
    const badges = {
      pending: {
        label: 'รออนุมัติ',
        className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
        icon: Clock,
      },
      approved_inspector: {
        label: 'อนุมัติโดยผู้ตรวจสอบ',
        className: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
        icon: CheckCircle,
      },
      approved_manager: {
        label: 'อนุมัติโดยผู้จัดการ',
        className: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
        icon: CheckCircle,
      },
      ready_for_repair: {
        label: 'พร้อมซ่อม',
        className: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
        icon: AlertCircle,
      },
      in_progress: {
        label: 'กำลังซ่อม',
        className: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
        icon: AlertCircle,
      },
      completed: {
        label: 'เสร็จสิ้น',
        className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
        icon: CheckCircle,
      },
      rejected: {
        label: 'ปฏิเสธ',
        className: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
        icon: X,
      },
    };
    return badges[status] || badges.pending;
  };

  const getUrgencyBadge = (urgency: UrgencyLevel) => {
    const badges = {
      low: {
        label: 'ต่ำ',
        className: 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-200',
      },
      medium: {
        label: 'ปานกลาง',
        className: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      },
      high: {
        label: 'สูง',
        className: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
      },
      critical: {
        label: 'วิกฤต',
        className: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
      },
    };
    return badges[urgency] || badges.low;
  };

  const statusOptions: TicketStatus[] = [
    'pending',
    'approved_inspector',
    'approved_manager',
    'ready_for_repair',
    'in_progress',
    'completed',
    'rejected',
  ];

  const urgencyOptions: UrgencyLevel[] = ['low', 'medium', 'high', 'critical'];

  return (
    <PageLayout
      title="ตั๋วซ่อมบำรุง"
      subtitle={loading ? 'กำลังโหลด...' : `ทั้งหมด ${effectiveTotalCount.toLocaleString('th-TH')} รายการ${totalPages > 1 ? ` (หน้า ${currentPage}/${totalPages})` : ''}`}
      loading={loading}
      error={!!error}
      onRetry={refetch}
      actions={
        <div className="flex gap-3">
          {user && (
            <Button onClick={onCreate}>
              <Plus className="w-4 h-4 mr-2" />
              สร้างตั๋วใหม่
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="w-4 h-4 mr-2" />
            กรอง
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Search and Filters */}
        <Card className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                <Input
                  type="text"
                  placeholder="ค้นหาจากเลขตั๋ว, ป้ายทะเบียน, ประเภทซ่อม, คำอธิบาย..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Quick Status Filters */}
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  statusFilter === 'all'
                    ? 'bg-enterprise-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                ทั้งหมด
              </button>
              <button
                onClick={() => setStatusFilter(['pending'])}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  Array.isArray(statusFilter) && statusFilter.includes('pending')
                    ? 'bg-yellow-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                รออนุมัติ
              </button>
              <button
                onClick={() => setStatusFilter(['in_progress'])}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  Array.isArray(statusFilter) && statusFilter.includes('in_progress')
                    ? 'bg-orange-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                กำลังซ่อม
              </button>
              <button
                onClick={() => setStatusFilter(['completed'])}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  Array.isArray(statusFilter) && statusFilter.includes('completed')
                    ? 'bg-green-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                เสร็จสิ้น
              </button>
            </div>
          </div>

          {/* Advanced Filters */}
          {showFilters && (
            <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    สถานะ
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {statusOptions.map(status => {
                      const isSelected = Array.isArray(statusFilter) && statusFilter.includes(status);
                      return (
                        <button
                          key={status}
                          onClick={() => {
                            if (statusFilter === 'all') {
                              setStatusFilter([status]);
                            } else if (Array.isArray(statusFilter)) {
                              if (isSelected) {
                                const newFilter = statusFilter.filter(s => s !== status);
                                setStatusFilter(newFilter.length > 0 ? newFilter : 'all');
                              } else {
                                setStatusFilter([...statusFilter, status]);
                              }
                            }
                          }}
                          className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                            isSelected
                              ? 'bg-enterprise-600 text-white'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                          }`}
                        >
                          {getStatusBadge(status).label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    ความเร่งด่วน
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {urgencyOptions.map(urgency => {
                      const isSelected = Array.isArray(urgencyFilter) && urgencyFilter.includes(urgency);
                      return (
                        <button
                          key={urgency}
                          onClick={() => {
                            if (urgencyFilter === 'all') {
                              setUrgencyFilter([urgency]);
                            } else if (Array.isArray(urgencyFilter)) {
                              if (isSelected) {
                                const newFilter = urgencyFilter.filter(u => u !== urgency);
                                setUrgencyFilter(newFilter.length > 0 ? newFilter : 'all');
                              } else {
                                setUrgencyFilter([...urgencyFilter, urgency]);
                              }
                            }
                          }}
                          className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                            isSelected
                              ? 'bg-enterprise-600 text-white'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                          }`}
                        >
                          {getUrgencyBadge(urgency).label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}
        </Card>

        {/* Tickets List */}
        {effectiveTotalCount === 0 ? (
          <Card className="p-12 text-center">
            <FileText className="w-16 h-16 mx-auto mb-4 text-slate-400 opacity-50" />
            <h3 className="text-lg font-medium text-slate-600 dark:text-slate-300 mb-2">
              ไม่พบตั๋วซ่อมบำรุง
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {searchQuery || statusFilter !== 'all' || urgencyFilter !== 'all'
                ? 'ลองเปลี่ยนเงื่อนไขการค้นหา'
                : user
                ? 'เริ่มต้นด้วยการสร้างตั๋วซ่อมบำรุง'
                : 'ยังไม่มีข้อมูลตั๋วซ่อมบำรุง'}
            </p>
          </Card>
        ) : (
          <>
            <div className="space-y-4">
              {paginatedTickets.map((ticket) => {
              const statusBadge = getStatusBadge(ticket.status);
              const urgencyBadge = getUrgencyBadge(ticket.urgency);
              const StatusIcon = statusBadge.icon;

              return (
                <Card key={ticket.id} className="p-6 hover:shadow-lg transition-shadow">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        {/* Vehicle Image */}
                        {ticket.vehicle_image_url ? (
                          <div className="w-16 h-16 rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-800 flex-shrink-0">
                            <img
                              src={ticket.vehicle_image_url}
                              alt={ticket.vehicle_plate || 'Vehicle'}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                                e.currentTarget.nextElementSibling?.classList.remove('hidden');
                              }}
                            />
                            <div className="hidden w-full h-full flex items-center justify-center bg-enterprise-100 dark:bg-enterprise-900">
                              <FileText className="w-6 h-6 text-enterprise-600 dark:text-enterprise-400" />
                            </div>
                          </div>
                        ) : (
                          <div className="p-2 bg-enterprise-100 dark:bg-enterprise-900 rounded-lg flex-shrink-0">
                            <FileText className="w-5 h-5 text-enterprise-600 dark:text-enterprise-400" />
                          </div>
                        )}
                        <div>
                          <h3 className="font-semibold text-lg text-slate-900 dark:text-white">
                            {ticket.ticket_number || `#${ticket.id}`}
                          </h3>
                          <p className="text-sm text-slate-500 dark:text-slate-400">
                            {ticket.vehicle_plate} • {ticket.repair_type || 'ไม่ระบุประเภท'}
                          </p>
                        </div>
                      </div>

                      {ticket.problem_description && (
                        <p className="text-sm text-slate-600 dark:text-slate-400 mt-2 line-clamp-2">
                          {ticket.problem_description}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-col gap-2 items-end">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${statusBadge.className}`}>
                        <StatusIcon className="w-3 h-3" />
                        {statusBadge.label}
                      </span>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${urgencyBadge.className}`}>
                        {urgencyBadge.label === 'วิกฤต' && <Zap className="w-3 h-3 inline mr-1" />}
                        {urgencyBadge.label === 'สูง' && <AlertTriangle className="w-3 h-3 inline mr-1" />}
                        {urgencyBadge.label}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-slate-200 dark:border-slate-700 text-sm">
                    <div>
                      <p className="text-slate-500 dark:text-slate-400 mb-1">ผู้รายงาน</p>
                      <p className="font-medium text-slate-900 dark:text-white">
                        {ticket.reporter_name || ticket.reporter_email || '-'}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-500 dark:text-slate-400 mb-1">ยานพาหนะ</p>
                      <p className="font-medium text-slate-900 dark:text-white">
                        {ticket.vehicle_plate}
                      </p>
                    </div>
                    {ticket.odometer && (
                      <div>
                        <p className="text-slate-500 dark:text-slate-400 mb-1">เลขไมล์</p>
                        <p className="font-medium text-slate-900 dark:text-white">
                          {ticket.odometer.toLocaleString()} กม.
                        </p>
                      </div>
                    )}
                    <div>
                      <p className="text-slate-500 dark:text-slate-400 mb-1">วันที่สร้าง</p>
                      <p className="font-medium text-slate-900 dark:text-white">
                        {new Date(ticket.created_at).toLocaleDateString('th-TH', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </p>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onViewDetail?.(ticket.id)}
                    >
                      <Eye className="w-4 h-4 mr-1" />
                      ดูรายละเอียด
                    </Button>
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
                    แสดง {startIndex + 1}-{endIndex} จาก {effectiveTotalCount.toLocaleString('th-TH')} รายการ
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
                        
                        // For small number of pages, show all
                        if (totalPages <= 7) {
                          for (let i = 1; i <= totalPages; i++) {
                            pages.push(i);
                          }
                        } else {
                          // Always show first page
                          pages.push(1);
                          
                          // Calculate range around current page (show 2 pages on each side)
                          const startPage = Math.max(2, currentPage - 2);
                          const endPage = Math.min(totalPages - 1, currentPage + 2);
                          
                          // Add ellipsis if needed before current range
                          if (startPage > 2) {
                            pages.push('ellipsis-start');
                          }
                          
                          // Add pages around current page
                          for (let i = startPage; i <= endPage; i++) {
                            if (i !== 1 && i !== totalPages) {
                              pages.push(i);
                            }
                          }
                          
                          // Add ellipsis if needed after current range
                          if (endPage < totalPages - 1) {
                            pages.push('ellipsis-end');
                          }
                          
                          // Always show last page
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

                    {/* Jump to Page Input (for large page counts) */}
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

