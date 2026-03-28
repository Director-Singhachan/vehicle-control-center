// Ticket Detail View - Show detailed information about a ticket with approval workflow
import React, { useState } from 'react';
import { useFeatureAccess, useTicket, useTicketCosts, useAuth } from '../hooks';
import { ticketService, maintenanceService } from '../services';
import { supabase } from '../lib/supabase';
import { pdfService } from '../services/pdfService';
import { useDataCacheStore, createCacheKey } from '../stores/dataCacheStore';
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
  Building2,
  Image as ImageIcon,
  Download,
  ZoomIn
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card } from '../components/ui/Card';
import { PageLayout } from '../components/layout/PageLayout';
import { Avatar } from '../components/ui/Avatar';
import { ApprovalDialog } from '../components/ApprovalDialog';
import { ApprovalHistory } from '../components/ApprovalHistory';
import { ApprovalStatusBadge } from '../components/ApprovalStatusBadge';
import { useApprovalHistory } from '../hooks/useApprovalHistory';
import { getBranchLabel } from '../utils/branchLabels';
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
  console.log('[TicketDetailView] Component mounted/rendered with ticketId:', ticketId, 'type:', typeof ticketId);
  
  // Validate ticketId
  if (!ticketId || (typeof ticketId === 'number' && isNaN(ticketId))) {
    console.error('[TicketDetailView] Invalid ticketId:', ticketId);
    return (
      <PageLayout title="ข้อผิดพลาด" subtitle="ไม่พบข้อมูลตั๋ว">
        <Card className="p-6">
          <p className="text-red-600">ไม่พบข้อมูลตั๋ว (ID: {ticketId})</p>
          {onBack && (
            <Button onClick={onBack} className="mt-4">
              กลับไปรายการ
            </Button>
          )}
        </Card>
      </PageLayout>
    );
  }
  
  const { user, profile, isInspector, isManager, isExecutive, isAdmin } = useAuth();
  const { can, loading: featureAccessLoading } = useFeatureAccess();
  const canManageApprovals = !featureAccessLoading && can('tab.approvals', 'manage');
  const { ticket, loading, error, refetch } = useTicket(ticketId);
  
  console.log('[TicketDetailView] useTicket result:', { 
    hasTicket: !!ticket, 
    loading, 
    error: error?.message,
    ticketId 
  });
  const { costs, loading: loadingCosts, refetch: refetchCosts } = useTicketCosts(ticketId);
  const { approvals, loading: loadingApprovals, refetch: refetchApprovals } = useApprovalHistory(ticketId);
  const cache = useDataCacheStore();

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
      (supabase.from('tickets') as any).update({ status: 'ready_for_repair' })
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
  // Repair management states
  const [showStartRepairDialog, setShowStartRepairDialog] = useState(false);
  const [expandedImage, setExpandedImage] = useState<{ src: string; alt: string } | null>(null);
  const [repairForm, setRepairForm] = useState({
    garage: ticket?.garage || '',
    repairDate: new Date().toISOString().split('T')[0],
    expectedCompletionDate: '',
    assignedTo: '',
    notes: '',
  });
  const [startingRepair, setStartingRepair] = useState(false);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [vehicleData, setVehicleData] = useState<any>(null);

  const [showCompleteRepairDialog, setShowCompleteRepairDialog] = useState(false);
  const [completingRepair, setCompletingRepair] = useState(false);

  // Last repair history state
  const [lastRepairHistory, setLastRepairHistory] = useState<any | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Signed PDF upload state
  const [uploadingPDF, setUploadingPDF] = useState(false);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [showUploadSuccess, setShowUploadSuccess] = useState(false);

  // Fetch vehicle data for image
  React.useEffect(() => {
    if (ticket?.vehicle_id) {
      supabase
        .from('vehicles')
        .select('*')
        .eq('id', ticket.vehicle_id)
        .single()
        .then(({ data, error }) => {
          if (error) {
            console.warn('[TicketDetail] Error fetching vehicle:', error);
            return;
          }
          if (data) setVehicleData(data);
        });
    }
  }, [ticket?.vehicle_id]);

  // Fetch profiles for assignment
  React.useEffect(() => {
    if (showStartRepairDialog) {
      supabase
        .from('profiles')
        .select('*')
        .order('full_name')
        .then(({ data }) => {
          if (data) setProfiles(data);
        });
    }
  }, [showStartRepairDialog]);

  // Fetch last repair history of same type
  React.useEffect(() => {
    if (ticket?.vehicle_id && ticket?.repair_type) {
      setLoadingHistory(true);
      supabase
        .from('maintenance_history')
        .select('*')
        .eq('vehicle_id', ticket.vehicle_id)
        .eq('maintenance_name', ticket.repair_type)
        .order('performed_at', { ascending: false })
        .limit(1)
        .then(({ data, error }) => {
          if (error) {
            console.warn('[TicketDetail] Error fetching repair history:', error);
          } else if (data && data.length > 0) {
            setLastRepairHistory(data[0]);
          } else {
            setLastRepairHistory(null);
          }
          setLoadingHistory(false);
        });
    }
  }, [ticket?.vehicle_id, ticket?.repair_type]);

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
    if (!canManageApprovals) return false;

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
    if (!canManageApprovals) return false;
    return isInspector || isManager || isAdmin;
  };

  // Check if user can start repair
  const canStartRepair = () => {
    if (!user || !profile) return false;
    if (!canManageApprovals) return false;
    // Only Inspector, Manager, Admin can start repair
    if (!isInspector && !isManager && !isAdmin) return false;

    return ticket.status === 'ready_for_repair';
  };

  // Check if user can complete repair
  const canCompleteRepair = () => {
    if (!user || !profile) return false;
    if (!canManageApprovals) return false;
    // Only Inspector, Manager, Admin can complete repair
    if (!isInspector && !isManager && !isAdmin) return false;

    return ticket.status === 'in_progress';
  };

  const handleApproveClick = (action: 'approve' | 'reject') => {
    if (!canApprove()) return;
    setApprovalAction(action);
    setShowApprovalDialog(true);
  };

  const handleApprovalSubmit = async (password: string, comment: string) => {
    if (!user || !profile) return;
    if (!canApprove()) {
      throw new Error('คุณไม่มีสิทธิ์อนุมัติรายการนี้');
    }

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

      // Invalidate cache for tickets-with-relations to force ApprovalBoardView to refetch
      // This ensures the ticket moves to the correct column immediately
      // Invalidate all tickets-with-relations cache entries by pattern
      const cacheStore = cache as any;
      if (cacheStore.cache && cacheStore.cache instanceof Map) {
        const keysToInvalidate: string[] = [];
        cacheStore.cache.forEach((value: any, key: string) => {
          if (key.startsWith('tickets-with-relations:')) {
            keysToInvalidate.push(key);
          }
        });
        if (keysToInvalidate.length > 0) {
          cache.invalidate(keysToInvalidate);
        }
      }

      // Also invalidate specific cache keys that might be used
      cache.invalidate([
        createCacheKey('tickets-with-relations', {}),
        createCacheKey('tickets', {}),
      ]);

      // Dispatch custom event to notify other components (like ApprovalBoardView) to refetch
      window.dispatchEvent(new CustomEvent('ticket-approved', {
        detail: { ticketId, newStatus }
      }));

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
    if (!canStartRepair()) {
      return;
    }
    if (!repairForm.garage || !repairForm.repairDate) {
      alert('กรุณากรอกข้อมูลอู่ซ่อมและวันที่เข้าซ่อม');
      return;
    }

    setStartingRepair(true);
    try {
      await ticketService.startRepair(ticketId, {
        garage: repairForm.garage,
        repair_start_date: new Date(repairForm.repairDate).toISOString(),
        repair_expected_completion: repairForm.expectedCompletionDate ? new Date(repairForm.expectedCompletionDate).toISOString() : undefined,
        repair_assigned_to: repairForm.assignedTo || undefined,
        repair_notes: repairForm.notes || undefined,
      });

      await refetch();
      setShowStartRepairDialog(false);
    } catch (err: any) {
      console.error('Error starting repair:', err);
      alert('เกิดข้อผิดพลาด: ' + (err.message || 'ไม่สามารถเริ่มการซ่อมได้'));
    } finally {
      setStartingRepair(false);
    }
  };

  // Handle complete repair
  const handleCompleteRepair = async () => {
    if (!canCompleteRepair()) {
      return;
    }
    setCompletingRepair(true);
    try {
      // 1. Create maintenance history
      await maintenanceService.createHistoryFromTicket(ticket, costs);

      // 2. Update ticket status
      await ticketService.completeRepair(ticketId);

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
    if (!canUpdateStatus()) {
      return;
    }
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
          <Button
            variant="outline"
            onClick={() => pdfService.generateMaintenanceTicketPDF({
              id: ticket.id.toString(),
              ticket_number: ticket.ticket_number,
              vehicle_plate: ticket.vehicle_plate,
              // Use vehicle info from ticket view / vehicle table (fallbacks)
              vehicle_make: ticket.vehicle_make || (ticket as any).vehicle_make || vehicleData?.make,
              vehicle_model: ticket.vehicle_model || (ticket as any).vehicle_model || vehicleData?.model,
              vehicle_type: (ticket as any).vehicle_type,
              branch: (ticket as any).branch,
              reporter_name: (ticket as any).reporter_name,
              reporter_email: ticket.reporter_email,
              // Normalize fields for PDF: support both table + view naming
              problem: (ticket as any).repair_type || ticket.problem,
              description: (ticket as any).problem_description || ticket.description,
              urgency: ticket.urgency,
              status: ticket.status,
              created_at: ticket.created_at,
              odometer: ticket.odometer,
              garage: ticket.garage,
              notes: ticket.notes,
              last_repair_date: lastRepairHistory?.performed_at,
              last_repair_description: lastRepairHistory?.description || lastRepairHistory?.maintenance_name,
              last_repair_garage: lastRepairHistory?.garage
            })}
          >
            <Download className="w-4 h-4 mr-2" />
            ดาวน์โหลด PDF
          </Button>
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

              <div>
                <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">
                  ผู้รายงาน
                </label>
                <div className="flex items-center gap-2">
                  {(ticket as any).reporter_avatar_url ? (
                    <button
                      onClick={() => setExpandedImage({
                        src: (ticket as any).reporter_avatar_url,
                        alt: (ticket as any).reporter_name || 'Reporter'
                      })}
                      className="relative group cursor-pointer transition-transform hover:scale-105"
                      title="คลิกเพื่อขยายรูป"
                    >
                      <Avatar
                        src={(ticket as any).reporter_avatar_url}
                        alt={(ticket as any).reporter_name || 'Reporter'}
                        size="sm"
                        fallback={(ticket as any).reporter_name}
                        className="ring-2 ring-transparent group-hover:ring-enterprise-500 transition-all"
                      />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/20 rounded-full transition-colors">
                        <ZoomIn size={12} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </button>
                  ) : (
                    <Avatar
                      src={(ticket as any).reporter_avatar_url}
                      alt={(ticket as any).reporter_name || 'Reporter'}
                      size="sm"
                      fallback={(ticket as any).reporter_name}
                    />
                  )}
                  <p className="text-lg text-slate-900 dark:text-white">
                    {(ticket as any).reporter_name || '-'}
                  </p>
                </div>
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

          {/* Repair Actions */}
          {(canStartRepair() || canCompleteRepair()) && (
            <Card className="p-6">
              <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <Wrench className="w-5 h-5" />
                การดำเนินการซ่อม
              </h2>

              {canStartRepair() && (
                <div className="space-y-4">
                  <div className="p-3 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg">
                    <p className="text-sm text-purple-700 dark:text-purple-300 font-medium mb-2">
                      พร้อมสำหรับการซ่อม
                    </p>
                    <p className="text-sm text-purple-600 dark:text-purple-400">
                      ตั๋วนี้ได้รับการอนุมัติครบทุกขั้นตอนแล้ว คุณสามารถเริ่มดำเนินการซ่อมได้
                    </p>
                  </div>
                  <Button
                    onClick={() => setShowStartRepairDialog(true)}
                    className="w-full"
                  >
                    <Wrench className="w-4 h-4 mr-2" />
                    ส่งเข้าซ่อม
                  </Button>
                </div>
              )}

              {canCompleteRepair() && (
                <div className="space-y-4">
                  <div className="p-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg">
                    <p className="text-sm text-orange-700 dark:text-orange-300 font-medium mb-2">
                      กำลังดำเนินการซ่อม
                    </p>
                    <p className="text-sm text-orange-600 dark:text-orange-400">
                      เมื่อการซ่อมเสร็จสิ้น กรุณากดปุ่มด้านล่างเพื่อยืนยันและบันทึกประวัติ
                    </p>
                  </div>
                  <Button
                    onClick={() => setShowCompleteRepairDialog(true)}
                    className="w-full bg-green-600 hover:bg-green-700 text-white"
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    ยืนยันซ่อมเสร็จ
                  </Button>
                </div>
              )}
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
                                const { error } = await (supabase.from('tickets') as any).update({ status: 'ready_for_repair' })
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

          {/* Repair Info Card */}
          {(ticket.status === 'in_progress' || ticket.status === 'completed') && (
            <Card className="p-6">
              <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <Wrench className="w-5 h-5" />
                ข้อมูลการซ่อม
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">
                    อู่ซ่อม
                  </label>
                  <p className="text-lg text-slate-900 dark:text-white">
                    {ticket.garage || '-'}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">
                    ผู้รับผิดชอบ
                  </label>
                  {ticket.repair_assigned_to ? (() => {
                    const assignedProfile = profiles.find(p => p.id === ticket.repair_assigned_to);
                    return (
                      <div className="flex items-center gap-2">
                        {assignedProfile?.avatar_url ? (
                          <button
                            onClick={() => setExpandedImage({
                              src: assignedProfile.avatar_url,
                              alt: assignedProfile.full_name || 'ผู้รับผิดชอบ'
                            })}
                            className="relative group cursor-pointer transition-transform hover:scale-105"
                            title="คลิกเพื่อขยายรูป"
                          >
                            <Avatar
                              src={assignedProfile.avatar_url}
                              alt={assignedProfile.full_name || 'ผู้รับผิดชอบ'}
                              size="sm"
                              fallback={assignedProfile.full_name}
                              className="ring-2 ring-transparent group-hover:ring-enterprise-500 transition-all"
                            />
                            <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/20 rounded-full transition-colors">
                              <ZoomIn size={12} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                          </button>
                        ) : (
                          <Avatar
                            src={assignedProfile?.avatar_url}
                            alt={assignedProfile?.full_name || 'ผู้รับผิดชอบ'}
                            size="sm"
                            fallback={assignedProfile?.full_name}
                          />
                        )}
                        <p className="text-lg text-slate-900 dark:text-white">
                          {assignedProfile?.full_name || 'ไม่ระบุชื่อ'}
                        </p>
                      </div>
                    );
                  })() : (
                    <p className="text-lg text-slate-900 dark:text-white">-</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">
                    วันที่เข้าซ่อม
                  </label>
                  <p className="text-lg text-slate-900 dark:text-white flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    {ticket.repair_start_date ? new Date(ticket.repair_start_date).toLocaleDateString('th-TH') : '-'}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">
                    วันที่คาดว่าจะเสร็จ
                  </label>
                  <p className="text-lg text-slate-900 dark:text-white flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    {ticket.repair_expected_completion ? new Date(ticket.repair_expected_completion).toLocaleDateString('th-TH') : '-'}
                  </p>
                </div>
                {ticket.repair_notes && (
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">
                      หมายเหตุ
                    </label>
                    <p className="text-slate-900 dark:text-white">
                      {ticket.repair_notes}
                    </p>
                  </div>
                )}
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
          {/* Vehicle Details */}
          {(ticket.vehicle_plate || (ticket as any).make || (ticket as any).model) && (
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <Truck className="w-5 h-5" />
                ข้อมูลรถ
              </h3>

              {/* Vehicle Image */}
              {vehicleData?.image_url ? (
                <div className="rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-800 mb-4">
                  <img
                    src={vehicleData.image_url}
                    alt={vehicleData.plate || ticket.vehicle_plate || 'Vehicle'}
                    className="w-full h-48 object-cover"
                    onError={(e) => {
                      e.currentTarget.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2VlZSIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IiM5OTkiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5ObyBJbWFnZTwvdGV4dD48L3N2Zz4=';
                    }}
                  />
                </div>
              ) : (
                <div className="rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-800 h-32 flex items-center justify-center mb-4">
                  <div className="text-center">
                    <Truck className="w-8 h-8 mx-auto mb-1 text-slate-400" />
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      ไม่มีรูปภาพ
                    </p>
                  </div>
                </div>
              )}

              <div className="space-y-3">
                {ticket.vehicle_plate && (
                  <div>
                    <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                      ทะเบียน
                    </label>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">
                      {ticket.vehicle_plate}
                    </p>
                  </div>
                )}
                {((ticket as any).make || (ticket as any).model) && (
                  <div>
                    <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                      ยี่ห้อ/รุ่น
                    </label>
                    <p className="text-sm text-slate-900 dark:text-white">
                      {(ticket as any).make} {(ticket as any).model}
                    </p>
                  </div>
                )}
                {(ticket as any).vehicle_type && (
                  <div>
                    <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                      ประเภท
                    </label>
                    <p className="text-sm text-slate-900 dark:text-white">
                      {(ticket as any).vehicle_type}
                    </p>
                  </div>
                )}
                {(ticket as any).branch && (
                  <div>
                    <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                      สาขา
                    </label>
                    <p className="text-sm text-slate-900 dark:text-white flex items-center gap-1">
                      <Building2 className="w-3 h-3" />
                      {getBranchLabel((ticket as any).branch)}
                    </p>
                  </div>
                )}
              </div>
            </Card>
          )}

          {/* Last Repair History */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <Wrench className="w-5 h-5" />
              ประวัติการซ่อมครั้งล่าสุด
            </h3>
            {loadingHistory ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">กำลังโหลด...</p>
            ) : lastRepairHistory ? (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                    ประเภท
                  </label>
                  <p className="text-sm text-slate-900 dark:text-white">
                    {lastRepairHistory.maintenance_name}
                  </p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                    วันที่ซ่อม
                  </label>
                  <p className="text-sm text-slate-900 dark:text-white flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {new Date(lastRepairHistory.performed_at).toLocaleDateString('th-TH')}
                  </p>
                </div>
                {lastRepairHistory.odometer && (
                  <div>
                    <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                      เลขไมล์
                    </label>
                    <p className="text-sm text-slate-900 dark:text-white">
                      {lastRepairHistory.odometer.toLocaleString()} กม.
                    </p>
                  </div>
                )}
                {lastRepairHistory.cost && (
                  <div>
                    <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                      ค่าใช้จ่าย
                    </label>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-1">
                      <DollarSign className="w-3 h-3" />
                      ฿{lastRepairHistory.cost.toLocaleString()}
                    </p>
                  </div>
                )}
                {lastRepairHistory.description && (
                  <div>
                    <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                      รายละเอียด
                    </label>
                    <p className="text-xs text-slate-600 dark:text-slate-400">
                      {lastRepairHistory.description}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                ไม่มีประวัติการซ่อมประเภทนี้
              </p>
            )}
          </Card>

          {/* Approval History */}
          <ApprovalHistory
            ticketId={ticketId}
            approvals={approvals}
            loading={loadingApprovals}
          />

          {/* Upload Signed PDF */}
          {canManageApprovals && (isInspector || isManager || isExecutive) && (
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5" />
                อัปโหลด PDF ที่เซ็นแล้ว
              </h3>

              <div className="space-y-4">
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <p className="text-sm text-blue-700 dark:text-blue-300 font-medium mb-2">
                    📋 วิธีส่ง PDF ที่เซ็นแล้ว:
                  </p>
                  <ul className="text-sm text-blue-600 dark:text-blue-400 space-y-1 list-disc list-inside">
                    <li>วิธีที่ 1: ส่ง PDF ผ่าน Telegram Bot พร้อมระบุเลขที่ตั๋ว (เช่น "Ticket #2501-001")</li>
                    <li>วิธีที่ 2: อัปโหลด PDF ผ่านระบบด้านล่าง</li>
                  </ul>
                </div>

                {/* Show existing signatures */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {ticket.inspector_signature_url && (
                    <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                      <p className="text-sm font-medium text-green-700 dark:text-green-300 mb-2">
                        ✅ ผู้ตรวจสอบ (Level 1)
                      </p>
                      <a
                        href={ticket.inspector_signature_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-green-600 dark:text-green-400 hover:underline flex items-center gap-1"
                      >
                        <Download className="w-3 h-3" />
                        ดู PDF ที่เซ็นแล้ว
                      </a>
                      {ticket.inspector_signed_at && (
                        <p className="text-xs text-green-500 dark:text-green-500 mt-1">
                          {new Date(ticket.inspector_signed_at).toLocaleString('th-TH')}
                        </p>
                      )}
                    </div>
                  )}
                  {ticket.manager_signature_url && (
                    <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg">
                      <p className="text-sm font-medium text-indigo-700 dark:text-indigo-300 mb-2">
                        ✅ ผู้จัดการ (Level 2)
                      </p>
                      <a
                        href={ticket.manager_signature_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                      >
                        <Download className="w-3 h-3" />
                        ดู PDF ที่เซ็นแล้ว
                      </a>
                      {ticket.manager_signed_at && (
                        <p className="text-xs text-indigo-500 dark:text-indigo-500 mt-1">
                          {new Date(ticket.manager_signed_at).toLocaleString('th-TH')}
                        </p>
                      )}
                    </div>
                  )}
                  {ticket.executive_signature_url && (
                    <div className="p-3 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg">
                      <p className="text-sm font-medium text-purple-700 dark:text-purple-300 mb-2">
                        ✅ ผู้บริหาร (Level 3)
                      </p>
                      <a
                        href={ticket.executive_signature_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1"
                      >
                        <Download className="w-3 h-3" />
                        ดู PDF ที่เซ็นแล้ว
                      </a>
                      {ticket.executive_signed_at && (
                        <p className="text-xs text-purple-500 dark:text-purple-500 mt-1">
                          {new Date(ticket.executive_signed_at).toLocaleString('th-TH')}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Upload form */}
                <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-4">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    เลือกไฟล์ PDF ที่เซ็นแล้ว
                  </label>
                  <input
                    type="file"
                    accept=".pdf,application/pdf"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
                          alert('กรุณาเลือกไฟล์ PDF เท่านั้น');
                          return;
                        }
                        setPdfFile(file);
                      }
                    }}
                    className="block w-full text-sm text-slate-500 dark:text-slate-400
                      file:mr-4 file:py-2 file:px-4
                      file:rounded-lg file:border-0
                      file:text-sm file:font-semibold
                      file:bg-enterprise-50 file:text-enterprise-700
                      hover:file:bg-enterprise-100
                      dark:file:bg-enterprise-900/30 dark:file:text-enterprise-300
                      dark:hover:file:bg-enterprise-900/50
                      cursor-pointer"
                    disabled={uploadingPDF}
                  />
                  {pdfFile && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                      ไฟล์ที่เลือก: {pdfFile.name} ({(pdfFile.size / 1024).toFixed(2)} KB)
                    </p>
                  )}

                  <Button
                    onClick={async () => {
                      if (!pdfFile) {
                        alert('กรุณาเลือกไฟล์ PDF');
                        return;
                      }

                      // Determine user role
                      let role: 'inspector' | 'manager' | 'executive' | null = null;
                      if (isInspector) role = 'inspector';
                      else if (isManager) role = 'manager';
                      else if (isExecutive) role = 'executive';

                      if (!role) {
                        alert('คุณไม่มีสิทธิ์อัปโหลด PDF ที่เซ็นแล้ว');
                        return;
                      }

                      setUploadingPDF(true);
                      try {
                        await ticketService.uploadSignedPDF(ticketId, pdfFile, role);
                        setShowUploadSuccess(true);
                        setPdfFile(null);
                        // Reset file input
                        const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
                        if (fileInput) fileInput.value = '';
                        await refetch();
                      } catch (error: any) {
                        console.error('Error uploading PDF:', error);
                        alert('เกิดข้อผิดพลาดในการอัปโหลด: ' + (error.message || 'Unknown error'));
                      } finally {
                        setUploadingPDF(false);
                      }
                    }}
                    disabled={!pdfFile || uploadingPDF}
                    className="mt-4 w-full"
                  >
                    {uploadingPDF ? (
                      <>
                        <Clock className="w-4 h-4 mr-2 animate-spin" />
                        กำลังอัปโหลด...
                      </>
                    ) : (
                      <>
                        <FileText className="w-4 h-4 mr-2" />
                        อัปโหลด PDF ที่เซ็นแล้ว
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {/* Issue Images */}
          {ticket.image_urls && Array.isArray(ticket.image_urls) && (ticket.image_urls as string[]).length > 0 && (
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <ImageIcon className="w-5 h-5" />
                รูปแจ้งซ่อม ({(ticket.image_urls as string[]).length})
              </h3>
              <div className="grid grid-cols-1 gap-3">
                {(ticket.image_urls as string[]).map((url, index) => (
                  <div key={index} className="rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-800">
                    <img
                      src={url}
                      alt={`Issue ${index + 1}`}
                      className="w-full h-48 object-cover cursor-pointer hover:opacity-90 transition-opacity"
                      onClick={() => window.open(url, '_blank')}
                      onError={(e) => {
                        e.currentTarget.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2VlZSIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IiM5OTkiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5JbWFnZSBFcnJvcjwvdGV4dD48L3N2Zz4=';
                      }}
                    />
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 text-center">
                      คลิกเพื่อดูขนาดเต็ม
                    </p>
                  </div>
                ))}
              </div>
            </Card>
          )}

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
      </div >

      <ApprovalDialog
        isOpen={showApprovalDialog}
        onClose={() => setShowApprovalDialog(false)}
        onConfirm={handleApprovalSubmit}
        title={`ยืนยันการ${approvalAction === 'approve' ? 'อนุมัติ' : 'ปฏิเสธ'}`}
        message={`กรุณากรอกรหัสผ่านเพื่อยืนยันการ${approvalAction === 'approve' ? 'อนุมัติ' : 'ปฏิเสธ'}ตั๋วนี้`}
        isLoading={approving}
      />

      {/* Add Cost Dialog */}
      {
        showCostDialog && (
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
        )
      }

      {/* Start Repair Dialog */}
      {
        showStartRepairDialog && (
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

                <div className="grid grid-cols-2 gap-4">
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
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      วันที่คาดว่าจะเสร็จ
                    </label>
                    <Input
                      type="date"
                      value={repairForm.expectedCompletionDate}
                      onChange={(e) => setRepairForm(prev => ({ ...prev, expectedCompletionDate: e.target.value }))}
                      disabled={startingRepair}
                      min={repairForm.repairDate}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    ผู้รับผิดชอบ
                  </label>
                  <select
                    value={repairForm.assignedTo}
                    onChange={(e) => setRepairForm(prev => ({ ...prev, assignedTo: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-enterprise-500 focus:border-transparent"
                    disabled={startingRepair}
                  >
                    <option value="">เลือกผู้รับผิดชอบ</option>
                    {profiles.map(p => (
                      <option key={p.id} value={p.id}>{p.full_name || p.email}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    หมายเหตุ
                  </label>
                  <textarea
                    value={repairForm.notes}
                    onChange={(e) => setRepairForm(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="รายละเอียดเพิ่มเติม..."
                    rows={3}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-enterprise-500 focus:border-transparent resize-none"
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
        )
      }

      {/* Complete Repair Dialog */}
      {
        showCompleteRepairDialog && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <Card className="p-6 max-w-md w-full">
              <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <CheckCircle className="w-5 h-5" />
                ยืนยันการซ่อมเสร็จ
              </h3>

              <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg mb-4">
                <p className="text-sm text-green-700 dark:text-green-300 font-medium mb-2">
                  ยืนยันการซ่อมเสร็จสิ้น?
                </p>
                <div className="space-y-1 text-sm text-green-600 dark:text-green-400">
                  <p>• สถานะตั๋วจะเปลี่ยนเป็น "เสร็จสิ้น"</p>
                  <p>• ข้อมูลการซ่อมจะถูกบันทึกลงในประวัติการบำรุงรักษา</p>
                  <p>• คุณสามารถเพิ่มค่าใช้จ่ายเพิ่มเติมได้หลังจากนี้</p>
                </div>
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
        )
      }

      {/* Image Expansion Modal */}
      {expandedImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={() => setExpandedImage(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] w-full">
            <button
              onClick={() => setExpandedImage(null)}
              className="absolute -top-12 right-0 text-white hover:text-slate-300 transition-colors p-2"
              aria-label="ปิด"
            >
              <X size={24} />
            </button>
            <div className="bg-white dark:bg-slate-800 rounded-lg overflow-hidden shadow-2xl">
              <img
                src={expandedImage.src}
                alt={expandedImage.alt}
                className="w-full h-auto max-h-[80vh] object-contain"
                onClick={(e) => e.stopPropagation()}
              />
              <div className="p-4 border-t border-slate-200 dark:border-slate-700">
                <p className="text-center text-slate-700 dark:text-slate-300 font-medium">
                  {expandedImage.alt}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Upload Success Modal */}
      {showUploadSuccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <Card className="p-8 max-w-sm w-full bg-white dark:bg-slate-800 shadow-2xl transform transition-all scale-100 animate-in zoom-in-95 duration-200 text-center">
            <div className="mx-auto w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-6">
              <CheckCircle className="w-10 h-10 text-green-600 dark:text-green-400 animate-in zoom-in duration-300 delay-150" />
            </div>
            <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
              อัปโหลดสำเร็จ!
            </h3>
            <p className="text-slate-600 dark:text-slate-400 mb-8">
              ไฟล์ PDF ที่เซ็นแล้วถูกบันทึกเรียบร้อยแล้ว
            </p>
            <Button
              onClick={() => setShowUploadSuccess(false)}
              className="w-full bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-600/20"
              size="lg"
            >
              ตกลง
            </Button>
          </Card>
        </div>
      )}
    </PageLayout >
  );
};


