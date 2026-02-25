import { useState, useCallback } from 'react';
import { deliveryTripService } from '../services/deliveryTripService';

interface UseInvoiceStatusOptions {
    refetch: () => Promise<any> | void;
    onSuccess?: (message: string) => void;
    onError?: (message: string) => void;
}

interface UseInvoiceStatusReturn {
    updatingStatus: Set<string>;
    handleToggleInvoiceStatus: (
        tripId: string,
        storeId: string,
        currentStatus: string,
        onStatusUpdated?: (newStatus: 'pending' | 'issued') => void
    ) => Promise<void>;
}

/**
 * Custom hook that encapsulates the invoice status toggle logic
 * for delivery trip stores. Manages the updating state and handles
 * API calls with optimistic UI updates.
 */
export function useInvoiceStatus({
    refetch,
    onSuccess,
    onError,
}: UseInvoiceStatusOptions): UseInvoiceStatusReturn {
    const [updatingStatus, setUpdatingStatus] = useState<Set<string>>(new Set());

    const handleToggleInvoiceStatus = useCallback(async (
        tripId: string,
        storeId: string,
        currentStatus: string,
        onStatusUpdated?: (newStatus: 'pending' | 'issued') => void
    ) => {
        const key = `${tripId}-${storeId}`;
        setUpdatingStatus(prev => new Set(prev).add(key));

        try {
            const newStatus = currentStatus === 'issued' ? 'pending' : 'issued';
            await deliveryTripService.updateStoreInvoiceStatus(tripId, storeId, newStatus);

            // Call callback to update local state immediately
            if (onStatusUpdated) {
                onStatusUpdated(newStatus);
            }

            // Refresh trips to ensure data consistency
            // Add a small delay to ensure database update is committed
            await new Promise(resolve => setTimeout(resolve, 300));
            await refetch();

            // Show success message after state update
            setTimeout(() => {
                if (newStatus === 'issued') {
                    onSuccess?.('บันทึกสถานะการออกบิลเรียบร้อย');
                } else {
                    onSuccess?.('ยกเลิกสถานะการออกบิลเรียบร้อย');
                }
            }, 100);
        } catch (err: any) {
            console.error('Error updating invoice status:', err);
            onError?.(err.message || 'เกิดข้อผิดพลาดในการอัพเดทสถานะการออกบิล');
            throw err; // Re-throw to allow caller to handle
        } finally {
            setUpdatingStatus(prev => {
                const next = new Set(prev);
                next.delete(key);
                return next;
            });
        }
    }, [refetch, onSuccess, onError]);

    return {
        updatingStatus,
        handleToggleInvoiceStatus,
    };
}
