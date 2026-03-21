import React, { useMemo, useState } from 'react';
import { Search, UserPlus } from 'lucide-react';
import { getBranchLabel } from '../../utils/branchLabels';

export interface ServiceStaffOption {
  id: string;
  name: string;
  branch?: string | null;
}

interface TripHelperStaffPickerProps {
  label: string;
  /** service_staff ของคนขับ — ไม่ให้เลือกซ้ำเป็นผู้ช่วย */
  excludeStaffId?: string | null;
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  options: ServiceStaffOption[];
  loading?: boolean;
  /** รหัสสาขาที่กรองจากขั้นตอนเลือกรถ — ใช้ข้อความเมื่อไม่มีรายชื่อ */
  branchFilterCode?: string;
}

export const TripHelperStaffPicker: React.FC<TripHelperStaffPickerProps> = ({
  label,
  excludeStaffId,
  selectedIds,
  onChange,
  options,
  loading = false,
  branchFilterCode,
}) => {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return options.filter((o) => {
      if (excludeStaffId && o.id === excludeStaffId) return false;
      if (!q) return true;
      return (
        o.name.toLowerCase().includes(q) ||
        (o.branch?.toLowerCase().includes(q) ?? false) ||
        getBranchLabel(o.branch).toLowerCase().includes(q)
      );
    });
  }, [options, search, excludeStaffId]);

  const toggle = (id: string) => {
    if (selectedIds.includes(id)) onChange(selectedIds.filter((x) => x !== id));
    else onChange([...selectedIds, id]);
  };

  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-charcoal-900/40 p-4">
      <div className="flex items-center gap-2 mb-2">
        <UserPlus size={16} className="text-enterprise-600 dark:text-enterprise-400 shrink-0" />
        <span className="text-sm font-medium text-slate-800 dark:text-slate-200">{label}</span>
        {selectedIds.length > 0 && (
          <span className="text-xs text-slate-500 dark:text-slate-400">({selectedIds.length} คน)</span>
        )}
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
        เลือกพนักงานบริการที่ไปกับเที่ยวนี้ (บันทึกเป็นลูกเรือ role helper)
      </p>
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="ค้นหาชื่อหรือสาขา..."
          className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-charcoal-900 dark:text-white focus:ring-2 focus:ring-enterprise-500"
        />
      </div>
      {loading ? (
        <p className="text-sm text-slate-500 dark:text-slate-400 py-2">กำลังโหลดรายชื่อ…</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400 py-2">
          {!search.trim() && branchFilterCode
            ? `ไม่มีพนักงานบริการในสาขา ${getBranchLabel(branchFilterCode)}`
            : 'ไม่พบรายชื่อที่ตรงกับการค้นหา'}
        </p>
      ) : (
        <ul className="max-h-44 overflow-y-auto space-y-1 pr-1">
          {filtered.map((o) => {
            const checked = selectedIds.includes(o.id);
            return (
              <li key={o.id}>
                <label className="flex items-center gap-2 cursor-pointer rounded px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800/80">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(o.id)}
                    className="w-4 h-4 rounded border-slate-300 text-enterprise-600 focus:ring-enterprise-500 dark:bg-charcoal-900 dark:border-slate-600"
                  />
                  <span className="text-sm text-slate-800 dark:text-slate-200 flex-1">{o.name}</span>
                  {o.branch ? (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 shrink-0">
                      {getBranchLabel(o.branch)}
                    </span>
                  ) : null}
                </label>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
