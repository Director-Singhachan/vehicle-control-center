# Approval Workflow - ระบบการอนุมัติ

## 📋 ลำดับการอนุมัติ (3-Level Approval)

### Flow Diagram
```
PENDING
  ↓
[Inspector อนุมัติ - Level 1]
  ↓
APPROVED_INSPECTOR
  ↓
[Manager อนุมัติ - Level 2]
  ↓
APPROVED_MANAGER
  ↓
[Executive อนุมัติ - Level 3]
  ↓
READY_FOR_REPAIR
  ↓
[Garage เริ่มซ่อม]
  ↓
IN_PROGRESS
  ↓
[Garage เสร็จสิ้น]
  ↓
COMPLETED
```

---

## 🔐 Roles และ Permissions

### Level 1: Inspector (ผู้ตรวจสอบ)
- **อนุมัติได้**: Tickets ที่มี status = `pending`
- **เปลี่ยนเป็น**: `approved_inspector`
- **Level**: 1

### Level 2: Manager (ผู้จัดการ)
- **อนุมัติได้**: Tickets ที่มี status = `approved_inspector`
- **เปลี่ยนเป็น**: `approved_manager`
- **Level**: 2

### Level 3: Executive (ผู้บริหาร)
- **อนุมัติได้**: Tickets ที่มี status = `approved_manager`
- **เปลี่ยนเป็น**: `ready_for_repair`
- **Level**: 3

### Admin (ผู้ดูแลระบบ)
- **อนุมัติได้**: ทุก status (bypass all levels)
- **Level**: 3 (แต่สามารถอนุมัติข้ามขั้นตอนได้)

---

## 📊 Status Transitions

| Current Status | Role ที่อนุมัติได้ | Next Status | Level |
|---------------|-------------------|-------------|-------|
| `pending` | Inspector, Admin | `approved_inspector` | 1 |
| `approved_inspector` | Manager, Admin | `approved_manager` | 2 |
| `approved_manager` | Executive, Admin | `ready_for_repair` | 3 |
| `ready_for_repair` | Garage | `in_progress` | - |
| `in_progress` | Garage | `completed` | - |
| Any | Any (reject) | `rejected` | - |

---

## 🔄 การทำงานของระบบ

### 1. Ticket Creation
- ผู้ใช้สร้าง ticket → Status: `pending`
- รอ Inspector อนุมัติ

### 2. Level 1 Approval (Inspector)
- Inspector login → เห็น tickets ที่ status = `pending`
- กด "อนุมัติ" → ต้องกรอก password ยืนยัน
- ระบบบันทึก approval record (level: 1)
- Status เปลี่ยนเป็น: `approved_inspector`

### 3. Level 2 Approval (Manager)
- Manager login → เห็น tickets ที่ status = `approved_inspector`
- กด "อนุมัติ" → ต้องกรอก password ยืนยัน
- ระบบบันทึก approval record (level: 2)
- Status เปลี่ยนเป็น: `approved_manager`

### 4. Level 3 Approval (Executive)
- Executive login → เห็น tickets ที่ status = `approved_manager`
- กด "อนุมัติ" → ต้องกรอก password ยืนยัน
- ระบบบันทึก approval record (level: 3)
- Status เปลี่ยนเป็น: `ready_for_repair`

### 5. Repair (Garage)
- Garage login → เห็น tickets ที่ status = `ready_for_repair`
- เริ่มซ่อม → Status เปลี่ยนเป็น: `in_progress`
- เสร็จสิ้น → Status เปลี่ยนเป็น: `completed`

---

## 🛡️ Security Features

### Password Confirmation
- ทุกการอนุมัติต้องกรอก password ยืนยัน
- ตรวจสอบ password กับ Supabase Auth
- Audit trail: บันทึก user, timestamp, IP, user agent

### Sequential Approval
- ต้องอนุมัติตามลำดับ (ไม่สามารถข้ามขั้นได้)
- Admin เท่านั้นที่สามารถ bypass ได้

### Audit Trail
- บันทึกทุกการอนุมัติใน `ticket_approvals` table
- เก็บ: level, approved_by, timestamp, comments, IP, user agent

---

## 📝 Database Schema

### ticket_approvals Table
```sql
- id: UUID
- ticket_id: Integer (FK to tickets)
- level: Integer (1, 2, or 3)
- approved_by: UUID (FK to profiles)
- comments: Text
- created_at: Timestamp
- ip_address: INET
- user_agent: Text
```

### tickets Table (Status Field)
```sql
status: Enum (
  'pending',
  'approved_inspector',  -- Level 1 approved
  'approved_manager',     -- Level 2 approved
  'ready_for_repair',     -- Level 3 approved
  'in_progress',
  'completed',
  'rejected'
)
```

---

## 🎯 Code Implementation

### canApprove() Logic
```typescript
// Inspector: pending → approved_inspector
if (isInspector && ticket.status === 'pending') return true;

// Manager: approved_inspector → approved_manager
if (isManager && ticket.status === 'approved_inspector') return true;

// Executive: approved_manager → ready_for_repair
if (isExecutive && ticket.status === 'approved_manager') return true;

// Admin: can approve any status
if (isAdmin) return true;
```

### Status Transition Logic
```typescript
if (ticket.status === 'pending' && isInspector) {
  newStatus = 'approved_inspector';
  level = 1;
} else if (ticket.status === 'approved_inspector' && isManager) {
  newStatus = 'approved_manager';
  level = 2;
} else if (ticket.status === 'approved_manager' && isExecutive) {
  newStatus = 'ready_for_repair';
  level = 3;
}
```

---

## ✅ Checklist สำหรับการอนุมัติ

- [ ] User มี role ที่ถูกต้อง
- [ ] Ticket status อยู่ในขั้นตอนที่ถูกต้อง
- [ ] Password verification สำเร็จ
- [ ] บันทึก approval record
- [ ] อัพเดท ticket status
- [ ] สร้าง audit trail

---

## 🚨 Error Handling

- **Password ไม่ถูกต้อง**: แสดง error "รหัสผ่านไม่ถูกต้อง"
- **ไม่มีสิทธิ์**: ไม่แสดงปุ่มอนุมัติ
- **Status ไม่ถูกต้อง**: ไม่สามารถอนุมัติได้
- **Network Error**: แสดง error message และให้ retry

---

## 📌 Notes

- **Admin สามารถอนุมัติข้ามขั้นได้** แต่ควรใช้เมื่อจำเป็นเท่านั้น
- **Reject**: ทุก role สามารถ reject ได้ (เปลี่ยนเป็น `rejected`)
- **Garage role**: ไม่มีสิทธิ์อนุมัติ แต่สามารถเปลี่ยน status เป็น `in_progress` และ `completed` ได้

