---
name: ""
overview: ""
todos: []
isProject: false
---

## แผนจัดการตัวเลข: สั่งทั้งหมด / รับที่ร้าน / เหลือส่ง / ออกบิล

### 1. เป้าหมาย

- **สอดคล้องกันทั้งระบบ**: ตัวเลขปริมาณสินค้าแสดงตรงกันทุกจุด ตั้งแต่สร้างออเดอร์ → รอจัดทริป → ทริปจัดส่ง → รอออกบิล → ประวัติรับเอง / ประวัติส่งของ
- **มองภาพรวมได้ง่าย**: สำหรับสินค้าแต่ละตัว ต้องตอบได้ชัดว่า
  - สั่งทั้งหมดกี่หน่วย
  - ลูกค้ามารับที่ร้านแล้วกี่หน่วย
  - ส่งแล้วกี่หน่วย
  - ยังเหลือค้างส่ง/ค้างรับกี่หน่วย
- **รองรับเคสผสม**: ออเดอร์ที่มีทั้ง delivery + pickup ในสินค้าเดียวกัน (เช่น สั่ง 150, รับเอง 50, ส่ง 100)

---

### 2. โมเดลข้อมูลกลาง (Single Source of Truth)

ใช้ตาราง `order_items` + ฟิลด์ที่มีอยู่แล้วเป็นแหล่งความจริงเดียว:

- `quantity` — จำนวนที่ลูกค้าสั่ง (ต่อบรรทัด)
- `fulfillment_method` — `'delivery' | 'pickup'`
- `quantity_picked_up_at_store` — ลูกค้ารับที่ร้านแล้ว
- `quantity_delivered` — จำนวนที่ส่งออกทริปแล้ว

คำนวณตัวเลขหลัก:

- **Ordered (per item)**:

ordered = quantity

- **PickedUp (per item)**:

pickedup = quantitypickedupatstore

- **Delivered (per item)**:
  - ถ้า `fulfillment_method = 'delivery'`:
  delivered = quantitydelivered
  - ถ้า `fulfillment_method = 'pickup'`:
  delivered = 0
- **Remaining (per item)**:
  - ถ้า `fulfillment_method = 'delivery'`:
  remaining = quantity - quantitypickedupatstore - quantitydelivered
  - ถ้า `fulfillment_method = 'pickup'`:
  remaining = quantity - quantitypickedupatstore

สำหรับการแสดงผล “รวมต่อสินค้า” (กรณีมีหลายบรรทัดของ product เดียวกันในออเดอร์):

- Sum ตาม `product_id`:
  - `ordered_total` = sum(quantity)
  - `picked_up_total` = sum(quantity_picked_up_at_store)
  - `delivered_total` = sum(quantity_delivered เฉพาะ fulfillment_method = 'delivery')
  - `remaining_total` = sum(remaining) ตามสูตรด้านบน

---

### 3. เป้าหมาย UX ต่อจุดสำคัญ

#### 3.1 CreateOrderView / EditOrderView

- อนุญาตสินค้าซ้ำหลายแถว (เพื่อแยก delivery / pickup) ตามที่ทำอยู่
- แต่ **ช่วยผู้ใช้ให้เข้าใจว่า “รวมแล้วสั่งเท่าไร”**:
  - แสดง summary เล็กๆ ต่อ product:
    - เช่น “รวม: 150 ลัง (จัดส่ง 100, รับเอง 50)” เมื่อมีหลายแถวของสินค้าเดียวกัน

#### 3.2 TrackOrdersView (ติดตามออเดอร์)

- ใน modal รายละเอียดออเดอร์:
  - ต่อสินค้า **แสดง 3 ตัวเลข**:
    - `สั่ง ...` (ordered_total)
    - `รับที่ร้าน ...` (picked_up_total)
    - `ส่งแล้ว ...` (delivered_total)
  - ถ้ามีเฉพาะ delivery: ซ่อน/เทา “รับที่ร้าน”
  - ถ้ามีเฉพาะ pickup: ซ่อน/เทา “ส่งแล้ว”

#### 3.3 PendingOrdersView (ออเดอร์ที่รอจัดทริป)

- ต่อออเดอร์: ใช้ข้อมูลรวม per item:
  - แสดง badge/ข้อความ:
    - “รับที่ร้าน X ชิ้น” (ใช้ logic ที่มีแล้ว แต่ตรวจสอบให้ต่อ product รวมถูก)
    - “คงเหลือค้างส่ง Y ชิ้น” = sum(remaining สำหรับรายการ delivery เท่านั้น)
- Tooltip / helper: อธิบายว่า “คงเหลือ” คือยอดที่ต้องส่งต่อทริป ไม่รวมที่รับที่ร้านแล้ว

#### 3.4 DeliveryTripDetailView (รายละเอียดทริป)

- ต่อร้าน/สินค้า:
  - คอลัมน์ summary: “ส่ง: A, รับที่ร้าน: B” (ใช้ข้อมูลจาก `quantity_to_deliver` และ `quantity_picked_up_at_store`)
  - ให้สอดคล้องกับ TrackOrdersView:
    - ordered = quantity
    - picked_up = quantity_picked_up_at_store
    - quantity_to_deliver = remaining สำหรับทริปนี้

#### 3.5 SalesTripsView (หน้าออกบิล/คู่มือคีย์บิล)

- ตารางรายการสินค้าใน modal:
  - แสดงหัวคอลัมน์:
    - `จำนวนสั่ง`
    - `รับที่ร้านแล้ว`
    - (optionally) `ต้องคีย์บิลตามจำนวน ...` (ขึ้นกับ policy ว่าบิลรวมทุกช่องทาง หรือเฉพาะที่ส่งกับรถ)
- สำหรับเคส “สั่ง 150, รับเอง 50, ส่ง 100”:
  - แสดงชัดว่า:
    - จำนวนสั่ง: 150
    - รับที่ร้านแล้ว: 50
    - ส่งในทริปนี้: 100
  - ถ้าบิลต้องลง 150 → helper text ชี้นำให้รวมสองช่อง

#### 3.6 PickupOrdersView (รอรับเอง + ประวัติรับเอง)

- Tab “รอรับเอง”:
  - แสดงต่อสินค้า: `สั่ง X, รับแล้ว Y, เหลือรับ Z`
- Tab “ประวัติที่รับแล้ว”:
  - เมื่อ status = delivered + มี pickup items:
    - แสดงจำนวนที่รับไปทั้งหมด (sum picked_up_total)
    - Optional: แสดง ordered_total / delivered_total เพื่ออ้างอิง

---

### 4. การปรับโค้ด (ทีละส่วน)

#### 4.1 Utility กลางสำหรับคำนวณจำนวน

**ไฟล์เสนอ**: `utils/orderQuantities.ts`

ฟังก์ชัน:

- `aggregateOrderItemQuantities(items: OrderItemLike[]): AggregatedByProduct`
  - input: array ของ item (จาก `orders_with_details` หรือจาก trip)
  - output ต่อ `product_id`:
    - ordered_total
    - picked_up_total
    - delivered_total
    - remaining_total

ใช้ utility นี้ซ้ำใน:

- `TrackOrdersView`
- `PendingOrdersView` (ถ้าต้องการ per product)
- `DeliveryTripDetailView`
- `SalesTripsView`

#### 4.2 TrackOrdersView

1. หาโค้ดส่วนแสดง modal รายละเอียดออเดอร์ (`detailOrder` + `detailItems`).
2. เมื่อโหลด detail items แล้ว:
  - ใช้ `aggregateOrderItemQuantities` เพื่อรวมตาม product.
3. Render ตารางใหม่:
  - คอลัมน์: สินค้า / จำนวนสั่ง / รับที่ร้าน / ส่งแล้ว / คงเหลือ

#### 4.3 PendingOrdersView

1. ใช้ข้อมูล `orderItems` ที่โหลดมาแล้วต่อออเดอร์ + logic pickupSummary ที่มีอยู่.
2. ตรวจสอบ:
  - pickupSummary.totalPickedUp = sum(quantity_picked_up_at_store สำหรับทุก method).
3. ถ้าต้องการ per product: ใช้ utility กลาง (ข้อ 4.1) แล้วดึงเฉพาะ delivery สำหรับ remaining.

#### 4.4 DeliveryTripDetailView

1. ตรวจสอบว่าที่ใช้ `quantity_to_deliver` แล้ว **ตรงกับสูตร**:
  - `quantity_to_deliver = quantity - quantity_picked_up_at_store`.
2. ปรับ UI:
  - ใช้ helper text ที่มีอยู่ (“จำนวนด้านล่างคือจำนวนที่ต้องจัดส่งจริง...”) ให้สอดคล้องตัวเลข.
  - ต่อร้าน: แสดง summary “ส่ง X, รับที่ร้าน Y” โดยใช้ aggregate จาก trip items.

#### 4.5 SalesTripsView

1. ใน modal รายละเอียดร้าน (ส่วน “สรุปรายการสินค้า” + ตาราง):
  - เพิ่มคอลัมน์ `จำนวนสั่ง` (ถ้ายังไม่มี หรือกำลังแสดงเฉพาะในทริป).
  - ปรับให้ `รับที่ร้านแล้ว` ใช้ค่าเดียวกับที่ใช้ใน Trip / Orders.
2. เพิ่ม helper text เฉพาะกรณีมี pickup:
  - เช่น: “ลูกค้าบางส่วนมารับที่ร้านแล้ว กรุณาคีย์บิลตามยอดรวมที่ลูกค้าได้รับทั้งหมด”

#### 4.6 PickupOrdersView

1. ใน `grouped` และ `historyOrders`:
  - แสดง summary ต่อ order:
    - “สั่งทั้งหมด X, รับแล้ว Y, ส่งแล้ว Z, คงเหลือ W”
  - ใช้ logic เดียวกับ view อื่น (ผ่าน utility).

---

### 5. การทดสอบ (Test Plan)

สร้างชุดเคสตัวอย่าง (ใช้ DB dev):

1. **เคส A: delivery ล้วน**
  - สั่ง 100, ไม่มี pickup, ส่งครบ 100
  - ตรวจทุกหน้า: แสดง 100 ตรงกัน, ไม่มี “รับที่ร้าน”.
2. **เคส B: pickup ล้วน**
  - สั่ง 80, pickup 80, ไม่มีทริป
  - `PickupOrdersView` + ประวัติรับเอง แสดงครบ 80.
  - TrackOrdersView แสดง “สั่ง 80 / รับที่ร้าน 80 / ส่งแล้ว 0 / คงเหลือ 0”.
3. **เคส C: ผสม (ตามตัวอย่างของผู้ใช้)**
  - สั่ง 150 (delivery 100 + pickup 50)
  - ยืนยัน pickup 50, ส่ง delivery 100 ผ่านทริป
  - คาดหวัง:
    - TrackOrdersView: “สั่ง 150 / รับที่ร้าน 50 / ส่งแล้ว 100 / คงเหลือ 0”.
    - PendingOrdersView: ไม่แสดงในรอจัดทริป (remaining = 0).
    - DeliveryTripDetailView: ต่อร้านแสดง “ส่ง 100, รับที่ร้าน 50”.
    - SalesTripsView: ตารางฟลูสำหรับออกบิลมองเห็น 150 พร้อมแยก 100 ส่ง + 50 รับเองชัดเจน (ตาม policy).
    - PickupOrdersView: หลังยืนยัน pickup แล้ว รายการไปอยู่ใน “ประวัติที่รับแล้ว”.

ทดสอบทั้ง role ที่เกี่ยวข้อง:

- Sales, Warehouse, Admin (กรณี filter branch, สิทธิ์มองเห็นข้อมูล)

---

### 6. ลำดับทำงาน (Execution Order)

1. **เพิ่ม utility รวมจำนวน** (`utils/orderQuantities.ts`) + unit tests ง่ายๆ (ถ้ามี infra).
2. **TrackOrdersView**: ปรับ modal รายละเอียดให้ใช้ utility ใหม่.
3. **DeliveryTripDetailView**: ตรวจสอบและปรับ summary ส่ง/รับที่ร้าน ให้ตรงสูตร.
4. **SalesTripsView**: ปรับตารางสำหรับออกบิลให้แสดง “สั่ง / รับที่ร้าน / ส่งในทริปนี้” ชัดเจน.
5. **PickupOrdersView**: ปรับ summary ประวัติรับเองให้ใช้สูตรเดียวกัน.
6. Regression test ตาม test plan (ข้อ 5) + ปรับ copy/ข้อความช่วยเหลือตาม feedback ผู้ใช้จริง.

