## สถาปัตยกรรมระบบ Fleet & Delivery Management

เอกสารนี้อธิบายสถาปัตยกรรมโดยรวมของโปรเจค ทั้งโครงสร้างเทคนิค การจัดเลเยอร์โค้ด ฐานข้อมูล ฟีเจอร์หลัก รวมถึงแนวคิดด้านประสิทธิภาพและการขยายระบบในอนาคต  
มุ่งให้ใช้ได้ทั้งสำหรับผู้พัฒนาคนใหม่ และผู้บริหาร/ผู้ใช้งานที่อยากเข้าใจ “ภาพใหญ่” ของระบบนี้

---

## 1. ภาพรวมสถาปัตยกรรม (High-level Overview)

- **Client (Frontend)**:  
  - React + TypeScript รันทั้งหมดใน Browser  
  - ใช้ component UI แบบออกแบบเอง + Tailwind/utility class  
  - ใช้ custom hooks (`useDeliveryTrips`, `useTripLogs`, `useReports` ฯลฯ) เป็นเลเยอร์ดึงข้อมูลและจัดการ state

- **Backend / API Layer**:  
  - ใช้ **Supabase (PostgREST + Auth)** เป็น Backend-as-a-Service  
  - โค้ดฝั่ง frontend เรียกผ่าน “service layer” เช่น `deliveryTripService`, `reportsService`, `tripLogService`  
  - Business logic หลายส่วน (เช่น summary, audit log, trigger, RLS) อยู่ใน **PostgreSQL + SQL Function**

- **Database**:  
  - PostgreSQL บน Supabase  
  - แยกตารางหลักตามโดเมน:
    - การจัดการรถ: `vehicles`, `trip_logs`, ตารางซ่อมบำรุง, fuel log ฯลฯ  
    - การส่งสินค้า: `delivery_trips`, `delivery_trip_stores`, `delivery_trip_items`, `delivery_trip_item_changes`  
    - ร้านค้า/สินค้า: `stores`, `products`, `product_categories`  
    - **พนักงานและค่าคอมมิชชั่น**: `service_staff`, `delivery_trip_crews`, `commission_rates`, `commission_logs`
    - ผู้ใช้และสิทธิ์: `profiles`, RLS policies
  - มีตาราง **สรุปรายวัน (Summary / Aggregate)** เพื่อรองรับรายงานระดับข้อมูลจำนวนมาก:
    - `delivery_stats_by_day_vehicle`
    - `delivery_stats_by_day_store`
    - `delivery_stats_by_day_product`
    - `delivery_stats_by_day_store_product`

---

## 2. โครงสร้างโค้ดฝั่ง Frontend

โครงสร้างหลัก (โฟลเดอร์สำคัญ):

- `views/`  
  - รวมหน้า (Page) ต่างๆ ที่ผู้ใช้เห็น เช่น:
    - `DashboardView.tsx`
    - `DeliveryTripListView.tsx`, `DeliveryTripDetailView.tsx`, `DeliveryTripFormView.tsx`
    - `TripLogListView.tsx`, `TripLogFormView.tsx`
    - `ReportsView.tsx`, `StoreDeliveryDetailView.tsx`
  - แต่ละ View โฟกัสที่การจัด layout, ผูกกับ hooks และแสดง UI

- `services/`  
  - เป็นเลเยอร์ติดต่อกับ Supabase / API โดยตรง  
  - ตัวอย่าง:
    - `deliveryTripService.ts` – CRUD ทริปส่งสินค้า, แก้ไขสินค้าในทริป, audit log  
    - `tripLogService.ts` – บันทึกการใช้รถ (check-out/check-in), ผูกกับ delivery trip  
    - `crewService.ts` – จัดการพนักงานในทริป, swap crew, คำนวณค่าคอมมิชชั่น
    - `reportsService.ts` – ฟังก์ชันสร้างรายงานทุกชนิด (ตามรถ/ร้าน/สินค้า/รายเดือน)  
    - `storeService.ts`, `profileService.ts`, `pdfService.ts` ฯลฯ  
  - ข้อดี: แยก business logic ด้านข้อมูลออกจาก UI ชัดเจน

- `hooks/`  
  - ห่อ service เป็น custom hooks สำหรับใช้ใน React component
  - ตัวอย่าง:
    - `useDeliveryTrips`, `useDeliveryTrip`
    - `useTripLogs`, `useVehicles`, `useStores`, `useProducts`
    - `useCrewByTrip`, `useCommissionLogs`, `useCrewManagement`, `useCommissionCalculation`
    - `useDeliverySummaryByVehicle`, `useDeliverySummaryByStore`, `useDeliverySummaryByProduct`, `useMonthlyDeliveryReport`
    - `useProductDeliveryHistory` (ดูไทม์ไลน์การส่งสินค้าของร้าน/สินค้า)

- `components/`  
  - UI ส่วนประกอบที่ใช้ซ้ำ:
    - `PageLayout`, `Card`, `Button`, `Input`, `Avatar`, `ConfirmDialog`
    - Chart components เช่น `VehicleFuelConsumptionChart`
  - ทำให้หน้าต่างๆ มีหน้าตาและ UX ที่สม่ำเสมอ

- `sql/`  
  - ไฟล์ migration และ view / function ต่างๆ ของฐานข้อมูล  
  - ใช้เป็น “source of truth” ด้าน schema และ logic ที่ฝังใน DB

---

## 3. โครงสร้างฐานข้อมูลสำหรับงาน “ส่งสินค้า”

### 3.1 ตารางหลัก

- **`delivery_trips`** (หัวทริปส่งสินค้า)
  - เก็บข้อมูลระดับ “เที่ยวรถ” เช่น:
    - `id`
    - `trip_number` (เลขทริปอ่านง่ายเช่น `DT-2512-0001`)
    - `vehicle_id`, `driver_id`
    - `planned_date`
    - `odometer_start`, `odometer_end`
    - `status` (planned, in_progress, completed, cancelled)
    - `has_item_changes`, `last_item_change_at` (ธงว่าทริปนี้เคยแก้ไขสินค้าหรือไม่)

- **`delivery_trip_stores`** (ร้านในทริป)
  - ผูกทริป 1 ทริปกับหลายร้าน:
    - `delivery_trip_id`
    - `store_id` (อ้างถึง `stores`)
    - `sequence_order` (ลำดับการไปส่ง)
    - `delivery_status` (pending, delivered, failed)
    - `delivered_at` (เวลาที่ถือว่าส่งเสร็จ)

- **`delivery_trip_items`** (สินค้าในแต่ละร้านของทริป)
  - ระดับ “รายละเอียดสินค้า”:
    - `delivery_trip_store_id` → ร้านนี้ในทริปนี้
    - `product_id` → สินค้าอะไร
    - `quantity`
    - `notes`

- **`delivery_trip_item_changes`** (Audit log การแก้ไขสินค้า)
  - บันทึกทุกการเพิ่ม/แก้/ลบสินค้าในทริป:
    - `action` (add / update / remove)
    - `old_quantity`, `new_quantity`
    - `reason`
    - `created_at`, `created_by`
  - ใช้ตอบคำถามด้านตรวจสอบ เช่น “ใครลบสินค้าออกจากทริปนี้เมื่อไร และเพราะอะไร”

- **`trip_logs`** (การใช้งานรถ)
  - บันทึก check-out/check-in และไมล์ของรถ  
  - ผูกกับ `delivery_trips` เพื่อรู้ว่าการใช้รถเที่ยวไหนคือทริปส่งสินค้าใด

### 3.2 ตารางสรุปรายวัน (Summary / Aggregate)

เพื่อให้รายงานเร็วแม้ข้อมูลจะโตมาก ระบบมี **ตารางสรุปรายวัน** แยกออกมาต่างหาก:

- `delivery_stats_by_day_vehicle`
  - ระดับ: วัน + รถ
  - ฟิลด์หลัก:
    - `stat_date`
    - `vehicle_id`
    - `total_trips`
    - `total_stores`
    - `total_items`
    - `total_quantity`
    - `total_distance_km`

- `delivery_stats_by_day_store`
  - ระดับ: วัน + ร้าน
  - ฟิลด์หลัก:
    - `stat_date`
    - `store_id`
    - `total_trips`
    - `total_items`
    - `total_quantity`

- `delivery_stats_by_day_product`
  - ระดับ: วัน + สินค้า
  - ฟิลด์หลัก:
    - `stat_date`
    - `product_id`
    - `total_trips`
    - `total_stores`
    - `total_quantity`

- `delivery_stats_by_day_store_product`
  - ระดับ: วัน + ร้าน + สินค้า
  - ฟิลด์หลัก:
    - `stat_date`
    - `store_id`
    - `product_id`
    - `total_deliveries` (จำนวนครั้งที่มีสินค้าแสดงในร้านนี้ในวันนั้น)
    - `total_quantity`

มี SQL function สำหรับ “รีเฟรชสรุป” แบบ incremental:

- `refresh_delivery_stats_by_day_vehicle(start_date, end_date)`
- `refresh_delivery_stats_by_day_store(start_date, end_date)`
- `refresh_delivery_stats_by_day_product(start_date, end_date)`
- `refresh_delivery_stats_by_day_store_product(start_date, end_date)`

แนวคิดคือ:

- ตารางพวกนี้ไม่ใช่ source หลักของข้อมูล แต่เป็น “index/summary” ที่สร้างจากตารางจริง
- สามารถรันรีเฟรชทุกคืน / ทุกชั่วโมง หรือเฉพาะวันที่มีการแก้ไขย้อนหลัง
- รายงานฝั่ง frontend ใช้ summary table พวกนี้ในการตอบคำถามเชิงสถิติ → ทำให้โหลดเร็วมาก

---

## 4. Service Layer และฟีเจอร์สำคัญ

### 4.1 `deliveryTripService`

**บทบาท**: ศูนย์กลางจัดการทริปส่งสินค้า (สร้าง/แก้/อ่าน) และ audit การแก้ไขสินค้า

ความสามารถหลัก:

- สร้างทริปใหม่ พร้อมร้านและสินค้า
- อัปเดตทริป:
  - เปรียบเทียบรายการสินค้าเดิม vs ใหม่
  - ตรวจจับการ `add / update / remove`
  - บันทึกลง `delivery_trip_item_changes` ก่อนลบ/แก้จริง  
  - ถ้ามีการแก้ในทริปที่ `completed` บังคับใส่เหตุผล
  - เซต `has_item_changes = true`, `last_item_change_at = now()`
- ดึงประวัติการแก้ไขสินค้า (`getItemChangeHistory`) แสดงในหน้า `DeliveryTripDetailView`
- สร้างข้อมูลสรุปสินค้าในทริป (aggregated products) สำหรับใบส่งของ/รายงาน

**จุดเด่นทางสถาปัตยกรรม**:

- Audit log อยู่ใน DB ทำให้เชื่อถือได้ และไม่ผูกกับ frontend
- Logic เปรียบเทียบรายการสินค้าอยู่ใน service เดียว ทำให้ UI เรียบง่าย (แค่ส่งรายการใหม่ไป)

### 4.2 `tripLogService`

**บทบาท**: จัดการ “ประวัติการใช้งานรถ” (Trip logs) และเชื่อมกับทริปส่งสินค้า

ความสามารถ:

- สร้าง trip log check-out/check-in
- ตอน check-in:
  - สามารถอัปเดตสถานะ `delivery_trips` และ `delivery_trip_stores` เป็น “completed / delivered” ตาม logic ที่ตกลง
- ดึงประวัติการเดินทางพร้อม vehicle / driver / delivery_trip (ใช้ใน `TripLogListView` และ `DailySummaryView`)

**จุดเด่น**:

- ผูก “การใช้รถ” กับ “การส่งสินค้า” อย่างชัดเจน → ใช้ข้อมูลร่วมกันได้ทั้งฝั่ง fleet และ delivery

### 4.3 `reportsService`

**บทบาท**: ศูนย์กลางรายงานและการวิเคราะห์

ฟังก์ชันหลัก:

- `getDeliverySummaryByVehicle(startDate, endDate, vehicleId?)`
  - ตอนนี้ใช้ตาราง `delivery_stats_by_day_vehicle` → รวมผลต่อรถ
- `getDeliverySummaryByStore(startDate, endDate, storeId?)`
  - ใช้ `delivery_stats_by_day_store` + `delivery_stats_by_day_store_product`
- `getDeliverySummaryByProduct(startDate, endDate, productId?)`
  - ใช้ `delivery_stats_by_day_store_product`
- `getMonthlyDeliveryReport(months)`
  - รายงานสรุปเปรียบเทียบรายเดือน
- `getProductDeliveryHistory(storeId, productId, startDate?, endDate?)`
  - รายการทุกรายการส่งของสินค้าตัวหนึ่งไปยังร้านหนึ่ง (ใช้ใน `StoreDeliveryDetailView`)

**ประเด็นสำคัญ**:

- ระมัดระวังเรื่อง timezone:
  - ใช้ฟังก์ชัน `formatDateForQuery` เพื่อสร้างวันที่แบบ local `YYYY-MM-DD`  
  - ไม่ใช้ `toISOString().split('T')[0]` ที่อาจทำให้วันเหลื่อม
- มี error logging ที่ละเอียด เมื่อ query ผิด FK หรือ schema

---

## 5. มุมมองผู้ใช้ (UX Flows หลัก)

### 5.1 การสร้างและจัดการทริปส่งสินค้า

1. ผู้ใช้เปิดหน้า `DeliveryTripListView`
2. กด “สร้างทริปใหม่” → ไป `DeliveryTripFormView`
3. เลือกรถ, คนขับ, วันที่, ร้านค้า, สินค้าและจำนวน
4. บันทึก → สร้าง record ใน `delivery_trips` + `delivery_trip_stores` + `delivery_trip_items`
5. เมื่อมีการเปลี่ยนแปลงรายการสินค้า:
   - UI ส่ง “รายการสินค้าชุดใหม่” เข้า `deliveryTripService.update`
   - Service คำนวณ diff + บันทึก audit log + ปรับธงในทริป

### 5.2 การดูประวัติการแก้ไขสินค้าในทริป

- หน้า `DeliveryTripDetailView`:
  - ส่วนบน: ข้อมูลทริป + รถ + คนขับ + ไมล์ + รายการร้าน + ตารางสรุปสินค้า
  - ส่วนล่าง: “ประวัติการแก้ไขสินค้า” ดึงจาก `delivery_trip_item_changes`
    - เห็น action (เพิ่ม/ลบ/แก้จำนวน), จาก–เป็น, เหตุผล, ผู้แก้, เวลา

### 5.3 รายงานการส่งสินค้า (Reports → Delivery)

ใน `ReportsView` → แท็บ “รายงานการส่งสินค้า” มี sub-tab:

- **ตามรถ**: ใช้ `useDeliverySummaryByVehicle`
- **ตามร้าน**: ใช้ `useDeliverySummaryByStore`
- **ตามสินค้า**: ใช้ `useDeliverySummaryByProduct`
- **รายเดือน**: ใช้ `useMonthlyDeliveryReport`

จุดเด่น:

- มีตัวกรองวันที่ (รวมถึงกรอง “วันเดียว”) ที่ถูกต้องแม่นยำ
- มีตัวกรองรถ / ร้าน / สินค้า / สาขา / หมวดสินค้า
- คลิกเจาะ (drill-down) ได้:
  - จาก “ตามร้าน” → เปิด `StoreDeliveryDetailView` ดูไทม์ไลน์ร้านนั้น
  - จาก Trip Log / Daily Summary → คลิกเลขทริปเพื่อเปิด `DeliveryTripDetailView`

---

## 6. จุดเด่นด้านสถาปัตยกรรมและความสามารถ

- **แยก concern ชัดเจน**  
  - UI (views + components)  
  - Data / Business Logic (services + hooks)  
  - Persistence & Aggregation (SQL schema, functions, summary tables)

- **ออกแบบมาสำหรับ “ของจริงในสนาม”**
  - รองรับกรณีผิดพลาด: สั่งผิด, ขึ้นของผิด, ส่งไม่ครบ → มี audit log และสามารถแก้ไขย้อนหลังแบบโปร่งใส
  - ทริปที่จบแล้ว (completed) ยังแก้สินค้าได้ แต่บังคับเหตุผลและเก็บประวัติ
  - ผู้ใช้ดูได้เลยว่าทริปไหนมีการแก้สินค้า จาก badge ใน list

- **พร้อมสำหรับข้อมูลจำนวนมาก**
  - เปลี่ยนจากการคำนวณรายงานบน table จริงทุกครั้ง → มาใช้ summary table รายวัน
  - ฟังก์ชัน `refresh_delivery_stats_by_day_*` ช่วยให้ปรับปรุงสรุปเฉพาะช่วงได้ (ไม่ต้อง recalculation ทั้งระบบ)
  - ทำให้หน้า “รายงานการส่งสินค้า” โหลดเร็ว แม้มีข้อมูลย้อนหลังหลายเดือน/ปี

- **ขยายได้ง่ายในอนาคต**
  - สามารถเพิ่ม summary view/ table ใหม่ เช่น:
    - สรุปตามสาขา (branch)
    - สรุปตามเขต/พื้นที่ (zone) ถ้าเพิ่ม field พื้นที่ในร้านค้า
  - ต่อกับ BI tools ภายนอกได้ง่าย เพราะโครง summary เป็นรูปแบบ star-schema เบื้องต้น

- **ความปลอดภัยและการแบ่งสิทธิ์**
  - ใช้ Supabase Auth + Row Level Security (RLS)
  - จำกัดสิทธิ์การ insert audit log เฉพาะ role `admin / manager / inspector`
  - ปรับ RLS ให้ driver เห็นเฉพาะข้อมูลที่เกี่ยวข้องกับตัวเอง (trip logs, trips) ได้

---

## 7. แนวทางขยายต่อในอนาคต

จากสถาปัตยกรรมปัจจุบัน ระบบสามารถต่อยอดได้ง่ายในทิศทางต่อไปนี้:

- **Executive Dashboard** แยกต่างหากสำหรับผู้บริหาร:
  - ใช้ summary tables สร้าง live dashboard: กราฟยอดส่งรายวัน/เดือน, ranking รถ/ร้าน/สินค้า

- **การวิเคราะห์ต้นทุน (Cost Analysis)**
  - ผูกค่าน้ำมัน, ค่าแรง, ค่าเสื่อม เข้ากับทริป → สร้างตารางสรุปต้นทุนต่อเที่ยว/ต่อร้าน/ต่อสินค้า

- **Predictive / Recommendation**
  - ใช้ข้อมูลสถิติส่งของช่วยแนะนำ: route ที่เหมาะสม, จำนวนเที่ยวที่เพียงพอ, แนวโน้มยอดสั่ง ฯลฯ

- **Integration กับระบบอื่น**
  - ERP / ระบบบัญชี (เชื่อมกับใบกำกับภาษี, invoice)
  - ระบบขายหน้าร้าน/สาขา (POS) เพื่อเทียบยอดขาย vs ยอดส่ง

สถาปัตยกรรมในปัจจุบันถูกออกแบบมาเพื่อรองรับการเติบโตเหล่านี้ โดยไม่ต้องรื้อใหม่ทั้งหมด แต่ใช้การเพิ่ม summary, view และ service layer เพิ่มเติมเท่านั้น



