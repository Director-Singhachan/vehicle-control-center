// TripCrewSection — จัดพนักงานประจำทริป (คนขับ + พนักงานบริการ) จาก useDeliveryTripForm
import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { User, AlertCircle, Truck, CheckCircle, X, Search, Globe } from 'lucide-react';
import { Input } from '../ui/Input';
import { Card } from '../ui/Card';
import type { RefObject } from 'react';

export interface StaffOption {
  id: string;
  name: string;
  employee_code?: string | null;
  branch?: string | null;
  staffRole?: string | null;
}

// คนขับ: role === 'driver' หรือ unlinked (role null) — ยังไม่รู้ role
// พนักงานบริการ: role === 'service_staff' หรือ unlinked
function isDriverCandidate(s: StaffOption) {
  return !s.staffRole || s.staffRole === 'driver';
}
function isHelperCandidate(s: StaffOption) {
  return !s.staffRole || s.staffRole === 'service_staff';
}

export interface TripCrewSectionProps {
  availableStaff: StaffOption[];
  tripBranch?: string | null;
  selectedDriverStaffId: string;
  setSelectedDriverStaffId: (id: string) => void;
  driverStaffSearch: string;
  setDriverStaffSearch: (value: string) => void;
  showDriverStaffDropdown: boolean;
  setShowDriverStaffDropdown: (value: boolean) => void;
  driverStaffInputRef: RefObject<HTMLDivElement | null>;
  driverStaffDropdownPosition: { top: number; left: number; width: number } | null;
  setDriverStaffDropdownPosition: (value: { top: number; left: number; width: number } | null) => void;
  selectedHelpers: string[];
  setSelectedHelpers: React.Dispatch<React.SetStateAction<string[]>>;
  helperSearch: string;
  setHelperSearch: (value: string) => void;
  showHelperDropdown: boolean;
  setShowHelperDropdown: (value: boolean) => void;
  helperInputRef: RefObject<HTMLDivElement | null>;
  helperDropdownPosition: { top: number; left: number; width: number } | null;
  setHelperDropdownPosition: (value: { top: number; left: number; width: number } | null) => void;
}

const BranchBadge: React.FC<{ branch: string; isSame: boolean }> = ({ branch, isSame }) => (
  <span
    className={`shrink-0 px-1.5 py-0.5 text-[10px] font-bold rounded ${
      isSame
        ? 'bg-enterprise-100 text-enterprise-700 dark:bg-enterprise-900/40 dark:text-enterprise-300'
        : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400'
    }`}
  >
    {branch}
  </span>
);

export const TripCrewSection: React.FC<TripCrewSectionProps> = ({
  availableStaff,
  tripBranch,
  selectedDriverStaffId,
  setSelectedDriverStaffId,
  driverStaffSearch,
  setDriverStaffSearch,
  showDriverStaffDropdown,
  setShowDriverStaffDropdown,
  driverStaffInputRef,
  driverStaffDropdownPosition,
  setDriverStaffDropdownPosition,
  selectedHelpers,
  setSelectedHelpers,
  helperSearch,
  setHelperSearch,
  showHelperDropdown,
  setShowHelperDropdown,
  helperInputRef,
  helperDropdownPosition,
  setHelperDropdownPosition,
}) => {
  const [showAllDriver, setShowAllDriver] = useState(false);
  const [showAllHelper, setShowAllHelper] = useState(false);

  const renderDropdown = ({
    candidates,
    isSelected,
    onSelect,
    searchText,
    showAll,
    setShowAll,
    selectionType,
  }: {
    candidates: StaffOption[];
    isSelected: (id: string) => boolean;
    onSelect: (staff: StaffOption) => void;
    searchText: string;
    showAll: boolean;
    setShowAll: (v: boolean) => void;
    selectionType: 'radio' | 'checkbox';
  }) => {
    const matchesSearch = (s: StaffOption) =>
      s.name.toLowerCase().includes(searchText.toLowerCase()) ||
      (s.employee_code || '').toLowerCase().includes(searchText.toLowerCase());

    const hasBranchFilter = !!tripBranch;
    // When filtering: only show same branch (unless no tripBranch)
    const visibleCandidates = hasBranchFilter && !showAll
      ? candidates.filter(s => s.branch === tripBranch && matchesSearch(s))
      : candidates.filter(matchesSearch);

    const otherBranchCount = hasBranchFilter
      ? candidates.filter(s => s.branch !== tripBranch && matchesSearch(s)).length
      : 0;

    const sameBranchGroup = hasBranchFilter && showAll
      ? visibleCandidates.filter(s => s.branch === tripBranch)
      : visibleCandidates;
    const otherBranchGroup = hasBranchFilter && showAll
      ? visibleCandidates.filter(s => s.branch !== tripBranch)
      : [];

    const renderRow = (staff: StaffOption) => (
      <button
        key={staff.id}
        type="button"
        onMouseDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onSelect(staff);
        }}
        className={`w-full text-left px-3 py-2.5 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2 transition-colors ${
          isSelected(staff.id) ? 'bg-blue-50 dark:bg-blue-900/30' : ''
        }`}
      >
        <div className="shrink-0 w-4 h-4 flex items-center justify-center">
          {selectionType === 'radio' ? (
            <div className={`w-3.5 h-3.5 rounded-full border-2 ${isSelected(staff.id) ? 'border-blue-500 bg-blue-500' : 'border-slate-300 dark:border-slate-600'}`}>
              {isSelected(staff.id) && <div className="w-1.5 h-1.5 rounded-full bg-white mx-auto mt-[1px]" />}
            </div>
          ) : (
            <div className={`w-3.5 h-3.5 rounded border-2 flex items-center justify-center ${isSelected(staff.id) ? 'border-green-500 bg-green-500' : 'border-slate-300 dark:border-slate-600'}`}>
              {isSelected(staff.id) && <svg viewBox="0 0 8 8" className="w-2 h-2 text-white fill-current"><path d="M1 4l2 2 4-4" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round" /></svg>}
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">{staff.name}</div>
          {staff.employee_code && (
            <div className="text-xs text-slate-500 dark:text-slate-400">{staff.employee_code}</div>
          )}
        </div>
        {staff.branch && <BranchBadge branch={staff.branch} isSame={staff.branch === tripBranch} />}
      </button>
    );

    return (
      <>
        {visibleCandidates.length === 0 && otherBranchCount === 0 && (
          <div className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400 text-center">ไม่พบพนักงาน</div>
        )}
        {visibleCandidates.length === 0 && otherBranchCount > 0 && (
          <div className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400 text-center">
            ไม่พบพนักงานในสาขา {tripBranch}
          </div>
        )}

        {/* same-branch group header when showing all */}
        {hasBranchFilter && showAll && sameBranchGroup.length > 0 && (
          <div className="px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-enterprise-600 dark:text-enterprise-400 bg-enterprise-50 dark:bg-enterprise-900/20">
            สาขา {tripBranch} · {sameBranchGroup.length} คน
          </div>
        )}
        {sameBranchGroup.map(renderRow)}

        {/* other-branch group when showing all */}
        {hasBranchFilter && showAll && otherBranchGroup.length > 0 && (
          <div className="px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-200 dark:border-slate-700">
            สาขาอื่น · {otherBranchGroup.length} คน
          </div>
        )}
        {otherBranchGroup.map(renderRow)}

        {/* Footer toggle */}
        {hasBranchFilter && (
          <div className="border-t border-slate-200 dark:border-slate-700">
            {!showAll ? (
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); setShowAll(true); }}
                className="w-full px-3 py-2 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
              >
                <Globe size={13} className="shrink-0" />
                <span>แสดงพนักงานสาขาอื่นด้วย</span>
                {otherBranchCount > 0 && (
                  <span className="ml-auto px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 font-medium">
                    +{otherBranchCount}
                  </span>
                )}
              </button>
            ) : (
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); setShowAll(false); }}
                className="w-full px-3 py-2 flex items-center gap-2 text-xs text-enterprise-600 dark:text-enterprise-400 hover:bg-enterprise-50 dark:hover:bg-enterprise-900/20 transition-colors"
              >
                <Globe size={13} className="shrink-0" />
                <span>แสดงเฉพาะสาขา {tripBranch}</span>
              </button>
            )}
          </div>
        )}
      </>
    );
  };

  return (
    <Card>
      <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
        <User size={20} />
        จัดพนักงานประจำทริป
        <span className="text-sm font-normal text-slate-500 dark:text-slate-400">(สำคัญ - มีผลต่อค่าคอมมิชชั่น)</span>
      </h3>

      {!selectedDriverStaffId && selectedHelpers.length === 0 && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-2">
          <AlertCircle className="text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" size={20} />
          <div>
            <p className="text-sm font-medium text-red-800 dark:text-red-200">ยังไม่ได้จัดพนักงาน</p>
            <p className="text-xs text-red-600 dark:text-red-300 mt-1">กรุณาเลือกคนขับและพนักงานบริการเพื่อให้ระบบคำนวณค่าคอมมิชชั่นได้ถูกต้อง</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* ===== DRIVER ===== */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            คนขับ (เลือกได้ 1 คน) <span className="text-red-500">*</span>
          </label>
          <div className="relative" ref={driverStaffInputRef} data-driver-staff-dropdown>
            <Input
              type="text"
              value={driverStaffSearch}
              onChange={(e) => {
                setDriverStaffSearch(e.target.value);
                setShowDriverStaffDropdown(true);
                if (!e.target.value) setSelectedDriverStaffId('');
                if (driverStaffInputRef.current) {
                  const rect = driverStaffInputRef.current.getBoundingClientRect();
                  setDriverStaffDropdownPosition({ top: rect.bottom + window.scrollY + 4, left: rect.left + window.scrollX, width: rect.width });
                }
              }}
              onFocus={() => {
                setShowDriverStaffDropdown(true);
                if (driverStaffInputRef.current) {
                  const rect = driverStaffInputRef.current.getBoundingClientRect();
                  setDriverStaffDropdownPosition({ top: rect.bottom + window.scrollY + 4, left: rect.left + window.scrollX, width: rect.width });
                }
              }}
              placeholder={tripBranch ? `ค้นหาคนขับ (สาขา ${tripBranch})...` : 'ค้นหาคนขับ...'}
              icon={<Search size={18} />}
              data-driver-staff-input
            />
            {selectedDriverStaffId && (
              <button
                type="button"
                onClick={() => { setSelectedDriverStaffId(''); setDriverStaffSearch(''); }}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              >
                <X size={16} />
              </button>
            )}
            {showDriverStaffDropdown && driverStaffDropdownPosition && createPortal(
              <div
                data-driver-staff-dropdown-portal
                className="fixed bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg shadow-xl z-[9999] max-h-72 overflow-y-auto overscroll-contain"
                style={{ top: `${driverStaffDropdownPosition.top}px`, left: `${driverStaffDropdownPosition.left}px`, width: `${driverStaffDropdownPosition.width}px` }}
                onMouseDown={(e) => e.stopPropagation()}
              >
                {renderDropdown({
                  candidates: availableStaff.filter(s => !selectedHelpers.includes(s.id) && isDriverCandidate(s)),
                  isSelected: (id) => selectedDriverStaffId === id,
                  onSelect: (staff) => {
                    setSelectedDriverStaffId(staff.id);
                    setDriverStaffSearch(`${staff.name}${staff.employee_code ? ` (${staff.employee_code})` : ''}`);
                    setShowDriverStaffDropdown(false);
                    setDriverStaffDropdownPosition(null);
                    setShowAllDriver(false);
                  },
                  searchText: driverStaffSearch,
                  showAll: showAllDriver,
                  setShowAll: setShowAllDriver,
                  selectionType: 'radio',
                })}
              </div>,
              document.body,
            )}
            {selectedDriverStaffId && (
              <div className="mt-2 p-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                <div className="flex items-center gap-2 text-sm text-green-800 dark:text-green-200">
                  <CheckCircle size={14} />
                  <span className="font-medium">{availableStaff.find(s => s.id === selectedDriverStaffId)?.name || 'เลือกแล้ว'}</span>
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 text-xs rounded-full">คนขับ</span>
                  {(() => {
                    const staff = availableStaff.find(s => s.id === selectedDriverStaffId);
                    if (!staff?.branch) return null;
                    return <BranchBadge branch={staff.branch} isSame={staff.branch === tripBranch} />;
                  })()}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ===== HELPERS ===== */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            พนักงานบริการ (เลือกได้หลายคน)
          </label>
          <div className="relative" ref={helperInputRef} data-helper-dropdown>
            <div className="flex flex-wrap gap-2 p-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 min-h-[42px]">
              {selectedHelpers.map(helperId => {
                const helper = availableStaff.find(s => s.id === helperId);
                return (
                  <span key={helperId} className="inline-flex items-center px-2 py-1 rounded-md text-sm font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                    {helper?.name || 'Unknown'}
                    {helper?.branch && (
                      <span className="ml-1 text-[10px] opacity-70">({helper.branch})</span>
                    )}
                    <button type="button" onClick={() => setSelectedHelpers(prev => prev.filter(id => id !== helperId))} className="ml-1 hover:text-blue-900 dark:hover:text-blue-100">
                      <X size={14} />
                    </button>
                  </span>
                );
              })}
              <input
                type="text"
                value={helperSearch}
                onChange={(e) => {
                  setHelperSearch(e.target.value);
                  setShowHelperDropdown(true);
                  if (helperInputRef.current) {
                    const rect = helperInputRef.current.getBoundingClientRect();
                    setHelperDropdownPosition({ top: rect.bottom + window.scrollY + 4, left: rect.left + window.scrollX, width: rect.width });
                  }
                }}
                onFocus={() => {
                  setShowHelperDropdown(true);
                  if (helperInputRef.current) {
                    const rect = helperInputRef.current.getBoundingClientRect();
                    setHelperDropdownPosition({ top: rect.bottom + window.scrollY + 4, left: rect.left + window.scrollX, width: rect.width });
                  }
                }}
                placeholder={selectedHelpers.length === 0
                  ? (tripBranch ? `ค้นหาพนักงาน (สาขา ${tripBranch})...` : 'ค้นหาพนักงานบริการ...')
                  : 'เพิ่มอีก...'}
                className="flex-1 min-w-[120px] outline-none bg-transparent text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400"
                data-helper-input
              />
            </div>
            {showHelperDropdown && helperDropdownPosition && createPortal(
              <div
                data-helper-dropdown-portal
                className="fixed bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg shadow-xl z-[9999] max-h-72 overflow-y-auto overscroll-contain"
                style={{ top: `${helperDropdownPosition.top}px`, left: `${helperDropdownPosition.left}px`, width: `${helperDropdownPosition.width}px` }}
                onMouseDown={(e) => e.stopPropagation()}
              >
                {renderDropdown({
                  candidates: availableStaff.filter(s => !selectedHelpers.includes(s.id) && s.id !== selectedDriverStaffId && isHelperCandidate(s)),
                  isSelected: (id) => selectedHelpers.includes(id),
                  onSelect: (staff) => {
                    setSelectedHelpers(prev => [...prev, staff.id]);
                    setHelperSearch('');
                    setTimeout(() => {
                      if (helperInputRef.current) {
                        const rect = helperInputRef.current.getBoundingClientRect();
                        setHelperDropdownPosition({ top: rect.bottom + window.scrollY + 4, left: rect.left + window.scrollX, width: rect.width });
                      }
                    }, 0);
                  },
                  searchText: helperSearch,
                  showAll: showAllHelper,
                  setShowAll: setShowAllHelper,
                  selectionType: 'checkbox',
                })}
              </div>,
              document.body,
            )}
          </div>
        </div>
      </div>

      {(selectedDriverStaffId || selectedHelpers.length > 0) && (
        <div className="mt-4 p-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg">
          <div className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            สรุปพนักงานในทริป ({(selectedDriverStaffId ? 1 : 0) + selectedHelpers.length} คน)
          </div>
          <div className="flex flex-wrap gap-2">
            {selectedDriverStaffId && (() => {
              const staff = availableStaff.find(s => s.id === selectedDriverStaffId);
              return (
                <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200 border border-blue-200 dark:border-blue-800">
                  <Truck size={14} />
                  {staff?.name || 'คนขับ'}
                  <span className="text-xs font-medium ml-1">(คนขับ)</span>
                  {staff?.branch && <BranchBadge branch={staff.branch} isSame={staff.branch === tripBranch} />}
                </span>
              );
            })()}
            {selectedHelpers.map(helperId => {
              const helper = availableStaff.find(s => s.id === helperId);
              return (
                <span key={helperId} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200 border border-green-200 dark:border-green-800">
                  <User size={14} />
                  {helper?.name || 'Unknown'}
                  <span className="text-xs font-medium ml-1">(บริการ)</span>
                  {helper?.branch && <BranchBadge branch={helper.branch} isSame={helper.branch === tripBranch} />}
                </span>
              );
            })}
          </div>
        </div>
      )}
    </Card>
  );
};
