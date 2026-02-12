# วิธีแก้ไขเมื่อเคสนอกทริปถูกผูกกับ delivery_trip ผิด

## ปัญหา

- รถออกใช้งานทั่วไป (เคสนอกทริป) — ไม่มีทริปส่งของ
- ขณะรถใช้งาน คุณสร้าง delivery_trip กำหนดรถคันเดียวกัน (รอรถกลับแล้วค่อยขึ้นสินค้าแล้วออกทริป)
- เมื่อรถกลับมาและลงขากลับ ระบบเดิมไป**ผูก trip_log กับ delivery_trip นั้นโดยอัตโนมัติ** (ผิด)
- ผล: delivery_trip กลายเป็น completed ทั้งที่ยังไม่ได้ออกส่งของ และร้านถูก mark ว่า delivered

## วิธีแก้ไขข้อมูลที่ผิดไปแล้ว

มี 2 ทางเลือกหลัก

---

### วิธีที่ 1: ใช้ SQL ใน Supabase (แนะนำ)

1. เปิด **Supabase Dashboard** → **SQL Editor**
2. เปิดไฟล์ `sql/fix_unlink_trip_log_from_delivery_trip.sql`

**Step 1 – ดูรายการที่อาจผูกผิด**

- รัน query ชุดแรกในสคริปต์ (Step 1) เพื่อดู trip_log ทั้งหมดที่ผูกกับ delivery_trip
- รัน query ชุดที่สองเพื่อดูเฉพาะรายการที่ **น่าผูกผิด** (delivery_trip ถูกสร้าง**หลัง**เวลาออกรถ)

**Step 2 – แก้เฉพาะรายการที่ต้องการ**

- ในบล็อก `DO $$ ... END $$` ของ Step 2 ให้ใส่ **trip_log_id** จริงที่ต้องการแก้ (แทน `00000000-0000-0000-0000-000000000000`)
- รันบล็อกนั้น

ระบบจะ:

- ยกเลิกการผูก: `trip_logs.delivery_trip_id = NULL`
- Reset delivery_trip: `status = 'planned'`, `odometer_start/end = NULL`
- Reset ร้านในทริป: `delivery_trip_stores.delivery_status = 'pending'`, `delivered_at = NULL`

**Step 3 (ถ้าต้องการ) – แก้ทีเดียวหลายรายการ**

- รัน Step 3 ในสคริปต์จะแก้**ทุก**รายการที่ตรงเงื่อนไข “ทริปสร้างหลังเวลาออกรถ”
- แนะนำให้รัน Step 1 ก่อน แล้วตรวจรายการให้มั่นใจก่อนรัน Step 3

---

### วิธีที่ 2: ใช้ปุ่มในแอป (Admin/Manager/Executive)

ใน **หน้ารายการทริป (Trip Log)**:

- สำหรับทริปที่ **กลับแล้ว** (checked_in) และ **มีการผูกกับทริปส่งของ** (มีเลข DT-xxx แสดง) จะมีลิงก์ **"ยกเลิกการผูก"** อยู่ข้างป้ายเลขทริปส่งของ และมีปุ่ม **"ยกเลิกการผูกทริปส่งของ"** ในแถบปุ่มด้านล่างการ์ด
- ปุ่ม/ลิงก์เหล่านี้ **แสดงเฉพาะผู้ใช้ที่มี role admin, manager หรือ executive** เท่านั้น

ถ้า**ไม่เห็นปุ่มหรือลิงก์** ให้ตรวจสอบ:
1. **สิทธิ์** — บัญชีที่ล็อกอินต้องเป็น Admin / Manager / Executive (ถ้าไม่ใช่ให้ใช้วิธีที่ 1 กับ SQL)
2. **ทริปที่เลือก** — ต้องเป็นทริปที่สถานะ "กลับแล้ว" และมีเลขทริปส่งของ (เช่น DT-2602-xxxx) แสดงอยู่

ถ้าต้องการเรียกจากโค้ด (เช่น Console):

```js
// ใส่ trip_log_id จริงที่ได้จากหน้ารายการทริป หรือจาก Step 1 ใน SQL
const tripLogId = 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx';
const result = await window.tripLogService?.unlinkFromDeliveryTrip(tripLogId);
console.log('Unlinked:', result);
```

(แอปอาจไม่ได้ expose `tripLogService` ที่ `window` — ในกรณีนั้นให้ใช้ SQL วิธีที่ 1)

---

## สิ่งที่ได้หลังแก้

- **trip_log**: ยังอยู่ status `checked_in` แต่ `delivery_trip_id` เป็น `NULL` → แสดงว่าเป็นเคสนอกทริป (ใช้งานทั่วไป)
- **delivery_trip**: กลับเป็น `status = 'planned'` พร้อม `odometer_start/end = NULL` → พร้อมให้ออกทริปส่งของเมื่อรถกลับและขึ้นสินค้าแล้ว
- **delivery_trip_stores**: `delivery_status = 'pending'`, `delivered_at = NULL` → ร้านยังไม่นับว่าได้รับสินค้า

---

## หมายเหตุ

- **Commission**: ถ้ามีการคำนวณ commission จากทริปที่ผูกผิด อาจต้องตรวจ/แก้ในระบบ commission แยกต่างหาก
- **การป้องกันซ้ำ**: โค้ดฝั่ง check-in ถูกแก้แล้ว ไม่มีการ auto-link จาก vehicle+date ตอนลงขากลับ ดังนั้นเคสแบบนี้จะไม่เกิดขึ้นกับทริปใหม่
