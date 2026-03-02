---
name: ""
overview: ""
todos: []
isProject: false
---

# แผนพัฒนา: วิธีรับสินค้า (จัดส่ง vs ลูกค้ามารับเอง) + ใบเบิกสำหรับรับเอง

**เป้าหมาย:** รองรับ 3 เคสอย่างชัดเจน

1. **จัดส่งทั้งหมด** — ออเดอร์เข้าฟลโว์จัดทริปตามเดิม
2. **ลูกค้ามารับเองทั้งหมด** — ไม่จัดทริป แต่ต้องมีใบเบิก + flow ยืนยันรับแล้ว
3. **ผสม** — บางรายการจัดส่ง บางรายการรับเอง; ต้องมีใบเบิกสำหรับส่วนที่รับเอง

---

## สรุปการเปลี่ยนแปลงหลัก


| ระดับ                | การเปลี่ยนแปลง                                                        |
| -------------------- | --------------------------------------------------------------------- |
| **Database**         | เพิ่ม `fulfillment_method` ใน `order_items` (`delivery`               |
| **CreateOrderView**  | ให้เลือกวิธีรับสินค้า: ทั้งหมดจัดส่ง / ทั้งหมดรับเอง / ผสม (รายการละ) |
| **getPendingOrders** | แสดงเฉพาะออเดอร์ที่มียอด `delivery` ค้างส่ง > 0                       |
| **Trip creation**    | ดึงเฉพาะ `order_items` ที่ `fulfillment_method = 'delivery'`          |
| **ใบเบิก**           | PDF ใบเบิกสำหรับออเดอร์/รายการ `pickup` (แบบไม่มีทริป)                |
| **Pickup flow**      | หน้ารวมออเดอร์/รายการรอรับเอง → พิมพ์ใบเบิก → ยืนยันรับแล้ว           |


---

## Phase 1: Database & Types

### 1.1 Migration: เพิ่ม `fulfillment_method` ใน `order_items`

**ไฟล์:** `supabase/migrations/YYYYMMDD_add_fulfillment_method.sql`

```sql
-- เพิ่ม fulfillment_method: 'delivery' = ให้บริษัทจัดส่ง, 'pickup' = ลูกค้ามารับเอง
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS fulfillment_method text NOT NULL DEFAULT 'delivery'
    CHECK (fulfillment_method IN ('delivery', 'pickup'));

COMMENT ON COLUMN public.order_items.fulfillment_method IS
  'delivery = ให้บริษัทจัดส่ง (เข้า trip), pickup = ลูกค้ามารับเอง (ไม่เข้า trip ต้องมีใบเบิก)';

-- Backfill: ออเดอร์เดิมถือเป็น delivery ทั้งหมด
UPDATE public.order_items SET fulfillment_method = 'delivery' WHERE fulfillment_method IS NULL;
```

**หมายเหตุ:** ค่า default `delivery` ทำให้ออเดอร์เก่าทุกอันยังคงพฤติกรรมเหมือนเดิม

### 1.2 อัปเดต TypeScript types

**ไฟล์:** `types/database.ts`

- เพิ่ม `fulfillment_method: 'delivery' | 'pickup'` ใน `order_items` Row / Insert / Update

---

## Phase 2: CreateOrderView — เลือกวิธีรับสินค้า

### 2.1 โครงสร้าง UI ที่ต้องเพิ่ม

1. **ตัวเลือกระดับออเดอร์ (ก่อนตารางสินค้า)**
  - Radio/Select: `ทั้งหมดจัดส่ง` | `ทั้งหมดรับเอง` | `ผสม (กำหนดรายการละ)`  
  - ถ้าเลือก "ผสม" → แสดงคอลัมน์ "วิธีรับ" ในตารางสินค้า
2. **ตารางสินค้า**
  - คอลัมน์ใหม่ (เมื่อเลือก "ผสม"): `วิธีรับ` = Select (`จัดส่ง` / `รับเอง`) ต่อแถว  
  - ถ้าเลือก "ทั้งหมดจัดส่ง" หรือ "ทั้งหมดรับเอง" → ไม่แสดงคอลัมน์นี้ แต่ทุกแถวใช้ค่าที่เลือก

### 2.2 Logic การบันทึก

- **กรณี "ทั้งหมดจัดส่ง":** ทุก `order_item` มี `fulfillment_method: 'delivery'`
- **กรณี "ทั้งหมดรับเอง":** ทุก `order_item` มี `fulfillment_method: 'pickup'`
- **กรณี "ผสม":** แต่ละแถวใช้ค่าจาก dropdown; ถ้าสินค้าตัวเดียวกันมีทั้งจัดส่งและรับเอง → **แยกเป็น 2 บรรทัด** (เช่น Product A x 6 จัดส่ง, Product A x 4 รับเอง)

### 2.3 อัปเดต CreateOrderView

**ไฟล์:** `views/CreateOrderView.tsx` (ควรแยก Section เป็น component ให้อยู่ในขอบ ~400 บรรทัด)


| ส่วน         | การแก้ไข                                                                                   |
| ------------ | ------------------------------------------------------------------------------------------ |
| State        | เพิ่ม `fulfillmentMode: 'delivery'                                                         |
| UI           | Section "วิธีรับสินค้า" + คอลัมน์ในตารางเมื่อเลือก mixed                                   |
| handleSubmit | ส่ง `fulfillment_method` ต่อ item; แยกบรรทัดเมื่อ product เดียวกันมีทั้ง delivery + pickup |


### 2.5 อัปเดต EditOrderView (เพิ่มเติมจากแผนเดิม)

**ไฟล์:** `views/EditOrderView.tsx`

- แสดง/แก้ไข `fulfillment_method` ต่อ item เช่นเดียวกับ CreateOrderView
- ถ้าออเดอร์เดิมไม่มี `fulfillment_method` → ถือเป็น `delivery` ทั้งหมด (default)
- เมื่อเปลี่ยน method → ต้องจัดการกับทริปที่ assign ไปแล้ว (ตามนโยบาย Phase 7 edge cases)

### 2.4 อัปเดต ordersService.createWithItems

**ไฟล์:** `services/ordersService.ts`

- รับ `fulfillment_method?: 'delivery' | 'pickup'` ต่อ item
- บันทึกลง `order_items.fulfillment_method` (default `delivery`)

---

## Phase 3: กรองออเดอร์สำหรับจัดทริป

### 3.1 อัปเดต getPendingOrders

**ไฟล์:** `services/ordersService.ts`

**Logic ปัจจุบัน:** แสดงออเดอร์ที่ `remaining > 0` (remaining = quantity − picked_up − delivered)

**Logic ใหม่:**  

- `remaining` คำนวณเฉพาะรายการที่ `fulfillment_method = 'delivery'`  
- สำหรับรายการ `pickup`: ไม่นำมานับใน remaining ของการจัดทริป

ดังนั้นออเดอร์จะโผล่ใน "ออเดอร์ที่รอจัดทริป" เมื่อ:

- มีอย่างน้อย 1 `order_item` ที่ `fulfillment_method = 'delivery'` และ remaining > 0

**การ implement:**

- ใน loop ที่คำนวณ `orderIdToRemaining` ให้ข้าม item ที่ `fulfillment_method === 'pickup'`
- ดึง `fulfillment_method` จาก `order_items` ด้วย (เพิ่มใน select statement L210)

### 3.2 อัปเดต useCreateTripWizard / trip creation

**ไฟล์:** `hooks/useCreateTripWizard.ts`, `services/deliveryTrip/tripCrudService.ts` (หรือจุดที่ดึง items จาก orders)

- `fetchOrderItems` (L93-107): กรอง pickup items ออกจาก `orderItemsMap` หรือ mark ไว้
- `getRemaining` (L109-113): ข้าม items ที่เป็น pickup
- `buildStoresPayload` / `buildSplitStoresPayload`: กรองเฉพาะ delivery items
- `recommendationInput` (L287-299): ใช้เฉพาะ delivery items ในการคำนวณ
- จำนวนที่ sync ลง `delivery_trip_items` = จำนวนของ delivery items เท่านั้น

### 3.3 อัปเดต vehicleRecommendationService

**ไฟล์:** `services/vehicleRecommendationService.ts`

- Input `items` ที่ส่งเข้ามา ต้องมาจาก delivery items เท่านั้น
- ถ้า recommendation รับจาก orders โดยตรง ต้องกรอง `fulfillment_method = 'delivery'` ก่อนคำนวณน้ำหนัก/พาเลท

### 3.4 อัปเดต sync service (order_items → delivery_trip_items)

**ไฟล์:** `services/orderTripSyncService.ts` (sync ทำผ่าน JS service ไม่ใช่ DB trigger)

- `syncOrderToTrip`: กรอง pickup items ออก ไม่ sync ลง `delivery_trip_items`
- รายการ `pickup` ไม่ถูก sync ลง `delivery_trip_items`

---

## Phase 4: ใบเบิกสำหรับลูกค้ามารับเอง ✅

### 4.1 ฟังก์ชัน PDF ใหม่ ✅

**ไฟล์:** `services/pdfService.ts`

เพิ่มเมธอด:

```ts
generateOrderPickupSlipPDF(order, itemsWithProducts)
```

- **Input:** `order` (กับ store, order_number, order_date ฯลฯ), `itemsWithProducts` (order_items ที่ fulfillment_method = 'pickup' + product info)
- **โครงสร้าง PDF (A5):**
  - หัว: "ใบเบิกสินค้า (ลูกค้ามารับเอง)"
  - วันที่, รหัสออเดอร์, ชื่อร้าน
  - ตาราง: รหัสสินค้า, ชื่อสินค้า, หมวดหมู่, จำนวน
  - ฟอร์มลงชื่อ (คลัง/ผู้มอบ)

อ้างอิงโครงสร้างจาก `generateDeliveryTripForkliftSummaryPDFA5` แต่ไม่ใช้ข้อมูลทริป/รถ

### 4.2 Service สำหรับรายการรอรับเอง ✅

**ไฟล์:** `services/ordersService.ts`

เพิ่มฟังก์ชัน:

```ts
getPickupPendingItems(filters?: { branch?: string }): Promise<PickupPendingItem[]>
```

- ดึง `order_items` ที่ `fulfillment_method = 'pickup'` และ `quantity_picked_up_at_store < quantity`
- Join กับ orders, stores, products
- คืนโครงสร้าง `PickupPendingItem[]` ที่เหมาะกับการแสดงใน UI และพิมพ์ใบเบิก

---

## Phase 5: หน้ารายการรอรับเอง + Flow ยืนยันรับแล้ว ✅

### 5.1 View ใหม่: PickupOrdersView ✅

**ไฟล์:** `views/PickupOrdersView.tsx`

**หน้าที่:**

- แสดงออเดอร์/รายการที่ `fulfillment_method = 'pickup'` และยังรับไม่ครบ
- รูปแบบ: grouped by order
- ปุ่มต่อออเดอร์: **พิมพ์ใบเบิก** | **ยืนยันลูกค้ามารับแล้ว**
- Filter สาขา (HQ/SD) สำหรับ admin/manager

### 5.2 Flow "ยืนยันลูกค้ามารับแล้ว" ✅

- `ordersService.markPickupItemsFulfilled(orderId, itemIds?, updatedBy?)`
- อัปเดต `quantity_picked_up_at_store = quantity` สำหรับ pickup items
- ตรวจสอบ order status → ถ้าทุก item fulfill ครบ อัปเดต `orders.status = 'delivered'`

### 5.3 เพิ่ม route และเมนู ✅

**ไฟล์:** `index.tsx`

- Tab: `pickup-orders`
- เมนู: "รายการรอรับเอง" ใต้เมนูคลังสินค้า (Stock Dashboard)

---

## Phase 6: สถานะออเดอร์และ remaining

### 6.1 สูตร remaining ต่อ item


| fulfillment_method | remaining                                                           |
| ------------------ | ------------------------------------------------------------------- |
| delivery           | `quantity - quantity_picked_up_at_store - quantity_delivered`       |
| pickup             | `quantity - quantity_picked_up_at_store` (ไม่มี quantity_delivered) |


**หมายเหตุ:** รายการ pickup ไม่มีทริป จึงไม่มี quantity_delivered

### 6.2 สถานะ order

- **delivered:** ทุก item (ทั้ง delivery และ pickup) fulfill ครบแล้ว  
  - delivery: quantity_delivered + quantity_picked_up_at_store ≥ quantity  
  - pickup: quantity_picked_up_at_store ≥ quantity
- **partial:** บางรายการ fulfill ครบ บางรายการยังไม่ครบ
- **confirmed / assigned:** ยังมีรายการค้างส่งหรือค้างรับ

Trigger หรือ service ที่อัปเดต order status ต้องรองรับทั้ง delivery และ pickup items

---

## Phase 7: รายงานและความสมบูรณ์

### 7.1 รายงาน (ถ้าต้องการ)

- แยกสถิติ: ออเดอร์จัดส่งกี่รายการ vs ลูกค้ามารับเองกี่รายการ
- ใช้ `fulfillment_method` เป็น filter ใน query

### 7.2 Edge cases


| กรณี                                    | การจัดการ                                                                          |
| --------------------------------------- | ---------------------------------------------------------------------------------- |
| ออเดอร์เดิม (ไม่มี fulfillment_method)  | ถือเป็น delivery ทั้งหมด (default)                                                 |
| แก้ไขออเดอร์: เปลี่ยน delivery → pickup | อัปเดต fulfillment_method; ถ้ามีทริปแล้ว ต้องจัดการตามนโยบาย (ยกเลิก/ปล่อยจากทริป) |
| แก้ไขออเดอร์: เปลี่ยน pickup → delivery | อัปเดต fulfillment_method; รายการนี้จะไปโผล่ในรอจัดทริป                            |


---

## ลำดับการทำ (Execution Order)

```
Phase 1: Database
├── 1.1 Migration add fulfillment_method
└── 1.2 อัปเดต types/database.ts

Phase 2: CreateOrderView
├── 2.1–2.3 UI + logic ใน CreateOrderView
└── 2.4 ordersService.createWithItems รองรับ fulfillment_method

Phase 3: กรองสำหรับจัดทริป
├── 3.1 getPendingOrders กรอง delivery remaining
├── 3.2 useCreateTripWizard / trip creation กรอง delivery items
├── 3.3 vehicleRecommendationService กรอง delivery items
└── 3.4 sync trigger ไม่ sync pickup items

Phase 4: ใบเบิก
├── 4.1 pdfService.generateOrderPickupSlipPDF
└── 4.2 getPickupPendingItems service

Phase 5: Pickup flow
├── 5.1 PickupOrdersView
├── 5.2 markPickupItemsFulfilled + อัปเดต order status
└── 5.3 Route + เมนู

Phase 6–7: สถานะและ edge cases
└── ปรับ logic remaining / order status ให้รองรับ pickup
```

---

## ไฟล์ที่ต้องแก้ไข/สร้าง (Checklist)


| ไฟล์                                                      | การดำเนินการ                                                                                   |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `supabase/migrations/20260227_add_fulfillment_method.sql` | สร้างใหม่                                                                                      |
| `services/ordersService.ts` (types)                       | แก้ไข OrderItem, OrderItemInsert types                                                         |
| `views/CreateOrderView.tsx`                               | แก้ไข (เพิ่ม fulfillment mode UI + logic)                                                      |
| `views/EditOrderView.tsx`                                 | **แก้ไข (เพิ่มใหม่ — แผนเดิมไม่ได้ระบุ)**                                                      |
| `services/ordersService.ts`                               | แก้ไข createWithItems, getPendingOrders, เพิ่ม getPickupPendingItems, markPickupItemsFulfilled |
| `hooks/useCreateTripWizard.ts`                            | แก้ไข กรอง delivery items (fetchOrderItems, getRemaining, buildStoresPayload)                  |
| `services/orderTripSyncService.ts`                        | **แก้ไข (JS service ไม่ใช่ DB trigger)**                                                       |
| `services/vehicleRecommendationService.ts`                | กรอง delivery items (ผ่าน useCreateTripWizard)                                                 |
| `services/pdfService.ts`                                  | เพิ่ม generateOrderPickupSlipPDF                                                               |
| `views/PickupOrdersView.tsx`                              | สร้างใหม่                                                                                      |
| `index.tsx` (router + sidebar)                            | เพิ่ม route + เมนู                                                                             |


---

## หมายเหตุสำหรับการแยก View (ตาม .cursor/rules)

- CreateOrderView ปัจจุบัน ~1080 บรรทัด — เกินกว่าเป้าหมาย ~400
- แนะนำให้แยก "OrderItemsSection" หรือ "OrderProductsSection" ออกเป็น `components/order/OrderProductsSection.tsx` รองรับ fulfillment_method ก่อน แล้วค่อยเพิ่มฟีเจอร์นี้ใน component นั้น เพื่อให้ CreateOrderView ทำหน้าที่เป็น orchestrator เท่านั้น

