# SQL Migrations & Examples

โฟลเดอร์นี้เก็บไฟล์ SQL migrations และตัวอย่างสำหรับการพัฒนา Vehicle Control Center

## 📋 ไฟล์ Migrations (รันตามลำดับ)

### Core Schema
1. **`20251105120000_initial_schema.sql`** - Schema เริ่มต้น
   - Profiles, Vehicles, Tickets, Approvals, Costs
   - RLS policies และ auth triggers

2. **`20251106120000_add_missing_fields.sql`** - เพิ่มฟิลด์ที่ขาด
   - Garage, inspector/manager/executive fields
   - Ticket number, approval history, signature URLs

3. **`20251115130000_add_audit_logs.sql`** - ระบบ Audit Trail
   - Audit logs table และ triggers

### Vehicle Management
4. **`20251115132000_add_vehicle_management_tables.sql`** - ระบบจัดการยานพาหนะ
   - vehicle_usage, fuel_records
   - maintenance_schedules, maintenance_history
   - vehicle_alerts
   - Views และ functions สำหรับ dashboard

5. **`20251110_add_ticket_costs_category_note.sql`** - เพิ่มฟิลด์ ticket_costs
   - Category และ note columns

6. **`20251117140000_alter_vehicle_usage_add_manual_correction.sql`** - เพิ่ม flag การแก้ไข
   - is_manual_correction column

7. **`20251120000000_setup_pm_cron_job.sql`** - Setup Cron Job (Optional)
   - ตั้งค่า cron job สำหรับตรวจสอบ maintenance alerts

### Compatibility Fixes (แนะนำให้รัน)
8. **`20251202000000_add_vehicle_location_fields.sql`** - เพิ่ม location fields
   - เพิ่ม lat/lng columns สำหรับ map (optional)

9. **`20251202010000_create_daily_usage_view.sql`** - สร้าง daily usage view
   - View สำหรับแสดงการใช้งานรายวัน

10. **`20251202020000_create_vehicle_status_function.sql`** - สร้าง status function
    - Function และ view สำหรับคำนวณสถานะรถ

11. **`20251202030000_fix_garage_reference.sql`** - แก้ไข garage reference (ถ้ารัน migration เก่าแล้ว)
    - แก้ไข garage_id เป็น garage text ใน maintenance_history

12. **`20251203000000_fix_profiles_rls_infinite_recursion.sql`** - ⚠️ แก้ไข RLS infinite recursion (สำคัญ!)
    - แก้ไขปัญหา infinite recursion ใน profiles RLS policy
    - สร้าง helper functions (is_admin, is_manager_or_admin)
    - อัปเดต policies ทั้งหมดให้ใช้ functions

13. **`20251203010000_create_test_users.sql`** - สร้าง Test Users สำหรับ RLS Testing
    - Function สำหรับสร้าง test user profiles
    - Test data สำหรับ vehicles และ tickets
    - ⚠️ ใช้เฉพาะใน development/staging environments

### Examples
- **`examples.sql`** - ตัวอย่าง SQL queries และ schema

## 🚀 วิธีใช้งาน

### สำหรับ Supabase
1. เปิด Supabase Dashboard → SQL Editor
2. รันไฟล์ migrations ตามลำดับข้างต้น
3. ตรวจสอบว่า tables, views, functions ถูกสร้างครบ

### สำหรับ Database อื่น
- ปรับ syntax ให้เหมาะสมกับ database system ที่ใช้
- PostgreSQL: ใช้ได้เลย
- MySQL: ปรับ UUID, timestamptz, jsonb
- SQLite: ปรับ syntax และ features

## 📚 เอกสารเพิ่มเติม

- **`../docs/RLS_FIX.md`** - ⚠️ คู่มือแก้ไขปัญหา RLS infinite recursion
- **`../docs/RLS_TESTING_GUIDE.md`** - 🧪 คู่มือการทดสอบ RLS และ permissions
- **`../docs/COMPATIBILITY_REPORT.md`** - รายงานการตรวจสอบความเข้ากันได้ Frontend vs Database
- **`../docs/SQL_MIGRATION_GUIDE.md`** - คู่มือการรัน migrations
- **`../docs/DEVELOPMENT_ROADMAP.md`** - แผนการพัฒนาโปรเจกต์

## ⚠️ หมายเหตุ

- ไฟล์ migrations ใช้ PostgreSQL syntax (Supabase)
- ตรวจสอบลำดับการรัน migrations ให้ถูกต้อง
- Backup database ก่อนรัน migrations ใน production
- ใช้ `IF NOT EXISTS` เพื่อป้องกัน errors เมื่อรันซ้ำ

