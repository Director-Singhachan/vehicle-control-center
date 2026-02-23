# แก้ไขปัญหา "ส่งแล้ว" ไม่ขึ้นใน UI

## แก้ระยะยาว (ในแอปแล้ว)

ตั้งแต่มีการแก้ไขนี้ **แอปจะซิงค์ quantity_delivered อัตโนมัติทุกครั้งที่ทริปถูกตั้งเป็น completed** (ทั้งตอนเช็คอินและตอน sync สถานะทริป) ดังนั้นเคสใหม่ไม่ควรต้องมารัน SQL แก้ทีละออเดอร์อีก

- ดูรายละเอียดใน `docs/PARTIAL_DELIVERY_FLOW.md` หัวข้อ "เมื่อทริปเปลี่ยนเป็น completed (แก้ระยะยาว)"

สคริปต์ด้านล่างใช้สำหรับ **ทริปเก่าที่ completed ก่อน deploy ชุดนี้** หรือกรณีข้อยกเว้นที่ต้องการแก้/ตรวจสอบทีละเคส

## วิธีแก้ไข

### วิธีที่ 1: แก้ไขออเดอร์เดียว (แนะนำ - เร็วที่สุด)

1. เปิดไฟล์ `sql/fix_order_delivery_quick.sql`
2. เปลี่ยน `'SD260220010'` เป็น `order_number` ที่ต้องการแก้ไข (2 จุด)
3. รัน script ใน Supabase SQL Editor
4. ตรวจสอบผลลัพธ์ที่แสดงด้านล่าง
5. Refresh หน้า UI

### วิธีที่ 2: ตรวจสอบและแก้ไขแบบละเอียด

1. เปิดไฟล์ `sql/check_and_fix_order_delivery_status.sql`
2. เปลี่ยน `'SD260220010'` เป็น `order_number` ที่ต้องการตรวจสอบ
3. รัน script เพื่อดู:
   - Trigger มีอยู่หรือไม่
   - ทริปที่ผูกกับออเดอร์นี้
   - ยอดที่ควรจะส่งแล้ว vs ยอดที่แสดงใน DB
4. Script จะรัน backfill อัตโนมัติถ้าพบทริปที่ completed

### วิธีที่ 3: แก้ไขทุกทริปที่ completed แล้ว

รัน function `backfill_quantity_delivered_for_trip(trip_id)` สำหรับทุกทริปที่ completed:

```sql
-- หาทริปที่ completed ทั้งหมด
SELECT id, trip_number, status, created_at
FROM public.delivery_trips
WHERE status = 'completed'
ORDER BY created_at DESC;

-- รัน backfill สำหรับแต่ละทริป (เปลี่ยน trip_id)
SELECT * FROM public.backfill_quantity_delivered_for_trip('trip_id_here');
```

## ตรวจสอบว่าแก้ไขสำเร็จหรือไม่

รัน query นี้เพื่อดูว่า `quantity_delivered` อัปเดตแล้วหรือยัง:

```sql
SELECT 
    o.order_number,
    oi.product_id,
    p.product_code,
    p.product_name,
    oi.quantity AS ordered_qty,
    COALESCE(oi.quantity_delivered, 0) AS delivered,
    (oi.quantity - COALESCE(oi.quantity_picked_up_at_store, 0) - COALESCE(oi.quantity_delivered, 0)) AS remaining
FROM public.orders o
JOIN public.order_items oi ON oi.order_id = o.id
LEFT JOIN public.products p ON p.id = oi.product_id
WHERE o.order_number = 'SD260220010'  -- เปลี่ยนเป็น order_number ที่ต้องการ
ORDER BY oi.created_at;
```

ถ้า `delivered` มีค่าแล้ว (ไม่ใช่ 0) แสดงว่าแก้ไขสำเร็จ

## ป้องกันปัญหาในอนาคต

1. **ตรวจสอบว่า trigger มีอยู่:**
   ```sql
   SELECT tgname, tgrelid::regclass, proname
   FROM pg_trigger t
   JOIN pg_proc p ON t.tgfoid = p.oid
   WHERE tgname = 'trg_sync_fulfilled_on_trip_complete';
   ```

2. **รัน migration `20260320000001_fix_fulfillment_trigger.sql`** ถ้ายังไม่ได้รัน

3. **สำหรับทริปเก่าที่ completed ก่อนมี trigger:** รัน backfill ตามวิธีที่ 3 ด้านบน
