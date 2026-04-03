// Fuel Log Edit View - Edit fuel record after saving
import React, { useState, useEffect } from 'react';
import {
    ArrowLeft,
    Save,
    AlertCircle,
    CheckCircle,
    Truck,
    Gauge,
    Droplet,
    DollarSign,
    MapPin,
    FileText,
    Upload,
    X
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card } from '../components/ui/Card';
import { PageLayout } from '../components/layout/PageLayout';
import { fuelService } from '../services/fuelService';
import { useFeatureAccess } from '../hooks/useFeatureAccess';

interface FuelLogEditViewProps {
    fuelRecordId: string;
    onSave?: () => void;
    onCancel?: () => void;
}

const FUEL_TYPES = [
    { value: 'diesel', label: 'ดีเซล' },
    { value: 'gasoline_91', label: 'เบนซิน 91' },
    { value: 'gasoline_95', label: 'เบนซิน 95' },
    { value: 'gasohol_91', label: 'แก๊สโซฮอล์ 91' },
    { value: 'gasohol_95', label: 'แก๊สโซฮอล์ 95' },
    { value: 'e20', label: 'E20' },
    { value: 'e85', label: 'E85' },
];

export const FuelLogEditView: React.FC<FuelLogEditViewProps> = ({
    fuelRecordId,
    onSave,
    onCancel,
}) => {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const [fuelRecord, setFuelRecord] = useState<any>(null);

    const { can, loading: featureAccessLoading } = useFeatureAccess();
    const canEditFuelLogs = can('tab.fuellogs', 'edit');
    const canManageFuelLogs = can('tab.fuellogs', 'manage');

    const [formData, setFormData] = useState({
        fuel_type: 'diesel',
        liters: '',
        price_per_liter: '',
        fuel_station: '',
        fuel_station_location: '',
        receipt_number: '',
        notes: '',
        is_full_tank: false,
        odometer: '',
    });

    const [receiptImage, setReceiptImage] = useState<File | null>(null);
    const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
    const [calculatedTotal, setCalculatedTotal] = useState<number>(0);

    useEffect(() => {
        const loadFuelRecord = async () => {
            try {
                setLoading(true);
                const data = await fuelService.getById(fuelRecordId);
                if (data) {
                    setFuelRecord(data);
                    setFormData({
                        fuel_type: data.fuel_type || 'diesel',
                        liters: data.liters?.toString() || '',
                        price_per_liter: data.price_per_liter?.toString() || '',
                        fuel_station: data.fuel_station || '',
                        fuel_station_location: data.fuel_station_location || '',
                        receipt_number: data.receipt_number || '',
                        notes: data.notes || '',
                        is_full_tank: data.is_full_tank || false,
                        odometer: data.odometer?.toString() || '',
                    });
                    setReceiptPreview(data.receipt_image_url);
                } else {
                    setError('ไม่พบข้อมูลการเติมน้ำมัน');
                }
            } catch (err) {
                console.error('Error loading fuel record:', err);
                setError('เกิดข้อผิดพลาดในการโหลดข้อมูล');
            } finally {
                setLoading(false);
            }
        };

        loadFuelRecord();
    }, [fuelRecordId]);

    // Calculate total cost
    useEffect(() => {
        const liters = parseFloat(formData.liters) || 0;
        const pricePerLiter = parseFloat(formData.price_per_liter) || 0;
        setCalculatedTotal(liters * pricePerLiter);
    }, [formData.liters, formData.price_per_liter]);

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setReceiptImage(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setReceiptPreview(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSuccess(false);

        if (!canEditFuelLogs) {
            setError('คุณไม่มีสิทธิ์แก้ไขข้อมูลการเติมน้ำมัน');
            return;
        }

        const liters = parseFloat(formData.liters);
        if (isNaN(liters) || liters <= 0) {
            setError('กรุณากรอกจำนวนลิตรที่ถูกต้อง');
            return;
        }

        const pricePerLiter = parseFloat(formData.price_per_liter);
        if (isNaN(pricePerLiter) || pricePerLiter <= 0) {
            setError('กรุณากรอกราคาต่อลิตรที่ถูกต้อง');
            return;
        }

        setSaving(true);
        try {
            let receiptImageUrl = fuelRecord.receipt_image_url;

            // Upload new receipt image if provided
            if (receiptImage && fuelRecord.vehicle_id) {
                receiptImageUrl = await fuelService.uploadReceipt(receiptImage, fuelRecord.vehicle_id);
            }

            const updates: any = {
                fuel_type: formData.fuel_type,
                liters: liters,
                price_per_liter: pricePerLiter,
                fuel_station: formData.fuel_station || null,
                fuel_station_location: formData.fuel_station_location || null,
                receipt_number: formData.receipt_number || null,
                receipt_image_url: receiptImageUrl,
                notes: formData.notes || null,
                is_full_tank: formData.is_full_tank,
            };

            // Include odometer if admin and value changed
            if (canManageFuelLogs && formData.odometer) {
                updates.odometer = parseInt(formData.odometer);
            }

            await fuelService.update(fuelRecordId, updates);

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
                title="แก้ไขข้อมูลการเติมน้ำมัน"
                subtitle="กำลังโหลดข้อมูล..."
                loading={true}
            >
                {null}
            </PageLayout>
        );
    }

    if (!canEditFuelLogs) {
        return (
            <PageLayout
                title="สิทธิ์ไม่เพียงพอ"
                subtitle="คุณไม่มีสิทธิ์เข้าใช้งานหน้านี้"
            >
                <Card className="p-6">
                    <p className="text-slate-600 dark:text-slate-400">คุณไม่มีสิทธิ์แก้ไขข้อมูลการเติมน้ำมัน</p>
                </Card>
            </PageLayout>
        );
    }

    return (
        <PageLayout
            title="แก้ไขข้อมูลการเติมน้ำมัน"
            subtitle={`ทะเบียนรถ: ${fuelRecord?.vehicle?.plate || fuelRecord?.vehicle_id}`}
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
            <form onSubmit={handleSubmit} className="space-y-6 pb-12">
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

                {/* Record Summary (Read-only) */}
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
                                {fuelRecord?.vehicle?.plate} {fuelRecord?.vehicle?.make} {fuelRecord?.vehicle?.model}
                            </div>
                        </div>

                        <div className="space-y-1">
                            <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                                <Gauge size={14} />
                                เลขไมล์
                            </div>
                            <div className="font-medium text-slate-900 dark:text-white">
                                {fuelRecord?.odometer?.toLocaleString()} km
                            </div>
                        </div>

                        <div className="space-y-1">
                            <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                                <FileText size={14} />
                                บันทึกเมื่อ
                            </div>
                            <div className="font-medium text-slate-900 dark:text-white">
                                {new Date(fuelRecord?.filled_at).toLocaleString('th-TH')}
                            </div>
                        </div>
                    </div>
                </Card>

                {/* Admin-only Odometer Field */}
                {canManageFuelLogs && (
                    <Card className="p-6 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                        <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200 text-sm font-medium mb-4">
                            <AlertCircle size={16} />
                            <span>เฉพาะ Admin: แก้ไขเลขไมล์ได้</span>
                        </div>
                        <Input
                            label={
                                <span className="flex items-center gap-2">
                                    <Gauge size={18} />
                                    เลขไมล์ (km)
                                </span>
                            }
                            type="number"
                            value={formData.odometer}
                            onChange={(e) => setFormData({ ...formData, odometer: e.target.value })}
                            placeholder="กรอกเลขไมล์"
                        />
                    </Card>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Card className="p-6">
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                            ข้อมูลน้ำมัน
                        </h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                    ประเภทน้ำมัน
                                </label>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                    {FUEL_TYPES.map((type) => (
                                        <button
                                            key={type.value}
                                            type="button"
                                            onClick={() => setFormData({ ...formData, fuel_type: type.value })}
                                            className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${formData.fuel_type === type.value
                                                ? 'bg-enterprise-500 text-white shadow-lg'
                                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                                                }`}
                                        >
                                            {type.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <Input
                                    label={
                                        <span className="flex items-center gap-2">
                                            <Droplet size={18} />
                                            จำนวนลิตร
                                        </span>
                                    }
                                    type="number"
                                    step="0.01"
                                    value={formData.liters}
                                    onChange={(e) => setFormData({ ...formData, liters: e.target.value })}
                                    placeholder="0.00"
                                    required
                                />
                                <Input
                                    label={
                                        <span className="flex items-center gap-2">
                                            <DollarSign size={18} />
                                            ราคาต่อลิตร
                                        </span>
                                    }
                                    type="number"
                                    step="0.001"
                                    value={formData.price_per_liter}
                                    onChange={(e) => setFormData({ ...formData, price_per_liter: e.target.value })}
                                    placeholder="0.000"
                                    required
                                />
                            </div>

                            <div className="p-4 bg-enterprise-50 dark:bg-enterprise-900/10 rounded-xl border border-enterprise-100 dark:border-enterprise-800/30">
                                <div className="flex justify-between items-center">
                                    <span className="text-slate-600 dark:text-slate-400 font-medium">ยอดรวมทั้งสิ้น:</span>
                                    <span className="text-2xl font-bold text-enterprise-600 dark:text-enterprise-400">
                                        ฿{calculatedTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </span>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    id="is_full_tank"
                                    checked={formData.is_full_tank}
                                    onChange={(e) => setFormData({ ...formData, is_full_tank: e.target.checked })}
                                    className="w-5 h-5 text-enterprise-500 border-slate-300 rounded focus:ring-enterprise-500"
                                />
                                <label htmlFor="is_full_tank" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                    เติมเต็มถัง
                                </label>
                            </div>
                        </div>
                    </Card>

                    <Card className="p-6">
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                            หลักฐานและรายละเอียด
                        </h3>
                        <div className="space-y-4">
                            <Input
                                label={
                                    <span className="flex items-center gap-2">
                                        <MapPin size={18} />
                                        สถานีบริการน้ำมัน
                                    </span>
                                }
                                value={formData.fuel_station}
                                onChange={(e) => setFormData({ ...formData, fuel_station: e.target.value })}
                                placeholder="ชื่อปั๊มน้ำมัน"
                            />

                            <Input
                                label={
                                    <span className="flex items-center gap-2">
                                        <FileText size={18} />
                                        เลขที่ใบเสร็จ
                                    </span>
                                }
                                value={formData.receipt_number}
                                onChange={(e) => setFormData({ ...formData, receipt_number: e.target.value })}
                                placeholder="เลขที่ใบกำกับภาษี/ใบเสร็จ"
                            />

                            {/* Receipt Image */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                    <Upload className="inline mr-2" size={18} />
                                    รูปภาพใบเสร็จ
                                </label>
                                {receiptPreview ? (
                                    <div className="relative rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700">
                                        <img
                                            src={receiptPreview}
                                            alt="Receipt preview"
                                            className="w-full h-48 object-cover"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setReceiptImage(null);
                                                setReceiptPreview(null);
                                            }}
                                            className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors shadow-lg"
                                        >
                                            <X size={16} />
                                        </button>
                                        <div className="absolute bottom-0 inset-x-0 p-2 bg-black/50 text-white text-xs text-center backdrop-blur-sm">
                                            คลิกปุ่มรูปกากบาทเพื่อเปลี่ยนรูปใหม่
                                        </div>
                                    </div>
                                ) : (
                                    <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all">
                                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                            <Upload className="w-10 h-10 text-slate-400 mb-2" />
                                            <p className="text-sm text-slate-500 dark:text-slate-400">คลิกเพื่ออัปโหลดใบเสร็จ</p>
                                            <p className="text-xs text-slate-400">PNG, JPG หรือ JPEG</p>
                                        </div>
                                        <input type="file" className="hidden" accept="image/*" onChange={handleImageChange} />
                                    </label>
                                )}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                    หมายเหตุ (ไม่บังคับ)
                                </label>
                                <textarea
                                    value={formData.notes}
                                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                    placeholder="กรอกหมายเหตุเพิ่มเติม"
                                    rows={2}
                                    className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-enterprise-500 focus:border-transparent resize-none"
                                />
                            </div>
                        </div>
                    </Card>
                </div>

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
