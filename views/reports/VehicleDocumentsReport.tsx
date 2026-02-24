import React from 'react';
import { VehicleDocumentReports } from '../../components/vehicle/VehicleDocumentReports';

export interface VehicleDocumentsReportProps {
  isDark?: boolean;
  onNavigateToStoreDetail?: (storeId: string) => void;
}

export const VehicleDocumentsReport: React.FC<VehicleDocumentsReportProps> = ({ isDark = false }) => {
  return (
    <div className="space-y-6">
      <VehicleDocumentReports isDark={isDark} />
    </div>
  );
};
