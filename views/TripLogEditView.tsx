// Trip Log Edit View - Edit trip details after check-in
import React, { useState, useEffect } from 'react';
import {
    ArrowLeft,
    Save,
    AlertCircle,
    CheckCircle,
    Truck,
    Gauge,
    MapPin,
    Route as RouteIcon,
    FileText,
    Clock
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card } from '../components/ui/Card';
import { PageLayout } from '../components/layout/PageLayout';
import { tripLogService } from '../services/tripLogService';
import { useFeatureAccess } from '../hooks/useFeatureAccess';

interface TripLogEditViewProps {
    tripId: string;
    onSave?: () => void;
    onCancel?: () => void;
}

export const TripLogEditView: React.FC<TripLogEditViewProps> = ({
    tripId,
    onSave,
    onCancel,
}) => {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const [tripData, setTripData] = useState<any>(null);

    const { can, loading: featureAccessLoading } = useFeatureAccess();
    const canEditTripLogs = can('tab.triplogs', 'edit');
    const canManageTripLogs = can('tab.triplogs', 'manage');

    const [formData, setFormData] = useState({
        destination: '',
        route: '',
        notes: '',
        odometer_start: '',
        odometer_end: '',
        edit_reason: '', // Required - reason for editing
    });

    useEffect(() => {
        const loadTripData = async () => {
            try {
                setLoading(true);
                const data = await tripLogService.getById(tripId);
                if (data) {
                    setTripData(data);
                    setFormData({
                        destination: data.destination || '',
                        route: data.route || '',
                        notes: data.notes || '',
                        odometer_start: data.odometer_start?.toString() || '',
                        odometer_end: data.odometer_end?.toString() || '',
                        edit_reason: '', // Always start with empty edit reason
                    });
                } else {
                    setError('ไม่พบข้อมูลการเดินทาง');
                }
            } catch (err) {
                console.error('Error loading trip:', err);
                setError('เกิดข้อผิดพลาดในการโหลดข้อมูล');
            } finally {
                setLoading(false);
            }
        };

        loadTripData();
    }, [tripId]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSuccess(false);

        if (!canEditTripLogs) {
            setError('คุณไม่มีสิทธิ์แก้ไขข้อมูลการเดินทาง');
            return;
        }

        if (!formData.destination.trim()) {
            setError('กรุณากรอกปลายทาง');
            return;
        }

        if (!formData.edit_reason.trim()) {
            setError('กรุณาระบุเหตุผลในการแก้ไขข้อมูลทริป');
            return;
        }

        setSaving(true);
        try {
            const updates: any = {
                destination: formData.destination,
                route: formData.route,
                notes: formData.notes,
                edit_reason: formData.edit_reason,
            };

            // Include odometer values if admin
            // IMPORTANT: Must send both odometer_start AND odometer_end together to satisfy check_distance_method constraint
            if (canManageTripLogs) {
                const odometerStart = formData.odometer_start ? parseInt(formData.odometer_start) : null;
                const odometerEnd = formData.odometer_end ? parseInt(formData.odometer_end) : null;

                // Only include if both values are present (to satisfy constraint)
                if (odometerStart !== null && odometerEnd !== null) {
                    updates.odometer_start = odometerStart;
                    updates.odometer_end = odometerEnd;
                }
            }

            await tripLogService.updateTripLog(tripId, updates);
            setSuccess(true);
            if (onSave) {
                setTimeout(onSave, 1500);
            }
        } catch (err: any) {
            setError(err.message || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล');
        } finally {
            setSaving(false);
        }
    };

    if (loading || featureAccessLoading) {
        return (
            <PageLayout
                title="แก้ไขประวัติการเดินทาง"
                subtitle="กำลังโหลดข้อมูล..."
                loading={true}
            />
        );
    }

    if (!canEditTripLogs) {
        return (
            <PageLayout
                title="สิทธิ์ไม่เพียงพอ"
                subtitle="คุณไม่มีสิทธิ์เข้าใช้งานหน้านี้"
            >
                <Card className="p-6">
                    <p className="text-slate-600 dark:text-slate-400">คุณไม่มีสิทธิ์แก้ไขข้อมูลการเดินทาง</p>
                </Card>
            </PageLayout>
        );
    }

    return (
        <PageLayout
            title="แก้ไขประวัติการเดินทาง"
            subtitle={`ทะเบียนรถ: ${tripData?.vehicle?.plate || tripData?.vehicle_id}`}
            actions={
                onCancel && (
                    <Button
                        variant="outline"
                        onClick={onCancel}
                        className="flex items-center gap-2"
                    >
                        <ArrowLeft size={18} />
                        ยกเลิก
                    </Button>
                )
            }
        >
            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Success Message */}
                {success && (
                    <Card className="p-4 bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800">
                        <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-200">
                            <CheckCircle size={20} />
                            <span className="font-medium">บันทึกการแก้ไขสำเร็จ</span>
                        </div>
                    </Card>
                )}

                {/* Error Message */}
                {error && (
                    <Card className="p-4 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800">
                        <div className="flex items-center gap-2 text-red-800 dark:text-red-200">
                            <AlertCircle size={20} />
                            <span>{error}</span>
                        </div>
                    </Card>
                )}

                {/* Trip Summary (Read-only) */}
                <Card className="p-6 bg-slate-50 dark:bg-slate-800/50 border-dashed">
                    <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4">
                        ข้อมูลที่แก้ไขไม่ได้ (Read-only)
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <div className="space-y-1">
                            <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                                <Truck size={14} />
                                รถ
                            </div>
                            <div className="font-medium text-slate-900 dark:text-white">
                                {tripData?.vehicle?.plate} {tripData?.vehicle?.make} {tripData?.vehicle?.model}
                            </div>
                        </div>

                        <div className="space-y-1">
                            <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                                <Gauge size={14} />
                                เลขไมล์ออก / กลับ
                            </div>
                            <div className="font-medium text-slate-900 dark:text-white">
                                {tripData?.odometer_start?.toLocaleString()} - {tripData?.odometer_end?.toLocaleString()} km
                            </div>
                        </div>

                        <div className="space-y-1">
                            <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                                <Clock size={14} />
                                เวลาออก / กลับ
                            </div>
                            <div className="font-medium text-slate-900 dark:text-white text-xs">
                                {new Date(tripData?.checkout_time).toLocaleString('th-TH')} - <br />
                                {new Date(tripData?.checkin_time).toLocaleString('th-TH')}
                            </div>
                        </div>
                    </div>
                </Card>

                {/* Editable Information */}
                <Card className="p-6">
                    <div className="space-y-4">
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                            ข้อมูลที่แก้ไขได้
                        </h3>

                        {/* Admin-only Odometer Fields */}
                        {canManageTripLogs && (
                            <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg space-y-4">
                                <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200 text-sm font-medium">
                                    <AlertCircle size={16} />
                                    <span>เฉพาะ Admin: แก้ไขเลขไมล์ได้</span>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <Input
                                        label={
                                            <span className="flex items-center gap-2">
                                                <Gauge size={18} />
                                                เลขไมล์ออก (km)
                                            </span>
                                        }
                                        type="number"
                                        value={formData.odometer_start}
                                        onChange={(e) => setFormData({ ...formData, odometer_start: e.target.value })}
                                        placeholder="กรอกเลขไมล์ออก"
                                    />
                                    <Input
                                        label={
                                            <span className="flex items-center gap-2">
                                                <Gauge size={18} />
                                                เลขไมล์กลับ (km)
                                            </span>
                                        }
                                        type="number"
                                        value={formData.odometer_end}
                                        onChange={(e) => setFormData({ ...formData, odometer_end: e.target.value })}
                                        placeholder="กรอกเลขไมล์กลับ"
                                    />
                                </div>
                            </div>
                        )}

                        <Input
                            label={
                                <span className="flex items-center gap-2">
                                    <MapPin size={18} />
                                    ปลายทาง
                                </span>
                            }
                            value={formData.destination}
                            onChange={(e) => setFormData({ ...formData, destination: e.target.value })}
                            placeholder="กรอกปลายทาง"
                            required
                        />

                        <Input
                            label={
                                <span className="flex items-center gap-2">
                                    <RouteIcon size={18} />
                                    เส้นทาง (ไม่บังคับ)
                                </span>
                            }
                            value={formData.route}
                            onChange={(e) => setFormData({ ...formData, route: e.target.value })}
                            placeholder="กรอกเส้นทาง"
                        />

                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                <FileText className="inline mr-2" size={18} />
                                หมายเหตุ (ไม่บังคับ)
                            </label>
                            <textarea
                                value={formData.notes}
                                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                placeholder="กรอกหมายเหตุ"
                                rows={4}
                                className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-enterprise-500 focus:border-transparent resize-none"
                            />
                        </div>
                    </div>
                </Card>

                {/* Edit Reason - Required */}
                <Card className="p-6 bg-amber-50 dark:bg-amber-900/20 border-2 border-amber-300 dark:border-amber-700">
                    <h3 className="text-lg font-semibold text-amber-800 dark:text-amber-200 mb-4 flex items-center gap-2">
                        <AlertCircle size={20} />
                        เหตุผลในการแก้ไข (บังคับ)
                    </h3>
                    <p className="text-sm text-amber-700 dark:text-amber-300 mb-3">
                        กรุณาระบุเหตุผลในการแก้ไขข้อมูลทริป เพื่อบันทึกประวัติการแก้ไข
                    </p>
                    <textarea
                        value={formData.edit_reason}
                        onChange={(e) => setFormData({ ...formData, edit_reason: e.target.value })}
                        placeholder="เช่น แก้ไขปลายทาง, แก้ไขเลขไมล์ผิด, เพิ่มหมายเหตุ, เป็นต้น"
                        rows={3}
                        required
                        className="w-full px-4 py-2 border-2 border-amber-300 dark:border-amber-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-amber-500 focus:border-transparent resize-none"
                    />
                </Card>

                {/* Action Buttons */}
                <div className="flex gap-4">
                    <Button
                        type="submit"
                        disabled={saving}
                        className="flex-1 flex items-center justify-center gap-2"
                    >
                        {saving ? (
                            <>
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                กำลังบันทึก...
                            </>
                        ) : (
                            <>
                                <Save size={18} />
                                บันทึกการแก้ไข
                            </>
                        )}
                    </Button>
                    {onCancel && (
                        <Button
                            type="button"
                            variant="outline"
                            onClick={onCancel}
                            disabled={saving}
                        >
                            ยกเลิก
                        </Button>
                    )}
                </div>
            </form>
        </PageLayout>
    );
};
