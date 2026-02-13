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
  /** ร่างแผนจัดเรียงที่ระบบ rule-based คำนวณมาให้ (จำนวนชั้น/พาเลท) */
  computed_packing_plan?: string;
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

  // ★ สร้าง mapping table: ทะเบียน → UUID (ให้ AI ดู mapping แยก ไม่ต้องแสดง UUID ใน text)
  const vehicleIdMap = vehicles
    .map((v) => `${v.plate} = ${v.vehicle_id}`)
    .join('\n');

  // ★ Vehicle list สำหรับแสดง (ไม่มี UUID)
  const vehicleList = vehicles
    .map(
      (v) =>
        `- ${v.plate}: ความจุน้ำหนัก ${v.max_weight_kg ?? 'N/A'} kg, ปริมาตร ${v.cargo_volume_liter ?? 'N/A'} L`
    )
    .join('\n');

  // บอก AI ว่ารถที่ user เลือกคือคันไหน
  const selectedPlateNote = (trip as any).selected_vehicle_plate
    ? `- ⭐ รถที่ผู้ใช้เลือกแล้ว: ${(trip as any).selected_vehicle_plate}\n`
    : '';

  const palletNote = trip.estimated_pallets != null
    ? `- จำนวนพาเลทที่ระบบคำนวณ (จัดรวมหลายชนิดบนพาเลทเดียวกัน): ${trip.estimated_pallets}\n`
    : '';

  // ★ ข้อมูลพาเลทสูงสุดของรถ vs จำนวนพาเลทที่ต้องการ
  const vehicleMaxPallets = (trip as any).vehicle_max_pallets;
  const estimatedPallets = trip.estimated_pallets ?? 0;
  let spaceNote = '';
  if (vehicleMaxPallets != null && vehicleMaxPallets > 0) {
    const emptySlots = Math.max(0, vehicleMaxPallets - estimatedPallets);
    spaceNote = `- 🚛 รถรองรับได้สูงสุด: ${vehicleMaxPallets} พาเลท | ใช้จริง: ${estimatedPallets} พาเลท | ว่าง: ${emptySlots} ตำแหน่ง\n`;
    if (emptySlots > 0) {
      spaceNote += `- 💡 มีพื้นที่ว่างบนรถอีก ${emptySlots} ตำแหน่งพาเลท → สินค้าจำนวนน้อยไม่จำเป็นต้องซ้อนบนพาเลทเดียว สามารถวางแยกบนพื้นรถได้\n`;
    }
  }

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

  // ระบุว่า historical_context เป็นของรถคันไหน
  const histContextLabel = (trip as any).selected_vehicle_plate
    ? `\nทริปที่คล้ายกันจากประวัติรถ "${(trip as any).selected_vehicle_plate}" (ถ้าไม่มีจะ fallback เป็นรถทุกคัน):\n`
    : '\nทริปคล้ายกันจากประวัติ (สรุปโดยระบบ rule-based):\n';

  return `คุณเป็นผู้เชี่ยวชาญด้านการจัดเรียงสินค้าบนรถบรรทุก มีประสบการณ์สูงในการอ่านข้อมูลประวัติ/สถิติและแปลงเป็นคำแนะนำที่เจาะจง

===== ข้อมูลทริปปัจจุบัน =====
- น้ำหนักรวม: ${trip.estimated_weight_kg ?? 'ไม่ระบุ'} kg
- ปริมาตรรวม: ${trip.estimated_volume_liter ?? 'ไม่ระบุ'} ลิตร
${palletNote}${spaceNote}${selectedPlateNote}- จำนวนร้าน: ${trip.store_count ?? 'ไม่ระบุ'}
- จำนวนรายการสินค้า: ${trip.item_count ?? 'ไม่ระบุ'}
${trip.items_summary ? `- รายการสินค้า: ${trip.items_summary}` : ''}
${trip.planned_date ? `- วันที่วางแผน: ${trip.planned_date}` : ''}
${palletAllocationBlock}

===== รถที่เลือกได้ =====
${vehicleList}

===== ตารางอ้างอิง: ทะเบียนรถ → UUID (ใช้เฉพาะในฟิลด์ suggested_vehicle_id เท่านั้น ห้ามแสดงในข้อความ) =====
${vehicleIdMap}
${historical_context ? `\n===== ทริปประวัติที่คล้ายกัน =====\n${histContextLabel}${historical_context}` : ''}
${packingPatternsBlock ? `\n===== สถิติน้ำหนักพาเลทจากประวัติ =====\n${packingPatternsBlock}` : ''}
${productProfilesBlock ? `\n===== โปรไฟล์การจัดเรียงสินค้าจากประวัติ =====\n${productProfilesBlock}` : ''}
${body.computed_packing_plan ? `\n===== ★ ร่างแผนจัดเรียงจากระบบ (Rule-based — คำนวณจากจำนวนหน่วยต่อชั้นจริงในประวัติ) =====\n${body.computed_packing_plan}\n` : ''}

===== กฎการตอบอย่างเคร่งครัด =====

📌 กฎข้อ 0: ห้ามแสดง UUID ในข้อความ
- ฟิลด์ reasoning และ packing_tips ห้ามมี UUID อย่างเด็ดขาด
- ใช้แค่ทะเบียนรถ เช่น "รถ บว 2136" (ไม่ใช่ "รถ บว 2136 (id: xxx)")
- ค่า UUID ใช้เฉพาะในฟิลด์ suggested_vehicle_id จาก "ตารางอ้างอิง" ด้านบน

📌 กฎข้อ 7 (สำคัญที่สุด): ถ้ามี "ร่างแผนจัดเรียงจากระบบ" → ใช้เป็นฐานหลัก
⚠️ ร่างแผนนี้ถูกคำนวณจากประวัติ layout จริง (จำนวนหน่วยต่อชั้น × จำนวนสินค้า = จำนวนชั้น)
- ต้องนำเสนอแผนนี้เป็น packing_tips หลัก: เช่น "พาเลทที่ 1: โซดาสิงห์ 35 หน่วย (3 ชั้น), พาเลทที่ 2: ..."
- ห้ามคิดแผนเอง ถ้ามีร่างแผนจากระบบ — เว้นแต่พบปัญหาจึงเสนอปรับ
- ถ้าร่างแผนแนะนำ "วางบนพื้นรถ" → ให้เสนอตามนั้น เพราะระบบคำนวณแล้วว่ามีที่ว่าง
- AI ควรเพิ่มเติมเฉพาะ:
  * ข้อสังเกตจากประวัติ (เช่น "จากทริป DT-0083 สินค้านี้มักวางชั้นล่าง")
  * การเตือนเรื่องความปลอดภัย (เฉพาะเจาะจง ไม่ใช่คำเตือนทั่วไป)
  * ลำดับการส่ง (ถ้ามีข้อมูลร้านค้า)

📌 กฎข้อ 1: reasoning ต้องเจาะจง
- ต้องระบุทะเบียนรถ ความจุน้ำหนัก (kg) เปรียบเทียบกับน้ำหนักจริง
- ถ้ามีทริปประวัติ → ต้องระบุ "ทริป DT-XXXX ของรถ บว XXXX เคยขนส่งสินค้าประเภทเดียวกัน (โซดา, เบียร์) สำเร็จ"
- บอก % ของความจุที่ใช้: เช่น "ใช้ 18% ของความจุน้ำหนัก (539/3000 kg)"

📌 กฎข้อ 2: packing_tips — ใช้ร่างแผนจากระบบเป็นฐาน ห้ามตอบกว้างๆ
⚠️ ห้ามเด็ดขาด:
- ห้ามเขียน "จัดวางสินค้าที่มีน้ำหนักมากไว้ด้านล่าง" โดยไม่ระบุว่าสินค้าอะไร กี่ชั้น
- ห้ามเขียน "ตรวจสอบให้แน่ใจว่าสินค้าจัดวางอย่างปลอดภัย"
- ห้ามคิดแผนเองขัดกับ "ร่างแผนจัดเรียงจากระบบ"

📌 กฎข้อ 3: ถ้ามีข้อมูลจาก "ประวัติรถทุกคัน" ก็ยังต้องใช้เต็มที่

📌 กฎข้อ 4: ห้ามเปลี่ยนรถที่ผู้ใช้เลือก ถ้ามีข้อสังเกตให้เสนอเป็นหมายเหตุ

📌 กฎข้อ 5: พิจารณาพื้นที่ว่างบนรถ — สินค้าเศษไม่ต้องซ้อน

===== รูปแบบ JSON ที่ต้องตอบ (ไม่ใส่ markdown) =====
{"suggested_vehicle_id": "uuid จากตารางอ้างอิงด้านบน", "reasoning": "เหตุผลเจาะจง อ้างอิงตัวเลข ใช้แค่ทะเบียนรถ ห้ามมี UUID", "packing_tips": "นำเสนอร่างแผนจากระบบเป็นฐาน + เพิ่มข้อสังเกตจากประวัติ ห้ามมี UUID"}

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
