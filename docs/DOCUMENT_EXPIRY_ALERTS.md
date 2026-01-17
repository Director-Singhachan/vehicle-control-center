# 🔔 ระบบแจ้งเตือนวันหมดอายุเอกสารรถ

## 📋 ภาพรวม

ระบบจะตรวจสอบเอกสารที่ใกล้หมดอายุ (ภาษีรถ, ประกันรถ, พรบ., ทะเบียน) และสร้าง alerts อัตโนมัติ

---

## 🔄 วิธีการทำงาน

### 1. **Function: `check_vehicle_document_expiry()`**

Function นี้จะ:
- ✅ ตรวจสอบเอกสารที่มี `status = 'active'` และมี `expiry_date`
- ✅ คำนวณจำนวนวันที่เหลือจนถึงวันหมดอายุ
- ✅ สร้าง `vehicle_alerts` เมื่อเอกสารใกล้หมดอายุ (ภายใน `remind_before_days`)
- ✅ เปลี่ยน `status` เป็น `'expired'` เมื่อเอกสารหมดอายุแล้ว

### 2. **เงื่อนไขการสร้าง Alert**

Alert จะถูกสร้างเมื่อ:
- ✅ `expiry_date` อยู่ภายใน `remind_before_days` (ค่าเริ่มต้น: 30 วัน)
- ✅ `expiry_date` ยังไม่ผ่าน (ยังไม่หมดอายุ)
- ✅ ยังไม่มี alert ที่ active อยู่แล้ว (ป้องกัน duplicate)

### 3. **ระดับความรุนแรง (Severity)**

| จำนวนวันที่เหลือ | Severity | สี |
|-----------------|----------|-----|
| ≤ 7 วัน | `critical` | แดง |
| ≤ 30 วัน | `high` | เหลือง |
| > 30 วัน | `medium` | น้ำเงิน |

### 4. **ข้อความ Alert**

```
"เอกสาร {document_type} ของรถ {plate} จะหมดอายุในอีก {days} วัน"
```

ตัวอย่าง:
- "เอกสาร tax ของรถ กก-1234 จะหมดอายุในอีก 15 วัน"
- "เอกสาร insurance ของรถ กก-5678 จะหมดอายุในอีก 5 วัน"

---

## ⚙️ วิธีตั้งค่าให้ทำงานอัตโนมัติ

### วิธีที่ 1: ใช้ Supabase Cron (pg_cron) ⭐ **แนะนำ**

#### ขั้นตอนที่ 1: เปิดใช้งาน pg_cron Extension

```sql
-- ตรวจสอบว่า pg_cron เปิดใช้งานแล้วหรือยัง
SELECT * FROM pg_extension WHERE extname = 'pg_cron';

-- ถ้ายังไม่มี ให้เปิดใช้งาน (ต้องเป็น superuser)
CREATE EXTENSION IF NOT EXISTS pg_cron;
```

#### ขั้นตอนที่ 2: สร้าง Cron Job

```sql
-- เรียก function ทุกวันเวลา 09:00 น. (UTC)
SELECT cron.schedule(
  'check-vehicle-document-expiry',  -- Job name
  '0 9 * * *',                      -- Cron expression: ทุกวัน 09:00 UTC (16:00 เวลาไทย)
  $$SELECT check_vehicle_document_expiry()$$
);

-- หรือเรียกทุก 6 ชั่วโมง
SELECT cron.schedule(
  'check-vehicle-document-expiry-hourly',
  '0 */6 * * *',                    -- ทุก 6 ชั่วโมง
  $$SELECT check_vehicle_document_expiry()$$
);
```

#### ขั้นตอนที่ 3: ตรวจสอบ Cron Jobs

```sql
-- ดู cron jobs ทั้งหมด
SELECT * FROM cron.job;

-- ดูประวัติการรัน
SELECT * FROM cron.job_run_details 
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'check-vehicle-document-expiry')
ORDER BY start_time DESC 
LIMIT 10;
```

#### ขั้นตอนที่ 4: ลบ Cron Job (ถ้าต้องการ)

```sql
-- ลบ cron job
SELECT cron.unschedule('check-vehicle-document-expiry');
```

---

### วิธีที่ 2: ใช้ Supabase Edge Function + Cron Trigger

#### สร้าง Edge Function

```typescript
// supabase/functions/check-document-expiry/index.ts
import { createClient } from '@supabase/supabase-js'

Deno.serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  // เรียก function
  const { data, error } = await supabase.rpc('check_vehicle_document_expiry')

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  return new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
```

#### ตั้งค่า Cron Trigger ใน Supabase Dashboard

1. ไปที่ **Database** → **Cron Jobs**
2. สร้าง cron job ใหม่:
   - **Schedule**: `0 9 * * *` (ทุกวัน 09:00 UTC)
   - **Function**: `check-document-expiry`
   - **Method**: `POST`

---

### วิธีที่ 3: เรียกใช้ Manual (สำหรับทดสอบ)

```sql
-- เรียก function โดยตรง
SELECT check_vehicle_document_expiry();

-- ตรวจสอบ alerts ที่สร้างขึ้น
SELECT 
  va.*,
  v.plate,
  vd.document_type,
  vd.expiry_date
FROM vehicle_alerts va
JOIN vehicles v ON v.id = va.vehicle_id
LEFT JOIN vehicle_documents vd ON vd.vehicle_id = va.vehicle_id
WHERE va.alert_type = 'document_expiry'
  AND va.status = 'active'
ORDER BY va.created_at DESC;
```

---

## 📊 ตัวอย่างการทำงาน

### สถานการณ์ที่ 1: เอกสารใกล้หมดอายุ

**ข้อมูล:**
- รถ: กก-1234
- ประเภท: ภาษีรถ (tax)
- วันหมดอายุ: 2025-02-15
- เตือนล่วงหน้า: 30 วัน
- วันนี้: 2025-01-16 (เหลือ 30 วัน)

**ผลลัพธ์:**
- ✅ สร้าง alert: `severity = 'high'`
- ✅ ข้อความ: "เอกสาร tax ของรถ กก-1234 จะหมดอายุในอีก 30 วัน"

### สถานการณ์ที่ 2: เอกสารใกล้หมดอายุมาก

**ข้อมูล:**
- รถ: กก-5678
- ประเภท: ประกัน (insurance)
- วันหมดอายุ: 2025-02-10
- วันนี้: 2025-02-05 (เหลือ 5 วัน)

**ผลลัพธ์:**
- ✅ สร้าง alert: `severity = 'critical'`
- ✅ ข้อความ: "เอกสาร insurance ของรถ กก-5678 จะหมดอายุในอีก 5 วัน"

### สถานการณ์ที่ 3: เอกสารหมดอายุแล้ว

**ข้อมูล:**
- รถ: กก-9999
- ประเภท: พรบ. (inspection)
- วันหมดอายุ: 2025-01-01
- วันนี้: 2025-02-01 (หมดอายุแล้ว)

**ผลลัพธ์:**
- ✅ เปลี่ยน `status` จาก `'active'` เป็น `'expired'`
- ❌ ไม่สร้าง alert (เพราะหมดอายุแล้ว)

---

## 🔍 ตรวจสอบ Alerts

### ดู Alerts ทั้งหมด

```sql
SELECT 
  va.id,
  v.plate,
  va.alert_type,
  va.severity,
  va.message,
  va.status,
  va.created_at
FROM vehicle_alerts va
JOIN vehicles v ON v.id = va.vehicle_id
WHERE va.alert_type = 'document_expiry'
  AND va.status = 'active'
ORDER BY 
  CASE va.severity
    WHEN 'critical' THEN 1
    WHEN 'high' THEN 2
    WHEN 'medium' THEN 3
  END,
  va.created_at DESC;
```

### ดูเอกสารที่ใกล้หมดอายุ

```sql
SELECT 
  v.plate,
  vd.document_type,
  vd.expiry_date,
  vd.expiry_date - CURRENT_DATE AS days_until_expiry,
  vd.remind_before_days,
  vd.status
FROM vehicle_documents vd
JOIN vehicles v ON v.id = vd.vehicle_id
WHERE vd.status = 'active'
  AND vd.expiry_date IS NOT NULL
  AND vd.expiry_date <= CURRENT_DATE + (vd.remind_before_days || ' days')::INTERVAL
  AND vd.expiry_date > CURRENT_DATE
ORDER BY vd.expiry_date ASC;
```

---

## ⚠️ หมายเหตุสำคัญ

### 1. **ต้องตั้งค่า Cron Job**

Function `check_vehicle_document_expiry()` **จะไม่ทำงานอัตโนมัติ** จนกว่าจะตั้งค่า cron job หรือเรียกใช้ manual

### 2. **Timezone**

- Cron expression ใช้ UTC time
- เวลาไทย = UTC + 7 ชั่วโมง
- ตัวอย่าง: `0 9 * * *` = 09:00 UTC = 16:00 เวลาไทย

### 3. **Performance**

- Function จะ scan เอกสารทั้งหมดที่มี `expiry_date`
- ถ้ามีเอกสารเยอะมาก อาจใช้เวลาสักหน่อย
- แนะนำให้รันทุกวัน 1 ครั้ง หรือทุก 6-12 ชั่วโมง

### 4. **Duplicate Prevention**

- Function จะตรวจสอบว่า alert มีอยู่แล้วหรือไม่ก่อนสร้างใหม่
- ใช้ `message LIKE '%{document_type}%'` เพื่อตรวจสอบ
- ถ้ามี alert ที่ `status = 'active'` อยู่แล้ว จะไม่สร้างซ้ำ

---

## 🛠️ Troubleshooting

### Alert ไม่ถูกสร้าง

**ตรวจสอบ:**
1. ✅ เอกสารมี `expiry_date` หรือไม่
2. ✅ `status = 'active'` หรือไม่
3. ✅ `expiry_date` อยู่ภายใน `remind_before_days` หรือไม่
4. ✅ มี alert ที่ active อยู่แล้วหรือไม่ (ถ้ามี จะไม่สร้างซ้ำ)

### Cron Job ไม่ทำงาน

**ตรวจสอบ:**
1. ✅ pg_cron extension เปิดใช้งานแล้วหรือยัง
2. ✅ Cron job ถูกสร้างแล้วหรือยัง (`SELECT * FROM cron.job`)
3. ✅ ดู error logs: `SELECT * FROM cron.job_run_details WHERE status = 'failed'`

### Alert ถูกสร้างซ้ำ

**แก้ไข:**
- Function มีการตรวจสอบ duplicate อยู่แล้ว
- ถ้ายังมีปัญหา อาจต้องลบ alerts เก่าที่ `status = 'active'` ก่อน

---

## 📝 สรุป

1. **Function `check_vehicle_document_expiry()`** ตรวจสอบและสร้าง alerts
2. **ต้องตั้งค่า Cron Job** เพื่อให้ทำงานอัตโนมัติ
3. **Alerts จะแสดงใน `vehicle_alerts` table**
4. **Severity ขึ้นอยู่กับจำนวนวันที่เหลือ**
5. **เอกสารที่หมดอายุจะถูกเปลี่ยน status เป็น `'expired'`**
