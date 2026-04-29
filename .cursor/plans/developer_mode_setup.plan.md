---
name: Developer Mode Setup
overview: พัฒนาระบบ Dev Mode และเครื่องมือสนับสนุนสำหรับ Role Dev เพื่อให้ผู้พัฒนาสามารถทำงาน ทดสอบ และเข้าถึงเครื่องมือ Debug/Bypass ได้อย่างเต็มรูปแบบ
todos:
  - id: dev-mode-plan
    content: สร้างไฟล์แผนงาน Dev Mode
    status: completed
  - id: bypass-maintenance
    content: เพิ่มระบบ Bypass ใน MaintenanceView เพื่อให้ Dev เข้าถึงฟีเจอร์ที่ถูกปิด (Feature Overrides = off) ได้
    status: completed
  - id: dev-indicator
    content: เพิ่มตัวบ่งชี้การจำลองบทบาท (Role Simulation) ที่ชัดเจนเมื่อ Dev จำลองตัวตนเป็น Role อื่น
    status: completed
  - id: global-role-checks
    content: ตรวจสอบและเพิ่มเติมในทุกๆ Feature ที่เกี่ยวข้องกับการตรวจสอบ Role (เช่น isHighLevel, isAdmin) ให้ครอบคลุม Role Dev ด้วย
    status: completed
isProject: false
---

# แผน: Developer Mode และความพร้อมสำหรับ Role Dev

## บริบทและเป้าหมาย
- **เป้าหมาย**: ทำให้ระบบพร้อมใช้งานสำหรับผู้พัฒนาระบบ (Role `dev`) โดยอำนวยความสะดวกในการทดสอบข้ามบทบาท (Role Simulation), การตรวจสอบข้อมูลสด (JSON Inspector), และการเข้าถึงฟีเจอร์ที่กำลังปรับปรุง
- **ความท้าทาย**: เมื่อผู้พัฒนาเปิดโหมดปิดกั้นฟีเจอร์ (Maintenance Mode / Feature Override = `off`) ผู้พัฒนาเองก็ถูกบล็อกด้วย ทำให้ไม่สามารถพัฒนาฟีเจอร์ที่กำลังถูกปิดกั้นได้
- **ความท้าทายที่ 2**: ขาดตัวบ่งชี้ที่ชัดเจน (นอกจาก DebugTools) เวลาผู้พัฒนาทำการจำลอง (Simulate) เป็น Role อื่น เช่น สลับเป็นพนักงานขับรถ แล้วลืมว่าตนเองคือ Dev

## ขอบเขตการทำงาน (Phase 1)

### 1. ระบบจำลองบทบาทที่ชัดเจนยิ่งขึ้น (Enhanced Role Simulation Indicator)
- ปรับปรุง Header ให้อ่านค่า `overriddenRole` ควบคู่กับ `isRealDev` 
- ถ้า `isRealDev` มีการ override บทบาทอื่น ให้แสดงป้ายกำกับสีเหลือง/ส้มชัดเจน เช่น **"Dev Mode: จำลองสิทธิ์เป็น [Role]"** เพื่อป้องกันความสับสน

### 2. ระบบข้ามการบล็อกสำหรับผู้พัฒนา (Maintenance Mode Bypass)
- **ปัญหา**: ขณะนี้ฟีเจอร์ `featureOverrides` ที่ถูกตั้งเป็น `off` จะแสดง `<MaintenanceView />` โดยไม่สนใจว่าเป็น Dev หรือไม่ 
- **ทางแก้**: เพิ่มปุ่ม **"Bypass Block (เฉพาะผู้พัฒนา)"** ในหน้า `<MaintenanceView />` ถ้า `isDev` เป็น `true` (หรือ `isRealDev` เป็น `true`)
- ใช้ local state (เช่น `devBypassedFeatures` ในรูปแบบ `Set` หรือ `string[]`) เพื่อจดจำว่าผู้พัฒนาได้กดทะลุบล็อกสำหรับหน้านี้แล้ว จะได้ไม่ต้องกดซ้ำเมื่อเปลี่ยนแท็บไปมา

### 3. เตรียมความพร้อมของเมนู DB Explorer (พร้อมอยู่แล้ว)
- เช็คและรับรองให้ `tab.db_explorer` เข้าถึงได้เฉพาะเมื่อ `isDev` (ผู้พัฒนา) เป็น `true` ซึ่งผูกกับ Role `dev` โดยสมบูรณ์

### 4. รวม Role Dev เข้ากับสิทธิ์ระดับสูงในทุกฟีเจอร์ (Global Role Inclusion)
- ตรวจสอบฟีเจอร์ต่างๆ ที่มีการเช็คสิทธิ์แบบฮาร์ดโค้ด (เช่น `isHighLevel = isAdmin || isManager || ...`)
- เพิ่มเงื่อนไข `isDev` หรือ `role === 'dev'` เข้าไปในทุกที่ที่เกี่ยวข้อง เพื่อให้มั่นใจว่า Role Dev จะสามารถทำงานและมองเห็นข้อมูลได้ครอบคลุมเทียบเท่าหรือมากกว่า Admin เสมอ

## ลำดับการดำเนินการ (Implementation Steps)

1. **เพิ่ม State Bypass**: เพิ่ม `bypassedFeatures` state ใน Component หลัก (เช่น `App` หรือใน `index.tsx`) เพื่อเก็บ Feature Key ที่ Dev สั่งข้ามการบล็อก
2. **แก้ไข MaintenanceView**: อัปเดต Prop ให้รองรับการกด Bypass และแสดงปุ่มเมื่อ `isRealDev` เป็น `true`
3. **ปรับแก้หน้า Header**: แสดงสถานะการจำลอง Role ให้ชัดเจนแทนที่จะโชว์แค่ text เล็กๆ ว่า `(dev)`
4. **ตรวจสอบเงื่อนไข Role ทั้งแอป**: เพิ่ม `isDev` หรือ `role === 'dev'` ลงในตัวแปรตรวจสอบสิทธิ์ต่างๆ เช่น `isHighLevel` ใน `index.tsx`, `usePendingOrdersFilters.ts`, และ `CustomerManagementView.tsx`
