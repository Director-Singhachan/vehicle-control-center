// Supabase Edge Function: daily-summary-worker
// สรุปการใช้รถรายวันและส่งแยกตามสาขาไป Telegram
// ควรเรียกทุกวันเวลา 23:00 หรือ 00:00 ของวันถัดไป

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

const BRANCH_LABELS: Record<string, string> = {
  HQ: 'สำนักงานใหญ่',
  SD: 'สาขาสอยดาว',
  Asia: 'สาขา Asia',
};

interface VehicleSummary {
  vehicle_id: string;
  vehicle_plate: string;
  vehicle_make?: string | null;
  vehicle_model?: string | null;
  branch: string | null;
  trip_count: number;
  total_distance_km: number;
}

interface BranchSummary {
  branch: string | null;
  branch_label: string;
  total_vehicles: number;
  total_trips: number;
  total_distance_km: number;
  vehicles: VehicleSummary[];
}

function normalizeBranchCode(branch: string | null | undefined): string | null {
  const trimmed = branch?.trim();
  if (!trimmed) return null;

  if (trimmed === 'SD' || trimmed.includes('สอยดาว')) return 'SD';
  if (trimmed === 'HQ' || trimmed.includes('สำนักงาน')) return 'HQ';

  return trimmed;
}

function getBranchLabel(branch: string | null): string {
  if (!branch) return 'ไม่ระบุสาขา';
  return BRANCH_LABELS[branch] ?? branch;
}

function toEnvBranchToken(branch: string): string | null {
  const token = branch
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toUpperCase();

  return token || null;
}

function getTelegramGroupChatIdByBranch(branch: string | null): string | null {
  const branchToken = branch ? toEnvBranchToken(branch) : null;
  const branchKeys = branchToken
    ? [
        `TELEGRAM_VEHICLE_USAGE_GROUP_CHAT_ID_${branchToken}`,
        `TELEGRAM_USAGE_GROUP_CHAT_ID_${branchToken}`,
        `TELEGRAM_GROUP_CHAT_ID_${branchToken}`,
        `TELEGRAM_CHAT_ID_${branchToken}`,
      ]
    : [];

  const fallbackKeys = [
    'TELEGRAM_VEHICLE_USAGE_GROUP_CHAT_ID',
    'TELEGRAM_MAINTENANCE_GROUP_CHAT_ID',
    'TELEGRAM_GROUP_CHAT_ID',
    'TELEGRAM_CHAT_ID',
  ];

  for (const key of [...branchKeys, ...fallbackKeys]) {
    const value = Deno.env.get(key)?.trim();
    if (value) return value;
  }

  return null;
}

function formatBranchSummaryMessage(summary: BranchSummary, targetDate: string): string {
  const date = new Date(targetDate);
  const dateStr = date.toLocaleDateString('th-TH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  });

  let message = `📊 *สรุปการใช้รถรายวัน - ${summary.branch_label}*\n\n`;
  message += `📅 วันที่: ${dateStr}\n\n`;
  message += `📈 *ภาพรวม:*\n`;
  message += `🚗 จำนวนรถที่ใช้งาน: ${summary.total_vehicles} คัน\n`;
  message += `🔄 จำนวนทริปทั้งหมด: ${summary.total_trips} ทริป\n`;
  message += `📏 ระยะทางรวม: ${summary.total_distance_km.toLocaleString('th-TH')} กิโลเมตร\n\n`;

  if (summary.vehicles.length === 0) {
    message += '⚠️ ไม่มีข้อมูลการใช้รถในสาขานี้\n';
    return message;
  }

  message += `🚙 *รายละเอียดตามรถ:*\n\n`;

  for (const vehicle of summary.vehicles) {
    const vehicleLabel = vehicle.vehicle_make && vehicle.vehicle_model
      ? `${vehicle.vehicle_plate} (${vehicle.vehicle_make} ${vehicle.vehicle_model})`
      : vehicle.vehicle_plate;

    message += `🚗 *${vehicleLabel}*\n`;
    message += `   🔄 ${vehicle.trip_count} ทริป\n`;
    message += `   📏 ${vehicle.total_distance_km.toLocaleString('th-TH')} กิโลเมตร\n\n`;
  }

  return message;
}

async function sendTelegramTextMessage(botToken: string, chatId: string, message: string) {
  const response = await fetch(
    `https://api.telegram.org/bot${botToken}/sendMessage`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'Markdown',
      }),
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Telegram API error: ${response.status} - ${errorText}`);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const url = new URL(req.url);
    const dateParam = url.searchParams.get('date');
    let targetDate: string;

    if (dateParam) {
      targetDate = dateParam;
    } else {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      targetDate = yesterday.toISOString().split('T')[0];
    }

    console.log(`[daily-summary-worker] Generating summary for date: ${targetDate}`);

    const startOfDay = `${targetDate}T00:00:00.000Z`;
    const endOfDay = `${targetDate}T23:59:59.999Z`;

    const { data: trips, error: tripsError } = await supabase
      .from('trip_logs')
      .select(`
        id,
        vehicle_id,
        odometer_start,
        odometer_end,
        checkout_time,
        checkin_time,
        status,
        vehicle:vehicles!trip_logs_vehicle_id_fkey(
          id,
          plate,
          make,
          model,
          branch
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
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (!trips || trips.length === 0) {
      console.log(`[daily-summary-worker] No trips found for ${targetDate}`);
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No trips found for the date',
          date: targetDate,
          summaries: [],
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const vehicleMap = new Map<string, VehicleSummary>();

    for (const trip of trips) {
      const vehicle = (trip as any).vehicle as {
        id: string;
        plate: string;
        make?: string | null;
        model?: string | null;
        branch?: string | null;
      } | null;

      if (!vehicle) continue;

      const vehicleId = vehicle.id;
      const vehicleBranch = normalizeBranchCode(vehicle.branch);
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
          branch: vehicleBranch,
          trip_count: 1,
          total_distance_km: distance,
        });
      }
    }

    const vehicles = Array.from(vehicleMap.values()).map((vehicle) => ({
      ...vehicle,
      total_distance_km: Math.round(vehicle.total_distance_km * 100) / 100,
    }));
    const branchMap = new Map<string, BranchSummary>();

    for (const vehicle of vehicles) {
      const branchKey = vehicle.branch || 'UNASSIGNED';
      const existing = branchMap.get(branchKey);

      if (existing) {
        existing.total_vehicles += 1;
        existing.total_trips += vehicle.trip_count;
        existing.total_distance_km += vehicle.total_distance_km;
        existing.vehicles.push(vehicle);
      } else {
        branchMap.set(branchKey, {
          branch: vehicle.branch,
          branch_label: getBranchLabel(vehicle.branch),
          total_vehicles: 1,
          total_trips: vehicle.trip_count,
          total_distance_km: vehicle.total_distance_km,
          vehicles: [vehicle],
        });
      }
    }

    const branchSummaries = Array.from(branchMap.values())
      .map((summary) => ({
        ...summary,
        total_distance_km: Math.round(summary.total_distance_km * 100) / 100,
        vehicles: [...summary.vehicles].sort((a, b) => b.total_distance_km - a.total_distance_km),
      }))
      .sort((a, b) => a.branch_label.localeCompare(b.branch_label, 'th-TH'));

    const telegramBotToken =
      Deno.env.get('TELEGRAM_BOT_TOKEN') || Deno.env.get('TELEGRAM_MAINTENANCE_BOT_TOKEN');

    if (!telegramBotToken) {
      console.warn('[daily-summary-worker] Telegram bot token not configured');
      return new Response(
        JSON.stringify({
          error: 'Telegram not configured',
          date: targetDate,
          summaries: branchSummaries,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const sentBranches: string[] = [];
    const skippedBranches: Array<{ branch: string; reason: string }> = [];

    for (const summary of branchSummaries) {
      const branchCode = summary.branch || 'UNASSIGNED';
      const chatId = getTelegramGroupChatIdByBranch(summary.branch);

      if (!chatId) {
        const reason = `No Telegram chat ID configured for branch ${branchCode}`;
        console.warn(`[daily-summary-worker] ${reason}`);
        skippedBranches.push({ branch: branchCode, reason });
        continue;
      }

      try {
        await sendTelegramTextMessage(
          telegramBotToken,
          chatId,
          formatBranchSummaryMessage(summary, targetDate),
        );
        sentBranches.push(branchCode);
        console.log(`[daily-summary-worker] Successfully sent summary for branch ${branchCode}`);
      } catch (error) {
        const reason = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[daily-summary-worker] Error sending branch ${branchCode}:`, error);
        skippedBranches.push({ branch: branchCode, reason });
      }
    }

    if (sentBranches.length === 0) {
      return new Response(
        JSON.stringify({
          error: 'Failed to send to Telegram',
          date: targetDate,
          details: skippedBranches,
          summaries: branchSummaries,
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    console.log(
      `[daily-summary-worker] Successfully sent daily summary for ${targetDate} (${sentBranches.join(', ')})`,
    );

    return new Response(
      JSON.stringify({
        success: true,
        date: targetDate,
        summaries: branchSummaries,
        sent_branches: sentBranches,
        skipped_branches: skippedBranches,
        message_sent: true,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('[daily-summary-worker] Unexpected error:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});

