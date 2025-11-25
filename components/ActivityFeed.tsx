import React from 'react';
import { 
  Truck, 
  Fuel, 
  Wrench, 
  CheckCircle, 
  Clock,
  AlertCircle 
} from 'lucide-react';
import type { Database } from '../types/database';

type TicketWithRelations = Database['public']['Views']['tickets_with_relations']['Row'];

interface ActivityFeedProps {
  tickets?: TicketWithRelations[];
  isDark: boolean;
  onNavigateToTicket?: (ticketId: number) => void;
}

interface ActivityItem {
  id: string;
  type: 'ticket_created' | 'ticket_completed' | 'fuel_filled' | 'checkout' | 'checkin';
  title: string;
  description: string;
  time: string;
  icon: React.ReactNode;
  color: string;
  ticketId?: number;
}

const formatTimeAgo = (date: string) => {
  const now = new Date();
  const then = new Date(date);
  const diffMs = now.getTime() - then.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'เมื่อสักครู่';
  if (diffMins < 60) return `${diffMins} นาทีที่แล้ว`;
  if (diffHours < 24) return `${diffHours} ชั่วโมงที่แล้ว`;
  if (diffDays < 7) return `${diffDays} วันที่แล้ว`;
  
  return then.toLocaleDateString('th-TH', { 
    month: 'short', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const getTicketStatusIcon = (status: string) => {
  if (status === 'completed') {
    return <CheckCircle size={18} className="text-emerald-500" />;
  }
  if (['pending', 'approved_inspector', 'approved_manager'].includes(status)) {
    return <Clock size={18} className="text-amber-500" />;
  }
  return <AlertCircle size={18} className="text-red-500" />;
};

const getTicketStatusLabel = (status: string) => {
  const statusMap: Record<string, string> = {
    pending: 'รอดำเนินการ',
    approved_inspector: 'อนุมัติโดยผู้ตรวจสอบ',
    approved_manager: 'อนุมัติโดยผู้จัดการ',
    ready_for_repair: 'พร้อมซ่อม',
    in_progress: 'กำลังซ่อม',
    completed: 'เสร็จสิ้น',
    rejected: 'ปฏิเสธ',
  };
  return statusMap[status] || status;
};

export const ActivityFeed: React.FC<ActivityFeedProps> = ({ 
  tickets = [], 
  isDark,
  onNavigateToTicket 
}) => {
  // Transform tickets into activity items
  const activities: ActivityItem[] = React.useMemo(() => {
    const items: ActivityItem[] = [];

    // Add ticket activities
    tickets.slice(0, 10).forEach((ticket) => {
      const isCompleted = ticket.status === 'completed';
      
      items.push({
        id: `ticket-${ticket.id}`,
        type: isCompleted ? 'ticket_completed' : 'ticket_created',
        title: isCompleted 
          ? `ซ่อมเสร็จ: ${ticket.vehicle_plate || 'N/A'}`
          : `แจ้งซ่อม: ${ticket.vehicle_plate || 'N/A'}`,
        description: `${ticket.issue_description || 'ไม่มีรายละเอียด'} - ${getTicketStatusLabel(ticket.status)}`,
        time: ticket.created_at,
        icon: getTicketStatusIcon(ticket.status),
        color: isCompleted ? 'text-emerald-500' : 'text-amber-500',
        ticketId: ticket.id,
      });
    });

    // Sort by time (newest first)
    return items.sort((a, b) => 
      new Date(b.time).getTime() - new Date(a.time).getTime()
    ).slice(0, 10);
  }, [tickets]);

  if (activities.length === 0) {
    return (
      <div className="bg-white/80 dark:bg-charcoal-900/50 backdrop-blur-md p-6 rounded-xl border border-slate-200 dark:border-slate-700/50">
        <div className="text-center text-slate-500 dark:text-slate-400 py-8">
          <Clock className="mx-auto mb-3 opacity-50" size={48} />
          <p>ไม่มีกิจกรรมล่าสุด</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white/80 dark:bg-charcoal-900/50 backdrop-blur-md p-6 rounded-xl border border-slate-200 dark:border-slate-700/50 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-semibold text-slate-900 dark:text-white text-lg">
          กิจกรรมล่าสุด
        </h3>
        <span className="text-sm text-slate-500 dark:text-slate-400">
          {activities.length} รายการ
        </span>
      </div>

      <div className="space-y-4">
        {activities.map((activity) => (
          <div
            key={activity.id}
            className={`flex gap-4 p-3 rounded-lg border transition-colors ${
              activity.ticketId && onNavigateToTicket
                ? 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50'
                : ''
            } border-slate-200 dark:border-slate-700`}
            onClick={() => {
              if (activity.ticketId && onNavigateToTicket) {
                onNavigateToTicket(activity.ticketId);
              }
            }}
          >
            <div className="flex-shrink-0 mt-0.5">
              {activity.icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <h4 className="font-medium text-slate-900 dark:text-white text-sm mb-1">
                    {activity.title}
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2">
                    {activity.description}
                  </p>
                </div>
                <span className="text-xs text-slate-500 dark:text-slate-500 whitespace-nowrap">
                  {formatTimeAgo(activity.time)}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

