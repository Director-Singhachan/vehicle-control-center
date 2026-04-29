// Role-based Dashboard - แสดงข้อมูลตาม role
import React from 'react';
import { useAuth } from '../hooks';
import { useTickets } from '../hooks/useTickets';
import { 
  Clock, 
  CheckCircle, 
  AlertCircle, 
  FileText,
  TrendingUp,
  Activity
} from 'lucide-react';
import { StatusCard } from '../components/StatusCard';
import { Card } from '../components/ui/Card';
import { PageLayout } from '../components/layout/PageLayout';
import { Button } from '../components/ui/Button';

interface RoleDashboardViewProps {
  isDark: boolean;
  onNavigateToTickets?: () => void;
  onNavigateToTicketDetail?: (ticketId: number) => void;
}

export const RoleDashboardView: React.FC<RoleDashboardViewProps> = ({ 
  isDark,
  onNavigateToTickets,
  onNavigateToTicketDetail,
}) => {
  const { profile, isInspector, isManager, isExecutive, isAdmin, isDev } = useAuth();
  
  // Get tickets based on role
  const pendingStatus = isInspector ? ['pending'] : 
                       isManager ? ['approved_inspector'] : 
                       isExecutive ? ['approved_manager'] : [];
  
  const { tickets: pendingTickets, loading: loadingPending } = useTickets({ 
    filters: { status: pendingStatus },
    autoFetch: !!pendingStatus.length 
  });

  const { tickets: myTickets, loading: loadingMyTickets } = useTickets({ 
    filters: { reporter_id: profile?.id },
    autoFetch: !!profile?.id 
  });

  const { tickets: allTickets, loading: loadingAll } = useTickets({ 
    autoFetch: isAdmin || isManager || isDev
  });

  // Calculate stats
  const pendingCount = pendingTickets.length;
  const myTicketsCount = myTickets.length;
  const myPendingCount = myTickets.filter(t => t.status === 'pending').length;
  const myApprovedCount = myTickets.filter(t => 
    ['approved_inspector', 'approved_manager', 'ready_for_repair'].includes(t.status)
  ).length;
  const myCompletedCount = myTickets.filter(t => t.status === 'completed').length;

  const getRoleTitle = () => {
    if (isDev) return 'แดชบอร์ดผู้พัฒนา (Dev)';
    if (isAdmin) return 'แดชบอร์ดผู้ดูแลระบบ';
    if (isInspector) return 'แดชบอร์ดผู้ตรวจสอบ';
    if (isManager) return 'แดชบอร์ดผู้จัดการ';
    if (isExecutive) return 'แดชบอร์ดผู้บริหาร';
    return 'แดชบอร์ด';
  };

  const getRoleSubtitle = () => {
    if (isInspector) return 'ตั๋วที่รอการอนุมัติจากคุณ';
    if (isManager) return 'ตั๋วที่อนุมัติโดยผู้ตรวจสอบแล้ว รอการอนุมัติจากคุณ';
    if (isExecutive) return 'ตั๋วที่อนุมัติโดยผู้จัดการแล้ว รอการอนุมัติจากคุณ';
    return 'ภาพรวมระบบ';
  };

  return (
    <PageLayout
      title={getRoleTitle()}
      subtitle={getRoleSubtitle()}
    >
      <div className="space-y-6">
        {/* Role-specific Stats */}
        {(isInspector || isManager || isExecutive) && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatusCard
              title={isInspector ? "รออนุมัติ" : isManager ? "รออนุมัติ Level 2" : "รออนุมัติ Level 3"}
              value={pendingCount}
              subValue={`${pendingCount} ตั๋วที่ต้องอนุมัติ`}
              icon={Clock}
              alert={pendingCount > 0}
            />
            <StatusCard
              title="ตั๋วของฉัน"
              value={myTicketsCount}
              subValue={`${myPendingCount} รออนุมัติ, ${myApprovedCount} อนุมัติแล้ว`}
              icon={FileText}
            />
            <StatusCard
              title="อนุมัติแล้ว"
              value={myApprovedCount}
              subValue="ตั๋วที่อนุมัติสำเร็จ"
              icon={CheckCircle}
            />
            <StatusCard
              title="เสร็จสิ้น"
              value={myCompletedCount}
              subValue="ตั๋วที่ซ่อมเสร็จแล้ว"
              icon={Activity}
            />
          </div>
        )}

        {/* Pending Tickets List */}
        {pendingCount > 0 && (
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
                ตั๋วที่รอการอนุมัติ ({pendingCount})
              </h3>
              {onNavigateToTickets && (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={onNavigateToTickets}
                >
                  ดูทั้งหมด
                </Button>
              )}
            </div>

            <div className="space-y-3">
              {pendingTickets.slice(0, 5).map((ticket) => (
                <div
                  key={ticket.id}
                  className="p-4 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
                  onClick={() => {
                    if (onNavigateToTicketDetail) {
                      onNavigateToTicketDetail(ticket.id);
                    }
                  }}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-semibold text-slate-900 dark:text-white">
                          {ticket.ticket_number || `#${ticket.id}`}
                        </p>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          ticket.urgency === 'critical' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                          ticket.urgency === 'high' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' :
                          ticket.urgency === 'medium' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                          'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-200'
                        }`}>
                          {ticket.urgency === 'critical' ? 'วิกฤต' :
                           ticket.urgency === 'high' ? 'สูง' :
                           ticket.urgency === 'medium' ? 'ปานกลาง' : 'ต่ำ'}
                        </span>
                      </div>
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        {ticket.repair_type || 'ไม่ระบุประเภท'}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">
                        {new Date(ticket.created_at).toLocaleDateString('th-TH', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                    <Clock className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0" />
                  </div>
                </div>
              ))}
              {pendingTickets.length > 5 && (
                <p className="text-sm text-center text-slate-500 dark:text-slate-400 pt-2">
                  และอีก {pendingTickets.length - 5} ตั๋ว...
                </p>
              )}
            </div>
          </Card>
        )}

        {/* My Tickets Summary */}
        {myTicketsCount > 0 && (
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
              สรุปตั๋วของฉัน
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                <p className="text-2xl font-bold text-slate-900 dark:text-white">{myTicketsCount}</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">ทั้งหมด</p>
              </div>
              <div className="text-center p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{myPendingCount}</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">รออนุมัติ</p>
              </div>
              <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{myApprovedCount}</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">อนุมัติแล้ว</p>
              </div>
              <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">{myCompletedCount}</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">เสร็จสิ้น</p>
              </div>
            </div>
          </Card>
        )}

        {/* Empty State */}
        {pendingCount === 0 && myTicketsCount === 0 && (
          <Card className="p-12 text-center">
            <FileText className="w-16 h-16 mx-auto mb-4 text-slate-400 dark:text-slate-500 opacity-50" />
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
              ไม่มีตั๋วที่ต้องดำเนินการ
            </h3>
            <p className="text-slate-500 dark:text-slate-400">
              {isInspector && 'ไม่มีตั๋วที่รอการอนุมัติจากคุณ'}
              {isManager && 'ไม่มีตั๋วที่รอการอนุมัติ Level 2'}
              {isExecutive && 'ไม่มีตั๋วที่รอการอนุมัติ Level 3'}
            </p>
          </Card>
        )}
      </div>
    </PageLayout>
  );
};

