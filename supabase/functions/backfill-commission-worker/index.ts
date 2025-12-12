// Supabase Edge Function: backfill-commission-worker
// ใช้สำหรับรันคำนวณค่าคอมมิชชั่นย้อนหลังให้กับทริปที่ปิดงานแล้ว (status = 'completed')
// เพื่อเติมข้อมูลลงในตาราง commission_logs สำหรับทริปเก่าที่ไม่เคยถูกคำนวณมาก่อน
//
// การทำงาน:
// - เลือก delivery_trips ที่ status = 'completed' ตามช่วงวันที่ (optional)
// - ดูว่าทริปไหนยังไม่มี commission_logs
// - เรียกฟังก์ชัน auto-commission-worker ทีละทริปเพื่อคำนวณและบันทึกค่าคอมอัตโนมัติ
//
// วิธีเรียก (ตัวอย่าง HTTP POST):
// POST /functions/v1/backfill-commission-worker
// {
//   "from": "2025-01-01",   // optional, YYYY-MM-DD
//   "to": "2025-12-31",     // optional, YYYY-MM-DD
//   "limit": 200,           // optional, จำกัดจำนวนทริปต่อการรัน  (default 100)
//   "dryRun": false         // optional, true = แค่ดูว่าจะทำกับทริปไหน แต่ไม่เรียกคำนวณจริง
// }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

type DeliveryTripRow = {
  id: string;
  trip_number: string;
  planned_date: string;
  status: string;
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json().catch(() => ({}));
    const from: string | undefined = body.from;
    const to: string | undefined = body.to;
    const limit: number = typeof body.limit === 'number' && body.limit > 0 ? body.limit : 100;
    const dryRun: boolean = !!body.dryRun;

    console.log('[backfill-commission-worker] Start', { from, to, limit, dryRun });

    // 1) ดึงทริปที่ปิดแล้ว (completed) ตามช่วงวันที่
    let tripsQuery = supabase
      .from('delivery_trips')
      .select('id, trip_number, planned_date, status')
      .eq('status', 'completed')
      .order('planned_date', { ascending: true })
      .limit(limit);

    if (from) {
      tripsQuery = tripsQuery.gte('planned_date', from);
    }
    if (to) {
      tripsQuery = tripsQuery.lte('planned_date', to);
    }

    const { data: completedTrips, error: tripsError } = await tripsQuery;

    if (tripsError) {
      console.error('[backfill-commission-worker] Error fetching completed trips:', tripsError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch completed trips' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (!completedTrips || completedTrips.length === 0) {
      console.log('[backfill-commission-worker] No completed trips found for given range.');
      return new Response(
        JSON.stringify({
          success: true,
          processed: 0,
          totalCandidates: 0,
          message: 'No completed trips found for the given parameters.',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const tripIds = (completedTrips as DeliveryTripRow[]).map((t) => t.id);

    // 2) ดูว่าทริปไหนมี commission_logs อยู่แล้วบ้าง
    const { data: existingLogs, error: logsError } = await supabase
      .from('commission_logs')
      .select('delivery_trip_id')
      .in('delivery_trip_id', tripIds);

    if (logsError) {
      console.error('[backfill-commission-worker] Error fetching commission_logs:', logsError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch commission logs' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const tripsWithLogs = new Set<string>(
      (existingLogs || []).map((row) => (row as any).delivery_trip_id as string),
    );

    const targetTrips = (completedTrips as DeliveryTripRow[]).filter(
      (trip) => !tripsWithLogs.has(trip.id),
    );

    if (targetTrips.length === 0) {
      console.log('[backfill-commission-worker] All completed trips already have commission logs.');
      return new Response(
        JSON.stringify({
          success: true,
          processed: 0,
          totalCandidates: completedTrips.length,
          message: 'All completed trips already have commission logs.',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    console.log('[backfill-commission-worker] Trips to process (without logs):', targetTrips.length);

    if (dryRun) {
      // แค่รายงานว่าถ้ารันจริง จะประมวลผลทริปไหนบ้าง
      return new Response(
        JSON.stringify({
          success: true,
          dryRun: true,
          totalCompletedTrips: completedTrips.length,
          tripsWithoutLogs: targetTrips.length,
          sampleTrips: targetTrips.slice(0, 20), // ส่งตัวอย่างไม่เกิน 20 ทริป
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // 3) เรียก auto-commission-worker ทีละทริป
    const autoCommissionUrl = `${supabaseUrl}/functions/v1/auto-commission-worker`;

    const results: Array<{
      tripId: string;
      ok: boolean;
      status: number;
      reason?: string;
    }> = [];

    for (const trip of targetTrips) {
      try {
        console.log('[backfill-commission-worker] Calling auto-commission-worker for trip:', {
          id: trip.id,
          trip_number: trip.trip_number,
          planned_date: trip.planned_date,
        });

        const resp = await fetch(autoCommissionUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: supabaseServiceKey,
            Authorization: `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({
            trip_id: trip.id,
            source: 'backfill',
          }),
        });

        const data = await resp.json().catch(() => null);

        if (!resp.ok || data?.success === false) {
          console.warn('[backfill-commission-worker] auto-commission-worker returned non-success:', {
            tripId: trip.id,
            status: resp.status,
            body: data,
          });
          results.push({
            tripId: trip.id,
            ok: false,
            status: resp.status,
            reason: data?.reason || data?.message || 'unknown',
          });
        } else {
          results.push({
            tripId: trip.id,
            ok: true,
            status: resp.status,
          });
        }
      } catch (err) {
        console.error('[backfill-commission-worker] Error calling auto-commission-worker:', {
          tripId: trip.id,
          error: `${err}`,
        });
        results.push({
          tripId: trip.id,
          ok: false,
          status: 0,
          reason: 'exception',
        });
      }
    }

    const successCount = results.filter((r) => r.ok).length;
    const failed = results.filter((r) => !r.ok);

    console.log('[backfill-commission-worker] Done backfill', {
      processed: results.length,
      successCount,
      failedCount: failed.length,
    });

    return new Response(
      JSON.stringify({
        success: true,
        processed: results.length,
        successCount,
        failedCount: failed.length,
        totalCompletedTrips: completedTrips.length,
        tripsWithoutLogs: targetTrips.length,
        failed,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('[backfill-commission-worker] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Unexpected error', details: `${error}` }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});


