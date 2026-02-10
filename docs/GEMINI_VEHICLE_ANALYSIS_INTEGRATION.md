# แนวทางเชื่อม Gemini API เพื่อวิเคราะห์ว่าควรใช้รถคันไหน

**อัปเดต:** 2026-02-10  
**สถานะโปรเจกต์ปัจจุบัน:** มีระบบแนะนำรถแบบ rule-based อยู่แล้ว (`vehicleRecommendationService` + `VehicleRecommendationPanel`) — การเชื่อม Gemini จะเป็น **ชั้นเสริม** หรือ **ทางเลือกเพิ่ม**

---

## สถานะปัจจุบันของโปรเจกต์

| ส่วน | รายละเอียด |
|-----|-------------|
| **แนะนำรถ** | `services/vehicleRecommendationService.ts` — คะแนนจาก capacity_fit, historical_success, availability, branch_match, store_familiarity |
| **UI** | `CreateTripFromOrdersView` ใช้ `useVehicleRecommendation` + `VehicleRecommendationPanel` แสดงรถที่แนะนำและเหตุผล |
| **ความจุทริป** | `utils/tripCapacityValidation.ts` — ตรวจน้ำหนัก/ความสูง/พาเลท vs ข้อมูลรถ |
| **Feedback** | บันทึก accept/reject ลง `ai_trip_recommendations` (ai_model_version: 'rule-based-v1') |

---

## แนวทางเชื่อม Gemini ได้ 3 แบบ

### แนวทาง 1: Gemini เป็นชั้นวิเคราะห์เสริม (แนะนำ)

- **ไอเดีย:** ใช้ rule-based อย่างเดิมเป็นตัวกรอง/จัดอันดับก่อน แล้วส่งเฉพาะ **รายการรถที่ได้คะแนนดี + บริบท** ให้ Gemini ช่วยอธิบาย/ยืนยันหรือเสนอทางเลือกเพิ่ม
- **ข้อดี:** ไม่ต้องพึ่ง Gemini ทุก request, เร็ว (rule-based ทำก่อน), cost ควบคุมได้, เหตุผลจาก Gemini อ่านง่าย
- **การทำงาน:**
  1. User เลือกออเดอร์/ร้าน/วัน → ระบบรัน rule-based ได้รายการรถอันดับ 1–5
  2. (Optional) User กดปุ่ม **「วิเคราะห์ด้วย Gemini」** → เรียก Gemini พร้อมส่ง:
     - รายการรถที่แนะนำ (plate, ความจุ, คะแนนย่อย, availability)
     - สรุปสินค้า (น้ำหนักรวม, ปริมาตรโดยประมาณ, จำนวนร้าน)
     - วันที่วางแผน, สาขา
  3. Gemini ตอบเป็นข้อความสั้นๆ: 「ควรใช้รถคันไหน และเพราะอะไร」 (และถ้าต้องการ: ทางเลือกที่ 2)
  4. แสดงผลใน Panel เดิมหรือบล็อกแยกใต้รายการรถ

### แนวทาง 2: Gemini เป็นตัวเลือกหลัก

- **ไอเดีย:** ส่งบริบททั้งหมด (รายการรถ, ความจุ, สินค้า, วันที่, สาขา) ให้ Gemini เป็นคน “เลือกรถคันที่เหมาะสม” โดยตรง
- **ข้อดี:** ยืดหยุ่นกับเงื่อนไขที่อธิบายเป็นภาษา
- **ข้อเสีย:** ต้องเรียก API ทุกครั้ง, latency สูงกว่า, ต้องออกแบบ prompt และ parse คำตอบให้เสถียร

### แนวทาง 3: ไฮบริด (Rule-based + Gemini ยืนยัน)

- **ไอเดีย:** Rule-based คัด 3–5 คัน → ส่งให้ Gemini ทำแค่ “ยืนยันและอธิบาย” ว่าทำไมอันดับ 1 เหมาะสุด หรือมีข้อควรระวังไหม
- **ข้อดี:** ความสามารถใกล้แนวทาง 1 แต่เน้นให้ Gemini เป็น “ที่ปรึกษา” แทนการจัดอันดับเอง

**สรุป:** สำหรับโปรเจกต์ปัจจุบัน แนะนำ **แนวทาง 1 (หรือ 3)** เพื่อใช้ของเดิมให้เต็มที่ และใช้ Gemini เพิ่มเฉพาะเมื่อ user ต้องการ “คำอธิบาย/การวิเคราะห์จาก AI”

---

## แผนลงมือทำ (แนวทาง 1)

### 1. เตรียม API Key และความปลอดภัย

- สร้าง API Key จาก [Google AI Studio](https://aistudio.google.com/) (Gemini)
- **ไม่เก็บ API Key ใน frontend** — เรียก Gemini ผ่าน **Supabase Edge Function** หรือ **Backend ของคุณ** แล้วส่งเฉพาะ input ที่จำเป็น (รายการรถ, สรุปสินค้า, วันที่, สาขา) จาก frontend

```text
# .env (เฉพาะ server / Edge Function)
GEMINI_API_KEY=your_key_here
```

### 2. สร้าง Service เรียก Gemini (ฝั่ง Server)

ทางเลือก:

- **A) Supabase Edge Function (แนะนำถ้าใช้ Supabase อยู่แล้ว)**  
  - สร้าง function เช่น `analyze-vehicle-with-gemini`
  - รับ body: `{ recommendations, loadSummary, planned_date, branch }`
  - ภายใน function เรียก Gemini API (REST หรือ SDK) ด้วย prompt ด้านล่าง
  - Return กลับเป็น `{ recommended_vehicle_id?, reasoning, alternative_vehicle_id? }`

- **B) Backend แยก (Node/Express, etc.)**  
  - สร้าง endpoint เช่น `POST /api/ai/analyze-vehicle` ที่รับ payload เดียวกัน และเรียก Gemini ใน backend

ตัวอย่าง **Prompt** (ปรับ wording ได้):

```text
คุณเป็นผู้ช่วยวิเคราะห์การจัดส่ง ส่งรายการรถที่ผ่านการกรองแล้วและข้อมูลสินค้า ให้ตอบเป็น JSON เท่านั้น

ข้อมูลรถ (อันดับจากระบบ):
{{ recommendations }}

สรุปสินค้า: น้ำหนักรวมประมาณ {{ totalWeightKg }} กก. ปริมาตรประมาณ {{ totalVolumeLiter }} ลิตร จำนวนร้าน {{ storeCount }} ร้าน
วันที่ส่ง: {{ planned_date }} สาขา: {{ branch }}

ให้ตอบเฉพาะ JSON ในรูปแบบนี้เท่านั้น (ไม่ต้องมีข้อความอื่น):
{
  "recommended_vehicle_id": "uuid ของรถที่แนะนำ",
  "reasoning": "เหตุผลสั้นๆ เป็นภาษาไทย",
  "alternative_vehicle_id": "uuid รถทางเลือกที่ 2 ถ้ามี หรือ null"
}
```

- ฝั่ง server ต้อง **parse JSON** จาก response และตรวจว่า `recommended_vehicle_id` ตรงกับรถที่มีในรายการที่ส่งไป

### 3. ฝั่ง Frontend (โปรเจกต์ปัจจุบัน)

- **สร้าง client สำหรับเรียก analysis:**  
  - เรียก Edge Function หรือ `POST /api/ai/analyze-vehicle` โดยส่ง:
    - `recommendations`: อาร์เรย์จาก `vehicleRecommendationService.getRecommendations()` (หรือ slice เอา top 5)
    - `loadSummary`: จาก `estimateLoad` หรือจากผลของ `tripCapacityValidation` (totalWeightKg, totalVolumeLiter, จำนวนร้าน)
    - `planned_date`, `branch`
- **ไม่ส่ง API Key จาก frontend**

- **จุดที่เชื่อมใน UI:**
  - ใน `CreateTripFromOrdersView` / ตรงที่ใช้ `VehicleRecommendationPanel`:
    - เพิ่มปุ่ม **「วิเคราะห์ด้วย Gemini」** (หรือ "ให้ AI ช่วยวิเคราะห์รถ")
    - เมื่อกด → เรียก service ด้านบน → แสดง loading แล้วแสดงผล:
      - 「Gemini แนะนำ: รถ XXX เพราะ ...」
      - ถ้ามี `alternative_vehicle_id` แสดงเป็นทางเลือกที่ 2

- **เก็บผลใน feedback (ถ้าต้องการ):**  
  ใน `vehicleRecommendationService.recordFeedback` หรือ table `ai_trip_recommendations` อาจเพิ่มฟิลด์ เช่น `gemini_reasoning`, `ai_model_version: 'gemini-v1'` เมื่อ user ยอมรับการแนะนำจาก Gemini เพื่อใช้วิเคราะห์ในอนาคต

### 4. โครงสร้างข้อมูลที่ส่งไป Gemini (สรุป)

ให้ส่งเฉพาะข้อมูลที่จำเป็น เพื่อลด token และความเสี่ยงข้อมูลรั่ว:

- **recommendations:**  
  แต่ละ element อย่างน้อย: `vehicle_id`, `vehicle_plate`, `overall_score`, `capacity_info` (estimated vs max weight/volume), `scores` (capacity_fit, availability, …), `reasoning` (จาก rule-based)
- **loadSummary:**  
  `totalWeightKg`, `totalVolumeLiter`, `storeCount`
- **planned_date**, **branch**

ไม่ส่ง PII ที่ไม่จำเป็น (ชื่อลูกค้า, เบอร์โทร ฯลฯ) ถ้าไม่เกี่ยวกับการ “เลือกรถ”

### 5. การจัดการ Error และ Fallback

- ถ้า Gemini API ล้มหรือ timeout → แสดงข้อความว่า "ไม่สามารถวิเคราะห์ด้วย AI ได้ในขณะนี้ กรุณาดูคำแนะนำจากระบบด้านบน"
- ยังคงแสดงรายการรถจาก rule-based เหมือนเดิม

---

## สรุปสั้นๆ

| ขั้นตอน | สิ่งที่ทำ |
|--------|-----------|
| 1 | ใช้ Gemini เป็น **ชั้นวิเคราะห์เสริม** หลัง rule-based (ปุ่ม「วิเคราะห์ด้วย Gemini」) |
| 2 | เรียก Gemini ผ่าน **Supabase Edge Function หรือ Backend** ไม่เปิด API Key ใน frontend |
| 3 | ส่งเฉพาะ **รายการรถที่แนะนำ + สรุปสินค้า + วันที่ + สาขา** ในรูปแบบ JSON-friendly |
| 4 | ให้ Gemini ตอบเป็น **JSON** (recommended_vehicle_id, reasoning, alternative) แล้ว parse ใน server |
| 5 | แสดงผลใน **VehicleRecommendationPanel** หรือบล็อกใต้รายการรถ และเก็บ feedback ถ้าต้องการ |

**ตัวอย่างโค้ด:** Input ส่งไป Edge Function = `recommendations` (top 5), `loadSummary` (totalWeightKg, totalVolumeLiter, storeCount), `planned_date`, `branch`. Frontend เพิ่มปุ่ม「วิเคราะห์ด้วย Gemini」→ `supabase.functions.invoke('analyze-vehicle-with-gemini', { body })` แล้วแสดง reasoning. Edge Function เรียก Gemini (`gemini-1.5-flash`) ด้วย prompt ให้ตอบ JSON: `recommended_vehicle_id`, `reasoning`, `alternative_vehicle_id` — ตั้ง Secret `GEMINI_API_KEY`.

ถ้าทำตามนี้ โปรเจกต์ปัจจุบันจะยังใช้ rule-based เป็นหลัก และมี “การวิเคราะห์จาก Gemini” เป็นตัวเลือกเพิ่มเมื่อ user ต้องการความมั่นใจหรือเหตุผลที่อ่านง่ายก่อนตัดสินใจใช้รถคันไหน
