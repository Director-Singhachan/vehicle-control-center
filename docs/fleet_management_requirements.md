# Project Requirements Document: Fleet Management & Advanced Cost Analysis System
**Date:** 2025-07-29
**Version:** 1.0
**Context:** Internal Organization System

---

## 1. Project Overview (ภาพรวมโครงการ)
พัฒนาระบบบริหารจัดการยานพาหนะและการขนส่งแบบครบวงจร (End-to-End) โดยมีจุดเด่นคือความสามารถในการเชื่อมโยงข้อมูลการเดินรถ พนักงาน และสินค้าเข้าด้วยกัน เพื่อวิเคราะห์ "ต้นทุนและกำไรต่อชิ้น (Profit per SKU)" ได้อย่างแม่นยำ และทำหน้าที่เป็นระบบสนับสนุนการตัดสินใจ (Decision Support System) สำหรับผู้บริหาร

## 2. System Architecture (สถาปัตยกรรมระบบ)
* **Architecture Style:** Modular Monolith (เน้นความแน่นของ Data Integrity และการเชื่อมโยง Logic ที่ซับซ้อน)
* **Backend:** Python (Django หรือ FastAPI) เพื่อรองรับการคำนวณทางคณิตศาสตร์และ Data Analysis
* **Database:** PostgreSQL (รองรับ Relational Data ที่ซับซ้อนและ JSONB)
* **Frontend (Admin/Manager):** React หรือ Vue.js (Web Dashboard)
* **Frontend (Driver/Staff):** Mobile-First Web Application / PWA

---

## 3. User Roles & Permissions (ผู้ใช้งานและสิทธิ์)
ระบบแบ่งสิทธิ์การเข้าถึงชัดเจนตามลำดับชั้น (RBAC):

1.  **Administrator (God Mode / Owner):**
    * เข้าถึงได้ทุกโมดูล
    * ดูรายงานต้นทุนเชิงลึก (Profit per SKU) และกำไรสุทธิ
    * กำหนดสูตรการคำนวณคอมมิชชั่น
2.  **Fleet Manager:**
    * จัดการข้อมูลรถ (Vehicles) และตารางซ่อมบำรุง
    * สร้างและอนุมัติ Trip
    * ดูรายงานประสิทธิภาพการขนส่ง
3.  **Driver (พนักงานขับรถ):**
    * เข้าถึงผ่าน Mobile Web
    * บันทึกการทำงาน (Trip Log), เติมน้ำมัน, แจ้งซ่อม
    * ดูประวัติการวิ่งและค่าคอมมิชชั่นของตนเอง
4.  **Porter (พนักงานยกของ - Optional):**
    * (อาจรวมอยู่ในสิทธิ์ Driver หรือแยกถ้าต้องการให้ Check-in เอง)

---

## 4. Functional Requirements (ความต้องการของระบบ)

### Module 1: Fleet & Logistics (จัดการยานพาหนะและการเดินทาง)
- [ ] **Vehicle Management:** บันทึกทะเบียนรถ, ประเภทรถ, เลขไมล์ปัจจุบัน, สถานะ (พร้อมใช้/ซ่อม).
- [ ] **Trip Creation:**
    * Manager สามารถสร้าง Trip โดยระบุ: รถ, คนขับ, เด็กติดรถ, เส้นทาง/โซน.
    * ระบบ Generate `TripID` เพื่อใช้เป็น Reference Key ให้กับทุก Transaction.
- [ ] **Trip Assignment:** เมื่อ Driver Login เข้าสู่ระบบ ต้องเห็นเฉพาะงาน (Trip) ที่ได้รับมอบหมายในวันนั้น.

### Module 2: Driver Operations (ส่วนงานคนขับ - Mobile Interface)
- [ ] **Trip Start/End:** ปุ่มกดเริ่มงานและจบทริป (บันทึก Timestamp และ GPS).
- [ ] **Mileage Log:**
    * บันทึกเลขไมล์ขาไป (Start Mileage) และขากลับ (End Mileage).
    * ระบบตรวจสอบความสมเหตุสมผลของเลขไมล์ (Validation).
- [ ] **Refueling Log (บันทึกเติมน้ำมัน):**
    * ฟอร์มบันทึก: จำนวนเงิน, จำนวนลิตร, เลขไมล์ขณะเติม.
    * อัปโหลดรูปถ่ายสลิป/หน้าปัดตู้จ่าย.
- [ ] **Maintenance Request (แจ้งซ่อม):**
    * ฟอร์มแจ้งอาการเสีย, ระดับความเร่งด่วน.
    * อัปโหลดรูปถ่ายความเสียหาย.
    * ติดตามสถานะการซ่อม (รออนุมัติ/ซ่อมเสร็จแล้ว).

### Module 3: Inventory & Sales (สินค้าและการขาย)
- [ ] **Loading Manifest:** บันทึกจำนวนสินค้าที่นำขึ้นรถแต่ละ Trip (Stock เคลื่อนที่).
- [ ] **Customer Visit (Check-in):** บันทึกพิกัด GPS เมื่อถึงร้านค้า.
- [ ] **Sales Recording:**
    * บันทึกรายการสินค้าที่ขายให้ลูกค้าแต่ละราย.
    * ตัด Stock บนรถแบบ Real-time.
- [ ] **Product Return:** บันทึกสินค้าเหลือกลับคลังเมื่อจบทริป.

### Module 4: Analytics & Cost Engine (การวิเคราะห์และคำนวณต้นทุน)
**นี่คือ Core Feature สำคัญที่สุดของระบบ**
- [ ] **Automated Cost Allocation:** ระบบต้องดึงค่าใช้จ่ายทั้งหมดใน Trip มาคำนวณ
    * $$TripCost = (Fuel + StaffWages + Commission + VehicleDepreciation)$$
- [ ] **Profit per SKU Calculation:**
    * กระจาย `TripCost` เข้าสู่สินค้าแต่ละชิ้นตามน้ำหนัก (Weight-based) หรือมูลค่า (Value-based).
    * แสดงกำไรที่แท้จริง: $$NetProfit = SellingPrice - (COGS + AllocatedTripCost)$$
- [ ] **Customer Analytics:**
    * Dashboard แสดง Heatmap การกระจายตัวของลูกค้า.
    * วิเคราะห์ความถี่ในการสั่งซื้อ และสินค้าที่นิยมในแต่ละพื้นที่.
- [ ] **Driver Performance:** สถิติการขับขี่, อัตราสิ้นเปลืองน้ำมัน (km/liter), การตรงต่อเวลา.

### Module 5: HR & Commission (ค่าตอบแทน)
- [ ] **Staff Management:** จับคู่พนักงาน (คนขับ/เด็กยก) เข้ากับ Trip.
- [ ] **Commission Calculation:** คำนวณค่าคอมมิชชั่นอัตโนมัติตามเงื่อนไข (เช่น % จากยอดขาย, หรือ Flat rate ต่อจุดจอด).
- [ ] **Export Data:** ส่งออกข้อมูลเพื่อทำจ่ายเงินเดือน.

---

## 5. Non-Functional Requirements (ข้อกำหนดเชิงคุณภาพ)
- [ ] **Mobile Responsiveness:** หน้าจอฝั่ง Driver ต้องใช้งานง่ายบนมือถือ ปุ่มกดใหญ่ ชัดเจน.
- [ ] **Data Consistency:** ข้อมูลสต็อกและการเงินต้องถูกต้องแม่นยำ 100%.
- [ ] **GPS Tracking Integration:** ระบบต้องรองรับการดึงค่า Lat/Long จาก Browser/Device ของพนักงาน.
- [ ] **Security:** ข้อมูลต้นทุนและกำไรต้องถูกเข้ารหัสและเข้าถึงได้เฉพาะสิทธิ์ระดับ Admin เท่านั้น.

---

## 6. Next Steps for Development (ขั้นตอนถัดไป)
1.  **Database Design:** ลงรายละเอียด ER Diagram (ตามที่ร่างไว้).
2.  **Mockup/Wireframe:** ออกแบบหน้าจอ Mobile สำหรับคนขับเพื่อทดสอบ UX.
3.  **Prototype Development:** พัฒนา Module 1 (Fleet) และ 2 (Driver Ops) เป็นเฟสแรก.