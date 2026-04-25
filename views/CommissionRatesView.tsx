// Commission Rates Management View - Manage commission rate configurations
import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Edit2, Trash2, DollarSign, Truck, Calendar, AlertCircle } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card } from '../components/ui/Card';
import { PageLayout } from '../components/layout/PageLayout';
import { supabase } from '../lib/supabase';
import type { Database } from '../types/database';

type CommissionRate = Database['public']['Tables']['commission_rates']['Row'];

const SERVICE_TYPE_OPTIONS = [
    { value: 'standard', label: 'มาตรฐาน (standard)' },
    { value: 'carry_in', label: 'ลงมือ (carry_in)' },
    { value: 'lift_off', label: 'ตักลง (lift_off)' },
] as const;

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

    return (
        <PageLayout
            title="ตั้งค่าอัตราค่าคอมมิชชั่น"
            subtitle="จัดการอัตราค่าคอมมิชชั่นตามประเภทรถและบริการ"
        >
            {/* Header Actions */}
            <div className="mb-6 flex justify-end">
                <Button
                    onClick={() => {
                        setShowForm(true);
                        setEditingRate(null);
                        setError(null);
                    }}
                    className="flex items-center gap-2"
                >
                    <Plus size={20} />
                    เพิ่มอัตราค่าคอมมิชชั่น
                </Button>
            </div>

            {/* Form Modal */}
            {showForm && (
                <Card className="mb-6 p-6">
                    <h3 className="text-lg font-semibold mb-4 dark:text-white">
                        {editingRate ? 'แก้ไขอัตราค่าคอมมิชชั่น' : 'เพิ่มอัตราค่าคอมมิชชั่นใหม่'}
                    </h3>

                    {error && (
                        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-2">
                            <AlertCircle className="text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" size={20} />
                            <p className="text-sm text-red-800 dark:text-red-300">{error}</p>
                        </div>
                    )}

                    <form onSubmit={handleSubmit}>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
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
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    ประเภทรถ
                                </label>
                                <select
                                    value={formData.vehicle_type}
                                    onChange={(e) => setFormData({ ...formData, vehicle_type: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
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
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">เลือกจากประเภทรถจริงในระบบ เพื่อลดการพิมพ์ไม่ตรงกัน</p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    ประเภทบริการ
                                </label>
                                <select
                                    value={formData.service_type}
                                    onChange={(e) => setFormData({ ...formData, service_type: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
                                >
                                    {SERVICE_TYPE_OPTIONS.map((option) => (
                                        <option key={option.value} value={option.value}>
                                            {option.label}
                                        </option>
                                    ))}
                                </select>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">เลือกประเภทให้ตรงกับทริปที่สร้าง (ลงมือ/ตักลง)</p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
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
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    สถานะ
                                </label>
                                <select
                                    value={formData.is_active ? 'true' : 'false'}
                                    onChange={(e) => setFormData({ ...formData, is_active: e.target.value === 'true' })}
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
                                >
                                    <option value="true">ใช้งาน</option>
                                    <option value="false">ไม่ใช้งาน</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
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
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    สิ้นสุดการใช้งาน
                                </label>
                                <Input
                                    type="date"
                                    value={formData.effective_until}
                                    onChange={(e) => setFormData({ ...formData, effective_until: e.target.value })}
                                    placeholder="เว้นว่างถ้าไม่มีวันสิ้นสุด"
                                />
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">เว้นว่างถ้าไม่มีวันสิ้นสุด</p>
                            </div>

                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    หมายเหตุ
                                </label>
                                <textarea
                                    value={formData.notes}
                                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                    placeholder="หมายเหตุเพิ่มเติม..."
                                    rows={3}
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
                                />
                            </div>
                        </div>

                        <div className="flex gap-2 justify-end">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={handleCancel}
                                disabled={saving}
                            >
                                ยกเลิก
                            </Button>
                            <Button type="submit" disabled={saving}>
                                {saving ? 'กำลังบันทึก...' : editingRate ? 'บันทึกการแก้ไข' : 'เพิ่มอัตราค่าคอมมิชชั่น'}
                            </Button>
                        </div>
                    </form>
                </Card>
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
                        onClick={() => setShowForm(true)}
                        className="mt-4"
                    >
                        เพิ่มอัตราค่าคอมมิชชั่นแรก
                    </Button>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {rates.map((rate) => (
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
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${rate.is_active
                                        ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                                        : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-300'
                                    }`}>
                                    {rate.is_active ? 'ใช้งาน' : 'ไม่ใช้งาน'}
                                </span>
                            </div>

                            <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">อัตราค่าคอมมิชชั่น</p>
                                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                                    {formatCurrency(rate.rate_per_unit)}<span className="text-sm font-normal text-gray-600 dark:text-gray-400">/ชิ้น</span>
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
                                {rate.notes && (
                                    <p className="text-xs text-gray-500 dark:text-gray-400 italic mt-2">{rate.notes}</p>
                                )}
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
                    ))}
                </div>
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
