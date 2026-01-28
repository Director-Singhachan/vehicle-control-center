// Trip Log Service - CRUD operations for trip logs (check-out/check-in)
import { supabase } from '../lib/supabase';
import { notificationService } from './notificationService';
import type { Database } from '../types/database';

type TripLog = Database['public']['Tables']['trip_logs']['Row'];
type TripLogInsert = Database['public']['Tables']['trip_logs']['Insert'];
type TripLogUpdate = Database['public']['Tables']['trip_logs']['Update'];

export interface TripLogWithRelations extends TripLog {
  vehicle?: {
    plate: string;
    make?: string;
    model?: string;
    image_url?: string;
  };
  driver?: {
    full_name: string;
    email?: string;
    avatar_url?: string | null;
  };
  delivery_trip?: {
    id: string;
    trip_number: string;
    status: string;
  };
}

export interface CheckoutData {
  vehicle_id: string;
  odometer_start?: number; // Optional when using manual_distance_km
  manual_distance_km?: number; // For vehicles with broken odometers
  checkout_time?: string; // ISO string - optional, defaults to now()
  destination?: string;
  route?: string;
  notes?: string;
  is_backfill?: boolean; // Flag to indicate if this is a backfill entry
}

export interface CheckinData {
  odometer_end?: number; // Optional when using manual_distance_km
  manual_distance_km?: number; // For vehicles with broken odometers
  destination?: string;
  route?: string;
  notes?: string;
  checkin_time?: string; // ISO string - optional, defaults to now()
  is_backfill?: boolean; // Flag to indicate if this is a backfill entry
}

export interface TripLogUpdateData {
  destination?: string;
  route?: string;
  notes?: string;
  odometer_start?: number; // Admin only
  odometer_end?: number; // Admin only
  edit_reason: string; // Required - reason for editing
}

export interface TripEditHistory {
  id: string;
  trip_log_id: string | null;
  delivery_trip_id: string | null;
  edited_by: string;
  edit_reason: string;
  changes: {
    old_values: Record<string, any>;
    new_values: Record<string, any>;
  };
  edited_at: string;
  editor?: {
    full_name: string;
    email: string;
  };
}

export const tripLogService = {
  // Create check-out (start trip)
  createCheckout: async (data: CheckoutData): Promise<TripLog> => {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      throw new Error('User not authenticated');
    }

    // Use provided checkout_time or default to now()
    const checkoutTime = data.checkout_time || new Date().toISOString();

    // ========================================
    // Validation: Check for existing active trip
    // ========================================
    const { data: existingActiveTrip } = await supabase
      .from('trip_logs')
      .select('id, delivery_trip_id, checkout_time')
      .eq('vehicle_id', data.vehicle_id)
      .eq('status', 'checked_out')
      .maybeSingle();

    if (existingActiveTrip) {
      const checkoutDate = new Date(existingActiveTrip.checkout_time).toLocaleString('th-TH');
      throw new Error(
        `รถคันนี้มี trip log ที่ยังไม่ check-in อยู่แล้ว (ออกเมื่อ ${checkoutDate})\n` +
        `กรุณา check-in ก่อนสร้างทริปใหม่`
      );
    }

    // ========================================
    // Find delivery trip and validate
    // ========================================
    // Match by vehicle_id AND planned_date to ensure correct trip
    let deliveryTripId: string | null = null;
    try {
      // Extract date from checkout_time (YYYY-MM-DD)
      const checkoutDate = new Date(checkoutTime).toISOString().split('T')[0];

      const { data: deliveryTrips } = await supabase
        .from('delivery_trips')
        .select('id, sequence_order, trip_number, planned_date, status, created_at')
        .eq('vehicle_id', data.vehicle_id)
        .eq('planned_date', checkoutDate) // Match by date
        .in('status', ['planned', 'in_progress'])
        // Explicit ordering to pick the earliest planned trip deterministically
        .order('status', { ascending: true }) // in_progress before planned if any
        .order('sequence_order', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: true })
        .order('trip_number', { ascending: true })
        .limit(1);

      if (deliveryTrips && deliveryTrips.length > 0) {
        const selectedTrip = deliveryTrips[0];

        // ========================================
        // Validation: Check if delivery trip is already linked
        // ========================================
        const { data: existingLink } = await supabase
          .from('trip_logs')
          .select('id, checkout_time')
          .eq('delivery_trip_id', selectedTrip.id)
          .maybeSingle();

        if (existingLink) {
          console.warn(
            `[tripLogService] Delivery trip ${selectedTrip.trip_number} already linked to trip log ${existingLink.id}`
          );
          // ไม่ผูก delivery trip ถ้ามีการใช้งานแล้ว
          console.log('[tripLogService] Skipping delivery trip link due to existing usage');
        } else {
          deliveryTripId = selectedTrip.id;
          console.log('[tripLogService] Selected delivery trip for checkout:', {
            id: selectedTrip.id,
            trip_number: selectedTrip.trip_number,
            sequence_order: selectedTrip.sequence_order,
            planned_date: selectedTrip.planned_date,
            checkout_date: checkoutDate,
          });
        }
      } else {
        console.log('[tripLogService] No delivery trip found for vehicle on date:', {
          vehicle_id: data.vehicle_id,
          checkout_date: checkoutDate,
        });
      }
    } catch (err) {
      console.error('[tripLogService] Error finding delivery trip:', err);
      // Continue without delivery_trip_id
    }

    const tripLog: TripLogInsert = {
      vehicle_id: data.vehicle_id,
      driver_id: user.id,
      odometer_start: data.odometer_start || null,
      manual_distance_km: data.manual_distance_km || null,
      checkout_time: checkoutTime,
      destination: data.destination,
      route: data.route,
      notes: data.notes,
      status: 'checked_out',
      delivery_trip_id: deliveryTripId || undefined,
    };

    const { data: result, error } = await supabase
      .from('trip_logs')
      .insert(tripLog)
      .select()
      .single();

    if (error) {
      console.error('[tripLogService] Error creating checkout:', error);
      throw error;
    }

    // Update delivery trip status if exists (deliveryTripId already found above)
    if (deliveryTripId) {
      try {
        // Update delivery trip to in_progress and set odometer_start
        const { error: updateError } = await supabase
          .from('delivery_trips')
          .update({
            status: 'in_progress',
            odometer_start: data.odometer_start,
            updated_at: new Date().toISOString(),
          })
          .eq('id', deliveryTripId);

        if (updateError) {
          console.error('[tripLogService] Error updating delivery trip status:', updateError);
          // Don't throw - continue with notification
        } else {
          console.log('[tripLogService] Updated delivery trip to in_progress:', deliveryTripId);
        }
      } catch (deliveryTripError) {
        console.error('[tripLogService] Error updating delivery trip:', deliveryTripError);
        // Don't throw - continue with notification
      }
    }

    // Create notification event for trip started (vehicle checkout)
    try {
      // Enrich with vehicle & driver info for nicer notification message
      const { data: tripWithRelations } = await supabase
        .from('trip_logs')
        .select(`
          *,
          vehicle:vehicles(plate, make, model),
          driver:profiles(full_name),
          delivery_trip:delivery_trips(id, trip_number, status)
        `)
        .eq('id', result.id)
        .maybeSingle();

      const vehicle = (tripWithRelations as any)?.vehicle as {
        plate?: string;
        make?: string | null;
        model?: string | null;
      } | null;
      const driver = (tripWithRelations as any)?.driver as {
        full_name?: string;
      } | null;

      const plate = vehicle?.plate || result.vehicle_id;
      const vehicleLabel = vehicle?.make && vehicle?.model
        ? `${plate} (${vehicle.make} ${vehicle.model})`
        : plate;

      const driverName = driver?.full_name || 'ไม่ทราบชื่อผู้ขับ';

      const checkoutDate = new Date(result.checkout_time || checkoutTime);
      const checkoutAt = checkoutDate.toLocaleString('th-TH', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });

      const destination = result.destination || (data.destination || 'ไม่ระบุ');
      const route = result.route || data.route;
      const notes = result.notes || data.notes;

      const messageLines = [
        `🟢 [ออกเดินทาง]${data.is_backfill ? ' ⏪ (ลงย้อนหลัง)' : ''}`,
        `🚗 รถ: ${vehicleLabel}`,
        `🧑‍✈️ คนขับ: ${driverName}`,
        `📍 ปลายทาง: ${destination}`,
        route ? `🗺️ เส้นทาง: ${route}` : undefined,
        `⏰ เวลาออก: ${checkoutAt}`,
        result.odometer_start ? `📏 เลขไมล์เริ่มต้น: ${result.odometer_start.toLocaleString()} km` : undefined,
        result.manual_distance_km ? `📏 ระบุระยะทางเอง: ${result.manual_distance_km.toLocaleString()} km (เลขไมล์เสีย)` : undefined,
        notes ? `📝 หมายเหตุ: ${notes}` : undefined,
      ].filter(Boolean);

      const message = messageLines.join('\n');

      console.log('[tripLogService] Creating trip_started notification event', {
        trip_id: result.id,
        vehicle_id: result.vehicle_id,
      });

      const baseEvent = {
        event_type: 'trip_started' as const,
        title: 'รถถูกนำออกใช้งาน',
        message,
        payload: {
          trip_id: result.id,
          vehicle_id: result.vehicle_id,
          odometer_start: result.odometer_start,
          checkout_time: result.checkout_time,
        },
      };

      // Telegram (กลุ่มกลาง)
      await notificationService.createEvent(
        {
          channel: 'telegram',
          ...baseEvent,
        },
        user.id,
      );

      // LINE (กลุ่มกลาง)
      await notificationService.createEvent(
        {
          channel: 'line',
          ...baseEvent,
        },
        user.id,
      );
    } catch (notifyError) {
      console.error(
        '[tripLogService] Failed to create notification event for trip_started:',
        notifyError
      );
      // ไม่ throw ต่อ เพื่อไม่ให้กระทบการบันทึกทริป
    }

    return result;
  },

  // Update check-in (end trip)
  updateCheckin: async (tripId: string, data: CheckinData): Promise<TripLog> => {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      throw new Error('User not authenticated');
    }

    // Get the trip to validate
    const { data: trip, error: fetchError } = await supabase
      .from('trip_logs')
      .select('*')
      .eq('id', tripId)
      .single();

    if (fetchError) {
      throw fetchError;
    }

    if (!trip) {
      throw new Error('Trip not found');
    }

    if (trip.status === 'checked_in') {
      throw new Error('Trip already checked in');
    }

    // Validate based on mode (odometer vs manual distance)
    const isManualDistanceMode = trip.manual_distance_km !== null || data.manual_distance_km !== null;

    if (!isManualDistanceMode) {
      // Normal odometer mode - validate odometer readings
      if (data.odometer_end && trip.odometer_start && data.odometer_end <= trip.odometer_start) {
        throw new Error('Odometer end must be greater than odometer start');
      }
    }

    // Note: Distance validation (e.g., > 500km) should be handled at UI level with user confirmation
    // We don't block saving here to allow legitimate long-distance trips

    // Use provided checkin_time or default to now()
    const checkinTime = data.checkin_time || new Date().toISOString();

    const updateData: TripLogUpdate = {
      odometer_end: data.odometer_end || null,
      manual_distance_km: data.manual_distance_km || trip.manual_distance_km || null,
      checkin_time: checkinTime,
      status: 'checked_in',
      destination: data.destination ?? trip.destination,
      route: data.route ?? trip.route,
      notes: data.notes ?? trip.notes,
    };

    const { data: result, error } = await supabase
      .from('trip_logs')
      .update(updateData)
      .eq('id', tripId)
      .select()
      .single();

    if (error) {
      console.error('[tripLogService] Error updating checkin:', error);
      throw error;
    }

    // Update delivery trip status if exists
    try {
      console.log('[tripLogService] Checking for delivery trip to update:', {
        vehicle_id: trip.vehicle_id,
        delivery_trip_id: trip.delivery_trip_id,
        odometer_end: data.odometer_end,
      });

      // ========================================
      // Find delivery trip for this checkin
      // Priority:
      //   1) If this trip log is already linked to a delivery trip, use that
      //   2) Otherwise, find by vehicle_id + planned_date
      // ========================================
      let deliveryTrip:
        | {
          id: string;
          status: string;
          odometer_start: number | null;
          odometer_end: number | null;
          trip_number: string | null;
          sequence_order: number | null;
          planned_date: string | null;
          driver_id: string | null;
        }
        | null = null;

      // 1) Use existing link if present
      if (trip.delivery_trip_id) {
        const { data: linkedTrip, error: linkedError } = await supabase
          .from('delivery_trips')
          .select('id, status, odometer_start, odometer_end, trip_number, sequence_order, planned_date, driver_id')
          .eq('id', trip.delivery_trip_id)
          .maybeSingle();

        if (linkedError) {
          console.error('[tripLogService] Error loading linked delivery trip:', linkedError);
        } else if (linkedTrip) {
          deliveryTrip = linkedTrip as any;
          console.log('[tripLogService] Using already linked delivery trip for checkin:', {
            id: linkedTrip.id,
            trip_number: linkedTrip.trip_number,
            status: linkedTrip.status,
          });
        }
      }

      // 2) Fallback: find active delivery trip for this vehicle on the checkout date
      // This handles cases where the actual driver is different from the planned driver
      if (!deliveryTrip) {
        // Match by vehicle_id AND planned_date to ensure correct trip
        // Extract date from checkout_time (YYYY-MM-DD)
        const checkoutDate = new Date(trip.checkout_time).toISOString().split('T')[0];

        // First, try to find by vehicle_id + planned_date + status (planned or in_progress)
        // This will match even if driver_id is different (actual driver vs planned driver)
        const { data: deliveryTrips, error: findError } = await supabase
          .from('delivery_trips')
          .select('id, status, odometer_start, odometer_end, trip_number, sequence_order, planned_date, created_at, driver_id')
          .eq('vehicle_id', trip.vehicle_id)
          .eq('planned_date', checkoutDate) // Match by date
          .in('status', ['planned', 'in_progress'])
          // Prefer in_progress over planned explicitly (avoid relying on lexical order)
          .order('status', { ascending: true }) // 'in_progress' before 'planned'
          .order('sequence_order', { ascending: true, nullsFirst: false }) // Then by sequence
          .order('created_at', { ascending: true }) // Oldest created first
          .order('trip_number', { ascending: true }) // Deterministic tie-breaker
          .limit(1);

        if (findError) {
          console.error('[tripLogService] Error finding delivery trip by vehicle/date:', findError);
        } else if (deliveryTrips && deliveryTrips.length > 0) {
          deliveryTrip = deliveryTrips[0] as any;
          console.log('[tripLogService] Found delivery trip by vehicle/date for checkin:', {
            id: deliveryTrip.id,
            trip_number: deliveryTrip.trip_number,
            status: deliveryTrip.status,
            sequence_order: deliveryTrip.sequence_order,
            planned_date: deliveryTrip.planned_date,
          });
        } else {
          console.log('[tripLogService] No active delivery trip found for vehicle/date on checkin:', {
            vehicle_id: trip.vehicle_id,
            checkout_date: checkoutDate,
            trip_driver_id: trip.driver_id,
          });

          // Additional fallback: Try to find delivery trip even if status is 'planned' (not yet started)
          // This handles cases where the actual driver is different and trip wasn't linked during checkout
          if (!deliveryTrip) {
            const { data: fallbackTrips, error: fallbackError } = await supabase
              .from('delivery_trips')
              .select('id, status, odometer_start, odometer_end, trip_number, sequence_order, planned_date, created_at, driver_id')
              .eq('vehicle_id', trip.vehicle_id)
              .eq('planned_date', checkoutDate)
              .eq('status', 'planned') // Only check 'planned' status as fallback
              .order('sequence_order', { ascending: true, nullsFirst: false })
              .order('created_at', { ascending: true })
              .order('trip_number', { ascending: true })
              .limit(1);

            if (!fallbackError && fallbackTrips && fallbackTrips.length > 0) {
              deliveryTrip = fallbackTrips[0] as any;
              console.log('[tripLogService] Found delivery trip (planned status) as fallback for checkin:', {
                id: deliveryTrip.id,
                trip_number: deliveryTrip.trip_number,
                status: deliveryTrip.status,
                planned_driver_id: deliveryTrip.driver_id,
                actual_driver_id: trip.driver_id,
              });
            }
          }
        }
      }

      if (!deliveryTrip) {
        console.log(
          '[tripLogService] No delivery trip to update for this checkin. Trip may be non-delivery usage.',
          {
            vehicle_id: trip.vehicle_id,
            trip_id: trip.id,
          }
        );
      } else {
        console.log('[tripLogService] Updating delivery trip:', {
          id: deliveryTrip.id,
          trip_number: deliveryTrip.trip_number,
          current_status: deliveryTrip.status,
          new_status: 'completed',
          odometer_end: data.odometer_end,
        });

        // Update delivery trip to completed and set odometer_end
        // Also update driver_id to match the actual driver if different from planned driver
        const updateData: any = {
          status: 'completed',
          odometer_end: data.odometer_end,
          updated_at: new Date().toISOString(),
        };

        // Update driver_id if the actual driver is different from the planned driver
        if (trip.driver_id && deliveryTrip.driver_id && trip.driver_id !== deliveryTrip.driver_id) {
          updateData.driver_id = trip.driver_id;
          console.log('[tripLogService] Updating delivery trip driver_id to match actual driver:', {
            delivery_trip_id: deliveryTrip.id,
            planned_driver_id: deliveryTrip.driver_id,
            actual_driver_id: trip.driver_id,
          });
        }

        const { error: updateError } = await supabase
          .from('delivery_trips')
          .update(updateData)
          .eq('id', deliveryTrip.id);

        if (updateError) {
          console.error('[tripLogService] Error updating delivery trip status:', updateError);
          // Don't throw - continue with notification
        } else {
          console.log('[tripLogService] Successfully updated delivery trip to completed:', {
            id: deliveryTrip.id,
            trip_number: deliveryTrip.trip_number,
          });

          // Update all stores' delivery_status to 'delivered' when trip is completed
          // Update all stores regardless of current status (pending, failed, etc.)
          try {
            const { error: storesUpdateError } = await supabase
              .from('delivery_trip_stores')
              .update({
                delivery_status: 'delivered',
                delivered_at: new Date().toISOString(),
              })
              .eq('delivery_trip_id', deliveryTrip.id);
            // Removed .in('delivery_status', ['pending']) to update ALL stores in the trip

            if (storesUpdateError) {
              console.error('[tripLogService] Error updating store delivery status:', storesUpdateError);
            } else {
              console.log(
                '[tripLogService] Updated all stores to delivered status for trip:',
                deliveryTrip.id
              );
            }
          } catch (storesError) {
            console.error('[tripLogService] Error updating stores:', storesError);
            // Don't throw - continue with notification
          }

          // Trigger auto commission calculation for this delivery trip (fire-and-forget)
          try {
            console.log('[tripLogService] Invoking auto-commission-worker for completed trip:', {
              delivery_trip_id: deliveryTrip.id,
              trip_number: deliveryTrip.trip_number,
            });

            await supabase.functions.invoke('auto-commission-worker', {
              body: {
                source: 'trip_checkin',
                trip_id: deliveryTrip.id,
              },
            });
          } catch (commissionInvokeError) {
            console.warn(
              '[tripLogService] Failed to invoke auto-commission-worker. Commission will not be auto-calculated for this trip:',
              commissionInvokeError
            );
            // ไม่ throw ต่อ เพื่อไม่ให้กระทบ UX การเช็คอิน
          }
        }

        // Update trip log with delivery_trip_id if not already set
        if (result && !result.delivery_trip_id) {
          try {
            const { error: linkError } = await supabase
              .from('trip_logs')
              .update({ delivery_trip_id: deliveryTrip.id })
              .eq('id', result.id);

            if (linkError) {
              console.error('[tripLogService] Error linking delivery trip to trip log:', linkError);
            } else {
              console.log('[tripLogService] Linked delivery trip to trip log:', deliveryTrip.id);
            }
          } catch (linkError) {
            console.error('[tripLogService] Error linking delivery trip:', linkError);
          }
        }
      }
    } catch (deliveryTripError) {
      console.error('[tripLogService] Error updating delivery trip:', deliveryTripError);
      // Don't throw - continue with notification
    }

    // Create notification event for trip finished (vehicle checkin)
    try {
      // Enrich with vehicle & driver info for nicer notification message
      const { data: tripWithRelations } = await supabase
        .from('trip_logs')
        .select(`
          *,
          vehicle:vehicles(plate, make, model),
          driver:profiles(full_name),
          delivery_trip:delivery_trips(id, trip_number, status)
        `)
        .eq('id', result.id)
        .maybeSingle();

      const vehicle = (tripWithRelations as any)?.vehicle as {
        plate?: string;
        make?: string | null;
        model?: string | null;
      } | null;
      const driver = (tripWithRelations as any)?.driver as {
        full_name?: string;
      } | null;

      const plate = vehicle?.plate || result.vehicle_id;
      const vehicleLabel = vehicle?.make && vehicle?.model
        ? `${plate} (${vehicle.make} ${vehicle.model})`
        : plate;

      const driverName = driver?.full_name || 'ไม่ทราบชื่อผู้ขับ';

      const checkoutDate = new Date(trip.checkout_time);
      const checkinDate = new Date(result.checkin_time || new Date().toISOString());

      const checkoutAt = checkoutDate.toLocaleString('th-TH', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });

      const checkinAt = checkinDate.toLocaleString('th-TH', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });

      const destination = result.destination || trip.destination || 'ไม่ระบุ';
      const route = result.route || trip.route;

      // Calculate distance based on mode
      const isManualMode = result.manual_distance_km !== null;
      const distance = isManualMode
        ? result.manual_distance_km!
        : (result.odometer_end && trip.odometer_start ? result.odometer_end - trip.odometer_start : 0);

      // คำนวณระยะเวลาเดินทาง
      const diffMs = checkinDate.getTime() - checkoutDate.getTime();
      const totalMinutes = Math.max(0, Math.round(diffMs / 1000 / 60));
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      const durationLabel =
        hours > 0
          ? `${hours} ชม. ${minutes} นาที`
          : `${minutes} นาที`;

      const notes = result.notes || trip.notes || data.notes;

      const messageLines = [
        `✅ [รถกลับจากการใช้งาน]${data.is_backfill ? ' ⏪ (ลงย้อนหลัง)' : ''}`,
        `🚗 รถ: ${vehicleLabel}`,
        `🧑‍✈️ คนขับ: ${driverName}`,
        `📍 ปลายทาง: ${destination}`,
        route ? `🗺️ เส้นทาง: ${route}` : undefined,
        `⏰ เวลาออก: ${checkoutAt}`,
        `⏱️ เวลากลับ: ${checkinAt}`,
        // Show odometer info only if not in manual mode
        !isManualMode && trip.odometer_start ? `📏 เลขไมล์ออก: ${trip.odometer_start.toLocaleString()} km` : undefined,
        !isManualMode && result.odometer_end ? `📏 เลขไมล์กลับ: ${result.odometer_end.toLocaleString()} km` : undefined,
        `🚘 ระยะทางรวม: ${distance.toLocaleString()} km${isManualMode ? ' (ระบุเอง - เลขไมล์เสีย)' : ''}`,
        `⏳ ระยะเวลาเดินทาง: ${durationLabel}`,
        notes ? `📝 หมายเหตุ: ${notes}` : undefined,
      ].filter(Boolean);

      const message = messageLines.join('\n');

      console.log('[tripLogService] Creating trip_finished notification event', {
        trip_id: result.id,
        vehicle_id: result.vehicle_id,
      });

      const baseEvent = {
        event_type: 'trip_finished' as const,
        title: 'รถกลับจากการใช้งาน',
        message,
        payload: {
          trip_id: result.id,
          vehicle_id: result.vehicle_id,
          odometer_start: trip.odometer_start,
          odometer_end: result.odometer_end,
          checkout_time: trip.checkout_time,
          checkin_time: result.checkin_time,
        },
      };

      // Telegram (กลุ่มกลาง)
      await notificationService.createEvent(
        {
          channel: 'telegram',
          ...baseEvent,
        },
        user.id,
      );

      // LINE (กลุ่มกลาง)
      await notificationService.createEvent(
        {
          channel: 'line',
          ...baseEvent,
        },
        user.id,
      );
    } catch (notifyError) {
      console.error('[tripLogService] Failed to create notification event for trip_finished:', notifyError);
      // ไม่ throw ต่อ เพื่อไม่ให้กระทบการบันทึกทริป
    }

    return result;
  },

  // Update trip log (with admin-only odometer editing)
  updateTripLog: async (tripId: string, updates: TripLogUpdateData): Promise<TripLog> => {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      throw new Error('User not authenticated');
    }

    // Validate edit_reason
    if (!updates.edit_reason || !updates.edit_reason.trim()) {
      throw new Error('กรุณาระบุเหตุผลในการแก้ไขข้อมูลทริป');
    }

    // Get user profile to check role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, full_name')
      .eq('id', user.id)
      .single();

    // Get the current trip data to validate status and save old values
    const { data: trip, error: fetchError } = await supabase
      .from('trip_logs')
      .select('*')
      .eq('id', tripId)
      .single();

    if (fetchError) throw fetchError;
    if (!trip) throw new Error('Trip not found');
    if (trip.status !== 'checked_in') {
      throw new Error('เฉพาะ Trip ที่บันทึกการกลับแล้วเท่านั้นที่สามารถแก้ไขได้');
    }

    // Prepare updates - remove odometer fields if not admin
    const allowedUpdates = { ...updates };
    if (profile?.role !== 'admin') {
      delete allowedUpdates.odometer_start;
      delete allowedUpdates.odometer_end;
    }

    // Prepare old and new values for audit log
    const oldValues: Record<string, any> = {};
    const newValues: Record<string, any> = {};

    // Track which fields are being changed
    const fieldsToTrack = ['destination', 'route', 'notes', 'odometer_start', 'odometer_end'];
    fieldsToTrack.forEach(field => {
      if (field in allowedUpdates && allowedUpdates[field as keyof typeof allowedUpdates] !== undefined) {
        oldValues[field] = trip[field as keyof typeof trip];
        newValues[field] = allowedUpdates[field as keyof typeof allowedUpdates];
      }
    });

    // Update trip log
    const { data: result, error } = await supabase
      .from('trip_logs')
      .update({
        destination: allowedUpdates.destination,
        route: allowedUpdates.route,
        notes: allowedUpdates.notes,
        odometer_start: allowedUpdates.odometer_start,
        odometer_end: allowedUpdates.odometer_end,
        edit_reason: updates.edit_reason,
        updated_at: new Date().toISOString(),
      })
      .eq('id', tripId)
      .select()
      .single();

    if (error) {
      console.error('[tripLogService] Error updating trip log:', error);
      throw error;
    }

    // Save audit log
    try {
      const { error: auditError } = await supabase
        .from('trip_edit_history')
        .insert({
          trip_log_id: tripId,
          delivery_trip_id: null,
          edited_by: user.id,
          edit_reason: updates.edit_reason,
          changes: {
            old_values: oldValues,
            new_values: newValues,
          },
          edited_at: new Date().toISOString(),
        });

      if (auditError) {
        console.error('[tripLogService] Error saving audit log:', auditError);
        // Don't throw - audit log failure shouldn't block the update
      }
    } catch (auditError) {
      console.error('[tripLogService] Error saving audit log:', auditError);
    }

    return result;
  },

  // Get trip log by ID
  getById: async (tripId: string): Promise<TripLogWithRelations | null> => {
    const { data, error } = await supabase
      .from('trip_logs')
      .select(`
        *,
        vehicle:vehicles(plate, make, model, image_url),
        driver:profiles(full_name, email, avatar_url),
        delivery_trip:delivery_trips(id, trip_number, status)
      `)
      .eq('id', tripId)
      .single();

    if (error) {
      console.error('[tripLogService] Error fetching trip by ID:', error);
      throw error;
    }

    return data as TripLogWithRelations;
  },

  // Get trip edit history (audit log)
  getTripEditHistory: async (tripId: string): Promise<TripEditHistory[]> => {
    const { data, error } = await supabase
      .from('trip_edit_history')
      .select(`
        *,
        editor:profiles!edited_by(full_name, email)
      `)
      .eq('trip_log_id', tripId)
      .order('edited_at', { ascending: false });

    if (error) {
      console.error('[tripLogService] Error fetching trip edit history:', error);
      throw error;
    }

    return (data || []) as TripEditHistory[];
  },

  // Get active trips by vehicle (trips that are checked out but not checked in)
  getActiveTripsByVehicle: async (vehicleId?: string): Promise<TripLogWithRelations[]> => {
    let query = supabase
      .from('trip_logs')
      .select(`
        *,
        vehicle:vehicles(plate, make, model, image_url),
        driver:profiles(full_name, email, avatar_url),
        delivery_trip:delivery_trips(id, trip_number, status)
      `)
      .eq('status', 'checked_out')
      .order('checkout_time', { ascending: false });

    if (vehicleId) {
      query = query.eq('vehicle_id', vehicleId);
    }

    const { data, error } = await query;

    return (data || []) as TripLogWithRelations[];
  },

  // Get trip history with pagination
  getTripHistory: async (filters?: {
    vehicle_id?: string;
    driver_id?: string;
    start_date?: string;
    end_date?: string;
    status?: 'checked_out' | 'checked_in';
    limit?: number;
    offset?: number;
    search?: string; // For text search
  }): Promise<{ data: TripLogWithRelations[]; count: number }> => {
    const limit = filters?.limit || 100;
    const offset = filters?.offset || 0;

    // ========================================
    // Pre-search: Find delivery_trip_ids that match search term
    // ========================================
    let matchingDeliveryTripIds: string[] | null = null;
    if (filters?.search) {
      const searchPattern = `%${filters.search}%`;
      const { data: matchingTrips } = await supabase
        .from('delivery_trips')
        .select('id')
        .ilike('trip_number', searchPattern);

      if (matchingTrips && matchingTrips.length > 0) {
        matchingDeliveryTripIds = matchingTrips.map(t => t.id);
        console.log('[tripLogService] Found matching delivery trips:', matchingDeliveryTripIds.length);
      }
    }

    let query = supabase
      .from('trip_logs')
      .select(`
        *,
        vehicle:vehicles(plate, make, model, image_url),
        driver:profiles(full_name, email, avatar_url),
        delivery_trip:delivery_trips(id, trip_number, status)
      `, { count: 'exact' })
      .order('checkout_time', { ascending: false });

    if (filters?.vehicle_id) {
      query = query.eq('vehicle_id', filters.vehicle_id);
    }

    if (filters?.driver_id) {
      query = query.eq('driver_id', filters.driver_id);
    }

    if (filters?.start_date) {
      query = query.gte('checkout_time', filters.start_date);
    }

    if (filters?.end_date) {
      query = query.lte('checkout_time', filters.end_date);
    }

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }

    // Database-level text search
    // Search in trip_logs table fields AND delivery_trip_id (from pre-search)
    if (filters?.search) {
      const searchPattern = `%${filters.search}%`;

      // Build OR conditions for database-level search
      const orConditions: string[] = [
        `destination.ilike.${searchPattern}`,
        `route.ilike.${searchPattern}`,
        `notes.ilike.${searchPattern}`,
      ];

      // Add delivery_trip_id filter if we found matching trip numbers
      if (matchingDeliveryTripIds && matchingDeliveryTripIds.length > 0) {
        // Supabase OR syntax: field.in.(value1,value2,...)
        orConditions.push(`delivery_trip_id.in.(${matchingDeliveryTripIds.join(',')})`);
      }

      console.log('[tripLogService] Search OR conditions:', orConditions.join(','));
      query = query.or(orConditions.join(','));
    }

    // Apply pagination AFTER all filters
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error('[tripLogService] Error fetching trip history:', error);
      throw error;
    }

    let results = (data || []) as TripLogWithRelations[];

    // Apply additional client-side text search filter for related fields (vehicle plate, driver name)
    // that cannot be easily filtered at database level
    if (filters?.search) {
      const searchLower = filters.search.toLowerCase();
      results = results.filter(trip =>
        trip.vehicle?.plate?.toLowerCase().includes(searchLower) ||
        trip.driver?.full_name?.toLowerCase().includes(searchLower) ||
        // delivery_trip.trip_number is already filtered at DB level, but keep for safety
        trip.delivery_trip?.trip_number?.toLowerCase().includes(searchLower) ||
        // destination, route, notes are already filtered at DB level
        trip.destination?.toLowerCase().includes(searchLower) ||
        trip.route?.toLowerCase().includes(searchLower)
      );
    }

    return {
      data: results,
      count: count || 0, // Note: count may not be fully accurate with client-side filtering
    };
  },


  // Get last odometer reading for a vehicle
  getLastOdometer: async (vehicleId: string): Promise<number | null> => {
    // Get last known odometer reading
    const [fuelResult, tripCheckinResult, tripCheckoutResult] = await Promise.all([
      // From fuel records
      supabase
        .from('fuel_records')
        .select('odometer')
        .eq('vehicle_id', vehicleId)
        .order('filled_at', { ascending: false })
        .limit(1)
        .maybeSingle(),

      // From trip logs - get checked-in trips (where odometer_end is not null) - PRIORITY
      supabase
        .from('trip_logs')
        .select('odometer_end')
        .eq('vehicle_id', vehicleId)
        .not('odometer_end', 'is', null)
        .order('checkin_time', { ascending: false })
        .limit(1)
        .maybeSingle(),

      // From trip logs - get checked-out trips (odometer_start) - FALLBACK if no checkin
      supabase
        .from('trip_logs')
        .select('odometer_start')
        .eq('vehicle_id', vehicleId)
        .eq('status', 'checked_out')
        .order('checkout_time', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    // Handle errors gracefully - if query fails, just ignore that source
    const lastFuelOdometer = fuelResult.error ? null : fuelResult.data?.odometer;
    const lastTripCheckinOdometer = tripCheckinResult.error ? null : tripCheckinResult.data?.odometer_end;
    const lastTripCheckoutOdometer = tripCheckoutResult.error ? null : tripCheckoutResult.data?.odometer_start;

    // Priority: checkin (odometer_end) > checkout (odometer_start) > fuel records
    const lastTripOdometer = lastTripCheckinOdometer || lastTripCheckoutOdometer;

    const lastOdometer = Math.max(
      lastFuelOdometer || 0,
      lastTripOdometer || 0
    );

    return lastOdometer > 0 ? lastOdometer : null;
  },

  // Validate odometer reading
  validateOdometer: async (vehicleId: string, odometer: number): Promise<{
    valid: boolean;
    lastOdometer?: number;
    warning?: string;
  }> => {
    // Get last known odometer reading
    const [fuelResult, tripCheckinResult, tripCheckoutResult] = await Promise.all([
      // From fuel records
      supabase
        .from('fuel_records')
        .select('odometer')
        .eq('vehicle_id', vehicleId)
        .order('filled_at', { ascending: false })
        .limit(1)
        .maybeSingle(),

      // From trip logs - get checked-in trips (where odometer_end is not null) - PRIORITY
      supabase
        .from('trip_logs')
        .select('odometer_end')
        .eq('vehicle_id', vehicleId)
        .not('odometer_end', 'is', null)
        .order('checkin_time', { ascending: false })
        .limit(1)
        .maybeSingle(),

      // From trip logs - get checked-out trips (odometer_start) - FALLBACK if no checkin
      supabase
        .from('trip_logs')
        .select('odometer_start')
        .eq('vehicle_id', vehicleId)
        .eq('status', 'checked_out')
        .order('checkout_time', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    // Handle errors gracefully - if query fails, just ignore that source
    const lastFuelOdometer = fuelResult.error ? null : fuelResult.data?.odometer;
    const lastTripCheckinOdometer = tripCheckinResult.error ? null : tripCheckinResult.data?.odometer_end;
    const lastTripCheckoutOdometer = tripCheckoutResult.error ? null : tripCheckoutResult.data?.odometer_start;

    // Priority: checkin (odometer_end) > checkout (odometer_start) > fuel records
    const lastTripOdometer = lastTripCheckinOdometer || lastTripCheckoutOdometer;

    const lastOdometer = Math.max(
      lastFuelOdometer || 0,
      lastTripOdometer || 0
    );

    if (odometer < lastOdometer) {
      return {
        valid: false,
        lastOdometer,
        warning: `เลขไมล์ (${odometer.toLocaleString()}) น้อยกว่าเลขไมล์ล่าสุด (${lastOdometer.toLocaleString()}) กรุณาตรวจสอบ`,
      };
    }

    if (odometer > lastOdometer + 10000) {
      return {
        valid: true,
        lastOdometer,
        warning: `เลขไมล์ (${odometer.toLocaleString()}) สูงกว่าเลขไมล์ล่าสุดมาก (${lastOdometer.toLocaleString()}) กรุณาตรวจสอบ`,
      };
    }

    return {
      valid: true,
      lastOdometer: lastOdometer || undefined,
    };
  },

  // Get trips that have been checked out for more than 12 hours
  getOverdueTrips: async (): Promise<TripLogWithRelations[]> => {
    const twelveHoursAgo = new Date();
    twelveHoursAgo.setHours(twelveHoursAgo.getHours() - 12);

    const { data, error } = await supabase
      .from('trip_logs')
      .select(`
        *,
        vehicle:vehicles(plate, make, model, image_url),
        driver:profiles(full_name, email, avatar_url),
        delivery_trip:delivery_trips(id, trip_number, status)
      `)
      .eq('status', 'checked_out')
      .lt('checkout_time', twelveHoursAgo.toISOString())
      .order('checkout_time', { ascending: true });

    if (error) {
      console.error('[tripLogService] Error fetching overdue trips:', error);
      throw error;
    }

    return (data || []) as TripLogWithRelations[];
  },

  // Cancel a trip (set status to 'cancelled')
  cancelTrip: async (tripId: string, reason?: string): Promise<TripLog> => {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      throw new Error('User not authenticated');
    }

    // Get the trip to validate
    const { data: trip, error: fetchError } = await supabase
      .from('trip_logs')
      .select('*')
      .eq('id', tripId)
      .single();

    if (fetchError) {
      throw fetchError;
    }

    if (!trip) {
      throw new Error('Trip not found');
    }

    // Only allow cancelling checked_out trips
    if (trip.status !== 'checked_out') {
      throw new Error(`Cannot cancel trip with status: ${trip.status}. Only 'checked_out' trips can be cancelled.`);
    }

    // Update trip status to cancelled
    const updateData: TripLogUpdate = {
      status: 'cancelled',
      notes: reason ? `${trip.notes || ''}\n[ยกเลิก] ${reason}`.trim() : trip.notes,
    };

    const { data: result, error } = await supabase
      .from('trip_logs')
      .update(updateData)
      .eq('id', tripId)
      .select()
      .single();

    if (error) {
      console.error('[tripLogService] Error cancelling trip:', error);
      throw error;
    }

    // If trip was linked to a delivery trip, update delivery trip status
    if (trip.delivery_trip_id) {
      try {
        const { error: deliveryTripError } = await supabase
          .from('delivery_trips')
          .update({
            status: 'planned', // Reset to planned so it can be used again
            updated_at: new Date().toISOString(),
          })
          .eq('id', trip.delivery_trip_id);

        if (deliveryTripError) {
          console.error('[tripLogService] Error updating delivery trip status:', deliveryTripError);
          // Don't throw - continue with notification
        } else {
          console.log('[tripLogService] Updated delivery trip to planned:', trip.delivery_trip_id);
        }
      } catch (deliveryTripError) {
        console.error('[tripLogService] Error updating delivery trip:', deliveryTripError);
        // Don't throw - continue with notification
      }
    }

    // Create notification event for trip cancelled
    try {
      const { data: tripWithRelations } = await supabase
        .from('trip_logs')
        .select(`
          *,
          vehicle:vehicles(plate, make, model),
          driver:profiles(full_name),
          delivery_trip:delivery_trips(id, trip_number, status)
        `)
        .eq('id', result.id)
        .maybeSingle();

      const vehicle = (tripWithRelations as any)?.vehicle as {
        plate?: string;
        make?: string | null;
        model?: string | null;
      } | null;
      const driver = (tripWithRelations as any)?.driver as {
        full_name?: string;
      } | null;

      const plate = vehicle?.plate || result.vehicle_id;
      const vehicleLabel = vehicle?.make && vehicle?.model
        ? `${plate} (${vehicle.make} ${vehicle.model})`
        : plate;

      const driverName = driver?.full_name || 'ไม่ทราบชื่อผู้ขับ';

      const checkoutDate = new Date(trip.checkout_time);
      const checkoutAt = checkoutDate.toLocaleString('th-TH', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });

      const messageLines = [
        `❌ [ยกเลิกการเดินทาง]`,
        `🚗 รถ: ${vehicleLabel}`,
        `🧑‍✈️ คนขับ: ${driverName}`,
        `⏰ เวลาออก: ${checkoutAt}`,
        `📏 เลขไมล์เริ่มต้น: ${trip.odometer_start?.toLocaleString() ?? 'N/A'} km`,
        reason ? `📝 เหตุผล: ${reason}` : undefined,
      ].filter(Boolean);

      const message = messageLines.join('\n');

      const baseEvent = {
        event_type: 'trip_cancelled' as const,
        title: 'ยกเลิกการเดินทาง',
        message,
        payload: {
          trip_id: result.id,
          vehicle_id: result.vehicle_id,
          odometer_start: trip.odometer_start,
          checkout_time: trip.checkout_time,
          reason: reason || null,
        },
      };

      // Telegram (กลุ่มกลาง)
      await notificationService.createEvent(
        {
          channel: 'telegram',
          ...baseEvent,
        },
        user.id,
      );

      // LINE (กลุ่มกลาง)
      await notificationService.createEvent(
        {
          channel: 'line',
          ...baseEvent,
        },
        user.id,
      );
    } catch (notifyError) {
      console.error('[tripLogService] Failed to create notification event for trip_cancelled:', notifyError);
      // ไม่ throw ต่อ เพื่อไม่ให้กระทบการยกเลิกทริป
    }

    return result;
  },

  // Admin-only: Hard delete a trip log with audit reason
  // ใช้สำหรับลบทริปที่ลงผิดจริง ๆ (เช่น ผูกกับทริปที่ถูกลบไปแล้ว) โดยต้องเป็น Admin/Manager/Executive เท่านั้น
  deleteTrip: async (tripId: string, reason: string): Promise<void> => {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      throw new Error('User not authenticated');
    }

    if (!reason || !reason.trim()) {
      throw new Error('กรุณาระบุเหตุผลในการลบทริป');
    }

    // Load profile to check role
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role, full_name')
      .eq('id', user.id)
      .single();

    if (profileError) {
      console.error('[tripLogService] Error loading profile for deleteTrip:', profileError);
      throw profileError;
    }

    const allowedRoles = ['admin', 'manager', 'executive'];
    if (!profile || !allowedRoles.includes(profile.role as string)) {
      throw new Error('คุณไม่มีสิทธิ์ลบข้อมูลทริป');
    }

    // Load trip to validate current state
    const { data: trip, error: fetchError } = await supabase
      .from('trip_logs')
      .select('*')
      .eq('id', tripId)
      .single();

    if (fetchError) {
      throw fetchError;
    }

    if (!trip) {
      throw new Error('Trip not found');
    }

    // Safety guard: ไม่ให้ลบทริปที่ยังผูกกับ delivery_trip อยู่
    // ให้ผู้ใช้ไปแก้/ย้ายลิงก์ก่อน แล้วค่อยลบทริป
    if ((trip as any).delivery_trip_id) {
      throw new Error('ไม่สามารถลบทริปที่เชื่อมกับทริปส่งของได้ กรุณาย้าย/แก้ไขการเชื่อมต่อก่อน');
    }

    // Optional: Save audit log of deletion into trip_edit_history (ถ้ามีตารางนี้)
    try {
      const oldValues: Record<string, any> = { ...trip };
      const newValues: Record<string, any> = { deleted: true };

      const { error: auditError } = await supabase
        .from('trip_edit_history')
        .insert({
          trip_log_id: tripId,
          delivery_trip_id: null,
          edited_by: user.id,
          edit_reason: reason,
          changes: {
            old_values: oldValues,
            new_values: newValues,
          },
          edited_at: new Date().toISOString(),
        });

      if (auditError) {
        console.warn('[tripLogService] Failed to write delete audit log (trip_edit_history):', auditError);
      }
    } catch (auditErr) {
      console.warn('[tripLogService] Unexpected error while writing delete audit log:', auditErr);
    }

    const { error: deleteError } = await supabase
      .from('trip_logs')
      .delete()
      .eq('id', tripId);

    if (deleteError) {
      console.error('[tripLogService] Error deleting trip:', deleteError);
      throw deleteError;
    }
  },
};

