# 📊 แนวทางการวิเคราะห์ข้อมูลการส่งสินค้า

## ภาพรวม

ระบบมีข้อมูลการส่งสินค้าที่ชัดเจนในแต่ละเที่ยวแต่ละร้าน ซึ่งสามารถนำมาวิเคราะห์ได้หลายมิติ:

### ข้อมูลที่มี
- **รถแต่ละคัน**: ทะเบียน, ยี่ห้อ, รุ่น, สาขา
- **เที่ยวแต่ละเที่ยว**: รหัสทริป, วันที่, ระยะทาง, ไมล์เริ่มต้น/สิ้นสุด
- **ร้านแต่ละร้าน**: รหัสลูกค้า, ชื่อร้าน, ที่อยู่, ลำดับการส่ง
- **สินค้าแต่ละรายการ**: รหัสสินค้า, ชื่อสินค้า, หมวดหมู่, จำนวน, หน่วย

---

## 🚗 1. รายงานสรุปตามรถ (Delivery Summary by Vehicle)

### ข้อมูลที่ได้
- จำนวนเที่ยวทั้งหมด
- จำนวนร้านทั้งหมด
- จำนวนรายการสินค้าทั้งหมด
- จำนวนสินค้าทั้งหมด (รวม quantity)
- ระยะทางรวม
- ค่าเฉลี่ยรายการสินค้าต่อเที่ยว
- ค่าเฉลี่ยจำนวนสินค้าต่อเที่ยว
- ค่าเฉลี่ยร้านต่อเที่ยว

### วิธีใช้งาน

```typescript
import { useDeliverySummaryByVehicle } from '../hooks/useReports';

// สรุป 3 เดือนล่าสุด
const { data, loading, error } = useDeliverySummaryByVehicle(
  new Date(2025, 0, 1),  // เริ่มต้น
  new Date(2025, 2, 31), // สิ้นสุด
  undefined              // รถเฉพาะ (ถ้าต้องการ)
);
```

### ตัวอย่างการวิเคราะห์
- **รถไหนส่งสินค้ามากที่สุด?** → เรียงตาม `totalTrips` หรือ `totalQuantity`
- **รถไหนมีประสิทธิภาพสูงสุด?** → ดู `averageQuantityPerTrip` หรือ `totalQuantity / totalDistance`
- **รถไหนส่งร้านมากที่สุด?** → ดู `totalStores` หรือ `averageStoresPerTrip`

---

## 🏪 2. รายงานสรุปตามร้าน (Delivery Summary by Store)

### ข้อมูลที่ได้
- จำนวนเที่ยวที่ส่งให้ร้านนี้
- จำนวนรายการสินค้าทั้งหมด
- จำนวนสินค้าทั้งหมด (รวม quantity)
- รายการสินค้าที่ส่งให้ร้านนี้ (พร้อมจำนวนและจำนวนครั้งที่ส่ง)

### วิธีใช้งาน

```typescript
import { useDeliverySummaryByStore } from '../hooks/useReports';

// สรุป 3 เดือนล่าสุด
const { data, loading, error } = useDeliverySummaryByStore(
  new Date(2025, 0, 1),
  new Date(2025, 2, 31),
  undefined  // ร้านเฉพาะ (ถ้าต้องการ)
);
```

### ตัวอย่างการวิเคราะห์
- **ร้านไหนส่งบ่อยที่สุด?** → เรียงตาม `totalTrips`
- **ร้านไหนรับสินค้ามากที่สุด?** → เรียงตาม `totalQuantity`
- **ร้านไหนรับสินค้าอะไรบ้าง?** → ดู `products` array
- **สินค้าไหนส่งให้ร้านนี้บ่อยที่สุด?** → ดู `products` array เรียงตาม `deliveryCount`

---

## 📦 3. รายงานสรุปตามสินค้า (Delivery Summary by Product)

### ข้อมูลที่ได้
- จำนวนสินค้าทั้งหมดที่ส่ง (รวม quantity)
- จำนวนครั้งที่ส่ง (delivery count)
- จำนวนร้านที่ส่งให้
- รายการร้านที่ส่งให้ (พร้อมจำนวนและจำนวนครั้งที่ส่ง)

### วิธีใช้งาน

```typescript
import { useDeliverySummaryByProduct } from '../hooks/useReports';

// สรุป 3 เดือนล่าสุด
const { data, loading, error } = useDeliverySummaryByProduct(
  new Date(2025, 0, 1),
  new Date(2025, 2, 31),
  undefined  // สินค้าเฉพาะ (ถ้าต้องการ)
);
```

### ตัวอย่างการวิเคราะห์
- **สินค้าไหนส่งมากที่สุด?** → เรียงตาม `totalQuantity`
- **สินค้าไหนส่งให้ร้านมากที่สุด?** → เรียงตาม `totalStores`
- **สินค้าไหนส่งบ่อยที่สุด?** → เรียงตาม `totalDeliveries`
- **ร้านไหนรับสินค้านี้มากที่สุด?** → ดู `stores` array ในแต่ละสินค้า

---

## 📅 4. รายงานรายเดือน (Monthly Delivery Report)

### ข้อมูลที่ได้
- จำนวนเที่ยวทั้งหมด
- จำนวนร้านทั้งหมด
- จำนวนรายการสินค้าทั้งหมด
- จำนวนสินค้าทั้งหมด (รวม quantity)
- ระยะทางรวม
- ค่าเฉลี่ยรายการสินค้าต่อเที่ยว
- ค่าเฉลี่ยจำนวนสินค้าต่อเที่ยว

### วิธีใช้งาน

```typescript
import { useMonthlyDeliveryReport } from '../hooks/useReports';

// รายงาน 6 เดือนล่าสุด
const { data, loading, error } = useMonthlyDeliveryReport(6);
```

### ตัวอย่างการวิเคราะห์
- **เทรนด์การส่งสินค้าเพิ่มขึ้นหรือลดลง?** → ดู `totalTrips` หรือ `totalQuantity` แต่ละเดือน
- **เดือนไหนส่งสินค้ามากที่สุด?** → เรียงตาม `totalQuantity`
- **ประสิทธิภาพการส่งสินค้าเพิ่มขึ้นหรือไม่?** → ดู `averageQuantityPerTrip` แต่ละเดือน

---

## 💡 ตัวอย่างการวิเคราะห์ขั้นสูง

### 1. ประสิทธิภาพการส่งสินค้า (Productivity)
```typescript
// สินค้าต่อระยะทาง (items per km)
const productivity = totalItems / totalDistance;

// สินค้าต่อเที่ยว (items per trip)
const itemsPerTrip = totalItems / totalTrips;

// จำนวนสินค้าต่อระยะทาง (quantity per km)
const quantityPerKm = totalQuantity / totalDistance;
```

### 2. ต้นทุนการส่งสินค้า (Cost Analysis)
```typescript
// ต้นทุนต่อเที่ยว (ถ้ามีข้อมูลค่าใช้จ่าย)
const costPerTrip = totalCost / totalTrips;

// ต้นทุนต่อร้าน
const costPerStore = totalCost / totalStores;

// ต้นทุนต่อจำนวนสินค้า
const costPerQuantity = totalCost / totalQuantity;
```

### 3. การกระจายสินค้า (Distribution)
```typescript
// ร้านที่รับสินค้ามากที่สุด 10 อันดับแรก
const topStores = stores.sort((a, b) => b.totalQuantity - a.totalQuantity).slice(0, 10);

// สินค้าที่ส่งมากที่สุด 10 อันดับแรก
const topProducts = products.sort((a, b) => b.totalQuantity - a.totalQuantity).slice(0, 10);

// รถที่ส่งสินค้ามากที่สุด 10 อันดับแรก
const topVehicles = vehicles.sort((a, b) => b.totalQuantity - a.totalQuantity).slice(0, 10);
```

### 4. การวิเคราะห์เทรนด์ (Trend Analysis)
```typescript
// เปรียบเทียบเดือนนี้กับเดือนที่แล้ว
const thisMonth = monthlyData[monthlyData.length - 1];
const lastMonth = monthlyData[monthlyData.length - 2];
const growth = ((thisMonth.totalQuantity - lastMonth.totalQuantity) / lastMonth.totalQuantity) * 100;
```

---

## 📊 การสร้าง Dashboard

### แนะนำ Metrics ที่ควรแสดง
1. **ภาพรวม (Overview)**
   - จำนวนเที่ยวทั้งหมด (เดือนนี้)
   - จำนวนร้านทั้งหมด (เดือนนี้)
   - จำนวนสินค้าทั้งหมด (เดือนนี้)
   - ระยะทางรวม (เดือนนี้)

2. **Top Rankings**
   - Top 10 รถที่ส่งสินค้ามากที่สุด
   - Top 10 ร้านที่รับสินค้ามากที่สุด
   - Top 10 สินค้าที่ส่งมากที่สุด

3. **Trends**
   - กราฟจำนวนเที่ยวรายเดือน
   - กราฟจำนวนสินค้ารายเดือน
   - กราฟระยะทางรายเดือน

4. **Efficiency**
   - สินค้าต่อเที่ยว (เฉลี่ย)
   - สินค้าต่อระยะทาง (เฉลี่ย)
   - ร้านต่อเที่ยว (เฉลี่ย)

---

## 🔧 การ Export ข้อมูล

### Export เป็น Excel
```typescript
import { excelExport } from '../utils/excelExport';

// Export รายงานตามรถ
excelExport(
  vehicleData,
  'รายงานการส่งสินค้าตามรถ.xlsx',
  [
    { header: 'ทะเบียนรถ', key: 'plate' },
    { header: 'จำนวนเที่ยว', key: 'totalTrips' },
    { header: 'จำนวนร้าน', key: 'totalStores' },
    { header: 'จำนวนสินค้า', key: 'totalQuantity' },
    { header: 'ระยะทาง (กม.)', key: 'totalDistance' },
  ]
);
```

---

## 📝 หมายเหตุ

- ข้อมูลทั้งหมดมาจาก delivery trips ที่มี status = `'completed'` เท่านั้น
- ระยะทางมาจาก `trip_logs.distance` ที่เชื่อมโยงกับ delivery trip
- จำนวนสินค้า (quantity) รวมจากทุกร้านในเที่ยวเดียวกัน
- การคำนวณค่าเฉลี่ยใช้ข้อมูลจริงจากฐานข้อมูล ไม่ใช่การประมาณ

---

## 🚀 ขั้นตอนต่อไป

1. **สร้าง View สำหรับแสดงรายงาน** - เพิ่ม tab ใหม่ใน `ReportsView` หรือสร้างหน้าใหม่
2. **สร้าง Charts/Graphs** - ใช้ Chart.js หรือ react-chartjs-2 เพื่อแสดงข้อมูลแบบกราฟ
3. **เพิ่ม Filters** - กรองตามวันที่, รถ, ร้าน, สินค้า, สาขา
4. **Export Functions** - สร้างฟังก์ชันสำหรับ export ข้อมูลเป็น Excel/PDF
5. **Dashboard Widgets** - สร้าง widgets สำหรับแสดงในหน้า Dashboard

