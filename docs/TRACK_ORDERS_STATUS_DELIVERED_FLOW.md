# หน้าติดตามออเดอร์ — สาเหตุที่สถานะเปลี่ยนเป็น "จัดส่งเสร็จแล้ว"

## ข้อมูลที่หน้าแสดง

- **หน้า:** `views/TrackOrdersView.tsx` (ติดตามออเดอร์ ฝ่ายขาย)
- **แหล่งข้อมูล:** `ordersService.getAll()` → อ่านจาก view `orders_with_details`
- **สถานะที่แสดง:** มาจากคอลัมน์ **`orders.status`** ในฐานข้อมูลเท่านั้น (ไม่มี logic คำนวณในฝั่งแอป)

ดังนั้น ถ้าสถานะจะเปลี่ยนเป็น **"จัดส่งแล้ว"** ได้ ต้องมีที่ไหนสักแห่งที่ **อัปเดต `orders.status = 'delivered'`** ใน DB

---

## โฟลว์ที่ทำให้สถานะเปลี่ยนเป็น "จัดส่งเสร็จแล้ว"

### 1) ผู้ใช้ลงเลขไมล์ขากลับ (check-in)

- ใช้ฟอร์มลง "เลขไมล์ขากลับ" (checkin) ในระบบ
- ฝั่งแอปเรียก `tripLogService.updateCheckin(...)` → อัปเดต `trip_logs` (odometer_end, checkin_time, status = 'checked_in')

### 2) ระบบหาทริปจัดส่งที่ตรงกับ trip log นี้

- **กรณีที่ 1:** `trip_logs.delivery_trip_id` ถูกตั้งไว้ตอน checkout → ใช้ทริปนี้
- **กรณีที่ 2:** ไม่มี `delivery_trip_id` → หาจาก `vehicle_id` + `planned_date` ของวัน checkout; ถ้ามีแค่ **1 ทริป** จึงจะผูกและอัปเดตทริปนั้น (ถ้ามีหลายทริปจะไม่ auto-link เพื่อกันผูกผิด)

ถ้า **หา delivery trip ไม่ได้** (เช่น ไม่ได้ checkout ผ่านทริปจัดส่ง / ใช้รถนอกทริป) ขั้นตอนต่อไปจะไม่รัน → **ทริปไม่ถูกปิด → สถานะออเดอร์ไม่เปลี่ยน**

### 3) ปิดทริปจัดส่ง

- อัปเดต `delivery_trips`:
  - `status = 'completed'`
  - `odometer_end = เลขไมล์ขากลับ`
- อัปเดต `delivery_trip_stores`:
  - `delivery_status = 'delivered'`, `delivered_at = checkin_time`

### 4) อัปเดตยอดส่งและสถานะออเดอร์ (สองทาง)

| ช่องทาง | เหตุการณ์ | ผลต่อสถานะออเดอร์ |
|--------|------------|---------------------|
| **A. Trigger ใน DB** | เมื่อ `delivery_trips.status` เปลี่ยนเป็น `'completed'` → trigger `trg_sync_fulfilled_on_trip_complete` รัน | อัปเดต `order_items.quantity_delivered` แล้วคำนวณ sum ครบหรือไม่ → อัปเดต `orders.status` เป็น `'delivered'` หรือ `'partial'` |
| **B. RPC จากแอป** | หลังอัปเดตทริปแล้ว แอปเรียก `syncQuantityDeliveredForCompletedTrip(tripId)` → RPC `backfill_quantity_delivered_for_trip` | Logic เดียวกับ trigger: backfill ยอดส่ง แล้วอัปเดต `orders.status` เป็น `'delivered'` / `'partial'` |

สูตรที่ใช้ตัดสิน "จัดส่งครบ" (ทั้ง trigger และ RPC):

- สำหรับแต่ละออเดอร์ที่ร้านอยู่ในทริปนี้:
  - `v_total_qty` = ผลรวม `order_items.quantity`
  - `v_total_fulfilled` = ผลรวม `(quantity_picked_up_at_store + quantity_delivered)` ทุกบรรทัด
- ถ้า **v_total_fulfilled >= v_total_qty** → `orders.status = 'delivered'`
- ถ้า v_total_fulfilled > 0 แต่ยังไม่ครบ → `orders.status = 'partial'`

หมายเหตุ: รายการที่ `fulfillment_method = 'pickup'` ใช้ `quantity_picked_up_at_store` เป็นหลัก; รายการส่งใช้ `quantity_delivered` (ที่ได้จากยอดในทริปที่ completed)

### 5) หน้าที่ "ติดตามออเดอร์" อ่านค่าล่าสุด

- `TrackOrdersView` โหลดออเดอร์จาก `orders_with_details` (ซึ่งดึง `o.*` จาก `orders`)
- ดังนั้นเมื่อ `orders.status` ถูกอัปเดตเป็น `'delivered'` แล้ว หลัง refresh หรือโหลดใหม่ หน้าจะแสดง **"จัดส่งแล้ว"**

---

## สรุป: สาเหตุที่สถานะ "ไปเปลี่ยนเป็นส่งสำเร็จแล้ว"

สถานะเปลี่ยนเป็น "จัดส่งเสร็จแล้ว" ได้ **เฉพาะเมื่อ** โฟลว์ด้านบนทำงานครบ โดยสรุปคือ:

1. **ลงเลขไมล์ขากลับ (check-in)** แล้ว
2. **trip log ถูกผูกกับ delivery trip** (ตอน checkout หรือ fallback vehicle+date ได้ทริปเดียว)
3. **ทริปถูกปิด** → `delivery_trips.status = 'completed'`
4. **Trigger หรือ RPC ทำงาน** → อัปเดต `order_items.quantity_delivered` และคำนวณว่าออเดอร์ครบหรือไม่
5. **อัปเดต `orders.status`** เป็น `'delivered'` สำหรับออเดอร์ที่ส่งครบแล้ว

ดังนั้น **สาเหตุที่สถานะไปเปลี่ยนเป็นส่งสำเร็จแล้ว** คือ: การลงเลขไมล์ขากลับที่ทำให้ทริปถูกปิด และ trigger/RPC อัปเดตยอดส่งจนครบตามสูตรด้านบน แล้วระบบจึงตั้ง `orders.status = 'delivered'` ซึ่งหน้าติดตามออเดอร์อ่านมาแสดง

---

## กรณีที่สถานะไม่อัปเดตเป็น "จัดส่งแล้ว"

ถ้าหน้าติดตามออเดอร์ยังไม่แสดง "จัดส่งแล้ว" หลังรถกลับและลงเลขไมล์แล้ว อาจเป็นได้ว่า:

| สาเหตุ | ตรวจสอบ / แก้ไข |
|--------|-------------------|
| **trip log ไม่ได้ผูกกับ delivery trip** | ตรวจว่า checkout ตอนออกเดินทางเลือกทริปจัดส่งแล้ว หรือว่า fallback (vehicle+date) หาทริปได้แค่ตัวเดียว |
| **ทริปไม่ถูกปิด (status ไม่ใช่ completed)** | ดู `delivery_trips.status` ของทริปนั้น; ถ้ายังเป็น planned/in_progress ให้ใช้ sync จากเมนูที่เรียก `syncStatusWithTripLogs()` หรือรัน script ที่อัปเดตทริปเป็น completed |
| **Trigger ไม่ได้ติดตั้งใน DB** | ตรวจว่ามี trigger `trg_sync_fulfilled_on_trip_complete` บน `delivery_trips` และ function `sync_fulfilled_quantities_on_trip_complete` |
| **RPC backfill error** | ดู console/ล็อกหลัง check-in ว่ามี error จาก `syncQuantityDeliveredForCompletedTrip` หรือไม่; ตรวจว่า function `backfill_quantity_delivered_for_trip` มีใน DB และรันได้ |
| **ออเดอร์ยังส่งไม่ครบ** | มีบางบรรทัดยังไม่ครบ (รวม pickup + delivery) จึงได้แค่ `partial` ไม่ใช่ `delivered` |

ไฟล์ที่เกี่ยวข้องกับโฟลว์นี้:

- หน้า: `views/TrackOrdersView.tsx` — มีปุ่ม "รีเฟรช" และโหลดใหม่เมื่อกลับมาเปิดแท็บ
- Service ออเดอร์: `services/ordersService.ts` (getAll, markPickupItemsFulfilled)
- ปิดทริป + sync: `services/tripLogService.ts` (หลัง checkin), `services/deliveryTrip/tripStatusService.ts` (syncQuantityDeliveredForCompletedTrip, syncStatusWithTripLogs)
- **Migration (ต้อง apply บน DB):** `supabase/migrations/20260312000001_sync_order_status_on_trip_complete.sql` — สร้าง trigger + RPC `backfill_quantity_delivered_for_trip` เพื่ออัปเดต `orders.status` เมื่อทริป completed

ถ้า trigger/RPC ยังไม่อยู่ใน DB หน้าติดตามออเดอร์จะไม่เห็นสถานะ "จัดส่งแล้ว" หลังลงเลขไมล์ขากลับ — ให้รัน migration นี้บน Supabase (หรือรัน SQL ใน `sql/20260320000001_fix_fulfillment_trigger.sql` และ `sql/backfill_quantity_delivered_for_completed_trips.sql` ด้วยตนเอง)
