// Commission Rates Management View - Manage commission rate configurations
import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Edit2, Trash2, DollarSign, Truck, Calendar, AlertCircle, ListTree, X } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card } from '../components/ui/Card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../components/ui/Dialog';
import { PageLayout } from '../components/layout/PageLayout';
import { supabase } from '../lib/supabase';
import type { Database } from '../types/database';

type CommissionRate = Database['public']['Tables']['commission_rates']['Row'];

const SERVICE_TYPE_OPTIONS = [
    { value: 'standard', label: 'มาตรฐาน (standard)' },
    { value: 'carry_in', label: 'ลงมือ (carry_in)' },
    { value: 'lift_off', label: 'ตักลง (lift_off)' },
] as const;

type ServiceTypeKey = 'standard' | 'carry_in' | 'lift_off' | 'other';

const COMMISSION_RATE_SECTIONS: {
    key: ServiceTypeKey;
    title: string;
    description: string;
    accentClass: string;
    preselectService: string;
}[] = [
    {
        key: 'standard',
        title: 'มาตรฐาน',
        description: 'เรททั่วไป — แยกจากงานลงมือ/ตักลง',
        accentClass: 'border-slate-200 dark:border-slate-700',
        preselectService: 'standard',
    },
    {
        key: 'carry_in',
        title: 'ลงมือ (carry_in)',
        description: 'อัตราเฉพาะงานลงมือ — ดูรายการแยกจากตักลง แม้ชื่อเรทจะเหมือนกัน',
        accentClass: 'border-amber-200 dark:border-amber-900/50 bg-amber-50/40 dark:bg-amber-950/20',
        preselectService: 'carry_in',
    },
    {
        key: 'lift_off',
        title: 'ตักลง (lift_off)',
        description: 'อัตราเฉพาะงานตักลง — ดูรายการแยกจากลงมือ',
        accentClass: 'border-teal-200 dark:border-teal-900/50 bg-teal-50/40 dark:bg-teal-950/20',
        preselectService: 'lift_off',
    },
    {
        key: 'other',
        title: 'ประเภทบริการอื่น (legacy)',
        description: 'ค่า service_type ที่ไม่ตรงมาตรฐาน — ตรวจสอบและย้ายไปหมวดหลักถ้าเหมาะสม',
        accentClass: 'border-violet-200 dark:border-violet-900/50',
        preselectService: 'standard',
    },
];

function bucketServiceType(st: string | null): ServiceTypeKey {
    if (!st || st === 'standard') return 'standard';
    if (st === 'carry_in') return 'carry_in';
    if (st === 'lift_off') return 'lift_off';
    return 'other';
}

const COMMISSION_SECTION_ANCHOR_PREFIX = 'commission-rates-section';

function commissionSectionAnchorId(key: ServiceTypeKey) {
    return `${COMMISSION_SECTION_ANCHOR_PREFIX}-${key}`;
}

/** ป้ายสั้นในเมนูลัด (เลื่อนไปหมวด) */
const SECTION_QUICK_LABEL: Record<ServiceTypeKey, string> = {
    standard: 'มาตรฐาน',
    carry_in: 'ลงมือ',
    lift_off: 'ตักลง',
    other: 'อื่น (legacy)',
};

const SECTION_QUICK_BTN: Record<
    ServiceTypeKey,
    string
> = {
    standard:
        'border-slate-200 bg-slate-50/90 text-slate-800 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800/80 dark:text-slate-100 dark:hover:bg-slate-800',
    carry_in:
        'border-amber-300/90 bg-amber-50/90 text-amber-950 hover:bg-amber-100/90 dark:border-amber-700/80 dark:bg-amber-950/40 dark:text-amber-100 dark:hover:bg-amber-900/50',
    lift_off:
        'border-teal-300/90 bg-teal-50/90 text-teal-950 hover:bg-teal-100/90 dark:border-teal-700/80 dark:bg-teal-950/40 dark:text-teal-100 dark:hover:bg-teal-900/50',
    other:
        'border-violet-300/90 bg-violet-50/90 text-violet-950 hover:bg-violet-100/90 dark:border-violet-700/80 dark:bg-violet-950/40 dark:text-violet-100 dark:hover:bg-violet-900/50',
};

export const CommissionRatesView: React.FC = () => {
    const [rates, setRates] = useState<CommissionRate[]>([]);
    const [vehicleTypeOptions, setVehicleTypeOptions] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingRate, setEditingRate] = useState<CommissionRate | null>(null);
    const [formData, setFormData] = useState({
        rate_name: '',
        vehicle_type: '',
        service_type: 'standard',
        rate_per_unit: '',
        is_active: true,
        effective_from: new Date().toISOString().split('T')[0],
        effective_until: '',
        notes: '',
    });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Fetch rates
    const fetchRates = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('commission_rates')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setRates(data || []);
        } catch (err) {
            console.error('[CommissionRatesView] Error fetching rates:', err);
            setError(err instanceof Error ? err.message : 'Failed to load rates');
        } finally {
            setLoading(false);
        }
    };

    const fetchVehicleTypeOptions = async () => {
        try {
            const { data, error } = await supabase
                .from('vehicles')
                .select('type')
                .not('type', 'is', null);

            if (error) throw error;

            const typeMap = new Map<string, string>();
            (data || []).forEach((row: { type: string | null }) => {
                const raw = row.type;
                const trimmed = raw?.trim();
                if (!trimmed) return;
                const key = trimmed.toLowerCase();
                if (!typeMap.has(key)) {
                    typeMap.set(key, trimmed);
                }
            });

            const options = Array.from(typeMap.values()).sort((a, b) => a.localeCompare(b, 'th'));
            setVehicleTypeOptions(options);
        } catch (err) {
            console.error('[CommissionRatesView] Error fetching vehicle type options:', err);
            // Do not block the page if this fails; fallback to legacy value handling below.
            setVehicleTypeOptions([]);
        }
    };

    useEffect(() => {
        fetchRates();
        fetchVehicleTypeOptions();
    }, []);

    const vehicleTypeSelectOptions = useMemo(() => {
        const options = [...vehicleTypeOptions];
        const currentVehicleType = formData.vehicle_type.trim();
        if (currentVehicleType && !options.some((v) => v.toLowerCase() === currentVehicleType.toLowerCase())) {
            return [`${currentVehicleType} (ค่าที่บันทึกเดิม)`, ...options];
        }
        return options;
    }, [vehicleTypeOptions, formData.vehicle_type]);

    const ratesByServiceBucket = useMemo(() => {
        const buckets: Record<ServiceTypeKey, CommissionRate[]> = {
            standard: [],
            carry_in: [],
            lift_off: [],
            other: [],
        };
        for (const rate of rates) {
            buckets[bucketServiceType(rate.service_type)].push(rate);
        }
        return buckets;
    }, [rates]);

    const quickNavSectionKeys = useMemo(() => {
        return COMMISSION_RATE_SECTIONS.filter(
            (s) => s.key !== 'other' || ratesByServiceBucket.other.length > 0
        ).map((s) => s.key);
    }, [ratesByServiceBucket]);

    const scrollToRateSection = (key: ServiceTypeKey) => {
        const el = document.getElementById(commissionSectionAnchorId(key));
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    };

    const openAddFormForService = (serviceType: string) => {
        setEditingRate(null);
        setError(null);
        setFormData({
            rate_name: '',
            vehicle_type: '',
            service_type: serviceType,
            rate_per_unit: '',
            is_active: true,
            effective_from: new Date().toISOString().split('T')[0],
            effective_until: '',
            notes: '',
        });
        setShowForm(true);
    };

    // Handle form submit
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!formData.rate_name.trim()) {
            setError('กรุณาระบุชื่ออัตราค่าคอมมิชชั่น');
            return;
        }

        if (!formData.rate_per_unit || parseFloat(formData.rate_per_unit) <= 0) {
            setError('กรุณาระบุอัตราค่าคอมมิชชั่นที่ถูกต้อง');
            return;
        }

        try {
            setSaving(true);

            const rateData = {
                rate_name: formData.rate_name,
                vehicle_type: formData.vehicle_type || null,
                service_type: formData.service_type || null,
                rate_per_unit: parseFloat(formData.rate_per_unit),
                is_active: formData.is_active,
                effective_from: formData.effective_from,
                effective_until: formData.effective_until || null,
                notes: formData.notes || null,
                updated_at: new Date().toISOString(),
            };

            if (editingRate) {
                // Update
                const { error } = await supabase
                    .from('commission_rates')
                    .update(rateData)
                    .eq('id', editingRate.id);

                if (error) throw error;
            } else {
                // Create
                const { error } = await supabase
                    .from('commission_rates')
                    .insert(rateData);

                if (error) throw error;
            }

            // Reset form and refresh
            setFormData({
                rate_name: '',
                vehicle_type: '',
                service_type: 'standard',
                rate_per_unit: '',
                is_active: true,
                effective_from: new Date().toISOString().split('T')[0],
                effective_until: '',
                notes: '',
            });
            setEditingRate(null);
            setShowForm(false);
            fetchRates();
        } catch (err) {
            console.error('[CommissionRatesView] Error saving rate:', err);
            setError(err instanceof Error ? err.message : 'Failed to save rate');
        } finally {
            setSaving(false);
        }
    };

    // Handle edit
    const handleEdit = (rate: CommissionRate) => {
        setEditingRate(rate);
        setFormData({
            rate_name: rate.rate_name,
            vehicle_type: rate.vehicle_type || '',
            service_type: rate.service_type || 'standard',
            rate_per_unit: rate.rate_per_unit.toString(),
            is_active: rate.is_active,
            effective_from: rate.effective_from,
            effective_until: rate.effective_until || '',
            notes: rate.notes || '',
        });
        setShowForm(true);
        setError(null);
    };

    // Handle delete
    const handleDelete = async (id: string, name: string) => {
        if (!confirm(`ต้องการลบอัตราค่าคอมมิชชั่น "${name}" ใช่หรือไม่?`)) {
            return;
        }

        try {
            const { error } = await supabase
                .from('commission_rates')
                .delete()
                .eq('id', id);

            if (error) throw error;
            fetchRates();
        } catch (err) {
            console.error('[CommissionRatesView] Error deleting rate:', err);
            alert('ไม่สามารถลบอัตราค่าคอมมิชชั่นได้: ' + (err instanceof Error ? err.message : 'Unknown error'));
        }
    };

    // Cancel form
    const handleCancel = () => {
        setShowForm(false);
        setEditingRate(null);
        setFormData({
            rate_name: '',
            vehicle_type: '',
            service_type: 'standard',
            rate_per_unit: '',
            is_active: true,
            effective_from: new Date().toISOString().split('T')[0],
            effective_until: '',
            notes: '',
        });
        setError(null);
    };

    // Format currency
    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('th-TH', {
            style: 'currency',
            currency: 'THB',
        }).format(amount);
    };

    const renderRateCard = (rate: CommissionRate) => (
        <Card key={rate.id} className="p-4 hover:shadow-lg transition-shadow">
            <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                    <h3 className="font-semibold text-lg dark:text-white">{rate.rate_name}</h3>
                    <div className="mt-2 space-y-1">
                        {rate.vehicle_type && (
                            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                                <Truck size={14} />
                                <span>รถ: {rate.vehicle_type}</span>
                            </div>
                        )}
                        {rate.service_type && (
                            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                                <span className="text-xs">🎯</span>
                                <span>
                                    บริการ:{' '}
                                    {SERVICE_TYPE_OPTIONS.find((option) => option.value === rate.service_type)?.label || rate.service_type}
                                </span>
                            </div>
                        )}
                    </div>
                </div>
                <span
                    className={`px-2 py-1 rounded-full text-xs font-medium ${
                        rate.is_active
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                            : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-300'
                    }`}
                >
                    {rate.is_active ? 'ใช้งาน' : 'ไม่ใช้งาน'}
                </span>
            </div>

            <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">อัตราค่าคอมมิชชั่น</p>
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {formatCurrency(rate.rate_per_unit)}
                    <span className="text-sm font-normal text-gray-600 dark:text-gray-400">/ชิ้น</span>
                </p>
            </div>

            <div className="space-y-1 mb-4 text-sm text-gray-600 dark:text-gray-400">
                <div className="flex items-center gap-2">
                    <Calendar size={14} />
                    <span>เริ่ม: {new Date(rate.effective_from).toLocaleDateString('th-TH')}</span>
                </div>
                {rate.effective_until && (
                    <div className="flex items-center gap-2">
                        <Calendar size={14} />
                        <span>สิ้นสุด: {new Date(rate.effective_until).toLocaleDateString('th-TH')}</span>
                    </div>
                )}
                {rate.notes && <p className="text-xs text-gray-500 dark:text-gray-400 italic mt-2">{rate.notes}</p>}
            </div>

            <div className="flex gap-2 pt-3 border-t dark:border-slate-700">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEdit(rate)}
                    className="flex-1 flex items-center justify-center gap-1"
                >
                    <Edit2 size={16} />
                    แก้ไข
                </Button>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(rate.id, rate.rate_name)}
                    className="flex items-center justify-center gap-1 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                >
                    <Trash2 size={16} />
                    ลบ
                </Button>
            </div>
        </Card>
    );

    return (
        <PageLayout
            title="ตั้งค่าอัตราค่าคอมมิชชั่น"
            subtitle="แยกหมวด ลงมือ / ตักลง — สร้างอัตราใหม่จากปุ่มเพิ่ม (เปิดหน้าต่างแยก) อัตราที่บันทึกแล้วแสดงด้านล่าง"
        >
            {/* สร้างใหม่: ปุ่มเปิด dialog เท่านั้น — ไม่รวมฟอร์มในหน้าเดียวกับรายการ */}
            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <p className="max-w-2xl text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                    รายการด้านล่างคืออัตราที่บันทึกในระบบแล้ว กด <span className="font-medium text-slate-800 dark:text-slate-200">เพิ่มอัตราค่าคอมมิชชั่น</span> เพื่อเปิด
                    ฟอร์มในหน้าต่างย่อ — แยกจากรายการเพื่อไม่สับสน
                </p>
                <Button
                    onClick={() => openAddFormForService('standard')}
                    className="flex shrink-0 items-center gap-2 self-end sm:self-auto"
                >
                    <Plus size={20} />
                    เพิ่มอัตราค่าคอมมิชชั่น
                </Button>
            </div>

            <Dialog open={showForm}>
                <DialogContent
                    className="flex max-h-[min(92vh,56rem)] max-w-2xl flex-col gap-0 overflow-hidden p-0"
                    onInteractOutside={() => {
                        if (!saving) handleCancel();
                    }}
                    onEscapeKeyDown={(e) => {
                        if (saving) e.preventDefault();
                        else handleCancel();
                    }}
                >
                    <DialogHeader className="relative shrink-0 space-y-1 pr-12">
                        <DialogTitle>
                            {editingRate ? 'แก้ไขอัตราค่าคอมมิชชั่น' : 'เพิ่มอัตราค่าคอมมิชชั่นใหม่'}
                        </DialogTitle>
                        <DialogDescription>
                            กรอกข้อมูลแล้วกดบันทึก — รายการอัตราที่บันทึกแล้วจะอัปเดตบนหน้าหลักหลังปิดหน้าต่างนี้
                        </DialogDescription>
                        <button
                            type="button"
                            onClick={() => {
                                if (!saving) handleCancel();
                            }}
                            className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                            aria-label="ปิด"
                        >
                            <X size={20} />
                        </button>
                    </DialogHeader>

                    <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
                        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-1 pb-4">
                            {error && (
                                <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-900/20">
                                    <AlertCircle
                                        className="mt-0.5 flex-shrink-0 text-red-600 dark:text-red-400"
                                        size={20}
                                    />
                                    <p className="text-sm text-red-800 dark:text-red-300">{error}</p>
                                </div>
                            )}

                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                <div className="md:col-span-2">
                                    <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                                        ชื่ออัตราค่าคอมมิชชั่น <span className="text-red-500">*</span>
                                    </label>
                                    <Input
                                        type="text"
                                        value={formData.rate_name}
                                        onChange={(e) => setFormData({ ...formData, rate_name: e.target.value })}
                                        placeholder="เช่น รถ 4 ล้อ - มาตรฐาน"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                                        ประเภทรถ
                                    </label>
                                    <select
                                        value={formData.vehicle_type}
                                        onChange={(e) => setFormData({ ...formData, vehicle_type: e.target.value })}
                                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-transparent focus:ring-2 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-900 dark:text-white dark:focus:ring-blue-400"
                                    >
                                        <option value="">ทุกประเภทรถ</option>
                                        {vehicleTypeSelectOptions.map((vehicleType) => {
                                            const normalizedValue = vehicleType.replace(' (ค่าที่บันทึกเดิม)', '');
                                            return (
                                                <option key={vehicleType} value={normalizedValue}>
                                                    {vehicleType}
                                                </option>
                                            );
                                        })}
                                    </select>
                                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                        เลือกจากประเภทรถจริงในระบบ เพื่อลดการพิมพ์ไม่ตรงกัน
                                    </p>
                                </div>

                                <div>
                                    <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                                        ประเภทบริการ
                                    </label>
                                    <select
                                        value={formData.service_type}
                                        onChange={(e) => setFormData({ ...formData, service_type: e.target.value })}
                                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-transparent focus:ring-2 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-900 dark:text-white dark:focus:ring-blue-400"
                                    >
                                        {SERVICE_TYPE_OPTIONS.map((option) => (
                                            <option key={option.value} value={option.value}>
                                                {option.label}
                                            </option>
                                        ))}
                                    </select>
                                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                        เลือกประเภทให้ตรงกับทริปที่สร้าง (ลงมือ/ตักลง)
                                    </p>
                                </div>

                                <div>
                                    <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                                        อัตราค่าคอมมิชชั่น (บาท/ชิ้น) <span className="text-red-500">*</span>
                                    </label>
                                    <Input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={formData.rate_per_unit}
                                        onChange={(e) => setFormData({ ...formData, rate_per_unit: e.target.value })}
                                        placeholder="เช่น 15.00"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">สถานะ</label>
                                    <select
                                        value={formData.is_active ? 'true' : 'false'}
                                        onChange={(e) =>
                                            setFormData({ ...formData, is_active: e.target.value === 'true' })
                                        }
                                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-transparent focus:ring-2 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-900 dark:text-white dark:focus:ring-blue-400"
                                    >
                                        <option value="true">ใช้งาน</option>
                                        <option value="false">ไม่ใช้งาน</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                                        เริ่มใช้งานตั้งแต่ <span className="text-red-500">*</span>
                                    </label>
                                    <Input
                                        type="date"
                                        value={formData.effective_from}
                                        onChange={(e) => setFormData({ ...formData, effective_from: e.target.value })}
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                                        สิ้นสุดการใช้งาน
                                    </label>
                                    <Input
                                        type="date"
                                        value={formData.effective_until}
                                        onChange={(e) => setFormData({ ...formData, effective_until: e.target.value })}
                                        placeholder="เว้นว่างถ้าไม่มีวันสิ้นสุด"
                                    />
                                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">เว้นว่างถ้าไม่มีวันสิ้นสุด</p>
                                </div>

                                <div className="md:col-span-2">
                                    <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                                        หมายเหตุ
                                    </label>
                                    <textarea
                                        value={formData.notes}
                                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                        placeholder="หมายเหตุเพิ่มเติม..."
                                        rows={3}
                                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 placeholder-gray-400 focus:border-transparent focus:ring-2 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-900 dark:text-white dark:placeholder-gray-500 dark:focus:ring-blue-400"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-slate-200 bg-slate-50/90 px-6 py-4 dark:border-slate-700 dark:bg-slate-900/80">
                            <Button type="button" variant="outline" onClick={handleCancel} disabled={saving}>
                                ยกเลิก
                            </Button>
                            <Button type="submit" disabled={saving}>
                                {saving ? 'กำลังบันทึก...' : editingRate ? 'บันทึกการแก้ไข' : 'เพิ่มอัตราค่าคอมมิชชั่น'}
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>

            {!loading && rates.length > 0 && (
                <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    อัตราที่บันทึกแล้ว
                </h2>
            )}

            {/* Rates List */}
            {loading ? (
                <div className="text-center py-12">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    <p className="mt-2 text-gray-600 dark:text-gray-400">กำลังโหลด...</p>
                </div>
            ) : rates.length === 0 ? (
                <Card className="p-12 text-center">
                    <DollarSign className="mx-auto text-gray-400 dark:text-gray-500 mb-4" size={48} />
                    <p className="text-gray-600 dark:text-gray-400">ยังไม่มีอัตราค่าคอมมิชชั่นในระบบ</p>
                    <Button
                        onClick={() => openAddFormForService('standard')}
                        className="mt-4"
                    >
                        เพิ่มอัตราค่าคอมมิชชั่นแรก
                    </Button>
                </Card>
            ) : (
                <>
                    <div
                        className="sticky top-0 z-20 -mx-1 mb-4 flex flex-col gap-2 rounded-xl border border-slate-200/90 bg-white/90 px-3 py-2.5 shadow-sm backdrop-blur-sm sm:flex-row sm:flex-wrap sm:items-center sm:gap-3 dark:border-slate-700 dark:bg-slate-900/90"
                        role="navigation"
                        aria-label="ไปยังหมวดอัตรา"
                    >
                        <div className="flex shrink-0 items-center gap-1.5 text-slate-600 dark:text-slate-300">
                            <ListTree className="h-4 w-4 text-slate-500 dark:text-slate-400" aria-hidden />
                            <span className="text-xs font-medium sm:text-sm">ไปยัง</span>
                        </div>
                        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                            {quickNavSectionKeys.map((key) => (
                                <button
                                    type="button"
                                    key={key}
                                    onClick={() => scrollToRateSection(key)}
                                    className={`inline-flex items-center justify-center rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors sm:px-3 sm:text-sm ${SECTION_QUICK_BTN[key]}`}
                                >
                                    {SECTION_QUICK_LABEL[key]}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="space-y-10">
                    {COMMISSION_RATE_SECTIONS.map((section) => {
                        const list = ratesByServiceBucket[section.key];
                        if (section.key === 'other' && list.length === 0) {
                            return null;
                        }

                        return (
                            <section
                                key={section.key}
                                id={commissionSectionAnchorId(section.key)}
                                className={`scroll-mt-24 rounded-xl border-2 p-4 md:scroll-mt-28 md:p-5 ${section.accentClass}`}
                            >
                                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                    <div>
                                        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                                            {section.title}
                                        </h2>
                                        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                                            {section.description}
                                        </p>
                                        <p className="mt-2 text-xs text-slate-500 dark:text-slate-500">
                                            {list.length} อัตรา
                                            {section.key === 'carry_in' || section.key === 'lift_off' ? (
                                                <span> — ชื่อเรทอาจซ้ำกับอีกหมวดได้; ดูเฉพาะรายการในหมวดนี้</span>
                                            ) : null}
                                        </p>
                                    </div>
                                    {section.key !== 'other' && (
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={() => openAddFormForService(section.preselectService)}
                                            className="shrink-0 flex items-center gap-2"
                                        >
                                            <Plus size={18} />
                                            {section.key === 'standard' && 'เพิ่ม (มาตรฐาน)'}
                                            {section.key === 'carry_in' && 'เพิ่ม (ลงมือ)'}
                                            {section.key === 'lift_off' && 'เพิ่ม (ตักลง)'}
                                        </Button>
                                    )}
                                </div>

                                {list.length === 0 ? (
                                    <div className="rounded-lg border border-dashed border-slate-300 dark:border-slate-600 py-8 px-4 text-center text-sm text-slate-500 dark:text-slate-400">
                                        ยังไม่มีอัตราในหมวดนี้ — กด &quot;เพิ่ม&quot; ด้านบนเพื่อสร้างและเลือกประเภทบริการให้ตรงกับทริป
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                                        {list.map((rate) => renderRateCard(rate))}
                                    </div>
                                )}
                            </section>
                        );
                    })}
                    </div>
                </>
            )}

            {/* Summary */}
            {!loading && rates.length > 0 && (
                <div className="mt-6 text-sm text-gray-600 dark:text-gray-400 text-center">
                    ทั้งหมด {rates.length} อัตรา
                    {' • '}
                    ใช้งาน: {rates.filter(r => r.is_active).length}
                    {' • '}
                    ไม่ใช้งาน: {rates.filter(r => !r.is_active).length}
                </div>
            )}
        </PageLayout>
    );
};
