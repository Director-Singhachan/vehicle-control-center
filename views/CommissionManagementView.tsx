// Commission Management View - Dashboard for commission calculation & verification
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
    DollarSign, Calculator, Download, Calendar, Users, CheckCircle2,
    AlertCircle, Loader2, X, ChevronDown, ChevronUp, Truck, Hash,
    Clock, Zap, User, FileSpreadsheet, RefreshCw, ArrowRight, Info
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { PageLayout } from '../components/layout/PageLayout';
import {
    useDetailedCommissionByStaff,
    useTripsWithCommissionStatus,
    useBatchCommission,
} from '../hooks/useCrew';
import { excelExport } from '../utils/excelExport';

type ActiveTab = 'staff' | 'trips';

interface Notification {
    message: string;
    type: 'success' | 'error' | 'info';
}

// Format currency helper
const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' }).format(amount);

const formatNumber = (n: number) =>
    new Intl.NumberFormat('th-TH').format(n);

const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('th-TH', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    });
};

export const CommissionManagementView: React.FC = () => {
    const [activeTab, setActiveTab] = useState<ActiveTab>('staff');
    const [notification, setNotification] = useState<Notification | null>(null);

    // Date range - default to current month
    const now = new Date();
    const [startDate, setStartDate] = useState(new Date(now.getFullYear(), now.getMonth(), 1));
    const [endDate, setEndDate] = useState(new Date(now.getFullYear(), now.getMonth() + 1, 0));

    // Expanded states
    const [expandedStaff, setExpandedStaff] = useState<Set<string>>(new Set());
    const [expandedTrips, setExpandedTrips] = useState<Set<string>>(new Set());

    // Data hooks
    const {
        data: staffData,
        loading: loadingStaff,
        error: staffError,
        refresh: refreshStaff,
    } = useDetailedCommissionByStaff(startDate, endDate);

    const {
        trips: tripsData,
        stats: tripStats,
        loading: loadingTrips,
        error: tripsError,
        refresh: refreshTrips,
    } = useTripsWithCommissionStatus(startDate, endDate);

    const {
        batchCalculate,
        loading: batchLoading,
        progress: batchProgress,
        result: batchResult,
        error: batchError,
        reset: resetBatch,
    } = useBatchCommission();

    // Clear notification after 5 seconds
    useEffect(() => {
        if (notification) {
            const timer = setTimeout(() => setNotification(null), 5000);
            return () => clearTimeout(timer);
        }
    }, [notification]);

    const showNotify = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
        setNotification({ message, type });
    };

    // Pending trip IDs for batch calculation
    const pendingTripIds = useMemo(() => {
        return tripsData.filter(t => !t.has_commission && t.has_crew).map(t => t.trip_id);
    }, [tripsData]);

    // Handle batch calculate
    const handleBatchCalculate = async () => {
        if (pendingTripIds.length === 0) {
            showNotify('ไม่มีทริปที่ค้างคำนวณ', 'info');
            return;
        }

        resetBatch();
        const result = await batchCalculate(pendingTripIds);

        if (result) {
            if (result.failed === 0) {
                showNotify(`คำนวณสำเร็จทั้งหมด ${result.success} ทริป`, 'success');
            } else {
                showNotify(
                    `คำนวณสำเร็จ ${result.success} ทริป, ล้มเหลว ${result.failed} ทริป`,
                    result.success > 0 ? 'info' : 'error'
                );
            }
            // Refresh data after batch calculation
            refreshStaff();
            refreshTrips();
        }
    };

    // Handle single trip calculate
    const handleSingleCalculate = async (tripId: string, isRecalculate: boolean = false) => {
        resetBatch();
        const result = await batchCalculate([tripId]);
        if (result?.success) {
            showNotify(isRecalculate ? 'คำนวณค่าคอมมิชชั่นใหม่สำเร็จ' : 'คำนวณค่าคอมมิชชั่นสำเร็จ', 'success');
            refreshStaff();
            refreshTrips();
        } else {
            showNotify(
                isRecalculate
                    ? 'คำนวณค่าคอมมิชชั่นใหม่ล้มเหลว ตรวจสอบข้อมูลพนักงานและสินค้า'
                    : 'คำนวณล้มเหลว ตรวจสอบข้อมูลพนักงานและสินค้า',
                'error'
            );
        }
    };

    // Refresh all data
    const handleRefreshAll = useCallback(() => {
        refreshStaff();
        refreshTrips();
    }, [refreshStaff, refreshTrips]);

    // Toggle expand
    const toggleStaffExpand = (staffId: string) => {
        setExpandedStaff(prev => {
            const next = new Set(prev);
            if (next.has(staffId)) next.delete(staffId);
            else next.add(staffId);
            return next;
        });
    };

    const toggleTripExpand = (tripId: string) => {
        setExpandedTrips(prev => {
            const next = new Set(prev);
            if (next.has(tripId)) next.delete(tripId);
            else next.add(tripId);
            return next;
        });
    };

    // Export Excel
    const handleExportSummary = () => {
        if (!staffData || staffData.length === 0) return;

        excelExport.exportToExcel(
            staffData.map(s => ({
                staff_name: s.staff_name,
                employee_code: s.employee_code || '-',
                totalTrips: s.totalTrips,
                totalCommission: s.totalCommission,
                averagePerTrip: s.totalTrips > 0 ? s.totalCommission / s.totalTrips : 0,
            })),
            [
                { key: 'staff_name', label: 'ชื่อพนักงาน', width: 25 },
                { key: 'employee_code', label: 'รหัสพนักงาน', width: 15 },
                { key: 'totalTrips', label: 'จำนวนทริป', width: 12, format: excelExport.formatNumber },
                { key: 'totalCommission', label: 'ยอดค่าคอมรวม (฿)', width: 20, format: excelExport.formatCurrency },
                { key: 'averagePerTrip', label: 'เฉลี่ย/ทริป (฿)', width: 18, format: excelExport.formatCurrency },
            ],
            `สรุปค่าคอมมิชชั่น_${startDate.toISOString().split('T')[0]}_ถึง_${endDate.toISOString().split('T')[0]}`
        );
        showNotify('ส่งออกไฟล์ Excel สำเร็จ', 'success');
    };

    const handleExportDetail = () => {
        if (!staffData || staffData.length === 0) return;

        const rows: any[] = [];
        staffData.forEach(s => {
            s.trips.forEach(t => {
                rows.push({
                    staff_name: s.staff_name,
                    employee_code: s.employee_code || '-',
                    trip_number: t.trip_number,
                    planned_date: t.planned_date,
                    vehicle_plate: t.vehicle_plate,
                    total_items: t.total_items,
                    rate_applied: t.rate_applied,
                    work_percentage: t.work_percentage,
                    actual_commission: t.actual_commission,
                });
            });
        });

        excelExport.exportToExcel(
            rows,
            [
                { key: 'staff_name', label: 'ชื่อพนักงาน', width: 25 },
                { key: 'employee_code', label: 'รหัสพนักงาน', width: 15 },
                { key: 'trip_number', label: 'เลขทริป', width: 18 },
                { key: 'planned_date', label: 'วันที่', width: 14 },
                { key: 'vehicle_plate', label: 'ทะเบียนรถ', width: 14 },
                { key: 'total_items', label: 'จำนวนสินค้า', width: 14, format: excelExport.formatNumber },
                { key: 'rate_applied', label: 'อัตรา/ชิ้น (฿)', width: 14, format: excelExport.formatCurrency },
                { key: 'work_percentage', label: 'สัดส่วนงาน (%)', width: 14 },
                { key: 'actual_commission', label: 'ค่าคอมฯ (฿)', width: 16, format: excelExport.formatCurrency },
            ],
            `รายละเอียดค่าคอม_${startDate.toISOString().split('T')[0]}_ถึง_${endDate.toISOString().split('T')[0]}`
        );
        showNotify('ส่งออกรายละเอียดสำเร็จ', 'success');
    };

    const isLoading = loadingStaff || loadingTrips;
    const hasError = staffError || tripsError;

    // Total commission from staff data (more accurate since it's from logs)
    const totalCommission = useMemo(
        () => staffData.reduce((sum, s) => sum + s.totalCommission, 0),
        [staffData]
    );

    return (
        <PageLayout
            title="จัดการค่าคอมมิชชั่น"
            subtitle="คำนวณและตรวจสอบค่าคอมมิชชั่นพนักงาน -- ดูที่มาของทุกบาท"
        >
            {/* Notification */}
            {notification && (
                <div className={`fixed top-20 right-4 z-50 p-4 rounded-xl shadow-xl flex items-center gap-3 animate-in fade-in slide-in-from-right-4 duration-300 max-w-md ${
                    notification.type === 'success' ? 'bg-green-600 text-white' :
                    notification.type === 'error' ? 'bg-red-600 text-white' :
                    'bg-blue-600 text-white'
                }`}>
                    {notification.type === 'success' && <CheckCircle2 size={20} />}
                    {notification.type === 'error' && <AlertCircle size={20} />}
                    {notification.type === 'info' && <Info size={20} />}
                    <span className="font-medium text-sm">{notification.message}</span>
                    <button onClick={() => setNotification(null)} className="ml-2 hover:opacity-80">
                        <X size={16} />
                    </button>
                </div>
            )}

            {/* Date Range + Actions */}
            <div className="flex flex-col lg:flex-row lg:items-end gap-4 mb-6">
                <div className="flex items-end gap-3 flex-1 flex-wrap">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">วันที่เริ่มต้น</label>
                        <div className="relative">
                            <Input
                                type="date"
                                value={startDate.toISOString().split('T')[0]}
                                onChange={(e) => setStartDate(new Date(e.target.value))}
                                className="h-11 pl-9 rounded-xl border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
                            />
                            <Calendar className="absolute left-2.5 top-2.5 text-slate-400 dark:text-slate-500" size={18} />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">วันที่สิ้นสุด</label>
                        <div className="relative">
                            <Input
                                type="date"
                                value={endDate.toISOString().split('T')[0]}
                                onChange={(e) => setEndDate(new Date(e.target.value))}
                                className="h-11 pl-9 rounded-xl border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
                            />
                            <Calendar className="absolute left-2.5 top-2.5 text-slate-400 dark:text-slate-500" size={18} />
                        </div>
                    </div>
                    <Button
                        onClick={handleRefreshAll}
                        variant="outline"
                        disabled={isLoading}
                        className="h-11 px-4 rounded-xl"
                    >
                        <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
                    </Button>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    {/* Batch Calculate */}
                    <Button
                        onClick={handleBatchCalculate}
                        disabled={batchLoading || pendingTripIds.length === 0}
                        className="h-11 px-5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg shadow-blue-200 dark:shadow-none font-bold flex items-center gap-2"
                    >
                        {batchLoading ? (
                            <Loader2 size={16} className="animate-spin" />
                        ) : (
                            <Zap size={16} />
                        )}
                        {batchLoading
                            ? `กำลังคำนวณ ${batchProgress.current}/${batchProgress.total}...`
                            : `คำนวณทั้งหมดที่ค้าง`
                        }
                        {!batchLoading && pendingTripIds.length > 0 && (
                            <span className="ml-1 bg-white/20 text-white text-xs px-2 py-0.5 rounded-full font-black">
                                {pendingTripIds.length}
                            </span>
                        )}
                    </Button>

                    {/* Export Menu */}
                    <div className="relative group">
                        <Button
                            variant="outline"
                            disabled={staffData.length === 0}
                            className="h-11 px-4 rounded-xl flex items-center gap-2"
                        >
                            <Download size={16} />
                            Excel
                            <ChevronDown size={14} />
                        </Button>
                        <div className="absolute right-0 top-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-20 hidden group-hover:block min-w-[200px]">
                            <button
                                onClick={handleExportSummary}
                                className="w-full text-left px-4 py-3 text-sm hover:bg-slate-50 dark:hover:bg-slate-700 rounded-t-xl flex items-center gap-2 text-slate-700 dark:text-slate-200"
                            >
                                <FileSpreadsheet size={16} className="text-green-600" />
                                สรุปรายพนักงาน
                            </button>
                            <button
                                onClick={handleExportDetail}
                                className="w-full text-left px-4 py-3 text-sm hover:bg-slate-50 dark:hover:bg-slate-700 rounded-b-xl flex items-center gap-2 text-slate-700 dark:text-slate-200"
                            >
                                <FileSpreadsheet size={16} className="text-blue-600" />
                                รายละเอียดทุกทริป
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Batch Progress Bar */}
            {batchLoading && (
                <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-bold text-blue-800 dark:text-blue-200">
                            กำลังคำนวณค่าคอมมิชชั่น...
                        </span>
                        <span className="text-sm text-blue-600 dark:text-blue-300">
                            {batchProgress.current} / {batchProgress.total}
                        </span>
                    </div>
                    <div className="w-full bg-blue-200 dark:bg-blue-800 rounded-full h-2">
                        <div
                            className="bg-blue-600 dark:bg-blue-400 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${batchProgress.total > 0 ? (batchProgress.current / batchProgress.total) * 100 : 0}%` }}
                        />
                    </div>
                </div>
            )}

            {/* Batch Result */}
            {batchResult && !batchLoading && (
                <div className={`mb-6 p-4 rounded-xl border flex items-start gap-3 ${
                    batchResult.failed === 0
                        ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                        : 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
                }`}>
                    <CheckCircle2 className={batchResult.failed === 0 ? 'text-green-600' : 'text-yellow-600'} size={20} />
                    <div className="flex-1">
                        <p className={`text-sm font-bold ${batchResult.failed === 0 ? 'text-green-800 dark:text-green-200' : 'text-yellow-800 dark:text-yellow-200'}`}>
                            คำนวณเสร็จสิ้น: สำเร็จ {batchResult.success} ทริป
                            {batchResult.failed > 0 && `, ล้มเหลว ${batchResult.failed} ทริป`}
                        </p>
                        {batchResult.errors.length > 0 && (
                            <div className="mt-2 text-xs text-yellow-700 dark:text-yellow-300 space-y-1">
                                {batchResult.errors.slice(0, 5).map((err, i) => (
                                    <p key={i}>{err}</p>
                                ))}
                                {batchResult.errors.length > 5 && (
                                    <p>...และอีก {batchResult.errors.length - 5} รายการ</p>
                                )}
                            </div>
                        )}
                    </div>
                    <button onClick={resetBatch} className="text-slate-400 hover:text-slate-600">
                        <X size={16} />
                    </button>
                </div>
            )}

            {/* Stats Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <Card className="overflow-hidden">
                    <div className="p-4 flex items-center gap-3">
                        <div className="p-2.5 bg-blue-50 dark:bg-blue-900/30 rounded-xl">
                            <Truck className="text-blue-600 dark:text-blue-400" size={22} />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">ทริปที่เสร็จ</p>
                            <p className="text-2xl font-black text-slate-900 dark:text-white">{tripStats.total}</p>
                        </div>
                    </div>
                </Card>

                <Card className="overflow-hidden">
                    <div className="p-4 flex items-center gap-3">
                        <div className="p-2.5 bg-green-50 dark:bg-green-900/30 rounded-xl">
                            <CheckCircle2 className="text-green-600 dark:text-green-400" size={22} />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">คำนวณแล้ว</p>
                            <p className="text-2xl font-black text-green-600 dark:text-green-400">{tripStats.calculated}</p>
                        </div>
                    </div>
                </Card>

                <Card className="overflow-hidden">
                    <div className="p-4 flex items-center gap-3">
                        <div className={`p-2.5 rounded-xl ${tripStats.pending > 0 ? 'bg-orange-50 dark:bg-orange-900/30' : 'bg-slate-50 dark:bg-slate-800'}`}>
                            <Clock className={tripStats.pending > 0 ? 'text-orange-600 dark:text-orange-400' : 'text-slate-400'} size={22} />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">ค้างคำนวณ</p>
                            <p className={`text-2xl font-black ${tripStats.pending > 0 ? 'text-orange-600 dark:text-orange-400' : 'text-slate-400'}`}>
                                {tripStats.pending}
                            </p>
                        </div>
                    </div>
                </Card>

                <Card className="overflow-hidden">
                    <div className="p-4 flex items-center gap-3">
                        <div className="p-2.5 bg-emerald-50 dark:bg-emerald-900/30 rounded-xl">
                            <DollarSign className="text-emerald-600 dark:text-emerald-400" size={22} />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">ค่าคอมรวม</p>
                            <p className="text-xl font-black text-emerald-600 dark:text-emerald-400">{formatCurrency(totalCommission)}</p>
                        </div>
                    </div>
                </Card>
            </div>

            {/* Tabs */}
            <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl mb-6 w-fit">
                <button
                    className={`px-5 py-2 rounded-lg font-semibold text-sm transition-all duration-200 flex items-center gap-2 ${
                        activeTab === 'staff'
                            ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm'
                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'
                    }`}
                    onClick={() => setActiveTab('staff')}
                >
                    <Users size={16} />
                    สรุปรายพนักงาน
                    {staffData.length > 0 && (
                        <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded-full font-bold">
                            {staffData.length}
                        </span>
                    )}
                </button>
                <button
                    className={`px-5 py-2 rounded-lg font-semibold text-sm transition-all duration-200 flex items-center gap-2 ${
                        activeTab === 'trips'
                            ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm'
                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'
                    }`}
                    onClick={() => setActiveTab('trips')}
                >
                    <Truck size={16} />
                    ตรวจสอบทริป
                    {tripStats.pending > 0 && (
                        <span className="text-xs bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 px-1.5 py-0.5 rounded-full font-bold animate-pulse">
                            {tripStats.pending}
                        </span>
                    )}
                </button>
            </div>

            {/* Error State */}
            {hasError && (
                <div className="p-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl mb-6">
                    <div className="flex items-start gap-3">
                        <AlertCircle className="text-red-500 mt-0.5" size={24} />
                        <div>
                            <p className="font-bold text-red-800 dark:text-red-200">เกิดข้อผิดพลาดในการโหลดข้อมูล</p>
                            <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                                {staffError?.message || tripsError?.message || 'กรุณาลองใหม่'}
                            </p>
                            <Button onClick={handleRefreshAll} variant="outline" className="mt-3">
                                ลองใหม่
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Loading State */}
            {isLoading && !hasError && (
                <div className="flex flex-col items-center justify-center py-20">
                    <Loader2 className="animate-spin text-blue-500 mb-4" size={40} />
                    <p className="text-slate-500 dark:text-slate-400 font-bold">กำลังโหลดข้อมูลค่าคอมมิชชั่น...</p>
                </div>
            )}

            {/* ===== TAB 1: Staff Summary ===== */}
            {!isLoading && !hasError && activeTab === 'staff' && (
                <div className="space-y-3">
                    {staffData.length === 0 ? (
                        <div className="text-center py-20 bg-slate-50 dark:bg-slate-800/50 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl">
                            <DollarSign className="mx-auto mb-4 text-slate-300 dark:text-slate-600" size={56} />
                            <h3 className="text-lg font-bold text-slate-500 dark:text-slate-400">ไม่มีข้อมูลค่าคอมมิชชั่นในช่วงนี้</h3>
                            <p className="text-slate-400 dark:text-slate-500 mt-2 text-sm">
                                {tripStats.pending > 0
                                    ? `มีทริปค้างคำนวณ ${tripStats.pending} ทริป กดปุ่ม "คำนวณทั้งหมดที่ค้าง" เพื่อเริ่มคำนวณ`
                                    : 'ลองเลือกช่วงวันที่อื่น หรือตรวจสอบว่ามีทริปที่เสร็จสิ้นแล้วหรือไม่'
                                }
                            </p>
                        </div>
                    ) : (
                        staffData.map((staff) => {
                            const isExpanded = expandedStaff.has(staff.staff_id);
                            const avgPerTrip = staff.totalTrips > 0 ? staff.totalCommission / staff.totalTrips : 0;

                            return (
                                <Card key={staff.staff_id} className="overflow-hidden transition-all duration-200">
                                    {/* Staff Header - Clickable */}
                                    <button
                                        type="button"
                                        className="w-full text-left p-5 flex items-center gap-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                                        onClick={() => toggleStaffExpand(staff.staff_id)}
                                    >
                                        {/* Avatar */}
                                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-black text-lg flex-shrink-0 shadow-md">
                                            {staff.staff_name.charAt(0)}
                                        </div>

                                        {/* Info */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="font-black text-lg text-slate-900 dark:text-white">{staff.staff_name}</span>
                                                {staff.employee_code && (
                                                    <Badge variant="info" className="text-xs font-mono">{staff.employee_code}</Badge>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-4 text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                                                <span className="flex items-center gap-1">
                                                    <Truck size={14} /> {staff.totalTrips} ทริป
                                                </span>
                                                <span className="flex items-center gap-1">
                                                    <ArrowRight size={14} /> เฉลี่ย {formatCurrency(avgPerTrip)}/ทริป
                                                </span>
                                            </div>
                                        </div>

                                        {/* Total Commission */}
                                        <div className="text-right flex-shrink-0">
                                            <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                                                {formatCurrency(staff.totalCommission)}
                                            </p>
                                        </div>

                                        {/* Expand Icon */}
                                        <div className="flex-shrink-0 ml-2">
                                            {isExpanded ? (
                                                <ChevronUp size={20} className="text-slate-400" />
                                            ) : (
                                                <ChevronDown size={20} className="text-slate-400" />
                                            )}
                                        </div>
                                    </button>

                                    {/* Expanded Trip Breakdown */}
                                    {isExpanded && (
                                        <div className="border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/30">
                                            <div className="p-4">
                                                <div className="flex items-center gap-2 mb-3">
                                                    <Calculator size={16} className="text-blue-500" />
                                                    <span className="text-sm font-bold text-slate-700 dark:text-slate-300">รายละเอียดค่าคอมแต่ละทริป</span>
                                                </div>

                                                {/* Table */}
                                                <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
                                                    <table className="w-full text-sm">
                                                        <thead>
                                                            <tr className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                                                                <th className="text-left px-4 py-3 font-bold">ทริป</th>
                                                                <th className="text-left px-4 py-3 font-bold">วันที่</th>
                                                                <th className="text-left px-4 py-3 font-bold">ทะเบียน</th>
                                                                <th className="text-right px-4 py-3 font-bold">สินค้า</th>
                                                                <th className="text-right px-4 py-3 font-bold">อัตรา/ชิ้น</th>
                                                                <th className="text-right px-4 py-3 font-bold">สัดส่วน</th>
                                                                <th className="text-right px-4 py-3 font-bold">ค่าคอม</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700 bg-white dark:bg-slate-900/50">
                                                            {staff.trips.map((trip, idx) => (
                                                                <tr key={`${trip.trip_id}-${idx}`} className="hover:bg-blue-50/50 dark:hover:bg-slate-800/50 transition-colors">
                                                                    <td className="px-4 py-3">
                                                                        <span className="font-bold text-blue-600 dark:text-blue-400">{trip.trip_number}</span>
                                                                    </td>
                                                                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{formatDate(trip.planned_date)}</td>
                                                                    <td className="px-4 py-3">
                                                                        <span className="text-slate-700 dark:text-slate-300">{trip.vehicle_plate}</span>
                                                                    </td>
                                                                    <td className="px-4 py-3 text-right font-semibold text-slate-800 dark:text-white">
                                                                        {formatNumber(trip.total_items)}
                                                                    </td>
                                                                    <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-400">
                                                                        {formatCurrency(trip.rate_applied)}
                                                                    </td>
                                                                    <td className="px-4 py-3 text-right">
                                                                        <span className="inline-block px-2 py-0.5 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-xs font-bold">
                                                                            {trip.work_percentage.toFixed(1)}%
                                                                        </span>
                                                                    </td>
                                                                    <td className="px-4 py-3 text-right font-black text-emerald-600 dark:text-emerald-400">
                                                                        {formatCurrency(trip.actual_commission)}
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                        <tfoot>
                                                            <tr className="bg-slate-50 dark:bg-slate-800/50 border-t-2 border-slate-200 dark:border-slate-700">
                                                                <td colSpan={6} className="px-4 py-3 text-right font-black text-slate-700 dark:text-slate-300">
                                                                    รวมทั้งสิ้น
                                                                </td>
                                                                <td className="px-4 py-3 text-right font-black text-xl text-emerald-600 dark:text-emerald-400">
                                                                    {formatCurrency(staff.totalCommission)}
                                                                </td>
                                                            </tr>
                                                        </tfoot>
                                                    </table>
                                                </div>

                                                {/* Formula explanation */}
                                                <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800 rounded-lg">
                                                    <p className="text-xs text-blue-700 dark:text-blue-300 flex items-start gap-2">
                                                        <Info size={14} className="flex-shrink-0 mt-0.5" />
                                                        <span>
                                                            <strong>สูตรคำนวณ:</strong> จำนวนสินค้าทั้งทริป x อัตราต่อชิ้น = ค่าคอมทั้งทริป จากนั้นแบ่งตามสัดส่วนเวลาทำงาน (%)
                                                            เช่น 1,200 ชิ้น x ฿0.50 = ฿600 ทั้งทริป หากทำงาน 50% จะได้ ฿300
                                                        </span>
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </Card>
                            );
                        })
                    )}

                    {/* Grand Total */}
                    {staffData.length > 0 && (
                        <Card className="border-2 border-emerald-200 dark:border-emerald-800 overflow-hidden">
                            <div className="p-5 bg-gradient-to-r from-emerald-50 to-green-50 dark:from-emerald-900/20 dark:to-green-900/20">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <DollarSign className="text-emerald-600 dark:text-emerald-400" size={28} />
                                        <div>
                                            <p className="text-sm font-bold text-emerald-800 dark:text-emerald-200 uppercase tracking-wider">ยอดรวมค่าคอมมิชชั่นทั้งหมด</p>
                                            <p className="text-xs text-emerald-600 dark:text-emerald-300 mt-0.5">
                                                {staffData.length} พนักงาน, {staffData.reduce((s, d) => s + d.totalTrips, 0)} ทริป
                                            </p>
                                        </div>
                                    </div>
                                    <p className="text-4xl font-black text-emerald-600 dark:text-emerald-400">
                                        {formatCurrency(totalCommission)}
                                    </p>
                                </div>
                            </div>
                        </Card>
                    )}
                </div>
            )}

            {/* ===== TAB 2: Trip Verification ===== */}
            {!isLoading && !hasError && activeTab === 'trips' && (
                <div className="space-y-3">
                    {tripsData.length === 0 ? (
                        <div className="text-center py-20 bg-slate-50 dark:bg-slate-800/50 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl">
                            <Truck className="mx-auto mb-4 text-slate-300 dark:text-slate-600" size={56} />
                            <h3 className="text-lg font-bold text-slate-500 dark:text-slate-400">ไม่มีทริปที่เสร็จสิ้นในช่วงนี้</h3>
                            <p className="text-slate-400 dark:text-slate-500 mt-2 text-sm">ลองเลือกช่วงวันที่อื่น</p>
                        </div>
                    ) : (
                        tripsData.map((trip) => {
                            const isExpanded = expandedTrips.has(trip.trip_id);
                            const isPending = !trip.has_commission;
                            const noCrew = !trip.has_crew;

                            return (
                                <Card key={trip.trip_id} className="overflow-hidden">
                                    {/* Trip Header */}
                                    <div className="p-4 flex items-center gap-4">
                                        {/* Click to expand (only if has commission) */}
                                        <button
                                            type="button"
                                            className="flex-1 flex items-center gap-4 text-left"
                                            onClick={() => trip.has_commission && toggleTripExpand(trip.trip_id)}
                                            disabled={!trip.has_commission}
                                        >
                                            {/* Status indicator */}
                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                                                trip.has_commission
                                                    ? 'bg-green-50 dark:bg-green-900/30'
                                                    : noCrew
                                                    ? 'bg-slate-100 dark:bg-slate-800'
                                                    : 'bg-orange-50 dark:bg-orange-900/30'
                                            }`}>
                                                {trip.has_commission ? (
                                                    <CheckCircle2 className="text-green-600 dark:text-green-400" size={20} />
                                                ) : noCrew ? (
                                                    <User className="text-slate-400" size={20} />
                                                ) : (
                                                    <Clock className="text-orange-600 dark:text-orange-400" size={20} />
                                                )}
                                            </div>

                                            {/* Trip Info */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="font-black text-slate-900 dark:text-white">{trip.trip_number}</span>
                                                    <Badge variant={trip.has_commission ? 'success' : noCrew ? 'default' : 'warning'}>
                                                        {trip.has_commission ? 'คำนวณแล้ว' : noCrew ? 'ไม่มีพนักงาน' : 'ยังไม่คำนวณ'}
                                                    </Badge>
                                                </div>
                                                <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mt-1">
                                                    <span className="flex items-center gap-1">
                                                        <Calendar size={12} /> {formatDate(trip.planned_date)}
                                                    </span>
                                                    <span className="flex items-center gap-1">
                                                        <Truck size={12} /> {trip.vehicle_plate}
                                                    </span>
                                                    <span>{trip.vehicle_type}</span>
                                                </div>
                                            </div>

                                            {/* Commission amount or pending */}
                                            <div className="text-right flex-shrink-0">
                                                {trip.has_commission ? (
                                                    <p className="text-xl font-black text-emerald-600 dark:text-emerald-400">
                                                        {formatCurrency(trip.total_commission)}
                                                    </p>
                                                ) : (
                                                    <p className="text-sm text-slate-400 dark:text-slate-500">-</p>
                                                )}
                                            </div>

                                            {/* Expand icon */}
                                            {trip.has_commission && (
                                                <div className="flex-shrink-0">
                                                    {isExpanded ? (
                                                        <ChevronUp size={18} className="text-slate-400" />
                                                    ) : (
                                                        <ChevronDown size={18} className="text-slate-400" />
                                                    )}
                                                </div>
                                            )}
                                        </button>

                                        {/* Calculate / Recalculate button */}
                                        {!noCrew && (
                                            <Button
                                                size="sm"
                                                onClick={() => handleSingleCalculate(trip.trip_id, trip.has_commission)}
                                                disabled={batchLoading}
                                                variant={trip.has_commission ? 'outline' : 'primary'}
                                                className={`flex-shrink-0 rounded-lg flex items-center gap-1.5 px-4 ${
                                                    trip.has_commission
                                                        ? 'border-blue-200 text-blue-700 hover:bg-blue-50 dark:border-blue-700 dark:text-blue-300 dark:hover:bg-blue-900/20'
                                                        : 'bg-blue-600 hover:bg-blue-700 text-white'
                                                }`}
                                            >
                                                <Calculator size={14} />
                                                {trip.has_commission ? 'คำนวณใหม่' : 'คำนวณ'}
                                            </Button>
                                        )}
                                    </div>

                                    {/* Expanded Crew Breakdown */}
                                    {isExpanded && trip.has_commission && trip.crew_breakdown.length > 0 && (
                                        <div className="border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/30 p-4">
                                            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
                                                การแบ่งค่าคอมมิชชั่น ({trip.crew_breakdown.length} คน)
                                            </p>
                                            <div className="space-y-2">
                                                {trip.crew_breakdown.map((crew, idx) => (
                                                    <div
                                                        key={`${crew.staff_id}-${idx}`}
                                                        className="flex items-center gap-3 p-3 bg-white dark:bg-slate-900/50 rounded-lg border border-slate-100 dark:border-slate-700"
                                                    >
                                                        <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold text-sm flex-shrink-0">
                                                            {crew.staff_name.charAt(0)}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="font-bold text-slate-900 dark:text-white text-sm">{crew.staff_name}</p>
                                                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                                                {formatNumber(crew.total_items)} ชิ้น x {formatCurrency(crew.rate_applied)} x {crew.work_percentage.toFixed(1)}%
                                                            </p>
                                                        </div>
                                                        <p className="font-black text-emerald-600 dark:text-emerald-400">
                                                            {formatCurrency(crew.actual_commission)}
                                                        </p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </Card>
                            );
                        })
                    )}
                </div>
            )}
        </PageLayout>
    );
};
