---
name: Split Order 3 Trips Wizard
overview: แผนพัฒนาโหมด wizard แบ่งออเดอร์เดียวเป็น 3 เที่ยว พร้อมการวิเคราะห์ผลกระทบจาก fulfillment_method (pickup) และกระบวนการที่เกี่ยวข้อง
todos:
  - id: phase1-analysis
    content: "Phase 1: วิเคราะห์กระบวนการที่เกี่ยวข้องและผลกระทบ"
    status: pending
  - id: phase2-schema
    content: "Phase 2: ปรับ Schema (ถ้าจำเป็น) สำหรับออเดอร์หลายทริป"
    status: pending
  - id: phase3-wizard
    content: "Phase 3: เพิ่มโหมดแบ่ง 3 เที่ยวใน wizard"
    status: pending
  - id: phase4-pickup
    content: "Phase 4: ปรับ logic การคำนวณ pickup/delivery"
    status: pending
  - id: phase5-downstream
    content: "Phase 5: ทดสอบกระบวนการ downstream"
    status: pending
isProject: true
---

# แผน: โหมด Wizard แบ่งออเดอร์เดียวเป็น 3 เที่ยว

**เป้าหมาย:** รองรับการจัดทริปออเดอร์เดียวที่ต้องแบ่งส่ง 3 เที่ยว (รวมถึงกรณี 2 ทะเบียนเดียวกัน + 1 ทะเบียนอื่น) พร้อมจัดการผลกระทบจาก `fulfillment_method = 'pickup'` อย่างถูกต้อง

---

## 1. สรุปความต้องการ


| กรณี                                                       | คำอธิบาย                                 | รองรับปัจจุบัน |
| ---------------------------------------------------------- | ---------------------------------------- | -------------- |
| ออเดอร์เดียว 3 เที่ยว รถคันเดียวกัน                        | แบ่งสินค้าขึ้นเที่ยว 1, 2, 3 (รถคันเดิม) | ❌ ไม่รองรับ    |
| ออเดอร์เดียว 2 เที่ยวทะเบียนเดียวกัน + 1 เที่ยวทะเบียนอื่น | เที่ยว 1–2: รถ A, เที่ยว 3: รถ B         | ❌ ไม่รองรับ    |
| ออเดอร์เดียว 2 เที่ยว (เลือกรถคันเดียวกันทั้ง 2 ช่อง)      | ใช้ได้แล้ว                               | ✅ รองรับ       |


---

## 2. กระบวนการที่เกี่ยวข้องและผลกระทบ

### 2.1 โครงสร้างข้อมูลปัจจุบัน


| ตาราง/ฟิลด์                      | บทบาท                            | ผลกระทบเมื่อออเดอร์แบ่ง 3 ทริป                                   |
| -------------------------------- | -------------------------------- | ---------------------------------------------------------------- |
| `orders.delivery_trip_id`        | ชี้ไปยังทริปเดียว                | ⚠️ **ปัญหาหลัก** — ออเดอร์ชี้ได้แค่ 1 ทริป                       |
| `order_items.fulfillment_method` | `delivery`                       | `pickup`                                                         |
| `order_items.quantity_delivered` | ยอดส่งแล้ว (รวมทุกทริป)          | ✅ Trigger นับจาก store+product อยู่แล้ว ไม่พึ่ง delivery_trip_id |
| `delivery_trip_stores`           | (trip_id, store_id)              | ✅ ร้านเดียวกันเข้าได้หลายทริป                                    |
| `delivery_trip_items`            | (trip_store_id, product_id, qty) | ✅ แต่ละทริปมี qty ของตัวเอง                                      |
| `delivery_trips.sequence_order`  | ลำดับเที่ยวรถคันเดียวกัน         | ✅ มีอยู่แล้ว                                                     |


### 2.2 สรุปผลกระทบจาก `fulfillment_method = 'pickup'`

ตาม `fulfillment-delivery-pickup.plan.md` และ code ปัจจุบัน:


| จุด                                                    | การจัดการปัจจุบัน                             | ผลกระทบเมื่อแบ่ง 3 เที่ยว                                                              |
| ------------------------------------------------------ | --------------------------------------------- | -------------------------------------------------------------------------------------- |
| `useCreateTripWizard.fetchOrderItems`                  | กรอง `fulfillment_method !== 'pickup'`        | ✅ ต้องคงไว้ — เฉพาะ delivery items เข้า trip                                           |
| `getRemaining`                                         | `quantity - picked_up - delivered`            | ⚠️ เมื่อ split หลายเที่ยว remaining ต้องคิดเฉพาะ **delivery portion** ที่ยังไม่ได้แบ่ง |
| `buildStoresPayload` / split payload                   | ใช้ delivery items เท่านั้น                   | ⚠️ ต้องแบ่ง qty ต่อ (trip1, trip2, trip3) ไม่ใช่ (vehicle1, vehicle2)                  |
| `vehicleRecommendationService`                         | รับ items จาก delivery เท่านั้น               | ✅ ผ่าน wizard อยู่แล้ว                                                                 |
| `orderTripSyncService.syncOrderToTrip`                 | กรอง pickup, sync ไป `order.delivery_trip_id` | ⚠️ ออเดอร์ชี้แค่ 1 ทริป → sync ได้แค่ทริปนั้น                                          |
| `sync_fulfilled_quantities_on_trip_complete` (trigger) | นับจาก store+product ทุก completed trips      | ✅ **ไม่ใช้ delivery_trip_id** — นับจาก dti รวมได้ถูกต้อง                               |
| `generate_order_number_for_trip`                       | ใช้เมื่อ assign order → trip                  | ⚠️ ออเดอร์ assign กับทริปไหน? ต้องกำหนดนโยบาย (เช่น ทริปแรก)                           |


### 2.3 กระบวนการ Downstream ที่ต้องตรวจสอบ


| กระบวนการ               | ไฟล์/ที่อยู่                                              | ผลกระทบ                                                                                                                   |
| ----------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Assign order to trip    | `ordersService.assignToTrip`, RPC `assign_orders_to_trip` | ออเดอร์ถูก assign ให้ **1 trip_id** เท่านั้น — ต้องตัดสินใจ: primary trip หรือสร้าง order_trip_assignments                |
| Order number generation | `generate_order_number_for_trip`, trigger                 | ใช้ `delivery_trip_stores.sequence_order` ของ trip ที่ assign — ถ้า assign กับ trip1 จะได้เลขตาม trip1                    |
| getPendingOrders        | `ordersService.getPendingOrders`                          | Filter `delivery_trip_id IS NULL` — ออเดอร์ที่จัดทริปแล้วจะไม่โผล่ (ถูกต้อง)                                              |
| Sync quantity delivered | `backfill_quantity_delivered_for_trip`, trigger           | นับจาก store+product ไม่ต้องพึ่ง delivery_trip_id — **รองรับหลายทริป**                                                    |
| Commission              | `auto-commission-worker`, crewService                     | คำนวณจาก delivery_trip — แต่ละทริปคำนวณแยก รองรับ                                                                         |
| Pickup flow             | `PickupOrdersView`, `getPickupPendingItems`               | แสดงเฉพาะ pickup items — ไม่เกี่ยวกับทริป                                                                                 |
| ใบแจ้งหนี้ / ออกบิล     | delivery_trip_stores.invoice_status                       | ต่อทริป/ร้าน แยกกัน — ไม่กระทบ                                                                                            |
| Trip cancel             | `tripCrudService.cancel`                                  | Reset orders ที่ชี้ทริปนี้ — ถ้าออเดอร์ชี้ trip1 แล้วยกเลิก trip1 ต้อง clear delivery_trip_id และปล่อยออเดอร์กลับ pending |


### 2.4 ปัญหาหลัก: `orders.delivery_trip_id` จำกัด 1 ค่า

**ทางเลือกในการออกแบบ:**


| ทางเลือก                                            | คำอธิบาย                                                              | ข้อดี                                                | ข้อเสีย                                                       |
| --------------------------------------------------- | --------------------------------------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------- |
| A. Primary trip                                     | ใช้ delivery_trip_id = trip แรก (sequence_order น้อยสุด)              | ไม่ต้องแก้ schema, sync/order_number ใช้ trip แรกได้ | UI/รายงานที่ filter ตาม trip_id อาจไม่เห็นออเดอร์ใน trip 2, 3 |
| B. order_trip_assignments                           | ตารางใหม่ (order_id, delivery_trip_id) แทน delivery_trip_id บน orders | ออเดอร์ผูกหลายทริปได้ชัดเจน                          | ต้องแก้หลายจุด (getPendingOrders, assign, cancel, sync)       |
| C. เก็บ delivery_trip_id = trip แรก + rely on store | คล้าย A แต่ใช้ store เป็นตัวเชื่อม                                    | ปัจจุบัน trigger/sync ใช้ store อยู่แล้ว             | เหมือน A                                                      |


**ข้อเสนอ:** ใช้ **ทางเลือก A (Primary trip)** เพื่อลดความซับซ้อน — assign ออเดอร์กับ **trip แรก** (sequence_order น้อยสุด) เท่านั้น `delivery_trip_id = trip1_id` ส่วน trip 2, 3 มีร้านและรายการสินค้าผ่าน delivery_trip_stores + delivery_trip_items โดยไม่ต้อง assign order ซ้ำ

- **order_number:** สร้างจาก trip แรก (ถูกต้อง)
- **sync quantity_delivered:** trigger นับจาก store+product ครบทุกทริป (ถูกต้อง)
- **Cancel trip:** ถ้ายกเลิก trip 1 → clear delivery_trip_id; ถ้ายกเลิก trip 2 หรือ 3 → ไม่ต้อง clear order (order ชี้ trip 1) แต่ต้องจัดการ delivery_trip_items ของทริปที่ยกเลิก

---

## 3. แผนการดำเนินงาน (Execution Plan)

### Phase 1: วิเคราะห์และยืนยันขอบเขต

- ยืนยันใช้ Primary trip (delivery_trip_id = trip แรก)
- ยืนยัน flow cancel: trip1 cancel → unassign order; trip2/3 cancel → ลบ items ในทริปนั้นเท่านั้น
- รายการไฟล์ที่ต้องแก้ (ดู Phase 2–5)

### Phase 2: Extended Types & State (ไม่มี DB migration)

**ไฟล์:** `types/createTripWizard.ts`

- ขยาย `ItemSplitQty` ให้รองรับ 3 เที่ยว:
  - ตัวเลือก 1: `trip1Qty`, `trip2Qty`, `trip3Qty` แทน `vehicle1Qty`, `vehicle2Qty`
  - ตัวเลือก 2: `splitMode: '2vehicles' | '3trips'` + `vehicle1Qty`/`vehicle2Qty` vs `trip1Qty`/`trip2Qty`/`trip3Qty`
- เพิ่ม type สำหรับ trip config: `{ vehicleId, driverId }[]` ความยาว 3

### Phase 3: Wizard UI & Logic

**ไฟล์:** `hooks/useCreateTripWizard.ts`


| การเปลี่ยนแปลง            | รายละเอียด                                                                       |
| ------------------------- | -------------------------------------------------------------------------------- |
| โหมดใหม่                  | `splitIntoThreeTrips: boolean` หรือ `splitMode: 'single'                         |
| State                     | `selectedVehicleId` × 3 (หรือ 2 ถ้า trip1&2 คันเดียวกัน), `selectedDriverId` × 3 |
| `itemSplitMap`            | key เดิม, value: `{ trip1Qty, trip2Qty, trip3Qty }` หรือ object ตาม mode         |
| `getRemaining`            | คำนวณ remaining **เฉพาะ delivery items**; กรอง pickup ก่อนรวม                    |
| `buildSplitStoresPayload` | สร้าง 3 payloads สำหรับ trip 1, 2, 3                                             |
| `handleSubmit`            | สร้าง 3 ทริป (vehicle, driver, planned_date, stores+items ต่อเที่ยว)             |
| Assign order              | `assignToTrip(orderIds, trip1Id)` — assign ให้ trip แรกเท่านั้น                  |


**ไฟล์:** `components/trip/CrewAssignmentStep.tsx`, `OrderSelectionStep.tsx`

- แสดง UI แบ่ง 3 เที่ยว (เที่ยว 1, 2, 3) พร้อม vehicle/driver ต่อเที่ยว
- รองรับกรณีเที่ยว 1&2 คันเดียวกัน, เที่ยว 3 คันอื่น
- คอลัมน์ split qty: Trip1 | Trip2 | Trip3 (แทน Vehicle1 | Vehicle2)

**ไฟล์:** `components/trip/VehicleSelectionStep.tsx`

- ปรับให้เลือกรถได้หลายเที่ยว (หรือรวมกับ CrewAssignmentStep)

### Phase 4: กรอง Pickup ใน Split Logic

**ไฟล์:** `hooks/useCreateTripWizard.ts`


| จุด                                  | การแก้ไข                                                                                    |
| ------------------------------------ | ------------------------------------------------------------------------------------------- |
| `fetchOrderItems`                    | คงการกรอง `fulfillment_method !== 'pickup'`                                                 |
| `getRemaining`                       | ใช้เฉพาะ delivery items; สูตร `quantity - quantity_picked_up_at_store - quantity_delivered` |
| `handleSplitQtyChange`               | จำกัดเฉพาะ delivery items; ห้าม split pickup                                                |
| `buildSplitStoresPayload` (3 เที่ยว) | ใส่เฉพาะ delivery items ใน payload แต่ละเที่ยว                                              |
| Validation                           | ตรวจว่า `trip1Qty + trip2Qty + trip3Qty <= remaining` (ของ delivery item)                   |


**ไฟล์:** `services/orderTripSyncService.ts`

- `syncOrderToTrip` ยัง sync ไป `order.delivery_trip_id` (trip แรก) — ไม่เปลี่ยน
- ให้แน่ใจว่า sync เฉพาะ delivery items (ทำอยู่แล้ว)

### Phase 5: Cancel & Edge Cases ✅

**ไฟล์:** `services/deliveryTrip/tripStatusService.ts`

- **Cancel trip 1:** Logic เดิมทำงานถูกต้อง — order ชี้ trip 1 → unassign (`delivery_trip_id = null`, `order_number = null`)
- **Cancel trip 2 หรือ 3:** Logic เดิมทำงานถูกต้อง — order ชี้ trip 1 (ไม่ชี้ trip 2/3) → ไม่พบ order → ไม่ unassign, แค่เปลี่ยน status เป็น cancelled
- เพิ่ม JSDoc อธิบาย multi-trip cancel behavior แล้ว

### Phase 6: Testing Checklist ✅

**Checklist:** [split-order-3-trips-phase6-testing.md](split-order-3-trips-phase6-testing.md)

- ออเดอร์ delivery ทั้งหมด แบ่ง 3 เที่ยว (รถคันเดียวกัน) → 3 ทริปสร้างได้, sequence_order 1,2,3
- ออเดอร์ delivery แบ่ง 2 เที่ยวคันเดียวกัน + 1 เที่ยวคันอื่น → 3 ทริปถูกต้อง
- ออเดอร์ **ผสม** (delivery + pickup): แบ่งเฉพาะ delivery items; pickup ไม่เข้า trip
- เช็คอินทีละเที่ยว → quantity_delivered ใน order_items เพิ่มตาม (รวมทุกทริป)
- order_number สร้างจาก trip แรก
- Cancel trip 1 → ออเดอร์กลับ pending
- Cancel trip 2 หรือ 3 → items ในทริปนั้นหาย, ออเดอร์ยังคง assign trip 1

---

## 4. ไฟล์ที่ต้องแก้ไข (Checklist)


| ไฟล์                                         | การดำเนินการ                                       |
| -------------------------------------------- | -------------------------------------------------- |
| `types/createTripWizard.ts`                  | ขยาย ItemSplitQty, splitMode                       |
| `hooks/useCreateTripWizard.ts`               | โหมด 3 เที่ยว, state, submit, กรอง pickup          |
| `components/trip/CrewAssignmentStep.tsx`     | UI 3 เที่ยว, vehicle/driver × 3                    |
| `components/trip/OrderSelectionStep.tsx`     | คอลัมน์ Trip1/Trip2/Trip3, กรอง delivery           |
| `components/trip/VehicleSelectionStep.tsx`   | (ถ้าแยก step เลือกรถ)                              |
| `views/CreateTripFromOrdersView.tsx`         | ส่ง props โหมด 3 เที่ยว                            |
| `services/deliveryTrip/tripStatusService.ts` | JSDoc multi-trip cancel (logic เดิมรองรับอยู่แล้ว) |
| `services/orderTripSyncService.ts`           | ยืนยันกรอง pickup (มีอยู่แล้ว)                     |


**ไม่ต้องแก้:**

- `sql/` — ไม่เปลี่ยน schema สำหรับทางเลือก A
- `sync_fulfilled_quantities_on_trip_complete` — ใช้ store+product อยู่แล้ว
- `getPendingOrders` — ยังใช้ delivery_trip_id IS NULL
- Commission / ใบแจ้งหนี้ — ต่อทริป แยกกัน

---

## 5. สรุปความเสี่ยงและข้อควรระวัง


| ความเสี่ยง                                    | การลดความเสี่ยง                                                   |
| --------------------------------------------- | ----------------------------------------------------------------- |
| Pickup items ถูก split เข้า trip โดยไม่ตั้งใจ | กรอง pickup ทุกจุดที่เกี่ยวกับ split + validation                 |
| quantity_delivered คำนวณผิดเมื่อมีหลายทริป    | Trigger นับจาก store+product อยู่แล้ว — ต้องทดสอบให้แน่ใจ         |
| order_number ซ้ำหรือผิด                       | ใช้ trip แรก assign เท่านั้น                                      |
| Cancel สร้างความสับสน                         | กำหนดนโยบายชัดเจน: trip1 cancel = unassign; trip2/3 = ลบแค่ items |
| UI ซับซ้อน                                    | เริ่มจากโหมด 3 เที่ยวคงที่ (ไม่ต้อง flexible 2–4 เที่ยวก่อน)      |


---

## 6. ลำดับการทำ (Recommended Order)

```
Phase 1: ยืนยันขอบเขตและทางเลือก (Primary trip)
    ↓
Phase 2: Types + State ใน useCreateTripWizard
    ↓
Phase 3: UI (CrewAssignmentStep, OrderSelectionStep) สำหรับโหมด 3 เที่ยว
    ↓
Phase 4: Submit logic + Assign order กับ trip แรก
    ↓
Phase 5: กรอง pickup ในทุกขั้นตอน
    ↓
Phase 6: Cancel logic + edge cases
    ↓
Phase 7: Testing
```

