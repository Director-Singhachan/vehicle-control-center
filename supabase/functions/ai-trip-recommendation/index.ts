// Supabase Edge Function
// ชื่อ Function (ใช้เวลา invoke): ai-trip-recommendation
// เรียก AI API (เช่น Google Gemini) เพื่อแนะนำรถและคำแนะนำการจัดเรียงสินค้า
// เก็บ API Key ใน Supabase Secrets (GEMINI_API_KEY) — ไม่ใส่ใน Frontend

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TripSummary {
  estimated_weight_kg?: number;
  estimated_volume_liter?: number;
  store_count?: number;
  item_count?: number;
  items_summary?: string;
  planned_date?: string;
}

interface VehicleOption {
  vehicle_id: string;
  plate: string;
  max_weight_kg?: number | null;
  cargo_volume_liter?: number | null;
  branch?: string | null;
}

interface RequestBody {
  trip: TripSummary;
  vehicles: VehicleOption[];
  historical_context?: string;
}

interface AIResponse {
  suggested_vehicle_id?: string | null;
  reasoning?: string | null;
  packing_tips?: string | null;
  error?: string;
}

function buildPrompt(body: RequestBody): string {
  const { trip, vehicles, historical_context } = body;
  const vehicleList = vehicles
    .map(
      (v) =>
        `- ${v.plate} (id: ${v.vehicle_id}) ความจุน้ำหนัก ${v.max_weight_kg ?? 'N/A'} kg, ปริมาตร ${v.cargo_volume_liter ?? 'N/A'} L`
    )
    .join('\n');

  return `คุณเป็นผู้ช่วยแนะนำรถบรรทุกและวิธีจัดเรียงสินค้าสำหรับทริปส่งของ

ข้อมูลทริป:
- น้ำหนักโดยประมาณ: ${trip.estimated_weight_kg ?? 'ไม่ระบุ'} kg
- ปริมาตรโดยประมาณ: ${trip.estimated_volume_liter ?? 'ไม่ระบุ'} ลิตร
- จำนวนร้าน: ${trip.store_count ?? 'ไม่ระบุ'}
- จำนวนรายการสินค้า: ${trip.item_count ?? 'ไม่ระบุ'}
${trip.items_summary ? `- รายการสินค้า (สรุป): ${trip.items_summary}` : ''}
${trip.planned_date ? `- วันที่วางแผน: ${trip.planned_date}` : ''}

รถที่เลือกได้:
${vehicleList}
${historical_context ? `\nประวัติ (เมตริกซ์ที่บันทึก):\n${historical_context}` : ''}

กรุณาตอบเป็น JSON เท่านั้น ในรูปแบบนี้ (ไม่ใส่ markdown หรือข้อความอื่น):
{"suggested_vehicle_id": "uuid ของรถที่แนะนำ", "reasoning": "เหตุผลสั้นๆ 1-2 ประโยค", "packing_tips": "คำแนะนำการจัดเรียง/โหลดสินค้า 2-4 ข้อ เช่น ของหนักไว้ล่าง ใส่ร้านที่ไปก่อนไว้ด้านใน เป็นต้น"}

ถ้าไม่มีรถที่เหมาะ ให้ suggested_vehicle_id เป็น null และอธิบายใน reasoning.`;
}

// ชื่อโมเดลที่รองรับใน Gemini API (gemini-2.0-flash รองรับกว้าง; ถ้า 404 ลอง gemini-1.5-flash-001)
const GEMINI_MODEL = 'gemini-2.0-flash';

async function callGemini(apiKey: string, prompt: string): Promise<AIResponse> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 1024,
      },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error('[ai-trip-recommendation] Gemini API error:', res.status, errText);
    let userMessage: string;
    if (res.status === 429) {
      userMessage = 'โควต้า Gemini หมดหรือเกินกำหนด (Free tier) กรุณารอสักครู่หรือตรวจสอบแผน/การเรียกใช้งานที่ Google AI Studio';
    } else if (res.status === 404) {
      userMessage = 'โมเดลไม่พบ ลองเปลี่ยน GEMINI_MODEL ในโค้ด';
    } else {
      userMessage = `Gemini API ${res.status}: ${errText.slice(0, 150)}`;
    }
    return {
      suggested_vehicle_id: null,
      reasoning: null,
      packing_tips: null,
      error: userMessage,
    };
  }

  const data = await res.json();
  const text =
    data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '';
  if (!text) {
    return { error: 'AI did not return text' };
  }

  // Parse JSON from response (อาจมี markdown code block)
  let jsonStr = text;
  const match = text.match(/\{[\s\S]*\}/);
  if (match) jsonStr = match[0];
  try {
    const parsed = JSON.parse(jsonStr) as AIResponse;
    return {
      suggested_vehicle_id: parsed.suggested_vehicle_id ?? null,
      reasoning: parsed.reasoning ?? null,
      packing_tips: parsed.packing_tips ?? null,
    };
  } catch {
    return { reasoning: text, error: 'Could not parse AI response as JSON' };
  }
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
    if (!body.trip || !body.vehicles?.length) {
      return new Response(
        JSON.stringify({ error: 'Missing trip or vehicles in body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) {
      return new Response(
        JSON.stringify({
          error: 'AI not configured',
          message: 'Set GEMINI_API_KEY in Supabase secrets to enable AI recommendations.',
        }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const prompt = buildPrompt(body);
    const result = await callGemini(apiKey, prompt);

    // ส่ง 200 เสมอเมื่อเรียก Gemini ได้ (รวมกรณี result.error) เพื่อให้แอปอ่าน error จาก body ได้
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[ai-trip-recommendation]', err);
    return new Response(
      JSON.stringify({
        suggested_vehicle_id: null,
        reasoning: null,
        packing_tips: null,
        error: err instanceof Error ? err.message : 'Unknown error',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
