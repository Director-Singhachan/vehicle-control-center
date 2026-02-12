// Supabase Edge Function
// ชื่อ Function (ใช้เวลา invoke): post-trip-analysis
// วิเคราะห์ทริปหลังจบด้วย AI (Google Gemini) เพื่อหา pattern ปัญหาและข้อเสนอปรับปรุง
// เก็บ API Key ใน Supabase Secrets (GEMINI_API_KEY)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RequestBody {
  delivery_trip_id: string;
}

interface TripData {
  id: string;
  trip_number: string | null;
  vehicle_id: string;
  actual_weight_kg: number | null;
  space_utilization_percent: number | null;
  actual_pallets_used: number | null;
  had_packing_issues: boolean | null;
  packing_issues_notes: string | null;
  actual_distance_km: number | null;
  actual_duration_hours: number | null;
}

interface VehicleData {
  plate: string | null;
  max_weight_kg: number | null;
  cargo_volume_liter: number | null;
}

interface ItemData {
  product_name: string | null;
  product_code: string | null;
  category: string | null;
  quantity: number;
  weight_kg: number | null;
}

interface LayoutData {
  has_layout: boolean;
  layout_summary: string | null;
}

interface AIAnalysisResponse {
  utilization_analysis: string;
  packing_analysis: string;
  vehicle_fit_analysis: string;
  recommendations: string;
}

function buildPrompt(trip: TripData, vehicle: VehicleData, items: ItemData[], layout: LayoutData): string {
  const itemsSummary = items
    .map((item) => {
      const name = item.product_name || item.product_code || 'ไม่ระบุ';
      const category = item.category || '';
      const qty = item.quantity || 0;
      const weight = item.weight_kg != null ? `${item.weight_kg.toFixed(1)} kg/unit` : '';
      return `- ${name} (${category}): ${qty} หน่วย${weight ? `, ${weight}` : ''}`;
    })
    .join('\n');

  const utilizationStatus =
    trip.space_utilization_percent == null
      ? 'ไม่ระบุ'
      : trip.space_utilization_percent < 60
        ? `${trip.space_utilization_percent.toFixed(0)}% (ต่ำ)`
        : trip.space_utilization_percent > 90
          ? `${trip.space_utilization_percent.toFixed(0)}% (สูงมาก)`
          : `${trip.space_utilization_percent.toFixed(0)}% (ปกติ)`;

  return `คุณเป็นผู้เชี่ยวชาญวิเคราะห์การส่งสินค้า วิเคราะห์ทริปที่เพิ่งเสร็จสิ้นนี้:

ข้อมูลทริป:
- รหัสทริป: ${trip.trip_number || trip.id.substring(0, 8)}
- รถที่ใช้: ${vehicle.plate || 'ไม่ระบุ'} (ความจุ ${vehicle.max_weight_kg ?? 'N/A'} kg, ${vehicle.cargo_volume_liter ?? 'N/A'} ลิตร)
- น้ำหนักที่โหลดจริง: ${trip.actual_weight_kg != null ? `${trip.actual_weight_kg.toFixed(0)} kg` : 'ไม่ระบุ'}
- Space Utilization: ${utilizationStatus}
- จำนวนพาเลทจริง: ${trip.actual_pallets_used ?? 'ไม่ระบุ'}
- มีปัญหาการจัดเรียง: ${trip.had_packing_issues ? 'ใช่' : 'ไม่'}${trip.packing_issues_notes ? ` - ${trip.packing_issues_notes}` : ''}
- ระยะทาง: ${trip.actual_distance_km != null ? `${trip.actual_distance_km.toFixed(1)} km` : 'ไม่ระบุ'}
- ระยะเวลา: ${trip.actual_duration_hours != null ? `${trip.actual_duration_hours.toFixed(1)} ชม.` : 'ไม่ระบุ'}

รายการสินค้า (${items.length} รายการ):
${itemsSummary || '- ไม่มีข้อมูลสินค้า'}

${layout.has_layout && layout.layout_summary ? `
📦 ข้อมูลการจัดเรียงจริง (Layout Recording):
${layout.layout_summary}

⚠️ กรุณาวิเคราะห์ข้อมูลการจัดเรียงจริงด้านบนอย่างละเอียด โดยเฉพาะ:
- น้ำหนักแต่ละพาเลทสมดุลหรือไม่
- ของหนักอยู่ชั้นล่าง ของเบาอยู่ชั้นบน ถูกต้องหรือไม่
- มีพาเลทไหนที่หนักเกินไปหรือเบาเกินไป
` : '(ไม่มีข้อมูลการจัดเรียงจริง)'}

โปรดวิเคราะห์:
1. Utilization Analysis: ทำไม space utilization เป็น ${trip.space_utilization_percent?.toFixed(0) ?? 'N/A'}%? สูง/ต่ำกว่าปกติหรือไม่? มีปัญหาหรือข้อดีอะไร?
2. Packing Efficiency: ${trip.had_packing_issues ? 'ทำไมมี packing issues?' : 'การจัดเรียงมีประสิทธิภาพหรือไม่?'} วิเคราะห์จากข้อมูลสินค้าและพาเลท
3. Vehicle Selection: รถที่เลือกเหมาะสมหรือไม่? เทียบความจุกับโหลดจริง มีปัญหาเกิน/ขาดความจุหรือไม่?
4. Recommendations: มีข้อเสนอแนะอะไรสำหรับทริปคล้ายกันในอนาคต? (เช่น ควรใช้รถคันอื่น, จัดเรียงอย่างไร, ระวังอะไร)

กรุณาตอบเป็น JSON เท่านั้น (ไม่ใส่ markdown code fence):
{
  "utilization_analysis": "วิเคราะห์ utilization สั้นๆ 2-3 ประโยค",
  "packing_analysis": "วิเคราะห์ packing efficiency สั้นๆ 2-3 ประโยค",
  "vehicle_fit_analysis": "วิเคราะห์ความเหมาะสมของรถสั้นๆ 2-3 ประโยค",
  "recommendations": "ข้อเสนอแนะเป็น bullet points 3-5 ข้อ"
}`;
}

const GEMINI_MODEL = 'gemini-2.0-flash-lite';

function parseRetryDelaySeconds(errText: string): number {
  try {
    const j = JSON.parse(errText);
    const details = j?.error?.details;
    if (Array.isArray(details)) {
      for (const d of details) {
        if (d['@type']?.includes('RetryInfo') && d.retryDelay) {
          const s = String(d.retryDelay).replace(/s$/i, '');
          const sec = parseFloat(s);
          if (Number.isFinite(sec)) return Math.min(60, Math.ceil(sec));
        }
      }
    }
    const match = errText.match(/retry in (\d+\.?\d*)\s*s/i);
    if (match) return Math.min(60, Math.ceil(parseFloat(match[1])));
  } catch {
    /* ignore */
  }
  return 15;
}

async function callGeminiOnce(apiKey: string, prompt: string): Promise<{ res: Response; errText: string }> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 800,
      },
    }),
  });
  const errText = await res.text();
  return { res, errText };
}

async function callGemini(apiKey: string, prompt: string): Promise<AIAnalysisResponse | { error: string }> {
  let { res, errText } = await callGeminiOnce(apiKey, prompt);

  if (res.status === 429) {
    const waitSec = parseRetryDelaySeconds(errText);
    console.log(`[post-trip-analysis] 429 received, retrying after ${waitSec}s`);
    await new Promise((r) => setTimeout(r, waitSec * 1000));
    const retry = await callGeminiOnce(apiKey, prompt);
    res = retry.res;
    errText = retry.errText;
  }

  if (!res.ok) {
    console.error('[post-trip-analysis] Gemini API error:', res.status, errText);
    let userMessage: string;
    if (res.status === 429) {
      userMessage = 'โควต้า Gemini หมด กรุณารอสักครู่';
    } else if (res.status === 404) {
      userMessage = 'โมเดล Gemini ไม่พบ';
    } else {
      userMessage = `Gemini API ${res.status}: ${errText.slice(0, 150)}`;
    }
    return { error: userMessage };
  }

  let data: any;
  try {
    data = JSON.parse(errText);
  } catch {
    return { error: 'Invalid response from AI' };
  }

  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '';
  if (!text) {
    return { error: 'AI did not return text' };
  }

  // Try to parse JSON from response
  let cleaned = text.trim();
  // Remove markdown code fences if present
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '');
  cleaned = cleaned.replace(/```$/i, '').trim();

  // Extract JSON object
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    const jsonStr = cleaned.slice(firstBrace, lastBrace + 1);
    try {
      const parsed = JSON.parse(jsonStr) as AIAnalysisResponse;
      return {
        utilization_analysis: parsed.utilization_analysis || '',
        packing_analysis: parsed.packing_analysis || '',
        vehicle_fit_analysis: parsed.vehicle_fit_analysis || '',
        recommendations: parsed.recommendations || '',
      };
    } catch {
      // Try repair trailing commas
      const repaired = jsonStr.replace(/,\s*([}\]])/g, '$1');
      try {
        const parsed = JSON.parse(repaired) as AIAnalysisResponse;
        return {
          utilization_analysis: parsed.utilization_analysis || '',
          packing_analysis: parsed.packing_analysis || '',
          vehicle_fit_analysis: parsed.vehicle_fit_analysis || '',
          recommendations: parsed.recommendations || '',
        };
      } catch {
        return { error: 'Could not parse AI response as JSON' };
      }
    }
  }

  return { error: 'Could not extract JSON from AI response' };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = (await req.json()) as RequestBody;
    if (!body.delivery_trip_id) {
      return new Response(JSON.stringify({ error: 'Missing delivery_trip_id' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch trip data
    const { data: trip, error: tripError } = await supabase
      .from('delivery_trips')
      .select(
        'id, trip_number, vehicle_id, actual_weight_kg, space_utilization_percent, actual_pallets_used, had_packing_issues, packing_issues_notes, actual_distance_km, actual_duration_hours'
      )
      .eq('id', body.delivery_trip_id)
      .single();

    if (tripError || !trip) {
      return new Response(JSON.stringify({ error: 'Trip not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch vehicle data
    const { data: vehicle, error: vehicleError } = await supabase
      .from('vehicles')
      .select('plate, max_weight_kg, cargo_volume_liter')
      .eq('id', trip.vehicle_id)
      .single();

    if (vehicleError || !vehicle) {
      return new Response(JSON.stringify({ error: 'Vehicle not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch trip items with product details
    const { data: tripStores } = await supabase
      .from('delivery_trip_stores')
      .select('id')
      .eq('delivery_trip_id', body.delivery_trip_id);

    const storeIds = (tripStores || []).map((s) => s.id);
    let items: ItemData[] = [];

    if (storeIds.length > 0) {
      const { data: tripItems } = await supabase
        .from('delivery_trip_items')
        .select('product_id, quantity')
        .in('delivery_trip_store_id', storeIds);

      if (tripItems && tripItems.length > 0) {
        const productIds = [...new Set(tripItems.map((i) => i.product_id))];
        const { data: products } = await supabase
          .from('products')
          .select('id, product_name, product_code, category, weight_kg')
          .in('id', productIds);

        const productMap = new Map(
          (products || []).map((p) => [
            p.id,
            {
              product_name: p.product_name,
              product_code: p.product_code,
              category: p.category,
              weight_kg: p.weight_kg,
            },
          ])
        );

        items = tripItems.map((item) => {
          const product = productMap.get(item.product_id);
          return {
            product_name: product?.product_name || null,
            product_code: product?.product_code || null,
            category: product?.category || null,
            quantity: item.quantity,
            weight_kg: product?.weight_kg || null,
          };
        });
      }
    }

    // Fetch packing layout data if available
    let layout: LayoutData = { has_layout: false, layout_summary: null };
    try {
      // Check if trip has packing layout
      const { data: layoutData, error: layoutError } = await supabase
        .from('trip_packing_layout')
        .select('id')
        .eq('delivery_trip_id', body.delivery_trip_id)
        .limit(1);

      console.log('[post-trip-analysis] Layout check:', {
        tripId: body.delivery_trip_id,
        layoutRecords: layoutData?.length ?? 0,
        layoutError: layoutError?.message ?? null
      });

      if (!layoutError && layoutData && layoutData.length > 0) {
        // Trip has layout, fetch detailed summary using RPC function
        const { data: layoutSummary, error: rpcError } = await supabase.rpc('get_trip_packing_layout_summary', {
          p_trip_id: body.delivery_trip_id
        });

        console.log('[post-trip-analysis] RPC result:', {
          hasData: !!layoutSummary,
          summaryLength: layoutSummary ? String(layoutSummary).length : 0,
          summaryPreview: layoutSummary ? String(layoutSummary).substring(0, 200) : null,
          rpcError: rpcError?.message ?? null
        });

        if (layoutSummary) {
          layout = {
            has_layout: true,
            layout_summary: layoutSummary as string
          };
        }
      }
    } catch (err) {
      console.warn('[post-trip-analysis] Layout fetch error:', err);
      // Continue without layout data
    }

    console.log('[post-trip-analysis] Final layout state:', {
      has_layout: layout.has_layout,
      summary_length: layout.layout_summary?.length ?? 0
    });

    // Check for Gemini API key
    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) {
      return new Response(
        JSON.stringify({
          error: 'AI not configured',
          message: 'Set GEMINI_API_KEY in Supabase secrets to enable AI analysis.',
        }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build prompt and call Gemini
    const prompt = buildPrompt(trip as TripData, vehicle as VehicleData, items, layout);
    console.log('[post-trip-analysis] Prompt length:', prompt.length, 'Layout in prompt:', prompt.includes('Layout Recording'));
    const result = await callGemini(apiKey, prompt);

    if ('error' in result) {
      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Combine all analyses into one summary
    const aiSummary = `
**การวิเคราะห์ Utilization:**
${result.utilization_analysis}

**การวิเคราะห์ Packing Efficiency:**
${result.packing_analysis}

**การวิเคราะห์ความเหมาะสมของรถ:**
${result.vehicle_fit_analysis}

**ข้อเสนอแนะ:**
${result.recommendations}
`.trim();

    // Save to trip_post_analysis table
    const { error: insertError } = await supabase.from('trip_post_analysis').insert({
      delivery_trip_id: body.delivery_trip_id,
      analysis_type: 'overall',
      ai_summary: aiSummary,
      created_by: null, // System-generated
    });

    if (insertError) {
      console.error('[post-trip-analysis] Insert error:', insertError);
      // Still return the analysis even if save failed
      return new Response(
        JSON.stringify({
          success: true,
          analysis: result,
          summary: aiSummary,
          warning: 'Analysis completed but could not save to database: ' + insertError.message,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Return success response
    return new Response(
      JSON.stringify({
        success: true,
        analysis: result,
        summary: aiSummary,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (err) {
    console.error('[post-trip-analysis]', err);
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : 'Unknown error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
