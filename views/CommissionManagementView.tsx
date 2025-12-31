// Commission Management View - View and calculate commissions
import React, { useState, useMemo, useEffect } from 'react';
import { DollarSign, Calculator, Download, Search, Calendar, Users, List, ArrowRight, CheckCircle2, AlertCircle, Loader2, X } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card } from '../components/ui/Card';
import { PageLayout } from '../components/layout/PageLayout';
import { useCommissionCalculation, useCommissionLogs, usePendingCommissionTrips } from '../hooks/useCrew';
import { useStaffCommissionSummary } from '../hooks/useReports';
import { supabase } from '../lib/supabase';
import { excelExport } from '../utils/excelExport';

type ActiveTab = 'calculate' | 'summary';

interface Notification {
    message: string;
    type: 'success' | 'error' | 'info';
}

export const CommissionManagementView: React.FC = () => {
    const [activeTab, setActiveTab] = useState<ActiveTab>('calculate');
    const [tripId, setTripId] = useState('');
    const [searchTripNumber, setSearchTripNumber] = useState('');
    const [notification, setNotification] = useState<Notification | null>(null);
    const { calculation, calculateAndSave, loading, error: calculationError } = useCommissionCalculation();
    const { logs, loading: loadingLogs, refresh: refreshLogs } = useCommissionLogs(tripId || null);
    const { trips: pendingTrips, loading: loadingPending, refresh: refreshPending } = usePendingCommissionTrips();

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

    // Summary Filters
    const now = new Date();
    const [startDate, setStartDate] = useState(new Date(now.getFullYear(), now.getMonth(), 1));
    const [endDate, setEndDate] = useState(new Date(now.getFullYear(), now.getMonth() + 1, 0));
    
    const { data: summaryData, loading: loadingSummary, error: summaryError } = useStaffCommissionSummary(startDate, endDate);

    // Search trip by trip number
    const handleSearchTrip = async (tripNum?: string) => {
        const targetNumber = (tripNum || searchTripNumber).trim();
        if (!targetNumber) {
            showNotify('กรุณาระบุเลขทริป', 'error');
            return;
        }

        try {
            const { data, error } = await supabase
                .from('delivery_trips')
                .select('id, trip_number, status')
                .eq('trip_number', targetNumber)
                .single();

            if (error || !data) {
                showNotify('ไม่พบทริปนี้ในระบบ', 'error');
                return;
            }

            if (data.status !== 'completed') {
                showNotify('ทริปนี้ยังไม่เสร็จสิ้น ไม่สามารถคำนวณค่าคอมมิชชั่นได้', 'info');
                return;
            }

            setTripId(data.id);
            setSearchTripNumber(data.trip_number);
        } catch (err) {
            console.error('[CommissionManagementView] Error searching trip:', err);
            showNotify('เกิดข้อผิดพลาดในการค้นหาข้อมูล', 'error');
        }
    };

    // Calculate commission
    const handleCalculate = async () => {
        if (!tripId) {
            showNotify('กรุณาเลือกทริปที่ต้องการคำนวณก่อน', 'error');
            return;
        }

        const logs = await calculateAndSave(tripId);
        if (logs) {
            showNotify('คำนวณและบันทึกค่าคอมมิชชั่นเรียบร้อยแล้ว', 'success');
            refreshLogs();
            refreshPending();
        }
    };

    // Bulk calculate for a trip from the list
    const handleBulkCalculate = async (id: string, tripNum: string) => {
        const result = await calculateAndSave(id);
        if (result) {
            showNotify(`คำนวณทริป ${tripNum} สำเร็จ`, 'success');
            refreshPending();
        } else {
            showNotify(`ทริป ${tripNum} คำนวณล้มเหลว ตรวจสอบข้อมูลพนักงานและสินค้า`, 'error');
        }
    };

    // Format currency
    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('th-TH', {
            style: 'currency',
            currency: 'THB',
        }).format(amount);
    };

    const handleExportExcel = () => {
        if (!summaryData || summaryData.length === 0) return;

        excelExport.exportToExcel(
            summaryData.map(s => ({
                staff_name: s.staff_name,
                totalTrips: s.totalTrips,
                totalActualCommission: s.totalActualCommission,
                averageCommissionPerTrip: s.averageCommissionPerTrip
            })),
            [
                { key: 'staff_name', label: 'ชื่อพนักงาน', width: 25 },
                { key: 'totalTrips', label: 'จำนวนทริป', width: 15, format: excelExport.formatNumber },
                { key: 'totalActualCommission', label: 'ยอดค่าคอมรวม (฿)', width: 20, format: excelExport.formatCurrency },
                { key: 'averageCommissionPerTrip', label: 'เฉลี่ย/ทริป (฿)', width: 15, format: excelExport.formatCurrency }
            ],
            `สรุปค่าคอมมิชชั่น_${startDate.toISOString().split('T')[0]}_ถึง_${endDate.toISOString().split('T')[0]}`
        );
        showNotify('ส่งออกไฟล์ Excel สำเร็จ', 'success');
    };

    return (
        <PageLayout
            title="จัดการค่าคอมมิชชั่น"
            subtitle="คำนวณและตรวจสอบรายได้ของพนักงานในแต่ละทริป"
        >
            {/* Notification UI */}
            {notification && (
                <div className={`fixed top-20 right-4 z-50 p-4 rounded-lg shadow-lg flex items-center gap-3 animate-in fade-in slide-in-from-right-4 duration-300 ${
                    notification.type === 'success' ? 'bg-green-600 text-white' : 
                    notification.type === 'error' ? 'bg-red-600 text-white' : 
                    'bg-blue-600 text-white'
                }`}>
                    {notification.type === 'success' && <CheckCircle2 size={20} />}
                    {notification.type === 'error' && <AlertCircle size={20} />}
                    {notification.type === 'info' && <Search size={20} />}
                    <span className="font-medium">{notification.message}</span>
                    <button onClick={() => setNotification(null)} className="ml-2 hover:opacity-80">
                        <X size={16} />
                    </button>
                </div>
            )}

            {/* Tabs */}
            <div className="flex bg-slate-100 p-1 rounded-xl mb-8 w-fit">
                <button
                    className={`px-6 py-2 rounded-lg font-semibold text-sm transition-all duration-200 ${
                        activeTab === 'calculate'
                            ? 'bg-white text-blue-600 shadow-sm'
                            : 'text-slate-500 hover:text-slate-700'
                    }`}
                    onClick={() => setActiveTab('calculate')}
                >
                    <div className="flex items-center gap-2">
                        <Calculator size={18} />
                        คำนวณค่าคอมมิชชั่น
                    </div>
                </button>
                <button
                    className={`px-6 py-2 rounded-lg font-semibold text-sm transition-all duration-200 ${
                        activeTab === 'summary'
                            ? 'bg-white text-blue-600 shadow-sm'
                            : 'text-slate-500 hover:text-slate-700'
                    }`}
                    onClick={() => setActiveTab('summary')}
                >
                    <div className="flex items-center gap-2">
                        <Users size={18} />
                        สรุปรายพนักงาน
                    </div>
                </button>
            </div>

            {activeTab === 'calculate' ? (
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                    {/* Left side: Search & Results */}
                    <div className="lg:col-span-3 space-y-8">
                        {/* Search Section */}
                        <Card className="p-8 border-none shadow-md bg-white overflow-hidden relative">
                            <div className="absolute top-0 left-0 w-2 h-full bg-blue-500"></div>
                            <h3 className="text-xl font-bold mb-6 flex items-center gap-3 text-slate-800">
                                <Search className="text-blue-500" size={24} />
                                ค้นหาทริปที่ต้องการคำนวณ
                            </h3>

                            <div className="flex flex-col sm:flex-row gap-3">
                                <div className="relative flex-1">
                                    <Input
                                        type="text"
                                        placeholder="ระบุเลขทริป เช่น DT-2512-0001"
                                        value={searchTripNumber}
                                        onChange={(e) => setSearchTripNumber(e.target.value)}
                                        onKeyPress={(e) => e.key === 'Enter' && handleSearchTrip()}
                                        className="pl-10 h-12 text-lg border-slate-200 focus:border-blue-500 focus:ring-blue-500 rounded-xl"
                                    />
                                    <Search className="absolute left-3 top-3.5 text-slate-400" size={20} />
                                </div>
                                <Button 
                                    onClick={() => handleSearchTrip()} 
                                    className="h-12 px-8 text-lg font-bold rounded-xl bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all"
                                >
                                    ค้นหาข้อมูล
                                </Button>
                            </div>
                        </Card>

                        {/* Calculate Section */}
                        {tripId ? (
                            <Card className="p-8 border-none shadow-md bg-white animate-in fade-in slide-in-from-bottom-4 duration-500">
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 border-b border-slate-100 pb-6">
                                    <div>
                                        <h3 className="text-2xl font-black text-slate-800 flex items-center gap-3">
                                            <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
                                                <Calculator size={24} />
                                            </div>
                                            ทริปเลขที่: <span className="text-blue-600">{searchTripNumber}</span>
                                        </h3>
                                        <p className="text-slate-500 mt-1">ตรวจสอบข้อมูลความถูกต้องก่อนทำการบันทึกค่าคอมมิชชั่น</p>
                                    </div>
                                    <Button
                                        onClick={handleCalculate}
                                        disabled={loading}
                                        className="h-14 px-8 text-lg font-black rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 shadow-xl shadow-blue-200 transition-all flex items-center gap-3"
                                    >
                                        {loading ? <Loader2 className="animate-spin" size={20} /> : <CheckCircle2 size={24} />}
                                        {loading ? 'กำลังประมวลผล...' : 'ยืนยันและบันทึกค่าคอมฯ'}
                                    </Button>
                                </div>

                                {calculationError && (
                                    <div className="mb-8 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-start gap-3">
                                        <AlertCircle className="text-red-500 mt-0.5" size={20} />
                                        <div>
                                            <p className="font-bold text-red-800">เกิดข้อผิดพลาดในการคำนวณ</p>
                                            <p className="text-sm text-red-600">{calculationError.message}</p>
                                        </div>
                                    </div>
                                )}

                                {calculation && (
                                    <div className="space-y-8">
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                            <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 group hover:bg-white hover:shadow-md transition-all">
                                                <p className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-2">ประเภทรถ</p>
                                                <p className="text-2xl font-black text-slate-800">{calculation.vehicleType || '-'}</p>
                                            </div>
                                            <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 group hover:bg-white hover:shadow-md transition-all">
                                                <p className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-2">จำนวนสินค้า</p>
                                                <p className="text-2xl font-black text-slate-800">{calculation.totalItemsDelivered.toLocaleString()} <span className="text-sm font-normal text-slate-500 ml-1">ชิ้น</span></p>
                                            </div>
                                            <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 group hover:bg-white hover:shadow-md transition-all">
                                                <p className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-2">อัตราต่อชิ้น</p>
                                                <p className="text-2xl font-black text-blue-600">{formatCurrency(calculation.rateApplied)}</p>
                                            </div>
                                        </div>

                                        <div className="p-8 bg-gradient-to-br from-slate-900 to-blue-900 text-white rounded-3xl shadow-2xl relative overflow-hidden">
                                            <DollarSign className="absolute -right-8 -bottom-8 opacity-10" size={200} />
                                            <div className="relative z-10">
                                                <p className="text-lg font-bold opacity-80 mb-2">ยอดค่าคอมมิชชั่นรวมทั้งทริป</p>
                                                <p className="text-6xl font-black tracking-tighter">{formatCurrency(calculation.totalCommission)}</p>
                                            </div>
                                        </div>

                                        <div>
                                            <h4 className="text-xl font-bold mb-6 text-slate-800 flex items-center gap-2">
                                                <Users size={22} className="text-blue-500" />
                                                การแบ่งสัดส่วนพนักงาน
                                            </h4>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                {calculation.crewMembers.map((crew, index) => (
                                                    <div
                                                        key={index}
                                                        className="p-6 bg-white border border-slate-100 rounded-2xl shadow-sm hover:shadow-md hover:border-blue-100 transition-all flex items-center justify-between group"
                                                    >
                                                        <div className="flex items-center gap-4">
                                                            <div className={`p-3 rounded-xl ${crew.role === 'driver' ? 'bg-orange-50 text-orange-600' : 'bg-blue-50 text-blue-600'}`}>
                                                                <Users size={24} />
                                                            </div>
                                                            <div>
                                                                <p className="font-black text-slate-800 text-lg">{crew.staffName}</p>
                                                                <p className="text-sm font-bold text-slate-500 flex items-center gap-1">
                                                                    {crew.role === 'driver' ? 'คนขับรถ' : 'พนักงานบริการ'} 
                                                                    <span className="mx-1">•</span>
                                                                    <span className="text-blue-600">{crew.workPercentage.toFixed(1)}%</span>
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <div className="text-right">
                                                            <p className="text-2xl font-black text-green-600">
                                                                {formatCurrency(crew.commissionAmount)}
                                                            </p>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Logs for current trip */}
                                {logs.length > 0 && (
                                    <div className="mt-10 pt-8 border-t border-slate-100">
                                        <h4 className="font-bold text-lg mb-4 flex items-center gap-2 text-slate-700">
                                            <CheckCircle2 size={20} className="text-green-500" />
                                            ประวัติการบันทึกล่าสุด
                                        </h4>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                            {logs.map((log) => (
                                                <div key={log.id} className="text-sm flex justify-between items-center p-3 bg-slate-50 border border-slate-100 rounded-xl">
                                                    <span className="text-slate-600 font-medium">รหัส: {log.staff_id.substring(0, 8)}...</span>
                                                    <span className="font-bold text-green-700">{formatCurrency(log.actual_commission)}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </Card>
                        ) : (
                            <div className="py-20 text-center bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl">
                                <div className="p-4 bg-white rounded-full shadow-sm inline-block mb-4">
                                    <Search size={48} className="text-slate-300" />
                                </div>
                                <h3 className="text-xl font-bold text-slate-500">กรุณาเลือกทริปจากรายการด้านขวา หรือค้นหาเลขทริป</h3>
                                <p className="text-slate-400 mt-2">เพื่อเริ่มการตรวจสอบและคำนวณค่าคอมมิชชั่น</p>
                            </div>
                        )}
                    </div>

                    {/* Right side: Pending Trips */}
                    <div className="space-y-8">
                        <Card className="p-6 border-none shadow-xl bg-white sticky top-24">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-xl font-bold flex items-center gap-2 text-slate-800">
                                    <List className="text-blue-500" size={24} />
                                    ค้างคำนวณ
                                    {pendingTrips.length > 0 && (
                                        <span className="ml-1 bg-red-100 text-red-600 text-xs px-2 py-0.5 rounded-full font-black animate-pulse">
                                            {pendingTrips.length}
                                        </span>
                                    )}
                                </h3>
                                <button 
                                    onClick={refreshPending} 
                                    disabled={loadingPending}
                                    className="p-2 hover:bg-slate-50 rounded-lg text-slate-400 hover:text-blue-500 transition-colors"
                                >
                                    <Loader2 className={loadingPending ? 'animate-spin' : ''} size={20} />
                                </button>
                            </div>

                            <div className="max-h-[calc(100vh-350px)] overflow-y-auto pr-2 space-y-3 custom-scrollbar">
                                {loadingPending ? (
                                    <div className="space-y-3">
                                        {[1,2,3].map(i => <div key={i} className="h-20 bg-slate-50 animate-pulse rounded-xl"></div>)}
                                    </div>
                                ) : pendingTrips.length === 0 ? (
                                    <div className="text-center py-12 px-4 border-2 border-dashed border-slate-100 rounded-2xl">
                                        <CheckCircle2 className="mx-auto mb-3 text-slate-200" size={40} />
                                        <p className="text-slate-400 font-bold text-sm">ไม่มีทริปค้างคำนวณ</p>
                                        <p className="text-slate-300 text-xs mt-1">เก่งมาก! จัดการครบหมดแล้ว</p>
                                    </div>
                                ) : (
                                    pendingTrips.map((trip) => (
                                        <div
                                            key={trip.id}
                                            className={`p-4 border-2 transition-all cursor-pointer rounded-2xl group relative ${
                                                tripId === trip.id 
                                                    ? 'border-blue-500 bg-blue-50' 
                                                    : 'border-slate-50 bg-slate-50 hover:border-blue-200 hover:bg-white hover:shadow-md'
                                            }`}
                                            onClick={() => handleSearchTrip(trip.trip_number)}
                                        >
                                            <div className="flex justify-between items-start mb-2">
                                                <span className={`font-black text-lg ${tripId === trip.id ? 'text-blue-700' : 'text-slate-800'}`}>
                                                    {trip.trip_number}
                                                </span>
                                                <span className="text-[10px] font-black uppercase text-slate-400 bg-white px-2 py-0.5 rounded-full shadow-sm border border-slate-100">
                                                    {new Date(trip.planned_date).toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit' })}
                                                </span>
                                            </div>
                                            <div className="flex justify-between items-center mt-3">
                                                <div className="flex items-center gap-1 text-slate-500 text-xs font-bold">
                                                    <div className="w-2 h-2 rounded-full bg-blue-400"></div>
                                                    {trip.vehicles?.plate || 'ไม่ระบุรถ'}
                                                </div>
                                                <button 
                                                    className={`p-1.5 rounded-lg transition-all ${
                                                        tripId === trip.id 
                                                            ? 'bg-blue-600 text-white' 
                                                            : 'bg-white text-blue-600 opacity-0 group-hover:opacity-100 shadow-sm border border-blue-100'
                                                    }`}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleBulkCalculate(trip.id, trip.trip_number);
                                                    }}
                                                    title="คำนวณทันที"
                                                >
                                                    <Calculator size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                            {pendingTrips.length > 0 && (
                                <p className="text-[10px] text-slate-400 mt-4 text-center font-bold">แสดงเฉพาะ 20 ทริปล่าสุด</p>
                            )}
                        </Card>
                    </div>
                </div>
            ) : (
                /* Summary Tab Content */
                <div className="space-y-8 animate-in fade-in duration-500">
                    <Card className="p-8 border-none shadow-xl bg-white">
                        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-10 pb-8 border-b border-slate-100">
                            <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-2xl">
                                <div>
                                    <label className="block text-sm font-black text-slate-700 mb-2 uppercase tracking-wider">ช่วงวันที่เริ่มต้น</label>
                                    <div className="relative">
                                        <Input
                                            type="date"
                                            value={startDate.toISOString().split('T')[0]}
                                            onChange={(e) => setStartDate(new Date(e.target.value))}
                                            className="h-12 pl-10 rounded-xl border-slate-200 focus:ring-blue-500"
                                        />
                                        <Calendar className="absolute left-3 top-3 text-slate-400" size={20} />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-black text-slate-700 mb-2 uppercase tracking-wider">วันที่สิ้นสุด</label>
                                    <div className="relative">
                                        <Input
                                            type="date"
                                            value={endDate.toISOString().split('T')[0]}
                                            onChange={(e) => setEndDate(new Date(e.target.value))}
                                            className="h-12 pl-10 rounded-xl border-slate-200 focus:ring-blue-500"
                                        />
                                        <Calendar className="absolute left-3 top-3 text-slate-400" size={20} />
                                    </div>
                                </div>
                            </div>
                            <Button 
                                onClick={handleExportExcel}
                                disabled={loadingSummary || !summaryData?.length}
                                className="h-14 px-10 text-lg font-black rounded-2xl bg-slate-900 hover:bg-black text-white shadow-xl transition-all flex items-center gap-3"
                            >
                                <Download size={24} />
                                ส่งออกข้อมูล EXCEL
                            </Button>
                        </div>

                        {loadingSummary ? (
                            <div className="flex flex-col items-center justify-center py-24 space-y-4">
                                <Loader2 className="animate-spin text-blue-500" size={48} />
                                <p className="text-slate-500 font-bold">กำลังรวบรวมข้อมูลค่าคอมมิชชั่น...</p>
                            </div>
                        ) : summaryError ? (
                            <div className="text-center py-20 px-6 bg-red-50 rounded-3xl">
                                <AlertCircle className="mx-auto mb-4 text-red-500" size={48} />
                                <h4 className="text-xl font-black text-red-800">เกิดข้อผิดพลาดในการโหลดข้อมูล</h4>
                                <p className="text-red-600 mt-2">กรุณาลองใหม่อีกครั้ง หรือติดต่อผู้ดูแลระบบ</p>
                            </div>
                        ) : !summaryData || summaryData.length === 0 ? (
                            <div className="text-center py-24 px-6 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
                                <Calendar className="mx-auto mb-4 text-slate-300" size={60} />
                                <h4 className="text-xl font-bold text-slate-500">ไม่พบข้อมูลในช่วงที่เลือก</h4>
                                <p className="text-slate-400 mt-2">ลองเลือกช่วงวันที่ใหม่เพื่อให้ครอบคลุมทริปที่มีการคำนวณแล้ว</p>
                            </div>
                        ) : (
                            <div className="overflow-hidden rounded-2xl border border-slate-100">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-slate-900 text-white">
                                            <th className="px-8 py-5 font-black uppercase text-xs tracking-widest">ชื่อพนักงาน</th>
                                            <th className="px-8 py-5 font-black uppercase text-xs tracking-widest text-center">จำนวนทริป</th>
                                            <th className="px-8 py-5 font-black uppercase text-xs tracking-widest text-right">ยอดรวมค่าคอมฯ</th>
                                            <th className="px-8 py-5 font-black uppercase text-xs tracking-widest text-right">ค่าเฉลี่ยต่อทริป</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 bg-white">
                                        {summaryData.map((staff) => (
                                            <tr key={staff.staff_id} className="hover:bg-blue-50 transition-colors group">
                                                <td className="px-8 py-5">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center font-black text-slate-500 group-hover:bg-blue-600 group-hover:text-white transition-all">
                                                            {staff.staff_name.charAt(0)}
                                                        </div>
                                                        <span className="font-black text-slate-800 text-lg">{staff.staff_name}</span>
                                                    </div>
                                                </td>
                                                <td className="px-8 py-5 text-center">
                                                    <span className="inline-block px-3 py-1 bg-slate-100 rounded-full font-black text-slate-600">
                                                        {staff.totalTrips} ทริป
                                                    </span>
                                                </td>
                                                <td className="px-8 py-5 text-right font-black text-2xl text-green-600">
                                                    {formatCurrency(staff.totalActualCommission)}
                                                </td>
                                                <td className="px-8 py-5 text-right text-slate-500 font-bold">
                                                    {formatCurrency(staff.averageCommissionPerTrip)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot className="bg-slate-50 font-black border-t-2 border-slate-200">
                                        <tr>
                                            <td className="px-8 py-6 text-xl text-slate-800">สรุปยอดรวมทั้งสิ้น</td>
                                            <td className="px-8 py-6 text-center text-xl">
                                                {summaryData.reduce((sum, s) => sum + s.totalTrips, 0)} <span className="text-sm font-bold text-slate-400 uppercase">ทริป</span>
                                            </td>
                                            <td className="px-8 py-6 text-right text-3xl text-green-700">
                                                {formatCurrency(summaryData.reduce((sum, s) => sum + s.totalActualCommission, 0))}
                                            </td>
                                            <td className="px-8 py-6 text-right text-slate-500">
                                                {formatCurrency(
                                                    summaryData.reduce((sum, s) => sum + s.totalActualCommission, 0) / 
                                                    (summaryData.reduce((sum, s) => sum + s.totalTrips, 0) || 1)
                                                )}
                                            </td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        )}
                    </Card>
                </div>
            )}
        </PageLayout>
    );
};
