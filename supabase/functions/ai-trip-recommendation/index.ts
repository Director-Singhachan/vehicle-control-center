// Supabase Edge Function
// ชื่อ Function (ใช้เวลา invoke): ai-trip-recommendation
// เรียก AI API (เช่น Google Gemini) เพื่อแนะนำรถและคำแนะนำการจัดเรียงสินค้า
// เก็บ API Key ใน Supabase Secrets (GEMINI_API_KEY) — ไม่ใส่ใน Frontend

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/** รายการสินค้าบนพาเลทใบหนึ่ง (จาก bin packing) */
interface PalletAllocationItem {
  product_id: string;
  product_name?: string | null;
  product_code?: string | null;
  quantity: number;
  weight_kg: number;
  volume_liter: number;
}

interface PalletAllocationEntry {
  pallet_index: number;
  items: PalletAllocationItem[];
  total_weight_kg?: number;
  total_volume_liter?: number;
}

interface TripSummary {
  estimated_weight_kg?: number;
  estimated_volume_liter?: number;
  store_count?: number;
  item_count?: number;
  items_summary?: string;
  planned_date?: string;
  /** จำนวนพาเลทที่ระบบคำนวณ (จาก bin packing จัดรวมหลายชนิดได้) */
  estimated_pallets?: number;
  /** การจัดสรรพาเลทจากระบบ — แต่ละใบมีสินค้าอะไรบ้าง เพื่อให้ AI แนะนำวิธีจัดเรียง/ซ้อนได้เฉพาะทาง */
  pallet_allocation?: PalletAllocationEntry[];
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
  packing_patterns?: string;
  product_packing_profiles?: string;
}

interface AIResponse {
  suggested_vehicle_id?: string | null;
  reasoning?: string | null;
  packing_tips?: string | null;
  error?: string;
}

/** ดึง JSON string จากข้อความที่ AI ตอบกลับ (รองรับกรณีมีโค้ดบล็อก/คำอธิบายพ่วงมา) */
function extractJsonBlock(text: string): string | null {
  if (!text) return null;

  // ตัด code fence ``` / ```json ออกถ้ามี
  let cleaned = text.trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '');
  cleaned = cleaned.replace(/```$/i, '').trim();

  // หา block {...} ที่ใหญ่ที่สุดจากข้อความที่เหลือ
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    return null;
  }
  return cleaned.slice(firstBrace, lastBrace + 1);
}

/** พยายาม parse JSON แบบผ่อนปรนเล็กน้อย (ลบ trailing comma ฯลฯ) */
function tryParseJsonLoose(input: string): any | null {
  try {
    return JSON.parse(input);
  } catch {
    /* ignore and try to repair */
  }

  // ลบ trailing comma ก่อนปิด object / array
  const withoutTrailingCommas = input.replace(/,\s*([}\]])/g, '$1');
  try {
    return JSON.parse(withoutTrailingCommas);
  } catch {
    return null;
  }
}

/** fallback ดึง field หลัก ๆ จาก raw text เมื่อ JSON พัง/ขาดตอน */
function extractFieldsFromRawText(text: string): AIResponse | null {
  if (!text) return null;

  // suggested_vehicle_id (uuid)
  const idMatch = text.match(/"suggested_vehicle_id"\s*:\s*"([\w-]+)"/);
  const suggested_vehicle_id = idMatch?.[1] ?? null;

  // reasoning: จับระหว่าง key reasoning ถึง key packing_tips
  let reasoning: string | null = null;
  const reasoningMatch = text.match(
    /"reasoning"\s*:\s*"([\s\S]*?)",\s*\n\s*"packing_tips"/
  );
  if (reasoningMatch?.[1]) {
    reasoning = reasoningMatch[1];
  }

  // packing_tips: จับจาก key จนจบข้อความ (อาจไม่ปิด quote/brace)
  let packing_tips: string | null = null;
  const tipsMatch = text.match(/"packing_tips"\s*:\s*"([\s\S]*)$/);
  if (tipsMatch?.[1]) {
    packing_tips = tipsMatch[1];
  }

  if (!suggested_vehicle_id && !reasoning && !packing_tips) {
    return null;
  }

  return {
    suggested_vehicle_id,
    reasoning,
    packing_tips,
  };
}

function buildPrompt(body: RequestBody): string {
  const { trip, vehicles, historical_context } = body;
  const vehicleList = vehicles
    .map(
      (v) =>
        `- ${v.plate} (id: ${v.vehicle_id}) ความจุน้ำหนัก ${v.max_weight_kg ?? 'N/A'} kg, ปริมาตร ${v.cargo_volume_liter ?? 'N/A'} L`
    )
    .join('\n');

  const palletNote = trip.estimated_pallets != null
    ? `- จำนวนพาเลทที่ระบบคำนวณ (จัดรวมหลายชนิดบนพาเลทเดียวกัน): ${trip.estimated_pallets}\n`
    : '';

  let palletAllocationBlock = '';
  if (trip.pallet_allocation && trip.pallet_allocation.length > 0) {
    palletAllocationBlock = `\nการจัดสรรพาเลทจากระบบ (แต่ละใบมีสินค้าดังนี้ — ใช้เป็นฐานในการแนะนำวิธีจัดเรียง/ซ้อน):
${trip.pallet_allocation
        .map(
          (p) =>
            `  พาเลทที่ ${p.pallet_index}: ${p.items
              .map(
                (i) =>
                  `${i.product_name || i.product_code || i.product_id} (${i.quantity} หน่วย, น้ำหนักรวม ${i.weight_kg.toFixed(1)} กก., ปริมาตร ${i.volume_liter.toFixed(0)} ลิตร)`
              )
              .join('; ')}`
        )
        .join('\n')}

`;
  }

  // Pattern insights จาก analytics views (ถ้ามี)
  const packingPatternsBlock = body.packing_patterns
    ? `\n${body.packing_patterns}\n`
    : '';

  // Per-product packing profiles จากประวัติรถคันนี้ (ถ้ามี)
  const productProfilesBlock = body.product_packing_profiles
    ? `\n${body.product_packing_profiles}\n`
    : '';

  return `คุณเป็นผู้ช่วยแนะนำรถบรรทุกและวิธีจัดเรียงสินค้าสำหรับทริปส่งของ

ข้อมูลทริป:
- น้ำหนักโดยประมาณ: ${trip.estimated_weight_kg ?? 'ไม่ระบุ'} kg
- ปริมาตรโดยประมาณ: ${trip.estimated_volume_liter ?? 'ไม่ระบุ'} ลิตร
${palletNote}- จำนวนร้าน: ${trip.store_count ?? 'ไม่ระบุ'}
- จำนวนรายการสินค้า: ${trip.item_count ?? 'ไม่ระบุ'}
${trip.items_summary ? `- รายการสินค้า (สรุป): ${trip.items_summary}` : ''}
${trip.planned_date ? `- วันที่วางแผน: ${trip.planned_date}` : ''}
${palletAllocationBlock}
รถที่เลือกได้:
${vehicleList}
${historical_context ? `\nทริปคล้ายกันจากประวัติ (สรุปโดยระบบ rule-based):\n${historical_context}` : ''}
${packingPatternsBlock}
${productProfilesBlock}
คำแนะนำ:
1) reasoning ต้องอ้างอิงข้อมูลจริง เช่น ทะเบียนรถ ความจุ เปรียบเทียบกับโหลดปัจจุบัน และสถิติจากทริปคล้ายกันด้านบน
2) packing_tips: ⚡สำคัญมาก⚡ ถ้ามีข้อมูล "โปรไฟล์การจัดเรียงสินค้า" ให้ใช้เป็น template หลัก:
   - จัดสินค้าไว้ในพาเลทตำแหน่งที่มัน "เคยถูกวางบ่อยที่สุด" ตาม position distribution
   - วางไว้ชั้น (ล่าง/กลาง/บน) ตามที่เคยวางบ่อยที่สุด ตาม layer distribution
   - ปริมาณต่อพาเลทไม่ควรเกิน max ที่เคยวาง
   - สินค้าที่มักจัดคู่กันให้วางพาเลทเดียวกัน
   - ระบุชัดเจนว่า "จากประวัติรถคันนี้ [สินค้า] มักวาง [พาเลท X] [ชั้น Y] [จำนวน Z]" อย่าพูดกว้างๆ
3) ถ้าไม่มีโปรไฟล์ ให้อ้างอิง "รูปแบบน้ำหนักพาเลท" หรือ "คู่สินค้าที่จัดด้วยกัน" แทน ถ้าไม่มีเลยให้ใช้หลักน้ำหนัก (หนักล่าง เบาบน)
4) ห้ามเปลี่ยนรถที่ระบบหลักเลือกแล้วเอง ให้เสนอเป็น "ข้อสังเกต/ความเสี่ยง/ข้อเสนอปรับปรุง" เท่านั้น

กรุณาตอบเป็น JSON เท่านั้น (ไม่ใส่ markdown):
{"suggested_vehicle_id": "uuid ของรถที่แนะนำ", "reasoning": "เหตุผลสั้นๆ อ้างอิงข้อมูลทริป/รถและทริปคล้ายกัน", "packing_tips": "คำแนะนำจัดเรียง: ระบุแต่ละพาเลทควรมีสินค้าอะไร กี่หน่วย น้ำหนักเท่าไหร่ ซ้อนอย่างไร อ้างอิงจากโปรไฟล์ประวัติรถคันนี้"}

ถ้าไม่มีรถที่เหมาะ ให้ suggested_vehicle_id เป็น null.`;
}

// Gemini 2.0 Flash Lite — ราคาถูกกว่า Flash ($0.07/1M input, $0.30/1M output)
// ถ้า 404 ลอง gemini-2.0-flash หรือ gemini-1.5-flash-001
const GEMINI_MODEL = 'gemini-2.0-flash-lite';

/** ดึง retryDelay (วินาที) จาก error body ของ Gemini 429 */
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

async function callGemini(apiKey: string, prompt: string): Promise<AIResponse> {
  let { res, errText } = await callGeminiOnce(apiKey, prompt);

  if (res.status === 429) {
    const waitSec = parseRetryDelaySeconds(errText);
    console.log(`[ai-trip-recommendation] 429 received, retrying after ${waitSec}s`);
    await new Promise((r) => setTimeout(r, waitSec * 1000));
    const retry = await callGeminiOnce(apiKey, prompt);
    res = retry.res;
    errText = retry.errText;
  }

  if (!res.ok) {
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

  let data: any;
  try {
    data = JSON.parse(errText);
  } catch {
    return { suggested_vehicle_id: null, reasoning: null, packing_tips: null, error: 'Invalid response from AI' };
  }
  const text =
    data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '';
  if (!text) {
    return { error: 'AI did not return text' };
  }

  // Parse JSON from response (อาจมี markdown code block หรือข้อความพ่วง)
  const jsonStr = extractJsonBlock(text) ?? text;
  const parsed = tryParseJsonLoose(jsonStr) as AIResponse | null;

  if (parsed && typeof parsed === 'object') {
    return {
      suggested_vehicle_id: parsed.suggested_vehicle_id ?? null,
      reasoning: parsed.reasoning ?? null,
      packing_tips: parsed.packing_tips ?? null,
    };
  }

  // Fallback: พยายามดึง field หลักจาก raw text (เช่น กรณี JSON ถูกตัดตอน)
  const fallback = extractFieldsFromRawText(text);
  if (fallback) {
    console.warn('[ai-trip-recommendation] JSON parse failed, using regex fallback');
    return fallback;
  }

  console.error('[ai-trip-recommendation] Could not parse AI JSON. Raw text:', text);
  return { reasoning: text, error: 'Could not parse AI response as JSON' };
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
