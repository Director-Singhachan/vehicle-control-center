import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  vehicleDocumentReportService,
  type DocumentReportRow,
  type VehicleDocumentReportFilters,
} from '../services/vehicleDocumentReportService';

export const useVehicleDocumentReports = (filters: VehicleDocumentReportFilters) => {
  const [data, setData] = useState<DocumentReportRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const stableFilters = useMemo(() => ({
    documentType: filters.documentType ?? 'all',
    ownerGroup: filters.ownerGroup ?? 'all',
    status: filters.status ?? 'all',
    includeExpired: filters.includeExpired ?? true,
    periodMonths: filters.periodMonths ?? 1,
  }), [
    filters.documentType,
    filters.ownerGroup,
    filters.status,
    filters.includeExpired,
    filters.periodMonths,
  ]);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const rows = await vehicleDocumentReportService.getDocumentsReport(stableFilters);
      setData(rows);
    } catch (err) {
      const e = err instanceof Error ? err : new Error('Failed to fetch vehicle document reports');
      setError(e);
      console.error('[useVehicleDocumentReports] Error:', e);
    } finally {
      setLoading(false);
    }
  }, [stableFilters]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return {
    data,
    loading,
    error,
    refetch: fetch,
  };
};
