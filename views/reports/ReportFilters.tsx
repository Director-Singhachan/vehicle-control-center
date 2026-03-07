import React from 'react';
import { Card } from '../../components/ui/Card';
import { getBranchLabel } from '../../utils/branchLabels';
import type { FilterPeriod } from '../../hooks/useReportFilters';

export interface ReportFiltersProps {
  filterPeriod: FilterPeriod;
  setFilterPeriod: (value: FilterPeriod) => void;
  selectedBranch: string | null;
  setSelectedBranch: (value: string | null) => void;
  customStartDate: string;
  setCustomStartDate: (value: string) => void;
  customEndDate: string;
  setCustomEndDate: (value: string) => void;
  branches: string[];
}

/**
 * Shared filter UI for report tabs that use period + branch filters.
 * Used in usage and fuel-consumption tabs.
 */
export function ReportFilters({
  filterPeriod,
  setFilterPeriod,
  selectedBranch,
  setSelectedBranch,
  customStartDate,
  setCustomStartDate,
  customEndDate,
  setCustomEndDate,
  branches,
}: ReportFiltersProps) {
  return (
    <Card>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            ช่วงเวลา
          </label>
          <select
            value={filterPeriod}
            onChange={(e) => setFilterPeriod(e.target.value as FilterPeriod)}
            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
          >
            <option value="current-month">เดือนปัจจุบัน</option>
            <option value="last-3-months">3 เดือนล่าสุด</option>
            <option value="last-6-months">6 เดือนล่าสุด</option>
            <option value="last-12-months">12 เดือนล่าสุด</option>
            <option value="this-year">ปีนี้</option>
            <option value="custom">กำหนดเอง</option>
          </select>
        </div>
        {filterPeriod === 'custom' && (
          <>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                วันที่เริ่มต้น
              </label>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                วันที่สิ้นสุด
              </label>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>
          </>
        )}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            สาขา
          </label>
          <select
            value={selectedBranch || ''}
            onChange={(e) => setSelectedBranch(e.target.value || null)}
            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
          >
            <option value="">ทุกสาขา</option>
            {branches.map((branch) => (
              <option key={branch} value={branch}>
                {getBranchLabel(branch)}
              </option>
            ))}
          </select>
        </div>
      </div>
    </Card>
  );
}
