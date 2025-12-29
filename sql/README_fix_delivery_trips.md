# แก้ไข Delivery Trips ที่ยังไม่ได้อัปเดตสถานะ

## ปัญหา
เมื่อสร้างทริปส่งสินค้าไว้ แต่คนขับจริงเป็นอีกคน (ไม่ใช่คนที่วางแผนไว้) และมีการบันทึกการใช้รถ (trip_logs) แล้ว delivery trip อาจยังไม่ได้ถูกอัปเดตสถานะเป็น 'completed' แม้ว่าจะมีการ check-in แล้ว

## วิธีแก้ไข

### วิธีที่ 1: ใช้ SQL Script (แนะนำ)

1. เปิด Supabase SQL Editor
2. เปิดไฟล์ `sql/fix_delivery_trips_missing_status_update.sql`
3. รัน SQL script ทั้งหมด
4. ตรวจสอบผลลัพธ์จาก NOTICE messages

**คำอธิบาย:**
- Script จะค้นหา delivery trips ที่มี status 'planned' หรือ 'in_progress'
- ตรวจสอบว่ามี trip_logs ที่ check-in แล้วสำหรับ vehicle_id และ planned_date เดียวกัน
- อัปเดต delivery trip status เป็น 'completed'
- อัปเดต driver_id ให้ตรงกับคนขับจริง (ถ้าต่างจากคนที่วางแผนไว้)
- อัปเดต odometer_end จาก trip_log
- อัปเดต delivery_status ของ stores เป็น 'delivered'

### วิธีที่ 2: ใช้ Service Function (จาก Code)

เรียกใช้ function `deliveryTripService.syncStatusWithTripLogs()` จาก code:

```typescript
import { deliveryTripService } from './services/deliveryTripService';

// Sync delivery trips status
const result = await deliveryTripService.syncStatusWithTripLogs();
console.log(`Updated ${result.updated} trips`);
console.log('Details:', result.details);
```

### วิธีที่ 3: ตรวจสอบก่อนแก้ไข (Query)

รัน query นี้เพื่อดู delivery trips ที่ต้องแก้ไข:

```sql
SELECT 
  dt.id,
  dt.trip_number,
  dt.vehicle_id,
  v.plate as vehicle_plate,
  dt.planned_date,
  dt.status,
  dt.driver_id as planned_driver_id,
  p.full_name as planned_driver_name,
  COUNT(tl.id) as completed_trip_logs_count,
  MAX(tl.checkin_time) as latest_checkin_time
FROM delivery_trips dt
INNER JOIN vehicles v ON dt.vehicle_id = v.id
LEFT JOIN profiles p ON dt.driver_id = p.id
LEFT JOIN trip_logs tl ON (
  tl.vehicle_id = dt.vehicle_id
  AND DATE(tl.checkout_time) = dt.planned_date
  AND tl.status = 'checked_in'
)
WHERE dt.status IN ('planned', 'in_progress')
  AND dt.planned_date <= CURRENT_DATE
GROUP BY dt.id, dt.trip_number, dt.vehicle_id, v.plate, dt.planned_date, dt.status, dt.driver_id, p.full_name
HAVING COUNT(tl.id) > 0
ORDER BY dt.planned_date DESC, dt.created_at DESC;
```

## สิ่งที่ Script จะทำ

1. **ค้นหา delivery trips ที่ต้องแก้ไข:**
   - Status เป็น 'planned' หรือ 'in_progress'
   - planned_date <= วันปัจจุบัน

2. **ตรวจสอบ trip_logs:**
   - vehicle_id ตรงกัน
   - planned_date ตรงกับ checkout_time
   - status = 'checked_in'

3. **อัปเดต delivery trip:**
   - status → 'completed'
   - odometer_end → จาก trip_log
   - driver_id → อัปเดตเป็นคนขับจริง (ถ้าต่างจากคนที่วางแผนไว้)
   - odometer_start → อัปเดตถ้ายังไม่ได้ตั้งค่า

4. **อัปเดต trip_log:**
   - delivery_trip_id → ผูกกับ delivery trip

5. **อัปเดต stores:**
   - delivery_status → 'delivered'
   - delivered_at → จาก checkin_time

## หมายเหตุ

- Script จะไม่แก้ไข delivery trips ที่มี status 'cancelled'
- Script จะไม่แก้ไข delivery trips ที่ยังไม่มี trip_logs ที่ check-in แล้ว
- Script จะอัปเดต driver_id เฉพาะเมื่อคนขับจริงต่างจากคนที่วางแผนไว้

