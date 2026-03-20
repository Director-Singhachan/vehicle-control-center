// Trip status service - cancel, updateStoreInvoiceStatus, syncQuantityDeliveredForCompletedTrip, syncStatusWithTripLogs
import { supabase } from '../../lib/supabase';
import { tripCrudService } from './tripCrudService';
import type { DeliveryTripWithRelations, DeliveryTripUpdate } from './types';

export const tripStatusService = {
  /**
   * ยกเลิกทริปส่งสินค้า
   *
   * **Multi-trip (ออเดอร์เดียวแบ่ง 3 เที่ยว):**
   * - ยกเลิก trip 1 (primary): ออเดอร์ที่ชี้ trip 1 จะถูก unassign (delivery_trip_id=null, order_number=null)
   *   และ quantity_delivered จะรีแคล์แบบ FIFO ต่อร้าน+สินค้า (RPC recalculate_quantity_delivered_after_order_unassign)
   * - ยกเลิก trip 2 หรือ 3: ไม่มีออเดอร์ชี้ทริปนี้ (ออเดอร์ชี้ trip 1) จึงไม่ unassign
   *   ทริปจะเปลี่ยน status เป็น cancelled เท่านั้น
   */
  cancel: async (id: string, reason?: string): Promise<DeliveryTripWithRelations> => {
    console.log('[deliveryTripService] cancel called with:', { id, reason: reason ? 'provided' : 'none' });

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError) {
      console.error('[deliveryTripService] Auth error:', authError);
      throw new Error('Authentication error: ' + authError.message);
    }

    if (!user) {
      console.error('[deliveryTripService] User not authenticated');
      throw new Error('User not authenticated');
    }

    const trip = await tripCrudService.getById(id);
    if (!trip) {
      console.error('[deliveryTripService] Trip not found:', id);
      throw new Error('Trip not found');
    }

    if (trip.status === 'completed') {
      console.error('[deliveryTripService] Cannot cancel completed trip');
      throw new Error('ไม่สามารถยกเลิกทริปที่จัดส่งเสร็จแล้วได้');
    }

    if (trip.status === 'cancelled') {
      console.error('[deliveryTripService] Trip already cancelled');
      throw new Error('ทริปนี้ถูกยกเลิกไปแล้ว');
    }

    if (trip.status !== 'planned' && trip.status !== 'in_progress') {
      console.error('[deliveryTripService] Invalid status for cancellation:', trip.status);
      throw new Error(`ไม่สามารถยกเลิกทริปที่มีสถานะ "${trip.status}" ได้ (ยกเลิกได้เฉพาะทริปที่ "รอจัดส่ง" หรือ "กำลังจัดส่ง")`);
    }

    const updateData: DeliveryTripUpdate = {
      status: 'cancelled',
      notes: reason ? `${trip.notes || ''}\n[ยกเลิก] ${reason}`.trim() : trip.notes,
      updated_by: user.id,
    };

    const { data: updatedData, error: updateError } = await supabase
      .from('delivery_trips')
      .update(updateData)
      .eq('id', id)
      .select();

    if (updateError) {
      console.error('[deliveryTripService] Error cancelling trip:', updateError);
      if (updateError.code === '42501') {
        throw new Error('คุณไม่มีสิทธิ์ในการยกเลิกทริปนี้ (ต้องเป็น Admin, Manager, Inspector หรือคนขับของทริปนี้)');
      } else if (updateError.code === 'PGRST116') {
        throw new Error('ไม่พบทริปที่ต้องการยกเลิก');
      }
      throw new Error(`เกิดข้อผิดพลาดในการยกเลิกทริป: ${updateError.message || 'Unknown error'}`);
    }

    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('id')
      .eq('delivery_trip_id', id);

    if (!ordersError && orders && orders.length > 0) {
      const orderIds = orders.map(o => o.id);
      await supabase
        .from('orders')
        .update({
          delivery_trip_id: null,
          order_number: null,
          status: 'confirmed',
          updated_by: user.id,
        })
        .in('id', orderIds);

      const { error: rpcError } = await supabase.rpc('recalculate_quantity_delivered_after_order_unassign', {
        p_order_ids: orderIds,
        p_excluded_trip_id: null,
      });

      if (rpcError) {
        console.error('[deliveryTripService] recalculate_quantity_delivered_after_order_unassign:', rpcError);
        throw new Error(
          rpcError.message || 'ไม่สามารถรีแคล์ยอดจัดส่งหลังถอดออเดอร์จากทริปได้ (ตรวจสอบว่า migration RPC ถูก apply แล้ว)'
        );
      }
    }

    const updatedTrip = await tripCrudService.getById(id);
    if (!updatedTrip) throw new Error('ไม่สามารถดึงข้อมูลทริปที่ยกเลิกแล้วได้');
    return updatedTrip;
  },

  updateStoreInvoiceStatus: async (
    tripId: string,
    storeId: string,
    status: 'pending' | 'issued'
  ): Promise<void> => {
    const { data: tripStore, error: findError } = await supabase
      .from('delivery_trip_stores')
      .select('id')
      .eq('delivery_trip_id', tripId)
      .eq('store_id', storeId)
      .single();
    if (findError) throw findError;
    const { error } = await supabase
      .from('delivery_trip_stores')
      .update({ invoice_status: status })
      .eq('id', tripStore.id);
    if (error) throw error;
  },

  syncQuantityDeliveredForCompletedTrip: async (tripId: string): Promise<void> => {
    const { error } = await supabase.rpc('backfill_quantity_delivered_for_trip', { p_trip_id: tripId });
    if (error) {
      console.error('[deliveryTripService] syncQuantityDeliveredForCompletedTrip error:', { tripId, error: error.message, code: error.code });
      throw error;
    }
    console.log('[deliveryTripService] Synced quantity_delivered and order status for completed trip:', tripId);
  },

  async syncStatusWithTripLogs(this: { syncQuantityDeliveredForCompletedTrip: (tripId: string) => Promise<void> }): Promise<{
    updated: number;
    details: Array<{ trip_id: string; trip_number: string; old_status: string; new_status: string }>;
  }> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const updatedTrips: Array<{ trip_id: string; trip_number: string; old_status: string; new_status: string }> = [];
    const { data: tripsToFix, error: fetchError } = await supabase
      .from('delivery_trips')
      .select('id, trip_number, vehicle_id, driver_id, planned_date, status, odometer_start, odometer_end')
      .in('status', ['planned', 'in_progress'])
      .lte('planned_date', new Date().toISOString().split('T')[0]);

    if (fetchError) throw fetchError;
    if (!tripsToFix || tripsToFix.length === 0) return { updated: 0, details: [] };

    for (const trip of tripsToFix) {
      const checkoutDate = new Date(trip.planned_date).toISOString().split('T')[0];
      const { data: completedTripLogs, error: logError } = await supabase
        .from('trip_logs')
        .select('id, driver_id, odometer_start, odometer_end, checkout_time, checkin_time, status, delivery_trip_id')
        .eq('vehicle_id', trip.vehicle_id)
        .eq('status', 'checked_in')
        .gte('checkout_time', `${checkoutDate}T00:00:00`)
        .lt('checkout_time', `${checkoutDate}T23:59:59`)
        .order('checkin_time', { ascending: false })
        .limit(1);

      if (logError || !completedTripLogs?.length) continue;

      const tripLog = completedTripLogs[0];
      const updateData: DeliveryTripUpdate = {
        status: 'completed',
        odometer_end: tripLog.odometer_end || trip.odometer_end,
        updated_at: new Date().toISOString(),
        updated_by: user.id,
      };
      if (tripLog.driver_id && trip.driver_id !== tripLog.driver_id) updateData.driver_id = tripLog.driver_id;
      if (!trip.odometer_start && tripLog.odometer_start) updateData.odometer_start = tripLog.odometer_start;

      const { error: updateError } = await supabase.from('delivery_trips').update(updateData).eq('id', trip.id);
      if (updateError) continue;

      if (!tripLog.delivery_trip_id) {
        await supabase.from('trip_logs').update({ delivery_trip_id: trip.id }).eq('id', tripLog.id);
      }
      await supabase
        .from('delivery_trip_stores')
        .update({ delivery_status: 'delivered', delivered_at: tripLog.checkin_time || new Date().toISOString() })
        .eq('delivery_trip_id', trip.id)
        .neq('delivery_status', 'delivered');

      updatedTrips.push({ trip_id: trip.id, trip_number: trip.trip_number || 'N/A', old_status: trip.status, new_status: 'completed' });
      try {
        await this.syncQuantityDeliveredForCompletedTrip(trip.id);
      } catch {
        // ignore
      }
    }
    return { updated: updatedTrips.length, details: updatedTrips };
  },
};
