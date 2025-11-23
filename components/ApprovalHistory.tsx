// Approval History Component - แสดง approval chain
import React from 'react';
import { CheckCircle, XCircle, Clock, User, Shield } from 'lucide-react';
import { Card } from './ui/Card';
import type { Database } from '../types/database';

type Approval = Database['public']['Tables']['ticket_approvals']['Row'];

interface ApprovalHistoryProps {
  ticketId: number;
  approvals: Approval[];
  loading?: boolean;
}

const getLevelLabel = (level: number) => {
  switch (level) {
    case 1:
      return { label: 'ผู้ตรวจสอบ', color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-100 dark:bg-blue-900/20' };
    case 2:
      return { label: 'ผู้จัดการ', color: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-100 dark:bg-indigo-900/20' };
    case 3:
      return { label: 'ผู้บริหาร', color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-100 dark:bg-purple-900/20' };
    default:
      return { label: `Level ${level}`, color: 'text-slate-600 dark:text-slate-400', bg: 'bg-slate-100 dark:bg-slate-800' };
  }
};

export const ApprovalHistory: React.FC<ApprovalHistoryProps> = ({
  ticketId,
  approvals,
  loading = false,
}) => {
  if (loading) {
    return (
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
          ประวัติการอนุมัติ
        </h3>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3 animate-pulse">
              <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700"></div>
              <div className="flex-1">
                <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/3 mb-2"></div>
                <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-1/2"></div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    );
  }

  if (approvals.length === 0) {
    return (
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
          <Shield className="w-5 h-5" />
          ประวัติการอนุมัติ
        </h3>
        <div className="text-center py-8 text-slate-500 dark:text-slate-400">
          <Clock className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>ยังไม่มีการอนุมัติ</p>
        </div>
      </Card>
    );
  }

  // Sort approvals by level (1, 2, 3)
  const sortedApprovals = [...approvals].sort((a, b) => (a.level || 0) - (b.level || 0));

  // Determine current status message
  const getCurrentStatus = () => {
    if (sortedApprovals.length === 0) {
      return '⏳ รอผู้ตรวจสอบอนุมัติ (Level 1)';
    }
    if (sortedApprovals.length === 1) {
      return '✅ ผู้ตรวจสอบอนุมัติแล้ว → ⏳ รอผู้จัดการอนุมัติ (Level 2)';
    }
    if (sortedApprovals.length === 2) {
      return '✅ ผู้ตรวจสอบและผู้จัดการอนุมัติแล้ว → ⏳ รอผู้บริหารอนุมัติ (Level 3)';
    }
    return '✅ อนุมัติครบทุกขั้นตอนแล้ว (Level 1 → 2 → 3)';
  };

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
        <Shield className="w-5 h-5" />
        ประวัติการอนุมัติ ({sortedApprovals.length}/3)
      </h3>
      <p className="text-sm text-slate-600 dark:text-slate-400 mb-4 font-medium">
        {getCurrentStatus()}
      </p>

      <div className="space-y-4">
        {/* Expected approval chain */}
        {[1, 2, 3].map((level) => {
          const approval = sortedApprovals.find(a => a.level === level);
          const levelInfo = getLevelLabel(level);
          const isCompleted = !!approval;
          const isWaiting = !isCompleted && sortedApprovals.some(a => (a.level || 0) < level);

          return (
            <div
              key={level}
              className={`flex items-start gap-4 p-4 rounded-lg border ${
                isCompleted
                  ? 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800'
                  : isWaiting
                  ? 'bg-yellow-50 dark:bg-yellow-900/10 border-yellow-200 dark:border-yellow-800'
                  : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700'
              }`}
            >
              {/* Level Indicator */}
              <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                isCompleted ? levelInfo.bg : 'bg-slate-200 dark:bg-slate-700'
              }`}>
                {isCompleted ? (
                  <CheckCircle className={`w-6 h-6 ${levelInfo.color}`} />
                ) : (
                  <Clock className="w-6 h-6 text-slate-400 dark:text-slate-500" />
                )}
              </div>

              {/* Approval Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-semibold ${levelInfo.color}`}>
                      Level {level}: {levelInfo.label}
                    </span>
                    {isCompleted && (
                      <span className="text-xs bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 px-2 py-0.5 rounded-full">
                        ✅ อนุมัติแล้ว
                      </span>
                    )}
                    {!isCompleted && isWaiting && (
                      <span className="text-xs bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 px-2 py-0.5 rounded-full">
                        ⏳ รอการอนุมัติ
                      </span>
                    )}
                    {!isCompleted && !isWaiting && (
                      <span className="text-xs bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-full">
                        ⚠️ ยังไม่ถึงขั้นตอน
                      </span>
                    )}
                  </div>
                </div>

                {isCompleted ? (
                  <>
                    <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 mb-1">
                      <User className="w-4 h-4" />
                      <span>User ID: {approval.approved_by?.substring(0, 8)}...</span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-500">
                      อนุมัติเมื่อ: {new Date(approval.created_at).toLocaleString('th-TH', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                    {approval.comments && (
                      <p className="text-sm text-slate-700 dark:text-slate-300 mt-2 p-2 bg-white dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700">
                        {approval.comments}
                      </p>
                    )}
                  </>
                ) : (
                  <div className="space-y-1">
                    <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
                      ยังไม่อนุมัติ
                    </p>
                    {level === 1 && (
                      <p className="text-xs text-slate-400 dark:text-slate-500">
                        ⚠️ ต้องอนุมัติ Level 1 ก่อน → Level 2 → Level 3
                      </p>
                    )}
                    {level === 2 && (
                      <p className="text-xs text-slate-400 dark:text-slate-500">
                        ⏳ รอ Level 1 (ผู้ตรวจสอบ) อนุมัติก่อน
                      </p>
                    )}
                    {level === 3 && (
                      <p className="text-xs text-slate-400 dark:text-slate-500">
                        ⏳ รอ Level 1 (ผู้ตรวจสอบ) และ Level 2 (ผู้จัดการ) อนุมัติก่อน
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
};

