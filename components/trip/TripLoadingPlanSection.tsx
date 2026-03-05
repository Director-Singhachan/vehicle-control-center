import React, { useState } from 'react';
import { Layers, Eye, EyeOff } from 'lucide-react';
import { Card, CardHeader } from '../ui/Card';
import { Button } from '../ui/Button';
import { PackingSimulator } from './PackingSimulator';

interface TripLoadingPlanSectionProps {
  tripId: string;
  onSaved?: () => void;
}

export const TripLoadingPlanSection: React.FC<TripLoadingPlanSectionProps> = ({
  tripId,
  onSaved,
}) => {
  const [showSimulator, setShowSimulator] = useState(false);

  return (
    <div className="space-y-4 animate-fade-in">
      <Card>
        <CardHeader
          title="การจัดเรียงสินค้าบนรถ"
          subtitle="ดูหรือแก้ไขแผนการจัดวางสินค้าและลำดับการขนถ่าย"
          action={
            <Button
              variant={showSimulator ? 'outline' : 'primary'}
              size="sm"
              onClick={() => setShowSimulator(!showSimulator)}
            >
              {showSimulator ? (
                <>
                  <EyeOff size={15} className="mr-1.5" />
                  ซ่อน
                </>
              ) : (
                <>
                  <Eye size={15} className="mr-1.5" />
                  ดูการจัดเรียง / แก้ไข
                </>
              )}
            </Button>
          }
        />

        {!showSimulator && (
          <div className="flex flex-col items-center justify-center py-10 gap-3">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
              <Layers size={28} className="text-slate-400 dark:text-slate-500" />
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 text-center max-w-xs">
              กดปุ่ม "ดูการจัดเรียง / แก้ไข" เพื่อเปิดโปรแกรมจำลองการจัดวางสินค้าบนรถ
            </p>
            <Button variant="primary" size="sm" onClick={() => setShowSimulator(true)}>
              <Layers size={15} className="mr-1.5" />
              เปิดดูการจัดเรียง
            </Button>
          </div>
        )}

        {showSimulator && (
          <div className="mt-4">
            <PackingSimulator
              tripId={tripId}
              onClose={() => setShowSimulator(false)}
              onSaved={() => {
                onSaved?.();
              }}
              embedInDetailView
            />
          </div>
        )}
      </Card>
    </div>
  );
};
