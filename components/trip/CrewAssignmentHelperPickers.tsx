import React, { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import { serviceStaffService } from '../../services/serviceStaffService';
import { getBranchLabel } from '../../utils/branchLabels';
import { TripHelperStaffPicker, type ServiceStaffOption } from './TripHelperStaffPicker';

interface CrewAssignmentHelperPickersProps {
  /** รหัสสาขาจากขั้นตอนเลือกรถ (HQ/SD) — ถ้ามีจะกรองพนักงานบริการให้ตรงสาขา */
  filterBranchCode?: string;
  splitIntoTwoTrips: boolean;
  splitIntoThreeTrips: boolean;
  selectedDriverId: string;
  selectedDriverId2: string;
  selectedDriverId3?: string;
  helperStaffIds1: string[];
  setHelperStaffIds1: Dispatch<SetStateAction<string[]>>;
  helperStaffIds2: string[];
  setHelperStaffIds2: Dispatch<SetStateAction<string[]>>;
  helperStaffIds3: string[];
  setHelperStaffIds3: Dispatch<SetStateAction<string[]>>;
}

export function CrewAssignmentHelperPickers({
  filterBranchCode = '',
  splitIntoTwoTrips,
  splitIntoThreeTrips,
  selectedDriverId,
  selectedDriverId2,
  selectedDriverId3 = '',
  helperStaffIds1,
  setHelperStaffIds1,
  helperStaffIds2,
  setHelperStaffIds2,
  helperStaffIds3,
  setHelperStaffIds3,
}: CrewAssignmentHelperPickersProps) {
  const [options, setOptions] = useState<ServiceStaffOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [driverStaff1, setDriverStaff1] = useState<string | null>(null);
  const [driverStaff2, setDriverStaff2] = useState<string | null>(null);
  const [driverStaff3, setDriverStaff3] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void serviceStaffService
      .getAllActiveWithBranch()
      .then((list) => {
        if (cancelled) return;
        setOptions(list.map((s) => ({ id: s.id, name: s.name, branch: s.branch })));
      })
      .catch(() => {
        if (!cancelled) setOptions([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedDriverId) {
      setDriverStaff1(null);
      return;
    }
    void serviceStaffService.getLinkedByUserId(selectedDriverId).then((s) => setDriverStaff1(s?.id ?? null));
  }, [selectedDriverId]);

  useEffect(() => {
    if (!selectedDriverId2) {
      setDriverStaff2(null);
      return;
    }
    void serviceStaffService.getLinkedByUserId(selectedDriverId2).then((s) => setDriverStaff2(s?.id ?? null));
  }, [selectedDriverId2]);

  useEffect(() => {
    if (!selectedDriverId3) {
      setDriverStaff3(null);
      return;
    }
    void serviceStaffService.getLinkedByUserId(selectedDriverId3).then((s) => setDriverStaff3(s?.id ?? null));
  }, [selectedDriverId3]);

  const branchTrim = filterBranchCode?.trim() ?? '';
  const optionsForBranch = useMemo(() => {
    if (!branchTrim) return options;
    return options.filter((o) => o.branch === branchTrim);
  }, [options, branchTrim]);

  useEffect(() => {
    if (!branchTrim || options.length === 0) return;
    const valid = new Set(options.filter((o) => o.branch === branchTrim).map((o) => o.id));
    setHelperStaffIds1((prev) => prev.filter((id) => valid.has(id)));
    setHelperStaffIds2((prev) => prev.filter((id) => valid.has(id)));
    setHelperStaffIds3((prev) => prev.filter((id) => valid.has(id)));
  }, [branchTrim, options, setHelperStaffIds1, setHelperStaffIds2, setHelperStaffIds3]);

  const branchBanner =
    branchTrim ? (
      <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">
        กรองพนักงานบริการตามสาขา: <span className="font-medium text-slate-800 dark:text-slate-200">{getBranchLabel(branchTrim)}</span>
        {' — '}
        <span className="text-slate-500 dark:text-slate-500">ล้างสาขาในขั้นตอนเลือกรถเพื่อดูทุกสาขา</span>
      </p>
    ) : null;

  if (splitIntoThreeTrips) {
    return (
      <div className="space-y-4">
        {branchBanner}
        <TripHelperStaffPicker
          label="พนักงานบริการ — เที่ยวที่ 1"
          excludeStaffId={driverStaff1}
          selectedIds={helperStaffIds1}
          onChange={setHelperStaffIds1}
          options={optionsForBranch}
          loading={loading}
          branchFilterCode={branchTrim || undefined}
        />
        <TripHelperStaffPicker
          label="พนักงานบริการ — เที่ยวที่ 2"
          excludeStaffId={driverStaff2}
          selectedIds={helperStaffIds2}
          onChange={setHelperStaffIds2}
          options={optionsForBranch}
          loading={loading}
          branchFilterCode={branchTrim || undefined}
        />
        <TripHelperStaffPicker
          label="พนักงานบริการ — เที่ยวที่ 3"
          excludeStaffId={driverStaff3}
          selectedIds={helperStaffIds3}
          onChange={setHelperStaffIds3}
          options={optionsForBranch}
          loading={loading}
          branchFilterCode={branchTrim || undefined}
        />
      </div>
    );
  }

  if (splitIntoTwoTrips) {
    return (
      <div className="space-y-4">
        {branchBanner}
        <TripHelperStaffPicker
          label="พนักงานบริการ — คันที่ 1"
          excludeStaffId={driverStaff1}
          selectedIds={helperStaffIds1}
          onChange={setHelperStaffIds1}
          options={optionsForBranch}
          loading={loading}
          branchFilterCode={branchTrim || undefined}
        />
        <TripHelperStaffPicker
          label="พนักงานบริการ — คันที่ 2"
          excludeStaffId={driverStaff2}
          selectedIds={helperStaffIds2}
          onChange={setHelperStaffIds2}
          options={optionsForBranch}
          loading={loading}
          branchFilterCode={branchTrim || undefined}
        />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {branchBanner}
      <TripHelperStaffPicker
        label="พนักงานบริการ (ลูกเรือ)"
        excludeStaffId={driverStaff1}
        selectedIds={helperStaffIds1}
        onChange={setHelperStaffIds1}
        options={optionsForBranch}
        loading={loading}
        branchFilterCode={branchTrim || undefined}
      />
    </div>
  );
}
