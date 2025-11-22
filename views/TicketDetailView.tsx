// Ticket Detail View - Show detailed information about a ticket with approval workflow
import React, { useState } from 'react';
import { useTicket, useTicketCosts, useAuth } from '../hooks';
import { ticketService } from '../services';
import { supabase } from '../lib/supabase';
import {
  FileText,
  Edit,
  ArrowLeft,
  Calendar,
  AlertCircle,
  CheckCircle,
  X,
  Clock,
  AlertTriangle,
  Zap,
  DollarSign,
  User,
  Truck,
  Save,
  Lock
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card } from '../components/ui/Card';
import { PageLayout } from '../components/layout/PageLayout';
import { ApprovalDialog } from '../components/ApprovalDialog';
import type { Database } from '../types/database';

type TicketStatus = Database['public']['Tables']['tickets']['Row']['status'];
type UrgencyLevel = Database['public']['Tables']['tickets']['Row']['urgency'];

interface TicketDetailViewProps {
  ticketId: number;
  onEdit?: (ticketId: number) => void;
  onBack?: () => void;
}

export const TicketDetailView: React.FC<TicketDetailViewProps> = ({
  ticketId,
  onEdit,
  onBack,
}) => {
  const { user, profile, isInspector, isManager, isAdmin } = useAuth();
  const { ticket, loading, error, refetch } = useTicket(ticketId);
  const { costs, loading: loadingCosts, refetch: refetchCosts } = useTicketCosts(ticketId);

  const [showApprovalDialog, setShowApprovalDialog] = useState(false);
  const [approvalAction, setApprovalAction] = useState<'approve' | 'reject' | null>(null);

  const [approving, setApproving] = useState(false);

  const [showCostDialog, setShowCostDialog] = useState(false);
  const [costForm, setCostForm] = useState({
    description: '',
    cost: '',
    category: '',
    note: '',
  });
  const [addingCost, setAddingCost] = useState(false);

  if (loading) {
    return (
      <PageLayout
        title="กำลังโหลด..."
        subtitle="กำลังดึงข้อมูลตั๋ว"
        loading={true}
      />
    );
  }

  if (error || !ticket) {
    return (
      <PageLayout
        title="ไม่พบข้อมูล"
        subtitle={error?.message || "ไม่สามารถโหลดข้อมูลตั๋วได้"}
        error={true}
        actions={
          <Button variant="outline" onClick={onBack}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            กลับ
          </Button>
        }
      />
    );
  }

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

  // Check if user can approve
  const canApprove = () => {
    if (!user || !profile) return false;

    // Inspector can approve pending tickets
    if (isInspector && ticket.status === 'pending') return true;

    // Manager can approve inspector-approved tickets
    if (isManager && ticket.status === 'approved_inspector') return true;

    // Admin can approve any status
    if (isAdmin) return true;

    return false;
  };

  // Check if user can update status
  const canUpdateStatus = () => {
    if (!user || !profile) return false;
    return isInspector || isManager || isAdmin;
  };

  const handleApproveClick = (action: 'approve' | 'reject') => {
    setApprovalAction(action);
    setShowApprovalDialog(true);
  };

  const handleApprovalSubmit = async (password: string, comment: string) => {
    if (!user || !profile) return;

    setApproving(true);

    try {
      // Determine new status based on current status and role
      let newStatus: TicketStatus;
      if (approvalAction === 'reject') {
        newStatus = 'rejected';
      } else {
        if (ticket.status === 'pending' && isInspector) {
          newStatus = 'approved_inspector';
        } else if (ticket.status === 'approved_inspector' && isManager) {
          newStatus = 'approved_manager';
        } else if (ticket.status === 'approved_manager') {
          newStatus = 'ready_for_repair';
        } else {
          newStatus = ticket.status;
        }
      }

      // Determine approval level
      let level = 1;
      if (isManager) level = 2;
      if (isAdmin) level = 3;

      // Call service to approve
      await ticketService.approveTicket(
        ticketId.toString(),
        level,
        user.id,
        password,
        comment,
        newStatus
      );

      // Refresh data
      await refetch();
      setShowApprovalDialog(false);
    } catch (err: any) {
      throw err; // Re-throw to be caught by ApprovalDialog
    } finally {
      setApproving(false);
    }
  };

  const handleAddCost = async () => {
    if (!costForm.description || !costForm.cost) {
      return;
    }

    setAddingCost(true);
    try {
      await ticketService.addCost({
        ticket_id: ticketId,
        description: costForm.description,
        cost: parseFloat(costForm.cost),
        category: costForm.category || undefined,
        note: costForm.note || undefined,
      });

      await refetchCosts();
      setShowCostDialog(false);
      setCostForm({ description: '', cost: '', category: '', note: '' });
    } catch (err: any) {
      console.error('Error adding cost:', err);
    } finally {
      setAddingCost(false);
    }
  };

  const statusBadge = getStatusBadge(ticket.status);
  const urgencyBadge = getUrgencyBadge(ticket.urgency);
  const StatusIcon = statusBadge.icon;

  const totalCost = costs.reduce((sum, cost) => sum + (cost.cost || 0), 0);

  return (
    <PageLayout
      title={ticket.ticket_number || `ตั๋ว #${ticket.id}`}
      subtitle={ticket.repair_type || 'ตั๋วซ่อมบำรุง'}
      actions={
        <div className="flex gap-3">
          {onBack && (
            <Button variant="outline" onClick={onBack}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              กลับ
            </Button>
          )}
          {canUpdateStatus() && onEdit && (
            <Button variant="outline" onClick={() => onEdit(ticketId)}>
              <Edit className="w-4 h-4 mr-2" />
              แก้ไข
            </Button>
          )}
        </div>
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Ticket Info Card */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
                ข้อมูลตั๋ว
              </h2>
              <div className="flex gap-2">
                <span className={`px-3 py-1 rounded-full text-sm font-medium flex items-center gap-1 ${statusBadge.className}`}>
                  <StatusIcon className="w-4 h-4" />
                  {statusBadge.label}
                </span>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${urgencyBadge.className}`}>
                  {urgencyBadge.label}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">
                  เลขตั๋ว
                </label>
                <p className="text-lg font-semibold text-slate-900 dark:text-white">
                  {ticket.ticket_number || `#${ticket.id}`}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">
                  ประเภทการซ่อม
                </label>
                <p className="text-lg text-slate-900 dark:text-white">
                  {ticket.repair_type || '-'}
                </p>
              </div>

              {ticket.odometer && (
                <div>
                  <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">
                    เลขไมล์
                  </label>
                  <p className="text-lg text-slate-900 dark:text-white">
                    {ticket.odometer.toLocaleString()} กม.
                  </p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">
                  วันที่สร้าง
                </label>
                <p className="text-lg text-slate-900 dark:text-white flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  {new Date(ticket.created_at).toLocaleDateString('th-TH', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>

              {ticket.problem_description && (
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">
                    คำอธิบายปัญหา
                  </label>
                  <p className="text-slate-900 dark:text-white whitespace-pre-wrap">
                    {ticket.problem_description}
                  </p>
                </div>
              )}
            </div>
          </Card>

          {/* Approval Actions */}
          {canApprove() && ticket.status !== 'completed' && ticket.status !== 'rejected' && (
            <Card className="p-6">
              <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">
                การอนุมัติ
              </h2>
              <div className="flex gap-3">
                <Button
                  onClick={() => handleApproveClick('approve')}
                  className="flex-1"
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  อนุมัติ
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleApproveClick('reject')}
                  className="flex-1"
                >
                  <X className="w-4 h-4 mr-2" />
                  ปฏิเสธ
                </Button>
              </div>
            </Card>
          )}

          {/* Costs */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <DollarSign className="w-5 h-5" />
                ค่าใช้จ่าย
              </h2>
              {canUpdateStatus() && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowCostDialog(true)}
                >
                  เพิ่มค่าใช้จ่าย
                </Button>
              )}
            </div>

            {loadingCosts ? (
              <p className="text-sm text-slate-500">กำลังโหลด...</p>
            ) : costs.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-4">
                ยังไม่มีค่าใช้จ่าย
              </p>
            ) : (
              <div className="space-y-3">
                {costs.map((cost) => (
                  <div
                    key={cost.id}
                    className="p-4 border border-slate-200 dark:border-slate-700 rounded-lg"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="font-medium text-slate-900 dark:text-white">
                          {cost.description || 'ไม่ระบุ'}
                        </p>
                        {cost.category && (
                          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                            หมวดหมู่: {cost.category}
                          </p>
                        )}
                        {cost.note && (
                          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                            {cost.note}
                          </p>
                        )}
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                          {new Date(cost.created_at).toLocaleDateString('th-TH')}
                        </p>
                      </div>
                      <p className="text-lg font-semibold text-slate-900 dark:text-white">
                        ฿{cost.cost?.toLocaleString() || '0'}
                      </p>
                    </div>
                  </div>
                ))}
                <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
                  <div className="flex items-center justify-between">
                    <p className="text-lg font-semibold text-slate-900 dark:text-white">
                      รวมทั้งหมด
                    </p>
                    <p className="text-2xl font-bold text-enterprise-600 dark:text-enterprise-400">
                      ฿{totalCost.toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
              ข้อมูลเพิ่มเติม
            </h3>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
                  ผู้รายงาน
                </p>
                <p className="font-medium text-slate-900 dark:text-white">
                  {ticket.reporter_id ? 'User ID: ' + ticket.reporter_id.substring(0, 8) : '-'}
                </p>
              </div>
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
                  ยานพาหนะ
                </p>
                <p className="font-medium text-slate-900 dark:text-white">
                  {ticket.vehicle_id ? 'Vehicle ID: ' + ticket.vehicle_id.substring(0, 8) : '-'}
                </p>
              </div>
            </div>
          </Card>
        </div>
      </div>

      <ApprovalDialog
        isOpen={showApprovalDialog}
        onClose={() => setShowApprovalDialog(false)}
        onConfirm={handleApprovalSubmit}
        title={`ยืนยันการ${approvalAction === 'approve' ? 'อนุมัติ' : 'ปฏิเสธ'}`}
        message={`กรุณากรอกรหัสผ่านเพื่อยืนยันการ${approvalAction === 'approve' ? 'อนุมัติ' : 'ปฏิเสธ'}ตั๋วนี้`}
        isLoading={approving}
      />

      {/* Add Cost Dialog */}
      {showCostDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="p-6 max-w-md w-full">
            <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">
              เพิ่มค่าใช้จ่าย
            </h3>

            <div className="space-y-4">
              <Input
                label="รายละเอียด *"
                type="text"
                value={costForm.description}
                onChange={(e) => setCostForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="เช่น เปลี่ยนยาง, ซ่อมเครื่องยนต์"
                disabled={addingCost}
              />
              <Input
                label="จำนวนเงิน (บาท) *"
                type="number"
                value={costForm.cost}
                onChange={(e) => setCostForm(prev => ({ ...prev, cost: e.target.value }))}
                placeholder="0.00"
                disabled={addingCost}
              />
              <Input
                label="หมวดหมู่"
                type="text"
                value={costForm.category}
                onChange={(e) => setCostForm(prev => ({ ...prev, category: e.target.value }))}
                placeholder="เช่น อะไหล่, ค่าซ่อม, ค่าบริการ"
                disabled={addingCost}
              />
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  หมายเหตุ
                </label>
                <textarea
                  value={costForm.note}
                  onChange={(e) => setCostForm(prev => ({ ...prev, note: e.target.value }))}
                  placeholder="เพิ่มหมายเหตุ..."
                  rows={3}
                  disabled={addingCost}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-enterprise-500 focus:border-transparent resize-none"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <Button
                variant="outline"
                onClick={() => {
                  setShowCostDialog(false);
                  setCostForm({ description: '', cost: '', category: '', note: '' });
                }}
                disabled={addingCost}
                className="flex-1"
              >
                ยกเลิก
              </Button>
              <Button
                onClick={handleAddCost}
                disabled={addingCost || !costForm.description || !costForm.cost}
                isLoading={addingCost}
                className="flex-1"
              >
                <Save className="w-4 h-4 mr-2" />
                บันทึก
              </Button>
            </div>
          </Card>
        </div>
      )}
    </PageLayout>
  );
};

