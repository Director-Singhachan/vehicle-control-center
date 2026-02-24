---
name: ""
overview: ""
todos: []
isProject: false
---

# Phase 3: Deep Refactor Plan — แผนปฏิบัติการลดความผิดพลาด

> **วัตถุประสงค์**: แยกไฟล์วิกฤตและ Services | **ความเสี่ยงสูง** | ใช้เวลา 1–2 สัปดาห์  
> **หลักการ**: ทำทีละหน่วย → ทดสอบ → commit → ทำต่อ

---

## สัญญาณเตือนความผิดพลาด (Red Flags)


| สัญญาณ                    | การป้องกัน                            |
| ------------------------- | ------------------------------------- |
| แก้หลายไฟล์พร้อมกัน       | ทำทีละ 1 component/hook แล้ว commit   |
| เปลี่ยน logic ขณะ extract | **ห้าม** — เฟสนี้เน้น move เท่านั้น   |
| ไม่ทดสอบหลัง extract      | ทดสอบ flow หลักทันที ก่อน commit      |
| แก้ import ทั้งโปรเจค     | ใช้ **Re-export Pattern** จากไฟล์เดิม |
| State แยกกันแต่ต้อง sync  | รวมไว้ใน hook เดียว — อย่าแตก         |


---

## ลำดับการดำเนินงานที่แนะนำ

```
3.4 Lazy Loading     → ✅ เสร็จแล้ว (มีอยู่ใน index.tsx)
3.1 ReportsView      → เริ่มจาก ReportFilters + แท็บที่แยกง่าย
3.3 CreateTripFromOrdersView → Wizard steps แยกชัด
3.2 DeliveryTripFormView → Form sections ซับซ้อน
3.5 Services split   → ทำหลัง views เสร็จ (มี re-export)
```

---

## 3.1 ReportsView Split

### สถานะจริง (8 แท็บ)


| แท็บ | ชื่อในโค้ด        | Hooks หลัก                                                       | ความซับซ้อน |
| ---- | ----------------- | ---------------------------------------------------------------- | ----------- |
| 1    | fuel              | useMonthlyFuelReport, useVehicleFuelComparison, useFuelTrend     | สูง         |
| 2    | trip              | useMonthlyTripReport, useVehicleTripSummary, useDriverTripReport | สูง         |
| 3    | maintenance       | useMonthlyMaintenanceReport, useVehicleMaintenanceComparison     | กลาง        |
| 4    | cost              | useCostPerKm, useMonthlyCostTrend                                | กลาง        |
| 5    | usage             | useVehicleUsageRanking                                           | กลาง        |
| 6    | fuel-consumption  | useVehicleFuelConsumption                                        | กลาง        |
| 7    | delivery          | useDeliverySummary*, useStaffCommission*, useStaffItem*          | สูงมาก      |
| 8    | vehicle-documents | VehicleDocumentReports                                           | ต่ำ         |


### Shared State ที่ต้องจัดการ

- `filterPeriod`, `customStartDate`, `customEndDate` → `startDate`, `endDate`
- `selectedBranch`, `branches`
- `months` (ใช้ใน fuel, trip, maintenance, cost)

### ขั้นตอน (ทำทีละขั้น)

#### Step 1: สร้าง ReportFilters + useReportFilters ✅ (ทำแล้ว)

- สร้าง `views/reports/ReportFilters.tsx` — ย้าย UI ฟิลเตอร์ (period, branch, months) ✅
- สร้าง `hooks/useReportFilters.ts` — state + logic คำนวณ startDate/endDate ✅
- **เช็ค**: เปลี่ยน filter แล้ว date range ถูกต้อง (รอ verify จากผู้ใช้)
- **Commit**: `feat(reports): extract ReportFilters and useReportFilters`

#### Step 2: แยกแท็บ vehicle-documents (ง่ายที่สุด) ✅ (ทำแล้ว)

- สร้าง `views/reports/VehicleDocumentsReport.tsx` ✅
- ย้ายโค้ด `activeTab === 'vehicle-documents'` ทั้งบล็อก ✅
- รับ props: `isDark`, `onNavigateToStoreDetail` (ถ้าใช้) ✅
- **เช็ค**: เปิดแท็บ "เอกสารรถ" แสดงถูก ครบ
- **Commit**: `refactor(reports): extract VehicleDocumentsReport`

#### Step 3: แยกแท็บ usage

- สร้าง `views/reports/VehicleUsageReport.tsx`
- Props: `startDate`, `endDate`, `selectedBranch`, `isDark`
- ย้าย VehicleUsageRankingChart + logic
- **เช็ค**: กราฟ usage ranking แสดงถูก filter ถูก
- **Commit**: `refactor(reports): extract VehicleUsageReport`

#### Step 4: แยกแท็บ fuel-consumption

- สร้าง `views/reports/FuelConsumptionReport.tsx`
- Props เหมือน Step 3
- **เช็ค**: กราฟ fuel consumption
- **Commit**: `refactor(reports): extract FuelConsumptionReport`

#### Step 5: แยกแท็บ fuel, trip, maintenance, cost (ใช้ months)

- แยกทีละแท็บ: FuelReport, TripReport, MaintenanceReport, CostReport
- แต่ละแท็บรับ `months`, `startDate`, `endDate`, `selectedBranch`
- **เช็ค**: แต่ละแท็บ + Export Excel ทำงานได้
- **Commit**: แยก commit ต่อแท็บ

#### Step 6: แยกแท็บ delivery (ซับซ้อนสุด)

- วิเคราะห์ก่อน: มีกี่ sub-section (by vehicle, by store, by product, staff commission, staff item)
- แยกเป็น `DeliveryReportView.tsx` ก่อน หรือหลาย sub-component ตามโครงสร้าง
- **เช็ค**: ทุก sub-tab ใน delivery ทำงาน
- **Commit**: `refactor(reports): extract DeliveryReport`

#### Step 7: Refactor ReportsView เป็น Router

- ReportsView เหลือเฉพาะ: tab switcher + `{activeTab === 'x' && <XReport />}`
- **เช็ค**: สลับทุกแท็บ ไม่มี error
- **Commit**: `refactor(reports): ReportsView as tab orchestrator`

### จุดสำคัญ (ReportsView)

- **Chart.js**: ยัง register ใน entry point (index หรือ ReportsView) — อย่าย้ายไป sub-view
- **Export functions**: ย้ายไปอยู่ในแต่ละ Report component
- **Lazy sub-views**: พิจารณาใช้ `React.lazy` สำหรับแต่ละ Report (โหลดเมื่อเลือกแท็บ)

---

## 3.2 DeliveryTripFormView Split

### โครงสร้างเป้าหมาย

```
views/DeliveryTripFormView.tsx (orchestrator, ~300 บรรทัด)
  ├─ components/trip/TripBasicInfoForm.tsx   (วันที่, รถ, คนขับ)
  ├─ components/trip/TripOrdersSection.tsx   (เลือกออเดอร์)
  ├─ components/trip/TripItemsSection.tsx    (รายการสินค้า)
  ├─ components/trip/TripCrewSection.tsx     (เลือกทีมงาน)
  └─ hooks/useDeliveryTripForm.ts            (form state + validation)
```

### ขั้นตอน

#### Step 1: สร้าง useDeliveryTripForm

- แยก state ทั้งหมดของฟอร์มเข้า hook
- Return: `{ formData, setField, errors, validate, ... }`
- **ไม่เปลี่ยน logic** — แค่ย้าย
- **Commit**: `refactor(delivery-trip): extract useDeliveryTripForm`

#### Step 2: แยก TripBasicInfoForm

- วันที่, เลือกรถ, เลือกคนขับ
- Props: ค่า + onChange จาก hook
- **เช็ค**: เลือกรถ/คนขับ ทำงาน validate ถูก
- **Commit**: `refactor(delivery-trip): extract TripBasicInfoForm`

#### Step 3: แยก TripOrdersSection, TripItemsSection, TripCrewSection

- ทำทีละ section
- **เช็ค**: สร้างทริปใหม่ได้ครบ flow
- **Commit**: แยกต่อ section

### จุดสำคัญ (DeliveryTripForm)

- **Form state ต้องอยู่ที่ parent/hook** — อย่าแยก state ที่ต้อง sync
- **Validation** — เก็บใน hook เดียวกัน
- **Submit logic** — อยู่ใน DeliveryTripFormView หรือ hook

---

## 3.3 CreateTripFromOrdersView Split

### โครงสร้างเป้าหมาย

```
views/CreateTripFromOrdersView.tsx (step orchestrator, ~300 บรรทัด)
  ├─ components/trip/OrderSelectionStep.tsx
  ├─ components/trip/VehicleSelectionStep.tsx
  ├─ components/trip/CrewAssignmentStep.tsx
  ├─ components/trip/TripConfirmationStep.tsx
  └─ hooks/useCreateTripWizard.ts (step state, validation, submit)
```

### ขั้นตอน

#### Step 1: สร้าง useCreateTripWizard

- ย้าย step state (currentStep), wizard data, validation
- **Commit**: `refactor(create-trip): extract useCreateTripWizard`

#### Step 2: แยกทีละ Step component

- OrderSelectionStep → VehicleSelectionStep → CrewAssignmentStep → TripConfirmationStep
- **เช็ค**: ผ่านทุก step สร้างทริปสำเร็จ
- **Commit**: แยกต่อ step

### จุดสำคัญ (CreateTripFromOrders)

- **Wizard flow** — อย่าหัก step logic
- **VehicleRecommendationPanel** — มีอยู่แล้ว ใช้ต่อได้

---

## 3.5 Services Split

### หลักการสำคัญ

- **Re-export จากไฟล์เดิม** — ไม่แก้ import ทั้งโปรเจค
- แตก function ตาม domain แล้ว re-export รวม

### reportsService.ts

```
services/reportsService.ts (re-export hub)
  export * from './reports/deliveryReportService';
  export * from './reports/fuelReportService';
  export * from './reports/tripSummaryService';
  export * from './reports/productReportService';
```

### deliveryTripService.ts

```
services/deliveryTripService.ts (re-export hub)
  export * from './deliveryTrip/tripCrudService';
  export * from './deliveryTrip/tripStatusService';
  ...
```

### ขั้นตอน

- แยก function ตาม domain (ตรวจสอบ dependency ระหว่าง function)
- สร้างไฟล์ใหม่ใน subfolder
- แก้ reportsService.ts ให้ re-export
- **เช็ค**: `npm run build` ผ่าน, ไม่มี broken import
- **Commit**: `refactor(services): split reportsService` (ทำทีละ service)

---

## Checkpoint ทุกครั้งหลัง Refactor

- `npm run build` ผ่าน
- `npm run dev` รันได้
- ทดสอบ flow หลักของหน้าที่แก้ (คลิก, กรอก, submit)
- ไม่มี console error ใน browser
- Commit ด้วยข้อความที่บอก refactor อะไร

---

## สรุประยะเวลาโดยประมาณ


| งาน                          | ระยะเวลา      | ความเสี่ยง |
| ---------------------------- | ------------- | ---------- |
| 3.1 ReportsView              | 4–6 วัน       | สูง        |
| 3.2 DeliveryTripFormView     | 2–3 วัน       | สูง        |
| 3.3 CreateTripFromOrdersView | 2–3 วัน       | ปานกลาง    |
| 3.5 Services split           | 2–3 วัน       | ปานกลาง    |
| **รวม**                      | **10–15 วัน** |            |


---

## หลักการที่ต้องจำ

1. **ทำทีละอย่าง** — 1 component หรือ 1 hook ต่อครั้ง
2. **ไม่เปลี่ยน logic** — แค่ย้าย (extract) ไม่แก้ algorithm
3. **ทดสอบก่อน commit** — อย่างน้อยรัน flow หลัก
4. **Re-export สำหรับ services** — ไม่ต้องแก้ import ที่ใช้อยู่
5. **State ที่ sync กันต้องอยู่ที่เดียวกัน** — อย่าแยกออกจากกัน

