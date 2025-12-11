// Component: VehicleChangeHistory
// แสดงประวัติการเปลี่ยนรถสำหรับ Delivery Trip

import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { History, Truck, User, Calendar, MessageSquare } from 'lucide-react';

interface VehicleChange {
    id: string;
    delivery_trip_id: string;
    old_vehicle_id: string;
    new_vehicle_id: string;
    reason: string;
    changed_by: string;
    changed_at: string;
    old_vehicle?: {
        plate: string;
        make?: string;
        model?: string;
    };
    new_vehicle?: {
        plate: string;
        make?: string;
        model?: string;
    };
    changed_by_user?: {
        full_name: string;
    };
}

interface VehicleChangeHistoryProps {
    tripId: string;
}

export const VehicleChangeHistory: React.FC<VehicleChangeHistoryProps> = ({ tripId }) => {
    const [changes, setChanges] = useState<VehicleChange[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchChanges();
    }, [tripId]);

    const fetchChanges = async () => {
        try {
            setLoading(true);

            const { data, error } = await supabase
                .from('delivery_trip_vehicle_changes')
                .select('*')
                .eq('delivery_trip_id', tripId)
                .order('changed_at', { ascending: false });

            if (error) throw error;

            if (!data || data.length === 0) {
                setChanges([]);
                return;
            }

            // Fetch related data
            const vehicleIds = [
                ...data.map(c => c.old_vehicle_id),
                ...data.map(c => c.new_vehicle_id),
            ];
            const userIds = data.map(c => c.changed_by);

            const [vehiclesResult, usersResult] = await Promise.all([
                supabase
                    .from('vehicles')
                    .select('id, plate, make, model')
                    .in('id', vehicleIds),
                supabase
                    .from('profiles')
                    .select('id, full_name')
                    .in('id', userIds),
            ]);

            const vehicleMap = new Map(
                (vehiclesResult.data || []).map(v => [v.id, v])
            );
            const userMap = new Map(
                (usersResult.data || []).map(u => [u.id, u])
            );

            const enrichedChanges = data.map(change => ({
                ...change,
                old_vehicle: vehicleMap.get(change.old_vehicle_id),
                new_vehicle: vehicleMap.get(change.new_vehicle_id),
                changed_by_user: userMap.get(change.changed_by),
            }));

            setChanges(enrichedChanges);
        } catch (error) {
            console.error('Error fetching vehicle changes:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <div className="flex items-center gap-2 mb-4">
                    <History size={20} className="text-gray-600 dark:text-gray-400" />
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        ประวัติการเปลี่ยนรถ
                    </h3>
                </div>
                <p className="text-gray-500 dark:text-gray-400">กำลังโหลด...</p>
            </div>
        );
    }

    if (changes.length === 0) {
        return null; // Don't show if no changes
    }

    return (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center gap-2 mb-4">
                <History size={20} className="text-gray-600 dark:text-gray-400" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    ประวัติการเปลี่ยนรถ
                </h3>
                <span className="ml-auto text-sm text-gray-500 dark:text-gray-400">
                    {changes.length} ครั้ง
                </span>
            </div>

            <div className="space-y-4">
                {changes.map((change, index) => (
                    <div
                        key={change.id}
                        className="border-l-4 border-yellow-500 dark:border-yellow-600 pl-4 py-2"
                    >
                        {/* Vehicle Change */}
                        <div className="flex items-center gap-2 mb-2">
                            <Truck size={16} className="text-gray-600 dark:text-gray-400" />
                            <span className="text-sm text-gray-700 dark:text-gray-300">
                                เปลี่ยนจาก{' '}
                                <span className="font-semibold text-red-600 dark:text-red-400">
                                    {change.old_vehicle?.plate || 'ไม่ทราบ'}
                                    {change.old_vehicle?.make && change.old_vehicle?.model && (
                                        <span className="text-gray-500 dark:text-gray-400 ml-1">
                                            ({change.old_vehicle.make} {change.old_vehicle.model})
                                        </span>
                                    )}
                                </span>
                                {' → '}
                                <span className="font-semibold text-green-600 dark:text-green-400">
                                    {change.new_vehicle?.plate || 'ไม่ทราบ'}
                                    {change.new_vehicle?.make && change.new_vehicle?.model && (
                                        <span className="text-gray-500 dark:text-gray-400 ml-1">
                                            ({change.new_vehicle.make} {change.new_vehicle.model})
                                        </span>
                                    )}
                                </span>
                            </span>
                        </div>

                        {/* Reason */}
                        {change.reason && (
                            <div className="flex items-start gap-2 mb-2">
                                <MessageSquare size={16} className="text-gray-600 dark:text-gray-400 mt-0.5" />
                                <span className="text-sm text-gray-600 dark:text-gray-400">
                                    เหตุผล: {change.reason}
                                </span>
                            </div>
                        )}

                        {/* Changed By & Date */}
                        <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-500">
                            <div className="flex items-center gap-1">
                                <User size={14} />
                                <span>
                                    โดย: {change.changed_by_user?.full_name || 'ไม่ทราบชื่อ'}
                                </span>
                            </div>
                            <div className="flex items-center gap-1">
                                <Calendar size={14} />
                                <span>
                                    {new Date(change.changed_at).toLocaleString('th-TH', {
                                        year: 'numeric',
                                        month: 'short',
                                        day: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit',
                                    })}
                                </span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
