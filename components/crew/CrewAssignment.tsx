// Crew Assignment Component - Assign and manage crew for delivery trips
import React, { useState, useEffect, useMemo } from 'react';
import { Plus, X, Users, AlertTriangle, Check, RefreshCw, Trash2, Truck, User, AlertCircle, Globe } from 'lucide-react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { useCrewByTrip, useCrewManagement } from '../../hooks/useCrew';
import { supabase } from '../../lib/supabase';
import { getBranchLabel } from '../../utils/branchLabels';
import type { Database } from '../../types/database';

type ServiceStaff = Database['public']['Tables']['service_staff']['Row'];
// branch อยู่ใน ServiceStaff Row โดยตรงแล้ว — เพิ่มเฉพาะ staffRole (จาก profiles)
type ServiceStaffWithBranch = ServiceStaff & { staffRole: string | null };

interface CrewAssignmentProps {
    tripId: string;
    tripStatus: string;
    onUpdate?: () => void;
}

// Branch badge helper
function BranchBadge({ branch, isSame }: { branch: string; isSame: boolean }) {
    return (
        <span
            className={`shrink-0 px-1.5 py-0.5 text-[10px] font-bold rounded ${
                isSame
                    ? 'bg-enterprise-100 text-enterprise-700 dark:bg-enterprise-900/40 dark:text-enterprise-300'
                    : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400'
            }`}
        >
            {getBranchLabel(branch)}
        </span>
    );
}

export const CrewAssignment: React.FC<CrewAssignmentProps> = ({
    tripId,
    tripStatus,
    onUpdate,
}) => {
    const { crew, loading, refresh } = useCrewByTrip(tripId, true); // Active crew only
    const { assignCrew, swapCrew, removeCrew, loading: managing, error: manageError } = useCrewManagement();

    const [availableStaff, setAvailableStaff] = useState<ServiceStaffWithBranch[]>([]);
    const [tripBranch, setTripBranch] = useState<string | null>(null);
    const [loadingStaff, setLoadingStaff] = useState(false);
    const [showAddDriver, setShowAddDriver] = useState(false);
    const [showAddHelper, setShowAddHelper] = useState(false);
    const [showAllDriver, setShowAllDriver] = useState(false);
    const [showAllHelper, setShowAllHelper] = useState(false);
    const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>([]);
    const [selectedDriverId, setSelectedDriverId] = useState<string>('');
    const [staffSearch, setStaffSearch] = useState('');

    // Swap crew state
    const [swapping, setSwapping] = useState<string | null>(null); // crew ID being swapped
    const [swapReason, setSwapReason] = useState('');
    const [replacementStaffId, setReplacementStaffId] = useState('');

    // Remove crew state
    const [removing, setRemoving] = useState<string | null>(null); // crew ID being removed
    const [removeReason, setRemoveReason] = useState('');

    // Computed: driver and helpers
    const driverCrew = useMemo(() => crew.find(c => c.role === 'driver'), [crew]);
    const helperCrews = useMemo(() => crew.filter(c => c.role === 'helper'), [crew]);
    const hasDriver = !!driverCrew;
    const hasCrew = crew.length > 0;

    // Fetch available staff + trip branch
    // branch อยู่ใน service_staff โดยตรงแล้ว — ดึง role จาก profiles เฉพาะสำหรับกรอง driver/helper
    const fetchAvailableStaff = async () => {
        try {
            setLoadingStaff(true);

            // Fetch trip branch
            const { data: tripData } = await supabase
                .from('delivery_trips')
                .select('branch')
                .eq('id', tripId)
                .single();
            const branch = tripData?.branch ?? null;
            setTripBranch(branch);

            // Fetch service staff (branch อยู่ใน column โดยตรง)
            const { data, error } = await supabase
                .from('service_staff')
                .select('*')
                .in('status', ['active', 'sick', 'leave'])
                .order('name');

            if (error) throw error;
            const list = data || [];

            // Resolve staffRole from profiles via user_id (ยังจำเป็นสำหรับกรอง driver vs helper)
            const userIds = list.flatMap(s => (s.user_id ? [s.user_id] : []));
            const roleMap: Record<string, string | null> = {};
            if (userIds.length > 0) {
                const { data: profileData } = await supabase
                    .from('profiles')
                    .select('id, role')
                    .in('id', userIds);
                (profileData || []).forEach(p => {
                    roleMap[p.id] = p.role;
                });
            }

            setAvailableStaff(
                list.map(s => ({
                    ...s,
                    staffRole: s.user_id ? (roleMap[s.user_id] ?? null) : null,
                })),
            );
        } catch (err) {
            console.error('[CrewAssignment] Error fetching staff:', err);
        } finally {
            setLoadingStaff(false);
        }
    };

    useEffect(() => {
        fetchAvailableStaff();
    }, []);

    // Handle assign driver
    const handleAssignDriver = async () => {
        if (!selectedDriverId) {
            alert('กรุณาเลือกคนขับ');
            return;
        }

        const result = await assignCrew(tripId, [selectedDriverId], 'driver');
        if (result) {
            setSelectedDriverId('');
            setShowAddDriver(false);
            setStaffSearch('');
            refresh();
            onUpdate?.();
        }
    };

    // Handle assign helpers
    const handleAssignHelpers = async () => {
        if (selectedStaffIds.length === 0) {
            alert('กรุณาเลือกพนักงาน');
            return;
        }

        const result = await assignCrew(tripId, selectedStaffIds, 'helper');
        if (result) {
            setSelectedStaffIds([]);
            setShowAddHelper(false);
            setStaffSearch('');
            refresh();
            onUpdate?.();
        }
    };

    // Handle swap crew
    const handleSwapCrew = async (oldStaffId: string) => {
        if (!replacementStaffId) {
            alert('กรุณาเลือกพนักงานทดแทน');
            return;
        }

        if (!swapReason.trim()) {
            alert('กรุณาระบุเหตุผลการเปลี่ยน');
            return;
        }

        const result = await swapCrew(tripId, oldStaffId, replacementStaffId, swapReason);
        if (result) {
            setSwapping(null);
            setSwapReason('');
            setReplacementStaffId('');
            refresh();
            onUpdate?.();
        }
    };

    // Handle remove crew
    const handleRemoveCrew = async (staffId: string) => {
        if (!removeReason.trim()) {
            alert('กรุณาระบุเหตุผลการลบ');
            return;
        }

        if (!window.confirm('ยืนยันลบพนักงานออกจากทริป?')) return;

        const success = await removeCrew(tripId, staffId, removeReason);
        if (success) {
            setRemoving(null);
            setRemoveReason('');
            refresh();
            onUpdate?.();
        }
    };

    // Base pool: exclude already-assigned staff, apply search, optional role filter
    const getBasePool = (roleFilter?: 'driver' | 'helper') => {
        const assignedStaffIds = crew.map(c => c.staff_id);
        let pool = availableStaff.filter(s => !assignedStaffIds.includes(s.id));
        if (roleFilter === 'driver') {
            // คนขับ: เฉพาะคนขับเท่านั้น (role === 'driver' หรือยังไม่ผูก role)
            pool = pool.filter(s => !s.staffRole || s.staffRole === 'driver');
        } else if (roleFilter === 'helper') {
            // พนักงานบริการ: แสดงทั้งพนักงานบริการและคนขับ (บางทีเลือกคนขับอีกคนเข้าไปด้วยในส่วนบริการ)
            pool = pool.filter(s => !s.staffRole || s.staffRole === 'service_staff' || s.staffRole === 'driver');
        }
        if (staffSearch.trim()) {
            const q = staffSearch.toLowerCase();
            pool = pool.filter(s =>
                s.name.toLowerCase().includes(q) ||
                (s.employee_code || '').toLowerCase().includes(q),
            );
        }
        return pool;
    };

    // For swap dropdown: filter by role but not by staffSearch (swap uses <select> not search)
    const getSwapPool = (roleFilter?: 'driver' | 'helper') => {
        const assignedStaffIds = crew.map(c => c.staff_id);
        let pool = availableStaff.filter(s => !assignedStaffIds.includes(s.id));
        if (roleFilter === 'driver') {
            pool = pool.filter(s => !s.staffRole || s.staffRole === 'driver');
        } else if (roleFilter === 'helper') {
            pool = pool.filter(s => !s.staffRole || s.staffRole === 'service_staff' || s.staffRole === 'driver');
        }
        return pool;
    };

    // Render staff rows (scrollable) and footer toggle (pinned) for an Add form
    const buildStaffListParts = (
        selectionType: 'radio' | 'checkbox',
        showAll: boolean,
        setShowAll: (v: boolean) => void,
        isSelected: (id: string) => boolean,
        onToggle: (id: string) => void,
        roleFilter?: 'driver' | 'helper',
    ): { rows: React.ReactNode; footer: React.ReactNode } => {
        const pool = getBasePool(roleFilter);
        const hasBranchFilter = !!tripBranch;
        const samePool = hasBranchFilter ? pool.filter(s => s.branch === tripBranch) : pool;
        const otherPool = hasBranchFilter ? pool.filter(s => s.branch !== tripBranch) : [];
        const visibleSame = samePool;
        const visibleOther = hasBranchFilter && !showAll ? [] : otherPool;
        const otherCount = otherPool.length;
        const totalVisible = visibleSame.length + visibleOther.length;

        const renderRow = (staff: ServiceStaffWithBranch) => (
            <label
                key={staff.id}
                className={`flex items-center gap-2 px-3 py-2.5 cursor-pointer select-none transition-colors ${
                    isSelected(staff.id)
                        ? selectionType === 'radio' ? 'bg-blue-50 dark:bg-blue-900/30' : 'bg-green-50 dark:bg-green-900/20'
                        : 'hover:bg-gray-50 dark:hover:bg-slate-800'
                }`}
            >
                <input
                    type={selectionType}
                    name={selectionType === 'radio' ? 'driver-select' : undefined}
                    checked={isSelected(staff.id)}
                    onChange={() => onToggle(staff.id)}
                    className={selectionType === 'radio' ? 'text-blue-600 cursor-pointer' : 'rounded border-gray-300 dark:border-slate-600 text-green-600 cursor-pointer'}
                />
                <span className="flex-1 text-gray-900 dark:text-slate-100">{staff.name}</span>
                {staff.employee_code && (
                    <span className="text-xs text-gray-500 dark:text-slate-400">{staff.employee_code}</span>
                )}
                {getStatusBadge(staff.status)}
                {staff.branch && <BranchBadge branch={staff.branch} isSame={staff.branch === tripBranch} />}
            </label>
        );

        const rows = (
            <>
                {totalVisible === 0 && (
                    <div className="p-4 text-center text-gray-500 dark:text-slate-400 text-sm">
                        {hasBranchFilter && !showAll && otherCount > 0
                            ? `ไม่มีพนักงานในสาขา ${tripBranch}`
                            : 'ไม่มีพนักงานที่พร้อมใช้งาน'}
                    </div>
                )}
                {hasBranchFilter && showAll && visibleSame.length > 0 && (
                    <div className="px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-enterprise-600 dark:text-enterprise-400 bg-enterprise-50 dark:bg-enterprise-900/20">
                        สาขา {tripBranch} · {visibleSame.length} คน
                    </div>
                )}
                {visibleSame.map(renderRow)}
                {hasBranchFilter && showAll && visibleOther.length > 0 && (
                    <div className="px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-200 dark:border-slate-700">
                        สาขาอื่น · {visibleOther.length} คน
                    </div>
                )}
                {visibleOther.map(renderRow)}
            </>
        );

        // Footer toggle: rendered OUTSIDE the scroll area so it's always visible
        const footer = hasBranchFilter ? (
            <div className="border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-b-lg">
                {!showAll ? (
                    <button
                        type="button"
                        onClick={() => setShowAll(true)}
                        className="w-full px-3 py-2 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors rounded-b-lg"
                    >
                        <Globe size={13} className="shrink-0" />
                        <span>แสดงพนักงานสาขาอื่นด้วย</span>
                        {otherCount > 0 && (
                            <span className="ml-auto px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 font-medium">
                                +{otherCount}
                            </span>
                        )}
                    </button>
                ) : (
                    <button
                        type="button"
                        onClick={() => setShowAll(false)}
                        className="w-full px-3 py-2 flex items-center gap-2 text-xs text-enterprise-600 dark:text-enterprise-400 hover:bg-enterprise-50 dark:hover:bg-enterprise-900/20 transition-colors rounded-b-lg"
                    >
                        <Globe size={13} className="shrink-0" />
                        <span>แสดงเฉพาะสาขา {tripBranch}</span>
                    </button>
                )}
            </div>
        ) : null;

        return { rows, footer };
    };

    // Get status badge
    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'active':
                return <span className="px-2 py-0.5 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 text-xs rounded-full">ปกติ</span>;
            case 'sick':
                return <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 text-xs rounded-full">ป่วย</span>;
            case 'leave':
                return <span className="px-2 py-0.5 bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 text-xs rounded-full">ลา</span>;
            default:
                return null;
        }
    };

    // Allow modifying crew for all non-cancelled trips (including completed for retroactive assignment)
    const canModifyCrew = tripStatus !== 'cancelled';

    return (
        <Card className="p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <Users className="text-blue-600 dark:text-blue-400" size={24} />
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">พนักงานในทริป</h3>
                    {hasCrew && (
                        <span className="text-sm text-slate-500 dark:text-slate-400">({crew.length} คน)</span>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={refresh}
                        disabled={loading}
                        className="flex items-center gap-1"
                    >
                        <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                        รีเฟรช
                    </Button>
                </div>
            </div>

            {/* Error Message */}
            {manageError && (
                <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-2">
                    <AlertTriangle className="text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" size={20} />
                    <p className="text-sm text-red-800 dark:text-red-200">{manageError.message}</p>
                </div>
            )}

            {/* No Crew Warning */}
            {!loading && !hasCrew && tripStatus !== 'cancelled' && (
                <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border-2 border-red-300 dark:border-red-700 rounded-lg">
                    <div className="flex items-start gap-3">
                        <AlertCircle className="text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" size={24} />
                        <div className="flex-1">
                            <p className="font-semibold text-red-800 dark:text-red-200">ยังไม่ได้จัดพนักงานในทริปนี้</p>
                            <p className="text-sm text-red-600 dark:text-red-300 mt-1">
                                การจัดพนักงานมีผลต่อการคำนวณค่าคอมมิชชั่น กรุณาจัดพนักงานโดยเลือกคนขับ 1 คน และพนักงานบริการตามจำนวนที่ต้องการ
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {loading ? (
                <div className="text-center py-8">
                    <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                    <p className="mt-2 text-sm text-gray-600 dark:text-slate-400">กำลังโหลด...</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {/* ====== DRIVER SECTION ====== */}
                    <div className="border border-blue-200 dark:border-blue-800 rounded-lg overflow-hidden">
                        <div className="bg-blue-50 dark:bg-blue-900/30 px-4 py-3 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Truck className="text-blue-600 dark:text-blue-400" size={18} />
                                <span className="font-semibold text-blue-900 dark:text-blue-100">คนขับ</span>
                                <span className="text-xs text-blue-600 dark:text-blue-400">(1 คนต่อทริป)</span>
                            </div>
                            {canModifyCrew && !hasDriver && (
                                <Button
                                    size="sm"
                                    onClick={() => { setShowAddDriver(!showAddDriver); setShowAddHelper(false); setStaffSearch(''); setShowAllDriver(false); }}
                                    className="flex items-center gap-1"
                                >
                                    <Plus size={14} />
                                    เลือกคนขับ
                                </Button>
                            )}
                        </div>

                        <div className="p-4">
                            {/* Add Driver Form */}
                            {showAddDriver && canModifyCrew && !hasDriver && (
                                <div className="mb-3 p-3 bg-gray-50 dark:bg-slate-900/40 rounded-lg border border-gray-200 dark:border-slate-700">
                                    <div className="mb-2">
                                        <input
                                            type="text"
                                            value={staffSearch}
                                            onChange={(e) => setStaffSearch(e.target.value)}
                                            placeholder="ค้นหาพนักงาน..."
                                            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>
                                    {(() => {
                                        const { rows: driverRows, footer: driverFooter } = buildStaffListParts(
                                            'radio', showAllDriver, setShowAllDriver,
                                            (id) => selectedDriverId === id,
                                            (id) => setSelectedDriverId(id),
                                            'driver',
                                        );
                                        return (
                                            <div className="border border-gray-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900">
                                                <div className="max-h-48 overflow-y-auto">
                                                    {loadingStaff
                                                        ? <div className="p-4 text-center text-gray-500 dark:text-slate-400">กำลังโหลด...</div>
                                                        : driverRows}
                                                </div>
                                                {!loadingStaff && driverFooter}
                                            </div>
                                        );
                                    })()}
                                    <div className="flex gap-2 justify-end mt-3">
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => { setShowAddDriver(false); setSelectedDriverId(''); setStaffSearch(''); setShowAllDriver(false); }}
                                        >
                                            ยกเลิก
                                        </Button>
                                        <Button
                                            size="sm"
                                            onClick={handleAssignDriver}
                                            disabled={managing || !selectedDriverId}
                                        >
                                            {managing ? 'กำลังเพิ่ม...' : 'ยืนยันเลือกคนขับ'}
                                        </Button>
                                    </div>
                                </div>
                            )}

                            {/* Current Driver Display */}
                            {driverCrew ? (
                                <CrewMemberCard
                                    member={driverCrew}
                                    isSwapping={swapping === driverCrew.id}
                                    isRemoving={removing === driverCrew.id}
                                    canModify={canModifyCrew}
                                    swapReason={swapReason}
                                    replacementStaffId={replacementStaffId}
                                    removeReason={removeReason}
                                    managing={managing}
                                    availableStaff={getSwapPool('driver')}
                                    tripBranch={tripBranch}
                                    getStatusBadge={getStatusBadge}
                                    onSwapStart={() => { setSwapping(driverCrew.id); setRemoving(null); }}
                                    onSwapCancel={() => { setSwapping(null); setSwapReason(''); setReplacementStaffId(''); }}
                                    onSwapConfirm={() => handleSwapCrew(driverCrew.staff_id)}
                                    onSwapReasonChange={setSwapReason}
                                    onReplacementChange={setReplacementStaffId}
                                    onRemoveStart={() => { setRemoving(driverCrew.id); setSwapping(null); }}
                                    onRemoveCancel={() => { setRemoving(null); setRemoveReason(''); }}
                                    onRemoveConfirm={() => handleRemoveCrew(driverCrew.staff_id)}
                                    onRemoveReasonChange={setRemoveReason}
                                    allowRemove={false} // Driver can only be swapped, not removed
                                />
                            ) : (
                                <div className="text-center py-4 text-amber-600 dark:text-amber-400">
                                    <Truck className="mx-auto mb-2 text-amber-400 dark:text-amber-500" size={28} />
                                    <p className="font-medium">ยังไม่มีคนขับ</p>
                                    <p className="text-xs text-amber-500 dark:text-amber-500 mt-1">กรุณาเลือกคนขับ 1 คน (บังคับ)</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ====== HELPERS SECTION ====== */}
                    <div className="border border-green-200 dark:border-green-800 rounded-lg overflow-hidden">
                        <div className="bg-green-50 dark:bg-green-900/30 px-4 py-3 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <User className="text-green-600 dark:text-green-400" size={18} />
                                <span className="font-semibold text-green-900 dark:text-green-100">พนักงานบริการ</span>
                                {helperCrews.length > 0 && (
                                    <span className="text-xs text-green-600 dark:text-green-400">({helperCrews.length} คน)</span>
                                )}
                            </div>
                            {canModifyCrew && (
                                <Button
                                    size="sm"
                                    onClick={() => { setShowAddHelper(!showAddHelper); setShowAddDriver(false); setStaffSearch(''); setShowAllHelper(false); }}
                                    className="flex items-center gap-1"
                                >
                                    <Plus size={14} />
                                    เพิ่มพนักงาน
                                </Button>
                            )}
                        </div>

                        <div className="p-4">
                            {/* Add Helpers Form */}
                            {showAddHelper && canModifyCrew && (
                                <div className="mb-3 p-3 bg-gray-50 dark:bg-slate-900/40 rounded-lg border border-gray-200 dark:border-slate-700">
                                    <div className="mb-2">
                                        <input
                                            type="text"
                                            value={staffSearch}
                                            onChange={(e) => setStaffSearch(e.target.value)}
                                            placeholder="ค้นหาพนักงาน..."
                                            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>
                                    {(() => {
                                        const { rows: helperRows, footer: helperFooter } = buildStaffListParts(
                                            'checkbox', showAllHelper, setShowAllHelper,
                                            (id) => selectedStaffIds.includes(id),
                                            (id) => setSelectedStaffIds(prev =>
                                                prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id],
                                            ),
                                            'helper',
                                        );
                                        return (
                                            <div className="border border-gray-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900">
                                                <div className="max-h-48 overflow-y-auto">
                                                    {loadingStaff
                                                        ? <div className="p-4 text-center text-gray-500 dark:text-slate-400">กำลังโหลด...</div>
                                                        : helperRows}
                                                </div>
                                                {!loadingStaff && helperFooter}
                                            </div>
                                        );
                                    })()}
                                    <div className="flex gap-2 justify-end mt-3">
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => { setShowAddHelper(false); setSelectedStaffIds([]); setStaffSearch(''); setShowAllHelper(false); }}
                                        >
                                            ยกเลิก
                                        </Button>
                                        <Button
                                            size="sm"
                                            onClick={handleAssignHelpers}
                                            disabled={managing || selectedStaffIds.length === 0}
                                        >
                                            {managing ? 'กำลังเพิ่ม...' : `เพิ่ม (${selectedStaffIds.length})`}
                                        </Button>
                                    </div>
                                </div>
                            )}

                            {/* Current Helpers Display */}
                            {helperCrews.length > 0 ? (
                                <div className="space-y-3">
                                    {helperCrews.map((member) => (
                                        <CrewMemberCard
                                            key={member.id}
                                            member={member}
                                            isSwapping={swapping === member.id}
                                            isRemoving={removing === member.id}
                                            canModify={canModifyCrew}
                                            swapReason={swapReason}
                                            replacementStaffId={replacementStaffId}
                                            removeReason={removeReason}
                                            managing={managing}
                                            availableStaff={getSwapPool('helper')}
                                            tripBranch={tripBranch}
                                            getStatusBadge={getStatusBadge}
                                            onSwapStart={() => { setSwapping(member.id); setRemoving(null); }}
                                            onSwapCancel={() => { setSwapping(null); setSwapReason(''); setReplacementStaffId(''); }}
                                            onSwapConfirm={() => handleSwapCrew(member.staff_id)}
                                            onSwapReasonChange={setSwapReason}
                                            onReplacementChange={setReplacementStaffId}
                                            onRemoveStart={() => { setRemoving(member.id); setSwapping(null); }}
                                            onRemoveCancel={() => { setRemoving(null); setRemoveReason(''); }}
                                            onRemoveConfirm={() => handleRemoveCrew(member.staff_id)}
                                            onRemoveReasonChange={setRemoveReason}
                                            allowRemove={true}
                                        />
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-4 text-slate-500 dark:text-slate-400">
                                    <User className="mx-auto mb-2 text-slate-400 dark:text-slate-500" size={28} />
                                    <p>ยังไม่มีพนักงานบริการ</p>
                                    {canModifyCrew && (
                                        <p className="text-xs mt-1">คลิก "เพิ่มพนักงาน" เพื่อเพิ่มพนักงานบริการ</p>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Retroactive Assignment Info */}
                    {tripStatus === 'completed' && canModifyCrew && (
                        <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg flex items-start gap-2">
                            <AlertTriangle className="text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" size={18} />
                            <div className="text-sm text-amber-800 dark:text-amber-200">
                                <p className="font-medium">ทริปนี้เสร็จสิ้นแล้ว</p>
                                <p className="text-xs text-amber-600 dark:text-amber-300 mt-1">
                                    คุณยังสามารถจัดพนักงานย้อนหลังได้ การเปลี่ยนแปลงจะมีผลต่อการคำนวณค่าคอมมิชชั่น
                                </p>
                            </div>
                        </div>
                    )}

                    {tripStatus === 'in_progress' && canModifyCrew && (
                        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg flex items-start gap-2">
                            <AlertTriangle className="text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" size={18} />
                            <div className="text-sm text-blue-800 dark:text-blue-200">
                                <p className="font-medium">ทริปนี้กำลังดำเนินการ</p>
                                <p className="text-xs text-blue-600 dark:text-blue-300 mt-1">
                                    คุณยังสามารถจัดเปลี่ยนพนักงานได้ ถ้ามีการสับเปลี่ยนตัวกลางทาง ให้ใช้ปุ่ม "แทน" เพื่อเก็บประวัติ
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </Card>
    );
};

// ========== CrewMemberCard Sub-component ==========
interface CrewMemberCardProps {
    member: any;
    isSwapping: boolean;
    isRemoving: boolean;
    canModify: boolean;
    swapReason: string;
    replacementStaffId: string;
    removeReason: string;
    managing: boolean;
    availableStaff: ServiceStaffWithBranch[];
    tripBranch: string | null;
    getStatusBadge: (status: string) => React.ReactNode;
    onSwapStart: () => void;
    onSwapCancel: () => void;
    onSwapConfirm: () => void;
    onSwapReasonChange: (reason: string) => void;
    onReplacementChange: (staffId: string) => void;
    onRemoveStart: () => void;
    onRemoveCancel: () => void;
    onRemoveConfirm: () => void;
    onRemoveReasonChange: (reason: string) => void;
    allowRemove: boolean;
}

const CrewMemberCard: React.FC<CrewMemberCardProps> = ({
    member,
    isSwapping,
    isRemoving,
    canModify,
    swapReason,
    replacementStaffId,
    removeReason,
    managing,
    availableStaff,
    tripBranch,
    getStatusBadge,
    onSwapStart,
    onSwapCancel,
    onSwapConfirm,
    onSwapReasonChange,
    onReplacementChange,
    onRemoveStart,
    onRemoveCancel,
    onRemoveConfirm,
    onRemoveReasonChange,
    allowRemove,
}) => {
    const staffInfo = member.staff;
    const isDriver = member.role === 'driver';
    const staffBranch = availableStaff.find(s => s.id === member.staff_id)?.branch ?? null;

    return (
        <div className={`p-3 border rounded-lg transition-colors ${isDriver
            ? 'border-blue-200 dark:border-blue-800 hover:border-blue-300 dark:hover:border-blue-700'
            : 'border-gray-200 dark:border-slate-700 hover:border-gray-300 dark:hover:border-slate-600'
            }`}>
            <div className="flex items-start justify-between">
                <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="font-medium text-slate-900 dark:text-slate-100">{staffInfo?.name || 'Unknown'}</span>
                        <span className={`px-2 py-0.5 text-xs rounded-full ${isDriver
                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                            : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                            }`}>
                            {isDriver ? 'คนขับ' : 'พนักงานบริการ'}
                        </span>
                        {staffInfo && getStatusBadge(staffInfo.status)}
                        {staffBranch && <BranchBadge branch={staffBranch} isSame={staffBranch === tripBranch} />}
                    </div>
                    {staffInfo?.employee_code && (
                        <p className="text-sm text-gray-600 dark:text-slate-400">รหัส: {staffInfo.employee_code}</p>
                    )}
                    <p className="text-xs text-gray-500 dark:text-slate-500">
                        เริ่ม: {new Date(member.start_at).toLocaleString('th-TH')}
                    </p>
                </div>

                {canModify && !isSwapping && !isRemoving && (
                    <div className="flex gap-1">
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={onSwapStart}
                            className="flex items-center gap-1"
                            title="เปลี่ยนคน"
                        >
                            <RefreshCw size={14} />
                            <span className="hidden sm:inline">แทน</span>
                        </Button>
                        {allowRemove && (
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={onRemoveStart}
                                className="flex items-center gap-1 text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                                title="ลบออก"
                            >
                                <Trash2 size={14} />
                                <span className="hidden sm:inline">ลบ</span>
                            </Button>
                        )}
                    </div>
                )}
            </div>

            {/* Swap Form */}
            {isSwapping && (
                <div className="mt-3 pt-3 border-t border-gray-200 dark:border-slate-700 space-y-2">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-1">
                            พนักงานทดแทน
                        </label>
                        <select
                            value={replacementStaffId}
                            onChange={(e) => onReplacementChange(e.target.value)}
                            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="">-- เลือกพนักงาน --</option>
                            {tripBranch && availableStaff.some(s => s.branch === tripBranch) && (
                                <optgroup label={`── สาขา ${tripBranch} (สาขาเดียวกัน) ──`}>
                                    {availableStaff.filter(s => s.branch === tripBranch).map(staff => (
                                        <option key={staff.id} value={staff.id}>
                                            {staff.name} {staff.employee_code ? `(${staff.employee_code})` : ''}
                                        </option>
                                    ))}
                                </optgroup>
                            )}
                            {availableStaff.filter(s => !tripBranch || s.branch !== tripBranch).length > 0 && (
                                <optgroup label="── สาขาอื่น ──">
                                    {availableStaff.filter(s => !tripBranch || s.branch !== tripBranch).map(staff => (
                                        <option key={staff.id} value={staff.id}>
                                            {staff.name} {staff.employee_code ? `(${staff.employee_code})` : ''}{staff.branch ? ` [${staff.branch}]` : ''}
                                        </option>
                                    ))}
                                </optgroup>
                            )}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-1">
                            เหตุผล <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={swapReason}
                            onChange={(e) => onSwapReasonChange(e.target.value)}
                            placeholder="เช่น ป่วยกลางทาง, ฉุกเฉิน"
                            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    <div className="flex gap-2 justify-end">
                        <Button size="sm" variant="outline" onClick={onSwapCancel}>
                            ยกเลิก
                        </Button>
                        <Button
                            size="sm"
                            onClick={onSwapConfirm}
                            disabled={managing || !replacementStaffId || !swapReason.trim()}
                        >
                            {managing ? 'กำลังแทน...' : 'ยืนยันการแทน'}
                        </Button>
                    </div>
                </div>
            )}

            {/* Remove Form */}
            {isRemoving && (
                <div className="mt-3 pt-3 border-t border-gray-200 dark:border-slate-700 space-y-2">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-1">
                            เหตุผลที่ลบ <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={removeReason}
                            onChange={(e) => onRemoveReasonChange(e.target.value)}
                            placeholder="เช่น ไม่จำเป็นต้องใช้แล้ว, ใส่ผิดคน"
                            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    <div className="flex gap-2 justify-end">
                        <Button size="sm" variant="outline" onClick={onRemoveCancel}>
                            ยกเลิก
                        </Button>
                        <Button
                            size="sm"
                            onClick={onRemoveConfirm}
                            disabled={managing || !removeReason.trim()}
                            className="bg-red-600 text-white hover:bg-red-700"
                        >
                            {managing ? 'กำลังลบ...' : 'ยืนยันการลบ'}
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
};
