// Approval Board View - Kanban board สำหรับดูภาพรวมสถานะการอนุมัติ
import React, { useMemo } from 'react';
import { useTicketsWithRelations, useAuth } from '../hooks';

// จำกัดจำนวนตั๋วที่แสดงในแต่ละคอลัมน์
const ITEMS_PER_COLUMN = 15;
import {
  Clock,
  CheckCircle,
  AlertCircle,
  FileText,
  Truck,
  X,
  AlertTriangle,
  Zap,
  RefreshCw,
  Eye,
  Calendar,
  User
} from 'lucide-react';
import { Card } from '../components/ui/Card';
import { PageLayout } from '../components/layout/PageLayout';
import { Button } from '../components/ui/Button';
import { ApprovalStatusBadge } from '../components/ApprovalStatusBadge';
import type { Database } from '../types/database';

type TicketWithRelations = Database['public']['Views']['tickets_with_relations']['Row'];
type TicketStatus = Database['public']['Tables']['tickets']['Row']['status'];
type UrgencyLevel = Database['public']['Tables']['tickets']['Row']['urgency'];

interface ApprovalBoardViewProps {
  onViewDetail?: (ticketId: number) => void;
}

interface Column {
  id: string;
  title: string;
  statuses: TicketStatus[];
  color: string;
  icon: React.ElementType;
}

export const ApprovalBoardView: React.FC<ApprovalBoardViewProps> = ({
  onViewDetail,
}) => {
  const { profile, isAdmin, isInspector, isManager, isExecutive } = useAuth();
  const { tickets = [], loading, error, refetch } = useTicketsWithRelations();

  // Stable tickets reference to prevent unnecessary re-renders
  // Only update if tickets actually change (by comparing IDs)
  const stableTickets = React.useMemo(() => {
    return tickets;
  }, [tickets.length, tickets.map(t => t.id).join(',')]);

  // Define columns based on approval workflow (memoized to prevent re-renders)
  const columns: Column[] = useMemo(() => [
    {
      id: 'pending',
      title: 'รอผู้ตรวจสอบอนุมัติ',
      statuses: ['pending'],
      color: 'yellow',
      icon: Clock,
    },
    {
      id: 'approved_inspector',
      title: 'ผู้ตรวจสอบอนุมัติแล้ว → รอผู้จัดการ',
      statuses: ['approved_inspector'],
      color: 'blue',
      icon: CheckCircle,
    },
    {
      id: 'approved_manager',
      title: 'ผู้จัดการอนุมัติแล้ว → รอผู้บริหาร',
      statuses: ['approved_manager'],
      color: 'indigo',
      icon: CheckCircle,
    },
    {
      id: 'ready_for_repair',
      title: 'อนุมัติครบทุกขั้นตอน → พร้อมซ่อม',
      statuses: ['ready_for_repair'],
      color: 'purple',
      icon: AlertCircle,
    },
    {
      id: 'in_progress',
      title: 'กำลังซ่อม',
      statuses: ['in_progress'],
      color: 'orange',
      icon: AlertCircle,
    },
    {
      id: 'completed',
      title: 'เสร็จสิ้น',
      statuses: ['completed'],
      color: 'green',
      icon: CheckCircle,
    },
    {
      id: 'rejected',
      title: 'ปฏิเสธ',
      statuses: ['rejected'],
      color: 'red',
      icon: X,
    },
  ], []);

  // Group tickets by status - use stable tickets reference
  const ticketsByStatus = useMemo(() => {
    const grouped: Record<string, TicketWithRelations[]> = {};
    columns.forEach(col => {
      grouped[col.id] = [];
    });

    // Defensive check: ensure tickets is an array
    if (Array.isArray(stableTickets)) {
      stableTickets.forEach(ticket => {
        if (ticket && ticket.status) {
          const column = columns.find(col => col.statuses.includes(ticket.status));
          if (column) {
            grouped[column.id].push(ticket);
          }
        }
      });
    }

    return grouped;
  }, [stableTickets, columns]);

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

  const getColorClasses = (color: string) => {
    const colors: Record<string, { bg: string; border: string; text: string }> = {
      yellow: {
        bg: 'bg-yellow-50 dark:bg-yellow-900/20',
        border: 'border-yellow-200 dark:border-yellow-800',
        text: 'text-yellow-700 dark:text-yellow-300',
      },
      blue: {
        bg: 'bg-blue-50 dark:bg-blue-900/20',
        border: 'border-blue-200 dark:border-blue-800',
        text: 'text-blue-700 dark:text-blue-300',
      },
      indigo: {
        bg: 'bg-indigo-50 dark:bg-indigo-900/20',
        border: 'border-indigo-200 dark:border-indigo-800',
        text: 'text-indigo-700 dark:text-indigo-300',
      },
      purple: {
        bg: 'bg-purple-50 dark:bg-purple-900/20',
        border: 'border-purple-200 dark:border-purple-800',
        text: 'text-purple-700 dark:text-purple-300',
      },
      orange: {
        bg: 'bg-orange-50 dark:bg-orange-900/20',
        border: 'border-orange-200 dark:border-orange-800',
        text: 'text-orange-700 dark:text-orange-300',
      },
      green: {
        bg: 'bg-green-50 dark:bg-green-900/20',
        border: 'border-green-200 dark:border-green-800',
        text: 'text-green-700 dark:text-green-300',
      },
      red: {
        bg: 'bg-red-50 dark:bg-red-900/20',
        border: 'border-red-200 dark:border-red-800',
        text: 'text-red-700 dark:text-red-300',
      },
    };
    return colors[color] || colors.slate;
  };

  const totalTickets = Array.isArray(stableTickets) ? stableTickets.length : 0;
  const pendingCount = ticketsByStatus.pending?.length || 0;
  const inProgressCount = ticketsByStatus.in_progress?.length || 0;
  const completedCount = ticketsByStatus.completed?.length || 0;

  // Always show content - never hide it
  // Show loading/error inline if needed, but always render the board
  const showLoading = loading && stableTickets.length === 0;
  const showError = !!error && stableTickets.length === 0;

  return (
    <PageLayout
      title="ภาพรวมการอนุมัติ"
      subtitle={showLoading
        ? 'กำลังโหลดข้อมูล...'
        : `ทั้งหมด ${totalTickets} ตั๋ว • รออนุมัติ ${pendingCount} • กำลังซ่อม ${inProgressCount} • เสร็จสิ้น ${completedCount}`}
      loading={false} // Never hide content - always show what we have
      error={false} // Never hide content - show error inline if needed
      onRetry={refetch}
      actions={
        <Button variant="outline" onClick={refetch} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          รีเฟรช
        </Button>
      }
    >
      {/* Show error message inline if needed */}
      {showError && (
        <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-red-600 dark:text-red-400 text-sm">
            {error?.message || 'เกิดข้อผิดพลาดในการโหลดข้อมูล'}
          </p>
          <button
            onClick={refetch}
            className="mt-2 text-sm text-red-600 dark:text-red-400 hover:underline"
          >
            ลองอีกครั้ง
          </button>
        </div>
      )}

      {/* Show loading indicator inline if needed */}
      {showLoading && (
        <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg text-center">
          <RefreshCw className="animate-spin w-5 h-5 mx-auto text-blue-600 dark:text-blue-400" />
          <p className="mt-2 text-sm text-blue-600 dark:text-blue-400">กำลังโหลดข้อมูล...</p>
        </div>
      )}
      <div className="space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-yellow-700 dark:text-yellow-300 font-medium">รออนุมัติ</p>
                <p className="text-2xl font-bold text-yellow-900 dark:text-yellow-100 mt-1">
                  {pendingCount}
                </p>
              </div>
              <Clock className="w-8 h-8 text-yellow-600 dark:text-yellow-400" />
            </div>
          </Card>
          <Card className="p-4 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-700 dark:text-blue-300 font-medium">อนุมัติแล้ว</p>
                <p className="text-2xl font-bold text-blue-900 dark:text-blue-100 mt-1">
                  {(ticketsByStatus.approved_inspector?.length || 0) +
                    (ticketsByStatus.approved_manager?.length || 0) +
                    (ticketsByStatus.ready_for_repair?.length || 0)}
                </p>
              </div>
              <CheckCircle className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            </div>
          </Card>
          <Card className="p-4 bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-orange-700 dark:text-orange-300 font-medium">กำลังซ่อม</p>
                <p className="text-2xl font-bold text-orange-900 dark:text-orange-100 mt-1">
                  {inProgressCount}
                </p>
              </div>
              <AlertCircle className="w-8 h-8 text-orange-600 dark:text-orange-400" />
            </div>
          </Card>
          <Card className="p-4 bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-700 dark:text-green-300 font-medium">เสร็จสิ้น</p>
                <p className="text-2xl font-bold text-green-900 dark:text-green-100 mt-1">
                  {completedCount}
                </p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
            </div>
          </Card>
        </div>

        {/* Kanban Board */}
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-4 min-w-max">
            {columns.map((column) => {
              const columnTickets = ticketsByStatus[column.id] || [];
              const colorClasses = getColorClasses(column.color);
              const ColumnIcon = column.icon;

              return (
                <div
                  key={column.id}
                  className={`flex-shrink-0 w-80 ${colorClasses.bg} rounded-lg border-2 ${colorClasses.border} p-4`}
                >
                  {/* Column Header */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <ColumnIcon className={`w-5 h-5 ${colorClasses.text}`} />
                        <h3 className={`font-semibold ${colorClasses.text}`}>
                          {column.title}
                        </h3>
                      </div>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${colorClasses.bg} ${colorClasses.text} border ${colorClasses.border}`}>
                        {columnTickets.length}
                      </span>
                    </div>
                    {/* Show approval step description */}
                    {column.id === 'pending' && (
                      <p className={`text-xs ${colorClasses.text} opacity-75`}>
                        ขั้นตอนที่ 1: ต้องอนุมัติก่อน Level 2 และ 3
                      </p>
                    )}
                    {column.id === 'approved_inspector' && (
                      <p className={`text-xs ${colorClasses.text} opacity-75`}>
                        ขั้นตอนที่ 2: Level 1 อนุมัติแล้ว → รอ Level 2
                      </p>
                    )}
                    {column.id === 'approved_manager' && (
                      <p className={`text-xs ${colorClasses.text} opacity-75`}>
                        ขั้นตอนที่ 3: Level 1, 2 อนุมัติแล้ว → รอ Level 3
                      </p>
                    )}
                    {column.id === 'ready_for_repair' && (
                      <p className={`text-xs ${colorClasses.text} opacity-75`}>
                        อนุมัติครบทุกขั้นตอนแล้ว (1 → 2 → 3)
                      </p>
                    )}
                  </div>

                  {/* Tickets List */}
                  <div className="space-y-3 max-h-[calc(100vh-300px)] overflow-y-auto">
                    {columnTickets.length === 0 ? (
                      <div className="text-center py-8 text-slate-400 dark:text-slate-500">
                        <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">ไม่มีตั๋ว</p>
                      </div>
                    ) : (
                      <>
                        {columnTickets.slice(0, ITEMS_PER_COLUMN).map((ticket) => {
                          const urgencyBadge = getUrgencyBadge(ticket.urgency);

                          return (
                            <Card
                              key={ticket.id}
                              className="p-4 hover:shadow-lg transition-all cursor-pointer bg-white dark:bg-slate-800"
                              onClick={() => onViewDetail?.(ticket.id)}
                            >
                              <div className="space-y-3">
                                {/* Ticket Header */}
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                      <FileText className="w-4 h-4 text-slate-400" />
                                      <p className="font-semibold text-slate-900 dark:text-white text-sm">
                                        {ticket.ticket_number || `#${ticket.id}`}
                                      </p>
                                    </div>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                      {ticket.repair_type || 'ไม่ระบุประเภท'}
                                    </p>
                                  </div>
                                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${urgencyBadge.className}`}>
                                    {urgencyBadge.label === 'วิกฤต' && <Zap className="w-3 h-3 inline mr-1" />}
                                    {urgencyBadge.label === 'สูง' && <AlertTriangle className="w-3 h-3 inline mr-1" />}
                                    {urgencyBadge.label}
                                  </span>
                                </div>

                                {/* Vehicle Info */}
                                {ticket.vehicle_plate && (
                                  <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                                    <Truck className="w-3 h-3" />
                                    <span>{ticket.vehicle_plate}</span>
                                  </div>
                                )}

                                {/* Problem Description */}
                                {ticket.problem_description && (
                                  <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2">
                                    {ticket.problem_description}
                                  </p>
                                )}

                                {/* Approval Status */}
                                <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
                                  <ApprovalStatusBadge status={ticket.status} />
                                </div>

                                {/* Footer */}
                                <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-700">
                                  <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                                    <Calendar className="w-3 h-3" />
                                    <span>
                                      {new Date(ticket.created_at).toLocaleDateString('th-TH', {
                                        month: 'short',
                                        day: 'numeric',
                                      })}
                                    </span>
                                  </div>
                                  {ticket.reporter_name && (
                                    <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                                      <User className="w-3 h-3" />
                                      <span className="truncate max-w-[100px]">
                                        {ticket.reporter_name}
                                      </span>
                                    </div>
                                  )}
                                </div>

                                {/* View Button */}
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="w-full mt-2"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onViewDetail?.(ticket.id);
                                  }}
                                >
                                  <Eye className="w-3 h-3 mr-1" />
                                  ดูรายละเอียด
                                </Button>
                              </div>
                            </Card>
                          );
                        })}

                        {/* View All Button - แสดงเมื่อมีตั๋วเกิน ITEMS_PER_COLUMN */}
                        {columnTickets.length > ITEMS_PER_COLUMN && (
                          <div
                            className="p-4 bg-slate-50 dark:bg-slate-700/50 border-2 border-dashed border-slate-300 dark:border-slate-600 hover:border-enterprise-500 dark:hover:border-enterprise-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-all cursor-pointer"
                            onClick={() => window.location.href = `/tickets?status=${column.statuses.join(',')}`}
                          >
                            <div className="text-center">
                              <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                📋 ดูทั้งหมด
                              </p>
                              <p className="text-xs text-slate-500 dark:text-slate-400">
                                +{columnTickets.length - ITEMS_PER_COLUMN} ตั๋วเพิ่มเติม
                              </p>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </PageLayout>
  );
};

