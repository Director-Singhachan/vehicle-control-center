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
  Lock,
  Wrench,
  Building2
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card } from '../components/ui/Card';
import { PageLayout } from '../components/layout/PageLayout';
import { ApprovalDialog } from '../components/ApprovalDialog';
import { ApprovalHistory } from '../components/ApprovalHistory';
import { ApprovalStatusBadge } from '../components/ApprovalStatusBadge';
import { useApprovalHistory } from '../hooks/useApprovalHistory';
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
  const { user, profile, isInspector, isManager, isExecutive, isAdmin } = useAuth();
  const { ticket, loading, error, refetch } = useTicket(ticketId);
  const { costs, loading: loadingCosts, refetch: refetchCosts } = useTicketCosts(ticketId);
  const { approvals, loading: loadingApprovals, refetch: refetchApprovals } = useApprovalHistory(ticketId);

  // Auto-fix status if approval history shows all levels approved but status is not updated
  React.useEffect(() => {
    if (!ticket || !approvals || approvals.length === 0) return;

    const approvedLevels = approvals.map(a => {
      if (a.level !== undefined && a.level !== null) return a.level;
      if (a.role_at_approval === 'inspector') return 1;
      if (a.role_at_approval === 'manager') return 2;
      if (a.role_at_approval === 'executive') return 3;
      return 0;
    }).filter(l => l > 0);

    const hasAllLevels = approvedLevels.includes(1) && approvedLevels.includes(2) && approvedLevels.includes(3);

    // If all levels are approved but status is still approved_manager, auto-fix it
    if (hasAllLevels && ticket.status === 'approved_manager') {
      console.log('Auto-fixing status: All levels approved but status is still approved_manager');
      supabase
        .from('tickets')
        .update({ status: 'ready_for_repair' })
        .eq('id', ticketId)
        .then(({ error }) => {
          if (error) {
            console.error('Error auto-fixing status:', error);
          } else {
            refetch();
          }
        });
    }
  }, [ticket, approvals, ticketId, refetch]);

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

  // Repair management states
  const [showStartRepairDialog, setShowStartRepairDialog] = useState(false);
  const [repairForm, setRepairForm] = useState({
    garage: ticket?.garage || '',
    repairDate: '',
  });
  const [startingRepair, setStartingRepair] = useState(false);

  const [showCompleteRepairDialog, setShowCompleteRepairDialog] = useState(false);
  const [completingRepair, setCompletingRepair] = useState(false);

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

  // Get approved levels from approval history (reusable)
  const getApprovedLevels = () => {
    if (!approvals || approvals.length === 0) return [];
    return approvals.map(a => {
      if (a.level !== undefined && a.level !== null) return a.level;
      // Fallback to role_at_approval mapping
      if (a.role_at_approval === 'inspector') return 1;
      if (a.role_at_approval === 'manager') return 2;
      if (a.role_at_approval === 'executive') return 3;
      return 0;
    }).filter(l => l > 0);
  };

  // Check if user can approve - enforce sequential approval
  const canApprove = () => {
    if (!user || !profile) return false;

    // Get approved levels from approval history
    const approvedLevels = getApprovedLevels();

    // Inspector can approve pending tickets (Level 1) - only if Level 1 is not approved yet
    if (isInspector && ticket.status === 'pending' && !approvedLevels.includes(1)) {
      return true;
    }

    // Manager can approve inspector-approved tickets (Level 2) - only if Level 1 is approved and Level 2 is not
    if (isManager && ticket.status === 'approved_inspector' && approvedLevels.includes(1) && !approvedLevels.includes(2)) {
      return true;
    }

    // Executive can approve manager-approved tickets (Level 3) - only if Level 1 and 2 are approved and Level 3 is not
    if (isExecutive && ticket.status === 'approved_manager' && approvedLevels.includes(1) && approvedLevels.includes(2) && !approvedLevels.includes(3)) {
      return true;
    }

    // Admin can approve any status, but still must follow sequential order
    // Admin can approve Level 1 if not approved
    if (isAdmin && ticket.status === 'pending' && !approvedLevels.includes(1)) {
      return true;
    }
    // Admin can approve Level 2 if Level 1 is approved
    if (isAdmin && ticket.status === 'approved_inspector' && approvedLevels.includes(1) && !approvedLevels.includes(2)) {
      return true;
    }
    // Admin can approve Level 3 if Level 1 and 2 are approved
    if (isAdmin && ticket.status === 'approved_manager' && approvedLevels.includes(1) && approvedLevels.includes(2) && !approvedLevels.includes(3)) {
      return true;
    }

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
      // Get approved levels from approval history to enforce sequential approval
      const approvedLevels = getApprovedLevels();

      // Determine new status based on current status and role
      let newStatus: TicketStatus;
      let level = 1;

      if (approvalAction === 'reject') {
        newStatus = 'rejected';
        // Rejection can happen at any level, but we still need to determine which level is rejecting
        if (isInspector) level = 1;
        else if (isManager) level = 2;
        else if (isExecutive) level = 3;
        else if (isAdmin) level = 1; // Admin defaults to level 1 for rejection
      } else {
        // Level 1: Inspector approves pending → approved_inspector
        // Must check that Level 1 is not already approved
        if (ticket.status === 'pending' && (isInspector || isAdmin) && !approvedLevels.includes(1)) {
          level = 1;
          newStatus = 'approved_inspector';
        } 
        // Level 2: Manager approves inspector-approved → approved_manager
        // Must check that Level 1 is approved and Level 2 is not
        else if (ticket.status === 'approved_inspector' && (isManager || isAdmin) && approvedLevels.includes(1) && !approvedLevels.includes(2)) {
          level = 2;
          newStatus = 'approved_manager';
        } 
        // Level 3: Executive approves manager-approved → ready_for_repair
        // Must check that Level 1 and 2 are approved and Level 3 is not
        else if (ticket.status === 'approved_manager' && (isExecutive || isAdmin) && approvedLevels.includes(1) && approvedLevels.includes(2) && !approvedLevels.includes(3)) {
          level = 3;
          newStatus = 'ready_for_repair';
        } 
        else {
          // If we reach here, the approval is not valid
          throw new Error('ไม่สามารถอนุมัติได้ เนื่องจากไม่ผ่านเงื่อนไขการอนุมัติตามลำดับ');
        }
      }

      // Call service to approve (service will also validate sequential approval)
      await ticketService.approveTicket(
        ticketId.toString(),
        level,
        user.id,
        password,
        comment,
        newStatus
      );

      // Refresh data
      await Promise.all([refetch(), refetchApprovals()]);
      
      // Close dialog only after successful approval
      setShowApprovalDialog(false);
      setApprovalAction(null);
    } catch (err: any) {
      console.error('Approval submission error:', err);
      // Re-throw to be caught by ApprovalDialog
      throw err;
    } finally {
      setApproving(false);
    }
  };

  // Handle start repair
  const handleStartRepair = async () => {
    if (!repairForm.garage || !repairForm.repairDate) {
      alert('กรุณากรอกข้อมูลอู่ซ่อมและวันที่เข้าซ่อม');
      return;
    }

    setStartingRepair(true);
    try {
      const { error } = await supabase
        .from('tickets')
        .update({
          status: 'in_progress',
          garage: repairForm.garage,
        })
        .eq('id', ticketId);

      if (error) throw error;

      await refetch();
      setShowStartRepairDialog(false);
      setRepairForm({ garage: '', repairDate: '' });
    } catch (err: any) {
      console.error('Error starting repair:', err);
      alert('เกิดข้อผิดพลาด: ' + (err.message || 'ไม่สามารถเริ่มการซ่อมได้'));
    } finally {
      setStartingRepair(false);
    }
  };

  // Handle complete repair
  const handleCompleteRepair = async () => {
    setCompletingRepair(true);
    try {
      const { error } = await supabase
        .from('tickets')
        .update({
          status: 'completed',
        })
        .eq('id', ticketId);

      if (error) throw error;

      await refetch();
      setShowCompleteRepairDialog(false);
    } catch (err: any) {
      console.error('Error completing repair:', err);
      alert('เกิดข้อผิดพลาด: ' + (err.message || 'ไม่สามารถยืนยันการซ่อมเสร็จได้'));
    } finally {
      setCompletingRepair(false);
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

            {/* Approval Status Badge */}
            <div className="mb-6">
              <ApprovalStatusBadge status={ticket.status} approvals={approvals} />
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
              
              {/* Show current approval step */}
              <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <p className="text-sm text-blue-700 dark:text-blue-300 font-medium mb-2">
                  📋 ขั้นตอนการอนุมัติปัจจุบัน:
                </p>
                {ticket.status === 'pending' && (
                  <div className="space-y-1 text-sm text-blue-600 dark:text-blue-400">
                    <p><strong>Level 1:</strong> รอผู้ตรวจสอบอนุมัติ (คุณสามารถอนุมัติได้)</p>
                    <p className="text-xs text-blue-500 dark:text-blue-500">→ หลังจากนี้จะส่งต่อไปยัง Level 2 (ผู้จัดการ)</p>
                  </div>
                )}
                {ticket.status === 'approved_inspector' && (
                  <div className="space-y-1 text-sm text-blue-600 dark:text-blue-400">
                    <p>✅ <strong>Level 1:</strong> ผู้ตรวจสอบอนุมัติแล้ว</p>
                    <p><strong>Level 2:</strong> รอผู้จัดการอนุมัติ (คุณสามารถอนุมัติได้)</p>
                    <p className="text-xs text-blue-500 dark:text-blue-500">→ หลังจากนี้จะส่งต่อไปยัง Level 3 (ผู้บริหาร)</p>
                  </div>
                )}
                {ticket.status === 'approved_manager' && (() => {
                  const approvedLevels = getApprovedLevels();
                  return (
                    <div className="space-y-1 text-sm text-blue-600 dark:text-blue-400">
                      <p>✅ <strong>Level 1:</strong> ผู้ตรวจสอบอนุมัติแล้ว</p>
                      <p>✅ <strong>Level 2:</strong> ผู้จัดการอนุมัติแล้ว</p>
                      {approvedLevels.includes(3) ? (
                        <>
                          <p>✅ <strong>Level 3:</strong> ผู้บริหารอนุมัติแล้ว</p>
                          <p className="text-xs text-purple-500 dark:text-purple-400">→ อนุมัติครบทุกขั้นตอนแล้ว - สถานะควรเป็น "พร้อมซ่อม"</p>
                        </>
                      ) : (
                        <>
                          <p><strong>Level 3:</strong> รอผู้บริหารอนุมัติ (คุณสามารถอนุมัติได้)</p>
                          <p className="text-xs text-blue-500 dark:text-blue-500">→ หลังจากนี้จะพร้อมซ่อม</p>
                        </>
                      )}
                    </div>
                  );
                })()}
              </div>

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

          {/* Show waiting message if user cannot approve */}
          {!canApprove() && ticket.status !== 'completed' && ticket.status !== 'rejected' && (
            <Card className="p-6">
              <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">
                สถานะการอนุมัติ
              </h2>
              <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                {ticket.status === 'pending' && (
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    ⏳ <strong>รอผู้ตรวจสอบอนุมัติ (Level 1)</strong> - คุณไม่มีสิทธิ์อนุมัติในขั้นตอนนี้
                  </p>
                )}
                {ticket.status === 'approved_inspector' && (
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    ✅ <strong>Level 1:</strong> ผู้ตรวจสอบอนุมัติแล้ว<br />
                    ⏳ <strong>Level 2:</strong> รอผู้จัดการอนุมัติ - คุณไม่มีสิทธิ์อนุมัติในขั้นตอนนี้
                  </p>
                )}
                {ticket.status === 'approved_manager' && (() => {
                  const approvedLevels = getApprovedLevels();
                  return (
                    <>
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        ✅ <strong>Level 1:</strong> ผู้ตรวจสอบอนุมัติแล้ว<br />
                        ✅ <strong>Level 2:</strong> ผู้จัดการอนุมัติแล้ว<br />
                        {approvedLevels.includes(3) ? (
                          <>
                            ✅ <strong>Level 3:</strong> ผู้บริหารอนุมัติแล้ว<br />
                            <span className="text-purple-600 dark:text-purple-400 font-medium">→ สถานะควรเป็น "พร้อมซ่อม" แต่ยังไม่ถูกอัปเดต</span>
                          </>
                        ) : (
                          <>⏳ <strong>Level 3:</strong> รอผู้บริหารอนุมัติ - คุณไม่มีสิทธิ์อนุมัติในขั้นตอนนี้</>
                        )}
                      </p>
                      {approvedLevels.includes(3) && (
                  <div className="mt-4 p-3 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg">
                    <p className="text-sm text-purple-700 dark:text-purple-300 font-medium mb-2">
                      ⚠️ สถานะไม่สอดคล้องกับประวัติการอนุมัติ
                    </p>
                    <p className="text-xs text-purple-600 dark:text-purple-400 mb-3">
                      ประวัติการอนุมัติแสดงว่าผู้บริหารอนุมัติแล้ว แต่สถานะยังไม่ถูกอัปเดต กรุณารีเฟรชหน้าหรือติดต่อผู้ดูแลระบบ
                    </p>
                    <Button
                      size="sm"
                      onClick={async () => {
                        // Try to auto-fix status
                        try {
                          const { error } = await supabase
                            .from('tickets')
                            .update({ status: 'ready_for_repair' })
                            .eq('id', ticketId);
                          
                          if (error) throw error;
                          await refetch();
                        } catch (err: any) {
                          console.error('Error updating status:', err);
                          alert('ไม่สามารถอัปเดตสถานะได้: ' + (err.message || 'เกิดข้อผิดพลาด'));
                        }
                      }}
                      className="w-full"
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      อัปเดตสถานะเป็น "พร้อมซ่อม"
                    </Button>
                  </div>
                      )}
                    </>
                  );
                })()}
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
          {/* Approval History */}
          <ApprovalHistory 
            ticketId={ticketId} 
            approvals={approvals}
            loading={loadingApprovals}
          />

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

      {/* Start Repair Dialog */}
      {showStartRepairDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="p-6 max-w-md w-full">
            <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <Wrench className="w-5 h-5" />
              เริ่มการซ่อม
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  ชื่ออู่ซ่อม <span className="text-red-500">*</span>
                </label>
                <Input
                  type="text"
                  value={repairForm.garage}
                  onChange={(e) => setRepairForm(prev => ({ ...prev, garage: e.target.value }))}
                  placeholder="ระบุชื่ออู่ซ่อม"
                  disabled={startingRepair}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  วันที่เข้าซ่อม <span className="text-red-500">*</span>
                </label>
                <Input
                  type="date"
                  value={repairForm.repairDate}
                  onChange={(e) => setRepairForm(prev => ({ ...prev, repairDate: e.target.value }))}
                  disabled={startingRepair}
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <Button
                variant="outline"
                onClick={() => {
                  setShowStartRepairDialog(false);
                  setRepairForm({ garage: '', repairDate: '' });
                }}
                disabled={startingRepair}
                className="flex-1"
              >
                ยกเลิก
              </Button>
              <Button
                onClick={handleStartRepair}
                disabled={startingRepair || !repairForm.garage || !repairForm.repairDate}
                isLoading={startingRepair}
                className="flex-1"
              >
                <Wrench className="w-4 h-4 mr-2" />
                เริ่มการซ่อม
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Complete Repair Dialog */}
      {showCompleteRepairDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="p-6 max-w-md w-full">
            <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <CheckCircle className="w-5 h-5" />
              ยืนยันการซ่อมเสร็จ
            </h3>

            <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg mb-4">
              <p className="text-sm text-green-700 dark:text-green-300">
                คุณต้องการยืนยันว่าการซ่อมเสร็จสิ้นแล้วหรือไม่?
              </p>
              <p className="text-xs text-green-600 dark:text-green-400 mt-2">
                หลังจากยืนยันแล้ว คุณสามารถลงรายการค่าใช้จ่ายได้
              </p>
            </div>

            <div className="flex gap-3 mt-6">
              <Button
                variant="outline"
                onClick={() => setShowCompleteRepairDialog(false)}
                disabled={completingRepair}
                className="flex-1"
              >
                ยกเลิก
              </Button>
              <Button
                onClick={handleCompleteRepair}
                disabled={completingRepair}
                isLoading={completingRepair}
                className="flex-1"
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                ยืนยันการซ่อมเสร็จ
              </Button>
            </div>
          </Card>
        </div>
      )}
    </PageLayout>
  );
};


