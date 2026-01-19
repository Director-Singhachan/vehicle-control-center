/**
 * Order-Trip Sync Service
 * 
 * ฟังก์ชันสำหรับ sync ข้อมูลระหว่างออเดอร์และทริปส่งสินค้า
 * - เมื่อแก้ไขออเดอร์ → sync ไปยังทริป (ถ้าทริปยังไม่ completed)
 * - เมื่อแก้ไขทริป → แสดง warning (ไม่ sync กลับไปยังออเดอร์ เพราะทริปอาจมีการแก้ไขตามสถานการณ์จริง)
 */

import { supabase } from '../lib/supabase';

interface SyncResult {
  success: boolean;
  message: string;
  syncedItems?: number;
  skippedItems?: number;
}

/**
 * Sync ออเดอร์ไปยังทริป (เมื่อแก้ไขออเดอร์)
 * - จะ sync เฉพาะทริปที่ยังไม่ completed
 * - จะ sync เฉพาะสินค้าที่มาจากออเดอร์นี้
 */
export const orderTripSyncService = {
  /**
   * Sync ออเดอร์ไปยังทริปที่เกี่ยวข้อง
   * @param orderId - ID ของออเดอร์ที่แก้ไข
   * @returns SyncResult
   */
  syncOrderToTrip: async (orderId: string): Promise<SyncResult> => {
    try {
      // 1. หาออเดอร์และทริปที่เกี่ยวข้อง
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .select('id, delivery_trip_id, status')
        .eq('id', orderId)
        .single();

      if (orderError || !order) {
        return {
          success: false,
          message: 'ไม่พบออเดอร์',
        };
      }

      // ถ้าไม่มีทริป ไม่ต้อง sync
      if (!order.delivery_trip_id) {
        return {
          success: true,
          message: 'ออเดอร์นี้ยังไม่ถูกกำหนดทริป ไม่ต้อง sync',
        };
      }

      // 2. ตรวจสอบสถานะทริป
      const { data: trip, error: tripError } = await supabase
        .from('delivery_trips')
        .select('id, status, trip_number')
        .eq('id', order.delivery_trip_id)
        .single();

      if (tripError || !trip) {
        return {
          success: false,
          message: 'ไม่พบทริปที่เกี่ยวข้อง',
        };
      }

      // ถ้าทริป completed แล้ว ไม่ sync (เพราะอาจมีการแก้ไขตามสถานการณ์จริง)
      if (trip.status === 'completed') {
        return {
          success: false,
          message: `ทริป ${trip.trip_number} เสร็จสิ้นแล้ว ไม่สามารถ sync ได้ (อาจมีการแก้ไขตามสถานการณ์จริง)`,
        };
      }

      // 3. ดึง order items
      const { data: orderItems, error: itemsError } = await supabase
        .from('order_items')
        .select('id, product_id, quantity, is_bonus')
        .eq('order_id', orderId);

      if (itemsError) {
        return {
          success: false,
          message: `เกิดข้อผิดพลาดในการดึง order items: ${itemsError.message}`,
        };
      }

      if (!orderItems || orderItems.length === 0) {
        return {
          success: true,
          message: 'ออเดอร์นี้ไม่มีรายการสินค้า',
        };
      }

      // 4. ดึง store_id จากออเดอร์
      const { data: orderData, error: orderDataError } = await supabase
        .from('orders')
        .select('store_id')
        .eq('id', orderId)
        .single();

      if (orderDataError || !orderData || !orderData.store_id) {
        return {
          success: false,
          message: 'ไม่พบร้านค้าในออเดอร์',
        };
      }

      // 5. หา delivery_trip_store ที่เกี่ยวข้องกับออเดอร์นี้
      const { data: tripStores, error: tripStoresError } = await supabase
        .from('delivery_trip_stores')
        .select('id, store_id')
        .eq('delivery_trip_id', trip.id)
        .eq('store_id', orderData.store_id);

      if (tripStoresError || !tripStores || tripStores.length === 0) {
        return {
          success: false,
          message: 'ไม่พบร้านค้าในทริปที่เกี่ยวข้องกับออเดอร์นี้',
        };
      }

      const tripStore = tripStores[0];

      // 6. Sync แต่ละ order item ไปยัง delivery_trip_items
      let syncedCount = 0;
      let skippedCount = 0;

      for (const orderItem of orderItems) {
        // หา delivery_trip_item ที่มี product_id และ is_bonus เหมือนกัน
        const { data: existingTripItems, error: findError } = await supabase
          .from('delivery_trip_items')
          .select('id, quantity')
          .eq('delivery_trip_id', trip.id)
          .eq('delivery_trip_store_id', tripStore.id)
          .eq('product_id', orderItem.product_id)
          .eq('is_bonus', orderItem.is_bonus || false);

        if (findError) {
          console.error(`[orderTripSyncService] Error finding trip item for product ${orderItem.product_id}:`, findError);
          skippedCount++;
          continue;
        }

        if (existingTripItems && existingTripItems.length > 0) {
          // อัพเดท quantity
          const tripItem = existingTripItems[0];
          if (tripItem.quantity !== orderItem.quantity) {
            const { error: updateError } = await supabase
              .from('delivery_trip_items')
              .update({ quantity: orderItem.quantity })
              .eq('id', tripItem.id);

            if (updateError) {
              console.error(`[orderTripSyncService] Error updating trip item ${tripItem.id}:`, updateError);
              skippedCount++;
            } else {
              syncedCount++;
            }
          } else {
            skippedCount++; // ไม่ต้อง sync เพราะ quantity เหมือนกัน
          }
        } else {
          // ไม่มี trip item → เพิ่มใหม่
          const { error: insertError } = await supabase
            .from('delivery_trip_items')
            .insert({
              delivery_trip_id: trip.id,
              delivery_trip_store_id: tripStore.id,
              product_id: orderItem.product_id,
              quantity: orderItem.quantity,
              is_bonus: orderItem.is_bonus || false,
            });

          if (insertError) {
            console.error(`[orderTripSyncService] Error inserting trip item for product ${orderItem.product_id}:`, insertError);
            skippedCount++;
          } else {
            syncedCount++;
          }
        }
      }

      // 7. Mark trip as having item changes (ถ้ามีการ sync)
      if (syncedCount > 0) {
        const { error: flagError } = await supabase
          .from('delivery_trips')
          .update({
            has_item_changes: true,
            last_item_change_at: new Date().toISOString(),
          })
          .eq('id', trip.id);

        if (flagError) {
          console.error('[orderTripSyncService] Error updating item change flags:', flagError);
        }
      }

      return {
        success: true,
        message: `Sync เรียบร้อย: อัพเดท ${syncedCount} รายการ, ข้าม ${skippedCount} รายการ`,
        syncedItems: syncedCount,
        skippedItems: skippedCount,
      };
    } catch (error: any) {
      console.error('[orderTripSyncService] Error syncing order to trip:', error);
      return {
        success: false,
        message: `เกิดข้อผิดพลาด: ${error.message}`,
      };
    }
  },

  /**
   * ตรวจสอบว่าออเดอร์มีทริปที่เกี่ยวข้องหรือไม่
   */
  hasRelatedTrip: async (orderId: string): Promise<{ hasTrip: boolean; tripId?: string; tripStatus?: string }> => {
    try {
      const { data: order, error } = await supabase
        .from('orders')
        .select('delivery_trip_id, delivery_trips(status)')
        .eq('id', orderId)
        .single();

      if (error || !order || !order.delivery_trip_id) {
        return { hasTrip: false };
      }

      return {
        hasTrip: true,
        tripId: order.delivery_trip_id,
        tripStatus: (order.delivery_trips as any)?.status,
      };
    } catch (error) {
      console.error('[orderTripSyncService] Error checking related trip:', error);
      return { hasTrip: false };
    }
  },
};
