# Architectural Review: Service Staff & Commission System

## 1. Integration Check (การเชื่อมต่อกับระบบเดิม)

จากการตรวจสอบ Database Schema ปัจจุบัน (`delivery_trips`, `delivery_trip_items`, `delivery_trip_item_changes`) พบว่าโครงสร้างเดิมรองรับการทำงานพื้นฐานได้ดี แต่ยังขาดส่วนประกอบสำคัญสำหรับฟีเจอร์ใหม่:

### Gap Analysis
1.  **Staff Assignment**: ปัจจุบัน `delivery_trips` มีแค่ `driver_id` (1 คน) ไม่สามารถรองรับ Helpers หลายคนได้
2.  **Commission Logic**: ยังไม่มีตารางเก็บ "เรทค่าคอมมิชชั่น" และ "ประวัติรายได้"
3.  **Net Items Definition**: การคำนวณจาก Audit Logs (`delivery_trip_item_changes`) เพื่อหา "ยอดสุทธิ" มีความเสี่ยงสูงที่จะผิดพลาดและซับซ้อนในการ Query

### Recommendation
*   **สร้างตาราง `delivery_trip_staff`**: เพื่อเชื่อม `delivery_trips` กับ `profiles` (Many-to-Many)
    ```sql
    CREATE TABLE delivery_trip_staff (
      trip_id UUID REFERENCES delivery_trips(id),
      user_id UUID REFERENCES profiles(id),
      role TEXT CHECK (role IN ('driver', 'helper')),
      is_active BOOLEAN DEFAULT TRUE, -- เผื่อกรณีป่วย/กลับก่อน
      created_at TIMESTAMPTZ
    );
    ```
*   **สร้างตาราง `commission_configs`**: เก็บ Rate per Item (ไม่ควร Hardcode ใน Code)

---

## 2. Loophole Analysis (วิเคราะห์ช่องโหว่และ Edge Cases)

### 2.1 "Lowest Income First" Algorithm
*   **ความเสี่ยง**: อาจทำให้ได้ทีมงานที่มีประสิทธิภาพต่ำ (Low Performance) มารวมตัวกัน เพราะคนที่รายได้น้อยอาจเกิดจากการทำงานไม่เก่งหรืออู้งาน
*   **ทางแก้**: ควรใช้ **Weighted Score** = `(Income * 0.7) + (PerformanceScore * 0.3)` หรือมีระบบ Rotation เพื่อกระจายงานให้ทั่วถึงแทน

### 2.2 Staff Dropout (ป่วย/กลับก่อน)
*   **Scenario**: ทริปเริ่มไปแล้ว แต่ Helper คนหนึ่งป่วยกลางทาง
*   **Loophole**: ถ้าหารด้วย "Number of Crew Members" (จำนวนคนทั้งหมด) คนที่ป่วยจะได้ส่วนแบ่งเท่าคนที่ทำจนจบ หรือคนที่ทำจนจบจะเสียเปรียบ
*   **ทางแก้**: สูตรคำนวณควรเป็น **Pro-rated** (ตามสัดส่วนการทำงาน) หรือตัดชื่อออกถ้าทำไม่ถึงเกณฑ์

### 2.3 Trip Cancellation
*   **Scenario**: Staff มารอแล้ว แต่ทริปถูกยกเลิก
*   **Loophole**: Staff เสียเวลาฟรี
*   **ทางแก้**: ควรกำหนด **Minimum Compensation** (ค่าเสียเวลา) กรณีทริปถูกยกเลิกด้วยเหตุสุดวิสัย

### 2.4 "Net Items" Calculation
*   **ความเสี่ยง**: การใช้ `Total Net Items` อาจคลุมเครือ
*   **คำถาม**: นับรวมของที่ "ส่งไม่สำเร็จ" (Failed Delivery) หรือไม่? นับรวมของที่ "เสียหาย" (Damaged) หรือไม่?
*   **ทางแก้**: นิยามให้ชัดเจนว่า `Net Items = Delivered Quantity (Good Condition Only)`.

---

## 3. Database Optimization (Triggers vs Edge Functions)

**Recommendation: ใช้ Edge Functions (Supabase Functions)**

| Feature | Database Triggers | Edge Functions (Recommended) |
| :--- | :--- | :--- |
| **Complexity** | เหมาะกับ Logic ง่ายๆ (เช่น `updated_at`) | เหมาะกับ Business Logic ซับซ้อน (คำนวณเงิน) |
| **Maintainability** | Debug ยาก, แก้ไขยาก (PL/pgSQL) | เขียนด้วย TypeScript, Test ง่าย, Version Control ง่าย |
| **Scalability** | ทำงานใน DB Transaction (อาจหน่วง DB) | ทำงานแยก (Serverless), ไม่บล็อก DB |
| **Safety** | พลาดแล้วแก้ Data ยาก | สามารถ Log, Retry, และตรวจสอบก่อนบันทึกได้ง่ายกว่า |

**Workflow ที่แนะนำ:**
1.  เมื่อ Trip Status เปลี่ยนเป็น `Completed`
2.  Trigger Webhook ไปยัง Edge Function `calculate-commission`
3.  Function ดึงข้อมูล Items, Staff, Rates
4.  คำนวณและบันทึกลงตาราง `commission_logs` (Immutable Table)

---

## 4. Future Proofing (การรองรับ Data Mining)

เพื่อการวิเคราะห์ Staff Performance ในอนาคต ควรเก็บข้อมูลเพิ่มดังนี้:

1.  **Time Tracking**:
    *   `start_time` และ `end_time` ของ Staff แต่ละคนในทริป (เพื่อคำนวณ Man-hours หรือ Efficiency)
2.  **Task Breakdown** (Optional):
    *   หากในอนาคตมีการแบ่งหน้าที่ชัดเจน (เช่น คนขับไม่ต้องยกของ) ควรมี field `task_weight` เพื่อปันส่วนคอมมิชชั่นไม่เท่ากัน
3.  **Performance Rating**:
    *   เพิ่ม field `rating` (1-5) ใน `delivery_trip_staff` ให้หัวหน้างานประเมินลูกน้องหลังจบทริป
4.  **Incident Logs**:
    *   เชื่อมโยงของเสียหาย (`delivery_trip_item_changes`) กับ Staff ที่รับผิดชอบ (ถ้าระบุตัวได้)

---

## สรุป Actionable Recommendations

1.  **[Database]** สร้างตาราง `delivery_trip_staff` และ `commission_logs`
2.  **[Logic]** นิยามสูตร "Net Items" ให้ชัดเจน (แนะนำให้ใช้ยอด Delivered จริง ไม่ใช่ยอด Planned)
3.  **[Backend]** ใช้ **Edge Functions** ในการคำนวณเงิน แทน Triggers
4.  **[UI/UX]** เพิ่มหน้าจอ "Staff Assignment" ที่แสดงรายได้ย้อนหลังประกอบการตัดสินใจ (แต่อย่า Auto-assign 100% ให้ Admin ตัดสินใจสุดท้าย)
