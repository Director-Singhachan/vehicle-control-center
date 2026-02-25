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
}

export interface TripCrewSectionProps {
  availableStaff: StaffOption[];
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

export const TripCrewSection: React.FC<TripCrewSectionProps> = ({
  availableStaff,
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
                {availableStaff
                  .filter(s => !selectedHelpers.includes(s.id))
                  .filter(s => s.name.toLowerCase().includes(driverStaffSearch.toLowerCase()) || (s.employee_code || '').toLowerCase().includes(driverStaffSearch.toLowerCase()))
                  .map(staff => (
                    <button
                      key={staff.id}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setSelectedDriverStaffId(staff.id);
                        setDriverStaffSearch(`${staff.name}${staff.employee_code ? ` (${staff.employee_code})` : ''}`);
                        setShowDriverStaffDropdown(false);
                        setDriverStaffDropdownPosition(null);
                      }}
                      className={`w-full text-left px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 text-sm ${selectedDriverStaffId === staff.id ? 'bg-blue-50 dark:bg-blue-900/30' : ''}`}
                    >
                      <div className="font-medium text-slate-900 dark:text-slate-100">{staff.name}</div>
                      {staff.employee_code && <div className="text-xs text-slate-500 dark:text-slate-400">{staff.employee_code}</div>}
                    </button>
                  ))}
                {availableStaff.filter(s => !selectedHelpers.includes(s.id)).filter(s => s.name.toLowerCase().includes(driverStaffSearch.toLowerCase()) || (s.employee_code || '').toLowerCase().includes(driverStaffSearch.toLowerCase())).length === 0 && (
                  <div className="px-4 py-2 text-sm text-slate-500 dark:text-slate-400 text-center">ไม่พบพนักงาน</div>
                )}
              </div>,
              document.body
            )}
            {selectedDriverStaffId && (
              <div className="mt-2 p-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                <div className="flex items-center gap-2 text-sm text-green-800 dark:text-green-200">
                  <CheckCircle size={14} />
                  <span className="font-medium">{availableStaff.find(s => s.id === selectedDriverStaffId)?.name || 'เลือกแล้ว'}</span>
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 text-xs rounded-full">คนขับ</span>
                </div>
              </div>
            )}
          </div>
        </div>

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
                {availableStaff
                  .filter(s => !selectedHelpers.includes(s.id) && s.id !== selectedDriverStaffId)
                  .filter(s => s.name.toLowerCase().includes(helperSearch.toLowerCase()) || (s.employee_code || '').toLowerCase().includes(helperSearch.toLowerCase()))
                  .map(staff => (
                    <button
                      key={staff.id}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setSelectedHelpers(prev => [...prev, staff.id]);
                        setHelperSearch('');
                        setTimeout(() => {
                          if (helperInputRef.current) {
                            const rect = helperInputRef.current.getBoundingClientRect();
                            setHelperDropdownPosition({ top: rect.bottom + window.scrollY + 4, left: rect.left + window.scrollX, width: rect.width });
                          }
                        }, 0);
                      }}
                      className="w-full text-left px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 text-sm text-slate-900 dark:text-slate-100"
                    >
                      <div>{staff.name}</div>
                      {staff.employee_code && <div className="text-xs text-slate-500 dark:text-slate-400">{staff.employee_code}</div>}
                    </button>
                  ))}
                {availableStaff.filter(s => !selectedHelpers.includes(s.id) && s.id !== selectedDriverStaffId).filter(s => s.name.toLowerCase().includes(helperSearch.toLowerCase()) || (s.employee_code || '').toLowerCase().includes(helperSearch.toLowerCase())).length === 0 && (
                  <div className="px-4 py-2 text-sm text-slate-500 dark:text-slate-400 text-center">ไม่พบพนักงาน</div>
                )}
              </div>,
              document.body
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
            {selectedDriverStaffId && (
              <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200 border border-blue-200 dark:border-blue-800">
                <Truck size={14} />
                {availableStaff.find(s => s.id === selectedDriverStaffId)?.name || 'คนขับ'}
                <span className="text-xs font-medium ml-1">(คนขับ)</span>
              </span>
            )}
            {selectedHelpers.map(helperId => {
              const helper = availableStaff.find(s => s.id === helperId);
              return (
                <span key={helperId} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200 border border-green-200 dark:border-green-800">
                  <User size={14} />
                  {helper?.name || 'Unknown'}
                  <span className="text-xs font-medium ml-1">(บริการ)</span>
                </span>
              );
            })}
          </div>
        </div>
      )}
    </Card>
  );
};
