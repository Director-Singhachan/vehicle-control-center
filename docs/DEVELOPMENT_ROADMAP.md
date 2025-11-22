# แผนการพัฒนา Vehicle Control Center

## 📊 สรุปโครงสร้าง Database จาก SQL Files

### 1. Core Tables (Initial Schema)
- **profiles** - ข้อมูลผู้ใช้ (เชื่อมกับ auth.users)
- **vehicles** - ข้อมูลยานพาหนะ
- **tickets** - ตั๋วแจ้งซ่อม
- **ticket_approvals** - การอนุมัติตั๋ว
- **ticket_costs** - ค่าใช้จ่ายการซ่อม

### 2. Vehicle Management Tables
- **vehicle_usage** - บันทึกการใช้งานรถ
- **fuel_records** - บันทึกการเติมน้ำมัน
- **maintenance_schedules** - ตารางบำรุงรักษา
- **maintenance_history** - ประวัติการบำรุงรักษา
- **vehicle_alerts** - การแจ้งเตือน

### 3. System Tables
- **audit_logs** - Audit trail สำหรับ tickets และ approvals

### 4. Views & Functions
- **vehicle_dashboard** - View สรุปข้อมูลรถแต่ละคัน
- **fuel_efficiency_summary** - สรุปอัตราสิ้นเปลือง
- **vehicle_usage_summary** - สรุปการใช้งาน
- **check_maintenance_alerts()** - Function ตรวจสอบแจ้งเตือน PM

---

## 🎯 แผนการพัฒนาต่อไป (Roadmap)

### Phase 1: Setup & Integration (Priority: High) ⚡

#### 1.1 ติดตั้ง Supabase Client
```bash
npm install @supabase/supabase-js
```

#### 1.2 สร้าง Supabase Client Configuration
- สร้างไฟล์ `lib/supabase.ts` สำหรับ client configuration
- สร้างไฟล์ `.env.local` สำหรับเก็บ Supabase credentials

#### 1.3 สร้าง Type Definitions
- สร้างไฟล์ `types/database.ts` จาก database schema
- ใช้ Supabase CLI: `supabase gen types typescript --local > types/database.ts`

### Phase 2: API Services Layer (Priority: High) ⚡

#### 2.1 สร้าง API Services แทน Mock Data
- **`services/vehicleService.ts`** - CRUD operations สำหรับ vehicles
- **`services/ticketService.ts`** - CRUD operations สำหรับ tickets
- **`services/usageService.ts`** - CRUD operations สำหรับ vehicle_usage
- **`services/fuelService.ts`** - CRUD operations สำหรับ fuel_records
- **`services/maintenanceService.ts`** - CRUD operations สำหรับ maintenance
- **`services/alertService.ts`** - Operations สำหรับ vehicle_alerts

#### 2.2 สร้าง Custom Hooks
- **`hooks/useVehicles.ts`** - Hook สำหรับดึงข้อมูล vehicles
- **`hooks/useTickets.ts`** - Hook สำหรับดึงข้อมูล tickets
- **`hooks/useDashboard.ts`** - Hook สำหรับ dashboard data
- **`hooks/useAuth.ts`** - Hook สำหรับ authentication

### Phase 3: Authentication & Authorization (Priority: High) ⚡

#### 3.1 สร้าง Auth Components
- Login page
- User profile management
- Role-based access control (RBAC)

#### 3.2 Implement Row Level Security (RLS)
- ตรวจสอบว่า RLS policies ทำงานถูกต้อง
- ทดสอบ permissions ตาม roles

### Phase 4: Core Features (Priority: Medium) 📋

#### 4.1 Dashboard Enhancement
- [ ] เชื่อมต่อกับ `vehicle_dashboard` view
- [ ] แสดงข้อมูล real-time จาก database
- [ ] เพิ่ม filters และ date range picker
- [ ] Export reports

#### 4.2 Vehicle Management
- [ ] Vehicle list page
- [ ] Vehicle detail page
- [ ] Add/Edit vehicle form
- [ ] Vehicle status tracking

#### 4.3 Ticket Management
- [ ] Ticket list page with filters
- [ ] Create ticket form
- [ ] Ticket detail page
- [ ] Approval workflow UI
- [ ] Ticket status tracking

#### 4.4 Vehicle Usage Tracking
- [ ] Start/End trip form
- [ ] Usage history page
- [ ] Usage statistics

#### 4.5 Fuel Management
- [ ] Add fuel record form
- [ ] Fuel history page
- [ ] Fuel efficiency charts

#### 4.6 Maintenance Management
- [ ] Maintenance schedule page
- [ ] Add maintenance history
- [ ] Maintenance alerts dashboard
- [ ] PM (Preventive Maintenance) calendar

### Phase 5: Advanced Features (Priority: Low) 🔮

#### 5.1 Analytics & Reports
- [ ] Financial reports
- [ ] Usage analytics
- [ ] Maintenance cost analysis
- [ ] Fuel efficiency trends

#### 5.2 Notifications
- [ ] Real-time alerts
- [ ] Email notifications
- [ ] Push notifications (optional)

#### 5.3 Mobile Optimization
- [ ] Responsive design improvements
- [ ] Mobile-friendly forms
- [ ] Touch-optimized UI

---

## 🛠️ ขั้นตอนการเริ่มต้น (Next Steps)

### Step 1: Setup Supabase
1. สร้าง Supabase project (ถ้ายังไม่มี)
   - ดูคำแนะนำการตั้งชื่อโปรเจกต์: [`docs/SUPABASE_SETUP.md`](./SUPABASE_SETUP.md)
   - แนะนำชื่อ: `vehicle-control-center` หรือ `vcc`
2. Run SQL migrations ตามลำดับ:
   - ดูคู่มือ: [`docs/SQL_MIGRATION_GUIDE.md`](./SQL_MIGRATION_GUIDE.md)
   - `20251105120000_initial_schema.sql`
   - `20251106120000_add_missing_fields.sql`
   - `20251115130000_add_audit_logs.sql`
   - `20251115132000_add_vehicle_management_tables.sql`
   - `20251110_add_ticket_costs_category_note.sql`
   - `20251117140000_alter_vehicle_usage_add_manual_correction.sql`
   - `20251120000000_setup_pm_cron_job.sql` (optional)

### Step 2: Install Dependencies
```bash
npm install @supabase/supabase-js
npm install @supabase/auth-helpers-react  # ถ้าใช้ React
```

### Step 3: Create Configuration Files
- `.env.local` - สำหรับ Supabase URL และ anon key
- `lib/supabase.ts` - Supabase client setup

### Step 4: Replace Mock Services
- แก้ไข `services.ts` ให้ใช้ Supabase client แทน mock data
- สร้าง API functions สำหรับแต่ละ service

### Step 5: Update Components
- แก้ไข `DashboardView.tsx` ให้ใช้ real data
- สร้าง loading states และ error handling

---

## 📝 ไฟล์ที่ต้องสร้าง

### Configuration
- [ ] `lib/supabase.ts` - Supabase client
- [ ] `types/database.ts` - TypeScript types จาก database
- [ ] `.env.local.example` - ตัวอย่าง environment variables

### Services
- [ ] `services/vehicleService.ts`
- [ ] `services/ticketService.ts`
- [ ] `services/usageService.ts`
- [ ] `services/fuelService.ts`
- [ ] `services/maintenanceService.ts`
- [ ] `services/alertService.ts`
- [ ] `services/authService.ts`

### Hooks
- [ ] `hooks/useVehicles.ts`
- [ ] `hooks/useTickets.ts`
- [ ] `hooks/useDashboard.ts`
- [ ] `hooks/useAuth.ts`

### Views/Pages
- [ ] `views/LoginView.tsx`
- [ ] `views/VehiclesView.tsx`
- [ ] `views/TicketsView.tsx`
- [ ] `views/UsageView.tsx`
- [ ] `views/FuelView.tsx`
- [ ] `views/MaintenanceView.tsx`
- [ ] `views/AlertsView.tsx`

### Components
- [ ] `components/forms/VehicleForm.tsx`
- [ ] `components/forms/TicketForm.tsx`
- [ ] `components/forms/UsageForm.tsx`
- [ ] `components/forms/FuelForm.tsx`
- [ ] `components/tables/VehicleTable.tsx`
- [ ] `components/tables/TicketTable.tsx`

---

## 🔍 SQL Views ที่สามารถใช้ได้ทันที

### 1. `vehicle_dashboard`
```sql
SELECT * FROM vehicle_dashboard;
```
- ใช้สำหรับแสดงข้อมูลรถใน dashboard
- มีข้อมูล: current_odometer, usage_status, trips, fuel, maintenance, alerts

### 2. `fuel_efficiency_summary`
```sql
SELECT * FROM fuel_efficiency_summary 
WHERE month >= date_trunc('month', now() - interval '6 months');
```
- ใช้สำหรับแสดงกราฟอัตราสิ้นเปลือง

### 3. `vehicle_usage_summary`
```sql
SELECT * FROM vehicle_usage_summary 
WHERE month >= date_trunc('month', now() - interval '6 months');
```
- ใช้สำหรับแสดงกราฟการใช้งาน

---

## ⚠️ ข้อควรระวัง

1. **RLS Policies** - ตรวจสอบว่า policies อนุญาตให้ user อ่าน/เขียนข้อมูลได้ถูกต้อง
2. **Cron Jobs** - Function `check_maintenance_alerts()` ต้องถูกเรียกเป็นประจำ (ใช้ pg_cron หรือ external service)
3. **Generated Columns** - `distance_km`, `duration_hours`, `total_cost` เป็น generated columns ไม่ต้อง insert
4. **UUID vs Bigint** - tickets ใช้ bigint แต่ vehicle_usage ใช้ uuid
5. **Timezone** - ใช้ `timestamptz` ทุกที่ ต้องระวัง timezone

---

## 📚 Resources

### Documentation
- [`docs/SUPABASE_SETUP.md`](./SUPABASE_SETUP.md) - คู่มือการตั้งค่า Supabase และตั้งชื่อโปรเจกต์
- [`docs/SQL_MIGRATION_GUIDE.md`](./SQL_MIGRATION_GUIDE.md) - คู่มือการรัน SQL migrations

### External Links
- [Supabase Documentation](https://supabase.com/docs)
- [Supabase React Guide](https://supabase.com/docs/guides/getting-started/quickstarts/reactjs)
- [Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)

