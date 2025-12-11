// Component: ChangeVehicleDialog
// Dialog สำหรับเปลี่ยนรถของ Delivery Trip

import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Truck, AlertTriangle, X } from 'lucide-react';

interface Vehicle {
    id: string;
    plate: string;
    make?: string;
    model?: string;
}

interface ChangeVehicleDialogProps {
    tripId: string;
    currentVehicleId: string;
    currentVehiclePlate: string;
    onClose: () => void;
    onSuccess: () => void;
}

export const ChangeVehicleDialog: React.FC<ChangeVehicleDialogProps> = ({
    tripId,
    currentVehicleId,
    currentVehiclePlate,
    onClose,
    onSuccess,
}) => {
    const [vehicles, setVehicles] = useState<Vehicle[]>([]);
    const [selectedVehicleId, setSelectedVehicleId] = useState('');
    const [reason, setReason] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [hasActiveTripLogs, setHasActiveTripLogs] = useState(false);

    useEffect(() => {
        fetchVehicles();
        checkActiveTripLogs();
    }, []);

    const fetchVehicles = async () => {
        try {
            const { data, error } = await supabase
                .from('vehicles')
                .select('id, plate, make, model')
                .eq('status', 'active')
                .order('plate');

            if (error) throw error;
            setVehicles(data || []);
        } catch (err) {
            console.error('Error fetching vehicles:', err);
        }
    };

    const checkActiveTripLogs = async () => {
        try {
            const { data, error } = await supabase
                .from('trip_logs')
                .select('id')
                .eq('vehicle_id', currentVehicleId)
                .eq('status', 'checked_out');

            if (error) throw error;
            setHasActiveTripLogs((data || []).length > 0);
        } catch (err) {
            console.error('Error checking trip logs:', err);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!selectedVehicleId) {
            setError('กรุณาเลือกรถคันใหม่');
            return;
        }

        if (!reason.trim()) {
            setError('กรุณาระบุเหตุผลในการเปลี่ยนรถ');
            return;
        }

        if (selectedVehicleId === currentVehicleId) {
            setError('กรุณาเลือกรถคันที่แตกต่างจากรถคันเดิม');
            return;
        }

        try {
            setLoading(true);
            setError('');

            // Call the changeVehicle function
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('User not authenticated');

            // Get trip first
            const { data: trip, error: tripError } = await supabase
                .from('delivery_trips')
                .select('status')
                .eq('id', tripId)
                .single();

            if (tripError) throw tripError;

            if (!['planned', 'in_progress'].includes(trip.status)) {
                throw new Error('ไม่สามารถเปลี่ยนรถสำหรับทริปที่เสร็จสิ้นหรือยกเลิกแล้ว');
            }

            // Update vehicle
            const { error: updateError } = await supabase
                .from('delivery_trips')
                .update({
                    vehicle_id: selectedVehicleId,
                    updated_at: new Date().toISOString(),
                    updated_by: user.id,
                })
                .eq('id', tripId);

            if (updateError) throw updateError;

            // Log the change
            const { error: logError } = await supabase
                .from('delivery_trip_vehicle_changes')
                .insert({
                    delivery_trip_id: tripId,
                    old_vehicle_id: currentVehicleId,
                    new_vehicle_id: selectedVehicleId,
                    reason: reason.trim(),
                    changed_by: user.id,
                    changed_at: new Date().toISOString(),
                });

            if (logError) {
                console.error('Error logging vehicle change:', logError);
                // Don't throw - continue even if logging fails
            }

            // Unlink trip logs
            await supabase
                .from('trip_logs')
                .update({ delivery_trip_id: null })
                .eq('delivery_trip_id', tripId);

            onSuccess();
        } catch (err: any) {
            console.error('Error changing vehicle:', err);
            setError(err.message || 'เกิดข้อผิดพลาดในการเปลี่ยนรถ');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-2">
                        <Truck size={24} className="text-blue-600 dark:text-blue-400" />
                        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                            เปลี่ยนรถ
                        </h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Body */}
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {/* Warning if has active trip logs */}
                    {hasActiveTripLogs && (
                        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                            <div className="flex items-start gap-2">
                                <AlertTriangle size={20} className="text-yellow-600 dark:text-yellow-400 mt-0.5" />
                                <div className="text-sm text-yellow-800 dark:text-yellow-200">
                                    <p className="font-semibold mb-1">คำเตือน</p>
                                    <p>
                                        รถคันเดิมมี trip log ที่ยังไม่ check-in อยู่
                                        การเปลี่ยนรถจะทำให้ trip log เหล่านี้ไม่ผูกกับทริปนี้อีกต่อไป
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Current Vehicle */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            รถคันปัจจุบัน
                        </label>
                        <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-3">
                            <p className="font-semibold text-gray-900 dark:text-white">
                                {currentVehiclePlate}
                            </p>
                        </div>
                    </div>

                    {/* New Vehicle */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            รถคันใหม่ <span className="text-red-500">*</span>
                        </label>
                        <select
                            value={selectedVehicleId}
                            onChange={(e) => setSelectedVehicleId(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                            required
                        >
                            <option value="">เลือกรถ...</option>
                            {vehicles
                                .filter(v => v.id !== currentVehicleId)
                                .map(vehicle => (
                                    <option key={vehicle.id} value={vehicle.id}>
                                        {vehicle.plate}
                                        {vehicle.make && vehicle.model && ` (${vehicle.make} ${vehicle.model})`}
                                    </option>
                                ))}
                        </select>
                    </div>

                    {/* Reason */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            เหตุผล <span className="text-red-500">*</span>
                        </label>
                        <textarea
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                            rows={3}
                            placeholder="เช่น รถเสีย, เปลี่ยนแผน, ฯลฯ"
                            required
                        />
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                            <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                            disabled={loading}
                        >
                            ยกเลิก
                        </button>
                        <button
                            type="submit"
                            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            disabled={loading}
                        >
                            {loading ? 'กำลังบันทึก...' : 'เปลี่ยนรถ'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
