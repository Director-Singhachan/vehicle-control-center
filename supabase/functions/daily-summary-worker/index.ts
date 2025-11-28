// Supabase Edge Function: daily-summary-worker
// สรุปการใช้รถรายวันและส่งไป Telegram group
// ควรเรียกทุกวันเวลา 23:00 หรือ 00:00 ของวันถัดไป

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get date from query parameter or use yesterday (default)
    // เพราะสรุปของวันนี้ควรส่งตอนเช้าวันถัดไป
    const url = new URL(req.url);
    const dateParam = url.searchParams.get('date');
    let targetDate: string;

    if (dateParam) {
      targetDate = dateParam; // YYYY-MM-DD
    } else {
      // Default: สรุปของเมื่อวาน (เพราะเรียกตอนเช้าวันนี้)
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      targetDate = yesterday.toISOString().split('T')[0];
    }

    console.log(`[daily-summary-worker] Generating summary for date: ${targetDate}`);

    // ดึงข้อมูลทริปที่ check-in แล้วในวันที่กำหนด
    const startOfDay = `${targetDate}T00:00:00.000Z`;
    const endOfDay = `${targetDate}T23:59:59.999Z`;

    const { data: trips, error: tripsError } = await supabase
      .from('trip_logs')
      .select(`
        id,
        vehicle_id,
        driver_id,
        odometer_start,
        odometer_end,
        checkout_time,
        checkin_time,
        status,
        vehicle:vehicles!trip_logs_vehicle_id_fkey(
          id,
          plate,
          make,
          model
        ),
        driver:profiles!trip_logs_driver_id_fkey(
          id,
          full_name
        )
      `)
      .eq('status', 'checked_in')
      .gte('checkout_time', startOfDay)
      .lte('checkout_time', endOfDay)
      .order('checkout_time', { ascending: true });

    if (tripsError) {
      console.error('[daily-summary-worker] Error fetching trips:', tripsError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch trips', details: tripsError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!trips || trips.length === 0) {
      console.log(`[daily-summary-worker] No trips found for ${targetDate}`);
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No trips found for the date',
          date: targetDate,
          summary: null
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // จัดกลุ่มตาม vehicle_id
    const vehicleMap = new Map<string, {
      vehicle_id: string;
      vehicle_plate: string;
      vehicle_make?: string | null;
      vehicle_model?: string | null;
      trip_count: number;
      total_distance_km: number;
    }>();

    for (const trip of trips) {
      const vehicle = (trip as any).vehicle as {
        id: string;
        plate: string;
        make?: string | null;
        model?: string | null;
      } | null;

      if (!vehicle) continue;

      const vehicleId = vehicle.id;
      const distance = trip.odometer_end && trip.odometer_start
        ? trip.odometer_end - trip.odometer_start
        : 0;

      if (vehicleMap.has(vehicleId)) {
        const existing = vehicleMap.get(vehicleId)!;
        existing.trip_count += 1;
        existing.total_distance_km += distance;
      } else {
        vehicleMap.set(vehicleId, {
          vehicle_id: vehicleId,
          vehicle_plate: vehicle.plate,
          vehicle_make: vehicle.make,
          vehicle_model: vehicle.model,
          trip_count: 1,
          total_distance_km: distance,
        });
      }
    }

    const vehicles = Array.from(vehicleMap.values());
    const total_trips = trips.length;
    const total_distance_km = Math.round(
      vehicles.reduce((sum, v) => sum + v.total_distance_km, 0) * 100
    ) / 100;

    // สร้างข้อความสรุป
    const date = new Date(targetDate);
    const dateStr = date.toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long',
    });

    let message = `📊 *สรุปการใช้รถรายวัน*\n\n`;
    message += `📅 วันที่: ${dateStr}\n\n`;
    message += `📈 *ภาพรวม:*\n`;
    message += `🚗 จำนวนรถที่ใช้งาน: ${vehicles.length} คัน\n`;
    message += `🔄 จำนวนทริปทั้งหมด: ${total_trips} ทริป\n`;
    message += `📏 ระยะทางรวม: ${total_distance_km.toLocaleString('th-TH')} กิโลเมตร\n\n`;

    if (vehicles.length > 0) {
      message += `🚙 *รายละเอียดตามรถ:*\n\n`;
      
      // เรียงตามระยะทางมากไปน้อย
      const sortedVehicles = [...vehicles].sort(
        (a, b) => b.total_distance_km - a.total_distance_km
      );

      for (const vehicle of sortedVehicles) {
        const vehicleLabel = vehicle.vehicle_make && vehicle.vehicle_model
          ? `${vehicle.vehicle_plate} (${vehicle.vehicle_make} ${vehicle.vehicle_model})`
          : vehicle.vehicle_plate;
        
        const roundedDistance = Math.round(vehicle.total_distance_km * 100) / 100;
        
        message += `🚗 *${vehicleLabel}*\n`;
        message += `   🔄 ${vehicle.trip_count} ทริป\n`;
        message += `   📏 ${roundedDistance.toLocaleString('th-TH')} กิโลเมตร\n\n`;
      }
    }

    // ส่งไป Telegram group
    const telegramBotToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
    const groupChatId = Deno.env.get('TELEGRAM_MAINTENANCE_GROUP_CHAT_ID') ||
                       Deno.env.get('TELEGRAM_GROUP_CHAT_ID') ||
                       Deno.env.get('TELEGRAM_CHAT_ID');

    if (!telegramBotToken || !groupChatId) {
      console.warn('[daily-summary-worker] Telegram bot token or group chat ID not configured');
      return new Response(
        JSON.stringify({ 
          error: 'Telegram not configured',
          summary: {
            date: targetDate,
            total_vehicles: vehicles.length,
            total_trips,
            total_distance_km,
            vehicles: vehicles.map(v => ({
              ...v,
              total_distance_km: Math.round(v.total_distance_km * 100) / 100,
            })),
          },
          message
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ส่งข้อความไป Telegram
    const telegramResponse = await fetch(
      `https://api.telegram.org/bot${telegramBotToken}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: groupChatId,
          text: message,
          parse_mode: 'Markdown',
        }),
      }
    );

    if (!telegramResponse.ok) {
      const errorText = await telegramResponse.text();
      console.error('[daily-summary-worker] Error sending to Telegram:', errorText);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to send to Telegram',
          details: errorText,
          summary: {
            date: targetDate,
            total_vehicles: vehicles.length,
            total_trips,
            total_distance_km,
            vehicles: vehicles.map(v => ({
              ...v,
              total_distance_km: Math.round(v.total_distance_km * 100) / 100,
            })),
          },
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[daily-summary-worker] Successfully sent daily summary for ${targetDate}`);

    return new Response(
      JSON.stringify({
        success: true,
        date: targetDate,
        summary: {
          total_vehicles: vehicles.length,
          total_trips,
          total_distance_km,
          vehicles: vehicles.map(v => ({
            vehicle_plate: v.vehicle_plate,
            trip_count: v.trip_count,
            total_distance_km: Math.round(v.total_distance_km * 100) / 100,
          })),
        },
        message_sent: true,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[daily-summary-worker] Unexpected error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

