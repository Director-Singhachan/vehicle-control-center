---
name: "แผนพัฒนาระบบแนะนำรถให้ฉลาดขึ้น (ฉบับปรับปรุง)"
overview: "ปรับปรุง vehicle recommendation 3 phases: (1) time-decay + similar-filter + busy-level (2) district + category match (3) AI Edge Function + feedback loop — ไม่ต้อง SQL migration ทั้ง Phase 1+2"
todos:
  - id: phase1a
    content: "Time-decay บน Historical Stats"
    status: pending
  - id: phase1b
    content: "กรองทริป Store Overlap ≥ 50% + เก็บ per-trip records"
    status: pending
  - id: phase1c
    content: "Busy Level แทน Busy Boolean"
    status: pending
  - id: phase1_parallel
    content: "⚡ Parallel Data Fetching (Promise.all)"
    status: pending
  - id: phase2d
    content: "District/Zone Familiarity (parse จาก address)"
    status: pending
  - id: phase2e
    content: "Product Category Match"
    status: pending
  - id: phase2_cache
    content: "🔧 Caching Layer สำหรับ Historical Stats"
    status: pending
  - id: phase3f
    content: "เปิดใช้ Gemini Edge Function (deploy + secrets)"
    status: pending
  - id: phase3g
    content: "Feedback Loop ปรับ WEIGHTS อัตโนมัติ"
    status: pending
isProject: false
---

# แผนพัฒนาระบบแนะนำรถให้ฉลาดขึ้น (ฉบับปรับปรุง)

ระบบปัจจุบันใช้ rule-based scoring 8 มิติ (รวม 60% จากประวัติ) ใน `services/vehicleRecommendationService.ts`

---

## สิ่งที่ค้นพบจากการวิเคราะห์ Codebase ✅

| เรื่อง | สถานะ |
|--------|--------|
| **AI panel ใน UI** | มีครบแล้ว — `VehicleSelectionStep` + `VehicleRecommendationPanel` มี toggle AI, cooldown, แสดง packing_tips |
| **`ai_trip_recommendations` table** | มี schema + RLS + indexes ครบ (ตาราง feedback accepted/rejected) |
| **Edge Function** | มีโค้ดตัวอย่างที่ `supabase/functions/ai-trip-recommendation/` แค่ต้อง deploy |
| **District data** | **ไม่ได้เป็น column ใน DB** — parse จาก address text ด้วย `parseThaiAddress()` ใน `utils/parseThaiAddress.ts` → **ไม่ต้องมี SQL migration** |
| **Product category** | คอลัมน์ `products.category` มีอยู่ใน DB แต่ **ยังไม่ถูกใช้ใน recommendation** |
| **`get_similar_trips` SQL** | มีอยู่แล้ว ดึงทริปคล้ายกันได้ 365 วัน แต่ **vehicleRecommendationService ไม่ได้ใช้** (ใช้แค่ใน AI context) |

---

## Phase 1: ปรับปรุงโดยไม่เปลี่ยน Schema

> [!TIP]
> ทำทั้ง 3 ข้อได้ในไฟล์เดียว แก้แค่ `vehicleRecommendationService.ts` ไม่กระทบ UI/DB

### A. Time-decay บน Historical Stats

#### [MODIFY] `services/vehicleRecommendationService.ts`

**ปัจจุบัน:** `getHistoricalStats()` ดึง 90 วัน ทุกทริปน้ำหนักเท่ากัน
**ปรับเป็น:** ดึง `planned_date` ด้วย แล้วถ่วงน้ำหนัก:

| ช่วงเวลา | decay weight | เหตุผล |
|-----------|-------------|--------|
| 0-30 วัน | **1.0** | ข้อมูลล่าสุด ตรงสภาพจริงที่สุด |
| 31-60 วัน | **0.7** | ยังมีประโยชน์ แต่สภาพอาจเปลี่ยน |
| 61-90 วัน | **0.4** | เก่า ใช้เสริมเท่านั้น |

**จุดแก้ไข:** ใน loop `for (const trip of trips)` ที่ aggregate stats (บรรทัด ~517-567) เพิ่ม decay weight ก่อนคำนวณ weighted average

> [!TIP] **ลำดับ implement Phase 1A + 1B**
> ทั้งสองฟีเจอร์แก้ `getHistoricalStats()` ควรทำรวมกัน: (1) ดึง `planned_date` + `store_ids` ต่อทริป → (2) filter เฉพาะทริป overlap ≥ 50% → (3) คำนวณ weighted average ด้วย decay weight จากทริปที่ filter แล้ว

---

### B. กรองทริปคล้ายกันจริงๆ (Store Overlap ≥ 50%)

**ปัจจุบัน:** `scoreHistoricalSuccess()` นับ **ทุก** ทริปของรถ ไม่สนว่าส่งร้านไหน
**ปรับเป็น:** แยก `HistoricalTripStats` เป็น 2 ระดับ:

```
all_trips_stats     → ใช้ใน scoreHistoricalSuccess (ประวัติรวม)
similar_trips_stats → ใช้ใน scoreLoadSimilarity (เฉพาะทริปที่ overlap ≥ 50%)
```

**เพิ่ม per-trip records ใน HistoricalTripStats:**
```ts
interface TripRecord {
  planned_date: string;
  store_ids: string[];
  actual_weight_kg: number | null;
  utilization: number | null;
  packing_score: number | null;
  had_issues: boolean;
}
```
ใช้โครงสร้างเดียวกันสำหรับทั้ง time-decay (A) และ similar-filter (B)

> [!NOTE]
> ข้อมูล `delivery_trip_stores` ถูกดึงมาแล้วใน `getHistoricalStats()` — แค่ต้องเก็บ per-trip ไว้ด้วย แทนที่จะรวมเป็น flat array

---

### C. Busy Level แทน Busy Boolean

#### [MODIFY] `services/vehicleRecommendationService.ts`

**ปัจจุบัน:** `getBusyVehicles()` คืน `Set<string>` → `scoreAvailability()` ให้ 10 หรือ 100
**ปรับเป็น:** คืน `Map<string, number>` (vehicle_id → trip count)

| trip count | score | reasoning |
|------------|-------|-----------|
| 0 | **100** | ว่างทั้งวัน |
| 1 | **50** | มี 1 ทริปแล้ว อาจซ้อนได้ |
| 2+ | **10** | แน่นมาก |

---

### ⚡ Parallel Data Fetching (Bonus Phase 1)

#### [MODIFY] `services/vehicleRecommendationService.ts`

**ปัจจุบัน:** `getRecommendations()` fetch sequential: vehicles → load → busy → historical
**ปรับเป็น:**
```ts
const [vehicles, loadEstimate, busyVehicleIds, historicalStats] = await Promise.all([
  fetchVehicles(),
  estimateLoad(input.items),
  getBusyVehicles(input.planned_date),
  getHistoricalStats(),
]);
```
→ ลดเวลารอ ~60% (4 round-trip เหลือ 1)

---

## Phase 2: เพิ่มมิติใหม่ (ไม่ต้อง Migration!)

> [!IMPORTANT]
> **จากการวิเคราะห์พบว่า Phase 2 ทั้งสองข้อไม่ต้องมี SQL migration**
> - District: parse จาก `stores.address` ด้วย `parseThaiAddress()` ที่มีอยู่แล้ว
> - Category: `products.category` มีอยู่ใน DB อยู่แล้ว แค่ยังไม่ได้ดึงมาใช้

### D. District/Zone Familiarity

#### [MODIFY] `services/vehicleRecommendationService.ts`

1. เพิ่มฟังก์ชัน `getStoreDistricts(storeIds)` — ดึง `address` จาก `stores` table แล้ว parse ด้วย `parseThaiAddress()` → คืน `Map<string, string>` (storeId → districtKey)
2. ใน `getHistoricalStats()` ดึง address/district ของร้านในแต่ละทริปด้วย
3. เพิ่มฟังก์ชัน `scoreDistrictFamiliarity()`:

| เงื่อนไข | score |
|----------|-------|
| รถเคยส่งอำเภอเดียวกัน ≥ 70% | **100** |
| เคยส่งอำเภอเดียวกัน ≥ 30% | **75** |
| เคย แต่น้อยกว่า 30% | **55** |
| ไม่เคยเลย | **40** |

---

### E. Product Category Match

#### [MODIFY] `services/vehicleRecommendationService.ts`

1. ใน `estimateLoad()` ดึง `category` จาก products ด้วย (มีอยู่แล้วแต่ยังไม่เก็บ)
2. ใน `getHistoricalStats()` ดึง `delivery_trip_items → products.category` → เพิ่ม `product_categories: string[]`
3. เพิ่มฟังก์ชัน `scoreCategoryMatch()`:

| เงื่อนไข | score |
|----------|-------|
| หมวดสินค้าตรง ≥ 80% | **100** |
| ตรง ≥ 50% | **80** |
| ตรงบางส่วน | **60** |
| ไม่ตรงเลย | **40** |

---

### 🔧 Caching Layer (Bonus Phase 2)

#### [MODIFY] `services/vehicleRecommendationService.ts`

`getHistoricalStats()` ถูกเรียก **ทุกครั้ง** ที่ออเดอร์เปลี่ยน (debounce 800ms) → query DB ซ้ำบ่อย

เพิ่ม in-memory cache ที่ invalidate ทุก 5 นาที:
```ts
let _statsCache: { data: HistoricalTripStats[]; ts: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
```

---

## WEIGHTS หลังปรับปรุงทั้งหมด

| มิติ | ปัจจุบัน | Phase 1+2 | เหตุผล |
|------|---------|-----------|--------|
| `historical_success` | 25% | **22%** | ลดเล็กน้อย เพราะมี new dimensions |
| `load_similarity` | 18% | **16%** | ลดเล็กน้อย |
| `capacity_fit` | 18% | **18%** | คงเดิม — ต้องบรรทุกได้เป็นสำคัญ |
| `store_familiarity` | 17% | **14%** | ลดเล็กน้อย district ช่วยเสริม |
| `pallet_efficiency` | 8% | **8%** | คงเดิม |
| `product_compatibility` | 6% | **6%** | คงเดิม — เรื่อง fragile/temp |
| `availability` | 5% | **3%** | ลด — busy level ละเอียดขึ้น |
| `branch_match` | 5% | **3%** | ลด — district familiarity ช่วยเสริม |
| `district_familiarity` | — | **5%** | **ใหม่** — รู้จักโซนพื้นที่ |
| `category_match` | — | **5%** | **ใหม่** — สินค้าตรงกับที่เคยส่ง |
| **รวม** | **100%** | **100%** | |

---

## Phase 3: AI Layer

> [!NOTE]
> โครงสร้างพร้อมแล้ว ทั้ง UI, service method, Edge Function template, และ feedback table

### F. เปิดใช้ Gemini Edge Function

**ขั้นตอนที่ต้องทำ (ไม่ต้องแก้โค้ด):**
1. ใส่ `GEMINI_API_KEY` ใน Supabase → Dashboard → Edge Functions → Secrets
2. `supabase functions deploy ai-trip-recommendation`

**เมื่อ deploy แล้ว:** ปุ่ม "✨ ใช้ AI แนะนำ" ใน `VehicleRecommendationPanel` จะทำงานทันที — มี cooldown 60 วิ + retry logic + fallback to rule-based อยู่แล้ว

> [!TIP] **ข้อเสนอแนะ Phase 3**
> - ใช้ **feature flag** หรือ env var เพื่อเปิด/ปิด AI recommendation
> - มี **fallback** เมื่อ AI fail: ใช้ rule-based เป็นค่าเริ่มต้นเสมอ
> - อ้างอิง doc: `docs/AI_RECOMMENDATION_API.md`

---

### G. Feedback Loop ปรับ WEIGHTS อัตโนมัติ

#### [MODIFY] `services/vehicleRecommendationService.ts`

เพิ่มเมธอด `computeDynamicWeights()` อ่าน feedback จาก `ai_trip_recommendations`:
- ดึง records ที่ `status = 'accepted'` ล่าสุด 100 รายการ
- วิเคราะห์ว่า accepted recommendations มี score profile อย่างไร
- ปรับ WEIGHTS ∆ ≤ ±0.03 ต่อรอบ (clamp ที่ ±30% จาก baseline)

> [!CAUTION]
> ควรมี **feature flag** เปิด/ปิด dynamic weights ได้ เพราะถ้า feedback data น้อย → weights อาจเอนเอียงผิดทาง

---

## Verification Plan

### Automated Tests

สร้างใหม่: `src/test/services/vehicleRecommendationService.test.ts`

```bash
npx vitest run src/test/services/vehicleRecommendationService.test.ts
```

| Test | สิ่งที่ทดสอบ |
|------|-------------|
| time-decay weighted average | ทริป 30 วันล่าสุด ทำให้คะแนนสูงกว่าทริป 90 วันก่อน |
| store overlap filter | ทริปที่ overlap < 50% ไม่นับเป็น similar_trips_stats |
| busy level scoring | tripCount=0→100, =1→50, =2+→10 |
| district familiarity | รถเคยส่ง district เดียวกัน ≥ 70% → 100 |
| category match | สินค้าตรงหมวด ≥ 80% → 100 |
| parallel fetching | `Promise.all` ทำงานถูก ไม่มี race condition |
| cache invalidation | cache หมดอายุหลัง 5 นาที ต้อง re-fetch |
| WEIGHTS sum = 1.0 | หลังเปลี่ยนน้ำหนักต้อง sum = 1.0 |
| empty input | `store_ids: []` หรือ `items: []` ไม่ crash |

### Manual Verification

1. `npm run dev` → ไปหน้าสร้างทริป → ขั้น "เลือกรถ"
2. ตรวจ reasoning ใหม่มีข้อมูลครบถ้วน
3. ตรวจว่ารถที่เพิ่งวิ่งใน 30 วันและเคยส่ง district เดียวกัน → อยู่อันดับต้น
4. ตรวจว่ารถที่มีทริปอยู่แล้ววันนั้น → แสดง "⚠️ มีทริป X เที่ยว"

---

## ลำดับแนะนำ (Execution Order)

```
Phase 1 (ทำพร้อมกัน 1 commit)
├── A. Time-decay
├── B. Similar-trips filter
├── C. Busy level
└── ⚡ Parallel fetch (bonus)

Phase 2 (ทำพร้อมกัน 1 commit)
├── D. District familiarity
├── E. Category match
└── 🔧 Caching layer (bonus)

Phase 3 (แยก 2 commits)
├── F. Deploy Edge Function (ไม่ต้องแก้โค้ด)
└── G. Feedback loop (ต้อง feature flag)
```
