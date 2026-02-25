import { useState, useMemo } from 'react';
import { useVehicles } from './useVehicles';

export type FilterPeriod =
  | 'current-month'
  | 'last-3-months'
  | 'last-6-months'
  | 'last-12-months'
  | 'this-year'
  | 'custom';

export interface UseReportFiltersReturn {
  // Months filter (for fuel, trip, maintenance, cost tabs)
  months: number;
  setMonths: (value: number) => void;

  // Period + branch filters (for usage, fuel-consumption tabs)
  filterPeriod: FilterPeriod;
  setFilterPeriod: (value: FilterPeriod) => void;
  selectedBranch: string | null;
  setSelectedBranch: (value: string | null) => void;
  customStartDate: string;
  setCustomStartDate: (value: string) => void;
  customEndDate: string;
  setCustomEndDate: (value: string) => void;

  // Derived
  branches: string[];
  startDate: Date;
  endDate: Date;

  // Options for hooks that need date range
  usageRankingOptions: { startDate: Date; endDate: Date; branch?: string; limit: number };
  fuelConsumptionOptions: { startDate: Date; endDate: Date; branch?: string };
}

/**
 * Centralized report filters state and derived date range.
 * Used by ReportsView for usage, fuel-consumption tabs and passed to DeliveryReportsTab.
 */
export function useReportFilters(): UseReportFiltersReturn {
  const [months, setMonths] = useState(6);
  const [filterPeriod, setFilterPeriod] = useState<FilterPeriod>('last-3-months');
  const [selectedBranch, setSelectedBranch] = useState<string | null>(null);
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  const { vehicles } = useVehicles();

  const branches = useMemo(() => {
    const branchSet = new Set<string>();
    vehicles?.forEach((v) => {
      if (v.branch) branchSet.add(v.branch);
    });
    return Array.from(branchSet).sort();
  }, [vehicles]);

  const { startDate, endDate } = useMemo(() => {
    const now = new Date();
    let start: Date;
    let end: Date = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    switch (filterPeriod) {
      case 'current-month':
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'last-3-months':
        start = new Date(now.getFullYear(), now.getMonth() - 2, 1);
        break;
      case 'last-6-months':
        start = new Date(now.getFullYear(), now.getMonth() - 5, 1);
        break;
      case 'last-12-months':
        start = new Date(now.getFullYear(), now.getMonth() - 11, 1);
        break;
      case 'this-year':
        start = new Date(now.getFullYear(), 0, 1);
        end = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
        break;
      case 'custom':
        if (customStartDate && customEndDate) {
          start = new Date(customStartDate);
          end = new Date(customEndDate);
          end.setHours(23, 59, 59, 999);
        } else if (customStartDate && !customEndDate) {
          start = new Date(customStartDate);
          end = new Date(customStartDate);
          end.setHours(23, 59, 59, 999);
        } else if (!customStartDate && customEndDate) {
          start = new Date(customEndDate);
          end = new Date(customEndDate);
          end.setHours(23, 59, 59, 999);
        } else {
          start = new Date(now.getFullYear(), now.getMonth(), 1);
        }
        break;
      default:
        start = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    return { startDate: start, endDate: end };
  }, [filterPeriod, customStartDate, customEndDate]);

  const usageRankingOptions = useMemo(
    () => ({
      startDate,
      endDate,
      branch: selectedBranch || undefined,
      limit: 20,
    }),
    [startDate, endDate, selectedBranch]
  );

  const fuelConsumptionOptions = useMemo(
    () => ({
      startDate,
      endDate,
      branch: selectedBranch || undefined,
    }),
    [startDate, endDate, selectedBranch]
  );

  return {
    months,
    setMonths,
    filterPeriod,
    setFilterPeriod,
    selectedBranch,
    setSelectedBranch,
    customStartDate,
    setCustomStartDate,
    customEndDate,
    setCustomEndDate,
    branches,
    startDate,
    endDate,
    usageRankingOptions,
    fuelConsumptionOptions,
  };
}
