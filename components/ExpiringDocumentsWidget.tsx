// ExpiringDocumentsWidget - Widget showing documents expiring soon
import React from 'react';
import { FileText, AlertTriangle, Calendar, ChevronRight } from 'lucide-react';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { useExpiringDocuments } from '../hooks/useVehicleDocuments';
import { ExpiringDocumentItem } from './ExpiringDocumentItem';

interface ExpiringDocumentsWidgetProps {
  onViewAll?: () => void;
  onDocumentClick?: (vehicleId: string) => void;
  onNavigateToVehicle?: (vehicleId: string) => void;
}

const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  registration: 'ทะเบียนรถ / เล่มรถ',
  tax: 'ภาษีรถ / ต่อทะเบียน',
  insurance: 'ประกัน',
  inspection: 'พรบ./ตรวจสภาพ',
  other: 'อื่นๆ',
};

export const ExpiringDocumentsWidget: React.FC<ExpiringDocumentsWidgetProps> = ({
  onViewAll,
  onDocumentClick,
  onNavigateToVehicle,
}) => {
  const { documents, loading, error } = useExpiringDocuments(30);

  // Group by severity
  const critical = documents.filter((doc) => {
    if (!doc.expiry_date) return false;
    const daysUntilExpiry = Math.ceil(
      (new Date(doc.expiry_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
    );
    return daysUntilExpiry <= 7;
  });

  const warning = documents.filter((doc) => {
    if (!doc.expiry_date) return false;
    const daysUntilExpiry = Math.ceil(
      (new Date(doc.expiry_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
    );
    return daysUntilExpiry > 7 && daysUntilExpiry <= 30;
  });

  const getDaysUntilExpiry = (expiryDate: string): number => {
    return Math.ceil(
      (new Date(expiryDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
    );
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <Card className="p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded w-1/3 mb-4"></div>
          <div className="h-32 bg-slate-200 dark:bg-slate-700 rounded"></div>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-6">
        <div className="text-center text-slate-500 dark:text-slate-400">
          <p className="text-sm">เกิดข้อผิดพลาดในการโหลดข้อมูล</p>
        </div>
      </Card>
    );
  }

  const totalExpiring = documents.length;
  const hasExpiring = totalExpiring > 0;

  return (
    <Card className="p-6 bg-white/80 dark:bg-charcoal-900/50 backdrop-blur-md border border-slate-200 dark:border-slate-700/50 shadow-sm hover:shadow-glow transition-all duration-300">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 rounded-lg">
            <FileText size={20} />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900 dark:text-white text-lg">
              เอกสารใกล้หมดอายุ
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {totalExpiring > 0
                ? `${totalExpiring} เอกสารที่ต้องดูแล`
                : 'ไม่มีเอกสารใกล้หมดอายุ'}
            </p>
          </div>
        </div>
        {onViewAll && (
          <Button
            variant="outline"
            size="sm"
            onClick={onViewAll}
            className="text-xs"
          >
            ดูทั้งหมด
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        )}
      </div>

      {!hasExpiring ? (
        <div className="text-center py-8">
          <div className="w-16 h-16 mx-auto mb-4 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center">
            <FileText className="w-8 h-8 text-green-600 dark:text-green-400" />
          </div>
          <p className="text-slate-600 dark:text-slate-400 text-sm">
            ไม่มีเอกสารใกล้หมดอายุใน 30 วันถัดไป
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 gap-3">
            {critical.length > 0 && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400" />
                  <span className="text-xs font-semibold text-red-600 dark:text-red-400">
                    เร่งด่วน
                  </span>
                </div>
                <p className="text-2xl font-bold text-red-700 dark:text-red-300">
                  {critical.length}
                </p>
                <p className="text-xs text-red-600 dark:text-red-400">
                  ≤ 7 วัน
                </p>
              </div>
            )}
            {warning.length > 0 && (
              <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <Calendar className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                    เตือนล่วงหน้า
                  </span>
                </div>
                <p className="text-2xl font-bold text-amber-700 dark:text-amber-300">
                  {warning.length}
                </p>
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  8-30 วัน
                </p>
              </div>
            )}
          </div>

          {/* Document List */}
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {documents.slice(0, 5).map((doc) => {
              const daysUntil = doc.expiry_date
                ? getDaysUntilExpiry(doc.expiry_date)
                : null;
              const isCritical = daysUntil !== null && daysUntil <= 7;

              const handleClick = () => {
                if (onNavigateToVehicle) {
                  onNavigateToVehicle(doc.vehicle_id);
                } else if (onDocumentClick) {
                  onDocumentClick(doc.vehicle_id);
                }
              };

              return (
                <ExpiringDocumentItem
                  key={doc.id}
                  doc={doc}
                  isCritical={isCritical}
                  daysUntil={daysUntil}
                  formatDate={formatDate}
                  onClick={handleClick}
                  documentTypeLabel={DOCUMENT_TYPE_LABELS[doc.document_type] || doc.document_type}
                />
              );
            })}
          </div>

          {documents.length > 5 && (
            <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
              <p className="text-xs text-center text-slate-500 dark:text-slate-400">
                และอีก {documents.length - 5} เอกสาร...
              </p>
            </div>
          )}
        </div>
      )}
    </Card>
  );
};
