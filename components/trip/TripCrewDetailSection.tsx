import React from 'react';
import { Users } from 'lucide-react';
import { Card, CardHeader } from '../ui/Card';
import { CrewAssignment } from '../crew/CrewAssignment';

interface TripCrewDetailSectionProps {
  tripId: string;
  onUpdate?: () => void;
}

export const TripCrewDetailSection: React.FC<TripCrewDetailSectionProps> = ({
  tripId,
  onUpdate,
}) => {
  return (
    <div className="space-y-4 animate-fade-in">
      <Card>
        <CardHeader
          title="พนักงานในทริป"
          subtitle="จัดการรายชื่อคนขับและผู้ช่วยที่ร่วมเดินทางในทริปนี้"
        />
        <div className="flex items-center gap-2 mb-4 p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg">
          <Users size={16} className="text-slate-400" />
          <span className="text-sm text-slate-600 dark:text-slate-400">
            เพิ่มหรือลบพนักงานได้โดยใช้ฟอร์มด้านล่าง
          </span>
        </div>
        <CrewAssignment tripId={tripId} onUpdate={onUpdate} />
      </Card>
    </div>
  );
};
