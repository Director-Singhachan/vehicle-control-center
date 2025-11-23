// Approval Status Badge - แสดงสถานะการอนุมัติที่ชัดเจน
import React from 'react';
import { Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import type { Database } from '../types/database';

type TicketStatus = Database['public']['Tables']['tickets']['Row']['status'];

interface ApprovalStatusBadgeProps {
  status: TicketStatus;
  approvals?: Array<{ level: number }>;
}

export const ApprovalStatusBadge: React.FC<ApprovalStatusBadgeProps> = ({
  status,
  approvals = [],
}) => {
  // Get approval levels that have been completed
  // Handle both level column and role_at_approval mapping
  const mapRoleToLevel = (approval: any): number => {
    if (approval.level !== undefined && approval.level !== null) {
      return approval.level;
    }
    // Fallback to role_at_approval mapping
    if (approval.role_at_approval === 'inspector') return 1;
    if (approval.role_at_approval === 'manager') return 2;
    if (approval.role_at_approval === 'executive') return 3;
    return 0;
  };
  
  const approvedLevels = approvals.map(mapRoleToLevel).filter(l => l > 0);
  const hasLevel1 = approvedLevels.includes(1);
  const hasLevel2 = approvedLevels.includes(2);
  const hasLevel3 = approvedLevels.includes(3);

  // Determine current approval status
  // Check approval history to detect if status is out of sync
  const getApprovalStatus = () => {
    // If all 3 levels are approved but status is still approved_manager, show ready_for_repair
    if (hasLevel1 && hasLevel2 && hasLevel3 && status === 'approved_manager') {
      return {
        message: 'อนุมัติครบทุกขั้นตอนแล้ว → พร้อมซ่อม',
        color: 'text-purple-600 dark:text-purple-400',
        bg: 'bg-purple-50 dark:bg-purple-900/20',
        border: 'border-purple-200 dark:border-purple-800',
        icon: CheckCircle,
      };
    }

    if (status === 'rejected') {
      return {
        message: 'ถูกปฏิเสธ',
        color: 'text-red-600 dark:text-red-400',
        bg: 'bg-red-50 dark:bg-red-900/20',
        border: 'border-red-200 dark:border-red-800',
        icon: XCircle,
      };
    }

    if (status === 'pending') {
      return {
        message: 'รอผู้ตรวจสอบอนุมัติ (Level 1)',
        color: 'text-yellow-600 dark:text-yellow-400',
        bg: 'bg-yellow-50 dark:bg-yellow-900/20',
        border: 'border-yellow-200 dark:border-yellow-800',
        icon: Clock,
      };
    }

    if (status === 'approved_inspector') {
      // If Level 2 is already approved but status is still approved_inspector, show next step
      if (hasLevel2) {
        return {
          message: 'ผู้จัดการอนุมัติแล้ว → รอผู้บริหารอนุมัติ (Level 3)',
          color: 'text-indigo-600 dark:text-indigo-400',
          bg: 'bg-indigo-50 dark:bg-indigo-900/20',
          border: 'border-indigo-200 dark:border-indigo-800',
          icon: AlertCircle,
        };
      }
      return {
        message: 'ผู้ตรวจสอบอนุมัติแล้ว → รอผู้จัดการอนุมัติ (Level 2)',
        color: 'text-blue-600 dark:text-blue-400',
        bg: 'bg-blue-50 dark:bg-blue-900/20',
        border: 'border-blue-200 dark:border-blue-800',
        icon: AlertCircle,
      };
    }

    if (status === 'approved_manager') {
      // If Level 3 is already approved but status is still approved_manager, show ready_for_repair
      if (hasLevel3) {
        return {
          message: 'อนุมัติครบทุกขั้นตอนแล้ว → พร้อมซ่อม',
          color: 'text-purple-600 dark:text-purple-400',
          bg: 'bg-purple-50 dark:bg-purple-900/20',
          border: 'border-purple-200 dark:border-purple-800',
          icon: CheckCircle,
        };
      }
      return {
        message: 'ผู้จัดการอนุมัติแล้ว → รอผู้บริหารอนุมัติ (Level 3)',
        color: 'text-indigo-600 dark:text-indigo-400',
        bg: 'bg-indigo-50 dark:bg-indigo-900/20',
        border: 'border-indigo-200 dark:border-indigo-800',
        icon: AlertCircle,
      };
    }

    if (status === 'ready_for_repair') {
      return {
        message: 'อนุมัติครบทุกขั้นตอนแล้ว → พร้อมซ่อม',
        color: 'text-purple-600 dark:text-purple-400',
        bg: 'bg-purple-50 dark:bg-purple-900/20',
        border: 'border-purple-200 dark:border-purple-800',
        icon: CheckCircle,
      };
    }

    if (status === 'in_progress') {
      return {
        message: 'กำลังซ่อม',
        color: 'text-orange-600 dark:text-orange-400',
        bg: 'bg-orange-50 dark:bg-orange-900/20',
        border: 'border-orange-200 dark:border-orange-800',
        icon: AlertCircle,
      };
    }

    if (status === 'completed') {
      return {
        message: 'เสร็จสิ้น',
        color: 'text-green-600 dark:text-green-400',
        bg: 'bg-green-50 dark:bg-green-900/20',
        border: 'border-green-200 dark:border-green-800',
        icon: CheckCircle,
      };
    }

    return {
      message: 'ไม่ทราบสถานะ',
      color: 'text-slate-600 dark:text-slate-400',
      bg: 'bg-slate-50 dark:bg-slate-800',
      border: 'border-slate-200 dark:border-slate-700',
      icon: AlertCircle,
    };
  };

  const statusInfo = getApprovalStatus();
  const StatusIcon = statusInfo.icon;

  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border ${statusInfo.bg} ${statusInfo.border} ${statusInfo.color}`}>
      <StatusIcon className="w-4 h-4" />
      <span className="text-sm font-medium">{statusInfo.message}</span>
    </div>
  );
};

