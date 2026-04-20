// Supabase Edge Function: auto-commission-worker
// คำนวณและบันทึกค่าคอมมิชชั่นอัตโนมัติสำหรับทริปที่เสร็จสิ้น (delivery_trips)
// ถูกเรียกจากแอปเมื่อ:
// - รถเช็คอินสำเร็จและทริปถูกอัปเดตเป็นสถานะ 'completed'
// - หรือเมื่อมีการแก้ไขทริป/สินค้า/พนักงาน แล้วต้องการคำนวณใหม่
//
// Design หลัก:
// - ใช้ service role key → bypass RLS เพื่อเขียน commission_logs ได้แม้ user ปกติทำการเช็คอิน
// - Idempotent: ลบทุกรายการ commission_logs ของทริปนั้นก่อน แล้วคำนวณใหม่ทุกครั้ง
// - ถ้าไม่พบเรทค่าคอม หรือไม่พบ crew → log warning และ return success:false (ไม่ throw 500)
//
// หมายเหตุ (บิลแก้ / related_prior_order_id):
// - ค่าคอมคิดจากจำนวนสินค้าที่ส่งจริงใน delivery_trip_items ต่อทริป ไม่ใช่ยอดรายได้จาก orders
// - การกันยอดรายได้ซ้ำระหว่างบิลเก่า/ใหม่ทำที่ orders.exclude_from_vehicle_revenue_rollup + สรุปรายได้ต่อรถ
//   ไม่ได้แก้สูตรค่าคอมอัตโนมัติต่อเคส SKU ผิดในอดีต — ถ้าต้องปรับย้อนหลังให้ทำทางบัญชี/ทริป

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Max-Age': '86400', // Cache preflight for 24 hours
};

type CommissionRate = {
  id: string;
  vehicle_type: string | null;
  service_type: string | null;
  rate_per_unit: number;
  is_active: boolean;
  effective_from: string;
  effective_until: string | null;
};

type CrewMemberRow = {
  id: string;
  staff_id: string;
  role: 'driver' | 'helper';
  start_at: string;
  end_at: string | null;
  service_staff: {
    id: string;
    name: string;
  } | null;
};

type AggregatedCrewCommission = {
  staffId: string;
  staffName: string;
  role: 'driver' | 'helper' | 'mixed';
  workDurationHours: number;
  workPercentage: number;
  commissionAmount: number;
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { 
      status: 200,
      headers: corsHeaders 
    });
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

    const body = await req.json().catch(() => null);
    const tripId: string | undefined = body?.trip_id || body?.tripId;
    const source: string | undefined = body?.source || 'unknown';

    if (!tripId) {
      return new Response(
        JSON.stringify({ error: 'trip_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    console.log('[auto-commission-worker] Start for trip', { tripId, source });

    // Step 1: Fetch trip details
    const { data: trip, error: tripError } = await supabase
      .from('delivery_trips')
      .select(`
        id,
        status,
        vehicle_id,
        vehicles (
          id,
          type
        )
      `)
      .eq('id', tripId)
      .single();

    if (tripError || !trip) {
      console.error('[auto-commission-worker] Trip not found or error:', tripError);
      return new Response(
        JSON.stringify({ error: `Delivery trip not found: ${tripId}` }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (trip.status !== 'completed') {
      console.warn('[auto-commission-worker] Trip is not completed. Skip commission calculation.', {
        tripId,
        status: trip.status,
      });
      return new Response(
        JSON.stringify({
          success: false,
          reason: 'trip_not_completed',
          message: `Trip status is ${trip.status}, commission will not be calculated.`,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const vehicleType: string = (trip as any).vehicles?.type || 'unknown';

    // Step 2: Calculate total delivered items
    const { data: tripStores, error: storesError } = await supabase
      .from('delivery_trip_stores')
      .select('id, delivery_status')
      .eq('delivery_trip_id', tripId);

    if (storesError) {
      console.error('[auto-commission-worker] Error fetching trip stores:', storesError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch trip stores' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const deliveredStoreIds = (tripStores || [])
      .filter((s: any) =>
        s.delivery_status === 'delivered' ||
        (s.delivery_status === 'pending' && trip.status === 'completed'),
      )
      .map((s: any) => s.id as string);

    let totalItemsDelivered = 0;

    if (deliveredStoreIds.length > 0) {
      const { data: items, error: itemsError } = await supabase
        .from('delivery_trip_items')
        .select('quantity')
        .in('delivery_trip_store_id', deliveredStoreIds);

      if (itemsError) {
        console.error('[auto-commission-worker] Error fetching trip items:', itemsError);
        return new Response(
          JSON.stringify({ error: 'Failed to fetch trip items' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      totalItemsDelivered = (items || []).reduce(
        (sum, item) => sum + Number((item as any).quantity || 0),
        0,
      );
    }

    // ถ้าไม่มีสินค้าที่ส่งเลย ไม่ต้องคำนวนค่าคอม
    if (totalItemsDelivered <= 0) {
      console.warn('[auto-commission-worker] No delivered items for trip. Skip commission.', {
        tripId,
      });
      return new Response(
        JSON.stringify({
          success: false,
          reason: 'no_items',
          message: 'No delivered items for this trip.',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Step 3: Find applicable commission rate
    const today = new Date().toISOString().split('T')[0];

    const { data: rates, error: ratesError } = await supabase
      .from('commission_rates')
      .select('*')
      .eq('is_active', true)
      .lte('effective_from', today)
      .or(`effective_until.is.null,effective_until.gte.${today}`)
      .order('vehicle_type', { ascending: false, nullsFirst: false })
      .order('service_type', { ascending: false, nullsFirst: false });

    if (ratesError) {
      console.error('[auto-commission-worker] Error fetching commission rates:', ratesError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch commission rates' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    let selectedRate: CommissionRate | null = null;
    const serviceType = 'standard'; // TODO: ทำให้ configurable ถ้าต้องการในอนาคต

    if (rates && rates.length > 0) {
      selectedRate = (rates as CommissionRate[]).find(
        (r) => r.vehicle_type === vehicleType && r.service_type === serviceType,
      ) || null;

      if (!selectedRate) {
        selectedRate = (rates as CommissionRate[]).find(
          (r) => r.vehicle_type === vehicleType && !r.service_type,
        ) || null;
      }

      if (!selectedRate) {
        selectedRate = (rates as CommissionRate[]).find(
          (r) => !r.vehicle_type && r.service_type === serviceType,
        ) || null;
      }

      if (!selectedRate) {
        selectedRate = (rates as CommissionRate[]).find(
          (r) => !r.vehicle_type && !r.service_type,
        ) || null;
      }
    }

    if (!selectedRate) {
      const msg =
        `No commission rate found for vehicle type: ${vehicleType}, service type: ${serviceType}`;
      console.warn('[auto-commission-worker]', msg, { tripId });
      return new Response(
        JSON.stringify({
          success: false,
          reason: 'no_rate',
          message: msg,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const ratePerUnit = Number(selectedRate.rate_per_unit || 0);
    const totalCommission = totalItemsDelivered * ratePerUnit;

    if (totalCommission <= 0) {
      console.warn('[auto-commission-worker] Calculated totalCommission <= 0. Skip.', {
        tripId,
        totalItemsDelivered,
        ratePerUnit,
      });
      return new Response(
        JSON.stringify({
          success: false,
          reason: 'zero_commission',
          message: 'Total commission is zero, nothing to save.',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Step 4: Get crew members and calculate work duration
    const { data: crewMembers, error: crewError } = await supabase
      .from('delivery_trip_crews')
      .select(`
        id,
        staff_id,
        role,
        start_at,
        end_at,
        service_staff:service_staff!delivery_trip_crews_staff_id_fkey (
          id,
          name
        )
      `)
      .eq('delivery_trip_id', tripId)
      .in('status', ['active', 'replaced']);

    if (crewError) {
      console.error('[auto-commission-worker] Error fetching crew members:', crewError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch crew members' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (!crewMembers || crewMembers.length === 0) {
      console.warn('[auto-commission-worker] No crew members found for this trip. Skip.', {
        tripId,
      });
      return new Response(
        JSON.stringify({
          success: false,
          reason: 'no_crew',
          message: 'No crew members found for this trip.',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // ใช้เวลาปัจจุบันเป็น tripEndTime ถ้า crew.end_at ยังไม่ถูกเซ็ต
    const tripEndTime = new Date();

    const crewWithDuration = (crewMembers as CrewMemberRow[]).map((crew) => {
      const startTime = new Date(crew.start_at);
      const endTime = crew.end_at ? new Date(crew.end_at) : tripEndTime;
      const durationMs = endTime.getTime() - startTime.getTime();
      const durationHours = durationMs / (1000 * 60 * 60);

      return {
        staffId: crew.staff_id,
        staffName: crew.service_staff?.name || 'Unknown',
        role: crew.role,
        workDurationHours: Math.max(0, durationHours),
      };
    });

    const totalWorkHours = crewWithDuration.reduce(
      (sum, crew) => sum + crew.workDurationHours,
      0,
    );

    const crewCommissions = crewWithDuration.map((crew) => {
      const workPercentage = totalWorkHours > 0
        ? (crew.workDurationHours / totalWorkHours) * 100
        : 100 / crewWithDuration.length;

      const commissionAmount = (totalCommission * workPercentage) / 100;

      return {
        ...crew,
        workPercentage: Math.round(workPercentage * 100) / 100,
        commissionAmount: Math.round(commissionAmount * 100) / 100,
      };
    });

    // รวมพนักงานคนเดิมที่อาจมีหลาย record ในทริปเดียวให้เหลือ 1 commission log ต่อ staff
    const aggregatedCrewMap = new Map<string, AggregatedCrewCommission>();

    for (const crew of crewCommissions) {
      const existing = aggregatedCrewMap.get(crew.staffId);

      if (!existing) {
        aggregatedCrewMap.set(crew.staffId, {
          staffId: crew.staffId,
          staffName: crew.staffName,
          role: crew.role,
          workDurationHours: crew.workDurationHours,
          workPercentage: crew.workPercentage,
          commissionAmount: crew.commissionAmount,
        });
        continue;
      }

      aggregatedCrewMap.set(crew.staffId, {
        ...existing,
        role: existing.role === crew.role ? existing.role : 'mixed',
        workDurationHours: existing.workDurationHours + crew.workDurationHours,
        workPercentage: existing.workPercentage + crew.workPercentage,
        commissionAmount: existing.commissionAmount + crew.commissionAmount,
      });
    }

    const aggregatedCrewCommissions = Array.from(aggregatedCrewMap.values()).map((crew) => ({
      ...crew,
      workDurationHours: Math.round(crew.workDurationHours * 100) / 100,
      workPercentage: Math.round(crew.workPercentage * 100) / 100,
      commissionAmount: Math.round(crew.commissionAmount * 100) / 100,
    }));

    // Step 5: Delete existing logs for this trip (idempotent & support recalculation)
    const { error: deleteError } = await supabase
      .from('commission_logs')
      .delete()
      .eq('delivery_trip_id', tripId);

    if (deleteError) {
      console.error('[auto-commission-worker] Error deleting existing commission logs:', deleteError);
      return new Response(
        JSON.stringify({ error: 'Failed to delete existing commission logs' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Step 6: Insert new logs
    const logEntries = aggregatedCrewCommissions.map((crew) => ({
      delivery_trip_id: tripId,
      staff_id: crew.staffId,
      total_items_delivered: totalItemsDelivered,
      rate_applied: ratePerUnit,
      commission_amount: totalCommission,
      work_percentage: crew.workPercentage,
      actual_commission: crew.commissionAmount,
      calculated_by: null, // คำนวณโดยระบบ
      notes: `Auto-calculated (${source || 'system'}) for ${vehicleType} - ${serviceType}`,
    }));

    const { data: logs, error: insertError } = await supabase
      .from('commission_logs')
      .insert(logEntries)
      .select();

    if (insertError) {
      console.error('[auto-commission-worker] Error inserting commission logs:', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to insert commission logs' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    console.log('[auto-commission-worker] Commission calculated & saved successfully', {
      tripId,
      crewCount: aggregatedCrewCommissions.length,
      totalItemsDelivered,
      totalCommission,
    });

    return new Response(
      JSON.stringify({
        success: true,
        tripId,
        totalItemsDelivered,
        totalCommission,
        crewCount: aggregatedCrewCommissions.length,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('[auto-commission-worker] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Unexpected error', details: `${error}` }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});


