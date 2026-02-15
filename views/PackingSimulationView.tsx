// Packing Simulation View - จำลองการจัดเรียงสินค้าก่อนจัดจริง
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
    Package,
    Truck,
    Calendar,
    MapPin,
    Users,
    Search,
    ChevronDown,
    RotateCcw,
    Building2,
} from 'lucide-react';
import { PageLayout } from '../components/layout/PageLayout';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { deliveryTripService } from '../services/deliveryTripService';
import { PackingSimulator } from '../components/trip/PackingSimulator';
import { useAuth } from '../hooks';

// Simplified trip list item
interface TripListItem {
    id: string;
    trip_number: string | null;
    planned_date: string;
    status: string;
    vehicle?: { plate: string; make?: string; model?: string } | null;
    driver?: { full_name: string } | null;
    stores?: any[];
    items?: any[];
    total_weight_kg?: number;
    estimated_pallets?: number;
}

const BRANCH_OPTIONS: { value: string; label: string }[] = [
    { value: 'ALL', label: 'ทุกสาขา' },
    { value: 'HQ', label: 'สำนักงานใหญ่' },
    { value: 'SD', label: 'สาขาสอยดาว' },
];

export const PackingSimulationView: React.FC = () => {
    const { profile } = useAuth();
    const [trips, setTrips] = useState<TripListItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [tripDropdownOpen, setTripDropdownOpen] = useState(false);
    // กรองตามสาขา — ค่าเริ่มต้นตามสาขาของผู้ใช้ เพื่อไม่ให้สับสนระหว่างสาขา
    const [branchFilter, setBranchFilter] = useState<string>(() => profile?.branch || 'ALL');

    // Load upcoming trips (planned / in_progress) แยกตามสาขา
    useEffect(() => {
        const loadTrips = async () => {
            setLoading(true);
            try {
                const result = await deliveryTripService.getAll({
                    status: ['planned', 'in_progress'],
                    sortAscending: true,
                    branch: branchFilter === 'ALL' ? undefined : branchFilter,
                });
                setTrips(result || []);
            } catch (err) {
                console.error('[PackingSimulationView] Error loading trips:', err);
                setTrips([]);
            } finally {
                setLoading(false);
            }
        };
        loadTrips();
    }, [branchFilter]);

    // Filter trips by search
    const filteredTrips = useMemo(() => {
        if (!searchQuery.trim()) return trips;
        const q = searchQuery.toLowerCase();
        return trips.filter(t =>
            (t.trip_number && t.trip_number.toLowerCase().includes(q)) ||
            (t.vehicle?.plate && t.vehicle.plate.toLowerCase().includes(q)) ||
            (t.driver?.full_name && t.driver.full_name.toLowerCase().includes(q))
        );
    }, [trips, searchQuery]);

    const selectedTrip = useMemo(
        () => trips.find(t => t.id === selectedTripId) || null,
        [trips, selectedTripId]
    );

    const formatDate = (date: string) =>
        new Date(date).toLocaleDateString('th-TH', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        });

    const handleSelectTrip = useCallback((tripId: string) => {
        setSelectedTripId(tripId);
        setTripDropdownOpen(false);
    }, []);

    // Close dropdown when clicking outside
    useEffect(() => {
        if (!tripDropdownOpen) return;
        const handler = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (!target.closest('[data-trip-selector]')) {
                setTripDropdownOpen(false);
            }
        };
        document.addEventListener('click', handler);
        return () => document.removeEventListener('click', handler);
    }, [tripDropdownOpen]);

    return (
        <PageLayout
            title="จำลองจัดเรียงสินค้า"
            subtitle="วางแผนจัดพาเลทก่อนลงมือจัดจริง"
            actions={
                selectedTripId ? (
                    <Button
                        variant="outline"
                        onClick={() => setSelectedTripId(null)}
                    >
                        <RotateCcw size={16} className="mr-2" />
                        เปลี่ยนทริป
                    </Button>
                ) : undefined
            }
        >
            {/* Trip Selector */}
            {!selectedTripId && (
                <div className="max-w-3xl mx-auto" data-trip-selector>
                    {/* Hero Card */}
                    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-enterprise-600 via-blue-600 to-indigo-700 p-8 mb-8 shadow-2xl shadow-enterprise-500/20">
                        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDM0djItSDJ2LTJoMzR6bTAtMzBWMkgydjJoMzR6TTIgMHYyaDM0VjBIMnoiLz48L2c+PC9nPjwvc3ZnPg==')] opacity-30" />
                        <div className="relative z-10">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                                    <Package className="text-white" size={24} />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-bold text-white">จำลองจัดเรียงสินค้า</h2>
                                    <p className="text-blue-100 text-sm">เลือกทริปส่งสินค้าเพื่อเริ่มจำลอง</p>
                                </div>
                            </div>
                            <p className="text-blue-100/80 text-sm leading-relaxed max-w-lg">
                                วางแผนจัดสินค้าลงพาเลทก่อนลงมือจัดจริง ระบบจะช่วยติดตามจำนวน น้ำหนัก
                                และแนะนำการจัดจากประวัติทริปที่คล้ายกัน
                            </p>
                        </div>
                    </div>

                    {/* Trip Search & List */}
                    <Card className="overflow-hidden">
                        <div className="p-4 border-b border-slate-200 dark:border-slate-700 space-y-4">
                            {/* ตัวกรองสาขา — แยกทริปตามสาขา ไม่สับสน */}
                            <div className="flex flex-wrap items-center gap-3">
                                <div className="flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-400">
                                    <Building2 size={18} className="text-enterprise-500" />
                                    สาขา
                                </div>
                                <select
                                    value={branchFilter}
                                    onChange={e => setBranchFilter(e.target.value)}
                                    className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-enterprise-500 min-w-[160px]"
                                >
                                    {BRANCH_OPTIONS.map(opt => (
                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                    ))}
                                </select>
                                {branchFilter !== 'ALL' && (
                                    <span className="text-xs text-slate-500 dark:text-slate-400">
                                        แสดงเฉพาะทริปของ{branchFilter === 'HQ' ? 'สำนักงานใหญ่' : 'สอยดาว'}
                                    </span>
                                )}
                            </div>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                <input
                                    type="text"
                                    placeholder="ค้นหาทริป (หมายเลข, ทะเบียนรถ, คนขับ)..."
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-enterprise-500 focus:border-transparent transition-all"
                                />
                            </div>
                        </div>

                        {loading ? (
                            <div className="p-12 text-center">
                                <div className="inline-flex items-center gap-3 text-slate-500 dark:text-slate-400">
                                    <div className="w-5 h-5 border-2 border-enterprise-500 border-t-transparent rounded-full animate-spin" />
                                    <span>กำลังโหลดทริป...</span>
                                </div>
                            </div>
                        ) : filteredTrips.length === 0 ? (
                            <div className="p-12 text-center">
                                <Package className="mx-auto mb-4 text-slate-300 dark:text-slate-600" size={48} />
                                <p className="text-slate-500 dark:text-slate-400 font-medium">
                                    {searchQuery ? 'ไม่พบทริปที่ตรงกับคำค้นหา' : 'ไม่มีทริปที่รอจัดเรียง'}
                                </p>
                                <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">
                                    ต้องมีทริปในสถานะ "วางแผน" หรือ "กำลังดำเนินการ"
                                </p>
                            </div>
                        ) : (
                            <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[60vh] overflow-y-auto">
                                {filteredTrips.map(trip => {
                                    const storeCount = trip.stores?.length || 0;
                                    const itemCount = trip.items?.length || 0;
                                    const statusColors = trip.status === 'planned'
                                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                                        : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300';
                                    const statusLabel = trip.status === 'planned' ? 'วางแผน' : 'กำลังดำเนินการ';

                                    return (
                                        <button
                                            key={trip.id}
                                            onClick={() => handleSelectTrip(trip.id)}
                                            className="w-full text-left p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all duration-200 group"
                                        >
                                            <div className="flex items-start gap-4">
                                                {/* Trip icon */}
                                                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-enterprise-500 to-blue-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-enterprise-500/20 group-hover:scale-105 transition-transform">
                                                    <Truck className="text-white" size={20} />
                                                </div>

                                                {/* Trip info */}
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="font-semibold text-slate-900 dark:text-slate-100">
                                                            {trip.trip_number || `ทริป #${trip.id.substring(0, 8)}`}
                                                        </span>
                                                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${statusColors}`}>
                                                            {statusLabel}
                                                        </span>
                                                    </div>

                                                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500 dark:text-slate-400">
                                                        <span className="flex items-center gap-1">
                                                            <Calendar size={13} />
                                                            {formatDate(trip.planned_date)}
                                                        </span>
                                                        {trip.vehicle?.plate && (
                                                            <span className="flex items-center gap-1">
                                                                <Truck size={13} />
                                                                {trip.vehicle.plate}
                                                            </span>
                                                        )}
                                                        {trip.driver?.full_name && (
                                                            <span className="flex items-center gap-1">
                                                                <Users size={13} />
                                                                {trip.driver.full_name}
                                                            </span>
                                                        )}
                                                        {storeCount > 0 && (
                                                            <span className="flex items-center gap-1">
                                                                <MapPin size={13} />
                                                                {storeCount} ร้าน
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Arrow */}
                                                <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center group-hover:bg-enterprise-100 dark:group-hover:bg-enterprise-900/30 transition-colors">
                                                    <ChevronDown size={16} className="text-slate-400 group-hover:text-enterprise-600 dark:group-hover:text-enterprise-400 -rotate-90" />
                                                </div>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </Card>
                </div>
            )}

            {/* Simulator */}
            {selectedTripId && (
                <PackingSimulator
                    tripId={selectedTripId}
                    onClose={() => setSelectedTripId(null)}
                />
            )}
        </PageLayout>
    );
};
