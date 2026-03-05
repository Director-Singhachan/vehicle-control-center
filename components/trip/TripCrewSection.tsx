// TripCrewSection — จัดพนักงานประจำทริป (คนขับ + พนักงานบริการ) จาก useDeliveryTripForm
import React from 'react';
import { createPortal } from 'react-dom';
import { User, AlertCircle, Truck, CheckCircle, X, Search } from 'lucide-react';
import { Input } from '../ui/Input';
import { Card } from '../ui/Card';
import type { RefObject } from 'react';

export interface StaffOption {
  id: string;
  name: string;
  employee_code?: string | null;
  branch?: string | null;
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

// Branch badge — same branch = blue, other branch = grey
function BranchBadge({ branch, isSame }: { branch: string; isSame: boolean }) {
  return (
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
}

// Split staff into same-branch group and other-branch group, sorted alphabetically within each
function groupStaff(staff: StaffOption[], tripBranch: string | null | undefined) {
  if (!tripBranch) return { same: [], other: staff };
  const same = staff.filter(s => s.branch === tripBranch);
  const other = staff.filter(s => s.branch !== tripBranch);
  return { same, other };
}

// Render a flat list item for the portal dropdown
const StaffDropdownItem: React.FC<{
  staff: StaffOption;
  isSameBranch: boolean;
  isSelected: boolean;
  onClick: () => void;
}> = ({ staff, isSameBranch, isSelected, onClick }) => {
  return (
    <button
      type="button"
      onMouseDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick();
      }}
      className={`w-full text-left px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2 ${
        isSelected ? 'bg-blue-50 dark:bg-blue-900/30' : ''
      }`}
    >
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">{staff.name}</div>
        {staff.employee_code && (
          <div className="text-xs text-slate-500 dark:text-slate-400">{staff.employee_code}</div>
        )}
      </div>
      {staff.branch && <BranchBadge branch={staff.branch} isSame={isSameBranch} />}
    </button>
  );
}

// Section header divider for the dropdown
const DropdownSectionHeader: React.FC<{ label: string }> = ({ label }) => {
  return (
    <div className="px-3 py-1 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-200 dark:border-slate-700 first:border-t-0">
      {label}
    </div>
  );
}

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
  // Render a grouped staff dropdown list (used inside portal)
  const renderStaffDropdownList = (
    candidates: StaffOption[],
    isSelected: (id: string) => boolean,
    onSelect: (staff: StaffOption) => void,
    searchText: string,
  ) => {
    const filtered = candidates.filter(
      s =>
        s.name.toLowerCase().includes(searchText.toLowerCase()) ||
        (s.employee_code || '').toLowerCase().includes(searchText.toLowerCase()),
    );
    const { same, other } = groupStaff(filtered, tripBranch);
    const hasBoth = tripBranch && same.length > 0 && other.length > 0;
    const isEmpty = filtered.length === 0;

    if (isEmpty) {
      return (
        <div className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400 text-center">ไม่พบพนักงาน</div>
      );
    }

    return (
      <>
        {hasBoth && <DropdownSectionHeader label={`สาขา ${tripBranch} (สาขาเดียวกัน)`} />}
        {same.map(staff => (
          <StaffDropdownItem
            key={staff.id}
            staff={staff}
            isSameBranch={true}
            isSelected={isSelected(staff.id)}
            onClick={() => onSelect(staff)}
          />
        ))}
        {hasBoth && <DropdownSectionHeader label="สาขาอื่น" />}
        {other.map(staff => (
          <StaffDropdownItem
            key={staff.id}
            staff={staff}
            isSameBranch={false}
            isSelected={isSelected(staff.id)}
            onClick={() => onSelect(staff)}
          />
        ))}
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
              placeholder="ค้นหาคนขับ..."
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
                className="fixed bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg shadow-xl z-[9999] max-h-60 overflow-y-auto overscroll-contain"
                style={{ top: `${driverStaffDropdownPosition.top}px`, left: `${driverStaffDropdownPosition.left}px`, width: `${driverStaffDropdownPosition.width}px` }}
                onMouseDown={(e) => e.stopPropagation()}
              >
                {renderStaffDropdownList(
                  availableStaff.filter(s => !selectedHelpers.includes(s.id)),
                  (id) => selectedDriverStaffId === id,
                  (staff) => {
                    setSelectedDriverStaffId(staff.id);
                    setDriverStaffSearch(`${staff.name}${staff.employee_code ? ` (${staff.employee_code})` : ''}`);
                    setShowDriverStaffDropdown(false);
                    setDriverStaffDropdownPosition(null);
                  },
                  driverStaffSearch,
                )}
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
                placeholder={selectedHelpers.length === 0 ? 'ค้นหาพนักงานบริการ...' : 'เพิ่มอีก...'}
                className="flex-1 min-w-[120px] outline-none bg-transparent text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400"
                data-helper-input
              />
            </div>
            {showHelperDropdown && helperDropdownPosition && createPortal(
              <div
                data-helper-dropdown-portal
                className="fixed bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg shadow-xl z-[9999] max-h-60 overflow-y-auto overscroll-contain"
                style={{ top: `${helperDropdownPosition.top}px`, left: `${helperDropdownPosition.left}px`, width: `${helperDropdownPosition.width}px` }}
                onMouseDown={(e) => e.stopPropagation()}
              >
                {renderStaffDropdownList(
                  availableStaff.filter(s => !selectedHelpers.includes(s.id) && s.id !== selectedDriverStaffId),
                  (id) => selectedHelpers.includes(id),
                  (staff) => {
                    setSelectedHelpers(prev => [...prev, staff.id]);
                    setHelperSearch('');
                    setTimeout(() => {
                      if (helperInputRef.current) {
                        const rect = helperInputRef.current.getBoundingClientRect();
                        setHelperDropdownPosition({ top: rect.bottom + window.scrollY + 4, left: rect.left + window.scrollX, width: rect.width });
                      }
                    }, 0);
                  },
                  helperSearch,
                )}
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
