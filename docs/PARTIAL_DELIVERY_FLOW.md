# Flow การส่งบางส่วน (Partial Delivery)

เอกสารสรุป logic การส่งบางส่วน: จำนวนที่ส่งแล้ว / คงเหลือค้างส่ง และเมื่อไหร่ออเดอร์จะหายจากรายการ "ออเดอร์ที่รอจัดทริป"

## แหล่งข้อมูลหลัก

- **จำนวนส่งแล้ว:** `order_items.quantity_delivered` (อัปเดตโดย trigger เมื่อทริป completed และโดย service เมื่อลบ/ยกเลิกทริป)
- **คงเหลือค้างส่ง:** `quantity - quantity_picked_up_at_store - quantity_delivered` (ต่อ item)
- **ออเดอร์ส่งครบ:** เมื่อรวมทุก item แล้วคงเหลือ = 0 หรือ `orders.status = 'delivered'`

## 1. เมื่อทริปเปลี่ยนเป็น "completed" (แก้ระยะยาว)

ระบบใช้ **สองชั้น** เพื่อให้ "ส่งแล้ว/คงเหลือ" อัปเดตเสมอ ไม่ต้องแก้ทีละเคส:

1. **Trigger (DB):** `sync_fulfilled_quantities_on_trip_complete`  
   - ไฟล์: `sql/20260320000001_fix_fulfillment_trigger.sql`  
   - เมื่อ `delivery_trips.status` เปลี่ยนเป็น `completed` จะอัปเดต `order_items.quantity_delivered` และ `orders.status` (partial/delivered)

2. **แอป (Safety net):** ทุกครั้งที่ทริปถูกตั้งเป็น completed ระบบจะเรียก **ซิงค์จากแอป** อีกครั้ง:
   - **เช็คอินทริป:** หลังอัปเดตสถานะร้านเป็น delivered → `deliveryTripService.syncQuantityDeliveredForCompletedTrip(tripId)`
   - **Sync สถานะทริป:** หลัง `syncStatusWithTripLogs()` ตั้งทริปใดเป็น completed → เรียก sync ของทริปนั้น
   - ภายในเรียก RPC `backfill_quantity_delivered_for_trip(p_trip_id)` ( logic เดียวกับ trigger)

ดังนั้นไม่ว่า trigger จะรันหรือไม่ (หรือยังไม่ได้รัน migration) หลัง **เช็คอินทริป** หรือ **ซิงค์สถานะทริป** จำนวน "ส่งแล้ว" และ "คงเหลือ" จะถูกอัปเดตจากแอป

## 2. เมื่อลบหรือยกเลิกทริป

- **Service:** `deliveryTripService` / `tripCrudService` (delete / cancel)
- ทำอะไร:
  - เคลียร์ `delivery_trip_id`, `order_number` ของออเดอร์ที่ผูกกับทริปนั้น (ไม่รีเซ็ต `quantity_picked_up_at_store`)
  - เรียก RPC `recalculate_quantity_delivered_after_order_unassign` — รีแคล์ `quantity_delivered` แบบ **FIFO ต่อร้าน+สินค้า** จากทริป `completed` (ตอน **ลบทริป** ส่ง `p_excluded_trip_id` เพื่อไม่นับทริปที่กำลังลบ)
  - อัปเดต `orders.status` (confirmed / assigned / partial / delivered) ให้สอดคล้องยอดรวมบรรทัด

ผลคือหลัง unlink + ลบทริป จำนวน "ส่งแล้ว" จะไม่ค้างจากทริปที่ถูกลบ

## 3. รายการ "ออเดอร์ที่รอจัดทริป" (getPendingOrders)

- **Service:** `ordersService.getPendingOrders()`
- แสดงออเดอร์เมื่อ:
  - มียอดคงเหลือรวม > 0 **และ**
  - ยังไม่จัดทริป **หรือ** ทริปที่ผูกอยู่เป็น `completed` / `cancelled`
- **ไม่แสดง** เมื่อ:
  - ส่งครบแล้ว: `remaining <= 0` หรือ `status === 'delivered'`
  - กำลังจัดทริป: ทริปเป็น `planned` หรือ `in_progress`
  - รหัสออเดอร์รูปแบบเก่า (-ORD-)

ยอดคงเหลือคำนวณจาก `order_items` โดยใช้ `max(quantity_delivered, ยอดจากทริปที่ completed)` เพื่อให้หลังทริป completed ใหม่ จำนวนส่งแล้วไม่น้อยกว่าความจริง

## 4. ถ้าจำนวน "ส่งแล้ว/คงเหลือ" ยังไม่ขึ้นหรือไม่ตรง (กรณีข้อยกเว้น)

1. **ทริปที่ completed ก่อน deploy ชุดนี้:** แอปจะไม่เคยเรียก sync ย้อนหลัง → รัน backfill ครั้งเดียว  
   `sql/backfill_quantity_delivered_for_completed_trips.sql` หรือ `backfill_quantity_delivered_for_trip(trip_id)` ตามที่ doc ในโฟลเดอร์ sql อธิบาย
2. **ตรวจว่า RPC มีใน DB:** ฟังก์ชัน `backfill_quantity_delivered_for_trip` ต้องมี (จากไฟล์ backfill) เพื่อให้แอปเรียก sync ได้
3. **สถานะออเดอร์ไม่ให้ใช้ `partial`:** รัน `sql/add_partial_status_to_orders.sql` เพื่อเพิ่มค่า `partial` ใน CHECK constraint ของ `orders.status`

## 5. สรุปสั้นๆ

| เหตุการณ์              | ผลที่เกิดขึ้น |
|-------------------------|---------------|
| ทริป completed (เช็คอิน / sync สถานะ) | DB trigger อัปเดต + **แอปเรียก sync อีกครั้ง** → `quantity_delivered` และ order status (partial/delivered) ตรงเสมอ |
| ลบ/ยกเลิกทริป           | Service คำนวณ `quantity_delivered` ใหม่จากทริปที่เหลือ แล้วอัปเดต order_items |
| ดูรายการรอจัดทริป       | แสดงเฉพาะออเดอร์ที่ remaining > 0 และ (ไม่มีทริป หรือทริป completed/cancelled) |

ถ้าส่งครบแล้ว (remaining = 0 หรือ status = delivered) ออเดอร์จะไม่โผล่ใน "ออเดอร์ที่รอจัดทริป" อีก
