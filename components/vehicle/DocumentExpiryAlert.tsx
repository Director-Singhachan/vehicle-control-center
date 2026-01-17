// DocumentExpiryAlert - Alert banner for expiring documents in vehicle detail view
import React, { useMemo } from 'react';
import { AlertTriangle, Calendar, FileText, ChevronDown, ChevronUp } from 'lucide-react';
import { Card } from '../ui/Card';
import { useVehicleDocuments } from '../../hooks/useVehicleDocuments';
import type { DocumentWithDetails } from '../../services/vehicleDocumentService';

interface DocumentExpiryAlertProps {
  vehicleId: string;
}

const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  registration: 'ทะเบียนรถ',
  tax: 'ภาษีรถ',
  insurance: 'ประกัน',
  inspection: 'พรบ./ตรวจสภาพ',
  other: 'อื่นๆ',
};

export const DocumentExpiryAlert: React.FC<DocumentExpiryAlertProps> = ({ vehicleId }) => {
  const { documents, loading } = useVehicleDocuments({
    vehicleId,
    autoFetch: true,
  });

  const [isExpanded, setIsExpanded] = React.useState(false);

  // Filter and categorize expiring documents
  const expiringDocuments = useMemo(() => {
    if (!documents || documents.length === 0) return { critical: [], warning: [] };

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const critical: DocumentWithDetails[] = [];
    const warning: DocumentWithDetails[] = [];

    documents.forEach((doc) => {
      if (!doc.expiry_date || doc.status === 'expired') return;

      const expiryDate = new Date(doc.expiry_date);
      expiryDate.setHours(0, 0, 0, 0);
      const daysUntilExpiry = Math.ceil(
        (expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (daysUntilExpiry < 0) {
        // Already expired
        critical.push(doc);
      } else if (daysUntilExpiry <= 7) {
        // Critical: ≤ 7 days
        critical.push(doc);
      } else if (daysUntilExpiry <= 30) {
        // Warning: 8-30 days
        warning.push(doc);
      }
    });

    return { critical, warning };
  }, [documents]);

  const totalExpiring = expiringDocuments.critical.length + expiringDocuments.warning.length;

  if (loading) {
    return null;
  }

  if (totalExpiring === 0) {
    return null;
  }

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getDaysUntilExpiry = (expiryDate: string): number => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expiry = new Date(expiryDate);
    expiry.setHours(0, 0, 0, 0);
    return Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  };

  const hasCritical = expiringDocuments.critical.length > 0;
  const alertColor = hasCritical
    ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
    : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800';
  const alertTextColor = hasCritical
    ? 'text-red-800 dark:text-red-200'
    : 'text-amber-800 dark:text-amber-200';
  const iconColor = hasCritical
    ? 'text-red-600 dark:text-red-400'
    : 'text-amber-600 dark:text-amber-400';

  return (
    <Card className={`${alertColor} border-l-4`}>
      <div className="p-4">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center justify-between text-left"
        >
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${hasCritical ? 'bg-red-100 dark:bg-red-900/30' : 'bg-amber-100 dark:bg-amber-900/30'}`}>
              <AlertTriangle className={`w-5 h-5 ${iconColor}`} />
            </div>
            <div>
              <h3 className={`font-semibold ${alertTextColor} text-lg`}>
                {hasCritical ? 'เอกสารใกล้หมดอายุ - เร่งด่วน' : 'เอกสารใกล้หมดอายุ'}
              </h3>
              <p className={`text-sm ${alertTextColor} opacity-80`}>
                {totalExpiring} เอกสารที่ต้องดูแล
                {hasCritical && ` (${expiringDocuments.critical.length} เร่งด่วน)`}
              </p>
            </div>
          </div>
          {isExpanded ? (
            <ChevronUp className={`w-5 h-5 ${iconColor}`} />
          ) : (
            <ChevronDown className={`w-5 h-5 ${iconColor}`} />
          )}
        </button>

        {isExpanded && (
          <div className="mt-4 space-y-3 pt-4 border-t border-slate-200 dark:border-slate-700">
            {/* Critical Documents */}
            {expiringDocuments.critical.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-red-700 dark:text-red-300 mb-2 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  เร่งด่วน (≤ 7 วัน)
                </h4>
                <div className="space-y-2">
                  {expiringDocuments.critical.map((doc) => {
                    const daysUntil = getDaysUntilExpiry(doc.expiry_date!);
                    return (
                      <div
                        key={doc.id}
                        className="p-3 bg-red-100 dark:bg-red-900/30 rounded-lg border border-red-200 dark:border-red-800"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <FileText className="w-4 h-4 text-red-600 dark:text-red-400" />
                              <span className="text-sm font-medium text-red-800 dark:text-red-200">
                                {DOCUMENT_TYPE_LABELS[doc.document_type] || doc.document_type}
                              </span>
                            </div>
                            <p className="text-sm text-red-700 dark:text-red-300 mb-1">
                              {doc.file_name}
                            </p>
                            <div className="flex items-center gap-2 text-xs text-red-600 dark:text-red-400">
                              <Calendar className="w-3 h-3" />
                              <span>หมดอายุ: {formatDate(doc.expiry_date!)}</span>
                              <span className="font-semibold">
                                ({daysUntil < 0 ? 'หมดอายุแล้ว' : `เหลือ ${daysUntil} วัน`})
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Warning Documents */}
            {expiringDocuments.warning.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-amber-700 dark:text-amber-300 mb-2 flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  เตือนล่วงหน้า (8-30 วัน)
                </h4>
                <div className="space-y-2">
                  {expiringDocuments.warning.map((doc) => {
                    const daysUntil = getDaysUntilExpiry(doc.expiry_date!);
                    return (
                      <div
                        key={doc.id}
                        className="p-3 bg-amber-100 dark:bg-amber-900/30 rounded-lg border border-amber-200 dark:border-amber-800"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <FileText className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                              <span className="text-sm font-medium text-amber-800 dark:text-amber-200">
                                {DOCUMENT_TYPE_LABELS[doc.document_type] || doc.document_type}
                              </span>
                            </div>
                            <p className="text-sm text-amber-700 dark:text-amber-300 mb-1">
                              {doc.file_name}
                            </p>
                            <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400">
                              <Calendar className="w-3 h-3" />
                              <span>หมดอายุ: {formatDate(doc.expiry_date!)}</span>
                              <span className="font-semibold">(เหลือ {daysUntil} วัน)</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
};
