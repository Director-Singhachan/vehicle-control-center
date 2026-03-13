---
name: vehicle-trip-usage-deep-report
overview: ออกแบบและเพิ่มหน้ารายงานการใช้รถรายคัน รายวัน รายทริป พร้อมตัวกรองช่วงเวลาและรายละเอียดสินค้า/พนักงาน ให้ต่อยอดจาก DailySummary และTrip History ที่มีอยู่
todos:
  - id: add-vehicle-trip-usage-service
    content: สร้าง vehicleTripUsageService สำหรับสรุปการใช้รถรายวันในช่วงวันที่ต่อ vehicle_id โดยใช้ tripLogService.getTripHistory
    status: pending
  - id: create-vehicle-trip-usage-hooks
    content: สร้าง hook useVehicleTripUsageReport และ hook ย่อยสำหรับ aggregated products และ staff distribution
    status: pending
  - id: implement-vehicle-trip-usage-view
    content: สร้าง View/Report ใหม่ VehicleTripUsageView พร้อมตัวกรองและตารางสรุปรายวัน + modal รายละเอียดทริป
    status: pending
  - id: wire-view-into-reportsview
    content: เพิ่มแท็บรายงานการใช้รถละเอียดเข้าไปใน ReportsView และทดสอบ navigation
    status: pending
  - id: write-tests-and-ux-polish
    content: เขียนเทสต์พื้นฐานและปรับ UX (loading, empty state, performance) สำหรับรายงานใหม่
    status: pending
isProject: false
---

## แผนเพิ่มรายงานการใช้รถรายคันแบบละเอียด

### 1. ออกแบบ UX/โครงหน้าให้ชัดเจน

- **รูปแบบการเข้าถึง**
  - เพิ่มแท็บใหม่ใน `[views/ReportsView.tsx](views/ReportsView.tsx)` เช่น `vehicle-trip-usage` ชื่อไทย "รายงานการใช้รถละเอียด" ภายใต้หน้า `ReportsView` เดิม
  - หรือเพิ่มเมนู/route ใหม่เช่น `VehicleTripUsageView` แล้วใช้จากเมนูรายงาน (เลือกแนวทางแท็บใน `ReportsView` เป็นหลักก่อน เพื่อใช้ตัวกรองกลางที่มีอยู่)
- **โครงหน้า (View ระดับบน)**
  - ส่วนตัวกรองด้านบน: 
    - เลือกรถ (dropdown จากตาราง `vehicles`)
    - เลือกช่วงวันที่ (`startDate`, `endDate`)
    - เลือกสาขา (ออปชันเสริม ใช้ pattern จาก `[views/DailySummaryView.tsx](views/DailySummaryView.tsx)`)
  - ส่วนผลสรุป: ตารางแสดงหนึ่งแถวต่อ 1 วัน ในช่วงวันที่เลือก ของรถคันนั้น
  - ส่วนรายละเอียด: เมื่อคลิกวันที่ → เปิด modal หรือ section ด้านล่างที่แสดง "ทริปทั้งหมดของวันนั้น" แล้วคลิกต่อเข้าไปดูสินค้า/พนักงานในทริปได้

### 2. ออกแบบโครงสร้างข้อมูลและ service ฝั่ง backend (Supabase + services)

- **ใช้ service ที่มีอยู่เป็นฐาน**
  - ใช้ `tripLogService.getTripHistory` จาก `[services/tripLogService.ts](services/tripLogService.ts)` เป็นแหล่งข้อมูลหลักของ Trip Logs ตามช่วงเวลาและ vehicle_id
  - ใช้ `tripHistoryAggregatesService` จาก `[services/deliveryTrip/tripHistoryAggregatesService.ts](services/deliveryTrip/tripHistoryAggregatesService.ts)` สำหรับดึง:
    - `getAggregatedProducts(tripId)` → สรุปจำนวนสินค้า/ร้านในทริป
    - `getStaffItemDistribution(tripId)` → สรุปสินค้า/ชิ้นงานที่แต่ละพนักงานถือในทริป
- **สร้าง service ใหม่สำหรับสรุปการใช้รถรายวันในช่วงเวลา**
  - เพิ่มไฟล์ใหม่เช่น `[services/vehicleTripUsageService.ts](services/vehicleTripUsageService.ts)` ที่ทำหน้าที่:
    - ดึง trip logs โดยเรียก `tripLogService.getTripHistory({ vehicle_id, start_date, end_date })`
    - Group ตามวันที่ `date(checkout_time)` และคำนวณ:
      - `tripCountPerDay`
      - `driversPerDay` (รายชื่อคนขับไม่ซ้ำ)
      - Link เฉพาะ trip ที่มี `delivery_trip_id` เพื่อนำไปใช้กับ aggregates ของสินค้า
    - คืนโครงสร้างข้อมูลเช่น:
      - `VehicleTripDailySummary[]` (หนึ่ง record ต่อวัน มี summary และลิสต์ทริปของวันนั้นแบบเบื้องต้น)
- **กำหนด interface ที่ใช้ใน frontend**
  - ใน service หรือ `types/` เพิ่ม interface เช่น:
    - `VehicleTripDailySummary` { date, trip_count, total_distance_km, total_items, total_skus, drivers[], trips[] }
    - `VehicleTripDetail` { trip_log_id, delivery_trip_id, trip_number, checkout_time, checkin_time, driver_name, crew_members[], distance_km }

### 3. สร้าง custom hook สำหรับดึงข้อมูลรายงาน

- **เพิ่ม hook ใหม่** เช่น `[hooks/useVehicleTripUsageReport.ts](hooks/useVehicleTripUsageReport.ts)`
  - รับพารามิเตอร์: `vehicleId`, `startDate`, `endDate`
  - ใช้ `useState` เก็บ `{ data, loading, error }` ตาม pattern ของ hooks อื่นในโปรเจ็กต์
  - ภายในเรียก `vehicleTripUsageService.getVehicleDailyUsage({ vehicleId, startDate, endDate })`
  - คืนค่าที่ frontend ใช้ได้ง่าย:
    - `dailySummaries` (array)
    - helper เช่น `refetch()`

### 4. สร้าง View ใหม่สำหรับรายงานการใช้รถละเอียด

- **ไฟล์ View ใหม่**
  - สร้าง `[views/VehicleTripUsageView.tsx](views/VehicleTripUsageView.tsx)` (หรือ `[views/reports/VehicleTripUsageReport.tsx](views/reports/VehicleTripUsageReport.tsx)` ถ้าต้องการแยก folder แบบ report อื่น)
  - โครงเดียวกับ view อื่น ๆ: ใช้ `PageLayout`, `Card`, `Button` จาก `components/ui`
- **ส่วนตัวกรองด้านบน**
  - Dropdown เลือกรถ:
    - ใช้ hook ที่มีอยู่สำหรับ list รถ (เช่น `useVehicles` ถ้ามี; ถ้าไม่มีก็สร้าง hook ดึงจาก Supabase แบบเดียวกับ view รายการรถ)
  - Date range picker:
    - ใช้ `<input type="date">` สองช่อง `start` / `end` ตาม pattern ใน `DailySummaryView`
  - ปุ่ม `ค้นหา` / `รีเฟรช` ที่เรียก `refetch()` จาก `useVehicleTripUsageReport`
- **ตารางสรุปรายวันของรถคันที่เลือก**
  - ใช้ข้อมูลจาก hook แสดงคอลัมน์:
    - วันที่ (แสดงในรูปแบบไทย, เช่น `formatDate` จาก `DailySummaryView`)
    - จำนวนทริป
    - จำนวนชิ้นรวม (sum จากทุกทริปของวัน; ขั้นแรกใช้เพียงจำนวนทริป ถ้ายังไม่มี product summary)
    - จำนวน SKU (ถ้าต้องการ ต้อง pre-aggregate จาก `getAggregatedProducts` หรือดึงตอนเปิดรายละเอียดวัน)
    - รายชื่อคนขับ (join ด้วย `;` )
    - ปุ่ม "ดูรายละเอียดทริปของวันนี้"
- **Modal/Section รายละเอียดทริปในวันนั้น**
  - เมื่อคลิกแถวของวัน:
    - เปิด modal (pattern แบบ `selectedVehicle` + `vehicleTrips` ใน `[views/DailySummaryView.tsx](views/DailySummaryView.tsx)`) แต่อยู่ใน context รถคันเดียว
    - ใช้ข้อมูล trip list ที่ service คืนให้ (หรือถ้ายังไม่มี detail ก็เรียก `tripLogService.getTripHistory` ซ้ำเฉพาะวันนั้น + vehicle_id)
  - ตารางใน modal:
    - เลขทริป (`delivery_trip.trip_number` ถ้ามี)
    - เวลาออก / เวลากลับ
    - คนขับ
    - ระยะทาง (จาก odometer หรือ manual_distance)
    - ปลายทาง/เส้นทาง
    - ปุ่ม "ดูสินค้า" และ/หรือ "ดูการแบ่งของตามพนักงาน" ต่อทริป

### 5. สร้าง component รายละเอียดในระดับทริป

- **Component รายละเอียดสินค้าในทริป**
  - ไฟล์ใหม่เช่น `[components/trip/TripProductSummarySection.tsx](components/trip/TripProductSummarySection.tsx)`
  - Props: `tripId: string`
  - ภายในเรียก `tripHistoryAggregatesService.getAggregatedProducts(tripId)` (ผ่าน hook แยกเช่น `useTripAggregatedProducts(tripId)`) แล้วแสดงตาราง:
    - รหัสสินค้า, ชื่อสินค้า, หน่วย
    - จำนวนรวมในทริปนั้น
    - ปุ่ม/accordion ดูรายละเอียดตามร้าน (ใช้ `stores[]` จาก service เดิม)
- **Component รายละเอียดการแบ่งสินค้าให้ลูกเรือ**
  - ไฟล์ใหม่เช่น `[components/trip/TripStaffItemDistributionSection.tsx](components/trip/TripStaffItemDistributionSection.tsx)`
  - Props: `tripId: string`
  - เรียก `tripHistoryAggregatesService.getStaffItemDistribution(tripId)` (ผ่าน hook `useTripStaffItemDistribution`) แล้วแสดงตาราง:
    - ชื่อพนักงาน, บทบาท (คนขับ/ลูกมือ)
    - จำนวนชิ้นต่อคน (`total_items_per_staff`)
    - จำนวน SKU / จำนวนร้านที่เกี่ยวข้อง
- **ผูกกับ modal รายละเอียดทริป**
  - เมื่อคลิกปุ่ม "ดูสินค้า" หรือ "ดูการแบ่งของ" ในตารางทริปของวัน:
    - เปิด tab ภายใน modal หรืออีก modal เล็กที่แสดงสอง section ข้างต้น

### 6. ผูก View ใหม่เข้ากับ ReportsView

- ใน `[views/ReportsView.tsx](views/ReportsView.tsx)`:
  - เพิ่มค่าใหม่ใน `type ReportTab` เช่น `'vehicle-trip-usage'`
  - เพิ่ม config ใน `TAB_CONFIG` ชื่อแท็บ "รายงานการใช้รถละเอียด" พร้อมไอคอน (เช่น `Truck` หรือ `Route`)
  - ใต้ส่วน render tab content เพิ่มเงื่อนไข:
    - `{activeTab === 'vehicle-trip-usage' && <VehicleTripUsageView isDark={isDark} />}` หรือถ้าใช้ใน sub-view reports: `<VehicleTripUsageReport ... />`

### 7. การจัดการ performance และ UX

- **โหลดข้อมูลตามต้องการ**
  - ไม่ควรดึง `getAggregatedProducts` / `getStaffItemDistribution` สำหรับทุกทริปของช่วงเวลาในคราวเดียว เพราะอาจหนักมาก
  - ดึงเฉพาะเมื่อผู้ใช้คลิกเปิดรายละเอียดทริป (lazy load) แล้วแคชผลลัพธ์ต่อ tripId ภายใน hook เพื่อไม่ต้องยิงซ้ำ
- **จำกัดช่วงวันที่เริ่มต้น**
  - ตั้ง default ช่วงวันที่เช่น 7–14 วันล่าสุด เพื่อไม่ให้ query ใหญ่เกินไป ถ้าผู้ใช้ต้องการย้อนหลังมากขึ้นค่อยเปลี่ยนเอง
- **รองรับกรณีไม่มีข้อมูล**
  - แสดง state "ไม่มีข้อมูล" ทั้งระดับสรุปรายวันและระดับ modal โดยยึด pattern จาก `TripReport` และ `DailySummaryView`

### 8. ทดสอบและปรับปรุง

- **Test ระดับ service และ hook**
  - เพิ่ม unit test ใน style โปรเจ็กต์ (Vitest) สำหรับ `vehicleTripUsageService` และ `useVehicleTripUsageReport` โดย mock Supabase หรือใช้ fake data
- **Test ระดับ UI**
  - ทดสอบกรณี:
    - มีทริปหลายวันในช่วงที่เลือก
    - ไม่มีทริปเลย
    - มีทริปที่เป็น non-delivery (ไม่มี `delivery_trip_id`) → ยังเห็นในตารางทริป แต่รายละเอียดสินค้า/ลูกเรือ (จาก aggregates) จะใช้ได้เฉพาะทริปที่เป็น delivery trip
- **ปรับข้อความ/label ภาษาไทย**
  - ให้สอดคล้องกับข้อความเดิมของระบบ (เช่น ใช้คำว่า "ทริป", "เที่ยว", "สินค้า", "พนักงานขับรถ", "ลูกมือ")

### 9. ภาพรวม data flow (สรุป)

```mermaid
flowchart TD
  user[User] --> reportsView[ReportsView]
  reportsView --> vehicleTripUsageView[VehicleTripUsageView]
  vehicleTripUsageView --> filters[Filters(vehicle,startDate,endDate)]
  vehicleTripUsageView --> hook[useVehicleTripUsageReport]
  hook --> service[vehicleTripUsageService]
  service --> tripLogService[tripLogService.getTripHistory]
  vehicleTripUsageView --> dailyTable[DailySummaryTable]
  dailyTable --> dayModal[DayTripsModal]
  dayModal --> tripList[TripListForDay]
  tripList --> tripDetail[TripDetailSections]
  tripDetail --> prodAgg[tripHistoryAggregatesService.getAggregatedProducts]
  tripDetail --> staffAgg[tripHistoryAggregatesService.getStaffItemDistribution]
```



