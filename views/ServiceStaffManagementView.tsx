// Service Staff Management View - Manage service staff (drivers, helpers)
import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Search, Users, Phone, User, AlertCircle } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card } from '../components/ui/Card';
import { PageLayout } from '../components/layout/PageLayout';
import { supabase } from '../lib/supabase';
import type { Database } from '../types/database';

type ServiceStaff = Database['public']['Tables']['service_staff']['Row'];

export const ServiceStaffManagementView: React.FC = () => {
    const [staff, setStaff] = useState<ServiceStaff[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [showForm, setShowForm] = useState(false);
    const [editingStaff, setEditingStaff] = useState<ServiceStaff | null>(null);
    const [formData, setFormData] = useState({
        name: '',
        employee_code: '',
        phone: '',
        default_team: '',
        status: 'active' as 'active' | 'sick' | 'leave' | 'inactive',
        notes: '',
    });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Fetch staff
    const fetchStaff = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('service_staff')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setStaff(data || []);
        } catch (err) {
            console.error('[ServiceStaffManagementView] Error fetching staff:', err);
            setError(err instanceof Error ? err.message : 'Failed to load staff');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStaff();
    }, []);

    // Filter staff
    const filteredStaff = staff.filter(s => {
        if (!search) return true;
        const searchLower = search.toLowerCase();
        return (
            (s.name || '').toLowerCase().includes(searchLower) ||
            (s.employee_code || '').toLowerCase().includes(searchLower) ||
            (s.phone || '').toLowerCase().includes(searchLower) ||
            (s.default_team || '').toLowerCase().includes(searchLower)
        );
    });

    // Handle form submit
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!formData.name.trim()) {
            setError('กรุณาระบุชื่อพนักงาน');
            return;
        }

        try {
            setSaving(true);

            if (editingStaff) {
                // Update
                const { error } = await supabase
                    .from('service_staff')
                    .update({
                        name: formData.name,
                        employee_code: formData.employee_code || null,
                        phone: formData.phone || null,
                        default_team: formData.default_team || null,
                        status: formData.status,
                        notes: formData.notes || null,
                        updated_at: new Date().toISOString(),
                    })
                    .eq('id', editingStaff.id);

                if (error) throw error;
            } else {
                // Create
                const { error } = await supabase
                    .from('service_staff')
                    .insert({
                        name: formData.name,
                        employee_code: formData.employee_code || null,
                        phone: formData.phone || null,
                        default_team: formData.default_team || null,
                        status: formData.status,
                        notes: formData.notes || null,
                    });

                if (error) throw error;
            }

            // Reset form and refresh
            setFormData({
                name: '',
                employee_code: '',
                phone: '',
                default_team: '',
                status: 'active',
                notes: '',
            });
            setEditingStaff(null);
            setShowForm(false);
            fetchStaff();
        } catch (err) {
            console.error('[ServiceStaffManagementView] Error saving staff:', err);
            setError(err instanceof Error ? err.message : 'Failed to save staff');
        } finally {
            setSaving(false);
        }
    };

    // Handle edit
    const handleEdit = (staffMember: ServiceStaff) => {
        setEditingStaff(staffMember);
        setFormData({
            name: staffMember.name,
            employee_code: staffMember.employee_code || '',
            phone: staffMember.phone || '',
            default_team: staffMember.default_team || '',
            status: staffMember.status as any,
            notes: staffMember.notes || '',
        });
        setShowForm(true);
        setError(null);
    };

    // Handle delete
    const handleDelete = async (id: string, name: string) => {
        if (!confirm(`ต้องการลบพนักงาน "${name}" ใช่หรือไม่?`)) {
            return;
        }

        try {
            const { error } = await supabase
                .from('service_staff')
                .delete()
                .eq('id', id);

            if (error) throw error;
            fetchStaff();
        } catch (err) {
            console.error('[ServiceStaffManagementView] Error deleting staff:', err);
            alert('ไม่สามารถลบพนักงานได้: ' + (err instanceof Error ? err.message : 'Unknown error'));
        }
    };

    // Cancel form
    const handleCancel = () => {
        setShowForm(false);
        setEditingStaff(null);
        setFormData({
            name: '',
            employee_code: '',
            phone: '',
            default_team: '',
            status: 'active',
            notes: '',
        });
        setError(null);
    };

    // Get status badge color
    const getStatusColor = (status: string) => {
        switch (status) {
            case 'active': return 'bg-green-100 text-green-800';
            case 'sick': return 'bg-yellow-100 text-yellow-800';
            case 'leave': return 'bg-blue-100 text-blue-800';
            case 'inactive': return 'bg-gray-100 text-gray-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    // Get status text
    const getStatusText = (status: string) => {
        switch (status) {
            case 'active': return 'ปกติ';
            case 'sick': return 'ป่วย';
            case 'leave': return 'ลา';
            case 'inactive': return 'ไม่ใช้งาน';
            default: return status;
        }
    };

    return (
        <PageLayout
            title="จัดการพนักงาน"
            subtitle="จัดการข้อมูลพนักงานขับรถและพนักงานบริการ"
        >
            {/* Header Actions */}
            <div className="mb-6 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                    <Input
                        type="text"
                        placeholder="ค้นหาพนักงาน..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-10"
                    />
                </div>

                <Button
                    onClick={() => {
                        setShowForm(true);
                        setEditingStaff(null);
                        setError(null);
                    }}
                    className="flex items-center gap-2"
                >
                    <Plus size={20} />
                    เพิ่มพนักงาน
                </Button>
            </div>

            {/* Form Modal */}
            {showForm && (
                <Card className="mb-6 p-6">
                    <h3 className="text-lg font-semibold mb-4">
                        {editingStaff ? 'แก้ไขข้อมูลพนักงาน' : 'เพิ่มพนักงานใหม่'}
                    </h3>

                    {error && (
                        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                            <AlertCircle className="text-red-600 flex-shrink-0 mt-0.5" size={20} />
                            <p className="text-sm text-red-800">{error}</p>
                        </div>
                    )}

                    <form onSubmit={handleSubmit}>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    ชื่อ-นามสกุล <span className="text-red-500">*</span>
                                </label>
                                <Input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="เช่น นายสมชาย ใจดี"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    รหัสพนักงาน
                                </label>
                                <Input
                                    type="text"
                                    value={formData.employee_code}
                                    onChange={(e) => setFormData({ ...formData, employee_code: e.target.value })}
                                    placeholder="เช่น EMP001"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    เบอร์โทรศัพท์
                                </label>
                                <Input
                                    type="tel"
                                    value={formData.phone}
                                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                    placeholder="เช่น 081-234-5678"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    ทีม
                                </label>
                                <Input
                                    type="text"
                                    value={formData.default_team}
                                    onChange={(e) => setFormData({ ...formData, default_team: e.target.value })}
                                    placeholder="เช่น Team A"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    สถานะ
                                </label>
                                <select
                                    value={formData.status}
                                    onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                >
                                    <option value="active">ปกติ</option>
                                    <option value="sick">ป่วย</option>
                                    <option value="leave">ลา</option>
                                    <option value="inactive">ไม่ใช้งาน</option>
                                </select>
                            </div>

                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    หมายเหตุ
                                </label>
                                <textarea
                                    value={formData.notes}
                                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                    placeholder="หมายเหตุเพิ่มเติม..."
                                    rows={3}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                                {saving ? 'กำลังบันทึก...' : editingStaff ? 'บันทึกการแก้ไข' : 'เพิ่มพนักงาน'}
                            </Button>
                        </div>
                    </form>
                </Card>
            )}

            {/* Staff List */}
            {loading ? (
                <div className="text-center py-12">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    <p className="mt-2 text-gray-600">กำลังโหลด...</p>
                </div>
            ) : filteredStaff.length === 0 ? (
                <Card className="p-12 text-center">
                    <Users className="mx-auto text-gray-400 mb-4" size={48} />
                    <p className="text-gray-600">
                        {search ? 'ไม่พบพนักงานที่ค้นหา' : 'ยังไม่มีพนักงานในระบบ'}
                    </p>
                    {!search && (
                        <Button
                            onClick={() => setShowForm(true)}
                            className="mt-4"
                        >
                            เพิ่มพนักงานคนแรก
                        </Button>
                    )}
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredStaff.map((staffMember) => (
                        <Card key={staffMember.id} className="p-4 hover:shadow-lg transition-shadow">
                            <div className="flex items-start justify-between mb-3">
                                <div className="flex-1">
                                    <h3 className="font-semibold text-lg">{staffMember.name}</h3>
                                    {staffMember.employee_code && (
                                        <p className="text-sm text-gray-600">รหัส: {staffMember.employee_code}</p>
                                    )}
                                </div>
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(staffMember.status)}`}>
                                    {getStatusText(staffMember.status)}
                                </span>
                            </div>

                            <div className="space-y-2 mb-4">
                                {staffMember.phone && (
                                    <div className="flex items-center gap-2 text-sm text-gray-600">
                                        <Phone size={16} />
                                        {staffMember.phone}
                                    </div>
                                )}
                                {staffMember.default_team && (
                                    <div className="flex items-center gap-2 text-sm text-gray-600">
                                        <Users size={16} />
                                        {staffMember.default_team}
                                    </div>
                                )}
                                {staffMember.notes && (
                                    <p className="text-sm text-gray-500 italic">{staffMember.notes}</p>
                                )}
                            </div>

                            <div className="flex gap-2 pt-3 border-t">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleEdit(staffMember)}
                                    className="flex-1 flex items-center justify-center gap-1"
                                >
                                    <Edit2 size={16} />
                                    แก้ไข
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleDelete(staffMember.id, staffMember.name)}
                                    className="flex items-center justify-center gap-1 text-red-600 hover:bg-red-50"
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
            {!loading && staff.length > 0 && (
                <div className="mt-6 text-sm text-gray-600 text-center">
                    แสดง {filteredStaff.length} จาก {staff.length} คน
                    {' • '}
                    ปกติ: {staff.filter(s => s.status === 'active').length}
                    {' • '}
                    ป่วย: {staff.filter(s => s.status === 'sick').length}
                    {' • '}
                    ลา: {staff.filter(s => s.status === 'leave').length}
                    {' • '}
                    ไม่ใช้งาน: {staff.filter(s => s.status === 'inactive').length}
                </div>
            )}
        </PageLayout>
    );
};
