# รายงานการตรวจสอบความเข้ากันได้: Frontend vs Database Schema

## 📋 สรุปผลการตรวจสอบ

ตรวจสอบความเข้ากันได้ระหว่างโครงสร้างหน้าเว็บ (Frontend) กับไฟล์ SQL (Database Schema) พบปัญหาที่ต้องแก้ไขหลายจุด

---

## ❌ ปัญหาที่พบ

### 1. Vehicle Interface ไม่ตรงกับ Database Schema

#### Frontend ต้องการ (services.ts):
```typescript
interface Vehicle {
  id: string;
  name: string;           // ❌ ไม่มีใน database
  status: 'active' | 'maintenance' | 'idle';  // ❌ ไม่มีใน database
  lat: number;            // ❌ ไม่มีใน database
  lng: number;            // ❌ ไม่มีใน database
  fuelLevel: number;       // ❌ ไม่มีใน database
}
```

#### Database มี (vehicles table):
```sql
- id (uuid)
- plate (text)           // ✅ มี
- make (text)            // ✅ มี
- model (text)           // ✅ มี
- type (text)            // ✅ มี
- branch (text)          // ✅ มี
- created_at (timestamptz)
```

**วิธีแก้ไข:**
- ใช้ `plate` หรือ `make + model` แทน `name`
- คำนวณ `status` จาก `vehicle_usage.status` และ `tickets.status`
- เพิ่ม fields `lat`, `lng` ใน vehicles table (ถ้าต้องการ)
- คำนวณ `fuelLevel` จาก `fuel_records` ล่าสุด

---

### 2. Vehicle Summary - Status Calculation

#### Frontend ต้องการ:
```typescript
getSummary: async () => ({
  total: number,        // ✅ มี (count vehicles)
  active: number,       // ⚠️ ต้องคำนวณจาก vehicle_usage
  maintenance: number,  // ⚠️ ต้องคำนวณจาก tickets
  idle: number         // ⚠️ ต้องคำนวณ (total - active - maintenance)
})
```

#### Database:
- `vehicles` table มี total count ✅
- `vehicle_usage` table มี status 'in_progress' สำหรับ active ✅
- `tickets` table มี status สำหรับ maintenance ✅

**วิธีแก้ไข:**
- ใช้ `vehicle_dashboard` view หรือ query แยก
- Query `vehicle_usage` WHERE status = 'in_progress'
- Query `tickets` WHERE status IN ('pending', 'approved_*', 'in_progress')

---

### 3. Financials - Revenue Data ไม่มี

#### Frontend ต้องการ:
```typescript
getFinancials: async () => ({
  todayRevenue: number,    // ❌ ไม่มีตารางเก็บรายได้
  todayCost: number,        // ✅ มี (ticket_costs)
  revenueTrend: number,     // ❌ ไม่มีข้อมูล
  costTrend: number         // ⚠️ ต้องคำนวณจาก ticket_costs
})
```

#### Database:
- `ticket_costs` table มีค่าใช้จ่ายการซ่อม ✅
- **ไม่มีตารางเก็บรายได้ (revenue)** ❌

**วิธีแก้ไข:**
- **Option 1:** ลบ `todayRevenue` และ `revenueTrend` ออกจาก dashboard
- **Option 2:** สร้างตาราง `revenue` หรือ `transactions` ใหม่
- **Option 3:** ใช้ค่าใช้จ่ายการซ่อมเป็นข้อมูลหลัก (เปลี่ยน label)

---

### 4. Usage Chart Data Format

#### Frontend ต้องการ:
```typescript
getDailyUsage: async () => ({
  labels: ['Mon', 'Tue', 'Wed', ...],
  data: [65, 78, 72, ...]  // จำนวนยานพาหนะที่ใช้งานต่อวัน
})
```

#### Database:
- `vehicle_usage_summary` view มีข้อมูลรายเดือน ✅
- **ไม่มีข้อมูลรายวัน** ⚠️

**วิธีแก้ไข:**
- Query `vehicle_usage` โดย GROUP BY date
- ใช้ `date_trunc('day', start_time)` เพื่อ group ตามวัน
- Count DISTINCT vehicle_id ต่อวัน

---

### 5. Maintenance Trends Data Format

#### Frontend ต้องการ:
```typescript
getMaintenanceTrends: async () => ({
  labels: ['Jan', 'Feb', 'Mar', ...],
  costs: [4000, 3000, 5500, ...],    // ✅ มี (ticket_costs)
  incidents: [12, 8, 15, ...]       // ✅ มี (count tickets)
})
```

#### Database:
- `ticket_costs` table มีค่าใช้จ่าย ✅
- `tickets` table มีข้อมูลตั๋ว ✅

**วิธีแก้ไข:**
- Query `ticket_costs` GROUP BY month, SUM(cost)
- Query `tickets` GROUP BY month, COUNT(*)
- ใช้ `date_trunc('month', created_at)`

---

### 6. Vehicle Locations (Map Widget)

#### Frontend ต้องการ:
```typescript
vehicles: Vehicle[] = [
  { id, name, status, lat, lng, fuelLevel }
]
```

#### Database:
- **ไม่มี fields `lat`, `lng`** ❌
- **ไม่มีข้อมูล location tracking** ❌

**วิธีแก้ไข:**
- **Option 1:** เพิ่ม fields `lat`, `lng` ใน vehicles table (static location)
- **Option 2:** สร้างตาราง `vehicle_locations` สำหรับ real-time tracking
- **Option 3:** ใช้ข้อมูลจาก `vehicle_usage.destination` (ถ้ามี)

---

## ✅ ส่วนที่เข้ากันได้

### 1. Vehicle Dashboard View
- `vehicle_dashboard` view มีข้อมูลครบสำหรับแสดงสรุปรถ
- ใช้ได้กับ `vehicleService.getDashboardData()`

### 2. Fuel Efficiency Summary
- `fuel_efficiency_summary` view มีข้อมูลครบ
- ใช้ได้สำหรับแสดงกราฟอัตราสิ้นเปลือง

### 3. Vehicle Usage Summary
- `vehicle_usage_summary` view มีข้อมูลครบ
- ใช้ได้สำหรับแสดงกราฟการใช้งาน (แต่เป็นรายเดือน)

### 4. Tickets & Approvals
- Schema ครบถ้วนสำหรับระบบตั๋วแจ้งซ่อม
- มี approval workflow ครบ

---

## 🔧 แนวทางแก้ไขที่แนะนำ

### Phase 1: Quick Fixes (ไม่ต้องแก้ SQL)

1. **แก้ไข Vehicle Interface**
   ```typescript
   interface Vehicle {
     id: string;
     plate: string;        // ใช้แทน name
     make?: string;
     model?: string;
     status: 'active' | 'maintenance' | 'idle';  // คำนวณจาก queries
     lat?: number;          // Optional (ถ้ายังไม่มี)
     lng?: number;          // Optional
     fuelLevel?: number;    // คำนวณจาก fuel_records
   }
   ```

2. **แก้ไข Service Functions**
   - `getSummary()` - Query จาก database แทน mock
   - `getLocations()` - Query vehicles + คำนวณ status
   - `getDailyUsage()` - Query vehicle_usage GROUP BY day
   - `getMaintenanceTrends()` - Query ticket_costs + tickets
   - `getFinancials()` - ลบ revenue หรือสร้างตารางใหม่

### Phase 2: Database Enhancements (ต้องแก้ SQL)

1. **เพิ่ม Location Fields (ถ้าต้องการ)**
   ```sql
   ALTER TABLE vehicles
     ADD COLUMN lat numeric(10, 8),
     ADD COLUMN lng numeric(11, 8);
   ```

2. **สร้าง Revenue Table (ถ้าต้องการ)**
   ```sql
   CREATE TABLE revenue (
     id uuid PRIMARY KEY,
     vehicle_id uuid REFERENCES vehicles(id),
     amount numeric(10,2),
     transaction_date timestamptz,
     ...
   );
   ```

3. **สร้าง Daily Usage View**
   ```sql
   CREATE VIEW vehicle_usage_daily AS
   SELECT 
     date_trunc('day', start_time) as day,
     COUNT(DISTINCT vehicle_id) as active_count
   FROM vehicle_usage
   WHERE status = 'completed'
   GROUP BY day;
   ```

---

## 📊 ตารางเปรียบเทียบ

| Feature | Frontend Needs | Database Has | Status | Solution |
|---------|---------------|--------------|--------|----------|
| Vehicle name | `name` | `plate`, `make`, `model` | ⚠️ | ใช้ `plate` หรือ `make + model` |
| Vehicle status | `status` | ไม่มี (ต้องคำนวณ) | ⚠️ | Query จาก `vehicle_usage` + `tickets` |
| Vehicle location | `lat`, `lng` | ไม่มี | ❌ | เพิ่ม fields หรือตารางใหม่ |
| Fuel level | `fuelLevel` | ไม่มี (ต้องคำนวณ) | ⚠️ | Query จาก `fuel_records` |
| Summary counts | `total`, `active`, `maintenance` | มีบางส่วน | ⚠️ | Query แยกจากหลายตาราง |
| Daily usage | Array per day | มีแค่รายเดือน | ⚠️ | Query `vehicle_usage` GROUP BY day |
| Maintenance trends | Monthly costs/incidents | มีข้อมูล | ✅ | Query `ticket_costs` + `tickets` |
| Revenue | `todayRevenue` | ไม่มี | ❌ | ลบหรือสร้างตารางใหม่ |

---

## 🎯 Action Items

### Priority 1: Critical (ต้องแก้ก่อนใช้งาน)
- [ ] แก้ไข `Vehicle` interface ให้ตรงกับ database
- [ ] แก้ไข `vehicleService.getSummary()` ให้ query จาก database
- [ ] แก้ไข `vehicleService.getLocations()` ให้ query จาก database
- [ ] แก้ไข `reportsService.getFinancials()` (ลบ revenue หรือสร้างตาราง)

### Priority 2: Important (ควรแก้)
- [ ] แก้ไข `vehicleUsageService.getDailyUsage()` ให้ query จาก database
- [ ] แก้ไข `reportsService.getMaintenanceTrends()` ให้ query จาก database
- [ ] เพิ่ม location fields ใน vehicles table (ถ้าต้องการ map)

### Priority 3: Nice to Have
- [ ] สร้าง daily usage view
- [ ] สร้าง revenue table (ถ้าต้องการ)
- [ ] เพิ่ม indexes สำหรับ queries ที่ใช้บ่อย

---

## 📝 ตัวอย่าง SQL Queries ที่ต้องใช้

### 1. Vehicle Summary
```sql
-- Total vehicles
SELECT COUNT(*) FROM vehicles;

-- Active vehicles (in use)
SELECT COUNT(DISTINCT vehicle_id) 
FROM vehicle_usage 
WHERE status = 'in_progress';

-- Maintenance vehicles
SELECT COUNT(DISTINCT vehicle_id) 
FROM tickets 
WHERE status IN ('pending', 'approved_inspector', 'approved_manager', 'ready_for_repair', 'in_progress');
```

### 2. Daily Usage
```sql
SELECT 
  date_trunc('day', start_time) as day,
  COUNT(DISTINCT vehicle_id) as active_count
FROM vehicle_usage
WHERE start_time >= now() - interval '7 days'
  AND status = 'completed'
GROUP BY day
ORDER BY day;
```

### 3. Maintenance Trends
```sql
-- Monthly costs
SELECT 
  date_trunc('month', t.created_at) as month,
  SUM(tc.cost) as total_cost
FROM ticket_costs tc
JOIN tickets t ON t.id = tc.ticket_id
WHERE t.created_at >= now() - interval '6 months'
GROUP BY month
ORDER BY month;

-- Monthly incidents
SELECT 
  date_trunc('month', created_at) as month,
  COUNT(*) as incident_count
FROM tickets
WHERE created_at >= now() - interval '6 months'
GROUP BY month
ORDER BY month;
```

### 4. Vehicle Locations (ถ้ามี lat/lng)
```sql
SELECT 
  v.id,
  v.plate as name,
  CASE 
    WHEN EXISTS (SELECT 1 FROM vehicle_usage WHERE vehicle_id = v.id AND status = 'in_progress') 
      THEN 'active'
    WHEN EXISTS (SELECT 1 FROM tickets WHERE vehicle_id = v.id AND status IN ('pending', 'in_progress'))
      THEN 'maintenance'
    ELSE 'idle'
  END as status,
  v.lat,
  v.lng,
  (SELECT fuel_efficiency FROM fuel_records WHERE vehicle_id = v.id ORDER BY filled_at DESC LIMIT 1) as fuelLevel
FROM vehicles v
WHERE v.lat IS NOT NULL AND v.lng IS NOT NULL;
```

---

## ✅ สรุป

**Frontend ต้องการข้อมูลที่บางส่วนไม่มีใน database** แต่สามารถแก้ไขได้โดย:
1. **แก้ไข Frontend** - ปรับ interface และ service functions ให้ตรงกับ database
2. **เพิ่ม SQL Migrations** - เพิ่ม fields หรือ tables ที่จำเป็น
3. **ใช้ Views และ Functions** - ใช้ views ที่มีอยู่แล้วและสร้างใหม่ตามต้องการ

**แนะนำ:** เริ่มจากแก้ไข Frontend ก่อน (Phase 1) แล้วค่อยเพิ่ม database enhancements (Phase 2) ตามความต้องการ

