// Commission Management View - View and calculate commissions
import React, { useState } from 'react';
import { DollarSign, Calculator, Download, Search, Calendar } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card } from '../components/ui/Card';
import { PageLayout } from '../components/layout/PageLayout';
import { useCommissionCalculation, useCommissionLogs } from '../hooks/useCrew';
import { supabase } from '../lib/supabase';

export const CommissionManagementView: React.FC = () => {
    const [tripId, setTripId] = useState('');
    const [searchTripNumber, setSearchTripNumber] = useState('');
    const { calculation, calculateAndSave, loading, error } = useCommissionCalculation();
    const { logs, loading: loadingLogs, refresh: refreshLogs } = useCommissionLogs(tripId || null);

    // Search trip by trip number
    const handleSearchTrip = async () => {
        if (!searchTripNumber.trim()) {
            alert('กรุณาระบุเลขทริป');
            return;
        }

        try {
            const { data, error } = await supabase
                .from('delivery_trips')
                .select('id, trip_number, status')
                .eq('trip_number', searchTripNumber.trim())
                .single();

            if (error || !data) {
                alert('ไม่พบทริปนี้');
                return;
            }

            if (data.status !== 'completed') {
                alert('ทริปนี้ยังไม่เสร็จสิ้น ไม่สามารถคำนวณค่าคอมมิชชั่นได้');
                return;
            }

            setTripId(data.id);
        } catch (err) {
            console.error('[CommissionManagementView] Error searching trip:', err);
            alert('เกิดข้อผิดพลาดในการค้นหา');
        }
    };

    // Calculate commission
    const handleCalculate = async () => {
        if (!tripId) {
            alert('กรุณาค้นหาทริปก่อน');
            return;
        }

        const logs = await calculateAndSave(tripId);
        if (logs) {
            alert('คำนวณค่าคอมมิชชั่นเสร็จสิ้น!');
            refreshLogs();
        }
    };

    // Format currency
    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('th-TH', {
            style: 'currency',
            currency: 'THB',
        }).format(amount);
    };

    return (
        <PageLayout
            title="จัดการค่าคอมมิชชั่น"
            subtitle="คำนวณและดูค่าคอมมิชชั่นของพนักงาน"
        >
            {/* Search Section */}
            <Card className="p-6 mb-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Search size={20} />
                    ค้นหาทริป
                </h3>

                <div className="flex gap-2">
                    <Input
                        type="text"
                        placeholder="ระบุเลขทริป เช่น DT-2512-0001"
                        value={searchTripNumber}
                        onChange={(e) => setSearchTripNumber(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleSearchTrip()}
                        className="flex-1"
                    />
                    <Button onClick={handleSearchTrip}>
                        ค้นหา
                    </Button>
                </div>
            </Card>

            {/* Calculate Section */}
            {tripId && (
                <Card className="p-6 mb-6">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold flex items-center gap-2">
                            <Calculator size={20} />
                            คำนวณค่าคอมมิชชั่น
                        </h3>
                        <Button
                            onClick={handleCalculate}
                            disabled={loading}
                            className="flex items-center gap-2"
                        >
                            <Calculator size={16} />
                            {loading ? 'กำลังคำนวณ...' : 'คำนวณและบันทึก'}
                        </Button>
                    </div>

                    {error && (
                        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                            <p className="text-sm text-red-800">{error.message}</p>
                        </div>
                    )}

                    {calculation && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="p-4 bg-blue-50 rounded-lg">
                                    <p className="text-sm text-gray-600 mb-1">ประเภทรถ</p>
                                    <p className="text-lg font-semibold">{calculation.vehicleType || '-'}</p>
                                </div>
                                <div className="p-4 bg-green-50 rounded-lg">
                                    <p className="text-sm text-gray-600 mb-1">จำนวนสินค้าที่ส่ง</p>
                                    <p className="text-lg font-semibold">{calculation.totalItemsDelivered} ชิ้น</p>
                                </div>
                                <div className="p-4 bg-purple-50 rounded-lg">
                                    <p className="text-sm text-gray-600 mb-1">อัตราค่าคอมมิชชั่น</p>
                                    <p className="text-lg font-semibold">{formatCurrency(calculation.rateApplied)}/ชิ้น</p>
                                </div>
                            </div>

                            <div className="p-4 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg">
                                <p className="text-sm opacity-90 mb-1">ค่าคอมมิชชั่นรวม</p>
                                <p className="text-3xl font-bold">{formatCurrency(calculation.totalCommission)}</p>
                            </div>

                            <div>
                                <h4 className="font-semibold mb-3">การแบ่งค่าคอมมิชชั่น</h4>
                                <div className="space-y-2">
                                    {calculation.crewMembers.map((crew, index) => (
                                        <div
                                            key={index}
                                            className="p-4 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
                                        >
                                            <div className="flex items-center justify-between mb-2">
                                                <div>
                                                    <p className="font-medium">{crew.staffName}</p>
                                                    <p className="text-sm text-gray-600">
                                                        {crew.role === 'driver' ? 'คนขับ' : 'พนักงานบริการ'}
                                                    </p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-lg font-semibold text-green-600">
                                                        {formatCurrency(crew.commissionAmount)}
                                                    </p>
                                                    <p className="text-sm text-gray-600">
                                                        {crew.workPercentage.toFixed(2)}% ({crew.workDurationHours.toFixed(2)} ชม.)
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="w-full bg-gray-200 rounded-full h-2">
                                                <div
                                                    className="bg-green-500 h-2 rounded-full transition-all"
                                                    style={{ width: `${crew.workPercentage}%` }}
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </Card>
            )}

            {/* Commission Logs */}
            {tripId && (
                <Card className="p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold flex items-center gap-2">
                            <Calendar size={20} />
                            ประวัติการคำนวณ
                        </h3>
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={refreshLogs}
                            disabled={loadingLogs}
                        >
                            รีเฟรช
                        </Button>
                    </div>

                    {loadingLogs ? (
                        <div className="text-center py-8">
                            <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                            <p className="mt-2 text-sm text-gray-600">กำลังโหลด...</p>
                        </div>
                    ) : logs.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                            <DollarSign className="mx-auto mb-2 text-gray-400" size={32} />
                            <p>ยังไม่มีประวัติการคำนวณค่าคอมมิชชั่น</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {logs.map((log) => (
                                <div
                                    key={log.id}
                                    className="p-4 border border-gray-200 rounded-lg"
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <div>
                                            <p className="font-medium">Staff ID: {log.staff_id}</p>
                                            <p className="text-sm text-gray-600">
                                                คำนวณเมื่อ: {new Date(log.calculation_date).toLocaleString('th-TH')}
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-lg font-semibold text-green-600">
                                                {formatCurrency(log.actual_commission)}
                                            </p>
                                            <p className="text-sm text-gray-600">
                                                {log.work_percentage.toFixed(2)}%
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-sm text-gray-600">
                                        <p>สินค้าที่ส่ง: {log.total_items_delivered} ชิ้น</p>
                                        <p>อัตรา: {formatCurrency(log.rate_applied)}/ชิ้น</p>
                                        {log.notes && <p className="italic">หมายเหตุ: {log.notes}</p>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </Card>
            )}
        </PageLayout>
    );
};
