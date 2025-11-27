# 🚗 Vehicle Control Center - Development Roadmap

## 📌 Overview
แผนการพัฒนาระบบจัดการรถและการบำรุงรักษา เพื่อให้พนักงานขับรถสามารถบันทึกข้อมูลการใช้งานรถ การเติมน้ำมัน และแจ้งซ่อมได้อย่างสะดวก

---

## 🎯 Phase 1: Dashboard Redesign (ปรับปรุงหน้า Dashboard)

### Objectives
- ลบส่วนแผนที่ที่ไม่ได้ใช้งาน
- เพิ่มข้อมูลสรุปที่เป็นประโยชน์และเข้าใจง่าย
- แสดงสถานะรถแบบ Real-time

### Tasks
- [ ] **ลบส่วน Map Widget**
  - ลบ `MapWidget.tsx`
  - ลบ dependencies ที่เกี่ยวข้อง (maplibre-gl)
  - อัปเดต Dashboard layout

- [ ] **สร้างส่วนสรุปภาพรวม (Summary Cards)**
  - จำนวนรถทั้งหมด / รถพร้อมใช้งาน
  - รถที่กำลังซ่อม
  - ตั๋วรอดำเนินการ
  - ค่าใช้จ่ายเดือนนี้

- [ ] **สร้างส่วนสถานะรถ (Vehicle Status Section)**
  - แสดงรายการรถพร้อมสถานะ (🟢 พร้อมใช้ / 🔴 ซ่อม / 🟡 ใช้งานอยู่)
  - เลขไมล์ล่าสุด
  - วันที่ซ่อมครั้งสุดท้าย
  - อัตราการใช้น้ำมันเฉลี่ย

- [ ] **สร้างส่วนกราฟและสถิติ (Charts & Analytics)**
  - กราฟการใช้น้ำมันรายเดือน
  - กราฟค่าซ่อมบำรุงรายเดือน
  - Top 5 รถที่กินน้ำมันมากสุด
  - Top 5 รถที่ค่าซ่อมสูงสุด

- [ ] **สร้างส่วน Activity Feed**
  - รถที่ Check-out ล่าสุด (ยังไม่กลับ)
  - การเติมน้ำมันล่าสุด
  - ตั๋วซ่อมที่สร้างวันนี้
  - การซ่อมที่เสร็จวันนี้

**Estimated Time:** 3-4 days  
**Priority:** High  
**Dependencies:** None

---

## 🎯 Phase 2: Trip Log System (ระบบบันทึกเลขไมล์)

### Objectives
- ให้พนักงานขับรถบันทึกเลขไมล์ก่อนออกและหลังกลับ
- คำนวณระยะทางและเวลาที่ใช้อัตโนมัติ
- ตรวจสอบความถูกต้องของข้อมูล

### Database Schema

#### Table: `trip_logs`
```sql
CREATE TABLE trip_logs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  vehicle_id uuid REFERENCES vehicles(id) NOT NULL,
  driver_id uuid REFERENCES profiles(id) NOT NULL,
  
  -- Check-out data
  odometer_start integer NOT NULL,
  checkout_time timestamptz NOT NULL DEFAULT now(),
  
  -- Check-in data
  odometer_end integer,
  checkin_time timestamptz,
  
  -- Calculated fields
  distance_km integer GENERATED ALWAYS AS (odometer_end - odometer_start) STORED,
  duration_hours decimal,
  
  -- Optional fields
  destination text,
  route text,
  notes text,
  
  -- Status
  status text NOT NULL DEFAULT 'checked_out' CHECK (status IN ('checked_out', 'checked_in')),
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX idx_trip_logs_vehicle ON trip_logs(vehicle_id);
CREATE INDEX idx_trip_logs_driver ON trip_logs(driver_id);
CREATE INDEX idx_trip_logs_status ON trip_logs(status);
CREATE INDEX idx_trip_logs_checkout_time ON trip_logs(checkout_time DESC);

-- RLS Policies
ALTER TABLE trip_logs ENABLE ROW LEVEL SECURITY;

-- Drivers can view and create their own trips
CREATE POLICY "Drivers can view own trips" ON trip_logs
  FOR SELECT USING (driver_id = auth.uid());

CREATE POLICY "Drivers can create trips" ON trip_logs
  FOR INSERT WITH CHECK (driver_id = auth.uid());

CREATE POLICY "Drivers can update own trips" ON trip_logs
  FOR UPDATE USING (driver_id = auth.uid());

-- Managers and above can view all trips
CREATE POLICY "Managers can view all trips" ON trip_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('manager', 'executive', 'admin')
    )
  );
```

### Tasks

#### 2.1 Database Setup
- [ ] สร้าง migration file สำหรับ `trip_logs` table
- [ ] เพิ่ม RLS policies
- [ ] สร้าง indexes
- [ ] ทดสอบ policies

#### 2.2 Backend Services
- [ ] สร้าง `tripLogService.ts`
  - `createCheckout()` - บันทึกเลขไมล์ออก
  - `updateCheckin()` - บันทึกเลขไมล์กลับ
  - `getActiveTripsByVehicle()` - ดูรถที่ออกไปแล้วยังไม่กลับ
  - `getTripHistory()` - ดูประวัติการเดินทาง
  - `validateOdometer()` - ตรวจสอบเลขไมล์

- [ ] สร้าง custom hooks
  - `useTripLogs()` - ดึงข้อมูล trip logs
  - `useActiveTrips()` - ดูรถที่กำลังใช้งาน
  - `useVehicleStatus()` - ตรวจสอบสถานะรถ

#### 2.3 UI Components
- [ ] สร้าง `TripLogFormView.tsx`
  - ฟอร์ม Check-out (บันทึกเลขไมล์ออก)
  - ฟอร์ม Check-in (บันทึกเลขไมล์กลับ)
  - Validation เลขไมล์
  - แสดง trip ที่ active

- [ ] สร้าง `TripLogListView.tsx`
  - แสดงประวัติการเดินทาง
  - Filter by vehicle, driver, date
  - Export to Excel

- [ ] สร้าง `ActiveTripsWidget.tsx`
  - แสดงรถที่ออกไปแล้วยังไม่กลับ
  - เตือนถ้าออกนานเกิน 12 ชม.

#### 2.4 Validation & Alerts
- [ ] ตรวจสอบเลขไมล์กลับ > เลขไมล์ออก
- [ ] ตรวจสอบระยะทางไม่เกิน 500 km ต่อครั้ง
- [ ] เตือนถ้ารถ Check-out เกิน 12 ชั่วโมง
- [ ] ป้องกัน Check-out ซ้ำ (รถต้อง Check-in ก่อน)

**Estimated Time:** 4-5 days  
**Priority:** High  
**Dependencies:** Phase 1 (optional)

---

## 🎯 Phase 3: Fuel Log System (ระบบบันทึกการเติมน้ำมัน)

### Objectives
- บันทึกการเติมน้ำมันแต่ละครั้ง
- คำนวณอัตราการใช้น้ำมัน (km/L)
- ติดตามค่าใช้จ่ายน้ำมัน

### Database Schema

#### Table: `fuel_logs`
```sql
CREATE TABLE fuel_logs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  vehicle_id uuid REFERENCES vehicles(id) NOT NULL,
  filled_by uuid REFERENCES profiles(id) NOT NULL,
  
  -- Fuel data
  odometer integer NOT NULL,
  fuel_amount decimal(10,2) NOT NULL, -- ลิตร
  fuel_price decimal(10,2) NOT NULL, -- บาท
  fuel_type text NOT NULL CHECK (fuel_type IN ('gasoline_91', 'gasoline_95', 'gasohol_91', 'gasohol_95', 'diesel', 'e20', 'e85')),
  
  -- Calculated fields
  price_per_liter decimal(10,2) GENERATED ALWAYS AS (fuel_price / fuel_amount) STORED,
  fuel_efficiency decimal(10,2), -- km/L (calculated from previous fill)
  
  -- Optional fields
  gas_station text,
  receipt_image_url text,
  notes text,
  
  filled_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX idx_fuel_logs_vehicle ON fuel_logs(vehicle_id);
CREATE INDEX idx_fuel_logs_filled_by ON fuel_logs(filled_by);
CREATE INDEX idx_fuel_logs_filled_at ON fuel_logs(filled_at DESC);

-- RLS Policies
ALTER TABLE fuel_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Drivers can view own fuel logs" ON fuel_logs
  FOR SELECT USING (filled_by = auth.uid());

CREATE POLICY "Drivers can create fuel logs" ON fuel_logs
  FOR INSERT WITH CHECK (filled_by = auth.uid());

CREATE POLICY "Managers can view all fuel logs" ON fuel_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('manager', 'executive', 'admin')
    )
  );
```

### Tasks

#### 3.1 Database Setup
- [x] สร้าง migration file สำหรับ `fuel_logs` table (มีอยู่แล้ว: `fuel_records`)
- [x] เพิ่ม RLS policies (มีอยู่แล้ว)
- [x] สร้าง indexes (มีอยู่แล้ว)
- [x] สร้าง function คำนวณ fuel efficiency (มีอยู่แล้วใน trigger)

#### 3.2 Backend Services
- [x] สร้าง `fuelLogService.ts` (มีอยู่แล้ว)
  - [x] `create()` - บันทึกการเติมน้ำมัน
  - [x] `getFuelHistory()` - ดูประวัติการเติม (เพิ่มแล้ว)
  - [x] `getFuelStats()` - สถิติการใช้น้ำมัน (เพิ่มแล้ว)
  - [x] `uploadReceipt()` - อัปโหลดรูปใบเสร็จ (เพิ่มแล้ว)
  - [x] `calculateFuelEfficiency()` - คำนวณ km/L (มีใน database trigger)

- [x] สร้าง custom hooks
  - [x] `useFuelLogs()` - ดึงข้อมูลการเติมน้ำมัน
  - [x] `useFuelStats()` - สถิติน้ำมัน

#### 3.3 UI Components
- [x] สร้าง `FuelLogFormView.tsx`
  - [x] ฟอร์มบันทึกการเติมน้ำมัน
  - [x] เลือกรถ
  - [x] กรอกเลขไมล์, ลิตร, ราคา
  - [x] เลือกประเภทน้ำมัน
  - [x] อัปโหลดรูปใบเสร็จ
  - [x] แสดงอัตราการใช้น้ำมันที่คำนวณได้ (แสดงใน list view)

- [x] สร้าง `FuelLogListView.tsx`
  - [x] แสดงประวัติการเติมน้ำมัน
  - [x] Filter by vehicle, date range, fuel type
  - [x] แสดงสถิติรวม
  - [x] Pagination

- [x] สร้าง `FuelEfficiencyChart.tsx`
  - [x] กราฟแสดง km/L ตามเวลา (ใช้ Chart.js)

#### 3.4 Analytics & Alerts
- [x] คำนวณอัตราการใช้น้ำมันเฉลี่ย (ใน useFuelStats)
- [x] เตือนเมื่อ fuel efficiency ต่ำกว่าปกติ 20% (เพิ่ม `getEfficiencyAlerts()` และ `useFuelEfficiencyAlerts()`)
- [x] รายงานค่าใช้จ่ายน้ำมันรายเดือน (เพิ่ม `getMonthlyFuelCosts()` และ `useMonthlyFuelCosts()`)
- [x] เปรียบเทียบประสิทธิภาพรถ (เพิ่ม `getVehicleEfficiencyComparison()` และ `useVehicleEfficiencyComparison()`)

**Estimated Time:** 4-5 days  
**Priority:** High  
**Dependencies:** Phase 2 (optional, แต่ควรมี trip logs เพื่อคำนวณ km/L ได้แม่นยำ)

---

## 🎯 Phase 4: Driver Role & Navigation (ปรับปรุงสิทธิ์และเมนู)

### Objectives
- จำกัดเมนูสำหรับพนักงานขับรถ
- ทำให้ UI ง่ายและใช้งานสะดวก
- ป้องกันการเข้าถึงข้อมูลที่ไม่จำเป็น

### Tasks

#### 4.1 Navigation Updates
- [ ] อัปเดต `index.tsx` (main navigation)
  - เพิ่มเมนู "บันทึกเลขไมล์"
  - เพิ่มเมนู "บันทึกน้ำมัน"
  - ซ่อนเมนูที่ไม่เกี่ยวข้องสำหรับ Driver role

- [ ] สร้าง `DriverDashboard.tsx` (simplified dashboard)
  - แสดงเฉพาะข้อมูลที่เกี่ยวข้อง
  - Quick actions: แจ้งซ่อม, บันทึกไมล์, บันทึกน้ำมัน
  - รถที่ตัวเองกำลังใช้

#### 4.2 Role-based Access Control
- [ ] อัปเดต `useAuth.ts`
  - เพิ่ม `isDriver` helper
  - ตรวจสอบสิทธิ์ก่อนแสดงเมนู

- [ ] อัปเดต routing
  - Redirect driver ไปหน้าที่เหมาะสม
  - ป้องกันการเข้าถึง admin pages

#### 4.3 Mobile Optimization
- [ ] ปรับ UI ให้เหมาะกับมือถือ
- [ ] ทดสอบบนมือถือ Android/iOS
- [ ] ปรับขนาดปุ่มให้กดง่าย

**Estimated Time:** 2-3 days  
**Priority:** Medium  
**Dependencies:** Phase 2, Phase 3

---

## 🎯 Phase 5: Reports & Analytics (รายงานและการวิเคราะห์)

### Objectives
- สร้างรายงานที่เป็นประโยชน์
- วิเคราะห์ข้อมูลเพื่อหาจุดปรับปรุง
- Export ข้อมูลเป็น Excel/PDF

### Tasks

#### 5.1 Fuel Reports
- [ ] รายงานการใช้น้ำมันรายเดือน
- [ ] เปรียบเทียบค่าใช้จ่ายน้ำมันแต่ละรถ
- [ ] กราฟแสดง trend การใช้น้ำมัน
- [ ] Export to Excel

#### 5.2 Trip Reports
- [ ] รายงานระยะทางรายเดือน
- [ ] สรุปการใช้รถแต่ละคัน
- [ ] รายงานพนักงานขับรถ
- [ ] Export to Excel

#### 5.3 Maintenance Reports
- [ ] รายงานค่าซ่อมบำรุงรายเดือน
- [ ] เปรียบเทียบค่าซ่อมแต่ละรถ
- [ ] ประวัติการซ่อมแต่ละรถ
- [ ] Export to Excel

#### 5.4 Cost Analysis
- [ ] สรุปค่าใช้จ่ายรวม (น้ำมัน + ซ่อม)
- [ ] ค่าใช้จ่ายต่อ km
- [ ] ROI analysis
- [ ] Budget tracking

**Estimated Time:** 5-6 days  
**Priority:** Medium  
**Dependencies:** Phase 2, Phase 3

---

## 🎯 Phase 6: Advanced Features (ฟีเจอร์ขั้นสูง)

### Optional Features (ทำหลังจากระบบหลักเสร็จ)

- [ ] **GPS Integration**
  - บันทึกตำแหน่งเมื่อ Check-out/Check-in
  - แสดงเส้นทางบนแผนที่

- [ ] **Notifications**
  - แจ้งเตือนผ่าน LINE/Email
  - แจ้งเตือนเมื่อถึงกำหนดซ่อมบำรุง
  - แจ้งเตือนเมื่อรถ Check-out นาน

- [ ] **QR Code Check-in/out**
  - สแกน QR บนรถเพื่อ Check-out/in
  - รวดเร็วและป้องกันผิดพลาด

- [ ] **Voice Input**
  - บันทึกเลขไมล์ด้วยเสียง
  - สะดวกขณะขับรถ

- [ ] **Predictive Maintenance**
  - ทำนายเมื่อต้องซ่อมบำรุง
  - วิเคราะห์ pattern การเสีย

**Estimated Time:** TBD  
**Priority:** Low  
**Dependencies:** All previous phases

---

## 📊 Progress Tracking

### Overall Progress: 0% Complete

| Phase | Status | Progress | Start Date | End Date |
|-------|--------|----------|------------|----------|
| Phase 1: Dashboard | 🔴 Not Started | 0% | - | - |
| Phase 2: Trip Logs | 🔴 Not Started | 0% | - | - |
| Phase 3: Fuel Logs | 🟢 Completed | 100% | 2025-12-08 | 2025-12-09 |
| Phase 4: Driver Role | 🔴 Not Started | 0% | - | - |
| Phase 5: Reports | 🔴 Not Started | 0% | - | - |
| Phase 6: Advanced | 🔴 Not Started | 0% | - | - |

### Legend
- 🔴 Not Started
- 🟡 In Progress
- 🟢 Completed
- ⏸️ On Hold
- ❌ Cancelled

---

## 🎯 Next Steps

1. **รอการยืนยันแผน** - รอ user approve roadmap
2. **เริ่ม Phase 1** - ปรับปรุง Dashboard
3. **Database Design Review** - ตรวจสอบ schema ก่อนสร้าง
4. **UI/UX Mockups** - ออกแบบหน้าจอก่อนเขียนโค้ด

---

## 📝 Notes & Decisions

### Design Decisions
- ใช้ `timestamptz` สำหรับเวลาทั้งหมด (รองรับ timezone)
- ใช้ `uuid` สำหรับ primary keys
- ใช้ RLS policies เพื่อความปลอดภัย
- ใช้ GENERATED columns สำหรับการคำนวณ

### Technical Stack
- Frontend: React + TypeScript
- Backend: Supabase (PostgreSQL + Auth + Storage)
- Charts: Recharts / Chart.js
- Export: xlsx / jsPDF

### Future Considerations
- Mobile app (React Native)
- Offline support
- Multi-language support
- Integration with accounting system

---

**Last Updated:** 2025-11-24  
**Document Owner:** Development Team  
**Status:** Draft - Pending Approval
