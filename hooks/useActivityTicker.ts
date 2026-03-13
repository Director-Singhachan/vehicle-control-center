import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { ordersService } from '../services/ordersService';

export interface ActivityTickerItem {
    id: string;
    type: 'pending_orders' | 'active_trip' | 'order_assigned';
    label: string;
    branch?: string | null;
    color: 'amber' | 'blue' | 'green';
}

interface UseActivityTickerOptions {
    branch?: string | null;
    isHighLevel?: boolean; // admin/manager/inspector/executive
    pendingBillingCount?: number;
}

export function useActivityTicker({ branch, isHighLevel }: UseActivityTickerOptions) {
    const [items, setItems] = useState<ActivityTickerItem[]>([]);
    const [loading, setLoading] = useState(true);

    const shouldFilterBranch = !isHighLevel && branch && branch !== 'HQ';

    const fetchActivities = useCallback(async () => {
        try {
            const results: ActivityTickerItem[] = [];

            // 1. ออเดอร์รอจัดทริป
            const branchFilter = shouldFilterBranch ? branch! : undefined;
            const pendingOrders = await ordersService.getPendingOrders(
                branchFilter ? { branch: branchFilter } : undefined
            );

            if (pendingOrders.length > 0) {
                // Group by branch if high level
                if (isHighLevel) {
                    const byBranch = new Map<string, number>();
                    pendingOrders.forEach((o: any) => {
                        const b = o.branch || 'N/A';
                        byBranch.set(b, (byBranch.get(b) || 0) + 1);
                    });
                    byBranch.forEach((count, b) => {
                        results.push({
                            id: `pending-orders-${b}`,
                            type: 'pending_orders',
                            label: `${count} ออเดอร์รอจัดทริป`,
                            branch: b,
                            color: 'amber',
                        });
                    });
                } else {
                    results.push({
                        id: 'pending-orders',
                        type: 'pending_orders',
                        label: `${pendingOrders.length} ออเดอร์รอจัดทริป`,
                        color: 'amber',
                    });
                }
            }

            // 2. ทริปที่กำลังจัดส่ง (in_progress)
            let activeTripsQuery = supabase
                .from('delivery_trips')
                .select(`
          id,
          trip_number,
          branch,
          vehicle:vehicles!delivery_trips_vehicle_id_fkey(plate),
          delivery_trip_stores(id)
        `)
                .eq('status', 'in_progress')
                .order('updated_at', { ascending: false })
                .limit(10);

            if (shouldFilterBranch) {
                activeTripsQuery = activeTripsQuery.eq('branch', branch!);
            }

            const { data: activeTrips } = await activeTripsQuery;

            if (activeTrips && activeTrips.length > 0) {
                activeTrips.forEach((trip: any) => {
                    const storeCount = trip.delivery_trip_stores?.length || 0;
                    const plate = trip.vehicle?.plate || '';
                    const tripLabel = trip.trip_number || `ทริป #${trip.id?.slice(0, 6)}`;

                    results.push({
                        id: `active-trip-${trip.id}`,
                        type: 'active_trip',
                        label: `${tripLabel} ${plate} กำลังจัดส่ง (${storeCount} ร้าน)`,
                        branch: trip.branch,
                        color: 'blue',
                    });
                });
            }

            // 3. ออเดอร์ที่เพิ่งจัดทริปวันนี้
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const todayISO = today.toISOString();

            let assignedQuery = supabase
                .from('orders')
                .select(`
          id,
          order_number,
          branch,
          delivery_trip_id,
          delivery_trips!orders_delivery_trip_id_fkey(trip_number)
        `)
                .not('delivery_trip_id', 'is', null)
                .gte('updated_at', todayISO)
                .order('updated_at', { ascending: false })
                .limit(10);

            if (shouldFilterBranch) {
                assignedQuery = assignedQuery.eq('branch', branch!);
            }

            const { data: assignedOrders } = await assignedQuery;

            if (assignedOrders && assignedOrders.length > 0) {
                assignedOrders.forEach((order: any) => {
                    const orderNum = order.order_number || `ออเดอร์ #${order.id?.slice(0, 6)}`;
                    const tripNum = (order.delivery_trips as any)?.trip_number || '';

                    results.push({
                        id: `assigned-${order.id}`,
                        type: 'order_assigned',
                        label: `${orderNum} จัดทริปแล้ว${tripNum ? ` → ${tripNum}` : ''}`,
                        branch: order.branch,
                        color: 'green',
                    });
                });
            }

            setItems(results);
        } catch (error) {
            console.error('[useActivityTicker] Error fetching activities:', error);
        } finally {
            setLoading(false);
        }
    }, [branch, shouldFilterBranch, isHighLevel]);

    useEffect(() => {
        fetchActivities();

        // Auto-refresh every 60 seconds
        const interval = setInterval(fetchActivities, 60000);
        return () => clearInterval(interval);
    }, [fetchActivities]);

    return { items, loading, refetch: fetchActivities };
}
