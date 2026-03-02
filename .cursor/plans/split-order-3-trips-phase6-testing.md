# Phase 6: Testing Checklist — แบ่ง 3 เที่ยว Wizard

**แผน:** split-order-3-trips-wizard  
**สเตปการทดสอบ:** Manual QA ในเบราว์เซอร์

---

## วิธีเข้าสู่โหมด แบ่ง 3 เที่ยว

1. ไปที่ **ออเดอร์ที่รอจัดทริป** (`/pending-orders`)
2. เลือกออเดอร์ ≥ 1 รายการ
3. กด **สร้างทริป**
4. ในขั้น **จัดคนขับรถ**: เลือก radio **"แบ่ง 3 เที่ยว"**

---

## Checklist การทดสอบ

| # | เคส | ขั้นตอน | ผลลัพธ์ที่คาดหวัง | ✅/❌ |
|---|-----|--------|-------------------|-------|
| 1 | ออเดอร์ delivery ทั้งหมด แบ่ง 3 เที่ยว (รถคันเดียวกัน) | เลือกออเดอร์ delivery เท่านั้น → สร้างทริป → เลือก แบ่ง 3 เที่ยว → เลือกรถคันเดียวกันทั้ง 3 เที่ยว → แบ่ง qty (Trip1/Trip2/Trip3) → สร้างทริป | สร้างได้ 3 ทริป, `sequence_order` 1, 2, 3 ของรถคันเดียวกัน | |
| 2 | ออเดอร์ delivery แบ่ง 2 เที่ยวคันเดียวกัน + 1 เที่ยวคันอื่น | เลือก แบ่ง 3 เที่ยว → เที่ยว 1, 2: รถ A; เที่ยว 3: รถ B → แบ่ง qty ตามต้องการ → สร้างทริป | สร้างได้ 3 ทริปถูกต้อง (2 ทริปรถ A, 1 ทริปรถ B) | |
| 3 | ออเดอร์ผสม (delivery + pickup) | เลือกออเดอร์ที่มีทั้ง delivery items และ pickup items → แบ่ง 3 เที่ยว | เฉพาะ delivery items แสดงใน Trip1/Trip2/Trip3; pickup items **ไม่**เข้า trip | |
| 4 | เช็คอินทีละเที่ยว | หลังจากสร้างทริป 3 เที่ยว → เช็คอินเที่ยว 1 → เช็คอินเที่ยว 2 → เช็คอินเที่ยว 3 | `order_items.quantity_delivered` เพิ่มตามทีละเที่ยว (รวมทุกทริปถูกต้อง) | |
| 5 | order_number สร้างจาก trip แรก | หลังจากสร้าง 3 ทริปจากออเดอร์เดียว | `order.order_number` มีค่า และสร้างจาก trip แรก (`delivery_trip_id` ชี้ trip 1) | |
| 6 | Cancel trip 1 | สร้าง 3 ทริปจากออเดอร์เดียว → ยกเลิก trip 1 | ออเดอร์กลับ **pending** (`delivery_trip_id = null`, `order_number = null`); trip 2, 3 ยังอยู่ | |
| 7 | Cancel trip 2 หรือ 3 | สร้าง 3 ทริปจากออเดอร์เดียว → ยกเลิก trip 2 หรือ 3 | items ในทริปที่ยกเลิกหาย; ออเดอร์ยัง assign trip 1 อยู่ (`delivery_trip_id` ชี้ trip 1) | |

---

## การตรวจสอบข้อมูลใน DB (optional)

### เคส 1, 2, 3: สร้างทริป 3 เที่ยว
- `delivery_trips`: มี 3 แถว (trip1, trip2, trip3)
- `delivery_trips.sequence_order`: 1, 2, 3 (ถ้าเป็นรถคันเดียวกัน)
- `orders.delivery_trip_id`: ชี้ `trip1.id` เท่านั้น
- `orders.order_number`: มีค่า (สร้างจาก trip แรก)
- `delivery_trip_items`: แต่ละทริปมี qty ตามที่แบ่ง

### เคส 3: ออเดอร์ผสม
- `order_items` ที่ `fulfillment_method = 'pickup'`: ไม่มีใน `delivery_trip_items` ของทริปใด

### เคส 4: เช็คอิน
- `order_items.quantity_delivered`: รวม qty ที่ check-in จากทุกทริป

### เคส 6: Cancel trip 1
- `orders.delivery_trip_id`: NULL
- `orders.order_number`: NULL

### เคส 7: Cancel trip 2/3
- `delivery_trips`: trip ที่ยกเลิก status = cancelled
- `orders.delivery_trip_id`: ยังชี้ trip1 (ไม่เปลี่ยนแปลง)

---

## หมายเหตุ

- **Primary trip:** ออเดอร์ชี้เฉพาะ trip แรก (`delivery_trip_id`)
- **Trigger:** `sync_fulfilled_quantities_on_trip_complete` นับ `quantity_delivered` จาก store+product (ไม่พึ่ง delivery_trip_id)
- **Cancel:** ดู JSDoc ใน `services/deliveryTrip/tripStatusService.ts`

---

*อัปเดต: Phase 6 Testing Checklist*
