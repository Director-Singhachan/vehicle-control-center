// VehicleDocumentBadge - Badge showing expiring document count for a vehicle
import React, { useMemo } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useVehicleDocuments } from '../../hooks/useVehicleDocuments';
import type { DocumentWithDetails } from '../../services/vehicleDocumentService';

interface VehicleDocumentBadgeProps {
  vehicleId: string;
  compact?: boolean;
}

export const VehicleDocumentBadge: React.FC<VehicleDocumentBadgeProps> = ({
  vehicleId,
  compact = false,
}) => {
  const { documents, loading } = useVehicleDocuments({
    vehicleId,
    autoFetch: true,
  });

  const expiringCount = useMemo(() => {
    if (!documents || documents.length === 0 || loading) return { critical: 0, warning: 0 };

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let critical = 0;
    let warning = 0;

    documents.forEach((doc) => {
      if (!doc.expiry_date || doc.status === 'expired') return;

      const expiryDate = new Date(doc.expiry_date);
      expiryDate.setHours(0, 0, 0, 0);
      const daysUntilExpiry = Math.ceil(
        (expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (daysUntilExpiry < 0 || daysUntilExpiry <= 7) {
        critical++;
      } else if (daysUntilExpiry <= 30) {
        warning++;
      }
    });

    return { critical, warning };
  }, [documents, loading]);

  const total = expiringCount.critical + expiringCount.warning;

  if (loading || total === 0) {
    return null;
  }

  const hasCritical = expiringCount.critical > 0;

  if (compact) {
    // Compact badge - just icon and count
    return (
      <div
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium shadow-sm ${
          hasCritical
            ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
            : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
        }`}
        title={
          hasCritical
            ? `${expiringCount.critical} เอกสารเร่งด่วน, ${expiringCount.warning} เอกสารเตือนล่วงหน้า`
            : `${expiringCount.warning} เอกสารเตือนล่วงหน้า`
        }
      >
        <AlertTriangle className="w-3 h-3" />
        <span>{total}</span>
      </div>
    );
  }

  // Full badge with text
  return (
    <div
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
        hasCritical
          ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800'
          : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
      }`}
    >
      <AlertTriangle className="w-3.5 h-3.5" />
      <span>
        {hasCritical
          ? `เอกสารใกล้หมดอายุ ${expiringCount.critical > 0 ? `(${expiringCount.critical} เร่งด่วน)` : ''}`
          : 'เอกสารใกล้หมดอายุ'}
      </span>
    </div>
  );
};
