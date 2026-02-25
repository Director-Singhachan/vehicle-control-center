import { useState, useCallback, useRef, Dispatch, SetStateAction } from 'react';
import { orderItemsService } from '../services/ordersService';

interface UsePickupUpdateOptions {
    setOrderItems: Dispatch<SetStateAction<Map<string, any[]>>>;
    refetch: () => void;
}

export function usePickupUpdate({ setOrderItems, refetch }: UsePickupUpdateOptions) {
    const [savingPickupItemId, setSavingPickupItemId] = useState<string | null>(null);
    const [pendingPickupValues, setPendingPickupValues] = useState<Record<string, number>>({});
    const pickupDebounceRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

    const handleUpdatePickup = useCallback((itemId: string, qty: number) => {
        // 1. แสดงค่าใหม่ทันที (ไม่มี spinner)
        setPendingPickupValues(prev => ({ ...prev, [itemId]: qty }));

        // 2. ถ้ากำลังมี API call อยู่ (spinner ค้าง) ให้เคลียร์ทันทีเพราะ user กำลังพิมพ์ใหม่
        setSavingPickupItemId(prev => prev === itemId ? null : prev);

        // 3. ยกเลิก timer เดิม (ถ้ายังพิมพ์ไม่หยุด)
        if (pickupDebounceRef.current[itemId]) {
            clearTimeout(pickupDebounceRef.current[itemId]);
        }

        // 4. ตั้ง timer ใหม่ — ส่ง API หลังหยุดพิมพ์ 800ms
        pickupDebounceRef.current[itemId] = setTimeout(async () => {
            // อัปเดต orderItems map (optimistic update ก่อน API call)
            setOrderItems(prev => {
                const newMap = new Map(prev);
                newMap.forEach((items: any[], orderId) => {
                    const updated = items.map((item: any) =>
                        item.id === itemId
                            ? { ...item, quantity_picked_up_at_store: qty }
                            : item
                    );
                    newMap.set(orderId, updated);
                });
                return newMap;
            });

            setSavingPickupItemId(itemId); // แสดง spinner เฉพาะตอน API กำลังทำงาน
            try {
                await orderItemsService.updatePickedUpAtStore(itemId, qty);
            } catch (err) {
                console.error('[usePickupUpdate] updatePickedUpAtStore error:', err);
                refetch(); // revert on error
            } finally {
                setSavingPickupItemId(null);
                // ลบออกจาก pending เมื่อ save แล้ว (แสดงค่าจาก DB แทน)
                setPendingPickupValues(prev => {
                    const next = { ...prev };
                    delete next[itemId];
                    return next;
                });
            }
        }, 800);
    }, [setOrderItems, refetch]);

    return {
        savingPickupItemId,
        pendingPickupValues,
        handleUpdatePickup,
    };
}
