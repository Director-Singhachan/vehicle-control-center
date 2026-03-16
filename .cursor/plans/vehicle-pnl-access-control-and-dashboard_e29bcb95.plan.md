---
name: vehicle-pnl-access-control-and-dashboard
overview: ออกแบบและวางแผนการพัฒนาโมดูล P&L (Trip/Vehicle/Fleet) พร้อมระบบจำกัดสิทธิ์การเข้าถึง (Access Control) สำหรับ Vehicle Control Center บน React + Supabase โดยคำนึงถึงความลับของข้อมูลเงินเดือนและต้นทุนคู่ค้า
todos:
  - id: define-role-permission-matrix
    content: ออกแบบตารางสำหรับข้อมูลดิบ, allocation rules, และ snapshot P&L (trip/vehicle/fleet) ให้รองรับการคำนวณและ historical analysis
    status: completed
  - id: plan-rls-and-views
    content: ออกแบบ Workflow การบันทึก/อนุมัติข้อมูล (Trip, Salary, Purchasing) และจุดที่ข้อมูลถูกนำเข้า P&L อย่างเป็นระบบ
    status: completed
  - id: plan-dashboards-per-role
    content: ออกแบบ Business Rules ตรวจสอบคุณภาพข้อมูล, Alerting, และ Audit Log/History สำหรับข้อมูลอ่อนไหว
    status: completed
isProject: false
---

# แผนพัฒนาโมดูล P&L และ Access Control อย่างละเอียด

### 1. กรอบแนวคิดและขอบเขตงาน (High-level Scope)

- **เป้าหมายธุรกิจ**
  - ให้ผู้บริหารเห็น P&L จริงใน 3 ระดับ: Trip, Vehicle, Fleet
  - รักษาความลับข้อมูลเงินเดือนพนักงานและราคาต้นทุนคู่ค้า
  - ลดงานแมนนวลของบัญชี/การเงินด้วยการคำนวณอัตโนมัติ
- **ขอบเขตเทคนิค (สอดคล้องกับโปรเจกต์ปัจจุบัน)**
  - Frontend: React + TypeScript + Tailwind ในโครงสร้างปัจจุบัน (`components/`, `views/`, `hooks/`, `services/`, `stores/`)
  - Backend: Supabase (Postgres + RLS) โดยใช้ `types/database.ts` เป็นแหล่งอ้างอิงสคีมา
  - ไม่แตะ Edge Functions ในเฟสแรก ยกเว้นกรณีจำเป็นเรื่อง batch calculation

---

### 2. ออกแบบ Role & Permission Matrix (Access Control Model)

#### 2.1 กำหนด Role หลัก

- **Role พื้นฐาน**
  - `ROLE_PURCHASING_USER`: เจ้าหน้าที่จัดซื้อ
  - `ROLE_HR_USER`: เจ้าหน้าที่ฝ่ายบุคคล
  - `ROLE_OPERATION_USER`: เจ้าหน้าที่ปฏิบัติการขนส่ง
  - `ROLE_BRANCH_MANAGER`: ผู้จัดการสาขา
  - `ROLE_TOP_MANAGEMENT`: ผู้บริหารระดับสูง
  - `ROLE_SYSTEM_ADMIN`: ผู้ดูแลระบบ (สิทธิ์สูงสุดด้านเทคนิค แต่ไม่จำเป็นต้องเห็นข้อมูลส่วนบุคคลทุกรายการ)

#### 2.2 ตารางสิทธิ์ตามประเภทข้อมูล (Permission Matrix)

- **นิยามชุดข้อมูล (Data Domains)**
  - `SalaryDetail`: เงินเดือนรายบุคคล + ประวัติ
  - `SalarySummary`: ยอดรวมเงินเดือนตามสาขา/กองรถ/ช่วงเวลา
  - `PurchasingDetail`: รายการสั่งซื้อ, ราคาต่อหน่วย, สัญญา Supplier
  - `PurchasingSummary`: ยอดรวมต้นทุนจัดซื้อตามมิติหลัก (สาขา/กองรถ/ลูกค้า)
  - `TripDetail`: รายละเอียดเที่ยววิ่ง, ค่าน้ำมัน, ทางด่วน, เบี้ยเลี้ยง
  - `VehiclePnl`: ผลกำไร-ขาดทุนระดับรายคัน (รวม Fixed/Variable/Idle)
  - `TripPnl`: ผลกำไร-ขาดทุนระดับรายเที่ยว
  - `FleetPnl`: สรุป P&L ทั้งกองรถหรือทั้งบริษัท
- **ระดับสิทธิ์**
  - `NONE`: มองไม่เห็น
  - `SUMMARY`: เห็นเฉพาะตัวเลขรวม/ไม่ระบุตัวบุคคลหรือคู่ค้า
  - `DETAIL_VIEW`: เห็นรายละเอียดรายการ แต่แก้ไขไม่ได้
  - `EDIT`: แก้ไข/สร้าง/ลบข้อมูลได้
- **วาง Matrix เบื้องต้น (จะลงรายละเอียดในโค้ด/คอนฟิกภายหลัง)**
  - `ROLE_HR_USER`
    - `SalaryDetail`: EDIT
    - `SalarySummary`: SUMMARY
    - `VehiclePnl` / `TripPnl` / `FleetPnl`: NONE หรือ SUMMARY ตามความจำเป็น
  - `ROLE_PURCHASING_USER`
    - `PurchasingDetail`: EDIT
    - `PurchasingSummary`: SUMMARY
    - P&L ต่างๆ: SUMMARY หรือ NONE ตามนโยบาย
  - `ROLE_OPERATION_USER`
    - `TripDetail`: EDIT (เฉพาะสาขาของตัวเอง)
    - `TripPnl`: SUMMARY หรือ DETAIL_VIEW เฉพาะสาขาของตัวเอง
  - `ROLE_BRANCH_MANAGER`
    - `TripDetail`: DETAIL_VIEW (เฉพาะสาขาตัวเอง)
    - `VehiclePnl`: SUMMARY/DETAIL_VIEW (เฉพาะสาขาตัวเอง)
    - `FleetPnl`: SUMMARY บางส่วน (เฉพาะสาขาตัวเอง)
    - ไม่เห็น `SalaryDetail`
  - `ROLE_TOP_MANAGEMENT`
    - `FleetPnl`: SUMMARY ทุกสาขา
    - `VehiclePnl` / `TripPnl`: SUMMARY (ไม่มีข้อมูลบุคคล/คู่ค้าเจาะลึกเกินไป)
    - `SalarySummary` & `PurchasingSummary`: SUMMARY ระดับบริษัทหรือกลุ่มสาขา

#### 2.3 Binding Role กับ User ในระบบ

- ใช้โครงสร้าง เช่น `user_profiles` เชื่อมกับ `auth.users` ของ Supabase:
  - ฟิลด์สำคัญ: `role`, `branch_id`, `company_id`, `is_active`
- วางหลักการ:
  - Frontend ใช้ `useAuth` + `useUserProfile` เพื่อดึง role/branch
  - Supabase RLS ใช้ JWT claim หรือ join กับ `user_profiles` เพื่อตัดสินใจสิทธิ์

---

### 3. ออกแบบ Data Model สำหรับ P&L และต้นทุน

#### 3.1 ตารางหลักสำหรับข้อมูลดิบ (Operational Data)

- **ตัวอย่างตาราง (สมมติ)** – ตรวจสอบและแม็ปกับสคีมาปัจจุบันใน `types/database.ts` ภายหลัง
  - `trips`
    - `id`, `vehicle_id`, `driver_id`, `route_id`, `customer_id`, `branch_id`
    - `planned_date`, `actual_date`, `distance_km`, `status`
  - `trip_costs`
    - `id`, `trip_id`, `cost_type`, `amount`, `description`, `source` (manual/import)
  - `vehicles`
    - `id`, `plate_no`, `branch_id`, `vehicle_type`, `status`
  - `employees`
    - `id`, `employee_code`, `branch_id`, `position`, `is_driver`
  - `employee_salary_history`
    - `id`, `employee_id`, `amount`, `effective_from`, `effective_to`, `reason`, `updated_by`
  - `purchasing_orders` / `purchasing_items`
    - โครงสำหรับราคาต่อหน่วย, supplier, category, branch_id

#### 3.2 ตารางสำหรับกติกาการปันส่วนต้นทุน (Allocation Rules)

- ตาราง `cost_allocation_rules`
  - ฟิลด์หลัก: `id`, `cost_category`, `allocation_basis` (เช่น `per_vehicle`, `per_trip`, `per_revenue`), `dimension` (branch/fleet), `is_active`
  - ตัวอย่างกติกา:
    - เงินเดือนคนขับ: ปันไปยังรถที่คนขับนั้นประจำ (per_vehicle)
    - ค่าเช่าลานจอด: ปันตามจำนวนคันในสาขา (per_vehicle_in_branch)
    - ทีมจัดซื้อส่วนกลาง: ปันตามสัดส่วนรายได้ของแต่ละกอง (per_revenue_share)

#### 3.3 ตารางสำหรับผลการคำนวณ P&L (Snapshots)

- `pnl_trip`
  - `trip_id`, `revenue`, `fixed_cost_allocated`, `variable_cost`, `idle_cost`, `gross_margin`
- `pnl_vehicle`
  - `vehicle_id`, `period` (เช่น เดือน), `revenue`, `fixed_cost`, `variable_cost`, `idle_cost`, `total_cost`, `profit`
- `pnl_fleet`
  - `fleet_id` หรือ `company_id`, `period`, `total_revenue`, `total_cost`, `profit`, `margin_percent`
- หลักการ
  - คำนวณ batch เป็นช่วงเวลา (รายวัน/รายเดือน) แล้วเขียนเก็บในตารางเหล่านี้
  - ใช้ Snapshots เพื่อให้ Dashboard โหลดเร็วและรองรับ historical analysis

---

### 4. การออกแบบ RLS & Policy ด้านความปลอดภัยข้อมูล

#### 4.1 หลักการทั่วไป

- ทุกตารางที่มีข้อมูลอ่อนไหว ต้องเปิดใช้ RLS และเขียน Policy ตาม `role`, `branch_id`, `company_id`
- ใช้ JWT Claim / `auth` context ของ Supabase เช่น `auth.uid()` + join กับ `user_profiles`

#### 4.2 ตัวอย่าง Policy ตามประเภทข้อมูล

- **ตารางเงินเดือน (`employee_salary_history`)**
  - HR (สาขาเดียวกันหรือระดับบริษัท): อ่าน/เขียนตาม branch/company policy
  - Top Management: เห็นเฉพาะ Summary ผ่าน View หรือฟังก์ชัน ไม่ให้ query รายคนโดยตรง
  - อื่นๆ: ไม่มีสิทธิ์
- **ตารางต้นทุนจัดซื้อ (`purchasing_orders`, `purchasing_items`)**
  - Purchasing: อ่าน/เขียนในสาขาหรือ company ที่รับผิดชอบ
  - ผู้บริหาร: อ่านได้เฉพาะ View สรุป (aggregate) ที่ซ่อนข้อมูลอ่อนไหว เช่น ต่อ Supplier อาจ anonymize
- **ตาราง P&L (`pnl_trip`, `pnl_vehicle`, `pnl_fleet`)**
  - Branch Manager: เห็นเฉพาะ `branch_id` ของตัวเอง (ผ่าน join `vehicles`/`trips`)
  - Top Management: เห็นทุกสาขา
  - HR/Purchasing/Operation: เห็นส่วนที่เกี่ยวกับงานตนเอง ตาม matrix

#### 4.3 การสร้าง View สำหรับ Summary ที่ไม่เปิดเผยข้อมูลส่วนบุคคล

- สร้าง View เช่น `v_salary_summary_by_branch`, `v_purchasing_summary_by_supplier_group`
- Policy ให้ Top Management/Branch Manager อ่าน View เหล่านี้ได้ แต่ไม่อนุญาตให้ query ตารางดิบโดยตรง

---

### 5. Workflow การบันทึกและอนุมัติข้อมูล

#### 5.1 Trip & Operational Costs

- สเตตัสหลักของ Trip: `DRAFT` → `SUBMITTED` → `APPROVED`
  - Operation user
    - สร้าง/แก้ไข Trip และต้นทุนที่เกี่ยวข้องในสถานะ `DRAFT`
    - เมื่อกรอกเสร็จ → กด `ส่งอนุมัติ` → เปลี่ยนเป็น `SUBMITTED`
  - Branch Manager
    - ตรวจสอบความถูกต้อง → อนุมัติหรือส่งกลับแก้ไข
    - เมื่ออนุมัติ → เปลี่ยนเป็น `APPROVED` → Trip นี้ถูกนำไปรวมใน batch คำนวณ P&L

#### 5.2 Purchasing & HR

- การปรับเงินเดือน/ราคาซื้อ
  - HR/ Purchasing แก้ไขผ่านหน้าจอเฉพาะ
  - บันทึกเป็น history (ไม่ลบทับ) พร้อม reason + updated_by
- การมีผลต่อ P&L
  - ใช้ `effective_from`/`effective_to` เพื่อให้สูตรคำนวณ P&L เลือกค่าให้ถูกตามช่วงเวลา

#### 5.3 Recalculation Logic

- นิยามเงื่อนไขที่ต้อง Recalculate P&L เช่น
  - Trip ถูกอนุมัติใหม่/ยกเลิก
  - เงินเดือน/ราคาซื้อเปลี่ยนและกระทบช่วงเวลาที่เคยคำนวณแล้ว
- การทำงาน
  - ใช้ Job (เช่น Supabase cron/Edge Function หรือ background worker) เพื่อ
    - เก็บรายการที่ต้องคำนวณใหม่ใน queue
    - ประมวลผลเป็น batch เพื่อลดภาระบนระบบ

---

### 6. การออกแบบ Dashboard และ UI ตามระดับผู้ใช้

#### 6.1 Fleet Overview (สำหรับ Top Management)

- หน้า `FleetPnlOverviewView.tsx` (ใน `views/`)
  - KPI หลัก: Fleet Margin %, Total Profit, Total Revenue, Total Cost
  - Filter: ช่วงเวลา, บริษัท/กองรถ, ประเภทรถ, ลูกค้าใหญ่
  - กราฟ/ตาราง:
    - กราฟแนวโน้มกำไรต่อเดือน
    - Breakdown ตามสาขา / ประเภทรถ
  - Drill-down:
    - คลิกสาขา → ไปหน้า `BranchPnlView`

#### 6.2 Vehicle P&L (สำหรับ Branch Manager & Management)

- หน้า `VehiclePnlView.tsx`
  - Filter: สาขา, รถ, ช่วงเวลา
  - ตาราง: รายการรถแต่ละคัน + Revenue, Fixed, Variable, Idle, Profit
  - Detail panel: เลือกรถ → ดูสรุปรายเดือน/รายเที่ยว

#### 6.3 Trip P&L (สำหรับ Operation/Branch Manager)

- หน้า `TripPnlView.tsx`
  - Filter: วันที่, ลูกค้า, Route, สถานะ
  - แสดงราย Trip: รายได้, ต้นทุน, กำไร, Remark ผิดปกติ (เช่น cost สูงเกิน threshold)

#### 6.4 UX สำหรับสิทธิ์แตกต่างกัน

- ใช้ Hook เช่น `usePermissions()` อ่าน Role/Branch จาก context
- ฝั่ง UI
  - ซ่อนเมนู/ปุ่มที่ role ไม่มีสิทธิ์
  - ป้องกันระดับ API ด้วย RLS เสมอ (UI ซ่อนเป็นชั้นเสริม ไม่ใช่หลัก)

---

### 7. Data Quality & Alerting

#### 7.1 Business Rules ตรวจสอบข้อมูล

- ตัวอย่าง Rule
  - Trip ที่มี `distance_km = 0` แต่มีค่าน้ำมัน > X บาท → Flag ผิดปกติ
  - Idle Cost ของรถบางคันสูงเกินเกณฑ์ → แสดงบน Dashboard
  - ค่าใช้จ่ายต่อเที่ยว > Y% ของรายได้ → Mark as "to review"

#### 7.2 การแสดงผล Error/Alert

- ใน Trip P&L View / Vehicle P&L View
  - ใช้ Badge/สีเตือน + Tooltip อธิบายเหตุผลผิดปกติ
- อาจเพิ่มหน้า "Data Issues" รวมรายการที่ต้องตรวจสอบ

---

### 8. Audit Log และการตรวจสอบย้อนหลัง

#### 8.1 ออกแบบตาราง Audit Log

- ตาราง `audit_logs`
  - ฟิลด์: `id`, `user_id`, `action` (create/update/delete), `table_name`, `record_id`, `changed_data` (JSON), `created_at`
- เขียนผ่าน
  - Trigger บน Postgres หรือ
  - เขียนจาก backend layer (ถ้ามี) / Edge Function

#### 8.2 การใช้งาน

- HR/Purchasing/Management สามารถเปิดหน้าจอ "ประวัติการเปลี่ยนแปลง" สำหรับชุดข้อมูลสำคัญ
- ช่วยตรวจสอบกรณีมีข้อโต้แย้ง เช่น เงินเดือนเปลี่ยนผิด, ราคาซื้อเปลี่ยน

---

### 9. แผนการพัฒนาเชิงลำดับขั้น (Implementation Roadmap)

#### ระยะที่ 1: โครงสร้างสิทธิ์ + Data Model พื้นฐาน

- นิยาม Role และ Permission Matrix ให้ชัดเจน (อาจเก็บในไฟล์ config หรือ table)
- ตรวจสอบ/เพิ่มตารางหลักสำหรับ trips, vehicles, employees, purchasing, salary history
- เพิ่มฟิลด์ role/branch/company ให้ user profile ครบถ้วน
- เขียน RLS เบื้องต้น: ป้องกันการเข้าถึงข้อมูลข้ามสาขา/ข้ามบริษัท

#### ระยะที่ 2: Allocation Rules + P&L Calculation

- สร้างตาราง `cost_allocation_rules` และนิยามกติกาเริ่มต้น
- พัฒนา service / function สำหรับคำนวณ P&L (Trip/Vehicle/Fleet) จากข้อมูลดิบ
- ออกแบบและสร้างตาราง `pnl_trip`, `pnl_vehicle`, `pnl_fleet`
- ทำ batch job (Edge Function/cron) สำหรับ run calculation ตามช่วงเวลา

#### ระยะที่ 3: Dashboard & UI ตาม Role

- พัฒน Views สำหรับ Fleet, Vehicle, Trip P&L ตามที่ออกแบบ
- ใช้ Hook `usePermissions()` เพื่อตรวจสอบสิทธิ์ก่อนแสดงแต่ละส่วน
- ทดสอบการใช้งานในแต่ละ Role (HR, Purchasing, Operation, Branch Manager, Top Management)

#### ระยะที่ 4: Data Quality, Alerting, Audit Log

- เพิ่ม Business Rules สำหรับตรวจสอบข้อมูลผิดปกติ
- สร้างหน้า UI แสดง Alert และ Data Issues
- เพิ่ม Audit Log บนตารางสำคัญ และหน้าจอสำหรับตรวจสอบย้อนหลัง

#### ระยะที่ 5: ปรับแต่งและขยายความสามารถ

- เพิ่ม Budget vs Actual P&L
- เพิ่ม What-if Simulation (เช่น ปรับค่าเที่ยว, เพิ่ม/ลดจำนวนรถ)
- ปรับ UI/UX จาก Feedback ผู้ใช้จริง

---

### 10. การทบทวนแผน 3 รอบและการปรับปรุง

#### รอบที่ 1 – ตรวจสอบภาพรวมและความสอดคล้องกับเป้าหมาย

- ตรวจสอบว่า:
  - ครอบคลุม P&L 3 ระดับ (Trip/Vehicle/Fleet)
  - มีการแยกหน้าที่ตามแผนก (Purchasing/HR/Operation/Management) ตามโจทย์เดิม
  - มีแนวคิดปกป้องข้อมูลอ่อนไหว (เงินเดือน/ต้นทุนคู่ค้า)
- ผลการทบทวน:
  - แผนครอบคลุมทุกมิติที่คุณอธิบาย (Access Control + P&L) แต่ยังต้องเพิ่มมุม Data Quality และ Audit ให้ชัดเจน → จึงเพิ่มหัวข้อ 7, 8 และขยาย Policy/Workflow

#### รอบที่ 2 – ตรวจสอบรายละเอียดเชิงเทคนิคและความเป็นไปได้

- ตรวจสอบว่า:
  - โครง Data Model สามารถแม็ปเข้ากับ Supabase / Postgres ได้ตรงไปตรงมา
  - RLS/Policy ที่เสนอสามารถเขียนได้จริงใน Supabase
  - การเก็บ Snapshot P&L (trip/vehicle/fleet) ไม่ขัดกับ requirement เรื่อง historical analysis
- ผลการทบทวน:
  - ยืนยันว่าใช้ RLS + View + Snapshot Table เป็นแนวทางที่ Supabase รองรับดี
  - เพิ่มแนวคิด `effective_from/effective_to` ใน salary และการใช้ batch job สำหรับ Recalculation เพื่อลดปัญหาประสิทธิภาพ

#### รอบที่ 3 – ตรวจสอบมุมการใช้งานจริง (UX/Process)

- ตรวจสอบว่า:
  - ผู้ใช้แต่ละ Role มีหน้าจอและ Flow ทำงานที่ชัดเจน
  - มีสถานะงาน (Trip DRAFT/SUBMITTED/APPROVED) ครบวงจรตั้งแต่กรอก → อนุมัติ → เข้าระบบ P&L
  - ผู้บริหารสามารถดูตัวเลขสรุปโดยไม่ต้องเจาะถึงข้อมูลอ่อนไหว
- ผลการทบทวน:
  - เพิ่มขั้นตอน Workflow ของ Trip, HR, Purchasing ให้ชัด
  - ขยายรายละเอียด Dashboard ตาม Role และ Drill-down พร้อมการซ่อนข้อมูลตาม role

---

### 11. สรุปประเด็นการปรับปรุงจากการทบทวนแผน

- **เพิ่มมิติ Data Quality & Alerting** เพื่อให้ P&L "เชื่อถือได้" ไม่ใช่แค่คำนวณได้
- **ออกแบบ Audit Log & History** สำหรับข้อมูลอ่อนไหว (เงินเดือน/ราคาซื้อ) เพื่อลดความเสี่ยงข้อโต้แย้งและเพิ่มความโปร่งใส
- **กำหนด Workflow และสถานะข้อมูลให้ครบวงจร** (DRAFT → SUBMITTED → APPROVED) ทำให้รู้จุดตัดว่าข้อมูลไหนเข้า P&L แล้ว
- **ใช้ Snapshot Table สำหรับ P&L** เพื่อรองรับ Dashboard ที่เร็วและการดูข้อมูลย้อนหลัง พร้อมรองรับ Recalculation แบบควบคุมได้
- **ผูก Role & Permission Matrix กับการออกแบบ UI/UX จริง** ทำให้แต่ละ Role มีหน้าจอและข้อมูลที่สอดคล้องกับหน้าที่และระดับความลับ

### 12. แผนควบคุมสิทธิ์แบบละเอียด (Actionable Checklist)

#### 12.1 Role / Permission Model

- **ยืนยัน enum `app_role` ใน Supabase**
  - ตรวจใน Supabase ว่า `app_role` มีค่า: `user`, `inspector`, `manager`, `executive`, `admin`, `driver`, `sales`, `service_staff`, `hr`, `accounting`, `warehouse`
  - ยืนยันว่าตาราง `profiles` ใช้ฟิลด์ `role` (ชนิด `app_role`) เป็น source หลักของสิทธิ์ผู้ใช้
- **นิยาม Business Role (สำหรับ P&L) ฝั่งโค้ด**
  - สร้างไฟล์ `types/permissions.ts`
  - ประกาศ `type BusinessRole` ครอบคลุม:
    - `ROLE_PURCHASING_USER`
    - `ROLE_HR_USER`
    - `ROLE_OPERATION_USER`
    - `ROLE_BRANCH_MANAGER`
    - `ROLE_TOP_MANAGEMENT`
    - `ROLE_SYSTEM_ADMIN`
  - เพิ่ม `APP_ROLE_TO_BUSINESS_ROLE: Partial<Record<AppRole, BusinessRole>>` โดย map:
    - `accounting` → `ROLE_PURCHASING_USER`
    - `hr` → `ROLE_HR_USER`
    - `warehouse` → `ROLE_OPERATION_USER`
    - `manager` → `ROLE_BRANCH_MANAGER`
    - `executive` → `ROLE_TOP_MANAGEMENT`
    - `admin` → `ROLE_SYSTEM_ADMIN`

#### 12.2 Hook ควบคุมสิทธิ์ใน Frontend

- **สร้าง `usePermissions()**`
  - import `AppRole`, `BusinessRole`, `APP_ROLE_TO_BUSINESS_ROLE` จาก `types/permissions.ts`
  - ดึง `profile` จาก `useAuth` (หรือ hook โปรไฟล์ที่มีอยู่)
  - อ่าน `profile.role` เป็น `AppRole` (ถ้าไม่มีให้เป็น `undefined`)
  - แปลงเป็น `businessRole` ด้วย `APP_ROLE_TO_BUSINESS_ROLE[appRole] ?? null`
  - คืนค่าอย่างน้อย:
    - `businessRole: BusinessRole | null`
    - `canViewTripPnl: boolean`
    - `canViewVehiclePnl: boolean`
    - `canViewFleetPnl: boolean`
  - กำหนด logic สิทธิ์เบื้องต้น:
    - `ROLE_OPERATION_USER` → `canViewTripPnl = true`
    - `ROLE_BRANCH_MANAGER` → `canViewTripPnl` + `canViewVehiclePnl = true`
    - `ROLE_TOP_MANAGEMENT` → `canViewFleetPnl` + summary P&L ทั้งหมด = true
    - `ROLE_PURCHASING_USER` / `ROLE_HR_USER` → เห็นเฉพาะเมนู/หน้าที่เกี่ยวข้อง (เช่น cost summary)
    - `ROLE_SYSTEM_ADMIN` → เห็นหน้า config/monitoring แต่ไม่เห็น detail ส่วนบุคคลเกินจำเป็น

#### 12.3 การผูกกับเมนูและ Routing

- **ซ่อน/แสดงเมนูตามสิทธิ์**
  - ปรับ Sidebar/Navigation หลักให้:
    - แสดงเมนู `Trip P&L` เมื่อ `canViewTripPnl === true`
    - แสดงเมนู `Vehicle P&L` เมื่อ `canViewVehiclePnl === true`
    - แสดงเมนู `Fleet P&L` เมื่อ `canViewFleetPnl === true`
- **ป้องกันการเข้าถึงหน้าตรงๆ**
  - ใน `TripPnlView.tsx`:
    - เรียก `usePermissions()`
    - ถ้า `!canViewTripPnl` → แสดง component “ไม่มีสิทธิ์เข้าถึงหน้านี้”
  - ใน `VehiclePnlView.tsx`:
    - ถ้า `!canViewVehiclePnl` → แสดง “ไม่มีสิทธิ์เข้าถึงหน้านี้”
  - ใน `FleetPnlOverviewView.tsx`:
    - ถ้า `!canViewFleetPnl` → แสดง “ไม่มีสิทธิ์เข้าถึงหน้านี้”

#### 12.4 การผูกกับ RLS/Policy ใน Supabase

- **เปิดใช้ RLS บนตาราง P&L (ถ้ายังไม่ได้เปิด)**
  - `pnl_trip`
  - `pnl_vehicle`
  - `pnl_fleet`
- **เขียน Policy ตาม `app_role` + branch/company**
  - สำหรับ `manager` (Branch Manager):
    - Policy อ่าน `pnl_trip` เฉพาะ trip ที่ belong กับสาขาของ manager
    - Policy อ่าน `pnl_vehicle` เฉพาะรถในสาขาของ manager
  - สำหรับ `executive` (Top Management):
    - Policy อ่าน `pnl_fleet` ได้ทุก branch/company
  - สำหรับ `accounting` / `hr`:
    - ให้เห็นผ่าน view/summary เท่านั้น ไม่แตะตารางดิบที่มีข้อมูลบุคคลละเอียด
- **ทดสอบ RLS ด้วย user ตัวอย่าง**
  - สร้าง/ตั้งค่าโปรไฟล์ user ที่มี `app_role` แต่ละแบบ (manager, executive, accounting, hr, warehouse)
  - ใช้ Supabase SQL editor หรือ PostgREST ทดสอบ select ตาราง P&L
  - ยืนยันว่า user แต่ละ role เห็นเฉพาะข้อมูลตามที่ออกแบบ

#### 12.5 การทดสอบ End-to-End ตาม Role

- **เตรียมชุด user สำหรับทดสอบใน UI จริง**
  - User A: `app_role = manager`
  - User B: `app_role = executive`
  - User C: `app_role = accounting`
  - User D: `app_role = hr`
  - User E: `app_role = warehouse`
- **ทดสอบจากมุมมองผู้ใช้**
  - ล็อกอินด้วยแต่ละ user
  - ตรวจเมนูที่เห็นว่า:
    - Manager เห็น Trip/Vehicle P&L แต่ไม่เห็น Fleet P&L รวมทั้งบริษัท
    - Executive เห็น Fleet P&L + summary เหมาะสม
    - Accounting/HR เห็นเฉพาะเมนูที่เกี่ยวข้อง
  - เข้าหน้า P&L แต่ละแบบ:
    - ถ้าไม่มีสิทธิ์ → เห็นข้อความ “ไม่มีสิทธิ์เข้าถึงหน้านี้”
    - ถ้ามีสิทธิ์ → ข้อมูลจำกัดตาม branch/company ที่ควรเห็น
- **บันทึกผลและช่องโหว่**
  - จดเคสที่สิทธิ์หลวมเกินไป หรือเข้มเกินไป
  - ปรับ mapping `APP_ROLE_TO_BUSINESS_ROLE` หรือ Policy RLS ตามผลทดสอบ

