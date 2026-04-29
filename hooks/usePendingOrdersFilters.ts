import { useState, useMemo, useCallback, useEffect } from 'react';
import { getAreaGroupKey, getDistrictKey } from '../utils/parseThaiAddress';
import type { OrderBranchScope } from '../utils/orderUserScope';

interface UsePendingOrdersFiltersOptions {
    orders: any[] | null;
    profile: { role?: string; branch?: string } | null;
    scope?: OrderBranchScope;
}

export function usePendingOrdersFilters({ orders, profile, scope }: UsePendingOrdersFiltersOptions) {
    // ── Filter State ──
    const [searchQuery, setSearchQuery] = useState('');
    const [dateFilter, setDateFilter] = useState('');
    const [branchFilter, setBranchFilter] = useState<string>(() => {
        if (scope?.loading) return 'ALL';
        if (scope && !scope.unrestricted) {
            if (scope.allowedBranches.length === 1) return scope.allowedBranches[0];
            if (scope.allowedBranches.length > 1) return 'ALL';
            return 'ALL';
        }
        const isHighLevel = profile?.role === 'admin' || profile?.role === 'manager' || profile?.role === 'inspector' || profile?.role === 'executive' || profile?.role === 'dev';
        if (isHighLevel || profile?.branch === 'HQ') {
            return 'ALL';
        }
        return profile?.branch || 'ALL';
    });

    // ── Group-by-Area State ──
    // เริ่มต้นให้จัดกลุ่มตามพื้นที่เป็นค่าเริ่มต้น เพื่อให้หน้าออเดอร์รอจัดทริปเห็นภาพตามเขตได้ทันที
    const [groupByArea, setGroupByArea] = useState(true);
    const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
    const [districtFilter, setDistrictFilter] = useState<string>('ALL');
    const [subDistrictFilter, setSubDistrictFilter] = useState<string>('ALL');

    useEffect(() => {
        if (!scope || scope.loading || scope.unrestricted) return;
        const allowed = scope.allowedBranches;
        if (allowed.length === 1) {
            setBranchFilter((prev) => (prev !== allowed[0] ? allowed[0] : prev));
            return;
        }
        if (allowed.length > 1 && branchFilter !== 'ALL' && !allowed.includes(branchFilter)) {
            setBranchFilter('ALL');
        }
    }, [scope, branchFilter]);

    // ── Computed: Filtered Orders ──
    const filteredOrders = useMemo(() => {
        if (!orders) return [];

        const scopeAllowedBranches = scope?.allowedBranches ?? [];
        const scopeRestrictionActive = !!scope && !scope.loading && !scope.unrestricted;

        return orders.filter((order: any) => {
            const matchesSearch = !searchQuery ||
                order.customer_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                order.customer_code?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                order.order_number?.toLowerCase().includes(searchQuery.toLowerCase());

            const matchesDate = !dateFilter || order.delivery_date === dateFilter;

            let matchesBranch = !branchFilter || branchFilter === 'ALL' ||
                (order.branch && order.branch === branchFilter);

            if (scope?.loading) {
                matchesBranch = false;
            } else if (scopeRestrictionActive) {
                if (!branchFilter || branchFilter === 'ALL') {
                    matchesBranch = !!order.branch && scopeAllowedBranches.includes(order.branch);
                } else {
                    matchesBranch =
                        scopeAllowedBranches.includes(branchFilter) &&
                        order.branch === branchFilter;
                }
            }

            return matchesSearch && matchesDate && matchesBranch;
        });
    }, [orders, searchQuery, dateFilter, branchFilter, scope]);

    // ── Computed: Filtered Orders Total ──
    const filteredOrdersTotal = useMemo(() => {
        return filteredOrders.reduce((sum: number, o: any) => sum + (o.total_amount || 0), 0);
    }, [filteredOrders]);

    // ── Computed: Available Districts (for chip filter) ──
    const availableDistricts = useMemo(() => {
        const map = new Map<string, { count: number; total: number }>();
        filteredOrders.forEach((order: any) => {
            const address = order.delivery_address || order.store_address || '';
            const dk = getDistrictKey(address);
            const existing = map.get(dk) || { count: 0, total: 0 };
            existing.count++;
            existing.total += (order.total_amount || 0);
            map.set(dk, existing);
        });
        return Array.from(map.entries())
            .map(([key, val]) => ({ key, ...val }))
            .sort((a, b) => {
                if (a.key === 'ไม่ระบุอำเภอ') return 1;
                if (b.key === 'ไม่ระบุอำเภอ') return -1;
                return b.count - a.count;
            });
    }, [filteredOrders]);

    // ── Computed: Available Sub-Districts (level 2 chip filter) ──
    const availableSubDistricts = useMemo(() => {
        if (districtFilter === 'ALL') return [];
        const map = new Map<string, { count: number; total: number }>();
        filteredOrders.forEach((order: any) => {
            const address = order.delivery_address || order.store_address || '';
            const dk = getDistrictKey(address);
            if (dk !== districtFilter) return;
            const areaKey = getAreaGroupKey(address);
            const existing = map.get(areaKey) || { count: 0, total: 0 };
            existing.count++;
            existing.total += (order.total_amount || 0);
            map.set(areaKey, existing);
        });
        return Array.from(map.entries())
            .map(([key, val]) => ({ key, ...val }))
            .sort((a, b) => {
                if (a.key.includes('ไม่ระบุ')) return 1;
                if (b.key.includes('ไม่ระบุ')) return -1;
                return b.count - a.count;
            });
    }, [filteredOrders, districtFilter]);

    // ── Computed: Grouped Orders (district > sub-district) ──
    const groupedOrders = useMemo(() => {
        if (!groupByArea) return null;

        let sourceOrders = filteredOrders;
        if (districtFilter !== 'ALL') {
            sourceOrders = sourceOrders.filter((order: any) => {
                const address = order.delivery_address || order.store_address || '';
                return getDistrictKey(address) === districtFilter;
            });
        }
        if (subDistrictFilter !== 'ALL') {
            sourceOrders = sourceOrders.filter((order: any) => {
                const address = order.delivery_address || order.store_address || '';
                return getAreaGroupKey(address) === subDistrictFilter;
            });
        }

        const districtMap = new Map<string, {
            districtKey: string;
            areas: Map<string, any[]>;
            totalOrders: number;
        }>();

        sourceOrders.forEach((order: any) => {
            const address = order.delivery_address || order.store_address || '';
            const districtKey = getDistrictKey(address);
            const areaKey = getAreaGroupKey(address);

            if (!districtMap.has(districtKey)) {
                districtMap.set(districtKey, {
                    districtKey,
                    areas: new Map(),
                    totalOrders: 0,
                });
            }

            const district = districtMap.get(districtKey)!;
            if (!district.areas.has(areaKey)) {
                district.areas.set(areaKey, []);
            }
            district.areas.get(areaKey)!.push(order);
            district.totalOrders++;
        });

        return Array.from(districtMap.values()).sort((a, b) => {
            if (a.districtKey === 'ไม่ระบุอำเภอ') return 1;
            if (b.districtKey === 'ไม่ระบุอำเภอ') return -1;
            return b.totalOrders - a.totalOrders;
        });
    }, [filteredOrders, groupByArea, districtFilter, subDistrictFilter]);

    // ── Actions ──
    const toggleGroupCollapse = useCallback((groupKey: string) => {
        setCollapsedGroups(prev => {
            const next = new Set(prev);
            if (next.has(groupKey)) {
                next.delete(groupKey);
            } else {
                next.add(groupKey);
            }
            return next;
        });
    }, []);

    const toggleGroupByArea = useCallback(() => {
        setGroupByArea(prev => !prev);
        setCollapsedGroups(new Set());
        setDistrictFilter('ALL');
        setSubDistrictFilter('ALL');
    }, []);

    const handleSetDistrictFilter = useCallback((value: string) => {
        setDistrictFilter(prev => prev === value ? 'ALL' : value);
        setSubDistrictFilter('ALL');
    }, []);

    const handleSetSubDistrictFilter = useCallback((value: string) => {
        setSubDistrictFilter(prev => prev === value ? 'ALL' : value);
    }, []);

    const resetDistrictFilter = useCallback(() => {
        setDistrictFilter('ALL');
        setSubDistrictFilter('ALL');
    }, []);

    return {
        // Filter state + setters
        searchQuery,
        setSearchQuery,
        dateFilter,
        setDateFilter,
        branchFilter,
        setBranchFilter,

        // Group state
        groupByArea,
        collapsedGroups,
        districtFilter,
        subDistrictFilter,

        // Computed values
        filteredOrders,
        filteredOrdersTotal,
        availableDistricts,
        availableSubDistricts,
        groupedOrders,

        // Actions
        toggleGroupCollapse,
        toggleGroupByArea,
        handleSetDistrictFilter,
        handleSetSubDistrictFilter,
        resetDistrictFilter,
    };
}
