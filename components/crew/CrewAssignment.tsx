// Crew Assignment Component - Assign and manage crew for delivery trips
import React, { useState, useEffect } from 'react';
import { Plus, X, Users, AlertTriangle, Check, RefreshCw } from 'lucide-react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { useCrewByTrip, useCrewManagement } from '../../hooks/useCrew';
import { supabase } from '../../lib/supabase';
import type { Database } from '../../types/database';

type ServiceStaff = Database['public']['Tables']['service_staff']['Row'];

interface CrewAssignmentProps {
    tripId: string;
    tripStatus: string;
    onUpdate?: () => void;
}

export const CrewAssignment: React.FC<CrewAssignmentProps> = ({
    tripId,
    tripStatus,
    onUpdate,
}) => {
    const { crew, loading, refresh } = useCrewByTrip(tripId, true); // Active crew only
    const { assignCrew, swapCrew, loading: managing, error: manageError } = useCrewManagement();

    const [availableStaff, setAvailableStaff] = useState<ServiceStaff[]>([]);
    const [loadingStaff, setLoadingStaff] = useState(false);
    const [showAddCrew, setShowAddCrew] = useState(false);
    const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>([]);
    const [selectedRole, setSelectedRole] = useState<'driver' | 'helper'>('helper');

    // Swap crew state
    const [swapping, setSwapping] = useState<string | null>(null); // crew ID being swapped
    const [swapReason, setSwapReason] = useState('');
    const [replacementStaffId, setReplacementStaffId] = useState('');

    // Fetch available staff
    const fetchAvailableStaff = async () => {
        try {
            setLoadingStaff(true);
            const { data, error } = await supabase
                .from('service_staff')
                .select('*')
                .in('status', ['active', 'sick', 'leave']) // Don't show inactive
                .order('name');

            if (error) throw error;
            setAvailableStaff(data || []);
        } catch (err) {
            console.error('[CrewAssignment] Error fetching staff:', err);
        } finally {
            setLoadingStaff(false);
        }
    };

    useEffect(() => {
        fetchAvailableStaff();
    }, []);

    // Handle assign crew
    const handleAssignCrew = async () => {
        if (selectedStaffIds.length === 0) {
            alert('กรุณาเลือกพนักงาน');
            return;
        }

        const result = await assignCrew(tripId, selectedStaffIds, selectedRole);
        if (result) {
            setSelectedStaffIds([]);
            setShowAddCrew(false);
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

    // Get available staff for selection (exclude already assigned)
    const getAvailableStaffForSelection = () => {
        const assignedStaffIds = crew.map(c => c.staff_id);
        return availableStaff.filter(s => !assignedStaffIds.includes(s.id));
    };

    // Get staff info
    const getStaffInfo = (staffId: string) => {
        return availableStaff.find(s => s.id === staffId);
    };

    // Get status badge
    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'active':
                return <span className="px-2 py-0.5 bg-green-100 text-green-800 text-xs rounded-full">ปกติ</span>;
            case 'sick':
                return <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 text-xs rounded-full">ป่วย</span>;
            case 'leave':
                return <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded-full">ลา</span>;
            default:
                return null;
        }
    };

    const canModifyCrew = tripStatus === 'planned' || tripStatus === 'in_progress';

    return (
        <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <Users className="text-blue-600" size={24} />
                    <h3 className="text-lg font-semibold">พนักงานในทริป</h3>
                </div>
                {canModifyCrew && (
                    <Button
                        size="sm"
                        onClick={() => setShowAddCrew(!showAddCrew)}
                        className="flex items-center gap-1"
                    >
                        <Plus size={16} />
                        เพิ่มพนักงาน
                    </Button>
                )}
            </div>

            {/* Error Message */}
            {manageError && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                    <AlertTriangle className="text-red-600 flex-shrink-0 mt-0.5" size={20} />
                    <p className="text-sm text-red-800">{manageError.message}</p>
                </div>
            )}

            {/* Add Crew Form */}
            {showAddCrew && canModifyCrew && (
                <div className="mb-4 p-4 bg-gray-50 dark:bg-slate-900/40 rounded-lg border border-gray-200 dark:border-slate-700">
                    <h4 className="font-medium mb-3 text-gray-900 dark:text-slate-100">เพิ่มพนักงาน</h4>

                    <div className="space-y-3">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-1">
                                ตำแหน่ง
                            </label>
                            <select
                                value={selectedRole}
                                onChange={(e) => setSelectedRole(e.target.value as any)}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="driver">คนขับ</option>
                                <option value="helper">ผู้ช่วย</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-1">
                                เลือกพนักงาน
                            </label>
                            <div className="max-h-48 overflow-y-auto border border-gray-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900">
                                {loadingStaff ? (
                                    <div className="p-4 text-center text-gray-500 dark:text-slate-400">กำลังโหลด...</div>
                                ) : getAvailableStaffForSelection().length === 0 ? (
                                    <div className="p-4 text-center text-gray-500 dark:text-slate-400">ไม่มีพนักงานที่พร้อมใช้งาน</div>
                                ) : (
                                    getAvailableStaffForSelection().map((staff) => (
                                        <label
                                            key={staff.id}
                                            className="flex items-center gap-2 p-2 hover:bg-gray-50 dark:hover:bg-slate-800 cursor-pointer"
                                        >
                                            <input
                                                type="checkbox"
                                                checked={selectedStaffIds.includes(staff.id)}
                                                onChange={(e) => {
                                                    if (e.target.checked) {
                                                        setSelectedStaffIds([...selectedStaffIds, staff.id]);
                                                    } else {
                                                        setSelectedStaffIds(selectedStaffIds.filter(id => id !== staff.id));
                                                    }
                                                }}
                                                className="rounded border-gray-300 dark:border-slate-600"
                                            />
                                            <span className="flex-1 text-gray-900 dark:text-slate-100">{staff.name}</span>
                                            {staff.employee_code && (
                                                <span className="text-xs text-gray-500 dark:text-slate-400">{staff.employee_code}</span>
                                            )}
                                            {getStatusBadge(staff.status)}
                                        </label>
                                    ))
                                )}
                            </div>
                        </div>

                        <div className="flex gap-2 justify-end">
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                    setShowAddCrew(false);
                                    setSelectedStaffIds([]);
                                }}
                            >
                                ยกเลิก
                            </Button>
                            <Button
                                size="sm"
                                onClick={handleAssignCrew}
                                disabled={managing || selectedStaffIds.length === 0}
                            >
                                {managing ? 'กำลังเพิ่ม...' : `เพิ่ม (${selectedStaffIds.length})`}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Crew List */}
            {loading ? (
                <div className="text-center py-8">
                    <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                    <p className="mt-2 text-sm text-gray-600">กำลังโหลด...</p>
                </div>
            ) : crew.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                    <Users className="mx-auto mb-2 text-gray-400" size={32} />
                    <p>ยังไม่มีพนักงานในทริปนี้</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {crew.map((member) => {
                        const staffInfo = member.staff;
                        const isSwapping = swapping === member.id;

                        return (
                            <div
                                key={member.id}
                                className="p-3 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
                            >
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="font-medium">{staffInfo?.name || 'Unknown'}</span>
                                            <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded-full">
                                                {member.role === 'driver' ? 'คนขับ' : 'ผู้ช่วย'}
                                            </span>
                                            {staffInfo && getStatusBadge(staffInfo.status)}
                                        </div>
                                        {staffInfo?.employee_code && (
                                            <p className="text-sm text-gray-600">รหัส: {staffInfo.employee_code}</p>
                                        )}
                                        <p className="text-xs text-gray-500">
                                            เริ่ม: {new Date(member.start_at).toLocaleString('th-TH')}
                                        </p>
                                    </div>

                                    {canModifyCrew && !isSwapping && (
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => setSwapping(member.id)}
                                            className="flex items-center gap-1"
                                        >
                                            <RefreshCw size={14} />
                                            แทน
                                        </Button>
                                    )}
                                </div>

                                {/* Swap Form */}
                                {isSwapping && (
                                    <div className="mt-3 pt-3 border-t border-gray-200 space-y-2">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                                พนักงานทดแทน
                                            </label>
                                            <select
                                                value={replacementStaffId}
                                                onChange={(e) => setReplacementStaffId(e.target.value)}
                                                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                            >
                                                <option value="">-- เลือกพนักงาน --</option>
                                                {getAvailableStaffForSelection().map((staff) => (
                                                    <option key={staff.id} value={staff.id}>
                                                        {staff.name} {staff.employee_code ? `(${staff.employee_code})` : ''}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                                เหตุผล <span className="text-red-500">*</span>
                                            </label>
                                            <input
                                                type="text"
                                                value={swapReason}
                                                onChange={(e) => setSwapReason(e.target.value)}
                                                placeholder="เช่น ป่วยกลางทาง, ฉุกเฉิน"
                                                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                            />
                                        </div>

                                        <div className="flex gap-2 justify-end">
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => {
                                                    setSwapping(null);
                                                    setSwapReason('');
                                                    setReplacementStaffId('');
                                                }}
                                            >
                                                ยกเลิก
                                            </Button>
                                            <Button
                                                size="sm"
                                                onClick={() => handleSwapCrew(member.staff_id)}
                                                disabled={managing || !replacementStaffId || !swapReason.trim()}
                                            >
                                                {managing ? 'กำลังแทน...' : 'ยืนยันการแทน'}
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Refresh Button */}
            {crew.length > 0 && (
                <div className="mt-4 text-center">
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={refresh}
                        disabled={loading}
                        className="flex items-center gap-1 mx-auto"
                    >
                        <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                        รีเฟรช
                    </Button>
                </div>
            )}
        </Card>
    );
};
