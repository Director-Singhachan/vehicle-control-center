## RBAC Feature Spec – Vehicle Control Center

เอกสารนี้สรุปสเปกฟีเจอร์ RBAC (Role-Based Access Control) ให้สอดคล้องกับโครงสร้างระบบปัจจุบันของ Vehicle Control Center (React + Supabase) และแผน P&L / Dashboard ที่ออกแบบไว้ใน `vehicle-pnl-access-control-and-dashboard_*.plan.md`

---

### 1. เป้าหมาย (Goals)

- **ควบคุมสิทธิ์การเข้าถึงตามบทบาท (Role)** ให้สอดคล้องกับการใช้งานจริงของแต่ละแผนก
- **แยกขอบเขตข้อมูลอ่อนไหว** เช่น เงินเดือน, ราคาต้นทุนคู่ค้า, P&L รายคัน/รายเที่ยว
- **ผูก Frontend + Backend** ให้ไปในทิศทางเดียวกัน:
  - Frontend: ใช้ `usePermissions()` ตัดสินใจการแสดงเมนู/หน้า/ส่วนของ UI
  - Backend: ใช้ `app_role` + RLS ใน Supabase ควบคุมข้อมูลที่ query ได้จริง
- รองรับการขยายในอนาคต (เพิ่ม Role ใหม่, เพิ่มหน้ารายงานใหม่) โดยไม่ต้องแก้โค้ดจำนวนมาก

---

### 2. แหล่งความจริงของ Role

- **ฐานข้อมูล**: Supabase
  - ตาราง `profiles` (หรือเทียบเท่า) มีคอลัมน์ `role` ชนิด `app_role`
  - enum `app_role` (ตัวอย่างค่าที่ใช้งาน):
    - `user`
    - `inspector`
    - `manager`
    - `executive`
    - `admin`
    - `driver`
    - `sales`
    - `service_staff`
    - `hr`
    - `accounting`
    - `warehouse`
- **Frontend**:
  - ใช้ `useAuth()` เพื่อดึง `profile.role` (ชนิด `AppRole`)
  - ใช้ mapping ใน `types/permissions.ts` เพื่อแปลง `AppRole` → `BusinessRole`

---

### 3. Business Roles และ Permission Model

#### 3.1 BusinessRole (ในโค้ด)

ประกาศใน `types/permissions.ts`:

```ts
export type BusinessRole =
  | 'ROLE_PURCHASING_USER'
  | 'ROLE_HR_USER'
  | 'ROLE_OPERATION_USER'
  | 'ROLE_BRANCH_MANAGER'
  | 'ROLE_TOP_MANAGEMENT'
  | 'ROLE_SYSTEM_ADMIN';
```

#### 3.2 Mapping AppRole → BusinessRole

ประกาศใน `types/permissions.ts`:

```ts
export const APP_ROLE_TO_BUSINESS_ROLE: Partial<Record<AppRole, BusinessRole>> = {
  accounting: 'ROLE_PURCHASING_USER',
  hr: 'ROLE_HR_USER',
  warehouse: 'ROLE_OPERATION_USER',
  manager: 'ROLE_BRANCH_MANAGER',
  executive: 'ROLE_TOP_MANAGEMENT',
  admin: 'ROLE_SYSTEM_ADMIN',
};
```

> หมายเหตุ: ถ้าต้องการเพิ่ม Role ใหม่ ให้เพิ่มที่ enum `app_role` ก่อน จากนั้นค่อยมาเพิ่ม mapping ใน object นี้

#### 3.3 Permission Flags หลัก (P&L)

ใน Hook `usePermissions()` นิยามสิทธิ์หลัก 3 ตัว:

- `canViewTripPnl: boolean`
- `canViewVehiclePnl: boolean`
- `canViewFleetPnl: boolean`

Logic ปัจจุบัน (สรุป):

- `ROLE_OPERATION_USER`
  - `canViewTripPnl = true`
  - `canViewVehiclePnl = false`
  - `canViewFleetPnl = false`
- `ROLE_BRANCH_MANAGER`
  - `canViewTripPnl = true`
  - `canViewVehiclePnl = true`
  - `canViewFleetPnl = false`
- `ROLE_TOP_MANAGEMENT`
  - `canViewTripPnl = false`
  - `canViewVehiclePnl = false`
  - `canViewFleetPnl = true`
- `ROLE_PURCHASING_USER`, `ROLE_HR_USER`
  - ทั้งสาม flag เป็น `false` (เน้นหน้าจออื่น เช่น cost/HR แทน)
- `ROLE_SYSTEM_ADMIN`
  - ทั้งสาม flag เป็น `true` (เพื่อ debug/monitor ระบบ แต่ยังต้องใช้ RLS ป้องกันข้อมูลละเอียดใน DB)

---

### 4. การใช้งานบน Frontend

#### 4.1 Hook `usePermissions()`

- ที่มา: `hooks/usePermissions.ts`
- ทำหน้าที่:
  - อ่าน `appRole` จาก `useAuth().profile.role`
  - แปลงเป็น `businessRole` ด้วย `APP_ROLE_TO_BUSINESS_ROLE`
  - คืนค่าทั้ง `appRole`, `businessRole` และ flag ต่างๆ (`canViewTripPnl`, `canViewVehiclePnl`, `canViewFleetPnl`)

#### 4.2 การซ่อน/แสดงเมนู (Sidebar / Navigation)

หลักการ:

- เมนู `Trip P&L` แสดงเมื่อ `canViewTripPnl === true`
- เมนู `Vehicle P&L` แสดงเมื่อ `canViewVehiclePnl === true`
- เมนู `Fleet P&L` แสดงเมื่อ `canViewFleetPnl === true`

การเปลี่ยนแปลง/ขยาย:

- ถ้าจะเพิ่มเมนูรายงานใหม่ (เช่น `Driver P&L`) ให้:
  - เพิ่ม flag ใหม่ใน `UsePermissionsResult` (เช่น `canViewDriverPnl`)
  - เพิ่ม logic ใน switch ของ `usePermissions()`
  - นำ flag ไปผูกกับ `Sidebar` เพื่อซ่อน/แสดงเมนู

#### 4.3 การป้องกันการเข้าถึงหน้ารายงานโดยตรง (Route Guards)

ตัวอย่างที่ใช้อยู่แล้ว:

- `TripPnlReport`:
  - เรียก `const { canViewTripPnl } = usePermissions();`
  - ถ้า `!canViewTripPnl` → แสดง Card ข้อความ “ไม่มีสิทธิ์เข้าถึงหน้านี้”
- `FleetPnlReport`:
  - เรียก `const { canViewFleetPnl } = usePermissions();`
  - ถ้า `!canViewFleetPnl` → แสดงข้อความ “ไม่มีสิทธิ์เข้าถึงหน้านี้”

หลักการเดียวกันนี้ควรถูกใช้กับ:

- หน้า Vehicle P&L (ถ้ามี View แยก)
- หน้า Dashboard เพิ่มเติมที่เปิดเฉพาะบาง Role

---

### 5. การผูกกับ RLS/Policy ใน Supabase (Backend)

> หมายเหตุ: ส่วนนี้เป็นแนวทางเชิงสเปก ต้องไป implement ต่อใน `supabase/sql` หรือ `supabase/migrations/` ตามมาตรฐานโปรเจกต์

#### 5.1 ตารางสำคัญที่ควบคุมด้วย RLS

- `pnl_trip`
- `pnl_vehicle`
- `pnl_fleet`
- ตารางดิบที่มีข้อมูลอ่อนไหว เช่น:
  - `employee_salary_history`
  - `purchasing_orders`, `purchasing_items`

#### 5.2 หลักการ RLS ตาม Role

- `manager` (Branch Manager)
  - อ่าน `pnl_trip` ได้เฉพาะ trip ที่อยู่ใน `branch_id` ของตัวเอง
  - อ่าน `pnl_vehicle` ได้เฉพาะรถที่ `branch_id` ของตัวเอง
- `executive` (Top Management)
  - อ่าน `pnl_fleet` ได้ทุกสาขา/ทุกบริษัท
- `accounting` / `hr`
  - เห็นเฉพาะ **View summary** ที่ไม่เปิดเผยข้อมูลรายบุคคล เช่น salary summary ต่อ branch, cost summary ต่อ supplier group
  - ไม่ให้ query ตารางดิบโดยตรง
- `warehouse` (Operation)
  - อ่านข้อมูลที่จำเป็นต่อการทำ P&L ต่อเที่ยว/รถ เฉพาะสาขาตัวเอง

#### 5.3 การทดสอบ RLS

- สร้าง user ตัวอย่างใน Supabase ให้ครบทุก `app_role` ที่ใช้
- ใช้ SQL Editor / PostgREST / Supabase UI ทดสอบคำสั่ง select:
  - ยืนยันว่า:
    - manager ไม่เห็นข้อมูล branch อื่น
    - executive เห็นทุก branch (เฉพาะ summary ตามตารางที่อนุญาต)
    - accounting/hr ไม่สามารถอ่านตารางดิบ P&L ได้โดยตรง

---

### 6. Test Plan – End-to-End ตาม Role

การทดสอบอ้างอิงจากข้อ 12.5 ในแผน P&L:

#### 6.1 เตรียมชุด User (ตัวอย่าง)

- User A: `app_role = manager`
- User B: `app_role = executive`
- User C: `app_role = accounting`
- User D: `app_role = hr`
- User E: `app_role = warehouse`

กำหนด `branch_id` ให้เหมาะสม เช่น:

- A และ E อยู่ branch เดียวกัน
- B มองได้ทุก branch (ตาม RLS)

#### 6.2 ขั้นตอนทดสอบบน UI

สำหรับแต่ละ user:

1. ล็อกอินเข้าแอป
2. ตรวจสอบเมนูที่ปรากฏ:
   - manager: เห็น Trip/Vehicle P&L แต่ไม่เห็น Fleet P&L
   - executive: เห็น Fleet P&L (ภาพรวมบริษัท)
   - accounting/hr: ไม่เห็นเมนู P&L ลึกๆ
   - warehouse: เห็น Trip P&L ตามการออกแบบ operation
3. คลิกเข้าแต่ละหน้ารายงานที่เกี่ยวข้อง:
   - ถ้าไม่มีสิทธิ์ → ต้องเห็น “ไม่มีสิทธิ์เข้าถึงหน้านี้”
   - ถ้ามีสิทธิ์ → ต้องเห็นข้อมูล P&L ตาม branch/company ที่ควรเห็นเท่านั้น

#### 6.3 บันทึกผลและปรับปรุง

- จดรายการที่:
  - เมนูแสดง/ไม่แสดงไม่ตรงกับ role
  - หน้าไม่บล็อกตามที่ควร
  - ข้อมูลที่เห็นขัดกับ RLS หรือ business rule
- ปรับ:
  - Mapping ใน `APP_ROLE_TO_BUSINESS_ROLE`
  - Logic ใน `usePermissions()`
  - เงื่อนไขซ่อนเมนูใน Sidebar
  - Policy RLS ใน Supabase

---

### 7. แนวทางขยายในอนาคต

- เพิ่ม flag อื่นๆ ใน `usePermissions()` เช่น:
  - `canViewSalarySummary`
  - `canViewPurchasingDetail`
  - `canManagePnlConfig`
- สร้าง type สำหรับ Permission ที่ละเอียดขึ้น ถ้าเริ่มมีหน้ารายงาน/โมดูลมาก:
  - เช่น `FeaturePermission` หรือ `ResourcePermission`
- เพิ่มชุด automated test:
  - Unit test สำหรับ `usePermissions()` (ตรวจ logic จาก mapping)
  - Integration/E2E test (Playwright/Cypress) จำลอง Login ด้วยแต่ละ Role และตรวจเมนู/หน้า

เอกสารนี้ควรอัปเดตทุกครั้งที่:

- เพิ่ม/ลบ/เปลี่ยนค่าใน enum `app_role`
- ปรับ mapping AppRole → BusinessRole
- เพิ่มหน้า Dashboard/Report ใหม่ที่ผูกกับ RBAC

