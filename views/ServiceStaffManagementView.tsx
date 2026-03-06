import React, { useState, useEffect, useMemo } from 'react';
import { Search, Users, Phone, Route } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card } from '../components/ui/Card';
import { PageLayout } from '../components/layout/PageLayout';
import { supabase } from '../lib/supabase';
import type { Database } from '../types/database';

type ServiceStaff = Database['public']['Tables']['service_staff']['Row'];

interface ServiceStaffManagementViewProps {
    onViewUsage?: (staffId: string) => void;
}

export const ServiceStaffManagementView: React.FC<ServiceStaffManagementViewProps> = ({ onViewUsage }) => {
    const [staff, setStaff] = useState<ServiceStaff[]>([]);
    const [loading, setLoading] = useState(true);
    const [fetchError, setFetchError] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [branchFilter, setBranchFilter] = useState('');

    const fetchStaff = async () => {
        try {
            setLoading(true);
            setFetchError(null);

            // branch อยู่ในตาราง service_staff โดยตรงแล้ว — ไม่ต้อง join profiles
            const { data, error } = await supabase
                .from('service_staff')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setStaff(data || []);
        } catch (err) {
            console.error('[ServiceStaffManagementView] Error fetching staff:', err);
            setFetchError(err instanceof Error ? err.message : 'โหลดข้อมูลไม่สำเร็จ');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStaff();
    }, []);

    // Unique sorted branches from loaded data
    const branches = useMemo(() => {
        const set = new Set<string>();
        staff.forEach(s => { if (s.branch) set.add(s.branch); });
        return Array.from(set).sort();
    }, [staff]);

    const filteredStaff = useMemo(() => {
        return staff.filter(s => {
            if (branchFilter && s.branch !== branchFilter) return false;
            if (!search) return true;
            const q = search.toLowerCase();
            return (
                (s.name || '').toLowerCase().includes(q) ||
                (s.employee_code || '').toLowerCase().includes(q) ||
                (s.phone || '').toLowerCase().includes(q) ||
                (s.default_team || '').toLowerCase().includes(q)
            );
        });
    }, [staff, search, branchFilter]);

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'active':   return 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300';
            case 'sick':     return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300';
            case 'leave':    return 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300';
            case 'inactive': return 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400';
            default:         return 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400';
        }
    };

    const getStatusText = (status: string) => {
        switch (status) {
            case 'active':   return 'ปกติ';
            case 'sick':     return 'ป่วย';
            case 'leave':    return 'ลา';
            case 'inactive': return 'ไม่ใช้งาน';
            default:         return status;
        }
    };

    return (
        <PageLayout
            title="พนักงานขับรถและบริการ"
            subtitle="รายชื่อทีมงานประจำรถและประวัติการปฏิบัติงาน"
        >
            {/* Search & Filter bar */}
            <div className="mb-6 flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-[200px] max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <Input
                        type="text"
                        placeholder="ค้นหาชื่อ, รหัส, เบอร์โทร, ทีม..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-9"
                    />
                </div>
                <select
                    value={branchFilter}
                    onChange={(e) => setBranchFilter(e.target.value)}
                    className="py-2 px-3 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-enterprise-500"
                >
                    <option value="">ทุกสาขา</option>
                    {branches.map(b => (
                        <option key={b} value={b}>{b}</option>
                    ))}
                </select>
            </div>

            {/* States */}
            {loading && (
                <div className="text-center py-16">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
                    <p className="mt-3 text-gray-500 dark:text-gray-400">กำลังโหลด...</p>
                </div>
            )}

            {fetchError && !loading && (
                <Card className="p-8 text-center text-sm text-red-500 dark:text-red-400">
                    {fetchError}
                </Card>
            )}

            {!loading && !fetchError && filteredStaff.length === 0 && (
                <Card className="p-12 text-center">
                    <Users className="mx-auto text-gray-400 mb-4" size={48} />
                    <p className="text-gray-500 dark:text-gray-400">
                        {search || branchFilter ? 'ไม่พบพนักงานที่ตรงกับเงื่อนไข' : 'ยังไม่มีข้อมูลพนักงานในระบบ'}
                    </p>
                </Card>
            )}

            {!loading && !fetchError && filteredStaff.length > 0 && (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filteredStaff.map((s) => (
                            <Card key={s.id} className="p-4 hover:shadow-lg transition-shadow">
                                <div className="flex items-start justify-between mb-3">
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-semibold text-base truncate text-slate-900 dark:text-white">
                                            {s.name}
                                        </h3>
                                        <div className="flex flex-wrap items-center gap-x-3 mt-0.5">
                                            {s.employee_code && (
                                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                                    รหัส: {s.employee_code}
                                                </p>
                                            )}
                                            {s.branch && (
                                                <p className="text-xs text-enterprise-600 dark:text-enterprise-400 font-medium">
                                                    {s.branch}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                    <span className={`ml-2 flex-shrink-0 px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(s.status)}`}>
                                        {getStatusText(s.status)}
                                    </span>
                                </div>

                                <div className="space-y-1.5 mb-4">
                                    {s.phone && (
                                        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                                            <Phone size={14} className="flex-shrink-0" />
                                            {s.phone}
                                        </div>
                                    )}
                                    {s.default_team && (
                                        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                                            <Users size={14} className="flex-shrink-0" />
                                            {s.default_team}
                                        </div>
                                    )}
                                    {s.notes && (
                                        <p className="text-xs text-gray-400 dark:text-gray-500 italic line-clamp-2">
                                            {s.notes}
                                        </p>
                                    )}
                                </div>

                                <div className="pt-3 border-t border-slate-100 dark:border-slate-700 flex items-center gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => onViewUsage?.(s.id)}
                                        disabled={!onViewUsage}
                                        className="flex items-center justify-center gap-1.5 flex-1"
                                    >
                                        <Route size={14} />
                                        ดูประวัติการปฏิบัติงาน
                                    </Button>
                                </div>
                            </Card>
                        ))}
                    </div>

                    <div className="mt-6 text-sm text-gray-500 dark:text-gray-400 text-center">
                        แสดง {filteredStaff.length} จาก {staff.length} คน
                        {' · '}ปกติ {staff.filter(s => s.status === 'active').length}
                        {' · '}ป่วย {staff.filter(s => s.status === 'sick').length}
                        {' · '}ลา {staff.filter(s => s.status === 'leave').length}
                        {' · '}ไม่ใช้งาน {staff.filter(s => s.status === 'inactive').length}
                    </div>
                </>
            )}
        </PageLayout>
    );
};
