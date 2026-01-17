# 📋 วิธีกำหนด owner_group

## 🎯 วิธีกำหนด owner_group

### วิธีที่ 1: ผ่าน UI (แนะนำ) ⭐

**ในฟอร์มเพิ่ม/แก้ไขรถ:**

1. ไปที่หน้า **ยานพาหนะ** → คลิก **เพิ่มยานพาหนะ** หรือ **แก้ไข**
2. ในฟอร์มจะมี dropdown **"กลุ่มเจ้าของรถ"**
3. เลือก:
   - **บริษัทไทยกิจ** → `thaikit`
   - **บริษัทสิงห์จันทบุรีจำกัด** → `sing_chanthaburi`
   - **รถเช่า** → `rental`
   - **-- ไม่ระบุ --** → ไม่กำหนด (NULL)
4. คลิก **บันทึก**

**ง่ายมาก! ไม่ต้องเขียน SQL**

---

### วิธีที่ 2: ผ่าน Supabase Dashboard

1. ไปที่ [Supabase Dashboard](https://app.supabase.com)
2. เลือก **Table Editor** → **vehicles**
3. คลิกแถวที่ต้องการแก้ไข
4. ในคอลัมน์ **owner_group** เลือก:
   - `thaikit` (บริษัทไทยกิจ)
   - `sing_chanthaburi` (บริษัทสิงห์จันทบุรีจำกัด)
   - `rental` (รถเช่า)
   - หรือเว้นว่างไว้ (NULL)
5. คลิก **Save**

---

### วิธีที่ 3: ผ่าน SQL

#### อัปเดตรถคันเดียว:

```sql
UPDATE public.vehicles
SET owner_group = 'thaikit'  -- หรือ 'sing_chanthaburi', 'rental'
WHERE id = 'vehicle-id-here';
```

#### อัปเดตรถหลายคัน:

```sql
-- อัปเดตรถทั้งหมดที่ป้ายทะเบียนขึ้นต้นด้วย "กก"
UPDATE public.vehicles
SET owner_group = 'thaikit'
WHERE plate LIKE 'กก%';

-- อัปเดตรถทั้งหมดที่สาขา = 'บางนา'
UPDATE public.vehicles
SET owner_group = 'sing_chanthaburi'
WHERE branch = 'บางนา';
```

#### ลบ owner_group (ตั้งเป็น NULL):

```sql
UPDATE public.vehicles
SET owner_group = NULL
WHERE id = 'vehicle-id-here';
```

---

## 📊 ค่าที่ใช้ได้

| ค่า | ข้อความที่แสดง | สี Badge |
|-----|----------------|----------|
| `thaikit` | บริษัทไทยกิจ | น้ำเงิน |
| `sing_chanthaburi` | บริษัทสิงห์จันทบุรีจำกัด | เขียว |
| `rental` | รถเช่า | ม่วง |
| `NULL` | ไม่แสดง | - |

---

## 🔍 ตรวจสอบ owner_group

### ดูใน UI:

- **หน้า VehiclesView**: แสดง badge ใต้ชื่อรถ
- **หน้า VehicleDetailView**: แสดง badge ใต้ชื่อรถใน header

### ดูใน Database:

```sql
-- ดูรถทั้งหมดพร้อม owner_group
SELECT 
  plate,
  make,
  model,
  owner_group,
  CASE owner_group
    WHEN 'thaikit' THEN 'บริษัทไทยกิจ'
    WHEN 'sing_chanthaburi' THEN 'บริษัทสิงห์จันทบุรีจำกัด'
    WHEN 'rental' THEN 'รถเช่า'
    ELSE 'ไม่ระบุ'
  END AS owner_group_label
FROM vehicles
ORDER BY owner_group, plate;

-- นับจำนวนรถแต่ละกลุ่ม
SELECT 
  owner_group,
  COUNT(*) as count
FROM vehicles
GROUP BY owner_group
ORDER BY owner_group;
```

---

## ⚠️ ข้อจำกัด

1. **Constraint**: Database มี constraint ว่า `owner_group` ต้องเป็น:
   - `'thaikit'`
   - `'sing_chanthaburi'`
   - `'rental'`
   - หรือ `NULL`

2. **ไม่สามารถเพิ่มค่าใหม่ได้** โดยไม่แก้ไข migration

3. **ถ้าต้องการเพิ่มค่าใหม่** (เช่น `'other'`):
   - แก้ไข SQL migration
   - รัน migration ใหม่
   - อัปเดต `VehicleGroupBadge.tsx` เพื่อเพิ่มสีใหม่

---

## 💡 Best Practice

1. **กำหนด owner_group ตอนเพิ่มรถ** → ง่ายต่อการจัดการ
2. **ใช้ UI** → ไม่ต้องเขียน SQL
3. **ตรวจสอบข้อมูล** → ใช้ SQL query เพื่อดูสรุป

---

## 🎨 การแสดงผล

เมื่อกำหนด `owner_group` แล้ว:

- ✅ **VehiclesView**: แสดง badge สีตามกลุ่มใต้ชื่อรถ
- ✅ **VehicleDetailView**: แสดง badge ใน header
- ✅ **กรองข้อมูล**: สามารถกรองตาม `owner_group` ได้ (ถ้าเพิ่มฟีเจอร์นี้ในอนาคต)

---

## 📝 ตัวอย่างการใช้งาน

### ตัวอย่างที่ 1: กำหนดตอนเพิ่มรถ

```
1. คลิก "เพิ่มยานพาหนะ"
2. กรอกข้อมูลรถ
3. เลือก "กลุ่มเจ้าของรถ" = "บริษัทไทยกิจ"
4. บันทึก
```

### ตัวอย่างที่ 2: แก้ไขรถที่มีอยู่แล้ว

```
1. ไปที่หน้า "ยานพาหนะ"
2. คลิก "แก้ไข" ที่รถที่ต้องการ
3. เปลี่ยน "กลุ่มเจ้าของรถ" เป็น "รถเช่า"
4. บันทึก
```

### ตัวอย่างที่ 3: อัปเดตหลายคันพร้อมกัน (SQL)

```sql
-- ตั้งค่ารถเช่าทั้งหมดให้เป็น 'rental'
UPDATE public.vehicles
SET owner_group = 'rental'
WHERE type LIKE '%เช่า%' OR branch LIKE '%เช่า%';
```
