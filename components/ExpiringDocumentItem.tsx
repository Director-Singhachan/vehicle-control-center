// ExpiringDocumentItem - Individual document item with image
import React, { useState } from 'react';
import { Calendar, ChevronRight, Truck } from 'lucide-react';
import type { DocumentWithDetails } from '../services/vehicleDocumentService';

interface ExpiringDocumentItemProps {
  doc: DocumentWithDetails;
  isCritical: boolean;
  daysUntil: number | null;
  formatDate: (dateString: string) => string;
  onClick: () => void;
  documentTypeLabel: string;
}

export const ExpiringDocumentItem: React.FC<ExpiringDocumentItemProps> = ({
  doc,
  isCritical,
  daysUntil,
  formatDate,
  onClick,
  documentTypeLabel,
}) => {
  const [imageError, setImageError] = useState(false);
  const vehicleImageUrl = doc.vehicle?.image_url;

  return (
    <button
      onClick={onClick}
      className="w-full p-3 text-left bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
    >
      <div className="flex items-start gap-3">
        {/* Vehicle Image */}
        <div className="flex-shrink-0">
          {vehicleImageUrl && !imageError ? (
            <div className="w-16 h-16 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800">
              <img
                src={vehicleImageUrl}
                alt={doc.vehicle?.plate || 'Vehicle'}
                className="w-full h-full object-cover"
                onError={() => setImageError(true)}
              />
            </div>
          ) : (
            <div className="w-16 h-16 rounded-lg border border-slate-200 dark:border-slate-700 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900 flex items-center justify-center">
              <Truck className="w-8 h-8 text-slate-400 dark:text-slate-500" />
            </div>
          )}
        </div>

        {/* Document Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span
              className={`text-xs font-medium px-2 py-0.5 rounded ${
                isCritical
                  ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                  : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
              }`}
            >
              {documentTypeLabel}
            </span>
          </div>
          {doc.vehicle?.plate && (
            <p className="text-sm font-semibold text-slate-900 dark:text-white mb-1">
              ทะเบียน: {doc.vehicle.plate}
            </p>
          )}
          <p className="text-sm text-slate-700 dark:text-slate-300 truncate mb-1">
            {doc.file_name}
          </p>
          {doc.expiry_date && (
            <div className="flex items-center gap-2 mt-1">
              <Calendar className="w-3 h-3 text-slate-400" />
              <span className="text-xs text-slate-500 dark:text-slate-400">
                หมดอายุ: {formatDate(doc.expiry_date)}
              </span>
              {daysUntil !== null && (
                <span
                  className={`text-xs font-semibold ${
                    isCritical
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-amber-600 dark:text-amber-400'
                  }`}
                >
                  (เหลือ {daysUntil} วัน)
                </span>
              )}
            </div>
          )}
        </div>
        <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0 ml-2" />
      </div>
    </button>
  );
};
