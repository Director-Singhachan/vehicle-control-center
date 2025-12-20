# 🔄 Correct Workflow - การทำงานที่ถูกต้อง

## 📋 Workflow จริง

### ขั้นตอนการทำงาน

```
┌─────────────────────────────────────────────────┐
│  1. Customer สั่งสินค้า                          │
│     → Mobile App (Customer App)                  │
│     → สร้าง order (status: 'pending')            │
└─────────────────┬───────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────┐
│  2. พนักงานขายได้รับออเดอร์                       │
│     → Mobile App (Sales App)                     │
│     → ดูออเดอร์ใหม่                              │
└─────────────────┬───────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────┐
│  3. พนักงานขายส่งข้อมูลให้คลังและจัดส่ง           │
│     → Mobile App (Sales App)                    │
│     → ส่งออเดอร์ไปยังคลัง                        │
│     → status: 'sent_to_warehouse'               │
└─────────────────┬───────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────┐
│  4. คลังและจัดส่งดูออเดอร์ของวันนั้น             │
│     → Web App (Vehicle Control Center)          │
│     → ดูออเดอร์ที่ส่งมา                          │
└─────────────────┬───────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────┐
│  5. คลังและจัดส่งจัดคิวส่ง                       │
│     → Web App (Vehicle Control Center)          │
│     → จัดลำดับร้านที่จะส่ง                       │
│     → สร้าง delivery_trips                       │
│     → กำหนด sequence_order                      │
└─────────────────┬───────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────┐
│  6. คลังและจัดส่งส่งคิวให้ขายดู                  │
│     → Web App → Mobile App (Sales)              │
│     → อัปเดต delivery_trips                     │
│     → status: 'queue_ready'                     │
└─────────────────┬───────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────┐
│  7. พนักงานขายดูคิวที่คลังจัดให้                  │
│     → Mobile App (Sales App)                    │
│     → ดูลำดับร้านที่จะส่ง                        │
└─────────────────┬───────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────┐
│  8. พนักงานขายออกบิลตามลำดับคิว                  │
│     → Mobile App (Sales App)                    │
│     → ออกบิลตาม sequence_order                  │
│     → status: 'billed'                         │
└─────────────────┬───────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────┐
│  9. คลังและจัดส่งส่งสินค้า                        │
│     → Web App (Vehicle Control Center)          │
│     → จัดรถ, พนักงานขับ                          │
│     → ส่งสินค้าตามคิว                            │
│     → status: 'delivered'                       │
└─────────────────────────────────────────────────┘
```

---

## 🎯 หน้าที่ของแต่ละฝ่าย

### 1. พนักงานขาย (Sales Team)
**ใช้: Web App (Vehicle Control Center)**

#### งานที่ทำ:
- ✅ รับออเดอร์จากลูกค้า
- ✅ ดูออเดอร์ใหม่
- ✅ ส่งข้อมูลออเดอร์ให้คลังและจัดส่ง
- ✅ ดูคิวที่คลังจัดให้
- ✅ ออกบิลตามลำดับคิวที่คลังกำหนด

#### ไม่ทำ:
- ❌ จัดคิวส่ง (คลังทำ)
- ❌ จัดรถ (คลังทำ)
- ❌ ติดตามการส่งสินค้า (คลังทำ)

---

### 2. คลังและจัดส่ง (Warehouse & Logistics)
**ใช้: Web App (Vehicle Control Center)**

#### งานที่ทำ:
- ✅ ดูออเดอร์ที่ขายส่งมา
- ✅ จัดคิวส่ง (กำหนดลำดับร้านที่จะส่ง)
- ✅ สร้าง delivery trips
- ✅ กำหนด sequence_order
- ✅ จัดรถและพนักงานขับ
- ✅ ติดตามการส่งสินค้า
- ✅ อัปเดตสถานะการส่ง

#### ไม่ทำ:
- ❌ รับออเดอร์จากลูกค้า (ขายทำ)
- ❌ ออกบิล (ขายทำ)

---

### 3. ลูกค้า (Customer)
**ใช้: Mobile App (Customer App) - Flutter**

#### งานที่ทำ:
- ✅ สั่งสินค้า
- ✅ ดูออเดอร์
- ✅ ติดตามสถานะ

---

## 📊 Database Schema ที่ต้องแก้ไข

### Order Status ที่ถูกต้อง

```sql
status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
  'pending',              -- รอขายส่งให้คลัง
  'sent_to_warehouse',    -- ขายส่งให้คลังแล้ว
  'queue_ready',          -- คลังจัดคิวเสร็จแล้ว (พร้อมให้ขายออกบิล)
  'billed',               -- ขายออกบิลแล้ว
  'preparing',            -- กำลังเตรียมสินค้า
  'ready',                -- พร้อมส่ง
  'assigned',             -- มอบหมายให้ทริปแล้ว
  'in_transit',           -- กำลังส่ง
  'delivered',            -- ส่งแล้ว
  'cancelled',            -- ยกเลิก
  'rejected'              -- ปฏิเสธ
))
```

### Delivery Trips
- `sequence_order` - ลำดับการส่ง (คลังกำหนด)
- `status` - สถานะทริป
- `planned_date` - วันที่ส่ง

---

## 🔄 Integration Flow

### Mobile App (Customer) → Web App (Sales) → Web App (Warehouse)

1. **Customer สั่งสินค้า**
   ```dart
   // Mobile App (Customer)
   await orderService.createOrder({
     storeId: storeId,
     deliveryDate: deliveryDate,
   });
   ```

2. **Sales ดูออเดอร์ใหม่**
   ```typescript
   // Web App (Sales)
   const orders = await supabase
     .from('orders')
     .select('*')
     .eq('status', 'pending')
     .order('created_at', { ascending: false });
   ```

3. **Sales ส่งออเดอร์ให้คลัง**
   ```typescript
   // Web App (Sales)
   await supabase
     .from('orders')
     .update({ status: 'sent_to_warehouse' })
     .eq('id', orderId);
   ```

4. **Warehouse ดูออเดอร์ที่ส่งมา**
   ```typescript
   // Web App (Warehouse)
   const orders = await supabase
     .from('orders')
     .select('*')
     .eq('status', 'sent_to_warehouse')
     .eq('order_date', today);
   ```

5. **Warehouse จัดคิว**
   ```typescript
   // Web App (Warehouse) - สร้าง delivery trip
   const trip = await supabase
     .from('delivery_trips')
     .insert({
       vehicle_id: vehicleId,
       planned_date: deliveryDate,
       status: 'planned'
     });
   
   // เพิ่มร้านค้าในทริป พร้อม sequence_order
   await supabase
     .from('delivery_trip_stores')
     .insert(
       stores.map((store, index) => ({
         delivery_trip_id: trip.id,
         store_id: store.id,
         sequence_order: index + 1  // ลำดับ 1, 2, 3, ...
       }))
     );
   ```

6. **Warehouse อัปเดตสถานะออเดอร์**
   ```typescript
   // Web App (Warehouse) - อัปเดตออเดอร์ให้พร้อมให้ขายออกบิล
   await supabase
     .from('orders')
     .update({
       status: 'queue_ready',
       delivery_trip_id: trip.id
     })
     .in('id', orderIds);
   ```

7. **Sales ดูคิว**
   ```typescript
   // Web App (Sales) - ดู delivery trips ที่พร้อมให้ออกบิล
   const trips = await supabase
     .from('delivery_trips')
     .select(`
       *,
       delivery_trip_stores (
         *,
         stores (*),
         orders (*)
       )
     `)
     .eq('status', 'planned')
     .order('planned_date');
   ```

8. **Sales ออกบิล**
   ```typescript
   // Web App (Sales) - ออกบิลตามลำดับ
   await supabase
     .from('orders')
     .update({ status: 'billed' })
     .eq('id', orderId);
   ```

---

## 📱 Features ที่ต้องสร้าง

### Mobile App (Customer App - Flutter)

#### ✅ ต้องมี:
1. **สั่งสินค้า**
   - ดูสินค้า
   - เพิ่มลงตะกร้า
   - สร้างออเดอร์

2. **ดูออเดอร์**
   - ดูออเดอร์ทั้งหมด
   - ดูรายละเอียดออเดอร์
   - ติดตามสถานะ

#### ❌ ไม่ต้องมี:
- จัดการออเดอร์ (ขายทำ)
- ออกบิล (ขายทำ)

---

### Web App (Vehicle Control Center)

#### สำหรับฝ่ายขาย (Sales):
1. **รับออเดอร์**
   - ดูออเดอร์ใหม่จากลูกค้า
   - ดูรายละเอียดออเดอร์

2. **ส่งออเดอร์ให้คลัง**
   - ปุ่ม "ส่งให้คลัง"
   - อัปเดต status = 'sent_to_warehouse'

3. **ดูคิวที่คลังจัด**
   - ดู delivery trips ที่พร้อมให้ออกบิล
   - ดูลำดับร้าน (sequence_order)
   - เรียงตามลำดับที่คลังกำหนด

4. **ออกบิล**
   - ออกบิลตามลำดับคิว
   - อัปเดต status = 'billed'

#### สำหรับคลังและจัดส่ง (Warehouse):
1. **ดูออเดอร์ที่ขายส่งมา**
   - ดูออเดอร์ status = 'sent_to_warehouse'
   - กรองตามวันที่

2. **จัดคิวส่ง**
   - เลือกร้านที่จะส่ง
   - กำหนดลำดับ (sequence_order)
   - สร้าง delivery trip

3. **ส่งคิวให้ขาย**
   - อัปเดต status = 'queue_ready'
   - แจ้งเตือนให้ขาย

4. **จัดการการส่ง**
   - จัดรถ
   - กำหนดพนักงานขับ
   - ติดตามการส่ง

---

## 🔐 Roles & Permissions

### Sales Role
- Mobile App: No access (ใช้แค่ Customer App สำหรับลูกค้า)
- Web App: Full access (รับออเดอร์, ส่งให้คลัง, ดูคิว, ออกบิล)

### Warehouse/Logistics Role
- Mobile App: No access
- Web App: Full access (จัดคิว, จัดรถ, ติดตาม)

### Customer Role
- Mobile App: Full access (สั่งสินค้า, ดูออเดอร์, ติดตาม)
- Web App: No access

### Manager Role
- Mobile App: No access (หรือ read-only)
- Web App: Full access (ทุกอย่าง)

---

## 📝 สรุป

### พนักงานขาย (Web App)
1. รับออเดอร์จากลูกค้า (ดูออเดอร์ใหม่)
2. ส่งออเดอร์ให้คลัง
3. ดูคิวที่คลังจัดให้
4. ออกบิลตามลำดับคิว

### คลังและจัดส่ง (Web App)
1. ดูออเดอร์ที่ขายส่งมา
2. จัดคิวส่ง (กำหนดลำดับร้าน)
3. ส่งคิวให้ขายดู
4. จัดรถและส่งสินค้า

### ลูกค้า (Mobile App - Flutter)
1. สั่งสินค้า
2. ดูออเดอร์
3. ติดตามสถานะ

